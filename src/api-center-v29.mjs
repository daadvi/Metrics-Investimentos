/** Metrics 2.9 API Center: fixed-host connectors, catalogs, no bulk quote hallucination. */
import {randomUUID,createHash,randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const PROVIDER_TYPES=Object.freeze([
 {id:'brapi',name:'brapi.dev',region:'BR',catalog:true,catalogType:'SYMBOLS',quotes:true,universe:'B3: lista pública de símbolos; cotações dependem do plano',reference:'https://brapi.dev/docs'},
 {id:'alphavantage',name:'Alpha Vantage',region:'US',catalog:true,catalogType:'LISTING_STATUS',quotes:true,universe:'Ações e ETFs listados nos EUA; alguns endpoints exigem plano pago',reference:'https://www.alphavantage.co/documentation/'},
 {id:'hgbrasil',name:'HG Brasil',region:'BR',catalog:false,quotes:true,universe:'Sem catálogo geral validado neste conector; atualiza ativos acompanhados',reference:'https://hgbrasil.com/'},
 {id:'dadosdemercado',name:'Dados de Mercado',region:'BR',catalog:false,quotes:true,universe:'Sem catálogo geral validado neste conector; atualiza ativos acompanhados',reference:'https://www.dadosdemercado.com.br/api/docs'},
 {id:'massive',name:'Massive',region:'US',catalog:false,quotes:true,universe:'Sem catálogo geral validado neste conector; atualiza ativos acompanhados',reference:'https://massive.com/docs'}
]);
const known=new Map(PROVIDER_TYPES.map(p=>[p.id,p]));
const clean=(x,max=80)=>String(x??'').trim().slice(0,max);
const moneySymbols=/^[A-Z0-9.^:-]{1,24}$/;
const MAX_CATALOG=12000;
export function providerOf(id){const p=known.get(String(id||''));if(!p)throw Error('Fornecedor de API não suportado.');return p;}
export function validateConnection(input){const p=providerOf(input.provider),label=clean(input.label,70)||p.name;
 const key=String(input.key??'').trim();
 if(key && (key.length<6||key.length>512||/[\r\n\x00-\x1f]/.test(key)))throw Error('Chave de API inválida.');
 if(p.id!=='brapi'&&!key)throw Error('Esse provedor exige uma chave de API.');
 if(input.label && String(input.label).trim().length>70)throw Error('Nome da conexão muito longo.');
 return {provider:p.id,label,key};
}
export function catalogFromBrapi(data,{max=MAX_CATALOG}={}){
 if(!data||!Array.isArray(data.stocks))throw Error('Formato de catálogo brapi inesperado.');
 const symbols=[...data.stocks,...(Array.isArray(data.indexes)?data.indexes:[])];let dropped=0;
 const out=[],seen=new Set();for(const value of symbols){const symbol=clean(value,24).toUpperCase();if(!moneySymbols.test(symbol))continue;if(seen.has(symbol))continue;seen.add(symbol);if(out.length<max)out.push({symbol,name:'',type:'ATIVO'});else dropped++;}
 return {items:out,totalSeen:seen.size,truncated:dropped>0};
}
function csvRows(text,maxRows=MAX_CATALOG+1){let rows=[],row=[],field='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){field+='"';i++;}else q=!q;}else if(c===','&&!q){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';if(rows.length>maxRows)break;}else field+=c;}
 if(field||row.length){row.push(field);if(rows.length<=maxRows)rows.push(row);}return rows;}
export function catalogFromAlpha(text,{max=MAX_CATALOG}={}){
 if(/^\s*[\[{]/.test(text))throw Error('Alpha Vantage retornou aviso JSON, possivelmente por limite de chamadas ou chave inválida.');
 const rows=csvRows(text,max+2),header=rows.shift()?.map(s=>s.trim().toLowerCase())||[];
 const sym=header.indexOf('symbol'),name=header.indexOf('name'),type=header.indexOf('assettype'),status=header.indexOf('status');
 if(sym<0||name<0)throw Error('Listagem Alpha Vantage em formato inesperado.');
 const items=[],seen=new Set();let truncated=false;
 for(const row of rows){if(status>=0&&row[status]&&!/^active$/i.test(row[status]))continue;const symbol=clean(row[sym],24).toUpperCase();if(!moneySymbols.test(symbol)||seen.has(symbol))continue;seen.add(symbol);if(items.length<max)items.push({symbol,name:clean(row[name],110),type:clean(type>=0?row[type]:'ATIVO',36)});else truncated=true;}
 return {items,totalSeen:seen.size,truncated:truncated||rows.length>max};
}
async function boundedFetch(url,{fetchImpl=fetch,headers={},mime='json',maxBytes=6_000_000,timeout=16000}={}){
 const u=new URL(url),allowed=new Set(['brapi.dev','www.alphavantage.co']);if(u.protocol!=='https:'||!allowed.has(u.hostname)||u.username||u.password)throw Error('Destino não autorizado.');
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),timeout);
 try{const res=await fetchImpl(u.toString(),{headers,signal:ac.signal,redirect:'error'});
  if(!res.ok)throw Error(res.status===429?'Limite da API atingido. Aguarde antes de tentar novamente.':res.status===401||res.status===403?'Chave ou plano sem autorização.':`API indisponível (HTTP ${res.status}).`);
  const len=Number(res.headers?.get?.('content-length')||0);if(len>maxBytes)throw Error('Catálogo grande demais para importar de uma vez.');
  const chunks=[];let bytes=0;
  if(res.body && typeof res.body[Symbol.asyncIterator]==='function'){
   for await(const b of res.body){bytes+=b.length;if(bytes>maxBytes)throw Error('Catálogo excede limite seguro de download.');chunks.push(Buffer.from(b));}
   return Buffer.concat(chunks).toString('utf8');
  }
  const data=await res.text();if(Buffer.byteLength(data)>maxBytes)throw Error('Catálogo excede limite seguro de download.');return data;
 }finally{clearTimeout(timer);}
}
export async function fetchProviderCatalog(provider,key='',{fetchImpl=fetch}={}){
 const p=providerOf(provider);if(!p.catalog)throw Error('Este conector não publica um catálogo geral validado. Use a sincronização dos ativos acompanhados.');
 if(p.id==='brapi'){
  const body=await boundedFetch('https://brapi.dev/api/available',{fetchImpl});const result=catalogFromBrapi(JSON.parse(body));
  return {...result,provider:p.id,fetchedAt:new Date().toISOString(),source:'https://brapi.dev/api/available',warning:'Importação de códigos disponíveis, não download de preços ou autorização para redistribuição.'};
 }
 if(!key)throw Error('Informe a chave da Alpha Vantage.');
 const url=new URL('https://www.alphavantage.co/query');url.searchParams.set('function','LISTING_STATUS');url.searchParams.set('apikey',key);
 const body=await boundedFetch(url.toString(),{fetchImpl,mime:'csv',maxBytes:8_000_000});const result=catalogFromAlpha(body);
 // Never include the request URL, which contains a secret.
 return {...result,provider:p.id,fetchedAt:new Date().toISOString(),source:'Alpha Vantage LISTING_STATUS',warning:'Listagem de títulos ativos. Não representa histórico ou cotações sincronizados.'};
}
export function searchCatalog(db,connectionId,{q='',page=1,limit=50}={}){
 const saved=(db.apiCatalogV29||[]).find(x=>x.connectionId===connectionId);if(!saved)return {items:[],total:0,page:1,hasMore:false,requiresRefresh:true};
 const needle=clean(q,100).toLocaleLowerCase('pt-BR');const pg=Math.max(1,Math.min(1000,Number(page)||1)),take=Math.max(1,Math.min(100,Number(limit)||50));
 const matches=needle?saved.items.filter(x=>x.symbol.toLowerCase().includes(needle)||x.name?.toLocaleLowerCase('pt-BR').includes(needle)):saved.items;
 const start=(pg-1)*take;return {items:matches.slice(start,start+take),total:matches.length,page:pg,hasMore:matches.length>start+take,requiresRefresh:false,fetchedAt:saved.fetchedAt,truncated:saved.truncated||false,source:saved.source};
}
export function trackedTickers(db,provider,{offset=0,limit=8}={}){
 const p=providerOf(provider),regional=p.region==='US';const seen=new Set();
 const candidates=regional?[...(db.foreignTrades||[]).map(x=>x.ticker),...(db.instruments||[]).filter(x=>x.currency!=='BRL').map(x=>x.ticker)]:[...(db.transactions||[]).map(x=>x.ticker),...(db.watchlist||[]).map(x=>x.ticker)];
 const rows=[];for(const candidate of candidates){const t=clean(candidate,24).toUpperCase();if(!moneySymbols.test(t)||seen.has(t))continue;
  const classed=(db.instruments||[]).find(x=>x.ticker===t);if(regional&&classed?.currency==='BRL'||!regional&&classed&&classed.currency!=='BRL')continue;
  seen.add(t);rows.push(t);
 }
 const take=Math.max(1,Math.min(10,Number(limit)||8));const from=Math.max(0,Math.floor(Number(offset)||0));return {tickers:rows.slice(from,from+take),total:rows.length,nextOffset:from+take<rows.length?from+take:null};
}
/** Credentials live in this process, or AES-256-GCM vault outside the repo when a device key exists. */
export function createApiVault({dir,passphrase=process.env.METRICS_PASSPHRASE||'',fileName='provider-secrets-v29.enc'}={}){
 if(!dir)throw Error('Diretório privado obrigatório.');const file=path.join(dir,fileName),session=new Map();let queue=Promise.resolve();
 const k=(portfolio,id)=>String(portfolio)+'|'+String(id);
 function lock(f){const next=queue.then(f);queue=next.catch(()=>{});return next;}
 async function load(){if(!passphrase)return {};let raw;try{raw=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw Error('Cofre de APIs não pôde ser aberto.');}
  try{if(raw.v!==1)throw Error('formato');const salt=Buffer.from(raw.salt,'base64'),iv=Buffer.from(raw.iv,'base64');const key=scryptSync(passphrase,salt,32);const dec=createDecipheriv('aes-256-gcm',key,iv);dec.setAuthTag(Buffer.from(raw.tag,'base64'));return JSON.parse(Buffer.concat([dec.update(Buffer.from(raw.cipher,'base64')),dec.final()]).toString('utf8'));}
  catch{throw Error('Cofre de APIs inacessível: chave diferente ou arquivo corrompido.');}
 }
 async function write(data){if(!passphrase)return;await fs.mkdir(dir,{recursive:true,mode:0o700});const salt=randomBytes(16),iv=randomBytes(12),key=scryptSync(passphrase,salt,32),enc=createCipheriv('aes-256-gcm',key,iv);const cipher=Buffer.concat([enc.update(JSON.stringify(data),'utf8'),enc.final()]);const record=JSON.stringify({v:1,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:enc.getAuthTag().toString('base64'),cipher:cipher.toString('base64')});const tmp=file+'.pending-'+randomUUID();try{await fs.writeFile(tmp,record,{mode:0o600,flag:'wx'});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true}).catch(()=>{});}}
 return {
  persistent:!!passphrase,
  async set(portfolio,id,secret){return lock(async()=>{session.set(k(portfolio,id),secret);if(passphrase){const saved=await load();saved[k(portfolio,id)]=secret;await write(saved);}});},
  async get(portfolio,id){const key=k(portfolio,id);if(session.has(key))return session.get(key);if(!passphrase)return null;const saved=await load();return typeof saved[key]==='string'?saved[key]:null;},
  async remove(portfolio,id){return lock(async()=>{session.delete(k(portfolio,id));if(passphrase){const saved=await load();delete saved[k(portfolio,id)];await write(saved);}});},
  async status(portfolio,id){const secret=await this.get(portfolio,id);return {hasKey:!!secret,storage:secret?(passphrase?'COFRE_CRIPTOGRAFADO':'SOMENTE_SESSAO'):'SEM_CHAVE'};}
 };
}
export function newConnection(input){const p=validateConnection(input);return {id:randomUUID(),provider:p.provider,label:p.label,createdAt:new Date().toISOString(),lastCatalogAt:null,lastSyncAt:null,status:'REGISTRADA_NAO_TESTADA'};}

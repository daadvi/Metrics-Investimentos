import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {encryptBackup,decryptBackup} from './src/backup.mjs';
import {simulatePortfolio} from './src/portfolio-sim.mjs';
import {analyzeFundRisk} from './src/risk.mjs';
import {realizedLedger} from './src/tax.mjs';
import {createXlsx} from './src/export-xlsx.mjs';
import {parseCotahist,fetchRecentB3Prices} from './src/market.mjs';
import {init,read,addTransaction,addTransactionsBulk,rollbackImport,addWatch,editWatch,saveQuote,saveProfile,addEvent,addDocument,removeItem,saveMessages,clearMessages,restoreBackup,location,isEncrypted,saveMarketQuotes} from './src/store.mjs';
import {portfolioTotals,portfolioAnalytics,simulate,simulatePhases} from './src/domain.mjs';
import {parseCSV,parseXLSX,interpretTables,extractPDF} from './src/importers.mjs';
import {askAI} from './src/ai.mjs';
const HOME=path.dirname(fileURLToPath(import.meta.url)),WWW=path.join(HOME,'web');
const PORT=Number(process.env.PORT||4173),HOST='127.0.0.1',ORIGIN=`http://${HOST}:${PORT}`;
const ACCESS_TOKEN=randomBytes(32).toString('hex');
const COOKIE='metrics_session';
function authorized(req){const match=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));if(!match)return false;const supplied=match.slice(COOKIE.length+1);if(supplied.length!==ACCESS_TOKEN.length)return false;return timingSafeEqual(Buffer.from(supplied),Buffer.from(ACCESS_TOKEN));}
function authGate(req,res,url){const attempt=url.searchParams.get('access');if(url.pathname==='/'&&req.method==='GET'&&attempt){if(attempt.length===ACCESS_TOKEN.length&&timingSafeEqual(Buffer.from(attempt),Buffer.from(ACCESS_TOKEN))){res.writeHead(303,{'Set-Cookie':`${COOKIE}=${ACCESS_TOKEN}; HttpOnly; SameSite=Strict; Path=/`,Location:'/', 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'});res.end();return true;}reply(res,403,{error:'Código de acesso inválido.'});return true;}if(url.pathname.startsWith('/api/')&&!authorized(req)){reply(res,401,{error:'Sessão local não autorizada. Abra o Metrics pelo iniciador.'});return true;}return false;}
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json'};
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});res.end(JSON.stringify(data));}
function bad(res,error){const msg=error instanceof Error?error.message:String(error);return reply(res,400,{error:msg.slice(0,600)});}
async function body(req,max=8*1024*1024){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new Error('Envie JSON.');let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw new Error('Arquivo ou mensagem muito grande.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new Error('JSON inválido.');}}
function docsList(db){return db.documents.map(({text,...d})=>({...d,chars:text.length}));}
async function handler(req,res){const url=new URL(req.url,ORIGIN);
 if(req.headers.host&&!['127.0.0.1:'+PORT,'localhost:'+PORT].includes(req.headers.host))return reply(res,403,{error:'Host não autorizado.'});
 if(req.headers.origin && ![ORIGIN,`http://localhost:${PORT}`].includes(req.headers.origin))return reply(res,403,{error:'Origem não autorizada.'});
 if(authGate(req,res,url))return;
 if(url.pathname.startsWith('/api/')){
 try{
  if(req.method==='GET'&&url.pathname==='/api/state'){const db=await read();return reply(res,200,{transactions:db.transactions,watchlist:db.watchlist,messages:db.messages,quotes:db.quotes,profiles:db.profiles,events:db.events,documents:docsList(db),imports:db.imports,settings:db.settings,summary:portfolioTotals(db.transactions),analytics:portfolioAnalytics(db.transactions,db.quotes),dataLocation:location(),encrypted:isEncrypted()});}
  if(req.method==='GET'&&url.pathname==='/api/health')return reply(res,200,{ok:true,version:'0.4.0',db:'sqlite',encrypted:isEncrypted()});
  if(req.method==='GET'&&url.pathname==='/api/export')return reply(res,200,await read());
  if(req.method==='GET'&&url.pathname==='/api/tax/ledger'){
   const d=await read(),year=url.searchParams.get('year')||'';
   return reply(res,200,realizedLedger(d.transactions,d.profiles,{year}));
  }
  if(req.method==='GET'&&url.pathname==='/api/report/xlsx'){
   const d=await read(),year=url.searchParams.get('year')||new Date().getFullYear().toString();
   const ledger=realizedLedger(d.transactions,d.profiles,{year});
   const rows=[['Ticker','Quantidade','Custo','Preço médio','Dividendos','Resultado realizado'],...portfolioTotals(d.transactions).positions.map(p=>[p.ticker,p.quantity,p.cost,p.average,p.dividends,p.realized])];
   const sells=[['Data','Ticker','Classe','Venda bruta','Taxas','Custo atribuído','Resultado','Possível day trade'],...ledger.sales.map(x=>[x.date,x.ticker,x.kind,x.gross,x.fees,x.allocatedCost,x.gain,x.possibleDayTrade?'SIM':'NÃO'])];
   const income=[['Data','Ticker','Tipo informado','Valor'],...ledger.income.map(x=>[x.date,x.ticker,x.kind,x.amount])];
   const issues=[['Avisos e limitações'],...ledger.issues.map(x=>[x])];
   const file=createXlsx([{name:'Posições',rows},{name:'Vendas '+year,rows:sells},{name:'Proventos '+year,rows:income},{name:'Avisos',rows:issues}]);
   return reply(res,200,{filename:'metrics-relatorio-'+year+'.xlsx',base64:file.toString('base64'),warnings:ledger.issues});
  }
  if(req.method==='GET'&&url.pathname==='/api/risk')return reply(res,200,(await read()).profiles.map(analyzeFundRisk));
  if(req.method==='GET'&&url.pathname==='/api/ollama/models'){const c=new AbortController(),timer=setTimeout(()=>c.abort(),3500);try{const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:c.signal});if(!r.ok)throw Error();const d=await r.json();return reply(res,200,{available:true,models:(d.models||[]).map(x=>x.name)});}catch{return reply(res,200,{available:false,models:[]});}finally{clearTimeout(timer);}}
  if(req.method==='GET'&&url.pathname.startsWith('/api/documents/')){const db=await read();const doc=db.documents.find(d=>d.id===url.pathname.split('/').at(-1));return doc?reply(res,200,doc):reply(res,404,{error:'Documento não encontrado.'});}
  if(!['POST','DELETE','PUT'].includes(req.method))return reply(res,405,{error:'Método não permitido.'});
  if(req.headers['x-metrics-local']!=='1')return reply(res,403,{error:'Cabeçalho de acesso local obrigatório.'});
  if(req.method==='POST'&&url.pathname==='/api/transactions')return reply(res,201,{transaction:await addTransaction(await body(req))});
  if(req.method==='POST'&&url.pathname==='/api/transactions/import'){const p=await body(req);return reply(res,200,await addTransactionsBulk(p.transactions,p.name,p.keepDuplicates===true));}
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/transactions/')){await removeItem('transactions',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/watchlist')return reply(res,201,{item:await addWatch(await body(req))});
  if(req.method==='PUT'&&url.pathname.startsWith('/api/watchlist/'))return reply(res,200,{item:await editWatch(url.pathname.split('/').at(-1),await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/watchlist/')){await removeItem('watchlist',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/market/preview'){
   const p=await body(req,34*1024*1024),bytes=Buffer.from(String(p.data||''),'base64');
   const name=String(p.name||'');if(!/\.(zip|txt)$/i.test(name))throw Error('Envie COTAHIST em ZIP ou TXT.');
   const db=await read(),wanted=[...new Set(db.transactions.map(x=>x.ticker).concat(db.watchlist.map(x=>x.ticker)))];
   if(!wanted.length)throw Error('Cadastre ao menos um investimento ou ativo desejado antes de importar cotações.');
   const result=parseCotahist(bytes,{wanted});
   return reply(res,200,result);
  }
  if(req.method==='POST'&&url.pathname==='/api/market/import'){
   const p=await body(req),db=await read(),wanted=[...new Set(db.transactions.map(x=>x.ticker).concat(db.watchlist.map(x=>x.ticker)))];
   if(!wanted.length)throw Error('Cadastre ao menos um investimento ou ativo desejado antes de importar cotações.');
   const result=parseCotahist(Buffer.from(String(p.data||''),'base64'),{wanted});
   return reply(res,200,{...await saveMarketQuotes(result.quotes,{source:String(p.name||'Arquivo B3')}),warning:result.warning});
  }
  if(req.method==='POST'&&url.pathname==='/api/market/update'){
   const db=await read(),wanted=[...new Set([...db.transactions.map(t=>t.ticker),...db.watchlist.map(w=>w.ticker)])];
   const result=await fetchRecentB3Prices({wanted});
   return reply(res,200,{...await saveMarketQuotes(result.quotes,{source:result.downloadedFrom}),warning:result.warning,downloadedFrom:result.downloadedFrom});
  }
  if(req.method==='POST'&&url.pathname==='/api/quotes')return reply(res,200,{quote:await saveQuote(await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/quotes/')){await removeItem('quotes',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/profiles')return reply(res,200,{profile:await saveProfile(await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/profiles/')){await removeItem('profiles',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/events')return reply(res,201,{event:await addEvent(await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/events/')){await removeItem('events',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/simulate')return reply(res,200,simulatePhases(await body(req)));
  if(req.method==='POST'&&url.pathname==='/api/simulate/portfolio')return reply(res,200,simulatePortfolio(await body(req)));
  if(req.method==='POST'&&url.pathname==='/api/backup/encrypted')return reply(res,200,encryptBackup(await read(),(await body(req)).password));
  if(req.method==='POST'&&url.pathname==='/api/backup/restore-encrypted'){const p=await body(req,16*1024*1024);return reply(res,200,await restoreBackup(decryptBackup(p.backup,p.password)));}
  if(req.method==='POST'&&url.pathname==='/api/simulate/legacy')return reply(res,200,simulate(await body(req)));
  if(req.method==='POST'&&url.pathname==='/api/import/preview'){
   const p=await body(req),bytes=Buffer.from(String(p.data||''),'base64');if(bytes.length>5*1024*1024)throw new Error('Máximo de 5 MB.');
   const name=String(p.name||''),ext=path.extname(name).toLowerCase();let result;
   if(ext==='.xlsx')result=interpretTables(parseXLSX(bytes));
   else if(ext==='.csv'||ext==='.tsv')result=interpretTables([{sheet:'CSV',rows:parseCSV(bytes.toString('utf8'))}]);
   else if(ext==='.pdf'){const text=extractPDF(bytes);if(!text.trim())throw new Error('PDF sem texto pesquisável.');return reply(res,200,{kind:'document',title:name,text,preview:text.slice(0,1500),chars:text.length});}
   else if(ext==='.txt'){const text=bytes.toString('utf8');return reply(res,200,{kind:'document',title:name,text,preview:text.slice(0,1500),chars:text.length});}
   else throw new Error('Aceitos: XLSX, CSV, TSV, PDF ou TXT.');
   return reply(res,200,{kind:'transactions',...result});
  }
  if(req.method==='POST'&&url.pathname==='/api/documents')return reply(res,201,{document:await addDocument(await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/documents/')){await removeItem('documents',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/imports/rollback'){const p=await body(req);return reply(res,200,await rollbackImport(p.id));}
  if(req.method==='POST'&&url.pathname==='/api/restore')return reply(res,200,await restoreBackup(await body(req)));
  if(req.method==='POST'&&url.pathname==='/api/chat'){
   const params=await body(req);const db=await read();const answer=await askAI(params,db);
   const hist=(params.messages||[]).filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string');await saveMessages([...hist,{role:'assistant',content:answer}]);return reply(res,200,{answer});
  }
  if(req.method==='POST'&&url.pathname==='/api/chat/clear'){await clearMessages();return reply(res,200,{ok:true});}
  return reply(res,404,{error:'API não encontrada.'});
 }catch(e){return bad(res,e);}}
 if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'Método não permitido.'});
 const route=url.pathname==='/'?'/index.html':url.pathname;if(route.includes('..')||route.includes('\\')||route.includes('\0'))return reply(res,404,{error:'Arquivo não encontrado.'});const abs=path.resolve(WWW,'.'+route);if(!abs.startsWith(WWW+path.sep))return reply(res,404,{error:'Arquivo não encontrado.'});
 try{const stat=await fs.stat(abs);if(!stat.isFile())throw Error();const b=await fs.readFile(abs);res.writeHead(200,{'Content-Type':TYPES[path.extname(abs)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});if(req.method==='HEAD')res.end();else res.end(b);}catch{return reply(res,404,{error:'Arquivo não encontrado.'});}
}
await init();http.createServer((req,res)=>{handler(req,res).catch(e=>{if(!res.headersSent)bad(res,e);})}).listen(PORT,HOST,()=>{console.log(`Metrics Investimentos 0.4.0 | dados: ${location()} | criptografia: ${isEncrypted()?'ativada':'não ativada'}`);console.log(`METRICS_LAUNCH_URL=${ORIGIN}/?access=${ACCESS_TOKEN}`);});

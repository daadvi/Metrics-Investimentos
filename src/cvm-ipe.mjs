/** CVM IPE: index of filings only. NEVER infer declared dividend amounts from an index row. */
import {createHash} from 'node:crypto';
import {parseCSV} from './importers.mjs';
import {extractCvmCsvFiles,decodeCvmText,validCnpj} from './cvm-fii.mjs';
import {validDate,tickerOf} from './domain.mjs';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
const find=(head,...aliases)=>head.findIndex(k=>aliases.includes(normalize(k)));
const parseDate=x=>{const s=String(x||'').trim();let m=s.match(/^(\d{2})[./-](\d{2})[./-](\d{4})/);const v=m?`${m[3]}-${m[2]}-${m[1]}`:s.slice(0,10);return validDate(v)?v:null;};
const clean=s=>String(s??'').trim().slice(0,500);
function officialUrl(x){const s=String(x||'').trim();if(!s)return null;try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&(/(^|\.)cvm\.gov\.br$/i.test(u.hostname))?u.toString().slice(0,1500):null;}catch{return null;}}
export function parseIpeIndex(bytes,{tickerMap={},cnpjs=[],maxRows=85000,includeAll=false}={}){
 const map={};for(const [c,t] of Object.entries(tickerMap||{})){const d=String(c).replace(/\D/g,'');if(!validCnpj(d))throw Error('Vínculo CVM IPE: CNPJ inválido.');map[d]=tickerOf(t);}
 const selected=new Set([...Object.keys(map),...cnpjs.map(x=>String(x).replace(/\D/g,''))]);
 for(const c of selected)if(!validCnpj(c))throw Error('Filtro por CNPJ inválido.');
 if(!selected.size)throw Error('Informe ao menos um CNPJ para limitar a importação ao investidor.');
 const files=extractCvmCsvFiles(Buffer.from(bytes)),out=new Map();let scanned=0,filesRead=0;
 for(const file of files){const rows=parseCSV(decodeCvmText(file.data));if(rows.length<2)continue;
  const header=rows[0],c=find(header,'cnpjcompanhia','cnpjcia','cnpj','cnpjfundo','cnpjclasse'),d=find(header,'dataentrega','dtentrega','datarecebimento','datapublicacao','datahoraentrega'),title=find(header,'assunto','denominacao','titulo','descricao','nome'),cat=find(header,'categoria','categoriadocumento','tipo','tipodocumento','tipodoc'),doc=find(header,'protocoloentrega','id','iddocumento','numero','numprotocolo'),ver=find(header,'versao','versaoentrega'),link=find(header,'linkdownload','link','url','urlarquivo','linkdocumento');
  if(c<0||d<0||cat<0)continue;filesRead++;
  for(const row of rows.slice(1)){
   if(++scanned>maxRows)throw Error('IPE muito grande: reduza o arquivo ou selecione outro ano.');
   const cnpj=String(row[c]||'').replace(/\D/g,'');if(!selected.has(cnpj))continue;
   const deliveryDate=parseDate(row[d]);if(!deliveryDate)continue;
   const category=clean(row[cat]);const assunto=clean(title>=0?row[title]:'');
   if(!includeAll&&!/avis|fato|comunicad|dividend|provent|juros|assemble|calend|bonific|desdobr/i.test([category,assunto].join(' ')))continue;
   const protocol=clean(doc>=0?row[doc]:'');const documentId=protocol||createHash('sha256').update([cnpj,deliveryDate,category,assunto].join('|')).digest('hex').slice(0,24);
   const version=clean(ver>=0?row[ver]:'');const record={cnpj,ticker:map[cnpj]||null,deliveryDate,category,title:assunto||category,documentId,version,sourceFile:file.name,sourceUrl:officialUrl(link>=0?row[link]:''),status:'INDICE_SEM_CONTEUDO',canConfirmDividend:false};
   const key=[cnpj,documentId,version,deliveryDate].join('|');out.set(key,record);
  }
 }
 if(!filesRead)throw Error('CSV/ZIP IPE não reconhecido. Esperados cabeçalhos CNPJ, categoria e data de entrega.');
 return {entries:[...out.values()].sort((a,b)=>b.deliveryDate.localeCompare(a.deliveryDate)),filesRead,scanned,warning:'O IPE informa existência/categoria/data de documentos. Não revela automaticamente valor por ação, data-com nem data de pagamento. Abra o comunicado e confira.'};
}
export async function downloadIpeIndex(year,{fetchImpl=fetch,timeout=20000}={}){
 const y=Number(year);if(!Number.isInteger(y)||y<2003||y>new Date().getUTCFullYear())throw Error('Ano IPE fora do intervalo disponível.');
 const url=`https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_${y}.zip`;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{const r=await fetchImpl(url,{headers:{Accept:'application/zip'},signal:ctrl.signal,redirect:'error'});
  if(!r.ok)throw Error(`CVM IPE HTTP ${r.status}`);
  const chunks=[];let n=0;for await(const chunk of r.body){n+=chunk.length;if(n>15*1024*1024)throw Error('Arquivo IPE acima de 15MB.');chunks.push(chunk);}
  return {bytes:Buffer.concat(chunks),url,fetchedAt:new Date().toISOString()};
 }finally{clearTimeout(timer);}
}
export function ipeSummary(db,{ticker}={}){const rows=db.ipeIndex||[];return {total:rows.length,entries:rows.filter(x=>!ticker||x.ticker===ticker).slice(0,500),warning:'Metadados de documentos, não comunicação de dividendo confirmada.'};}

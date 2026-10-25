/** CVM Informe Mensal FII. Official open-data ZIP/CSV with manual CNPJ -> ticker binding.
 * Fields not present in the data file are NEVER extrapolated.
 * User-supplied files are declared CVM-origin, not cryptographically authenticated.
 */
import zlib from 'node:zlib';
import {parseCSV} from './importers.mjs';
import {tickerOf,validDate} from './domain.mjs';
const BASE='https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/';
export function validCnpj(v){const digits=String(v??'').replace(/\D/g,'');if(digits.length!==14||/^(\d)\1{13}$/.test(digits))return false;const check=(base,weights)=>{const sum=[...base].reduce((acc,d,i)=>acc+Number(d)*weights[i],0),r=sum%11;return r<2?0:11-r;};const a=check(digits.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]);const b=check(digits.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2]);return a===Number(digits[12])&&b===Number(digits[13]);}

const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const key=(headers,aliases)=>headers.findIndex(h=>aliases.includes(norm(h)));
const val=(row,idx)=>idx<0?null:String(row[idx]??'').trim();
const number=s=>{if(s===null||s==='')return null;let v=String(s).replace(/\s/g,'');if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');const n=Number(v);return Number.isFinite(n)&&n>=0&&n<1e16?n:null;};
const day=s=>{const t=String(s||'').slice(0,10);const m=t.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:t;};
const keys={cnpj:['cnpjfundo','cnpjfundoclasse','cnpj','cnpjclasse'],date:['datareferencia','dtcomptc','dtcompetencia','datacompetencia','dataref','dtref'],reportedAt:['dataentrega','dtentrega','datarecebimento','dataenvio'],equity:['patrimonioliquido','patrimonioliquidofundo','patrimonioliquidocotas','plfundo','vlpatrimliquido'],nav:['valorpatrimonialcotas','valorpatrimonialcota','valorpatrimonialporcota','vlpatrimonialcota'],investors:['numerocotistas','quantidadecotistas','qtdcotistas','numcotistas'],monthlyDy:['percentualdividendyieldmes','dividendyieldmes'],totalShares:['quantidadecotasemitidas','totalcotasemitidas','quantidadecotas','qtdcotasemitidas'],name:['nomefundo','denominacaosocial','denominacaofundo','nomefundoclasse'],version:['versao','versaoarquivo','versaoentrega']};
export function extractCvmCsvFiles(buffer){if(buffer.length>15*1024*1024)throw Error('Arquivo CVM grande demais (limite 15 MB).');if(buffer.subarray(0,2).toString()!=='PK')return [{name:'dados.csv',data:buffer}];
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}if(end<0)throw Error('ZIP incompleto.');const count=buffer.readUInt16LE(end+10),offset=buffer.readUInt32LE(end+16);if(count>40||count<1)throw Error('ZIP CVM possui quantidade inválida de arquivos.');let at=offset,total=0;const output=[];
 for(let i=0;i<count;i++){if(at+46>buffer.length||buffer.readUInt32LE(at)!==0x02014b50)throw Error('Diretório ZIP corrompido.');const method=buffer.readUInt16LE(at+10),compressed=buffer.readUInt32LE(at+20),size=buffer.readUInt32LE(at+24),n=buffer.readUInt16LE(at+28),e=buffer.readUInt16LE(at+30),c=buffer.readUInt16LE(at+32),local=buffer.readUInt32LE(at+42),name=buffer.subarray(at+46,at+46+n).toString('utf8');at+=46+n+e+c;
  if(name.split('/').some(segment=>segment==='..'||segment==='.')||name.includes('\\')||name.startsWith('/')||! /^(?:[^/\\]+\/)?[^/\\]+\.csv$/i.test(name))continue;
  if(!size||size>30*1024*1024||(total+=size)>65*1024*1024)throw Error('ZIP possui CSV descompactado grande demais.');if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)throw Error('ZIP com entrada corrompida.');const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);if(start+compressed>buffer.length)throw Error('ZIP truncado.');const packed=buffer.subarray(start,start+compressed),data=method===0?packed:method===8?zlib.inflateRawSync(packed,{maxOutputLength:30*1024*1024}):null;if(!data||data.length!==size)throw Error('Compressão ZIP não suportada.');output.push({name,data});
 }
 if(!output.length)throw Error('ZIP sem CSV CVM reconhecido.');return output;
}
export function decodeCvmText(bytes){let t=bytes.toString('utf8');if(t.includes('\ufffd')&&bytes.length<30*1024*1024)t=bytes.toString('latin1');return t;}
/** tickerMap MUST be a manual CNPJ mapping; CVM records do not guarantee exchange tickers. */
export function parseCvmMonthly(bytes,{tickerMap={},maxRows=100000}={}){
 const mapping={};for(const [cnpj,ticker] of Object.entries(tickerMap)){const digits=String(cnpj).replace(/\D/g,'');if(!validCnpj(digits))throw Error('CNPJ do vínculo inválido (incluindo dígitos verificadores).');mapping[digits]=tickerOf(ticker);}
 if(!Object.keys(mapping).length)throw Error('Informe ao menos um vínculo CNPJ → ticker. A CVM não fornece ticker universal no informe mensal.');
 const buffer=Buffer.from(bytes);const matched=new Map();let scanned=0,recognizedFiles=0;
 for(const file of extractCvmCsvFiles(buffer)){
  const rows=parseCSV(decodeCvmText(file.data));if(!rows.length)continue;
  const headers=rows[0],indexes=Object.fromEntries(Object.entries(keys).map(([k,aliases])=>[k,key(headers,aliases)]));
  if(indexes.cnpj<0||indexes.date<0)continue;recognizedFiles++;
  for(const r of rows.slice(1)){if(++scanned>maxRows)throw Error('Muitas linhas no CSV da CVM.');const cnpj=String(val(r,indexes.cnpj)||'').replace(/\D/g,'');const ticker=mapping[cnpj];if(!ticker)continue;const date=day(val(r,indexes.date));if(!validDate(date))continue;
   const read=k=>number(val(r,indexes[k]));const reportedAt=day(val(r,indexes.reportedAt)),publicationDate=validDate(reportedAt)?reportedAt:null;const entry={ticker,cnpj,referenceDate:date,publicationDate,sourceFile:file.name,name:val(r,indexes.name)||null,version:val(r,indexes.version)||null,indicators:{equity:read('equity'),navPerShare:read('nav'),investors:read('investors'),monthlyDividendYieldPercent:read('monthlyDy'),totalShares:read('totalShares')},source:'CVM dados abertos - informe mensal estruturado',sourceUrl:'https://dados.cvm.gov.br/dataset/fii-doc-inf_mensal',authenticity:'ARQUIVO_NAO_AUTENTICADO'};
   const k=ticker+'|'+date,old=matched.get(k);if(!old||(publicationDate||'')>(old.publicationDate||'')||((publicationDate||'')===(old.publicationDate||'')&&Number(entry.version||0)>=Number(old.version||0)))matched.set(k,entry);
  }
 }
 if(!recognizedFiles)throw Error('Não encontramos CSV com colunas CNPJ e data-base. Confira se é o Informe Mensal Estruturado.');
 const entries=[...matched.values()].sort((a,b)=>a.ticker.localeCompare(b.ticker)||a.referenceDate.localeCompare(b.referenceDate));return {entries,scanned,recognizedFiles,warning:'CNPJ vinculado pelo usuário. CSV com origem declarada, sem autenticação criptográfica; os indicadores sem coluna correspondente permanecem nulos. Divulgação mensal não é cotação ao vivo.'};
}
export async function downloadCvmMonthly(year,{fetchImpl=fetch}={}){
 const y=Number(year),current=new Date().getUTCFullYear();if(!Number.isInteger(y)||y<2021||y>current)throw Error('Ano CVM não permitido.');const url=`${BASE}inf_mensal_fii_${y}.zip`,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const res=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'application/zip'}});if(!res.ok)throw Error('CVM retornou HTTP '+res.status);const parts=[];let size=0;for await(const chunk of res.body){size+=chunk.length;if(size>15*1024*1024)throw Error('Download CVM excedeu 15 MB.');parts.push(chunk);}return {bytes:Buffer.concat(parts),url,downloadedAt:new Date().toISOString()};}finally{clearTimeout(timer);}
}
export function cvmPreview(db){const entries=db.cvmReports||[];const latest=new Map();for(const e of entries){const p=latest.get(e.ticker);if(!p||e.referenceDate>p.referenceDate||(e.referenceDate===p.referenceDate&&(e.publicationDate||'')>(p.publicationDate||'')))latest.set(e.ticker,e);}return {latest:[...latest.values()].sort((a,b)=>a.ticker.localeCompare(b.ticker)),observations:entries.length,source:'CVM dados abertos, importado pelo investidor',warning:'Fundamentos mensais não substituem o relatório gerencial nem são cotações ao vivo.'};}

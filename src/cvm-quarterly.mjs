/** Structured quarterly CVM FII import, conservative field extraction.
 * No attempt to infer buildings, vacant units, or financial ratios from arbitrary CSV columns.
 */
import {parseCSV} from './importers.mjs';
import {validDate,tickerOf} from './domain.mjs';
import {validCnpj,extractCvmCsvFiles,decodeCvmText} from './cvm-fii.mjs';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const locate=(row,names)=>row.findIndex(x=>names.includes(normalize(x)));
const DATES=['datareferencia','dtcomptc','dtcompetencia','datacompetencia','dtref','dataref'];
const CNPJS=['cnpjfundo','cnpjfundoclasse','cnpjclasse','cnpj'];
const METRICS={
 totalProperties:['quantidadeimoveis','numerodeimoveis','qtdimoveis','numimoveis'],
 occupancyPercent:['taxaocupacao','percentualocupacao','ocupacaofisica'],
 vacancyPercent:['taxavacancia','percentualvacancia','vacanciafisica'],
 grossRevenue:['receitabruta','receitabrutalocacao'],
 netIncome:['resultadoliquido','resultadomes','lucroliquido'],
 debt:['endividamentototal','dividatotal','passivototal'],
 areaSqm:['areabrutalocavel','abl','arealocavel']
};
function numeric(v){if(v===undefined||v===null||String(v).trim()==='')return null;const t=String(v).trim();const normalized=t.includes(',')?t.replace(/\./g,'').replace(',','.'):t;const n=Number(normalized);return Number.isFinite(n)&&n>=0&&n<=1e16?n:null;}
function asDate(x){const s=String(x||'').slice(0,10);const a=s.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);return a?`${a[3]}-${a[2]}-${a[1]}`:s;}
export function parseCvmQuarterly(bytes,{tickerMap={},maxRows=150000}={}){
 const mapping={};for(const [k,v] of Object.entries(tickerMap)){const c=String(k).replace(/\D/g,'');if(!validCnpj(c))throw Error('CNPJ de vínculo inválido.');mapping[c]=tickerOf(v);}
 if(!Object.keys(mapping).length)throw Error('Vincule CNPJ e ticker manualmente.');
 const result=new Map(),unmapped=[],files=extractCvmCsvFiles(Buffer.from(bytes));let scanned=0,filesRead=0;
 for(const file of files){const rows=parseCSV(decodeCvmText(file.data));if(rows.length<2)continue;const head=rows[0],ci=locate(head,CNPJS),di=locate(head,DATES);if(ci<0||di<0)continue;filesRead++;
  const indices=Object.fromEntries(Object.entries(METRICS).map(([k,aliases])=>[k,locate(head,aliases)]));
  for(const row of rows.slice(1)){
   if(++scanned>maxRows)throw Error('Arquivo CVM possui linhas demais para esta importação.');
   const c=String(row[ci]||'').replace(/\D/g,''),ticker=mapping[c];if(!ticker)continue;
   const date=asDate(row[di]);if(!validDate(date))continue;
   const metrics=Object.fromEntries(Object.entries(indices).map(([k,i])=>[k,i<0?null:numeric(row[i])]));
   if(metrics.occupancyPercent!==null&&metrics.occupancyPercent>100)metrics.occupancyPercent=null;
   if(metrics.vacancyPercent!==null&&metrics.vacancyPercent>100)metrics.vacancyPercent=null;
   if(Object.values(metrics).every(x=>x===null)){unmapped.push(file.name);continue;}
   const id=`${ticker}|${date}|${file.name}`,entry={ticker,cnpj:c,referenceDate:date,sourceFile:file.name,source:'CVM dados abertos - informe trimestral estruturado',sourceUrl:'https://dados.cvm.gov.br/dataset/fii-doc-inf_trimestral',authenticity:'ARQUIVO_NAO_AUTENTICADO',indicators:metrics};
   result.set(id,entry);
  }
 }
 if(!filesRead)throw Error('Informe trimestral não reconhecido: falta CNPJ e data-base no CSV.');
 return {entries:[...result.values()].sort((a,b)=>a.referenceDate.localeCompare(b.referenceDate)),scanned,filesRead,unmappedFiles:[...new Set(unmapped)].slice(0,25),warning:'Dados trimestrais dependem das colunas exatas do arquivo CVM. Sem coluna correspondente, nenhum valor é inventado. Não substituir relatório gerencial por campo presumido.'};
}
export async function downloadCvmQuarterly(year,{fetchImpl=fetch}={}){
 const y=Number(year);if(!Number.isInteger(y)||y<2016||y>new Date().getUTCFullYear())throw Error('Ano trimestral inválido.');
 const url=`https://dados.cvm.gov.br/dados/FII/DOC/INF_TRIMESTRAL/DADOS/inf_trimestral_fii_${y}.zip`;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const res=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'application/zip'}});if(!res.ok)throw Error('CVM retornou HTTP '+res.status);const chunks=[];let size=0;for await(const part of res.body){size+=part.length;if(size>15*1024*1024)throw Error('Arquivo supera 15 MB.');chunks.push(part);}return {bytes:Buffer.concat(chunks),url,downloadedAt:new Date().toISOString()};}finally{clearTimeout(timer);}
}
export function quarterlyOverview(db){const data=db.cvmQuarterly||[],latest=new Map();for(const row of data){const key=row.ticker+'|'+row.sourceFile,old=latest.get(key);if(!old||old.referenceDate<=row.referenceDate)latest.set(key,row);}return {entries:data.length,latest:[...latest.values()].sort((a,b)=>a.ticker.localeCompare(b.ticker)||b.referenceDate.localeCompare(a.referenceDate)),warning:'Dados trimestrais, preenchidos somente de colunas reconhecidas. Não são cotação nem anúncio de proventos.'};}

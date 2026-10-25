/** DFP CVM structured accounting rows, preserving raw periods and units.
 * Import is data provenance, not audited valuation or automatically derived ratios.
 */
import {parseCSV} from './importers.mjs';
import {extractCvmCsvFiles,decodeCvmText,validCnpj} from './cvm-fii.mjs';
import {tickerOf,validDate} from './domain.mjs';
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const idx=(headers,names)=>headers.findIndex(x=>names.includes(slug(x)));
const v=(row,i)=>i<0?'':String(row[i]??'').trim();
const parseDate=s=>{const t=String(s||'').slice(0,10);const m=t.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);const date=m?`${m[3]}-${m[2]}-${m[1]}`:t;return validDate(date)?date:null;};
const parseNumber=s=>{const text=String(s??'').trim().replace(/\s/g,'');if(!text)return null;const n=Number(text.includes(',')?text.replace(/\./g,'').replace(',','.'):text);return Number.isFinite(n)&&Math.abs(n)<1e17?n:null;};
export function parseCvmDfp(bytes,{tickerMap={},maxRows=90000,maxEntries=8000}={}){
 const mapping={};for(const [cnpj,ticker] of Object.entries(tickerMap)){const d=String(cnpj).replace(/\D/g,'');if(!validCnpj(d))throw Error('CNPJ para DFP inválido.');mapping[d]=tickerOf(ticker);}
 if(!Object.keys(mapping).length)throw Error('Informe o vínculo CNPJ→ticker para DFP.');
 const entries=[],keys=new Set();let scanned=0,recognizedFiles=0;
 for(const file of extractCvmCsvFiles(Buffer.from(bytes))){
  if(file.name!=='dados.csv'&&!/(?:^|[_/])(DRE|BPA|BPP|DFC|DVA|DMPL|DRA)(?:_|\.|$)/i.test(file.name))continue;
  const rows=parseCSV(decodeCvmText(file.data));if(rows.length<2)continue;
  const h=rows[0],cnpj=idx(h,['cnpjcia','cnpjcompanhia']),date=idx(h,['dtrefer','datareferencia']),code=idx(h,['cdconta']),label=idx(h,['dsconta']),value=idx(h,['vlconta']),order=idx(h,['ordemexerc']),unit=idx(h,['escalamoeda']),scope=idx(h,['grupodfp']),version=idx(h,['versao']),start=idx(h,['dtiniexerc']),end=idx(h,['dtfimexerc']);
  if(cnpj<0||date<0||code<0||value<0)continue;recognizedFiles++;
  for(const row of rows.slice(1)){
   if(++scanned>maxRows)throw Error('DFP grande: importe um CSV de demonstração específico em vez do ZIP anual completo.');
   const c=String(v(row,cnpj)).replace(/\D/g,''),ticker=mapping[c];if(!ticker)continue;
   const ref=parseDate(v(row,date)),amount=parseNumber(v(row,value)),account=v(row,code),period=v(row,order);
   if(!ref||amount===null||!account||period&&!/ultimo|último|current|atual/i.test(period))continue;
   const statement=(file.name.match(/(?:^|[_/])(DRE|BPA|BPP|DFC|DVA|DMPL|DRA)(?:_|\.|$)/i)||[])[1]?.toUpperCase() || (/resultado/i.test(v(row,scope))?'DRE':/patrimonial/i.test(v(row,scope))?'BALANCO':'NAO_IDENTIFICADO');
   const consolidated=/_con(?:_|\.)/i.test(file.name)?true:/_ind(?:_|\.)/i.test(file.name)?false:/consolidado/i.test(v(row,scope))?true:/individual/i.test(v(row,scope))?false:null;
   const entry={ticker,cnpj,referenceDate:ref,statement,consolidated,accountCode:account.slice(0,30),accountName:v(row,label).slice(0,240)||null,rawValue:amount,scale:v(row,unit).slice(0,30)||'NÃO INFORMADA',periodStart:parseDate(v(row,start)),periodEnd:parseDate(v(row,end)),version:v(row,version).slice(0,20),sourceFile:file.name,source:'CVM DFP (arquivo enviado, origem não autenticada)',sourceUrl:'https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp',publicationVerified:false};
   const fingerprint=[ticker,ref,statement,consolidated,account,entry.periodStart,entry.periodEnd,entry.version].join('|');if(keys.has(fingerprint))continue;
   keys.add(fingerprint);entries.push({...entry,fingerprint});if(entries.length>maxEntries)throw Error('Muitos dados DFP. Selecione um CSV menor ou reduza o período.');
  }
 }
 if(!recognizedFiles)throw Error('DFP não reconhecido. Use o CSV oficial DRE/BPA/BPP/DFC, com colunas CNPJ_CIA, DT_REFER, CD_CONTA e VL_CONTA.');
 return {entries,scanned,recognizedFiles,warning:'Dados DFP históricos com escala e período originais. Não são valores de mercado, múltiplos calculados ou demonstrações auditadas pelo Metrics.'};
}
export function dfpOverview(db,{ticker}={}){const entries=(db.cvmStatements||[]).filter(x=>!ticker||x.ticker===ticker);return {observations:entries.length,entries:entries.slice(-150),warning:'Use data-base, período, moeda/escala e consolidado versus individual antes de comparar.'};}

/** Metrics 2.6 analytical workbench. Ledger is source of truth, not marketing copy.
 * No market data generated here and no investment advice or fiscal certification.
 */
import {consolidatedWealth,auditQuality25} from './metrics-v24.mjs';
const cash=n=>Math.round((n+Number.EPSILON)*100)/100;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const validYear=y=>Number.isInteger(Number(y))&&Number(y)>=2000&&Number(y)<=2200;
const CLASS={BOLSA_BR:'Bolsa brasileira',ACAO:'Ações',FII:'Fundos imobiliários',FIAGRO:'Fiagro',ETF:'ETFs',BDR:'BDRs',FUND:'Fundos',FIXED_INCOME:'Renda fixa',FIXED_INCOME_BR:'Renda fixa',BOLSA_EXTERIOR:'Exterior',STOCK_FOREIGN:'Exterior',ETF_FOREIGN:'Exterior',BOND_FOREIGN:'Exterior',CASH:'Caixa',OTHER:'Outros'};
function label(p){return CLASS[p.assetClass]||p.assetClass||'Não classificado';}
/** Classification is based on documented instrument registry, not ticker suffix heuristics. */
export function buildAllocation26(evaluation){
 const buckets=new Map();
 for(const p of evaluation.positions||[]){
  const key=label(p),item=buckets.get(key)||{name:key,knownBRL:0,missing:0,assets:0,tickers:[]};
  item.assets++;
  if(!Number.isFinite(p.valueBRL))item.missing++;
  else item.knownBRL=cash(item.knownBRL+p.valueBRL);
  if(item.tickers.length<60)item.tickers.push({ticker:p.assetKey,valueBRL:p.valueBRL??null,currency:p.currency,asOf:p.valuationDate??null,source:p.source??null});
  buckets.set(key,item);
 }
 const complete=!!evaluation.complete;
 const rows=[...buckets.values()].sort((a,b)=>b.knownBRL-a.knownBRL||a.name.localeCompare(b.name,'pt-BR'));
 const denominator=complete?evaluation.totalBRL:null;
 for(const x of rows)x.weightPercent=denominator!==null&&denominator>0?Number((100*x.knownBRL/denominator).toFixed(3)):null;
 return {complete,totalBRL:complete?evaluation.totalBRL:null,partialKnownBRL:evaluation.partialKnownBRL,assetCount:(evaluation.positions||[]).length,pricedCount:(evaluation.positions||[]).filter(x=>Number.isFinite(x.valueBRL)).length,unknownCount:(evaluation.positions||[]).filter(x=>!Number.isFinite(x.valueBRL)).length,rows,note:complete?'Percentuais calculados sobre o total documentado, sem custos e passivos externos.':'Sem percentual de alocação: a carteira possui lacunas. Valores conhecidos não equivalem ao patrimônio total.'};
}
/** Sector coverage uses user-provided sector names; missing classifications stay visible. */
export function buildSectorExposure26(evaluation,profiles=[]){
 const lookup=new Map((profiles||[]).filter(p=>p.ticker).map(p=>[p.ticker,p]));
 const sectors=new Map();let unidentified=0;
 for(const p of evaluation.positions||[]){
  if(['CASH','FIXED_INCOME','FIXED_INCOME_BR'].includes(p.assetClass))continue;
  const declared=lookup.get(p.assetKey),name=String(declared?.sector||'').trim()||'Setor não informado';
  const row=sectors.get(name)||{sector:name,knownBRL:0,missingValue:0,assets:0};row.assets++;
  if(name==='Setor não informado')unidentified++;
  if(!Number.isFinite(p.valueBRL))row.missingValue++;
  else row.knownBRL=cash(row.knownBRL+p.valueBRL);
  sectors.set(name,row);
 }
 const rows=[...sectors.values()].sort((a,b)=>b.knownBRL-a.knownBRL||a.sector.localeCompare(b.sector,'pt-BR'));
 return {complete:evaluation.complete&&unidentified===0,rows,unclassifiedAssets:unidentified,note:'Setor declarado nas fichas de ativos. O agrupamento não representa classificação oficial nem uma avaliação de risco; renda fixa e caixa estão fora deste quadro.'};
}

/** Historical frequencies only, never a prediction of future payouts. */
export function historicIncomePattern26(db,{untilYear=2026,lookbackYears=4,asOf=new Date().toISOString().slice(0,10)}={}){
 if(!validYear(untilYear)||!Number.isInteger(lookbackYears)||lookbackYears<2||lookbackYears>10)throw Error('Intervalo histórico inválido.');
 const from=Number(untilYear)-lookbackYears+1;const byMonth=Array.from({length:12},(_,i)=>({month:i+1,recordedYears:[],historicalBRL:0,observations:0}));
 for(const t of db.transactions||[]){
  const y=Number(String(t.date||'').slice(0,4)),m=Number(String(t.date||'').slice(5,7)),a=Number(t.amount);
  if(y<from||y>untilYear||!validDate(t.date)||t.date>asOf||!['DIVIDEND','JCP'].includes(t.type)||!Number.isFinite(a)||a<0)continue;
  const r=byMonth[m-1];if(!r.recordedYears.includes(y))r.recordedYears.push(y);r.historicalBRL=cash(r.historicalBRL+a);r.observations++;
 }
 for(const r of byMonth)r.recordedYears.sort();
 return {from,untilYear:Number(untilYear),lookbackYears,rows:byMonth,warning:'Frequência observada nos lançamentos existentes; anos sem registro podem representar falta de histórico. Não é previsão de valor nem de data futura.'};
}

/** Descriptive distributions, keeping recorded payments separate from announced events. */
export function buildDividendPanel26(db,{year=2026,asOf=new Date().toISOString().slice(0,10)}={}){
 if(!validYear(year))throw Error('Ano de proventos inválido.');
 const selected=String(year),monthly=Array.from({length:12},(_,i)=>({month:`${year}-${String(i+1).padStart(2,'0')}`,receivedBRL:0,transactionCount:0,announcements:0,declaredWithPaymentDate:0,estimated:0}));
 const byMonth=new Map(monthly.map(x=>[x.month,x]));
 const receipts=(db.transactions||[]).filter(t=>t.date?.startsWith(selected)&&t.date<=asOf&&['DIVIDEND','JCP'].includes(t.type)).map(t=>({date:t.date,ticker:t.ticker,type:t.type,amountBRL:Number(t.amount),source:t.source||'Registro local',recorded:true}));
 for(const r of receipts){if(!validDate(r.date)||!Number.isFinite(r.amountBRL)||r.amountBRL<0)continue;const m=byMonth.get(r.date.slice(0,7));if(!m)continue;m.receivedBRL=cash(m.receivedBRL+r.amountBRL);m.transactionCount++;}
 const events=(db.events||[]).filter(e=>e.date?.startsWith(selected)&&validDate(e.date)).map(e=>({ticker:e.ticker,paymentDate:e.date,recordDate:e.recordDate||null,perShare:e.perShare??null,kind:e.kind||'ESTIMADO',verification:e.verification||'NAO_VERIFICADO',source:e.source||'Registro local',sourceUrl:e.sourceUrl||null,recordedCredit:false}));
 for(const e of events){const m=byMonth.get(e.paymentDate.slice(0,7));m.announcements++;if(e.kind==='ESTIMADO')m.estimated++;else m.declaredWithPaymentDate++;}
 const tickers=[...new Set([...receipts.map(x=>x.ticker),...events.map(x=>x.ticker)])].sort();
 return {year:Number(year),monthly,totalRecordedBRL:cash(monthly.reduce((s,m)=>s+m.receivedBRL,0)),receivedCount:receipts.length,eventsCount:events.length,estimatedCount:events.filter(x=>x.kind==='ESTIMADO').length,tickers,events:events.slice(0,400).sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)),note:'Somente proventos brasileiros em BRL cadastrados até a data-base entram em recebidos. Operações internacionais são controladas à parte. Eventos previstos e anúncios nunca viram caixa automaticamente. Informes, IRRF e extratos exigem conferência.'};
}
/** Compare documented profile fields only; no fictitious fundamentals. */
export function compareProfiles26(db,{tickers=[]}={}){
 if(!Array.isArray(tickers)||tickers.length>8)throw Error('Máximo de 8 ativos por comparação.');
 const permitted=[...new Set(tickers.map(t=>String(t||'').toUpperCase().trim()))].filter(Boolean);
 if(permitted.some(t=>!/^[A-Z0-9._:-]{1,24}$/.test(t)))throw Error('Identificador de ativo inválido.');
 const profiles=(db.profiles||[]).filter(p=>permitted.includes(p.ticker));
 const fields=['dy12','equity','debt','vacancy','assets','occupied','dividend'];
 return {requested:permitted,found:profiles.map(p=>({ticker:p.ticker,type:p.type||null,sector:p.sector||null,asOf:p.date||null,source:p.source||null,metrics:Object.fromEntries(fields.map(k=>[k,Number.isFinite(Number(p[k]))&&p[k]!==null&&p[k]!==''?Number(p[k]):null]))})),missing:permitted.filter(t=>!profiles.some(p=>p.ticker===t)),note:'Comparação descritiva de dados cadastrados. Períodos, escalas e definições podem diferir. Sem recomendações, preços-alvo ou ranking automático.'};
}
/** Diagnose *coverage*, never invent a single score for portfolio quality. */
export function analyzePortfolio26(db,{asOf,year=Number(asOf?.slice(0,4)),calculatePositions,foreignPositions,fixedIncomePosition}={}){
 if(!validDate(asOf)||!validYear(year))throw Error('Período de análise inválido.');
 const wealth=consolidatedWealth(db,{asOf,calculatePositions,foreignPositions,fixedIncomePosition});
 const audit=auditQuality25(db,{asOf,calculatePositions,foreignPositions,fixedIncomePosition,valuationOverride:wealth});
 const allocation=buildAllocation26(wealth),sectors=buildSectorExposure26(wealth,db.profiles||[]),dividends=buildDividendPanel26(db,{year,asOf}),historicalIncome=historicIncomePattern26(db,{untilYear:Number(year),lookbackYears:4,asOf});
 const availableTickers=[...new Set((db.profiles||[]).map(p=>p.ticker).filter(Boolean))].sort();
 const pendingOfficial=(db.officialChecks||[]).filter(c=>c.reviewStatus==='PENDING').length;
 const sources=(db.profiles||[]).filter(p=>p.source&&p.date).length;
 const priorities=[...audit.priorities];
 if(pendingOfficial)priorities.push({severity:'MEDIUM',title:'Revisões de comunicados',description:`${pendingOfficial} documento(s) pendente(s).`,action:'Abrir Proventos CVM e conferir os documentos originais.'});
 if(availableTickers.length>0&&sources<availableTickers.length)priorities.push({severity:'MEDIUM',title:'Fundamentos sem fonte/data',description:'Alguns ativos não possuem ficha com origem e data-base.',action:'Abrir Analisar e registrar valores com data e fonte.'});
 return {asOf,year,allocation,sectors,dividends,historicalIncome,comparableTickers:availableTickers,audit:{complete:audit.complete,coverage:audit.coverage,priorities:priorities.sort((a,b)=>({HIGH:0,MEDIUM:1,LOW:2}[a.severity]??3)-({HIGH:0,MEDIUM:1,LOW:2}[b.severity]??3)),alternatives:audit.alternatives},productGaps:[
  {title:'B3 automática',status:'NOT_IMPLEMENTED',alternative:'Importar CSV/XLSX/PDF exportado pelo próprio investidor, com revisão e desfazer por lote.'},
  {title:'Cotações em tempo real',status:'REQUIRES_PROVIDER',alternative:'Cotações datadas de provedores configurados, sem alegar tempo real.'},
  {title:'Fiscal certificado',status:'NOT_CERTIFIED',alternative:'Dossiê por exercício, informe e revisão externa. Não emitir DARF automaticamente.'},
  {title:'App móvel nativo',status:'NOT_IMPLEMENTED',alternative:'Interface web local, sem sincronização remota automática.'}
 ],warning:'Os valores refletem apenas registros desta carteira. Não é aconselhamento nem substitui conciliação de custódia, comprovantes e tributos.'};
}


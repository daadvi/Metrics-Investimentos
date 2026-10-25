/** Cross-source data completeness and provenance report; never synthesizes price observations. */
import {dataCoverage} from './dividend-reconciliation.mjs';
import {taxWorkpaper} from './tax-audit-v13.mjs';
import {quarterlyOverview} from './cvm-quarterly.mjs';
import {validDate} from './domain.mjs';
export function sourceHealth(db,{asOf=new Date().toISOString().slice(0,10)}={}){
 if(!validDate(asOf))throw Error('Data de auditoria inválida.');
 const base=dataCoverage(db,{now:asOf});const owned=[...new Set((db.transactions||[]).filter(x=>x.type==='BUY'||x.type==='SELL').map(x=>x.ticker))];
 const dividends=db.providerDividends||[],verified=dividends.filter(x=>x.eligibleForCalendar),backfilled=dividends.filter(x=>x.syntheticDates),notices=db.notices||[];
 const byTicker=new Map((db.quoteHistory||[]).reduce((a,x)=>{if(!a.has(x.ticker))a.set(x.ticker,[]);a.get(x.ticker).push(x);return a;},new Map()));
 const issues=[];
 for(const ticker of owned){
  const history=(byTicker.get(ticker)||[]).sort((a,b)=>a.date.localeCompare(b.date));
  const firstPurchase=[...(db.transactions||[])].filter(x=>x.ticker===ticker&&x.type==='BUY').map(x=>x.date).sort()[0];
  if(!history.length)issues.push({ticker,severity:'ALTA',type:'SEM_PRECOS_HISTORICOS',message:'Não é possível calcular trajetória real sem preços por data.'});
  else if(firstPurchase&&history[0].date>firstPurchase)issues.push({ticker,severity:'MEDIA',type:'HISTORICO_INCOMPLETO',message:`Primeiro preço: ${history[0].date}; primeira compra: ${firstPurchase}.`});
 }
 const qs=quarterlyOverview(db);
 if(!db.snapshots?.length)issues.push({severity:'ALTA',type:'SEM_CUSTODIA_CONCILIADA',message:'Ausente extrato de custódia para conferência externa.'});
 return {asOf,prices:base.quotes,missingHistoricalPriceIssues:issues,sourceRecords:{cvmMonthly:(db.cvmReports||[]).length,cvmQuarterly:qs.entries,providerResearch:(db.providerResearch||[]).length,providerDividendObservations:dividends.length,thirdPartyEventsWithDates:verified.length,syntheticDividendDates:backfilled.length,issuerNoticesUserProvided:notices.length},qualityLabels:{officialDividendAnnouncementsVerifiedAutomatically:0,realTimeLicensedQuoteFeeds:0},warning:'Indicadores CVM são periódicos. Proventos de fornecedor não são comunicados autenticados. Rentabilidade exige preços completos e operações conciliadas. Não existe declaração fiscal garantida automaticamente.'};
}

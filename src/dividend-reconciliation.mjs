/** Non-speculative income reconciliation across record dates, future events and recorded cash. */
import {sharesEligible} from './insights.mjs';
import {validDate} from './domain.mjs';
const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
export function reconcileIncome(db,{from='2000-01-01',to='2200-12-31'}={}){
 if(!validDate(from)||!validDate(to)||from>to)throw Error('Período inválido.');
 const operations=db.transactions||[];
 const events=(db.events||[]).filter(e=>e.date>=from&&e.date<=to).map(e=>{
   const elig=e.recordDate?sharesEligible(db,e.ticker,e.recordDate):{quantity:null,confidence:'DATA_COM_NAO_INFORMADA'};
   const predicted=elig.quantity===null?null:cents(elig.quantity*e.perShare);
   const matches=operations.filter(t=>t.ticker===e.ticker&&['DIVIDEND','JCP'].includes(t.type)&&t.date===e.date);
   const received=matches.length?cents(matches.reduce((s,t)=>s+t.amount,0)):null;
   const status=predicted===null?'SEM_ELEGIBILIDADE':received===null?'AGUARDANDO_CONFERENCIA':Math.abs(predicted-received)<0.02?'CONCILIADO':e.nature==='JCP'&&received<predicted?'REVER_IR_RETIDO':'DIVERGENTE';
   return {id:e.id,ticker:e.ticker,paymentDate:e.date,recordDate:e.recordDate??null,nature:e.nature||'NAO_CLASSIFICADO',perShare:e.perShare,source:e.source||'Informado',verification:e.verification||'NAO_VERIFICADO',eligibleQuantity:elig.quantity,positionEvidence:elig.confidence,expected:predicted,received,status,verifiedAutomatically:false};
 });
 return {events,counts:Object.fromEntries(['CONCILIADO','DIVERGENTE','SEM_ELEGIBILIDADE','AGUARDANDO_CONFERENCIA','REVER_IR_RETIDO'].map(status=>[status,events.filter(e=>e.status===status).length])),warning:'A conciliação só compara registros locais. Ela NÃO confirma que o anúncio é oficial, que o crédito foi realizado ou que a natureza tributária está correta.'};
}
export function dataCoverage(db,{now=new Date().toISOString().slice(0,10)}={}){
 const tickers=[...new Set((db.transactions||[]).filter(t=>['BUY','SELL'].includes(t.type)).map(t=>t.ticker))];
 const quotes=new Map((db.quotes||[]).map(q=>[q.ticker,q]));const rows=tickers.map(ticker=>{const q=quotes.get(ticker);const age=q&&validDate(q.date)?Math.round((Date.parse(now+'T00:00:00Z')-Date.parse(q.date+'T00:00:00Z'))/86400000):null;return {ticker,price:q?.price??null,asOf:q?.date??null,source:q?.source??null,daysOld:age,quality:age===null?'AUSENTE':age<0?'DATA_FUTURA':age<=3?'RECENTE':age<=7?'DEFASADO':'ANTIGO'};});
 return {quotes:rows,cvm:db.cvmReports?.length||0,announcements:db.events?.length||0,officialProceedsFeeds:0,warning:'A idade da cotação não comprova tempo real. FIIs da CVM são informes mensais, proventos dependem de fontes e datas, tributos precisam de conferência.'};
}

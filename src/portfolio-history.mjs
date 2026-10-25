/** Auditable portfolio history. Returns NO performance if historical pricing is insufficient. */
import {validDate,calculatePositions} from './domain.mjs';
const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
const dayDiff=(a,b)=>Math.floor((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
function indexedQuotes(history){
 const map=new Map();for(const q of history){if(!validDate(q.date)||!Number.isFinite(Number(q.price))||q.price<=0)continue;
  if(!map.has(q.ticker))map.set(q.ticker,[]);map.get(q.ticker).push(q);
 }for(const arr of map.values())arr.sort((a,b)=>a.date.localeCompare(b.date));return map;
}
function quotedOnOrBefore(history,ticker,day,maxGap=4,priceIndex){
 const a=priceIndex?.get(ticker)||history.filter(q=>q.ticker===ticker&&validDate(q.date)&&Number(q.price)>0).sort((a,b)=>a.date.localeCompare(b.date));
 let low=0,high=a.length-1,last=null;while(low<=high){const mid=(low+high)>>1;
  if(a[mid].date<=day){last=a[mid];low=mid+1;}else high=mid-1;
 }
 return last&&dayDiff(last.date,day)<=maxGap?last:null;
}
export function valuationAt(db,day,{maxGap=4,priceIndex=null}={}){
 if(!validDate(day))throw Error('Data de avaliação inválida.');
 const transactions=(db.transactions||[]).filter(t=>t.date<=day);
 const positions=calculatePositions(transactions).filter(p=>p.quantity>1e-9);
 const history=(db.quoteHistory||[]);
 const missing=[],quotes=[],values=[];
 for(const p of positions){const q=quotedOnOrBefore(history,p.ticker,day,maxGap,priceIndex);if(!q){missing.push(p.ticker);continue;}
  quotes.push({ticker:p.ticker,date:q.date,source:q.source});values.push({ticker:p.ticker,quantity:p.quantity,price:q.price,marketValue:cents(p.quantity*q.price)});
 }
 return {date:day,complete:missing.length===0&&positions.length>0,value:missing.length?null:cents(values.reduce((s,x)=>s+x.marketValue,0)),priced:values,quotes,missing,positions:positions.length};
}
export function historyReport(db,{start,end,maxGap=4}={}){
 const corporate=(db.transactions||[]).filter(t=>['SPLIT','REVERSE_SPLIT','BONUS'].includes(t.type)&&(!start||t.date>=start)&&(!end||t.date<=end));
 const records=(db.quoteHistory||[]).filter(q=>validDate(q.date)).map(q=>q.date);
 const dates=[...new Set(records)].filter(d=>(!start||d>=start)&&(!end||d<=end)).sort();
 const priceIndex=indexedQuotes(db.quoteHistory||[]);
 const points=dates.map(date=>valuationAt(db,date,{maxGap,priceIndex}));
 const complete=points.filter(x=>x.complete);
 // Portfolio valuation contains shares only. Purchases are money injected; sales and cash distributions are external withdrawals.
 // Day-level TWR uses an end-of-day cash-flow approximation and is disabled across price gaps.
 let growth=1,linked=0,skippedIntervals=0;const series=[];
 for(let i=1;i<complete.length;i++){
  const prev=complete[i-1],cur=complete[i],gap=dayDiff(prev.date,cur.date);
  if(gap<1||gap>maxGap){skippedIntervals++;continue;}
  const flows=(db.transactions||[]).filter(t=>t.date>prev.date&&t.date<=cur.date).reduce((s,t)=>{
   if(t.type==='BUY')return s+t.quantity*t.price+(t.fee||0);
   if(t.type==='SELL')return s-(t.quantity*t.price-(t.fee||0));
   if(['DIVIDEND','JCP','AMORTIZATION'].includes(t.type))return s-(t.amount||0);
   return s;
  },0);
  if(prev.value<=0)continue;
  const r=(cur.value-prev.value-flows)/prev.value;
  if(!Number.isFinite(r)||r<=-1)continue;
  growth*=1+r;linked++;series.push({date:cur.date,value:cur.value,periodReturn:r,linkedReturnPercent:+((growth-1)*100).toFixed(4)});
 }
 return {points:points.slice(-250),completeDays:complete.length,range:complete.length?{from:complete[0].date,to:complete.at(-1).date}:null,lastComplete:complete.at(-1)||null,linkedPeriods:linked,approximateTwrPercent:linked>=1&&skippedIntervals===0&&!corporate.length?+((growth-1)*100).toFixed(4):null,skippedIntervals,series,warning:corporate.length?'Eventos societários não ajustados nos preços históricos. Retorno acumulado suspenso até reconciliação.':skippedIntervals?'Histórico com lacunas maiores que o intervalo máximo: retorno total desativado para não ligar períodos sem cotações.':linked?'Retorno aproximado por intervalos com preços completos; transações no dia são tratadas como fluxos de fim do período. Não representa TWR auditado nem inclui custódia não conciliada.':'Não existem observações de preços suficientemente completas para calcular rentabilidade histórica. Aporte não é lucro.',missingPrices:[...new Set(points.flatMap(p=>p.missing))]};
}
export function parseDailyBenchmarkCSV(text){
 const rows=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean).slice(0,10000);const result=[];
 for(const line of rows){const tokens=line.replace(/"/g,'').split(/[;\t]/);if(tokens.length<2)continue;const raw=tokens[0].trim();const br=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);const date=br?`${br[3]}-${br[2]}-${br[1]}`:raw;if(!validDate(date))continue;
  const rate=Number(tokens[1].trim().replace(',','.'));if(!Number.isFinite(rate)||rate< -5||rate>20)continue;result.push({date,rate});
 }
 return [...new Map(result.map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function benchmarkBetween(rows,from,to){if(!validDate(from)||!validDate(to)||from>=to)return null;
 const selected=rows.filter(x=>x.date>from&&x.date<=to);if(!selected.length)return null;
 return {from,to,days:selected.length,cumulativePercent:+((selected.reduce((a,x)=>a*(1+x.rate/100),1)-1)*100).toFixed(4),warning:'CDI acumulado somente nas datas fornecidas pela fonte, sem inferir dias faltantes.'};
}

/** Price-level index comparisons. Input must be a real dated index series, not estimated rates. */
export function parseIndexCSV(text){
 const rows=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).slice(0,12000),output=[];
 for(const line of rows){const f=line.replace(/"/g,'').split(/[;\t]/);if(f.length<2)continue;const raw=f[0].trim(),br=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/),date=br?`${br[3]}-${br[2]}-${br[1]}`:raw;
  let s=f[1].replace(/\s|R\$/g,'');if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');const value=Number(s);
  if(validDate(date)&&Number.isFinite(value)&&value>0&&value<1e12)output.push({date,value});
 }
 return [...new Map(output.map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function indexBetween(rows,from,to,{maxGap=5}={}){
 if(!validDate(from)||!validDate(to)||from>=to)return null;
 const left=rows.filter(x=>x.date<=from).sort((a,b)=>b.date.localeCompare(a.date))[0];
 const right=rows.filter(x=>x.date<=to).sort((a,b)=>b.date.localeCompare(a.date))[0];
 if(!left||!right||left.date===right.date||dayDiff(left.date,from)>maxGap||dayDiff(right.date,to)>maxGap)return null;
 return {from,to,startDate:left.date,endDate:right.date,cumulativePercent:+((right.value/left.value-1)*100).toFixed(4),warning:'Variação do índice de preços nos extremos informados, não inclui proventos se o índice não os incorpora.'};
}
/** Percent changes of months explicitly provided. Not an annual forecast. */
export function monthlyIndexBetween(rows,from,to){
 if(!validDate(from)||!validDate(to)||from>=to)return null;
 const start=from.slice(0,7),end=to.slice(0,7);
 const months=rows.filter(x=>x.date.slice(0,7)>start&&x.date.slice(0,7)<=end);
 if(!months.length)return null;
 return {from,to,months:months.length,lastMonth:months.at(-1).date.slice(0,7),cumulativePercent:+((months.reduce((s,x)=>s*(1+x.rate/100),1)-1)*100).toFixed(4),warning:'IPCA acumulado somente nos meses publicados importados; parcial em relação às datas diárias do patrimônio.'};
}

/** Metrics 1.0: verificações determinísticas de desempenho. Nunca inferir histórico ausente. */
import {calculatePositions,validDate} from './domain.mjs';
const round=(n,p=2)=>Math.round((n+Number.EPSILON)*10**p)/10**p;
const dateNumber=s=>Date.parse(s+'T12:00:00Z');
export function calculateXirr(flows,{lastDate}={}){
 if(!Array.isArray(flows)||flows.length<2)return null;
 if(flows.some(x=>!validDate(x.date)||!Number.isFinite(x.amount)))throw Error('Fluxo financeiro inválido.');
 const list=[...flows].filter(x=>Math.abs(x.amount)>1e-9).sort((a,b)=>a.date.localeCompare(b.date));
 if(list.length<2||!list.some(x=>x.amount<0)||!list.some(x=>x.amount>0))return null;
 const first=dateNumber(list[0].date),last=dateNumber(lastDate||list.at(-1).date);
 if(!Number.isFinite(last)||last-first<86400000)return null;
 const day=86400000,discount=r=>list.reduce((s,x)=>s+x.amount/Math.pow(1+r,(dateNumber(x.date)-first)/(365.25*day)),0);
 let lo=-0.99999,hi=1;
 let left=discount(lo),right=discount(hi);
 for(let i=0;i<36 && left*right>0;i++){hi=hi*2+1;right=discount(hi);}
 if(!Number.isFinite(left)||!Number.isFinite(right)||left*right>0)return null;
 for(let i=0;i<130;i++){
  const m=(lo+hi)/2,v=discount(m);if(!Number.isFinite(v))return null;
  if((left>0)===(v>0)){lo=m;left=v;}else{hi=m;right=v;}
 }
 return round((lo+hi)/2*100,5);
}
export function portfolioXirr(db,{asOf=new Date().toISOString().slice(0,10),maxStaleDays=7}={}){
 if(!validDate(asOf))throw Error('Data da rentabilidade inválida.');
 const tx=(db.transactions||[]).filter(t=>t.date<=asOf);
 if(!tx.some(t=>t.type==='BUY'))return {value:null,reason:'Não há compras históricas registradas.'};
 if(tx.some(t=>['SPLIT','REVERSE_SPLIT','BONUS'].includes(t.type)))return {value:null,reason:'Há eventos societários: confirme histórico ajustado antes de utilizar XIRR.'};
 const positions=calculatePositions(tx).filter(x=>x.quantity>1e-9),map=new Map((db.quotes||[]).map(q=>[q.ticker,q]));
 const missing=[],stale=[];let market=0;
 for(const p of positions){const q=map.get(p.ticker);if(!q||q.date>asOf){missing.push(p.ticker);continue;}
  const gap=Math.floor((dateNumber(asOf)-dateNumber(q.date))/86400000);
  if(gap>maxStaleDays){stale.push({ticker:p.ticker,lastQuote:q.date,gap});continue;}
  market+=p.quantity*q.price;
 }
 if(missing.length||stale.length)return {value:null,reason:'Faltam cotações válidas para calcular a rentabilidade.',missing,stale};
 const snapshots=(db.snapshots||[]).filter(s=>s.asOf<=asOf);
 for(const s of snapshots){const known=new Map(calculatePositions(tx.filter(t=>t.date<=s.asOf)).map(p=>[p.ticker,p.quantity]));
  const unverified=s.positions.filter(p=>Math.abs((known.get(p.ticker)||0)-p.quantity)>1e-7);
  if(unverified.length)return {value:null,reason:'Extrato de custódia não conciliado com o histórico de compras e vendas.',unverified:unverified.map(p=>p.ticker)};
 }
 const flows=tx.flatMap(t=>{
  if(t.type==='BUY')return [{date:t.date,amount:-(t.quantity*t.price+(t.fee||0))}];
  if(t.type==='SELL')return [{date:t.date,amount:t.quantity*t.price-(t.fee||0)}];
  if(['DIVIDEND','JCP','AMORTIZATION'].includes(t.type))return [{date:t.date,amount:t.amount}];
  return [];
 });
 if(market>0)flows.push({date:asOf,amount:round(market)});
 const xirr=calculateXirr(flows,{lastDate:asOf});
 return {value:xirr,asOf,marketValue:round(market),quoteCount:positions.length,reason:xirr===null?'Fluxos insuficientes ou taxa interna sem solução única confirmada.':null,method:'XIRR anualizada a partir de fluxos reais informados e valor de mercado com preços datados; não inclui impostos, patrimônio fora da carteira ou custos omitidos.'};
}
export function auditPortfolio(db,{asOf=new Date().toISOString().slice(0,10)}={}){
 const positions=calculatePositions(db.transactions||[]).filter(x=>x.quantity>1e-9),quotes=new Map((db.quotes||[]).map(q=>[q.ticker,q])),profiles=new Map((db.profiles||[]).map(p=>[p.ticker,p]));
 const holdings=positions.map(p=>{const q=quotes.get(p.ticker),profile=profiles.get(p.ticker);return {...p,type:profile?.type||'NAO_CLASSIFICADO',quote:q?{date:q.date,price:q.price,source:q.source,delayMinutes:q.delayMinutes??null}:null,marketValue:q?round(p.quantity*q.price):null};});
 const noQuote=holdings.filter(p=>p.marketValue===null).map(p=>p.ticker),noClass=holdings.filter(p=>p.type==='NAO_CLASSIFICADO').map(p=>p.ticker);
 const warnings=[];if(noQuote.length)warnings.push(`Cotações indisponíveis: ${noQuote.join(', ')}`);if(noClass.length)warnings.push(`Ativos sem classe: ${noClass.join(', ')}`);
 if((db.transactions||[]).some(x=>['SPLIT','REVERSE_SPLIT','BONUS'].includes(x.type)))warnings.push('Há eventos societários que exigem validação dos custos e das séries históricas.');
 const positionsByClass={};let total=0;for(const p of holdings)if(p.marketValue!==null){total+=p.marketValue;positionsByClass[p.type]=(positionsByClass[p.type]||0)+p.marketValue;}
 return {date:asOf,complete:noQuote.length===0,knownMarketValue:round(total),totalMarketValue:noQuote.length?null:round(total),holdings,warnings,allocation:noQuote.length?null:Object.entries(positionsByClass).map(([type,value])=>({type,value:round(value),percent:total?round(value/total*100):0})).sort((a,b)=>b.value-a.value)};
}

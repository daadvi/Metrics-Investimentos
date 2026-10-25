/** Radar local do Metrics. Rankings e alertas só usam dados gravados, com procedência explícita. */
import {auditPortfolio} from './analytics-v1.mjs';
import {projectedEvents} from './insights.mjs';
const num=x=>x===null||x===undefined?null:Number.isFinite(Number(x))?Number(x):null;
const days=(a,b)=>Math.floor((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
export function screener(db,{sort='DY',minimumEquity=0,maxPvp=1000}={}){
 const research=new Map((db.providerResearch||[]).map(r=>[r.ticker,r]));
 const sourceProfiles=new Map((db.profiles||[]).map(p=>[p.ticker,p]));
 for(const r of research.values())if(!sourceProfiles.has(r.ticker))sourceProfiles.set(r.ticker,{ticker:r.ticker,name:r.ticker,type:r.kind==='FII_INDICATORS'?'FII_NAO_CLASSIFICADO':'ACAO',sector:null,source:r.source,date:r.observedAt,dy12:null,equity:null,vacancy:null});
 const assets=[...sourceProfiles.values()].map(p=>{const r=research.get(p.ticker),data=r?.indicators||{};
  return {ticker:p.ticker,name:p.name||p.ticker,type:p.type,sector:p.sector||null,source:r?.source||p.source,asOf:r?.observedAt||p.date||null,dy12:num(data.dy12??p.dy12),pvp:num(data.pvp),equity:num(data.patrimonioLiquido??p.equity),vacancy:num(data.vacancy??p.vacancy),properties:num(data.properties??p.assets)};
 }).filter(x=>x.equity===null||x.equity>=minimumEquity).filter(x=>x.pvp===null||x.pvp<=maxPvp);
 const by=sort==='PVP'?'pvp':sort==='EQUITY'?'equity':'dy12';
 assets.sort((a,b)=>{
  const left=a[by],right=b[by];if(left===null&&right===null)return a.ticker.localeCompare(b.ticker);if(left===null)return 1;if(right===null)return -1;
  return sort==='PVP'?left-right:right-left;
 });
 return {items:assets,dataSource:'Somente fichas e pesquisas gravadas localmente. Nem todos os ativos do mercado são avaliados.',sort,warnings:['Ranking NÃO é recomendação de compra. Dados ausentes ficam como não informados.','Cotações e fundamentos de períodos distintos podem não ser comparáveis.']};
}
export function localAlerts(db,{today=new Date().toISOString().slice(0,10)}={}){
 const quotes=new Map((db.quotes||[]).map(q=>[q.ticker,q])),alerts=[];
 for(const w of db.watchlist||[]){const q=quotes.get(w.ticker);if(w.target===null||w.target===undefined||!q)continue;
  const delay=days(today,q.date);
  if(q.price<=w.target){alerts.push({type:'TARGET',ticker:w.ticker,title:`Preço observado atingiu alvo cadastrado: ${w.ticker}`,detail:`R$ ${q.price.toFixed(2)} ≤ R$ ${Number(w.target).toFixed(2)} · ${q.date} · ${q.source}`,stale:delay>4,source:q.source});}
 }
 const events=projectedEvents(db,{today});for(const e of events){const remaining=days(e.date,today);if(remaining<0||remaining>14)continue;alerts.push({type:'INCOME',ticker:e.ticker,title:`Pagamento cadastrado para ${e.ticker}`,detail:`${e.date}, ${e.amount===null?'quantidade elegível desconhecida':'R$ '+e.amount.toFixed(2)} · ${e.claim}`,stale:false,source:e.source});}
 const report=auditPortfolio(db,{asOf:today});
 if(report.complete&&report.knownMarketValue>0){for(const p of report.holdings){if(p.marketValue!==null&&p.marketValue/report.knownMarketValue>=0.4){alerts.push({type:'CONCENTRATION',ticker:p.ticker,title:`Concentração elevada: ${p.ticker}`,detail:`${(p.marketValue/report.knownMarketValue*100).toFixed(1)}% do valor coberto da carteira. Concentração não significa perda inevitável.`,stale:false,source:'Calculado do banco local'});}}}
 return {today,items:alerts.sort((a,b)=>a.type.localeCompare(b.type)),warnings:report.warnings,warning:'Alertas locais são avaliados quando o aplicativo é consultado; não funcionam continuamente com o computador desligado.'};
}
export function incomeGoal(db,{monthlyTarget}={}){
 const amount=Number(monthlyTarget);
 if(!Number.isFinite(amount)||amount<=0||amount>1e9)return {configured:false,monthlyTarget:null};
 const paid=(db.transactions||[]).filter(t=>['DIVIDEND','JCP'].includes(t.type)).sort((a,b)=>b.date.localeCompare(a.date));
 if(!paid.length)return {configured:true,monthlyTarget:amount,progress:null,reason:'Nenhum provento recebido foi lançado; sem histórico para comparar.'};
 const last=paid[0].date;const end=new Date(last+'T12:00:00Z');const start=new Date(end);start.setUTCMonth(start.getUTCMonth()-12);
 const sum=paid.filter(t=>Date.parse(t.date+'T12:00:00Z')>start.getTime()).reduce((s,t)=>s+t.amount,0);
 return {configured:true,monthlyTarget:amount,observedThrough:last,averageMonthly:Math.round(sum/12*100)/100,progress:Math.round(Math.min(100,(sum/12)/amount*100)*100)/100,warning:'Média histórica sobre 12 meses até o último pagamento informado. Não é previsão de rendimentos futuros.'};
}

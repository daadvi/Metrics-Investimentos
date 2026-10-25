export const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-^:]{0,23}$/;
export function tickerOf(raw) {
  const ticker=String(raw??'').trim().toUpperCase();
  if (!TICKER_RE.test(ticker)) throw new Error('Ticker inválido (máximo de 24 caracteres).');
  return ticker;
}
const number = (v,name,{zero=false}={}) => {
  const n=Number(v);
  if(!Number.isFinite(n) || (zero ? n<0 : n<=0) || n>1e12) throw new Error(`${name} inválido.`);
  return n;
};
const money = (v,name,{zero=false}={}) => Math.round((number(v,name,{zero})+Number.EPSILON)*100)/100;
export function validDate(date){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const [year,month,day]=date.split('-').map(Number);
 if(year<1900||year>2200||month<1||month>12||day<1||day>31)return false;
 const parsed=new Date(Date.UTC(year,month-1,day));
 return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day;
}
export const INCOME_TYPES=['DIVIDEND','JCP','AMORTIZATION'];

export function validateTransaction(input) {
  const type=String(input.type??'').toUpperCase();
  if(!['BUY','SELL','SPLIT','REVERSE_SPLIT','BONUS',...INCOME_TYPES].includes(type)) throw new Error('Tipo de operação inválido.');
  const ticker=tickerOf(input.ticker);
  const date=String(input.date??'');
  if(!validDate(date)) throw new Error('Data inválida.');
  const base={ticker,type,date,notes:String(input.notes??'').slice(0,300)};
  if(['SPLIT','REVERSE_SPLIT'].includes(type)){const factor=number(input.factor,'Fator de desdobramento');if(factor>1000)throw new Error('Fator acima do limite.');return {...base,quantity:0,price:0,fee:0,amount:0,factor};}
  if(type==='BONUS'){const quantity=number(input.quantity,'Quantidade bonificada');const basis=money(input.basis??0,'Custo fiscal atribuído à bonificação',{zero:true});return {...base,quantity,price:0,fee:0,amount:0,basis,requiresTaxReview:true};}
  if(INCOME_TYPES.includes(type)) return {...base,quantity:0,price:0,fee:0,amount:money(input.amount,'Provento ou amortização'),adjustCost:type==='AMORTIZATION'&&input.adjustCost===true};
  const quantity=number(input.quantity,'Quantidade');
  const price=Math.round((number(input.price,'Preço por unidade')+Number.EPSILON)*1000000)/1000000;
  if(price<=0)throw new Error('Preço por unidade menor que a precisão suportada.');
  const fee=money(input.fee??0,'Taxa',{zero:true});
  return {...base,quantity,price,fee,amount:0};
}
export function validateWatch(input) {
  return {
    ticker:tickerOf(input.ticker),
    priority:['alta','media','baixa'].includes(input.priority)?input.priority:'media',
    target: input.target==null || String(input.target).trim()===''?null:money(input.target,'Preço de interesse'),
    budget: input.budget==null || String(input.budget).trim()===''?null:money(input.budget,'Aporte planejado'),
    notes:String(input.notes??'').slice(0,500),
    createdAt:new Date().toISOString()
  };
}
export function calculatePositions(transactions) {
  const map=new Map();
  const sorted=[...transactions].sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt??'').localeCompare(String(b.createdAt??'')));
  for(const t of sorted){
    let p=map.get(t.ticker);
    if(!p){p={ticker:t.ticker,quantity:0,cost:0,dividends:0,jcp:0,amortization:0,realized:0,buys:0,sells:0};map.set(t.ticker,p);}
    if(t.type==='BUY') {
      p.quantity+=t.quantity; p.cost+=t.quantity*t.price+t.fee; p.buys++;
    }else if(t.type==='SELL') {
      if(t.quantity>p.quantity+1e-8) throw new Error(`Venda de ${t.ticker} excede saldo na data ${t.date}.`);
      const avg=p.quantity>0?p.cost/p.quantity:0;
      p.realized+=t.quantity*t.price-t.fee-t.quantity*avg;
      p.cost-=t.quantity*avg; p.quantity-=t.quantity;p.sells++;
      if(p.quantity<1e-8){p.quantity=0;p.cost=0;}
    }else if(t.type==='SPLIT'||t.type==='REVERSE_SPLIT'){if(p.quantity<=0)throw new Error(`Evento ${t.type} sem posição anterior em ${t.date}: ${t.ticker}`);p.quantity=+(p.quantity*t.factor).toFixed(8);}
    else if(t.type==='BONUS'){if(p.quantity<=0)throw new Error(`Bonificação sem posição anterior em ${t.date}: ${t.ticker}`);p.quantity+=t.quantity;p.cost+=t.basis||0;}
    else if(t.type==='DIVIDEND')p.dividends+=t.amount;
    else if(t.type==='JCP')p.jcp+=t.amount;
    else if(t.type==='AMORTIZATION'){p.amortization+=t.amount;if(t.adjustCost){if(t.amount>p.cost+0.005)throw new Error('Amortização excede custo remanescente; confira o informe fiscal.');p.cost=Math.max(0,p.cost-t.amount);}}
  }
  const list=[...map.values()].map(p=>({...p,quantity:+p.quantity.toFixed(8),cost:+p.cost.toFixed(2),average:p.quantity?+(p.cost/p.quantity).toFixed(4):0,dividends:+p.dividends.toFixed(2),jcp:+p.jcp.toFixed(2),amortization:+p.amortization.toFixed(2),realized:+p.realized.toFixed(2)}));
  return list.sort((a,b)=>a.ticker.localeCompare(b.ticker));
}
export function portfolioTotals(transactions){
  const positions=calculatePositions(transactions);
  return {positions,holdingCost:+positions.reduce((s,p)=>s+p.cost,0).toFixed(2),dividends:+positions.reduce((s,p)=>s+p.dividends+p.jcp,0).toFixed(2),amortizations:+positions.reduce((s,p)=>s+p.amortization,0).toFixed(2),realized:+positions.reduce((s,p)=>s+p.realized,0).toFixed(2),holdings:positions.filter(p=>p.quantity>0).length};
}
export function simulate(input){
  const price=number(input.price,'Preço da cota'), dividend=number(input.dividend,'Dividendo',{zero:true});
  const firstMonths=Math.round(number(input.firstMonths,'Meses da primeira fase'));
  const secondMonths=Math.round(number(input.secondMonths??0,'Meses da segunda fase',{zero:true}));
  if(firstMonths+secondMonths>600) throw new Error('Máximo de 600 meses.');
  const firstAmount=money(input.firstAmount,'Aporte da primeira fase',{zero:true});
  const secondAmount=money(input.secondAmount??0,'Aporte da segunda fase',{zero:true});
  const reinvest=input.reinvest!==false;
  let shares=0, cash=0, deposited=0, received=0, withdrawn=0;
  const months=[];
  for(let i=1;i<=firstMonths+secondMonths;i++){
    const amount=i<=firstMonths?firstAmount:secondAmount;
    const payout=Math.round(shares*dividend*100)/100;
    received+=payout;
    if(reinvest)cash+=payout;else withdrawn+=payout;
    cash+=amount;deposited+=amount;
    const buy=Math.floor((cash+0.00000001)/price);
    shares+=buy;cash=Math.max(0,Math.round((cash-buy*price)*100)/100);
    months.push({month:i,shares,cash:+cash.toFixed(2),deposited:+deposited.toFixed(2),received:+received.toFixed(2),incomeNextMonth:+(shares*dividend).toFixed(2),holdingsValue:+(shares*price+cash).toFixed(2),withdrawn:+withdrawn.toFixed(2)});
  }
  return {months,last:months.at(-1),params:{...input,price,dividend}};
}

// Projeção hipotética, não é previsão de cotação ou dividendos.
export function simulatePhases(input){
 const price0=number(input.price,'Preço inicial'), dividend0=number(input.dividend??0,'Dividendo',{zero:true});
 const phases=Array.isArray(input.phases)?input.phases:[{months:input.firstMonths,amount:input.firstAmount},{months:input.secondMonths,amount:input.secondAmount}];
 if(!phases.length||phases.length>30)throw new Error('Informe de 1 a 30 fases de aporte.');
 const stages=phases.map((p,i)=>({months:Math.round(number(p.months,`Duração da fase ${i+1}`)),amount:money(p.amount,`Aporte da fase ${i+1}`,{zero:true})}));
 const length=stages.reduce((s,p)=>s+p.months,0);if(length>600)throw new Error('Máximo de 600 meses.');
 const reinvest=number(input.reinvestPercent??(input.reinvest===false?0:100),'Percentual de reinvestimento',{zero:true});if(reinvest>100)throw new Error('Reinvestimento deve estar entre 0 e 100%.');
 const priceAnnual=Number(input.priceGrowthAnnual??0),divAnnual=Number(input.dividendGrowthAnnual??0),inflation=Number(input.inflationAnnual??0);
 for(const [v,name] of [[priceAnnual,'Variação do preço'],[divAnnual,'Variação do dividendo'],[inflation,'Inflação']])if(!Number.isFinite(v)||v< -95||v>300)throw new Error(`${name} inválida.`);
 let shares=0,cash=0,deposited=0,received=0,withdrawn=0, reinvested=0, phase=0, phaseEnd=stages[0].months;
 const months=[];
 for(let month=1;month<=length;month++){
  if(month>phaseEnd){phase++;phaseEnd+=stages[phase].months;}
  const price=Math.round(price0*Math.pow(1+priceAnnual/100,(month-1)/12)*10000)/10000;
  const dividend=Math.round(dividend0*Math.pow(1+divAnnual/100,(month-1)/12)*10000)/10000;
  const payout=Math.round(shares*dividend*100)/100;
  const applied=Math.round(payout*reinvest/100*100)/100;
  const drawn=Math.round((payout-applied)*100)/100;
  received=Math.round((received+payout)*100)/100;reinvested=Math.round((reinvested+applied)*100)/100;
  withdrawn=Math.round((withdrawn+drawn)*100)/100;
  const amount=stages[phase].amount;cash+=applied+amount;deposited+=amount;
  const buy=Math.floor((cash+1e-7)/price);
  shares+=buy;cash=Math.max(0,Math.round((cash-buy*price)*100)/100);
  const holdingsValue=Math.round((shares*price+cash)*100)/100;
  const realValue=Math.round(holdingsValue/Math.pow(1+inflation/100,month/12)*100)/100;
  months.push({month,phase:phase+1,shares,cash:Math.round(cash*100)/100,deposited:Math.round(deposited*100)/100,received,reinvested,withdrawn,price,dividend,holdingsValue,realValue,incomeNextMonth:Math.round(shares*dividend*100)/100});
 }
 return {params:{...input,phases:stages},months,last:months.at(-1)};
}
export function portfolioAnalytics(transactions,quotes=[]){
 const positions=calculatePositions(transactions);const quoteMap=new Map(quotes.map(q=>[q.ticker,q]));
 const valued=positions.filter(p=>p.quantity>0).map(p=>{const q=quoteMap.get(p.ticker);const marketValue=q?Math.round(p.quantity*q.price*100)/100:null;return {...p,marketValue,quoteDate:q?.date??null,unrealized:marketValue===null?null:Math.round((marketValue-p.cost)*100)/100};});
 const priced=valued.filter(p=>p.marketValue!==null);
 const totalMarket=priced.reduce((sum,p)=>sum+p.marketValue,0);
 const missing=valued.filter(p=>p.marketValue===null).map(p=>p.ticker);
 const dividendsByMonth={};const dividendsByTicker={};
 for(const t of transactions){if(!['DIVIDEND','JCP'].includes(t.type))continue;const m=t.date.slice(0,7);dividendsByMonth[m]=Math.round(((dividendsByMonth[m]||0)+t.amount)*100)/100;dividendsByTicker[t.ticker]=Math.round(((dividendsByTicker[t.ticker]||0)+t.amount)*100)/100;}
 return {positions:valued,covered:priced.length,totalPositions:valued.length,marketValue:Math.round(totalMarket*100)/100,missingQuotes:missing,marketValueComplete:missing.length===0&&valued.length>0,unrealized:Math.round(priced.reduce((sum,p)=>sum+p.unrealized,0)*100)/100,dividendsByMonth:Object.entries(dividendsByMonth).sort(),dividendsByTicker:Object.entries(dividendsByTicker).sort((a,b)=>b[1]-a[1])};
}

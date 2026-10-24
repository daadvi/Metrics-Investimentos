import {tickerOf} from './domain.mjs';
const num=(value,label,min,max)=>{const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${label} fora do intervalo permitido.`);return n;};
const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
export function simulatePortfolio(input){
 const assets=Array.isArray(input.assets)?input.assets:[];if(!assets.length||assets.length>12)throw Error('Escolha de 1 a 12 ativos.');
 const seen=new Set();const instruments=assets.map(a=>{const ticker=tickerOf(a.ticker);if(seen.has(ticker))throw Error('Ativo repetido: '+ticker);seen.add(ticker);return {ticker,price:num(a.price,`Preço de ${ticker}`,0.0001,1e9),dividend:num(a.dividend??0,`Dividendo de ${ticker}`,0,1e6),weight:num(a.weight,`Peso de ${ticker}`,0,100),shares:0,cash:0,totalReceived:0,totalReinvested:0,totalWithdrawn:0,priceGrowth:num(a.priceGrowthAnnual??0,'Crescimento do preço',-90,300),dividendGrowth:num(a.dividendGrowthAnnual??0,'Crescimento de dividendos',-90,300)};});
 const totalWeight=instruments.reduce((s,a)=>s+a.weight,0);if(Math.abs(totalWeight-100)>0.00001)throw Error(`A soma dos percentuais deve ser 100%; atual: ${totalWeight}%.`);
 const stages=input.phases;if(!Array.isArray(stages)||!stages.length||stages.length>30)throw Error('Informe de 1 a 30 fases.');const phases=stages.map((s,i)=>({months:num(s.months,`Meses da fase ${i+1}`,1,600),amount:num(s.amount,`Aporte da fase ${i+1}`,0,1e9)}));if(phases.some(s=>!Number.isInteger(s.months)))throw Error('Duração deve ser em meses inteiros.');const length=phases.reduce((s,a)=>s+a.months,0);if(length>600)throw Error('Máximo de 600 meses.');
 const reinvest=num(input.reinvestPercent??100,'Reinvestimento',0,100),inflation=num(input.inflationAnnual??0,'Inflação',-90,300);
 let deposited=0,received=0,withdrawn=0,reinvested=0;const months=[];let phaseIndex=0,phaseLimit=phases[0].months;
 for(let month=1;month<=length;month++){
  if(month>phaseLimit){phaseIndex++;phaseLimit+=phases[phaseIndex].months;}
  const contribution=cents(phases[phaseIndex].amount);deposited=cents(deposited+contribution);
  // Distribuição em centavos pelo método dos maiores restos: nunca cria nem perde dinheiro.
  const totalCents=Math.round(contribution*100);
  const allocation=instruments.map((a,i)=>({i,exact:totalCents*a.weight/100}));
  const pennies=allocation.map(a=>Math.floor(a.exact));
  let remainder=totalCents-pennies.reduce((s,n)=>s+n,0);
  for(const a of [...allocation].sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact)))){if(remainder<=0)break;pennies[a.i]++;remainder--;}
  const portions=pennies.map(n=>n/100);
  const holdings=[];
  for(let i=0;i<instruments.length;i++){
   const a=instruments[i],price=Math.round(a.price*Math.pow(1+a.priceGrowth/100,(month-1)/12)*1e6)/1e6;
   const dividend=Math.round(a.dividend*Math.pow(1+a.dividendGrowth/100,(month-1)/12)*1e6)/1e6;
   const payout=cents(a.shares*dividend),apply=cents(payout*reinvest/100),draw=cents(payout-apply);
   a.totalReceived=cents(a.totalReceived+payout);a.totalReinvested=cents(a.totalReinvested+apply);a.totalWithdrawn=cents(a.totalWithdrawn+draw);
   received=cents(received+payout);withdrawn=cents(withdrawn+draw);reinvested=cents(reinvested+apply);
   a.cash=cents(a.cash+portions[i]+apply);
   const bought=Math.floor((a.cash+1e-9)/price);a.shares+=bought;a.cash=cents(a.cash-bought*price);
   holdings.push({ticker:a.ticker,shares:a.shares,price,dividend,cash:a.cash,marketValue:cents(a.shares*price),incomeNextMonth:cents(a.shares*dividend),totalDividends:a.totalReceived});
  }
  const marketValue=cents(holdings.reduce((s,a)=>s+a.marketValue,0)),cash=cents(holdings.reduce((s,a)=>s+a.cash,0)),patrimony=cents(marketValue+cash);
  months.push({month,phase:phaseIndex+1,deposited,received,reinvested,withdrawn,marketValue,cash,holdingsValue:patrimony,realValue:cents(patrimony/Math.pow(1+inflation/100,month/12)),incomeNextMonth:cents(holdings.reduce((s,a)=>s+a.incomeNextMonth,0)),holdings});
 }
 return {kind:'hypothetical-multi-asset',notes:'Simulação hipotética. Não prevê preços, proventos ou resultados reais. Compras de cotas inteiras e caixa por ativo.',params:{assets:assets.map(a=>({...a})),phases,reinvestPercent:reinvest,inflationAnnual:inflation},months,last:months.at(-1)};
}

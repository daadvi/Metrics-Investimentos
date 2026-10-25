/** Explicit multi-asset registry. No inferred prices, yields, or fiscal treatment. */
import {tickerOf,validDate} from './domain.mjs';
export const CLASSES=Object.freeze(['ACAO','FII','ETF','BDR','FIAGRO','FUND','FIXED_INCOME_BR','STOCK_FOREIGN','ETF_FOREIGN','BOND_FOREIGN','CASH','OTHER']);
export const CURRENCIES=Object.freeze(['BRL','USD','EUR','GBP','CAD','JPY','CHF','AUD']);
const text=(v,n=150)=>String(v??'').trim().slice(0,n);
const nval=(value,name,{zero=false,max=1e12}={})=>{const n=Number(value);if(value===null||value===undefined||String(value).trim()===''||!Number.isFinite(n)||n>(max)||(zero?n<0:n<=0))throw Error(`${name} inválido.`);return n;};
const decimal=(v,precision=8)=>Number(Number(v).toFixed(precision));
export function validateInstrument(raw){
 const ticker=tickerOf(raw.ticker),assetClass=text(raw.assetClass).toUpperCase();
 if(!CLASSES.includes(assetClass))throw Error('Classe de ativo não reconhecida.');
 const currency=text(raw.currency||'BRL').toUpperCase();if(!CURRENCIES.includes(currency))throw Error('Moeda não suportada.');
 const market=text(raw.market||'MANUAL',30).toUpperCase();if(!/^[A-Z0-9 _.-]{2,30}$/.test(market))throw Error('Mercado inválido.');
 return {ticker,assetClass,currency,market,name:text(raw.name,120),issuer:text(raw.issuer,120),isin:text(raw.isin,24),source:text(raw.source||'Cadastro manual',180),notes:text(raw.notes,700),updatedAt:new Date().toISOString()};
}
export function validateFixedIncome(raw){
 const id=raw.id===undefined?undefined:text(raw.id,60);
 const ticker=tickerOf(raw.ticker),currency=text(raw.currency||'BRL').toUpperCase();if(!CURRENCIES.includes(currency))throw Error('Moeda inválida.');
 const principal=decimal(nval(raw.principal,'Principal'),2);
 const startDate=text(raw.startDate,10),maturityDate=text(raw.maturityDate,10);
 if(!validDate(startDate)||!validDate(maturityDate)||maturityDate<=startDate)throw Error('Datas de aplicação ou vencimento inválidas.');
 const rateKind=text(raw.rateKind||'PREFIXED').toUpperCase();if(!['PREFIXED','CDI_PERCENT','IPCA_PLUS','UNKNOWN'].includes(rateKind))throw Error('Indexador inválido.');
 const annualRate=rateKind==='UNKNOWN'?null:nval(raw.annualRate,'Taxa contratada',{zero:true,max:300});
 const redemptions=Array.isArray(raw.redemptions)?raw.redemptions:[];
 if(redemptions.length>300)throw Error('Excesso de resgates.');let redeemedPrincipal=0;
 const clean=redemptions.map(r=>{const date=text(r.date,10),amount=decimal(nval(r.principal,'Principal resgatado'),2),received=decimal(nval(r.received,'Valor bruto recebido',{zero:true}),2);if(!validDate(date)||date<startDate)throw Error('Data de resgate inválida.');redeemedPrincipal+=amount;return {id:text(r.id,60),date,principal:amount,received,source:text(r.source||'Informado pelo usuário',120)};});
 if(redeemedPrincipal>principal+0.001)throw Error('Resgates excedem o principal contratado.');
 return {...(id?{id}:{}),ticker,currency,principal,startDate,maturityDate,rateKind,annualRate,issuer:text(raw.issuer,120),name:text(raw.name||ticker,120),guarantee:text(raw.guarantee||'NÃO_VERIFICADA',100),notes:text(raw.notes,500),source:text(raw.source||'Contrato cadastrado pelo investidor',160),redemptions:clean};
}
const dayDiff=(from,to)=>Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);
/** Estimated gross contract accrual: illustrative ACT/365, no market valuation, taxes, fees or default risk. */
export function fixedIncomePosition(instrument,{asOf=new Date().toISOString().slice(0,10)}={}){
 const v=validateFixedIncome(instrument);if(!validDate(asOf))throw Error('Data de avaliação inválida.');
 const paid=v.redemptions.filter(r=>r.date<=asOf).reduce((s,r)=>s+r.principal,0);
 const remaining=decimal(Math.max(0,v.principal-paid),2);
 const effectiveDate=asOf<v.maturityDate?asOf:v.maturityDate;
 const days=Math.max(0,dayDiff(v.startDate,effectiveDate));
 const estimatedGross=(v.rateKind==='PREFIXED'&&asOf>=v.startDate&&asOf<=v.maturityDate)?decimal(remaining*Math.pow(1+v.annualRate/100,days/365),2):null;
 const marketValue=null; // Contract accrual is NOT a tradable price.
 return {id:v.id||null,ticker:v.ticker,currency:v.currency,principal:v.principal,remainingPrincipal:remaining,rateKind:v.rateKind,annualRate:v.annualRate,asOf,days,estimatedContractGross:estimatedGross,marketValue,estimatedIncome:estimatedGross===null?null:decimal(estimatedGross-remaining,2),repaidPrincipal:decimal(paid,2),maturityDate:v.maturityDate,warning:asOf>v.maturityDate&&remaining>0?'Vencimento passado sem resgate integral informado; saldo exige conciliação com o extrato.':v.rateKind==='PREFIXED'?'Estimativa bruta por juros compostos ACT/365; confira cláusulas, impostos, liquidez, risco de crédito e valor de resgate real.':'Sem estimativa automática: indexador precisa de série histórica integral e regras do contrato.'};
}
export function fixedIncomeOverview(db,options={}){const rows=(db.fixedIncome||[]).map(p=>fixedIncomePosition(p,options));return {positions:rows,totalsByCurrency:Object.fromEntries([...new Set(rows.map(r=>r.currency))].map(c=>[c,{principal:Number(rows.filter(r=>r.currency===c).reduce((s,r)=>s+r.remainingPrincipal,0).toFixed(2)),knownAccrual:Number(rows.filter(r=>r.currency===c&&r.estimatedContractGross!==null).reduce((s,r)=>s+r.estimatedContractGross,0).toFixed(2)),unvalued:rows.filter(r=>r.currency===c&&r.estimatedContractGross===null).length}])),warning:'Não some estes valores à carteira de bolsa sem conferir eventuais registros duplicados. Moedas diferentes não são somadas automaticamente.'};}

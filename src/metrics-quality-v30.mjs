/** Metrics Quality: deterministic observations, never tax filing, orders or investment advice. */
import {calculatePositions,validDate} from './domain.mjs';
import {reconcileIncome} from './dividend-reconciliation.mjs';
const round=(v,d=2)=>Number(Number(v).toFixed(d));
const dateAge=(from,to)=>Math.floor((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
const validNumber=x=>typeof x==='number'&&Number.isFinite(x);
const limited=(s,n=180)=>String(s??'').slice(0,n);
const normalizeTicker=t=>String(t??'').trim().toUpperCase();
const types=new Set(['ACAO','FII','ETF','BDR','FIAGRO','FUND','FIXED_INCOME_BR','STOCK_FOREIGN','ETF_FOREIGN','BOND_FOREIGN','CASH','OTHER']);
const classFor=(ticker,inst,profiles)=>{
 const cl=inst.get(ticker)?.assetClass;
 if(cl&&types.has(cl))return cl;
 const p=profiles.get(ticker)?.type||'';
 if(p.startsWith('FII_'))return 'FII';
 if(p==='ACAO')return 'ACAO';
 if(p==='ETF')return 'ETF';
 return 'NAO_CLASSIFICADO';
};
const note=(severity,code,message,action,ticker='')=>({severity,code,message,action,ticker});

export function qualityReport30(db,{asOf=new Date().toISOString().slice(0,10)}={}){
 if(!validDate(asOf))throw Error('Data-base inválida.');
 const tx=(db.transactions||[]).filter(x=>x.date<=asOf),quotes=new Map((db.quotes||[]).filter(x=>x.date<=asOf).map(x=>[x.ticker,x]));
 const positions=calculatePositions(tx).filter(x=>x.quantity>0),profiles=new Map((db.profiles||[]).map(x=>[x.ticker,x])),instruments=new Map((db.instruments||[]).map(x=>[x.ticker,x]));
 const issues=[];let valued=0,unknown=0;
 for(const p of positions){
  const kind=classFor(p.ticker,instruments,profiles),q=quotes.get(p.ticker);
  if(kind==='NAO_CLASSIFICADO')issues.push(note('MEDIA','CLASSE_INDEFINIDA','Classe do ativo não documentada.','Cadastrar a classe em Analisar ou Classes.',p.ticker));
  if(!q||!validNumber(q.price)||q.price<=0){issues.push(note('ALTA','SEM_COTACAO','Falta cotação datada para avaliar o ativo.','Conectar API ou informar cotação com fonte e data.',p.ticker));unknown++;continue;}
  const age=dateAge(q.date,asOf);if(age>7)issues.push(note('MEDIA','PRECO_ANTIGO',`Cotação com ${age} dias de defasagem.`,'Atualizar a cotação e conferir a data-base.',p.ticker));
  valued+=p.quantity*q.price;
 }
 if((db.snapshots||[]).some(s=>s.asOf<=asOf)&&!(db.statementReviewsV28||[]).some(r=>r.reconciledByUser))issues.push(note('ALTA','CUSTODIA_SEM_CONCILIACAO','Existem extratos de custódia sem revisão documentada.','Conferir quantidade por ativo e período na Conciliação.'));
 if((db.events||[]).some(e=>e.kind==='CONFIRMADO'&&!String(e.source||'').toLowerCase().includes('cvm')))issues.push(note('MEDIA','ANUNCIO_NAO_CERTIFICADO','Eventos informados como confirmados podem não ter prova oficial.','Conferir o comunicado e manter o status de origem.'));
 if((db.transactions||[]).some(t=>['BUY','SELL'].includes(t.type)&&(!Number.isFinite(Number(t.fee))||Number(t.fee)===0)))issues.push(note('BAIXA','TAXAS_REVISAR','Algumas operações têm taxa zero ou desconhecida.','Verificar notas de corretagem, inclusive quando a taxa for realmente zero.'));
 if((db.fixedIncome||[]).some(x=>x.startDate<=asOf&&(x.redemptions||[]).filter(r=>r.date<=asOf).reduce((sum,r)=>sum+Number(r.principal||0),0)<Number(x.principal||0)))issues.push(note('ALTA','RENDA_FIXA_NAO_AVALIADA','Existem aplicações de renda fixa sem valor de resgate confirmado.','Conferir informe da instituição e possível dupla contagem.'));
 if((db.foreignTrades||[]).some(x=>x.date<=asOf))issues.push(note('ALTA','EXTERIOR_NAO_CONSOLIDADO','Operações internacionais não foram somadas à carteira BRL.','Conferir preço datado e câmbio efetivamente aplicado.'));
 const old=issues.filter(x=>x.severity==='ALTA').length;
 const summary={asOf,positions:positions.length,transactions:tx.length,priced:positions.length-unknown,unpriced:unknown,partiallyValuedBRL:round(valued),complete:positions.length>0&&unknown===0&&old===0,high:old,medium:issues.filter(x=>x.severity==='MEDIA').length};
 return {summary,issues:issues.slice(0,200),warning:'Cotação registrada não garante valor de mercado atual; relatório indicativo, sem certificação contábil ou fiscal.'};
}

/** Full coverage is compulsory; no partial market value is reported as a whole portfolio. */
export function allocationReport30(db,{asOf=new Date().toISOString().slice(0,10),targets={}}={}){
 if(!validDate(asOf))throw Error('Data-base inválida.');
 if(targets===null||typeof targets!=='object'||Array.isArray(targets)||Object.keys(targets).length>25)throw Error('Metas de alocação inválidas.');
 const t=new Map();let totalTarget=0;
 for(const [k,v] of Object.entries(targets)){const key=String(k).toUpperCase(),n=Number(v);if(!types.has(key)||!Number.isFinite(n)||n<0||n>100)throw Error('Meta inválida para '+key);t.set(key,n);totalTarget+=n;}
 if(t.size&&Math.abs(totalTarget-100)>0.01)throw Error('As metas precisam somar 100%.');
 const transactions=(db.transactions||[]).filter(x=>x.date<=asOf);
 const positions=calculatePositions(transactions).filter(p=>p.quantity>0);
 const profiles=new Map((db.profiles||[]).map(x=>[x.ticker,x]));
 const inst=new Map((db.instruments||[]).map(x=>[x.ticker,x]));
 const quote=new Map((db.quotes||[]).filter(q=>q.date<=asOf).map(q=>[q.ticker,q]));
 const classes=new Map(),missing=[];let total=0;
 for(const p of positions){const q=quote.get(p.ticker);if(!q||!Number.isFinite(q.price)||q.price<=0){missing.push({ticker:p.ticker,reason:'SEM_COTACAO'});continue;}
  const k=classFor(p.ticker,inst,profiles);if(k==='NAO_CLASSIFICADO'){missing.push({ticker:p.ticker,reason:'SEM_CLASSE'});continue;}
  if(inst.get(p.ticker)?.currency&&inst.get(p.ticker).currency!=='BRL'){missing.push({ticker:p.ticker,reason:'MOEDA_NAO_BRL'});continue;}
  const amount=p.quantity*q.price,existing=classes.get(k)||{assetClass:k,value:0,count:0};existing.value+=amount;existing.count++;classes.set(k,existing);total+=amount;
 }
 // Contracts are deliberately excluded until institution valuations and duplication are reconciled.
 const unpricedFixed=(db.fixedIncome||[]).filter(x=>x.startDate<=asOf&&(x.redemptions||[]).filter(r=>r.date<=asOf).reduce((sum,r)=>sum+Number(r.principal||0),0)<Number(x.principal||0));
 if(unpricedFixed.length)missing.push({ticker:'RENDA_FIXA',reason:'SEM_EXTRATO_DE_VALOR',count:unpricedFixed.length});
 if((db.foreignTrades||[]).some(x=>x.date<=asOf))missing.push({ticker:'EXTERIOR',reason:'CONVERSAO_CAMBIAL_E_AVALIACAO_PENDENTES'});
 const complete=missing.length===0&&positions.length>0;
 const items=[...classes.values()].map(x=>({assetClass:x.assetClass,amountBRL:round(x.value),count:x.count,weightPercent:complete?round(x.value/total*100,4):null,targetPercent:t.get(x.assetClass)??null,deviationPoints:complete&&t.has(x.assetClass)?round(x.value/total*100-t.get(x.assetClass),4):null})).sort((a,b)=>b.amountBRL-a.amountBRL);
 if(complete)for(const [cls,target] of t)if(!classes.has(cls))items.push({assetClass:cls,amountBRL:0,count:0,weightPercent:0,targetPercent:target,deviationPoints:-target});
 return {asOf,complete,totalBRL:complete?round(total):null,items,missing,warning:'Alocação parcial não é patrimônio consolidado. Metas são escolhas informadas pelo usuário, não recomendação de compra.'};
}

export function compareAssets30(db,{tickers=[],asOf=new Date().toISOString().slice(0,10)}={}){
 if(!Array.isArray(tickers)||tickers.length<2||tickers.length>6||!validDate(asOf))throw Error('Compare entre 2 e 6 ativos em data válida.');
 const selected=[...new Set(tickers.map(normalizeTicker))];if(selected.length<2||selected.some(t=>!/^[A-Z0-9.\-^:]{1,24}$/.test(t)))throw Error('Ativos para comparação inválidos.');
 const profiles=new Map((db.profiles||[]).map(x=>[x.ticker,x])),inst=new Map((db.instruments||[]).map(x=>[x.ticker,x])),quote=new Map((db.quotes||[]).filter(q=>q.date<=asOf).map(q=>[q.ticker,q]));
 const rows=selected.map(ticker=>{const p=profiles.get(ticker)||{},i=inst.get(ticker)||{},q=quote.get(ticker);return {ticker,name:limited(p.name||i.name||ticker),assetClass:classFor(ticker,inst,profiles),sector:limited(p.sector),price:validNumber(q?.price)?q.price:null,priceDate:q?.date||null,priceSource:limited(q?.source),dy12:validNumber(p.dy12)?p.dy12:null,dyDate:validDate(p.date)?p.date:null,dySource:limited(p.source),reportedEquity:validNumber(p.equity)?p.equity:null,missing:[!q?'COTACAO':null,!p.date?'DATA_FUNDAMENTOS':null,!p.source?'FONTE_FUNDAMENTOS':null].filter(Boolean)};});
 const comparableClass=rows.every(x=>x.assetClass===rows[0].assetClass&&x.assetClass!=='NAO_CLASSIFICADO');
 return {asOf,rows,comparableClass,warning:'Campos de datas ou classes diferentes não são uma comparação homogênea. Preço, DY e patrimônio têm fontes e competências independentes; não constitui recomendação.'};
}

export function reconcileReport30(db,{from='2000-01-01',to='2200-12-31'}={}){
 if(!validDate(from)||!validDate(to)||from>to)throw Error('Período de conciliação inválido.');
 const income=reconcileIncome(db,{from,to});
 const flows=(db.externalFlows||[]).filter(x=>x.date>=from&&x.date<=to);
 const statementReviews=(db.statementReviewsV28||[]).filter(x=>x.to>=from&&x.from<=to);
 const pending=income.events.filter(x=>x.status!=='CONCILIADO');
 const missingDocs=flows.filter(f=>!f.source||String(f.source).length<4||!f.documentHash).length;
 const imported=(db.imports||[]).filter(x=>!x.date||x.date>=from&&x.date<=to);
 const rows=income.events.slice(0,250).map(x=>({ticker:x.ticker,date:x.paymentDate,expected:x.expected,received:x.received,status:x.status,source:x.source,verification:x.verification}));
 return {from,to,income:{total:income.events.length,reconciled:income.events.length-pending.length,pending:pending.length,rows},externalFlows:{count:flows.length,withoutDocument:missingDocs},statementReviews:{count:statementReviews.length,accepted:statementReviews.filter(x=>x.reconciledByUser).length},imports:{batches:imported.length},blockers:[...(pending.length?[`${pending.length} proventos precisam de revisão.`]:[]),...(missingDocs?[`${missingDocs} fluxos sem documento vinculado.`]:[]),...(statementReviews.length===0?['Sem conciliação documental de custódia para o período.']:[])],warning:'Conciliação aritmética não comprova autenticidade de documentos nem recolhimento de impostos. Não são gerados lançamentos.'};
}

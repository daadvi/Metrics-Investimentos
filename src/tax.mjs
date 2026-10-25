/** Auditable tax assistant. No automatic DARF, classification is explicit and output is NOT tax advice. */
import {tickerOf,validateTransaction} from './domain.mjs';
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export function realizedLedger(transactions,profiles=[],{year}={}){
 const kinds=new Map(profiles.map(x=>[x.ticker,x.type]));
 const lots=new Map(),sales=[],income=[],issues=[];
 const sorted=[...transactions].sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt??'').localeCompare(String(b.createdAt??''))||String(a.id??'').localeCompare(String(b.id??'')));
 const seenToday=new Set();
 for(const x of sorted){
  const t=validateTransaction(x),ticker=tickerOf(t.ticker),kind=kinds.get(ticker)||'NAO_CLASSIFICADO';
  const isFii=['FII_TIJOLO','FII_PAPEL','FII_HIBRIDO'].includes(kind);
  const isStock=kind==='ACAO';
  if(['DIVIDEND','JCP','AMORTIZATION'].includes(t.type)){
   income.push({date:t.date,ticker,kind,amount:t.amount,nature:t.type,verified:false,taxReview:t.type==='AMORTIZATION'?'Amortização exige conferência do ajuste do custo fiscal':'Natureza e tributação exigem informe oficial'});
   if(t.type==='AMORTIZATION'&&t.adjustCost){const held=lots.get(ticker)||{quantity:0,cost:0};if(t.amount>held.cost+0.005)throw Error('Amortização excede custo fiscal registrado.');held.cost=Math.max(0,held.cost-t.amount);lots.set(ticker,held);issues.push(`Amortização ${ticker} com redução de custo confirmada pelo usuário; conferir documentação da fonte pagadora.`);}
   continue;
  }
  const p=lots.get(ticker)||{quantity:0,cost:0};
  if(t.type==='BUY'){p.quantity+=t.quantity;p.cost+=t.quantity*t.price+t.fee;}
  if(['SPLIT','REVERSE_SPLIT'].includes(t.type)){if(p.quantity<=0)throw Error('Desdobramento/grupamento sem saldo anterior: '+ticker);p.quantity=round((p.quantity*t.factor)*1e8)/1e8;issues.push(`Evento societário de ${ticker} registrado em ${t.date}; conferir tratamento de frações e custo fiscal.`);}
  if(t.type==='BONUS'){if(p.quantity<=0)throw Error('Bonificação sem saldo anterior: '+ticker);p.quantity+=t.quantity;p.cost+=t.basis||0;issues.push(`Bonificação de ${ticker}: custo fiscal informado pelo usuário, exige informe da companhia.`);}
  if(t.type==='SELL'){
   if(t.quantity>p.quantity+1e-8)throw Error(`Venda excede saldo de ${ticker} em ${t.date}.`);
   const priorAvg=p.cost/p.quantity,allocatedCost=priorAvg*t.quantity;
   const gross=round(t.quantity*t.price),net=round(gross-t.fee),gain=round(net-allocatedCost);
   const sameDay=seenToday.has(t.date+'|'+ticker);
   sales.push({date:t.date,month:t.date.slice(0,7),ticker,kind,quantity:t.quantity,gross,fees:t.fee,allocatedCost:round(allocatedCost),net,gain,isFii,isStock,classificationComplete:isFii||isStock,possibleDayTrade:sameDay});
   p.quantity=round((p.quantity-t.quantity)*1e8)/1e8;p.cost-=allocatedCost;
   if(p.quantity<=1e-9){p.quantity=0;p.cost=0;}
  }
  seenToday.add(t.date+'|'+ticker);
  lots.set(ticker,p);
 }
 const yearString=year==null?'':String(year);
 if(yearString&&!/^\d{4}$/.test(yearString))throw Error('Ano inválido.');
 const yearSales=yearString?sales.filter(x=>x.date.startsWith(yearString)):sales;
 const yearIncome=yearString?income.filter(x=>x.date.startsWith(yearString)):income;
 if(yearIncome.some(x=>x.nature==='AMORTIZATION'))issues.push('Amortização de capital registrada separadamente; conferir necessidade de ajuste do custo fiscal e informes da fonte pagadora.');
 if(yearIncome.some(x=>x.nature==='JCP'))issues.push('JCP separado dos dividendos; conferir retenção e informe de rendimentos.');
 const byMonth=new Map();
 for(const s of yearSales){const k=s.month+'|'+s.kind;const m=byMonth.get(k)||{month:s.month,kind:s.kind,volume:0,gain:0,loss:0,netResult:0,count:0};m.volume=round(m.volume+s.gross);m.netResult=round(m.netResult+s.gain);if(s.gain>=0)m.gain=round(m.gain+s.gain);else m.loss=round(m.loss+s.gain);m.count++;byMonth.set(k,m);}
 const incomplete=yearSales.filter(x=>!x.classificationComplete).map(x=>x.ticker);
 if(incomplete.length)issues.push('Classifique os ativos vendidos em Analisar antes de qualquer apuração tributária: '+[...new Set(incomplete)].join(', '));
 if(yearSales.some(x=>x.possibleDayTrade))issues.push('Há operações de compra e venda do mesmo ticker no mesmo dia; separar day trade exige notas e horários, indisponíveis nos dados atuais.');
 issues.push('Sem ajuste de grupamentos, bonificações, amortizações e desdobramentos: confira eventos corporativos e custos fiscais.');
 issues.push('Sem IRRF, prejuízos de anos anteriores, posição fiscal de abertura e regras específicas: não calcular DARF com este relatório.');
 issues.push('Proventos lançados manualmente precisam ser conciliados com informes oficiais; a natureza fiscal não é validada automaticamente.');
 issues.push('O resultado de cada venda é calculado pelo preço médio dos lançamentos existentes; transações anteriores ausentes alteram os números.');
 return {year:yearString||'todos',sales:yearSales,income:yearIncome,monthly:[...byMonth.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.kind.localeCompare(b.kind)),issues,totals:{sold:round(yearSales.reduce((s,x)=>s+x.gross,0)),result:round(yearSales.reduce((s,x)=>s+x.gain,0)),proceeds:round(yearIncome.reduce((s,x)=>s+x.amount,0))},rules:[{group:'FII',note:'Vendas em bolsa: alíquota nominal de 20% sobre ganhos líquidos sujeitos à apuração, conforme Receita Federal; não calcular imposto sem compensações, IRRF e conciliação.'},{group:'Ações',note:'Operações comuns e day trade têm regras distintas; isenção mensal de até R$ 20 mil de vendas de ações à vista quando aplicável.'}],officialReferences:['https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1','https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/fundos-de-investimento-no-brasil']};
}

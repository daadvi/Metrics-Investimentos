import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBrapiQuotes,fetchBrapiQuotes} from '../src/market-feed.mjs';
import {valuationAt,historyReport,benchmarkBetween,parseDailyBenchmarkCSV} from '../src/portfolio-history.mjs';
import {parseB3NegotiationText} from '../src/pdf.mjs';
import {interpretTables} from '../src/importers.mjs';
import {parseBCBCDI,fetchBCBCDI} from '../src/benchmark.mjs';
import {fiscalReadiness} from '../src/insights.mjs';
import {callReadOnlyTool} from '../src/ai-tools.mjs';
const t=(date,type,quantity=0,price=0,amount=0,ticker='MXRF11')=>({date,type,quantity,price,amount,ticker,fee:0});
const sample=()=>({transactions:[t('2026-01-02','BUY',10,10)],watchlist:[],quotes:[],quoteHistory:[{ticker:'MXRF11',date:'2026-01-02',price:10,source:'histórico teste'},{ticker:'MXRF11',date:'2026-01-05',price:11,source:'histórico teste'}],benchmarkCDI:[{date:'2026-01-05',rate:.05}],snapshots:[],profiles:[],events:[],documents:[]});
test('v0.6 cotação brapi com data e origem verificáveis',()=>{const x=parseBrapiQuotes({results:[{symbol:'MXRF11',regularMarketPrice:10.56,regularMarketTime:'2026-10-23T16:00:00.000Z'}]},{retrievedAt:'2026-10-24T08:00:00Z',expected:['MXRF11']});assert.equal(x.quotes[0].date,'2026-10-23');assert.equal(x.quotes[0].price,10.56);assert.match(x.warning,/atraso/i);});
test('v0.6 feed não afirma data da cotação quando provedor omite',()=>{assert.throws(()=>parseBrapiQuotes({results:[{symbol:'MXRF11',regularMarketPrice:10.56}]},{expected:['MXRF11']}),/Não foi encontrada cotação/);});
test('v0.6 chave de mercado não é persistida e endpoint tem host fixo',async()=>{let url,header;const fetchImpl=async(u,o)=>{url=u;header=o.headers.Authorization;return {ok:true,json:async()=>({results:[{symbol:'MXRF11',regularMarketPrice:9.3,regularMarketTime:'2026-10-22T18:00:00Z'}]})};};const x=await fetchBrapiQuotes({tickers:['MXRF11'],key:'token-seguro-1234',fetchImpl,now:new Date('2026-10-24T10:00:00Z')});assert.equal(url,'https://brapi.dev/api/quote/MXRF11');assert.equal(header,'Bearer token-seguro-1234');assert.equal(x.quotes[0].date,'2026-10-22');assert.equal(JSON.stringify(x).includes('token-seguro'),false);});
test('v0.6 consulta externa sem chave recusa ativos pagos',async()=>{await assert.rejects(fetchBrapiQuotes({tickers:['MXRF11']}),/configure sua chave/);});
test('v0.6 preço atual sem histórico não vira rentabilidade fictícia',()=>{const x=sample();x.quoteHistory=[];assert.equal(historyReport(x).approximateTwrPercent,null);assert.equal(valuationAt(x,'2026-01-05').complete,false);});
test('v0.6 carteira com cotações completas e sem aportes calcula retorno observado',()=>{const h=historyReport(sample());assert.equal(h.completeDays,2);assert.equal(h.approximateTwrPercent,10);assert.equal(h.lastComplete.value,110);});
test('v0.6 novo aporte não é contado como lucro',()=>{const x=sample();x.transactions.push(t('2026-01-05','BUY',10,11));x.quoteHistory[1].price=11;const h=historyReport(x);assert.equal(h.lastComplete.value,220);assert.equal(h.approximateTwrPercent,10);});
test('v0.6 cotação parcial não gera valor patrimonial total',()=>{const x=sample();x.transactions.push(t('2026-01-02','BUY',1,20,0,'GGRC11'));assert.equal(valuationAt(x,'2026-01-05').value,null);assert.equal(historyReport(x).approximateTwrPercent,null);});
test('v0.6 CDI exige datas fornecidas e taxa diária',()=>{const csv='data;valor\n05/01/2026;0,05\n06/01/2026;0,04';const data=parseDailyBenchmarkCSV(csv);assert.equal(data.length,2);assert.ok(benchmarkBetween(data,'2026-01-02','2026-01-06').cumulativePercent>=.09);assert.equal(benchmarkBetween(data,'2026-01-06','2026-01-07'),null);});
test('v0.6 BACEN responde CDI com referência explicitada',async()=>{const r=await fetchBCBCDI({from:'2026-01-02',to:'2026-01-10',fetchImpl:async url=>({ok:true,text:async()=>JSON.stringify([{data:'05/01/2026',valor:'0.05'}])})});assert.equal(r.data[0].rate,.05);assert.match(r.url,/bcdata\.sgs\.12/);});
test('v0.6 negociação em PDF explicita data preço e quantidade',()=>{const tx=parseB3NegotiationText('Data do Negócio Movimentação Código Preço\n04/10/2026 Compra Mercado a vista ABCD11 10 9,30 93,00\n05/10/2026 Venda Mercado a vista ABCD11 5 10,00 50,00');assert.equal(tx.kind,'transactions');assert.equal(tx.operations.length,2);assert.equal(tx.operations[0].date,'2026-10-04');assert.equal(tx.operations[1].type,'SELL');});
test('v0.6 PDF de posição sem negociação não fabrica data de compra',()=>{const tx=parseB3NegotiationText('Extrato de Posição em 24/10/2026\nMXRF11 100 9,30');assert.equal(tx.kind,'document');assert.equal(tx.operations.length,0);});
test('v0.6 layout de Excel negociação com cabeçalho B3 identificado',()=>{const tx=interpretTables([{sheet:'Negociacao',rows:[['Data do Negócio','Tipo de Movimentação','Código de Negociação','Quantidade','Preço','Valor'],['04/10/2026','Compra','MXRF11','10','9,30','93,00']]}]);assert.equal(tx.operations.length,1);assert.equal(tx.operations[0].date,'2026-10-04');assert.equal(tx.operations[0].price,9.3);});
test('v0.6 IR evidencia diferenças entre custódia e histórico',()=>{const x=sample();x.snapshots=[{asOf:'2026-12-31',positions:[{ticker:'MXRF11',quantity:100}]}];const r=fiscalReadiness(x,'2026');assert.equal(r.annualStatementCompared,true);assert.equal(r.annualDiscrepancies.length,1);assert.equal(r.readiness,'REVISÃO_OBRIGATÓRIA');});
test('v0.6 IA pergunta rentabilidade sem inventar CDI',()=>{const x=sample();const r=callReadOnlyTool('metrics_get_rentabilidade_historica',{},x);assert.equal(r.approximateTwrPercent,10);assert.ok(r.benchmark);});

test('v0.6 índice IFIX histórico usa pontos datados e só compara com cobertura',async()=>{
 const {parseIndexCSV,indexBetween}=await import('../src/portfolio-history.mjs');
 const points=parseIndexCSV('data;valor\n02/01/2026;3.100,00\n05/01/2026;3.255,00');
 assert.equal(points[0].value,3100);
 assert.equal(indexBetween(points,'2026-01-02','2026-01-05').cumulativePercent,5);
 assert.equal(indexBetween(points,'2026-01-02','2026-03-05'),null);
});
test('v0.6 IPCA compara apenas meses divulgados',async()=>{
 const {monthlyIndexBetween}=await import('../src/portfolio-history.mjs');
 const points=[{date:'2026-01-01',rate:.5},{date:'2026-02-01',rate:.4}];
 const x=monthlyIndexBetween(points,'2026-01-15','2026-02-28');
 assert.equal(x.months,1);assert.equal(x.cumulativePercent,.4);
});
test('v0.6 parser oficial SGS IPCA documenta série',async()=>{
 const {fetchBCBIPCA}=await import('../src/benchmark.mjs');
 const x=await fetchBCBIPCA({from:'2026-01-01',to:'2026-02-28',fetchImpl:async()=>({ok:true,text:async()=>JSON.stringify([{data:'01/02/2026',valor:'0.42'}])})});
 assert.equal(x.data[0].rate,.42);assert.match(x.url,/bcdata\.sgs\.433/);
});
test('v0.6 IR sinaliza taxas faltantes e custódia incompatível',()=>{
 const db=sample();db.transactions[0].source='b3';db.snapshots=[{asOf:'2026-12-31',positions:[{ticker:'GGRC11',quantity:2}]}];
 const r=fiscalReadiness(db,'2026');assert.ok(r.issues.some(x=>/custos\/taxas/i.test(x)));assert.equal(r.annualDiscrepancies.length,2);assert.equal(r.figuresAreDeclared,false);
});

test('v0.6 histórico com intervalo sem preços não cria retorno acumulado fictício',()=>{
 const db=sample();db.quoteHistory.push({ticker:'MXRF11',date:'2026-02-05',price:15});
 const report=historyReport(db);assert.equal(report.approximateTwrPercent,null);assert.equal(report.skippedIntervals,1);
});

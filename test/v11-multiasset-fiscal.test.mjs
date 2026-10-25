import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInstrument,validateFixedIncome,fixedIncomePosition} from '../src/instrument-classes.mjs';
import {validateForeignTrade,foreignPositions} from '../src/foreign-ledger.mjs';
import {validateFxQuote,parsePtax,fetchPtax,convertToBRL} from '../src/fx.mjs';
import {taxDossier,validateTaxEvidence} from '../src/tax-dossier.mjs';
import {validateNotice} from '../src/issuer-notices.mjs';
import {callReadOnlyTool,readOnlyTools} from '../src/ai-tools.mjs';
const buy={ticker:'MXRF11',type:'BUY',date:'2025-01-01',quantity:10,price:10,fee:0};
test('classificação separa classes e moedas, sem fabricar preços',()=>{
 assert.equal(validateInstrument({ticker:'AAPL',assetClass:'STOCK_FOREIGN',currency:'USD'}).currency,'USD');
 assert.throws(()=>validateInstrument({ticker:'AAPL',assetClass:'STOCK_FOREIGN',currency:'BTC'}),/Moeda/);
 assert.throws(()=>validateInstrument({ticker:'AAPL',assetClass:'not-a-class'}),/Classe/);
});
test('contrato prefixado produz estimativa bruta, não cotação',()=>{
 const input={ticker:'CDB2029',principal:1000,startDate:'2025-01-01',maturityDate:'2027-01-01',rateKind:'PREFIXED',annualRate:10};
 const x=fixedIncomePosition(input,{asOf:'2026-01-01'});assert.ok(x.estimatedContractGross>1099&&x.estimatedContractGross<1101);assert.equal(x.marketValue,null);
 assert.match(x.warning,/Estimativa bruta/);
});
test('pós-fixado não tem estimativa inventada',()=>{
 const x=fixedIncomePosition({ticker:'CDB01',principal:1000,startDate:'2025-01-01',maturityDate:'2027-01-01',rateKind:'CDI_PERCENT',annualRate:110},{asOf:'2026-01-01'});
 assert.equal(x.estimatedContractGross,null);
});
test('resgates parciais diminuem principal e são validados',()=>{
 const input={ticker:'LCI2027',principal:1000,startDate:'2025-01-01',maturityDate:'2027-01-01',rateKind:'PREFIXED',annualRate:10,redemptions:[{date:'2025-06-01',principal:400,received:420}]};
 assert.equal(fixedIncomePosition(input,{asOf:'2026-01-01'}).remainingPrincipal,600);
 assert.throws(()=>validateFixedIncome({...input,redemptions:[{date:'2026-01-01',principal:1001,received:1001}]}),/excedem/);
});
test('livro internacional separa USD e EUR, não converte automaticamente',()=>{
 const trades=[{ticker:'AAPL',currency:'USD',date:'2025-01-01',type:'BUY',quantity:3,price:100},{ticker:'AAPL',currency:'USD',date:'2025-04-01',type:'SELL',quantity:1,price:120},{ticker:'AAPL',currency:'EUR',date:'2025-05-01',type:'BUY',quantity:1,price:90}];
 const pos=foreignPositions(trades);assert.equal(pos.length,2);assert.equal(pos.find(x=>x.currency==='USD').quantity,2);assert.equal(pos.find(x=>x.currency==='USD').realizedNative,20);
 assert.throws(()=>foreignPositions([{ticker:'AAPL',currency:'USD',date:'2025-02-01',type:'SELL',quantity:3,price:100}]),/excede/);
});
test('PTAX só com taxa datada e fonte, sem extrapolar câmbio',()=>{
 const rates=parsePtax({value:[{dataHoraCotacao:'2026-10-21 13:05:00.000',cotacaoVenda:5.5}]},{currency:'USD'});
 assert.equal(rates[0].date,'2026-10-21');assert.equal(rates[0].rate,5.5);
 const v=convertToBRL(100,'USD','2026-10-22',rates);assert.equal(v.converted,550);assert.equal(v.rateDate,'2026-10-21');
 assert.equal(convertToBRL(100,'USD','2026-11-30',rates).converted,null);
 assert.equal(convertToBRL(100,'EUR','2026-10-22',rates).reason,'SEM_CAMBIO_NA_DATA');
});
test('consulta PTAX HTTPS oficial pode ser testada por adaptador, sem tráfego externo',async()=>{
 let called;
 const r=await fetchPtax({currency:'USD',from:'2026-10-20',to:'2026-10-23',fetchImpl:async url=>{called=url;return {ok:true,text:async()=>JSON.stringify({value:[{dataHoraCotacao:'2026-10-21 13:05:00',cotacaoVenda:5.25}]})};}});
 assert.ok(called.startsWith('https://olinda.bcb.gov.br/'));assert.equal(r.quotes.length,1);assert.equal(r.quotes[0].rate,5.25);
});
test('prova fiscal precisa de ano, natureza e fonte',()=>{
 assert.equal(validateTaxEvidence({year:2025,ticker:'MXRF11',nature:'DIVIDEND',amount:10,source:'Informe X 2025'}).amount,10);
 assert.throws(()=>validateTaxEvidence({year:2025,ticker:'MXRF11',nature:'FAKE',amount:10,source:'Informe X 2025'}),/Natureza/);
});
test('dossiê fiscal reconcilia valores registrados e informes mas não certifica declaração',()=>{
 const db={transactions:[buy,{ticker:'MXRF11',type:'DIVIDEND',date:'2025-03-01',amount:10}],profiles:[],fixedIncome:[],instruments:[],snapshots:[],taxEvidence:[{year:2025,ticker:'MXRF11',nature:'DIVIDEND',amount:10,source:'Informe X',verified:true}]};
 const r=taxDossier(db,2025);assert.equal(r.incomeDiscrepancies[0].status,'CONCILIADO_ARITMETICAMENTE');assert.equal(r.readyForFiling,false);assert.ok(r.blockers.length>0);
 db.taxEvidence[0].amount=11;assert.equal(taxDossier(db,2025).incomeDiscrepancies[0].status,'DIVERGENTE');
});
test('proventos em moedas distintas ou renda fixa geram alertas fiscais específicos',()=>{
 const db={transactions:[],profiles:[],fixedIncome:[{ticker:'CDB1',principal:100,startDate:'2025-01-01',maturityDate:'2027-01-01',rateKind:'PREFIXED',annualRate:12}],foreignTrades:[{ticker:'AAPL',currency:'USD',type:'BUY',date:'2025-05-01',quantity:1,price:100}],instruments:[],taxEvidence:[]};
 const r=taxDossier(db,2025);assert.ok(r.blockers.some(x=>x.includes('Renda fixa')));assert.ok(r.blockers.some(x=>x.includes('internacionais')));
});
test('comunicações cadastradas nunca são auto-verificadas',()=>{
 const x=validateNotice({ticker:'MXRF11',date:'2026-10-24',title:'Pagamento de rendimento',source:'Gestora X',url:'https://example.org/report'});assert.equal(x.verifiedAutomatically,false);
 assert.throws(()=>validateNotice({ticker:'MXRF11',date:'2026-10-24',title:'Pagamento de rendimento',source:'Fonte X',url:'http://127.0.0.1/foo'}),/HTTPS/);
});
test('IA tem funções somente de leitura para classes, dossiê e câmbio',()=>{
 const n=readOnlyTools.map(t=>t.function.name);assert.ok(n.includes('metrics_consultar_classes'));assert.ok(n.includes('metrics_conciliar_ir'));assert.ok(n.includes('metrics_converter_cambio'));
 const db={transactions:[],profiles:[],watchlist:[],events:[],snapshots:[],quotes:[],fixedIncome:[],foreignTrades:[],instruments:[],taxEvidence:[],fxRates:[]};assert.equal(callReadOnlyTool('metrics_consultar_classes',{},db).foreignPositions.length,0);assert.equal(callReadOnlyTool('metrics_converter_cambio',{amount:100,currency:'USD',date:'2026-10-24'},db).converted,null);
});

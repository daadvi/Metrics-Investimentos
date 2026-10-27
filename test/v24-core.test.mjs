import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOfficialIPE,detectDividendTerms,consolidatedWealth,consolidatedEvolution,fiscalByYear,validateExternalFlow,validateValuation,validateProfessionalReview} from '../src/metrics-v24.mjs';

const helpers={
 calculatePositions:tx=>tx.filter(x=>x.type==='BUY').map(x=>({ticker:x.ticker,quantity:x.quantity,cost:x.quantity*x.price})),
 foreignPositions:tx=>tx.filter(x=>x.type==='BUY').map(x=>({ticker:x.ticker,quantity:x.quantity,currency:x.currency,cost:x.quantity*x.price})),
 fixedIncomePosition:(f)=>({remainingPrincipal:f.principal,estimatedContractGross:null})
};
test('validação rejeita valor sem fonte, data inválida e simulação fiscal sem documento',()=>{
 assert.throws(()=>validateExternalFlow({date:'2026-10-25',type:'DEPOSIT',amount:1,currency:'BRL',source:'x'}));
 assert.throws(()=>validateValuation({date:'2026-02-30',assetClass:'CASH',assetKey:'CONTA_01',currency:'BRL',value:0,source:'Extrato'}));
 assert.throws(()=>validateProfessionalReview({year:2026,reviewer:'Ana',basis:'Teste',decision:'EVIDENCE_REVIEWED',documentId:'a'}));
 assert.equal(validateValuation({date:'2026-10-25',assetClass:'CASH',assetKey:'CONTA_01',currency:'BRL',value:0,source:'Extrato bancário'}).value,0);
});
test('origem permitida IPE com hash e termos, sem comprovar evento ou crédito',async()=>{
 const s='Comunicado: data-com: 20/10/2026. Data de pagamento: 30/10/2026. R$ 0,10 por cota.';
 const row={ticker:'MXRF11',cnpj:'11111111000111',documentId:'999',deliveryDate:'2026-10-10',category:'Aviso aos cotistas',title:'Rendimentos',sourceUrl:'https://www.rad.cvm.gov.br/ENET/documento.txt'};
 const r=await inspectOfficialIPE({ipeIndex:[row]},{documentId:'999',ticker:'MXRF11',sourceUrl:row.sourceUrl,fetchImpl:async()=>({ok:true,status:200,redirected:false,headers:new Headers({'content-type':'text/plain'}),body:(async function*(){yield Buffer.from(s);})()})});
 assert.equal(r.terms.recordDate,'2026-10-20');assert.equal(r.terms.paymentDate,'2026-10-30');assert.equal(r.terms.perUnit,0.1);
 assert.equal(r.verifiedAutomatically,false);assert.equal(r.reviewStatus,'PENDING');assert.equal(r.sha256.length,64);
});
test('bloqueia host falso e redirecionamento antes de processar fonte',async()=>{
 const row={ticker:'ABCD4',documentId:'x',category:'Aviso aos acionistas',title:'Dividendo',sourceUrl:'https://cvm.gov.br.evil.test/pdf'};
 await assert.rejects(inspectOfficialIPE({ipeIndex:[row]},{documentId:'x',ticker:'ABCD4',sourceUrl:row.sourceUrl,fetchImpl:()=>{throw Error('não deveria consultar');}}));
 const good={...row,sourceUrl:'https://www.cvm.gov.br/a.pdf'};
 await assert.rejects(inspectOfficialIPE({ipeIndex:[good]},{documentId:'x',ticker:'ABCD4',sourceUrl:good.sourceUrl,fetchImpl:async()=>({ok:false,status:302,redirected:true})}));
});
test('extração ambígua não produz data ou valor único',()=>{
 const t=detectDividendTerms('data-com 20/10/2026 data-com 21/10/2026 pagamento em 30/10/2026 R$ 0,10 por cota');
 assert.equal(t.ambiguous,true);assert.equal(t.recordDate,null);
});
test('patrimônio sem preço vira total incompleto, parcela conhecida não é total',()=>{
 const db={transactions:[{type:'BUY',date:'2026-01-03',ticker:'ABC3',quantity:2,price:10}],externalFlows:[],assetValuations:[],quoteHistory:[]};
 const r=consolidatedWealth(db,{asOf:'2026-10-25',...helpers});assert.equal(r.complete,false);assert.equal(r.totalBRL,null);assert.ok(r.missing.some(x=>x.assetClass==='CASH'));assert.ok(r.missing.some(x=>x.assetKey==='ABC3'));
});
test('caixa documentado como zero mantém patrimônio completo e depósitos não dobram ativos',()=>{
 const db={transactions:[{type:'BUY',date:'2026-10-20',ticker:'ABC3',quantity:2,price:10}],externalFlows:[{type:'DEPOSIT',date:'2026-10-20',currency:'BRL',amount:200}],assetValuations:[{id:'cash-a',assetClass:'CASH',assetKey:'CORRETORA_1',currency:'BRL',date:'2026-10-25',value:0,source:'Extrato'}],quoteHistory:[{ticker:'ABC3',date:'2026-10-25',price:15,source:'Bolsa'}]};
 const r=consolidatedWealth(db,{asOf:'2026-10-25',...helpers});assert.equal(r.complete,true);assert.equal(r.totalBRL,30);assert.equal(r.externalFlows.netBRLRecorded,200);
});
test('não soma USD sem PTAX datada; converte USD apenas com taxa explícita',()=>{
 const db={transactions:[],foreignTrades:[{type:'BUY',date:'2026-10-10',ticker:'XYZ',currency:'USD',quantity:2,price:10}],foreignMarketQuotes:[{ticker:'XYZ',currency:'USD',date:'2026-10-24',price:12,source:'provedor'}],assetValuations:[{id:'cash-b',assetClass:'CASH',assetKey:'CONTA_BR',currency:'BRL',date:'2026-10-25',value:0,source:'Extrato'}],fxRates:[]};
 const first=consolidatedWealth(db,{asOf:'2026-10-25',...helpers});assert.equal(first.totalBRL,null);db.fxRates=[{currency:'USD',date:'2026-10-24',rate:5,source:'PTAX',type:'PTAX_SELL'}];const second=consolidatedWealth(db,{asOf:'2026-10-25',...helpers});assert.equal(second.totalBRL,120);
});
test('evolução mensal não preenche lacunas artificiais',()=>{
 const db={transactions:[{type:'BUY',date:'2026-10-01',ticker:'ABC3',quantity:1,price:1}],quoteHistory:[{ticker:'ABC3',date:'2026-10-25',price:2,source:'registrado'}]};const r=consolidatedEvolution(db,{asOf:'2026-10-25',months:2,...helpers});assert.equal(r.points[0].totalBRL,null);assert.equal(r.completePoints,0);
});
test('dossiê fiscal separa ano-calendário, referência ao parecer e bloqueia DARF',()=>{
 const db={transactions:[{type:'SELL',date:'2026-05-20',ticker:'ABC3',quantity:1,price:20}]};
 const r=fiscalByYear(db,2026,{taxDossier:()=>({blockers:['IRRF pendente'],incomeDiscrepancies:[],positions:[],foreignAssets:[],otherAssets:[],statementDate:null}),realizedLedger:()=>({sales:[{month:'2026-05',gross:20,gain:5,isStock:true,isFii:false,classificationComplete:true,possibleDayTrade:false}],totals:{result:5}})});
 assert.equal(r.reportingYear,2027);assert.equal(r.months[4].netRealizedBRL,5);assert.equal(r.taxPayable,null);assert.equal(r.readyForFiling,false);assert.ok(r.blockers.some(x=>x.includes('Parecer')));
});
test('um extrato de caixa vencido não vira saldo atual fictício',()=>{
 const db={transactions:[],assetValuations:[{id:'old',assetClass:'CASH',assetKey:'CONTA_01',currency:'BRL',date:'2026-01-10',value:500,source:'Extrato antigo'}]};
 const r=consolidatedWealth(db,{asOf:'2026-10-25',...helpers});assert.equal(r.totalBRL,null);assert.ok(r.missing.some(x=>x.assetClass==='CASH'));
});
test('falha quando houver avaliação duplicada em OUTROS e posição de bolsa',()=>{
 const db={transactions:[{type:'BUY',date:'2026-10-21',ticker:'ABC3',quantity:1,price:10}],quoteHistory:[{ticker:'ABC3',date:'2026-10-25',price:10,source:'Preço'}],assetValuations:[{id:'cash',assetClass:'CASH',assetKey:'CONTA01',currency:'BRL',date:'2026-10-25',value:0,source:'Extrato'},{id:'other',assetClass:'OTHER',assetKey:'ABC3',currency:'BRL',date:'2026-10-25',value:999,source:'Planilha manual'}]};
 const r=consolidatedWealth(db,{asOf:'2026-10-25',...helpers});assert.equal(r.complete,false);assert.equal(r.totalBRL,null);assert.equal(r.partialKnownBRL,10);
});

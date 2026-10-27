import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {consolidatedWealth,consolidatedEvolution,auditQuality25} from '../src/metrics-v24.mjs';

const helpers={
 calculatePositions:tx=>tx.filter(x=>x.type==='BUY').map(x=>({ticker:x.ticker,quantity:x.quantity,cost:x.price*x.quantity})),
 foreignPositions:tx=>tx.filter(x=>x.type==='BUY').map(x=>({ticker:x.ticker,currency:x.currency,quantity:x.quantity,cost:x.price*x.quantity})),
 fixedIncomePosition:f=>({remainingPrincipal:f.principal,estimatedContractGross:null})
};
const day='2026-10-25';
const cash=(assetKey,date,value=0)=>({id:assetKey+'-'+date,assetClass:'CASH',assetKey,currency:'BRL',date,value,source:'Extrato bancário datado'});
test('avaliação stale OUTROS sem cadastro nunca desaparece silenciosamente',()=>{
 const db={assetValuations:[cash('CONTA_A',day),{id:'other',assetClass:'OTHER',assetKey:'COLECAO_A',currency:'BRL',date:'2025-01-05',value:1000,source:'Comprovante antigo'}]};
 const a=consolidatedWealth(db,{asOf:day,...helpers});
 assert.equal(a.totalBRL,null);assert.equal(a.partialKnownBRL,0);
 assert.equal(a.positions.find(p=>p.assetKey==='COLECAO_A').valueBRL,null);
 assert.ok(a.missing.some(x=>x.assetKey==='COLECAO_A'));
});
test('caixa vencido continua visível como pendência e não como zero',()=>{
 const db={assetValuations:[cash('CONTA_A','2026-01-03',100)]};const a=consolidatedWealth(db,{asOf:day,...helpers});
 assert.equal(a.totalBRL,null);assert.equal(a.positions[0].assetKey,'CONTA_A');assert.equal(a.positions[0].valueBRL,null);
});
test('duas contas de caixa distintas somam corretamente, avaliação mais recente vence',()=>{
 const db={assetValuations:[cash('CONTA_A','2026-10-20',300),cash('CONTA_A',day,200),cash('CONTA_B',day,500)]};const a=consolidatedWealth(db,{asOf:day,...helpers});
 assert.equal(a.complete,true);assert.equal(a.totalBRL,700);assert.equal(a.positions.length,2);
});
test('nenhum preço futuro entra no valor de ontem',()=>{
 const db={transactions:[{ticker:'ABC3',type:'BUY',quantity:1,price:1,date:'2026-10-20'}],quoteHistory:[{ticker:'ABC3',date:'2026-10-26',price:999}],assetValuations:[cash('CONTA_A',day)]};const a=consolidatedWealth(db,{asOf:day,...helpers});
 assert.equal(a.totalBRL,null);assert.ok(a.missing.some(x=>x.assetKey==='ABC3'));
});
test('a composição mantém saldo zero explícito e marca ativos registrados sem avaliação',()=>{
 const db={instruments:[{ticker:'ARTE01',assetClass:'OTHER',currency:'BRL'}],assetValuations:[cash('CONTA_A',day)]};const a=consolidatedWealth(db,{asOf:day,...helpers});
 assert.equal(a.positions.find(p=>p.assetClass==='CASH').valueBRL,0);assert.equal(a.totalBRL,null);
 assert.ok(a.positions.some(p=>p.assetKey==='ARTE01'&&p.valueBRL===null));
});
test('FX com data futura não pode ser usado retroativamente',()=>{
 const db={foreignTrades:[{date:'2026-10-01',type:'BUY',ticker:'ABC',currency:'USD',price:2,quantity:1}],foreignMarketQuotes:[{ticker:'ABC',currency:'USD',date:day,price:10,source:'Fornecedor'}],fxRates:[{currency:'USD',date:'2026-10-26',rate:9}],assetValuations:[cash('CONTA_A',day)]};
 const a=consolidatedWealth(db,{asOf:day,...helpers});assert.equal(a.totalBRL,null);
});
test('auditoria dá prioridades baseadas em dados reais, sem vazar lançamentos',()=>{
 const db={transactions:[{date:'2026-10-01',type:'BUY',ticker:'ABC3',quantity:1,price:5}],assetValuations:[cash('CONTA_A',day)]};
 const r=auditQuality25(db,{asOf:day,...helpers});assert.equal(r.complete,false);assert.ok(r.priorities.some(x=>x.severity==='HIGH'));
 assert.equal(Object.hasOwn(r,'transactions'),false);assert.equal(r.counters.transactions,1);
});
test('índices reusados mantêm 120 meses com lacunas e sem inventar retornos',()=>{
 const db={transactions:[{ticker:'A',type:'BUY',quantity:1,price:10,date:'2026-10-01'}],assetValuations:[cash('CONTA_A',day)]};const r=consolidatedEvolution(db,{asOf:day,months:120,...helpers});
 assert.equal(r.points.length,120);assert.equal(r.points.at(-1).date,day);assert.ok(r.points.every(x=>x.totalBRL===null));
});
test('relatório grande funciona com índices e sem repetições de outros ativos',()=>{
 const quoteHistory=Array.from({length:6000},(_,i)=>({ticker:`T${i%400}`,date:`2026-10-${String(1+Math.floor(i/400)).padStart(2,'0')}`,price:5+(i%3),source:'Fechamento'}));
 const transactions=Array.from({length:400},(_,i)=>({ticker:`T${i}`,type:'BUY',quantity:1,price:2,date:'2026-10-01'}));
 const t=performance.now(),r=consolidatedWealth({quoteHistory,transactions,assetValuations:[cash('CONTA_A',day)]},{asOf:day,...helpers});
 assert.equal(r.complete,false);assert.equal(r.positions.length,401);assert.ok(performance.now()-t<5000);
});

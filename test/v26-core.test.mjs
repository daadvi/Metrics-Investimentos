import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAllocation26,buildDividendPanel26,compareProfiles26,analyzePortfolio26,buildSectorExposure26,historicIncomePattern26} from '../src/metrics-v26.mjs';
import {createSnapshotCache} from '../src/storage-read-cache.mjs';
const day='2026-10-25';
const helpers={calculatePositions:tx=>tx.filter(x=>x.type==='BUY').map(x=>({ticker:x.ticker,quantity:x.quantity,cost:x.quantity*x.price})),foreignPositions:()=>[],fixedIncomePosition:()=>({remainingPrincipal:0})};
const cash=(value,date=day)=>({assetClass:'CASH',assetKey:'BANK',date,value,currency:'BRL',source:'Extrato de saldo conferido'});
test('alocação percentual existe apenas quando total é comprovadamente completo',()=>{
 const p=buildAllocation26({complete:true,totalBRL:400,partialKnownBRL:400,positions:[{assetClass:'FII',assetKey:'TEST11',valueBRL:100},{assetClass:'CASH',assetKey:'BANK',valueBRL:300}]});
 assert.equal(p.rows.find(x=>x.name==='Fundos imobiliários').weightPercent,25);
 const q=buildAllocation26({complete:false,totalBRL:null,partialKnownBRL:300,positions:[{assetClass:'FII',assetKey:'T',valueBRL:null},{assetClass:'CASH',assetKey:'B',valueBRL:300}]});
 assert.equal(q.totalBRL,null);assert.ok(q.rows.every(x=>x.weightPercent===null));assert.equal(q.unknownCount,1);
});
test('painel separa recebidos de anúncios e estimativas',()=>{
 const a=buildDividendPanel26({transactions:[{date:'2026-05-05',ticker:'TEST11',type:'DIVIDEND',amount:15}],events:[{date:'2026-05-21',ticker:'TEST11',perShare:.15,kind:'ESTIMADO'}]},{year:2026});
 assert.equal(a.totalRecordedBRL,15);assert.equal(a.eventsCount,1);assert.equal(a.monthly[4].estimated,1);assert.equal(a.monthly[4].receivedBRL,15);
});
test('dividendos por ano nunca usam lançamentos de outro exercício',()=>{
 const a=buildDividendPanel26({transactions:[{date:'2025-12-01',ticker:'X',type:'JCP',amount:9},{date:'2026-01-02',ticker:'X',type:'JCP',amount:4}]},{year:2026});
 assert.equal(a.totalRecordedBRL,4);assert.equal(a.receivedCount,1);
});
test('comparador retorna null para dados ausentes, não zero',()=>{
 const a=compareProfiles26({profiles:[{ticker:'XYZ3',type:'ACAO',dy12:5.5,equity:null,source:'Documento teste'}]},{tickers:['XYZ3','NOTFOUND']});
 assert.equal(a.found[0].metrics.equity,null);assert.deepEqual(a.missing,['NOTFOUND']);
});
test('comparador rejeita excesso de ativos',()=>assert.throws(()=>compareProfiles26({}, {tickers:Array(9).fill('ABCD3')})));
test('auditoria 2.6 deixa total indisponível quando falta preço',()=>{
 const a=analyzePortfolio26({transactions:[{date:'2026-10-01',type:'BUY',ticker:'XYZ3',quantity:1,price:10}],assetValuations:[cash(0)]},{asOf:day,year:2026,...helpers});
 assert.equal(a.allocation.complete,false);assert.equal(a.allocation.totalBRL,null);assert.ok(a.audit.priorities.some(x=>x.severity==='HIGH'));
});
test('auditoria classifica dados consolidados sem dar recomendação financeira',()=>{
 const a=analyzePortfolio26({assetValuations:[cash(25)]},{asOf:day,year:2026,...helpers});
 assert.equal(a.allocation.totalBRL,25);assert.equal(a.productGaps.length,4);
});
test('cache devolve clones isolados e reprocessa no caso de alteração',()=>{
 const c=createSnapshotCache();let count=0;const decode=x=>{count++;return JSON.parse(x)};
 const a=c.get('{"v":1}',decode);a.v=22;
 assert.equal(c.get('{"v":1}',decode).v,1);assert.equal(count,1);
 assert.equal(c.get('{"v":2}',decode).v,2);assert.equal(count,2);assert.equal(c.stats().hits,1);
});
test('cache pequeno não guarda payload acima do limite',()=>{
 const c=createSnapshotCache({maxBytes:4});let count=0;const decode=x=>{count++;return JSON.parse(x)};
 c.get('{"v":5}',decode);c.get('{"v":5}',decode);assert.equal(count,2);assert.equal(c.stats().holding,false);
});
test('cache desativado, dados inválidos e erro de parser não promovem estado',()=>{
 const c=createSnapshotCache({enabled:false});assert.throws(()=>c.get('{not-json}',JSON.parse));
 assert.deepEqual(c.get('{"v":10}',JSON.parse),{v:10});assert.equal(c.stats().hits,0);
});
test('uma única avaliação de posições alimenta alocação e auditoria',()=>{
 let calls=0;
 const onceHelpers={...helpers,calculatePositions:rows=>{calls++;return [];}};
 const r=analyzePortfolio26({assetValuations:[cash(0)]},{asOf:day,year:2026,...onceHelpers});
 assert.equal(r.allocation.totalBRL,0);assert.equal(calls,1);
});
test('identificadores inválidos não entram no comparador',()=>{
 assert.throws(()=>compareProfiles26({profiles:[]},{tickers:['<script>']}));
});
test('cache temporal pode expirar imediatamente',()=>{
 const c=createSnapshotCache({ttlMs:0});let parses=0;
 const decoder=raw=>{parses++;return JSON.parse(raw)};
 c.get('{"a":1}',decoder);c.get('{"a":1}',decoder);assert.equal(parses,2);
});
test('setores desconhecidos não recebem inferência pelo ticker',()=>{
 const a=buildSectorExposure26({complete:true,positions:[{assetKey:'XYZ3',assetClass:'ACAO',valueBRL:120}]},[]);
 assert.equal(a.rows[0].sector,'Setor não informado');assert.equal(a.complete,false);
});
test('radar histórico usa apenas anos cadastrados sem prever pagamento futuro',()=>{
 const r=historicIncomePattern26({transactions:[{date:'2024-03-01',type:'DIVIDEND',amount:6},{date:'2025-03-01',type:'DIVIDEND',amount:7},{date:'2026-05-01',type:'BUY',amount:100}]},{untilYear:2026,lookbackYears:4});
 assert.deepEqual(r.rows[2].recordedYears,[2024,2025]);assert.equal(r.rows[2].historicalBRL,13);assert.equal(r.rows[4].historicalBRL,0);
});
test('provento futuro lançado não conta como dinheiro já recebido',()=>{
 const r=buildDividendPanel26({transactions:[{date:'2026-12-31',ticker:'XYZ3',type:'DIVIDEND',amount:99}]},{year:2026,asOf:'2026-10-25'});
 assert.equal(r.totalRecordedBRL,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseCSV,parseXLSX,interpretTables} from '../src/importers.mjs';
import {simulatePhases,portfolioAnalytics,validateTransaction} from '../src/domain.mjs';
import {offlineReport} from '../src/ai.mjs';

test('projeção com duas fases respeita soma de aportes e caixa',()=>{
 const x=simulatePhases({price:9.58,dividend:.13,phases:[{months:60,amount:400},{months:120,amount:500}],reinvestPercent:100});
 assert.equal(x.months.length,180);assert.equal(x.last.deposited,84000);assert.equal(x.last.month,180);assert.ok(x.last.holdingsValue>84000);assert.equal(x.last.received,x.last.reinvested);
});
test('sem reinvestir, sacado soma dividendos e renda mensal permanece separada',()=>{
 const x=simulatePhases({price:10,dividend:1,phases:[{months:2,amount:100}],reinvestPercent:0});
 assert.equal(x.last.shares,20);assert.equal(x.last.withdrawn,10);assert.equal(x.last.holdingsValue,200);
});
test('variação negativa de preço e inflação preserva trajetória e saldo',()=>{
 const x=simulatePhases({price:20,dividend:.2,phases:[{months:36,amount:100}],priceGrowthAnnual:-10,inflationAnnual:5,reinvestPercent:50});
 assert.equal(x.months.length,36);assert.ok(x.last.realValue<x.last.holdingsValue);assert.ok(x.last.price<20);assert.ok(x.last.withdrawn>0);
});
test('CSV brasileiro entre aspas lido sem perda de centavos',()=>{
 const rows=parseCSV('Data;Ticker;Tipo;Quantidade;Preço;Taxa;Valor\n2026-10-01;GGRC11;compra;10;"9,19";0;\n2026-10-20;GGRC11;dividendo;;;;"1,00"\n');
 const imported=interpretTables([{sheet:'CSV',rows}]);assert.equal(imported.operations.length,2);assert.equal(imported.operations[0].price,9.19);assert.equal(imported.operations[1].amount,1);
});
test('cabeçalho B3 detecta ticker dentro do campo Produto e distingue provento',()=>{
 const rows=[['Data','Produto','Movimentação','Quantidade','Preço unitário','Valor da Operação'],['22/10/2026','MXRF11 - FII Maxi Renda','Compra','10','9,30','93,00'],['23/10/2026','MXRF11 - FII Maxi Renda','Rendimento','','','1,00']];
 const p=interpretTables([{sheet:'B3',rows}]);assert.equal(p.operations.length,2);assert.equal(p.operations[0].ticker,'MXRF11');assert.equal(p.operations[1].type,'DIVIDEND');
});
test('linhas sem identificação suficiente não geram operação inventada',()=>{
 const rows=[['Data','Produto','Movimentação','Quantidade','Valor da Operação'],['23/10/2026','GGRC11','Transferência - Liquidação',10,100]];
 const p=interpretTables([{sheet:'B3',rows}]);assert.equal(p.operations.length,0);assert.equal(p.unrecognizedTotal,1);
});
test('preço manual não se passa por preço de mercado ao vivo',()=>{
 const tx=[validateTransaction({type:'BUY',ticker:'VGIR11',date:'2026-10-01',quantity:10,price:9.58})];
 const a=portfolioAnalytics(tx,[{ticker:'VGIR11',price:9.90,date:'2026-10-23'}]);assert.equal(a.marketValue,99);assert.equal(a.unrealized,3.2);assert.equal(a.positions[0].quoteDate,'2026-10-23');
});
test('análise sem LLM discrimina ativos reais e desejados',()=>{
 const db={transactions:[validateTransaction({type:'BUY',ticker:'VGIR11',date:'2026-10-01',quantity:10,price:9.58})],watchlist:[{ticker:'GGRC11',priority:'alta',target:9,budget:400}],quotes:[],documents:[]};
 const report=offlineReport(db,'Quero comprar GGRC11',true);assert.match(report,/VGIR11/);assert.match(report,/GGRC11/);assert.match(report,/NÃO comprados/);
 assert.doesNotMatch(offlineReport(db,'Oi',false),/VGIR11/);
});

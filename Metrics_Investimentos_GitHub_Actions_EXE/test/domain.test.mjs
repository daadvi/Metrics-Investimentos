import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTransaction,validateWatch,calculatePositions,portfolioTotals,simulate} from '../src/domain.mjs';
test('compra, proventos e preço médio sem preço de mercado',()=>{
 const rows=[validateTransaction({type:'BUY',ticker:'mxrf11',date:'2026-01-03',quantity:10,price:9.30,fee:1}),validateTransaction({type:'DIVIDEND',ticker:'MXRF11',date:'2026-02-05',amount:1})];
 const p=portfolioTotals(rows);
 assert.equal(p.holdingCost,94);assert.equal(p.positions[0].average,9.4);assert.equal(p.dividends,1);
});
test('venda reduz custo pelo preço médio e calcula resultado realizado',()=>{
 const rows=[validateTransaction({type:'BUY',ticker:'GGRC11',date:'2026-01-03',quantity:10,price:9}),validateTransaction({type:'BUY',ticker:'GGRC11',date:'2026-01-07',quantity:10,price:11}),validateTransaction({type:'SELL',ticker:'GGRC11',date:'2026-01-09',quantity:5,price:12,fee:1})];
 const p=calculatePositions(rows)[0];assert.equal(p.quantity,15);assert.equal(p.cost,150);assert.equal(p.realized,9);
});
test('venda antes da compra ou excedendo saldo é rejeitada',()=>{
 assert.throws(()=>calculatePositions([validateTransaction({type:'SELL',ticker:'VGIR11',date:'2026-01-01',quantity:2,price:10})]),/excede saldo/);
});
test('lista de desejos aceita ticker e não converte nota em ativo realizado',()=>{
 const w=validateWatch({ticker:' ggrc11 ',priority:'alta',target:8.5,notes:'comparar com VGIR11'});assert.equal(w.ticker,'GGRC11');assert.equal(w.target,8.5);
});
test('simulador compra cotas inteiras e preserva caixa',()=>{
 const s=simulate({price:9.58,dividend:0.13,firstMonths:60,firstAmount:400,secondMonths:0,secondAmount:0,reinvest:true});
 assert.equal(s.months.length,60);assert.equal(s.last.deposited,24000);
 assert.ok(s.last.cash>=0 && s.last.cash<9.58);assert.equal(s.last.incomeNextMonth,Number((s.last.shares*.13).toFixed(2)));
});
test('dividendo não reinvestido é registrado como retirada',()=>{
 const s=simulate({price:10,dividend:1,firstMonths:2,firstAmount:100,secondMonths:0,secondAmount:0,reinvest:false});
 assert.equal(s.last.shares,20);assert.equal(s.last.withdrawn,10);assert.equal(s.last.incomeNextMonth,20);
});

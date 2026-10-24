import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {encryptBackup,decryptBackup} from '../src/backup.mjs';
import {simulatePortfolio} from '../src/portfolio-sim.mjs';
import {analyzeFundRisk} from '../src/risk.mjs';
import {parseXLSX,interpretTables,parseCSV} from '../src/importers.mjs';

test('backup criptografado restaura dados e rejeita senha errada',()=>{
 const orig={transactions:[{ticker:'MXRF11',amount:10}],watchlist:[{ticker:'GGRC11'}]};
 const enc=encryptBackup(orig,'uma-senha-longa-e-confidencial');
 assert.equal(enc.kind,'metrics-encrypted-backup');
 assert.equal(JSON.stringify(enc).includes('GGRC11'),false);
 assert.deepEqual(decryptBackup(enc,'uma-senha-longa-e-confidencial'),orig);
 assert.throws(()=>decryptBackup(enc,'uma-senha-errada-longa'));
 assert.throws(()=>encryptBackup(orig,'curta'));
});
test('simulador de carteira compra cotas inteiras e separa caixa',()=>{
 const r=simulatePortfolio({assets:[{ticker:'VGIR11',price:10,dividend:.1,weight:50},{ticker:'GGRC11',price:5,dividend:.05,weight:50}],phases:[{months:12,amount:400}],reinvestPercent:100});
 assert.equal(r.months.length,12);assert.equal(r.last.deposited,4800);
 assert.equal(r.last.holdings.length,2);
 assert(r.last.received>0);assert(r.last.holdingsValue>4800);
 assert(r.last.holdings.every(a=>Number.isInteger(a.shares)&&a.cash<a.price));
});
test('dividendos sacados não entram no patrimônio da simulação',()=>{
 const r=simulatePortfolio({assets:[{ticker:'MXRF11',price:10,dividend:1,weight:100}],phases:[{months:2,amount:100}],reinvestPercent:0});
 assert.equal(r.last.deposited,200);assert.equal(r.last.withdrawn,10);
 assert.equal(r.last.holdingsValue,200);assert.equal(r.last.holdings[0].shares,20);
});
test('percentuais inválidos ou ticker repetido são rejeitados',()=>{
 const cfg={assets:[{ticker:'GGRC11',price:8,dividend:0.1,weight:50}],phases:[{months:12,amount:400}]};
 assert.throws(()=>simulatePortfolio(cfg),/100%/);
 assert.throws(()=>simulatePortfolio({...cfg,assets:[...cfg.assets,...cfg.assets]}),/repetido/);
});
test('triagem de riscos não inventa nota ou chance de falir',()=>{
 const r=analyzeFundRisk({ticker:'GGRC11',type:'FII_TIJOLO',vacancy:2,equity:100,debt:40,assets:10,occupied:10,date:'2026-09-30',source:'documento da gestora'});
 assert.equal(r.warnings.length,1);assert(r.positive.length>=2);assert.equal(r.score,undefined);
});
test('importa XLSX com planilha típica e ignora crédito sem compra',()=>{
 const bytes=fs.readFileSync(new URL('./fixtures/b3-exemplo.xlsx',import.meta.url));const i=interpretTables(parseXLSX(bytes));
 assert.deepEqual(i.operations.map(x=>x.type),['BUY','DIVIDEND']);
 const amb=interpretTables([{sheet:'exemplo',rows:parseCSV('Data;Produto;Movimentação;Quantidade;Preço unitário;Valor da Operação\n20/10/2026;VGIR11;Crédito;10;9,58;95,80')}]);
 assert.equal(amb.operations.length,0);assert.equal(amb.unrecognizedTotal,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'metrics-store-tests-'));
process.env.METRICS_DATA_DIR=tmp;
const store=await import('../src/store.mjs');
await store.init();
test('persistência de carteira, desejo e cotação SQLite',async()=>{
 await store.addTransaction({type:'BUY',ticker:'MXRF11',date:'2026-10-01',quantity:10,price:9.30});
 await store.addWatch({ticker:'GGRC11',target:8.5});
 await store.saveQuote({ticker:'MXRF11',price:9.7,date:'2026-10-23'});
 const data=await store.read();assert.equal(data.transactions.length,1);assert.equal(data.watchlist[0].ticker,'GGRC11');assert.equal(data.quotes[0].price,9.7);
});
test('importação atômica não duplica operações existentes',async()=>{
 const r=[{type:'BUY',ticker:'MXRF11',date:'2026-10-01',quantity:10,price:9.3},{type:'DIVIDEND',ticker:'MXRF11',date:'2026-10-20',amount:1}];
 const batch=await store.addTransactionsBulk(r,'b3.xlsx');assert.equal(batch.added,1);assert.equal(batch.duplicates,1);
 const dupe=await store.addTransactionsBulk(r,'b3.xlsx');assert.equal(dupe.added,0);assert.equal(dupe.duplicates,2);
 await store.rollbackImport(batch.id);const data=await store.read();assert.equal(data.transactions.length,1);
});
test('importação inválida não grava parcialmente',async()=>{
 const initial=(await store.read()).transactions.length;
 await assert.rejects(()=>store.addTransactionsBulk([{type:'BUY',ticker:'VGIR11',date:'2026-10-01',quantity:2,price:9.5},{type:'SELL',ticker:'VGIR11',date:'2026-10-01',quantity:200,price:9.5}]),/excede saldo/);
 assert.equal((await store.read()).transactions.length,initial);
});
test('restauração inválida é rejeitada e preserva banco',async()=>{
 const existing=await store.read();await assert.rejects(()=>store.restoreBackup({transactions:[{type:'SELL',ticker:'MXRF11',date:'2026-10-01',quantity:1000,price:10}],watchlist:[]}),/excede saldo/);
 assert.equal((await store.read()).transactions.length,existing.transactions.length);
});
test('chave da IA não fica gravada no banco',async()=>{
 const text=JSON.stringify(await store.read());assert.ok(!text.includes('sk-test-secret'));
});
test('perfil de fundo armazena indicadores declarados e pode ser excluído',async()=>{
 const p=await store.saveProfile({ticker:'GGRC11',type:'FII_TIJOLO',sector:'Logística',assets:34,occupied:33,source:'Relatório de teste'});
 assert.equal(p.assets,34);assert.equal((await store.read()).profiles[0].ticker,'GGRC11');
 await store.removeItem('profiles','GGRC11');assert.equal((await store.read()).profiles.length,0);
});
test('calendário mantém eventos e diferencia confirmação de estimativa',async()=>{
 const e=await store.addEvent({ticker:'VGIR11',date:'2026-11-18',kind:'ESTIMADO',perShare:0.13});
 assert.equal(e.kind,'ESTIMADO');await store.removeItem('events',e.id);assert.equal((await store.read()).events.length,0);
});

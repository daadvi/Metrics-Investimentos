import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function freePort(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
async function server(){
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-edit-undo-')),port=await freePort();
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:''},stdio:['ignore','pipe','pipe']});
 let out='';const launch=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Falha ao iniciar: '+out)),16000);
 for(const stream of [child.stdout,child.stderr])stream.on('data',buff=>{out+=buff.toString();const match=out.match(/METRICS_LAUNCH_URL=(\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.once('exit',code=>{clearTimeout(timer);reject(Error('Servidor finalizou '+code+' '+out));});});
 const auth=await fetch(launch,{redirect:'manual'}),cookie=auth.headers.get('set-cookie').split(';')[0],base=`http://127.0.0.1:${port}`;
 const api=async(route,{method='GET',data,portfolioId,local=true}={})=>{
 const response=await fetch(base+route,{method,headers:{Cookie:cookie,...(local?{'X-Metrics-Local':'1'}:{}),...(portfolioId?{'X-Metrics-Portfolio-ID':portfolioId}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data!==undefined?JSON.stringify(data):undefined});
 return {status:response.status,data:await response.json()};};
 return {dir,child,api,close:async()=>{child.kill('SIGTERM');await rm(dir,{recursive:true,force:true});}};
}
const buy=(ticker,quantity,date='2026-01-10',price=10)=>({type:'BUY',ticker,quantity,date,price,fee:0});
const sell=(ticker,quantity,date='2026-02-10',price=12)=>({type:'SELL',ticker,quantity,date,price,fee:0});

test('API: editar data e quantidade recalcula posição, custo e resultado preservando ID e origem',{timeout:25000},async()=>{
 const ctx=await server();const {api}=ctx;try{
  const a=(await api('/api/transactions',{method:'POST',data:buy('MXRF11',10)})).data.transaction;
  const b=(await api('/api/transactions',{method:'POST',data:sell('MXRF11',4)})).data.transaction;
  const edit=await api('/api/transactions/'+a.id,{method:'PUT',data:{quantity:15,date:'2026-01-09',price:11}});
  assert.equal(edit.status,200,JSON.stringify(edit.data));assert.equal(edit.data.transaction.id,a.id);assert.equal(edit.data.transaction.source,'manual');
  assert.equal(edit.data.transaction.date,'2026-01-09');
  let state=(await api('/api/state')).data;
  assert.equal(state.summary.positions[0].quantity,11);
  assert.equal(state.summary.positions[0].average,11);
  assert.equal(state.summary.positions[0].realized,4);
  assert.equal(state.transactionAudit.at(-1).action,'EDIT');
  assert.equal(state.transactionAudit.at(-1).before,undefined,'histórico privado não deve expor snapshots completos no painel');
  // Data impossível ou venda sem posição não podem persistir alteração parcial.
  assert.equal((await api('/api/transactions/'+a.id,{method:'PUT',data:{date:'2026-02-30'}})).status,400);
  assert.equal((await api('/api/transactions/'+a.id,{method:'PUT',data:{quantity:2}})).status,400);
  state=(await api('/api/state')).data;assert.equal(state.transactions.find(x=>x.id===a.id).quantity,15);
  assert.equal(state.summary.positions[0].quantity,11);
  assert.equal((await api('/api/transactions/'+b.id,{method:'PUT',data:{date:'2025-12-01'}})).status,400);
 }finally{await ctx.close();}
});

test('API: exclusão protegida, desfazer de criação/edição/exclusão, persistência e isolamento de carteiras',{timeout:25000},async()=>{
 const ctx=await server();const {api}=ctx;try{
  const pid=(await api('/api/portfolios')).data.activePortfolioId;
  const buyTx=(await api('/api/transactions',{method:'POST',data:buy('GGRC11',10)})).data.transaction;
  const sellTx=(await api('/api/transactions',{method:'POST',data:sell('GGRC11',5)})).data.transaction;
  const failed=await api('/api/transactions/'+buyTx.id,{method:'DELETE'});
  assert.equal(failed.status,400);assert.match(failed.data.error,/excede saldo/);
  const stateBefore=(await api('/api/state')).data;assert.equal(stateBefore.transactions.length,2);
  // Corrigir venda e desfazer restaura exatamente o valor anterior.
  await api('/api/transactions/'+sellTx.id,{method:'PUT',data:{price:14}});
  let state=(await api('/api/state')).data,token=state.transactionAudit.at(-1).id;
  assert.equal((await api('/api/transactions/undo',{method:'POST',data:{auditId:token}})).status,200);
  state=(await api('/api/state')).data;
  assert.equal(state.transactions.find(x=>x.id===sellTx.id).price,12);
  assert.equal(state.summary.positions[0].realized,10);
  assert.equal((await api('/api/transactions/undo',{method:'POST',data:{auditId:token}})).status,400,'não pode desfazer a mesma ação duas vezes');
  // Excluir venda, desfazer recupera exatamente o mesmo ID.
  assert.equal((await api('/api/transactions/'+sellTx.id,{method:'DELETE'})).status,200);
  state=(await api('/api/state')).data;assert.equal(state.summary.positions[0].quantity,10);
  token=state.transactionAudit.at(-1).id;
  assert.equal((await api('/api/transactions/undo',{method:'POST',data:{auditId:token}})).status,200);
  state=(await api('/api/state')).data;assert.equal(state.summary.positions[0].quantity,5);
  assert.equal(state.transactions.find(x=>x.id===sellTx.id).price,12);
  // Carteira secundária não pode aplicar tokens da carteira principal.
  const second=(await api('/api/portfolios',{method:'POST',data:{name:'Outra carteira'}})).data.portfolio.id;
  assert.equal((await api('/api/transactions/undo',{method:'POST',portfolioId:second,data:{auditId:token}})).status,400);
  assert.equal((await api('/api/state',{portfolioId:second})).data.transactions.length,0);
  assert.equal((await api('/api/state',{portfolioId:pid})).data.transactions.length,2);
  // Controle de acesso a alterações.
  assert.equal((await api('/api/transactions/'+buyTx.id,{method:'PUT',portfolioId:pid,local:false,data:{quantity:20}})).status,403);
 }finally{await ctx.close();}
});

test('migração: RC2 schema 4 preserva várias carteiras, operações e identificadores',{timeout:20000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-rc2-upgrade-'));
 try{
  const db=new DatabaseSync(path.join(dir,'metrics.sqlite'));
  db.exec('CREATE TABLE storage(id INTEGER PRIMARY KEY,content TEXT,updated_at TEXT)');
  const id='00000000-0000-0000-0000-000000000001';const second='00000000-0000-0000-0000-000000000002';
  const initial={schema:4,activePortfolioId:id,portfolios:[{id,name:'Principal',createdAt:'2026-01-01',data:{schema:4,transactions:[{...buy('MXRF11',10),id:'old-1',createdAt:'2026-01-01'}],watchlist:[],settings:{theme:'dark'}}},{id:second,name:'Longo prazo',createdAt:'2026-01-01',data:{schema:4,transactions:[{...buy('GGRC11',20),id:'old-2',createdAt:'2026-01-01'}],watchlist:[{ticker:'VGIR11'}],settings:{theme:'dark'}}}],extensions:[]};
  db.prepare('INSERT INTO storage(id,content,updated_at) VALUES(1,?,?)').run(JSON.stringify(initial),new Date().toISOString());db.close();
  const code="import {init,read,listPortfolios,withPortfolio} from './src/store.mjs';await init();const p=await listPortfolios();const a=await withPortfolio(p.portfolios[0].id,read),b=await withPortfolio(p.portfolios[1].id,read);console.log(JSON.stringify({p,first:a.transactions[0].ticker,second:b.transactions[0].ticker,wish:b.watchlist[0].ticker}));";
  const proc=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:root,encoding:'utf8',env:{...process.env,METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:''},timeout:12000});
  assert.equal(proc.status,0,proc.stderr);const info=JSON.parse(proc.stdout.trim());
  assert.equal(info.p.portfolios.length,2);assert.equal(info.p.activePortfolioId,id);assert.equal(info.first,'MXRF11');assert.equal(info.second,'GGRC11');assert.equal(info.wish,'VGIR11');
  const verify=new DatabaseSync(path.join(dir,'metrics.sqlite'));const persisted=JSON.parse(verify.prepare('SELECT content FROM storage WHERE id=1').get().content);assert.equal(persisted.schema,6);verify.close();
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('API: desfazer criação remove lançamento e invalidar undo após importação protege contra operações antigas',{timeout:26000},async()=>{
 const ctx=await server();const {api}=ctx;try{
  const created=await api('/api/transactions',{method:'POST',data:buy('VGIR11',4)});
  assert.equal(created.status,201);let state=(await api('/api/state')).data;
  assert.equal(state.summary.holdings,1);const token=state.transactionAudit.at(-1).id;
  assert.equal((await api('/api/transactions/undo',{method:'POST',data:{auditId:token}})).status,200);
  state=(await api('/api/state')).data;assert.equal(state.summary.holdings,0);
  assert.equal(state.transactions.length,0);
  await api('/api/transactions',{method:'POST',data:buy('MXRF11',10)});
  const originalAudit=(await api('/api/state')).data.transactionAudit.at(-1).id;
  const batch=await api('/api/transactions/import',{method:'POST',data:{name:'Extrato sintético',transactions:[{...buy('PETR4',3,'2026-01-11',20),source:'b3'}]}});
  assert.equal(batch.status,200,JSON.stringify(batch.data));
  state=(await api('/api/state')).data;assert.equal(state.transactionAudit.at(-1).action,'IMPORT_BATCH');
  assert.equal((await api('/api/transactions/undo',{method:'POST',data:{auditId:originalAudit}})).status,400);
  assert.equal((await api('/api/transactions/undo',{method:'POST',data:{auditId:state.transactionAudit.at(-1).id}})).status,400);
  const rollback=await api('/api/imports/rollback',{method:'POST',data:{id:batch.data.id}});assert.equal(rollback.status,200);
  assert.equal((await api('/api/state')).data.transactions.length,1);
 }finally{await ctx.close();}
});

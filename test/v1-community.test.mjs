import {stopAndRemove} from './helpers/windows-cleanup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import net from 'node:net';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {validateExtensionManifest,renderExtension} from '../src/extensions.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const example=JSON.parse(await readFile(path.join(root,'community-examples','visao-simples.json'),'utf8'));
async function freePort(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
async function server(){
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-wallet-test-')),port=await freePort();
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:''},stdio:['ignore','pipe','pipe']});
 const launch=await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>reject(Error('Servidor sem inicializar: '+out)),13000);
  for(const stream of [child.stdout,child.stderr])stream.on('data',buff=>{out+=buff.toString();const m=out.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});child.once('exit',code=>{clearTimeout(timeout);reject(Error('Servidor finalizou: '+code+' '+out));});});
 const auth=await fetch(launch,{redirect:'manual'}),cookie=auth.headers.get('set-cookie').split(';')[0],base=`http://127.0.0.1:${port}`;
 const api=async(route,{method='GET',data,portfolioId,local=true}={})=>{
  const response=await fetch(base+route,{method,headers:{Cookie:cookie,...(local?{'X-Metrics-Local':'1'}:{}),...(portfolioId?{'X-Metrics-Portfolio-ID':portfolioId}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data!==undefined?JSON.stringify(data):undefined});return {status:response.status,data:await response.json()};
 };
 return {dir,child,api,close:async()=>{await stopAndRemove(child,dir);}};
}
test('comunidade: esquema declarativo rejeita JS, HTML e acessos não permitidos',()=>{
 assert.equal(validateExtensionManifest(example).widgets.length,2);
 assert.throws(()=>validateExtensionManifest({...example,id:'org.metrics.evil',script:'require("fs")'}),/campos não permitidos/);
 assert.throws(()=>validateExtensionManifest({...example,widgets:[{...example.widgets[0],title:'<script>alert(1)</script>'}]}),/Fonte ou apresentação|Fonte ou|Nome|proibidos|Fonte/i);
 assert.throws(()=>validateExtensionManifest({...example,widgets:[{...example.widgets[1],columns:['ticker','password']}]}),/Colunas/);
 assert.throws(()=>validateExtensionManifest({...example,capabilities:['portfolio.positions','network'] }),/Permissões/);
 assert.throws(()=>validateExtensionManifest({...example,widgets:[{...example.widgets[1],source:'documents',columns:['text']}]}),/Fonte ou apresentação/);
});
test('comunidade: renderização só fornece dados com permissão exata',()=>{
 const db={transactions:[{type:'BUY',date:'2026-10-01',ticker:'MXRF11',quantity:10,price:9,fee:0}],watchlist:[]};
 const r=renderExtension(validateExtensionManifest(example),db,['portfolio.summary']);
 assert.equal(r.widgets[0].value,90);
 assert.equal(r.widgets[1].type,'unavailable');
});
test('API: cada carteira isola operações, desejo, mensagens, extensões, relatórios e backup',{timeout:35000},async()=>{
 const {api,close}=await server();try{
  const p=await api('/api/portfolios');assert.equal(p.status,200);assert.equal(p.data.portfolios.length,1);
  const primary=p.data.activePortfolioId;
  const t=await api('/api/transactions',{method:'POST',portfolioId:primary,data:{ticker:'MXRF11',type:'BUY',date:'2026-10-01',quantity:10,price:9}});assert.equal(t.status,201,JSON.stringify(t.data));
  const created=await api('/api/portfolios',{method:'POST',data:{name:'Carteira de estudos'}});assert.equal(created.status,201);const secondary=created.data.portfolio.id;
  let s=await api('/api/state',{portfolioId:secondary});assert.equal(s.data.transactions.length,0);
  await api('/api/watchlist',{method:'POST',portfolioId:secondary,data:{ticker:'TRXF11',target:75}});
  s=await api('/api/state',{portfolioId:secondary});assert.equal(s.data.watchlist.length,1);assert.equal(s.data.summary.holdings,0);
  await api('/api/transactions',{method:'POST',portfolioId:secondary,data:{ticker:'KNCR11',type:'BUY',date:'2026-10-04',quantity:2,price:100}});
  assert.equal((await api('/api/state',{portfolioId:primary})).data.transactions[0].ticker,'MXRF11');
  assert.equal((await api('/api/state',{portfolioId:primary})).data.watchlist.length,0);
  assert.equal((await api('/api/state',{portfolioId:secondary})).data.transactions[0].ticker,'KNCR11');
  const parallel=await Promise.all([
   api('/api/goals',{method:'POST',portfolioId:primary,data:{monthlyIncomeGoal:1000}}),
   api('/api/goals',{method:'POST',portfolioId:secondary,data:{monthlyIncomeGoal:2000}})
  ]);
  assert.ok(parallel.every(x=>x.status===200));
  assert.equal((await api('/api/state',{portfolioId:primary})).data.settings.monthlyIncomeGoal,1000);
  assert.equal((await api('/api/state',{portfolioId:secondary})).data.settings.monthlyIncomeGoal,2000);

  assert.equal((await api('/api/export',{portfolioId:secondary})).data.transactions[0].ticker,'KNCR11');
  assert.equal((await api('/api/report/xlsx?year=2026',{portfolioId:primary})).status,200);
  const bad=await api('/api/state',{portfolioId:'00000000-0000-0000-0000-000000000000'});assert.equal(bad.status,400);
  assert.equal((await api('/api/portfolios/select',{method:'POST',data:{id:secondary}})).status,200);
  assert.equal((await api('/api/state')).data.transactions[0].ticker,'KNCR11');
  const impossibleDelete=await api('/api/portfolios/'+secondary,{method:'DELETE'});assert.equal(impossibleDelete.status,400);
  assert.equal((await api('/api/extensions/import',{method:'POST',data:{manifest:example},local:false})).status,403);
  const installed=await api('/api/extensions/import',{method:'POST',data:{manifest:example}});assert.equal(installed.status,201,JSON.stringify(installed.data));
  assert.equal((await api('/api/extensions/'+example.id+'/dashboard',{portfolioId:primary})).status,400);
  const perms=await api('/api/extensions/'+example.id+'/permissions',{method:'POST',portfolioId:primary,data:{enabled:true,capabilities:['portfolio.summary','portfolio.positions']}});assert.equal(perms.status,200);
  const board=await api('/api/extensions/'+example.id+'/dashboard',{portfolioId:primary});assert.equal(board.status,200);assert.equal(board.data.widgets[0].value,90);
  assert.equal(board.data.widgets[1].rows[0].ticker,'MXRF11');
  assert.equal((await api('/api/extensions/'+example.id+'/dashboard',{portfolioId:secondary})).status,400);
  assert.equal((await api('/api/extensions',{portfolioId:secondary})).data.extensions[0].enabled,false);
  await api('/api/extensions/'+example.id+'/permissions',{method:'POST',portfolioId:secondary,data:{enabled:true,capabilities:['portfolio.summary']}});
  const b=await api('/api/extensions/'+example.id+'/dashboard',{portfolioId:secondary});assert.equal(b.status,200);assert.equal(b.data.widgets[0].value,200);assert.equal(b.data.widgets[1].type,'unavailable');
  await api('/api/extensions/'+example.id,{method:'DELETE'});
  assert.equal((await api('/api/extensions')).data.extensions.length,0);
  const empty=await api('/api/portfolios',{method:'POST',data:{name:'Descartável'}});
  assert.equal((await api('/api/portfolios/'+empty.data.portfolio.id,{method:'DELETE'})).status,200);
 }finally{await close();}
});
test('migração v1: o formato antigo guarda investimentos na carteira principal sem criar compras',{timeout:18000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-legacywallet-'));
 try{
  const db=new DatabaseSync(path.join(dir,'metrics.sqlite'));db.exec('CREATE TABLE storage(id INTEGER PRIMARY KEY,content TEXT,updated_at TEXT)');
  db.prepare('INSERT INTO storage(id,content,updated_at) VALUES(1,?,?)').run(JSON.stringify({schema:4,transactions:[{type:'BUY',date:'2026-10-01',ticker:'MXRF11',quantity:3,price:9,fee:0}],watchlist:[{ticker:'VGIR11',target:9}],messages:[],settings:{theme:'dark'}}),new Date().toISOString());db.close();
  const script="import {init,read,listPortfolios,createPortfolio} from './src/store.mjs';await init();console.log(JSON.stringify({before:(await read()).transactions.length,watch:(await read()).watchlist.length,portfolios:(await listPortfolios()).portfolios.length,id:(await listPortfolios()).activePortfolioId}));await createPortfolio('Nova carteira');console.log(JSON.stringify({after:(await read()).transactions.length,total:(await listPortfolios()).portfolios.length}));";
  const p=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:root,encoding:'utf8',env:{...process.env,METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:''},timeout:12000});
  assert.equal(p.status,0,p.stderr);const [initial,final]=p.stdout.trim().split('\n').map(JSON.parse);assert.equal(initial.before,1);assert.equal(initial.watch,1);assert.equal(initial.portfolios,1);assert.match(initial.id,/^[a-f0-9-]{36}$/);assert.deepEqual(final,{after:1,total:2});const second=spawnSync(process.execPath,['--input-type=module','-e',"import {init,listPortfolios,read} from './src/store.mjs';await init();console.log(JSON.stringify({id:(await listPortfolios()).portfolios[0].id,operations:(await read()).transactions.length}));"],{cwd:root,encoding:'utf8',env:{...process.env,METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:''},timeout:12000});assert.equal(second.status,0,second.stderr);assert.deepEqual(JSON.parse(second.stdout.trim()),{id:initial.id,operations:1});
 }finally{await rm(dir,{recursive:true,force:true});}
});

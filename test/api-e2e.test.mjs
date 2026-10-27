import {stopAndRemove} from './helpers/windows-cleanup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function portFree(){return new Promise((resolve,reject)=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});s.on('error',reject);});}
test('fluxo real API: bloqueio, carteira, desejos, simulação, Excel e backup protegido', {timeout:28000}, async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-e2e-'));const port=await portFree();const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,METRICS_DATA_DIR:dir,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 try{
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('Servidor não iniciou: '+out)),10000);const capture=c=>{out+=c.toString();const m=out.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}};server.stdout.on('data',capture);server.stderr.on('data',capture);server.once('exit',code=>{clearTimeout(timer);reject(Error('Servidor encerrou: '+code));});});
  const base=`http://127.0.0.1:${port}`;
  let response=await fetch(base+'/api/state');assert.equal(response.status,401);
  response=await fetch(url,{redirect:'manual'});assert.equal(response.status,303);const cookie=response.headers.get('set-cookie').split(';')[0];
  const go=async(endpoint,method='GET',data)=>{const response=await fetch(base+endpoint,{method,headers:{cookie,'X-Metrics-Local':'1',...(data===undefined?{}:{'content-type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});const body=await response.json();assert(response.ok,JSON.stringify(body));return body;};
  await go('/api/transactions','POST',{ticker:'MXRF11',type:'BUY',date:'2026-10-01',quantity:10,price:9.30,fee:0});
  await go('/api/watchlist','POST',{ticker:'VGIR11',priority:'alta',target:9.20,notes:'Analisar depois'});
  let s=await go('/api/state');assert.equal(s.summary.holdingCost,93);assert.equal(s.watchlist[0].ticker,'VGIR11');
  const r=await go('/api/simulate/portfolio','POST',{assets:[{ticker:'MXRF11',price:9.3,dividend:.10,weight:50},{ticker:'VGIR11',price:9.58,dividend:.13,weight:50}],phases:[{months:60,amount:400}]});assert.equal(r.last.deposited,24000);assert(r.last.received>0);
  const fixture=await readFile(new URL('./fixtures/b3-exemplo.xlsx',import.meta.url));const preview=await go('/api/import/preview','POST',{name:'b3.xlsx',data:fixture.toString('base64')});assert.equal(preview.operations.length,2);
  const imported=await go('/api/transactions/import','POST',{name:'b3.xlsx',transactions:preview.operations});assert.equal(imported.added,2);
  const importedAgain=await go('/api/transactions/import','POST',{name:'b3.xlsx',transactions:preview.operations});assert.equal(importedAgain.added,0);
  const backup=await go('/api/backup/encrypted','POST',{password:'um-backup-seguro-de-verdade'});assert(!JSON.stringify(backup).includes('MXRF11'));
  await go('/api/backup/restore-encrypted','POST',{backup,password:'um-backup-seguro-de-verdade'});
  s=await go('/api/state');assert.equal(s.transactions.length,3);assert.equal(s.watchlist.length,1);
 }finally{await stopAndRemove(server,dir);}
});

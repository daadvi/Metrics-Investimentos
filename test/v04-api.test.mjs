import {stopAndRemove} from './helpers/windows-cleanup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import net from 'node:net';import {fileURLToPath} from 'node:url';
import {parseXLSX} from '../src/importers.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function availablePort(){return new Promise((resolve,reject)=>{const socket=net.createServer();socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolve(p));});socket.on('error',reject);});}
const b3line=(ticker,close)=>{const a=Array(245).fill(' ');for(const [start,value] of [[0,'01'],[2,'20261023'],[10,'02'],[12,ticker.padEnd(12)],[24,'010'],[108,String(close).padStart(13,'0')]])for(let i=0;i<value.length;i++)a[start+i]=value[i];return a.join('');};
test('API 0.4: sessão, classificação fiscal, mercado B3 e Excel real', {timeout:28000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-v04-'));const port=await availablePort();
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,METRICS_DATA_DIR:dir,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 try{
  let buffer='';const launch=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Servidor não iniciou')),10000);const capture=c=>{buffer+=c.toString();const m=buffer.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timeout);resolve(m[1]);}};child.stdout.on('data',capture);child.stderr.on('data',capture);});
  const base='http://127.0.0.1:'+port;
  assert.equal((await fetch(base+'/api/report/xlsx?year=2026')).status,401);
  const login=await fetch(launch,{redirect:'manual'});assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];
  const go=async(route,method='GET',data,expect=200)=>{const r=await fetch(base+route,{method,headers:{cookie,'X-Metrics-Local':'1',...(data==null?{}:{'content-type':'application/json'})},body:data==null?undefined:JSON.stringify(data)});assert.equal(r.status,expect);return r.json();};
  await go('/api/transactions','POST',{ticker:'GGRC11',type:'BUY',date:'2026-09-01',quantity:10,price:9.00},201);
  await go('/api/transactions','POST',{ticker:'GGRC11',type:'SELL',date:'2026-10-14',quantity:2,price:10.00},201);
  await go('/api/profiles','POST',{ticker:'GGRC11',type:'FII_TIJOLO',name:'Galpões',date:'2026-09-30'});
  const ledger=await go('/api/tax/ledger?year=2026');assert.equal(ledger.sales.length,1);assert.equal(ledger.sales[0].gain,2);
  const sample=Buffer.from('00'+'.'.repeat(243)+'\n'+b3line('GGRC11',919)+'\n99'+'.'.repeat(243)+'\n','latin1');
  const preview=await go('/api/market/preview','POST',{name:'COTAHIST_D23102026.TXT',data:sample.toString('base64')});assert.equal(preview.quotes[0].price,9.19);
  const saved=await go('/api/market/import','POST',{name:'COTAHIST_D23102026.TXT',data:sample.toString('base64')});assert.equal(saved.updated,1);
  const state=await go('/api/state');assert.equal(state.quotes[0].source,'B3 COTAHIST (fechamento, sem ajustes)');
  const excel=await go('/api/report/xlsx?year=2026');const xlsx=parseXLSX(Buffer.from(excel.base64,'base64'));
  assert.equal(xlsx.length,12);assert.equal(xlsx[1].rows[1][1],'GGRC11');
 }finally{await stopAndRemove(child,dir);}
});

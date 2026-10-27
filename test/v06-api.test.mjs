import {expectedMetricsVersion} from './helpers/expected-metrics-version.mjs';
import {stopAndRemove} from './helpers/windows-cleanup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import net from 'node:net';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function freePort(){return new Promise((resolve,reject)=>{const socket=net.createServer();socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port));});socket.on('error',reject);});}
const line=(ticker,day,price)=>{const a=Array(245).fill(' ');for(const [start,value] of [[0,'01'],[2,day],[10,'02'],[12,ticker.padEnd(12)],[24,'010'],[108,String(price).padStart(13,'0')]])for(let i=0;i<value.length;i++)a[start+i]=value[i];return a.join('');};
test('v0.6 API: compras > histórico de fechamento > CDI > evolução, sem chave inventada',{timeout:25000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-v06-'));
 const port=await freePort();const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,METRICS_DATA_DIR:dir,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 try{
  let capture='';const launch=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Servidor não iniciou')),8000);const onChunk=b=>{capture+=b.toString();const m=capture.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timeout);resolve(m[1]);}};child.stdout.on('data',onChunk);child.stderr.on('data',onChunk);});
  const base=`http://127.0.0.1:${port}`,login=await fetch(launch,{redirect:'manual'}),cookie=login.headers.get('set-cookie').split(';')[0];
  const api=async(route,method='GET',data,expect=200)=>{const r=await fetch(base+route,{method,headers:{cookie,'x-metrics-local':'1',...(data==null?{}:{'content-type':'application/json'})},body:data==null?undefined:JSON.stringify(data)});assert.equal(r.status,expect,route+' responded '+r.status+' '+await r.clone().text());return r.json();};
  const health=await api('/api/health');assert.equal(health.version,expectedMetricsVersion);
  await api('/api/transactions','POST',{ticker:'MXRF11',type:'BUY',date:'2026-10-22',quantity:10,price:10},201);
  const file=Buffer.from('00'+'.'.repeat(243)+'\n'+line('MXRF11','20261022',1000)+'\n'+line('MXRF11','20261023',1100)+'\n99'+'.'.repeat(243)+'\n','latin1');
  const imported=await api('/api/market/import','POST',{name:'COTAHIST_D23102026.TXT',data:file.toString('base64')});assert.equal(imported.historical.total,2);
  const p=await api('/api/performance');assert.equal(p.approximateTwrPercent,10);assert.equal(p.lastComplete.value,110);
  const benchmark=await api('/api/benchmark/cdi-import','POST',{csv:'data;valor\n23/10/2026;0,05'});assert.equal(benchmark.total,1);
  const withCDI=await api('/api/performance');assert.equal(withCDI.benchmark.cumulativePercent,.05);
  const state=await api('/api/state');assert.equal(state.quoteHistoryStats.observations,2);
  const fiscal=await api('/api/fiscal-readiness?year=2026');assert.equal(fiscal.readiness,'REVISÃO_OBRIGATÓRIA');
  const bad=await api('/api/market/provider-refresh','POST',{key:''},400);assert.match(bad.error,/configure sua chave/i);
 }finally{await stopAndRemove(child,dir);}
});

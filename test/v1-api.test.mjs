import test from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtemp,rm} from 'node:fs/promises';import net from 'node:net';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function freePort(){return new Promise(res=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});}
test('Metrics v1: fluxo API: autenticação, histórico, evento corporativo, renda, radar, pesquisa, fiscal',{timeout:30000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-v1-')),port=await freePort();const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),METRICS_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 try{
  let output='';const launch=await new Promise((res,rej)=>{const timer=setTimeout(()=>rej(Error('Servidor não iniciou: '+output)),10000);for(const s of [child.stdout,child.stderr])s.on('data',b=>{output+=b.toString();const m=output.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timer);res(m[1]);}});});
  const base=`http://127.0.0.1:${port}`,denied=await fetch(base+'/api/radar');assert.equal(denied.status,401);
  const token=await fetch(launch,{redirect:'manual'}),cookie=token.headers.get('set-cookie').split(';')[0];
  const api=async(url,method='GET',data,expected=200)=>{const r=await fetch(base+url,{method,headers:{Cookie:cookie,'X-Metrics-Local':'1',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const text=await r.text();assert.equal(r.status,expected,`${url} (${r.status}): ${text.slice(0,350)}`);return JSON.parse(text);};
  assert.equal((await api('/api/health')).version,'1.4.0-rc.1');
  await api('/api/transactions','POST',{type:'BUY',ticker:'MXRF11',date:'2025-01-01',quantity:10,price:10},201);
  await api('/api/transactions','POST',{type:'SPLIT',ticker:'MXRF11',date:'2025-05-01',factor:2},201);
  const s=await api('/api/state');assert.equal(s.summary.positions[0].quantity,20);assert.equal(s.summary.positions[0].average,5);
  await api('/api/quotes','POST',{ticker:'MXRF11',price:6,date:'2026-10-24'});
  const quality=await api('/api/quality');assert.equal(quality.portfolio.complete,true);assert.equal(quality.portfolio.totalMarketValue,120);assert.equal(quality.xirr.value,null);assert.match(quality.xirr.reason,/eventos societários/i);
  await api('/api/goals','POST',{monthlyIncomeGoal:1000});assert.equal((await api('/api/radar')).goal.monthlyTarget,1000);
  await api('/api/research/save','POST',{ticker:'MXRF11',kind:'FII_INDICATORS',indicators:{dy12:11.4,pvp:.9,patrimonioLiquido:100000000},source:'brapi.dev',observedAt:'2026-10-22'});
  assert.equal((await api('/api/radar')).screener.items[0].dy12,11.4);
  await api('/api/dividends/provider-import','POST',{events:[{ticker:'MXRF11',date:'2026-11-10',recordDate:'2026-10-20',perShare:.1}]});
  const future=await api('/api/future-income');assert.ok(future.events.some(e=>e.ticker==='MXRF11'&&e.amount===2&&e.automaticallyVerified===false));
  const tax=await api('/api/fiscal-readiness?year=2026');assert.equal(tax.readiness,'REVISÃO_OBRIGATÓRIA');
  const xlsx=await api('/api/report/xlsx?year=2026');assert.ok(xlsx.base64.length>1000);
  const exported=await api('/api/export');assert.equal(exported.settings.monthlyIncomeGoal,1000);assert.equal(exported.providerResearch.length,1);
 }finally{child.kill('SIGTERM');await rm(dir,{recursive:true,force:true});}
});

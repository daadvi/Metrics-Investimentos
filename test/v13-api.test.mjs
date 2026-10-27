import {expectedMetricsVersion} from './helpers/expected-metrics-version.mjs';
import {stopAndRemove} from './helpers/windows-cleanup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import net from 'node:net';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function freePort(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
test('API v1.3: fontes, apuração auxiliar, isolamento e persistência', {timeout:35000}, async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-v13-')),port=await freePort(),child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),METRICS_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 try{
  let log='';const launch=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Servidor não iniciou: '+log)),10000);for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{log+=b.toString();const m=log.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});});
  const origin=`http://127.0.0.1:${port}`;assert.equal((await fetch(origin+'/api/data/health-v13')).status,401);
  const auth=await fetch(launch,{redirect:'manual'}),cookie=auth.headers.get('set-cookie').split(';')[0];let portfolio=null;
  const api=async(p,method='GET',data,expected=200)=>{const res=await fetch(origin+p,{method,headers:{cookie,'x-metrics-local':'1',...(portfolio?{'x-metrics-portfolio-id':portfolio}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const text=await res.text();assert.equal(res.status,expected,text.slice(0,700));return JSON.parse(text);};
  assert.equal((await api('/api/health')).version,expectedMetricsVersion);
  await api('/api/transactions','POST',{ticker:'GGRC11',date:'2026-01-01',type:'BUY',quantity:10,price:10},201);
  let csv='CNPJ_Fundo;Data_Referencia;Quantidade_Imoveis;Taxa_Vacancia\n12.345.678/0001-95;2026-06-30;12;2,5\n';
  const payload={tickerMap:{'12345678000195':'GGRC11'},data:Buffer.from(csv).toString('base64')};
  assert.equal((await api('/api/official/cvm-quarterly/preview','POST',payload)).entries[0].indicators.totalProperties,12);
  assert.equal((await api('/api/official/cvm-quarterly/import','POST',payload)).inserted,1);
  assert.equal((await api('/api/official/cvm-quarterly/import','POST',payload)).duplicates,1);
  assert.equal((await api('/api/official/cvm-quarterly')).entries,1);
  const div=await api('/api/dividends/brapi-save','POST',{kind:'FII',dividends:[{symbol:'GGRC11',rate:0.1,label:'RENDIMENTO',remarks:'backfilled from FiiMonthlyReports',paymentDate:'2026-09-01',lastDatePrior:'2026-09-01'}]});assert.equal(div.added,1);
  assert.equal((await api('/api/official/provider-dividends')).observations[0].eligibleForCalendar,false);
  assert.equal((await api('/api/data/health-v13')).sourceRecords.syntheticDividendDates,1);
  const tax=await api('/api/tax/workpaper?year=2026');assert.equal(tax.canCertify,false);
  const alt=await api('/api/portfolios','POST',{name:'Carteira alternativa'},201);portfolio=alt.portfolio.id;
  assert.equal((await api('/api/official/cvm-quarterly')).entries,0);assert.equal((await api('/api/official/provider-dividends')).observations.length,0);
  assert.equal((await api('/api/data/health-v13')).sourceRecords.cvmQuarterly,0);
 }finally{await stopAndRemove(child,dir);}
});

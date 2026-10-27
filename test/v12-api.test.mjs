import {expectedMetricsVersion} from './helpers/expected-metrics-version.mjs';
import {stopAndRemove} from './helpers/windows-cleanup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import net from 'node:net';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function freePort(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
test('v1.2 API completa: CVM CSV, conciliação de rendimentos, isolamento de carteiras e proteção de dados',{timeout:30000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-v12-')),port=await freePort(),child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),METRICS_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 try{
  let log='';const launch=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Não iniciou: '+log)),10000);for(const io of [child.stdout,child.stderr])io.on('data',b=>{log+=b.toString();const m=log.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});});
  const origin=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(origin+'/api/official/cvm')).status,401);
  const auth=await fetch(launch,{redirect:'manual'}),cookie=auth.headers.get('set-cookie').split(';')[0];let activeId=null;
  const api=async(path,method='GET',data,status=200)=>{const r=await fetch(origin+path,{method,headers:{cookie,'x-metrics-local':'1',...(activeId?{'x-metrics-portfolio-id':activeId}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const raw=await r.text();assert.equal(r.status,status,raw.slice(0,500));return JSON.parse(raw);};
  assert.equal((await api('/api/health')).version,expectedMetricsVersion);
  await api('/api/transactions','POST',{ticker:'MXRF11',type:'BUY',date:'2026-01-01',quantity:10,price:10},201);
  await api('/api/transactions','POST',{ticker:'MXRF11',type:'DIVIDEND',date:'2026-09-10',amount:1.0},201);
  await api('/api/events','POST',{ticker:'MXRF11',date:'2026-09-10',recordDate:'2026-09-01',perShare:0.1,kind:'CONFIRMADO',source:'Documento registrado'},201);
  const inc=await api('/api/income/reconcile?from=2026-09-01&to=2026-09-30');assert.equal(inc.counts.CONCILIADO,1);
  assert.equal((await api('/api/data/coverage')).quotes[0].quality,'AUSENTE');
  const csv='CNPJ_Fundo;Data_Referencia;Patrimonio_Liquido;Valor_Patrimonial_Cotas\n12.345.678/0001-95;2026-08-31;2000000,00;10,15\n12.345.678/0001-95;2026-09-30;2100000,00;10,30\n';
  const payload={data:Buffer.from(csv).toString('base64'),tickerMap:{'12345678000195':'MXRF11'}};
  assert.equal((await api('/api/official/cvm/preview','POST',payload)).entries.length,2);
  const first=await api('/api/official/cvm/import','POST',payload);assert.equal(first.inserted,2);
  const twice=await api('/api/official/cvm/import','POST',payload);assert.equal(twice.duplicates,2);
  const cvm=await api('/api/official/cvm');assert.equal(cvm.latest[0].indicators.navPerShare,10.30);assert.equal(cvm.latest[0].referenceDate,'2026-09-30');
  assert.equal((await api('/api/state')).cvmReports,2);
  const p=await api('/api/portfolios','POST',{name:'Outra carteira'},201);activeId=p.portfolio.id;
  assert.equal((await api('/api/official/cvm')).observations,0);
  assert.equal((await api('/api/income/reconcile')).events.length,0);
  assert.equal((await api('/api/data/coverage')).quotes.length,0);
 }finally{await stopAndRemove(child,dir);}
});

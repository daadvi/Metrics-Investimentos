import {expectedMetricsVersion} from './helpers/expected-metrics-version.mjs';
import {stopAndRemove} from './helpers/windows-cleanup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import net from 'node:net';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function freePort(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
test('API multiativos: segregação internacional, renda fixa, câmbio, fiscais, notícias, carteira isolada',{timeout:30000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-v11-')),port=await freePort();const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),METRICS_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 try{
  let log='';const launch=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Servidor não iniciou: '+log)),8000);for(const io of [child.stdout,child.stderr])io.on('data',b=>{log+=b.toString();const m=log.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});});
  const base=`http://127.0.0.1:${port}`;assert.equal((await fetch(base+'/api/asset-classes')).status,401);
  const login=await fetch(launch,{redirect:'manual'}),cookie=login.headers.get('set-cookie').split(';')[0];let portfolioId=null;
  const api=async(u,m='GET',data,status=200)=>{const r=await fetch(base+u,{method:m,headers:{cookie,'x-metrics-local':'1',...(portfolioId?{'x-metrics-portfolio-id':portfolioId}:{}),...(data===undefined?{}:{'content-type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});const msg=await r.text();assert.equal(r.status,status,`${u} ${msg.slice(0,500)}`);return JSON.parse(msg);};
  assert.equal((await api('/api/health')).version,expectedMetricsVersion);
  await api('/api/instruments','POST',{ticker:'AAPL',assetClass:'STOCK_FOREIGN',currency:'USD'},201);
  const refused=await api('/api/transactions','POST',{ticker:'AAPL',type:'BUY',date:'2026-03-01',quantity:2,price:100},400);assert.match(refused.error,/moeda estrangeira/i);
  await api('/api/foreign/trades','POST',{ticker:'AAPL',type:'BUY',date:'2026-03-01',currency:'USD',quantity:2,price:100},201);
  assert.equal((await api('/api/state')).foreignPositions[0].cost,200);
  const foreignEntry=(await api('/api/state')).foreignTrades[0];
  await api('/api/foreign/trades/'+foreignEntry.id,'PUT',{quantity:3,price:110});
  assert.equal((await api('/api/state')).foreignPositions[0].cost,330);
  const audit=(await api('/api/state')).foreignAudit.filter(x=>!x.undoneAt).at(-1);
  await api('/api/foreign/undo','POST',{auditId:audit.id});
  assert.equal((await api('/api/state')).foreignPositions[0].cost,200);
  const contract=await api('/api/fixed-income','POST',{ticker:'CDB27',principal:1000,startDate:'2026-01-01',maturityDate:'2027-01-01',rateKind:'PREFIXED',annualRate:10},201);
  await api('/api/fixed-income/'+contract.contract.id,'PUT',{annualRate:11});
  await api('/api/fixed-income/'+contract.contract.id+'/redeem','POST',{date:'2026-09-01',principal:200,received:210});
  assert.equal((await api('/api/asset-classes?date=2026-10-24')).fixedIncome.positions[0].remainingPrincipal,800);
  await api('/api/fx/manual','POST',{date:'2026-10-23',currency:'USD',rate:5.5});
  assert.equal((await api('/api/fx/convert?amount=100&currency=USD&date=2026-10-24')).converted,550);
  await api('/api/transactions','POST',{ticker:'MXRF11',type:'BUY',date:'2025-01-01',quantity:10,price:10},201);
  await api('/api/transactions','POST',{ticker:'MXRF11',type:'DIVIDEND',date:'2025-05-01',amount:10},201);
  await api('/api/tax/evidence','POST',{ticker:'MXRF11',year:2025,nature:'DIVIDEND',amount:10,source:'Informe anual demonstrativo'},201);
  const fiscal=await api('/api/tax/dossier?year=2025');assert.equal(fiscal.readyForFiling,false);assert.equal(fiscal.incomeDiscrepancies[0].status,'CONCILIADO_ARITMETICAMENTE');
  await api('/api/notices','POST',{ticker:'MXRF11',date:'2026-10-24',title:'Resultado publicado',source:'Fundo',url:'https://example.org/resultado'},201);
  assert.equal((await api('/api/state')).notices.length,1);
  const newly=await api('/api/portfolios','POST',{name:'Carteira separada'},201);
  portfolioId=newly.portfolio.id;
  assert.equal((await api('/api/state')).foreignTrades.length,0);assert.equal((await api('/api/asset-classes')).fixedIncome.positions.length,0);assert.equal((await api('/api/tax/dossier?year=2025')).incomeDiscrepancies.length,0);
 }finally{await stopAndRemove(child,dir);}
});

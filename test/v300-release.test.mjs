import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
const port=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});
async function stop(child){if(child.exitCode!==null)return;const closed=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await Promise.race([closed,new Promise(resolve=>setTimeout(resolve,4000))]);if(child.exitCode===null){child.kill('SIGKILL');await Promise.race([closed,new Promise(resolve=>setTimeout(resolve,2000))]);}}
test('3.0: versão é estável e todos os testes leem o pacote',()=>{assert.equal(pkg.version,'3.0.0');assert.ok(!pkg.version.includes('preview'));assert.ok(pkg.scripts.test.includes('test/v300-release.test.mjs'));});
test('3.0: release gate executa Node sem shell para caminhos com espaços no Windows',()=>{
 const script=readFileSync(path.join(root,'scripts/release-gate.mjs'),'utf8');
 assert.match(script,/process\.platform==='win32'&&cmd==='npm'/);
 assert.match(script,/stdio:'inherit',shell,timeout:/);
 assert.doesNotMatch(script,/shell:process\.platform==='win32'/);
 const check=spawnSync(process.execPath,['--check','server.mjs'],{cwd:root,shell:false,encoding:'utf8',timeout:10000});
 assert.equal(check.status,0,check.stderr||String(check.error||''));
});
test('3.0: atalhos e formulários não executam forEach em um único nó DOM',()=>{const source=readFileSync(path.join(root,'web/app.js'),'utf8');const invalid=[...source.matchAll(/(?<!\$)\$\([^)]*\)\.forEach/g)].map(x=>({line:source.slice(0,x.index).split('\n').length,selector:x[0]}));assert.deepEqual(invalid,[],'Uso de querySelector no lugar de querySelectorAll: '+JSON.stringify(invalid));});
test('3.0: API local inicia, autentica, isola carteiras e responde com a versão do pacote',{timeout:35000},async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'metrics-v300-e2e-')),p=await port();
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(p),METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:''},stdio:['ignore','pipe','pipe'],windowsHide:true});
 try{
  const url=await new Promise((resolve,reject)=>{let logs='';const timer=setTimeout(()=>{reject(Error('Timeout de inicialização: '+logs.slice(-800)));},20000);const found=b=>{logs+=b.toString();const m=logs.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}};child.stdout.on('data',found);child.stderr.on('data',found);child.once('error',e=>{clearTimeout(timer);reject(e)});child.once('exit',code=>{clearTimeout(timer);reject(Error('Servidor encerrou com '+code+' '+logs.slice(-800)))});});
  const host='http://127.0.0.1:'+p;
  assert.equal((await fetch(host+'/api/health')).status,401);
  const login=await fetch(url,{redirect:'manual'});assert.equal(login.status,303);
  const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
  const req=async(route,method='GET',data,portfolioId)=>{const response=await fetch(host+route,{method,headers:{Cookie:cookie,'X-Metrics-Local':'1',...(portfolioId?{'X-Metrics-Portfolio-ID':portfolioId}:{}),...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,data:await response.json()};};
  const health=await req('/api/health');assert.equal(health.status,200);assert.equal(health.data.version,pkg.version);
  const settings=await req('/api/portfolios');assert.equal(settings.status,200);const primary=settings.data.activePortfolioId;
  const second=await req('/api/portfolios','POST',{name:'Teste de isolamento 3.0'});assert.equal(second.status,201);const id=second.data.portfolio.id;
  const trade=await req('/api/transactions','POST',{type:'BUY',ticker:'PETR4',date:'2026-01-10',quantity:3,price:20},primary);assert.equal(trade.status,201);
  const a=await req('/api/state','GET',undefined,primary),b=await req('/api/state','GET',undefined,id);
  assert.equal(a.data.transactions.length,1);assert.equal(b.data.transactions.length,0);
  assert.equal((await req('/api/v30/quality','GET',undefined,id)).status,200);
  assert.equal((await req('/api/v30/provider-health','GET',undefined,id)).status,200);
  assert.equal((await req('/api/v30/compare?tickers=PETR4,VALE3','GET',undefined,id)).status,200);
 }finally{await stop(child);try{rmSync(dir,{recursive:true,force:true,maxRetries:15,retryDelay:350});}catch(e){console.warn('Diretório temporário:',e.message);}}
});

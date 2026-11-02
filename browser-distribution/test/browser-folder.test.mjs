import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const kit=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(f,{limit=5000}={})=>{const now=Date.now();while(Date.now()-now<limit){if(f())return;await sleep(50);}throw Error('Timeout');};
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'metrics-folder-test-'));for(const d of ['codigo','codigo/web','codigo/src','codigo/community-examples','codigo/node_modules/pdfjs-dist'])fs.mkdirSync(path.join(dir,d),{recursive:true});fs.copyFileSync(path.join(kit,'browser-host.mjs'),path.join(dir,'browser-host.mjs'));fs.writeFileSync(path.join(dir,'codigo','server.mjs'),`import http from 'node:http'; const port=Number(process.env.PORT);http.createServer((r,s)=>{s.writeHead(200);s.end('test');}).listen(port,'127.0.0.1',()=>console.log('METRICS_LAUNCH_URL=http://127.0.0.1:'+port+'/?access='+('a'.repeat(64))));`);fs.writeFileSync(path.join(dir,'codigo','package.json'),'{}');fs.writeFileSync(path.join(dir,'codigo','package-lock.json'),'{}');fs.writeFileSync(path.join(dir,'codigo','launcher.mjs'),'');fs.writeFileSync(path.join(dir,'codigo','src','store.mjs'),'export const x=1;');fs.writeFileSync(path.join(dir,'codigo','web','index.html'),'Hello');fs.writeFileSync(path.join(dir,'codigo','node_modules','pdfjs-dist','index.js'),'');return dir;}
test('Servidor oculto: inicia, reutiliza a mesma instancia e encerra sem expor token em arquivo',{timeout:16000},async()=>{
 const dir=fixture(),local=path.join(dir,'local'),script=path.join(dir,'browser-host.mjs');const env={...process.env,LOCALAPPDATA:local,METRICS_TEST_NO_BROWSER:'1'};const first=spawn(process.execPath,[script],{cwd:dir,env,stdio:'ignore'});let second,stop;
 try{
  const control=path.join(local,'Metrics-Investimentos','browser-control.json');await wait(()=>fs.existsSync(control));const log=path.join(local,'Metrics-Investimentos','browser-launcher.log');await wait(()=>fs.existsSync(log)&&fs.readFileSync(log,'utf8').includes('READY'),{limit:8000});
  second=spawnSync(process.execPath,[script],{cwd:dir,env,encoding:'utf8',timeout:3000});assert.equal(second.status,0,second.stderr);
  assert.match(fs.readFileSync(log,'utf8'),/REOPENED_EXISTING/);
  assert.doesNotMatch(fs.readFileSync(control,'utf8'),/access=/);
  assert.doesNotMatch(fs.readFileSync(log,'utf8'),/access=[a-f0-9]{64}/);
  stop=spawnSync(process.execPath,[script,'--stop'],{cwd:dir,env,encoding:'utf8',timeout:3000});assert.equal(stop.status,0,stop.stderr);
  await wait(()=>!fs.existsSync(control));
 }finally{first.kill('SIGTERM');await new Promise(r=>first.once('exit',r)).catch(()=>{});fs.rmSync(dir,{recursive:true,force:true,maxRetries:4,retryDelay:80});}
});
test('Empacotador permite apenas lista positiva e entrega node runtime com todos os scripts',{timeout:12000},()=>{
 const root=fixture();try{
  fs.writeFileSync(path.join(root,'codigo','package.json'),JSON.stringify({version:'3.0.0'}));fs.copyFileSync(path.join(kit,'build-browser-windows.mjs'),path.join(root,'build-browser-windows.mjs'));
  for(const f of ['INICIAR_METRICS.vbs','FECHAR_METRICS.vbs','CRIAR_ATALHO.vbs','ABRIR_METRICS.html','Metrics.ico','GUIA_USUARIO.md'])fs.copyFileSync(path.join(kit,f),path.join(root,f));
  const out=path.join(root,'build','Metrics Investimentos');const p=spawnSync(process.execPath,[path.join(root,'build-browser-windows.mjs'),path.join(root,'codigo'),out,'--test-fixture'],{encoding:'utf8',timeout:10000});assert.equal(p.status,0,p.stderr);
  for(const f of ['runtime/node.exe','codigo/server.mjs','codigo/src/store.mjs','codigo/node_modules/pdfjs-dist/index.js','INICIAR_METRICS.vbs','CRIAR_ATALHO.vbs','ABRIR_METRICS.html','browser-host.mjs'])assert.ok(fs.existsSync(path.join(out,f)),f);
  assert.ok(fs.statSync(path.join(out,'runtime','node.exe')).size>0);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:4,retryDelay:80});}
});
test('Empacotador bloqueia accidental inclusion of SQLite files',{timeout:12000},()=>{
 const root=fixture();try{
  fs.writeFileSync(path.join(root,'codigo','package.json'),JSON.stringify({version:'3.0.0'}));
  fs.copyFileSync(path.join(kit,'build-browser-windows.mjs'),path.join(root,'build-browser-windows.mjs'));
  fs.writeFileSync(path.join(root,'codigo','src','dados.sqlite'),'dados privados');
  const p=spawnSync(process.execPath,[path.join(root,'build-browser-windows.mjs'),path.join(root,'codigo'),path.join(root,'out'),'--test-fixture'],{encoding:'utf8',timeout:10000});
  assert.notEqual(p.status,0);assert.match(p.stderr,/sensível|sqlite/);
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:4,retryDelay:80});}
});
test('HTML nao guarda URL de sessao; atalho usa protocolo local com registro opcional',()=>{
 const html=fs.readFileSync(path.join(kit,'ABRIR_METRICS.html'),'utf8');const script=fs.readFileSync(path.join(kit,'CRIAR_ATALHO.vbs'),'utf8');
 assert.match(html,/metrics-investimentos-local:\/\/abrir/);assert.doesNotMatch(html,/access=[0-9a-f]{64}/i);
 assert.match(script,/CreateShortcut/);assert.match(script,/HKCU\\Software\\Classes\\metrics-investimentos-local/);
 assert.match(script,/vbYesNo/);
});

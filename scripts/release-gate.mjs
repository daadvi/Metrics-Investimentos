#!/usr/bin/env node
/** Release gate: run from checkout. No personal finance data, no privileged network calls. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
function fail(msg){console.error('BLOQUEADO:',msg);process.exit(1);}
function run(cmd,args,env){
 // CRITICAL for Windows: never send the absolute Node executable through cmd.exe.
 // C:\Program Files\nodejs\node.exe must be launched directly with its args array.
 // npm is a Windows .cmd wrapper, so only npm needs the shell on that platform.
 const shell=process.platform==='win32'&&cmd==='npm';
 console.log('> '+(cmd.includes(' ')?JSON.stringify(cmd):cmd)+' '+args.join(' '));
 const r=spawnSync(cmd,args,{cwd:root,env:{...process.env,...env},stdio:'inherit',shell,timeout:180000,windowsHide:true});
 if(r.error)fail(r.error.message);
 if(r.status!==0)fail(cmd+' '+args.join(' ')+' saiu com '+r.status);
}
if(pkg.version!=='3.0.0')fail('Versão diferente de 3.0.0.');
if(!fs.existsSync(path.join(root,'package-lock.json')))fail('package-lock.json ausente. Execute npm install e inclua o lockfile no commit.');
const server=fs.readFileSync(path.join(root,'server.mjs'),'utf8');
if(!server.includes('const METRICS_RELEASE_VERSION='))fail('Servidor não lê a versão do pacote.');
const actualTest=fs.readFileSync(path.join(root,'test/v28-pdf-version-regression.test.mjs'),'utf8');
if(actualTest.includes('+-preview\\.'))fail('Regressão de versão ainda exige Preview.');
const files=['server.mjs','src/store.mjs','src/pdf.mjs','web/app.js','web/metrics-v30-shell.js','web/metrics-v30-ui.js','desktop/main.cjs'];
for(const p of files){if(!fs.existsSync(path.join(root,p)))fail('Arquivo principal ausente: '+p);run(process.execPath,['--check',p]);}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'metrics-release-check-'));
try{
  const env={METRICS_DATA_DIR:temp,METRICS_PASSPHRASE:'',NODE_ENV:'test'};
  run('npm',['test'],env);
  run('npm',['run','test:ui'],env);
}finally{try{fs.rmSync(temp,{recursive:true,force:true,maxRetries:12,retryDelay:350});}catch(e){console.warn('Diretório de teste remanescente:',e.message);}}
console.log('PASSOU: sintaxe, suíte integral e testes visuais no sistema operacional atual.');
console.log('Ainda requer validação nos outros SOs pelo GitHub Actions e testes de distribuição assinada.');

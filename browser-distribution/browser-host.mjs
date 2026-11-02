#!/usr/bin/env node
/** Metrics Browser: local server supervisor. It never writes the app login URL to disk. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {randomBytes,randomInt} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const APP=path.join(ROOT,'codigo');
const DATA=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),'Metrics-Investimentos');
const CONTROL=path.join(DATA,'browser-control.json');
const LOG=path.join(DATA,'browser-launcher.log');
const STOP=process.argv.includes('--stop');
fs.mkdirSync(DATA,{recursive:true,mode:0o700});
const mask=s=>String(s||'').replace(/(access=)[a-f0-9]+/gi,'$1[OCULTO]').slice(0,1300);
function writeLog(message){try{if(fs.existsSync(LOG)&&fs.statSync(LOG).size>128000)fs.renameSync(LOG,LOG+'.old');fs.appendFileSync(LOG,new Date().toISOString()+' '+mask(message)+'\n',{mode:0o600});}catch{}}
function readControl(){try{const v=JSON.parse(fs.readFileSync(CONTROL,'utf8'));return v&&Number.isInteger(v.port)&&v.port>0&&v.port<65536&&/^[a-f0-9]{48}$/.test(v.token)?v:null;}catch{return null;}}
function command(control,action){return new Promise(resolve=>{let finished=false,received='';const finish=ok=>{if(!finished){finished=true;s.destroy();resolve(ok);}};const s=net.createConnection({host:'127.0.0.1',port:control.port});s.setTimeout(1250);s.once('connect',()=>s.write(JSON.stringify({token:control.token,action})+'\n'));s.on('data',b=>{received+=b.toString();if(received.includes('\n'))finish(received.trim()==='ok');});s.on('error',()=>finish(false));s.on('timeout',()=>finish(false));s.on('close',()=>finish(false));});}
function openBrowser(url){
 if(process.env.METRICS_TEST_NO_BROWSER==='1'){writeLog('BROWSER_OPEN_TEST');return;}
 const platform=os.platform();let child;
 if(platform==='win32')child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,detached:true,stdio:'ignore'});
 else if(platform==='darwin')child=spawn('open',[url],{detached:true,stdio:'ignore'});
 else child=spawn('xdg-open',[url],{detached:true,stdio:'ignore'});
 child.once('error',e=>writeLog('Browser: '+e.message));child.unref();
}
const existing=readControl();
if(STOP){if(existing){const ok=await command(existing,'stop');writeLog(ok?'CLOSE_REQUESTED':'CLOSE_NOT_AVAILABLE');process.exitCode=ok?0:1;}else{writeLog('ALREADY_STOPPED');} }
else {
 if(existing&&await command(existing,'open')){writeLog('REOPENED_EXISTING');}
 else {
  if(!fs.existsSync(path.join(APP,'server.mjs'))){writeLog('ERRO: codigo/server.mjs ausente. Extraia a pasta completa gerada pelo Actions.');process.exitCode=2;}
  else {
   const token=randomBytes(24).toString('hex');
   let backend=null,authUrl='',isStopping=false,requested=1;
   const controlServer=net.createServer(socket=>{let buf='';socket.setTimeout(2000);socket.on('data',b=>{buf+=b.toString();if(buf.length>1024){socket.destroy();return;}if(!buf.includes('\n'))return;try{const c=JSON.parse(buf.trim());if(c.token!==token)throw Error('Unauthorized');if(c.action==='open'){if(authUrl)openBrowser(authUrl);else requested++;socket.end('ok\n');}else if(c.action==='stop'){socket.end('ok\n');shutdown();}else socket.end('invalid\n');}catch{socket.end('invalid\n');}});});
   function cleanup(){try{const own=readControl();if(own?.token===token)fs.rmSync(CONTROL,{force:true});}catch{}try{controlServer.close();}catch{}}
   function shutdown(){if(isStopping)return;isStopping=true;writeLog('STOPPING');backend?.kill('SIGTERM');setTimeout(()=>{if(backend&&!backend.killed)backend.kill('SIGKILL');cleanup();process.exit(0);},1500).unref();}
   const ready=await new Promise((resolve,reject)=>{controlServer.once('error',reject);controlServer.listen(0,'127.0.0.1',()=>resolve(controlServer.address().port));});
   fs.writeFileSync(CONTROL,JSON.stringify({port:ready,token}),{mode:0o600});
   const port=String(44000+randomInt(0,12000));
   backend=spawn(process.execPath,['server.mjs'],{cwd:APP,env:{...process.env,PORT:port},windowsHide:true,stdio:['ignore','pipe','pipe']});
   let line='';
   backend.stdout.on('data',chunk=>{line+=chunk.toString();if(line.length>8000)line=line.slice(-4000);const m=line.match(/METRICS_LAUNCH_URL=(http:\/\/127\.0\.0\.1:\d+\/\?access=[a-f0-9]{64})/);if(m&&!authUrl){authUrl=m[1];writeLog('READY port='+port);if(requested){openBrowser(authUrl);requested=0;}line='';}});
   backend.stderr.on('data',b=>writeLog('SERVER_ERROR '+b.toString()));
   backend.on('error',e=>{writeLog('SERVER_START_ERROR '+e.message);cleanup();process.exitCode=1;});
   backend.once('exit',(code,signal)=>{writeLog('SERVER_EXIT '+String(code??signal));cleanup();if(!isStopping)process.exitCode=code||1;controlServer.close();});
   process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
   writeLog('STARTED (localhost only)');
  }
 }
}

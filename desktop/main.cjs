'use strict';
// Desktop shell: no Node integration or IPC exposed to renderer.
const {app,BrowserWindow,session,dialog,safeStorage,shell} = require('electron');
const {spawn} = require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const net=require('node:net');
let allowedOrigin=null; // Restrict desktop navigation to the launched Metrics server
let backend=null,win=null,opened=false;
function osProtectedKey(){
 // DPAPI on Windows, macOS Keychain and a non-basic secure store on supported Linux systems.
 const backend=process.platform==='linux'&&safeStorage.getSelectedStorageBackend?.();
 if(!safeStorage.isEncryptionAvailable()||backend==='basic_text')return null;
 const storage=app.getPath('userData');fs.mkdirSync(storage,{recursive:true});
 const keyFile=path.join(storage,'device-key.bin');
 if(fs.existsSync(keyFile)){
  try{return safeStorage.decryptString(fs.readFileSync(keyFile));}
  catch(e){throw Error('A chave do banco local não pôde ser recuperada. Restaure um backup criptografado.');}
 }
 const key=crypto.randomBytes(32).toString('hex');
 const encrypted=safeStorage.encryptString(key);fs.writeFileSync(keyFile,encrypted,{mode:0o600,flag:'wx'});
 return key;
}
function launch(){
 const root=app.getAppPath();
 const port=44000+crypto.randomInt(0,12000);
 const passphrase=process.env.METRICS_PASSPHRASE||osProtectedKey();
 const config={...process.env,PORT:String(port),METRICS_DATA_DIR:path.join(app.getPath('userData'),'dados'),...(passphrase?{METRICS_PASSPHRASE:passphrase,METRICS_MIGRATE_ENCRYPT:'1'}:{})};
 // ELECTRON_RUN_AS_NODE uses packaged Electron as Node runtime; no Node installation required.
 backend=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env:{...config,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let buffer='';const timeout=setTimeout(()=>{if(!opened)dialog.showErrorBox('Metrics','A API local não iniciou. Confira os logs e a versão do aplicativo.');},18000);
 backend.stdout.on('data',c=>{
  buffer+=c.toString();if(buffer.length>4000)buffer=buffer.slice(-2500);
  const m=buffer.match(/METRICS_LAUNCH_URL=(http:\/\/127\.0\.0\.1:\d+\/\?access=[a-f0-9]+)/);
  if(m&&!opened){opened=true;allowedOrigin=new URL(m[1]).origin;clearTimeout(timeout);win.loadURL(m[1]);}
 });
 backend.stderr.on('data',d=>console.error('Metrics backend:',d.toString().slice(0,300)));
 backend.once('exit',code=>{if(!app.isQuitting){dialog.showErrorBox('Metrics','Servidor local finalizado inesperadamente ('+code+').');app.quit();}});
}
app.whenReady().then(()=>{
 win=new BrowserWindow({width:1280,height:850,minWidth:920,minHeight:620,title:'Metrics Investimentos',show:true,backgroundColor:'#0b1220',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(({url})=>{try{
  const u=new URL(url);const allowed=new Set(['www.gov.br','investidor.b3.com.br','www.b3.com.br','dados.cvm.gov.br','olinda.bcb.gov.br']);
  if(u.protocol==='https:'&&!u.username&&!u.password&&!net.isIP(u.hostname)&&u.hostname!=='localhost'){
   let approved=allowed.has(u.hostname);
   if(!approved)approved=dialog.showMessageBoxSync(win,{type:'question',buttons:['Cancelar','Abrir no navegador'],defaultId:0,cancelId:0,title:'Abrir fonte externa',message:'Deseja abrir este site fora do Metrics?',detail:u.origin})===1;
   if(approved)shell.openExternal(url);
  }
 }catch{}return {action:'deny'};});
 for(const kind of ['will-navigate','will-redirect'])win.webContents.on(kind,(event,url)=>{try{if(!allowedOrigin||new URL(url).origin!==allowedOrigin)event.preventDefault();}catch{event.preventDefault();}});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 win.on('closed',()=>app.quit());
 try{launch();}catch(e){dialog.showErrorBox('Metrics - dados protegidos',String(e.message||e));app.quit();}
});
app.on('before-quit',()=>{app.isQuitting=true;if(backend&&!backend.killed)backend.kill('SIGTERM');});
app.on('window-all-closed',()=>app.quit());

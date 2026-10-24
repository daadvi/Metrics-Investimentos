'use strict';
// Desktop shell: no Node integration or IPC exposed to renderer.
const {app,BrowserWindow,session,dialog} = require('electron');
const {spawn} = require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
let backend=null,win=null,opened=false;
function launch(){
 const root=app.getAppPath();
 const port=44000+crypto.randomInt(0,12000);
 const config={...process.env,PORT:String(port),METRICS_DATA_DIR:path.join(app.getPath('userData'),'dados')};
 // ELECTRON_RUN_AS_NODE uses packaged Electron as Node runtime; no Node installation required.
 backend=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env:{...config,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let buffer='';const timeout=setTimeout(()=>{if(!opened)dialog.showErrorBox('Metrics','A API local não iniciou. Confira os logs e a versão do aplicativo.');},18000);
 backend.stdout.on('data',c=>{
  buffer+=c.toString();if(buffer.length>4000)buffer=buffer.slice(-2500);
  const m=buffer.match(/METRICS_LAUNCH_URL=(http:\/\/127\.0\.0\.1:\d+\/\?access=[a-f0-9]+)/);
  if(m&&!opened){opened=true;clearTimeout(timeout);win.loadURL(m[1]);}
 });
 backend.stderr.on('data',d=>console.error('Metrics backend:',d.toString().slice(0,300)));
 backend.once('exit',code=>{if(!app.isQuitting){dialog.showErrorBox('Metrics','Servidor local finalizado inesperadamente ('+code+').');app.quit();}});
}
app.whenReady().then(()=>{
 win=new BrowserWindow({width:1280,height:850,minWidth:920,minHeight:620,title:'Metrics Investimentos',show:true,backgroundColor:'#0b1220',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('http://127.0.0.1:'))event.preventDefault();});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 win.on('closed',()=>app.quit());
 launch();
});
app.on('before-quit',()=>{app.isQuitting=true;if(backend&&!backend.killed)backend.kill('SIGTERM');});
app.on('window-all-closed',()=>app.quit());

// Iniciador seguro para Linux, Windows e macOS. Não abre uma porta acessível na rede.
import {randomInt} from 'node:crypto';
import {spawn} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const port=process.env.PORT||String(44000+randomInt(0,12000));
const child=spawn(process.execPath,['server.mjs'],{cwd:ROOT,env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe']});
let opened=false,buffer='';
function open(url){if(opened)return;opened=true;const linuxNames=['chromium','chromium-browser','google-chrome','google-chrome-stable','microsoft-edge'];
 if(os.platform()==='win32'){const p=spawn('cmd',['/c','start','',url],{stdio:'ignore',windowsHide:true});p.unref();}
 else if(os.platform()==='darwin'){const p=spawn('open',[url],{stdio:'ignore'});p.unref();}
 else {let index=0;const tryNext=()=>{if(index>=linuxNames.length){const browser=spawn('xdg-open',[url],{stdio:'ignore'});browser.once('error',e=>console.error('Falha ao abrir navegador:',e.message));console.log('Navegador padrão solicitado; mantenha este processo aberto enquanto usa o Metrics.');return;}const p=spawn(linuxNames[index++],[`--app=${url}`,'--no-first-run',`--user-data-dir=${path.join(os.homedir(),'.config','metrics-investimentos-browser')}`],{stdio:'ignore'});p.once('error',tryNext);p.once('exit',()=>{if(opened){console.log('Janela encerrada; fechando servidor local.');child.kill('SIGTERM');}});};tryNext();}
 console.log('Janela Metrics solicitada. Se não abrir, copie o endereço local indicado acima.');}
child.stdout.on('data',chunk=>{const text=chunk.toString();process.stdout.write(text);buffer+=text;const m=buffer.match(/METRICS_LAUNCH_URL=(https?:\/\/[^\s]+)/);if(m){open(m[1]);buffer='';}if(buffer.length>2000)buffer=buffer.slice(-1000);});
child.stderr.on('data',x=>process.stderr.write(x));
child.on('exit',(code)=>{console.log('Servidor Metrics finalizado:',code??'sinal');process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill(signal);});

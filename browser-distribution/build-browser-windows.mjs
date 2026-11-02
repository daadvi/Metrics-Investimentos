#!/usr/bin/env node
/** Build only the app's runtime and public source. Never include user data or .env. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const kit=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(process.argv[2]||path.join(kit,'codigo'));
const dest=path.resolve(process.argv[3]||path.join(project,'dist','browser','Metrics Investimentos'));
const pkg=JSON.parse(fs.readFileSync(path.join(project,'package.json'),'utf8'));
if(!/^3\.0\./.test(pkg.version))throw Error('Empacotador requer base Metrics 3.0.x revisada.');
if(!fs.existsSync(path.join(project,'server.mjs'))||!fs.existsSync(path.join(project,'node_modules','pdfjs-dist')))throw Error('Aplicação e dependências de produção ausentes. Rode npm ci --omit=dev.');
if(process.platform!=='win32'&&!process.argv.includes('--test-fixture'))throw Error('Pacote Windows deve ser gerado no Windows pelo GitHub Actions.');
if(fs.existsSync(dest))fs.rmSync(dest,{recursive:true,force:true});
fs.mkdirSync(path.join(dest,'codigo'),{recursive:true});fs.mkdirSync(path.join(dest,'runtime'),{recursive:true});
const forbidden=/(^|[\\/])(\.env(?:\.|$)|dados|backups?|recuperacao|\.git|test-results)([\\/]|$)|\.(?:sqlite|sqlite3|db|bak|pem|key)$/i;
function copySafe(from,to){const relative=path.relative(project,from);if(forbidden.test(relative))throw Error('Arquivo sensível no pacote: '+relative);const info=fs.lstatSync(from);if(info.isSymbolicLink())throw Error('Links simbólicos não são permitidos: '+relative);if(info.isDirectory()){fs.mkdirSync(to,{recursive:true});for(const name of fs.readdirSync(from))copySafe(path.join(from,name),path.join(to,name));}else if(info.isFile())fs.copyFileSync(from,to);}
for(const file of ['server.mjs','package.json','package-lock.json','launcher.mjs'])copySafe(path.join(project,file),path.join(dest,'codigo',file));
for(const dir of ['src','web','community-examples','node_modules'])if(fs.existsSync(path.join(project,dir)))copySafe(path.join(project,dir),path.join(dest,'codigo',dir));
for(const file of ['INICIAR_METRICS.vbs','FECHAR_METRICS.vbs','CRIAR_ATALHO.vbs','ABRIR_METRICS.html','browser-host.mjs','Metrics.ico','GUIA_USUARIO.md'])fs.copyFileSync(path.join(kit,file),path.join(dest,file));
fs.copyFileSync(process.execPath,path.join(dest,'runtime','node.exe'));
if(fs.existsSync(path.join(project,'LICENSE')))fs.copyFileSync(path.join(project,'LICENSE'),path.join(dest,'LICENSE'));
console.log('PACOTE_WINDOWS_PRONTO '+dest);

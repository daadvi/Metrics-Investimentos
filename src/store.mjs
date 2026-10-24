import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash,randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {calculatePositions,validateTransaction,validateWatch,tickerOf} from './domain.mjs';
const DIR=process.env.METRICS_DATA_DIR||path.join(os.homedir(),'.metrics-investimentos');
const DB=path.join(DIR,'metrics.sqlite');
const LEGACY=path.join(DIR,'metrics.json');
let sql;
const ENCRYPT=String(process.env.METRICS_PASSPHRASE||'');
const fresh=()=>({schema:2,transactions:[],watchlist:[],messages:[],quotes:[],documents:[],imports:[],profiles:[],events:[],settings:{theme:'dark'}});
export function location(){return DIR;}
function key(salt){return scryptSync(ENCRYPT,salt,32);}
function pack(db){const plaintext=JSON.stringify(db);
 if(!ENCRYPT)return plaintext;
 const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(salt),iv);
 const ct=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
 return JSON.stringify({encrypted:true,v:1,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ct.toString('base64')});
}
function unpack(s){const d=JSON.parse(s);if(!d.encrypted){if(ENCRYPT)throw new Error('Banco antigo sem criptografia. Faça backup e migração antes de ativar a senha.');return normalize(d);}
 if(!ENCRYPT)throw new Error('Este banco está criptografado. Defina METRICS_PASSPHRASE ao iniciar.');
 try{const decipher=createDecipheriv('aes-256-gcm',key(Buffer.from(d.salt,'base64')),Buffer.from(d.iv,'base64'));decipher.setAuthTag(Buffer.from(d.tag,'base64'));return normalize(JSON.parse(Buffer.concat([decipher.update(Buffer.from(d.data,'base64')),decipher.final()]).toString('utf8')));}catch{throw new Error('Senha de dados incorreta ou banco danificado.');}
}
function normalize(raw){const d=raw&&typeof raw==='object'?raw:fresh();for(const k of ['transactions','watchlist','messages','quotes','documents','imports','profiles','events'])if(!Array.isArray(d[k]))d[k]=[];if(!d.settings||typeof d.settings!=='object')d.settings={};d.schema=2;return d;}
function dbGet(){const row=sql.prepare('SELECT content FROM storage WHERE id=1').get();return unpack(row.content);}
function dbPut(data){sql.prepare('UPDATE storage SET content=?,updated_at=? WHERE id=1').run(pack(data),new Date().toISOString());}
export async function init(){await fs.mkdir(DIR,{recursive:true,mode:0o700});sql=new DatabaseSync(DB);sql.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS storage(id INTEGER PRIMARY KEY CHECK(id=1), content TEXT NOT NULL, updated_at TEXT NOT NULL)');const entry=sql.prepare('SELECT id FROM storage WHERE id=1').get();if(!entry){let db=fresh();try{db=normalize(JSON.parse(await fs.readFile(LEGACY,'utf8')));await fs.copyFile(LEGACY,LEGACY+'.backup-before-sqlite');}catch(e){if(e.code!=='ENOENT')throw e;}sql.prepare('INSERT INTO storage(id,content,updated_at) VALUES(1,?,?)').run(pack(db),new Date().toISOString());}else dbGet();try{await fs.chmod(DB,0o600);}catch{} }
export async function read(){return dbGet();}
let tail=Promise.resolve();
export async function change(fn){const task=tail.then(async()=>{sql.exec('BEGIN IMMEDIATE');try{const db=dbGet();const result=await fn(db);dbPut(db);sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}});tail=task.catch(()=>{});return task;}
export async function addTransaction(raw){return change(db=>{const t={...validateTransaction(raw),id:randomUUID(),createdAt:new Date().toISOString(),source:['manual','csv','xlsx','b3'].includes(raw.source)?raw.source:'manual'};calculatePositions([...db.transactions,t]);db.transactions.push(t);return t;});}
export async function addTransactionsBulk(rows,sourceName='Arquivo importado',overwriteDuplicates=false){return change(db=>{
 if(!Array.isArray(rows)||rows.length>10000||rows.length===0)throw new Error('Informe até 10.000 linhas válidas.');
 const fingerprint=t=>createHash('sha256').update([t.date,t.ticker,t.type,t.quantity,t.price,t.fee,t.amount].join('|')).digest('hex');
 const known=new Set(db.transactions.map(fingerprint));const newOnes=[];let repeated=0;
 for(const raw of rows){const t=validateTransaction(raw),fp=fingerprint(t);if(known.has(fp)&&!overwriteDuplicates){repeated++;continue;}known.add(fp);newOnes.push({...t,id:randomUUID(),createdAt:new Date().toISOString(),source:['csv','xlsx','b3'].includes(raw.source)?raw.source:'csv',importBatch:null});}
 const batchId=randomUUID();for(const t of newOnes)t.importBatch=batchId;
 calculatePositions([...db.transactions,...newOnes]);db.transactions.push(...newOnes);
 const batch={id:batchId,date:new Date().toISOString(),name:String(sourceName).slice(0,160),added:newOnes.length,duplicates:repeated};db.imports.push(batch);
 return batch;
 });}
export async function rollbackImport(id){return change(db=>{const batch=db.imports.find(x=>x.id===id);if(!batch)throw new Error('Importação não encontrada.');const after=db.transactions.filter(t=>t.importBatch!==id);calculatePositions(after);db.transactions=after;db.imports=db.imports.filter(x=>x.id!==id);return {removed:batch.added};});}
export async function addWatch(raw){return change(db=>{const w={...validateWatch(raw),id:randomUUID()};if(db.watchlist.some(x=>x.ticker===w.ticker))throw new Error('Ticker já está na lista de desejos.');db.watchlist.push(w);return w;});}
export async function editWatch(id,raw){return change(db=>{const index=db.watchlist.findIndex(x=>x.id===id);if(index<0)throw new Error('Ativo não encontrado.');const w=validateWatch({...db.watchlist[index],...raw});if(db.watchlist.some(x=>x.ticker===w.ticker&&x.id!==id))throw new Error('Ticker duplicado.');db.watchlist[index]={...db.watchlist[index],...w,createdAt:db.watchlist[index].createdAt};return db.watchlist[index];});}
export async function saveQuote(raw){return change(db=>{const ticker=tickerOf(raw.ticker),price=Number(raw.price);if(!Number.isFinite(price)||price<=0||price>1e12)throw new Error('Preço inválido.');const date=String(raw.date??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z')))throw new Error('Data inválida.');const q={ticker,price:Math.round(price*10000)/10000,date,source:'informado pelo usuário',updatedAt:new Date().toISOString()};db.quotes=db.quotes.filter(x=>x.ticker!==ticker);db.quotes.push(q);return q;});}
export async function saveMarketQuotes(raw,meta={}){return change(db=>{
 if(!Array.isArray(raw)||raw.length>5000)throw Error('Lote de cotações inválido.');
 let updated=0,skipped=0,older=0;
 for(const item of raw){
  const ticker=tickerOf(item.ticker),price=Number(item.price),date=String(item.date||'');
  if(!Number.isFinite(price)||price<=0||price>1e9||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z')))throw Error('Cotação inválida: '+ticker);
  const old=db.quotes.find(x=>x.ticker===ticker);
  if(old&&old.date>date){older++;continue;}
  if(old&&old.date===date&&old.source==='informado pelo usuário'){skipped++;continue;}
  const q={ticker,price:Math.round(price*10000)/10000,date,source:'B3 COTAHIST (fechamento, sem ajustes)',updatedAt:new Date().toISOString()};
  db.quotes=db.quotes.filter(x=>x.ticker!==ticker);db.quotes.push(q);updated++;
 }
 db.settings.lastB3QuoteImport={at:new Date().toISOString(),date:raw.map(x=>x.date).sort().at(-1)||null,updated,source:String(meta.source||'Arquivo B3').slice(0,160)};
 return {updated,skipped,older,marketDataDate:db.settings.lastB3QuoteImport.date,source:db.settings.lastB3QuoteImport.source};
 });}
export async function saveProfile(raw){return change(db=>{
 const ticker=tickerOf(raw.ticker),type=String(raw.type||'OUTRO');
 if(!['FII_TIJOLO','FII_PAPEL','FII_HIBRIDO','ACAO','ETF','RENDA_FIXA','OUTRO'].includes(type))throw Error('Categoria não reconhecida.');
 const numbers={};for(const k of ['equity','assets','occupied','vacancy','dividend','dy12','debt']){
  const v=raw[k];if(v===undefined||v===null||String(v).trim()===''){numbers[k]=null;continue;}
  const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e15)throw Error('Indicador inválido: '+k);numbers[k]=n;
 }
 if(numbers.assets!==null&&numbers.occupied!==null&&numbers.occupied>numbers.assets)throw Error('Imóveis ocupados excedem total.');
 if(numbers.vacancy!==null&&numbers.vacancy>100)throw Error('Vacância maior que 100%.');
 const profile={ticker,type,name:String(raw.name||'').slice(0,110),sector:String(raw.sector||'').slice(0,120),manager:String(raw.manager||'').slice(0,100),source:String(raw.source||'Informado pelo usuário').slice(0,180),date:String(raw.date||'').slice(0,10),notes:String(raw.notes||'').slice(0,1200),...numbers,updatedAt:new Date().toISOString()};
 db.profiles=db.profiles.filter(x=>x.ticker!==ticker);db.profiles.push(profile);return profile;});}
export async function addEvent(raw){return change(db=>{
 const ticker=tickerOf(raw.ticker),date=String(raw.date||''),kind=String(raw.kind||'ESTIMADO');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z')))throw Error('Data inválida.');
 if(!['ESTIMADO','CONFIRMADO'].includes(kind))throw Error('Tipo de evento inválido.');
 const perShare=Number(raw.perShare);if(!Number.isFinite(perShare)||perShare<0||perShare>1000000)throw Error('Valor por cota inválido.');
 const event={id:randomUUID(),ticker,date,kind,perShare,note:String(raw.note||'').slice(0,250),source:String(raw.source||'Cadastrado pelo usuário').slice(0,120)};
 db.events.push(event);return event;});}
export async function addDocument(raw){return change(db=>{const title=String(raw.title||'').trim().slice(0,150),ticker=raw.ticker?tickerOf(raw.ticker):null,text=String(raw.text||'').trim();if(!title||text.length<15)throw new Error('Informe título e texto extraído de um documento.');if(text.length>400000)throw new Error('Documento excede 400 mil caracteres.');const d={id:randomUUID(),title,ticker,source:String(raw.source||'Arquivo do usuário').slice(0,150),referenceDate:String(raw.referenceDate||'').slice(0,10),uploadedAt:new Date().toISOString(),text};db.documents.push(d);return {...d,text:undefined,chars:text.length};});}
export async function removeItem(collection,id){if(!['watchlist','transactions','documents','quotes','profiles','events'].includes(collection))throw new Error('Coleção inválida.');return change(db=>{const prev=db[collection].length;db[collection]=db[collection].filter(i=>i.id!==id&&!(['quotes','profiles'].includes(collection)&&i.ticker===id));if(db[collection].length===prev)throw new Error('Registro não encontrado.');if(collection==='transactions')calculatePositions(db.transactions);return true;});}
export async function saveMessages(messages){return change(db=>{db.messages=messages.slice(-80).filter(x=>['assistant','user'].includes(x.role)&&typeof x.content==='string').map(x=>({role:x.role,content:x.content.slice(0,12000)}));return db.messages;});}
export async function clearMessages(){return change(db=>{db.messages=[];return true;});}
export async function restoreBackup(raw){return change(db=>{if(!raw||typeof raw!=='object'||!Array.isArray(raw.transactions)||!Array.isArray(raw.watchlist))throw new Error('Backup inválido.');const clean=normalize(structuredClone(raw));if(clean.transactions.length>100000||clean.watchlist.length>5000||clean.documents.length>5000)throw new Error('Backup grande demais.');for(const t of clean.transactions)validateTransaction(t);calculatePositions(clean.transactions);for(const w of clean.watchlist)validateWatch(w);for(const k of Object.keys(db))delete db[k];Object.assign(db,clean);return {transactions:db.transactions.length,watchlist:db.watchlist.length};});}
export function isEncrypted(){return !!ENCRYPT;}

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash,randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';
import {DatabaseSync,backup as backupSQLite} from 'node:sqlite';
import {AsyncLocalStorage} from 'node:async_hooks';
import {validateExtensionManifest,renderExtension} from './extensions.mjs';
import {calculatePositions,validateTransaction,validateWatch,tickerOf,validDate} from './domain.mjs';
import {validateInstrument,validateFixedIncome,fixedIncomeOverview} from './instrument-classes.mjs';
import {validateFxQuote} from './fx.mjs';
import {validateTaxEvidence} from './tax-dossier.mjs';
import {validateNotice} from './issuer-notices.mjs';
import {quarterlyOverview} from './cvm-quarterly.mjs';
import {validateForeignTrade,foreignPositions} from './foreign-ledger.mjs';
const DIR=process.env.METRICS_DATA_DIR||path.join(os.homedir(),'.metrics-investimentos');
const DB=path.join(DIR,'metrics.sqlite');
const LEGACY=path.join(DIR,'metrics.json');
let sql;
const portfolioScope=new AsyncLocalStorage();
export function withPortfolio(id,operation){if(id!==undefined&&id!==null&&!/^[a-f0-9-]{36}$/.test(String(id)))throw Error('Carteira solicitada inválida.');return portfolioScope.run(id||null,operation);}
const ENCRYPT=String(process.env.METRICS_PASSPHRASE||'');
const fresh=()=>({schema:6,instruments:[],fixedIncome:[],foreignTrades:[],foreignAudit:[],fxRates:[],taxEvidence:[],notices:[],transactions:[],transactionAudit:[],watchlist:[],messages:[],quotes:[],documents:[],imports:[],profiles:[],events:[],snapshots:[],quoteHistory:[],benchmarkCDI:[],cvmReports:[],cvmQuarterly:[],providerDividends:[],ipeIndex:[],cvmStatements:[],providerDividendFeed:[],foreignMarketQuotes:[],benchmarkIndex:{IBOVESPA:[],IFIX:[],IPCA:[]},providerResearch:[],settings:{theme:'dark'}});
export function location(){return DIR;}
function key(salt){return scryptSync(ENCRYPT,salt,32);}
function pack(db){const plaintext=JSON.stringify(db);
 if(!ENCRYPT)return plaintext;
 const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(salt),iv);
 const ct=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
 return JSON.stringify({encrypted:true,v:1,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ct.toString('base64')});
}
function unpack(s){const d=JSON.parse(s);if(!d.encrypted){if(ENCRYPT)throw new Error('Banco antigo sem criptografia. Faça backup e migração antes de ativar a senha.');return normalizeRoot(d);}
 if(!ENCRYPT)throw new Error('Este banco está criptografado. Defina METRICS_PASSPHRASE ao iniciar.');
 try{const decipher=createDecipheriv('aes-256-gcm',key(Buffer.from(d.salt,'base64')),Buffer.from(d.iv,'base64'));decipher.setAuthTag(Buffer.from(d.tag,'base64'));return normalizeRoot(JSON.parse(Buffer.concat([decipher.update(Buffer.from(d.data,'base64')),decipher.final()]).toString('utf8')));}catch{throw new Error('Senha de dados incorreta ou banco danificado.');}
}
function normalize(raw){const d=raw&&typeof raw==='object'?raw:fresh();for(const k of ['instruments','fixedIncome','foreignTrades','foreignAudit','fxRates','taxEvidence','notices','transactions','transactionAudit','watchlist','messages','quotes','documents','imports','profiles','events','snapshots','quoteHistory','benchmarkCDI','cvmReports','cvmQuarterly','providerDividends','ipeIndex','cvmStatements','providerDividendFeed','foreignMarketQuotes'])if(!Array.isArray(d[k]))d[k]=[];if(!d.settings||typeof d.settings!=='object')d.settings={};if(!d.benchmarkIndex||typeof d.benchmarkIndex!=='object')d.benchmarkIndex={IBOVESPA:[],IFIX:[],IPCA:[]};for(const k of ['IBOVESPA','IFIX','IPCA'])if(!Array.isArray(d.benchmarkIndex[k]))d.benchmarkIndex[k]=[];if(!Array.isArray(d.providerResearch))d.providerResearch=[];if(!d.extensionGrants||typeof d.extensionGrants!=='object'||Array.isArray(d.extensionGrants))d.extensionGrants={};d.schema=6;return d;}
function normalizeRoot(raw){
 if(raw&&[4,5,6].includes(raw.schema)&&Array.isArray(raw.portfolios)){
  const root=raw;root.schema=6; if(!root.portfolios.length)throw Error('Banco sem carteiras.');
  const ids=new Set();for(const p of root.portfolios){if(!p||typeof p.id!=='string'||ids.has(p.id))throw Error('Estrutura de carteiras inválida.');ids.add(p.id);p.data=normalize(p.data);}
  if(!ids.has(root.activePortfolioId))root.activePortfolioId=root.portfolios[0].id;
  if(!Array.isArray(root.extensions))root.extensions=[];return root;
 }
 const id=randomUUID();return {schema:6,activePortfolioId:id,portfolios:[{id,name:'Carteira principal',createdAt:new Date().toISOString(),data:normalize(raw)}],extensions:[]};
}
function selected(root){const id=portfolioScope.getStore()||root.activePortfolioId;const p=root.portfolios.find(x=>x.id===id);if(!p)throw Error('Carteira não encontrada ou removida.');return p;}
function dbGet(){const row=sql.prepare('SELECT content FROM storage WHERE id=1').get();return unpack(row.content);}
function dbPut(data){sql.prepare('UPDATE storage SET content=?,updated_at=? WHERE id=1').run(pack(data),new Date().toISOString());}
export async function init(){await fs.mkdir(DIR,{recursive:true,mode:0o700});sql=new DatabaseSync(DB);sql.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS storage(id INTEGER PRIMARY KEY CHECK(id=1), content TEXT NOT NULL, updated_at TEXT NOT NULL)');const entry=sql.prepare('SELECT id FROM storage WHERE id=1').get();if(!entry){let db=normalizeRoot(fresh());try{db=normalizeRoot(JSON.parse(await fs.readFile(LEGACY,'utf8')));await fs.copyFile(LEGACY,LEGACY+'.backup-before-sqlite');}catch(e){if(e.code!=='ENOENT')throw e;}sql.prepare('INSERT INTO storage(id,content,updated_at) VALUES(1,?,?)').run(pack(db),new Date().toISOString());}else {
 const row=sql.prepare('SELECT content FROM storage WHERE id=1').get();const persisted=JSON.parse(row.content);
 if(ENCRYPT&&!persisted.encrypted){
  // Explicit migration from v0.4 plaintext JSON to AES-GCM storage, in a SQL transaction.
  if(process.env.METRICS_MIGRATE_ENCRYPT!=='1')throw new Error('Dados antigos sem criptografia; ative migração autorizada ou faça backup.');
  const clean=normalizeRoot(persisted);sql.exec('BEGIN IMMEDIATE');
  try{sql.prepare('UPDATE storage SET content=?,updated_at=? WHERE id=1').run(pack(clean),new Date().toISOString());sql.exec('COMMIT');}
  catch(e){sql.exec('ROLLBACK');throw e;}
  // Prevent old plaintext pages from surviving in free SQLite pages and WAL.
  sql.exec('PRAGMA secure_delete=ON; PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);');
 }else {
  // Persist migration to portfolio schema before any HTTP request can select a generated ID.
  // Rewriting the encrypted JSON also persists the same stable portfolio UUID.
  const root=dbGet();sql.exec('BEGIN IMMEDIATE');
  try{dbPut(root);sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}
 }
 }try{await fs.chmod(DB,0o600);}catch{}
  if(ENCRYPT){try{await createAutomaticLocalBackup();}catch(e){console.warn('Metrics: backup automático local indisponível:',e.message);}}
}
export async function read(){return selected(dbGet()).data;}
export async function listPortfolios(){const root=dbGet();return {activePortfolioId:root.activePortfolioId,portfolios:root.portfolios.map(({id,name,createdAt})=>({id,name,createdAt}))};}
function validatePortfolioName(name){if(typeof name!=='string'||!name.trim()||name.trim().length>50)throw Error('Use um nome com 1 a 50 caracteres.');return name.trim();}
async function changeRoot(fn){const task=tail.then(async()=>{sql.exec('BEGIN IMMEDIATE');try{const root=dbGet();const result=await fn(root);dbPut(root);sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}});tail=task.catch(()=>{});return task;}
export async function createPortfolio(name){return changeRoot(root=>{if(root.portfolios.length>=20)throw Error('Máximo de 20 carteiras neste dispositivo.');const portfolio={id:randomUUID(),name:validatePortfolioName(name),createdAt:new Date().toISOString(),data:normalize(fresh())};root.portfolios.push(portfolio);return {id:portfolio.id,name:portfolio.name,createdAt:portfolio.createdAt};});}
export async function renamePortfolio(id,name){return changeRoot(root=>{const p=root.portfolios.find(x=>x.id===id);if(!p)throw Error('Carteira não encontrada.');p.name=validatePortfolioName(name);return {id:p.id,name:p.name};});}
export async function selectPortfolio(id){return changeRoot(root=>{if(!root.portfolios.some(p=>p.id===id))throw Error('Carteira não encontrada.');root.activePortfolioId=id;return {activePortfolioId:id};});}
export async function deleteEmptyPortfolio(id){return changeRoot(root=>{if(root.portfolios.length<=1)throw Error('A carteira principal não pode ser excluída.');const p=root.portfolios.find(x=>x.id===id);if(!p)throw Error('Carteira não encontrada.');const d=p.data;const collections=['instruments','fixedIncome','foreignTrades','foreignAudit','fxRates','taxEvidence','notices','transactions','transactionAudit','watchlist','documents','snapshots','events','imports','messages','quotes','profiles','quoteHistory','benchmarkCDI','providerResearch','cvmReports','cvmQuarterly','providerDividends','ipeIndex','cvmStatements','providerDividendFeed','foreignMarketQuotes'];const anyRecords=collections.some(k=>d[k]?.length)||Object.values(d.benchmarkIndex||{}).some(rows=>rows?.length)||Object.keys(d.extensionGrants||{}).length>0||Object.keys(d.settings||{}).some(k=>k!=='theme');if(anyRecords)throw Error('Somente carteiras sem registros, históricos, configurações ou permissões podem ser excluídas. Exporte backup antes de remover dados.');root.portfolios=root.portfolios.filter(x=>x.id!==id);if(root.activePortfolioId===id)root.activePortfolioId=root.portfolios[0].id;return {activePortfolioId:root.activePortfolioId};});}

let tail=Promise.resolve();
export async function change(fn){const task=tail.then(async()=>{sql.exec('BEGIN IMMEDIATE');try{const root=dbGet();const result=await fn(selected(root).data);dbPut(root);sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}});tail=task.catch(()=>{});return task;}
// A carteira é um ledger: uma correção nunca apaga silenciosamente o registro anterior.
function appendTransactionAudit(db,action,before,after){
 const event={id:randomUUID(),action,transactionId:(after||before).id,at:new Date().toISOString(),before:before?structuredClone(before):null,after:after?structuredClone(after):null,undoneAt:null};
 db.transactionAudit.push(event);
 // Retenção limitada para impedir crescimento ilimitado do JSON criptografado.
 if(db.transactionAudit.length>2000)db.transactionAudit=db.transactionAudit.slice(-2000);
 return event;
}
function assertBrazilianLedger(db,ticker){const cls=db.instruments.find(x=>x.ticker===ticker);if(cls&&cls.currency!=='BRL')throw Error('Ticker cadastrado em moeda estrangeira. Utilize Classes e exterior para operações, sem misturar valores em reais.');}
export async function addTransaction(raw){return change(db=>{assertBrazilianLedger(db,raw.ticker);const t={...validateTransaction(raw),id:randomUUID(),createdAt:new Date().toISOString(),source:['manual','csv','xlsx','b3'].includes(raw.source)?raw.source:'manual'};calculatePositions([...db.transactions,t]);db.transactions.push(t);appendTransactionAudit(db,'CREATE',null,t);return t;});}
/** Corrige todos os campos financeiros sem recriar a aquisição e sem alterar IDs/importações. */
export async function editTransaction(id,raw){return change(db=>{
 const index=db.transactions.findIndex(t=>t.id===id);
 if(index<0)throw Error('Lançamento não encontrado.');
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Dados de correção inválidos.');
 const before=db.transactions[index];
 assertBrazilianLedger(db,raw.ticker||before.ticker);
 const validated=validateTransaction({...before,...raw});
 const after={...before,...validated,updatedAt:new Date().toISOString()};
 if(JSON.stringify(validated)===JSON.stringify(validateTransaction(before)))throw Error('Nenhuma alteração foi informada.');
 const next=db.transactions.slice();next[index]=after;
 calculatePositions(next); // Reconstitui cronologicamente todas as vendas e eventos, rejeita inconsistências.
 db.transactions=next;
 appendTransactionAudit(db,'EDIT',before,after);
 return after;
});}
export async function deleteTransaction(id){return change(db=>{
 const index=db.transactions.findIndex(t=>t.id===id);
 if(index<0)throw Error('Lançamento não encontrado.');
 const before=db.transactions[index];
 const next=db.transactions.filter(t=>t.id!==id);
 calculatePositions(next); // Excluir uma compra não pode deixar vendas descobertas.
 db.transactions=next;
 appendTransactionAudit(db,'DELETE',before,null);
 return {id,removed:true};
});}
/** Desfaz somente a ação indicada, de modo atômico, recusando estados modificados. */
export async function undoTransactionAction(auditId){return change(db=>{
 const active=db.transactionAudit.filter(e=>!e.undoneAt);
 const last=active.at(-1);
 if(!last||last.id!==auditId)throw Error('Só é possível desfazer a última alteração de lançamentos desta carteira.');
 if(!['CREATE','EDIT','DELETE'].includes(last.action))throw Error('O último ajuste foi uma importação ou reversão de lote. Utilize a opção de desfazer lote em Importar B3.');
 const index=db.transactions.findIndex(t=>t.id===last.transactionId);
 if(last.after){
  if(index<0||JSON.stringify(db.transactions[index])!==JSON.stringify(last.after))throw Error('O lançamento mudou desde a ação. Atualize a carteira antes de desfazer.');
 }else if(index>=0)throw Error('A operação já existe, não é possível restaurar sem conferir.');
 const next=db.transactions.slice();
 if(last.before){if(index>=0)next[index]=structuredClone(last.before);else next.push(structuredClone(last.before));}
 else if(index>=0)next.splice(index,1);
 calculatePositions(next);
 db.transactions=next;
 last.undoneAt=new Date().toISOString();
 return {undone:last.action,transactionId:last.transactionId};
});}

export async function addTransactionsBulk(rows,sourceName='Arquivo importado',overwriteDuplicates=false){return change(db=>{
 if(!Array.isArray(rows)||rows.length>10000||rows.length===0)throw new Error('Informe até 10.000 linhas válidas.');
 const fingerprint=t=>createHash('sha256').update([t.date,t.ticker,t.type,t.quantity,t.price,t.fee,t.amount].join('|')).digest('hex');
 const known=new Set(db.transactions.map(fingerprint));const newOnes=[];let repeated=0;
 for(const raw of rows){assertBrazilianLedger(db,raw.ticker);const t=validateTransaction(raw),fp=fingerprint(t);if(known.has(fp)&&!overwriteDuplicates){repeated++;continue;}known.add(fp);newOnes.push({...t,id:randomUUID(),createdAt:new Date().toISOString(),source:['csv','xlsx','b3'].includes(raw.source)?raw.source:'csv',importBatch:null});}
 const batchId=randomUUID();for(const t of newOnes)t.importBatch=batchId;
 calculatePositions([...db.transactions,...newOnes]);db.transactions.push(...newOnes);
 if(newOnes.length)db.transactionAudit.push({id:randomUUID(),action:'IMPORT_BATCH',transactionId:null,at:new Date().toISOString(),before:null,after:null,undoneAt:null,batchId});
 const batch={id:batchId,date:new Date().toISOString(),name:String(sourceName).slice(0,160),added:newOnes.length,duplicates:repeated};db.imports.push(batch);
 return batch;
 });}
export async function rollbackImport(id){return change(db=>{const batch=db.imports.find(x=>x.id===id);if(!batch)throw new Error('Importação não encontrada.');const after=db.transactions.filter(t=>t.importBatch!==id);calculatePositions(after);db.transactions=after;db.imports=db.imports.filter(x=>x.id!==id);if(batch.added)db.transactionAudit.push({id:randomUUID(),action:'ROLLBACK_BATCH',transactionId:null,at:new Date().toISOString(),before:null,after:null,undoneAt:null,batchId:id});return {removed:batch.added};});}
export async function addWatch(raw){return change(db=>{const w={...validateWatch(raw),id:randomUUID()};if(db.watchlist.some(x=>x.ticker===w.ticker))throw new Error('Ticker já está na lista de desejos.');db.watchlist.push(w);return w;});}
export async function editWatch(id,raw){return change(db=>{const index=db.watchlist.findIndex(x=>x.id===id);if(index<0)throw new Error('Ativo não encontrado.');const w=validateWatch({...db.watchlist[index],...raw});if(db.watchlist.some(x=>x.ticker===w.ticker&&x.id!==id))throw new Error('Ticker duplicado.');db.watchlist[index]={...db.watchlist[index],...w,createdAt:db.watchlist[index].createdAt};return db.watchlist[index];});}
export async function saveQuote(raw){return change(db=>{assertBrazilianLedger(db,raw.ticker);const ticker=tickerOf(raw.ticker),price=Number(raw.price);if(!Number.isFinite(price)||price<=0||price>1e12)throw new Error('Preço inválido.');const date=String(raw.date??'');if(!validDate(date))throw new Error('Data inválida.');const q={ticker,price:Math.round(price*10000)/10000,date,source:'informado pelo usuário',updatedAt:new Date().toISOString()};db.quotes=db.quotes.filter(x=>x.ticker!==ticker);db.quotes.push(q);db.quoteHistory=db.quoteHistory||[];db.quoteHistory=db.quoteHistory.filter(x=>!(x.ticker===ticker&&x.date===date));db.quoteHistory.push(q);return q;});}
export async function saveMarketQuotes(raw,meta={}){return change(db=>{
 if(!Array.isArray(raw)||raw.length>5000)throw Error('Lote de cotações inválido.');
 let updated=0,skipped=0,older=0;
 for(const item of raw){
  const ticker=tickerOf(item.ticker),price=Number(item.price),date=String(item.date||'');
  if(db.instruments.some(a=>a.ticker===ticker&&a.currency!=='BRL')){older++;continue;}
  if(!Number.isFinite(price)||price<=0||price>1e9||!validDate(date))throw Error('Cotação inválida: '+ticker);
  const old=db.quotes.find(x=>x.ticker===ticker);
  if(old&&old.date>date){older++;continue;}
  if(old&&old.date===date&&old.source==='informado pelo usuário'){skipped++;continue;}
  const q={ticker,price:Math.round(price*10000)/10000,date,source:'B3 COTAHIST (fechamento, sem ajustes)',updatedAt:new Date().toISOString()};
  db.quotes=db.quotes.filter(x=>x.ticker!==ticker);db.quotes.push(q);db.quoteHistory=db.quoteHistory||[];db.quoteHistory=db.quoteHistory.filter(x=>!(x.ticker===ticker&&x.date===date));db.quoteHistory.push(q);updated++;
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
 const recordDate=raw.recordDate?String(raw.recordDate):null;if(recordDate&&!validDate(recordDate))throw Error('Data-base do direito inválida.');if(recordDate&&recordDate>date)throw Error('Data-base não pode ser posterior ao pagamento.');
 if(!validDate(date))throw Error('Data inválida.');
 if(!['ESTIMADO','CONFIRMADO'].includes(kind))throw Error('Tipo de evento inválido.');
 const perShare=Number(raw.perShare);if(!Number.isFinite(perShare)||perShare<0||perShare>1000000)throw Error('Valor por cota inválido.');
 const event={id:randomUUID(),ticker,date,recordDate,kind,perShare,note:String(raw.note||'').slice(0,250),source:String(raw.source||'Cadastrado pelo usuário').slice(0,120),verification:raw.verification==='TERCEIRO_NAO_OFICIAL'?'TERCEIRO_NAO_OFICIAL':'NAO_VERIFICADO',sourceUrl:String(raw.sourceUrl||'').slice(0,250)};
 db.events.push(event);return event;});}
export async function addDocument(raw){return change(db=>{const title=String(raw.title||'').trim().slice(0,150),ticker=raw.ticker?tickerOf(raw.ticker):null,text=String(raw.text||'').trim();if(!title||text.length<15)throw new Error('Informe título e texto extraído de um documento.');if(text.length>400000)throw new Error('Documento excede 400 mil caracteres.');const d={id:randomUUID(),title,ticker,source:String(raw.source||'Arquivo do usuário').slice(0,150),referenceDate:String(raw.referenceDate||'').slice(0,10),uploadedAt:new Date().toISOString(),text};db.documents.push(d);return {...d,text:undefined,chars:text.length};});}
export async function removeItem(collection,id){if(collection==='transactions')return deleteTransaction(id);if(!['watchlist','documents','quotes','profiles','events','snapshots'].includes(collection))throw new Error('Coleção inválida.');return change(db=>{const prev=db[collection].length;db[collection]=db[collection].filter(i=>i.id!==id&&!(['quotes','profiles'].includes(collection)&&i.ticker===id));if(db[collection].length===prev)throw new Error('Registro não encontrado.');return true;});}
export async function saveMessages(messages){return change(db=>{db.messages=messages.slice(-80).filter(x=>['assistant','user'].includes(x.role)&&typeof x.content==='string').map(x=>({role:x.role,content:x.content.slice(0,12000)}));return db.messages;});}
export async function clearMessages(){return change(db=>{db.messages=[];return true;});}
export async function upsertInstrument(raw){return change(db=>{const item=validateInstrument(raw);if(item.currency!=='BRL'&&db.transactions.some(t=>t.ticker===item.ticker))throw Error('Já existem lançamentos brasileiros deste ticker. Não converta valores antigos para moeda estrangeira sem reconciliação.');db.instruments=db.instruments.filter(x=>x.ticker!==item.ticker);db.instruments.push(item);return item;});}
export async function deleteInstrument(ticker){return change(db=>{const key=tickerOf(ticker);if(db.transactions.some(x=>x.ticker===key)||db.fixedIncome.some(x=>x.ticker===key))throw Error('Instrumento com operações ou contratos não pode ser excluído.');const count=db.instruments.length;db.instruments=db.instruments.filter(x=>x.ticker!==key);if(count===db.instruments.length)throw Error('Ativo não encontrado.');return {removed:key};});}
function auditForeign(db,action,before,after){const e={id:randomUUID(),action,before:before?structuredClone(before):null,after:after?structuredClone(after):null,at:new Date().toISOString(),undoneAt:null};db.foreignAudit.push(e);if(db.foreignAudit.length>1000)db.foreignAudit=db.foreignAudit.slice(-1000);return e;}
export async function addForeignTrade(raw){return change(db=>{const trade={...validateForeignTrade(raw),id:randomUUID(),createdAt:new Date().toISOString()};foreignPositions([...db.foreignTrades,trade]);db.foreignTrades.push(trade);auditForeign(db,'CREATE',null,trade);return trade;});}
export async function editForeignTrade(id,raw){return change(db=>{const old=db.foreignTrades.find(x=>x.id===id);if(!old)throw Error('Operação internacional não encontrada.');const validated=validateForeignTrade({...old,...raw});const next={...old,...validated,updatedAt:new Date().toISOString()};const rows=db.foreignTrades.map(x=>x.id===id?next:x);foreignPositions(rows);db.foreignTrades=rows;auditForeign(db,'EDIT',old,next);return next;});}
export async function undoForeignTradeAction(auditId){return change(db=>{const active=db.foreignAudit.filter(x=>!x.undoneAt),last=active.at(-1);if(!last||last.id!==auditId)throw Error('Somente a última alteração internacional pode ser desfeita.');const current=db.foreignTrades.find(x=>x.id===(last.after||last.before).id);if(last.after&&JSON.stringify(current)!==JSON.stringify(last.after))throw Error('Operação mudou desde a ação; recarregue o livro.');if(!last.after&&current)throw Error('Registro já foi recriado.');const next=db.foreignTrades.filter(x=>x.id!==(last.after||last.before).id);if(last.before)next.push(structuredClone(last.before));foreignPositions(next);db.foreignTrades=next;last.undoneAt=new Date().toISOString();return {undone:last.action};});}

export async function removeForeignTrade(id){return change(db=>{const old=db.foreignTrades.find(x=>x.id===id);if(!old)throw Error('Operação não encontrada.');const remain=db.foreignTrades.filter(x=>x.id!==id);foreignPositions(remain);db.foreignTrades=remain;auditForeign(db,'DELETE',old,null);return {removed:id};});}
export async function editFixedIncome(id,raw){return change(db=>{const old=db.fixedIncome.find(x=>x.id===id);if(!old)throw Error('Contrato não encontrado.');const item=validateFixedIncome({...old,...raw,id,redemptions:old.redemptions});const after={...old,...item,updatedAt:new Date().toISOString()};db.fixedIncome=db.fixedIncome.map(x=>x.id===id?after:x);return after;});}
export async function createFixedIncome(raw){return change(db=>{const item=validateFixedIncome(raw);if(db.fixedIncome.some(x=>x.ticker===item.ticker&&x.startDate===item.startDate&&x.principal===item.principal))throw Error('Contrato com mesmos dados já cadastrado; revise antes de duplicar.');item.id=randomUUID();item.createdAt=new Date().toISOString();db.fixedIncome.push(item);return item;});}
export async function redeemFixedIncome(id,raw){return change(db=>{const item=db.fixedIncome.find(x=>x.id===id);if(!item)throw Error('Contrato não encontrado.');const next=validateFixedIncome({...item,redemptions:[...item.redemptions,{...raw,id:randomUUID()}]});Object.assign(item,next);return item;});}
export async function removeFixedIncome(id){return change(db=>{const item=db.fixedIncome.find(x=>x.id===id);if(!item)throw Error('Contrato não encontrado.');if(item.redemptions.length)throw Error('Contrato com resgates não pode ser removido. Use backup ou correção documentada.');db.fixedIncome=db.fixedIncome.filter(x=>x.id!==id);return {removed:id};});}
export async function upsertFxQuotes(raw){return change(db=>{if(!Array.isArray(raw)||!raw.length||raw.length>1100)throw Error('Lote PTAX inválido.');let updated=0;for(const v of raw){const q=validateFxQuote(v),old=db.fxRates.find(x=>x.currency===q.currency&&x.date===q.date);if(old&&old.type==='MANUAL'&&q.type!=='MANUAL')continue;db.fxRates=db.fxRates.filter(x=>x.currency!==q.currency||x.date!==q.date);db.fxRates.push(q);updated++;}db.fxRates.sort((a,b)=>a.date.localeCompare(b.date));if(db.fxRates.length>30000)db.fxRates=db.fxRates.slice(-30000);return {updated,total:db.fxRates.length};});}
export async function addTaxEvidence(raw){return change(db=>{const e={...validateTaxEvidence(raw),id:randomUUID(),createdAt:new Date().toISOString()};if(db.taxEvidence.some(x=>x.year===e.year&&x.ticker===e.ticker&&x.nature===e.nature&&x.amount===e.amount&&x.source===e.source))throw Error('Informe já cadastrado com os mesmos dados. Revise antes de duplicar.');db.taxEvidence.push(e);return e;});}
export async function addNotice(raw){return change(db=>{const n={...validateNotice(raw),id:randomUUID(),createdAt:new Date().toISOString()};db.notices.push(n);return n;});}
export async function removeExtended(collection,id){if(!['taxEvidence','notices'].includes(collection))throw Error('Coleção não autorizada.');return change(db=>{const before=db[collection].length;db[collection]=db[collection].filter(x=>x.id!==id);if(before===db[collection].length)throw Error('Registro não encontrado.');return {ok:true};});}
export function classReport(db,{asOf}={}){return {instruments:db.instruments||[],foreignPositions:foreignPositions(db.foreignTrades),fixedIncome:fixedIncomeOverview(db,{asOf}),fxRates:(db.fxRates||[]).slice(-500),notices:(db.notices||[]).slice(-100)};}
export async function restoreBackup(raw){return change(db=>{if(!raw||typeof raw!=='object'||!Array.isArray(raw.transactions)||!Array.isArray(raw.watchlist))throw new Error('Backup inválido.');const clean=normalize(structuredClone(raw));if(clean.transactions.length>100000||clean.watchlist.length>5000||clean.documents.length>5000||clean.snapshots.length>1000)throw new Error('Backup grande demais.');for(const t of clean.transactions)validateTransaction(t);calculatePositions(clean.transactions);for(const w of clean.watchlist)validateWatch(w);for(const a of clean.instruments)validateInstrument(a);for(const a of clean.fixedIncome)validateFixedIncome(a);for(const a of clean.foreignTrades)validateForeignTrade(a);foreignPositions(clean.foreignTrades);for(const a of clean.fxRates)validateFxQuote(a);for(const a of clean.taxEvidence)validateTaxEvidence(a);for(const a of clean.notices)validateNotice(a);for(const k of Object.keys(db))delete db[k];Object.assign(db,clean);return {transactions:db.transactions.length,watchlist:db.watchlist.length};});}
/** Community packs are declarative and read-only. No imported JavaScript is ever executed. */
export async function installExtension(manifest){const checked=validateExtensionManifest(manifest);return changeRoot(root=>{const existing=root.extensions.find(x=>x.id===checked.id);if(existing)throw Error('Extensão já instalada. Remova antes de instalar outra versão.');if(root.extensions.length>=30)throw Error('Limite de 30 extensões.');root.extensions.push(checked);return {id:checked.id,name:checked.name,capabilities:checked.capabilities,enabled:false};});}
export async function listExtensions(){const root=dbGet(),grant=selected(root).data.extensionGrants||{};return root.extensions.map(p=>({id:p.id,name:p.name,version:p.version,description:p.description,capabilities:p.capabilities,enabled:grant[p.id]?.enabled===true,grantedCapabilities:grant[p.id]?.capabilities||[],widgets:p.widgets.map(w=>({title:w.title,type:w.type}))}));}
export async function grantExtension(id,{enabled,capabilities=[]}={}){return changeRoot(root=>{const p=root.extensions.find(x=>x.id===id);if(!p)throw Error('Extensão não instalada.');if(typeof enabled!=='boolean'||!Array.isArray(capabilities)||capabilities.some(c=>!p.capabilities.includes(c)))throw Error('Permissões inválidas.');const d=selected(root).data;d.extensionGrants[id]={enabled,capabilities:[...new Set(capabilities)]};return {id,enabled,capabilities:d.extensionGrants[id].capabilities};});}
export async function uninstallExtension(id){return changeRoot(root=>{const n=root.extensions.length;root.extensions=root.extensions.filter(p=>p.id!==id);if(n===root.extensions.length)throw Error('Extensão não encontrada.');for(const p of root.portfolios)delete p.data.extensionGrants[id];return {removed:true};});}
export async function extensionDashboard(id){const root=dbGet(),p=root.extensions.find(x=>x.id===id);if(!p)throw Error('Extensão não encontrada.');const d=selected(root).data,grant=d.extensionGrants?.[id];if(!grant?.enabled)throw Error('Ative a extensão nesta carteira antes de consultá-la.');return renderExtension(p,d,grant.capabilities||[]);}
export function isEncrypted(){return !!ENCRYPT;}

/** A custody statement describes holdings at a date. It must never create fictitious BUY operations. */
export async function saveCustodySnapshot(raw){return change(db=>{
 const asOf=String(raw.asOf||'');if(!validDate(asOf))throw Error('Informe uma data-base válida para a posição.');
 if(!Array.isArray(raw.positions)||!raw.positions.length||raw.positions.length>1500)throw Error('O documento não contém posições reconhecidas para importar.');
 const seen=new Set();const positions=raw.positions.map(item=>{
  const ticker=tickerOf(item.ticker),quantity=Number(item.quantity);
  if(!Number.isFinite(quantity)||quantity<=0||quantity>1e12)throw Error('Quantidade inválida para '+ticker);
  if(seen.has(ticker))throw Error('Ticker duplicado no extrato: '+ticker);seen.add(ticker);
  const quote=Number(item.referencePrice),referencePrice=Number.isFinite(quote)&&quote>0&&quote<1e10?quote:null;
  return {ticker,quantity,referencePrice,reviewed:true};
 });
 const source=String(raw.source||'Extrato de posição fornecido pelo usuário').slice(0,160);
 const fingerprint=createHash('sha256').update(JSON.stringify({asOf,positions})).digest('hex');
 if(db.snapshots.some(x=>x.fingerprint===fingerprint))throw Error('Este extrato de posição já foi importado.');
 const snapshot={id:randomUUID(),asOf,source,positions,fingerprint,importedAt:new Date().toISOString()};
 db.snapshots.push(snapshot);return snapshot;
});}

/** Save timestamped provider quotes; the access token is deliberately NEVER persisted. */
export async function saveFeedQuotes(quotes){return change(db=>{
 if(!Array.isArray(quotes)||quotes.length>100)throw Error('Lote de preços inválido.');
 let updated=0,older=0;
 for(const item of quotes){
  const ticker=tickerOf(item.ticker),price=Number(item.price),date=String(item.date||'');
  if(db.instruments.some(a=>a.ticker===ticker&&a.currency!=='BRL')){older++;continue;}
  if(!validDate(date)||!Number.isFinite(price)||price<=0||price>1e9)throw Error('Preço inválido: '+ticker);
  const q={ticker,price:Math.round(price*10000)/10000,date,quoteTime:typeof item.quoteTime==='string'?item.quoteTime:null,source:'brapi.dev (preço atrasado conforme o plano)',retrievedAt:new Date().toISOString(),provider:'brapi',delayMinutes:30};
  const prev=db.quotes.find(x=>x.ticker===ticker);
  if(prev && (prev.date>date || (prev.date===date && prev.quoteTime && q.quoteTime && prev.quoteTime>q.quoteTime))){older++;continue;}
  db.quotes=db.quotes.filter(x=>x.ticker!==ticker);db.quotes.push(q);
  db.quoteHistory=db.quoteHistory||[];
  db.quoteHistory=db.quoteHistory.filter(x=>!(x.ticker===ticker&&x.date===date));db.quoteHistory.push(q);
  updated++;
 }
 db.settings.lastProviderRefresh={at:new Date().toISOString(),updated,source:'brapi.dev (dados atrasados)'};
 return {updated,older,source:'brapi.dev',warning:'Preços podem estar atrasados e não substituem dados de negociação em tempo real.'};
});}
/** Historical prices imported from an explicitly identified data source. */
export async function saveHistoricalQuotes(rows,{source='Arquivo histórico fornecido pelo usuário'}={}){return change(db=>{
 if(!Array.isArray(rows)||rows.length>50000)throw Error('Máximo de 50.000 observações históricas por arquivo.');
 const map=new Map((db.quoteHistory||[]).map(x=>[x.ticker+'|'+x.date,x]));let added=0;
 for(const item of rows){const ticker=tickerOf(item.ticker),date=String(item.date||''),price=Number(item.price);
  if(!validDate(date)||!Number.isFinite(price)||price<=0||price>1e9)throw Error('Histórico de preço inválido.');
  const k=ticker+'|'+date;if(!map.has(k)){map.set(k,{ticker,date,price:Math.round(price*10000)/10000,source:String(source).slice(0,120),importedAt:new Date().toISOString()});added++;}
 }
 db.quoteHistory=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));return {added,total:db.quoteHistory.length,source};
});}
export async function saveBenchmarkCDI(rows,{source='CSV CDI fornecido pelo usuário'}={}){return change(db=>{
 if(!Array.isArray(rows)||!rows.length||rows.length>10000)throw Error('Arquivo CDI inválido.');
 for(const x of rows)if(!validDate(x.date)||!Number.isFinite(x.rate)||x.rate < -5||x.rate>20)throw Error('CDI diário inválido.');
 const m=new Map((db.benchmarkCDI||[]).map(x=>[x.date,x]));for(const x of rows)m.set(x.date,{date:x.date,rate:x.rate,source:String(source).slice(0,120)});
 db.benchmarkCDI=[...m.values()].sort((a,b)=>a.date.localeCompare(b.date));return {total:db.benchmarkCDI.length,added:rows.length,source};
});}

/** User-provided index levels and official monthly IPCA; never synthesize index points. */
export async function saveIndexBenchmark(kind,rows,{source='Série fornecida pelo usuário'}={}){return change(db=>{
 if(!['IBOVESPA','IFIX','IPCA'].includes(kind)||!Array.isArray(rows)||!rows.length||rows.length>12000)throw Error('Série comparadora inválida.');
 const field=kind==='IPCA'?'rate':'value';for(const x of rows){if(!validDate(x.date)||!Number.isFinite(Number(x[field]))||Number(x[field])<(field==='rate'?-10:0)||Number(x[field])>(field==='rate'?30:1e12))throw Error('Valor de índice inválido.');}
 db.benchmarkIndex=db.benchmarkIndex||{IBOVESPA:[],IFIX:[],IPCA:[]};const index=new Map((db.benchmarkIndex[kind]||[]).map(x=>[x.date,x]));
 for(const x of rows)index.set(x.date,{date:x.date,[field]:Number(x[field]),source:String(source).slice(0,130)});
 db.benchmarkIndex[kind]=[...index.values()].sort((a,b)=>a.date.localeCompare(b.date));return {kind,total:db.benchmarkIndex[kind].length,source};
});}

/** Salva pesquisa consultada manualmente; sem credenciais ou objeto não validado. */
export async function saveResearch(result){return change(db=>{
 const ticker=tickerOf(result.ticker),kind=String(result.kind||'');
 if(!['FII_INDICATORS','STOCK_STATISTICS'].includes(kind)||!result.indicators||typeof result.indicators!=='object')throw Error('Pesquisa inválida.');
 const row={ticker,kind,indicators:result.indicators,source:String(result.source||'brapi.dev').slice(0,160),observedAt:result.observedAt||null,requestedAt:new Date().toISOString()};
 db.providerResearch=(db.providerResearch||[]).filter(x=>!(x.ticker===ticker&&x.kind===kind));db.providerResearch.push(row);return row;
});}
export async function importProviderEvents(rows){return change(db=>{
 if(!Array.isArray(rows)||!rows.length||rows.length>1000)throw Error('Quantidade inválida de proventos.');
 let added=0,existing=0;
 for(const row of rows){const ticker=tickerOf(row.ticker),date=String(row.date||''),recordDate=String(row.recordDate||''),perShare=Number(row.perShare);
  if(!validDate(date)||!validDate(recordDate)||recordDate>date||!Number.isFinite(perShare)||perShare<=0||perShare>1e6)throw Error('Evento financeiro incompleto.');
  if(db.events.some(x=>x.ticker===ticker&&x.date===date&&x.recordDate===recordDate&&Math.abs(x.perShare-perShare)<0.000001)){existing++;continue;}
  db.events.push({id:randomUUID(),ticker,date,recordDate,perShare,kind:'CONFIRMADO',verification:'TERCEIRO_NAO_OFICIAL',source:'brapi.dev (conferir anúncio original)',sourceUrl:'https://brapi.dev/docs',nature:String(row.nature||'Rendimento').slice(0,80),note:'Importado de fornecedor externo após confirmação do usuário.'});added++;
 }return {added,existing};
});}

export async function saveGoal(raw){return change(db=>{const n=Number(raw.monthlyIncomeGoal);if(!Number.isFinite(n)||n<0||n>1e9)throw Error('Meta mensal inválida.');db.settings.monthlyIncomeGoal=n||null;return {monthlyIncomeGoal:db.settings.monthlyIncomeGoal};});}

/** Snapshot diário somente quando banco está criptografado. Usa a chave protegida no dispositivo atual; não substitui backup portátil com senha. */
export async function createAutomaticLocalBackup(){
 if(!ENCRYPT||!sql)return {created:false,reason:'Banco não protegido por senha; não criar cópia automática em texto claro.'};
 const destDir=path.join(DIR,'backups-locais');await fs.mkdir(destDir,{recursive:true,mode:0o700});
 const day=new Date().toISOString().slice(0,10),dest=path.join(destDir,`metrics-${day}.sqlite`);
 try{await fs.access(dest);return {created:false,reason:'Cópia deste dia já existe.'};}catch(e){if(e.code!=='ENOENT')throw e;}
 await backupSQLite(sql,dest);await fs.chmod(dest,0o600).catch(()=>{});
 const files=(await fs.readdir(destDir)).filter(n=>/^metrics-\d{4}-\d{2}-\d{2}\.sqlite$/.test(n)).sort().reverse();
 for(const name of files.slice(7))await fs.rm(path.join(destDir,name));
 return {created:true,path:dest,note:'Cópia local criptografada com a chave deste dispositivo; exporte backup com senha para recuperação em outro computador.'};
}

/** CVM monthly report rows are immutable snapshots indexed by ticker, date, and publication version. */
export async function saveCvmMonthly(entries,{downloadUrl=null}={}){return change(db=>{
 if(!Array.isArray(entries)||!entries.length||entries.length>2500)throw Error('Lote CVM vazio ou grande demais.');
 let inserted=0,duplicates=0;for(const e of entries){if(!e||!e.ticker||!/^\d{14}$/.test(e.cnpj||'')||!validDate(e.referenceDate)||!e.indicators)throw Error('Registro CVM inválido.');
  if(db.cvmReports.some(x=>x.ticker===e.ticker&&x.referenceDate===e.referenceDate&&x.publicationDate===e.publicationDate&&x.version===e.version)){duplicates++;continue;}
  db.cvmReports.push({...structuredClone(e),authenticity:downloadUrl?'DOWNLOAD_DE_DOMINIO_CVM_SEM_ASSINATURA':'ARQUIVO_NAO_AUTENTICADO',importedAt:new Date().toISOString(),downloadUrl});inserted++;
 }
 db.cvmReports.sort((a,b)=>a.referenceDate.localeCompare(b.referenceDate));
 if(db.cvmReports.length>10000)db.cvmReports=db.cvmReports.slice(-10000);
 return {inserted,duplicates,total:db.cvmReports.length};
});}

/** Store quarterly official periodic extracts without implying validation of user-uploaded files. */
export async function saveCvmQuarterly(entries,{downloadUrl=null}={}){return change(db=>{
 if(!Array.isArray(entries)||!entries.length||entries.length>4000)throw Error('Lote trimestral CVM vazio ou muito grande.');
 let inserted=0,duplicates=0,revisions=0;
 for(const e of entries){
  const key=[e.ticker,e.referenceDate,e.sourceFile].join('|');
  if(!e.cnpj||!validDate(e.referenceDate)||!e.indicators||!e.ticker)throw Error('Informe trimestral inválido.');
  const same=(db.cvmQuarterly||[]).filter(r=>[r.ticker,r.referenceDate,r.sourceFile].join('|')===key);
  const contentHash=createHash('sha256').update(JSON.stringify(e.indicators)).digest('hex');
  if(same.some(r=>(r.contentHash||createHash('sha256').update(JSON.stringify(r.indicators)).digest('hex'))===contentHash)){duplicates++;continue;}
  const revision=same.length+1;if(revision>1)revisions++;
  db.cvmQuarterly.push({...structuredClone(e),contentHash,revision,authenticity:downloadUrl?'DOWNLOAD_CVM_SEM_ASSINATURA':'ARQUIVO_NAO_AUTENTICADO',downloadUrl,importedAt:new Date().toISOString()});inserted++;
 }
 db.cvmQuarterly.sort((a,b)=>a.referenceDate.localeCompare(b.referenceDate)||a.revision-b.revision);
 if(db.cvmQuarterly.length>20000)db.cvmQuarterly=db.cvmQuarterly.slice(-20000);
 return {inserted,duplicates,revisions,total:db.cvmQuarterly.length};
});}
/** Save provider dividend observations separately. A supplier estimate is NEVER an official issuer event. */
export async function saveProviderDividends(rows){return change(db=>{
 if(!Array.isArray(rows)||!rows.length||rows.length>3000)throw Error('Dados de proventos inválidos.');
 const known=new Set(db.providerDividends.map(e=>[e.ticker,e.label,e.rate,e.paymentDate,e.recordDate].join('|')));let added=0,duplicates=0;
 for(const raw of rows){const ticker=tickerOf(raw.ticker),rate=Number(raw.rate),label=String(raw.label||'').slice(0,80),key=[ticker,label,rate,raw.paymentDate||null,raw.recordDate||null].join('|');if(!Number.isFinite(rate)||rate<=0||rate>1e6||raw.paymentDate&&!validDate(raw.paymentDate)||raw.recordDate&&!validDate(raw.recordDate))throw Error('Observação de provento inválida.');if(known.has(key)){duplicates++;continue;}known.add(key);db.providerDividends.push({...structuredClone(raw),ticker,verifiedOfficially:false,importedAt:new Date().toISOString()});added++;}
 if(db.providerDividends.length>6000)db.providerDividends=db.providerDividends.slice(-6000);return {added,duplicates,total:db.providerDividends.length,warning:'Proventos de terceiros não são recibos nem anúncios certificados.'};
});}

/** Version 1.4: authenticated-session BYOK never stored. Market data always labeled. */
export async function storeProviderQuotes(rows){return change(db=>{
 if(!Array.isArray(rows)||rows.length<1||rows.length>20)throw Error('Lote de cotações inválido.');
 let brazilian=0,foreign=0,older=0;
 for(const item of rows){
  const ticker=tickerOf(item.ticker),date=String(item.date||''),price=Number(item.price),currency=String(item.currency||'').toUpperCase();
  if(!['BRL','USD'].includes(currency)||!validDate(date)||!Number.isFinite(price)||price<=0||price>1e10)throw Error('Preço ou moeda inválidos.');
  const quote={ticker,date,price:Number(price.toFixed(6)),currency,source:String(item.source||'').slice(0,150),provider:String(item.provider||'').slice(0,32),quoteTime:item.quoteTime||null,delayLabel:String(item.delayLabel||'dados com atraso').slice(0,90),retrievedAt:new Date().toISOString(),isRealtime:false};
  if(currency==='USD'){
   db.foreignMarketQuotes=db.foreignMarketQuotes||[];
   const old=db.foreignMarketQuotes.find(x=>x.ticker===ticker);
   if(old&&old.date>date){older++;continue;}
   db.foreignMarketQuotes=db.foreignMarketQuotes.filter(x=>x.ticker!==ticker);db.foreignMarketQuotes.push(quote);foreign++;
  }else{
   if(db.instruments.some(x=>x.ticker===ticker&&x.currency!=='BRL'))throw Error('Ativo internacional: não misture cotação BRL e posição estrangeira.');
   const old=db.quotes.find(x=>x.ticker===ticker);
   if(old&&(old.date>date||(old.date===date&&old.source==='informado pelo usuário'))){older++;continue;}
   db.quotes=db.quotes.filter(x=>x.ticker!==ticker);db.quotes.push(quote);
   const oldHistory=(db.quoteHistory||[]).find(x=>x.ticker===ticker&&x.date===date);
   if(!oldHistory||oldHistory.source!=='informado pelo usuário'){
    db.quoteHistory=(db.quoteHistory||[]).filter(x=>x.ticker!==ticker||x.date!==date);db.quoteHistory.push(quote);
   }
   brazilian++;
  }
 }
 return {updatedBrazilian:brazilian,updatedForeign:foreign,skippedOlder:older,warning:'Cotações têm fontes e datas; preço USD não é convertido automaticamente para BRL.'};
});}
export async function saveProviderDividendObservations(rows){return change(db=>{
 if(!Array.isArray(rows)||rows.length>1500)throw Error('Lote de proventos inválido.');
 db.providerDividendFeed=db.providerDividendFeed||[];let added=0;
 for(const x of rows){const ticker=tickerOf(x.ticker),rate=Number(x.rate),recordDate=x.recordDate||null,paymentDate=x.paymentDate||null;
  if(!Number.isFinite(rate)||rate<=0||rate>1e8)throw Error('Provento inválido.');
  if(recordDate&&!validDate(recordDate)||paymentDate&&!validDate(paymentDate))throw Error('Data de provento inválida.');
  const currency=String(x.currency||'BRL').toUpperCase();if(!['BRL','USD'].includes(currency))throw Error('Moeda do provento inválida.');
  const key=[x.source,ticker,currency,x.nature,rate,recordDate,paymentDate].join('|');
  if(db.providerDividendFeed.some(y=>y.fingerprint===key))continue;
  db.providerDividendFeed.push({ticker,rate,currency,recordDate,paymentDate,exDate:x.exDate||null,nature:String(x.nature||'OTHER'),source:String(x.source||'fornecedor').slice(0,120),sourceUrl:String(x.sourceUrl||'').slice(0,320),observedAt:new Date().toISOString(),status:'DADOS_TERCEIROS_NAO_VERIFICADOS',officiallyVerified:false,fingerprint:key});added++;
 }
 if(db.providerDividendFeed.length>10000)db.providerDividendFeed=db.providerDividendFeed.slice(-10000);
 return {added,total:db.providerDividendFeed.length,warning:'Observações de terceiros: não geram créditos futuros confirmados e não criam lançamentos automaticamente.'};
});}
export async function saveIpeIndex(entries,{origin='Arquivo IPE enviado pelo usuário'}={}){return change(db=>{
 if(!Array.isArray(entries)||entries.length>10000)throw Error('Índice IPE inválido.');
 db.ipeIndex=db.ipeIndex||[];let added=0,updated=0;
 for(const row of entries){if(!row.cnpj||!row.title||!validDate(row.deliveryDate))throw Error('Registro IPE não possui origem ou data reconhecível.');
  const fingerprint=[row.cnpj,row.documentId,row.deliveryDate,row.version||''].join('|');
  const existing=db.ipeIndex.findIndex(x=>x.fingerprint===fingerprint);
  const x={...row,source:'CVM IPE - índice de documentos (origem declarada)',origin:String(origin).slice(0,180),fingerprint,importedAt:new Date().toISOString(),documentContentsVerified:false,issuerAnnouncementVerified:false};
  if(existing>=0){if(JSON.stringify(db.ipeIndex[existing].sourceUrl)!==JSON.stringify(x.sourceUrl)){db.ipeIndex[existing]=x;updated++;}}
  else {db.ipeIndex.push(x);added++;}
 }
 db.ipeIndex.sort((a,b)=>b.deliveryDate.localeCompare(a.deliveryDate));
 if(db.ipeIndex.length>30000)db.ipeIndex=db.ipeIndex.slice(0,30000);
 return {added,updated,total:db.ipeIndex.length,warning:'CVM IPE: índice de documentos, não extração automática dos valores de dividendos.'};
});}

/** CVM DFP untrusted file snapshot. No computed ratios from raw accounting rows. */
export async function saveCvmStatements(entries){return change(db=>{
 if(!Array.isArray(entries)||entries.length>8000)throw Error('Lote DFP inválido.');
 db.cvmStatements=db.cvmStatements||[];let added=0,revised=0;
 for(const x of entries){if(!x.fingerprint||!validDate(x.referenceDate)||!Number.isFinite(x.rawValue))throw Error('Linha DFP inconsistente.');
  const old=db.cvmStatements.findIndex(v=>v.fingerprint===x.fingerprint);
  const record={...x,importedAt:new Date().toISOString(),publicationVerified:false};
  if(old<0){db.cvmStatements.push(record);added++;}else if(db.cvmStatements[old].rawValue!==record.rawValue){db.cvmStatements[old]={...record,previousValues:[...(db.cvmStatements[old].previousValues||[]),{value:db.cvmStatements[old].rawValue,importedAt:db.cvmStatements[old].importedAt}].slice(-5)};revised++;}
 }
 if(db.cvmStatements.length>20000)db.cvmStatements=db.cvmStatements.slice(-20000);
 return {added,revised,total:db.cvmStatements.length,warning:'DFP: informação contábil a conferir; não calcular múltiplos sem escala, período e preço verificados.'};
});}

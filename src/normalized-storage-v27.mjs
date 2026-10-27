/** Metrics 2.7 optional relational storage. No plaintext financial fields if the legacy DB is encrypted.
 * SQLite transactions are owned by store.mjs; this module never begins nested transactions.
 */
import {randomBytes,createHash,createHmac,createCipheriv,createDecipheriv,scryptSync,timingSafeEqual} from 'node:crypto';
export const NORMALIZED_MARKER_27='{"normalizedV27":true}';
const itemCollections=new Set(['transactions','transactionAudit','quoteHistory','foreignTrades','foreignAudit','externalFlows','assetValuations','events','documents','snapshots','taxEvidence','officialChecks','fxRates','providerDividends','cvmReports','ipeIndex']);
const asJson=x=>JSON.stringify(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
const dateField=x=>typeof x?.date==='string'?x.date:typeof x?.asOf==='string'?x.asOf:typeof x?.deliveryDate==='string'?x.deliveryDate:typeof x?.reviewedAt==='string'?x.reviewedAt.slice(0,10):null;
function verifyDigest(a,b){const x=Buffer.from(String(a),'utf8'),y=Buffer.from(String(b),'utf8');return x.length===y.length&&timingSafeEqual(x,y);}
export function createNormalizedStorage27(sql,{passphrase=''}={}){
 let key=null,ready=false,encrypted=!!passphrase;
 function init(){
  sql.exec(`CREATE TABLE IF NOT EXISTS v27_config(id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, encrypted INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS v27_root(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS v27_wallets(portfolio_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS v27_fields(portfolio_id TEXT NOT NULL, field TEXT NOT NULL, payload TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(portfolio_id,field));
CREATE TABLE IF NOT EXISTS v27_items(portfolio_id TEXT NOT NULL, field TEXT NOT NULL, item_key TEXT NOT NULL, position INTEGER NOT NULL, date_key TEXT, payload TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(portfolio_id,field,item_key));
CREATE INDEX IF NOT EXISTS v27_items_by_date ON v27_items(portfolio_id,field,date_key DESC,item_key DESC);
CREATE INDEX IF NOT EXISTS v27_items_by_position ON v27_items(portfolio_id,field,position);`);
  const cfg=sql.prepare('SELECT salt, encrypted FROM v27_config WHERE id=1').get();
  if(cfg){if(Boolean(cfg.encrypted)!==encrypted)throw Error('Modo de criptografia relacional difere da chave informada. Mantenha a senha original.');key=encrypted?scryptSync(passphrase,Buffer.from(cfg.salt,'base64'),32):null;}
  ready=true;
 }
 function ensureKey(){if(!ready)throw Error('Inicialize o armazenamento relacional antes de usar.');const cfg=sql.prepare('SELECT salt, encrypted FROM v27_config WHERE id=1').get();if(cfg)return;if(sql.prepare('SELECT id FROM v27_root WHERE id=1').get())throw Error('Raiz relacional sem configuração de criptografia.');const salt=randomBytes(24);sql.prepare('INSERT INTO v27_config(id,salt,encrypted) VALUES (1,?,?)').run(salt.toString('base64'),encrypted?1:0);key=encrypted?scryptSync(passphrase,salt,32):null;}
 function seal(value,scope){const plain=asJson(value);if(!encrypted)return plain;const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(scope));const data=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);return asJson({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});}
 function unseal(payload,scope){if(!encrypted)return JSON.parse(payload);let parsed;try{parsed=JSON.parse(payload);const d=createDecipheriv('aes-256-gcm',key,Buffer.from(parsed.iv,'base64'));d.setAAD(Buffer.from(scope));d.setAuthTag(Buffer.from(parsed.tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(parsed.data,'base64')),d.final()]).toString('utf8'));}catch{throw Error('Falha de autenticação relacional: dado modificado ou chave incorreta.');}}
 function digest(value){const j=asJson(value);return encrypted?createHmac('sha256',key).update(j).digest('hex'):hash(j);}
 function write(root){
  ensureKey();if(!root||!Array.isArray(root.portfolios)||!root.portfolios.length)throw Error('Raiz sem carteiras.');
  const meta=Object.fromEntries(Object.entries(root).filter(([k])=>k!=='portfolios'));
  sql.prepare('INSERT INTO v27_root(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(seal(meta,'root'));
  const oldIds=new Set(sql.prepare('SELECT portfolio_id FROM v27_wallets').all().map(r=>r.portfolio_id));
  for(const p of root.portfolios){
   if(!/^[a-f0-9-]{36}$/.test(p.id))throw Error('Identificador de carteira inválido para migração.');
   oldIds.delete(p.id);
   const pm={...p};delete pm.data;
   sql.prepare('INSERT INTO v27_wallets(portfolio_id,payload) VALUES(?,?) ON CONFLICT(portfolio_id) DO UPDATE SET payload=excluded.payload').run(p.id,seal(pm,'wallet:'+p.id));
   const data=p.data||{},oldFields=new Set(sql.prepare('SELECT field FROM v27_fields WHERE portfolio_id=?').all(p.id).map(r=>r.field));
   const oldItems=new Map();for(const r of sql.prepare('SELECT field,item_key,digest FROM v27_items WHERE portfolio_id=?').all(p.id)){if(!oldItems.has(r.field))oldItems.set(r.field,new Map());oldItems.get(r.field).set(r.item_key,r.digest);}
   for(const [field,value] of Object.entries(data)){
    if(!/^[a-zA-Z][a-zA-Z0-9]{0,80}$/.test(field))throw Error('Nome de coleção inválido: '+field);
    if(itemCollections.has(field)&&Array.isArray(value)&&value.length){
     oldFields.delete(field);
     const existing=oldItems.get(field)||new Map(),seen=new Set();
     for(let i=0;i<value.length;i++){
      const item=value[i];const stable=typeof item?.id==='string'&&/^[a-zA-Z0-9._:-]{1,100}$/.test(item.id)?'id:'+item.id:'pos:'+String(i).padStart(10,'0');
      const itemKey=seen.has(stable)?'pos:'+String(i).padStart(10,'0'):stable;seen.add(itemKey);
      const signature=digest(item),old=existing.get(itemKey),row=sql.prepare('SELECT position FROM v27_items WHERE portfolio_id=? AND field=? AND item_key=?').get(p.id,field,itemKey);
      if(old!==signature||row?.position!==i){
       const date=encrypted?null:(dateField(item)||null);
       sql.prepare('INSERT INTO v27_items(portfolio_id,field,item_key,position,date_key,payload,digest) VALUES(?,?,?,?,?,?,?) ON CONFLICT(portfolio_id,field,item_key) DO UPDATE SET position=excluded.position,date_key=excluded.date_key,payload=excluded.payload,digest=excluded.digest').run(p.id,field,itemKey,i,date,seal(item,'item:'+p.id+':'+field+':'+itemKey),signature);
      }
      existing.delete(itemKey);
     }
     for(const obsolete of existing.keys())sql.prepare('DELETE FROM v27_items WHERE portfolio_id=? AND field=? AND item_key=?').run(p.id,field,obsolete);
     oldItems.delete(field);
    }else{
     const d=digest(value),existing=sql.prepare('SELECT digest FROM v27_fields WHERE portfolio_id=? AND field=?').get(p.id,field);
     if(existing?.digest!==d)sql.prepare('INSERT INTO v27_fields(portfolio_id,field,payload,digest) VALUES(?,?,?,?) ON CONFLICT(portfolio_id,field) DO UPDATE SET payload=excluded.payload,digest=excluded.digest').run(p.id,field,seal(value,'field:'+p.id+':'+field),d);
     oldFields.delete(field);
    }
   }
   for(const field of oldFields)sql.prepare('DELETE FROM v27_fields WHERE portfolio_id=? AND field=?').run(p.id,field);
   for(const [field,items] of oldItems)for(const itemKey of items.keys())sql.prepare('DELETE FROM v27_items WHERE portfolio_id=? AND field=? AND item_key=?').run(p.id,field,itemKey);
  }
  for(const id of oldIds){sql.prepare('DELETE FROM v27_items WHERE portfolio_id=?').run(id);sql.prepare('DELETE FROM v27_fields WHERE portfolio_id=?').run(id);sql.prepare('DELETE FROM v27_wallets WHERE portfolio_id=?').run(id);}
 }
 function read(){
  const row=sql.prepare('SELECT payload FROM v27_root WHERE id=1').get();if(!row)throw Error('Metadados relacionais ausentes. Restaure o backup.');
  const meta=unseal(row.payload,'root'),portfolios=[];
  for(const {portfolio_id:id,payload} of sql.prepare('SELECT portfolio_id,payload FROM v27_wallets ORDER BY rowid').all()){
   const p=unseal(payload,'wallet:'+id);if(p.id!==id)throw Error('Identidade de carteira relacional inconsistente.');const data={};
   for(const r of sql.prepare('SELECT field,payload,digest FROM v27_fields WHERE portfolio_id=?').all(id)){
    data[r.field]=unseal(r.payload,'field:'+id+':'+r.field);if(!verifyDigest(digest(data[r.field]),r.digest))throw Error('Integridade de campo relacional inválida: '+r.field);
   }
   for(const r of sql.prepare('SELECT field,item_key,payload,digest FROM v27_items WHERE portfolio_id=? ORDER BY field,position').all(id)){
    const item=unseal(r.payload,'item:'+id+':'+r.field+':'+r.item_key);if(!verifyDigest(digest(item),r.digest))throw Error('Integridade de item relacional inválida: '+r.field);
    (data[r.field]??=[]).push(item);
   }
   portfolios.push({...p,data});
  }
  if(!portfolios.length)throw Error('Armazenamento relacional sem carteiras.');return {...meta,portfolios};
 }
 function status(){const marker=sql.prepare('SELECT content FROM storage WHERE id=1').get()?.content===NORMALIZED_MARKER_27;return {normalized:marker,encrypted,collections:marker?sql.prepare('SELECT COUNT(*) AS n FROM v27_fields').get().n:0,entries:marker?sql.prepare('SELECT COUNT(*) AS n FROM v27_items').get().n:0,rollBackRequiresDatabaseBackup:true};}
 function rootMeta(){const row=sql.prepare('SELECT payload FROM v27_root WHERE id=1').get();if(!row)throw Error('Metadados inexistentes.');return unseal(row.payload,'root');}
 function readCollection(id,field){
  if(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-zA-Z][a-zA-Z0-9]{0,80}$/.test(field))throw Error('Coleção inválida.');
  const wallet=sql.prepare('SELECT 1 FROM v27_wallets WHERE portfolio_id=?').get(id);if(!wallet)throw Error('Carteira não encontrada.');
  return sql.prepare('SELECT item_key,payload,digest FROM v27_items WHERE portfolio_id=? AND field=? ORDER BY position').all(id,field).map(r=>{
   const value=unseal(r.payload,'item:'+id+':'+field+':'+r.item_key);
   if(!verifyDigest(digest(value),r.digest))throw Error('Integridade histórica inválida.');
   return {item_key:r.item_key,value};
  });
 }
 return {initialize:init,write,read,status,rootMeta,readCollection};
}

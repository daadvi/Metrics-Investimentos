/** Declarative extensions only. No eval, imports, HTML injection, network or file access.
 * Plugin authors describe views over explicitly approved read-only finance datasets.
 */
import {portfolioTotals} from './domain.mjs';
const SOURCES=Object.freeze({
 positions:{capability:'portfolio.positions',columns:['ticker','quantity','cost','average','realized','dividends']},
 watchlist:{capability:'portfolio.watchlist',columns:['ticker','priority','target','note']},
 summary:{capability:'portfolio.summary',columns:['holdings','holdingCost','dividends','realized']},
});
const safeText=(value,max=160)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max&&!/[<>\u0000-\u001f]/.test(value);
const allowed=(obj,keys)=>Object.keys(obj).every(k=>keys.includes(k));
export function validateExtensionManifest(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>30000)throw Error('Manifesto inválido ou excede o limite de 30 KB.');
 if(!allowed(input,['id','name','version','description','capabilities','widgets']))throw Error('Manifesto contém campos não permitidos (código, links e permissões implícitas são proibidos).');
 if(typeof input.id!=='string'||!/^[a-z][a-z0-9-]{1,35}(\.[a-z][a-z0-9-]{1,35}){1,3}$/.test(input.id))throw Error('ID da extensão deve ser um domínio reverso, ex.: org.metrics.alocacao.');
 if(!safeText(input.name,70)||!safeText(input.description,500)||typeof input.version!=='string'||!/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(input.version))throw Error('Nome, descrição ou versão inválidos.');
 if(!Array.isArray(input.capabilities)||!input.capabilities.length||input.capabilities.length>3||new Set(input.capabilities).size!==input.capabilities.length||input.capabilities.some(c=>!Object.values(SOURCES).some(s=>s.capability===c)))throw Error('Permissões desconhecidas ou repetidas.');
 if(!Array.isArray(input.widgets)||!input.widgets.length||input.widgets.length>8)throw Error('Informe entre 1 e 8 widgets.');
 const seen=new Set();const widgets=input.widgets.map(w=>{
  if(!w||typeof w!=='object'||Array.isArray(w)||!allowed(w,['id','title','source','type','columns','field','limit']))throw Error('Widget com propriedades não autorizadas.');
  if(typeof w.id!=='string'||!/^[a-z][a-z0-9-]{1,35}$/.test(w.id)||seen.has(w.id))throw Error('Identificador de widget inválido ou repetido.');seen.add(w.id);
  if(!safeText(w.title,90)||!SOURCES[w.source]||!['table','metric'].includes(w.type))throw Error('Fonte ou apresentação não suportada.');
  if(!input.capabilities.includes(SOURCES[w.source].capability))throw Error('Widget exige permissão não declarada.');
  if(w.type==='table'){
   if(w.source==='summary'||!Array.isArray(w.columns)||!w.columns.length||w.columns.length>6||w.columns.some(c=>!SOURCES[w.source].columns.includes(c))||new Set(w.columns).size!==w.columns.length)throw Error('Colunas não permitidas.');
   if(w.limit!==undefined&&(!Number.isInteger(w.limit)||w.limit<1||w.limit>100))throw Error('Limite de registros inválido.');
  }else if(w.source!=='summary'||!SOURCES.summary.columns.includes(w.field))throw Error('Métrica não autorizada.');
  return {id:w.id,title:w.title,source:w.source,type:w.type,...(w.type==='table'?{columns:[...w.columns],limit:w.limit??20}:{field:w.field})};
 });
 return {id:input.id,name:input.name,version:input.version,description:input.description,capabilities:[...input.capabilities],widgets};
}
export function renderExtension(manifest,db,approved){
 const grants=new Set(approved);const totals=portfolioTotals(db.transactions);
 const sets={positions:totals.positions.filter(p=>p.quantity>0),watchlist:db.watchlist,summary:totals};
 return {id:manifest.id,name:manifest.name,widgets:manifest.widgets.map(w=>{
  const capability=SOURCES[w.source].capability;
  if(!grants.has(capability))return {id:w.id,title:w.title,type:'unavailable',reason:'Permissão não concedida para '+capability};
  if(w.type==='metric')return {id:w.id,title:w.title,type:'metric',field:w.field,value:Number(sets.summary[w.field])||0};
  return {id:w.id,title:w.title,type:'table',columns:w.columns,rows:sets[w.source].slice(0,w.limit).map(x=>Object.fromEntries(w.columns.map(c=>[c,(typeof x[c]==='string'||Number.isFinite(x[c]))?x[c]:null])))};
 })};
}

/** Source-bound import PREVIEW & reconciliation. Never silently writes transactions. */
import {createHash} from 'node:crypto';
const aliases={date:['data','datadonegocio','datanegociacao','datalancamento','datamovimentacao'],ticker:['ticker','codigo','codigodenegociacao','ativo','papel'],type:['tipo','movimentacao','operacao','movimento'],quantity:['quantidade','qtd','qtde'],price:['preco','precounitario','precounit','precoajustado'],fee:['taxa','taxas','custos','corretagem'],amount:['valor','valorliquido','valorbruto','valorfinanceiro'],source:['origem','instituicao','corretora']};
const fld=Object.keys(aliases);
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function tokenize(input,delimiter){let rows=[],cur=[],field='',quoted=false;const s=String(input).replace(/^\uFEFF/,'');for(let i=0;i<s.length;i++){
 const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){field+='"';i++;}else quoted=!quoted;continue;}
 if(!quoted&&(c===delimiter||c==='\n'||c==='\r')){cur.push(field.trim());field='';if(c!==delimiter){if(cur.some(x=>x!==''))rows.push(cur);cur=[];if(c==='\r'&&s[i+1]==='\n')i++;}continue;}field+=c;
 }if(quoted)throw Error('CSV com aspas não fechadas.');if(field!==''||cur.length){cur.push(field.trim());if(cur.some(x=>x!==''))rows.push(cur);}return rows;}
const date=x=>{const v=String(x||'').trim(),m=v.match(/^(\d\d)[\/.-](\d\d)[\/.-](\d{4})$/);const d=m?`${m[3]}-${m[2]}-${m[1]}`:v.slice(0,10);return /^\d{4}-\d\d-\d\d$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d?d:null;};
function money(raw){if(raw===null||raw===undefined||String(raw).trim()==='')return null;let s=String(raw).replace(/R\$/g,'').replace(/\s/g,'').trim();if(!/^[+-]?[0-9.,]+$/.test(s))return null;
 const lastComma=s.lastIndexOf(','),lastDot=s.lastIndexOf('.');if(lastComma>=0&&lastDot>=0){const dec=lastComma>lastDot?',':'.';s=s.split(dec==='.'?',':'.').join('').replace(dec,'.');}else if(lastComma>=0)s=s.replace(/\./g,'').replace(',','.');else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');const n=Number(s);return Number.isFinite(n)&&n>=0&&n<=1e12?n:null;}
const typ=s=>{const n=norm(s);if(['compra','c','buy','creditoemativos'].includes(n))return 'BUY';if(['venda','v','sell','debitoemativos'].includes(n))return 'SELL';if(['dividendo','dividendos','dividend','rendimento','rendimentos'].includes(n))return 'DIVIDEND';if(['jcp','jurossobrecapitalproprio'].includes(n))return 'JCP';return null;};
const signature=r=>createHash('sha256').update([r.date,r.ticker,r.type,r.quantity??'',r.price??'',r.fee??0,r.amount??''].join('|')).digest('hex');
export function previewImport27({text,delimiter,columns={},source='Arquivo do investidor'}={}){
 if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>2_000_000)throw Error('Importação vazia ou acima de 2 MB.');
 const delim=delimiter||([';','\t',','].sort((a,b)=>tokenize(text,a)[0]?.length-tokenize(text,b)[0]?.length).at(-1));if(![';',',','\t'].includes(delim))throw Error('Delimitador não suportado.');
 const all=tokenize(text,delim);if(all.length<2||all.length>5001)throw Error('CSV deve ter entre 1 e 5.000 registros.');const headers=all[0].map(x=>x.slice(0,120));
 const mapping={};for(const [k,choices] of Object.entries(aliases)){
  let idx=-1;if(Object.hasOwn(columns,k)){const c=columns[k];idx=Number.isInteger(c)?c:headers.indexOf(String(c));if(idx<0||idx>=headers.length)throw Error('Coluna desconhecida: '+k);}
  else idx=headers.findIndex(h=>choices.includes(norm(h)));
  if(idx>=0)mapping[k]=idx;
 }
 const entries=[],rejected=[];const get=(row,k)=>mapping[k]===undefined?'':row[mapping[k]]||'';
 for(let i=1;i<all.length;i++){const row=all[i],d=date(get(row,'date')),ticker=String(get(row,'ticker')).toUpperCase().trim(),type=typ(get(row,'type')),qty=money(get(row,'quantity')),price=money(get(row,'price')),amount=money(get(row,'amount')),fee=money(get(row,'fee'))??0;
  const reason=!d?'Data não reconhecida':!/^[A-Z0-9._:-]{2,24}$/.test(ticker)?'Código não reconhecido':!type?'Movimentação não reconhecida':(['BUY','SELL'].includes(type)&&!(qty>0&&price>0))?'Compra/venda sem quantidade/preço':(['DIVIDEND','JCP'].includes(type)&&!(amount>0))?'Provento sem valor':' ';
  if(reason!==' '){rejected.push({line:i+1,reason,sample:row.slice(0,8).map(v=>String(v).slice(0,40))});continue;}
  const obj={date:d,ticker,type,quantity:['BUY','SELL'].includes(type)?qty:0,price:['BUY','SELL'].includes(type)?price:0,amount:['DIVIDEND','JCP'].includes(type)?amount:0,fee,source:String(source).slice(0,140),line:i+1};obj.fingerprint=signature(obj);entries.push(obj);
 }
 return {headers,mapping,delimiter:delim,accepted:entries.slice(0,1000),acceptedCount:entries.length,rejected:rejected.slice(0,100),rejectedCount:rejected.length,mayHaveMore:true,sourceHash:createHash('sha256').update(text).digest('hex'),requiresConfirmation:true,warnings:['Prévia não lança operações. Importar extratos de posição não significa compra. Verifique custos, datas, tipo e quantidade.','Nunca atribuir pagamento ou natureza fiscal somente com base em um informe incompleto.']};
}
export function reconcileImport27(db,candidates){
 if(!Array.isArray(candidates)||candidates.length>1000)throw Error('Máximo de 1.000 candidatos por revisão.');
 const local=(db.transactions||[]),records=local.map(t=>({...t,fingerprint:signature(t)}));const exact=new Map();for(const x of records){if(!exact.has(x.fingerprint))exact.set(x.fingerprint,[]);exact.get(x.fingerprint).push(x);}
 const byDate=new Map();for(const x of records){const k=x.date+'|'+x.ticker+'|'+x.type;byDate.set(k,(byDate.get(k)||[]).concat(x));}
 const seen=new Set();const rows=[];
 for(const raw of candidates){const t={date:date(raw.date),ticker:String(raw.ticker||'').toUpperCase().trim(),type:typ(raw.type)||String(raw.type||'').toUpperCase(),quantity:Number(raw.quantity)||0,price:Number(raw.price)||0,fee:Number(raw.fee)||0,amount:Number(raw.amount)||0};if(!t.date||!/^[A-Z0-9._:-]{2,24}$/.test(t.ticker)||!['BUY','SELL','DIVIDEND','JCP'].includes(t.type)||![t.quantity,t.price,t.fee,t.amount].every(n=>Number.isFinite(n)&&n>=0&&n<=1e12))throw Error('Candidato de importação inválido.');
  const fingerprint=signature(t),dup=exact.get(fingerprint)||[],near=byDate.get(t.date+'|'+t.ticker+'|'+t.type)||[];
  const status=seen.has(fingerprint)?'DUPLICATE_IN_FILE':dup.length?'ALREADY_REGISTERED':near.length?'REVIEW_DIFFERENCE':'NOT_FOUND';seen.add(fingerprint);
  rows.push({line:raw.line||null,date:t.date,ticker:t.ticker,type:t.type,status,existingIds:dup.map(x=>x.id).filter(Boolean).slice(0,8),differences:status==='REVIEW_DIFFERENCE'?{registered:near.length,candidateQuantity:t.quantity,candidatePrice:t.price,candidateFee:t.fee,candidateAmount:t.amount}:null});
 }
 return {total:rows.length,counts:Object.fromEntries(['DUPLICATE_IN_FILE','ALREADY_REGISTERED','REVIEW_DIFFERENCE','NOT_FOUND'].map(s=>[s,rows.filter(r=>r.status===s).length])),rows,postedToLedger:false,requiresManualReview:true,note:'Conciliação matemática com lançamentos locais. Não comprova liquidação nem autenticidade do extrato; nenhuma linha foi lançada no livro.'};
}

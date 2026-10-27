/** Private brokerage/bank statement preview. Never import trades or claim third-party certification. */
import {createHash} from 'node:crypto';
const validDate=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const money=x=>{let a=String(x??'').trim().replace(/\s|R\$/gi,'');if(!a)return null;if(!/^[0-9.,]+$/.test(a))return null;if(a.includes(','))a=a.replace(/\./g,'').replace(',','.');const n=Number(a);return Number.isFinite(n)&&n>0&&n<=1e12?Math.round(n*100)/100:null;};
function csv(text,delimiter){let field='',line=[],rows=[],quoted=false;const s=String(text).replace(/^\uFEFF/,'');for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){field+='"';i++;}else quoted=!quoted;continue;}if(!quoted&&(c===delimiter||c==='\r'||c==='\n')){line.push(field.trim());field='';if(c!==delimiter){if(line.some(Boolean))rows.push(line);line=[];if(c==='\r'&&s[i+1]==='\n')i++;}continue;}field+=c;}if(quoted)throw Error('CSV possui aspas não fechadas.');if(field||line.length){line.push(field.trim());rows.push(line);}return rows;}
const names=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
const date=s=>{const a=String(s).trim(),m=a.match(/^(\d\d)[\/.-](\d\d)[\/.-](\d{4})$/);const d=m?`${m[3]}-${m[2]}-${m[1]}`:a;return validDate(d)?d:null;};
function normalizeFlow(x){const kind=names(x.type||x.nature||'');const type=['deposito','aporte','credito','transferenciarecebida','deposit','entrada'].includes(kind)?'DEPOSIT':['retirada','saque','debito','transferenciaenviada','withdraw','saida'].includes(kind)?'WITHDRAW':null;return {date:date(x.date),type,amount:money(x.amount),currency:String(x.currency||'BRL').toUpperCase(),reference:String(x.reference||x.source||'').trim().slice(0,160)};}
function key(x){return [x.date,x.type,x.amount?.toFixed(2),x.currency].join('|');}
export function previewStatement28({text,source='Extrato informado',maxRows=5000}={}){
 if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>2_000_000)throw Error('CSV vazio ou acima de 2 MB.');
 const separator=[';','\t',','].map(d=>[d,csv(text.slice(0,4000),d)[0]?.length||0]).sort((a,b)=>b[1]-a[1])[0][0];
 const raw=csv(text,separator);if(raw.length<2||raw.length>maxRows+1)throw Error('Extrato fora do limite de linhas.');
 const header=raw.shift().map(names),field=opts=>header.findIndex(x=>opts.includes(x));
 const positions={date:field(['data','date','datamovimentacao']),type:field(['tipo','type','movimentacao','natureza']),amount:field(['valor','amount','valorbrl','valormovimentacao']),currency:field(['moeda','currency']),reference:field(['referencia','reference','identificador','documento'])};
 if(['date','type','amount'].some(k=>positions[k]<0))throw Error('O CSV precisa de Data, Tipo e Valor. Selecione apenas extrato de entradas/saídas externas.');
 const rows=[],rejected=[];
 raw.forEach((a,i)=>{const input=Object.fromEntries(Object.entries(positions).map(([k,pos])=>[k,pos>=0?a[pos]:'']));const row=normalizeFlow(input);if(!row.date||!row.type||!row.amount||!['BRL','USD','EUR','GBP'].includes(row.currency)){rejected.push({line:i+2,reason:'Data/tipo/valor/moeda não reconhecido'});return;}rows.push(row);});
 const documentHash=createHash('sha256').update(text).digest('hex');
 return {rows,documentHash,source:String(source).slice(0,150),rejected,acceptedCount:rows.length,rejectedCount:rejected.length,containsOnlyExternalFlows:true,warning:'Arquivo tratado como declaração do usuário, não como prova de liquidação autenticada. Nenhuma transação é criada.'};
}
export function reconcileStatement28(preview,book,{from=null,to=null}={}){
 if(!Array.isArray(preview?.rows)||preview.rows.length>5000||!/^([a-f0-9]{64})$/.test(preview.documentHash))throw Error('Prévia inválida.');
 const observedDates=preview.rows.map(x=>x.date).sort();const first=observedDates[0]||null,last=observedDates.at(-1)||null;
 if(from!==null||to!==null){if(!validDate(from)||!validDate(to)||from>to||(first&&from>first)||(last&&to<last))throw Error('Período declarado não cobre todas as linhas do CSV.');}
 const pool=new Map();for(const r of (book.externalFlows||[])){if(from&&r.date<from||to&&r.date>to)continue;const v=normalizeFlow(r);if(!v.date||!v.type||!v.amount)continue;const k=key(v);pool.set(k,(pool.get(k)||0)+1);}
 const matched=[],extra=[];for(const r of preview.rows){const n=normalizeFlow(r),k=key(n);if(pool.get(k)>0){pool.set(k,pool.get(k)-1);matched.push(n);}else extra.push(n);}
 const missing=[...pool.entries()].flatMap(([k,count])=>Array.from({length:count},()=>{const [date,type,amount,currency]=k.split('|');return {date,type,amount:Number(amount),currency};}));
 const all=[...preview.rows,...missing];const dates=all.map(x=>x.date).filter(Boolean).sort();
 const complete=!!preview.rows.length&&!preview.rejectedCount&&!extra.length&&!missing.length;
 return {matched:matched.length,extra,missing,complete,from:from||dates[0]||null,to:to||dates.at(-1)||null,documentHash:preview.documentHash,source:preview.source,warning:complete?'Coincidência matemática de fluxos registrados; confirmação humana e abrangência das contas ainda necessárias.':'Divergência bloqueia o selo de conferência; nenhuma operação será criada.'};
}
export function validateStatementReview28(input){const m=input?.reconciliation;
 if(!m||m.complete!==true||m.extra?.length||m.missing?.length||!/^([a-f0-9]{64})$/.test(m.documentHash||'')||!validDate(m.from)||!validDate(m.to)||m.from>m.to||!Number.isInteger(m.matched)||m.matched<1)throw Error('Extrato sem conciliação completa.');
 if(input.confirmation!=='CONFERI_EXTRATOS')throw Error('Confirmação manual obrigatória.');
 const source=String(m.source||'').trim();if(source.length<8||source.length>150)throw Error('Referência de extrato insuficiente.');
 return {from:m.from,to:m.to,matched:m.matched,documentHash:m.documentHash,source,reviewedAt:new Date().toISOString(),reconciledByUser:true,authenticatedByInstitution:false};
}

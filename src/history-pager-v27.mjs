/** Stateless opaque HMAC cursor pagination, scoped to wallet, kind and filters. */
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const kinds={transactions:'transactions',quotes:'quoteHistory',foreign:'foreignTrades',events:'events',evidence:'taxEvidence',checks:'officialChecks',flows:'externalFlows',audit:'transactionAudit'};
const dateOf=x=>String(x?.date||x?.asOf||x?.deliveryDate||x?.reviewedAt||x?.createdAt||'').slice(0,10);
const codeOf=x=>String(x?.ticker||x?.assetKey||'').toUpperCase();
const ident=x=>String(x.id??'');
const validDate=x=>!x||(/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x);
export function createHistoryPager27({secret=randomBytes(32)}={}){
 const key=Buffer.isBuffer(secret)?secret:Buffer.from(secret);if(key.length<24)throw Error('Assinatura de página muito curta.');
 const mac=v=>createHmac('sha256',key).update(v).digest('base64url');
 const encode=object=>{const s=Buffer.from(JSON.stringify(object)).toString('base64url');return s+'.'+mac(s);};
 const decode=cursor=>{if(!cursor||cursor.length>1800||!/^[\w-]+\.[\w-]+$/.test(cursor))throw Error('Cursor de paginação inválido.');const [data,sign]=cursor.split('.'),signature=mac(data),a=Buffer.from(sign),b=Buffer.from(signature);if(a.length!==b.length||!timingSafeEqual(a,b))throw Error('Cursor de paginação não autorizado.');try{return JSON.parse(Buffer.from(data,'base64url').toString('utf8'));}catch{throw Error('Cursor de paginação ilegível.');}};
 function page(db,{kind='transactions',limit=40,cursor=null,portfolioId='',from='',to='',ticker=''}={}){
  if(!Object.hasOwn(kinds,kind))throw Error('Histórico não suportado.');const max=Number(limit);if(!Number.isInteger(max)||max<1||max>100)throw Error('Limite: entre 1 e 100 registros.');
  if(!validDate(from)||!validDate(to)||from&&to&&from>to)throw Error('Período inválido.');
  const code=String(ticker||'').toUpperCase();if(code&&!/^[A-Z0-9_.:-]{1,25}$/.test(code))throw Error('Filtro de ativo inválido.');
  const filters={kind,from,to,ticker:code,portfolioId:String(portfolioId)};let offset=0;
  if(cursor){const data=decode(cursor);if(JSON.stringify(data.f)!==JSON.stringify(filters)||!Number.isSafeInteger(data.i)||data.i<0)throw Error('Cursor pertence a outra carteira ou filtros.');offset=data.i;}
  const sorted=(db[kinds[kind]]||[]).map((value,i)=>({value,i,d:dateOf(value)})).filter(x=>(!from||x.d>=from)&&(!to||x.d<=to)&&(!code||codeOf(x.value)===code)).sort((a,b)=>b.d.localeCompare(a.d)||ident(b.value).localeCompare(ident(a.value))||b.i-a.i);
  const rows=sorted.slice(offset,offset+max).map(({value})=>value);
  return {kind,rows,totalFiltered:sorted.length,limit:max,hasMore:offset+rows.length<sorted.length,nextCursor:offset+rows.length<sorted.length?encode({f:filters,i:offset+rows.length}):null,warning:'Paginação por data e registro. Alterações simultâneas podem deslocar páginas; atualize a consulta após editar o histórico.'};
 }
 return {page};
}

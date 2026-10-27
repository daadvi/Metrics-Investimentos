/** Cursor-based SQL history. No plaintext metadata index is added to encrypted wallets. */
import {createHmac,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
const FIELDS=Object.freeze({transactions:'transactions',quotes:'quoteHistory',foreign:'foreignTrades',events:'events',evidence:'taxEvidence',checks:'officialChecks',flows:'externalFlows',audit:'transactionAudit'});
const validDate=s=>!s||/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const dateOf=x=>String(x?.date||x?.asOf||x?.deliveryDate||x?.reviewedAt||x?.createdAt||'').slice(0,10);
const tickerOf=x=>String(x?.ticker||x?.assetKey||'').toUpperCase();
function constantEq(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function createHistorySQL28(sql,{normalized=null,secret=randomBytes(32),legacyRead=null,activePortfolio=null}={}){
 const key=Buffer.from(secret);if(key.length<24)throw Error('Chave de paginação curta.');
 sql.exec('CREATE TABLE IF NOT EXISTS v28_history_revision(portfolio_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0)');
 const sig=s=>createHmac('sha256',key).update(s).digest('base64url');
 const encode=data=>{const s=Buffer.from(JSON.stringify(data)).toString('base64url');return s+'.'+sig(s);};
 const decode=s=>{if(typeof s!=='string'||s.length>1600||!/^[\w-]+\.[\w-]+$/.test(s))throw Error('Cursor inválido.');const [payload,mac]=s.split('.');if(!constantEq(sig(payload),mac))throw Error('Assinatura do cursor inválida.');try{return JSON.parse(Buffer.from(payload,'base64url').toString());}catch{throw Error('Cursor ilegível.');}};
 const isNormalized=()=>normalized?.status().normalized??false;
 const revision=id=>isNormalized()?Number(sql.prepare('SELECT revision FROM v28_history_revision WHERE portfolio_id=?').get(id)?.revision||0):String(sql.prepare('SELECT updated_at FROM storage WHERE id=1').get()?.updated_at||'');
 function bump(id){sql.prepare('INSERT INTO v28_history_revision(portfolio_id,revision) VALUES (?,1) ON CONFLICT(portfolio_id) DO UPDATE SET revision=revision+1').run(id);}
 function page({kind='transactions',limit=40,cursor=null,from='',to='',ticker='',portfolioId=null}={}){
  const field=FIELDS[kind],num=Number(limit),code=String(ticker||'').toUpperCase().trim();
  if(!field)throw Error('Histórico não suportado.');if(!Number.isInteger(num)||num<1||num>100)throw Error('Limite entre 1 e 100.');
  if(!validDate(from)||!validDate(to)||(from&&to&&from>to))throw Error('Período inválido.');if(code&&!/^[A-Z0-9._:-]{1,25}$/.test(code))throw Error('Filtro de ativo inválido.');
  const id=portfolioId||activePortfolio?.();if(!/^[a-f0-9-]{36}$/.test(String(id||'')))throw Error('Carteira inválida.');
  const filters={kind,from,to,ticker:code,id},rev=revision(id);let anchor=null;
  if(cursor){const c=decode(cursor);if(JSON.stringify(c.filters)!==JSON.stringify(filters)||c.rev!==rev||typeof c.d!=='string'||typeof c.k!=='string')throw Error('Histórico modificado ou cursor de outra carteira. Atualize a consulta.');anchor=c;}
  const normalizedNow=isNormalized(),encrypted=!!normalized?.status().encrypted;
  let rows=[],hasMore=false,backend='LEGACY_MEMORY',last=null;
  if(normalizedNow&&!encrypted){
   backend='SQL_KEYSET';
   let query=`SELECT item_key, date_key, payload, digest FROM v27_items WHERE portfolio_id=? AND field=?`;
   const args=[id,field];
   if(from){query+=' AND COALESCE(date_key,\'\')>=?';args.push(from);}
   if(to){query+=' AND COALESCE(date_key,\'\')<=?';args.push(to);}
   if(code){query+=` AND upper(COALESCE(json_extract(payload,'$.ticker'),json_extract(payload,'$.assetKey'),''))=?`;args.push(code);}
   if(anchor){query+=` AND (COALESCE(date_key,'')<? OR (COALESCE(date_key,'')=? AND item_key<?))`;args.push(anchor.d,anchor.d,anchor.k);}
   query+=` ORDER BY COALESCE(date_key,'') DESC,item_key DESC LIMIT ?`;args.push(num+1);
   const results=sql.prepare(query).all(...args);hasMore=results.length>num;
   const pageRows=results.slice(0,num);
   for(const item of pageRows){if(createHash('sha256').update(item.payload).digest('hex')!==item.digest)throw Error('Registro histórico corrompido.');rows.push(JSON.parse(item.payload));}
   const tail=pageRows.at(-1);if(tail)last={d:tail.date_key||'',k:tail.item_key};
  }else{
   backend=normalizedNow?'ENCRYPTED_SCOPED_SCAN':'LEGACY_MEMORY';
   let entries;
   if(normalizedNow){entries=normalized.readCollection(id,field);}else{
    const db=legacyRead?.();if(!db)throw Error('Leitura legada indisponível.');entries=(db[field]||[]).map((value,i)=>({value,item_key:typeof value?.id==='string'?'id:'+value.id:'pos:'+String(i).padStart(10,'0')}));
   }
   const list=entries.map(entry=>({value:entry.value,d:dateOf(entry.value),k:entry.item_key})).filter(x=>(!from||x.d>=from)&&(!to||x.d<=to)&&(!code||tickerOf(x.value)===code)&&(!anchor||x.d<anchor.d||x.d===anchor.d&&x.k<anchor.k)).sort((a,b)=>b.d.localeCompare(a.d)||b.k.localeCompare(a.k));
   hasMore=list.length>num;const selected=list.slice(0,num);rows=selected.map(x=>x.value);last=selected.at(-1)||null;
  }
  return {kind,rows,limit:num,hasMore,nextCursor:hasMore&&last?encode({filters,rev,d:last.d,k:last.k}):null,backend,totalFiltered:null,warning:backend==='SQL_KEYSET'?'Consulta paginada e filtrada no SQLite, sem transportar histórico integral.':backend==='ENCRYPTED_SCOPED_SCAN'?'Somente a coleção desta carteira foi descriptografada; datas/tickers não são indexados em texto simples.':'Banco antigo: paginação em memória até realizar migração opcional.'};
 }
 return {page,bump,revision};
}

/** Read-only connection quality, throttling suggestions and dated quotes. No API secrets. */
const DAY=86400000;
const age=(date,now)=>/^\d{4}-\d\d-\d\d$/.test(String(date))?Math.floor((Date.parse(now+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/DAY):null;
const capabilities={
 brapi:{catalog:true,quotes:true,history:'CONFORME_PLANO',dividends:'CONFORME_PLANO'},
 alphavantage:{catalog:true,quotes:true,history:'CONFORME_PLANO',dividends:'CONFORME_PLANO'},
 hgbrasil:{catalog:false,quotes:true,history:'NAO_VALIDADO',dividends:'CONFORME_PLANO'},
 dadosdemercado:{catalog:false,quotes:true,history:'CONFORME_PLANO',dividends:'CONFORME_PLANO'},
 massive:{catalog:false,quotes:true,history:'CONFORME_PLANO',dividends:'CONFORME_PLANO'}
};
export function providerHealth30(db,{now=new Date().toISOString().slice(0,10)}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(now))throw Error('Data inválida.');
 const rows=(db.apiConnectionsV29||[]).map(c=>{
  const catalogCount=(db.apiCatalogV29||[]).find(x=>x.connectionId===c.id)?.items?.length||0;
  const last=age(c.lastSyncAt?.slice(0,10),now);const coolDownMinutes=15;
  return {id:c.id,label:String(c.label||c.provider).slice(0,70),provider:c.provider,connected:!!c.id,capabilities:capabilities[c.provider]||{catalog:false,quotes:false},catalogLastSync:c.lastCatalogAt||null,lastSync:c.lastSyncAt||null,syncAgeDays:last,credentialState:'NAO_TESTADO_NESTA_CONSULTA',catalogRecords:catalogCount,refreshRecommended:last===null||last>=1,minimumIntervalMinutes:coolDownMinutes,warning:'Capacidades dependem do plano. Chave, permissões e licença de redistribuição não são verificadas automaticamente.'};
 });
 const observed=[...(db.quotes||[]),...(db.foreignMarketQuotes||[])].map(x=>({ticker:x.ticker,provider:x.provider||x.source,date:x.date,currency:x.currency||'BRL',ageDays:age(x.date,now)}));
 const stale=observed.filter(x=>x.ageDays===null||x.ageDays>7);
 return {connections:rows,coverage:{observations:observed.length,stale:stale.length,staleExamples:stale.slice(0,20)},recommendations:[...(!rows.length?['Adicione uma conexão na Central de APIs.']:[]),...(stale.length?['Atualize somente ativos com cotações antigas; evite consultas desnecessárias.']:[]),'Use lotes pequenos e respeite HTTP 429 e as condições do provedor.'],noCredentialsReturned:true};
}
export function nextSyncBatch30(db,{connectionId,now=new Date().toISOString(),limit=8}={}){
 if(!/^[a-f0-9-]{36}$/.test(String(connectionId)))throw Error('ID de conexão inválido.');
 if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('Lote entre 1 e 20 ativos.');
 const conn=(db.apiConnectionsV29||[]).find(c=>c.id===connectionId);if(!conn)throw Error('Conexão não encontrada.');
 const elapsed=conn.lastSyncAt?Date.parse(now)-Date.parse(conn.lastSyncAt):Infinity;
 if(conn.lastSyncAt&&!Number.isFinite(elapsed))throw Error('Data de sincronização inválida.');
 if(elapsed>=0&&elapsed<15*60*1000)return {allowed:false,waitMinutes:Math.ceil((15*60*1000-elapsed)/60000),tickers:[],reason:'Intervalo de proteção para chamadas repetidas.'};
 const tracked=[...new Set([...(db.transactions||[]).map(x=>x.ticker),...(db.watchlist||[]).map(x=>x.ticker)].filter(Boolean))].sort();
 const latest=new Map([...(db.quotes||[]),...(db.foreignMarketQuotes||[])].map(q=>[q.ticker,q]));
 const ordered=tracked.map(ticker=>({ticker,lastDate:latest.get(ticker)?.date||null})).sort((a,b)=>(a.lastDate||'').localeCompare(b.lastDate||'')||a.ticker.localeCompare(b.ticker));
 return {allowed:true,waitMinutes:0,tickers:ordered.slice(0,limit).map(x=>x.ticker),total:ordered.length,reason:'Prioriza ativos sem preços ou com preço mais antigo. Não executa operações de compra e venda.'};
}

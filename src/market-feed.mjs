/** Optional BYOK market data. No secrets are persisted; prices are NOT claimed to be live.
 * Uses documented brapi endpoints. Commercial licensing/redistribution is the user's responsibility.
 */
import {tickerOf,validDate} from './domain.mjs';
export const MARKET_PROVIDER='brapi.dev';
export const BRAPI_FREE_DELAY_MINUTES=30;
const round4=n=>Math.round(n*10000)/10000;
const asDay=value=>{if(typeof value!=='string')return null;const d=value.slice(0,10);return validDate(d)?d:null;};
export function parseBrapiQuotes(payload,{retrievedAt=new Date().toISOString(),expected=[]}={}){
 const rows=Array.isArray(payload?.results)?payload.results:[];
 if(!rows.length)throw Error('Provedor não retornou cotações; verifique ticker e assinatura.');
 const permitted=new Set(expected.map(tickerOf));
 const quotes=[];const missing=[];
 for(const x of rows){
  const item=x.data&&typeof x.data==='object'?x.data:x;
  let ticker;try{ticker=tickerOf(x.symbol||x.requestedSymbol||item.symbol);}catch{continue;}
  if(permitted.size&&!permitted.has(ticker))continue;
  const price=Number(item.regularMarketPrice);
  if(!Number.isFinite(price)||price<=0||price>1e9){missing.push(ticker);continue;}
  const date=asDay(item.regularMarketTime)||asDay(item.regularMarketDate);
  if(!date||!validDate(date)){missing.push(ticker);continue;} // Never label an unknown trade date as today.
  const time=typeof item.regularMarketTime==='string'&&!Number.isNaN(Date.parse(item.regularMarketTime))?new Date(item.regularMarketTime).toISOString():null;
  quotes.push({ticker,price:round4(price),date,quoteTime:time,previousClose:Number.isFinite(Number(item.regularMarketPreviousClose))&&Number(item.regularMarketPreviousClose)>0?round4(Number(item.regularMarketPreviousClose)):null,source:'brapi.dev (cotação potencialmente atrasada)',retrievedAt,provider:'brapi',delayMinutes:BRAPI_FREE_DELAY_MINUTES});
 }
 if(!quotes.length)throw Error('Não foi encontrada cotação válida para os ativos solicitados.');
 return {quotes,missing,source:MARKET_PROVIDER,observedAt:retrievedAt,warning:'Cotações com atraso dependente do plano do provedor (plano gratuito: cerca de 30 minutos). Não são preços em tempo real nem dados garantidos.'};
}
export async function fetchBrapiQuotes({tickers,key='',fetchImpl=fetch,now=new Date(),timeout=12000}={}){
 if(!Array.isArray(tickers)||!tickers.length||tickers.length>60)throw Error('Selecione entre 1 e 60 ativos.');
 const uniq=[...new Set(tickers.map(tickerOf))];
 const auth=String(key??'').trim();if(auth&&(!/^[A-Za-z0-9._-]{8,500}$/.test(auth)))throw Error('Chave de mercado inválida.');
 // Free public sandbox tickers may be queried without a key.
 if(!auth&&uniq.some(x=>!['PETR4','VALE3','MGLU3','ITUB4'].includes(x)))throw Error('Para consultar estes ativos, configure sua chave de mercado brapi (plano próprio).');
 const all=[],failures=[];
 for(const ticker of uniq){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try{
   const url=`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`;
   const r=await fetchImpl(url,{headers:{Accept:'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},signal:controller.signal,redirect:'error'});
   if(!r.ok){failures.push({ticker,error:r.status===429?'Limite de requisições atingido':`HTTP ${r.status}`});continue;}
   const data=await r.json();const parsed=parseBrapiQuotes(data,{retrievedAt:now.toISOString(),expected:[ticker]});all.push(...parsed.quotes);
  }catch(err){failures.push({ticker,error:err.name==='AbortError'?'Tempo limite de consulta':String(err.message||err).slice(0,120)});}finally{clearTimeout(timer);}
 }
 if(!all.length)throw Error('Nenhuma cotação atualizada. '+failures.map(x=>x.ticker+': '+x.error).join('; ').slice(0,500));
 return {quotes:all,failures,source:MARKET_PROVIDER,warning:'Preços de provedor externo, não em tempo real no plano gratuito. Consulte a data-base antes de decidir.'};
}

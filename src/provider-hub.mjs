/** Strict BYOK provider adapters. Secrets are never persisted or echoed in errors.
 * Only documented fixed HTTPS hosts and endpoints; provider responses are untrusted.
 * A quote is not verified as real-time and dividends are not issuer-confirmed.
 */
import {tickerOf,validDate} from './domain.mjs';
const CATALOG=[
 {id:'brapi',name:'brapi',coverage:'Brasil',keyUrl:'https://brapi.dev/dashboard',docsUrl:'https://brapi.dev/docs',quotes:true,dividends:true,free:'Preços com atraso; proventos dependem do plano.',market:'B3',kind:'BR',delay:'Plano gratuito: aproximadamente 30 minutos'},
 {id:'alphavantage',name:'Alpha Vantage',coverage:'Ações e ETFs internacionais',keyUrl:'https://www.alphavantage.co/support/#api-key',docsUrl:'https://www.alphavantage.co/documentation/',quotes:true,dividends:true,free:'Cerca de 25 consultas/dia; DIVIDENDS sujeito às permissões da chave.',market:'US/global',kind:'FOREIGN',delay:'Fechamento diário no plano gratuito'},
 {id:'hgbrasil',name:'HG Brasil Finance',coverage:'Ações e FIIs da B3',keyUrl:'https://console.hgbrasil.com/',docsUrl:'https://hgbrasil.com/docs/finance/stocks/',quotes:true,dividends:true,free:'Dividendos exigem chave e plano compatível (geralmente pago).',market:'B3',kind:'BR',delay:'Aproximadamente 15 a 45 minutos ou conforme plano'},
 {id:'dadosdemercado',name:'Dados de Mercado',coverage:'Ações/FIIs do Brasil',keyUrl:'https://www.dadosdemercado.com.br/api/docs',docsUrl:'https://www.dadosdemercado.com.br/api/docs',quotes:true,dividends:true,free:'Token obrigatório; limites e direitos de uso dependem da conta.',market:'B3',kind:'BR',delay:'Cotação de fechamento diário, não intradiária'},
 {id:'massive',name:'Massive Stocks',coverage:'Ações dos EUA',keyUrl:'https://massive.com/stocks',docsUrl:'https://massive.com/docs/rest/stocks/aggregates/previous-day-bar',quotes:true,dividends:true,free:'Basic: preços EOD e dividendos com histórico limitado a 2 anos, 5 chamadas/min.',market:'US',kind:'FOREIGN',delay:'Fim do dia no plano gratuito'},
 {id:'b3',name:'B3 (fontes públicas)',coverage:'Arquivos e documentos públicos',keyUrl:'https://developers.b3.com.br/',docsUrl:'https://developers.b3.com.br/apis/api-listados',quotes:false,dividends:false,free:'APIs do portal destinadas a clientes B2B; “PÚBLICA” não significa gratuita nem liberada para pessoa física.',market:'B3',kind:'OFFICIAL',delay:'Consulte a fonte'},
 {id:'cvm',name:'CVM (dados abertos)',coverage:'Informes, IPE e demonstrações',keyUrl:'https://dados.cvm.gov.br/',docsUrl:'https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe',quotes:false,dividends:false,free:'Arquivos públicos periódicos; não fornecem preços em tempo real.',market:'B3',kind:'OFFICIAL',delay:'Conforme atualização documental'}
];
export const providerCatalog=()=>CATALOG.map(x=>({...x,credentialsStored:false}));
const code=s=>{const v=String(s||'').trim().toUpperCase();if(!/^[A-Z0-9.\-]{1,20}$/.test(v))throw Error('Ticker inválido.');return v;};
function token(key){const k=String(key||'').trim();if(k.length<6||k.length>512||/[\s/?#&]/.test(k))throw Error('Informe uma chave válida do fornecedor, sem espaços.');return k;}
const dateOnly=s=>{if(!s)return null;const t=String(s).slice(0,10);return validDate(t)?t:null;};
const dateTime=v=>{const t=Date.parse(String(v||''));return Number.isFinite(t)?new Date(t).toISOString():null;};
const number=v=>v===undefined||v===null||v===''?null:Number(v);
function extractPrice(x,ticker,source,{currency='BRL',delay='EOD'}={}){
 const price=number(x.price),date=dateOnly(x.date);
 if(!Number.isFinite(price)||price<=0||price>1e10||!date)throw Error(`Resposta de ${source} sem fechamento ou data verificável para ${ticker}.`);
 const qt=x.timestamp?dateTime(x.timestamp):null;
 return {ticker,price:Number(price.toFixed(6)),date,quoteTime:qt,currency,source:`${source} (${delay})`,provider:source,delayLabel:delay,retrievedAt:new Date().toISOString(),isRealtime:false};
}
export function parseProviderQuotes(provider,payload,{ticker}={}){
 const t=code(ticker);
 if(provider==='alphavantage'){
  const x=payload?.['Global Quote'];if(!x||typeof x!=='object')throw Error('Alpha Vantage não retornou GLOBAL_QUOTE; verifique chave, quota e ticker.');
  if(x['01. symbol']&&code(x['01. symbol'])!==t)throw Error('Ticker retornado não coincide.');
  return [extractPrice({price:x['05. price'],date:x['07. latest trading day']},t,'Alpha Vantage',{currency:'USD',delay:'fechamento diário'})];
 }
 if(provider==='hgbrasil'){
  const row=(Array.isArray(payload?.results)?payload.results:[]).find(x=>String(x.symbol||'').toUpperCase()===t||String(x.ticker||'').toUpperCase()===`B3:${t}`);
  if(!row)throw Error('HG Brasil não retornou ticker solicitado; verifique chave e plano.');
  const q=row.quote||{},iso=q.updated_at||row.market?.updated_at;
  return [extractPrice({price:q.value,date:dateOnly(iso),timestamp:iso},t,'HG Brasil',{currency:'BRL',delay:'15–45 minutos ou conforme plano'})];
 }
 if(provider==='dadosdemercado'){
  const a=Array.isArray(payload)?payload:Array.isArray(payload?.results)?payload.results:Array.isArray(payload?.data)?payload.data:[];
  const rows=a.filter(x=>dateOnly(x.date)&&Number.isFinite(number(x.close)));
  const x=rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
  if(!x)throw Error('Dados de Mercado não retornou fechamento datado.');
  return [extractPrice({price:x.close,date:x.date},t,'Dados de Mercado',{currency:'BRL',delay:'fechamento diário'})];
 }
 if(provider==='massive'){
  if(payload?.ticker&&code(payload.ticker)!==t)throw Error('Ticker não coincide com o solicitado.');
  const x=(payload?.results||[])[0];const time=Number(x?.t);
  if(!x||!Number.isFinite(time)||time<946684800000)throw Error('Massive não retornou fechamento com timestamp válido.');
  return [extractPrice({price:x.c,date:new Date(time).toISOString().slice(0,10)},t,'Massive',{currency:'USD',delay:'fechamento diário'})];
 }
 throw Error('Provedor de cotação não suportado.');
}
export function parseDadosDividends(payload,{ticker}={}){
 const t=code(ticker),rows=Array.isArray(payload)?payload:Array.isArray(payload?.results)?payload.results:Array.isArray(payload?.data)?payload.data:[];
 const result=[];
 for(const x of rows.slice(0,1500)){
  if(x.ticker&&code(x.ticker)!==t)continue;
  const amount=number(x.amount),recordDate=dateOnly(x.record_date),paymentDate=dateOnly(x.payable_date),exDate=dateOnly(x.ex_date);
  if(!Number.isFinite(amount)||amount<=0||amount>1000000)continue;
  const kind=String(x.type||'').toUpperCase();const nature=/AMORTIZA/.test(kind)?'AMORTIZATION':/JCP|JUROS/.test(kind)?'JCP':/RENDIMENTO/.test(kind)?'FII_INCOME':'DIVIDEND';
  result.push({ticker:t,rate:amount,recordDate,paymentDate,exDate,nature,label:kind||'NÃO CLASSIFICADO',status:'DADOS_TERCEIROS_NAO_VERIFICADOS',currency:'BRL',source:'Dados de Mercado (terceiro)',sourceUrl:'https://www.dadosdemercado.com.br/api/docs',retrievedAt:new Date().toISOString(),eligibleForCalendar:!!(recordDate&&paymentDate),officiallyVerified:false});
 }
 return {observations:result,warning:'Os registros são informações de fornecedor e não comunicados oficiais autenticados. Não serão convertidos automaticamente em valores recebidos.'};
}
/** Dividends from overseas/Brazilian data vendors remain third-party observations.
 * Cash only; corporate actions involving stock quantities are not converted into dividends.
 */
export function parseAdditionalDividends(provider,payload,{ticker}={}){
 const t=code(ticker),rows=[];let currency='USD',source='';
 if(provider==='alphavantage'){
  source='Alpha Vantage';if(payload?.symbol&&code(payload.symbol)!==t)throw Error('Ticker de dividendos diferente do solicitado.');
  const list=Array.isArray(payload?.data)?payload.data:Array.isArray(payload?.dividends)?payload.dividends:[];
  for(const x of list)rows.push({ticker:t,amount:x.amount??x.dividend_amount,recordDate:x.record_date,paymentDate:x.payment_date,exDate:x.ex_dividend_date,label:'DIVIDEND'});
 }else if(provider==='massive'){
  source='Massive';for(const x of (Array.isArray(payload?.results)?payload.results:[]))if(!x.ticker||code(x.ticker)===t)rows.push({ticker:t,amount:x.cash_amount,recordDate:x.record_date,paymentDate:x.pay_date,exDate:x.ex_dividend_date,label:'DIVIDEND'});
 }else if(provider==='hgbrasil'){
  source='HG Brasil';currency='BRL';for(const asset of (Array.isArray(payload?.results)?payload.results:[])){
   if(String(asset.symbol||'').toUpperCase()!==t&&String(asset.ticker||'').toUpperCase()!==`B3:${t}`)continue;
   for(const x of (Array.isArray(asset.series)?asset.series:Array.isArray(asset.events)?asset.events:[])){
    if(x.category&&x.category!=='cash')continue;
    const type=String(x.type||'').toLowerCase();if(!['income','dividend','interest_on_equity','amortization','return_of_capital_in_cash'].includes(type))continue;
    rows.push({ticker:t,amount:x.unadjusted_amount??x.amount,recordDate:x.com_date,paymentDate:x.payment_date,exDate:null,label:type,nature:type==='amortization'||type==='return_of_capital_in_cash'?'AMORTIZATION':type==='interest_on_equity'?'JCP':type==='income'?'FII_INCOME':'DIVIDEND'});
   }
  }
 }else throw Error('Provedor de dividendos não suportado.');
 const observations=[];for(const x of rows.slice(0,1500)){
  const rate=number(x.amount);if(!Number.isFinite(rate)||rate<=0||rate>1000000)continue;
  const recordDate=dateOnly(x.recordDate),paymentDate=dateOnly(x.paymentDate),exDate=dateOnly(x.exDate);
  observations.push({ticker:t,rate,currency,recordDate,paymentDate,exDate,nature:x.nature||'DIVIDEND',label:x.label,status:'DADOS_TERCEIROS_NAO_VERIFICADOS',source:`${source} (terceiro)`,sourceUrl:providerCatalog().find(z=>z.id===provider)?.docsUrl||'',retrievedAt:new Date().toISOString(),eligibleForCalendar:!!(recordDate&&paymentDate),officiallyVerified:false});
 }
 if(!observations.length)throw Error('Fornecedor não retornou dividendos em dinheiro reconhecíveis. Verifique chave/plano e símbolo.');
 return {observations,warning:`Dados ${currency} de fornecedor; anúncio oficial e recebimento ainda não foram conciliados.`};
}
const permitted=new Set(['brapi','alphavantage','hgbrasil','dadosdemercado','massive']);
export async function queryProvider({provider,ticker,key,kind='quote',cvmCode,fetchImpl=fetch,timeout=12000}={}){
 if(!permitted.has(provider))throw Error('Provedor não permite consulta direta pelo Metrics. Consulte o portal oficial.');
 const t=code(ticker),k=token(key),ctrl=new AbortController(),clock=setTimeout(()=>ctrl.abort(),timeout);
 let url,headers={Accept:'application/json'};
 if(provider==='alphavantage'&&['quote','dividends'].includes(kind)){url=new URL('https://www.alphavantage.co/query');url.searchParams.set('function',kind==='dividends'?'DIVIDENDS':'GLOBAL_QUOTE');url.searchParams.set('symbol',t);url.searchParams.set('apikey',k);}
 else if(provider==='massive'&&['quote','dividends'].includes(kind)){url=kind==='quote'?new URL(`https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(t)}/prev`):new URL('https://api.massive.com/stocks/v1/dividends');if(kind==='dividends'){url.searchParams.set('ticker',t);url.searchParams.set('limit','100');}headers.Authorization='Bearer '+k;}
 else if(provider==='hgbrasil'&&['quote','dividends'].includes(kind)){url=new URL(kind==='dividends'?'https://api.hgbrasil.com/v2/finance/dividends':'https://api.hgbrasil.com/v2/finance/quotes');url.searchParams.set('tickers',`B3:${t}`);url.searchParams.set('key',k);}
 else if(provider==='dadosdemercado'){
  if(kind==='quote')url=new URL(`https://api.dadosdemercado.com.br/v1/tickers/${encodeURIComponent(t)}/quotes`);
  else if(kind==='dividends'){if(cvmCode!==undefined&&cvmCode!==null&&String(cvmCode)!==''){
   if(!/^\d{1,8}$/.test(String(cvmCode)))throw Error('Código CVM da companhia inválido.');
   url=new URL(`https://api.dadosdemercado.com.br/v1/companies/${cvmCode}/dividends`);
  }else if(/^[A-Z]{4,6}11$/.test(t))url=new URL(`https://api.dadosdemercado.com.br/v1/reits/${encodeURIComponent(t)}/dividends`);
  else throw Error('Para proventos de ações no Dados de Mercado, informe o código CVM da companhia.');
  }else throw Error('Tipo de consulta não suportado.');
  headers.Authorization='Bearer '+k;
 }else if(provider==='brapi'&&kind==='quote'){
  url=new URL(`https://brapi.dev/api/quote/${encodeURIComponent(t)}`);headers.Authorization='Bearer '+k;
 }else throw Error('O endpoint solicitado não está disponível neste conector/plano.');
 try{
  const res=await fetchImpl(url.toString(),{headers,signal:ctrl.signal,redirect:'error'});
  if(!res.ok)throw Error(res.status===429?'Limite de requisições da API alcançado.':res.status===401||res.status===403?'Chave ou plano sem permissão para este recurso.':`Falha HTTP ${res.status} no provedor.`);
  const contentLength=Number(res.headers?.get?.('content-length')||0);if(contentLength>3*1024*1024)throw Error('Resposta muito grande.');
  const s=await res.text();if(s.length>3*1024*1024)throw Error('Resposta grande demais.');let payload;try{payload=JSON.parse(s);}catch{throw Error('Resposta do provedor não é JSON válido.');}
  if(provider==='brapi'){const {parseBrapiQuotes}=await import('./market-feed.mjs');return {provider,kind,quotes:parseBrapiQuotes(payload,{expected:[t]}).quotes.map(q=>({...q,currency:'BRL',provider:'brapi',delayLabel:'Plano gratuito: cerca de 30 minutos',isRealtime:false})),warning:'Dados do fornecedor podem estar atrasados.'};}
  if(kind==='dividends')return {provider,kind,...(provider==='dadosdemercado'?parseDadosDividends(payload,{ticker:t}):parseAdditionalDividends(provider,payload,{ticker:t}))};
  return {provider,kind,quotes:parseProviderQuotes(provider,payload,{ticker:t}),warning:'Dados de mercado podem estar atrasados; não utilizar como cotação instantânea.'};
 }catch(err){if(err?.name==='AbortError')throw Error('Tempo esgotado ao consultar fornecedor.');throw err;}finally{clearTimeout(clock);}
}

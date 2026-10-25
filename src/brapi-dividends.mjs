/** brapi v2 dividend data. Plan-dependent, not an official issuer feed.
 * A missing or synthetic record/payment date is NEVER converted into a confirmed receivable.
 */
import {tickerOf,validDate} from './domain.mjs';
const digitsDate=v=>{if(!v)return null;const s=String(v).slice(0,10);return validDate(s)?s:null;};
const number=v=>v==null||v===''?null:Number(v);
export function parseBrapiDividends(payload,{tickers=[],kind='FII',retrievedAt=new Date().toISOString()}={}){
 const list=Array.isArray(payload?.dividends)?payload.dividends:Array.isArray(payload?.results)?payload.results.flatMap(v=>v.data?.dividends||v.dividends||[]):[];
 if(!Array.isArray(list))throw Error('Resposta de proventos inválida.');
 const allowed=new Set(tickers.map(tickerOf));const observations=[],rejected=[];
 for(const raw of list.slice(0,3000)){
  let ticker;try{ticker=tickerOf(raw.symbol||raw.ticker);}catch{rejected.push('ticker inválido');continue;}
  if(allowed.size&&!allowed.has(ticker))continue;
  const rate=number(raw.rate??raw.value??raw.amount),label=String(raw.label||raw.type||'NAO_CLASSIFICADO').toUpperCase().slice(0,80);
  if(!Number.isFinite(rate)||rate<=0||rate>1000000){rejected.push(ticker+': valor inválido');continue;}
  const remarks=String(raw.remarks||'').slice(0,350),synthetic=/backfill|refer[eê]ncia|monthlyreports|estimad/i.test(remarks);
  const paymentDate=digitsDate(raw.paymentDate),recordDate=digitsDate(raw.lastDatePrior||raw.recordDate),approvedOn=digitsDate(raw.approvedOn);
  const nature=/AMORTIZA/.test(label)?'AMORTIZATION':/JCP|JUROS.*CAPITAL/.test(label)?'JCP':/RENDIMENTO/.test(label)?'FII_INCOME':/DIVIDENDO/.test(label)?'DIVIDEND':'OTHER';
  const supported=!!paymentDate&&!!recordDate&&recordDate<=paymentDate&&!synthetic;
  observations.push({ticker,kind,nature,label,rate:Number(rate.toFixed(8)),paymentDate,recordDate,approvedOn,remarks,syntheticDates:synthetic,status:supported?'DATAS_PREENCHIDAS_POR_TERCEIRO':'DATAS_A_CONFERIR',eligibleForCalendar:supported,source:'brapi.dev (terceiro, sem autenticação da companhia)',sourceUrl:'https://brapi.dev/docs',retrievedAt});
 }
 return {observations,rejected,source:'brapi.dev',warning:'Proventos vindos de fornecedor externo. Datas históricas de referência não provam elegibilidade; consulte o anúncio da companhia antes de marcar como confirmado.'};
}
export async function fetchBrapiDividends({tickers,kind='FII',key='',fetchImpl=fetch,timeout=12000}={}){
 if(!['FII','STOCK'].includes(kind))throw Error('Classe do provedor inválida.');
 if(!Array.isArray(tickers)||!tickers.length||tickers.length>20)throw Error('Escolha 1 a 20 tickers por consulta.');
 const uniq=[...new Set(tickers.map(tickerOf))],token=String(key||'').trim();
 if(token&&!/^[A-Za-z0-9._-]{8,500}$/.test(token))throw Error('Chave do provedor inválida.');
 if(!token&&(kind==='STOCK'||uniq.some(t=>!['MXRF11','HGLG11'].includes(t))))throw Error('Proventos deste ativo exigem chave e plano compatível do fornecedor.');
 const path=kind==='FII'?'/api/v2/fii/dividends':'/api/v2/stocks/dividends';
 const url=new URL('https://brapi.dev'+path);url.searchParams.set('symbols',uniq.join(','));
 const ctrl=new AbortController(),clock=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const res=await fetchImpl(url.toString(),{headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{})},signal:ctrl.signal,redirect:'error'});
  if(!res.ok)throw Error(res.status===403||res.status===401?'Plano ou chave sem acesso aos proventos.':res.status===429?'Limite de consultas atingido.':'Fornecedor retornou HTTP '+res.status);
  const bytes=await res.text();if(bytes.length>4*1024*1024)throw Error('Resposta do fornecedor grande demais.');
  let payload;try{payload=JSON.parse(bytes);}catch{throw Error('Fornecedor retornou JSON inválido.');}
  return parseBrapiDividends(payload,{tickers:uniq,kind});
 }finally{clearTimeout(clock);}
}

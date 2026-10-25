/** Dados externos opcionais. A fonte é um terceiro, NÃO a CVM/B3 oficialmente.
 * BYOK e verificação de licença continuam sendo responsabilidade do usuário/projeto.
 */
import {tickerOf,validDate} from './domain.mjs';
const route={FII_INDICATORS:'/api/v2/fii/indicators',FII_DIVIDENDS:'/api/v2/fii/dividends',STOCK_DIVIDENDS:'/api/v2/stocks/dividends',FII_PROPERTIES:'/api/v2/fii/properties',STOCK_STATISTICS:'/api/v2/stocks/statistics'};
const allowed=new Set(Object.keys(route));
const dateValue=x=>typeof x==='string'&&validDate(x.slice(0,10))?x.slice(0,10):null;
const nullable=(v,{min=0,max=1e15}={})=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max?Number(v):null;
function pick(o,names){for(const key of names)if(o&&o[key]!==undefined&&o[key]!==null)return o[key];return null;}
function results(payload){if(Array.isArray(payload))return payload;if(Array.isArray(payload?.results))return payload.results;if(Array.isArray(payload?.data))return payload.data;if(Array.isArray(payload?.dividends))return payload.dividends;if(payload?.data&&typeof payload.data==='object')return [payload.data];return [];}
function matches(row,symbol){const code=pick(row,['ticker','symbol','requestedSymbol','code','codNegociacao']);return !code||String(code).toUpperCase()===symbol;}
export function normalizeProviderData(kind,symbol,payload){
 if(!allowed.has(kind))throw Error('Dataset não autorizado.');
 const ticker=tickerOf(symbol),list=results(payload).filter(x=>x&&typeof x==='object'&&matches(x,ticker));
 if(!list.length)throw Error('Fornecedor não devolveu dados compatíveis para '+ticker+'.');
 const source='brapi.dev (fonte terceirizada, conferir documento original)';
 if(kind==='FII_DIVIDENDS'||kind==='STOCK_DIVIDENDS'){
  const parts=list.flatMap(x=>Array.isArray(x.data)?x.data:Array.isArray(x.dividends)?x.dividends:Array.isArray(x.cashDividends)?x.cashDividends:x.data&&Array.isArray(x.data.cashDividends)?x.data.cashDividends:[x]);
  const events=[];
  for(const e of parts){const pay=dateValue(pick(e,['paymentDate','payment','datePayment','payDate','dataPagamento']));const record=dateValue(pick(e,['lastDatePrior','recordDate','withDate','comDate','dataCom']));const amount=nullable(pick(e,['rate','value','amount','valuePerShare','dividendPerShare','rendimento']),{max:1e6});
   if(!pay||!record||record>pay||amount===null||amount<=0)continue;
   events.push({ticker,recordDate:record,date:pay,perShare:amount,kind:'CONFIRMADO',nature:String(pick(e,['label','type','description'])||'Rendimento').slice(0,80),source,verification:'TERCEIRO_NAO_OFICIAL',sourceUrl:'https://brapi.dev/docs'});
  }
  if(!events.length)throw Error('Resposta sem pagamentos completos (data-com, data-pagamento, valor/cota). Nenhuma data foi inventada.');
  return {kind,ticker,events:[...new Map(events.map(e=>[[e.ticker,e.recordDate,e.date,e.perShare].join('|'),e])).values()].sort((a,b)=>a.date.localeCompare(b.date)),source,warnings:['Valores divulgados por fornecedor independente; consulte também o anúncio da fonte pagadora.','Acesso a dividendos pode exigir plano pago.']};
 }
 if(kind==='FII_INDICATORS'||kind==='STOCK_STATISTICS'){
  const r=list[0].data&&typeof list[0].data==='object'?list[0].data:list[0];
  const observedAt=dateValue(pick(r,['referenceDate','date','updatedAt','dateBase']))||null;
  const indicators={patrimonioLiquido:nullable(pick(r,['netWorth','netAssets','equity','patrimonioLiquido','patrimonio'])),pvp:nullable(pick(r,['pvp','priceToBook','priceToBookValue']),{max:1e6}),dy12:nullable(pick(r,['dividendYield','dy12m','dy12','dividendYield12m']),{max:1000}),vacancy:nullable(pick(r,['vacancyRate','vacancy','vacancia']),{max:100}),properties:nullable(pick(r,['propertiesCount','propertyCount','numberOfProperties','properties']),{max:1e6}),occupied:nullable(pick(r,['occupiedProperties','occupied','numberOccupied']),{max:1e6})};
  if(Object.values(indicators).every(v=>v===null))throw Error('Campos financeiros desconhecidos nesta resposta; não criar fundamentos fictícios.');
  if(indicators.occupied!==null&&indicators.properties!==null&&indicators.occupied>indicators.properties)throw Error('Dados contraditórios: ocupados acima do total.');
  return {kind,ticker,indicators,source,observedAt,rawKeys:Object.keys(r).slice(0,32),warnings:['Verifique a data-base e a definição de cada indicador antes de comparar ativos.']};
 }
 const r=list[0];return {kind,ticker,source,observedAt:dateValue(pick(r,['referenceDate','date','updatedAt'])),records:list.length,warning:'Conjunto de dados disponível para consulta, mas seu mapeamento estruturado ainda exige validação da fonte.'};
}
export async function fetchBrapiDataset({kind,ticker,key,fetchImpl=fetch,timeout=12000}={}){
 if(!allowed.has(kind))throw Error('Tipo de pesquisa inválido.');
 const symbol=tickerOf(ticker);if(!/^[A-Za-z0-9._-]{8,500}$/.test(String(key||'')))throw Error('Informe sua chave brapi válida.');
 const params=new URLSearchParams({symbols:symbol});const url='https://brapi.dev'+route[kind]+'?'+params.toString();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const r=await fetchImpl(url,{method:'GET',headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},signal:controller.signal,redirect:'error'});
  if(!r.ok)throw Error(r.status===401||r.status===403?'Este conjunto de dados não está disponível no seu plano ou chave.':r.status===429?'Limite do provedor atingido.':'Fornecedor indisponível (HTTP '+r.status+').');
  const payload=await r.text();if(payload.length>1500000)throw Error('Resposta do provedor grande demais.');
  const out=normalizeProviderData(kind,symbol,JSON.parse(payload));return {...out,requestedAt:new Date().toISOString(),providerUrl:url};
 }finally{clearTimeout(timer);}
}

/** Metrics 2.4: official document provenance, multi-asset wealth coverage and fiscal reviews.
 * Non-authoritative calculations. Source provenance is not a regulatory endorsement.
 */
import {createHash} from 'node:crypto';
const dayMs=86_400_000;
const today=()=>new Date().toISOString().slice(0,10);
const amount=n=>Math.round((n+Number.EPSILON)*100)/100;
const text=(s,n=180)=>String(s??'').trim().slice(0,n);
const iso=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d))&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const yearOK=n=>Number.isInteger(Number(n))&&Number(n)>=2000&&Number(n)<=2200;
const age=(start,end)=>(Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/dayMs;
const positive=n=>Number.isFinite(Number(n))&&Number(n)>=0&&Number(n)<=1e12;
const moneyOK=n=>positive(n)&&Number(n)>0;

export function validateExternalFlow(raw){
 const date=text(raw.date,10),type=text(raw.type,20).toUpperCase(),currency=text(raw.currency||'BRL',8).toUpperCase(),value=Number(raw.amount),source=text(raw.source,180);
 if(!iso(date)||!['DEPOSIT','WITHDRAW'].includes(type)||!['BRL','USD','EUR','GBP','CAD','JPY','CHF','AUD'].includes(currency)||!moneyOK(value)||source.length<4)throw Error('Aporte/retirada exige data, tipo, moeda, valor positivo e comprovante/fonte.');
 return {date,type,currency,amount:amount(value),source,note:text(raw.note,300)};
}
export function validateValuation(raw){
 const date=text(raw.date,10),assetClass=text(raw.assetClass,30).toUpperCase(),assetKey=text(raw.assetKey,80),currency=text(raw.currency||'BRL',8).toUpperCase(),value=Number(raw.value),source=text(raw.source,200);
 if(!iso(date)||!['FIXED_INCOME','OTHER','CASH'].includes(assetClass)||!/^[A-Za-z0-9_.:-]{2,80}$/.test(assetKey)||!['BRL','USD','EUR','GBP','CAD','JPY','CHF','AUD'].includes(currency)||raw.value===null||raw.value===undefined||String(raw.value).trim()===''||!positive(value)||source.length<5)throw Error('Avaliação exige ativo/chave, classe, valor >= 0, data, moeda e extrato de origem.');
 return {date,assetClass,assetKey,currency,value:amount(value),source,note:text(raw.note,300),isMarketQuote:false};
}
export function validateProfessionalReview(raw){
 const year=Number(raw.year),reviewer=text(raw.reviewer,150),basis=text(raw.basis,1000),decision=text(raw.decision,35).toUpperCase();
 if(!yearOK(year)||reviewer.length<4||basis.length<20||!['NEEDS_CHANGES','EVIDENCE_REVIEWED'].includes(decision))throw Error('Revisão exige exercício, revisor, fundamentação de 20+ caracteres e decisão.');
 const documentId=text(raw.documentId,180);if(documentId.length<5)throw Error('Vincule referência de parecer, informe ou protocolo do revisor.');
 return {year,reviewer,basis,decision,documentId,scope:text(raw.scope,400),credentialsNotVerified:true,certifiedByApp:false};
}
function safeUrl(raw){
 let u;try{u=new URL(raw);}catch{throw Error('Link de comunicado inválido.');}
 const h=u.hostname.toLowerCase();const cvm=h==='cvm.gov.br'||h.endsWith('.cvm.gov.br');const gov=h==='www.gov.br'&&u.pathname.startsWith('/cvm/');
 if(u.protocol!=='https:'||u.username||u.password||u.port||!(cvm||gov)||u.href.length>1600)throw Error('Somente links HTTPS oficiais da CVM, sem credenciais, portas ou redirecionamento.');
 return u.toString();
}
function dateBR(s){const m=String(s).match(/\b(0?[1-9]|[12]\d|3[01])[\/.\-](0?[1-9]|1[012])[\/.\-](20\d\d)\b/);if(!m)return null;const d=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return iso(d)?d:null;}
function parseMoney(s){let v=text(s,35).replace(/\s/g,'');if(!v)return null;if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');const n=Number(v);return Number.isFinite(n)&&n>0&&n<1e6?n:null;}
/** Extract only uniquely labeled terms. Complex or conflicting tables always require human review. */
export function detectDividendTerms(body){
 const s=String(body||'').replace(/\s+/g,' ').slice(0,180000);
 const record=[...s.matchAll(/(?:data[- ]com|data[- ]base|posi[cç][aã]o acion[aá]ria|posi[cç][aã]o de cotistas)\s*(?:em|:|ser[aá]|at[eé])?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d\d)/gi)].map(m=>dateBR(m[1])).filter(Boolean);
 const payment=[...s.matchAll(/(?:data de pagamento|pagamento (?:ser[aá] (?:feito|realizado|efetuado) em|em|previsto para)|cr[eé]dito em)\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d\d)/gi)].map(m=>dateBR(m[1])).filter(Boolean);
 const values=[...s.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2,10}|0\.\d{2,10})\s*(?:reais?)?\s*(?:por (?:a[cç][aã]o|cota|unit)|\/\s*(?:a[cç][aã]o|cota))/gi)].map(m=>parseMoney(m[1])).filter(Boolean);
 const unique=arr=>[...new Set(arr)];const a=unique(record),b=unique(payment),c=unique(values);
 const ready=a.length===1&&b.length===1&&c.length===1&&a[0]<=b[0];
 return {recordDate:a.length===1?a[0]:null,paymentDate:b.length===1?b[0]:null,perUnit:c.length===1?c[0]:null,ambiguous:!ready,candidates:{recordDates:a.length,paymentDates:b.length,perUnitValues:c.length},note:ready?'Extração literal única encontrada. Conferir espécie/classe do título, ajustes e documento original antes de usar.':'Sem termos únicos completos. Nenhum anúncio ou crédito será criado.'};
}
export async function inspectOfficialIPE(db,{documentId,ticker,sourceUrl,fetchImpl=fetch,extractPdf}={}){
 const id=text(documentId,150),code=text(ticker,24).toUpperCase();const rows=(db.ipeIndex||[]).filter(r=>r.documentId===id&&r.ticker===code&&r.sourceUrl===sourceUrl);
 if(rows.length!==1)throw Error('É necessário selecionar exatamente um documento IPE previamente importado e vinculado a CNPJ/ticker.');
 const entry=rows[0],url=safeUrl(entry.sourceUrl);if(!/aviso|fato|comunicad|dividend|provent|juros|rendiment|assemble/i.test(entry.category+' '+entry.title))throw Error('O tipo do documento não indica divulgação de provento.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const res=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'application/pdf, text/plain'}});
  if(!res.ok||res.redirected)throw Error(`Documento CVM indisponível (HTTP ${res.status}).`);
  const mime=String(res.headers?.get?.('content-type')||'').toLowerCase();if(!/(application\/pdf|text\/plain|application\/octet-stream)/.test(mime))throw Error('Formato de documento não suportado com segurança.');
  let length=0;const chunks=[];for await(const chunk of res.body){length+=chunk.length;if(length>3*1024*1024)throw Error('Comunicado maior que 3 MB.');chunks.push(Buffer.from(chunk));}
  const bytes=Buffer.concat(chunks),isPdf=bytes.subarray(0,5).toString()==='%PDF-';
  if(!isPdf&&/application\/pdf/.test(mime))throw Error('Cabeçalho PDF inconsistente.');
  if(!isPdf&&!/text\/plain/.test(mime))throw Error('Arquivo desconhecido; exame manual necessário.');
  if(isPdf&&typeof extractPdf!=='function')throw Error('Leitor PDF indisponível.');
  const content=isPdf?(await extractPdf(bytes)).text:bytes.toString('utf8');
  const terms=detectDividendTerms(content);
  return {id:createHash('sha256').update(id+'|'+url+'|'+bytes.length).digest('hex').slice(0,24),ticker:code,cnpj:entry.cnpj,documentId:id,version:entry.version,deliveryDate:entry.deliveryDate,sourceUrl:url,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,checkedAt:new Date().toISOString(),terms,sourceRetrieved:true,sourceMetadataMatchesIPE:true,verifiedAutomatically:false,reviewStatus:'PENDING',origin:'CVM_IPE_DOCUMENT',note:'Metadados oficiais e integridade do arquivo conferidos. O teor, classe do ativo e direitos econômicos dependem de revisão humana. Não lança valores automaticamente.'};
 }finally{clearTimeout(timer);}
}
// Metrics 2.5: indexed, provenance-aware portfolio valuation.
// Index once for a report; avoid rescanning/sorting all observations for each asset/month.
const validQuote=q=>iso(q.date)&&Number.isFinite(Number(q.price))&&Number(q.price)>0;
const ccyOf=c=>String(c||'BRL').toUpperCase();
function buildIndex(rows,keyFn,validFn){
 const result=new Map();for(const row of rows||[]){if(!validFn(row))continue;const key=keyFn(row);if(!result.has(key))result.set(key,[]);result.get(key).push(row);}
 for(const list of result.values())list.sort((a,b)=>a.date.localeCompare(b.date)||String(a.id||'').localeCompare(String(b.id||'')));
 return result;
}
function onOrBefore(map,key,date,maxAge){
 const arr=map.get(key)||[];let l=0,r=arr.length-1,found=-1;
 while(l<=r){const m=(l+r)>>1;if(arr[m].date<=date){found=m;l=m+1;}else r=m-1;}
 if(found<0)return null;
 const record=arr[found];return age(record.date,date)<=maxAge?record:null;
}
function indexedContext(db){
 return {
  domestic:buildIndex([...(db.quoteHistory||[]),...(db.quotes||[])],q=>String(q.ticker||'').toUpperCase(),validQuote),
  foreign:buildIndex(db.foreignMarketQuotes||[],q=>ccyOf(q.currency)+'|'+String(q.ticker||'').toUpperCase(),validQuote),
  fx:buildIndex(db.fxRates||[],q=>ccyOf(q.currency),q=>iso(q.date)&&Number.isFinite(Number(q.rate))&&Number(q.rate)>0),
  valuations:buildIndex(db.assetValuations||[],q=>q.assetClass+'|'+q.assetKey+'|'+ccyOf(q.currency),q=>iso(q.date)&&Number.isFinite(Number(q.value))&&Number(q.value)>=0),
 };
}
function changeBRL(ctx,value,currency,date){
 if(currency==='BRL')return {valueBRL:amount(value),rate:1,rateDate:date,source:'BRL'};
 const r=onOrBefore(ctx.fx,currency,date,7);
 return r?{valueBRL:amount(value*r.rate),rate:r.rate,rateDate:r.date,source:r.source,ptaxIsReference:r.type==='PTAX_SELL'}:{valueBRL:null,reason:`Câmbio ${currency}/BRL ausente ou defasado`};
}
function latestSnapshot(ctx,cls,key,ccy,date,maxAge=45){return onOrBefore(ctx.valuations,cls+'|'+key+'|'+ccy,date,maxAge);}
/** Every recorded asset stays visible even when its latest valuation expires. */
export function consolidatedWealth(db,{asOf=today(),calculatePositions,foreignPositions,fixedIncomePosition,maxQuoteAge=7,_index=null}={}){
 if(!iso(asOf))throw Error('Data de avaliação inválida.');
 if(!Number.isInteger(maxQuoteAge)||maxQuoteAge<0||maxQuoteAge>365)throw Error('Idade máxima de cotação inválida.');
 if(![calculatePositions,foreignPositions,fixedIncomePosition].every(x=>typeof x==='function'))throw Error('Avaliadores do ledger indisponíveis.');
 const index=_index||indexedContext(db),items=[],missing=[],issues=[],included=new Set();let known=0;
 const add=({assetKey,assetClass,currency='BRL',value=null,source=null,valuationDate=null,details={}})=>{
  const key=assetClass+'|'+assetKey+'|'+currency;
  if(included.has(key)){issues.push('Posição duplicada: '+key);return;}included.add(key);
  const fx=value===null?{valueBRL:null,reason:'Sem avaliação documental atual'}:changeBRL(index,value,currency,asOf);
  if(fx.valueBRL===null)missing.push({assetKey,assetClass,currency,reason:fx.reason});else known=amount(known+fx.valueBRL);
  items.push({assetKey,assetClass,currency,valueNative:value,valueBRL:fx.valueBRL,source,valuationDate,fxRateDate:fx.rateDate||null,...details});
 };
 const domestic=(db.transactions||[]).filter(x=>x.date<=asOf);
 let brazil=[];
 try{brazil=calculatePositions(domestic).filter(x=>x.quantity>1e-9);}catch(e){issues.push('Ledger brasileiro: '+e.message);missing.push({reason:'Ledger brasileiro inválido'});}
 for(const p of brazil){
  const q=onOrBefore(index.domestic,p.ticker,asOf,maxQuoteAge);
  add({assetKey:p.ticker,assetClass:db.instruments?.find(x=>x.ticker===p.ticker)?.assetClass||'BOLSA_BR',value:q?amount(p.quantity*q.price):null,source:q?.source||null,valuationDate:q?.date||null,details:{quantity:p.quantity,cost:p.cost}});
 }
 let abroad=[];
 try{abroad=foreignPositions((db.foreignTrades||[]).filter(x=>x.date<=asOf)).filter(x=>x.quantity>1e-9);}catch(e){issues.push('Ledger internacional: '+e.message);missing.push({reason:'Ledger internacional inválido'});}
 for(const p of abroad){
  const q=onOrBefore(index.foreign,p.currency+'|'+p.ticker,asOf,maxQuoteAge);
  add({assetKey:p.ticker,assetClass:'BOLSA_EXTERIOR',currency:p.currency,value:q?amount(p.quantity*q.price):null,source:q?.source||null,valuationDate:q?.date||null,details:{quantity:p.quantity,costNative:p.cost}});
 }
 for(const f of (db.fixedIncome||[]).filter(x=>x.startDate<=asOf)){
  let p;try{p=fixedIncomePosition(f,{asOf});}catch(e){issues.push('Contrato '+f.ticker+': '+e.message);missing.push({assetKey:f.id||f.ticker,reason:'Contrato inválido'});continue;}
  if(p.remainingPrincipal<=0)continue;
  const key=f.id||f.ticker,q=latestSnapshot(index,'FIXED_INCOME',key,f.currency,asOf);
  add({assetKey:key,assetClass:'FIXED_INCOME',currency:f.currency,value:q?.value??null,source:q?.source??null,valuationDate:q?.date??null,details:{ticker:f.ticker,principalOutstanding:p.remainingPrincipal,estimatedGrossNotUsedAsValue:p.estimatedContractGross}});
 }
 const listedOthers=new Set();
 for(const [key,values] of index.valuations){
  const [cls,assetKey,currency]=key.split('|');
  if(!['OTHER','CASH'].includes(cls))continue;
  const firstBefore=values.some(x=>x.date<=asOf);if(!firstBefore)continue;
  if(cls==='OTHER')listedOthers.add(key);
  // A stale valuation is still a liability for data quality. Never omit it silently.
  const q=latestSnapshot(index,cls,assetKey,currency,asOf);
  if(cls==='OTHER'&&([...(db.instruments||[])].some(x=>x.ticker===assetKey&&x.assetClass!=='OTHER')||[...brazil,...abroad].some(x=>x.ticker===assetKey))){
   issues.push('Avaliação OUTROS pode duplicar cadastro negociado: '+assetKey);missing.push({assetKey,assetClass:cls,reason:'Possível duplicação com posição negociada'});continue;
  }
  add({assetKey,assetClass:cls,currency,value:q?.value??null,source:q?.source??null,valuationDate:q?.date??null});
 }
 for(const reg of (db.instruments||[]).filter(x=>x.assetClass==='OTHER')){
  const key='OTHER|'+reg.ticker+'|'+reg.currency;
  if(!listedOthers.has(key)&&!included.has(key))add({assetKey:reg.ticker,assetClass:'OTHER',currency:reg.currency});
 }
 if(!items.some(x=>x.assetClass==='CASH'))missing.push({assetClass:'CASH',reason:'Saldo de caixa ausente: informe ao menos um extrato datado (inclusive zero).'});
 const flows=(db.externalFlows||[]).filter(x=>x.date<=asOf);
 const netExternalBRL=amount(flows.filter(x=>x.currency==='BRL').reduce((s,x)=>s+(x.type==='DEPOSIT'?x.amount:-x.amount),0));
 return {asOf,complete:missing.length===0&&issues.length===0,totalBRL:missing.length||issues.length?null:known,partialKnownBRL:known,positions:items,missing,issues,externalFlows:{count:flows.length,netBRLRecorded:netExternalBRL,foreignFlowsNotConverted:flows.filter(x=>x.currency!=='BRL').length},unreconciledCashflowCaveat:'Depósitos/retiradas não são saldo. Caixa precisa de extratos; a soma não considera dívidas externas nem passivos não cadastrados.',warning:'Dados ausentes e defasados não recebem valores fictícios. O total é patrimônio em ativos cadastrados, não patrimônio líquido pessoal, lucro ou TWR auditado.'};
}
export function consolidatedEvolution(db,{asOf=today(),months=12,...helpers}={}){
 if(!iso(asOf)||!Number.isInteger(months)||months<1||months>120)throw Error('Período inválido.');
 const index=indexedContext(db),points=[];
 for(let i=months-1;i>=0;i--){
  const d=new Date(asOf+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-i+1);d.setUTCDate(0);
  const date=d.toISOString().slice(0,10)>asOf?asOf:d.toISOString().slice(0,10);
  const val=consolidatedWealth(db,{asOf:date,...helpers,_index:index});
  const netExternalMonth=amount((db.externalFlows||[]).filter(x=>x.date?.slice(0,7)===date.slice(0,7)&&x.currency==='BRL').reduce((s,x)=>s+(x.type==='DEPOSIT'?x.amount:-x.amount),0));
  points.push({date,totalBRL:val.totalBRL,partialKnownBRL:val.partialKnownBRL,complete:val.complete,missingCount:val.missing.length,netExternalBRL:netExternalMonth});
 }
 return {points,completePoints:points.filter(p=>p.complete).length,warning:'Evolução de saldos, não rentabilidade. Aporte não é lucro; lacunas de preços/FX permanecem incompletas.'};
}
/** Local read-only audit. Does not transmit raw financial entries or secret provider keys. */
export function auditQuality25(db,{asOf=today(),calculatePositions,foreignPositions,fixedIncomePosition,valuationOverride=null}={}){
 const counters={transactions:db.transactions?.length||0,documents:db.documents?.length||0,events:db.events?.length||0,officialChecks:db.officialChecks?.length||0,externalFlows:db.externalFlows?.length||0,valuations:db.assetValuations?.length||0,taxReviews:db.taxReviews?.length||0};
 const evaluation=valuationOverride||consolidatedWealth(db,{asOf,calculatePositions,foreignPositions,fixedIncomePosition});
 const alerts=[];
 const add=(severity,title,description,action)=>alerts.push({severity,title,description,action});
 if(evaluation.missing.length)add('HIGH','Avaliações incompletas',`${evaluation.missing.length} ativo(s)/câmbio/caixa sem avaliação válida.`,'Atualize preços, saldos e taxas com data e origem.');
 if(evaluation.issues.length)add('HIGH','Inconsistências ou duplicação',`${evaluation.issues.length} alerta(s) de ledger ou dupla contagem.`,'Concilie lançamentos com extratos antes de confiar no total.');
 if((db.officialChecks||[]).some(c=>c.reviewStatus==='PENDING'))add('MEDIUM','Documentos sem revisão','Há inspeções CVM pendentes de leitura humana.','Leia o documento integral e registre decisão justificada.');
 const lastClosedYear=Number(asOf.slice(0,4))-(asOf.slice(5)< '12-31'?1:0);
 if(lastClosedYear>=2000&&!(db.snapshots||[]).some(s=>s.asOf===lastClosedYear+'-12-31'))add('MEDIUM','Custódia anual não conciliada',`Sem extrato de 31/12/${lastClosedYear} para conferência.`, 'Importe extrato do último ano concluído, sem criar operações fictícias.');
 const hist=db.quoteHistory?.length||0;
 if(counters.transactions>1000&&hist<200)add('MEDIUM','Histórico insuficiente','Muitas operações e poucos preços históricos.','Importe séries datadas para melhorar a cobertura da evolução.');
 const keyFor=v=>[v.assetClass,v.assetKey,v.currency,v.date].join('|');
 const seen=new Set();let duplicateValuations=0;for(const v of db.assetValuations||[]){const k=keyFor(v);if(seen.has(k))duplicateValuations++;seen.add(k);}
 if(duplicateValuations)add('MEDIUM','Avaliações no mesmo dia',`${duplicateValuations} lançamento(s) repetidos por classe, ativo, moeda e data.`, 'Compare extratos e mantenha somente o registro correto, sem apagar o histórico de backup.');
 if(!db.settings||!db.settings.theme)add('LOW','Configuração básica','Preferência visual não registrada.','Ajuste o tema se necessário.');
 const alternatives=[];
 if(evaluation.missing.length)alternatives.push({need:'Preços e avaliações faltantes',options:['Importação autorizada de histórico COTAHIST da B3','Consulta opcional aos provedores já configurados com chave própria','Registro de extratos de saldo com data e fonte'],policy:'Não atribuir tempo real a dados atrasados; não inventar preços.'});
 if((db.officialChecks||[]).some(c=>c.reviewStatus==='PENDING')||!(db.ipeIndex||[]).length)alternatives.push({need:'Comunicados e proventos',options:['Consultar o índice de documentos IPE da CVM','Ler o comunicado oficial e revisar retificações','Conciliar valores com informe e crédito efetivo'],policy:'Não transformar índice IPE em dividendo automaticamente.'});
 alternatives.push({need:'Dossiê fiscal',options:['Conciliar documentos com o ReVar da Receita Federal quando aplicável','Verificar casos especiais e exercício com profissional habilitado'],policy:'Não emitir DARF ou imposto definitivo sem dados completos.'});
 return {date:asOf,portfolioOnly:true,complete:evaluation.complete,documentedTotalBRL:evaluation.totalBRL,coverage:{assets:evaluation.positions.length,missing:evaluation.missing.length,issues:evaluation.issues.length},counters,alerts,alternatives,priorities:[...alerts].sort((a,b)=>({HIGH:0,MEDIUM:1,LOW:2}[a.severity]-{HIGH:0,MEDIUM:1,LOW:2}[b.severity])),implementationStatus:{officialVerification:'REVIEW_REQUIRED',marketValuation:'SOURCE_DEPENDENT',fiscalCertification:'UNAVAILABLE',desktopBuild:'NOT_VERIFIED_HERE'},disclaimer:'Autodiagnóstico local, não auditoria independente, recomendação de investimento ou certificação tributária.'};
}
export function fiscalByYear(db,year,{taxDossier,realizedLedger}={}){
 const y=Number(year);if(!yearOK(y))throw Error('Exercício fiscal inválido.');
 const dossier=taxDossier(db,y),ledger=realizedLedger(db.transactions||[],db.profiles||[],{year:String(y)});
 const months=Array.from({length:12},(_,i)=>{
  const key=`${y}-${String(i+1).padStart(2,'0')}`;const sales=(ledger.sales||[]).filter(s=>s.month===key);
  const unsafe=sales.some(s=>s.possibleDayTrade||!s.classificationComplete);
  return {month:key,salesCount:sales.length,grossSalesBRL:amount(sales.reduce((a,s)=>a+s.gross,0)),netRealizedBRL:amount(sales.reduce((a,s)=>a+s.gain,0)),needsSpecialClassification:unsafe,stock:amount(sales.filter(s=>s.isStock).reduce((a,s)=>a+s.gain,0)),fii:amount(sales.filter(s=>s.isFii).reduce((a,s)=>a+s.gain,0)),irrfBRL:null,previousLossesBRL:null,taxDueBRL:null,darfBRL:null};
 });
 const reviews=(db.taxReviews||[]).filter(x=>x.year===y).sort((a,b)=>a.reviewedAt.localeCompare(b.reviewedAt));
 const blockers=[...dossier.blockers];if(months.some(x=>x.needsSpecialClassification))blockers.push('Operações de classificação incompleta ou possíveis day trades.');if(!reviews.length)blockers.push('Parecer/revisão especializada deste exercício não anexado.');
 return {year:y,baseYear:y,reportingYear:y+1,months,ledgerTotals:ledger.totals,documentGaps:dossier.incomeDiscrepancies,holdingsAtYearEnd:dossier.positions,foreignAssets:dossier.foreignAssets,fixedIncomeAssets:dossier.otherAssets,sourceStatementsAtYearEnd:dossier.statementDate,reviews,blockers:[...new Set(blockers)],taxPayable:null,darfAmount:null,readyForFiling:false,professionalReviewRequired:true,attestationIsNotCertification:true,officialReferences:['https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/manual','https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos/rendimentos-do-capital'],warning:'Pré-apuração documental por ano-calendário. Não calcula imposto, gera DARF nem certifica declaração. Revisão registrada não substitui verificação de habilitação/assinatura externa.'};
}

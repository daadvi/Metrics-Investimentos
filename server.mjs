// Metrics 2.4: additions scoped to the selected wallet. The 1.4 baseline remains intact.
import {inspectOfficialIPE,consolidatedWealth,consolidatedEvolution,fiscalByYear,validateExternalFlow,validateValuation,validateProfessionalReview} from './src/metrics-v24.mjs';
import {calculatePositions as positionsMetrics24} from './src/domain.mjs';
import {fixedIncomePosition as fixedPositionMetrics24} from './src/instrument-classes.mjs';
import {change as changeMetrics24} from './src/store.mjs';
import {auditQuality25} from './src/metrics-v24.mjs';
import {analyzePortfolio26,compareProfiles26} from './src/metrics-v26.mjs';
import {storageCacheStatus26} from './src/store.mjs';
import {createHistoryPager27} from './src/history-pager-v27.mjs';
import {computePerformance27,validateFlowCoverage27} from './src/performance-v27.mjs';
import {previewImport27,reconcileImport27} from './src/import-reconcile-v27.mjs';
import {storageStatus27,migrateStorage27,change as changeStorage27} from './src/store.mjs';
const metricsPager27=createHistoryPager27();
import {previewStatement28,reconcileStatement28,validateStatementReview28} from './src/statement-reconciliation-v28.mjs';
import {performanceEvidence28,validatePortfolioValuation28} from './src/return-evidence-v28.mjs';
import {historyPage28,change as changeStore28} from './src/store.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {encryptBackup,decryptBackup} from './src/backup.mjs';
import {simulatePortfolio} from './src/portfolio-sim.mjs';
import {analyzeFundRisk} from './src/risk.mjs';
import {realizedLedger} from './src/tax.mjs';
import {financialFacts,projectedEvents,fiscalReadiness} from './src/insights.mjs';
import {readPdf,parseB3CustodyText,parseB3NegotiationText} from './src/pdf.mjs';
import {createXlsx} from './src/export-xlsx.mjs';
import {parseCotahist,parseCotahistSeries,fetchRecentB3Prices} from './src/market.mjs';
import {init,read,saveFeedQuotes,saveHistoricalQuotes,saveBenchmarkCDI,saveIndexBenchmark,addTransaction,editTransaction,deleteTransaction,undoTransactionAction,addTransactionsBulk,rollbackImport,addWatch,editWatch,saveQuote,saveProfile,addEvent,addDocument,removeItem,saveMessages,clearMessages,restoreBackup,location,isEncrypted,saveMarketQuotes,saveCustodySnapshot,saveResearch,importProviderEvents,saveGoal,withPortfolio,listPortfolios,createPortfolio,renamePortfolio,selectPortfolio,deleteEmptyPortfolio,installExtension,listExtensions,grantExtension,uninstallExtension,extensionDashboard} from './src/store.mjs';
import {upsertInstrument,deleteInstrument,addForeignTrade,editForeignTrade,undoForeignTradeAction,removeForeignTrade,editFixedIncome,createFixedIncome,redeemFixedIncome,removeFixedIncome,upsertFxQuotes,addTaxEvidence,addNotice,removeExtended,classReport,saveCvmMonthly,saveCvmQuarterly,saveProviderDividends} from './src/store.mjs';
import {fetchPtax,convertToBRL} from './src/fx.mjs';
import {foreignPositions} from './src/foreign-ledger.mjs';
import {taxDossier} from './src/tax-dossier.mjs';
import {parseCvmMonthly,downloadCvmMonthly,cvmPreview} from './src/cvm-fii.mjs';
import {parseCvmQuarterly,downloadCvmQuarterly,quarterlyOverview} from './src/cvm-quarterly.mjs';
import {fetchBrapiDividends,parseBrapiDividends} from './src/brapi-dividends.mjs';
import {taxWorkpaper} from './src/tax-audit-v13.mjs';
import {sourceHealth} from './src/data-health-v13.mjs';
import {providerCatalog,queryProvider} from './src/provider-hub.mjs';
import {parseIpeIndex,downloadIpeIndex,ipeSummary} from './src/cvm-ipe.mjs';
import {parseCvmDfp,dfpOverview} from './src/cvm-dfp.mjs';
import {storeProviderQuotes,saveProviderDividendObservations,saveIpeIndex,saveCvmStatements} from './src/store.mjs';
import {fiscalEvidenceAudit,aiInstructionsV14} from './src/fiscal-evidence-v14.mjs';
import {reconcileIncome,dataCoverage} from './src/dividend-reconciliation.mjs';
import {portfolioTotals,portfolioAnalytics,simulate,simulatePhases} from './src/domain.mjs';
import {parseCSV,parseXLSX,interpretTables} from './src/importers.mjs';
import {askAI} from './src/ai.mjs';
import {fetchBrapiQuotes} from './src/market-feed.mjs';
import {historyReport,benchmarkBetween,indexBetween,monthlyIndexBetween,parseIndexCSV,parseDailyBenchmarkCSV} from './src/portfolio-history.mjs';
import {fetchBCBCDI,fetchBCBIPCA} from './src/benchmark.mjs';
import {portfolioXirr,auditPortfolio} from './src/analytics-v1.mjs';
import {fetchBrapiDataset,normalizeProviderData} from './src/market-intelligence.mjs';
import {localAlerts,screener,incomeGoal} from './src/radar-v1.mjs';
const HOME=path.dirname(fileURLToPath(import.meta.url)),WWW=path.join(HOME,'web');
const PORT=Number(process.env.PORT||4173),HOST='127.0.0.1',ORIGIN=`http://${HOST}:${PORT}`;
const ACCESS_TOKEN=randomBytes(32).toString('hex');
const COOKIE='metrics_session';
function authorized(req){const match=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));if(!match)return false;const supplied=match.slice(COOKIE.length+1);if(supplied.length!==ACCESS_TOKEN.length)return false;return timingSafeEqual(Buffer.from(supplied),Buffer.from(ACCESS_TOKEN));}
function authGate(req,res,url){const attempt=url.searchParams.get('access');if(url.pathname==='/'&&req.method==='GET'&&attempt){if(attempt.length===ACCESS_TOKEN.length&&timingSafeEqual(Buffer.from(attempt),Buffer.from(ACCESS_TOKEN))){res.writeHead(303,{'Set-Cookie':`${COOKIE}=${ACCESS_TOKEN}; HttpOnly; SameSite=Strict; Path=/`,Location:'/', 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'});res.end();return true;}reply(res,403,{error:'Código de acesso inválido.'});return true;}if(url.pathname.startsWith('/api/')&&!authorized(req)){reply(res,401,{error:'Sessão local não autorizada. Abra o Metrics pelo iniciador.'});return true;}return false;}
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json'};
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});res.end(JSON.stringify(data));}
function bad(res,error){const msg=error instanceof Error?error.message:String(error);return reply(res,400,{error:msg.slice(0,600)});}
async function body(req,max=8*1024*1024){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new Error('Envie JSON.');let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw new Error('Arquivo ou mensagem muito grande.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new Error('JSON inválido.');}}
function docsList(db){return db.documents.map(({text,...d})=>({...d,chars:text.length}));}
async function handler(req,res){const url=new URL(req.url,ORIGIN);
 if(req.headers.host&&!['127.0.0.1:'+PORT,'localhost:'+PORT].includes(req.headers.host))return reply(res,403,{error:'Host não autorizado.'});
 if(req.headers.origin && ![ORIGIN,`http://localhost:${PORT}`].includes(req.headers.origin))return reply(res,403,{error:'Origem não autorizada.'});
 if(authGate(req,res,url))return;
 if(url.pathname.startsWith('/api/'))return withPortfolio(req.headers['x-metrics-portfolio-id'],async()=>{
 try{
  if(['POST','PUT','DELETE'].includes(req.method)&&req.headers['x-metrics-local']!=='1')return reply(res,403,{error:'Cabeçalho de acesso local obrigatório.'});
  // Metrics 2.4: provenance checking only; NEVER create a cash receipt from a disclosure.
  if(req.method==='GET'&&url.pathname==='/api/v24/official-checks'){
   const db=await read();return reply(res,200,{checks:db.officialChecks||[],warning:'Origem de arquivo consultada, não certificação de provento.'});
  }
  if(req.method==='POST'&&url.pathname==='/api/v24/official-check'){
   const request=await body(req,8*1024);const source=await read();
   const found=await inspectOfficialIPE(source,{...request,fetchImpl:fetch,extractPdf:readPdf});
   const stored=await changeMetrics24(db=>{
    if(!(db.ipeIndex||[]).some(x=>x.documentId===found.documentId&&x.ticker===found.ticker&&x.sourceUrl===found.sourceUrl))throw Error('Documento IPE deixou de fazer parte desta carteira.');
    const current=(db.officialChecks||[]).find(x=>x.documentId===found.documentId&&x.sha256===found.sha256&&x.ticker===found.ticker);
    if(current)return current;
    const record={...found,id:randomBytes(16).toString('hex')};db.officialChecks.push(record);
    if(db.officialChecks.length>300)db.officialChecks=db.officialChecks.slice(-300);
    return record;
   });return reply(res,200,{check:stored});
  }
  if(req.method==='POST'&&url.pathname==='/api/v24/official-review'){
   const input=await body(req,12*1024);const status=String(input.status||'');const note=String(input.note||'').trim();
   if(!['CONFIRMED_BY_USER','DISMISSED'].includes(status)||note.length<12||note.length>900)throw Error('Revisão exige decisão e justificativa de 12 a 900 caracteres.');
   const check=await changeMetrics24(db=>{const entry=(db.officialChecks||[]).find(x=>x.id===input.id);if(!entry)throw Error('Documento não encontrado nesta carteira.');if(entry.reviewStatus!=='PENDING')throw Error('Documento já revisado; gere nova inspeção para outra versão.');entry.reviewStatus=status;entry.reviewNote=note;entry.reviewedAt=new Date().toISOString();return entry;});
   return reply(res,200,{check,warning:'Confirmação manual não prova autorização, titularidade nem recebimento; nenhum provento foi creditado.'});
  }
  const wealthHelpersV24={calculatePositions:positionsMetrics24,foreignPositions,fixedIncomePosition:fixedPositionMetrics24};
  if(req.method==='GET'&&url.pathname==='/api/v24/patrimony'){
   return reply(res,200,consolidatedWealth(await read(),{asOf:url.searchParams.get('date')||new Date().toISOString().slice(0,10),...wealthHelpersV24}));
  }
  if(req.method==='GET'&&url.pathname==='/api/v24/evolution'){
   const count=Number(url.searchParams.get('months')||12);return reply(res,200,consolidatedEvolution(await read(),{asOf:url.searchParams.get('date')||new Date().toISOString().slice(0,10),months:count,...wealthHelpersV24}));
  }
  if(req.method==='POST'&&url.pathname==='/api/v24/external-flow'){
   const input=validateExternalFlow(await body(req,12*1024));const created=await changeMetrics24(db=>{const r={...input,id:randomBytes(16).toString('hex'),createdAt:new Date().toISOString()};db.externalFlows.push(r);return r;});return reply(res,201,{created});
  }
  if(req.method==='POST'&&url.pathname==='/api/v24/valuation'){
   const input=validateValuation(await body(req,12*1024));const created=await changeMetrics24(db=>{const r={...input,id:randomBytes(16).toString('hex'),createdAt:new Date().toISOString()};db.assetValuations.push(r);return r;});return reply(res,201,{created});
  }
  if(req.method==='DELETE'&&/^\/api\/v24\/(external-flow|valuation)\/[a-f0-9]{32}$/.test(url.pathname)){
   const parts=url.pathname.split('/'),which=parts[3]==='external-flow'?'externalFlows':'assetValuations',id=parts[4];
   const result=await changeMetrics24(db=>{const old=db[which].length;db[which]=db[which].filter(x=>x.id!==id);if(db[which].length===old)throw Error('Registro não encontrado.');return {removed:id};});return reply(res,200,result);
  }
  if(req.method==='GET'&&url.pathname==='/api/v24/tax-case'){
   return reply(res,200,fiscalByYear(await read(),url.searchParams.get('year')||new Date().getFullYear(),{taxDossier,realizedLedger}));
  }
  if(req.method==='POST'&&url.pathname==='/api/v24/tax-review'){
   const input=validateProfessionalReview(await body(req,16*1024));
   const review=await changeMetrics24(db=>{const r={...input,id:randomBytes(16).toString('hex'),reviewedAt:new Date().toISOString()};db.taxReviews.push(r);return r;});
   return reply(res,201,{review,warning:'Registro de revisão declarada pelo usuário. O software não autentica qualificação do profissional ou validade do parecer.'});
  }
  if(req.method==='GET'&&url.pathname==='/api/v25/audit'){const d=await read();return reply(res,200,auditQuality25(d,{calculatePositions:positionsMetrics24,foreignPositions,fixedIncomePosition:fixedPositionMetrics24}));}
  // Metrics 2.6: one wallet-scoped data read per analysis, never external telemetry.
  if(req.method==='GET'&&url.pathname==='/api/v26/analytics'){
   const date=url.searchParams.get('date')||new Date().toISOString().slice(0,10);
   const year=url.searchParams.get('year')||Number(date.slice(0,4));
   return reply(res,200,analyzePortfolio26(await read(),{asOf:date,year,calculatePositions:positionsMetrics24,foreignPositions,fixedIncomePosition:fixedPositionMetrics24}));
  }
  if(req.method==='GET'&&url.pathname==='/api/v26/compare'){
   const tickers=String(url.searchParams.get('tickers')||'').split(',').filter(Boolean);
   return reply(res,200,compareProfiles26(await read(),{tickers}));
  }
  if(req.method==='GET'&&url.pathname==='/api/v26/system'){
   const nodeVersion=process.versions.node,parts=nodeVersion.split('.').map(Number);
   const nodeCompatible=parts[0]>22||(parts[0]===22&&parts[1]>=13);
   return reply(res,200,{version:'2.8.0-preview.1',platform:process.platform,nodeVersion,nodeCompatible,storageCache:storageCacheStatus26(),desktopRuntime:process.env.ELECTRON_RUN_AS_NODE==='1',warning:'A verificação não confirma backups, compilação Windows, extratos ou certificados fiscais. As etapas do guia exigem confirmação manual.'});
  }
  // Metrics v2.7: controlled pagination and read-only import reconciliation.
  if(req.method==='GET'&&url.pathname==='/api/v27/history')return reply(res,200,metricsPager27.page(await read(),{kind:url.searchParams.get('kind')||'transactions',limit:Number(url.searchParams.get('limit')||40),cursor:url.searchParams.get('cursor')||null,portfolioId:String(req.headers['x-metrics-portfolio-id']||'active'),from:url.searchParams.get('from')||'',to:url.searchParams.get('to')||'',ticker:url.searchParams.get('ticker')||''}));
  if(req.method==='GET'&&url.pathname==='/api/v27/storage')return reply(res,200,{...storageStatus27(),warning:'Migração exige backup verificado. O aplicativo não migra automaticamente.'});
  if(req.method==='POST'&&url.pathname==='/api/v27/storage/migrate'){const p=await body(req);return reply(res,200,await migrateStorage27(p.confirmation));}
  if(req.method==='GET'&&url.pathname==='/api/v27/performance')return reply(res,200,computePerformance27(await read(),{asOf:url.searchParams.get('date')||new Date().toISOString().slice(0,10),months:Number(url.searchParams.get('months')||12),calculatePositions:positionsMetrics24,foreignPositions,fixedIncomePosition:fixedPositionMetrics24}));
  if(req.method==='POST'&&url.pathname==='/api/v27/flows/confirm'){
   const coverage=validateFlowCoverage27(await body(req));const outcome=await changeStorage27(db=>{db.flowReconciliations||=[];if(db.flowReconciliations.length>=200)throw Error('Limite de revisões de fluxos alcançado.');db.flowReconciliations.push(coverage);return coverage;});return reply(res,201,{coverage:outcome,note:'Cobertura declarada pelo usuário; não auditada pelo Metrics.'});
  }
  if(req.method==='POST'&&url.pathname==='/api/v27/import/preview')return reply(res,200,previewImport27(await body(req,2_200_000)));
  if(req.method==='POST'&&url.pathname==='/api/v27/import/reconcile'){const p=await body(req,1_000_000);return reply(res,200,reconcileImport27(await read(),p.candidates));}
  // Metrics v2.8: SQL keyset history, light dashboard and auditable evidence-bound returns.
  if(req.method==='GET'&&url.pathname==='/api/v28/history')return reply(res,200,historyPage28({kind:url.searchParams.get('kind')||'transactions',limit:Number(url.searchParams.get('limit')||40),cursor:url.searchParams.get('cursor')||null,from:url.searchParams.get('from')||'',to:url.searchParams.get('to')||'',ticker:url.searchParams.get('ticker')||''}));
  if(req.method==='GET'&&url.pathname==='/api/v28/dashboard'){
   const d=await read(),recent=[...(d.transactions||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
   const events=(d.events||[]).filter(e=>e.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
   const last=[...(d.snapshots||[])].sort((a,b)=>b.asOf.localeCompare(a.asOf))[0];
   return reply(res,200,{transactions:recent,summary:portfolioTotals(d.transactions),analytics:portfolioAnalytics(d.transactions,d.quotes),watchlist:d.watchlist||[],events,snapshots:last?[last]:[],encrypted:isEncrypted(),dataLocation:location(),settings:d.settings||{},latestOnly:true,warning:'A primeira tela transfere apenas os lançamentos recentes. As demais telas carregam dados completos sob demanda.'});
  }
  if(req.method==='POST'&&url.pathname==='/api/v28/statement/preview'){
   const p=await body(req,2_200_000),preview=previewStatement28(p),reconciliation=reconcileStatement28(preview,await read(),{from:p.from||null,to:p.to||null});
   return reply(res,200,{preview:{acceptedCount:preview.acceptedCount,rejectedCount:preview.rejectedCount,documentHash:preview.documentHash,rejected:preview.rejected.slice(0,20)},reconciliation});
  }
  if(req.method==='POST'&&url.pathname==='/api/v28/statement/confirm'){
   const p=await body(req,2_200_000),preview=previewStatement28(p),reconciliation=reconcileStatement28(preview,await read(),{from:p.from||null,to:p.to||null}),review=validateStatementReview28({...p,reconciliation});
   await changeStore28(db=>{db.statementReviewsV28||=[];if(db.statementReviewsV28.some(x=>x.documentHash===review.documentHash&&x.from===review.from&&x.to===review.to))throw Error('Revisão já registrada.');if(db.statementReviewsV28.length>=300)throw Error('Limite de documentos alcançado.');db.statementReviewsV28.push(review);});
   return reply(res,201,{review,warning:'Conciliação matemática declarada pelo investidor; não autentica o arquivo bancário.'});
  }
  if(req.method==='POST'&&url.pathname==='/api/v28/valuation'){
   const p=validatePortfolioValuation28(await body(req));
   await changeStore28(db=>{db.portfolioValuationsV28||=[];if(db.portfolioValuationsV28.some(x=>x.date===p.date&&x.phase===p.phase))throw Error('Avaliação já cadastrada nessa data e fase.');if(db.portfolioValuationsV28.length>=15000)throw Error('Limite de avaliações atingido.');db.portfolioValuationsV28.push(p);});
   return reply(res,201,{valuation:p});
  }
  if(req.method==='GET'&&url.pathname==='/api/v28/returns')return reply(res,200,performanceEvidence28(await read(),{start:url.searchParams.get('start'),end:url.searchParams.get('end')}));
  if(req.method==='GET'&&url.pathname==='/api/state'){const db=await read();return reply(res,200,{transactions:db.transactions,instruments:db.instruments||[],fixedIncome:db.fixedIncome||[],foreignTrades:db.foreignTrades||[],foreignAudit:(db.foreignAudit||[]).slice(-15).map(({before,after,...rest})=>({...rest,ticker:(after||before)?.ticker})),foreignPositions:foreignPositions(db.foreignTrades),fxRates:db.fxRates||[],taxEvidence:db.taxEvidence||[],foreignMarketQuotes:db.foreignMarketQuotes||[],providerDividendFeed:(db.providerDividendFeed||[]).slice(-200),ipeIndex:(db.ipeIndex||[]).slice(0,150),cvmStatementsCount:(db.cvmStatements||[]).length,externalFlows:db.externalFlows||[],assetValuations:db.assetValuations||[],officialChecks:db.officialChecks||[],taxReviews:db.taxReviews||[],notices:db.notices||[],transactionAudit:(db.transactionAudit||[]).slice(-30).map(({before,after,...item})=>({...item,ticker:(after||before)?.ticker,type:(after||before)?.type})),watchlist:db.watchlist,messages:db.messages,quotes:db.quotes,profiles:db.profiles,events:db.events,snapshots:db.snapshots||[],documents:docsList(db),imports:db.imports,cvmReports:(db.cvmReports||[]).length,quoteHistoryStats:{observations:(db.quoteHistory||[]).length,firstDate:db.quoteHistory?.length?[...db.quoteHistory].sort((a,b)=>a.date.localeCompare(b.date))[0].date:null,lastDate:db.quoteHistory?.length?[...db.quoteHistory].sort((a,b)=>b.date.localeCompare(a.date))[0].date:null},benchmarkDays:(db.benchmarkCDI||[]).length,settings:db.settings,summary:portfolioTotals(db.transactions),analytics:portfolioAnalytics(db.transactions,db.quotes),dataLocation:location(),encrypted:isEncrypted()});}
  // Portfolio boundaries: each request is scoped through AsyncLocalStorage, never a process-wide mutable variable.
  // Multi-asset registry, fixed-income contracts, PTAX and tax evidence: no inferred market prices.
  // BYOK adapters never persist access keys; returns ONLY normalized financial observations.
  if(req.method==='GET'&&url.pathname==='/api/providers/catalog')return reply(res,200,{providers:providerCatalog(),keyPolicy:'Chaves usadas apenas na consulta, não gravadas no SQLite ou enviadas para outros provedores.'});
  if(req.method==='GET'&&url.pathname==='/api/providers/observations'){const d=await read();return reply(res,200,{foreignPrices:d.foreignMarketQuotes||[],dividends:d.providerDividendFeed||[],ipeCount:(d.ipeIndex||[]).length});}
  if(req.method==='POST'&&url.pathname==='/api/providers/quotes/update'){
   const p=await body(req),r=await queryProvider({provider:p.provider,ticker:p.ticker,key:p.key,kind:'quote'});
   const saved=await storeProviderQuotes(r.quotes);return reply(res,200,{...saved,quotes:r.quotes,warning:r.warning,provider:r.provider});
  }
  if(req.method==='POST'&&url.pathname==='/api/providers/dividends/update'){
   const p=await body(req),r=await queryProvider({provider:p.provider,ticker:p.ticker,key:p.key,kind:'dividends',cvmCode:p.cvmCode});
   const saved=await saveProviderDividendObservations(r.observations);
   return reply(res,200,{...saved,observations:r.observations.slice(0,100),warning:r.warning,provider:r.provider});
  }
  if(req.method==='GET'&&url.pathname==='/api/official/ipe')return reply(res,200,ipeSummary(await read(),{ticker:url.searchParams.get('ticker')||null}));
  if(req.method==='POST'&&url.pathname==='/api/official/ipe/preview'){
   const p=await body(req,24*1024*1024),bytes=Buffer.from(String(p.data||''),'base64');
   return reply(res,200,parseIpeIndex(bytes,{tickerMap:p.tickerMap||{},cnpjs:p.cnpjs||[],includeAll:!!p.includeAll}));
  }
  if(req.method==='POST'&&url.pathname==='/api/official/ipe/import'){
   const p=await body(req,24*1024*1024),bytes=Buffer.from(String(p.data||''),'base64');
   const parsed=parseIpeIndex(bytes,{tickerMap:p.tickerMap||{},cnpjs:p.cnpjs||[],includeAll:!!p.includeAll});
   const saved=await saveIpeIndex(parsed.entries,{origin:'ZIP/CSV enviado pelo usuário'});
   return reply(res,200,{...saved,scanned:parsed.scanned,warning:parsed.warning});
  }
  if(req.method==='POST'&&url.pathname==='/api/official/ipe/download'){
   const p=await body(req),download=await downloadIpeIndex(p.year);
   const parsed=parseIpeIndex(download.bytes,{tickerMap:p.tickerMap||{},cnpjs:p.cnpjs||[],includeAll:!!p.includeAll});
   const saved=await saveIpeIndex(parsed.entries,{origin:download.url});
   return reply(res,200,{...saved,downloadUrl:download.url,warning:parsed.warning});
  }
  if(req.method==='GET'&&url.pathname==='/api/official/dfp')return reply(res,200,dfpOverview(await read(),{ticker:url.searchParams.get('ticker')||null}));
  if(req.method==='POST'&&url.pathname==='/api/official/dfp/preview'){
   const p=await body(req,24*1024*1024);return reply(res,200,parseCvmDfp(Buffer.from(String(p.data||''),'base64'),{tickerMap:p.tickerMap||{}}));
  }
  if(req.method==='POST'&&url.pathname==='/api/official/dfp/import'){
   const p=await body(req,24*1024*1024),parsed=parseCvmDfp(Buffer.from(String(p.data||''),'base64'),{tickerMap:p.tickerMap||{}});
   return reply(res,200,{...await saveCvmStatements(parsed.entries),scanned:parsed.scanned,warning:parsed.warning});
  }
  if(req.method==='GET'&&url.pathname==='/api/tax/evidence-v14')return reply(res,200,fiscalEvidenceAudit(await read(),url.searchParams.get('year')||new Date().getFullYear()));
  if(req.method==='GET'&&url.pathname==='/api/ai/instructions-v14')return reply(res,200,{instructions:aiInstructionsV14(),warning:'Instruções e ferramentas não fazem fine-tuning nem treinam automaticamente modelo externo; dados só são enviados com consentimento.'});
  if(req.method==='GET'&&url.pathname==='/api/official/cvm')return reply(res,200,cvmPreview(await read()));
  if(req.method==='GET'&&url.pathname==='/api/official/cvm-quarterly')return reply(res,200,quarterlyOverview(await read()));
  if(req.method==='GET'&&url.pathname==='/api/official/provider-dividends')return reply(res,200,{observations:(await read()).providerDividends||[],warning:'Proventos de fornecedor, não anúncios oficiais auditados.'});
  if(req.method==='GET'&&url.pathname==='/api/data/health-v13')return reply(res,200,sourceHealth(await read()));
  if(req.method==='GET'&&url.pathname==='/api/tax/workpaper')return reply(res,200,taxWorkpaper(await read(),url.searchParams.get('year')||new Date().getFullYear()));
  if(req.method==='GET'&&url.pathname==='/api/data/coverage')return reply(res,200,dataCoverage(await read()));
  if(req.method==='GET'&&url.pathname==='/api/income/reconcile')return reply(res,200,reconcileIncome(await read(),{from:url.searchParams.get('from')||'2000-01-01',to:url.searchParams.get('to')||'2200-12-31'}));
  if(req.method==='POST'&&url.pathname==='/api/official/cvm/preview'){
   const p=await body(req,24*1024*1024),bytes=Buffer.from(String(p.data||''),'base64');
   if(bytes.length>15*1024*1024)throw Error('Arquivo CVM supera 15 MB.');
   const result=parseCvmMonthly(bytes,{tickerMap:p.tickerMap||{}});
   return reply(res,200,{...result,downloadedFrom:null});
  }
  if(req.method==='POST'&&url.pathname==='/api/official/cvm/import'){
   const p=await body(req,24*1024*1024),bytes=Buffer.from(String(p.data||''),'base64');
   if(bytes.length>15*1024*1024)throw Error('Arquivo CVM supera 15 MB.');
   const parsed=parseCvmMonthly(bytes,{tickerMap:p.tickerMap||{}});
   if(!parsed.entries.length)throw Error('Nenhum registro de CNPJ vinculado foi encontrado no arquivo.');
   return reply(res,200,{...await saveCvmMonthly(parsed.entries),recognizedFiles:parsed.recognizedFiles,warning:parsed.warning});
  }
  if(req.method==='POST'&&url.pathname==='/api/official/cvm/download'){
   const p=await body(req),download=await downloadCvmMonthly(p.year),parsed=parseCvmMonthly(download.bytes,{tickerMap:p.tickerMap||{}});
   if(!parsed.entries.length)throw Error('Arquivo CVM consultado, mas nenhum CNPJ cadastrado corresponde aos registros.');
   return reply(res,200,{...await saveCvmMonthly(parsed.entries,{downloadUrl:download.url}),url:download.url,downloadedAt:download.downloadedAt,warning:parsed.warning});
  }
  if(req.method==='POST'&&url.pathname==='/api/official/cvm-quarterly/preview'){
   const p=await body(req,24*1024*1024),bytes=Buffer.from(String(p.data||''),'base64');
   if(bytes.length>15*1024*1024)throw Error('Arquivo CVM excede 15 MB.');
   return reply(res,200,parseCvmQuarterly(bytes,{tickerMap:p.tickerMap||{}}));
  }
  if(req.method==='POST'&&url.pathname==='/api/official/cvm-quarterly/import'){
   const p=await body(req,24*1024*1024),bytes=Buffer.from(String(p.data||''),'base64');
   const result=parseCvmQuarterly(bytes,{tickerMap:p.tickerMap||{}});
   if(!result.entries.length)throw Error('Nenhum indicador trimestral reconhecido para este CNPJ; consulte o dicionário CVM.');
   return reply(res,200,{...await saveCvmQuarterly(result.entries),scanned:result.scanned,warning:result.warning});
  }
  if(req.method==='POST'&&url.pathname==='/api/official/cvm-quarterly/download'){
   const p=await body(req),download=await downloadCvmQuarterly(p.year),result=parseCvmQuarterly(download.bytes,{tickerMap:p.tickerMap||{}});
   if(!result.entries.length)throw Error('Nenhuma coluna trimestral conhecida para esse fundo; arquivo não foi alterado.');
   return reply(res,200,{...await saveCvmQuarterly(result.entries,{downloadUrl:download.url}),url:download.url,downloadedAt:download.downloadedAt,warning:result.warning});
  }
  if(req.method==='POST'&&url.pathname==='/api/dividends/brapi-preview'){
   const p=await body(req),db=await read(),ticker=String(p.ticker||'').toUpperCase();
   const listed=new Set([...db.transactions.map(x=>x.ticker),...db.watchlist.map(x=>x.ticker)]);
   if(!listed.has(ticker))throw Error('Ticker precisa estar na carteira ou na lista de desejos.');
   return reply(res,200,await fetchBrapiDividends({tickers:[ticker],kind:p.kind||'FII',key:p.key||''}));
  }
  if(req.method==='POST'&&url.pathname==='/api/dividends/brapi-save'){
   const p=await body(req),db=await read(),allowed=new Set([...db.transactions.map(x=>x.ticker),...db.watchlist.map(x=>x.ticker)]);
   const parsed=parseBrapiDividends({dividends:p.dividends||[]},{kind:p.kind||'FII'});
   if(parsed.observations.some(x=>!allowed.has(x.ticker)))throw Error('Ativo desconhecido; adicione à carteira ou à lista de desejos.');
   if(!parsed.observations.length)throw Error('Nenhum provento reconhecido para salvar.');
   return reply(res,200,await saveProviderDividends(parsed.observations));
  }
  if(req.method==='GET'&&url.pathname==='/api/asset-classes')return reply(res,200,classReport(await read(),{asOf:url.searchParams.get('date')||undefined}));
  if(req.method==='POST'&&url.pathname==='/api/instruments')return reply(res,201,{instrument:await upsertInstrument(await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/instruments/'))return reply(res,200,await deleteInstrument(decodeURIComponent(url.pathname.split('/').at(-1))));
  if(req.method==='POST'&&url.pathname==='/api/foreign/undo')return reply(res,200,await undoForeignTradeAction((await body(req)).auditId));
  if(req.method==='PUT'&&/^\/api\/foreign\/trades\/[a-f0-9-]{36}$/.test(url.pathname))return reply(res,200,{trade:await editForeignTrade(url.pathname.split('/').at(-1),await body(req))});
  if(req.method==='PUT'&&/^\/api\/fixed-income\/[a-f0-9-]{36}$/.test(url.pathname))return reply(res,200,{contract:await editFixedIncome(url.pathname.split('/').at(-1),await body(req))});
  if(req.method==='POST'&&url.pathname==='/api/foreign/trades')return reply(res,201,{trade:await addForeignTrade(await body(req))});
  if(req.method==='DELETE'&&/^\/api\/foreign\/trades\/[a-f0-9-]{36}$/.test(url.pathname))return reply(res,200,await removeForeignTrade(url.pathname.split('/').at(-1)));
  if(req.method==='POST'&&url.pathname==='/api/fixed-income')return reply(res,201,{contract:await createFixedIncome(await body(req))});
  if(req.method==='POST'&&/^\/api\/fixed-income\/[a-f0-9-]{36}\/redeem$/.test(url.pathname))return reply(res,200,{contract:await redeemFixedIncome(url.pathname.split('/')[3],await body(req))});
  if(req.method==='DELETE'&&/^\/api\/fixed-income\/[a-f0-9-]{36}$/.test(url.pathname))return reply(res,200,await removeFixedIncome(url.pathname.split('/').at(-1)));
  if(req.method==='POST'&&url.pathname==='/api/fx/manual')return reply(res,200,await upsertFxQuotes([(await body(req))]));
  if(req.method==='POST'&&url.pathname==='/api/fx/ptax'){
   const p=await body(req),result=await fetchPtax({currency:p.currency,from:p.from,to:p.to});
   return reply(res,200,{...await upsertFxQuotes(result.quotes),currency:result.currency,source:result.source,url:result.url,warning:result.warning});
  }
  if(req.method==='GET'&&url.pathname==='/api/fx/convert'){
   const db=await read();return reply(res,200,convertToBRL(url.searchParams.get('amount'),url.searchParams.get('currency'),url.searchParams.get('date'),db.fxRates));
  }
  if(req.method==='GET'&&url.pathname==='/api/tax/dossier')return reply(res,200,taxDossier(await read(),url.searchParams.get('year')||new Date().getFullYear()));
  if(req.method==='POST'&&url.pathname==='/api/tax/evidence')return reply(res,201,{evidence:await addTaxEvidence(await body(req))});
  if(req.method==='DELETE'&&/^\/api\/tax\/evidence\/[a-f0-9-]{36}$/.test(url.pathname))return reply(res,200,await removeExtended('taxEvidence',url.pathname.split('/').at(-1)));
  if(req.method==='POST'&&url.pathname==='/api/notices')return reply(res,201,{notice:await addNotice(await body(req))});
  if(req.method==='DELETE'&&/^\/api\/notices\/[a-f0-9-]{36}$/.test(url.pathname))return reply(res,200,await removeExtended('notices',url.pathname.split('/').at(-1)));
  if(req.method==='GET'&&url.pathname==='/api/portfolios')return reply(res,200,await listPortfolios());
  if(req.method==='POST'&&url.pathname==='/api/portfolios')return reply(res,201,{portfolio:await createPortfolio((await body(req)).name)});
  if(req.method==='POST'&&url.pathname==='/api/portfolios/select')return reply(res,200,await selectPortfolio((await body(req)).id));
  if(req.method==='PUT'&&/^\/api\/portfolios\/[a-f0-9-]{36}$/.test(url.pathname))return reply(res,200,{portfolio:await renamePortfolio(url.pathname.split('/').at(-1),(await body(req)).name)});
  if(req.method==='DELETE'&&/^\/api\/portfolios\/[a-f0-9-]{36}$/.test(url.pathname))return reply(res,200,await deleteEmptyPortfolio(url.pathname.split('/').at(-1)));
  // Declarative community extensions: no executable code, network requests or unsandboxed host access.
  if(req.method==='GET'&&url.pathname==='/api/extensions')return reply(res,200,{extensions:await listExtensions()});
  if(req.method==='POST'&&url.pathname==='/api/extensions/import')return reply(res,201,{extension:await installExtension((await body(req,128*1024)).manifest)});
  if(req.method==='POST'&&/^\/api\/extensions\/[a-z0-9.-]+\/permissions$/.test(url.pathname))return reply(res,200,{permission:await grantExtension(url.pathname.split('/')[3],await body(req))});
  if(req.method==='GET'&&/^\/api\/extensions\/[a-z0-9.-]+\/dashboard$/.test(url.pathname))return reply(res,200,await extensionDashboard(url.pathname.split('/')[3]));
  if(req.method==='DELETE'&&/^\/api\/extensions\/[a-z0-9.-]+$/.test(url.pathname))return reply(res,200,await uninstallExtension(url.pathname.split('/')[3]));
  if(req.method==='GET'&&url.pathname==='/api/health')return reply(res,200,{ok:true,version:'2.8.0-preview.1',db:'sqlite',encrypted:isEncrypted()});

  if(req.method==='GET'&&url.pathname==='/api/performance'){
   const db=await read(),h=historyReport(db);
   const first=h.range?.from,last=h.range?.to;
   return reply(res,200,{...h,benchmark:first&&last?benchmarkBetween(db.benchmarkCDI||[],first,last):null,extraComparators:first&&last?{IBOVESPA:indexBetween(db.benchmarkIndex?.IBOVESPA||[],first,last),IFIX:indexBetween(db.benchmarkIndex?.IFIX||[],first,last),IPCA:monthlyIndexBetween(db.benchmarkIndex?.IPCA||[],first,last)}:{},benchmarkCoverage:(db.benchmarkCDI||[]).length,disclaimer:'Comparador somente no período documentado. Aportes não são rentabilidade; não deduzir performance a partir da posição atual isoladamente.'});
  }
  if(req.method==='GET'&&url.pathname==='/api/insights')return reply(res,200,financialFacts(await read()));
  if(req.method==='GET'&&url.pathname==='/api/future-income')return reply(res,200,{events:projectedEvents(await read())});
  if(req.method==='GET'&&url.pathname==='/api/fiscal-readiness')return reply(res,200,fiscalReadiness(await read(),url.searchParams.get('year')||new Date().getFullYear()));
  if(req.method==='GET'&&url.pathname==='/api/export')return reply(res,200,await read());
  if(req.method==='GET'&&url.pathname==='/api/tax/ledger'){
   const d=await read(),year=url.searchParams.get('year')||'';
   return reply(res,200,fiscalReadiness(d,year||new Date().getFullYear()));
  }
  if(req.method==='GET'&&url.pathname==='/api/report/xlsx'){
   const d=await read(),year=url.searchParams.get('year')||new Date().getFullYear().toString();
   const ledger=fiscalReadiness(d,year);
   const rows=[['Ticker','Quantidade','Custo','Preço médio','Dividendos','Resultado realizado'],...portfolioTotals(d.transactions).positions.map(p=>[p.ticker,p.quantity,p.cost,p.average,p.dividends,p.realized])];
   const sells=[['Data','Ticker','Classe','Venda bruta','Taxas','Custo atribuído','Resultado','Possível day trade'],...ledger.sales.map(x=>[x.date,x.ticker,x.kind,x.gross,x.fees,x.allocatedCost,x.gain,x.possibleDayTrade?'SIM':'NÃO'])];
   const income=[['Data','Ticker','Tipo informado','Valor'],...ledger.income.map(x=>[x.date,x.ticker,x.kind,x.amount])];
   const issues=[['Avisos e limitações'],...ledger.issues.map(x=>[x]),['CHECKLIST DOCUMENTAL'],...ledger.documentChecklist.map(x=>[x])];
   const yearEnd=[['Posições em 31/12 (calculadas exclusivamente dos lançamentos)','Quantidade','Custo apurado','Preço médio'],...ledger.yearEndPositions.map(p=>[p.ticker,p.quantity,p.cost,p.average])];
   const amortizations=[['Data','Ticker','Amortização de capital (revisão fiscal obrigatória)'],...d.transactions.filter(t=>t.type==='AMORTIZATION'&&t.date.startsWith(year)).map(t=>[t.date,t.ticker,t.amount])];
   const fixed=classReport(d).fixedIncome.positions;
   const assetsExtended=[['Origem','Ticker','Moeda','Quantidade ou principal restante','Custo ou principal original','Valor calculado NÃO mercadológico','Pendência'],...fixed.map(x=>['Renda fixa',x.ticker,x.currency,x.remainingPrincipal,x.principal,x.estimatedContractGross,x.warning]),...foreignPositions(d.foreignTrades||[]).map(x=>['Exterior',x.ticker,x.currency,x.quantity,x.cost,'Não calculado','Não converter moeda nem inferir imposto sem extrato, câmbio e custo em BRL'])];
   const dossier=taxDossier(d,year);
   const proofs=[['Ticker','Natureza','Registrado','Informe declarado','Situação','Aviso'],...dossier.incomeDiscrepancies.map(x=>[x.ticker,x.nature,x.registered??'Ausente',x.informedByEvidence??'Ausente',x.status,'Conferência aritmética não certifica tratamento tributário'])];
   const audit=fiscalEvidenceAudit(d,year);
   const auditRows=[['Campo fiscal','Estado','Evidência exigida'],...audit.perField.map(x=>[x.field,x.status,x.evidence]),['PENDÊNCIAS'],...audit.issues.map(x=>[x])];
   const ipeRows=[['CNPJ','Ticker','Data entrega','Categoria','Documento','URL CVM','Valor de dividendo verificado?'],...(d.ipeIndex||[]).slice(0,4000).map(x=>[x.cnpj,x.ticker,x.deliveryDate,x.category,x.title,x.sourceUrl,x.issuerAnnouncementVerified?'Sim':'Não'])];
   const providerRows=[['Ticker','Moeda','Preço datado','Data','Fonte','Não é tempo real'],...(d.foreignMarketQuotes||[]).map(x=>[x.ticker,x.currency,x.price,x.date,x.source,'Sim'])];
   const providerDividends=[['Ticker','Moeda','Valor por cota','Data-com','Pagamento','Origem','Confirmado oficialmente?'],...(d.providerDividendFeed||[]).map(x=>[x.ticker,x.currency||'BRL',x.rate,x.recordDate,x.paymentDate,x.source,'Não'])];
   const file=createXlsx([{name:'Posições',rows},{name:'Vendas '+year,rows:sells},{name:'Proventos '+year,rows:income},{name:'Posições 31-12 '+year,rows:yearEnd},{name:'Amortizações '+year,rows:amortizations},{name:'Avisos',rows:issues},{name:'Outras classes',rows:assetsExtended},{name:'Informes '+year,rows:proofs},{name:'Auditoria IR '+year,rows:auditRows},{name:'IPE CVM',rows:ipeRows},{name:'Preços USD',rows:providerRows},{name:'Proventos terceiros',rows:providerDividends}]);
   return reply(res,200,{filename:'metrics-relatorio-'+year+'.xlsx',base64:file.toString('base64'),warnings:ledger.issues});
  }
  if(req.method==='GET'&&url.pathname==='/api/quality'){
   const d=await read();return reply(res,200,{portfolio:auditPortfolio(d),xirr:portfolioXirr(d),fiscalWarnings:fiscalReadiness(d,new Date().getFullYear()).issues,limitations:['Dados não são cotação instantânea; a conta B3 e o Imposto de Renda exigem conciliação.']});
  }
  if(req.method==='GET'&&url.pathname==='/api/radar'){
   const d=await read(),sort=url.searchParams.get('sort')||'DY';return reply(res,200,{alerts:localAlerts(d),screener:screener(d,{sort}),goal:incomeGoal(d,{monthlyTarget:d.settings?.monthlyIncomeGoal})});
  }
  if(req.method==='GET'&&url.pathname==='/api/research')return reply(res,200,{rows:(await read()).providerResearch||[]});
  if(req.method==='GET'&&url.pathname==='/api/risk')return reply(res,200,(await read()).profiles.map(analyzeFundRisk));
  if(req.method==='GET'&&url.pathname==='/api/ollama/models'){const c=new AbortController(),timer=setTimeout(()=>c.abort(),3500);try{const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:c.signal});if(!r.ok)throw Error();const d=await r.json();return reply(res,200,{available:true,models:(d.models||[]).map(x=>x.name)});}catch{return reply(res,200,{available:false,models:[]});}finally{clearTimeout(timer);}}
  if(req.method==='GET'&&url.pathname.startsWith('/api/documents/')){const db=await read();const doc=db.documents.find(d=>d.id===url.pathname.split('/').at(-1));return doc?reply(res,200,doc):reply(res,404,{error:'Documento não encontrado.'});}
  if(!['POST','DELETE','PUT'].includes(req.method))return reply(res,405,{error:'Método não permitido.'});
  if(req.headers['x-metrics-local']!=='1')return reply(res,403,{error:'Cabeçalho de acesso local obrigatório.'});

  if(req.method==='POST'&&url.pathname==='/api/market/provider-refresh'){
   const p=await body(req),db=await read();
   const available=[...new Set([...db.transactions.map(x=>x.ticker),...db.watchlist.map(x=>x.ticker)])];
   const tickers=Array.isArray(p.tickers)?p.tickers:available;
   if(!tickers.length)throw Error('Registre ativos ou selecione os tickers para atualizar.');
   if(tickers.some(x=>!available.includes(String(x).toUpperCase())))throw Error('Atualização restrita aos ativos de carteira e desejos.');
   const result=await fetchBrapiQuotes({tickers,key:p.key||''});
   return reply(res,200,{...await saveFeedQuotes(result.quotes),failures:result.failures,warning:result.warning,updatedAt:new Date().toISOString()});
  }
  if(req.method==='POST'&&url.pathname==='/api/market/history-import'){
   const p=await body(req,34*1024*1024),db=await read(),wanted=[...new Set([...db.transactions.map(x=>x.ticker),...db.watchlist.map(x=>x.ticker)])];
   const buffer=Buffer.from(String(p.data||''),'base64');const data=parseCotahistSeries(buffer,{wanted});
   return reply(res,200,{...await saveHistoricalQuotes(data.history,{source:'Arquivo B3 COTAHIST informado pelo usuário'}),quotes:data.quotes.length,warning:data.warning});
  }
  if(req.method==='POST'&&url.pathname==='/api/benchmark/cdi-update'){
   const p=await body(req),dates=(await read()).transactions.map(x=>x.date).sort();const year=new Date().getUTCFullYear();
   const from=p.from||dates[0]||`${year}-01-01`,to=p.to||new Date().toISOString().slice(0,10);
   const result=await fetchBCBCDI({from,to});return reply(res,200,{...await saveBenchmarkCDI(result.data,{source:result.source}),url:result.url});
  }
  if(req.method==='POST'&&url.pathname==='/api/benchmark/index-import'){
   const p=await body(req,4*1024*1024),kind=String(p.kind||'');
   if(!['IBOVESPA','IFIX'].includes(kind))throw Error('Escolha IBOVESPA ou IFIX para importar valores diários.');
   const rows=parseIndexCSV(p.csv||'');return reply(res,200,await saveIndexBenchmark(kind,rows,{source:'Arquivo de índice fornecido pelo usuário: '+String(p.name||'')}));
  }
  if(req.method==='POST'&&url.pathname==='/api/benchmark/ipca-update'){
   const p=await body(req),dates=(await read()).transactions.map(x=>x.date).sort(),year=new Date().getUTCFullYear();
   const from=p.from||dates[0]||`${year}-01-01`,to=p.to||new Date().toISOString().slice(0,10);
   const result=await fetchBCBIPCA({from,to});return reply(res,200,{...await saveIndexBenchmark('IPCA',result.data,{source:result.source}),url:result.url});
  }
  if(req.method==='POST'&&url.pathname==='/api/benchmark/cdi-import'){
   const p=await body(req,4*1024*1024),rows=parseDailyBenchmarkCSV(p.csv||'');
   return reply(res,200,await saveBenchmarkCDI(rows,{source:'CSV CDI importado pelo usuário'}));
  }
  if(req.method==='POST'&&url.pathname==='/api/research/preview'){
   const p=await body(req),result=await fetchBrapiDataset({kind:p.kind,ticker:p.ticker,key:p.key});
   return reply(res,200,result);
  }
  if(req.method==='POST'&&url.pathname==='/api/research/save'){
   const p=await body(req);if(!['FII_INDICATORS','STOCK_STATISTICS'].includes(p.kind))throw Error('Pesquisa inadequada para salvar fundamentos.');
   return reply(res,200,{entry:await saveResearch({...p,source:'brapi.dev (registro confirmado pelo usuário; dados não oficiais)'})});
  }
  if(req.method==='POST'&&url.pathname==='/api/dividends/provider-import'){
   const p=await body(req);return reply(res,200,await importProviderEvents(p.events));
  }
  if(req.method==='POST'&&url.pathname==='/api/goals'){
   const p=await body(req);return reply(res,200,{goal:await saveGoal(p)});
  }
  if(req.method==='POST'&&url.pathname==='/api/snapshots'){
   const p=await body(req);return reply(res,201,{snapshot:await saveCustodySnapshot(p)});
  }
  if(req.method==='POST'&&url.pathname==='/api/transactions')return reply(res,201,{transaction:await addTransaction(await body(req))});
  if(req.method==='POST'&&url.pathname==='/api/transactions/import'){const p=await body(req);return reply(res,200,await addTransactionsBulk(p.transactions,p.name,p.keepDuplicates===true));}
  if(req.method==='POST'&&url.pathname==='/api/transactions/undo')return reply(res,200,await undoTransactionAction((await body(req)).auditId));
  if(req.method==='PUT'&&/^\/api\/transactions\/[a-f0-9-]{36}$/.test(url.pathname))return reply(res,200,{transaction:await editTransaction(url.pathname.split('/').at(-1),await body(req))});
  if(req.method==='DELETE'&&/^\/api\/transactions\/[a-f0-9-]{36}$/.test(url.pathname))return reply(res,200,await deleteTransaction(url.pathname.split('/').at(-1)));
  if(req.method==='POST'&&url.pathname==='/api/watchlist')return reply(res,201,{item:await addWatch(await body(req))});
  if(req.method==='PUT'&&url.pathname.startsWith('/api/watchlist/'))return reply(res,200,{item:await editWatch(url.pathname.split('/').at(-1),await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/snapshots/')){await removeItem('snapshots',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/watchlist/')){await removeItem('watchlist',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/market/preview'){
   const p=await body(req,34*1024*1024),bytes=Buffer.from(String(p.data||''),'base64');
   const name=String(p.name||'');if(!/\.(zip|txt)$/i.test(name))throw Error('Envie COTAHIST em ZIP ou TXT.');
   const db=await read(),wanted=[...new Set(db.transactions.map(x=>x.ticker).concat(db.watchlist.map(x=>x.ticker)))];
   if(!wanted.length)throw Error('Cadastre ao menos um investimento ou ativo desejado antes de importar cotações.');
   const result=parseCotahistSeries(bytes,{wanted});
   return reply(res,200,{quotes:result.quotes,records:result.records,historyCount:result.history.length,warning:result.warning});
  }
  if(req.method==='POST'&&url.pathname==='/api/market/import'){
   const p=await body(req),db=await read(),wanted=[...new Set(db.transactions.map(x=>x.ticker).concat(db.watchlist.map(x=>x.ticker)))];
   if(!wanted.length)throw Error('Cadastre ao menos um investimento ou ativo desejado antes de importar cotações.');
   const result=parseCotahistSeries(Buffer.from(String(p.data||''),'base64'),{wanted});
   const updated=await saveMarketQuotes(result.quotes,{source:String(p.name||'Arquivo B3')});
   const historical=await saveHistoricalQuotes(result.history,{source:'B3 COTAHIST'});
   return reply(res,200,{...updated,historical,warning:result.warning});
  }
  if(req.method==='POST'&&url.pathname==='/api/market/update'){
   const db=await read(),wanted=[...new Set([...db.transactions.map(t=>t.ticker),...db.watchlist.map(w=>w.ticker)])];
   const result=await fetchRecentB3Prices({wanted});
   return reply(res,200,{...await saveMarketQuotes(result.quotes,{source:result.downloadedFrom}),warning:result.warning,downloadedFrom:result.downloadedFrom});
  }
  if(req.method==='POST'&&url.pathname==='/api/quotes')return reply(res,200,{quote:await saveQuote(await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/quotes/')){await removeItem('quotes',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/profiles')return reply(res,200,{profile:await saveProfile(await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/profiles/')){await removeItem('profiles',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/events')return reply(res,201,{event:await addEvent(await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/events/')){await removeItem('events',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/simulate')return reply(res,200,simulatePhases(await body(req)));
  if(req.method==='POST'&&url.pathname==='/api/simulate/portfolio')return reply(res,200,simulatePortfolio(await body(req)));
  if(req.method==='POST'&&url.pathname==='/api/backup/encrypted')return reply(res,200,encryptBackup(await read(),(await body(req)).password));
  if(req.method==='POST'&&url.pathname==='/api/backup/restore-encrypted'){const p=await body(req,16*1024*1024);return reply(res,200,await restoreBackup(decryptBackup(p.backup,p.password)));}
  if(req.method==='POST'&&url.pathname==='/api/simulate/legacy')return reply(res,200,simulate(await body(req)));
  if(req.method==='POST'&&url.pathname==='/api/import/preview'){
   const p=await body(req,20*1024*1024),bytes=Buffer.from(String(p.data||''),'base64');if(bytes.length>12*1024*1024)throw new Error('Máximo de 12 MB.');
   const name=String(p.name||''),ext=path.extname(name).toLowerCase();let result;
   if(ext==='.xlsx')result=interpretTables(parseXLSX(bytes));
   else if(ext==='.csv'||ext==='.tsv')result=interpretTables([{sheet:'CSV',rows:parseCSV(bytes.toString('utf8'))}]);
   else if(ext==='.pdf'){
    const {text,pages,reader}=await readPdf(bytes);const trades=parseB3NegotiationText(text);const parsed=trades.kind==='transactions'?trades:parseB3CustodyText(text);
    return reply(res,200,{...parsed,title:name,text,preview:text.slice(0,2000),chars:text.length,pages,reader,source:'PDF fornecido pelo usuário; conferir com notas de corretagem e fonte oficial'});
   }
   else if(ext==='.txt'){const text=bytes.toString('utf8');return reply(res,200,{kind:'document',title:name,text,preview:text.slice(0,1500),chars:text.length});}
   else throw new Error('Aceitos: XLSX, CSV, TSV, PDF ou TXT.');
   return reply(res,200,{kind:'transactions',...result});
  }
  if(req.method==='POST'&&url.pathname==='/api/documents')return reply(res,201,{document:await addDocument(await body(req))});
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/documents/')){await removeItem('documents',url.pathname.split('/').at(-1));return reply(res,200,{ok:true});}
  if(req.method==='POST'&&url.pathname==='/api/imports/rollback'){const p=await body(req);return reply(res,200,await rollbackImport(p.id));}
  if(req.method==='POST'&&url.pathname==='/api/restore')return reply(res,200,await restoreBackup(await body(req)));
  if(req.method==='POST'&&url.pathname==='/api/chat'){
   const params=await body(req);const db=await read();const answer=await askAI(params,db);
   const hist=(params.messages||[]).filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string');await saveMessages([...hist,{role:'assistant',content:answer}]);return reply(res,200,{answer});
  }
  if(req.method==='POST'&&url.pathname==='/api/chat/clear'){await clearMessages();return reply(res,200,{ok:true});}
  return reply(res,404,{error:'API não encontrada.'});
 }catch(e){return bad(res,e);}});
 if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'Método não permitido.'});
 const route=url.pathname==='/'?'/index.html':url.pathname;if(route.includes('..')||route.includes('\\')||route.includes('\0'))return reply(res,404,{error:'Arquivo não encontrado.'});const abs=path.resolve(WWW,'.'+route);if(!abs.startsWith(WWW+path.sep))return reply(res,404,{error:'Arquivo não encontrado.'});
 try{const stat=await fs.stat(abs);if(!stat.isFile())throw Error();const b=await fs.readFile(abs);res.writeHead(200,{'Content-Type':TYPES[path.extname(abs)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});if(req.method==='HEAD')res.end();else res.end(b);}catch{return reply(res,404,{error:'Arquivo não encontrado.'});}
}
await init();http.createServer((req,res)=>{handler(req,res).catch(e=>{if(!res.headersSent)bad(res,e);})}).listen(PORT,HOST,()=>{console.log(`Metrics Investimentos 2.8.0-preview.1 | dados: ${location()} | criptografia: ${isEncrypted()?'ativada':'não ativada'}`);console.log(`METRICS_LAUNCH_URL=${ORIGIN}/?access=${ACCESS_TOKEN}`);});

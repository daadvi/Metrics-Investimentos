import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBrapiDividends,fetchBrapiDividends} from '../src/brapi-dividends.mjs';
import {parseCvmQuarterly,downloadCvmQuarterly,quarterlyOverview} from '../src/cvm-quarterly.mjs';
import {sourceHealth} from '../src/data-health-v13.mjs';
import {taxWorkpaper} from '../src/tax-audit-v13.mjs';
import {callReadOnlyTool,readOnlyTools} from '../src/ai-tools.mjs';
const cnpj='12345678000195';
const csv='CNPJ_Fundo;Data_Referencia;Quantidade_Imoveis;Taxa_Vacancia;Area_Bruta_Locavel\n12.345.678/0001-95;2026-06-30;17;5,25;45000,5\n12.345.678/0001-95;2026-09-30;18;;46000,0\n';
function emptyDB(){return {transactions:[],profiles:[],snapshots:[],cvmReports:[],cvmQuarterly:[],providerDividends:[],taxEvidence:[],events:[],documents:[],quotes:[],quoteHistory:[],benchmarkCDI:[],watchlist:[],settings:{},instruments:[],fixedIncome:[],foreignTrades:[],fxRates:[],notices:[]};}
test('brapi v2: dividendos com datas reais do fornecedor são registros terceirizados, não oficiais',()=>{
 const p={dividends:[{symbol:'MXRF11',label:'RENDIMENTO',rate:0.1,lastDatePrior:'2026-09-30 00:00:00+00',paymentDate:'2026-10-15 00:00:00+00',remarks:'Documented declaration'}]};
 const o=parseBrapiDividends(p,{tickers:['MXRF11']});assert.equal(o.observations[0].rate,.1);assert.equal(o.observations[0].eligibleForCalendar,true);assert.match(o.observations[0].source,/terceiro/);assert.equal(o.observations[0].recordDate,'2026-09-30');
});
test('brapi v2: backfilled mensal nunca gera anúncio confirmado automaticamente',()=>{
 const o=parseBrapiDividends({dividends:[{symbol:'MXRF11',label:'RENDIMENTO',rate:0.089,lastDatePrior:'2026-08-01',paymentDate:'2026-08-01',remarks:'backfilled from FiiMonthlyReports'}]},{tickers:['MXRF11']});
 assert.equal(o.observations[0].syntheticDates,true);assert.equal(o.observations[0].eligibleForCalendar,false);assert.equal(o.observations[0].status,'DATAS_A_CONFERIR');
});
test('brapi v2: amortização não passa por dividendo',()=>{
 const o=parseBrapiDividends({dividends:[{symbol:'MXRF11',label:'AMORTIZAÇÃO',rate:1.2,lastDatePrior:'2026-02-01',paymentDate:'2026-02-10'}]},{tickers:['MXRF11']});assert.equal(o.observations[0].nature,'AMORTIZATION');
});
test('brapi v2: sem plano não consulta tickers não sandbox; chave não vai na URL',async()=>{
 await assert.rejects(fetchBrapiDividends({tickers:['GGRC11']}),/chave e plano/);
 let called;await fetchBrapiDividends({tickers:['MXRF11'],key:'token_123456789',fetchImpl:async(url,opts)=>{called={url,opts};return {ok:true,text:async()=>JSON.stringify({dividends:[]})};}});
 assert.equal(called.url.includes('token_'),false);assert.equal(called.opts.headers.Authorization,'Bearer token_123456789');
});
test('CVM trimestral: extrai somente colunas declaradas e preserva vazios',()=>{
 const p=parseCvmQuarterly(Buffer.from(csv),{tickerMap:{[cnpj]:'GGRC11'}});assert.equal(p.entries.length,2);
 assert.equal(p.entries[0].indicators.totalProperties,17);assert.equal(p.entries[0].indicators.vacancyPercent,5.25);assert.equal(p.entries[0].indicators.occupancyPercent,null);assert.equal(p.entries[1].indicators.vacancyPercent,null);
 assert.equal(quarterlyOverview({cvmQuarterly:p.entries}).entries,2);
});
test('CVM trimestral: não cria métricas a partir de cabeçalhos desconhecidos',()=>{
 const p=parseCvmQuarterly(Buffer.from('CNPJ_Fundo;Data_Referencia;Número não verificado\n12.345.678/0001-95;2026-06-30;500\n'),{tickerMap:{[cnpj]:'GGRC11'}});assert.equal(p.entries.length,0);
 assert.deepEqual(p.unmappedFiles,['dados.csv']);
 assert.throws(()=>parseCvmQuarterly(Buffer.from(csv),{tickerMap:{'12345678000199':'GGRC11'}}),/CNPJ/);
});
test('CVM trimestral: download monta URL fixa, recusa data inválida',async()=>{
 let used;const r=await downloadCvmQuarterly(2026,{fetchImpl:async url=>{used=url;return {ok:true,body:(async function*(){yield Buffer.from(csv)})()};}});
 assert.equal(used,'https://dados.cvm.gov.br/dados/FII/DOC/INF_TRIMESTRAL/DADOS/inf_trimestral_fii_2026.zip');assert.equal(r.bytes.toString(),csv);await assert.rejects(()=>downloadCvmQuarterly(1900),/Ano/);
});
test('auditoria de dados: detecta início histórico ausente e proventos sintéticos',()=>{
 const d=emptyDB();d.transactions=[{date:'2026-01-05',ticker:'GGRC11',type:'BUY',quantity:3,price:10}];d.quoteHistory=[{date:'2026-08-01',ticker:'GGRC11',price:9}];d.providerDividends=[{syntheticDates:true}];
 const x=sourceHealth(d,{asOf:'2026-10-24'});assert.equal(x.missingHistoricalPriceIssues[0].type,'HISTORICO_INCOMPLETO');assert.equal(x.sourceRecords.syntheticDividendDates,1);assert.equal(x.qualityLabels.officialDividendAnnouncementsVerifiedAutomatically,0);
});
test('fiscal mensal: não calcula DARF nem isenção definitiva sem histórico completo',()=>{
 const d=emptyDB();d.transactions=[{date:'2026-01-01',ticker:'VALE3',type:'BUY',quantity:100,price:20,fee:0},{date:'2026-03-03',ticker:'VALE3',type:'SELL',quantity:10,price:22,fee:1}];d.profiles=[{ticker:'VALE3',type:'ACAO'}];
 const report=taxWorkpaper(d,2026);assert.equal(report.months.length,1);assert.equal(report.months[0].grossSales,220);assert.equal(report.canCertify,false);assert.equal(report.canGenerateDarf,false);assert.ok(report.alerts[0].cautions.some(s=>s.includes('isenção')));
});
test('IA possui ferramentas de consulta trimestral e auditoria sem escrita',()=>{
 const d=emptyDB(),p=parseCvmQuarterly(Buffer.from(csv),{tickerMap:{[cnpj]:'GGRC11'}});d.cvmQuarterly=p.entries;
 assert.ok(readOnlyTools.some(x=>x.function.name==='metrics_consultar_informes_trimestrais'));assert.equal(callReadOnlyTool('metrics_consultar_informes_trimestrais',{ticker:'GGRC11'},d).entries,2);assert.equal(callReadOnlyTool('metrics_auditar_fontes',{},d).qualityLabels.realTimeLicensedQuoteFeeds,0);
});
test('busca local: ranqueamento mantém trechos documentais e identifica ticker correto',async()=>{
 const {searchDocuments,citedExcerpts}=await import('../src/document-search-v1.mjs');
 const docs=[{id:'d1',ticker:'MXRF11',source:'Relatório informado',title:'MXRF11 Crédito',text:'A carteira tem CRIs indexados ao CDI; resultado recorrente depende do crédito, risco de inadimplência e garantia.'},{id:'d2',ticker:'GGRC11',source:'Outro',title:'GGRC11 galpões',text:'Imóveis logísticos, aluguel, vacância e prazos dos contratos atípicos.'}];
 const hits=searchDocuments(docs,'Quais riscos de crédito CDI em MXRF11?');assert.equal(hits[0].id,'d1');assert.match(citedExcerpts(hits),/fonte DECLARADA/);assert.equal(searchDocuments(docs,'bitcoin no deserto').length,0);
});

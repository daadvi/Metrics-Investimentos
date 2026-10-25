import test from 'node:test';
import assert from 'node:assert/strict';
import {providerCatalog,parseProviderQuotes,parseDadosDividends,queryProvider} from '../src/provider-hub.mjs';
import {parseIpeIndex,downloadIpeIndex} from '../src/cvm-ipe.mjs';
import {fiscalEvidenceAudit,aiInstructionsV14} from '../src/fiscal-evidence-v14.mjs';
import {readOnlyTools,callReadOnlyTool} from '../src/ai-tools.mjs';
const CNPJ='12345678000195';
const payload=(data)=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(data)});
const fx=(json,matcher)=>async (url,opts)=>{matcher?.(new URL(url),opts);return payload(json);};
test('hub distingue API pública de oferta gratuita e retorna instruções em URLs oficiais',()=>{
 const list=providerCatalog();assert.equal(list.length,7);assert.equal(list.find(x=>x.id==='b3').quotes,false);
 assert.equal(list.find(x=>x.id==='hgbrasil').quotes,true);assert.ok(list.every(x=>x.docsUrl.startsWith('https://')));
 assert.ok(list.every(x=>x.credentialsStored===false));
});
test('Alpha Vantage usa dia de negociação fornecido, nunca data atual',()=>{
 const q=parseProviderQuotes('alphavantage',{'Global Quote':{'01. symbol':'AAPL','05. price':'210.1150','07. latest trading day':'2026-10-23'}},{ticker:'AAPL'})[0];
 assert.equal(q.price,210.115);assert.equal(q.currency,'USD');assert.equal(q.date,'2026-10-23');assert.equal(q.isRealtime,false);
 assert.throws(()=>parseProviderQuotes('alphavantage',{'Global Quote':{'01. symbol':'AAPL','05. price':'210.1'}},{ticker:'AAPL'}),/data/);
 assert.throws(()=>parseProviderQuotes('alphavantage',{'Global Quote':{'01. symbol':'TSLA','05. price':'210.1','07. latest trading day':'2026-10-23'}},{ticker:'AAPL'}),/coincide/);
});
test('HG Brasil lê cotação aninhada e mantém data/hora do provedor',()=>{
 const result=parseProviderQuotes('hgbrasil',{results:[{ticker:'B3:PETR4',symbol:'PETR4',quote:{value:48.5,updated_at:'2026-09-18T20:47:55-03:00'}}]},{ticker:'PETR4'})[0];
 assert.equal(result.currency,'BRL');assert.equal(result.date,'2026-09-18');assert.match(result.quoteTime,/Z$/);
});
test('Massive e Dados de Mercado são fechamento diário datado, com moedas separadas',()=>{
 const us=parseProviderQuotes('massive',{ticker:'AAPL',results:[{c:235.8,t:Date.UTC(2026,9,22)}]},{ticker:'AAPL'})[0];
 assert.equal(us.currency,'USD');assert.equal(us.isRealtime,false);
 const br=parseProviderQuotes('dadosdemercado',[{date:'2026-10-21',close:10.22},{date:'2026-10-23',close:10.55}],{ticker:'GGRC11'})[0];
 assert.equal(br.price,10.55);assert.equal(br.date,'2026-10-23');assert.equal(br.currency,'BRL');
});
test('consulta Alpha Vantage envia chave somente ao host oficial e não ao resultado',async()=>{
 const secret='KEY_12345678';const res=await queryProvider({provider:'alphavantage',ticker:'AAPL',key:secret,fetchImpl:fx({'Global Quote':{'01. symbol':'AAPL','05. price':'205','07. latest trading day':'2026-10-23'}},(url,opts)=>{assert.equal(url.hostname,'www.alphavantage.co');assert.equal(url.searchParams.get('apikey'),secret);assert.equal(opts.redirect,'error');})});
 assert.equal(res.quotes.length,1);assert.ok(!JSON.stringify(res).includes(secret));
});
test('consultar APIs exige provedor conhecido, chave e endpoint fixo',async()=>{
 await assert.rejects(queryProvider({provider:'https://localhost/',ticker:'AAPL',key:'123456789'}),/Provedor/);
 await assert.rejects(queryProvider({provider:'massive',ticker:'../x',key:'123456789'}),/Ticker/);
 await assert.rejects(queryProvider({provider:'hgbrasil',ticker:'PETR4',key:''}),/chave/);
 await assert.rejects(queryProvider({provider:'hgbrasil',ticker:'PETR4',key:'bad key'}),/chave/);
 await assert.rejects(queryProvider({provider:'massive',ticker:'AAPL',key:'123456789',fetchImpl:async()=>({ok:false,status:429})}),/Limite/);
});
test('Dados de Mercado: endpoint de dividendos exige código CVM para ação e não promove anúncio oficial',async()=>{
 await assert.rejects(queryProvider({provider:'dadosdemercado',kind:'dividends',ticker:'ITUB4',key:'123456789'}),/código CVM/);
 const r=await queryProvider({provider:'dadosdemercado',kind:'dividends',ticker:'ITUB4',key:'123456789',cvmCode:'19348',fetchImpl:fx([{ticker:'ITUB4',amount:0.25,record_date:'2026-10-20',payable_date:'2026-11-20',type:'JCP'}],(url,opts)=>{assert.equal(url.pathname,'/v1/companies/19348/dividends');assert.equal(opts.headers.Authorization,'Bearer 123456789');})});
 assert.equal(r.observations[0].nature,'JCP');assert.equal(r.observations[0].officiallyVerified,false);
 assert.equal(r.observations[0].recordDate,'2026-10-20');
 const fii=await queryProvider({provider:'dadosdemercado',kind:'dividends',ticker:'KNCA11',key:'123456789',fetchImpl:fx([{amount:0.12,record_date:'2026-10-15',payable_date:'2026-10-30',type:'RENDIMENTO'}],url=>assert.equal(url.pathname,'/v1/reits/KNCA11/dividends'))});
 assert.equal(fii.observations.length,1);
});
test('cotações de fornecedores rejeitam números sem data e dividendos inválidos',()=>{
 assert.throws(()=>parseProviderQuotes('dadosdemercado',[{close:50}],{ticker:'PETR4'}),/fechamento/);
 assert.equal(parseDadosDividends([{ticker:'PETR4',amount:-1}],{ticker:'PETR4'}).observations.length,0);
});
test('CVM IPE classifica índice sem inventar valores, e exige filtro por CNPJ',()=>{
 const csv='CNPJ_Companhia;Data_Entrega;Categoria;Assunto;Protocolo_Entrega;Link_Download\n12.345.678/0001-95;2026-10-01;Aviso aos Acionistas;Anuncio de dividendos;123;https://www.rad.cvm.gov.br/arquivo.pdf\n12.345.678/0001-95;2026-10-02;Fato Relevante;Aquisição;124;https://evil.example/phish\n12.345.678/0001-95;2026-10-03;Registro;Routine;125;\n';
 const r=parseIpeIndex(Buffer.from(csv),{tickerMap:{[CNPJ]:'PETR4'}});
 assert.equal(r.entries.length,2);assert.equal(r.entries[0].title,'Aquisição');assert.equal(r.entries[0].sourceUrl,null);
 assert.equal(r.entries[1].sourceUrl,'https://www.rad.cvm.gov.br/arquivo.pdf');
 assert.equal(r.entries[1].canConfirmDividend,false);
 assert.equal(r.entries[0].status,'INDICE_SEM_CONTEUDO');
 assert.throws(()=>parseIpeIndex(Buffer.from(csv)),/CNPJ/);
});
test('CVM IPE só baixa de URL fixa anual e rejeita ano inválido',async()=>{
 await assert.rejects(downloadIpeIndex(1800),/Ano/);
 const body=Buffer.from('CNPJ_Companhia;Data_Entrega;Categoria\n');
 const r=await downloadIpeIndex(2026,{fetchImpl:async (url)=>{assert.equal(url,'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_2026.zip');return {ok:true,body:(async function*(){yield body;})()};}});
 assert.equal(r.bytes.toString(),body.toString());
});
test('dossiê fiscal não inventa imposto ou informa declaração certificada',()=>{
 const db={transactions:[],profiles:[],snapshots:[],taxEvidence:[],fixedIncome:[],foreignTrades:[],fxRates:[]};
 const r=fiscalEvidenceAudit(db,2026);assert.equal(r.certified,false);assert.equal(r.taxDue,null);assert.equal(r.darf,null);assert.ok(r.issues.length);
 assert.match(aiInstructionsV14(),/fine-tuning/);
});
test('IA encontra ferramentas v14 e retorna evidências em vez de notícias inexistentes',()=>{
 const tools=readOnlyTools.map(x=>x.function.name);
 assert.ok(tools.includes('metrics_consultar_ipe_v14'));
 assert.ok(tools.includes('metrics_verificar_imposto_v14'));
 const d={ipeIndex:[{cnpj:CNPJ,ticker:'PETR4',title:'Aviso',deliveryDate:'2026-10-01'}],transactions:[],profiles:[],quotes:[],watchlist:[],providerDividendFeed:[],foreignMarketQuotes:[],taxEvidence:[],snapshots:[],fixedIncome:[],foreignTrades:[],fxRates:[]};
 const r=callReadOnlyTool('metrics_consultar_ipe_v14',{ticker:'PETR4'},d);assert.equal(r.entries.length,1);
 const tax=callReadOnlyTool('metrics_verificar_imposto_v14',{year:2026},d);assert.equal(tax.taxDue,null);
});
test('Massive oferece histórico de dividendos USD usando endpoint documentado, sem confirmar anúncio',async()=>{
 const data={results:[{ticker:'AAPL',cash_amount:0.25,record_date:'2026-10-15',pay_date:'2026-10-25',ex_dividend_date:'2026-10-14'}]};
 const r=await queryProvider({provider:'massive',kind:'dividends',ticker:'AAPL',key:'Massive-Token_2026',fetchImpl:fx(data,(u,opts)=>{assert.equal(u.pathname,'/stocks/v1/dividends');assert.equal(u.searchParams.get('ticker'),'AAPL');assert.equal(opts.headers.Authorization,'Bearer Massive-Token_2026');})});
 assert.equal(r.observations.length,1);assert.equal(r.observations[0].currency,'USD');assert.equal(r.observations[0].officiallyVerified,false);
});
test('HG Brasil separa amortizações e JCP, e não inventa datas de pagamento',async()=>{
 const data={results:[{symbol:'PETR4',ticker:'B3:PETR4',series:[{type:'interest_on_equity',category:'cash',unadjusted_amount:0.2,com_date:'2026-10-10',payment_date:'2026-10-20'},{type:'amortization',category:'cash',amount:0.3,com_date:'2026-10-11',payment_date:null},{type:'bonus_issue',category:'stock',amount:1,com_date:'2026-10-12'}]}]};
 const r=await queryProvider({provider:'hgbrasil',ticker:'PETR4',kind:'dividends',key:'HgbrasilKey2026',fetchImpl:fx(data,u=>assert.equal(u.pathname,'/v2/finance/dividends'))});
 assert.equal(r.observations.length,2);assert.equal(r.observations[0].nature,'JCP');assert.equal(r.observations[1].nature,'AMORTIZATION');assert.equal(r.observations[1].paymentDate,null);
});
test('Alpha Vantage aceita dividendos declarados, mas não confunde fornecimento com crédito',async()=>{
 const r=await queryProvider({provider:'alphavantage',ticker:'IBM',kind:'dividends',key:'Alpha-Token_2026',fetchImpl:fx({symbol:'IBM',data:[{amount:'1.50',record_date:'2026-10-11',payment_date:'2026-11-08',ex_dividend_date:'2026-10-10'}]},u=>assert.equal(u.searchParams.get('function'),'DIVIDENDS'))});
 assert.equal(r.observations[0].currency,'USD');assert.equal(r.observations[0].rate,1.5);assert.equal(r.observations[0].status,'DADOS_TERCEIROS_NAO_VERIFICADOS');
});

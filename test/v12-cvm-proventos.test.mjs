import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {parseCvmMonthly,downloadCvmMonthly,cvmPreview,validCnpj} from '../src/cvm-fii.mjs';
import {reconcileIncome,dataCoverage} from '../src/dividend-reconciliation.mjs';
import {sharesEligible} from '../src/insights.mjs';
import {callReadOnlyTool} from '../src/ai-tools.mjs';
const sample='CNPJ_Fundo;Data_Referencia;Patrimonio_Liquido;Valor_Patrimonial_Cotas;Numero_Cotistas;Percentual_Dividend_Yield_Mes;Data_Entrega\n12.345.678/0001-95;2026-08-31;2000000,00;10,15;3000;1,01;2026-09-15\n12.345.678/0001-95;2026-09-30;2200000,00;10,30;3050;1,10;2026-10-17\n';
const cnpj='12345678000195';
function oneZip(name,content){
 const data=Buffer.from(content),z=zlib.deflateRawSync(data),n=Buffer.from(name);const lh=Buffer.alloc(30),cd=Buffer.alloc(46),eocd=Buffer.alloc(22);
 lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(8,8);lh.writeUInt32LE(z.length,18);lh.writeUInt32LE(data.length,22);lh.writeUInt16LE(n.length,26);
 cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(8,10);cd.writeUInt32LE(z.length,20);cd.writeUInt32LE(data.length,24);cd.writeUInt16LE(n.length,28);
 eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(1,8);eocd.writeUInt16LE(1,10);eocd.writeUInt32LE(cd.length+n.length,12);eocd.writeUInt32LE(lh.length+n.length+z.length,16);
 return Buffer.concat([lh,n,z,cd,n,eocd]);
}
test('CVM CSV: vínculo explícito CNPJ/ticker e campos reais ou nulos',()=>{
 const x=parseCvmMonthly(Buffer.from(sample),{tickerMap:{[cnpj]:'MXRF11'}});
 assert.equal(x.entries.length,2);assert.equal(x.entries[1].indicators.equity,2200000);
 assert.equal(x.entries[1].indicators.navPerShare,10.3);assert.equal(x.entries[1].indicators.investors,3050);
 assert.equal(x.entries[1].publicationDate,'2026-10-17');
 assert.equal(x.entries[1].indicators.totalShares,null);
 assert.equal(x.entries[1].authenticity,'ARQUIVO_NAO_AUTENTICADO');
});
test('CVM ZIP aceito, mas não associa automaticamente ticker por nome',()=>{
 const zip=oneZip('inf_mensal_fii_2026_geral.csv',sample);
 assert.equal(parseCvmMonthly(zip,{tickerMap:{[cnpj]:'MXRF11'}}).entries.length,2);
 assert.throws(()=>parseCvmMonthly(zip,{tickerMap:{}}),/vínculo CNPJ/i);
 assert.equal(parseCvmMonthly(zip,{tickerMap:{'99999999000191':'MXRF11'}}).entries.length,0);
});
test('CVM rejeita arquivos sem colunas indispensáveis e arquivos estranhos',()=>{
 assert.throws(()=>parseCvmMonthly(Buffer.from('foo;bar\nhello;world'),{tickerMap:{[cnpj]:'MXRF11'}}),/CNPJ e data-base/i);
 assert.throws(()=>parseCvmMonthly(oneZip('../traversal.csv',sample),{tickerMap:{[cnpj]:'MXRF11'}}),/ZIP sem CSV/i);
});
test('CVM download oficial constrói somente URL anual fixa',async()=>{
 let used;const x=await downloadCvmMonthly(2026,{fetchImpl:async url=>{used=url;return {ok:true,body:(async function*(){yield oneZip('dados.csv',sample)})()};}});
 assert.equal(used,'https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_2026.zip');
 assert.equal(parseCvmMonthly(x.bytes,{tickerMap:{[cnpj]:'MXRF11'}}).entries.length,2);
 assert.rejects(()=>downloadCvmMonthly(1900),/Ano CVM/);
});
test('CVM data view only latest report, without false quote claims',()=>{
 const r=parseCvmMonthly(Buffer.from(sample),{tickerMap:{[cnpj]:'MXRF11'}});
 const db={cvmReports:r.entries};const o=cvmPreview(db);assert.equal(o.latest.length,1);assert.equal(o.latest[0].referenceDate,'2026-09-30');
});
test('eligibility from snapshot honors split and bonus after date',()=>{
 const db={snapshots:[{asOf:'2026-01-01',positions:[{ticker:'MXRF11',quantity:100}]}],transactions:[{ticker:'MXRF11',date:'2026-02-01',type:'SPLIT',factor:2},{ticker:'MXRF11',date:'2026-02-02',type:'BONUS',quantity:20},{ticker:'MXRF11',date:'2026-03-01',type:'SELL',quantity:30}]};
 assert.equal(sharesEligible(db,'MXRF11','2026-03-05').quantity,190);
});
test('proventos: sem data-com não inventa, com data/comprovante concilia',()=>{
 const db={snapshots:[],transactions:[{ticker:'MXRF11',date:'2026-01-01',type:'BUY',quantity:10,price:10},{ticker:'MXRF11',date:'2026-05-10',type:'DIVIDEND',amount:1}],events:[{id:'e1',ticker:'MXRF11',date:'2026-05-10',recordDate:'2026-05-01',perShare:0.1,source:'Comunicado informado'}]};
 const a=reconcileIncome(db,{from:'2026-05-01',to:'2026-05-31'});assert.equal(a.events[0].status,'CONCILIADO');assert.equal(a.events[0].expected,1);
 db.events[0].recordDate=null;assert.equal(reconcileIncome(db).events[0].status,'SEM_ELEGIBILIDADE');
});
test('qualidade: preços antigos não são atuais, IA tem ferramentas de dados verificáveis',()=>{
 const db={transactions:[{ticker:'MXRF11',date:'2026-01-01',type:'BUY',quantity:10,price:10}],quotes:[{ticker:'MXRF11',date:'2026-05-01',price:10,source:'manual'}],cvmReports:[],events:[],watchlist:[],snapshots:[],profiles:[],fixedIncome:[],foreignTrades:[]};
 assert.equal(dataCoverage(db,{now:'2026-10-24'}).quotes[0].quality,'ANTIGO');
 assert.equal(callReadOnlyTool('metrics_consultar_fundamentos_cvm',{},db).latest.length,0);
 assert.equal(callReadOnlyTool('metrics_verificar_cotacoes',{},db).quotes[0].quality,'ANTIGO');
});

test('dossiê 31/12 não inclui operações internacionais nem resgates do futuro',async()=>{
 const {taxDossier}=await import('../src/tax-dossier.mjs');
 const db={transactions:[],profiles:[],snapshots:[],taxEvidence:[],instruments:[],fixedIncome:[{ticker:'CDB28',principal:1000,currency:'BRL',rateKind:'PREFIXED',annualRate:10,startDate:'2025-01-01',maturityDate:'2028-01-01',redemptions:[{date:'2026-06-01',principal:400,received:420}]}],foreignTrades:[{ticker:'AAPL',currency:'USD',type:'BUY',date:'2026-01-01',quantity:2,price:100}]};
 const y2025=taxDossier(db,2025);assert.equal(y2025.otherAssets[0].remainingPrincipal,1000);assert.ok(!y2025.foreignAssets.some(x=>x.registeredOnly===false));
 const y2026=taxDossier(db,2026);assert.equal(y2026.otherAssets[0].remainingPrincipal,600);assert.equal(y2026.foreignAssets.filter(x=>x.registeredOnly===false)[0].quantity,2);
});

test('vínculo CVM exige dígitos verificadores de CNPJ corretos',()=>{assert.equal(validCnpj('12345678000195'),true);assert.equal(validCnpj('12345678000199'),false);assert.throws(()=>parseCvmMonthly(Buffer.from(sample),{tickerMap:{'12345678000199':'MXRF11'}}),/dígitos verificadores/);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCvmDfp,dfpOverview} from '../src/cvm-dfp.mjs';
import {readOnlyTools,callReadOnlyTool} from '../src/ai-tools.mjs';
const csv='CNPJ_CIA;DT_REFER;GRUPO_DFP;ORDEM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ESCALA_MOEDA;VERSAO\n12.345.678/0001-95;2025-12-31;DF Consolidado - Demonstração do Resultado;ÚLTIMO;3.01;Receita de venda;12345,67;MIL;1\n12.345.678/0001-95;2025-12-31;DF Consolidado - Demonstração do Resultado;PENÚLTIMO;3.01;Receita;11111,11;MIL;1\n';
const map={'12345678000195':'PETR4'};
test('DFP importado mantém conta, sinal, escala, data e corte do último exercício',()=>{
 const r=parseCvmDfp(Buffer.from(csv),{tickerMap:map});assert.equal(r.entries.length,1);
 const [e]=r.entries;assert.equal(e.rawValue,12345.67);assert.equal(e.scale,'MIL');assert.equal(e.statement,'DRE');assert.equal(e.consolidated,true);assert.equal(e.publicationVerified,false);
 assert.equal(dfpOverview({cvmStatements:r.entries},{ticker:'PETR4'}).observations,1);
});
test('DFP exige identidade da empresa e rejeita afirmações sem documentação',()=>{
 assert.throws(()=>parseCvmDfp(Buffer.from(csv)),/CNPJ/);
 assert.throws(()=>parseCvmDfp(Buffer.from(csv),{tickerMap:{'12345678000195':'??'}}),/Ticker/);
 assert.ok(readOnlyTools.some(x=>x.function.name==='metrics_consultar_dfp_v14'));
 const r=parseCvmDfp(Buffer.from(csv),{tickerMap:map});assert.equal(callReadOnlyTool('metrics_consultar_dfp_v14',{ticker:'PETR4'},{cvmStatements:r.entries}).observations,1);
});

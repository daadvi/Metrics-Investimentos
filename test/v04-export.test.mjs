import test from 'node:test';
import assert from 'node:assert/strict';
import {createXlsx} from '../src/export-xlsx.mjs';
import {parseXLSX} from '../src/importers.mjs';
test('exportação XLSX é válida, preserva números e textos com acentos',()=>{
 const data=createXlsx([{name:'Posições',rows:[['Ticker','Preço','Descrição'],['GGRC11',9.19,'Galpões & imóveis'],['VGIR11',9.58,'CRI CDI']]}]);
 assert.equal(data.subarray(0,2).toString(),'PK');const sheets=parseXLSX(data);
 assert.equal(sheets.length,1);assert.equal(sheets[0].rows[1][0],'GGRC11');assert.equal(Number(sheets[0].rows[1][1]),9.19);assert.equal(sheets[0].rows[1][2],'Galpões & imóveis');
});
test('exportador rejeita planilhas vazias e limites excessivos',()=>{
 assert.throws(()=>createXlsx([]));assert.throws(()=>createXlsx([{name:'Gigante',rows:Array.from({length:100001},()=>[])}]));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readPdf,parseB3CustodyText} from '../src/pdf.mjs';
import {expectedMetricsVersion} from './helpers/expected-metrics-version.mjs';

test('Metrics: versão declarada válida independente do minor release',()=>{
 assert.match(expectedMetricsVersion,/^2\.\d+\.\d+-preview\.\d+$/);
});

test('2.8: PDF com texto é extraído sem erro no encerramento do PDF.js',async()=>{
 const bytes=readFileSync(new URL('./fixtures/b3-carteira-exemplo.pdf',import.meta.url));
 const result=await readPdf(bytes);
 assert.match(result.text,/MXRF11/);
 assert.equal(parseB3CustodyText(result.text).positions.length,2);
});

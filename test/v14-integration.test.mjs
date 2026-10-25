import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {createXlsx} from '../src/export-xlsx.mjs';
import {parseXLSX} from '../src/importers.mjs';
import {queryProvider} from '../src/provider-hub.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function freePort(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
const ipe='CNPJ_Companhia;Data_Entrega;Categoria;Assunto;Protocolo_Entrega;Link_Download\n12.345.678/0001-95;2026-10-20;Aviso aos Acionistas;Rendimentos informados em comunicado;234;https://www.rad.cvm.gov.br/doc.pdf\n';
test('v1.4: APIs, IPE, auditoria fiscal, Excel e isolamento entre carteiras',{timeout:40000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-v14-')),port=await freePort();
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),METRICS_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 try{
  let log='';const launch=await new Promise((resolve,reject)=>{const alarm=setTimeout(()=>reject(Error('Servidor não iniciou: '+log)),14000);for(const io of [child.stdout,child.stderr])io.on('data',b=>{log+=b.toString();const m=log.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(alarm);resolve(m[1]);}});});
  const host=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(host+'/api/providers/catalog')).status,401);
  const login=await fetch(launch,{redirect:'manual'});const cookie=login.headers.get('set-cookie').split(';')[0];let portfolio=null;
  const api=async(endpoint,method='GET',data,expected=200)=>{const response=await fetch(host+endpoint,{method,headers:{cookie,'x-metrics-local':'1',...(portfolio?{'x-metrics-portfolio-id':portfolio}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const text=await response.text();assert.equal(response.status,expected,text.slice(0,650));return JSON.parse(text);};
  assert.equal((await api('/api/health')).version,'1.4.0-rc.1');
  const catalog=await api('/api/providers/catalog');assert.equal(catalog.providers.length,7);assert.equal(catalog.providers.find(x=>x.id==='b3').quotes,false);
  const preview=await api('/api/official/ipe/preview','POST',{data:Buffer.from(ipe).toString('base64'),tickerMap:{'12345678000195':'PETR4'}});
  assert.equal(preview.entries.length,1);assert.equal(preview.entries[0].canConfirmDividend,false);
  const added=await api('/api/official/ipe/import','POST',{data:Buffer.from(ipe).toString('base64'),tickerMap:{'12345678000195':'PETR4'}});assert.equal(added.added,1);
  assert.equal((await api('/api/official/ipe/import','POST',{data:Buffer.from(ipe).toString('base64'),tickerMap:{'12345678000195':'PETR4'}})).added,0);
  assert.equal((await api('/api/official/ipe')).total,1);
  const tax=await api('/api/tax/evidence-v14?year=2026');assert.equal(tax.certified,false);assert.equal(tax.taxDue,null);assert.ok(tax.issues.length);
  const guide=await api('/api/ai/instructions-v14');assert.match(guide.instructions,/MÉTRICS AI/);assert.equal(JSON.stringify(guide).includes('123456789-SECRET'),false);
  const report=await api('/api/report/xlsx?year=2026');const sheets=parseXLSX(Buffer.from(report.base64,'base64'));assert.equal(sheets.length,12);assert.ok(sheets.some(x=>x.rows?.[0]?.[0]==='CNPJ')); 
  const other=await api('/api/portfolios','POST',{name:'Segunda carteira'},201);portfolio=other.portfolio.id;
  assert.equal((await api('/api/official/ipe')).total,0);assert.equal((await api('/api/providers/observations')).dividends.length,0);
  assert.equal((await api('/api/tax/evidence-v14?year=2026')).taxDue,null);
 }finally{child.kill('SIGTERM');await rm(dir,{recursive:true,force:true});}
});
test('XLSX agora aceita 12 abas, preservando cabeçalhos e procedência',()=>{
 const rows=Array.from({length:12},(_,i)=>({name:`Prova ${i+1}`,rows:[['Aba','Valor'],[i+1,'Não certificado']]}));
 const parsed=parseXLSX(createXlsx(rows));assert.equal(parsed.length,12);assert.equal(parsed[11].rows[1][1],'Não certificado');
 assert.throws(()=>createXlsx([...rows,{name:'excesso',rows:[['x']]}]),/12 abas/);
});
test('brapi preenche moeda BRL e não transforma resposta atrasada em tempo real',async()=>{
 const r=await queryProvider({provider:'brapi',ticker:'PETR4',key:'TOKEN_VALIDA_123',fetchImpl:async(url,opts)=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({results:[{symbol:'PETR4',regularMarketPrice:37.1,regularMarketTime:'2026-10-23T17:00:00-03:00'}]})})});
 assert.equal(r.quotes[0].currency,'BRL');assert.equal(r.quotes[0].isRealtime,false);assert.equal(r.quotes[0].date,'2026-10-23');
 assert.ok(!JSON.stringify(r).includes('TOKEN_VALIDA_123'));
});

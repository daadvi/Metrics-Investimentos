import {stopAndRemove} from './helpers/windows-cleanup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import net from 'node:net';import os from 'node:os';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validDate,validateTransaction,portfolioTotals,calculatePositions} from '../src/domain.mjs';
import {parseB3CustodyText,readPdf} from '../src/pdf.mjs';
import {interpretTables} from '../src/importers.mjs';
import {financialFacts,sharesEligible,projectedEvents,fiscalReadiness,investorMemory} from '../src/insights.mjs';
import {callReadOnlyTool} from '../src/ai-tools.mjs';
import {askAI} from '../src/ai.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function db(overrides={}){return {transactions:[],watchlist:[],messages:[],quotes:[],documents:[],profiles:[],events:[],snapshots:[],settings:{},...overrides};}
const buy=(ticker,quantity,date,price=9.3)=>({ticker,type:'BUY',date,quantity,price,fee:0,amount:0});

test('v0.5: valida datas reais inclusive anos bissextos',()=>{
 assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);assert.equal(validDate('2026-13-05'),false);assert.throws(()=>validateTransaction(buy('MXRF11',1,'2026-02-30')),/Data inválida/);
});
test('v0.5: preserva preço unitário com mais de 2 casas',()=>{
 const t=validateTransaction(buy('ETFUSD',500,'2026-10-10',0.001234));assert.equal(t.price,0.001234);
 const p=calculatePositions([t]);assert.ok(p[0].cost>0);
});
test('v0.5: separa JCP/amortização sem fabricar dividendos',()=>{
 const ts=[buy('PETR4',10,'2026-10-01'),validateTransaction({type:'JCP',ticker:'PETR4',date:'2026-10-12',amount:3.50}),validateTransaction({type:'AMORTIZATION',ticker:'PETR4',date:'2026-10-12',amount:2.00})];
 const result=portfolioTotals(ts);assert.equal(result.dividends,3.5);assert.equal(result.amortizations,2);assert.equal(result.positions[0].dividends,0);
 const taxes=fiscalReadiness(db({transactions:ts,profiles:[{ticker:'PETR4',type:'ACAO'}]}),'2026');assert.equal(taxes.income.length,2);assert.ok(taxes.issues.some(x=>x.includes('Amortização')));
});
test('v0.5: interpretador CSV distingue capital JCP e dividendo',()=>{
 const tables=[{sheet:'proventos',rows:[['Data','Produto','Movimentação','Valor'],['12/10/2026','MXRF11','Amortização','R$ 12,00'],['13/10/2026','MXRF11','JCP','R$ 8,00'],['14/10/2026','MXRF11','Rendimento','R$ 4,00']]}];
 const res=interpretTables(tables);assert.deepEqual(res.operations.map(x=>x.type),['AMORTIZATION','JCP','DIVIDEND']);
});
test('v0.5: parser conservador de PDF identifica posições e não gera operações',()=>{
 const text='Relatório Consolidado\nPosição em: 24/10/2026\nProduto Quantidade Preço de fechamento Valor total\nMXRF11 Fundo Imobiliário 100 R$ 9,30 R$ 930,00\nGGRC11 Galpões 25 R$ 9,19 R$ 229,75';
 const parsed=parseB3CustodyText(text);assert.equal(parsed.kind,'positions');assert.equal(parsed.asOf,'2026-10-24');assert.equal(parsed.positions[0].quantity,100);assert.equal(parsed.positions[1].referencePrice,9.19);assert.equal(parsed.operations,undefined);
 assert.equal(parseB3CustodyText('Contrato sem posições nem ticker').kind,'document');
});
test('v0.5: extrai texto de PDF em ambiente de testes',async()=>{
 const buffer=fs.readFileSync(path.join(root,'test/fixtures/b3-carteira-exemplo.pdf'));
 const r=await readPdf(buffer);assert.match(r.text,/MXRF11/);const parsed=parseB3CustodyText(r.text);assert.equal(parsed.positions.length,2);
});
test('v0.5: proventos futuros sem data-base não inventam valor',()=>{
 const d=db({transactions:[buy('MXRF11',100,'2026-10-01')],events:[{id:'1',ticker:'MXRF11',date:'2026-11-12',kind:'CONFIRMADO',perShare:0.10}]});
 const future=projectedEvents(d,{today:'2026-10-12'})[0];assert.equal(future.amount,null);assert.equal(future.eligibilityStatus,'DATA_COM_NAO_CADASTRADA');
 d.events[0].recordDate='2026-10-10';const verified=projectedEvents(d,{today:'2026-10-12'})[0];assert.equal(verified.amount,10);assert.equal(verified.automaticallyVerified,false);
});
test('v0.5: extrato de posição não gera custo fiscal e pode conferir elegibilidade',()=>{
 const d=db({snapshots:[{asOf:'2026-09-20',positions:[{ticker:'MXRF11',quantity:100}],source:'B3 PDF'}],transactions:[buy('MXRF11',5,'2026-10-01')]});
 assert.equal(sharesEligible(d,'MXRF11','2026-10-10').quantity,105);
 assert.equal(financialFacts(d).custodyStatement.positions[0].quantity,100);
 assert.equal(financialFacts(d).summary.holdingCost,46.5); // only manual purchase, snapshot has no invented cost
});
test('v0.5: memoria local distingue carteira e desejos sem limitar base persistida',()=>{
 const d=db({transactions:[buy('MXRF11',10,'2026-10-02')],watchlist:[{ticker:'GGRC11',priority:'alta',target:8.9}]});
 const ctx=investorMemory(d,'Quero saber sobre GGRC11 e MXRF11');assert.match(ctx,/MXRF11/);assert.match(ctx,/GGRC11/);assert.match(ctx,/Dados lançados/);
 const result=callReadOnlyTool('metrics_get_carteira',{ticker:'GGRC11'},d);assert.equal(result.watchlist.length,1);assert.equal(result.positions.length,0);
});
test('v0.5: ferramenta IA utiliza simulador deterministico e rotula hipotese',()=>{
 const r=callReadOnlyTool('metrics_simular_aportes',{price:9.3,dividend:0.1,phases:[{months:12,amount:400}]},db());assert.equal(r.kind,'HYPOTHETICAL');assert.equal(r.result.deposited,4800);assert.ok(r.result.holdingsValue>0);
});
test('v0.5: IA executa ferramenta de carteira no Ollama simulado sem permitir alterações',async()=>{
 const old=globalThis.fetch;const payloads=[];globalThis.fetch=async(_url,o)=>{
  const data=JSON.parse(o.body);payloads.push(data);
  const message=payloads.length===1?{content:'',tool_calls:[{function:{name:'metrics_get_carteira',arguments:{ticker:'MXRF11'}}}]}:{content:'O investidor tem 10 unidades registradas.'};
  return new Response(JSON.stringify({message}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{const out=await askAI({provider:'ollama',model:'qwen2.5:3b',messages:[{role:'user',content:'Quantas cotas de MXRF11 eu tenho?'}],context:true},db({transactions:[buy('MXRF11',10,'2026-10-01')]}));assert.match(out,/10/);assert.equal(payloads.length,2);assert.equal(JSON.parse(payloads[1].messages.find(x=>x.role==='tool').content).positions[0].quantity,10);}
 finally{globalThis.fetch=old;}
});
test('v0.5: modelo Ollama sem tool-calling mantém chat e contexto por fallback',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async(_url,opt)=>{
  calls++;const payload=JSON.parse(opt.body);
  if(calls===1)return new Response(JSON.stringify({error:'model does not support tools'}),{status:400,headers:{'content-type':'application/json'}});
  assert.equal(payload.tools,undefined);return new Response(JSON.stringify({message:{content:'Resumo da carteira com dados locais.'}}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{const result=await askAI({provider:'ollama',model:'simple:latest',context:true,messages:[{role:'user',content:'Resuma meus investimentos'}]},db({transactions:[buy('MXRF11',3,'2026-10-01')]}));assert.match(result,/Resumo/);assert.equal(calls,2);}
 finally{globalThis.fetch=old;}
});
async function availablePort(){return new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});}
test('v0.5: API PDF B3 > snapshot > IA/contexto > relatórios auxiliares', {timeout:30000}, async()=>{
 const tmp=await mkdtemp(path.join(os.tmpdir(),'metrics-v05-'));const port=await availablePort();
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),METRICS_DATA_DIR:tmp},stdio:['ignore','pipe','pipe']});
 try{
  let output='';const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Timeout')),12000);for(const stream of [child.stdout,child.stderr])stream.on('data',s=>{output+=s.toString();const u=output.match(/METRICS_LAUNCH_URL=(\S+)/);if(u){clearTimeout(timer);resolve(u[1]);}});});
  const rootUrl=`http://127.0.0.1:${port}`;const logged=await fetch(url,{redirect:'manual'});assert.equal(logged.status,303);const cookie=logged.headers.get('set-cookie').split(';')[0];
  const go=async(route,method='GET',data)=>{const response=await fetch(rootUrl+route,{method,headers:{Cookie:cookie,'X-Metrics-Local':'1',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});const json=await response.json();if(!response.ok)throw Error(`${route}: ${json.error}`);return json;};
  const pdf=fs.readFileSync(path.join(root,'test/fixtures/b3-carteira-exemplo.pdf'));
  const preview=await go('/api/import/preview','POST',{name:'Carteira B3.pdf',data:pdf.toString('base64')});assert.equal(preview.kind,'positions');assert.equal(preview.positions.length,2);
  const created=await go('/api/snapshots','POST',{asOf:preview.asOf,source:preview.title,positions:preview.positions});assert.equal(created.snapshot.positions.length,2);
  const state=await go('/api/state');assert.equal(state.transactions.length,0);assert.equal(state.snapshots.length,1);
  const facts=await go('/api/insights');assert.equal(facts.custodyStatement.positions[0].ticker,'MXRF11');assert.equal(facts.summary.holdingCost,0);
  const tax=await go('/api/fiscal-readiness?year=2026');assert.equal(tax.readiness,'REVISÃO_OBRIGATÓRIA');assert.ok(tax.issues.some(x=>x.includes('Extratos de posição')));
  await go('/api/snapshots/'+created.snapshot.id,'DELETE');assert.equal((await go('/api/state')).snapshots.length,0);
 }finally{await stopAndRemove(child,tmp);}
});

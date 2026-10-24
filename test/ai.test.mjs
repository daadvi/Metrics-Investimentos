import test from 'node:test';
import assert from 'node:assert/strict';
import {askAI,contextFromDb} from '../src/ai.mjs';
const db={transactions:[{type:'BUY',ticker:'VGIR11',date:'2026-10-12',quantity:10,price:9.58,fee:0,amount:0,createdAt:'2026-10-12T00:00:00.000Z'}],watchlist:[{ticker:'GGRC11',priority:'alta',target:8.5,budget:400,notes:'diversificar'}]};
test('resumo de IA separa carteira e desejos',()=>{
 const c=contextFromDb(db);assert.match(c,/carteiraAtual/);assert.match(c,/listaDeDesejos/);assert.match(c,/VGIR11/);assert.match(c,/GGRC11/);
});
test('sem autorização de contexto, não envia dados da carteira nem histórico anterior',async()=>{
 const old=globalThis.fetch;let outbound;
 globalThis.fetch=async(url,opts)=>{outbound=JSON.parse(opts.body);return new Response(JSON.stringify({message:{content:'Resposta local'}}),{status:200,headers:{'Content-Type':'application/json'}});};
 try{const answer=await askAI({provider:'ollama',model:'qwen2.5:3b',context:false,messages:[{role:'user',content:'Meu VGIR11 está caindo'},{role:'assistant',content:'Você tem 10 cotas de VGIR11 e deseja GGRC11'},{role:'user',content:'Oi'}]},db);assert.equal(answer,'Resposta local');assert.equal(outbound.messages.length,2);assert.ok(!JSON.stringify(outbound.messages).includes('VGIR11'));}finally{globalThis.fetch=old;}
});
test('com consentimento, o resumo é incluído no contexto',async()=>{
 const old=globalThis.fetch;let outbound;
 globalThis.fetch=async(url,opts)=>{outbound=JSON.parse(opts.body);return new Response(JSON.stringify({message:{content:'OK'}}),{status:200,headers:{'Content-Type':'application/json'}});};
 try{await askAI({provider:'ollama',model:'qwen2.5:3b',context:true,messages:[{role:'user',content:'Quais investimentos tenho?'}]},db);assert.ok(JSON.stringify(outbound.messages).includes('VGIR11'));assert.ok(JSON.stringify(outbound.messages).includes('GGRC11'));}finally{globalThis.fetch=old;}
});

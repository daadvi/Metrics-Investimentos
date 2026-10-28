import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const code=`
import {init,read,addWatch,editWatch,saveProfile,createPortfolio,withPortfolio,listPortfolios} from './src/store.mjs';
await init();
const original=(await addWatch({ticker:'petr4',priority:'baixa',target:20,budget:100,notes:'Antes'}));
const edited=await editWatch(original.id,{ticker:'vale3',priority:'alta',target:'',budget:'',notes:'Reavaliar'});
const state=await read();
if(edited.id!==original.id||edited.ticker!=='VALE3'||edited.priority!=='alta'||edited.target!==null||edited.budget!==null||edited.notes!=='Reavaliar')throw Error('Atualizacao da lista de desejos incorreta');
if(state.watchlist.length!==1||state.watchlist[0].ticker!=='VALE3')throw Error('Lista duplicada ou nao persistida');
const p=await saveProfile({ticker:'vale3',type:'ACAO',name:'Exemplo',sector:'Energia',source:'Informe da companhia'});
if(p.type!=='ACAO'||p.ticker!=='VALE3')throw Error('Cadastro de acao nao persistiu');
const updated=await saveProfile({ticker:'VALE3',type:'ACAO',name:'Exemplo atualizado',sector:'Materiais',source:'Outro informe'});
if(updated.name!=='Exemplo atualizado'||(await read()).profiles.length!==1)throw Error('Edicao da ficha duplicou o ticker');
let duplicateRejected=false;try{await addWatch({ticker:'VALE3'});}catch(e){duplicateRejected=/lista de desejos|duplicado/i.test(e.message);}
if(!duplicateRejected)throw Error('A lista aceitou ticker duplicado');
const other=await createPortfolio('Carteira separada');
const isolated=await withPortfolio(other.id,read);
if(isolated.watchlist.length||isolated.profiles.length)throw Error('Dados vazaram entre carteiras');
const principal=await withPortfolio((await listPortfolios()).activePortfolioId,read);
if(principal.watchlist.length!==1||principal.profiles.length!==1)throw Error('Dados da carteira principal sumiram');
console.log(JSON.stringify({ok:true,ticker:principal.watchlist[0].ticker,priority:principal.watchlist[0].priority,profile:principal.profiles[0].type,isolated:true}));
`;
test('Metrics 2.8 hotfix: desejos completos, acao, sobrescrita de ficha e isolamento',{timeout:30000},async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'metrics-fix-watch-'));
 try {
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:project,encoding:'utf8',timeout:24000,env:{...process.env,METRICS_DATA_DIR:temp,METRICS_PASSPHRASE:'',METRICS_MIGRATE_ENCRYPT:''}});
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.deepEqual(JSON.parse(result.stdout.trim()),{ok:true,ticker:'VALE3',priority:'alta',profile:'ACAO',isolated:true});
 } finally {await rm(temp,{recursive:true,force:true,maxRetries:12,retryDelay:250});}
});
test('Metrics 2.8 hotfix: interface possui edicao e entrada direta na analise',async()=>{
 const ui=await readFile(path.join(project,'web/app.js'),'utf8');
 assert.match(ui,/FIX_WATCH_ANALYSIS_V28/);
 assert.match(ui,/watch-edit-form-v28/);
 assert.match(ui,/profile-new-stock-v28/);
 assert.match(ui,/metricsBindExplore28/);
});

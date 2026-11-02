import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('lista de desejos: querySelectorAll em edicao e fichas, sem excecao apos o primeiro ativo',()=>{
 const source=readFileSync(path.join(root,'web/app.js'),'utf8');
 assert.ok(source.includes("for(const edit of $$('[data-edit-watch]')){"),'Editar deve usar querySelectorAll');
 assert.ok(source.includes("for(const remove of $$('[data-remove-profile]')){"),'Editar ficha deve usar querySelectorAll');
 assert.ok(!source.includes("for(const edit of $('[data-edit-watch]')){"));
 assert.ok(!source.includes("for(const remove of $('[data-remove-profile]')){"));
});

test('duas adicoes consecutivas, edicao, duplicatas e carteiras isoladas no SQLite',{timeout:35000},()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'metrics-v301-wishlist-'));
 const program=`import {init,addWatch,editWatch,read,saveProfile,createPortfolio,withPortfolio,listPortfolios} from './src/store.mjs';
 await init();
 const one=await addWatch({ticker:'PETR4',priority:'media',notes:'Primeiro'});
 const two=await addWatch({ticker:'VALE3',priority:'baixa',notes:'Segundo'});
 if(one.id===two.id)throw Error('IDs iguais');
 let db=await read();
 if(db.watchlist.length!==2||db.watchlist[0].ticker!=='PETR4'||db.watchlist[1].ticker!=='VALE3')throw Error('Falha nas duas adicoes');
 const edited=await editWatch(one.id,{ticker:'ITUB4',priority:'alta',target:'',budget:'',notes:'Editado'});
 db=await read();
 if(edited.id!==one.id||edited.createdAt!==one.createdAt||db.watchlist.length!==2||db.watchlist[0].ticker!=='ITUB4'||db.watchlist[1].ticker!=='VALE3')throw Error('Edicao alterou a estrutura');
 let duplicate=false;try{await editWatch(one.id,{ticker:'VALE3'});}catch(e){duplicate=true;}
 if(!duplicate)throw Error('Duplicata permitida');
 await addWatch({ticker:'BBAS3'});
 if((await read()).watchlist.length!==3)throw Error('Terceiro ativo bloqueado');
 await saveProfile({ticker:'ITUB4',type:'ACAO',name:'Exemplo',source:'Documento teste'});
 const primary=(await listPortfolios()).activePortfolioId;
 const secondary=(await createPortfolio('Separada')).id;
 if((await withPortfolio(secondary,read)).watchlist.length!==0)throw Error('Vazamento de dados entre carteiras');
 if((await withPortfolio(primary,read)).watchlist.length!==3)throw Error('Dados ausentes na principal');
 console.log('sucesso: 3 ativos, edicao e isolamento');`;
 try{
  const p=spawnSync(process.execPath,['--input-type=module','-e',program],{cwd:root,encoding:'utf8',timeout:30000,shell:false,env:{...process.env,METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:'',METRICS_MIGRATE_ENCRYPT:''}});
  assert.equal(p.status,0,p.stderr||String(p.error||p.stdout));
  assert.match(p.stdout,/sucesso/);
 }finally{rmSync(dir,{force:true,recursive:true,maxRetries:12,retryDelay:300});}
});

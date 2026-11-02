#!/usr/bin/env node
/** Patch conservador, idempotente e reversível da versão 3.0.
 * Nunca acessa os dados financeiros e não depende do diretório de trabalho.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const KIT=path.dirname(fileURLToPath(import.meta.url));
const PROJECT=path.resolve(process.argv[2]||path.join(KIT,'codigo'));
const DRY=process.argv.includes('--dry-run');
const APP=path.join(PROJECT,'web','app.js');
const PACKAGE=path.join(PROJECT,'package.json');
const sha=x=>createHash('sha256').update(x).digest('hex');
function fail(s){console.error('BLOQUEADO: '+s);process.exit(1);}
if(!fs.existsSync(APP)||!fs.existsSync(PACKAGE))fail('Estrutura Metrics não encontrada. Informe a pasta do código-fonte, não a pasta pessoal de dados.');
const pkg=JSON.parse(fs.readFileSync(PACKAGE,'utf8'));
if(!/^3\.0\./.test(pkg.version))fail('Versão não reconhecida: '+pkg.version+'; não modificar sem auditoria.');
const src=fs.readFileSync(APP,'utf8');
const pairs=[
 ["for(const edit of $('[data-edit-watch]')){","for(const edit of $$('[data-edit-watch]')){"],
 ["for(const remove of $('[data-remove-profile]')){","for(const remove of $$('[data-remove-profile]')){"]
];
let result=src,changed=0;
for(const [bad,good] of pairs){
 const n=result.split(bad).length-1;
 if(n>1)fail('O seletor antigo aparece mais de uma vez: '+bad);
 if(n===1){result=result.replace(bad,()=>good);changed++;}
 else if(!result.includes(good))fail('Estrutura de interface inesperada, sem seletor reconhecido: '+bad);
}
// Um erro de compilação deve impedir uma mudança no código original.
const otherInvalid=[...result.matchAll(/for\s*\(\s*const\s+\w+\s+of\s+\$\(/g)];
if(otherInvalid.length)fail('Foram encontrados outros loops sobre querySelector. Revisão manual necessária.');
const temp=path.join(PROJECT,'web','.metrics-app-check-'+process.pid+'.mjs');
if(!DRY){
 try{fs.writeFileSync(temp,result,{flag:'wx'});const check=spawnSync(process.execPath,['--check',temp],{encoding:'utf8'});if(check.status!==0)fail('Sintaxe da interface inválida: '+check.stderr);}
 finally{fs.rmSync(temp,{force:true});}
}
const oldPackage=fs.readFileSync(PACKAGE,'utf8');
if(!pkg.scripts?.test||!pkg.scripts?.['test:ui'])fail('Scripts de teste da versão original ausentes.');
if(!pkg.scripts.test.includes('test/v301-wishlist-browser.test.mjs'))pkg.scripts.test+=' test/v301-wishlist-browser.test.mjs';
if(!pkg.scripts['test:ui'].includes('test/ui/v301-wishlist.spec.mjs'))pkg.scripts['test:ui']+=' test/ui/v301-wishlist.spec.mjs';
const packageNew=JSON.stringify(pkg,null,2)+'\n';
const manifest={version:pkg.version,before:sha(src),after:sha(result),changes:changed,project:PROJECT,testsAdded:packageNew!==oldPackage};
console.log(JSON.stringify({...manifest,dryRun:DRY},null,2));
if(DRY)process.exit(0);
if(changed){
 const backup=path.join(KIT,'recuperacao',new Date().toISOString().replace(/[:.]/g,'-'));
 fs.mkdirSync(backup,{recursive:true,mode:0o700});
 fs.writeFileSync(path.join(backup,'app.js'),src,{mode:0o600});
 fs.writeFileSync(path.join(backup,'package.json'),oldPackage,{mode:0o600});
 fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2));
 const fresh=APP+'.new-'+process.pid;
 try{fs.writeFileSync(fresh,result);fs.renameSync(fresh,APP);}catch(e){fs.rmSync(fresh,{force:true});fail('Falha ao gravar: '+e.message);}
 console.log('CORRIGIDO: dois seletores, com backup em '+backup);
}else console.log('Interface já corrigida. Nenhuma duplicação aplicada.');
if(packageNew!==oldPackage)fs.writeFileSync(PACKAGE,packageNew);
// Testes colocados apenas quando diferentes; não altera package.json.
for(const fname of ['v301-wishlist-browser.test.mjs']){
 const from=path.join(KIT,'test',fname),to=path.join(PROJECT,'test',fname);
 if(fs.existsSync(from)){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
}
for(const fname of ['v301-wishlist.spec.mjs']){
 const from=path.join(KIT,'test',fname),to=path.join(PROJECT,'test','ui',fname);
 if(fs.existsSync(from)){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
}

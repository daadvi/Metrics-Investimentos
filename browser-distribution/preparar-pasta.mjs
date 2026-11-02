#!/usr/bin/env node
/** Baixa código público diretamente do repositório do autor na primeira execução.
 * Não sincroniza automaticamente versões, não lê carteiras, não sobe dados.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const KIT=path.dirname(fileURLToPath(import.meta.url)),TARGET=fs.existsSync(path.join(KIT,'..','server.mjs'))?path.resolve(KIT,'..'):path.join(KIT,'codigo');
const mode=process.argv.includes('--skip-install')?'skip':'install';
const fail=s=>{console.error('ERRO: '+s);process.exit(1);};
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<13))fail('É necessário Node.js 22.13 ou superior.');
const git=spawnSync('git',['--version'],{encoding:'utf8',shell:false,windowsHide:true});
if(git.error||git.status!==0)fail('Git não encontrado. Instale o Git uma vez para preparar a pasta.');
let didClone=false;
if(!fs.existsSync(path.join(TARGET,'server.mjs'))){
 if(fs.existsSync(TARGET))fail('A pasta codigo existe, mas não contém o Metrics. Não vou sobrescrevê-la.');
 console.log('Baixando o código do Metrics 3.0 do GitHub (branch release/3.0.0)...');
 const cfg=path.join(KIT,'.gitconfig-temporario');
 if(!fs.existsSync(cfg))fs.writeFileSync(cfg,'[init]\n  defaultBranch = main\n',{mode:0o600});
 const env={...process.env,GIT_CONFIG_GLOBAL:cfg};
 const command=spawnSync('git',['clone','--depth','1','--single-branch','--branch','release/3.0.0','https://github.com/daadvi/Metrics-Investimentos.git',TARGET],{stdio:'inherit',env,shell:false,windowsHide:true});
 if(command.status!==0)fail('Não foi possível baixar a branch release/3.0.0. Confira a internet e o GitHub.');
 didClone=true;
}
const pkg=JSON.parse(fs.readFileSync(path.join(TARGET,'package.json'),'utf8'));
if(pkg.version!=='3.0.0')fail('O repositório está em '+pkg.version+' e não na base 3.0.0 esperada.');
console.log('Aplicando correção da lista de desejos...');
const fix=spawnSync(process.execPath,[path.join(KIT,'aplicar-correcao.mjs'),TARGET],{stdio:'inherit',shell:false});
if(fix.status!==0)fail('Não foi possível aplicar a correção.');
if(mode==='install'){
 console.log('Instalando somente dependências necessárias para executar (sem Electron)...');
 const npm=process.platform==='win32'?'npm.cmd':'npm';
 // Executa npm.cmd pelo shell só no Windows; a aplicação nunca é passada a cmd.exe sem aspas.
 const result=spawnSync(npm,['ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{cwd:TARGET,stdio:'inherit',shell:process.platform==='win32',windowsHide:true});
 if(result.status!==0)fail('Falha nas dependências. Use npm ci --omit=dev dentro da pasta codigo para conferir.');
}
console.log('\nPasta Metrics pronta! Dados pessoais: NÃO baixados nem enviados. '+(didClone?'Código baixado.':'Código existente preservado.'));

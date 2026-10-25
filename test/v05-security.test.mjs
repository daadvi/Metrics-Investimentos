import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=`import {init,addTransaction,read,isEncrypted} from './src/store.mjs';await init();`;
const run=(script,env)=>spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:root,encoding:'utf8',env:{...process.env,...env},timeout:18000});
test('v0.5: migra banco antigo para armazenamento criptografado e preserva posições',{timeout:40000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-encryption-'));
 try{
  let r=run(base+`await addTransaction({type:'BUY',ticker:'MXRF11',date:'2026-10-01',quantity:15,price:9.30});`,{METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:'',METRICS_MIGRATE_ENCRYPT:''});assert.equal(r.status,0,r.stderr);
  r=run(base+`console.log(JSON.stringify({items:(await read()).transactions.length,encrypted:isEncrypted()}));`,{METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:'private-tests-only-passphrase',METRICS_MIGRATE_ENCRYPT:'1'});
  assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout.trim()),{items:1,encrypted:true});
  const file=await readFile(path.join(dir,'metrics.sqlite'));assert.equal(file.includes(Buffer.from('MXRF11')),false);
  r=run(base+`console.log((await read()).transactions[0].ticker);`,{METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:'incorrect-key',METRICS_MIGRATE_ENCRYPT:'1'});
  assert.notEqual(r.status,0);assert.match(r.stderr,/Senha de dados incorreta/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

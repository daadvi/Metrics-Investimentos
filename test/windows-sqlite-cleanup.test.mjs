import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {EventEmitter,once} from 'node:events';
import {spawn} from 'node:child_process';
import {stopAndRemove} from './helpers/windows-cleanup.mjs';

// Testa a ordem de fechamento independentemente do sistema operacional.
test('SQLite Windows: aguarda o fechamento antes de remover os arquivos',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-sqlite-stop-'));
  const child=new EventEmitter();child.exitCode=null;child.signalCode=null;
  let processClosed=false;
  child.kill=()=>{setTimeout(()=>{processClosed=true;child.exitCode=0;child.emit('close',0,'SIGTERM');},75);return true;};
  await stopAndRemove(child,dir);
  assert.equal(processClosed,true);
  await assert.rejects(()=>stat(dir),{code:'ENOENT'});
});

test('SQLite Windows: limpa mesmo se o processo ja terminou',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-sqlite-stop-'));
  const child={exitCode:0,signalCode:null};
  await stopAndRemove(child,dir);
  await assert.rejects(()=>stat(dir),{code:'ENOENT'});
});


test('SQLite Windows: encerra processo REAL com WAL antes de limpar diretorio',{timeout:15000},async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'metrics-sqlite-real-'));
  const script=`import {DatabaseSync} from 'node:sqlite';
   import path from 'node:path';
   const db=new DatabaseSync(path.join(process.argv[1],'metrics.sqlite'));
   db.exec('PRAGMA journal_mode=WAL; CREATE TABLE x(value INT); INSERT INTO x VALUES(1);');
   console.log('READY');setInterval(()=>{},2000);`;
  const child=spawn(process.execPath,['--input-type=module','-e',script,dir],{stdio:['ignore','pipe','pipe']});
  let startupTimeout;
  try{
    const [chunk]=await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>{startupTimeout=setTimeout(()=>reject(Error('Servidor de teste nao iniciou')),6000);})]);
    assert.match(String(chunk),/READY/);
    await stopAndRemove(child,dir);
    await assert.rejects(()=>stat(dir),{code:'ENOENT'});
  }finally{
    clearTimeout(startupTimeout);
    if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
  }
});

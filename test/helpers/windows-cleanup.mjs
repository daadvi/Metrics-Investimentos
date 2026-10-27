/** Cleanup seguro dos servidores SQLite em testes Windows/Linux/macOS.
 * Aguarda o fechamento do processo filho antes de remover o diretorio temporario.
 */
import {rm} from 'node:fs/promises';

export async function stopAndRemove(child, directory) {
  if(child && child.exitCode === null && child.signalCode === null) {
    await new Promise((resolve,reject)=>{
      let completed=false;
      const finish=(error)=>{
        if(completed)return;completed=true;clearTimeout(timer);
        child.off('close',onClose);child.off('error',onError);
        error?reject(error):resolve();
      };
      const onClose=()=>finish();
      const onError=()=>finish(); // O processo pode ja ter sido encerrado.
      child.once('close',onClose);
      child.once('error',onError);
      const timer=setTimeout(()=>{
        try{child.kill('SIGKILL');}catch{}
        finish(new Error('Servidor de testes nao encerrou em 8 segundos; banco temporario foi preservado.'));
      },8000);
      try{if(!child.kill('SIGTERM')) finish();}
      catch(e){finish(e);}
    });
  }
  // EBUSY/EPERM no Windows pode persistir brevemente apos o fechamento dos handles.
  await rm(directory,{recursive:true,force:true,maxRetries:15,retryDelay:150});
}

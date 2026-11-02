// Playwright end-to-end: only fictional data in an isolated temp directory.
import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const port=()=>new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});});
let child,dir,url;
test.beforeAll(async()=>{
 dir=await mkdtemp(path.join(os.tmpdir(),'metrics-watch-browser-'));
 const p=await port();child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(p),METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:''},stdio:['ignore','pipe','pipe']});
 url=await new Promise((resolve,reject)=>{let logs='';const timeout=setTimeout(()=>reject(Error('Servidor nao iniciou: '+logs)),20000);for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs+=b.toString();const m=logs.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});child.once('exit',n=>{clearTimeout(timeout);reject(Error('Servidor encerrou: '+n+' '+logs));});});
});
test.afterAll(async()=>{
 if(child){child.kill('SIGTERM');if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,4000))]);}
 if(dir)await rm(dir,{force:true,recursive:true,maxRetries:12,retryDelay:250});
});
test('adicionar dois desejos, editar o primeiro e continuar adicionando',async({page})=>{
 await page.goto(url);await page.locator('[data-nav="watch"]').click();
 const form=page.locator('#watch-form');
 await form.locator('[name="ticker"]').fill('PETR4');
 await form.locator('[name="notes"]').fill('Primeira ação');
 await form.locator('[type="submit"]').click();
 await expect(page.locator('[data-edit-watch]')).toHaveCount(1);
 await page.locator('#watch-form [name="ticker"]').fill('VALE3');
 await page.locator('#watch-form [type="submit"]').click();
 await expect(page.locator('[data-edit-watch]')).toHaveCount(2);
 await page.locator('[data-edit-watch]').first().click();
 const edit=page.locator('#watch-edit-form-v28');
 await expect(edit).toBeVisible();
 await edit.locator('[name="ticker"]').fill('ITUB4');
 await edit.locator('[name="priority"]').selectOption('alta');
 await edit.locator('button[type="submit"]').click();
 await expect(page.locator('.watch-code')).toContainText(['ITUB4','VALE3']);
 await page.locator('#watch-form [name="ticker"]').fill('BBAS3');
 await page.locator('#watch-form [type="submit"]').click();
 await expect(page.locator('[data-edit-watch]')).toHaveCount(3);
 await page.reload();await page.locator('[data-nav="watch"]').click();
 await expect(page.locator('.watch-code')).toContainText(['ITUB4','VALE3','BBAS3']);
});

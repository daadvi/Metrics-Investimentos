// Run only via npm run test:ui; use mock banking data in an isolated temp directory.
import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const port=()=>new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const v=s.address().port;s.close(()=>resolve(v));});});
let child,dir,url;
test.beforeAll(async()=>{
 dir=await mkdtemp(path.join(os.tmpdir(),'metrics-ui-v30-'));
 const p=await port();child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(p),METRICS_DATA_DIR:dir,METRICS_PASSPHRASE:''},stdio:['ignore','pipe','pipe']});
 url=await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>reject(Error('Servidor não abriu: '+out)),20000);for(const s of [child.stdout,child.stderr])s.on('data',b=>{out+=b.toString();const m=out.match(/METRICS_LAUNCH_URL=(\S+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});child.once('exit',n=>{clearTimeout(timeout);reject(Error('Servidor saiu: '+n));});});
});
test.afterAll(async()=>{if(child){child.kill('SIGTERM');if(child.exitCode===null)await Promise.race([new Promise(res=>child.once('exit',res)),new Promise(res=>setTimeout(res,4000))]);}if(dir)await rm(dir,{recursive:true,force:true,maxRetries:7,retryDelay:300});});
test('menu vertical persiste ao navegar e mudar tema',async({page})=>{
 await page.setViewportSize({width:1280,height:780});await page.goto(url);await page.locator('.sidebar .nav').waitFor();
 await page.locator('.sidebar .nav').evaluate(x=>x.scrollTop=x.scrollHeight);
 const before=await page.locator('.sidebar .nav').evaluate(x=>x.scrollTop);
 await page.locator('[data-nav="quality30"]').click();await expect(page.locator('.page-head h1')).toContainText('Auditoria');
 const after=await page.locator('.sidebar .nav').evaluate(x=>x.scrollTop);expect(after).toBeGreaterThanOrEqual(before-20);
 await page.locator('#theme').click();expect(await page.locator('.sidebar .nav').evaluate(x=>x.scrollTop)).toBeGreaterThanOrEqual(before-20);
 await page.locator('#quality-refresh30').click();await expect(page.locator('#quality-result30')).toContainText('lançamentos');
});
test('no celular a navegação horizontal não salta ao início',async({page})=>{
 await page.setViewportSize({width:390,height:780});await page.goto(url);await page.locator('.sidebar .nav').waitFor();
 const nav=page.locator('.sidebar .nav');
 const geometry=await nav.evaluate(el=>({width:el.clientWidth,content:el.scrollWidth}));
 expect(geometry.content,'menu móvel deve ter conteúdo mais largo que a área rolável').toBeGreaterThan(geometry.width);
 await nav.evaluate(el=>el.scrollLeft=el.scrollWidth-el.clientWidth);
 const x=await nav.evaluate(el=>el.scrollLeft);expect(x).toBeGreaterThan(0);
 // The third-to-last item should be in the visible part of the menu at the right edge.
 await page.locator('[data-nav="quality30"]').click();
 await expect(page.locator('.page-head h1')).toContainText('Auditoria');
 const newX=await nav.evaluate(el=>el.scrollLeft);
 expect(newX,'menu não deve saltar para o começo quando outra página abre').toBeGreaterThanOrEqual(x-25);
});

test('comparação mantém dados incompletos identificados, sem números inventados',async({page})=>{
 await page.setViewportSize({width:1280,height:780});await page.goto(url);
 await page.locator('[data-nav="allocation30"]').click();
 await page.locator('#compare-form30 [name=tickers]').fill('PETR4, VALE3');
 await page.locator('#compare-form30 button[type=submit]').click();
 await expect(page.locator('#compare-result30')).toContainText('PETR4');
 await expect(page.locator('#compare-result30')).toContainText('VALE3');
 await expect(page.locator('#compare-result30')).toContainText('Indisponível');
 await page.locator('#allocation-form30 [name=ACAO]').fill('40');
 await page.locator('#allocation-form30 [name=FII]').fill('40');
 await page.locator('#allocation-form30 button[type=submit]').click();
 await expect(page.locator('#allocation-result30')).toContainText('100%');
 await expect(page.locator('#allocation-form30 [name=ACAO]')).toHaveValue('40');
});

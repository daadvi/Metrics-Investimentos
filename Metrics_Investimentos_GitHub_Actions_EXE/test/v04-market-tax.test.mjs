import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCotahist,fetchRecentB3Prices} from '../src/market.mjs';
import {realizedLedger} from '../src/tax.mjs';
function line(ticker,day,market='010',price=950){
 const cells=Array(245).fill(' ');
 function put(start,v){for(let i=0;i<v.length;i++)cells[start+i]=v[i];}
 put(0,'01');put(2,day);put(10,'02');put(12,ticker.padEnd(12));put(24,market);put(108,String(price).padStart(13,'0'));
 return cells.join('');
}
const buffer=()=>Buffer.from('00'+ ' '.repeat(243)+'\n'+line('GGRC11','20261021','010',901)+'\n'+line('GGRC11','20261022','010',919)+'\n'+line('VGIR11','20261022','010',958)+'\n'+line('GGRC11','20261022','020',899)+'\n'+'99'+' '.repeat(243)+'\n','latin1');
test('parser COTAHIST escolhe mercado à vista, data mais recente e preço em centavos',()=>{
 const out=parseCotahist(buffer(),{wanted:['GGRC11','MXRF11']});
 assert.equal(out.quotes.length,1);assert.equal(out.quotes[0].ticker,'GGRC11');assert.equal(out.quotes[0].price,9.19);assert.equal(out.quotes[0].date,'2026-10-22');
});
test('parser não aceita ZIP inválido nem dados muito longos',()=>{
 assert.throws(()=>parseCotahist(Buffer.from('PK arquivo falso')), /ZIP/);
 assert.throws(()=>parseCotahist(Buffer.alloc(24*1024*1024+1)),/24 MB/);
});
test('parser resiste a arquivos sem registro de cotação',()=>assert.throws(()=>parseCotahist(Buffer.from('texto aleatório')), /Nenhuma linha/));
test('fetch diário usa domínio fixo e só retorna dados do arquivo de fechamento',async()=>{
 const calls=[];const result=await fetchRecentB3Prices({wanted:['VGIR11'],now:new Date('2026-10-23T12:00:00Z'),fetchImpl:async url=>{calls.push(url);return {ok:true,body:(async function*(){yield buffer();})()};}});
 assert.equal(result.quotes[0].ticker,'VGIR11');assert.equal(result.quotes[0].price,9.58);assert.match(calls[0],/^https:\/\/bvmf\.bmfbovespa\.com\.br\/InstDados\/SerHist\/COTAHIST_D23102026\.ZIP$/);
});
const tx=(date,ticker,type,quantity,price,fee=0,amount=0)=>({date,ticker,type,quantity,price,fee,amount});
test('apura resultado de venda com custo médio e taxa de venda, sem tratar como imposto devido',()=>{
 const d=realizedLedger([tx('2026-01-10','GGRC11','BUY',10,9,1),tx('2026-03-02','GGRC11','SELL',4,12,0.40)], [{ticker:'GGRC11',type:'FII_TIJOLO'}],{year:2026});
 assert.equal(d.sales[0].gross,48);assert.equal(d.sales[0].allocatedCost,36.4);assert.equal(d.sales[0].gain,11.2);assert.equal(d.monthly[0].netResult,11.2);assert.equal('darf' in d,false);
});
test('year filtering preserves purchase cost from previous fiscal year',()=>{
 const d=realizedLedger([tx('2025-12-10','ABCD3','BUY',5,20),tx('2026-01-02','ABCD3','SELL',3,30)], [{ticker:'ABCD3',type:'ACAO'}],{year:2026});
 assert.equal(d.sales.length,1);assert.equal(d.sales[0].gain,30);
});
test('reports incomplete asset classification and potentially same-day daytrade',()=>{
 const d=realizedLedger([tx('2026-01-02','A1','BUY',5,5),tx('2026-01-02','A1','SELL',2,7)],[],{year:2026});
 assert.equal(d.sales[0].classificationComplete,false);assert.equal(d.sales[0].possibleDayTrade,true);assert(d.issues.some(x=>x.includes('Classifique')));
});

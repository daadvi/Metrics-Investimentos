/** Opt-in synthetic performance benchmark; no production wallet is loaded. */
import {performance} from 'node:perf_hooks';
import {qualityReport30} from '../src/metrics-quality-v30.mjs';
const N=Math.max(1000,Math.min(100000,Number(process.argv[2])||10000));
const tickers=Array.from({length:40},(_,i)=>'TEST'+String(i).padStart(3,'0'));
const day=i=>new Date(Date.UTC(2023,0,1)+i*86400000).toISOString().slice(0,10);
const transactions=Array.from({length:N},(_,i)=>({id:String(i),date:day(i%1350),ticker:tickers[i%40],type:'BUY',quantity:1,price:10,fee:0}));
const quotes=tickers.map(ticker=>({ticker,date:'2026-09-01',price:10,source:'SINTETICO'}));
const instruments=tickers.map(ticker=>({ticker,assetClass:'ACAO',currency:'BRL'}));
const start=performance.now(),result=qualityReport30({transactions,quotes,instruments,profiles:[]},{asOf:'2026-09-01'}),duration=performance.now()-start;
console.log(JSON.stringify({rows:N,positions:result.summary.positions,processingMs:+duration.toFixed(1),rssMiB:+(process.memoryUsage().rss/1024/1024).toFixed(1),synthetic:true},null,2));

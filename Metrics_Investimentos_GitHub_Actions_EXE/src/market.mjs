/** B3 COTAHIST fixed-width daily prices. Based on the public B3 layout (revision 2020).
 * Closing prices are not adjusted for splits or distributions; never labeled as real-time.
 */
import zlib from 'node:zlib';
import {tickerOf} from './domain.mjs';
const MAX_ROWS=180000;
const validDay=s=>/^\d{8}$/.test(s)&&Number.isFinite(Date.parse(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T12:00:00Z`));
function validZipEntry(bytes){
 if(bytes.length<22||bytes.readUInt32LE(0)!==0x04034b50)throw Error('ZIP de cotações inválido.');
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error('Diretório ZIP não encontrado.');
 const count=bytes.readUInt16LE(eocd+10);if(count!==1)throw Error('ZIP de COTAHIST deve conter um único TXT.');
 const at=bytes.readUInt32LE(eocd+16);if(at+46>bytes.length||bytes.readUInt32LE(at)!==0x02014b50)throw Error('ZIP danificado.');
 const method=bytes.readUInt16LE(at+10),packed=bytes.readUInt32LE(at+20),size=bytes.readUInt32LE(at+24),nameLen=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),off=bytes.readUInt32LE(at+42);
 const name=bytes.subarray(at+46,at+46+nameLen).toString('utf8');
 if(!/^COTAHIST[_A-Z0-9.\-]*\.TXT$/i.test(name)||!size||size>90*1024*1024||packed>24*1024*1024)throw Error('ZIP não contém COTAHIST em tamanho permitido.');
 if(off+30>bytes.length||bytes.readUInt32LE(off)!==0x04034b50)throw Error('ZIP incompleto.');
 const s=off+30+bytes.readUInt16LE(off+26)+bytes.readUInt16LE(off+28);
 if(s+packed>bytes.length)throw Error('Dados ZIP truncados.');
 const raw=bytes.subarray(s,s+packed);
 const uncompressed=method===0?raw:method===8?zlib.inflateRawSync(raw,{maxOutputLength:90*1024*1024}):null;
 if(!uncompressed||uncompressed.length!==size)throw Error('Compactação de COTAHIST inválida.');
 return uncompressed.toString('latin1');
}
export function parseCotahist(input,{wanted=[]}={}){
 const b=Buffer.isBuffer(input)?input:Buffer.from(input);
 if(b.length>24*1024*1024)throw Error('Arquivo supera 24 MB. Importe uma cotação diária ou mensal.');
 const raw=b.subarray(0,2).toString()==='PK'?validZipEntry(b):b.toString('latin1');
 const selected=new Set(wanted.map(tickerOf));const prices=new Map();let records=0,skipped=0;
 for(const line of raw.split(/\r?\n/)){
  if(!line||line.startsWith('00')||line.startsWith('99'))continue;
  if(!line.startsWith('01')||line.length<245){skipped++;continue;}
  if(++records>MAX_ROWS)throw Error('Arquivo extenso demais para importação local segura.');
  const rawDay=line.slice(2,10),ticker=line.slice(12,24).trim();const market=line.slice(24,27),close=line.slice(108,121);
  if(!validDay(rawDay)||market!=='010'||!/^\d{13}$/.test(close)||!close.match(/[1-9]/)||!ticker){skipped++;continue;}
  try{tickerOf(ticker);}catch{skipped++;continue;}
  if(selected.size&&!selected.has(ticker))continue;
  const date=`${rawDay.slice(0,4)}-${rawDay.slice(4,6)}-${rawDay.slice(6,8)}`;
  const price=Number(close)/100;
  if(price<=0||price>1e9)continue;
  const prev=prices.get(ticker);
  if(!prev||date>prev.date)prices.set(ticker,{ticker,price,date,source:'B3 COTAHIST (fechamento sem ajustes)'});
 }
 if(records===0)throw Error('Nenhuma linha COTAHIST de tipo 01 encontrada.');
 return {quotes:[...prices.values()].sort((a,b)=>a.ticker.localeCompare(b.ticker)),records,skipped,warning:'Fechamento histórico da B3, sem ajustes por desdobramentos ou dividendos. Não é cotação ao vivo.',source:'B3 COTAHIST'};
}
const ddmmyyyy=(date)=>`${String(date.getUTCDate()).padStart(2,'0')}${String(date.getUTCMonth()+1).padStart(2,'0')}${date.getUTCFullYear()}`;
async function readBounded(response,max){const chunks=[];let len=0;for await(const c of response.body){len+=c.length;if(len>max)throw Error('Arquivo da B3 excede o limite permitido.');chunks.push(c);}return Buffer.concat(chunks);}
/** User-initiated download only. Host is fixed and date is program-generated. */
export async function fetchRecentB3Prices({wanted=[],daysBack=8,now=new Date(),fetchImpl=fetch}={}){
 if(!Array.isArray(wanted)||!wanted.length)throw Error('Cadastre ativos antes de atualizar preços.');
 if(wanted.length>150)throw Error('Atualização limitada a 150 ativos por vez.');
 for(let shift=0;shift<daysBack;shift++){
  const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-shift));
  if([0,6].includes(d.getUTCDay()))continue;
  const url=`https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D${ddmmyyyy(d)}.ZIP`;
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),12000);
  try{
   const response=await fetchImpl(url,{signal:abort.signal,redirect:'error',headers:{'Accept':'application/zip'}});
   if(!response.ok)continue;
   const bytes=await readBounded(response,24*1024*1024);
   const result=parseCotahist(bytes,{wanted});
   if(result.quotes.length)return {...result,downloadedFrom:url};
  }catch(e){if(/tamanho|excede|extenso|limite/i.test(e.message))throw e;}finally{clearTimeout(timer);}
 }
 throw Error('Não foi possível baixar uma cotação diária válida da B3. Importe um arquivo COTAHIST oficial ou informe preços manualmente.');
}

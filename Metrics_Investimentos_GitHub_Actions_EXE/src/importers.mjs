import zlib from 'node:zlib';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const clean=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const field=(arr,names)=>arr.findIndex(x=>names.includes(clean(x)));
const amount=s=>{let t=String(s??'').trim().replace(/R\$|\s/g,'');if(t.includes(',')&&t.includes('.'))t=t.replace(/\./g,'').replace(',','.');else if(t.includes(','))t=t.replace(',','.');return Number(t)||0;};
const date=s=>{if(typeof s==='number'||/^\d{5}$/.test(String(s)))return new Date(Date.UTC(1899,11,30)+Number(s)*86400000).toISOString().slice(0,10);const t=String(s??'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(t))return t;const m=t.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:t;};
export function parseCSV(text){const lines=String(text).replace(/^\uFEFF/,'');const first=lines.split(/\r?\n/)[0]||'';const sep=[';',',','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];let rows=[],row=[],v='',quote=false;for(let i=0;i<lines.length;i++){const c=lines[i];if(c==='"'){if(quote&&lines[i+1]==='"'){v+='"';i++;}else quote=!quote;}else if(c===sep&&!quote){row.push(v);v='';}else if((c==='\r'||c==='\n')&&!quote){if(c==='\r'&&lines[i+1]==='\n')i++;row.push(v);if(row.some(s=>String(s).trim()))rows.push(row);row=[];v='';}else v+=c;}row.push(v);if(row.some(s=>String(s).trim()))rows.push(row);return rows;}
function unzip(buffer){
 // ZIP central directory, incluindo XLSX produzidos com data descriptors.
 const result=new Map(),maxEntries=150,maxTotal=50*1024*1024;let end=-1;
 for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--){if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}}
 if(end<0)throw new Error('XLSX ZIP inválido ou incompleto.');
 const count=buffer.readUInt16LE(end+10),dirStart=buffer.readUInt32LE(end+16);
 if(count>maxEntries||dirStart>=buffer.length)throw new Error('XLSX com entradas demais.');
 let pos=dirStart,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>buffer.length||buffer.readUInt32LE(pos)!==0x02014b50)throw new Error('Diretório ZIP inválido.');
  const method=buffer.readUInt16LE(pos+10),packed=buffer.readUInt32LE(pos+20),unpacked=buffer.readUInt32LE(pos+24),nameLen=buffer.readUInt16LE(pos+28),extraLen=buffer.readUInt16LE(pos+30),commentLen=buffer.readUInt16LE(pos+32),offset=buffer.readUInt32LE(pos+42);
  const name=buffer.subarray(pos+46,pos+46+nameLen).toString('utf8');pos+=46+nameLen+extraLen+commentLen;
  if(!['xl/sharedStrings.xml','xl/workbook.xml'].includes(name)&&!/^xl\/worksheets\/sheet\d+\.xml$/.test(name))continue;
  if(unpacked>20*1024*1024||packed>8*1024*1024||(total+=unpacked)>maxTotal)throw new Error('Conteúdo XLSX grande demais.');
  if(offset+30>buffer.length||buffer.readUInt32LE(offset)!==0x04034b50)throw new Error('Arquivo XLSX corrompido.');
  const localName=buffer.readUInt16LE(offset+26),localExtra=buffer.readUInt16LE(offset+28),start=offset+30+localName+localExtra;
  if(start+packed>buffer.length)throw new Error('Arquivo XLSX truncado.');
  const data=buffer.subarray(start,start+packed);
  const raw=method===0?data:method===8?zlib.inflateRawSync(data,{maxOutputLength:20*1024*1024}):null;
  if(!raw||raw.length!==unpacked)throw new Error('Compactação XLSX inválida.');
  result.set(name,raw.toString('utf8'));
 }
 return result;
}
const xmlText=s=>String(s).replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-F]+);/gi,entity=>({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[entity]??(entity.startsWith('&#')?String.fromCodePoint(parseInt(entity.slice(entity.startsWith('&#x')?3:2,-1),entity.startsWith('&#x')?16:10)):entity)));
const colIndex=c=>{let n=0;for(const x of c)n=n*26+x.charCodeAt(0)-64;return n-1;};
export function parseXLSX(bytes){const files=unzip(Buffer.from(bytes));const shared=[];for(const match of (files.get('xl/sharedStrings.xml')||'').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)){shared.push([...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(x=>xmlText(x[1])).join(''));}
 const sheets=[...files.entries()].filter(([name])=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name));if(!sheets.length)throw new Error('Planilha sem abas legíveis.');const all=[];
 for(const [name,xml] of sheets){const rows=[];for(const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){const cols=[];for(const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){const address=(cell[1].match(/\br="([A-Z]+)\d+"/)||[])[1];if(!address)continue;const i=colIndex(address);if(i>200)continue;const type=(cell[1].match(/\bt="([^"]+)"/)||[])[1];const raw=(cell[2].match(/<v>([\s\S]*?)<\/v>/)||[])[1];const inline=(cell[2].match(/<is>([\s\S]*?)<\/is>/)||[])[1];cols[i]=type==='s'?shared[Number(raw)]||'':inline!==undefined?xmlText(inline):raw!==undefined?xmlText(raw):'';}if(cols.some(v=>String(v??'').trim()))rows.push(cols.map(x=>x??''));if(rows.length>10000)break;}all.push({sheet:name.split('/').pop(),rows});}
 return all;
}
function transactionFromRow(h,row){const cols={date:['data','date','datamovimentacao'],ticker:['ticker','ativo','codigo','codigonegociacao','produto','nomeproduto'],type:['tipo','type','operacao','movimentacao','entradaesaida'],quantity:['quantidade','quantity','qtd'],price:['preco','precounitario','price','valorunitario','precounitario'],fee:['taxa','taxas','fee','custos','corretagem'],sum:['valor','valortotal','amount','provento','valordaoperacao','valordaoperacao'],description:['movimentacao','historico','descricao']};const idx=Object.fromEntries(Object.entries(cols).map(([k,a])=>[k,field(h,a)]));const get=k=>idx[k]<0?'':String(row[idx[k]]??'').trim();let t=clean(get('type')),desc=clean(get('description')),type='';if(/(dividendo|rendimento|jcp|jurossobrecapital|provento|amortizacao)/.test(t+' '+desc))type='DIVIDEND';else if(/compra|buy/.test(t+' '+desc))type='BUY';else if(/venda|sell/.test(t+' '+desc))type='SELL';else if(/^entrada$/.test(t)&&/compra|transferencia/.test(desc))type=/compra/.test(desc)?'BUY':'';else if(/^saida$/.test(t)&&/venda/.test(desc))type='SELL';if(!type)return null;
 const original=get('ticker').toUpperCase();const candidate=original.match(/(?:^|[^A-Z0-9])([A-Z]{3,6}\d{1,2}[A-Z]?)(?=$|[^A-Z0-9])/);const ticker=candidate?.[1]||original.split(/\s|-/)[0];if(!/^[A-Z0-9][A-Z0-9.\-^:]{0,23}$/.test(ticker))return null;
 const d=date(get('date')),qty=amount(get('quantity')),price=amount(get('price')),sum=amount(get('sum'));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return null;
 if(type==='DIVIDEND'){if(sum<=0)return null;return {date:d,ticker,type,amount:sum,source:'b3'};}
 if(qty<=0||(price<=0&&sum<=0))return null;return {date:d,ticker,type,quantity:qty,price:price||sum/qty,fee:amount(get('fee')),source:'b3'};
}
export function interpretTables(tables){const operations=[],unrecognized=[],sheets=[];for(const {sheet,rows} of tables){let head=-1;for(let i=0;i<Math.min(rows.length,18);i++){const cols=rows[i].map(clean);if(cols.some(x=>['data','date','datamovimentacao'].includes(x)) && cols.some(x=>['ticker','ativo','produto','codigo','codigonegociacao'].includes(x))){head=i;break;}}if(head<0){sheets.push({sheet,status:'Sem cabeçalho reconhecido',rows:rows.length});continue;}let read=0;for(let i=head+1;i<rows.length;i++){const row=rows[i],r=transactionFromRow(rows[head],row);if(r){operations.push(r);read++;}else if(row.some(x=>String(x).trim()))unrecognized.push(`${sheet}: linha ${i+1}`);}sheets.push({sheet,status:`${read} lançamentos`,rows:rows.length-head-1});}
 return {operations,unrecognized:unrecognized.slice(0,80),unrecognizedTotal:unrecognized.length,sheets};}
export function extractPDF(bytes){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'metrics-pdf-'));const input=path.join(dir,'documento.pdf');try{if(Buffer.from(bytes).subarray(0,5).toString()!=='%PDF-')throw new Error('Arquivo PDF inválido.');fs.writeFileSync(input,bytes,{mode:0o600});const result=spawnSync('pdftotext',['-layout',input,'-'],{encoding:'utf8',timeout:12000,maxBuffer:1024*1024*2});if(result.error?.code==='ENOENT')throw new Error('Leitura de PDF requer a ferramenta pdftotext. Instale poppler-utils ou use XLSX.');if(result.status!==0)throw new Error('Não foi possível extrair texto do PDF. Arquivos digitalizados sem texto não são suportados.');return result.stdout.slice(0,400000);}finally{fs.rmSync(dir,{recursive:true,force:true});}}

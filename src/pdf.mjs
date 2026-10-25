/** PDF.js gives a Windows-portable PDF reader without Poppler/pdftotext.
 * Keep a local Poppler fallback for environments that have it installed.
 * No OCR: scanned/image-only documents require a separate opt-in workflow.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validDate} from './domain.mjs';

const MAX_BYTES=12*1024*1024,MAX_PAGES=90,MAX_CHARS=700000;
const dateFromBR=s=>{const m=String(s).match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
const parseBrazilianNumber=s=>{let text=String(s).trim().replace(/^R\$\s*/, '').replace(/\s/g,'');
 if(!text)return null;
 if(text.includes(','))text=text.replace(/\./g,'').replace(',','.');
 else if(/^\d{1,3}(?:\.\d{3})+$/.test(text))text=text.replace(/\./g,'');
 const n=Number(text);return Number.isFinite(n)?n:null;
};

async function extractWithPdfJs(bytes){
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 // The worker is shipped with pdfjs-dist as a production dependency.
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',import.meta.url).href;
 const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false,disableFontFace:true});
 const pdf=await task.promise;
 try{
  if(pdf.numPages>MAX_PAGES)throw Error(`PDF com ${pdf.numPages} páginas; limite de ${MAX_PAGES}.`);
  let text='';
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
   const page=await pdf.getPage(pageNo),items=(await page.getTextContent()).items;
   const rows=[];
   for(const item of items){if(typeof item.str!=='string'||!item.str.trim())continue;
    const y=Math.round((item.transform?.[5]||0)*2)/2,x=item.transform?.[4]||0;
    let row=rows.find(r=>Math.abs(r.y-y)<2.5);if(!row){row={y,items:[]};rows.push(row);}
    row.items.push({x,str:item.str});
   }
   rows.sort((a,b)=>b.y-a.y);text+=`\n[Página ${pageNo}]\n`+rows.map(r=>r.items.sort((a,b)=>a.x-b.x).map(x=>x.str).join('  ')).join('\n')+'\n';
   if(text.length>MAX_CHARS)throw Error('PDF possui texto excessivamente longo.');
  }
  return {text,pages:pdf.numPages,reader:'Mozilla PDF.js'};
 }finally{await pdf.destroy();}
}
function fallbackPoppler(bytes){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'metrics-pdf-'));const input=path.join(dir,'documento.pdf');
 try{fs.writeFileSync(input,bytes,{mode:0o600});const result=spawnSync('pdftotext',['-layout',input,'-'],{encoding:'utf8',timeout:20000,maxBuffer:MAX_CHARS*3});
  if(result.error||result.status!==0)throw Error('PDF.js indisponível e o leitor de PDF alternativo não funcionou.');
  return {text:result.stdout.slice(0,MAX_CHARS),pages:null,reader:'Poppler local'};
 }finally{fs.rmSync(dir,{force:true,recursive:true});}
}
export async function readPdf(bytes){const buffer=Buffer.from(bytes);
 if(buffer.length>MAX_BYTES)throw Error('PDF grande demais (máximo de 12 MB).');
 if(buffer.subarray(0,5).toString()!=='%PDF-')throw Error('Arquivo não é um PDF válido.');
 let result;
 try{result=await extractWithPdfJs(buffer);}catch(err){
  try{result=fallbackPoppler(buffer);}catch{
   throw Error(`Não foi possível ler o PDF: ${String(err.message||err).slice(0,190)}. Confira se o arquivo está protegido ou digitalizado.`);
  }
 }
 if(result.text.trim().length<25)throw Error('Este PDF não contém texto extraível suficiente. Se for digitalizado, exporte o relatório em Excel ou envie um PDF com texto pesquisável.');
 return result;
}

/** Conservative parser for positions in B3 statement PDFs.
 * Positions have no trade date or tax purchase price; NEVER convert to BUY.
 */
export function parseB3CustodyText(text){
 const lines=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const full=lines.join(' ').toLocaleLowerCase('pt-BR');
 const likelyStatement=/(?:relat[oó]rio consolidado|extrato de posi[cç][aã]o|posi[cç][aã]o em|minha carteira|cust[oó]dia|quantidade)/i.test(full);
 const dates=[];
 for(const line of lines.slice(0,140)){
  if(/(?:posi[cç][aã]o|data.base|refer[eê]ncia|per[ií]odo|atualizado em|data do extrato)/i.test(line)){
   for(const found of line.matchAll(/\b\d{2}[\/.-]\d{2}[\/.-]\d{4}\b/g)){
    const d=dateFromBR(found[0]);if(validDate(d))dates.push(d);
   }
  }
 }
 const unique=new Map(),review=[];
 if(likelyStatement){
  let collecting=true,foundTable=false;
  for(let i=0;i<lines.length;i++){
   const lower=lines[i].toLocaleLowerCase('pt-BR');
   if(/(?:^|\s)(?:posi[cç][aã]o|cust[oó]dia|quantidade|a[cç][oõ]es|fundos imobili[aá]rios)(?:\s|$)/i.test(lower)){
    if(/(?:posi[cç][aã]o|cust[oó]dia|quantidade)/i.test(lower)){collecting=true;foundTable=true;}
   }
   if(/^(?:proventos(?: recebidos)?|rendimentos recebidos|negocia[cç][oõ]es|movimenta[cç][oõ]es|hist[oó]rico de pagamentos|pagamentos efetuados)\b/i.test(lower))collecting=false;
   if(!collecting||(!foundTable&&i>40))continue;

   const line=lines[i].replace(/\u00a0/g,' ');
   if(/^(?:total|subtotal|resumo|provento|movimenta[cç][aã]o)/i.test(line))continue;
   const match=line.match(/(?:^|\s)([A-Z]{4}\d{1,2}[A-Z]?)(?=\s|$)/);
   if(!match)continue;
   const ticker=match[1],rest=line.slice(match.index+match[0].length);
   // Common layouts: TICKER  NOME DO ATIVO  QTD  PREÇO UNITÁRIO  VALOR TOTAL
   const tokens=[...rest.matchAll(/(?:R\$\s*)?\d+(?:\.\d{3})*(?:,\d+)?/g)].map(x=>({raw:x[0],value:parseBrazilianNumber(x[0])})).filter(x=>x.value!==null);
   if(!tokens.length)continue;
   let qty=null,price=null,confidence='revisar';
   if(tokens.length>=3){
    const last=tokens.slice(-3),[a,b,c]=last.map(x=>x.value);
    if(a>0&&a<1e10&&b>0&&c>0&&Math.abs(a*b-c)/Math.max(c,1)<0.1){qty=a;price=b;confidence='inferido_por_valores';}
   }
   if(qty===null){
    // Without monetary cross-check, accept a single plausible quantity only with review.
    const possible=tokens.find(x=>x.value>0&&Number.isFinite(x.value)&&x.value<1e9&&!x.raw.includes('R$'));
    if(possible){qty=possible.value;confidence='revisar_quantidade';}
   }
   if(qty===null)continue;
   if(unique.has(ticker)){review.push(`Ativo ${ticker} repetido no PDF; confira as instituições/posições e consolide manualmente.`);continue;}
   unique.set(ticker,{ticker,quantity:qty,referencePrice:price,confidence,line:i+1});
  }
 }
 const warnings=[];
 if(!likelyStatement)warnings.push('O arquivo não foi identificado como relatório de posição; será importado apenas como documento.');
 if(!dates.length)warnings.push('Data-base da posição não identificada; informe-a antes de salvar.');
 if([...unique.values()].some(x=>x.confidence==='revisar_quantidade'))warnings.push('Algumas quantidades foram inferidas sem validar valor total; confirme-as antes de importar.');
 warnings.push(...review.slice(0,12));
 warnings.push('Extrato de posição NÃO contém necessariamente preço médio fiscal ou histórico de compras. Nenhuma compra será criada automaticamente.');
 return {kind:unique.size?'positions':'document',asOf:dates.at(-1)||null,positions:[...unique.values()],warnings,detected:likelyStatement};
}

/** Strict B3 negotiation statement reader. Only trade rows explicitly marked COMPRA/VENDA.
 * Custody reports with quantities NEVER become transactions. Trade fees not available in
 * the source are marked as missing and must be reconciled with broker notes.
 */
export function parseB3NegotiationText(text){
 const lines=String(text??'').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const header=lines.findIndex(x=>/data\s+(?:do\s+)?neg[oó]cio|data\s+(?:da\s+)?negocia[cç][aã]o/i.test(x)&&/movimenta[cç][aã]o|compra|venda|pre[cç]o|c[oó]digo/i.test(x));
 if(header<0)return {kind:'document',operations:[],unrecognized:[],reason:'Nenhum cabeçalho inequívoco de negociação foi encontrado. Extrato de posição não indica data e preço de compra.'};
 const operations=[],unrecognized=[];
 const number=s=>{let v=String(s||'').replace(/R\$|\s/g,'');if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');return Number(v);};
 for(let i=header+1;i<lines.length;i++){
  const line=lines[i];if(/^\[P[aá]gina|^Total\b/i.test(line))continue;
  const d=line.match(/^(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})\s+/);if(!d)continue;
  const date=`${d[3]}-${d[2]}-${d[1]}`;if(!validDate(date))continue;
  const direction=line.match(/\b(Compra|Venda)\b/i);
  const ticker=line.match(/\b([A-Z]{4,6}\d{1,2}[A-Z]?)\b/);
  if(!direction||!ticker){unrecognized.push({line:i+1,reason:'Sem operação e ticker inequívocos'});continue;}
  const tail=line.slice(line.indexOf(ticker[0])+ticker[0].length);
  // Require three numeric columns: quantity, unit price, gross consideration.
  const items=(tail.match(/\b\d[\d.,]*\b/g)||[]);
  if(items.length<3){unrecognized.push({line:i+1,reason:'Faltam quantidade, preço e valor bruto'});continue;}
  const [quantity,price,gross]=items.slice(-3).map(number);
  if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(price)||price<=0||!Number.isFinite(gross)||gross<=0){unrecognized.push({line:i+1,reason:'Número inválido'});continue;}
  if(Math.abs(quantity*price-gross)>Math.max(.05,gross*.005)){unrecognized.push({line:i+1,reason:'Preço x quantidade não confere com o bruto'});continue;}
  operations.push({date,ticker:ticker[0],type:direction[0].toLowerCase()==='compra'?'BUY':'SELL',quantity,price,fee:0,source:'b3',notes:'Importado de relatório de negociação; custos e taxas da nota de corretagem NÃO informados: conferir.'});
 }
 return {kind:operations.length?'transactions':'document',operations,unrecognized,unrecognizedTotal:unrecognized.length,reason:operations.length?'Operações com data e preço explícitos. Conferir notas de corretagem para taxas, IRRF e eventos.':'Nenhuma operação de compra/venda segura foi identificada.'};
}

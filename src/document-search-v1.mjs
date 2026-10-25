/** Search in investor-provided documents without uploading them or loading native extensions.
 * BM25-inspired lexical ranking. Citations identify document and original character offset.
 * Semantic embeddings are optional future work, not required to inspect the user's portfolio.
 */
const stopWords=new Set(['para','esse','qual','quais','como','sobre','isso','carteira','investidor','investimentos','relatorio','documento','dados','fundo','fii','mais','menor','maior','este','esse','esta','essa','pelo','pelas','pelos']);
const normalize=s=>String(s||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const tokens=s=>(normalize(s).match(/[a-z0-9]{3,}/g)||[]).filter(x=>!stopWords.has(x));
const termFreq=arr=>{const counts=new Map();for(const t of arr)counts.set(t,(counts.get(t)||0)+1);return counts;};
export function searchDocuments(docs,query,{limit=4,excerptLength=4500}={}){
 if(!Array.isArray(docs)||docs.length>10000||typeof query!=='string'||query.length>2000)return [];
 const queryTerms=[...new Set(tokens(query))].slice(0,35);if(!queryTerms.length)return [];
 const chunks=[];const termInDocuments=new Map();
 for(const doc of docs){if(!doc||typeof doc.text!=='string'||!doc.text.trim())continue;
  const title=normalize([doc.title,doc.ticker,doc.source].join(' '));
  for(let offset=0;offset<doc.text.length;offset+=1200){
   const excerpt=doc.text.slice(offset,offset+1800),terms=termFreq(tokens(excerpt)),matches=queryTerms.filter(w=>terms.has(w)||title.includes(w));
   if(!matches.length)continue;
   const chunk={doc,title,terms,offset,excerpt,len:Math.max(1,tokens(excerpt).length),matches};chunks.push(chunk);
   for(const w of new Set(terms.keys()))if(queryTerms.includes(w))termInDocuments.set(w,(termInDocuments.get(w)||0)+1);
   if(chunks.length>5000)break;
  }
 }
 if(!chunks.length)return [];
 const average=chunks.reduce((s,c)=>s+c.len,0)/chunks.length;
 const scores=chunks.map(chunk=>{
  let score=0;
  for(const w of queryTerms){const tf=chunk.terms.get(w)||0,df=termInDocuments.get(w)||0;
   const idf=Math.log(1+(chunks.length-df+0.5)/(df+0.5));
   if(tf)score+=idf*(tf*2.2)/(tf+1.2*(0.25+0.75*chunk.len/average));
   if(chunk.title.includes(w))score+=2.8;
  }
  if(chunk.doc.ticker&&normalize(query).includes(normalize(chunk.doc.ticker)))score+=5;
  return {id:chunk.doc.id||null,title:chunk.doc.title||'Documento sem título',ticker:chunk.doc.ticker||null,source:chunk.doc.source||'Usuário',referenceDate:chunk.doc.referenceDate||null,offset:chunk.offset,excerpt:chunk.excerpt.slice(0,Math.max(300,Math.min(4500,excerptLength))),score:Number(score.toFixed(4))};
 });
 return scores.filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.offset-b.offset).slice(0,Math.min(10,Math.max(1,limit)));
}
export function citedExcerpts(results){return results.map((x,i)=>`[TRECHO ${i+1}: Documento: ${x.title}; ticker ${x.ticker||'não identificado'}; fonte DECLARADA: ${x.source}; data-base ${x.referenceDate||'não informada'}; início no caractere ${x.offset}. Documento fornecido pelo usuário, NÃO verificado automaticamente.]\n${x.excerpt}\n[FIM TRECHO ${i+1}]`).join('\n\n');}

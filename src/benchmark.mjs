/** Banco Central SGS series 12: CDI daily, percentages per business day. */
import {validDate} from './domain.mjs';
const BR=d=>d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4);
export function parseBCBCDI(rows){
 if(!Array.isArray(rows))throw Error('Resposta do Banco Central inválida.');
 const out=[];for(const x of rows){const br=String(x.data||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!br)continue;
  const date=`${br[3]}-${br[2]}-${br[1]}`;const rate=Number(String(x.valor||'').replace(',','.'));
  if(!validDate(date)||!Number.isFinite(rate)||rate< -5||rate>20)continue;out.push({date,rate});
 }
 return out.sort((a,b)=>a.date.localeCompare(b.date));
}
export async function fetchBCBCDI({from,to,fetchImpl=fetch}={}){
 if(!validDate(from)||!validDate(to)||from>to)throw Error('Período inválido.');
 const start=Date.parse(from+'T12:00:00Z'),end=Date.parse(to+'T12:00:00Z');
 if((end-start)/86400000>3660)throw Error('Limite de consulta: 10 anos.');
 const url='https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial='+encodeURIComponent(BR(from))+'&dataFinal='+encodeURIComponent(BR(to));
 const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),15000);
 try{const r=await fetchImpl(url,{signal:ac.signal,redirect:'error',headers:{Accept:'application/json'}});if(!r.ok)throw Error('Banco Central indisponível (HTTP '+r.status+').');
  const raw=await r.text();if(raw.length>2000000)throw Error('Resposta CDI muito longa.');const data=parseBCBCDI(JSON.parse(raw));if(!data.length)throw Error('Não há valores CDI no período.');return {data,source:'Banco Central, SGS série 12 (CDI diário)',url};
 }finally{clearTimeout(timer);}
}
/** BCB SGS 433: percentage monthly IPCA series. */
export async function fetchBCBIPCA({from,to,fetchImpl=fetch}={}){
 if(!validDate(from)||!validDate(to)||from>to)throw Error('Período IPCA inválido.');
 if((Date.parse(to)-Date.parse(from))/86400000>3660)throw Error('Consulte no máximo dez anos por vez.');
 const url='https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial='+encodeURIComponent(BR(from))+'&dataFinal='+encodeURIComponent(BR(to));
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),15000);
 try{const r=await fetchImpl(url,{signal:ac.signal,redirect:'error',headers:{Accept:'application/json'}});if(!r.ok)throw Error('SGS IPCA indisponível (HTTP '+r.status+').');
  const raw=await r.text();if(raw.length>300000)throw Error('Resposta IPCA muito longa.');const data=parseBCBCDI(JSON.parse(raw));if(!data.length)throw Error('Nenhum índice IPCA publicado no período.');
  return {data,source:'Banco Central, SGS 433 (IPCA variação mensal)',url};
 }finally{clearTimeout(timer);}
}

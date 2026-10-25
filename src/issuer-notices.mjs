/** Provenance-first notices: recorded disclosures, never self-verified official statements. */
import {validDate,tickerOf} from './domain.mjs';
export function validateNotice(raw){
 const ticker=tickerOf(raw.ticker),date=String(raw.date||'');if(!validDate(date))throw Error('Data da notícia inválida.');
 const title=String(raw.title||'').trim();if(title.length<5||title.length>200)throw Error('Título da comunicação inválido.');
 const source=String(raw.source||'').trim();if(source.length<3||source.length>120)throw Error('Informe a fonte da notícia.');
 const url=String(raw.url||'').trim();if(url){let u;try{u=new URL(url);}catch{throw Error('URL de fonte inválida.');}if(u.protocol!=='https:'||u.username||u.password||url.length>1500)throw Error('Fonte deve ser URL HTTPS sem credenciais.');}
 return {ticker,date,title,source,url,category:['DIVIDEND','EARNINGS','CORPORATE','RISK','OTHER'].includes(String(raw.category||''))?String(raw.category):'OTHER',notes:String(raw.notes||'').slice(0,800),verifiedAutomatically:false};
}

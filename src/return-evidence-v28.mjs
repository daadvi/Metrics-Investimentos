/** Evidence-bound TWR and XIRR with explicit flow boundaries. Never a tax calculation. */
const cents=x=>Math.round((x+Number.EPSILON)*100)/100;
const epoch=s=>Date.parse(s+'T00:00:00Z');
const day=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(epoch(s))&&new Date(epoch(s)).toISOString().slice(0,10)===s;
export function validatePortfolioValuation28(raw){
 const date=String(raw?.date||''),phase=String(raw?.phase||''),amountBRL=Number(raw?.amountBRL),source=String(raw?.source||'').trim(),documentHash=String(raw?.documentHash||'').toLowerCase();
 if(!day(date)||!['EOD','PRE_FLOW','POST_FLOW'].includes(phase)||!Number.isFinite(amountBRL)||amountBRL<0||amountBRL>1e13||source.length<8||source.length>180||!/^([a-f0-9]{64})$/.test(documentHash))throw Error('Avaliação exige data, fase, BRL, fonte e SHA-256 do documento.');
 return {date,phase,amountBRL:cents(amountBRL),source,documentHash,authenticity:'INFORMADO_PELO_USUARIO',createdAt:new Date().toISOString()};
}
const asFlow=f=>{const v=Number(f.amount);return {date:f.date,type:f.type,amount:v,currency:String(f.currency||'BRL').toUpperCase(),source:String(f.source||'')};};
function compatibleFlows(flows,start,end){const selected=flows.map(asFlow).filter(x=>x.date>start&&x.date<=end);for(const f of selected){if(!day(f.date)||!['DEPOSIT','WITHDRAW'].includes(f.type)||!Number.isFinite(f.amount)||f.amount<=0||f.currency!=='BRL'||f.source.length<4)return {error:'Fluxos não documentados ou em moeda estrangeira sem câmbio efetivo.',selected};}return {selected};}
function xnpv(flows,rate){const zero=epoch(flows[0].date);return flows.reduce((sum,x)=>sum+x.amount/Math.pow(1+rate,(epoch(x.date)-zero)/86400000/365),0);}
export function solveXirr28(flows){
 if(!Array.isArray(flows)||flows.length<2||!flows.some(x=>x.amount<0)||!flows.some(x=>x.amount>0))return null;
 const list=[...flows].sort((a,b)=>a.date.localeCompare(b.date));if(list.some(x=>!day(x.date)||!Number.isFinite(x.amount)))return null;
 // Detect multiple roots before using bisection. No arbitrary guess or annualization of tiny windows.
 const grid=[-0.9999,-0.999,-0.99,-0.95,-0.9,-0.75,-0.5,-0.25,-0.1,-0.01,0,0.01,0.05,0.1,0.25,0.5,1,2,4,8,16,32,64,128,256,512,1024];
 let intervals=[];for(let i=1;i<grid.length;i++){const l=xnpv(list,grid[i-1]),r=xnpv(list,grid[i]);if(Number.isFinite(l)&&Number.isFinite(r)&&(l===0||r===0||Math.sign(l)!==Math.sign(r)))intervals.push([grid[i-1],grid[i]]);}
 if(intervals.length!==1)return null;let [left,right]=intervals[0],fl=xnpv(list,left);
 for(let i=0;i<160;i++){const mid=(left+right)/2,v=xnpv(list,mid);if(!Number.isFinite(v))return null;if(Math.abs(v)<1e-7||right-left<1e-12)return Number((mid*100).toFixed(6));if(Math.sign(v)===Math.sign(fl)){left=mid;fl=v;}else right=mid;}
 return Number(((left+right)/2*100).toFixed(6));
}
export function performanceEvidence28(db,{start,end}={}){
 if(!day(start)||!day(end)||start>=end)throw Error('Datas inválidas para retorno.');
 const vals=(db.portfolioValuationsV28||[]).filter(x=>x.date>=start&&x.date<=end),review=(db.statementReviewsV28||[]).filter(x=>x.reconciledByUser&&x.from<=start&&x.to>=end);
 const blocker=[];if(!review.length)blocker.push('Sem conciliação de extratos cobrindo todo o período.');
 const map=new Map();for(const x of vals){const value=validatePortfolioValuation28(x),k=value.date+'|'+value.phase;if(map.has(k))blocker.push('Avaliação duplicada: '+k);else map.set(k,value);}
 const open=map.get(start+'|EOD'),close=map.get(end+'|EOD');if(!open||!close)blocker.push('Avaliações EOD de início e fim ausentes.');
 const cash=compatibleFlows(db.externalFlows||[],start,end);if(cash.error)blocker.push(cash.error);
 if(cash.selected?.some(x=>x.date===end))blocker.push('Fluxo na data de encerramento: escolha o dia seguinte como fechamento para separar pós-fluxo.');
 const byDay=new Map();for(const f of cash.selected||[]){if(!byDay.has(f.date))byDay.set(f.date,[]);byDay.get(f.date).push(f);}
 for(const d of byDay.keys()){if(!map.has(d+'|PRE_FLOW')||!map.has(d+'|POST_FLOW'))blocker.push('Avaliações antes/depois de fluxo ausentes: '+d);}
 if(blocker.length)return {start,end,twrPercent:null,xirrPercent:null,status:'INCOMPLETE_EVIDENCE',blockers:blocker,source:'Registros locais declarados pelo usuário',reviewedByProfessional:false};
 let prev=open.amountBRL,growth=1;const periods=[];
 for(const [date,fs] of [...byDay.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
  const pre=map.get(date+'|PRE_FLOW').amountBRL,post=map.get(date+'|POST_FLOW').amountBRL,net=cents(fs.reduce((s,f)=>s+(f.type==='DEPOSIT'?f.amount:-f.amount),0));
  if(Math.abs(cents(post-pre)-net)>0.02)blocker.push('Diferença entre posição antes/depois e fluxo líquido em '+date);
  if(prev<=0){blocker.push('Base nula entre subperíodos em '+date);continue;}
  const rate=pre/prev-1;if(!Number.isFinite(rate)||rate<=-1)blocker.push('Retorno não utilizável em '+date);else{growth*=1+rate;periods.push({end:date,returnPercent:Number((rate*100).toFixed(5))});}prev=post;
 }
 if(prev<=0)blocker.push('Base inicial do último subperíodo inválida.');
 else{const last=close.amountBRL/prev-1;if(!Number.isFinite(last)||last<=-1)blocker.push('Retorno final inválido.');else{growth*=1+last;periods.push({end,returnPercent:Number((last*100).toFixed(5))});}}
 if(blocker.length)return {start,end,twrPercent:null,xirrPercent:null,status:'INCONSISTENT_EVIDENCE',blockers:blocker,reviewedByProfessional:false};
 const irrFlows=[{date:start,amount:-open.amountBRL},...cash.selected.map(f=>({date:f.date,amount:(f.type==='DEPOSIT'?-1:1)*f.amount})),{date:end,amount:close.amountBRL}];
 return {start,end,status:'RECONCILED_BY_USER',twrPercent:Number(((growth-1)*100).toFixed(6)),xirrPercent:solveXirr28(irrFlows),periods,flows:cash.selected.length,statementReviewCount:review.length,blockers:[],method:'TWR_BY_EXTERNAL_FLOW_BOUNDARIES_AND_XIRR',reviewedByProfessional:false,warning:'Conciliação declarada pelo investidor, não autenticada por instituição ou especialista. XIRR pode ser indisponível quando não há raiz única.'};
}


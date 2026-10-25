/** Tax preparation dossier: evidence and gaps, not tax liability or a filed return. */
import {validDate,tickerOf,calculatePositions} from './domain.mjs';
import {realizedLedger} from './tax.mjs';
import {fixedIncomePosition} from './instrument-classes.mjs';
import {foreignPositions} from './foreign-ledger.mjs';
const cent=n=>Number(Number(n).toFixed(2));
export const EVIDENCE_NATURES=Object.freeze(['DIVIDEND','JCP','FII_INCOME','AMORTIZATION','FIXED_INCOME','FOREIGN_INCOME','WITHHOLDING','OTHER']);
export function validateTaxEvidence(input){
 const year=Number(input.year);if(!Number.isInteger(year)||year<2000||year>2200)throw Error('Ano-calendário fiscal inválido.');
 const ticker=tickerOf(input.ticker),nature=String(input.nature||'').toUpperCase();if(!EVIDENCE_NATURES.includes(nature))throw Error('Natureza fiscal inválida.');
 const amount=Number(input.amount);if(!Number.isFinite(amount)||amount<0||amount>1e12)throw Error('Valor fiscal inválido.');
 const source=String(input.source||'').trim();if(source.length<5||source.length>200)throw Error('Informe identificador do documento de origem.');
 const referenceDate=input.referenceDate?String(input.referenceDate):null;if(referenceDate&&!validDate(referenceDate))throw Error('Data-base inválida.');
 return {year,ticker,nature,amount:cent(amount),source,referenceDate,notes:String(input.notes||'').slice(0,350),origin:'DECLARADO_PELO_USUARIO',documentHash:String(input.documentHash||'').slice(0,128),verified:false};
}
function natureMap(t,profiles){return t.type==='DIVIDEND'?(profiles?.some(p=>p.ticker===t.ticker&&String(p.type||'').startsWith('FII_'))?'FII_INCOME':'DIVIDEND'):t.type==='JCP'?'JCP':t.type==='AMORTIZATION'?'AMORTIZATION':null;}
export function taxDossier(db,year){
 const y=Number(year);if(!Number.isInteger(y)||y<2000||y>2200)throw Error('Ano-calendário inválido.');
 const ledger=realizedLedger(db.transactions||[],db.profiles||[],{year:String(y)});
 const entries=(db.taxEvidence||[]).filter(x=>x.year===y).map(x=>({...x,verified:false}));
 const trades=(db.transactions||[]).filter(t=>t.date.startsWith(String(y)));
 const recorded=new Map();for(const t of trades){const n=natureMap(t,db.profiles);if(!n)continue;const key=t.ticker+'|'+n;recorded.set(key,cent((recorded.get(key)||0)+t.amount));}
 const proof=new Map();for(const e of entries){const key=e.ticker+'|'+e.nature;proof.set(key,cent((proof.get(key)||0)+e.amount));}
 const keys=[...new Set([...recorded.keys(),...proof.keys()])].sort();
 const discrepancies=keys.map(k=>{const [ticker,nature]=k.split('|'),reported=recorded.get(k)??null,documented=proof.get(k)??null;return {ticker,nature,registered:reported,informedByEvidence:documented,difference:reported===null||documented===null?null:cent(reported-documented),status:reported===null?'SEM_LANCAMENTO':documented===null?'SEM_INFORME':Math.abs(reported-documented)<=0.01?'CONCILIADO_ARITMETICAMENTE':'DIVERGENTE'};});
 const statement=(db.snapshots||[]).filter(x=>x.asOf===`${y}-12-31`).at(-1)||null;
 let positions=[],positionDiscrepancies=[];try{positions=calculatePositions((db.transactions||[]).filter(t=>t.date<=`${y}-12-31`)).filter(x=>x.quantity>0);}catch{}
 if(statement){const positionsMap=new Map(positions.map(x=>[x.ticker,x.quantity]));const snapMap=new Map(statement.positions.map(x=>[x.ticker,x.quantity]));for(const key of new Set([...positionsMap.keys(),...snapMap.keys()])){const a=positionsMap.get(key),b=snapMap.get(key);if(a===undefined||b===undefined||Math.abs(a-b)>1e-8)positionDiscrepancies.push({ticker:key,registered:a??null,statement:b??null});}}
 const cutoff=`${y}-12-31`;
 // A year-end dossier must NEVER use redemptions or foreign trades from later years.
 const otherAssets=(db.fixedIncome||[]).filter(x=>x.startDate<=cutoff).map(x=>{
  const p=fixedIncomePosition(x,{asOf:cutoff});
  return {ticker:p.ticker,currency:p.currency,principalOriginal:p.principal,remainingPrincipal:p.remainingPrincipal,kind:p.rateKind,maturityDate:p.maturityDate,estimatedGrossNotTaxValue:p.estimatedContractGross,requiresInstitutionStatement:true,warning:p.warning};
 }).filter(x=>x.remainingPrincipal>0);
 const foreignInstruments=(db.instruments||[]).filter(x=>x.currency!=='BRL'||x.assetClass.includes('FOREIGN'));
 let foreignLedger=[];try{foreignLedger=foreignPositions((db.foreignTrades||[]).filter(x=>x.date<=cutoff)).filter(x=>x.quantity>0);}catch{};
 const foreign=foreignInstruments.map(x=>({ticker:x.ticker,assetClass:x.assetClass,currency:x.currency,registeredOnly:true}));
 const foreignAssets=[...foreign,...foreignLedger.map(x=>({ticker:x.ticker,assetClass:'OPERACAO_INTERNACIONAL',currency:x.currency,quantity:x.quantity,source:'Operações até 31/12',registeredOnly:false}))];
 const blockers=[];if(!statement)blockers.push('Ausência de extrato/custódia de 31/12 para conciliação de quantidades.');if(positionDiscrepancies.length)blockers.push('Divergência entre extrato de 31/12 e posições calculadas.');if(discrepancies.some(x=>x.status!=='CONCILIADO_ARITMETICAMENTE'))blockers.push('Informe de rendimentos divergente ou ausente.');if(trades.some(x=>['BUY','SELL'].includes(x.type)&&!x.fee))blockers.push('Custos/taxas zero ou desconhecidos exigem conferência nas notas.');if(trades.some(x=>['BONUS','SPLIT','REVERSE_SPLIT','AMORTIZATION'].includes(x.type)))blockers.push('Eventos corporativos/amortizações exigem validação do tratamento fiscal.');if(foreignAssets.length)blockers.push('Ativos e rendimentos internacionais: regras fiscais, conversão e documentos específicos não apurados automaticamente.');if(otherAssets.length)blockers.push('Renda fixa: informe da instituição e IR retido precisam ser conciliados.');blockers.push('Histórico de prejuízos anteriores, day trade, IRRF e tributação por modalidade não foram totalmente auditados.');
 return {year:y,ledger,positions,statementDate:statement?.asOf||null,positionDiscrepancies,otherAssets,foreignAssets,incomeDiscrepancies:discrepancies,evidenceCount:entries.length,blockers,readyForFiling:false,officialTool:'https://www.gov.br/pt-br/servicos/apurar-imposto-sobre-renda-variavel',disclaimer:'Conferência auxiliar; o Metrics não afirma imposto devido, não gera DARF e não fornece valores certificados para declaração. Compare os informes oficiais e consulte profissional habilitado quando necessário.'};
}

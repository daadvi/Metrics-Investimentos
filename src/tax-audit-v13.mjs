/** Conservative month-by-month tax workpaper. Never an amount ready to file or a DARF.
 * Uses independently reconstructed cashflows; completeness conditions must be checked by a person.
 */
import {realizedLedger} from './tax.mjs';
import {taxDossier} from './tax-dossier.mjs';
import {dataCoverage} from './dividend-reconciliation.mjs';
const fix=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
export function taxWorkpaper(db,year){
 const y=Number(year);if(!Number.isInteger(y)||y<2000||y>2200)throw Error('Ano fiscal inválido.');
 const ledger=realizedLedger(db.transactions||[],db.profiles||[],{year:String(y)}),dossier=taxDossier(db,y),byMonth=new Map();
 for(const s of ledger.sales){
  const month=s.month,classification=s.isFii?'FII':s.isStock?'ACAO':'NAO_CLASSIFICADO',key=month+'|'+classification;
  const row=byMonth.get(key)||{month,classification,grossSales:0,realizedResult:0,fees:0,trades:0,possibleDayTrade:false};
  row.grossSales=fix(row.grossSales+s.gross);row.realizedResult=fix(row.realizedResult+s.gain);row.fees=fix(row.fees+s.fees);row.trades++;row.possibleDayTrade||=!!s.possibleDayTrade;byMonth.set(key,row);
 }
 const months=[...byMonth.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.classification.localeCompare(b.classification));
 const flags=[];
 for(const row of months){
  const cautions=[];
  if(row.classification==='NAO_CLASSIFICADO')cautions.push('Classificação insuficiente para regras fiscais.');
  if(row.possibleDayTrade)cautions.push('Possível day trade: exige separar notas por negócio e modalidade.');
  if(row.classification==='ACAO'&&row.grossSales<=20000)cautions.push('Volume de vendas de ações à vista potencialmente sujeito a regra específica de isenção, mas elegibilidade NÃO determinada.');
  if(row.classification==='FII')cautions.push('FII exige apuração própria, inclusive saldos de prejuízos.');
  if(cautions.length)flags.push({month:row.month,classification:row.classification,cautions});
 }
 const cutoff=`${y}-12-31`,recordCount=(db.transactions||[]).filter(x=>x.date<=cutoff).length;
 const blockers=[...dossier.blockers,...(recordCount===0?['Nenhuma operação histórica até 31/12: informe financeiro não reconciliado.']:[])];
 const all=[...new Set([...ledger.issues,...blockers])];
 return {year:y,months,source:'Histórico manual/importado, sujeito a conciliação documental',positionDiscrepancies:dossier.positionDiscrepancies,amountsInEvidence:dossier.incomeDiscrepancies,alerts:flags,blockers:all,canCertify:false,canGenerateDarf:false,officialTool:'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/manual',note:'Quadro de conferência; não é imposto apurado, recomendação fiscal, DARF ou valores certificados para copiar diretamente na declaração.'};
}

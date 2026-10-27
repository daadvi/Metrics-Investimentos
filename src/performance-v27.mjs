/** Portfolio return bridge. Modified Dietz is an ESTIMATE, never certified TWR.
 * Requires complete dated portfolio values and explicit external cash-flow coverage.
 */
import {consolidatedEvolution} from './metrics-v24.mjs';
const money=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
const day=d=>Date.parse(d+'T00:00:00Z');
const isDay=d=>typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d)&&Number.isFinite(day(d))&&new Date(day(d)).toISOString().slice(0,10)===d;
export function calculateDietzPeriod27({start,end,startBRL,endBRL,flows=[],coverage=[]}={}){
 if(!isDay(start)||!isDay(end)||start>=end)throw Error('Período de retorno inválido.');
 if(![startBRL,endBRL].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0))return {from:start,to:end,returnPercent:null,status:'INCOMPLETE_VALUATION',reason:'Patrimônio de início/fim incompleto.'};
 if(!coverage.some(x=>isDay(x.from)&&isDay(x.to)&&x.from<=start&&x.to>=end&&String(x.source||'').trim().length>=8))return {from:start,to:end,returnPercent:null,status:'UNRECONCILED_FLOWS',reason:'O usuário não confirmou a cobertura dos fluxos externos do período com referência de extrato.'};
 const days=(day(end)-day(start))/86400000;let sum=0,weighted=0,used=0;
 for(const flow of flows){if(!isDay(flow.date)||flow.date<=start||flow.date>end)continue;
  if(!['DEPOSIT','WITHDRAW'].includes(flow.type)||!(Number(flow.amount)>0)||!Number.isFinite(Number(flow.amount))||String(flow.source||'').trim().length<4)return {from:start,to:end,returnPercent:null,status:'FLOW_INVALID',reason:'Aporte/retirada sem documentação suficiente.'};
  // Reference PTAX is not the actual conversion of foreign cash flow.
  if(String(flow.currency||'BRL').toUpperCase()!=='BRL')return {from:start,to:end,returnPercent:null,status:'FOREIGN_FLOW',reason:'Aporte/retirada estrangeira precisa de câmbio efetivo documentado em reais.'};
  const signed=(flow.type==='DEPOSIT'?1:-1)*Number(flow.amount),weight=(day(end)-day(flow.date))/86400000/days;
  sum+=signed;weighted+=signed*weight;used++;
 }
 const denominator=startBRL+weighted;
 if(denominator<=0)return {from:start,to:end,returnPercent:null,status:'INVALID_DENOMINATOR',reason:'Capital ponderado não positivo.'};
 const r=(endBRL-startBRL-sum)/denominator;
 if(!Number.isFinite(r)||r<=-1)return {from:start,to:end,returnPercent:null,status:'UNRELIABLE_RESULT',reason:'Retorno estimado fora da faixa utilizável. Confira os fluxos e datas.'};
 return {from:start,to:end,openingBRL:money(startBRL),closingBRL:money(endBRL),netExternalBRL:money(sum),weightedExternalBRL:money(weighted),days,flowCount:used,returnPercent:Number((r*100).toFixed(5)),status:'ESTIMATED_MODIFIED_DIETZ',method:'MODIFIED_DIETZ',note:'Estimativa com pesos diários de fluxos externos. Não é TWR exato nem inclui tributos/custos não lançados.'};
}
export function computePerformance27(db,{asOf,months=12,calculatePositions,foreignPositions,fixedIncomePosition}={}){
 if(!isDay(asOf)||!Number.isInteger(months)||months<2||months>120)throw Error('Parâmetros da evolução inválidos.');
 const timeline=consolidatedEvolution(db,{asOf,months,calculatePositions,foreignPositions,fixedIncomePosition});
 const coverage=db.flowReconciliations||[];const flows=db.externalFlows||[];let chain=1,linked=0,inGap=false;
 const periods=[];for(let i=1;i<timeline.points.length;i++){
  const a=timeline.points[i-1],b=timeline.points[i];const period=calculateDietzPeriod27({start:a.date,end:b.date,startBRL:a.complete?a.totalBRL:null,endBRL:b.complete?b.totalBRL:null,coverage,flows});
  periods.push(period);
  if(period.returnPercent===null){inGap=true;continue;}
  chain*=1+period.returnPercent/100;linked++;
 }
 const fullChain=linked===periods.length&&periods.length>0&&!inGap;
 return {asOf,method:'MODIFIED_DIETZ_APPROXIMATION',timeline:timeline.points,periods,completePeriods:linked,missingPeriods:periods.length-linked,linkedApproximatePercent:fullChain?Number(((chain-1)*100).toFixed(4)):null,flowEvidenceCount:coverage.length,quality:fullChain?'ESTIMATED_WITH_DECLARED_COVERAGE':'INCOMPLETE',warning:'Rentabilidade aproximada multiclasse por Modified Dietz, NÃO TWR auditado. Sem extratos reconciliados, preços de todas as classes e fluxos completos, a rentabilidade acumulada fica indisponível. Entradas internas de compra/venda não são aportes externos.'};
}
export function validateFlowCoverage27(raw){const from=String(raw.from||''),to=String(raw.to||''),source=String(raw.source||'').trim();if(!isDay(from)||!isDay(to)||from>=to||source.length<8||source.length>200)throw Error('Informe início, fim e referência documental de no mínimo 8 caracteres.');return {from,to,source,confirmedByUser:true,verifiedByMetrics:false,recordedAt:new Date().toISOString()};}

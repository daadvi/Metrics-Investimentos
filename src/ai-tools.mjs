/** Read-only, audited functions available to supported Ollama/OpenAI models.
 * The model may request calculations but cannot execute code, access filesystem or mutate a portfolio.
 */
import {financialFacts,projectedEvents,fiscalReadiness} from './insights.mjs';
import {simulatePhases,tickerOf} from './domain.mjs';
import {historyReport,benchmarkBetween} from './portfolio-history.mjs';
import {portfolioXirr,auditPortfolio} from './analytics-v1.mjs';
import {screener,localAlerts,incomeGoal} from './radar-v1.mjs';
import {classReport} from './store.mjs';
import {taxDossier} from './tax-dossier.mjs';
import {convertToBRL} from './fx.mjs';
import {cvmPreview} from './cvm-fii.mjs';
import {reconcileIncome,dataCoverage} from './dividend-reconciliation.mjs';
import {quarterlyOverview} from './cvm-quarterly.mjs';
import {taxWorkpaper} from './tax-audit-v13.mjs';
import {sourceHealth} from './data-health-v13.mjs';
import {providerCatalog} from './provider-hub.mjs';
import {ipeSummary} from './cvm-ipe.mjs';
import {dfpOverview} from './cvm-dfp.mjs';
import {fiscalEvidenceAudit} from './fiscal-evidence-v14.mjs';
const schema=(name,description,properties,required=[])=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}});
export const readOnlyTools=[
 schema('metrics_listar_fontes_v14','Lista fornecedores de preços e documentos, diferenças de atraso e restrições de plano. Nunca inventa que são em tempo real.',{}),
 schema('metrics_consultar_dfp_v14','Consulta registros contábeis DFP da CVM importados. Mostra moeda/escala, período, conta e origem, sem inventar múltiplos.',{ticker:{type:'string'}}),
 schema('metrics_consultar_ipe_v14','Consulta índice CVM IPE importado da carteira. O índice não comprova valor de dividendos.',{ticker:{type:'string'}}),
 schema('metrics_observacoes_de_mercado_v14','Consulta preços estrangeiros em USD e proventos de fornecedores, sempre com fonte e datas; não converte moedas.',{ticker:{type:'string'}}),
 schema('metrics_verificar_imposto_v14','Lista cobertura documental e pendências fiscais; não calcula DARF nem certifica declaração.',{year:{type:'integer'}},['year']),
 schema('metrics_consultar_informes_trimestrais','Consulta os indicadores dos informes trimestrais CVM, apenas colunas reconhecidas.',{ticker:{type:'string'}}),
 schema('metrics_observar_proventos_terceiros','Consulta observações de proventos do fornecedor externo, identificando datas sintéticas e ausência de verificação oficial.',{ticker:{type:'string'}}),
 schema('metrics_auditar_fontes','Avalia ausência de preços, histórico incompleto e fontes de proventos sem autenticação. Nunca declara valores como ao vivo.',{}),
 schema('metrics_apuracao_fiscal_de_conferencia','Gera quadro mensal de resultados de vendas e bloqueios fiscais. Não fornece DARF nem valores certificados de declaração.',{year:{type:'integer'}},['year']),
 schema('metrics_consultar_fundamentos_cvm','Consulta informes mensais da CVM importados com CNPJ vinculado pelo investidor. Não inventar dados de imóveis, vacância ou anúncio de dividendos.',{ticker:{type:'string',description:'Ticker opcional'}}),
 schema('metrics_conciliar_proventos','Compara eventos cadastrados, posição elegível e proventos efetivamente lançados. Não verifica o anúncio automaticamente.',{ticker:{type:'string',description:'Ticker opcional'}}),
 schema('metrics_verificar_cotacoes','Exibe datas, fonte e idade das cotações presentes; nunca dizer que são tempo real.',{}),
 schema('metrics_get_carteira','Consulta valores verificáveis lançados na carteira, posições importadas e lista de desejos. Os dados nunca são cotações ao vivo.',{ticker:{type:'string',description:'Ticker opcional para filtrar'}}),
 schema('metrics_get_proventos_futuros','Calcula somente proventos de eventos informados pelo usuário; quantidades sem data-base elegível retornam indefinidas.',{ticker:{type:'string',description:'Ticker opcional'}}),
 schema('metrics_get_rentabilidade_historica','Consulta evolução patrimonial com cotações históricas salvas, assinalando faltas, intervalos cobertos e comparação CDI somente quando disponível. Não inventa retorno desde a primeira compra.',{}),
 schema('metrics_get_imposto_auxiliar','Apuração auxiliar de vendas e rendimentos registrados em um ano; não calcula imposto devido nem emite DARF.',{year:{type:'string',description:'Ano no formato YYYY'}},['year']),
 schema('metrics_consultar_qualidade','Verifica dados da carteira, rentabilidade anualizada XIRR com condições, ranking de fundamentos cadastrados, alertas locais e meta. Nunca afirma segurança garantida ou dados atuais não verificados.',{}),
 schema('metrics_consultar_classes','Consulta posições internacionais em moeda original, contratos de renda fixa e fontes PTAX. Nunca soma moedas diferentes ou estima rendimentos pós-fixados sem série completa.',{}),
 schema('metrics_conciliar_ir','Lista documentação e divergências em informe fiscal; nunca certifica declaração ou calcula DARF.',{year:{type:'string'}},['year']),
 schema('metrics_converter_cambio','Converte usando taxa PTAX/manualmente registrada na data, ou retorna erro se faltar taxa.',{amount:{type:'number'},currency:{type:'string'},date:{type:'string'}},['amount','currency','date']),
 schema('metrics_simular_aportes','Simulação matemática hipotética, não previsão. Só usar preços, dividendos, fases e taxas explicitamente definidos pelo investidor.',{
  price:{type:'number'},dividend:{type:'number'},phases:{type:'array',items:{type:'object',properties:{months:{type:'integer'},amount:{type:'number'}},required:['months','amount'],additionalProperties:false}},reinvestPercent:{type:'number'},priceGrowthAnnual:{type:'number'},dividendGrowthAnnual:{type:'number'},inflationAnnual:{type:'number'}
 },['price','dividend','phases'])
];
export function callReadOnlyTool(name,args,db){
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Argumentos inválidos.');
 const ticker=args.ticker?tickerOf(args.ticker):null;
 if(name==='metrics_listar_fontes_v14')return providerCatalog().map(p=>({id:p.id,name:p.name,delay:p.delay,free:p.free,coverage:p.coverage}));
 if(name==='metrics_consultar_dfp_v14')return dfpOverview(db,{ticker});
 if(name==='metrics_consultar_ipe_v14')return ipeSummary(db,{ticker});
 if(name==='metrics_observacoes_de_mercado_v14')return {foreignQuotes:(db.foreignMarketQuotes||[]).filter(x=>!ticker||x.ticker===ticker).slice(-80),providerDividends:(db.providerDividendFeed||[]).filter(x=>!ticker||x.ticker===ticker).slice(-150),caveat:'Preço USD não é BRL; dividendos de terceiros não são anúncios oficiais'};
 if(name==='metrics_verificar_imposto_v14')return fiscalEvidenceAudit(db,args.year);
 if(name==='metrics_consultar_informes_trimestrais'){const q=quarterlyOverview(db);return {...q,latest:q.latest.filter(x=>!ticker||x.ticker===ticker)};}
 if(name==='metrics_observar_proventos_terceiros')return {observations:(db.providerDividends||[]).filter(x=>!ticker||x.ticker===ticker).slice(-100),officiallyVerified:false};
 if(name==='metrics_auditar_fontes')return sourceHealth(db);
 if(name==='metrics_apuracao_fiscal_de_conferencia')return taxWorkpaper(db,args.year);
 if(name==='metrics_consultar_fundamentos_cvm'){const r=cvmPreview(db);return {...r,latest:r.latest.filter(x=>!ticker||x.ticker===ticker)};}
 if(name==='metrics_conciliar_proventos'){const r=reconcileIncome(db);return {...r,events:r.events.filter(x=>!ticker||x.ticker===ticker)};}
 if(name==='metrics_verificar_cotacoes')return dataCoverage(db);
 if(name==='metrics_get_carteira'){
  const f=financialFacts(db);
  if(!ticker)return f;
  return {...f,positions:f.positions.filter(x=>x.ticker===ticker),watchlist:f.watchlist.filter(x=>x.ticker===ticker),futureEvents:f.futureEvents.filter(x=>x.ticker===ticker),custodyStatement:f.custodyStatement?{...f.custodyStatement,positions:f.custodyStatement.positions.filter(x=>x.ticker===ticker)}:null};
 }
 if(name==='metrics_get_proventos_futuros')return {source:'Eventos cadastrados pelo usuário, NÃO feed oficial',events:projectedEvents(db).filter(x=>!ticker||x.ticker===ticker)};
 if(name==='metrics_get_rentabilidade_historica'){const h=historyReport(db);return {range:h.range,completeDays:h.completeDays,linkedPeriods:h.linkedPeriods,approximateTwrPercent:h.approximateTwrPercent,lastComplete:h.lastComplete,benchmark:h.range?benchmarkBetween(db.benchmarkCDI||[],h.range.from,h.range.to):null,warning:h.warning,missingPrices:h.missingPrices};}
 if(name==='metrics_consultar_qualidade')return {quality:auditPortfolio(db),performance:portfolioXirr(db),screen:screener(db),alerts:localAlerts(db),goal:incomeGoal(db,{monthlyTarget:db.settings?.monthlyIncomeGoal})};
 if(name==='metrics_get_imposto_auxiliar')return fiscalReadiness(db,args.year);
 if(name==='metrics_consultar_classes')return classReport(db);
 if(name==='metrics_conciliar_ir')return taxDossier(db,args.year);
 if(name==='metrics_converter_cambio')return convertToBRL(args.amount,args.currency,args.date,db.fxRates||[]);
 if(name==='metrics_simular_aportes'){
  // The request is demonstrative, and the caller must distinguish hypotheses.
  const s=simulatePhases(args);
  return {kind:'HYPOTHETICAL',inputs:s.params,result:s.last,annual:s.months.filter(x=>x.month%12===0).map(x=>({month:x.month,holdingsValue:x.holdingsValue,deposited:x.deposited,received:x.received,withdrawn:x.withdrawn}))};
 }
 throw Error('Ferramenta não permitida.');
}
export function limitedToolResult(data){const raw=JSON.stringify(data);return raw.length<26000?raw:JSON.stringify({notice:'Resultado extenso; veja área correspondente no aplicativo. Resumo truncado por limite seguro.',summary:raw.slice(0,23000)});}

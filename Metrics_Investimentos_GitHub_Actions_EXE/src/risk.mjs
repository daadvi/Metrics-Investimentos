// Radar descritivo com checagens transparentes; não é probabilidade ou nota de segurança.
export function analyzeFundRisk(p){
 const notices=[],good=[],missing=[];
 if(!p||!p.ticker)throw Error('Ficha inválida.');
 const available=(k)=>p[k]!==null&&p[k]!==undefined&&Number.isFinite(Number(p[k]));
 if(available('vacancy')){if(p.vacancy>=15)notices.push('Vacância informada elevada (15% ou mais).');else if(p.vacancy<=3)good.push('Vacância informada baixa (até 3%).');}
 else if(['FII_TIJOLO','FII_HIBRIDO'].includes(p.type))missing.push('Vacância não informada.');
 if(available('equity')&&available('debt')&&p.equity>0){const ratio=p.debt/p.equity*100;if(ratio>=35)notices.push(`Dívida/PL informados de ${ratio.toFixed(1)}%; verificar cronograma e dívidas indiretas.`);else if(ratio<15)good.push(`Dívida direta/PL informados de ${ratio.toFixed(1)}% (não inclui veículos indiretos).`);}
 else missing.push('Informações de endividamento incompletas.');
 if(available('assets')&&available('occupied')&&p.assets>0)good.push(`${p.occupied} de ${p.assets} imóveis ou operações informados como ocupados/ativos; conferir escopo.`);
 else if(p.type==='FII_TIJOLO')missing.push('Quantidade ou ocupação dos imóveis não informada.');
 if(!p.source||p.source==='Informado pelo usuário')missing.push('Sem referência externa verificável para os indicadores.');
 if(!p.date)missing.push('Sem data-base registrada.');
 if(available('dy12')&&p.dy12>18)notices.push('Dividend yield acima de 18% a.a.: investigar sustentabilidade e eventos extraordinários.');
 return {ticker:p.ticker,date:p.date,source:p.source,positive:good,warnings:notices,missing,disclaimer:'Triagem por regras simples baseada em dados fornecidos pelo usuário. Não mede risco total nem prevê falência, valorização ou perdas.'};
}

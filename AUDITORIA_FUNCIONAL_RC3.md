# Comparação funcional e auditoria de requisitos básicos | 1.0 RC3

## Implementado e testado

- Cadastro manual de compra, venda, dividendos/JCP e certos eventos corporativos.
- Edição de lançamento existente mantendo `id`, data de criação, origem e vínculo com lote importado.
- Exclusão segura; operações impossíveis (como venda descoberta após remover uma compra) são rejeitadas atomicamente.
- Desfazer última criação, correção ou exclusão de lançamento manual. Histórico local por carteira (últimos 2.000 eventos retidos), com estado anterior/posterior armazenados, sem ser log à prova de adulteração.
- Bloqueio de desfazer manual quando um lote importado/revertido foi a alteração financeira subsequente.
- Busca textual nos lançamentos da carteira.
- Recalcular custo, preços médios, ganhos realizados, posições, relatórios e indicadores a partir da carteira corrigida.
- Isolamento entre carteiras e migração RC2 -> RC3 de bancos com várias carteiras.
- Importação conservadora de certos formatos B3, com prévia; posição custodiada não cria compras fictícias.
- Cotações manuais, históricas e adaptador externo com atraso indicado.
- IA híbrida em implementação: modelo local/Ollama e chave externa, com ferramentas restritas.
- Simulação baseada em fórmulas, dependente de premissas.
- Exportação CSV/XLSX e relatório fiscal **auxiliar**, sem declaração ou DARF certificados.

## Ainda não equivale ao Investidor10

- Integração automática autorizada com a B3 (foi **retirada do escopo** por decisão do idealizador; a importação de arquivos é alternativa parcial).
- Cobertura profissional de dados de todas as ações/FIIs nacionais e internacionais, incluindo feeds licenciados em tempo real.
- Agenda de dividendos oficialmente anunciados e cálculo automaticamente reconciliado com posições na data-com.
- Busca fundamentalista extensa, rankings, filtros de mercado, notícias, fatos relevantes e indicadores historicamente comparáveis.
- Tributação integral por ano-calendário, ganhos day trade, prejuízos fiscais, retenções, rendimentos, informes e DARFs/declaração automatizada.
- Múltiplos tipos de ativo e regimes de custódia completos (renda fixa, títulos públicos, criptoativos, ações internacionais, moedas).
- Sincronização entre desktop e Android (fora de escopo imediato), notificações em segundo plano.
- Tratamento completo de todos os eventos societários; rentabilidade histórica completa só é possível com séries e lançamentos íntegros.
- Criptografia e auditoria externa certificada, testes Windows de acessibilidade, desempenho, backup e segurança em grande escala.

## Recomendações de prioridade

P0: valor da carteira, operações, importação e conciliação; corrigir caso real antes de cada ampliação.
P1: cobertura de proventos e dados de fontes autorizadas, motor tributário versionado e verificações de precisão.
P2: melhorias de navegação, distribuição mobile, alertas e conteúdo de mercado.

O aplicativo permanece beta/candidato de lançamento, não certificado para uso profissional nem para apuração definitiva de imposto.

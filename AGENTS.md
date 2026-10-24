# Metrics Investimentos — instruções para Codex e colaboradores

Este repositório implementa um gerenciador de investimentos local-first; **não é um app de execução de ordens nem um consultor financeiro**.

## Primeiros passos

1. Use Node.js 22.13+ (`node:sqlite` experimental).
2. Execute `npm test` (inclui uma integração real com API e SQLite temporário).
3. Execute `npm start` para iniciar a janela local com sessão autorizada.
4. No Linux, `./instalar-linux.sh` instala um atalho, ainda dependendo de Node.js e navegador.
5. Não coloque cotações fictícias, recomendações ou extratos de teste em carteiras reais.

## Componentes

- `server.mjs`: HTTP local, sessão por cookie, operações e endpoints financeiros.
- `src/store.mjs`: única fonte de verdade; preserva estrutura anterior do SQLite.
- `src/domain.mjs`: cálculos de posição, preço médio e simulação de um ativo.
- `src/portfolio-sim.mjs`: carteira de até 12 ativos, alocação em centavos e projeção.
- `src/importers.mjs`: XLSX/CSV e PDF com texto. Nunca transforme créditos genéricos ou transferências em compras automaticamente.
- `src/ai.mjs`: Ollama, OpenAI BYOK e modo sem LLM. Consentimento para contexto.
- `src/backup.mjs`: exportação AES-GCM com senha e restauração.
- `src/risk.mjs`: triagem explícita, sem probabilidade inventada.
- `web/`: UI responsiva estática.

## Critérios para desenvolvimento futuro

- Nunca envie dados da carteira para nuvem sem autorização explícita.
- Toda informação de cotação, relatório, patrimônio, vacância e dividendos deve mostrar fonte/data; se faltar, informe que está indisponível.
- Todos os cálculos são determinísticos e independentes da IA.
- Preserve migração de dados já existentes; teste com DB antigo e backup.
- Fluxos fiscais exigem regras por classe e exercício, conciliação e revisão profissional antes de alegar completude.
- Não inclua credenciais comerciais de B3, exchanges ou provedores no cliente.
- Distinga simulações hipotéticas de rentabilidade real e retorno total.
- Não adicione dependências pagas ou chaves obrigatórias: orçamento total inicial R$ 50.

## Backlog com prioridade

1. Teste visual de ponta a ponta contra servidor real em Linux e Windows, incluindo login, backups e modelos AI.
2. Tratamento detalhado de operações da B3 com layouts oficiais reais (com dados anonimizados), direitos, grupamentos e amortizações.
3. Histórico de preços verificáveis por fonte licenciada, sem prometer tempo real.
4. Motor fiscal versionado por ano de declaração e categoria de ativo.
5. Builds desktop nativos assináveis (Tauri), isolamento de processo e atualizações seguras.
6. Validação de criptografia em repouso e migração com rotina confiável de backups.
7. Monitoramento de eventos externos com consentimento e funcionamento offline gracioso.
8. Auditoria externa de segurança, privacidade e enquadramento CVM antes de comercializar.

Antes de proclamar qualquer item 'pronto', escreva testes e registre sua fonte e limitação em `QUALITY_REPORT.md`.


## V0.4 — Prioridades para Codex

1. Não representar o app como auditado para uso financeiro real. Execute `npm test` primeiro; 41 testes locais esperados.
2. O módulo `src/market.mjs` lê arquivos públicos COTAHIST históricos. Validar a URL B3 em máquinas reais, lidar com redirecionamentos e confirmar condições de redistribuição antes de publicar feeds.
3. `src/tax.mjs` gera apenas custo médio e demonstrativo preliminar, sem DARF; exigir revisão das regras fiscais atualizadas e cobrir eventos corporativos/IRRF/day trade antes de qualquer apuração final.
4. `desktop/main.cjs`, `electron-builder.json` e `.github/workflows/desktop.yml` são a estrutura de empacotamento, sem build validado. Tentar `npm install` e `npm run desktop:build` em CI, corrigindo problemas específicos de Electron.
5. Manter cookie HttpOnly, validação de origem e loopback. Não mover credenciais para front-end ou publicar APIs externas sem segurança adicional.
6. Capturar testes de ponta a ponta em Windows/Linux com API real e sample de B3 anonimizado; smoke test neste ambiente usou interface isolada com serviços mockados por restrição de navegação.
7. Retorno de consultas externas deve sempre incluir fonte, data-base, método e status de atualização; não fingir dados em tempo real.
8. Preservar o layout do banco v0.3 e testar backup criptografado antes de migrações destrutivas.

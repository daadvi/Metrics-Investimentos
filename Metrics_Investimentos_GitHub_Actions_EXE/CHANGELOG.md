# Changelog

## 0.4.0

- COTAHIST B3 TXT/ZIP: leitor com limites de arquivo, mercado à vista, preço de fechamento, filtragem por carteira e proteção contra sobrescrita por preço antigo.
- Busca de arquivo diário público B3 por ação do usuário; rede pública não validada ao vivo neste ambiente.
- Auxiliar fiscal mensal por classe: custo médio, ganhos/perdas, avisos sobre dados fiscais ausentes e possível day trade, sem cálculo de DARF.
- Exportação de arquivo XLSX com dados organizados em quatro abas e módulo testado por reimportação.
- Fonte de preços e datas no dashboard/IA, com distinção explícita de dados históricos e cotações ao vivo.
- Projeto Electron e workflow de empacotamento para Windows/Linux; build dependente de download de pacotes, não testado neste ambiente.
- 41 testes automatizados e smoke test da interface isolada com mocks.

## 0.3.0

- Sessão local autenticada por token, cookies HttpOnly e verificações de origem.
- Backup criptografado AES-256-GCM com senha e restauração de backups protegidos.
- Simulador de carteira com até 12 ativos, distribuição por pesos e 30 fases.
- Avaliação explicável de integridade das fichas, sem pontuações falsas.
- Importador XLSX robustecido por diretório central ZIP e maior cautela com créditos e transferências.
- 31 testes automatizados, incluindo fluxo completo de API real e importação sem duplicação.
- Interface validada em Chromium com serviços simulados; testes de navegadores reais e feeds externos ainda pendentes.
- Conserva base SQLite da versão anterior e adiciona lançador multiplataforma.

## 0.2.0

- Migração de arquivo JSON para SQLite local, com criptografia opcional.
- Importação por lote XLSX/CSV com revisão, duplicatas e desfazer.
- Documentos PDF/TXT extraíveis, consulta contextual pela IA híbrida.
- Fichas de ativos, eventos de dividendos, preços manuais e metas de compra.
- Dashboard e proventos por mês/ticker.
- Simulador por fases com reinvestimento parcial e hipóteses editáveis.
- Exportações, backups/restauração, relatórios anuais auxiliares.
- Lançador de janela Linux e instalador de atalho.
- Testes automáticos expandidos.

## 0.1.0

- Primeira aplicação local com lançamentos manuais, watchlist, chat e simulador de duas fases.

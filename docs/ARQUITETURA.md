# Arquitetura atual — Metrics 0.5

- **UI:** `web/app.js` SPA com gráficos DOM e componentes HTML. Não exige CDN para carregar dados financeiros.
- **Desktop:** Electron com janela sandboxed, Node integration desabilitada, servidor HTTP local e cookie de sessão.
- **API:** `server.mjs`, somente `127.0.0.1`, proteção de Host/Origin, cabeçalho local para mutações.
- **Armazenamento:** SQLite `storage(id,content)` com documento JSON de toda a base; criptografia AES-GCM opcional por passphrase. Quando Electron fornece chave protegida do SO, o conteúdo é migrado em transação para criptografia por padrão. Futuro: separar tabelas relacionais e desenhar schema/migrations versionadas.
- **Cálculos:** `src/domain.mjs`, `src/portfolio-sim.mjs`, `src/insights.mjs`, `src/tax.mjs`. Fontes/entradas locais e hipóteses sempre separadas.
- **Importação:** CSV, XLSX e COTAHIST, com formatos limitados; PDF por `src/pdf.mjs` usando `pdfjs-dist` e fallback Poppler. Custody snapshots são independentes de movimentos BUY/SELL.
- **IA:** `src/ai.mjs` integra resumo local, Ollama e OpenAI. `src/ai-tools.mjs` fornece funções somente leitura e simulação determinística sob autorização.
- **Memória:** recuperação sob demanda da carteira, desejos, eventos e snapshots do banco local. Documentos recuperados por relevância lexical; sem pesquisa semântica vetorial ou fontes CVM automáticas.
- **Fiscal:** relatórios de conferência e planilhas, não declaração ou cálculo completo de imposto.

Consulte `QUALITY_REPORT.md` para o que foi e não foi validado.

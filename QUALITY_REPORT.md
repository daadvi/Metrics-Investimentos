# Metrics Investimentos v0.4.0 — Relatório de qualidade (24/10/2026)

## O que foi efetivamente validado

- 41 testes automatizados (`npm test`), nenhum falhou. Incluem registros de compra/venda, simulações, importação de XLSX, backup com senha, leitura COTAHIST sintética, triagem fiscal e API HTTP + SQLite local.
- Navegação das páginas Preços e Relatórios no Chromium com HTML/CSS/JS reais e respostas de API simuladas. Sem exceções JavaScript nesse teste.
- XLSX produzido pelo módulo foi reimportado pelo leitor XLSX, com preservação de células numéricas e caracteres especiais.
- Com uma API real temporária, registrou compra e venda, gerou relatório fiscal, importou preço COTAHIST e exportou XLSX (teste v04-api).
- Não exige assinatura ou serviço de nuvem para executar os módulos locais.

## Pendências de validação e bloqueios externos

- A busca de COTAHIST pela internet **não foi comprovada contra o servidor B3 atual** no ambiente desta análise. A falha remota tem mensagem e importação manual como alternativa.
- Não foi possível navegar do Chromium diretamente para o servidor local devido a bloqueio do ambiente; o teste visual usou serviços simulados. Os testes HTTP reais foram executados separadamente.
- `npm install` de dependências Electron expirou no ambiente; não existe binário EXE/AppImage compilado nem validação de instalação em hardware Windows/Linux. Há um fluxo de compilação GitHub Actions preparado.
- Não foi realizado teste com modelo Ollama baixado nem com chave OpenAI real. Os adaptadores seguem os testes existentes, sem garantir disponibilidade desses serviços.
- Importador B3 de movimentações cobre apenas certos layouts; planilhas reais e diversos eventos societários precisam ser testados e revisados pelo usuário.
- Não existe preço ajustado, índice total return validado, mapa cadastral completo global, calendário automático de proventos ou importação automática de extratos pela B3.
- Relatório fiscal é auxiliar, não apura imposto/DARF e não substitui conferência por documentos oficiais ou profissional.
- Sem auditoria externa de segurança, testes de carga e acessibilidade abrangentes, assinatura de código e revisão regulatória de lançamento comercial.

## Orientações para utilização segura

- Faça backup **criptografado** antes de migrar dados pessoais reais.
- Evite serviços externos de IA sem ler os avisos de consentimento.
- Compare indicadores, impostos e preços com documentos oficiais antes de agir.
- Não considere esta versão pronta para lançamento público comercial sem auditoria e testes reais.

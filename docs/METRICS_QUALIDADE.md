# Metrics Investimentos 2.9 Preview 2 | Qualidade, comparação e interface persistente

## Entregue nesta atualização

- Barra lateral preservada no DOM. A navegação muda o conteúdo e o cabeçalho, mantendo a posição vertical/horizontal, sem reconstruir a barra.
- Páginas de Qualidade e conciliação, Comparar e alocar, Saúde das APIs.
- Motor determinístico com resultados indisponíveis caso o inventário de investimentos tenha componentes sem cotação, classe, câmbio ou comprovante necessário.
- Alocação alvo opcional, de classes nacionais com preço BRL, meta total 100%, desvio em pontos percentuais. Não emite ordens de compra.
- Comparador de 2 a 6 ativos que mostra data-base, fonte, classe e valores faltantes.
- Conciliação de renda passiva por evento e contagem de fluxos sem documentos, sem importar transações automaticamente.
- Diagnóstico local dos provedores, cotações antigas e proposta de lote. Não expõe tokens.
- Node tests e suíte opcional Playwright Windows/Linux via GitHub Actions.
- Instalador com simulação, checagem de âncoras, backup de código FORA da pasta do projeto e rollback do próprio patch.

## Como funciona o cofre

Não alteramos o cofre existente. O novo diagnóstico não consulta nem retorna chaves. A proteção de segredos deve continuar sendo validada nos testes atuais da v2.9. As recomendações de janela mínima não garantem compatibilidade com os limites contratuais de cada fornecedor.

## Limites e pendências

1. Sem acesso aos extratos reais: a conciliação é auxiliar. Dados de posição não geram negócios fictícios, proventos aritméticos não viram recebimento oficial.
2. O motor fiscal existente não foi reescrito nem auditado por profissional habilitado. DARF e valores definitivos ficam indisponíveis.
3. Esta atualização modulariza **recursos novos**, não divide integralmente o arquivo legado web/app.js, que ainda agrega versões antigas. O próximo refactor de todas as telas exigirá testes visuais detalhados.
4. O backend ainda faz leituras completas em certos relatórios; datasets muito grandes podem consumir memória. Paginação v28 permanece disponível.
5. Não foi implementado daemon de sincronização automática. Sincronizações continuam iniciadas pelo usuário, com um planejamento sugerido e cooldown.
6. Distribuição assinada requer certificado de assinatura e validação em máquinas limpas. Esse kit não contém EXE.
7. Testes de browser no Actions são definidos, mas só ficam comprovados quando executados na branch publicada.

## Verificações antes do release

`node --check web/app.js`, `node --check server.mjs`, `npm test`, `npm run test:ui`, `npm run desktop:build` em CI, e atualização/restauração em base de dados fictícia.

Não colocar token, extratos, banco SQLite, arquivo `.env` ou backups na publicação.

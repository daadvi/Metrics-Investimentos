# Metrics Investimentos 0.4.0

Aplicativo de gestão **local-first**, desenvolvido em Node.js e JavaScript, com IA híbrida opcional, dados persistidos em SQLite, importação de documentos financeiros e simulador de aportes.

**Estado do projeto: BETA AVANÇADA / NÃO AUDITADA PARA PRODUÇÃO FINANCEIRA.** É possível administrar uma carteira manual e analisar os dados locais; não há conexão automática com B3, cotações ao vivo ou garantia de que todo relatório da B3 será reconhecido. Nunca use resultados automáticos sem conferir extratos e documentos oficiais.

**Custo obrigatório de serviços: R$ 0.** O projeto não depende de assinatura, mas requer computador compatível, Node.js 22.13+ e um navegador moderno. APIs externas podem cobrar pelo uso.

## Instalando no Linux (Zorin, Ubuntu e derivados)

1. Instale Node.js **22.13 ou superior** e Chromium, Chrome ou Edge. Execute `node -v` para verificar.
2. Extraia o arquivo ZIP em uma pasta de sua preferência.
3. Abra um terminal dentro da pasta `metrics-investimentos-v0.4.0`.
4. Execute `./instalar-linux.sh` para criar um atalho no menu e instalar em `~/.local/share/metrics-investimentos`.
5. Abra **Metrics Investimentos** pelo menu do sistema.

Também é possível executar `./metrics-desktop-linux.sh` sem instalar. Use `npm start` para abrir pelo lançador seguro, ou `node server.mjs` e copie a URL completa mostrada no terminal. O programa inicia um serviço em `127.0.0.1:4173` e abre uma janela de aplicativo no Chromium/Chrome. Ele utiliza Node.js e o navegador instalados; **não é um binário nativo Tauri e não é um APK**.

Se não houver Chromium/Chrome, execute `./iniciar-linux.sh` e use o endereço com código de acesso aberto pelo lançador ou exibido no terminal. Apenas `http://127.0.0.1:4173` não autoriza o acesso à API.

**Windows:** instale Node.js 22.13+, extraia o ZIP e execute `iniciar-windows.cmd`. O lançador abre o Metrics no navegador padrão. O pacote inclui código para compilar uma versão Electron portátil; o binário `.exe` não está pré-compilado neste ZIP.

## Melhorias na versão 0.4

- Importação de fechamentos históricos da B3 via COTAHIST ZIP/TXT e tentativa de atualização sob demanda pelo servidor público (sem assinatura). Não é feed ao vivo, não ajusta desdobramentos nem dividendos. A disponibilidade do endpoint varia.
- Cotação por ativo inclui data e origem; não substitui preço mais recente por informação mais antiga.
- Relatório fiscal auxiliar com custo médio, resultados de vendas, consolidação mensal, avisos de day trade provável e classificação incompleta. Não gera DARF, nem valida imposto devido.
- Exportação XLSX genuína com quatro abas: posições, vendas, proventos e avisos. CSV e impressão continuam disponíveis.
- Esqueleto Electron com medidas de isolamento do processo de renderização e workflow GitHub Actions para gerar instaladores Windows e Linux. **Dependências Electron e build nativo não validados neste ambiente.**
- 41 testes automatizados, incluindo testes de API reais e planilhas reimportadas; ver QUALITY_REPORT.md.

## Mudanças relevantes da versão 0.3

- **Acesso autenticado à API local:** a inicialização fornece um endereço temporário de acesso, cria cookie de sessão HttpOnly e bloqueia pedidos sem sessão. Evite compartilhar o endereço de inicialização com outras pessoas.
- **Backup com senha:** o botão de exportação gera JSON protegido por AES-256-GCM e scrypt; exige senha de pelo menos 12 caracteres. Restaurar admite backups protegidos e os JSON legados (estes exigem confirmação adicional).
- **Novo simulador Carteira futura:** até 12 ativos simultâneos, pesos somando 100%, 30 fases e 600 meses, cotas inteiras, caixa separado por ativo, reinvestimento parcial e exportação CSV. Desempenho baseado exclusivamente nas hipóteses preenchidas.
- **Radar de integridade de fichas:** análise de vacância, dívida/PL e campos sem fonte ou data, sem notas inventadas ou recomendações.
- **XLSX mais robusto:** suporte à estrutura ZIP por diretório central (incluindo arquivos com data descriptor); entradas/saídas genéricas e transferências NÃO viram compras e vendas automaticamente.
- **Testes automatizados integrados:** início real do servidor, autorização, lançamentos, watchlist, simulação, importação, rejeição de duplicação e recuperação de backup.

**Atualização da versão 0.2:** preserve `~/.metrics-investimentos/metrics.sqlite` (e os arquivos associados enquanto o aplicativo estiver fechado). A v0.3 mantém a mesma estrutura de armazenamento; teste sua cópia de segurança antes de usar. A versão não cria uma nova carteira ao atualizar.

## Funcionalidades implementadas

- **Carteira manual:** compras, vendas, preço médio, taxas, dividendos, resultado realizado antes de impostos, histórico e exclusão de registros.
- **SQLite local:** dados mantidos no computador, com migração dos dados existentes de `~/.metrics-investimentos/metrics.json` no primeiro uso.
- **Preço manual por ativo:** valor estimado e resultado não realizado, com data e identificação explícita de que não é cotação ao vivo.
- **Lista de desejos:** preço de interesse, prioridade, aporte pretendido, justificativa, edição e indicação local quando o preço informado manualmente chega ao alvo.
- **Proventos:** histórico por ticker e por mês, com gráfico, tabela e relatório CSV.
- **Agenda:** eventos futuros estimados ou informados como confirmados, lançados manualmente.
- **Fichas de ativos:** tipo (FII tijolo/papel/híbrido, ações etc.), patrimônio, imóveis/operações, ocupação, vacância, gestão, dividend yield, dívidas, data-base e origem declarada. Dados preenchidos pelo usuário, não extraídos automaticamente de mercado.
- **Simulador de ativo:** até 30 fases e 600 meses; dividendos com reinvestimento de 0% a 100%, cotas inteiras, caixa, inflação e hipóteses anuais de variação de preços e proventos. Exportação CSV.
- **Importador B3:** leitura local de CSV/TSV e XLSX, reconhecendo cabeçalhos selecionados; prévia, linhas não identificadas, deduplicação, confirmação e desfazer por lote. Não pressupõe que toda movimentação é compra ou venda.
- **PDF/TXT:** extração de texto e armazenamento de documento para contextualizar a IA, com título e data-base declarados.
- **Metrics AI:** Ollama local, OpenAI com chave própria e resumo determinístico gratuito (identificado como sem LLM). Memória de conversas e autorização para contexto financeiro.
- **Relatórios auxiliares:** operações por ano, posições, proventos, histórico completo em CSV, impressão para PDF e backup JSON/restauração.
- **Segurança:** gateway somente em loopback com sessão por token temporário, cookie HttpOnly, controle de origem, confirmação de importações e nenhum envio de carteira sem permissão na IA.

## Como adicionar suas operações

Em **Carteira**, cadastre uma compra com ticker, data, quantidade, preço unitário e taxas. Dividendos/JCP são lançados separadamente. Os resultados são calculados a partir dos registros efetivamente fornecidos. Se você não inseriu operações históricas, o preço médio e os relatórios não podem ser considerados completos.

Em **Preços**, informe os valores observados e a data. O aplicativo não acessa preços automaticamente.

Em **Lista de desejos**, inclua o que pretende comprar. Isso **não** se transforma em posição real.

## Importar documentos da B3

1. Na Área do Investidor, baixe um relatório em XLSX ou CSV; os formatos podem variar.
2. Na aba **Importar B3**, selecione o documento.
3. Revise quantas operações foram reconhecidas e quantas linhas serão ignoradas.
4. Confirme somente depois de conferir. Importações repetidas são comparadas a lançamentos existentes; operações com os mesmos campos no mesmo dia podem ser tratadas como duplicadas (mesmo que tenham sido dois negócios legítimos), então revise o extrato.
5. Se necessário, vá ao histórico e **desfaça o lote**.

O importador reconhece alguns layouts com `Data`, `Produto` ou `Ticker`, `Movimentação` ou `Tipo`, `Quantidade`, `Preço unitário` e `Valor da Operação`. Em particular, transferências e liquidações ambíguas **não são transformadas automaticamente** em compras ou vendas. PDFs são importados apenas como documento, nunca convertidos silenciosamente em lançamentos.

Para leitura de PDF, instale `pdftotext` pelo pacote `poppler-utils` (Linux) ou equivalente. PDF escaneado, sem texto, não possui OCR nesta versão.

## Configurando a Metrics AI

**Modo sem LLM:** selecione `Resumo local, sem modelo`. Ele exibe os dados efetivamente calculados, mas não interpreta textos de forma generativa.

**Ollama:** instale [Ollama](https://ollama.com/), inicie-o e baixe um modelo compatível, por exemplo `ollama pull qwen2.5:3b`. Selecione `Ollama local` na aba Metrics AI e informe o identificador exato. Hardware modesto pode ter lentidão.

**API externa:** selecione OpenAI e informe sua chave apenas na sessão. **O aplicativo não grava a chave no SQLite.** As chamadas são cobradas, quando aplicável, diretamente pelo provedor.

Marque **Incluir carteira, desejos, preços manuais e documentos relacionados** somente quando desejar que a IA use esses dados. Em modo externo, a informação autorizada será transmitida à empresa do modelo. O próprio modo local não possui internet autônoma nem consulta direta à CVM/B3. Documentos incorporados são fornecidos pelo usuário; a IA não valida automaticamente sua autenticidade.

## Backup, criptografia e privacidade

Dados: `~/.metrics-investimentos/metrics.sqlite` no Linux ou `~/.metrics-investimentos/metrics.sqlite` sob o perfil de usuário no Windows. A pasta é criada com permissões restritas onde o sistema permite. A autenticação local reduz exposição acidental da API, mas não substitui criptografia completa do disco nem proteção do usuário do sistema.

**Por padrão o banco NÃO é criptografado. Backups exportados pela interface v0.3 SÃO criptografados.** Para uma instalação **nova** e criptografada, defina a variável de ambiente `METRICS_PASSPHRASE` antes da primeira inicialização. Os dados persistidos no SQLite são protegidos com AES-256-GCM a partir de chave derivada da senha com scrypt. Você precisará fornecer a mesma senha nas sessões posteriores. Não há recuperação de senha esquecida.

Para ativar criptografia em instalação já existente: faça **backup JSON** pela interface, feche o Metrics, copie/mova `metrics.sqlite` e arquivos `-wal`/`-shm` para um local seguro; inicialize um banco novo usando a senha e restaure o backup JSON na interface. **Não ative a senha simplesmente sobre o SQLite antigo não criptografado.**

Backups novos baixados pelo botão de exportação são cifrados com a senha escolhida. Backups antigos em JSON continuam legíveis e precisam ser protegidos. O app não sincroniza nem faz cópia automática fora da máquina. Use o botão **Restaurar backup** com cuidado, pois substitui o banco ativo.

## Limitações importantes da versão 0.2

- **Ainda não disponível:** busca na web em tempo real, cotações oficiais automáticas, integração direta B3, classificação automática de todos os FIIs, análise automatizada de todas as páginas de todos os relatórios, recomendações reguladas, cálculo tributário completo, API de voz Wispr, execução em segundo plano quando o computador está desligado, aplicativo Android nativo ou binário Tauri assinado.
- O cálculo de posições não contempla todos os eventos corporativos, desdobramentos, bonificações, amortizações, frações ou operações internacionais. Requer dados completos e correções antes de gerar relatório fiscal.
- O modelo IA local ou externo pode errar ao interpretar relatórios; sempre verifique o documento e a data-base.
- Resultados do simulador são **hipóteses matemáticas, não expectativas asseguradas**.
- O importador XLSX suporta planilhas Office comuns, mas não todos os recursos avançados de arquivos Excel (macros, planilhas criptografadas, algumas variantes ZIP).
- `node:sqlite` é um módulo experimental do Node.js 22; o arquivo deve ser testado e mantido em backup antes de usar para patrimônio real de longo prazo.

## Testes e estrutura

Execute `npm test` na pasta do projeto. O pacote inclui testes de domínio, importação, simulação, SQLite, permissões e análises locais.

```text
src/domain.mjs     - validações, posições, simulações e rendimentos
src/store.mjs      - persistência SQLite, backup, importações e CRUD
src/importers.mjs  - leitores CSV, XLSX e PDF com texto
src/ai.mjs         - IA híbrida, contexto autorizado, relatórios locais
server.mjs         - servidor loopback e APIs
web/               - interface responsiva, estilos e PWA manifest
instalar-linux.sh  - atalho e instalação por usuário
metrics-desktop-linux.sh - inicialização em janela independente
```

Projeto Apache-2.0. Todos os custos obrigatórios de licenças/serviços da v0.2 são zero, mas APIs opcionais, hardware, energia e operação não são gratuitos por definição. Antes de disponibilizar comercialmente, é necessária revisão regulatória e de segurança independente.

## Auditoria de funcionamento e limites, versão 0.3

O comando `npm test` executa verificações unitárias e uma integração real da API com banco temporário e XLSX de exemplo. Foi feito também um teste de interface em Chromium com respostas simuladas, verificando a navegação e o simulador multiativo sem erros JavaScript. O ambiente de validação bloqueou acesso HTTP direto pelo Chromium; **não foi completado um teste visual conectado ao backend real neste ambiente**. Isso deve ser repetido em Windows, Zorin e macOS antes de distribuir o aplicativo a investidores.

Não testamos um modelo Ollama real, autenticação em um provedor de IA com chave válida, nem arquivos reais de todos os formatos exportados da B3. Portanto, essas integrações dependem de testes adicionais no equipamento do usuário.

A aplicação ainda **não possui**: cotações atualizadas automaticamente, busca de documentos oficiais ao vivo, módulo tributário completo, auditoria independente de segurança, builds Tauri nativos, integração com Wispr Flow, cobertura confiável de todos os ativos globais ou notificações com o computador desligado. A IA não produz recomendações financeiras licenciadas. Apesar do progresso, não seria correto afirmar que o produto está 100% pronto para distribuição comercial.

**Para registro financeiro real:** conferir operações importadas, extratos e proventos com as instituições, fazer backup protegido periodicamente, manter cópia externa confiável e revisar os relatórios fiscais com documentação oficial.


## Instalador desktop (opcional, ainda não validado em hardware real)

A execução local `npm start` continua a opção **validada pelo teste HTTP** e precisa de Node.js no dispositivo. Para construir um executável nativo com Electron 38 e electron-builder 26:

```sh
npm install --no-audit --no-fund
npm run desktop:dev
npm run desktop:build
```

O `desktop/main.cjs` cria um processo Node interno isolado e mantém as APIs acessíveis apenas em loopback. A configuração `electron-builder.json` prevê **AppImage no Linux** e **EXE portátil no Windows**. Uma ação do GitHub (`.github/workflows/desktop.yml`) está preparada para compilar esses formatos em runners com acesso à internet. Não há assinatura de código, testes de instalação em máquina real nem binários finais incluídos neste arquivo ZIP.

Para priorizar o orçamento total de **R$ 50**, nenhuma licença ou serviço pago é obrigatório para executar localmente; o tempo de desenvolvimento, eventuais APIs externas e o hardware não estão incluídos.

## Preços COTAHIST da B3

No menu **Preços** escolha **Buscar último fechamento disponível** para tentar baixar um arquivo histórico diário diretamente da B3. Só são importados os tickers presentes em carteira ou na lista de desejos. Alternativamente, importe um arquivo oficial COTAHIST em ZIP ou TXT; confira a prévia antes de confirmar.

**Atenção:** o arquivo contém preços de fechamento **históricos e não ajustados**. Não são preços em tempo real, e podem não refletir grupamentos, desdobramentos, direitos ou distribuições. O formato e a infraestrutura pública podem mudar e causar falha na consulta. Uma importação COTAHIST fornecida pelo usuário não tem autenticidade criptográfica verificada.

Referências:
- B3: https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/mercado-a-vista/cotacoes-historicas/
- Layout: https://www.b3.com.br/data/files/33/67/B9/50/D84057102C784E47AC094EA8/SeriesHistoricas_Layout.pdf

## Conciliação fiscal (auxiliar, não documento oficial)

Classifique manualmente cada ticker em **Analisar**. No menu **Relatórios**, escolha o ano e clique em **Calcular resultados fiscais por mês**. O programa calcula volume vendido, custo proporcional ao preço médio registrado e resultado realizado por operação e mês. Exporta também CSV e Excel (.xlsx).

**Não** gera DARF nem determina imposto devido: ainda faltam IRRF, compensação de prejuízos acumulados, eventos societários, day trade, regras de títulos não cobertos e conferência de todas as movimentações. Sem histórico completo anterior ao ano, o custo médio pode estar errado. Use com documentação da Receita e assessoria fiscal apropriada.

- Receita Federal, bolsa: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/bolsa-de-valores-1
- Receita Federal, FIIs: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/fundos-de-investimento-no-brasil

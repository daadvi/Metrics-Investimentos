# Metrics Investimentos 2.9: Central de APIs

## O que esta versão entrega

- Uma tela **Minhas APIs** para cadastrar várias contas de fornecedores por carteira, trocar a chave e desconectar.
- Catálogo de símbolos sem digitar ticker: brapi `/api/available` e Alpha Vantage `LISTING_STATUS`. Dados ficam consultáveis localmente por código ou nome e em páginas.
- Sincronização explícita, por lotes de até oito tickers **já registrados** na carteira, lista de desejos ou posições no exterior. Consulta as fontes sob demanda e conserva data, moeda e procedência. Não cria operações, ordens nem lançamentos de proventos.
- Provedores existentes: brapi, Alpha Vantage, HG Brasil, Dados de Mercado e Massive. Para os três últimos, não foi verificada uma rota geral de universo; oferecem sincronização dos ativos acompanhados. Restrições de plano podem bloquear recursos.
- Credenciais separadas da base da carteira: quando `METRICS_PASSPHRASE` está disponível, um cofre AES-256-GCM no diretório privado local; caso contrário, chaves somente na memória da sessão. **Não** entram em `/api/state`, `/api/export`, nem nos backups JSON da carteira.

## Entender "a API inteira"

Uma chave abre os endpoints e recursos que seu plano autoriza. Não implica baixar todos os históricos, cotações e empresas disponíveis, nem acesso livre ou licença de redistribuição. O Metrics armazena somente um catálogo limitado de símbolos quando o provedor oferece esse recurso e consulta os demais dados por demanda.

## Segurança e privacidade

- Somente 5 provedores reconhecidos e hosts fixos; não aceitar URL arbitrária.
- O servidor aplica autenticação local e segregação por carteira já existentes. Nunca publique o cofre `.enc`, configurações pessoais ou extratos no GitHub.
- A Alpha Vantage exige a chave na query string de sua API `LISTING_STATUS`. O Metrics não registra essa URL; a própria plataforma pode ter logs de servidor. Para demais integrações existentes, mantém a forma de autenticação original.
- O cofre criptografado não integra automaticamente os backups existentes. Ao trocar dispositivo, crie novas chaves ou planeje exportação criptografada do cofre em atualização futura.
- Não há atualização contínua automática em segundo plano; ela é iniciada pelo usuário, para respeitar limites de uso.
- Não há validação ao vivo com credenciais reais durante o teste sintético deste pacote.

## Evoluções ainda possíveis

Autenticação por OAuth quando disponível, atualização agendada com consentimento e backoff, múltiplos lotes com botão **continuar**, índices por catálogo em SQLite, migração de credenciais entre carteiras com consentimento, catálogos com nomes e metadados do emissor, pesquisa consolidada entre provedores, e controle de licença/comercialização.

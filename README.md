# Metrics Investimentos 2.8 Integrity | Preview de engenharia

Atualização incremental de código-fonte para a versão 2.7 Structural, com instaladores encadeados desde 1.4 RC1/2.5/2.6. **Não é um EXE e não foi instalada nem publicada no GitHub.** Este kit não lê nem altera o banco de dados privado do usuário; a migração relacional 2.7 permanece **opcional**.

## Novidades

1. **Consulta keyset SQLite** em `/api/v28/history` com filtros de data/ticker, cursores HMAC e invalidação após gravações. Usa índice relacional em bancos normalizados **sem criptografia**. Em bancos criptografados, só descriptografa a coleção solicitada sem criar índices de ticker/data em texto simples; em bancos legados utiliza paginação em memória. A API anterior 2.7 continua disponível por compatibilidade.
2. **Dashboard inicial leve:** `/api/v28/dashboard` devolve resumo, posições agregadas, até seis transações recentes, quatro eventos futuros e último extrato de custódia, sem transferir todo o histórico de operações. Navegar para áreas que dependem de dados completos carrega a base legada sob demanda; as páginas Histórico paginado, Rentabilidade multiclasse, Importação assistida, Armazenamento seguro e Conciliação/TWR-XIRR continuam leves e consultam APIs específicas. **Ainda carrega o banco inteiro no servidor**, pois a normalização integral do fluxo de leitura de todas as telas é uma etapa separada.
3. **Conciliação de extrato de fluxos externos:** lê CSV/TSV de até 2 MB no servidor local, reconhece aporte/retirada, verifica diferenças/duplicatas e usa SHA-256 do arquivo. Confirmação exige verificação humana, repetição da conciliação no backend e grava somente metadados do extrato, nunca o arquivo inteiro. Não cria operações automaticamente. Validação independente de autenticidade do banco/corretora NÃO existe.
4. **TWR por fronteiras de fluxos e XIRR:** apura quando houver extrato de fluxos conciliado com cobertura integral, avaliações documentadas de início/fim e saldos imediatamente antes/depois de cada fluxo. Impede resultados enganosos em lacunas, moedas sem câmbio efetivo, avaliações inconsistentes ou múltiplas raízes. Não é imposto devido, nem certificação financeira.
5. **Nova aba Conciliação e TWR/XIRR** com processo explicado passo a passo, mensagens de bloqueio e formulários de evidência.

## Instalação sobre uma **cópia do código-fonte**

1. Exporte um backup criptografado por carteira e teste a restauração em ambiente isolado. Feche o aplicativo. Preserve a chave de criptografia da instalação anterior.
2. Duplique a pasta de código-fonte; nunca publique o SQLite ou extratos pessoais no GitHub.
3. Extraia este kit fora da pasta copiada e execute a prévia:

```bash
node "CAMINHO_DO_KIT/instalar-metrics-28.mjs" "CAMINHO_DA_COPIA_METRICS" --dry-run
```

4. Se não houver erro, repita sem `--dry-run`:

```bash
node "CAMINHO_DO_KIT/instalar-metrics-28.mjs" "CAMINHO_DA_COPIA_METRICS"
```

5. Na cópia atualizada: `npm install`, `npm test`, `npm start`. Faça os testes em carteira fictícia antes de considerar produção.

A instalação atualiza somente fontes da aplicação e deixa cópias de recuperação **fora da pasta principal** (`.metrics-v28-code-recovery`). A preparação das versões anteriores cria suas próprias cópias. Se a origem for uma v2.3 independente, código desconhecido ou projeto já alterado, o instalador recusa. **Não substitua um EXE real pelo ZIP.**

## CSV de extrato para reconciliação

Exemplo com dados fictícios:

```csv
Data;Tipo;Valor;Moeda;Referencia
01/01/2026;Aporte;1000,00;BRL;deposito-exemplo
15/02/2026;Retirada;100,00;BRL;retirada-exemplo
```

O Metrics compara com os aportes e retiradas já cadastrados na carteira. Datas de **cobertura completa** devem ser declaradas com responsabilidade; enviar só um período parcial não prova ausência de outros fluxos. Arquivos de posição/custódia não são documentos de transferência de caixa.

## Como funcionam os retornos

- Avaliação inicial e final `EOD`: o valor **total** da carteira, incluindo caixa e todas as classes, em BRL.
- Para cada dia de entrada/saída externa entre as datas, avaliação `PRE_FLOW` e `POST_FLOW` com documento datado e hash. Não use o valor de custo de aquisição no lugar do patrimônio.
- TWR une subperíodos entre os fluxos externos; XIRR resolve uma taxa anualizada para aportes/retiradas datados e valores inicial/final.
- A confirmação da revisão indica que o **usuário** conferiu os documentos. Não significa aprovação de contador, corretora ou auditor.
- Rendimento de renda fixa sem extrato, cotação sem fonte, ações internacionais sem conversão efetiva e operações em moeda não documentada bloqueiam o cálculo.

## Limitações e próximos testes obrigatórios

- Validar os testes completos do repositório real, abertura visual em Windows/Linux e compilação do EXE.
- Fazer testes de recuperação de banco SQLite real, inclusive migrações interrompidas e WAL, com autorização do proprietário.
- Performance da nova rota SQL deve ser medida em máquinas de baixa capacidade com bancos sintéticos grandes. A primeira visita ao dashboard é leve para rede/interface, mas ainda calcula agregados lendo o estado completo no backend.
- A importação é um CSV auxiliar genérico, não um adaptador homologado por instituições. OFX, layouts internacionais, eventos societários e autenticação criptográfica de documentos não estão implementados.
- Dados criptografados permanecem sem índices consultáveis de valor/data em texto simples, portanto não se promete paginação SQL completa nesse modo.
- Análise TWR/XIRR deve ser confrontada com contas independentes e documentos reais antes de uso financeiro. Não gera DARF nem aconselhamento de investimento.

Veja `docs/AUDITORIA_V28.md` para a lista de riscos e a matriz de testes.

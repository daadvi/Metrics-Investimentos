# Metrics Investimentos 1.4 RC1: APIs, CVM IPE/DFP, IA contextual e auditoria fiscal

**Status: candidata beta, não certificada para investimentos, declaração de imposto ou tempo real.** O aplicativo é local-first e gratuito para executar; planos de provedores de dados e serviços de IA são contratados diretamente pelo usuário, se desejar.

## Novidades principais

- **Nova aba “APIs e provedores”**: obtenha chaves nos sites oficiais e cole no aplicativo apenas durante a sessão. Não são salvas no SQLite, arquivos de configuração nem logs do Metrics. Suporte com consultas explícitas a cotações **brapi, Alpha Vantage, HG Brasil, Dados de Mercado e Massive**. Resposta inclui moeda, data-base e atraso estimado. Os dados gratuitos não são dados necessariamente ao vivo.
- **Proventos dos fornecedores**: Dados de Mercado, Alpha Vantage, HG Brasil e Massive, conforme planos e permissões da chave. Informações recebidas são **observações não verificadas oficialmente**; não geram pagamento, compra ou posição fictícia. Dados em USD ficam separados dos dados em BRL.
- **Fontes B3**: portal empresarial de APIs exige contratação/autorização apropriada; nenhuma API pessoal de cotações ao vivo gratuitas é prometida. Continue importando os relatórios oficiais exportados, quando compatíveis, e dados históricos permitidos.
- **CVM IPE**: índice de documentos de companhias abertas, selecionado por CNPJ e ticker. Importação local CSV/ZIP e botão de download anual quando o servidor CVM estiver acessível. O índice mostra categoria/data/arquivo; **não demonstra automaticamente valor de dividendos**.
- **CVM DFP**: importar CSV/ZIP de balanço, demonstração do resultado e fluxo de caixa, preservando escala, períodos e natureza individual/consolidada. Não calcula indicadores a partir de unidades incompatíveis.
- **IA híbrida**: instruções estruturadas e ferramentas de leitura de posições, desejos, fundamentos DFP, índice IPE, preços, proventos e pendências fiscais para modelos Ollama/OpenAI configurados. **Não treina automaticamente pesos ou fine-tuning de modelos externos**. Contexto privado só mediante autorização.
- **Auditoria fiscal v14**: checklist de documentação, lacunas, operações e retificações, mais exportação XLSX de **12 abas** com evidências. A saída deliberadamente **não contém DARF nem imposto devido certificado**.

## Instalação e cautela

1. Faça backup criptografado de **cada** carteira da versão anterior.
2. Para teste de código-fonte: instale Node.js >=22.13, execute `npm install`, `npm test` e `npm start`.
3. Para distribuir o Windows `.exe`: extraia o pacote v1.4, execute `PUBLICAR_METRICS_V14.cmd` no Windows com Git e GitHub CLI autenticados, revise o diff e confirme publicando. Aguarde o GitHub Actions concluir os testes e disponibilizar um artefato do Windows; **este ZIP não contém `.exe` compilado**.
4. Não envie arquivos pessoais, certificados, documentos fiscais, chaves, cookies ou bancos de dados ao repositório público.
5. Antes de decisões reais, confira cotações e proventos em fontes confiáveis e o relatório fiscal com documentos originais.

Veja `PROVEDORES_CONFIGURACAO_v14.md`, `VALIDACAO_WINDOWS_v14.md` e `QUALITY_REPORT.md` para instruções, limitações e cobertura de testes.

---

# Metrics Investimentos v1.3 RC1

**Release candidata: fontes trimestrais CVM, observações brapi v2 de proventos e auditoria de qualidade/fiscal.**

> É uma beta de software financeiro, não certificação de cotação ao vivo, recebimento de proventos ou Imposto de Renda. Use dados fictícios no teste inicial e confira documentos originais.

## Novidades validadas

- Importar ZIP/CSV do informe trimestral FII da CVM, vinculando CNPJ e ticker manualmente. Extrai somente colunas reconhecidas e deixa ausências vazias; o arquivo enviado não é autenticado criptograficamente.
- Consultar proventos de ações/FIIs via brapi v2, mediante chave e plano do próprio usuário; sandbox de FIIs aceita MXRF11/HGLG11 sem chave conforme a documentação. **Nunca são anúncios oficiais certificados.**
- Marcar eventos provenientes de `backfilled from FiiMonthlyReports` como datas sintéticas, não como calendário de recebimentos confirmados.
- Persistir observações de proventos separadas de eventos oficialmente comunicados/registrados. Não criar recebimento nem operação fictícia.
- Verificar falta de histórico de preços desde a primeira compra, idade da fonte e cobertura documental por carteira.
- Quadro fiscal mensal com valores de vendas, resultados matemáticos e avisos; **não gera imposto devido ou DARF**.
- IA ganha quatro ferramentas de leitura: trimestre CVM, proventos de terceiros, fontes de dados e quadro fiscal de conferência; busca documental local com ranqueamento BM25 aproximado.
- Menu lateral pode rolar em resoluções menores.

## Instalação e publicação do Windows

1. Faça **backup protegido com senha** da carteira atual.
2. Extraia o ZIP e, no Windows com Git e GitHub CLI autenticados, execute `PUBLICAR_METRICS_V13.cmd`.
3. Revise os arquivos para não enviar extratos, bancos, fotos, tokens nem dados pessoais a um repositório público. Confirme digitando `REVISAR` e depois `PUBLICAR`.
4. Em `https://github.com/daadvi/Metrics-Investimentos/actions`, aguarde a compilação e teste o `.exe` antes de migrar dados reais.
5. Para rodar o fonte localmente, utilize Node.js 22.13+ e o comando `npm start`; execute testes com `npm test`.

## Custos e privacidade

O produto não exige nova mensalidade e mantém os dados financeiros localmente. Ollama local pode exigir computador potente; provedores de IA e dados com chave própria podem cobrar. O valor de R$ 50 totais não cobre licenças comerciais de dados em tempo real, hardware nem assessoria fiscal.

## Limites comprovados

- CVM mensal e trimestral: o endpoint e o parser foram testados com respostas e fixtures controladas; não conseguimos acessar a CVM ao vivo deste ambiente. O trimestre real pode conter outros nomes de coluna, por isso o importador deve sinalizar as ausências.
- brapi v2: chamadas com estrutura documentada; não realizamos chamada de conta real paga; datas sintéticas não permitem declarar proventos confirmados.
- Preços: provedor opcional sujeito a atraso; não são dados licenciados de tempo real.
- Imposto: falta IRRF, saldos fiscais de abertura, compensações, day trade completo, exterior, renda fixa por informe e validação tributária por ano-calendário. Quadro novo NÃO é guia de pagamento nem valor definitivo para declaração.
- Segurança: falta assinatura do executável e auditoria independente; extensão nativa `sqlite-vec` não foi adicionada devido à exigência de componentes binários e permissões extras. Em vez disso, a pesquisa usa ranking lexical local, que não exige acesso de terceiros aos documentos.

Consulte `QUALITY_REPORT.md`, `PLANO_FONTES_DADOS_v13.md` e `CHECKLIST_WINDOWS_v13.md` antes de publicar.

---

## Documentação da arquitetura anterior

# Metrics Investimentos 1.2 RC1

**Status:** versão candidata. A nova integração CVM é implementada e testada com arquivos representativos, mas **não validada com um arquivo oficial real nem com o executável Windows** neste ambiente.

## Novidades

- **Fontes e CVM:** nova aba para importar ZIP/CSV do Informe Mensal Estruturado de FII da CVM. O usuário deve informar um vínculo **CNPJ de 14 dígitos → ticker**. O Metrics não tenta identificar tickers por similaridade de nome.
- **Download oficial sob demanda:** acesso restrito à URL anual do portal de dados abertos da CVM. Sem credenciais, sem busca geral na internet e com limites de arquivo e tempo.
- **Fundamentos documentados:** patrimônio líquido, valor patrimonial por cota, cotistas e dividend yield mensal **somente quando existirem colunas correspondentes**. O sistema guarda data-base, eventual data de publicação, origem e alerta sobre a ausência de assinatura digital do arquivo.
- **Conciliação de proventos:** cruza data-com, posição histórica elegível e proventos registrados; aponta inconsistências sem atribuir status oficial ao anúncio. Bonificações, grupamentos e desdobramentos posteriores a extratos entram no cálculo da quantidade elegível.
- **Controle de defasagem das cotações:** indica se há preços, sua data, origem e idade. Dados de brapi com plano gratuito não são tempo real.
- **Dossiê fiscal no fim do ano:** renda fixa com resgates e investimentos internacionais são avaliados **na data de 31/12**, sem usar movimentos futuros. Valores de renda fixa são provisórios e exigem informe da instituição.
- **IA:** ferramentas de leitura dos fundamentos CVM importados, da conciliação dos proventos e da qualidade dos preços, sem modificar o banco.

## Instalação

Node.js 22.13+, `npm install`, `npm start` (ou `iniciar-windows.cmd`). O executável portátil Windows deve ser compilado no GitHub Actions após publicar o código e **não acompanha este ZIP**. No Windows, confira `CHECKLIST_WINDOWS_v12.md` antes de substituir o aplicativo anterior.

O banco local é SQLite. Para proteger a base de dados, configure uma senha de criptografia ou o mecanismo do launcher Electron conforme a documentação; **não pressuponha que o banco esteja criptografado por padrão em qualquer ambiente**. Faça backup **antes da atualização**.

## Importar dados CVM

1. Acesse a aba **Fontes e CVM**.
2. Informe o CNPJ **do fundo** e seu ticker, verificando o vínculo em documento oficial.
3. Se tiver internet, clique em **Consultar CVM oficial** (arquivo anual da CVM). Alternativamente, baixe o arquivo anual ZIP em https://dados.cvm.gov.br/dataset/fii-doc-inf_mensal e selecione o ZIP local.
4. Em **Prévia**, confirme quantos registros foram reconhecidos; clique em **Importar** para salvar.
5. Confira a data-base e os campos. Se o CSV não tiver coluna de determinado indicador, o Metrics mostra **ausente**, nunca zero.

**Importante:** o Informe Mensal CVM não fornece preços de mercado em tempo real ou todos os anúncios de proventos; alguns fundos podem não aparecer nos arquivos por diferenças de regime, prazo e estrutura de cadastro. Não confunda dado oficial **disponibilizado no site** com arquivo **fornecido manualmente** e ainda não autenticado.

## Proventos e cotação

O Metrics reconcilia eventos informados com as operações gravadas na carteira. A natureza tributária e autenticidade do anúncio precisam ser verificadas. Para ações/FIIs, a integração opcional brapi usa chave própria e possui atraso conforme o plano. Para proventos oficiais em escala comercial, é preciso contratar fonte com cobertura e direitos de uso adequados.

## Imposto de Renda

O dossiê é **auxiliar**. Os valores se originam dos lançamentos confirmados; faltas de aquisição, compensações, IRRF, day trade e regras internacionais impedem apuração completa. Consulte o sistema oficial **ReVar** (https://www.gov.br/pt-br/servicos/apurar-imposto-sobre-renda-variavel), os informes de rendimentos e notas de corretagem. **Não copie números sem conciliação** e não trate este aplicativo como declaração transmitida ou aprovada pela Receita.

## Testes e limitações

`npm test` executa as suítes existentes e as novas verificações CVM, datas de proventos, migração e fiscal. O ambiente confirmou **137/137** testes. Uma navegação da interface foi testada com Chromium e API local usando documento fictício. Não foram validados aqui: download ao vivo da CVM, feed de brapi pago, anúncios de proventos reais de cada emissor, IR completo, assinatura digital do EXE ou migração no Windows real.

## Arquivos importantes

- `QUALITY_REPORT.md`: resultado de testes, falhas conhecidas e cobertura.
- `PLANO_FONTES_DADOS_v12.md`: alternativas oficiais e comerciais e as escolhas por custo/licença.
- `CHECKLIST_WINDOWS_v12.md`: atualização do executável, backup e verificação.
- `AGENTS.md`: orientações para continuar o trabalho no Codex.
- `PUBLICAR_METRICS_V12.cmd`: revisão e publicação do código no GitHub. **Não envie bancos, chaves ou documentos pessoais ao repositório público.**

Licença: **Apache-2.0**, conforme `LICENSE`.

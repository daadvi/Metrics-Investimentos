# Conectar provedores de dados: Metrics 1.4 RC1

As chaves são usadas **somente durante a sessão do aplicativo**. As APIs podem mudar seus preços, limites, formatos e condições de redistribuição. O Metrics é cliente local; não redistribui cotações em servidor público. Para uma versão comercial, confirme os termos e a licença com cada fornecedor.

## Passos no aplicativo

1. No Metrics, abra **APIs e provedores** na barra lateral.
2. Identifique a fonte e clique **Obter chave/documentos**. Crie a conta no domínio oficial, respeitando seus termos, e copie a chave no painel do próprio fornecedor.
3. Retorne ao Metrics, selecione a fonte, informe o ticker e cole a chave no campo protegido por máscara; clique **Consultar e salvar cotação**. O aplicativo apresenta data-base, moeda, fornecedor e aviso de atraso.
4. Para históricos de proventos, selecione o fornecedor na caixa **Proventos de provedores**. Para ações via Dados de Mercado, informe o código CVM da companhia; para FIIs elegíveis ao endpoint REIT, apenas o ticker.
5. Chaves são temporárias, não salvas no banco. Ao reiniciar o aplicativo, poderão ser solicitadas novamente. **Nunca envie chaves para a conversa com a IA.**
6. Se uma API negar a consulta com 401/403/429, verifique plano, ticker e limites no painel do fornecedor. A ausência de dados não é zero.

## Provedores

| Origem | Cadastro e chave | Documentação | Dados e limites |
| --- | --- | --- | --- |
| brapi | https://brapi.dev/dashboard | https://brapi.dev/docs | Preços de ações/FIIs B3 conforme chave. Plano gratuito sujeito a atraso de aproximadamente 30 minutos e limites; suporte anterior de proventos depende do plano. |
| Alpha Vantage | https://www.alphavantage.co/support/#api-key | https://www.alphavantage.co/documentation/ | `GLOBAL_QUOTE`, `DIVIDENDS`; ações globais, incluindo EUA. Chave gratuita com cerca de 25 consultas/dia; dados intradiários premium. Dividendos sujeitos a cobertura e acesso. |
| HG Brasil | https://console.hgbrasil.com/ | https://hgbrasil.com/docs/finance/dividends/ | `v2/finance/quotes` e `v2/finance/dividends`; proventos exigem plano compatível, e a conta pode não ter permissão. |
| Dados de Mercado | https://www.dadosdemercado.com.br/api/docs | https://www.dadosdemercado.com.br/api/docs | Cotação diária, dividendos de FIIs e companhias (código CVM exigido para ações). Token e permissões variam conforme plano. |
| Massive Stocks | https://massive.com/stocks | https://massive.com/docs/rest/stocks/corporate-actions/dividends | Preço diário EUA e dividendos em USD. Plano básico gratuito anunciado com limites de histórico (2 anos) e requisições (5/min). |
| B3 portal empresas | https://developers.b3.com.br/ | https://developers.b3.com.br/apis/api-listados | APIs comerciais empresariais B2B. A publicação do catálogo não garante API gratuita para uma pessoa física. |
| CVM dados abertos | https://dados.cvm.gov.br/ | https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe | Dados periódicos e documentos sem chave. Não são cotações ao vivo nem anúncios inferidos por IA. |

## CVM IPE e DFP

- IPE: na seção **Índice IPE**, informe CNPJ verdadeiro da companhia e seu ticker; importe CSV/ZIP do ano ou tente download oficial. Metadados não são conteúdo do comunicado. Clique no documento original quando houver link confiável para conferir o valor e as datas de proventos.
- DFP: baixe em https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp um CSV específico, como DRE consolidada; informe CNPJ e ticker e use **Prévia DFP** antes de **Importar DFP**. O importador limita arquivo, volume e quantidade de contas. Em CSV isolado não é possível sempre deduzir a demonstração, que será marcada como não identificada quando necessário.
- Importe documentos periodicamente. No uso offline, permanecem apenas os dados importados anteriormente. Não se presume autenticidade criptográfica de arquivo selecionado no computador.

## Limites e privacidade da IA

Ollama local: não há requisição a provedor externo (salvo o download inicial do modelo). OpenAI com chave própria: perguntas autorizadas e resultados das ferramentas podem ser enviados para processamento. Ferramentas são somente leitura; a IA não faz ordens nem alterações da carteira.

Conectar API ou modelo **não executa treinamento dos pesos**; a configuração fornece instruções de comportamento e acesso contextual autorizado a dados estruturados, calculados quando solicitados. Modelos locais ou externos podem ignorar instruções ou falhar; confira os fatos na documentação e nos valores de ferramentas.

## Imposto de Renda

Em **Relatórios → Auditoria fiscal v14**, selecione o exercício e execute a auditoria. Exporte JSON/Excel com os alertas e a origem das observações. A ferramenta não calcula valor devido integral nem emite DARF. Confira extratos e informes com o serviço oficial https://www.gov.br/pt-br/servicos/apurar-imposto-sobre-renda-variavel e profissional habilitado quando necessário. As regras mudam por exercício e modalidade.

# Arquitetura do Metrics 0.2

## Visão geral

```text
                  Interface web local (HTML/JS/CSS)
                               |
                     localhost:4173 / API
                               |
    +--------------------------+------------------------+
    |                          |                        |
  Domínio                   Importador               Metrics AI
 posições, custos      CSV / XLSX / PDF         - resumo determinístico
 simulações, renda         com prévia             - Ollama 127.0.0.1
    |                           |                    - OpenAI BYOK
    +--------------------------+------------------------+
                               |
                      SQLite local (payload)
                     opcionalmente AES-GCM
```

## Compromissos essenciais

- Apenas `127.0.0.1` é exposto. Alterações exigem `X-Metrics-Local: 1`, com controles de Host e Origin. O modelo não pode gravar operações da carteira.
- A IA consulta contexto **somente com opt-in**. A versão externa recebe o contexto aprovado. Chaves ficam apenas em memória de processo/browser e são usadas na requisição, não salvas no banco.
- SQLite persiste os dados localmente, em transação ACID, com migração de JSON legada e backup pre-migração. Payload inteiro é cifrado opcionalmente, não por padrão.
- Identificações de origem e data-base são obrigatórias como premissa de qualidade para fichas. Nenhum valor sem cotação vira preço de mercado.
- Importadores classificam operações somente com evidência suficiente. Todas as inserções por lote são atômicas e reversíveis.
- O modelo não executa código fornecido por documentos, nem possui ferramentas de navegação/autenticação em sites.

## Modelos

`Transaction` é BUY, SELL ou DIVIDEND. `WatchItem` nunca conta na carteira. `Quote` é preço **manual** datado. `AssetProfile` é estrutura declarada pelo usuário, separada de posição, com tipo, número de ativos, ocupação, dívida, resultados e fonte. `Event` tem valor por cota estimado/confirmado informado, com data. `Document` armazena trechos para IA e data-base declarada.

## Invariantes financeiros

- Vendas não ultrapassam saldo, conferido cronologicamente.
- Preço médio usa custo médio ponderado de compras com taxas; lucro realizado usa custo médio das unidades vendidas.
- Proventos não são somados ao custo das posições até que haja compra registrada.
- Simulador usa cotas inteiras e saldo de caixa, dividendos calculados antes do aporte mensal, variáveis de juros/preço especificadas em parâmetros, resultado nominal e real.
- Valores de mercado aparecem apenas quando todas as posições relevantes têm preços manuais datados; partials são explicitamente parciais.

## Limites e próximos aperfeiçoamentos

Cotações licenciadas, pesquisa documental com páginas citáveis, sistema de fatos estruturados da CVM, OCR de documentos digitalizados, XIRR/TWR confiáveis após suporte a todos os fluxos de caixa, split/inplit, controle fiscal por ano, modelo local integrado ao empacotamento, assinaturas, atualização automática do aplicativo e verificações de segurança estão fora desta versão.

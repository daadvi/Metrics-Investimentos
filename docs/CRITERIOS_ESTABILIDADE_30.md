# Metrics Investimentos 3.0 | Política de estabilidade

## O que está implementado nesta atualização

- Base 2.9 com Quality Update (interface persistente, auditoria de fontes, comparação, alocação, diagnóstico das APIs).
- Corrige seis botões de documentos oficiais, fluxos, avaliações e Academia que aplicavam `forEach` em um único elemento em vez de uma lista.
- Número de versão coerente entre `package.json`, endpoints `/api/health` e `/api/v26/...` e console de inicialização.
- Testes antigos deixam de exigir exclusivamente `-preview`.
- Teste real (com dados sintéticos e SQLite temporário) para inicialização da API, autenticação e separação de carteiras.
- Gate de release: sintaxe, suíte completa e testes de navegador.
- Pipeline para validação Windows e Linux, com construção de EXE portátil e AppImage, geração de SHA-256 e arquivos de diagnósticos em caso de falha.

## Critérios antes de declarar estável

1. **Windows e Linux**: testes unitários, de integração e Chromium todos verdes.
2. **Banco de dados**: testar backup/restauração, migração, senha correta/incorreta, múltiplas carteiras e atualização a partir de uma cópia anônima de dados de versões antigas.
3. **Empacotamento**: gerar EXE e AppImage no CI e executar manualmente com base de teste em hardware real. Verificar dependências, travamentos e encerramento seguro do SQLite.
4. **Fontes**: executar testes sob demanda com chaves próprias e dados reais redigidos, sem expor credenciais; contratos/limites de API podem variar.
5. **Fiscal**: não promover ferramenta de trabalho a calculadora fiscal certificada. Receitas e regras tributárias devem ser avaliadas por profissional habilitado.
6. **Segurança**: revisar permissões, tratamento de links, cofre de chaves, dependências e assinatura de distribuição. EXE sem assinatura pode causar alertas do Windows.

Nenhum aplicativo complexo pode ter funcionamento de 100% garantido em todo hardware, plano de API, versão de SO ou situação de dados. O gate torna falhas reproduzíveis, e bloqueia promoção automática à principal até revisão.

## Uso

O kit de publicação cria a branch `release/3.0.0` e abre um PR, para que os workflows testem a versão antes de entrar na `main`. Após aprovação dos checks e validação manual do EXE, fazer merge. Não pule os testes de release e não publique bancos, extratos, tokens ou backups em repositório público.

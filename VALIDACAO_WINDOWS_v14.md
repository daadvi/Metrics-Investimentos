# Checklist de validação do executável Windows v1.4

**Antes de instalar:** faça backups cifrados da v1.3 (ou da versão realmente usada) e preserve a cópia antiga. Não importe documentos pessoais num repositório público.

1. Compilação GitHub Actions concluída e artefato EXE baixado do próprio repositório, sem falhas de teste.
2. Abra o EXE e confirme que a versão aparece como `v1.4 RC1` e que a tela inicial carrega sem erro.
3. Verifique que todas as carteiras anteriores, as operações e a lista de desejos continuam lá, sem duplicidade.
4. Abra `APIs e provedores`; confira os sete fornecedores e links. Não cole a chave em chats ou screenshots.
5. Opcional: com uma chave válida, consulte apenas uma ação, confira data e moeda com o painel do fornecedor. Falhas HTTP 401/403/429 devem exibir avisos e não modificar a carteira.
6. Para proventos (se o plano permitir), consulte um registro e confirme a marca **dados de terceiros**; ele não pode se transformar em provento recebido sem conferência.
7. Na seção IPE, escolha um arquivo CVM CSV/ZIP, vincule CNPJ e ticker, faça prévia, importe, reinicie o aplicativo e confira que os registros continuam disponíveis. Teste com arquivo anonimizado antes do real.
8. Importe DFP CSV específico, verifique unidade, data-base, companhia, versão e indicador não identificado quando não houver contexto.
9. Em `Relatórios`, rode a auditoria do exercício. Confirme que aparece `não certificado` e os avisos de documentos ausentes.
10. Exporte Excel e confira as 12 abas: posições, vendas, proventos, 31/12, amortizações, avisos, outras classes, informes, auditoria, IPE, preços USD e proventos de terceiros.
11. Troque de carteira e confira que as observações e documentos privados não aparecem na outra.
12. Feche e abra o EXE, teste um backup criptografado e restauração em banco fictício, nunca no seu único banco original.
13. Se ocorrer qualquer divergência, interrompa o uso com dados importantes, preserve backups e abra um issue com logs **sem dados pessoais**.

**Não validado pelo ambiente de desenvolvimento:** build nativo Windows 1.4, servidor real CVM, chaves reais das APIs, compatibilidade com todos os formatos de PDF e apuração completa de IR. Esses são critérios pendentes de validação.

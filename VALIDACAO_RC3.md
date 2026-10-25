# Roteiro de validação no Windows | Metrics 1.0 RC3

**ANTES DE INSTALAR:** exporte backup criptografado de **cada carteira** na versão anterior e preserve o `.exe` antigo até confirmar a migração.

1. Abra RC3, confira os nomes e posições de todas as carteiras.
2. Em uma carteira de teste, adicione uma compra com data, quantidade, preço e taxa.
3. Em **Carteira > Histórico completo**, pesquise o ticker e clique **Editar**.
4. Corrija data e quantidade. Confirme que a linha não duplicou e que custo/preço médio foram recalculados.
5. Clique **Desfazer última ação** e verifique a volta exata do lançamento.
6. Crie uma venda posterior; tente excluir a compra que daria origem à venda. O Metrics deve **bloquear** a exclusão.
7. Exclua uma operação independente e restaure-a com **Desfazer**.
8. Feche e abra o aplicativo. Verifique que o lançamento permanece e que a trilha de correções da carteira existe.
9. Experimente desfazer um lote na aba Importar B3 (não no botão de desfazer transação individual).
10. Exporte o relatório fiscal auxiliar de um período afetado pela edição e confira-o com comprovantes. Não entregue a declaração usando apenas o Metrics.
11. Confirme que uma edição na carteira A não alterou a carteira B.
12. Teste o modelo Ollama ou a chave externa, se configurados, **sem inserir dados reais sensíveis** na primeira execução.

**Estado nesta entrega:** 113 testes automatizados passaram no ambiente Linux com Node.js 22. Foi validado o fluxo de interface em Chromium com a API real usando uma ponte em memória, pois a rede localhost do navegador automatizado é bloqueada neste ambiente. A execução do novo `.exe` no Windows depende do GitHub Actions e dos seus testes locais.

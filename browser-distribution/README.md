# Metrics Browser Folder + atalho Windows | Kit de distribuicao

Este kit **nao e o ZIP final do usuario**: ele prepara e publica os arquivos necessarios para o GitHub Actions produzir uma pasta com Node portatil, SQLite, codigo do Metrics, HTML de entrada, scripts ocultos e criador de atalho.

## Para o autor: publicar no GitHub

1. Extraia todo o kit e abra `PUBLICAR_GITHUB_ATALHO.cmd`.
2. O script baixa a branch `release/3.0.0`, aplica a correcao dos dois seletores da lista de desejos e testa o codigo (`npm test` e Playwright).
3. Leia o resumo do commit. Se estiver correto, digite `PUBLICAR`. O script cria uma branch `feature/metrics-browser-...`, sem tocar na branch principal.
4. Abra [Actions do Metrics](https://github.com/daadvi/Metrics-Investimentos/actions), selecione o workflow **Metrics Browser | Pasta Windows portatil** e aguarde que o teste e o pacote terminem com sucesso.
5. Baixe o artefato `Metrics-Browser-Windows`. Ele contem `Metrics-Browser-Windows.zip`, o pacote real para distribuir. Para acesso publico permanente, publique esse ZIP como um ativo de **GitHub Releases**. A compilacao nao equivale a assinatura digital.

A integracao do Pull Request em `main` so deve acontecer apos revisar os testes. Sem confirmacao final, o publicador nao envia codigo. As pastas pessoais dos investidores nao sao enviadas.

## Para quem vai usar

O usuario baixa o ZIP pronto do GitHub Releases, extrai-o e abre `CRIAR_ATALHO.vbs` **uma unica vez**. O arquivo cria o atalho **Metrics Investimentos** na area de trabalho. Clicar no atalho inicia o servidor local **sem Prompt de Comando** e abre o navegador padrao automaticamente. `FECHAR_METRICS.vbs` encerra o servidor.

O HTML `ABRIR_METRICS.html` pode pedir ao Windows para abrir o Metrics se, durante `CRIAR_ATALHO.vbs`, o usuario tiver aceito registrar o protocolo `metrics-investimentos-local:`. O navegador podera pedir confirmacao. **Nao existe forma segura de um HTML local iniciar o Node.js sem uma etapa nativa previa**.

O ZIP final contem `runtime/node.exe` e `codigo/node_modules`, para nao exigir instalacao previa de Node ou Git no computador do usuario. Se o Windows bloquear scripts VBS por politica local, a distribuicao precisara de instalador executavel assinado, nao de desativar as protecoes.

## Limites de validacao

Os scripts de build e o supervisor local podem ser testados com dados artificiais. A criacao de atalhos VBS, a integracao com o protocolo e o ZIP Windows completo exigem rodar no Windows real/GitHub Actions. Nao afirme funcionamento de 100% sem esses testes. A infraestrutura SQLite e as APIs continuam sendo processadas pelo servidor local, nao pelo `file://`.

Dados de carteira de uma instalacao Electron anterior **nao** migram automaticamente: exporte e restaure backup criptografado, se necessario.

---

## Correcao do envio GitHub

Leia `README_CORRECAO_PUBLICACAO.md`. Este pacote substitui `git push -u` por verificacao remota do SHA, aceita retomar um commit local nao enviado e preserva os testes obrigatorios.

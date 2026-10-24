# Gerar o .exe pelo GitHub Actions

## O que existe neste pacote

- Projeto Metrics Investimentos versão 0.4.0 e testes locais.
- `.github/workflows/desktop.yml`: compila **EXE portátil para Windows x64**, executa testes e publica um artefato para download.
- `PUBLICAR_GITHUB_WINDOWS.ps1`: cria e publica o repositório público usando Git e GitHub CLI (exige confirmação explícita).

## Caminho simples no Windows

1. Instale [Git](https://git-scm.com/download/win) e [GitHub CLI](https://cli.github.com/) (ambos gratuitos).
2. Extraia este ZIP.
3. Abra o PowerShell **dentro da pasta extraída** e execute `./PUBLICAR_GITHUB_WINDOWS.ps1`.
4. Autorize o GitHub e confirme digitando `SIM` depois de revisar os arquivos: serão públicos.
5. Abra o repositório criado, entre em **Actions** e clique em **Windows EXE | Metrics Investimentos**.
6. Aguarde a execução ficar verde. Em **Artifacts**, baixe `Metrics-Investimentos-Windows-EXE`.
7. Descompacte o artefato: o `.exe` está dentro. O Windows poderá exibir aviso por não ser assinado digitalmente.

Caso o PowerShell bloqueie scripts, rode no terminal aberto nessa pasta: `powershell -ExecutionPolicy Bypass -File ./PUBLICAR_GITHUB_WINDOWS.ps1`.

## Alternativa manual, sem GitHub CLI

1. Crie um repositório público vazio chamado `metrics-investimentos` no GitHub, sem README ou .gitignore automáticos.
2. Envie os arquivos desta pasta preservando `.github/workflows/desktop.yml` (pelo Git ou pela página de upload).
3. Entre em **Actions**, selecione o workflow e clique em **Run workflow** se ele não iniciou após o envio.
4. Quando concluir, acesse **Artifacts** para baixar o `.exe`.

## Limitações

- Não é um `.exe` compilado: este pacote prepara a compilação. O binário precisa ser produzido em um runner Windows do GitHub.
- Necessita acesso à internet durante a compilação para instalar Electron/electron-builder.
- O `.exe` não é assinado; alguns sistemas podem exibir alerta de editor desconhecido.
- Tests no CI não substituem testes interativos no Windows real e revisão de segurança.
- Não inclua planilhas, extratos reais, senhas, tokens, backups nem bancos SQLite no repositório público.
- A primeira build pode falhar por motivos de dependências ou incompatibilidade; confira os logs em Actions.

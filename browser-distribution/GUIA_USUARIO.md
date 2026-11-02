# Metrics Investimentos para navegador (Windows)

O arquivo desta distribuicao é um ZIP completo, produzido pelo workflow **Metrics Browser | Pasta Windows portatil** no GitHub Actions. Depois de baixar, extraia toda a pasta **Metrics Investimentos** para um lugar definitivo, por exemplo `Documentos\\Metrics Investimentos`.

## Primeira vez

1. Abra `CRIAR_ATALHO.vbs` com dois cliques. Ele cria o atalho **Metrics Investimentos** na área de trabalho, sem exigir direitos de administrador.
2. O instalador pergunta se você deseja registrar o protocolo local para abrir o Metrics também pelo arquivo `ABRIR_METRICS.html`. Se aceitar, o navegador poderá pedir autorização ao abrir um programa externo.
3. Abra o atalho da área de trabalho. Ele inicia o servidor em segundo plano e abre o navegador padrão, já com autorização local.
4. Para encerrar o servidor, use `FECHAR_METRICS.vbs`. Fechar apenas a aba do navegador não encerra automaticamente o processo local.

Depois da primeira vez, o atalho abre o Metrics com um clique. Não há Prompt de Comando visível. Não é necessário instalar Git ou Node.js, porque a pasta contém `runtime/node.exe`. Se os arquivos `.vbs` estiverem bloqueados por políticas de segurança do computador, peça autorização ao administrador. Não desative proteções para contornar essas políticas.

## HTML e segurança

O HTML **não executa Node.js**. Quando o protocolo opcional é registrado, ele apenas solicita ao Windows que abra o iniciador instalado. O navegador poderá mostrar uma confirmação. Sem a configuração inicial, use diretamente o atalho da área de trabalho.

O Metrics usa somente `127.0.0.1` e mantém o banco SQLite na pasta de dados locais da aplicação. O arquivo HTML e o atalho não contêm senhas, tokens ou dados de carteira. A internet continua opcional para funcionalidades locais e necessária para conectar APIs de terceiros.

## Importante

- **Não distribua** bancos SQLite, extratos, backups, tokens, configurações pessoais ou `LOCALAPPDATA` no GitHub.
- O executável Node incluído vem do ambiente oficial do GitHub Actions. O ZIP resultante não é assinado digitalmente. Sempre baixe do repositório do autor e confira os avisos de segurança do Windows.
- Se o navegador não abrir, consulte `%LOCALAPPDATA%\\Metrics-Investimentos\\browser-launcher.log` (sem URL de autenticação).
- O Metrics mantém as carteiras locais; esta atualização não migra automaticamente dados do EXE Electron anterior. Faça um backup criptografado para migração, se necessário.
- Depois de criar o atalho, não mova a pasta. Se mover, execute `CRIAR_ATALHO.vbs` novamente na pasta nova.

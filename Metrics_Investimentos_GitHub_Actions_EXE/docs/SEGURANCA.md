# Segurança e privacidade — v0.2

O Metrics usa servidor acessível somente em loopback, cabeçalho não simples nas rotas de alteração, verificação de origem/host, CSP de UI, validação de campos e armazenamento local. Isso reduz exposição, mas não substitui uma auditoria profissional.

**Dados persistidos:** SQLite, sem criptografia por padrão. Uma instalação nova pode usar `METRICS_PASSPHRASE` para criptografia AES-256-GCM do payload. A senha não é enviada a serviços externos. Proteja backups JSON separados.

**IA:** conversas e contexto são enviados a provedor externo apenas se ele for escolhido pelo usuário. Contexto de carteira e documentos exige opção de consentimento. Documentos importados são considerados dados não confiáveis. A IA não possui permissão de executar ordens ou modificar operações.

**Imports:** limite de 5 MB por arquivo; XLSX é parseado como ZIP/XML local, CSV como texto, PDF por pdftotext sem shell; macros nunca são executadas. Linhas não reconhecidas não são lançadas. Importações são transações atômicas e podem ser revertidas.

**Riscos restantes:** modelo de IA pode errar; Node SQLite experimental; sem auditoria de dependências/pen test independente; restauração não é backup automático; alguns formatos Excel comprimidos podem ser recusados; relatórios HTML para impressão não equivalem à declaração de IR; browser externo, plugin ou malware local podem acessar dados do próprio usuário se tiverem privilégios de sistema.

Não instale extensões desconhecidas nem armazene senha de banco/corretora nos campos livres do aplicativo. Não compartilhe o backup com terceiros.

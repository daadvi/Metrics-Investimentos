# Segurança e privacidade — Metrics 0.5

- Servidor restrito ao loopback local, autenticação via cookie HttpOnly, verificação de origem e cabeçalho específico em mutações, CSP e janela Electron isolada.
- Banco usa SQLite local. Com `METRICS_PASSPHRASE`, o conteúdo do registro é criptografado com AES-256-GCM. No Electron, onde `safeStorage` de fato usa backend seguro, uma chave aleatória protegida pelo sistema operacional é configurada automaticamente.
- A migração automática de banco antigo **não criptografado** só ocorre com `METRICS_MIGRATE_ENCRYPT=1`; operação transacional, com `secure_delete` e `VACUUM` para reduzir vestígios. Isso não elimina arquivos JSON, cópias externas ou backups antigos em plaintext.
- Sem backend seguro de chave, o desktop poderá operar sem criptografia; conferir em Ajustes.
- PDFs são processados localmente. O PDF.js reduz dependências de executáveis externos, mas não dispensa limites, testes de entrada maliciosa e atualizações de segurança.
- Ferramentas de IA não modificam operações nem executam shell. Contexto e documentos somente com consentimento; fornecedor externo pode receber informações autorizadas. A máscara básica CPF/e-mail não garante anonimização.
- Backups com senha do usuário e restore exigindo confirmação. Não publicar arquivos pessoais no GitHub.
- **Pendências:** auditoria independente de segurança, testes de instabilidades/recovery, assinatura digital de EXE, política de atualizações de dependências, revisão de privacidade/LGPD e instalação Windows real.

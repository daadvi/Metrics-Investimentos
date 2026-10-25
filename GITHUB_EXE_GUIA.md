# Publicar e compilar a v1.4 RC1

1. Leia o aviso sobre repositório público e faça backup de cada carteira antes de atualizar.
2. Extraia o ZIP da v1.4 e execute `PUBLICAR_METRICS_V14.cmd` no Windows com Git e GitHub CLI autenticados.
3. Digite `REVISAR`, inspecione `git diff --cached --stat` e confira se nenhum arquivo pessoal está incluído; depois `PUBLICAR`.
4. O commit disparará GitHub Actions (`.github/workflows/desktop.yml`). Aguarde todas as verificações terminarem com sucesso.
5. Baixe o artefato `Metrics-Investimentos-Windows-EXE` no Actions e execute com carteira de teste antes de migrar dados reais.

O projeto não foi automaticamente enviado ao GitHub nesta entrega, e o ZIP não contém um `.exe` já compilado.

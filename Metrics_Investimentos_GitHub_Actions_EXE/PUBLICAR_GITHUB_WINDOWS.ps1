# Rode este script com PowerShell dentro da pasta extraída.
# O projeto será publicado como repositório PÚBLICO no seu GitHub.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Instale o Git for Windows: https://git-scm.com/download/win' }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Instale o GitHub CLI: https://cli.github.com/' }
Write-Host 'Metrics Investimentos | publicar para gerar EXE pelo GitHub Actions'
Write-Host 'ATENÇÃO: os arquivos desta pasta ficarão PÚBLICOS. Revise antes de confirmar.'
$answer = Read-Host 'Publicar este projeto como código aberto? (SIM/não)'
if ($answer -ne 'SIM') { Write-Host 'Operação cancelada.'; exit 0 }
gh auth status 2>$null
if ($LASTEXITCODE -ne 0) { gh auth login --hostname github.com --web --git-protocol https }
if (-not (Test-Path .git)) { git init -b main }
# Confere se a identidade Git local está configurada.
$name = git config user.name
$email = git config user.email
if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($email)) {
  throw 'Configure seu nome/email para commits: git config --global user.name "Seu nome"; git config --global user.email "seu-email"'
}
git add .
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m 'Metrics Investimentos v0.4 - Windows build workflow' }
gh repo create metrics-investimentos --public --source . --remote origin --push
if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar repositório. Confira se já existe um repo com esse nome.' }
Write-Host 'Repositório enviado. No GitHub: Actions > Windows EXE | Metrics Investimentos.'
Write-Host 'Baixe o arquivo em Artifacts quando a execução ficar verde.'

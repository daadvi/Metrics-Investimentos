# Metrics Investimentos - publica o código em um repositorio existente.
# Execute pelo arquivo ENVIAR_METRICS_GITHUB.cmd ou em PowerShell nesta pasta.
$ErrorActionPreference = 'Stop'
$repo = 'daadvi/Metrics-Investimentos'
$root = $PSScriptRoot
Write-Host 'METRICS INVESTIMENTOS | Publicar e compilar .EXE' -ForegroundColor Cyan
Write-Host 'Destino: https://github.com/daadvi/Metrics-Investimentos'
Write-Host 'Aviso: o repositorio e PUBLICO. Nao inclua extratos, tokens, bancos de dados ou informacoes privadas.' -ForegroundColor Yellow

foreach ($tool in @('git','gh')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "Ferramenta ausente: $tool" -ForegroundColor Red
        if ($tool -eq 'git') { Write-Host 'Instale em https://git-scm.com/download/win' }
        if ($tool -eq 'gh') { Write-Host 'Instale em https://cli.github.com/' }
        throw "Nao foi possivel continuar sem $tool."
    }
}
if (-not (Test-Path (Join-Path $root 'server.mjs'))) { throw 'server.mjs nao encontrado na pasta do projeto.' }
if (-not (Test-Path (Join-Path $root '.github/workflows/desktop.yml'))) { throw 'Workflow de compilacao nao encontrado.' }

& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Abra seu navegador para entrar no GitHub.'
    & gh auth login --hostname github.com --web --git-protocol https
    if ($LASTEXITCODE -ne 0) { throw 'Falha na autenticacao do GitHub.' }
}
& gh auth setup-git
if ($LASTEXITCODE -ne 0) { throw 'Falha na configuracao das credenciais Git.' }

$work = Join-Path ([System.IO.Path]::GetTempPath()) ('metrics-github-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
    & gh repo clone $repo $work
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel clonar o repositorio. Verifique o acesso.' }
    # Inclui apenas arquivos de codigo e documentacao revisados; nunca copia toda a pasta indiscriminadamente.
    $items = @('.github','.gitignore','AGENTS.md','CHANGELOG.md','GITHUB_EXE_GUIA.md','QUALITY_REPORT.md',
      'README.md','LICENSE','desktop','docs','src','test','web','electron-builder.json','package.json',
      'server.mjs','launcher.mjs','instalar-linux.sh','iniciar-linux.sh','iniciar-windows.cmd',
      'metrics-desktop-linux.sh','ENVIAR_REPOSITORIO_EXISTENTE.ps1','ENVIAR_METRICS_GITHUB.cmd')
    foreach ($item in $items) {
        $from = Join-Path $root $item
        if (-not (Test-Path -LiteralPath $from)) { continue }
        $to = Join-Path $work $item
        if (Test-Path -LiteralPath $from -PathType Container) {
            if (Test-Path -LiteralPath $to) { Remove-Item -LiteralPath $to -Force -Recurse }
            Copy-Item -LiteralPath $from -Destination $to -Recurse -Force
        } else { Copy-Item -LiteralPath $from -Destination $to -Force }
    }
    & git -C $work symbolic-ref HEAD refs/heads/main
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao selecionar branch main.' }
    $login = (& gh api user --jq '.login').Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($login)) { throw 'Nao foi possivel identificar a conta conectada.' }
    & git -C $work config user.name $login
    & git -C $work config user.email ("$login@users.noreply.github.com")
    & git -C $work add -A
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar arquivos Git.' }
    $files = @(& git -C $work diff --cached --name-only)
    if ($files.Count -eq 0) { Write-Host 'O repositorio ja contem os arquivos. Confira Actions no GitHub.'; exit 0 }
    Write-Host "`nArquivos a publicar ($($files.Count)):" -ForegroundColor Cyan
    $files | ForEach-Object { Write-Host " - $_" }
    if ($files | Where-Object { $_ -match '(^|/)(\.env|dados|node_modules|dist)(/|$)|\.(sqlite3?|db|bak|backup|pdf|csv)$' }) {
        throw 'Um arquivo potencialmente privado foi detectado. Publicacao interrompida.'
    }
    $confirm = Read-Host "`nConfirmar publicacao no repositorio PUBLICO? Digite SIM"
    if ($confirm -cne 'SIM') { Write-Host 'Publicacao cancelada.'; exit 0 }
    & git -C $work commit -m 'Importar Metrics Investimentos v0.4 e automacao de EXE Windows'
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar commit.' }
    & git -C $work push -u origin main
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao enviar para o GitHub.' }
    Write-Host "`nCodigo publicado!" -ForegroundColor Green
    Write-Host 'Abra https://github.com/daadvi/Metrics-Investimentos/actions'
    Write-Host 'Escolha Windows EXE | Metrics Investimentos e abra a execucao mais recente.'
    Write-Host 'Quando finalizar, baixe o artefato Metrics-Investimentos-Windows-EXE.'
    Start-Process 'https://github.com/daadvi/Metrics-Investimentos/actions'
} finally {
    if (Test-Path $work) { Remove-Item -LiteralPath $work -Force -Recurse -ErrorAction SilentlyContinue }
}

$ErrorActionPreference = 'Stop'
$repo = 'daadvi/Metrics-Investimentos'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host 'METRICS INVESTIMENTOS v1.4-rc1 | Publicar código e compilar EXE' -ForegroundColor Cyan
Write-Host "Repositório: https://github.com/$repo"
Write-Host 'ATENCAO: este é um repositório PUBLICO. Confira que nao ha senhas, extratos reais ou dados financeiros pessoais no codigo.' -ForegroundColor Yellow
foreach($cmd in @('git','gh')) {
  if(-not (Get-Command $cmd -ErrorAction SilentlyContinue)){ throw "$cmd não encontrado. Instale Git e GitHub CLI antes de continuar." }
}
& gh auth status 2>&1 | Out-Null
if($LASTEXITCODE -ne 0){ throw 'Entre no GitHub com: gh auth login' }
$confirm = Read-Host 'Digite REVISAR para preparar e mostrar o que será enviado'
if($confirm -ne 'REVISAR'){ Write-Host 'Cancelado.'; exit 0 }
$temp=Join-Path ([IO.Path]::GetTempPath()) ("metrics-v14-"+[guid]::NewGuid().ToString('N'))
try {
 & gh repo clone $repo $temp
 if($LASTEXITCODE -ne 0){ throw 'Falha ao clonar o repositório.' }
 $directories=@('src','desktop','docs','test','web','community-examples','.github/workflows')
 $files=@('.gitignore','LICENSE','package.json','server.mjs','launcher.mjs','electron-builder.json','README.md','QUALITY_REPORT.md','CHANGELOG.md','AGENTS.md','iniciar-linux.sh','iniciar-windows.cmd','instalar-linux.sh','metrics-desktop-linux.sh','GITHUB_EXE_GUIA.md','VALIDACAO_RC3.md','CHECKLIST_WINDOWS_v14.md','PROVEDORES_CONFIGURACAO_v14.md','PUBLICAR_METRICS_V14.cmd','PUBLICAR_METRICS_V14.ps1','AUDITORIA_FUNCIONAL_RC3.md','VALIDACAO_WINDOWS_v14.md')
 foreach($folder in $directories){
   $from=Join-Path $source $folder
   if(-not (Test-Path -LiteralPath $from)){ continue }
   Get-ChildItem -LiteralPath $from -File -Recurse | ForEach-Object {
     $relative=$_.FullName.Substring($source.Length).TrimStart('\','/')
     $destination=Join-Path $temp $relative
     New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
     Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
   }
 }
 foreach($f in $files){$from=Join-Path $source $f;if(Test-Path -LiteralPath $from){Copy-Item -LiteralPath $from -Destination (Join-Path $temp $f) -Force}}
 & git -C $temp add -- .
 if($LASTEXITCODE -ne 0){throw 'Falha ao preparar os arquivos no Git.'}
 Write-Host 'Alterações a publicar:' -ForegroundColor Cyan
 & git -C $temp diff --cached --stat
 & git -C $temp status --short
 $ok = Read-Host 'Digite PUBLICAR para enviar estas alterações ao seu GitHub'
 if($ok -ne 'PUBLICAR'){Write-Host 'Nenhum arquivo enviado.';exit 0}
 & git -C $temp -c 'user.name=Metrics Release Helper' -c 'user.email=metrics-release-helper@users.noreply.github.com' commit -m 'feat: Metrics v1.4-rc1 dados de mercado, benchmark, importacao e auditoria fiscal'
 if($LASTEXITCODE -ne 0){ throw 'Não houve mudanças ou o commit falhou.' }
 & git -C $temp push origin HEAD:main
 if($LASTEXITCODE -ne 0){throw 'Git push falhou. Confira as permissões/branch e tente novamente.'}
 Write-Host 'Código enviado. Confira https://github.com/daadvi/Metrics-Investimentos/actions' -ForegroundColor Green
 Write-Host 'O GitHub Actions vai testar e tentar gerar o EXE. O envio do código NÃO significa compilação concluída.'
} finally {
 if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force -Recurse -ErrorAction SilentlyContinue}
}

$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $projectPath 'ollama-setup.log'
Set-Location $projectPath

"[$(Get-Date -Format s)] Téléchargement du service Ollama" | Out-File $logPath -Encoding utf8
docker compose --profile local-ai pull ollama *>> $logPath
docker compose --profile local-ai up -d ollama *>> $logPath
"[$(Get-Date -Format s)] Téléchargement du modèle qwen3:8b" | Out-File $logPath -Append -Encoding utf8
docker compose --profile local-ai exec -T ollama ollama pull qwen3:8b *>> $logPath
docker compose up -d --force-recreate backend *>> $logPath
"[$(Get-Date -Format s)] Installation terminée" | Out-File $logPath -Append -Encoding utf8

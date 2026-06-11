# Backup trigger from admin PC - GitHub free-tier cron gets delayed/skipped often,
# so dispatch the workflow every 30 min from Task Scheduler.
# Smart skip: if any run already happened in the last 25 min (e.g. GitHub cron fired), do nothing.
# NOTE: keep this file ASCII-only - PowerShell 5.1 misreads UTF-8 without BOM.
$repo = "PeerapongMala/ai-factory"
$workflow = "pang-game-pipeline.yml"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$logFile = Join-Path $PSScriptRoot "..\logs\trigger_pipeline.log"
$SKIP_IF_RAN_WITHIN_MINUTES = 25

function Write-Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  try { Add-Content -Path $logFile -Value $line -Encoding utf8 } catch {}
}

try {
  $logDir = Split-Path $logFile -Parent
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }
  $lastUtcRaw = & $gh api "repos/$repo/actions/workflows/$workflow/runs?per_page=1" --jq ".workflow_runs[0].created_at" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $lastUtcRaw) {
    Write-Log "SKIP: cannot check last run (offline or gh error)"
    exit 0
  }
  $lastUtc = [DateTimeOffset]::Parse($lastUtcRaw).UtcDateTime
  $ageMinutes = ((Get-Date).ToUniversalTime() - $lastUtc).TotalMinutes
  if ($ageMinutes -lt $SKIP_IF_RAN_WITHIN_MINUTES) {
    Write-Log ("SKIP: last run was only {0:N0} min ago" -f $ageMinutes)
    exit 0
  }
  & $gh workflow run $workflow -R $repo
  if ($LASTEXITCODE -eq 0) {
    Write-Log ("DISPATCH: triggered (previous run {0:N0} min ago)" -f $ageMinutes)
  } else {
    Write-Log "ERROR: gh workflow run failed"
  }
} catch {
  Write-Log "ERROR: $($_.Exception.Message)"
}

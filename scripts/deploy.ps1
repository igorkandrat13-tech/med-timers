param(
  [string]$Message,
  [string]$Server = "https://med-timers.westa.by",
  [switch]$NoPrompt
)

function Write-Info($msg)  { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "[ERROR] $msg" -ForegroundColor Red }

Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Pop-Location | Out-Null

# Ensure we are in repo root (script is in scripts/)
Set-Location (Resolve-Path "$PSScriptRoot/..")

if (-not $Message) {
  $Message = Read-Host "Commit message"
  if (-not $Message) { $Message = "chore: sync" }
}

Write-Info "Staging changes..."
git add -A

try {
  git commit -m $Message | Out-Host
} catch {
  Write-Warn "Nothing to commit or commit failed. Continuing..."
}

Write-Info "Pushing to origin..."
git push | Out-Host
Write-Ok "Pushed"

# Check updates on server
Write-Info "Checking server updates at $Server ..."
try {
  $check = Invoke-RestMethod -Method GET -Uri "$Server/api/updates/check" -TimeoutSec 20
} catch {
  Write-Err "Cannot reach $Server or /api/updates/check failed."
  exit 1
}

if ($check.error) {
  Write-Warn "Server responded with error: $($check.error)"
}

if ($check.available -ne $true) {
  Write-Ok "Server reports no updates (already up to date)."
  if (-not $NoPrompt) {
    $ans = Read-Host "Trigger update anyway? (y/N)"
    if ($ans -ne 'y' -and $ans -ne 'Y') { exit 0 }
  }
}

Write-Info "Triggering update..."
try {
  $res = Invoke-RestMethod -Method POST -Uri "$Server/api/updates/pull" -TimeoutSec 60
  $msg = "Update triggered"
  if ($res -and $res.PSObject.Properties.Name -contains 'message' -and $res.message) {
    $msg = $res.message
  }
  Write-Ok $msg
} catch {
  Write-Err "Update API failed: $($_.Exception.Message)"
  exit 1
}

Write-Info "Waiting server to restart (10s)..."
Start-Sleep -Seconds 10

try {
  $ver = Invoke-RestMethod -Method GET -Uri "$Server/api/version" -TimeoutSec 10
  if ($ver.version) {
    Write-Ok "Server is up. Current version: $($ver.version)"
  } else {
    Write-Warn "Server up, but version not available."
  }
} catch {
  Write-Warn "Server not responding yet. Try reloading the page in a few seconds."
}

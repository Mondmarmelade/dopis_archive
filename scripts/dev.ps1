# scripts/dev.ps1
param (
    [switch]$Reset
)

$RootDir = Split-Path -Parent $PSScriptRoot
$PbDataDir = Join-Path $RootDir "pb_data"

if ($Reset) {
    Write-Host "[RESET] Fuehre Hard-Reset der PocketBase-Datenbank durch..." -ForegroundColor Magenta

    Set-Location $RootDir
    # 1. Stop Docker container if running
    try {
        docker compose down 2>&1 | Out-Null
    } catch {}

    # 2. Stop any local pocketbase.exe process
    Get-Process -Name "pocketbase" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    # 3. Clean up pb_data directory
    if (Test-Path $PbDataDir) {
        # Retry loop in case a file handle is temporarily closing
        $retries = 3
        while ($retries -gt 0 -and (Test-Path $PbDataDir)) {
            try {
                Remove-Item -Path $PbDataDir -Recurse -Force -ErrorAction Stop
            } catch {
                Start-Sleep -Milliseconds 500
                $retries--
            }
        }
    }
    New-Item -ItemType Directory -Path $PbDataDir -Force | Out-Null

    # 4. Create/Update install reset epoch file for browser cookie & session invalidation
    $resetFile = Join-Path $RootDir "apps\web\.install_reset"
    $epoch = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
    Set-Content -Path $resetFile -Value $epoch -Force

    Write-Host "[OK] Datenbank und Belege wurden vollstaendig geloescht (frischer Start)." -ForegroundColor Green
    Write-Host "[OK] Reset-Epoch erzeugt ($epoch): Browser-Sessions und Cookies werden invalidiert." -ForegroundColor Green
}

Write-Host "[INFO] Pruefe PocketBase Status (Port 8090)..." -ForegroundColor Cyan

$pbHealthy = $false
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:8090/api/health" -Method Get -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($res.code -eq 200) {
        $pbHealthy = $true
    }
} catch {
    $pbHealthy = $false
}

if ($pbHealthy) {
    Write-Host "[OK] PocketBase laeuft bereits auf http://127.0.0.1:8090" -ForegroundColor Green
} else {
    Write-Host "[WAIT] PocketBase nicht aktiv. Starte PocketBase im Hintergrund..." -ForegroundColor Yellow

    $dockerWorking = $false
    try {
        $null = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dockerWorking = $true
        }
    } catch {
        $dockerWorking = $false
    }

    if ($dockerWorking) {
        Set-Location $RootDir
        docker compose up -d pocketbase | Out-Null
    } else {
        Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$RootDir\scripts\run-pocketbase.ps1`"" -WindowStyle Minimized
    }

    $retries = 10
    while ($retries -gt 0 -and -not $pbHealthy) {
        Start-Sleep -Milliseconds 500
        try {
            $check = Invoke-RestMethod -Uri "http://127.0.0.1:8090/api/health" -Method Get -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($check.code -eq 200) {
                $pbHealthy = $true
            }
        } catch {}
        $retries--
    }

    if ($pbHealthy) {
        Write-Host "[OK] PocketBase erfolgreich gestartet auf http://127.0.0.1:8090" -ForegroundColor Green
    } else {
        Write-Host "[WARN] PocketBase-Start dauert noch an. Web-App startet parallel..." -ForegroundColor Yellow
    }
}

Write-Host "[START] Starte Dopis Web-App auf http://localhost:4321..." -ForegroundColor Cyan
Set-Location $RootDir
pnpm --filter @dopis/web dev

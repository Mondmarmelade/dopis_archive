# scripts/run-pocketbase.ps1
param (
    [switch]$Binary
)

$RootDir = Split-Path -Parent $PSScriptRoot
$PbDataDir = Join-Path $RootDir "pb_data"
$PbMigrationsDir = Join-Path $RootDir "pb_migrations"

if (-not (Test-Path $PbDataDir)) {
    New-Item -ItemType Directory -Path $PbDataDir -Force | Out-Null
}

if (-not $Binary) {
    # Check if Docker is running
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
        Write-Host "[INFO] Starting PocketBase via Docker Compose..." -ForegroundColor Cyan
        Set-Location $RootDir
        docker compose up -d pocketbase
        Write-Host "[OK] PocketBase running at http://127.0.0.1:8090" -ForegroundColor Green
        Write-Host "[INFO] Admin UI at http://127.0.0.1:8090/_/" -ForegroundColor Green
        return
    } else {
        Write-Host "[WARN] Docker Desktop is not running. Falling back to local PocketBase binary." -ForegroundColor Yellow
    }
}

# Standalone binary runner
$PbExe = Join-Path $RootDir "pocketbase.exe"
if (-not (Test-Path $PbExe)) {
    Write-Host "[INFO] Downloading PocketBase for Windows (amd64)..." -ForegroundColor Cyan
    $version = "0.24.4"
    $zipUrl = "https://github.com/pocketbase/pocketbase/releases/download/v$version/pocketbase_${version}_windows_amd64.zip"
    $zipDest = Join-Path $RootDir "pocketbase.zip"
    
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipDest
    Expand-Archive -Path $zipDest -DestinationPath $RootDir -Force
    Remove-Item $zipDest -Force
    Write-Host "[OK] PocketBase extracted to $PbExe" -ForegroundColor Green
}

Write-Host "[START] Starting PocketBase binary on port 8090..." -ForegroundColor Cyan
Write-Host "[INFO] Admin UI at http://127.0.0.1:8090/_/" -ForegroundColor Green
& $PbExe serve --http="127.0.0.1:8090" --dir=$PbDataDir --migrationsDir=$PbMigrationsDir

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "======================================================" -ForegroundColor DarkCyan
Write-Host "  RYKA CORE 4.4 - DESKTOP MODE" -ForegroundColor Cyan
Write-Host "  Developer: Muhammad Rafi Priyo" -ForegroundColor DarkCyan
Write-Host "======================================================" -ForegroundColor DarkCyan

if (-not (Test-Path ".\package.json")) {
    throw "package.json tidak ditemukan. Jalankan script dari folder project."
}

if (-not (Test-Path ".\node_modules")) {
    Write-Host "Menginstal dependency..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install gagal." }
}

Write-Host "Menjalankan UI dan Windows Desktop Bridge..." -ForegroundColor Green
Write-Host "Alamat: http://localhost:3200" -ForegroundColor Cyan
npm run dev:desktop

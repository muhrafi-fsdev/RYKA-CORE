@echo off
setlocal
cd /d "%~dp0"
title RYKA CORE - Windows Desktop Bridge

echo ======================================================
echo   RYKA CORE 4.4 - DESKTOP MODE
echo   Personal Access & Partner Communication + Secure Windows Bridge + Gesture Tracking
echo   Developer: Muhammad Rafi Priyo
echo ======================================================
echo.

if not exist package.json (
  echo [ERROR] package.json tidak ditemukan.
  echo Pastikan file BAT ini berada di folder project.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/2] Menginstal dependency...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install gagal.
    pause
    exit /b 1
  )
)

echo [2/2] Menjalankan Web UI dan Windows Desktop Bridge...
echo Buka http://localhost:3200 jika browser tidak terbuka otomatis.
call npm run dev:desktop
pause

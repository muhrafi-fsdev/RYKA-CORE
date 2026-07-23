@echo off
setlocal
cd /d "%~dp0"
title RYKA CORE - Web Mode

echo ======================================================
echo   RYKA CORE 4.4 - WEB MODE
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

echo [2/2] Menjalankan aplikasi di http://localhost:3200
call npm run dev
pause

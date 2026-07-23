@echo off
setlocal
cd /d "%~dp0"
title RYKA CORE - Personal Access Mode

echo ======================================================
echo   RYKA CORE 4.4 - ACCESSIBILITY MODE
echo   Personal Setup + Alternative Input + Partner Display + Caption
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

echo [2/2] Menjalankan RYKA ACCESS di http://localhost:3200/?mode=access
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3200/?mode=access'"
call npm run dev
pause

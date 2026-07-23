@echo off
setlocal
cd /d "%~dp0"
title RYKA CORE 4.4 - Security Check

echo ======================================================
echo   RYKA CORE 4.4 - SECURITY CHECK
echo   Developer: Muhammad Rafi Priyo
echo ======================================================
echo.

if not exist package.json (
  echo [ERROR] package.json tidak ditemukan.
  pause
  exit /b 1
)

echo [1/4] Static hardening check...
call npm run security:static
if errorlevel 1 goto :failed

echo [2/4] Secure Bridge runtime test...
call npm run security:bridge-test
if errorlevel 1 goto :failed

echo [3/4] Compatibility validation...
call npm run validate:compat
if errorlevel 1 goto :failed

echo [4/4] Accessibility validation...
call npm run validate:access
if errorlevel 1 goto :failed

echo.
echo [PASS] Semua pemeriksaan keamanan dasar berhasil.
pause
exit /b 0

:failed
echo.
echo [FAILED] Pemeriksaan keamanan menemukan masalah.
pause
exit /b 1

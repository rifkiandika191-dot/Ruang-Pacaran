@echo off
title Website Pacaran - Nonton Bareng
echo ==========================================
echo    Website Pacaran - Nonton Bareng
echo ==========================================
echo.

REM Pindah ke folder script ini
cd /d "%~dp0"

REM Cek apakah node_modules sudah ada
if not exist "node_modules" (
    echo [1/2] Menginstall dependency, mohon tunggu...
    call npm install
    echo.
)

echo [2/2] Menjalankan server...
echo.
echo Buka browser ke: http://localhost:3000
echo Tekan CTRL+C untuk berhenti.
echo.
call npm start
pause

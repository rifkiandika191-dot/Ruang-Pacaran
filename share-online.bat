@echo off
title Website Pacaran - ONLINE (bagikan ke pasangan)
cd /d "%~dp0"

echo ============================================================
echo    Website Pacaran - Membuat Link ONLINE
echo ============================================================
echo.

REM Install dependency bila belum ada
if not exist "node_modules" (
    echo [Persiapan] Menginstall dependency, mohon tunggu...
    call npm install
    echo.
)

REM Jalankan server di jendela tersembunyi
echo [1/2] Menyalakan server...
start "Server Pacaran" /min cmd /c "node server.js"

REM Tunggu server siap
timeout /t 4 /nobreak >nul

echo [2/2] Membuat link online (Cloudflare)...
echo.
echo ============================================================
echo  TUNGGU sampai muncul baris berisi:  https://....trycloudflare.com
echo  Itulah LINK yang kamu bagikan ke pasangan.
echo.
echo  JANGAN tutup jendela ini selama mau dipakai nonton bareng.
echo  Tekan CTRL+C lalu tutup untuk berhenti.
echo ============================================================
echo.

npx -y cloudflared tunnel --url http://localhost:3000

pause

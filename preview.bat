@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chua cai Node.js. Hay tai ban LTS tai https://nodejs.org roi chay lai file nay.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Dang cai thu vien lan dau, vui long doi 1-2 phut...
  call npm install --no-audit --no-fund
)
node tools\build.js
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
start "" "%~dp0index.html"
echo.
echo Da mo website trong trinh duyet. Chua dang len mang - muon dang hay chay publish.bat
timeout /t 5 >nul

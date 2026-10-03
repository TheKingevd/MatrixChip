@echo off
cd /d "%~dp0"

echo ========================================
echo    MATRIX ONLINE - AUTO PULL
echo ========================================
echo.

node auto-pull.cjs

echo.
echo O Auto Pull foi encerrado.
pause

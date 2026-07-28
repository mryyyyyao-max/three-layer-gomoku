@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 三层五子棋

where node >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
where node >nul 2>&1
if errorlevel 1 (
  echo 未找到 Node.js。请先安装：https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\ws" (
  echo 首次运行，正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo 依赖安装失败。
    pause
    exit /b 1
  )
)

echo.
echo 正在关闭旧进程（如有）...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo 正在启动三层五子棋...
echo 本机：http://localhost:3000
echo 队友请打开本窗口里稍后打印的局域网地址
echo 关闭本窗口即停止游戏
echo.
echo 若规则异常：关掉本窗口后重新双击，浏览器按 Ctrl+F5 强刷
echo.

start "" "http://localhost:3000/?v=5"
node server.js
pause

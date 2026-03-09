@echo off
setlocal

echo ==============================================
echo CEAC Web Tracker - Local Quickstart (Windows)
echo ==============================================

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH.
    pause
    exit /b 1
)

:: Check for Node.js/npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm is not installed ^(Node.js is required^).
    pause
    exit /b 1
)

echo.
echo [1/3] Installing Python Backend Dependencies...
cd backend
call npm run install-deps
cd ..

echo.
echo [2/3] Installing Node.js Frontend Dependencies...
cd frontend
call npm install
cd ..

echo.
echo [3/3] Setting up Environment Variables (Skipping optional APIs)...
if not exist ".env" (
    (
        echo GEMINI_API_KEY=
        echo SMTP_SERVER=
        echo SMTP_PORT=
        echo SMTP_USERNAME=
        echo SMTP_PASSWORD=
        echo FROM_EMAIL=
    ) > .env
    echo Created dummy .env file. The local ONNX AI solver will be used.
) else (
    echo .env file already exists. Skipping creation.
)

echo.
echo Starting Next.js Development Server...
cd frontend
call npm run dev

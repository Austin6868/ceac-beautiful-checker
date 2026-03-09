#!/bin/bash

# Exit on error
set -e

echo "=============================================="
echo "🚀 CEAC Web Tracker - Local Quickstart"
echo "=============================================="

# Check for required tools
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed (Node.js is required)."
    exit 1
fi

echo -e "\n📦 Installing Python Backend Dependencies..."
cd backend
npm run install-deps
cd ..

echo -e "\n📦 Installing Node.js Frontend Dependencies..."
cd frontend
npm install
cd ..

echo -e "\n⚙️ Setting up Environment Variables (Skipping optional APIs)..."
if [ ! -f .env ]; then
    echo "GEMINI_API_KEY=" > .env
    echo "SMTP_SERVER=" >> .env
    echo "SMTP_PORT=" >> .env
    echo "SMTP_USERNAME=" >> .env
    echo "SMTP_PASSWORD=" >> .env
    echo "FROM_EMAIL=" >> .env
    echo "Created dummy .env file. The local ONNX AI solver will be used."
else
    echo ".env file already exists. Skipping creation."
fi

echo -e "\n🌐 Starting Next.js Development Server..."
cd frontend
npm run dev

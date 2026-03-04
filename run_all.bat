@echo off
cd /d %~dp0

echo 1) Capturing dashboard screenshot...
python capture_dashboard.py
if errorlevel 1 (
  echo Capture failed
  pause
  exit /b 1
)

echo 2) Sending image to WhatsApp group...
node send_whatsapp.js

echo Done.
pause
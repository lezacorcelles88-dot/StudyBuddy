@echo off
chcp 65001 > nul
title StudyBuddy Launcher
color 0B

echo.
echo  ============================================================
echo    STUDYBUDDY - Voice-Based Study Assistant for BSIT
echo  ============================================================
echo.
echo  Starting StudyBuddy...
echo  The app will open in your browser automatically.
echo.
echo  SHARING THE APP:
echo    - Same network: share the "http://192.x.x.x:5000" URL
echo    - Internet:     a public URL will appear if tunnel works
echo.

cd /d "%~dp0"
python launch.py

if errorlevel 1 (
    echo.
    echo  [ERROR] Something went wrong.
    echo  Make sure Python is installed: https://python.org
    echo  Then run: pip install -r requirements.txt
    echo.
    pause
)

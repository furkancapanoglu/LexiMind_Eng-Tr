@echo off
title LexiMind - Akilli Ingilizce Kelime Defteri
cd /d "%~dp0"

if exist "%LocalAppData%\Programs\Python\Python314\python.exe" (
    "%LocalAppData%\Programs\Python\Python314\python.exe" app.py
    goto :end
)

if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
    "%LocalAppData%\Programs\Python\Python312\python.exe" app.py
    goto :end
)

if exist "%LocalAppData%\Programs\Python\Launcher\py.exe" (
    "%LocalAppData%\Programs\Python\Launcher\py.exe" app.py
    goto :end
)

start "" "%~dp0index.html"
:end
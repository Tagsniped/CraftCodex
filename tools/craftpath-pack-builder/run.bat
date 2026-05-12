@echo off
setlocal
cd /d "%~dp0"
set "JAVA_EXE=java"
set "JAVAC_EXE=javac"
if exist "C:\Program Files\Java\jdk-26.0.1\bin\java.exe" set "JAVA_EXE=C:\Program Files\Java\jdk-26.0.1\bin\java.exe"
if exist "C:\Program Files\Java\jdk-26.0.1\bin\javac.exe" set "JAVAC_EXE=C:\Program Files\Java\jdk-26.0.1\bin\javac.exe"
if not exist out mkdir out
"%JAVAC_EXE%" -d out src\craftpath\packbuilder\*.java
if errorlevel 1 exit /b %errorlevel%
"%JAVA_EXE%" -cp out craftpath.packbuilder.Main

@echo off
setlocal EnableExtensions
title Push to GitHub
cd /d "%~dp0"

echo ==========================================
echo   Mogpog Waterworks - push to GitHub
echo ==========================================
echo.

REM --- sanity checks ---------------------------------------------------
where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed or not on PATH.
  pause
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo This folder is not a git repository. Put this file in the project folder.
  pause
  exit /b 1
)

set "BRANCH="
for /f "delims=" %%b in ('git branch --show-current') do set "BRANCH=%%b"
if not defined BRANCH (
  echo No branch is checked out - detached HEAD. Check out a branch first.
  pause
  exit /b 1
)

REM --- choose where to push: this branch, or a new one ---------------
:branch_menu
echo Current branch: %BRANCH%
echo.
echo   1  Push to this branch - %BRANCH%
echo   2  Create a NEW branch and push to it
echo   3  Quit
echo.
choice /c 123 /n /m "Choose 1 to 3: "
if errorlevel 3 exit /b 0
if errorlevel 2 goto :new_branch
if /i "%BRANCH%"=="main" goto :warn_main
if /i "%BRANCH%"=="master" goto :warn_main
goto :after_branch

:warn_main
echo.
echo You are on %BRANCH%. Pushing here puts these changes into your main version.
choice /c YN /m "Push to %BRANCH% anyway"
if errorlevel 2 goto :branch_menu
goto :after_branch

:new_branch
echo.
set "NEWB="
set /p "NEWB=New branch name, for example encrypted-export, or press Enter to go back: "
if not defined NEWB goto :branch_menu
set "NEWB=%NEWB:"=%"
set "NEWB=%NEWB: =-%"
git check-ref-format --branch "%NEWB%" >nul 2>nul
if errorlevel 1 (
  echo That is not a valid branch name. Use letters, numbers and hyphens.
  goto :new_branch
)
git show-ref --verify --quiet "refs/heads/%NEWB%"
if not errorlevel 1 (
  echo A branch named %NEWB% already exists. Choose another name.
  goto :new_branch
)
git checkout -b "%NEWB%"
if errorlevel 1 (
  echo.
  echo Could not create the branch - see the message above. Nothing was pushed.
  pause
  exit /b 1
)
set "BRANCH=%NEWB%"
echo.
echo Created and switched to branch %BRANCH%. Your uncommitted changes came with you.
echo The old branch was not changed.
echo.

:after_branch

REM --- keep the generated android folder, and the app signing key in it, out of GitHub ---
findstr /b /c:"/android" .gitignore >nul 2>nul
if errorlevel 1 (
  echo.>>.gitignore
  echo # generated native folder - holds the app signing key>>.gitignore
  echo /android>>.gitignore
  echo Added /android to .gitignore so the signing key is never pushed.
  echo.
)

set "TRACKED="
for /f "delims=" %%i in ('git ls-files android') do set "TRACKED=1"
if defined TRACKED (
  git rm -r -q --cached android
  echo The android folder was already tracked. Removed it from git, your files stay on disk.
  echo.
)

REM --- show what changed -----------------------------------------------
echo Branch: %BRANCH%
echo.
echo Changes:
git status --short
echo.

set "CHANGED="
for /f "delims=" %%i in ('git status --porcelain') do set "CHANGED=1"
if not defined CHANGED (
  echo Nothing new to commit. Will only push commits that are not on GitHub yet.
  echo.
  goto :push
)

choice /c YN /m "Commit and push these changes"
if errorlevel 2 (
  echo Cancelled. Nothing was changed.
  pause
  exit /b 0
)

REM --- commit message ----------------------------------------------------
set "MSG="
set /p "MSG=Commit message, or press Enter for the date and time: "
if defined MSG set "MSG=%MSG:"=%"
if not defined MSG (
  for /f "delims=" %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "MSG=Update %%t"
)
if not defined MSG set "MSG=Update"

git add -A

REM --- never push keys or private env files ----------------------------
git diff --cached --name-only --diff-filter=d | findstr /i /r "\.keystore$ \.jks$ \.p12$ \.pem$ \.key\.json$ \.env" >nul
if not errorlevel 1 (
  echo.
  echo STOPPED: a key or env file is staged. Nothing was committed.
  git diff --cached --name-only --diff-filter=d | findstr /i /r "\.keystore$ \.jks$ \.p12$ \.pem$ \.key\.json$ \.env"
  git reset -q
  pause
  exit /b 1
)

git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo Commit failed - see the message above.
  pause
  exit /b 1
)

:push
echo.
echo Pushing to origin/%BRANCH% ...
git push -u origin %BRANCH%
if errorlevel 1 (
  echo.
  echo Push failed. Common causes:
  echo  - No internet, or you are not signed in to GitHub on this PC.
  echo  - GitHub has newer commits. Run  git pull --rebase  then run this file again.
  pause
  exit /b 1
)

echo.
echo Done. Your changes are on GitHub.
pause
exit /b 0

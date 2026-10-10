@echo off
setlocal EnableExtensions
title Install Mogpog Waterworks on the phone
cd /d "%~dp0"

set "APK=android\app\build\outputs\apk\release\app-release.apk"
set "SAVED=%LOCALAPPDATA%\mogpog-last-device.txt"

REM --- find adb ----------------------------------------------------------
set "ADB="
where adb >nul 2>nul
if not errorlevel 1 set "ADB=adb"
if not defined ADB if defined ANDROID_HOME if exist "%ANDROID_HOME%\platform-tools\adb.exe" set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"
if not defined ADB if exist "C:\android-sdk\platform-tools\adb.exe" set "ADB=C:\android-sdk\platform-tools\adb.exe"
if not defined ADB if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not defined ADB (
  echo Could not find adb. Install the Android SDK platform-tools or add them to PATH.
  pause
  exit /b 1
)

:menu
echo.
echo ==========================================
echo   Mogpog Waterworks - install on the phone
echo ==========================================
echo   1  Build the release app and install it
echo   2  Install the last built APK only - no build
echo   3  Connect to the phone only
echo   4  Quit
echo.
choice /c 1234 /n /m "Choose 1 to 4: "
if errorlevel 4 exit /b 0
if errorlevel 3 goto :connect_only
if errorlevel 2 goto :install_only

REM ===== 1: build + install ================================================
if not exist "android\gradlew.bat" (
  echo There is no android folder here. Run:  npx expo prebuild --platform android
  pause
  exit /b 1
)
call :deps
if errorlevel 1 exit /b 1
call :find_device
if errorlevel 1 exit /b 1

echo.
echo Building the release APK. The first build can take several minutes...
pushd android
call gradlew.bat assembleRelease
set "BUILD_RC=%errorlevel%"
popd
if not "%BUILD_RC%"=="0" (
  echo.
  echo Build failed - see the messages above. Nothing was installed.
  pause
  exit /b 1
)
goto :install

REM ===== 2: install only ===================================================
:install_only
call :find_device
if errorlevel 1 exit /b 1

:install
if not exist "%APK%" (
  echo The APK was not found: %APK%
  echo Choose option 1 to build it first.
  pause
  exit /b 1
)
REM the wireless link can drop during a long build, so check the phone again
call :find_device
if errorlevel 1 exit /b 1

echo.
echo Installing on %SERIAL% ...
"%ADB%" -s %SERIAL% install -r "%APK%" > "%TEMP%\mogpog-install.log" 2>&1
type "%TEMP%\mogpog-install.log"

findstr /c:"Success" "%TEMP%\mogpog-install.log" >nul
if not errorlevel 1 (
  echo.
  echo Installed. Open the app on the phone.
  pause
  exit /b 0
)

findstr /c:"INSTALL_FAILED_UPDATE_INCOMPATIBLE" "%TEMP%\mogpog-install.log" >nul
if not errorlevel 1 (
  echo.
  echo The installed app was signed with a different key than this build.
  echo DO NOT uninstall it - that deletes the readings stored on the phone.
  echo Back the data up first, or ask for help.
)
echo.
echo Install failed - see the message above.
pause
exit /b 1

REM ===== 3: connect only ===================================================
:connect_only
call :find_device
if errorlevel 1 exit /b 1
echo.
echo The phone is connected and ready.
pause
exit /b 0

REM ===== helpers ===========================================================
:deps
set "NEED="
if not exist "node_modules\fflate" set "NEED=1"
if not exist "node_modules\react-native-view-shot" set "NEED=1"
if defined NEED (
  echo Installing missing packages...
  call npm install --legacy-peer-deps
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
exit /b 0

:scan
set "SERIAL="
for /f "tokens=1,2" %%a in ('"%ADB%" devices') do if "%%b"=="device" set "SERIAL=%%a"
exit /b 0

:find_device
"%ADB%" start-server >nul 2>nul
call :scan
if defined SERIAL (
  echo Phone found: %SERIAL%
  exit /b 0
)

echo No phone is connected.
if exist "%SAVED%" (
  set "LAST="
  set /p "LAST="<"%SAVED%"
  if defined LAST (
    echo Trying the last address: %LAST%
    "%ADB%" connect %LAST%
    call :scan
    if defined SERIAL (
      echo Phone found: %SERIAL%
      exit /b 0
    )
  )
)

:ask
echo.
echo On the phone: Settings, Developer options, Wireless debugging.
echo   C  connect - use the IP address and port on the main Wireless debugging screen
echo   P  pair first - needed only once, uses Pair device with pairing code
echo   Q  quit
choice /c CPQ /n /m "Choose C, P or Q: "
if errorlevel 3 exit /b 1
if errorlevel 2 goto :pair

set "ADDR="
set /p "ADDR=IP address and port, for example 192.168.1.32:41234 : "
if not defined ADDR goto :ask
"%ADB%" connect %ADDR%
call :scan
if defined SERIAL (
  >"%SAVED%" echo %ADDR%
  echo Phone found: %SERIAL%
  exit /b 0
)
echo Could not connect. Check the phone is on the same Wi-Fi and the address is right.
goto :ask

:pair
set "PADDR="
set /p "PADDR=Pairing IP address and port, from the pairing code screen : "
if not defined PADDR goto :ask
"%ADB%" pair %PADDR%
goto :ask

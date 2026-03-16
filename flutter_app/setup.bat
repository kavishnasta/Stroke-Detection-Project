@echo off
:: ============================================================================
:: setup.bat  —  One-click Flutter project initialisation for FAST Detection
:: Run from inside the flutter_app\ directory.
:: ============================================================================
echo.
echo ======================================================
echo  FAST Detection  —  Flutter project setup
echo ======================================================
echo.

flutter --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: 'flutter' not found on PATH.
    echo.
    echo  If you just installed Flutter, open a NEW terminal so
    echo  PATH picks up C:\Users\admin\flutter\bin, then re-run.
    echo.
    pause & exit /b 1
)

:: ── Step 1: Scaffold (generates android/, ios/ and platform glue) ──────────
echo [1/4] Scaffolding Flutter project (generates platform code)...
:: Back up our hand-written main.dart before flutter create overwrites it.
copy /Y lib\main.dart lib\main.dart._bak >nul
flutter create --org com.stroke.detection --project-name stroke_detection_app .
:: Restore our main.dart (flutter create replaces it with the counter demo).
copy /Y lib\main.dart._bak lib\main.dart >nul
del  lib\main.dart._bak >nul 2>&1
echo.

:: ── Step 2: Inject camera + microphone permissions ────────────────────────
echo [2/4] Adding camera / microphone permissions to AndroidManifest.xml...
powershell -NoProfile -Command ^
    "$f='android\app\src\main\AndroidManifest.xml'; $c=Get-Content $f -Raw; if(-not($c -match 'RECORD_AUDIO')){$p='    <uses-permission android:name=\"android.permission.CAMERA\" />`n    <uses-permission android:name=\"android.permission.RECORD_AUDIO\" />`n    <uses-permission android:name=\"android.permission.INTERNET\" />`n    <uses-feature android:name=\"android.hardware.camera\" android:required=\"false\" />`n    <uses-feature android:name=\"android.hardware.microphone\" android:required=\"false\" />`n`n';$c=$c -replace '<application',$p+'<application';Set-Content $f $c -NoNewline;Write-Host 'Permissions added.'}else{Write-Host 'Permissions already present.'}"
echo.

:: ── Step 3: Set minSdk 21 (required by the record audio package) ──────────
echo [3/4] Setting minSdk to 21 in android/app/build.gradle...
powershell -NoProfile -Command ^
    "$f='android\app\build.gradle'; $c=Get-Content $f -Raw; $c=$c -replace 'minSdk\s+\d+','minSdk 21'; Set-Content $f $c -NoNewline; Write-Host 'minSdk = 21 set.'"
echo.

:: ── Step 4: flutter pub get ────────────────────────────────────────────────
echo [4/4] Fetching packages...
flutter pub get
echo.

echo ======================================================
echo  Done!
echo.
echo  Connect an Android device (USB debugging on) then:
echo    flutter run
echo.
echo  To build a release APK:
echo    flutter build apk --release
echo.
echo  Start the backend first:
echo    cd ..\backend   ^&^&   python server.py
echo ======================================================
echo.
pause

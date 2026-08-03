$ErrorActionPreference = "Stop"
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"

Write-Host "Copying project to C:\b to bypass MAX_PATH..."
if (Test-Path "C:\b") {
    Remove-Item "C:\b" -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path "C:\b" -Force | Out-Null
robocopy "C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile" "C:\b" /MIR /NFL /NDL /NJH /NJS /nc /ns /np

$AndroidDir = "C:\b\android"
$DestDir = "C:\Users\user\Desktop\보내는 용도"

if (-Not (Test-Path $destDir)) {
    cmd.exe /c "mkdir `"C:\Users\user\Desktop\보내는 용도`""
}

Set-Location $AndroidDir
Write-Host "Building Unified Release APK (DEMO mode to keep toggle)..."
.\gradlew.bat clean assembleRelease

$ApkPath = "$AndroidDir\app\build\outputs\apk\release\app-release.apk"
$DestFile = "$DestDir\Anyway_the_Sea.apk"

Write-Host "Copying APK to $DestFile"
Copy-Item -Path $ApkPath -Destination $DestFile -Force
Write-Host "Unified build completed successfully!"

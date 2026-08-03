$ErrorActionPreference = "Stop"

$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
cd C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\android

Write-Host "Building Release APK..."
.\gradlew assembleRelease

$apkPath = "app\build\outputs\apk\release\app-release.apk"
$destDir = "C:\Users\user\Desktop\보내는 용도"

if (-Not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir
}

Write-Host "Copying APKs to $destDir..."
Copy-Item $apkPath "$destDir\Anyway_the_Sea_PATCHED_DEMO.apk" -Force
Copy-Item $apkPath "$destDir\Anyway_the_Sea_PATCHED_PROD.apk" -Force

Write-Host "Build and extraction complete!"

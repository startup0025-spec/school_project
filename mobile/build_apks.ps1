$ErrorActionPreference = "Stop"

$DestDir = "C:\Users\user\Desktop\보내는 용도"
if (!(Test-Path -Path $DestDir)) {
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
}

$EnvFile = "C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.env"
$AndroidDir = "C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\android"

function Build-APK {
    param([string]$Mode, [string]$OutName)
    
    Write-Host "Setting EXPO_PUBLIC_BUILD_MODE to $Mode"
    (Get-Content $EnvFile) -replace 'EXPO_PUBLIC_BUILD_MODE=.*', "EXPO_PUBLIC_BUILD_MODE=$Mode" | Set-Content $EnvFile
    
    Set-Location $AndroidDir
    Write-Host "Cleaning..."
    .\gradlew.bat clean
    
    Write-Host "Building Release APK for $Mode..."
    .\gradlew.bat assembleRelease
    
    $ApkPath = "$AndroidDir\app\build\outputs\apk\release\app-release.apk"
    $DestFile = "$DestDir\$OutName"
    
    Write-Host "Copying APK to $DestFile"
    Copy-Item -Path $ApkPath -Destination $DestFile -Force
    Write-Host "Done building $Mode"
}

Build-APK -Mode "DEMO" -OutName "Anyway_the_Sea_DEMO.apk"
Build-APK -Mode "PRODUCTION" -OutName "Anyway_the_Sea_PROD.apk"

Write-Host "All builds completed successfully!"

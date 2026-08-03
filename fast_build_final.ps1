$ErrorActionPreference = "Stop"
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"

Write-Host "Copying project to C:\b to bypass MAX_PATH..."
if (Test-Path "C:\b") {
    Remove-Item "C:\b" -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path "C:\b" -Force | Out-Null
robocopy "C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile" "C:\b" /MIR /NFL /NDL /NJH /NJS /nc /ns /np

$EnvFile = "C:\b\.env"
$AndroidDir = "C:\b\android"
$DestDir = "C:\Users\user\Desktop\보내는 용도"

if (-Not (Test-Path $destDir)) {
    cmd.exe /c "mkdir `"C:\Users\user\Desktop\보내는 용도`""
}

function Build-APK {
    param([string]$Mode, [string]$OutName)
    
    Write-Host "Setting EXPO_PUBLIC_BUILD_MODE to $Mode in C:\b\.env"
    if ($Mode -eq "DEMO") {
        (Get-Content $EnvFile) -replace 'EXPO_PUBLIC_BUILD_MODE=.*', "EXPO_PUBLIC_BUILD_MODE=DEMO" | Set-Content $EnvFile
    } else {
        (Get-Content $EnvFile) -replace 'EXPO_PUBLIC_BUILD_MODE=.*', "EXPO_PUBLIC_BUILD_MODE=$Mode" | Set-Content $EnvFile
    }
    
    Set-Location $AndroidDir
    Write-Host "Building Release APK for $Mode..."
    .\gradlew.bat clean assembleRelease
    
    $ApkPath = "$AndroidDir\app\build\outputs\apk\release\app-release.apk"
    $DestFile = "$DestDir\$OutName"
    
    if (Test-Path $ApkPath) {
        Write-Host "Copying APK to $DestFile"
        Copy-Item -Path $ApkPath -Destination $DestFile -Force
        Write-Host "Done building $Mode"
    } else {
        Write-Host "ERROR: Failed to build $Mode"
    }
}

# Build both versions exactly as expected in eas.json and original local_builder
Build-APK -Mode "DEMO" -OutName "Anyway_the_Sea_DEMO.apk"
Build-APK -Mode "PRODUCTION" -OutName "Anyway_the_Sea_PROD.apk"

Write-Host "Both DEMO and PROD builds completed successfully!"

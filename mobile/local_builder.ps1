$ErrorActionPreference = "Stop"

$DestDir = "C:\Users\user\Desktop\보내는 용도"
if (!(Test-Path -Path $DestDir)) {
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
}

$EnvFile = "C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\.env"
$AndroidDir = "C:\Users\user\Desktop\school_contest\Anyway_the_Sea\mobile\android"

# Ensure JAVA_HOME is set
if (-not $env:JAVA_HOME) {
    $jdkPaths = @(
        Get-ChildItem -Path "C:\Program Files\Microsoft\jdk-17*" -ErrorAction SilentlyContinue,
        Get-ChildItem -Path "C:\Program Files\Eclipse Adoptium\jdk-17*" -ErrorAction SilentlyContinue,
        Get-ChildItem -Path "C:\Program Files\Java\jdk-17*" -ErrorAction SilentlyContinue
    )
    if ($jdkPaths.Count -gt 0) {
        $env:JAVA_HOME = $jdkPaths[0].FullName
        $env:PATH = "$($env:JAVA_HOME)\bin;" + $env:PATH
        Write-Host "Dynamically set JAVA_HOME to $($env:JAVA_HOME)"
    } else {
        Write-Host "Warning: Could not find JDK 17 in standard paths."
    }
}

function Build-APK {
    param([string]$Mode, [string]$OutName)
    
    Write-Host "`n======================================"
    Write-Host "🚀 Building $Mode APK locally..."
    (Get-Content $EnvFile) -replace 'EXPO_PUBLIC_BUILD_MODE=.*', "EXPO_PUBLIC_BUILD_MODE=$Mode" | Set-Content $EnvFile
    
    Set-Location $AndroidDir
    Write-Host "🧹 Cleaning previous build artifacts..."
    .\gradlew.bat clean
    
    Write-Host "🔨 Compiling..."
    .\gradlew.bat assembleRelease
    
    $ApkPath = "$AndroidDir\app\build\outputs\apk\release\app-release.apk"
    $DestFile = "$DestDir\$OutName"
    
    if (Test-Path $ApkPath) {
        Write-Host "💾 Copying APK to $DestFile"
        Copy-Item -Path $ApkPath -Destination $DestFile -Force
        Write-Host "✅ Done building $Mode!"
    } else {
        Write-Host "❌ ERROR: APK was not generated at $ApkPath"
    }
}

Build-APK -Mode "PRODUCTION" -OutName "Anyway_the_Sea.apk"

Write-Host "`n🌟 All local builds completed successfully!"

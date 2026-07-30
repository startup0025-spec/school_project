$adb = "C:\Users\user\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$emulator = "C:\Users\user\AppData\Local\Android\Sdk\emulator\emulator.exe"
$apk = "C:\Users\user\Desktop\보내는 용도\Anyway_the_Sea_Prod.apk"
$outLog = "C:\mobile\scripts\raw_crash_log.txt"

Write-Host "Starting emulator..."
Start-Process $emulator -ArgumentList "-avd Pixel_7 -no-window -no-audio" -NoNewWindow

Write-Host "Waiting for device..."
Start-Sleep -Seconds 20
& $adb wait-for-device

Write-Host "Waiting for boot complete..."
while ((& $adb shell getprop sys.boot_completed).Trim() -ne "1") {
    Start-Sleep -Seconds 2
}

Write-Host "Uninstalling old..."
& $adb uninstall com.anyway.thesea

Write-Host "Installing new..."
& $adb install -r $apk

Write-Host "Clearing logcat..."
& $adb logcat -c

Write-Host "Launching app..."
& $adb shell monkey -p com.anyway.thesea -c android.intent.category.LAUNCHER 1

Write-Host "Waiting 10 seconds for crash..."
Start-Sleep -Seconds 10

Write-Host "Dumping logcat to file..."
& $adb logcat -d | Out-File -FilePath $outLog -Encoding utf8

Write-Host "Killing emulator..."
& $adb emu kill
Write-Host "Done!"

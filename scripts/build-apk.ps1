param(
  [string]$ManifestDir = "$(Split-Path $PSScriptRoot -Parent)\twa-doctor",
  [int]$GradleXmxMb = 512
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Write-Host "Med Timers APK build (TWA)" -ForegroundColor Cyan
Write-Host "ManifestDir: $ManifestDir"
if (!(Test-Path $ManifestDir)) { throw "Manifest directory not found: $ManifestDir" }
$ManifestFile = Join-Path $ManifestDir "twa-manifest.json"
if (!(Test-Path $ManifestFile)) { throw "twa-manifest.json not found: $ManifestFile" }
$Keystore = Join-Path $ManifestDir "keystore.jks"
Write-Host "Keystore: $Keystore"
Write-Host "Checking tools..."
node -v | Write-Host
npm -v | Write-Host
& java -version | Out-Host
& keytool -help | Out-Null
Write-Host "Ensuring keystore..."
if (!(Test-Path $Keystore)) {
  $storePass = $env:BUBBLEWRAP_KEYSTORE_PASSWORD
  $keyPass = $env:BUBBLEWRAP_KEY_PASSWORD
  if (-not $storePass -or -not $keyPass) {
    throw "Set BUBBLEWRAP_KEYSTORE_PASSWORD and BUBBLEWRAP_KEY_PASSWORD and re-run"
  }
  & keytool -genkeypair -v `
    -keystore $Keystore `
    -storepass $storePass `
    -keypass $keyPass `
    -alias "twa" `
    -keyalg RSA `
    -keysize 2048 `
    -validity 9125 `
    -dname "CN=MedTimers,O=Westa,L=City,S=Region,C=BY" | Out-Host
}
Write-Host "Checking Bubblewrap..."
try { & npx @bubblewrap/cli --version | Out-Host } catch { throw "Bubblewrap CLI not available via npx" }
Write-Host "Running bubblewrap doctor (env check)..." -ForegroundColor Yellow
& npx @bubblewrap/cli doctor | Out-Host
Write-Host "If doctor reports missing SDK/JDK, update paths with: npx @bubblewrap/cli updateConfig --jdkPath <path> --androidSdkPath <path>" -ForegroundColor DarkYellow

Write-Host "Checking Android SDK Manager (optional)..." -ForegroundColor Yellow
try {
  & sdkmanager --version | Out-Host
  Write-Host "Installing required Android packages (this may take 10-20 minutes)..." -ForegroundColor Yellow
  Write-Host "platform-tools, platforms;android-33, build-tools;33.0.2" -ForegroundColor Yellow
  & sdkmanager --install "platform-tools" "platforms;android-33" "build-tools;33.0.2" | Out-Host
} catch {
  Write-Host "sdkmanager not found in PATH; skipping package installation. Ensure Android SDK is installed." -ForegroundColor DarkYellow
}
Write-Host "Generating Android project in: $ManifestDir" -ForegroundColor Yellow
Push-Location $ManifestDir
try {
  & npx @bubblewrap/cli update --manifest $ManifestFile --skipVersionUpgrade | Out-Host

  $twa = $null
  try {
    $twa = (Get-Content -Path $ManifestFile -Raw -Encoding UTF8) | ConvertFrom-Json
  } catch {
    $twa = $null
  }
  $appVersionName = $null
  if ($twa -and $twa.PSObject.Properties.Name -contains "appVersionName") {
    $appVersionName = [string]$twa.appVersionName
  }

  $buildGradle = Join-Path $ManifestDir "app\\build.gradle"
  if (Test-Path $buildGradle) {
    $g = Get-Content -Path $buildGradle -Raw -Encoding UTF8
    if ($g.StartsWith([char]0xFEFF)) { $g = $g.Substring(1) }
    if ($g.StartsWith('?/*')) { $g = $g.Substring(1) }
    if ($g.StartsWith('*')) { $g = '/*' + $g.Substring(1) }
    $g = $g -replace "enableNotifications:\s*,", "enableNotifications: true,"
    if ($appVersionName -and $appVersionName.Trim().Length -gt 0) {
      $escaped = $appVersionName.Replace('"', '\"')
      $replacement = 'versionName "' + $escaped + '"'
      $g = $g -replace 'versionName\s+""', $replacement
    }
    [System.IO.File]::WriteAllText($buildGradle, $g, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Patched build.gradle: $buildGradle" -ForegroundColor DarkYellow
  }

  $gradleProps = Join-Path $ManifestDir "gradle.properties"
  $props = @(
    "org.gradle.jvmargs=-Xmx$($GradleXmxMb)m -Dfile.encoding=UTF-8"
    "org.gradle.daemon=false"
    "android.useAndroidX=true"
  ) -join "`r`n"
  [System.IO.File]::WriteAllText($gradleProps, $props, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "gradle.properties written: $gradleProps" -ForegroundColor DarkYellow
  Write-Host "org.gradle.jvmargs = -Xmx$($GradleXmxMb)m" -ForegroundColor DarkYellow

  Write-Host "Building signed APK..." -ForegroundColor Yellow
  Write-Host "This step may be quiet while Gradle downloads dependencies..." -ForegroundColor Yellow
  & npx @bubblewrap/cli build --manifest $ManifestFile --skipPwaValidation | Out-Host
} finally {
  Pop-Location
}

$apk = Join-Path $ManifestDir "app-release-signed.apk"
$aab = Join-Path $ManifestDir "app-release-bundle.aab"
if (!(Test-Path $apk)) {
  throw "Build did not produce APK: $apk"
}
$apkSize = (Get-Item $apk).Length
if ($apkSize -lt 1024) {
  throw "APK file looks invalid (too small): $apk ($apkSize bytes)"
}
Write-Host "Build finished" -ForegroundColor Green
Write-Host "APK: $apk ($apkSize bytes)"
if (Test-Path $aab) {
  $aabSize = (Get-Item $aab).Length
  Write-Host "AAB: $aab ($aabSize bytes)"
}

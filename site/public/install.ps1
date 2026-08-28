$ErrorActionPreference = 'Stop'
$manifestUrl = 'https://github.com/B-Divyesh/sf-apk-release-pocket/releases/latest/download/latest.json'
$installDir = if ($env:ARP_INSTALL_DIR) { $env:ARP_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\APKReleasePocket' }
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempDir | Out-Null
try {
  $manifest = Invoke-RestMethod -Uri $manifestUrl
  $asset = $manifest.assets.'windows-x86_64'
  if (-not $asset.url -or -not $asset.sha256) { throw 'Release manifest has no windows-x86_64 asset' }
  $archive = Join-Path $tempDir 'arp.zip'
  Invoke-WebRequest -Uri $asset.url -OutFile $archive
  $actual = (Get-FileHash -Algorithm SHA256 $archive).Hash.ToLowerInvariant()
  if ($actual -ne $asset.sha256.ToLowerInvariant()) { throw 'SHA-256 mismatch; refusing to install' }
  Expand-Archive -Path $archive -DestinationPath $tempDir
  New-Item -ItemType Directory -Force -Path $installDir | Out-Null
  Copy-Item (Join-Path $tempDir 'arp.exe') (Join-Path $installDir 'arp.exe') -Force
  Write-Host "Installed verified arp to $installDir\arp.exe"
  Write-Host "Add that directory to PATH, then run: arp --help"
} finally {
  Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}

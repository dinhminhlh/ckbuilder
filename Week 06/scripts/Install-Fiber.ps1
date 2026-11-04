$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WeekRoot = Split-Path $PSScriptRoot -Parent
$Pin = Get-Content -Raw (Join-Path $WeekRoot 'reference/fiber-release.json') | ConvertFrom-Json
$DownloadDir = Join-Path $WeekRoot 'runtime/downloads'
$BinDir = Join-Path $WeekRoot 'runtime/bin'
New-Item -ItemType Directory -Force $DownloadDir, $BinDir | Out-Null
$Archive = Join-Path $DownloadDir $Pin.asset
if (-not (Test-Path -LiteralPath $Archive)) {
    Invoke-WebRequest -UseBasicParsing -Uri $Pin.url -OutFile $Archive
}
$ActualHash = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLower()
if ($ActualHash -ne $Pin.sha256) { throw 'Fiber archive SHA256 mismatch. Do not run it.' }
if (-not (Test-Path -LiteralPath (Join-Path $BinDir 'fnn.exe'))) {
    tar -xzf $Archive -C $BinDir
    if ($LASTEXITCODE -ne 0) { throw 'Cannot extract Fiber archive.' }
}
& (Join-Path $BinDir 'fnn.exe') --version
if ($LASTEXITCODE -ne 0) { throw 'Cannot run Fiber binary.' }
node (Join-Path $PSScriptRoot 'prepare-fiber.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare nodes.' }

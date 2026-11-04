$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WeekRoot = Split-Path $PSScriptRoot -Parent
$Pin = Get-Content -Raw (Join-Path $WeekRoot 'reference/perun-source.json') | ConvertFrom-Json
$DownloadDir = Join-Path $WeekRoot 'runtime/downloads'
$SourceDir = Join-Path $WeekRoot 'runtime/perun-source'
New-Item -ItemType Directory -Force $DownloadDir, $SourceDir | Out-Null
$Archive = Join-Path $DownloadDir 'perun-examples.zip'
if (-not (Test-Path -LiteralPath $Archive)) {
    Invoke-WebRequest -UseBasicParsing "https://api.github.com/repos/perun-network/perun-examples/zipball/$($Pin.commit)" -OutFile $Archive
}
# GitHub-generated zip bytes may change if the archival format changes.
# Source identity is checked against the commit in the download URL and the fixture below.
$FolderName = 'perun-network-perun-examples-' + $Pin.commit.Substring(0, 7)
$Checkout = Join-Path $SourceDir $FolderName
if (-not (Test-Path -LiteralPath $Checkout)) {
    Expand-Archive -LiteralPath $Archive -DestinationPath $SourceDir
}
$Fixture = Get-Content -Raw (Join-Path $WeekRoot 'reference/perun-signature-fixture.json') | ConvertFrom-Json
$UpstreamTest = Get-Content -Raw (Join-Path $Checkout $Fixture.sourcePath)
if (-not $UpstreamTest.Contains($Fixture.signatureDer) -or -not $UpstreamTest.Contains($Fixture.publicKey)) {
    throw 'Downloaded source does not match the checked-in Perun signature fixture.'
}
Write-Output "Perun source prepared at $Checkout"
Write-Output "Commit: $($Pin.commit)"
Write-Output 'This command downloads source only; it does not start or reset a CKB Devnet.'

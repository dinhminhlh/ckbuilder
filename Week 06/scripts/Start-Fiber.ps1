param([Parameter(Mandatory = $true)][ValidateSet('alice', 'bob')][string]$NodeName)
$ErrorActionPreference = 'Stop'
$WeekRoot = Split-Path $PSScriptRoot -Parent
$NodeDir = Join-Path $WeekRoot "runtime/$NodeName"
$PasswordPath = Join-Path $NodeDir 'password.dpapi'
if (-not (Test-Path -LiteralPath (Join-Path $NodeDir 'config.yml'))) { throw 'Run Install-Fiber.ps1 first.' }
if (-not (Test-Path -LiteralPath $PasswordPath)) {
    if ((Get-Content -Raw (Join-Path $NodeDir 'ckb/key')) -notmatch '^[0-9a-fA-F]{64}$') {
        throw 'Encrypted key exists without its saved password. Restore the original password; do not generate another.'
    }
    $RandomBytes = New-Object byte[] 32
    $Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $Rng.GetBytes($RandomBytes) } finally { $Rng.Dispose() }
    $SecurePassword = ConvertTo-SecureString ([Convert]::ToBase64String($RandomBytes)) -AsPlainText -Force
    $SecurePassword | ConvertFrom-SecureString | Set-Content -LiteralPath $PasswordPath -Encoding ascii
}
$SecurePassword = (Get-Content -Raw -LiteralPath $PasswordPath).Trim() | ConvertTo-SecureString
$PasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
$PreviousPassword = $env:FIBER_SECRET_KEY_PASSWORD
try {
    $env:FIBER_SECRET_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($PasswordPointer)
    & (Join-Path $WeekRoot 'runtime/bin/fnn.exe') -c (Join-Path $NodeDir 'config.yml') -d $NodeDir
    if ($LASTEXITCODE -ne 0) { throw "Fiber $NodeName exited with code $LASTEXITCODE" }
} finally {
    $env:FIBER_SECRET_KEY_PASSWORD = $PreviousPassword
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPointer)
}

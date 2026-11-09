param(
    [ValidateSet('setup','build','run','audit','environment','show')]
    [string]$Action = 'show',
    [ValidateRange(1,10)][int]$Stage = 10
)
$ErrorActionPreference = 'Stop'
$WeekRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$LinuxRoot = '/mnt/e/ckbuilder/Week 07/scripts'
function Invoke-LinuxScript([string]$File, [string[]]$Extra = @()) {
    wsl.exe -d CKBuilderWeek07 -- bash "$LinuxRoot/$File" @Extra
    if ($LASTEXITCODE -ne 0) { throw "Week07 step failed: $File. Inspect runtime logs; do not repeat a payment blindly." }
}
function Convert-Shannons($Value) { return [decimal]$Value / 100000000 }
if ($Action -eq 'show') {
    $Files = @('01-environment','02-contract-build','03-contract-tests','04-devnet-deployment','05-channel-open','06-alice-pays-bob','07-bob-pays-alice','08-channel-settled','09-demo-execution','10-final-audit')
    $Path = Join-Path $WeekRoot ("evidence/" + $Files[$Stage-1] + '.json')
    $Data = Get-Content -Raw -Encoding utf8 -LiteralPath $Path | ConvertFrom-Json
    Write-Output "WEEK 07 - $($Files[$Stage-1])"
    Write-Output 'Recorded execution evidence; displaying this file sends no transaction.'
    switch ($Stage) {
        1 { $Data | Select-Object capturedAt,distribution,architecture,sourceCommit | Format-List; $Data.versions | Format-List }
        2 { $Data | Select-Object source,exitCode,capturedAt | Format-List; $Data.binaries | Where-Object { $_.name -notlike '*.debug' } | Format-Table name,size -AutoSize }
        3 { $Data | Select-Object capturedAt,source,exitCode | Format-List; $Data.tests; $Data.summaries }
        4 {
            $Data | Select-Object capturedAt,chain,genesis | Format-List
            $Data.deployedScripts | Select-Object name,live,deploymentStatus | Format-Table -AutoSize
            foreach ($Who in @('alice','bob')) { Write-Output "$Who wallet before demo: $(Convert-Shannons $Data.accounts.$Who.capacityShannons) CKB" }
        }
        { $_ -ge 5 -and $_ -le 8 } {
            $Data | Select-Object capturedAt,stage,source,viewsMatch | Format-List
            $Data.aliceView | Select-Object channelId,version,isFinal | Format-List
            Write-Output "Alice allocation: $(Convert-Shannons $Data.aliceView.aliceShannons) CKB"
            Write-Output "Bob allocation: $(Convert-Shannons $Data.aliceView.bobShannons) CKB"
            Write-Output "Conserved total: $(Convert-Shannons $Data.totalShannons) CKB"
        }
        9 { $Data | Format-List }
        10 {
            $Data | Select-Object capturedAt,channelId,settlementTxHash,settlementStatus,bothParticipantsAgree,allocationConserved,channelInputConsumed,noSuccessorChannelOutput | Format-List
            $Data.transactions | Select-Object kind,status,@{Name='feeCKB';Expression={Convert-Shannons $_.feeShannons}},txHash | Format-List
            foreach ($Who in @('alice','bob')) { Write-Output "$Who wallet after demo: $(Convert-Shannons $Data.walletsAfter.$Who.capacityShannons) CKB" }
        }
    }
    exit 0
}
if ($Action -eq 'setup') {
    $Pin = Get-Content -Raw -Encoding utf8 (Join-Path $WeekRoot 'reference/ubuntu-wsl.json') | ConvertFrom-Json
    $Names = ((wsl.exe --list --quiet 2>$null) -join '') -replace "`0",''
    if ($Names -notmatch 'CKBuilderWeek07') {
        $LocalRoot = Join-Path $env:LOCALAPPDATA 'CKBuilder/Week07'
        $DownloadDir = Join-Path $LocalRoot 'downloads'
        $DistroDir = Join-Path $LocalRoot 'wsl'
        New-Item -ItemType Directory -Force $DownloadDir,$DistroDir | Out-Null
        $Archive = Join-Path $DownloadDir 'ubuntu-24.04-amd64.wsl'
        if (-not (Test-Path -LiteralPath $Archive)) {
            curl.exe --fail --location --retry 2 --silent --show-error --output $Archive $Pin.Amd64Url.Url
            if ($LASTEXITCODE -ne 0) { throw 'Ubuntu download failed.' }
        }
        if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLower() -ne $Pin.Amd64Url.Sha256) { throw 'Ubuntu checksum mismatch.' }
        wsl.exe --import CKBuilderWeek07 $DistroDir $Archive --version 2
        if ($LASTEXITCODE -ne 0) { throw 'WSL import failed. Check WSL2 support; no previous distro has been removed.' }
    }
    Invoke-LinuxScript 'bootstrap-linux.sh'
    Invoke-LinuxScript 'capture-environment.sh'
    exit 0
}
if ($Action -eq 'build') {
    Invoke-LinuxScript 'build-test-contracts.sh'
    wsl.exe -d CKBuilderWeek07 -- python3 "$LinuxRoot/instrument.py"
    if ($LASTEXITCODE -ne 0) { throw 'Could not instrument the isolated example.' }
    Invoke-LinuxScript 'build-go.sh'
    exit 0
}
if ($Action -eq 'environment') { Invoke-LinuxScript 'capture-environment.sh'; exit 0 }
if ($Action -eq 'audit') { Invoke-LinuxScript 'run-lab.sh' @('audit'); exit 0 }
Invoke-LinuxScript 'run-lab.sh'


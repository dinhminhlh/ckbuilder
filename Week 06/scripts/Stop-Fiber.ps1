$ErrorActionPreference = 'Stop'
$WeekRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$ExpectedExe = [IO.Path]::GetFullPath((Join-Path $WeekRoot 'runtime/bin/fnn.exe'))
$OwnedProcesses = @()
foreach ($NodeName in @('alice','bob')) {
    $Port = if ($NodeName -eq 'alice') { 8227 } else { 8237 }
    $NodeDir = [IO.Path]::GetFullPath((Join-Path $WeekRoot "runtime/$NodeName"))
    $Candidates = @(Get-CimInstance Win32_Process -Filter "Name = 'fnn.exe'" | Where-Object {
        $_.ExecutablePath -eq $ExpectedExe -and $_.CommandLine -and $_.CommandLine.Contains($NodeDir)
    })
    if ($Candidates.Count -eq 0) { Write-Output "$NodeName is already stopped."; continue }
    if ($Candidates.Count -ne 1) { throw "Unexpected process count for $NodeName" }
    $Url = "http://127.0.0.1:$Port"
    $Info = Invoke-RestMethod -Uri $Url -Method Post -ContentType 'application/json' -Body '{"jsonrpc":"2.0","id":1,"method":"node_info","params":[]}'
    if ($Info.error -or $Info.result.version -ne '0.9.1' -or $Info.result.chain_hash -ne '0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606') { throw 'Expected this lab Testnet node.' }
    $Channels = Invoke-RestMethod -Uri $Url -Method Post -ContentType 'application/json' -Body '{"jsonrpc":"2.0","id":2,"method":"list_channels","params":[{"include_closed":true}]}'
    if ($Channels.error -or @($Channels.result.channels | Where-Object { $_.state.state_name -ne 'Closed' }).Count -gt 0) { throw "$NodeName has an open/pending channel. Keep it running; this cleanup is only for closed channels." }
    $Backup = Invoke-RestMethod -Uri $Url -Method Post -ContentType 'application/json' -Body '{"jsonrpc":"2.0","id":3,"method":"backup","params":[]}'
    if ($Backup.error) {
        # The Windows release does not expose the Admin RPC in its default
        # module set. Accept an automatic backup made after confirmed closure.
        if ($Backup.error.code -ne -32601) { throw "Backup failed for $NodeName; leaving nodes running." }
        $CloseEvidence = Get-Content -Raw (Join-Path $WeekRoot 'evidence/04-channel-closed.json') | ConvertFrom-Json
        $LatestBackup = Get-ChildItem -LiteralPath (Join-Path $NodeDir 'fiber/backups') -Directory |
            Where-Object { $_.Name -match '^\d+$' } | Sort-Object Name -Descending | Select-Object -First 1
        if (-not $LatestBackup) { throw "No automatic backup for $NodeName; leaving nodes running." }
        $BackupTime = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$LatestBackup.Name)
        if ($BackupTime -lt [DateTimeOffset]::Parse($CloseEvidence.capturedAt) -or
            @(Get-ChildItem -LiteralPath $LatestBackup.FullName -File -Recurse).Count -eq 0) {
            throw "No automatic backup after closure for $NodeName; leaving nodes running."
        }
        Write-Output "$NodeName automatic backup after closure verified: $($LatestBackup.Name)"
    }
    $OwnedProcesses += $Candidates[0]
}
# No active channels remain and RPC backups completed. Terminate only this lab's
# exact processes; all key, backup and channel database files are preserved.
foreach ($Owned in $OwnedProcesses) {
    Stop-Process -Id $Owned.ProcessId
    Write-Output "Stopped lab Fiber PID $($Owned.ProcessId). Runtime and backups preserved."
}

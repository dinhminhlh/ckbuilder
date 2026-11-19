param([ValidateSet('academy','ccc','queries')][string]$Action = 'queries')
$ErrorActionPreference = 'Stop'
$WeekRoot = Split-Path $PSScriptRoot -Parent
$file = switch ($Action) {
    'academy' { '01-academy-catalogue.json' }
    'ccc' { '02-ccc-inventory.json' }
    'queries' { '03-live-queries.json' }
}
$record = Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $WeekRoot "evidence/$file") | ConvertFrom-Json
Write-Output 'WEEK 08 - recorded evidence, not a new execution'
Write-Output "Captured: $($record.capturedAt)"
switch ($Action) {
    'academy' {
        Write-Output $record.limitation
        $record.courses | Format-Table position,title,studyStatus -AutoSize
    }
    'ccc' {
        Write-Output $record.limitation
        $record.examples | Format-Table title,evidenceExists -AutoSize
    }
    'queries' {
        $record | Select-Object source,nodeVersion,rpcUrl,address,tipBefore,tipAfter,balanceCKB | Format-List
        Write-Output "Sampled cells: $($record.cells.Count); sampled transactions: $($record.transactions.Count); limit: $($record.limitPerList)"
        Write-Output $record.note
        Write-Output 'Sample live Cell OutPoints:'
        $record.cells | Select-Object -First 3 @{Name='txHash';Expression={$_.outPoint.txHash}},@{Name='index';Expression={$_.outPoint.index}},capacityShannons | Format-List
        Write-Output 'Sample transaction records (not new transfers):'
        $record.transactions | Select-Object -First 3 txHash,blockNumber | Format-List
    }
}

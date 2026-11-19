$ErrorActionPreference = 'Stop'
$WeekRoot = Split-Path $PSScriptRoot -Parent
$RepoRoot = Split-Path $WeekRoot -Parent
$AcademyPin = '370f31f5dc432c5a4b07c81a7731e292235bc420'
$CccPin = '9ffef01a181751dacf1edde83ed43fcfb4646ded'
function Get-Source([string]$Url) { (Invoke-WebRequest -UseBasicParsing -Uri $Url).Content }
function Save-Json($Value, [string]$Name) {
    $json = $Value | ConvertTo-Json -Depth 20
    [IO.File]::WriteAllText((Join-Path $WeekRoot "evidence/$Name"), $json + "`n", [Text.UTF8Encoding]::new($false))
}
$base = "https://raw.githubusercontent.com/Flouse/ckb-academy/$AcademyPin/site/src/content/courses"
$order = Get-Source "$base/index.ts"
if ($order -notmatch '\.\.\.localCourses, \.\.\.communityCourses') { throw 'Review changed Academy ordering.' }
$courses = @()
foreach ($slug in @('basic-theory','basic-operation','nft-getting-started')) {
    $source = Get-Source "$base/$slug/index.ts"
    $name = [regex]::Match($source, "name: '([^']+)'").Groups[1].Value
    if (-not $name) { throw "Missing title: $slug" }
    $courses += [ordered]@{ position=$courses.Count+1; title=$name; url="https://academy.ckb.dev/courses/$slug"; kind='local'; studyStatus='Not verified' }
}
$community = Get-Source "$base/community-courses.tsx"
foreach ($match in [regex]::Matches($community, "(?s)id: '([^']+)'.*?name: '([^']+)'.*?url: '([^']+)'")) {
    $courses += [ordered]@{ position=$courses.Count+1; title=$match.Groups[2].Value; url=$match.Groups[3].Value; kind='community'; studyStatus='Not verified' }
}
if ($courses.Count -ne 8) { throw 'Expected eight source catalogue entries; review manually.' }
Save-Json ([ordered]@{ capturedAt=[DateTime]::UtcNow.ToString('o'); source="https://github.com/Flouse/ckb-academy/tree/$AcademyPin/site/src/content/courses"; sourceCommit=$AcademyPin; ordering='localCourses followed by communityCourses, as exported by index.ts'; limitation='Source catalogue order, not a programme-issued module numbering or evidence of learning completion.'; courses=$courses }) '01-academy-catalogue.json'

$docUrl = "https://raw.githubusercontent.com/ckb-devrel/ccc/$CccPin/packages/docs/content/docs/code-examples.mdx"
$doc = Get-Source $docUrl
$mapping = @{
    'Transfer CKB'='Week_02/CCC model/03_Transfer_CKB.png'
    'Sign & Verify Message'='Week_02/CCC model/06_Test_Signer.png'
    'Query Balance'='Week_02/CCC model/04_Query_Balance.png'
    'Query Cells'='Week_02/CCC model/05_Query_Cells.png'
    'Query Transactions'='Week_02/ckb-week02/Evidence/05_Query_Transactions.png'
}
$examples = @()
foreach ($item in [regex]::Matches($doc, '(?s)title: "([^"]+)".*?href: "([^"]+)".*?tags: \[([^\]]+)\].*?source: "([^"]+)"')) {
    if ($item.Groups[3].Value -notmatch '"playground"') { continue }
    $title = $item.Groups[1].Value
    $path = $mapping[$title]
    $exists = $path -and (Test-Path -LiteralPath (Join-Path $RepoRoot $path))
    $examples += [ordered]@{ title=$title; playgroundUrl=$item.Groups[2].Value; source=$item.Groups[4].Value; priorEvidence=$path; evidenceExists=[bool]$exists; evidenceSha256=if ($exists) { (Get-FileHash -LiteralPath (Join-Path $RepoRoot $path) -Algorithm SHA256).Hash.ToLower() } else { $null }; status=if ($exists) { 'Prior related screenshot; inspect scope, not proof of complete current example' } else { 'No mapped Playground evidence' } }
}
if ($examples.Count -lt 5) { throw 'Unexpected example gallery; review parser.' }
Save-Json ([ordered]@{ capturedAt=[DateTime]::UtcNow.ToString('o'); source=$docUrl; sourceCommit=$CccPin; scope='All gallery entries tagged playground in pinned CCC docs; programme subset not supplied'; limitation='Screenshot existence and checksum are inventory checks, not execution verification. Frontend query-transactions image is not a Playground screenshot. Transfer construction alone does not prove broadcast.'; examples=$examples }) '02-ccc-inventory.json'
$courses | ForEach-Object { [pscustomobject]$_ } | Format-Table position,title,studyStatus -AutoSize
$examples | ForEach-Object { [pscustomobject]$_ } | Format-Table title,evidenceExists,status -AutoSize

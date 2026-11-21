param(
    [Parameter(Mandatory=$true)][string]$DevEcoRoot,
    [string]$ProjectPath = '',
    [switch]$Forensics
)
$ErrorActionPreference = 'Stop'
if (!$ProjectPath) { $ProjectPath = Join-Path $PSScriptRoot '..\..\harmonywatch' }
$ProjectPath = (Resolve-Path $ProjectPath).Path
$node = Join-Path $DevEcoRoot 'tools\node\node.exe'
$prepareArgs = @((Join-Path $PSScriptRoot 'prepare.mjs'), '--project', $ProjectPath)
if ($Forensics) { $prepareArgs += '--forensics' }
& $node @prepareArgs
if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare the watch test scenario' }
# The U13 package trades ten languages for the exit trace; two packs keep every string it shows.
if ($Forensics) {
    & $node (Join-Path $PSScriptRoot 'build-locales.mjs') '--langs' 'en,zh-Hans' '--out' (Join-Path $ProjectPath 'entry\src\main\js\MainAbility\common\locales.js')
    if ($LASTEXITCODE -ne 0) { throw 'Cannot build the forensics locale set' }
}
& (Join-Path $PSScriptRoot 'build-local.ps1') -DevEcoRoot $DevEcoRoot -ProjectPath $ProjectPath -Module entry
if ($LASTEXITCODE -ne 0) { throw 'Watch test build failed' }
Write-Output 'Test scenario: no preset plan; the phone snapshot supplies it, existing device storage is retained.'
if ($Forensics) { Write-Output 'Forensics scenario: exit-trace instrumentation kept, languages limited to en and zh-Hans.' }

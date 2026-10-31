param(
    [Parameter(Mandatory=$true)][string]$DevEcoRoot,
    [string]$ProjectPath = '',
    [switch]$FirstLaunch
)
$ErrorActionPreference = 'Stop'
if (!$ProjectPath) { $ProjectPath = Join-Path $PSScriptRoot '..\..\harmonywatch' }
$ProjectPath = (Resolve-Path $ProjectPath).Path
$node = Join-Path $DevEcoRoot 'tools\node\node.exe'
$prepareArgs = @((Join-Path $PSScriptRoot 'prepare.mjs'), '--project', $ProjectPath)
# A test build always includes the preset plan unless the empty-start scenario was requested.
if (!$FirstLaunch) { $prepareArgs += '--builtin-plan' }
& $node @prepareArgs
if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare the watch test scenario' }
& (Join-Path $PSScriptRoot 'build-local.ps1') -DevEcoRoot $DevEcoRoot -ProjectPath $ProjectPath
if ($LASTEXITCODE -ne 0) { throw 'Watch test build failed' }
if ($FirstLaunch) { Write-Output 'First-launch scenario: no preset plan; existing device storage is retained.' }
else { Write-Output 'Personal test scenario: built-in PPL plan; existing device storage is retained.' }

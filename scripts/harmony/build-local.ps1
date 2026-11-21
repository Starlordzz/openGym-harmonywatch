param(
    [Parameter(Mandatory=$true)][string]$DevEcoRoot,
    [string]$ProjectPath = '',
    # Release by default: the unminified preview bundle exceeds the device's 48 KB limit.
    [switch]$DebugBuild
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $OutputEncoding
if (!$ProjectPath) { $ProjectPath = Join-Path $PSScriptRoot '..\..\harmonywatch' }
$ProjectPath = (Resolve-Path $ProjectPath).Path
if (!(Test-Path (Join-Path $ProjectPath 'build-profile.json5'))) {
    Copy-Item (Join-Path $ProjectPath 'build-profile.example.json5') (Join-Path $ProjectPath 'build-profile.json5')
}
$env:NODE_HOME = Join-Path $DevEcoRoot 'tools\node'
$env:DEVECO_SDK_HOME = Join-Path $DevEcoRoot 'sdk'
$env:JAVA_HOME = Join-Path $DevEcoRoot 'jbr'
$env:PATH = "$env:NODE_HOME;$(Join-Path $DevEcoRoot 'tools\ohpm\bin');$env:PATH"
$wrapper = Join-Path $DevEcoRoot 'tools\hvigor\bin\hvigorw.bat'
if (!(Test-Path $wrapper)) { throw 'DevEco Hvigor wrapper not found' }
Push-Location $ProjectPath
try {
    & (Join-Path $env:NODE_HOME 'node.exe') (Join-Path $PSScriptRoot 'check-lite-config.mjs') (Join-Path $ProjectPath 'entry\src\main\config.json')
    if ($LASTEXITCODE -ne 0) { throw 'Lite permission metadata is incomplete; run scripts/harmony/prepare.mjs first' }
    $buildMode = if ($DebugBuild) { 'debug' } else { 'release' }
    & $wrapper assembleHap --no-daemon --mode module -p product=default -p buildMode=$buildMode
    $result = $LASTEXITCODE
    if ($result -eq 0 -and $buildMode -eq 'release') {
        & (Join-Path $env:NODE_HOME 'node.exe') (Join-Path $PSScriptRoot 'optimize-lite-bundles.mjs') $ProjectPath (Join-Path $env:DEVECO_SDK_HOME 'default\openharmony')
        if ($LASTEXITCODE -ne 0) { throw 'Lite bundle optimization failed' }
    }
    # The device refuses a JS file over 48 KB; the previewer only warns, so gate release builds on it.
    $bundles = Join-Path $ProjectPath 'entry\build\default\intermediates\loader_out_lite\default\js\MainAbility'
    if ($result -eq 0 -and $buildMode -eq 'release') {
        & (Join-Path $env:NODE_HOME 'node.exe') (Join-Path $PSScriptRoot 'check-size.mjs') --files (Join-Path $bundles 'app.js') (Join-Path $bundles 'pages\index\index.js')
        if ($LASTEXITCODE -ne 0) { $result = $LASTEXITCODE }
    }
    if ($result -eq 0 -and !$DebugBuild) {
        & (Join-Path $env:NODE_HOME 'node.exe') (Join-Path $PSScriptRoot 'check-bundles.mjs') $bundles
        $result = $LASTEXITCODE
        if ($result -eq 0) {
            $simulator = Join-Path $env:DEVECO_SDK_HOME 'default\hms\previewer\liteWearable\bin\Simulator.exe'
            $previewConfig = Join-Path $ProjectPath '.idea\previewer\liteWearable\liteWearableSettingConfig_rd.json'
            if ((Test-Path $simulator) -and (Test-Path $previewConfig)) {
                & (Join-Path $env:NODE_HOME 'node.exe') (Join-Path $PSScriptRoot 'capture-preview.mjs') '--deveco' $DevEcoRoot '--project' $ProjectPath '--out' (Join-Path $ProjectPath 'artifacts\native-startup-check')
                if ($LASTEXITCODE -ne 0) { throw 'Native Lite startup failed; packaging stopped' }
            } else { Write-Output 'Native startup preview unavailable; ViewModel return and size checks completed.' }
            # Hvigor's release target only packages resources. Use its official Lite converter
            # on the freshly minified assets, then wrap that BIN instead of reusing a debug BIN.
            $sdkRoot = Join-Path $env:DEVECO_SDK_HOME 'default\openharmony'
            $java = Join-Path $env:JAVA_HOME 'bin\java.exe'
            $binDir = Join-Path $ProjectPath 'entry\build\default\outputs\default\bin'
            New-Item -ItemType Directory -Path $binDir -Force | Out-Null
            $bin = Join-Path $binDir 'entry-default-unsigned.bin'
            if (Test-Path $bin) { Remove-Item -LiteralPath $bin }
            & $java -jar (Join-Path $sdkRoot 'js\build-tools\binary-tools\haptobin_tool.jar') --project-path (Join-Path $ProjectPath 'entry\build\default\intermediates\lite_source\default') --bin-path $bin
            if ($LASTEXITCODE -ne 0 -or !(Test-Path $bin)) { throw 'Lite BIN conversion failed' }
            & (Join-Path $env:NODE_HOME 'node.exe') (Join-Path $PSScriptRoot 'check-lite-config.mjs') --bin $bin
            if ($LASTEXITCODE -ne 0) { throw 'Generated Lite BIN has invalid permission metadata' }
            & $java -jar (Join-Path $sdkRoot 'toolchains\lib\app_packing_tool.jar') --mode hap --bin-path $bin --out-path (Join-Path $ProjectPath 'entry\build\default\outputs\default\entry-default-unsigned.hap') --force true
            $result = $LASTEXITCODE
        }
    }
} finally { Pop-Location }
exit $result

param(
    [Parameter(Mandatory=$true)][string]$DevEcoRoot,
    [string]$ProjectPath = '',
    # Build one shape, or both entry (rect) and round (circle) HAPs.
    [ValidateSet('entry', 'round', 'all')][string]$Module = 'all',
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
$node = Join-Path $env:NODE_HOME 'node.exe'
$sdkRoot = Join-Path $env:DEVECO_SDK_HOME 'default\openharmony'
$java = Join-Path $env:JAVA_HOME 'bin\java.exe'
$buildMode = if ($DebugBuild) { 'debug' } else { 'release' }
$modules = if ($Module -eq 'all') { @('entry', 'round') } else { @($Module) }
$result = 0
Push-Location $ProjectPath
try {
    # Validate every requested module before the expensive build so -Module all cannot half-finish.
    $modulePaths = @{}
    foreach ($name in $modules) {
        $modulePath = Join-Path $ProjectPath $name
        $config = Join-Path $modulePath 'src\main\config.json'
        if (!(Test-Path $config)) {
            $hint = if ($name -eq 'round') { ' --round-project <project>\round' } else { '' }
            throw "Module $name is not staged; run scripts/harmony/prepare.mjs --project <project>$hint first"
        }
        & $node (Join-Path $PSScriptRoot 'check-lite-config.mjs') $config
        if ($LASTEXITCODE -ne 0) { throw "Lite permission metadata is incomplete in module $name; run scripts/harmony/prepare.mjs first" }
        $modulePaths[$name] = $modulePath
    }
    foreach ($name in $modules) {
        $modulePath = $modulePaths[$name]
        & $wrapper assembleHap --no-daemon --mode module -p product=default -p "module=${name}@default" -p buildMode=$buildMode
        $result = $LASTEXITCODE
        if ($result -ne 0) { break }
        $loader = Join-Path $modulePath 'build\default\intermediates\loader_out_lite\default\js\MainAbility'
        if ($buildMode -eq 'release') {
            & $node (Join-Path $PSScriptRoot 'optimize-lite-bundles.mjs') $ProjectPath $sdkRoot $name
            if ($LASTEXITCODE -ne 0) { throw "Lite bundle optimization failed for $name" }
        }
        # The device refuses a JS file over 48 KB; the previewer only warns, so gate release builds on it.
        if ($buildMode -eq 'release') {
            & $node (Join-Path $PSScriptRoot 'check-size.mjs') --files (Join-Path $loader 'app.js') (Join-Path $loader 'pages\index\index.js')
            $result = $LASTEXITCODE
            if ($result -ne 0) { break }
            & $node (Join-Path $PSScriptRoot 'check-bundles.mjs') $loader
            $result = $LASTEXITCODE
            if ($result -ne 0) { break }
        }
        if ($buildMode -eq 'release' -and $name -eq 'entry') {
            # The previewer target is the rect entry project; round shares the same page logic.
            $simulator = Join-Path $env:DEVECO_SDK_HOME 'default\hms\previewer\liteWearable\bin\Simulator.exe'
            $previewConfig = Join-Path $ProjectPath '.idea\previewer\liteWearable\liteWearableSettingConfig_rd.json'
            if ((Test-Path $simulator) -and (Test-Path $previewConfig)) {
                & $node (Join-Path $PSScriptRoot 'capture-preview.mjs') '--deveco' $DevEcoRoot '--project' $ProjectPath '--out' (Join-Path $ProjectPath 'artifacts\native-startup-check')
                if ($LASTEXITCODE -ne 0) { throw 'Native Lite startup failed; packaging stopped' }
            } else { Write-Output 'Native startup preview unavailable; ViewModel return and size checks completed.' }
        }
        if ($buildMode -eq 'release') {
            # Hvigor's release target only packages resources. Use its official Lite converter
            # on the freshly minified assets, then wrap that BIN instead of reusing a debug BIN.
            $binDir = Join-Path $modulePath 'build\default\outputs\default\bin'
            New-Item -ItemType Directory -Path $binDir -Force | Out-Null
            $bin = Join-Path $binDir "${name}-default-unsigned.bin"
            if (Test-Path $bin) { Remove-Item -LiteralPath $bin }
            & $java -jar (Join-Path $sdkRoot 'js\build-tools\binary-tools\haptobin_tool.jar') --project-path (Join-Path $modulePath 'build\default\intermediates\lite_source\default') --bin-path $bin
            if ($LASTEXITCODE -ne 0 -or !(Test-Path $bin)) { throw "Lite BIN conversion failed for $name" }
            & $node (Join-Path $PSScriptRoot 'check-lite-config.mjs') --bin $bin
            if ($LASTEXITCODE -ne 0) { throw "Generated Lite BIN in module $name has invalid permission metadata" }
            & $java -jar (Join-Path $sdkRoot 'toolchains\lib\app_packing_tool.jar') --mode hap --bin-path $bin --out-path (Join-Path (Join-Path $modulePath 'build\default\outputs\default') "${name}-default-unsigned.hap") --force true
            $result = $LASTEXITCODE
            if ($result -ne 0) { break }
        }
    }
} finally { Pop-Location }
exit $result

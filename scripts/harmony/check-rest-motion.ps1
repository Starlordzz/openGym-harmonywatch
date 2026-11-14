param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
# The synthetic rest scene has a 240 px canvas, centered at (204,128), radius 106.
$rows = @()
Get-ChildItem -LiteralPath $Directory -Filter 'frame-*.jpg' | Sort-Object { [int]($_.BaseName.Split('-')[1]) } | ForEach-Object {
    $bitmap = [System.Drawing.Bitmap]::new($_.FullName)
    try {
        $run = 0; $longest = 0; $end = -1
        for ($i = 0; $i -lt 3600; $i++) {
            $a = $i * [Math]::PI / 1800
            $x = [int][Math]::Round(204 + 106 * [Math]::Sin($a))
            $y = [int][Math]::Round(128 - 106 * [Math]::Cos($a))
            $c = $bitmap.GetPixel($x, $y)
            if ($c.G -gt 120 -and $c.G -gt $c.R * 1.7 -and $c.G -gt $c.B * 1.5) { $run = 0 }
            else { $run++; if ($run -gt $longest) { $longest = $run; $end = $i - $run } }
        }
        $rows += @{frame=$_.Name; endAngle=$end/10}
    } finally { $bitmap.Dispose() }
}
$distinct = @($rows.endAngle | Select-Object -Unique).Length
@{frames=$rows; distinctAngles=$distinct} | ConvertTo-Json -Depth 4
if ($rows.Length -lt 10 -or $distinct -lt 8) { throw 'Insufficient visible subsecond ring motion' }

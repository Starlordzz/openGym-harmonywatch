param([string]$Materials = "$PSScriptRoot\..\..\harmonywatch\artifacts\outputs\opengym-wearengine-resubmission-20261031")
$ErrorActionPreference = 'Stop'
$Materials = (Resolve-Path $Materials).Path
$preview = Join-Path $Materials 'preview'
New-Item -ItemType Directory -Force $preview | Out-Null
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AutomationSecurity = 3
$exports = @()
try {
    foreach ($kind in @('usage', 'authorization')) {
        $path = Join-Path $Materials "openGym-WearEngine-$kind-20261031.xlsx"
        $book = $excel.Workbooks.Open($path, 0, $true)
        try {
            $excel.CalculateFull()
            $views = if ($kind -eq 'usage') {
                @(@(1, 'A1:H7', 'usage-info'), @(1, 'A8:E10', 'usage-permissions'),
                  @(1, 'A11:E15', 'usage-device-images'), @(1, 'A17:E18', 'usage-flow-images'),
                  @(2, 'A1:A2', 'application-info'), @(3, 'A1:B4', 'additional-info'))
            } else {
                @(@(1, 'A1:B2', 'authorization-text'), @(1, 'A3:B8', 'authorization-device-images'),
                  @(1, 'A9:B11', 'authorization-notify-flow'))
            }
            foreach ($view in $views) {
                $sheet = $book.Worksheets.Item([int]$view[0])
                $sheet.PageSetup.PrintArea = [string]$view[1]
                $sheet.PageSetup.Zoom = $false
                $sheet.PageSetup.FitToPagesWide = 1
                $sheet.PageSetup.FitToPagesTall = 1
                # Use the installed printer's supported paper; some Windows drivers reject A3.
                $sheet.PageSetup.Orientation = if ($view[2] -match 'flow|device') { 1 } else { 2 }
                $file = Join-Path $preview ($view[2] + '.pdf')
                $sheet.ExportAsFixedFormat(0, $file)
                $exports += [string]$view[2]
            }
        } finally { $book.Close($false) }
    }
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
@{ engine = 'Microsoft Excel'; sourceOpenedReadOnly = $true; recalculated = $true; exports = $exports } |
    ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $preview 'excel-export.json')
Write-Output "Excel exported $($exports.Count) review views; source files were not changed."

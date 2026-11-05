# Start an isolated WeChat DevTools project with the local orderService ledger.
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$cli = Join-Path ${env:ProgramFiles(x86)} 'Tencent\微信web开发者工具\cli.bat'
if (-not (Test-Path -LiteralPath $cli)) { throw 'WeChat DevTools CLI not found.' }
$backend = Join-Path $PSScriptRoot 'group-test-service.js'
if (-not (Get-NetTCPConnection -State Listen -LocalPort 18746 -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath (Get-Command node).Source -ArgumentList ('"' + $backend + '"') -WorkingDirectory $project -WindowStyle Hidden
}
$copy = Join-Path $env:TEMP ('UniEarn-Group-Flow-' + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $copy | Out-Null
foreach ($name in 'assets','components','pages','utils','stickers','app.js','app.json','app.wxss','sitemap.json','project.config.json','project.private.config.json') {
  Copy-Item -LiteralPath (Join-Path $project $name) -Destination $copy -Recurse
}
$config = Join-Path $copy 'project.private.config.json'
$settings = Get-Content -LiteralPath $config -Raw -Encoding UTF8 | ConvertFrom-Json
$settings.projectname = 'UniEarn-Group-Flow'
$settings.setting.urlCheck = $false
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($config, ($settings | ConvertTo-Json -Depth 60), $utf8)
# Default to the seeded hall when DevTools compiles this test copy.
$hall = Join-Path $copy 'pages/jobs/index.js'
$source = [IO.File]::ReadAllText($hall)
[IO.File]::WriteAllText($hall, $source.Replace("o.groupTest==='1'", "(o.groupTest==='1'||!demo.current())"), $utf8)
& $cli open --project $copy

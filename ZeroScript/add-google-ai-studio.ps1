$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$extension = Join-Path $root 'zeroscript-extension'
$manifestPath = Join-Path $extension 'manifest.json'
$backgroundPath = Join-Path $extension 'background.js'
$popupPath = Join-Path $extension 'popup.js'
$mainPath = Join-Path $extension 'core\main.js'
$providerPath = Join-Path $extension 'providers\aistudio.js'
$aiStudioHost = 'https://aistudio.google.com/*'

function Save-WithBackup($path, $content) {
  Copy-Item $path "$path.bak" -Force
  [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
}

if (-not (Test-Path $manifestPath) -or -not (Test-Path $providerPath)) {
  throw 'Complete ZeroScript folder not found. Keep the whole project extracted and try again.'
}

$manifestRaw = Get-Content $manifestPath -Raw
$manifest = $manifestRaw | ConvertFrom-Json
$permissions = [System.Collections.Generic.List[string]]@($manifest.host_permissions)
$hadPermission = $permissions.Contains($aiStudioHost)
if (-not $permissions.Contains($aiStudioHost)) { $permissions.Add($aiStudioHost) }
$manifest.host_permissions = $permissions.ToArray()
$scripts = [System.Collections.Generic.List[object]]@($manifest.content_scripts)
$scriptExists = $scripts | Where-Object { @($_.matches) -contains $aiStudioHost }
$hadScript = [bool]$scriptExists
if (-not $scriptExists) {
  $scripts.Insert(0, [pscustomobject]@{
    matches = @($aiStudioHost)
    js = @('core/config.js', 'core/parser.js', 'providers/aistudio.js', 'core/main.js')
    css = @('overlay.css')
    run_at = 'document_idle'
  })
}
$manifest.content_scripts = $scripts.ToArray()
if (-not $hadPermission -or -not $hadScript) {
  Save-WithBackup $manifestPath (($manifest | ConvertTo-Json -Depth 20) + "`r`n")
}

$background = Get-Content $backgroundPath -Raw
if ($background -notmatch 'aistudio\.google\.com') {
  Save-WithBackup $backgroundPath ($background.Replace('"https://gemini.google.com/*",', '"https://gemini.google.com/*", "https://aistudio.google.com/*",'))
}
$popup = Get-Content $popupPath -Raw
if ($popup -notmatch 'aistudio\.google\.com') {
  Save-WithBackup $popupPath ($popup.Replace('"gemini.google.com",', '"gemini.google.com", "aistudio.google.com",'))
}
$main = Get-Content $mainPath -Raw
if ($main -notmatch 'Google AI Studio') {
  Save-WithBackup $mainPath ($main.Replace('{ name: "Gemini", url: "https://gemini.google.com/app" },', '{ name: "Gemini", url: "https://gemini.google.com/app" },' + "`r`n" + '    { name: "Google AI Studio", url: "https://aistudio.google.com/prompts/new_chat" },'))
}

if (Get-Command node.exe -ErrorAction SilentlyContinue) {
  node.exe --check $providerPath
  node.exe --check $backgroundPath
  node.exe --check $popupPath
  node.exe --check $mainPath
}
$check = Get-Content $manifestPath -Raw | ConvertFrom-Json
if (-not (@($check.host_permissions) -contains $aiStudioHost)) { throw 'AI Studio permission was not registered.' }
if (-not ((Get-Content $manifestPath -Raw) -match 'providers/aistudio\.js')) { throw 'AI Studio content script was not registered.' }
Write-Host '  PASS: Google AI Studio is installed or was already installed.' -ForegroundColor Green
Write-Host '  Backup files are created when the installer changes a file.'
exit 0
param([Parameter(Mandatory=$true)][string]$Url)
$ErrorActionPreference = "Stop"
$candidates = @(
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chrome = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) {
  foreach ($key in @("HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe","HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe","HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe")) {
    try {
      $candidate = (Get-Item -LiteralPath $key).GetValue("")
      if ($candidate -and (Test-Path $candidate)) { $chrome = $candidate; break }
    } catch {}
  }
}
if (-not $chrome) { throw "No se encontró Google Chrome instalado." }
Start-Process -FilePath $chrome -ArgumentList ('--new-tab "' + $Url + '"')

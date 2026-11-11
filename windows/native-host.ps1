$ErrorActionPreference = "Stop"
$inputStream = [Console]::OpenStandardInput()
$outputStream = [Console]::OpenStandardOutput()
function Read-Exact([System.IO.Stream]$stream, [int]$count) {
  $buffer = New-Object byte[] $count
  $offset = 0
  while ($offset -lt $count) {
    $read = $stream.Read($buffer, $offset, $count - $offset)
    if ($read -le 0) { throw "Entrada incompleta del navegador." }
    $offset += $read
  }
  return ,$buffer
}
function Send-Response($value) {
  $json = ConvertTo-Json -InputObject $value -Depth 8 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $length = [BitConverter]::GetBytes([int]$bytes.Length)
  $outputStream.Write($length, 0, 4)
  $outputStream.Write($bytes, 0, $bytes.Length)
  $outputStream.Flush()
}
try {
  $lengthBytes = Read-Exact $inputStream 4
  $length = [BitConverter]::ToInt32($lengthBytes, 0)
  if ($length -lt 1 -or $length -gt 1048576) { throw "Tamaño de mensaje no válido." }
  $payload = Read-Exact $inputStream $length
  $request = ([System.Text.Encoding]::UTF8.GetString($payload) | ConvertFrom-Json)
  $base = Join-Path $env:LOCALAPPDATA "MLExcelAutomatico"
  $configPath = Join-Path $base "config.json"
  $runner = Join-Path $base "run-download.ps1"
  $url = "https://vendedores.mercadolibre.com.ve/publicaciones/edicion-en-excel/download?mlh_auto=1"
  if (-not (Test-Path $base)) { New-Item -ItemType Directory -Path $base -Force | Out-Null }

  if ($request.action -eq "getConfig") {
    if (Test-Path $configPath) {
      $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    } else {
      $config = [pscustomobject]@{ startup = $true; schedules = @("12:00") }
    }
    Send-Response @{ success = $true; config = $config }
    exit
  }

  if ($request.action -ne "saveConfig") { throw "Acción no reconocida." }
  $startup = [bool]$request.config.startup
  $times = @($request.config.schedules | ForEach-Object { [string]$_ } | Sort-Object -Unique)
  foreach ($time in $times) {
    if ($time -notmatch '^([01]\d|2[0-3]):[0-5]\d$') { throw "Horario inválido: $time" }
  }
  $config = [pscustomobject]@{ startup = $startup; schedules = $times }
  $config | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $configPath -Encoding UTF8

  $taskPrefix = "MLExcelAuto-"
  Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -like "$taskPrefix*" } | ForEach-Object {
    Unregister-ScheduledTask -TaskName $_.TaskName -Confirm:$false -ErrorAction SilentlyContinue
  }
  $powershell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
  $arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $runner + '" -Url "' + $url + '"'
  $action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
  $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

  if ($startup) {
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
    Register-ScheduledTask -TaskName ($taskPrefix + "InicioSesion") -Action $action -Trigger $trigger -Principal $principal -Description "Descarga automática de planilla de MercadoLibre al iniciar sesión." -Force | Out-Null
  }
  foreach ($time in $times) {
    $at = [datetime]::Today.Add([timespan]::Parse($time))
    $trigger = New-ScheduledTaskTrigger -Daily -At $at
    $safe = $time.Replace(":", "")
    Register-ScheduledTask -TaskName ($taskPrefix + "Diario-" + $safe) -Action $action -Trigger $trigger -Principal $principal -Description ("Descarga automática de MercadoLibre a las " + $time) -Force | Out-Null
  }
  Send-Response @{ success = $true; config = $config }
} catch {
  try { Send-Response @{ success = $false; error = $_.Exception.Message } } catch {}
}

$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "Instalador de automatización de MercadoLibre Excel" -ForegroundColor Cyan
Write-Host "Primero carga la carpeta extension en chrome://extensions y copia su ID."
$extensionId = Read-Host "ID de la extensión (32 letras)"
if ($extensionId -notmatch '^[a-p]{32}$') { throw "El ID no tiene el formato esperado de una extensión de Chrome." }

$installDir = Join-Path $env:LOCALAPPDATA "MLExcelAutomatico"
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "windows\native-host.ps1") -Destination (Join-Path $installDir "native-host.ps1") -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "windows\run-download.ps1") -Destination (Join-Path $installDir "run-download.ps1") -Force

$scriptPath = (Join-Path $installDir "native-host.ps1").Replace('"','""')
$csharp = @"
using System;
using System.Diagnostics;
using System.IO;
public class MLExcelNativeHost {
  static void ReadAll(Stream s, byte[] b) { int o=0; while(o<b.Length){ int n=s.Read(b,o,b.Length-o); if(n<=0) throw new EndOfStreamException(); o+=n; } }
  public static void Main() {
    byte[] len=new byte[4]; Stream input=Console.OpenStandardInput(); Stream output=Console.OpenStandardOutput();
    try {
      ReadAll(input,len); int size=BitConverter.ToInt32(len,0); if(size<1 || size>1048576) return;
      byte[] payload=new byte[size]; ReadAll(input,payload);
      ProcessStartInfo psi=new ProcessStartInfo();
      psi.FileName=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),@"System32\WindowsPowerShell\v1.0\powershell.exe");
      psi.Arguments="-NoProfile -ExecutionPolicy Bypass -File \"" + @"$scriptPath" + "\"";
      psi.UseShellExecute=false; psi.RedirectStandardInput=true; psi.RedirectStandardOutput=true; psi.CreateNoWindow=true;
      using(Process p=Process.Start(psi)) {
        Stream childIn=p.StandardInput.BaseStream; childIn.Write(len,0,4); childIn.Write(payload,0,payload.Length); childIn.Flush(); p.StandardInput.Close();
        Stream childOut=p.StandardOutput.BaseStream; byte[] outLen=new byte[4]; ReadAll(childOut,outLen); int outSize=BitConverter.ToInt32(outLen,0);
        if(outSize<1 || outSize>1048576) return; byte[] response=new byte[outSize]; ReadAll(childOut,response);
        output.Write(outLen,0,4); output.Write(response,0,response.Length); output.Flush(); p.WaitForExit();
      }
    } catch { }
  }
}
"@
$nativeExe = Join-Path $installDir "ml-excel-native-host.exe"
if (Test-Path $nativeExe) { Remove-Item $nativeExe -Force }
Add-Type -TypeDefinition $csharp -Language CSharp -OutputType ConsoleApplication -OutputAssembly $nativeExe

$manifest = [ordered]@{
  name = "com.repuestos.ml_excel_scheduler"
  description = "Programador local de descargas de MercadoLibre Excel"
  path = $nativeExe
  type = "stdio"
  allowed_origins = @("chrome-extension://$extensionId/")
}
$manifestPath = Join-Path $installDir "native-host-manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.repuestos.ml_excel_scheduler"
New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $manifestPath

Write-Host ""
Write-Host "Instalación completada." -ForegroundColor Green
Write-Host "Abre la extensión en Chrome y entra en su configuración para guardar los horarios."
Write-Host "Por defecto quedarán: inicio de sesión y 12:00."

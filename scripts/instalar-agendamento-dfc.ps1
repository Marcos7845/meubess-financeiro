# Execute uma vez na conta do dono. Registra ou substitui somente esta tarefa.
$ErrorActionPreference = 'Stop'
$fuso = (Get-TimeZone).Id
if ($fuso -ne 'E. South America Standard Time') {
  throw "O Windows precisa estar no fuso de Brasilia (E. South America Standard Time); atual: $fuso"
}

$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = (Get-Command node.exe -ErrorAction Stop).Source
$usuario = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$acao = New-ScheduledTaskAction -Execute $node -Argument 'scripts/financeiro-enviar-dfc.mjs' -WorkingDirectory $raiz
$gatilhos = @(
  (New-ScheduledTaskTrigger -Daily -At '10:00')
  (New-ScheduledTaskTrigger -Daily -At '18:00')
)
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
$configuracao = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'financeiro-enviar-dfc' -Action $acao -Trigger $gatilhos -Principal $principal -Settings $configuracao -Description 'Envia o DFC e atualiza o espelho local as 10:00 e 18:00 (Brasilia)' -Force | Out-Null
Write-Host 'Tarefa financeiro-enviar-dfc atualizada: diariamente as 10:00 e 18:00 (Brasilia).'

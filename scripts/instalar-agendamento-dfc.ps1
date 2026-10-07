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
# Gatilho horário, como a tarefa instalada (conferido em 07/10/2026): começa às 20:00 e repete a cada 1 hora, sem término.
$gatilhos = @(
  (New-ScheduledTaskTrigger -Once -At '20:00' -RepetitionInterval (New-TimeSpan -Hours 1))
)
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
$configuracao = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'financeiro-enviar-dfc' -Action $acao -Trigger $gatilhos -Principal $principal -Settings $configuracao -Description 'MeuBESS Financeiro: manda o DFC deste PC ao servidor do Railway, de hora em hora' -Force | Out-Null
Write-Host 'Tarefa financeiro-enviar-dfc atualizada: de hora em hora, a partir das 20:00.'

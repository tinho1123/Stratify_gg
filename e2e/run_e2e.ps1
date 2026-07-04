# run_e2e.ps1 — Roda os flows E2E Maestro no emulador Android conectado
# Uso: .\e2e\run_e2e.ps1
# Ou um flow específico: .\e2e\run_e2e.ps1 -Flow 04_market.yaml

param(
  [string]$Flow = ""
)

# Verifica Maestro
$maestroCmd = Get-Command maestro -ErrorAction SilentlyContinue
if (-not $maestroCmd) {
  Write-Host "ERRO: Maestro nao encontrado." -ForegroundColor Red
  Write-Host "Instale com:" -ForegroundColor Yellow
  Write-Host '  iex "$(iwr ''https://get.maestro.mobile.dev'' -UseBasicParsing).Content"'
  exit 1
}

# Verifica dispositivo conectado
$devices = & adb devices 2>&1 | Select-String -Pattern "emulator|device$"
if (-not $devices) {
  Write-Host "ERRO: Nenhum emulador/dispositivo encontrado." -ForegroundColor Red
  Write-Host "Inicie o emulador pelo Android Studio (AVD Manager)." -ForegroundColor Yellow
  exit 1
}

Write-Host "Dispositivo encontrado: $devices" -ForegroundColor Green

$e2eDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Flow) {
  Write-Host "`nRodando flow: $Flow" -ForegroundColor Cyan
  maestro test "$e2eDir\$Flow"
} else {
  $flows = @(
    "01_login.yaml",
    "02_dashboard.yaml",
    "03_matches.yaml",
    "04_market.yaml",
    "05_training.yaml"
  )

  $passed = 0
  $failed = 0

  foreach ($f in $flows) {
    Write-Host "`n--- $f ---" -ForegroundColor Cyan
    maestro test "$e2eDir\$f"
    if ($LASTEXITCODE -eq 0) {
      Write-Host "PASSOU" -ForegroundColor Green
      $passed++
    } else {
      Write-Host "FALHOU" -ForegroundColor Red
      $failed++
    }
  }

  Write-Host "`n============================" -ForegroundColor White
  Write-Host "Resultado: $passed passaram, $failed falharam" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
}

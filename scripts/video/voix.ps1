# Voix off de la video SIGTB : un WAV par sequence (voix Windows
# « Microsoft Hortense Desktop », System.Speech). Usage :
#   pwsh scripts/video/voix.ps1 -Travail <dossier de travail> [-Debit -1]
param(
  [Parameter(Mandatory = $true)][string]$Travail,
  [int]$Debit = 0
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$plan = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'sequences.json') | ConvertFrom-Json
$dossier = Join-Path $Travail 'voix'
New-Item -ItemType Directory -Force $dossier | Out-Null

# Prononciation : sigles epeles, le texte affiche (sous-titres) reste inchange.
$prononcer = @{ 'SIGTB' = 'S.I.G.T.B.'; 'CBG' = 'C.B.G.'; 'KOGON' = 'Kogon' }

foreach ($s in $plan.sequences) {
  $texte = $s.texte
  foreach ($k in $prononcer.Keys) { $texte = $texte -replace "\b$k\b", $prononcer[$k] }
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.SelectVoice('Microsoft Hortense Desktop')
  $synth.Rate = $Debit
  $sortie = Join-Path $dossier "$($s.id).wav"
  $synth.SetOutputToWaveFile($sortie)
  $synth.Speak($texte)
  $synth.Dispose()
  Write-Output "voix $($s.id)"
}

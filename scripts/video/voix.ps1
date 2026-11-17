# Voix off de la video SIGTB : un WAV par phrase (les pauses entre phrases
# sont posees a l'assemblage) (voix Windows
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
  $k = 0
  foreach ($ph in $s.phrases) {
    $k += 1
    $texte = $ph.texte
    foreach ($c in $prononcer.Keys) { $texte = $texte -replace "$c", $prononcer[$c] }
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SelectVoice('Microsoft Hortense Desktop')
    $synth.Rate = $Debit
    $synth.SetOutputToWaveFile((Join-Path $dossier "$($s.id)-$k.wav"))
    $synth.Speak($texte)
    $synth.Dispose()
  }
  Write-Output "voix $($s.id) ($k phrases)"
}

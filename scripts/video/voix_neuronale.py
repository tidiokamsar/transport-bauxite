"""Voix off neuronale de la video SIGTB (edge-tts), un WAV par phrase.

Remplace voix.ps1 (Hortense, conserve en repli). Chaque phrase est synthetisee
puis traitee par ffmpeg : passe-haut 80 Hz, legere presence, compression douce.
Usage : python scripts/video/voix_neuronale.py <travail> [voix] [debit]
  voix  : defaut fr-FR-DeniseNeural (essai compare avec fr-FR-HenriNeural)
  debit : defaut -5%
Le texte des phrases part vers le service de synthese de Microsoft (edge-tts) :
il ne contient que le script public de la video, aucune donnee d'exploitation.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
FFMPEG = Path(os.environ.get('FFMPEG_BIN', r'C:\Users\ELHAMADOUTIDIANEDIAL\AppData\Local\Microsoft\WinGet\Packages'
                             r'\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin')) / 'ffmpeg.exe'
# Sigles epeles ; le texte des sous-titres reste celui de sequences.json.
PRONONCER = {'SIGTB': 'S.I.G.T.B.', 'CBG': 'C.B.G.'}
TRAITEMENT = ('highpass=f=80,equalizer=f=3000:t=q:w=1.2:g=2,'
              'acompressor=threshold=-20dB:ratio=2.5:attack=10:release=180:makeup=2,'
              'aresample=48000,aformat=channel_layouts=mono')


def main() -> None:
    travail = Path(sys.argv[1])
    voix = sys.argv[2] if len(sys.argv) > 2 else 'fr-FR-DeniseNeural'
    debit = sys.argv[3] if len(sys.argv) > 3 else '-5%'
    dossier = travail / 'voix'
    dossier.mkdir(parents=True, exist_ok=True)
    plan = json.loads((ICI / 'sequences.json').read_text(encoding='utf-8'))
    for s in plan['sequences']:
        for k, ph in enumerate(s['phrases'], start=1):
            texte = ph['texte']
            for sigle, dit in PRONONCER.items():
                texte = texte.replace(sigle, dit)
            brut = dossier / f"{s['id']}-{k}.mp3"
            subprocess.run([sys.executable, '-m', 'edge_tts', '--voice', voix, f'--rate={debit}', '--text', texte,
                            '--write-media', str(brut)], check=True, capture_output=True)
            subprocess.run([str(FFMPEG), '-y', '-v', 'error', '-i', str(brut), '-af', TRAITEMENT,
                            str(dossier / f"{s['id']}-{k}.wav")], check=True)
            brut.unlink()
        print(f"voix {s['id']} ({len(s['phrases'])} phrases)")


if __name__ == '__main__':
    main()

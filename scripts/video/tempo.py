"""Estimation du tempo de la musique de fond (BPM et premier temps).

Enveloppe d'energie (ffmpeg -> PCM mono 11025 Hz), flux d'attaque, puis
autocorrelation entre 70 et 170 BPM ; la phase est le decalage qui maximise
l'energie des attaques sur la grille. Ecrit {"bpm", "phase"} sur la sortie.
Usage : python scripts/video/tempo.py <musique.mp3>
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np

FFMPEG = Path(os.environ.get('FFMPEG_BIN', r'C:\Users\ELHAMADOUTIDIANEDIAL\AppData\Local\Microsoft\WinGet\Packages'
                             r'\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin')) / 'ffmpeg.exe'
SR, HOP = 11025, 256

brut = subprocess.run([str(FFMPEG), '-v', 'error', '-i', sys.argv[1], '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                      check=True, capture_output=True).stdout
x = np.frombuffer(brut, dtype=np.int16).astype(np.float32) / 32768
n = len(x) // HOP
energie = np.sqrt((x[: n * HOP].reshape(n, HOP) ** 2).mean(axis=1))
flux = np.maximum(0, np.diff(np.log1p(100 * energie), prepend=0))
flux -= flux.mean()
img_s = SR / HOP
ac = np.correlate(flux, flux, mode='full')[len(flux) - 1:]
retards = np.arange(int(img_s * 60 / 170), int(img_s * 60 / 70))
retard = retards[np.argmax(ac[retards])]
bpm = 60 * img_s / retard
periode = retard
phases = [flux[p::periode].sum() for p in range(periode)]
phase = int(np.argmax(phases)) / img_s
print(json.dumps({'bpm': round(float(bpm), 2), 'phase': round(phase, 3)}))

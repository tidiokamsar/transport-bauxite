// Plan commun de la video : lit sequences.json et les durees des WAV
// (ffprobe), calcule la duree de chaque plan. Regle de synchronisation :
// une sequence dure (voix + PAUSE) ; chaque plan est allonge de FONDU
// pour le fondu enchaine (xfade), qui chevauche le plan suivant.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ICI = dirname(fileURLToPath(import.meta.url));
export const FPS = 25;
export const PAUSE = 0.5;
export const FONDU = 0.6;
export const LARGEUR = 1920;
export const HAUTEUR = 1080;

const binFfmpeg = process.env.FFMPEG_BIN
  ?? 'C:/Users/ELHAMADOUTIDIANEDIAL/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin';
export const FFMPEG = join(binFfmpeg, 'ffmpeg.exe');
export const FFPROBE = join(binFfmpeg, 'ffprobe.exe');

export interface PlanBrut { carte?: string; adresse?: string; surligner?: string; jeu?: string }
export interface Sequence { id: string; titre: string; texte: string; plans: PlanBrut[] }
export interface Plan extends PlanBrut { nom: string; sequence: Sequence; numero: number; duree: number }

export const sequences = (): Sequence[] =>
  JSON.parse(readFileSync(join(ICI, 'sequences.json'), 'utf8')).sequences;

export const dureeMedia = (fichier: string) =>
  Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fichier]).toString().trim());

export const dureeVoix = (travail: string, s: Sequence) => dureeMedia(join(travail, 'voix', `${s.id}.wav`));

/** Plans dans l'ordre, avec duree (s) arrondie a l'image. */
export const plans = (travail: string): Plan[] => {
  const tous: Plan[] = [];
  sequences().forEach((s, i) => {
    const part = (dureeVoix(travail, s) + PAUSE) / s.plans.length;
    s.plans.forEach((p, k) => {
      tous.push({ ...p, sequence: s, numero: i + 1, nom: `${s.id}-${k + 1}`, duree: Math.round((part + FONDU) * FPS) / FPS });
    });
  });
  return tous;
};

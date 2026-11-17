// Plan commun de la video : lit sequences.json et les durees des WAV (une
// voix par phrase, ffprobe), calcule la duree et le debut de chaque plan.
// Regle : une phrase dure sa voix plus PAUSE_PHRASE (plus PAUSE_SEQUENCE en
// fin de sequence) ; un plan couvre ses phrases et s'allonge de FONDU, duree
// du fondu enchaine (xfade) qui le chevauche avec le plan suivant.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ICI = dirname(fileURLToPath(import.meta.url));
export const FPS = 25;
export const FONDU = 0.6;
export const PAUSE_PHRASE = 0.35;
export const PAUSE_SEQUENCE = 0.4;
export const LARGEUR = 1920;
export const HAUTEUR = 1080;
/** Bande de titre en haut de l'image, hors de la capture d'ecran. */
export const BANDE = 56;

const binFfmpeg = process.env.FFMPEG_BIN
  ?? 'C:/Users/ELHAMADOUTIDIANEDIAL/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin';
export const FFMPEG = join(binFfmpeg, 'ffmpeg.exe');
export const FFPROBE = join(binFfmpeg, 'ffprobe.exe');

export interface PlanBrut { carte?: string; adresse?: string; surligner?: string; jeu?: string; choisir?: string; defiler?: boolean }
export interface PhraseBrute { texte: string; plan?: PlanBrut }
export interface Sequence { id: string; titre: string; phrases: PhraseBrute[] }
export interface Phrase { texte: string; wav: string; voix: number; debut: number }
export interface Plan extends PlanBrut { nom: string; sequence: Sequence; numero: number; duree: number; debut: number; phrases: Phrase[] }

export const sequences = (): Sequence[] =>
  JSON.parse(readFileSync(join(ICI, 'sequences.json'), 'utf8')).sequences;

export const dureeMedia = (fichier: string) =>
  Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fichier]).toString().trim());

/** Plans dans l'ordre, avec debut (s) dans la video et phrases horodatees. */
export const plans = (travail: string): Plan[] => {
  const tous: Plan[] = [];
  sequences().forEach((s, i) => {
    s.phrases.forEach((ph, k) => {
      const wav = join(travail, 'voix', `${s.id}-${k + 1}.wav`);
      const voix = dureeMedia(wav);
      const creneau = voix + PAUSE_PHRASE + (k === s.phrases.length - 1 ? PAUSE_SEQUENCE : 0);
      if (ph.plan || tous.length === 0) {
        tous.push({ ...ph.plan, sequence: s, numero: i + 1, nom: `${s.id}-${k + 1}`, duree: FONDU, debut: 0, phrases: [] });
      }
      const plan = tous[tous.length - 1];
      plan.phrases.push({ texte: ph.texte, wav, voix, debut: plan.duree - FONDU });
      plan.duree += creneau;
    });
  });
  // Arrondi a l'image puis debuts absolus (les phrases etaient relatives).
  let t = 0;
  for (const p of tous) {
    p.duree = Math.round(p.duree * FPS) / FPS;
    p.debut = t;
    p.phrases.forEach((ph) => { ph.debut += t; });
    t += p.duree - FONDU;
  }
  return tous;
};

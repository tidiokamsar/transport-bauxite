// Assemblage de la video : un clip par plan (zoom lent sur les ecrans,
// images des cartes), fondus enchaines (xfade), voix placee au debut de
// chaque sequence, sous-titres SRT incrustes, son normalise (loudnorm),
// H.264 + AAC, faststart. Usage :
//   node scripts/video/assembler.ts <travail> <sortie.mp4>
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FFMPEG, FPS, FONDU, LARGEUR, HAUTEUR, plans, dureeVoix, sequences } from './commun.ts';

const travail = resolve(process.argv[2] ?? '');
const sortie = resolve(process.argv[3] ?? join(travail, 'SIGTB_presentation.mp4'));
const ff = (args: string[]) => execFileSync(FFMPEG, ['-y', '-v', 'error', ...args], { cwd: travail, stdio: 'inherit' });

const tous = plans(travail);
const cibles: Record<string, { cx: number; cy: number }> = JSON.parse(readFileSync(join(travail, 'cibles.json'), 'utf8'));
mkdirSync(join(travail, 'clips'), { recursive: true });

// 1. Clips
for (const p of tous) {
  const clip = join(travail, 'clips', `${p.nom}.mp4`);
  const n = Math.round(p.duree * FPS);
  const code = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
  if (p.carte) {
    ff(['-framerate', String(FPS), '-i', join(travail, 'images', p.nom, '%04d.png'), '-frames:v', String(n), ...code, clip]);
  } else {
    const c = cibles[p.nom] ?? { cx: 0.55, cy: 0.45 };
    const ampleur = p.surligner ? 0.12 : 0.06;
    const z = `1+${ampleur}*on/${n}`;
    const x = `clip(${c.cx.toFixed(3)}*iw-iw/zoom/2,0,iw-iw/zoom)`;
    const y = `clip(${c.cy.toFixed(3)}*ih-ih/zoom/2,0,ih-ih/zoom)`;
    ff(['-loop', '1', '-framerate', String(FPS), '-i', join(travail, 'images', `${p.nom}.png`),
      '-vf', `scale=${LARGEUR * 2}:${HAUTEUR * 2}:flags=lanczos,zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${LARGEUR}x${HAUTEUR}:fps=${FPS}`,
      '-frames:v', String(n), ...code, clip]);
  }
  console.log(`clip ${p.nom} ${p.duree} s`);
}

// 2. Debut de chaque sequence dans la video (chevauchement des fondus deduit)
const debuts: Record<string, number> = {};
let t = 0;
for (const p of tous) {
  if (!(p.sequence.id in debuts)) debuts[p.sequence.id] = t;
  t += p.duree - FONDU;
}
const total = t + FONDU;

// 3. Sous-titres : phrases reparties au prorata des caracteres sur la voix
const horodatage = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000), m = Math.floor(ms / 60_000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const couper = (texte: string) => texte.split(/(?<=[.!?:])\s+/).flatMap((ph) => {
  if (ph.length <= 90) return [ph];
  const i = ph.lastIndexOf(', ', Math.floor(ph.length / 2) + 20);
  return i > 20 ? [ph.slice(0, i + 1), ph.slice(i + 2)] : [ph];
});
const deuxLignes = (ph: string) => {
  if (ph.length <= 48) return ph;
  const m = Math.floor(ph.length / 2);
  const g = ph.lastIndexOf(' ', m), d = ph.indexOf(' ', m);
  const i = d < 0 || (g >= 0 && m - g <= d - m) ? g : d;
  return `${ph.slice(0, i)}\n${ph.slice(i + 1)}`;
};
const srt: string[] = [];
let num = 1;
for (const s of sequences()) {
  const voix = dureeVoix(travail, s);
  const phrases = couper(s.texte);
  const poids = phrases.reduce((a, ph) => a + ph.length, 0);
  let debut = debuts[s.id] + 0.15;
  for (const ph of phrases) {
    const fin = debut + (voix * ph.length) / poids;
    srt.push(`${num++}\n${horodatage(debut)} --> ${horodatage(fin - 0.05)}\n${deuxLignes(ph)}\n`);
    debut = fin;
  }
}
writeFileSync(join(travail, 'sous-titres.srt'), srt.join('\n'), 'utf8');

// 4. Assemblage final
const entrees: string[] = [];
tous.forEach((p) => entrees.push('-i', join(travail, 'clips', `${p.nom}.mp4`)));
const seqs = sequences();
seqs.forEach((s) => entrees.push('-i', join(travail, 'voix', `${s.id}.wav`)));
const filtres: string[] = [];
let prec = '[0:v]';
let offset = 0;
tous.forEach((p, i) => {
  if (i === 0) { offset = p.duree - FONDU; return; }
  const transition = p.sequence.id === tous[i - 1].sequence.id ? 'fade' : 'fadeblack';
  const etiquette = `[x${i}]`;
  filtres.push(`${prec}[${i}:v]xfade=transition=${transition}:duration=${FONDU}:offset=${offset.toFixed(3)}${etiquette}`);
  prec = etiquette;
  offset += p.duree - FONDU;
});
const style = "FontName=Segoe UI,FontSize=11,PrimaryColour=&H00FFFFFF,OutlineColour=&H70120A06,BorderStyle=3,Outline=5,Shadow=0,MarginV=18";
filtres.push(`${prec}subtitles=sous-titres.srt:force_style='${style}',format=yuv420p[v]`);
const voixEtiquettes = seqs.map((s, k) => {
  const ms = Math.round(debuts[s.id] * 1000);
  filtres.push(`[${tous.length + k}:a]aresample=48000,adelay=${ms}|${ms}[a${k}]`);
  return `[a${k}]`;
});
filtres.push(`${voixEtiquettes.join('')}amix=inputs=${seqs.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`);
writeFileSync(join(travail, 'filtre.txt'), filtres.join(';\n'));
if (existsSync(sortie)) console.log(`remplacement de ${sortie}`);
ff([...entrees, '-/filter_complex', 'filtre.txt', '-map', '[v]', '-map', '[a]', '-t', total.toFixed(3),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-movflags', '+faststart', sortie]);
console.log(`video ${sortie} : ${total.toFixed(1)} s`);

// Assemblage de la video : un clip par plan (zoom lent vers l'element
// surligne sous la bande de titre, images des cartes), fondus enchaines
// (xfade), voix placee phrase par phrase, sous-titres SRT incrustes, nappe
// synthetique discrete generee par ffmpeg qui s'efface sous la voix
// (sidechaincompress), H.264 + AAC, faststart. Produit aussi une copie 720p.
// Usage : node scripts/video/assembler.ts <travail> <sortie.mp4> [sortie_720p.mp4]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FFMPEG, FPS, FONDU, LARGEUR, HAUTEUR, BANDE, plans } from './commun.ts';

const travail = resolve(process.argv[2] ?? '');
const sortie = resolve(process.argv[3] ?? join(travail, 'SIGTB_presentation.mp4'));
const sortie720 = process.argv[4] ? resolve(process.argv[4]) : null;
const ff = (args: string[]) => execFileSync(FFMPEG, ['-y', '-v', 'error', ...args], { cwd: travail, stdio: 'inherit' });

const tous = plans(travail);
const cibles: Record<string, { cx: number; cy: number }> = JSON.parse(readFileSync(join(travail, 'cibles.json'), 'utf8'));
mkdirSync(join(travail, 'clips'), { recursive: true });

// 1. Clips
const H = HAUTEUR - BANDE;
for (const [rang, p] of tous.entries()) {
  const clip = join(travail, 'clips', `${p.nom}.mp4`);
  const n = Math.round(p.duree * FPS);
  const code = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
  if (p.carte) {
    ff(['-framerate', String(FPS), '-i', join(travail, 'images', p.nom, '%04d.jpg'), '-frames:v', String(n), ...code, clip]);
  } else {
    const c = cibles[p.nom] ?? { cx: 0.55, cy: 0.45 };
    const a = p.surligner ? 0.14 : 0.07;
    // Un plan sur deux s'ouvre en zoom avant, l'autre en leger recul : un mouvement par phrase.
    const z = rang % 2 === 0 ? `1+${a}*on/${n}` : `1+${a}-${a * 0.6}*on/${n}`;
    const x = `clip(${c.cx.toFixed(3)}*iw-iw/zoom/2,0,iw-iw/zoom)`;
    const y = `clip(${c.cy.toFixed(3)}*ih-ih/zoom/2,0,ih-ih/zoom)`;
    ff(['-loop', '1', '-framerate', String(FPS), '-i', join(travail, 'images', `${p.nom}.png`),
      '-loop', '1', '-framerate', String(FPS), '-i', join(travail, 'images', `bande-${p.sequence.id}.png`),
      '-filter_complex', `[0:v]scale=${LARGEUR * 2}:${H * 2}:flags=lanczos,zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${LARGEUR}x${H}:fps=${FPS}[z];[1:v]scale=${LARGEUR}:${BANDE},fps=${FPS}[b];[b][z]vstack=inputs=2[v]`,
      '-map', '[v]', '-frames:v', String(n), ...code, clip]);
  }
  console.log(`clip ${p.nom} ${p.duree} s`);
}
const dernier = tous[tous.length - 1];
const total = dernier.debut + dernier.duree;

// 2. Sous-titres : une phrase par sous-titre (coupee en deux si longue)
const horodatage = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000), m = Math.floor(ms / 60_000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const couper = (ph: string) => {
  if (ph.length <= 95) return [ph];
  const milieu = Math.floor(ph.length / 2);
  const candidats = [', ', ' : '].map((s) => ph.lastIndexOf(s, milieu + 25)).filter((i) => i > 25);
  const i = Math.max(-1, ...candidats);
  return i > 0 ? [ph.slice(0, i + 1).trim(), ph.slice(i + 1).replace(/^[:\s]+/, '').trim()] : [ph];
};
const deuxLignes = (ph: string) => {
  if (ph.length <= 50) return ph;
  const m = Math.floor(ph.length / 2);
  const g = ph.lastIndexOf(' ', m), d = ph.indexOf(' ', m);
  const i = d < 0 || (g >= 0 && m - g <= d - m) ? g : d;
  return `${ph.slice(0, i)}\n${ph.slice(i + 1)}`;
};
const srt: string[] = [];
let num = 1;
for (const p of tous) for (const ph of p.phrases) {
  const morceaux = couper(ph.texte);
  const poids = morceaux.reduce((s, m) => s + m.length, 0);
  let debut = ph.debut + 0.05;
  for (const m of morceaux) {
    const fin = debut + (ph.voix * m.length) / poids;
    srt.push(`${num++}\n${horodatage(debut)} --> ${horodatage(fin + (m === morceaux[morceaux.length - 1] ? 0.2 : -0.03))}\n${deuxLignes(m)}\n`);
    debut = fin;
  }
}
writeFileSync(join(travail, 'sous-titres.srt'), srt.join('\n'), 'utf8');

// 3. Assemblage final
const entrees: string[] = [];
tous.forEach((p) => entrees.push('-i', join(travail, 'clips', `${p.nom}.mp4`)));
const phrases = tous.flatMap((p) => p.phrases);
phrases.forEach((ph) => entrees.push('-i', ph.wav));
const filtres: string[] = [];
let prec = '[0:v]';
tous.forEach((p, i) => {
  if (i === 0) return;
  const transition = p.sequence.id === tous[i - 1].sequence.id ? 'fade' : 'fadeblack';
  filtres.push(`${prec}[${i}:v]xfade=transition=${transition}:duration=${FONDU}:offset=${p.debut.toFixed(3)}[x${i}]`);
  prec = `[x${i}]`;
});
const style = 'FontName=Segoe UI,FontSize=11,PrimaryColour=&H00FFFFFF,OutlineColour=&H70120A06,BorderStyle=3,Outline=5,Shadow=0,MarginV=18';
filtres.push(`${prec}subtitles=sous-titres.srt:force_style='${style}',format=yuv420p[v]`);
const etiquettes = phrases.map((ph, k) => {
  const ms = Math.round(ph.debut * 1000);
  filtres.push(`[${tous.length + k}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms}:all=1[p${k}]`);
  return `[p${k}]`;
});
filtres.push(`${etiquettes.join('')}amix=inputs=${phrases.length}:normalize=0,apad,atrim=0:${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,asplit=2[voix][cle]`);
// Nappe : accord tenu (la, mi, la, do diese), modulations lentes, filtree ; aucune melodie.
const nappe = "0.30*sin(2*PI*110*t)+0.22*sin(2*PI*164.81*t)*(0.7+0.3*sin(2*PI*0.05*t))+0.16*sin(2*PI*220*t)*(0.6+0.4*sin(2*PI*0.08*t))+0.10*sin(2*PI*277.18*t)*(0.5+0.5*sin(2*PI*0.06*t))";
filtres.push(`aevalsrc='${nappe}':s=48000:d=${total.toFixed(3)},lowpass=f=700,afade=t=in:d=3,afade=t=out:st=${(total - 4).toFixed(3)}:d=4,volume=-28dB[nappe]`);
filtres.push('[nappe][cle]sidechaincompress=threshold=0.03:ratio=6:attack=60:release=900[fond]');
filtres.push('[voix][fond]amix=inputs=2:normalize=0,alimiter=limit=0.95,aformat=channel_layouts=stereo[a]');
writeFileSync(join(travail, 'filtre.txt'), filtres.join(';\n'));
ff([...entrees, '-/filter_complex', 'filtre.txt', '-map', '[v]', '-map', '[a]', '-t', total.toFixed(3),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', sortie]);
console.log(`video ${sortie} : ${total.toFixed(1)} s`);

if (sortie720) {
  ff(['-i', sortie, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', sortie720]);
  console.log(`video 720p ${sortie720}`);
}

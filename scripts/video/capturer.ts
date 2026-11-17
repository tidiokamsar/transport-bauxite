// Images de la video : cartes animees (image par image), ecrans reels de
// SIGTB servis en local sur l'API simulee des tests (donnees FICTIVES de
// scripts/captures/jeu-captures.ts et reponses serveur fictives de
// jeu-video.ts) et bandes de titre. Jamais le site de production, aucun mot
// de passe. Usage :
//   node scripts/video/capturer.ts <travail> [url, defaut http://localhost:5288]
// SEULEMENT=<prefixe> limite aux plans dont le nom commence par ce prefixe.
import { chromium, type Browser } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { jeuPour, FICHE } from '../captures/jeu-captures.ts';
import { simulerApiVideo, JEUX_VIDEO } from './jeu-video.ts';
import { ICI, FPS, LARGEUR, BANDE, HAUTEUR, plans, sequences, type Plan } from './commun.ts';

const travail = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:5288';
if (!travail) throw new Error('usage : capturer.ts <dossier de travail> [url]');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('captures limitees a un serveur local');

const JEUX: Record<string, Record<string, unknown[]>> = {
  fiche_a_controler: { fiches_terrain: [FICHE('f1', 'FR-EX-001', 'rotations', 'a_controler', { nb_ecarts: 1 })] },
  ...JEUX_VIDEO,
};

const fichierCibles = join(travail, 'cibles.json');
const cibles: Record<string, { cx: number; cy: number }> = existsSync(fichierCibles) ? JSON.parse(readFileSync(fichierCibles, 'utf8')) : {};
const seulement = process.env.SEULEMENT ?? '';
const images = join(travail, 'images');
mkdirSync(images, { recursive: true });

const carte = async (nav: Browser, p: Plan) => {
  const dossier = join(images, p.nom);
  mkdirSync(dossier, { recursive: true });
  const page = await nav.newPage({ viewport: { width: LARGEUR, height: HAUTEUR } });
  await page.goto(`${pathToFileURL(join(ICI, 'cartes.html')).href}?carte=${p.carte}`);
  await page.waitForTimeout(300);
  const n = Math.round(p.duree * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((s) => (window as unknown as { positionner: (s: number) => void }).positionner(s), i / FPS);
    await page.screenshot({ path: join(dossier, `${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
  }
  await page.close();
  console.log(`carte ${p.nom} (${p.duree} s)`);
};

const bandes = async (nav: Browser) => {
  const page = await nav.newPage({ viewport: { width: LARGEUR, height: BANDE } });
  for (const [i, s] of sequences().entries()) {
    await page.setContent(`<body style="margin:0;height:${BANDE}px;display:flex;align-items:center;gap:22px;padding:0 28px;box-sizing:border-box;
      background:linear-gradient(90deg,#22100b,#361a12 60%,#4a2418);font-family:'Segoe UI',Arial;color:#faf6f2;border-bottom:3px solid #ec6b1b">
      <b style="font-size:24px;letter-spacing:5px">SIGTB</b><span style="width:2px;height:26px;background:#7e3f28"></span>
      <span style="font-size:20px;font-weight:700;color:#fba56b">${String(i + 1).padStart(2, '0')}</span>
      <span style="font-size:24px;font-weight:600">${s.titre}</span>
      <span style="margin-left:auto;font-size:17px;color:#e7c3b3;padding:5px 14px;border:1px solid #7e3f28;border-radius:8px">Données de démonstration</span></body>`);
    await page.screenshot({ path: join(images, `bande-${s.id}.png`) });
  }
  await page.close();
};

const ecran = async (nav: Browser, p: Plan) => {
  // Plan « defiler » : fenetre haute, sans defilement, puis capture d'une
  // fenetre de hauteur normale autour de l'element (pas de blanc sous le menu).
  const hauteur = Math.round((HAUTEUR - BANDE) / 1.2);
  const contexte = await nav.newContext({ viewport: { width: 1600, height: p.defiler ? 2200 : hauteur }, deviceScaleFactor: 1.2, locale: 'fr-FR' });
  const page = await contexte.newPage();
  await simulerApiVideo(page, jeuPour(p.jeu ? JEUX[p.jeu] : {}));
  await page.goto(`${base}/${p.adresse}`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1200);
  if (p.choisir) {
    // Liste qui propose l'option voulue (ex. le releve CBG), choisie par sa valeur.
    const liste = page.locator('select').filter({ has: page.locator('option', { hasText: p.choisir }) }).first();
    const valeur = await liste.locator('option', { hasText: p.choisir }).first().getAttribute('value').catch(() => null);
    if (valeur !== null) await liste.selectOption(valeur); else console.log(`ATTENTION ${p.nom} : option « ${p.choisir} » introuvable`);
    await page.waitForTimeout(1200);
  }
  // Surlignage de l'element commente ; son centre guide le zoom.
  const cible = await page.evaluate(async ({ surligner, defiler, hauteur }) => {
    let centre: { cx: number; cy: number; haut?: number } = { cx: 0.55, cy: 0.45 };
    if (!surligner) return centre;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = w.nextNode())) {
      const el = n.parentElement;
      if (!el || !n.textContent?.toLowerCase().includes(surligner.toLowerCase())) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.top < 0 || r.bottom > innerHeight || r.left < 0) continue;
      const haut = defiler ? Math.max(0, Math.min(r.top - 110, innerHeight - hauteur)) : 0;
      const cadre = document.createElement('div');
      Object.assign(cadre.style, {
        position: 'fixed', left: `${r.left - 10}px`, top: `${r.top - 8}px`, width: `${r.width + 20}px`, height: `${r.height + 16}px`,
        border: '3px solid #ec6b1b', borderRadius: '10px', boxShadow: '0 0 0 6px rgba(236,107,27,.22), 0 0 24px rgba(236,107,27,.45)',
        zIndex: '99998', pointerEvents: 'none',
      });
      document.body.appendChild(cadre);
      centre = { cx: (r.left + r.width / 2) / innerWidth, cy: (r.top - haut + r.height / 2) / (defiler ? hauteur : innerHeight), haut };
      return centre;
    }
    return null;
  }, { surligner: p.surligner ?? '', defiler: !!p.defiler, hauteur });
  if (!cible) console.log(`ATTENTION ${p.nom} : « ${p.surligner} » introuvable`);
  cibles[p.nom] = cible ? { cx: cible.cx, cy: cible.cy } : { cx: 0.55, cy: 0.45 };
  await page.screenshot({ path: join(images, `${p.nom}.png`), clip: p.defiler ? { x: 0, y: cible?.haut ?? 0, width: 1600, height: hauteur } : undefined });
  console.log(`ecran ${p.nom} ${p.adresse}${cible ? '' : ' (sans surlignage)'}`);
  await contexte.close();
};

const nav = await chromium.launch();
const choisis = plans(travail).filter((x) => x.nom.startsWith(seulement));
await bandes(nav);
// Cartes et ecrans en parallele (deux files).
await Promise.all([
  (async () => { for (const p of choisis.filter((x) => x.carte)) await carte(nav, p); })(),
  (async () => { for (const p of choisis.filter((x) => !x.carte)) await ecran(nav, p); })(),
]);
writeFileSync(fichierCibles, JSON.stringify(cibles, null, 2));
await nav.close();

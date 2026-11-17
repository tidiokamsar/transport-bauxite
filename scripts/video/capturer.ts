// Images de la video : cartes animees (image par image) et ecrans reels de
// SIGTB servis en local sur l'API simulee des tests (donnees FICTIVES de
// scripts/captures/jeu-captures.ts). Jamais le site de production, aucun mot
// de passe. Usage :
//   node scripts/video/capturer.ts <travail> [url, defaut http://localhost:5288]
// SEULEMENT=<prefixe> limite aux plans dont le nom commence par ce prefixe.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { simulerApi } from '../../e2e/api-simulee.ts';
import { jeuPour, FICHE } from '../captures/jeu-captures.ts';
import { ICI, FPS, plans, type Plan } from './commun.ts';

const travail = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:5288';
if (!travail) throw new Error('usage : capturer.ts <dossier de travail> [url]');
const hote = new URL(base).hostname;
if (!['localhost', '127.0.0.1'].includes(hote)) throw new Error('captures limitees a un serveur local');

const JEUX: Record<string, Record<string, unknown[]>> = {
  fiche_a_controler: { fiches_terrain: [FICHE('f1', 'FR-EX-001', 'rotations', 'a_controler', { nb_ecarts: 1 })] },
};

const navigateur = await chromium.launch();
const fichierCibles = join(travail, 'cibles.json');
const cibles: Record<string, { cx: number; cy: number }> = existsSync(fichierCibles) ? JSON.parse(readFileSync(fichierCibles, 'utf8')) : {};
const seulement = process.env.SEULEMENT ?? '';

const carte = async (p: Plan) => {
  const dossier = join(travail, 'images', p.nom);
  mkdirSync(dossier, { recursive: true });
  const page = await navigateur.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${pathToFileURL(join(ICI, 'cartes.html')).href}?carte=${p.carte}`);
  await page.waitForTimeout(300);
  const n = Math.round(p.duree * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((s) => (window as unknown as { positionner: (s: number) => void }).positionner(s), i / FPS);
    await page.screenshot({ path: join(dossier, `${String(i).padStart(4, '0')}.png`) });
  }
  await page.close();
};

const ecran = async (p: Plan) => {
  mkdirSync(join(travail, 'images'), { recursive: true });
  const contexte = await navigateur.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2, locale: 'fr-FR' });
  const page = await contexte.newPage();
  await simulerApi(page, jeuPour(p.jeu ? JEUX[p.jeu] : {}));
  await page.goto(`${base}/${p.adresse}`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1500);
  // Surlignage de l'element commente, puce de section et bandeau de demonstration.
  const cible = await page.evaluate(({ surligner, titre, numero }) => {
    let centre = { cx: 0.55, cy: 0.45 };
    if (surligner) {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = w.nextNode())) {
        const el = n.parentElement;
        if (!el || !n.textContent?.toLowerCase().includes(surligner.toLowerCase())) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.top < 0 || r.bottom > innerHeight) continue;
        const cadre = document.createElement('div');
        Object.assign(cadre.style, {
          position: 'fixed', left: `${r.left - 10}px`, top: `${r.top - 8}px`, width: `${r.width + 20}px`, height: `${r.height + 16}px`,
          border: '3px solid #ec6b1b', borderRadius: '10px', boxShadow: '0 0 0 6px rgba(236,107,27,.22), 0 0 24px rgba(236,107,27,.45)',
          zIndex: '99998', pointerEvents: 'none',
        });
        document.body.appendChild(cadre);
        centre = { cx: (r.left + r.width / 2) / innerWidth, cy: (r.top + r.height / 2) / innerHeight };
        break;
      }
    }
    const puce = document.createElement('div');
    puce.innerHTML = `<div style="font:600 13px 'Segoe UI';letter-spacing:2px;color:#fba56b">${String(numero).padStart(2, '0')}</div>`
      + `<div style="font:700 22px 'Segoe UI';color:#faf6f2">${titre}</div>`
      + `<div style="font:500 11px 'Segoe UI';color:#e7c3b3;margin-top:4px;letter-spacing:.5px">Données de démonstration</div>`;
    Object.assign(puce.style, {
      position: 'fixed', right: '18px', top: '64px', padding: '10px 16px', borderRadius: '12px', background: 'rgba(34,16,11,.88)',
      borderLeft: '4px solid #ec6b1b', zIndex: '99999', boxShadow: '0 6px 22px rgba(0,0,0,.25)',
    });
    document.body.appendChild(puce);
    return centre;
  }, { surligner: p.surligner ?? '', titre: p.sequence.titre, numero: p.numero });
  cibles[p.nom] = cible;
  await page.screenshot({ path: join(travail, 'images', `${p.nom}.png`) });
  const texte = (await page.locator('body').innerText()).slice(0, 160).replace(/\s+/g, ' ');
  console.log(`ecran ${p.nom} ${p.adresse} -> ${texte}`);
  await contexte.close();
};

for (const p of plans(travail).filter((x) => x.nom.startsWith(seulement))) {
  if (p.carte) { await carte(p); console.log(`carte ${p.nom} (${p.duree} s)`); } else await ecran(p);
}
writeFileSync(fichierCibles, JSON.stringify(cibles, null, 2));
await navigateur.close();

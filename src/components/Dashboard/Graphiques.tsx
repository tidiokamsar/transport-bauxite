// Graphiques du tableau de bord en SVG (aucune bibliotheque ajoutee).
import { formatNombre } from './indicateurs';

/** Anneau de progression ; `pourcentage` null = objectif non defini. */
export const Anneau = ({ pourcentage, legende }: { pourcentage: number | null; legende: string }) => {
  const r = 30;
  const c = 2 * Math.PI * r;
  const p = pourcentage === null ? 0 : Math.max(0, Math.min(100, pourcentage));
  return (
    <div className="relative h-20 w-20 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f1e4d8" strokeWidth="8" />
        {pourcentage !== null && (
          <circle
            cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
            stroke="url(#anneau-degrade)" strokeDasharray={`${(p / 100) * c} ${c}`}
          />
        )}
        <defs>
          <linearGradient id="anneau-degrade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#16a34a" />
            <stop offset="1" stopColor="#ec6b1b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-base font-black text-stone-900">{pourcentage === null ? '—' : `${Math.round(p)} %`}</span>
        <span className="mt-1 text-[10px] text-stone-500">{legende}</span>
      </div>
    </div>
  );
};

/** Barres de tonnes par heure, avec ligne d'objectif si un plan existe. */
export const BarresProduction = ({
  serie,
  objectifParHeure,
}: {
  serie: { heure: number; tonnes: number }[];
  objectifParHeure: number | null;
}) => {
  const L = 640;
  const H = 260;
  const marge = { g: 46, d: 10, h: 12, b: 28 };
  const largeur = L - marge.g - marge.d;
  const hauteur = H - marge.h - marge.b;
  const max = Math.max(1, objectifParHeure ?? 0, ...serie.map((p) => p.tonnes));
  const pas = Math.pow(10, Math.floor(Math.log10(max)));
  const plafond = Math.ceil(max / pas) * pas;
  const graduations = Array.from({ length: 5 }, (_, i) => (plafond / 4) * i);
  const colonne = largeur / serie.length;
  const y = (v: number) => marge.h + hauteur - (v / plafond) * hauteur;

  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="h-full w-full" role="img" aria-label="Tonnes livrées par heure">
      <defs>
        <linearGradient id="barre-degrade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e07a35" />
          <stop offset="1" stopColor="#f6b07a" />
        </linearGradient>
      </defs>
      {graduations.map((g) => (
        <g key={g}>
          <line x1={marge.g} x2={L - marge.d} y1={y(g)} y2={y(g)} stroke="#eee7e0" />
          <text x={marge.g - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="#78716c">
            {formatNombre(g)}
          </text>
        </g>
      ))}
      {serie.map((p, i) => {
        const x = marge.g + i * colonne + colonne * 0.18;
        const w = colonne * 0.64;
        return (
          <g key={p.heure}>
            {p.tonnes > 0 && <rect x={x} y={y(p.tonnes)} width={w} height={y(0) - y(p.tonnes)} rx="3" fill="url(#barre-degrade)" />}
            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#57534e">
              {String(p.heure).padStart(2, '0')}h
            </text>
          </g>
        );
      })}
      {objectifParHeure !== null && (
        <polyline
          fill="none" stroke="#7c2d12" strokeWidth="2" strokeDasharray="6 5"
          points={serie.map((_, i) => `${marge.g + (i + 0.5) * colonne},${y(objectifParHeure * (i + 1))}`).join(' ')}
        />
      )}
    </svg>
  );
};

export interface Segment {
  libelle: string;
  valeur: number;
  couleur: string;
}

/** Donut de repartition avec total au centre. */
export const Donut = ({ segments, total, libelleTotal }: { segments: Segment[]; total: number; libelleTotal: string }) => {
  const r = 58;
  const c = 2 * Math.PI * r;
  let cumul = 0;
  return (
    <div className="relative h-44 w-44 flex-shrink-0">
      <svg viewBox="0 0 160 160" className="h-44 w-44 -rotate-90" aria-hidden="true">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#f1ece7" strokeWidth="26" />
        {total > 0 &&
          segments.map((s) => {
            const longueur = (s.valeur / total) * c;
            const trait = (
              <circle
                key={s.libelle} cx="80" cy="80" r={r} fill="none" stroke={s.couleur} strokeWidth="26"
                strokeDasharray={`${longueur} ${c - longueur}`} strokeDashoffset={-cumul}
              />
            );
            cumul += longueur;
            return trait;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-stone-900">{total}</span>
        <span className="text-sm text-stone-500">{libelleTotal}</span>
      </div>
    </div>
  );
};

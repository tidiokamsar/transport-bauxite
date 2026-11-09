import { useId } from 'react';
import { Chargeuse, Pelle, SemiRemorque, Stock } from './Engins';

// Scene de la charte SIGTB : mine de bauxite a ciel ouvert en gradins,
// chaine montagneuse a l'horizon, piste de roulage et semi-remorques
// charges. Illustration originale, purement decorative (aria-hidden).

const LARGEUR = 1600;
const HAUTEUR = 900;
const CRETE = 470;

// Gradins de la fosse : chaque palier recule vers le centre en descendant.
const GRADINS = Array.from({ length: 6 }, (_, i) => ({
  y: CRETE + i * 46,
  gauche: 90 + i * 82,
  droite: 1270 - i * 98,
}));

export const SceneMine = ({
  className = '',
  premierPlan = true,
  cadrage = 'centre',
}: {
  className?: string;
  /** Piste et camions au premier plan (page de connexion). */
  premierPlan?: boolean;
  /** Bandeau large : 'bas' garde la fosse et la piste visibles. */
  cadrage?: 'centre' | 'bas';
}) => {
  const id = useId().replace(/:/g, '');
  const ciel = `ciel-${id}`;
  const halo = `halo-${id}`;
  const sol = `sol-${id}`;
  const poussiere = `poussiere-${id}`;

  const fond = GRADINS[GRADINS.length - 1];

  return (
    <svg
      viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
      preserveAspectRatio={cadrage === 'bas' ? 'xMidYMax slice' : 'xMidYMid slice'}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={ciel} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1812" />
          <stop offset="0.3" stopColor="#6b331d" />
          <stop offset="0.48" stopColor="#c8703f" />
          <stop offset="0.56" stopColor="#f0b47c" />
        </linearGradient>
        <radialGradient id={halo} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe2b0" stopOpacity="0.9" />
          <stop offset="0.25" stopColor="#ffc37f" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffb070" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={sol} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a2a16" />
          <stop offset="1" stopColor="#2a110a" />
        </linearGradient>
        <radialGradient id={poussiere} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e3a77c" stopOpacity="0.55" />
          <stop offset="1" stopColor="#e3a77c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ciel et soleil bas, chaleur et poussiere */}
      <rect width={LARGEUR} height={HAUTEUR} fill={`url(#${ciel})`} />
      <circle cx="1230" cy="390" r="300" fill={`url(#${halo})`} />
      <circle cx="1230" cy="390" r="58" fill="#ffdcaa" opacity="0.95" />

      {/* Chaines a l'horizon */}
      <g transform="translate(0 -84)">
      <path
        d="M0 470 L90 430 L170 452 L260 400 L330 428 L420 372 L500 410 L590 360 L660 396 L760 352 L840 392 L930 366 L1010 404 L1100 380 L1190 418 L1290 386 L1380 420 L1470 392 L1600 430 L1600 560 L0 560 Z"
        fill="#5a3a2c"
        opacity="0.55"
      />
      <path
        d="M0 512 L120 478 L220 500 L330 462 L440 494 L560 456 L660 488 L790 458 L900 492 L1020 466 L1140 498 L1260 470 L1380 500 L1500 476 L1600 496 L1600 560 L0 560 Z"
        fill="#3b2a22"
        opacity="0.85"
      />
      </g>

      {/* Plateau de cuirasse bauxitique */}
      <rect y={CRETE - 8} width={LARGEUR} height={HAUTEUR - CRETE + 8} fill="#6e2f1b" />
      <path d={`M0 ${CRETE - 8} L${LARGEUR} ${CRETE - 8} L${LARGEUR} ${CRETE} L0 ${CRETE} Z`} fill="#d07a4b" opacity="0.6" />

      {/* Fosse en gradins : front de taille sombre, banquette claire */}
      {GRADINS.slice(0, -1).map((g, i) => {
        const s = GRADINS[i + 1];
        const pied = g.y + 26;
        return (
          <g key={g.y}>
            <path
              d={`M${g.gauche} ${g.y} L${g.droite} ${g.y} L${s.droite + 10} ${pied} L${s.gauche - 10} ${pied} Z`}
              fill={i % 2 === 0 ? '#6e2a15' : '#7d3119'}
            />
            <path
              d={`M${s.gauche - 10} ${pied} L${s.droite + 10} ${pied} L${s.droite} ${s.y} L${s.gauche} ${s.y} Z`}
              fill={i % 2 === 0 ? '#c46431' : '#b5582b'}
            />
            <line x1={s.gauche - 10} y1={pied} x2={s.droite + 10} y2={pied} stroke="#eaa478" strokeWidth="3" opacity="0.8" />
          </g>
        );
      })}
      {/* Fond de fosse et bassin d'exhaure */}
      <path d={`M${fond.gauche} ${fond.y} L${fond.droite} ${fond.y} L${fond.droite - 30} ${fond.y + 40} L${fond.gauche + 30} ${fond.y + 40} Z`} fill="#94431f" />
      <ellipse cx={(fond.gauche + fond.droite) / 2 + 120} cy={fond.y + 20} rx="70" ry="9" fill="#55706a" opacity="0.85" />

      {/* Piste de roulage en lacets dans la fosse */}
      <path
        d={`M1240 ${CRETE} L${GRADINS[1].droite + 6} ${GRADINS[1].y + 4} L${GRADINS[2].gauche + 40} ${GRADINS[2].y + 4} L${GRADINS[3].droite} ${GRADINS[3].y + 4} L${GRADINS[4].gauche + 60} ${GRADINS[4].y + 4} L${fond.gauche + 140} ${fond.y + 6}`}
        fill="none"
        stroke="#d6966a"
        strokeWidth="9"
        strokeLinejoin="round"
        opacity="0.75"
      />

      {/* Chantier au fond : pelle, chargeuse, stock, petits camions */}
      <Stock x={fond.gauche + 200} y={fond.y + 30} largeur={120} />
      <Pelle x={fond.gauche + 340} y={fond.y - 52} echelle={0.62} />
      <Chargeuse x={fond.gauche + 70} y={fond.y - 44} echelle={0.5} miroir />
      <SemiRemorque x={GRADINS[2].gauche + 120} y={GRADINS[2].y - 24} echelle={0.26} />
      <SemiRemorque x={GRADINS[3].droite - 40} y={GRADINS[3].y - 24} echelle={0.26} miroir />
      <SemiRemorque x={1180} y={CRETE - 26} echelle={0.3} />

      {premierPlan && (
        <g>
          {/* Piste principale au premier plan */}
          <path d={`M0 790 L${LARGEUR} 770 L${LARGEUR} ${HAUTEUR} L0 ${HAUTEUR} Z`} fill={`url(#${sol})`} />
          <path d={`M0 818 Q800 786 ${LARGEUR} 800 L${LARGEUR} 870 Q800 846 0 892 Z`} fill="#9a5434" opacity="0.9" />
          <path d={`M0 858 Q800 818 ${LARGEUR} 836`} stroke="#d9a07a" strokeWidth="3" strokeDasharray="34 26" fill="none" opacity="0.5" />
          {/* Convoi de semi-remorques charges et poussiere */}
          <ellipse cx="540" cy="820" rx="260" ry="50" fill={`url(#${poussiere})`} />
          <ellipse cx="1010" cy="806" rx="300" ry="60" fill={`url(#${poussiere})`} />
          <SemiRemorque x={230} y={752} echelle={0.86} />
          <SemiRemorque x={740} y={716} echelle={1.08} />
          <SemiRemorque x={1330} y={758} echelle={0.62} miroir opacite={0.9} />
        </g>
      )}
    </svg>
  );
};

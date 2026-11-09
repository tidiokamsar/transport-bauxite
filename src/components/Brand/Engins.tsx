// Engins de la charte SIGTB, dessines en SVG (illustrations originales).
// Coordonnees locales ; chaque engin est place par `transform`.
// Parc de reference (D-011) : semi-remorques bennes, chargeuses, pelle.

type PropsEngin = { x: number; y: number; echelle?: number; miroir?: boolean; opacite?: number };

const placer = ({ x, y, echelle = 1, miroir = false }: PropsEngin) =>
  `translate(${x} ${y}) scale(${miroir ? -echelle : echelle} ${echelle})`;

const CABINE = '#e0a53a';
const CABINE_OMBRE = '#b9821f';
const ACIER = '#8d8a84';
const ACIER_OMBRE = '#5f5c57';
const PNEU = '#1d1916';
const BAUXITE = '#a8431f';
const BAUXITE_CLAIR = '#c9643a';
const BAUXITE_SOMBRE = '#7d2f15';

const Roue = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={PNEU} />
    <circle cx={cx} cy={cy} r={r * 0.42} fill="#6d655e" />
    <circle cx={cx} cy={cy} r={r * 0.15} fill="#2b2420" />
  </g>
);

/** Semi-remorque benne chargee de bauxite, roulant vers la droite (environ 300 x 110). */
export const SemiRemorque = (props: PropsEngin) => (
  <g transform={placer(props)} opacity={props.opacite ?? 1}>
    <ellipse cx="150" cy="104" rx="150" ry="7" fill="#000" opacity="0.25" />
    {/* Benne */}
    <path d="M8 34 L192 34 L184 80 L18 80 Z" fill={ACIER} />
    <path d="M8 34 L192 34 L190 44 L10 44 Z" fill="#a9a6a0" />
    {[40, 72, 104, 136, 168].map((x) => (
      <line key={x} x1={x} y1="44" x2={x - 2} y2="80" stroke={ACIER_OMBRE} strokeWidth="2" />
    ))}
    {/* Chargement de bauxite */}
    <path d="M10 35 Q38 6 70 14 Q100 -4 128 10 Q160 2 190 35 Z" fill={BAUXITE} />
    <path d="M34 24 Q64 8 96 14 Q118 6 140 16 Q118 18 96 22 Q64 20 34 24 Z" fill={BAUXITE_CLAIR} />
    {[[30, 30], [52, 22], [84, 18], [112, 15], [150, 22], [170, 28], [64, 28], [126, 26]].map(([cx, cy]) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" fill={BAUXITE_SOMBRE} />
    ))}
    {/* Chassis */}
    <rect x="10" y="80" width="272" height="7" rx="2" fill="#2b2420" />
    {/* Tracteur */}
    <path d="M204 44 L262 44 Q270 44 274 52 L284 66 L284 86 L204 86 Z" fill={CABINE} />
    <path d="M214 16 L258 16 Q266 16 268 24 L272 48 L214 48 Z" fill={CABINE} />
    <path d="M232 22 L258 22 Q262 22 263 26 L266 42 L232 42 Z" fill="#9fc3d1" opacity="0.85" />
    <rect x="216" y="22" width="12" height="20" rx="1" fill={CABINE_OMBRE} />
    <rect x="272" y="70" width="14" height="6" fill="#f3e6c8" />
    <rect x="200" y="4" width="5" height="44" rx="2" fill="#4a423c" />
    <rect x="204" y="64" width="80" height="4" fill={CABINE_OMBRE} />
    {/* Roues */}
    <Roue cx={36} cy={90} r={13} />
    <Roue cx={66} cy={90} r={13} />
    <Roue cx={96} cy={90} r={13} />
    <Roue cx={222} cy={90} r={13} />
    <Roue cx={266} cy={90} r={13} />
  </g>
);

/** Pelle hydraulique en chargement, godet vers la gauche (environ 220 x 120). */
export const Pelle = (props: PropsEngin) => (
  <g transform={placer(props)} opacity={props.opacite ?? 1}>
    <ellipse cx="110" cy="118" rx="80" ry="5" fill="#000" opacity="0.25" />
    <rect x="56" y="92" width="126" height="24" rx="12" fill={PNEU} />
    {[72, 96, 120, 144, 166].map((cx) => (
      <circle key={cx} cx={cx} cy="104" r="6" fill="#4a423c" />
    ))}
    <rect x="70" y="80" width="100" height="14" fill="#3a332e" />
    <path d="M66 52 L178 52 L184 82 L66 82 Z" fill={CABINE} />
    <path d="M150 52 L184 52 L186 82 L150 82 Z" fill={CABINE_OMBRE} />
    <path d="M70 30 L104 30 L108 52 L70 52 Z" fill={CABINE} />
    <path d="M76 34 L100 34 L103 50 L76 50 Z" fill="#9fc3d1" opacity="0.85" />
    {/* Fleche, bras, godet */}
    <path d="M88 58 L40 8 L28 16 L74 66 Z" fill={CABINE} />
    <path d="M40 8 L14 62 L2 58 L28 14 Z" fill={CABINE_OMBRE} />
    <path d="M18 54 L-22 54 L-26 74 Q-8 92 16 80 Z" fill="#4a423c" />
    <path d="M-20 56 Q-4 46 14 56 L-20 60 Z" fill={BAUXITE} />
    <line x1="58" y1="40" x2="30" y2="34" stroke="#3a332e" strokeWidth="4" />
  </g>
);

/** Chargeuse sur pneus, godet leve vers la gauche (environ 200 x 120). */
export const Chargeuse = (props: PropsEngin) => (
  <g transform={placer(props)} opacity={props.opacite ?? 1}>
    <ellipse cx="100" cy="118" rx="90" ry="5" fill="#000" opacity="0.25" />
    <path d="M40 60 L170 60 L176 96 L36 96 Z" fill={CABINE} />
    <path d="M120 60 L176 60 L178 96 L120 96 Z" fill={CABINE_OMBRE} />
    <path d="M96 22 L140 22 L144 60 L94 60 Z" fill={CABINE} />
    <path d="M102 28 L136 28 L139 56 L101 56 Z" fill="#9fc3d1" opacity="0.85" />
    <rect x="150" y="40" width="6" height="22" rx="2" fill="#4a423c" />
    {/* Bras et godet */}
    <path d="M70 66 L14 30 L6 40 L62 78 Z" fill={CABINE_OMBRE} />
    <path d="M14 16 L-34 16 L-40 46 Q-18 60 14 46 Z" fill="#4a423c" />
    <path d="M-30 18 Q-10 2 12 18 Z" fill={BAUXITE} />
    {[[-18, 12], [-4, 10], [-24, 16]].map(([cx, cy]) => (
      <circle key={`${cx}`} cx={cx} cy={cy} r="2.2" fill={BAUXITE_SOMBRE} />
    ))}
    <Roue cx={58} cy={98} r={22} />
    <Roue cx={148} cy={98} r={22} />
  </g>
);

/** Tas de bauxite (stock), base sur y = 0, largeur `largeur`. */
export const Stock = ({ x, y, largeur }: { x: number; y: number; largeur: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d={`M0 0 Q${largeur * 0.28} ${-largeur * 0.42} ${largeur / 2} ${-largeur * 0.46} Q${largeur * 0.72} ${-largeur * 0.42} ${largeur} 0 Z`} fill={BAUXITE} />
    <path d={`M${largeur * 0.18} ${-largeur * 0.12} Q${largeur * 0.38} ${-largeur * 0.4} ${largeur / 2} ${-largeur * 0.43} Q${largeur * 0.42} ${-largeur * 0.3} ${largeur * 0.3} ${-largeur * 0.08} Z`} fill={BAUXITE_CLAIR} />
  </g>
);

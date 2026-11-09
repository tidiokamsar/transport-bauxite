// Identite SIGTB : embleme (benne chargee sur gradins) et nom du produit.
// Aucun nom de client ou d'exploitant (decision D-018).

export const NOM_PRODUIT = 'SIGTB';
export const SOUS_TITRE_PRODUIT = 'Transport de bauxite';
export const DESCRIPTION_PRODUIT = 'Système intégré de gestion du transport de bauxite';

export const Embleme = ({ className = 'w-10 h-10' }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="embleme-fond" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#c95a32" />
        <stop offset="1" stopColor="#732e1e" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#embleme-fond)" />
    {/* Gradins */}
    <path d="M6 50 L58 50 L58 54 L6 54 Z" fill="#33130c" opacity="0.45" />
    <path d="M12 46 L52 46 L52 50 L12 50 Z" fill="#33130c" opacity="0.3" />
    {/* Chargement */}
    <path d="M12 27 Q20 14 30 18 Q38 10 46 27 Z" fill="#f4c9b4" />
    {/* Benne et tracteur */}
    <path d="M10 27 L47 27 L45 38 L13 38 Z" fill="#fdf5f1" />
    <path d="M48 31 L55 31 L58 36 L58 41 L48 41 Z" fill="#fdf5f1" />
    <rect x="10" y="38" width="48" height="3" fill="#fdf5f1" />
    <circle cx="18" cy="43" r="4" fill="#33130c" stroke="#fdf5f1" strokeWidth="2" />
    <circle cx="30" cy="43" r="4" fill="#33130c" stroke="#fdf5f1" strokeWidth="2" />
    <circle cx="51" cy="43" r="4" fill="#33130c" stroke="#fdf5f1" strokeWidth="2" />
  </svg>
);

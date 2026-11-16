import type { ReactNode } from 'react';
import { allerA } from './navigation';

// Liens d'etat vide vers l'ecran de parametrage manquant (D-078).

export const LienVue = ({ vue, children }: { vue: string; children: ReactNode }) => (
  <button type="button" onClick={() => allerA(vue)} className="font-semibold underline underline-offset-2 hover:text-stone-900">
    {children}
  </button>
);

/** Message d'etat vide : aucun shift actif parametre. */
export const AucunShift = ({ contexte }: { contexte: string }) => (
  <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
    Aucun shift actif : {contexte}. Créez les shifts dans <LienVue vue="shifts">Exploitation → Shifts</LienVue>.
  </p>
);

/** Message d'etat vide : aucun site enregistre. */
export const AucunSite = ({ contexte }: { contexte: string }) => (
  <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
    Aucun site enregistré : {contexte}. Créez d'abord le site d'exploitation dans <LienVue vue="sites">Exploitation → Sites</LienVue>.
  </p>
);

import type { ReactNode } from 'react';
import { allerA } from './navigation';

// Lien d'etat vide vers l'ecran de parametrage manquant (D-078).

export const LienVue = ({ vue, children }: { vue: string; children: ReactNode }) => (
  <button type="button" onClick={() => allerA(vue)} className="font-semibold underline underline-offset-2 hover:text-stone-900">
    {children}
  </button>
);

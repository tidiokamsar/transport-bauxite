import { useCallback, useState } from 'react';
import { routeListe } from './routeur';

// Regles et etats partages par les pages standard (D-090) : fil d'Ariane,
// saisie d'un formulaire, motif d'une action.

export interface ElementAriane { libelle: string; vers?: string }

/** Fil d'Ariane d'une page du module : Accueil > module > (reference) > page. */
export const arianeModule = (vue: string, module: string, ...suite: ElementAriane[]): ElementAriane[] =>
  [{ libelle: 'Accueil', vers: '#/dashboard' }, { libelle: module, vers: routeListe(vue) }, ...suite];

export const QUITTER_SANS_ENREGISTRER = 'Abandonner les modifications non enregistrées ?';

/** Etat d'une saisie : valeurs, modification d'un champ et indicateur « modifie ». */
export const useSaisie = <V extends Record<string, unknown>>(initiales: V) => {
  const [origine, setOrigine] = useState(initiales);
  const [valeurs, setValeurs] = useState(initiales);
  const poser = useCallback(<K extends keyof V>(cle: K, valeur: V[K]) => setValeurs((v) => ({ ...v, [cle]: valeur })), []);
  /** Recharge la saisie (objet lu apres coup) sans la marquer modifiee. */
  const initialiser = useCallback((v: V) => { setOrigine(v); setValeurs(v); }, []);
  const modifie = JSON.stringify(valeurs) !== JSON.stringify(origine);
  return { valeurs, poser, modifie, initialiser };
};

export type ExigenceMotif = 'obligatoire' | 'facultatif' | 'aucun';

/** Motif valide selon l'exigence (espaces ignores). */
export const motifValide = (motif: string, exigence: ExigenceMotif, minimum = 3) =>
  exigence !== 'obligatoire' || motif.trim().length >= minimum;

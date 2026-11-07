import { describe, expect, it } from 'vitest';
import { translations } from './translations';

/** Liste les chemins des feuilles (ex. « common.save ») d'un arbre de traductions. */
const cheminsFeuilles = (arbre: Record<string, unknown>, prefixe = ''): string[] =>
  Object.entries(arbre).flatMap(([cle, valeur]) => {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    return valeur !== null && typeof valeur === 'object'
      ? cheminsFeuilles(valeur as Record<string, unknown>, chemin)
      : [chemin];
  });

const valeurA = (arbre: Record<string, unknown>, chemin: string): unknown =>
  chemin.split('.').reduce<unknown>((noeud, cle) => (noeud as Record<string, unknown>)[cle], arbre);

describe('translations', () => {
  const fr = cheminsFeuilles(translations.fr);
  const en = cheminsFeuilles(translations.en);

  it('aucune cle francaise ne manque en anglais', () => {
    expect(fr.filter(c => !en.includes(c))).toEqual([]);
  });

  it('aucune cle anglaise ne manque en francais', () => {
    expect(en.filter(c => !fr.includes(c))).toEqual([]);
  });

  it('aucune traduction vide', () => {
    const vides = [
      ...fr.filter(c => valeurA(translations.fr, c) === '').map(c => `fr.${c}`),
      ...en.filter(c => valeurA(translations.en, c) === '').map(c => `en.${c}`),
    ];
    expect(vides).toEqual([]);
  });
});

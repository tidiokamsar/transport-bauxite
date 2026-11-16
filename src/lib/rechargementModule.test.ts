import { describe, expect, it, vi } from 'vitest';
import { rechargerApresEchecModule } from './rechargementModule';

function stockage(initial: Record<string, string> = {}) {
  const donnees = { ...initial };
  return {
    getItem: (cle: string) => (cle in donnees ? donnees[cle] : null),
    setItem: (cle: string, valeur: string) => { donnees[cle] = valeur; },
  };
}

describe('rechargerApresEchecModule', () => {
  it('recharge une fois apres un premier echec', () => {
    const recharger = vi.fn();
    expect(rechargerApresEchecModule(stockage(), 1_000_000, recharger)).toBe(true);
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('ne recharge pas une seconde fois dans la minute (pas de boucle)', () => {
    const s = stockage();
    const recharger = vi.fn();
    rechargerApresEchecModule(s, 1_000_000, recharger);
    expect(rechargerApresEchecModule(s, 1_030_000, recharger)).toBe(false);
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('recharge de nouveau apres le delai', () => {
    const s = stockage();
    const recharger = vi.fn();
    rechargerApresEchecModule(s, 1_000_000, recharger);
    expect(rechargerApresEchecModule(s, 1_070_000, recharger)).toBe(true);
    expect(recharger).toHaveBeenCalledTimes(2);
  });

  it('ne recharge pas si le stockage est inaccessible', () => {
    const recharger = vi.fn();
    const inaccessible = { getItem: () => { throw new Error('bloque'); }, setItem: () => undefined };
    expect(rechargerApresEchecModule(inaccessible, 1_000_000, recharger)).toBe(false);
    expect(recharger).not.toHaveBeenCalled();
  });
});

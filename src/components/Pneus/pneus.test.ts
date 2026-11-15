import { describe, expect, it } from 'vitest';
import { actionsPossibles, normaliserPosition, texteCoutKm, texteKm } from './pneus';

describe('pneus (D-052)', () => {
  it('normalise la position comme le serveur', () => {
    expect(normaliserPosition('  av   g ')).toBe('AV G');
  });

  it('propose les operations permises par l etat', () => {
    expect(actionsPossibles('stored')).toContain('monter');
    expect(actionsPossibles('active')).toEqual(['demonter', 'permuter', 'inspecter']);
    expect(actionsPossibles('damaged')).not.toContain('monter');
    expect(actionsPossibles('retired')).toEqual([]);
  });

  it('n affiche pas de km ni de cout sans mesure', () => {
    expect(texteKm(null, true, 1)).toBe('Sans données');
    expect(texteKm(null, false, 0)).toBe('Jamais monté');
    expect(texteKm(40000, true, 2)).toContain('incomplet');
    expect(texteCoutKm(null)).toBe('Sans données');
  });
});

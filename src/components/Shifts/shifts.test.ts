import { describe, expect, it } from 'vitest';
import { dureeMinutes, erreurSaisieShift, estDeNuit, seChevauchent, type Shift } from './shifts';

const shift = (p: Partial<Shift>): Shift => ({
  id: 'x', name: 'x', display_name: 'X', start_time: '06:00:00', end_time: '18:00:00', shift_order: 1, is_active: true, ...p,
});

describe('shifts (D-078)', () => {
  it('shift de nuit : chevauchement gere de part et d\'autre de minuit', () => {
    expect(estDeNuit('18:00', '06:00')).toBe(true);
    expect(dureeMinutes('18:00', '06:00')).toBe(720);
    expect(seChevauchent({ start_time: '06:00', end_time: '18:00' }, { start_time: '18:00', end_time: '06:00' })).toBe(false);
    expect(seChevauchent({ start_time: '22:00', end_time: '06:00' }, { start_time: '05:00', end_time: '13:00' })).toBe(true);
  });

  it('saisie : libelle unique et chevauchement avec un shift actif', () => {
    const jour = shift({ display_name: 'Jour' });
    const base = { nom: 'nuit', libelle: 'Nuit', debut: '18:00', fin: '06:00', ordre: '2', actif: true };
    expect(erreurSaisieShift(base, [jour])).toBeNull();
    expect(erreurSaisieShift({ ...base, libelle: 'jour' }, [jour])).toMatch(/Libellé/);
    expect(erreurSaisieShift({ ...base, debut: '17:00' }, [jour])).toMatch(/Chevauchement/);
    expect(erreurSaisieShift({ ...base, debut: '17:00' }, [{ ...jour, is_active: false }])).toBeNull();
    expect(erreurSaisieShift({ ...base, fin: '18:00' }, [])).toMatch(/égale/);
    expect(erreurSaisieShift({ ...base, ordre: '1.5' }, [])).toMatch(/Ordre/);
  });
});

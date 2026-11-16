// Shifts (D-078) : controles miroirs de definir_shift ; le serveur reste
// seul juge (libelle unique, chevauchement, droits).

export interface Shift {
  id: string;
  name: string;
  display_name: string;
  start_time: string;
  end_time: string;
  shift_order: number;
  is_active: boolean | null;
}

const minutes = (h: string): number | null => {
  const m = /^(\d{2}):(\d{2})/.exec(h);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh < 24 && mm < 60 ? hh * 60 + mm : null;
};

/** Plage d'un shift sur 24 h : un shift de nuit couvre deux segments. */
export const segments = (debut: string, fin: string): [number, number][] => {
  const d = minutes(debut);
  const f = minutes(fin);
  if (d === null || f === null || d === f) return [];
  return d < f ? [[d, f]] : [[d, 1440], [0, f]];
};

export const estDeNuit = (debut: string, fin: string) => {
  const d = minutes(debut);
  const f = minutes(fin);
  return d !== null && f !== null && f < d;
};

export const seChevauchent = (a: { start_time: string; end_time: string }, b: { start_time: string; end_time: string }) =>
  segments(a.start_time, a.end_time).some(([d1, f1]) => segments(b.start_time, b.end_time).some(([d2, f2]) => d1 < f2 && d2 < f1));

export const dureeMinutes = (debut: string, fin: string): number | null => {
  const s = segments(debut, fin);
  return s.length === 0 ? null : s.reduce((t, [d, f]) => t + f - d, 0);
};

export interface SaisieShift { nom: string; libelle: string; debut: string; fin: string; ordre: string; actif: boolean }

/** Premiere erreur bloquante de la saisie, ou null. */
export const erreurSaisieShift = (s: SaisieShift, autres: Shift[]): string | null => {
  if (!s.nom.trim() || !s.libelle.trim()) return 'Nom et libellé requis';
  if (minutes(s.debut) === null || minutes(s.fin) === null) return 'Heures de début et de fin requises (HH:MM)';
  if (s.debut.slice(0, 5) === s.fin.slice(0, 5)) return 'Heure de fin égale à l\'heure de début';
  if (!/^\d+$/.test(s.ordre.trim()) || Number(s.ordre) < 1) return 'Ordre d\'affichage : entier positif';
  if (autres.some((a) => a.display_name.trim().toLowerCase() === s.libelle.trim().toLowerCase())) return 'Libellé déjà utilisé par un autre shift';
  if (s.actif) {
    const c = autres.find((a) => a.is_active && seChevauchent(a, { start_time: s.debut, end_time: s.fin }));
    if (c) return `Chevauchement avec le shift actif ${c.display_name}`;
  }
  return null;
};

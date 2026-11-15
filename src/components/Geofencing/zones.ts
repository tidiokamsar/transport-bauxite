// Saisie d'une zone de georeperage (D-061) : aucune position par defaut.

/** Polygone saisi « latitude, longitude » par ligne : au moins 3 sommets valides, sinon null. */
export const lirePolygone = (texte: string): [number, number][] | null => {
  const points = texte.split(/\n|;/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[,\s]+/).map(Number));
  if (points.length < 3 || points.some((p) => p.length !== 2 || p.some((x) => !Number.isFinite(x)) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180)) return null;
  return points as [number, number][];
};

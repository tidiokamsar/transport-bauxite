// Regles de saisie du referentiel des sites (D-079), partagees par le
// formulaire et ses tests ; le serveur applique les memes contraintes.

export const enTexte = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

export const enNombre = (v: string): number | null =>
  (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));

/** Coordonnees facultatives : les deux ou aucune, en degres decimaux bornes. */
export const verifierCoordonnees = (latitude: string, longitude: string): string => {
  const lat = enNombre(latitude);
  const lon = enNombre(longitude);
  if (lat === null && lon === null) return '';
  if (lat === null || lon === null) return 'Saisir la latitude et la longitude ensemble, ou aucune des deux.';
  if (Number.isNaN(lat) || lat < -90 || lat > 90) return 'Latitude entre -90 et 90 (degrés décimaux).';
  if (Number.isNaN(lon) || lon < -180 || lon > 180) return 'Longitude entre -180 et 180 (degrés décimaux).';
  return '';
};

/** Capacite en tonnes : vide (inconnue) ou strictement positive. */
export const verifierCapacite = (capacite: string): string => {
  const c = enNombre(capacite);
  if (c === null) return '';
  return Number.isNaN(c) || c <= 0 ? 'Capacité en tonnes, strictement positive (laisser vide si inconnue).' : '';
};

/** Recherche tolerante aux champs vides (ville ou adresse absente). */
export const siteCorrespond = (
  site: { name?: string | null; city?: string | null; address?: string | null },
  recherche: string,
): boolean => {
  const r = recherche.trim().toLowerCase();
  if (!r) return true;
  return [site.name, site.city, site.address].some((v) => (v ?? '').toLowerCase().includes(r));
};

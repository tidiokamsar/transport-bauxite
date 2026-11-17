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

/**
 * Colonne heritee `location` : renseignee depuis l'adresse a la creation, et
 * en modification seulement si l'adresse a change ; sinon elle n'est pas
 * envoyee et la valeur existante est gardee.
 */
export const locationAEnvoyer = (
  adresseOrigine: string | null | undefined,
  adresseSaisie: string,
  creation: boolean,
): { location?: string } => {
  const saisie = adresseSaisie.trim();
  if (creation || saisie !== (adresseOrigine ?? '').trim()) return { location: saisie };
  return {};
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

/** Identifiant de l'ecran dans le menu et dans l'adresse (#/sites/..., D-090). */
export const VUE_SITES = 'sites';

/** Colonnes du referentiel des sites lues et saisies (D-079). */
export interface SiteSaisi {
  id: string;
  name: string;
  type: string;
  organisation_id?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  capacity?: number | null;
  is_active?: boolean | null;
  responsable_id?: string | null;
  notes?: string | null;
}

/** Colonnes lues (le stock herite de Bolt n'est ni lu ni affiche, D-079). */
export const COLONNES_SITE = 'id, name, type, organisation_id, address, city, country, latitude, longitude, contact_name, contact_phone, contact_email, capacity, is_active, responsable_id, notes';

/** Types proposes a la saisie, puis types herites encore presents en base. */
export const TYPES_SITE_SAISIS: Record<string, string> = {
  mine: 'Mine', port: 'Port', depot: 'Dépôt / Entrepôt', workshop: 'Atelier de maintenance', base: 'Base opérationnelle',
};
const TYPES_SITE_HERITES: Record<string, string> = {
  headquarters: 'Siège social', warehouse: 'Entrepôt', office: 'Bureau', maintenance_center: 'Centre de maintenance',
  fuel_station: 'Station carburant', parking: 'Parking', other: 'Autre',
};
export const libelleTypeSite = (type: string) => TYPES_SITE_SAISIS[type] ?? TYPES_SITE_HERITES[type] ?? type;

export interface SaisieSite {
  [cle: string]: string;
  name: string; type: string; organisation_id: string; address: string; city: string; country: string;
  latitude: string; longitude: string; contact_name: string; contact_phone: string; contact_email: string;
  capacity: string; responsable_id: string; notes: string;
}

/** Saisie initiale : tous les champs repris de la ligne, rien n'est remis a vide (D-079). */
export const saisieDepuisSite = (site: SiteSaisi | null): SaisieSite => ({
  name: site?.name ?? '', type: site?.type ?? 'depot', organisation_id: site?.organisation_id ?? '',
  address: site?.address ?? '', city: site?.city ?? '', country: site?.country ?? 'Guinée',
  latitude: enTexte(site?.latitude), longitude: enTexte(site?.longitude),
  contact_name: site?.contact_name ?? '', contact_phone: site?.contact_phone ?? '', contact_email: site?.contact_email ?? '',
  capacity: enTexte(site?.capacity), responsable_id: site?.responsable_id ?? '', notes: site?.notes ?? '',
});

/** Erreurs de saisie en temps reel (memes regles que les contraintes du serveur). */
export const erreursSite = (f: SaisieSite): string[] => [
  !f.name.trim() && 'Nom du site requis.',
  !f.address.trim() && 'Adresse requise.',
  !f.city.trim() && 'Ville requise.',
  !f.country.trim() && 'Pays requis.',
  verifierCoordonnees(f.latitude, f.longitude),
  verifierCapacite(f.capacity),
].filter((m): m is string => Boolean(m));

/**
 * Corps envoye : seules les colonnes saisies ; ni le stock (solde non
 * saisissable, D-077) ni le statut, qui change par l'action Desactiver ou
 * Reactiver. Une creation enregistre un site actif.
 */
export const corpsSite = (f: SaisieSite, origine: SiteSaisi | null) => ({
  name: f.name.trim(),
  type: f.type,
  organisation_id: f.organisation_id || null,
  address: f.address.trim(),
  city: f.city.trim(),
  country: f.country.trim(),
  latitude: enNombre(f.latitude),
  longitude: enNombre(f.longitude),
  contact_name: f.contact_name.trim() || null,
  contact_phone: f.contact_phone.trim() || null,
  contact_email: f.contact_email.trim() || null,
  capacity: enNombre(f.capacity),
  responsable_id: f.responsable_id || null,
  notes: f.notes.trim() || null,
  ...(origine ? {} : { is_active: true }),
  // location (heritee) : jamais reecrite si l'adresse n'a pas change.
  ...locationAEnvoyer(origine?.address, f.address, !origine),
});

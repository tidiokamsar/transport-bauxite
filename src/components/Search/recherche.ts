// Recherche globale (D-061) : une requete par type de resultat, sur les
// colonnes reelles des tables ; la RLS et le perimetre site s'appliquent
// (aucune lecture hors des politiques de l'utilisateur).

export type TypeResultat = 'vehicule' | 'chauffeur' | 'voyage' | 'ordre' | 'facture' | 'site';

export interface SourceRecherche {
  type: TypeResultat;
  libelle: string;
  /** Ecran ouvert au clic (identifiant de vue de l'application). */
  vue: string;
  table: string;
  colonnes: string;
  /** Colonnes filtrees en ilike. */
  filtres: string[];
}

export const SOURCES_RECHERCHE: SourceRecherche[] = [
  { type: 'vehicule', libelle: 'Engin', vue: 'vehicles', table: 'vehicles', colonnes: 'id, registration, brand_model, vehicle_type, status', filtres: ['registration', 'brand_model'] },
  { type: 'chauffeur', libelle: 'Chauffeur', vue: 'drivers', table: 'drivers', colonnes: 'id, name, license_number, phone, status', filtres: ['name', 'license_number', 'phone'] },
  { type: 'voyage', libelle: 'Voyage', vue: 'trips', table: 'trips', colonnes: 'id, reference, planned_date, etat', filtres: ['reference'] },
  { type: 'ordre', libelle: 'Ordre de travail', vue: 'maintenance', table: 'maintenance_orders', colonnes: 'id, work_order_number, title, status', filtres: ['work_order_number', 'title'] },
  { type: 'facture', libelle: 'Facture', vue: 'invoices', table: 'factures', colonnes: 'id, numero, objet, statut, montant_ttc, devise', filtres: ['numero', 'objet'] },
  { type: 'site', libelle: 'Site', vue: 'sites', table: 'sites', colonnes: 'id, name, type, location', filtres: ['name', 'location'] },
];

/**
 * Motif ilike sur : les caracteres qui ont un sens dans un filtre PostgREST
 * (virgule, parentheses, deux-points) ou dans un motif LIKE (%, _, \, *) sont
 * remplaces par des espaces. Renvoie null si moins de 2 caracteres utiles.
 */
export const motifRecherche = (saisie: string): string | null => {
  const propre = saisie.replace(/[,()%_\\*:"]/g, ' ').replace(/\s+/g, ' ').trim();
  return propre.length >= 2 ? propre : null;
};

/** Filtre `or` PostgREST pour une source. */
export const filtreOu = (source: SourceRecherche, motif: string): string =>
  source.filtres.map((c) => `${c}.ilike.*${motif}*`).join(',');

type Ligne = Record<string, unknown>;
const texte = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

/** Titre et sous-titre d'un resultat depuis les colonnes reelles. */
export const presenter = (type: TypeResultat, l: Ligne): { titre: string; detail: string } => {
  const joindre = (...p: unknown[]) => p.map(texte).filter(Boolean).join(' · ');
  switch (type) {
    case 'vehicule': return { titre: texte(l.registration) ?? '—', detail: joindre(l.brand_model, l.vehicle_type, l.status) };
    case 'chauffeur': return { titre: texte(l.name) ?? '—', detail: joindre(l.license_number && `Permis ${l.license_number}`, l.phone, l.status) };
    case 'voyage': return { titre: texte(l.reference) ?? '—', detail: joindre(l.planned_date, l.etat) };
    case 'ordre': return { titre: texte(l.work_order_number) ?? '—', detail: joindre(l.title, l.status) };
    case 'facture': return { titre: texte(l.numero) ?? 'Brouillon sans numéro', detail: joindre(l.objet, l.statut, l.montant_ttc !== null && l.montant_ttc !== undefined ? `${l.montant_ttc} ${l.devise ?? ''}`.trim() : null) };
    case 'site': return { titre: texte(l.name) ?? '—', detail: joindre(l.type, l.location) };
  }
};

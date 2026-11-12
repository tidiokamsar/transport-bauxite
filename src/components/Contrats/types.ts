// Dossier contractuel (D-026, D-027) : contrats, versions (contrat initial
// et avenants), tarifs et engagements. Aucune valeur par defaut : un tarif
// ou un seuil absent n'est pas calculable (D-013).

export interface Contrat {
  id: string;
  reference: string;
  intitule: string;
  nature: 'client' | 'location' | 'autre';
  contrepartie: string;
  devise: string;
  date_debut: string;
  date_fin: string | null;
  statut: 'brouillon' | 'actif' | 'suspendu' | 'clos';
  delai_paiement_jours: number | null;
  description: string | null;
}

export interface Version {
  id: string;
  contrat_id: string;
  numero: number;
  intitule: string;
  date_effet: string;
  date_signature: string | null;
  resume: string | null;
  document_ref: string | null;
}

export interface Tarif {
  id: string;
  version_id: string;
  libelle: string;
  unite: string;
  prix: number;
  categorie_materiel: string | null;
  engin: string | null;
  conditions: string | null;
  ordre: number;
}

export interface Engagement {
  id: string;
  version_id: string;
  indicateur: string;
  libelle: string;
  seuil: number;
  unite: string;
  sens: 'minimum' | 'maximum';
  periodicite: string;
  consequence: string | null;
  ordre: number;
}

export interface EntreeJournal {
  id: string;
  table_cible: string;
  action: string;
  avant: Record<string, unknown> | null;
  apres: Record<string, unknown> | null;
  le: string;
}

export const NATURES: Record<Contrat['nature'], string> = {
  client: 'Client (nous facturons)',
  location: 'Location (nous sommes facturés)',
  autre: 'Autre',
};

export const STATUTS: Record<Contrat['statut'], { libelle: string; teinte: 'gris' | 'vert' | 'orange' | 'rouge' }> = {
  brouillon: { libelle: 'Brouillon', teinte: 'gris' },
  actif: { libelle: 'Actif', teinte: 'vert' },
  suspendu: { libelle: 'Suspendu', teinte: 'orange' },
  clos: { libelle: 'Clos', teinte: 'rouge' },
};

export const UNITES_TARIF: Record<string, string> = {
  tonne: 'par tonne', heure: 'par heure', km: 'par km', jour: 'par jour', mois: 'par mois', forfait: 'forfait', autre: 'autre',
};

export const INDICATEURS: Record<string, string> = {
  disponibilite: 'Taux de disponibilité',
  temps_chargement: 'Temps de chargement',
  temps_cycle: 'Temps de cycle',
  taux_remplissage: 'Taux de remplissage',
  rotations: 'Nombre de rotations',
  km_facturable: 'Plafond de kilométrage facturable',
  reference_carburant: 'Référence carburant',
  autre: 'Autre engagement',
};

export const PERIODICITES: Record<string, string> = { jour: 'par jour', shift: 'par shift', semaine: 'par semaine', mois: 'par mois' };

/** Version en vigueur a une date : la derniere dont la date d'effet est passee. */
export const versionEnVigueur = (versions: Version[], date: string): Version | null =>
  [...versions].filter((v) => v.date_effet <= date).sort((a, b) => b.numero - a.numero)[0] ?? null;

export const libelleVersion = (v: Pick<Version, 'numero' | 'intitule'>) =>
  v.numero === 0 ? `Contrat initial · ${v.intitule}` : `Avenant n° ${v.numero} · ${v.intitule}`;

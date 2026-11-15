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
  /** Echeances (D-065) : preavis en jours, mode de renouvellement, duree d'un renouvellement ; null = non renseigne. */
  preavis_jours?: number | null;
  renouvellement?: 'tacite' | 'expres' | 'aucun' | null;
  renouvellement_duree_mois?: number | null;
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
  /** Tarif au km (D-043) : retour a vide facture ; null = regle a confirmer. */
  km_retour_vide_facturable?: boolean | null;
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

/** Clause chiffree d'une version (D-065) : condition = un engagement mesure de la meme version. */
export interface Clause {
  id: string;
  version_id: string;
  type_clause: 'penalite' | 'bonus' | 'retenue';
  libelle: string;
  engagement_id: string;
  declenchement: 'non_tenu' | 'tenu';
  base: 'montant' | 'taux';
  valeur: number;
  plafond: number | null;
  article: string | null;
  ordre: number;
  actif: boolean;
  motif_desactivation: string | null;
}

/** Echeance calculee par v_echeances_contrats (D-065). */
export interface Echeance {
  contrat_id: string;
  reference: string;
  contrepartie: string;
  date_fin: string;
  preavis_jours: number | null;
  renouvellement: string | null;
  denonce_le: string | null;
  date_limite_preavis: string | null;
  nature_echeance: 'limite_preavis' | 'fin';
  date_cle: string;
  delai_alerte_jours: number;
  date_alerte: string;
  jours_restants: number;
  a_signaler: boolean;
  echu: boolean;
  fin_si_tacite: string | null;
}

export const TYPES_CLAUSE: Record<Clause['type_clause'], string> = { penalite: 'Pénalité', bonus: 'Bonus', retenue: 'Retenue' };
export const RENOUVELLEMENTS: Record<string, string> = { tacite: 'Tacite', expres: 'Exprès (avenant requis)', aucun: 'Aucun' };

/** Libelle lisible d'une clause : base, condition et plafond, sans valeur supposee. */
export const decrireClause = (c: Pick<Clause, 'base' | 'valeur' | 'plafond' | 'declenchement'>, devise: string, engagement?: string): string => {
  const base = c.base === 'taux' ? `${c.valeur} % de l'assiette facturée` : `${c.valeur} ${devise}`;
  const condition = `si ${engagement ?? "l'engagement"} ${c.declenchement === 'tenu' ? 'est tenu' : "n'est pas tenu"}`;
  return `${base} ${condition}${c.plafond != null ? ` · plafond ${c.plafond} ${devise}` : ''}`;
};

/** Etat d'une echeance pour l'affichage. */
export const etatEcheance = (e: Pick<Echeance, 'echu' | 'a_signaler' | 'nature_echeance' | 'denonce_le'>): { libelle: string; teinte: 'gris' | 'vert' | 'orange' | 'rouge' } =>
  e.echu ? { libelle: 'Échu', teinte: 'rouge' }
    : e.a_signaler ? { libelle: e.nature_echeance === 'limite_preavis' ? 'Préavis à décider' : 'Échéance proche', teinte: 'orange' }
      : e.denonce_le ? { libelle: 'Dénoncé', teinte: 'gris' }
        : { libelle: 'À venir', teinte: 'vert' };

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

// Budgets, dettes et export comptable (D-065) : aides pures, testees dans
// finance.test.ts. Aucun numero de compte ni aucune valeur n'est suppose :
// une donnee absente reste vide.

export interface Ecriture {
  type_ecriture: 'facture_emise' | 'avoir_emis' | 'encaissement' | 'paiement_execute' | 'cout';
  date_ecriture: string;
  piece: string | null;
  piece_liee: string | null;
  tiers: string | null;
  compte_tiers: string | null;
  libelle: string | null;
  montant_ht: number | null;
  montant_taxe: number | null;
  montant: number;
  devise: string | null;
  sens: string;
}

export interface Dette {
  source: 'facture_loueur' | 'bon_commande';
  piece_id: string;
  piece: string;
  date_piece: string;
  beneficiaire: string | null;
  devise: string;
  base: number;
  paye: number;
  du: number;
  paiements_en_cours: number;
  reste_a_proposer: number;
  anciennete_jours: number | null;
}

export const TYPES_ECRITURE: Record<Ecriture['type_ecriture'], string> = {
  facture_emise: 'Facture émise',
  avoir_emis: 'Avoir émis',
  encaissement: 'Encaissement',
  paiement_execute: 'Paiement exécuté',
  cout: 'Coût',
};

/** Lignes du fichier CSV : en-tetes francais, compte de tiers vide s'il n'est pas parametre. */
export const lignesExportComptable = (ecritures: Ecriture[]) =>
  ecritures.map((e) => ({
    type: TYPES_ECRITURE[e.type_ecriture] ?? e.type_ecriture,
    date: e.date_ecriture,
    numero_piece: e.piece ?? '',
    piece_liee: e.piece_liee ?? '',
    tiers: e.tiers ?? '',
    compte_tiers: e.compte_tiers ?? '',
    libelle: e.libelle ?? '',
    montant_ht: e.montant_ht ?? '',
    taxe: e.montant_taxe ?? '',
    montant: e.montant,
    devise: e.devise ?? '',
    sens: e.sens,
  }));

/** Total des dettes par beneficiaire et par devise (jamais additionnees entre devises). */
export const totauxDettes = (dettes: Dette[]) => {
  const totaux = new Map<string, { beneficiaire: string; devise: string; du: number; pieces: number }>();
  for (const d of dettes) {
    const beneficiaire = d.beneficiaire ?? 'Non renseigné';
    const cle = `${beneficiaire}|${d.devise}`;
    const t = totaux.get(cle) ?? { beneficiaire, devise: d.devise, du: 0, pieces: 0 };
    t.du += Number(d.du);
    t.pieces += 1;
    totaux.set(cle, t);
  }
  return [...totaux.values()].sort((a, b) => a.beneficiaire.localeCompare(b.beneficiaire) || a.devise.localeCompare(b.devise));
};

/** Premier et dernier jour d'un mois AAAA-MM. */
export const bornesMois = (mois: string) => {
  const [a, m] = mois.split('-').map(Number);
  return { du: `${mois}-01`, au: `${mois}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}` };
};

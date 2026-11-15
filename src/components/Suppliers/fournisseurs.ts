import type { TeintePuce } from '../ui/Panneau';

// Fournisseurs (D-059) : libelles, controles de saisie et comparaison des
// offres. Memes regles que les fonctions serveur, qui restent seules juges.

export interface Fournisseur {
  id: string; supplier_number: string; supplier_type: string; company_name: string; phone: string | null; email: string | null;
  address: string | null; ville: string | null; pays: string | null; identifiant_fiscal: string | null; registre_commerce: string | null;
  payment_terms: string | null; notes: string | null; active: boolean | null; suspendu_le: string | null; motif_suspension: string | null;
}
export interface Categorie { id: string; libelle: string; actif: boolean }

export const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';

export const TYPES_FOURNISSEUR: Record<string, string> = {
  parts: 'Pièces détachées',
  tires: 'Pneus',
  fuel: 'Carburant',
  services: 'Services',
  other: 'Autre',
};

export const TYPES_DOCUMENT: Record<string, string> = {
  rccm: 'Registre du commerce (RCCM)',
  nif: 'Identifiant fiscal (NIF)',
  attestation_fiscale: 'Attestation de régularité fiscale',
  attestation_cnss: 'Attestation CNSS',
  assurance: 'Attestation d’assurance',
  agrement: 'Agrément',
  contrat_cadre: 'Contrat cadre',
  autre: 'Autre',
};

export type StatutConsultation = 'ouverte' | 'attribuee' | 'annulee';
export type StatutOffre = 'recue' | 'retenue' | 'ecartee' | 'retiree';

export const STATUTS_CONSULTATION: Record<StatutConsultation, { texte: string; teinte: TeintePuce }> = {
  ouverte: { texte: 'Ouverte', teinte: 'bleu' },
  attribuee: { texte: 'Attribuée', teinte: 'vert' },
  annulee: { texte: 'Annulée', teinte: 'gris' },
};

export const STATUTS_OFFRE: Record<StatutOffre, { texte: string; teinte: TeintePuce }> = {
  recue: { texte: 'Reçue', teinte: 'bleu' },
  retenue: { texte: 'Retenue', teinte: 'vert' },
  ecartee: { texte: 'Écartée', teinte: 'gris' },
  retiree: { texte: 'Retirée', teinte: 'gris' },
};

const entier = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

// Etat d'un document administratif a une date donnee (AAAA-MM-JJ).
export type EtatDocument = 'expire' | 'a_renouveler' | 'valide' | 'sans_echeance';
export const ETATS_DOCUMENT: Record<EtatDocument, { texte: string; teinte: TeintePuce }> = {
  expire: { texte: 'Expiré', teinte: 'rouge' },
  a_renouveler: { texte: 'À renouveler', teinte: 'orange' },
  valide: { texte: 'Valide', teinte: 'vert' },
  sans_echeance: { texte: 'Sans échéance', teinte: 'gris' },
};

const jours = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

export const etatDocument = (expiration: string | null, aujourdhui: string, delaiAlerte: number): EtatDocument => {
  if (!expiration) return 'sans_echeance';
  const reste = jours(expiration) - jours(aujourdhui);
  if (reste < 0) return 'expire';
  return reste <= delaiAlerte ? 'a_renouveler' : 'valide';
};

// Note globale ponderee, arrondie a deux decimales ; null si une note
// manque ou sort de l'echelle 1 a 5.
export const noteGlobale = (notes: { note: number | null; poids: number }[]) => {
  if (notes.length === 0) return null;
  if (notes.some((n) => n.note === null || !Number.isInteger(n.note) || n.note < 1 || n.note > 5 || n.poids <= 0)) return null;
  const poids = notes.reduce((s, n) => s + n.poids, 0);
  const somme = notes.reduce((s, n) => s + (n.note as number) * n.poids, 0);
  return Math.round((somme / poids) * 100) / 100;
};

// Saisie d'une consultation : lignes envoyees au serveur, null si une
// ligne est incomplete.
export interface LigneConsultationSaisie { article: string; designation: string; quantite: string }
export const lignesConsultationPourServeur = (lignes: LigneConsultationSaisie[]) => {
  if (lignes.length === 0) return null;
  const sortie = lignes.map((l) => {
    const quantite = entier(l.quantite);
    if (!quantite || (!l.article && !l.designation.trim())) return null;
    return { article: l.article || null, designation: l.designation.trim() || null, quantite };
  });
  return sortie.every((l) => l !== null) ? sortie : null;
};

// Saisie d'une offre : prix par ligne ; une ligne laissee vide n'est pas
// chiffree. null si un prix est invalide ou si aucune ligne n'est chiffree.
export const lignesOffrePourServeur = (prix: Record<string, string>) => {
  const remplies = Object.entries(prix).filter(([, v]) => v.trim() !== '');
  if (remplies.length === 0) return null;
  const sortie = remplies.map(([ligne, v]) => {
    const p = entier(v);
    return p === null ? null : { ligne, prix_unitaire: p };
  });
  return sortie.every((l) => l !== null) ? sortie : null;
};

// Comparaison des offres d'une consultation. Les offres retirees sont
// ignorees. Le classement porte sur les offres completes (toutes les
// lignes chiffrees), par montant puis delai ; une offre incomplete n'est
// jamais classee devant une offre complete, faute de prix comparable.
export interface LigneComparee { id: string; designation: string; quantite: number }
export interface OffreComparee {
  id: string;
  fournisseur: string;
  delai: number;
  statut: StatutOffre;
  recueLe: string;
  prix: Record<string, number>;
}
export interface ResultatOffre {
  id: string;
  fournisseur: string;
  total: number;
  lignesChiffrees: number;
  complete: boolean;
  rang: number | null;
  ecartPourcent: number | null;
  moinsDisante: boolean;
  plusRapide: boolean;
  horsDelai: boolean;
}
export interface Comparaison {
  offres: ResultatOffre[];
  meilleurPrixParLigne: Record<string, string[]>;
  nbComparables: number;
}

export const comparerOffres = (lignes: LigneComparee[], offres: OffreComparee[], dateLimite: string | null = null): Comparaison => {
  const actives = offres.filter((o) => o.statut !== 'retiree');
  const calcul = actives.map((o) => {
    const chiffrees = lignes.filter((l) => o.prix[l.id] !== undefined);
    const total = chiffrees.reduce((s, l) => s + o.prix[l.id] * l.quantite, 0);
    return { o, total, lignesChiffrees: chiffrees.length, complete: lignes.length > 0 && chiffrees.length === lignes.length };
  });
  const completes = calcul.filter((c) => c.complete).sort((a, b) => a.total - b.total || a.o.delai - b.o.delai);
  const minTotal = completes.length ? completes[0].total : null;
  const minDelai = actives.length ? Math.min(...actives.map((o) => o.delai)) : null;
  const rangs = new Map<string, number>();
  completes.forEach((c, i) => {
    const prec = completes[i - 1];
    rangs.set(c.o.id, prec && prec.total === c.total && prec.o.delai === c.o.delai ? rangs.get(prec.o.id)! : i + 1);
  });
  const meilleurPrixParLigne: Record<string, string[]> = {};
  for (const l of lignes) {
    const prixLigne = actives.filter((o) => o.prix[l.id] !== undefined);
    if (prixLigne.length === 0) { meilleurPrixParLigne[l.id] = []; continue; }
    const min = Math.min(...prixLigne.map((o) => o.prix[l.id]));
    meilleurPrixParLigne[l.id] = prixLigne.filter((o) => o.prix[l.id] === min).map((o) => o.id);
  }
  return {
    offres: calcul.map((c) => ({
      id: c.o.id,
      fournisseur: c.o.fournisseur,
      total: c.total,
      lignesChiffrees: c.lignesChiffrees,
      complete: c.complete,
      rang: rangs.get(c.o.id) ?? null,
      ecartPourcent: c.complete && minTotal !== null && minTotal > 0 ? Math.round(((c.total - minTotal) / minTotal) * 1000) / 10 : null,
      moinsDisante: c.complete && c.total === minTotal,
      plusRapide: c.o.delai === minDelai,
      horsDelai: !!dateLimite && c.o.recueLe > dateLimite,
    })),
    meilleurPrixParLigne,
    nbComparables: completes.length,
  };
};

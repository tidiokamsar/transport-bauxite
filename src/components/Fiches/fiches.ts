// Fiches terrain (D-028) : libelles et conversion d'une ligne de fiche
// papier en etapes horodatees du cycle de voyage. Les heures sont lues sur
// la fiche ; aucune n'est deduite ni completee.

export type TypeFiche = 'rotations' | 'pointage_engins' | 'carburant';
export type StatutFiche = 'preparee' | 'remise' | 'retournee' | 'saisie' | 'annulee';
export type LieuPesee = 'depart' | 'arrivee';

export const TYPES_FICHE: Record<TypeFiche, { libelle: string; titre: string }> = {
  rotations: { libelle: 'Rotations camion', titre: 'FICHE DE ROTATIONS' },
  pointage_engins: { libelle: 'Pointage des engins', titre: 'FICHE DE POINTAGE DES ENGINS' },
  carburant: { libelle: 'Carburant', titre: 'FICHE DE DISTRIBUTION DE CARBURANT' },
};

export const STATUTS_FICHE: Record<StatutFiche, { libelle: string; teinte: 'gris' | 'bleu' | 'orange' | 'vert' | 'rouge' }> = {
  preparee: { libelle: 'Préparée', teinte: 'gris' },
  remise: { libelle: 'Remise à l\'agent', teinte: 'bleu' },
  retournee: { libelle: 'Retournée', teinte: 'orange' },
  saisie: { libelle: 'Saisie', teinte: 'vert' },
  annulee: { libelle: 'Annulée', teinte: 'rouge' },
};

export interface Fiche {
  id: string;
  numero: string;
  type: TypeFiche;
  date_fiche: string;
  site_id: string;
  shift_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  agent: string | null;
  options: { pesee?: LieuPesee };
  contenu: { voyages?: { id: string; reference: string }[]; engins?: { id: string; registration: string }[] };
  statut: StatutFiche;
  prepare_le: string;
  remise_le: string | null;
  retournee_le: string | null;
  saisie_le: string | null;
  motif_annulation: string | null;
}

/** Colonnes horaires d'une fiche de rotations, dans l'ordre du cycle. */
export const COLONNES_ROTATION = [
  { cle: 'AT_LOADING', libelle: 'Arrivée chargement' },
  { cle: 'LOADING', libelle: 'Début chargement' },
  { cle: 'LOADED', libelle: 'Fin chargement' },
  { cle: 'IN_TRANSIT', libelle: 'Départ' },
  { cle: 'AT_DESTINATION', libelle: 'Arrivée destination' },
  { cle: 'UNLOADING', libelle: 'Début déchargement' },
  { cle: 'DELIVERED', libelle: 'Fin déchargement' },
] as const;

export interface LigneRotation {
  heures: Partial<Record<(typeof COLONNES_ROTATION)[number]['cle'], string>>;
  heurePesee: string;
  ticket: string;
  brut: string;
  tare: string;
  documentRef: string;
}

export interface Etape {
  etat: string;
  quand: string;
  donnees?: Record<string, unknown>;
}

const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));

/**
 * Horodatage d'une heure HH:MM lue sur la fiche du jour `date` ; pour un
 * shift qui passe minuit, une heure anterieure au debut du shift tombe le
 * lendemain.
 */
export const horodater = (date: string, heure: string, debutShift: string | null): Date => {
  const [a, m, j] = date.split('-').map(Number);
  const [h, min] = heure.split(':').map(Number);
  const d = new Date(a, m - 1, j, h, min, 0, 0);
  if (debutShift) {
    const [hs, ms] = debutShift.split(':').map(Number);
    if (h * 60 + min < hs * 60 + ms) d.setDate(d.getDate() + 1);
  }
  return d;
};

/**
 * Etapes d'une ligne de fiche de rotations. Une colonne vide n'est pas
 * envoyee. La pesee CBG est integree a l'arrivee au depot depuis le ticket;
 * Kogon ne refait pas la pesee. Une reference de document est facultative
 * pour permettre une saisie manuelle controlee si la piece manque.
 */
export const etapesRotation = (
  ligne: LigneRotation,
  date: string,
  pesee: LieuPesee,
  debutShift: string | null,
): { etapes: Etape[]; erreur: string | null } => {
  const etapes: Etape[] = [];
  for (const c of COLONNES_ROTATION) {
    const h = ligne.heures[c.cle];
    if (h) etapes.push({ etat: c.cle, quand: horodater(date, h, debutShift).toISOString() });
  }
  const brut = nombre(ligne.brut);
  const tare = nombre(ligne.tare);
  const peseeSaisie = brut !== null || tare !== null || ligne.ticket.trim() !== '' || ligne.heurePesee !== '' || ligne.documentRef.trim() !== '';
  if (peseeSaisie) {
    if (brut === null || tare === null || !ligne.heurePesee || !ligne.ticket.trim()) {
      return { etapes: [], erreur: 'Ticket CBG, heure, brut et tare requis pour intégrer la pesée' };
    }
    if (brut <= tare) return { etapes: [], erreur: 'Pesée incohérente : le brut doit dépasser la tare' };
    if (pesee !== 'arrivee') {
      return { etapes: [], erreur: 'Le ticket CBG est intégré à la réception au dépôt' };
    }
    etapes.push({
      etat: 'WEIGHED_IN',
      quand: horodater(date, ligne.heurePesee, debutShift).toISOString(),
      donnees: { brut, tare, ticket: ligne.ticket.trim(), ...(ligne.documentRef.trim() ? { document_ref: ligne.documentRef.trim() } : {}) },
    });
  }
  return { etapes, erreur: etapes.length === 0 ? 'Aucune heure saisie' : null };
};

export const ligneVide = (): LigneRotation => ({ heures: {}, heurePesee: '', ticket: '', brut: '', tare: '', documentRef: '' });

// Cycle de vie d'une fiche terrain (D-089), regles d'affichage. Miroir de
// transition_fiche_autorisee (migration 20261121215000) pour proposer les
// actions ; le serveur reste seul juge et refuse le reste.
import type { TeintePuce } from '../ui/Panneau';

export const VUE_FICHES = 'fiches';

export const ETATS_FICHE: Record<string, { libelle: string; teinte: TeintePuce }> = {
  a_preparer: { libelle: 'À préparer', teinte: 'gris' },
  preparee: { libelle: 'Préparée', teinte: 'gris' },
  a_imprimer: { libelle: 'À imprimer', teinte: 'gris' },
  imprimee: { libelle: 'Imprimée', teinte: 'bleu' },
  a_remettre: { libelle: 'À remettre', teinte: 'bleu' },
  remise_agent: { libelle: 'Remise à l\'agent', teinte: 'bleu' },
  en_utilisation: { libelle: 'En utilisation', teinte: 'bleu' },
  retournee: { libelle: 'Retournée', teinte: 'orange' },
  a_saisir: { libelle: 'À saisir', teinte: 'orange' },
  saisie_en_cours: { libelle: 'Saisie en cours', teinte: 'orange' },
  saisie_terminee: { libelle: 'Saisie terminée', teinte: 'violet' },
  a_controler: { libelle: 'À contrôler', teinte: 'violet' },
  a_corriger: { libelle: 'À corriger', teinte: 'rouge' },
  validee: { libelle: 'Validée', teinte: 'vert' },
  archivee: { libelle: 'Archivée', teinte: 'gris' },
  annulee: { libelle: 'Annulée', teinte: 'rouge' },
};

export type ActionFiche =
  | 'imprimer' | 'remettre' | 'retour' | 'saisir-ligne' | 'saisir-pointage' | 'saisir-carburant' | 'terminer-saisie' | 'soumettre'
  | 'controler' | 'renvoyer' | 'valider' | 'archiver' | 'annuler';

export const LIBELLES_ACTIONS: Record<ActionFiche, string> = {
  imprimer: 'Enregistrer l\'impression',
  remettre: 'Remettre à l\'agent',
  retour: 'Enregistrer le retour',
  'saisir-ligne': 'Saisir une rotation',
  'saisir-pointage': 'Saisir un pointage',
  'saisir-carburant': 'Saisir une distribution',
  'terminer-saisie': 'Terminer la saisie',
  soumettre: 'Soumettre au contrôle',
  controler: 'Contrôler',
  renvoyer: 'Renvoyer en correction',
  valider: 'Valider',
  archiver: 'Archiver',
  annuler: 'Annuler la fiche',
};

const PERMISES: Record<ActionFiche, string[]> = {
  imprimer: ['preparee', 'a_imprimer', 'imprimee', 'a_remettre', 'remise_agent', 'en_utilisation', 'retournee'],
  remettre: ['preparee', 'imprimee', 'a_remettre'],
  retour: ['remise_agent', 'en_utilisation'],
  'saisir-ligne': ['retournee', 'a_saisir', 'saisie_en_cours', 'a_corriger'],
  'saisir-pointage': ['retournee', 'a_saisir', 'saisie_en_cours', 'a_corriger'],
  'saisir-carburant': ['retournee', 'a_saisir', 'saisie_en_cours', 'a_corriger'],
  'terminer-saisie': ['retournee', 'a_saisir', 'saisie_en_cours', 'a_corriger'],
  soumettre: ['saisie_terminee'],
  controler: ['a_controler'],
  renvoyer: ['a_controler'],
  valider: ['a_controler'],
  archiver: ['validee'],
  annuler: ['a_preparer', 'preparee', 'a_imprimer', 'imprimee', 'a_remettre', 'remise_agent', 'en_utilisation', 'retournee',
    'a_saisir', 'saisie_en_cours', 'saisie_terminee', 'a_corriger'],
};

const TYPE_SAISIE: Partial<Record<ActionFiche, string>> = { 'saisir-ligne': 'rotations', 'saisir-pointage': 'pointage_engins', 'saisir-carburant': 'carburant' };

export const estActionFiche = (a: string): a is ActionFiche => a in PERMISES;

/** Action proposee pour une fiche a cet etat (et de ce type pour la saisie des rotations). */
export const actionPermise = (action: ActionFiche, etat: string, type: string): boolean =>
  PERMISES[action].includes(etat) && (!(action in TYPE_SAISIE) || TYPE_SAISIE[action] === type);

export const actionsFiche = (etat: string, type: string): ActionFiche[] =>
  (Object.keys(PERMISES) as ActionFiche[]).filter((a) => actionPermise(a, etat, type));

/** La reimpression d'une fiche deja imprimee exige un motif (D-089). */
export const motifImpressionRequis = (nbImpressions: number | null | undefined) => (nbImpressions ?? 0) > 0;

export type LigneRotationSaisie = {
  rang: string; trip_id: string; depart_le: string; arrivee_le: string; km_depart: string; km_arrivee: string;
  ticket_cbg: string; observations: string; incidents: string; motif: string;
};

/** Erreurs de la saisie d'une rotation (memes regles que la table) ; vide = envoi possible. */
export const erreursLigneRotation = (s: LigneRotationSaisie, correction: boolean): Record<string, string> => {
  const e: Record<string, string> = {};
  const rang = Number(s.rang);
  if (!Number.isInteger(rang) || rang <= 0) e.rang = 'Numéro de rotation entier positif requis';
  const kd = s.km_depart === '' ? null : Number(s.km_depart.replace(',', '.'));
  const ka = s.km_arrivee === '' ? null : Number(s.km_arrivee.replace(',', '.'));
  if (kd !== null && (Number.isNaN(kd) || kd < 0)) e.km_depart = 'Compteur invalide';
  if (ka !== null && (Number.isNaN(ka) || ka < 0)) e.km_arrivee = 'Compteur invalide';
  if (kd !== null && ka !== null && !e.km_depart && !e.km_arrivee && ka < kd) e.km_arrivee = 'Compteur d\'arrivée inférieur au départ';
  if (s.depart_le && s.arrivee_le && Date.parse(s.arrivee_le) < Date.parse(s.depart_le)) e.arrivee_le = 'Arrivée avant le départ';
  if (correction && s.motif.trim().length < 3) e.motif = 'Motif de correction requis (ligne déjà saisie)';
  return e;
};

/** Ligne envoyee a saisir_ligne_rotation : champs vides omis, nombres convertis, aucune valeur ajoutee. */
export const ligneVersServeur = (s: LigneRotationSaisie): Record<string, unknown> => {
  const o: Record<string, unknown> = {};
  if (s.trip_id) o.trip_id = s.trip_id;
  if (s.depart_le) o.depart_le = new Date(s.depart_le).toISOString();
  if (s.arrivee_le) o.arrivee_le = new Date(s.arrivee_le).toISOString();
  if (s.km_depart !== '') o.km_depart = Number(s.km_depart.replace(',', '.'));
  if (s.km_arrivee !== '') o.km_arrivee = Number(s.km_arrivee.replace(',', '.'));
  if (s.ticket_cbg.trim()) o.ticket_cbg = s.ticket_cbg.trim();
  if (s.observations.trim()) o.observations = s.observations.trim();
  if (s.incidents.trim()) o.incidents = s.incidents.trim();
  return o;
};

/** Adresse d'une action groupee sur plusieurs fiches (impression, remise, retour). */
export const routeLot = (action: string, ids: string[]) => `#/fiches/lot/${action}?ids=${ids.map(encodeURIComponent).join(',')}`;

/** Identifiants d'un lot lus dans l'adresse ; seuls des identifiants plausibles sont gardes. */
export const idsDuLot = (brut: string | undefined): string[] =>
  (brut ?? '').split(',').map((x) => x.trim()).filter((x) => /^[A-Za-z0-9-]{1,64}$/.test(x));

const GROUPES: { cle: string; libelle: string; etats: string[]; teinte: TeintePuce }[] = [
  { cle: 'preparees', libelle: 'Préparées', etats: ['a_preparer', 'preparee', 'a_imprimer'], teinte: 'gris' },
  { cle: 'imprimees', libelle: 'Imprimées, à remettre', etats: ['imprimee', 'a_remettre'], teinte: 'bleu' },
  { cle: 'agent', libelle: 'Chez l\'agent', etats: ['remise_agent', 'en_utilisation'], teinte: 'bleu' },
  { cle: 'retournees', libelle: 'Retournées, à saisir', etats: ['retournee', 'a_saisir', 'saisie_en_cours'], teinte: 'orange' },
  { cle: 'controle', libelle: 'À contrôler', etats: ['saisie_terminee', 'a_controler'], teinte: 'violet' },
  { cle: 'corriger', libelle: 'À corriger', etats: ['a_corriger'], teinte: 'rouge' },
  { cle: 'validees', libelle: 'Validées ou archivées', etats: ['validee', 'archivee'], teinte: 'vert' },
  { cle: 'annulees', libelle: 'Annulées', etats: ['annulee'], teinte: 'rouge' },
];

/** Tableau de bord du cycle : nombre de fiches par groupe d'etats (groupes vides omis). */
export const tableauDeBordFiches = (fiches: { etat: string }[]) =>
  GROUPES.map((g) => ({ cle: g.cle, libelle: g.libelle, teinte: g.teinte, nombre: fiches.filter((f) => g.etats.includes(f.etat)).length }))
    .filter((g) => g.nombre > 0);

/** Nombre saisi (virgule acceptee) ; vide = null, jamais zero suppose. */
export const nombreSaisi = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(',', '.')));
const invalide = (s: string) => s.trim() !== '' && (Number.isNaN(Number(s.replace(',', '.'))) || Number(s.replace(',', '.')) < 0);

export type SaisiePointage = {
  vehicle_id: string; index_debut: string; index_fin: string; heures_productives: string; periode_debut: string; periode_fin: string;
  operateur: string; observations: string; motif: string;
};

/** Erreurs du pointage d'engin (memes regles que saisir_pointage_fiche). */
export const erreursPointage = (s: SaisiePointage): Record<string, string> => {
  const e: Record<string, string> = {};
  if (!s.vehicle_id) e.vehicle_id = 'Engin requis';
  if (s.index_debut.trim() === '' || invalide(s.index_debut)) e.index_debut = 'Horamètre de début requis';
  if (s.index_fin.trim() === '' || invalide(s.index_fin)) e.index_fin = 'Horamètre de fin requis';
  const d = nombreSaisi(s.index_debut); const f = nombreSaisi(s.index_fin); const p = nombreSaisi(s.heures_productives);
  if (!e.index_debut && !e.index_fin && d !== null && f !== null && f < d) e.index_fin = 'Horamètre de fin inférieur au début';
  if (invalide(s.heures_productives)) e.heures_productives = 'Heures invalides';
  else if (p !== null && d !== null && f !== null && f >= d && p > f - d) e.heures_productives = 'Heures productives supérieures aux heures moteur';
  if (s.periode_debut && s.periode_fin && Date.parse(s.periode_fin) < Date.parse(s.periode_debut)) e.periode_fin = 'Fin avant le début';
  return e;
};

export type SaisieCarburant = {
  rang: string; vehicle_id: string; distribue_le: string; litres: string; index_pompe_debut: string; index_pompe_fin: string;
  compteur_km: string; horametre: string; destinataire_confirme: boolean; destinataire_nom: string; observations: string; motif: string;
};

/** Erreurs d'une distribution de carburant (memes regles que saisir_ligne_carburant). */
export const erreursCarburant = (s: SaisieCarburant, correction: boolean): Record<string, string> => {
  const e: Record<string, string> = {};
  const rang = Number(s.rang);
  if (!Number.isInteger(rang) || rang <= 0) e.rang = 'Numéro de ligne entier positif requis';
  if (!s.vehicle_id) e.vehicle_id = 'Engin destinataire requis';
  const l = nombreSaisi(s.litres);
  if (l === null || Number.isNaN(l) || l <= 0) e.litres = 'Quantité en litres positive requise';
  if (!s.distribue_le) e.distribue_le = 'Date et heure requises';
  else if (Date.parse(s.distribue_le) > Date.now() + 5 * 60_000) e.distribue_le = 'Date dans le futur';
  (['index_pompe_debut', 'index_pompe_fin', 'compteur_km', 'horametre'] as const).forEach((k) => { if (invalide(s[k])) e[k] = 'Valeur invalide'; });
  const d = nombreSaisi(s.index_pompe_debut); const f = nombreSaisi(s.index_pompe_fin);
  if (!e.index_pompe_debut && !e.index_pompe_fin && d !== null && f !== null && f < d) e.index_pompe_fin = 'Index de fin inférieur au début';
  if (correction && s.motif.trim().length < 3) e.motif = 'Motif de correction requis (ligne déjà saisie)';
  return e;
};

/** Valeurs du brouillon de cette saisie, completees par les valeurs vides (jamais de valeur inventee). */
export const depuisBrouillon = <V extends Record<string, unknown>>(fiche: { brouillon: Record<string, unknown> | null }, cle: string, vide: V): V => {
  const b = fiche.brouillon?.[cle];
  if (!b || typeof b !== 'object') return vide;
  const r = { ...vide };
  (Object.keys(vide) as (keyof V)[]).forEach((k) => {
    const x = (b as Record<string, unknown>)[k as string];
    if (typeof x === typeof vide[k]) r[k] = x as V[keyof V];
  });
  return r;
};


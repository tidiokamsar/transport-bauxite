// Pesee a deux sources (D-081). Source A : releve officiel CBG importe ;
// source B : releve terrain KOGON (ce que l'agent observe de la pesee CBG,
// jamais un ticket officiel). Fonctions pures, testees dans pesee.test.ts.

import type { TeintePuce } from '../ui/Panneau';
import { lireReleveCsv, type LigneReleve } from './releveCbg';

// --- Source A : analyse de l'import avant envoi ---------------------------

export interface RejetImport { rang: number; motif: string; contenu: string }
export interface AnalyseImport {
  lignes: LigneReleve[];
  rejets: RejetImport[];
  colonnes: (keyof LigneReleve)[];
  incompletes: number;
  erreur?: string;
}

/** Colonnes exigees par le serveur (importer_releve_cbg_v2). */
export const colonnesManquantes = (colonnes: (keyof LigneReleve)[]): string[] => {
  const manquantes: string[] = [];
  if (!colonnes.includes('ticket')) manquantes.push('ticket');
  if (!colonnes.includes('date')) manquantes.push('date');
  if (!colonnes.includes('net') && !(colonnes.includes('brut') && colonnes.includes('tare'))) manquantes.push('net (ou brut et tare)');
  return manquantes;
};

const separateur = (entete: string) => ((entete.match(/;/g)?.length ?? 0) >= (entete.match(/,/g)?.length ?? 0) ? ';' : ',');

/**
 * Controle complet d'un releve CSV : colonnes exigees, lignes au nombre de
 * champs incorrect ou sans aucune valeur reconnue rejetees avec leur motif
 * (elles sont transmises au serveur pour trace, jamais corrigees). Une valeur
 * illisible dans une ligne acceptee reste vide : la ligne est comptee
 * incomplete et le rapprochement la signale.
 */
export const analyserReleve = (texte: string): AnalyseImport => {
  const lu = lireReleveCsv(texte);
  const brutes = (texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte).split(/\r?\n/).filter((l) => l.trim() !== '');
  if (brutes.length < 2) return { lignes: [], rejets: [], colonnes: [], incompletes: 0, erreur: 'Fichier vide ou sans ligne de données' };
  const manquantes = colonnesManquantes(lu.colonnes);
  if (manquantes.length > 0) {
    return { lignes: [], rejets: [], colonnes: lu.colonnes, incompletes: 0, erreur: `Colonnes manquantes : ${manquantes.join(', ')}` };
  }
  const sep = separateur(brutes[0]);
  const nbEntetes = brutes[0].split(sep).length;
  const lignes: LigneReleve[] = [];
  const rejets: RejetImport[] = [];
  lu.lignes.forEach((l, i) => {
    const source = brutes[i + 1] ?? '';
    // Decoupage approximatif (guillemets) : un ecart n'est retenu que s'il n'est pas explique par des guillemets.
    const champs = source.includes('"') ? nbEntetes : source.split(sep).length;
    if (champs !== nbEntetes) { rejets.push({ rang: i + 2, motif: `${champs} champ(s) au lieu de ${nbEntetes}`, contenu: source }); return; }
    if (!l.ticket && !l.net && !l.brut && !l.tare && !l.date && !l.immatriculation) {
      rejets.push({ rang: i + 2, motif: 'Aucune valeur reconnue', contenu: source });
      return;
    }
    lignes.push(l);
  });
  // Poids nul ou negatif : ligne gardee telle que recue, mais incomplete (le serveur ne la compare pas).
  const positif = (v: string) => v !== '' && Number(v) > 0;
  const poidsLisible = (l: LigneReleve) => (l.net ? positif(l.net)
    : positif(l.brut) && l.tare !== '' && Number(l.tare) >= 0 && Number(l.brut) > Number(l.tare));
  const incompletes = lignes.filter((l) => !l.ticket || !l.date || !poidsLisible(l)).length;
  return { lignes, rejets, colonnes: lu.colonnes, incompletes };
};

/** Empreinte SHA-256 (hexadecimal minuscule) du contenu exact du fichier. */
export const empreinteSha256 = async (contenu: ArrayBuffer): Promise<string> => {
  const condensat = await crypto.subtle.digest('SHA-256', contenu);
  return Array.from(new Uint8Array(condensat)).map((o) => o.toString(16).padStart(2, '0')).join('');
};

// --- Classes du rapprochement et anomalies ---------------------------------

export const CLASSES: Record<string, { libelle: string; teinte: TeintePuce }> = {
  concordant: { libelle: 'Concordant', teinte: 'vert' },
  concordant_avec_reserve: { libelle: 'Concordant avec réserve', teinte: 'bleu' },
  ecart_poids: { libelle: 'Écart de poids', teinte: 'rouge' },
  ticket_sans_fiche: { libelle: 'Ticket CBG sans fiche KOGON', teinte: 'orange' },
  fiche_sans_ticket: { libelle: 'Fiche KOGON sans ticket CBG', teinte: 'orange' },
  ticket_duplique: { libelle: 'Ticket dupliqué', teinte: 'rouge' },
  camion_non_reconnu: { libelle: 'Camion non reconnu', teinte: 'rouge' },
  rotation_non_retrouvee: { libelle: 'Rotation non retrouvée', teinte: 'orange' },
  donnees_incompletes: { libelle: 'Données incomplètes', teinte: 'gris' },
  a_examiner: { libelle: 'À examiner (plusieurs candidats)', teinte: 'violet' },
};

export const STATUTS_ANOMALIE: Record<string, { libelle: string; teinte: TeintePuce }> = {
  ouverte: { libelle: 'Ouverte', teinte: 'rouge' },
  en_examen: { libelle: 'En examen', teinte: 'orange' },
  verification_demandee: { libelle: 'Vérification demandée', teinte: 'orange' },
  justifiee: { libelle: 'Justifiée', teinte: 'bleu' },
  erreur_cbg_signalee: { libelle: 'Erreur CBG signalée', teinte: 'violet' },
  soumise_validation: { libelle: 'Soumise à validation', teinte: 'bleu' },
  cloturee: { libelle: 'Clôturée', teinte: 'vert' },
};

export type ActionAnomalie = 'examiner' | 'demander_verification' | 'ajouter_observation' | 'affecter' | 'confirmer_concordance'
  | 'accepter_ecart_justifie' | 'signaler_erreur_cbg' | 'soumettre_validation' | 'renvoyer' | 'cloturer';

export const LIBELLES_ACTION: Record<ActionAnomalie, string> = {
  examiner: 'Examiner',
  demander_verification: 'Demander une vérification',
  ajouter_observation: 'Ajouter une observation',
  affecter: 'Affecter',
  confirmer_concordance: 'Confirmer la concordance',
  accepter_ecart_justifie: 'Accepter l\'écart justifié',
  signaler_erreur_cbg: 'Signaler une erreur CBG',
  soumettre_validation: 'Soumettre à validation',
  renvoyer: 'Renvoyer en examen',
  cloturer: 'Clôturer',
};

/** Actions dont le motif (commentaire) est exige par le serveur. */
export const MOTIF_EXIGE: ActionAnomalie[] = ['demander_verification', 'ajouter_observation', 'confirmer_concordance',
  'accepter_ecart_justifie', 'signaler_erreur_cbg', 'renvoyer'];

/**
 * Actions proposees selon l'etat et les droits ; le serveur reste juge
 * (agir_anomalie_pesee, delegations comprises). Le valideur (droit
 * facturation) cloture ; ni l'auteur de la conclusion ni celui qui a soumis
 * ne cloturent, quelle que soit la categorie.
 */
export const actionsPossibles = (
  a: { statut: string; categorie: string; soumis_par: string | null; conclu_par: string | null },
  droits: { voyages: boolean; facturation: boolean; utilisateur: string | null },
): ActionAnomalie[] => {
  if (a.statut === 'cloturee') return [];
  const r: ActionAnomalie[] = [];
  if (droits.voyages) {
    if (['ouverte', 'verification_demandee'].includes(a.statut)) r.push('examiner');
    if (['ouverte', 'en_examen'].includes(a.statut)) r.push('demander_verification');
    if (['en_examen', 'verification_demandee'].includes(a.statut)) r.push('confirmer_concordance', 'accepter_ecart_justifie', 'signaler_erreur_cbg');
    if (['justifiee', 'erreur_cbg_signalee'].includes(a.statut)) r.push('soumettre_validation');
    if (a.statut === 'soumise_validation') r.push('renvoyer');
    r.push('ajouter_observation', 'affecter');
  }
  if (droits.facturation && a.statut === 'soumise_validation'
      && a.soumis_par !== null && a.conclu_par !== null
      && a.soumis_par !== droits.utilisateur && a.conclu_par !== droits.utilisateur) {
    r.push('cloturer');
  }
  return r;
};

export const libelleTolerance = (t: { tolerance_t: number | null; tolerance_pct: number | null; source: string } | null): string => {
  if (!t || t.source === 'non_parametree') return 'Tolérance non paramétrée : tout écart non nul est signalé';
  const parts = [t.tolerance_t !== null ? `${t.tolerance_t} t` : null, t.tolerance_pct !== null ? `${t.tolerance_pct} %` : null].filter(Boolean);
  const origine = t.source === 'site' ? 'du site' : t.source === 'global' ? 'globale' : 'réglage tolerance_poids_cbg_t';
  return `Tolérance ${origine} : ${parts.join(' et ')}`;
};

// --- Source B : brouillons locaux de fiche terrain -------------------------
// Enregistrement local par fiche (cle par identifiant client), envoi
// explicite. Pas de service worker ni de mode hors ligne complet (extension a
// declencheur : releve de connectivite requis, D-081).

export interface BrouillonKogon {
  client_id: string;
  site_id: string;
  trip_id: string;
  champs: Record<string, string>;
  anomalie: boolean;
  modifie_le: string;
}

export const PREFIXE_BROUILLON = 'sigtb:pesee:brouillon:';

type Stockage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
const stockageParDefaut = (): Stockage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

export const lireBrouillons = (s: Stockage | null = stockageParDefaut()): BrouillonKogon[] => {
  if (!s) return [];
  const r: BrouillonKogon[] = [];
  try {
    for (let i = 0; i < s.length; i += 1) {
      const cle = s.key(i);
      if (!cle?.startsWith(PREFIXE_BROUILLON)) continue;
      const v = JSON.parse(s.getItem(cle) ?? 'null') as BrouillonKogon | null;
      if (v && typeof v.client_id === 'string') r.push(v);
    }
  } catch { return r; }
  return r.sort((a, b) => b.modifie_le.localeCompare(a.modifie_le));
};

export const enregistrerBrouillon = (b: BrouillonKogon, s: Stockage | null = stockageParDefaut()): boolean => {
  if (!s) return false;
  try { s.setItem(PREFIXE_BROUILLON + b.client_id, JSON.stringify(b)); return true; } catch { return false; }
};

export const supprimerBrouillon = (clientId: string, s: Stockage | null = stockageParDefaut()) => {
  try { s?.removeItem(PREFIXE_BROUILLON + clientId); } catch { /* stockage indisponible : rien a retirer */ }
};

/** Donnees envoyees a saisir_releve_terrain_kogon (vides retires, jamais completes) ; leve une erreur si l'heure est illisible. */
export const donneesReleveKogon = (champs: Record<string, string>, anomalie: boolean): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(champs)) {
    const t = v.trim();
    if (!t) continue;
    d[k] = ['brut', 'tare', 'net', 'latitude', 'longitude', 'precision_m'].includes(k) ? t.replace(',', '.') : t;
  }
  if (d.heure_pesee_observee) {
    const h = new Date(String(d.heure_pesee_observee));
    if (Number.isNaN(h.getTime())) throw new Error('Heure de pesée observée illisible');
    d.heure_pesee_observee = h.toISOString();
  }
  d.anomalie_signalee = anomalie;
  if (!anomalie) delete d.anomalie_texte;
  return d;
};

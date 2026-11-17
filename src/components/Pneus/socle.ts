import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ecrireRoute } from '../ui/routeur';
import type { TeintePuce } from '../ui/Panneau';
import { MOTIF_ANNULATION_RECEPTION, type EtatPneu } from './pneus';

// Ecran Pneus au standard des pages (D-090) sur le serveur D-091
// (migration 20261121230000_pneus_cycle_de_vie). Lecture des vues v_pneus_*,
// ecriture par les fonctions serveur seulement ; aucune regle metier
// recalculee ici : alertes lues dans `alerts` (catalogue D-068), couts et
// indicateurs lus dans les vues (« donnees insuffisantes » quand NULL).

export const VUE_PNEUS = 'tires';
export const MODULE_PNEUS = 'Pneus';

export const ESPACES_PNEUS = [
  ['tableau', 'Tableau de bord'],
  ['registre', 'Registre'],
  ['montage', 'Montage et positions'],
  ['inspections', 'Inspections'],
  ['maintenance', 'Maintenance pneumatique'],
  ['stocks', 'Stocks et mouvements'],
  ['anomalies', 'Anomalies et sécurité'],
  ['performance', 'Performance et durée de vie'],
  ['couts', 'Coûts et budget'],
  ['parametrage', 'Paramétrage'],
] as const;
export type EspacePneus = (typeof ESPACES_PNEUS)[number][0];
export const estEspace = (v: string | undefined): v is EspacePneus => ESPACES_PNEUS.some(([e]) => e === v);

export const routeEspace = (espace: EspacePneus, filtres: Record<string, string> = {}) =>
  ecrireRoute({ vue: VUE_PNEUS, mode: 'liste', requete: { espace, ...filtres } });

/** Route d'une action ; `requete` preremplit la page (engin, position...). */
export const routeActionPneu = (id: string, action: string, requete: Record<string, string> = {}) =>
  ecrireRoute({ vue: VUE_PNEUS, mode: 'action', id, action, requete });

export const routeSaisie = (objet: 'carcasse' | 'configuration' | 'seuils' | 'critere', requete: Record<string, string> = {}) =>
  ecrireRoute({ vue: VUE_PNEUS, mode: 'nouveau', requete: objet === 'carcasse' ? requete : { objet, ...requete } });

// Identifiants de route autres qu'un pneu : engin-<id> (schema de l'engin),
// configuration-<id>, seuils-<id> (parametrage).
export const PREFIXES_ROUTE = ['engin', 'configuration', 'seuils'] as const;
export type PrefixeRoute = (typeof PREFIXES_ROUTE)[number];
export const lireIdRoute = (id: string): { prefixe: PrefixeRoute | null; id: string } => {
  const p = PREFIXES_ROUTE.find((x) => id.startsWith(`${x}-`));
  return p ? { prefixe: p, id: id.slice(p.length + 1) } : { prefixe: null, id };
};

// ---------------------------------------------------------------- droits

type Permission = (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'approve') => boolean;

/** Droits d'affichage (le serveur reste seul juge, SIGTB_TIRES_PERMISSIONS.md). */
export const droitsPneus = (hasPermission: Permission, role: string | undefined) => {
  const admin = role === 'admin';
  const ecritureMaintenance = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  return {
    ecriture: admin || ecritureMaintenance || hasPermission('vehicles', 'create') || hasPermission('vehicles', 'edit'),
    decisionImmobilisation: admin || ecritureMaintenance,
    approbation: admin || hasPermission('maintenance', 'approve'),
    parametrage: admin || hasPermission('maintenance', 'approve'),
  };
};
export type DroitsPneus = ReturnType<typeof droitsPneus>;

// ---------------------------------------------------------------- lignes

export interface PneuLigne {
  id: string; tire_number: string; code_sigtb: string; numero_serie: string | null; sans_numero_serie: boolean;
  brand: string | null; model: string | null; dimension: string | null; status: EtatPneu;
  vehicle_id: string | null; position: string | null; site_id: string | null; fournisseur_id: string | null;
  purchase_date: string | null; purchase_price: number | null; retread_count: number | null; max_retreads: number | null;
  installation_date: string | null; last_inspection_date: string | null; notes: string | null;
  nb_montages: number; km_parcourus: number | null; km_incomplet: boolean; cout_total: number | null; cout_km: number | null;
  derniere_profondeur_mm: number | null; profondeur_mesuree_le: string | null; application: string | null;
  construction: string | null; profondeur_initiale_mm: number | null; garantie_mois: number | null; garantie_km: number | null;
  configuration_id: string | null;
}

export interface Intervention {
  id: string; numero: string; tire_id: string; type: string; type_autre: string | null; cycle_rechapage: number | null;
  prestataire: string; fournisseur_id: string | null; criteres: Record<string, boolean> | null;
  envoye_le: string; envoye_par: string | null; retour_le: string | null; retour_par: string | null; cout: number | null;
  bon_commande_id: string | null; facture_reference: string | null; garantie_mois: number | null; garantie_km: number | null;
  profondeur_retour_mm: number | null; constats: string | null; controle_resultat: string | null; controle_note: string | null;
  controle_par: string | null; controle_le: string | null; decision: string | null; decision_motif: string | null;
  decide_par: string | null; decide_le: string | null; statut: string; motif_annulation: string | null;
}

export interface Inspection {
  id: string; operation_id: string; tire_id: string; nature: string; inspecte_le: string; mesures: Record<string, number> | null;
  profondeur_min_mm: number | null; ecart_mm: number | null; pression_bar: number | null; temperature_c: number | null;
  constats: { code: string; gravite: string; description?: string }[] | null; defaut_critique: boolean;
  recommandation: string | null; inspecteur: string | null; saisi_le: string;
}

export interface Proposition {
  id: string; vehicle_id: string; tire_id: string; operation_id: string | null; motif: string; propose_le: string;
  propose_par: string | null; statut: string; decide_par: string | null; decide_le: string | null;
  motif_decision: string | null; immobilisation_id: string | null;
}

export interface AlertePneu {
  id: string; regle: string; severity: string; title: string; message: string | null; reference_type: string;
  reference_id: string; vehicle_id: string | null; survenu_le: string | null; created_at: string;
  /** Pneu concerne, resolu depuis la reference (pneu, operation ou inspection). */
  tire_id: string | null;
}

export const COLONNES_INTERVENTION = 'id, numero, tire_id, type, type_autre, cycle_rechapage, prestataire, fournisseur_id, criteres, envoye_le, envoye_par, retour_le, retour_par, cout, bon_commande_id, facture_reference, garantie_mois, garantie_km, profondeur_retour_mm, constats, controle_resultat, controle_note, controle_par, controle_le, decision, decision_motif, decide_par, decide_le, statut, motif_annulation';

export const STATUTS_INTERVENTION: Record<string, { texte: string; teinte: TeintePuce }> = {
  envoyee: { texte: 'Chez le prestataire', teinte: 'orange' },
  retournee: { texte: 'Retournée, à contrôler', teinte: 'bleu' },
  controlee: { texte: 'Contrôlée, à décider', teinte: 'violet' },
  cloturee: { texte: 'Clôturée', teinte: 'vert' },
  annulee: { texte: 'Annulée', teinte: 'gris' },
};
export const TYPES_INTERVENTION: Record<string, string> = {
  reparation: 'Réparation', vulcanisation: 'Vulcanisation', rechapage: 'Rechapage', expertise: 'Expertise', autre: 'Autre',
};
export const DECISIONS_REMISE: Record<string, string> = {
  remis_en_service: 'Remise en service', reforme: 'Réforme', a_reprendre: 'À reprendre',
};
export const NATURES_INSPECTION: Record<string, string> = {
  mesure: 'Mesure', observation: 'Observation', declaration: 'Déclaration (ex. chauffeur)', import: 'Import',
};
export const RECOMMANDATIONS: Record<string, string> = {
  aucune: 'Aucune', surveiller: 'Surveiller', permuter: 'Permuter', demonter: 'Démonter', reparer: 'Réparer',
  rechaper: 'Rechaper', reformer: 'Réformer', immobiliser: 'Immobiliser',
};
export const STATUTS_PROPOSITION: Record<string, { texte: string; teinte: TeintePuce }> = {
  proposee: { texte: 'À décider', teinte: 'orange' }, acceptee: { texte: 'Acceptée', teinte: 'rouge' }, refusee: { texte: 'Refusée', teinte: 'gris' },
};
export const MOUVEMENTS: Record<string, string> = {
  reception: 'Réception (achat)', entree: 'Entrée en stock', montage: 'Montage', demontage: 'Démontage', permutation: 'Permutation',
  transfert: 'Transfert', envoi_rechapage: 'Envoi au rechapage', envoi_reparation: 'Envoi en réparation',
  retour_rechapage: 'Retour de rechapage', retour_reparation: 'Retour de réparation', rechapage: 'Rechapage', reparation: 'Réparation',
  remise_en_service: 'Remise en service', reforme: 'Réforme', correction: 'Correction (annulation)',
};
export const CATEGORIES_COUT: Record<string, string> = {
  acquisition: 'Acquisition', reparation: 'Réparation', rechapage: 'Rechapage', prestations: 'Prestations', autres: 'Autres',
};

// ---------------------------------------------------------------- formats

export const nombre = (v: number | null | undefined, unite = '', dec = 2) =>
  v === null || v === undefined ? null : `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: dec })}${unite ? ` ${unite}` : ''}`;
export const gnf = (v: number | null | undefined) => nombre(v, 'GNF', 0);
export const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('fr-FR') : null);
export const dateHeure = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('fr-FR') : null);
/** Indicateur calcule par le serveur : NULL = « Données insuffisantes ». */
export const indicateur = (v: number | null | undefined, unite: string) => nombre(v, unite) ?? 'Données insuffisantes';

// ---------------------------------------------------------------- saisie

/** Nombre saisi : vide = undefined (absent), illisible = NaN (refuse a la validation). */
export const lireNombre = (s: string): number | undefined => {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  return t === '' ? undefined : Number(t);
};
export const nombreInvalide = (s: string) => { const n = lireNombre(s); return n !== undefined && !Number.isFinite(n); };
/** Date et heure locales -> ISO ; vide = undefined (le serveur prend maintenant). */
export const lireDate = (s: string): string | undefined => (s.trim() ? new Date(s).toISOString() : undefined);
export const texte = (s: string) => (s.trim() === '' ? undefined : s.trim());

/** Appel d'une fonction serveur ; renvoie le message d'erreur ou null. Les arguments absents sont omis (valeur par defaut du serveur). */
export const appeler = async (fonction: string, args: Record<string, unknown>): Promise<string | null> => {
  const { error } = await supabase.rpc(fonction, Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined)));
  return error ? error.message : null;
};

/** Cle d'idempotence d'une saisie (rejouee sans doublon par pneu_requete_rejouee). */
export const nouvelleCle = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${performance.now()}`);

// ---------------------------------------------------------------- lectures

export interface EtatLecture<T> { lignes: T[] | null; erreur: string; recharger: () => void }

/** Lecture d'une requete ; une lecture refusee n'est jamais une liste vide. */
export const useLecture = <T,>(
  fabrique: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  quoi: string,
  cles: unknown[] = [],
): EtatLecture<T> => {
  const [lignes, setLignes] = useState<T[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [version, setVersion] = useState(0);
  // fabrique est recree a chaque rendu : les dependances sont `cles`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const f = useCallback(fabrique, cles);
  useEffect(() => {
    let actif = true;
    setLignes(null);
    Promise.resolve(f()).then(({ data, error }) => {
      if (!actif) return;
      if (error) { setErreur(`Lecture impossible (${quoi}) : ${error.message}`); setLignes(null); return; }
      setErreur('');
      setLignes((Array.isArray(data) ? data : data ? [data] : []) as T[]);
    });
    return () => { actif = false; };
  }, [f, quoi, version]);
  return { lignes, erreur, recharger: () => setVersion((v) => v + 1) };
};

/**
 * Alertes actives de l'ecran Pneus (catalogue D-068, regles serveur D-091),
 * avec le pneu resolu depuis la reference (pneu, operation ou inspection).
 */
export const lireAlertesPneus = async (): Promise<{ lignes: AlertePneu[] | null; erreur: string }> => {
  await supabase.rpc('actualiser_alertes');
  const { data, error } = await supabase.from('alerts')
    .select('id, regle, severity, title, message, reference_type, reference_id, vehicle_id, survenu_le, created_at')
    .eq('ecran', 'tires').in('status', ['active', 'acknowledged']).order('created_at', { ascending: false }).limit(500);
  if (error) return { lignes: null, erreur: `Lecture impossible (alertes) : ${error.message}` };
  const brutes = (data ?? []) as Omit<AlertePneu, 'tire_id'>[];
  const ops = brutes.filter((a) => a.reference_type === 'pneu_operation').map((a) => a.reference_id);
  const insp = brutes.filter((a) => a.reference_type === 'pneu_inspection').map((a) => a.reference_id);
  const [o, i] = await Promise.all([
    ops.length ? supabase.from('pneus_operations').select('id, tire_id').in('id', ops) : Promise.resolve({ data: [], error: null }),
    insp.length ? supabase.from('pneus_inspections').select('id, tire_id').in('id', insp) : Promise.resolve({ data: [], error: null }),
  ]);
  const carte = new Map<string, string>();
  [...((o.data ?? []) as { id: string; tire_id: string }[]), ...((i.data ?? []) as { id: string; tire_id: string }[])]
    .forEach((x) => carte.set(x.id, x.tire_id));
  return {
    lignes: brutes.map((a) => ({ ...a, tire_id: a.reference_type === 'tire' ? a.reference_id : carte.get(a.reference_id) ?? null })),
    erreur: o.error || i.error ? 'Lecture partielle : le pneu de certaines alertes n\'a pas pu être retrouvé.' : '',
  };
};

export const TEINTE_GRAVITE: Record<string, TeintePuce> = { critical: 'rouge', warning: 'orange', info: 'bleu' };
export const LIBELLE_GRAVITE: Record<string, string> = { critical: 'Critique', warning: 'Avertissement', info: 'Information' };

/** Recherche d'un pneu par code SIGTB, numero de serie ou numero saisi (douchette code-barres). */
export const correspondPneu = (p: Pick<PneuLigne, 'code_sigtb' | 'numero_serie' | 'tire_number'>, saisie: string) => {
  const s = saisie.trim().toUpperCase();
  return s !== '' && [p.code_sigtb, p.numero_serie, p.tire_number].some((v) => (v ?? '').trim().toUpperCase() === s);
};

export const NATURES_EPISODE: Record<string, string> = { neuf: 'Neuf', apres_rechapage: 'Après rechapage', apres_reparation: 'Après réparation', apres_controle: 'Après contrôle' };

export const CHAMPS_SEUILS: [string, string, string][] = [
  ['profondeur_min_mm', 'Profondeur minimale', 'mm'], ['ecart_usure_max_mm', 'Écart d\'usure maximal', 'mm'],
  ['degradation_max_mm_1000km', 'Dégradation maximale', 'mm/1000 km'], ['pression_min_bar', 'Pression minimale', 'bar'],
  ['pression_max_bar', 'Pression maximale', 'bar'], ['inspection_max_jours', 'Délai maximal entre inspections', 'jours'],
  ['duree_max_jours', 'Durée de vie maximale', 'jours'], ['intervention_max_jours', 'Durée maximale d\'intervention', 'jours'],
  ['garantie_preavis_jours', 'Préavis de fin de garantie', 'jours'], ['cout_km_max', 'Coût au km anormal au-delà de', 'GNF/km'],
  ['mesures_min_projection', 'Mesures minimales pour une projection', 'mesures'], ['rechapages_max', 'Rechapages admis', 'rechapages'],
];

// ---------------------------------------------------------------- donnees communes

/** Registre des pneus avec libelles des engins et sites, annulations de reception, alertes et propositions. */
export const useRegistre = () => {
  const pneus = useLecture<PneuLigne>(() => supabase.from('v_pneus').select('*').order('code_sigtb'), 'registre des pneus');
  const engins = useLecture<{ id: string; registration: string; brand_model: string | null; site_id: string | null }>(
    () => supabase.from('vehicles').select('id, registration, brand_model, site_id').order('registration'), 'engins');
  const sites = useLecture<{ id: string; name: string }>(() => supabase.from('sites').select('id, name').order('name'), 'sites');
  const annules = useLecture<{ tire_id: string }>(
    () => supabase.from('pneus_operations').select('tire_id').eq('type', 'annulation').like('motif', `${MOTIF_ANNULATION_RECEPTION}%`),
    'annulations de réception');
  const propositions = useLecture<Proposition>(
    () => supabase.from('pneus_propositions_immobilisation').select('*').eq('statut', 'proposee'), 'propositions d\'immobilisation');
  const [alertes, setAlertes] = useState<AlertePneu[] | null>(null);
  const [erreurAlertes, setErreurAlertes] = useState('');
  useEffect(() => { lireAlertesPneus().then((r) => { setAlertes(r.lignes); setErreurAlertes(r.erreur); }); }, []);

  const nomEngin = useMemo(() => new Map((engins.lignes ?? []).map((v) => [v.id, v.registration])), [engins.lignes]);
  const nomSite = useMemo(() => new Map((sites.lignes ?? []).map((s) => [s.id, s.name])), [sites.lignes]);
  const annuleReception = useMemo(() => new Set((annules.lignes ?? []).map((a) => a.tire_id)), [annules.lignes]);
  const alertesParPneu = useMemo(() => {
    const m = new Map<string, AlertePneu[]>();
    (alertes ?? []).forEach((a) => { if (a.tire_id) m.set(a.tire_id, [...(m.get(a.tire_id) ?? []), a]); });
    return m;
  }, [alertes]);
  const proposes = useMemo(() => new Set((propositions.lignes ?? []).map((p) => p.tire_id)), [propositions.lignes]);
  const erreur = [pneus.erreur, engins.erreur, sites.erreur, annules.erreur, propositions.erreur, erreurAlertes].filter(Boolean).join(' ');
  return { pneus, engins, nomEngin, nomSite, annuleReception, alertes, alertesParPneu, proposes, erreur };
};


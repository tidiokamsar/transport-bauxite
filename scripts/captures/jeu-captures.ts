// Jeu de donnees FICTIVES propre aux captures des manuels (D-092 phase 3).
// Il ne sert qu'au script scripts/captures/captures-manuels.spec.ts et ne
// modifie ni e2e/api-simulee.ts ni les jeux des tests. Aucune donnee reelle :
// noms, immatriculations et montants sont inventes et marques « Exemple ».

export const ADMIN = '00000000-0000-4000-a000-0000000000a1';
export const MINE = '00000000-0000-4000-a000-0000000000b1';
export const DEPOT = '00000000-0000-4000-a000-0000000000b2';
export const SHIFT = '00000000-0000-4000-a000-0000000000d1';

const d = new Date();
export const JOUR = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const a = (h: number, m = 15) => { const x = new Date(); x.setHours(h, m, 0, 0); return x.toISOString(); };
const ilYaJours = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export type Jeu = Record<string, unknown[]>;

const voyage = (id: string, reference: string, etat: string, extra: Record<string, unknown> = {}) => ({
  id, reference, planned_date: JOUR, vehicle_id: 'v1', driver_id: 'c1', loader_vehicle_id: 'l1', departure_site_id: MINE, arrival_site_id: DEPOT,
  shift_id: SHIFT, etat, etat_modifie_le: a(7), status: 'planned', net_weight: null, load_weight: null, net_weight_reception: null, accepted_tonnage: null,
  actual_departure_time: null, actual_arrival_time: null, notes: null, km_start: 1000, km_end: 1042, shift_sequence: 1, estimated_distance_km: 40, ...extra,
});

const evt = (id: string, type: string, libelle: string, h: number, extra: Record<string, unknown> = {}) => ({
  id, trip_id: 't1', voyage_reference: 'VYG-EX-001', rotation: 1, type, libelle, date_operation: a(h), date_saisie: a(h, 20),
  source: 'dispatch', auteur: null, donnees: {}, justificatif: null, statut: 'declare', verification_id: null, corrige_ref: null, annule: false, table_source: 'exemple', ...extra,
});

const fiche = (id: string, numero: string, type: string, etat: string, extra: Record<string, unknown> = {}) => ({
  id, numero, type, date_fiche: JOUR, site_id: MINE, shift_id: SHIFT, vehicle_id: type === 'rotations' ? 'v1' : type === 'pointage_engins' ? 'l1' : null,
  driver_id: 'c1', stockage_id: type === 'carburant' ? 'cu1' : null, agent: 'Agent Exemple', options: { pesee: 'arrivee' },
  contenu: { voyages: [{ id: 't1', reference: 'VYG-EX-001' }] }, statut: 'preparee', etat, version: 3, nb_impressions: 1, brouillon: null,
  trip_id: null, prepare_le: a(5), remise_le: null, retournee_le: null, controle_le: null, nb_ecarts: null, ...extra,
});

const pneuBase = { brand: 'Marque Exemple', model: 'Modèle X', dimension: '315/80 R22.5', purchase_price: null, retread_count: 0, max_retreads: null, cout_total: null, sans_numero_serie: false };
const pneu = (id: string, code: string, status: string, extra: Record<string, unknown> = {}) => ({
  ...pneuBase, id, code_sigtb: code, tire_number: code, numero_serie: `SN-${code}`, status, vehicle_id: null, position: null, site_id: MINE,
  nb_montages: 0, km_parcourus: null, km_incomplet: false, cout_km: null, derniere_profondeur_mm: 16, profondeur_mesuree_le: ilYaJours(3), ...extra,
});

export const JEU_BASE: Jeu = {
  profiles: [{ id: ADMIN, role: 'admin', full_name: 'Utilisateur Exemple', status: 'active', site_id: null }],
  societe: [{ raison_sociale: 'Société exemple', rccm: null, nif: null, adresse: 'Adresse exemple' }],
  organisations: [{ id: 'o1', nom: 'Organisation exemple', type: 'interne', actif: true }],
  sites: [
    { id: MINE, name: 'Mine exemple', type: 'mine', status: 'active', is_active: true, organisation_id: 'o1' },
    { id: DEPOT, name: 'Dépôt exemple', type: 'depot', status: 'active', is_active: true, organisation_id: 'o1' },
  ],
  work_shifts: [
    { id: SHIFT, name: 'jour', display_name: 'Jour', start_time: '06:00:00', end_time: '18:00:00', shift_order: 1, is_active: true },
    { id: 's2', name: 'nuit', display_name: 'Nuit', start_time: '18:00:00', end_time: '06:00:00', shift_order: 2, is_active: true },
  ],
  vehicles: [
    { id: 'v1', registration: 'EX-1001', vehicle_type: 'tipper', status: 'active', site_id: MINE, brand_model: 'Benne exemple', capacity_tonnes: 40 },
    { id: 'v2', registration: 'EX-1002', vehicle_type: 'tipper', status: 'active', site_id: MINE, brand_model: 'Benne exemple', capacity_tonnes: 40 },
    { id: 'l1', registration: 'CHG-EX-01', vehicle_type: 'loader', status: 'active', site_id: MINE, brand_model: 'Chargeuse exemple' },
  ],
  v_vehicules: [
    { id: 'v1', registration: 'EX-1001', vehicle_type: 'tipper', status: 'active', brand_model: 'Benne exemple', year: 2022, capacity_tonnes: 40, site_id: MINE,
      propriete: 'loue', proprietaire: 'Loueur exemple', contrat_id: 'k2', contrat_reference: 'LOC-EX', statut_operationnel: 'disponible', statut_admin: null, voyage_en_cours: null },
    { id: 'v2', registration: 'EX-1002', vehicle_type: 'tipper', status: 'immobilized', brand_model: 'Benne exemple', year: 2021, capacity_tonnes: 40, site_id: MINE,
      propriete: 'loue', proprietaire: 'Loueur exemple', contrat_id: 'k2', contrat_reference: 'LOC-EX', statut_operationnel: 'immobilise', statut_admin: null, voyage_en_cours: null },
  ],
  drivers: [
    { id: 'c1', name: 'Chauffeur Exemple A', employee_id: 'MAT-EX-1', license_number: 'PC-EX-1', license_category: 'C', license_expiry: '2099-01-01', status: 'active', hire_date: '2024-01-01', contract_type: 'permanent', base_salary: 0 },
    { id: 'c2', name: 'Chauffeur Exemple B', employee_id: 'MAT-EX-2', license_number: 'PC-EX-2', license_category: 'C', license_expiry: '2099-01-01', status: 'active', hire_date: '2024-01-01', contract_type: 'permanent', base_salary: 0 },
  ],
  objectifs_production: [{ id: 'o1', date_plan: JOUR, site_id: MINE, shift_id: SHIFT, version: 1, tonnes_cible: 4000, voyages_cible: 100, camions_prevus: 20, chargeuses_prevues: 2, motif: null, note: null, cree_le: a(5) }],
  v_realisation_objectifs: [{ id: 'o1', date_plan: JOUR, site_id: MINE, shift_id: SHIFT, version: 1, tonnes_cible: 4000, voyages_cible: 100, camions_prevus: 20, chargeuses_prevues: 2,
    tonnes_cible_initial: 4000, tonnes_livrees: 1200, tonnes_acceptees: 0, voyages_livres: 30, voyages_sans_poids: 0, voyages_en_cours: 8, voyages_prevus: 62, derniere_livraison: a(9), cree_le: a(5) }],
  postes: [{ id: 'p1', date_poste: JOUR, shift_id: SHIFT, site_id: MINE, responsable_id: null, statut: 'en_cours', version: 2, consignes_recues: 'Piste nord à surveiller (exemple)',
    consignes_sortie: null, rapport: null, bilan: null, ouvert_le: a(6), cloture_le: null, valide_le: null }],
  postes_equipe: [{ id: 'm1', poste_id: 'p1', driver_id: 'c1', vehicle_id: 'v1', present: true, retard_minutes: null, motif_absence: null }],
  postes_evenements: [{ id: 'e1', poste_id: 'p1', type: 'arret', description: 'Arrêt chargeuse (exemple)', survenu_le: a(8), cree_le: a(8, 20) }],
  postes_journal: [], plans_shift: [], journal_shifts: [{ id: 'j1', shift_id: SHIFT, action: 'creation', motif: null, cree_le: ilYaJours(10), donnees: {} }],
  trips: [voyage('t1', 'VYG-EX-001', 'DELIVERED', { net_weight_reception: 40.5 }), voyage('t2', 'VYG-EX-002', 'PLANNED', { vehicle_id: null, driver_id: null }), voyage('t3', 'VYG-EX-003', 'IN_TRANSIT', { vehicle_id: 'v2', driver_id: 'c2', shift_sequence: 2 })],
  trip_events: [],
  v_journal_voyage: [
    evt('decision_dispatch:d1', 'affectation', 'affectation acceptee', 6, { statut: 'valide' }),
    evt('trip_event:e1', 'etat', 'ASSIGNED -> AT_LOADING', 7, { source: 'agent_kogon' }),
    evt('trip_event:e2', 'etat', 'LOADED -> IN_TRANSIT', 8, { source: 'agent_kogon', statut: 'verifie' }),
    evt('ticket_cbg:k1', 'ticket_cbg', 'Ticket CBG T-EX-1', 9, { source: 'agent_kogon', donnees: { ticket: 'T-EX-1', net: 40.5 } }),
  ],
  decisions_dispatch: [{ id: 'd1', trip_id: 't1', decision: 'acceptee', vehicle_id: 'v1', driver_id: 'c1', loader_vehicle_id: 'l1', motif: null, decide_le: a(6), recommandation: {} }],
  suspensions_voyage: [],
  fiches_terrain: [fiche('f1', 'FR-EX-001', 'rotations', 'retournee'), fiche('f2', 'FP-EX-001', 'pointage_engins', 'retournee'), fiche('f3', 'FC-EX-001', 'carburant', 'remise_agent')],
  fiches_rotations_lignes: [], fiches_carburant_lignes: [], v_fiches_ecarts_courants: [], fiches_journal: [], fiches_lots: [], fiches_remises: [], fiches_retours: [],
  stockages_carburant: [{ id: 'cu1', code: 'CUVE-EX', libelle: 'Cuve exemple', type: 'cuve_fixe', site_id: MINE, capacite_litres: 30000, seuil_alerte_litres: 5000, actif: true }],
  v_stocks_carburant: [{ id: 'cu1', code: 'CUVE-EX', libelle: 'Cuve exemple', type: 'cuve_fixe', site_id: MINE, capacite_litres: 30000, seuil_alerte_litres: 5000, actif: true,
    solde_litres: 12000, en_attente_litres: -300, mouvements_en_attente: 1, dernier_mouvement: a(8), dernier_inventaire: ilYaJours(2), dernier_ecart_inventaire: -40 }],
  mouvements_carburant: [{ id: 'mc1', numero: 1, stockage_id: 'cu1', type: 'distribution', variation: -300, date_mouvement: a(8), reference_piece: 'FC-EX-001-01', statut: 'a_valider', note: null, motif_decision: null, transfert_id: null, annule_mouvement_id: null }],
  releves_cbg: [{ id: 'r1', reference: 'CBG-REL-EX', periode_debut: JOUR, periode_fin: JOUR, site_id: null, statut: 'rapproche', importe_le: a(10), fichier_source: 'releve-exemple.csv',
    empreinte_sha256: 'a'.repeat(64), lignes_rejetees: [], motif_annulation: null, rapproche_pesees_le: a(10, 30) }],
  v_rapprochements_pesee_courants: [{ id: 'rp1', releve_id: 'r1', ligne_id: 'l1', releve_kogon_id: 'k1', trip_id: 't1', trips_candidats: [], site_id: DEPOT, ticket: 'T-EX-1',
    date_cbg: JOUR, immatriculation_cbg: 'EX-1001', net_cbg: 41.2, heure_kogon: a(9), immatriculation_kogon: 'EX-1001', net_kogon: 40.5, ecart_t: 0.7, ecart_pct: 1.7,
    source_tolerance: 'non_parametree', classes: ['ecart_poids'], detail: 'Net CBG 41,2 t, relevé KOGON 40,5 t (exemple)', passe_numero: 1, passe_le: a(10, 30) }],
  anomalies_pesee: [{ id: 'a1', releve_id: 'r1', trip_id: 't1', site_id: DEPOT, categorie: 'ecart_poids', gravite: 'haute', description: 'Écart de 0,7 t (exemple)',
    sources: ['cbg', 'kogon'], valeurs: {}, responsable_id: null, statut: 'ouverte', decision: null, commentaire: null, preuve_ref: null, soumis_par: null, cree_le: a(10, 30) }],
  v_tickets_pesee_cbg_effectifs: [{ id: 'k1', trip_id: 't1', numero: 'T-EX-1', brut: 62.4, tare: 21.9, net: 40.5, pese_le: a(9) }],
  v_voyages_livres_sans_ticket: [{ trip_id: 't3', reference: 'VYG-EX-003', planned_date: JOUR, vehicle_id: 'v2', livre_le: a(10) }],
  contrats: [
    { id: 'k1', reference: 'CLI-EX-01', intitule: 'Contrat client exemple', nature: 'client', contrepartie: 'Client exemple', devise: 'USD', date_debut: '2026-01-01', date_fin: null, statut: 'actif', delai_paiement_jours: 30 },
    { id: 'k2', reference: 'LOC-EX', intitule: 'Contrat de location exemple', nature: 'loueur', contrepartie: 'Loueur exemple', devise: 'USD', date_debut: '2026-01-01', date_fin: null, statut: 'actif', delai_paiement_jours: 30 },
  ],
  reconciliations: [{ id: 'r1', contrat_id: 'k1', periode_debut: '2026-10-01', periode_fin: '2026-10-31', base_tonnage: 'accepte', tolerance_ecart_pct: 2, statut: 'ouverte',
    tonnage_facturable: null, voyages_facturables: null, ouverte_le: ilYaJours(5), actualisee_le: null, cloturee_le: null }],
  factures: [{ id: 'fa1', numero: null, type: 'facture', contrat_id: 'k1', reconciliation_id: 'r1', facture_origine_id: null, objet: 'Transport exemple', devise: 'USD', taux_taxe_pct: 18,
    montant_ht: 1000, montant_taxe: 180, montant_ttc: 1180, statut: 'a_signer', date_emission: null, date_echeance: null, prepare_le: ilYaJours(1), signee_le: null, prepare_par: 'autre', motif: null }],
  facture_lignes: [{ id: 'fl1', facture_id: 'fa1', libelle: 'Transport mine - dépôt (exemple)', quantite: 200, unite: 'tonne', prix_unitaire: 5, montant: 1000, ordre: 0 }],
  v_pneus: [
    pneu('p1', 'PN-000001', 'stored'),
    pneu('p2', 'PN-000002', 'active', { vehicle_id: 'v1', position: 'AV G', site_id: null, nb_montages: 1, km_parcourus: 12000, derniere_profondeur_mm: 4 }),
    pneu('p3', 'PN-000003', 'damaged', { derniere_profondeur_mm: 6 }),
  ],
  tires: [pneu('p1', 'PN-000001', 'stored'), pneu('p2', 'PN-000002', 'active', { vehicle_id: 'v1', position: 'AV G' })],
  pneus_operations: [{ id: 'po1', tire_id: 'p2', type: 'montage', effectue_le: ilYaJours(30), saisi_le: ilYaJours(30), vehicle_id: 'v1', position: 'AV G', site_id: MINE, compteur_km: 1000, profondeur_mm: 16, annule_operation_id: null }],
  pneus_inspections: [{ id: 'pi1', tire_id: 'p2', inspecte_le: ilYaJours(3), nature: 'periodique', profondeur_min_mm: 4, ecart_mm: 0.5, pression_bar: 8.2, defaut_critique: false, recommandation: 'surveiller', mesures: { centre: 4 }, constats: [] }],
  pneus_interventions: [], pneus_propositions_immobilisation: [], v_pneus_episodes: [], v_pneus_montages: [], v_pneus_mouvements: [],
  pneus_configurations: [], pneus_configuration_positions: [], pneus_seuils: [], pneus_criteres_rechapage: [], pneus_parametres_journal: [],
  alerts: [{ id: 'al1', title: 'Document à renouveler (exemple)', message: 'Visite technique EX-1002', severity: 'warning', status: 'active', created_at: ilYaJours(1), regle: 'document_echeance', objet_type: 'vehicle', objet_id: 'v2' }],
  incidents: [], pieces_jointes: [], notifications: [], role_permissions: [], droits_utilisateur: [],
};

/** Jeu d'une capture : base plus surcharges propres a la figure. */
export const jeuPour = (surcharges: Jeu = {}): Jeu => ({ ...JEU_BASE, ...surcharges });

export const FICHE = fiche;

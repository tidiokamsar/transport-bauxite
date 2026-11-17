// Centre d'aide (D-092 phase 3) : vue courante -> page du guide dans
// public/aide/, generee par scripts/generer_aide.py depuis les manuels.
// Une vue absente de la table ouvre l'index (recherche, FAQ, glossaire).

const PAGES: Record<string, string> = {
  dashboard: 'tableau-de-bord', 'centre-pilotage': 'tableau-de-bord', 'mes-validations': 'validations', notifications: 'validations',
  alerts: 'decisions', sites: 'sites', infrastructures: 'sites', shifts: 'shifts', planification: 'planification', postes: 'postes',
  dispatch: 'dispatch', trips: 'voyages', kilometrage: 'kilometrage', fiches: 'fiches', 'tickets-cbg': 'pesee-cbg',
  operations: 'operations-transport', 'operations-journal': 'operations-transport', 'operations-anomalies': 'operations-transport',
  'operations-controles': 'operations-transport', vehicles: 'vehicules', drivers: 'chauffeurs', habilitations: 'chauffeurs',
  documents: 'documents', fuel: 'carburant', 'livraisons-cbg': 'carburant', 'fuel-stocks': 'carburant', 'fuel-dashboard': 'carburant',
  'fuel-anomalies': 'carburant', 'fuel-sensors': 'carburant', immobilisations: 'maintenance', 'interventions-loueur': 'maintenance',
  maintenance: 'maintenance', preventive: 'maintenance', tires: 'pneus', stock: 'stocks', purchases: 'achats', suppliers: 'fournisseurs',
  'moyens-generaux': 'moyens-generaux', 'mon-poste': 'contrats', contrats: 'contrats', engagements: 'contrats', comites: 'contrats',
  'factures-neemba': 'contrats', 'evaluation-loueur': 'contrats', reconciliation: 'facturation', invoices: 'facturation',
  recouvrement: 'facturation', paiements: 'finance', budgets: 'finance', costs: 'finance', 'controles-depart': 'hse', incidents: 'hse',
  'hse-prevention': 'hse', 'hr-employees': 'rh', 'hr-attendance': 'rh', 'hr-payroll': 'rh', reports: 'reporting',
  'tco-analysis': 'reporting', 'fleet-health': 'reporting', 'predictive-maintenance': 'reporting', 'driver-behavior': 'reporting',
  'gps-tracking': 'gps-capteurs', 'fleet-intelligence': 'gps-capteurs', 'route-history': 'gps-capteurs', geofencing: 'gps-capteurs',
  'iot-dashboard': 'gps-capteurs', 'esg-tracking': 'gps-capteurs', settings: 'parametres', 'securite-compte': 'acces',
};

const BASE = `${import.meta.env.BASE_URL ?? '/'}aide/`;

/** Adresse du guide du module affiche (index si la vue n'a pas de guide). */
export const adresseAide = (vue: string): string => `${BASE}${PAGES[vue] ?? 'index'}.html`;

/** Pages communes du centre d'aide. */
export const LIENS_AIDE: { libelle: string; page: string }[] = [
  { libelle: 'Rechercher dans la documentation', page: 'index' },
  { libelle: 'Questions fréquentes', page: 'faq' },
  { libelle: 'Glossaire', page: 'glossaire' },
  { libelle: 'Circuits opérationnels', page: 'circuits' },
  { libelle: 'Prise en main autonome', page: 'prise-en-main' },
].map((l) => ({ ...l, page: `${BASE}${l.page}.html` }));

export const aGuide = (vue: string): boolean => vue in PAGES;

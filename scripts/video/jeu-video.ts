// Reponses FICTIVES des fonctions serveur (RPC) pour la video de
// presentation uniquement. Le mock des tests (e2e/api-simulee.ts) n'est pas
// modifie : ces reponses s'ajoutent par une route propre a la video. Valeurs
// d'exemple coherentes avec scripts/captures/jeu-captures.ts (objectif
// 4 000 t, 1 200 t livrees, 30 voyages) ; aucune n'est une donnee reelle.
import type { Page } from '@playwright/test';
import { simulerApi } from '../../e2e/api-simulee.ts';
import { JOUR, type Jeu } from '../captures/jeu-captures.ts';

const maintenant = new Date().toISOString();
const SOURCE = 'exemple (démonstration)';

const pilotage = (domaine: string, code: string, libelle: string, valeur: number, unite: string) => ({
  domaine, code, libelle, valeur, unite, source: SOURCE, fiabilite: 'mesure', detail: null,
  periode_debut: JOUR, periode_fin: JOUR, calcule_le: maintenant, nature: 'periode',
});

const INDICATEURS_PILOTAGE = [
  pilotage('Production', 'tonnes_livrees', 'Tonnes livrées', 1200, 't'),
  pilotage('Production', 'voyages_livres', 'Voyages livrés', 30, 'voyages'),
  pilotage('Production', 'tonnes_acceptees', 'Tonnes acceptées CBG', 1160, 't'),
  pilotage('Flotte', 'engins_actifs', 'Engins actifs', 22, 'engins'),
  pilotage('Flotte', 'immobilisations_ouvertes', 'Immobilisations ouvertes', 1, 'engins'),
  pilotage('Carburant', 'litres_distribues', 'Litres distribués', 5400, 'L'),
  pilotage('Carburant', 'litres_par_tonne', 'Litres par tonne', 4.5, 'L/t'),
  pilotage('Pesée', 'anomalies_pesee_ouvertes', 'Anomalies de pesée ouvertes', 1, 'anomalies'),
  pilotage('Facturation', 'factures_a_signer', 'Factures à signer', 1, 'factures'),
];

const dispatch = (code: string, libelle: string, valeur: number, unite: string, filtre = 'tous') => ({
  code, libelle, valeur, unite, source: SOURCE, filtre, calcule_le: maintenant,
});

const INDICATEURS_DISPATCH = [
  dispatch('voyages_planifies', 'Planifiés', 62, 'voyages'), dispatch('voyages_crees', 'Créés', 46, 'voyages'),
  dispatch('voyages_a_affecter', 'À affecter', 1, 'voyages'), dispatch('voyages_affectes', 'Affectés', 7, 'voyages'),
  dispatch('voyages_engages', 'Engagés', 5, 'voyages'), dispatch('voyages_en_cours', 'En cours', 8, 'voyages'),
  dispatch('voyages_termines', 'Terminés', 30, 'voyages'), dispatch('voyages_suspendus', 'Suspendus', 0, 'voyages'),
  dispatch('voyages_annules', 'Annulés', 0, 'voyages'), dispatch('voyages_a_reaffecter', 'À réaffecter', 0, 'voyages'),
  dispatch('anomalies', 'Anomalies', 1, 'anomalies'),
  dispatch('camions_disponibles', 'Camions disponibles', 12, 'camions'), dispatch('camions_en_mission', 'En mission', 8, 'camions'),
  dispatch('camions_en_attente', 'En attente', 2, 'camions'), dispatch('camions_immobilises', 'Immobilisés', 1, 'camions'),
  dispatch('camions_liberes', 'Libérés', 3, 'camions'), dispatch('chauffeurs_disponibles', 'Chauffeurs disponibles', 14, 'chauffeurs'),
  dispatch('chargement_disponible', 'Chargeuses disponibles', 2, 'chargeuses'),
  dispatch('tonnes_planifiees', 'Tonnes planifiées', 4000, 't'), dispatch('tonnes_transportees', 'Tonnes transportées', 1200, 't'),
  dispatch('tonnes_validees', 'Tonnes validées', 1160, 't'), dispatch('cycle_moyen', 'Cycle moyen', 74, 'min'),
  dispatch('attente_chargement', 'Attente chargement', 9, 'min'), dispatch('attente_depot', 'Attente dépôt', 6, 'min'),
];

const MES_VALIDATIONS = [
  { categorie: 'Fiches terrain', objet: 'fiche', reference: 'FR-EX-001', detail: 'Fiche de rotations à contrôler (1 écart)', depuis: maintenant, ecran: 'fiches' },
  { categorie: 'Pesée CBG', objet: 'anomalie', reference: 'T-EX-1', detail: 'Écart de poids de 0,7 t à conclure', depuis: maintenant, ecran: 'tickets-cbg' },
  { categorie: 'Carburant', objet: 'mouvement', reference: 'FC-EX-001-01', detail: 'Distribution de 300 L à valider', depuis: maintenant, ecran: 'fuel-stocks' },
  { categorie: 'Facturation', objet: 'facture', reference: 'Facture (brouillon)', detail: 'Facture de 1 180 USD à signer', depuis: maintenant, ecran: 'invoices' },
];

export const RPC_VIDEO: Jeu = {
  indicateurs_pilotage: INDICATEURS_PILOTAGE,
  indicateurs_dispatch: INDICATEURS_DISPATCH,
  mes_validations: MES_VALIDATIONS,
};

/** API simulee des tests, plus les reponses RPC fictives de la video. */
export const simulerApiVideo = async (page: Page, jeu: Jeu) => {
  await simulerApi(page, jeu);
  // Enregistree apres : prioritaire sur la route generique pour les RPC.
  await page.route('**/rest/v1/rpc/**', (route) => {
    const nom = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    const corps = RPC_VIDEO[nom] ?? [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });
};

# SIGTB : matrice de couverture des 26 modules

**État au 2026-11-15.** Références : production `feda997` (= `main`, toutes migrations appliquées jusqu'à `20261114130000`, vérifié sur le serveur le 2026-11-15), mandat global du 2026-11-15, CDC 2.0, décisions D-001 à D-041.

Ce document est la cartographie fonctionnelle de référence. Il ne remplace pas les audits du 2026-11-12 ([technique](SIGTB_AUDIT_TECHNIQUE.md), [fonctionnel](SIGTB_AUDIT_FONCTIONNEL.md), [écarts](SIGTB_ECARTS_ET_PRIORITES.md)) ; il les met à jour et les étend aux 26 modules. L'avancement par lot reste suivi dans [SIGTB_2.0_PROGRESS.md](SIGTB_2.0_PROGRESS.md) et l'ordre d'exécution dans [SIGTB_MASTER_EXECUTION_PLAN.md](SIGTB_MASTER_EXECUTION_PLAN.md).

## Statuts et preuves

| Statut | Signification | Preuve exigée |
|---|---|---|
| DÉPLOYÉ | Code et migration en production, tests automatisés verts | Migration présente sur le serveur, pgTAP et E2E |
| VALIDÉ | Scénario métier rejoué avec les acteurs | PV de recette (aucun à ce jour) |
| À TESTER | Code fusionné ou en branche, tests incomplets | Branche, PR |
| EXISTANT | Écran et tables réels, fonctionnement correct mais non confronté au catalogue | Lecture du code |
| EXISTANT À AMÉLIORER | Fonctionne, mais incomplet face au catalogue | Écart nommé |
| PARTIEL | Une partie seulement du processus existe | Écart nommé |
| À CORRIGER | Défaut constaté (colonnes inexistantes, écriture qui échoue, bouton sans action) | Fichier:ligne |
| NON CONFORME | Contredit une règle non négociable (donnée inventée, solde modifiable, suppression d'un enregistrement financier, absence de contrôle serveur) | Fichier:ligne |
| MANQUANT | Rien dans le code ni le schéma | - |

Aucune ligne n'est VALIDÉ : aucun PV de recette n'a été fourni. « DÉPLOYÉ » ne signifie pas « utilisable en exploitation » (rôles, données réelles, formation).

Priorités du mandat : **P0** sécurité, intégrité, risque critique ; **P1** fonctionnement opérationnel essentiel ; **P2** gestion, administration, automatisation, pilotage ; **P3** intelligence avancée, optimisation, innovation.

## Constats transverses (audit des écrans hérités de Bolt, 2026-11-15)

1. **Colonnes inexistantes.** Les noms de tables appelés par le navigateur existent tous, mais de nombreux écrans hérités envoient ou filtrent des colonnes absentes. PostgREST refuse ces appels et beaucoup d'écrans ignorent l'erreur : l'écran paraît vide ou l'enregistrement échoue sans message. Écrans touchés : Stocks, Achats, Fournisseurs, Pneus, Incidents, Maintenance préventive, Coûts, Rapports, Sites, Alertes, Recherche globale, RH (employés).
2. **Écritures directes depuis le navigateur.** Tous les écrans hérités écrivent directement dans les tables, sans fonction serveur ni transaction. Plusieurs suppriment des enregistrements métier (`purchase_orders`, `tires`, `payroll_records`, `employee_attendance`, `maintenance_orders`, `maintenance_schedules`, `geofence_zones`, `sites`, `drivers`, `alerts`).
3. **Trois régimes RLS.** (A) Politiques par module `lecture_module` / `ecriture_module` (D-012). (B) Politique d'écriture seule, sans lecture : seuls les rédacteurs du module lisent. (C) RLS active sans aucune politique : tout appel est refusé, administrateur compris (`tire_*` opérations, `smart_notifications`, `geofence_*`, `iot_*` hors carburant, `trip_waypoints`, `trip_route_tracking`, `quick_actions_log`, `waste_management`).
4. **Aucun stockage de fichiers.** Pas de `supabase.storage`, aucun `input type=file`, aucun bucket : pièces jointes, justificatifs CBG et GED impossibles en l'état.
5. **Exports.** `src/lib/exports.ts` (CSV, impression PDF par fenêtre HTML ; « Excel » = CSV). Pas de bibliothèque xlsx ou PDF. Utilisé par les écrans repris ; plusieurs écrans hérités ont des boutons Exporter sans action.
6. **Notifications.** Quatre tables sans chaîne : `notifications` (aucun lecteur ni écrivain), `smart_notifications` (régime C), `alert_notifications` (écrite par une fonction jamais lue), `geofence_alerts` (fonction Edge seulement).
7. **Hors ligne.** `src/lib/offline.ts` n'est appelé par aucun écran : la file est toujours vide.

## Matrice par module

Légende des colonnes : **Fonctionnalité** (sous-module), **Écran / fichiers**, **Données et serveur** (tables, RPC, politiques), **Statut**, **P** (priorité), **Travaux**.

### 01. Command Center

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Tableau de bord exploitation | `Dashboard/*` (menu `dashboard`) | `vehicles`, `trips`, `v_realisation_objectifs`, `fuel_transactions`, `alerts`, `vehicle_tracking`, `work_shifts` (lecture) | EXISTANT À AMÉLIORER | P2 | Métadonnées source / période / fraîcheur par KPI (règle 5 CLAUDE.md) ; centraliser les KPI en vues SQL |
| Tableau de bord du chargé de contrats | `Contrats/MonPosteView` | `indicateurs_charge_contrats()` | DÉPLOYÉ | P2 | Rattacher au centre de pilotage |
| Dashboards Direction, Finance, Flotte, Carburant, Maintenance, Performance | `Pilotage/CentrePilotageView` | `indicateurs_pilotage()` : indicateurs par domaine avec source, fiabilité, période, heure (D-057) | DÉPLOYÉ | P2 | Widgets par profil ; graphiques d'évolution |
| Centre des décisions, alertes prioritaires | - | `alerts` (aucun écrivain) | MANQUANT | P2 | Après le centre de notifications (lot T3) |
| Comparaison de périodes, analyse site / shift / véhicule / partenaire | partiel dans Analyses | `fiabilite_engins`, `performance_chauffeurs`, `consommation_carburant` | PARTIEL | P2 | Filtres communs période / site / shift |
| Prévisions production et financières | - | - | MANQUANT | P3 | Après historique réel suffisant |
| Export et impression des tableaux de bord | `Pilotage/CentrePilotageView` | export CSV des indicateurs avec source et période (D-057) | PARTIEL | P2 | Impression et export par widget |

### 02. Organisation et administration

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Société exploitante | `Settings/FicheSociete` | `societe` | DÉPLOYÉ | P1 | Compléter RCCM, NIF, signataire (données propriétaire) |
| Organisations (référentiel) | `Settings/AdminSettingsView` | `organisations` (D-038, admin) | DÉPLOYÉ | P2 | Filiales, directions, départements, centres de coûts : MANQUANT |
| Utilisateurs | `Settings/UserModal`, Edge `admin-utilisateurs` | `profiles`, `auth.users` | DÉPLOYÉ | P1 | Création par l'administrateur ; journal de connexion absent |
| Rôles et permissions (rôle x module) | Paramètres > Rôles | `role_permissions`, `has_module_view/write` (D-012) | DÉPLOYÉ | P0 | Permission par action et par état de dossier : MANQUANT |
| Droits par utilisateur | Paramètres > Utilisateurs | `droits_utilisateur`, `definir_droit_module`, `journal_droits_modules` (D-036) | DÉPLOYÉ | P1 | - |
| Périmètre site (lecture et écriture) | - | `site_permis`, gardes D-038 / D-039, dépôts D-044, extension et retrait des politiques administrateur non bornées D-046 | DÉPLOYÉ | P0 | RH et achats restent hors périmètre |
| Affectations multisites, délégations temporaires | - | - | MANQUANT | P2 | Table de périmètres multiples, délégations datées |
| MFA et politiques d'accès | `Auth/SecuriteCompte`, `Auth/VerificationMfa` | TOTP GoTrue, `garde_aal2` (D-040), réglage `mfa_exige` (D-045) | DÉPLOYÉ | P0 | Inscription des comptes sensibles puis activation par l'administrateur |
| Gestion des sessions, journal de connexion | - | `user_activity_logs` | PARTIEL | P1 | Journal des connexions consultable |
| Paramètres généraux | `AdminSettingsView`, `ReglagesServeur` | `settings` (admin), `valider_reglage` (D-061) | À TESTER | P2 | Séquences de numérotation et devises (ligne suivante) |
| Séquences de numérotation, devises, unités, modèles | - | numérotations codées par fonction | MANQUANT | P2 | Référentiel des séquences et devises |

### 03. Sites et infrastructures

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Sites | `Sites/SitesView`, `SiteModal` | `sites` (écriture `settings`) | EXISTANT À AMÉLIORER | P1 | Colonnes inexistantes retirées (D-047), désactivation au lieu de suppression (D-042) ; coordonnées GPS sans colonne |
| Points de chargement, dépôts, ponts-bascules, stations, ateliers | `Sites/InfrastructuresView` | `infrastructures_site` (D-047) | DÉPLOYÉ | P1 | - |
| Capacités, horaires, fermetures temporaires, files d'attente | `Sites/InfrastructuresView` | capacités avec unité, `fermetures_site`, garde du dispatch (D-047) | PARTIEL | P1 | Horaires d'activité et files d'attente : à mesurer |
| Géorepérage | `Geofencing/*` | `geofence_zones/violations/alerts` (gps_tracking et périmètre, D-061) | PARTIEL | P3 | Aucune détection : PostGIS absent, moniteur non déployé |
| Cartographie, routes et pistes, import géographique | Leaflet (Tracking) | - | MANQUANT | P3 | - |

### 04. Production planning

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Objectifs jour / shift / site, plan initial et révisions | `Planning/*` | `objectifs_production`, `definir_objectif`, `annuler_objectif` (D-023) | DÉPLOYÉ | P1 | - |
| Comparaison planifié / réalisé, écarts | `Planning/*` | `v_realisation_objectifs` | DÉPLOYÉ | P1 | Alertes de sous-production : MANQUANT |
| Objectifs par destination et par contrat | `Planning/VentilationObjectif` | `objectifs_ventilation`, `ventiler_objectif`, `v_realisation_ventilation` (D-063, branche d'intégration) | À TESTER | P2 | Réalisé par contrat seul non mesurable (un voyage ne porte pas de contrat) |
| Besoins en camions et engins, simulation de capacité, scénarios de rattrapage | `Planning/SimulationObjectifs` | `durees_cycle_observees`, `simuler_objectif` (D-063, branche d'intégration) | À TESTER | P2 | Seuils d'échantillon constants, non paramétrables |
| Clôture de planification, rapports de production | `Planning/ClotureProduction` | `clotures_planification`, `cloturer_planification`, `annuler_cloture_planification`, `rapport_production`, réglage `planification_cloture_separee` (D-063, branche d'intégration) | À TESTER | P2 | Cause d'écart exigée sans tolérance |

### 05. Shift management

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Modèles d'horaires | Paramètres | `work_shifts` (définitions) | EXISTANT | P1 | - |
| Instances de shift : ouverture, responsable, équipe, affectations, clôture validée | `Postes/PostesView` | `postes`, `postes_equipe`, `ouvrir_poste`, `cloturer_poste`, `valider_cloture_poste` (D-048) | DÉPLOYÉ | P1 | Affectation des engins au poste depuis l'écran |
| Passation de consignes, événements, rapport de shift, retards et absences | `Postes/PostesView` | passation automatique, `postes_evenements`, bilan figé, présences (D-048) | DÉPLOYÉ | P1 | - |
| Comparaison entre shifts, historique des équipes | `Planning/ComparaisonShifts` | `comparer_shifts` (D-063, branche d'intégration) | À TESTER | P2 | Historique des équipes : vue par poste (D-048) seulement |

### 06. Dispatch et affectation

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| File des camions, recommandation déterministe expliquée, décision humaine historisée, motif de refus | `Dispatch/*` | `decisions_dispatch`, `decider_affectation` (D-024) | DÉPLOYÉ | P1 | - |
| Disponibilité engins (immobilisations bloquantes) | `Dispatch/*` | `immobilisations` (D-025) | DÉPLOYÉ | P1 | - |
| Disponibilité et habilitation des chauffeurs | Dispatch (refus serveur) | `habilitations_manquantes`, garde `garde_habilitations` (D-051) | DÉPLOYÉ | P1 | - |
| Fermeture des points de chargement, capacité et files des dépôts | Dispatch (refus serveur) | `site_ferme_le`, garde `garde_site_ferme` (D-047) | DÉPLOYÉ | P1 | Saturation : pas de donnée observée |
| Affectation groupée, réaffectation directe, simulation, comparaison de scénarios, optimisation | - | - | MANQUANT | P2-P3 | Réaffectation directe après livraison : à vérifier dans le cycle (module 07) |

### 07. Voyages et rotations

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Cycle à 18 états, journal immuable, transitions serveur | `Trips/*` | `trips.etat`, `trip_events`, `creer_voyage`, `avancer_voyage`, garde `trips_garde_cycle` | DÉPLOYÉ | P1 | - |
| Fiches terrain imprimables, numéro de fiche au journal | `Fiches/*` | `fiches_terrain`, `preparer_fiche`, `saisir_*` (D-028) | DÉPLOYÉ | P1 | - |
| Ticket CBG rattaché, rectification auditée | `Fiches/*`, `Trips/*` | D-037, migrations `20261113*` | DÉPLOYÉ | P1 | Import de tickets (module 14) |
| Relevés kilométriques sur le parcours | `Trips/KilometrageView` | `releves_compteur`, `distances_voyage`, `distances_reference`, `valider_distance_voyage` (D-043) | DÉPLOYÉ | P0 | Saisie depuis la fiche papier ; à intégrer à la saisie de la fiche rotations |
| Annulation motivée, litiges, incidents de voyage | `Trips/*` (états exceptionnels), `Incidents/IncidentsView` | `trip_events`, `incidents.trip_id` (D-054) | PARTIEL | P1 | Déclaration d'incident depuis la fiche voyage |
| Dossier numérique du voyage | - | - | MANQUANT | P2 | Après GED |
| Rapports par camion, chauffeur, site, shift | partiel | - | PARTIEL | P2 | - |

### 08. Fleet management

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Registre des véhicules, création, modification | `Vehicles/VehiclesView`, `VehicleModal`, `FicheVehicule` | `vehicles` (champs descriptifs seuls en direct), `v_vehicules`, `definir_propriete_vehicule`, `journal_flotte` (D-062) | DÉPLOYÉ | P1 | Saisie de la propriété des engins existants |
| Statuts véhicule | `Vehicles/*` | `v_vehicules.statut_operationnel` (6 valeurs dérivées), `suspendre_vehicule`, `remettre_en_service_vehicule`, `reformer_vehicule` (D-062) | DÉPLOYÉ | P1 | Les écrans hérités affichent « Immobilisé » pour un engin suspendu |
| Documents, assurances, visites techniques | `Documents/*` | `vehicle_documents`, `v_documents_vehicule_a_renouveler` (D-062) | PARTIEL | P1 | Fichier joint après stockage de fichiers |
| Compteurs kilométriques | `Trips/KilometrageView` | `releves_compteur` datés et cohérents (D-043) ; `vehicles.current_km` (défaut 0) n'est pas une mesure | PARTIEL | P1 | Relevés hors voyage (moment « autre ») sans écran dédié |
| Disponibilité, suspension, remise en service | `Maintenance/Immobilisations*` | D-025 | DÉPLOYÉ | P1 | - |
| Coût par véhicule, performances | `Analyses/AnalysesFlotte`, `Vehicles/FicheVehicule` | `fiabilite_engins`, `consommation_carburant`, `v_fiche_vehicule` (D-062) | PARTIEL | P2 | Coûts directs complets (pneus, immobilisations valorisées) |
| Distinction équipement KOGON / loué | `Vehicles/*`, `Contrats/*` | `vehicles.propriete`, `vehicles.contrat_id` (D-062), `contrat_tarifs.engin` (D-033) | DÉPLOYÉ | P1 | Saisie de la propriété des engins existants |

### 09. Chauffeurs

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Dossiers chauffeurs | `Drivers/*` | `drivers` (module + `site_permis`) | EXISTANT | P1 | Archivage par statut, refusé pendant un voyage en cours (D-042, D-061) |
| Permis, qualifications, habilitations, formations, alertes d'expiration | `Drivers/HabilitationsView` | `habilitations_chauffeur`, `habilitations_requises`, `v_habilitations_a_renouveler` (D-051) | DÉPLOYÉ | P1 | Pièces jointes après stockage de fichiers |
| Présences, disponibilités | `HR/AttendanceView` (employés) | `employee_attendance`, `v_presences`, `enregistrer_presence`, `annuler_presence` (D-061) | À TESTER | P1 | Disponibilités non traitées |
| Performance, historique des missions | `Analyses/AnalysesFlotte` | `performance_chauffeurs` | DÉPLOYÉ | P2 | - |
| Incidents, infractions | `Incidents/IncidentsView` | `incidents` rattachés au chauffeur (D-054) | PARTIEL | P2 | Infractions |

### 10. Gestion Neemba Guinée

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Contrats de location, avenants (versions), historique | `Contrats/ContratsView` | `contrats`, `contrat_versions`, `journal_contrats` (D-026) | DÉPLOYÉ | P1 | Fiche partenaire structurée : MANQUANT |
| Tarifs par engin, horaire et kilométrique | `Contrats/Formulaires` | `contrat_tarifs` (D-033) | DÉPLOYÉ | P1 | - |
| Pointages horaires | `Fiches` (pointage engins) | `pointages_engins` | DÉPLOYÉ | P1 | Heures présence / fonctionnement / productives / arrêt / facturables non distinguées (règle 13) |
| Relevés de compteur km | `Trips/KilometrageView` | D-043 ; contrôle Neemba au km sur distances validées | DÉPLOYÉ | P0 | Règle du retour à vide à renseigner par tarif |
| Immobilisations, imputation loueur | `Maintenance/Immobilisations*` | `immobilisations` (D-025) | DÉPLOYÉ | P1 | - |
| Déclarations de panne, demandes d'intervention, techniciens, rapports, pièces, validation de remise en service | `Maintenance/InterventionsLoueurView` | `interventions_loueur`, `interventions_pieces`, `interventions_journal`, `v_interventions_loueur` (D-049) | DÉPLOYÉ | P1 | Délai contractuel à reprendre du contrat |
| Contrôle des factures, écarts, réclamations, régularisations, avoirs | `Contrats/FacturesNeembaView` | `factures_fournisseur*`, `regularisations_fournisseur` (D-032, D-033) | DÉPLOYÉ | P1 | - |
| Évaluation périodique de Neemba | `Contrats/EngagementsView` (rapport) | `rapports_performance` (D-031) | PARTIEL | P2 | Grille d'évaluation dédiée |

### 11. Maintenance et fiabilité

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Immobilisation, cause, imputation, journal, blocage dispatch | `Maintenance/ImmobilisationsView` | D-022, D-025 | DÉPLOYÉ | P1 | - |
| MTBF, MTTR, disponibilité, récurrence | `Analyses/AnalysesFlotte` | `fiabilite_engins` | DÉPLOYÉ | P2 | Coût des immobilisations : MANQUANT |
| Ordres de travail | `Maintenance/MaintenanceView` | `maintenance_orders`, `stock_movements` (`annuler_ordre_travail`, `pieces_ordre_travail`) (D-061) | À TESTER | P2 | `parts_inventory` et `maintenance_parts` en lecture seule : suppression à décider |
| Maintenance préventive | `Maintenance/PreventiveMaintenanceView` | `maintenance_schedules`, `v_releves_compteur` (D-061) | À TESTER | P2 | Applicable aux engins KOGON ; engins loués : Neemba (D-025) |
| Notification au partenaire, demande d'intervention, suivi | `Maintenance/InterventionsLoueurView` | D-049 (canal, référence, délai, retard) | DÉPLOYÉ | P1 | Notification électronique : après SMTP |

### 12. Pneumatiques

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Référentiel, montage, démontage, permutation, contrôle | `Pneus/PneusView` | `tires` (cache), `pneus_operations` (journal), `monter_pneu`, `demonter_pneu`, `permuter_pneu`, `inspecter_pneu`, `annuler_operation_pneu` (D-052) | DÉPLOYÉ | P1 | Anciennes tables `tire_*` à supprimer (décision du propriétaire) |
| Achat, réception, stock, rechapage, rebut, coût par km, durée de vie, performance par marque | `Pneus/PneusView` | `enregistrer_pneu`, `rechaper_pneu`, `reparer_pneu`, `reformer_pneu`, `v_pneus` (km, coût au km), `v_pneus_a_surveiller` (D-052) | PARTIEL | P1 | Réception depuis un bon de commande (lot 13) ; performance par marque (lot 19) |

### 13. Fuel intelligence

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Livraisons CBG, prix au litre, contrôle des factures | `Fuel/LivraisonsCbgView` | D-034 | DÉPLOYÉ | P1 | - |
| Registre des mouvements : stockages, réception mesurée et acceptée, transferts, distributions, inventaires, écarts, annulation, séparation saisie / décision | `Fuel/StocksCarburantView` | `stockages_carburant`, `mouvements_carburant`, `receptions_carburant`, `inventaires_carburant`, `v_stocks_carburant` (D-041) | DÉPLOYÉ | P0 | Déployé le 2026-11-15 (8144424) ; cuves réelles et inventaires d'ouverture à saisir |
| Ancien solde saisi à la main | (écran retiré) | `fuel_stocks` en lecture seule (D-041) | DÉPLOYÉ | P0 | Corrigé le 2026-11-15 |
| Saisie des pleins | `Fuel/PleinsView` (`saisir_plein`), fiche carburant (`saisir_carburant`) | `fuel_transactions` (plus d'écriture directe), `mouvements_carburant` si cuve (D-062) | DÉPLOYÉ | P1 | - |
| Consommation par engin, L/t, L/h, anomalies | `Fuel/AnalyseCarburantView`, `AnomaliesCarburantView` | `consommation_carburant`, `anomalies_carburant` (D-030) | DÉPLOYÉ | P2 | Valorisation par stockage |
| Jauges connectées | `Fuel/CapteursCarburantView` | `ingest_fuel_data`, `iot_fuel_readings` | DÉPLOYÉ | P3 | Aucun matériel réel (règle 17) |
| Import des documents CBG | - | - | MANQUANT | P2 | Après stockage de fichiers |

### 14. Pesée et rapprochement CBG

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Ticket CBG source rattaché au voyage, sans seconde pesée KOGON | `Fiches/*` | D-037 | DÉPLOYÉ | P1 | - |
| Détection de doublons de ticket | serveur | `avancer_voyage` refuse un ticket déjà utilisé | DÉPLOYÉ | P1 | - |
| Rectification auditée (anciennes valeurs conservées) | serveur | D-037, garde `garde_aal2` | DÉPLOYÉ | P1 | - |
| Réconciliation mensuelle | `Facturation/ReconciliationView` | `reconciliations` (D-029) | DÉPLOYÉ | P1 | Réconciliation journalière : MANQUANT |
| Import Excel / CSV / PDF / photos, OCR assistée | `Fiches/TicketsCbgView` | import CSV (D-050) | PARTIEL | P2 | PDF et photos après stockage de fichiers ; OCR en P3 |
| Registre des tickets, tickets manquants et orphelins, contrôles immatriculation / date / poids, litiges, export des états | `Fiches/TicketsCbgView` | `releves_cbg`, `ecarts_releve_cbg`, `rapprocher_releve_cbg`, `v_voyages_livres_sans_ticket` (D-050) | DÉPLOYÉ | P1 | Relier les litiges à la réconciliation mensuelle |

### 15. Fournisseurs

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Répertoire, fiche | `Suppliers/SuppliersView`, `Suppliers/FicheFournisseur` | `suppliers` écrit par `enregistrer_fournisseur` (FRS attribué, raison sociale et NIF uniques), `fournisseurs_journal` (D-059) | DÉPLOYÉ | P2 | - |
| Contacts, documents, catégories, cotations, comparaison, évaluation, historique, suspension | `Suppliers/FicheFournisseur`, `ConsultationsFournisseurs`, `ReferentielsFournisseurs` | `contacts_fournisseurs`, `categories_fournisseurs`, `documents_fournisseurs` + `v_documents_fournisseurs_echeance`, `evaluations_fournisseurs` (append-only), `suspendre_fournisseur`, `consultations_fournisseurs`, `offres_fournisseurs`, `selectionner_offre` puis `enregistrer_bon_commande` (D-059) | DÉPLOYÉ | P2 | Pièces jointes après stockage de fichiers ; grille et seuils à confirmer |

### 16. Achats et approvisionnements

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Bons de commande | `Purchases/PurchasesView` | `purchase_orders`, `purchase_order_items` écrits par `enregistrer_bon_commande`, `soumettre_bon_commande`, `decider_bon_commande`, `annuler_bon_commande`, `solder_bon_commande` ; `achats_journal` (D-053) | DÉPLOYÉ | P1 | - |
| Demande d'achat, validation hiérarchique, consultation, contrôle budgétaire, réception partielle, contrôle qualité, facture, avoir, relances | `Purchases/PurchasesView` | Brouillon puis approbation par une autre personne ; `receptionner_bon_commande` (réception partielle, refus motivé, entrée en stock), `annuler_reception` (D-053) | PARTIEL | P1 | Contrôle budgétaire, factures et avoirs d'achat, relances (consultation : D-059) |

### 17. Stocks et magasins

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Articles, mouvements | `Stock/StockView` | `stock_items`, `stock_movements` append-only, `v_stock_depots`, `mouvement_stock`, `inventorier_stock`, `annuler_mouvement_stock` (D-044) | DÉPLOYÉ | P0 | Écran réécrit ; valorisation au prix saisi |
| Entrepôts, emplacements, réservations, transferts, inventaires, seuils, lots, séries, valorisation | `Stock/StockView` | `warehouses` (+ site, D-044) ; transferts, inventaires, seuils couverts | PARTIEL | P1 | Réservations, lots, séries, coût moyen pondéré |

### 18. Moyens généraux et patrimoine

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Matériel, mobilier, équipements, outillage, véhicules administratifs, affectations, inventaires, réformes | `MoyensGeneraux/MoyensGenerauxView` | `biens`, `biens_operations` append-only, `inventaires_biens`, `inventaires_biens_lignes`, `v_biens` (amortissement linéaire si durée saisie), `v_inventaires_biens_ecarts` ; `enregistrer_bien`, `affecter_bien`, `transferer_bien`, `reformer_bien`, `annuler_operation_bien`, `cloturer_inventaire_biens` (D-060) | DÉPLOYÉ | P2 | Lien bénéficiaire et employé, étiquettes et codes-barres, pièces jointes (PV de remise) |

### 19. Contrats et engagements

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Contrats clients, fournisseurs, location ; parties ; versions et avenants ; tarifs et unités | `Contrats/*` | D-026, D-033 | DÉPLOYÉ | P1 | - |
| Engagements, conformité, rapport de performance | `Contrats/EngagementsView` | `contrat_engagements`, `comparer_engagements` (D-031) | DÉPLOYÉ | P1 | - |
| Comités et actions | `Contrats/ComitesView` | `comites_contrat`, `comite_actions` | DÉPLOYÉ | P2 | - |
| Pénalités, bonus, retenues, échéances, renouvellements, alertes | - | conséquence en texte libre | PARTIEL | P2 | Clauses chiffrées et alertes d'échéance |

### 20. Finance et facturation

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Facture CBG préparée, signée par le DG, numérotée, avoirs | `Facturation/FacturesView`, `FactureImprimable` | D-029 | DÉPLOYÉ | P1 | Facture au km sur distance validée : après lot K |
| Encaissements, créances, relances | `Facturation/RecouvrementView` | `encaissements`, `relances`, `v_creances` (D-031) | DÉPLOYÉ | P1 | - |
| Factures Neemba, régularisations | `Contrats/FacturesNeembaView` | D-032, D-033 | DÉPLOYÉ | P1 | - |
| Paiements exécutés et contrôle a posteriori | `Paiements/PaiementsView` | `paiements_fournisseur`, `reste_a_payer`, `proposer_paiement`, `decider_paiement`, `enregistrer_execution_paiement`, `controler_paiement`, `v_reste_a_payer`, `v_paiements_a_controler` (D-055) | DÉPLOYÉ | P1 | Pièces jointes après stockage de fichiers ; table héritée `payments` à retirer |
| Dettes, budgets, engagements budgétaires | - | - | MANQUANT | P2 | - |
| Coûts directs, coût par tonne, rentabilité | `Costs/CostsView`, `Reports/ReportsView` (rapport mensuel), `Analyses` (`tco-analysis`) | `costs` (site, devise, statut), `enregistrer_cout`, `annuler_cout`, coût par tonne livrée dans `indicateurs_exploitation` (D-058) | DÉPLOYÉ | P2 | Rentabilité (factures CBG moins coûts, même devise) non calculée ; location Neemba hors coûts directs |
| Export comptable, états de gestion | - | - | MANQUANT | P2 | - |

### 21. Reporting et BI

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Rapports standard | `Reports/ReportsView` | `rapport_journalier`, `rapport_mensuel`, `rapport_mensuel_par_jour`, `rapport_loueur`, `rapport_client`, `rapports_figes`, `figer_rapport` (D-058) | DÉPLOYÉ | P2 | Export Excel natif et PDF serveur (CSV et impression navigateur) |
| Rapport de performance mensuel figé | `Contrats/EngagementsView` | `rapports_performance` | DÉPLOYÉ | P2 | - |
| Générateur, tableaux croisés, envoi planifié, rapports de shift | `Reports/ReportsView` | `rapport_shift`, `rapport_mensuel_par_jour` (tableau jour x indicateur) (D-058) | PARTIEL | P2-P3 | Générateur libre et envoi planifié (pas de passerelle de courriel) |

### 22. Santé, sécurité, environnement

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Incidents | `Incidents/IncidentsView` | `incidents` (numéro, type, rattachement, statut), `declarer_incident`, `analyser_incident`, `cloturer_incident` (D-054) | DÉPLOYÉ | P1 | Photos et constats après stockage de fichiers |
| Environnement | `ESG/ESGTrackingView` | `carbon_emissions`, `sustainability_kpis`, `environmental_incidents` (régime B), `waste_management` (C) | PARTIEL | P3 | Aucune source de données ; 4 boutons sans action |
| Inspections, contrôles avant départ, EPI, accidents, presque-accidents, enquêtes, actions correctives, plans de prévention, risques | `Hse/ControlesDepartView`, `Incidents/IncidentsView` | `points_controle_depart`, `controles_depart`, garde `garde_controle_depart` au départ du voyage, `actions_correctives`, `v_actions_correctives_en_retard` (D-054) | PARTIEL | P1 | EPI, plans de prévention, registre des risques, inspections planifiées |

### 23. Documents et GED

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Documents de véhicules (métadonnées) | `Documents/*` | `vehicle_documents` | PARTIEL | P1 | Fichier impossible : pas de stockage |
| Stockage de fichiers, classement, versions, prévisualisation, recherche, rétention, partage contrôlé | - | - | MANQUANT | P1 | Lot D : bucket privé, table `documents` polymorphe, politiques par module et site |
| OCR, signature électronique, circuits de validation | - | - | MANQUANT | P3 | - |

### 24. Bureau numérique et workflow

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Mes validations (éléments à décider par l'utilisateur) | dispersé (Stocks carburant, factures à signer) | - | PARTIEL | P2 | Lot W : boîte de réception agrégée sur les files existantes |
| Mes tâches, échéances, notifications, délégations, circuits paramétrables, relances, escalades | `Notifications/MesValidationsView` | `mes_validations()` calculée selon droits et séparation (D-056) | PARTIEL | P2 | Délégations, escalades, circuits paramétrables |
| Centre de notifications | `Notifications/MesValidationsView` | `notifications` (lecture personnelle, écrites par déclencheurs serveur), `marquer_notifications_lues` (D-056) | DÉPLOYÉ | P2 | Courriel et SMS : passerelle à fournir |

### 25. Portails partenaires

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Portail client | (retiré, D-042) | - | MANQUANT | P3 | Écran fabriqué supprimé le 2026-11-15 ; portail réel après identité partenaire et GED |
| Portails Neemba, CBG, fournisseurs ; comptes partenaires ; dépôt documentaire ; soumission de factures | - | - | MANQUANT | P3 | Après GED et identité partenaire |

### 26. Intelligence opérationnelle et IA

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Recommandation de dispatch expliquée, journal, validation humaine | `Dispatch/*` | `decisions_dispatch` | DÉPLOYÉ | P2 | - |
| Détection d'anomalies (carburant), analyses de performance et fiabilité | `Fuel/Anomalies*`, `Analyses/*` | règles déterministes | DÉPLOYÉ | P2 | - |
| Recherche globale | `Search/GlobalSearchModal` | une requête par type, colonnes réelles, RLS (D-061) | À TESTER | P2 | Recherche documentaire après GED |
| Recherche en langage naturel, prévisions, détection de risques contractuels, génération de rapports | - | - | MANQUANT | P3 | Après données réelles suffisantes |

## Synthèse

| Statut | Fonctionnalités (lignes) |
|---|---|
| DÉPLOYÉ | 69 |
| À TESTER | 9 |
| EXISTANT / EXISTANT À AMÉLIORER | 4 |
| PARTIEL | 23 |
| À CORRIGER | 0 |
| NON CONFORME | 0 |
| MANQUANT | 15 |
| **Total** | **120** |

Non-conformité restante : aucune depuis D-056 (centre de notifications corrigé) ; relevés kilométriques et distances validées : D-043.

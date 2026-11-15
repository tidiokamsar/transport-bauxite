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
| Dashboards Direction, Finance, Flotte, Carburant, Maintenance, Performance | - | - | MANQUANT | P2 | Vues de référence par domaine, widgets par profil |
| Centre des décisions, alertes prioritaires | - | `alerts` (aucun écrivain) | MANQUANT | P2 | Après le centre de notifications (lot T3) |
| Comparaison de périodes, analyse site / shift / véhicule / partenaire | partiel dans Analyses | `fiabilite_engins`, `performance_chauffeurs`, `consommation_carburant` | PARTIEL | P2 | Filtres communs période / site / shift |
| Prévisions production et financières | - | - | MANQUANT | P3 | Après historique réel suffisant |
| Export et impression des tableaux de bord | - | `lib/exports.ts` | MANQUANT | P2 | Export par widget |

### 02. Organisation et administration

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Société exploitante | `Settings/FicheSociete` | `societe` | DÉPLOYÉ | P1 | Compléter RCCM, NIF, signataire (données propriétaire) |
| Organisations (référentiel) | `Settings/AdminSettingsView` | `organisations` (D-038, admin) | DÉPLOYÉ | P2 | Filiales, directions, départements, centres de coûts : MANQUANT |
| Utilisateurs | `Settings/UserModal`, Edge `admin-utilisateurs` | `profiles`, `auth.users` | DÉPLOYÉ | P1 | Création par l'administrateur ; journal de connexion absent |
| Rôles et permissions (rôle x module) | Paramètres > Rôles | `role_permissions`, `has_module_view/write` (D-012) | DÉPLOYÉ | P0 | Permission par action et par état de dossier : MANQUANT |
| Droits par utilisateur | Paramètres > Utilisateurs | `droits_utilisateur`, `definir_droit_module`, `journal_droits_modules` (D-036) | DÉPLOYÉ | P1 | - |
| Périmètre site (lecture et écriture) | - | `site_permis`, gardes D-038 / D-039 | DÉPLOYÉ | P0 | Étendre aux tables restantes (stocks, achats, RH, maintenance) |
| Affectations multisites, délégations temporaires | - | - | MANQUANT | P2 | Table de périmètres multiples, délégations datées |
| MFA et politiques d'accès | - | `garde_aal2` (D-040, inactif) | PARTIEL | P0 | Inscription TOTP côté client, puis activation `mfa_exige` |
| Gestion des sessions, journal de connexion | - | `user_activity_logs` | PARTIEL | P1 | Journal des connexions consultable |
| Paramètres généraux | `AdminSettingsView` (upsert `settings`) | `settings` (admin) | À CORRIGER | P2 | Paramètres saisis mais lus nulle part, sauf `mfa_exige` et `carburant_validation_separee` ; clé API fictive `sk_xxx` affichée (`AdminSettingsView`) |
| Séquences de numérotation, devises, unités, modèles | - | numérotations codées par fonction | MANQUANT | P2 | Référentiel des séquences et devises |

### 03. Sites et infrastructures

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Sites | `Sites/SitesView`, `SiteModal` | `sites` (écriture `settings`) | À CORRIGER | P1 | Modal envoie `latitude`/`longitude` inexistants ; liste joint `employees(name)` inexistant ; suppression physique (`SitesView.tsx:88`) |
| Points de chargement, dépôts, ponts-bascules, stations, ateliers | - | `sites.type` seulement | MANQUANT | P1 | Référentiel d'infrastructures rattachées au site |
| Capacités, horaires, fermetures temporaires, files d'attente | - | - | MANQUANT | P1 | Prérequis du dispatch (dépôt fermé, saturé) |
| Géorepérage | `Geofencing/*` | `geofence_zones/violations/alerts` (régime C) | À CORRIGER | P3 | Politiques absentes : écran inutilisable ; suppression de zone ; PostGIS absent |
| Cartographie, routes et pistes, import géographique | Leaflet (Tracking) | - | MANQUANT | P3 | - |

### 04. Production planning

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Objectifs jour / shift / site, plan initial et révisions | `Planning/*` | `objectifs_production`, `definir_objectif`, `annuler_objectif` (D-023) | DÉPLOYÉ | P1 | - |
| Comparaison planifié / réalisé, écarts | `Planning/*` | `v_realisation_objectifs` | DÉPLOYÉ | P1 | Alertes de sous-production : MANQUANT |
| Objectifs par destination et par contrat | - | - | MANQUANT | P2 | Dimension contrat et dépôt sur l'objectif |
| Besoins en camions et engins, simulation de capacité, scénarios de rattrapage | - | - | MANQUANT | P2 | Après référentiel d'infrastructures et historique de cycle |
| Clôture de planification, rapports de production | - | - | MANQUANT | P2 | - |

### 05. Shift management

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Modèles d'horaires | Paramètres | `work_shifts` (définitions) | EXISTANT | P1 | - |
| Instances de shift : ouverture, responsable, équipe, affectations, clôture validée | - | - | MANQUANT | P1 | Lot S : `shifts` (instance datée), équipe, affectations, clôture |
| Passation de consignes, événements, rapport de shift, retards et absences | - | - | MANQUANT | P1 | Idem |
| Comparaison entre shifts, historique des équipes | - | `trips.shift_id` | PARTIEL | P2 | - |

### 06. Dispatch et affectation

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| File des camions, recommandation déterministe expliquée, décision humaine historisée, motif de refus | `Dispatch/*` | `decisions_dispatch`, `decider_affectation` (D-024) | DÉPLOYÉ | P1 | - |
| Disponibilité engins (immobilisations bloquantes) | `Dispatch/*` | `immobilisations` (D-025) | DÉPLOYÉ | P1 | - |
| Disponibilité et habilitation des chauffeurs | - | `drivers` (sans qualification) | PARTIEL | P1 | Habilitations (module 09) puis contrainte serveur |
| Fermeture des points de chargement, capacité et files des dépôts | - | - | MANQUANT | P1 | Dépend du module 03 |
| Affectation groupée, réaffectation directe, simulation, comparaison de scénarios, optimisation | - | - | MANQUANT | P2-P3 | Réaffectation directe après livraison : à vérifier dans le cycle (module 07) |

### 07. Voyages et rotations

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Cycle à 18 états, journal immuable, transitions serveur | `Trips/*` | `trips.etat`, `trip_events`, `creer_voyage`, `avancer_voyage`, garde `trips_garde_cycle` | DÉPLOYÉ | P1 | - |
| Fiches terrain imprimables, numéro de fiche au journal | `Fiches/*` | `fiches_terrain`, `preparer_fiche`, `saisir_*` (D-028) | DÉPLOYÉ | P1 | - |
| Ticket CBG rattaché, rectification auditée | `Fiches/*`, `Trips/*` | D-037, migrations `20261113*` | DÉPLOYÉ | P1 | Import de tickets (module 14) |
| Relevés kilométriques sur le parcours | - | `trips.km_start/km_end` (non saisis par le parcours) | MANQUANT | P0 | Lot K : relevés d'odomètre append-only, distances référence / déclarée / mesurée / validée / facturable |
| Annulation motivée, litiges, incidents de voyage | `Trips/*` (états exceptionnels) | `trip_events` | PARTIEL | P1 | Incidents : écran hérité à corriger (module 22) |
| Dossier numérique du voyage | - | - | MANQUANT | P2 | Après GED |
| Rapports par camion, chauffeur, site, shift | partiel | - | PARTIEL | P2 | - |

### 08. Fleet management

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Registre des véhicules, création, modification | `Vehicles/*` | `vehicles` (module + `site_permis`, garde D-039 ; `chassis_number` présent) | EXISTANT À AMÉLIORER | P1 | Propriétaire, exploitant, transporteur, contrat associé : MANQUANT |
| Statuts véhicule | - | enum `vehicle_status` (4 valeurs) | PARTIEL | P1 | Statuts étendus sans casser l'existant |
| Documents, assurances, visites techniques | `Documents/*` | `vehicle_documents` (métadonnées seulement) | PARTIEL | P1 | Fichier joint impossible (pas de stockage) ; alertes d'expiration |
| Compteurs kilométriques | - | `vehicles.current_km` (valeur par défaut 0, aucun relevé daté) | MANQUANT | P0 | Lot K : relevés datés, le défaut 0 n'est pas une mesure |
| Disponibilité, suspension, remise en service | `Maintenance/Immobilisations*` | D-025 | DÉPLOYÉ | P1 | - |
| Coût par véhicule, performances | `Analyses/AnalysesFlotte` | `fiabilite_engins`, `consommation_carburant` | PARTIEL | P2 | Coûts directs complets après module 09 du mandat |
| Distinction équipement KOGON / loué | `Contrats/*` (engins du contrat) | `contrat_tarifs.engin` (D-033) | PARTIEL | P1 | Attribut de propriété sur `vehicles` |

### 09. Chauffeurs

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Dossiers chauffeurs | `Drivers/*` | `drivers` (module + `site_permis`) | EXISTANT À AMÉLIORER | P1 | Suppression physique (`DriverModal.tsx:99`) à remplacer par archivage |
| Permis, qualifications, habilitations, formations, alertes d'expiration | - | - | MANQUANT | P1 | Prérequis du scénario « chauffeur non habilité » |
| Présences, disponibilités | `HR/AttendanceView` (employés) | `employee_attendance` | À CORRIGER | P1 | Suppression d'une présence ; pas de lien chauffeur |
| Performance, historique des missions | `Analyses/AnalysesFlotte` | `performance_chauffeurs` | DÉPLOYÉ | P2 | - |
| Incidents, infractions | - | `incidents` (schéma minimal) | MANQUANT | P2 | Module 22 |

### 10. Gestion Neemba Guinée

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Contrats de location, avenants (versions), historique | `Contrats/ContratsView` | `contrats`, `contrat_versions`, `journal_contrats` (D-026) | DÉPLOYÉ | P1 | Fiche partenaire structurée : MANQUANT |
| Tarifs par engin, horaire et kilométrique | `Contrats/Formulaires` | `contrat_tarifs` (D-033) | DÉPLOYÉ | P1 | - |
| Pointages horaires | `Fiches` (pointage engins) | `pointages_engins` | DÉPLOYÉ | P1 | Heures présence / fonctionnement / productives / arrêt / facturables non distinguées (règle 13) |
| Relevés de compteur km | - | - | MANQUANT | P0 | Lot K |
| Immobilisations, imputation loueur | `Maintenance/Immobilisations*` | `immobilisations` (D-025) | DÉPLOYÉ | P1 | - |
| Déclarations de panne, demandes d'intervention, techniciens, rapports, pièces, validation de remise en service | - | - | MANQUANT | P1 | Lot N : interventions Neemba liées à l'immobilisation |
| Contrôle des factures, écarts, réclamations, régularisations, avoirs | `Contrats/FacturesNeembaView` | `factures_fournisseur*`, `regularisations_fournisseur` (D-032, D-033) | DÉPLOYÉ | P1 | - |
| Évaluation périodique de Neemba | `Contrats/EngagementsView` (rapport) | `rapports_performance` (D-031) | PARTIEL | P2 | Grille d'évaluation dédiée |

### 11. Maintenance et fiabilité

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Immobilisation, cause, imputation, journal, blocage dispatch | `Maintenance/ImmobilisationsView` | D-022, D-025 | DÉPLOYÉ | P1 | - |
| MTBF, MTTR, disponibilité, récurrence | `Analyses/AnalysesFlotte` | `fiabilite_engins` | DÉPLOYÉ | P2 | Coût des immobilisations : MANQUANT |
| Ordres de travail | `Maintenance/MaintenanceView`, `MaintenanceModal` | `maintenance_orders`, `parts_inventory` | À CORRIGER | P2 | Suppression d'ordre (`MaintenanceModal.tsx:105`) ; second inventaire de pièces distinct des stocks ; aucune consommation de stock |
| Maintenance préventive | `Maintenance/PreventiveMaintenanceView` | `maintenance_schedules` | À CORRIGER | P2 | Colonnes inexistantes à l'enregistrement (`MaintenanceScheduleModal.tsx:123-140`) ; applicable seulement si contractuel (équipements loués) |
| Notification au partenaire, demande d'intervention, suivi | - | - | MANQUANT | P1 | Lot N |

### 12. Pneumatiques

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Référentiel, montage, démontage, permutation, contrôle | `TireManagement/*` | `tires` (module `vehicles`), 5 tables `tire_*` en régime C | À CORRIGER | P1 | Chiffres et recommandations fabriqués retirés, retrait au lieu de suppression (D-042) ; opérations encore refusées par la RLS, colonnes inexistantes. Lot P : cycle de vie individuel par fonctions serveur |
| Achat, réception, stock, rechapage, rebut, coût par km, durée de vie, performance par marque | - | - | MANQUANT | P1 | Idem, lié aux stocks et aux relevés km |

### 13. Fuel intelligence

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Livraisons CBG, prix au litre, contrôle des factures | `Fuel/LivraisonsCbgView` | D-034 | DÉPLOYÉ | P1 | - |
| Registre des mouvements : stockages, réception mesurée et acceptée, transferts, distributions, inventaires, écarts, annulation, séparation saisie / décision | `Fuel/StocksCarburantView` | `stockages_carburant`, `mouvements_carburant`, `receptions_carburant`, `inventaires_carburant`, `v_stocks_carburant` (D-041) | DÉPLOYÉ | P0 | Déployé le 2026-11-15 (8144424) ; cuves réelles et inventaires d'ouverture à saisir |
| Ancien solde saisi à la main | (écran retiré) | `fuel_stocks` en lecture seule (D-041) | DÉPLOYÉ | P0 | Corrigé le 2026-11-15 |
| Saisie des pleins | `Fuel/PleinsView` (insertion directe), fiche carburant (RPC) | `fuel_transactions` | EXISTANT À AMÉLIORER | P1 | Passer la saisie isolée par fonction serveur |
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
| Import Excel / CSV / PDF / photos, OCR assistée | - | - | MANQUANT | P2 | Après stockage de fichiers ; OCR en P3 |
| Registre des tickets, tickets manquants et orphelins, contrôles immatriculation / date / poids, litiges, export des états | - | - | PARTIEL | P1 | Lot T : registre des tickets et contrôles de rapprochement |

### 15. Fournisseurs

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Répertoire, fiche | `Suppliers/*` | `suppliers` (module `purchases`) | À CORRIGER | P2 | Colonnes inexistantes (`SupplierModal.tsx:70-88`) ; « Voir détails » sans action |
| Contacts, documents, catégories, cotations, comparaison, évaluation, historique, suspension | - | - | MANQUANT | P2 | Lot A (achats) |

### 16. Achats et approvisionnements

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Bons de commande | `Purchases/*` | `purchase_orders`, `purchase_order_items` ; numéro serveur `numeroter_bon_commande` (D-042) | EXISTANT À AMÉLIORER | P1 | Colonnes réelles, annulation au lieu de suppression (D-042) ; statut librement modifiable, pas de validation ni de réception vers stock (lot 13) |
| Demande d'achat, validation hiérarchique, consultation, contrôle budgétaire, réception partielle, contrôle qualité, facture, avoir, relances | - | - | MANQUANT | P1 | Lot A : circuit achat par fonctions serveur, réception vers stock |

### 17. Stocks et magasins

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Articles, mouvements | `Stock/*` | `stock_items`, `stock_movements` (DELETE retiré, D-042) | NON CONFORME | P0 | Quantité modifiée directement puis mouvement inséré séparément, non atomique, erreurs ignorées (`StockEntryModal.tsx:92-108`) ; colonnes inexistantes. Lot M : registre de mouvements sur le modèle D-041 |
| Entrepôts, emplacements, réservations, transferts, inventaires, seuils, lots, séries, valorisation | - | `warehouses` | MANQUANT | P1 | Lot M |

### 18. Moyens généraux et patrimoine

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Matériel, mobilier, équipements, outillage, véhicules administratifs, affectations, inventaires, réformes | - | - | MANQUANT | P2 | Lot G |

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
| Paiements exécutés et contrôle a posteriori | - | `payments` (hérité, non relu) | MANQUANT | P1 | Lot F : chaîne de paiement, pièces, validation séparée |
| Dettes, budgets, engagements budgétaires | - | - | MANQUANT | P2 | - |
| Coûts directs, coût par tonne, rentabilité | `Costs/CostsView`, `Analyses` (`tco-analysis`) | `costs` | À CORRIGER | P2 | « Nouvelle dépense » sans action ; jointures sur colonnes inexistantes (`CostsView.tsx:33-38`) |
| Export comptable, états de gestion | - | - | MANQUANT | P2 | - |

### 21. Reporting et BI

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Rapports standard | `Reports/ReportsView` | lecture de 5 tables | À CORRIGER | P2 | Coût maintenance toujours 0 (colonnes inexistantes, `ReportsView.tsx:67-79`) ; 3 boutons Télécharger sans action |
| Rapport de performance mensuel figé | `Contrats/EngagementsView` | `rapports_performance` | DÉPLOYÉ | P2 | - |
| Générateur, tableaux croisés, envoi planifié, rapports de shift | - | - | MANQUANT | P2-P3 | - |

### 22. Santé, sécurité, environnement

| Fonctionnalité | Écran / fichiers | Données et serveur | Statut | P | Travaux |
|---|---|---|---|---|---|
| Incidents | `Incidents/*` | `incidents` (6 colonnes) | À CORRIGER | P1 | L'écran attend une quinzaine de colonnes absentes : ni lecture ni enregistrement |
| Environnement | `ESG/ESGTrackingView` | `carbon_emissions`, `sustainability_kpis`, `environmental_incidents` (régime B), `waste_management` (C) | PARTIEL | P3 | Aucune source de données ; 4 boutons sans action |
| Inspections, contrôles avant départ, EPI, accidents, presque-accidents, enquêtes, actions correctives, plans de prévention, risques | - | - | MANQUANT | P1 | Lot H (contrôle avant départ en priorité, lié au dispatch) |

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
| Mes tâches, échéances, notifications, délégations, circuits paramétrables, relances, escalades | - | - | MANQUANT | P2 | Après centre de notifications |
| Centre de notifications | `Notifications/SmartNotificationCenter` | `smart_notifications` (régime C) | NON CONFORME | P2 | Écran sans politique d'accès, aucune génération ; lot T3 |

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
| Recherche globale | `Search/GlobalSearchModal` | 7 requêtes | À CORRIGER | P2 | Colonnes inexistantes ; 7 requêtes pour 6 résultats, libellés décalés (`:50-86`) |
| Recherche en langage naturel, prévisions, détection de risques contractuels, génération de rapports | - | - | MANQUANT | P3 | Après données réelles suffisantes |

## Synthèse

| Statut | Fonctionnalités (lignes) |
|---|---|
| DÉPLOYÉ | 41 |
| À TESTER | 0 |
| EXISTANT / EXISTANT À AMÉLIORER | 6 |
| PARTIEL | 17 |
| À CORRIGER | 12 |
| NON CONFORME | 2 |
| MANQUANT | 42 |
| **Total** | **120** |

Non-conformités restantes après D-041 et D-042 : stocks magasin (solde modifiable, non atomique), centre de notifications sans politique d'accès ; manque P0 : relevés kilométriques alors que la facturation au km existe.

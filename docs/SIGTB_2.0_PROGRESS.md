# SIGTB 2.0 - Suivi de progression et etat de reference

Reference : [SIGTB_2.0_CAHIER_DES_CHARGES.md](SIGTB_2.0_CAHIER_DES_CHARGES.md) (CDC 2.0).
Etablissement : 2026-11-06, commit de base `aa67ccc` (branche `main`).
Ce document est le livrable du LOT 00 (audit et etat de reference) et le
tableau de suivi exige par le CDC section 44.

## 1. Statuts utilises (CDC section 44)

Un statut n'est jamais promu sans preuve. On ne confond pas developpe,
teste, valide et deploye.

| Statut | Signification | Preuve exigee |
|---|---|---|
| Absent | Rien dans le code ni le schema | - |
| Maquette | Ecran present mais donnees inventees (`Math.random`) ou calcul fictif | - |
| Existant | Code et schema reels, non confrontes au CDC 2.0 | - |
| A corriger | Existant mais ecart identifie au CDC 2.0 | Ligne d'ecart dans ce document |
| En developpement | Branche ouverte | Branche, PR en cours |
| Teste | Tests automatises verts | Fichiers de test, run CI |
| Valide | Scenarios AT-xxx rejoues avec le metier | PV de recette |
| Deploye | Migrations et fonctions appliquees sur l'environnement cible | Sortie `supabase db push` / `functions deploy`, date |

## 2. Etat du socle au 2026-11-06

| Indicateur | Valeur mesuree | Exigence CDC 41 |
|---|---|---|
| `npm run typecheck` | 37 erreurs (baseline cliquet 37) | 0 erreur |
| `npm run lint` | 0 erreur, 243 avertissements au 2026-11-08 (baseline 243) | 0 erreur bloquante : OK |
| `npm run build` | OK | OK |
| Tests automatises | Outillage installe (D-007, PR #15) : Vitest 46 tests + 2 `todo`, Playwright 2 tests E2E, pgTAP 39 assertions RLS au 2026-11-09. Tests RLS executes par `npm run test:rls:rejeu` sur une base rejouee (pas encore via `supabase test db`, D-009) | Unitaires, integration, RLS, E2E, charge, offline, restauration |
| CI GitHub Actions | Jamais executee : tous les runs en `startup_failure` (facturation Actions, depot prive) | GitHub Actions operationnelle |
| Migrations | 2026-11-09 (D-017) : base de reference generee depuis les 88 migrations Bolt qui rejouent sur 129 (140 tables, toutes avec RLS ; 53 politiques), puis Tranche 0, N4, D-012 et tables manquantes : 6 migrations, 0 echec. Les 129 migrations Bolt sont archivees (`supabase/migrations_bolt_archive`) | Rejouables (CDC 33) : OK |
| PostGIS | Non installe (seule extension : `uuid-ossp`) ; les geofences calculent sans PostGIS | Obligatoire (CDC 5, 29, 30) |
| Projet Supabase de l'app | `bprfctzqplahvrepxgrw`, absent du compte Supabase connecte | Acces requis pour deployer |
| Tranche 0 securite | **Deployee et verifiee le 2026-11-09** sur le VPS (avec N4 et D-012) : 39 assertions RLS sur la base du serveur (HEBERGEMENT_VPS section 9) | RLS restrictive, anti-escalade |
| `Math.random` dans `src/` | 36 occurrences dans 13 fichiers (AI, Analytics, FleetOptimizer, Invoices, Notifications, Purchases, QuickActions) | CDC 27 et 32 : aucune donnee inventee |
| Application mobile | Absente | React Native / Expo + SQLite (CDC 24) |
| Hors ligne web | `src/lib/offline.ts` : file en `localStorage`, identifiant fictif renvoye (C11) | SQLite, idempotence, PENDING_SYNC |

Incidents de poste traites le 2026-11-06 (non lies au code) :
`src/components/Trips/TripsView.tsx` vide dans l'arbre de travail (restaure
depuis git) et `node_modules` partiellement corrompu (12 fichiers JS a
0 octet, dont le plugin ESLint `unused-imports`, reinstalle par `npm ci`).

## 3. Matrice exigences CDC 2.0 -> existant

Evaluation sur le schema (migrations) et le code, sans base distante.
Colonne « LOT » : lot du CDC section 39 qui portera le travail.

| CDC | Exigence | Existant verifie | Statut | LOT |
|---|---|---|---|---|
| 3, 4.1 | Multi-societes, filiales, BU, centres de couts | Tables `sites`, `departments` ; pas de `organizations` ni `business_units` ; aucune donnee rattachee a une organisation | Absent | 02 |
| 4.2 | Utilisateurs : MFA, historique connexions, sessions | `profiles`, `user_activity_logs` ; aucun MFA | A corriger | 01, 02 |
| 4.3 | Droits role x organisation x site x perimetre | `role_permissions` + `has_module_write(module)` : role x module seulement ; pas de `user_site_scopes` | A corriger | 02 |
| 5 | Referentiel sites (code, coordonnees, fronts, pistes, ponts-bascules...) | `sites` : nom, type, `location` texte libre, actif. Geofences polygone/cercle sans PostGIS | A corriger | 02, 08 |
| 6 | Production Planning (objectifs, ressources, rattrapage) | Migration `20261110150000` (D-023) : `objectifs_production` versionnes (plan initial et revise, revision et annulation motivees), `definir_objectif` / `annuler_objectif`, vue `v_realisation_objectifs` (tonnes livrees par date, site, shift), `statistiques_rotation` ; ecran Planification (realisation, projection au rythme constate, rythme requis, camions necessaires sur 14 jours, ressources disponibles) ; objectif repris par le tableau de bord. Absents : objectifs par destination, contrat, transporteur, materiau ; scenarios de rattrapage (6.4) ; causes de retard | En developpement | 03 |
| 7 | Shift Management (responsable, equipe, passation, rapport de cloture) | `work_shifts` = definitions horaires (nom, debut, fin) ; `trips.shift_id` ; pas d'instance de shift ni de cloture | A corriger | 03 |
| 8 | Command Center (source, fiabilite, fraicheur par indicateur) | `Dashboard` nettoye en Vague A (KPI reels) ; aucune metadonnee source / fiabilite / heure | A corriger | 04 |
| 9.1 | Referentiel vehicules complet | `vehicles` existant ; pas de proprietaire / exploitant / transporteur / contrat | A corriger | 05 |
| 9.2 | 11 statuts vehicule | enum `vehicle_status` : `active`, `maintenance`, `immobilized`, `sold` (4) | A corriger | 05 |
| 9.3, 10 | Flotte sous-traitants, gestion transporteurs | Aucune table `transporters`, aucune colonne de propriete | Absent | 05 |
| 11 | Smart Dispatch (deterministe puis OR-Tools, decision humaine historisee) | Migration `20261110180000` (D-024) : `decisions_dispatch` (recommandation, decision, motif, auteur), `preparer_voyages`, `decider_affectation` (contraintes serveur : camion actif benne, chauffeur actif au permis valide, engin actif, un chauffeur par camion et par shift) ; ecran Dispatch : preparation du shift depuis l'objectif, recommandations deterministes expliquees (camion le moins charge, chauffeur habituel, file de chargement la plus courte), acceptation, modification, refus, voyages a reaffecter apres panne, journal. Absents : position, distance, files reelles, carburant, pistes, objectifs configurables, OR-Tools. `dispatch_assignments` (Bolt) non reprise | En developpement | 09 |
| 12 | Cycle voyage 14 etats + 4 exceptionnels, evenements detectes / declares / valides | Migration `20261110120000` : `trips.etat` (18 etats), journal immuable `trip_events`, transitions par `creer_voyage` / `avancer_voyage` seulement (garde sur la table) ; `trip_status` deduit de l'etat ; ecran Voyages & Rotations (liste du jour, fiche, chronologie). Evenements « detectes » (GPS) et « valides » non produits | En developpement | 06 |
| 13 | Ponts-bascules, tickets, controles de doublon, tonnes chargees / livrees / acceptees | `weighings` (trip, ticket, brut, tare, net, photo) ; `ticket_number` sans contrainte d'unicite ; pas de referentiel pont-bascule ni de calibration ; une seule notion de poids net | A corriger | 07 |
| 14 | Tracabilite matiere (lots, stockpiles) | Aucune table | Absent | 07 |
| 15 | GPS : precision, source, qualite, fraicheur ; pas de position ancienne affichee en direct | Positions reelles depuis PR #7 (« sans donnees » sinon) ; Edge Function `iot-ingestion` ; champs precision / qualite / fraicheur non verifies | A corriger | 08 |
| 16 | Road Intelligence | Aucune table de troncons | Absent | 15 |
| 17 | Fuel 360 (cuves, stations, reconciliation, anomalies) | `fuel_transactions`, Fuel nettoye en Vague A ; pas de `fuel_tanks`, `fuel_stations`, reconciliation | A corriger | 10 |
| 18 | Maintenance, immobilisations, blocage dispatch | Migration `20261110210000` (D-022, D-025) : `immobilisations` (engin, debut, fin, cause, imputation loueur / exploitant / a determiner, reference du loueur), journal immuable, fonctions declarer / cloturer / corriger / annuler (motif), statut de l'engin mis a jour, donc dispatch et planification bloques ; `heures_immobilisation` par imputation ; ecran Immobilisations (arrets en cours, heures du mois, disponibilite, export). `maintenance_orders` (ordres d'atelier Bolt) laissee hors perimetre | En developpement | 11 |
| 19 | Pneus individuels | 14 tables `tire_*`, module TireManagement (33 erreurs tsc au 2026-09-03) | Existant | 11 |
| 20 | Stocks et achats | `stock_items`, `stock_movements`, `purchase_orders`, `suppliers` ; `Math.random` dans Purchases | A corriger | 11 |
| 21 | Engins (chargeuses, pelles) : a Nimba, 2 chargeuses Caterpillar et 1 pelle (D-011) | Aucune table `equipment` | Absent | 03, 05, 11 |
| 22 | Chauffeurs, RH, securite | `drivers`, `employees`, `incidents`, paie ; pas de qualifications ni inspections avant depart | A corriger | 05, 15 |
| 23 | Contrats, decomptes, rentabilite | `invoices`, `payments`, module Costs ; pas de `contracts`, `settlements`, `cost_entries` ; `Math.random` dans Invoices | A corriger | 12 |
| 24 | Mobile Offline-First (Expo, SQLite) | Aucune application ; `offline.ts` web non conforme (C11) | Absent | 13 |
| 25 | Portails sous-traitants et clients isoles | `ClientPortal` (1 fichier, filtrage par client non verifie) ; pas de portail sous-traitant | A corriger | 17 |
| 26 | Digital Twin, replay, what-if | Aucun | Absent | 14 |
| 27 | AI Copilot sans donnees inventees | Module `AI` : maquettes `Math.random` ecrivant en base, contraire au CDC 27 | Maquette (non conforme) | 16 |
| 28, 37 | KPI centralises dans des vues de reference | KPI recalcules ecran par ecran ; Analytics en maquette | A corriger | 04 |
| 31 | Event Engine, outbox, idempotence | `tracking_events`, `user_activity_logs` seulement | Absent | 06 |
| 32 | Statuts de qualite de donnee | Aucun | Absent | 04, 06 |
| 34 | API versionnee `/api/v1/...` | Acces PostgREST direct ; 2 Edge Functions (`iot-ingestion`, `geofence-monitor`) | Absent | 06+ |
| 35 | Securite (RLS restrictive, multi-sites, MFA, rate limit, sauvegardes) | Tranche 0 mergee non deployee ; pas de MFA, pas de cloisonnement site | A corriger | 01, 02 |
| 41 | Tests et CI | 0 test ; CI jamais executee | Absent | 01, 18 |

## 4. Lecture

1. Le code Bolt couvre surtout la gestion administrative de flotte (CDC 9,
   17, 18, 19, 20, 22, 23 partiels). Le coeur du CDC 2.0 (planification,
   cycle voyage, pesee et acceptation, dispatch, evenements, qualite de
   donnee, multi-organisation) est absent ou en maquette.
2. Trois ecarts structurants touchent le schema existant et doivent etre
   traites avant toute nouvelle fonctionnalite : dimension organisation /
   site sur les donnees et les droits (LOT 02), cycle voyage et journal
   d'evenements (LOT 06), PostGIS (LOT 02 / 08).
3. Les modules en maquette (AI, FleetOptimizer, Analytics, une partie de
   Dashboard historique) sont contraires aux CDC 27 et 32. Ils seront
   reconstruits par les LOT 09 et 16 : les polir en l'etat (Vague D du plan
   de revue) n'a pas de valeur.
4. Le LOT 01 n'est pas termine tant que la Tranche 0 n'est pas deployee et
   verifiee et que la CI ne s'execute pas : c'est le premier bloqueur.

## 5. Tableau de suivi par lot

| LOT | Intitule | Statut | Dependances | Bloqueurs / risques | PR |
|---|---|---|---|---|---|
| 00 | Audit et etat de reference | En developpement : livrables CDC 43 merges (MASTER_PLAN, ARCHITECTURE, DATABASE_MODEL, SECURITY, DEPLOYMENT, TEST_PLAN) ; contexte Nimba (D-011) | - | Base distante non inspectee (acces Supabase) ; cartographie a refaire sur le dump D-009 ; modele de location parametrable (D-013) | #19 |
| 01 | Securite et qualite du socle | Deploye le 2026-11-09 sur le VPS (Tranche 0, N4, D-012, base de reference D-017, PR #25) ; outillage de test (PR #15), correctif Tranche 0 (D-008, PR #16), rejeu des migrations (PR #18), durcissement `is_admin` (PR #20) merges ; alignement `role_permissions` (D-012, PR #22) merges | 00 | Facturation GitHub Actions ; acces projet Supabase ; rotation mot de passe admin ; 41 migrations Bolt non rejouables (D-009, apres P2) | #2, #4, #7 a #11, #15, #16, #18, #20, #22 |
| 02 | Organisation Enterprise et referentiels | Absent | 01 | Migration des donnees existantes vers une organisation par defaut | - |
| 03 | Production Planning et Shift Management | Deploye le 2026-11-10 (#33) : planification v1 (etape 3 de la reprise, D-023), pgTAP 10 (18 assertions), 5 unitaires, 5 E2E ; shift management (CDC 7 : responsable, passation, cloture) non commence | 02 | Remplace la partie planification de FleetOptimizer ; droits `planning` a confirmer par le proprietaire ; perimetre par site (LOT 02) | #33 |
| 04 | Command Center et KPI | A corriger | 03, 06 | KPI a centraliser en vues SQL | - |
| 05 | Flotte mixte et sous-traitants | Absent | 02 | Enum `vehicle_status` a etendre sans casser l'existant ; flotte louee a l'heure, tracteurs et semi-remorques, 2 chargeuses et 1 pelle (D-011) | - |
| 06 | Cycle de transport et Event Engine | En developpement : cycle voyage v1 (etape 2 de la reprise) : 18 etats, journal `trip_events`, fonctions serveur, ecran Voyages & Rotations, demo avec chronologie ; pgTAP 09 (16 assertions), 4 E2E | 02, 05 | Perimetre par site (LOT 02) ; tickets de pesee et unicite (LOT 07) ; evenements detectes (LOT 08) ; outbox (CDC 31) | #32 (deployee le 2026-11-10) |
| 07 | Pesee, livraison et tracabilite | A corriger | 06 | Unicite des tickets sur donnees existantes | - |
| 08 | GPS, IoT et cartographie | A corriger | 02, 06 | PostGIS ; protocoles traceurs reels inconnus | - |
| 09 | Smart Dispatch et Optimization Engine | Deploye le 2026-11-10 (#34) : dispatch v1 deterministe (etape 4 de la reprise, D-024), pgTAP 11 (17 assertions), 5 unitaires, 4 E2E | 05, 06, 08 | Service Python OR-Tools a cadrer ; position et files reelles (LOT 08) | #34 |
| 10 | Fuel Intelligence 360 | A corriger | 02, 06 | Methode de mesure de consommation | - |
| 11 | Maintenance, pneus et stocks | En developpement : immobilisations des engins loues (D-025), pgTAP 12 (18 assertions), 5 unitaires, 3 E2E ; pneus et stocks inchanges | 05 | Branchement des heures d'immobilisation au decompte de location (LOT 12) | branche `lot-11/immobilisations` |
| 12 | Finance, contrats et rentabilite | En developpement : phase 2 (fiches terrain, D-028 : rotations, pointage engins, carburant ; pgTAP 14, 23 assertions ; 4 unitaires ; 3 E2E) ; phase 1 deployee le 2026-11-11 (#36) : role `contract_manager`, fiche `societe`, dossier contractuel (contrats, avenants, tarifs, engagements, journal), pgTAP 13 (17 assertions), 2 unitaires, 3 E2E ; moteur de decompte v1 (#23) ; 05, 07 | Moteur de decompte v1 developpe et teste, non branche (D-013, LOCATION_MODEL section 7) ; valeurs des contrats a saisir par DARI | #23 |
| 13 | Mobile et Offline-First | Absent | 06, 07 | Nouveau projet Expo | - |
| 14 | Digital Twin et Simulation | Absent | 06, 08, 09 | - | - |
| 15 | Road Intelligence et Safety Intelligence | Absent | 08 | - | - |
| 16 | AI Operations Copilot et Analytics | Maquette signalee, plus d'ecriture aleatoire (D-004) | 04, 06 | Donnees fictives deja en base a purger (acces Supabase) | #14 |
| 17 | Portails partenaires | A corriger | 02, 05, 12 | Isolation RLS a tester | - |
| 18 | Tests integres et pilote | Absent | tous | Site pilote Nimba (D-011) | - |
| 19 | Preparation et validation de production | Absent | 18 | - | - |

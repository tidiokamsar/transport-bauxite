# Documentation SIGTB

Documentation reprise du developpement Bolt, triee et reorganisee lors de la
mise sous git. Les rapports d'etape et resumes de livraison redondants ont ete
supprimes : leur role est desormais tenu par l'historique git. Ils restent
consultables dans le commit initial.

## SIGTB 2.0 (reference)

| Document | Contenu |
|---|---|
| [SIGTB_2.0_CAHIER_DES_CHARGES.md](SIGTB_2.0_CAHIER_DES_CHARGES.md) | Cahier des charges general, fonctionnel et technique, version 2.0 |
| [SIGTB_2.0_PROGRESS.md](SIGTB_2.0_PROGRESS.md) | Etat de reference (LOT 00), matrice exigences -> existant, suivi par lot |
| [SIGTB_2.0_DECISIONS.md](SIGTB_2.0_DECISIONS.md) | Registre des decisions |
| [SIGTB_2.0_MASTER_PLAN.md](SIGTB_2.0_MASTER_PLAN.md) | Plan directeur d'execution : etat du mandat, prerequis, phases, lots |
| [SIGTB_2.0_ARCHITECTURE.md](SIGTB_2.0_ARCHITECTURE.md) | Architecture actuelle, cible, ecarts par lot |
| [SIGTB_2.0_DATABASE_MODEL.md](SIGTB_2.0_DATABASE_MODEL.md) | Cartographie des tables existantes contre le modele cible (CDC 33) |
| [SIGTB_2.0_SECURITY.md](SIGTB_2.0_SECURITY.md) | Modele d'autorisation, constats, ecarts CDC 4.3 et 35 |
| [SIGTB_2.0_DEPLOYMENT.md](SIGTB_2.0_DEPLOYMENT.md) | Procedure de deploiement de la Tranche 0 (P3) et de la base de reference (D-009) |
| [SIGTB_2.0_TEST_PLAN.md](SIGTB_2.0_TEST_PLAN.md) | Strategie de test, matrice des scenarios AT-001 a AT-035 |
| [SIGTB_2.0_HEBERGEMENT_VPS.md](SIGTB_2.0_HEBERGEMENT_VPS.md) | Hebergement sur le VPS du proprietaire, pile Supabase auto-hebergee, CI locale (D-015 a D-017) |
| [SIGTB_2.0_LOCATION_MODEL.md](SIGTB_2.0_LOCATION_MODEL.md) | Modele parametrable de location et de decompte horaire (D-013) |

Les autres documents du CDC section 43 (API, Event Engine, Dispatch,
Fuel, Mobile, Digital Twin, IA) seront crees dans leur lot.

## Demarrage

| Document | Contenu |
|---|---|
| [QUICK_START.md](QUICK_START.md) | Creation des 7 comptes de demonstration, premiere connexion |
| [SETUP.md](SETUP.md) | Configuration complete de l'environnement de developpement |

## Reference technique

| Document | Contenu |
|---|---|
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Endpoints, requetes Supabase, formats de donnees |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Tables, relations, donnees de demonstration, migrations |
| [SECURITY.md](SECURITY.md) | Index de cles etrangeres, optimisation des politiques RLS, `search_path` des fonctions |
| [MODULES_AUDIT.md](MODULES_AUDIT.md) | Inventaire exhaustif des modules et de leurs fonctionnalites |
| [PLAN_REVUE_MODULES.md](PLAN_REVUE_MODULES.md) | Plan de revue module par module : amenagement, re-revision, suivi |

## Reprise en main et re-revision

Toute contribution suit le processus decrit dans
[PLAN_REVUE_MODULES.md](PLAN_REVUE_MODULES.md) : branche dediee, pull
request, puis checklist de re-revision (section 7 du plan) avant merge.
Le cliquet qualite (CI) impose : zero erreur ESLint, pas de regression du
nombre d'erreurs typecheck ni d'avertissements lint par rapport aux
baselines de `.github/ci-baseline.env`.

## Deploiement

| Document | Contenu |
|---|---|
| [deploiement/PRODUCTION.md](deploiement/PRODUCTION.md) | Procedure de mise en production |
| [deploiement/MIGRATION_GOLIVE.md](deploiement/MIGRATION_GOLIVE.md) | Plan de migration des donnees et go-live progressif (site pilote Sangaredi) |
| [deploiement/IOT.md](deploiement/IOT.md) | Deploiement des capteurs carburant et GPS |

## Guides fonctionnels

| Document | Contenu |
|---|---|
| [guides/ADMINISTRATION.md](guides/ADMINISTRATION.md) | Parametrage et administration de la plateforme |
| [guides/PAIE_AUTOMATIQUE.md](guides/PAIE_AUTOMATIQUE.md) | Generation automatique de la paie |
| [guides/FONCTIONNALITES_IA.md](guides/FONCTIONNALITES_IA.md) | Utilisation des modules d'analyse predictive |

## Modules

| Document | Contenu |
|---|---|
| [modules/FLEETOPTIMISER.md](modules/FLEETOPTIMISER.md) | Module d'optimisation de flotte |
| [modules/GESTION_PNEUS.md](modules/GESTION_PNEUS.md) | Gestion unifiee des pneumatiques |

## Specifications

| Document | Contenu |
|---|---|
| [specs/CONFORMITE_DECLAREE_BOLT.md](specs/CONFORMITE_DECLAREE_BOLT.md) | Archive : auto-evaluation Bolt, affirmations non fiables (remplacee par le CDC 2.0) |
| [specs/APPLICATION_MOBILE.md](specs/APPLICATION_MOBILE.md) | Specification de l'application mobile chauffeur (non developpee) |

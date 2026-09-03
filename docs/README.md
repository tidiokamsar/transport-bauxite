# Documentation SIGTB

Documentation reprise du developpement Bolt, triee et reorganisee lors de la
mise sous git. Les rapports d'etape et resumes de livraison redondants ont ete
supprimes : leur role est desormais tenu par l'historique git. Ils restent
consultables dans le commit initial.

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
| [specs/CAHIER_DES_CHARGES.md](specs/CAHIER_DES_CHARGES.md) | Exigences fonctionnelles et non fonctionnelles, analyse des ecarts |
| [specs/APPLICATION_MOBILE.md](specs/APPLICATION_MOBILE.md) | Specification de l'application mobile chauffeur (non developpee) |

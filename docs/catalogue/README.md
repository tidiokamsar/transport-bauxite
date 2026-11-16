# Catalogue maître des modules SIGTB (D-077)

Une fiche par module, sur le modèle `MODELE_FICHE_MODULE.md` (20 sections :
cible détaillée et état constaté avec preuve). Spécification d'origine :
`docs/specs/SIGTB_STANDARD_MODULES.md`. Rédigé le 2026-11-16 par cinq
agents en parallèle, sur l'état de `main` à cette date.

| N° | Module | Fiche | Jalon |
|---|---|---|---|
| 01 | Command Center | [MODULE_01](MODULE_01_command_center.md) | J3 |
| 02 | Organisation et administration | [MODULE_02](MODULE_02_organisation_administration.md) | J1 (référentiels) |
| 03 | Sites et infrastructures | [MODULE_03](MODULE_03_sites_infrastructures.md) | J1 (référentiels) |
| 04 | Production Planning | [MODULE_04](MODULE_04_production_planning.md) | J1 |
| 05 | Shift Management | [MODULE_05](MODULE_05_shift_management.md) | J1 |
| 06 | Dispatch et affectation | [MODULE_06](MODULE_06_dispatch_affectation.md) | J1 |
| 07 | Voyages et rotations | [MODULE_07](MODULE_07_voyages_rotations.md) | J1 |
| 08 | Fleet Management | [MODULE_08](MODULE_08_fleet_management.md) | J1 (référentiels), J2 |
| 09 | Chauffeurs | [MODULE_09](MODULE_09_gestion_chauffeurs.md) | J1 (référentiels) |
| 10 | Neemba Guinée | [MODULE_10](MODULE_10_gestion_neemba.md) | J2 |
| 11 | Maintenance et fiabilité | [MODULE_11](MODULE_11_maintenance_fiabilite.md) | J2 |
| 12 | Pneumatiques | [MODULE_12](MODULE_12_pneumatiques.md) | J2 |
| 13 | Fuel Intelligence | [MODULE_13](MODULE_13_fuel_intelligence.md) | J2 |
| 14 | Pesée et rapprochement CBG | [MODULE_14](MODULE_14_pesee_rapprochement_cbg.md) | J1 |
| 15 | Fournisseurs | [MODULE_15](MODULE_15_fournisseurs.md) | J2 |
| 16 | Achats et approvisionnements | [MODULE_16](MODULE_16_achats_approvisionnements.md) | J2 |
| 17 | Stocks et magasins | [MODULE_17](MODULE_17_stocks_magasins.md) | J2 |
| 18 | Moyens généraux et patrimoine | [MODULE_18](MODULE_18_moyens_generaux_patrimoine.md) | J4 |
| 19 | Contrats et engagements | [MODULE_19](MODULE_19_contrats_engagements.md) | J1 |
| 20 | Finance et facturation | [MODULE_20](MODULE_20_finance_facturation.md) | J1, J2 |
| 21 | Reporting et BI | [MODULE_21](MODULE_21_reporting_bi.md) | J3 |
| 22 | Santé, sécurité, environnement | [MODULE_22](MODULE_22_sante_securite_environnement.md) | J4 |
| 23 | Documents et GED | [MODULE_23](MODULE_23_documents_ged.md) | J1 (pièces), J4 |
| 24 | Bureau numérique et workflow | [MODULE_24](MODULE_24_bureau_numerique_workflow.md) | J3 |
| 25 | Portails partenaires | [MODULE_25](MODULE_25_portails_partenaires.md) | Extension à déclencheur |
| 26 | Intelligence opérationnelle et IA | [MODULE_26](MODULE_26_intelligence_operationnelle_ia.md) | Extension à déclencheur |

## Défauts bloquants relevés par le catalogue et lots de correction

| Défaut | Module | Lot |
|---|---|---|
| Création d'un site impossible (colonnes inexistantes) | 03 | Corrigé et déployé (8df078d) |
| Fiches terrain : identifiant vide envoyé sans site | 07 | Corrigé et déployé (c9f8555) |
| Aucun shift ne peut être créé (0 en production, aucun écran) | 05 | `lot-j1/defauts-bloquants` (D-078) |
| Ticket CBG impossible à rattacher sur un trajet inter-sites | 07, 14 | `lot-j1/defauts-bloquants` |
| Brut et tare libellés en kg, serveur en tonnes | 14 | `lot-j1/defauts-bloquants` |
| Voyage pesé sans ticket, jamais facturable | 14 | `lot-j1/defauts-bloquants` |
| Dispatch : identifiant vide, chargement sans fin | 06 | `lot-j1/defauts-bloquants` |
| Planification : objectif d'un autre site modifiable | 04 | `lot-j1/defauts-bloquants` |
| Chauffeur : dates vides refusées, pas de site | 09 | `lot-j1/defauts-bloquants` |
| Menus Budgets et Évaluation Neemba invisibles hors administrateur | 19, 20 | `lot-j1/defauts-bloquants` |
| Facture Neemba orpheline (deux appels sans transaction) | 10, 20 | `lot-j1/defauts-bloquants` |
| Modification d'un site efface l'organisation | 03 | `lot-ref/saisie-referentiels` (D-079) |
| Compte créé toujours global | 02 | `lot-ref/saisie-referentiels` |
| Désactivation de compte sans motif, possible sur soi-même | 02 | `lot-ref/saisie-referentiels` |
| Suppression physique d'un tarif ou d'un engagement de contrat actif | 19 | `lot-ref/saisie-referentiels` |
| Écran Alertes sur des colonnes inexistantes | 01 | Remplacé par le centre des décisions (D-068) |
| Aucun stockage de fichiers (pièces justificatives) | 23 | Lot « pièces jointes » de J1 |

Les autres écarts (standard des 12 blocs) sont listés, avec leur taille et
leurs dépendances, en fin de chaque fiche. La matrice de couverture
(`docs/SIGTB_MODULE_COVERAGE_MATRIX.md`) sera refaite sur les 12 blocs à
partir de ces fiches.

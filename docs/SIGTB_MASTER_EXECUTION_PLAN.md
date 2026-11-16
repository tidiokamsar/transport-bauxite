# SIGTB : plan maître d'exécution

> **Erratum du 2026-11-15 (D-070).** Des entrees de ce document portent les dates du 2026-11-16, du 2026-11-17 ou du 2026-11-18. Ces dates sont fausses : le travail correspondant a ete fait le 2026-11-15. L'horodatage des commits et l'heure du serveur, lus par `date -u`, le confirment. Les entrees sont laissees telles quelles pour la tracabilite ; seul cet erratum les corrige. Les numeros de migration `20261116...` a `20261120...` sont des identifiants de sequence, pas des dates : les versions deja appliquees en production ne sont pas renommees.


**Mandat :** prompt maître global du 2026-11-15 (26 modules, phases 0 à 9). **Point de départ :** production `feda997`, toutes migrations appliquées (vérifié sur le serveur le 2026-11-15) ; comptes administrateur, DG et chargé de contrats créés.

Documents liés : [matrice de couverture](SIGTB_MODULE_COVERAGE_MATRIX.md) (état par fonctionnalité), [architecture cible](SIGTB_ARCHITECTURE_TARGET.md), [blueprint fonctionnel](SIGTB_FUNCTIONAL_BLUEPRINT.md), [porte qualité](SIGTB_QUALITY_GATE.md), [notes de version](SIGTB_RELEASE_NOTES.md), [suivi par LOT](SIGTB_2.0_PROGRESS.md), [décisions](SIGTB_2.0_DECISIONS.md).

Ce plan ordonne les lots. Les lots du CDC 2.0 (LOT 00 à 19) restent la nomenclature du suivi ; chaque lot ci-dessous indique le LOT CDC auquel il se rattache.

## 1. Phase 0 : reprise (réalisée le 2026-11-15)

| Contrôle | Résultat |
|---|---|
| Branches et PR | PR #32 à #50 fusionnées ; aucune PR ouverte avant ce plan |
| Production | `feda997` côté code et front ; 29 migrations appliquées ; 3 comptes (admin, director, contract_manager) |
| Données en production | Démonstration D-020 (identifiants `dec0de00-`), purge obligatoire avant la première saisie réelle ; aucun réglage dans `settings` |
| Tests locaux | 24 fichiers pgTAP, unitaires Vitest, E2E Playwright sur API simulée ; CI locale `npm run ci:locale` |
| CI distante | GitHub Actions ne démarre pas (compte bloqué pour facturation) : aucun résultat distant possible |
| Typecheck / lint | 37 erreurs TypeScript (cliquet), 0 erreur lint |
| Audit des écrans hérités | Voir les constats transverses de la matrice (colonnes inexistantes, écritures directes, trois régimes RLS, pas de stockage de fichiers) |

## 2. Ordre d'exécution

Chaque lot : branche, migration idempotente, pgTAP, unitaires et E2E pertinents, décision consignée, PR, CI locale verte, fusion, sauvegarde, déploiement, vérification post-déploiement, mise à jour de ce plan, de la matrice et des notes de version.

### Phase 2 : sécurité et intégrité (P0)

| # | Lot | Modules | LOT CDC | Contenu | Statut |
|---|---|---|---|---|---|
| 1 | Registre carburant (D-041) | 13 | 10 | Stock calculé depuis les mouvements validés, réception mesurée, transferts, distributions, inventaires, annulation, séparation saisie / décision | Déployé le 2026-11-15 (8144424) |
| 2 | Assainissement des écrans non conformes | 12, 16, 17, 20, 25, divers | 01 | Retirer du menu le portail client fabriqué ; retirer les chiffres et recommandations codés en dur des pneus ; supprimer le numéro aléatoire des achats ; retirer le droit DELETE du navigateur sur les enregistrements métier (commandes, paie, présences, pneus, ordres de travail, mouvements de stock, alertes) | Déployé le 2026-11-15 (94ce255) |
| 3 | Relevés kilométriques (lot K) | 06, 07, 08, 10, 20 | 07, 12 | Relevés d'odomètre append-only (source, auteur, heure, justificatif) ; distances référence, déclarée, mesurée, validée, facturable ; contrôle Neemba et facture au km sur la seule distance validée | Déployé le 2026-11-15 (6e88e61) |
| 4 | Registre des stocks magasin (lot M) | 17 | 11 | Mouvements append-only, solde calculé, entrées, sorties, transferts, inventaires, ajustements autorisés ; correction des colonnes de l'écran | Déployé le 2026-11-15 (7abf1b6) |
| 5 | MFA côté client | 02 | 01 | Inscription TOTP, écran des facteurs, puis activation de `mfa_exige` par l'administrateur | Déployé le 2026-11-15 (d34b10c) ; activation : décision du propriétaire |
| 6 | Périmètre site étendu | 02 | 02 | `site_permis` sur les tables restantes porteuses d'un site (stocks, achats, maintenance, RH) | Déployé le 2026-11-15 (c1f4bfe) ; RH et achats hors champ |

### Phase 3 et 4 : modules opérationnels essentiels (P1)

| # | Lot | Modules | LOT CDC | Contenu |
|---|---|---|---|---|
| 7 | Infrastructures de site (lot I, D-047 déployé le 2026-11-15, d11cf3c) | 03, 06 | 02 | Points de chargement, dépôts, ponts-bascules, stations ; capacités, horaires, fermetures temporaires ; contraintes du dispatch (dépôt fermé, saturé) |
| 8 | Shifts opérables (lot S, D-048 déployé le 2026-11-15, db7709c) | 05 | 03 | Instance de shift, responsable, équipe, affectations, passation, événements, clôture validée, rapport |
| 9 | Interventions Neemba (lot N, D-049 déployé le 2026-11-16, b2d81d8) | 10, 11 | 11 | Déclaration de panne, notification, demande d'intervention, suivi, rapport, pièces, validation de remise en service, calcul d'indisponibilité ; heures présence / productives / arrêt / facturables |
| 10 | Registre des tickets CBG (lot T, D-050 déployé le 2026-11-16, 6b55549) | 14 | 07 | Registre, tickets manquants et orphelins, contrôles immatriculation / date / poids, litiges, réconciliation journalière, export |
| 11 | Chauffeurs habilités (lot C, D-051 déployé le 2026-11-16, 2d5c3cb) | 09, 06 | 05 | Permis, qualifications, habilitations, alertes d'expiration ; contrainte serveur au dispatch |
| 12 | Pneumatiques (lot P, D-052 déployé le 2026-11-16, 165d2ea) | 12 | 11 | Cycle de vie individuel par fonctions serveur, politiques d'accès, coût par km (après lot K) |
| 13 | Achats et fournisseurs (lot A, D-053 déployé le 2026-11-17, 7f11af4) | 15, 16 | 11 | Demande, validation, commande, réception vers stock, facture, avoir |
| 14 | GED et stockage de fichiers (lot D) | 23, 08, 14 | 06 | Bucket privé, table documentaire polymorphe, politiques par module et site, versions ; pièces jointes des modules |
| 15 | HSE (lot H, D-054 déployé le 2026-11-17, 04140d7) | 22 | 15 | Contrôle avant départ lié au dispatch, incidents (écran corrigé), actions correctives |
| 16 | Paiements et contrôle a posteriori (lot F, D-055 déployé le 2026-11-17, 48d2cf0) | 20 | 12 | Paiements exécutés, pièces, validation séparée ; source de données à fournir par le propriétaire |

### Phase 1 (transverse, menée au fil des lots) et phases 5 à 6 (P2-P3)

| # | Lot | Modules | Contenu |
|---|---|---|---|
| 17 | Centre de notifications et boîte de validations (lots T3, W) (D-056 déployé le 2026-11-17, debf876) | 24, 01 | Une table de notifications avec politique par destinataire, générée par les fonctions serveur ; boîte « Mes validations » agrégeant les files existantes |
| 18 | Composants communs | tous | DataTable, filtres, exports, dialogues de décision, historique, au fil des écrans repris (pas de refonte globale) |
| 19 | Command Center et KPI de référence (D-057 déployé le 2026-11-17, 9cf47cf) | 01, 21 | Vues SQL de référence avec source, période, fraîcheur ; dashboards par domaine |
| 20 | Reporting (D-058 déployé le 2026-11-18, f59a4b0) | 21 | Rapports journaliers, de shift, mensuels, partenaires ; exports |
| 21 | Moyens généraux (lot G) (D-060 déployé le 2026-11-18, f79e708) | 18 | Patrimoine, affectations, inventaires |
| 22 | Portails partenaires | 25 | Identité partenaire, cloisonnement strict, dépôt documentaire |
| 23 | Intelligence (P3) | 26 | Prévisions et recherche avancée sur données réelles suffisantes |

### Phase 7 à 9 : industrialisation

Scénarios obligatoires du mandat (dépôt fermé, odomètre manquant, ticket en doublon, écart carburant, double soumission, échec de synchronisation...) couverts par pgTAP et E2E au fil des lots ; test de restauration de sauvegarde ; guides (administrateur, terrain, carburant, financier, déploiement, restauration) ; notes de version par déploiement.

## 3. Blocages externes (intervention du propriétaire)

| Blocage | Effet | Contournement |
|---|---|---|
| GitHub Actions bloqué (facturation) | Aucune CI distante | CI locale `npm run ci:locale`, rapport joint à chaque PR (D-015) |
| Contrats CBG et Neemba réels, tarifs | Facturation et contrôles sans paramètres réels | Paramétrage complet, aucune valeur inventée |
| Fiche société (RCCM, NIF, adresse, signataire) | Documents imprimés incomplets | Champs affichés vides |
| Source des paiements exécutés | Lot F sans données | Modèle prêt, saisie manuelle |
| SMTP, sauvegarde hors serveur | Pas d'e-mail, sauvegarde locale au VPS seulement | Notifications internes ; sauvegarde quotidienne locale |
| Purge des données de démonstration | Données fictives visibles en production (bandeau) | `deploy/vps/demo/demo.sh purger`, sur autorisation explicite du propriétaire |
| Recette métier (PV) | Aucune fonctionnalité au statut VALIDÉ | Scénarios préparés, à rejouer avec les acteurs |

## 4. Règles de conduite

- Une donnée manquante reste « sans données » ; aucune valeur par défaut fictive (CLAUDE.md, règle 1).
- Toute écriture sensible passe par une fonction serveur ; une correction est un nouvel événement, jamais une réécriture.
- Opérations nécessitant l'accord explicite du propriétaire : migration destructive, suppression de données, purge de la démonstration, opération financière réelle, activation d'une intégration externe.
- Développé, testé, fusionné, déployé et validé sont des états distincts, chacun avec sa preuve.

## 5. Journal d'exécution

| Date | Lot | Résultat |
|---|---|---|
| 2026-11-15 | Phase 0 | Reprise, audit des écrans hérités, matrice de couverture, ce plan |
| 2026-11-15 | 1. Registre carburant (D-041) | PR #51 fusionnée ; déployé (8144424) : sauvegarde, migration `20261115090000`, 25 fichiers pgTAP OK sur la base du serveur, release front (précédente feda997) |
| 2026-11-15 | 2. Assainissement (D-042) | PR #54 fusionnée ; déployé (94ce255) : 26 fichiers pgTAP OK sur la base du serveur |
| 2026-11-15 | 3. Relevés kilométriques (D-043) | PR #55 fusionnée ; déployé (6e88e61) : 27 fichiers pgTAP OK sur la base du serveur |
| 2026-11-15 | 4. Registre des stocks (D-044) | PR #56 fusionnée ; déployé (7abf1b6) : 28 fichiers pgTAP OK sur la base du serveur |
| 2026-11-15 | 5. MFA côté client (D-045) | PR #57 fusionnée ; déployé (d34b10c), aucune migration |
| 2026-11-15 | 6. Périmètre étendu (D-046) | PR #58 fusionnée ; déployé (c1f4bfe) : 29 fichiers pgTAP OK sur la base du serveur |
| 2026-11-15 | 7. Infrastructures de site (D-047) | PR #59 fusionnée ; déployé (d11cf3c) : 30 fichiers pgTAP OK sur la base du serveur |
| 2026-11-16 | 8. Postes de travail (D-048) | PR #60 fusionnée ; déployé (db7709c) : 31 fichiers pgTAP OK sur la base du serveur |
| 2026-11-16 | 9. Interventions Neemba (D-049) | PR #61 fusionnée ; déployé (b2d81d8) : 32 fichiers pgTAP OK sur la base du serveur |
| 2026-11-16 | 10. Relevés CBG (D-050) | PR #62 fusionnée ; déployé (6b55549) : 33 fichiers pgTAP OK sur la base du serveur |
| 2026-11-16 | 11. Habilitations chauffeurs (D-051) | PR #63 fusionnée ; déployé (2d5c3cb) : 34 fichiers pgTAP OK sur la base du serveur |
| 2026-11-16 | 12. Pneumatiques (D-052) | PR #64 fusionnée ; déployé (165d2ea) : 35 fichiers pgTAP OK sur la base du serveur |
| 2026-11-17 | 13. Circuit achat (D-053) | PR #65 fusionnée ; déployé (7f11af4) : 36 fichiers pgTAP OK sur la base du serveur |
| 2026-11-17 | 14. GED et stockage (lot D) | Reporté : le service Storage n'est pas dans la pile de production (D-016) et `/storage/*` est bloqué au Caddy partagé ; activation soumise à la validation du propriétaire |
| 2026-11-17 | 15. HSE (D-054) | PR #66 fusionnée ; déployé (04140d7) : 37 fichiers pgTAP OK sur la base du serveur |
| 2026-11-17 | 16. Paiements fournisseurs (D-055) | PR #67 fusionnée ; déployé (48d2cf0) : 38 fichiers pgTAP OK sur la base du serveur |
| 2026-11-17 | 17. Mes validations et notifications (D-056) | PR #68 fusionnée ; déployé (debf876) : 39 fichiers pgTAP OK sur la base du serveur |
| 2026-11-17 | Organisation multi-agents | Six agents en worktrees isolés : lots 20 (reporting, coûts), 15b (fournisseurs), 21 (moyens généraux), 18 (écrans hérités à corriger), 08 (flotte), guides de la phase 8 ; intégration, CI complète, fusion et déploiement par l'intégrateur, lot par lot |
| 2026-11-17 | 19. Centre de pilotage (D-057) | PR #70 fusionnée ; déployé (9cf47cf) : 40 fichiers pgTAP OK sur la base du serveur |
| 2026-11-17 | Phase 8 : guides | PR #71 fusionnée : 11 guides dans `docs/guides/` (agent documentation), avec leurs limites connues |
| 2026-11-18 | Coupure réseau | Cinq agents interrompus (API injoignable), relancés avec leur contexte ; aucun travail perdu |
| 2026-11-18 | 21. Moyens généraux (D-060) | PR #72 fusionnée ; déployé (f79e708) : 41 fichiers pgTAP OK sur la base du serveur |
| 2026-11-18 | Flotte, module 08 (D-062) | PR #73 fusionnée ; déployé (24dd140) : 42 fichiers pgTAP OK sur la base du serveur |
| 2026-11-18 | 15b. Fournisseurs (D-059) | PR #74 fusionnée ; déployé (eca55e3) : 43 fichiers pgTAP OK sur la base du serveur, migration `20261118120000` vérifiée appliquée |
| 2026-11-18 | 20. Reporting et coûts (D-058) | PR #75 fusionnée ; déployé (f59a4b0) : 44 fichiers pgTAP OK sur la base du serveur |
| 2026-11-18 | 18. Écrans hérités corrigés (D-061) | PR #76 fusionnée ; déployé (5ef4ab6) : 45 fichiers pgTAP OK sur la base du serveur ; aucune ligne À CORRIGER dans la matrice ; typecheck 37 -> 29, lint 115 -> 68 |
| 2026-11-15 | Phase 7 : test de restauration | Sauvegarde restaurée dans un conteneur jetable, comptages identiques à la production ; script `deploy/vps/tester-restauration.sh`, guide mis à jour |
| 2026-11-18 | Deuxième vague d'agents | Six agents : planification avancée (D-063), organisation et délégations (D-064), clauses, budgets et export comptable (D-065), dispatch et voyages (D-066), stocks avancés et pneus (D-067), centre des décisions et HSE (D-068) |
| 2026-11-15 | Mandat V2 (D-069) et erratum des dates (D-070) | Bloc 1 et décisions permanentes intégrés à `CLAUDE.md` ; mandat archivé sous `docs/specs/` ; ordre retenu : revue a posteriori D-041 à D-062, puis intégration de la deuxième vague branche par branche, chacune après revue indépendante |
| 2026-11-16 | Restauration avec conservation des droits (D-073) | Constat : une restauration simple rouvrait les fonctions internes à `anon` et `authenticated` (289 exécutables par `anon` contre 65 en production) ; nouveau `deploy/vps/restaurer.sh` (droits par défaut neutralisés puis rétablis), `tester-restauration.sh` compare aussi droits et empreintes : 19 contrôles identiques, 0 erreur `pg_restore` ; guide corrigé par erratum daté |
| 2026-11-18 | 15b (historique d'intégration) | Agent : branche `lot-15b/fournisseurs` ; pgTAP 42 (42 assertions), 10 unitaires, 2 E2E ; intégration `lot-15b/fournisseurs-integration` ; migration antérieure en horodatage à D-060 et D-062, sans dépendance (le script serveur applique toute version non enregistrée) ; nom du conteneur de rejeu rendu unique |

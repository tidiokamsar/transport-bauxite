# SIGTB : matrice de couverture des 26 modules (standard des 12 blocs)

**État au 2026-11-17 (`date -u`), sur `main` 33ab8ef.** Refaite sur le standard des 12 blocs (D-077) à partir des 26 fiches du catalogue maître (`docs/catalogue/MODULE_NN_*.md`, modèle `docs/catalogue/MODELE_FICHE_MODULE.md`, index `docs/catalogue/README.md`), rédigées le 2026-11-16 sur `main` 8df078d, puis mise à jour des lots fusionnés depuis (PR #97 à #102), chaque changement étant vérifié dans le code (fichier, fonction, test) avant de promouvoir une case.

Ce document remplace la matrice par fonctionnalité du 2026-11-15 (statuts DÉPLOYÉ, À TESTER, EXISTANT, À CORRIGER, NON CONFORME), qui reste lisible dans l'historique Git (`git show 33ab8ef:docs/SIGTB_MODULE_COVERAGE_MATRIX.md`). Le détail fonctionnel (écrans, champs, transitions, tables, fonctions) est dans les fiches ; la matrice en donne l'état par bloc et les écarts ordonnés. L'ordre d'exécution reste celui de `docs/SIGTB_MASTER_EXECUTION_PLAN.md`.

## Production de référence

| Élément | Constat | Preuve |
|---|---|---|
| Dernière release consignée | `8df078d` (PR #95, création d'un site), précédée de `c9f8555` (PR #94), `349febc` (PR #93), `9ad7116` (PR #92, D-067), `3bbfded` (PR #90, D-065) | `docs/SIGTB_2.0_HEBERGEMENT_VPS.md`, section 11 « Journal des mises a jour » |
| Dernières migrations consignées | jusqu'à `20261121130000` (D-067, 61 migrations) | même journal, ligne de la release 9ad7116 |
| SHA servi par le serveur | **non lu** : l'accès SSH au VPS a été refusé dans cette session ; `33ab8ef` est annoncé comme dernière production connue mais aucune ligne du journal ne le consigne | - |
| Fusionné sur `main` sans déploiement consigné | `a909074` (PR #97, D-064, migration `20261121140000`), `64e0961` (PR #98, libellés carburant), `2ad3c29` (PR #99, D-068, `20261121150000`), `8dec42c` (PR #100, D-078, `20261121160000`), `58ad8db` (PR #101, D-079, `20261121170000`), `33ab8ef` (PR #102, fenêtres communes) | `git log --first-parent origin/main` |

Conséquence appliquée dans toute la matrice : un apport des PR #97 à #102 est au plus **TESTÉ** et porte la mention « main 33ab8ef, déploiement non consigné ». Il passera DÉPLOYÉ quand le journal consignera la release (SHA, migrations listées, tests pgTAP sur la base du serveur, contrôles après déploiement). Règle de mise en production : D-080 (chaque lot déployé dès qu'il est terminé et revu, à la demande du propriétaire), dans le cadre du bloc 1, section 4, de `CLAUDE.md` après la première saisie réelle.

Corrections des fiches relevées pendant la mise à jour :
- D-067 (stocks avancés, réservations, réception de pneus, PR #92) est **déployée** (release `9ad7116`, tests 28 et 50 verts sur le serveur) ; les fiches 11, 12, 16 et 17 la disaient sans déploiement consigné.
- Le garde des Fiches terrain sans site (PR #94) est déployé (release `c9f8555`).
- Le réglage `tolerance_poids_cbg_t` (module 14) avait déjà son écran dans Réglages serveur à 8df078d (`reglages.ts`, `ReglagesServeur.tsx`).
- Module 22 : D-068 (EPI, risques, plans de prévention, inspections) existe et est fusionné (pgTAP 51, E2E `decisions-hse`) ; la fiche le disait sans branche.

## États d'une case

| Code | Sens | Preuve exigée |
|---|---|---|
| MANQUANT | Rien n'existe pour ce bloc | - |
| MAQUETTE | Écran ou code sans effet réel (données fictives, bouton sans action, colonne inexistante) | Fichier |
| PARTIEL | Le cœur du bloc est nettement incomplet ; la preuve dit ce qui existe, sa maturité et ce qui manque | Fichier et manque |
| DÉVELOPPÉ | Cœur du bloc couvert, code sur `main` sans test du bloc | Fichier, fonction serveur |
| TESTÉ | Cœur du bloc couvert, tests nommés (pgTAP, unitaires, E2E), pas de release consignée | Nom des tests |
| DÉPLOYÉ | Cœur du bloc couvert, en production selon le journal | SHA de release, migration |
| UTILISABLE | Données réelles saisies, comptes réels par rôle, guide du rôle | Guide |
| VALIDÉ | PV de recette signé par l'acteur métier | PV |

Règles de lecture :
- Une case juge ce qui existe pour le bloc dans le module, face au contenu du bloc (table du modèle) tel que la fiche le détaille. Une case PARTIEL peut contenir des éléments déployés : la preuve le précise.
- Aucune case n'est UTILISABLE ni VALIDÉ : aucun compte réel par rôle n'a été vérifié et aucun PV de recette n'existe.
- Une maquette n'est jamais existante ; aucune case n'est promue sans preuve.
- Les 12 blocs : 01 Dashboard ; 02 Liste ; 03 CRUD ; 04 Fiche détaillée ; 05 Modals et formulaires ; 06 Actions métier ; 07 Workflows ; 08 Documents ; 09 Rapports ; 10 Historique ; 11 Notifications ; 12 Paramétrage (contenu détaillé dans `docs/catalogue/MODELE_FICHE_MODULE.md`).

## 1. Matrice 26 modules x 12 blocs

| N° | Module | Jalon | 01 Dashboard | 02 Liste | 03 CRUD | 04 Fiche | 05 Modals | 06 Actions | 07 Workflows | 08 Documents | 09 Rapports | 10 Historique | 11 Notif. | 12 Param. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | [Command Center](#module-01) | J3 | TESTÉ | PARTIEL | PARTIEL | PARTIEL | PARTIEL | TESTÉ | PARTIEL | PARTIEL | PARTIEL | PARTIEL | PARTIEL | PARTIEL |
| 02 | [Organisation et administration](#module-02) | J1 | MANQUANT | PARTIEL | PARTIEL | MANQUANT | TESTÉ | TESTÉ | PARTIEL | MANQUANT | MANQUANT | PARTIEL | MANQUANT | PARTIEL |
| 03 | [Sites et infrastructures](#module-03) | J1 | PARTIEL | PARTIEL | PARTIEL | MANQUANT | TESTÉ | DÉPLOYÉ | PARTIEL | MANQUANT | MANQUANT | PARTIEL | MANQUANT | PARTIEL |
| 04 | [Production Planning](#module-04) | J1 | PARTIEL | PARTIEL | TESTÉ | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL | PARTIEL | DÉPLOYÉ | DÉPLOYÉ | MANQUANT | PARTIEL |
| 05 | [Shift Management](#module-05) | J1 | MANQUANT | PARTIEL | PARTIEL | PARTIEL | PARTIEL | PARTIEL | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL | TESTÉ |
| 06 | [Dispatch et affectation](#module-06) | J1 | PARTIEL | PARTIEL | PARTIEL | MANQUANT | DÉPLOYÉ | DÉPLOYÉ | PARTIEL | MANQUANT | MANQUANT | DÉPLOYÉ | MANQUANT | MANQUANT |
| 07 | [Voyages et rotations](#module-07) | J1 | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | DÉPLOYÉ | TESTÉ | PARTIEL | PARTIEL | DÉPLOYÉ | DÉPLOYÉ | PARTIEL | DÉPLOYÉ |
| 08 | [Fleet Management](#module-08) | J1 réf., J2 | PARTIEL | PARTIEL | DÉPLOYÉ | DÉPLOYÉ | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL | PARTIEL | PARTIEL | PARTIEL | PARTIEL |
| 09 | [Chauffeurs](#module-09) | J1 | PARTIEL | PARTIEL | TESTÉ | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | MANQUANT | DÉPLOYÉ | PARTIEL | PARTIEL | PARTIEL |
| 10 | [Neemba Guinée](#module-10) | J2 | PARTIEL | PARTIEL | PARTIEL | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL | PARTIEL |
| 11 | [Maintenance et fiabilité](#module-11) | J2 | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL | DÉPLOYÉ | DÉPLOYÉ | MANQUANT | DÉPLOYÉ | PARTIEL | PARTIEL | PARTIEL |
| 12 | [Pneumatiques](#module-12) | J2 | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | MANQUANT | MANQUANT | DÉPLOYÉ | PARTIEL | PARTIEL |
| 13 | [Fuel Intelligence](#module-13) | J2 | PARTIEL | PARTIEL | PARTIEL | MANQUANT | PARTIEL | DÉPLOYÉ | PARTIEL | MANQUANT | PARTIEL | PARTIEL | PARTIEL | PARTIEL |
| 14 | [Pesée et rapprochement CBG](#module-14) | J1 | PARTIEL | PARTIEL | TESTÉ | MANQUANT | PARTIEL | TESTÉ | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL | PARTIEL |
| 15 | [Fournisseurs](#module-15) | J2 | PARTIEL | PARTIEL | DÉPLOYÉ | DÉPLOYÉ | PARTIEL | DÉPLOYÉ | PARTIEL | MANQUANT | MANQUANT | DÉPLOYÉ | PARTIEL | DÉPLOYÉ |
| 16 | [Achats et approvisionnements](#module-16) | J2 | MANQUANT | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | DÉPLOYÉ | PARTIEL | MANQUANT | MANQUANT | DÉPLOYÉ | PARTIEL | PARTIEL |
| 17 | [Stocks et magasins](#module-17) | J2 | PARTIEL | PARTIEL | PARTIEL | MANQUANT | PARTIEL | DÉPLOYÉ | PARTIEL | MANQUANT | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL |
| 18 | [Moyens généraux et patrimoine](#module-18) | J4 | MANQUANT | PARTIEL | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ | PARTIEL | MANQUANT | MANQUANT | DÉPLOYÉ | MANQUANT | PARTIEL |
| 19 | [Contrats et engagements](#module-19) | J1 | DÉPLOYÉ | PARTIEL | TESTÉ | DÉPLOYÉ | TESTÉ | DÉPLOYÉ | PARTIEL | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL |
| 20 | [Finance et facturation](#module-20) | J1, J2 | PARTIEL | PARTIEL | DÉPLOYÉ | DÉPLOYÉ | PARTIEL | DÉPLOYÉ | DÉPLOYÉ | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL |
| 21 | [Reporting et BI](#module-21) | J3 | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL | DÉPLOYÉ | PARTIEL | PARTIEL | PARTIEL | PARTIEL | MANQUANT | MANQUANT |
| 22 | [Santé, sécurité, environnement](#module-22) | J4 (contrôle avant départ : J1) | MAQUETTE | PARTIEL | TESTÉ | MANQUANT | PARTIEL | TESTÉ | TESTÉ | MANQUANT | PARTIEL | DÉPLOYÉ | TESTÉ | PARTIEL |
| 23 | [Documents et GED](#module-23) | J1 (pièces), J4 | PARTIEL | PARTIEL | PARTIEL | MANQUANT | PARTIEL | PARTIEL | MANQUANT | MANQUANT | MANQUANT | MANQUANT | PARTIEL | MANQUANT |
| 24 | [Bureau numérique et workflow](#module-24) | J3 | DÉPLOYÉ | PARTIEL | PARTIEL | MANQUANT | PARTIEL | PARTIEL | PARTIEL | MANQUANT | MANQUANT | PARTIEL | PARTIEL | MANQUANT |
| 25 | [Portails partenaires](#module-25) | J4 déclencheur | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT |
| 26 | [Intelligence opérationnelle et IA](#module-26) | J4 déclencheur | PARTIEL | PARTIEL | PARTIEL | PARTIEL | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ | MANQUANT | MANQUANT | PARTIEL | PARTIEL | PARTIEL |

**Comptage des 312 cases** : MANQUANT 62 ; MAQUETTE 1 ; PARTIEL 172 ; DÉVELOPPÉ 0 ; TESTÉ 17 ; DÉPLOYÉ 60 ; UTILISABLE 0 ; VALIDÉ 0.

| Bloc | MANQUANT | MAQUETTE | PARTIEL | DÉVELOPPÉ | TESTÉ | DÉPLOYÉ | UTILISABLE | VALIDÉ |
|---|---|---|---|---|---|---|---|---|
| 01 Dashboard | 5 | 1 | 17 | 0 | 1 | 2 | 0 | 0 |
| 02 Liste | 1 | 0 | 25 | 0 | 0 | 0 | 0 | 0 |
| 03 CRUD | 1 | 0 | 12 | 0 | 5 | 8 | 0 | 0 |
| 04 Fiche | 10 | 0 | 10 | 0 | 0 | 6 | 0 | 0 |
| 05 Modals | 1 | 0 | 17 | 0 | 3 | 5 | 0 | 0 |
| 06 Actions | 1 | 0 | 4 | 0 | 5 | 16 | 0 | 0 |
| 07 Workflows | 2 | 0 | 20 | 0 | 1 | 3 | 0 | 0 |
| 08 Documents | 16 | 0 | 10 | 0 | 0 | 0 | 0 | 0 |
| 09 Rapports | 11 | 0 | 8 | 0 | 0 | 7 | 0 | 0 |
| 10 Historique | 2 | 0 | 13 | 0 | 0 | 11 | 0 | 0 |
| 11 Notif. | 7 | 0 | 18 | 0 | 1 | 0 | 0 | 0 |
| 12 Param. | 5 | 0 | 18 | 0 | 1 | 2 | 0 | 0 |

| Jalon (rattachement principal) | Modules | MANQUANT | MAQUETTE | PARTIEL | DÉVELOPPÉ | TESTÉ | DÉPLOYÉ | UTILISABLE | VALIDÉ |
|---|---|---|---|---|---|---|---|---|---|
| J1 | 02, 03, 04, 05, 06, 07, 09, 14, 19, 20, 23 | 24 | 0 | 72 | 0 | 11 | 25 | 0 | 0 |
| J2 | 08, 10, 11, 12, 13, 15, 16, 17 | 12 | 0 | 61 | 0 | 0 | 23 | 0 | 0 |
| J3 | 01, 21, 24 | 6 | 0 | 25 | 0 | 2 | 3 | 0 | 0 |
| J4 | 18, 22, 25, 26 | 20 | 1 | 14 | 0 | 4 | 9 | 0 | 0 |

Lecture d'ensemble : les actions métier (bloc 06) sont le bloc le plus avancé (16 cases DÉPLOYÉ) ; aucune liste n'est au standard (bloc 02 : 25 PARTIEL, 1 MANQUANT ; ni pagination, ni tri par colonne, ni vues enregistrées), aucun module ne gère de fichiers (bloc 08 : 16 MANQUANT, 10 PARTIEL ; aucun `supabase.storage`, service Storage absent de la pile), et aucune notification n'est complète (bloc 11 : aucun DÉPLOYÉ).

## 2. Synthèse par jalon

### J1. Recette (planning, poste, dispatch, rotation, relevés, ticket CBG, rapprochement, facture CBG, encaissement)

Modules 02, 03, 04, 05, 06, 07, 09, 14, 19, 20, 23 (et référentiels des modules 08 et 09). La chaîne est en production pour l'essentiel de ses actions métier (planification, postes, dispatch, cycle voyage, fiches terrain, tickets et relevés CBG, réconciliation, facture signée, encaissement). Les défauts bloquants relevés par le catalogue sont corrigés sur `main` par D-078 et D-079, **testés mais non déployés** (main 33ab8ef, déploiement non consigné) : shifts saisissables (`definir_shift`, pgTAP 61), ticket CBG sur trajet inter-sites (`saisir_rotation`), brut et tare en tonnes, voyage pesé sans ticket impossible (`garde_reception_cbg`, `rattacher_ticket_cbg`), objectifs bornés par site, chauffeur avec dates vides et site, comptes avec site obligatoire, sites sans perte d'organisation, tarifs et engagements sans suppression physique (pgTAP 60).

Écarts principaux, dans l'ordre de la chaîne :
1. Consigner le déploiement des PR #97 à #102 (sauvegarde, migrations `20261121140000` à `20261121170000`, pgTAP sur la base du serveur, fonction Edge `admin-utilisateurs` redéployée avec D-079).
2. Socle des pièces jointes (module 23, écart 1, L, bloquant J1) puis branchement sur tickets et relevés CBG, fiches signées, relevés kilométriques (module 23 écart 2, M ; modules 07 et 14). Dépend du service Storage, du Caddy partagé (D-069 point 2).
3. Ticket rectifié jamais facturable (module 14, D3, S) : question au propriétaire (D-078 point 7).
4. Litiges CBG de bout en bout (module 14 écart 5, M ; module 07 écart 5, M).
5. Listes au standard sur la chaîne : historique multi-jours des voyages (07, M), registre des tickets et fiche ticket (14, M), objectifs sur période (04, M), postes (05, M), journal du dispatch (06, M) ; dépend de DataTable, DetailDrawer, ExportModal.
6. Écritures encore directes ou incomplètes : sites par fonctions serveur journalisées (03, M), dossier contractuel par fonctions serveur avec contrôle de complétude (19, L), référentiel organisationnel (02, M).
7. Corrections tracées manquantes : annulation d'un poste et retrait d'un membre (05, M), événement correctif d'un voyage (07, M), annulation motivée d'un encaissement (20, S).
8. Parcours J1 de bout en bout rejoué contre une vraie base (E2E), guides de rôle, saisie réelle par le propriétaire, PV (07 écart 13, M) : aucune case UTILISABLE tant que ce n'est pas fait.

### J2. Coûts (Neemba, carburant, pneus, achats, stock)

Modules 08, 10, 11, 12, 13, 15, 16, 17 (et 20 pour les dettes). Registres en production : engins et fiche engin, immobilisations et interventions Neemba, pneus (D-052, D-067 déployée), carburant (registre, livraisons, inventaires), circuit achat, stock avec réservations (D-067). Testé non déployé : saisie atomique de la facture Neemba (`saisir_facture_fournisseur`, pgTAP 61), séparation des tâches étendue aux délégations (pgTAP 59), alerte d'écart d'inventaire carburant (pgTAP 51).

Écarts principaux :
1. Décompte de location serveur branché sur le contrôle de la facture Neemba (10 écart 6, L ; 20 écart 7, M) : dépend des paramètres de contrat saisis par le propriétaire (D-013).
2. Factures d'achat et rapprochement bon, réception, facture avant paiement (16 écart 1, L ; 20 écart 5, L).
3. Coût complet par engin et par tonne (08 écart 7, M ; 12 écart 5, M ; 17 écart 6, M) et bilan carburant mensuel figé par site (13 écart 6, M).
4. Corrections tracées : livraison et facture CBG de carburant (13 écart 1, M), annulation motivée d'une facture Neemba et champ TTC envoyé par l'écran (10 écart 2, M).
5. Imports pour la première saisie : registre des engins (08, M), pneus en stock et montés (12, M), articles et inventaire d'ouverture (17, M), répertoire fournisseurs (15, M), livraisons CBG (13, M) ; dépend d'ImportWizard.
6. Rattachement en masse des engins au contrat de location et contrôle « engin loué sans contrat » (08 écart 2, M ; 10 écart 4, M).
7. Contrôle budgétaire à l'approbation des achats (16 écart 2, M) et réclamations Neemba et fournisseurs (10 écart 5, 15 écart 3, M).

### J3. Pilotage (notifications, validations, Command Center, rapports)

Modules 01, 21, 24. En production : centre de pilotage (`indicateurs_pilotage`, D-057), mes validations et notifications (D-056), rapports et coûts directs (D-058). Testé non déployé : registre des alertes écrit par `actualiser_alertes()` (9 règles), centre des décisions, comparaison de périodes, export du tableau de bord (D-068, pgTAP 51) ; délégations d'écriture (D-064, pgTAP 47 et 59).

Écarts principaux :
1. Widgets finance du DG (facturé, encaissé, créances, coût par tonne, marge) et rapport financier de gestion (01 écart 6, M ; 21 écart 1, M).
2. Décision depuis la boîte de validations (24 écart 2, M), délais, relances et escalades (24 écart 5, M), tâches et commentaires (24 écart 4, M).
3. Tableaux de bord par profil et graphiques d'évolution (01 écart 5, M ; 21 écart 4, M).
4. Export Excel natif et PDF serveur (21 écart 6, M), modèles d'impression A4 (21 écart 3, S).
5. Restes de D-068 : menu Alertes encore lié au droit `reports` (`AuthContext.tsx`), route `quick-actions` orpheline (01 écart 7, S) ; alertes de sous-production absentes du catalogue (04 écart 4, M).

### J4. Extensions (HSE, moyens généraux, GED avancée, portails, intelligence)

Modules 18, 22, 25, 26 (et GED avancée du module 23). En production : moyens généraux (D-060), HSE de base (D-054), dispatch recommandé et décisions tracées (module 26, blocs 05 à 07). Testé non déployé : EPI, registre des risques versionné, plans de prévention, inspections (D-068). À ne pas commencer sans déclencheur (CLAUDE.md, section 9) : prévisions, OCR, portails, signature électronique, GPS.

Écarts principaux :
1. Tableau de bord HSE : seul `ESGTrackingView` existe, **maquette** encore au menu (22, bloc 01) ; retrait ou mention « non repris » (22 écart 5, S) ; rapport HSE mensuel (22 écart 10, M).
2. Droit dédié `hse` et cloisonnement des données de blessure (22 écart 11, S) : D-068 garde le droit `trips`.
3. Retrait des modules de droit `client_portal` et `ai_analytics` (25 écart 3, 26 écart 7, S) ; `client_portal` est désormais proposé à la délégation (`Settings/organisation.ts`).
4. Moyens généraux : pièces jointes, PV imprimables, exports (18 écarts 1 à 3, S) ; l'écran utilise encore `window.prompt`.
5. Portails (25) : 12 blocs MANQUANT, attendent l'accord du partenaire et un test d'isolation RLS.

## 3. Constats transverses

1. **Pièces jointes** : aucun stockage de fichiers dans le dépôt ; seul `type="file"` lit localement le relevé CBG sans le conserver. Bloc 08 jamais complet. Lot J1 prioritaire (module 23).
2. **Listes** : aucune liste paginée, triable par colonne, à colonnes configurables ou vues enregistrées ; plusieurs registres bornés (300 derniers tickets, 300 lignes de stock). DataTable, DetailDrawer, ActionDialog et HistoryDrawer sont attendus par les 26 modules.
3. **Décisions par `window.prompt`** : encore présentes (réconciliation, moyens généraux, carburant, achats, HSE) ; ActionDialog à créer sur la coquille `ui/Fenetre`.
4. **Historique** : les journaux serveur existent dans la plupart des modules (bloc 10 : 11 DÉPLOYÉ) mais ne sont pas affichés ; HistoryDrawer à créer.
5. **Notifications** : le registre des alertes D-068 et `mes_validations` couvrent une partie des événements ; relances, échéances et escalades manquent partout.
6. **Tests contre une vraie base** : les E2E tournent sur l'API simulée (`e2e/api-simulee.ts`) ; le parcours J1 de bout en bout contre une base réelle reste à faire.

## 4. Composants communs à créer (D-077)

Aucun des quatorze composants n'existe dans `src/components/ui/` au 33ab8ef. `ui/Fenetre.tsx` (PR #102, E2E `fenetres.spec.ts`) fournit la coquille commune des fenêtres (défilement, pied de fenêtre toujours visible, champs et boutons communs) et sert de base à CreateModal, EditModal et ActionDialog ; ce n'en est pas encore un. Modules qui attendent chaque composant (relevés dans la section « Composants communs attendus » de chaque module) :

| Composant | Nombre | Modules qui l'attendent |
|---|---|---|
| DataTable | 26 | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26 |
| CreateModal | 19 | 02, 03, 04, 05, 07, 08, 09, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 22, 23 |
| EditModal | 17 | 02, 03, 04, 05, 08, 09, 10, 11, 13, 15, 16, 17, 18, 19, 20, 22, 23 |
| DetailDrawer | 26 | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26 |
| DeleteDialog | 1 | 19 |
| ArchiveDialog | 6 | 08, 09, 12, 13, 15, 17 |
| ActionDialog | 26 | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26 |
| AttachmentModal | 18 | 04, 05, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 22, 23, 25 |
| ImportWizard | 14 | 02, 03, 04, 08, 09, 10, 12, 13, 14, 15, 17, 18, 23, 25 |
| ExportModal | 24 | 01, 02, 03, 04, 05, 06, 07, 08, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26 |
| HistoryDrawer | 26 | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26 |
| CommentThread | 8 | 05, 07, 10, 14, 15, 19, 24, 25 |
| AssignmentModal | 10 | 02, 05, 06, 08, 09, 10, 11, 16, 22, 24 |
| BulkActionBar | 21 | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 16, 17, 18, 20, 22, 23, 24 |

## 5. Détail par module

Pour chaque module : état et preuve de chaque bloc, changements vérifiés depuis la fiche, écarts ordonnés (repris de la fin de la fiche, taille S/M/L, dépendances, suivi) et composants communs attendus. « main 33ab8ef, déploiement non consigné » signale un apport fusionné après la dernière release consignée (8df078d).

<a id="module-01"></a>

### 01. Command Center (J3)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | TESTÉ | `Dashboard/DashboardView.tsx` lit `indicateurs_pilotage` du serveur (jour et veille, carburant validé de `mouvements_carburant`) et les alertes de `actualiser_alertes` ; `Pilotage/CentrePilotageView.tsx` avec filtres shift, engin, partenaire ; e2e `tableau-de-bord.spec.ts` (3), `centre-pilotage.spec.ts`, `decisions-hse.spec.ts` ; pgTAP `51_decisions_hse` (109) ; main 33ab8ef, déploiement non consigné (versions antérieures déployées, release 9cf47cf). Manquent : tableaux par profil, widgets finance DG, graphiques d'évolution au centre de pilotage |
| 02 Liste | PARTIEL | (existant testé, non déployé) `Decisions/CentreDecisionsView.tsx` : alertes et décisions groupées par priorité (`grouperParPriorite`, `decisions.test.ts`) ; ni recherche, ni filtre, ni tri choisi, ni pagination, ni vue enregistrée |
| 03 CRUD | PARTIEL | (existant testé, non déployé) alerte créée par le serveur seulement (`actualiser_alertes`, index unique règle et objet), consultée, jamais effacée (pgTAP 51) ; configuration des tableaux de bord et vues enregistrées MANQUANT |
| 04 Fiche détaillée | PARTIEL | (existant testé, non déployé) informations de l'alerte en ligne (détail, depuis, détectée le, condition levée) et bouton « Ouvrir » vers l'écran source (`CentreDecisionsView.tsx`) ; aucun DetailDrawer d'indicateur ni d'alerte, pas d'historique affiché |
| 05 Modals et formulaires | PARTIEL | (existant testé, non déployé) filtres et période de référence du centre de pilotage, motif de résolution saisi en ligne ; aucune fenêtre ActionDialog (accusé, résolution), configuration des widgets absente |
| 06 Actions métier | TESTÉ | `prendre_en_compte_alerte`, `resoudre_alerte` (motif obligatoire, droit d'écriture du module de la règle, périmètre) ; pgTAP 51, e2e `decisions-hse` « résolution motivée » ; main 33ab8ef, déploiement non consigné. Manque : résolution en masse |
| 07 Workflows | PARTIEL | (existant testé, non déployé) cycle active -> prise en compte -> résolue, `condition_levee_le`, pas de renaissance pour le même objet (migration `20261121150000_decisions_hse.sql`) ; ni délai, ni escalade au DG |
| 08 Documents | PARTIEL | (existant testé, non déployé) impression des tableaux par `imprimerTableau` / `documentImpression` (`src/lib/exports.ts`, `exports.test.ts`) avec période, filtres, source, heure ; pas de modèle A4 avec en-tête ni pièces (aucun `supabase.storage`) |
| 09 Rapports | PARTIEL | (existant testé, non déployé) CSV et impression du tableau de bord, du centre de pilotage (comparaison comprise) et du centre des décisions ; Excel natif et PDF absents (`exportToExcel` = CSV) |
| 10 Historique | PARTIEL | (existant testé, non déployé) colonnes `resolue_par`, `resolue_le`, `motif_resolution`, `acknowledged_by` écrites par fonction serveur ; aucun journal de configuration, historique non consultable à l'écran |
| 11 Notifications | PARTIEL | (existant testé, non déployé) compteur et raccourci de la barre supérieure sur les alertes (`Layout/TopBar.tsx:84`) ; aucune notification au responsable, aucune escalade |
| 12 Paramétrage | PARTIEL | (existant testé, non déployé) `catalogue_regles_alertes` (9 règles), seuils et activations `alerte_*` par `valider_reglage` (`Settings/reglages.ts`) ; configuration des widgets par profil MANQUANT |

**Changements depuis la fiche (vérifiés)** :
- D-068 (PR #99) : registre des alertes écrit par `actualiser_alertes()` seulement, `prendre_en_compte_alerte`, `resoudre_alerte`, `centre_decisions()`, `regles_alertes()` (migration `20261121150000_decisions_hse.sql`, pgTAP `51_decisions_hse.test.sql`, e2e `decisions-hse.spec.ts`) ; non déployé.
- `Alerts/AlertsView.tsx` supprimé, remplacé par `Decisions/CentreDecisionsView.tsx` (menu `alerts` « Centre des décisions », `menu.ts:34`) : défauts bloquants de la fiche levés.
- `indicateurs_pilotage(debut, fin, site, shift, vehicule, partenaire)` et colonne `nature` ; comparaison de deux périodes avec écart (`Pilotage/pilotage.ts`, `comparerIndicateurs`, `pilotage.test.ts`) ; export CSV et impression (`CentrePilotageView.tsx:86-87`).
- Tableau de bord sur les indicateurs serveur (plus de lecture de `fuel_transactions` dans `DashboardView.tsx`), export et impression (`DashboardView.tsx:302-303`).
- Reste : menu `alerts` toujours sous le droit `reports` (`AuthContext.tsx:267`) ; route `quick-actions` toujours sans entrée de menu.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Réparer les alertes : colonnes réelles, fonctions d'accusé et de résolution, menu aligné | S | aucune | partiellement traité par D-068 (`resoudre_alerte`, `prendre_en_compte_alerte`, pgTAP 51), non déployé ; menu encore sous `reports` |
| 2 | Producteur d'alertes paramétrable sur données réelles, notification au responsable | M | modules 09, 10, 13, 14, 20 ; seuils du propriétaire | partiellement traité par D-068 (9 règles, seuils `alerte_*`), non déployé ; notification et budget dépassé non couverts |
| 3 | Tableau de bord exploitation sur le registre carburant, export et impression | S | aucune | traité par D-068 (`DashboardView.tsx` sur `indicateurs_pilotage`, e2e `tableau-de-bord`), non déployé |
| 4 | Comparaison de périodes, ventilation par shift, engin, partenaire | M | aucune | traité par D-068 (`indicateurs_pilotage` 6 paramètres, `comparerIndicateurs`, e2e `decisions-hse`), non déployé |
| 5 | Tableaux de bord par profil, configuration des widgets, graphiques d'évolution | M | DetailDrawer, ExportModal | ouvert |
| 6 | Widgets finance DG (facturé, encaissé, créances, coût par tonne, marge) | M | module 20, D-058 | ouvert |
| 7 | Rattacher ou retirer les actions rapides | S | aucune | ouvert |
| 8 | Prévisions | L | déclencheur (fiche, point 14) | ouvert |

**Composants communs attendus** : DataTable (centre des décisions, alertes), DetailDrawer (explication d'indicateur, détail d'alerte), ActionDialog (prise en compte, résolution motivée), ExportModal (CSV, impression des tableaux), HistoryDrawer (historique d'une alerte), BulkActionBar (résolution en masse). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal/EditModal, et n'est pas utilisée par ce module.

<a id="module-02"></a>

### 02. Organisation et administration (socle J1)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | MANQUANT | aucun widget d'administration (comptes par rôle et site, comptes sans MFA, délégations expirant, connexions) |
| 02 Liste | PARTIEL | PARTIEL (existant déployé 8df078d) : `AdminSettingsView.tsx` liste des comptes avec recherche nom/e-mail ; en-tête corrigé à 6 colonnes (D-079, main 33ab8ef, déploiement non consigné) ; ni filtre rôle/site/statut, ni tri, ni pagination, ni export ; organisations : liste simple |
| 03 CRUD | PARTIEL | comptes : création Edge `admin-utilisateurs` (déployée), désactivation/réactivation par `desactiver_compte` / `reactiver_compte` motivées (D-079, pgTAP 60, E2E `saisie-referentiels`, TESTÉ, non consigné) ; devises et unités (D-064, `enregistrer_devise`, `enregistrer_unite`, pgTAP 47, TESTÉ) ; organisations : création seule (ni modification ni désactivation) ; directions, services, centres de coûts : MANQUANT ; duplication des droits MANQUANT |
| 04 Fiche détaillée | MANQUANT | aucun DetailDrawer de compte (connexions, droits, affectations, délégations, historique) ; `UserModal` est un formulaire d'édition |
| 05 Modals et formulaires | TESTÉ | `UserModal.tsx` sur `ui/Fenetre` (PR #102, E2E `fenetres` « utilisateur ») : site obligatoire ou global motivé, motif des droits exigé, erreurs serveur affichées (D-079, E2E `saisie-referentiels`) ; dialogue de changement de statut avec motif (`AdminSettingsView.tsx:88-109`) ; main 33ab8ef, déploiement non consigné ; restent saisie d'organisation en ligne, import et export absents |
| 06 Actions métier | TESTÉ | créer, désactiver, réactiver motivé (D-079, pgTAP 60) ; affecter un site daté, clore, annuler, rétablir le global (`affecter_site`, `retablir_perimetre_global`) ; déléguer, révoquer (`deleguer_droit`, `revoquer_delegation`) (D-064, pgTAP 47 et 59, E2E `organisation`) ; main 33ab8ef, non consigné ; manquent révocation des sessions, copie de droits, actions en masse |
| 07 Workflows | PARTIEL | délégations datées avec statut (programmée, en vigueur, expirée, révoquée, sans effet) et séparation des tâches étendue au délégant (D-064, pgTAP 59, TESTÉ, non consigné) ; aal2 sur les changements sensibles (D-040, déployé, non activé) ; revue périodique des accès et approbation de création de compte MANQUANT |
| 08 Documents | MANQUANT | aucune fiche d'habilitation imprimable, aucun registre des comptes, aucune pièce jointe (`supabase.storage` absent de `src/`) |
| 09 Rapports | MANQUANT | aucun export CSV/PDF des comptes, droits effectifs, journal des droits ou journal de connexion (`JournalConnexions.tsx` sans export) |
| 10 Historique | PARTIEL | journaux serveur append-only : `journal_droits_modules` (déployé), `journal_comptes` (D-079), `journal_affectations_sites`, `journal_delegations`, `retours_perimetre_global` (D-064), TESTÉS, non consignés ; seul `v_journal_connexions` a un écran (`JournalConnexions.tsx`) ; aucun écran d'historique des droits ni des comptes (`grep journal_comptes src` vide) ; réglages sans historique |
| 11 Notifications | MANQUANT | aucune notification (délégation reçue ou expirant, compte sensible sans MFA) |
| 12 Paramétrage | PARTIEL | réglages serveur `ReglagesServeur.tsx` / `valider_reglage` (D-061, déployé), bouton réservé à l'administrateur (D-079) ; `Referentiels.tsx` devises, unités, `sequences_numerotation()` en lecture (D-064, TESTÉ, non consigné) ; référentiel organisationnel (directions, services, centres de coûts) et modèles de documents et notifications MANQUANT ; formats de numérotation codés dans chaque fonction |

**Changements depuis la fiche (vérifiés)** :
- D-064 (PR #97, migration `20261121140000_organisation`) fusionné : onglets `AffectationsSites`, `Delegations`, `JournalConnexions`, `Referentiels` importés dans `AdminSettingsView.tsx:6-9,124,344-347` ; pgTAP 47 et 59 ; E2E `organisation.spec.ts` (3 tests). Main 33ab8ef, déploiement non consigné.
- D-079 (PR #101, migration `20261121170000_saisie_referentiels`) : site obligatoire à la création, global motivé (`UserModal.tsx:189-193`, `definir_site_compte` l. 225, Edge `admin-utilisateurs`) ; `desactiver_compte` / `reactiver_compte` avec motif et `journal_comptes` (`AdminSettingsView.tsx:99`) ; garde `profiles_garde_comptes` (dernier administrateur) ; motif exigé pour les droits (`UserModal.tsx:250`) ; en-tête de liste à 6 colonnes (`AdminSettingsView.tsx:229-234`) ; réglages enregistrables par l'administrateur seul. pgTAP 60, E2E `saisie-referentiels.spec.ts` (tests l. 119, 146, 179).
- PR #102 : `UserModal` et `AdminSettingsView` importent `ui/Fenetre` ; E2E `fenetres.spec.ts` « utilisateur ».
- Non corrigé : `AuthContext.tsx:153` écrit encore `profiles.last_login` en direct (limite consignée par D-079).

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Défauts 1 à 6 de la fiche : site à la création, désactivation serveur motivée, en-tête, droits d'écran des réglages, motif des droits, dernière connexion | S | aucune ; prioritaire | partiellement traité : défauts 1, 3, 4, 5, 6 traités par D-079 (pgTAP 60, E2E `saisie-referentiels`), non déployé ; défaut 2 (`last_login`, `AuthContext.tsx:153`) ouvert |
| 2 | Revue et fusion de D-064 (affectations, délégations, journal de connexion, référentiels) ; décision du propriétaire sur la délégation de l'approbation et la durée maximale | M | revue indépendante | traité par D-064 (PR #97, pgTAP 47 et 59, revue et contre-revue consignées), non déployé ; décisions du propriétaire ouvertes |
| 3 | Organisations complètes : modification, désactivation motivée, type, sigle, NIF, RCCM, organisation mère ; `profiles.organisation_id` | S | lot 2 | ouvert |
| 4 | Référentiel organisationnel (directions, départements, services, unités, centres de coûts) et remplacement de la liste codée en dur des départements | M | organigramme du propriétaire ; module 20 | ouvert |
| 5 | Matrice des rôles en consultation, droits effectifs par compte, export | S | lot 2 | ouvert |
| 6 | Journal unifié des comptes et écran Historique des droits | S | lot 1 | partiellement traité : `journal_comptes` créé par D-079 (non déployé) ; aucun écran |
| 7 | Révocation des sessions d'un compte (API GoTrue à vérifier) | S | lot 2 | partiellement traité : `sessions_ouvertes()` en lecture (D-064), révocation ouverte |
| 8 | Droits par action et par état de dossier | L | décision du propriétaire ; catalogue des actions | ouvert |
| 9 | Modèles de documents et de notifications versionnés | M | modules 23, 24 | ouvert |
| 10 | Tableau de bord d'administration et exports | S | lots 2 et 6 | ouvert |

**Composants communs attendus** : DataTable (liste des comptes), CreateModal (compte, organisation), EditModal (compte), DetailDrawer (fiche compte), ActionDialog (désactivation, révocation, retour global), HistoryDrawer (journal des droits et des comptes), ImportWizard (comptes en masse), ExportModal (comptes et droits), BulkActionBar (désactiver, changer de site), AssignmentModal (affectation de site). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal/EditModal.

<a id="module-03"></a>

### 03. Sites et infrastructures (socle J1)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | `SitesView.tsx:97-171` : total, actifs, capacité déclarée en tonnes et nombre de sites sans capacité (D-079, remplace le « stock » saisi), calculés sur la liste chargée sans heure de calcul ; aucun indicateur de fermetures, points de chargement ouverts, incidents par site |
| 02 Liste | PARTIEL | PARTIEL (existant déployé) : `SitesView.tsx` cartes, recherche robuste à une ville ou adresse vide et filtre par type (D-079, main 33ab8ef, déploiement non consigné) ; ni tri, ni pagination, ni export, ni filtre actif/organisation |
| 03 CRUD | PARTIEL | site : création et modification avec organisation, coordonnées et responsable conservés (D-079, E2E `saisie-referentiels` l. 34 et 59, pgTAP 60, TESTÉ, non consigné) ; désactivation par update direct sans motif (`SitesView.tsx:45-49`), réactivation par le formulaire ; infrastructures : création et archivage déployés (D-047, pgTAP 30), aucun formulaire de modification ni restauration ; aucune duplication |
| 04 Fiche détaillée | MANQUANT | aucune fiche de site (infrastructures, fermetures, distances, comptes, engins, historique) |
| 05 Modals et formulaires | TESTÉ | `SiteModal.tsx` sur `ui/Fenetre` : latitude et longitude facultatives contrôlées ensemble (`verifierCoordonnees`, l. 76), capacité en tonnes, responsable parmi `comptes_selectionnables()`, erreur serveur affichée ; E2E `saisie-referentiels`, `fenetres` « site » ; main 33ab8ef, non consigné ; restent `window.prompt` (levée de fermeture, `InfrastructuresView.tsx:67`) et `confirm` (désactivation de site) |
| 06 Actions métier | DÉPLOYÉ | déclarer et lever une fermeture motivée, archiver une infrastructure, refus du dispatch vers un site fermé (`garde_dispatch_site_ferme`, D-047, D-072 ; pgTAP 30, 52, E2E `infrastructures`) ; manquent désactivation motivée avec contrôle des dépendances et actions en masse |
| 07 Workflows | PARTIEL | PARTIEL (existant déployé) : fermeture planifiée, en cours, levée, avec effet sur le dispatch ; aucune notification des dispatchers, aucune approbation, aucun horaire d'activité |
| 08 Documents | MANQUANT | aucune fiche de site ni avis de fermeture imprimable ; aucune pièce jointe (`supabase.storage` absent) |
| 09 Rapports | MANQUANT | aucun export des sites, infrastructures, fermetures, distances |
| 10 Historique | PARTIEL | auteur fixé par le serveur pour infrastructures et fermetures (`cree_par`, `declare_par`, nouvelle `levee_par`, déclencheur `auteur_serveur`, fonction `auteur_infrastructure_site`, D-079, pgTAP 60, TESTÉ, non consigné) ; fermetures jamais supprimées (déployé) ; `sites` sans journal (update direct) |
| 11 Notifications | MANQUANT | aucune notification de fermeture déclarée, levée ou imminente |
| 12 Paramétrage | PARTIEL | types d'infrastructure (CHECK, D-047) et distances de référence (D-043, `KilometrageView`) déployés ; organisations comme référentiel (module 02) ; horaires d'activité, zones d'exploitation, tronçons, import du référentiel MANQUANT ; `sites.code` absent |

**Changements depuis la fiche (vérifiés)** :
- D-079 (PR #101, migration `20261121170000_saisie_referentiels`, pgTAP 60, E2E `saisie-referentiels`) : `SitesView.tsx:17` charge `organisation_id`, `latitude`, `longitude`, `responsable_id` (défaut 1 corrigé) ; colonnes `sites.latitude` / `longitude` numeric(9,6) bornées, saisies ensemble ; capacité en tonnes strictement positive (contrainte NOT VALID) ; `current_stock` non saisissable (déclencheur `garde_saisie_site`, migration l. 98) ; responsable = compte (`responsable_id`, `comptes_selectionnables()`), `manager_id` gelé ; recherche robuste ; `cree_par`, `declare_par`, `levee_par` par déclencheur `auteur_serveur`. Main 33ab8ef, déploiement non consigné.
- PR #102 : `SiteModal.tsx:4,125` utilise `ui/Fenetre` ; E2E `fenetres.spec.ts` « site ».

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Correctifs 1, 3, 5 (organisation conservée, recherche robuste, responsable = compte) et E2E création / modification / désactivation | S | aucune ; prioritaire | partiellement traité par D-079 (E2E `saisie-referentiels` création et modification), non déployé ; E2E de désactivation ouvert |
| 2 | Migration additive : code, coordonnées GPS facultatives (source, précision), unité de capacité, retrait de `current_stock` ; mêmes coordonnées sur `infrastructures_site` | S | revue indépendante | partiellement traité par D-079 : latitude, longitude, capacité en tonnes, `current_stock` gelé (non déployé) ; `sites.code`, source et précision des coordonnées, coordonnées des infrastructures ouverts |
| 3 | Écriture des sites par fonctions serveur journalisées (désactivation motivée avec dépendances) ; auteur serveur des infrastructures et fermetures | M | lot 2 | partiellement traité : auteur serveur par D-079 (non déployé) ; `sites` reste en écriture directe sous RLS, sans journal |
| 4 | Fiche détaillée de site ; liste au standard (tri, pagination, filtres, export) | M | lot 3 ; DataTable, DetailDrawer | ouvert |
| 5 | Import CSV des sites et infrastructures | S | lot 2 ; ImportWizard | ouvert |
| 6 | Carte des sites dont les coordonnées sont saisies | S | lot 2 | ouvert (coordonnées désormais disponibles, non déployées) |
| 7 | Horaires et périodes d'activité lus par le dispatch | M | modules 05, 06 | ouvert |
| 8 | Notifications de fermeture | S | module 24 | ouvert |
| 9 | Zones d'exploitation et tronçons de piste | L | décision du propriétaire ; PostGIS | ouvert |
| 10 | Détection de géorepérage | L | extension à déclencheur GPS | ouvert (non commencé, déclencheur) |

**Composants communs attendus** : DataTable (liste des sites et infrastructures), CreateModal et EditModal (site, infrastructure), DetailDrawer (fiche de site), ActionDialog (désactivation motivée, levée de fermeture), HistoryDrawer (journal des sites), ImportWizard (référentiel CSV), ExportModal (sites, fermetures), BulkActionBar (désactiver, rattacher). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal/EditModal.

<a id="module-04"></a>

### 04. Production Planning (J1)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | Existant déployé 8df078d : cartes réalisé / objectif, projection fin de shift étiquetée, camions nécessaires sur 14 jours, réalisé par destination, heure de fraîcheur (`CarteObjectif.tsx`, `plan.ts`, `v_realisation_objectifs`, E2E `planification.spec.ts`). Manquent : alerte de sous-production, tendance planifié / réalisé, causes d'écart par catégorie (données présentes, aucun graphique) |
| 02 Liste | PARTIEL | Existant déployé : cartes d'une seule date (`PlanificationView.tsx:48`). Aucune liste sur période (recherche, filtres site / shift / statut, tri, pagination, export), aucune vue semaine ou mois |
| 03 CRUD | TESTÉ | Créer, réviser (nouvelle version motivée), annuler motivé, consulter : déployés (`definir_objectif`, `annuler_objectif`, pgTAP 10). La version conforme, bornée par `site_permis` avant toute lecture, n'est que testée : migration `20261121160000` (D-078 point 6), pgTAP 61 section 6 ; main 33ab8ef, déploiement non consigné. Manquent : duplication d'un plan, brouillon hebdomadaire |
| 04 Fiche détaillée | PARTIEL | Existant déployé : fenêtre Historique des versions (`FenetresObjectif.tsx`, `HistoriqueObjectif`). Manquent : composition du réalisé (voyages livrés et tickets CBG d'un objectif), pièces jointes (plan signé, PV), aucun stockage de fichiers |
| 05 Modals et formulaires | DÉPLOYÉ | Définir / réviser, annuler (motif), ventiler, clôture avec causes : déployés (E2E `planification.spec.ts`, `planification-avancee.spec.ts`, pgTAP 10 et 46). Depuis, coquille commune `ui/Fenetre.tsx` (PR #102, E2E `fenetres.spec.ts` « définir un objectif ») et message « aucun site » (E2E `base-vide.spec.ts`) : testés, non déployés. Validation en temps réel des tonnes ventilées restantes : au clic seulement |
| 06 Actions métier | PARTIEL | Existant déployé : définir, réviser, annuler, ventiler, simuler et retenir un scénario, clôturer, annuler la clôture (pgTAP 46). Annulation bornée au site : TESTÉ (pgTAP 61). Manquent : duplication, définition en masse, clôture de plusieurs journées, commentaire |
| 07 Workflows | PARTIEL | Existant déployé : plan initial, révision motivée, rattrapage par simulation puis révision, clôture avec séparation selon `planification_cloture_separee`. Séparation renforcée contre les délégations (`cloturer_planification`, `auteur_ou_delegant`, D-064, pgTAP 59) et délégation générique `deleguer_droit` : testées, non déployées. Manquent : approbation du plan hebdomadaire, relance des journées non closes, délais |
| 08 Documents | PARTIEL | Existant déployé : impression navigateur du rapport de production (`ClotureProduction.tsx:226`, `printDocument`). Manquent : import de plan, plan du jour et PV de clôture imprimables, pièces jointes (aucun `supabase.storage` dans `src`) |
| 09 Rapports | DÉPLOYÉ | `rapport_production` par période en CSV et impression (`ClotureProduction.tsx:220-226`), comparaison des shifts en CSV (`ComparaisonShifts.tsx`). Manquent : export des objectifs et versions, rapport mensuel PDF (module 21) |
| 10 Historique | DÉPLOYÉ | Versions d'objectif (auteur, heure, motif, remplacé / annulé par qui), clôture figée et annulation tracée (`clotures_planification.annule_par`, `motif_annulation`), pgTAP 10 et 46. Manquent : diff entre versions, journal transverse |
| 11 Notifications | MANQUANT | Aucune notification d'objectif révisé, de sous-production, de journée non close ni de journée close sous l'objectif ; le catalogue d'alertes D-068 (9 règles, `catalogue_regles_alertes`) n'en contient aucune pour la planification |
| 12 Paramétrage | PARTIEL | Existant déployé : réglage `planification_cloture_separee` (`reglages.ts:51`). Seuils d'échantillon (3 jours, 10 voyages, 10 mesures) codés, catégories de causes figées par CHECK (11 valeurs), aucune tolérance d'écart paramétrable |

**Changements depuis la fiche (vérifiés)** :
- D-078 point 6 : `definir_objectif` et `annuler_objectif` contrôlent `site_permis` avant toute lecture (`20261121160000_defauts_bloquants_j1.sql:770` et suivantes) ; objectif hors périmètre indiscernable d'un inexistant ; pgTAP `61_defauts_bloquants_j1.test.sql` section 6 (lignes 331-345). Corrige l'écart E1. Main 33ab8ef, déploiement non consigné.
- Référentiel vide : bouton « Définir un objectif » inactif et bandeau `SANS_SITE` (`PlanificationView.tsx`), refus client sans site (`FenetresObjectif.tsx`, `valider`), message de clôture sans site (`ClotureProduction.tsx`) ; E2E `base-vide.spec.ts` (fusionné avec PR #100).
- PR #102 : fenêtres de la planification sur `ui/Fenetre.tsx` (pied toujours visible, erreur `ErreurFenetre`), E2E `fenetres.spec.ts`.
- D-064 (PR #97) : `cloturer_planification` refuse aussi le délégant ou le délégué (séparation fondée sur l'écriture), pgTAP 59.
- Non corrigé : erreurs de lecture de `work_shifts` et `vehicles` toujours ignorées (`PlanificationView.tsx:64-71`) ; sites de chargement non filtrés par type.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Borner `definir_objectif` et `annuler_objectif` par `site_permis`, pgTAP de refus | S | D-075 | traité par D-078 (migration 20261121160000, pgTAP 61), non déployé |
| 2 | Message « aucun site », filtre des sites de chargement par type, affichage des erreurs de lecture shifts et engins | S | Module 03 | partiellement traité : message « aucun site » (D-078, E2E base-vide) ; filtre par type et erreurs de lecture ouverts |
| 3 | Liste des objectifs sur période (DataTable, export CSV) et vue semaine | M | DataTable | ouvert |
| 4 | Alertes de sous-production vers notifications et Command Center | M | Module 24, seuil du propriétaire | ouvert (absent du catalogue D-068) |
| 5 | Duplication d'un plan et définition en masse par `definir_objectif` | M | - | ouvert |
| 6 | Plan hebdomadaire en brouillon puis approbation par la direction | M | Décision du propriétaire | ouvert |
| 7 | Drawer « composition du réalisé » (voyages et tickets CBG) | S | Modules 07 et 14 | ouvert |
| 8 | Cause d'écart rattachée à un objectif de shift depuis l'écran | S | - | ouvert |
| 9 | PV de clôture et plan du jour imprimables | S | - | ouvert |
| 10 | Relance des journées non closes, journal transverse | M | Module 24 | ouvert |
| 11 | Seuils d'échantillon et tolérance d'écart en réglages ; confirmer `planification_cloture_separee` absent = non exigée | S | Propriétaire (D-063) | ouvert |
| 12 | Pièces jointes (plan signé, PV) | S | Socle pièces jointes J1 | ouvert |
| 13 | Import CSV d'un plan mensuel | M | ImportWizard | ouvert |
| 14 | E2E référentiel vide et parcours J1 contre une vraie base | M | Conteneur de rejeu (D-069 point 3) | partiellement traité : E2E `base-vide.spec.ts` (API simulée) ; vraie base ouvert |

**Composants communs attendus** : DataTable (objectifs sur période), CreateModal (définir un objectif), EditModal (révision), DetailDrawer (composition du réalisé), ActionDialog (annulation, clôture motivées), HistoryDrawer (versions d'objectif), AttachmentModal (plan signé, PV), ImportWizard (plan mensuel), ExportModal (objectifs, rapport), BulkActionBar (définition et clôture en masse). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal / EditModal.

<a id="module-05"></a>

### 05. Shift Management (J1)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | MANQUANT | Aucun tableau de bord du module ; seul le shift en cours est affiché dans `TopBar.tsx` et les postes ouverts / à valider sont comptés hors module (`indicateurs_exploitation`, module 21). Postes non ouverts, taux de présence, objectif du poste en cours : absents |
| 02 Liste | PARTIEL | Existant déployé : postes d'une date (`PostesView.tsx:43`), sans filtre site, shift, statut, ni pagination ni export. Nouvelle liste des shifts (`ShiftsView.tsx`, ordre, journal des 50 dernières actions) : testée (E2E `defauts-bloquants.spec.ts`), main 33ab8ef, déploiement non consigné |
| 03 CRUD | PARTIEL | Poste : création et consultation déployées (`ouvrir_poste`, pgTAP 31). Modèle d'horaire : création, modification motivée, désactivation motivée par `definir_shift` / `desactiver_shift`, écritures directes retirées (D-078, pgTAP 61 section 1) : testé, non déployé. Manquent : annulation ou réouverture motivée d'un poste, retrait d'un membre, reprise d'équipe, équipes permanentes |
| 04 Fiche détaillée | PARTIEL | Existant déployé : passation, équipe, journal, bilan dans `PostesView.tsx:124-163`. Auteurs et heures d'ouverture, de clôture et de validation non affichés ; membre engin sans immatriculation ; aucune pièce jointe |
| 05 Modals et formulaires | PARTIEL | Existant déployé : panneaux en ligne (ouverture, ajout de chauffeur, événement, clôture). Pointage par `window.prompt` (`PostesView.tsx`, `pointer`), retard non numérique envoyé `null` sans message ; responsable et engin absents. Formulaire « Saisie du shift » avec contrôle client du chevauchement (`shifts.ts`, `erreurSaisieShift`, `shifts.test.ts`) : testé, non déployé |
| 06 Actions métier | PARTIEL | Existant déployé : ouvrir, clore, valider (autre personne), ajouter un chauffeur, pointer (pgTAP 31, 53). Manquent : ajout d'engin et de relève à l'écran, pointage et validation en masse, annulation et réouverture motivées |
| 07 Workflows | PARTIEL | Existant déployé : clôture puis validation par une autre personne, Mes validations (D-056). Séparation étendue aux délégations dans `valider_cloture_poste` (D-064, `auteur_ou_delegant`, `separation_violee`, pgTAP 59) : testée, non déployée. Manquent : relances et escalades (poste non ouvert, non clos, clôture non validée), délais |
| 08 Documents | PARTIEL | Existant déployé : impression de la page entière (`PostesView.tsx`, `window.print()`). Aucun modèle de rapport de poste, aucune pièce signée jointe (aucun `supabase.storage` dans `src`) |
| 09 Rapports | DÉPLOYÉ | `rapport_shift` (module 21, pgTAP 41, `ReportsView`) en CSV et impression ; comparaison entre shifts en CSV (`ComparaisonShifts.tsx`, pgTAP 46, E2E `planification-avancee.spec.ts`). Manquent : liste des postes d'une période, présences et retards par chauffeur |
| 10 Historique | PARTIEL | Existant déployé : journal des événements append-only (pgTAP 31), bilan figé. Pointages par `UPDATE` en place sans auteur ni heure. Journal append-only `journal_shifts` (avant, après, motif, auteur ; pgTAP 61) : testé, non déployé |
| 11 Notifications | PARTIEL | Existant déployé : clôture à valider (Mes validations) et clôture validée (`notifier_validation_poste`, `20261117180000`), sans test pgTAP de la partie poste. Manquent : shift commencé sans poste, relances, événement sécurité vers HSE |
| 12 Paramétrage | TESTÉ | Référentiel des shifts enfin saisissable : écran Exploitation > Shifts (`menu.ts:32`, `ShiftsView.tsx`), `definir_shift` (nom et libellé uniques sans casse, fin = début refusée, nuit franchissant minuit, chevauchement refusé entre actifs, heures figées si le shift est cité), `desactiver_shift` ; pgTAP 61, E2E `defauts-bloquants.spec.ts`, unitaires `shifts.test.ts` ; main 33ab8ef, déploiement non consigné. Manquent : catégories d'événements (CHECK figé), règles de clôture, sites d'application d'un shift |

**Changements depuis la fiche (vérifiés)** :
- D-078 point 1 (PR #100) : défaut bloquant B1 corrigé. `definir_shift`, `desactiver_shift`, `journal_shifts` immuable, politiques d'écriture de `work_shifts` retirées (`20261121160000_defauts_bloquants_j1.sql:54-258`) ; droit settings ou administrateur, profil sans site ; pgTAP 61 lignes 21-168 et 210 (heures d'un shift cité figées, point 15).
- Écran `src/components/Shifts/ShiftsView.tsx` (liste, création, modification motivée, désactivation, journal, erreur de lecture du journal affichée), menu `shifts`, `App.tsx:241` ; E2E `defauts-bloquants.spec.ts` « création d'un shift puis ouverture d'un poste ».
- `PostesView.tsx` : erreurs de lecture des shifts, sites et chauffeurs affichées ; bandeaux `SANS_SITE`, `SANS_SHIFT` (lien vers Shifts) et « aucun chauffeur actif » ; aucun identifiant vide envoyé ; E2E `base-vide.spec.ts`.
- D-064 (PR #97) : `valider_cloture_poste` refuse le délégant ou le délégué de l'auteur de la clôture (pgTAP 59, 33 assertions).
- Non corrigé : responsable toujours `null`, `p_vehicle_id: null`, pointage par `window.prompt`.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Référentiel des shifts : fonction serveur journalisée, écran, retrait de l'écriture directe, message « aucun shift » dans les écrans lecteurs (B1) | M | Horaires réels du propriétaire ; droit d'écriture | traité par D-078 (`definir_shift`, `desactiver_shift`, `ShiftsView`, pgTAP 61, E2E defauts-bloquants), non déployé ; horaires réels à saisir par le propriétaire |
| 2 | Écran du poste : responsable, engins et relèves, heure et engin d'un événement, modal de pointage, erreurs de lecture | S | Modules 08, 09 | partiellement traité : erreurs de lecture affichées (D-078) ; le reste ouvert |
| 3 | Journal des pointages et des ajouts, auteurs et heures du poste affichés, HistoryDrawer | M | HistoryDrawer | ouvert |
| 4 | Retrait motivé d'un membre, annulation d'un poste ouvert, réouverture d'une clôture non validée | M | Propriétaire ; revue indépendante | ouvert |
| 5 | Objectif et réalisé en direct dans le poste, voyages du poste, avertissements d'habilitation et d'immobilisation | S | Modules 04, 06, 09, 11 | ouvert |
| 6 | Liste des postes (filtres, pagination, export CSV et PDF), tableau de bord du module | M | DataTable, ExportModal | ouvert |
| 7 | Équipes permanentes, cycle de rotation, reprise et pointage en masse | L | Cycle réel du propriétaire | ouvert |
| 8 | Relances et escalades, notification des événements sécurité | M | Module 24 ; délais du propriétaire | ouvert |
| 9 | Modèle d'impression du rapport de poste, pièce signée jointe | M | Pièces jointes J1 | ouvert |
| 10 | Historique par chauffeur et par engin, présences exportables | S | Module 09 | ouvert |
| 11 | Tests : notifications de poste, écriture des shifts, E2E référentiel vide et validation, parcours J1 sur vraie base | M | Lots 1 à 4 | partiellement traité : écriture des shifts (pgTAP 61), référentiel vide (E2E base-vide, defauts-bloquants) ; notifications, validation E2E et vraie base ouverts |

**Composants communs attendus** : DataTable (postes, shifts), CreateModal (shift, ouverture de poste), EditModal (modification motivée d'un shift), DetailDrawer (poste : auteurs, membres, voyages), ActionDialog (clôture, validation, annulation, réouverture), AssignmentModal (membre chauffeur, engin, relève), HistoryDrawer (pointages et journal des shifts), AttachmentModal (rapport signé), ExportModal (postes, présences), BulkActionBar (pointage et validation en masse), CommentThread (consignes). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal / EditModal ; `ShiftsView` et `PostesView` ne l'utilisent pas.

<a id="module-06"></a>

### 06. Dispatch et affectation (J1)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | Existant déployé (migrations jusqu'à `20261121100000`, release 3dc77d4) : 5 compteurs du shift avec `Provenance` et heure, objectif et nombre de voyages proposé (`statistiques_rotation`), capacité par scénario (`simulation.ts`). Manquent : taux d'acceptation, motifs de refus, attente au chargement, utilisation des chargeuses et de la pelle |
| 02 Liste | PARTIEL | Existant déployé : tableau des recommandations à affecter (sélection), file « à réaffecter », journal des 200 dernières décisions du shift sans filtre, pagination ni export (`DispatchView.tsx`). Manquent : file des camions libres, file d'attente au chargement |
| 03 CRUD | PARTIEL | Existant déployé : voyages préparés (`preparer_voyages`, pgTAP 11), décisions créées et immuables (`decider_affectation`, `affecter_en_groupe`, `enchainer_voyage`, pgTAP 49). Manquent : duplication du plan de la veille, priorité d'un voyage, règles et seuils du dispatch (aucun objet) |
| 04 Fiche détaillée | MANQUANT | Aucune fiche d'une décision : la colonne `avant` et la recommandation figée sont stockées mais non affichées ; l'historique des affectations d'un voyage n'apparaît pas dans `FicheVoyage` |
| 05 Modals et formulaires | DÉPLOYÉ | Fenêtre de décision (modifier, refuser, réaffecter, motif obligatoire, `FenetreDecision.tsx`), rapport d'affectation groupée, voyage suivant (E2E `dispatch.spec.ts`, `dispatch-voyages.spec.ts`). Passage sur `ui/Fenetre.tsx` (PR #102) : testé, non déployé. Manque : confirmation avant « Tout accepter » |
| 06 Actions métier | DÉPLOYÉ | Préparer N voyages, accepter, accepter la sélection ou tout (300 max, rapport par voyage), modifier, refuser, réaffecter motivé, enchaîner (pgTAP 11, 49, 58 ; E2E `dispatch.spec.ts`, `dispatch-voyages.spec.ts`). Manquent : réaffectation en masse, désaffectation, réaffectation d'un voyage `INTERRUPTED`, priorités |
| 07 Workflows | PARTIEL | Existant déployé : objectif, préparation, recommandation expliquée, décision humaine, réaffectation, enchaînement, contraintes serveur (habilitations, site fermé, périmètre). Manquent : délais et relances (voyage préparé sans camion après le début du shift), délégation propre au dispatch (seule la délégation générique `deleguer_droit` D-064 existe, testée, non déployée) |
| 08 Documents | MANQUANT | Aucun plan d'affectation du shift imprimable ; aucune pièce jointe (aucun `supabase.storage` dans `src`) |
| 09 Rapports | MANQUANT | Aucun export du journal des décisions, aucun rapport de dispatch (taux d'acceptation, motifs, délais) ; `src/lib/exports.ts` non utilisé par le module |
| 10 Historique | DÉPLOYÉ | `decisions_dispatch` immuable (recommandation figée, état `avant`, motif, auteur, heure, FK RESTRICT, aucun privilège d'écriture), marquage des opérations groupées et de l'enchaînement ; pgTAP 11, 49. Consultation limitée au journal du shift |
| 11 Notifications | MANQUANT | Voyage à réaffecter, voyages sans camion, site fermé : visibles à l'écran seulement ; aucune règle du catalogue d'alertes D-068 ne porte sur le dispatch |
| 12 Paramétrage | MANQUANT | Seuils et règles codés dans l'écran (D-066, limites) ; aucun réglage, priorité ni motif de refus paramétrable |

**Changements depuis la fiche (vérifiés)** :
- Défauts bloquants « référentiel vide » corrigés (commit 8f95588, fusionné par 8aba4dd dans PR #100) : `preparer` refuse sans site, shift ou destination ; bouton inactif et panneau « Préparer le shift » masqué sans site ni shift ; `charger` vide explicitement la liste (fin du chargement sans fin) ; sélecteurs « Aucun site » / « Aucun shift » ; bandeaux `SANS_SITE` et `SANS_SHIFT` avec lien vers Shifts ; erreur de lecture des shifts affichée (`DispatchView.tsx`). E2E `base-vide.spec.ts` (dispatch : sélecteurs inactifs, « Aucun voyage à affecter », aucun bouton de création). Main 33ab8ef, déploiement non consigné.
- `SimulationScenarios.tsx` : horizon « shift » sans shift annoncé « Aucun shift choisi ».
- PR #102 : `FenetreDecision.tsx` sur `ui/Fenetre.tsx` (soumission au clavier, pied visible).
- Shifts saisissables (D-078, module 05) : le dispatch n'est plus bloqué par l'absence de tout écrivain de `work_shifts`.
- Non corrigé : erreurs de lecture de `vehicles` et `drivers` ignorées ; `VoyageSuivant.tsx` sans site de départ reste en « Chargement… ».

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | États vides explicites, préparation impossible sans shift, erreurs de lecture affichées, E2E référentiel vide | S | aucune | partiellement traité par D-078 (DispatchView, E2E base-vide), non déployé ; erreurs `vehicles` / `drivers` et `VoyageSuivant` ouverts |
| 2 | Chauffeurs du site (et présents au poste, si décidé) dans la recommandation | S | Module 05, propriétaire | ouvert |
| 3 | Journal des décisions : filtres, pagination, export CSV, drawer de détail | M | DataTable, DetailDrawer, ExportModal | ouvert |
| 4 | Plan d'affectation du shift imprimable et exportable | S | `src/lib/exports.ts` | ouvert |
| 5 | Confirmation avant « Tout accepter » ; désaffectation motivée | S | ActionDialog | ouvert |
| 6 | Réaffectation d'un voyage `INTERRUPTED`, réaffectation groupée d'un engin immobilisé | M | Module 07, revue indépendante | ouvert |
| 7 | Notifications : voyage à réaffecter, voyages sans camion, site fermé | M | Module 24 | ouvert |
| 8 | Priorités et motifs de refus paramétrables, seuils de simulation en réglages | M | Module 02, migration, revue | ouvert |
| 9 | Indicateurs du dispatch (acceptation, refus, délai, utilisation des engins) | M | Modules 01, 21 | ouvert |
| 10 | Files d'attente au chargement et file des camions libres sur horodatages réels | L | Données réelles de `trip_events` | ouvert |
| 11 | Optimisation des rotations, GPS | L | Extensions à déclencheur | ouvert (ne pas commencer) |
| 12 | Archivage des tables Bolt `dispatch_assignments`, `dispatch_rules`, `dispatch_simulations` | S | D-071, sauvegarde | ouvert |

**Composants communs attendus** : DataTable (journal des décisions, files), DetailDrawer (décision : recommandation, avant, après), ActionDialog (refus, réaffectation, confirmation de « Tout accepter »), AssignmentModal (camion, chauffeur, engin), BulkActionBar (affectation et réaffectation en masse), HistoryDrawer (affectations d'un voyage), ExportModal (journal, plan d'affectation). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal / EditModal / ActionDialog.

<a id="module-07"></a>

### 07. Voyages et rotations (J1)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | Existant déployé : bandeau des voyages par phase avec heure de lecture (`TripsView.tsx`), compteur « à valider » du kilométrage, indicateurs par axe dans `RapportsVoyages`. Aucun tableau de bord dédié (tonnes livrées et acceptées, attente, livrés sans ticket) |
| 02 Liste | PARTIEL | Existant déployé : voyages d'une date (`planned_date = date`) par phase, recherche, filtre site, rafraîchissement 60 s, export CSV (E2E `voyages.spec.ts`). Manquent : période multi-jours, pagination, filtres camion / chauffeur / état / shift, vues enregistrées |
| 03 CRUD | DÉPLOYÉ | Voyage (`creer_voyage`), fiches (`preparer_fiche`, `annuler_fiche` motivée), relevés (`saisir_releve_compteur`, `corriger_releve_compteur`), distances en versions, distances de référence (désactivation), corrections par `CANCELLED`, `INTERRUPTED`, `DISPUTED`, `REJECTED` motivés ; pgTAP 09, 14, 27, 49. Manquent : duplication, modification de note ou de shift, rectification d'un événement |
| 04 Fiche détaillée | PARTIEL | Existant déployé : tiroir `FicheVoyage.tsx` (résumé, tonnage le plus avancé, journal, actions, incidents, voyage suivant). Ticket CBG effectif affiché dans la fiche (`v_tickets_pesee_cbg_effectifs`) : testé, non déployé. Manquent : dossier numérique (pièces jointes, aucun `supabase.storage`), historique d'affectation (`decisions_dispatch`) |
| 05 Modals et formulaires | DÉPLOYÉ | Création de voyage, action de cycle (heure, motif, pesée, tonnage), saisie de fiche FR / FP / FC, relevés et validation de distance : déployés. Passage sur `ui/Fenetre.tsx` de `NouveauVoyage`, `SaisieFiche`, `FicheVoyage` (PR #102, E2E `fenetres.spec.ts` « nouveau voyage ») et brut / tare en tonnes (D-078) : testés, non déployés. Confirmations encore par `window.prompt` / `window.confirm` |
| 06 Actions métier | TESTÉ | Avancer, annuler, interrompre, contester, rejeter, incident, enchaîner, préparer et imprimer en masse : déployés. Le geste clé de J1 n'est conforme qu'en version testée : `saisir_rotation` accepte la fiche du site de départ ou du dépôt d'arrivée (défaut D1 corrigé) et `rattacher_ticket_cbg` (ticket saisi avec la pesée, ou rattaché avec motif à un voyage livré) ; `20261121160000`, pgTAP 61 sections 2 et 4 ; main 33ab8ef, déploiement non consigné. Manquent : clôture en masse, validation en masse des distances, duplication |
| 07 Workflows | PARTIEL | Existant déployé : cycle CDC 12 (serveur seul juge), fiches préparée / remise / retournée / saisie, validation des distances par une autre personne (`kilometrage_validation_separee`). Pesée à l'arrivée indissociable du ticket (`garde_reception_cbg`, déclencheur différé) : testé, non déployé. Manquent : séparation saisie / acceptation du tonnage, délais et relances (fiche non retournée, voyage non accepté) |
| 08 Documents | PARTIEL | Existant déployé : fiches FR (A4 paysage), FP, FC imprimables avec signatures (`FicheImprimable.tsx`, E2E « fiche imprimable »). Manquent : fiche voyage imprimable, photo de la fiche signée, scan du ticket (aucun stockage) |
| 09 Rapports | DÉPLOYÉ | Liste du jour, kilométrage et rapports par axe (camion, chauffeur, site, shift) en CSV (`TripsView`, `KilometrageView`, `RapportsVoyages`, `rapport_voyages`, pgTAP 49). Manquent : PDF, Excel natif, rapport de période multi-jours |
| 10 Historique | DÉPLOYÉ | Journal immuable `trip_events` (auteur, heure déclarée et enregistrée, données, fiche, ticket), relevés corrigés conservés, distances versionnées ; pgTAP 09, 14, 27. Manquent : auteur d'une distance de référence (`cree_par` non envoyé, `KilometrageView.tsx:106-107`), affichage de l'historique d'affectation |
| 11 Notifications | PARTIEL | Existant déployé : compteur d'écran des voyages livrés sans distance validée. Alerte « voyage livré sans ticket CBG » (règle `voyage_sans_ticket`, seuil `alerte_voyage_sans_ticket_h`, `actualiser_alertes`, pgTAP 51) : testée, non déployée. Manquent : fiche non retournée, voyage livré non accepté, interruption ou incident grave |
| 12 Paramétrage | DÉPLOYÉ | Distances de référence (référentiel, droit `contracts`), réglage `kilometrage_validation_separee` (`reglages.ts:36`), lieu de pesée imposé `arrivee`. Shifts désormais saisissables (module 05, testé). À trancher : statut de `WEIGHED_OUT` au regard de D-037 |

**Changements depuis la fiche (vérifiés)** :
- D-078 point 2 (PR #100) : défaut D1 corrigé, `saisir_rotation` (rebasée sur `20261113100000`) accepte la fiche du site de départ ou du dépôt d'arrivée ; le ticket garde le site d'arrivée ; pgTAP 61 lignes 171-209 (trajet inter-sites, refus sans effet).
- D-078 point 4 : `garde_reception_cbg` (déclencheur de contrainte différé sur `trip_events`), `avancer_voyage` vers `WEIGHED_IN` sans ticket refusé ; `rattacher_ticket_cbg` appelé par `FicheVoyage.tsx` (`enregistrerTicket`, heure de pesée exigée, motif pour un voyage livré) ; pgTAP 61 lignes 214-285.
- D-078 point 3 : brut et tare libellés en tonnes (`SaisieFiche.tsx`, `FicheVoyage.tsx`).
- `SaisieFiche.tsx` : fiche sans camion, aucune requête `vehicle_id=eq.` vide ; `FichesView.tsx` : bandeaux `SANS_SITE` et `SANS_SHIFT`, erreur de lecture des shifts affichée ; `NouveauVoyage.tsx` refuse sans origine ni destination ; E2E `base-vide.spec.ts`.
- PR #102 : `NouveauVoyage`, `SaisieFiche`, `FicheVoyage` sur `ui/Fenetre.tsx` ; `FicheImprimable` fermée par Échap, barre collante ; E2E `fenetres.spec.ts`.
- Rectification de la fiche : la garde référentiel vide des Fiches terrain (9d45e5b, PR #94) est déployée, release c9f8555 consignée au journal (`SIGTB_2.0_HEBERGEMENT_VPS.md`, tableau « Journal des mises a jour », section 11 du fichier, ligne 253).
- `deploy/vps/demo/charger.sql` mis hors service (D-078 point 17).
- Non corrigé : préremplissage 08:00 des relevés et `cree_par` absent (`KilometrageView.tsx`, inchangé).

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Corriger D1 : ticket CBG rattachable sur un trajet mine vers dépôt, pgTAP sur voyage à départ et arrivée distincts, E2E | S | Module 14, revue indépendante | traité par D-078 (migration 20261121160000, pgTAP 61), non déployé ; E2E du parcours fiche inter-sites absent |
| 2 | Pièces jointes du voyage et dossier numérique | M | Socle pièces jointes (D-069 point 2), serveur web | ouvert |
| 3 | Historique multi-jours (période, pagination, filtres, vues enregistrées) | M | DataTable | ouvert |
| 4 | Relevés km dans la saisie de la fiche FR ; retrait du préremplissage 08:00 | S | D-043 | ouvert |
| 5 | Écran des litiges de voyage relié à la réconciliation et au relevé CBG | M | Modules 14, 20 | ouvert |
| 6 | Rectification d'un événement erroné par événement correctif motivé | M | Décision à consigner, revue indépendante | ouvert |
| 7 | Droit d'approbation distinct pour l'acceptation et la clôture, séparation saisie / acceptation | S | Propriétaire, matrice des droits | ouvert |
| 8 | Actions en masse : clôture des acceptés, validation des distances concordantes | S | BulkActionBar | ouvert |
| 9 | Notifications : fiche non retournée, voyage livré non accepté, interruption | S | Module 24 | partiellement traité : alerte voyage livré sans ticket (D-068, pgTAP 51), non déployée ; le reste ouvert |
| 10 | Impression de la fiche voyage, exports PDF | S | Modèle de document | ouvert |
| 11 | Statut de `WEIGHED_OUT` au regard de D-037 | S | Propriétaire | ouvert |
| 12 | Tableau de bord du module avec période, source et heure | M | Modules 01, 21 | ouvert |
| 13 | Recette J1 contre une vraie base, guide du rôle, PV | M | Données réelles du propriétaire | ouvert |

**Composants communs attendus** : DataTable (voyages sur période), DetailDrawer (fiche voyage), CreateModal (nouveau voyage), ActionDialog (annulation, litige, rejet, remise, correction de relevé, à la place de `window.prompt`), AttachmentModal (fiche signée, ticket scanné), HistoryDrawer (journal du voyage et des affectations), BulkActionBar (clôture et validation en masse), ExportModal (liste, kilométrage, rapports), CommentThread (litige). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal / EditModal.

<a id="module-08"></a>

### 08. Fleet Management, registre des engins (J1)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | Existant déployé (24dd140) : compteurs par statut opérationnel et heure de fraîcheur (`VehiclesView.tsx:48`), documents à renouveler (`v_documents_vehicule_a_renouveler`). Manquent le tableau de bord flotte, le coût complet par engin, le taux d'utilisation, le widget qualité du registre |
| 02 Liste | PARTIEL | Existant déployé : registre `v_vehicules` avec recherche, filtres statut et propriété, export CSV et impression (`VehiclesView.tsx:33-60`). Ni pagination, ni tri par colonne, ni vues enregistrées ; avec un site choisi, les engins globaux disparaissent (`VehiclesView.tsx:35`, non corrigé) |
| 03 CRUD | DÉPLOYÉ | Création, consultation, modification descriptive (`VehicleModal.tsx`, colonnes accordées `20261118210000_flotte.sql:77-83`), archivage par réforme `reformer_vehicule` ; pgTAP 45, E2E `flotte.spec.ts`. Manquent duplication et modification journalisée. Site imposé au profil borné (D-078 point 9, `VehicleModal.tsx`) : main 33ab8ef, déploiement non consigné |
| 04 Fiche détaillée | DÉPLOYÉ | `FicheVehicule.tsx` sur `v_fiche_vehicule` : propriété, contrat, statut, immobilisations, pleins, contrôles, pneus montés, `journal_flotte`. Pièces jointes absentes (aucun `supabase.storage`) |
| 05 Modals et formulaires | PARTIEL | Existant déployé : `VehicleModal`, `VehicleDocumentModal`. Suspension, remise en service et réforme par `window.prompt` (`FicheVehicule.tsx`) ; pas de validation en temps réel. Passage sur `ui/Fenetre.tsx` (PR #102, E2E `fenetres.spec.ts` « véhicule ») : main 33ab8ef, déploiement non consigné |
| 06 Actions métier | DÉPLOYÉ | `suspendre_vehicule`, `remettre_en_service_vehicule`, `reformer_vehicule`, `definir_propriete_vehicule` (`20261118210000_flotte.sql`), pgTAP 45. Manquent le rattachement en masse au contrat Neemba et toute action groupée |
| 07 Workflows | PARTIEL | Existant déployé : transitions de statut motivées et journalisées, sans seconde personne ; aucune approbation (réforme d'un engin loué), aucun délai ni relance sur les documents |
| 08 Documents | PARTIEL | Existant déployé : registre des documents réglementaires (métadonnées, échéances, archivage, `VehicleDocumentsView.tsx`) et liste imprimable. Aucun fichier (import, prévisualisation, téléchargement) ; fiche engin imprimable absente |
| 09 Rapports | PARTIEL | Existant déployé : CSV et impression du registre. Export des documents absent ; Santé de la flotte affiche `current_km` non mesuré et un libellé faux pour suspendu ou réformé (`AnalysesFlotte.tsx:203-206`) ; coût par tonne compte un coût absent comme 0 (`:221-260`), non corrigés |
| 10 Historique | PARTIEL | Existant déployé : `journal_flotte` append-only (propriété, statuts, motif, auteur). Modifications descriptives (immatriculation, capacité, site) non journalisées ; pas de comparaison de versions |
| 11 Notifications | PARTIEL | Existant déployé : liste « à renouveler » à l'écran. Règle d'alerte `document_expire` sur `vehicle_documents` (D-068, `20261121150000_decisions_hse.sql:1266`, pgTAP 51) : main 33ab8ef, déploiement non consigné. Rien pour un engin suspendu ou réformé, ni pour le dispatcher |
| 12 Paramétrage | PARTIEL | Types d'engin et de document figés en CHECK ; seuil J-30 codé. Seule l'activation `alerte_document_expire_active` est réglable (D-068, `valider_reglage`) : main 33ab8ef, déploiement non consigné. Pas de référentiel de catégories aligné sur `contrat_tarifs.categorie_materiel` |

**Changements depuis la fiche (vérifiés)** :
- D-078 point 9 : `src/components/Vehicles/VehicleModal.tsx`, site du profil borné imposé (`siteProfil`), « Aucun (engin global) » proposé au seul profil global ; aucun test dédié trouvé (DÉVELOPPÉ, couvert seulement par l'ouverture de fenêtre E2E). Main 33ab8ef, déploiement non consigné.
- D-078 point 12 : `src/components/Documents/VehicleDocumentModal.tsx`, coût GNF lu par `entierOuNull` (`src/lib/formulaires.ts`, `formulaires.test.ts`), décimale refusée avec message.
- PR #102 : `VehicleModal`, `VehicleDocumentModal`, `FicheVehicule` passent sur `src/components/ui/Fenetre.tsx` (pied toujours visible), E2E `e2e/fenetres.spec.ts` « véhicule ».
- D-068 : règle `document_expire` (documents d'engin) dans `actualiser_alertes`, pgTAP 51.
- Non corrigés : filtre site de `VehiclesView.tsx:35`, défauts de `AnalysesFlotte.tsx:203-206`.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Quatre défauts non bloquants (engin global proposé au profil borné, coût décimal, `current_km` et libellé de statut dans Santé de la flotte, engins globaux masqués par le filtre site) | S | aucune | partiellement traité : les deux premiers par D-078 (`VehicleModal.tsx`, `VehicleDocumentModal.tsx`), non déployé ; les deux derniers ouverts |
| 2 | Rattachement en masse des engins au contrat de location, contrôle « engin loué sans contrat » | M | dossier Neemba saisi (module 10) | ouvert |
| 3 | Écriture descriptive par fonction serveur journalisée (motif pour site, capacité, immatriculation), message clair sur doublon | M | aucune | ouvert |
| 4 | Capacité utile autorisée, relevé initial de compteur (km, heures) hors voyage | S | module 07 (D-043) | ouvert |
| 5 | Import du registre (CSV) avec prévalidation | M | ImportWizard | ouvert |
| 6 | Pièces jointes des documents | M | stockage privé (D-069 point 2, module 23) | ouvert |
| 7 | Coût complet par engin et par tonne | M | modules 10, 12, 13, 20 | ouvert |
| 8 | Alertes documentaires et notifications | S | aucune | partiellement traité : règle `document_expire` D-068 (pgTAP 51), non déployé ; pas de J-30 ni d'avis au dispatcher |
| 9 | Statuts dérivés complémentaires et tableau de bord flotte | M | modules 05, 06 | ouvert |

**Composants communs attendus** : DataTable (registre, documents), CreateModal et EditModal (engin, document), DetailDrawer (fiche engin), ArchiveDialog (réforme), ActionDialog (suspension, remise en service avec motif), AttachmentModal (carte grise, assurance), ImportWizard (registre), ExportModal (colonnes), HistoryDrawer (journal flotte et modifications), AssignmentModal (rattachement au contrat), BulkActionBar (rattachement, suspension). `ui/Fenetre.tsx` (PR #102) n'est qu'une coquille de fenêtre commune, pas encore CreateModal ni EditModal.

<a id="module-09"></a>

### 09. Gestion des chauffeurs (J1)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | Existant déployé : compteurs par statut et permis expirant calculés dans le navigateur, sans heure de fraîcheur (`DriversView.tsx`) ; habilitations à renouveler (`v_habilitations_a_renouveler`). Manquent taux de présence, vue globale des infractions actives |
| 02 Liste | PARTIEL | Existant déployé (avec erreur avalée et plantage sur matricule NULL). Corrigé par D-078 point 13 (`DriversView.tsx` : erreur affichée, `employee_id ?? ''`) : main 33ab8ef, déploiement non consigné. Ni pagination, ni tri par colonne, ni colonne ni filtre de site |
| 03 CRUD | TESTÉ | Défaut bloquant de la fiche (dates vides `''`, site absent) corrigé par D-078 points 8 et 9 : `src/components/Drivers/chauffeur.ts` (`corpsChauffeur`, `siteChauffeur`), `DriverModal.tsx` ; E2E `defauts-bloquants.spec.ts` « création d'un chauffeur sans dates facultatives », unitaires `formulaires.test.ts` ; main 33ab8ef, déploiement non consigné. Archivage déployé (`garde_archivage_chauffeur`). Manquent duplication et modification journalisée |
| 04 Fiche détaillée | PARTIEL | Existant déployé : modal du dossier avec infractions (`InfractionsChauffeur.tsx`). Pas de fiche consolidée (voyages, incidents, habilitations, présences), pas de pièce jointe |
| 05 Modals et formulaires | PARTIEL | Existant déployé : `DriverModal` (défaillant en production), nouvelle habilitation, infraction et sanction. Révocation et levée d'exigence par `window.prompt`/`confirm` (`HabilitationsView.tsx`). `DriverModal` sur `ui/Fenetre.tsx` (PR #102, E2E `fenetres.spec.ts` « chauffeur ») : main 33ab8ef, déploiement non consigné. Catégorie « C » et contrat « permanent » toujours pré-choisis (`DriverModal.tsx:52`, `:58`) |
| 06 Actions métier | DÉPLOYÉ | Archiver et réactiver, habilitations (saisie, révocation, exigence), `enregistrer_infraction`, `annuler_infraction`, `decider_sanction`, `annuler_sanction` (3dc77d4, 2d5c3cb), pgTAP 34 et 49. Suspension sans motif ni journal ; aucune action groupée |
| 07 Workflows | PARTIEL | Existant déployé : infraction puis décision de sanction avec approbation `drivers` ; affectation gardée par `garde_habilitations` et `garde_trips_habilitations`. Pas de délai, relance ni escalade à l'expiration ; séparation déclarant et décideur non tranchée (D-066) |
| 08 Documents | MANQUANT | Aucun fichier (permis scanné, certificat) : pas de `supabase.storage` ; fiche individuelle, attestation d'habilitation, notification de sanction absentes |
| 09 Rapports | DÉPLOYÉ | CSV et impression de la liste (`DriversView.tsx:78-108`), performance chauffeurs (`performance_chauffeurs`), rapport par chauffeur dans `Trips/RapportsVoyages` (D-066). Rapport individuel consolidé imprimable absent |
| 10 Historique | PARTIEL | Existant déployé : habilitations horodatées, infractions et sanctions append-only. Modifications du dossier et changements de statut non journalisés |
| 11 Notifications | PARTIEL | Existant déployé : compteur de permis et liste d'habilitations à l'écran, avertissement de sanction au dispatch (D-066). Règle `document_expire` sur habilitations (D-068, `20261121150000_decisions_hse.sql:1270-1278`, pgTAP 51) : main 33ab8ef, déploiement non consigné. Aucune alerte serveur sur le permis ni sur l'absence au poste |
| 12 Paramétrage | PARTIEL | Existant déployé : exigences d'habilitation au dispatch (`habilitations_requises`, administrateur). Types d'habilitation et catégories de permis figés ; temps de conduite et de repos absents (`driving_time_regulations` non lue) |

**Changements depuis la fiche (vérifiés)** :
- D-078 points 8 et 9 : `src/components/Drivers/chauffeur.ts` (nouveau) : dates et champs facultatifs vides en `null`, salaire vide en `null`, site imposé au profil borné ; `DriverModal.tsx` : champ « Site d'affectation » (`chauffeur-site`), « global » proposé au seul profil global ; E2E `e2e/defauts-bloquants.spec.ts` (chauffeur sans dates facultatives, site envoyé).
- D-078 point 13 : `DriversView.tsx` : erreur de lecture affichée (`role="alert"`), matricule NULL sans plantage, salaire NULL affiché sans montant ; salaire GNF décimal refusé (`entierOuNull`).
- PR #102 : `DriverModal` sur `src/components/ui/Fenetre.tsx`, E2E `fenetres.spec.ts` « chauffeur ».
- D-068 : alerte d'habilitation expirée non renouvelée, pgTAP 51.
- Tout est sur main 33ab8ef, déploiement non consigné.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Deux défauts bloquants (dates vides, site absent) et défauts non bloquants (erreur avalée, matricule NULL, salaire 0 pré-rempli, catégorie et contrat pré-choisis), E2E contre une vraie base | S | aucune | partiellement traité par D-078 (`chauffeur.ts`, E2E `defauts-bloquants`), non déployé ; restent les pré-choix « C » et « permanent » et l'E2E contre une vraie base |
| 2 | Écriture du dossier par fonctions serveur journalisées (motif pour suspension, réactivation, mutation) ; cloisonnement des données personnelles et du salaire | M | aucune | ouvert |
| 3 | Catégories de permis multiples, alerte permis dans « Mes validations » | S | aucune | ouvert |
| 4 | Disponibilités et absences planifiées lues par postes et dispatch | M | modules 05, 06 | ouvert |
| 5 | Fiche chauffeur consolidée et rapport individuel imprimable | M | aucune | ouvert |
| 6 | Pièces jointes (permis, certificats) | M | stockage privé | ouvert |
| 7 | Import des dossiers (CSV) | S | ImportWizard | ouvert |
| 8 | Temps de conduite et de repos paramétrables par site | L | règles du propriétaire | ouvert |

**Composants communs attendus** : DataTable (liste des chauffeurs, habilitations), CreateModal et EditModal (dossier, habilitation, infraction), DetailDrawer (fiche consolidée), ArchiveDialog (archivage), ActionDialog (suspension, révocation, sanction motivées), AttachmentModal (permis, certificat), ImportWizard (dossiers), HistoryDrawer (journal du dossier), AssignmentModal (mutation de site, équipe), BulkActionBar (archiver, muter, exiger). `ui/Fenetre.tsx` (PR #102) n'est qu'une coquille de fenêtre commune, pas encore CreateModal ni EditModal.

<a id="module-10"></a>

### 10. Gestion Neemba Guinée, loueur des engins (J2)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | Existant déployé : écarts détectés et recouvrés (`indicateurs_charge_contrats`), `heures_immobilisation`, `comparer_engagements`, `mesures_loueur`. Pas de tableau de bord Neemba ni de synthèse partenaire (facturé, attendu, réclamé, régularisé, reste à payer) |
| 02 Liste | PARTIEL | Existant déployé : liste des factures du loueur et des contrats (`FacturesNeembaView.tsx`, `ContratsView.tsx`). Ni pagination, ni tri par colonne, ni recherche dans les factures ; pas de vue « engins loués par contrat » |
| 03 CRUD | PARTIEL | Existant déployé : contrat, versions, tarifs par engin (D-026, D-033). Saisie de facture atomique `saisir_facture_fournisseur` (D-078 point 11, pgTAP 61) et avenant serveur `creer_avenant`, `modifier_tarif_par_avenant`, sans suppression physique (D-079, pgTAP 60) : main 33ab8ef, déploiement non consigné. Manquent la fiche partenaire, la modification des lignes et l'annulation motivée d'une facture |
| 04 Fiche détaillée | PARTIEL | Existant déployé : dossier contractuel (versions, tarifs, engagements, clauses, journal) et détail de facture avec écarts par ligne. Fiche partenaire Neemba absente (contrepartie en texte libre), aucune pièce jointe |
| 05 Modals et formulaires | PARTIEL | Existant déployé : saisie de facture, régularisation, formulaires de contrat. Notification d'écart par `window.prompt` (`FacturesNeembaView.tsx`) ; montant TTC non saisissable à l'écran (`p_montant_ttc` accepté par le serveur, non envoyé). Fenêtres sur `ui/Fenetre.tsx` (PR #102) : main 33ab8ef, déploiement non consigné |
| 06 Actions métier | DÉPLOYÉ | `controler_facture_fournisseur`, `notifier_ecart_fournisseur`, `enregistrer_regularisation`, `calculer_clauses`, `decider_clause`, `evaluer_loueur` ; pgTAP 19, 21, 48. Manquent rattachement en masse des engins et relance du loueur |
| 07 Workflows | PARTIEL | Existant déployé : saisie, contrôle, notification, régularisation ; paiement par le circuit D-055. Pas d'objet réclamation (réponse, relance, clôture), pas de séparation saisie et contrôle, pas de délai |
| 08 Documents | PARTIEL | Existant déployé : lettre de notification d'écart imprimable (identité `societe`), rapport de performance mensuel imprimable (D-031). Pas de facture scannée, pas d'import CSV ou PDF du loueur, fiche d'évaluation imprimable absente |
| 09 Rapports | DÉPLOYÉ | `rapport_loueur` (`20261118090000_reporting.sql:537`) imprimable et CSV via `ReportsView` ; export comptable au module 20. Export des écarts par facture absent |
| 10 Historique | PARTIEL | Existant déployé : `journal_contrats`, `interventions_journal`, `calculs_clauses_journal`. Factures : pas de journal des contrôles successifs ; saisie journalisée au dossier contractuel par `saisir_facture_fournisseur` (D-078) : main 33ab8ef, déploiement non consigné |
| 11 Notifications | PARTIEL | Existant déployé : clause à décider, échéance de contrat, remise en service dans « Mes validations ». Règle `intervention_retard` (D-068, pgTAP 51) : main 33ab8ef, déploiement non consigné. Rien pour une facture non contrôlée ; notification au loueur sur papier seulement |
| 12 Paramétrage | PARTIEL | Existant déployé : tarifs par engin et unité, clauses, critères d'évaluation (`definir_critere_loueur`). Moteur de décompte paramétrable (`src/domain/location/decompte.ts`, 27 tests) appelé par aucun écran ni fonction serveur |

**Changements depuis la fiche (vérifiés)** :
- D-078 point 11 : `saisir_facture_fournisseur` (`supabase/migrations/20261121160000_defauts_bloquants_j1.sql:880`), en-tête et lignes en une transaction, numéro unique par contrat, décimales GNF refusées ; INSERT, UPDATE, DELETE directs retirés ; écran `FacturesNeembaView.tsx` appelle la fonction ; pgTAP 61 (l. 350-376), E2E `factures-neemba.spec.ts` adapté. Le TTC n'est toujours pas envoyé par l'écran.
- D-078 point 10 : `src/contexts/AuthContext.tsx:246`, `'evaluation-loueur': 'contracts'` ; défaut bloquant d'accès levé ; aucun test de visibilité par rôle trouvé (DÉVELOPPÉ).
- D-079 : `creer_avenant`, `modifier_tarif_par_avenant`, `supprimer_element_contrat`, grille figée d'une version en vigueur (pgTAP 60, `Formulaires.tsx:163-181`, E2E `contrats-finance.spec.ts` adapté).
- D-064 : `valider_distance_voyage` (contracts) soumise à `auteur_ou_delegant` (pgTAP 59).
- PR #102 : fenêtres de saisie et de régularisation sur `ui/Fenetre.tsx`.
- Tout est sur main 33ab8ef, déploiement non consigné.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Menu Évaluation Neemba (et Budgets) invisible hors administrateur ; test de visibilité par rôle | S | aucune | traité par D-078 point 10 (`AuthContext.tsx:246-247`), non déployé ; test E2E de visibilité ouvert |
| 2 | Saisie de facture atomique, modification des lignes, annulation motivée, champ TTC | M | aucune | partiellement traité : saisie atomique par D-078 (`saisir_facture_fournisseur`, pgTAP 61), non déployé ; lignes, annulation et TTC à l'écran ouverts |
| 3 | Fiche partenaire (identité, interlocuteurs, canaux, délais contractuels) | M | module 15 (D-059) | ouvert |
| 4 | Vue « engins loués par contrat », rattachement en masse, engin loué sans tarif | M | module 08 | ouvert |
| 5 | Objet réclamation (ouverture, réponse, relance, clôture) | M | aucune | ouvert |
| 6 | Décompte de location serveur branché sur le contrôle | L | paramètres du contrat fournis par le propriétaire | ouvert |
| 7 | Tableau de bord Neemba avec source, période et heure | M | aucune | ouvert |
| 8 | Pièces jointes (facture scannée, rapports du loueur) | M | stockage privé | ouvert |

**Composants communs attendus** : DataTable (factures, engins loués), CreateModal et EditModal (facture, lignes, partenaire), DetailDrawer (facture, partenaire), ActionDialog (notification, régularisation, annulation motivées), AttachmentModal (facture scannée), ImportWizard (facture du loueur), ExportModal (écarts), HistoryDrawer (contrôles successifs), CommentThread (réclamation et réponses), AssignmentModal (rattachement des engins au contrat), BulkActionBar (rattachement). `ui/Fenetre.tsx` (PR #102) n'est qu'une coquille de fenêtre commune, pas encore CreateModal ni EditModal.

<a id="module-11"></a>

### 11. Maintenance et fiabilité (J2)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | Existant déployé : engins immobilisés en ce moment, heures par imputation (`ImmobilisationsView.tsx`), MTTR, MTBF, disponibilité (`fiabilite_engins`), indicateurs maintenance du Centre de pilotage (D-057). Manquent récurrence, coût des immobilisations, widget des échéances préventives dépassées |
| 02 Liste | PARTIEL | Existant déployé : immobilisations du mois (export, rafraîchissement 60 s), interventions, ordres de travail avec recherche (`MaintenanceView.tsx:231`), plannings. Ni pagination ni tri par colonne |
| 03 CRUD | DÉPLOYÉ | Immobilisation par `declarer_immobilisation`, `corriger_immobilisation`, `annuler_immobilisation` ; ordres de travail (colonnes accordées, numéro OT) ; plannings ; pgTAP 12, 44 ; réservations D-067 déployées (release 9ad7116, tests 50 OK sur le serveur). Manque la duplication |
| 04 Fiche détaillée | PARTIEL | Existant déployé : lignes d'immobilisation et d'intervention avec détail. `immobilisations_journal` et `interventions_journal` lus par aucun écran ; pas de fiche de panne (priorité, diagnostic) ; pas de pièce jointe |
| 05 Modals et formulaires | PARTIEL | Existant déployé : fenêtres déclarer, clôturer, corriger, annuler (`FenetresImmobilisation.tsx`). Prise en charge, refus et annulation d'un ordre par `window.prompt` (`InterventionsLoueurView.tsx`, `MaintenanceView.tsx`). Passage sur `ui/Fenetre.tsx` (PR #102) : main 33ab8ef, déploiement non consigné |
| 06 Actions métier | DÉPLOYÉ | `cloturer_immobilisation`, `demander_intervention_loueur`, `prendre_en_charge_intervention`, `terminer_intervention`, `valider_remise_en_service`, `annuler_ordre_travail`, `mouvement_stock` ; pgTAP 12, 32, 55, 56. Manquent ordre généré depuis une échéance préventive, actions groupées |
| 07 Workflows | DÉPLOYÉ | Panne, demande au loueur, prise en charge, fin, validation par une seconde personne (D-049), retard calculé sur le délai contractuel saisi. Séparation renforcée contre la délégation (`auteur_ou_delegant`, D-064, pgTAP 59) : main 33ab8ef, déploiement non consigné. Manquent relance et escalade, annulation d'une demande jamais honorée (D-072, à trancher) |
| 08 Documents | MANQUANT | Bon de demande d'intervention, fiche de remise en service, ordre de travail imprimable absents ; aucun fichier (rapport du loueur, photos), pas de `supabase.storage` |
| 09 Rapports | DÉPLOYÉ | Export des immobilisations du mois (`ImmobilisationsView.tsx:122`), CSV des ordres, `rapport_loueur`, `rapport_journalier` (D-058). Export des interventions et du préventif absent |
| 10 Historique | PARTIEL | Existant déployé : journaux append-only `immobilisations_journal`, `interventions_journal` côté serveur, non consultables à l'écran ; modifications d'ordres et de plannings non journalisées |
| 11 Notifications | PARTIEL | Existant déployé : remise en service dans « Mes validations » (D-056). Règles `immobilisation_longue` et `intervention_retard` (D-068, `20261121150000_decisions_hse.sql:98-101`, pgTAP 51) : main 33ab8ef, déploiement non consigné. Rien vers le dispatch quand un engin est immobilisé |
| 12 Paramétrage | PARTIEL | Causes et imputations figées en CHECK ; plannings préventifs par engin (déployé). Seuil `alerte_immobilisation_longue_h` et activation `alerte_intervention_retard_active` (D-068) : main 33ab8ef, déploiement non consigné. Délai contractuel non repris du contrat ; valeur horaire de référence non fournie |

**Changements depuis la fiche (vérifiés)** :
- Correction de la fiche : les réservations et lots D-067 sont DÉPLOYÉS (release 9ad7116, `docs/SIGTB_2.0_HEBERGEMENT_VPS.md` l. 251, tests 28 et 50 OK sur le serveur), et non seulement TESTÉS.
- D-078 point 12 : `PreventiveMaintenanceView.tsx`, intervalle en jours décimal refusé avec message.
- PR #102 : `FenetresImmobilisation.tsx` sur `src/components/ui/Fenetre.tsx` (erreur en tête, grille une colonne sur mobile).
- D-064 : `valider_remise_en_service` recréée avec `auteur_ou_delegant` (pgTAP 59) ; numérotation INT et OT au référentiel (`20261121140000_organisation.sql:1316-1317`).
- D-068 : règles d'alerte immobilisation longue et intervention en retard (pgTAP 51).
- Non corrigé : libellés « Nimba Mining » (`FenetresImmobilisation.tsx:64`, `ImmobilisationsView.tsx:119`).

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Libellés Neemba ; intervalle en jours entier côté écran | S | aucune | partiellement traité : intervalle par D-078 point 12 (`PreventiveMaintenanceView.tsx`), non déployé ; libellés « Nimba Mining » ouverts |
| 2 | Historique consultable (journaux d'immobilisation et d'intervention) | S | HistoryDrawer | ouvert |
| 3 | Fiche de panne enrichie (priorité, symptôme, système, compteur) | M | migration additive | ouvert |
| 4 | Analyse des causes, récurrence, coût des immobilisations | M | valeur horaire du propriétaire ; module 10 (D-065) | ouvert |
| 5 | Annulation d'une demande jamais honorée | S | décision du propriétaire (D-072) | ouvert |
| 6 | Délai contractuel repris du contrat ; relance et escalade du retard | M | module 10 | partiellement traité : alerte `intervention_retard` D-068 (pgTAP 51), non déployé ; reprise du délai et escalade ouvertes |
| 7 | Ordre de travail généré depuis une échéance préventive ; impression de l'ordre et du bon de remise en service | M | aucune | ouvert |
| 8 | Pièces jointes (rapport du loueur, photos) | M | stockage privé | ouvert |

**Composants communs attendus** : DataTable (immobilisations, interventions, ordres, plannings), CreateModal et EditModal (immobilisation, ordre, planning), DetailDrawer (fiche de panne, intervention), ActionDialog (prise en charge, refus, annulation motivés), AttachmentModal (rapport du loueur, photos), ExportModal (interventions, préventif), HistoryDrawer (journaux d'immobilisation et d'intervention), AssignmentModal (technicien, engin), BulkActionBar (plannings). `ui/Fenetre.tsx` (PR #102) n'est qu'une coquille de fenêtre commune, pas encore CreateModal ni EditModal.

<a id="module-12"></a>

### 12. Pneumatiques (J2)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | Existant déployé : pneus à surveiller (`v_pneus_a_surveiller`), km, coût total et au km (`v_pneus`), performance par marque et modèle (`PerformancePneus.tsx`, `v_pneus_performance`, release 9ad7116). Manquent coût pneus par engin et par tonne, stock par site, taux d'usure |
| 02 Liste | PARTIEL | Existant déployé : registre `v_pneus` filtré par état (`PneusView.tsx:86`). Aucune recherche (numéro, marque, engin), ni pagination, ni tri, ni export |
| 03 CRUD | DÉPLOYÉ | `enregistrer_pneu`, réception par bon de commande `receptionner_bon_commande` et annulation encadrée (D-067, release 9ad7116, test 50 OK sur le serveur), réforme définitive ; pgTAP 35, 50. Manque la saisie d'une série de pneus identiques |
| 04 Fiche détaillée | PARTIEL | Existant déployé : panneau d'historique par pneu (`PneusView.tsx:278-300`), pneus montés dans la fiche engin (D-062). Pas de fiche de vie consolidée ni de pièce jointe |
| 05 Modals et formulaires | PARTIEL | Existant déployé : panneaux en ligne (entrée, opérations, historique). Annulation par `window.prompt`, réforme sans dialogue d'irréversibilité, pas d'import du stock initial |
| 06 Actions métier | DÉPLOYÉ | `monter_pneu`, `demonter_pneu`, `permuter_pneu`, `inspecter_pneu`, `rechaper_pneu`, `reparer_pneu`, `reformer_pneu`, `annuler_operation_pneu` (`20261116210000_cycle_vie_pneus.sql:284-480`), réception D-067 (9ad7116) ; pgTAP 35, 50. Manquent inspection en masse d'un engin, alerte vers un achat |
| 07 Workflows | PARTIEL | Existant déployé : achat, réception avec un numéro par pneu, stock au dépôt (D-067, 9ad7116), puis cycle atelier. Aucune approbation des opérations, aucune relance, lien avec l'immobilisation pneumatique (module 11) absent |
| 08 Documents | MANQUANT | Fiche de vie, bon de réforme, rapport d'inspection absents ; aucun fichier (facture, photo d'usure), pas de `supabase.storage` |
| 09 Rapports | MANQUANT | Aucun export ni impression du registre ou de l'historique ; la performance par marque est un écran. La part pneus du coût direct par tonne (`AnalysesFlotte.tsx:231`) est une approximation non étiquetée (non corrigée) |
| 10 Historique | DÉPLOYÉ | Journal append-only `pneus_operations` (auteur, horodatage, motif, opération liée, annulation) consultable par pneu ; pgTAP 35 |
| 11 Notifications | PARTIEL | Existant déployé : liste à surveiller à l'écran, refus serveur au plafond de rechapages. Pas de règle pneus dans le catalogue d'alertes D-068 ni dans « Mes validations » ; pas de stock minimum par dimension |
| 12 Paramétrage | PARTIEL | Existant déployé : seuils administrateur `pneu_profondeur_min_mm`, `pneu_inspection_max_jours`, `pneu_reforme_precoce_km` (D-067, 9ad7116) par `valider_reglage`. Pas de référentiel des modèles de pneus ni de plan d'essieux par type d'engin |

**Changements depuis la fiche (vérifiés)** :
- Correction de la fiche : D-067 (réception de pneus par bon de commande, annulation de réception, performance par marque, `pneu_reforme_precoce_km`) est DÉPLOYÉ, release 9ad7116 (`docs/SIGTB_2.0_HEBERGEMENT_VPS.md` l. 251, tests 28 et 50 OK sur la base du serveur), et non TESTÉ.
- D-078 point 12 : `src/components/Pneus/PneusView.tsx`, `ENTIERS` (prix d'achat, coût, rechapages maximum) : décimale ou nombre illisible refusés avec message, jamais arrondis ; main 33ab8ef, déploiement non consigné ; aucun test dédié trouvé (DÉVELOPPÉ).
- Non corrigés : menu lié à la lecture `vehicles` (`AuthContext.tsx:210`) alors que l'écriture est ouverte à `maintenance` ; étiquette du coût approché (`AnalysesFlotte.tsx:231`).

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Import des pneus en stock et déjà montés, avec prévalidation (mise en service) | M | ImportWizard ; engins saisis (module 08) | ouvert |
| 2 | Défauts non bloquants : montants entiers, droit du menu, étiquette du coût approché | S | aucune | partiellement traité : montants entiers par D-078 point 12 (`PneusView.tsx`), non déployé ; droit du menu et étiquette ouverts |
| 3 | Recherche par numéro, marque, engin ; export CSV du registre et de l'historique | S | aucune | ouvert |
| 4 | Plan d'essieux par type d'engin et inspection en masse | M | aucune | ouvert |
| 5 | Coût pneus par engin et par tonne depuis le journal | M | modules 07, 20 | ouvert |
| 6 | Référentiel des modèles de pneus | S | module 17 | ouvert |
| 7 | Alertes dans « Mes validations » ; stock minimum par dimension vers une demande d'achat | S | module 16 ; catalogue d'alertes D-068 | ouvert |
| 8 | Lien entre immobilisation pneumatique et opération pneu | M | module 11 | ouvert |

**Composants communs attendus** : DataTable (registre des pneus), CreateModal (entrée en stock), DetailDrawer (fiche de vie), ArchiveDialog (réforme définitive), ActionDialog (opérations et annulation motivées), AttachmentModal (facture, photo d'usure), ImportWizard (stock initial et pneus montés), ExportModal (registre, historique), HistoryDrawer (journal `pneus_operations`), BulkActionBar (inspection d'un engin). `ui/Fenetre.tsx` (PR #102) n'est qu'une coquille de fenêtre commune, pas encore CreateModal ni EditModal ; `PneusView` ne l'importe pas encore.

<a id="module-13"></a>

### 13. Fuel Intelligence (J2)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | PARTIEL (existant déployé, release consignée de la fiche) : synthèse du mois `PleinsView.tsx`, stock et seuil `v_stocks_carburant`, L/engin, L/t, L/h, coût `AnalyseCarburantView.tsx` (pgTAP 14, 16 ; E2E `analyses`) ; manquent l'écart livré / reçu / facturé, les jours d'autonomie par cuve, l'heure de fraîcheur de la synthèse |
| 02 Liste | PARTIEL | PARTIEL (existant déployé) : listes mensuelles des pleins, registre des mouvements, livraisons et factures CBG, export CSV ; ni recherche, ni tri, ni pagination, ni vues enregistrées |
| 03 CRUD | PARTIEL | PARTIEL (existant déployé) : création de stockage, livraison, réception, mouvement, inventaire, plein, facture CBG ; pas de modification ni de désactivation d'un stockage, aucune correction d'une livraison, d'une facture CBG ou d'un plein |
| 04 Fiche détaillée | MANQUANT | Aucune fiche stockage (historique, inventaires) ni fiche livraison (réception, facture, pièce) : listes seules |
| 05 Modals et formulaires | PARTIEL | PARTIEL (existant déployé) : panneaux en page `StocksCarburantView.tsx`, motifs par `window.prompt` ; saisie d'un plein passée sur `ui/Fenetre` (PR #102, E2E `fenetres` « saisir un plein », TESTÉ main 33ab8ef, déploiement non consigné) ; pas d'import CSV ni de pièce jointe |
| 06 Actions métier | DEPLOYE | Réceptionner, transférer, inventorier, valider / rejeter par une autre personne, contre-mouvement `annuler_mouvement_carburant` (pgTAP 25, 52 ; E2E `stocks-carburant`) ; manquent la validation en masse, l'annulation d'une livraison ou d'un plein, l'impression d'un bon de réception |
| 07 Workflows | PARTIEL | PARTIEL (existant déployé) : livraison -> réception -> validation séparée (`carburant_validation_separee`), inventaire -> ajustement, facture -> contrôle ; séparation étendue aux délégations dans `decider_mouvement_carburant` / `decider_inventaire_carburant` (D-064, pgTAP 59, TESTÉ main 33ab8ef, déploiement non consigné) ; manquent contestation et avoir CBG, délais et escalades |
| 08 Documents | MANQUANT | `document_ref` texte (`LivraisonsCbgView.tsx`), aucun `supabase.storage` ni `type="file"` dans `Fuel/` ; bon de réception, PV d'inventaire, lettre de contestation absents (la fiche FC imprimable relève du module 07) |
| 09 Rapports | PARTIEL | PARTIEL (existant déployé) : CSV pleins, registre, analyse (`src/lib/exports.ts`) ; aucun bilan carburant mensuel figé, ni Excel, ni PDF |
| 10 Historique | PARTIEL | PARTIEL (existant déployé) : registre `mouvements_carburant` append-only (auteur, décideur, motif) ; livraisons et factures CBG sans journal ni correction tracée |
| 11 Notifications | PARTIEL | PARTIEL (existant déployé) : mouvements et inventaires à valider dans « Mes validations » (D-056) ; seuil de cuve affiché seulement ; règle `ecart_carburant` du centre des décisions (D-068, `catalogue_regles_alertes`, pgTAP 51, E2E `decisions-hse`, TESTÉ main 33ab8ef, déploiement non consigné) ; facture à examiner et livraison non réceptionnée non notifiées |
| 12 Paramétrage | PARTIEL | PARTIEL (existant déployé) : réglage `carburant_validation_separee`, seuil saisi des anomalies, capacité et seuil des cuves à la création ; aucun référentiel des produits carburant, ni HT / TTC, ni taux de taxe |

**Changements depuis la fiche (vérifiés)** :
- PR #98 (64e0961) : `src/components/Fuel/ParcoursCarburant.tsx` (bandeau du parcours d'un litre, six étapes cliquables) importé en tête des six écrans du menu Carburant ; menus renommés « Distribution aux engins » (`fuel`) et « Réceptions, cuves et inventaires » (`fuel-stocks`) dans `src/components/Layout/menu.ts` ; E2E `analyses.spec.ts` et `stocks-carburant.spec.ts` adaptés. Navigation seulement, aucun bloc promu.
- PR #98 : `LivraisonsCbgView.tsx` affiche `ReferentielVide` quand aucun site n'existe et refuse l'envoi sans site (« Choisissez le site de livraison »).
- PR #102 (33ab8ef) : fenêtre « Saisir un plein » sur `ui/Fenetre` (soumission par formulaire, état `envoi`, `ErreurFenetre`) ; E2E `fenetres.spec.ts` « saisir un plein ».
- D-064 (PR #97, migration `20261121140000_organisation`) : `decider_mouvement_carburant` et `decider_inventaire_carburant` recréées avec `separation_violee` / `auteur_ou_delegant` (le délégué d'un auteur ne valide pas) ; pgTAP 59.
- D-068 (PR #99, migration `20261121150000_decisions_hse`) : règle d'alerte `ecart_carburant` (seuil `alerte_ecart_carburant_l`, écran `fuel-stocks`), inactive tant que le seuil n'est pas saisi ; pgTAP 51, E2E `decisions-hse`.
- Tout ce qui précède : main 33ab8ef, déploiement non consigné.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Correction tracée d'une livraison et d'une facture CBG (annulation motivée, nouvelle saisie) ; annulation d'un plein | M | décision propriétaire (nouvelle réception après annulation, D-072 R1-11) | ouvert |
| 2 | Modification et désactivation d'un stockage (capacité, seuil, actif) avec journal | S | - | ouvert |
| 3 | Rattacher livraisons et factures à la fiche fournisseur CBG et au contrat (modules 15, 19) ; HT / TTC et taux de taxe | M | décision HT / TTC ; fiche CBG saisie | ouvert |
| 4 | Import CSV des livraisons et de la facture CBG | M | ImportWizard | ouvert |
| 5 | Pièces jointes des bons CBG et tickets de jauge | M | lot D (stockage de fichiers, accord propriétaire) | ouvert |
| 6 | Bilan carburant mensuel figé par site (livré, reçu, distribué, stock, écarts, coût) | M | `figer_rapport` (D-058) | ouvert |
| 7 | Contestation de facture CBG, avoir CBG, suivi jusqu'à régularisation | M | patron D-032 | ouvert |
| 8 | Valorisation au coût moyen par stockage | M | décision propriétaire (CMP par cuve ou prix moyen de période) | ouvert |
| 9 | Fiches détaillées stockage et livraison, validation en masse, alertes notifiées | M | DetailDrawer, BulkActionBar, notifications | partiellement traité : alerte d'écart d'inventaire au centre des décisions (D-068, pgTAP 51), non déployé ; fiches et masse ouvertes |
| 10 | Référentiel des produits carburant | S | - | ouvert |
| 11 | E2E livraisons CBG et parcours J2 contre une vraie base | S | conteneur de rejeu | ouvert |

**Composants communs attendus** : DataTable (pleins, registre, livraisons), CreateModal (stockage, réception, transfert, inventaire), EditModal (stockage), DetailDrawer (stockage, livraison), ActionDialog (rejet, annulation motivés, au lieu de `window.prompt`), ArchiveDialog (désactivation d'une cuve), AttachmentModal (bon CBG, ticket de jauge), ImportWizard (livraisons et factures CBG), ExportModal (bilan, registre), HistoryDrawer (journal d'un stockage, d'une livraison), BulkActionBar (validation des mouvements d'une journée). `ui/Fenetre.tsx` (PR #102) n'est qu'une coquille de fenêtre commune utilisée par la saisie d'un plein, pas encore CreateModal / EditModal.

<a id="module-14"></a>

### 14. Pesée et rapprochement CBG (J1)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | Existant déployé : voyages livrés sans ticket au centre de pilotage (`v_voyages_livres_sans_ticket`, `indicateurs_pilotage`, pgTAP 40), compteurs concordants / anomalies d'un relevé (`TicketsCbgView.tsx`), facturable / à examiner / exclue (`ReconciliationView.tsx`). Manquent : tableau de bord pesée (reçu vs chargé par jour, taux de rectification, litiges ouverts et âge, taux de concordance) |
| 02 Liste | PARTIEL | Existant déployé : registre des 300 derniers tickets sans filtre, 50 derniers relevés, lignes de réconciliation filtrées par statut. Manquent : recherche, filtres date / site / camion / état, pagination, export du registre et des voyages sans ticket |
| 03 CRUD | TESTÉ | Rectification, import de relevé, ouverture et actualisation de réconciliation : déployées (pgTAP 15, 33). Création du ticket conforme seulement en version testée : sur un trajet réel mine vers dépôt, `saisir_rotation` refusait le ticket (défaut D1 du module 07) ; corrigée, plus `rattacher_ticket_cbg` (pesée à l'arrivée ou rattachement motivé d'un voyage livré) ; migration `20261121160000`, pgTAP 61 ; main 33ab8ef, déploiement non consigné. Manquent : annulation motivée d'un relevé, révision d'une décision d'écart |
| 04 Fiche détaillée | MANQUANT | Aucune fiche ticket : historique des rectifications non affiché (seule la valeur effective `v_tickets_pesee_cbg_effectifs`), aucune pièce jointe, lignes brutes du relevé non affichées |
| 05 Modals et formulaires | PARTIEL | Existant déployé : fenêtre de rectification et saisie de la fiche FR, mais libellées « kg » face à un serveur en tonnes (défaut D1). Libellés en tonnes et fenêtre de rectification sur `ui/Fenetre.tsx` : testés (D-078 point 3, PR #102), non déployés. Décisions d'écart et de ligne par `window.prompt` ; import sans aperçu ni mapping |
| 06 Actions métier | TESTÉ | Intégrer, rectifier, importer, rapprocher, accepter / litige, ouvrir, décider, clôturer, générer la facture : déployés (pgTAP 14, 15, 33, 53 ; E2E `tickets-cbg.spec.ts`, `facturation.spec.ts`). Versions conformes testées seulement : voyage pesé sans ticket impossible (`garde_reception_cbg`, D2), anomalie `net_superieur_capacite` jamais facturable, décision « facturable » périmée invalidée par `actualiser_reconciliation`, chevauchement de sites refusé par `ouvrir_reconciliation`, défense en profondeur de `cloturer_reconciliation` (`ligne_non_forcable`) ; pgTAP 61 sections 3 et 4. Manquent : décisions en masse, clôture d'un litige |
| 07 Workflows | PARTIEL | Existant déployé : réception, relevé périodique, rectification par une autre personne (aal2 si `mfa_exige`), réconciliation mensuelle puis facture (circuit D-029). Séparation de `rectifier_ticket_pesee_cbg` étendue aux délégations (D-064, pgTAP 59) : testée, non déployée. Manquent : litige jusqu'à la réponse CBG, réconciliation journalière, délais et escalades ; D3 (ligne à ticket rectifié jamais facturable) en attente du propriétaire |
| 08 Documents | PARTIEL | Existant déployé : import du relevé CSV (`TicketsCbgView.tsx:118`, `type="file"`, lecture locale, aucun stockage du fichier), fiche FR imprimable avec colonnes ticket, brut, tare (t). Manquent : scan du ticket, relevé PDF ou Excel, état de rapprochement imprimable, lettre de contestation (aucun `supabase.storage`) |
| 09 Rapports | DÉPLOYÉ | Rapprochement d'un relevé en CSV (`TicketsCbgView.tsx`), réconciliation mensuelle en CSV avec BOM (`ReconciliationView.tsx`). Manquent : registre des tickets, voyages sans ticket, PDF et impression des états, Excel natif |
| 10 Historique | PARTIEL | Existant déployé : ticket source immuable, rectifications append-only (anciennes et nouvelles valeurs, auteur, motif), relevé tel que reçu. Origine et motif de rattachement immuables sur le ticket (D-078 point 4a, pgTAP 61) : testés, non déployés. Décisions d'écart et de ligne écrasées sans journal ; décision invalidée par l'actualisation non journalisée (limite D-078) |
| 11 Notifications | PARTIEL | Alerte « voyage livré sans ticket CBG » (`catalogue_regles_alertes`, `actualiser_alertes`, seuil `alerte_voyage_sans_ticket_h`, sans seuil = règle inactive ; pgTAP 51, sans E2E propre à cette règle) : testée, non déployée. Manquent : relevé à rapprocher, écarts à décider, rectification à faire, litige à échéance dans `mes_validations` |
| 12 Paramétrage | PARTIEL | Existant déployé : réglage `tolerance_poids_cbg_t` saisissable dans Réglages serveur (`reglages.ts:67`, `ReglagesServeur.tsx`, présent dès 8df078d : la fiche le disait sans écran). Manquent : format et colonnes du relevé, catégories de motif de litige, approbation au-delà de la tolérance |

**Changements depuis la fiche (vérifiés)** :
- D-078 point 3 (PR #100) : défaut D1 corrigé, « Brut (t) » / « Tare (t) » dans `SaisieFiche.tsx` et `ReconciliationView.tsx` ; vraisemblance par l'anomalie `net_superieur_capacite` (`actualiser_reconciliation`, `ligne_bloquee`, `decider_ligne_reconciliation` rebasées), pgTAP 61 lignes 287-301.
- D-078 point 4 : défaut D2 corrigé. `garde_reception_cbg` (déclencheur différé, aucun contournement par paramètre de session), `rattacher_ticket_cbg` (motif obligatoire pour un voyage déjà livré, refus si une réconciliation close couvre le voyage), `controler_ticket_cbg_libre` commun ; colonnes `origine`, `motif_rattachement` ; pgTAP 61 lignes 214-285 ; appel depuis `FicheVoyage.tsx` (`enregistrerTicket`). Limite consignée : un rattachement tardif n'ajoute pas d'événement au journal du voyage.
- D-078 points 14 et 18bis : `ouvrir_reconciliation` refuse les ensembles de sites qui se recoupent (verrou par contrat) ; décision « facturable » devenue impossible remise à examiner ; `cloturer_reconciliation` vérifie `ligne_non_forcable` ; pgTAP 61 lignes 304-328.
- D-064 (PR #97) : `rectifier_ticket_pesee_cbg` refuse le délégant ou le délégué de l'auteur du ticket (`separation_violee`), pgTAP 59.
- D-068 (PR #99) : règle d'alerte `voyage_sans_ticket` (`20261121150000_decisions_hse.sql:109`, `:1291`), pgTAP 51.
- `ReconciliationView.tsx` : bandeau « Aucun contrat client enregistré », rectification sur `ui/Fenetre.tsx` (PR #102) ; E2E `base-vide.spec.ts` (tickets CBG, réconciliation).
- Non corrigé : D3 (ticket rectifié jamais facturable) laissé en question au propriétaire ; erreurs de lecture de `ReconciliationView` encore ignorées hors contrats.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Corriger D1 : libellés en tonnes, contrôle de vraisemblance du net | S | Aucune | traité par D-078 (libellés t, anomalie `net_superieur_capacite`, pgTAP 61), non déployé |
| 2 | Corriger D2 : pesée à l'arrivée avec ticket obligatoire, rattachement tardif motivé ; statut de `UNLOADING -> DELIVERED` | M | Module 07, revue indépendante | traité par D-078 (`garde_reception_cbg`, `rattacher_ticket_cbg`, pgTAP 61), non déployé ; livraison sans pesée toujours permise (rattachement motivé ensuite), rattachement sans exigence d'une autre personne |
| 3 | Corriger D3 : ligne à ticket rectifié facturable après réexamen motivé par une autre personne | S | Propriétaire, revue indépendante | ouvert (question posée dans D-078 point 7 ; par défaut la ligne reste à exclure) |
| 4 | Pièces jointes : scan du ticket, relevé PDF, document de livraison | L | Socle pièces jointes (D-069 point 2), serveur web | ouvert |
| 5 | Litiges CBG : statut, réponse, échéance, relance, lien réconciliation et état `DISPUTED` | M | Modules 07, 20, 24 | ouvert |
| 6 | Réconciliation journalière par site et poste | M | Module 05 | ouvert |
| 7 | Registre des tickets au standard et fiche ticket avec historique des rectifications | M | DataTable, DetailDrawer, HistoryDrawer | ouvert |
| 8 | Import au standard (aperçu, erreurs par ligne, mapping, Excel) ; annulation motivée d'un relevé | M | ImportWizard ; format réel du relevé CBG | ouvert |
| 9 | Décisions en masse, révision motivée d'une décision, journal des décisions | S | BulkActionBar, ActionDialog | ouvert |
| 10 | Borne de site sur la réconciliation (lecture et fonctions) | M | D-075, revue indépendante | partiellement traité : chevauchement des ensembles de sites refusé (D-078 point 14), non déployé ; borne de lecture ouverte |
| 11 | Notifications (relevé à rapprocher, voyage sans ticket, litige à échéance) | S | Module 24 | partiellement traité : alerte voyage sans ticket (D-068, pgTAP 51), non déployée |
| 12 | Tableau de bord et état imprimable du rapprochement | S | Module 21 | ouvert |
| 13 | OCR des tickets | - | Extension à déclencheur | ouvert (ne pas commencer) |

**Composants communs attendus** : DataTable (registre des tickets, relevés, lignes de réconciliation), DetailDrawer (fiche ticket), HistoryDrawer (rectifications, décisions), ActionDialog (décision d'écart ou de ligne motivée, à la place de `window.prompt`), ImportWizard (relevé CBG), AttachmentModal (scan du ticket, relevé PDF), ExportModal (rapprochement, réconciliation, registre), BulkActionBar (décisions en masse), CommentThread (litige CBG). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal / EditModal.

<a id="module-15"></a>

### 15. Fournisseurs (J2)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | PARTIEL (existant déployé eca55e3, 3bbfded) : documents à échéance, note courante, total commandé et payé sur la fiche (`FicheFournisseur.tsx`) ; aucun tableau de bord fournisseurs (délais, taux de refus, dépendance) |
| 02 Liste | PARTIEL | PARTIEL (existant déployé) : répertoire avec recherche (nom, numéro, NIF, ville) et filtres type, catégorie, statut (`SuppliersView.tsx`, E2E `fournisseurs`) ; tri fixe par raison sociale, ni pagination, ni export, ni vues enregistrées |
| 03 CRUD | DEPLOYE | `enregistrer_fournisseur`, contacts, documents, catégories, suspension / réactivation en guise d'archivage (pgTAP 42, 55, 56 ; E2E `fournisseurs`) ; manquent duplication, modification d'un document, d'une consultation ou d'une offre |
| 04 Fiche détaillée | DEPLOYE | `FicheFournisseur.tsx` : identité, contacts, documents, catégories, évaluation, commandes, paiements des bons, journal ; sans pièces jointes ni paiements des factures Neemba |
| 05 Modals et formulaires | PARTIEL | PARTIEL (existant déployé) : panneaux en page, motifs par `window.prompt` ; `ui/Fenetre` non utilisée dans `Suppliers/` ; pas d'import ni de pièce jointe |
| 06 Actions métier | DEPLOYE | Suspendre, réactiver (approbation `purchases`), évaluer, consultation (inviter, offre, sélection, bon préparé) ; correctif du dépôt choisi à la préparation du bon (D-079, E2E `saisie-referentiels` « consultation sans depot », TESTÉ main 33ab8ef, déploiement non consigné) ; manquent fusion de doublons, actions en masse |
| 07 Workflows | PARTIEL | PARTIEL (existant déployé) : consultation -> sélection motivée -> bon brouillon soumis au circuit D-053 ; approbation non délégable (D-064, pgTAP 47 / 59, TESTÉ main 33ab8ef) ; manquent validation de la création par une seconde personne, relances, délais |
| 08 Documents | MANQUANT | Documents administratifs en métadonnées et référence texte seulement (`enregistrer_document_fournisseur`) ; aucun `supabase.storage` ni `type="file"` ; demande de cotation et fiche imprimables absentes |
| 09 Rapports | MANQUANT | Aucun export ni rapport dans `Suppliers/*` (répertoire, comparatif d'offres, évaluations, documents à échéance) |
| 10 Historique | DEPLOYE | `fournisseurs_journal` append-only (avant / après) affiché sur la fiche ; évaluations append-only avec correction motivée (pgTAP 42, 48) |
| 11 Notifications | PARTIEL | PARTIEL (existant déployé) : échéances `v_documents_fournisseurs_echeance` affichées sur la fiche ; aucune notification ni relance (règle absente de `catalogue_regles_alertes`, D-068) |
| 12 Paramétrage | DEPLOYE | Catégories et critères d'évaluation par l'administrateur (`definir_categorie_fournisseur`, `definir_critere_evaluation`, `ReferentielsFournisseurs.tsx`), réglages `fournisseurs_alerte_documents_jours`, `consultation_offres_minimum` (pgTAP 42, 48) ; grille réelle non saisie |

**Changements depuis la fiche (vérifiés)** :
- D-079 (5) (PR #101) : `ConsultationsFournisseurs.tsx` ne prépare plus le bon à la sélection sans dépôt (`preparerALaSelection`) et demande le dépôt (`depotBon`, `p_depot`) pour `preparer_bon_commande_consultation` ; E2E `saisie-referentiels.spec.ts` « consultation sans depot : le depot est demande pour preparer le bon ». Main 33ab8ef, déploiement non consigné.
- D-064 (PR #97) : l'approbation (dont `purchases`) ne se délègue pas ; délégation d'écriture possible du module ; pgTAP 47, 59. Main 33ab8ef, déploiement non consigné.
- Aucun autre fichier de `src/components/Suppliers/` modifié.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Export CSV du répertoire et import initial en masse pour la première saisie réelle | M | ImportWizard | ouvert |
| 2 | Lien fournisseur - contrat (nature « fournisseur » au dossier contractuel) | M | module 19 | ouvert |
| 3 | Réclamations fournisseur (objet, motif, montant, suivi, clôture) | M | - | ouvert |
| 4 | Choix du dépôt au moment de préparer le bon d'une consultation sans dépôt | S | - | traité par D-079 (`ConsultationsFournisseurs.tsx`, E2E `saisie-referentiels`), non déployé |
| 5 | Catalogue produits et prix fournisseur (référence, prix, délai, dernier achat) | M | module 17 | ouvert |
| 6 | Pièces jointes des documents administratifs | M | lot D (stockage) | ouvert |
| 7 | Tableau de bord fournisseurs, relance des documents expirés | M | notifications | ouvert |
| 8 | Demande de cotation imprimable | S | modèles d'impression | ouvert |
| 9 | Rattacher les paiements des factures Neemba à la fiche du loueur | S | module 20 | ouvert |

**Composants communs attendus** : DataTable (répertoire, consultations), CreateModal (fiche, contact, document, consultation, offre), EditModal (fiche, document), DetailDrawer (fiche fournisseur), ActionDialog (suspension, réactivation, retrait motivés), ArchiveDialog (retrait de contact ou de document), AttachmentModal (documents administratifs), ImportWizard (répertoire initial), ExportModal (répertoire, comparatif, évaluations), HistoryDrawer (journal fournisseur), CommentThread (réclamations). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal / EditModal, et n'est pas utilisée dans ce module.

<a id="module-16"></a>

### 16. Achats et approvisionnements (J2)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | MANQUANT | Aucun indicateur dans `Purchases/*` (bons à approuver, à réceptionner, en retard, engagé) ; les bons à décider sont dans « Mes validations » (module 24), l'engagé dans « Budgets » (module 20) |
| 02 Liste | PARTIEL | PARTIEL (existant déployé 7f11af4) : liste des bons filtrée par statut, ordre fixe par date (`PurchasesView.tsx`) ; ni recherche, ni tri, ni pagination, ni export |
| 03 CRUD | PARTIEL | PARTIEL (existant déployé 7f11af4, 9ad7116) : bon créé, modifié en brouillon, annulé ou soldé (pgTAP 36 ; E2E `achats`) ; demande d'achat, facture d'achat, avoir et duplication absents |
| 04 Fiche détaillée | DEPLOYE | Détail du bon : lignes, réceptions (`deliveries`), journal `achats_journal` (`PurchasesView.tsx:74-75`) ; sans pièces jointes (devis, BL, facture) |
| 05 Modals et formulaires | PARTIEL | PARTIEL (existant déployé) : panneaux brouillon et réception, avertissement avant réception de pneus (D-067, déployé 9ad7116), motifs par `window.prompt` ; `ui/Fenetre` non utilisée |
| 06 Actions métier | DEPLOYE | Soumettre, approuver / rejeter (approbateur distinct), annuler, solder, réceptionner, annuler une réception (pgTAP 36, 54) ; pneus, lots et séries à la réception déployés 9ad7116 (tests 28 et 50 OK sur le serveur, journal section 9) ; manquent approbation en masse, relance, duplication |
| 07 Workflows | PARTIEL | PARTIEL (existant déployé) : brouillon -> soumission -> approbation séparée (`achats_validation_separee`) -> réception -> bon à payer (D-055) ; approbation non délégable (D-064, TESTÉ main 33ab8ef) ; un seul niveau, sans seuils par montant, sans délais ni relances, sans DA ni facture d'achat |
| 08 Documents | MANQUANT | Aucun bon de commande ni bon de réception imprimable, aucune pièce jointe (`supabase.storage` absent) |
| 09 Rapports | MANQUANT | Aucun export ni rapport d'achats (par fournisseur, article, site, période, délais) |
| 10 Historique | DEPLOYE | `achats_journal` append-only (création, soumission, décision, annulation, solde, réception, annulation de réception) avec auteur, date, motif ; comparaison de versions d'un brouillon absente |
| 11 Notifications | PARTIEL | PARTIEL (existant déployé) : bon à approuver dans « Mes validations » ; bon à réceptionner, en retard, rejet au demandeur non notifiés |
| 12 Paramétrage | PARTIEL | PARTIEL (existant déployé) : réglage `achats_validation_separee` ; aucun seuil d'approbation, nature de dépense ou taux de taxe par ligne |

**Changements depuis la fiche (vérifiés)** :
- Correction : D-067 (PR #92, 9ad7116, migration `20261121130000`) est DÉPLOYÉE : `docs/SIGTB_2.0_HEBERGEMENT_VPS.md` section 9, ligne de la release 9ad7116 (tests 28 et 50 OK sur la base du serveur, release précédente 3bbfded). La réception des pneus et des lots / séries passe de TESTÉ à DÉPLOYÉ.
- D-079 (5) (PR #101) : préparation du bon depuis une consultation sans dépôt (choix du dépôt, `ConsultationsFournisseurs.tsx`), E2E `saisie-referentiels` ; main 33ab8ef, déploiement non consigné.
- D-078 (10) (PR #100) : menu « Budgets » ouvert aux rôles qui lisent `costs`, `invoices`, `reports` ou `contracts` (`AuthContext.tsx:247`), ce qui rend l'engagé des bons visible hors administrateur ; aucun E2E non administrateur : DÉVELOPPÉ, main 33ab8ef.
- Aucun fichier de `src/components/Purchases/` modifié.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Facture d'achat et avoir fournisseur, rapprochement bon / réception / facture, paiement sur facture | L | décision propriétaire (facture obligatoire avant paiement) ; module 20 | ouvert |
| 2 | Contrôle budgétaire à l'approbation (disponible affiché, dépassement signalé ou bloquant) | M | module 20, budgets saisis | ouvert (menu Budgets ouvert par D-078, non déployé) |
| 3 | Liste des bons : recherche, tri, export CSV ; rapports d'achats | S | DataTable, ExportModal | ouvert |
| 4 | Suivi des délais et relances fournisseur | M | notifications | ouvert |
| 5 | Demande d'achat avec vérification du stock libre | M | module 17 | ouvert |
| 6 | Seuils d'approbation et délégations | M | décision propriétaire ; module 24 | ouvert (D-064 : approbation non délégable jusqu'à décision) |
| 7 | Bon de commande imprimable, pièces jointes (devis, BL, facture) | M | lot D | ouvert |
| 8 | Contrôle qualité à réception (réserve, PV) | S | - | ouvert |
| 9 | Duplication d'un bon, approbation en masse | S | BulkActionBar | ouvert |
| 10 | Déploiement de D-067 (réception de pneus et lots) avec contrôles D-069 | S | sauvegarde, pgTAP serveur | traité : release 9ad7116 consignée (journal section 9, tests 28 et 50 OK) |

**Composants communs attendus** : DataTable (bons, demandes d'achat), CreateModal (brouillon de bon, demande d'achat, facture d'achat), EditModal (brouillon), DetailDrawer (bon : lignes, réceptions, paiements), ActionDialog (rejet, annulation, solde motivés, au lieu de `window.prompt`), AttachmentModal (devis, BL, facture), ExportModal (bons, rapports d'achats), HistoryDrawer (journal du bon), BulkActionBar (approbation en masse), AssignmentModal (approbateur selon seuil). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal / EditModal, et n'est pas utilisée dans ce module.

<a id="module-17"></a>

### 17. Stocks et magasins (J2)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | PARTIEL (existant déployé 7abf1b6, 9ad7116) : alerte de seuil par article dans la liste, valeur du stock par dépôt et article (`v_valorisation_depots`, `ValorisationStock.tsx`, pgTAP 50 OK sur le serveur) ; manquent ruptures, couverture en jours, rotation, consommation par engin |
| 02 Liste | PARTIEL | PARTIEL (existant déployé) : articles avec recherche, quantités par dépôt, réservé et libre (`StockView.tsx:269`) ; registre limité aux 300 derniers mouvements (`StockView.tsx:63`), ni filtre, ni tri, ni pagination ; export CSV du registre |
| 03 CRUD | PARTIEL | PARTIEL (existant déployé) : article créé, modifié, archivé (sans restauration) ; dépôt créé seulement, ni modification ni désactivation ; mouvements append-only ; duplication absente |
| 04 Fiche détaillée | MANQUANT | Aucune fiche article (dépôts, lots, réservations, mouvements, consommations) |
| 05 Modals et formulaires | PARTIEL | PARTIEL (existant déployé) : panneaux de saisie (article, dépôt, mouvement, réservation, inventaire) avec contrôle du stock libre affiché (`StockView.tsx:259`) ; `window.confirm` / `window.prompt` pour archivage et motifs ; `ui/Fenetre` non utilisée |
| 06 Actions métier | DEPLOYE | Entrée, sortie, transfert, retour, réservation et levée, inventaire (global et par lot), contre-mouvement `annuler_mouvement_stock` (pgTAP 28, 50 OK sur le serveur, release 9ad7116 ; E2E `stocks-magasin`, `stocks-avances`) ; manquent actions en masse, impression d'un bon de sortie |
| 07 Workflows | PARTIEL | PARTIEL (existant déployé) : réception d'achat -> entrée ; réservation -> sortie qui la consomme -> levée automatique à la clôture de l'ordre (D-067) ; aucune validation (D-044), pas de campagne d'inventaire avec clôture par le responsable, ni délais |
| 08 Documents | MANQUANT | Aucun bon de sortie, de transfert, feuille de comptage ni étiquette ; aucune pièce jointe (`supabase.storage` absent) |
| 09 Rapports | PARTIEL | PARTIEL (existant déployé) : export CSV du registre (`StockView.tsx:298-314`) ; valeur du stock, consommations par engin et période, articles dormants non exportables |
| 10 Historique | DEPLOYE | Registre `stock_movements` append-only (MVT, `enregistre_le`, auteur, motif, annulations reliées), trace des lots `v_stock_lots_mouvements` (release 9ad7116) ; modification d'un article (prix, seuil, suivi) non journalisée |
| 11 Notifications | PARTIEL | PARTIEL (existant déployé) : alerte de seuil affichée dans la liste (`alerteArticle`) ; aucune notification de rupture, de réservation non consommée ni d'inventaire en retard ; aucune règle stock dans `catalogue_regles_alertes` (D-068) |
| 12 Paramétrage | PARTIEL | PARTIEL (existant déployé) : suivi aucun / lot / série et seuil minimum par article, type de dépôt ; catégories (`stock_categories` sans écran), unités (texte libre ; référentiel `unites_mesure` D-064 non relié au formulaire), emplacements, seuil maximum absents |

**Changements depuis la fiche (vérifiés)** :
- Correction : D-067 (PR #92, 9ad7116, migration `20261121130000`) est DÉPLOYÉE : `docs/SIGTB_2.0_HEBERGEMENT_VPS.md` section 9, release 9ad7116 (tests 28 et 50 OK sur la base du serveur, release précédente 3bbfded). Réservations, lots, séries, traçabilité, coût moyen pondéré passent de TESTÉ à DÉPLOYÉ ; la migration et le front à 13 paramètres de `mouvement_stock` sont partis dans la même release (risque de la section 14 de la fiche levé).
- D-064 (PR #97) : référentiel administrateur `unites_mesure` (`Settings/Referentiels.tsx`, `enregistrer_unite`) ; non utilisé par `StockView.tsx` (unité toujours en texte libre). Main 33ab8ef, déploiement non consigné.
- Aucun fichier de `src/components/Stock/` modifié.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Import en masse des articles et de l'inventaire d'ouverture | M | ImportWizard | ouvert |
| 2 | Catégories, unités, emplacements (référentiels et saisie) | M | - | partiellement traité : référentiel `unites_mesure` (D-064), non relié au formulaire article, non déployé |
| 3 | Modification et désactivation des dépôts ; restauration d'un article archivé ; journal des modifications d'articles | S | - | ouvert |
| 4 | Fiche article : dépôts, lots, réservations, mouvements, consommations | M | DetailDrawer | ouvert |
| 5 | Campagne d'inventaire (liste à compter, saisie en masse, validation) | M | BulkActionBar | ouvert |
| 6 | Rapport de coût des consommations par engin, ordre, site, période ; valeur du stock exportable | M | module 21 | ouvert |
| 7 | Seuil maximum, alertes notifiées (rupture, seuil) | S | notifications | ouvert |
| 8 | Registre : filtres, pagination au-delà de 300 lignes | S | DataTable | ouvert |
| 9 | Bons de sortie et de transfert imprimables | S | modèles | ouvert |
| 10 | Déploiement coordonné de D-067 (migration et front dans la même release) | S | D-069 | traité : release 9ad7116 consignée (journal section 9, tests 28 et 50 OK) |

**Composants communs attendus** : DataTable (articles, registre, réservations), CreateModal (article, dépôt, mouvement, réservation), EditModal (article, dépôt), DetailDrawer (fiche article), ArchiveDialog (article, dépôt, avec restauration), ActionDialog (annulation et levée motivées, au lieu de `window.prompt`), ImportWizard (articles, inventaire d'ouverture), ExportModal (valeur du stock, consommations), HistoryDrawer (modifications d'un article, trace d'un lot), BulkActionBar (campagne d'inventaire, archivage groupé). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal / EditModal, et n'est pas utilisée dans ce module.

<a id="module-18"></a>

### 18. Moyens généraux et patrimoine (J4)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | MANQUANT | aucun indicateur (biens par statut et site, valeur nette, biens hors service, coût des réparations, écarts d'inventaire) |
| 02 Liste | PARTIEL | PARTIEL (existant déployé f79e708) : `MoyensGenerauxView.tsx` registre `v_biens` avec recherche et filtres statut, catégorie, site ; ni tri par colonne, ni pagination, ni export |
| 03 CRUD | DÉPLOYÉ | `enregistrer_bien`, `modifier_fiche_bien` (motif, avant/après au journal), `reformer_bien`, `annuler_operation_bien` (D-060, migration `20261118150000`, release f79e708 ; pgTAP 43, 56, E2E `moyens-generaux`) ; duplication (série d'articles) MANQUANT |
| 04 Fiche détaillée | DÉPLOYÉ | fiche du bien : informations, plan d'amortissement, historique, actions selon le statut (D-060, E2E `moyens-generaux`) ; pièces jointes absentes (module 23) |
| 05 Modals et formulaires | DÉPLOYÉ | saisie d'un bien et formulaire par action en panneau, validations serveur (D-060) ; annulations par `window.prompt` (`MoyensGenerauxView.tsx:168,183`) et clôture par `window.confirm` (l. 188) ; n'utilise pas `ui/Fenetre` |
| 06 Actions métier | DÉPLOYÉ | affecter, remettre, restituer, transférer, constater, réparer, réformer ; inventaire ouvert, constaté, clôturé (D-060, pgTAP 43) ; actions en masse MANQUANT |
| 07 Workflows | PARTIEL | PARTIEL (existant déployé f79e708) : cycle de statuts du bien et campagne d'inventaire ouverte puis clôturée ; aucune approbation (réforme au-dessus d'un seuil), aucun traitement tracé des écarts, aucun délai |
| 08 Documents | MANQUANT | aucun PV de remise ou de restitution, fiche, état d'inventaire ou étiquette ; aucune pièce jointe (`supabase.storage` absent) |
| 09 Rapports | MANQUANT | aucun export (registre, amortissement, écarts, réparations) dans `MoyensGenerauxView.tsx` |
| 10 Historique | DÉPLOYÉ | `biens_operations` append-only (auteur, date serveur, motif, avant/après), constats annulés conservés (D-060, pgTAP 43) ; comparaison visuelle des versions de fiche MANQUANT |
| 11 Notifications | MANQUANT | aucune ; le catalogue d'alertes D-068 (`catalogue_regles_alertes`, 9 règles) ne porte aucune règle sur les biens |
| 12 Paramétrage | PARTIEL | catégories (6) et états (4) figés par CHECK ; durée d'amortissement saisie par bien ; droit du module (`stock`) à confirmer ; seuil d'approbation, modèles de PV, référentiel des services MANQUANT |

**Changements depuis la fiche (vérifiés)** : aucun. `git diff e2d129c 33ab8ef` ne touche ni `src/components/MoyensGeneraux/` ni la migration `20261118150000` ; aucune règle d'alerte D-068 ne concerne les biens.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Pièces jointes des biens (facture, PV signé, photo) | S | module 23 (socle de pièces J1) | ouvert |
| 2 | PV de remise / restitution, fiche du bien, état d'inventaire imprimables | S | modèles de documents (module 02) ou `src/lib/exports.ts` | ouvert |
| 3 | Exports CSV / PDF du registre, de l'amortissement, des écarts | S | ExportModal | ouvert |
| 4 | Liste au standard (tri, pagination, colonnes) et tableau de bord patrimoine | S | DataTable | ouvert |
| 5 | Bénéficiaire lié à un compte ou un employé, service ; alerte bien détenu par un compte désactivé | S | module 02 (services) | ouvert |
| 6 | Import CSV de reprise du registre | S | ImportWizard | ouvert |
| 7 | Étiquettes avec numéro d'inventaire | S | génération sans nouvelle dépendance UI | ouvert |
| 8 | Approbation des réformes au-dessus d'un seuil | S | seuil fixé par le propriétaire | ouvert |
| 9 | Création d'un bien depuis une réception d'achat | M | module 16 | ouvert |

**Composants communs attendus** : DataTable (registre), CreateModal (bien), EditModal (fiche motivée), DetailDrawer (fiche du bien), ActionDialog (affecter, réformer, annuler avec motif), HistoryDrawer (journal `biens_operations`), AttachmentModal (factures, PV), ImportWizard (reprise du registre), ExportModal (registre, amortissement), BulkActionBar (transfert d'un lot, étiquettes). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal/EditModal ; cet écran ne l'importe pas.

<a id="module-19"></a>

### 19. Contrats et engagements (J1)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | DEPLOYE | `MonPosteView.tsx` (six indicateurs `indicateurs_charge_contrats`, 12 mois), engagements tenus / non tenus, échéances `v_echeances_contrats` (release 3bbfded ; pgTAP 18, 48 ; E2E `suivi-recouvrement`) ; cumul des pénalités et bonus par contrat absent |
| 02 Liste | PARTIEL | PARTIEL (existant déployé) : liste des contrats triée par référence (`ContratsView.tsx:58`) ; ni filtres par nature et statut, ni pagination, ni export |
| 03 CRUD | TESTE | D-079 : plus de suppression physique (privilège DELETE retiré, `supprimer_element_contrat` pour un élément jamais utilisé d'un brouillon, motif, journal `suppressions_contrats`), tarif en vigueur modifié seulement par avenant (`garde_tarif_en_vigueur`, `modifier_tarif_par_avenant`), avenant par `creer_avenant`, contrat né brouillon ; pgTAP 60, 13 adapté ; E2E `saisie-referentiels` (contrat actif, brouillon). Main 33ab8ef, déploiement non consigné (base déployée 3bbfded) |
| 04 Fiche détaillée | DEPLOYE | Fiche contrat : versions, tarifs, engagements, clauses, échéances, journal (`ContratsView.tsx` ; E2E `contrats`, `contrats-finance`) ; sans pièce jointe (contrat signé, avenant), sans comparaison de versions |
| 05 Modals et formulaires | TESTE | `Formulaires.tsx` (contrat, version, tarif, engagement, clause) et renouvellement / dénonciation sur `ui/Fenetre` (PR #102), formulaire de tarif par avenant (`parAvenant`) ; E2E `contrats`, `saisie-referentiels`. Main 33ab8ef, déploiement non consigné ; suppression d'un brouillon encore par `window.prompt` (motif), pas de DeleteDialog avec dépendances |
| 06 Actions métier | DEPLOYE | Clauses (définir, désactiver, calculer, décider), renouveler, dénoncer, générer et remettre le rapport de performance (release 3bbfded ; pgTAP 48) ; avenant par tarif (D-079, TESTÉ main 33ab8ef) ; activation avec contrôle de complétude et approbation absente (seule garde : un tarif pour sortir du brouillon, D-079) |
| 07 Workflows | PARTIEL | PARTIEL (existant déployé) : cycle mensuel engagements -> rapport figé -> clauses -> décision, renonciation par une autre personne avec approbation ; avenant valable pour l'avenir seulement (`controler_date_avenant`, D-079, TESTÉ) ; ni circuit d'activation validé par la direction, ni approbation des avenants, ni délais |
| 08 Documents | PARTIEL | PARTIEL (existant déployé) : rapport de performance imprimable (`EngagementsView.tsx`, barre d'impression collante PR #102) ; `document_ref` texte, aucun `supabase.storage` ; fiche contrat, grille tarifaire, PV de comité, lettre de dénonciation absents |
| 09 Rapports | PARTIEL | PARTIEL (existant déployé) : rapport de performance figé et remis, export CSV des engagements ; liste des contrats, grille tarifaire par engin, échéancier non exportables |
| 10 Historique | DEPLOYE | `journal_contrats` (avant / après sur contrats, versions, tarifs, engagements), `calculs_clauses_journal` (release 3bbfded) ; journal `suppressions_contrats` (D-079, TESTÉ main 33ab8ef) ; comités sans journal, aucune comparaison de versions |
| 11 Notifications | PARTIEL | PARTIEL (existant déployé) : échéances et clauses à décider dans « Mes validations » (D-056, D-065) ; aucun rappel, courriel ni escalade |
| 12 Paramétrage | PARTIEL | PARTIEL (existant déployé) : unités de facturation par engin (D-033), réglages `contrats_alerte_echeance_jours`, `clauses_renonciation_separee`, grille du loueur (`definir_critere_loueur`) ; natures limitées à `client`, `location`, `autre` (pas de `fournisseur` ni `transport`), contrepartie en texte libre |

**Changements depuis la fiche (vérifiés)** :
- D-078 (10) (PR #100) : `'evaluation-loueur': 'contracts'` ajouté à `modulePermissionMap` (`src/contexts/AuthContext.tsx:246`) : défaut bloquant 1 corrigé dans le code ; aucun E2E avec un profil non administrateur (`contrats-finance.spec.ts` ouvre « Évaluation Neemba » en administrateur) : DÉVELOPPÉ, main 33ab8ef.
- D-079 (4) (PR #101, migration `20261121170000_saisie_referentiels`) : politiques et privilège DELETE retirés sur `contrats`, `contrat_versions`, `contrat_engagements`, `contrat_tarifs` ; `supprimer_element_contrat` (brouillon, aucune référence, motif, journal) ; `garde_tarif_en_vigueur`, `garde_version_en_vigueur`, `garde_retour_brouillon` ; `modifier_tarif_par_avenant`, `creer_avenant`, `controler_date_avenant` ; `definir_clause` / `desactiver_clause` refusées sur une version figée. `ContratsView.tsx` : boutons de suppression réservés au brouillon, ajouts masqués sur une version verrouillée (`tarifsVerrouilles`). Tests : pgTAP 60 (86 assertions), 13 et 48 adaptés ; E2E `saisie-referentiels` (« contrat actif : aucune suppression, tarif en vigueur modifié par avenant », « brouillon : suppression par la fonction serveur, avec motif »), `contrats-finance` adapté.
- PR #102 : `Formulaires.tsx`, `ContratsView.tsx` (renouvellement, dénonciation) et `ComitesView.tsx` sur `ui/Fenetre` ; barre d'impression collante dans `EngagementsView.tsx`.
- Tout ce qui précède : main 33ab8ef, déploiement non consigné.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Ajouter `evaluation-loueur` à `modulePermissionMap` ; E2E avec profil `contract_manager` | S | - | partiellement traité : correctif D-078 (`AuthContext.tsx:246`), non déployé ; E2E non administrateur manquant |
| 2 | Interdire la suppression des versions, tarifs et engagements d'un contrat non brouillon ; suppression avec dépendances et motif | S | migration additive | traité par D-079 (`supprimer_element_contrat`, pgTAP 60, E2E `saisie-referentiels`), non déployé ; DeleteDialog encore à faire (`window.prompt`) |
| 3 | Modification d'un tarif en vigueur seulement par avenant (garde serveur) | M | - | traité par D-079 (`garde_tarif_en_vigueur`, `modifier_tarif_par_avenant`, pgTAP 60), non déployé |
| 4 | Écritures du dossier par fonctions serveur (activation avec contrôle de complétude, approbation) | L | décision propriétaire (activation soumise à la direction) | partiellement traité : contrat né brouillon, sortie du brouillon exige un tarif, avenants par `creer_avenant` (D-079), non déployé ; écritures directes et activation libre restantes |
| 5 | Lien contrat - tiers (fournisseur, client), natures `fournisseur` et `transport` | M | module 15, décision propriétaire | ouvert |
| 6 | Pièces jointes (contrat signé, avenants) | M | lot D | ouvert |
| 7 | Comparaison de versions ; journal des comités | M | HistoryDrawer | ouvert |
| 8 | Exports : liste des contrats, grille tarifaire par engin, échéancier | S | ExportModal | ouvert |
| 9 | Notifications d'échéance et de clause à décider (rappel, escalade) | M | notifications | ouvert |
| 10 | Annulation motivée d'un événement d'échéance saisi à tort | S | - | ouvert |

**Composants communs attendus** : DataTable (contrats, avec filtres nature et statut), CreateModal (contrat, version, tarif, engagement, clause), EditModal (tarif par avenant, engagement), DetailDrawer (fiche contrat), DeleteDialog (élément d'un brouillon : dépendances et motif), ActionDialog (renouvellement, dénonciation, décision de clause), AttachmentModal (contrat signé, avenant), ExportModal (liste, grille tarifaire, échéancier), HistoryDrawer (journal et comparaison de versions), CommentThread (actions de comité). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, utilisée par `Formulaires.tsx`, pas encore CreateModal / EditModal.

<a id="module-20"></a>

### 20. Finance et facturation (J1, J2)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | PARTIEL (existant déployé 3bbfded) : créances ouvertes et en retard par devise (`v_creances`), répartition des coûts (`CostsView`), suivi budgétaire `v_suivi_budgets` (menu ouvert hors administrateur par D-078, DÉVELOPPÉ main 33ab8ef) ; marge par site et mois, DSO, DPO absents |
| 02 Liste | PARTIEL | PARTIEL (existant déployé) : listes de factures, créances, factures Neemba, paiements, coûts avec filtres de période ou de statut ; ni recherche transverse, ni tri, ni pagination, ni vues enregistrées |
| 03 CRUD | DEPLOYE | Réconciliation, facture client (brouillon, annulation, avoir), bon à payer, coût, budget (pgTAP 15, 38, 41, 48, 54 ; E2E `facturation`, `paiements`, `rapports`) ; facture Neemba saisie en une transaction (`saisir_facture_fournisseur`, D-078, pgTAP 61, E2E `factures-neemba`, TESTÉ main 33ab8ef) ; manquent édition d'une facture Neemba avant contrôle, annulation d'un encaissement, factures d'achat |
| 04 Fiche détaillée | DEPLOYE | Détail de facture (lignes, circuit, impression `FactureImprimable.tsx`), réconciliation (lignes, anomalies, décisions), facture Neemba (lignes, contrôle, régularisations) ; aucune pièce jointe (facture reçue, preuve de paiement) |
| 05 Modals et formulaires | PARTIEL | PARTIEL (existant déployé) : rectification de ticket (`ReconciliationView.tsx`), encaissement et relance (`RecouvrementView.tsx`), facture reçue et régularisation (`FacturesNeembaView.tsx`) passées sur `ui/Fenetre` (PR #102, TESTÉ main 33ab8ef via E2E `factures-neemba`, `suivi-recouvrement`) ; motifs encore par `window.prompt`, panneaux en page ailleurs |
| 06 Actions métier | DEPLOYE | Soumettre, signer (director seul), émettre, annuler, avoir, encaisser, relancer, contrôler et notifier Neemba, régulariser, proposer / approuver / exécuter / contrôler un paiement (release 3bbfded, 16f149e) ; refus de « facturable » si `net_superieur_capacite` (D-078, pgTAP 61, TESTÉ) ; actions en masse absentes |
| 07 Workflows | DEPLOYE | J1 réconciliation -> facture -> signature DG -> émission -> encaissement -> relances ; J2 facture Neemba -> contrôle -> notification -> régularisation ; paiement proposé -> approuvé par une autre personne -> exécuté -> contrôlé (pgTAP 15, 38, 54) ; signature refusée au délégant du préparateur (`avancer_facture`, D-064, pgTAP 59, TESTÉ main 33ab8ef) ; délais et escalades absents |
| 08 Documents | PARTIEL | PARTIEL (existant déployé) : facture et avoir imprimables, lettres de relance (niveaux 1 à 3) et de notification d'écart Neemba ; aucun import ni pièce jointe (`supabase.storage` absent), bon à payer et état de rapprochement non imprimables |
| 09 Rapports | PARTIEL | PARTIEL (existant déployé) : CSV réconciliation, coûts, écritures de gestion (`ecritures_gestion`) ; balance âgée des créances et des dettes, rentabilité, export en partie double absents |
| 10 Historique | DEPLOYE | Actions de facture, paiement, réconciliation horodatées avec auteur et motif (D-029, D-055), budgets révisés par remplacement et annulés avec motif ; plan comptable et comptes de tiers modifiés sans historique ; décision de réconciliation invalidée non journalisée (limite D-078) |
| 11 Notifications | PARTIEL | PARTIEL (existant déployé) : facture à signer, paiement à approuver ou à contrôler, budget dépassé dans « Mes validations » ; échéance de créance, relance due, dette échue calculées mais non notifiées |
| 12 Paramétrage | PARTIEL | PARTIEL (existant déployé) : natures de dépense, plan comptable, comptes de tiers (onglet Référentiels ouvert au droit `contracts` par D-078, DÉVELOPPÉ), réglage `paiements_validation_separee` ; aucun écran des catégories de coût (`cost_categories` lu seulement) |

**Changements depuis la fiche (vérifiés)** :
- D-078 (10) et (16) (PR #100) : `'budgets': ['costs', 'invoices', 'reports', 'contracts']` dans `modulePermissionMap` (`src/contexts/AuthContext.tsx:247`) et onglets de `FinanceView.tsx` alignés sur les politiques de lecture (`ongletsVisibles` ; `contracts` ne voit que Référentiels) : défaut bloquant 1 corrigé dans le code ; aucun E2E non administrateur : DÉVELOPPÉ.
- D-078 (11) : `saisir_facture_fournisseur` (en-tête et lignes en une transaction, numéro unique par contrat, décimales refusées en GNF) ; écritures directes sur `factures_fournisseur` et ses lignes retirées ; `FacturesNeembaView.tsx` appelle la fonction : défaut bloquant 2 corrigé ; pgTAP 61, E2E `factures-neemba` adapté.
- D-078 (3), (7), (14), (18bis) : anomalie `net_superieur_capacite` (`actualiser_reconciliation`, `ligne_bloquee`, `decider_ligne_reconciliation`), `ouvrir_reconciliation` refuse les sites qui se recoupent, décision « facturable » périmée invalidée, `cloturer_reconciliation` en défense en profondeur ; libellés dans `Facturation/facturation.ts` ; pgTAP 61.
- D-064 (PR #97) : `avancer_facture` recréée avec `separation_violee` (le DG ne signe pas la facture préparée par son délégué) ; pgTAP 59.
- D-079 (PR #101) : `controler_date_avenant` empêche un avenant de couvrir une période déjà facturée (factures et factures loueur) ; pgTAP 60.
- PR #102 : `ui/Fenetre` dans `ReconciliationView.tsx`, `RecouvrementView.tsx`, `FacturesNeembaView.tsx` ; `ReferentielVide` quand aucun contrat client n'existe (réconciliation).
- Tout ce qui précède : main 33ab8ef, déploiement non consigné.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Ajouter `budgets` à `modulePermissionMap` ; E2E avec profil comptable | S | - | partiellement traité : correctif D-078 (`AuthContext.tsx:247`, onglets `FinanceView`), non déployé ; E2E profil comptable manquant |
| 2 | Écran du référentiel des catégories de coût (administrateur) | S | - | ouvert |
| 3 | Saisie atomique d'une facture Neemba ; édition avant contrôle ; saisie du TTC | S | décision HT / TTC de la facture notifiée | partiellement traité : saisie atomique par D-078 (`saisir_facture_fournisseur`, pgTAP 61), non déployé ; édition et TTC ouverts |
| 4 | Annulation motivée d'un encaissement saisi à tort | S | - | ouvert |
| 5 | Factures d'achat et rapprochement bon / réception / facture avant paiement | L | module 16 | ouvert |
| 6 | Rentabilité par site et mois (même devise), balance âgée créances et dettes | M | ventilation des factures CBG par site (propriétaire) | ouvert |
| 7 | Brancher le moteur de décompte (D-013/D-014) au contrôle Neemba quand les paramètres sont saisis | M | paramètres du dossier | ouvert |
| 8 | Retenues sur paiement (garantie, à la source) | M | décision propriétaire | ouvert |
| 9 | Pièces jointes (factures reçues, preuves de paiement) | M | lot D | ouvert |
| 10 | Notifications d'échéance (créances, dettes), relances en masse | M | notifications, BulkActionBar | ouvert |
| 11 | Export comptable en partie double, historisation du plan comptable | M | dérogations D-065 (propriétaire) | ouvert |
| 12 | Retrait des tables héritées `invoices`, `invoice_items`, `payments` (schéma d'archive, D-071) | S | sauvegarde | ouvert |

**Composants communs attendus** : DataTable (factures, créances, paiements, coûts), CreateModal (bon à payer, encaissement, budget, coût, facture reçue), EditModal (facture Neemba avant contrôle, budget révisé), DetailDrawer (facture, paiement, facture loueur), ActionDialog (signature, rejet, annulation, contrôle motivés, au lieu de `window.prompt`), AttachmentModal (facture reçue, preuve de paiement, relevé), ExportModal (balance âgée, écritures, rentabilité), HistoryDrawer (circuit d'une facture ou d'un paiement), BulkActionBar (approbation de paiements, relances en masse). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, utilisée par la rectification, l'encaissement et la facture reçue, pas encore CreateModal / EditModal.

<a id="module-21"></a>

### 21. Reporting et BI (J3)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | (existant déployé f59a4b0) tableau jour par jour `rapport_mensuel_par_jour`, `Provenance`, compteur « sans mesure » (`ReportsView.tsx`) ; aucun graphique dans `ReportsView` ni `AnalysesFlotte`, pas de tableau de bord des rapports figés |
| 02 Liste | PARTIEL | (existant déployé f59a4b0) liste des 20 derniers rapports figés (`ReportsView.tsx:67`) ; ni recherche, ni filtre, ni pagination, ni vue enregistrée |
| 03 CRUD | DÉPLOYÉ | rapport figé : créer (`figer_rapport`), consulter, modification et suppression refusées (déclencheur `rapports_figes_immuables`) ; pgTAP `41_reporting`, `54_correctifs_revue_finance_reporting` ; release f59a4b0. Manquent : modèles de rapport personnalisés, lien « remplace » |
| 04 Fiche détaillée | PARTIEL | (existant déployé f59a4b0) rapport calculé affiché par section avec provenance ; rapport figé sans fiche (CSV et impression seulement) |
| 05 Modals et formulaires | PARTIEL | (existant déployé f59a4b0) formulaire de paramètres (`argumentsRapport`, `periodeValide`, `src/lib/rapports.test.ts`) ; note du rapport figé par `window.prompt` (`ReportsView.tsx:121`), pas d'ActionDialog ni d'ExportModal |
| 06 Actions métier | DÉPLOYÉ | calculer, figer (poste clos exigé pour un rapport de shift), réexporter et réimprimer un figé ; e2e `rapports.spec.ts` (3) ; release f59a4b0. Manquent : comparer deux figés, exports en masse |
| 07 Workflows | PARTIEL | (existant déployé) rapport de shift figé après clôture du poste (D-048) ; lien rapport figé vers facture CBG et comité Neemba absent, envoi planifié absent |
| 08 Documents | PARTIEL | (existant déployé) impression navigateur (`exportToPDF`, `exports.ts`) ; pas de modèle A4 (en-tête, numéro RAP, auteur, pied paginé), aucune pièce stockée |
| 09 Rapports | PARTIEL | (existant déployé) CSV (`buildCSV`, `exports.test.ts`) et impression ; Excel natif (`exportToExcel` = CSV) et PDF serveur absents |
| 10 Historique | PARTIEL | (existant déployé f59a4b0) `rapports_figes` append-only, numéro, auteur, heure ; ni comparaison de versions, ni journal de consultation et d'export |
| 11 Notifications | MANQUANT | aucun événement (rapport figé, mensuel attendu non figé, envoi) |
| 12 Paramétrage | MANQUANT | liste fermée `RAPPORTS` (`src/lib/rapports.ts`) ; ni modèles de rapport, ni abonnements |

**Changements depuis la fiche (vérifiés)** :
- `ReportsView.tsx` : seul un libellé change (renvoi « Postes de travail »), sans effet fonctionnel.
- `src/lib/exports.ts` : `documentImpression` et `imprimerTableau` ajoutés (D-068, testés dans `exports.test.ts`), utilisés par les modules 01 et non par `ReportsView` (toujours `exportToPDF`).
- Comparaison de périodes (écart 4 partagé) réalisée au module 01 sur `indicateurs_pilotage` (`Pilotage/pilotage.ts`), pas dans les rapports ; non déployée.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Rapport financier de gestion (facturé, encaissé, créances, dettes, coût par tonne, par devise) | M | module 20, D-058 | ouvert |
| 2 | Lien rapport figé et facture / comité, « remplace » motivé | S | modules 19, 20 | ouvert |
| 3 | Modèles d'impression A4 et détail d'un rapport figé | S | DetailDrawer, ExportModal | ouvert |
| 4 | Graphiques et comparaisons de périodes | M | partagé avec le module 01 | partiellement traité : comparaison de périodes au centre de pilotage (D-068, `comparerIndicateurs`), non déployée ; rien dans les rapports, aucun graphique |
| 5 | Générateur et tableaux croisés (liste fermée d'indicateurs, aucun SQL libre) | L | format commun D-058 | ouvert |
| 6 | Export Excel natif et PDF serveur | M | décision du propriétaire (nouvelle dépendance) | ouvert |
| 7 | Planification d'envoi | M | passerelle courriel (intégration externe) | ouvert |

**Composants communs attendus** : DataTable (rapports figés), DetailDrawer (détail d'un rapport figé), ActionDialog (figer avec note et confirmation), ExportModal (CSV, impression, Excel), HistoryDrawer (versions d'un rapport figé). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal/EditModal, non utilisée ici.

<a id="module-22"></a>

### 22. Santé, sécurité et environnement (J1 pour le contrôle avant départ, J4 pour le reste)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | MAQUETTE | seul écran d'indicateurs : `ESG/ESGTrackingView.tsx` (lit des tables que rien n'alimente, 4 boutons sans action, toujours au menu `esg-tracking`) ; aucun tableau de bord HSE (contrôles du jour, incidents par type, actions ouvertes, EPI et inspections échus) |
| 02 Liste | PARTIEL | PARTIEL (existant déployé 04140d7) : incidents avec filtres simples (200 derniers), contrôles depuis une date ; listes EPI, risques, plans, inspections de `HsePreventionView.tsx:69-73` (D-068, limitées à 200-300 lignes, sans recherche ni filtre) ; ni pagination ni export |
| 03 CRUD | TESTÉ | contrôles et incidents (D-054, déployés 04140d7, pgTAP 37, 54) ; dotations EPI, registre des risques versionné, plans de prévention (brouillon modifiable, nouvelle version), programmes et inspections, avec annulation motivée (`enregistrer_risque`, `enregistrer_plan_prevention`, `remettre_epi`, `annuler_dotation_epi`, `definir_programme_inspection`, D-068, pgTAP 51, E2E `decisions-hse`) ; main 33ab8ef, déploiement non consigné ; réouverture et annulation d'un incident MANQUANT |
| 04 Fiche détaillée | MANQUANT | aucune fiche incident (chronologie, rattachements, actions, pièces, journal) ; aucune fiche de risque ou d'inspection |
| 05 Modals et formulaires | PARTIEL | PARTIEL (existant déployé) : panneaux de saisie du contrôle et de l'incident ; cause, conclusion, motifs, preuves par `window.prompt` (`IncidentsView.tsx:83`, `HsePreventionView.tsx:111,311`) et signature par `window.confirm` (l. 233) ; aucun champ conditionnel par type d'incident ; aucun écran HSE n'importe `ui/Fenetre` |
| 06 Actions métier | TESTÉ | déclarer, analyser, clore, actions correctives (déployé) ; remettre, restituer, renouveler un EPI, réviser un risque, signer un plan, planifier, réaliser, annuler une inspection, actions correctives d'inspection (`signer_plan_prevention`, `realiser_inspection`, `ajouter_action_inspection`, D-068, pgTAP 51, E2E `decisions-hse` « dotation EPI et signature ») ; main 33ab8ef, non consigné ; réouverture d'incident et actions en masse MANQUANT |
| 07 Workflows | TESTÉ | plan de prévention signé par un titulaire de l'approbation `trips` autre que le rédacteur et les contributeurs, plans à signer dans « Mes validations » ; inspection planifiée selon une fréquence, une occurrence à la fois (`planifier_suivante`) (D-068, pgTAP 51, non consigné) ; déclaration, analyse, clôture d'incident (déployé) sans séparation déclarant / clôtureur ni enquête formalisée |
| 08 Documents | MANQUANT | aucune fiche de contrôle, déclaration, rapport d'enquête ou registre EPI imprimable ; aucune pièce jointe (`supabase.storage` absent) |
| 09 Rapports | PARTIEL | PARTIEL (existant déployé) : incidents dans `rapport_journalier` (D-058) ; aucun rapport HSE mensuel, aucun export du registre des incidents, contrôles, EPI ou risques |
| 10 Historique | DÉPLOYÉ | contrôles append-only à libellés figés, incidents jamais supprimés, révision de cause motivée (D-054, D-072, pgTAP 37, 54) ; versions des risques `risques_versions` et garde `garde_append_only_hse` (D-068, TESTÉ, non consigné) ; aucun journal consultable à l'écran |
| 11 Notifications | TESTÉ | règles `controle_non_conforme`, `action_corrective_retard`, `epi_echu`, `inspection_retard` de `catalogue_regles_alertes` (registre `alerts`, `actualiser_alertes`, `resoudre_alerte` motivée), Centre des décisions et « Mes validations » (D-068, pgTAP 51, E2E `decisions-hse` « alertes du serveur ») ; main 33ab8ef, non consigné ; calcul à la lecture, ni courriel ni SMS, aucune escalade des accidents graves |
| 12 Paramétrage | PARTIEL | points de contrôle et exigence `controle_depart_exige` (déployé) ; activations `alerte_*_active` par `valider_reglage` (D-068, TESTÉ) ; types d'EPI codés en dur (`hse.ts:55`), gravité et probabilité fixées de 1 à 5 sans échelle du propriétaire ; aucun droit `hse` dédié |

**Changements depuis la fiche (vérifiés)** :
- D-068 partie HSE (PR #99, migration `20261121150000_decisions_hse`) : tables `dotations_epi`, `risques`, `risques_versions`, `plans_prevention`, `programmes_inspection`, `inspections`, `constats_inspection` ; fonctions `remettre_epi`, `restituer_epi`, `annuler_dotation_epi`, `enregistrer_risque`, `enregistrer_plan_prevention`, `signer_plan_prevention`, `annuler_plan_prevention`, `definir_programme_inspection`, `planifier_inspection`, `realiser_inspection`, `annuler_inspection`, `ajouter_action_inspection` ; `actions_correctives.incident_id` facultatif (origine inspection). Écran `src/components/Hse/HsePreventionView.tsx` (onglets EPI, Registre des risques, Plans de prévention, Inspections), menu `hse-prevention` (`menu.ts:120`, droit `trips`, `AuthContext.tsx:266`). pgTAP 51 (104 assertions), E2E `decisions-hse.spec.ts` (test l. 99), unitaires `Hse/hse.test.ts`. Main 33ab8ef, déploiement non consigné.
- D-068 alertes : 4 des 9 règles concernent le HSE (contrôle non conforme, action corrective en retard, EPI à renouveler, inspection en retard) ; `AlertsView` supprimé, remplacé par `Decisions/CentreDecisionsView.tsx`.
- La fiche affirmait « D-068 : aucune branche ni migration » : dépassé, la décision est fusionnée.
- Inchangé : `ESGTrackingView.tsx` toujours au menu, menu Incidents toujours sous le droit `reports` (`AuthContext.tsx:264`).

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Pièces jointes des contrôles, incidents et inspections (photos, constat, rapport) | S | module 23 (J1) | ouvert |
| 2 | Fiche de contrôle avant départ imprimable et saisie différée | S | modèle des fiches terrain (D-028) | ouvert |
| 3 | Fiche incident complète, réouverture motivée, champs conditionnels par type, export du registre | M | DetailDrawer, ExportModal | ouvert |
| 4 | Responsable d'action = compte utilisateur, relances, notifications des accidents graves | S | modules 02, 24 | partiellement traité : actions en retard en alerte (D-068, non déployé) ; responsable toujours en texte libre, aucune escalade |
| 5 | Retrait ou étiquetage « non repris » de l'écran Environnement ; incidents environnementaux portés par `incidents` | S | sort des tables héritées (D-069 point 4) | ouvert |
| 6 | EPI : types, dotations, renouvellements, restitutions | M | J4 ; référentiel du propriétaire | traité par D-068 (pgTAP 51, E2E `decisions-hse`), non déployé ; types d'EPI codés en dur |
| 7 | Inspections planifiées (programmes, résultats, constats, actions) | M | J4 | traité par D-068 (pgTAP 51), non déployé ; aucun modèle de liste de points d'inspection |
| 8 | Formations et habilitations de tout le personnel | M | module 02 ; RH | ouvert |
| 9 | Registre des risques et plans de prévention | L | échelles et réglementation du propriétaire | traité par D-068 (registre versionné, plans signés, pgTAP 51), non déployé ; échelles 1 à 5 à confirmer par le propriétaire |
| 10 | Rapport HSE mensuel et tableau de bord | M | heures travaillées fiables | ouvert |
| 11 | Droit dédié `hse` et cloisonnement des données de blessure et disciplinaires | S | décision du propriétaire ; migration | ouvert (D-068 garde le droit `trips`) |

**Composants communs attendus** : DataTable (incidents, contrôles, EPI, risques, inspections), CreateModal (incident, dotation, risque, plan), EditModal (brouillon de plan, révision de risque), DetailDrawer (fiche incident, inspection), ActionDialog (cause, clôture, signature, annulation motivée, remplace `window.prompt`), AttachmentModal (photos, constats), HistoryDrawer (versions de risque, révisions de cause), AssignmentModal (responsable d'action), ExportModal (registres), BulkActionBar (relances). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal/EditModal ; aucun écran HSE ne l'importe.

<a id="module-23"></a>

### 23. Documents et GED (J1 pour le socle de pièces jointes, J4 pour la GED avancée)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | PARTIEL (existant déployé) : documents de véhicule à renouveler (`v_documents_vehicule_a_renouveler`, D-062, pgTAP 45) ; aucune vue des pièces manquantes par processus J1, des documents expirés par domaine, du volume stocké |
| 02 Liste | PARTIEL | PARTIEL (existant déployé) : `VehicleDocumentsView.tsx` recherche, filtres, alertes, métadonnées de véhicule seulement ; aucune bibliothèque documentaire, ni pagination ni export |
| 03 CRUD | PARTIEL | PARTIEL (existant déployé) : métadonnées de document de véhicule créées, modifiées (update direct sans journal), archivées ; aucun fichier : pièce jointe, version, type de document, dossier MANQUANT |
| 04 Fiche détaillée | MANQUANT | aucune fiche de document, aucune visionneuse, aucun onglet « Pièces » dans les fiches métier |
| 05 Modals et formulaires | PARTIEL | `VehicleDocumentModal.tsx` sur `ui/Fenetre`, coût contrôlé en entier GNF (`entierOuNull`, l. 44, D-078, PR #100, main 33ab8ef, non consigné) ; mention « pièce jointe indisponible » ; AttachmentModal (dépôt, contrôle, progression) MANQUANT |
| 06 Actions métier | PARTIEL | PARTIEL (existant déployé) : archivage d'un document de véhicule seulement ; joindre, remplacer, retirer avec motif, valider, rejeter, joindre en masse MANQUANT |
| 07 Workflows | MANQUANT | aucun circuit de validation, aucune rétention, aucun partage contrôlé |
| 08 Documents | MANQUANT | aucun `supabase.storage` dans `src/` ; seul `type="file"` : import CSV du relevé CBG (`Fiches/TicketsCbgView.tsx:118`, module 14), lu sans être stocké ; service storage retiré de la pile (`deploy/vps/docker-compose.yml:7`) ; ni prévisualisation, ni téléchargement, ni impression de pièce stockée |
| 09 Rapports | MANQUANT | aucun registre des documents, aucune liste des pièces manquantes, aucune archive des pièces d'une période de facturation |
| 10 Historique | MANQUANT | aucun journal de dépôts, versions, retraits ; `vehicle_documents` modifié sans journal |
| 11 Notifications | PARTIEL | échéances des documents de véhicule à l'écran (déployé) ; règle `document_expire` (document d'engin ou habilitation de chauffeur expiré) au registre des alertes, Centre des décisions (D-068, pgTAP 51, main 33ab8ef, non consigné) ; documents fournisseurs, pièce exigée manquante, document à valider MANQUANT |
| 12 Paramétrage | MANQUANT | aucun référentiel des types de documents (types codés par table : `vehicle_documents`, `documents_fournisseurs`, `habilitations_chauffeur`), ni formats, tailles, rétention |

**Changements depuis la fiche (vérifiés)** :
- D-078 (PR #100) : défaut 2 corrigé, coût entier GNF contrôlé côté client (`VehicleDocumentModal.tsx:43-50`, `src/lib/formulaires.ts` `entierOuNull`, unitaires `formulaires.test.ts`).
- PR #102 : `VehicleDocumentModal.tsx` passe sur `ui/Fenetre` (`ErreurFenetre`, pied de boutons toujours visible).
- D-068 (PR #99) : règle d'alerte `document_expire` dans `catalogue_regles_alertes` (migration `20261121150000_decisions_hse`, pgTAP 51).
- Inchangé : aucun stockage de fichiers, aucun bucket ; défaut 1 (bloquant J1) et défaut 3 (update direct sans journal) ouverts. Main 33ab8ef, déploiement non consigné pour ces changements.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Socle pièces jointes J1 : service Storage dans la pile, volume sauvegardé et restauré, Caddy (procédure D-069), bucket privé, tables `types_documents`, `pieces_jointes`, `pieces_versions`, `pieces_journal`, fonctions `deposer_piece` / `confirmer_piece` / `url_piece` / `retirer_piece`, politiques par module et site, contrôle de type et taille ; AttachmentModal | L | revue indépendante ; taille et formats du propriétaire ; sauvegarde vérifiée | ouvert (bloquant J1) |
| 2 | Branchement J1 : tickets et relevés CBG, fiches terrain signées, relevés kilométriques, livraisons carburant, factures Neemba, factures et avoirs ; pièces figées avec l'objet | M | lot 1 | ouvert |
| 3 | Branchement des documents existants (véhicules, habilitations, fournisseurs, biens, incidents, inspections HSE D-068) | M | lot 1 | ouvert |
| 4 | Pièces manquantes par processus et archive des pièces d'une période de facturation | S | lot 2 | ouvert |
| 5 | Bibliothèque : recherche par métadonnées, filtres, prévisualisation, dossiers par objet | M | lot 3 ; DataTable | ouvert |
| 6 | Notifications d'expiration (véhicules, chauffeurs, fournisseurs) | S | module 24 | partiellement traité : véhicules et habilitations par la règle `document_expire` (D-068), non déployé ; fournisseurs ouverts |
| 7 | Circuits de validation par type de document | M | module 24 ; J4 | ouvert |
| 8 | Rétention par type, jamais de destruction automatique | S | durées du propriétaire ; J4 | ouvert |
| 9 | Partage contrôlé (URL signée vers un compte connecté) | S | lot 1 ; module 25 | ouvert |
| 10 | OCR des tickets | L | déclencheur (échantillon réel, CSV insuffisant) | ouvert (non commencé, déclencheur) |
| 11 | Signature électronique | L | déclencheur (cadre juridique) | ouvert (non commencé, déclencheur) |
| 12 | Coût décimal refusé par le serveur (défaut 2) ; modification de document sans journal (défaut 3) | S | aucune | partiellement traité : défaut 2 par D-078 (non déployé) ; défaut 3 ouvert |

**Composants communs attendus** : AttachmentModal (dépôt et versions des pièces de tous les modules), DetailDrawer (visionneuse PDF et image), ActionDialog (retrait motivé), HistoryDrawer (dépôts, versions, retraits), DataTable (bibliothèque, documents de véhicule), CreateModal et EditModal (document, type de document), ImportWizard (dépôt en masse rattaché par numéro de ticket), ExportModal (registre, archive d'une période), BulkActionBar (jonction en masse). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal/EditModal.

<a id="module-24"></a>

### 24. Bureau numérique et workflow (J3)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | DÉPLOYÉ | « À traiter (N) » par catégorie, ancienneté, notifications non lues (`Notifications/MesValidationsView.tsx`), compteur de la barre supérieure ; pgTAP `39_validations_notifications`, e2e `mes-validations.spec.ts` ; releases debf876 et 3bbfded. Manquent : retard sur délai cible, charge par équipe |
| 02 Liste | PARTIEL | (existant déployé debf876) boîte triée par ancienneté seulement, 100 notifications au plus ; liste « Mes délégations » avec statut (`Settings/Delegations.tsx`, testée, non déployée) ; ni recherche, ni filtre, ni pagination |
| 03 CRUD | PARTIEL | délégation créée et révoquée (`deleguer_droit`, `revoquer_delegation`, pgTAP `47_organisation`, `59_separation_delegation`, e2e `organisation`), main 33ab8ef, déploiement non consigné ; notifications en lecture seule (déployé) ; tâches, commentaires, modèles de circuit MANQUANT |
| 04 Fiche détaillée | MANQUANT | aucun DetailDrawer d'élément ni de dossier ; la boîte renvoie à l'écran du module |
| 05 Modals et formulaires | PARTIEL | (existant testé, non déployé) formulaire de délégation contrôlé (`erreurDelegation`, `organisation.test.ts`) et motif de révocation ; ni aperçu ni décision dans la boîte, pas d'AssignmentModal |
| 06 Actions métier | PARTIEL | (existant déployé) ouvrir l'écran, marquer lu, tout marquer lu ; déléguer et révoquer (testé, non déployé) ; décider depuis la boîte, décisions en masse, affecter une tâche MANQUANT |
| 07 Workflows | PARTIEL | (existant déployé) circuits codés par module (D-029, D-041, D-048, D-049, D-053, D-055) ; délégation de l'écriture datée et motivée (D-064, testé, non déployé ; l'approbation ne se délègue pas) ; délais, relances, escalades, approbations multiples, étapes conditionnelles MANQUANT |
| 08 Documents | MANQUANT | aucun document propre ; modèles de notifications codés dans les déclencheurs |
| 09 Rapports | MANQUANT | aucun export dans `MesValidationsView.tsx` ; pas de rapport des délais de validation (l'export CSV du centre des décisions relève du module 01) |
| 10 Historique | PARTIEL | (existant déployé) `read_at`, journaux par module ; `journal_delegations` append-only (D-064, testé, non déployé) ; pas d'historique transverse d'un dossier |
| 11 Notifications | PARTIEL | (existant déployé debf876) `notifier` et déclencheurs achat, paiement, contrôle, clôture de poste ; relance, escalade, courriel et SMS MANQUANT |
| 12 Paramétrage | MANQUANT | aucun circuit paramétrable ; modules non délégables figés dans le code (`MODULES_NON_DELEGABLES = ['settings']`, `organisation.ts:33`) ; pas de délai cible ni de modèle de notification |

**Changements depuis la fiche (vérifiés)** :
- D-064 (PR #97) : `delegations_droits`, `deleguer_droit`, `revoquer_delegation`, `mes_delegations`, `comptes_delegables`, `journal_delegations` (migration `20261121140000_organisation.sql`) ; `has_module_write` lit la délégation en vigueur, `has_module_approve` non ; pgTAP 47 (142) et 59 (33), e2e `organisation.spec.ts` « délégation » ; écran Sécurité du compte > Mes délégations (`Auth/SecuriteCompte.tsx`) et Paramètres ; non déployé.
- D-068 (PR #99) : `mes_validations()` recréée avec la colonne `objet_id` et les plans de prévention à signer ; `centre_decisions()` regroupe alertes et validations par priorité (pgTAP 51) ; non déployé.
- PR #102 : `MesValidationsView` et `Delegations` n'utilisent pas `ui/Fenetre.tsx`.

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Échéances regroupées (habilitations, documents fournisseurs et véhicules, tickets orphelins anciens) | S | modules 08, 09, 14, 15 | partiellement traité par D-068 : alertes « document d'engin ou habilitation expiré », EPI, inspection et voyage sans ticket au centre des décisions (pgTAP 51), non déployé ; échéances à venir non regroupées dans la boîte |
| 2 | Décision depuis la boîte (DetailDrawer, ActionDialog sur les fonctions existantes) | M | composants communs (D-077) | ouvert |
| 3 | Délégations (revue indépendante : droits) | M | module 02 ; règles du propriétaire | partiellement traité par D-064 : écriture seulement, l'approbation ne se délègue pas en attendant le propriétaire (pgTAP 47, 59), non déployé |
| 4 | Tâches et commentaires (AssignmentModal, CommentThread) | M | socle commun | ouvert |
| 5 | Délais, relances, escalades | M | réglages `settings` | ouvert |
| 6 | Circuits paramétrables et étapes conditionnelles (revue indépendante : argent) | L | modules 16, 20 | ouvert |
| 7 | Courriel et SMS | M | passerelle (intégration externe) | ouvert |

**Composants communs attendus** : DataTable (boîte, délégations), DetailDrawer (aperçu de l'élément), ActionDialog (décision, révocation motivée), AssignmentModal (tâches), CommentThread (dossier), HistoryDrawer (étapes d'un dossier), BulkActionBar (décisions en masse), ExportModal (boîte et tâches). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal/EditModal.

<a id="module-25"></a>

### 25. Portails partenaires (J4, déclencheur)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | MANQUANT | aucun tableau de bord CBG, Neemba ou fournisseur |
| 02 Liste | MANQUANT | aucun écran partenaire (portail Bolt retiré, D-042) |
| 03 CRUD | MANQUANT | ni compte partenaire, ni dépôt, ni réclamation |
| 04 Fiche détaillée | MANQUANT | aucune consultation de dossier autorisé |
| 05 Modals et formulaires | MANQUANT | aucun formulaire de dépôt ou de réponse |
| 06 Actions métier | MANQUANT | soumission de facture, réponse aux écarts : saisie interne seulement (modules 10, 14) |
| 07 Workflows | MANQUANT | aucun circuit partenaire ; suivi des validations absent |
| 08 Documents | MANQUANT | aucun dépôt documentaire (aucun `supabase.storage` ; seul `TicketsCbgView.tsx` lit un fichier, en interne) |
| 09 Rapports | MANQUANT | aucun export partenaire |
| 10 Historique | MANQUANT | aucun historique des échanges |
| 11 Notifications | MANQUANT | aucune notification partenaire |
| 12 Paramétrage | MANQUANT | ni type de compte, ni `profiles.organisation_id`, ni invitation ; le module de droit `client_portal` reste un reliquat sans écran |

**Changements depuis la fiche (vérifiés)** :
- aucun changement fonctionnel. Le libellé `client_portal: 'Portail client'` a quitté `Settings/UserModal.tsx` pour `Settings/organisation.ts:26` (`LIBELLES_MODULES`, PR #97) ; il n'est pas dans `MODULES_NON_DELEGABLES` et peut donc être proposé dans le formulaire de délégation à un compte qui détiendrait ce droit d'écriture : reliquat à retirer.
- D-064 n'ajoute ni `organisation_id` ni type de compte au profil (vérifié dans `20261121140000_organisation.sql` et `20261121170000_saisie_referentiels.sql`).

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Stockage des pièces jointes (bucket privé, politiques par module et site) | M | module 23, D-069 point 2 | ouvert |
| 2 | Identité et type de compte (`profiles.organisation_id`, interne ou partenaire, sans ouvrir d'accès) | S | module 02 | ouvert (D-064 ne le couvre pas) |
| 3 | Retrait du module de droit `client_portal` | S | décision du propriétaire | ouvert ; aggravé : libellé délégable (`organisation.ts`) |
| 4 | Portail Neemba (interventions puis factures) | M à L | déclencheur : accord écrit et test d'isolation RLS vert | ouvert |
| 5 | Portail CBG (relevés et écarts) | M | déclencheur | ouvert |
| 6 | Portail fournisseurs | L | déclencheur | ouvert |

**Composants communs attendus** : DataTable (dossiers autorisés), DetailDrawer (dossier), AttachmentModal (dépôt de relevé, de facture), ImportWizard (relevé CBG), ActionDialog (réponse à un écart, réclamation), CommentThread (échanges), HistoryDrawer (historique des échanges). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal/EditModal.

<a id="module-26"></a>

### 26. Intelligence opérationnelle et IA (J4, déclencheur pour les prévisions)

| Bloc | État | Preuve |
|---|---|---|
| 01 Dashboard | PARTIEL | (existant déployé) explication de chaque recommandation (`Dispatch/recommandation.ts`), hypothèses sourcées de `simuler_objectif` ; aucun tableau de bord propre (taux d'acceptation des recommandations absent malgré `decisions_dispatch`) |
| 02 Liste | PARTIEL | (existant déployé 5ef4ab6) recherche globale, 5 résultats par type (`Search/GlobalSearchModal.tsx`, `recherche.test.ts`), liste des anomalies carburant ; aucun journal transverse listable, ni filtre ni pagination |
| 03 CRUD | PARTIEL | (existant déployé) recommandations et scénarios calculés, décision historisée ; seuil d'anomalie non mémorisé, journal transverse des recommandations MANQUANT |
| 04 Fiche détaillée | PARTIEL | (existant déployé 3dc77d4) explication dans `Dispatch/FenetreDecision.tsx` ; aucune fiche d'anomalie ni explication d'indicateur |
| 05 Modals et formulaires | DÉPLOYÉ | `FenetreDecision.tsx` (accepter, modifier, refuser, motif obligatoire, contraintes serveur) ; e2e `dispatch.spec.ts`, `dispatch-voyages.spec.ts` ; release 3dc77d4 ; reprise sur `ui/Fenetre.tsx` (PR #102) non déployée |
| 06 Actions métier | DÉPLOYÉ | `decider_affectation`, affectation groupée (D-066), retenir un scénario (`definir_objectif`) ; pgTAP 11, 46, 49 ; releases 3dc77d4, bbf795a. Manque : décision tracée sur une anomalie carburant |
| 07 Workflows | DÉPLOYÉ | recommandation -> décision humaine motivée (CDC 11.5), écarts CBG et Neemba décidés par une personne (D-050, D-032) ; releases 3dc77d4, bbf795a |
| 08 Documents | MANQUANT | aucune fiche d'explication imprimable, aucune pièce |
| 09 Rapports | MANQUANT | aucun export dans `AnomaliesCarburantView`, `Dispatch/*`, `SimulationObjectifs`, `GlobalSearchModal` |
| 10 Historique | PARTIEL | (existant déployé) `decisions_dispatch` (recommandation, décision, auteur, heure) ; journal transverse MANQUANT |
| 11 Notifications | PARTIEL | (existant testé, non déployé) règle déterministe « écart d'inventaire carburant » au centre des décisions (D-068, pgTAP 51) ; aucune notification d'anomalie critique ni de recommandation en attente |
| 12 Paramétrage | PARTIEL | (existant testé, non déployé) seuil `alerte_ecart_carburant_l` par `valider_reglage` (D-068) ; seuil de surconsommation de `anomalies_carburant` saisi à chaque lecture, règles de recommandation fixes dans le code |

**Changements depuis la fiche (vérifiés)** :
- PR #102 : `GlobalSearchModal.tsx` (Échap, page figée, focus rendu, hauteur bornée) et `FenetreDecision.tsx` passent sur la coquille commune ; e2e `fenetres.spec.ts` ne couvre pas ces deux fenêtres ; non déployé.
- D-078 (PR #100) : `SimulationScenarios.tsx` rend « Aucun shift choisi » quand l'horizon shift n'a pas de shift actif ; non déployé.
- D-068 (PR #99) : règle `ecart_carburant` du catalogue d'alertes avec seuil réglable (migration `20261121150000_decisions_hse.sql:103`), résolution motivée ; non déployé.
- PR #98 : `AnomaliesCarburantView.tsx` affiche `ParcoursCarburant` (navigation), sans effet sur la détection.
- Reliquat `ai_analytics` toujours présent (`Settings/organisation.ts:27`, délégable).

**Écarts ordonnés**

| # | Écart | Taille | Dépendances | Suivi |
|---|---|---|---|---|
| 1 | Statut et décision tracée des anomalies carburant, seuil mémorisé | S | module 13 | partiellement traité par D-068 : alerte d'écart d'inventaire avec seuil réglé et résolution motivée (pgTAP 51), non déployé ; la surconsommation de `anomalies_carburant` reste sans décision ni seuil mémorisé |
| 2 | Explication d'indicateur (drawer commun) | S | modules 01, 21 | ouvert |
| 3 | Qualité des recommandations de dispatch (taux d'acceptation, motifs) | S | `decisions_dispatch` | ouvert |
| 4 | Journal transverse des recommandations | M | deuxième source de recommandation | ouvert |
| 5 | Prévisions, détection statistique, prévision de maintenance | L | déclencheur (fiche, point 14) | ouvert |
| 6 | Recherche en langage naturel, génération assistée de rapports | L | accord du propriétaire (intégration externe) | ouvert |
| 7 | Retrait du module de droit `ai_analytics` | S | décision du propriétaire | ouvert |

**Composants communs attendus** : DataTable (anomalies, journal des recommandations), DetailDrawer (explication d'indicateur, détail d'anomalie), ActionDialog (anomalie justifiée ou à traiter), HistoryDrawer (décisions de dispatch), ExportModal (décisions avec recommandation et motif). `ui/Fenetre.tsx` (PR #102) est une coquille de fenêtre commune, pas encore CreateModal/EditModal ; `FenetreDecision` l'utilise déjà.

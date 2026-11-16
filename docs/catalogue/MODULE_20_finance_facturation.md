# Module 20 : Finance et facturation

Fiche du catalogue maître (D-077), construite sur `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 sur `origin/docs/catalogue-maitre` (base `main`
8df078d). Production : réconciliation et factures D-029
(`20261111120000`), recouvrement D-031 (`20261111180000`), factures Neemba
D-032/D-033, paiements D-055 (`48d2cf0`), coûts D-058 (`f59a4b0`), budgets,
clauses et export comptable D-065 (`3bbfded`), correctifs D-072
(`16f149e`). Démonstration purgée (D-076) : aucune pièce financière réelle.
SIGTB n'exécute aucun paiement (D-055) : il trace la décision et le
paiement exécuté hors système.

## Synthèse des états (inventaire de la section 2)

| État | Nombre |
|---|---|
| MANQUANT | 1 |
| MAQUETTE | 0 |
| PARTIEL | 9 |
| DÉVELOPPÉ | 0 |
| TESTÉ | 0 |
| DÉPLOYÉ | 11 |
| UTILISABLE | 0 |
| VALIDÉ | 0 |

Défauts bloquants constatés : 2. (1) Menu « Budgets et comptabilité »
invisible pour tout rôle autre qu'administrateur : budgets, dettes,
imputations, export comptable et référentiels comptables inaccessibles au
comptable et au chargé de contrats. (2) Saisie non atomique d'une facture
Neemba : un échec sur les lignes bloque définitivement le numéro de facture.
Voir la dernière section.

## 1. Objectifs et périmètre

Fermer la chaîne d'argent du jalon J1 (facture CBG -> encaissement) et du
jalon J2 (factures Neemba, carburant et achats -> paiement), avec un
rapprochement à chaque étape, puis donner le pilotage de gestion : budgets,
engagements, dettes, créances, coûts directs, coût par tonne, rentabilité et
export comptable. Chaque montant porte sa devise et sa nature HT ou TTC ;
aucun montant n'est déduit ni estimé.

Décisions de référence : D-026 (phases), D-029 (réconciliation, facture
signée par le DG, numérotation sans trou, avoir), D-031 (encaissements,
relances, `v_creances`), D-032 et D-033 (contrôle des factures Neemba,
régularisations), D-034 (facture carburant CBG, module 13), D-053 (bons),
D-055 (bons à payer, exécution, contrôle a posteriori), D-058 (coûts,
rapports), D-065 (clauses facturées, budgets TTC, dettes, export
comptable), D-072 (reste à payer sous verrou, base de la facture notifiée).

## 2. Sous-modules (inventaire de la cible et état)

| # | Élément du catalogue | Cible précisée | État | Preuve |
|---|---|---|---|---|
| 1 | Facturation client CBG | Réconciliation mensuelle close -> facture par tarif, taxe saisie, brouillon -> à signer -> signée (director) -> émise ; FAC-AAAA-NNNN | DÉPLOYÉ | `ReconciliationView.tsx`, `FacturesView.tsx`, `generer_facture`, `avancer_facture` ; pgTAP 15 ; E2E `facturation` (3) ; facture au km : après le lot K (matrice) |
| 2 | Factures fournisseurs | Toute facture reçue (achats, services, CBG carburant, Neemba), rapprochée de sa source | PARTIEL | Neemba (D-032) et carburant CBG (D-034) seulement ; factures d'achat MANQUANT (module 16) |
| 3 | Factures Neemba | Saisie, contrôle par engin dans l'unité du tarif, notification, régularisations | DÉPLOYÉ | `FacturesNeembaView.tsx`, `controler_facture_fournisseur`, `notifier_ecart_fournisseur`, `enregistrer_regularisation` ; pgTAP 19, 21, 27 ; E2E `factures-neemba` (2) |
| 4 | Décomptes | Décompte de location paramétrable (franchise, arrondi, plafond, minimum, D-013/D-014) | PARTIEL | Moteur `src/domain/location/decompte.ts` (27 tests unitaires) branché à aucun écran ; contrôle Neemba sans ces paramètres (limite D-032) |
| 5 | Avoirs | Avoir client par le même circuit, plafonné au HT restant | DÉPLOYÉ | `creer_avoir` (`20261121120000`) ; pgTAP 15, 48 |
| 6 | Paiements | Bon à payer PAY plafonné au reste à payer, approbation séparée, exécution avec référence, annulation | DÉPLOYÉ | `PaiementsView.tsx`, `proposer_paiement`, `decider_paiement`, `enregistrer_execution_paiement`, `annuler_paiement` ; pgTAP 38, 54 ; E2E `paiements` |
| 7 | Encaissements | Au plus le reste dû, date entre émission et aujourd'hui | DÉPLOYÉ | `RecouvrementView.tsx`, `enregistrer_encaissement` ; pgTAP 18 ; E2E `suivi-recouvrement` |
| 8 | Créances | Créances par facture, retard, relances niveaux 1 à 3, lettre | DÉPLOYÉ | `v_creances`, `relancer` |
| 9 | Dettes | Reste à payer par fournisseur et pièce | PARTIEL | `v_dettes_fournisseurs` (D-065) ; onglet « Dettes » de `FinanceView` inaccessible hors administrateur (défaut 1) ; `v_reste_a_payer` visible dans Paiements |
| 10 | Retenues | Retenues contractuelles (clauses) ; retenue de garantie ou à la source sur paiement | PARTIEL | Clauses `retenue` (D-065) ; aucune retenue sur bon à payer |
| 11 | Pénalités | Clause appliquée -> ligne ou facture brouillon -> signature DG | DÉPLOYÉ | `decider_clause` (module 19) |
| 12 | Régularisations | Avoir, déduction, remboursement du loueur jusqu'au montant réclamé | DÉPLOYÉ | `enregistrer_regularisation` |
| 13 | Rapprochements | Tonnage (réconciliation), facture Neemba, facture carburant CBG, paiements contrôlés ; rapprochement bancaire | PARTIEL | Rapprochements métier DÉPLOYÉ ; rapprochement bancaire MANQUANT (aucune intégration, D-055) |
| 14 | Budgets | Budget TTC par nature, site, période, devise ; révision motivée ; annulation | PARTIEL | `definir_budget`, `annuler_budget`, `v_suivi_budgets` (déployés) ; écran inaccessible hors administrateur (défaut 1) |
| 15 | Engagements | Engagé = bons approuvés + pièces payables non payées ; réalisé = paiements et coûts | PARTIEL | `v_depenses_budgetaires`, `imputer_depense` (déployés) ; même défaut d'accès |
| 16 | Coûts directs | Dépense numérotée CST, devise obligatoire, site et engin du périmètre, annulation motivée | DÉPLOYÉ | `CostsView.tsx`, `enregistrer_cout`, `annuler_cout` ; pgTAP 41 ; E2E `rapports` |
| 17 | Coût par tonne | Coûts directs / tonnes livrées par période et site | DÉPLOYÉ | `indicateurs_exploitation` (D-058), `tco-analysis` ; hors location Neemba et carburant valorisé (base à confirmer) |
| 18 | Rentabilité | Produit facturé CBG moins coûts (location, carburant, pneus, achats, coûts directs), même devise, par site et mois | MANQUANT | Non calculée (D-058 : factures non ventilées par site, devises différentes) |
| 19 | Export comptable | Écritures de gestion par période, plan comptable, comptes de tiers | PARTIEL | `ecritures_gestion` (CSV), `plan_comptable`, `comptes_tiers` ; pas de partie double ; écran inaccessible hors administrateur |
| 20 | États financiers de gestion | Créances et dettes âgées, suivi budgétaire, coûts par nature, marge | PARTIEL | Créances (DÉPLOYÉ), suivi budgétaire (accès admin), pas de balance âgée des dettes ni de marge |
| 21 | Contrôle a posteriori des paiements | Par une autre personne que le proposant et l'exécutant | DÉPLOYÉ | `controler_paiement`, `v_paiements_a_controler` |

## 3. Menus et sous-menus

Groupe « Contrats & Finance ». Correspondance de droits
(`src/contexts/AuthContext.tsx:159-221`) :

| Entrée | id | Droit | Visible par |
|---|---|---|---|
| Réconciliation mensuelle | `reconciliation` | `invoices` | admin, director, accountant, contract_manager (E) ; logistician (L) |
| Facturation | `invoices` | `invoices` | idem |
| Recouvrement | `recouvrement` | `invoices` | idem |
| Contrôle factures Neemba | `factures-neemba` | `contracts` | admin, director, accountant, contract_manager |
| Paiements fournisseurs | `paiements` | `invoices` | admin, director, accountant, contract_manager, logistician |
| Budgets et comptabilité | `budgets` | **absent de la table** | administrateur seulement (défaut 1) |
| Coûts | `costs` | `costs` | admin, director, accountant, contract_manager (E) ; logistician (L) |

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Réconciliation mensuelle | Ouverture, lignes à examiner, décision motivée, rectification de ticket, clôture, génération de facture, export | DÉPLOYÉ | `ReconciliationView.tsx` |
| Facturation | Liste, circuit, signature DG, avoir, impression | DÉPLOYÉ | `FacturesView.tsx`, `FactureImprimable.tsx` |
| Recouvrement | Créances, encaissement, relance, lettre | DÉPLOYÉ | `RecouvrementView.tsx` |
| Contrôle factures Neemba | Saisie en-tête et lignes, contrôle, notification, lettre, régularisations | DÉPLOYÉ | `FacturesNeembaView.tsx` |
| Paiements fournisseurs | Pièces payables, bons à payer, décision, exécution, contrôle | DÉPLOYÉ | `PaiementsView.tsx` |
| Budgets et comptabilité (onglets budgets, imputer, dettes, export, référentiels) | Budgets, imputations, dettes, export CSV, natures, plan comptable, comptes de tiers | PARTIEL (accès) | `FinanceView.tsx` ; E2E `contrats-finance` (administrateur) |
| Coûts | Dépenses, répartition, export, annulation | DÉPLOYÉ | `CostsView.tsx` |
| Factures d'achat | Saisie et rapprochement | MANQUANT | module 16 |
| Rentabilité par site et mois | Marge | MANQUANT | - |
| Référentiel des catégories de coût | `cost_categories` | MANQUANT | lu par `CostsView.tsx:53` et `FinanceView.tsx:69`, aucun écran d'écriture |

## 5. Widgets et tableaux de bord

| Indicateur | Source | État |
|---|---|---|
| Créances ouvertes, en retard, par devise | `v_creances` | DÉPLOYÉ |
| Indicateurs du chargé de contrats (dont écarts Neemba détectés et recouvrés) | `indicateurs_charge_contrats` | DÉPLOYÉ (module 19) |
| Budget, engagé, réalisé, dépassement signalé | `v_suivi_budgets` | PARTIEL (accès) |
| Répartition des coûts par catégorie et devise | `CostsView` | DÉPLOYÉ |
| Indicateurs finance du centre de pilotage | `indicateurs_pilotage` (D-057) | DÉPLOYÉ (module 01) |
| Marge par site et mois, DSO, DPO | - | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver/restaurer | Supprimer (brouillon) | Annuler/corriger |
|---|---|---|---|---|---|---|---|
| Réconciliation | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (décisions, actualisation) | sans objet | sans objet | sans objet | clôture irréversible |
| Facture client | DÉPLOYÉ (depuis réconciliation ou clause) | DÉPLOYÉ | brouillon seulement | sans objet | sans objet | sans objet | DÉPLOYÉ (annulation avant émission, avoir après) |
| Facture Neemba | DÉPLOYÉ (insert direct, colonnes accordées) | DÉPLOYÉ | MANQUANT à l'écran (UPDATE accordé, aucun formulaire d'édition) | sans objet | sans objet | interdit (DELETE retiré, D-072 R1-10) | DÉPLOYÉ (régularisations) |
| Bon à payer | DÉPLOYÉ | DÉPLOYÉ | interdit | sans objet | sans objet | sans objet | DÉPLOYÉ (annulation avant exécution, rejet) |
| Encaissement | DÉPLOYÉ | DÉPLOYÉ | interdit | sans objet | sans objet | sans objet | MANQUANT (aucune annulation d'un encaissement saisi à tort) |
| Budget | PARTIEL (accès) | PARTIEL | révision motivée | sans objet | sans objet | sans objet | annulation motivée |
| Coût | DÉPLOYÉ | DÉPLOYÉ | interdit | MANQUANT | sans objet | sans objet | DÉPLOYÉ (`annuler_cout`) |
| Nature, compte comptable, compte de tiers | PARTIEL (accès admin) | idem | idem | sans objet | désactivation | sans objet | sans objet |

## 7. Modals et drawers

Ouverture de réconciliation, rectification de ticket, encaissement,
relance, régularisation, bon à payer, exécution, budget : DÉPLOYÉ (panneaux
et modales). Motifs par `window.prompt` : PARTIEL au regard d'ActionDialog.
Aperçu de facture non valable avant émission : DÉPLOYÉ. Pièces jointes
(facture reçue, preuve de paiement, relevé bancaire) : MANQUANT.

## 8. Champs des formulaires

| Formulaire | Champs | Obligatoires | Règles |
|---|---|---|---|
| Ouverture de réconciliation | contrat client, mois, base (acceptée, reçue, chargée), tolérance, sites | contrat, base, tolérance | aucune valeur par défaut (D-029) |
| Génération de facture | taux de taxe (%) | oui | 0 si exonéré ; montants HT, taxe, TTC calculés serveur dans la devise du contrat |
| Avoir | montant HT, motif | oui | au plus HT de la facture moins avoirs non annulés |
| Encaissement | date, montant (devise de la facture, imputé sur le TTC), mode, référence, note | date, montant, mode | au plus le reste dû |
| Facture Neemba (en-tête) | contrat de location, numéro fournisseur, date, période, montant HT | tous | (contrat, numéro) unique ; devise = devise du contrat ; TTC non saisi à l'écran |
| Facture Neemba (ligne) | engin ou libellé, catégorie, quantité, unité, taux, montant | engin ou libellé, montant | unité parmi celles du tarif |
| Régularisation | date, montant, mode (avoir, déduction, remboursement), référence | date, montant, mode | jusqu'au montant réclamé |
| Bon à payer | pièce (facture loueur ou bon de commande), montant, objet | tous | au plus le reste à payer (TTC, ou HT si le TTC du loueur n'est pas saisi ; bons en GNF) |
| Exécution | date (non future, après approbation), mode, montant, référence | référence pour virement et chèque | au plus l'approuvé |
| Budget | période, nature, site, devise, montant TTC, note, motif de révision | période, nature, devise, montant | pas de chevauchement ; site requis pour un profil borné |
| Coût | date (non future), description, montant (> 0), devise, catégorie, site, engin, référence, mode, notes | date, description, montant, devise | HT ou TTC non précisé (dérogation D-065) |

## 9. Actions individuelles et en masse

| Action | Droit | État |
|---|---|---|
| Soumettre, signer (director seul, jamais le préparateur), émettre, annuler une facture | `invoices` / rôle | DÉPLOYÉ |
| Créer un avoir | `invoices` | DÉPLOYÉ |
| Encaisser, relancer, imprimer la lettre | `invoices` | DÉPLOYÉ |
| Contrôler, notifier une facture Neemba, régulariser | `contracts` | DÉPLOYÉ |
| Proposer, approuver (autre personne), exécuter, annuler, contrôler un paiement | `invoices` / approbation | DÉPLOYÉ |
| Définir, réviser, annuler un budget ; imputer une dépense | `costs` | PARTIEL (accès) |
| Exporter les écritures de gestion (CSV) | `invoices` ou `costs` | PARTIEL (accès) |
| Approuver des paiements en masse, relancer en masse | approbation | MANQUANT |

## 10. Statuts et transitions

```
Facture client : brouillon -> a_signer (preparateur) -> signee (director, autre que le preparateur)
                 -> emise (numero FAC/AV sans trou, echeance = emission + delai) ; brouillon|a_signer -> annulee (motif)
Facture Neemba : saisie -> controlee -> notifiee | conforme -> regularisee
Facture carburant CBG : saisie -> conforme | a_examiner (module 13)
Paiement : propose -> approuve | rejete (motif) -> execute -> [controle conforme | anomalie]
           propose|approuve -> annule (motif, avant execution)
Budget : actif -> annule (motif) ; revision = nouveau budget qui remplace
Cout : enregistre -> annule (motif)
```

## 11. Workflows

J1 : réconciliation du mois (chargé de contrats) -> facture brouillon ->
soumission -> signature du DG -> émission -> encaissement (comptable) ->
relances après échéance. J2 : facture Neemba saisie -> contrôle -> notification
des écarts -> régularisations ; bon à payer -> approbation par une autre
personne (`paiements_validation_separee`) -> exécution hors système ->
contrôle a posteriori par une troisième personne. Le cumul de rôles du
chargé de contrats est signalé « contrôle non indépendant » (D-026).

## 12. Rôles et permissions

| Action | Module | Niveau | Périmètre |
|---|---|---|---|
| Lire factures, encaissements, relances, paiements | `invoices` (ou `contracts`) | lecture | contrat (organisation), sans site |
| Préparer, soumettre, émettre, encaisser, relancer | `invoices` | écriture | idem |
| Signer une facture | rôle `director` | - | idem (MFA aal2 si `mfa_exige`, D-040) |
| Approuver un paiement | `has_module_approve('invoices')` | approbation | idem |
| Factures Neemba | `contracts` | écriture | idem |
| Budgets, imputations | `costs` | écriture | site du budget |
| Coûts | `costs` | écriture | site et engin du périmètre |
| Référentiels comptables | administrateur | - | global |

Limite consignée (D-075) : `invoice_items`, `reconciliation_lignes`,
`factures_fournisseur_lignes` lues par module sans borne de site.

## 13. Tables et relations

`reconciliations`, `reconciliation_lignes` ; `factures`, `facture_lignes`
(+ `calcul_clause_id`) ; `encaissements`, `relances`, `v_creances` ;
`factures_fournisseur`, `factures_fournisseur_lignes`,
`regularisations_fournisseur` ; `paiements_fournisseur`, `v_reste_a_payer`,
`v_paiements_a_controler` ; `natures_depense`, `imputations_budgetaires`,
`budgets` (TTC, numeric(18,2)), `v_depenses_budgetaires`,
`v_suivi_budgets`, `v_dettes_fournisseurs` ; `plan_comptable`,
`comptes_tiers` ; `costs` (+ numéro, devise, site, statut),
`cost_categories`. Tables héritées hors circuit : `invoices`,
`invoice_items`, `payments` (à retirer, matrice).

## 14. Fonctions serveur et API

`ouvrir_reconciliation`, `cloturer_reconciliation`, `generer_facture`,
`avancer_facture` (`20261111120000`) ; `decider_ligne_reconciliation`,
`actualiser_reconciliation`, `rectifier_ticket_pesee_cbg`
(`20261113100000`) ; `enregistrer_encaissement`, `relancer`
(`20261111180000`) ; `notifier_ecart_fournisseur`,
`enregistrer_regularisation` (`20261111200000`) ;
`controler_facture_fournisseur` (`20261115150000`) ; `proposer_paiement`,
`decider_paiement`, `enregistrer_execution_paiement` (`20261120102000`) ;
`annuler_paiement`, `controler_paiement` (`20261117150000`) ;
`enregistrer_cout`, `annuler_cout` (`20261118090000`) ; `creer_avoir`,
`definir_budget`, `annuler_budget`, `imputer_depense`,
`definir_nature_depense`, `definir_compte_comptable`,
`associer_categorie_cout`, `definir_compte_tiers`, `ecritures_gestion`
(`20261121120000`). Paramètres de tous les appels vérifiés : conformes.

## 15. Notifications

Facture à signer, paiement à approuver, paiement à contrôler, budget
dépassé : « Mes validations » (D-056, D-065), DÉPLOYÉ. Échéance de créance
atteinte, relance due, dette échue : MANQUANT (calculés, non notifiés).

## 16. Documents et modèles d'impression

Facture et avoir imprimables (`FactureImprimable.tsx`) : DÉPLOYÉ. Lettre de
relance (niveaux 1 à 3) : DÉPLOYÉ. Lettre de notification d'écart Neemba :
DÉPLOYÉ (E2E `factures-neemba`). Bon à payer imprimable, état de
rapprochement : MANQUANT.

## 17. Exports et rapports

CSV : réconciliation, coûts, écritures de gestion (DÉPLOYÉ, export
comptable sous réserve d'accès). Balance âgée des créances et des dettes,
rentabilité, export comptable en partie double : MANQUANT.

## 18. Historique et audit

Chaque action de facture, paiement, réconciliation horodatée avec auteur et
motif (D-029, D-055) : DÉPLOYÉ. Budgets : révision qui remplace, annulation
motivée : DÉPLOYÉ. Plan comptable et comptes de tiers modifiés en place sans
historique (limite D-065).

## 19. Tests

Existants : pgTAP 05, 15, 18, 19, 21, 27, 38, 41, 48, 54 ; unitaires
`Facturation/facturation.test.ts`, `Finance/finance.test.ts`,
`src/domain/location/decompte.test.ts` (27) ; E2E `facturation.spec.ts`
(3), `factures-neemba.spec.ts` (2), `paiements.spec.ts`,
`suivi-recouvrement.spec.ts` (4), `contrats-finance.spec.ts` (budget et
export en administrateur), `rapports.spec.ts` (coûts). Manquants : E2E
« Budgets et comptabilité » avec un profil comptable ; parcours J1 complet
(réconciliation -> facture signée -> encaissement) contre une vraie base.

## 20. Critères de recette métier

Scénario J1 : une période réelle facturée à CBG, chaque ligne de facture
remontant à ses voyages, relevés et tickets ; facture signée par le DG,
émise, encaissée. Scénario J2 : une facture Neemba contrôlée, écarts
notifiés et régularisés, bon à payer approuvé par une autre personne,
exécution saisie depuis le relevé, contrôle a posteriori. PV signé : aucun.

## Points à trancher par le propriétaire

1. Dérogations D-065 : budget saisi avec le droit `costs` sans approbation ;
   pénalités du loueur facturées et non déduites ; bons en GNF par
   convention ; coûts saisis sans précision HT / TTC (risque de double
   compte avec un paiement D-055) ; export sans partie double.
2. Séparation proposant / approbateur / exécutant / contrôleur des paiements
   (D-055, à confirmer, D-072).
3. HT ou TTC de la facture notifiée Neemba et saisie du TTC du loueur.
4. Base du coût par tonne (tonnes acceptées ou livrées, D-058) et inclusion
   de la location et du carburant valorisé.
5. Ventilation des factures CBG par site pour calculer la rentabilité.

## Défauts bloquants constatés

1. `src/contexts/AuthContext.tsx:159-221` : la table `modulePermissionMap`
   ne contient pas l'entrée `budgets`. `canAccessModule('budgets')` renvoie
   `false` (l.223-224) pour tout rôle autre qu'administrateur et le menu
   « Budgets et comptabilité » est masqué (`Sidebar.tsx:49`). Le comptable
   et le chargé de contrats ne peuvent ni saisir les budgets, ni imputer les
   dépenses, ni consulter les dettes, ni produire l'export comptable, alors
   que le serveur les y autorise (`definir_budget` : écriture `costs`).
   Les E2E tournent en administrateur (`e2e/api-simulee.ts:53`). Correctif :
   ajouter `'budgets': 'costs'` (ou le droit retenu par le propriétaire).

2. `src/components/Contrats/FacturesNeembaView.tsx:106-117` (bloquant en
   cas d'échec partiel) : l'en-tête puis les lignes d'une facture Neemba sont
   insérés en deux appels non atomiques. Si l'insertion des lignes échoue
   (réseau, contrainte), l'en-tête reste sans ligne : l'écran n'offre aucune
   saisie de ligne sur une facture existante (aucun `update` ni `insert`
   ultérieur dans le fichier), la suppression est retirée (`REVOKE DELETE`,
   `20261120100000` l.410-415), `controler_facture_fournisseur` refuse une
   facture sans ligne, et le couple (contrat, numéro fournisseur) étant
   unique (`20261111200000` l.53), la facture ne peut plus être ressaisie.
   Correctif : une fonction serveur qui écrit en-tête et lignes dans la même
   transaction.

Écritures vérifiées sans défaut de colonne : `factures_fournisseur` et
`factures_fournisseur_lignes` : colonnes accordées (`20261111200000`
l.105-110, `20261112100000` l.49-51) ; contrat, numéro, date, période et HT
exigés avant envoi (l.102), jamais `''`. Les autres écrans n'écrivent que
par fonctions serveur, paramètres conformes ;
sélecteurs vides désactivent l'envoi (`ReconciliationView.tsx:177`,
`CostsView.tsx:133`, `PaiementsView.tsx:99, 112`, budget l.100).

## Écarts et lots proposés

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Ajouter `budgets` à `modulePermissionMap` ; E2E avec profil comptable | S | - |
| 2 | Écran du référentiel des catégories de coût (administrateur) | S | - |
| 3 | Saisie atomique d'une facture Neemba (fonction serveur en-tête + lignes, défaut 2) ; édition avant contrôle ; saisie du TTC | S | point 3 |
| 4 | Annulation motivée d'un encaissement saisi à tort | S | - |
| 5 | Factures d'achat et rapprochement bon / réception / facture avant paiement | L | module 16 |
| 6 | Rentabilité par site et mois (même devise), balance âgée créances et dettes | M | point 5 |
| 7 | Brancher le moteur de décompte (D-013/D-014) au contrôle Neemba quand les paramètres sont saisis | M | paramètres du dossier |
| 8 | Retenues sur paiement (garantie, à la source) | M | décision propriétaire |
| 9 | Pièces jointes (factures reçues, preuves de paiement) | M | lot D |
| 10 | Notifications d'échéance (créances, dettes), relances en masse | M | notifications, BulkActionBar |
| 11 | Export comptable en partie double, historisation du plan comptable | M | point 1 |
| 12 | Retrait des tables héritées `invoices`, `invoice_items`, `payments` (schéma d'archive, D-071) | S | sauvegarde |

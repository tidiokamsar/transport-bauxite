# Module 16 : Achats et approvisionnements

Fiche du catalogue maître (D-077), construite sur `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 sur `origin/docs/catalogue-maitre` (base `main`
8df078d). Production : D-053 déployée (`7f11af4`, migration
`20261117090000`), correctifs D-072 déployés (`16f149e`). Les lignes de pneus
et les lots à la réception (D-067, migration `20261121130000`) sont fusionnés
sur `main` (PR #92, `9ad7116`) sans déploiement consigné dans
`docs/SIGTB_2.0_HEBERGEMENT_VPS.md` au 2026-11-16 : état TESTÉ. Démonstration
purgée (D-076).

## Synthèse des états (inventaire de la section 2)

| État | Nombre |
|---|---|
| MANQUANT | 6 |
| MAQUETTE | 0 |
| PARTIEL | 4 |
| DÉVELOPPÉ | 0 |
| TESTÉ | 1 |
| DÉPLOYÉ | 7 |
| UTILISABLE | 0 |
| VALIDÉ | 0 |

Défauts bloquants constatés : aucun (voir la dernière section).

## 1. Objectifs et périmètre

Chaîne « besoin -> commande -> réception -> facture -> paiement » pour les
pièces, pneus, consommables et services achetés par KOGON MINING. Le
carburant CBG (module 13) et la location Neemba (module 10) suivent leurs
propres circuits ; ils n'entrent dans les achats que pour le paiement
(module 20). Chaque franc payé doit remonter à un bon approuvé, une
réception et une facture contrôlée (bloc 1, finalité).

Décisions de référence : D-042 (numéro BC serveur), D-053 (circuit achat),
D-055 (paiement d'un bon reçu ou soldé), D-059 (consultations), D-065
(budgets, engagement budgétaire des bons, bons en GNF par convention), D-067
(lignes de pneus, lots et séries à la réception, annulation encadrée), D-072
(approbateur distinct de tout auteur, taxe au prorata d'un bon soldé, bon
payé protégé, offre TTC).

Entrées : fournisseurs (module 15), articles et dépôts (module 17), modèles
de pneus (module 12), budgets (module 20). Sorties : entrées en stock
(module 17), pneus (module 12), engagements budgétaires et reste à payer
(module 20).

## 2. Sous-modules (inventaire de la cible et état)

| # | Élément du catalogue | Cible précisée | État | Preuve |
|---|---|---|---|---|
| 1 | Demande d'achat | DA numérotée par le demandeur (besoin, article, quantité, motif, ordre de travail ou engin), distincte du bon | MANQUANT | Le brouillon de bon tient lieu de demande (`enregistrer_bon_commande`) |
| 2 | Vérification du stock | Stock libre du dépôt affiché à la saisie de la DA ou du bon | MANQUANT | `PurchasesView.tsx` n'affiche pas `v_stock_disponibilite` |
| 3 | Validation hiérarchique | Niveaux d'approbation selon le montant et la nature, délégation | PARTIEL | Un niveau : `decider_bon_commande` (`has_module_approve('purchases')`, approbateur distinct de tout auteur, D-072) ; pas de seuils ni de délégation |
| 4 | Consultation | Demande de cotation à plusieurs fournisseurs | DÉPLOYÉ | Module 15, D-059 |
| 5 | Analyse des offres | Comparaison prix et délais | DÉPLOYÉ | `ConsultationsFournisseurs.tsx` |
| 6 | Sélection fournisseur | Motivée, bon préparé | DÉPLOYÉ | `selectionner_offre`, `preparer_bon_commande_consultation` |
| 7 | Contrôle budgétaire | Disponible budgétaire affiché et contrôlé à l'approbation du bon | PARTIEL | Bons approuvés comptés en engagé dans `v_depenses_budgetaires` (D-065) ; dépassement signalé dans « Budgets », jamais à l'approbation du bon |
| 8 | Bon de commande | Brouillon, lignes article / désignation / pneu, taxes, totaux serveur, numéro BC | DÉPLOYÉ | `enregistrer_bon_commande`, `soumettre_bon_commande` ; pgTAP 36 ; E2E `achats` |
| 9 | Réception partielle ou totale | Numéro REC, bon de livraison, quantités reçues et refusées, entrée en stock au prix commandé | DÉPLOYÉ | `receptionner_bon_commande`, `annuler_reception` ; pgTAP 36, 54 ; E2E `achats` |
| 10 | Réception des pneus et des lots / séries | Numéro par pneu, lots exigés pour un article suivi | TESTÉ | `20261121130000` ; pgTAP 50 ; E2E `stocks-avances` (bon avec pneus) ; fusionné, déploiement non consigné |
| 11 | Contrôle qualité | Contrôle à réception (conforme, réserve, refus), PV | PARTIEL | Refus motivé par ligne seulement |
| 12 | Facture fournisseur | Facture d'achat saisie, rapprochée du bon et de la réception (rapprochement à trois voies), base du paiement | MANQUANT | D-053 « hors périmètre » ; D-055 paie directement un bon reçu ou soldé |
| 13 | Avoir | Avoir fournisseur imputé sur la facture d'achat | MANQUANT | idem |
| 14 | Annulation motivée | Avant toute réception ; solde du reliquat | DÉPLOYÉ | `annuler_bon_commande`, `solder_bon_commande` |
| 15 | Suivi des délais | Date prévue, retard calculé, liste des bons en retard | PARTIEL | `expected_delivery_date` saisie ; aucun calcul ni liste de retard |
| 16 | Relances | Relance fournisseur datée et tracée (niveaux) | MANQUANT | - |
| 17 | Rapports d'achats | Achats par fournisseur, article, site, période ; délais ; export | MANQUANT | Aucun export dans `Purchases/*` |
| 18 | Journal du circuit | Toutes les décisions horodatées et motivées | DÉPLOYÉ | `achats_journal` append-only |

## 3. Menus et sous-menus

« Stocks & Achats > Achats » (`purchases`), droit `purchases`
(`AuthContext.tsx:189`). Voient : admin, director, logistician,
accountant, contract_manager (écriture) ; approbation : admin, director,
accountant. La réception exige en plus l'écriture `stock` (D-053), que
`contract_manager` et `accountant` n'ont pas (matrice : `stock` L) : seuls
admin, director et logistician réceptionnent.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Achats : liste des bons | Filtre par statut, détail | PARTIEL | `PurchasesView.tsx:86, 258` ; ni recherche, ni tri, ni export |
| Achats : brouillon (création, modification) | En-tête, lignes, taxes, total | DÉPLOYÉ | `PurchasesView.tsx:103-120, 196` |
| Achats : décision, annulation, solde | Boutons selon statut et droits | DÉPLOYÉ | `PurchasesView.tsx:125-127, 210-214` |
| Achats : réception | Quantités, refus motivés, lots, numéros de pneus | DÉPLOYÉ (pneus et lots : TESTÉ) | `PurchasesView.tsx:136-153, 242` |
| Demandes d'achat | Liste et fiche | MANQUANT | - |
| Factures d'achat et avoirs | Liste, fiche, rapprochement | MANQUANT | - |
| Tableau de bord achats | Bons en attente, en retard, montants engagés | MANQUANT | - |

## 5. Widgets et tableaux de bord

Aucun indicateur dans le module (MANQUANT) : bons à approuver, à
réceptionner, en retard, montant engagé par devise et par nature. Les bons à
décider apparaissent dans « Mes validations » (D-056, DÉPLOYÉ, module 24).
Les montants engagés sont visibles dans « Budgets et comptabilité »
(module 20), menu réservé de fait à l'administrateur (défaut décrit au
module 20).

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver/restaurer | Supprimer (brouillon) | Annuler/corriger |
|---|---|---|---|---|---|---|---|
| Bon de commande | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (brouillon seul) | MANQUANT | sans objet | interdit (annulation à la place) | DÉPLOYÉ (annuler, solder, rejeter) |
| Ligne de bon | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (brouillon) | sans objet | sans objet | DÉPLOYÉ (brouillon, réécriture des lignes) | sans objet |
| Réception | DÉPLOYÉ | DÉPLOYÉ | interdit | sans objet | sans objet | interdit | DÉPLOYÉ (`annuler_reception`, refus si le bon est payé ou si un pneu a bougé) |
| Demande d'achat | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT |
| Facture d'achat, avoir | MANQUANT | MANQUANT | MANQUANT | sans objet | sans objet | MANQUANT | MANQUANT |

## 7. Modals et drawers

Brouillon, réception, motif d'annulation, de rejet, de solde : DÉPLOYÉ
(panneaux et `window.prompt`). Avertissement avant enregistrement d'une
réception avec pneus (annulation encadrée, D-067) : TESTÉ. Pièces jointes
(devis, bon de livraison, facture) : MANQUANT. Duplication d'un bon :
MANQUANT. Historique du bon : journal affiché dans le détail (DÉPLOYÉ,
`PurchasesView.tsx:75`).

## 8. Champs des formulaires

| Formulaire | Champ | Obligatoire | Règles |
|---|---|---|---|
| Bon (en-tête) | Fournisseur | oui | actif (garde `garde_fournisseur_actif`) ; bouton désactivé si vide (`PurchasesView.tsx:196`) |
| | Dépôt de livraison | oui | dans le périmètre du site (serveur) |
| | Livraison prévue | non | date |
| | Taxes (montant GNF) | non (0) | entier ; cible : taux et nature de taxe |
| | Note | non | |
| Bon (ligne) | Article, ou désignation libre, ou modèle de pneu (marque, modèle, dimension) | oui (l'un des trois) | `lignesPourServeur` (`achats.ts:36`) |
| | Quantité | oui | entier > 0 |
| | Prix unitaire (GNF) | oui | entier >= 0 ; HT par convention à confirmer |
| Réception | Quantité reçue, refusée, motif de refus, lots, numéros de pneus, bon de livraison | reçue ou refusée > 0 ; motif si refus ; lots si article suivi ; un numéro par pneu | jamais au-delà du reste à recevoir (client et serveur) |

Champs cibles manquants : devise du bon (GNF par convention, D-055),
centre de coût ou nature de dépense, ordre de travail ou engin destinataire,
conditions de paiement.

## 9. Actions individuelles et en masse

| Action | Droit | État |
|---|---|---|
| Enregistrer, modifier un brouillon, soumettre | écriture `purchases` | DÉPLOYÉ |
| Approuver, rejeter (motif) | approbation `purchases`, autre personne que tout auteur | DÉPLOYÉ |
| Annuler (avant réception), solder (motif) | écriture `purchases` | DÉPLOYÉ |
| Réceptionner, annuler une réception | écriture `stock` (+ `vehicles` ou `maintenance` pour les pneus) | DÉPLOYÉ / TESTÉ |
| Approuver en masse | approbation | MANQUANT |
| Relancer un fournisseur | écriture | MANQUANT |
| Dupliquer un bon | écriture | MANQUANT |
| Imprimer le bon de commande | lecture | MANQUANT |

## 10. Statuts et transitions

```
draft -> submitted          (soumettre_bon_commande, ecriture purchases, fournisseur actif)
submitted -> approved       (decider_bon_commande, approbation purchases, approbateur distinct)
submitted -> rejected       (idem, motif)
draft|submitted|approved -> cancelled (annuler_bon_commande, motif, aucune reception)
approved -> partially_received | received (receptionner_bon_commande, ecriture stock)
partially_received -> received | closed (solder_bon_commande, motif)
received|partially_received -> statut precedent (annuler_reception, motif, bon non paye)
```

## 11. Workflows

Brouillon (demandeur) -> soumission -> approbation par une autre personne
(réglage `achats_validation_separee`, exigé si absent) -> réception au dépôt
(magasinier) -> bon à payer (module 20, D-055) -> paiement exécuté hors
système -> contrôle a posteriori. Cible : DA -> validation du responsable ->
consultation -> bon -> réception avec contrôle qualité -> facture d'achat
rapprochée -> bon à payer. Délais et relances : MANQUANT.

## 12. Rôles et permissions

| Action | Module | Niveau | Périmètre |
|---|---|---|---|
| Lire les bons | `purchases` ou `stock` | lecture | site du dépôt du bon (D-053) |
| Créer, soumettre, annuler, solder | `purchases` | écriture | dépôt du périmètre |
| Approuver, rejeter | `purchases` | approbation (rôle, réduit par D-036) | idem |
| Réceptionner | `stock` (+ `vehicles`/`maintenance` pour pneus) | écriture | dépôt du périmètre |

## 13. Tables et relations

`purchase_orders` (numéro BC serveur, statut, soumission, décision, solde,
`warehouse_id`, `tax_amount`, `total_amount`) ; `purchase_order_items`
(article, désignation, quantité, prix, reçu, pneu marque / modèle /
dimension) ; `deliveries` (numéro REC, bon de livraison, annulation) et
leurs lignes ; `receptions_achat_pneus` ; `achats_journal` (append-only).
RLS : lecture `purchases` ou `stock` et site du dépôt ; aucune écriture
directe ; DELETE retiré (D-042).

## 14. Fonctions serveur et API

`enregistrer_bon_commande`, `receptionner_bon_commande`, `annuler_reception`
(`20261121130000`) ; `soumettre_bon_commande`, `annuler_bon_commande`,
`solder_bon_commande` (`20261117090000`) ; `decider_bon_commande`
(`20261120101000`). Paramètres et clés JSON des lignes (`article`,
`designation`, `quantite`, `prix_unitaire`, `pneu`, `ligne`, `recue`,
`refusee`, `motif_refus`, `lots`, `pneus`) vérifiés contre le corps des
fonctions : conformes.

## 15. Notifications

Bon à approuver : « Mes validations » (DÉPLOYÉ). Bon approuvé à
réceptionner, bon en retard, rejet notifié au demandeur : MANQUANT.

## 16. Documents et modèles d'impression

Bon de commande imprimable (en-tête société, conditions, signature
approbateur), bon de réception : MANQUANT.

## 17. Exports et rapports

Aucun (MANQUANT) : liste des bons, achats par fournisseur, article, site et
période, délais de livraison.

## 18. Historique et audit

`achats_journal` (création, modification, soumission, décision, annulation,
solde, réception, annulation de réception) avec auteur, date, motif :
DÉPLOYÉ. Comparaison des versions d'un brouillon : MANQUANT.

## 19. Tests

Existants : pgTAP 36 (circuit achat), 50 (pneus et lots à la réception),
53 à 56 (correctifs) ; unitaire `src/components/Purchases/achats.test.ts` ;
E2E `achats.spec.ts` (brouillon, réception partielle), `stocks-avances.spec.ts`
(bon avec pneus). Manquants : E2E approbation par une seconde personne
(profils différents) ; parcours achat -> paiement de bout en bout contre une
vraie base.

## 20. Critères de recette métier

Le logisticien crée un bon réel ; le directeur l'approuve ; le magasinier
réceptionne en deux fois avec un refus motivé ; le stock du dépôt augmente
des quantités reçues au prix commandé ; le comptable propose le paiement
plafonné au reste à payer ; le paiement exécuté est contrôlé par une
troisième personne. PV signé : aucun.

## Points à trancher par le propriétaire

1. Devise des bons : GNF par convention (D-055, D-065) ; besoin d'achats en
   devises (USD, EUR) ?
2. Prix des lignes : HT, taxes saisies en montant global ; besoin d'un taux
   par ligne ?
3. Facture d'achat obligatoire avant paiement d'un bon (rapprochement à trois
   voies) au lieu du paiement sur bon reçu (D-055).
4. Seuils d'approbation par montant et délégations.
5. Annulation d'une réception de pneus (dérogation à D-052 retenue par
   D-067, à confirmer).

## Défauts bloquants constatés

Aucun. L'écran n'écrit que par fonctions serveur ; fournisseur et dépôt
exigés avant envoi (`PurchasesView.tsx:196`), jamais `''` ; réception
désactivée tant que lots ou numéros de pneus sont incomplets (l.242).

## Écarts et lots proposés

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Facture d'achat et avoir fournisseur, rapprochement bon / réception / facture, paiement sur facture | L | point 3 ; module 20 |
| 2 | Contrôle budgétaire à l'approbation (disponible affiché, dépassement signalé ou bloquant selon décision) | M | module 20, budgets saisis |
| 3 | Liste des bons : recherche, tri, export CSV ; rapports d'achats | S | DataTable, ExportModal |
| 4 | Suivi des délais et relances fournisseur | M | notifications |
| 5 | Demande d'achat avec vérification du stock libre | M | module 17 |
| 6 | Seuils d'approbation et délégations | M | point 4 ; module 24 |
| 7 | Bon de commande imprimable, pièces jointes (devis, BL, facture) | M | lot D |
| 8 | Contrôle qualité à réception (réserve, PV) | S | - |
| 9 | Duplication d'un bon, approbation en masse | S | BulkActionBar |
| 10 | Déploiement de D-067 (réception de pneus et lots) avec contrôles D-069 | S | sauvegarde, pgTAP serveur |

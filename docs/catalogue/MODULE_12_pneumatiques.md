# Module 12 : Pneumatiques

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : dernière release consignée 3bbfded,
démonstration purgée (D-076), aucune saisie réelle. Le cycle de vie D-052
est DÉPLOYÉ (165d2ea) ; les apports D-067 (réception de pneus par bon de
commande, performance par marque, annulation de réception) sont fusionnés
sur `main` (PR #92, migration `20261121130000_stocks_avances.sql`, test 50)
sans déploiement consigné au journal : TESTÉ. Aucun élément UTILISABLE ni
VALIDÉ ; guide : `docs/guides/guide-flotte-maintenance.md`, section 4.

## 1. Objectifs et périmètre

Suivre chaque pneu individuellement, de l'achat à la réforme, parce que les
pneus sont à la charge de Kogon sur des engins loués à Neemba (D-022) :
c'est un coût direct par engin et par tonne, et une cause d'immobilisation
(cause « pneumatique », imputée à l'exploitant, D-025). Le registre `tires`
est un cache recalculé depuis le journal append-only `pneus_operations`
(D-052) ; une erreur se corrige par annulation motivée de la dernière
opération, jamais par effacement.

Décisions : D-022, D-025, D-042 (onglets fictifs retirés), D-043 (km par
relevés de compteur), D-052 (cycle de vie), D-053 et D-067 (réception par
bon de commande, numéro par pneu, annulation encadrée de la réception,
performance par marque, réglage `pneu_reforme_precoce_km`), D-062 (réforme
d'engin refusée si des pneus sont montés), D-072, D-075 (périmètre).

Entrées : achats et réception (16), fournisseurs (15), engins (08),
relevés de compteur (07), sites (03). Sorties : coût par engin et par tonne
(20, 21), alertes de remplacement, immobilisations pneumatiques (11).

## 2. Sous-modules

1. Référentiel : numéro de série, marque, modèle, dimension (pas de
   référentiel des modèles, D-067).
2. Achat et réception (bon de commande, numéro par pneu reçu) ou entrée
   directe en stock.
3. Stock par site.
4. Montage, position, permutation, démontage (réutilisable ou endommagé).
5. Inspection (profondeur, pression), réparation, rechapage (plafond par
   pneu).
6. Réforme définitive motivée (mise au rebut).
7. Indicateurs : km parcourus, coût total, coût au km, durée de vie,
   performance par marque et modèle, alertes de remplacement.
8. Historique complet par pneu.

## 3. Menus et sous-menus

| Entrée | Vue | Droit lu |
|---|---|---|
| Pneus (`tires`) | `Pneus/PneusView` (avec `PerformancePneus`) | module `vehicles` (`AuthContext.tsx:164`) ; écriture : `vehicles` ou `maintenance` (`PneusView.tsx:39`) |
| Stocks & Achats > Achats (`purchases`) | `Purchases/PurchasesView` (lignes de pneus, réception) | `purchases` |

Incohérence relevée : un utilisateur qui a l'écriture `maintenance` sans la
lecture `vehicles` peut écrire mais ne voit pas l'entrée de menu.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Registre des pneus (filtre par état, km, coût, coût au km, actions selon l'état) | `v_pneus` | DÉPLOYÉ | `src/components/Pneus/PneusView.tsx:56-90`, `:255-275` ; vue redéfinie `20261120101000_correctifs_revue_r2.sql:496` |
| Nouveau pneu (entrée en stock) | `enregistrer_pneu` | DÉPLOYÉ | `PneusView.tsx:108-113`, `:180-200` |
| Opération sur un pneu (monter, démonter, permuter, inspecter, rechaper, réparer, réformer) | fonctions D-052 | DÉPLOYÉ | `PneusView.tsx:115-145`, `:201-232` |
| Historique d'un pneu et annulation motivée de la dernière opération | `pneus_operations`, `annuler_operation_pneu` | DÉPLOYÉ | `PneusView.tsx:91-96`, `:146-150`, `:278-300` |
| Pneus à surveiller (profondeur sous seuil, inspection trop ancienne) | `v_pneus_a_surveiller` | DÉPLOYÉ (sans seuil : aucune alerte) | `PneusView.tsx:60`, `:235-242` |
| Seuils d'alerte (administrateur) | `settings` (`valider_reglage`) | DÉPLOYÉ (`pneu_reforme_precoce_km` : TESTÉ) | `PneusView.tsx:151-160`, `:243-252` |
| Performance par marque et modèle | `v_pneus_performance` | TESTÉ (déploiement non consigné) | `src/components/Pneus/PerformancePneus.tsx:22`, `20261121130000_stocks_avances.sql:1293` |
| Réception de pneus sur bon de commande (un numéro par pneu) et annulation encadrée | `receptionner_bon_commande`, `receptions_achat_pneus` | TESTÉ | `src/components/Purchases/PurchasesView.tsx:131-145`, `:232` |
| Plan de pneumatiques d'un engin (positions, schéma d'essieux) | - | MANQUANT (position saisie en texte libre normalisé) | `pneus.ts:44` |
| Pneus par engin dans la fiche flotte | `v_fiche_vehicule` | DÉPLOYÉ (liste des pneus montés) | D-062 |
| Coût pneus par tonne transportée | - | MANQUANT (CDC 19) | - |
| Export du registre | - | MANQUANT (aucun bouton d'export dans `PneusView`) | - |
| Recherche par numéro, marque, engin | - | MANQUANT (filtre par état seulement) | `PneusView.tsx:86` |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Pneus à surveiller | `v_pneus_a_surveiller` | instant | DÉPLOYÉ |
| Km parcourus par pneu (compteurs au montage et au démontage, ou dernier relevé) | `v_pneus` | durée de vie | DÉPLOYÉ (incomplet signalé) |
| Coût total et coût au km (seulement si toutes les mesures existent) | `v_pneus` | durée de vie | DÉPLOYÉ |
| Performance par marque et modèle (km moyens, coût au km, durée de vie, réforme précoce, pris en compte et exclus) | `v_pneus_performance` | pneus réformés | TESTÉ |
| Stock de pneus par site et par état | `v_pneus` | instant | PARTIEL (filtre par état, pas de synthèse par site) |
| Coût pneus par engin et par tonne | - | mois | MANQUANT |
| Taux d'usure (mm par 1 000 km) | inspections | - | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Pneu (registre) | DÉPLOYÉ (`enregistrer_pneu` ; ou réception D-067 : TESTÉ) | DÉPLOYÉ | sans objet (cache calculé ; numéro, marque, modèle non corrigeables) | MANQUANT (saisie de série de pneus identiques) | DÉPLOYÉ (réforme définitive) | sans objet | PARTIEL (l'entrée ne s'annule pas, réforme motivée ; annulation de réception D-067 : TESTÉ) |
| Opération | DÉPLOYÉ (7 fonctions) | DÉPLOYÉ | sans objet | - | - | - | DÉPLOYÉ (`annuler_operation_pneu`, dernière opération, motif ; permutation liée annulée ensemble) |
| Seuil d'alerte | DÉPLOYÉ (administrateur) | DÉPLOYÉ | DÉPLOYÉ | - | - | DÉPLOYÉ (paramètre retiré si vidé) | - |
| Modèle de pneu (référentiel) | MANQUANT | - | - | - | - | - | - |

## 7. Modals et drawers

Panneaux en ligne pour l'entrée en stock, chaque opération et l'historique :
DÉPLOYÉ. Confirmation de réforme (définitive) : PARTIEL (le motif est
exigé, pas de dialogue rappelant l'irréversibilité). Annulation : PARTIEL
(`window.prompt`). Pièces jointes (facture, photo d'usure) : MANQUANT.
Import du stock initial : MANQUANT (prioritaire pour la mise en service :
pneus déjà montés sur les engins au démarrage).

## 8. Champs des formulaires

**Entrée en stock** (`enregistrer_pneu`) : numéro de série (obligatoire,
unique), marque et modèle (obligatoires), site de stockage (obligatoire ;
référentiel des sites non vide requis), dimension, date d'achat, prix
d'achat (colonne `bigint` : un prix décimal est refusé), fournisseur,
profondeur initiale (mm), plafond de rechapages, référence de pièce, note,
date de l'opération. Aucune valeur par défaut (D-052 a retiré prix 0, date
du jour, score 100, 2 rechapages, garantie 365 j).

**Montage** : engin, position (normalisée en majuscules ; un seul pneu par
position, index unique `ux_tires_position_montee`), compteur km,
profondeur, pression, note. **Démontage** : motif (obligatoire), état de
sortie (réutilisable `stored` ou endommagé `damaged`), site, km,
profondeur. **Permutation** : position cible (échange si occupée), km,
motif. **Inspection** : profondeur ou pression (au moins une), km.
**Rechapage** : prestataire, site, coût, profondeur, référence (plafond
contrôlé). **Réparation** : site, coût, prestataire. **Réforme** : motif.

Cible : position choisie dans le plan d'essieux du type d'engin, compteur
proposé depuis le dernier relevé D-043 (sans le remplir d'office), heures
d'utilisation pour les chargeuses (CDC 19).

## 9. Actions individuelles et en masse

| Action | État | Preuve |
|---|---|---|
| Monter, démonter, permuter, inspecter, rechaper, réparer, réformer | DÉPLOYÉ | `monter_pneu` ... `reformer_pneu` (`20261116210000_cycle_vie_pneus.sql:284-480`) |
| Annuler la dernière opération | DÉPLOYÉ | `annuler_operation_pneu` |
| Réceptionner des pneus sur bon de commande ; annuler la réception tant que chaque pneu n'a que son entrée | TESTÉ | D-067 (dérogation à D-052 à confirmer par le propriétaire) |
| Inspection en masse d'un engin (tous ses pneus) | MANQUANT | - |
| Entrée en masse (série de numéros) hors bon de commande | MANQUANT | - |
| Alerte de remplacement vers un achat | MANQUANT | - |

## 10. Statuts et transitions

États du pneu (`tires.status`, cache recalculé ; libellés de `src/components/Pneus/pneus.ts:9-14`) :

```
(entree) -> stored « En stock »
stored -> active « Monté »   (monter_pneu ; engin, position libre ou permutation)
active -> active            (permuter_pneu, inspecter_pneu)
active -> stored | damaged « À décider » (demonter_pneu, motif, état de sortie)
stored | damaged -> stored  (reparer_pneu, rechaper_pneu ; plafond de rechapages)
tout état sauf retired -> retired « Réformé » (reformer_pneu, motif ; définitif)
dernière opération -> annulée (annuler_operation_pneu, motif ; l'état revient au précédent)
réception annulée (D-067) -> retired, numéro suffixé -ANNULE-REC-, affiché « Annulé (réception) »
```

Chronologie imposée par le serveur (une opération ne peut précéder la
précédente). Droit : écriture `vehicles` ou `maintenance`, périmètre de
l'engin ou du site de stockage.

## 11. Workflows

1. Achat : bon de commande avec ligne de pneus (module 16), approbation,
   réception avec un numéro par pneu reçu -> entrée en stock au site du
   dépôt, prix et fournisseur repris.
2. Atelier : montage, inspections périodiques (seuil
   `pneu_inspection_max_jours`), permutations, démontage, réparation ou
   rechapage, réforme.
3. Alerte : profondeur sous `pneu_profondeur_min_mm` ou inspection ancienne
   -> liste à surveiller ; aucune relance ni demande d'achat automatique.
4. Immobilisation pour crevaison : déclarée au module 11 (cause
   pneumatique, imputation exploitant) ; lien avec l'opération pneu :
   MANQUANT.
Aucune approbation sur les opérations ; la réforme est unitaire.

## 12. Rôles et permissions

| Action | Module et niveau | Périmètre |
|---|---|---|
| Lire le registre et les vues | `vehicles` lecture (menu) ; RLS des vues | engin ou site de stockage |
| Opérations | `vehicles` ou `maintenance` écriture (fonctions serveur) | engin (montage) ou site (stock) |
| Réception de pneus | `purchases` et `stock`, plus écriture `vehicles` ou `maintenance` (D-067) | site du dépôt |
| Seuils | administrateur | global |

## 13. Tables et relations

`tires` (registre et cache : état, engin, position, site ; défauts Bolt
retirés, `20261116210000_cycle_vie_pneus.sql:35-36`), `pneus_operations`
(append-only, contraintes par type, opérations liées, annulations,
`:73-100`), `receptions_achat_pneus` et lignes de pneus de
`purchase_order_items` (D-067), `settings` (seuils). Vues `v_pneus`,
`v_pneus_a_surveiller`, `v_pneus_performance` (sécurité de l'appelant).
Tables héritées `tire_*` : plus lues ; une partie déplacée dans le schéma
d'archive par D-071 ; suppression à décider par le propriétaire.

## 14. Fonctions serveur et API

`enregistrer_pneu`, `monter_pneu`, `demonter_pneu`, `permuter_pneu`,
`inspecter_pneu`, `rechaper_pneu`, `reparer_pneu`, `reformer_pneu`,
`annuler_operation_pneu`, `normaliser_position_pneu`, `seuil_pneus`,
`receptionner_bon_commande` et `annuler_reception` (D-067). Manquantes :
`importer_pneus_montes` (mise en service), `inspecter_pneus_engin` (en
masse), `cout_pneus_par_engin`.

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Pneu sous seuil de profondeur ou inspection en retard | responsable pneus | écran | PARTIEL (pas dans « Mes validations ») |
| Plafond de rechapages atteint | responsable pneus | refus serveur au rechapage | PARTIEL |
| Stock de pneus d'une dimension sous un minimum | achats | - | MANQUANT |

## 16. Documents et modèles d'impression

Fiche de vie d'un pneu, bon de réforme, rapport d'inspection d'un engin :
MANQUANT.

## 17. Exports et rapports

Export du registre et de l'historique : MANQUANT. Performance par marque :
écran seulement (TESTÉ). Coût pneus dans le coût direct par tonne :
PARTIEL (`AnalysesFlotte.tsx:231` additionne `tires.purchase_price` par
date d'achat et par engin monté au moment de la lecture ; rechapages et
réparations ignorés).

## 18. Historique et audit

Journal `pneus_operations` append-only (auteur, horodatage, motif,
opération liée, annulation) consultable par pneu : DÉPLOYÉ. Comparaison de
versions : sans objet (journal événementiel).

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `35_cycle_vie_pneus` (17), `50_stocks_avances` (96, dont réception et performance des pneus), `55_correctifs_revue_achats_maintenance` | - |
| Unitaires | `src/components/Pneus/pneus.test.ts` (5) | - |
| E2E (API simulée) | `pneus.spec.ts` (1 : registre, alerte, montage, annulation), `stocks-avances.spec.ts`, `achats.spec.ts` | parcours achat -> réception -> montage -> réforme contre une vraie base |

## 20. Critères de recette métier

1. Le stock initial réel et les pneus déjà montés sur les engins de Nimba
   sont saisis (numéro, marque, modèle, position, compteur au montage).
2. Un achat de pneus est réceptionné avec un numéro par pneu ; chaque pneu
   apparaît en stock au site du dépôt avec son prix.
3. Montage, inspections, permutation, démontage et réforme d'un pneu sont
   saisis ; son coût au km s'affiche quand les compteurs sont complets,
   « Sans données » sinon.
4. Une erreur de saisie est annulée avec motif et reste visible.
5. PV signé par le responsable pneumatiques et la direction (jalon J2).

## Écarts et lots proposés

### Défauts bloquants constatés

Aucun défaut bloquant sur les écrans d'écriture du module 12 : les
paramètres envoyés correspondent aux signatures des fonctions D-052 ; les
valeurs vides sont retirées (`undefined`) et prennent les valeurs par défaut
SQL ; le site, l'engin, le motif et l'état de sortie bloquent l'envoi tant
qu'ils sont vides ; les seuils passent par `valider_reglage`.

Défauts non bloquants :
- `src/components/Pneus/PneusView.tsx:110`, `:124-125` : prix d'achat et
  coûts acceptés en décimal, paramètres `bigint` : refus serveur sur une
  valeur décimale.
- `src/contexts/AuthContext.tsx:164` : menu lié à la lecture `vehicles`
  alors que l'écriture est ouverte au droit `maintenance`
  (`PneusView.tsx:39`).
- `src/components/Analyses/AnalysesFlotte.tsx:231` : coût pneus par engin
  approché (engin monté au moment de la lecture, rechapages ignorés),
  présenté sans étiquette d'approximation.

### Lots proposés (ordre)

1. (M) Mise en service : import des pneus en stock et déjà montés (numéro,
   marque, modèle, engin, position, compteur), avec prévalidation ; dépend
   du composant ImportWizard et des engins saisis (module 08). Prioritaire
   pour la saisie réelle.
2. (S) Corriger les défauts non bloquants (montants entiers, droit du menu,
   étiquette du coût).
3. (S) Recherche par numéro, marque, engin ; export CSV du registre et de
   l'historique.
4. (M) Plan d'essieux par type d'engin (positions proposées) et inspection
   en masse d'un engin.
5. (M) Coût pneus par engin et par tonne depuis le journal (achat,
   rechapages, réparations, km) ; dépend des modules 07 et 20.
6. (S) Référentiel des modèles de pneus (marque, modèle, dimension) ;
   dépend du module 17.
7. (S) Alertes dans « Mes validations » ; seuil de stock minimum par
   dimension vers une demande d'achat (module 16).
8. (M) Lien entre immobilisation pneumatique (module 11) et opération pneu.
Point à trancher par le propriétaire : dérogation D-067 (annulation d'une
réception de pneus) ; suppression des tables `tire_*`. Extension à
déclencheur non commencée : capteurs de pression (choix d'un matériel).

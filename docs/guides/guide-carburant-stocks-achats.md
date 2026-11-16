# Guide carburant, stocks et achats

Public : logisticien, magasinier, acheteur, responsable carburant,
comptable. Sources : D-030, D-034, D-041, D-042, D-044, D-053, D-067 ; migrations
`20261112225739`, `20261115090000`, `20261115180000`, `20261117090000`,
`20261121130000` ;
écrans `Fuel`, `Stock`, `Purchases`.

Droits utiles : `fuel` pour le carburant ; `stock` pour les mouvements de
magasin et les réceptions d'achat ; `purchases` pour les bons de commande,
avec le droit d'approbation du rôle pour les décider.

## 1. Livraisons et factures de carburant CBG (D-034)

Écran **Carburant > Livraisons et factures CBG**. CBG livre le carburant au
moins une fois par semaine ; le prix du litre change et se saisit à chaque
livraison, jamais deviné.

| Action | Fonction | Règle principale |
|---|---|---|
| Enregistrer une livraison | `enregistrer_livraison_cbg` | Droit `fuel` ; référence, date, site, litres et prix unitaire positifs requis. |
| Enregistrer la facture CBG | `enregistrer_facture_carburant_cbg` | Référence, date, montant et au moins une livraison ; une livraison ne se rattache qu'à une seule facture. |
| Contrôler la facture | `controler_facture_carburant_cbg` | Compare le montant facturé à la somme attendue des livraisons rattachées : écart nul = « conforme », sinon « à examiner ». |

Consommation et coût : les litres distribués (fiches FC) sont valorisés au
prix des livraisons de la période. Sans livraison saisie, le coût est
« sans données ».

## 2. Registre du carburant (D-041)

Écran **Carburant > Stocks et cuves**.

### Cuves et citernes

Référentiel `stockages_carburant` : cuve fixe ou citerne mobile, site,
capacité, seuil d'alerte. Création et modification : droit `fuel`, site du
périmètre. Un stockage inactif ne reçoit plus de mouvement.

### Principe

Le stock d'un stockage est la somme de ses mouvements validés. Il reste
**vide (« sans données »)** tant qu'un inventaire d'ouverture n'est pas
validé. Les mouvements ne se modifient ni ne se suppriment : « Un mouvement
de carburant ne se supprime pas : annulez-le ».

### Opérations

| Opération | Fonction | Règle principale |
|---|---|---|
| Réception d'une livraison CBG | `receptionner_livraison_cbg` | Stockage du site de la livraison ; date non future ; volumes mesuré et accepté positifs, accepté au plus égal au mesuré ; méthode (jauge, pige, compteur, autre) ; motif obligatoire si écart au volume du document CBG. Crée une entrée à valider. |
| Transfert | `transferer_carburant` | Source et destination différentes, quantité positive, date non future. Sortie et entrée liées, décidées ensemble. |
| Distribution (pleins) | `saisir_carburant` depuis la fiche FC | Engin et litres positifs par ligne ; stockage facultatif, du site de la fiche. Un plein servi depuis un stockage suivi crée une sortie à valider. |
| Inventaire | `saisir_inventaire_carburant` | Volume entre 0 et la capacité ; refusé si un inventaire ou des mouvements du stockage attendent une décision. Le solde théorique est figé à la saisie. |
| Décider un inventaire | `decider_inventaire_carburant` | Autre personne que l'auteur ; motif de rejet requis ; l'ajustement est égal à l'écart ; refusé si le solde a changé depuis la mesure (« saisissez un nouvel inventaire »). |
| Décider un mouvement | `decider_mouvement_carburant` | Autre personne que l'auteur ; motif de rejet requis ; refusé si le stockage n'est pas ouvert par un inventaire initial validé. |
| Annuler un mouvement validé | `annuler_mouvement_carburant` | Motif requis ; crée un contre-mouvement à valider ; un ajustement ou une annulation ne s'annule pas. |

Séparation saisie / décision : réglage `carburant_validation_separee`,
exigée si absent (voir le guide administrateur). Les mouvements et
inventaires à valider apparaissent dans **Mes validations**.

L'ancien solde saisi à la main (`fuel_stocks`) est en lecture seule ; un
plein ne se supprime plus depuis le navigateur.

### Analyses

- **Analyse carburant** : `consommation_carburant` (litres par tonne et par
  heure, sur les pleins, les voyages livrés et les pointages).
- **Anomalies** : `anomalies_carburant`, règles affichées, seuil de
  surconsommation saisi par l'utilisateur.
- **Jauges connectées** : boîtiers déclarés ; une lecture ancienne n'est
  jamais présentée comme en direct.

## 3. Stocks magasin (D-044)

Écran **Stocks & Achats > Stocks**. La quantité d'un article dans un dépôt
est la somme de ses mouvements (`v_stock_depots`). La quantité affichée sur
l'article est un cache recalculé par le serveur, non saisissable.

| Opération | Fonction | Règle principale |
|---|---|---|
| Entrée, sortie, transfert, retour | `mouvement_stock` | Droit `stock`, dépôts du périmètre et actifs ; quantité positive ; date non future ; prix unitaire positif ou absent ; article actif. Une sortie supérieure au stock disponible du dépôt est refusée (« Stock insuffisant »). Numéro `MVT-AAAA-NNNNNN` attribué par le serveur. |
| Inventaire | `inventorier_stock` | Quantité comptée positive ou nulle ; motif obligatoire s'il y a un écart ; ajustement égal à l'écart. |
| Annulation | `annuler_mouvement_stock` | Motif requis ; contre-mouvement de type annulation, l'original reste ; refusé si le stock du dépôt ne le permet pas. |

Un mouvement de magasin ne se modifie ni ne se supprime. Un écart se
constate par inventaire, jamais par un stock négatif. Un mouvement issu
d'une réception d'achat ne s'annule pas directement : on annule la
réception.

### Stocks avancés (D-067)

Écran **Stocks & Achats > Stocks**, panneaux Réservations, Lots et séries,
Valorisation.

| Opération | Fonction | Règle principale |
|---|---|---|
| Réserver | `reserver_stock` | Droit `stock`, dépôt du périmètre ; pour un ordre de travail ouvert ou en cours (du périmètre), un engin du périmètre ou une affectation nommée ; jamais au-delà du stock libre (stock moins réservations). Numéro `RES-AAAA-NNNNN`. Rien ne sort physiquement. |
| Consommer | `mouvement_stock` avec la réservation | Sortie du dépôt de la réservation, au plus son reste ; imputée à l'ordre de la réservation (engin de l'ordre). Une sortie ou un transfert sans réservation ne prend que le stock libre. Une sortie annulée rend sa quantité à la réservation. |
| Lever | `lever_reservation_stock` | Motif obligatoire ; réservation active. |
| Clôture d'un ordre | automatique | Quand un ordre de travail passe à terminé ou annulé, ses réservations encore actives sont levées avec le motif « Levée à la clôture de l'ordre OT-… (terminé ou annulé) » ; la quantité redevient libre. |
| Lots et séries | attribut **Suivi** de l'article (aucun, lot, série) | Modifiable seulement sans stock. Un article suivi exige ses lots ou numéros de série à chaque mouvement (entrée, réception d'achat, sortie, transfert, retour) ; un numéro de série vaut une unité et n'est jamais deux fois en stock. |
| Inventaire d'un lot | `inventorier_lot_stock` | Article suivi seulement (l'inventaire global est refusé) ; motif si écart. |

**Valorisation au coût moyen pondéré.** Calculée par le serveur, par
article et tous dépôts confondus, dans l'ordre d'enregistrement des
mouvements, à partir des seules entrées valorisées (prix saisi ou prix de
réception du bon de commande). Une entrée sans prix rend la valeur
**partielle** : la valeur affichée est celle des seules quantités
valorisées, jamais estimée ; le prix de référence de l'article n'est pas
utilisé. Sans aucune entrée valorisée : « sans données ». Une entrée annulée
après d'autres mouvements de l'article sort au coût moyen du moment : ses
pièces ne sont plus identifiables dans le stock, l'article est signalé
**à vérifier** jusqu'au retour à un stock nul (une entrée annulée juste
après elle est retirée exactement, à son prix). Montants en GNF.
Un compte affecté à un site voit les quantités et les valeurs de ses seuls
dépôts ; le coût moyen est celui de l'article.

À saisir par l'exploitation : le mode de suivi des articles concernés et
les prix des entrées d'ouverture (sinon la valeur reste partielle).

## 4. Circuit achat (D-053)

Écran **Stocks & Achats > Achats**. Les bons de commande ne s'écrivent plus
directement depuis le navigateur : tout passe par des fonctions serveur,
journalisées dans `achats_journal` (non modifiable).

Statuts : brouillon, soumis, approuvé, reçu en partie, reçu, soldé, rejeté,
annulé.

| Étape | Fonction | Qui | Règle principale |
|---|---|---|---|
| Rédiger | `enregistrer_bon_commande` | Droit d'écriture `purchases` | Fournisseur actif ; dépôt de livraison obligatoire, actif, du périmètre ; au moins une ligne (article ou désignation libre, quantité positive, prix unitaire) ; taxes saisies ; totaux calculés par le serveur. Seul un brouillon se modifie. Numéro `BC-AAAA-NNNNN` attribué par le serveur, non modifiable. |
| Soumettre | `soumettre_bon_commande` | Droit d'écriture `purchases` | Seul un brouillon avec au moins une ligne se soumet. |
| Approuver ou rejeter | `decider_bon_commande` | Droit d'approbation `purchases` du rôle (administrateur, directeur, comptable) | Bon soumis, dans le périmètre ; par une **autre personne** que le demandeur (réglage `achats_validation_separee`, exigé si absent) ; rejet motivé. |
| Réceptionner | `receptionner_bon_commande` | Droit d'écriture `stock` | Bon approuvé ; numéro de réception ; bon de livraison ; par ligne quantité reçue et quantité refusée (motif du refus) ; jamais au-delà de la commande. Les articles reçus entrent au dépôt du bon par `mouvement_stock`, au prix commandé, avec leurs lots ou séries si l'article est suivi (D-067). Ligne de pneus (D-067) : un numéro par pneu reçu ; chaque pneu est enregistré au registre des pneus (prix de la ligne, fournisseur du bon, site du dépôt, pièce de réception) ; exige aussi le droit d'écriture flotte ou maintenance. |
| Annuler une réception | `annuler_reception` | Droit d'écriture `stock` | Motif requis ; annule les mouvements correspondants ; impossible si le bon est soldé ou clos, si un paiement engagé ou payé dépasserait le reçu restant (D-072), Réception avec pneus (D-067) : permise tant que chaque pneu n'a que son entrée ; l'entrée de chaque pneu est annulée avec le motif (journal des pneus), le pneu passe à l'état réformé et son numéro est suffixé `-ANNULE-REC-…` pour libérer le numéro saisi ; refusée, avec la liste des pneus, dès qu'un pneu a été monté ou mouvementé ; droit d'écriture flotte ou maintenance requis. |
| Annuler le bon | `annuler_bon_commande` | Droit d'écriture `purchases` | Motif requis ; avant toute réception. |
| Solder le bon | `solder_bon_commande` | Droit d'écriture `purchases` | Seul un bon reçu en partie se solde ; motif requis (reliquat non livré). |

Bon issu d'une consultation de fournisseurs (D-059, D-072) : le
fournisseur est celui de l'offre retenue et ne change pas. À la
soumission, le montant des lignes doit égaler le montant de l'offre
retenue, et le bon ne porte aucune taxe séparée : le prix d'une offre est
saisi toutes taxes comprises (l'offre n'a pas de champ taxes). Sinon la
soumission est refusée ; corriger le brouillon suffit. L'approbateur ne
peut pas être une personne ayant créé, modifié ou soumis le bon.

Les bons soumis à approuver et les bons approuvés à réceptionner
apparaissent dans **Mes validations** ; le demandeur reçoit une
notification quand son bon est approuvé ou rejeté.

Lecture : modules `purchases` ou `stock`, dans le périmètre du site du
dépôt.

## Limites connues

- Carburant : pas de valorisation par stockage (prix moyen pondéré de la
  période seulement), pas d'import des documents CBG, jauges connectées non
  branchées au registre (D-041).
- Stocks magasin : pas de séparation saisie / validation des mouvements
  (D-044). Coût moyen pondéré depuis D-067 : calculé dans l'ordre
  d'enregistrement (une entrée saisie après coup avec une date ancienne
  n'est pas replacée à sa date) ; part non valorisée répartie entre dépôts
  au prorata des quantités ; une sortie annulée est réintégrée au coût de la
  sortie d'origine ; recalcul complet à chaque lecture.
- Réception de pneus : annulable seulement tant que ses pneus n'ont que
  leur entrée ; un pneu annulé garde l'état réformé (pas d'état dédié) ;
  pas de référentiel des modèles de pneus (marque et modèle saisis sur la
  ligne du bon) (D-067).
- Quantité affichée sur l'article (`quantity_in_stock`) : total tous dépôts,
  lisible par un compte affecté à un site (correction dans un lot séparé).
- Achats : pas de contrôle budgétaire ni d'avoirs d'achat (D-053) ; la
  consultation de fournisseurs existe depuis D-059. Taxes des offres :
  saisie toutes taxes comprises, à confirmer par le propriétaire (D-072).

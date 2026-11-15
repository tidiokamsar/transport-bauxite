# Guide carburant, stocks et achats

Public : logisticien, magasinier, acheteur, responsable carburant,
comptable. Sources : D-030, D-034, D-041, D-042, D-044, D-053 ; migrations
`20261112225739`, `20261115090000`, `20261115180000`, `20261117090000` ;
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
| Réceptionner | `receptionner_bon_commande` | Droit d'écriture `stock` | Bon approuvé ; numéro de réception ; bon de livraison ; par ligne quantité reçue et quantité refusée (motif du refus) ; jamais au-delà de la commande. Les articles reçus entrent au dépôt du bon par `mouvement_stock`, au prix commandé. |
| Annuler une réception | `annuler_reception` | Droit d'écriture `stock` | Motif requis ; annule les mouvements correspondants ; impossible si le bon est soldé ou clos. |
| Annuler le bon | `annuler_bon_commande` | Droit d'écriture `purchases` | Motif requis ; avant toute réception. |
| Solder le bon | `solder_bon_commande` | Droit d'écriture `purchases` | Seul un bon reçu en partie se solde ; motif requis (reliquat non livré). |

Les bons soumis à approuver et les bons approuvés à réceptionner
apparaissent dans **Mes validations** ; le demandeur reçoit une
notification quand son bon est approuvé ou rejeté.

Lecture : modules `purchases` ou `stock`, dans le périmètre du site du
dépôt.

## Limites connues

- Carburant : pas de valorisation par stockage (prix moyen pondéré de la
  période seulement), pas d'import des documents CBG, jauges connectées non
  branchées au registre (D-041).
- Stocks magasin : pas de séparation saisie / validation des mouvements ;
  valorisation au prix unitaire saisi, pas de coût moyen pondéré (D-044).
- Achats : pas de consultation de fournisseurs, de contrôle budgétaire, de
  factures fournisseurs ni d'avoirs d'achat (D-053).

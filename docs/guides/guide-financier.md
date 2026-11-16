# Guide financier : contrats, facturation, paiements

Public : chargé de contrats et facturation (`contract_manager`), comptable
(`accountant`), Directeur Général (`director`). Sources : D-013, D-014,
D-026, D-029, D-031 à D-033, D-037, D-043, D-055, D-056,
`docs/SIGTB_2.0_LOCATION_MODEL.md` ; migrations `20261110230000`,
`20261111120000`, `20261111180000`, `20261111200000`, `20261112100000`,
`20261113100000`, `20261115150000`, `20261117150000`, `20261117180000` ;
écrans `Contrats`, `Facturation`, `Paiements`, `Notifications`.

Droits utiles : `contracts` pour le dossier contractuel, les engagements,
le rapport de performance, les comités et le contrôle des factures Neemba ;
`invoices` pour la réconciliation, les factures clients, le recouvrement et
les paiements ; approbation `invoices` pour décider et contrôler un
paiement.

Dérogation consciente (D-026) : au démarrage, le chargé de contrats saisit
aussi des données terrain. Toute saisie garde son auteur et son heure.

## 1. Dossier contractuel (D-026)

Écran **Contrats & Finance > Dossier contractuel**.

| Élément | Contenu |
|---|---|
| Contrat | Référence unique, intitulé, nature (client, location, autre), contrepartie, devise (code à 3 lettres), dates, statut (brouillon, actif, suspendu, clos), délai de paiement en jours. Un contrat ne se supprime qu'au stade brouillon. |
| Version | Contrat initial et avenants, numérotés, avec date d'effet, date de signature, document. |
| Engagements | Indicateur (disponibilité, temps de chargement, temps de cycle, taux de remplissage, rotations, km facturable, référence carburant, autre), seuil, unité, sens (minimum ou maximum), périodicité (jour, shift, semaine, mois), conséquence. |
| Tarifs | Libellé, unité (tonne, heure, km, jour, mois, forfait, autre), prix, catégorie de matériel ou engin précis, conditions, retour à vide facturable (oui, non, ou à confirmer). |

Toute création, modification ou suppression dans ces tables est
journalisée dans `journal_contrats` (état avant et après, auteur). Aucun
tarif ni seuil n'a de valeur par défaut : absent, il n'est pas calculable.

### Tarif par engin (D-033)

Pour chaque engin, on choisit l'unité facturée et le tarif. Priorité de
résolution : tarif de l'engin, puis de sa catégorie de matériel, puis tarif
unique de la version. Configuration déclarée au départ : camions bennes au
kilomètre parcouru, chargeuses et pelle à l'heure ; rien n'est codé en dur.
Un changement de type de facturation passe par un avenant (nouvelle
version) ; à la copie d'une version, l'engin et la règle du retour à vide
sont repris.

## 2. Modèle de location (D-013, D-014)

Le modèle de location est entièrement paramétrable : sens du contrat,
base horaire, catégories de temps et coefficients, minimum, plafond,
arrondi, majorations, sources de preuve et tolérances, devise, taux
versionnés (`docs/SIGTB_2.0_LOCATION_MODEL.md`). Règle centrale : un
paramètre absent rend le décompte « non calculable », aucun montant n'est
produit.

État réel : le moteur de calcul `src/domain/location/decompte.ts` existe et
est testé (27 tests), mais il n'est branché à aucun écran ni à aucune
table. Le contrôle des factures du loueur (section 7) s'appuie aujourd'hui
sur les heures pointées et les kilomètres validés, sans franchise,
arrondi, plafond ni minimum.

## 3. Réconciliation mensuelle (D-029, D-037)

Écran **Contrats & Finance > Réconciliation mensuelle**.

1. **Ouvrir** (`ouvrir_reconciliation`) : contrat client, période, trajet
   facultatif, **base de tonnage** (accepté, reçu ou chargé) et
   **tolérance d'écart** chargé / reçu, choisies sans valeur par défaut.
   Une seule réconciliation par contrat, période et trajet.
2. Le serveur photographie les voyages livrés (livré, accepté, clôturé, en
   litige, rejeté) et signale les anomalies : base absente, sans pesée,
   écart hors tolérance, litige, rejet, livré non accepté, ticket en double,
   ticket rectifié (bloquantes sauf « sans pesée ») et sans fiche terrain
   (informative).
3. **Actualiser** (`actualiser_reconciliation`) après une correction à la
   source ; impossible une fois clôturée.
4. **Décider chaque ligne à examiner** (`decider_ligne_reconciliation`) :
   facturable ou exclue, motif obligatoire. On ne saisit jamais un tonnage
   à la main : une erreur se corrige à la source, puis on actualise. Une
   ligne sans tonnage de base ou avec des anomalies non examinées ne peut
   pas être déclarée facturable.
5. **Clôturer** (`cloturer_reconciliation`) : refusé tant qu'une ligne reste
   à examiner. La clôture fige le tonnage facturable.

## 4. Factures clients CBG (D-029)

Écran **Contrats & Finance > Facturation**.

- **Générer** (`generer_facture`) depuis une réconciliation clôturée : une
  ligne par tarif à la tonne de la version du contrat en vigueur à la fin
  de la période ; taux de taxe saisi (0 si exonéré). Refus si aucune version
  ou aucun tarif à la tonne.
- Circuit (`avancer_facture`) :

| Action | Qui | Règle |
|---|---|---|
| Soumettre | Droit d'écriture `invoices` | Brouillon avec au moins une ligne ; passe « à signer ». |
| Signer | Rôle `director` seulement | Facture « à signer » ; le signataire n'est jamais le préparateur ; session aal2 si la double authentification est exigée. |
| Renvoyer | Rôle `director` | Facture « à signer », motif obligatoire. |
| Émettre | Droit d'écriture `invoices` | Facture signée ; date d'émission non future ; numéro définitif attribué sans trou (`FAC-AAAA-NNNN`) ; échéance = émission + délai de paiement du contrat. |
| Annuler | Droit d'écriture `invoices` | Brouillon ou à signer, motif obligatoire. |

- Une facture émise est immuable. Elle se corrige par un **avoir**
  (`creer_avoir`) : montant positif, au plus égal à la facture, motif
  obligatoire, soumis au même circuit, numéroté `AV-AAAA-NNNN`.
- Chaque action est journalisée dans `factures_journal`.

## 5. Suivi du contrat et recouvrement (D-031)

| Écran | Contenu |
|---|---|
| Engagements et rapport | `comparer_engagements` confronte les engagements de l'avenant au réalisé du mois (disponibilité, temps de chargement et de cycle, remplissage, rotations par camion et par jour, kilomètres, référence carburant). Chaque mesure porte son échantillon ; une mesure absente est « non mesurable » ; une clause « autre » n'est pas mesurée. |
| Rapport de performance | `generer_rapport_performance` : instantané figé par contrat et par mois, régénérable tant qu'il n'est pas remis ; `marquer_rapport_remis` : date non future et destinataire nommé, ensuite immuable ; imprimable. |
| Recouvrement | Vue `v_creances`. `enregistrer_encaissement` : date entre l'émission et aujourd'hui, montant au plus égal au reste dû (TTC, plus avoirs émis, moins encaissements) ; modes virement, chèque, espèces, compensation, autre. `relancer` : après l'échéance seulement, niveaux 1 rappel, 2 relance, 3 mise en demeure (ensuite, suite hors application) ; canaux courrier, e-mail, téléphone, remise en main propre ; lettre imprimable. |
| Comités de contrat | Comités et actions, écriture sous droit `contracts`. |
| Mon tableau de bord | Les indicateurs de la fiche de poste sur 12 mois (`indicateurs_charge_contrats`) et la liste de clôture du mois écoulé. |

## 6. Kilomètres facturables (D-043)

Un tarif au kilomètre se contrôle sur la somme des distances facturables
des voyages livrés : distance validée du trajet chargé, plus le retour à
vide si le tarif le prévoit. La validation d'une distance demande le droit
`contracts` et une autre personne que l'auteur des relevés (voir le guide
de l'exploitation, section 6). Sans distance validée, ou si la règle du
retour à vide n'est pas renseignée, les kilomètres sont « non
vérifiables ».

## 7. Contrôle des factures Neemba (D-032, D-033)

Écran **Contrats & Finance > Contrôle factures Neemba**.

1. **Saisir** la facture reçue : en-tête (numéro du fournisseur, date,
   période, devise, montants HT et TTC) et lignes par engin (quantité et
   unité facturées, taux, montant). Seules ces colonnes sont modifiables,
   tant que la facture est « saisie » ou « contrôlée ». Un numéro déjà
   utilisé pour le même contrat est refusé.
2. **Contrôler** (`controler_facture_fournisseur`) : pour chaque ligne
   d'engin, le serveur confronte la quantité facturée, dans l'unité du
   tarif, aux heures de marche pointées sur les fiches signées (heure) ou
   aux kilomètres validés des voyages livrés (km), et le taux au tarif en
   vigueur à la fin de la période. Il calcule l'écart et indique les heures
   d'arrêt imputées au loueur (information). Sans pointage, sans distance
   ou sans tarif, rien n'est estimé : la ligne est signalée. Une unité
   facturée différente de celle du tarif est signalée, jamais convertie.
   Une ligne sans engin n'est pas contrôlée.
3. **Notifier** (`notifier_ecart_fournisseur`) : date non future ; relance
   le contrôle puis fige la facture. Sans écart positif, la facture est
   déclarée conforme.
4. **Régulariser** (`enregistrer_regularisation`) sur un écart notifié :
   avoir, déduction ou remboursement, montant au plus égal au reste
   réclamé, date entre la notification et aujourd'hui.

Statuts : saisie, contrôlée, notifiée, régularisée, conforme.

## 8. Paiements fournisseurs (D-055)

Écran **Contrats & Finance > Paiements fournisseurs**. SIGTB n'exécute
aucun paiement : il enregistre la chaîne de décision et les paiements
exécutés hors système, saisis depuis les relevés bancaires.

| Étape | Fonction | Qui | Règle principale |
|---|---|---|---|
| Proposer | `proposer_paiement` | Droit d'écriture `invoices` | Une seule pièce : facture du loueur contrôlée (conforme, notifiée pour la part non contestée, régularisée) ou bon de commande reçu ou soldé ; objet requis ; montant positif, au plus égal au reste à payer calculé par le serveur. Numéro `PAY-AAAA-NNNNN` attribué. |
| Approuver ou rejeter | `decider_paiement` | Droit d'approbation `invoices` | Paiement proposé ; **autre personne** que le proposant (réglage `paiements_validation_separee`, exigé si absent) ; rejet motivé. |
| Saisir l'exécution | `enregistrer_execution_paiement` | Droit d'écriture `invoices` | Paiement approuvé ; date non future et pas avant l'approbation ; mode (virement, chèque, espèces, compensation, autre) ; référence bancaire obligatoire pour un virement ou un chèque ; montant au plus égal à l'approuvé. |
| Annuler | `annuler_paiement` | Droit d'écriture `invoices` | Avant exécution, motif requis. |
| Contrôler a posteriori | `controler_paiement` | Droit d'approbation `invoices` | Paiement exécuté, non encore contrôlé ; par une autre personne que le proposant et l'exécutant ; anomalie motivée. |

Reste à payer (`reste_a_payer`, vue `v_reste_a_payer`) : base, moins le plus
grand des avoirs et déductions et de la part réclamée si la facture est
notifiée (jamais les deux), ou, pour un bon, montant reçu plus les taxes au
prorata du reçu ; moins les montants déjà engagés et payés (D-072).
L'approbation et l'exécution d'un paiement revérifient que la pièce est encore
payable et couvre le paiement ; une réception ne s'annule pas sous un montant
déjà engagé ou payé. Vue `v_paiements_a_controler` pour le
contrôle.

Rôles ayant l'approbation `invoices` : administrateur, directeur,
comptable. Le chargé de contrats propose et saisit, il n'approuve pas.

## 9. Mes validations et notifications (D-056)

Écran **Mes validations** (menu, et compteur dans la barre supérieure).
La liste est calculée à chaque lecture depuis les données réelles, selon
les droits et la séparation des tâches de l'utilisateur. Rien n'est stocké :
le bouton « Ouvrir l'écran » mène à l'écran où la décision se prend, et la
fonction serveur de cet écran reste seule juge.

| Catégorie | Élément | Condition |
|---|---|---|
| Achats | Bon de commande à approuver | Approbation `purchases`, hors demandeur |
| Achats | Bon de commande à réceptionner | Écriture `stock` |
| Paiements | Paiement à approuver | Approbation `invoices`, hors proposant |
| Paiements | Paiement approuvé : exécution à saisir | Écriture `invoices` |
| Paiements | Paiement à contrôler a posteriori | Approbation `invoices`, hors proposant et exécutant |
| Carburant | Mouvement à valider, inventaire de cuve à valider | Écriture `fuel`, hors auteur |
| Exploitation | Clôture de poste à valider | Écriture `planning`, hors auteur de la clôture |
| Maintenance | Remise en service à valider | Écriture `maintenance`, hors auteur de la fin |
| Tickets CBG | Écart de relevé à décider | Écriture `trips` |
| Facturation | Facture à signer | Rôle `director` |
| HSE | Action corrective en retard | Écriture `trips` ou administrateur |

Notifications : chaque utilisateur lit seulement les siennes et les marque
lues (`marquer_notifications_lues`). Elles sont écrites par le serveur
quand une décision vous concerne : bon de commande approuvé ou rejeté,
paiement approuvé ou rejeté, anomalie au contrôle d'un paiement, clôture de
poste validée.

## Limites connues

- Moteur de décompte de location (D-013) non branché : franchise, arrondi,
  plafond, minimum et majorations ne sont pas appliqués au contrôle des
  factures Neemba (D-032).
- L'état d'écarts mensuel marqué « contrôle non indépendant » prévu par
  D-026 n'a pas été trouvé dans le code.
- Le rapport d'engagements lit encore `trips.km_start` et `km_end`, pas les
  distances validées (D-043).
- La mise en litige d'un écart de relevé CBG n'est pas encore reliée à la
  réconciliation mensuelle (D-050).
- Pas d'intégration bancaire ; la table héritée `payments` n'est pas
  utilisée (D-055). Les tables héritées `invoices` et `invoice_items`
  restent en place hors circuit (D-029).
- Pas de notification par courriel ou SMS, ni de délégation ou d'escalade
  (D-056).

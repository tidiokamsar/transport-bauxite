# SIGTB : anomalies pédagogiques

Version SIGTB documentée : `origin/main` 1896cde (2026-11-17). Production constatée : release 31f7267. Date de rédaction : 2026-11-17 (`date -u`). Mission D-092, phase 1.

Dix-sept cas d'anomalie, pour la formation et la recette. Pour chacun : ce qui s'est passé, comment SIGTB le détecte (règle ou fonction réelle), où l'utilisateur le voit, l'analyse, l'action, qui valide, la vérification. Quand SIGTB ne détecte pas le cas, c'est écrit. Les valeurs sont fictives. Renvois : MGU = manuel général.

Légende de la détection : **Bloquante** (le serveur refuse l'opération) ; **Signalée** (constat affiché, opération possible) ; **Non détectée** (aucune règle).

---

## 1. Camion indisponible
- **Ce qui s'est passé** : le dispatcheur affecte le camion AB-1234, en panne depuis le matin.
- **Détection** : Bloquante. `decider_affectation` (« Camion indisponible ou inadapte » si inactif ou non benne) et garde `garde_dispatch_disponibilite` (immobilisation ouverte, ou camion engagé avec un autre chauffeur). La vue « À réaffecter » de l'onglet Voyages par état liste les voyages affectés dont le camion ou le chauffeur n'est plus disponible.
- **Où** : Dispatch, message de refus ; rapport de l'affectation groupée ; Voyages par état, « À réaffecter ».
- **Analyse** : vérifier l'immobilisation (Maintenance > Immobilisations) et le statut de l'engin.
- **Action** : choisir un autre camion (Modifier, motif).
- **Qui valide** : le dispatcheur décide ; aucune validation supplémentaire.
- **Vérification** : voyage Affecté avec le nouveau camion ; décision au journal du dispatch.

## 2. Chauffeur non habilité
- **Ce qui s'est passé** : la visite médicale d'un chauffeur a expiré la veille ; le type « visite médicale » est exigé.
- **Détection** : Bloquante si le type est exigé par l'administrateur (`garde_habilitations_voyage`, `garde_dispatch_habilitations` : « Chauffeur non habilite le ... : ... manquant(s) ») ; permis expiré toujours bloquant. Sans type exigé : Non détectée au dispatch. Signalée aussi au centre des décisions (habilitation expirée) et dans les habilitations à renouveler.
- **Où** : Dispatch ; Flotte > Habilitations chauffeurs ; Centre des décisions.
- **Analyse** : lire l'habilitation manquante et sa date.
- **Action** : affecter un autre chauffeur ; renouveler l'habilitation (nouvelle saisie).
- **Qui valide** : le dispatcheur ; l'habilitation est saisie par un titulaire de `drivers`.
- **Vérification** : l'affectation passe ; l'habilitation n'est plus « à renouveler ».

## 3. Double affectation
- **Ce qui s'est passé** : un même chauffeur est proposé sur deux camions du shift.
- **Détection** : Bloquante. « Chauffeur deja affecte a un autre camion sur ce shift » ; garde de disponibilité (chauffeur engagé avec un autre camion, voyages de la veille au lendemain). Un voyage n'est aussi ligne que d'une seule réconciliation (`garde_voyage_une_reconciliation`).
- **Où** : Dispatch, message ; onglet Contrôles de la fiche du voyage.
- **Analyse** : retrouver l'autre voyage du chauffeur (Voyages par état).
- **Action** : affecter un autre chauffeur, ou réaffecter l'autre voyage (motif).
- **Qui valide** : le dispatcheur.
- **Vérification** : un seul camion par chauffeur sur le shift.

## 4. Voyage interrompu
- **Ce qui s'est passé** : un camion en route tombe en panne.
- **Détection** : Non détectée automatiquement : l'interruption est déclarée par l'utilisateur (`avancer_voyage` vers Interrompu, motif obligatoire). Une immobilisation ouverte sur le camion bloque ensuite ses nouvelles affectations.
- **Où** : fiche du voyage (état Interrompu) ; Dispatch, Voyages par état.
- **Analyse** : cause, position de la charge, délai de reprise.
- **Action** : déclarer l'immobilisation (MGU 21.F.1) ; faire repartir le voyage (En route ou À destination) ou l'annuler (motif) ; déclarer un incident si nécessaire.
- **Qui valide** : l'exploitation ; remise en service de l'engin par une autre personne.
- **Vérification** : voyage repris ou annulé ; immobilisation au registre.

## 5. Fiche FR manquante
- **Ce qui s'est passé** : un camion a roulé mais sa fiche de rotations n'est pas revenue.
- **Détection** : Signalée. `controles_voyage` (« fiche présente » en défaut) ; anomalie informative « sans fiche terrain » à la réconciliation ; contrôle de fiche (`controler_fiche`) : voyage sans ligne. Le retour d'une fiche peut porter l'état « manquante ».
- **Où** : Opérations transport > Contrôles et clôtures ; fiche du voyage, onglet Contrôles ; réconciliation.
- **Analyse** : retrouver la fiche (agent, remise enregistrée).
- **Action** : récupérer la fiche signée et la saisir ; à défaut, la ligne reste informative, la décision de facturer appartient au chargé de contrats.
- **Qui valide** : contrôleur des fiches ; chargé de contrats pour la ligne.
- **Vérification** : le contrôle du voyage ne signale plus de fiche absente.

## 6. Fiche incomplète
- **Ce qui s'est passé** : une fiche FR revient sans l'heure de déchargement ni le ticket sur une rotation.
- **Détection** : Signalée. `controler_fiche` relève les écarts (ticket CBG absent, voyage non terminé, km contre relevés...) ; `valider_fiche` exige un motif si des écarts subsistent.
- **Où** : fiche terrain, résultat du contrôle (onglet Écarts).
- **Analyse** : comparer avec le relevé CBG et le chauffeur.
- **Action** : Renvoyer en correction (motif) ; compléter ; soumettre de nouveau.
- **Qui valide** : un contrôleur autre que les auteurs de la saisie.
- **Vérification** : contrôle sans écart, fiche Validée puis Archivée.

## 7. Ticket CBG en doublon
- **Ce qui s'est passé** : le même numéro de ticket est saisi sur deux voyages.
- **Détection** : Bloquante à la saisie (« Ticket de pesee ... deja utilise sur un autre voyage », code 23505). Signalée au rapprochement (« Ticket dupliqué » : deux fois dans le relevé ou dans un autre relevé) et à la réconciliation (« ticket en double », bloquante).
- **Où** : saisie de la fiche ou du voyage ; Pesée CBG espaces C et D ; réconciliation.
- **Analyse** : lequel des voyages porte réellement le ticket (relevé CBG, camion, heure).
- **Action** : saisir le bon numéro ; examiner l'anomalie et conclure.
- **Qui valide** : contrôleur, puis validateur finance distinct.
- **Vérification** : une seule occurrence du ticket, anomalie clôturée.

## 8. Écart entre ticket CBG et fiche KOGON
- **Ce qui s'est passé** : la fiche KOGON relève 40,5 t, le relevé CBG 39,7 t ; tolérance de 0,2 t.
- **Détection** : Signalée. `rapprocher_pesees` : « Écart de poids » hors tolérance (`tolerance_pesee_applicable`) ; sans tolérance paramétrée, tout écart non nul. Bloquante pour la facturation : `anomalie_pesee_ouverte` bloque la ligne de réconciliation.
- **Où** : Pesée CBG espaces C et D ; Opérations transport > Anomalies et écarts.
- **Analyse** : erreur de recopie, de camion, ou erreur CBG.
- **Action** : Examiner ; accepter l'écart justifié (référence de preuve obligatoire) ou signaler une erreur CBG (la valeur CBG n'est pas modifiée) ; Soumettre.
- **Qui valide** : validateur `invoices` distinct de ceux qui ont conclu et soumis.
- **Vérification** : anomalie clôturée ; ligne de réconciliation décidable.

## 9. Réception de carburant avec écart
- **Ce qui s'est passé** : bon CBG de 30 000 l, 29 850 l mesurés en cuve.
- **Détection** : Bloquante sans motif (`receptionner_livraison_cbg` exige un motif si écart au volume du document) ; l'entrée reste à valider. Aucune alerte spécifique à l'écart de réception.
- **Où** : Carburant > Réceptions, cuves et inventaires ; Mes validations.
- **Analyse** : méthode de mesure, température, fuite, erreur du bon.
- **Action** : réceptionner au volume accepté avec motif ; joindre le bon à la livraison ; informer CBG hors SIGTB si nécessaire.
- **Qui valide** : une autre personne que l'auteur de la réception.
- **Vérification** : entrée validée, stock de la cuve mis à jour.

## 10. Inventaire de cuve incorrect
- **Ce qui s'est passé** : l'inventaire saisi est faux (erreur de pige).
- **Détection** : Signalée : l'écart au solde théorique est affiché ; alerte « écart d'inventaire carburant » si le seuil `alerte_ecart_carburant_l` est saisi. Bloquante : `decider_inventaire_carburant` refuse si le solde a changé depuis la mesure.
- **Où** : Réceptions, cuves et inventaires ; Mes validations ; Centre des décisions.
- **Analyse** : refaire la mesure.
- **Action** : le décideur rejette l'inventaire (motif) ; un nouvel inventaire est saisi.
- **Qui valide** : une autre personne que l'auteur.
- **Vérification** : inventaire validé, ajustement égal à l'écart réel.

## 11. Distribution à contrôler
- **Ce qui s'est passé** : un engin reçoit 600 l alors que sa consommation habituelle est de 300 l.
- **Détection** : Signalée. Chaque sortie depuis une cuve suivie est à valider (Mes validations) ; `anomalies_carburant` signale la surconsommation selon le seuil saisi à l'écran ; `controler_fiche` (FC) signale cuve absente, destinataire non confirmé, index de pompe, engin hors site, solde insuffisant. Aucune détection automatique sans seuil saisi.
- **Où** : Carburant > Anomalies ; Mes validations ; fiche FC.
- **Analyse** : compteur, heures de marche, erreur de saisie.
- **Action** : rejeter la sortie (motif) ou la valider ; annuler un mouvement validé par contre-mouvement.
- **Qui valide** : une autre personne que le saisisseur.
- **Vérification** : stock et consommation cohérents.

## 12. Pneu endommagé
- **Ce qui s'est passé** : un pneu crevé est démonté.
- **Détection** : Non détectée automatiquement (aucun capteur). Signalée seulement par les pneus à surveiller (profondeur sous le seuil, inspection trop ancienne) si les seuils sont saisis.
- **Où** : Pneus ; Pneus à surveiller.
- **Analyse** : réparable, rechapable ou à réformer.
- **Action** : démonter (motif, état « à décider ») ; réparer, rechaper ou réformer (motif) ; déclarer l'immobilisation de l'engin avec la cause « Pneumatique » si l'arrêt dure.
- **Qui valide** : aucune validation sur les opérations de pneu.
- **Vérification** : journal du pneu ; position libre ou nouveau pneu monté.

## 13. Inspection en retard
- **Ce qui s'est passé** : une inspection HSE planifiée n'a pas été réalisée à sa date.
- **Détection** : Signalée. Règle « inspection en retard » du centre des décisions (active sauf mise hors service) ; pour les pneus, `pneu_inspection_max_jours` (si saisi).
- **Où** : Centre des décisions ; RH & Sécurité > Prévention HSE, Inspections.
- **Analyse** : cause du retard.
- **Action** : réaliser l'inspection (date non future, jamais avant la planification) ou l'annuler (motif) ; résoudre l'alerte (motif).
- **Qui valide** : responsable HSE.
- **Vérification** : inspection réalisée, occurrence suivante planifiée, alerte résolue.

## 14. Facture incohérente
- **Ce qui s'est passé** : Neemba facture 3 200 km pour un camion qui en a 3 050 validés.
- **Détection** : Signalée. `controler_facture_fournisseur` : écart de quantité ou de taux, unité différente du tarif, pointage ou distance absents. Facture carburant CBG : `controler_facture_carburant_cbg` (« à examiner » si l'écart n'est pas nul). Facture CBG client : générée par le serveur depuis la réconciliation, pas de saisie à contrôler.
- **Où** : Contrats & Finance > Contrôle factures Neemba ; Carburant > Livraisons et factures CBG.
- **Analyse** : lignes en écart, pointages, distances, tarif en vigueur.
- **Action** : notifier l'écart (la facture est figée) ; régulariser (avoir, déduction, remboursement) ; payer seulement le reste à payer.
- **Qui valide** : chargé de contrats ; paiement approuvé par un autre.
- **Vérification** : statut régularisée ou conforme ; reste à payer cohérent.

## 15. Document manquant
- **Ce qui s'est passé** : l'assurance d'un camion n'est pas au registre ; ou le bon de livraison n'a pas été joint.
- **Détection** : Partielle. Un document expiré ou expirant sous 30 jours est signalé (`v_documents_vehicule_a_renouveler`, alerte « document expiré ») ; un document jamais saisi n'est **pas détecté**. Une pièce jointe absente n'est **pas détectée** : aucune règle n'exige une pièce. Une habilitation exigée absente bloque le dispatch (cas 2).
- **Où** : Flotte > Documents ; Centre des décisions.
- **Analyse** : liste des documents attendus (hors SIGTB).
- **Action** : saisir le document ; joindre la pièce à l'objet.
- **Qui valide** : aucune validation.
- **Vérification** : document présent ; pièce visible dans l'onglet Pièces jointes.

## 16. Validation refusée
- **Ce qui s'est passé** : l'approbateur rejette un bon de commande.
- **Détection** : Décision humaine tracée : rejet motivé obligatoire (`decider_bon_commande`, `decider_paiement`, `decider_mouvement_carburant`, `decider_inventaire_carburant`), renvoi motivé d'une facture par le directeur, refus de remise en service, renvoi d'une fiche en correction, renvoi d'une anomalie en examen.
- **Où** : écran du module ; notification au demandeur pour un bon ou un paiement.
- **Analyse** : lire le motif.
- **Action** : corriger à la source et soumettre de nouveau (nouveau bon, nouvelle saisie) ; un rejet ne se transforme pas en approbation.
- **Qui valide** : l'approbateur, autre que le demandeur.
- **Vérification** : nouvel objet soumis et décidé ; historique conservé.

## 17. Modification interdite
- **Ce qui s'est passé** : un utilisateur veut changer le poids d'un ticket, une facture émise ou une fiche validée.
- **Détection** : Bloquante. Preuve de pesée immuable (« ajouter une rectification motivee ») ; facture émise immuable ; fiche validée, archivée ou annulée figée (`fiches_terrain_cycle`) ; état du voyage modifiable par les seules fonctions du cycle (`trips_garde_cycle`) ; rapport figé immuable ; écritures directes refusées (« permission denied for table ... »).
- **Où** : message du serveur dans l'écran.
- **Analyse** : quelle correction tracée le module prévoit.
- **Action** : rectification motivée (ticket, autre personne), avoir (facture), annulation motivée, nouvelle version (objectif, contrat, risque).
- **Qui valide** : selon le module (autre personne pour la rectification de ticket, directeur pour un avoir).
- **Vérification** : l'original reste visible, la correction est au journal.

---

## Synthèse de la détection

| N° | Cas | Détection |
|---|---|---|
| 1 | Camion indisponible | Bloquante |
| 2 | Chauffeur non habilité | Bloquante si type exigé ; sinon non détectée au dispatch |
| 3 | Double affectation | Bloquante |
| 4 | Voyage interrompu | Non détectée (déclarée) |
| 5 | Fiche FR manquante | Signalée |
| 6 | Fiche incomplète | Signalée |
| 7 | Ticket CBG en doublon | Bloquante et signalée |
| 8 | Écart ticket et fiche KOGON | Signalée, bloquante pour la facturation |
| 9 | Réception carburant avec écart | Bloquante sans motif |
| 10 | Inventaire de cuve incorrect | Signalée (alerte si seuil) |
| 11 | Distribution à contrôler | Signalée (seuil requis pour la surconsommation) |
| 12 | Pneu endommagé | Non détectée |
| 13 | Inspection en retard | Signalée |
| 14 | Facture incohérente | Signalée (Neemba, carburant) |
| 15 | Document manquant | Partielle (expiration seulement) |
| 16 | Validation refusée | Décision tracée |
| 17 | Modification interdite | Bloquante |

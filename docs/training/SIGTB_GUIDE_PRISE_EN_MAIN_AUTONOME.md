# SIGTB : guide de prise en main autonome

Version SIGTB documentée : `origin/main` 1896cde (2026-11-17). Production constatée : release 31f7267. Date de rédaction : 2026-11-17 (`date -u`). Mission D-092, phase 1.

Dix niveaux progressifs. Chaque niveau comprend des objectifs, une lecture (renvois au manuel général, MGU), des exercices et un questionnaire. Les corrigés sont dans `CORRIGES.md`, à ouvrir après avoir répondu.

**Où s'exercer.** Uniquement sur des données d'exemple (jeu D-084, identifiants `dec0de00-`, bandeau visible) ou dans un environnement de formation désigné par l'administrateur. Ne jamais faire un exercice sur des données réelles de production : toute saisie y est définitive et tracée. Le jeu d'exemple doit être chargé par l'administrateur technique (manuel administrateur, section 16) ; s'il ne l'est pas, faire les exercices en lecture seule et passer les saisies.

| Niveau | Thème | Public |
|---|---|---|
| 1 | Se connecter et s'orienter | Tous |
| 2 | Lire sans modifier : listes, fiches, recherche, export | Tous |
| 3 | Les règles communes : motif, séparation, périmètre, « sans données » | Tous |
| 4 | Saisie terrain : fiches FR, FP, FC | Agents, chefs de poste |
| 5 | Préparer et piloter un shift : objectif, poste, dispatch | Exploitation |
| 6 | Suivre un voyage et ses preuves | Exploitation, contrôle |
| 7 | Pesée CBG et rapprochement | Contrôle, finance |
| 8 | Coûts : carburant, maintenance, pneus, stocks, achats | Logistique, maintenance |
| 9 | Contrats, réconciliation, facture, encaissement, paiements | Finance, direction |
| 10 | Pilotage, alertes, rapports et clôture | Direction, encadrement |

---

## Niveau 1 : se connecter et s'orienter

Objectifs : se connecter, sécuriser son compte, identifier les zones de l'écran.
Lecture : MGU chapitres 1, 2, 3 (D).

Exercices :
1.1 Connectez-vous à https://sigtb.infranetgn.com avec le compte remis par l'administrateur.
1.2 Ouvrez le menu du profil et relevez votre nom, votre rôle et les trois actions proposées.
1.3 Inscrivez un facteur de double authentification, déconnectez-vous, reconnectez-vous avec le code.
1.4 Dépliez trois rubriques du menu et notez une entrée de chacune.

Questionnaire :
Q1.1 Que faire si vous avez oublié votre mot de passe ?
Q1.2 Que signifie « Session actuelle : vérifiée en deux étapes » ?
Q1.3 Une entrée de menu que vous ne voyez pas existe-t-elle pour d'autres comptes ? Pourquoi ?
Q1.4 Le bouton Microsoft 365 permet-il de se connecter aujourd'hui ?

---

## Niveau 2 : lire sans modifier

Objectifs : rechercher, filtrer, trier, ouvrir une fiche, exporter.
Lecture : MGU 3.F.1 à 3.F.3, chapitre 17 (D).

Exercices :
2.1 Avec Ctrl K, retrouvez un engin d'exemple par son immatriculation.
2.2 Dans Flotte > Véhicules et engins, filtrez sur un statut, triez par immatriculation, passez à la page 2.
2.3 Ouvrez une fiche et parcourez ses onglets ; revenez à la liste par le bouton retour du navigateur.
2.4 Exportez la liste filtrée en CSV et ouvrez-la dans un tableur.

Questionnaire :
Q2.1 Combien de caractères faut-il taper au minimum dans la recherche globale ?
Q2.2 Les filtres d'une liste standard sont-ils conservés quand on revient sur la liste ?
Q2.3 Une erreur de lecture du serveur s'affiche-t-elle comme une liste vide ?
Q2.4 L'export CSV reprend-il toutes les lignes de la table ou les lignes filtrées ?

---

## Niveau 3 : les règles communes

Objectifs : comprendre pourquoi le serveur refuse, et comment corriger sans réécrire.
Lecture : MGU chapitre 1 (principes), 3.H, FAQ.

Exercices :
3.1 Tentez d'annuler un objectif de planification d'exemple sans motif ; notez le message.
3.2 Avec le compte A, saisissez un mouvement de carburant d'exemple ; avec le compte A, tentez de le valider ; notez le message.
3.3 Avec un compte affecté au Site minier A (exemple), cherchez un voyage du Dépôt C (exemple) qui ne part ni n'arrive à votre site.
3.4 Repérez dans le tableau de bord un indicateur « sans données » et expliquez-le.

Questionnaire :
Q3.1 Pourquoi une saisie validée ne se modifie-t-elle pas ?
Q3.2 Le sélecteur de site du menu donne-t-il accès à un autre site ?
Q3.3 Que signifie le code `42501` dans un message ?
Q3.4 Que faire si la valeur à saisir est inconnue ?

---

## Niveau 4 : saisie terrain

Objectifs : saisir une fiche de rotations, de pointage et de carburant depuis la fiche papier signée.
Lecture : MGU chapitre 14 ; 20.F.1 ; guide terrain `docs/guides/guide-terrain.md`.

Exercices :
4.1 Préparez les fiches FR d'un shift d'exemple, imprimez-les, remettez l'une à un agent nommé.
4.2 Enregistrez son retour, puis saisissez trois rotations, ticket CBG compris (brut et tare en tonnes).
4.3 Saisissez une fiche FP avec un arrêt « panne » imputé « à déterminer » ; vérifiez qu'une immobilisation est créée.
4.4 Saisissez une fiche FC avec deux pleins servis depuis une cuve suivie.
4.5 Terminez la saisie et soumettez la fiche FR au contrôle.

Questionnaire :
Q4.1 Dans quelle unité se saisissent le brut et la tare ?
Q4.2 Le ticket CBG se rattache-t-il au départ ou à l'arrivée ?
Q4.3 Que se passe-t-il si vous ressaisissez une étape déjà enregistrée ?
Q4.4 Le prix du litre se saisit-il sur la fiche FC ?
Q4.5 Pouvez-vous valider une fiche dont vous avez saisi une ligne ?

---

## Niveau 5 : préparer et piloter un shift

Objectifs : fixer l'objectif, ouvrir le poste, préparer et affecter les voyages.
Lecture : MGU chapitres 8 à 11.

Exercices :
5.1 Définissez un objectif d'exemple de 1 200 t pour le shift Jour, puis révisez-le à 1 100 t avec un motif.
5.2 Ouvrez le poste, composez l'équipe, pointez un absent avec motif.
5.3 Au Dispatch, planifiez l'instance, lisez le besoin et ses hypothèses, confirmez le plan.
5.4 Acceptez la sélection ; lisez le rapport ; corrigez un refus par une modification motivée.
5.5 Suspendez puis reprenez un voyage.

Questionnaire :
Q5.1 D'où vient le nombre de voyages proposé ?
Q5.2 Un chauffeur sous sanction de retrait de conduite est-il bloqué par le serveur ?
Q5.3 Que signifie « Voyage engage : l'affectation ne change plus » ?
Q5.4 Qui valide la clôture d'un poste ?
Q5.5 La barre supérieure affiche « non ouvert » : que faut-il faire ?

---

## Niveau 6 : suivre un voyage et ses preuves

Objectifs : faire avancer un voyage, lire sa fiche opérationnelle, joindre une preuve, vérifier un événement.
Lecture : MGU chapitres 12, 13, 16 ; 3.F.4.

Exercices :
6.1 Faites avancer un voyage d'exemple d'Affecté à Livré en respectant l'ordre et des heures croissantes.
6.2 Joignez au voyage une photo d'exemple (PNG de moins de 10 Mio).
6.3 Saisissez les deux relevés de compteur du voyage ; avec un autre compte titulaire de `contracts`, validez la distance.
6.4 Ouvrez Opérations transport > Journal des événements filtré sur ce voyage ; comptez les sources différentes.
6.5 Avec un second compte, vérifiez puis validez un événement déclaré.

Questionnaire :
Q6.1 Un voyage engagé peut-il être supprimé ?
Q6.2 Quels formats de fichier un voyage accepte-t-il en pièce jointe ?
Q6.3 Quelle différence entre distance mesurée et distance validée ?
Q6.4 Que faire d'un ticket remis après la livraison ?

---

## Niveau 7 : pesée CBG et rapprochement

Objectifs : importer le relevé officiel, saisir une fiche KOGON, rapprocher, traiter une anomalie.
Lecture : MGU chapitre 15 ; `docs/guides/guide-pesee.md` ; anomalies pédagogiques 7 et 8.

Exercices :
7.1 Importez un relevé CSV d'exemple ; lisez l'aperçu et les lignes rejetées.
7.2 Réimportez le même fichier ; notez le message.
7.3 Saisissez une fiche KOGON avec « L'agent signale une anomalie ».
7.4 Rapprochez ; identifiez un « Écart de poids » ; examinez-le, acceptez l'écart justifié avec une référence de preuve, soumettez.
7.5 Avec un compte `invoices` distinct, clôturez l'anomalie.

Questionnaire :
Q7.1 Qui pèse officiellement ?
Q7.2 La fiche KOGON peut-elle remplacer le ticket CBG ?
Q7.3 Que se passe-t-il sans tolérance paramétrée ?
Q7.4 Qui ne peut pas clôturer une anomalie ?

---

## Niveau 8 : coûts

Objectifs : tracer le carburant, une immobilisation et une intervention Neemba, un pneu, un achat.
Lecture : MGU chapitres 20 à 24.

Exercices :
8.1 Enregistrez une livraison CBG d'exemple, réceptionnez-la en cuve avec un écart motivé ; faites valider par un autre compte.
8.2 Saisissez un inventaire de cuve ; faites-le décider par un autre compte.
8.3 Déclarez une immobilisation imputée au loueur ; demandez l'intervention, prenez-la en charge, terminez-la ; faites valider la remise par un autre compte.
8.4 Rédigez un bon de commande de deux pneus, soumettez, faites approuver, réceptionnez avec deux numéros ; montez un pneu.
8.5 Réservez un article pour un ordre de travail, puis tentez une sortie libre supérieure au stock libre.

Questionnaire :
Q8.1 Pourquoi le stock d'une cuve est-il « sans données » ?
Q8.2 Qui porte la maintenance des engins loués ?
Q8.3 Peut-on rechaper un pneu monté ?
Q8.4 Qui approuve un bon de commande ?
Q8.5 Une réception d'achat se corrige-t-elle en annulant le mouvement de stock ?

---

## Niveau 9 : contrats, facturation, paiements

Objectifs : comprendre le dossier contractuel, réconcilier, facturer, encaisser, payer.
Lecture : MGU chapitres 27 à 29 ; circuit A.

Exercices :
9.1 Ouvrez le contrat CBG d'exemple ; relevez le tarif à la tonne et le délai de paiement.
9.2 Ouvrez une réconciliation d'exemple ; décidez une ligne à examiner avec un motif ; clôturez.
9.3 Générez la facture ; soumettez ; avec le compte directeur d'exemple, signez ; émettez ; imprimez.
9.4 Enregistrez un encaissement partiel ; relancez après échéance (si la date le permet).
9.5 Saisissez une facture Neemba d'exemple, contrôlez-la, lisez l'écart, notifiez.
9.6 Proposez un paiement ; faites-le approuver par un autre compte ; saisissez l'exécution avec une référence fictive.

Questionnaire :
Q9.1 Un tonnage se saisit-il à la main dans la réconciliation ?
Q9.2 Qui signe une facture CBG ?
Q9.3 Comment corriger une facture émise ?
Q9.4 SIGTB exécute-t-il les virements ?
Q9.5 Une unité facturée par Neemba différente de celle du tarif est-elle convertie ?

---

## Niveau 10 : pilotage, alertes, rapports, clôture

Objectifs : piloter une semaine sans tableur parallèle.
Lecture : MGU chapitres 4 à 6, 32 ; circuit J.

Exercices :
10.1 Au centre de pilotage, comparez deux semaines pour un site ; exportez en CSV.
10.2 Ouvrez le centre des décisions ; résolvez une alerte avec un motif après avoir traité sa cause.
10.3 Clôturez une journée de planification avec une cause d'écart.
10.4 Calculez le rapport mensuel par jour ; figez-le.
10.5 Listez, pour votre rôle, les éléments de Mes validations et ouvrez chacun.

Questionnaire :
Q10.1 Pourquoi une alerte de seuil n'apparaît-elle jamais ?
Q10.2 Une alerte dont la cause a disparu se résout-elle seule ?
Q10.3 Un rapport figé peut-il être modifié ?
Q10.4 Que signifie « Non visible avec vos droits de lecture » ?
Q10.5 Les alertes sont-elles envoyées par courriel ?

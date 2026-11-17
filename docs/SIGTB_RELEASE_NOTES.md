# SIGTB : notes de version

> **Erratum du 2026-11-15 (D-070).** Des entrees de ce document portent les dates du 2026-11-16, du 2026-11-17 ou du 2026-11-18. Ces dates sont fausses : le travail correspondant a ete fait le 2026-11-15. L'horodatage des commits et l'heure du serveur, lus par `date -u`, le confirment. Les entrees sont laissees telles quelles pour la tracabilite ; seul cet erratum les corrige. Les numeros de migration `20261116...` a `20261120...` sont des identifiants de sequence, pas des dates : les versions deja appliquees en production ne sont pas renommees.


Versions déployées sur https://sigtb.infranetgn.com. Le détail des étapes de chaque mise à jour est dans [SIGTB_2.0_HEBERGEMENT_VPS.md](SIGTB_2.0_HEBERGEMENT_VPS.md), section 11.

## 3ff151d (2026-11-17) : pesée CBG à deux sources (D-081, PR #104)

- Le relevé officiel CBG et la fiche terrain de l'agent KOGON sont conservés séparément, puis rapprochés automatiquement ; la fiche KOGON ne remplace jamais le ticket CBG.
- Menu « Pesée CBG » en quatre onglets : relevés officiels CBG, fiches terrain KOGON, rapprochement côte à côte, anomalies et validations.
- Import du relevé CBG contrôlé (colonnes, doublons, fichier déjà importé), annulation motivée réservée à la facturation.
- Une ligne de facture ne prend jamais en silence le poids KOGON : relevé CBG absent ou ambigu, la ligne est bloquée jusqu'à décision motivée.

## 33ab8ef (2026-11-16) : fenêtres de saisie (PR #102)

- Toutes les fenêtres de saisie et de détail : boutons du bas toujours visibles, contenu qui défile, fermeture par Échap, utilisables sur téléphone.
- La fiche voyage s'ouvre au centre de l'écran ; les erreurs s'affichent en haut de la fenêtre.

## 58ad8db (2026-11-16) : référentiels, comptes et contrats (D-079, PR #101)

- Modifier un site ne lui fait plus perdre son organisation ; coordonnées GPS facultatives.
- Un compte se crée avec un site (accès à tous les sites seulement avec motif) ; désactivation et réactivation motivées et tracées ; le dernier administrateur est protégé.
- Contrats : plus de suppression d'un tarif en vigueur ; un tarif change par avenant, jamais sur une période déjà facturée ; un contrat ne devient actif qu'avec au moins un tarif.

## 8dec42c (2026-11-16) : défauts bloquants de la chaîne J1 (D-078, PR #100)

- Écran des shifts (création, modification motivée, journal).
- Ticket CBG rattachable aux trajets entre sites ; une pesée sans ticket est refusée.
- Réconciliation : un poids supérieur à la capacité du camion n'est jamais facturable ; une décision « facturable » est annulée si une anomalie apparaît ; deux réconciliations ne couvrent plus les mêmes sites sur la même période.
- Montants en francs guinéens sans décimales ; menus Budgets et Évaluation Neemba visibles pour les bons rôles.

## 2ad3c29 (2026-11-16) : centre des décisions et prévention HSE (D-068, PR #99)

- Centre des décisions : alertes et validations selon votre site, comparaison de périodes, export.
- Prévention HSE : plans de prévention (signés par une autre personne que leurs rédacteurs), inspections, équipements de protection.

## 64e0961 (2026-11-16) : menu carburant (PR #98)

- « Pleins et cuves » devient « Distribution aux engins », « Stocks et cuves » devient « Réceptions, cuves et inventaires ».
- Bandeau du parcours d'un litre en six étapes en tête de chaque écran carburant.

## a909074 (2026-11-16) : organisation et délégations (D-064, PR #97)

- Affectations de sites, délégations temporaires de droits, journal des connexions.
- Séparation des tâches étendue aux délégations : on ne valide pas ce qu'a saisi la personne à qui l'on a délégué.

## Purge de la démonstration (2026-11-16, D-076)

- Les données de démonstration ont été supprimées et le bandeau retiré : la plateforme est vide et prête pour la première saisie réelle. Les comptes existants sont conservés.

## 3bbfded (2026-11-16) : clauses, budgets, export comptable et évaluation Neemba (D-065, PR #90)

- Contrats : clauses calculées (pénalités, bonus) proposées à partir des rapports de performance remis, appliquées par facture ou avoir, renonciation contrôlée par une seconde personne.
- Un avoir ne peut plus dépasser le reste de la facture.
- Budgets par site et suivi engagé / dépensé ; export comptable ; évaluation périodique de Neemba.

## 3dc77d4 (2026-11-16) : dispatch, voyages et infractions (D-066, PR #88)

- Dispatch : affectation de plusieurs voyages en une fois (chaque ligne acceptée ou refusée avec sa raison), enchaînement du voyage suivant d'un camion livré, avertissement quand le chauffeur fait l'objet d'une sanction de conduite active.
- Voyages : durées par étape, statistiques des trajets, rapport des voyages, selon votre site.
- Chauffeurs : registre des infractions et décisions de sanction, numérotées et journalisées.

## 4eb12e6 (2026-11-16) : cloisonnement par site renforcé (D-075, PR #87)

- Un utilisateur affecté à un site ne voit plus les événements de voyage, tickets CBG, immobilisations, pointages, objectifs, livraisons et stocks de carburant ni les positions GPS des autres sites ; un ticket reste visible du site de départ comme du site d'arrivée.
- Le dispatch refuse le camion, l'engin ou le chauffeur d'un autre site.
- Les positions GPS ne peuvent plus être saisies depuis le navigateur : elles viennent seulement des boîtiers.

## 75d94bf (2026-11-16) : purge de la démonstration (D-074, PR #85)

- La purge des données de démonstration suit désormais les liens entre tables : elle retire aussi ce qui a été créé sur la démonstration dans l'interface (voyages préparés, fiches, postes, objectifs de test), et s'arrête en listant toute donnée réelle qui y serait rattachée.
- `demo.sh apercu` montre ce qui serait supprimé, sans rien modifier ; la purge exige la confirmation du nombre de lignes affiché. La purge réelle reste une décision du propriétaire.

## bbf795a (2026-11-16) : planification avancée (D-063, PR #84)

- Planification : ventilation d'un objectif par destination et par contrat, simulation des besoins en camions à partir des durées de cycle observées, clôture de la journée avec causes d'écart, rapport de production, comparaison des shifts.
- La clôture exige une cause dès que le réalisé est sous l'objectif, ou qu'un objectif a été annulé ou révisé à la baisse ; la séparation des tâches est réglable (`planification_cloture_separee`).
- Chaque utilisateur ne voit que les objectifs et simulations de son site.

## 833e253 (2026-11-16) : tables héritées archivées (D-071, PR #83)

- 38 tables héritées de l'outil d'origine, vides et sans usage, sont archivées (réversible) ; les 9 tables encore lues (capteurs, trajets, géorepérage, actions rapides, déchets) ont des règles d'accès explicites par site.
- La clé d'authentification des boîtiers IoT n'est plus lisible depuis le navigateur.

## 16f149e (2026-11-16) : corrections de sécurité et d'intégrité (D-072, D-073, PR #79 à #81)

- Revue indépendante a posteriori des lots D-041 à D-062 : une quinzaine de défauts majeurs corrigés. Lectures et saisies bornées au site (carburant, stocks, relevés CBG, ordres de travail, rapports figés) ; fonctions internes plus appelables depuis le navigateur ; suppression et vidage de tables retirés aux comptes.
- Achats et paiements : l'approbateur d'un bon ne peut pas en être l'auteur ; un bon issu d'une consultation reprend exactement l'offre retenue ; paiement revérifié au moment de la décision et de l'exécution.
- Exploitation : habilitations du chauffeur contrôlées à toute affectation à un voyage ; une immobilisation avec intervention Neemba en cours ne s'annule ni ne se clôture sans validation de la remise en service ; une fermeture de site planifiée peut être levée avant son début ; relève de chauffeurs possible sur un même camion.
- Indicateurs : une immobilisation annulée n'est plus comptée ouverte ; un domaine non lisible est affiché « Non visible avec vos droits de lecture » au lieu de 0.
- Restauration des sauvegardes : les droits d'accès sont désormais restaurés à l'identique (auparavant, une restauration rouvrait les fonctions internes).
- Erreurs TypeScript à 0.

## 5ef4ab6 (2026-11-18) : écrans hérités corrigés (D-061, PR #76)

- Ordres de travail : numéro attribué par le serveur, annulation motivée, pièces sorties du registre des stocks (plus de second inventaire).
- Maintenance préventive, présences, recherche globale et géorepérage réécrits sur les colonnes réelles ; plus de suppression ni de valeur par défaut inventée.
- Paramètres : seuls les réglages réellement lus par le serveur, avec leur effet ; les réglages de séparation des tâches, de tolérance CBG et des fournisseurs deviennent réglables.

## f59a4b0 (2026-11-18) : rapports et coûts directs (D-058, PR #75)

- Rapports : journalier, de shift, mensuel avec tableau jour par jour, loueur (Neemba) et client (CBG), calculés par le serveur sur les données réelles, selon vos droits et votre site. Une donnée absente ou hors droits est signalée, jamais remplacée par 0.
- Export CSV et impression ; un rapport peut être figé et numéroté (RAP).
- Coûts : « Nouvelle dépense » enregistre réellement la dépense (devise obligatoire) ; une dépense s'annule avec motif ; totaux par devise.

## eca55e3 (2026-11-18) : fournisseurs (D-059, PR #74)

- Fournisseurs : répertoire et fiche détaillée (contacts, catégories, documents administratifs avec alerte d'échéance, évaluations, historique des commandes et des paiements, journal) ; aucune suppression physique.
- Évaluation périodique sur une grille pondérée définie par l'administrateur ; suspension et réactivation motivées : un fournisseur suspendu ne reçoit plus de bon de commande.
- Consultations de prix : offres de plusieurs fournisseurs, comparaison, sélection motivée qui prépare le bon de commande brouillon.

## 24dd140 (2026-11-18) : flotte (D-062, PR #73)

- Registre des véhicules réécrit : propriété (KOGON, loué, sous-traitant ; « non renseignée » tant qu'elle n'est pas saisie), loueur, exploitant, transporteur, contrat de location et statut opérationnel calculé.
- Fiche d'engin consolidée (immobilisations, interventions Neemba, pneus, pleins, contrôles) ; suspension, remise en service et réforme motivées et journalisées. Un engin suspendu est indisponible au dispatch.
- Alertes des documents de véhicule expirés ou expirant sous 30 jours ; archivage au lieu de la suppression.
- Plein isolé enregistré par le serveur ; le choix d'une cuve suivie crée la sortie à valider au registre carburant.

## f79e708 (2026-11-18) : moyens généraux et patrimoine (D-060, PR #72)

- Stocks & Achats > Moyens généraux et patrimoine : registre des biens (matériel, mobilier, équipements, outillage, véhicules administratifs) et fiche avec tout l'historique.
- Affectation, remise, restitution, transfert entre sites, constat d'état, réparation, réforme motivée ; la dernière opération s'annule avec motif.
- Inventaire physique par site : manquants, biens d'un autre site, réformés retrouvés, non référencés ; le registre n'est jamais corrigé automatiquement.
- Amortissement linéaire seulement si la valeur, la date d'acquisition et la durée sont saisies.

## 9cf47cf (2026-11-17) : centre de pilotage (D-057, PR #70)

- Centre de pilotage : indicateurs de production, tickets, flotte, carburant, maintenance, HSE, achats et finance, filtrés par période et site.
- Chaque indicateur affiche sa source, sa fiabilité (mesuré, partiel, sans données), sa période et son heure de calcul ; export CSV.

## debf876 (2026-11-17) : mes validations et notifications (D-056, PR #68)

- Mes validations : tout ce qui attend votre décision (bons de commande, paiements, carburant, postes, interventions Neemba, écarts CBG, factures à signer, actions en retard), selon vos droits ; compteur dans la barre supérieure.
- Notifications personnelles quand une décision vous concerne (bon ou paiement approuvé ou rejeté, anomalie au contrôle, clôture de poste validée).

## 48d2cf0 (2026-11-17) : paiements fournisseurs (D-055, PR #67)

- Contrats & Finance > Paiements fournisseurs : pièces payables (factures Neemba contrôlées, bons de commande reçus) avec reste à payer.
- Bon à payer plafonné au reste, approuvé par une autre personne, puis paiement exécuté saisi avec sa référence bancaire.
- Contrôle a posteriori par une troisième personne. SIGTB ne déclenche aucun paiement.

## 04140d7 (2026-11-17) : HSE (D-054, PR #66)

- RH & Sécurité > Contrôles avant départ : liste de points fixée par l'administrateur, résultat calculé (conforme, avec réserves, non conforme).
- Quand l'administrateur l'exige, un camion ne part pas au chargement sans contrôle du jour, ni après un contrôle non conforme.
- Incidents réécrits : déclaration numérotée, analyse de la cause, actions correctives suivies (retards signalés), clôture.

## 7f11af4 (2026-11-17) : circuit achat (D-053, PR #65)

- Achats : bon de commande en brouillon, soumis, puis approuvé ou rejeté (avec motif) par une autre personne que le demandeur.
- Réception partielle ou totale par le magasin : quantités reçues et refusées (motif), entrée automatique en stock au prix de la commande.
- Une réception erronée s'annule avec motif : le stock est corrigé. Un bon partiellement reçu peut être soldé.

## 165d2ea (2026-11-16) : cycle de vie des pneus (D-052, PR #64)

- Pneus : registre réécrit ; chaque pneu a son historique (entrée, montage, permutation, inspection, démontage, réparation, rechapage, réforme).
- Un seul pneu par position d'un engin ; une erreur se corrige en annulant la dernière opération, avec motif.
- Km parcourus et coût au km affichés seulement quand les compteurs et le prix sont saisis.
- Alertes de profondeur et d'inspection selon les seuils fixés par l'administrateur.

## 2d5c3cb (2026-11-16) : habilitations des chauffeurs (D-051, PR #63)

- Flotte > Habilitations chauffeurs : visites médicales, formations, habilitations engins, accès sites, avec échéances ; révocation motivée.
- Alertes des habilitations expirées ou expirant sous 30 jours.
- L'administrateur choisit les habilitations exigées : le dispatch refuse alors un chauffeur non habilité.

## 6b55549 (2026-11-16) : tickets et relevés CBG (D-050, PR #62)

- Exploitation > Tickets CBG : import du relevé CBG en CSV, conservé tel que reçu.
- Rapprochement ticket par ticket : écart de poids, autre camion, autre date, ticket inconnu, ticket absent du relevé ; décision motivée (accepté ou litige) sur chaque anomalie.
- Liste des voyages livrés sans ticket et registre des tickets intégrés.

## b2d81d8 (2026-11-16) : interventions Neemba (D-049, PR #61)

- Maintenance > Interventions Neemba : demande d'intervention depuis une immobilisation (canal, référence, délai contractuel), prise en charge, fin avec rapport et pièces.
- Délai de prise en charge affiché ; dépassement du délai contractuel signalé.
- Remise en service validée par une autre personne : l'immobilisation se clôt et l'engin redevient disponible.

## db7709c (2026-11-15) : postes de travail (D-048, PR #60)

- Exploitation > Postes de travail : ouverture d'un poste par shift et par site, avec les consignes du poste précédent.
- Équipe et présence (retard, absence motivée), journal des événements du poste.
- Clôture avec consignes pour le poste suivant et bilan figé (objectif, livré, voyages, présences) ; validation par une autre personne ; rapport imprimable.

## d11cf3c (2026-11-15) : infrastructures et fermetures de site (D-047, PR #59)

- Exploitation > Infrastructures et fermetures : points de chargement, dépôts, ponts-bascules, stations, ateliers, avec leur capacité.
- Fermeture temporaire d'un site, motivée et levée avec motif ; le dispatch refuse les affectations vers ou depuis un site fermé.

## c1f4bfe (2026-11-15) : périmètre site étendu (D-046, PR #58)

- Un administrateur affecté à un site ne voit plus les données des autres sites.
- Pleins, maintenance, pneus, documents, incidents, pesées et alertes suivent le périmètre du site.

## d34b10c (2026-11-15) : double authentification (D-045, PR #57)

- Menu du profil > Sécurité du compte : activer la double authentification avec une application (Google Authenticator, Microsoft Authenticator, Authy).
- À la connexion, le code à 6 chiffres est demandé aux comptes qui l'ont activée.
- L'administrateur peut ensuite exiger la double authentification pour les opérations sensibles (droits, rectification de ticket, signature de facture).

## 7abf1b6 (2026-11-15) : stocks magasin (D-044, PR #56)

- Quantités par article et par dépôt calculées depuis les mouvements ; plus aucune quantité saisie à la main.
- Entrées, sorties (bornées au stock disponible), transferts, retours, inventaires motivés, annulation par contre-mouvement.

## 6e88e61 (2026-11-15) : kilométrage des voyages (D-043, PR #55)

- Écran Exploitation > Kilométrage : relevés d'odomètre par voyage (départ chargé, arrivée dépôt, fin de rotation), corrections motivées, distance mesurée, distance de référence.
- Distance validée par une autre personne ; motif obligatoire si elle s'écarte de la mesure ou si la mesure manque.
- Contrôle des factures Neemba au km sur les seules distances validées ; règle du retour à vide à renseigner sur chaque tarif au km.

## 94ce255 (2026-11-15) : assainissement (D-042, PR #54)

- Plus de suppression d'enregistrements métier depuis l'application : annulation, désactivation, retrait ou clôture à la place.
- Bons de commande numérotés par le serveur ; écran achats sur les colonnes réelles.
- Portail client fabriqué et onglets pneus aux chiffres codés en dur retirés.

## 8144424 (2026-11-15) : registre carburant (D-041, PR #51)

- Stocks et cuves : le stock est calculé à partir des mouvements validés ; plus aucun solde saisi à la main.
- Réception d'une livraison CBG avec volume mesuré, volume accepté et motif d'écart.
- Transferts entre cuves et citernes, distributions depuis la fiche carburant, inventaires avec ajustement.
- Chaque saisie est validée par une autre personne ; une erreur se corrige par annulation (contre-mouvement).

## feda997 (constaté en production le 2026-11-15)

PR #45 à #50 : carburant livré par CBG et contrôle des factures (D-034), ticket de pesée CBG source et rectification auditée (D-037, remplace D-035), périmètre site en lecture et en écriture (D-038, D-039), socle MFA/AAL inactif par défaut (D-040).

## 921d583 (2026-11-12)

Droits par utilisateur (D-036), facturation par engin au kilomètre ou à l'heure (D-033).

## b833583 (2026-11-11)

Contrôle des factures Neemba sur les heures pointées et le tarif du contrat, notification d'écart, régularisations (D-032).

## 4132dfb (2026-11-11)

Engagements contre réalisé, rapport de performance, recouvrement et relances, comités, tableau de bord du chargé de contrats (D-031).

## af80816 (2026-11-11)

Remise à niveau sur données réelles : ingestion IoT durcie, analyses carburant et flotte, suppression des maquettes (D-030).

## 50745b4, 16d6500, cda275a (2026-11-11)

Réconciliation mensuelle et factures CBG signées par le DG (D-029) ; fiches terrain (D-028) ; immobilisations (D-025) et dossier contractuel (D-026).

## 51db029, 32c1d89 (2026-11-10)

Planification (D-023), dispatch (D-024), cycle de voyage à 18 états (LOT 06).

## 0ded569 (2026-11-09)

Première mise en production : pile Supabase auto-hébergée, base de référence (D-017), sécurité Tranche 0 et matrice des rôles (D-012).

# Matrice de cohérence documentaire SIGTB

Version SIGTB documentée : `origin/main` 1896cde (2026-11-17). Production constatée : release 31f7267 (journal de déploiement, `docs/SIGTB_MODULE_COVERAGE_MATRIX.md`, erratum du 2026-11-17). Date de rédaction : 2026-11-17 (`date -u`). Mission D-092, phase 1 (textes sans captures).

Chaque fonctionnalité du catalogue est confrontée à sa page, à sa capture prévue (phase 3), à sa procédure et à son test. Produite depuis le CSV du catalogue.

## 1. Matrice

| Module | Fonctionnalité | Page | Capture | Procédure | Test | Statut documentaire |
|---|---|---|---|---|---|---|
| Accès | Connexion par adresse et mot de passe | Page de connexion | Figure 2.1 | MGU 2.F.1 | E2E connexion | Documentée, capture à venir |
| Accès | Se souvenir de moi | Page de connexion | Figure 2.1 | MGU 2.F.1 | aucun test nommé | Documentée, capture à venir |
| Accès | Connexion Microsoft 365 | Page de connexion, bouton Microsoft | Figure 2.1 | MGU 2.H | aucun test nommé | Documentée comme désactivée |
| Accès | Mot de passe oublié par courriel | Page de connexion, lien Mot de passe oublié | Figure 2.2 | MGU 2.F.4 | aucun test nommé | Non documentable (non opérationnelle) |
| Accès | Changer son propre mot de passe | Sécurité du compte | Figure 2.4 | MGU 35 | aucun test nommé | Non documentable (non opérationnelle) |
| Accès | Double authentification TOTP (inscription, retrait, code a la connexion) | Sécurité du compte (#/securite-compte), menu profil | Figure 2.4 | MGU 2.F.3 | pgTAP 24 ; E2E double-authentification | Documentée, capture à venir |
| Accès | Exigence MFA pour opérations sensibles (mfa_exige) | Sécurité du compte | Figure 2.4 | MAD 13 | pgTAP 24 | Documentée comme désactivée |
| Accès | Déconnexion | Barre supérieure, menu profil, Se déconnecter | Figure 2.5 | MGU 2.F.2 | E2E connexion | Documentée, capture à venir |
| Accès | Langue de l'interface français ou anglais | Menu profil, Langue | Figure 2.5 | MGU 3.D | aucun test nommé | Documentée, capture à venir |
| Interface | Menu latéral filtre par droits de lecture | Menu latéral | Figure 3.1 | MGU 3.D | E2E droits-utilisateurs | Documentée, capture à venir |
| Interface | Sélecteur de site du menu (filtre d'affichage) | Menu latéral | Figure 3.1 | MGU 3.D | E2E perimetre-site | Documentée, capture à venir |
| Interface | Recherche globale (Ctrl+K) | Menu latéral, Rechercher | Figure 3.2 | MGU 3.F.1 | vitest recherche | Documentée, capture à venir |
| Interface | Compteur Mes validations et compteur d'alertes | Barre supérieure | Figure 3.3 | MGU 3.D | E2E mes-validations, decisions-hse | Documentée, capture à venir |
| Interface | Indicateur du shift en cours | Barre supérieure | Figure 3.3 | MGU 3.D | E2E dispatch-control-center | Documentée, capture à venir |
| Interface | Pages standard liste, fiche, formulaire, action (adresse #/vue/id) | Modules convertis | Figure 3.4 | MGU 3.F.2 | E2E pages-standard ; vitest liste, routeur | Documentée, capture à venir |
| Interface | Export CSV des listes standard | Pages liste converties | Figure 3.4 | MGU 3.F.3 | E2E pages-standard | Documentée, capture à venir |
| Interface | Onglet Historique des fiches | Pages détail converties | Figure 3.5 | MGU 3.D | aucun test nommé | Documentée, capture à venir |
| Interface | Pièces jointes PDF, JPEG, PNG, WebP (CSV, XLSX pour relevé CBG), 10 Mio | Voyage, ticket CBG, relevé compteur, relevé CBG, livraison carburant CBG | Figure 3.6 | MGU 3.F.4 | pgTAP 64 ; E2E pieces-jointes | Documentée, capture à venir |
| Interface | Fonctionnement hors ligne | Indicateur hors ligne | - | MGU 3.H | aucun test nommé | Non documentable (non opérationnelle) |
| Interface | Actions rapides | Route #/quick-actions sans entrée de menu | - | - | aucun test nommé | Documentée, sans capture prévue |
| Pilotage | Tableau de bord (indicateurs avec source, période, fiabilité, heure) | Tableau de bord | Figure 4.1 | MGU 4.F.1 | pgTAP 40 ; E2E tableau-de-bord | Documentée, capture à venir |
| Pilotage | Centre de pilotage (filtres site, shift, véhicule, partenaire, comparaison de périodes, export CSV, impression) | Centre de pilotage | Figure 4.2 | MGU 4.F.2 | pgTAP 40, 51 ; E2E centre-pilotage | Documentée, capture à venir |
| Pilotage | Mes validations (liste calculée des décisions en attente) | Mes validations | Figure 5.1 | MGU 5.F.1 | pgTAP 39 ; E2E mes-validations | Documentée, capture à venir |
| Pilotage | Notifications personnelles et marquage lu | Mes validations | Figure 5.2 | MGU 5.F.2 | pgTAP 39 | Documentée, capture à venir |
| Pilotage | Centre des décisions (alertes et décisions par priorité) | Exploitation > Centre des décisions | Figure 6.1 | MGU 6.F.1 | pgTAP 51 ; E2E decisions-hse | Documentée, capture à venir |
| Pilotage | Prendre en compte, résoudre une alerte (motif) | Centre des décisions | Figure 6.2 | MGU 6.F.2 | pgTAP 51 | Documentée, capture à venir |
| Sites | Liste et fiche des sites | Exploitation > Sites (#/sites) | Figure 7.1 | MGU 7.F.1 | E2E saisie-referentiels, organisation | Documentée, capture à venir |
| Sites | Créer, modifier un site | #/sites/nouveau, #/sites/id/modifier | Figure 7.2 | MGU 7.F.2 | pgTAP 60 ; E2E saisie-referentiels | Documentée, capture à venir |
| Sites | Désactiver, réactiver un site | Fiche du site | Figure 7.3 | MGU 7.F.3 | aucun test nommé | Documentée, capture à venir |
| Sites | Infrastructures du site (points de chargement, dépôts, pont-bascule, etc.) | Exploitation > Infrastructures et fermetures | Figure 7.4 | MGU 7.F.4 | pgTAP 30 ; E2E infrastructures | Documentée, capture à venir |
| Sites | Fermeture de site ou d'infrastructure, levée anticipée motivée | Infrastructures et fermetures | Figure 7.5 | MGU 7.F.5 | pgTAP 30 ; E2E infrastructures | Documentée, capture à venir |
| Shifts | Définir un shift (création, modification motivée, nuit) | Exploitation > Shifts | Figure 8.1 | MGU 8.F.1 | pgTAP 61 ; E2E defauts-bloquants | Documentée, capture à venir |
| Shifts | Désactiver un shift (motif) et journal | Exploitation > Shifts | Figure 8.2 | MGU 8.F.2 | pgTAP 61 | Documentée, capture à venir |
| Planification | Définir, réviser (version motivée), annuler un objectif | Planification (#/planification), Objectifs du jour | Figure 9.1 | MGU 9.F.1 | pgTAP 10, 61 ; E2E planification | Documentée, capture à venir |
| Planification | Registre des objectifs | Planification, Registre des objectifs | Figure 9.2 | MGU 9.D | E2E planification-avancee | Documentée, capture à venir |
| Planification | Ventiler un objectif par destination ou contrat | Planification | Figure 9.3 | MGU 9.F.2 | pgTAP 46 | Documentée, capture à venir |
| Planification | Simulation et rattrapage (lecture seule) | Planification, Simulation et rattrapage | Figure 9.4 | MGU 9.F.3 | pgTAP 46 | Documentée, capture à venir |
| Planification | Clôture de la journée, annulation de clôture, rapport de production | Planification, Clôture et rapport | Figure 9.5 | MGU 9.F.4 | pgTAP 46 | Documentée, capture à venir |
| Planification | Comparaison des shifts | Planification, Comparaison des shifts | Figure 9.6 | MGU 9.D | pgTAP 46 | Documentée, capture à venir |
| Postes | Ouvrir un poste, composer l'equipe, pointer la présence | Postes de travail (#/postes) | Figure 10.1 | MGU 10.F.1 | pgTAP 31 ; E2E postes | Documentée, capture à venir |
| Postes | Consigner un événement de poste | Fiche du poste | Figure 10.2 | MGU 10.F.2 | pgTAP 31 | Documentée, capture à venir |
| Postes | Clôturer un poste et valider la clôture (autre personne) | Fiche du poste | Figure 10.3 | MGU 10.F.3 | pgTAP 31, 65 | Documentée, capture à venir |
| Postes | Annuler un poste ou retirer un membre | Fiche du poste | Figure 10.3 | MGU 10.H | aucun test nommé | Documentée, capture à venir |
| Dispatch | Shift et préparation : planifier l'instance, besoin calculé, confirmer le plan | Dispatch, onglet Shift et préparation | Figure 11.1 | MGU 11.F.1 | pgTAP 65 ; E2E dispatch-control-center | Documentée, capture à venir |
| Dispatch | Recommandation d'affectation expliquée | Dispatch, onglet Affectations | Figure 11.2 | MGU 11.F.2 | pgTAP 11 ; vitest recommandation, controle | Documentée, capture à venir |
| Dispatch | Affecter un voyage (accepter, modifier, refuser, motif) | Dispatch, Affectations | Figure 11.3 | MGU 11.F.2 | pgTAP 11, 49, 65 ; E2E dispatch | Documentée, capture à venir |
| Dispatch | Affectation groupée et rapport | Dispatch, Affectations | Figure 11.4 | MGU 11.F.3 | pgTAP 49 ; E2E dispatch-voyages | Documentée, capture à venir |
| Dispatch | Suspendre et reprendre un voyage | Dispatch, fiche du voyage | Figure 11.5 | MGU 11.F.4 | pgTAP 65 | Documentée, capture à venir |
| Dispatch | Voyages par état | Dispatch, Voyages par état | Figure 11.6 | MGU 11.D | E2E dispatch-control-center | Documentée, capture à venir |
| Dispatch | Supervision et indicateurs du dispatch | Dispatch, Supervision | Figure 11.7 | MGU 11.D | pgTAP 65 | Documentée, capture à venir |
| Dispatch | Journal des décisions | Dispatch, Journal | Figure 11.8 | MGU 11.D | pgTAP 11 | Documentée, capture à venir |
| Dispatch | Simulation de scénarios | Dispatch | Figure 11.9 | MGU 11.F.5 | pgTAP 49 ; vitest simulation | Documentée, capture à venir |
| Dispatch | Clôturer le shift avec voyages non terminés (motif) | Dispatch, Shift | Figure 11.1 | MGU 11.F.6 | pgTAP 65 | Documentée, capture à venir |
| Dispatch | Carte des positions, files d'attente, optimisation par distance | Dispatch | - | MGU 35 | aucun test nommé | Non documentable (non opérationnelle) |
| Voyages | Registre des voyages (filtres, contexte d'adresse) | Voyages et Rotations (#/trips) | Figure 12.1 | MGU 12.D | E2E voyages, operations-transport | Documentée, capture à venir |
| Voyages | Créer un voyage (référence VYG-AAMMJJ-NNN) | Voyages et Rotations, Créer le voyage | Figure 12.2 | MGU 12.F.1 | pgTAP 09 ; E2E voyages | Documentée, capture à venir |
| Voyages | Avancer le cycle du voyage (étapes, heures, pesée) | Fiche voyage, fenêtre de saisie | Figure 12.3 | MGU 12.F.2 | pgTAP 09 ; E2E voyages | Documentée, capture à venir |
| Voyages | Fiche opérationnelle du voyage (synthèse, affectations, étapes, chronologie, fiches, tickets, documents, incidents, anomalies, contrôles, historique) | #/trips/id | Figure 12.4 | MGU 12.F.3 | pgTAP 66 ; E2E operations-transport | Documentée, capture à venir |
| Voyages | Vérifier, valider ou contester un événement déclaré | Fiche voyage, action Vérifier | Figure 12.5 | MGU 12.F.4 | pgTAP 66 | Documentée, capture à venir |
| Voyages | Rattacher un ticket CBG remis après livraison (motif) | Fiche voyage | Figure 12.6 | MGU 12.F.5 | pgTAP 61 | Documentée, capture à venir |
| Voyages | Enchaîner le voyage suivant | Fiche d'un voyage livré | Figure 12.7 | MGU 12.F.6 | pgTAP 49 ; E2E dispatch-voyages | Documentée, capture à venir |
| Voyages | Déclarer un incident depuis le voyage | Fiche voyage | Figure 12.8 | MGU 30.F.3 | pgTAP 37, 49 | Documentée, capture à venir |
| Voyages | Rapports par axe (camion, chauffeur, site, shift) et export CSV | Voyages et Rotations, Rapports par axe | Figure 12.9 | MGU 12.F.7 | pgTAP 49 | Documentée, capture à venir |
| Voyages | Événement correctif d'un voyage (corriger une étape saisie) | Fiche voyage | - | MGU 35 | aucun test nommé | Non documentable (non opérationnelle) |
| Kilométrage | Distances de référence site a site | Kilométrage | Figure 13.1 | MGU 13.F.1 | pgTAP 27 ; E2E kilometrage | Documentée, capture à venir |
| Kilométrage | Saisir et corriger un relevé de compteur (motif) | Kilométrage | Figure 13.2 | MGU 13.F.2 | pgTAP 27 | Documentée, capture à venir |
| Kilométrage | Valider la distance d'un voyage (autre personne) | Kilométrage | Figure 13.3 | MGU 13.F.3 | pgTAP 27 | Documentée, capture à venir |
| Fiches terrain | Préparer les fiches FR, FP, FC d'un shift | Fiches terrain (#/fiches) | Figure 14.1 | MGU 14.F.1 | pgTAP 14, 71 ; E2E fiches | Documentée, capture à venir |
| Fiches terrain | Imprimer les fiches A4 (réimpression motivée) | Fiches terrain, fiche | Figure 14.2 | MGU 14.F.2 | pgTAP 71 | Documentée, capture à venir |
| Fiches terrain | Remettre a l'agent et enregistrer le retour | Fiche terrain #/fiches/id | Figure 14.3 | MGU 14.F.3 | pgTAP 71 ; E2E operations-transport | Documentée, capture à venir |
| Fiches terrain | Saisir une fiche FR (rotations, ticket CBG en tonnes) | Fiches terrain, Saisir | Figure 14.4 | MGU 14.F.4 | pgTAP 14, 61, 71 ; E2E fiches | Documentée, capture à venir |
| Fiches terrain | Saisir une fiche FP (horamètres, arrêts) | Fiches terrain, Saisir | Figure 14.5 | MGU 14.F.5 | pgTAP 14 | Documentée, capture à venir |
| Fiches terrain | Saisir une fiche FC (pleins) | Fiches terrain, Saisir | Figure 14.6 | MGU 14.F.6 | pgTAP 14, 25 | Documentée, capture à venir |
| Fiches terrain | Terminer la saisie, soumettre au contrôle | Fiche terrain | Figure 14.7 | MGU 14.F.7 | pgTAP 71 | Documentée, capture à venir |
| Fiches terrain | Contrôler, renvoyer en correction, valider (autre personne), archiver | Fiche terrain | Figure 14.8 | MGU 14.F.8 | pgTAP 71 ; vitest cycleFiche | Documentée, capture à venir |
| Fiches terrain | Annuler une fiche (motif) | Fiche terrain | Figure 14.9 | MGU 14.F.9 | pgTAP 14, 71 | Documentée, capture à venir |
| Fiches terrain | Lots de fiches, attribution, brouillon serveur | Fiches terrain | - | MGU 35 | aucun test nommé | Documentée, sans capture prévue |
| Pesée CBG | A. Importer un relevé officiel CBG (CSV, empreinte, aperçu) | Pesée CBG, espace A (#/tickets-cbg) | Figure 15.1 | MGU 15.F.1 | pgTAP 33, 62 ; E2E tickets-cbg | Documentée, capture à venir |
| Pesée CBG | Annuler un relevé CBG (motif, autre personne, droit facturation) | Espace A | Figure 15.2 | MGU 15.F.2 | pgTAP 62 | Documentée, capture à venir |
| Pesée CBG | B. Fiche terrain KOGON (relevé observé, brouillon local, correction motivée) | Espace B | Figure 15.3 | MGU 15.F.3 | pgTAP 62 ; E2E tickets-cbg | Documentée, capture à venir |
| Pesée CBG | C. Rapprochement CBG et KOGON, tolérance versionnée | Espace C | Figure 15.4 | MGU 15.F.4 | pgTAP 62 | Documentée, capture à venir |
| Pesée CBG | D. Anomalies : examiner, conclure, soumettre, clôturer ou renvoyer | Espace D | Figure 15.5 | MGU 15.F.5 | pgTAP 62, 63 | Documentée, capture à venir |
| Pesée CBG | Rectifier un ticket CBG (motif, autre personne) | Réconciliation, ligne | Figure 15.6 | MGU 15.F.6 | pgTAP 15 | Documentée, capture à venir |
| Pesée CBG | Liste des voyages livrés sans ticket | Pesée CBG | Figure 15.7 | MGU 15.D | pgTAP 61 | Documentée, capture à venir |
| Pesée CBG | Pièces jointes du relevé CBG (CSV, XLSX, PDF, images) | Espace A | Figure 15.1 | MGU 3.F.4 | pgTAP 64 | Documentée, capture à venir |
| Opérations transport | Vue générale | Opérations transport > Vue générale | Figure 16.1 | MGU 16.D | E2E operations-transport | Documentée, capture à venir |
| Opérations transport | Journal des événements (v_journal_voyage) | Opérations transport > Journal des événements | Figure 16.2 | MGU 16.F.1 | pgTAP 66 ; vitest journal | Documentée, capture à venir |
| Opérations transport | Anomalies et écarts | Opérations transport > Anomalies et écarts | Figure 16.3 | MGU 16.F.2 | pgTAP 66 | Documentée, capture à venir |
| Opérations transport | Contrôles et clôtures | Opérations transport > Contrôles et clôtures | Figure 16.4 | MGU 16.F.3 | pgTAP 66 | Documentée, capture à venir |
| Opérations transport | Alias vers Planification, Postes, Dispatch, Registre, Fiches, Pesée, Supervision | Opérations transport | Figure 16.1 | MGU 16.D | E2E operations-transport | Documentée, capture à venir |
| Flotte | Liste et fiche des engins | Flotte > Véhicules et engins (#/vehicles) | Figure 17.1 | MGU 17.F.1 | pgTAP 45 ; E2E flotte | Documentée, capture à venir |
| Flotte | Créer, modifier un engin | #/vehicles/nouveau | Figure 17.2 | MGU 17.F.2 | pgTAP 45 | Documentée, capture à venir |
| Flotte | Propriété et rattachement au contrat de location | Fiche engin | Figure 17.3 | MGU 17.F.3 | pgTAP 45 | Documentée, capture à venir |
| Flotte | Suspendre, remettre en service, réformer un engin (motif) | Fiche engin | Figure 17.4 | MGU 17.F.4 | pgTAP 45 | Documentée, capture à venir |
| Chauffeurs | Liste et fiche des chauffeurs | Flotte > Chauffeurs (#/drivers) | Figure 18.1 | MGU 18.F.1 | E2E defauts-bloquants, pages-standard | Documentée, capture à venir |
| Chauffeurs | Créer, modifier un chauffeur | #/drivers/nouveau | Figure 18.2 | MGU 18.F.2 | E2E defauts-bloquants | Documentée, capture à venir |
| Chauffeurs | Suspendre, réactiver, archiver un chauffeur | Fiche chauffeur | Figure 18.3 | MGU 18.F.3 | aucun test nommé | Documentée, capture à venir |
| Chauffeurs | Habilitations (saisie, révocation motivée, types exigés) | Flotte > Habilitations chauffeurs | Figure 18.4 | MGU 18.F.4 | pgTAP 34 ; E2E habilitations | Documentée, capture à venir |
| Chauffeurs | Infractions et sanctions | Fiche chauffeur, Infractions | Figure 18.5 | MGU 18.F.5 | pgTAP 49 | Documentée, capture à venir |
| Documents | Documents des engins (assurance, carte grise, visite), alertes d'expiration, archivage | Flotte > Documents | Figure 19.1 | MGU 19.F.1 | pgTAP 45 | Documentée, capture à venir |
| Carburant | Distribution aux engins (plein isolé) | Carburant > Distribution aux engins | Figure 20.1 | MGU 20.F.1 | pgTAP 25 ; E2E stocks-carburant | Documentée, capture à venir |
| Carburant | Livraisons CBG, factures CBG et contrôle | Carburant > Livraisons et factures CBG | Figure 20.2 | MGU 20.F.2 | pgTAP 16, 25 | Documentée, capture à venir |
| Carburant | Cuves et citernes | Carburant > Réceptions, cuves et inventaires | Figure 20.3 | MGU 20.F.3 | pgTAP 25 | Documentée, capture à venir |
| Carburant | Réception d'une livraison en cuve (écart motivé) | Réceptions, cuves et inventaires | Figure 20.4 | MGU 20.F.4 | pgTAP 25, 52 | Documentée, capture à venir |
| Carburant | Transfert entre stockages | Réceptions, cuves et inventaires | Figure 20.5 | MGU 20.F.5 | pgTAP 25, 52 | Documentée, capture à venir |
| Carburant | Inventaire de cuve et décision (autre personne) | Réceptions, cuves et inventaires | Figure 20.6 | MGU 20.F.6 | pgTAP 25, 51 | Documentée, capture à venir |
| Carburant | Valider ou rejeter un mouvement, annuler un mouvement valide | Réceptions, cuves et inventaires | Figure 20.7 | MGU 20.F.7 | pgTAP 25, 52 | Documentée, capture à venir |
| Carburant | Analyse carburant (litres par tonne et par heure) | Carburant > Analyse carburant | Figure 20.8 | MGU 20.D | pgTAP 17 | Documentée, capture à venir |
| Carburant | Anomalies carburant (seuil saisi a l'ecran) | Carburant > Anomalies | Figure 20.9 | MGU 20.D | pgTAP 16 | Documentée, capture à venir |
| Carburant | Jauges connectées | Carburant > Jauges connectées | Figure 20.10 | MGU 33 | pgTAP 16 | Documentée comme écran sans données |
| Maintenance | Déclarer, clôturer, corriger, annuler une immobilisation | Maintenance > Immobilisations | Figure 21.1 | MGU 21.F.1 | pgTAP 12 ; E2E immobilisations | Documentée, capture à venir |
| Maintenance | Interventions Neemba (demande, prise en charge, fin, remise validée par autre personne) | Maintenance > Interventions Neemba | Figure 21.2 | MGU 21.F.2 | pgTAP 32 ; E2E interventions-loueur | Documentée, capture à venir |
| Maintenance | Ordres de travail (numéro serveur, pièces par mouvement de stock, annulation motivée) | Maintenance > Ordres de travail | Figure 21.3 | MGU 21.F.3 | pgTAP 44, 55 | Documentée, capture à venir |
| Maintenance | Préventif interne | Maintenance > Préventif | Figure 21.4 | MGU 21.F.4 | pgTAP 44 | Documentée, capture à venir |
| Pneus | Entrée en stock, montage, démontage, permutation, inspection, réparation, rechapage, réforme, annulation | Pneus | Figure 22.1 | MGU 22.F.1 | pgTAP 35, 50 ; E2E pneus | Documentée, capture à venir |
| Pneus | Pneus a surveiller et seuils | Pneus | Figure 22.2 | MGU 22.F.2 | pgTAP 35 | Documentée, capture à venir |
| Pneus | Performance par marque et modèle | Pneus, Performance | Figure 22.3 | MGU 22.D | pgTAP 50 | Documentée, capture à venir |
| Pneus | Cycle de vie complet (carcasse PN, episodes, contrôle des positions) D-091 | Pneus | - | MGU 35 | pgTAP 72 | Non documentable (non opérationnelle) |
| Stocks | Mouvements (entrée, sortie, transfert, retour), annulation motivée | Stocks & Achats > Stocks | Figure 23.1 | MGU 23.F.1 | pgTAP 28 ; E2E stocks-magasin | Documentée, capture à venir |
| Stocks | Articles et dépôts | Stocks | Figure 23.2 | MGU 23.F.2 | aucun test nommé | Documentée, capture à venir |
| Stocks | Inventaire d'article et de lot | Stocks | Figure 23.3 | MGU 23.F.3 | pgTAP 28, 50 | Documentée, capture à venir |
| Stocks | Réservations, lots et séries, valorisation CMP | Stocks, panneaux | Figure 23.4 | MGU 23.F.4 | pgTAP 50 ; E2E stocks-avances | Documentée, capture à venir |
| Achats | Bon de commande : rédiger, soumettre, approuver (autre personne), réceptionner, annuler, solder | Stocks & Achats > Achats | Figure 24.1 | MGU 24.F.1 | pgTAP 36, 55 ; E2E achats | Documentée, capture à venir |
| Achats | Réception de pneus depuis un bon | Achats, réception | Figure 24.2 | MGU 24.F.2 | pgTAP 50 | Documentée, capture à venir |
| Achats | Facture d'achat, rapprochement a trois voies, contrôle budgétaire | Achats | - | MGU 35 | aucun test nommé | Non documentable (non opérationnelle) |
| Fournisseurs | Répertoire, fiche, contacts, documents, catégories, suspension, réactivation | Stocks & Achats > Fournisseurs | Figure 25.1 | MGU 25.F.1 | pgTAP 42 ; E2E fournisseurs | Documentée, capture à venir |
| Fournisseurs | Évaluation des fournisseurs (critères pondérés) | Fiche fournisseur | Figure 25.2 | MGU 25.F.2 | pgTAP 42 | Documentée, capture à venir |
| Fournisseurs | Consultations, offres, sélection, bon issu de consultation | Fournisseurs, Consultations | Figure 25.3 | MGU 25.F.3 | pgTAP 42, 55 | Documentée, capture à venir |
| Moyens généraux | Registre des biens, affectation, transfert, restitution, réparation, réforme, annulation | Stocks & Achats > Moyens généraux et patrimoine | Figure 26.1 | MGU 26.F.1 | pgTAP 43 ; E2E moyens-generaux | Documentée, capture à venir |
| Moyens généraux | Inventaire physique par site | Moyens généraux | Figure 26.2 | MGU 26.F.2 | pgTAP 43 | Documentée, capture à venir |
| Contrats | Liste et fiche du contrat, création, modification | Contrats & Finance > Dossier contractuel (#/contrats) | Figure 27.1 | MGU 27.F.1 | pgTAP 13, 60 ; E2E contrats, saisie-referentiels | Documentée, capture à venir |
| Contrats | Versions et avenants, tarifs par engin, modification par avenant | Fiche du contrat | Figure 27.2 | MGU 27.F.2 | pgTAP 21, 60 | Documentée, capture à venir |
| Contrats | Suppression d'un élément de contrat brouillon (motif) | Fiche du contrat | Figure 27.2 | MGU 27.H | pgTAP 60 | Documentée, capture à venir |
| Contrats | Échéances (préavis, renouvellement, dénonciation) | Fiche du contrat | Figure 27.3 | MGU 27.F.3 | pgTAP 48 | Documentée, capture à venir |
| Contrats | Clauses chiffrées (calcul, décision, renonciation) | Fiche du contrat, Clauses | Figure 27.4 | MGU 27.F.4 | pgTAP 48 ; E2E contrats-finance | Documentée, capture à venir |
| Contrats | Engagements contre réalisé et rapport de performance | Contrats & Finance > Engagements et rapport | Figure 27.5 | MGU 27.F.5 | pgTAP 18 | Documentée, capture à venir |
| Contrats | Comités de contrat et actions | Contrats & Finance > Comités de contrat | Figure 27.6 | MGU 27.F.6 | pgTAP 18 | Documentée, capture à venir |
| Contrats | Mon tableau de bord (charge du charge de contrats) | Contrats & Finance > Mon tableau de bord | Figure 27.7 | MGU 27.D | pgTAP 18 | Documentée, capture à venir |
| Contrats | Évaluation de Neemba | Contrats & Finance > Évaluation Neemba | Figure 27.8 | MGU 27.F.7 | pgTAP 48 | Documentée, capture à venir |
| Contrats | Contrôle des factures Neemba (saisie, contrôle, notification, régularisation) | Contrats & Finance > Contrôle factures Neemba | Figure 27.9 | MGU 27.F.8 | pgTAP 19, 21, 61 ; E2E factures-neemba | Documentée, capture à venir |
| Facturation | Réconciliation mensuelle (ouvrir, actualiser, décider, clôturer) | Contrats & Finance > Réconciliation mensuelle (#/reconciliation) | Figure 28.1 | MGU 28.F.1 | pgTAP 15, 61, 62, 70 ; E2E facturation | Documentée, capture à venir |
| Facturation | Générer une facture CBG depuis une réconciliation clôturée | Contrats & Finance > Facturation (#/invoices) | Figure 28.2 | MGU 28.F.2 | pgTAP 15 ; E2E facturation | Documentée, capture à venir |
| Facturation | Soumettre, émettre, annuler une facture | Fiche facture | Figure 28.3 | MGU 28.F.3 | pgTAP 15 | Documentée, capture à venir |
| Facturation | Signer ou renvoyer une facture | Fiche facture | Figure 28.4 | MGU 28.F.4 | pgTAP 15, 24 | Documentée, capture à venir |
| Facturation | Avoir (montant, motif, même circuit) | Fiche facture | Figure 28.5 | MGU 28.F.5 | pgTAP 15, 48 | Documentée, capture à venir |
| Facturation | Facture imprimable A4 | Fiche facture | Figure 28.6 | MGU 28.F.3 | aucun test nommé | Documentée, capture à venir |
| Facturation | Recouvrement : créances, encaissement, relances niveaux 1 a 3 | Contrats & Finance > Recouvrement (#/recouvrement) | Figure 28.7 | MGU 28.F.6 | pgTAP 18 ; E2E suivi-recouvrement | Documentée, capture à venir |
| Finance | Paiements fournisseurs (proposer, approuver, exécuter, annuler, contrôler) | Contrats & Finance > Paiements fournisseurs | Figure 29.1 | MGU 29.F.1 | pgTAP 38 ; E2E paiements | Documentée, capture à venir |
| Finance | Budgets, suivi engagé et réalisé, dépenses a imputer | Contrats & Finance > Budgets et comptabilité | Figure 29.2 | MGU 29.F.2 | pgTAP 48, 63 ; E2E contrats-finance | Documentée, capture à venir |
| Finance | Référentiels comptables (natures, plan comptable, comptes de tiers) et export comptable CSV | Budgets et comptabilité | Figure 29.3 | MGU 29.F.3 | pgTAP 48 | Documentée, capture à venir |
| Finance | Coûts directs (enregistrer, annuler motivé, répartition) | Contrats & Finance > Coûts | Figure 29.4 | MGU 29.F.4 | pgTAP 41 ; E2E rapports | Documentée, capture à venir |
| HSE | Contrôle avant départ et points de contrôle | RH & Sécurité > Contrôles avant départ | Figure 30.1 | MGU 30.F.1 | pgTAP 37 ; E2E hse | Documentée, capture à venir |
| HSE | Exigence du contrôle avant départ (controle_depart_exige) | Contrôles avant départ, bouton Exiger | Figure 30.2 | MGU 30.F.2 | pgTAP 37 | Documentée comme désactivée |
| HSE | Incidents et actions correctives | RH & Sécurité > Incidents | Figure 30.3 | MGU 30.F.3 | pgTAP 37, 55 | Documentée, capture à venir |
| HSE | Prévention : EPI, registre des risques, plans de prévention, inspections | RH & Sécurité > Prévention HSE | Figure 30.4 | MGU 30.F.4 | pgTAP 51 ; E2E decisions-hse | Documentée, capture à venir |
| RH | Employés | RH & Sécurité > Employés | Figure 31.1 | MGU 31.F.1 | aucun test nommé | Documentée, capture à venir |
| RH | Présences (saisie, remplacement motivé, annulation) | RH & Sécurité > Présences | Figure 31.2 | MGU 31.F.2 | pgTAP 44 | Documentée, capture à venir |
| RH | Paie (calcul, approbation, paiement) | RH & Sécurité > Paie | Figure 31.3 | MGU 31.H | aucun test nommé | Documentée, capture à venir |
| Reporting | Rapports (client, loueur, shift, mensuel par jour, figer, export CSV, impression) | Reporting & Analyse > Rapports | Figure 32.1 | MGU 32.F.1 | pgTAP 41, 54 ; E2E rapports | Documentée, capture à venir |
| Reporting | Coût direct par tonne | Reporting & Analyse > Coût direct par tonne | Figure 32.2 | MGU 32.D | pgTAP 17 ; E2E analyses | Documentée, capture à venir |
| Reporting | Santé de la flotte | Reporting & Analyse > Santé de la flotte | Figure 32.3 | MGU 32.D | E2E analyses | Documentée, capture à venir |
| Reporting | Fiabilité des engins | Reporting & Analyse > Fiabilité des engins | Figure 32.4 | MGU 32.D | pgTAP 17 ; E2E analyses | Documentée, capture à venir |
| Reporting | Performance chauffeurs | Reporting & Analyse > Performance chauffeurs | Figure 32.5 | MGU 32.D | pgTAP 17 ; E2E analyses | Documentée, capture à venir |
| Suivi GPS | Suivi GPS, intelligence flotte, historique des trajets | Exploitation > Suivi GPS, Intelligence flotte, Historique des trajets | Figure 33.1 | MGU 33 | aucun test nommé | Documentée comme écran sans données |
| Suivi GPS | Géorepérage (zones cercle ou polygone, désactivation) | Exploitation > Géorepérage | Figure 33.2 | MGU 33 | aucun test nommé | Documentée, capture à venir |
| Suivi GPS | Capteurs IoT | Reporting & Analyse > Capteurs IoT | Figure 33.3 | MGU 33 | aucun test nommé | Documentée comme écran sans données |
| Suivi GPS | Environnement (ESG) | Reporting & Analyse > Environnement | Figure 33.4 | MGU 33 | aucun test nommé | Documentée comme écran sans données |
| Paramètres | Comptes : créer, modifier, rôle, site, désactiver, réactiver (motif) | Paramètres > Utilisateurs | Figure 34.1 | MAD 3 | pgTAP 60 ; E2E organisation, droits-utilisateurs | Documentée, capture à venir |
| Paramètres | Droits par utilisateur et par module (motif) | Paramètres > Utilisateurs, modification | Figure 34.2 | MAD 5 | pgTAP 20 ; E2E droits-utilisateurs | Documentée, capture à venir |
| Paramètres | Affectations multisites datées, retour au périmètre global | Paramètres > Affectations multisites | Figure 34.3 | MAD 6 | pgTAP 47 | Documentée, capture à venir |
| Paramètres | Délégations de droits (écriture ou approbation), révocation | Paramètres > Délégations, Sécurité du compte > Mes délégations | Figure 34.4 | MAD 7 | pgTAP 47, 59, 63 | Documentée, capture à venir |
| Paramètres | Journal de connexion et sessions ouvertes | Paramètres > Journal de connexion | Figure 34.5 | MAD 14 | pgTAP 47 | Documentée, capture à venir |
| Paramètres | Organisations | Paramètres > Organisations | Figure 34.6 | MAD 8 | pgTAP 47 | Documentée, capture à venir |
| Paramètres | Référentiels devises, unités, numérotations (lecture) | Paramètres > Référentiels et numérotation | Figure 34.7 | MAD 8 | pgTAP 47 | Documentée, capture à venir |
| Paramètres | Fiche société et réglages lus par le serveur | Paramètres > Général | Figure 34.8 | MAD 10 | aucun test nommé | Documentée, capture à venir |
| Portails | Portails Neemba, CBG, fournisseurs | - | - | MGU 35 | aucun test nommé | Non documentable (non opérationnelle) |
| Intelligence | Prévisions, détection d'anomalies, OCR, mobile hors ligne, voix, signature électronique | - | - | MGU 35 | aucun test nommé | Non documentable (non opérationnelle) |

## 2. Synthèse

| Statut documentaire | Nombre |
|---|---|
| Documentée, capture à venir | 159 |
| Documentée comme désactivée | 3 |
| Non documentable (non opérationnelle) | 9 |
| Documentée, sans capture prévue | 2 |
| Documentée comme écran sans données | 4 |

Fonctionnalités sans test nommé : 18 (hors non disponibles). Elles sont documentées avec leur limite ; aucune n'est présentée comme testée.

# SIGTB : glossaire

Version SIGTB documentée : `origin/main` 1896cde (2026-11-17). Date de rédaction : 2026-11-17 (`date -u`). Mission D-092, phase 1.

| Terme | Définition |
|---|---|
| aal1, aal2 | Niveau d'assurance de la session : aal1 mot de passe seul, aal2 confirmé par code TOTP. |
| Affectation (dispatch) | Décision qui attribue à un voyage un camion, un chauffeur et un engin de chargement. |
| Affectation multisite | Rattachement daté d'un compte à un site supplémentaire. |
| Alerte | Signal écrit par le serveur quand une règle du centre des décisions est vérifiée. |
| Annulation motivée | Correction qui neutralise une saisie en gardant l'original et le motif. |
| Anomalie de pesée | Constat du rapprochement entre le relevé CBG et le relevé KOGON, à examiner et décider. |
| Approbation | Droit de décider (bon de commande, paiement, sanction, plan de prévention), distinct de l'écriture. |
| Avenant | Nouvelle version d'un contrat, avec date d'effet. |
| Avoir | Document qui corrige une facture émise (numéro AV-AAAA-NNNN). |
| Base de tonnage | Tonnage retenu par la réconciliation : accepté, reçu ou chargé. |
| CBG | Client facturé ; effectue la pesée officielle au dépôt et livre le carburant. |
| Centre des décisions | Écran des alertes et décisions en attente, par priorité. |
| Clause chiffrée | Pénalité, bonus ou retenue d'un contrat conditionnée par un engagement mesuré. |
| Clôture | Acte qui fige un bilan (poste, journée de planification, réconciliation, incident). |
| CMP | Coût moyen pondéré, méthode de valorisation du stock. |
| Compte global | Compte sans site d'affectation, qui voit tous les sites. |
| Condition levée | État d'une alerte dont la cause a disparu, en attente de résolution humaine. |
| Contre-mouvement | Mouvement inverse qui annule un mouvement validé (carburant, stock). |
| Contrôle avant départ | Vérification des points de sécurité d'un camion avant son départ. |
| Délégation | Transfert temporaire et motivé d'un droit d'écriture ou d'approbation à un autre compte. |
| Dispatch | Préparation et affectation des voyages d'un shift. |
| Distance validée | Distance d'un voyage retenue par une décision humaine, base des km facturables. |
| Empreinte (SHA-256) | Signature d'un fichier qui empêche son import en double. |
| EPI | Équipement de protection individuelle. |
| Engagement | Seuil contractuel mesuré (disponibilité, temps de cycle, rotations...). |
| Fiche FC | Fiche terrain de distribution de carburant. |
| Fiche FP | Fiche terrain de pointage des engins (horamètres, arrêts). |
| Fiche FR | Fiche terrain des rotations d'un camion. |
| Fiche KOGON | Relevé, par l'agent KOGON, de la pesée CBG observée ; jamais un ticket officiel. |
| Fiabilité (indicateur) | Mesure, partielle ou sans données. |
| Imputation | Partie qui porte un arrêt : loueur, exploitant, à déterminer. |
| Immobilisation | Arrêt horodaté d'un engin, avec cause et imputation. |
| Instance de shift | Poste de travail d'un shift pour une date et un site. |
| Intervention Neemba | Prise en charge d'une immobilisation par le loueur : demandée, prise en charge, terminée, remise validée. |
| J1, J2, J3, J4 | Jalons : recette, coûts, pilotage, extensions. |
| KOGON | Kogon Mining SARL, exploitant du transport. |
| Neemba | Loueur des engins. |
| Périmètre de site | Ensemble des sites qu'un compte peut voir et modifier. |
| Pièce jointe | Fichier justificatif rattaché à un objet, annulable mais jamais supprimé. |
| Plan de shift | Nombre de voyages confirmé pour une instance, versionné. |
| Poste de travail | Voir instance de shift. |
| Rapprochement | Confrontation du relevé officiel CBG et des relevés KOGON. |
| Rapport figé | Instantané immuable d'un rapport. |
| Recommandation | Proposition calculée par SIGTB, jamais appliquée sans décision humaine. |
| Réconciliation | Mise en regard mensuelle des voyages livrés et du tonnage officiel, préalable à la facture. |
| Relevé CBG | Fichier périodique des pesées officielles fourni par CBG. |
| Remise en service | Validation du retour d'un engin après intervention, par une autre personne. |
| Reste à payer | Montant encore dû sur une pièce, calculé par le serveur. |
| RLS | Sécurité au niveau des lignes : règle de la base qui limite lecture et écriture. |
| Rotation | Rang d'un voyage dans le shift du camion. |
| Séparation des tâches | Règle qui interdit à l'auteur d'une saisie de la valider. |
| Shift | Plage horaire type, commune à tous les sites. |
| Statut documentaire | État de la documentation d'une fonctionnalité (matrice de cohérence). |
| Suspension | Arrêt tracé d'un voyage, levé par une reprise motivée. |
| Ticket CBG | Ticket de pesée officiel émis par CBG au dépôt. |
| Tolérance | Écart de poids admis (t et %), versionné par site. |
| TOTP | Code à usage unique d'une application d'authentification. |
| Version | État daté d'un objet (objectif, contrat, plan) ; la plus récente active fait foi. |
| Voyage | Objet central : un trajet chargé d'un camion, du chargement à la livraison (référence VYG-AAMMJJ-NNN). |

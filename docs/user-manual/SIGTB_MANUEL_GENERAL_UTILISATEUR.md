# SIGTB : manuel général de l'utilisateur

Version SIGTB documentée : `origin/main` 1896cde (2026-11-17). Production constatée : release 31f7267 ; les éléments fusionnés après cette release sont signalés « non déployé ». Date de rédaction : 2026-11-17 (`date -u`). Mission D-092, phase 1 : textes sans captures. Chaque figure attendue est annoncée par « Figure N.M (capture à venir) : titre, contenu attendu » ; aucune image n'est fournie à ce stade.

Ce manuel ne décrit que ce que l'application réalise réellement, vérifié dans le code. Le statut de chaque fonctionnalité est dans `CATALOGUE_FONCTIONNALITES.md` ; ce qui manque est au chapitre 35. Les messages du serveur sont reproduits sans accents, comme l'écran les affiche.

## Sommaire

1. Présentation de SIGTB
2. Accès et première connexion
3. Découverte de l'interface
4. Tableau de bord et centre de pilotage
5. Mes validations et notifications
6. Centre des décisions
7. Sites, infrastructures et fermetures
8. Shifts
9. Planification
10. Postes de travail
11. Dispatch
12. Voyages et rotations
13. Kilométrage
14. Fiches terrain
15. Pesée CBG
16. Opérations transport
17. Véhicules et engins
18. Chauffeurs, habilitations et infractions
19. Documents des engins
20. Carburant
21. Maintenance et immobilisations
22. Pneus
23. Stocks
24. Achats
25. Fournisseurs
26. Moyens généraux et patrimoine
27. Contrats et Neemba
28. Réconciliation, facturation CBG et recouvrement
29. Paiements fournisseurs, budgets et coûts
30. Santé et sécurité (HSE)
31. Ressources humaines
32. Reporting et analyses
33. Suivi GPS, géorepérage, capteurs et environnement
34. Paramètres
35. Fonctionnalités à développer

Chaque chapitre de module suit la même structure : A Présentation, B Principes métier, C Navigation, D Écrans, E Actions, F Procédures pas à pas, G Exemple pratique, H Cas particuliers et erreurs, I Relations avec les autres modules, J Exercice, K Glossaire du module. Les exemples utilisent des valeurs fictives.

---

## 1. Présentation de SIGTB

SIGTB (Système intégré de gestion du transport de bauxite) gère les opérations de transport de Kogon Mining SARL : la bauxite est chargée sur un site minier, transportée par des camions semi-remorques loués à Neemba jusqu'à un dépôt de CBG, pesée par CBG, puis facturée à CBG. SIGTB suit aussi les coûts : location des engins, carburant fourni par CBG, pneus, achats et stocks.

Finalité : exploiter SIGTB au quotidien sur le site pilote avec des données réelles, de sorte que chaque franc facturé ou payé soit justifiable par une pièce.

Quatre jalons ordonnent le système :

| Jalon | Chaîne | État au 2026-11-17 |
|---|---|---|
| J1 Recette | Planning, poste, dispatch, voyage, relevés kilométriques, ticket CBG, rapprochement, facture CBG, encaissement | Fonctions déployées ; aucun parcours encore validé par un PV de recette |
| J2 Coûts | Pointages et immobilisations Neemba, contrôle de la facture Neemba, carburant, pneus, achats, stock | Fonctions déployées pour l'essentiel ; décompte de location non branché |
| J3 Pilotage | Notifications, validations, centre de pilotage, rapports | Déployé en partie |
| J4 Extensions | HSE avancé, moyens généraux, GED, portails, intelligence | Sur déclencheur |

Principes communs à tous les écrans :

1. **Le serveur est seul juge.** Un bouton visible ne garantit pas l'autorisation : la règle serveur peut refuser, et son message s'affiche.
2. **Aucune donnée inventée.** Une valeur absente s'affiche « sans données » ou « non mesurable », jamais estimée.
3. **On corrige, on ne réécrit pas.** Une erreur se corrige par une annulation motivée, une rectification ou une nouvelle version ; l'original reste visible.
4. **Le système recommande, l'humain décide.** Affectations, validations et signatures sont des décisions humaines, motivées quand la règle l'exige et historisées.
5. **Séparation des tâches.** Plusieurs validations doivent être faites par une autre personne que l'auteur.
6. **Périmètre de site.** Un compte affecté à un site ne voit et ne modifie que les données de ce site.

Figure 1.1 (capture à venir) : page d'accueil après connexion, montrant le menu latéral, la barre supérieure et le tableau de bord.

---

## 2. Accès et première connexion

### A. Présentation
L'accès se fait par navigateur à l'adresse **https://sigtb.infranetgn.com**. Il n'existe pas d'application mobile ni de mode hors ligne.

### B. Principes métier
- Un compte est créé par l'administrateur, avec un rôle et un site d'affectation (ou « compte global » motivé). Il n'y a pas d'inscription libre.
- Un compte inactif ou suspendu perd tous ses droits côté serveur.
- La double authentification (code TOTP) est proposée à chaque utilisateur ; son exigence pour les opérations sensibles est un réglage de l'administrateur, inactif aujourd'hui.

### C. Navigation
Page de connexion, puis menu du profil (en haut à droite) : **Sécurité du compte**, **Langue**, **Se déconnecter**.

### D. Écrans
Figure 2.1 (capture à venir) : page de connexion, champs adresse e-mail et mot de passe, case « Se souvenir de moi », lien « Mot de passe oublié ? », bouton « Se connecter », bouton Microsoft 365.
Figure 2.2 (capture à venir) : message affiché sous « Mot de passe oublié ? ».
Figure 2.3 (capture à venir) : écran de saisie du code de double authentification.
Figure 2.4 (capture à venir) : écran Sécurité du compte (niveau de session, inscription d'un facteur, QR code masqué, liste des facteurs, Mes délégations).
Figure 2.5 (capture à venir) : menu du profil ouvert (nom, adresse, rôle, Sécurité du compte, Langue, Se déconnecter).

### E. Actions disponibles
Se connecter ; afficher le mot de passe saisi ; se souvenir de l'adresse sur ce poste ; inscrire, confirmer et retirer un facteur TOTP ; saisir le code à la connexion ; changer la langue ; se déconnecter.

Non disponibles : réinitialisation du mot de passe par courriel ; changement de son propre mot de passe depuis l'application ; connexion Microsoft 365 (bouton présent, fournisseur non configuré).

### F. Procédures pas à pas

**2.F.1 Se connecter**
- Préconditions : compte créé par l'administrateur ; adresse et mot de passe reçus de lui.
- Accès : ouvrir https://sigtb.infranetgn.com.
- Saisie : adresse e-mail, mot de passe ; cocher « Se souvenir de moi » sur un poste personnel seulement.
- Contrôles : adresse et mot de passe vérifiés par le service d'authentification.
- Confirmation : cliquer **Se connecter**.
- Résultat : le tableau de bord s'affiche ; si un facteur TOTP est inscrit, l'écran du code s'affiche d'abord (Figure 2.3).
- Vérification : le nom et le rôle apparaissent dans le menu du profil (Figure 2.5).
- Erreurs : identifiants refusés, compte inactif : contacter l'administrateur.

**2.F.2 Se déconnecter**
Menu du profil, **Se déconnecter**. Sur un poste partagé, se déconnecter à chaque fin de poste.

**2.F.3 Activer la double authentification**
- Préconditions : une application d'authentification sur le téléphone.
- Accès : menu du profil, **Sécurité du compte**.
- Saisie : lancer l'inscription ; scanner le QR code (ou recopier la clé de secours, masquée par défaut) ; saisir le code à six chiffres affiché par l'application.
- Résultat : le facteur apparaît vérifié ; à la connexion suivante, le code est demandé.
- Vérification : « Session actuelle : vérifiée en deux étapes » après la prochaine connexion.
- Erreurs : code refusé (heure du téléphone décalée, code expiré) : saisir le code suivant.

**2.F.4 Mot de passe oublié**
Le lien affiche : la réinitialisation par e-mail n'est pas activée. Demander un nouveau mot de passe à l'administrateur (manuel administrateur, section 3).

### G. Exemple pratique
Un chef de poste (compte d'exemple) reçoit son accès, se connecte, inscrit son facteur TOTP, se déconnecte, puis se reconnecte avec son code : l'écran Sécurité du compte indique une session vérifiée en deux étapes.

### H. Cas particuliers et erreurs
- Bouton Microsoft 365 : message « Connexion Microsoft 365 indisponible » ; utiliser l'adresse et le mot de passe.
- Téléphone perdu : demander à l'administrateur ; il n'existe pas de procédure de secours dans l'écran autre que la clé de secours notée à l'inscription.
- Message « Confirmation en deux etapes (MFA) requise pour cette operation » : l'exigence MFA est active et la session n'a pas été confirmée par code ; se reconnecter avec le code.

### I. Relations avec les autres modules
Le rôle et le site du compte déterminent le menu visible et les données lues dans tous les modules. Les délégations reçues ou données se gèrent dans **Sécurité du compte > Mes délégations** (manuel administrateur, section 7).

### J. Exercice
Connectez-vous, ouvrez Sécurité du compte et relevez le niveau de votre session. Résultat attendu : « mot de passe seul » sans facteur, « vérifiée en deux étapes » avec facteur et code saisi.

### K. Glossaire du module
- **TOTP** : code à usage unique calculé par une application d'authentification.
- **aal1, aal2** : niveau de session ; aal2 = session confirmée par code.
- **Compte global** : compte sans site d'affectation, qui voit tous les sites.

---

## 3. Découverte de l'interface

### A. Présentation
L'écran comprend le menu latéral (gauche), la barre supérieure, le bandeau d'exemple (seulement quand des données d'exemple sont chargées) et la zone de travail.

### B. Principes métier
- Le menu n'affiche une entrée que si le compte peut lire le module correspondant. C'est un confort : la barrière est le serveur.
- Le sélecteur de site du menu filtre l'affichage ; il ne donne aucun droit supplémentaire.
- L'adresse de la page décrit l'écran (`#/vue`, `#/vue/identifiant`) : le bouton retour du navigateur fonctionne, un lien se partage avec un collègue qui a les mêmes droits.

### C. Navigation
Menu latéral : Tableau de bord, Mes validations, Centre de pilotage, Exploitation, Planification, Postes de travail, Dispatch, Voyages & Rotations, Kilométrage, Fiches terrain, Pesée CBG, Opérations transport, Flotte, Carburant, Maintenance, Pneus, Stocks & Achats, Contrats & Finance, RH & Sécurité, Reporting & Analyse, Paramètres. Les rubriques à flèche s'ouvrent sur leurs sous-entrées.

### D. Écrans
Figure 3.1 (capture à venir) : menu latéral déplié, sélecteur de site et champ « Rechercher... ».
Figure 3.2 (capture à venir) : fenêtre de recherche globale avec résultats par type (engin, chauffeur, voyage, ordre de travail, facture, site).
Figure 3.3 (capture à venir) : barre supérieure avec date, indicateur du shift, compteur Mes validations (boîte), compteur d'alertes (cloche), aide, menu du profil.
Figure 3.4 (capture à venir) : page liste standard (recherche, filtres, tri par colonne, pagination, choix des colonnes, bouton Exporter CSV).
Figure 3.5 (capture à venir) : page détail standard (fil d'Ariane, référence, statut, boutons d'action, onglets Informations, Relations, Historique, Pièces jointes).
Figure 3.6 (capture à venir) : onglet Pièces jointes avec dépôt, liste et annulation motivée.

Éléments de la barre supérieure :
- **Indicateur du shift** : « Shift X en cours » seulement si une instance de poste est ouverte ou en cours ; sinon « non ouvert », « hors plage horaire », « aucun shift défini » ou « shifts indisponibles ». Un clic mène au Dispatch ou à l'écran Shifts.
- **Boîte** : nombre d'éléments de Mes validations ; clic : chapitre 5.
- **Cloche** : nombre d'alertes actives ; clic : Centre des décisions (chapitre 6).
- **Aide** : rappels (recherche Ctrl K, sens de « sans données », contact de l'administrateur).
- **Profil** : chapitre 2.

Pages standard : les modules Sites, Véhicules et engins, Chauffeurs, Planification, Postes, Dossier contractuel, Réconciliation, Facturation, Recouvrement, ainsi que la fiche du voyage et la fiche terrain, utilisent des pages standard (liste, fiche, formulaire, action en pleine page). Les autres écrans gardent leur présentation propre (onglets, fenêtres).

### E. Actions disponibles
Rechercher (Ctrl K) ; filtrer, trier, paginer, choisir les colonnes et exporter en CSV une liste standard ; ouvrir une fiche ; consulter l'historique ; déposer et annuler une pièce jointe sur les objets qui l'acceptent.

### F. Procédures pas à pas

**3.F.1 Rechercher un élément**
Ctrl K (ou **Rechercher...** dans le menu), taper au moins deux caractères (immatriculation, nom, numéro de permis, référence de voyage, numéro d'ordre ou de facture, nom de site), flèches haut et bas, Entrée pour ouvrir. Seuls les éléments que vos droits et votre site permettent de lire apparaissent.

**3.F.2 Travailler dans une liste standard**
Saisir un mot dans la recherche (sans tenir compte des accents), choisir un filtre, cliquer un titre de colonne pour trier, changer de page. Les filtres sont conservés dans l'adresse et au retour sur la liste pendant la session. Un clic sur une ligne ouvre la fiche. Une lecture refusée par le serveur s'affiche comme une erreur, jamais comme une liste vide.

**3.F.3 Exporter une liste**
Bouton **Exporter CSV** : le fichier reprend les lignes filtrées et les colonnes affichées. Ouvrir dans un tableur.

**3.F.4 Joindre une pièce justificative**
- Préconditions : objet d'un type accepté (voyage, ticket CBG, relevé de compteur, relevé CBG, livraison de carburant CBG) ; droit d'écriture du module de l'objet ; site du périmètre.
- Accès : onglet ou bloc **Pièces jointes** de l'objet.
- Saisie : choisir le fichier : PDF, JPEG, PNG ou WebP, 10 Mio au plus ; CSV et XLSX seulement pour un relevé CBG.
- Contrôles : le serveur enregistre la pièce, le fichier est déposé dans un espace privé, puis le serveur vérifie la taille et le type réellement stockés.
- Résultat : la pièce apparaît avec sa taille, sa date et « par vous ».
- Correction : une pièce ne se supprime pas ; elle s'annule avec un motif et reste consultable.

### G. Exemple pratique
Rechercher l'immatriculation d'exemple « AB-1234 » avec Ctrl K, ouvrir l'engin, consulter son onglet Historique, revenir à la liste par le bouton retour du navigateur : la liste retrouve ses filtres.

### H. Cas particuliers et erreurs
- **Hors ligne** : sans connexion, toute saisie échoue et doit être refaite ; il n'y a pas de file d'attente locale (sauf le brouillon de la fiche KOGON, chapitre 15).
- **Menu incomplet** : l'entrée n'apparaît pas faute de droit de lecture ; demander à l'administrateur.
- **Pièce jointe sur un site, un engin ou un chauffeur** : l'onglet signale que ce type d'objet ne les accepte pas encore.
- **Langue** : la traduction anglaise est incomplète.

### I. Relations avec les autres modules
Toutes les pages partagent ces composants ; le contexte (date, site, shift, camion, chauffeur, voyage) suit dans l'adresse entre les écrans de l'espace Opérations transport (chapitre 16).

### J. Exercice
Ouvrez Flotte > Véhicules et engins, filtrez sur un statut, triez par immatriculation, exportez en CSV. Résultat attendu : un fichier dont les lignes correspondent à la liste filtrée.

### K. Glossaire du module
- **Liste standard** : page de liste commune (recherche, filtres, tri, pagination, export).
- **Fiche** : page de détail d'un objet, avec onglets.
- **Pièce jointe** : fichier justificatif rattaché à un objet, jamais supprimé.

---

## 4. Tableau de bord et centre de pilotage

### A. Présentation
Le **Tableau de bord** donne la vue globale des opérations ; le **Centre de pilotage** affiche les indicateurs de référence avec filtres, comparaison et export.

### B. Principes métier
- Les indicateurs sont calculés par le serveur (`indicateurs_pilotage`), jamais dans le navigateur.
- Chaque indicateur porte sa source, sa fiabilité (mesure, partielle, sans données), sa période et l'heure du calcul.
- Un domaine que vos droits ne permettent pas de lire affiche « Non visible avec vos droits de lecture », jamais 0.
- Une position de plus de 15 minutes n'est jamais présentée comme en direct.

### C. Navigation
Menu **Tableau de bord** ; menu **Centre de pilotage** ; alias **Opérations transport > Supervision du jour** vers le Centre de pilotage.

### D. Écrans
Figure 4.1 (capture à venir) : Tableau de bord, cartes d'indicateurs avec source et heure.
Figure 4.2 (capture à venir) : Centre de pilotage, filtres site, shift, véhicule, partenaire, seconde période et colonne d'écart, boutons Exporter et Imprimer.

### E. Actions disponibles
Filtrer ; comparer deux périodes ; exporter en CSV (période, filtres, source et heure en tête) ; imprimer.

### F. Procédures pas à pas
**4.F.1 Lire le tableau de bord** : ouvrir le menu, lire chaque carte avec sa source et son heure ; « sans données » signifie qu'aucune saisie n'existe pour la période.

**4.F.2 Comparer deux périodes au centre de pilotage**
- Accès : Centre de pilotage.
- Saisie : période principale, puis seconde période ; filtres si besoin.
- Contrôles : un indicateur qui n'a pas la dimension filtrée (par exemple les engins en service filtrés par shift) est rendu « sans données » avec le motif.
- Résultat : les deux valeurs et l'écart côte à côte.
- Vérification : la fiabilité de chaque ligne ; une valeur partielle se lit avec prudence.
- Export : **Exporter** produit un CSV ; **Imprimer** imprime avec l'en-tête des filtres.

### G. Exemple pratique
Le directeur compare la semaine en cours à la précédente pour le site d'exemple « Site minier A » : tonnes livrées et voyages s'affichent avec l'écart ; les engins en service, mesurés à l'instant, n'ont pas de seconde valeur.

### H. Cas particuliers et erreurs
Pas de graphique d'évolution ; pas d'indicateurs financiers du directeur (facturé, encaissé, marge) sur ces écrans (chapitre 35).

### I. Relations avec les autres modules
Lit les voyages, objectifs, postes, engins, immobilisations, carburant et achats.

### J. Exercice
Exportez le centre de pilotage filtré sur un site. Résultat attendu : un CSV dont l'en-tête cite le site, la période et l'heure du calcul.

### K. Glossaire du module
- **Fiabilité** : mesure (donnée complète), partielle, sans données.
- **Indicateur instantané** : calculé à l'heure du calcul, pas sur la période.

---

## 5. Mes validations et notifications

### A. Présentation
**Mes validations** liste ce qui attend une décision de votre part, et vos notifications.

### B. Principes métier
- La liste est recalculée à chaque lecture selon vos droits et la séparation des tâches ; rien n'est stocké.
- La décision ne se prend pas ici : le bouton **Ouvrir l'écran** mène au module, dont la règle serveur reste seule juge.

### C. Navigation
Menu **Mes validations**, ou la boîte de la barre supérieure.

### D. Écrans
Figure 5.1 (capture à venir) : liste par catégorie (achats, paiements, carburant, exploitation, maintenance, tickets CBG, facturation, HSE, contrats, budgets) avec bouton Ouvrir l'écran.
Figure 5.2 (capture à venir) : notifications avec bouton de marquage lu.

### E. Actions disponibles
Ouvrir l'écran de la décision ; marquer ses notifications lues.

Éléments listés (selon droits) : bon de commande à approuver ou à réceptionner ; paiement à approuver, à exécuter, à contrôler ; mouvement ou inventaire de carburant à valider ; clôture de poste à valider ; remise en service à valider ; écart de relevé CBG à décider ; facture à signer (directeur) ; action corrective en retard ; plan de prévention à signer ; échéance de contrat ; clause à décider ; budget dépassé.

Notifications écrites par le serveur : bon approuvé ou rejeté, paiement approuvé ou rejeté, anomalie au contrôle d'un paiement, clôture de poste validée.

### F. Procédures pas à pas
**5.F.1 Traiter une validation** : ouvrir Mes validations, choisir l'élément, **Ouvrir l'écran**, décider dans le module (procédure du chapitre correspondant), revenir : l'élément a disparu.

**5.F.2 Marquer ses notifications lues** : bouton de marquage ; seules vos notifications sont concernées.

### G. Exemple pratique
Le comptable voit un paiement d'exemple à approuver, ouvre Paiements fournisseurs, approuve ; l'élément disparaît et le proposant reçoit une notification.

### H. Cas particuliers et erreurs
- Votre propre saisie n'apparaît pas : la séparation des tâches vous exclut de sa validation.
- Pas d'envoi par courriel ou SMS, pas de relance ni d'escalade automatique.

### I. Relations avec les autres modules
Achats, Paiements, Carburant, Postes, Maintenance, Pesée, Facturation, HSE, Contrats, Budgets.

### J. Exercice
Créez (compte A) un mouvement de carburant, puis ouvrez Mes validations avec un compte B ayant l'écriture `fuel`. Résultat attendu : le mouvement figure chez B, pas chez A.

### K. Glossaire du module
- **Séparation des tâches** : l'auteur d'une saisie ne la valide pas.

---

## 6. Centre des décisions

### A. Présentation
Le **Centre des décisions** réunit les alertes calculées par le serveur et les décisions en attente, par priorité.

### B. Principes métier
- Priorité : 1 alerte critique, 2 décision en attente, 3 avertissement, 4 information, puis de la plus ancienne à la plus récente.
- Les alertes sont écrites par le serveur seulement (`actualiser_alertes`), à l'ouverture de l'écran et de la barre supérieure, au plus une fois toutes les 30 secondes. Il n'y a pas de calcul planifié : un seuil franchi la nuit apparaît à la première ouverture suivante.
- Neuf règles : immobilisation longue, intervention Neemba en retard, contrôle avant départ non conforme, écart d'inventaire carburant, document ou habilitation expiré, action corrective en retard, voyage livré sans ticket CBG, EPI à renouveler, inspection en retard.
- Les trois règles à seuil (immobilisation, carburant, ticket) ne produisent rien tant que l'administrateur n'a pas saisi le seuil ; les six autres sont actives sauf mise hors service.
- Une alerte dont la condition disparaît reste affichée « condition levée » jusqu'à sa résolution ; une alerte résolue ne renaît pas pour le même objet.

### C. Navigation
Menu **Exploitation > Centre des décisions**, ou la cloche de la barre supérieure.

### D. Écrans
Figure 6.1 (capture à venir) : liste des alertes et décisions avec priorité, règle, objet, date, état.
Figure 6.2 (capture à venir) : résolution d'une alerte avec motif.

### E. Actions disponibles
Prendre en compte une alerte ; la résoudre avec un motif (écriture du module de la règle) ; ouvrir l'objet concerné.

### F. Procédures pas à pas
**6.F.1 Lire les alertes** : ouvrir l'écran ; chaque alerte se voit avec le droit de lecture du module de sa règle et si l'objet (voyage, engin, site) est dans votre périmètre.

**6.F.2 Résoudre une alerte** : ouvrir l'alerte, traiter la cause dans le module (par exemple clôturer l'immobilisation), puis **Résoudre**, saisir le motif, confirmer. Résultat : l'alerte quitte les alertes actives ; le compteur de la cloche baisse.

### G. Exemple pratique
L'administrateur a fixé le seuil `alerte_voyage_sans_ticket_h` à 24 (exemple). Un voyage livré depuis 30 heures sans ticket produit une alerte ; le contrôleur rattache le ticket (12.F.5) puis résout l'alerte avec le motif « ticket remis par le chauffeur ».

### H. Cas particuliers et erreurs
- Aucune alerte de seuil : vérifier que le seuil est saisi (manuel administrateur, section 10).
- Pas d'envoi d'alerte par courriel ou SMS.

### I. Relations avec les autres modules
Maintenance, Carburant, HSE, Flotte, Chauffeurs, Voyages ; seuils dans Paramètres > Général.

### J. Exercice
Citez les trois règles qui restent muettes sans seuil. Résultat attendu : immobilisation longue, écart d'inventaire carburant, voyage livré sans ticket.

### K. Glossaire du module
- **Condition levée** : la cause de l'alerte a disparu, la résolution humaine reste à faire.

---

## 7. Sites, infrastructures et fermetures

### A. Présentation
Référentiel des sites (sites miniers, dépôts), de leurs infrastructures (points de chargement, dépôts, pont-bascule, station, atelier, zone de sécurité) et de leurs fermetures.

### B. Principes métier
- Un site se désactive, il ne se supprime pas.
- Coordonnées GPS facultatives (latitude et longitude ensemble, degrés décimaux) ; capacité de stockage en tonnes ; responsable choisi parmi les comptes actifs ; le stock d'un site ne se saisit pas.
- Une fermeture du site entier couvrant la journée bloque toute affectation de voyage partant du site ou y arrivant ; la fermeture d'une seule infrastructure est informative.
- Une fermeture ne se modifie pas ; elle se lève par anticipation, avec date et motif.

### C. Navigation
**Exploitation > Sites** (page standard `#/sites`) ; **Exploitation > Infrastructures et fermetures**.

### D. Écrans
Figure 7.1 (capture à venir) : liste des sites (nom, type, organisation, statut).
Figure 7.2 (capture à venir) : formulaire de site en pleine page avec erreurs en temps réel.
Figure 7.3 (capture à venir) : fiche du site, actions Modifier, Désactiver ou Réactiver.
Figure 7.4 (capture à venir) : infrastructures d'un site.
Figure 7.5 (capture à venir) : déclaration et levée d'une fermeture.

### E. Actions disponibles
Créer, modifier, désactiver, réactiver un site (droit `settings`) ; déclarer une infrastructure ; déclarer une fermeture ; lever une fermeture par anticipation.

### F. Procédures pas à pas
**7.F.1 Consulter un site** : liste, clic sur la ligne, onglets de la fiche.

**7.F.2 Créer un site**
- Préconditions : organisation existante (Paramètres > Organisations, administrateur).
- Accès : Sites, **Nouveau**.
- Saisie : nom, type, organisation ; facultatif : localisation, coordonnées, responsable, capacité.
- Contrôles : erreurs affichées en temps réel ; envoi bloqué tant qu'il en reste.
- Confirmation : **Enregistrer**.
- Résultat : la fiche du site s'ouvre.
- Erreurs : message du serveur affiché tel quel (par exemple droit manquant).

**7.F.3 Désactiver un site** : fiche du site, **Désactiver**. Limite : aucun motif n'est conservé, le site n'a pas de journal.

**7.F.4 Déclarer une infrastructure** : Infrastructures et fermetures, choisir le site, ajouter l'infrastructure (type, nom, capacité et unité : t/h ou camions/h pour être prise en compte par la simulation).

**7.F.5 Déclarer puis lever une fermeture** : choisir le site ou l'infrastructure, période et motif obligatoires, enregistrer. Pour lever : **Lever**, date et motif.

### G. Exemple pratique
Le dépôt d'exemple « Dépôt B » est fermé une journée pour travaux : la fermeture du site entier est déclarée ; ce jour-là, toute affectation vers ce dépôt est refusée par le dispatch avec « Site ferme le ... ».

### H. Cas particuliers et erreurs
- Une modification de site conserve tous les champs non modifiés.
- Pièces jointes non disponibles sur un site.

### I. Relations avec les autres modules
Les sites bornent le périmètre des comptes, des voyages, des engins, des chauffeurs et de presque tous les registres ; les fermetures sont lues par le Dispatch ; les capacités par la simulation de la Planification et du Dispatch.

### J. Exercice
Déclarez une fermeture d'un pont-bascule d'exemple. Résultat attendu : la fermeture est enregistrée et n'empêche pas l'affectation d'un voyage (fermeture d'infrastructure informative).

### K. Glossaire du module
- **Infrastructure** : élément d'un site (point de chargement, dépôt, pont-bascule, station, atelier, zone de sécurité).
- **Fermeture** : période d'indisponibilité, du site entier ou d'une infrastructure.

---

## 8. Shifts

### A. Présentation
Les shifts sont les plages de travail communes à tous les sites (par exemple Jour 06:00-18:00, Nuit 18:00-06:00).

### B. Principes métier
- Seul un profil sans site, administrateur ou titulaire de `settings`, crée, modifie (motif) ou désactive (motif) un shift.
- Heures à la minute ; fin différente du début ; fin avant le début = shift de nuit.
- Deux shifts actifs ne se chevauchent pas (minuit compris). Nom et libellé uniques.
- Un shift ne se supprime jamais ; le journal trace chaque action.
- Un shift configuré est distinct de son **instance** (le poste d'une date et d'un site, chapitre 10).

### C. Navigation
**Exploitation > Shifts**.

### D. Écrans
Pages standard (D-090, D-088 complément) : liste `#/shifts`, fiche `#/shifts/<identifiant>` (onglet Historique = journal), formulaire `#/shifts/nouveau` et `#/shifts/<identifiant>/modifier`, désactivation motivée en page d'action `#/shifts/<identifiant>/desactiver` (elle remplace l'ancienne petite fenêtre du navigateur).

Figure 8.1 (capture à venir) : liste des shifts.
Figure 8.2 (capture à venir) : fiche du shift, onglet Historique (journal des shifts).
Figure 8.3 (capture à venir) : formulaire du shift en pleine page (nom, libellé, début, fin, ordre).
Figure 8.4 (capture à venir) : page de désactivation avec motif.

### E. Actions disponibles
Créer, modifier avec motif, désactiver avec motif ; consulter le journal.

### F. Procédures pas à pas
**8.F.1 Créer un shift** : nouveau shift, saisir nom, libellé, heures, ordre ; enregistrer. Erreur fréquente : chevauchement avec un shift actif.

**8.F.2 Désactiver un shift** : ouvrir la fiche du shift, **Désactiver** ; la page d'action demande le motif ; confirmer. Il n'est plus proposé aux saisies.

### G. Exemple pratique
Création de « Jour » 06:00-18:00 puis « Nuit » 18:00-06:00 : les deux sont acceptés ; un troisième « Relève » 17:00-19:00 est refusé (chevauchement).

### H. Cas particuliers et erreurs
Sans shift actif, Dispatch, Postes et Fiches l'indiquent et renvoient vers cet écran.

### I. Relations avec les autres modules
Planification (objectif par shift), Postes, Dispatch, Fiches terrain, indicateur de la barre supérieure.

### J. Exercice
Saisissez un shift 22:00-06:00 alors que « Nuit » 18:00-06:00 est actif. Résultat attendu : refus pour chevauchement.

### K. Glossaire du module
- **Shift** : plage horaire type.
- **Instance de shift** : le poste de travail d'une date et d'un site.

---

## 9. Planification

### A. Présentation
Fixe l'objectif de production d'un site pour une date et un shift (ou la journée), et le compare au réalisé.

### B. Principes métier
- Objectif en tonnes (voyages, camions, chargeuses en option) ; date et site requis ; tonnes positives.
- Une révision crée une nouvelle version motivée ; un objectif ne se modifie pas en place et ne se supprime pas (il s'annule avec un motif).
- Réalisé : tonnage des voyages livrés (livré, accepté, clôturé, en litige) de la date, du site d'origine et du shift.
- Un compte rattaché à un site ne crée ni n'annule l'objectif d'un autre site.
- La simulation n'écrit rien ; elle n'estime pas sans échantillon (3 jours et 10 voyages livrés pour la charge observée, 10 mesures pour une durée).

### C. Navigation
Menu **Planification** (page standard `#/planification`), ou **Opérations transport > Objectifs planifiés**. Volets : **Objectifs du jour**, **Registre des objectifs**, **Simulation et rattrapage**, **Clôture et rapport**, **Comparaison des shifts**.

### D. Écrans
Figure 9.1 (capture à venir) : objectifs du jour (objectif, réalisé, prévision de fin de shift étiquetée, camions nécessaires avec hypothèses).
Figure 9.2 (capture à venir) : registre des objectifs et versions.
Figure 9.3 (capture à venir) : ventilation d'un objectif.
Figure 9.4 (capture à venir) : simulation (hypothèses et sources, besoin, tonnage atteignable, objectif révisé proposé).
Figure 9.5 (capture à venir) : clôture de journée avec causes d'écart et rapport de production.
Figure 9.6 (capture à venir) : comparaison des shifts.

### E. Actions disponibles
Définir, réviser, annuler un objectif ; ventiler ; simuler et retenir un scénario (révision) ; clôturer la journée ; annuler une clôture (motif) ; rapport de production ; comparer les shifts.

### F. Procédures pas à pas
**9.F.1 Définir puis réviser un objectif**
- Préconditions : droit `planning` ; site et shift existants.
- Saisie : date, site, shift (vide = journée), tonnes, voyages et engins si connus.
- Résultat : version 1 active. Réviser : même écran, nouvelles valeurs, motif obligatoire ; l'ancienne version passe « remplacé ».

**9.F.2 Ventiler un objectif** : chaque ligne porte une destination différente du site de chargement, ou un contrat client actif, ou les deux, toutes de même forme ; la somme ne dépasse pas l'objectif ; une seule ventilation par version.

**9.F.3 Simuler** : choisir l'heure (heure de Conakry), lire les hypothèses et leurs sources ; pour retenir le scénario, réviser l'objectif avec motif.

**9.F.4 Clôturer la journée** : après la fin du dernier shift actif ; une cause d'écart au moins si le réalisé est sous l'objectif, si un objectif a été annulé ou révisé sous une cible non atteinte. Le bilan est figé ; les objectifs de la journée ne bougent plus. Si `planification_cloture_separee` vaut vrai, une autre personne que les auteurs des versions clôture.

### G. Exemple pratique
Objectif d'exemple 2 000 t pour le shift Jour au Site minier A ; à 14 h, la prévision de fin de shift affiche 1 700 t ; le responsable révise à 1 800 t avec le motif « panne chargeuse » ; à la clôture, il saisit la cause d'écart.

### H. Cas particuliers et erreurs
- « Données insuffisantes » en simulation : échantillon trop faible, seuils fixes.
- Réalisé d'une ligne ventilée par contrat seul : « non mesurable » (un voyage ne porte pas de contrat).
- Pas d'objectif par matériau.

### I. Relations avec les autres modules
Sites, Shifts ; réalisé lu sur les Voyages ; le besoin du Dispatch part de l'objectif.

### J. Exercice
Annulez un objectif sans motif. Résultat attendu : refus, motif obligatoire.

### K. Glossaire du module
- **Version** : état daté d'un objectif ; la plus récente active fait foi.
- **Ventilation** : répartition de l'objectif par destination ou contrat.

---

## 10. Postes de travail

### A. Présentation
Un poste est l'instance d'un shift pour une date et un site : équipe, présence, événements, consignes et bilan.

### B. Principes métier
- Un seul poste par shift, site et date ; ouverture au plus un jour à l'avance.
- États : planifié, ouvert, en cours, clôturé, validé, annulé.
- Les consignes reçues reprennent les consignes de sortie du dernier poste clos du site.
- Un chauffeur n'est affecté qu'à un poste par shift. Une absence demande un motif.
- La clôture exige toute l'équipe pointée et des consignes pour le poste suivant (même « rien à signaler ») ; elle est refusée si des voyages ne sont pas terminés, sauf clôture du shift motivée au Dispatch (11.F.6).
- La validation de la clôture revient à une autre personne (droit `planning`).

### C. Navigation
Menu **Postes de travail** (page standard `#/postes`), ou **Opérations transport > Instances de shift**.

### D. Écrans
Figure 10.1 (capture à venir) : liste des postes et fiche (équipe, présences).
Figure 10.2 (capture à venir) : journal des événements du poste.
Figure 10.3 (capture à venir) : clôture et rapport de poste imprimable.

### E. Actions disponibles
Ouvrir ; composer l'équipe ; pointer présent ou absent (retard en minutes) ; consigner un événement (incident, arrêt, retard, sécurité, information) ; clôturer ; valider la clôture ; imprimer le rapport ; annuler une instance (motif, refusé si un voyage est engagé).

### F. Procédures pas à pas
**10.F.1 Ouvrir un poste et composer l'équipe** : Postes, **Nouveau**, date, site, shift ; enregistrer ; ajouter chaque chauffeur ou engin ; pointer chacun.

**10.F.2 Consigner un événement** : fiche du poste, catégorie, heure non future, description. Le journal ne se modifie pas.

**10.F.3 Clôturer puis faire valider** : vérifier que tous sont pointés, saisir les consignes de sortie et le rapport, **Clôturer** ; un autre responsable ouvre Mes validations, puis valide la clôture.

### G. Exemple pratique
Poste de nuit d'exemple : 8 chauffeurs, 1 absent (motif « maladie »), un arrêt chargeuse consigné à 02:10 ; clôture à 06:05 avec consignes « chargeuse à surveiller » ; validation par le responsable des opérations à 07:00.

### H. Cas particuliers et erreurs
- Retrait d'un membre de l'équipe : non disponible ; l'absence se pointe.
- Validation par l'auteur de la clôture : refusée.

### I. Relations avec les autres modules
Shifts, Chauffeurs, Engins ; le Dispatch planifie et démarre l'instance ; bilan dans les Rapports.

### J. Exercice
Tentez de clôturer un poste avec un membre non pointé. Résultat attendu : refus.

### K. Glossaire du module
- **Consignes de sortie** : informations transmises au poste suivant.
- **Bilan figé** : tonnes cible et livrées, voyages, présents, absents, événements à la clôture.

---

## 11. Dispatch

### A. Présentation
Le Dispatch prépare les voyages d'un shift et décide leur affectation : camion, chauffeur, engin de chargement. Il décide et affecte ; l'exécution se suit dans Voyages et rotations.

### B. Principes métier
- Le besoin en voyages vient de l'objectif : voyages visés, sinon tonnes cibles divisées par (capacité utile moyenne des camions disponibles x hypothèse de charge saisie). Sans objectif, capacité ou hypothèse, le besoin est vide, jamais supposé.
- La recommandation est calculée dans l'écran avec des règles fixes et expliquées (immobilisations, habilitations, chauffeurs engagés, capacité, durée estimée sur le cycle observé, confiance selon la qualité des données). La personne décide.
- Contraintes serveur, jamais contournées : camion actif et de type benne ; chauffeur actif ; permis valide à la date ; engin de chargement actif ; un chauffeur sur un seul camion par shift ; site de départ ou d'arrivée non fermé ; habilitations exigées valides ; engin sans immobilisation ouverte ; camion et chauffeur non engagés ailleurs ; voyage pas encore engagé.
- Modifier ou refuser une recommandation demande un motif ; une réaffectation est motivée ; chaque décision est historisée.
- Un voyage suspendu n'avance plus (sauf annulation) jusqu'à sa reprise motivée.

### C. Navigation
Menu **Dispatch**, ou **Opérations transport > Affectation des voyages**. Onglets : **Affectations**, **Voyages par état**, **Supervision**, **Shift et préparation**, **Journal** (onglet dans l'adresse : `#/dispatch?onglet=shift`). Les décisions, la suspension et les actions du shift (planifier, ouvrir, démarrer, annuler, clôturer, préparer) s'ouvrent en pages (`#/dispatch/shift/<action>`), plus en fenêtres. Un camion ou un chauffeur passé dans l'adresse (`?camion=`, `?chauffeur=`) filtre l'écran ; un bandeau bleu l'annonce, avec **Retirer ce filtre**.

### D. Écrans
Figure 11.1 (capture à venir) : onglet Shift et préparation (instance, besoin calculé avec hypothèses, confirmation du plan, clôture du shift).
Figure 11.2 (capture à venir) : onglet Affectations, recommandation et ses raisons.
Figure 11.3 (capture à venir) : page de décision `#/dispatch/<voyage>/modifiee`, `refusee` ou `reaffectation` (choix et motif).
Figure 11.4 (capture à venir) : rapport de l'affectation groupée (Affecté ou Refusé, raison).
Figure 11.5 (capture à venir) : page de suspension `#/dispatch/<voyage>/suspendre` (ou `reprendre`) avec motif.
Figure 11.6 (capture à venir) : voyages par état.
Figure 11.7 (capture à venir) : supervision et indicateurs (sans données = vide).
Figure 11.8 (capture à venir) : journal des décisions.
Figure 11.9 (capture à venir) : simulation de scénarios.

### E. Actions disponibles
Planifier l'instance du shift ; confirmer le plan (crée les voyages préparés) ; affecter un voyage ; accepter la sélection ou tout accepter (300 voyages au plus) ; suspendre et reprendre ; démarrer et clôturer le shift ; simuler une répartition ; consulter la supervision et le journal.

### F. Procédures pas à pas
**11.F.1 Préparer le shift**
- Préconditions : shift actif ; objectif du jour (sinon besoin vide) ; droit `trips`.
- Accès : Dispatch, onglet **Shift et préparation**, date et site.
- Saisie : planifier l'instance ; lire le besoin proposé ; saisir le nombre de voyages à préparer (motif si différent de la proposition ou sans proposition).
- Contrôles : la version du plan est vérifiée (si quelqu'un l'a modifié entre-temps : « en cours de modification », recharger).
- Résultat : voyages préparés au statut Planifié.

**11.F.2 Affecter un voyage**
- Accès : onglet **Affectations**, choisir le voyage.
- Lecture : recommandation (camion, chauffeur, engin) et ses raisons, avertissements (sanction en vigueur, données faibles).
- Décision : **Accepter**, ou **Modifier** (choix d'un autre camion ou chauffeur, motif), ou **Refuser** (motif).
- Résultat : voyage Affecté, décision au journal.
- Erreurs fréquentes : « Camion indisponible ou inadapte », « Chauffeur indisponible », « Permis du chauffeur expire a la date du voyage », « Chauffeur deja affecte a un autre camion sur ce shift », « Site ferme le ... », « Chauffeur non habilite le ... », « Voyage engage : l'affectation ne change plus ».

**11.F.3 Affectation groupée** : cocher les voyages préparés, **Accepter la sélection** (ou **Tout accepter**) ; lire le rapport : un refus n'annule que le voyage concerné.

**11.F.4 Suspendre puis reprendre un voyage** : sur le voyage, **Suspendre**, motif ; plus tard **Reprendre**, motif.

**11.F.5 Simuler une répartition** : choisir le site, la fenêtre d'observation (14 jours par défaut, 7 à 60) et le minimum de rotations mesurées (3 par défaut) ; lire la répartition proposée. Rien n'est écrit.

**11.F.6 Clôturer le shift** : onglet Shift ; si des voyages ne sont pas terminés, motif obligatoire ; le poste peut ensuite être clôturé.

### G. Exemple pratique
Objectif d'exemple 40 voyages ; le dispatcheur confirme 40 voyages, accepte la sélection : 38 affectés, 2 refusés (« Chauffeur non habilite », visite médicale expirée). Il modifie ces deux voyages avec un autre chauffeur et le motif « visite médicale échue ».

### H. Cas particuliers et erreurs
- Un voyage suspendu ne s'affecte pas ; s'il était affecté, il peut être réaffecté.
- Pas de carte des positions, pas de file d'attente ni de distance utilisée (aucune donnée).
- Une sanction de conduite ne bloque pas : elle s'affiche en avertissement.

### I. Relations avec les autres modules
Planification (besoin), Postes (instance), Flotte, Chauffeurs, Habilitations, Immobilisations, Sites (fermetures) ; produit les voyages suivis au chapitre 12.

### J. Exercice
Affectez un camion qui a une immobilisation ouverte. Résultat attendu : refus du serveur.

### K. Glossaire du module
- **Recommandation** : proposition calculée, jamais appliquée sans décision.
- **Plan de shift** : nombre de voyages confirmé pour une instance, versionné.
- **Suspension** : arrêt tracé d'un voyage, levé par une reprise motivée.

---

## 12. Voyages et rotations

### A. Présentation
Le voyage est l'objet central de la chaîne : chargement sur le site, route, réception et pesée au dépôt CBG, livraison, puis réconciliation. Une rotation est le rang du voyage dans le shift du camion.

### B. Principes métier
- L'état ne change que par les fonctions du cycle ; chaque passage est inscrit au journal, non modifiable (heure réelle, auteur, données de pesée).
- Phases et états : Prévu (Brouillon, Planifié, Affecté), Chargement (Au chargement, En chargement, Chargé, Pesé au départ facultatif), Route (En route), Déchargement (À destination, En déchargement, Pesé à l'arrivée facultatif), Livré (Livré, puis Accepté, En litige ou Rejeté, puis Clôturé), Exceptions (Annulé, Interrompu).
- Une heure n'est ni absente, ni future, ni antérieure au dernier événement.
- Annuler, interrompre, contester ou rejeter demande un motif. Annulation possible jusqu'à « Pesé au départ » ; interruption d'« En chargement » à « En déchargement ».
- La pesée à l'arrivée exige le numéro du ticket CBG ; un ticket déjà utilisé sur un autre voyage est refusé ; brut supérieur à la tare ; poids en tonnes.
- Si le contrôle avant départ est exigé, « Affecté » vers « Au chargement » est refusé sans contrôle du jour conforme.
- Un voyage engagé ne se supprime pas : il s'annule.

### C. Navigation
Menu **Voyages & Rotations** (`#/trips`) ou **Opérations transport > Registre des voyages** ; fiche du voyage `#/trips/<identifiant>` ; actions en pages `#/trips/<identifiant>/<action>` (étape, ticket, vérifier, suspendre, reprendre, justifier-absence). Le registre lit le camion et le chauffeur du contexte de l'adresse et l'annonce par un bandeau.

### D. Écrans
Figure 12.1 (capture à venir) : registre des voyages avec filtres et contexte (date, site, shift).
Figure 12.2 (capture à venir) : création d'un voyage.
Figure 12.3 (capture à venir) : page de saisie de l'étape et de la pesée (`#/trips/<identifiant>/etape`).
Figure 12.4 (capture à venir) : fiche opérationnelle du voyage, onglets Synthèse, Affectations, Étapes, Chronologie, Fiches, Tickets CBG (officiel CBG et saisie KOGON distincts), Documents et preuves, Incidents, Anomalies, Contrôles, Historique.
Figure 12.5 (capture à venir) : action Vérifier un événement.
Figure 12.6 (capture à venir) : rattacher un ticket CBG avec motif.
Figure 12.7 (capture à venir) : bouton Enchaîner le voyage suivant.
Figure 12.8 (capture à venir) : déclaration d'incident depuis le voyage.
Figure 12.9 (capture à venir) : rapports par axe.
Figure 12.10 (capture à venir) : onglet Contrôles, contrôle « fiche présente » et bouton **Justifier l'absence de fiche**.
Figure 12.11 (capture à venir) : page de justification de l'absence de fiche (motif, document).

### E. Actions disponibles
Créer un voyage ; avancer le cycle ; annuler, interrompre, contester, rejeter (motif) ; rattacher un ticket CBG ; enchaîner le voyage suivant ; suspendre, reprendre ; vérifier, valider ou contester un événement déclaré ; déclarer un incident ; joindre une pièce ; rapports par axe et export CSV.

### F. Procédures pas à pas
**12.F.1 Créer un voyage hors dispatch** : **Créer le voyage**, date, origine, destination, camion et chauffeur facultatifs ; référence `VYG-AAMMJJ-NNN` attribuée. État Affecté si camion et chauffeur, sinon Planifié.

**12.F.2 Avancer le cycle**
- Accès : fiche du voyage, bouton de l'étape suivante : la saisie s'ouvre en page (`#/trips/<identifiant>/etape`).
- Saisie : étape suivante, heure réelle ; à l'arrivée au dépôt : ticket CBG, brut, tare (tonnes).
- Contrôles : ordre des étapes, heures, ticket unique.
- Résultat : nouvel état, événement au journal.
- Erreurs : « Transition non autorisee », « Heure anterieure au dernier evenement », « Ticket de pesee ... deja utilise sur un autre voyage ».

**12.F.3 Lire la fiche opérationnelle** : chronologie des événements de toutes les sources (dispatch, fiches, tickets, rapprochements, pièces) ; onglet Contrôles : affectation valide, chauffeur habilité, étapes cohérentes, km cohérents, fiche présente, ticket associé, pas de double comptage.

**12.F.4 Vérifier un événement** : sur un événement déclaré, **Vérifier** puis, par une autre personne, valider ; ou contester avec motif. L'auteur de la saisie ne vérifie pas.

**12.F.5 Rattacher un ticket remis en retard** : voyage livré sans ticket, **Rattacher le ticket CBG**, numéro, poids, motif du retard. Sans ticket, le voyage n'est pas facturable.

**12.F.6 Enchaîner le voyage suivant** : sur un voyage livré, **Enchaîner le voyage suivant** ; le même camion et le même chauffeur prennent un voyage préparé du même site ou un nouveau voyage sur le même trajet. Refusé si l'un est engagé ailleurs ou si une contrainte du dispatch n'est pas remplie.

**12.F.8 Justifier l'absence de fiche terrain** (D-088 complément) : pour un voyage pesé ou livré sans fiche, onglet **Contrôles**, **Justifier l'absence de fiche** ; saisir le motif (10 caractères au moins) et, si possible, la référence du document. Le contrôle « fiche présente » affiche alors « justifié ». La justification se retire par **Retirer la justification** (motif). Chaque justification est conservée (aucune modification) ; si quelqu'un a justifié entre-temps, l'envoi est refusé et il faut recharger. Droit `trips` et site du voyage exigés.

**12.F.7 Rapports par axe** : **Rapports par axe**, axe (camion, chauffeur, site de chargement, shift), période de 367 jours au plus ; export CSV.

### G. Exemple pratique
Voyage d'exemple VYG-261117-004 : affecté à 06:20, au chargement 06:35, chargé 07:10, en route 07:15, à destination 08:40, pesé à l'arrivée avec le ticket CBG 55231 (brut 62,4 t, tare 21,9 t, net 40,5 t), livré 08:55.

### H. Cas particuliers et erreurs
- Erreur sur une étape déjà enregistrée : il n'existe pas de correction d'étape ; contester l'événement (12.F.4) et, si nécessaire, annuler le voyage selon les règles.
- Ticket saisi au départ : refusé, le ticket appartient à la réception au dépôt.

### I. Relations avec les autres modules
Dispatch (affectation), Fiches terrain (FR), Pesée CBG, Kilométrage, Incidents, Réconciliation.

### J. Exercice
Tentez de passer un voyage de « Chargé » directement à « Livré ». Résultat attendu : « Transition non autorisee ».

### K. Glossaire du module
- **Rotation** : rang du voyage du camion dans le shift.
- **Événement déclaré, vérifié, validé, contesté** : statut de vérification d'un événement.

---

## 13. Kilométrage

### A. Présentation
Établit des kilomètres vérifiables par voyage, notamment pour contrôler un tarif de location au kilomètre.

### B. Principes métier
Cinq notions distinctes : distance de référence (référentiel site à site, avec sa source), déclarée, mesurée (deux relevés d'odomètre), validée (décision humaine), facturable (trajet chargé, plus retour à vide si le tarif le prévoit). Rien n'est estimé : sans distance validée, les kilomètres sont « non vérifiables ».

### C. Navigation
Menu **Kilométrage**.

### D. Écrans
Figure 13.1 (capture à venir) : distances de référence.
Figure 13.2 (capture à venir) : relevés de compteur d'un voyage, avec pièce jointe (photo du compteur).
Figure 13.3 (capture à venir) : validation de la distance.

### E. Actions disponibles
Créer ou désactiver une distance de référence (droit `contracts` ou administrateur) ; saisir un relevé ; corriger un relevé (motif) ; valider la distance d'un voyage (droit `contracts`) ; joindre une photo.

### F. Procédures pas à pas
**13.F.1 Saisir une distance de référence** : origine, destination, distance, source ; enregistrer. Une distance se désactive, ne se supprime pas.

**13.F.2 Saisir un relevé** : voyage, moment (départ chargé, arrivée dépôt, fin de rotation, autre), source (fiche, saisie, photo, GPS), valeur, heure. Contrôles : valeur positive, heure non future, cohérente avec les relevés précédent et suivant de l'engin. Un relevé existant pour le même voyage et le même moment se corrige avec motif (le nouveau remplace l'ancien, qui reste visible).

**13.F.3 Valider une distance** : voyage livré ; validateur autre que l'auteur des relevés ; motif si la distance diffère de la mesure ou si la mesure manque. Chaque validation est une version.

### G. Exemple pratique
Relevés d'exemple 120 345 km au départ chargé et 120 389 km à l'arrivée : mesure 44 km ; référence 45 km ; le chargé de contrats valide 44 km sans motif.

### H. Cas particuliers et erreurs
Le rapport d'engagements lit encore les anciens champs de compteur du voyage, pas les distances validées.

### I. Relations avec les autres modules
Voyages ; contrôle des factures Neemba au kilomètre (chapitre 27).

### J. Exercice
Validez une distance dont vous avez saisi les relevés. Résultat attendu : refus (séparation, réglage `kilometrage_validation_separee` exigé par défaut).

### K. Glossaire du module
- **Distance facturable** : distance validée du trajet chargé, plus retour à vide si prévu au tarif.

---

## 14. Fiches terrain

### A. Présentation
Les fiches terrain sont des fiches papier numérotées par le serveur, préparées pour une date, un site et un shift, imprimées, remises à un agent, retournées signées, saisies, contrôlées et validées. La fiche signée est la preuve des heures et des tonnages.

| Type | Préfixe | Contenu | Droit d'écriture |
|---|---|---|---|
| Rotations camion | FR | Rotations d'un camion pour le shift | `trips` |
| Pointage des engins | FP | Horamètres, arrêts et causes | `maintenance` |
| Carburant | FC | Distribution : engin, litres, compteur | `fuel` |

### B. Principes métier
- Seize états : À préparer, Préparée, À imprimer, Imprimée, À remettre, Remise à l'agent, En utilisation, Retournée, À saisir, Saisie en cours, Saisie terminée, À contrôler, À corriger, Validée, Archivée, Annulée.
- L'état ne change que par les actions du cycle ; une fiche validée, archivée ou annulée est figée.
- Le contrôle relève les écarts sans rien corriger (FR : voyage sans ligne, ticket CBG absent ou différent, km contre relevés... ; FP : horamètre en recul, arrêt sans immobilisation... ; FC : sans cuve, solde de cuve insuffisant...).
- La validation revient à une autre personne que tout auteur de la saisie ; motif si des écarts subsistent.
- Chaque arrêt saisi sur une FP devient une immobilisation de l'engin. Le prix du litre n'est jamais saisi sur une FC.

### C. Navigation
Menu **Fiches terrain** (liste, préparation `#/fiches/nouveau`, lots d'impression, de remise et de retour `#/fiches/lot/<action>?ids=...`) ; fiche `#/fiches/<identifiant>` avec ses actions en pages `#/fiches/<identifiant>/<action>` (imprimer, remettre, retour, saisir-ligne, saisir-pointage, saisir-carburant, terminer-saisie, soumettre, controler, renvoyer, valider, archiver, annuler) ; **Opérations transport > Cycle des fiches**. Le camion et le chauffeur du contexte filtrent la liste (bandeau avec retrait).

### D. Écrans
Figure 14.1 (capture à venir) : liste des fiches d'une date, d'un site et d'un shift, boutons de préparation.
Figure 14.2 (capture à venir) : fiche imprimable A4 (rotations en paysage).
Figure 14.3 (capture à venir) : remise à l'agent et retour.
Figure 14.4 (capture à venir) : saisie d'une FR (heures, ticket CBG, brut et tare en tonnes).
Figure 14.5 (capture à venir) : saisie d'une FP (opérateur, horamètres, arrêts).
Figure 14.6 (capture à venir) : saisie d'une FC (engin, chauffeur, litres, servi depuis, compteur).
Figure 14.7 (capture à venir) : fin de saisie et soumission au contrôle.
Figure 14.8 (capture à venir) : résultat du contrôle (écarts), boutons Renvoyer en correction et Valider.
Figure 14.9 (capture à venir) : annulation motivée.

### E. Actions disponibles
Préparer ; enregistrer l'impression (réimpression motivée) ; remettre à l'agent ; enregistrer le retour ; saisir (FR, FP, FC) ; saisir une rotation reliée au voyage ; terminer la saisie ; soumettre au contrôle ; contrôler ; renvoyer en correction ; valider ; archiver ; annuler (motif).

### F. Procédures pas à pas
**14.F.1 Préparer** : choisir date, site, shift ; **Préparer N fiche(s) de rotations** (une par camion ayant des voyages du dispatch), **Préparer la fiche de pointage**, **Préparer la fiche carburant**.

**14.F.2 Imprimer** : **Imprimer les fiches préparées**, puis enregistrer l'impression ; une réimpression demande un motif.

**14.F.3 Remettre et recevoir** : fiche, **Remettre à l'agent** (nom de l'agent, heure non future) ; au retour, **Enregistrer le retour**.

**14.F.4 Saisir une FR** : pour chaque voyage du camion : heures dans l'ordre (arrivée chargement, début et fin de chargement, départ, arrivée destination, début et fin de déchargement), puis pesée CBG au dépôt (heure, numéro de ticket, brut et tare en tonnes, référence). **Enregistrer** la ligne : message vert (état atteint) ou rouge (raison du refus). Une étape déjà enregistrée est ignorée.

**14.F.5 Saisir une FP** : pour chaque engin : opérateur, horamètre début et fin, observations ; **Arrêt** pour chaque arrêt (début, fin, cause, imputation obligatoires sauf la fin) ; **Enregistrer**.

**14.F.6 Saisir une FC** : une ligne par plein : engin, chauffeur, litres, « Servi depuis » (cuve suivie ou hors stockage suivi), compteur ou horamètre ; **Enregistrer les pleins**.

**14.F.7 Terminer et soumettre** : **Terminer la saisie**, puis **Soumettre au contrôle**.

**14.F.8 Contrôler et valider** : un contrôleur lance **Contrôler** ; il lit les écarts ; **Renvoyer en correction** (motif) ou, s'il n'est pas auteur de la saisie, **Valider** (motif si écarts) ; puis **Archiver**.

**14.F.9 Annuler** : **Annuler la fiche**, motif ; refusé si la fiche est déjà portée par un ticket, un événement de voyage ou une sortie de stock, ou si elle est à contrôler.

### G. Exemple pratique
Fiche FR d'exemple du camion AB-1234 : 3 rotations saisies ; le contrôle relève « ticket CBG absent » sur la troisième ; la fiche est renvoyée en correction ; l'agent saisit le ticket ; un autre contrôleur valide.

### H. Cas particuliers et erreurs
- « Aucun voyage de ce camion à cette date » : les voyages se préparent au Dispatch.
- « Fiche ... close » : fiche déjà saisie ou annulée.
- « Index d'horametre incoherents (fin inferieure au debut) ».
- La saisie anticipée avant retour reste possible et est tracée.
- Le brouillon de saisie est enregistré sur le serveur (`enregistrer_brouillon_fiche`) et repris à la saisie suivante.
- Impression, remise et retour se font fiche par fiche ou par lot de fiches sélectionnées dans la liste.
- La création de lots numérotés (LF-AAMMJJ-NNN) et l'attribution de fiches à un agent existent côté serveur (`creer_lot_fiches`, `attribuer_fiches`) sans écran.

### I. Relations avec les autres modules
Dispatch (voyages), Voyages (étapes), Pesée (ticket), Immobilisations (arrêts FP), Carburant (sorties FC à valider au registre, écrites à la validation pour les lignes du cycle).

### J. Exercice
Validez une fiche dont vous avez saisi une ligne. Résultat attendu : refus (séparation des tâches).

### K. Glossaire du module
- **FR, FP, FC** : fiche de rotations, de pointage, carburant.
- **Écart de contrôle** : différence relevée par le contrôle, sans correction automatique.

---

## 15. Pesée CBG

### A. Présentation
**CBG pèse, KOGON observe.** Le relevé officiel CBG (source A) et la fiche terrain KOGON (source B) sont conservés séparément puis rapprochés. La fiche KOGON n'est jamais un second ticket officiel ; une valeur CBG n'est jamais modifiée ; un cas ambigu n'est jamais tranché par le système. Poids en tonnes.

### B. Principes métier
- Un relevé CBG exige ticket, date et poids sur chaque ligne, sinon tout le fichier est refusé ; un même fichier ne s'importe qu'une fois (empreinte SHA-256).
- La tolérance (t et %) se paramètre par site ou globalement, versionnée ; sans paramètre, tout écart non nul est signalé.
- Une anomalie ouverte sur un voyage bloque sa ligne de réconciliation jusqu'à décision motivée.
- La clôture d'une anomalie revient à une autre personne que celles qui ont conclu et soumis (droit `invoices`).

### C. Navigation
Menu **Pesée CBG** (`#/tickets-cbg`) ou **Opérations transport > Tickets et relevés CBG** ; quatre espaces adressables : **A. Relevés officiels CBG** (`#/tickets-cbg/releves`), **B. Fiches terrain KOGON** (`#/tickets-cbg/fiches`), **C. Rapprochement** (`#/tickets-cbg/rapprochement`), **D. Anomalies et validations** (`#/tickets-cbg/anomalies`). Les pièces jointes d'un relevé s'ouvrent en page.

### D. Écrans
Figure 15.1 (capture à venir) : espace A, import CSV, aperçu, lignes rejetées et motif, pièces jointes du relevé.
Figure 15.2 (capture à venir) : annulation d'un relevé avec motif.
Figure 15.3 (capture à venir) : espace B, fiche KOGON (ticket, heure, camion, chauffeur, poids, anomalie signalée), boutons Enregistrer le brouillon et Envoyer la fiche.
Figure 15.4 (capture à venir) : espace C, lecture côte à côte CBG et KOGON, écart en t et %, constats ; tolérance en bas.
Figure 15.5 (capture à venir) : espace D, anomalie, actions Examiner, conclusions, Soumettre, Clôturer, Renvoyer.
Figure 15.6 (capture à venir) : rectification d'un ticket.
Figure 15.7 (capture à venir) : voyages livrés sans ticket.

### E. Actions disponibles
Importer un relevé ; annuler un relevé ; saisir, envoyer, corriger une fiche KOGON ; rapprocher (chaque passe conservée) ; paramétrer la tolérance (droit `settings`) ; examiner, demander une vérification, confirmer la concordance, accepter un écart justifié (référence de preuve obligatoire pour un écart de poids), signaler une erreur CBG ; soumettre ; clôturer ou renvoyer en examen ; rectifier un ticket.

### F. Procédures pas à pas
**15.F.1 Importer un relevé CBG** : préparer le CSV (Excel : enregistrer sous CSV) avec ticket, date, net (ou brut et tare), immatriculation ; espace A, choisir le fichier, lire l'aperçu, envoyer. Joindre le fichier original dans les pièces jointes du relevé.

**15.F.2 Annuler un relevé importé par erreur** : par une personne ayant le droit facturation et autre que l'importateur, motif, tant qu'aucun voyage n'est dans une réconciliation close.

**15.F.3 Saisir une fiche KOGON** : site (obligatoire), rotation si connue, ticket, heure, camion, chauffeur, brut et tare (ou net) ; cocher « L'agent signale une anomalie » et la décrire si besoin. **Enregistrer le brouillon** (sur ce poste seulement) ou **Envoyer la fiche**. Renvoyer après un échec réseau ne crée pas de doublon. Corriger après envoi : **Corriger**, motif.

**15.F.4 Rapprocher** : espace C, choisir le relevé, **Rapprocher** ; lire les constats : Concordant, Concordant avec réserve, Écart de poids, Ticket CBG sans fiche KOGON, Fiche KOGON sans ticket CBG, Ticket dupliqué, Camion non reconnu, Rotation non retrouvée, Données incomplètes, À examiner.

**15.F.5 Traiter une anomalie** : espace D, ouvrir, **Examiner**, conclure (concordance confirmée, écart justifié avec référence, erreur CBG signalée, vérification demandée), **Soumettre à validation** ; le validateur **Clôture** ou **Renvoie en examen** (motif).

**15.F.6 Rectifier un ticket** : droits `trips` et `invoices`, motif, autre personne que l'auteur du ticket, session aal2 si la MFA est exigée ; refusé si la réconciliation est clôturée (passer par un avoir).

### G. Exemple pratique
Relevé CBG d'exemple du 17 novembre, 40 lignes : 37 concordantes, 2 concordantes avec réserve (écart 0,1 t dans la tolérance de 0,2 t), 1 écart de poids (0,8 t). Le contrôleur examine, accepte l'écart justifié avec la référence du bon CBG ; le validateur finance clôture.

### H. Cas particuliers et erreurs
- Sans relevé CBG, la ligne de réconciliation porte « sans relevé CBG » (bloquante, forçable par décision motivée).
- Un ticket rectifié rend aujourd'hui le voyage non facturable (question ouverte au propriétaire).
- Pas d'import PDF ni d'OCR.

### I. Relations avec les autres modules
Voyages et Fiches (source B), Réconciliation (tonnage officiel), Centre des décisions (voyage livré sans ticket).

### J. Exercice
Importez deux fois le même fichier. Résultat attendu : second import refusé (empreinte identique).

### K. Glossaire du module
- **Source A** : relevé officiel CBG. **Source B** : relevé observé par KOGON.
- **Tolérance** : écart admis en t et en %, versionné.

---

## 16. Opérations transport

### A. Présentation
Espace de menu qui regroupe la chaîne transport : vue générale, alias vers les modules, journal des événements, anomalies et écarts, contrôles et clôtures.

### B. Principes métier
- Le voyage est l'objet central ; aucun module n'en crée de copie.
- Le journal lit les événements à leur source, sans recopie : dispatch, suspensions, étapes, fiches, tickets et rectifications, relevés, rapprochements, anomalies, pièces jointes, vérifications.
- Les contrôles produisent des constats sans rien écrire.
- Le contexte (date, site, shift, camion, chauffeur, voyage, rotation) suit dans l'adresse entre les écrans de l'espace.

### C. Navigation
**Opérations transport** : Vue générale, Objectifs planifiés, Instances de shift, Affectation des voyages, Registre des voyages, Cycle des fiches, Tickets et relevés CBG, Supervision du jour, Anomalies et écarts, Journal des événements, Contrôles et clôtures.

### D. Écrans
Figure 16.1 (capture à venir) : vue générale de l'espace.
Figure 16.2 (capture à venir) : journal des événements (voyage, événement, opération, saisie, source, statut, justificatif).
Figure 16.3 (capture à venir) : anomalies et écarts (catégorie, gravité, statut, ouverte le, traitement).
Figure 16.4 (capture à venir) : contrôles et clôtures.
Figure 16.5 (capture à venir) : registre filtré par le contexte camion, bandeau « Filtré par le contexte ».

### E. Actions disponibles
Filtrer ; ouvrir la fiche du voyage ; vérifier un événement (depuis la fiche du voyage).

### F. Procédures pas à pas
**16.F.1 Retrouver l'historique complet d'un voyage** : Journal des événements, filtrer sur le voyage ou le camion, lire les lignes par date d'opération ; ouvrir le voyage.
**16.F.2 Suivre les anomalies** : Anomalies et écarts, filtrer par gravité, ouvrir l'anomalie dans Pesée CBG espace D pour la traiter.
**16.F.3 Contrôler la journée** : Contrôles et clôtures, date et site ; lire les constats par voyage (fiche absente, ticket absent, étapes incohérentes...).

### G. Exemple pratique
Le responsable des opérations ouvre Contrôles et clôtures pour la veille : 2 voyages sans fiche FR rattachée ; il ouvre chacun, puis la fiche du camion dans Fiches terrain.

### H. Cas particuliers et erreurs
Le registre des voyages, le Dispatch et les Fiches terrain lisent aussi le camion et le chauffeur du contexte ; un bandeau bleu « Filtré par le contexte » l'annonce, avec **Retirer ce filtre** (jamais appliqué en silence). Shifts et Pesée CBG ne lisent du contexte que la date.

### I. Relations avec les autres modules
Planification, Postes, Dispatch, Voyages, Fiches, Pesée CBG.

### J. Exercice
Depuis le journal, ouvrez un voyage puis revenez par le bouton retour du navigateur. Résultat attendu : le journal garde ses filtres.

### K. Glossaire du module
- **Journal des événements** : vue unique des événements d'un voyage, toutes sources.

---

## 17. Véhicules et engins

### A. Présentation
Registre des engins : camions semi-remorques, chargeuses, pelle, loués à Neemba ou appartenant à l'exploitant.

### B. Principes métier
- Pas de suppression physique : un engin se suspend, se remet en service ou se réforme, avec motif, au journal de flotte.
- Le statut « immobilisé » ou « en maintenance » est posé par la déclaration d'une immobilisation (chapitre 21) ; le Dispatch le lit sans autre saisie.
- Un engin créé par un profil rattaché à un site est enregistré sur ce site.
- L'unité de facturation de la location (km, heure, tonne, jour, mois, forfait) se choisit engin par engin dans le contrat (chapitre 27), pas ici.

### C. Navigation
**Flotte > Véhicules et engins** (page standard `#/vehicles`).

### D. Écrans
Figure 17.1 (capture à venir) : liste des engins et fiche (informations, relations : voyages, pleins, contrôles, immobilisations, documents ; historique).
Figure 17.2 (capture à venir) : formulaire d'engin.
Figure 17.3 (capture à venir) : propriété et rattachement au contrat de location.
Figure 17.4 (capture à venir) : actions Suspendre, Remettre en service, Réformer avec motif.

### E. Actions disponibles
Créer, modifier ; définir la propriété et rattacher à un contrat de location ; suspendre, remettre en service, réformer (motif) ; exporter la liste en CSV.

### F. Procédures pas à pas
**17.F.1 Consulter un engin** : liste, filtre, clic, onglets.
**17.F.2 Créer un engin** : **Nouveau**, immatriculation, type, marque et modèle, site, capacité ; enregistrer.
**17.F.3 Rattacher au contrat Neemba** : fiche, propriété (loué), choisir le contrat parmi les contrats rattachables ; enregistrer. Sans ce rattachement, l'évaluation de Neemba reste sans données.
**17.F.4 Suspendre un engin** : fiche, **Suspendre**, motif ; **Remettre en service** pour lever.

### G. Exemple pratique
Le camion d'exemple AB-1234 est rattaché au contrat Neemba d'exemple ; il apparaît dans les mesures de l'évaluation du loueur.

### H. Cas particuliers et erreurs
Pas d'import en masse du registre ; pièces jointes non disponibles sur un engin.

### I. Relations avec les autres modules
Dispatch, Voyages, Carburant, Pneus, Immobilisations, Contrats, Documents.

### J. Exercice
Suspendez un engin sans motif. Résultat attendu : refus.

### K. Glossaire du module
- **Engin loué** : engin dont le propriétaire est Neemba, rattaché à un contrat de location.

---

## 18. Chauffeurs, habilitations et infractions

### A. Présentation
Registre des chauffeurs, de leurs habilitations (visite médicale, formation sécurité, habilitation engin, accès site, autre) et de leurs infractions.

### B. Principes métier
- Une habilitation ne se supprime pas : elle se révoque, avec date et motif, définitivement.
- L'administrateur choisit les types exigés pour être affecté à un voyage ; sans type exigé, aucune contrainte. Le permis est toujours contrôlé.
- Une infraction est numérotée par le serveur ; la sanction est décidée par un titulaire de l'approbation `drivers` ; une sanction ne bloque pas le dispatch, elle s'affiche en avertissement.
- Limite : suspension, réactivation et archivage d'un chauffeur se font sans motif (aucun journal).

### C. Navigation
**Flotte > Chauffeurs** (`#/drivers`) ; **Flotte > Habilitations chauffeurs**.

### D. Écrans
Figure 18.1 (capture à venir) : liste et fiche du chauffeur.
Figure 18.2 (capture à venir) : formulaire du chauffeur.
Figure 18.3 (capture à venir) : actions Suspendre, Réactiver, Archiver.
Figure 18.4 (capture à venir) : habilitations, types exigés, habilitations à renouveler (expirées ou sous 30 jours).
Figure 18.5 (capture à venir) : infractions et décision de sanction.

### E. Actions disponibles
Créer, modifier un chauffeur ; suspendre, réactiver, archiver ; saisir et révoquer une habilitation ; définir les types exigés (administrateur) ; enregistrer une infraction ; décider, annuler une sanction ; annuler une infraction.

### F. Procédures pas à pas
**18.F.1 Consulter un chauffeur** : liste, clic, onglets.
**18.F.2 Créer un chauffeur** : **Nouveau**, nom, numéro et date d'expiration du permis, téléphone, site ; les dates vides ne sont pas exigées.
**18.F.3 Suspendre** : fiche, **Suspendre** (aucun motif conservé).
**18.F.4 Saisir une habilitation** : Habilitations chauffeurs, chauffeur, type, numéro, délivrance, expiration ; enregistrer. Révoquer : date et motif.
**18.F.5 Enregistrer une infraction et sanctionner** : fiche du chauffeur, **Infractions**, type, source, date et heure, constat ; un approbateur décide la sanction (motif). Corriger : annuler la décision (motif) puis décider à nouveau.

### G. Exemple pratique
Le type « visite médicale » est exigé ; le chauffeur d'exemple C. Exemple a une visite expirée la veille : le dispatch refuse son affectation avec « Chauffeur non habilite le ... ».

### H. Cas particuliers et erreurs
Pas de séparation entre la personne qui déclare une infraction et celle qui la sanctionne (à confirmer par le propriétaire).

### I. Relations avec les autres modules
Dispatch (contraintes), Postes (équipe), Centre des décisions (habilitation expirée), RH (lien par matricule).

### J. Exercice
Révoquez une habilitation sans motif. Résultat attendu : refus.

### K. Glossaire du module
- **Habilitation exigée** : type d'habilitation sans lequel un chauffeur n'est pas affecté.

---

## 19. Documents des engins

### A. Présentation
Registre des documents des engins (assurance, carte grise, visite technique) et alertes d'expiration.

### B. Principes métier
Les alertes (expirés ou sous 30 jours) viennent du serveur ; un document remplacé par un plus récent n'alerte plus. Le registre contient les métadonnées (type, numéro, dates), pas le fichier.

### C. Navigation
**Flotte > Documents**.

### D. Écrans
Figure 19.1 (capture à venir) : liste des documents et documents à renouveler.

### E. Actions disponibles
Créer, modifier, archiver un document (droit `vehicles`).

### F. Procédures pas à pas
**19.F.1 Enregistrer un document** : engin, type, numéro, dates de validité ; enregistrer. Archiver un document obsolète.

### G. Exemple pratique
Assurance d'exemple expirant dans 20 jours : elle apparaît dans les documents à renouveler et produit une alerte « document expiré » à échéance.

### H. Cas particuliers et erreurs
Pas de fichier joint, pas d'export, pas de recherche dans les documents.

### I. Relations avec les autres modules
Véhicules, Centre des décisions.

### J. Exercice
Saisissez un document expiré hier. Résultat attendu : il figure dans les documents à renouveler.

### K. Glossaire du module
- **Document à renouveler** : document expiré ou expirant sous 30 jours, non remplacé.

---

## 20. Carburant

### A. Présentation
CBG livre le carburant ; KOGON le réceptionne en cuve, le transfère, le distribue aux engins, l'inventorie et contrôle la facture CBG.

### B. Principes métier
- Le prix du litre se saisit à chaque livraison, jamais deviné ; la consommation est valorisée au prix des livraisons de la période.
- Le stock d'une cuve est la somme de ses mouvements validés ; il reste « sans données » tant qu'un inventaire d'ouverture n'est pas validé.
- Les mouvements ne se modifient ni ne se suppriment : ils s'annulent par un contre-mouvement à valider.
- Mouvements et inventaires sont validés par une autre personne (réglage `carburant_validation_separee`, exigé par défaut).

### C. Navigation
**Carburant** : **Distribution aux engins**, **Livraisons et factures CBG**, **Réceptions, cuves et inventaires**, **Analyse carburant**, **Anomalies**, **Jauges connectées**.

### D. Écrans
Figure 20.1 (capture à venir) : distribution aux engins, bouton Saisir.
Figure 20.2 (capture à venir) : livraisons et factures CBG, contrôle (conforme ou à examiner), pièces jointes de la livraison.
Figure 20.3 (capture à venir) : cuves et citernes (capacité, seuil, stock).
Figure 20.4 (capture à venir) : réception d'une livraison (volumes mesuré et accepté, méthode, motif d'écart).
Figure 20.5 (capture à venir) : transfert.
Figure 20.6 (capture à venir) : inventaire et décision.
Figure 20.7 (capture à venir) : mouvements à valider.
Figure 20.8 (capture à venir) : analyse carburant (litres par tonne et par heure).
Figure 20.9 (capture à venir) : anomalies carburant et seuil saisi.
Figure 20.10 (capture à venir) : jauges connectées (sans données).

### E. Actions disponibles
Plein isolé ; livraison CBG ; facture CBG et contrôle ; cuves et citernes ; réception ; transfert ; inventaire et décision ; validation, rejet, annulation de mouvement ; analyses ; joindre le bon de livraison.

### F. Procédures pas à pas
**20.F.1 Saisir un plein isolé** : Distribution aux engins, **Saisir** : date, engin, chauffeur, site, litres, compteur, note. Ne crée pas de sortie de cuve suivie ; pour une cuve suivie, utiliser la fiche FC (14.F.6).
**20.F.2 Enregistrer une livraison puis la facture CBG** : référence, date, site, litres, prix unitaire ; joindre le bon. Facture : référence, date, montant, livraisons rattachées (une livraison n'appartient qu'à une facture) ; **Contrôler** : écart nul = conforme, sinon à examiner.
**20.F.3 Créer une cuve** : type (cuve fixe, citerne mobile), site, capacité, seuil d'alerte.
**20.F.4 Réceptionner une livraison** : cuve du site, date, volume mesuré, volume accepté (au plus le mesuré), méthode (jauge, pige, compteur, autre), motif si écart au document CBG. Entrée à valider.
**20.F.5 Transférer** : source, destination, quantité ; sortie et entrée liées, décidées ensemble.
**20.F.6 Inventorier** : volume mesuré (entre 0 et la capacité) ; refusé si un inventaire ou des mouvements attendent une décision ; une autre personne décide ; refusé si le solde a changé depuis la mesure (« saisissez un nouvel inventaire »).
**20.F.7 Valider un mouvement** : par une autre personne ; rejet motivé. Annuler un mouvement validé : motif, contre-mouvement à valider.

### G. Exemple pratique
Livraison d'exemple 30 000 l ; réception mesurée 29 850 l, acceptée 29 850 l, motif « écart de jauge » ; validée par le responsable carburant ; l'inventaire du soir constate 120 l de moins que le théorique : validé avec ajustement de -120 l, l'alerte d'écart s'affiche si le seuil est saisi.

### H. Cas particuliers et erreurs
- Pas de correction tracée d'une livraison ou d'une facture CBG déjà saisie.
- Jauges connectées : aucun matériel, écran sans données.
- L'ancien solde saisi à la main est en lecture seule.

### I. Relations avec les autres modules
Fiches FC, Engins, Sites, Coûts, Centre des décisions, Mes validations.

### J. Exercice
Validez un mouvement que vous avez saisi. Résultat attendu : refus.

### K. Glossaire du module
- **Inventaire d'ouverture** : premier inventaire validé d'une cuve, point de départ du stock.
- **Contre-mouvement** : mouvement inverse qui annule un mouvement validé.

---

## 21. Maintenance et immobilisations

### A. Présentation
Les engins sont loués à Neemba, qui assure leur maintenance. SIGTB trace les arrêts (immobilisations) et les interventions du loueur. Les écrans Ordres de travail et Préventif servent à la maintenance interne.

### B. Principes métier
- Immobilisation : début et fin horodatés, cause (panne, maintenance planifiée, pneumatique, accident, attente de pièce, autre), imputation choisie (loueur, exploitant, à déterminer, sans valeur par défaut).
- Une seule immobilisation ouverte par engin ; jamais de chevauchement ; l'engin passe immobilisé (en maintenance si planifiée), puis redevient actif à la clôture.
- Intervention Neemba rattachée à une immobilisation imputée au loueur ou à déterminer ; délai contractuel saisi à la demande, jamais supposé ; remise en service validée par une autre personne que celle qui a saisi la fin.

### C. Navigation
**Maintenance** : **Immobilisations**, **Interventions Neemba**, **Ordres de travail**, **Préventif**.

### D. Écrans
Figure 21.1 (capture à venir) : immobilisations ouvertes et closes, déclaration.
Figure 21.2 (capture à venir) : intervention Neemba (demandée, prise en charge, terminée, remise validée), délai calculé.
Figure 21.3 (capture à venir) : ordres de travail et pièces sorties du stock.
Figure 21.4 (capture à venir) : plan préventif interne.

### E. Actions disponibles
Déclarer, clôturer, corriger (motif), annuler (motif) une immobilisation ; demander, prendre en charge, terminer une intervention, valider ou refuser la remise en service ; créer, suivre, annuler (motif) un ordre de travail et lui sortir des pièces ; tenir un plan préventif.

### F. Procédures pas à pas
**21.F.1 Déclarer puis clôturer une immobilisation** : engin, début, cause, imputation, description ; enregistrer. Clôturer : heure de fin après le début. Si une intervention du loueur est en cours, la clôture passe par la validation de la remise en service.
**21.F.2 Suivre une intervention Neemba** : depuis l'immobilisation, **Demander** (heure, canal, délai contractuel) ; **Prendre en charge** (technicien du loueur) ; **Terminer** (rapport obligatoire, pièces fournies par) ; une autre personne **Valide la remise en service** (l'immobilisation se clôt) ou refuse (motif, retour à la prise en charge).
**21.F.3 Ordre de travail** : créer (numéro attribué par le serveur), sortir les pièces par mouvement de stock rattaché, terminer ; annuler avec motif en cas d'erreur.
**21.F.4 Préventif** : créer une échéance interne ; un engin rattaché à un contrat de location est signalé (sa maintenance relève de Neemba).

### G. Exemple pratique
Chargeuse d'exemple en panne à 10:00, imputée au loueur ; demande à 10:15 avec délai de 4 h ; prise en charge à 13:00 ; fin à 16:30 ; remise validée à 16:45 par le chef de maintenance (autre que l'auteur de la fin).

### H. Cas particuliers et erreurs
Sans délai contractuel saisi, le retard n'est pas évalué ; pas de portail Neemba.

### I. Relations avec les autres modules
Fiches FP (arrêts), Dispatch (disponibilité), Stocks (pièces), Évaluation Neemba, Centre des décisions.

### J. Exercice
Déclarez une deuxième immobilisation ouverte sur le même engin. Résultat attendu : refus.

### K. Glossaire du module
- **Imputation** : qui porte l'arrêt (loueur, exploitant, à déterminer).
- **Remise en service** : retour de l'engin validé après intervention.

---

## 22. Pneus

### A. Présentation
Gestion du cycle de vie de chaque pneu (D-052, D-091) : carcasse identifiée par un code SIGTB permanent, montages, inspections, interventions et rechapages, stock et mouvements, alertes, coûts. Dix espaces sous le menu **Pneus**, au standard des pages (D-090).

### B. Principes métier
- Chaque carcasse reçoit un code permanent `PN-NNNNNN` ; le numéro de série est unique s'il est fourni ; une carcasse sans numéro se crée avec un motif. Un rechapage ne crée jamais de nouvelle carcasse.
- Le registre est recalculé depuis le journal des opérations (`pneus_operations`), non modifiable ; une correction de caractéristiques est tracée et non annulable ; aucune carcasse n'est supprimée.
- Le prix n'est retenu qu'avec sa source (bon de commande, facture, saisie).
- Montage et permutation contrôlés : position, dimension, état, intervention en cours, engin, périmètre site. Les positions viennent de la configuration du modèle d'engin ; sans configuration, la position est libre, sauf si le réglage `pneu_configuration_exigee` est activé.
- Inspection : date réelle distincte de la saisie, mesures par zone, pression et température seulement si mesurées, constats, recommandation. Un constat critique ouvre une proposition d'immobilisation, jamais une immobilisation automatique.
- Usure et projection seulement avec le nombre de mesures fixé par les seuils (`mesures_min_projection`) ; sans seuil, aucune alerte.
- Remise en service après intervention : décidée par un approbateur maintenance autre que celui qui a enregistré le retour ou le contrôle (séparation des tâches).
- Droits : écriture avec `vehicles` ou `maintenance` en écriture ; décision d'immobilisation avec `maintenance` en écriture ; approbation et paramétrage avec `maintenance` en approbation ; administrateur pour tout.

### C. Navigation
Menu **Pneus** (`#/tires`). Espaces (`#/tires?espace=...`) : **Tableau de bord**, **Registre**, **Montage et positions**, **Inspections**, **Maintenance pneumatique**, **Stocks et mouvements**, **Anomalies et sécurité**, **Performance et durée de vie**, **Coûts et budget**, **Paramétrage**. Fiche du pneu `#/tires/<identifiant>` ; nouvelle carcasse `#/tires/nouveau?objet=carcasse` ; actions `#/tires/<identifiant>/<action>` ; correction `#/tires/<identifiant>/modifier`.

### D. Écrans
Figure 22.1 (capture à venir) : tableau de bord (parc, montés, disponibles, à décider, en intervention, réformés, à surveiller, immobilisants, inspections en retard, dépenses, coût par km, heure et tonne).
Figure 22.2 (capture à venir) : registre (code SIGTB, numéro de série, marque et modèle, dimension, état, engin et position, site, profondeur, km, alertes).
Figure 22.3 (capture à venir) : fiche du pneu, onglets Synthèse, Identification, Caractéristiques, Position actuelle, Montages, Inspections, Interventions, Rechapages, Coûts, Documents, Alertes, Chronologie.
Figure 22.4 (capture à venir) : création d'une carcasse.
Figure 22.5 (capture à venir) : montage et positions (schéma selon la configuration du modèle).
Figure 22.6 (capture à venir) : page de montage.
Figure 22.7 (capture à venir) : page d'inspection détaillée.
Figure 22.8 (capture à venir) : maintenance pneumatique (interventions et rechapages).
Figure 22.9 (capture à venir) : stocks et mouvements.
Figure 22.10 (capture à venir) : anomalies et sécurité (alertes, propositions d'immobilisation).
Figure 22.11 (capture à venir) : performance et durée de vie (usure, épisodes).
Figure 22.12 (capture à venir) : coûts et budget.
Figure 22.13 (capture à venir) : paramétrage (configurations de positions, seuils, critères de rechapage, journal).
Figure 22.14 (capture à venir) : correction tracée des caractéristiques.

### E. Actions disponibles
Depuis la fiche, selon l'état et les droits : **Monter**, **Démonter**, **Permuter**, **Inspecter**, **Transférer**, **Envoyer en intervention**, **Retour d'intervention**, **Annuler l'intervention**, **Contrôler**, **Décider la remise en service**, **Proposer une immobilisation**, **Décider l'immobilisation**, **Réformer**, **Corriger**. Depuis les espaces : créer une carcasse ; paramétrer les configurations, les seuils et les critères de rechapage.

### F. Procédures pas à pas
**22.F.1 Créer une carcasse** : **Pneus > Registre**, nouvelle carcasse ; marque, modèle, dimension, numéro de série (ou motif « sans numéro »), prix avec sa source si connu ; enregistrer. Le code `PN-NNNNNN` est attribué par le serveur.

**22.F.2 Monter un pneu** : fiche d'un pneu disponible, **Monter** ; engin du périmètre, position (proposée par la configuration du modèle), compteur ; enregistrer. Refus si la position est occupée, la dimension différente, le pneu en intervention ou l'engin verrouillé. **Démonter** : motif, état de sortie, compteur au moins égal à celui du montage.

**22.F.3 Inspecter** : **Inspecter** ; date réelle, mesures par zone, pression et température si mesurées, constats, recommandation ; enregistrer. Un défaut critique crée une proposition d'immobilisation à décider.

**22.F.4 Intervention ou rechapage** : **Envoyer en intervention** (type, prestataire ; critères de rechapage) ; au retour, **Retour d'intervention** (coût, pièce) ; **Contrôler** (conforme ou non) ; un approbateur distinct **Décide la remise en service**.

**22.F.5 Paramétrer** : **Paramétrage** ; configuration de positions par modèle d'engin, seuils (profondeur minimale, délai sans inspection, mesures minimales pour la projection...), critères de rechapage. Chaque modification est journalisée.

### G. Exemple pratique
Carcasse d'exemple PN-000002 montée en AV G sur un camion ; inspection à 4 mm sous le seuil paramétré : alerte « à surveiller » ; démontage, envoi en rechapage, retour, contrôle conforme, remise en service décidée par le chef de maintenance.

### H. Cas particuliers et erreurs
- Sans configuration de positions ni seuil, le schéma et les alertes correspondantes restent vides (aucune valeur supposée).
- Un pneu annulé à la réception apparaît « Annulé (réception) ».
- Coût par km affiché seulement si les mesures existent ; sinon « Sans données ».

### I. Relations avec les autres modules
Achats (réception de pneus), Engins (modèle et compteur), Immobilisations (proposition décidée), Pièces jointes (documents du pneu et des inspections).

### J. Exercice
Décidez la remise en service d'une intervention que vous avez vous-même contrôlée. Résultat attendu : refus (séparation des tâches).

### K. Glossaire du module
- **Carcasse** : le pneu physique, identifié par son code SIGTB permanent.
- **Épisode** : période de service d'une carcasse entre deux rechapages.
- **Rechapage** : remise en état de la bande de roulement, sans nouvelle carcasse.

---

## 23. Stocks

### A. Présentation
Stock magasin par article et par dépôt, réservations, lots et séries, valorisation.

### B. Principes métier
- La quantité d'un article dans un dépôt est la somme de ses mouvements ; la quantité affichée sur l'article est recalculée par le serveur.
- Une sortie au-delà du stock disponible est refusée (« Stock insuffisant ») ; un écart se constate par inventaire, jamais par un stock négatif.
- Un mouvement ne se modifie ni ne se supprime : il s'annule (contre-mouvement).
- Réservation pour un ordre de travail ouvert, un engin ou une affectation nommée, jamais au-delà du stock libre ; levée automatique à la clôture de l'ordre.
- Valorisation au coût moyen pondéré ; une entrée sans prix rend la valeur partielle.

### C. Navigation
**Stocks & Achats > Stocks** ; panneaux Réservations, Lots et séries, Valorisation.

### D. Écrans
Figure 23.1 (capture à venir) : mouvements et stock par dépôt.
Figure 23.2 (capture à venir) : articles et dépôts.
Figure 23.3 (capture à venir) : inventaire.
Figure 23.4 (capture à venir) : réservations et valorisation.

### E. Actions disponibles
Entrée, sortie, transfert, retour (numéro MVT) ; annulation (motif) ; créer article et dépôt ; inventaire d'article et de lot ; réserver, lever une réservation ; lire la valorisation.

### F. Procédures pas à pas
**23.F.1 Saisir une sortie** : article, dépôt, quantité, date, réservation éventuelle, imputation ; enregistrer.
**23.F.2 Créer un article** : désignation, unité, mode de suivi (aucun, lot, série ; modifiable seulement sans stock).
**23.F.3 Inventorier** : quantité comptée ; motif si écart ; ajustement égal à l'écart.
**23.F.4 Réserver** : article, dépôt, quantité, ordre de travail ou engin ; numéro RES.

### G. Exemple pratique
Filtre à huile d'exemple : stock 10, réservé 4 pour un ordre de travail ; une sortie libre de 7 est refusée (stock libre 6).

### H. Cas particuliers et erreurs
Pas de séparation saisie et validation des mouvements de magasin ; pas d'import d'articles.

### I. Relations avec les autres modules
Achats (réceptions), Maintenance (pièces), Pneus, Budgets.

### J. Exercice
Annulez une entrée issue d'une réception d'achat. Résultat attendu : refus ; il faut annuler la réception.

### K. Glossaire du module
- **Stock libre** : stock moins réservations.
- **CMP** : coût moyen pondéré.

---

## 24. Achats

### A. Présentation
Circuit du bon de commande : rédaction, soumission, approbation, réception, solde.

### B. Principes métier
- Tout passe par des fonctions serveur, journalisées ; numéro `BC-AAAA-NNNNN` attribué.
- Statuts : brouillon, soumis, approuvé, reçu en partie, reçu, soldé, rejeté, annulé.
- Approbation par une autre personne que le demandeur et que toute personne ayant créé, modifié ou soumis le bon.
- Réception jamais au-delà de la commande ; quantités refusées motivées ; entrée au dépôt au prix commandé.

### C. Navigation
**Stocks & Achats > Achats**.

### D. Écrans
Figure 24.1 (capture à venir) : liste des bons, détail, circuit.
Figure 24.2 (capture à venir) : réception avec numéros des pneus reçus.

### E. Actions disponibles
Rédiger, modifier le brouillon, soumettre ; approuver ou rejeter (motif) ; réceptionner ; annuler une réception (motif) ; annuler le bon (motif, avant réception) ; solder (reçu en partie, motif).

### F. Procédures pas à pas
**24.F.1 Du bon à la réception** : rédiger (fournisseur actif, dépôt de livraison, lignes, taxes) ; soumettre ; l'approbateur (approbation `purchases`) approuve depuis Mes validations ; le magasinier (écriture `stock`) réceptionne : numéro de réception, bon de livraison, quantités reçues et refusées.
**24.F.2 Recevoir des pneus** : sur une ligne de pneus, un numéro par pneu reçu ; chaque pneu entre au registre des pneus (droit flotte ou maintenance requis).

### G. Exemple pratique
Bon d'exemple de 4 pneus : approuvé par le comptable ; reçu 4, numéros saisis ; les 4 pneus apparaissent en stock dans Pneus.

### H. Cas particuliers et erreurs
Pas de facture d'achat, pas de rapprochement à trois voies, pas de contrôle budgétaire à l'approbation.

### I. Relations avec les autres modules
Fournisseurs, Stocks, Pneus, Paiements, Budgets, Mes validations.

### J. Exercice
Approuvez un bon que vous avez soumis. Résultat attendu : refus.

### K. Glossaire du module
- **Solder** : clore un bon reçu en partie, le reliquat ne sera pas livré.

---

## 25. Fournisseurs

### A. Présentation
Répertoire des fournisseurs, contacts, documents, catégories, évaluations et consultations.

### B. Principes métier
- Un fournisseur se suspend et se réactive, avec motif ; il ne se supprime pas.
- Les documents ont une échéance ; l'alerte part du délai réglé par l'administrateur.
- Une consultation invite des fournisseurs, recueille des offres (saisies toutes taxes comprises), en sélectionne une, puis prépare un bon de commande dont le montant doit égaler l'offre retenue.

### C. Navigation
**Stocks & Achats > Fournisseurs** ; fiche fournisseur ; consultations.

### D. Écrans
Figure 25.1 (capture à venir) : répertoire et fiche (identité, contacts, documents, catégories, évaluation, commandes, paiements, journal).
Figure 25.2 (capture à venir) : évaluation par critères pondérés.
Figure 25.3 (capture à venir) : consultation, offres, sélection.

### E. Actions disponibles
Enregistrer, classer, suspendre, réactiver ; contacts et documents (ajout, retrait) ; critères et évaluation ; consultation, invitation, offre, sélection, préparation du bon.

### F. Procédures pas à pas
**25.F.1 Enregistrer un fournisseur** : nom, identifiants, catégorie, contacts ; enregistrer.
**25.F.2 Évaluer** : choisir les critères, noter, enregistrer.
**25.F.3 Consulter** : créer la consultation, inviter, saisir les offres, sélectionner, **Préparer le bon de commande**.

### G. Exemple pratique
Consultation d'exemple pour des filtres : 3 offres, sélection de la moins-disante, bon préparé au montant de l'offre.

### H. Cas particuliers et erreurs
Nombre minimal d'offres réglable (`consultation_offres_minimum`) ; pas de pièce jointe sur un fournisseur.

### I. Relations avec les autres modules
Achats, Paiements, Moyens généraux.

### J. Exercice
Soumettez un bon issu d'une consultation avec un montant différent de l'offre. Résultat attendu : refus.

### K. Glossaire du module
- **Consultation** : mise en concurrence de fournisseurs sur un besoin.

---

## 26. Moyens généraux et patrimoine

### A. Présentation
Registre des biens non roulants (mobilier, équipements) et leur cycle de vie.

### B. Principes métier
Cycle par journal : enregistrement, affectation, transfert, restitution, réparation, réforme ; seule la dernière opération s'annule (motif) ; l'inventaire physique par site signale les écarts sans jamais les régulariser automatiquement.

### C. Navigation
**Stocks & Achats > Moyens généraux et patrimoine**.

### D. Écrans
Figure 26.1 (capture à venir) : registre des biens et fiche.
Figure 26.2 (capture à venir) : inventaire physique et écarts.

### E. Actions disponibles
Enregistrer, modifier la fiche, affecter, transférer, remettre, restituer, constater l'état, réparer, réformer, annuler la dernière opération ; ouvrir, constater, clôturer un inventaire.

### F. Procédures pas à pas
**26.F.1 Affecter un bien** : choisir le bien, **Affecter**, bénéficiaire ; certaines saisies se font dans une petite fenêtre du navigateur.
**26.F.2 Inventorier un site** : ouvrir l'inventaire, constater chaque bien (présent, absent, état), clôturer ; lire les écarts.

### G. Exemple pratique
Inventaire d'exemple du bureau du site : 1 bien absent signalé en écart ; aucune régularisation automatique.

### H. Cas particuliers et erreurs
Pas de pièce jointe, pas de procès-verbal imprimable ni d'export.

### I. Relations avec les autres modules
Sites, Fournisseurs.

### J. Exercice
Annulez une opération qui n'est pas la dernière du bien. Résultat attendu : refus.

### K. Glossaire du module
- **Bien** : élément du patrimoine non roulant.

---

## 27. Contrats et Neemba

### A. Présentation
Dossier contractuel (contrat client CBG, contrat de location Neemba), tarifs par engin, engagements, clauses chiffrées, échéances, comités ; contrôle des factures Neemba ; évaluation du loueur.

### B. Principes métier
- Aucun tarif ni seuil n'a de valeur par défaut : absent, il n'est pas calculable.
- Tarif par engin : priorité au tarif de l'engin, puis de sa catégorie, puis au tarif unique de la version ; l'unité (km, heure, tonne, jour, mois, forfait) est choisie par engin.
- Un tarif en vigueur d'un contrat actif se modifie par avenant ; un élément ne se supprime que sur un contrat brouillon, jamais utilisé, avec motif ; un contrat actif ne repasse pas en brouillon.
- Contrôle de la facture Neemba : quantité facturée confrontée, dans l'unité du tarif, aux heures pointées sur les fiches FP (heure) ou aux kilomètres validés (km) ; taux comparé au tarif en vigueur ; une unité différente est signalée, jamais convertie.
- Le décompte de location complet (franchise, minimum, plafond, arrondi, majorations) n'est pas branché.

### C. Navigation
**Contrats & Finance** : **Mon tableau de bord**, **Dossier contractuel** (`#/contrats`), **Engagements et rapport**, **Comités de contrat**, **Contrôle factures Neemba**, **Évaluation Neemba**.

### D. Écrans
Figure 27.1 (capture à venir) : liste et fiche du contrat.
Figure 27.2 (capture à venir) : versions, avenants et tarifs par engin.
Figure 27.3 (capture à venir) : échéances (préavis, renouvellement, fin qu'une prolongation tacite donnerait).
Figure 27.4 (capture à venir) : clauses calculées et décision.
Figure 27.5 (capture à venir) : engagements contre réalisé et rapport de performance.
Figure 27.6 (capture à venir) : comités et actions.
Figure 27.7 (capture à venir) : mon tableau de bord du chargé de contrats.
Figure 27.8 (capture à venir) : évaluation de Neemba (grille, mesures, notes).
Figure 27.9 (capture à venir) : facture Neemba, lignes par engin, résultat du contrôle, notification, régularisation.

### E. Actions disponibles
Créer et modifier un contrat ; créer un avenant ; modifier un tarif par avenant ; supprimer un élément d'un brouillon (motif) ; enregistrer une échéance ; définir, calculer, décider une clause ; comparer les engagements, générer et remettre un rapport ; tenir un comité ; saisir, contrôler, notifier une facture Neemba et enregistrer une régularisation ; évaluer Neemba.

### F. Procédures pas à pas
**27.F.1 Créer un contrat** : **Nouveau**, référence, intitulé, nature (client, location, autre), contrepartie, devise (3 lettres), dates, délai de paiement ; enregistrer (statut brouillon), puis ajouter la version, les tarifs et engagements ; activer.
**27.F.2 Modifier un tarif en vigueur** : bouton crayon « par avenant » : une nouvelle version porte le nouveau tarif et sa date d'effet.
**27.F.3 Enregistrer un renouvellement ou une dénonciation** : date non future, motif ; un renouvellement reporte la date de fin.
**27.F.4 Décider une clause** : depuis un rapport de performance remis, **Calculer** ; décider : appliquer un montant à facturer ou à déduire (écriture `contracts` et `invoices`), ou écarter (approbation `contracts`, autre personne que l'auteur du calcul) ; motif obligatoire.
**27.F.5 Rapport de performance** : Engagements et rapport, contrat et mois ; **Générer** ; **Marquer remis** (date, destinataire) : ensuite immuable.
**27.F.6 Comité** : créer le comité, ses actions, suivre leur avancement.
**27.F.7 Évaluer Neemba** : profil sans site ; grille définie par l'administrateur ; notes de 1 à 5 saisies à côté des mesures (disponibilité, délai de prise en charge, interventions hors délai, écart des factures contrôlées).
**27.F.8 Contrôler une facture Neemba** : **Saisir** l'en-tête et les lignes par engin (quantité, unité, taux, montant) en une seule opération ; **Contrôler** ; **Notifier** l'écart (la facture est figée) ; **Régulariser** (avoir, déduction ou remboursement, au plus le reste réclamé). Statuts : saisie, contrôlée, notifiée, régularisée, conforme.

### G. Exemple pratique
Facture Neemba d'exemple : camion AB-1234 facturé 3 200 km ; kilomètres validés 3 050 km ; écart 150 km au tarif d'exemple ; notification ; régularisation par avoir.

### H. Cas particuliers et erreurs
- Sans pointage, distance ou tarif : la ligne est signalée, rien n'est estimé.
- Mesures de l'évaluation « sans données » tant que les engins ne sont pas rattachés au contrat (17.F.3).
- Le rapport d'engagements lit les anciens compteurs du voyage, pas les distances validées.

### I. Relations avec les autres modules
Engins, Fiches FP, Kilométrage, Réconciliation, Facturation, Paiements.

### J. Exercice
Supprimez un tarif d'un contrat actif. Résultat attendu : refus ; passer par un avenant.

### K. Glossaire du module
- **Avenant** : nouvelle version du contrat.
- **Clause chiffrée** : pénalité, bonus ou retenue conditionnée par un engagement mesuré.

---

## 28. Réconciliation, facturation CBG et recouvrement

### A. Présentation
Chaîne de facturation de CBG : réconciliation mensuelle du tonnage justifié, facture, signature du directeur, émission, avoir, encaissement, relances.

### B. Principes métier
- Le tonnage CBG est celui du relevé officiel ; un tonnage ne se saisit jamais à la main ; une erreur se corrige à la source, puis on actualise.
- Un voyage n'est ligne que d'une seule réconciliation ; deux réconciliations d'un même contrat ne se chevauchent pas sur la période et les sites.
- Une ligne sans tonnage de base ou avec des anomalies non examinées ne devient pas facturable.
- La signature est réservée au rôle directeur, jamais le préparateur ; une facture émise est immuable et se corrige par un avoir.
- Numéros sans trou : `FAC-AAAA-NNNN`, `AV-AAAA-NNNN`.

### C. Navigation
**Contrats & Finance** : **Réconciliation mensuelle** (`#/reconciliation`), **Facturation** (`#/invoices`), **Recouvrement** (`#/recouvrement`).

### D. Écrans
Figure 28.1 (capture à venir) : réconciliation, lignes, anomalies, décisions.
Figure 28.2 (capture à venir) : génération d'une facture depuis une réconciliation clôturée.
Figure 28.3 (capture à venir) : fiche facture et circuit (brouillon, à signer, signée, émise, annulée).
Figure 28.4 (capture à venir) : signature ou renvoi par le directeur.
Figure 28.5 (capture à venir) : création d'un avoir.
Figure 28.6 (capture à venir) : facture imprimable A4.
Figure 28.7 (capture à venir) : créances, encaissement, relances.

### E. Actions disponibles
Ouvrir, actualiser, décider les lignes, clôturer une réconciliation ; générer une facture ; soumettre, signer ou renvoyer (directeur), émettre, annuler ; créer un avoir ; imprimer ; encaisser ; relancer (niveaux 1 rappel, 2 relance, 3 mise en demeure) et imprimer la lettre.

### F. Procédures pas à pas
**28.F.1 Réconcilier un mois**
- Préconditions : relevés CBG importés et rapprochés ; anomalies traitées.
- Saisie : contrat client, période, trajet facultatif, base de tonnage (accepté, reçu ou chargé), tolérance d'écart chargé et reçu (sans valeur par défaut).
- Contrôles : anomalies relevées (base absente, sans pesée, écart hors tolérance, litige, rejet, ticket en double, ticket rectifié, sans relevé CBG, net supérieur à la capacité, anomalie de pesée ouverte, sans fiche terrain).
- Décision : chaque ligne à examiner, facturable ou exclue, motif obligatoire.
- Confirmation : **Clôturer**, refusé tant qu'une ligne reste à examiner. Le tonnage facturable est figé.
**28.F.2 Générer la facture** : depuis la réconciliation clôturée ; une ligne par tarif à la tonne de la version en vigueur ; taux de taxe saisi (0 si exonéré).
**28.F.3 Soumettre et émettre** : **Soumettre** (à signer) ; après signature, **Émettre** (date non future) : numéro définitif, échéance = émission + délai du contrat ; **Imprimer**.
**28.F.4 Signer (directeur)** : facture à signer, **Signer** ; ou **Renvoyer** avec motif. Session aal2 si l'exigence MFA est active.
**28.F.5 Créer un avoir** : facture émise, **Avoir**, montant (au plus le reste HT après avoirs), motif ; même circuit.
**28.F.6 Encaisser et relancer** : Recouvrement, créance, **Encaisser** (date entre émission et aujourd'hui, montant au plus le reste dû, mode) ; après échéance, **Relancer** (niveau, canal).

### G. Exemple pratique
Réconciliation d'exemple d'octobre : 1 200 voyages, 1 195 facturables, 5 exclus (ticket rectifié) ; facture d'exemple 48 000 t au tarif d'exemple ; signée par le directeur, émise, encaissée en deux virements.

### H. Cas particuliers et erreurs
- Une décision « facturable » est annulée si une anomalie bloquante nouvelle apparaît ou si le tonnage change.
- Pas d'annulation motivée d'un encaissement saisi par erreur.

### I. Relations avec les autres modules
Voyages, Pesée CBG, Contrats (tarifs, délai), Mes validations (facture à signer).

### J. Exercice
Signez une facture que vous avez préparée avec un compte directeur. Résultat attendu : refus (signataire différent du préparateur).

### K. Glossaire du module
- **Base de tonnage** : tonnage retenu (accepté, reçu ou chargé).
- **Avoir** : facture négative qui corrige une facture émise.

---

## 29. Paiements fournisseurs, budgets et coûts

### A. Présentation
SIGTB n'exécute aucun paiement : il enregistre la chaîne de décision et les paiements exécutés hors système. Il tient aussi les budgets, les coûts directs et l'export comptable.

### B. Principes métier
- Une seule pièce par paiement : facture Neemba contrôlée ou bon de commande reçu ou soldé ; montant au plus égal au reste à payer calculé par le serveur ; numéro `PAY-AAAA-NNNNN`.
- Approbation par une autre personne que le proposant ; contrôle a posteriori par une autre personne que le proposant et l'exécutant.
- Budget en TTC, par période, centre (site ou sans site), nature, devise ; il ne se modifie pas : il se révise (nouveau budget motivé) ou s'annule (motif). Un dépassement est signalé, jamais bloqué.
- Coût direct : numéroté, devise obligatoire, ne se modifie ni ne se supprime, s'annule avec motif.

### C. Navigation
**Contrats & Finance** : **Paiements fournisseurs**, **Budgets et comptabilité**, **Coûts**.

### D. Écrans
Figure 29.1 (capture à venir) : paiements (proposé, approuvé, exécuté, contrôlé), reste à payer.
Figure 29.2 (capture à venir) : budgets, engagé, réalisé, dépenses à imputer.
Figure 29.3 (capture à venir) : référentiels comptables et export CSV.
Figure 29.4 (capture à venir) : coûts directs et répartition.

### E. Actions disponibles
Proposer, approuver ou rejeter, saisir l'exécution, annuler, contrôler un paiement ; saisir, réviser, annuler un budget ; référentiels (natures, plan comptable, comptes de tiers) ; exporter ; enregistrer et annuler un coût.

### F. Procédures pas à pas
**29.F.1 Payer une facture Neemba**
- Proposer (écriture `invoices`) : pièce, objet, montant.
- Approuver (approbation `invoices`, autre personne) depuis Mes validations ; rejet motivé.
- Saisir l'exécution après le virement réel : date non future et pas avant l'approbation, mode, référence bancaire obligatoire pour un virement ou un chèque, montant au plus l'approuvé.
- Contrôler a posteriori (autre personne), anomalie motivée.
**29.F.2 Saisir un budget** : période, centre, nature, devise, montant TTC ; réviser par un nouveau budget motivé.
**29.F.3 Exporter pour la comptabilité** : période ; le CSV liste factures et avoirs émis, encaissements, paiements exécutés et coûts ; le compte de tiers reste vide tant qu'il n'est pas paramétré.
**29.F.4 Enregistrer un coût** : date, catégorie, site, engin, montant TTC, devise ; annuler avec motif en cas d'erreur.

### G. Exemple pratique
Facture Neemba d'exemple contrôlée, notifiée pour une part contestée : le reste à payer exclut la part réclamée ; le comptable propose, le directeur approuve, le comptable saisit le virement, un autre comptable contrôle.

### H. Cas particuliers et erreurs
Pas d'intégration bancaire ; pas de retenue sur paiement ; l'export n'est pas une écriture en partie double ; catégories de coût sans écran.

### I. Relations avec les autres modules
Contrats (factures Neemba), Achats (bons), Mes validations, Rapports.

### J. Exercice
Proposez un paiement supérieur au reste à payer. Résultat attendu : refus.

### K. Glossaire du module
- **Reste à payer** : montant encore dû sur une pièce, calculé par le serveur.
- **Engagé, réalisé** : bons et pièces à payer, puis paiements exécutés et coûts.

---

## 30. Santé et sécurité (HSE)

### A. Présentation
Contrôle avant départ, incidents et actions correctives, prévention (EPI, risques, plans de prévention, inspections).

### B. Principes métier
- Contrôle : une réponse pour chaque point actif (conforme, non conforme avec observation, sans objet) ; résultat calculé par le serveur : conforme, avec réserves, non conforme (point bloquant non conforme). Un contrôle ne se modifie pas : après réparation, un nouveau contrôle du jour fait foi.
- Si l'exigence est activée, un camion ne passe de « Affecté » à « Au chargement » qu'avec un contrôle du jour conforme ou avec réserves. L'exigence est inactive tant que l'administrateur ne l'active pas.
- Incident : rattaché à un voyage, un engin ou un site ; clôture seulement avec cause analysée, aucune action ouverte et conclusion.
- Plan de prévention signé par un titulaire de l'approbation `trips` autre que le rédacteur.

### C. Navigation
**RH & Sécurité** : **Contrôles avant départ**, **Incidents**, **Prévention HSE** (EPI, Registre des risques, Plans de prévention, Inspections).

### D. Écrans
Figure 30.1 (capture à venir) : contrôle avant départ, points et résultat.
Figure 30.2 (capture à venir) : bouton Exiger, Lever l'exigence (administrateur).
Figure 30.3 (capture à venir) : incident, analyse, actions correctives, clôture.
Figure 30.4 (capture à venir) : prévention HSE, quatre rubriques.

### E. Actions disponibles
Enregistrer un contrôle ; tenir les points (administrateur) ; exiger le contrôle ; déclarer, analyser, ajouter une action, solder une action, clôturer un incident ; remettre, restituer, annuler un EPI ; enregistrer un risque (version) ; rédiger, signer, annuler un plan ; définir et arrêter un programme, planifier, réaliser, annuler une inspection, ajouter une action.

### F. Procédures pas à pas
**30.F.1 Contrôle avant départ** : camion, chauffeur, compteur, observation ; réponse à chaque point ; **Enregistrer le contrôle**.
**30.F.2 Exiger le contrôle** (administrateur) : bouton **Exiger** ; lever : **Lever l'exigence**.
**30.F.3 Incident** : déclarer (type, gravité, description, heure, rattachement), analyser (cause), ajouter les actions (libellé, responsable, échéance), solder chacune (preuve ou motif d'annulation), clôturer (conclusion).
**30.F.4 Plan de prévention** : rédiger (intervenant, périmètre, risques, mesures, validité) ; un approbateur distinct signe avant la fin de validité ; un plan signé se remplace par une nouvelle version.

### G. Exemple pratique
Contrôle d'exemple : point « freinage » bloquant non conforme ; résultat non conforme ; si l'exigence est active, le départ est refusé avec « Depart refuse : dernier controle avant depart non conforme » ; après réparation, un nouveau contrôle conforme débloque.

### H. Cas particuliers et erreurs
Types d'EPI en liste fermée ; échelle de risque 1 à 5 à confirmer ; certaines décisions passent par une petite fenêtre du navigateur ; pas de photo jointe ; pas de tableau de bord HSE (l'écran Environnement est une maquette, chapitre 33).

### I. Relations avec les autres modules
Voyages (blocage du départ, incident), Engins, Chauffeurs, Centre des décisions, Mes validations.

### J. Exercice
Clôturez un incident avec une action ouverte. Résultat attendu : refus.

### K. Glossaire du module
- **Point bloquant** : point de contrôle dont la non-conformité rend le contrôle non conforme.
- **EPI** : équipement de protection individuelle.

---

## 31. Ressources humaines

### A. Présentation
Employés, présences et paie. Écrans hérités de la version d'origine, en partie repris.

### B. Principes métier
- Présences : saisie par fonction serveur ; une erreur se corrige par une nouvelle saisie qui remplace l'ancienne (motif) ou par une annulation motivée ; aucun horaire par défaut.
- Employés : écriture directe sous contrôle des droits `hr`, sans journal ni site.
- Paie : écran hérité, non repris ; ne pas l'utiliser pour une paie réelle.

### C. Navigation
**RH & Sécurité** : **Employés**, **Présences**, **Paie**.

### D. Écrans
Figure 31.1 (capture à venir) : liste des employés.
Figure 31.2 (capture à venir) : présences.
Figure 31.3 (capture à venir) : paie (écran hérité, signalé comme non repris).

### E. Actions disponibles
Créer, modifier un employé ; saisir, remplacer, annuler une présence.

### F. Procédures pas à pas
**31.F.1 Créer un employé** : **Nouveau**, identité, matricule, service ; enregistrer. Le lien avec un chauffeur se fait par matricule.
**31.F.2 Saisir une présence** : employé, date, heures ; corriger par remplacement motivé ou annulation motivée.

### G. Exemple pratique
Présence d'exemple saisie avec une mauvaise heure : nouvelle saisie avec motif « heure d'arrivée erronée » ; l'ancienne reste visible.

### H. Cas particuliers et erreurs
Pas de taux de présence ; paie non reprise ; employés sans site (hors périmètre site).

### I. Relations avec les autres modules
Chauffeurs, Prévention HSE (EPI d'un employé).

### J. Exercice
Annulez une présence sans motif. Résultat attendu : refus.

### K. Glossaire du module
- **Matricule** : identifiant de l'employé, utilisé pour le lien avec la fiche chauffeur.

---

## 32. Reporting et analyses

### A. Présentation
Rapports calculés par le serveur (client, loueur, shift, mensuel jour par jour), coût direct par tonne, santé et fiabilité de la flotte, performance des chauffeurs.

### B. Principes métier
- Un rapport figé est immuable ; on fige un nouveau rapport pour remplacer.
- Les analyses n'affichent que des mesures sur données réelles ; une absence est « sans données ».

### C. Navigation
**Reporting & Analyse** : **Rapports**, **Coût direct par tonne**, **Santé de la flotte**, **Fiabilité des engins**, **Performance chauffeurs**.

### D. Écrans
Figure 32.1 (capture à venir) : rapports (choix, paramètres, sections, export CSV, impression, figer, 20 derniers rapports figés).
Figure 32.2 (capture à venir) : coût direct par tonne.
Figure 32.3 (capture à venir) : santé de la flotte.
Figure 32.4 (capture à venir) : fiabilité des engins.
Figure 32.5 (capture à venir) : performance des chauffeurs.

### E. Actions disponibles
Calculer, exporter en CSV, imprimer, figer (écriture `reports`), réexporter un rapport figé.

### F. Procédures pas à pas
**32.F.1 Produire et figer un rapport mensuel** : Rapports, type, période, site ; **Calculer** ; vérifier ; **Exporter** ; **Figer** avec une note.

### G. Exemple pratique
Rapport mensuel d'exemple par jour : voyages, livrés, tonnes livrées et acceptées, gasoil, incidents, immobilisations, heures pointées ; figé le 1er du mois suivant.

### H. Cas particuliers et erreurs
Pas de graphique, pas d'export Excel natif ni PDF serveur ; pas de rapport de rentabilité ; liste des rapports figés limitée aux 20 derniers.

### I. Relations avec les autres modules
Tous les modules de données.

### J. Exercice
Figez un rapport puis tentez de le modifier. Résultat attendu : aucune modification possible.

### K. Glossaire du module
- **Rapport figé** : instantané immuable d'un rapport.

---

## 33. Suivi GPS, géorepérage, capteurs et environnement

### A. Présentation
Écrans prévus pour des capteurs et un suivi de position : **Suivi GPS**, **Intelligence flotte**, **Historique des trajets**, **Géorepérage** (menu Exploitation), **Jauges connectées** (Carburant), **Capteurs IoT**, **Environnement** (Reporting & Analyse).

### B. Principes métier
Aucun matériel GPS ni capteur n'est installé : ces écrans n'ont pas de données réelles et l'affichent. Une position ancienne n'est jamais présentée comme en direct. Le géorepérage enregistre des zones, sans aucune détection (moteur géographique absent). L'écran Environnement est une maquette : ses boutons n'ont pas d'effet.

### C. Navigation
Voir A.

### D. Écrans
Figure 33.1 (capture à venir) : suivi GPS sans données.
Figure 33.2 (capture à venir) : géorepérage, saisie d'une zone cercle ou polygone.
Figure 33.3 (capture à venir) : capteurs IoT, « Aucun tracker GPS configuré ».
Figure 33.4 (capture à venir) : environnement (maquette).

### E. Actions disponibles
Lecture ; créer et désactiver une zone de géorepérage (écriture `gps_tracking`).

### F. Procédures pas à pas
Aucune procédure opérationnelle tant qu'un matériel n'est pas choisi (extension à déclencheur).

### G. Exemple pratique
Sans objet.

### H. Cas particuliers et erreurs
Ne pas utiliser ces écrans pour une décision : ils sont vides par construction.

### I. Relations avec les autres modules
Le Dispatch et le tableau de bord n'utilisent aucune position.

### J. Exercice
Ouvrez Capteurs IoT. Résultat attendu : « Aucun tracker GPS configuré ».

### K. Glossaire du module
- **Extension à déclencheur** : fonction qui ne sera développée qu'après un événement fixé (ici, le choix d'un matériel).

---

## 34. Paramètres

### A. Présentation
Onglets réservés à l'administrateur : **Utilisateurs**, **Organisations**, **Affectations multisites**, **Délégations**, **Journal de connexion**, **Référentiels et numérotation**, **Général** (fiche société, réglages lus par le serveur).

### B. Principes métier
Tout changement de droit, de site ou de statut de compte est motivé et journalisé ; un compte n'est jamais supprimé.

### C. Navigation
Menu **Paramètres**.

### D. Écrans
Figure 34.1 (capture à venir) : utilisateurs. Figure 34.2 : droits par module. Figure 34.3 : affectations multisites. Figure 34.4 : délégations. Figure 34.5 : journal de connexion. Figure 34.6 : organisations. Figure 34.7 : référentiels et numérotation. Figure 34.8 : général, fiche société et réglages (toutes capture à venir).

### E. à K.
Voir le manuel administrateur (`docs/admin-manual/SIGTB_MANUEL_ADMINISTRATEUR.md`). Un utilisateur non administrateur utilise seulement **Sécurité du compte > Mes délégations** (déléguer un droit qu'il détient en propre).

---

## 35. Fonctionnalités à développer

Liste des fonctionnalités absentes ou incomplètes constatées dans le code. Aucun fonctionnement n'est décrit : il sera défini lors de leur développement.

| Domaine | Fonctionnalité absente ou incomplète | Source du constat |
|---|---|---|
| Accès | Réinitialisation du mot de passe par courriel ; changement de son propre mot de passe ; connexion Microsoft 365 configurée | `LoginPage.tsx`, aucun SMTP, aucun fournisseur |
| Interface | Mode hors ligne et application mobile ; traduction anglaise complète ; route Actions rapides reliée au menu | `OfflineIndicator.tsx`, catalogue module 01 |
| Pièces jointes | Pièces sur les sites, engins, chauffeurs, fiches signées, factures, contrats, fournisseurs, incidents | Types acceptés limités à cinq objets (migration pièces jointes) |
| Pilotage | Graphiques d'évolution ; indicateurs financiers du directeur ; tableaux de bord par profil ; notifications par courriel ou SMS, relances et escalades | Matrice de couverture J3 |
| Sites, chauffeurs | Journal et motif de désactivation d'un site ; motif de suspension d'un chauffeur | D-090 |
| Postes | Retrait motivé d'un membre de l'équipe | Catalogue module 05 |
| Dispatch | Positions, distances, files d'attente, optimisation | D-087 |
| Voyages | Événement correctif d'une étape saisie | Catalogue module 07 |
| Fiches | Écrans de création de lots numérotés et d'attribution des fiches à un agent | D-089 |
| Pesée | Import PDF, OCR ; facturation d'un ticket rectifié après décision | D-081, D-078 point 7 |
| Pneus | Import en masse ; référentiel des modèles de pneus ; lecture des capteurs de pression | D-091, catalogue module 12 |
| Carburant | Correction tracée d'une livraison ou d'une facture CBG ; jauges réelles | Catalogue module 13 |
| Achats | Facture d'achat, rapprochement à trois voies, contrôle budgétaire | Catalogue module 16 |
| Contrats, Neemba | Décompte de location complet branché au contrôle ; distances validées dans le rapport d'engagements | D-013, D-043 |
| Finance | Annulation motivée d'un encaissement ; retenues ; intégration bancaire ; écriture comptable en partie double ; écran des catégories de coût | Catalogue module 20 |
| Listes | Vues enregistrées ; import en masse (engins, pneus, articles, fournisseurs, livraisons) ; export Excel natif et PDF serveur | Matrice, section 4 |
| HSE | Tableau de bord HSE réel ; droit dédié `hse` ; photos | Catalogue module 22 |
| RH | Paie reprise sur règles réelles ; taux de présence | Écran hérité |
| Extensions | Portails Neemba, CBG et fournisseurs ; prévisions ; signature électronique ; GPS et capteurs | CLAUDE.md, section 9 |

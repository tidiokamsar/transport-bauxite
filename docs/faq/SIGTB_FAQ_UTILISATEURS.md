# SIGTB : questions fréquentes des utilisateurs

Version SIGTB documentée : `origin/main` 1896cde (2026-11-17). Date de rédaction : 2026-11-17 (`date -u`). Mission D-092, phase 1. Renvois : MGU = manuel général.

## Accès et compte

**Comment obtenir un compte ?** Auprès de l'administrateur de la plateforme ; il n'y a pas d'inscription libre.

**J'ai oublié mon mot de passe.** La réinitialisation par courriel n'est pas activée : l'administrateur vous attribue un nouveau mot de passe.

**Puis-je changer mon mot de passe moi-même ?** Non, pas depuis l'application aujourd'hui.

**Le bouton Microsoft 365 ne fonctionne pas.** Le fournisseur n'est pas configuré ; utilisez votre adresse et votre mot de passe.

**J'ai perdu le téléphone qui porte mon code.** Prévenez l'administrateur ; conservez la clé de secours notée à l'inscription.

**Existe-t-il une application mobile ?** Non ; SIGTB s'utilise dans un navigateur.

## Écrans et menus

**Je ne vois pas un menu dont un collègue parle.** Votre compte n'a pas le droit de lecture du module ; demandez-le à l'administrateur.

**Je vois un bouton mais l'action est refusée.** Le serveur est seul juge : lisez le message (droit, périmètre, séparation des tâches, règle métier).

**Que veut dire « sans données » ?** Qu'aucune saisie n'existe pour la période ou que la donnée manque. SIGTB n'estime jamais une valeur.

**Que veut dire « Non visible avec vos droits de lecture » ?** Ce domaine vous est fermé ; ce n'est pas un zéro.

**Le sélecteur de site du menu me donne-t-il accès aux autres sites ?** Non, c'est un filtre d'affichage. Votre périmètre est fixé par l'administrateur.

**Pourquoi un écran reste-t-il vide (Suivi GPS, Capteurs IoT, Jauges connectées) ?** Aucun matériel n'est installé ; ces écrans n'ont pas de données réelles (MGU chapitre 33).

**L'écran Environnement a des boutons sans effet.** C'est une maquette encore au menu ; ne pas l'utiliser.

**Comment retrouver vite un voyage, un engin, une facture ?** Ctrl K, au moins deux caractères.

**Puis-je partager un écran avec un collègue ?** Oui, en copiant l'adresse de la page ; il ne verra que ce que ses droits permettent.

## Saisie et corrections

**Je me suis trompé dans une saisie validée.** On ne réécrit pas : utilisez l'annulation motivée, la rectification ou la nouvelle version prévue par le module ; l'original reste visible.

**Pourquoi un motif est-il demandé ?** Pour tracer chaque décision et chaque correction ; c'est une règle du serveur.

**Pourquoi ne puis-je pas valider ma propre saisie ?** Séparation des tâches : une autre personne valide (carburant, distances, achats, paiements, fiches, clôtures de poste, remises en service, anomalies de pesée).

**La connexion a coupé pendant ma saisie.** La saisie n'est pas enregistrée ; recommencez. Chaque ligne est enregistrée en une seule opération, rien n'est écrit à moitié. Exception : la fiche KOGON garde un brouillon sur le poste.

**Message « Heure ... dans le futur » ou « Heure anterieure au dernier evenement ».** Corrigez l'heure d'après la fiche papier.

**Message « en cours de modification ».** Quelqu'un a modifié la même donnée en même temps ; rechargez l'écran et recommencez.

## Exploitation

**La barre supérieure affiche « non ouvert ».** Aucune instance du shift n'est ouverte : ouvrez-la au Dispatch (onglet Shift et préparation) ou dans Postes de travail.

**Le Dispatch ne propose aucun nombre de voyages.** Il manque l'objectif du jour, la capacité des camions ou l'hypothèse de charge : rien n'est supposé.

**Un chauffeur est refusé à l'affectation.** Lisez le motif : permis expiré, habilitation exigée manquante, déjà affecté sur le shift, site fermé.

**Un camion est refusé.** Il est inactif, n'est pas une benne, a une immobilisation ouverte ou est engagé avec un autre chauffeur.

**Le départ au chargement est refusé.** Le contrôle avant départ est exigé et absent ou non conforme pour ce camion aujourd'hui.

**J'ai reçu le ticket CBG après la livraison.** Fiche du voyage, « Rattacher le ticket CBG », motif du retard.

**Ticket refusé « deja utilise sur un autre voyage ».** Vérifiez le numéro sur le ticket CBG.

**Brut et tare : kilos ou tonnes ?** Tonnes, comme sur le ticket CBG.

## Pesée et facturation

**Qui fait foi entre CBG et KOGON ?** CBG. La fiche KOGON est un relevé observé, rapproché du relevé officiel.

**Je ne peux pas importer le relevé une seconde fois.** Un même fichier ne s'importe qu'une fois (empreinte).

**Pourquoi un voyage n'est-il pas facturable ?** Ligne à examiner, anomalie de pesée ouverte, sans relevé CBG, ticket rectifié, net supérieur à la capacité... Lisez les anomalies de la ligne de réconciliation.

**Qui signe une facture ?** Le directeur, jamais celui qui l'a préparée.

**Une facture émise est fausse.** Créez un avoir ; une facture émise ne se modifie pas.

**SIGTB paie-t-il les fournisseurs ?** Non ; il enregistre la décision et l'exécution faite hors système.

## Alertes et validations

**Pourquoi aucune alerte d'immobilisation longue ?** Le seuil n'est pas saisi par l'administrateur.

**Recevrai-je les alertes par courriel ou SMS ?** Non, pas aujourd'hui ; consultez la cloche et Mes validations.

**Mes validations est vide alors qu'un collègue attend ma décision.** Vous êtes peut-être l'auteur de la saisie, ou il vous manque le droit requis ; ou l'élément est hors de votre site.

## Pièces justificatives

**Sur quoi puis-je joindre un fichier ?** Voyage, ticket CBG, relevé de compteur, relevé CBG, livraison de carburant CBG.

**Quels formats ?** PDF, JPEG, PNG, WebP, 10 Mio au plus ; CSV et XLSX en plus pour un relevé CBG.

**Comment retirer une pièce jointe par erreur ?** Par une annulation motivée ; le fichier reste consultable.

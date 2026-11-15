# SIGTB : notes de version

Versions déployées sur https://sigtb.infranetgn.com. Le détail des étapes de chaque mise à jour est dans [SIGTB_2.0_HEBERGEMENT_VPS.md](SIGTB_2.0_HEBERGEMENT_VPS.md), section 11.

## À venir : moyens généraux et patrimoine (D-060)

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

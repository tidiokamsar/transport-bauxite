# Référence des fonctions serveur

Public : équipe de développement, administrateur. Liste des fonctions
appelables par un compte connecté (`GRANT EXECUTE ... TO authenticated`)
dans les migrations `supabase/migrations/2026*` (hors base de référence),
au commit `3d98254`. Pour chaque fonction : droit requis et règle
principale. Le détail des messages est dans les migrations citées.

Conventions :

- **Droit** : `W(x)` = `has_module_write('x')` ; `R(x)` =
  `has_module_view('x')` ; `A(x)` = `has_module_approve('x')` ; `admin` =
  `is_admin()` ; **périmètre** = `site_permis` ou ses dérivés
  (`vehicule_permis`, `voyage_permis`, `bon_commande_permis`,
  `pneu_permis`, `incident_permis`).
- **DEFINER** : la fonction s'exécute avec les droits de son propriétaire et
  contrôle elle-même l'appelant. **INVOKER** : la RLS de l'appelant
  s'applique (lecture et calcul seulement).
- Toutes ont `search_path` vide. Leur exécution est retirée au public
  (`REVOKE ... FROM PUBLIC, anon`) avant d'être accordée, sauf pour
  `mesures_voyage` et `normaliser_position_pneu`, deux fonctions INVOKER de
  calcul sans écriture.
- Appel depuis l'interface : `supabase.rpc('<nom>', { p_...: ... })`.

## Droits et périmètre (fonctions d'aide)

| Fonction | Type | Rôle |
|---|---|---|
| `has_module_view(module)` | DEFINER | Compte actif ET (attribution spécifique lecture ou écriture, sinon `can_view` du rôle) |
| `has_module_write(module)` | DEFINER | Compte actif ET (attribution spécifique écriture, sinon `can_create` ou `can_edit` du rôle) |
| `has_module_approve(module)` | DEFINER | Compte actif ET `can_approve` du rôle ET attribution spécifique absente ou « écriture » |
| `site_permis(site)` | DEFINER | Compte actif sans site, ou site du compte égal au site donné |
| `vehicule_permis(vehicule)`, `voyage_permis(voyage)` | DEFINER | Périmètre du site de l'engin ; du site de départ ou d'arrivée du voyage |
| `bon_commande_permis(depot)`, `pneu_permis(vehicule, site)`, `incident_permis(voyage, vehicule, site)` | DEFINER | Périmètre du dépôt, du pneu, de l'incident |
| `site_ferme_le(site, jour)` | DEFINER interne (D-072) | Motif d'une fermeture du site entier qui couvre la journée ; lue par la garde du dispatch, non exécutable par les comptes |
| `habilitations_manquantes(chauffeur, jour)` | DEFINER interne (D-072) | Types d'habilitation exigés et non valides à la date ; lue par les gardes du dispatch et des voyages |
| `controle_depart_du_jour(vehicule, jour)` | DEFINER interne (D-072) | Dernier contrôle avant départ du jour |
| `ordre_travail_permis(site, vehicule)` | DEFINER | Site de l'ordre ET engin dans le périmètre (D-072) |
| `rapport_fige_lisible(type)` | DEFINER | Lecture d'un rapport figé : rapports et droit du domaine (loueur : contrats ; client : factures ou contrats ; shift : voyages ou planification) |
| `validation_carburant_separee()` | DEFINER | Lit le réglage `carburant_validation_separee` (vrai si absent) |
| `seuil_pneus(cle)` | DEFINER | Lit `pneu_profondeur_min_mm` ou `pneu_inspection_max_jours` |
| `normaliser_position_pneu(texte)` | INVOKER | Normalise une position de pneu |
| `definir_droit_module(utilisateur, module, niveau, motif)` | DEFINER | **admin** ; niveau `aucun`, `lecture`, `ecriture` ou `defaut` ; module connu ; journalisé (D-036) ; aal2 si `mfa_exige` |

## Planification (D-023)

| Fonction | Droit | Règle principale |
|---|---|---|
| `definir_objectif(date, site, shift, tonnes, voyages, camions, chargeuses, motif, note)` | W(planning) | Date et site requis, tonnes positives ; une révision crée une version, motif obligatoire |
| `annuler_objectif(id, motif)` | W(planning) | Motif obligatoire ; objectif actif |
| `statistiques_rotation(site, shift, jusqua, jours)` | INVOKER | Charge moyenne et rotations par camion sur la période, pour l'estimation des camions |

## Planification avancée (D-063)

Migration `20261121090000`.

| Fonction | Droit | Règle principale |
|---|---|---|
| `ventiler_objectif(objectif, lignes)` | DEFINER, W(planning), périmètre | Objectif actif, journée non close, une seule ventilation par version ; ligne : destination (différente du site) ou contrat client actif à la date, une seule forme de ligne ; tonnes positives arrondies au centième avant le cumul ; somme au plus égale à l'objectif ; verrou de la journée |
| `cloturer_planification(date, site, causes, commentaire)` | DEFINER, W(planning), périmètre | Journée terminée ; une clôture active par date et site (verrou de la journée, partagé avec la ventilation et la garde des objectifs) ; cause d'écart requise si réalisé sous l'objectif, objectif annulé ou version remplacée au-dessus du réalisé ; si `planification_cloture_separee` vaut `true`, autre personne que tout auteur d'une version de la journée ; bilan figé |
| `annuler_cloture_planification(cloture, motif)` | DEFINER, W(planning), périmètre | Motif obligatoire ; clôture active |
| `simuler_objectif(objectif, instant)` | INVOKER, périmètre | Hypothèses sourcées, situation, besoin en camions et engins, tonnage atteignable, objectif proposé ; « Données insuffisantes » sous les seuils d'échantillon ; n'écrit rien |
| `durees_cycle_observees(site, shift, jusqua, jours)` | INVOKER | Médianes de rotation, de chargement et de trajet sur la période (1 à 90 jours) |
| `production_journee(date, site)` | INVOKER, périmètre | Objectif de journée, sinon somme des objectifs de shift ; réalisé sur le même périmètre |
| `rapport_production(debut, fin, site)` | INVOKER, périmètre | Bilan figé d'une journée close, calcul à la lecture sinon ; période bornée à 366 jours |
| `comparer_shifts(debut, fin, site)` | INVOKER, périmètre | Par shift : voyages, tonnes, durées, objectifs, postes, incidents, arrêts, retards, absences ; période bornée à 366 jours |
| `fenetre_planification(date, shift)`, `unite_debit(unite)` | INVOKER | Fenêtre d'exploitation (heure de Conakry) ; unité de débit reconnue (t/h, camions/h) |

Vue `v_realisation_ventilation` (security_invoker) : réalisé par destination
des lignes ventilées ; contrat seul non mesurable. Garde
`garde_objectif_journee_close` (DEFINER interne, non exécutable par les
comptes) : une journée close fige ses objectifs.

## Postes de travail (D-048)

| Fonction | Droit | Règle principale |
|---|---|---|
| `ouvrir_poste(date, shift, site, responsable, consignes)` | W(trips), périmètre | Pas plus d'un jour à l'avance ; un poste par shift, site et date ; consignes reprises du dernier poste clos |
| `affecter_au_poste(poste, chauffeur, engin)` | W(trips), périmètre, poste ouvert | Un chauffeur sur un seul poste par shift |
| `pointer_presence(membre, present, retard_minutes, motif)` | W(trips), périmètre, poste ouvert | Motif d'absence obligatoire |
| `consigner_evenement_poste(poste, categorie, description, quand, engin)` | W(trips), périmètre, poste ouvert | Heure non future ; journal non modifiable |
| `cloturer_poste(poste, consignes_sortie, rapport)` | W(trips), périmètre, poste ouvert | Équipe pointée ; consignes de passation obligatoires ; bilan figé |
| `valider_cloture_poste(poste)` | W(planning), périmètre, poste clos | Autre personne que celle qui a clos |

## Dispatch et voyages (D-024, CDC 12, D-047, D-051, D-054)

| Fonction | Droit | Règle principale |
|---|---|---|
| `preparer_voyages(date, site, destination, shift, nombre)` | W(trips) | 1 à 300 voyages planifiés |
| `decider_affectation(voyage, decision, camion, chauffeur, chargeuse, recommandation, motif)` | W(trips) | Décision `acceptee`, `modifiee` ou `refusee` ; motif hors acceptation initiale ; camion benne actif, chauffeur actif au permis valide, engin de chargement actif, un chauffeur par camion et par shift ; déclencheurs : site non fermé, habilitations exigées |
| `creer_voyage(date, depart, arrivee, camion, chauffeur, chargeuse, remorque, shift, note)` | W(trips) ou admin | Date, origine, destination requises ; référence `VYG-AAMMJJ-NNN` ; état Affecté ou Planifié |
| `avancer_voyage(voyage, etat, survenu_le, note, donnees)` | W(trips) ou admin | Transition autorisée ; heure non future et pas antérieure ; motif pour les exceptions ; pesée cohérente ; ticket unique ; tonnage accepté requis ; déclencheur : contrôle avant départ si exigé |

## Fiches terrain (D-028, D-037)

Droit selon le type de fiche : rotations W(trips), pointage W(maintenance),
carburant W(fuel).

| Fonction | Droit | Règle principale |
|---|---|---|
| `preparer_fiche(type, date, site, shift, camion, chauffeur, agent, options, contenu)` | W selon le type | Type connu ; date et site requis ; une fiche de rotations porte sur un camion ; numéro FR, FP ou FC |
| `suivre_fiche(fiche, etape, agent, quand)` | W selon le type, fiche ouverte | Étape possible depuis l'état ; nom de l'agent pour la remise ; heure non future |
| `annuler_fiche(fiche, motif)` | W selon le type, fiche ouverte | Motif obligatoire ; refusé si déjà saisie en partie |
| `terminer_saisie_fiche(fiche, note)` | W selon le type, fiche ouverte | Fiche remise ou retournée |
| `saisir_rotation(fiche, voyage, etapes)` | W(trips), fiche ouverte | Voyage du camion et de la date de la fiche ; étapes en liste ; ticket CBG au dépôt de destination seulement ; étapes déjà enregistrées ignorées |
| `saisir_pointage(fiche, engin, index_debut, index_fin, operateur, observations, arrets)` | W(maintenance), fiche ouverte | Index de fin pas inférieur au début ; arrêts transformés en immobilisations |
| `saisir_carburant(fiche, prix_litre, fournisseur, lignes)` | W(fuel), fiche ouverte | Engin et litres positifs par ligne ; stockage du site de la fiche ; sortie de stock à valider |

## Kilométrage (D-043)

| Fonction | Droit | Règle principale |
|---|---|---|
| `saisir_releve_compteur(engin, voyage, moment, valeur, quand, source, reference)` | W(trips), périmètre | Moment et source connus ; valeur positive ; heure non future ; voyage requis sauf moment « autre » ; un relevé par voyage et moment |
| `corriger_releve_compteur(releve, valeur, motif)` | W(trips), périmètre | Motif requis ; nouveau relevé qui remplace l'ancien |
| `valider_distance_voyage(voyage, charge_km, retour_km, declaree_km, motif)` | W(contracts), périmètre | Voyage livré ; autre personne que l'auteur des relevés (réglage) ; motif si différent de la mesure |
| `mesures_voyage(voyage)` | INVOKER | Distance mesurée et référence d'un voyage |

## Tickets et relevés CBG (D-037, D-050)

| Fonction | Droit | Règle principale |
|---|---|---|
| `rectifier_ticket_pesee_cbg(voyage, ticket, brut, tare, document_ref, motif)` | W(trips) ET W(invoices) | Motif ; poids cohérents ; autre personne que l'auteur du ticket ; réconciliation non clôturée ; aal2 si `mfa_exige` |
| `importer_releve_cbg(reference, du, au, site, fichier, lignes)` | W(trips), périmètre | Référence et période requises ; relevé non vide ; conservé tel que reçu |
| `rapprocher_releve_cbg(releve)` | W(trips) | Une seule fois par relevé ; tolérance `tolerance_poids_cbg_t` (0 si absente) |
| `decider_ecart_releve_cbg(ecart, decision, motif)` | W(trips) | `accepte` ou `litige`, motif ; pas de décision sur une ligne concordante |

## Maintenance et interventions (D-025, D-049)

| Fonction | Droit | Règle principale |
|---|---|---|
| `declarer_immobilisation(engin, debut, cause, imputation, description, reference_loueur)` | W(maintenance) | Description requise ; engin en flotte ; une seule ouverte par engin ; pas de chevauchement ; heure non future |
| `cloturer_immobilisation(id, fin, note)` | W(maintenance) | Immobilisation ouverte ; fin après le début ; refusée si une intervention du loueur est en cours (clôture par `valider_remise_en_service`, D-072) |
| `corriger_immobilisation(id, cause, imputation, debut, fin, motif)` | W(maintenance) | Motif obligatoire ; la fin se saisit par la clôture |
| `annuler_immobilisation(id, motif)` | W(maintenance) | Motif obligatoire |
| `heures_immobilisation(du, au)` | INVOKER | Heures par engin, imputation et cause, bornées à la période |
| `demander_intervention_loueur(immobilisation, quand, canal, description, reference, delai_contractuel_heures)` | W(maintenance), périmètre | Immobilisation ouverte non imputée à l'exploitant ; une intervention active ; numéro `INT` |
| `prendre_en_charge_intervention(id, quand, technicien)` | W(maintenance), périmètre, état demandée | Technicien requis ; heure après la demande |
| `terminer_intervention(id, quand, rapport, pieces)` | W(maintenance), périmètre, état prise en charge | Rapport obligatoire |
| `valider_remise_en_service(id, valider, motif)` | W(maintenance), périmètre, état terminée | Autre personne que l'auteur de la fin ; refus motivé ; clôture l'immobilisation |

## Pneus (D-052)

Toutes les opérations exigent W(vehicles) ou W(maintenance) ou admin, le
périmètre du pneu, une date non future et pas antérieure à la dernière
opération du pneu.

| Fonction | Règle principale |
|---|---|
| `enregistrer_pneu(numero, marque, modele, site, dimension, date_achat, prix_achat, fournisseur, profondeur_mm, rechapages_max, reference, note, date)` | Numéro unique ; marque et modèle requis ; valeurs positives ou absentes |
| `monter_pneu(pneu, engin, position, date, km, profondeur_mm, pression_bar, note)` | Pneu en stock réutilisable ; engin du périmètre ; un pneu par position |
| `demonter_pneu(pneu, motif, etat, site, date, km, profondeur_mm, note)` | Pneu monté ; motif ; état `stored` ou `damaged` ; compteur pas inférieur au montage |
| `permuter_pneu(pneu, position, date, km, motif)` | Pneu monté ; échange si la position est occupée |
| `inspecter_pneu(pneu, date, profondeur_mm, pression_bar, km, note)` | Profondeur ou pression requise |
| `reparer_pneu(pneu, site, date, cout, prestataire, profondeur_mm, reference, note)` | Pneu « à décider » |
| `rechaper_pneu(pneu, prestataire, site, date, cout, profondeur_mm, reference, note)` | Pneu démonté ; plafond de rechapages |
| `reformer_pneu(pneu, motif, date)` | Pneu démonté ; motif ; définitif |
| `annuler_operation_pneu(operation, motif)` | Dernière opération seulement ; l'entrée ne s'annule pas |

## HSE (D-054)

| Fonction | Droit | Règle principale |
|---|---|---|
| `enregistrer_controle_depart(engin, points, chauffeur, voyage, date, km, note)` | W(trips) ou admin, périmètre de l'engin | Liste de points paramétrée ; réponse à chaque point actif ; observation si non conforme ; résultat calculé |
| `declarer_incident(type, gravite, description, survenu_le, engin, chauffeur, voyage, site, lieu, cout_estime, controle)` | W(trips) ou admin, périmètre | Type, gravité, description, heure requis ; rattachement obligatoire ; numéro `INC` |
| `analyser_incident(id, cause, motif)` | W(trips) ou admin, périmètre, incident non clos | Cause requise ; motif pour réviser une cause ; journal `incidents_journal` (D-072) |
| `ajouter_action_corrective(incident, libelle, responsable, echeance)` | idem | Libellé, responsable, échéance |
| `solder_action_corrective(action, realisee, texte, date)` | idem | Preuve ou motif ; date non future |
| `cloturer_incident(id, conclusion)` | idem | Cause analysée, aucune action ouverte, conclusion |

## Carburant (D-034, D-041, D-030)

Les opérations du registre exigent W(fuel), un stockage actif dans le
périmètre.

| Fonction | Droit | Règle principale |
|---|---|---|
| `enregistrer_livraison_cbg(reference, date, site, litres, prix_litre, document_ref, note)` | W(fuel) | Référence, date, site, litres et prix positifs |
| `enregistrer_facture_carburant_cbg(reference, date, montant, livraisons)` | W(fuel) | Au moins une livraison, rattachée une seule fois |
| `controler_facture_carburant_cbg(facture)` | W(fuel) | Facture en saisie ; écart au montant attendu des livraisons |
| `receptionner_livraison_cbg(livraison, stockage, date, volume_mesure, volume_accepte, methode, motif_ecart)` | W(fuel), stockage | Stockage du site ; accepté au plus égal au mesuré ; motif si écart au document |
| `transferer_carburant(source, destination, litres, date, reference, note)` | W(fuel), deux stockages | Source et destination différentes ; quantité positive |
| `saisir_inventaire_carburant(stockage, date, volume_mesure, methode, note)` | W(fuel), stockage | Volume entre 0 et la capacité ; aucune décision en attente |
| `decider_inventaire_carburant(inventaire, valider, motif)` | W(fuel), stockage | Autre personne que l'auteur ; motif de rejet ; solde inchangé depuis la mesure |
| `decider_mouvement_carburant(mouvement, valider, motif)` | W(fuel), stockage | Autre personne que l'auteur ; motif de rejet ; stockage ouvert par inventaire |
| `annuler_mouvement_carburant(mouvement, motif)` | W(fuel), stockage | Mouvement validé ; contre-mouvement à valider |
| `consommation_carburant(du, au)` | INVOKER | Litres par tonne et par heure ; coût au prix des livraisons de la période |
| `anomalies_carburant(du, au, seuil_pct)` | INVOKER | Anomalies selon les règles affichées et le seuil saisi |

## Stocks magasin (D-044)

| Fonction | Droit | Règle principale |
|---|---|---|
| `mouvement_stock(article, type, quantite, depot_source, depot_destination, date, prix_unitaire, reference, engin, ordre_maintenance, note)` | W(stock), dépôts du périmètre | Types entrée, sortie, transfert, retour ; pas de sortie au-delà du disponible ; numéro `MVT` |
| `inventorier_stock(article, depot, quantite_comptee, motif)` | W(stock), dépôt | Motif si écart ; ajustement égal à l'écart |
| `annuler_mouvement_stock(mouvement, motif)` | W(stock), dépôts | Contre-mouvement ; mouvement issu d'une réception refusé |
| `stock_disponible(article, depot)` | DEFINER interne (D-072) | Quantité disponible d'un article dans un dépôt ; lecture par les comptes via `v_stock_depots` |

## Achats (D-053)

| Fonction | Droit | Règle principale |
|---|---|---|
| `enregistrer_bon_commande(fournisseur, depot, lignes, id, livraison_prevue, taxes, note)` | W(purchases) ou admin, dépôt du périmètre | Fournisseur actif ; dépôt obligatoire ; lignes valides ; seul un brouillon se modifie ; numéro `BC` |
| `soumettre_bon_commande(id)` | W(purchases) ou admin | Brouillon avec lignes |
| `decider_bon_commande(id, approuver, motif)` | A(purchases) ou admin, périmètre | Bon soumis ; autre personne que le demandeur (réglage) ; rejet motivé |
| `annuler_bon_commande(id, motif)` | W(purchases) ou admin | Avant toute réception ; motif |
| `solder_bon_commande(id, motif)` | W(purchases) ou admin | Bon reçu en partie ; motif |
| `receptionner_bon_commande(id, lignes, bon_livraison, date, note)` | W(stock) ou admin, dépôt | Bon approuvé ; jamais au-delà de la commande ; motif de refus ; entrée en stock |
| `annuler_reception(livraison, motif)` | W(stock) ou admin | Motif ; bon non soldé |

## Contrats, suivi et recouvrement (D-031, D-032, D-033)

| Fonction | Droit | Règle principale |
|---|---|---|
| `realise_engagements(du, au)` | INVOKER | Mesures réalisées de la période, avec échantillon |
| `comparer_engagements(contrat, du, au)` | INVOKER | Engagements de la version en vigueur contre réalisé ; « non mesurable » sans donnée |
| `generer_rapport_performance(contrat, du, au)` | W(contracts) | Instantané figé, régénérable tant qu'il n'est pas remis |
| `marquer_rapport_remis(id, date, destinataire)` | W(contracts) | Date non future, destinataire ; ensuite immuable |
| `enregistrer_encaissement(facture, date, montant, mode, reference, note)` | W(invoices) | Facture émise ; date entre l'émission et aujourd'hui ; montant au plus égal au reste dû |
| `relancer(facture, canal, note)` | W(invoices) | Reste dû ; après l'échéance ; trois niveaux au plus |
| `indicateurs_charge_contrats()` | INVOKER | Indicateurs de la fiche de poste sur 12 mois |
| `controler_facture_fournisseur(facture)` | W(contracts) | Facture non notifiée avec lignes ; contrôle par engin dans l'unité du tarif (heures pointées, km validés) |
| `notifier_ecart_fournisseur(facture, date, reference)` | W(contracts) | Date non future ; fige la facture ; conforme sans écart positif |
| `enregistrer_regularisation(facture, date, montant, mode, reference, note)` | W(contracts) | Écart notifié ; avoir, déduction ou remboursement ; au plus le reste réclamé |

## Réconciliation et factures clients (D-029, D-037)

| Fonction | Droit | Règle principale |
|---|---|---|
| `ouvrir_reconciliation(contrat, debut, fin, base, tolerance, site_depart, site_arrivee)` | W(invoices) | Contrat client ; base et tolérance requises ; une seule par contrat, période et trajet |
| `actualiser_reconciliation(id)` | W(invoices) | Réconciliation non clôturée |
| `decider_ligne_reconciliation(ligne, decision, motif)` | W(invoices) | Motif ; pas de ligne facturable sans base ou avec anomalies non examinées |
| `cloturer_reconciliation(id)` | W(invoices) | Aucune ligne à examiner ; fige le tonnage |
| `generer_facture(reconciliation, taux_taxe, objet)` | W(invoices) | Réconciliation clôturée ; taux de taxe requis ; tarif à la tonne en vigueur |
| `creer_avoir(facture, montant_ht, motif)` | W(invoices) | Facture émise ; motif ; montant au plus égal à la facture |
| `avancer_facture(facture, action, motif, date)` | Signer et renvoyer : rôle `director` ; autres actions : W(invoices) | Signataire différent du préparateur ; émission non future, numéro sans trou ; annulation motivée ; aal2 pour signer si `mfa_exige` |

## Paiements fournisseurs (D-055)

| Fonction | Droit | Règle principale |
|---|---|---|
| `proposer_paiement(montant, objet, facture, bon)` | W(invoices) ou admin | Une seule pièce payable ; montant au plus égal au reste à payer ; numéro `PAY` |
| `decider_paiement(id, approuver, motif)` | A(invoices) ou admin | Paiement proposé ; autre personne que le proposant (réglage) ; rejet motivé |
| `enregistrer_execution_paiement(id, date, mode, montant, reference)` | W(invoices) ou admin | Paiement approuvé ; date non future et après l'approbation ; référence pour virement et chèque ; au plus l'approuvé |
| `annuler_paiement(id, motif)` | W(invoices) ou admin | Avant exécution ; motif |
| `controler_paiement(id, conforme, motif)` | A(invoices) ou admin | Paiement exécuté non contrôlé ; autre personne que proposant et exécutant ; anomalie motivée |
| `reste_a_payer(facture, bon)` | DEFINER, lecture invoices ou contracts | Base (facture : moins le plus grand de la part réclamée et des avoirs et déductions ; bon : reçu et taxes au prorata du reçu), moins engagé et payé (D-072) |

## Analyses de flotte (D-030)

| Fonction | Type | Contenu |
|---|---|---|
| `fiabilite_engins(du, au)` | INVOKER | Pannes, MTTR, MTBF, disponibilité depuis les immobilisations |
| `performance_chauffeurs(du, au)` | INVOKER | Voyages, tonnes, temps de cycle et de chargement, écart de pesée, litiges |

## Validations et notifications (D-056)

| Fonction | Type | Contenu |
|---|---|---|
| `mes_validations()` | INVOKER | Ce qui attend la décision de l'appelant, calculé à chaque lecture selon ses droits et la séparation des tâches |
| `marquer_notifications_lues(ids)` | DEFINER | Marque lues les seules notifications de l'appelant |

## Fonctions héritées encore accordées

Accordées par `20261109120000_fermer_fonctions_definer.sql`, définies dans
la base de référence (code Bolt) : `calculate_tire_performance_metrics(uuid)`
et `log_user_activity(text, jsonb)`. `log_user_activity` est appelée par
l'écran des utilisateurs.

## Fonctions réservées au service

`ingest_gps_data` et `ingest_fuel_data` (D-030) ne sont pas accordées aux
comptes connectés : elles sont appelées par la fonction `iot-ingestion`
avec le rôle de service.

## Limites connues

- Les fonctions SQL héritées de la base de référence (code Bolt) autres que
  les deux ci-dessus ne sont pas recensées ici.
- Les tables écrites directement sous politique RLS (dossier contractuel,
  comités, factures du loueur en saisie, habilitations, référentiels,
  infrastructures et fermetures) n'ont pas de fonction serveur : leurs
  règles sont dans les politiques et déclencheurs des migrations.

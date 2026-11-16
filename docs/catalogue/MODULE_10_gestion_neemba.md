# Module 10 : Gestion Neemba Guinée (loueur des engins)

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : dernière release consignée 3bbfded,
démonstration purgée (D-076), aucune saisie réelle (contrat Neemba, tarifs,
engins rattachés : à saisir par le propriétaire). Aucun élément UTILISABLE
ni VALIDÉ ; guides : `docs/guides/guide-financier.md`,
`docs/guides/guide-flotte-maintenance.md` (sections 2 et 3).

## 1. Objectifs et périmètre

Piloter la relation avec Neemba, loueur des camions semi-remorques, des
chargeuses et de la pelle (D-027), de bout en bout : contrat et avenants,
engins loués et tarif de chaque engin, quantités facturables (km relevés
pour les camions, heures pointées pour les chargeuses et la pelle, D-033),
indisponibilités imputables au loueur, interventions de maintenance (à la
charge de Neemba, D-022), contrôle de chaque facture reçue, notification
formelle des écarts, régularisations, évaluation périodique. SIGTB trace et
contrôle, sans internaliser la maintenance (D-049) et sans exécuter de
paiement (D-055).

Décisions : D-013 et D-014 (modèle de location paramétrable, moteur de
décompte v1), D-022, D-025, D-027, D-028 (pointages FP), D-031
(engagements, rapport de performance), D-032 et D-033 (contrôle des
factures, unité et tarif par engin), D-043 (distances validées, retour à
vide), D-049 (interventions), D-055 (paiements), D-062 (engin rattaché au
contrat), D-065 (clauses, pénalités du loueur, évaluation Neemba), D-072
(clôture d'immobilisation refusée tant que l'intervention n'est pas
validée).

Ce module recoupe les modules 11 (immobilisations, interventions), 19
(dossier contractuel) et 20 (factures fournisseurs, paiements) : cette
fiche décrit la vue « partenaire Neemba » et renvoie aux écrans communs
sans les dupliquer.

## 2. Sous-modules

1. Fiche partenaire (identité, contacts, interlocuteurs techniques et
   commerciaux, canaux de demande).
2. Contrat de location, versions (avenants), clauses, échéances.
3. Registre des engins loués et tarif par engin (unité km, heure, jour,
   mois, forfait).
4. Quantités facturables : relevés kilométriques validés (camions),
   pointages horaires FP (chargeuses, pelle).
5. Immobilisations imputées au loueur, interventions, remises en service,
   calcul des indisponibilités.
6. Contrôle des factures, écarts, notification, réclamations,
   régularisations (avoir, déduction, remboursement).
7. Pénalités et bonus contractuels (clauses D-065).
8. Évaluation périodique et rapport loueur.

## 3. Menus et sous-menus

| Entrée | Vue | Droit lu (`AuthContext.tsx:156`) |
|---|---|---|
| Contrats & Finance > Dossier contractuel (`contrats`) | `Contrats/ContratsView` | `contracts` |
| Contrats & Finance > Contrôle factures Neemba (`factures-neemba`) | `Contrats/FacturesNeembaView` | `contracts` |
| Contrats & Finance > Évaluation Neemba (`evaluation-loueur`) | `Contrats/EvaluationLoueurView` | **absent de la table : visible par l'administrateur seul** (défaut, section finale) |
| Contrats & Finance > Engagements et rapport (`engagements`) | `Contrats/EngagementsView` | `contracts` |
| Maintenance > Immobilisations, Interventions Neemba | module 11 | `maintenance` |
| Exploitation > Kilométrage ; Fiches terrain (FP) | module 07 | `trips` |
| Reporting > Rapports (rapport loueur) | `Reports/ReportsView` | `reports` |

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Fiche partenaire Neemba structurée | - | MANQUANT (contrepartie = texte libre du contrat) | matrice, ligne « Contrats de location » |
| Dossier contractuel : contrat, versions, tarifs, engagements, clauses, échéances, journal | `contrats`, `contrat_versions`, `contrat_tarifs`, `contrat_engagements`, `contrat_clauses`, `journal_contrats` | DÉPLOYÉ (D-026, D-033, D-065) | `src/components/Contrats/ContratsView.tsx`, `Formulaires.tsx:240-290` |
| Tarif par engin (unité, prix, engin, catégorie, retour à vide) | `contrat_tarifs` | DÉPLOYÉ | `Formulaires.tsx:240-290`, `20261112100000_facturation_par_engin.sql:33` |
| Registre des engins loués par contrat | `vehicles.contrat_id` | PARTIEL (rattachement engin par engin depuis la fiche flotte, pas de vue par contrat) | `FicheVehicule.tsx:93`, D-062 |
| Pointages horaires des engins (fiches FP) | `pointages_engins` | DÉPLOYÉ (module 07) | `20261111090000_fiches_terrain.sql:153` |
| Relevés et distances validées (camions au km) | `releves_compteur`, `distances_voyage` | DÉPLOYÉ (module 07) | D-043 |
| Immobilisations, interventions, remise en service | module 11 | DÉPLOYÉ | `Maintenance/ImmobilisationsView.tsx`, `InterventionsLoueurView.tsx` |
| Contrôle des factures Neemba (saisie en-tête et lignes, contrôle, écarts par ligne, notification, lettre, régularisations) | `factures_fournisseur*`, `regularisations_fournisseur` | DÉPLOYÉ (défaut d'atomicité, section finale) | `src/components/Contrats/FacturesNeembaView.tsx:99-140` |
| Modification des lignes d'une facture saisie | `factures_fournisseur_lignes` | MANQUANT (les lignes ne s'écrivent qu'à la création) | `FacturesNeembaView.tsx:111` |
| Réclamation (dossier de réclamation suivi, réponses du loueur) | - | PARTIEL (notification formelle et lettre ; pas d'objet réclamation ni de réponse) | `notifier_ecart_fournisseur` |
| Clauses de pénalité du loueur et décision | `contrat_clauses`, `calculs_clauses` | DÉPLOYÉ (3bbfded) | `Contrats/ClausesCalculees.tsx`, D-065 |
| Évaluation Neemba (grille, mesures, notes, historique) | `criteres_evaluation_fournisseur`, `mesures_loueur`, `evaluer_loueur` | DÉPLOYÉ (accès non-administrateur cassé) | `src/components/Contrats/EvaluationLoueurView.tsx:45-95` |
| Rapport loueur (heures pointées, immobilisations, interventions, factures contrôlées) | `rapport_loueur` | DÉPLOYÉ | `src/lib/rapports.ts:23`, `20261118090000_reporting.sql:537` |
| Décompte de location paramétrable (franchise, arrondi, plafond, minimum) | moteur `src/domain/location/decompte.ts` | PARTIEL (moteur testé, 27 tests, appelé par aucun écran ni fonction serveur) | `src/domain/location/decompte.test.ts` |
| Tableau de bord Neemba (disponibilité contractuelle, écarts, délais d'intervention) | - | MANQUANT | - |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Écarts détectés et recouvrés | `indicateurs_charge_contrats` (D-032) | 12 mois | DÉPLOYÉ (Mon tableau de bord, module 19) |
| Heures d'immobilisation imputées au loueur par engin | `heures_immobilisation` | période | DÉPLOYÉ |
| Délai de prise en charge, retard contractuel | `v_interventions_loueur` | - | DÉPLOYÉ (retard NULL sans délai saisi) |
| Disponibilité contractuelle comparée à l'engagement | `comparer_engagements` (D-031) | mois | DÉPLOYÉ |
| Mesures de l'évaluation (disponibilité, délais, conformité des factures) | `mesures_loueur` | période | DÉPLOYÉ (vides tant que `vehicles.contrat_id` n'est pas renseigné) |
| Montant facturé, attendu, réclamé, régularisé, reste à payer | `factures_fournisseur`, `v_reste_a_payer` | mois | PARTIEL (par facture ; pas de synthèse partenaire) |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Fiche partenaire | MANQUANT | MANQUANT | MANQUANT | - | MANQUANT | - | - |
| Contrat, version (avenant) | DÉPLOYÉ (module 19) | DÉPLOYÉ | DÉPLOYÉ (journalisé `journal_contrats`) | DÉPLOYÉ (nouvelle version copie tarifs et engagements, `Formulaires.tsx:165-185`) | DÉPLOYÉ (statuts du contrat) | DÉPLOYÉ (version brouillon) | DÉPLOYÉ (avenant) |
| Tarif par engin | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (version non verrouillée) | via version | - | DÉPLOYÉ (politique `suppression_module`) | via avenant |
| Facture Neemba | DÉPLOYÉ (insert direct, colonnes de saisie) | DÉPLOYÉ | PARTIEL (en-tête modifiable par la base en `saisie` ou `controlee`, pas d'écran ; lignes non modifiables à l'écran) | MANQUANT | sans objet | sans objet (DELETE retiré, D-072) | PARTIEL (pas d'annulation d'une facture saisie par erreur) |
| Régularisation | DÉPLOYÉ (`enregistrer_regularisation`) | DÉPLOYÉ | sans objet | - | - | - | MANQUANT (pas d'annulation motivée) |
| Évaluation | DÉPLOYÉ (`evaluer_loueur`) | DÉPLOYÉ | DÉPLOYÉ (correction motivée) | - | - | - | DÉPLOYÉ |

## 7. Modals et drawers

Saisie de facture (en-tête et lignes par engin avec quantité et unité) :
DÉPLOYÉ. Notification d'écart (référence du courrier par `window.prompt`) :
PARTIEL. Lettre de notification imprimable : DÉPLOYÉ (`FacturesNeembaView`,
`setLettre`). Régularisation : DÉPLOYÉ. Formulaires de contrat, version,
tarif, engagement, clause : DÉPLOYÉ (module 19). Pièce jointe de la facture
scannée : MANQUANT (stockage). Import de la facture (CSV ou PDF du loueur) :
MANQUANT.

## 8. Champs des formulaires

**Facture Neemba, en-tête** : contrat de location (obligatoire, liste des
contrats `nature = 'location'`), numéro du loueur (obligatoire, unique par
contrat, message dédié au doublon), date de facture, période (début, fin ;
fin >= début, CHECK), montant HT (>= 0, CHECK) ; devise reprise du contrat.
Manquant à l'écran : montant TTC (colonne `montant_ttc_facture` accordée,
utilisée par `v_reste_a_payer`), note.

**Ligne** : engin (facultatif ; une ligne sans engin n'est pas contrôlée),
libellé, catégorie de matériel, quantité facturée et unité (km, heure...),
taux, montant (obligatoire). Contrôle serveur : quantité attendue dans
l'unité du tarif de l'engin (km facturables des voyages livrés à distance
validée, ou heures de marche des fiches FP signées), taux attendu de la
version en vigueur ; unité différente signalée, jamais convertie (D-033).

**Tarif** : libellé, unité, prix (>= 0), engin, catégorie, conditions,
retour à vide facturable (km seulement ; NULL = à confirmer, kilomètres non
contrôlés, D-043).

## 9. Actions individuelles et en masse

| Action | État | Preuve |
|---|---|---|
| Contrôler une facture | DÉPLOYÉ | `controler_facture_fournisseur` (dernière définition `20261115150000_releves_kilometriques.sql:328`) |
| Notifier l'écart (fige la facture ; conforme si aucun écart positif) | DÉPLOYÉ | `notifier_ecart_fournisseur` |
| Enregistrer une régularisation (au plus le montant réclamé) | DÉPLOYÉ | `enregistrer_regularisation` |
| Demander une intervention, suivre, valider la remise en service | DÉPLOYÉ (module 11) | D-049 |
| Calculer et décider une pénalité du loueur | DÉPLOYÉ | `calculer_clauses`, `decider_clause` (D-065) |
| Évaluer Neemba sur une période | DÉPLOYÉ | `evaluer_loueur` |
| Rattacher les engins au contrat en masse | MANQUANT | - |
| Relancer le loueur sur une réclamation sans réponse | MANQUANT | - |

## 10. Statuts et transitions

```
Facture : saisie -> controlee (controler_facture_fournisseur, écriture contracts)
          controlee -> controlee (nouveau contrôle après correction)
          controlee -> notifiee (notifier_ecart_fournisseur, date non future, écart positif)
          controlee -> conforme (notifier_ecart_fournisseur sans écart positif)
          notifiee -> regularisee (régularisations cumulées = montant réclamé)
Intervention (module 11) : demandee -> prise_en_charge -> terminee -> remise_validee
          (refus motivé : terminee -> prise_en_charge)
Contrat (module 19) : brouillon -> actif -> suspendu | clos ; versions datées
```

Point relevé par D-072 et à trancher : une demande d'intervention jamais
honorée n'a pas de chemin d'annulation.

## 11. Workflows

1. Mise en place : fiche partenaire (MANQUANT), contrat de location, tarif
   de chaque engin dans son unité, engins rattachés au contrat (D-062),
   délais contractuels d'intervention (clauses chiffrées à saisir).
2. Exploitation : pointages FP signés (chargeuses, pelle), relevés et
   distances validées par une autre personne (camions), immobilisations et
   interventions.
3. Fin de mois : saisie de la facture reçue, contrôle, notification
   formelle de l'écart, lettre, régularisation ; paiement par le circuit
   D-055 (proposition, approbation séparée, exécution saisie).
4. Évaluation périodique et rapport de performance remis au comité.
Séparation des tâches : validation des distances par une autre personne
que l'auteur des relevés (D-043) ; remise en service validée par une autre
personne que la saisie de fin (D-049) ; paiement approuvé séparément
(D-055). Aucune séparation entre saisie et contrôle de la facture.

## 12. Rôles et permissions

| Action | Module et niveau | Périmètre |
|---|---|---|
| Contrat, tarifs, factures, régularisations, évaluation | `contracts` écriture ; lecture `contracts` | global (aucun site sur les factures) |
| Évaluation | écriture `contracts`, profil global exigé (`evaluer_loueur`) | global |
| Interventions, immobilisations | `maintenance` | site de l'engin |
| Pointages, relevés | `trips` ; validation des distances : `contracts` | site |
| Rôle type | `contract_manager` (D-026) | - |

## 13. Tables et relations

`contrats` (nature `location`), `contrat_versions`, `contrat_tarifs`
(`engin` -> `vehicles`, `km_retour_vide_facturable`),
`contrat_engagements`, `contrat_clauses`, `calculs_clauses`,
`contrats_echeances`, `journal_contrats` ; `vehicles.contrat_id` ;
`factures_fournisseur` (UNIQUE contrat + numéro, statut, montants attendus
et écarts écrits par le serveur), `factures_fournisseur_lignes`,
`regularisations_fournisseur` ; `pointages_engins` ; `releves_compteur`,
`distances_voyage` ; `immobilisations`, `interventions_loueur`,
`interventions_pieces`, `interventions_journal` ;
`criteres_evaluation_fournisseur` (grille `loueur`),
`evaluations_fournisseur`. RLS : lecture `contracts` ; écriture des
factures limitée aux statuts `saisie` et `controlee` ; INSERT et UPDATE par
colonnes accordées (`20261111200000_controle_factures_neemba.sql:101-120`).

## 14. Fonctions serveur et API

`controler_facture_fournisseur`, `notifier_ecart_fournisseur`,
`enregistrer_regularisation`, `heures_immobilisation`,
`realise_engagements`, `comparer_engagements`, `rapport_loueur`,
`calculer_clauses`, `decider_clause`, `definir_critere_loueur`,
`mesures_loueur`, `evaluer_loueur`, fonctions D-049 du module 11.
Manquantes : `enregistrer_facture_fournisseur` atomique (en-tête et lignes
dans une transaction), `annuler_facture_fournisseur` (motif),
`modifier_ligne_facture`, `enregistrer_reclamation`, `rattacher_engins_contrat`,
décompte serveur (D-013) branché sur le contrôle.

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Remise en service à valider | maintenance | « Mes validations » | DÉPLOYÉ (D-056) |
| Clause à décider, échéance de contrat | chargé de contrats | « Mes validations » | DÉPLOYÉ (D-065) |
| Facture saisie non contrôlée depuis N jours | chargé de contrats | - | MANQUANT |
| Intervention en retard sur le délai contractuel | maintenance, contrats | écran | PARTIEL (calculé, pas notifié) |
| Notification formelle au loueur | Neemba | lettre imprimée | PARTIEL (pas d'envoi électronique : SMTP non configuré, intégration externe soumise à accord) |

## 16. Documents et modèles d'impression

Lettre de notification d'écart (identité `societe`) : DÉPLOYÉ. Rapport de
performance mensuel imprimable : DÉPLOYÉ (D-031). Fiche d'évaluation
imprimable : MANQUANT. Bon de demande d'intervention imprimable : MANQUANT.

## 17. Exports et rapports

Rapport loueur (D-058) : DÉPLOYÉ, impression et CSV via `ReportsView`.
Export des écarts par facture : MANQUANT. Export comptable (dettes
fournisseurs, D-065) : DÉPLOYÉ dans le module 20.

## 18. Historique et audit

`journal_contrats` (dossier, tarifs, clauses), `interventions_journal`,
`immobilisations_journal`, `calculs_clauses_journal` : DÉPLOYÉ. Factures :
auteur et date de saisie et de contrôle sur la ligne, pas de journal des
contrôles successifs : PARTIEL.

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `19_factures_neemba` (17), `21_facturation_par_engin` (7), `27_releves_kilometriques`, `13_contrats_fondation`, `32_interventions_loueur` (13), `48_contrats_finance` (111) | atomicité de la saisie ; facture sans engin rattaché au contrat |
| Unitaires | `src/domain/location/decompte.test.ts` (27), `Contrats/types.test.ts` (4) | - |
| E2E (API simulée) | `factures-neemba.spec.ts` (2), `contrats.spec.ts`, `contrats-finance.spec.ts` (3), `interventions-loueur.spec.ts` (1) | parcours J2 « contrôle de la facture Neemba » contre une vraie base (D-069 point 3) |

## 20. Critères de recette métier

1. Le chargé de contrats saisit le contrat Neemba réel, un tarif par engin
   (camions au km avec règle du retour à vide, chargeuses et pelle à
   l'heure) et rattache chaque engin loué au contrat.
2. Sur une période complète, la facture reçue est saisie ; le contrôle
   compare chaque ligne aux km validés ou aux heures FP signées et au tarif ;
   les lignes sans mesure sont signalées, jamais estimées.
3. L'écart positif est notifié, la lettre imprimée ; la régularisation
   reçue est enregistrée jusqu'au montant réclamé.
4. Les immobilisations imputées au loueur et les délais d'intervention de
   la période figurent dans le rapport loueur et l'évaluation.
5. PV signé par le chargé de contrats et la direction (jalon J2).

## Écarts et lots proposés

### Défauts bloquants constatés

1. `src/contexts/AuthContext.tsx:158-221` (`modulePermissionMap`) : aucune
   entrée pour `evaluation-loueur` (ni pour `budgets`, module 20) ;
   `canAccessModule` renvoie faux, l'entrée « Évaluation Neemba » est
   masquée pour tout rôle autre qu'administrateur, y compris
   `contract_manager`. Les fonctions serveur sont pourtant ouvertes au droit
   `contracts` : l'évaluation est inaccessible aux acteurs métier.

Défauts non bloquants :
- `src/components/Contrats/FacturesNeembaView.tsx:106-115` : en-tête puis
  lignes insérés en deux appels, sans transaction. Si les lignes sont
  refusées, la facture reste sans ligne, aucune ligne ne peut être ajoutée
  ensuite (pas d'écran) et elle ne peut être supprimée (DELETE retiré,
  D-072) : seule une intervention en base la corrige.
- `FacturesNeembaView.tsx:106` : montant TTC non saisissable alors que
  `v_reste_a_payer` l'utilise (repli sur le HT, D-065).

### Lots proposés (ordre)

1. (S) Ajouter `evaluation-loueur` (droit `contracts`) et `budgets` à la
   table d'accès ; test E2E de visibilité par rôle.
2. (M) Saisie de facture par fonction serveur atomique, modification des
   lignes tant que la facture est `saisie` ou `controlee`, annulation
   motivée d'une facture saisie par erreur, champ TTC.
3. (M) Fiche partenaire (identité, interlocuteurs, canaux, délais
   contractuels d'intervention repris automatiquement par D-049) ; dépend du
   référentiel fournisseurs (module 15, D-059).
4. (M) Vue « engins loués par contrat » et rattachement en masse ; contrôle
   d'un engin loué sans tarif ; dépend du module 08.
5. (M) Objet réclamation (ouverture, réponse du loueur, relance, clôture)
   relié aux écarts notifiés et aux régularisations.
6. (L) Décompte de location serveur (D-013, D-014 : franchise, arrondi,
   plafond, minimum) branché sur le contrôle des factures ; dépend des
   paramètres du contrat fournis par le propriétaire (aucune valeur par
   défaut).
7. (M) Tableau de bord Neemba (disponibilité contractuelle, écarts,
   délais, reste à payer) avec source, période et heure.
8. (M) Pièces jointes (facture scannée, rapports du loueur) ; dépend du
   stockage privé.
Points à trancher par le propriétaire : annulation d'une demande
d'intervention jamais honorée ; effet de l'annulation d'une immobilisation
clôturée et validée sur le contrôle Neemba (D-072) ; pénalités facturées
par facture au contrat de location plutôt que déduites (dérogation D-065).
Extension à déclencheur non commencée : portail Neemba (accord du
partenaire et test d'isolation RLS, bloc 1 section 9).

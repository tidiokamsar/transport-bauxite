# Module 19 : Contrats et engagements

Fiche du catalogue maître (D-077), construite sur `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 sur `origin/docs/catalogue-maitre` (base `main`
8df078d). Production : dossier contractuel D-026 (`20261110230000`),
engagements et comités D-031 (`20261111180000`), tarif par engin D-033
(`20261112100000`), clauses et échéances D-065 (`20261121120000`, déployée
`3bbfded`). Démonstration purgée (D-076) : aucun contrat réel saisi.

## Synthèse des états (inventaire de la section 2)

| État | Nombre |
|---|---|
| MANQUANT | 0 |
| MAQUETTE | 0 |
| PARTIEL | 8 |
| DÉVELOPPÉ | 0 |
| TESTÉ | 0 |
| DÉPLOYÉ | 15 |
| UTILISABLE | 0 |
| VALIDÉ | 0 |

Défauts bloquants constatés : 1 (menu « Évaluation Neemba » invisible pour
tout rôle autre qu'administrateur), plus 2 non-conformités aux règles du
catalogue (suppression physique de versions, tarifs et engagements d'un
contrat actif ; modification d'un tarif en vigueur sans avenant). Voir la
dernière section. Écrans de saisie prioritaires (contrats, versions,
tarifs) : fonctionnels.

## 1. Objectifs et périmètre

Le dossier contractuel est la source des règles d'argent : tarifs et unités
de facturation par engin (D-033), devise, délais de paiement, engagements
mesurés, pénalités, bonus et retenues, échéances. Il alimente la facture CBG
(module 20, D-029), le contrôle des factures Neemba (module 10, D-032), les
rapports de performance (D-031) et les décomptes (D-013). Aucune unité ni
aucun taux n'est codé en dur (D-013, D-033) ; un paramètre absent rend le
calcul « non calculable ».

Décisions de référence : D-013, D-022, D-026 (rôle `contract_manager`,
dérogation consciente à la séparation des tâches), D-029, D-031, D-032,
D-033, D-043 (km de retour à vide facturable), D-065 (clauses chiffrées,
échéances, évaluation du loueur), D-075.

## 2. Sous-modules (inventaire de la cible et état)

| # | Élément du catalogue | Cible précisée | État | Preuve |
|---|---|---|---|---|
| 1 | Contrats clients | Nature `client` (CBG), devise, délai de paiement | DÉPLOYÉ | `Formulaires.tsx:78-138`, `contrats` ; pgTAP 13 ; E2E `contrats` |
| 2 | Contrats fournisseurs | Nature `fournisseur`, liée à une fiche du module 15 | PARTIEL | Nature limitée à `client`, `location`, `autre` (CHECK `20261110230000` l.100) ; aucun lien fournisseur |
| 3 | Contrats de location | Nature `location` (Neemba), sens preneur | DÉPLOYÉ | idem ; `vehicles.contrat_id` (D-062) |
| 4 | Contrats de transport | Nature `transport` (sous-traitants éventuels) | PARTIEL | Saisi en `autre` |
| 5 | Parties | Contrepartie liée à un tiers (client, fournisseur, loueur) ; société (fiche `societe`) | PARTIEL | `contrepartie` texte libre ; fiche société (D-026) |
| 6 | Tarifs | Par version : unité, prix, engin, catégorie, conditions | DÉPLOYÉ | `FormulaireTarif`, `contrat_tarifs` ; pgTAP 21 |
| 7 | Unités de facturation | km, heure, tonne, jour, mois, forfait, autre, par engin | DÉPLOYÉ | D-033, `UNITES_TARIF` (`types.ts:138`) |
| 8 | Durées | Début, fin, préavis, renouvellement | DÉPLOYÉ | `contrats.date_debut/date_fin/preavis_jours/renouvellement*` |
| 9 | Avenants | Version numérotée, date d'effet, reprise de la grille | DÉPLOYÉ | `FormulaireVersion` (`Formulaires.tsx:140-238`) |
| 10 | Clauses | Clauses chiffrées et clauses textuelles référencées (article) | PARTIEL | Clauses chiffrées seulement (`contrat_clauses`) ; texte libre `description` |
| 11 | Obligations | Engagements mesurés (disponibilité, temps de cycle, remplissage, rotations, km, carburant) | DÉPLOYÉ | `contrat_engagements`, `comparer_engagements` ; pgTAP 18 ; E2E `suivi-recouvrement` |
| 12 | Échéances | Fin, préavis, renouvellement, dénonciation | DÉPLOYÉ | `enregistrer_echeance_contrat`, `v_echeances_contrats` ; pgTAP 48 ; E2E `contrats-finance` |
| 13 | Pénalités | Montant HT ou taux, condition = engagement non tenu, plafond | DÉPLOYÉ | `definir_clause`, `calculer_clauses`, `decider_clause` |
| 14 | Bonus | idem, engagement tenu | DÉPLOYÉ | idem |
| 15 | Retenues | idem | DÉPLOYÉ | idem |
| 16 | Renouvellements | Renouvellement exprès journalisé ; jamais de prolongation tacite écrite automatiquement | DÉPLOYÉ | D-065 (1) |
| 17 | Alertes | Échéance à J moins N, clause à décider ; notifiées | PARTIEL | « Mes validations » et `v_echeances_contrats` (réglage `contrats_alerte_echeance_jours`) ; aucune notification envoyée |
| 18 | Contrôle de conformité | Engagements contre réalisé, rapport figé remis | DÉPLOYÉ | `EngagementsView.tsx`, `generer_rapport_performance`, `marquer_rapport_remis` |
| 19 | Archivage | Contrat clos archivé, consultable, restaurable ; aucune suppression d'une version ou d'un tarif d'un contrat actif | PARTIEL | Statut `clos` ; suppression physique permise de versions, tarifs, engagements (`ContratsView.tsx:108-113`, politiques `20261110230000` l.183-190) |
| 20 | Historique des versions | Versions conservées, journal avant/après, comparaison de versions | PARTIEL | `journal_contrats` (déclencheur sur 4 tables) et journal des clauses ; aucune comparaison |
| 21 | Comités de contrat et actions | Comité, PV, actions suivies | DÉPLOYÉ | `ComitesView.tsx` |
| 22 | Évaluation du loueur | Grille, mesures figées, notes, correction motivée | PARTIEL | `EvaluationLoueurView.tsx`, `evaluer_loueur` (déployés) ; menu invisible hors administrateur (défaut 1) |
| 23 | Tableau de bord du chargé de contrats | Six indicateurs de la fiche de poste | DÉPLOYÉ | `MonPosteView.tsx`, `indicateurs_charge_contrats` |

## 3. Menus et sous-menus

Groupe « Contrats & Finance » (`menu.ts`). Correspondance de droits
(`src/contexts/AuthContext.tsx:159-221`) :

| Entrée | id | Droit | Visible par |
|---|---|---|---|
| Mon tableau de bord | `mon-poste` | `contracts` | admin, director, accountant, contract_manager |
| Dossier contractuel | `contrats` | `contracts` | idem (écriture : admin, contract_manager ; approbation : director) |
| Engagements et rapport | `engagements` | `contracts` | idem |
| Comités de contrat | `comites` | `contracts` | idem |
| Évaluation Neemba | `evaluation-loueur` | **absent de la table** | administrateur seulement (défaut 1) |

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Dossier contractuel : liste et fiche | Contrats, versions, tarifs, engagements, clauses, échéances, journal | DÉPLOYÉ | `ContratsView.tsx` ; E2E `contrats` (3), `contrats-finance` |
| Formulaires contrat, version, tarif, engagement, clause | Saisie | DÉPLOYÉ | `Formulaires.tsx` |
| Échéance (renouvellement, dénonciation) | Saisie | DÉPLOYÉ | `ContratsView.tsx:390-402` |
| Engagements et rapport | Comparaison, rapport figé, remise, calcul des clauses | DÉPLOYÉ | `EngagementsView.tsx`, `ClausesCalculees.tsx` |
| Comités | Comités, actions | DÉPLOYÉ | `ComitesView.tsx` |
| Évaluation Neemba | Grille, mesures, notes | PARTIEL (accès) | `EvaluationLoueurView.tsx` |
| Mon tableau de bord | Indicateurs du poste | DÉPLOYÉ | `MonPosteView.tsx` ; E2E `suivi-recouvrement` |
| Comparaison de deux versions | Versions | MANQUANT | - |
| Liste des contrats : export, filtres par nature et statut | Contrats | PARTIEL | Liste sans export |

## 5. Widgets et tableaux de bord

| Indicateur | Source | État |
|---|---|---|
| Six indicateurs du poste sur 12 mois, liste de clôture du mois | `indicateurs_charge_contrats` | DÉPLOYÉ |
| Engagements tenus / non tenus / non mesurables, échantillon | `comparer_engagements` | DÉPLOYÉ |
| Échéances à venir | `v_echeances_contrats` | DÉPLOYÉ |
| Montant des pénalités et bonus appliqués par contrat et période | `calculs_clauses` | PARTIEL (liste, pas de cumul) |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver/restaurer | Supprimer (brouillon) | Annuler/corriger |
|---|---|---|---|---|---|---|---|
| Contrat | DÉPLOYÉ (insert RLS `contracts`) | DÉPLOYÉ | DÉPLOYÉ (journalisé, y compris statut et devise sans contrôle) | MANQUANT | PARTIEL (statut `clos`) | DÉPLOYÉ (brouillon seulement, politique l.183) | sans objet |
| Version (avenant) | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (reprise de la grille) | MANQUANT | non conforme : suppression permise quel que soit le statut du contrat | sans objet |
| Tarif | DÉPLOYÉ | DÉPLOYÉ | non conforme : modification directe d'une version en vigueur (D-033 exige un avenant) | sans objet | sans objet | non conforme : suppression permise | sans objet |
| Engagement | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ | sans objet | sans objet | non conforme (sauf s'il conditionne une clause, D-065) | sans objet |
| Clause chiffrée | DÉPLOYÉ (`definir_clause`) | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (reprise à l'avenant) | DÉPLOYÉ (`desactiver_clause`, motif) | sans objet | sans objet |
| Calcul de clause | DÉPLOYÉ (`calculer_clauses`) | DÉPLOYÉ | interdit (garde) | sans objet | sans objet | interdit | DÉPLOYÉ (`decider_clause` ; retour à « proposé » si la facture produite est annulée) |
| Échéance | DÉPLOYÉ | DÉPLOYÉ | interdit (append-only) | sans objet | sans objet | interdit | MANQUANT (pas d'annulation d'un événement saisi à tort) |
| Rapport de performance | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (régénérable tant que non remis) | sans objet | sans objet | sans objet | interdit après remise |
| Comité, action | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (sans journal) | sans objet | DÉPLOYÉ (statut annulé / abandonnée) | sans objet | sans objet |

## 7. Modals et drawers

Fenêtres modales contrat, version, tarif, engagement, clause, échéance :
DÉPLOYÉ (`Formulaires.tsx:15-42`). Confirmation de suppression :
`window.confirm` sans vérification des dépendances ni motif (non conforme à
DeleteDialog). Décision de clause avec motif : DÉPLOYÉ. Pièces jointes
(contrat signé, avenant) : MANQUANT (`document_ref` texte). Historique :
journal affiché sur la fiche (DÉPLOYÉ) ; comparaison : MANQUANT.

## 8. Champs des formulaires

| Formulaire | Champs | Obligatoires | Règles |
|---|---|---|---|
| Contrat | référence, intitulé, nature, contrepartie, devise ISO, début, fin, statut, délai de paiement (j), préavis (j), renouvellement (tacite, exprès, aucun), durée de renouvellement (mois), description | référence, intitulé, nature, contrepartie, devise, début | référence unique ; devise `^[A-Z]{3}$` ; fin >= début ; préavis >= 0 ; durée > 0 |
| Version | numéro (0 = initial), intitulé, date d'effet, date de signature, référence du document, résumé, reprise de la grille | numéro, intitulé, date d'effet | (contrat, numéro) unique |
| Tarif | libellé, unité, prix unitaire (devise du contrat, HT), engin, catégorie, conditions, retour à vide facturable (si km) | libellé, unité, prix | prix >= 0 ; priorité engin, catégorie, tarif unique (D-033) |
| Engagement | indicateur, libellé, seuil, unité, sens, périodicité, conséquence | tous sauf conséquence | indicateur parmi la liste du CHECK |
| Clause | type, libellé, engagement mesuré, déclenchement, base (montant HT ou taux), valeur, plafond HT, article | tous sauf plafond et article | taux <= 100 ; montant 2 décimales, taux 4 (serveur) ; contrat brouillon ou actif |
| Échéance | événement, date (non future), motif, nouvelle fin (renouvellement), document | date, motif ; nouvelle fin > fin actuelle si renouvellement | verrou du contrat |

Champs cibles manquants : tiers lié (fiche fournisseur ou client), taux de
taxe par défaut du contrat, signataires, pièce du contrat signé, sens du
contrat (D-013 : preneur, bailleur, interne) explicite.

## 9. Actions individuelles et en masse

| Action | Droit | État |
|---|---|---|
| Créer, modifier contrat, version, tarif, engagement | écriture `contracts` | DÉPLOYÉ |
| Définir, désactiver une clause | écriture `contracts` | DÉPLOYÉ |
| Calculer les clauses d'un rapport remis | écriture `contracts` | DÉPLOYÉ |
| Appliquer une clause (ligne, facture ou avoir brouillon) | écriture `contracts`, préparateur | DÉPLOYÉ |
| Écarter une clause | approbation `contracts`, autre que l'auteur du calcul (réglage `clauses_renonciation_separee`) | DÉPLOYÉ |
| Renouveler, dénoncer | écriture `contracts` | DÉPLOYÉ |
| Générer, remettre le rapport de performance | écriture `contracts` | DÉPLOYÉ |
| Activer un contrat (brouillon -> actif) avec contrôle de complétude (tarifs, devise, délai) | approbation | MANQUANT (statut librement modifiable) |
| Exporter la liste et la grille tarifaire | lecture | MANQUANT |

## 10. Statuts et transitions

```
Contrat : brouillon -> actif -> suspendu -> actif -> clos
          (aujourd'hui : update direct du champ statut, ecriture contracts, journal ;
           cible : fonction serveur avec controle de completude et approbation)
Calcul de clause : propose -> applique | ecarte | sans_objet
                   applique -> propose (facture produite annulee, declencheur)
Rapport de performance : genere -> remis (date non future, destinataire), immuable
Echeance : evenement append-only (renouvellement reporte date_fin)
```

## 11. Workflows

Saisie du contrat et de sa version initiale (chargé de contrats) ; avenant
avec reprise de la grille ; chaque mois : engagements comparés, rapport figé
et remis, clauses calculées, décision (application par le préparateur,
signature de la facture par le Directeur Général, jamais le préparateur,
D-029 ; renonciation par une autre personne avec approbation). Échéances :
alerte à la date clé moins `contrats_alerte_echeance_jours`. Cible : circuit
d'activation d'un contrat validé par la direction ; avenant soumis à
approbation avant d'entrer en vigueur.

## 12. Rôles et permissions

Lecture : `contracts` (admin, director, accountant, contract_manager).
Écriture : `contracts` (admin, contract_manager). Approbation : director
(renonciation aux clauses). Contrats sans périmètre de site (référentiel
d'organisation, D-075). Dérogation consciente D-026 : le chargé de contrats
saisit aussi le terrain au démarrage ; l'état mensuel le signale.

## 13. Tables et relations

`contrats` (+ préavis, renouvellement) ; `contrat_versions` (contrat,
numéro unique) ; `contrat_tarifs` (+ `engin`, `km_retour_vide_facturable`) ;
`contrat_engagements` ; `contrat_clauses`, `calculs_clauses`,
`calculs_clauses_journal` ; `contrats_echeances` ; `rapports_performance` ;
`comites_contrat`, `comite_actions` ; `journal_contrats` ;
`criteres_evaluation_fournisseur` (grille `loueur`), évaluations du loueur.
Clés : versions, tarifs et engagements en `ON DELETE CASCADE` depuis le
contrat (seul un brouillon est supprimable) ; une version qui conditionne
une clause ne se supprime plus (D-065). RLS : lecture et écriture
`contracts` ; écriture navigateur directe sur `contrats`,
`contrat_versions`, `contrat_tarifs`, `contrat_engagements`,
`comites_contrat`, `comite_actions` (héritage D-026, limite consignée D-065).

## 14. Fonctions serveur et API

`definir_clause`, `desactiver_clause`, `calculer_clauses`, `decider_clause`,
`enregistrer_echeance_contrat`, `generer_rapport_performance`,
`marquer_rapport_remis`, `mesures_loueur`, `evaluer_loueur`,
`definir_critere_loueur`, `indicateurs_charge_contrats`
(`20261121120000`) ; `comparer_engagements` (`20261111180000`) ;
`journaliser_contrats` (déclencheur). Paramètres des appels vérifiés :
conformes.

## 15. Notifications

Échéance proche, clause à décider : « Mes validations » (D-056, D-065),
DÉPLOYÉ. Notification active (courriel, rappel planifié), escalade : MANQUANT.

## 16. Documents et modèles d'impression

Rapport de performance imprimable : DÉPLOYÉ (`EngagementsView`). Fiche
contrat, grille tarifaire, PV de comité, lettre de dénonciation : MANQUANT.

## 17. Exports et rapports

Export CSV des engagements (DÉPLOYÉ, `EngagementsView`). Liste des contrats,
grille tarifaire par engin, échéancier : MANQUANT.

## 18. Historique et audit

`journal_contrats` (insertion, modification, suppression avec avant/après
sur contrats, versions, tarifs, engagements), `calculs_clauses_journal` :
DÉPLOYÉ. Comités et actions : aucun journal (MANQUANT). Comparaison de
versions : MANQUANT.

## 19. Tests

Existants : pgTAP 13 (fondation), 18 (engagements, rapport), 21
(facturation par engin), 48 (clauses, échéances, évaluation, 111
assertions) ; unitaire `src/components/Contrats/types.test.ts` ; E2E
`contrats.spec.ts` (3, dont un profil chargé de contrats),
`contrats-finance.spec.ts` (3, profil administrateur),
`suivi-recouvrement.spec.ts`. Manquants : E2E « Évaluation Neemba » avec un
profil non administrateur (aurait révélé le défaut 1) ; test de refus de
suppression d'une version d'un contrat actif (à écrire avec le correctif).

## 20. Critères de recette métier

Le chargé de contrats saisit le contrat CBG et le contrat Neemba réels,
version initiale et avenants, tarifs par engin (camions au km, chargeuses et
pelle à l'heure, D-033), engagements et clauses du contrat signé ; un mois
complet produit un rapport figé, des clauses calculées et décidées, une
facture signée par le DG. PV signé : aucun.

## Points à trancher par le propriétaire

1. Dérogations D-065 : application d'une clause sans seconde personne avant
   la facture ; pénalités du loueur facturées par une facture D-029 au
   contrat de location plutôt que déduites de sa facture.
2. Interdire la suppression des versions, tarifs et engagements d'un contrat
   actif (correction par avenant) : recommandé par les règles du catalogue.
3. Natures supplémentaires (`fournisseur`, `transport`) et lien aux fiches
   tiers.
4. Activation d'un contrat soumise à approbation de la direction.
5. Grille d'évaluation du loueur (critères et poids).

## Défauts bloquants constatés

1. `src/contexts/AuthContext.tsx:159-221` : la table `modulePermissionMap`
   ne contient pas l'entrée `evaluation-loueur`. `canAccessModule` renvoie
   alors `false` (l.223-224) pour tout rôle autre qu'administrateur, et le
   menu « Évaluation Neemba » (`menu.ts`, groupe `finance`) est masqué
   (`Sidebar.tsx:49`). Le chargé de contrats, le directeur et le comptable
   ne peuvent pas ouvrir l'écran, alors que le serveur les y autorise. Les
   E2E (`contrats-finance.spec.ts`) tournent en administrateur
   (`e2e/api-simulee.ts:53`) et ne le détectent pas. Correctif : ajouter
   `'evaluation-loueur': 'contracts'`.

Non-conformités aux règles du catalogue (non bloquantes pour la saisie) :

2. `src/components/Contrats/ContratsView.tsx:108-113` (boutons l.277, 296,
   317) : suppression physique d'une version, d'un tarif ou d'un engagement
   quel que soit le statut du contrat (politiques `suppression_module`,
   `20261110230000` l.185-190). Une pièce contractuelle en vigueur est
   effacée (journalisée, mais l'historique de facturation perd sa
   référence) ; aucune vérification de dépendance ni motif.
3. `src/components/Contrats/Formulaires.tsx:255, 264-268` : modification en
   place d'un tarif (unité, prix, engin) d'une version déjà en vigueur, alors
   que D-033 exige qu'un changement de type de facturation passe par un
   avenant journalisé.

Écritures vérifiées sans défaut de colonne : `contrats`,
`contrat_versions`, `contrat_tarifs`, `contrat_engagements` (colonnes
existantes, y compris `preavis_jours`, `renouvellement`,
`renouvellement_duree_mois` de `20261121120000`, `engin` et
`km_retour_vide_facturable`) ; `comites_contrat`, `comite_actions`
(colonnes existantes, champs obligatoires exigés par le bouton,
`ComitesView.tsx:108`) ; valeurs des listes égales aux CHECK.

## Écarts et lots proposés

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Ajouter `evaluation-loueur` à `modulePermissionMap` ; E2E avec profil `contract_manager` | S | - |
| 2 | Interdire la suppression des versions, tarifs et engagements d'un contrat non brouillon ; DeleteDialog avec dépendances et motif | S | point 2 ; migration additive (politiques) |
| 3 | Modification d'un tarif en vigueur seulement par avenant (garde serveur) | M | point 2 |
| 4 | Écritures du dossier par fonctions serveur (activation avec contrôle de complétude, approbation) | L | point 4 |
| 5 | Lien contrat - tiers (fournisseur, client), natures `fournisseur` et `transport` | M | module 15, point 3 |
| 6 | Pièces jointes (contrat signé, avenants) | M | lot D |
| 7 | Comparaison de versions (HistoryDrawer) ; journal des comités | M | HistoryDrawer |
| 8 | Exports : liste des contrats, grille tarifaire par engin, échéancier | S | ExportModal |
| 9 | Notifications d'échéance et de clause à décider (rappel, escalade) | M | notifications |
| 10 | Annulation motivée d'un événement d'échéance saisi à tort | S | - |

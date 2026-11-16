# Module 11 : Maintenance et fiabilité

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : dernière release consignée 3bbfded,
démonstration purgée (D-076), aucune saisie réelle. Aucun élément
UTILISABLE ni VALIDÉ ; guide : `docs/guides/guide-flotte-maintenance.md`
(sections 2 et 3, « Limites connues »).

## 1. Objectifs et périmètre

Les engins sont loués à Neemba et entretenus par le loueur (D-022, D-027) :
le cœur du module n'est pas un atelier mais le suivi des **immobilisations**
(début, fin, cause, imputation loueur / exploitant / à déterminer) et des
**interventions du loueur** jusqu'à la remise en service validée (D-025,
D-049). Une immobilisation rend l'engin indisponible pour la planification
et le dispatch sans saisie supplémentaire ; ses heures alimentent la
disponibilité contractuelle, le contrôle des factures Neemba (heures d'arrêt
imputées au loueur), l'évaluation du loueur et les indicateurs MTBF, MTTR,
disponibilité. Les ordres de travail et la maintenance préventive internes
ne valent que pour les engins propres de Kogon (`vehicles.propriete =
'kogon'`, D-061, D-062) ; pour un engin loué, le préventif est un rappel des
obligations du loueur.

Décisions : D-022, D-025, D-027, D-031 (engagement de disponibilité), D-032
(heures d'arrêt imputées au loueur dans le contrôle), D-044 et D-067
(pièces sorties du registre des stocks, réservations), D-049, D-056
(remise en service dans « Mes validations »), D-057 (indicateurs), D-061
(ordres de travail et préventif corrigés), D-072 (clôture et annulation
refusées tant qu'une intervention n'est pas validée ; immobilisation annulée
exclue des indicateurs).

Entrées : engins (08), contrats et délais (10, 19), pneus (12 : cause
« pneumatique »), stocks (17 : pièces). Sorties : statut technique de
l'engin (`vehicles.status`), planification (04), dispatch (06), contrôle
Neemba (10), coûts (20), indicateurs (01, 21).

## 2. Sous-modules

1. Déclaration de panne et immobilisation (cause, imputation, référence du
   loueur).
2. Demande d'intervention au loueur, prise en charge, fin, pièces,
   validation de la remise en service.
3. Correction et annulation motivées, journal.
4. Ordres de travail internes (engins Kogon) et pièces du magasin.
5. Maintenance préventive (engins Kogon) ; rappel contractuel pour les
   engins loués.
6. Fiabilité : MTBF, MTTR, disponibilité, récurrence, analyse des causes.
7. Coût des immobilisations (perte de production, pénalités).

## 3. Menus et sous-menus

| Entrée | Vue | Droit lu |
|---|---|---|
| Maintenance > Immobilisations (`immobilisations`) | `Maintenance/ImmobilisationsView` | `maintenance` |
| Maintenance > Interventions Neemba (`interventions-loueur`) | `Maintenance/InterventionsLoueurView` | `maintenance` |
| Maintenance > Ordres de travail (`maintenance`) | `Maintenance/MaintenanceView` | `maintenance` |
| Maintenance > Préventif (`preventive`) | `Maintenance/PreventiveMaintenanceView` | `maintenance` |
| Reporting > Fiabilité des engins (`predictive-maintenance`) | `Analyses/AnalysesFlotte` `FiabiliteEnginsView` | `reports` |
| Mes validations (remise en service à valider) | `MesValidationsView` | `dashboard` |

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Immobilisations du mois (en cours, heures par imputation, export, rafraîchissement 60 s) | `immobilisations` | DÉPLOYÉ (cda275a) | `src/components/Maintenance/ImmobilisationsView.tsx:44-130` |
| Déclarer, clôturer, corriger, annuler une immobilisation | fonctions D-025 | DÉPLOYÉ | `src/components/Maintenance/FenetresImmobilisation.tsx:96-215` |
| Journal d'une immobilisation | `immobilisations_journal` | MANQUANT à l'écran (table écrite, lue par aucun écran) | recherche `immobilisations_journal` dans `src` : aucun résultat |
| Interventions du loueur (demande, prise en charge, fin avec rapport et pièces, validation ou refus) | `interventions_loueur`, `v_interventions_loueur` | DÉPLOYÉ (b2d81d8) | `src/components/Maintenance/InterventionsLoueurView.tsx:36-150` |
| Journal d'une intervention | `interventions_journal` | MANQUANT à l'écran | idem |
| Ordres de travail (engins Kogon : création, démarrage, fin, annulation motivée, pièces du magasin, réservations, export CSV) | `maintenance_orders`, `mouvement_stock` | DÉPLOYÉ (5ef4ab6 ; réservations et lots D-067 : TESTÉ, déploiement non consigné) | `src/components/Maintenance/MaintenanceView.tsx:56-190` |
| Préventif (plannings, échéance km ou jours, rappel Neemba pour un engin au contrat) | `maintenance_schedules`, `v_releves_compteur` | DÉPLOYÉ (5ef4ab6) | `src/components/Maintenance/PreventiveMaintenanceView.tsx:42-140` |
| Fiabilité des engins (MTTR, MTBF, disponibilité, heures loueur) | `fiabilite_engins` | DÉPLOYÉ | `AnalysesFlotte.tsx:48-110`, `20261111160000_analyses_flotte.sql:21` |
| Analyse des causes et récurrence (Pareto par cause, par engin) | - | MANQUANT | - |
| Coût des immobilisations | - | MANQUANT (matrice, module 11) | - |
| Fiche de panne avec diagnostic et priorité | - | MANQUANT (pas de champs diagnostic ni priorité sur l'immobilisation) | - |
| Tableau de bord maintenance | - | PARTIEL (indicateurs maintenance du Centre de pilotage D-057) | `indicateurs_pilotage` |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Engins immobilisés en ce moment | `immobilisations.statut = 'ouverte'` | instant, heure affichée | DÉPLOYÉ |
| Heures d'arrêt par imputation (loueur, exploitant, à déterminer) | calcul borné au mois (`totalParImputation`) et `heures_immobilisation` | mois | DÉPLOYÉ |
| MTTR, MTBF, disponibilité par engin | `fiabilite_engins` | période | DÉPLOYÉ |
| Délai de prise en charge, retard contractuel | `v_interventions_loueur` | - | DÉPLOYÉ (retard NULL si délai non saisi) |
| Ordres en cours, échéances préventives dépassées | `maintenance_orders`, `maintenance_schedules` | instant | PARTIEL (dans les listes, pas de widget) |
| Récurrence (pannes répétées d'un engin, d'une cause) | - | glissant | MANQUANT |
| Coût des immobilisations (heures x valeur, pénalités) | - | mois | MANQUANT (valeur horaire à fournir par le propriétaire) |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Immobilisation | DÉPLOYÉ (`declarer_immobilisation`) | DÉPLOYÉ | DÉPLOYÉ (`corriger_immobilisation`, motif) | sans objet | sans objet | sans objet | DÉPLOYÉ (`annuler_immobilisation`, motif ; refus si intervention non validée) |
| Intervention du loueur | DÉPLOYÉ (`demander_intervention_loueur`) | DÉPLOYÉ | sans objet (transitions) | - | - | - | PARTIEL (refus de remise en service ; pas d'annulation d'une demande jamais honorée, D-072) |
| Ordre de travail | DÉPLOYÉ (insert, colonnes accordées, numéro OT serveur) | DÉPLOYÉ | DÉPLOYÉ (colonnes de saisie ; garde `garde_ordre_travail`) | MANQUANT | sans objet | sans objet | DÉPLOYÉ (`annuler_ordre_travail`, motif) |
| Pièce imputée à un ordre | DÉPLOYÉ (`mouvement_stock`) | DÉPLOYÉ (`pieces_ordre_travail`) | sans objet | - | - | - | DÉPLOYÉ (`annuler_mouvement_stock`, contre-mouvement) |
| Planning préventif | DÉPLOYÉ (insert direct) | DÉPLOYÉ | DÉPLOYÉ (non journalisé) | MANQUANT | DÉPLOYÉ (désactivation, réactivation) | sans objet | PARTIEL (pas de journal) |

## 7. Modals et drawers

Déclarer, clôturer, corriger, annuler : DÉPLOYÉ (fenêtres dédiées,
`FenetresImmobilisation.tsx`). Demande et fin d'intervention : DÉPLOYÉ
(panneaux en ligne) ; prise en charge et refus : PARTIEL (`window.prompt`).
Ordre de travail et pièce : DÉPLOYÉ ; annulation : PARTIEL (`prompt`).
Historique (journal d'immobilisation, d'intervention) : MANQUANT.
Pièces jointes (rapport du loueur, photos) : MANQUANT (stockage).

## 8. Champs des formulaires

**Immobilisation** : engin (non réformé, obligatoire), début (date et heure
réelle, obligatoire), cause (panne, maintenance planifiée, pneumatique,
accident, attente de pièce, autre ; CHECK), imputation (loueur, exploitant,
à déterminer ; aucune valeur par défaut, CHECK), description (obligatoire),
référence du loueur. Clôture : fin (> début) et note. Correction : cause,
imputation, début, fin, motif obligatoire. Contraintes serveur : une seule
ouverte par engin (index unique partiel), pas de chevauchement, fin > début
(`20261110210000_immobilisations.sql:24-44`). Cible : priorité, symptôme,
diagnostic, système concerné (moteur, transmission, hydraulique, pneus,
électrique), compteur km ou heures à la déclaration.

**Demande d'intervention** : date et heure (obligatoire), canal (téléphone,
courriel, courrier, portail, sur place ; CHECK), description (obligatoire),
référence, délai contractuel en heures (> 0, facultatif, jamais supposé).
**Fin** : date et heure, rapport (obligatoire), pièces (désignation,
référence, quantité, fournie par loueur ou exploitant).

**Ordre de travail** : engin, titre, type (préventive, corrective ; enum),
priorité, atelier (interne, externe), site, date prévue, km, heures et coût
de main-d'œuvre, coût estimé et réel, notes.

**Planning préventif** : engin, titre, type, intervalle km et/ou jours (au
moins un, contrôle serveur `normaliser_planning_maintenance`), dernier km,
dernière date, coût estimé ; échéance calculée seulement si la dernière
intervention est connue. Intervalle en jours : entier (une valeur décimale
est refusée par la base).

## 9. Actions individuelles et en masse

| Action | État | Preuve |
|---|---|---|
| Déclarer une immobilisation (engin immobilisé ou en maintenance) | DÉPLOYÉ | `declarer_immobilisation` |
| Clôturer (engin redevient actif sauf s'il est suspendu) | DÉPLOYÉ | `cloturer_immobilisation` (dernière définition `20261120101000_correctifs_revue_r2.sql:347`) |
| Demander l'intervention au loueur | DÉPLOYÉ | `demander_intervention_loueur` (`20261120104000_correctifs_contre_revue.sql:74`) |
| Prise en charge, fin, validation ou refus de remise en service (autre personne) | DÉPLOYÉ | `prendre_en_charge_intervention`, `terminer_intervention`, `valider_remise_en_service` |
| Démarrer, terminer, annuler un ordre ; sortir ou retourner une pièce | DÉPLOYÉ | `MaintenanceView.tsx:134-162` |
| Désactiver / réactiver un planning | DÉPLOYÉ | `PreventiveMaintenanceView.tsx:96-100` |
| Générer un ordre depuis une échéance préventive | MANQUANT | - |
| Notifier le loueur électroniquement | MANQUANT (pas de SMTP ; intégration externe soumise à accord) | - |
| Actions en masse | MANQUANT | - |

## 10. Statuts et transitions

```
Immobilisation : ouverte -> cloturee (cloturer, droit maintenance, fin > début ;
                 refus si intervention active non validée)
                 ouverte | cloturee -> annulee (annuler, motif ; mêmes refus)
                 ouverte | cloturee -> (corrigée) (corriger, motif, journal)
Intervention : demandee -> prise_en_charge (technicien, heure)
               -> terminee (heure, rapport, pièces)
               -> remise_validee (autre personne que la saisie de fin ;
                  clôture l'immobilisation à l'heure de fin)
               terminee -> prise_en_charge (refus motivé)
Ordre de travail : open -> in_progress -> completed (non rouvert)
                   open | in_progress -> cancelled (motif ; refus si pièces imputées)
Engin : active -> immobilized (cause autre que maintenance planifiée) | maintenance
```

Points à trancher (D-072) : annulation d'une demande d'intervention jamais
honorée ; annulation d'une immobilisation clôturée dont l'intervention est
validée (elle retire ces heures du contrôle Neemba).

## 11. Workflows

1. Panne constatée (chauffeur, chef de poste) -> déclaration avec cause et
   imputation -> engin indisponible au dispatch.
2. Imputation loueur ou à déterminer -> demande d'intervention (canal,
   délai contractuel) -> prise en charge par le technicien Neemba -> fin
   avec rapport et pièces -> validation par une seconde personne -> engin
   disponible ; refus motivé -> retour à la prise en charge.
3. Retard : calculé si le délai contractuel est saisi ; aucune relance ni
   escalade automatique (MANQUANT).
4. Engin Kogon : ordre de travail, pièces sorties du magasin (réservation
   possible), fin ; préventif selon km (relevés D-043) ou calendrier.
Séparation des tâches : saisie de fin et validation de remise en service
par deux personnes (D-049).

## 12. Rôles et permissions

| Action | Module et niveau | Périmètre |
|---|---|---|
| Lire immobilisations, interventions, ordres, plannings | `maintenance` lecture | engin ou site (D-046, D-075) |
| Déclarer, clôturer, corriger, annuler ; interventions | `maintenance` écriture (fonctions serveur) | site de l'engin |
| Ordres de travail | `maintenance` écriture ; pièces : en plus droit `stock` et dépôt écrivable | site de l'ordre ou de l'engin (`20261115210000_perimetre_etendu.sql:67`) |
| Valider une remise en service | `maintenance` écriture, autre personne que la saisie de fin | site |
| Fiabilité | `reports` lecture | RLS des tables lues |

Droit d'approbation distinct pour la validation de remise en service :
MANQUANT (seule la règle « autre personne » s'applique).

## 13. Tables et relations

`immobilisations` et `immobilisations_journal` (`20261110210000`) ;
`interventions_loueur`, `interventions_pieces`, `interventions_journal`,
vue `v_interventions_loueur` (`20261116120000`) ; `maintenance_orders`
(colonnes accordées, numéro OT, garde, `20261118180000_corrections_ecrans.sql:118-129`),
`stock_movements` rattachés à l'ordre, `reservations_stock` (D-067) ;
`maintenance_schedules` (déclencheur `normaliser_planning_maintenance`) ;
`releves_compteur` (D-043). Tables héritées en lecture seule :
`parts_inventory`, `maintenance_parts` (suppression à décider).

## 14. Fonctions serveur et API

`declarer_immobilisation`, `cloturer_immobilisation`,
`corriger_immobilisation`, `annuler_immobilisation`,
`heures_immobilisation`, `demander_intervention_loueur`,
`prendre_en_charge_intervention`, `terminer_intervention`,
`valider_remise_en_service`, `annuler_ordre_travail`,
`pieces_ordre_travail`, `mouvement_stock`, `annuler_mouvement_stock`,
`reserver_stock`, `lever_reservation_stock`, `fiabilite_engins`,
`rapport_loueur`, `rapport_journalier` (immobilisations du jour).
Manquantes : `annuler_demande_intervention` (à décider), `generer_ordre_preventif`,
`cout_immobilisations`, `recurrence_pannes`.

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Remise en service à valider | personnes ayant le droit maintenance | « Mes validations » | DÉPLOYÉ (D-056) |
| Engin immobilisé | dispatch, chef de poste | - | MANQUANT (effet sur la disponibilité, sans message) |
| Intervention en retard | maintenance, contrats | écran | PARTIEL |
| Échéance préventive dépassée | maintenance | écran (statut « dépassée ») | PARTIEL |
| Demande d'intervention au loueur | Neemba | hors application (canal saisi) | PARTIEL |

## 16. Documents et modèles d'impression

Bon de demande d'intervention, fiche de remise en service signée, ordre de
travail imprimable : MANQUANT.

## 17. Exports et rapports

Export des immobilisations du mois : DÉPLOYÉ (`ImmobilisationsView.tsx:122`).
Export CSV des ordres : DÉPLOYÉ. Export des interventions et du préventif :
MANQUANT. Rapport loueur et rapport journalier (D-058) : DÉPLOYÉ.

## 18. Historique et audit

Journaux append-only `immobilisations_journal` et `interventions_journal`
(état avant, après, motif, auteur) : DÉPLOYÉ côté serveur, non consultables
à l'écran : PARTIEL. Ordres : annulation motivée tracée sur la ligne ;
modifications non journalisées. Plannings : non journalisés.

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `12_immobilisations` (18), `32_interventions_loueur` (13), `44_corrections_ecrans` (47), `17_analyses_flotte` (6), `55_correctifs_revue_achats_maintenance`, `56_correctifs_contre_revue`, `50_stocks_avances` (réservations) | annulation d'une demande jamais honorée (après décision) |
| Unitaires | `immobilisations.test.ts` (5), `interventions.test.ts` (1), `maintenance.test.ts` (7) | - |
| E2E (API simulée) | `immobilisations.spec.ts` (3), `interventions-loueur.spec.ts` (1), `corrections-ecrans.spec.ts` (ordre, préventif), `analyses.spec.ts` (fiabilité) | parcours immobilisation -> intervention -> remise en service contre une vraie base |

## 20. Critères de recette métier

1. Une panne réelle d'un camion loué est déclarée (imputation loueur) ; le
   camion disparaît des disponibles au dispatch.
2. La demande à Neemba, la prise en charge, la fin avec rapport et la
   validation par une seconde personne sont saisies ; l'engin redevient
   disponible ; les heures figurent au contrôle de la facture Neemba et au
   rapport loueur du mois.
3. Le MTTR et la disponibilité du mois concordent avec les arrêts saisis.
4. Une correction ou une annulation exige un motif et reste visible.
5. PV signé par le responsable maintenance et l'exploitation.

## Écarts et lots proposés

### Défauts bloquants constatés

Aucun défaut bloquant sur les écrans d'écriture du module 11 : les
paramètres envoyés correspondent aux signatures des fonctions
(`declarer_immobilisation`, `cloturer_immobilisation`,
`corriger_immobilisation`, `annuler_immobilisation`,
`demander_intervention_loueur`, `prendre_en_charge_intervention`,
`terminer_intervention`, `valider_remise_en_service`,
`annuler_ordre_travail`, `mouvement_stock` à 13 arguments) ; les colonnes
écrites directement sur `maintenance_orders` et `maintenance_schedules`
existent et sont accordées ; `frequency_type` et `frequency_value`
(NOT NULL) sont remplies par le déclencheur ; les choix vides (engin, type)
bloquent l'envoi.

Défauts non bloquants :
- `src/components/Maintenance/FenetresImmobilisation.tsx:73` et
  `ImmobilisationsView.tsx:119` : libellés « Nimba Mining » (remplacé par
  Neemba, D-027).
- `src/components/Maintenance/PreventiveMaintenanceView.tsx:89` : intervalle
  en jours accepté en décimal, colonne `integer` : refus serveur.

### Lots proposés (ordre)

1. (S) Libellés Neemba ; intervalle en jours entier côté écran.
2. (S) Historique consultable (journal d'immobilisation et d'intervention)
   dans un HistoryDrawer commun.
3. (M) Fiche de panne enrichie (priorité, symptôme, système, compteur à la
   déclaration) ; migration additive.
4. (M) Analyse des causes et récurrence ; coût des immobilisations dès que
   le propriétaire fournit la valeur horaire de référence (aucune valeur
   inventée) ; dépend du module 10 (pénalités, clauses D-065).
5. (S) Annulation d'une demande jamais honorée, après décision du
   propriétaire (D-072).
6. (M) Délai contractuel repris automatiquement du contrat ; relance et
   escalade d'une intervention en retard ; dépend du module 10.
7. (M) Génération d'un ordre de travail depuis une échéance préventive
   (engins Kogon) ; impression de l'ordre et du bon de remise en service.
8. (M) Pièces jointes (rapport du loueur, photos) ; dépend du stockage.
Extensions à déclencheur non commencées : prévision de maintenance et
détection d'anomalies (durée de données réelles validées fixée par le
propriétaire), maintenance conditionnelle par capteurs ou codes défaut
(choix d'un matériel), bloc 1 section 9.

# Module 05 : Shift Management (postes de travail)

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`.
Constat établi le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : migrations jusqu'à `20261121120000`
appliquées (journal `docs/SIGTB_2.0_HEBERGEMENT_VPS.md`, section 9), base
purgée de la démonstration (D-076). Aucun élément n'est UTILISABLE ni
VALIDÉ : aucun compte réel, aucun référentiel réel, aucun guide de rôle,
aucun PV.

## Mise à jour D-087 (2026-11-17, état constaté sur la branche `lot-06/dispatch-control-center`)

État : **Développé et testé** (pgTAP 65, vitest, E2E sur API simulée) ; non fusionné, non déployé. Rien n'est « utilisable » ni « validé » tant que les rôles et données réels ne l'ont pas rejoué.

- Instance de shift (`postes`) : états planifié, ouvert, en cours, clôturé, validé, annulé ; `version` ; journal `postes_journal` append-only. Fonctions : `planifier_poste`, `ouvrir_poste` (ouvre aussi un planifié), `changer_etat_poste` (démarrer, annuler motivé), `cloturer_shift` (motif si voyages non terminés), `cloturer_poste` (même refus).
- Incohérence corrigée : la barre supérieure et le filtre du Dispatch ne présentent plus un shift configuré comme actif ; « Shift X en cours » seulement si une instance est ouverte ou en cours.
- L'écran Postes de travail garde ses fonctions, affiche les nouveaux états et exploite un poste en cours comme un poste ouvert ; planifier, démarrer et annuler se font depuis Dispatch, onglet Shift. Sa clôture (`cloturer_poste`) est refusée si des voyages ne sont pas terminés : la clôture motivée passe par le Dispatch.

## Synthèse des états

| # | Fonctionnalité (liste du propriétaire, standard 12 blocs) | État | Preuve |
|---|---|---|---|
| 1 | Création des shifts et modèles d'horaires | PARTIEL | Table `work_shifts` (base de référence) lue par 9 écrans ; aucun écran ni fonction d'écriture (voir défaut B1) |
| 2 | Équipes permanentes (équipes A, B, C et leur rotation) | MANQUANT | - |
| 3 | Responsable du poste | PARTIEL | `ouvrir_poste(p_responsable)` ; l'écran envoie `null` (`PostesView.tsx:79`), le responsable est toujours l'ouvreur |
| 4 | Ouverture du poste | DÉPLOYÉ | `ouvrir_poste` (`20261116090000_postes.sql`), pgTAP 31, E2E `postes.spec.ts` |
| 5 | Passation des consignes | DÉPLOYÉ | Consignes de sortie du dernier poste clos du site reprises ; pgTAP 31 (ligne 61), E2E `postes.spec.ts` |
| 6 | Affectation des chauffeurs au poste | DÉPLOYÉ | `affecter_au_poste` (version `20261120104000`), pgTAP 31 et 53 ; non couvert en E2E |
| 7 | Affectation des véhicules et engins au poste | PARTIEL | Serveur prêt (`p_vehicle_id`, périmètre, relève) ; l'écran envoie toujours `p_vehicle_id: null` (`PostesView.tsx:81`) |
| 8 | Présences, retards et absences motivées | DÉPLOYÉ | `pointer_presence`, pgTAP 31, E2E `postes.spec.ts` |
| 9 | Événements et incidents du poste | DÉPLOYÉ | `postes_evenements` append-only, `consigner_evenement_poste`, pgTAP 31 et 53 |
| 10 | Objectifs par shift visibles dans le poste | PARTIEL | Objectifs au module 04 ; affichés seulement dans le bilan figé à la clôture |
| 11 | Clôture avec bilan figé | DÉPLOYÉ | `cloturer_poste`, pgTAP 31, E2E `postes.spec.ts` |
| 12 | Validation de la clôture (autre personne) | DÉPLOYÉ | `valider_cloture_poste`, pgTAP 31 (lignes 57, 67) |
| 13 | Rapport de shift imprimable | PARTIEL | `window.print()` de toute la page (`PostesView.tsx:132`) ; `rapport_shift` dans Rapports (D-058, pgTAP 41) ; pas de modèle d'impression du poste |
| 14 | Comparaison entre shifts | DÉPLOYÉ | `comparer_shifts` (`20261121090000`), `ComparaisonShifts.tsx`, pgTAP 46, E2E `planification-avancee.spec.ts` |
| 15 | Historique des équipes | PARTIEL | Liste des postes de la période et présences comptées (`ComparaisonShifts.tsx:39`) ; pas d'historique par chauffeur ou engin |
| 16 | Notifications (clôture à valider, clôture validée) | DÉPLOYÉ | `mes_validations` et `notifier_validation_poste` (`20261117180000`) ; aucun test pgTAP sur la partie poste |
| 17 | Relances et escalades (poste non clos, clôture non validée) | MANQUANT | - |
| 18 | Tableau de bord du module | MANQUANT | Seul le shift en cours est affiché dans la barre supérieure (`TopBar.tsx`) |
| 19 | Liste (recherche, filtres, tri, pagination, export) | PARTIEL | Filtre par date seulement (`PostesView.tsx:43`) ; export CSV dans la comparaison seulement |
| 20 | Fiche détaillée avec historique des actions | PARTIEL | Colonnes `ouvert_par`, `cloture_par`, `valide_par` et horodatages en base, non affichées |
| 21 | Pièces jointes (rapport signé, photos) | MANQUANT | Aucun stockage de fichiers (matrice, constat 4) |
| 22 | Commentaires internes | MANQUANT | - |
| 23 | Réouverture ou annulation motivée d'un poste | MANQUANT | Aucune fonction ; un poste ouvert par erreur reste ouvert |
| 24 | Retrait d'un membre, correction de présence après clôture | MANQUANT | Aucune fonction (le message de `affecter_au_poste` invite pourtant à « retirer cette ligne ») |
| 25 | Paramétrage (catégories d'événements, règles de clôture) | MANQUANT | Catégories figées par contrainte CHECK |

Décompte : DÉPLOYÉ 9, PARTIEL 8, MANQUANT 8, MAQUETTE 0, DÉVELOPPÉ 0,
TESTÉ 0 (les éléments testés sont aussi déployés), UTILISABLE 0, VALIDÉ 0.

## 1. Objectifs et périmètre

Le module transforme un modèle d'horaires (`work_shifts`, ex. jour et nuit)
en **poste** : l'instance d'un shift pour une date et un site, avec un
responsable, une équipe pointée, un journal, une passation et une clôture
validée. Le poste est l'unité de pilotage de l'exploitation à Nimba : il
borne les voyages (`trips.shift_id`), les objectifs (`objectifs_production`),
les fiches terrain FR, FP et FC (D-028), les rapports de shift (D-058) et la
comparaison entre shifts (D-063).

Décisions de référence : D-048 (postes), D-063 (comparaison des shifts,
rapport de production), D-023 (objectifs par shift), D-024 et D-066
(l'affectation des voyages reste au dispatch), D-038, D-039, D-075
(périmètre site), D-051 (habilitations), D-056 (validations et
notifications), D-058 (`rapport_shift`), D-072 R2-C5 (périmètre de l'équipe).

Entrées : shifts (ce module), sites (module 03), chauffeurs (module 09),
engins (module 08), objectifs (module 04), voyages (module 07).
Sorties : bilan figé vers le module 04 (clôture de planification,
`rapport_production`), le module 21 (`rapport_shift`, indicateurs), le
module 01 (pilotage), le module 24 (Mes validations), le module 09
(présences et retards des chauffeurs).

Hors périmètre : l'affectation des voyages (module 06) ; la paie et les
présences RH (`employee_attendance`, écran hérité RH) ; le pointage des
heures des engins Neemba (fiche FP, modules 07 et 10).

## 2. Sous-modules

| Sous-module | Contenu cible | État |
|---|---|---|
| 05.1 Modèles d'horaires | Code, libellé, heure de début et de fin (passage de minuit), ordre, couleur, actif, sites où il s'applique | PARTIEL |
| 05.2 Équipes | Équipes nommées (A, B, C), membres permanents, cycle de rotation (ex. 2 jours, 2 nuits, 2 repos), chef d'équipe | MANQUANT |
| 05.3 Postes | Ouverture, responsable, équipe du jour, objectifs, journal, clôture, validation | DÉPLOYÉ en partie (voir synthèse) |
| 05.4 Passation | Consignes reçues, consignes transmises, accusé de lecture par le responsable entrant | DÉPLOYÉ sans accusé de lecture |
| 05.5 Rapport de shift | Bilan figé, rapport rédigé, modèle imprimable signé | PARTIEL |
| 05.6 Analyse | Comparaison entre shifts, historique des équipes, retards et absences par personne | PARTIEL |

## 3. Menus et sous-menus

| Entrée (`src/components/Layout/menu.ts`) | Vue | Visibilité |
|---|---|---|
| `postes` « Postes de travail » (ligne 37) | `Postes/PostesView` (`App.tsx:138`) | Visible de tous les comptes : le menu n'est pas filtré par droit (`Sidebar.tsx` ne lit aucune permission). Les panneaux d'écriture sont masqués selon `trips` (create/edit) et `planning` (edit) |
| `planification` « Planification », onglet comparaison | `Planning/ComparaisonShifts` (`PlanificationView.tsx:233`) | Idem |
| Modèles d'horaires | Aucune entrée | MANQUANT (cible : Paramètres > Référentiels > Shifts) |

Cible : masquer l'entrée aux comptes sans lecture `trips` ni `planning`.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Postes du jour (liste par date) | `postes` | PARTIEL | `PostesView.tsx:116-122` ; ni filtre site, shift, statut, ni pagination, ni export |
| Ouvrir un poste | `ouvrir_poste` | DÉPLOYÉ | `PostesView.tsx:107-114` |
| Fiche du poste (passation, bilan, rapport) | `postes` | PARTIEL | `PostesView.tsx:124-133` ; auteurs et heures d'ouverture, clôture, validation non affichés |
| Équipe du poste | `postes_equipe` | PARTIEL | `PostesView.tsx:135-146` ; chauffeurs seulement, un membre engin s'affiche « Engin » sans immatriculation |
| Journal des événements | `postes_evenements` | DÉPLOYÉ | `PostesView.tsx:148-156` ; heure = maintenant, sans engin |
| Clôture du poste | `cloturer_poste` | DÉPLOYÉ | `PostesView.tsx:158-162` |
| Validation de la clôture | `valider_cloture_poste` | DÉPLOYÉ | `PostesView.tsx:163` |
| Comparaison entre shifts et historique des équipes | `comparer_shifts`, `postes` | DÉPLOYÉ | `ComparaisonShifts.tsx` |
| Rapport de shift | `rapport_shift` | DÉPLOYÉ (module 21) | `src/lib/rapports.ts:21`, `Reports/ReportsView` |
| Référentiel des shifts (modèles d'horaires) | `work_shifts` | MANQUANT | Aucun écran n'écrit `work_shifts` (recherche `from('work_shifts')` : lectures seules) |
| Équipes permanentes et planning de rotation | - | MANQUANT | - |
| Tableau de bord des postes | - | MANQUANT | - |
| Historique d'un chauffeur ou d'un engin par poste | - | MANQUANT | - |

## 5. Widgets et tableaux de bord

| Indicateur cible | Source | Période | État |
|---|---|---|---|
| Shift en cours | `work_shifts` (heure locale) | Instant | DÉPLOYÉ (`TopBar.tsx`) ; vide si aucun shift |
| Postes ouverts, clos à valider, validés | `postes.statut` | Jour, semaine | PARTIEL : comptés dans `indicateurs_exploitation` (rangs 90 et 91, `20261118090000_reporting.sql:352-355`), pas de widget dans l'écran |
| Postes non ouverts alors que le shift a commencé | `work_shifts` x `postes` | Jour | MANQUANT |
| Taux de présence, retards cumulés, absences par motif | `postes_equipe` | Poste, période | PARTIEL : `comparer_shifts` (présences, absences, minutes de retard), `rapport_shift` |
| Objectif et réalisé du poste en cours | `v_realisation_objectifs` | Poste | PARTIEL : figé à la clôture seulement (`bilan`) |
| Événements par catégorie | `postes_evenements` | Poste, période | PARTIEL : `comparer_shifts`, `rapport_shift` |

Chaque indicateur porte période, source et heure de calcul (`Provenance`
dans `ComparaisonShifts`) ; à reprendre pour tout nouveau widget.

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Modèle d'horaire `work_shifts` | MANQUANT (écran) | DÉPLOYÉ (lecture ouverte aux authentifiés) | MANQUANT | MANQUANT | MANQUANT (`is_active` existe, sans écran) | Interdit si utilisé (FK `objectifs_production` RESTRICT, `postes`, `trips`) | - |
| Poste `postes` | DÉPLOYÉ | DÉPLOYÉ | Par actions seulement (clôture, validation) | Sans objet | Sans objet (jamais supprimé) | Interdit | MANQUANT (annulation motivée d'un poste ouvert par erreur, réouverture autorisée) |
| Membre `postes_equipe` | DÉPLOYÉ (chauffeur), PARTIEL (engin) | DÉPLOYÉ | DÉPLOYÉ (présence tant que le poste est ouvert) | MANQUANT (reprendre l'équipe du poste précédent) | - | MANQUANT (retrait motivé tant que le poste est ouvert) | MANQUANT (rectification de présence après clôture, tracée) |
| Événement `postes_evenements` | DÉPLOYÉ | DÉPLOYÉ | Interdit (append-only, pgTAP 31 ligne 48) | - | - | Interdit | MANQUANT (événement rectificatif lié) |
| Équipe permanente | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | - |

## 7. Modals et drawers

| Élément | Cible | État |
|---|---|---|
| CreateModal shift (modèle d'horaire) | Formulaire de la section 8.1 | MANQUANT |
| Ouverture de poste | Panneau en ligne (shift, site, consignes) | DÉPLOYÉ (panneau, pas de modal) ; responsable à ajouter |
| Pointage de présence | Modal (présent, retard en minutes, motif d'absence en liste et texte) | PARTIEL : `window.prompt` (`PostesView.tsx:84-85`), saisie non numérique convertie en `null` sans message |
| Ajout d'un membre | Modal chauffeur, engin, ou les deux (relève) | PARTIEL : chauffeur seul |
| Consigner un événement | Catégorie, heure, engin, description | PARTIEL : heure et engin absents |
| ActionDialog clôture | Récapitulatif du bilan avant confirmation | PARTIEL : clôture directe, bilan visible après |
| ActionDialog validation | Confirmation avec rappel du bilan | PARTIEL : bouton direct |
| ActionDialog annulation ou réouverture | Motif obligatoire | MANQUANT |
| DetailDrawer poste | Auteurs, heures, membres, événements, voyages du poste | PARTIEL |
| HistoryDrawer | Chronologie ouverture, ajouts, pointages, événements, clôture, validation | MANQUANT (pointages non journalisés : `UPDATE` en place, voir section 18) |
| AttachmentModal | Rapport papier signé, photos | MANQUANT |
| ExportModal | CSV, PDF des postes et du rapport | PARTIEL (CSV de la comparaison) |

## 8. Champs des formulaires

### 8.1 Modèle d'horaire (cible, table existante)

| Champ | Type | Obligatoire | Règle |
|---|---|---|---|
| `name` (code) | texte | oui | Unique (`unique_shift_name`), minuscules sans espace |
| `display_name` | texte | oui | Libellé affiché |
| `start_time`, `end_time` | heure | oui | `end_time` < `start_time` signifie passage de minuit (shift de nuit) ; à rendre explicite à l'écran |
| `shift_order` | entier | oui | Unique (`unique_shift_order`) |
| `color` | couleur | non | Défaut `#3b82f6` |
| `is_active` | booléen | oui | Désactivation au lieu de suppression dès qu'un poste, un objectif ou un voyage l'utilise |
| Sites concernés | liste | à trancher | Aucune colonne : un shift vaut aujourd'hui pour tous les sites |

Écriture cible : fonction serveur `enregistrer_shift` (droit à trancher :
administrateur ou `planning`), journalisée. Aujourd'hui l'écriture directe
est permise aux comptes ayant `has_module_write('trips')` (politique
`ecriture_roles_metier`, `20260903090100_restrict_open_rls_policies.sql:142`),
sans écran, sans journal ni périmètre site.

### 8.2 Ouverture de poste

| Champ | Type | Obligatoire | Règle client | Règle serveur |
|---|---|---|---|---|
| Date | date | oui | Sélecteur de l'en-tête | Au plus tard demain (`p_date > current_date + 1` refusé) ; aucune borne dans le passé (à trancher) |
| Shift | liste `work_shifts` actifs | oui | Bouton désactivé si vide | Non nul ; unicité (date, shift, site) |
| Site | liste `sites` | oui | Bouton désactivé si vide | `site_permis` |
| Responsable | liste de profils | cible oui | Absent de l'écran | Défaut : l'appelant |
| Consignes complémentaires | texte | non | - | Concaténées aux consignes reçues |

### 8.3 Membre de l'équipe

| Champ | Type | Obligatoire | Règle serveur |
|---|---|---|---|
| Chauffeur | liste `drivers` actifs | chauffeur ou engin | Périmètre du chauffeur, unique dans le poste, un seul poste par date et shift |
| Engin | liste `vehicles` | chauffeur ou engin | `vehicule_permis` ; engin seul une fois par poste ; relève (deux chauffeurs sur un camion) admise |
| Présence | présent / absent | à la clôture | Absence : motif obligatoire ; retard en minutes >= 0 |

Cible complémentaire : contrôle d'habilitation à l'ajout (D-051, aujourd'hui
contrôlé au dispatch seulement), avertissement si l'engin est immobilisé.

### 8.4 Événement

Catégorie (incident, arrêt, retard, sécurité, information ; CHECK),
description non vide, heure (pas plus de 5 minutes dans le futur), engin
facultatif (périmètre). Champ conditionnel cible : catégorie « incident »
ou « sécurité » propose la déclaration HSE (module 22, `declarer_incident`).

### 8.5 Clôture

Consignes pour le poste suivant (obligatoires, même « rien à signaler »),
rapport (facultatif). Serveur : toute l'équipe pointée.

## 9. Actions individuelles et en masse

| Action | Type | État |
|---|---|---|
| Ouvrir, clore, valider un poste | Individuelle | DÉPLOYÉ |
| Ajouter un chauffeur | Individuelle | DÉPLOYÉ |
| Ajouter un engin, une relève | Individuelle | PARTIEL (serveur seul) |
| Pointer présence, absence | Individuelle | DÉPLOYÉ |
| Pointer toute l'équipe présente | En masse | MANQUANT |
| Reprendre l'équipe du poste précédent ou de l'équipe permanente | En masse | MANQUANT |
| Valider plusieurs clôtures | En masse | MANQUANT |
| Annuler, réouvrir un poste | Individuelle, motivée | MANQUANT |
| Imprimer le rapport | Individuelle | PARTIEL |
| Exporter la comparaison | Individuelle | DÉPLOYÉ (CSV) |

## 10. Statuts et transitions

```
(aucun) -> ouvert   (ouvrir_poste ; W trips ; site_permis, unicité date x shift x site, date <= demain)
ouvert  -> cloture  (cloturer_poste ; W trips ; site_permis ; équipe pointée ; consignes de sortie ; bilan figé)
cloture -> valide   (valider_cloture_poste ; W planning ; site_permis ; valideur <> auteur de la clôture)
```

Cible à ajouter (à trancher par le propriétaire) :

```
ouvert  -> annule   (annuler_poste ; W trips ; motif ; aucun voyage du shift engagé)
cloture -> ouvert   (reouvrir_poste ; W planning ; motif ; bilan précédent conservé dans l'historique)
valide  -> (figé)   correction par événement rectificatif seulement
```

Statuts d'un membre : non pointé -> présent (retard éventuel) ou absent
(motif) ; modifiable tant que le poste est ouvert.

## 11. Workflows

1. Le chef de poste Kogon ouvre le poste au début du shift (ou la veille) ;
   il lit les consignes du poste précédent du site.
2. Il compose l'équipe : chauffeurs de semi-remorques, opérateurs des
   chargeuses et de la pelle (à trancher : opérateurs Kogon ou Neemba,
   D-022), engins du poste.
3. Pendant le shift : pointage des présences et retards, journal des
   arrêts (pannes, attente au chargement, fermeture de piste), incidents.
   Les voyages sont affectés au dispatch (module 06).
4. Fin de shift : consignes pour le poste suivant, rapport, clôture ; le
   bilan (objectif, livré, voyages, présences, événements) est figé.
5. Validation par une autre personne ayant le droit `planning` (chef
   d'exploitation) ; la clôture à valider apparaît dans Mes validations
   (D-056), l'auteur est notifié de la validation.
6. Cible : relance si un poste reste ouvert plus de N heures après la fin
   théorique du shift, ou si une clôture n'est pas validée sous N heures ;
   escalade au directeur d'exploitation (délais à fixer par le
   propriétaire). Délégation de validation : module 24.

Séparation des tâches : clôture et validation par deux personnes (serveur).

## 12. Rôles et permissions

| Action | Droit | Périmètre | Preuve |
|---|---|---|---|
| Lire postes, équipe, journal | `has_module_view('trips')` ou `planning` ou administrateur | `site_permis(site_id)` ; équipe et journal suivent le poste | Politiques `lecture` (`20261116090000_postes.sql`) |
| Ouvrir, composer, pointer, consigner, clore | `has_module_write('trips')` | Site du poste, du chauffeur, de l'engin | `poste_ecrivable`, `affecter_au_poste` (`20261120104000`) |
| Valider la clôture | `has_module_write('planning')`, autre personne | Site du poste | `valider_cloture_poste` |
| Comparer les shifts | Lecture (SECURITY INVOKER) | `site_permis` | `comparer_shifts` (`20261121090000`) |
| Lire `work_shifts` | Tout compte authentifié | Aucun | Politique `lecture_authentifies` (`20260903090100`) |
| Écrire `work_shifts` | `has_module_write('trips')`, écriture directe | Aucun | `ecriture_roles_metier` ; cible : fonction serveur réservée (à trancher) |

Les droits par utilisateur (D-036) priment sur la matrice des rôles. Les
rôles qui écrivent `planning` : D-023 (admin, director, operations_manager,
fleet_manager, manager, dispatcher).

## 13. Tables et relations

| Table | Colonnes clés | Contraintes | RLS |
|---|---|---|---|
| `work_shifts` | `name`, `display_name`, `start_time`, `end_time`, `shift_order`, `is_active` | `name` et `shift_order` uniques | Lecture tous ; écriture W trips directe |
| `postes` | `date_poste`, `shift_id`, `site_id`, `responsable_id`, `statut`, `consignes_recues`, `consignes_sortie`, `rapport`, `bilan` (jsonb), `ouvert_par/le`, `cloture_par/le`, `valide_par/le` | Unique (date, shift, site) ; `statut` IN (ouvert, cloture, valide) | Lecture bornée ; aucune écriture directe (REVOKE ALL, GRANT SELECT) |
| `postes_equipe` | `poste_id`, `driver_id`, `vehicle_id`, `present`, `retard_minutes`, `motif_absence`, `ajoute_par/le` | Chauffeur ou engin ; absence motivée ; retard >= 0 ; index `ux_postes_equipe_chauffeur_unique`, `ux_postes_equipe_engin_seul` | Suit `postes` |
| `postes_evenements` | `poste_id`, `survenu_le`, `categorie`, `description`, `vehicle_id`, `auteur` | Catégorie CHECK ; description non vide | Suit `postes` ; append-only |

Relations : `trips.shift_id`, `objectifs_production.shift_id` (RESTRICT),
`clotures_planification` (module 04), `rapports` de type shift
(`poste_id`, `20261118090000_reporting.sql:753`). À créer (cible) :
`equipes`, `equipes_membres`, `cycles_rotation`, `postes_journal`.

## 14. Fonctions serveur et API

| Fonction | Signature (version en vigueur) | Rôle |
|---|---|---|
| `ouvrir_poste` | `(p_date date, p_shift_id uuid, p_site_id uuid, p_responsable uuid, p_consignes text) -> uuid` | Ouverture et passation (`20261116090000`) |
| `affecter_au_poste` | `(p_poste_id uuid, p_driver_id uuid, p_vehicle_id uuid) -> uuid` | Équipe (`20261120104000`, remplace `20261120101000`) |
| `pointer_presence` | `(p_membre_id uuid, p_present boolean, p_retard_minutes integer, p_motif text)` | Présence (`20261116090000`) |
| `consigner_evenement_poste` | `(p_poste_id uuid, p_categorie text, p_description text, p_quand timestamptz, p_vehicle_id uuid) -> uuid` | Journal (`20261120101000`) |
| `cloturer_poste` | `(p_poste_id uuid, p_consignes_sortie text, p_rapport text) -> jsonb` | Clôture, bilan (`20261116090000`) |
| `valider_cloture_poste` | `(p_poste_id uuid)` | Validation (`20261116090000`) |
| `poste_ecrivable` | interne, EXECUTE retiré aux comptes | Droit, périmètre, état, verrou |
| `comparer_shifts` | `(p_debut date, p_fin date, p_site uuid)` | Comparaison (`20261121090000:1046`) |
| `rapport_shift` | `(p_poste uuid)` | Rapport (module 21, `20261120102000`) |
| `mes_validations`, `notifier_validation_poste` | - | Module 24 (`20261117180000`) |

Toutes en SECURITY DEFINER avec `search_path` vide (écritures), EXECUTE
retiré à PUBLIC et anon. Les noms de paramètres envoyés par l'écran
correspondent aux signatures en vigueur (vérifié, section « Défauts »).

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Clôture à valider | Comptes W planning sauf l'auteur | Mes validations | DÉPLOYÉ (`20261117180000:72-74`) |
| Clôture validée | Auteur de la clôture | Centre de notifications | DÉPLOYÉ (`notifier_validation_poste`) |
| Shift commencé sans poste ouvert | Chef d'exploitation du site | Notification | MANQUANT |
| Poste non clos après la fin du shift, clôture non validée sous N heures | Responsable, puis escalade | Notification, relance | MANQUANT |
| Événement « sécurité » consigné | Responsable HSE | Notification | MANQUANT |

## 16. Documents et modèles d'impression

Cible : rapport de poste A4 (en-tête site, shift, date ; responsable ;
équipe et présences ; événements ; objectif et réalisé ; voyages ;
consignes reçues et transmises ; signatures du responsable et du
valideur), fiche de passation. État : PARTIEL, impression de la page
entière par le navigateur (`PostesView.tsx:132`), pas de modèle dédié,
pas de pièce signée jointe (aucun stockage de fichiers).

## 17. Exports et rapports

| Export | État | Preuve |
|---|---|---|
| CSV de la comparaison entre shifts | DÉPLOYÉ | `ComparaisonShifts.tsx:55-60` |
| Rapport de shift (CSV, impression) | DÉPLOYÉ (module 21) | `rapport_shift`, `ReportsView` |
| Liste des postes d'une période (CSV, PDF) | MANQUANT | - |
| Présences et retards par chauffeur | MANQUANT | - |

## 18. Historique et audit

- Auteurs et heures d'ouverture, de clôture et de validation : en base,
  non affichés (PARTIEL).
- Journal des événements append-only : DÉPLOYÉ (pgTAP 31 ligne 48).
- Pointages de présence : `UPDATE` en place de `postes_equipe`
  (`pointer_presence`) sans auteur ni heure du pointage ; une correction
  avant clôture écrase la précédente sans trace : MANQUANT (cible :
  journal `postes_journal` des ajouts et pointages, ou colonnes
  `pointe_par`, `pointe_le` et historique).
- Bilan figé à la clôture : DÉPLOYÉ ; pas de comparaison de versions (une
  seule clôture possible).

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `31_postes` (14 assertions : ouverture, unicité, journal immuable, présence avant clôture, absence motivée, consignes, bilan, séparation clôture et validation, passation, droit) ; `53_correctifs_revue_exploitation` (périmètre de l'équipe et de l'engin, doublons, relève) ; `46_planification_avancee` (`comparer_shifts`, périmètre) ; `58_perimetre_site_lectures` ; `41_reporting` (`rapport_shift`) | Notifications et Mes validations pour les postes ; date d'ouverture dans le passé ; écriture directe de `work_shifts` par un compte sans droit |
| Unitaires | `postes.test.ts` (2 : `resumeBilan`) ; `planAvance.test.ts` (comparaison) | Libellés de statut, conversion du retard |
| E2E (API simulée) | `postes.spec.ts` (passation affichée, absence motivée, clôture, ouverture) ; `planification-avancee.spec.ts` (comparaison) | Ajout d'un chauffeur, validation, référentiel vide (aucun shift, aucun site), refus serveur affiché |
| E2E sur vraie base | Aucun | Parcours J1 complet (D-069, point 3) |

## 20. Critères de recette métier

Acteurs : chef de poste Kogon (deux postes consécutifs), chef
d'exploitation (valideur), dispatcher.

1. Les shifts réels de Nimba sont saisis (horaires communiqués par le
   propriétaire) ; le shift de nuit franchit minuit sans erreur.
2. Le chef de poste de jour ouvre le poste, compose l'équipe (chauffeurs,
   opérateurs, chargeuses, pelle), pointe un retard et une absence motivée.
3. Il consigne un arrêt de chargeuse et un incident ; il clôt avec des
   consignes ; le bilan reprend l'objectif du shift et les voyages livrés
   du dispatch, à l'identique du tableau de bord.
4. Le chef de poste de nuit ouvre son poste et lit les consignes reçues.
5. Une autre personne valide la clôture depuis Mes validations ; l'auteur
   ne peut pas valider la sienne.
6. Un compte affecté à un autre site ne voit ni ne modifie ces postes.
7. Le rapport de poste imprimé est signé et archivé ; la comparaison de la
   semaine est exportée.
PV de recette signé par le chef d'exploitation (aucun à ce jour).

## Défauts bloquants constatés

| # | Fichier:ligne | Cause |
|---|---|---|
| B1 | `src/components/Postes/PostesView.tsx:48`, `:109`, `:113` | Référentiel des shifts vide et impossible à remplir. Aucun écran ni fonction n'écrit `work_shifts` (seules lectures dans `src`, aucune entrée Paramètres, contrairement à la matrice qui indique « Paramètres ») ; les seuls shifts jamais chargés étaient ceux de la démonstration (`deploy/vps/demo/charger.sql:39-41`, identifiants `dec0de00-`), supprimés par la purge (D-076) ; la base de référence ne contient aucune donnée (D-017). Conséquence : la liste « Shift » de l'ouverture est vide, le bouton reste désactivé, aucun poste ne peut être ouvert. Même effet sur Planification, Dispatch, Fiches terrain et Voyages, qui lisent les shifts actifs. Seule voie actuelle : écriture directe par l'API d'un compte W trips, hors écran et sans journal. Vérification de l'état réel de la production (comptage de `work_shifts`, lecture seule) à faire par l'intégrateur. |

Vérifications faites sans défaut bloquant :
- Les six appels `rpc` de `PostesView.tsx` (lignes 78, 81, 86, 88, 91, 93)
  et celui de `ComparaisonShifts.tsx:43` utilisent les noms de paramètres
  des signatures en vigueur (section 14) ; aucun `insert`, `update` ou
  `upsert` direct dans ces écrans ; les tables du module refusent
  l'écriture directe (REVOKE ALL) et les fonctions sont exécutables par
  `authenticated`.
- Colonnes lues : `postes.*`, `postes_equipe` et `postes_evenements`
  (`20261116090000`), `work_shifts.display_name/is_active/shift_order`,
  `sites.name`, `drivers.name/status` existent (base de référence).
- Référentiel vide : shift, site et chauffeur vides désactivent le bouton
  (`PostesView.tsx:113`, `:144`) ; aucun identifiant `''` n'est envoyé.
  La catégorie d'événement retombe sur `information` (`:89`).

Défauts non bloquants (à corriger dans le lot proposé) :
- `PostesView.tsx:109-110` : aucun message n'explique qu'il faut créer un
  shift ou un site (le correctif des Fiches terrain, PR #94, n'a pas été
  appliqué ici).
- `PostesView.tsx:52` : les erreurs de lecture de `work_shifts`, `sites` et
  `drivers` sont ignorées ; `ComparaisonShifts.tsx:47-49` ignore l'erreur
  de lecture des postes (historique vide affiché comme « aucune donnée »).
- `PostesView.tsx:84` : un retard non numérique devient `NaN`, envoyé
  `null` sans message.
- `20261120104000_correctifs_contre_revue.sql:197` : le message invite à
  « retirer cette ligne », action qu'aucune fonction ne permet.
- `PostesView.tsx:43` : liste non bornée par le site actif du sélecteur de
  site global (la RLS borne néanmoins le périmètre).

## Écarts et lots proposés

| Ordre | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Référentiel des shifts : fonction `enregistrer_shift` (création, modification, désactivation journalisées, contrôle d'utilisation), écran Paramètres > Shifts, retrait de l'écriture directe sur `work_shifts`, message « aucun shift : en créer un » dans tous les écrans qui en lisent (corrige B1) | M | Horaires réels fournis par le propriétaire ; droit d'écriture à trancher |
| 2 | Écran du poste : choix du responsable, ajout d'engins et de relèves, heure et engin d'un événement, modal de pointage, messages d'erreur de lecture | S | Module 08 (engins), module 09 |
| 3 | Journal des pointages et des ajouts (auteur, heure, ancienne valeur), affichage des auteurs et heures du poste, HistoryDrawer | M | Composant HistoryDrawer (D-077) |
| 4 | Retrait motivé d'un membre, annulation motivée d'un poste ouvert, réouverture motivée d'une clôture non validée | M | Décision du propriétaire sur la réouverture ; revue indépendante (fonctions SECURITY DEFINER) |
| 5 | Objectif et réalisé en direct dans le poste ouvert, voyages du poste, avertissement d'habilitation et d'immobilisation à l'ajout | S | Modules 04, 06, 09, 11 |
| 6 | Liste des postes : filtres site, shift, statut, période, pagination, export CSV et PDF ; tableau de bord du module | M | Composants DataTable, ExportModal |
| 7 | Équipes permanentes et cycle de rotation, reprise de l'équipe en masse, pointage en masse | L | Cycle réel à fournir par le propriétaire |
| 8 | Relances et escalades (poste non ouvert, non clos, clôture non validée), notification des événements sécurité | M | Module 24 ; délais à fixer par le propriétaire |
| 9 | Modèle d'impression du rapport de poste, pièce signée jointe | M | Stockage des pièces jointes (J1) |
| 10 | Historique par chauffeur et par engin, présences et retards exportables | S | Module 09 |
| 11 | Tests : pgTAP des notifications de poste et de l'écriture des shifts, E2E référentiel vide et validation, parcours J1 sur vraie base | M | Lots 1 à 4 |

Points à trancher par le propriétaire :
1. Horaires réels des shifts de Nimba (la démonstration utilisait jour
   06:00-18:00 et nuit 18:00-06:00, valeurs non confirmées) ; shifts
   communs à tous les sites ou propres à chaque site.
2. Qui écrit le référentiel des shifts (administrateur seul ou droit
   `planning`).
3. Les opérateurs des chargeuses et de la pelle sont-ils du personnel
   Kogon (pointé au poste) ou Neemba (pointé sur la fiche FP seulement) ?
4. Ouverture d'un poste dans le passé : bornée (ex. veille) ou libre ;
   réouverture d'une clôture non validée : autorisée et par qui.
5. Délais de relance (poste non clos, clôture non validée) et
   destinataire de l'escalade.

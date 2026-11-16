# Module 04 : Production Planning

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`.
Constat établi le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : migrations jusqu'à `20261121120000`
appliquées (journal `docs/SIGTB_2.0_HEBERGEMENT_VPS.md`, PR #84 `bbf795a`
pour D-063, PR #87 `4eb12e6` pour D-075) ; démonstration purgée (D-076) :
aucune donnée réelle, donc aucun élément UTILISABLE ni VALIDÉ.

## 1. Objectifs et périmètre

Le module fixe ce que Kogon Mining doit charger et livrer, par journée, site
de chargement (Nimba) et shift, puis mesure l'écart avec le réalisé (tonnage
des voyages livrés, pris dans l'ordre accepté, reçu au dépôt CBG, chargé :
D-023). Il alimente le dispatch (nombre de voyages à préparer, D-024), les
postes (bilan cible / livré, D-048), le centre de pilotage (D-057), le
reporting (D-058) et le contrôle des engagements du contrat (D-031).

Décisions de référence : D-023 (planification v1, versions, droit
`planning`), D-063 (ventilation, simulation, clôture, rapport), D-075
(lecture bornée au site), D-047 (fermetures de site lues par la simulation),
D-033 (l'unité de facturation des engins n'intervient pas ici : l'objectif
est en tonnes, voyages en option).

Entrées : `sites`, `work_shifts`, `contrats` clients actifs, `vehicles`
(camions et engins du site), voyages livrés (`trips`, `trip_events`),
tickets CBG (tonnage reçu, D-037), fermetures (`fermetures_site`).
Sorties : `objectifs_production` (lu par dispatch, postes, pilotage,
reporting), `clotures_planification` (bilan figé), `rapport_production`.

Hors cible immédiate (extensions à déclencheur, CLAUDE.md bloc 1 section 9) :
prévision statistique de production, détection d'anomalies, recommandation
calculée d'objectif. La « projection au rythme constaté » et la simulation
déterministe de D-063 restent dans le périmètre (calcul expliqué, étiqueté,
sans estimation en l'absence de données).

## 2. Sous-modules

| Sous-module | Contenu cible |
|---|---|
| 04.1 Objectifs | Objectif journée ou shift par site, versions (plan initial, révisions motivées), annulation motivée |
| 04.2 Ventilation | Répartition d'un objectif par destination (dépôt CBG) et/ou contrat client |
| 04.3 Ressources | Camions, chargeuses et pelle prévus ; besoin estimé sur l'historique (14 jours) |
| 04.4 Suivi planifié / réalisé | Réalisé, % du plan, projection fin de shift, écarts, alertes de sous-production |
| 04.5 Simulation et rattrapage | Simulation de capacité, scénarios de rattrapage, retenue en révision |
| 04.6 Clôture | Clôture journée x site, causes d'écart, annulation motivée |
| 04.7 Rapports | Rapport de production par période, export, impression |
| 04.8 Paramétrage | Seuils d'échantillon, séparation des tâches à la clôture, catégories de causes, tolérance d'écart |

## 3. Menus et sous-menus

| Entrée | Fichier | Vue | Rôles qui la voient |
|---|---|---|---|
| Planification (`planification`) | `src/components/Layout/menu.ts:36` | `PlanificationView` (`src/App.tsx:247`) | Menu non filtré par rôle dans `menu.ts` ; contenu borné par `has_module_view('planning')` (RLS) et écriture par `hasPermission('planning', 'create'/'edit')` (`PlanificationView.tsx:47`) |

Onglets (`PlanificationView.tsx:23-24`) : Objectifs, Simulation, Clôture,
Shifts (comparaison, module 05).

Droit `planning` (migration `20261110150000_planification.sql:24-30`) :
lecture = lecture `trips` du rôle ; écriture = droit de suppression `trips`
(admin, director, operations_manager, fleet_manager, manager, dispatcher).
Point à trancher par le propriétaire : D-023 marque cette correspondance
« droits à confirmer ».

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Liste des objectifs du jour (cartes) avec réalisé, % du plan, projection, ressources | `v_realisation_objectifs`, `statistiques_rotation` | DÉPLOYÉ | `Planning/PlanificationView.tsx:81-120`, `CarteObjectif.tsx` ; E2E `planification.spec.ts:66` ; migration `20261110150000` |
| Fenêtre Définir / Réviser un objectif | `definir_objectif` | DÉPLOYÉ | `FenetresObjectif.tsx:47-200` ; E2E `planification.spec.ts:94` ; pgTAP 10 |
| Fenêtre Annuler un objectif (motif) | `annuler_objectif` | DÉPLOYÉ | `FenetresObjectif.tsx:206-247` ; pgTAP 10:94 |
| Fenêtre Historique des versions | `objectifs_production` | DÉPLOYÉ | `FenetresObjectif.tsx:264-300` |
| Fenêtre Ventiler un objectif | `ventiler_objectif` | DÉPLOYÉ | `VentilationObjectif.tsx` ; E2E `planification-avancee.spec.ts:77` ; pgTAP 46 |
| Onglet Simulation (hypothèses sourcées, scénarios, retenue en révision) | `simuler_objectif` | DÉPLOYÉ | `SimulationObjectifs.tsx` ; E2E `planification-avancee.spec.ts:95` ; pgTAP 46 |
| Onglet Clôture (bilan, causes, annulation) | `production_journee`, `cloturer_planification`, `annuler_cloture_planification` | DÉPLOYÉ | `ClotureProduction.tsx:66-130` ; E2E `planification-avancee.spec.ts:120` ; pgTAP 46 |
| Rapport de production (période, CSV, impression) | `rapport_production` | DÉPLOYÉ | `ClotureProduction.tsx:92-96, 220-226` |
| Onglet Shifts (comparaison, module 05) | `comparer_shifts` | DÉPLOYÉ | `ComparaisonShifts.tsx` ; E2E `planification-avancee.spec.ts:148` |
| Vue semaine / mois (calendrier des objectifs) | - | MANQUANT | Seule une date à la fois (`PlanificationView.tsx:48`) |
| Liste tabulaire des objectifs sur période (recherche, filtres, tri, pagination, export) | - | MANQUANT | - |
| Tableau de bord des écarts (sous-production cumulée, causes par catégorie) | - | MANQUANT | - |
| Import en masse du plan (CSV mensuel) | - | MANQUANT | - |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Réalisé / objectif (t, %) par carte | `v_realisation_objectifs` | Date, shift | DÉPLOYÉ (`CarteObjectif.tsx`) ; heure de fraîcheur affichée, rafraîchi à la minute (`PlanificationView.tsx:105-109`) |
| Projection fin de shift au rythme constaté (étiquetée) | Calcul client `plan.ts` | Shift en cours | DÉPLOYÉ (`plan.ts`, `plan.test.ts`) |
| Camions nécessaires (charge moyenne, rotations par camion, échantillon) | `statistiques_rotation` (14 jours) | 14 jours précédents | DÉPLOYÉ ; « données insuffisantes » sinon (E2E `planification.spec.ts:85`) |
| Réalisé par destination | `v_realisation_ventilation` | Date | DÉPLOYÉ ; réalisé par contrat seul annoncé non mesurable (E2E `planification-avancee.spec.ts:58`) |
| Objectif du jour sur le tableau de bord général | Dashboard | Jour | DÉPLOYÉ (E2E `planification.spec.ts:113`) |
| Alerte de sous-production (seuil, notification) | - | - | MANQUANT |
| Tendance planifié / réalisé sur 30 jours, causes d'écart par catégorie | `rapport_production`, `clotures_planification_causes` | Période | MANQUANT (données présentes, aucun graphique) |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Objectif de production | DÉPLOYÉ (`definir_objectif`) | DÉPLOYÉ | DÉPLOYÉ par révision (nouvelle version, motif) | MANQUANT (copier le plan d'une journée sur une autre) | Sans objet (versions) | Interdit (garde `objectifs_production_garde`) : conforme | DÉPLOYÉ (`annuler_objectif`, motif) |
| Ventilation | DÉPLOYÉ (`ventiler_objectif`, une fois) | DÉPLOYÉ | Par révision de l'objectif (immuable, garde `garde_immuable`) | MANQUANT | Sans objet | Interdit : conforme | Par révision de l'objectif |
| Clôture de journée | DÉPLOYÉ (`cloturer_planification`) | DÉPLOYÉ | Interdit (garde `garde_cloture`) | Sans objet | Sans objet | Interdit : conforme | DÉPLOYÉ (`annuler_cloture_planification`, motif) |
| Cause d'écart | DÉPLOYÉ (à la clôture) | DÉPLOYÉ | Interdit (immuable) | Sans objet | Sans objet | Interdit | Par annulation de la clôture puis nouvelle clôture |
| Brouillon de plan (semaine) | MANQUANT | MANQUANT | MANQUANT | MANQUANT | - | MANQUANT | - |

## 7. Modals et drawers

| Type | Élément | État | Preuve |
|---|---|---|---|
| Création / édition | Définir ou réviser (une révision part des valeurs en vigueur) | DÉPLOYÉ | `FenetresObjectif.tsx:86-101` |
| Confirmation | Annulation d'objectif, annulation de clôture, avec motif obligatoire | DÉPLOYÉ | `FenetresObjectif.tsx:231`, `ClotureProduction.tsx:117` |
| Action | Ventiler ; retenir un scénario de simulation (ouvre la révision pré-remplie) | DÉPLOYÉ | `VentilationObjectif.tsx`, `FenetresObjectif.tsx:63` (`propose`) |
| Historique | Versions d'un objectif | DÉPLOYÉ | `FenetresObjectif.tsx:264` |
| Détail (drawer) | Voyages livrés composant le réalisé d'un objectif | MANQUANT | - |
| Pièces jointes | Plan signé, PV de réunion de production | MANQUANT | Pas de stockage de fichiers (matrice, constat 4) |
| Import | Plan mensuel CSV | MANQUANT | - |
| Export | CSV et impression du rapport ; pas d'export des objectifs | PARTIEL | `ClotureProduction.tsx:220-226` |

## 8. Champs des formulaires

**Définir / réviser** (`FenetresObjectif.tsx:140-195` ; serveur
`definir_objectif`, `20261110150000_planification.sql:103-166`).

| Champ | Type | Obligatoire | Règle client | Règle serveur |
|---|---|---|---|---|
| Date | date | Oui | `required` | `p_date` non nul ; journée non close (`garde_journee_close`) |
| Site de chargement | liste | Oui | `required`, option vide non soumise | `p_site_id` non nul, FK `sites` |
| Portée | liste (journée ou shift) | Non | vide = journée (`null`) | unicité d'un actif par date x site x shift |
| Objectif (t) | décimal | Oui | > 0 | > 0, numeric(12,2) |
| Voyages visés | entier | Non | - | > 0 |
| Camions prévus, chargeuses et pelles prévues | entier | Non | - | >= 0 |
| Motif | texte | Oui en révision | `required` si révision | obligatoire dès la version 2 |
| Note | texte | Non | - | - |

**Ventilation** (`VentilationObjectif.tsx`, `planAvance.ts:109-137` ;
serveur `ventiler_objectif`, `20261121090000:160-252`) : lignes
destination (sauf site de chargement) et/ou contrat client actif, tonnes > 0,
voyages ; une seule forme de ligne par objectif, pas de doublon, somme au
plus égale à l'objectif.

**Clôture** (`ClotureProduction.tsx`, `planAvance.ts:161-176` ; serveur
`cloturer_planification`) : causes (catégorie parmi 11, description
obligatoire, tonnes perdues >= 0), commentaire ; au moins une cause si
réalisé sous l'objectif, objectif annulé ou version remplacée au-dessus du
réalisé ; journée terminée ; séparation si `planification_cloture_separee`.

**Simulation** (`SimulationObjectifs.tsx:56-70`) : objectif, instant
(maintenant, début, heure choisie).

Champs conditionnels cibles manquants : cause d'écart rattachée à un
objectif de shift (le serveur accepte `objectif_id`, l'écran ne l'envoie
pas : `planAvance.ts:174-176`) ; validation en temps réel des tonnes
ventilées restantes (PARTIEL : contrôle au clic).

## 9. Actions individuelles et en masse

| Action | État | Preuve |
|---|---|---|
| Définir, réviser, annuler, consulter l'historique | DÉPLOYÉ | section 4 |
| Ventiler | DÉPLOYÉ | `VentilationObjectif.tsx:110` |
| Simuler, retenir un scénario | DÉPLOYÉ | `SimulationObjectifs.tsx:39` |
| Clôturer, annuler la clôture | DÉPLOYÉ | `ClotureProduction.tsx:104, 118` |
| Exporter, imprimer le rapport | DÉPLOYÉ | `ClotureProduction.tsx:220-226` |
| Dupliquer le plan d'une journée ou d'une semaine | MANQUANT | - |
| Définir en masse (plan de la semaine pour tous les shifts) | MANQUANT | - |
| Clôturer plusieurs journées | MANQUANT | - |
| Commenter un objectif | MANQUANT | - |

## 10. Statuts et transitions

Objectif (`objectifs_production.statut`) :
- (aucun) -> actif (définir, W planning, tonnes > 0, journée non close)
- actif -> remplacé (réviser : nouvelle version actif, motif, W planning, journée non close)
- actif -> annulé (annuler, motif, W planning, journée non close)
- remplacé, annulé : terminaux (garde `objectifs_production_garde`)

Clôture (`clotures_planification.statut`) :
- (aucune) -> close (clôturer, W planning, `site_permis`, journée terminée, causes si écart, séparation selon réglage)
- close -> annulée (annuler, motif, W planning, `site_permis`) ; une nouvelle clôture est alors possible
- close fige objectifs et ventilations de la journée et du site

Cible à trancher : statut « brouillon » d'un plan hebdomadaire avant
publication (MANQUANT, proposé en écart).

## 11. Workflows

| Étape | Acteur | État |
|---|---|---|
| Plan initial (version 1) par le responsable d'exploitation | W planning | DÉPLOYÉ |
| Révision motivée en cours de journée (panne, fermeture de dépôt) | W planning | DÉPLOYÉ |
| Rattrapage : simulation puis révision explicite (le système propose, l'humain décide) | W planning | DÉPLOYÉ |
| Clôture de la journée avec causes d'écart | W planning ; autre personne que les auteurs si réglage actif | DÉPLOYÉ (réglage absent = non exigée, à confirmer par le propriétaire, D-063) |
| Approbation du plan hebdomadaire par la direction avant publication au dispatch | Director | MANQUANT (à trancher) |
| Relance si journée terminée non close après N heures ; escalade au DG | - | MANQUANT (dépend module 24) |
| Délégation de la clôture | - | MANQUANT |

## 12. Rôles et permissions

| Action | Module / niveau | Périmètre site | État |
|---|---|---|---|
| Lire objectifs, ventilations, clôtures | `planning` lecture | `site_permis` (D-075, `20261121095000:82-84`) | DÉPLOYÉ (pgTAP 58) |
| Définir, réviser | `planning` écriture | **Non borné** : `definir_objectif` ne contrôle pas `site_permis` | PARTIEL (voir écart E1) |
| Annuler un objectif | `planning` écriture | **Non borné** : `annuler_objectif` ne contrôle pas `site_permis` | PARTIEL (écart E1) |
| Ventiler | `planning` écriture | `site_permis` de l'objectif | DÉPLOYÉ |
| Simuler | `planning` lecture | objectif invisible hors périmètre | DÉPLOYÉ |
| Clôturer, annuler la clôture | `planning` écriture | `site_permis` | DÉPLOYÉ |
| Approuver un plan | `planning` approbation | - | MANQUANT |

## 13. Tables et relations

| Table / vue | Colonnes clés et contraintes | RLS | Migration |
|---|---|---|---|
| `objectifs_production` | date_plan, site_id (FK sites), shift_id (FK work_shifts, NULL = journée), version, tonnes_cible > 0, voyages_cible, camions_prevus, chargeuses_prevues, statut, motif (requis si version > 1), motif_annulation ; un seul actif par clé | Lecture `planning` + `site_permis` ; aucune écriture directe | `20261110150000`, `20261121095000` |
| `objectifs_ventilation` | objectif_id, destination_id, contrat_id (au moins un), tonnes_cible, voyages_cible ; unique par dimension ; immuable | Lecture bornée | `20261121090000:113-158` |
| `clotures_planification` | date_plan, site_id, statut (close, annulee), tonnes_cible, tonnes_livrees, ecart, bilan jsonb ; une seule close par date x site | Lecture bornée | `20261121090000:645-722` |
| `clotures_planification_causes` | cloture_id, objectif_id, categorie (11 valeurs CHECK), description, tonnes_impact | Lecture bornée ; immuable | `20261121090000:666-725` |
| `v_realisation_objectifs` | objectif actif + réalisé (voyages livrés, tonnage accepté / reçu / chargé) | Droits de l'appelant | `20261110150000:200` |
| `v_realisation_ventilation` | réalisé par destination | Droits de l'appelant | `20261121090000:260` |

## 14. Fonctions serveur et API

| Fonction | Signature (la plus récente) | Mode | Appelée par | État |
|---|---|---|---|---|
| `definir_objectif` | (date, uuid, uuid, numeric, int, int, int, text, text) | DEFINER, `search_path` vide | `FenetresObjectif.tsx:115` (paramètres conformes) | DÉPLOYÉ |
| `annuler_objectif` | (uuid, text) | DEFINER | `FenetresObjectif.tsx:223` (conformes) | DÉPLOYÉ |
| `statistiques_rotation` | (p_site_id, p_shift_id, p_jusqua, p_jours = 14) | lecture | `PlanificationView.tsx:117` (conformes) | DÉPLOYÉ |
| `ventiler_objectif` | (p_objectif_id, p_lignes jsonb : destination_id, contrat_id, tonnes, voyages, note) | DEFINER | `VentilationObjectif.tsx:110` (clés conformes, `planAvance.ts:132-137`) | DÉPLOYÉ |
| `durees_cycle_observees` | (uuid, uuid, date, int) | INVOKER | `simuler_objectif` | DÉPLOYÉ |
| `simuler_objectif` | (p_objectif_id, p_instant timestamptz) | INVOKER, rien n'est écrit | `SimulationObjectifs.tsx:39` (conformes) | DÉPLOYÉ |
| `production_journee` | (p_date, p_site_id) | INVOKER | `ClotureProduction.tsx:71` (conformes) | DÉPLOYÉ |
| `cloturer_planification` | (p_date, p_site_id, p_causes jsonb : categorie, description, tonnes, objectif_id, p_commentaire) | DEFINER, verrou consultatif | `ClotureProduction.tsx:104` (clés conformes, `planAvance.ts:174`) | DÉPLOYÉ |
| `annuler_cloture_planification` | (p_id, p_motif) | DEFINER | `ClotureProduction.tsx:118` (conformes) | DÉPLOYÉ |
| `rapport_production` | (p_debut, p_fin, p_site = NULL) | INVOKER | `ClotureProduction.tsx:93` | DÉPLOYÉ |
| API d'export vers module 21 (plan mensuel), import de plan | - | - | - | MANQUANT |

## 15. Notifications

| Événement | Destinataires cibles | Canal | État |
|---|---|---|---|
| Objectif révisé ou annulé en cours de shift | Dispatcher, chef de poste du site | Centre de notifications (D-056) | MANQUANT |
| Sous-production : projection fin de shift sous X % de l'objectif | Responsable d'exploitation, DG | Notification + Command Center | MANQUANT (seuil à fixer par le propriétaire) |
| Journée terminée non close après N heures | Responsable planification | Mes validations | MANQUANT |
| Journée close sous l'objectif | DG | Notification | MANQUANT |

## 16. Documents et modèles d'impression

| Document | État | Preuve |
|---|---|---|
| Rapport de production (impression navigateur) | DÉPLOYÉ | `ClotureProduction.tsx:226` (`printDocument`) |
| Plan de production du jour imprimable (affichage au poste) | MANQUANT | - |
| PV de clôture journalière (bilan figé, causes, signataire) | MANQUANT | - |

## 17. Exports et rapports

| Export | Format | État |
|---|---|---|
| Rapport de production par période | CSV, impression | DÉPLOYÉ (`ClotureProduction.tsx:220`) |
| Comparaison entre shifts | CSV | DÉPLOYÉ (`ComparaisonShifts.tsx:55`, module 05) |
| Liste des objectifs et versions sur période | CSV, Excel | MANQUANT |
| Rapport mensuel de production pour CBG / direction (planifié, réalisé, causes) | PDF | MANQUANT (en partie dans module 21, D-058) |

## 18. Historique et audit

| Élément | État | Preuve |
|---|---|---|
| Versions d'objectif (auteur, heure, motif ; remplacé / annulé, par qui, quand) | DÉPLOYÉ | colonnes `cree_par`, `clos_par`, `clos_le`, `motif_annulation` ; `HistoriqueObjectif` |
| Clôture figée et annulation tracée | DÉPLOYÉ | `clotures_planification.annule_par`, `motif_annulation` |
| Comparaison visuelle de deux versions | PARTIEL | Liste des versions, sans diff |
| Journal transverse des actions du module (module 24) | MANQUANT | - |

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `10_planification.test.sql` (18 assertions : droits, versions, motifs, garde) ; `46_planification_avancee.test.sql` (75 : ventilation, simulation, clôture, séparation, journée close) ; `58_perimetre_site_lectures.test.sql` (lecture bornée des objectifs) | Refus de `definir_objectif` et `annuler_objectif` hors périmètre (écart E1) |
| Unitaires | `Planning/plan.test.ts`, `Planning/planAvance.test.ts` (15 cas) | Validation de la ventilation restante en temps réel |
| E2E (API simulée) | `planification.spec.ts` (5), `planification-avancee.spec.ts` (5) | Référentiel vide (aucun site, aucun shift) ; parcours J1 contre une vraie base (bloc 1, section 7) |

## 20. Critères de recette métier

1. Le responsable d'exploitation saisit le plan d'une journée réelle de Nimba
   (journée et deux shifts), avec camions et engins prévus ; le dispatcher
   voit le nombre de voyages proposé (D-024).
2. Une panne de chargeuse déclarée en cours de shift : le responsable lance
   la simulation, retient un scénario, la révision apparaît en version 2 avec
   son motif ; la version 1 reste consultable.
3. Le réalisé affiché égale la somme des tonnages acceptés (ou reçus CBG,
   ou chargés) des voyages livrés, vérifiée ligne à ligne avec les tickets
   CBG du jour.
4. À la fin de journée, la clôture sous l'objectif exige une cause ; le bilan
   figé est identique au rapport de production imprimé.
5. Un compte borné au site de Nimba ne voit ni ne peut créer d'objectif sur
   un autre site.
PV : à signer par le responsable d'exploitation et le DG (aucun à ce jour).

## Défauts bloquants constatés

Aucun constaté. Vérifié :
- tous les `rpc` des écrans du module (`definir_objectif`, `annuler_objectif`,
  `statistiques_rotation`, `ventiler_objectif`, `simuler_objectif`,
  `production_journee`, `cloturer_planification`,
  `annuler_cloture_planification`, `rapport_production`) : noms de
  paramètres et clés jsonb conformes à la dernière définition
  (`20261110150000`, `20261121090000`, aucune redéfinition ultérieure) ;
- colonnes lues (`objectifs_production`, `clotures_planification`,
  `clotures_planification_causes`, `work_shifts`, `vehicles`, `contrats`)
  présentes ;
- référentiel vide : le site est un `<select required>` à option vide
  (`FenetresObjectif.tsx:147`), donc jamais `''` envoyé ; shift vide converti
  en `null` (`FenetresObjectif.tsx:118`) ; destination et contrat vides
  convertis en `null` (`planAvance.ts:134-135`) ; la clôture ne charge ni
  n'envoie rien sans site (`ClotureProduction.tsx:66`, 143) ; aucune écriture
  directe en table.

Défauts non bloquants relevés :
- `PlanificationView.tsx:64-71` : les erreurs de lecture de `work_shifts` et
  `vehicles` sont ignorées (liste vide affichée comme absence de shift ou
  d'engin) ;
- référentiel des sites vide : la fenêtre Définir n'affiche aucun message
  guidant vers la création d'un site (seule la validation native du
  navigateur bloque) ;
- la liste des sites proposée comme « site de chargement » contient tous les
  sites actifs, dépôts de destination compris (`SiteContext`, pas de filtre
  sur `type`).

## Écarts et lots proposés

| N° | Écart | Taille | Dépendances |
|---|---|---|---|
| E1 | Borner `definir_objectif` et `annuler_objectif` par `site_permis` (nouvelle migration, pgTAP de refus hors périmètre) : aujourd'hui un compte borné peut créer ou annuler l'objectif d'un autre site par l'API (`20261110150000:125-131, 177-180`) ; revue indépendante obligatoire | S | D-075 |
| E2 | Message « aucun site » dans la fenêtre Définir, filtre des sites de type chargement, affichage des erreurs de lecture shifts et engins | S | Module 03 (type de site) |
| E3 | Liste des objectifs sur période (DataTable : recherche, filtres site / shift / statut, tri, pagination, export CSV) et vue semaine | M | Composant DataTable commun (D-077) |
| E4 | Alertes de sous-production (seuil paramétrable, projection fin de shift) vers le centre de notifications et le Command Center | M | Module 24 (D-056), seuil à fixer par le propriétaire |
| E5 | Duplication d'un plan (journée ou semaine) et définition en masse, en passant par `definir_objectif` | M | - |
| E6 | Plan hebdomadaire en brouillon puis approbation par la direction avant publication | M | Décision du propriétaire (circuit souhaité ou non) |
| E7 | Drawer « composition du réalisé » : voyages livrés et tickets CBG d'un objectif | S | Modules 07 et 14 |
| E8 | Cause d'écart rattachable à un objectif de shift depuis l'écran (le serveur l'accepte) | S | - |
| E9 | PV de clôture journalière imprimable et plan du jour imprimable | S | - |
| E10 | Relance des journées non closes, journal transverse | M | Module 24 |
| E11 | Paramétrage : seuils d'échantillon (3 jours, 10 voyages, 10 mesures) et tolérance d'écart à la clôture en réglages ; confirmation de `planification_cloture_separee` absent = non exigée | S | Décisions du propriétaire (D-063) |
| E12 | Pièces jointes (plan signé, PV) | S | Socle pièces jointes J1 (D-069 point 2) |
| E13 | Import CSV d'un plan mensuel (ImportWizard) | M | Composant ImportWizard |
| E14 | E2E référentiel vide et parcours J1 rejoué contre une vraie base | M | Conteneur de rejeu (D-069 point 3) |

Points à trancher par le propriétaire : correspondance des droits `planning`
(D-023), séparation à la clôture par défaut, seuil d'alerte de
sous-production, existence d'une approbation du plan, base du réalisé
(accepté puis reçu puis chargé) pour le suivi contractuel CBG.

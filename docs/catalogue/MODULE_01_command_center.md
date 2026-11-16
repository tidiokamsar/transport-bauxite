# Module 01 : Command Center

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : dernière release journalisée 3bbfded
(`docs/SIGTB_2.0_HEBERGEMENT_VPS.md`, section 9), démonstration purgée
(D-076), aucune donnée réelle saisie à ce jour.

## 1. Objectifs et périmètre

Le Command Center est la tête de pilotage de SIGTB : il ne saisit rien, il
lit les données des autres modules pour que le DG, l'exploitation, la
finance et les responsables de domaine voient l'état des opérations de
transport de bauxite (Kogon Mining, site de Nimba, client CBG, loueur
Neemba) sur une période et un périmètre de site, et décident. Il relève du
jalon J3 (pilotage) : « le DG et l'exploitation pilotent une semaine sans
tableur parallèle ».

Décisions de référence : D-019 (maquette du tableau de bord), D-023
(objectifs), D-026 et D-031 (tableau de bord du chargé de contrats), D-038,
D-046, D-075 (périmètre site des lectures), D-056 (mes validations,
notifications), D-057 (indicateurs de pilotage : source, période,
fiabilité, heure), D-058 (rapports et coût direct par tonne), D-072 R3-6
(domaine illisible = « sans données », jamais 0), D-077 (standard 12 blocs).
Règle 5 de `CLAUDE.md` : chaque KPI expose période, source, fiabilité et
heure ; une position ancienne n'est jamais affichée comme en direct.

Entrées : voyages et cycle (07), objectifs et clôtures (04, 05),
immobilisations et interventions Neemba (10, 11), registre carburant (13),
tickets et relevés CBG (14), achats et paiements (16, 20), HSE (22),
positions GPS (03). Sorties : orientation vers les écrans de décision
(24), rapports (21), exports.

Hors périmètre tant que leur déclencheur n'est pas levé (bloc 1, section
9) : prévisions de production et financières calculées, détection
d'anomalies statistique (module 26).

## 2. Sous-modules

| Sous-module | Contenu cible |
|---|---|
| 01.1 Tableau de bord exploitation | Vue du jour : tonnes livrées, voyages, flotte, carburant, objectif et réalisé par site et shift, carte des positions fraîches, derniers voyages, alertes |
| 01.2 Centre de pilotage | Indicateurs de référence par domaine (production, tickets CBG, flotte, carburant, maintenance, HSE, achats et finance) sur une période et un site |
| 01.3 Tableaux de bord par profil | Direction générale, Exploitation, Finance, Flotte, Contrats, Carburant, Maintenance, Performance : un jeu de widgets par profil |
| 01.4 Alertes prioritaires et centre des décisions | Alertes produites par les règles serveur, classées par gravité ; décisions en attente du DG (lien module 24) |
| 01.5 Analyse et comparaison | Comparaison de périodes (mois courant, mois précédent, même mois N-1), ventilation par site, shift, engin, partenaire |
| 01.6 Configuration et diffusion | Choix et ordre des widgets par profil, export et impression des tableaux de bord |
| 01.7 Prévisions (déclencheur) | Prévisions de production et financières : non commencées avant la durée de données réelles fixée par le propriétaire (fiche, point 14) |

## 3. Menus et sous-menus

| Entrée (`src/components/Layout/menu.ts`) | Écran (`src/App.tsx`) | Droit requis (`canAccessModule`, `src/contexts/AuthContext.tsx:156`) |
|---|---|---|
| `dashboard` « Tableau de bord » | `Dashboard/DashboardView` | toujours visible (`Sidebar.tsx:49`), données filtrées par la RLS |
| `centre-pilotage` « Centre de pilotage » | `Pilotage/CentrePilotageView` | module `dashboard`, lecture |
| `mon-poste` « Mon tableau de bord » (sous Contrats & Finance) | `Contrats/MonPosteView` | module `contracts`, lecture |
| `mes-validations` « Mes validations » | `Notifications/MesValidationsView` (module 24) | module `dashboard`, lecture |
| `alerts` « Alertes » (sous Exploitation) | `Alerts/AlertsView` | module `reports`, lecture (mais la RLS de `alerts` exige `dashboard`, voir section 12) |
| aucune entrée | `quick-actions` -> `QuickActions/QuickActionsPanel` (route orpheline, `App.tsx:243`) | module `dashboard` |

Rôles : l'enum `user_role` (admin, director, operations_manager,
fleet_manager, maintenance_chief, logistician, accountant, driver,
contract_manager) et la matrice `role_permissions` (D-010, D-012), surchargée
par `droits_utilisateur` (D-036). Cible : un menu « Command Center » unique
regroupant 01.1 à 01.6, l'entrée par défaut dépendant du profil.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Tableau de bord exploitation | Vue du jour, site choisi | DÉPLOYÉ | `src/components/Dashboard/DashboardView.tsx` (lectures `vehicles`, `trips`, `v_realisation_objectifs`, `fuel_transactions`, `alerts`, `vehicle_tracking`, `work_shifts`), `Dashboard/indicateurs.ts`, `Graphiques.tsx`, `CarteFlotte.tsx` ; e2e `e2e/tableau-de-bord.spec.ts` (3) ; unitaires `Dashboard/indicateurs.test.ts` (7) ; en production depuis 2026-11-09 (D-019). Écarts : carburant lu dans `fuel_transactions` (pleins hérités) et non dans `mouvements_carburant` (D-041) ; panneau alertes alimenté par une table sans producteur ; pas d'export |
| Centre de pilotage | Indicateurs par domaine | DÉPLOYÉ | `src/components/Pilotage/CentrePilotageView.tsx` ; `indicateurs_pilotage(date, date, uuid)` (dernière définition `supabase/migrations/20261120102000_correctifs_revue_r3.sql:389`) ; pgTAP `40_indicateurs_pilotage.test.sql` (6), `54_correctifs_revue_finance_reporting.test.sql` (28) ; e2e `centre-pilotage.spec.ts` ; release 9cf47cf (PR #70) |
| Tableau de bord du chargé de contrats | Clôture mensuelle : réconciliations, factures, rapports de performance, fiches | DÉPLOYÉ | `src/components/Contrats/MonPosteView.tsx` ; `indicateurs_charge_contrats()` (dernière définition `20261121120000_contrats_finance.sql:1849`) ; pgTAP `18_suivi_recouvrement.test.sql` |
| Tableaux de bord DG, Finance, Flotte, Carburant, Maintenance, Performance dédiés | Widgets par profil | PARTIEL | Les indicateurs existent par domaine dans le centre de pilotage, mais il n'y a ni écran par profil ni graphique d'évolution ; Finance limité à 3 indicateurs (bons à approuver, paiements à contrôler, reste à payer par devise) : ni chiffre d'affaires facturé à CBG, ni encaissements, ni créances |
| Alertes | Liste, accusé de réception, résolution | MAQUETTE | `src/components/Alerts/AlertsView.tsx` : filtre et mises à jour sur des colonnes absentes de `alerts` (voir « Défauts bloquants ») ; aucune fonction serveur ni déclencheur n'écrit dans `alerts` (recherche `INSERT INTO public.alerts` : aucun résultat dans `supabase/migrations`) |
| Centre des décisions | Décisions en attente du DG | PARTIEL | Couvert par `mes_validations()` (factures à signer pour `director`, budgets dépassés, clauses à décider, D-056, D-065) ; pas de vue de synthèse DG avec enjeux chiffrés |
| Comparaison de périodes | Période courante contre période de référence | MANQUANT | `indicateurs_pilotage` ne prend qu'une période |
| Configuration des widgets | Choix, ordre, profil | MANQUANT | - |
| Actions rapides | Raccourcis | PARTIEL | `src/components/QuickActions/QuickActionsPanel.tsx` : raccourcis de navigation réels (D-004), mais route sans entrée de menu ni lien (seul `App.tsx:243` la connaît) ; journal `quick_actions_log` inséré sans contrôle d'erreur (`QuickActionsPanel.tsx:43`) |

## 5. Widgets et tableaux de bord

| Widget | Source | Période | État |
|---|---|---|---|
| Tonnes livrées (jour), voyages réalisés | `trips` terminés (`status = completed`, heure d'arrivée), poids net sinon poids chargé ; voyages sans poids comptés à part | depuis 0 h | DÉPLOYÉ (`DashboardView.tsx:145-163`, `Provenance` ligne 340) |
| Véhicules actifs, état de la flotte | `vehicles.status`, voyages `in_progress` | instant | DÉPLOYÉ |
| Consommation carburant du jour | `fuel_transactions` (`refuel`, date du jour) | jour | PARTIEL : registre de référence = `mouvements_carburant` (D-041) |
| Production et réalisation | `v_realisation_objectifs` (D-023) | jour, par shift | DÉPLOYÉ |
| Carte des positions | `vehicle_tracking`, positions de moins de 15 min seulement (`FRAICHEUR_POSITION_MINUTES`) | 24 h | DÉPLOYÉ (aucune position tant qu'aucun traceur n'émet) |
| Alertes et événements | `alerts` actives | - | MAQUETTE (aucun producteur) |
| Production : voyages livrés, tonnes livrées et acceptées, objectif, réalisation | `trips`, `objectifs_production` | période choisie (1 an max.) | DÉPLOYÉ (D-057) |
| Tickets CBG : livrés sans ticket | `trips`, tickets rattachés | période | DÉPLOYÉ |
| Flotte : engins en service, immobilisations en cours, heures d'immobilisation | `vehicles`, `immobilisations` (non annulées) | période | DÉPLOYÉ |
| Carburant : litres distribués validés, litres par tonne | `mouvements_carburant` validés sans annulation | période | DÉPLOYÉ |
| Maintenance : interventions Neemba en retard | `v_interventions_loueur` | instant | DÉPLOYÉ |
| HSE : incidents, contrôles non conformes, actions en retard | `incidents`, `controles_depart`, `v_actions_correctives_en_retard` | période | DÉPLOYÉ |
| Achats et finance : bons à approuver, paiements à contrôler, reste à payer par devise | `purchase_orders`, `v_paiements_a_controler`, `v_reste_a_payer` | instant | DÉPLOYÉ |
| Finance DG : facturé CBG, encaissé, créances échues, coût direct par tonne, marge | `factures`, encaissements, `costs`, `rapport_client` | mois | MANQUANT (rentabilité non calculée, D-058 : devises différentes, factures non ventilées par site) |
| Disponibilité contractuelle des engins Neemba | `realise_engagements` (D-031) | mois | PARTIEL (dans `EngagementsView`, module 19) |
| Graphiques d'évolution (tonnes par jour, L/t par semaine) | `rapport_mensuel_par_jour` | mois | MANQUANT (le centre de pilotage n'a que des tuiles) |

## 6. Opérations CRUD

Le module ne possède pas d'objet métier : il lit. Les seuls objets propres
sont la configuration et les alertes.

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver | Supprimer | Annuler/corriger |
|---|---|---|---|---|---|---|---|
| Indicateur de pilotage (calculé) | - | DÉPLOYÉ | - | - | - | - | - |
| Alerte | MANQUANT (aucun producteur serveur) | MAQUETTE | MAQUETTE (accusé, résolution cassés) | - | PARTIEL (« Marquer résolue » `AlertsView.tsx:138`, écriture directe sans auteur ni motif) | interdit (D-042) | MANQUANT |
| Configuration de tableau de bord (profil, widgets, ordre) | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT | paramètre inutilisé seulement | - |
| Vue enregistrée (période, site, domaine) | MANQUANT | MANQUANT | MANQUANT | MANQUANT | - | MANQUANT | - |

## 7. Modals et drawers

| Modal / drawer | Usage | État |
|---|---|---|
| Détail d'indicateur (DetailDrawer) | Valeur, règle de calcul, source, enregistrements sans mesure, lien vers la liste source | MANQUANT (la source est affichée en texte sous la tuile) |
| Accusé de réception d'alerte (ActionDialog) | Commentaire, auteur, heure | MANQUANT (bouton direct cassé) |
| Résolution d'alerte (ActionDialog) | Motif obligatoire | MANQUANT (`confirm()` navigateur, `AlertsView.tsx:133`) |
| Configuration des widgets | Cocher, ordonner, enregistrer pour soi ou pour un profil (administrateur) | MANQUANT |
| Export (ExportModal) | CSV, impression, choix des domaines | PARTIEL (bouton CSV direct, `CentrePilotageView.tsx:46`) |

## 8. Champs des formulaires

| Formulaire | Champ | Type | Obligatoire | Règle |
|---|---|---|---|---|
| Filtres du centre de pilotage | Début, fin | date | oui | serveur : période d'au plus un an, fin >= début (D-057) |
| | Site | liste des sites lisibles | non | serveur : RLS et `site_permis` ; vide = tous les sites du périmètre |
| Filtre du tableau de bord | Site | contexte global `SiteContext` | non | - |
| Cible : configuration | Profil, widgets (liste fermée des codes de `indicateurs_pilotage`), ordre, période par défaut (jour, semaine, mois) | listes | oui | serveur : codes connus seulement ; un profil ne voit que les widgets de domaines qu'il peut lire |
| Cible : comparaison | Période de référence (précédente, même période N-1, libre) | liste, dates | non | même durée que la période courante |
| Cible : résolution d'alerte | Motif | texte | oui | 5 caractères min. |

## 9. Actions individuelles et en masse

| Action | État | Preuve |
|---|---|---|
| Actualiser, changer de période et de site | DÉPLOYÉ | `CentrePilotageView.tsx` |
| Exporter les indicateurs en CSV (avec source, fiabilité, période, heure) | DÉPLOYÉ | `CentrePilotageView.tsx:46` |
| Imprimer un tableau de bord | MANQUANT | `exportToPDF` (`src/lib/exports.ts`) non branché ici |
| Ouvrir l'écran source d'un indicateur | MANQUANT | - |
| Accuser réception, résoudre une alerte | MAQUETTE | `AlertsView.tsx:98-145` |
| Résoudre des alertes en masse | MANQUANT | - |
| Ouvrir une décision en attente | DÉPLOYÉ (module 24) | `MesValidationsView.tsx` |

## 10. Statuts et transitions

Alerte (cible, colonne `alerts.status` existante : `active`, `acknowledged`,
`resolved`, contrainte `alerts_status_check`) :

```
(règle serveur) -> active                 (création par fonction serveur, jamais par le navigateur)
active -> acknowledged                    (accuser réception ; droit dashboard écriture ; auteur et heure : acknowledged_by, acknowledged_at)
active | acknowledged -> resolved         (résoudre ; motif obligatoire ; auteur et heure ; colonnes à ajouter)
resolved -> active                        (réapparition de la condition : nouvelle alerte, pas de réouverture)
```

Aujourd'hui : seul `status = resolved` est écrit, directement depuis le
navigateur, sans auteur ni motif.

## 11. Workflows

- Lecture : pas de workflow ; chaque lecture recalcule (SECURITY INVOKER),
  rien n'est stocké.
- Alerte : règle serveur -> alerte -> accusé de réception par le
  responsable du domaine -> résolution motivée ; escalade au DG si une
  alerte critique reste active au-delà d'un délai paramétrable (module 24).
  MANQUANT.
- Décision : l'indicateur oriente vers l'écran de décision du module
  propriétaire (le système recommande, l'humain décide, CDC 11.5). PARTIEL
  (via Mes validations).

## 12. Rôles et permissions

| Action | Module de droit | Niveau | Périmètre site | État |
|---|---|---|---|---|
| Voir le tableau de bord | données de chaque table | lecture RLS | oui (D-038, D-046, D-075) | DÉPLOYÉ |
| Voir le centre de pilotage | `dashboard` (menu) ; chaque domaine selon son module (`trips`, `vehicles`, `maintenance`, `fuel`, `purchases`, `invoices`...) | lecture | oui, un domaine illisible rend « Non visible avec vos droits de lecture » (D-072 R3-6) | DÉPLOYÉ |
| Voir les alertes | RLS `lecture_module` : `dashboard` + `vehicule_permis` ; `lecture_suivi` : `gps_tracking` (`20261115210000_perimetre_etendu.sql:70-92`) | lecture | oui, par le site de l'engin | DÉPLOYÉ côté serveur ; incohérence : le menu exige `reports` (`AuthContext.tsx:215`) |
| Accuser, résoudre une alerte | `ecriture_module` : `dashboard` écriture + périmètre | écriture | oui | serveur prêt, écran cassé |
| Configurer les widgets d'un profil | `settings` (administrateur) | écriture | - | MANQUANT |
| Configurer ses propres widgets | utilisateur | écriture personnelle | - | MANQUANT |

## 13. Tables et relations

| Table / vue | Rôle | RLS | État |
|---|---|---|---|
| `alerts` (`id`, `alert_type` CHECK 8 valeurs, `severity` info/warning/critical, `title`, `message`, `reference_type`, `reference_id`, `vehicle_id`, `driver_id`, `status`, `acknowledged_by`, `acknowledged_at`, `created_at`) | alertes | lecture et écriture bornées (D-046), DELETE retiré (D-042) | existante, sans producteur ; pas de `resolved`, `resolved_at`, `resolu_par`, `motif`, `site_id` |
| `v_realisation_objectifs` | objectif et réalisé | RLS des tables | DÉPLOYÉ |
| `quick_actions_log` | journal des actions rapides | lecture et insertion personnelles (`20261120120000_archive_tables_sans_politique.sql:116-118`) | DÉPLOYÉ |
| Cible : `tableaux_bord_config` (profil ou utilisateur, code widget, ordre, période par défaut) | configuration | lecture personnelle et du profil, écriture par fonction | MANQUANT |
| Cible : `regles_alerte` (code, domaine, seuil, gravité, actif) | paramétrage des alertes | administrateur | MANQUANT |

## 14. Fonctions serveur et API

| Fonction | Rôle | État |
|---|---|---|
| `indicateurs_pilotage(p_debut date, p_fin date, p_site uuid)` SECURITY INVOKER | indicateurs par domaine | DÉPLOYÉ |
| `indicateurs_charge_contrats()` | tableau du chargé de contrats | DÉPLOYÉ |
| `indicateurs_exploitation(debut, fin, site, shift)` | base commune des rapports (D-058), accepte le shift | DÉPLOYÉ, non utilisée par le Command Center |
| `mes_validations()` | décisions en attente (module 24) | DÉPLOYÉ |
| Cible : `comparer_indicateurs(p_debut, p_fin, p_ref_debut, p_ref_fin, p_site)` | comparaison de périodes | MANQUANT |
| Cible : `generer_alertes()` (planifiée) et `accuser_alerte(id)`, `resoudre_alerte(id, motif)` | cycle des alertes | MANQUANT |
| Cible : `definir_tableau_bord(profil, widgets)` | configuration | MANQUANT |

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Alerte critique créée | responsable du domaine du site | centre de notifications (`notifications`) | MANQUANT |
| Alerte critique non résolue après délai | DG | centre de notifications, puis courriel | MANQUANT (pas de passerelle) |
| Objectif du jour en sous-réalisation à mi-shift | chef de poste, exploitation | centre de notifications | MANQUANT |

## 16. Documents et modèles d'impression

Cible : impression A4 paysage d'un tableau de bord avec en-tête SIGTB (D-018 :
nom du produit seul), période, site, heure de calcul, source de chaque
indicateur. État : MANQUANT pour le tableau de bord et le centre de
pilotage (aucun appel à `exportToPDF`).

## 17. Exports et rapports

| Export | État | Preuve |
|---|---|---|
| CSV des indicateurs de pilotage (domaine, valeur, unité, fiabilité, source, détail, période, heure) | DÉPLOYÉ | `CentrePilotageView.tsx:46` |
| Impression / PDF | MANQUANT | - |
| Excel | MANQUANT (« Excel » = CSV dans `src/lib/exports.ts`) | - |
| Export du tableau de bord exploitation | MANQUANT | - |
| Rapports périodiques | renvoi module 21 (DÉPLOYÉ) | `Reports/ReportsView.tsx` |

## 18. Historique et audit

- Indicateurs : recalculés à chaque lecture ; un instantané figé se fait par
  les rapports figés (module 21, `rapports_figes`).
- Alertes : `acknowledged_by`, `acknowledged_at` existent mais ne sont pas
  écrits ; aucune trace de résolution. MANQUANT.
- Configuration : journal des modifications à prévoir. MANQUANT.

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `40_indicateurs_pilotage` (6), `54_correctifs_revue_finance_reporting` (28, dont domaine illisible), `18_suivi_recouvrement` (indicateurs du chargé de contrats) | alertes (cycle, RLS, producteur), comparaison de périodes |
| Unitaires | `Dashboard/indicateurs.test.ts` (7) | configuration des widgets |
| E2E (API simulée) | `tableau-de-bord.spec.ts` (3), `centre-pilotage.spec.ts` (1) | alertes, export du tableau de bord, parcours J3 contre une vraie base |

## 20. Critères de recette métier

1. Le DG ouvre le centre de pilotage sur la semaine écoulée, site de Nimba :
   tonnes livrées et acceptées égales à celles du rapport client CBG de la
   même période (module 21) ; chaque tuile affiche source, fiabilité et
   heure.
2. Un voyage livré sans poids rend « Partiel » le tonnage et ne l'estime
   pas.
3. Un compte borné à un site ne voit aucun chiffre d'un autre site.
4. Une alerte critique (ex. intervention Neemba en retard) apparaît, est
   accusée puis résolue avec motif ; l'historique montre qui et quand.
5. Comparaison semaine courante / semaine précédente sans tableur.
PV : à signer par le DG et le responsable d'exploitation (jalon J3).

## Synthèse des états (éléments du catalogue du propriétaire)

| Élément | État |
|---|---|
| Tableau de bord exploitation (vue synthétique des opérations) | DÉPLOYÉ |
| Centre de pilotage multi-domaines | DÉPLOYÉ |
| Tableau de bord Contrats (chargé de contrats) | DÉPLOYÉ |
| Rapports périodiques (renvoi module 21) | DÉPLOYÉ |
| Dashboards DG, Finance, Flotte, Carburant, Maintenance, Performance par profil | PARTIEL |
| Centre des décisions | PARTIEL |
| Analyse par site, shift, véhicule, partenaire | PARTIEL |
| Export et impression des tableaux de bord | PARTIEL |
| Actions rapides | PARTIEL |
| Alertes prioritaires | MAQUETTE |
| Comparaison des périodes | MANQUANT |
| Configuration des widgets | MANQUANT |
| Personnalisation par profil | MANQUANT |
| Prévisions de production (déclencheur) | MANQUANT |
| Prévisions financières (déclencheur) | MANQUANT |

Total : 4 DÉPLOYÉ, 5 PARTIEL, 1 MAQUETTE, 5 MANQUANT. Aucun UTILISABLE ni
VALIDÉ (aucune donnée réelle, aucun PV).

## Défauts bloquants constatés

| Fichier:ligne | Cause | Effet |
|---|---|---|
| `src/components/Alerts/AlertsView.tsx:53` et `:55` | Filtre `.eq('resolved', ...)` : la colonne `resolved` n'existe pas dans `alerts` (`20260903000000_base_reference.sql:1479-1496`, aucune migration ne l'ajoute) | PostgREST refuse la lecture (filtre par défaut `unresolved`, ligne 33) ; l'erreur part en console (`AlertsView.tsx:82`) : la liste des alertes est toujours vide |
| `src/components/Alerts/AlertsView.tsx:101-104` | Mise à jour de `acknowledged` (colonne absente ; seule `acknowledged_at` existe) | Accusé de réception impossible, erreur seulement en console |
| `src/components/Alerts/AlertsView.tsx:118-121` | Mise à jour de `resolved` et `resolved_at` (colonnes absentes) | Résolution impossible, erreur seulement en console |
| `src/components/Alerts/AlertsView.tsx:136-138` | Écriture directe `status = 'resolved'` (colonne valide) sans fonction serveur, sans auteur ni motif | Fonctionne, mais contraire à la règle « écriture par fonction serveur, correction tracée » |

Non bloquant mais à corriger : libellés `getAlertTypeLabel` sans rapport
avec la contrainte `alerts_alert_type_check` ; menu « Alertes » exigeant
`reports` alors que la RLS exige `dashboard` ou `gps_tracking`.

## Écarts et lots proposés

1. **Réparer les alertes (S)** : `AlertsView` sur colonnes réelles ;
   migration additive (`resolu_par`, `resolu_le`, `motif_resolution`,
   `site_id`), fonctions `accuser_alerte`, `resoudre_alerte` ; menu aligné sur
   le droit `dashboard`. Dépendances : aucune.
2. **Producteur d'alertes (M)** : `regles_alerte` paramétrables et
   `generer_alertes()` sur données réelles (intervention Neemba en retard,
   habilitation expirant, cuve sous seuil, voyage livré sans ticket depuis N
   jours, budget dépassé) ; notification au responsable. Dépendances :
   modules 09, 10, 13, 14, 20 ; seuils à fournir par le propriétaire.
3. **Tableau de bord exploitation sur le registre carburant (S)** :
   remplacer `fuel_transactions` par `mouvements_carburant` validés (même
   règle que D-057) ; export et impression.
4. **Comparaison de périodes et ventilation par shift, engin, partenaire
   (M)** : `comparer_indicateurs`, filtre shift branché sur
   `indicateurs_exploitation`.
5. **Tableaux de bord par profil et configuration des widgets (M)** :
   `tableaux_bord_config`, écran de configuration, graphiques d'évolution
   (composants existants `Graphiques.tsx`). Dépendances : composants communs
   (DetailDrawer, ExportModal).
6. **Widgets finance DG (M)** : facturé CBG, encaissé, créances, coût par
   tonne, marge par devise. Dépendances : module 20 (rentabilité, base de
   tonnage acceptée ou livrée à confirmer, D-058).
7. **Rattacher ou retirer les actions rapides (S)** : entrée de menu ou
   suppression de la route orpheline.
8. **Prévisions (L, déclencheur)** : non commencées avant la durée de
   données réelles fixée par le propriétaire.

Points à trancher par le propriétaire : liste des widgets par profil
(DG, exploitation, finance) ; seuils et destinataires des alertes ; base de
tonnage des indicateurs financiers (acceptées CBG ou livrées) ; délai
d'escalade d'une alerte critique.

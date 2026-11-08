# SIGTB 2.0 - Plan de tests

Livrable du LOT 00 (CDC 43). Etat au 2026-11-08.
References : [CDC 2.0](SIGTB_2.0_CAHIER_DES_CHARGES.md) sections 39 a 44,
[PROGRESS](SIGTB_2.0_PROGRESS.md), [DECISIONS](SIGTB_2.0_DECISIONS.md)
(D-007, D-008, D-009), prerequis P1 a P4 de
[PLAN_REVUE_MODULES](PLAN_REVUE_MODULES.md) section 10.1.

## 1. Strategie par niveau (CDC 41)

| Niveau | Outil retenu | Commande | Emplacement | Etat | LOT |
|---|---|---|---|---|---|
| Qualite statique | `tsc`, ESLint, Vite | `bash scripts/ci-qualite.sh`, `npm run build` | `.github/ci-baseline.env` | Operationnel. 37 erreurs typecheck (exigence : 0) | 01 |
| Unitaire | Vitest 3.2.7, environnement `node` | `npm test` | `src/**/*.test.ts` | Operationnel en local | 01 |
| Integration | A outiller (Edge Functions, vues KPI, regles serveur) | - | - | A outiller | 06 |
| RLS | pgTAP via Supabase CLI 2.98.2 | `npm run test:rls` (`supabase test db`) | `supabase/tests/database/*.test.sql` | Tests ecrits ; `supabase start` echoue tant que 41 migrations ne rejouent pas (D-017). Script `test:rls:rejeu` absent de cette branche, en PR #18 | 01 |
| End-to-end | Playwright 1.64.1, Chromium | `npm run test:e2e` | `e2e/`, `playwright.config.ts` | Operationnel en local (build `dist-e2e` servi par `vite preview` sur le port 5174, Supabase local `127.0.0.1:54321`, cle factice) | 01 |
| Charge | A outiller | - | - | A outiller. Objectifs a fixer apres mesure de la flotte, de la frequence GPS, des utilisateurs et du volume d'evenements (CDC 36) | 18 |
| Offline-First | A outiller | - | - | A outiller. Application mobile absente (CDC 24) | 13 |
| Restauration | A outiller | - | - | A outiller. Projet Supabase inaccessible (P2) | 19 |

CI : `.github/workflows/ci.yml` definit les jobs `qualite` (cliquet,
`npm test`, build) et `e2e` (Playwright). Elle ne s'est jamais executee
(facturation GitHub Actions, P1). Les tests RLS n'y sont pas branches
(commentaire dans `ci.yml`, D-008).

## 2. Matrice des scenarios de recette (CDC 40)

Le statut est celui de la fonctionnalite exercee (PROGRESS section 3).
Aucun scenario n'est « Teste » : aucun test automatise ne couvre un AT
complet et la CI n'a jamais tourne. Niveaux : U unitaire, I integration,
RLS, E2E, C charge, O offline, R restauration.

| AT | Scenario | LOT | Niveaux | Statut | Prerequis bloquant |
|---|---|---|---|---|---|
| AT-001 | Creation d'un vehicule DARI | 05 | E2E, RLS | A corriger | `vehicles` sans proprietaire ni exploitant (CDC 9.1) ; organisation absente (LOT 02) |
| AT-002 | Enregistrement d'un sous-traitant | 05 | E2E, RLS | Absent | Table `transporters` absente ; LOT 02 |
| AT-003 | Isolation de ses donnees | 05, 17 | RLS, E2E | Absent | Perimetre role x organisation x site absent (CDC 4.3, LOT 02) ; base RLS de reference (D-017) |
| AT-004 | Planification d'un shift | 03 | U, I, E2E | Maquette | `shift_plans` alimente par `Math.random` ; pas d'instance de shift ; LOT 02 |
| AT-005 | Affectation d'un camion | 09 | U, I, E2E | Maquette | `dispatch_assignments` alimente par `Math.random` ; LOT 05, 06, 08 |
| AT-006 | Depart d'un voyage | 06 | U, I, E2E | A corriger | `trip_status` a 4 etats (CDC 12 : 18) ; pas de `trip_events` |
| AT-007 | Detection d'arrivee au chargement | 08, 06 | U, I | A corriger | Geofences calculees sans PostGIS (D-006) ; pas de `trip_events` |
| AT-008 | Enregistrement du chargement | 06 | I, E2E, O | A corriger | Etats de cycle absents ; table `equipment` absente (CDC 21) |
| AT-009 | Enregistrement d'une pesee | 07 | I, RLS, E2E, O | A corriger | Pas de referentiel pont-bascule ni de calibration |
| AT-010 | Detection d'un doublon de ticket | 07 | U, I | A corriger | `ticket_number` sans contrainte d'unicite ; doublons existants a traiter |
| AT-011 | Depart vers destination | 06 | U, I, E2E | A corriger | Comme AT-006 |
| AT-012 | Detection d'un arret prolonge | 08 | U, I | Absent | Seuls des champs `idle_time_*` existent, dans les maquettes AI et FleetOptimizer ; qualite GPS (CDC 15) ; `trip_events` |
| AT-013 | Enregistrement de livraison | 07 | I, E2E, O | A corriger | `weighings` n'a qu'une notion de poids net |
| AT-014 | Rapprochement des poids | 07 | U, I | Absent | Tonnes chargees et livrees non distinguees (AT-013) |
| AT-015 | Acceptation du tonnage | 07 | I, RLS, E2E | Absent | AT-014 ; regle d'autorisation (CDC 11.5) |
| AT-016 | Cloture du voyage | 06 | I, RLS, E2E | A corriger | AT-015 ; cycle 18 etats |
| AT-017 | Declaration de panne | 11 | I, E2E, O | A corriger | `maintenance_orders` existe ; pas de `vehicle_downtime` |
| AT-018 | Blocage du dispatch d'un vehicule immobilise | 11, 09 | I, RLS | Absent | `vehicle_downtime` absent ; dispatch en maquette (LOT 09) |
| AT-019 | Remise en service validee | 11 | I, RLS, E2E | A corriger | Statuts `maintenance` et `immobilized` existent ; circuit de validation absent (CDC 31) |
| AT-020 | Ravitaillement carburant | 10 | I, E2E, O | A corriger | `fuel_transactions` existe ; pas de `fuel_tanks` ni `fuel_stations` |
| AT-021 | Reconciliation de cuve | 10 | U, I | Absent | `fuel_tanks` absente |
| AT-022 | Detection d'anomalie carburant | 10 | U, I | A corriger | `FuelAnomaliesView` lit `fuel_anomalies`, creee par aucune migration |
| AT-023 | Generation d'un decompte transporteur | 12 | U, I, RLS | Absent | Pas de `contracts` ni `settlements` ; LOT 05, 07 |
| AT-024 | Calcul de cout par tonne | 12 | U, I | A corriger | Pas de `cost_entries` ; tonnes acceptees absentes (AT-015) |
| AT-025 | Reaffectation intelligente | 09 | U, I, E2E | Maquette | Moteur deterministe puis OR-Tools a cadrer ; LOT 05, 06, 08 |
| AT-026 | Fermeture d'une piste | 15, 09 | I, E2E | Absent | Aucune table de troncons (CDC 16) |
| AT-027 | Simulation de production | 14 | U, I | Absent | Resultats etiquetes `SIMULATED` ; LOT 06, 08, 09 |
| AT-028 | Synchronisation hors ligne | 13 | O, I | Absent | Application Expo absente ; `src/lib/offline.ts` renvoie un identifiant fictif (C11) |
| AT-029 | Rejeu sans doublon | 13, 06 | O, I | Absent | Idempotence et outbox absentes (CDC 31) |
| AT-030 | Tentative d'acces non autorise | 01, 02 | RLS, E2E | A corriger | Couverture partielle (section 3) ; Tranche 0 non deployee (P3, D-008) ; base RLS (D-017) ; perimetre site absent (LOT 02) |
| AT-031 | Correction d'une pesee cloturee | 07, 06 | I, RLS | Absent | Event Engine absent : correction = nouvel evenement audite (CDC 31) |
| AT-032 | Rejeu historique d'un shift | 14, 03 | I | Absent | Journal d'evenements (LOT 06) ; instances de shift (LOT 03) |
| AT-033 | Perte de signal GPS | 08 | U, I, E2E | A corriger | Affichage « sans donnees » depuis PR #7 ; precision, qualite et fraicheur non verifiees (CDC 15) |
| AT-034 | Controle des donnees perimees | 04, 08 | U, I, E2E | Absent | Statuts de qualite de donnee absents (CDC 32) ; source, fiabilite et heure des KPI absentes (CDC 8) |
| AT-035 | Restauration d'une sauvegarde | 19 | R | Absent | Acces au projet Supabase (P2) ; procedure de sauvegarde |

## 3. Tests existants

Execution de `npm test` le 2026-11-08 : 2 fichiers, 19 tests verts,
2 `todo`. E2E et RLS non relances pour ce document.

| Fichier | Outil | Nombre | Couverture |
|---|---|---|---|
| `src/lib/exports.test.ts` | Vitest | 16 + 2 `todo` | `buildCSV` (7) : liste vide, en-tetes de la premiere ligne, `null` et `undefined` rendus vides sans valeur inventee, virgules, guillemets internes, multiligne, cles absentes. `formatDataForExport` (9) : libelles vehicules, champs manquants laisses `undefined`, nombre de colonnes pour 5 types, `generic` inchange, enchainement avec `buildCSV`. `todo` : injection de formules tableur (vague E), echappement HTML des exports PDF (C8) |
| `src/i18n/translations.test.ts` | Vitest | 3 | Parite des cles fr / en dans les deux sens ; aucune traduction vide |
| `e2e/connexion.spec.ts` | Playwright | 2 | Formulaire de connexion vide ; non-regression C1 : aucun compte de demonstration, adresse e-mail ni mot de passe affiche |
| `supabase/tests/database/01_profiles_garde_role.test.sql` | pgTAP | 7 assertions | Trigger `profiles_guard_sensitive_columns` (migration `20260903090000`) : existence ; un chauffeur ne peut changer ni son role ni son statut ; colonnes non sensibles modifiables ; role inchange sous RLS ; un admin et le service role peuvent changer un role |
| `supabase/tests/database/02_ecriture_par_module.test.sql` | pgTAP | 6 assertions | Migration `20260903090100` : `has_module_write(text)` existe ; aucune politique `FOR ALL USING (true)` pour `authenticated` ; chauffeur sans ecriture `hr`, insertion et modification de paie refusees ; comptable avec ecriture `hr` |

Seuls les deux fichiers pgTAP touchent un scenario (AT-030, cas role x
module). Les autres tests portent sur le socle sans AT associe.

## 4. Criteres de sortie

Le perimetre du pilote (AT retenus, sites, flotte) est fixe par une
decision dans DECISIONS avant le debut du LOT 18.

### LOT 18 - Tests integres et pilote operationnel

| Critere | Preuve |
|---|---|
| P1 leve : CI executee, verte sur `main` et imposee sur les PR | Run CI |
| Typecheck 0 erreur, lint 0 erreur, build OK (CDC 41) | Sortie `scripts/ci-qualite.sh` en CI |
| Plus aucun niveau « a outiller » en section 1 | Ce document |
| Tests RLS executes en CI sur la base de reference (D-017) | Run CI |
| Chaque AT du perimetre pilote au statut Teste, avec son test cite dans la matrice | Section 2, run CI |
| AT-003 et AT-030 verts sur role x organisation x site | Fichiers pgTAP, run CI |
| Aucun `todo` ni `skip` sur un AT du perimetre pilote | Sortie Vitest, Playwright, pgTAP |
| Tests de charge executes contre des objectifs mesures (CDC 36) | Rapport de charge |
| Aucun `Math.random` dans `src/` hors simulation etiquetee `SIMULATED` | Recherche dans le code |
| AT du perimetre rejoues avec le metier, statut Valide | PV de pilote |

### LOT 19 - Preparation et validation de production

| Critere | Preuve |
|---|---|
| Criteres du LOT 18 tenus | PV de pilote |
| 35 AT au statut Valide | PV de recette metier |
| AT-028 et AT-029 verts sur appareil reel, hors reseau | Rapport offline |
| AT-035 : restauration demontree sur une copie de l'environnement cible | Rapport de restauration date |
| Migrations rejouees sur une copie de l'environnement cible | Sortie de rejeu |
| CDC 42 points 1 a 10 (sauvegarde, migrations, permissions, recette, equipements, retour arriere, supervision, documentation, formation, support) | `docs/SIGTB_2.0_DEPLOYMENT.md` |
| Autorisation explicite de deploiement (CDC 42, regle 7 de `CLAUDE.md`) | Trace ecrite |
| Statut Deploye seulement apres application effective | Sortie `supabase db push` / `functions deploy`, datee |

## 5. Regles

| Regle | Application |
|---|---|
| Aucune donnee de production dans les tests | Pas de donnees issues du projet `bprfctzqplahvrepxgrw` ; la base de reference (D-017) est construite depuis le depot, sans donnees. Les E2E visent `127.0.0.1:54321`, jamais la production |
| Donnees de test identifiables | UUID `00000000-0000-4000-<segment par fichier>-...`, e-mails en `@exemple.invalid`, numeros prefixes `TEST-`, noms suffixes « test ». Tests SQL dans une transaction terminee par `ROLLBACK` |
| Jamais de `Math.random` dans les fixtures | Valeurs fixes ecrites dans le test. `gen_random_uuid()` tolere seulement dans une ecriture dont le test attend le rejet |
| Pas de secret | Cle factice (`cle-factice-e2e`) ; `.env` jamais lu ni commite par les tests |
| Simulation separee du reel | Toute donnee simulee porte `SIMULATED` et un test verifie qu'elle n'apparait pas dans les vues reelles (CDC 26, 27, 32) |
| Tracabilite | Un test qui couvre un scenario cite son identifiant `AT-xxx` dans son nom |
| Statuts | Teste = test automatise vert et run CI ; Valide = PV metier ; Deploye = sortie datee (PROGRESS section 1) |
| Mise a jour | Tout ajout de test met a jour les sections 2 et 3 et PROGRESS dans la meme PR |

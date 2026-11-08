# SIGTB 2.0 - Architecture : existant, cible et transition

Livrable du LOT 00 (CDC 43). Etat au 2026-11-08, constate sur le depot
(branche `docs/lot-00-livrables`), sans acces a la base de production.
References : [CDC 2.0](SIGTB_2.0_CAHIER_DES_CHARGES.md) sections 29, 30,
31, 34, 36 ; [PROGRESS](SIGTB_2.0_PROGRESS.md) ;
[DECISIONS](SIGTB_2.0_DECISIONS.md) ;
[DATABASE_MODEL](SIGTB_2.0_DATABASE_MODEL.md).

Toute affirmation ci-dessous est verifiee dans le code, sauf mention
explicite « non verifie ».

## 1. Architecture actuelle (constatee)

### 1.1 Flux

```
Navigateur (SPA React)
  -- supabase-js, cle anon + JWT --> Supabase Auth / PostgREST --> Postgres (RLS)
Traceurs IoT
  -- HTTP, X-Device-Id + X-Api-Key --> Edge Function iot-ingestion (service role)
                                        --> RPC ingest_gps_data / ingest_fuel_data
Edge Function geofence-monitor (declencheur non verifie, service role)
  --> lit iot_gps_readings, trips ; ecrit geofence_violations, geofence_alerts
```

Le front n'appelle aucune Edge Function (`functions.invoke` absent de
`src/`). Pas de couche API intermediaire : l'application parle directement
a PostgREST.

### 1.2 Presentation (`src/`)

| Element | Constat | Fichiers |
|---|---|---|
| Stack | React ^18.3.1, TypeScript ^5.5.3, Vite ^5.4.2, Tailwind ^3.4.1, Leaflet ^1.9.4 + react-leaflet ^4.2.1, lucide-react | `package.json` |
| Routage | Aucun routeur. `MainApp` garde l'ecran courant dans `useState('dashboard')` ; un `switch (currentView)` de 42 `case` choisit la vue ; `Sidebar` recoit `onViewChange`. Aucune URL par ecran | `src/App.tsx` |
| Chargement | 39 vues en `lazy()` + `Suspense`, `ErrorBoundary` global, `OfflineIndicator` | `src/App.tsx` |
| Modules | 36 dossiers sous `src/components/` (un par module : AI, Fuel, Trips, TireManagement, Tracking...), 92 fichiers `.tsx`, aucun `.ts` | `src/components/*` |
| Couche metier | Aucune : pas de dossier services ni hooks de donnees. La logique (requetes, calculs, regles) vit dans les composants | - |
| Types de base | Non generes : `createClient` non type ; `src/types/` ne contient que `vehicle.ts` | `src/lib/supabase.ts`, `src/types/vehicle.ts` |
| Cartographie | Leaflet dans 5 ecrans | `Geofencing/GeofencingView.tsx`, `Tracking/*` |
| Mobile | Absent (aucune dependance Expo / React Native) | `package.json` |

### 1.3 Contexts, acces aux donnees, offline, i18n

- **Client Supabase** : instance unique creee avec `VITE_SUPABASE_URL` et
  `VITE_SUPABASE_ANON_KEY` (`src/lib/supabase.ts`). 83 des 92 fichiers de
  `src/components` l'utilisent directement. On compte 354 appels
  `.from('<table>')` sur 84 tables distinctes dans `src/components` et
  `src/contexts`, 3 appels `.rpc()` (`calculate_employee_payroll`,
  `log_user_activity` x2), aucun abonnement realtime (`.channel(` absent),
  aucun appel Storage.
- **Pagination** : aucune (`.range(` absent de `src/`) ; 51 `.limit(`.
- **AuthContext** (`src/contexts/AuthContext.tsx`) : session Supabase Auth
  (email / mot de passe), chargement de `profiles` et `role_permissions`,
  `hasPermission(module, action)` et `canAccessModule(vue)` via une table de
  correspondance vue -> module ; le role `admin` court-circuite tout.
  `Sidebar.tsx` filtre le menu avec `canAccessModule` : c'est de
  l'ergonomie, pas une protection.
- **Creation de comptes depuis le navigateur** : `AuthContext.signUp` et
  `Settings/UserModal.tsx` appellent `supabase.auth.signUp` puis inserent
  `profiles` avec un `role` fourni par le client. La garde anti-escalade est
  la migration `20260903090000_protect_profiles_role_escalation.sql`, non
  deployee.
- **LanguageContext** (`src/contexts/LanguageContext.tsx`) : `fr` par
  defaut, `en` ; preference lue dans `user_preferences` si connecte, sinon
  `localStorage`. Dictionnaire unique `src/i18n/translations.ts` (objets
  `fr` et `en`, 500 lignes), parite controlee par
  `src/i18n/translations.test.ts`.
- **Offline** (`src/lib/offline.ts`) : file d'operations
  insert / update / delete en `localStorage` (cle `sigtb_offline_queue`),
  rejouee a l'evenement `online`, 3 tentatives, purge des operations
  synchronisees apres 24 h. En insert hors ligne, `offlineSupabase` renvoie
  la ligne avec l'identifiant de la transaction comme `id` (identifiant
  fictif, constat C11). Pas de cle d'idempotence cote serveur, pas de
  resolution de conflit. Seul `Offline/OfflineIndicator.tsx` utilise ce
  module ; `offlineSupabase` n'est appele par aucun ecran.
- **Donnees inventees** : 5 `Math.random` restants dans 5 fichiers
  (36 dans 13 fichiers au 2026-11-06, avant PR #14). Deux produisent une
  valeur affichee ou stockee : `Notifications/SmartNotificationCenter.tsx`
  (`is_read`), `QuickActions/QuickActionsPanel.tsx` (`execution_time_ms`).
  Trois generent des suffixes de numeros (factures, paiements, bons de
  commande).
- **Journalisation** : 112 appels `console.*` dans `src/` ; aucun outil de
  supervision dans les dependances.

### 1.4 Edge Functions (`supabase/functions/`)

| Fonction | Constat |
|---|---|
| `iot-ingestion/index.ts` | Routes `/gps`, `/fuel`, `/telemetry` par `path.includes`. Client `SUPABASE_SERVICE_ROLE_KEY`. Authentification par couple `X-Device-Id` / `X-Api-Key` compare a `iot_devices.api_key`, colonne `text` en clair (`20251101072253_create_iot_infrastructure_final.sql`). Appelle les RPC `ingest_gps_data` et `ingest_fuel_data`, **definies dans aucune migration** (existence en production non verifiee). Le champ `timestamp` du traceur est declare dans `GPSData` mais n'est pas transmis a la RPC ; `iot_gps_readings.reading_timestamp` a pour defaut `now()` |
| `geofence-monitor/index.ts` | Client service role. Zones traitees comme des cercles (`isVehicleInZone` : distance haversine au centre <= `radius_meters`) ; les polygones ne sont pas evalues. Aucun controle de l'appelant dans le code ; la protection depend de `verify_jwt` au deploiement (aucune section `functions` dans `supabase/config.toml` : non verifie). Declencheur : aucun `pg_cron` / `pg_net` dans les migrations (non verifie) |

### 1.5 Base de donnees (`supabase/migrations/`)

- 131 fichiers, du `20251022164649_001_create_core_tables.sql` au
  `20260903090100_restrict_open_rls_policies.sql` ; 142 noms de tables
  distincts dans les `CREATE TABLE` ; 33 fonctions SQL nommees ; vues dans
  3 migrations ; aucune vue materialisee.
- Extension unique : `uuid-ossp`. **Pas de PostGIS** : `geofence_zones`
  porte un `geometry_type` texte (`polygon` / `circle`) et un commentaire
  « dans une vraie implementation, utiliser PostGIS »
  (`20251101093539_create_geofencing_system.sql`).
- Enums structurants : `trip_status` (4 valeurs), `vehicle_status` (4).
- Journaux existants : `tracking_events`, `user_activity_logs`. Aucune
  table d'evenements metier ni d'outbox.
- Tranche 0 securite : `20260903090000` (anti-escalade de role) et
  `20260903090100` (`has_module_write`, suppression des politiques
  `FOR ALL ... USING (true)`, environ 113 selon l'en-tete). Mergee, non
  deployee ; la seconde echoue sur base rejouee (D-008).
- Rejouabilite : 41 migrations sur 133 echouent sur base vierge (PROGRESS,
  D-017).

### 1.6 Qualite et CI

`.github/workflows/ci.yml` : cliquet `scripts/ci-qualite.sh`, `npm test`,
build, E2E Playwright ; jamais execute (`startup_failure`). Baselines
`.github/ci-baseline.env` : `TSC_BASELINE=37`, `LINT_WARN_BASELINE=250`.
Tests (D-007) : Vitest (`src/lib/exports.test.ts`,
`src/i18n/translations.test.ts`), Playwright (`e2e/connexion.spec.ts`),
pgTAP (`supabase/tests/database/01_*.sql`, `02_*.sql`).

## 2. Architecture cible du CDC (resume)

- **Socle (29)** : React, TypeScript, Vite, Supabase Auth, PostgreSQL,
  PostGIS, Edge Functions, Leaflet ou MapLibre, React Native / Expo et
  SQLite pour le mobile, GitHub Actions. Monolithe modulaire avec services
  metier distincts ; pas de microservices sans necessite demontree.
- **Couches (30)** : 1 presentation web et mobile ; 2 API et
  authentification ; 3 services metier ; 4 workflows et moteur
  evenementiel ; 5 services d'optimisation ; 6 integrations externes ;
  7 base transactionnelle ; 8 donnees analytiques. PostgreSQL est la source
  de verite metier, PostGIS porte la geographie. L'optimisation complexe
  peut etre isolee dans un service Python OR-Tools sans sortir
  prematurement les regles metier du socle.
- **Event Engine (31)** : journal durable ; chaque evenement porte ID,
  type, entite, date de survenue, date d'enregistrement, acteur, source,
  site, payload, identifiant de correlation, cle d'idempotence, piece
  justificative. Aucune reecriture silencieuse ; correction = nouvel
  evenement audite. Transactional Outbox entre transaction metier et
  traitements asynchrones.
- **API (34)** : interfaces versionnees `/api/v1/...` pour production,
  dispatch, trips et leurs evenements, pont-bascule, livraisons, carburant,
  maintenance, transporteurs, contrats, decomptes, analytique, telemetrie
  et synchronisation mobile (`/sync/push`, `/sync/pull`). Integrations
  materielles par adaptateurs independants.
- **Fiabilite (36)** : pagination, index PostgreSQL et geospatiaux,
  requetes optimisees, agregations analytiques, traitements asynchrones,
  cache maitrise, gestion d'erreurs, supervision, journalisation
  structuree, alertes techniques. Objectifs de performance fixes apres
  mesure (flotte, frequence GPS, utilisateurs, volume d'evenements).

## 3. Ecarts actuel / cible

| # | Domaine | Actuel | Cible (CDC) | LOT |
|---|---|---|---|---|
| E01 | RLS | Tranche 0 non deployee ; politiques ouvertes presumees en production | RLS restrictive (35) | 01 |
| E02 | CI, typage | CI jamais executee ; 37 erreurs `tsc` ; client non type | GitHub Actions (29), CDC 41 | 01 |
| E03 | Rejouabilite | 42 migrations non rejouables ; tests RLS bloques | Schema reproductible (33) | 01 (D-008, D-017) |
| E04 | Operations sensibles | Comptes et roles crees depuis le navigateur | Fonctions serveur autorisees (35) | 01, 02 |
| E05 | MFA | Absent | MFA comptes sensibles (35) | 01, 02 |
| E06 | Perimetre | Droits role x module ; pas d'organisation ni de portee site | Role x organisation x site (4.3, 35) | 02 |
| E07 | Geographie | Pas de PostGIS ; geofences en cercle haversine dans l'Edge Function | PostGIS, index geospatiaux (29, 30, 36) | 02, 08 (D-006) |
| E08 | Services metier | Logique dans les composants ; 354 appels `.from()` directs | Couche 3, monolithe modulaire (29, 30) | 06, puis chaque LOT metier |
| E09 | API | PostgREST direct, aucune route versionnee | `/api/v1/...` (34) | 06 et suivants (chaque LOT expose ses routes) |
| E10 | Evenements | `tracking_events`, `user_activity_logs` seulement | Journal durable, outbox, idempotence (31) | 06 |
| E11 | Cycle voyage | `trip_status` a 4 valeurs | 14 etats + 4 exceptionnels (12) | 06 |
| E12 | Qualite de donnee | Aucun statut | VERIFIED ... PENDING_SYNC (32) | 04, 06 |
| E13 | Analytique | KPI recalcules ecran par ecran ; aucune vue materialisee | Couche 8, agregations (30, 36) | 04 |
| E14 | Ingestion GPS | RPC absentes des migrations ; horodatage traceur ignore ; `api_key` en clair | Authentification des equipements (35), adaptateurs (34), fraicheur (15) | 08 |
| E15 | Endpoint geofence | Aucun controle d'appelant dans le code ; declencheur inconnu | Protection des endpoints (35) | 08 |
| E16 | Optimisation | FleetOptimizer en maquette ; aucun service | Service Python OR-Tools (30) | 09 |
| E17 | Integrations materielles | Aucun adaptateur pont-bascule ni jauge carburant | Adaptateurs independants (34) | 07, 10 |
| E18 | Mobile, offline | Pas d'app ; `offline.ts` en `localStorage`, id fictif | Expo + SQLite, `/sync/push`, `/sync/pull` (24, 29, 34) | 13 |
| E19 | Donnees inventees | 2 `Math.random` produisant des valeurs affichees ou stockees | Aucune donnee inventee (27, 32) | 01 (D-004), 16 |
| E20 | Pagination | Aucune (`.range` absent) | Pagination (36) | 01 pour le socle, charge mesuree au 18 |
| E21 | Supervision | `console.*` uniquement ; aucune alerte technique | Supervision, logs structures, alertes (36) | 19 |
| E22 | Navigation | Ecran courant en memoire, sans URL | Non exige explicitement ; portails isoles (25) a adresser | 17 (decision prealable) |

## 4. Principes de transition

1. **Conserver le socle** (CDC 29, D-001) : React, Supabase, Postgres,
   Edge Functions. Pas de microservice ; seul service separe envisage :
   l'optimisation Python OR-Tools (LOT 09). Pas de nouvelle dependance UI ;
   l'ajout d'un routeur (E22) passe d'abord par une decision.
2. **LOT 01 d'abord** (PROGRESS section 4, D-005) : Tranche 0 deployee et
   verifiee, CI executee, avant toute evolution fonctionnelle.
3. **Securite serveur d'abord** : toute nouvelle table avec RLS active,
   aucune politique `FOR ALL USING (true)` ; ecriture via
   `has_module_write('<module>')` ou fonction serveur, `is_admin()` pour
   l'administration ; cible role x organisation x site (CDC 4.3). Le filtre
   du menu n'est jamais une protection. Les operations sensibles (comptes,
   roles, validations) passent par des fonctions serveur (CDC 35).
4. **Migrations** : nouveau fichier horodate, idempotent (`IF NOT EXISTS`),
   jamais de modification d'une migration existante. Seule exception
   envisagee : D-008 (acceptee, PR #16). Reference de schema : base construite
   depuis le depot (D-017). Cartographier avant de creer (CDC 33,
   DATABASE_MODEL).
5. **Aucune donnee inventee** (CDC 26, 27, 32, D-004) : absence de donnee
   = « sans donnees » ; simulation etiquetee `SIMULATED`, jamais melangee
   au reel.
6. **Evenements et audit** (CDC 31) : date de survenue (source) distincte
   de la date d'enregistrement ; correction = nouvel evenement audite ;
   le systeme recommande, l'humain decide (CDC 11.5).
7. **Fraicheur** (CDC 15, 8) : une position ancienne n'est jamais affichee
   en direct ; chaque KPI expose periode, source, fiabilite et heure.
8. **Extraction progressive** : le nouveau code metier passe par des
   fonctions SQL, des Edge Functions ou des modules de service, pas par des
   requetes dans les composants. Les ecrans existants migrent quand le LOT
   qui change leur modele les touche (D-005), pas avant.
9. **PostGIS des le LOT 02** (D-006) ; les geofences migrent vers des
   colonnes `geometry`.
10. **Secrets** : `SUPABASE_SERVICE_ROLE_KEY` uniquement dans
    l'environnement des Edge Functions ; seules les cles `VITE_*` publiques
    cote client ; `.env` jamais commite.
11. **Preuves** : Vitest, pgTAP, Playwright (D-007) ; cliquet sans
    regression ; ne pas confondre merge, teste, valide, deploye (CDC 44).
12. **Derogations** : toute derogation au CDC est consignee dans DECISIONS
    avant d'etre codee ; l'archive Bolt n'est jamais une source (D-002) ;
    le plan de revue releve du LOT 01 (D-003).

## 5. Points ouverts

| Point | Pourquoi non verifiable | Consequence | LOT |
|---|---|---|---|
| Schema reel de production | Projet `bprfctzqplahvrepxgrw` inaccessible et abandonne (D-016) ; base de reference reconstruite depuis le depot (D-017) | Inconnus : existence de `ingest_gps_data`, `ingest_fuel_data`, `fuel_anomalies` ; politiques RLS et extensions reellement installees. Ecart de comptage a lever : 42 migrations en echec selon PROGRESS, 41 selon DATABASE_MODEL | 01 |
| Configuration de deploiement des Edge Functions | Non visible dans le depot | `verify_jwt`, secrets et declencheur de `geofence-monitor` non verifies | 01, 08 |
| Protocoles des traceurs GPS | Materiel et fournisseurs inconnus (P5) | Format, horodatage, envoi differe, authentification des equipements a definir avant l'adaptateur | 08 |
| Service Python OR-Tools | Non cadre | Hebergement, contrat d'API, donnees d'entree, deploiement et supervision a decider ; il ne porte pas les regles metier | 09 |
| Forme de l'API `/api/v1` | Aucune decision | Edge Functions ou fonctions SQL exposees : a trancher dans DECISIONS avant le LOT 06 | 06 |
| Volumetrie | Non mesuree | Objectifs de performance (CDC 36) non fixables ; dimensionnement de l'Event Engine et de l'ingestion GPS ouvert | 08, 18 |
| Sauvegardes et restauration | Configuration Supabase inaccessible | Non verifie (CDC 35) | 19 |

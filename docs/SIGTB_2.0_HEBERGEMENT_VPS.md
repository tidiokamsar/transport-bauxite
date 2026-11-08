# SIGTB 2.0 - Hebergement sur le VPS du proprietaire

Decisions D-015 a D-017 (acceptees le 2026-11-08). Etat au 2026-11-08 :
rien n'est installe ni deploye.

## 1. Situation

| Prerequis | Etat au 2026-11-08 |
|---|---|
| P1, GitHub Actions | Impossible : le moyen de paiement est refuse |
| P2, projet Supabase `bprfctzqplahvrepxgrw` | Inaccessible ; l'application sera deployee sur le VPS du proprietaire (Hostinger, offre KVM 4), sous `sigtb.infranetgn.com` |
| P3, deploiement de la Tranche 0 | Autorise le 2026-11-08 ; s'applique au premier deploiement sur le VPS, puisque le projet d'origine est inaccessible |

## 2. Ce que le code utilise de Supabase (mesure du 2026-11-08)

| Composant | Usage dans le depot |
|---|---|
| API de donnees (PostgREST) | 95 appels `supabase.from()` dans 32 fichiers, sur 84 tables ou vues |
| Authentification (GoTrue) | Connexion par mot de passe, session, `getUser` (10 appels), deconnexion ; `signUp` (2 appels, code mort, C10) |
| Fonctions SQL appelees | `calculate_employee_payroll`, `log_user_activity` |
| Edge Functions (Deno) | `iot-ingestion`, `geofence-monitor`, appelees par les boitiers et non par l'interface |
| Stockage de fichiers | Aucun appel |
| Temps reel | Aucun appel |
| Securite | RLS et `auth.uid()` dans les migrations ; `has_module_write`, `is_admin` |
| Client | `@supabase/supabase-js` ^2.57.4 ; variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

## 3. Options

| | A. Supabase open source sur le VPS | B. Sans aucun composant Supabase | C. Assemblage minimal |
|---|---|---|---|
| Principe | `docker compose` officiel de Supabase, sans compte ni service Supabase | Postgres, API et authentification developpees par nous | Postgres + PostgREST + GoTrue + proxy HTTPS, assembles par nous |
| Code a modifier | Variables d'environnement seulement | Les 95 appels, l'authentification, les 2 fonctions, la RLS fondee sur `auth.uid()` | Variables d'environnement ; les 2 fonctions a heberger (Deno) |
| Delai et risque | Faibles | Plusieurs semaines sans fonction nouvelle, risque de regression eleve | Moyens : composition maintenue par nous |
| Exploitation | Mises a jour, secrets et sauvegardes a notre charge | Tout a notre charge | Tout a notre charge, moins de conteneurs |

**Option retenue : A (D-016).** Elle supprime toute dependance au service
et au compte Supabase. Les composants restent des logiciels libres installes
sur le VPS. Les services inutilises sont retires du `docker-compose.yml` :
Realtime, Storage et imgproxy (procedure prevue par la documentation
officielle). Le passage a l'option C reste possible ensuite sans toucher
au code.

Exigences publiees par Supabase pour l'auto-hebergement (page
self-hosting/docker, lue le 2026-11-08) : 4 Go de RAM, 2 coeurs et 40 Go
de SSD au minimum ; 8 Go, 4 coeurs et 80 Go recommandes. La documentation
precise que les sauvegardes ne sont pas fournies en auto-hebergement.

## 4. Architecture cible (option A)

| Element | Role |
|---|---|
| Proxy HTTPS (Caddy ou nginx, a choisir) | Certificat TLS, sert l'interface construite (`dist/`), relaie l'API vers la passerelle Supabase |
| Pile Supabase (`docker compose`) | Postgres, Auth, PostgREST, passerelle, Edge Runtime ; Studio accessible uniquement par tunnel SSH |
| Pare-feu | Ports 22, 80 et 443 seulement ; Postgres et Studio jamais exposes |
| Acces | SSH par cle ; aucun mot de passe transmis dans le chat ni dans le depot |
| Sauvegardes | `pg_dump` quotidien chiffre, copie hors du VPS, restauration testee (CDC 42) |
| Secrets | Generes sur le VPS par les scripts officiels, hors depot (regle 3) |

## 5. Base de donnees de reference (D-017)

Le dump de production prevu par D-009 est impossible. La base est
construite depuis le depot :

1. Les migrations qui rejouent sur base vierge, dont la Tranche 0, N4 et
   D-012.
2. Une migration consolidee pour les tables lues par l'interface mais
   creees par des migrations Bolt qui echouent (liste en section 5.1).
3. Aucune donnee de demonstration Bolt (regle 1). Le premier
   administrateur est cree sur le VPS avec un mot de passe neuf (C1) : les
   migrations `20251211134113_create_admin_user_account` et
   `20251211134305_update_admin_user_credentials` sont exclues. Elles
   ecrivent dans `auth.users`, dont le schema appartient au service Auth
   et differe de celui de l'image Postgres seule (resultat de rejeu
   variable d'une execution a l'autre le 2026-11-08 : colonne
   `email_confirmed_at` tantot presente, tantot absente). Elles restent
   dans `supabase/tests/echecs-connus.txt`.

### 5.1 Tables lues par l'interface, absentes de la base rejouee

Mesure du 2026-11-08 : 84 tables ou vues lues par `supabase.from()`,
131 objets dans la base rejouee (92 migrations sur 133), 13 manquants.

| Table | Creee par | Lue par | Traitement propose |
|---|---|---|---|
| `costs` | `20251023120246` (echoue) | Costs, Dashboard, Reports | A recreer (module reel) |
| `departments` | `20251023120423` (echoue) | HR (EmployeeModal) | A recreer (module reel) |
| `user_preferences` | `20251211131020` (echoue) | LanguageContext | A recreer |
| `fuel_stations` | Aucune migration | Fuel | A creer (module reel, LOT 10) |
| `fuel_anomalies` | Aucune migration | Fuel (3 ecrans) | A creer ou retirer des ecrans (LOT 10) |
| `fuel_consumption`, `fuel_predictions`, `fuel_vehicle_stats` | Aucune migration | FuelIntelligentDashboard | Ecran a signaler « sans donnees » jusqu'au LOT 10 |
| `fleet_tasks`, `optimization_scenarios`, `performance_kpis`, `shift_plans`, `task_assignments` | `20251210111808` (echoue) | FleetOptimizer (maquette, D-004) | Pas recreees : module reconstruit au LOT 09 |

Le detail de la migration consolidee fera l'objet d'une PR dediee.

## 6. Integration continue (D-015)

En attendant une CI hebergee : `bash scripts/ci-locale.sh` reproduit les
trois jobs de `.github/workflows/ci.yml` (cliquet, tests unitaires, build,
rejeu RLS, E2E) et ecrit `test-results/ci-locale.txt`. Chaque PR indique le
resultat dans sa section Controles. Une CI sur le VPS (runner auto-heberge
ou forge auto-hebergee) sera proposee une fois le VPS en service ; la
possibilite d'utiliser un runner GitHub auto-heberge avec un compte
verrouille n'est pas verifiee.

## 7. Informations a fournir par le proprietaire

1. Systeme et version du VPS, RAM, coeurs, disque (a mesurer sur le
   serveur des que l'acces SSH est ouvert).
2. Docker deja installe ou non ; autres services presents sur le VPS.
3. Domaine : `sigtb.infranetgn.com`, qui pointe vers l'adresse du VPS
   (resolution DNS verifiee le 2026-11-08).
4. Acces SSH par cle (D-016) : adresse du VPS, utilisateur, et cle publique
   autorisee par le proprietaire.
5. Serveur SMTP pour les courriels d'authentification (facultatif).
6. Emplacement des sauvegardes hors du VPS.

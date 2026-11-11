# SIGTB 2.0 - Hebergement sur le VPS du proprietaire

Decisions D-015 a D-017 (acceptees le 2026-11-08). Etat au 2026-11-09 :
**deploye** sur le VPS, en service sous https://sigtb.infranetgn.com
(journal en section 9). Base vide : aucun utilisateur tant que le
proprietaire n'a pas cree l'administrateur.

## 1. Situation

| Prerequis | Etat au 2026-11-08 |
|---|---|
| P1, GitHub Actions | Impossible : le moyen de paiement est refuse |
| P2, projet Supabase `bprfctzqplahvrepxgrw` | Inaccessible et abandonne ; remplace par le VPS du proprietaire (Hostinger, offre KVM 4), deploye le 2026-11-09 sous `sigtb.infranetgn.com` |
| P3, deploiement de la Tranche 0 | Autorise le 2026-11-08 ; deploye et verifie sur le VPS le 2026-11-09 (section 9) |

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
construite depuis le depot (fait le 2026-11-09) :

| Migration | Contenu |
|---|---|
| `20260903000000_base_reference` | Generee par `scripts/construire-base-reference.sh` : schema `public` obtenu en rejouant les 88 migrations Bolt qui passent sur 129 (140 tables, toutes avec RLS ; 53 politiques ; droits), plus les 133 lignes de la matrice `role_permissions`. Aucune autre donnee |
| `20260903090000`, `20260903090100` | Tranche 0 (garde du role, ecriture par module) |
| `20261108090000` | `is_admin` durci (N4) |
| `20261108100000` | Matrice des roles alignee (D-012) |
| `20261109090000_tables_manquantes` | `costs`, `departments` ; politiques manquantes de `cost_categories` et `user_preferences` |

Les 129 migrations Bolt sont archivees dans
`supabase/migrations_bolt_archive`, avec la liste des 41 qui echouent.
Elles ne sont plus appliquees. Aucune donnee de demonstration n'arrive en
base (regle 1) ; le premier administrateur est cree sur le VPS par le
proprietaire (`deploy/vps/creer-admin.sh`), avec un mot de passe neuf (C1).

Controle : `npm run test:rls:rejeu` rejoue les 6 migrations sans echec et
passe 39 assertions RLS (fichiers 01 a 05).

### 5.1 Tables lues par l'interface, absentes de la base rejouee

Mesure du 2026-11-08 : 84 tables ou vues lues par `supabase.from()`,
131 objets dans la base rejouee (92 migrations sur 133), 13 manquants.

| Table | Creee par | Lue par | Traitement propose |
|---|---|---|---|
| `costs` | `20251023120246` (echoue) | Costs, Dashboard, Reports | Recreee (`20261109090000`) |
| `departments` | `20251023120423` (echoue) | HR (EmployeeModal) | Recreee (`20261109090000`) |
| `user_preferences` | Presente dans la base de reference, sans politique | LanguageContext | Politique ajoutee (`20261109090000`) |
| `fuel_stations` | Aucune migration | Fuel | A creer (module reel, LOT 10) |
| `fuel_anomalies` | Aucune migration | Fuel (3 ecrans) | A creer ou retirer des ecrans (LOT 10) |
| `fuel_consumption`, `fuel_predictions`, `fuel_vehicle_stats` | Aucune migration | FuelIntelligentDashboard | Ecran a signaler « sans donnees » jusqu'au LOT 10 |
| `fleet_tasks`, `optimization_scenarios`, `performance_kpis`, `shift_plans`, `task_assignments` | `20251210111808` (echoue) | FleetOptimizer (maquette, D-004) | Pas recreees : module reconstruit au LOT 09 |

Le detail de la migration consolidee fera l'objet d'une PR dediee.

## 6. Procedure d'installation sur le VPS

Kit versionne dans `deploy/vps/`. Tout s'execute en root sur le serveur,
depuis une copie du depot deposee dans `/opt/sigtb/depot`.

| Etape | Commande | Effet |
|---|---|---|
| 1 | `bash deploy/vps/installer.sh` | Modele officiel Supabase au tag `self-hosted/v0.8.4`, pile reduite (`deploy/vps/docker-compose.yml` : base, connexion, API, passerelle, fonctions), secrets generes sur place dans `/opt/sigtb/pile/.env` (600, jamais affiches), demarrage. Un seul port : `127.0.0.1:8200` |
| 2 | `bash deploy/vps/appliquer-migrations.sh --tests` | Migrations du depot dans l'ordre, chacune dans sa transaction, tracees dans `supabase_migrations.schema_migrations` ; tests pgTAP en transaction annulee |
| 3 | Build de l'interface avec `VITE_SUPABASE_URL=https://sigtb.infranetgn.com` et la cle publique `ANON_KEY` du serveur, depose dans `/opt/sigtb/web/releases/<sha>`, lien `current` | Interface servie par Caddy |
| 4 | Copie de `deploy/vps/sigtb.caddy` dans `/etc/caddy/`, sauvegarde du Caddyfile, ligne `import`, `caddy validate`, `systemctl reload caddy` | HTTPS sur `sigtb.infranetgn.com` ; seules `/auth/v1`, `/rest/v1` et `/functions/v1/iot-ingestion` sont exposees |
| 5 | `bash /opt/sigtb/outils/creer-admin.sh` (proprietaire) | Premier administrateur ; mot de passe saisi sans echo |
| 6 | Cron `45 3 * * * /opt/sigtb/outils/sauvegarder.sh` | Dump quotidien, empreinte, controle de lisibilite, 14 jours |

Regles sur ce serveur partage : ne jamais redemarrer Caddy ni les autres
piles ; pas de port publie hors `127.0.0.1` (Docker contourne `ufw`) ;
`geofence-monitor` n'est pas deployee (N3).

## 7. Integration continue (D-015)

En attendant une CI hebergee : `bash scripts/ci-locale.sh` reproduit les
trois jobs de `.github/workflows/ci.yml` (cliquet, tests unitaires, build,
rejeu RLS, E2E) et ecrit `test-results/ci-locale.txt`. Chaque PR indique le
resultat dans sa section Controles. Une CI sur le VPS (runner auto-heberge
ou forge auto-hebergee) sera proposee une fois le VPS en service ; la
possibilite d'utiliser un runner GitHub auto-heberge avec un compte
verrouille n'est pas verifiee.

## 8. Informations a fournir par le proprietaire

Obtenu le 2026-11-09 : acces SSH root par cle (deja utilise pour les
autres applications du serveur) ; serveur mesure : Ubuntu 26.04.1,
4 coeurs, 15 Go de RAM (8,2 Go disponibles), 85 Go de disque libres,
Docker 29.8, Compose 5.5, Caddy 2.11 en service systeme, ufw sur 22, 80 et
443. Le serveur heberge six autres applications, dont une pile Supabase
(GesPro) ; ports locaux deja pris : 3000, 3001, 3072, 5432, 8000, 8089,
8090, 8100, 8765. Domaine `sigtb.infranetgn.com` resolu vers le VPS.

Reste a fournir :

1. Serveur SMTP pour les courriels d'authentification (facultatif ; sans
   lui, pas de reinitialisation de mot de passe par courriel).
2. Emplacement des sauvegardes hors du VPS.

## 9. Journal du deploiement du 2026-11-09

Autorisation : proprietaire, 2026-11-09 (« vas-y etape par etape »).
Depot deploye : `main` 0ded569, depose dans `/opt/sigtb/depot/0ded569`.

| Etape | Resultat verifie |
|---|---|
| Installation (`installer.sh`) | 5 conteneurs `sigtb-*` en bonne sante ; seul port publie `127.0.0.1:8200` ; aucune nouvelle ecoute publique (toujours 22, 80, 443) ; `.env` en 600, secrets generes (aucune valeur par defaut), inscription publique desactivee |
| Migrations (`appliquer-migrations.sh --tests`) | 6 migrations appliquees et tracees ; 39 assertions RLS OK sur la base du serveur ; apres les tests : 0 utilisateur, 0 profil, 0 donnee metier, 209 lignes de droits, 0 politique `FOR ALL USING (true)` |
| Interface | Build de 0ded569 avec l'URL du VPS et la cle publique (seul JWT du bundle : `role: anon`), release `/opt/sigtb/web/releases/0ded569` |
| Caddy | Copie `Caddyfile.avant-sigtb-<horodatage>`, `import /etc/caddy/sigtb.caddy`, `caddy validate` puis `reload` ; certificat obtenu ; `app.`, `chantier360.`, `astra.` et `auth.infranetgn.com` toujours en ligne |
| Routes | `/` 200 ; `/auth/v1/*` et `/rest/v1/*` 401 sans cle ; `/functions/v1/geofence-monitor` et `/pg/*` 404 ; `/functions/v1/iot-ingestion` repond 401 sans identifiant de boitier |
| Ressources | Pile SIGTB environ 200 Mo de RAM ; fonctions limitees a 512 Mo |
| Sauvegarde | Cron `45 3 * * *` ; premier dump controle (lisible, empreinte sha256) dans `/opt/sigtb/sauvegardes`, conservation 14 jours |

Restent a faire :

1. Creation du premier administrateur par le proprietaire :
   `ssh root@<vps> bash /opt/sigtb/outils/creer-admin.sh`.
2. Copie des sauvegardes hors du VPS (emplacement a fournir).
3. SMTP (reinitialisation de mot de passe par courriel).
4. Constat nouveau : `iot-ingestion` lit le corps JSON avant de controler
   l'identifiant du boitier ; un appel sans corps renvoie 500 au lieu de
   401 (aucune ecriture). A corriger au LOT 08.
5. Tables encore absentes (`fuel_stations`, `fuel_anomalies` et les vues
   carburant, tables FleetOptimizer) : ecrans concernes en erreur jusqu'aux
   LOT 09 et 10.

Mise a jour : deposer la nouvelle version dans `/opt/sigtb/depot/<sha>`,
relancer `installer.sh` (sans effet sur les secrets ni les donnees) puis
`appliquer-migrations.sh --tests`, construire l'interface dans une
nouvelle release et basculer `current` ; retour arriere en rebasculant
`current` sur la release precedente.

## 10. Donnees de demonstration (D-020)

Commandes, en root sur le serveur, depuis `/opt/sigtb/depot/courant` :

| Commande | Effet |
|---|---|
| `bash deploy/vps/demo/demo.sh charger` | Charge le jeu (refuse s'il est deja present) et active le bandeau |
| `bash deploy/vps/demo/demo.sh recharger` | Purge puis recharge : les dates suivent le jour courant |
| `bash deploy/vps/demo/demo.sh purger` | Supprime tout le jeu et retire le bandeau |
| `bash deploy/vps/demo/demo.sh etat` | Nombre de lignes de demonstration par table |

Contenu : 4 sites, 2 shifts (06:00-18:00, 18:00-06:00), 24 semi-remorques
bennes (20 actifs, 2 en maintenance, 2 immobilises), 2 chargeuses
Caterpillar 980L, 1 pelle Caterpillar 374F, 22 chauffeurs aux noms fictifs,
6 rotations par camion et par jour sur 15 jours (mine vers stock tampon,
24 km), distributions de carburant quotidiennes et remplissages de cuve,
ordres de maintenance, 3 alertes, positions GPS des camions en route au
moment du chargement (elles quittent la carte apres 15 minutes). Chaque
voyage porte sa chargeuse ou la pelle et le journal de son cycle jusqu'a
l'heure du chargement (CDC 12). Objectifs de production du shift de jour
sur 15 jours, dont une revision motivee le jour du chargement (D-023).
Immobilisations (D-025) : 5 arrets en cours coherents avec le statut des
engins (dont la chargeuse CAT-980L-02, non utilisee par les voyages du
jour) et 12 arrets clos sur 14 jours, avec leur journal. Une
sauvegarde est prise avant chaque operation.

## 11. Journal des mises a jour

| Date | Version | Etapes | Resultat verifie |
|---|---|---|---|
| 2026-11-10 | `main` 32c1d89 (PR #32, cycle voyage) | depot `/opt/sigtb/depot/32c1d89` et lien `courant` ; `sauvegarder.sh` ; `appliquer-migrations.sh --tests` ; `demo.sh recharger` ; release `web/releases/32c1d89` et lien `current` (precedente : ce905ba) | Migration `20261110120000` appliquee, 83 assertions pgTAP OK sur la base du serveur ; demo : 1 800 voyages, 16 920 evenements, etat de chaque voyage = dernier evenement, aucune donnee reelle ; seul JWT du bundle `role: anon` ; `/` 200, `/rest/v1/*` 401 sans cle |
| 2026-11-10 | `main` 51db029 (PR #33 planification, #34 dispatch) | depot `/opt/sigtb/depot/51db029` ; `sauvegarder.sh` ; `appliquer-migrations.sh --tests` ; `demo.sh recharger` ; release `web/releases/51db029` (precedente : 32c1d89) | Migrations `20261110150000` et `20261110180000` appliquees, 118 assertions pgTAP OK sur la base du serveur ; 11 lignes de droits `planning` ; demo : 16 objectifs, objectif du jour revise (4 800 t), aucune donnee reelle ; seul JWT du bundle `role: anon` ; `/` 200, `/rest/v1/*` 401 sans cle |
| 2026-11-11 | `main` cda275a (PR #35 immobilisations, #36 contrats phase 1) | depot `/opt/sigtb/depot/cda275a` ; `sauvegarder.sh` ; `appliquer-migrations.sh --tests` ; `installer.sh` (fonction `admin-utilisateurs`) et redemarrage du seul conteneur `sigtb-functions` ; `demo.sh recharger` ; release `web/releases/cda275a` (precedente : 51db029) | Migrations `20261110210000` et `20261110230000` appliquees, 153 assertions pgTAP OK sur la base du serveur ; societe « Kogon Mining SARL » ; 21 droits `contract_manager` ; 5 immobilisations ouvertes coherentes avec le statut des engins ; seul JWT du bundle `role: anon` ; `/` 200, `/rest/v1/*` 401 sans cle |
| 2026-11-11 | `main` 16d6500 (PR #37 fiches terrain) | depot, `sauvegarder.sh`, `appliquer-migrations.sh --tests`, release `web/releases/16d6500` (precedente : cda275a) | Migration `20261111090000` appliquee ; 176 assertions pgTAP OK sur la base du serveur (dont 09 cycle voyage avec la nouvelle `avancer_voyage`) ; seul JWT du bundle `role: anon` |
| 2026-11-11 | `main` 50745b4 (PR #38 reconciliation et factures) | depot, `sauvegarder.sh`, `appliquer-migrations.sh --tests`, release `web/releases/50745b4` (precedente : 16d6500) | Migration `20261111120000` appliquee ; 15 fichiers pgTAP OK sur la base du serveur (200 assertions) ; seul JWT du bundle `role: anon` ; `/rest/v1/factures` 401 sans cle |
| 2026-11-11 | `main` af80816 (PR #39 remise a niveau D-030) | depot, `sauvegarder.sh`, `appliquer-migrations.sh --tests`, `installer.sh` et redemarrage de `sigtb-functions`, release `web/releases/af80816` (precedente : 50745b4) | Migrations `20261111150000` et `20261111160000` appliquees ; 16 fichiers pgTAP OK, le test 16 en echec sur une assertion agregee faussee par la demo d'octobre 2026 (corrige dans la PR suivante : periode 2001) ; `iot-ingestion` : 405 sur GET, 401 sans en-tetes, 403 boitier inconnu meme sans corps, 404 route inconnue ; seul JWT du bundle `role: anon` |

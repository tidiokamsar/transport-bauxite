# Guide de diagnostic

Public : administrateur système, équipe de développement. Sources : D-007,
D-015, D-017 ; `package.json`, `scripts/ci-locale.sh`,
`scripts/ci-qualite.sh`, `scripts/rejeu-migrations.sh`,
`.github/ci-baseline.env`, `playwright.config.ts`,
`deploy/vps/appliquer-migrations.sh`, `supabase/functions`.

## 1. CI locale (D-015)

GitHub Actions étant indisponible, la CI s'exécute sur le poste du
développeur ; son résultat figure dans la section Contrôles de chaque PR.

```bash
npm ci
npm run ci:locale              # complète : qualité, unitaires, build, E2E, rejeu RLS
bash scripts/ci-locale.sh --rapide   # qualité, unitaires et build seulement
```

| Étape | Commande lancée | Échoue si |
|---|---|---|
| Cliquet typecheck et lint | `bash scripts/ci-qualite.sh` | Erreurs typecheck au-dessus de `TSC_BASELINE`, au moins une erreur ESLint, ou avertissements ESLint au-dessus de `LINT_WARN_BASELINE` (`.github/ci-baseline.env`) |
| Tests unitaires | `npm test` (Vitest, `src/**/*.test.ts`) | Un test échoue |
| Build de production | `npm run build` | Le build échoue |
| Tests E2E | `npm run test:e2e` (Playwright, `e2e/`) | Un scénario échoue |
| Rejeu des migrations et tests RLS | `bash scripts/rejeu-migrations.sh --tests` | Une migration ne rejoue pas sur base vierge, ou une assertion pgTAP échoue |

Rapports :

- `test-results/ci-locale.txt` : résumé OK / ÉCHEC par étape, commit et
  branche ; mention « arbre de travail modifié, résultat non reproductible »
  si des fichiers ne sont pas commités ;
- `test-results/rejeu-migrations.txt` : une ligne OK ou ÉCHEC par
  migration, avec l'erreur.

Prérequis du mode complet : Docker (conteneur Postgres Supabase jetable)
et Chromium pour Playwright (`npx playwright install chromium`, une fois).

Détails utiles :

- Baselines du cliquet (au 2026-11-17) : 37 erreurs typecheck, 125
  avertissements lint, 0 erreur lint. On les baisse dans la PR qui réduit la
  dette, jamais on ne les remonte.
- Rejeu : `--garder` laisse le conteneur en place pour inspection (son nom
  est affiché) ; la variable `SIGTB_PG_IMAGE` change l'image Postgres.
- E2E : l'application est construite avec une URL Supabase locale et une
  clé factice, et les appels sont simulés (`e2e/api-simulee.ts`) : aucun
  test ne touche la production. `E2E_PORT` (5174 par défaut) et
  `E2E_OUT_DIR` (`dist-e2e`) permettent des exécutions parallèles ; le port
  est strict, un port occupé fait échouer le lancement.
- Tests pgTAP : `supabase/tests/database/*.test.sql` (39 fichiers au
  commit `3d98254`). Quand un résultat agrégé dépend des données présentes
  (démonstration), le test utilise une période vide (année 2001).

## 2. Codes d'erreur du serveur

Les fonctions serveur lèvent des erreurs avec un code SQLSTATE ; l'écran
affiche le message tel quel (sans accents).

| Code | Sens | Exemples de messages | Que faire |
|---|---|---|---|
| `42501` | Droit insuffisant, périmètre ou séparation des tâches | « Droit d'ecriture sur les voyages requis », « Hors perimetre : engin d'un autre site », « La decision revient a une autre personne que l'auteur de la saisie », « Seul le Directeur General signe les factures », « Confirmation en deux etapes (MFA) requise pour cette operation » | Vérifier rôle, attribution spécifique, statut et site du compte ; faire décider par une autre personne ; se reconnecter avec le code TOTP |
| `22023` | Règle métier non respectée (valeur invalide, état incompatible, motif manquant) | « Motif obligatoire ... », « Transition non autorisee : ... », « Heure ... dans le futur », « Stock insuffisant ... », « Depart refuse : ... » | Corriger la saisie ou l'ordre des opérations ; c'est la règle, pas une panne |
| `P0002` | Élément introuvable | « Voyage introuvable », « Immobilisation ouverte introuvable », « Fiche introuvable » | Recharger l'écran : l'élément a pu changer d'état ou être hors périmètre |
| `23505` | Doublon | « Ticket de pesee ... deja utilise sur un autre voyage », « Pneu ... deja enregistre » | Vérifier le numéro saisi |
| `23503` | Référence inconnue | « Utilisateur inconnu » (attribution de droits) | Vérifier le compte visé |

Messages de PostgreSQL pour une écriture directe dans une table :

- « new row violates row-level security policy for table ... » : la
  politique RLS refuse l'écriture (droit ou périmètre) ;
- « permission denied for table ... » : l'écriture directe n'est pas
  permise, elle passe par une fonction serveur.

Réponses des fonctions publiées :

| Fonction | Réponses |
|---|---|
| `admin-utilisateurs` | 405 hors POST ; 401 sans jeton ; 403 si l'appelant n'est pas un administrateur actif ; 400 requête ou donnée invalide (e-mail, nom, rôle, mot de passe de moins de 12 caractères) ; 409 adresse déjà utilisée ; 201 compte créé |
| `iot-ingestion` | 405 hors POST ; 404 route inconnue ; 401 sans identifiant (`X-Device-Id`) ou clé (`X-Api-Key`) ; 403 boîtier inconnu ou inactif ; 400 corps absent ou invalide |

## 3. Lecture des journaux

### Sur le serveur (root)

```bash
cd /opt/sigtb/pile && docker compose ps          # état et santé des services
docker logs --since 1h sigtb-rest                 # API de données
docker logs --since 1h sigtb-auth                 # connexion, double authentification
docker logs --since 1h sigtb-functions            # iot-ingestion, admin-utilisateurs
docker logs --since 1h sigtb-db                   # base
docker logs --since 1h sigtb-envoy                # passerelle
journalctl -u caddy --since "1 hour ago"          # Caddy (service système)
tail -n 50 /var/log/sigtb-sauvegarde.log          # sauvegardes
```

Migrations appliquées :

```bash
docker exec sigtb-db psql -U supabase_admin -d postgres -X -tA \
  -c "select version, name from supabase_migrations.schema_migrations order by version"
```

Sortie de `appliquer-migrations.sh --tests` : « Application de <fichier> »
pour chaque migration, « Migrations appliquees : N », puis par test
« OK <fichier> : N assertions » ou « ECHEC <fichier> » suivi des lignes en
erreur. Le code de sortie est non nul en cas d'échec.

### Dans l'application (traçabilité métier)

Les journaux métier sont des tables, lisibles selon les droits du module :
`trip_events` (cycle des voyages), `decisions_dispatch`,
`immobilisations_journal`, `journal_contrats`, `factures_journal`,
`journal_droits_modules` (administrateur), `mouvements_carburant`,
`stock_movements`, `pneus_operations`, `achats_journal`,
`interventions_journal`, `postes_evenements`,
`rectifications_tickets_pesee_cbg`. Chaque ligne porte l'auteur et
l'heure ; elles servent à reconstituer qui a fait quoi.

## 4. Situations fréquentes

| Symptôme | Cause probable | Vérification |
|---|---|---|
| Une entrée du menu manque | Pas de droit de lecture sur le module | Paramètres > Utilisateurs, droits effectifs du compte |
| Liste vide alors que des données existent | Périmètre site du compte, site sélectionné dans le menu, ou compte non actif | Site du profil, sélecteur de site, statut |
| Boutons de saisie absents | Lecture seule sur le module | Droits effectifs ; recharger après un changement de droits |
| « Transition non autorisee » | Étape sautée dans le cycle du voyage | Journal du voyage (« Chronologie » dans la fiche du voyage) |
| Écran en erreur après une mise à jour | Schéma non relu par l'API ou migration non appliquée | Liste des migrations appliquées ; `appliquer-migrations.sh` envoie `NOTIFY pgrst, 'reload schema'` |
| Échec du rejeu en local | Docker absent ou migration qui ne rejoue pas | `test-results/rejeu-migrations.txt` ; `--garder` pour inspecter |
| Échec du cliquet | Nouvelle erreur typecheck ou lint | Sortie de `scripts/ci-qualite.sh` |

## Limites connues

- Pas de CI hébergée ni de supervision automatique : la surveillance des
  services et des sauvegardes se fait par les commandes ci-dessus.
- 37 erreurs typecheck restent tolérées par le cliquet (dette héritée).
- Pas de journal applicatif centralisé : les traces sont dans les tables
  métier et les journaux des conteneurs.

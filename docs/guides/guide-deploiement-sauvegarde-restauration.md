# Guide de déploiement, sauvegarde et restauration

Public : administrateur système du serveur SIGTB. Sources :
`docs/SIGTB_2.0_HEBERGEMENT_VPS.md` (sections 6, 9, 10, 11), D-015 à
D-017, D-020 ; scripts `deploy/vps/installer.sh`,
`deploy/vps/appliquer-migrations.sh`, `deploy/vps/sauvegarder.sh`,
`deploy/vps/creer-admin.sh`, `deploy/vps/demo/demo.sh`,
`deploy/vps/sigtb.caddy`, `deploy/vps/docker-compose.yml`.

Règle du projet : aucun déploiement ni modification des données de
production sans autorisation explicite du propriétaire. Ne pas confondre
fusionné, testé, validé et déployé : chaque mise à jour est consignée dans
le journal (`SIGTB_2.0_HEBERGEMENT_VPS.md`, section 11) et dans
`docs/SIGTB_RELEASE_NOTES.md`.

## 1. Architecture sur le serveur

Application publiée sous https://sigtb.infranetgn.com, sur un serveur
partagé avec d'autres applications.

| Élément | Détail |
|---|---|
| Pile Supabase auto-hébergée (D-016) | Modèle officiel au tag `self-hosted/v0.8.4`, pile réduite : services `db` (`sigtb-db`), `auth` (`sigtb-auth`), `rest` (`sigtb-rest`), `functions` (`sigtb-functions`), `api-gw` (`sigtb-envoy`). Realtime, Storage et imgproxy retirés. |
| Port | Un seul port publié, local au serveur (8200), jamais exposé à l'extérieur. |
| Caddy | Le Caddy du serveur importe `/etc/caddy/sigtb.caddy` : HTTPS, interface, et seules les routes `/auth/v1`, `/rest/v1`, `/functions/v1/iot-ingestion` et `/functions/v1/admin-utilisateurs` relayées ; les autres routes de la passerelle répondent 404. |
| Fonctions déployées | `iot-ingestion`, `admin-utilisateurs`. `geofence-monitor` n'est pas déployée (constat N3). |

Arborescence (`installer.sh`) :

| Chemin | Contenu |
|---|---|
| `/opt/sigtb/officiel` | Modèle officiel Supabase, tag figé (lecture seule) |
| `/opt/sigtb/pile` | `docker-compose.yml`, `.env` (droits 600, jamais affiché), volumes |
| `/opt/sigtb/web/releases/<sha>` | Une release de l'interface par commit |
| `/opt/sigtb/web/current` | Lien vers la release servie |
| `/opt/sigtb/sauvegardes` | Sauvegardes (droits 700) |
| `/opt/sigtb/depot/<sha>`, lien `courant` | Copies du dépôt déployées |
| `/opt/sigtb/outils` | Scripts appelés par le cron et par `demo.sh` (`sauvegarder.sh`, `creer-admin.sh`) |

Règles sur ce serveur partagé :

- ne jamais redémarrer Caddy (`caddy validate` puis `systemctl reload
  caddy` seulement) ni les autres piles ;
- aucun port publié hors de l'interface locale (Docker contourne `ufw`) ;
- ne jamais afficher ni copier le contenu de `/opt/sigtb/pile/.env`.

## 2. Installation initiale

Tout s'exécute en root sur le serveur, depuis une copie du dépôt.

| Étape | Commande | Effet |
|---|---|---|
| 1 | `bash deploy/vps/installer.sh` | Modèle officiel au tag figé, pile réduite, secrets générés sur place (inscription publique désactivée), démarrage. Idempotent : ne régénère jamais un `.env` existant, ne remplace jamais un volume de données. |
| 2 | `bash deploy/vps/appliquer-migrations.sh --tests` | Migrations du dépôt dans l'ordre, chacune dans sa transaction, arrêt au premier échec, traçage dans `supabase_migrations.schema_migrations` ; puis tests pgTAP, chacun dans une transaction annulée (aucune donnée ne reste). |
| 3 | Build de l'interface (section 3.6), dépôt dans `/opt/sigtb/web/releases/<sha>`, lien `current` | Interface servie par Caddy |
| 4 | Copie de `deploy/vps/sigtb.caddy` dans `/etc/caddy/`, sauvegarde du Caddyfile, ligne `import /etc/caddy/sigtb.caddy`, `caddy validate`, `systemctl reload caddy` | HTTPS sur `sigtb.infranetgn.com` |
| 5 | `bash /opt/sigtb/outils/creer-admin.sh` (par le propriétaire) | Premier administrateur : e-mail, nom, mot de passe saisi sans écho (12 caractères minimum) |
| 6 | Cron `45 3 * * * /opt/sigtb/outils/sauvegarder.sh >> /var/log/sigtb-sauvegarde.log 2>&1` | Sauvegarde quotidienne |

## 3. Mise à jour

Procédure suivie à chaque déploiement du journal (section 11 de
`SIGTB_2.0_HEBERGEMENT_VPS.md`) :

1. **Autorisation** du propriétaire pour cette version.
2. **Déposer** la version dans `/opt/sigtb/depot/<sha>` et faire pointer le
   lien `courant` dessus.
3. **Sauvegarder** : `/opt/sigtb/outils/sauvegarder.sh` ; noter le nom du
   fichier produit (`sigtb-<horodatage>.dump`).
4. **Fonctions** : si `supabase/functions/iot-ingestion` ou
   `admin-utilisateurs` a changé, relancer `bash deploy/vps/installer.sh`
   (sans effet sur les secrets ni les données) et redémarrer le seul
   conteneur `sigtb-functions`.
5. **Migrations** : `bash deploy/vps/appliquer-migrations.sh --tests`.
   Chaque fichier passe ou rien n'est écrit pour lui ; le script s'arrête
   au premier échec. Tous les tests pgTAP doivent être « OK ».
6. **Interface** : construire avec l'URL publique et la clé publique du
   serveur, puis déposer la release. Forme standard (la commande exacte de
   build n'est pas versionnée dans le dépôt) :

   ```bash
   npm ci
   VITE_SUPABASE_URL=https://sigtb.infranetgn.com \
   VITE_SUPABASE_ANON_KEY="$(grep '^ANON_KEY=' /opt/sigtb/pile/.env | cut -d= -f2-)" \
   npm run build
   mkdir -p /opt/sigtb/web/releases/<sha>
   cp -r dist/. /opt/sigtb/web/releases/<sha>/
   ln -sfn /opt/sigtb/web/releases/<sha> /opt/sigtb/web/current
   ```

   Seule la clé publique (`ANON_KEY`, `role: anon`) entre dans le bundle ;
   ne jamais utiliser une autre clé du `.env`.
7. **Données de démonstration** (seulement tant qu'elles sont chargées) :
   `bash deploy/vps/demo/demo.sh recharger`.
8. **Contrôles**, comme dans le journal : `/` répond 200 ; `/rest/v1/...`
   répond 401 sans clé ; le bundle servi est identique au bundle construit
   et ne contient que le jeton `role: anon` ; nombre de fichiers pgTAP OK.
9. **Consigner** la mise à jour (version, sauvegarde, migrations, release
   précédente, contrôles) dans le journal et dans les notes de version.

## 4. Sauvegarde

Script `deploy/vps/sauvegarder.sh`, lancé chaque nuit à 03:45 par le cron :

- dump complet de la base (`pg_dump -Fc`, schémas `public` et `auth`
  compris) dans `/opt/sigtb/sauvegardes/sigtb-<AAAAMMJJTHHMMSSZ>.dump`,
  fichiers créés en droits restreints ;
- empreinte `sha256` dans `<fichier>.dump.sha256` ;
- contrôle de lisibilité (`pg_restore --list`), sans restauration ;
- suppression des sauvegardes de plus de 14 jours ;
- trace dans `/var/log/sigtb-sauvegarde.log`.

Une sauvegarde est aussi prise avant chaque mise à jour (section 3) et
avant chaque opération de `demo.sh`.

Vérifier une sauvegarde :

```bash
ls -l /opt/sigtb/sauvegardes/
sha256sum -c /opt/sigtb/sauvegardes/sigtb-<horodatage>.dump.sha256
tail -n 20 /var/log/sigtb-sauvegarde.log
```

## 5. Restauration d'une sauvegarde

> **Procédure testée le 2026-11-15** avec le script `deploy/vps/tester-restauration.sh` :
> - la sauvegarde `sigtb-20261115T224535Z.dump`, prise par `sauvegarder.sh`, a été restaurée dans un conteneur jetable de la même image que la production, sans réseau ;
> - l'empreinte sha256 était valide et la restauration a pris 4 s ;
> - les comptages sont identiques à la production : 50 migrations, 3 comptes, 27 engins, 1 813 voyages, 18 026 événements de voyage, 277 politiques d'accès, 289 fonctions.
>
> `pg_restore` signale 7 erreurs, toutes « role supabase_functions_admin does not exist ». Ce rôle est créé par la pile complète, pas par une image nue. Ces erreurs ne concernent que la propriété de quelques objets, aucune donnée. Dans le conteneur `sigtb-db` de la pile, ce rôle existe.
>
> Un premier essai sur la sauvegarde prise juste avant un déploiement montrait une migration de moins, et donc moins de politiques et de fonctions. C'est le comportement attendu : `deployer` sauvegarde avant d'appliquer les migrations.

Une restauration remet la base à l'état du dump : toute saisie postérieure
est perdue. Elle exige l'autorisation explicite du propriétaire.

### Étape 1 : choisir et vérifier le fichier

```bash
DUMP=/opt/sigtb/sauvegardes/sigtb-<horodatage>.dump
sha256sum -c "$DUMP.sha256"
docker exec -i sigtb-db pg_restore --list < "$DUMP" > /dev/null && echo "dump lisible"
```

### Étape 2 : test dans un conteneur jetable (sans effet sur la production)

Script versionné `deploy/vps/tester-restauration.sh`, à lancer sur le serveur
(`bash tester-restauration.sh`). Il restaure la dernière sauvegarde dans un
conteneur de la même image, sans réseau, compare les comptages avec la
production (lecture seule), puis détruit le conteneur. Pour tester une autre
sauvegarde que la dernière, adapter la variable `DUMP` en tête du script.

Consigner le résultat (erreurs éventuelles, comptages) avant de passer à
l'étape 3.

### Étape 3 : restauration en production

```bash
# 3.1 Sauvegarder l'état actuel, même dégradé
/opt/sigtb/outils/sauvegarder.sh

# 3.2 Arrêter les services qui écrivent (la base reste démarrée)
cd /opt/sigtb/pile
docker compose stop api-gw functions rest auth

# 3.3 Restaurer en une seule transaction : en cas d'erreur, rien n'est modifié
docker exec -i sigtb-db pg_restore -U supabase_admin -d postgres \
  --clean --if-exists --single-transaction --exit-on-error \
  -n public -n auth -n supabase_migrations < "$DUMP"

# 3.4 Redémarrer et faire relire le schéma à l'API
docker compose start auth rest functions api-gw
docker exec sigtb-db psql -U supabase_admin -d postgres -X -c "NOTIFY pgrst, 'reload schema'"

# 3.5 Réappliquer les migrations postérieures au dump et lancer les tests
bash /opt/sigtb/depot/courant/deploy/vps/appliquer-migrations.sh --tests
```

### Étape 4 : contrôles après restauration

- `docker compose ps` : tous les services en bonne santé ;
- `/` répond 200, `/rest/v1/...` 401 sans clé ;
- connexion d'un administrateur ;
- comptages des tables principales cohérents avec ceux relevés à l'étape 2 ;
- consigner la restauration (fichier, heure, raison, résultat) dans le
  journal du serveur.

## 6. Retour arrière d'une release web

Chaque release reste dans `/opt/sigtb/web/releases/<sha>` ; le journal
indique la release précédente de chaque mise à jour. Pour revenir en
arrière, rebasculer le lien `current` :

```bash
readlink /opt/sigtb/web/current          # release servie
ls -1t /opt/sigtb/web/releases/          # releases disponibles
ln -sfn /opt/sigtb/web/releases/<sha_precedent> /opt/sigtb/web/current
```

Caddy sert le contenu de `current` à chaque requête et `index.html` n'est
pas mis en cache ; vérifier ensuite que `/` sert bien l'ancien bundle.

Ce retour arrière ne touche pas la base. Les migrations ne se défont pas :
il n'existe aucune migration descendante. Si une ancienne interface
n'est pas compatible avec le schéma courant, le seul retour arrière de la
base est la restauration de la sauvegarde prise avant la mise à jour
(section 5), avec perte des saisies postérieures.

## 7. Données de démonstration (D-020)

En root, depuis `/opt/sigtb/depot/courant` (sauvegarde automatique avant
chaque opération) :

| Commande | Effet |
|---|---|
| `bash deploy/vps/demo/demo.sh charger` | Charge le jeu (refusé s'il est déjà présent) et active le bandeau |
| `bash deploy/vps/demo/demo.sh recharger` | Purge puis recharge, dates du jour |
| `bash deploy/vps/demo/demo.sh purger` | Supprime tout le jeu et retire le bandeau |
| `bash deploy/vps/demo/demo.sh etat` | Nombre de lignes de démonstration par table |

La purge est obligatoire avant la première saisie réelle : une donnée
réelle rattachée à un élément de démonstration bloque la purge.

## Limites connues

- Aucune procédure de restauration testée dans le dépôt : la section 5 est
  à valider par un test de restauration.
- Copie des sauvegardes hors du serveur non organisée : l'emplacement reste
  à fournir par le propriétaire (`SIGTB_2.0_HEBERGEMENT_VPS.md`, section
  8). Les sauvegardes ne sont pas chiffrées par le script, alors que
  l'architecture cible prévoit un dump chiffré.
- Aucun script du dépôt ne copie `sauvegarder.sh` et `creer-admin.sh` dans
  `/opt/sigtb/outils/` : cette copie se fait à la main et doit être refaite
  quand ces scripts changent.
- La commande exacte de build et de dépôt de la release web n'est pas
  versionnée (section 3, étape 6, forme standard).
- Pas de CI hébergée : la CI tourne en local (D-015, voir le guide de
  diagnostic).
- Pas de serveur SMTP : pas de courriel de réinitialisation de mot de passe.

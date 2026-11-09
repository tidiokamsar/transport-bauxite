#!/usr/bin/env bash
# Installation de la pile SIGTB sur le VPS (D-016). A executer en root sur
# le serveur, depuis une copie du depot : bash deploy/vps/installer.sh
#
# Idempotent : ne regenere jamais un .env existant, ne remplace jamais un
# volume de donnees, relance seulement `docker compose up -d`.
# N'affiche aucun secret.
#
# Arborescence creee :
#   /opt/sigtb/officiel   modele officiel Supabase, tag fige (lecture seule)
#   /opt/sigtb/pile       docker-compose.yml, .env (600), volumes/
#   /opt/sigtb/web        interface (releases/<sha>, lien current)
#   /opt/sigtb/sauvegardes
set -euo pipefail

DEPOT="$(cd "$(dirname "$0")/../.." && pwd)"
BASE=/opt/sigtb
TAG=self-hosted/v0.8.4
DOMAINE=sigtb.infranetgn.com
OFFICIEL="$BASE/officiel"
PILE="$BASE/pile"

mkdir -p "$BASE" "$PILE" "$BASE/web/releases" "$BASE/sauvegardes"
chmod 700 "$PILE" "$BASE/sauvegardes"

# 1. Modele officiel au tag fige.
if [ ! -d "$OFFICIEL/docker" ]; then
  git clone -q --depth 1 --filter=blob:none --no-checkout --branch "$TAG" \
    https://github.com/supabase/supabase "$OFFICIEL"
  git -C "$OFFICIEL" sparse-checkout set docker
  git -C "$OFFICIEL" checkout -q
fi
echo "Modele officiel : $TAG ($(git -C "$OFFICIEL" rev-parse --short HEAD))"

# 2. Fichiers de configuration (jamais les donnees).
cp "$DEPOT/deploy/vps/docker-compose.yml" "$PILE/docker-compose.yml"
mkdir -p "$PILE/volumes/api" "$PILE/volumes/db" "$PILE/volumes/functions"
cp -r "$OFFICIEL/docker/volumes/api/envoy" "$PILE/volumes/api/"
for f in realtime.sql webhooks.sql roles.sql jwt.sql _supabase.sql logs.sql pooler.sql; do
  cp "$OFFICIEL/docker/volumes/db/$f" "$PILE/volumes/db/$f"
done
cp -r "$OFFICIEL/docker/volumes/functions/main" "$PILE/volumes/functions/"
cp "$OFFICIEL/docker/volumes/functions/deno.jsonc" "$PILE/volumes/functions/"
# Fonctions deployees : iot-ingestion et admin-utilisateurs (D-021).
# geofence-monitor n'est pas deployee tant que son appelant n'est pas
# controle (constat N3).
for fonction in iot-ingestion admin-utilisateurs; do
  rm -rf "$PILE/volumes/functions/$fonction"
  cp -r "$DEPOT/supabase/functions/$fonction" "$PILE/volumes/functions/"
done

# 3. Secrets, generes une seule fois sur le serveur.
if [ ! -f "$PILE/.env" ]; then
  cp "$OFFICIEL/docker/.env.example" "$PILE/.env"
  chmod 600 "$PILE/.env"
  ( cd "$PILE" && sh "$OFFICIEL/docker/utils/generate-keys.sh" --update-env >/dev/null )
  rm -f "$PILE/.env.old"
  regler() { sed -i "s|^$1=.*$|$1=$2|" "$PILE/.env"; grep -q "^$1=" "$PILE/.env" || echo "$1=$2" >> "$PILE/.env"; }
  regler SUPABASE_PUBLIC_URL "https://$DOMAINE"
  regler API_EXTERNAL_URL "https://$DOMAINE/auth/v1"
  regler SITE_URL "https://$DOMAINE"
  regler ADDITIONAL_REDIRECT_URLS ""
  regler DISABLE_SIGNUP true
  regler ENABLE_ANONYMOUS_USERS false
  regler ENABLE_PHONE_SIGNUP false
  regler ENABLE_PHONE_AUTOCONFIRM false
  regler FUNCTIONS_VERIFY_JWT false
  regler PGRST_DB_SCHEMAS public
  regler SIGTB_API_PORT 8200
  echo "Secrets generes dans $PILE/.env (600), non affiches."
else
  echo "Secrets existants conserves ($PILE/.env)."
fi
chmod 600 "$PILE/.env"

# 4. Demarrage.
cd "$PILE"
docker compose up -d --remove-orphans
for _ in $(seq 1 60); do
  etat=$(docker compose ps --format '{{.Service}}={{.Health}}' | sort | tr '\n' ' ')
  if ! grep -qE '=(starting|unhealthy)' <<< "$etat" && grep -q 'api-gw=healthy' <<< "$etat"; then
    break
  fi
  sleep 5
done
docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'

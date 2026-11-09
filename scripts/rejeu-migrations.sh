#!/usr/bin/env bash
# Rejeu des migrations sur une base vierge et tests RLS pgTAP (LOT 01, P4).
#
# Depuis D-017, supabase/migrations commence par la base de reference
# (20260903000000_base_reference.sql, generee par
# scripts/construire-base-reference.sh) ; les migrations Bolt sont
# archivees dans supabase/migrations_bolt_archive. Toutes les migrations
# doivent rejouer : un echec fait echouer le script. Ce script les applique
# une a une, chacune dans sa transaction, dans un conteneur Postgres
# Supabase jetable, comme deploy/vps/appliquer-migrations.sh sur le VPS.
#
# Usage : bash scripts/rejeu-migrations.sh [--tests] [--garder]
#   --tests   lance aussi supabase/tests/database/*.test.sql (pgTAP)
#   --garder  laisse le conteneur en place (nom affiche) pour inspection
set -uo pipefail

cd "$(dirname "$0")/.."

IMAGE="${SIGTB_PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.106}"
NOM="sigtb-rejeu-$$"
LISTE_CONNUS="supabase/tests/echecs-connus.txt"  # absent depuis D-017 : aucun echec admis
RAPPORT="test-results/rejeu-migrations.txt"
TESTS=0
GARDER=0
for arg in "$@"; do
  case "$arg" in
    --tests) TESTS=1 ;;
    --garder) GARDER=1 ;;
    *) echo "Option inconnue : $arg" >&2; exit 2 ;;
  esac
done

# Git Bash (Windows) convertit les chemins /... passes a docker.
export MSYS_NO_PATHCONV=1

nettoyer() {
  if [ "$GARDER" -eq 1 ]; then
    echo "Conteneur conserve : $NOM (docker rm -f $NOM pour le supprimer)"
  else
    docker rm -f "$NOM" >/dev/null 2>&1 || true
  fi
}
trap nettoyer EXIT

psql_admin() { docker exec "$NOM" psql -U supabase_admin -h localhost -d postgres "$@"; }

echo "Image : $IMAGE"
docker run -d --name "$NOM" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null || exit 1

# pg_isready repond pendant les scripts d'initialisation de l'image ;
# on attend que le serveur definitif accepte une requete sur TCP.
for _ in $(seq 1 90); do
  if docker exec "$NOM" psql -U postgres -h localhost -d postgres -tAc \
       "select 1 from pg_roles where rolname = 'authenticated'" 2>/dev/null | grep -q 1; then
    break
  fi
  sleep 2
done
sleep 3

docker exec "$NOM" mkdir -p /rejeu
docker cp supabase/migrations "$NOM":/rejeu/migrations >/dev/null
docker cp supabase/tests "$NOM":/rejeu/tests >/dev/null

mkdir -p test-results
: > "$RAPPORT"
OK=0
ECHECS=()
for chemin in $(ls supabase/migrations/*.sql | sort); do
  f=$(basename "$chemin")
  erreur=$(psql_admin -q -1 -v ON_ERROR_STOP=1 -f "/rejeu/migrations/$f" 2>&1 >/dev/null \
    | grep -m1 "ERROR" | sed 's/^psql:[^ ]* //')
  if [ -n "$erreur" ]; then
    ECHECS+=("$f")
    echo "ECHEC $f | $erreur" >> "$RAPPORT"
  else
    OK=$((OK + 1))
    echo "OK    $f" >> "$RAPPORT"
  fi
done

echo "Migrations : $OK passent, ${#ECHECS[@]} echouent (detail : $RAPPORT)"

STATUT=0
CONNUS=""
[ -f "$LISTE_CONNUS" ] && CONNUS=$(grep -v '^\s*#' "$LISTE_CONNUS" | grep -v '^\s*$' || true)
for f in "${ECHECS[@]}"; do
  if ! grep -qxF "$f" <<< "$CONNUS"; then
    echo "::error::Echec non attendu : $f ($(grep -F "ECHEC $f" "$RAPPORT" | cut -d'|' -f2-))"
    STATUT=1
  fi
done
while read -r f; do
  [ -z "$f" ] && continue
  if ! printf '%s\n' "${ECHECS[@]}" | grep -qxF "$f"; then
    echo "::notice::$f passe desormais : la retirer de $LISTE_CONNUS."
  fi
done <<< "$CONNUS"

if [ "$TESTS" -eq 1 ]; then
  for t in supabase/tests/database/*.test.sql; do
    sortie=$(docker exec "$NOM" psql -U postgres -h localhost -d postgres -X -q -t \
      -f "/rejeu/tests/database/$(basename "$t")" 2>&1)
    nb_ok=$(grep -cE '^\s*ok [0-9]+' <<< "$sortie" || true)
    if grep -qE '^\s*not ok|ERROR|# Looks like' <<< "$sortie"; then
      echo "::error::$(basename "$t") : echec"
      grep -E '^\s*not ok|^\s*#|ERROR' <<< "$sortie" | sed 's/^/    /'
      STATUT=1
    else
      echo "Tests $(basename "$t") : $nb_ok assertions OK"
    fi
  done
fi

exit "$STATUT"

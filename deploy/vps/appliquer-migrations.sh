#!/usr/bin/env bash
# Applique les migrations du depot a la base SIGTB du VPS (D-017).
# Usage (root, sur le serveur) : bash deploy/vps/appliquer-migrations.sh [--tests]
#
# Chaque fichier de supabase/migrations non encore applique est execute
# dans sa propre transaction (arret au premier echec), puis enregistre dans
# supabase_migrations.schema_migrations, la table utilisee par la CLI
# Supabase. --tests lance ensuite les tests pgTAP (chacun dans une
# transaction annulee : aucune donnee ne reste).
set -euo pipefail

DEPOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTENEUR=sigtb-db
TESTS=0
[ "${1:-}" = "--tests" ] && TESTS=1

psql_admin() { docker exec -i "$CONTENEUR" psql -U supabase_admin -d postgres -X -q "$@"; }

psql_admin -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
SQL

docker exec "$CONTENEUR" rm -rf /tmp/sigtb
docker exec "$CONTENEUR" mkdir -p /tmp/sigtb
docker cp "$DEPOT/supabase/migrations" "$CONTENEUR":/tmp/sigtb/migrations >/dev/null
docker cp "$DEPOT/supabase/tests" "$CONTENEUR":/tmp/sigtb/tests >/dev/null

APPLIQUEES=0
for chemin in $(ls "$DEPOT"/supabase/migrations/*.sql | sort); do
  f=$(basename "$chemin")
  version=${f%%_*}
  nom=${f#*_}; nom=${nom%.sql}
  deja=$(psql_admin -tA -c "select 1 from supabase_migrations.schema_migrations where version = '$version'")
  [ "$deja" = "1" ] && continue
  echo "Application de $f"
  psql_admin -1 -v ON_ERROR_STOP=1 -f "/tmp/sigtb/migrations/$f" >/dev/null
  psql_admin -v ON_ERROR_STOP=1 -c \
    "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$nom')"
  APPLIQUEES=$((APPLIQUEES + 1))
done
echo "Migrations appliquees : $APPLIQUEES"

# PostgREST relit le schema.
psql_admin -c "NOTIFY pgrst, 'reload schema'" >/dev/null

if [ "$TESTS" -eq 1 ]; then
  STATUT=0
  for t in "$DEPOT"/supabase/tests/database/*.test.sql; do
    n=$(basename "$t")
    sortie=$(docker exec "$CONTENEUR" psql -U postgres -d postgres -X -q -t -f "/tmp/sigtb/tests/database/$n" 2>&1 || true)
    if grep -qE '^\s*not ok|ERROR|# Looks like' <<< "$sortie"; then
      echo "ECHEC $n"; grep -E '^\s*not ok|^\s*#|ERROR' <<< "$sortie" | sed 's/^/    /'; STATUT=1
    else
      echo "OK    $n : $(grep -cE '^\s*ok [0-9]+' <<< "$sortie") assertions"
    fi
  done
  exit "$STATUT"
fi

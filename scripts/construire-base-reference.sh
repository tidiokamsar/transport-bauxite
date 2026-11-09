#!/usr/bin/env bash
# Construction de la migration de base de reference (D-017).
#
# Rejoue les migrations Bolt archivees (supabase/migrations_bolt_archive),
# une par une, dans un conteneur Postgres Supabase jetable ; celles de
# echecs-connus.txt echouent et sont ignorees. Puis exporte :
#  - le schema `public` seul (aucune donnee) ;
#  - les donnees de reference de `role_permissions` (matrice des droits,
#    indispensable a has_module_write et a la migration D-012).
# Aucune autre donnee n'est exportee : les seeds de demonstration Bolt
# ne vont jamais en production (regle 1).
#
# Sortie : supabase/migrations/20260903000000_base_reference.sql, a
# relire puis committer. L'horodatage precede la Tranche 0 (20260903090000)
# pour que les migrations 2026 s'appliquent ensuite telles qu'elles ont ete
# testees.
#
# Usage : bash scripts/construire-base-reference.sh
set -uo pipefail

cd "$(dirname "$0")/.."

IMAGE="${SIGTB_PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.106}"
NOM="sigtb-base-$$"
ARCHIVE="supabase/migrations_bolt_archive"
SORTIE="supabase/migrations/20260903000000_base_reference.sql"
export MSYS_NO_PATHCONV=1

trap 'docker rm -f "$NOM" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$NOM" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null || exit 1
for _ in $(seq 1 90); do
  if docker exec "$NOM" psql -U postgres -h localhost -d postgres -tAc \
       "select 1 from pg_roles where rolname = 'authenticated'" 2>/dev/null | grep -q 1; then
    break
  fi
  sleep 2
done
sleep 3

docker exec "$NOM" mkdir -p /base
docker cp "$ARCHIVE" "$NOM":/base/archive >/dev/null

OK=0; KO=0
for chemin in $(ls "$ARCHIVE"/*.sql | sort); do
  f=$(basename "$chemin")
  if docker exec "$NOM" psql -U supabase_admin -h localhost -d postgres -q -1 \
       -v ON_ERROR_STOP=1 -f "/base/archive/$f" >/dev/null 2>&1; then
    OK=$((OK + 1))
  else
    KO=$((KO + 1))
    grep -qxF "$f" "$ARCHIVE/echecs-connus.txt" \
      || echo "::warning::echec non repertorie : $f"
  fi
done
echo "Migrations Bolt rejouees : $OK passent, $KO echouent"

SCHEMA=$(docker exec "$NOM" pg_dump -U postgres -h localhost -d postgres \
  --schema-only --schema=public --no-owner < /dev/null) || exit 1
DONNEES=$(docker exec "$NOM" pg_dump -U postgres -h localhost -d postgres \
  --data-only --table=public.role_permissions --inserts --no-owner < /dev/null) || exit 1

nettoyer_dump() {
  # Les meta-commandes psql (\restrict, \unrestrict) ne passent pas par
  # `supabase db push` ; le schema public existe deja dans toute base
  # Supabase ; le search_path vide du dump est retabli en fin de fichier.
  grep -vE '^\\(restrict|unrestrict) ' \
    | grep -vE '^CREATE SCHEMA public;$' \
    | grep -vE '^COMMENT ON SCHEMA public IS' \
    | grep -vE '^-- Dumped (from|by) '
}

{
  cat <<'EOF'
/*
  # Base de reference SIGTB (D-017)

  Genere par scripts/construire-base-reference.sh a partir des migrations
  Bolt archivees (supabase/migrations_bolt_archive) qui rejouent sur base
  vierge. Ne pas modifier a la main : regenerer.

  Contenu : schema `public` (tables, fonctions, vues, politiques RLS,
  droits) et donnees de reference de `role_permissions`. Aucune donnee de
  demonstration (regle 1).

  Les migrations 2026 (Tranche 0, N4, D-012) s'appliquent ensuite.
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

EOF
  printf '%s\n' "$SCHEMA" | nettoyer_dump
  printf '\n-- Donnees de reference : matrice role x module\n'
  printf '%s\n' "$DONNEES" | nettoyer_dump | grep -vE '^SELECT pg_catalog.set_config'
  printf "\nSELECT pg_catalog.set_config('search_path', 'public', false);\n"
} > "$SORTIE"

echo "Ecrit : $SORTIE ($(wc -l < "$SORTIE") lignes, $(grep -c '^CREATE TABLE' "$SORTIE") tables, $(grep -c '^CREATE POLICY' "$SORTIE") politiques, $(grep -c '^INSERT INTO' "$SORTIE") lignes de reference)"

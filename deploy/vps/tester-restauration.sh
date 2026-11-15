#!/usr/bin/env bash
# Test de restauration de la derniere sauvegarde SIGTB dans un conteneur
# jetable, sans reseau, de la meme image que la base de production. La base
# de production n'est que lue (comptages). Le conteneur est detruit a la fin.
set -uo pipefail
DEST=/opt/sigtb/sauvegardes
DUMP=$(ls -1t "$DEST"/sigtb-*.dump | head -1)
NOM="sigtb-restauration-test-$(date +%s)"
IMAGE=$(docker inspect -f '{{.Config.Image}}' sigtb-db)
echo "dump    : $DUMP ($(stat -c %s "$DUMP") octets)"
echo "image   : $IMAGE"
( cd "$DEST" && sha256sum -c "$(basename "$DUMP").sha256" ) || { echo "ECHEC empreinte"; exit 1; }
MDP=$(openssl rand -hex 16)
docker run -d --name "$NOM" --network none -e POSTGRES_PASSWORD="$MDP" "$IMAGE" >/dev/null || { echo "ECHEC demarrage"; exit 1; }
trap 'docker rm -f "$NOM" >/dev/null 2>&1; echo "conteneur $NOM detruit"' EXIT
for i in $(seq 1 60); do
  docker exec "$NOM" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 2
done
sleep 5
debut=$(date +%s)
docker exec -i "$NOM" pg_restore -U supabase_admin -h localhost -d postgres --clean --if-exists --no-comments < "$DUMP" > /tmp/restauration.log 2>&1
code=$?
echo "pg_restore : code $code, $(grep -c 'error:' /tmp/restauration.log) erreur(s), $(( $(date +%s) - debut )) s"
grep 'error:' /tmp/restauration.log | sed 's/^/    /' | sort | uniq -c | sort -rn | head -8
REQ="select 'migrations', count(*) from supabase_migrations.schema_migrations
 union all select 'auth_users', count(*) from auth.users
 union all select 'profiles', count(*) from public.profiles
 union all select 'vehicles', count(*) from public.vehicles
 union all select 'trips', count(*) from public.trips
 union all select 'trip_events', count(*) from public.trip_events
 union all select 'tickets_pesee_cbg', count(*) from public.tickets_pesee_cbg
 union all select 'contrats', count(*) from public.contrats
 union all select 'factures', count(*) from public.factures
 union all select 'stock_movements', count(*) from public.stock_movements
 union all select 'politiques_rls', count(*) from pg_policies where schemaname = 'public'
 union all select 'fonctions_public', count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'"
docker exec sigtb-db psql -U supabase_admin -d postgres -tA -F ' ' -c "$REQ" > /tmp/prod.txt
docker exec "$NOM" psql -U supabase_admin -h localhost -d postgres -tA -F ' ' -c "$REQ" > /tmp/rest.txt
echo "objet production restauration"
paste -d ' ' /tmp/prod.txt <(cut -d' ' -f2 /tmp/rest.txt) | awk '{ printf "%s %s %s %s\n", $1, $2, $3, ($2 == $3 ? "OK" : "ECART") }'
rm -f /tmp/prod.txt /tmp/rest.txt /tmp/restauration.log

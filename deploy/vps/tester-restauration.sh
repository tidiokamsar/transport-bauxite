#!/usr/bin/env bash
# Test de restauration de la derniere sauvegarde SIGTB dans un conteneur
# jetable, sans reseau, de la meme image que la base de production. La
# restauration passe par restaurer.sh, le script de la procedure de
# production (memes options, conservation des droits, D-073). La base de
# production n'est que lue (comptages et empreintes des droits). Le conteneur
# est detruit a la fin. Code de sortie 0 seulement si tout est identique.
set -uo pipefail
ICI=$(cd "$(dirname "$0")" && pwd)
DEST=/opt/sigtb/sauvegardes
DUMP=${1:-$(ls -1t "$DEST"/sigtb-*.dump | head -1)}
NOM="sigtb-restauration-test-$(date +%s)"
IMAGE=$(docker inspect -f '{{.Config.Image}}' sigtb-db)
echo "dump    : $DUMP ($(stat -c %s "$DUMP") octets)"
echo "image   : $IMAGE"
( cd "$(dirname "$DUMP")" && sha256sum -c "$(basename "$DUMP").sha256" ) || { echo "ECHEC empreinte"; exit 1; }
MDP=$(openssl rand -hex 16)
docker run -d --name "$NOM" --network none -e POSTGRES_PASSWORD="$MDP" "$IMAGE" >/dev/null || { echo "ECHEC demarrage"; exit 1; }
trap 'docker rm -f "$NOM" >/dev/null 2>&1; echo "conteneur $NOM detruit"' EXIT
for i in $(seq 1 60); do
  docker exec "$NOM" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 2
done
sleep 5
bash "$ICI/restaurer.sh" "$NOM" "$DUMP" || { echo "ECHEC restauration"; exit 1; }
REQ="select 'migrations', count(*)::text from supabase_migrations.schema_migrations
 union all select 'auth_users', count(*)::text from auth.users
 union all select 'profiles', count(*)::text from public.profiles
 union all select 'vehicles', count(*)::text from public.vehicles
 union all select 'trips', count(*)::text from public.trips
 union all select 'trip_events', count(*)::text from public.trip_events
 union all select 'tickets_pesee_cbg', count(*)::text from public.tickets_pesee_cbg
 union all select 'contrats', count(*)::text from public.contrats
 union all select 'factures', count(*)::text from public.factures
 union all select 'stock_movements', count(*)::text from public.stock_movements
 union all select 'tables_archive_bolt', count(*)::text from pg_tables where schemaname = 'archive_bolt'
 union all select 'politiques_rls', count(*)::text from pg_policies where schemaname = 'public'
 union all select 'fonctions_public', count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
 union all select 'fonctions_executables_anon', count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE'))::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
 union all select 'fonctions_executables_authenticated', count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
 union all select 'droits_tables_anon', count(*)::text from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'
 union all select 'droits_tables_authenticated', count(*)::text from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated'
 union all select 'empreinte_droits_fonctions', left(md5(string_agg(p.oid::regprocedure::text || coalesce(p.proacl::text, ''), ',' order by p.oid::regprocedure::text)), 12) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
 union all select 'empreinte_droits_tables', left(md5(string_agg(c.oid::regclass::text || coalesce(c.relacl::text, ''), ',' order by c.oid::regclass::text)), 12) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'S', 'p')
 union all select 'empreinte_droits_par_defaut', left(md5(string_agg(pg_get_userbyid(defaclrole)::text || defaclobjtype::text || defaclacl::text, ',' order by pg_get_userbyid(defaclrole)::text || defaclobjtype::text)), 12) from pg_default_acl where defaclnamespace = 'public'::regnamespace"
docker exec sigtb-db psql -U supabase_admin -d postgres -tA -F ' ' -c "$REQ" > /tmp/prod.txt
docker exec "$NOM" psql -U supabase_admin -h localhost -d postgres -tA -F ' ' -c "$REQ" > /tmp/rest.txt
echo "objet production restauration"
join <(sort /tmp/prod.txt) <(sort /tmp/rest.txt) | awk '{ printf "%s %s %s %s\n", $1, $2, $3, ($2 == $3 ? "OK" : "ECART") }' | tee /tmp/compare.txt
ecarts=$(grep -c ' ECART$' /tmp/compare.txt)
[ "$(wc -l < /tmp/compare.txt)" -eq "$(wc -l < /tmp/prod.txt)" ] || ecarts=$((ecarts + 1))
rm -f /tmp/prod.txt /tmp/rest.txt /tmp/compare.txt
if [ "$ecarts" -eq 0 ]; then echo "RESTAURATION IDENTIQUE"; else echo "RESTAURATION : $ecarts ECART(S)"; exit 1; fi

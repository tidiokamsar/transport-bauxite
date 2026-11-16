#!/usr/bin/env bash
# Restauration d'une sauvegarde SIGTB dans un conteneur Postgres, avec
# conservation exacte des droits (D-073).
#
# Pourquoi : l'image Supabase accorde par defaut a anon, authenticated et
# service_role tous les droits sur les objets crees dans le schema public
# (pg_default_acl). pg_dump ecrit les droits d'un objet par rapport aux droits
# integres de Postgres, pas par rapport a ces droits par defaut : un REVOKE
# EXECUTE ... FROM authenticated n'apparait donc pas dans le dump. Une
# restauration simple rouvre toutes les fonctions internes a anon et
# authenticated (constate le 2026-11-16 : 289 fonctions executables par anon
# apres restauration, 65 en production).
#
# Methode : les droits par defaut du schema public sont neutralises avant la
# restauration, puis retablis a l'identique ensuite. Les droits restaures sont
# alors exactement ceux du dump (empreinte identique a la production).
#
# Usage :
#   restaurer.sh <conteneur> <fichier.dump>
# Pour le conteneur de production (sigtb-db), la variable
# CONFIRMER_RESTAURATION_PRODUCTION=oui est exigee : une restauration remet la
# base a l'etat du dump et exige l'autorisation du proprietaire (guide de
# deploiement, section 5).
set -uo pipefail
CONTENEUR=${1:?conteneur attendu}
DUMP=${2:?fichier de sauvegarde attendu}
[ -f "$DUMP" ] || { echo "ECHEC : $DUMP introuvable"; exit 1; }
if [ "$CONTENEUR" = sigtb-db ] && [ "${CONFIRMER_RESTAURATION_PRODUCTION:-}" != oui ]; then
  echo "ECHEC : restauration de la production sans CONFIRMER_RESTAURATION_PRODUCTION=oui"; exit 1
fi
HOTE=""
[ "$CONTENEUR" = sigtb-db ] || HOTE="-h localhost"
PSQL="docker exec -i $CONTENEUR psql -U supabase_admin $HOTE -d postgres -X -v ON_ERROR_STOP=1 -q"

DEFAUTS="select md5(string_agg(pg_get_userbyid(defaclrole)::text || defaclobjtype::text || defaclacl::text, ',' order by pg_get_userbyid(defaclrole)::text || defaclobjtype::text))
  from (select defaclrole, defaclobjtype, defaclacl from pg_default_acl where defaclnamespace = 'public'::regnamespace) d"
avant=$($PSQL -tA -c "$DEFAUTS")
echo "droits par defaut du schema public avant : $avant"

# 1. Neutralisation des droits par defaut du schema public
$PSQL <<'SQL' || { echo "ECHEC neutralisation"; exit 1; }
-- schema absent d'une image vierge ; pg_restore -n ne le cree pas
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['postgres', 'supabase_admin'] LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role', r);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role', r);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role', r);
  END LOOP;
END $$;
SQL

# 2. Restauration en une seule transaction : en cas d'erreur, rien n'est modifie
debut=$(date +%s)
docker exec -i "$CONTENEUR" pg_restore -U supabase_admin $HOTE -d postgres \
  --clean --if-exists --single-transaction --exit-on-error \
  -n public -n auth -n supabase_migrations < "$DUMP" > /tmp/sigtb-restauration.log 2>&1
code=$?
echo "pg_restore : code $code, $(grep -c 'error:' /tmp/sigtb-restauration.log) erreur(s), $(( $(date +%s) - debut )) s"
grep 'error:' /tmp/sigtb-restauration.log | sort | uniq -c | sort -rn | head -5 | sed 's/^/    /'
rm -f /tmp/sigtb-restauration.log

# 3. Retablissement des droits par defaut, dans tous les cas (succes ou echec)
$PSQL <<'SQL' || { echo "ECHEC retablissement des droits par defaut : a refaire a la main"; exit 1; }
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['postgres', 'supabase_admin'] LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role', r);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role', r);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role', r);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
SQL
apres=$($PSQL -tA -c "$DEFAUTS")
echo "droits par defaut du schema public apres : $apres"
[ "$avant" = "$apres" ] || echo "ECART : droits par defaut differents de l'etat initial"
[ "$code" -eq 0 ] || { echo "ECHEC restauration (aucune modification, transaction annulee)"; exit "$code"; }
echo "RESTAURATION TERMINEE"

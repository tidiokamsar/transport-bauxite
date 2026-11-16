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
# restauration. Le dump contient ses propres droits par defaut du schema
# public ; pg_restore les applique en fin de restauration. Les droits des
# objets et les droits par defaut sont alors exactement ceux du dump. En cas
# d'echec (transaction annulee), les droits par defaut releves avant la
# restauration sont reappliques.
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

# Les droits par defaut valables pour tous les schemas (defaclnamespace = 0)
# ne sont pas traites par ce script : leur presence l'arrete.
globaux=$($PSQL -tA -c "select count(*) from pg_default_acl where defaclnamespace = 0 and pg_get_userbyid(defaclrole) in ('postgres', 'supabase_admin')")
[ "$globaux" = 0 ] || { echo "ECHEC : $globaux droit(s) par defaut global(aux) pour postgres ou supabase_admin, non pris en charge"; exit 1; }

# Releve des droits par defaut actuels, sous forme d'instructions rejouables
RETOUR=$($PSQL -tA -c "select string_agg(format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT %s ON %s TO %s%s;',
    pg_get_userbyid(d.defaclrole), a.privilege_type,
    CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' WHEN 'f' THEN 'FUNCTIONS' WHEN 'T' THEN 'TYPES' END,
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
    CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END), E'
')
  from pg_default_acl d, aclexplode(d.defaclacl) a
 where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype in ('r', 'S', 'f', 'T')") || { echo "ECHEC releve des droits par defaut"; exit 1; }

# Le releve est ecrit sur disque avant la neutralisation : en cas
# d'interruption, il se rejoue a la main (psql -1 -f <fichier>).
FICHIER_RETOUR=/root/sigtb-droits-par-defaut-$(date -u +%Y%m%dT%H%M%SZ).sql
printf '%s\n' "$RETOUR" > "$FICHIER_RETOUR" || { echo "ECHEC ecriture de $FICHIER_RETOUR"; exit 1; }
echo "droits par defaut releves dans $FICHIER_RETOUR"

# Sauvegarde anterieure a D-071 restauree sur une base posterieure : les
# tables archivees (archive_bolt) ont des cles etrangeres vers public que le
# dump ne connait pas, et pg_restore --clean ne pourrait pas supprimer les
# tables de public. Elles sont remises dans public (reversible) ; la migration
# D-071, reappliquee a l'etape 3.5 du guide, les archive a nouveau.
archive_dump=$(docker exec -i "$CONTENEUR" pg_restore --list < "$DUMP" | grep -c ' TABLE archive_bolt ')
archive_cible=$($PSQL -tA -c "select count(*) from pg_tables where schemaname = 'archive_bolt'")
if [ "$archive_dump" -eq 0 ] && [ "$archive_cible" -gt 0 ]; then
  echo "sauvegarde anterieure a D-071 : $archive_cible table(s) d'archive_bolt remises dans public avant la restauration"
  $PSQL -c "DO \$\$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'archive_bolt' LOOP
              EXECUTE format('ALTER TABLE archive_bolt.%I SET SCHEMA public', t); END LOOP; END \$\$;" \
    || { echo "ECHEC retour des tables archivees dans public"; exit 1; }
  echo "en cas d'echec de la restauration, rearchiver par la migration 20261120120000 (appliquer-migrations.sh)"
fi

# 1. Neutralisation des droits par defaut du schema public (tous les
#    beneficiaires autres que le role proprietaire). Les CREATE SCHEMA
#    ci-dessous sont hors de la transaction de restauration : en cas d'echec,
#    un schema vide peut rester, sans effet.
$PSQL <<'SQL' || { echo "ECHEC neutralisation : rejouer $FICHIER_RETOUR"; exit 1; }
-- schemas absents d'une image vierge ; pg_restore -n ne les cree pas.
-- archive_bolt (D-071) : des cles etrangeres de public y pointent.
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE SCHEMA IF NOT EXISTS archive_bolt;
REVOKE ALL ON SCHEMA archive_bolt FROM PUBLIC, anon, authenticated;
DO $$
DECLARE x record;
BEGIN
  FOR x IN SELECT DISTINCT pg_get_userbyid(d.defaclrole) AS proprietaire,
                  CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' WHEN 'f' THEN 'FUNCTIONS' WHEN 'T' THEN 'TYPES' END AS type,
                  CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END AS beneficiaire
             FROM pg_default_acl d, aclexplode(d.defaclacl) a
            WHERE d.defaclnamespace = 'public'::regnamespace AND d.defaclobjtype IN ('r', 'S', 'f', 'T')
              AND a.grantee <> d.defaclrole LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON %s FROM %s', x.proprietaire, x.type, x.beneficiaire);
  END LOOP;
END $$;
SQL

# 2. Restauration en une seule transaction : en cas d'erreur, rien n'est modifie
debut=$(date +%s)
docker exec -i "$CONTENEUR" pg_restore -U supabase_admin $HOTE -d postgres \
  --clean --if-exists --single-transaction --exit-on-error \
  -n public -n auth -n supabase_migrations -n archive_bolt < "$DUMP" > /tmp/sigtb-restauration.log 2>&1
code=$?
echo "pg_restore : code $code, $(grep -c 'error:' /tmp/sigtb-restauration.log) erreur(s), $(( $(date +%s) - debut )) s"
grep 'error:' /tmp/sigtb-restauration.log | sort | uniq -c | sort -rn | head -5 | sed 's/^/    /'
rm -f /tmp/sigtb-restauration.log

# 3. En cas d'echec, retour aux droits par defaut releves avant ; en cas de
#    succes, ceux du dump sont deja en place.
if [ "$code" -ne 0 ]; then
  $PSQL -1 < "$FICHIER_RETOUR" || { echo "ECHEC retour des droits par defaut : rejouer $FICHIER_RETOUR (psql -1)"; exit 1; }
fi
$PSQL -c "NOTIFY pgrst, 'reload schema'"
apres=$($PSQL -tA -c "$DEFAUTS")
echo "droits par defaut du schema public apres : $apres"
if [ "$code" -ne 0 ]; then
  [ "$avant" = "$apres" ] || echo "ECART : droits par defaut differents de l'etat initial"
  echo "ECHEC restauration (aucune modification, transaction annulee)"; exit "$code"
fi
rm -f "$FICHIER_RETOUR"
[ -n "$apres" ] || { echo "RESTAURATION TERMINEE (validee, ne pas relancer) mais ECART : aucun droit par defaut dans le schema public ; rejouer les droits attendus avant toute migration"; exit 2; }
echo "RESTAURATION TERMINEE"

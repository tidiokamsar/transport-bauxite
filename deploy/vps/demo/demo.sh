#!/usr/bin/env bash
# Donnees d'exemple SIGTB (D-020, D-074, D-084), en root sur le serveur :
#   bash deploy/vps/demo/demo.sh charger    # charge le jeu d'exemple (refuse s'il existe), active le bandeau
#   bash deploy/vps/demo/demo.sh coherence  # controles de coherence, une requete par chaine (lecture seule)
#   bash deploy/vps/demo/demo.sh apercu     # liste ce qu'une purge supprimerait, sans rien modifier
#   CONFIRMER_PURGE=oui CONFIRMER_RATTACHEES=<n> bash deploy/vps/demo/demo.sh purger
#                                            # supprime le jeu et les <n> lignes rattachees listees par l'apercu
#   CONFIRMER_PURGE=oui bash deploy/vps/demo/demo.sh recharger
#                                            # purge puis recharge (dates du jour) ; refuse s'il existe
#                                            # des lignes rattachees non etiquetees
#   bash deploy/vps/demo/demo.sh etat       # nombre de lignes d'exemple par table
# Sauvegarde automatique avant chaque modification.
# Le chargement ne cree, ne modifie ni ne rattache aucune ligne reelle
# (controle dans charger.sql : sinon il s'annule entierement).
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
CONTENEUR=sigtb-db
psql_admin() { docker exec -i "$CONTENEUR" psql -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

etat() {
  psql_admin -c "
    CREATE TEMP TABLE etat_demo (t text, n bigint);
    DO \$\$
    DECLARE r record; n bigint;
    BEGIN
      FOR r IN SELECT c.oid::regclass AS t FROM pg_class c
                 JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped
                WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') LOOP
        EXECUTE format('SELECT count(*) FROM %s WHERE id::text LIKE ''dec0de00-%%''', r.t) INTO n;
        IF n > 0 THEN INSERT INTO etat_demo VALUES (r.t::text, n); END IF;
      END LOOP;
      INSERT INTO etat_demo SELECT 'auth.users', count(*) FROM auth.users WHERE id::text LIKE 'dec0de00-%';
    END \$\$;
    SELECT t AS table_nom, n AS lignes_exemple FROM etat_demo ORDER BY 1;
    SELECT coalesce((SELECT active FROM public.sigtb_demonstration WHERE id = 1), false) AS bandeau_actif;"
}

appliquer() { /opt/sigtb/outils/sauvegarder.sh >/dev/null; psql_admin -1 -f - < "$ICI/$1"; }
# purger.sql gere lui-meme sa transaction (COMMIT ou ROLLBACK selon le mode)
purge() { psql_admin -v mode="$1" -v attendu="${2:--1}" -f - < "$ICI/purger.sql"; }
exiger_confirmation() {
  [ "${CONFIRMER_PURGE:-}" = oui ] || { echo "Purge refusee : lancer d'abord '$0 apercu', puis la commande qu'il affiche (CONFIRMER_PURGE=oui CONFIRMER_RATTACHEES=<n> $0 $1)" >&2; exit 3; }
}

case "${1:-}" in
  charger) appliquer charger.sql; etat ;;
  coherence) psql_admin -f - < "$ICI/coherence.sql" ;;
  apercu) purge apercu ;;
  purger)
    exiger_confirmation purger
    [ -n "${CONFIRMER_RATTACHEES:-}" ] || { echo "Purge refusee : CONFIRMER_RATTACHEES=<total des lignes rattachees affiche par l'apercu> requis" >&2; exit 3; }
    /opt/sigtb/outils/sauvegarder.sh >/dev/null; purge purger "$CONFIRMER_RATTACHEES"; etat ;;
  recharger)
    exiger_confirmation recharger
    /opt/sigtb/outils/sauvegarder.sh >/dev/null; purge purger 0; appliquer charger.sql; etat ;;
  etat) etat ;;
  *) echo "Usage : $0 charger|coherence|apercu|purger|recharger|etat" >&2; exit 2 ;;
esac

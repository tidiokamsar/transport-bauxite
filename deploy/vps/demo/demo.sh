#!/usr/bin/env bash
# Donnees de demonstration SIGTB (D-020), en root sur le serveur :
#   bash deploy/vps/demo/demo.sh charger    # charge le jeu (refuse s'il existe)
#   bash deploy/vps/demo/demo.sh purger     # supprime tout le jeu, retire le bandeau
#   bash deploy/vps/demo/demo.sh recharger  # purge puis recharge (dates du jour)
#   bash deploy/vps/demo/demo.sh etat       # nombre de lignes de demo par table
# Sauvegarde automatique avant chaque modification.
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
CONTENEUR=sigtb-db
psql_admin() { docker exec -i "$CONTENEUR" psql -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

etat() {
  psql_admin -tA -F ' : ' -c "
    SELECT t, n FROM (
      SELECT 'sites' t, count(*) n FROM public.sites WHERE id::text LIKE 'dec0de00-%' UNION ALL
      SELECT 'shifts', count(*) FROM public.work_shifts WHERE id::text LIKE 'dec0de00-%' UNION ALL
      SELECT 'vehicules', count(*) FROM public.vehicles WHERE id::text LIKE 'dec0de00-%' UNION ALL
      SELECT 'chauffeurs', count(*) FROM public.drivers WHERE id::text LIKE 'dec0de00-%' UNION ALL
      SELECT 'voyages', count(*) FROM public.trips WHERE id::text LIKE 'dec0de00-%' UNION ALL
      SELECT 'objectifs', count(*) FROM public.objectifs_production WHERE id::text LIKE 'dec0de00-%' UNION ALL
      SELECT 'carburant', count(*) FROM public.fuel_transactions WHERE id::text LIKE 'dec0de00-%' UNION ALL
      SELECT 'maintenance', count(*) FROM public.maintenance_orders WHERE id::text LIKE 'dec0de00-%' UNION ALL
      SELECT 'alertes', count(*) FROM public.alerts WHERE id::text LIKE 'dec0de00-%' UNION ALL
      SELECT 'positions', count(*) FROM public.vehicle_tracking WHERE id::text LIKE 'dec0de00-%' UNION ALL
      SELECT 'bandeau actif', count(*) FROM public.sigtb_demonstration WHERE active
    ) x"
}

appliquer() { /opt/sigtb/outils/sauvegarder.sh >/dev/null; psql_admin -1 -f - < "$ICI/$1"; }

case "${1:-}" in
  charger) appliquer charger.sql; etat ;;
  purger) appliquer purger.sql; etat ;;
  recharger) appliquer purger.sql; appliquer charger.sql; etat ;;
  etat) etat ;;
  *) echo "Usage : $0 charger|purger|recharger|etat" >&2; exit 2 ;;
esac

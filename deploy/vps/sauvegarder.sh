#!/usr/bin/env bash
# Sauvegarde quotidienne de la base SIGTB (CDC 42). Cron sur le serveur :
#   45 3 * * * /opt/sigtb/outils/sauvegarder.sh >> /var/log/sigtb-sauvegarde.log 2>&1
# Dump complet (schemas public et auth compris), format custom, empreinte
# sha256, conservation 14 jours. Copie hors du VPS : a organiser par le
# proprietaire (emplacement non defini au 2026-11-09).
set -euo pipefail

DEST=/opt/sigtb/sauvegardes
RETENTION=14
TS=$(date -u +%Y%m%dT%H%M%SZ)
DUMP="$DEST/sigtb-$TS.dump"

umask 077
docker exec sigtb-db pg_dump -U supabase_admin -d postgres -Fc > "$DUMP"
sha256sum "$DUMP" > "$DUMP.sha256"
# Controle de lisibilite du dump (liste du contenu, sans restauration).
docker exec -i sigtb-db pg_restore --list < "$DUMP" > /dev/null
find "$DEST" -name 'sigtb-*.dump*' -mtime +"$RETENTION" -delete
echo "$(date -u +%FT%TZ) sauvegarde $DUMP ($(stat -c %s "$DUMP") octets)"

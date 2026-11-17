#!/usr/bin/env bash
# Sauvegarde quotidienne de la base SIGTB (CDC 42). Cron sur le serveur :
#   45 3 * * * /opt/sigtb/outils/sauvegarder.sh >> /var/log/sigtb-sauvegarde.log 2>&1
# Dump complet (schemas public, auth et storage compris), format custom,
# empreinte sha256, conservation 14 jours. Pieces justificatives (D-083) :
# archive des fichiers du service storage (sigtb-<horodatage>.pieces.tar.gz,
# meme horodatage, meme empreinte, meme conservation), prise APRES le dump :
# toute ligne storage.objects du dump a son fichier dans l'archive (un
# fichier depose entre les deux est en plus, sans effet). Copie hors du VPS :
# a organiser par le proprietaire (emplacement non defini au 2026-11-09).
set -euo pipefail

DEST=/opt/sigtb/sauvegardes
RETENTION=14
TS=$(date -u +%Y%m%dT%H%M%SZ)
DUMP="$DEST/sigtb-$TS.dump"
PIECES_SRC=/opt/sigtb/pile/volumes/storage
PIECES="$DEST/sigtb-$TS.pieces.tar.gz"

umask 077
docker exec sigtb-db pg_dump -U supabase_admin -d postgres -Fc > "$DUMP"
sha256sum "$DUMP" > "$DUMP.sha256"
# Controle de lisibilite du dump (liste du contenu, sans restauration).
docker exec -i sigtb-db pg_restore --list < "$DUMP" > /dev/null
if [ -d "$PIECES_SRC" ]; then
  tar -C "$PIECES_SRC" -czf "$PIECES" .
  sha256sum "$PIECES" > "$PIECES.sha256"
  # Controle de lisibilite de l'archive.
  tar -tzf "$PIECES" > /dev/null
  echo "$(date -u +%FT%TZ) pieces $PIECES ($(stat -c %s "$PIECES") octets, $(tar -tzf "$PIECES" | grep -vc '/$') fichier(s))"
fi
find "$DEST" \( -name 'sigtb-*.dump*' -o -name 'sigtb-*.pieces.tar.gz*' \) -mtime +"$RETENTION" -delete
echo "$(date -u +%FT%TZ) sauvegarde $DUMP ($(stat -c %s "$DUMP") octets)"

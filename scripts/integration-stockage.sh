#!/usr/bin/env bash
# Integration des pieces justificatives (D-083) contre le vrai service
# storage-api, en local et sans le serveur.
#
# 1. Rejoue les migrations dans un conteneur Postgres Supabase jetable
#    (scripts/rejeu-migrations.sh --garder) ;
# 2. demarre supabase/storage-api:v1.89.12 (image de deploy/vps/docker-compose.yml)
#    sur un reseau Docker prive, avec un secret JWT de test ; le service cree
#    ses tables, puis public.configurer_stockage_pieces() pose le bucket et
#    les politiques ;
# 3. rejoue par HTTP le parcours : enregistrement, depot, confirmation,
#    lecture, et les refus (autre site, chemin non enregistre, ecrasement,
#    suppression, type et taille hors limite, anon) ;
# 4. detruit ses conteneurs et son reseau (noms prefixes sigtb-integ-).
#
# Usage : bash scripts/integration-stockage.sh   (Docker et Node requis)
set -uo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1

IMAGE_STORAGE=supabase/storage-api:v1.89.12
SUFFIXE="$$-$(date +%s)"
RESEAU="sigtb-integ-reseau-$SUFFIXE"
STOCKAGE="sigtb-integ-storage-$SUFFIXE"
PORT=${SIGTB_INTEG_PORT:-5998}
API="http://127.0.0.1:$PORT"
SECRET="secret-de-test-integration-$(date +%s)-$RANDOM-0123456789"
# Chemin natif (curl et Node sous Windows ne lisent pas /tmp de Git Bash).
TMP=$(cd "$(mktemp -d)" && { pwd -W 2>/dev/null || pwd; })
DB=""
ECHECS=0

nettoyer() {
  docker rm -f "$STOCKAGE" >/dev/null 2>&1
  [ -n "$DB" ] && docker rm -f "$DB" >/dev/null 2>&1
  docker network rm "$RESEAU" >/dev/null 2>&1
  rm -rf "$TMP"
}
trap nettoyer EXIT

jwt() { node -e '
const c = require("crypto"); const [s, role, sub] = process.argv.slice(1);
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const n = Math.floor(Date.now() / 1000); const p = { role, iat: n, exp: n + 3600 };
if (sub) { p.sub = sub; p.aud = "authenticated"; }
const h = b({ alg: "HS256", typ: "JWT" }) + "." + b(p);
console.log(h + "." + c.createHmac("sha256", s).update(h).digest("base64url"));' "$SECRET" "$@"; }
verifier() { # libelle attendu obtenu
  if [ "$2" = "$3" ]; then echo "OK    $1"; else echo "ECHEC $1 (attendu $2, obtenu $3)"; ECHECS=$((ECHECS + 1)); fi
}
q() { docker exec "$DB" psql -U supabase_admin -h localhost -d postgres -X -tA -c "$1"; }
qu() { docker exec "$DB" psql -U postgres -h localhost -d postgres -X -tA -c "select set_config('request.jwt.claim.sub', '$1', false), set_config('request.jwt.claims', json_build_object('sub', '$1', 'role', 'authenticated')::text, false)" -c "set role authenticated" -c "$2" 2>&1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
champ() { node -e 'console.log(JSON.parse(process.argv[1])[process.argv[2]])' "$1" "$2"; }

sortie=$(bash scripts/rejeu-migrations.sh --garder)
echo "$sortie" | grep -E '^(Image|Migrations)'
DB=$(sed -n 's/^Conteneur conserve : \([^ ]*\).*/\1/p' <<< "$sortie")
[ -n "$DB" ] || { echo "ECHEC rejeu des migrations"; exit 1; }

docker network create "$RESEAU" >/dev/null
docker network connect --alias db "$RESEAU" "$DB"
q "ALTER ROLE supabase_storage_admin PASSWORD 'postgres'" >/dev/null
docker run -d --name "$STOCKAGE" --network "$RESEAU" -p "127.0.0.1:$PORT:5000" \
  -e ANON_KEY="$(jwt anon)" -e SERVICE_KEY="$(jwt service_role)" -e POSTGREST_URL=http://rest:3000 \
  -e AUTH_JWT_SECRET="$SECRET" -e DATABASE_URL=postgres://supabase_storage_admin:postgres@db:5432/postgres \
  -e STORAGE_PUBLIC_URL="$API" -e REQUEST_ALLOW_X_FORWARDED_PATH=true -e FILE_SIZE_LIMIT=10485760 \
  -e STORAGE_BACKEND=file -e GLOBAL_S3_BUCKET=stub -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage \
  -e TENANT_ID=stub -e REGION=stub -e ENABLE_IMAGE_TRANSFORMATION=false "$IMAGE_STORAGE" >/dev/null || exit 1
for _ in $(seq 1 60); do curl -sf "$API/status" >/dev/null && break; sleep 2; done
verifier "service storage demarre ($IMAGE_STORAGE)" 200 "$(code "$API/status")"
verifier "bucket et politiques poses apres le demarrage du service" configure "$(q "select public.configurer_stockage_pieces()" 2>/dev/null | tail -1)"
verifier "bucket prive borne a 10 Mio" "f|10485760" "$(q "select public, file_size_limit from storage.buckets where id = 'pieces'")"

U1=00000000-0000-4000-d083-00000000e001; U2=00000000-0000-4000-d083-00000000e002
T1=00000000-0000-4000-d083-00000000e101
q "
INSERT INTO auth.users (id, email) VALUES ('$U1', 'u1.integ@exemple.invalid'), ('$U2', 'u2.integ@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-d083-00000000e0a1', 'S1 integ', 'mine'), ('00000000-0000-4000-d083-00000000e0a2', 'S2 integ', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('$U1', 'operations_manager', 'U1', 'active', '00000000-0000-4000-d083-00000000e0a1'),
  ('$U2', 'operations_manager', 'U2', 'active', '00000000-0000-4000-d083-00000000e0a2')
  ON CONFLICT (id) DO UPDATE SET site_id = EXCLUDED.site_id, status = 'active';
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES ('$U1', 'trips', 'ecriture'), ('$U2', 'trips', 'ecriture')
  ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-d083-00000000e0b1', 'INTEG-S1', 'T', 40, 'tipper', 'active', '00000000-0000-4000-d083-00000000e0a1');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, etat) VALUES
  ('$T1', 'INTEG-V1', '2001-05-10', '00000000-0000-4000-d083-00000000e0b1', '00000000-0000-4000-d083-00000000e0a1', '00000000-0000-4000-d083-00000000e0a1', 'PLANNED');
" >/dev/null

J1=$(jwt authenticated $U1); J2=$(jwt authenticated $U2); JA=$(jwt anon)
printf '%%PDF-1.4\n%% piece de test\n' > "$TMP/piece.pdf"
TAILLE=$(wc -c < "$TMP/piece.pdf" | tr -d ' '); SHA=$(sha256sum "$TMP/piece.pdf" | cut -d' ' -f1)

R=$(qu $U1 "select public.enregistrer_piece_jointe('voyage', '$T1', 'ticket.pdf', 'application/pdf', $TAILLE, '$SHA')" | tail -1)
ID=$(champ "$R" id); CH=$(champ "$R" chemin)
verifier "enregistrement par le compte du site" "voyage/$T1/$ID.pdf" "$CH"
verifier "enregistrement refuse sur le voyage d'un autre site" 1 "$(qu $U2 "select public.enregistrer_piece_jointe('voyage', '$T1', 'x.pdf', 'application/pdf', 10)" | grep -c 'Piece metier introuvable')"
verifier "depot par un autre compte au chemin enregistre refuse" 400 "$(code -X POST "$API/object/pieces/$CH" -H "Authorization: Bearer $J2" -H 'Content-Type: application/pdf' --data-binary @"$TMP/piece.pdf")"
verifier "depot a un chemin non enregistre refuse" 400 "$(code -X POST "$API/object/pieces/voyage/$T1/libre.pdf" -H "Authorization: Bearer $J1" -H 'Content-Type: application/pdf' --data-binary @"$TMP/piece.pdf")"
verifier "confirmation avant depot refusee" 1 "$(qu $U1 "select public.confirmer_piece_jointe('$ID')" | grep -c 'Fichier non recu')"
verifier "depot au chemin enregistre" 200 "$(code -X POST "$API/object/pieces/$CH" -H "Authorization: Bearer $J1" -H 'Content-Type: application/pdf' --data-binary @"$TMP/piece.pdf")"
verifier "ecrasement (x-upsert) refuse" 400 "$(code -X POST "$API/object/pieces/$CH" -H "Authorization: Bearer $J1" -H 'x-upsert: true' -H 'Content-Type: application/pdf' --data-binary @"$TMP/piece.pdf")"
verifier "remplacement (PUT) refuse" 400 "$(code -X PUT "$API/object/pieces/$CH" -H "Authorization: Bearer $J1" -H 'Content-Type: application/pdf' --data-binary @"$TMP/piece.pdf")"
verifier "confirmation (taille et type stockes)" deposee "$(qu $U1 "select public.confirmer_piece_jointe('$ID')" | tail -1)"
curl -s "$API/object/authenticated/pieces/$CH" -H "Authorization: Bearer $J1" -o "$TMP/lu.pdf"
verifier "lecture par le deposant, contenu identique" "$SHA" "$(sha256sum "$TMP/lu.pdf" | cut -d' ' -f1)"
verifier "lecture refusee a l'autre site" 400 "$(code "$API/object/authenticated/pieces/$CH" -H "Authorization: Bearer $J2")"
verifier "lecture refusee a anon" 400 "$(code "$API/object/authenticated/pieces/$CH" -H "Authorization: Bearer $JA")"
code -X DELETE "$API/object/pieces/$CH" -H "Authorization: Bearer $J1" >/dev/null
code -X DELETE "$API/object/pieces" -H "Authorization: Bearer $J1" -H 'Content-Type: application/json' -d "{\"prefixes\":[\"$CH\"]}" >/dev/null
verifier "suppression par l'API refusee : objet conserve" 1 "$(q "select count(*) from storage.objects where bucket_id = 'pieces' and name = '$CH'")"
R2=$(qu $U1 "select public.enregistrer_piece_jointe('voyage', '$T1', 'b.png', 'image/png', 20)" | tail -1)
CH2=$(champ "$R2" chemin); ID2=$(champ "$R2" id)
verifier "type refuse par le bucket" 400 "$(code -X POST "$API/object/pieces/$CH2" -H "Authorization: Bearer $J1" -H 'Content-Type: text/plain' --data-binary @"$TMP/piece.pdf")"
head -c 11000000 /dev/zero > "$TMP/gros.png"
verifier "fichier de plus de 10 Mio refuse par le service" 400 "$(code -X POST "$API/object/pieces/$CH2" -H "Authorization: Bearer $J1" -H 'Content-Type: image/png' --data-binary @"$TMP/gros.png")"
code -X POST "$API/object/pieces/$CH2" -H "Authorization: Bearer $J1" -H 'Content-Type: image/png' --data-binary @"$TMP/piece.pdf" >/dev/null
verifier "confirmation refusee : taille stockee differente de la taille declaree" 1 "$(qu $U1 "select public.confirmer_piece_jointe('$ID2')" | grep -c 'differente de la taille declaree')"
qu $U1 "select public.annuler_piece_jointe('$ID', 'Mauvais ticket joint')" >/dev/null
verifier "piece annulee toujours lisible" 200 "$(code "$API/object/authenticated/pieces/$CH" -H "Authorization: Bearer $J1")"
verifier "fichiers sur le volume : <GLOBAL_S3_BUCKET>/<tenant>/pieces/<nom>/<version>" 2 "$(docker exec "$STOCKAGE" sh -c 'find /var/lib/storage/stub/stub/pieces -type f | wc -l' | tr -d ' ')"

echo "Integration stockage : $ECHECS echec(s)"
[ "$ECHECS" -eq 0 ]

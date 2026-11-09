#!/usr/bin/env bash
# Creation du premier administrateur SIGTB (C1, D-017). A lancer par le
# proprietaire, en root sur le serveur : bash /opt/sigtb/outils/creer-admin.sh
#
# Le mot de passe est saisi au clavier, sans echo, et transmis a l'API
# d'administration de GoTrue par l'entree standard : il n'apparait ni a
# l'ecran, ni dans l'historique, ni dans la liste des processus.
set -euo pipefail

ENV=/opt/sigtb/pile/.env
API=http://127.0.0.1:8200
CLE=$(grep '^SERVICE_ROLE_KEY=' "$ENV" | cut -d= -f2-)

read -rp "Adresse e-mail de l'administrateur : " EMAIL
read -rp "Nom complet : " NOM
read -rsp "Mot de passe (12 caracteres minimum) : " MDP; echo
read -rsp "Confirmation : " MDP2; echo
[ "$MDP" = "$MDP2" ] || { echo "Les mots de passe different."; exit 1; }
[ ${#MDP} -ge 12 ] || { echo "Mot de passe trop court."; exit 1; }

REPONSE=$(EMAIL="$EMAIL" MDP="$MDP" python3 -c '
import json, os
print(json.dumps({"email": os.environ["EMAIL"], "password": os.environ["MDP"], "email_confirm": True}))' \
  | curl -sS -X POST "$API/auth/v1/admin/users" \
      -H "apikey: $CLE" -H "Authorization: Bearer $CLE" \
      -H "Content-Type: application/json" --data-binary @-)
unset MDP MDP2

ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<< "$REPONSE")
if [ -z "$ID" ]; then
  echo "Creation refusee par le service d'authentification :"
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("msg") or d.get("message") or d)' <<< "$REPONSE"
  exit 1
fi

docker exec -i sigtb-db psql -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 \
  -v id="$ID" -v nom="$NOM" <<'SQL'
INSERT INTO public.profiles (id, role, full_name, status)
VALUES (:'id', 'admin', :'nom', 'active')
ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = EXCLUDED.full_name, status = 'active';
SQL
echo "Administrateur cree : $EMAIL"

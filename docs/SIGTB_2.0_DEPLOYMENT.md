# SIGTB 2.0 - Deploiement

Livrable LOT 00 (CDC 43). Procedure operationnelle du prerequis P3 :
deploiement et verification de la Tranche 0, alignee sur CDC 42. Etat au
2026-11-08 : **rien n'a ete execute**. La Tranche 0 est mergee, non
deployee, non verifiee.

> **Caduque pour la cible retenue.** Cette procedure visait le projet
> Supabase heberge `bprfctzqplahvrepxgrw`, inaccessible et abandonne
> (D-016). La section 10 (D-009) est remplacee par D-017. La procedure de
> deploiement sur le VPS du proprietaire sera ecrite dans
> [SIGTB_2.0_HEBERGEMENT_VPS.md](SIGTB_2.0_HEBERGEMENT_VPS.md). Les
> principes (autorisation par etape, sauvegarde prealable, rejeu des
> scenarios, retour arriere, supervision) y seront repris.

## 0. Regle d'autorisation

Chaque etape ci-dessous, y compris la sauvegarde et le `link`, exige
l'autorisation explicite du proprietaire du projet Supabase, donnee pour
cette etape et consignee (date, auteur, etape, resultat) dans
`SIGTB_2.0_PROGRESS.md`. Une autorisation ne vaut pas pour l'etape suivante.
Aucun agent ni outil automatise n'execute ces commandes de lui-meme
(CLAUDE.md, regle 7 ; CDC 42 : « autorisation appropriee »).

Commandes et options verifiees le 2026-11-08 avec `--help` sur la CLI du
depot (`npx supabase`, version 2.98.2, `package.json`). Comportement
distant non verifie : la CLI n'a jamais ete liee au projet.

## 1. Perimetre de P3

| Element | Source |
|---|---|
| Garde du role et du statut | `supabase/migrations/20260903090000_protect_profiles_role_escalation.sql` |
| Ecritures par module | `supabase/migrations/20260903090100_restrict_open_rls_policies.sql`, dans sa version corrigee par D-008 (PR #16) |
| Durcissement `is_admin()` (N4) | `supabase/migrations/20261108090000_durcir_is_admin.sql` |
| Alignement de la matrice des roles (N2, D-012) | `supabase/migrations/20261108100000_aligner_role_permissions.sql` |
| Fermeture de `/telemetry` | `supabase/functions/iot-ingestion/index.ts` |
| Rotation du mot de passe admin et des comptes de demonstration | Dashboard Supabase |

Hors perimetre : `geofence-monitor`, front-end (hebergement non verifie),
corrections N1 et N3 de `SIGTB_2.0_SECURITY.md`.

## 2. Prerequis

| # | Condition | Etat |
|---|---|---|
| P1 | GitHub Actions debloque, CI verte sur `main` (typecheck, lint, tests) | A faire : compte verrouille pour facturation |
| P2 | Acces au projet `bprfctzqplahvrepxgrw` avec un compte habilite (ou projet maitrise et migration) | A faire : projet inaccessible depuis le compte connecte |
| D-008 | Decision acceptee et PR #16 mergee ; sans elle `20260903090100` echoue (`text = user_role`) | Acceptee le 2026-11-07, PR #16 non mergee |
| Poste | Depot a jour sur `main`, `npm ci` fait, Docker disponible si la commande l'exige (non verifie pour `db dump`) | - |
| Fenetre | Creneau annonce aux utilisateurs, responsable de retour arriere designe | - |

Nouveau projet issu de P2 : remplacer la reference et tout reprendre.

## 3. Connexion et etat initial (lecture seule)

```bash
npx supabase login                     # flux navigateur ; eviter --token (historique du shell)
npx supabase link --project-ref bprfctzqplahvrepxgrw
npx supabase migration list --linked
```

- Ne pas passer `-p/--password` : saisir le mot de passe de la base a
  l'invite (affichage d'une invite : non verifie).
- `migration list` donne l'historique distant. Bolt a pu appliquer les
  migrations sans renseigner cet historique (non verifie) : noter l'ecart
  exact entre local et distant.

Requetes de diagnostic (editeur SQL du dashboard, lecture seule) :

```sql
SELECT role::text, count(*) FROM public.profiles GROUP BY 1;
SELECT DISTINCT role FROM public.role_permissions ORDER BY 1;
SELECT table_name, data_type FROM information_schema.columns
 WHERE table_schema = 'public' AND column_name = 'role'
   AND table_name IN ('profiles', 'role_permissions');
```

Compter aussi les politiques ouvertes avec la requete 8.1.

Arret si un role porte par des profils actifs n'a aucune ligne dans
`role_permissions` (N2) : apres `db push`, ces utilisateurs perdent toute
ecriture metier. Completer la matrice est une modification de donnees de
production : decision dans `SIGTB_2.0_DECISIONS.md` et autorisation
distincte, avant le push. La migration `20261108100000_aligner_role_permissions`
(D-012) copie les droits des roles historiques ; elle n'ajoute rien si les
lignes `manager`, `dispatcher` ou `mechanic` sont absentes en production et
emet alors un `WARNING` listant les roles sans ligne : le `db push --dry-run`
doit la lister, et sa sortie doit etre relue.

## 4. Sauvegarde prealable (CDC 42.1)

```bash
npx supabase db dump --linked --dry-run
npx supabase db dump --linked -f <hors-depot>/prod_schema_AAAAMMJJ.sql
npx supabase db dump --linked --data-only -f <hors-depot>/prod_data_AAAAMMJJ.sql
npx supabase db dump --linked --role-only -f <hors-depot>/prod_roles_AAAAMMJJ.sql
```

- Donnees personnelles et de paie : stockage hors depot, acces restreint.
- Sauvegarde plateforme (dashboard, Database > Backups) : disponibilite
  selon l'offre, non verifie.
- Version deployee de la fonction, telechargee dans une copie de travail
  pour ne pas ecraser le depot (destination non verifiee) :
  `npx supabase functions download iot-ingestion --project-ref bprfctzqplahvrepxgrw --workdir <copie>`.
- Noter le reglage de verification JWT de `iot-ingestion` et les en-tetes
  envoyes par les boitiers : non verifie.

## 5. Rotation des mots de passe (C1)

A faire des que P2 est leve, sans attendre le push : le mot de passe admin
est public.

1. Dashboard > Authentication > Users : nouveau mot de passe fort pour
   l'administrateur, transmis hors chat et hors depot.
2. Meme traitement pour chaque compte de demonstration dont le mot de passe
   figure dans l'historique git ; desactiver ceux qui ne servent pas.
3. Revoquer les sessions ouvertes de ces comptes (procedure du dashboard
   non verifiee).
4. Consigner les comptes traites, sans aucune valeur de mot de passe.

## 6. Verification des migrations et `db push` (CDC 42.2)

`npx supabase db push --dry-run` doit lister exactement `20260903090000`,
`20260903090100`, `20261108090000` (N4) et `20261108100000` (D-012). Si des migrations Bolt apparaissent : arret, pas de
`--include-all`, passer par la section 10 (D-009). Jamais
`--include-seed` ni `--include-roles`. Apres autorisation :
`npx supabase db push`.

Conserver la sortie complete : les `NOTICE` listent chaque politique
ouverte supprimee et chaque table absente ignoree. Un echec annule la
migration en cours (transaction par migration : non verifie) ; ne pas
relancer sans diagnostic.

## 7. Deploiement de `iot-ingestion`

```bash
npx supabase functions deploy iot-ingestion --project-ref bprfctzqplahvrepxgrw
```

- Ajouter `--no-verify-jwt` uniquement si la version actuelle tourne deja
  ainsi et que les boitiers n'envoient pas de JWT (section 4) ; sinon
  l'ingestion s'arrete.
- Ne pas utiliser `--prune` : il supprime les fonctions distantes absentes
  en local.
- `--use-api` permet de construire sans Docker si besoin.

## 8. Rejeu des scenarios (CDC 42.3)

L'editeur SQL s'execute en `postgres` et contourne RLS : simuler
l'utilisateur dans une transaction annulee, comme les tests pgTAP.
`<uuid_chauffeur>` est un compte `driver` existant designe par le
proprietaire ; en creer un est une modification de production soumise a
autorisation.

```sql
-- 8.1 Doit retourner 0
SELECT schemaname, tablename, policyname FROM pg_policies
 WHERE schemaname = 'public' AND cmd = 'ALL'
   AND roles = ARRAY['authenticated']::name[]
   AND replace(COALESCE(qual,''),' ','') IN ('true','(true)');

-- 8.2 Scenario chauffeur, paie ; 8.3 : meme bloc avec
-- UPDATE profiles SET role = 'admin' WHERE id = auth.uid();  (attendu : 42501)
BEGIN;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '<uuid_chauffeur>', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
UPDATE payroll SET base_salary = 999999 WHERE id = '<id_existant>';  -- attendu : 0 ligne ou 42501
ROLLBACK;
```

Une transaction par scenario (apres une erreur, la suite du bloc echoue).
8.4 `/telemetry` sans `X-Device-Id`/`X-Api-Key` : 401 renvoye par la
fonction (message « Device ID and API key required », a distinguer d'un 401
de la plateforme si la verification JWT est active) ; cle invalide : 403 ;
aucune insertion dans `iot_telemetry_raw`. 8.5 Controles positifs : un comptable ecrit dans un
module `hr`, l'admin modifie un role, un boitier reel est accepte sur
`/gps`. Consigner chaque resultat ; tout echec declenche la section 9.

## 9. Retour arriere et supervision (CDC 42.6 et 42.7)

Principe : corriger en avant de preference (completer `role_permissions`
pour un role bloque) ; tout retour arriere rouvre C2, C3 ou C4 et exige
une autorisation et une entree au registre des decisions.

| Element | Retour arriere |
|---|---|
| `20260903090000` | `DROP TRIGGER profiles_guard_sensitive_columns ON public.profiles; DROP FUNCTION public.profiles_guard_sensitive_columns();` |
| `20260903090100` | Supprimer les politiques `ecriture_roles_metier` et `lecture_authentifies`, recreer les politiques d'origine depuis `prod_schema_AAAAMMJJ.sql` ; `has_module_write` peut rester |
| Historique | `npx supabase migration repair --status reverted 20260903090100` (et/ou `20260903090000`) |
| `iot-ingestion` | Redeployer la version telechargee en section 4 |
| Dernier recours | Restauration de la sauvegarde plateforme, avec perte des ecritures posterieures |

Toute correction durable passe ensuite par une nouvelle migration horodatee
(regle 6).

Supervision pendant 72 heures, manuelle (aucun outillage dedie) : erreurs
`42501` dans les logs Postgres par role ; taux de 401, 403 et 500 de
`iot-ingestion` ; volume horaire d'insertions `iot_gps_readings`,
`iot_fuel_readings` et `iot_telemetry_raw` compare a la veille ; retours
des utilisateurs par role, sur un canal designe par DARI HOLDING.

Cloture : `SIGTB_2.0_PROGRESS.md` et `PLAN_REVUE_MODULES.md` (section 8)
passent la Tranche 0 a « deploye », puis « verifie » apres la section 8.

## 10. Rebase sur le schema de production (D-009)

Statut : D-009 acceptee le 2026-11-07 (PR #16). Chaque etape reste soumise
a l'autorisation du proprietaire. Constat : 41 migrations Bolt sur 131
fichiers ne rejouent pas
sur base vierge ; l'historique n'est pas la source de verite.

1. Dump du schema (apres P2, autorisation) :
   `npx supabase db dump --linked --dry-run`, puis
   `npx supabase db dump --linked -f supabase/<horodatage>_schema_production.sql`.
   Relire : ni donnees, ni secret, ni role de connexion. Schemas couverts
   par defaut : non verifie ; restreindre avec `-s public` si besoin.
2. Archivage : deplacer les 129 migrations Bolt hors de
   `supabase/migrations` (par exemple `supabase/migrations_bolt_archive/`)
   et placer le dump comme migration de base. Derogation a la regle 6, a
   couvrir par D-009 acceptee. Les migrations Tranche 0 restent apres la
   base si le dump est anterieur a P3, sont archivees sinon.
3. Alignement de l'historique distant (aucun effet sur le schema selon la
   description de la commande ; non verifie au-dela) :
   `npx supabase migration repair --status reverted <versions Bolt>` puis
   `npx supabase migration repair --status applied <version du dump>`.
   Controler avec `npx supabase migration list --linked` et
   `npx supabase db push --dry-run`, qui doivent ne rien proposer d'autre
   que les migrations attendues.
4. Base locale : reconstruire depuis la nouvelle base, lancer
   `npm run test:rls`, puis brancher ce test dans `ci.yml` (P1).

Ordre recommande : dump avant P3 (il sert aussi de sauvegarde), P3, second
dump comme base de reference. Le choix final est consigne dans
`SIGTB_2.0_DECISIONS.md`.

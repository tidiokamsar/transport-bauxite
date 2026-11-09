# SIGTB 2.0 - Securite

Livrable LOT 00 (CDC 43). Etat au 2026-11-08, etabli par lecture du code
et des migrations du depot. Rien n'a ete verifie sur la base de production :
le projet Supabase `bprfctzqplahvrepxgrw` est inaccessible (P2). Tout ce qui
concerne la production est donc marque « non verifie ».

`docs/SECURITY.md` (Bolt, 2025-11-05) n'est pas une reference : son score
« 85/100 », ses corrections « completees » et ses metriques ne sont adosses
a aucun test, et il recommande une politique `FOR ALL ... USING (true)`,
c'est-a-dire le defaut corrige par la Tranche 0. Seule sa section
« Rotation des secrets » (ajoutee en Tranche 0) reste valable.

## 1. Modele actuel d'authentification et d'autorisation

### 1.1 Authentification

- Supabase Auth, email et mot de passe (`signInWithPassword`,
  `src/contexts/AuthContext.tsx`). Client cree avec `VITE_SUPABASE_URL` et
  `VITE_SUPABASE_ANON_KEY` (`src/lib/supabase.ts`).
- MFA : absent du code. Dans `supabase/config.toml` (base locale
  uniquement), TOTP desactive, inscription ouverte, mot de passe minimum
  6 caracteres. Reglages Auth de production : non verifie.
- `signUp` (C10) cree un profil depuis le client avec un `role` fourni par
  l'appelant. Non utilise par l'interface, mais toujours expose.

### 1.2 Roles et profils

- Enum `user_role` (`20251022164649_001_create_core_tables.sql`) :
  `admin`, `director`, `operations_manager`, `fleet_manager`,
  `maintenance_chief`, `logistician`, `accountant`, `driver`.
- `profiles` : `role user_role` (defaut `driver`), `site_id` (FK `sites`),
  `status text` (ajoute par des migrations Bolt, defaut `active`).
- Aucune colonne `organization_id`, aucune table `user_site_scopes` dans les
  migrations. `profiles.site_id` n'est utilise par aucune politique RLS
  (seul un index `idx_prof_site` le reference).

### 1.3 Matrice `role_permissions`

- Table `role_permissions(role text, module text, can_view, can_create,
  can_edit, can_delete, can_approve)`, unique `(role, module)`
  (`20251211055353`). `role` est `text`, pas `user_role` (origine de D-008).
- Contenu selon `20251211060846` (DELETE puis INSERT) : 7 roles x 19
  modules. Roles : `admin`, `manager`, `dispatcher`, `mechanic`,
  `logistician`, `accountant`, `driver`.
- Ecart : `manager`, `dispatcher`, `mechanic` n'existent pas dans l'enum ;
  `director`, `operations_manager`, `fleet_manager`, `maintenance_chief`
  n'ont aucune ligne. Ces quatre roles n'ont ni acces aux menus
  (`canAccessModule`) ni ecriture via `has_module_write`. Contenu reel en
  production : non verifie.
- L'interface (`hasPermission`, `canAccessModule`) ne fait que masquer des
  menus : ce n'est pas une barriere de securite.

### 1.4 Fonctions et trigger serveur

| Objet | Source | Comportement |
|---|---|---|
| `is_admin()` | `20251211142206` (derniere definition) | `role = 'admin' AND status = 'active'`, `SECURITY DEFINER`, sans `SET search_path` |
| `has_module_write(text)` | `20260903090100` | `SECURITY DEFINER`, `search_path = ''` ; vrai si la matrice donne `can_create OR can_edit` au role de l'appelant. N'appelle pas `is_admin()` : l'admin ecrit parce que la matrice lui donne tous les droits |
| `profiles_guard_sensitive_columns` | `20260903090000` | Trigger `BEFORE UPDATE` : rejette (42501) tout changement de `role` ou `status` si l'appelant n'est pas admin ; laisse passer quand `auth.uid()` est NULL (service role) |
| Politiques `ecriture_roles_metier` | `20260903090100` | `FOR ALL USING/WITH CHECK has_module_write(module)` sur 40 tables (8 modules) |
| Politiques `lecture_authentifies` | `20260903090100` | `FOR SELECT USING (true)` creee si aucune lecture n'existait avant suppression des `FOR ALL` ouverts |

Points d'attention :

- La garde du trigger teste `role = 'admin'` sans `status` : un admin
  inactif peut encore changer des roles, contrairement a `is_admin()`.
- `has_module_write` ne distingue pas `can_delete` : un role avec
  `can_edit` peut supprimer.
- `20251211142206` supprime toutes les politiques du schema `public` avant
  d'en recreer pour l'admin : l'etat des politiques de lecture en
  production depend de l'ordre reel d'application, non verifie.

### 1.5 Edge Functions

| Fonction | Constat |
|---|---|
| `iot-ingestion` | Service role. `/gps`, `/fuel`, `/telemetry` exigent le couple `device_id` + `X-Api-Key` compare a `iot_devices.api_key`. Cle stockee en clair ; CORS `*` ; `error.message` renvoye au client ; pas de limitation de debit ; payload `/telemetry` stocke sans validation de schema |
| `geofence-monitor` | Service role, aucune verification de l'appelant dans le code ; ecrit alertes et violations. Protection limitee a la verification JWT de la plateforme si elle est active (aucune section `[functions]` dans `config.toml` ; reglage deploye non verifie) |

## 2. Etat des constats C1 a C11

Rappel CDC 44 : merge n'est ni deploye ni verifie. Rien n'est deploye.

| Id | Constat | Etat du code (`main`) | Reste a faire |
|---|---|---|---|
| C1 | Mot de passe admin affiche | `demoAccounts` retire (PR #2) ; test E2E de non-regression | Rotation du mot de passe (P3) ; valeur toujours dans l'historique git |
| C2 | Auto-promotion via `profiles.role` | Trigger `20260903090000` ; test pgTAP 01 | Deploye et verifie sur le VPS le 2026-11-09 |
| C3 | ~113 politiques `FOR ALL USING (true)` | `20260903090100` : ecritures par module ; lecture large conservee | Merger PR #16 (D-008), deployer, rejouer ; lecture par perimetre (section 3) |
| C4 | `/telemetry` sans authentification | Controle `device_id` + cle (PR #2) | Deployer `iot-ingestion` ; validation du payload non faite |
| C5 | Positions GPS fabriquees | Corrige (PR #7) | Deploiement front non verifie |
| C6 | README faux sur typecheck | Corrige ; 37 erreurs typecheck restantes | Cliquet a executer en CI (P1) |
| C7 | Compteurs carburant a zero | Corrige (PR #8) | - |
| C8 | Injection HTML dans les exports PDF | Non corrige : `document.write` et `innerHTML` sans echappement dans `src/lib/exports.ts` | Vague E |
| C9 | Polling sans cleanup | 0 dans les composants | `src/lib/offline.ts` (Vague E) |
| C10 | `signUp` mort, role fourni par le client | Non corrige (`AuthContext.tsx:188`) | Supprimer ou trigger `on_auth_user_created` (Vague E) |
| C11 | Identifiant fictif hors ligne | Non corrige (`offline.ts`, `offlineSupabase.insert`) | Vague E, puis LOT 13 |

Constats nouveaux releves pour ce document (a reporter au registre de
suivi) :

| Id | Gravite proposee | Constat |
|---|---|---|
| N1 | P1 | `iot_devices.api_key` en clair, lisible par tout authentifie (politique `SELECT ... USING (true)`, `20251101072253`) ; des cles sont inserees par des migrations seed versionnees. Cles a considerer comme publiques |
| N2 | P1 | Matrice `role_permissions` desalignee de l'enum (section 1.3) : apres P3, quatre roles perdent toute ecriture metier. Correctif propose : `20261108100000_aligner_role_permissions` (D-012, a valider ; non deploye), test `04_roles_alignes` |
| N3 | P2 | `geofence-monitor` declenchable par tout porteur d'un JWT valide (y compris la cle anon si la verification JWT l'accepte, non verifie) |
| N4 | P2 | `is_admin()` sans `SET search_path` ; garde du trigger sans controle de `status`. Corrige par `20261108090000_durcir_is_admin` (PR #20, non deploye) |
| N5 | P0 | Fonctions SECURITY DEFINER heritees de Bolt executables par `anon` : `update_user_password` (reecrit le mot de passe de tout compte), `calculate_employee_payroll` et `generate_payroll_record` (paie de tout salarie) ; vue `shift_performance_stats` lisible par `anon`. Verifie en production le 2026-11-09. Correctif : `20261109120000_fermer_fonctions_definer`, test `06_fonctions_definer` |

## 3. Ecarts avec les sections 4.3 et 35 du CDC

Rattachement aux LOT : proposition a valider et consigner dans
`SIGTB_2.0_DECISIONS.md`.

| Exigence CDC | Etat actuel | LOT |
|---|---|---|
| 4.3 Role | Enum + matrice texte desalignees (N2) | 01 (correctif), 02 (modele cible) |
| 4.3 Organisation | Absente (`organization_id` inexistant) | 02 |
| 4.3 Site | `profiles.site_id` seul, jamais lu par RLS | 02 |
| 4.3 Perimetre fonctionnel | Module via `role_permissions`, ecriture seulement | 02 |
| 4.3 Responsable de site sans acces finances d'un autre site | Lecture large de toutes les tables | 02, 12 |
| 4.3 Sous-traitant limite a son entreprise | Aucun cloisonnement | 05, 17 |
| 4.3 Auditeur en lecture seule | Role inexistant | 02 |
| 35 RLS restrictive | Ecritures restreintes (non deploye), lectures `USING (true)` | 01, 02 |
| 35 Multi-entreprises, multi-sites | Absent | 02 |
| 35 Protection contre l'elevation de privileges | Trigger merge, non deploye ; C10 ouvert | 01 |
| 35 MFA comptes sensibles | Absent | 02 |
| 35 Secrets cote serveur | Respecte cote front ; cles IoT en clair (N1) | 08 |
| 35 Journalisation | Aucune table d'audit ; `last_login` seul | 02, 06 |
| 35 Protection des endpoints, authentification des equipements, limitation de debit | Cle statique en clair, CORS `*`, sans quota (section 1.5) | 08 |
| 35 Pieces jointes privees | Aucun bucket de stockage defini dans les migrations | 07 (a confirmer) |
| 35 Sauvegardes, tests de restauration | Aucune procedure ; sauvegarde prealable decrite dans `SIGTB_2.0_DEPLOYMENT.md` | 19 |
| 35 Controle des dependances | Aucun `npm audit` ni outil equivalent en CI | 01 |
| 35 Politique d'archivage | Absente | 19 |
| 35 Operations sensibles par fonctions serveur | Ecritures directes PostgREST depuis le client | 06, 12 |

## 4. Gestion des secrets

Regles (CLAUDE.md, regle 3) :

1. Seules les variables `VITE_*` publiques vont cote client : l'URL du
   projet et la cle anon. La cle `service_role` n'est jamais dans `src/`
   (aucune occurrence a ce jour) ni dans une variable `VITE_*`.
2. `.env` n'est jamais commite (`.gitignore` : `.env`, `.env.local`,
   `.env.*.local`) ni affiche. Modele public : `.env.example`.
3. Les Edge Functions lisent `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`
   via `Deno.env`, fournis par la plateforme.
4. Aucun mot de passe dans le code, la documentation ou une migration. Le
   mot de passe admin et ceux des comptes de demonstration publies sont
   compromis (historique git) et doivent etre revoques (P3).
5. Cles d'equipements IoT : a regenerer et a stocker sous forme de hachage
   (N1, LOT 08). Les cles presentes dans les migrations seed sont
   compromises.
6. Le mot de passe de la base distante est saisi a l'invite de la CLI,
   jamais passe en argument ni ecrit dans un fichier du depot.
7. Purge de l'historique git (`git filter-repo`) : uniquement apres
   rotation de tous les secrets et sur decision du proprietaire.

## 5. Tests de securite

Existants (branche mergee via PR #15) :

| Test | Fichier | Couvre |
|---|---|---|
| pgTAP, 7 assertions | `supabase/tests/database/01_profiles_garde_role.test.sql` | Trigger present ; chauffeur ne change ni role ni statut ; colonnes non sensibles modifiables ; admin et service role autorises |
| pgTAP, 6 assertions | `supabase/tests/database/02_ecriture_par_module.test.sql` | `has_module_write` present ; aucune politique `FOR ALL USING (true)` ; chauffeur sans ecriture `hr` (INSERT et UPDATE `payroll`) ; comptable avec ecriture `hr` |
| Playwright | `e2e/connexion.spec.ts` | Formulaire vide, aucun compte de demonstration affiche (C1) |

Limites : `npm run test:rls` (`supabase test db`) n'est pas branche en CI
(`ci.yml`) et la CI ne s'est jamais executee (P1). Sur base vierge, 41
migrations Bolt sur 131 ne rejouent pas ; la base rejouee ne compte que 92
politiques pour 140 tables. Ces tests valident donc les mecanismes
(trigger, `has_module_write`), pas l'etat reel des droits en production.
Sur `main`, 42 echecs : le 42e est `20260903090100`, corrigee par D-008
(PR #16). Le rejeu et les tests RLS sont automatises par
`scripts/rejeu-migrations.sh` (`npm run test:rls:rejeu`, PR #18).

Manquants :

- Tests RLS sur la base de reference construite depuis le depot (D-017).
- Lecture par perimetre (site, organisation, sous-traitant, auditeur) des
  qu'elle existe (LOT 02).
- Chaque role de l'enum contre chaque module de la matrice (N2).
- `iot-ingestion` : appels sans cle, cle invalide, payload invalide ; idem
  `geofence-monitor` sans JWT (N3).
- C10 : impossibilite de creer un profil avec un role arbitraire.
- C8 : echappement des exports PDF (Vitest).
- `is_admin()` avec un admin `inactive` ; trigger avec un admin inactif.
- Limitation de debit, controle des dependances, restauration de
  sauvegarde (CDC 41).

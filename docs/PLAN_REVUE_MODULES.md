# Plan de revue module par module : amenagement et re-revision

Date d'etablissement : 2026-09-03
Depot : https://github.com/tidiokamsar/transport-bauxite (prive)
Origine : revue d'ensemble de la base importee de Bolt (resume en section 2)
Mise a jour : 2026-11-06 (remesure section 2.1, prerequis et rattachement au
CDC 2.0 section 10)

Ce plan constitue le LOT 01 « Securite et qualite du socle » du
[CDC 2.0](SIGTB_2.0_CAHIER_DES_CHARGES.md) (decision D-003). L'etat de
reference global et le suivi par lot sont dans
[SIGTB_2.0_PROGRESS.md](SIGTB_2.0_PROGRESS.md).

## 1. Objectif

Ce document organise la reprise en main du code : amenagement module par
module, puis re-revision systematique de chaque module amenage. Il sert de
reference commune pour suivre l'avancement (section 8) et juger de la fin
des travaux (section 9).

Principes directeurs :

1. La securite serveur est remise en etat avant tout amenagement fonctionnel
   (Tranche 0). Tant qu'elle n'est pas faite, aucune mise en ligne.
2. Chaque module est traite dans une branche dediee, livre par pull request,
   puis re-revise selon la checklist de la section 7 avant d'etre declare
   termine.
3. Un module n'est jamais declare termine sur la seule base du code ecrit :
   la re-revision est obligatoire et tracee dans le tableau de suivi.

## 2. Constats de depart (revue du 2026-09-03)

Etat mesure sur l'ensemble du depot :

| Indicateur | Valeur |
|---|---|
| Erreurs `npm run typecheck` | 270 (dont ~53 substantielles, 202 imports inutilises) |
| Erreurs `npm run lint` | 446 |
| Fichiers utilisant `Math.random()` | 17 (dont 4 seulement documentes comme maquettes) |
| Vues avec `setInterval` sans `clearInterval` | 7 |
| Politiques RLS `FOR ALL ... USING (true)` | ~113 sur les tables metier |

Constats majeurs (detail dans le rapport de revue) :

| Id | Gravite | Constat | Localisation |
|---|---|---|---|
| C1 | P0 | Mot de passe admin reel affiche en clair sur la page de connexion | `src/components/Auth/LoginPage.tsx:5-16` |
| C2 | P0 | Escalade de privileges : UPDATE de `profiles.role` non restreint | `supabase/migrations/20251105120033:14-16` |
| C3 | P1 | Ecritures ouvertes a tout utilisateur authentifie (~113 tables : paie, pneus, ESG, dispatch, IoT...) | migrations `FOR ALL USING (true)` |
| C4 | P1 | Route `/telemetry` de l'Edge Function sans authentification | `supabase/functions/iot-ingestion/index.ts:150` |
| C5 | P1 | Positions GPS fabriquees (`Math.random`) pour les vehicules sans donnees | `src/components/Tracking/GPSTrackingView.tsx:95` |
| C6 | P1 | typecheck et lint en echec contrairement au README | `README.md`, section Etat du projet |
| C7 | P2 | Compteurs carburant toujours a zero (`data` lu au lieu de `count`) | `src/components/Fuel/FuelView.tsx:126-145` |
| C8 | P2 | Injection HTML non echappee dans les exports PDF | `src/lib/exports.ts` |
| C9 | P2 | Polling sans cleanup dans 7 vues | voir section 6 |
| C10 | P3 | `signUp` mort et INSERT `profiles` impossible sous RLS | `src/contexts/AuthContext.tsx:188` |
| C11 | P3 | Mode hors-ligne : identifiant fictif retourne aux appelants | `src/lib/offline.ts:253` |

### 2.1 Remesure du 2026-11-06

Les chiffres de la section 2 et la colonne « Dette constatee » de la
section 6 datent du 2026-09-03. Etat actuel :

| Indicateur | 2026-09-03 | 2026-11-06 |
|---|---|---|
| Erreurs typecheck | 270 | 37 (baseline cliquet) |
| Erreurs lint | 446 | 0 (250 avertissements, baseline) |
| `Math.random` dans `src/` | 17 fichiers | 13 fichiers, 36 occurrences, tous en Vagues B et D (AI, Analytics, FleetOptimizer, Invoices, Notifications, Purchases, QuickActions) |
| `setInterval` sans `clearInterval` dans les composants | 7 vues | 0 ; reste `src/lib/offline.ts` (Vague E) |
| Tests automatises | 0 | 0 |
| Runs CI reussis | - | 0 (tous en `startup_failure`) |

## 3. Organisation du travail

### 3.1 Git et pull requests

- Une branche par unite de travail : `secu/tranche-0`, `revue/<module>`
  (exemple : `revue/tracking`, `revue/hr-employees`).
- Conventional commits en francais, comme l'historique existant :
  `fix:`, `feat:`, `refactor:`, `docs:`, `securite:`.
- Chaque branche est livree par pull request vers `main`. La PR decrit :
  perimetre, corrections apportees, controles effectues (typecheck, lint,
  tests manuels), impact RLS le cas echeant.
- Pas de merge sans re-revision (section 7).

### 3.2 Revetement des etapes

Ordre impose :

```
Tranche 0 (securite critique)
  -> Tranche 1 (socle qualite : CI, typecheck, lint)
    -> Vague A (core operationnel)
      -> Vague B (RH et finance)
        -> Vague C (maintenance et logistique)
          -> Vague D (IA et aide a la decision)
            -> Vague E (transverse)
```

Les vagues A a E peuvent se chevaucher si le rythme le permet, mais la
Tranche 0 puis la Tranche 1 sont strictement sequentielles et prioritaires.

## 4. Tranche 0 - Securite critique (a faire immediatement)

Objectif : neutraliser C1, C2, C4 et la partie ecriture de C3. Aucun
amenagement fonctionnel avant la fin de cette tranche.

| # | Action | Valide par |
|---|---|---|
| 0.1 | Supprimer le bloc `demoAccounts` de `LoginPage.tsx`, changer le mot de passe admin dans Supabase (et partout ou il est utilise), verifier que plus aucune credential ne figure dans le code ou l'historique git (`git log -S` sur les mots de passe connus) | C1 |
| 0.2 | Bloquer l'auto-promotion : trigger `BEFORE UPDATE ON profiles` qui rejette toute modification de `role` et `status` par un non-admin, ou reduction de la politique UPDATE aux colonnes innocues (`full_name`, `phone`) via privileges colonnes | C2 |
| 0.3 | Fermer la route `/telemetry` : appliquer la meme verification `device_id` + `api_key` que `/gps` et `/fuel`, et rejeter les payloads non conformes | C4 |
| 0.4 | Recenser les ~113 politiques `FOR ALL USING (true)` et les remplacer, table par table, par des politiques minimales : lecture large acceptable, ecritures reservees aux roles metier (`is_admin()`, `is_role('accountant')`, etc.). Priorite aux tables sensibles : `payroll*`, `leave_requests`, `attendance`, `tire_*`, `invoices`, `payments`, `iot_*` | C3 |
| 0.5 | Corriger le README (section Etat du projet) qui affirme a tort que le typecheck passe | C6 |

Controle de fin de tranche : rejeu du scenario d'escalade avec un compte
non admin (`update profiles set role='admin'` doit echouer), appel anonyme
a `/telemetry` doit echouer, ecriture dans `payroll` avec un compte
chauffeur doit echouer.

## 5. Tranche 1 - Socle qualite

Objectif : rendre les indicateurs mesurables et bloquants.

| # | Action |
|---|---|
| 1.1 | Purger les 202 erreurs TS6133 (imports inutilises) et 15 TS7006 en une passe mecanique `revue/nettoyage-tsc` |
| 1.2 | Mettre en place une GitHub Action : `npm run typecheck` + `npm run lint` sur chaque PR, echec bloquant |
| 1.3 | Decider de la politique `any` : activer `no-explicit-any` en warning dans un premier temps, objectif 0 erreur a la fin des vagues |
| 1.4 | Documenter la procedure de re-revision (raccourci vers la section 7) dans `docs/README.md` |

## 6. Vagues de revue module par module

Chaque module est decrit avec : perimetre (nombre de fichiers), dette
constatee (erreurs tsc du depot au 2026-09-03, usages `Math.random`,
polling sans cleanup), actions de la revue, et charge estimee en
jours-homme (jh). L'ordre a l'interieur d'une vague suit la dette
decroissante.

### Vague A - Core operationnel (prioritaire)

C'est le coeur metier : suivi, carburant, trajets. Doit etre irreprochable
avant les autres vagues.

| Module | Perimetre | Dette constatee | Actions de revue | Charge |
|---|---|---|---|---|
| Tracking | 5 fichiers | 40 erreurs tsc ; positions fabriquees (C5) ; 3 `setInterval` sans cleanup ; `Navigation2` introuvable ; types `ParserError` sur requetes | Supprimer les positions aleatoires (afficher « sans donnees ») ; nettoyer les timers ; corriger `LiveMapView` (type predicat) et `VehicleDetailModal` (requetes) | 3 jh |
| Fuel | 9 fichiers | 34 erreurs tsc ; compteurs a zero (C7) ; 2 `Math.random` ; 1 timer sans cleanup ; usage `offlineSupabase` | Corriger C7 ; purger les valeurs fabriquees ; revoir `FuelViewEnhanced` (types `ConsumptionTrend`, `Alert`) ; trancher sur la coexistence `FuelView` / `FuelViewEnhanced` / `FuelView` non branchee dans App.tsx | 3 jh |
| Dashboard | 1 fichier | 13 erreurs tsc ; 1 `Math.random` | Rendre le KPI `minimum_stock` reel (jointure) ; supprimer les valeurs fabriquees restantes | 1 jh |
| Vehicles | 2 fichiers | 3 erreurs tsc (deux types `Vehicle` incompatibles) | Unifier le type `Vehicle` dans un fichier de types partage | 0,5 jh |
| Trips | 2 fichiers | 2 erreurs tsc | Corrections mineures | 0,5 jh |
| Drivers | 2 fichiers | 2 erreurs tsc | Corrections mineures ; verifier l'affichage du statut licence | 0,5 jh |
| Alerts | 1 fichier | 1 timer sans cleanup ; 7 erreurs tsc | Cleanup du timer ; connexion aux `alert_rules` reels | 0,5 jh |

### Vague B - RH et finance

Donnees sensibles (salaires, factures) : a traiter apres la fermeture RLS
de la Tranche 0 (action 0.4).

| Module | Perimetre | Dette constatee | Actions de revue | Charge |
|---|---|---|---|---|
| HR | 8 fichiers | 51 erreurs tsc (majorite : `selectedEmployee` possiblement null dans `EmployeesView`) | Garde-fou `selectedEmployee` (early return) ; verifier confidentialite : la vue Paie doit etre reservee aux roles RH/comptable dans l'UI ET dans les politiques | 2 jh |
| Invoices | 7 fichiers | 8 erreurs tsc ; 2 `Math.random` dont `PaymentModal` | Supprimer toute generation aleatoire de montants ou references ; corriger les types | 1,5 jh |
| Costs | 2 fichiers | 3 erreurs tsc | Corrections mineures | 0,5 jh |
| Purchases | 3 fichiers | 3 erreurs tsc ; 1 `Math.random` | Purger l'aleatoire ; corrections mineures | 0,5 jh |
| Suppliers | 2 fichiers | 1 erreur tsc | Correction mineure | 0,25 jh |
| ClientPortal | 1 fichier | 2 erreurs tsc | Verifier qu'aucune donnee client n'est exposee sans filtrage par client | 0,5 jh |

### Vague C - Maintenance et logistique

| Module | Perimetre | Dette constatee | Actions de revue | Charge |
|---|---|---|---|---|
| TireManagement | 3 fichiers | 33 erreurs tsc | Passer complet ; verifier coherence avec les 14 tables `tire_*` et leurs politiques ouvertes (Tranche 0.4) | 2 jh |
| Maintenance | 6 fichiers | 7 erreurs tsc | Corrections ; verifier `PreventiveMaintenanceView` vs `MaintenanceView` (doublon de perimetre ?) | 1 jh |
| Stock | 4 fichiers | 1 erreur tsc | Correction mineure ; verifier les alertes de seuil | 0,5 jh |
| Documents | 2 fichiers | 6 erreurs tsc | Corrections ; controler les alertes d'expiration | 0,5 jh |
| Incidents | 2 fichiers | 0 erreur tsc | Relecture fonctionnelle ; verifier le circuit de validation | 0,5 jh |
| Geofencing | 2 fichiers | 4 erreurs tsc ; 1 timer sans cleanup | Cleanup ; verifier la coherence avec l'Edge Function `geofence-monitor` | 1 jh |

### Vague D - IA et aide a la decision

Point de decision structurant : ces modules produisent aujourd'hui des
donnees aleatoires ecrites dans Supabase (documente pour `AI/`, mais
l'usage s'etend a `Analytics`, `FleetOptimizer`, `Notifications`,
`QuickActions`). Deux options par module, a arbitrer en debut de vague :

- Option « maquette assumee » : les vues restent des demos, ne verifient
  RIEN en base, et sont signalees comme telles dans l'interface (bandeau
  « donnees de demonstration »).
- Option « retrait » : le module est retire du menu en attendant un vrai
  modele.

Dans les deux cas, plus aucune ecriture en base issue de `Math.random()`.

| Module | Perimetre | Dette constatee | Actions de revue | Charge |
|---|---|---|---|---|
| AI | 4 fichiers | 14 erreurs tsc ; 4 `Math.random` | Arbitrage maquette/retrait par module ; appliquer l'option retenue | 1,5 jh |
| Analytics | 3 fichiers | 7 erreurs tsc ; 2 `Math.random` | Idem ; `TCOAnalysis*` a des handlers morts a supprimer | 1 jh |
| FleetOptimizer | 2 fichiers | 7 erreurs tsc ; 2 `Math.random` ; 1 timer sans cleanup | Idem + cleanup | 1 jh |
| IoT | 1 fichier | 1 timer sans cleanup ; lien avec `/telemetry` a valider apres Tranche 0.3 | Cleanup ; verifier l'affichage des donnees brutes | 0,5 jh |
| Reports | 1 fichier | 0 erreur tsc | Relecture ; verifier que les exports passent par `exports.ts` corrige (C8) | 0,5 jh |
| ESG | 1 fichier | 0 erreur tsc | Relecture ; donnees `carbon_*` ouvertes en ecriture (Tranche 0.4) | 0,5 jh |
| Notifications | 2 fichiers | 2 erreurs tsc ; 1 `Math.random` | Purger l'aleatoire (`SmartNotificationCenter`) | 0,5 jh |
| QuickActions | 1 fichier | 1 `Math.random` | Purger l'aleatoire | 0,25 jh |
| Search | 1 fichier | 3 erreurs tsc | Corrections | 0,25 jh |

### Vague E - Transverse et socle applicatif

| Module | Perimetre | Dette constatee | Actions de revue | Charge |
|---|---|---|---|---|
| lib/exports | 1 fichier | Injection HTML (C8) | Echapper les valeurs (DOM + `textContent`) ; `exportToExcel` qui n'est qu'un alias CSV : trancher | 0,5 jh |
| Offline (lib + composant) | 2 fichiers | Identifiant fictif (C11) ; detection reseau fragile ; 8 erreurs lint | Soit corriger (retourner un statut « en attente de synchro »), soit retirer le wrapper `offlineSupabase` s'il ne sert qu'un fichier | 1 jh |
| Auth (contexte) | 1 fichier | `signUp` mort (C10) | Supprimer `signUp` ou l'implanter via trigger serveur `on_auth_user_created` | 0,5 jh |
| Settings | 4 fichiers | 15 erreurs tsc | Passer complet (gestion des utilisateurs : verifier le lien avec les politiques RLS admin) | 1 jh |
| Sites | 2 fichiers | 0 erreur tsc | Relecture | 0,25 jh |
| Layout, Language, ErrorBoundary, Placeholder | 4 fichiers | 3 erreurs tsc (Layout) | Corrections mineures ; verifier la couverture i18n des nouveaux textes | 0,5 jh |

Charge totale estimee hors Tranches 0 et 1 : environ 28 jh.

## 7. Processus de re-revision

La re-revision est le controle quality obligatoire apres amenagement d'un
module. Elle se declenche a l'ouverture de la PR `revue/<module>` et suit
cette checklist :

1. **Conformite au plan** : la PR couvre les actions listees pour le
   module dans la section 6, et uniquement elles (pas de hors-sujet).
2. **Indicateurs automatiques** : `npm run typecheck` et `npm run lint`
   sans erreur sur les fichiers touches (la CI doit etre verte).
3. **Chasse aux donnees fabriquees** : `grep -r "Math.random"
   src/components/<module>` ne retourne rien, ou uniquement des usages
   explicitement etiquetes maquettes.
4. **Timers et abonnements** : tout `setInterval`, `setTimeout` long,
   `on()` Supabase a son cleanup au demontage.
5. **Requetes** : lectures/ecritures Supabase typées, etats `loading` et
   `error` gérés, `maybeSingle`/`single` coherents avec le schema.
6. **Securite** : si la PR touche des tables, les politiques RLS du module
   sont relues ; aucune credential, aucune cle en dur.
7. **Tests manuels** : parcours listes dans la PR executes (creation,
   modification, suppression, export le cas echeant).
8. **Revue croisee** : passage du rapport de revue (`/revue` sur la PR) ;
   tout constat P0/P1 bloque le merge, les P2/P3 sont soit corriges, soit
   consignes au tableau de suivi avec une echeance.
9. **Trace** : apres merge, mise a jour du tableau de suivi (section 8) :
   statut, date, lien PR.

Apres chaque vague complete, re-revision transversale : rejeu des
scenarios de securite de la Tranche 0, `typecheck`/`lint` globaux a zero,
et mise a jour du README (section Etat du projet).

## 8. Tableau de suivi

A maintenir a chaque PR mergee.

| Unite | Vague | Actions | Statut | PR | Date |
|---|---|---|---|---|---|
| Tranche 0 | 0 | 0.1 a 0.5 | merge (PR #2), **non deploye, non verifie**. En attente : acces au projet Supabase `bprfctzqplahvrepxgrw`, rotation du mot de passe admin, `supabase db push`, `supabase functions deploy iot-ingestion`, rejeu des scenarios. C1 a C4 sont a considerer comme toujours exploitables en production | [#2](https://github.com/tidiokamsar/transport-bauxite/pull/2) | 2026-09-03 |
| Tranche 1 | 1 | 1.1 a 1.4 | merge (PR #4) : tsc 270->61, lint 446 erreurs->0, build OK, cliquet en place. **CI jamais executee** : tous les runs en `startup_failure` (facturation Actions, depot prive), voir Settings > Billing | [#4](https://github.com/tidiokamsar/transport-bauxite/pull/4) | 2026-09-06 |
| Tracking | A | C5, timers, types | termine (PR #7 : positions reelles, requete PostgREST corrigee, types, useCallback) | [#7](https://github.com/tidiokamsar/transport-bauxite/pull/7) | 2026-09-08 |
| Fuel | A | C7, aleatoire, types | termine (PR #8 : FuelView mort supprime, exports CSV corriges, indicateurs calcules) | [#8](https://github.com/tidiokamsar/transport-bauxite/pull/8) | 2026-09-08 |
| Dashboard | A | KPI, aleatoire | termine (PR #9 : minimum_stock reel, cles stables) | [#9](https://github.com/tidiokamsar/transport-bauxite/pull/9) | 2026-09-08 |
| Vehicles | A | type `Vehicle` unifie | termine (PR #10 : src/types/vehicle.ts) | [#10](https://github.com/tidiokamsar/transport-bauxite/pull/10) | 2026-09-08 |
| Trips | A | corrections | termine (PR #6 gardes TripModal + PR #11 useCallback) | [#11](https://github.com/tidiokamsar/transport-bauxite/pull/11) | 2026-09-08 |
| Drivers | A | corrections | termine (rien a faire apres la purge Tranche 1, 0 erreur residuelle) | - | 2026-09-08 |
| Alerts | A | timer, alert_rules | termine cote code (PR #11 : useCallback ; le timer avait deja son cleanup ; connexion fine aux alert_rules reportee a la re-revision transversale) | [#11](https://github.com/tidiokamsar/transport-bauxite/pull/11) | 2026-09-08 |
| HR | B | null-safety, confidentialite | a faire | - | - |
| Invoices | B | aleatoire, types | a faire | - | - |
| Costs | B | corrections | a faire | - | - |
| Purchases | B | aleatoire, types | a faire | - | - |
| Suppliers | B | correction | a faire | - | - |
| ClientPortal | B | filtrage par client | a faire | - | - |
| TireManagement | C | passage complet | a faire | - | - |
| Maintenance | C | corrections, doublons | a faire | - | - |
| Stock | C | seuils | a faire | - | - |
| Documents | C | expirations | a faire | - | - |
| Incidents | C | relecture | a faire | - | - |
| Geofencing | C | timer, edge function | a faire | - | - |
| AI | D | arbitrage maquette/retrait | a faire | - | - |
| Analytics | D | arbitrage, handlers morts | a faire | - | - |
| FleetOptimizer | D | arbitrage, timer | a faire | - | - |
| IoT | D | timer, telemetry | a faire | - | - |
| Reports | D | exports | a faire | - | - |
| ESG | D | relecture | a faire | - | - |
| Notifications | D | aleatoire | a faire | - | - |
| QuickActions | D | aleatoire | a faire | - | - |
| Search | D | corrections | a faire | - | - |
| lib/exports | E | C8 | a faire | - | - |
| Offline | E | C11 | a faire | - | - |
| Auth | E | C10 | a faire | - | - |
| Settings | E | passage complet | a faire | - | - |
| Sites | E | relecture | a faire | - | - |
| Transverse | E | i18n, divers | a faire | - | - |

## 9. Criteres de sortie globaux

Le plan est termine quand toutes ces conditions sont reunies :

1. Tableau de suivi entierement « termine ».
2. `npm run typecheck` : 0 erreur. `npm run lint` : 0 erreur (ou liste
   d'exclusions explicite et documentee).
3. Aucune credential dans le code ni dans l'historique git ; mot de passe
   admin d'origine revoque.
4. Aucune ecriture en base issue de `Math.random()` ; les maquettes
   assumees sont signalees dans l'interface.
5. Scenarios d'escalade et d'acces direct API (Tranche 0) rejoues et
   bloquants.
6. CI GitHub Actions verte sur `main` et imposee sur les PR.
7. README et `docs/` a jour (etat du projet, perimetre reel des modules).

## 10. Articulation avec le CDC 2.0 (2026-11-06)

### 10.1 Prerequis bloquants avant toute nouvelle vague

| # | Prerequis | Responsable | Etat |
|---|---|---|---|
| P1 | Debloquer GitHub Actions (facturation du compte, ou depot public) pour que le cliquet s'execute reellement | Proprietaire du compte GitHub | A faire |
| P2 | Recuperer l'acces au projet Supabase `bprfctzqplahvrepxgrw`, ou creer un projet maitrise et y migrer | DARI HOLDING / proprietaire du projet | A faire |
| P3 | Deployer et verifier la Tranche 0 (rotation mot de passe, `db push`, `functions deploy iot-ingestion`, rejeu des 3 scenarios) | Equipe projet, apres P2 | A faire |
| P4 | Installer l'outillage de test (D-007) et ecrire les tests RLS des scenarios Tranche 0 | Equipe projet | A faire |

### 10.2 Statuts

Le tableau de la section 8 distingue desormais : **merge** (code dans
`main`), **deploye** (applique sur Supabase), **verifie** (scenarios
rejoues). Les lignes « termine » de la Vague A signifient « merge » : aucune
n'est deployee tant que P2 n'est pas leve.

### 10.3 Portee des vagues restantes

Propositions D-004 et D-005 du registre
[SIGTB_2.0_DECISIONS.md](SIGTB_2.0_DECISIONS.md), en attente d'arbitrage :

- Vague D : reduite a la suppression des ecritures `Math.random` en base et
  au signalement ou retrait des maquettes (AI, Analytics, FleetOptimizer
  seront reconstruits aux LOT 09 et 16).
- Vagues B, C, E : correctifs de securite, de donnees fabriquees et de
  types uniquement ; les evolutions fonctionnelles sont portees par les
  LOT du CDC 2.0.

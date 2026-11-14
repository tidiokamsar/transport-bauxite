# SIGTB - consignes projet

Plateforme de gestion des operations de transport de bauxite de Kogon
Mining SARL (Guinee ; mention historique : DARI HOLDING ; D-027). Client
facture : CBG ; loueur des engins : Neemba. Code initial genere par Bolt, repris sous git le
2026-09-03. Langue du code et des docs : francais.

## Documents de reference (lire avant d'agir)

- `docs/SIGTB_2.0_CAHIER_DES_CHARGES.md` : CDC 2.0, seule reference
  fonctionnelle. `docs/specs/CONFORMITE_DECLAREE_BOLT.md` est une archive
  aux affirmations fausses : ne jamais s'y fier.
- `docs/SIGTB_2.0_PROGRESS.md` : etat de reference et suivi par LOT.
- `docs/SIGTB_2.0_DECISIONS.md` : decisions ; toute derogation au CDC y est
  consignee avant d'etre codee.
- `docs/PLAN_REVUE_MODULES.md` : LOT 01 (remise a niveau du socle) et
  checklist de re-revision (section 7).

## Stack et commandes

React 18 + TypeScript + Vite + Tailwind, Supabase (Postgres, RLS, Auth,
Edge Functions Deno), Leaflet, lucide-react. Pas de nouvelle dependance UI.

```bash
npm ci
npm run typecheck
npm run lint
npm run build
bash scripts/ci-qualite.sh   # cliquet : 0 erreur lint, pas de regression
npm test                     # vitest (src/**/*.test.ts)
npm run test:e2e             # playwright (e2e/), installe chromium une fois
npm run test:rls             # pgTAP via supabase test db (base de reference, D-017)
npm run test:rls:rejeu       # rejeu des migrations + pgTAP, conteneur jetable
npm run ci:locale            # CI complete en local (D-015), rapport test-results/
```

Baselines du cliquet : `.github/ci-baseline.env`. Les baisser dans la meme
PR quand la dette diminue ; ne jamais les remonter.

## Regles non negociables

1. **Aucune donnee inventee.** Pas de `Math.random`, de valeur par defaut
   fictive ni de position GPS fabriquee dans un chemin qui ecrit en base ou
   s'affiche comme reel. Absence de donnee = affichage « sans donnees ».
   Une simulation est etiquetee `SIMULATED` et jamais melangee au reel
   (CDC 26, 27, 32).
2. **Securite serveur d'abord.** Toute nouvelle table : RLS active, aucune
   politique `FOR ALL USING (true)`. Lecture selon le perimetre, ecriture via
   `has_module_write('<module>')` ou fonction serveur ; `is_admin()` pour
   l'administration. Cible : role x organisation x site (CDC 4.3).
3. **Pas de secret dans le code ni dans git.** `.env` n'est jamais commite
   ni affiche ; seules les cles `VITE_*` publiques vont cote client.
4. **Le systeme recommande, l'humain decide** (CDC 11.5). Aucune
   modification automatique d'affectation ou de donnee validee sans regle
   d'autorisation ; corrections = nouvel evenement audite, pas de reecriture
   silencieuse (CDC 31).
5. **Une position ancienne n'est jamais affichee comme en direct** (CDC 15) ;
   chaque KPI expose periode, source, fiabilite et heure (CDC 8).
6. **Migrations** : nouveau fichier horodate dans `supabase/migrations`,
   idempotent (`IF NOT EXISTS`), jamais de modification d'une migration
   existante. Cartographier l'existant avant de creer une table (CDC 33).
7. **Ne pas confondre merge, teste, valide, deploye** (CDC 44). Aucun
   deploiement Supabase ni modification de donnees de production sans
   autorisation explicite.

## Git

- Branches : `lot-XX/<sujet>` pour le CDC 2.0, `revue/<module>` et
  `secu/<sujet>` pour le LOT 01, `docs/<sujet>`.
- Commits conventionnels en francais : `feat:`, `fix:`, `refactor:`,
  `docs:`, `securite:`, `test:`.
- Une PR par unite de travail vers `main`, avec perimetre, controles
  (typecheck, lint, build, tests), impact RLS et mise a jour de
  `docs/SIGTB_2.0_PROGRESS.md`.

## Etat connu (2026-11-08)

- Contexte d'exploitation (D-011) : site de Nimba, camions semi-remorques
  loues a l'heure, 2 chargeuses Caterpillar et 1 pelle. Location et
  decompte entierement parametrables (D-013,
  `docs/SIGTB_2.0_LOCATION_MODEL.md`) : aucun taux ni regle code en dur.
- 37 erreurs typecheck, 0 erreur lint, build OK.
- Tests (D-007) : 81 unitaires (dont 27 du moteur de decompte), 40 E2E (API
  simulee : `e2e/api-simulee.ts`), 254 assertions pgTAP (via
  `npm run test:rls:rejeu`).
- Migrations (D-017) : `supabase/migrations` commence par la base de
  reference `20260903000000_base_reference.sql`, generee par
  `scripts/construire-base-reference.sh` (ne pas l'editer, la regenerer) ;
  les 129 migrations Bolt sont archivees dans
  `supabase/migrations_bolt_archive`. Toute migration doit rejouer.
- Deploiement VPS : kit `deploy/vps/`, procedure dans
  `docs/SIGTB_2.0_HEBERGEMENT_VPS.md` section 6.
- Matrice des roles alignee sur l'enum (D-010, D-012, migration
  `20261108100000`), mergee, non deployee.
- CI GitHub Actions impossible (paiement refuse) : CI locale
  `npm run ci:locale` (D-015), resultat dans chaque PR.
- **En production depuis le 2026-11-09** : https://sigtb.infranetgn.com,
  VPS partage (6 autres applications), pile Supabase auto-hebergee
  `/opt/sigtb` (D-016), base neuve sans donnees (D-017), Tranche 0, N4 et
  D-012 deployees. Journal et mise a jour :
  `docs/SIGTB_2.0_HEBERGEMENT_VPS.md` sections 6 et 9. Aucun utilisateur
  tant que le proprietaire n'a pas lance `creer-admin.sh`. Projet
  Supabase Bolt abandonne.
- Donnees de demonstration en production (D-020) : identifiants
  `dec0de00-`, bandeau visible, purge par `deploy/vps/demo/demo.sh purger`
  obligatoire avant la premiere saisie reelle.
- Cycle voyage (CDC 12, LOT 06) : `trips.etat` ne change que par
  `creer_voyage` / `avancer_voyage` (garde `trips_garde_cycle`), journal
  `trip_events` immuable. Deploye le 2026-11-10 (PR #32).
- Planification v1 (CDC 6, D-023) : `objectifs_production` versionnes,
  ecriture par `definir_objectif` / `annuler_objectif`, droit `planning`.
- Dispatch v1 (CDC 11, D-024) : recommandation deterministe dans
  l'interface, decision par `decider_affectation` (contraintes serveur),
  historisee dans `decisions_dispatch`. Planification et Dispatch deployes
  le 2026-11-10 (#33, #34).
- Contrats et facturation (D-026) : role `contract_manager` (droits de
  demarrage etendus, derogation consciente a la separation des taches),
  dossier contractuel journalise, fiche `societe` (deployes le 2026-11-11).
- Fiches terrain (D-028) : fiches numerotees, saisie par fonctions serveur,
  numero de fiche et ticket de pesee au journal des voyages (deployees le
  2026-11-11).
- Reconciliation et factures (D-029) : facture signee par le role director
  seulement, numerotee a l'emission, avoir pour corriger (deployees le
  2026-11-11). Phase 4 (D-031) : engagements contre realise, rapport de
  performance, recouvrement et relances, comites, tableau de bord du poste
  (deployee le 2026-11-11). Phase 5 (D-032) : controle des factures Neemba
  sur les heures pointees et le tarif du contrat. Phase 6 (paiements) a venir.
- Tests pgTAP : utiliser une periode vide en production (annee 2001) quand
  un resultat agrege depend des donnees presentes (demo D-020).
- Immobilisations (D-022, D-025) : engins loues a Neemba ; la
  declaration et la cloture mettent a jour le statut de l'engin.
- PostGIS absent ; mobile absent. Maquettes Bolt (AI, FleetOptimizer,
  Analytics, anciens ecrans carburant) remplacees par des ecrans sur donnees
  reelles ou supprimees (D-030) ; IoT, ESG, achats encore a revoir.
- Droits par utilisateur (D-036) : au-dessus de la matrice role x module
  (D-012), `droits_utilisateur` prime dans `has_module_view` et
  `has_module_write` (lecture, ecriture, aucun, ou retour au role) ; ecriture
  par `definir_droit_module` (administrateur, journalisee dans
  `journal_droits_modules`) ; ecran dans Parametres -> Utilisateurs.
- Facturation par engin (D-033) : `contrat_tarifs.engin` attache un tarif a un
  engin (priorite : engin, puis categorie, puis tarif unique de la version) ;
  les lignes de facture fournisseur portent quantite et unite facturees ; le
  controle loueur confronte dans l'unite du tarif (heures pointees ou km des
  voyages livres), une unite differente est signalee, jamais estimee.
- Perimetre site (D-038, LOT 02 phase 1) : `site_permis(site)` borne les policies de vehicles, trips (depart ou arrivee), drivers et fiches_terrain ; un profil sans site est global, un profil affecte ne voit que son site ; organisations = referentiel administrateur. Fonctions serveur non encore bornees (phase 2).
- Gardes d'ecriture (D-039) : declencheurs site_permis sur trips (depart ou arrivee), vehicles, drivers, fiches_terrain, pointages_engins et immobilisations ; les fonctions SECURITY DEFINER respectent le perimetre malgre la RLS bypassée.
- Socle MFA (D-040) : garde_aal2 exige aal2 pour droits, rectifications de tickets et signature de facture, seulement si settings mfa_exige = true (desactive tant que les facteurs TOTP ne sont pas inscrits).

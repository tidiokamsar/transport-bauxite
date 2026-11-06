# SIGTB - consignes projet

Plateforme de gestion des operations de transport de bauxite de DARI
HOLDING (Guinee). Code initial genere par Bolt, repris sous git le
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

## Etat connu (2026-11-06)

- 37 erreurs typecheck, 0 erreur lint, build OK, 0 test.
- CI jamais executee (`startup_failure`, facturation GitHub Actions).
- Tranche 0 securite mergee mais non deployee : projet Supabase
  `bprfctzqplahvrepxgrw` inaccessible depuis le compte connecte.
- PostGIS absent ; mobile absent ; modules AI, FleetOptimizer, Analytics
  en maquette.

# SIGTB - Systeme Integre de Gestion du Transport de Bauxite

Plateforme de gestion de flotte pour le transport de bauxite (DARI HOLDING, Guinee).

## Stack technique

| Couche | Technologie |
|---|---|
| Front-end | React 18.3, TypeScript 5.5, Vite 5.4 |
| Styles | Tailwind CSS 3.4, PostCSS |
| Icones | lucide-react |
| Cartographie | Leaflet 1.9 / react-leaflet 4.2 |
| Back-end | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |

## Structure du depot

```
src/
  components/     35 dossiers de modules metier (96 fichiers .tsx)
  contexts/       AuthContext, LanguageContext
  i18n/           translations.ts
  lib/            supabase.ts, exports.ts, offline.ts
supabase/
  migrations/     129 migrations SQL (142 noms de tables crees)
  functions/      geofence-monitor, iot-ingestion (Edge Functions Deno)
docs/             documentation fonctionnelle et technique
```

Modules presents dans `src/components/` : AI, Alerts, Analytics, Auth,
ClientPortal, Costs, Dashboard, Documents, Drivers, ESG, FleetOptimizer,
Fuel, Geofencing, HR, Incidents, Invoices, IoT, Maintenance, Notifications,
Offline, Purchases, Reports, Search, Settings, Sites, Stock, Suppliers,
TireManagement, Tracking, Trips, Vehicles.

## Installation

```bash
npm install
cp .env.example .env    # renseigner l'URL et la cle anon Supabase
npm run dev
```

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de developpement Vite |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Previsualisation du build |
| `npm run lint` | ESLint sur tout le projet |
| `npm run typecheck` | `tsc --noEmit` sur `tsconfig.app.json` |

## Configuration

Deux variables sont requises dans `.env` (voir `.env.example`) :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Ces variables sont exposees au navigateur. Ne jamais y placer la cle
`service_role` : les acces sont controles par les politiques RLS PostgreSQL.

## Documentation

L'index complet est dans [docs/README.md](docs/README.md). Points d'entree :

- Premier lancement et comptes de demonstration : [docs/QUICK_START.md](docs/QUICK_START.md)
- Configuration de l'environnement : [docs/SETUP.md](docs/SETUP.md)
- Perimetre fonctionnel : [docs/MODULES_AUDIT.md](docs/MODULES_AUDIT.md)
- Deploiement production : [docs/deploiement/PRODUCTION.md](docs/deploiement/PRODUCTION.md)

## Etat du projet

Le projet a ete developpe sous Bolt puis repris en developpement classique.
Etat au 3 septembre 2026 :

- `npm run typecheck` : 61 erreurs residuelles (dette de type substantive,
  traitee vague par vague ; voir le plan de revue).
- `npm run lint` : 0 erreur, 268 avertissements (majorite de `any`
  explicites, objectif zero a terme).
- CI en place (`.github/workflows/ci.yml`) : build systematique et cliquet
  de baseline interdisant toute regression typecheck/lint.
- La Tranche 0 (securite critique) est livree ; voir
  [docs/PLAN_REVUE_MODULES.md](docs/PLAN_REVUE_MODULES.md).
- Les mots de passe ne sont plus stockes dans le depot. Les comptes dont
  les mots de passe ont ete exposes doivent etre revoques dans le
  dashboard Supabase : voir [docs/SECURITY.md](docs/SECURITY.md).

Point d'attention connu : les vues `src/components/AI/` (maintenance
predictive, scoring conducteur) generent leurs donnees avec `Math.random()`
et les ecrivent dans Supabase. Ce sont des maquettes, pas des modeles. Les
valeurs produites ne sont pas distinguables de vraies predictions dans
l'interface. Voir `PredictiveMaintenanceView.tsx` et
`DriverBehaviorAnalyticsView.tsx`. L'usage de `Math.random()` s'etend a
17 fichiers ; son retrait est planifie vague par vague.

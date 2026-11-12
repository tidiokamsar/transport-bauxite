# SIGTB — audit technique de transformation

**État examiné :** 2026-11-12. Référence intégrée : `main` / `921d583`. Branche parallèle : `lot-10/carburant-cbg` / `d807159`, PR #45 ouverte. Cet audit distingue code intégré, proposition de branche, preuves locales et production.

## Résumé

SIGTB dispose d'un socle transactionnel utile : authentification, RLS, fonctions serveur pour transitions de voyage, décisions de dispatch historisées, contrats/factures, fiches terrain, immobilisations et droits modulaires par utilisateur. Le système ne couvre pas encore l'exploitation complète décrite dans le prompt. Les risques les plus élevés sont l'absence de périmètre RLS par organisation/site, le stock carburant encore modifiable hors journal, l'ingestion IoT privilégiée, le modèle de pesée proposé qui ne suit pas le dernier processus CBG décrit, l'absence de relevés kilométriques dans le parcours terrain et la file offline générique sans idempotence serveur.

La suite locale de la branche `d807159` a passé 83 tests unitaires, 44 E2E, le build, 24 migrations et 302 assertions pgTAP. Le cliquet reste à la baseline documentée : 37 erreurs TypeScript; 0 erreur lint et 165 avertissements. La PR #45 est ouverte, non fusionnée. Les checks GitHub ont échoué sans étape exécutée; aucun résultat distant n'est établi.

## Architecture constatée

- Application web React/TypeScript/Vite; Supabase Auth et PostgreSQL sont le socle transactionnel.
- Le navigateur utilise PostgREST avec JWT utilisateur et clé publique; les filtres d'écran/menu ne remplacent pas le RLS.
- Les transitions de voyage, décisions de dispatch et opérations financières critiques sont définies par migrations SQL; les fonctions `SECURITY DEFINER` doivent contrôler droits et périmètre de la ligne ciblée.
- La fonction IoT utilise un rôle de service et représente une frontière de confiance distincte.
- `src/lib/offline.ts` est une file générique `localStorage` pour insert/update/delete; identifiant local, reprises sans clé d'idempotence côté serveur, purge après 24 h, pas de résolution des conflits. Aucune intégration métier complète à cette file n'est démontrée.
- Pas de client mobile Expo/SQLite dans `package.json`.

## Constats

### MAJOR — Pas de cloisonnement RLS par site/organisation

**Preuve :** `supabase/migrations/20261110090000_droits_par_role.sql` applique des droits par module; `has_module_view/write` ne prend pas de périmètre de ligne. Le suivi identifie le LOT 02 comme absent.

**Impact :** un compte autorisé sur un site peut potentiellement lire ou modifier des données d'un autre site via l'API directe.

**Suite :** LOT 02; ajouter scope d'organisation/site puis policies et vérifications des RPC pour SELECT/INSERT/UPDATE et accès croisés avec JWT de test.

### MAJOR — Validation des boîtiers IoT incomplète

**Preuve :** `supabase/functions/iot-ingestion/index.ts` vérifie l'identifiant et la clé, mais ne lie pas clairement la route au type du boîtier; aucune limite anti-rejeu, quota ou taille maximale visible dans l'Edge Function. Les écritures sont privilégiées.

**Impact :** une clé compromise ou mal configurée peut produire des mesures d'un autre type ou saturer les tables.

**Suite :** LOT 08; lier route, type et véhicule; ajouter bornes, clé hachée/rotation, horodatage signé, nonce/idempotence et quotas; tests négatifs.

### MAJOR — Solde carburant modifiable sans journal complet

**Preuve :** `FuelStockModal.tsx` écrit `current_stock` directement; `FuelStocksView.tsx` permet de supprimer le solde. L'ancien modèle n'est pas un registre de mouvements.

**Impact :** réceptions, transferts, distributions, inventaires, écarts et approbations ne sont pas reconstituables comme chaîne de preuve.

**Suite :** LOT 10; ledger append-only et fonctions serveur transactionnelles. Ne pas utiliser le formulaire de solde comme preuve financière.

### MAJOR — File hors connexion sans intégrité de synchronisation

**Preuve :** `src/lib/offline.ts:85-107,110-155,158-185` génère un identifiant local, rejoue des écritures directes, purge les opérations réussies après 24 h et n'a pas de clé idempotente serveur.

**Impact :** opération locale confondue avec acceptation serveur; doublons possibles après perte de réponse.

**Suite :** LOT 13; file métier IndexedDB/SQLite, API idempotente, conflits, acquittement serveur et état « en attente » explicite. Ne pas l'utiliser pour paiements/stocks.

### MAJOR — MFA des rôles sensibles non démontré

**Preuve :** `docs/SIGTB_2.0_PROGRESS.md` note l'absence de MFA; aucun contrôle AAL n'a été démontré pour signature, paiement ou administration.

**Impact :** mot de passe compromis pouvant suffire à une action sensible.

**Suite :** LOT 01; MFA requis et vérifié côté serveur pour les mutations critiques.

### IMPROVEMENT — Logique métier distribuée

**Preuve :** les vues accèdent directement à Supabase et plusieurs règles résident dans les composants, en plus des fonctions SQL.

**Impact :** règles susceptibles de diverger entre écran, mutation et rapport.

**Suite :** extraire progressivement les règles et services au fil des lots, sans refonte globale.

## Limites des preuves

- La CI locale de la branche utilise E2E simulés et une base Postgres jetable; elle ne prouve pas le VPS.
- 37 erreurs TypeScript de baseline et 165 avertissements lint restent présents.
- Aucun PV de recette métier n'a été fourni.
- État live du VPS, sauvegarde/restauration, et flux de données de production non revérifiés pendant cet audit.

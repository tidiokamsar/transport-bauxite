# SIGTB : porte qualité

**État au 2026-11-15.** Conditions à remplir avant fusion et avant déploiement. Les niveaux de test et les scénarios de recette sont détaillés dans [SIGTB_2.0_TEST_PLAN.md](SIGTB_2.0_TEST_PLAN.md).

## 1. Avant fusion d'une PR

| Contrôle | Commande | Seuil |
|---|---|---|
| Types | `npm run typecheck` | Pas plus d'erreurs que `TSC_BASELINE` (`.github/ci-baseline.env`, 37) |
| Lint | `npm run lint` | 0 erreur ; avertissements au plus `LINT_WARN_BASELINE` (165) |
| Build | `npm run build` | OK |
| Unitaires | `npm test` | Tous verts |
| Base | `npm run test:rls:rejeu` | Toutes les migrations rejouent ; tous les fichiers pgTAP verts |
| E2E | `npm run test:e2e` | Tous verts (un échec de délai sur machine lente est relancé une fois et signalé) |
| Ensemble | `npm run ci:locale` | Rapport joint à la PR (CI distante indisponible, D-015) |

Les baselines baissent dans la PR qui réduit la dette ; elles ne remontent jamais.

## 2. Définition d'une fonctionnalité terminée

Besoin compris et consigné (décision si le CDC change) ; données persistées ; validations client et serveur ; droits appliqués côté serveur (module, site, état) ; historique ou journal ; aucune donnée inventée ; erreurs affichées ; test pgTAP de la règle serveur et E2E du parcours principal ; documentation (décision, suivi, matrice) à jour.

Interdits : bouton sans action, écran sans persistance, donnée simulée présentée comme réelle, action sensible sans contrôle serveur, opération financière sans traçabilité, suppression physique d'un enregistrement métier.

## 3. Avant déploiement en production

1. Environnement identifié (VPS, pile `sigtb`), accès vérifié.
2. Sauvegarde `bash /opt/sigtb/outils/sauvegarder.sh` réussie avant toute migration.
3. Migrations appliquées par `deploy/vps/appliquer-migrations.sh --tests` : les tests pgTAP passent sur la base du serveur.
4. Front construit avec `VITE_SUPABASE_URL` public et la clé anonyme lue sur le serveur sans être affichée ; le bundle ne contient qu'un JWT `role: anon`.
5. Release publiée dans `web/releases/<sha>`, lien `current` basculé ; la release précédente reste disponible pour retour arrière.
6. Contrôles après déploiement : HTTP 200 de l'application, routes protégées, fonction Edge si modifiée ; journal de déploiement et notes de version mis à jour.

Accord explicite du propriétaire requis pour : migration destructive, suppression ou purge de données, opération financière réelle, activation d'une intégration externe, changement de configuration de production à risque.

## 4. Statuts

Développé (branche), testé (tests verts), fusionné (`main`), déployé (constaté sur le serveur), validé (PV métier). Un statut n'est jamais promu sans sa preuve.

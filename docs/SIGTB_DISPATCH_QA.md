# SIGTB : recette technique du Dispatch Control Center (D-087)

Exécutée le 2026-11-17 (`date -u`) sur la branche `lot-06/dispatch-control-center`,
à jour de `origin/main` (`9d1c769`). Résultats réels des commandes, aucun chiffre
estimé. État atteint : **Testé** (aucune fusion, aucun déploiement, aucun PV).

| Contrôle | Commande | Résultat |
|---|---|---|
| Typecheck | `npm run typecheck` | 0 erreur (baseline 0) |
| Lint (cliquet) | `bash scripts/ci-qualite.sh` | 0 erreur, 58 avertissements (baseline 58, pas de hausse) |
| Unitaires | `npx vitest run` | 45 fichiers, 269 tests verts, 2 à faire |
| Build | `npm run build` | OK |
| Rejeu des migrations + pgTAP | `bash scripts/rejeu-migrations.sh --tests` (conteneur jetable, supprimé) | 66 fichiers de test OK ; test 65 : 67 assertions OK |
| E2E complets | `E2E_PORT=5311 E2E_OUT_DIR=dist-e2e-5311 npx playwright test` | 142 tests verts (API simulée) ; puis postes, base-vide, défauts-bloquants rejoués après le dernier changement : 5 verts |

## pgTAP 65 (`supabase/tests/database/65_dispatch_control_center.test.sql`)

Couvre : préparation sans objectif (aucune proposition, motif exigé), sans
instance (refus), avec objectif (capacité utile, besoin, proposition, sans
hypothèse = aucun besoin), correction motivée, génération des voyages, plan
versionné, modification concurrente du plan et du shift (40001), transitions
planifié → ouvert → en cours → clôturé journalisées, acceptation conforme à la
recommandation, acceptation divergente refusée, chauffeur non habilité, camion
à immobilisation ouverte, chauffeur déjà affecté, version périmée,
réaffectation (changement de camion) sans effacer la décision précédente,
camion engagé avec un autre chauffeur, suspension (sans motif, double,
avancée bloquée, version changée), reprise, incident, indicateurs, supervision
(source « événement » sans GPS), clôture avec voyages non terminés (refus,
puis motif), annulation motivée, périmètre de site (planification, suspension,
affectation, indicateurs vides), droits (sans écriture ; `has_function_privilege`
pour anon et les fonctions internes, jamais d'appel sous un rôle révoqué),
journaux append-only.

Les assertions qui dépendent de la base partagée (capacité moyenne incluant
les engins sans site, camions immobilisés) se fondent sur la valeur rendue,
pas sur une valeur supposée : le test reste vert sur le serveur malgré les
données d'exemple.

Un premier rejeu a révélé une régression (test 61 : un voyage de 2001 resté
à l'état engagé bloquait le camion) : la garde de disponibilité est bornée aux
voyages de la veille au lendemain, puis le rejeu complet est repassé au vert.

## Vitest (`src/components/Dispatch/controle.test.ts`)

Shift horaire sans repli, libellé de la barre supérieure (filtre jamais actif),
actions par état, calcul du besoin et motif exigé, vues par état, fraîcheur
et ancienneté, conflit nommé, moteur (immobilisé et non habilité exclus,
chauffeur engagé écarté, confiance et manques, déterminisme).

## E2E (`e2e/dispatch-control-center.spec.ts`, `e2e/dispatch.spec.ts`)

Parcours principal (tableau de bord avec « sans données », conflit de version
affiché, tuile vers la liste filtrée, reprise motivée, shift non planifié puis
planifié), clôture avec motif exigé, préparation en quatre étapes avec
hypothèse saisie et correction motivée, GPS ancien jamais présenté comme en
direct (carte non affichée), perte de liaison signalée. Un défaut trouvé par
l'E2E a été corrigé : le bouton « Suivant » devenait le bouton d'envoi sous le
clic et confirmait la préparation sans afficher l'aperçu.

## Non testé

- Rien n'est rejoué contre une vraie base avec un navigateur (instance de recette).
- Concurrence réelle entre deux sessions (le verrou sans attente n'est testé
  que par sa présence ; le contrôle de version l'est par version périmée).

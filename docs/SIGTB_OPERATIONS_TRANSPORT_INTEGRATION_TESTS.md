# Opérations transport : tests d'intégration (D-088)

Résultats réels du 2026-11-17 (UTC), branche `lot-transport/operations-transport`.

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` | 0 erreur |
| `bash scripts/ci-qualite.sh` | 0 erreur lint, 55 avertissements (baseline 55, inchangée) |
| `npm test` (vitest) | 50 fichiers, 302 tests verts (2 à faire, préexistants) ; dont `Operations/journal.test.ts` (8) et `Fiches/cycleFiche.test.ts` (5) |
| `npm run build` | OK |
| `npm run test:rls:rejeu` | 72 migrations rejouées, 0 échec ; 68 fichiers pgTAP verts, 2207 assertions ; `66_operations_transport` : 49 assertions |
| E2E complète (`E2E_PORT=5313`, `E2E_OUT_DIR=dist-e2e-d088`) | 148 tests verts (8,7 min), dont 8 de `operations-transport` ; `voyages` et `dispatch-voyages` adaptés (la fiche du voyage est une page, la saisie des étapes s'ouvre par « Étapes, pesée et ticket ») |

## pgTAP 66 (base réelle, conteneur jetable)

Sites, comptes, camions et chauffeur de test dédiés (préfixe `a880`), aucune
assertion sur les totaux globaux.

- Structure : vue security_invoker, RLS de la table de vérification, aucune
  écriture directe (`has_table_privilege`), aucune fonction pour `anon`
  (`has_function_privilege`), SECURITY DEFINER et search_path vide.
- Parcours réel : `creer_voyage`, `decider_affectation` (affectation puis
  réaffectation motivée), `avancer_voyage`, `suspendre_voyage`,
  `reprendre_voyage`, progression jusqu'au déchargement,
  `rattacher_ticket_cbg`.
- Journal : deux décisions, suspension et reprise, chaque événement du cycle
  une fois, ticket présent, aucune ligne dupliquée, la réaffectation cite
  l'affectation, la reprise cite la suspension, statut et date de saisie
  sur chaque ligne, camion courant = réaffectation.
- Contrôles : 7 constats ; affectation, habilitation, étapes, ticket et
  double comptage conformes ; voyage pesé sans fiche en alerte ; voyage non
  engagé non applicable.
- Vérification : auteur refusé (42501), lecture seule refusée (42501),
  événement inconnu (P0002), vérifié, vérificateur refusé à la validation,
  conflit de version (40001), validé, contestation sans motif refusée,
  contestation motivée, trois vérifications chaînées, la dernière prime,
  toujours aucune duplication, une vérification ne se vérifie pas.
- Périmètre : compte d'un autre site, journal vide et contrôles refusés.
- Append-only : modification refusée.

## E2E `operations-transport` (API simulée)

| # | Scénario | Vérifié |
|---|---|---|
| 1 | Préparer, affecter, retrouver dans le registre | vue générale, menu de l'espace, tuile vers le registre avec `?date=`, ligne -> `#/trips/t1?date=`, lien Dispatch avec le contexte |
| 2 | Progression et chronologie | chronologie unifiée (étapes, relevé officiel, statut Vérifié), page de vérification, `verifier_evenement_voyage` envoyé avec `p_precedente_id` |
| 3 | Fiche FR remise, retournée, saisie, reliée | `remettre_fiches` (agent exigé), saisie d'une rotation (contrôle des compteurs), `saisir_ligne_rotation` avec le voyage, fiche visible depuis le voyage |
| 4 | Ticket CBG rapproché, original conservé | officiel CBG et saisie KOGON (ticket et rectification) dans deux blocs distincts |
| 5 | Écart, anomalie ouverte puis traitée | liste des anomalies -> onglet Anomalies du voyage, anomalie et traitement |
| 6 | Réaffectation identique partout | registre et synthèse : camion courant RC-1002 ; historique avec la décision précédente et le motif |
| 7 | Clôture et cohérence | instances de shift du jour, contrôles des voyages, alerte affichée, lien vers l'onglet Contrôles |
| - | Cas d'erreur | refus serveur affiché tel quel : droit (42501 `separation_violee`), conflit concurrent (40001), doublon (23505) |

Limite : les E2E tournent sur l'API simulée (`e2e/api-simulee.ts`) ; le
comportement serveur est prouvé par pgTAP 66 sur une vraie base.

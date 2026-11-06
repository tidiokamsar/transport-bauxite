# SIGTB 2.0 - Registre des decisions

Une decision par entree. Statuts : Proposee, Acceptee, Remplacee.
Une decision acceptee ne se modifie pas : on en ajoute une nouvelle qui la
remplace.

| Id | Date | Statut | Decision | Motif |
|---|---|---|---|---|
| D-001 | 2026-11-06 | Acceptee | Le CDC 2.0 (`docs/SIGTB_2.0_CAHIER_DES_CHARGES.md`) est la reference fonctionnelle et technique. | Recu de DARI HOLDING ; l'ancien document Bolt n'etait pas un cahier des charges. |
| D-002 | 2026-11-06 | Acceptee | `docs/specs/CAHIER_DES_CHARGES.md` est archive sous `docs/specs/CONFORMITE_DECLAREE_BOLT.md` avec un avertissement. | Affirmations de conformite fausses, verifiees contre le code. |
| D-003 | 2026-11-06 | Acceptee | Le plan de revue (`PLAN_REVUE_MODULES.md`) est rattache au LOT 01 du CDC 2.0. | Les tranches et vagues sont la remise a niveau du socle, pas le developpement 2.0. |
| D-004 | 2026-11-06 | Proposee | Les modules en maquette qui seront reconstruits (AI, FleetOptimizer, Analytics) ne sont pas polis : on supprime leurs ecritures `Math.random` en base et on les signale « donnees de demonstration » ou on les retire du menu. La Vague D est reduite a cette action. | CDC 27 et 32 ; reconstruction prevue aux LOT 09 et 16. |
| D-005 | 2026-11-06 | Proposee | Les Vagues B, C et E ne sont reprises qu'apres deploiement verifie de la Tranche 0 et CI active ; dans chaque vague, seuls les correctifs de securite, de donnees fabriquees et de types sont faits, les evolutions fonctionnelles relevant des LOT. | Eviter de retravailler des ecrans dont le modele change (LOT 02, 05, 06). |
| D-006 | 2026-11-06 | Proposee | PostGIS est active des le LOT 02 ; les geofences existantes migrent vers des colonnes `geometry`. | CDC 5, 29, 30 ; calculs actuels sans PostGIS. |
| D-007 | 2026-11-06 | Proposee | Outillage de test : Vitest (unitaires), tests RLS SQL sur base locale Supabase, Playwright (E2E). A installer au LOT 01. | CDC 41 ; aucun test aujourd'hui. Versions a verifier a l'installation. |

# Opérations transport : architecture (D-088)

Programme de cohérence opérationnelle demandé par le propriétaire le
2026-11-17. Migration `20261121220000_operations_transport`, test pgTAP 66,
E2E `operations-transport`.

## 1. Principes

| Module | Rôle | Écrit dans |
|---|---|---|
| Dispatch | décide et affecte | `decisions_dispatch`, `trips` (via `decider_affectation`, `affecter_voyage`), `suspensions_voyage` |
| Voyages & Rotations | suit l'exécution | `trip_events` (via `avancer_voyage`, `saisir_rotation`, `rattacher_ticket_cbg`) |
| Fiches terrain | documente | `fiches_terrain`, `fiches_rotations_lignes`, `fiches_journal` (fonctions D-089) |
| Pesée CBG | justifie (D-081) | `releves_cbg*`, `releves_terrain_kogon`, `rapprochements_pesee`, `anomalies_pesee` |
| Opérations transport (nouveau) | assemble et contrôle | `verifications_evenements_voyage` seulement |

Le voyage (`trips.id`, référence `trips.reference`) est l'objet central.
Aucun module ne crée de copie d'un voyage : la rotation est le cycle du
camion (`trips.shift_sequence` dans le shift ; `fiches_rotations_lignes.rang`
sur la fiche FR), les événements forment l'historique commun.

## 2. Audit avant (constats du 2026-11-17)

| Sujet | Avant | Après (D-088) |
|---|---|---|
| Historique du voyage | Dispersé : `trip_events` (fiche voyage), `decisions_dispatch` (Dispatch), `suspensions_voyage`, `fiches_journal`, tickets, relevés, anomalies, pièces : chaque écran lisait sa table | Vue unique `v_journal_voyage` (SECURITY INVOKER), une ligne par événement source, sans recopie |
| Fiche du voyage | Fenêtre modale ouverte depuis le registre et le Dispatch (`FicheVoyage`) | Page `#/trips/<id>` (11 onglets) ; la modale reste pour la saisie des étapes et de la pesée (écart, voir PROGRESS) |
| Statut « vérifié » d'un événement déclaré | Inexistant (`trip_events.origine` fixe à l'écriture) | Table append-only `verifications_evenements_voyage`, fonction `verifier_evenement_voyage` |
| Contrôles de cohérence | Dispersés (contrôle de fiche D-089, rapprochement D-081, gardes Dispatch D-087) | `controles_voyage(p_trip_id)` : 7 constats par voyage |
| Fiches du cycle D-089 | API serveur sans écran | Pages `#/fiches/<id>` et actions du cycle |
| Navigation | Accès directs séparés, aucun contexte partagé | Espace « Opérations transport », contexte dans l'adresse |

Références manquantes relevées : aucune clé étrangère n'est absente pour
relier les sources au voyage (`trip_events`, `decisions_dispatch`,
`suspensions_voyage`, `tickets_pesee_cbg`, `fiches_rotations_lignes`,
`fiches_terrain.trip_id`, `releves_terrain_kogon`, `rapprochements_pesee`,
`anomalies_pesee` portent `trip_id`) ; les lignes du relevé officiel CBG ne
portent pas de voyage et sont reliées par le rapprochement (D-081, voulu :
l'officiel n'est jamais modifié). Des index manquaient pour lire par voyage
(`fiches_rotations_lignes`, `fiches_terrain`, `rapprochements_pesee`,
`anomalies_pesee`, `releves_terrain_kogon`, `pieces_jointes`) : ajoutés.

Duplications relevées : `fiches_terrain.statut` (ancien) et `etat` (D-089)
coexistent par compatibilité (recalcul serveur) ; `tickets_pesee_cbg.ticket`
et `fiches_rotations_lignes.ticket_cbg` portent le même numéro observé
(contrôlé par `controler_fiche` et par `controles_voyage`, jamais fusionné).

## 3. Cartographie après

```
work_shifts --< postes --< trips >-- decisions_dispatch
                            |  \---- suspensions_voyage
                            |  \---- trip_events --(ticket)--> tickets_pesee_cbg --< rectifications_tickets_pesee_cbg
                            |  \---- fiches_rotations_lignes >-- fiches_terrain --< fiches_journal
                            |  \---- releves_terrain_kogon (source B)
                            |  \---- rapprochements_pesee >-- releves_cbg_lignes (source A) >-- releves_cbg
                            |  \---- anomalies_pesee --< journal_anomalies_pesee
                            |  \---- pieces_jointes (voyage, ticket)
                            |  \---- verifications_evenements_voyage (nouveau)
                            v
                    v_journal_voyage (vue, droits du lecteur)   controles_voyage (constats)
```

Voir `SIGTB_OPERATIONS_TRANSPORT_DATA_MODEL.md`, `_EVENT_MODEL.md`,
`_NAVIGATION.md`, `_PERMISSIONS.md`, `_WORKFLOWS.md`,
`_INTEGRATION_TESTS.md`, `_PROGRESS.md`.

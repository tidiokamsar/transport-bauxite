# Opérations transport : état réel (D-088, 2026-11-17)

États selon CLAUDE.md bloc 1 section 5. Rien n'est déployé ni fusionné :
branche `lot-transport/operations-transport`. Une fonctionnalité seulement
visuelle n'est jamais déclarée opérationnelle.

| Point | Livré | État | Preuve |
|---|---|---|---|
| 1. Audit et cartographie | `_ARCHITECTURE.md`, `_DATA_MODEL.md` | Développé | docs |
| 2. Journal unifié | vue `v_journal_voyage`, table et fonction de vérification | Testé | pgTAP 66 (structure, contenu, aucune duplication, corrections chaînées, périmètre, séparation, concurrence, append-only) ; `_EVENT_MODEL.md` |
| 3. Fiche opérationnelle du voyage | `#/trips/<id>`, 11 onglets, actions suspendre, reprendre, vérifier | Testé | E2E scénarios 1, 2, 4, 6, 7 et refus ; contrôles serveur `controles_voyage` (pgTAP 66) |
| 4. Conversion aux pages D-090 | Voyages & Rotations (registre par état + fiche + actions) ; Fiches terrain (fiche et cycle D-089 en pages) | Partiel, testé | E2E scénario 3 ; vitest `cycleFiche.test.ts` |
| 5. Espace « Opérations transport » | menu, vue générale, journal, anomalies, contrôles et clôtures ; contexte `date` dans l'adresse | Testé | E2E scénarios 1, 5, 7 ; `_NAVIGATION.md` |
| 6. Synchronisation par le serveur | aucune recopie frontale : tous les écrans relisent les tables sources ; la vue relie fiches, tickets, rapprochements, anomalies au voyage ; annulations conservées (`annule`) | Testé (serveur) | pgTAP 66 (réaffectation : camion courant et historique ; ticket au journal) |
| 7. Permissions | serveur : droit, périmètre, séparation saisie / vérification / validation | Testé | pgTAP 66 ; `_PERMISSIONS.md` |
| 8. Tests | pgTAP 66 (49 assertions), vitest (2 fichiers, 13 cas), E2E `operations-transport` (8 cas) | Testé | `_INTEGRATION_TESTS.md` |
| 9. Docs | 8 documents `SIGTB_OPERATIONS_TRANSPORT_*`, D-088 | Fait | |

## Non fait (et pourquoi)

- **Dispatch, Shifts, Pesée CBG non convertis aux pages D-090** : écrans de
  15 à 33 Ko chacun avec leurs fenêtres (décision, suspension, shift, quatre
  espaces de pesée) ; leur conversion dépasse ce lot. Ajouts faits : liens
  vers la fiche du voyage et date de contexte (Dispatch).
- **Saisie des étapes et de la pesée** : reste la fenêtre `FicheVoyage`,
  ouverte depuis la fiche du voyage (bouton « Étapes, pesée et ticket »).
- **Fiches terrain** : la liste, la préparation (D-028 `preparer_fiche`),
  l'impression groupée, le brouillon (`enregistrer_brouillon_fiche`), les
  saisies FP et FC du cycle (`saisir_pointage_fiche`,
  `saisir_ligne_carburant`), la génération depuis le Dispatch
  (`generer_fiches_rotation`) et le tableau de bord du cycle restent à faire
  en pages ; la fiche et les actions du cycle D-089 sont livrées.
- **Contexte** : les écrans existants lisent seulement `date` ; `site`,
  `shift`, `camion`, `chauffeur`, `rotation` sont portés par l'adresse mais
  pas encore appliqués à leurs filtres.
- **Justification d'une absence de fiche** : le contrôle la signale ; aucune
  table ne porte encore la justification (la contestation motivée d'un
  événement en tient lieu provisoirement).
- **E2E contre une vraie base** : les E2E restent sur l'API simulée ; le
  parcours serveur est couvert par pgTAP 66 dans le conteneur jetable.
- Revue indépendante non faite (D-085).

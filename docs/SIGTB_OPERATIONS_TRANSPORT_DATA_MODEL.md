# Opérations transport : modèle de données (D-088)

## Identifiants

| Objet | Identifiant | Référence lisible | Lien au voyage |
|---|---|---|---|
| Voyage | `trips.id` | `trips.reference` | objet central |
| Rotation | `trips.shift_sequence` (dans le shift) ; `fiches_rotations_lignes.rang` (sur la FR) | n° de rotation | `trips.id` ; `fiches_rotations_lignes.trip_id` (facultatif : une rotation déclarée sans voyage est un écart du contrôle) |
| Instance de shift | `postes.id` | date, shift, site | `trips.shift_id` + date ; `fiches_terrain.poste_id` |
| Décision Dispatch | `decisions_dispatch.id` | nature, décision | `trip_id` |
| Fiche terrain | `fiches_terrain.id` | `numero` (FR-, FP-, FC-) | `trip_id` (FP/FC) ou lignes FR |
| Ticket de réception | `tickets_pesee_cbg.id` | `ticket` | `trip_id` (unique) |
| Ligne de relevé officiel CBG | `releves_cbg_lignes.id` | relevé + rang | par `rapprochements_pesee.trip_id` |
| Relevé terrain KOGON | `releves_terrain_kogon.id` | ticket observé | `trip_id` (facultatif) |
| Anomalie de pesée | `anomalies_pesee.id` | catégorie | `trip_id`, `trips_concernes[]` |
| Pièce justificative | `pieces_jointes.id` | nom | objet `voyage` ou `ticket_pesee_cbg` |
| Événement du journal | texte `<source>:<uuid>` | libellé | `trip_id` |

## Ajouts de la migration 20261121220000

- Table `verifications_evenements_voyage` : `id`, `rang` (identité),
  `trip_id`, `evenement_id` (identifiant du journal, format
  `^[a-z_]+:<uuid>$`), `statut` (verifie, valide, conteste), `motif`
  (obligatoire pour contester, 5 caractères), `precedente_id` (chaîne des
  corrections, unique), `auteur`, `cree_le`. Append-only (déclencheur
  `refuser_mutation_dispatch`), RLS lecture `trips` + `voyage_permis`,
  aucune écriture directe.
- Vue `v_journal_voyage` (security_invoker) : voir `_EVENT_MODEL.md`.
- Fonctions `verifier_evenement_voyage(uuid, text, text, text, uuid)` et
  `controles_voyage(uuid)` : SECURITY DEFINER, `search_path = ''`.
- Index de lecture par voyage (six index partiels ou composés).

Aucune fonction existante redéfinie ; aucune table existante modifiée.

## Contrôles du voyage (`controles_voyage`)

| Ordre | Code | Conforme si | Alerte si |
|---|---|---|---|
| 1 | affectation_valide | camion et chauffeur = dernière décision Dispatch non refusée | ressource manquante, aucune décision tracée, écart avec la décision, camion sous immobilisation ouverte |
| 2 | chauffeur_habilite | permis valide et habilitations requises (`habilitations_manquantes`) à la date du voyage | permis expiré, habilitation manquante ; sans date de permis : sans données |
| 3 | etapes_coherentes | chaque état de départ est l'état d'arrivée d'un événement antérieur ou simultané ; heure d'opération au plus 5 min après la saisie ; état courant = dernier événement | sinon |
| 4 | km_coherents | compteurs renseignés et croissants, égaux à ceux de la fiche FR | arrivée < départ, écart avec la fiche ; voyage livré sans compteurs : sans données |
| 5 | fiche_presente | au moins une fiche non annulée reliée | voyage pesé ou livré sans fiche (absence à justifier) |
| 6 | ticket_associe | ticket de réception présent (et rapprochement signalé) | voyage pesé ou livré sans ticket |
| 7 | double_comptage | ticket, fiche FR et ligne de relevé uniques | numéro de ticket porté par un autre voyage (référence non divulguée), voyage sur plusieurs FR, sur plusieurs lignes de relevé non annulé |

Un contrôle « non applicable » dit pourquoi (voyage non engagé, non pesé).
Aucune valeur n'est supposée ; aucune écriture.

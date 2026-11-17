# Opérations transport : permissions (D-088)

Règle : l'écran masque une action interdite, le serveur la refuse. Toutes
les écritures passent par une fonction serveur SECURITY DEFINER,
`search_path = ''`, avec droit du module et périmètre de site.

| Action | Fonction | Droit | Périmètre | Séparation |
|---|---|---|---|---|
| Lire le journal du voyage | vue `v_journal_voyage` | lecture du module de chaque source (`trips`, `invoices` pour la pesée) | RLS de chaque table + `trips` | - |
| Lire les contrôles | `controles_voyage` | lecture `trips` ou administrateur | `voyage_permis` avant toute lecture ; hors périmètre = « Voyage introuvable » | - |
| Vérifier, valider, contester un événement | `verifier_evenement_voyage` | écriture `trips` | `voyage_permis` | auteur de la saisie != vérificateur != validateur |
| Affecter, réaffecter | `decider_affectation`, `affecter_voyage` (D-024, D-087) | écriture `trips` | site du voyage et des ressources | motif pour modifier, refuser, réaffecter |
| Suspendre, reprendre | `suspendre_voyage`, `reprendre_voyage` (D-087) | écriture `trips` | `voyage_permis` | motif |
| Avancer, peser, ticket | `avancer_voyage`, `rattacher_ticket_cbg` (D-078) | écriture `trips` | site | motif pour les états exceptionnels |
| Cycle des fiches | fonctions D-089 | écriture du module du type de fiche | `site_permis` | `valider_fiche` refuse tout auteur de la saisie |
| Pesée CBG | fonctions D-081 | écriture `trips` ou `invoices` | site | annulation de relevé par une autre personne |

Saisie distincte de validation : `verifier_evenement_voyage` et
`valider_fiche` (D-089) le contrôlent côté serveur ; l'écran l'annonce.

Tests : pgTAP 66 (lecture seule refusée, auteur refusé, vérificateur refusé
à la validation, hors périmètre : journal vide et contrôles refusés, aucun
droit anonyme ni écriture directe vérifiés par `has_function_privilege` et
`has_table_privilege`).

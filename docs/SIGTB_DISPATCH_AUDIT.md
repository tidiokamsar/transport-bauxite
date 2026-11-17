# SIGTB : audit du Dispatch avant D-087

Audit du 2026-11-17 (date `date -u`), sur `main` au commit `9d1c769`, avant
la refonte « Dispatch Control Center » (D-087). Les références fichier:ligne
désignent l'état de `main` à ce commit.

## Ce qui marche (réutilisé tel quel)

| Élément | Référence | Constat |
|---|---|---|
| Cycle du voyage | `supabase/migrations/20261110120000_cycle_voyage.sql:109` (`trips_garde_cycle`) | Seul juge des états ; transitions par `avancer_voyage`, journal `trip_events` immuable. Inchangé. |
| Affectation | `supabase/migrations/20261121095000_perimetre_site_lectures.sql` (`decider_affectation`, dernière définition) | Contraintes CDC 11.4 (camion actif benne, chauffeur actif au permis valide, engin actif, un chauffeur par camion et par shift), périmètre D-075 avant toute lecture, décision historisée dans `decisions_dispatch`. Appelée telle quelle. |
| Habilitations | `20261120101000_correctifs_revue_r2.sql:159` (`garde_habilitations_voyage`) | Refus serveur d'un chauffeur non habilité à la date du voyage, sur toute écriture de `trips`. |
| Affectation groupée | `20261121100000_dispatch_voyages.sql` (`affecter_en_groupe`) | Rapport par voyage, un refus n'annule que son voyage. Inchangée. |
| Réaffectation après déchargement | `20261121100000_dispatch_voyages.sql` (`enchainer_voyage`), `src/components/Trips/VoyageSuivant.tsx` | Le camion d'un voyage livré prend un voyage suivant sans retour à KOGON. Réutilisée dans la fiche voyage. |
| Fiche voyage | `src/components/Trips/FicheVoyage.tsx:39` | Transitions, ticket CBG, incident (`IncidentVoyage`), enchaînement. Réutilisée dans le centre de contrôle. |
| Instance de shift | `20261116090000_postes.sql:27` (`postes`) | Le module Postes de travail porte déjà l'instance d'un shift (date, shift, site), avec équipe, événements, clôture, validation. Étendue, pas dupliquée. |
| Référentiel des shifts | `20261121160000_defauts_bloquants_j1.sql` (`definir_shift`, `journal_shifts`) | Shifts configurés, sans chevauchement, journalisés (D-078). Inchangé. |
| Simulation de scénarios | `src/components/Dispatch/SimulationScenarios.tsx` | Calcul expliqué, rien n'est écrit. Conservée. |
| Durées mesurées | `20261121100000_dispatch_voyages.sql:75` (`durees_voyages`) | Cycle et rotation mesurés sur le journal, NULL si absent. Réutilisée pour le temps de cycle observé. |

## Ce qui est faux

| Constat | Référence | Correction D-087 |
|---|---|---|
| Le filtre « Shift » du Dispatch se replie sur le premier shift (`?? shifts[0]`) : hors plage horaire, l'écran affiche « Shift Jour » comme s'il était le shift courant. | `src/components/Dispatch/DispatchView.tsx:45-54` | `shiftHoraire` (sans repli) dans `src/components/Dispatch/controle.ts` ; le sélecteur reste un filtre, l'état réel est celui de l'instance (onglet Shift). |
| La barre supérieure affiche « Aucun shift défini » dès que l'heure ne tombe dans aucune plage, alors que des shifts existent ; une erreur de lecture est aussi lue comme « aucun shift ». Elle présente un shift configuré comme « en cours » sans qu'aucun poste soit ouvert. | `src/components/Layout/TopBar.tsx:36-46`, `:75-80`, `:133-141` | `libelleShiftCourant` : « Shifts indisponibles » si la lecture échoue, « Aucun shift défini » si le référentiel est vide, « Hors plage horaire », « Shift X, non ouvert », et « Shift X en cours » seulement si une instance `postes` est ouverte ou en cours. |
| La clôture d'un poste ne regarde pas les voyages non terminés. | `20261116090000_postes.sql:221` (`cloturer_poste`) | Redéfinie : refus si des voyages ne sont pas terminés, sauf motif consigné par `cloturer_shift`. |
| `decider_affectation` se fie au seul `vehicles.status` : un camion à immobilisation ouverte dont le statut n'a pas suivi reste affectable ; aucun contrôle d'un camion ou d'un chauffeur engagé sur un autre voyage. | `20261121095000_perimetre_site_lectures.sql` (contraintes) | Garde `garde_dispatch_disponibilite` sur `trips` (toute écriture). |
| Deux dispatchers qui décident sur le même voyage : le second écrase le premier par une réaffectation (il suffit d'un motif), sans savoir que le voyage a changé. | `src/components/Dispatch/FenetreDecision.tsx:52` | `affecter_voyage` : version attendue (décisions et suspensions connues), verrou sans attente, SQLSTATE 40001 avec message. |
| L'écran choisissait « acceptée » ou « modifiée » sans que le serveur puisse vérifier l'écart à la recommandation. | `src/components/Dispatch/FenetreDecision.tsx:50-54` | Identifiants recommandés dans l'instantané ; `affecter_voyage` refuse « acceptée » si le choix diffère. |

## Ce qui manque (avant D-087)

- États planifié, en cours et annulé de l'instance de shift ; journal des transitions (`postes.statut` : ouvert, cloture, valide seulement, `20261116090000_postes.sql:33`).
- Plan de shift versionné : `preparer_voyages` (`20261110180000_dispatch.sql`) crée des voyages sans trace du calcul, de l'hypothèse ni de la correction.
- Besoin en voyages calculé à partir de la capacité utile et d'une hypothèse de charge saisie (l'écran utilisait la charge moyenne observée, `DispatchView.tsx:210`).
- Tableau de bord calculé côté serveur avec source, heure et « sans données ».
- Suspension et reprise d'un voyage par événement tracé.
- Supervision des voyages en cours avec ancienneté et source de la dernière transmission.
- Confiance de la recommandation selon la qualité des données.
- Vues des voyages par état dans le Dispatch.

## Limites constatées et conservées

- `affecter_en_groupe` (D-066) ne passe pas par le contrôle de version : chaque voyage est verrouillé par `decider_affectation`, une affectation groupée ne porte que sur des voyages préparés.
- `decider_affectation` reste exécutable directement par les comptes (tests et données d'exemple) : sans contrôle de version, mais avec toutes ses contraintes et les nouvelles gardes.
- Positions GPS : aucune donnée de traceur en production ; la supervision repose sur les événements déclarés.

# SIGTB : matrice des actions du Dispatch (D-087)

Toutes les écritures passent par une fonction serveur `SECURITY DEFINER`
(`search_path` vide), EXECUTE retiré à PUBLIC et anon. Droit : écriture
`trips` (`has_module_write('trips')`) sauf mention. Périmètre : `site_permis`
ou `voyage_permis` contrôlé avant toute lecture.

| Action | Fenêtre | Fonction | État requis | Motif | Contrôle de version | Journal |
|---|---|---|---|---|---|---|
| Planifier le shift | FenetreEtatShift | `planifier_poste` | aucune instance, date ≥ aujourd'hui, shift actif | non | verrou consultatif | `postes_journal` |
| Ouvrir le shift | FenetreEtatShift | `ouvrir_poste` | aucune instance ou planifié | non | verrou de ligne | `postes_journal` |
| Démarrer le shift | FenetreEtatShift | `changer_etat_poste(en_cours)` | ouvert | non | `postes.version` | `postes_journal` |
| Annuler le shift | FenetreEtatShift | `changer_etat_poste(annule)` | planifié, ouvert, en cours ; aucun voyage engagé | oui | `postes.version` | `postes_journal` |
| Préparer le shift | FenetrePreparationShift | `besoin_shift` (lecture), `confirmer_plan_shift` | instance planifiée, ouverte ou en cours | si correction ou sans proposition | version du plan | `plans_shift` |
| Accepter une recommandation | ligne ou FenetreDecision | `affecter_voyage` → `decider_affectation` | DRAFT, PLANNED | non | décisions + suspensions | `decisions_dispatch` |
| Modifier, refuser | FenetreDecision | `affecter_voyage` | DRAFT, PLANNED | oui | idem | `decisions_dispatch` |
| Réaffecter, changer de camion ou de chauffeur | FenetreDecision | `affecter_voyage` | ASSIGNED | oui | idem | `decisions_dispatch` (avant, après) |
| Affectation groupée | bouton | `affecter_en_groupe` (D-066) | DRAFT, PLANNED | non | non (limite) | `decisions_dispatch` |
| Enchaîner après déchargement | FicheVoyage | `enchainer_voyage` (D-066) | voyage livré | non | verrou par camion | `trip_events` |
| Suspendre | FenetreSuspension | `suspendre_voyage` | non terminé, non suspendu | oui | change la version | `suspensions_voyage` |
| Reprendre | FenetreSuspension | `reprendre_voyage` | suspendu | oui | change la version | `suspensions_voyage` |
| Avancer, annuler, interrompre | FicheVoyage | `avancer_voyage` (cycle) | selon `transition_voyage_autorisee` ; refus si suspendu sauf annulation | exceptions | verrou de ligne | `trip_events` |
| Déclarer un incident | FicheVoyage | `declarer_incident` | voyage visible | description | non | `incidents_journal` |
| Clôturer le shift | FenetreClotureShift | `cloturer_shift` → `cloturer_poste` | ouvert ou en cours ; présence pointée | si voyages non terminés | `postes.version` | `postes_journal` |
| Valider la clôture | écran Postes | `valider_cloture_poste` (droit `planning`, autre personne) | clôturé | non | verrou de ligne | `postes` |

## Lectures (SECURITY INVOKER, droits et RLS de l'appelant)

| Lecture | Fonction | Absence de donnée |
|---|---|---|
| Indicateurs | `indicateurs_dispatch(date, site, shift)` | valeur NULL, « sans données » |
| Supervision | `supervision_dispatch(date, site, shift)` | source NULL, « aucune transmission » |
| Besoin | `besoin_shift(date, site, shift, hypothèse)` | besoin NULL et base explicative |
| Habilitations | `habilitations_dispatch(date)` (SECURITY DEFINER, périmètre) | liste vide |

## Refus serveur et codes

| Cas | SQLSTATE |
|---|---|
| Sans droit, hors périmètre de site | 42501 |
| Voyage introuvable ou hors périmètre | P0002 |
| Règle métier (motif, état, ressource indisponible, immobilisée, engagée, non habilitée) | 22023 |
| Version périmée, verrou pris par un autre utilisateur | 40001 |

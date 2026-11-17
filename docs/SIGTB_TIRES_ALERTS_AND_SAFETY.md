# SIGTB - Pneus : alertes et securite (D-091)

## Alertes (catalogue D-068, `actualiser_alertes`)

13 regles, module `maintenance`, ecran `tires`, desactivables par `alerte_<regle>_active` (absent = en service, D-068). Les seuils viennent de `pneus_seuils` (champ par champ, portee la plus precise : modele, marque, dimension, application) ; sans seuil applicable, aucune alerte. Source : `v_pneus_surveillance`.

| Regle | Condition | Seuil |
|---|---|---|
| pneu_profondeur | derniere profondeur sous le seuil | profondeur_min_mm |
| pneu_inspection_retard | pneu monte sans inspection (ou depuis le montage) au-dela du delai | inspection_max_jours |
| pneu_degradation_rapide | usure du montage au-dessus du seuil (historique suffisant) | degradation_max_mm_1000km, mesures_min_projection |
| pneu_usure_irreguliere | ecart entre zones au-dessus du seuil | ecart_usure_max_mm |
| pneu_pression | pression mesuree hors plage | pression_min_bar, pression_max_bar |
| pneu_defaut_critique | defaut critique ouvert | - |
| pneu_non_localise | etat incoherent avec engin, position, site ou intervention | - |
| pneu_montage_incompatible | pneu monte hors configuration ou dimension | configuration |
| pneu_intervention_longue | intervention non retournee au-dela du delai | intervention_max_jours |
| pneu_garantie_proche | fin de garantie dans le preavis | garantie_preavis_jours, garantie_mois du pneu |
| pneu_cout_anormal | cout au km (donnees completes) au-dessus du seuil | cout_km_max |
| pneu_historique_incomplet | montage en cours sans compteur | - |
| pneu_duree_depassee | age (fabrication, achat, entree) au-dela de la duree | duree_max_jours |

## Blocages (reglages administrateur, desactives par defaut)

- `pneu_blocage_montage_actif` : montage refuse si defaut critique ouvert ou profondeur (derniere mesure ou mesure au montage) sous le seuil.
- `pneu_blocage_remise_service_actif` : `rechaper_pneu` et `reparer_pneu` directs refuses ; la remise en service passe par une intervention controlee et decidee.
- `pneu_configuration_exigee` : montage refuse sur un engin dont le modele n'a pas de configuration.

Toujours actifs : etat en stock, intervention en cours, engin existant non sorti de la flotte, perimetre, configuration quand elle existe, une position = un pneu.

## Immobilisation

Un defaut critique sur un pneu monte cree une proposition (`pneus_propositions_immobilisation`), jamais une immobilisation. `decider_proposition_immobilisation(id, accepter, motif, imputation)` (droit d'ecriture maintenance) : accepter appelle `declarer_immobilisation` (cause `pneumatique`, imputation choisie par la personne, D-025 ; absente : refus). La garde Dispatch `garde_dispatch_disponibilite` (D-087, non redefinie, `decider_affectation` non touchee) refuse alors l'affectation de l'engin ; la cloture de l'immobilisation le rend affectable (test 72).

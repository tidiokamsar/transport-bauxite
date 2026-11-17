# SIGTB - Pneus : modele de donnees (D-091)

## Tables

| Table | Role | Ecriture |
|---|---|---|
| `tires` | Carcasse : `code_sigtb` (PN-NNNNNN, sequence, permanent), `numero_serie` (unique si fourni), `sans_numero_motif`, marque, modele, dimension, `construction` (radiale, diagonale), `indice_charge`, `indice_vitesse`, `application`, `date_fabrication`, `code_dot`, `purchase_date`, `purchase_price`, `prix_source` (bon_commande, facture, saisie), `commande_id`, `facture_reference`, fournisseur, `garantie_mois`, `garantie_km`, `profondeur_initiale_mm`, `max_retreads` ; cache etat, engin, position, site | Fonctions ; colonnes descriptives D-052 par la politique `description` |
| `pneus_operations` | Journal append-only de toutes les operations | Fonctions |
| `pneus_configurations`, `pneus_configuration_positions` | Configurations par modele d'engin et positions | `definir_configuration_pneus`, `retirer_configuration_pneus` |
| `pneus_seuils` | Seuils par portee (dimension, marque, modele, application ; au moins un critere) | `definir_seuils_pneus`, `desactiver_seuils_pneus` |
| `pneus_criteres_rechapage` | Criteres d'acceptation au rechapage | `definir_critere_rechapage` |
| `pneus_parametres_journal` | Journal avant/apres du parametrage (append-only) | Fonctions |
| `pneus_interventions` | Reparation, vulcanisation, rechapage, expertise, autre (numero IPN-AAAA-NNNNN) | Fonctions d'intervention |
| `pneus_inspections` | Detail d'une operation `inspection` (immuable) | `inspecter_pneu_detail` |
| `pneus_propositions_immobilisation` | Propositions, decision humaine | `proposer_immobilisation_pneu`, `decider_proposition_immobilisation` |
| `pneus_requetes_client` | Idempotence par cle client | Fonctions |

## Vues (security_invoker)

`v_pneus` (colonnes D-052 puis D-091 en fin), `v_pneus_operations_effectives` (recreee pour les nouvelles colonnes), `v_pneus_montages` (D-052),
`v_pneus_episodes`, `v_pneus_mouvements`, `v_pneus_stock`, `v_pneus_usure`, `v_pneus_couts`,
`v_pneus_couts_synthese`, `v_pneus_indicateurs`, `v_pneus_positions_engins`, `v_pneus_surveillance` ;
`v_pneus_a_surveiller` et `v_pneus_performance` (D-052, D-067) inchangees.

## Reprise des donnees existantes

- Chaque pneu recoit un `code_sigtb` dans l'ordre de `created_at`.
- Le numero saisi (D-052, D-067) devient `numero_serie` s'il est unique ; un pneu de reception annulee (`-ANNULE-`) n'a pas de numero de serie (le declencheur `pneus_identite` le libere aussi pour les annulations futures).
- `profondeur_initiale_mm` reprise de l'operation d'entree.
- Index unique sur le numero saisi cree seulement s'il n'existe aucun doublon (sinon avertissement, rien n'est modifie).
- Les operations existantes restent telles quelles : episodes, mouvements et couts sont des vues sur elles. Aucune perte.

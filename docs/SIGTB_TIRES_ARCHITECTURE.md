# SIGTB - Pneus : architecture (D-091)

Etat au 2026-11-17. Migration `20261121230000_pneus_cycle_de_vie.sql`, test pgTAP 72.
Contexte (D-022) : KOGON est responsable des pneus, Neemba de la maintenance des engins loues.

## Audit de l'existant (avant D-091)

| Objet | Origine | Constat | Decision D-091 |
|---|---|---|---|
| `tires` | Bolt, repris D-052 | Registre ; etat, engin, position, site = cache recalcule du journal ; numero saisi unique par controle en fonction (pas d'index) ; colonnes Bolt inutilisees (health_score, qr_code, rfid_code, initial_km...) ; SELECT encore accorde a anon (RLS sans politique anon) | Etendu : code SIGTB permanent, numero de serie, caracteristiques ; index uniques ; droits anon retires ; colonnes Bolt laissees, non lues |
| `pneus_operations` | D-052 | Journal append-only (entree, montage, demontage, permutation, inspection, rechapage, reparation, reforme, annulation) | Etendu : transfert, envoi et retour d'intervention, remise en service, correction ; `donnees`, `intervention_id`, `cle_client` |
| `receptions_achat_pneus` | D-067 | Lien reception de bon de commande vers pneu ; prix de la ligne | Inchange ; source du cout d'acquisition (deja compte par les achats) |
| `purchase_order_items.pneu_*` | D-067 | Modele de pneu sur une ligne de bon | Inchange |
| `stock_items`, `stock_movements` | D-044, D-067 | Magasin des articles ; les pneus n'y sont pas | Inchange : le stock pneus est un stock individuel calcule du journal |
| `vehicles.brand_model` | base | Modele d'engin, texte libre | Cle de rattachement des configurations de positions |
| `immobilisations` | D-025 | Indisponibilite d'engin, cause `pneumatique` existante | Cible des propositions d'immobilisation acceptees |
| `releves_compteur`, `v_releves_compteur` | D-045 | Km releves | Km du montage en cours (`v_pneus_montages`, D-052) |
| `trips`, `tickets_pesee_cbg`, `pointages_engins` | D-037, D-028 | Voyages, tonnes, heures | Sources des indicateurs a la tonne et a l'heure |
| `pieces_jointes` | D-083 | 5 types d'objets J1 | Etendu : `pneu`, `pneu_inspection`, `pneu_intervention` |
| `alerts`, `catalogue_regles_alertes`, `v_alertes_candidates` | D-068 | Registre et moteur de regles | 13 regles pneus ajoutees |
| `tire_*` (Bolt) | Bolt | Archivees dans `archive_bolt` (D-071) | Non reprises |
| `settings` pneu_* | D-052, D-067 | Seuils globaux (profondeur, inspection, reforme precoce) | Conserves pour `v_pneus_a_surveiller` et `v_pneus_performance` ; les seuils D-091 sont par portee (`pneus_seuils`) |

## Principes

- Un seul registre (`tires`) et un seul journal (`pneus_operations`) ; le reste est derive (vues) ou rattache.
- Ecriture par fonctions `SECURITY DEFINER`, `search_path` vide ; aucune ecriture directe ; aucun solde stocke.
- Aucune valeur inventee : configurations, seuils, criteres et plafonds viennent du parametrage ; sans eux, le controle ou l'alerte correspondant est inactif, jamais remplace par une valeur par defaut.
- Le systeme propose (immobilisation), l'humain decide.

Detail : `SIGTB_TIRES_DATA_MODEL`, `_LIFECYCLE`, `_POSITION_CONFIGURATION`, `_INSPECTION_STANDARD`, `_RETREAD_MANAGEMENT`, `_COST_MODEL`, `_ALERTS_AND_SAFETY`, `_INTEGRATIONS`, `_PERMISSIONS`, `_QA`, `_PROGRESS`, `_PRODUCT_SPEC`.

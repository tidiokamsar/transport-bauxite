# SIGTB - Pneus : configurations de positions (D-091)

- Une configuration par modele d'engin (`vehicles.brand_model`, compare sans casse ni espaces multiples), active ou retiree ; aucune configuration par defaut ni supposee.
- Position : code stable (normalise en majuscules), essieu, cote (gauche, droite, centre), rang (simple, interieure, exterieure), secours, dimensions admises (liste ; vide = aucune restriction declaree), ordre.
- `definir_configuration_pneus(code, libelle, modele, positions jsonb, notes, motif)` : creation, ou modification motivee ; une position absente du nouveau jeu est desactivee (jamais supprimee), refus si un pneu y est monte. Journal avant/apres.
- `retirer_configuration_pneus(id, motif)` : refus si des pneus sont montes sur un engin du modele.
- Droit : administrateur, ou approbateur de la maintenance a perimetre global.

Exemple de position : `{"code": "E2-G-EXT", "essieu": 2, "cote": "gauche", "rang": "exterieure", "dimensions": ["315/80 R22.5"], "ordre": 3}` ; secours : `{"code": "SECOURS", "secours": true}`.

## Controles au montage et a la permutation

1. Engin avec configuration : position connue et active, dimension du pneu admise (refus si la dimension du pneu est inconnue et que la position en exige une).
2. Engin sans configuration : montage a position libre (comportement D-052), sauf si le reglage `pneu_configuration_exigee` vaut `true`.
3. Une position = un pneu ; un pneu = une position (index `ux_tires_position_montee` et controle explicite sous verrou consultatif de l'engin).

Lecture : `v_pneus_positions_engins` (positions configurees par engin et pneu qui les occupe), `configuration_pneus_engin(engin)`, `position_pneu_incompatible(engin, position, dimension)`.

## A fournir par le proprietaire

Pour chaque modele d'engin de Nimba (camions semi-remorques, chargeuses Caterpillar, pelle) : positions (essieux, cotes, jumelage, secours) et dimensions admises par position.

# SIGTB - Pneus : standard d'inspection (D-091)

`inspecter_pneu_detail(pneu, inspecte_le, nature, mesures, pression_bar, temperature_c, constats, recommandation, km, note, cle_client)` rend l'identifiant de l'inspection (`pneus_inspections.id`).

- `inspecte_le` : date reelle de l'inspection, distincte de la saisie (`saisi_le`).
- `nature` : `mesure`, `observation`, `declaration` (ex. chauffeur), `import`. Une inspection `mesure` exige au moins une mesure ; toute inspection exige une mesure ou un constat.
- `mesures` : objet `{zone: profondeur mm}` (zones libres, ex. EXT, CENTRE, INT). La profondeur retenue est le minimum des zones ; l'ecart (max - min) est calcule a partir de deux zones.
- Pression et temperature : seulement si mesurees ; absentes = NULL.
- `constats` : liste `{code, gravite (info, majeur, critique), description}`. Un constat critique ouvre un defaut critique ; sur un pneu monte, une proposition d'immobilisation est creee (jamais d'immobilisation automatique).
- `recommandation` : aucune, surveiller, permuter, demonter, reparer, rechaper, reformer, immobiliser.
- Un defaut critique est leve par une inspection detaillee posterieure sans defaut critique, un retour d'intervention, une remise en service ou une reforme (`pneu_defaut_critique_ouvert`).
- Pneu reforme ou en intervention : inspection refusee.

## Analyse d'usure (`v_pneus_usure`)

Sur le montage en cours, points ayant profondeur et compteur du meme engin (montage et inspections). Taux (mm/1000 km) et projection (km restants jusqu'au seuil minimal) seulement si le nombre de mesures atteint `mesures_min_projection` (seuils) et si la distance est positive ; sinon « donnees insuffisantes ». Aucun seuil universel : une portee de seuil exige au moins une dimension, une marque, un modele ou une application.

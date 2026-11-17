# SIGTB : moteur de recommandation du Dispatch (D-024, étendu par D-087)

Code : `src/components/Dispatch/recommandation.ts` (`recommander`,
`evaluerConfiance`, `instantane`). Tests : `recommandation.test.ts`,
`controle.test.ts`. Calcul dans l'interface, comme D-024 ; le serveur reste
seul juge des contraintes. Déterministe : mêmes données, même proposition. Pas
d'optimisation opaque, pas d'affectation automatique.

## Données d'entrée (toutes lues en base)

| Donnée | Source |
|---|---|
| Voyages du shift | `trips` (date, site de départ, shift) |
| Camions et engins | `vehicles` (statut, type, site, `capacity_tonnes`) |
| Immobilisations ouvertes | `immobilisations.statut = 'ouverte'` |
| Chauffeurs | `drivers` (statut, permis) |
| Habilitations manquantes | `habilitations_dispatch(date)` (périmètre ; non lue = non vérifiée par l'écran) |
| Chauffeurs engagés hors du shift | `trips` engagés de la veille et du jour |
| Chauffeur habituel | voyages des 14 jours précédents |
| Temps de cycle observé | `durees_voyages` des 14 jours précédents, même site et shift |
| Sanctions de conduite | `sanctions_infraction` (avertissement seulement, D-066) |

Non disponibles, donc non utilisées : distance, capacités du dépôt, files
d'attente réelles, positions (extensions à déclencheur).

## Règles, dans l'ordre

1. **Camion** : actif, benne, du site de chargement (ou sans site), sans
   immobilisation ouverte, pas le camion à remplacer ; le moins de voyages sur
   le shift, puis l'immatriculation.
2. **Chauffeur** : celui déjà au volant de ce camion sur le shift, sinon le
   chauffeur habituel (14 jours), sinon le premier chauffeur libre par nom ;
   toujours actif, au permis valide à la date, habilité (si lu), non engagé
   avec un autre camion hors du shift, sur un seul camion du shift.
3. **Engin de chargement** : chargeuse ou pelle active du site, sans
   immobilisation ouverte, la file la plus courte.
4. Chaque proposition compte dans les suivantes (charge simulée).

## Sortie par voyage

Camion, chauffeur, engin, destination (celle du voyage), capacité retenue,
durée estimée (temps de cycle observé, sinon « non mesurée »), contraintes
vérifiées, explications, avertissements, raison bloquante éventuelle, et
**confiance** :

| Critère de qualité | Manque nommé |
|---|---|
| Chauffeur connu (au volant ou habituel) | aucun historique du chauffeur sur ce camion |
| Temps de cycle mesuré | temps de cycle non mesuré sur ce shift |
| Capacité du camion connue | capacité du camion inconnue |
| Habilitations lues | habilitations non lues |

4 critères : élevée ; 2 ou 3 : moyenne ; 0 ou 1, ou proposition impossible : faible.

## Décision et traçabilité

L'instantané (`instantane`) est envoyé avec la décision : identifiants
(`camion_id`, `chauffeur_id`, `engin_id`), libellés, capacité, durée,
confiance, contraintes, explications. `affecter_voyage` refuse une décision
« acceptée » qui ne reprend pas ces identifiants ; tout autre choix est
« modifié », motivé, historisé avec la ressource remplacée.

# SIGTB - Pneus : droits (D-091)

Aucun nouveau role ni module : les modules existants `vehicles` et `maintenance` (D-052), avec la matrice role x module (D-012), les droits par utilisateur (D-036) et les delegations (D-064, D-082). Perimetre : engin si le pneu est monte, sinon site de stockage (`pneu_permis`, D-038).

| Action | Droit |
|---|---|
| Lire pneus, configurations, seuils, interventions, inspections | lecture `vehicles` ou `maintenance`, perimetre du pneu |
| Creer, monter, demonter, permuter, transferer, inspecter, envoyer, retourner, controler, corriger, reformer, proposer une immobilisation | ecriture `vehicles` ou `maintenance`, perimetre |
| Decider une proposition d'immobilisation | ecriture `maintenance` (comme `declarer_immobilisation`) |
| Decider une remise en service | approbation `maintenance` ou administrateur, separation des taches (`separation_violee`) |
| Parametrer (configurations, seuils, criteres) | administrateur, ou approbation `maintenance` a perimetre global |
| Blocages et activations d'alertes | administrateur (`settings`, `valider_reglage`) |

## Roles metier (par droits par utilisateur, sans nouveau role)

- Gestionnaire pneumatique : `maintenance_chief`, plus une delegation d'approbation `maintenance` pour decider les remises en service.
- Magasinier pneus : `logistician` (stocks) avec ecriture `maintenance` pour receptionner les pneus.
- Inspecteur : ecriture `maintenance`, profil affecte a son site.
- Chauffeur : lecture seule ; ses declarations sont saisies par un inspecteur (nature `declaration`).

Les comptes reels et leurs droits sont a creer par le proprietaire.

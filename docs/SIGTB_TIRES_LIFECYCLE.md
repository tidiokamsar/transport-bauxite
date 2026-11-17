# SIGTB - Pneus : cycle de vie (D-091)

## Etats (cache `tires.status`, recalcule du journal)

| Etat | Sens | Entre par |
|---|---|---|
| `stored` | En stock, reutilisable | entree, demontage reutilisable, transfert, remise en service, rechapage ou reparation directs (D-052) |
| `active` | Monte sur un engin a une position | montage, permutation |
| `damaged` | A controler ou a decider | demontage « a decider », retour d'intervention |
| `en_intervention` | Chez le prestataire | envoi en intervention |
| `retired` | Reforme definitive | reforme |

## Operations (fonctions)

- Creation : `creer_carcasse_pneu` (numero de serie, ou motif sans numero) ; `enregistrer_pneu` (D-052) et la reception d'un bon (D-067) restent valides et recoivent un code SIGTB.
- Montage : `monter_pneu`, `permuter_pneu`, `demonter_pneu` (controles : `SIGTB_TIRES_POSITION_CONFIGURATION`, `SIGTB_TIRES_ALERTS_AND_SAFETY`).
- Stock : `transferer_pneu` (site a site, motif).
- Inspection : `inspecter_pneu_detail` ; `inspecter_pneu` (D-052) reste disponible.
- Intervention : `envoyer_pneu_intervention`, `enregistrer_retour_intervention`, `controler_intervention_pneu`, `decider_remise_en_service_pneu`, `annuler_intervention_pneu`.
- Reforme : `reformer_pneu`, ou decision `reforme` d'une intervention.
- Correction : `corriger_caracteristiques_pneu` (operation `correction`, avant et apres ; le code SIGTB ne change jamais) ; `annuler_operation_pneu` (derniere operation, motif). Une correction ou un retour d'intervention ne s'annulent pas ; l'annulation d'un envoi annule l'intervention ; celle d'une remise en service la rend a decider.

## Episodes de service (`v_pneus_episodes`)

Neuf (entree), puis un episode a chaque remise en service : `apres_reparation`, `apres_rechapage` (numero de cycle), `apres_controle` (expertise ou autre). Un rechapage ne cree jamais de carcasse.

## Regles

Chronologie imposee (une operation n'est pas anterieure a la derniere du pneu, D-052 : une inspection saisie en retard doit l'etre avant les operations suivantes) ; aucune suppression physique d'une carcasse avec historique ; un pneu reforme ne recoit plus d'operation.

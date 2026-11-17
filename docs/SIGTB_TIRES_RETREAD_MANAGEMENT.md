# SIGTB - Pneus : rechapage et interventions (D-091)

Circuit : envoi, retour, controle, decision.

1. `envoyer_pneu_intervention(pneu, type, prestataire, date, type_autre, fournisseur, criteres, reference, note, cle_client)` : pneu demonte (stock ou a decider) ; une seule intervention ouverte par pneu ; numero `IPN-AAAA-NNNNN` ; pneu `en_intervention`.
   Rechapage : cycle = rechapages effectifs + 1 ; refus au-dela du nombre admissible (`tires.max_retreads`, sinon `pneus_seuils.rechapages_max` ; sans plafond parametre, aucun plafond n'est suppose) ; chaque critere d'acceptation applicable (`pneus_criteres_rechapage`, portee dimension, marque, modele) doit etre renseigne (`{"CODE": true|false}`), un critere bloquant non satisfait refuse l'envoi.
2. `enregistrer_retour_intervention(intervention, site, date, cout, profondeur, constats, garantie_mois, garantie_km, reference, bon_commande, facture, cle_client)` : operation de cout (`rechapage`, `reparation`, ou `retour_intervention` pour expertise et autre) ; pneu `damaged` (a controler).
3. `controler_intervention_pneu(intervention, conforme, note)` : constat obligatoire si non conforme.
4. `decider_remise_en_service_pneu(intervention, decision, motif)` : approbateur de la maintenance (`has_module_approve('maintenance')`) ou administrateur, distinct de l'auteur du retour et du controle (`separation_violee`, delegations D-082 comprises). Decisions : `remis_en_service` (controle conforme exige ; nouvel episode), `reforme`, `a_reprendre` (pneu a decider, nouvelle intervention possible).
5. `annuler_intervention_pneu(intervention, motif)` : avant le retour seulement (annulation motivee de l'envoi).

Le rechapage et la reparation directs D-052 (`rechaper_pneu`, `reparer_pneu`, utilises par l'ecran actuel) restent disponibles tant que le blocage `pneu_blocage_remise_service_actif` est desactive.

## A fournir par le proprietaire

Nombre de rechapages admis (par dimension, modele ou fabricant) ; criteres d'acceptation des carcasses ; prestataires.

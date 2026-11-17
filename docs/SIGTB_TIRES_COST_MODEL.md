# SIGTB - Pneus : modele de couts (D-091)

`v_pneus_couts` : une ligne par cout, categorie `acquisition`, `reparation` (reparation, vulcanisation), `rechapage`, `prestations` (expertise), `autres`. Montants en GNF (comme D-052).

- Acquisition : prix d'achat du pneu ; source `bon_commande` (reception D-067, ou bon cite), `facture` (reference obligatoire), `saisie`. Sans source, un prix est refuse par `creer_carcasse_pneu` et `corriger_caracteristiques_pneu`.
- Interventions : cout saisi au retour ; source bon de commande, facture ou saisie.
- `deja_compte_achats` : la depense passe deja par le circuit achats (bon de commande engage puis paye). Elle ne doit pas etre ajoutee une seconde fois a une depense agregee (meme logique que `costs.piece_reprise_*`, D-082). `v_pneus_couts_synthese.hors_achats` donne la part propre aux pneus.
- Un cout inconnu rend le total NULL (`couts_inconnus` le compte) : rien n'est estime.

## Indicateurs (`v_pneus_indicateurs`)

- Cout au km : km de chaque montage connus (compteurs au montage et au demontage, ou dernier releve, D-052).
- Cout a l'heure : chaque montage couvert par au moins un pointage de l'engin (fiches non annulees).
- Cout a la tonne : chaque montage avec au moins un voyage livre et un ticket CBG pour chacun.
- Sinon NULL et libelle « donnees insuffisantes ».

Limites : periodes au jour (un jour de montage partiel compte en entier) ; tonnes au net du ticket (rectifications D-037 non reprises) ; un pointage present ne prouve pas que toutes les heures sont pointees.

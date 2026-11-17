# SIGTB - Pneus : recette (D-091)

Test pgTAP `supabase/tests/database/72_pneus_cycle_de_vie.test.sql` (117 assertions), rejoue par `npm run test:rls:rejeu`. Tests 35 (D-052) et 50 (D-067) inchanges et verts.

| Scenario de la specification | Couvert par |
|---|---|
| Creation de carcasse | code SIGTB, numero normalise, caracteristiques |
| Doublon de serie | `creer_carcasse_pneu` et `enregistrer_pneu` refuses (23505) |
| Creation sans numero | refus sans motif ; code SIGTB comme numero |
| Reception | bon de commande vers carcasse codee, mouvement `reception`, cout deja compte |
| Entree | stock calcule par site, mouvement `entree` |
| Montage | position et dimension de la configuration ; engin sans configuration |
| Double montage | pneu deja monte ; position occupee |
| Permutation | echange, operations liees, position inconnue refusee |
| Demontage | pneu a decider, libere de l'engin |
| Inspection | nature, date reelle, inspection vide refusee |
| Mesure | multi-zones, minimum, ecart ; pression et temperature non mesurees vides |
| Usure | pas de projection avec deux mesures ; taux avec trois |
| Alerte critique | profondeur, defaut critique, usure irreguliere, historique incomplet ; pression sans plage : aucune |
| Reparation | envoi, montage refuse en intervention, retour, controle, decision |
| Rechapage et deuxieme cycle | criteres, cycle 1 et 2, plafond, meme carcasse |
| Retour stock | `stored` apres decision |
| Remise en service | role sans approbation refuse ; separation des taches |
| Reforme | definitive ; plus aucune operation |
| Couts | categories, total NULL si cout inconnu |
| Absence de km | indicateurs « donnees insuffisantes » |
| Historique | suite complete des mouvements, episodes |
| Permissions | anon, chauffeur, compte d'un autre site, parametrage ; droits revoques verifies par `has_table_privilege` et `has_function_privilege` |
| Double soumission | cle client : meme resultat, une operation ; cle reutilisee refusee |
| Conflit concurrent | index unique de position et controle sous verrou (test sequentiel : un vrai test concurrent demande deux sessions) |
| Immobilisation proposee | proposition sans immobilisation ; imputation exigee ; Dispatch refuse l'engin |
| Reintegration | cloture de l'immobilisation : engin affectable ; remise en service du pneu |
| Correction | correction tracee avant/apres, non annulable ; annulation compensatoire d'un montage |

Aussi : blocages actifs (profondeur, configuration exigee, remise directe), pieces jointes, transfert, suppression physique refusee.

Donnees d'exemple D-084 : `charger.sql` puis `purger.sql` (apercu, puis purge a 0 ligne rattachee) rejoues dans le conteneur de rejeu apres la migration : chargement et purge complets.

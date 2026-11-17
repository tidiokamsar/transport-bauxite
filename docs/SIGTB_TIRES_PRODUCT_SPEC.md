# SIGTB - Tire Management System : specification (resume, D-091)

Specification du proprietaire (2026-11-17), resumee. KOGON gere les pneus ; Neemba la maintenance des engins (D-022).

- Carcasse a identite permanente (code SIGTB, numero de serie fabricant unique), caracteristiques et documents d'achat.
- Episodes de service : neuf, apres reparation, apres rechapage n ; un rechapage ne cree jamais de carcasse.
- Configurations de positions parametrables par modele d'engin, sans configuration inventee.
- Montage, permutation, demontage controles et atomiques.
- Inspections datees, multi-zones, de nature declaree, sans valeur inventee ; analyse d'usure sur seuils configurables.
- Interventions numerotees ; remise en service decidee par un role habilite, separation des taches.
- Stock calcule depuis les mouvements ; reforme tracee ; corrections compensatoires ; aucune suppression physique.
- Couts par categorie sans double compte ; indicateurs au km, a l'heure, a la tonne sur donnees fiables seulement.
- Alertes configurables ; blocages approuves et configures ; proposition d'immobilisation, jamais automatique.
- Droits par module et site ; pieces jointes ; idempotence preparee pour la saisie terrain (hors ligne hors perimetre).

Realisation : `SIGTB_TIRES_PROGRESS.md`.

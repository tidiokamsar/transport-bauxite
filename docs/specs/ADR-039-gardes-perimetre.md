# ADR-039 : gardes de perimetre sur les ecritures (LOT 02, phase 2)

## Statut

Acceptee (D-039) ; implementee, non deployee a ce jour.

## Contexte

D-038 borne les policies RLS par site, mais les fonctions SECURITY DEFINER
(avancer_voyage, saisies de fiches, dispatch, immobilisations...) ecrivent
en tant que proprietaire : elles passent outre la RLS et le perimetre.

## Decision

Garantie au niveau des donnees : declencheurs BEFORE INSERT/UPDATE/DELETE
qui verifient `site_permis` pour le compte appelant (auth.uid()) sur
trips (depart OU arrivee), vehicles, drivers, fiches_terrain,
pointages_engins (site de la fiche) et immobilisations (site du vehicule).

Branches separees par table dans la garde : un CASE unique resoudrait
ligne.site_id pour toutes les tables a la planification (tables liees sans
cette colonne).

## Consequences

- Une fonction future qui oublierait le perimetre est bloquee quand meme.
- Comptes globaux non bornes ; contexte interne sans JWT ignore
  (migrations, demo).
- Les verifications metier des fonctions (etats, droits de module) restent
  en place : la garde est un plancher, pas un remplacement.
- pgTAP 23 : ecritures directes bornees (cree/modifie/supprime), tables
  liees par fiche et vehicule, et preuves par les fonctions reelles
  saisir_pointage, declarer_immobilisation et annuler_fiche.

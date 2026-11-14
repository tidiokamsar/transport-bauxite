# ADR-038 : perimetre site dans le modele d'acces (LOT 02, phase 1)

## Statut

Acceptee (D-038) ; implémentee, non deployee a ce jour.

## Contexte

L'audit des ecarts (P1) constate que la RLS filtre par role et module mais
sans portee par site : un compte autorise lit tous les sites. Le plan de
transformation place les scopes organisation/site en Lot 2.

## Decision

- Referentiel `organisations` : creation administrative seule, lecture pour
  tout compte connecte. `sites.organisation_id` : repris de la fiche societe
  si renseignee, sinon a saisir. Aucune organisation inventee.
- `drivers.site_id` (nullable), meme sens que `vehicles.site_id`.
- `site_permis(site)` : compte actif requis ; site NULL sur le profil =
  global (tout voit, inchange) ; site affecte = son site seulement ; ligne
  sans site = comptes globaux seulement (strict plutot que permissif).
- Policies bornees : lecture de vehicles, trips (depart OU arrivee), drivers,
  fiches_terrain ; ecriture de vehicles, trips, drivers. La policy FOR ALL
  heritee (D-021) s'appliquait aussi au SELECT et passait outre le perimetre :
  elle est bornee pareillement.
- Affectation du site d'un compte : Parametres -> Utilisateurs. Les droits
  fonctionnels (D-012, D-036) restent le premier filtre.

## Consequences et limites

- Un compte sans affectation de site garde exactement l'acces d'avant :
  aucune migration de donnees necessaire au deploiement.
- Les fonctions serveur (creer_voyage, avancer_voyage, saisir_rotation,
  saisir_pointage, saisir_carburant...) ne sont pas encore bornees par site :
  phase 2, avant l'ouverture a des comptes multi-sites.
- MFA/AAL (signatures, droits, controles) : Lot 2 suite, non couvert ici.
- pgTAP 22 couvre : site_permis, lectures et ecritures bornees (un UPDATE
  sur une ligne masquee modifie 0 ligne, sans erreur : semantique RLS
  PostgreSQL), comptes globaux inchanges, referentiel organisations.

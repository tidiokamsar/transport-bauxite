# ADR-040 : socle MFA/AAL pour les operations sensibles (LOT 02, phase 2)

## Statut

Acceptee (D-040) ; implementee, non deployee a ce jour.

## Contexte

Le plan Lot 2 demande l'authentification renforcée pour les signatures, les
droits et les contrôles. Aucun compte n'a encore de facteur TOTP : une
application immediate verrouillerait la production.

## Decision

Declencheur `garde_aal2` (avant ecriture) exigeant la revendication aal2
du jeton, actif seulement quand le reglage settings `mfa_exige` vaut true.
Couvre : ecritures de `droits_utilisateur` (D-036), insertions dans
`rectifications_tickets_pesee_cbg` (D-037), passage d'une facture au
statut signe (D-029). La facture reste modifiable en brouillon sans aal2.
La revendication se lit dans request.jwt.claims (auth.jwt() n'est pas
expose sur cette pile).

## Consequences et limites

- Sans reglage : aucun changement en production.
- Activation par l'administrateur (Parametres, cle mfa_exige = true)
  APRES inscription des facteurs TOTP des comptes concernes.
- Limite : inscription TOTP et ecran de gestion des facteurs a venir cote
  client ; jusqu'alors, laisser le reglage desactive.
- PL/pgSQL : SELECT INTO sans ligne laisse la variable a NULL ; la garde
  traite NULL comme reglage absent (test 24).

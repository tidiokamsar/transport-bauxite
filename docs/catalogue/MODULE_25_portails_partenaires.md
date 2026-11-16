# Module 25 : Portails partenaires

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d).

**Extension à déclencheur (bloc 1, section 9 de `CLAUDE.md`).** Un portail
n'est pas commencé avant **l'accord du partenaire concerné et un test
d'isolation RLS vert**. D-077 maintient cette règle. Cette fiche décrit la
cible pour qu'elle soit prête le jour où le déclencheur est levé ; aucun
lot n'est proposé avant.

## 1. Objectifs et périmètre

Ouvrir à chaque partenaire de Kogon Mining un accès restreint à ses seuls
dossiers, pour qu'il dépose ses pièces et réponde dans SIGTB au lieu du
courriel et du papier :

- **CBG** (client, et fournisseur de carburant D-034) : consulter les
  rotations livrées et tickets rattachés de ses périodes, déposer les
  relevés de pesée (aujourd'hui importés en CSV par Kogon, D-050),
  consulter les écarts et y répondre, consulter les factures émises et
  leur statut d'encaissement, déposer les documents de livraison de
  carburant.
- **Neemba** (loueur des engins, D-022, D-027) : consulter les
  immobilisations et demandes d'intervention de ses engins, saisir
  l'arrivée du technicien, le rapport d'intervention et les pièces
  remplacées (D-049), consulter les pointages, déposer ses factures et
  répondre aux réclamations issues du contrôle (D-032, D-033).
- **Fournisseurs** (D-059) : déposer documents administratifs, offres
  aux consultations, factures ; suivre leurs commandes et paiements.
- **Transporteurs sous-traitants** : seulement si l'exploitation en
  emploie (à confirmer par le propriétaire ; `vehicles.propriete` admet
  `sous_traitant`, D-062).

Le portail ne décide jamais à la place de Kogon : une pièce déposée par un
partenaire reste « soumise » jusqu'à la décision d'un agent Kogon (le
système recommande, l'humain décide).

Décisions de référence : D-042 (portail client Bolt retiré : données
fabriquées, aucun cloisonnement), D-038 et D-046 (périmètre site,
référentiel `organisations`), D-036 (droits par utilisateur), D-040 et D-045
(MFA), D-049, D-050, D-032, D-059, D-077. Dépendances préalables : GED et
stockage des pièces (module 23, lot D, reporté : service Storage absent de
la pile de production, `docs/SIGTB_MASTER_EXECUTION_PLAN.md`, entrée du lot
14), identité partenaire (module 02).

## 2. Sous-modules

| Sous-module | Contenu cible |
|---|---|
| 25.1 Comptes partenaires | Organisation partenaire, utilisateurs externes, rôle partenaire, MFA obligatoire, invitation et révocation |
| 25.2 Portail CBG | Rotations et tickets de ses contrats, relevés, écarts, factures et encaissements, livraisons carburant |
| 25.3 Portail Neemba | Engins loués, immobilisations, interventions, pointages, factures, réclamations, évaluations |
| 25.4 Portail fournisseurs | Documents administratifs, consultations et offres, commandes, réceptions, factures, paiements |
| 25.5 Portail transporteurs | Selon besoin confirmé |
| 25.6 Échanges | Dépôt documentaire, réponses aux demandes, réclamations, notifications, suivi des validations, historique |

## 3. Menus et sous-menus

Aucune entrée. Le module de droit `client_portal` existe dans
`role_permissions` (`20260903000000_base_reference.sql:12326`, `:12345`) et
son libellé dans `src/components/Settings/UserModal.tsx:69`, sans écran.
Cible : application séparée ou espace dédié, menu réduit au périmètre du
partenaire, jamais le menu interne.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Portail client (Bolt) | - | MANQUANT (retiré) | D-042, point 3 |
| Connexion partenaire et accueil | organisation, dossiers ouverts | MANQUANT | - |
| CBG : livraisons et tickets d'une période | rotations livrées, ticket, poids, écarts | MANQUANT | - |
| CBG : dépôt d'un relevé de pesée | fichier CSV ou PDF, contrôle de format | MANQUANT | l'import interne existe (`Fiches/TicketsCbgView.tsx:118`, D-050) |
| CBG : factures et encaissements | factures émises, reste dû | MANQUANT | - |
| Neemba : immobilisations et interventions | demandes, délais, saisie technicien | MANQUANT | saisie interne existante (`Maintenance/InterventionsLoueurView.tsx`, D-049) |
| Neemba : dépôt de facture et réclamations | facture et lignes par engin, réponse aux écarts | MANQUANT | saisie interne existante (`Contrats/FacturesNeembaView.tsx`, D-032) |
| Fournisseurs : documents, offres, commandes, paiements | - | MANQUANT | saisie interne existante (`Suppliers/*`, D-059) |
| Administration des comptes partenaires | invitation, révocation, journal | MANQUANT | - |

## 5. Widgets et tableaux de bord

Cible par partenaire : CBG (tonnes livrées et acceptées du mois, tickets
manquants, écarts ouverts, factures non réglées) ; Neemba (engins
immobilisés, interventions en retard, factures en contrôle, réclamations
ouvertes) ; fournisseur (commandes en cours, documents expirant, paiements).
Chaque chiffre avec source, période, heure (règle 5). Tous MANQUANT.

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Archiver | Supprimer | Annuler/corriger |
|---|---|---|---|---|---|---|
| Compte partenaire | MANQUANT (administrateur Kogon) | MANQUANT | MANQUANT | MANQUANT (désactiver) | interdit | révocation journalisée |
| Dépôt de pièce (relevé, facture, rapport, document) | MANQUANT (partenaire) | MANQUANT | brouillon seulement | - | brouillon jamais soumis | retrait motivé avant décision ; après décision : nouvelle pièce |
| Réponse à une demande ou réclamation | MANQUANT | MANQUANT | interdit après envoi | - | - | nouvelle réponse |
| Dossiers Kogon (voyages, factures, interventions) | - | MANQUANT (lecture seule filtrée) | interdit | - | - | - |

## 7. Modals et drawers

Cible : dépôt de pièce (AttachmentModal : type, période, fichier, contrôle
de type et de taille), réponse à une réclamation (texte, pièces), détail
d'un dossier en lecture (DetailDrawer, sans données internes : coûts,
marges, notes internes masqués), historique des échanges (HistoryDrawer).
Tous MANQUANT.

## 8. Champs des formulaires

| Formulaire | Champs | Règles serveur cibles |
|---|---|---|
| Invitation partenaire | organisation, nom, courriel, rôle partenaire, périmètre (contrats, sites), expiration | administrateur Kogon ; MFA exigé à la première connexion ; aucun droit interne |
| Dépôt relevé CBG | contrat, période, fichier | format du relevé identique à l'import interne (D-050) ; doublon de ticket signalé (`doublon_releve`, D-072) |
| Dépôt facture Neemba | contrat, période, numéro, date, lignes (engin, quantité, unité, taux, montant), fichier | unité du tarif de l'engin (D-033) ; contrôle automatique `controler_facture_fournisseur` ; statut « reçue », jamais « conforme » sans agent |
| Rapport d'intervention Neemba | intervention, arrivée technicien, travaux, pièces remplacées, fin | seulement les interventions de ses engins ; remise en service validée par Kogon (D-049) |
| Offre fournisseur | consultation, prix TTC, délai, validité, fichier | seulement les consultations où il est invité ; prix TTC (D-072, à confirmer) |

## 9. Actions individuelles et en masse

Cible : déposer, soumettre, retirer avant décision, répondre, consulter,
télécharger une pièce autorisée, marquer une notification lue. Aucune
action en masse côté partenaire. Tous MANQUANT.

## 10. Statuts et transitions

Cible, pièce déposée :

```
brouillon -> soumise              (partenaire)
soumise -> retiree                (partenaire, motif, tant qu'aucune décision)
soumise -> acceptee | rejetee     (agent Kogon du module ; motif si rejet ; notification au partenaire)
acceptee -> integree              (création de l'objet interne par la fonction serveur du module : relevé CBG, facture fournisseur, rapport d'intervention)
```

## 11. Workflows

- Relevé CBG : dépôt -> contrôle de format -> rapprochement automatique
  (D-050) -> décision des écarts par Kogon -> écarts visibles par CBG ->
  réponse CBG.
- Facture Neemba : dépôt -> contrôle sur pointages et tarifs (D-032, D-033)
  -> réclamation notifiée -> réponse Neemba (avoir ou justification) ->
  décision Kogon -> paiement (D-055).
- Intervention Neemba : demande Kogon -> prise en charge et rapport par
  Neemba -> validation de remise en service par Kogon.
Tous MANQUANT.

## 12. Rôles et permissions

Cible : rôle partenaire distinct de l'enum interne, rattaché à une
`organisation` ; chaque politique RLS des tables exposées reçoit une branche
« partenaire » bornée à ses contrats (CBG), ses engins (Neemba) ou ses
commandes (fournisseur) ; aucune lecture des tables internes (coûts,
paiements des autres, notes) ; MFA aal2 obligatoire ; écriture seulement par
fonctions dédiées au portail. Test d'isolation RLS (un partenaire ne lit
rien d'un autre partenaire ni des données internes) : prérequis du
déclencheur. Tout MANQUANT.

## 13. Tables et relations

| Table | État |
|---|---|
| `organisations` (raison sociale, statut) | DÉPLOYÉ (`20261114100000_perimetre_site.sql:34`), référentiel interne, pas de lien profil-organisation |
| Cible : `profiles.organisation_id` et type de compte (interne, partenaire) | MANQUANT |
| Cible : `partenaires_acces` (organisation, contrat, engins, sites autorisés, expiration) | MANQUANT |
| Cible : `depots_partenaires` (organisation, type, objet visé, fichier, statut, décision, motif) | MANQUANT (dépend du stockage, module 23) |
| Cible : `echanges_partenaires` (fil de messages par dossier) | MANQUANT |

## 14. Fonctions serveur et API

Cible : `inviter_partenaire`, `revoquer_partenaire`, `deposer_piece`,
`retirer_piece`, `decider_depot`, `repondre_reclamation` ; politiques RLS
partenaire ; éventuellement une API (fonction Edge) pour l'envoi
automatique des relevés CBG si CBG le propose (intégration externe :
décision du propriétaire). Tout MANQUANT.

## 15. Notifications

Cible : dépôt reçu (agent Kogon du module), décision (partenaire), réclamation
ouverte (Neemba), écart de relevé (CBG), document expirant (fournisseur).
Canal : centre de notifications du portail, puis courriel après
passerelle. Tout MANQUANT.

## 16. Documents et modèles d'impression

Cible : accusé de dépôt numéroté, relevé de réclamation, attestation de
réception. MANQUANT.

## 17. Exports et rapports

Cible : export CSV par le partenaire de ses propres données (tickets du
mois, interventions, paiements) ; rapports figés partagés (module 21).
MANQUANT.

## 18. Historique et audit

Cible : journal des connexions et des consultations des comptes partenaires,
journal des dépôts et décisions, append-only. MANQUANT.

## 19. Tests

Aucun. Cible : pgTAP d'isolation RLS par type de partenaire (prérequis du
déclencheur), E2E du dépôt de relevé CBG et de facture Neemba.

## 20. Critères de recette métier

1. Un compte Neemba ne voit que les engins loués par Neemba et leurs
   immobilisations ; aucune donnée de coût ni de CBG.
2. CBG dépose le relevé du mois ; les écarts sont calculés et décidés par
   Kogon ; CBG voit la décision.
3. Neemba dépose sa facture ; le contrôle produit la réclamation ; Neemba y
   répond dans le portail.
PV : partenaire concerné et chargé de contrats.

## Synthèse des états (éléments du catalogue du propriétaire)

| Élément | État |
|---|---|
| Portail Neemba | MANQUANT (déclencheur) |
| Portail CBG | MANQUANT (déclencheur) |
| Portail fournisseurs | MANQUANT (déclencheur) |
| Portail transporteurs | MANQUANT (déclencheur, besoin à confirmer) |
| Comptes partenaires | MANQUANT |
| Dépôt documentaire | MANQUANT |
| Consultation des dossiers autorisés | MANQUANT |
| Soumission des factures | MANQUANT |
| Réponses aux demandes | MANQUANT |
| Réclamations | MANQUANT |
| Notifications | MANQUANT |
| Suivi des validations | MANQUANT |
| Historique des échanges | MANQUANT |

Total : 0 DÉPLOYÉ, 0 PARTIEL, 0 MAQUETTE, 13 MANQUANT. Les processus
internes que les portails ouvriraient existent côté Kogon (import des
relevés CBG D-050, interventions Neemba D-049, contrôle des factures Neemba
D-032, fournisseurs D-059) et sont décrits dans leurs fiches.

## Défauts bloquants constatés

Aucun écran, aucune écriture. Reliquat à nettoyer : module de droit
`client_portal` présent dans `role_permissions` et libellé dans
`UserModal.tsx:69` sans écran associé ; il peut laisser croire à un droit
effectif.

## Écarts et lots proposés

Aucun lot de construction avant le déclencheur. Préalables qui servent
aussi le reste de SIGTB et peuvent avancer sans lui :

1. **Stockage des pièces jointes (module 23, lot D)** : bucket privé,
   politiques par module et site (autorisé par D-069, point 2).
2. **Identité et type de compte (module 02, S)** : `profiles.organisation_id`,
   type interne/partenaire, sans ouvrir aucun accès.

Après le déclencheur (accord écrit du partenaire et test d'isolation RLS
vert), dans l'ordre : portail Neemba (interventions puis factures, M à L),
portail CBG (relevés et écarts, M), portail fournisseurs (L).

Points à trancher par le propriétaire : partenaires prioritaires et accord
de chacun ; existence de transporteurs sous-traitants ; hébergement
(sous-domaine dédié sur le serveur web partagé) ; obligation MFA des
comptes partenaires ; retrait du module de droit `client_portal`.

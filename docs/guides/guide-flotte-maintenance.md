# Guide flotte, maintenance et HSE

Public : responsable de flotte, chef de maintenance, responsable HSE.
Sources : D-022, D-025, D-042, D-049, D-051, D-052, D-054, D-066, D-067 ; migrations
`20261110210000`, `20261116120000`, `20261116180000`, `20261116210000`,
`20261117120000`, `20261121100000`, `20261121130000` ; écrans `Vehicles`, `Drivers`, `Maintenance`, `Pneus`,
`Hse`, `Incidents`.

Rappel du contrat de location (D-022, D-027) : les engins (semi-remorques,
chargeuses, pelle) sont loués à l'heure à Neemba ; la maintenance est à la
charge du loueur ; les pneus et le carburant sont à la charge de
l'exploitant. SIGTB trace les arrêts et les interventions du loueur, il
n'internalise pas un atelier.

## 1. Véhicules, chauffeurs, documents

Écrans **Flotte > Véhicules et engins**, **Chauffeurs**, **Documents**.

- Lecture et écriture selon les modules `vehicles` et `drivers`, bornées
  par le site du compte (voir le guide administrateur).
- Plus de suppression physique depuis le navigateur (D-042) : un
  enregistrement métier se désactive, se clôture ou se retire.
- Le statut « immobilisé » ou « en maintenance » d'un engin est posé par la
  déclaration d'une immobilisation, et le retour à « actif » par sa clôture
  ou son annulation : Planification et Dispatch voient l'indisponibilité
  sans autre saisie.

## 2. Immobilisations (D-025)

Écran **Maintenance > Immobilisations**. Une immobilisation est un arrêt
d'un engin loué : début et fin horodatés à l'heure réelle, cause,
imputation, description, référence d'intervention du loueur.

| Champ | Valeurs |
|---|---|
| Cause | Panne, Maintenance planifiée, Pneumatique, Accident, Attente de pièce, Autre |
| Imputation | Loueur, Exploitant, À déterminer (aucune valeur par défaut : l'utilisateur choisit) |

| Action | Fonction | Règle principale |
|---|---|---|
| Déclarer | `declarer_immobilisation` | Droit `maintenance` ; description requise ; engin présent dans la flotte ; une seule immobilisation ouverte par engin ; heure non future. L'engin passe « immobilisé » (« en maintenance » si planifiée). |
| Clôturer | `cloturer_immobilisation` | Heure de fin requise, après le début. L'engin redevient « actif ». Si une intervention du loueur est en cours, la clôture passe par la validation de la remise en service par une autre personne (D-072). |
| Corriger | `corriger_immobilisation` | Motif obligatoire ; la fin se saisit par la clôture. |
| Annuler | `annuler_immobilisation` | Motif obligatoire. |

Deux immobilisations d'un même engin ne se chevauchent jamais. Chaque
action est journalisée avec l'état avant et après. `heures_immobilisation`
totalise les heures par engin, imputation et cause sur une période : c'est
la source des heures d'indisponibilité du futur décompte de location.

Un arrêt saisi sur une fiche de pointage (FP) crée aussi une
immobilisation.

## 3. Interventions Neemba (D-049)

Écran **Maintenance > Interventions Neemba**. Une intervention se rattache
à une immobilisation ouverte imputée au loueur ou « à déterminer » (refusée
si elle est imputée à l'exploitant). Une seule intervention active par
immobilisation ; numéro attribué par le serveur (`INT-AAAA-NNNNN`).

| Étape | Fonction | Règle principale |
|---|---|---|
| Demandée | `demander_intervention_loueur` | Droit `maintenance`, engin du périmètre ; heure après le début de l'immobilisation et non future ; canal (téléphone, courriel, courrier, portail, sur place) ; délai contractuel en heures saisi à la demande, jamais supposé. |
| Prise en charge | `prendre_en_charge_intervention` | Technicien du loueur requis ; heure après la demande, non future. |
| Terminée | `terminer_intervention` | Heure après la prise en charge ; rapport obligatoire ; pièces fournies par le loueur ou l'exploitant. |
| Remise validée | `valider_remise_en_service` | Par une **autre personne** que celle qui a saisi la fin. La validation clôture l'immobilisation à l'heure de fin ; l'engin redevient disponible. Un refus, motivé, renvoie à la prise en charge. |

Le délai de prise en charge est calculé. Sans délai contractuel saisi, le
retard n'est pas évalué (`en_retard` vide dans `v_interventions_loueur`).
Chaque étape est inscrite dans `interventions_journal`, non modifiable.

## 4. Pneus (D-052)

Écran **Pneus**. Le registre `tires` est un cache recalculé depuis le
journal `pneus_operations`, non modifiable. Écriture : modules `vehicles`
ou `maintenance`, dans le périmètre de l'engin ou du site de stockage.

| Opération | Fonction | Règle principale |
|---|---|---|
| Entrée en stock | `enregistrer_pneu` | Numéro, marque et modèle requis ; numéro unique ; prix et nombre maximal de rechapages positifs ou absents ; date d'achat pas après l'entrée. |
| Montage | `monter_pneu` | Seul un pneu en stock et réutilisable se monte ; engin du périmètre ; position normalisée ; un seul pneu monté par position. |
| Démontage | `demonter_pneu` | Motif requis ; état « réutilisable » ou « à décider » ; compteur pas inférieur à celui du montage. |
| Permutation | `permuter_pneu` | Échange des deux pneus si la position cible est occupée (opérations liées). |
| Inspection | `inspecter_pneu` | Profondeur ou pression requise ; pneu non réformé. |
| Réparation | `reparer_pneu` | Seul un pneu « à décider » se répare. |
| Rechapage | `rechaper_pneu` | Seul un pneu démonté se rechape ; prestataire requis ; plafond de rechapages du pneu respecté. |
| Réforme | `reformer_pneu` | Pneu démonté ; motif requis ; définitive. |
| Annulation | `annuler_operation_pneu` | Motif requis ; seule la dernière opération d'un pneu s'annule ; l'entrée en stock ne s'annule pas (réformer avec motif). |

Toute opération est datée, pas dans le futur ni avant la dernière
opération du pneu. La vue `v_pneus` donne les kilomètres parcourus (compteurs
au montage et au démontage, ou dernier relevé pour un pneu monté), le coût
total (achat, rechapages, réparations) et le coût au kilomètre seulement si
toutes les mesures existent. `v_pneus_a_surveiller` signale les pneus sous
le seuil de profondeur ou non inspectés depuis trop longtemps (réglages
`pneu_profondeur_min_mm` et `pneu_inspection_max_jours`, saisis par
l'administrateur dans l'écran ; sans seuil, aucune alerte).

**Réception depuis un bon de commande (D-067).** Une ligne de bon de
commande peut porter un modèle de pneu (marque, modèle, dimension), sans
article du magasin. À la réception, un numéro est saisi par pneu reçu ;
chaque pneu entre au registre au prix de la ligne, avec le fournisseur du
bon, le site du dépôt et la pièce de réception. Une réception qui a
enregistré des pneus ne s'annule pas : un pneu saisi par erreur se réforme
avec motif.

**Performance par marque et modèle (D-067).** Panneau Performance,
`v_pneus_performance` : sur les seuls pneus réformés aux mesures complètes
(monté au moins une fois, kilomètres connus et positifs, coût au km
calculé), kilomètres moyens, coût au km, durée de vie en jours (premier
montage à la réforme) et taux de réforme précoce (sous le réglage
`pneu_reforme_precoce_km`, saisi par l'administrateur ; sans seuil : sans
données). Les pneus en service et ceux aux mesures incomplètes sont comptés
comme exclus. Une ligne par marque regroupe tous ses modèles.

**Pièces d'un ordre de travail (D-061, D-067).** Une pièce peut être
réservée pour un ordre ouvert ou en cours (Stocks > Réservations) ; la
sortie depuis l'ordre consomme la réservation et, pour un article suivi,
exige ses lots ou numéros de série. Quand l'ordre est terminé ou annulé,
ses réservations encore actives sont levées automatiquement, avec un motif
qui cite l'ordre.

## 5. Contrôles avant départ (D-054)

Écran **RH & Sécurité > Contrôles avant départ**.

- La liste des points (libellé, catégorie, bloquant ou non) est tenue par
  l'administrateur. Catégories : freinage, pneumatiques, éclairage,
  fluides, sécurité, documents, cabine, autre.
- `enregistrer_controle_depart` (bouton « Enregistrer le contrôle ») :
  droit `trips`, camion du périmètre, heure non future ; une réponse pour
  chaque point actif : conforme, non conforme (observation obligatoire),
  sans objet.
- Résultat calculé par le serveur : **conforme** ; **avec réserves** si
  seules des non-conformités non bloquantes ; **non conforme** si un point
  bloquant est non conforme.
- Un contrôle ne se modifie pas : après réparation, un nouveau contrôle du
  jour fait foi.
- Si l'administrateur active l'exigence (bouton « Exiger », réglage
  `controle_depart_exige`), un camion ne peut passer de « Affecté » à « Au
  chargement » sans contrôle du jour conforme ou avec réserves. Messages :
  « Depart refuse : aucun controle avant depart du camion ce jour » ou
  « Depart refuse : dernier controle avant depart non conforme ».

## 6. Incidents et actions correctives (D-054)

Écran **RH & Sécurité > Incidents**. Écriture : module `trips` dans le
périmètre (voyage, engin ou site) ; lecture : `trips` ou `reports`.

| Étape | Fonction | Règle principale |
|---|---|---|
| Déclarer | `declarer_incident` | Type, gravité (mineure à critique), description et heure non future requis ; rattachement à un voyage, un engin ou un site obligatoire ; coût estimé positif ou absent (plus de coût par défaut). Numéro `INC` attribué. |
| Analyser | `analyser_incident` | Cause requise ; l'incident passe « en analyse ». Réviser une cause exige un motif ; chaque analyse est journalisée (D-072). |
| Ajouter une action corrective | `ajouter_action_corrective` | Libellé, responsable et échéance requis. |
| Solder une action | `solder_action_corrective` | Réalisée avec preuve et date non future, ou annulée avec motif. |
| Clôturer | `cloturer_incident` | Cause analysée, aucune action ouverte, conclusion requise. |

`v_actions_correctives_en_retard` liste les actions dont l'échéance est
dépassée ; elles apparaissent aussi dans **Mes validations**.

## 7. Habilitations des chauffeurs (D-051)

Écran **Flotte > Habilitations chauffeurs**.

- Types : visite médicale, formation sécurité, habilitation engin, accès
  site, autre ; numéro, date de délivrance, date d'expiration, pièce
  justificative.
- Écriture : module `drivers` ou administrateur, chauffeur du périmètre.
- Une habilitation ne se supprime pas : elle se révoque, avec date et
  motif, définitivement.
- L'administrateur choisit les types **exigés** pour être affecté à un
  voyage. Le dispatch refuse alors un chauffeur qui n'a pas, à la date du
  voyage, une habilitation valide de chaque type exigé (en plus du permis).
  Sans type exigé, aucune contrainte.
- `v_habilitations_a_renouveler` : habilitations expirées ou expirant sous
  30 jours, sauf si elles sont renouvelées.

## 8. Infractions des chauffeurs (D-066)

Fiche d'un chauffeur (**Chauffeurs**, modification), section **Infractions
du chauffeur**.

- **Enregistrer une infraction** (`enregistrer_infraction`) : modules
  `drivers` ou `trips` en écriture, chauffeur ou voyage du périmètre. Type,
  source, date et heure (pas dans le futur) et constat obligatoires ; lieu,
  voyage concerné (un voyage du même chauffeur ; l'engin en est repris) et
  référence de la source facultatifs. Numéro `INF-AAAA-NNNNN` attribué par
  le serveur.
- **Décider de la sanction** (`decider_sanction`) : droit d'approbation sur
  `drivers` ou administrateur. Une seule décision en vigueur par
  infraction, motif obligatoire ; « autre » demande une précision. Une
  décision se corrige par **Annuler la décision** (motif), puis une
  nouvelle décision : l'historique est conservé.
- **Annuler l'infraction** (`annuler_infraction`) : motif obligatoire ; si
  une sanction est en vigueur, réservé à une personne habilitée à
  sanctionner, et la sanction est annulée avec elle. Rien n'est supprimé.
- Une sanction (même un retrait de conduite) ne bloque pas le dispatch :
  un retrait de conduite ou une mise à pied en vigueur s'affiche en
  avertissement dans la recommandation ; la personne qui affecte décide.
- Une infraction reste visible et traitable par le site où elle a été
  saisie, même après mutation du chauffeur.
- Pas de séparation entre la personne qui déclare et celle qui décide :
  elles peuvent être la même personne (dérogation à confirmer par le
  propriétaire, D-066).

## Limites connues

- Les écrans « Ordres de travail » et « Préventif », hérités de Bolt,
  restent en place hors du périmètre des immobilisations (D-025) : ils ne
  suivent pas le modèle de location.
- Interventions : le délai contractuel n'est pas repris du contrat
  automatiquement ; pas de portail Neemba (D-049).
- Pneus : les tables `tire_*` héritées ne sont plus lues, leur suppression
  reste à décider (D-052). Pas de référentiel des modèles de pneus : marque
  et modèle sont saisis sur la ligne du bon et regroupés sans tenir compte
  de la casse ni des espaces (D-067).
- Incidents : pas de notification par courriel ou SMS (D-056).

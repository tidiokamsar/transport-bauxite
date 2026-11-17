# SIGTB : déroulé du Dispatch Control Center (D-087)

Écran : Exploitation > Dispatch. En haut, le filtre date, site de chargement et
shift configuré ; dessous, le tableau de bord du shift ; puis les onglets
Affectations, Voyages par état, Supervision, Shift et préparation, Journal.

Le filtre n'est jamais un shift actif. Un shift n'est « en cours » que si son
instance (table `postes`) est ouverte ou en cours.

## 1. Shift configuré et instance

- **Shift configuré** : `work_shifts` (Exploitation > Shifts, D-078), horaires
  communs à tous les sites.
- **Instance** : `postes`, une par date, shift et site.

| État | Entrée | Fonction serveur |
|---|---|---|
| planifié | avant le jour, pour préparer | `planifier_poste` |
| ouvert | le jour même, ou depuis planifié | `ouvrir_poste` (passation des consignes) |
| en cours | depuis ouvert | `changer_etat_poste(…, 'en_cours')` |
| clôturé | depuis ouvert ou en cours | `cloturer_shift` (motif si des voyages ne sont pas terminés), `cloturer_poste` |
| validé | depuis clôturé, autre personne | `valider_cloture_poste` (inchangé) |
| annulé | depuis planifié, ouvert, en cours ; motif ; aucun voyage engagé | `changer_etat_poste(…, 'annule')` |

Chaque transition est écrite dans `postes_journal` (append-only). `postes.version`
augmente à chaque mise à jour : une fenêtre ouverte sur une version périmée est
refusée (SQLSTATE 40001) avec le message « Shift modifié entre-temps ».

## 2. Préparation du shift (fenêtre en quatre étapes)

1. **Contexte** : date, site, shift ; objectif lu dans la Planification
   (`v_realisation_objectifs`) ; voyages déjà créés.
2. **Ressources et besoin** : camions disponibles (actifs, benne, sans
   immobilisation ouverte), capacité utile moyenne, temps de cycle observé sur
   14 jours (`durees_voyages`) ; **hypothèse de charge saisie** (pourcentage de
   la capacité utile, jamais supposée). Besoin = voyages visés par l'objectif,
   sinon `ceil(tonnes cibles / (capacité utile × hypothèse))` (`besoin_shift`).
3. **Aperçu et correction** : proposition = besoin moins voyages existants ;
   destination ; nombre modifiable ; motif obligatoire s'il diffère de la
   proposition, ou sans proposition (aucun objectif, aucune capacité, aucune
   hypothèse).
4. **Confirmation** : récapitulatif, puis `confirmer_plan_shift` : contrôle de
   version du plan, création par `preparer_voyages`, enregistrement d'une
   nouvelle version dans `plans_shift` (append-only).

Une instance planifiée, ouverte ou en cours est exigée.

## 3. Affectation

Onglet Affectations : recommandation par voyage (règles fixes, voir
`SIGTB_DISPATCH_RECOMMENDATION_ENGINE.md`), puis décision humaine :

- **Accepter** : `affecter_voyage` avec la recommandation ; refusé si le choix
  diffère des identifiants recommandés.
- **Modifier** : autre camion, chauffeur ou engin, motif obligatoire.
- **Refuser** : motif obligatoire, rien n'est affecté.
- **Réaffecter** (voyage affecté) : changement de camion, de chauffeur ou des
  deux, motif obligatoire ; la décision précédente reste au journal, la
  ressource remplacée est historisée (`decisions_dispatch.avant`).
- **Tout accepter / sélection** : `affecter_en_groupe` (D-066), rapport par voyage.

Refus serveur : chauffeur déjà sur un autre camion du shift, chauffeur ou
camion engagé sur un autre voyage avec une autre ressource (veille au
lendemain), camion ou engin à immobilisation ouverte, chauffeur non habilité,
permis expiré, ressource inactive, hors périmètre, site fermé, version
périmée.

## 4. Exécution et exceptions

Onglet Voyages par état : à affecter, affectés, au chargement, en chargement,
vers le dépôt, attente au dépôt, en déchargement, pesé par CBG, terminés,
suspendus, à réaffecter, interrompus, annulés. Le clic ouvre la fiche du voyage
(transitions du cycle, ticket CBG, incident, enchaînement après déchargement).

- **Suspendre / reprendre** : `suspendre_voyage`, `reprendre_voyage`, motif
  obligatoire, événement dans `suspensions_voyage`. Un voyage suspendu
  n'avance plus (garde `garde_dispatch_suspension`), sauf annulation.
- **Annuler, interrompre** : transitions existantes du cycle (motif).
- **Incident** : `declarer_incident` depuis la fiche du voyage.
- **Pesée** : la pesée officielle est CBG (D-081) ; le Dispatch n'en crée aucune.

## 5. Supervision

Onglet Supervision : par voyage non terminé, dernière transmission, ancienneté,
source (GPS si une position plus récente que le dernier événement existe,
sinon événement déclaré), état et durée dans l'état, incidents, alertes. La
carte n'apparaît que s'il existe des positions de moins de 15 minutes
(`FRAICHEUR_POSITION_MINUTES`, CDC 15). Perte de liaison : bandeau, données non
présentées comme actuelles.

## 6. Clôture

`cloturer_shift` : consignes de passation obligatoires, présence pointée ;
voyages non terminés : motif obligatoire, ils restent à leur état. Le bilan
figé compte `voyages_non_termines`.

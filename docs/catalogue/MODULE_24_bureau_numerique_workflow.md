# Module 24 : Bureau numérique et workflow

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : dernière release journalisée 3bbfded,
démonstration purgée (D-076), aucune donnée réelle.

## 1. Objectifs et périmètre

Donner à chaque utilisateur un poste de travail unique : ce qui attend sa
décision (validations), ses tâches, ses échéances, ses notifications, ses
délégations ; et fournir le moteur commun des circuits d'approbation
(étapes, approbations multiples, relances, escalades, délais), sans que
la boîte n'autorise jamais rien par elle-même : la fonction serveur du
module métier reste seule juge (D-056). Jalon : J3 (« notifications, boîte
de validations »).

Décisions de référence : D-056 (mes validations calculées, notifications
personnelles écrites par le serveur), D-065 (branches échéances de contrat,
clauses à décider, budgets dépassés), D-053 (approbation d'un bon par une
autre personne que les auteurs, renforcée D-072), D-055 (paiements :
proposition, approbation, exécution, contrôle a posteriori, séparation à
confirmer), D-029 (facture signée par le role director), D-048 (clôture de
poste validée par un autre), D-049 (remise en service Neemba validée par un
autre), D-041 (mouvements carburant validés hors auteur), D-036 (droits par
utilisateur), D-040 (aal2 pour les décisions sensibles si `mfa_exige`),
D-077.

Entrées : files d'attente des modules 04, 05, 10, 13, 14, 16, 19, 20, 22.
Sorties : ouverture de l'écran de décision du module, notifications.

## 2. Sous-modules

| Sous-module | Contenu cible |
|---|---|
| 24.1 Boîte de réception | Validations, tâches, échéances et notifications regroupées, triées par ancienneté et priorité |
| 24.2 Mes validations | Éléments en attente de ma décision selon mes droits et la séparation des tâches |
| 24.3 Mes tâches | Tâches affectées à moi ou à mon équipe (ex. « saisir le relevé CBG du jour », « rattacher les tickets orphelins »), avec échéance |
| 24.4 Mes dossiers | Dossiers que j'ai initiés ou suivis (bon de commande, paiement, facture, intervention) et leur étape |
| 24.5 Mes échéances | Échéances dont je suis responsable (contrats, habilitations, documents, actions correctives) |
| 24.6 Mes notifications | Décisions qui me concernent, lues / non lues |
| 24.7 Mes délégations | Délégation temporaire de mes approbations à un autre utilisateur, bornée dans le temps et par module |
| 24.8 Moteur de circuits | Modèles de workflow, étapes conditionnelles (montant, site, nature), approbations multiples, délais, relances, escalades, réaffectation, commentaires, historique |

## 3. Menus et sous-menus

| Entrée | Écran | Droit |
|---|---|---|
| `mes-validations` « Mes validations » (`menu.ts`) | `Notifications/MesValidationsView` | module `dashboard` lecture (`AuthContext.tsx:161`) |
| route `notifications` (sans entrée de menu) | même écran (`App.tsx`) | `dashboard` |
| Icône boîte de la barre supérieure, compteur | `Layout/TopBar.tsx:89-93`, `:142-152` | tout utilisateur connecté |

Cible : menu « Bureau » avec Boîte de réception, Mes tâches, Mes dossiers,
Mes échéances, Mes délégations ; « Circuits » dans Paramètres pour
l'administrateur.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Mes validations | Éléments à traiter groupés par catégorie, bouton « Ouvrir l'écran » ; notifications avec « Lu » et « Tout marquer comme lu » | DÉPLOYÉ | `src/components/Notifications/MesValidationsView.tsx` ; `mes_validations()` (dernière définition `supabase/migrations/20261121120000_contrats_finance.sql:1590`), `marquer_notifications_lues(uuid[])` (`20261117180000_validations_notifications.sql`) ; pgTAP `39_validations_notifications` (8) ; e2e `mes-validations.spec.ts` (1) ; release debf876 (PR #68), extension D-065 en 3bbfded |
| Compteur de la barre supérieure | Nombre d'éléments à traiter, rafraîchi chaque minute | DÉPLOYÉ | `TopBar.tsx:89-96` |
| Mes tâches | Tâches libres affectées | MANQUANT | - |
| Mes dossiers | Dossiers suivis et leur étape | MANQUANT | - |
| Mes échéances | Vue calendaire des échéances | PARTIEL | échéances de contrat et actions correctives en retard dans la boîte ; habilitations à renouveler (`v_habilitations_a_renouveler`), documents fournisseurs à échéance (`v_documents_fournisseurs_echeance`) hors boîte |
| Mes délégations | Délégation temporaire | MANQUANT | D-056 : hors périmètre |
| Paramétrage des circuits | Modèles, étapes, seuils | MANQUANT | circuits codés en dur dans chaque module |

## 5. Widgets et tableaux de bord

| Widget | Source | État |
|---|---|---|
| « À traiter (N) » par catégorie (Achats, Paiements, Carburant, Exploitation, Maintenance, Tickets CBG, Facturation, HSE, Contrats, Budgets) | `mes_validations()` | DÉPLOYÉ |
| Ancienneté « Depuis le » | colonne `depuis` | DÉPLOYÉ |
| Notifications non lues (N) | `notifications` | DÉPLOYÉ |
| Retard par rapport au délai cible, éléments escaladés | - | MANQUANT |
| Charge par équipe (pour un responsable) | - | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver | Supprimer | Annuler/corriger |
|---|---|---|---|---|---|---|---|
| Élément à valider (calculé) | - (dérivé des données) | DÉPLOYÉ | - | - | - | - | - |
| Notification | serveur seulement (`notifier`, déclencheurs) | DÉPLOYÉ (ses seules notifications) | marquer lue DÉPLOYÉ | - | MANQUANT (masquer) | interdit au navigateur | - |
| Tâche | MANQUANT | MANQUANT | MANQUANT | MANQUANT | MANQUANT (clore) | brouillon seulement | MANQUANT (annuler motivé) |
| Délégation | MANQUANT | MANQUANT | MANQUANT | - | MANQUANT (révoquer) | - | MANQUANT |
| Modèle de circuit | MANQUANT | MANQUANT | MANQUANT (nouvelle version) | MANQUANT | MANQUANT | paramètre inutilisé seulement | - |
| Commentaire | MANQUANT | MANQUANT | interdit (ajout seulement) | - | - | - | - |

## 7. Modals et drawers

| Modal | État |
|---|---|
| Aperçu de l'élément (DetailDrawer) avec décision possible sur place | MANQUANT (la boîte renvoie à l'écran du module) |
| Décision (ActionDialog : approuver, rejeter, retourner pour correction, motif) | existe dans chaque module, pas dans la boîte |
| AssignmentModal (affecter, réaffecter une tâche) | MANQUANT |
| Délégation (délégataire, modules, du, au, motif) | MANQUANT |
| CommentThread sur un dossier | MANQUANT |
| HistoryDrawer d'un dossier (étapes, auteurs, délais) | MANQUANT |

## 8. Champs des formulaires

| Formulaire | Champ | Type | Obligatoire | Règle |
|---|---|---|---|---|
| Marquer lu | identifiants (ou tous) | uuid[] | non | serveur : ses seules notifications (`user_id = auth.uid()`) |
| Cible : tâche | Titre, description, objet rattaché (type, identifiant), affecté à (utilisateur ou équipe), échéance, priorité | texte, liste, date | titre, affecté, échéance | affecté doit avoir le droit de lecture du module de l'objet ; site de l'objet dans son périmètre |
| Cible : délégation | Délégataire, modules, début, fin, motif | liste, dates, texte | tous | durée max. paramétrable ; le délégataire doit déjà avoir la lecture du module ; aucune délégation de la signature de facture du DG sans décision du propriétaire ; un délégataire ne valide jamais sa propre saisie |
| Cible : modèle de circuit | Objet (bon de commande, paiement, facture fournisseur...), étapes (rôle ou utilisateur, condition : montant, devise, site, nature), délai par étape, relance, escalade | listes, nombres | oui | versionné ; l'ancienne version reste appliquée aux dossiers en cours |
| Cible : commentaire | Texte, mentions | texte | oui | ajout seul, horodaté |

## 9. Actions individuelles et en masse

| Action | État | Preuve |
|---|---|---|
| Ouvrir l'écran de décision | DÉPLOYÉ | `MesValidationsView.tsx:54` |
| Marquer une notification lue, tout marquer lu | DÉPLOYÉ | `MesValidationsView.tsx:31-35` |
| Décider depuis la boîte | MANQUANT | - |
| Décisions en masse (ex. valider 20 mouvements carburant) | MANQUANT (chaque fonction serveur décide unitairement) | - |
| Affecter, réaffecter une tâche | MANQUANT | - |
| Déléguer, révoquer une délégation | MANQUANT | - |
| Commenter | MANQUANT | - |
| Filtrer, trier, rechercher dans la boîte | PARTIEL (tri par ancienneté seulement, `MesValidationsView.tsx:26`) | - |

## 10. Statuts et transitions

Notification : `non lue -> lue` (`marquer_notifications_lues`). DÉPLOYÉ.

Cible, tâche :

```
ouverte -> en_cours            (prise en charge par l'affecté)
ouverte | en_cours -> faite    (affecté ; preuve ou commentaire selon le type)
ouverte | en_cours -> annulee  (créateur ou responsable ; motif)
* -> reaffectee -> ouverte     (responsable ; motif ; trace de l'ancien affecté)
en retard                      (dérivé : échéance dépassée, jamais stocké)
```

Cible, étape de circuit :

```
en_attente -> approuvee | rejetee | retournee   (approbateur de l'étape ou son délégataire ; motif sauf approbation)
en_attente -> escaladee                          (délai dépassé ; serveur ; notification du niveau supérieur)
```

Les statuts métier (bon de commande, paiement, facture...) restent ceux de
leurs modules ; le circuit ne fait qu'enchaîner les décisions.

## 11. Workflows

Circuits existants, codés dans leurs fonctions serveur (DÉPLOYÉ) :

| Circuit | Étapes et séparation |
|---|---|
| Bon de commande (D-053, D-072) | brouillon -> soumis -> approuvé ou rejeté par une autre personne que les auteurs -> réception (droit stocks) |
| Paiement fournisseur (D-055) | proposé -> approuvé (approbateur invoices, différent du proposant) -> exécution saisie -> contrôle a posteriori (différent du proposant et de l'exécutant) ; anomalie notifiée |
| Facture CBG (D-029) | brouillon -> à signer -> signée par le role director, numérotée |
| Mouvement et inventaire carburant (D-041) | saisi -> validé par un autre que l'auteur |
| Clôture de poste (D-048) | clos -> validé par un autre (droit planning) |
| Remise en service Neemba (D-049) | terminée -> remise validée par un autre (droit maintenance) |
| Écart de relevé CBG (D-050) | écart -> décision humaine |
| Clause contractuelle calculée (D-065) | proposée -> décidée |

Manquant : délais cibles par étape, relances automatiques, escalade,
délégation, approbations multiples paramétrables (au-delà d'un
approbateur), étapes conditionnelles (ex. bon de commande au-delà d'un
montant : deuxième approbation du DG), réaffectation, commentaires.

## 12. Rôles et permissions

| Action | Règle | État |
|---|---|---|
| Voir un élément à valider | même règle que la fonction de décision du module (droit d'approbation ou d'écriture, auteur exclu) ; SECURITY INVOKER, donc RLS et périmètre site appliqués | DÉPLOYÉ |
| Facture à signer | `profiles.role = 'director'` seulement | DÉPLOYÉ |
| Lire ses notifications | politique `lecture_personnelle` (`user_id = auth.uid()`) ; aucune écriture du navigateur | DÉPLOYÉ |
| Écrire une notification | `notifier(...)` SECURITY DEFINER, retirée à `authenticated` | DÉPLOYÉ |
| Déléguer | utilisateur pour ses propres droits ; administrateur pour tous ; journalisé | MANQUANT |
| Paramétrer un circuit | administrateur (`settings`), aal2 si `mfa_exige` | MANQUANT |

## 13. Tables et relations

| Table | Colonnes clés | RLS | État |
|---|---|---|---|
| `notifications` | `user_id`, `notification_type`, `title`, `message`, `reference_type`, `reference_id`, `read`, `read_at`, `created_at` ; index `(user_id, created_at DESC)` | SELECT personnel ; aucun INSERT/UPDATE/DELETE pour `authenticated` | DÉPLOYÉ |
| Cible : `taches` (objet_type, objet_id, titre, affecte_a, equipe, echeance, priorite, statut, cree_par, motif) | - | lecture : affecté, créateur, responsable ; écriture par fonctions | MANQUANT |
| Cible : `delegations` (delegant, delegataire, modules[], debut, fin, motif, revoquee_le) | - | lecture : parties et administrateur | MANQUANT |
| Cible : `circuits`, `circuits_etapes`, `circuits_instances`, `circuits_decisions` (versionnés, append-only pour les décisions) | - | lecture selon l'objet | MANQUANT |
| Cible : `commentaires` polymorphe (objet_type, objet_id, auteur, texte, cree_le) | socle commun D-077 | lecture selon le droit de l'objet | MANQUANT |

## 14. Fonctions serveur et API

| Fonction | État |
|---|---|
| `mes_validations()` SECURITY INVOKER, 14 branches | DÉPLOYÉ |
| `marquer_notifications_lues(p_ids uuid[] DEFAULT NULL)` | DÉPLOYÉ |
| `notifier(uuid, text, text, text, text, uuid)` et déclencheurs `notifier_decision_achat`, `notifier_decision_paiement`, `notifier_validation_poste` | DÉPLOYÉ |
| Cible : `creer_tache`, `affecter_tache`, `terminer_tache`, `annuler_tache` | MANQUANT |
| Cible : `deleguer(delegataire, modules, debut, fin, motif)`, `revoquer_delegation`, et prise en compte dans `has_module_approve` | MANQUANT |
| Cible : `relancer_et_escalader()` planifiée | MANQUANT |
| Cible : `commenter(objet_type, objet_id, texte)` | MANQUANT |

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Bon de commande approuvé ou rejeté | demandeur | centre de notifications | DÉPLOYÉ |
| Paiement approuvé ou rejeté | proposant | centre | DÉPLOYÉ |
| Anomalie au contrôle d'un paiement | proposant et exécutant | centre | DÉPLOYÉ |
| Clôture de poste validée | auteur de la clôture | centre | DÉPLOYÉ |
| Facture CBG signée ou retournée, intervention Neemba en retard, ticket orphelin depuis N jours, habilitation expirant | responsable | centre | MANQUANT |
| Élément à valider en retard (relance), escalade | approbateur, puis niveau supérieur | centre, courriel | MANQUANT |
| Tout événement par courriel ou SMS | - | passerelle | MANQUANT (aucune passerelle ; intégration externe : décision du propriétaire) |

## 16. Documents et modèles d'impression

Aucun document propre. Cible : modèles de notifications (titre, message,
variables) administrables (module 02). MANQUANT (titres codés dans les
déclencheurs).

## 17. Exports et rapports

Cible : export CSV de la boîte et des tâches ; rapport des délais de
validation par circuit (temps moyen par étape, retards). MANQUANT.

## 18. Historique et audit

- Notifications : `read_at` horodaté. DÉPLOYÉ.
- Décisions : tracées dans les journaux de chaque module (`achats_journal`,
  `decisions_dispatch`, `interventions_journal`, `incidents_journal`...),
  pas d'historique transverse d'un dossier. PARTIEL.
- Délégations, réaffectations, commentaires : MANQUANT.

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `39_validations_notifications` (8) ; `48_contrats_finance` (branches D-065) | délégations (un délégataire ne valide pas sa propre saisie), escalade, tâches, RLS des commentaires |
| E2E (API simulée) | `mes-validations.spec.ts` : boîte, compteur, ouverture de l'écran, notification lue | décision depuis la boîte, délégation, parcours J3 contre une vraie base |

## 20. Critères de recette métier

1. Un logisticien soumet un bon de commande : il ne le voit pas dans sa
   propre boîte ; l'approbateur achats le voit, l'approuve depuis l'écran
   ouvert ; le logisticien reçoit la notification.
2. Le DG voit les factures CBG à signer et rien d'autre qu'il n'a le droit
   de décider.
3. Un compte borné au site de Nimba ne voit aucun élément d'un autre site.
4. Le DG part en mission : il délègue l'approbation des paiements au
   directeur d'exploitation pour 5 jours ; la délégation expire seule ;
   chaque décision indique « par délégation de ».
5. Un paiement non approuvé après le délai est relancé puis escaladé.
PV : DG, responsable d'exploitation, comptable.

## Synthèse des états (éléments du catalogue du propriétaire)

| Élément | État |
|---|---|
| Boîte de réception et mes validations | DÉPLOYÉ |
| Mes notifications | DÉPLOYÉ |
| Compteur et accès rapide (barre supérieure) | DÉPLOYÉ |
| Mes tâches | PARTIEL (limitées aux validations calculées) |
| Mes échéances | PARTIEL |
| Relances | PARTIEL (relances de recouvrement du module 20 seulement) |
| Approbations multiples | PARTIEL (séparation des tâches codée par circuit) |
| Historique | PARTIEL (journaux par module) |
| Suivi des délais | PARTIEL (ancienneté affichée, pas de délai cible) |
| Mes dossiers | MANQUANT |
| Mes délégations | MANQUANT |
| Circuits paramétrables | MANQUANT |
| Modèles de workflow | MANQUANT |
| Étapes conditionnelles | MANQUANT |
| Escalades | MANQUANT |
| Commentaires | MANQUANT |
| Réaffectations | MANQUANT |
| Notifications courriel et SMS | MANQUANT |

Total : 3 DÉPLOYÉ, 6 PARTIEL, 0 MAQUETTE, 9 MANQUANT. Aucun UTILISABLE ni
VALIDÉ.

## Défauts bloquants constatés

Aucun. Écritures vérifiées : `MesValidationsView.tsx:32` appelle
`marquer_notifications_lues` avec `p_ids` (signature `uuid[] DEFAULT NULL`) ;
la lecture de `notifications` porte sur des colonnes existantes (`id`,
`notification_type`, `title`, `message`, `read`, `created_at`) et sur la
politique `lecture_personnelle`.

Réserve : boîte sans filtre ni pagination au-delà de 100
notifications (`MesValidationsView.tsx:23`) ; acceptable tant que le volume
réel n'est pas connu.

## Écarts et lots proposés

1. **Échéances regroupées (S)** : ajouter à `mes_validations()` (ou à une
   vue `mes_echeances`) les habilitations à renouveler, documents
   fournisseurs et véhicules à échéance, tickets CBG orphelins anciens.
   Dépendances : modules 08, 09, 14, 15.
2. **Décision depuis la boîte (M)** : DetailDrawer et ActionDialog
   communs appelant les fonctions de décision existantes, sans les
   dupliquer. Dépendances : composants communs (D-077).
3. **Délégations (M, revue indépendante : droits)** : `delegations`,
   `deleguer`, prise en compte dans `has_module_approve` et
   `has_module_write`, journal, interdiction de valider sa propre saisie.
   Dépendances : module 02 ; règles à trancher par le propriétaire.
4. **Tâches et commentaires (M)** : `taches`, `commentaires` polymorphes
   (socle commun), AssignmentModal, CommentThread.
5. **Délais, relances, escalades (M)** : délai cible par type d'élément
   (réglage `settings`), fonction planifiée, notifications.
6. **Circuits paramétrables (L)** : modèles versionnés et étapes
   conditionnelles (montant, site, nature), appliqués aux bons de commande
   et paiements d'abord. Revue indépendante obligatoire (argent).
7. **Courriel et SMS (M)** : après fourniture de la passerelle
   (intégration externe : « toujours demander »).

Points à trancher par le propriétaire : qui peut déléguer quoi (la
signature de facture du DG est-elle délégable ?) ; seuils d'approbation
multiple (montant au-delà duquel le DG approuve un bon de commande ou un
paiement) ; délais cibles et niveau d'escalade par circuit ; séparation
approbateur, exécutant, contrôleur des paiements (D-055, D-072) ; passerelle
courriel/SMS.

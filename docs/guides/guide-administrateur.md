# Guide de l'administrateur

Public : administrateur fonctionnel de SIGTB (rôle `admin`). Sources :
D-010, D-012, D-021, D-036, D-038 à D-040, D-045, D-046, D-064 ; migrations
`20261108100000`, `20261110090000`, `20261112060000`, `20261114100000`,
`20261114130000`, `20261115210000`, `20261121140000` ; écrans
`src/components/Settings`, `src/components/Auth/SecuriteCompte.tsx`.

D-064 (affectations multisites, délégations, journal de connexion,
référentiels) est **à tester** : en branche, ni fusionnée ni déployée à la
date de cette révision. Les sections qui la décrivent le signalent.

## 1. Premier administrateur

Le premier compte est créé sur le serveur par le propriétaire, avec le
script `deploy/vps/creer-admin.sh` (voir le guide de déploiement). Le mot
de passe est saisi au clavier sans écho, 12 caractères minimum. Ensuite,
tous les comptes se créent depuis l'application.

## 2. Comptes utilisateurs

Écran **Paramètres**, onglet **Utilisateurs**.

| Action | Fonctionnement réel |
|---|---|
| Créer un compte | La fonction serveur `admin-utilisateurs` vérifie que l'appelant est un administrateur actif, puis crée le compte (adresse e-mail valide, nom complet, rôle de la liste, mot de passe de 12 caractères minimum, **site d'affectation obligatoire**). Une adresse déjà utilisée est refusée. Si le site est refusé, le compte est annulé (D-079). |
| Réinitialiser un mot de passe | Même fonction serveur, action « mot de passe », 12 caractères minimum. Aucun courriel n'est envoyé (pas de serveur SMTP configuré). |
| Changer le rôle | Réservé à un administrateur actif ; jamais sur son propre compte ; le dernier administrateur actif garde son rôle (D-079). |
| Désactiver, réactiver | Boutons « Désactiver » / « Réactiver » de la liste : motif obligatoire, journalisé (`journal_comptes`). Refusé sur son propre compte et sur le dernier administrateur actif. Un compte n'est jamais supprimé (il est l'auteur de pièces). Le statut ne se change plus dans le formulaire du compte (D-079). |
| Statut | Actif, Inactif, Suspendu. Un compte qui n'est pas actif perd tous ses droits côté serveur, même si son rôle en donne. |
| Site d'affectation | Un site actif, ou « Compte global » coché avec un **motif obligatoire** (journalisé). Écrit par la fonction `definir_site_compte`, jamais par une mise à jour directe (voir section 5). |
| Droits d'accès aux modules | Visible à la modification d'un compte existant (voir section 4) ; motif obligatoire dès qu'un droit change. |

### Journal de connexion et sessions (D-064, à tester)

Onglet **Paramètres > Journal de connexion**, réservé à l'administrateur :

- les événements écrits par le service d'authentification (connexion,
  déconnexion, renouvellement de session, changement de mot de passe,
  facteurs MFA), avec date, compte, méthode et adresse IP si elle est
  enregistrée. Rien n'est reconstitué : seules les lignes écrites par le
  service apparaissent ;
- les **tentatives de connexion échouées n'y figurent pas** : le service
  d'authentification ne les journalise pas ;
- la liste des sessions ouvertes (début, dernier renouvellement,
  expiration, niveau aal1 ou aal2, navigateur), sans jeton ni clé.

L'ancienne table `user_activity_logs` n'est pas un journal de connexion et
n'est pas utilisée.

Rôles proposés à la création (enum `user_role`) :

| Code | Libellé à l'écran |
|---|---|
| `admin` | Administrateur |
| `director` | Directeur |
| `operations_manager` | Responsable des opérations |
| `fleet_manager` | Responsable de flotte |
| `maintenance_chief` | Chef de maintenance |
| `logistician` | Logisticien |
| `accountant` | Comptable |
| `contract_manager` | Chargé de contrats et facturation |
| `driver` | Chauffeur |

## 3. Matrice rôle x module

Les droits de chaque rôle sont dans la table `role_permissions`. Le serveur
les lit par trois fonctions :

- `has_module_view(module)` : lecture (`can_view`) ;
- `has_module_write(module)` : écriture (`can_create` ou `can_edit`) ;
- `has_module_approve(module)` : approbation (`can_approve`), utilisée pour
  les achats et les paiements.

Les trois exigent un compte actif. Matrice effective après toutes les
migrations (calculée depuis la base de référence et les migrations
`20261108100000`, `20261110150000`, `20261110230000`) :

Légende : **E** écriture, **L** lecture seule, **+A** avec approbation,
**aucun** pas d'accès.

| Module | admin | director | operations_manager | fleet_manager | maintenance_chief | logistician | accountant | driver | contract_manager |
|---|---|---|---|---|---|---|---|---|---|
| dashboard (Tableau de bord) | E+A | E+A | L | L | L | L | L | L | L |
| vehicles (Véhicules et engins) | E+A | E+A | E | E | E | E | L | L | E |
| drivers (Chauffeurs) | E+A | E+A | E | E | aucun | L | L | aucun | E |
| trips (Voyages et fiches terrain) | E+A | E+A | E | E | aucun | E | L | L | E |
| planning (Planification) | E+A | E+A | E | E | aucun | L | L | L | E |
| gps_tracking (Suivi GPS) | E+A | E+A | L | L | aucun | L | aucun | aucun | L |
| geofencing (Géorepérage) | E+A | E+A | L | L | aucun | L | aucun | aucun | L |
| fuel (Carburant) | E+A | E+A | E | E | aucun | E | L | L | E |
| maintenance (Maintenance) | E+A | E+A | E | E | E | E | L | L | E |
| stock (Stocks) | E+A | E+A | L | L | L | E | L | aucun | L |
| purchases (Achats et fournisseurs) | E+A | E+A | aucun | aucun | aucun | E | E+A | aucun | E |
| invoices (Facturation) | E+A | E+A | aucun | aucun | aucun | L | E+A | aucun | E |
| contracts (Contrats et finance) | E+A | L+A | aucun | aucun | aucun | aucun | L | aucun | E |
| costs (Coûts) | E+A | E+A | aucun | aucun | aucun | L | E+A | aucun | E |
| hr (Ressources humaines) | E+A | E+A | aucun | aucun | aucun | aucun | E+A | aucun | E |
| reports (Rapports) | E+A | E+A | L | L | aucun | L | E | aucun | E |
| settings (Paramètres) | E+A | E | aucun | aucun | aucun | aucun | aucun | aucun | E |
| iot (Capteurs IoT) | E+A | E+A | L | L | L | L | aucun | aucun | aucun |
| esg (Environnement) | E+A | E+A | L | L | aucun | L | L | aucun | L |
| client_portal (Portail client) | E+A | E+A | aucun | aucun | aucun | aucun | L | aucun | L |
| ai_analytics (Analyses IA) | E+A | E+A | L | L | L | L | L | aucun | L |

Remarques :

- Les lignes des rôles historiques `manager`, `dispatcher` et `mechanic`
  restent dans la table, mais aucun compte ne peut porter ces rôles (D-012).
- La signature des factures ne dépend pas de la matrice : elle est réservée
  au rôle `director` (voir le guide financier).
- Un ajustement de la matrice passe par une nouvelle migration, pas par
  l'écran.

### Correspondance menu et module

Le menu latéral n'affiche une entrée que si le compte peut lire le module
correspondant (`src/contexts/AuthContext.tsx`). Un administrateur voit tout.

| Module | Entrées du menu |
|---|---|
| dashboard | Tableau de bord, Mes validations |
| vehicles | Véhicules et engins, Pneus, Documents |
| drivers | Chauffeurs, Habilitations chauffeurs |
| trips | Voyages & Rotations, Dispatch, Postes de travail, Fiches terrain, Kilométrage, Tickets CBG, Infrastructures et fermetures, Contrôles avant départ, Prévention HSE |
| planning | Planification |
| gps_tracking | Suivi GPS, Intelligence flotte, Historique des trajets, Géorepérage |
| fuel | Distribution aux engins, Livraisons et factures CBG, Réceptions, cuves et inventaires, Analyse carburant, Anomalies, Jauges connectées |
| maintenance | Immobilisations, Interventions Neemba, Ordres de travail, Préventif |
| stock | Stocks |
| purchases | Achats, Fournisseurs |
| contracts | Mon tableau de bord, Dossier contractuel, Engagements et rapport, Comités de contrat, Contrôle factures Neemba |
| invoices | Réconciliation mensuelle, Facturation, Recouvrement, Paiements fournisseurs |
| costs | Coûts |
| hr | Employés, Présences, Paie |
| reports | Rapports, Coût direct par tonne, Santé de la flotte, Fiabilité des engins, Performance chauffeurs, Capteurs IoT, Environnement, Incidents, Centre des décisions |
| settings | Sites, Paramètres |

Le masquage du menu est un confort : la barrière réelle est côté serveur
(voir le guide de sécurité).

## 4. Droits par utilisateur (D-036)

Dans **Paramètres > Utilisateurs**, à la modification d'un compte, la
section « Droits d'accès aux modules » propose, module par module :

| Choix | Effet |
|---|---|
| Défaut (rôle) | Les droits du rôle s'appliquent. Choisir ce niveau retire l'attribution spécifique. |
| Lecture | Lecture seule, quel que soit le rôle. |
| Écriture | Lecture et écriture, quel que soit le rôle. |
| Aucun | Aucun accès, même si le rôle en donne. |

Fonctionnement :

- L'écriture passe par la fonction `definir_droit_module`, réservée à
  l'administrateur ; seuls les modules modifiés sont envoyés, avec le
  motif saisi (obligatoire à l'écran depuis D-079).
- L'attribution prime sur la matrice dans `has_module_view` et
  `has_module_write`, avec effet immédiat sur toutes les règles serveur.
- Chaque attribution, retrait ou retour au rôle est journalisé dans
  `journal_droits_modules` (niveau avant, niveau après, auteur, date),
  lisible par l'administrateur seulement.
- Une attribution ne donne jamais le droit d'**approbation** : l'approbation
  vient du rôle. Une attribution « Lecture » ou « Aucun » la retire ;
  « Écriture » la laisse au rôle qui l'a déjà.
- Si la double authentification est exigée (section 6), modifier les
  droits demande une session confirmée par code.

### Délégations temporaires (D-064, à tester)

Un utilisateur délègue, pour une période datée et avec un motif, son droit
d'**écriture** sur un module à un autre compte (la lecture l'accompagne si le
délégant lit le module). **L'approbation ne se délègue pas** : une
approbation déléguée contournait la séparation des tâches (revue du
2026-11-16) ; décision du propriétaire attendue. Écran
**Sécurité du compte > Mes délégations**, ou **Paramètres > Délégations**
pour l'administrateur (qui voit et révoque toutes les délégations).

Règles appliquées par le serveur (`deleguer_droit`, `has_module_*`) :

- on ne délègue que ce que l'on détient en propre : un droit reçu par
  délégation ne se redélègue pas ;
- pas de délégation à soi-même, ni du module Paramètres (`settings`) ; le
  rôle administrateur ne se délègue jamais ;
- le périmètre de sites du délégué doit être compris dans celui du
  délégant (un délégant affecté à un site ne délègue qu'à des comptes de
  ses sites ; la liste proposée ne montre que ceux-là, et reste vide pour
  qui ne détient aucun droit d'écriture délégable) ;
- la délégation ne vaut que pendant sa période (début inclus, fin exclue) ;
  un début dans le passé est ramené à l'instant présent ;
  elle cesse d'agir dès que le délégant perd le droit, que le délégué
  devient inactif, qu'une attribution « Lecture » ou « Aucun » (section 4)
  vise le délégué, ou que le périmètre du délégué dépasse celui du
  délégant : son statut devient « Sans effet » ;
- elle donne la lecture du module seulement si le délégant la détient ;
- le délégué agit en son nom : il reste l'auteur de ses actes et la
  séparation des tâches s'applique à lui (un délégué n'approuve pas son
  propre bon) ; il ne valide pas non plus ce que son délégant a saisi ou
  clos sur le module délégué (poste, clôture de planification, distance,
  carburant, remise en service, rectification de ticket), sauf s'il détient
  ce droit en propre ; à l'inverse, le délégant ne valide pas (ni ne signe)
  ce que son délégué a fait sous délégation, même après la fin de celle-ci ;
- révocation par le délégant ou l'administrateur, motif obligatoire, tant
  que la délégation n'est pas expirée ; création et révocation sont
  journalisées (`journal_delegations`).

Aucune durée maximale n'est imposée : à fixer par le propriétaire si
nécessaire.

## 5. Périmètre site (D-038, D-039, D-046)

Chaque compte a un site d'affectation ou aucun :

| Profil | Ce qu'il voit et modifie |
|---|---|
| Sans site (« compte global ») | Toutes les lignes, y compris celles qui n'ont pas de site. |
| Affecté à un site | Seulement les lignes de son site. Pour un voyage : site de départ OU site d'arrivée. Une ligne sans site rattachable lui est invisible. |

Le périmètre s'applique aussi aux administrateurs affectés à un site
(D-046 a retiré les anciennes politiques qui laissaient passer
l'administrateur).

Tables bornées par le site :

- lecture et écriture : véhicules, voyages, chauffeurs, fiches terrain
  (D-038) ;
- écritures contrôlées par déclencheur, même à travers les fonctions
  serveur : voyages, véhicules, chauffeurs, fiches terrain, pointages
  d'engins, immobilisations (D-039), dépôts et mouvements de stock (D-044) ;
- périmètre étendu (D-046) : pleins (site du plein, sinon de l'engin),
  ordres et plannings de maintenance, pneus, documents de véhicule, alertes
  (site de l'engin), incidents et pesées (site de départ ou d'arrivée du
  voyage) ;
- modules suivants, par leurs fonctions : cuves et citernes de carburant,
  postes de travail, interventions du loueur, relevés CBG, habilitations,
  contrôles avant départ, achats (site du dépôt de livraison).

Hors périmètre site : RH (les employés n'ont pas de site) (D-046).

Le sélecteur de site du menu latéral est un **filtre d'affichage** mémorisé
par le navigateur, pas une barrière de sécurité. La barrière est le site du
profil, fixé par l'administrateur.

### Affectations multisites datées (D-064, à tester)

Onglet **Paramètres > Affectations multisites**, administrateur seulement.
Un compte peut être affecté à plusieurs sites, chacun pour une période
(début, fin incluse, fin facultative). Le site du profil (ci-dessus) reste
valable et s'ajoute aux affectations.

| Situation du compte | Sites permis aujourd'hui |
|---|---|
| Aucun site au profil, jamais affecté | Tous (compte global), comme avant. |
| Site au profil et/ou affectations | Site du profil et affectations en cours à la date du jour (fin incluse). Une affectation à venir ne donne rien avant son premier jour. |
| Toutes les affectations expirées ou **annulées**, sans site au profil | **Aucun site.** Le compte ne redevient jamais global de lui-même. |

Actions :

- **Affecter** : compte, site, début, fin facultative, motif. Deux
  affectations au même site ne se chevauchent pas.
- **Clore** : fixe la fin (au plus tôt le début).
- **Annuler** (erreur de saisie) : motif obligatoire ; l'affectation ne
  donne plus aucun site.
- **Rétablir le périmètre global** : décision explicite, motif
  obligatoire, consignée (`retours_perimetre_global`). Refusée pour un
  compte inactif, et tant que le
  profil porte un site ou qu'une affectation est en cours ou à venir (la
  clore ou l'annuler d'abord). Une affectation antérieure au retour ne
  compte plus et ne se prolonge plus ; une nouvelle affectation borne de
  nouveau le compte.

Le tableau « Périmètre des comptes actifs » affiche le périmètre calculé
par le serveur. Toute écriture est journalisée
(`journal_affectations_sites`) ; aucune ne se supprime. Si la double
authentification est exigée, ces écritures demandent une session aal2.

## 6. Double authentification (D-040, D-045)

Écran **Sécurité du compte** (menu du profil, en haut à droite).

1. Chaque utilisateur inscrit un facteur TOTP : QR code à scanner dans une
   application d'authentification, ou clé de secours (masquée par défaut),
   puis confirmation par un code.
2. À la connexion suivante, un compte qui a un facteur vérifié saisit son
   code avant d'accéder à l'application (session de niveau aal2).
3. L'utilisateur peut lister et retirer ses facteurs.

Exigence pour les opérations sensibles (réglage `mfa_exige`) :

- L'administrateur l'active ou la lève depuis le même écran. Le bouton
  reste inactif tant que son propre facteur n'est pas inscrit.
- Une fois activée, le serveur refuse sans session aal2 : les écritures de
  droits par utilisateur, les rectifications de tickets de pesée CBG et le
  passage d'une facture au statut « signée ». Message : « Confirmation en
  deux etapes (MFA) requise pour cette operation ».
- Ordre recommandé par D-045 : faire inscrire les comptes administrateur,
  directeur et chargé de contrats, puis activer. L'activation reste une
  décision du propriétaire.

## 7. Référentiels tenus par l'administrateur ou le paramétrage

| Référentiel | Écran | Qui écrit (règle serveur) |
|---|---|---|
| Organisations | Paramètres > Organisations | Administrateur seulement ; chaque site s'y rattache. |
| Sites | Exploitation > Sites | Droit d'écriture `settings`. Un site se désactive, il ne se supprime pas (D-042). Coordonnées GPS facultatives (latitude et longitude ensemble, degrés décimaux) ; capacité de stockage en tonnes ; responsable choisi parmi les comptes actifs ; le stock d'un site ne se saisit pas (D-079). Une modification conserve tous les champs non modifiés. |
| Infrastructures et fermetures de site | Exploitation > Infrastructures et fermetures | Droit d'écriture `settings` ou administrateur, dans le périmètre. Une fermeture ne se modifie ni ne se supprime ; une levée anticipée demande date et motif. L'auteur (création, déclaration, levée) est renseigné par le serveur (D-079). |
| Dossier contractuel | Contrats & Finance > Dossier contractuel | Droit d'écriture `contracts`. Suppression seulement d'un élément jamais utilisé d'un contrat brouillon, avec motif ; un tarif en vigueur d'un contrat actif se modifie par avenant (bouton crayon : « par avenant ») ; un contrat actif ne repasse pas en brouillon (D-079). |
| Fiche société (identité légale imprimée) | Paramètres > Général | Droit d'écriture `settings` ou administrateur. Les champs non fournis restent « à saisir ». |
| Points de contrôle avant départ | RH & Sécurité > Contrôles avant départ | Administrateur seulement (libellé, catégorie, bloquant ou non, ordre, actif). |
| Habilitations exigées pour être affecté | Flotte > Habilitations chauffeurs | Administrateur seulement. Sans type exigé, aucune contrainte. |
| Distances de référence site à site | Kilométrage | Droit d'écriture `contracts` ou administrateur ; une distance se désactive. |
| Cuves et citernes | Carburant > Réceptions, cuves et inventaires | Droit d'écriture `fuel`, dans le périmètre du site. |
| Seuils des pneus | Pneus | Administrateur (table `settings`). |
| Devises et unités de mesure (D-064, à tester) | Paramètres > Référentiels et numérotation | Administrateur seulement (`enregistrer_devise`, code ISO à trois lettres ; `enregistrer_unite`). Reprise des codes déjà saisis, sans libellé inventé : les libellés sont à saisir. Les codes saisis hors référentiel sont signalés, pas bloqués. |
| Numérotations (D-064, à tester) | Paramètres > Référentiels et numérotation | Lecture seule : format, compteur et dernier numéro de chaque numérotation existante. Aucun format n'est paramétrable. |

## 8. Réglages lus par le serveur (table `settings`)

La table `settings` n'est lisible et modifiable que par l'administrateur.
Chaque réglage a une clé et une valeur au format `{"value": "..."}`. Seules
les clés ci-dessous sont lues par une règle serveur (recherche dans les
migrations 2026) :

| Clé | Effet | Si la clé est absente | Où la régler |
|---|---|---|---|
| `mfa_exige` | `true` : session aal2 exigée pour droits, rectifications de tickets CBG, signature de facture | Aucune exigence | Sécurité du compte |
| `controle_depart_exige` | `true` : un camion ne passe de « Affecté » à « Au chargement » qu'avec un contrôle avant départ du jour, conforme ou avec réserves | Non exigé | Contrôles avant départ, bouton « Exiger » / « Lever l'exigence » |
| `planification_cloture_separee` | `true` : la clôture de planification d'une journée et d'un site revient à une autre personne que l'auteur des objectifs en vigueur (D-063) | Non exigée (contrairement aux autres `*_separee`, à confirmer par le propriétaire) | Paramètres, réglages lus par le serveur |
| `carburant_validation_separee` | Mouvements et inventaires de carburant validés par une autre personne que l'auteur ; `false` lève la règle | **Exigée** | Aucun écran : voir ci-dessous |
| `kilometrage_validation_separee` | Distance d'un voyage validée par une autre personne que l'auteur des relevés ; `false` lève la règle | **Exigée** | Aucun écran |
| `achats_validation_separee` | Bon de commande approuvé par une autre personne que le demandeur ; `false` lève la règle | **Exigée** | Aucun écran |
| `paiements_validation_separee` | Paiement approuvé par une autre personne que le proposant ; `false` lève la règle | **Exigée** | Aucun écran |
| `tolerance_poids_cbg_t` | Tolérance, en tonnes, du rapprochement des relevés CBG | 0 (tout écart est signalé) | Aucun écran |
| `pneu_profondeur_min_mm` | Profondeur sous laquelle un pneu est « à surveiller » | Pas d'alerte | Pneus |
| `pneu_inspection_max_jours` | Délai au-delà duquel un pneu non inspecté est « à surveiller » | Pas d'alerte | Pneus |
| `alerte_immobilisation_longue_h`, `alerte_ecart_carburant_l`, `alerte_voyage_sans_ticket_h` | Seuils strictement positifs (heures, litres, heures) des règles d'alerte à seuil du centre des décisions (D-068) | **Règle inactive** : aucune alerte | Paramètres, réglages lus par le serveur |
| `alerte_intervention_retard_active`, `alerte_controle_non_conforme_active`, `alerte_document_expire_active`, `alerte_action_corrective_retard_active`, `alerte_epi_echu_active`, `alerte_inspection_retard_active` | `false` met hors service la règle d'alerte correspondante (D-068) | **Active** (dérogation consignée dans D-068) | Paramètres, réglages lus par le serveur |

Les autres champs de l'écran Paramètres (onglets Général, Véhicules,
Maintenance, Carburant, Pneus, GPS & Suivi, Facturation, Alertes, Sécurité,
Intégrations) sont enregistrés dans `settings`, mais aucune règle serveur ne
les lit.

Pour régler une clé sans écran, l'administrateur système exécute sur le
serveur, en root (exemple pour lever la séparation des achats) :

```bash
docker exec -i sigtb-db psql -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 -c \
  "INSERT INTO public.settings (key, value, category, description)
   VALUES ('achats_validation_separee', '{\"value\": \"false\"}', 'achats', 'Decision du proprietaire du <date>')
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();"
```

Lever une séparation des tâches est une décision du propriétaire : la
consigner dans `docs/SIGTB_2.0_DECISIONS.md` avant de l'appliquer.

## 9. Données de démonstration (D-020)

Tant que la table `sigtb_demonstration` est active, un bandeau « DONNEES DE
DEMONSTRATION » s'affiche sur tous les écrans. Les données fictives ont des
identifiants qui commencent par `dec0de00-`. La purge
(`deploy/vps/demo/demo.sh apercu`, puis `CONFIRMER_PURGE=oui CONFIRMER_RATTACHEES=<n> deploy/vps/demo/demo.sh purger`, D-074) est obligatoire avant la première saisie
réelle (voir le guide de déploiement).

## Limites connues

- Pas d'écran pour les réglages `carburant_validation_separee`,
  `kilometrage_validation_separee`, `achats_validation_separee`,
  `paiements_validation_separee` et `tolerance_poids_cbg_t` : réglage par
  SQL sur le serveur.
- Pas de réinitialisation de mot de passe par courriel : aucun serveur SMTP
  n'est configuré (`SIGTB_2.0_HEBERGEMENT_VPS.md`, section 8).
- L'interface affiche tous les menus à un administrateur, même si une
  attribution spécifique (D-036) lui retire un module ; plusieurs fonctions
  serveur appliquent pourtant cette attribution. Éviter de poser une
  attribution spécifique sur un compte administrateur.
- La liste des comptes de l'onglet Utilisateurs utilise encore une table
  de libellés héritée de Bolt : les rôles `director`,
  `operations_manager`, `maintenance_chief`, `logistician` et
  `contract_manager` y apparaissent sous leur code brut. La fenêtre de
  création et de modification utilise les libellés réels.
- La correspondance des droits du module `planning` est un choix d'équipe
  « à confirmer » par le propriétaire (D-023).
- Pas d'escalade des validations (D-056). Les délégations temporaires
  (D-064, à tester) n'ont pas de durée maximale et la vue
  `v_droits_modules` (Paramètres > Utilisateurs) ne les montre pas : les
  délégations reçues se lisent dans l'onglet Délégations.
- Journal de connexion (D-064) : pas de tentatives échouées.


## Shifts et referentiels (D-078)

- Premier parametrage apres la purge : Sites, puis Exploitation > Shifts (par exemple Jour 06:00-18:00 et Nuit 18:00-06:00), puis flotte et chauffeurs.
- Les shifts sont communs a tous les sites : seul un profil sans site, administrateur ou avec le droit Parametres, les cree, les modifie (motif) ou les desactive (motif). Le journal `journal_shifts` trace chaque action.
- Un chauffeur ou un engin cree par un profil rattache a un site est enregistre sur ce site ; seul un profil global cree un chauffeur ou un engin global.
- Question ouverte au proprietaire (D-078, point 7) : un ticket CBG rectifie rend aujourd'hui le voyage non facturable ; proposition : facturable apres decision motivee d'un approbateur distinct de l'auteur de la rectification.

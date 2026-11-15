# Guide de sécurité

Public : tous les utilisateurs, en particulier l'administrateur et la
direction. Sources : D-016, D-021, D-036, D-038 à D-042, D-045, D-046 ;
migrations `20260903090000`, `20260903090100`, `20261108090000`,
`20261109120000`, `20261110090000`, `20261114100000` à `20261114130000`,
`20261115120000`, `20261115210000` ; `deploy/vps/sigtb.caddy`,
`deploy/vps/installer.sh`.

## 1. Principes

### Le serveur décide, pas l'écran

Chaque table métier a la sécurité au niveau des lignes (RLS) activée. Les
politiques s'appuient sur trois fonctions de droits, qui exigent toutes un
compte actif :

- `has_module_view(module)` pour lire ;
- `has_module_write(module)` pour écrire ;
- `has_module_approve(module)` pour approuver.

Le droit vient du rôle (matrice `role_permissions`), sauf attribution
spécifique à l'utilisateur, qui prime (D-036). L'administration passe par
`is_admin()` : rôle `admin` ET compte actif. Aucune politique
`FOR ALL USING (true)` n'est admise (vérifié au déploiement).

### Les écritures sensibles passent par des fonctions serveur

Les opérations qui changent un état (cycle du voyage, affectations,
validations, factures, paiements, mouvements de carburant et de stock,
pneus, achats, HSE) ne s'écrivent pas directement dans les tables : elles
passent par des fonctions serveur qui vérifient le droit, le périmètre et
les règles métier, puis écrivent en une seule transaction. Ces fonctions :

- sont `SECURITY DEFINER` avec `search_path` vide, et contrôlent elles-mêmes
  le droit de l'appelant ;
- ont leur exécution retirée au public et aux visiteurs non connectés, et
  accordée aux seuls comptes connectés ;
- sont doublées de déclencheurs de périmètre (D-039) : même une fonction
  future qui oublierait le contrôle du site serait bloquée.

Liste complète : `reference-fonctions-serveur.md`.

### Journaux en ajout seul

Ces journaux ne se modifient ni ne se suppriment depuis l'application :
les comptes connectés n'y ont qu'un accès en lecture (écriture par les
fonctions serveur), et plusieurs sont en plus protégés par un déclencheur
qui refuse toute modification ou suppression. Une erreur se corrige par un
nouvel enregistrement motivé :

| Journal | Contenu |
|---|---|
| `trip_events` | Cycle de chaque voyage |
| `decisions_dispatch` | Décisions d'affectation |
| `immobilisations_journal` | Déclarations, clôtures, corrections, annulations |
| `journal_contrats` | Modifications du dossier contractuel |
| `factures_journal` | Circuit des factures clients |
| `journal_droits_modules` | Attributions de droits par utilisateur |
| `tickets_pesee_cbg`, `rectifications_tickets_pesee_cbg` | Preuve de pesée CBG et ses rectifications |
| `mouvements_carburant` | Registre du carburant |
| `stock_movements` | Registre des stocks magasin |
| `releves_compteur`, `distances_voyage` | Relevés kilométriques et distances validées (versions) |
| `postes_evenements` | Événements des postes de travail |
| `interventions_journal` | Interventions du loueur |
| `releves_cbg`, `releves_cbg_lignes` | Relevés CBG tels que reçus |
| `pneus_operations` | Cycle de vie des pneus |
| `achats_journal` | Circuit achat |
| `controles_depart`, `controles_depart_points` | Contrôles avant départ |

Un objectif de production ne se modifie pas : il se révise par une
nouvelle version (D-023).

### Aucune suppression physique depuis le navigateur (D-042)

Le privilège de suppression est retiré aux comptes connectés sur les tables
métier héritées (véhicules, remorques, documents, pneus, chauffeurs,
pesées, incidents, maintenance, stocks, bons de commande, fournisseurs,
livraisons, factures et paiements hérités, employés, présences, paie,
alertes, sites, zones). Les écrans annulent, désactivent, retirent,
clôturent ou marquent résolu. Un voyage engagé ne se supprime pas : il
s'annule. Gardent une suppression : les lignes d'un brouillon (lignes de
commande, pièces d'un ordre), les référentiels sans historique, un contrat
au stade brouillon et une facture du loueur tant qu'elle n'est pas
notifiée.

### Séparation des tâches

| Décision | Doit être prise par |
|---|---|
| Signature d'une facture client | Rôle `director`, jamais le préparateur |
| Validation d'un mouvement ou d'un inventaire de carburant | Autre personne que l'auteur (sauf réglage contraire) |
| Validation d'une distance de voyage | Autre personne que l'auteur des relevés (sauf réglage contraire) |
| Approbation d'un bon de commande | Autre personne que le demandeur (sauf réglage contraire) |
| Approbation d'un paiement | Autre personne que le proposant (sauf réglage contraire) |
| Contrôle a posteriori d'un paiement | Autre personne que le proposant et l'exécutant |
| Rectification d'un ticket de pesée CBG | Autre personne que l'auteur du ticket |
| Validation d'une clôture de poste | Autre personne que celle qui a clos |
| Validation d'une remise en service Neemba | Autre personne que celle qui a saisi la fin |

Exception consciente (D-026) : le chargé de contrats cumule au démarrage
des saisies terrain et le contrôle mensuel.

### Périmètre site

Un compte affecté à un site ne lit ni n'écrit les données des autres sites,
administrateur compris (D-038, D-039, D-046). Voir le guide administrateur,
section 5.

### Double authentification

Inscription TOTP par chaque utilisateur ; exigence de session aal2 pour les
droits, les rectifications de tickets et la signature des factures quand
l'administrateur l'active (D-040, D-045).

### Comptes et secrets

- Inscription publique désactivée : seul l'administrateur crée les comptes.
- Le changement de rôle ou de statut d'un compte est réservé à un
  administrateur actif (déclencheur sur `profiles`).
- Le navigateur ne reçoit que la clé publique (`role: anon`) ; les secrets
  du serveur sont générés sur place et ne sont jamais affichés ni
  versionnés.
- Côté réseau, seules les routes de connexion, de données et deux fonctions
  (`iot-ingestion`, contrôlée par identifiant et clé de boîtier ;
  `admin-utilisateurs`, réservée à un administrateur actif) sont publiées ;
  les autres routes répondent 404. La base et la console d'administration
  ne sont jamais exposées.

## 2. Ce que l'utilisateur voit quand un droit manque

| Situation | Ce que l'on voit |
|---|---|
| Aucun droit de lecture sur un module | L'entrée n'apparaît pas dans le menu latéral. |
| Lecture sans écriture | L'écran s'ouvre, mais les boutons de saisie et de décision ne sont pas proposés. |
| Ligne hors du périmètre site | La ligne n'apparaît pas : les listes sont simplement plus courtes ou vides (« Aucun ... », « sans données »). Ce n'est pas une erreur. |
| Action refusée par une fonction serveur | Un message rouge reprend le texte du serveur, par exemple « Droit d'ecriture sur les voyages requis », « Hors perimetre : engin d'un autre site », « L'approbation revient a une autre personne que le demandeur ». |
| Écriture directe refusée par une politique RLS | Message technique du type « new row violates row-level security policy for table ... » ou « permission denied for table ... ». |
| Double authentification exigée, session sans code | « Confirmation en deux etapes (MFA) requise pour cette operation ». Se déconnecter, se reconnecter avec le code TOTP, recommencer. |
| Compte inactif ou suspendu | Tous les droits sont refusés côté serveur. L'interface ne vérifie pas le statut : le menu peut encore s'afficher selon le rôle, mais les listes restent vides et les actions sont refusées. |

Que faire : vérifier le site sélectionné et le site du compte, puis
demander à l'administrateur le droit manquant. L'administrateur consulte
les droits effectifs du compte dans Paramètres > Utilisateurs (niveau du
rôle, attribution spécifique, niveau effectif).

## Limites connues

- Les tables RH et les achats hérités ne sont pas encore bornés par site
  (D-046) ; les achats le sont par le dépôt de livraison (D-053).
- Pas de délégation de signature ni d'escalade (D-056).
- La fonction `geofence-monitor` n'est pas déployée tant que son appelant
  n'est pas contrôlé (constat N3, `SIGTB_2.0_HEBERGEMENT_VPS.md`).
- Le masquage des boutons dépend des droits lus à la connexion : après un
  changement de droits, l'utilisateur doit recharger la page ou se
  reconnecter pour que l'écran les reflète (le serveur, lui, applique le
  changement immédiatement).

# Module 02 : Organisation et administration

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(= `main` 8df078d + fiche modèle) et sur la branche non fusionnée
`origin/lot-02/organisation-integration` (D-064, en revue). Production :
démonstration purgée (D-076), le propriétaire commence la saisie de ses
référentiels (organisations, utilisateurs, sites, shifts, engins) : les
écrans de saisie de ce module sont prioritaires.

## Synthèse des états

| # | Élément (liste du propriétaire) | État | Preuve principale |
|---|---|---|---|
| 1 | Sociétés et filiales | PARTIEL | `societe` (fiche unique, `FicheSociete.tsx`), `organisations` (raison sociale et statut seulement, ni modification ni hiérarchie) |
| 2 | Directions et départements | PARTIEL | `profiles.department` texte libre, liste codée en dur `UserModal.tsx:97-105` |
| 3 | Sites et sous-sites | PARTIEL | `sites.organisation_id` (D-038) ; sous-sites absents ; détail au module 03 |
| 4 | Unités opérationnelles | MANQUANT | - |
| 5 | Centres de coûts | MANQUANT | aucune table (`grep centre_cout` vide) |
| 6 | Équipes et services | MANQUANT | `postes_equipe` (D-048) est l'équipe d'un poste, pas un service |
| 7 | Utilisateurs | DÉPLOYÉ | Edge `admin-utilisateurs`, `UserModal.tsx`, `profiles` ; E2E `perimetre-site`, `droits-utilisateurs` |
| 8 | Rôles et permissions (rôle x module) | DÉPLOYÉ | `role_permissions`, `has_module_view/write` (D-012, D-021) ; pgTAP 02, 04, 08 |
| 9 | Droits par action et par état de dossier | MANQUANT | seul `has_module_approve` (D-053) existe, par module |
| 10 | Profils personnalisés (droits par utilisateur) | DÉPLOYÉ | `droits_utilisateur`, `definir_droit_module` (D-036) ; pgTAP 20, E2E `droits-utilisateurs` |
| 11 | Périmètre site (lecture et écriture) | DÉPLOYÉ | `site_permis` et gardes (D-038, D-039, D-046, D-075) ; pgTAP 22, 23, 29, 58 |
| 12 | Affectations multisites | DÉVELOPPÉ | branche D-064 : `affecter_site`... migration `20261121140000`, pgTAP 47, E2E `organisation` |
| 13 | Délégations temporaires | DÉVELOPPÉ | branche D-064 : `deleguer_droit`, `revoquer_delegation`, `Delegations.tsx` |
| 14 | Gestion des sessions | DÉVELOPPÉ | branche D-064 : `sessions_ouvertes()` (lecture seule, aucune révocation) |
| 15 | MFA et politiques d'accès | DÉPLOYÉ | `SecuriteCompte.tsx`, `VerificationMfa.tsx`, `garde_aal2` (D-040, D-045) ; pgTAP 24, E2E `double-authentification` ; exigence non activée |
| 16 | Journal de connexion | DÉVELOPPÉ | branche D-064 : `v_journal_connexions`, `JournalConnexions.tsx` |
| 17 | Historique des droits | PARTIEL | `journal_droits_modules` écrit par le serveur, aucun écran ; changements de rôle non journalisés |
| 18 | Paramètres généraux | DÉPLOYÉ | `ReglagesServeur.tsx`, `reglages.ts`, `valider_reglage` (D-061) ; pgTAP 44, E2E `corrections-ecrans` |
| 19 | Référentiels administratifs | PARTIEL | `organisations` (création seule) ; devises et unités sur la branche D-064 |
| 20 | Séquences de numérotation | DÉVELOPPÉ | branche D-064 : `sequences_numerotation()` en lecture ; formats codés dans chaque fonction |
| 21 | Devises et unités | DÉVELOPPÉ | branche D-064 : `devises`, `unites_mesure`, `enregistrer_devise`, `enregistrer_unite` |
| 22 | Modèles de documents et de notifications | MANQUANT | - |
| 23 | Fiche société (identité légale, D-027) | DÉPLOYÉ | `FicheSociete.tsx`, table `societe` (migration `20261110230000`) |

Décompte : DÉPLOYÉ 7, DÉVELOPPÉ 6, PARTIEL 5, MANQUANT 5, MAQUETTE 0
(23 éléments). Aucun élément UTILISABLE ni VALIDÉ : aucune donnée réelle
saisie au moment du constat, aucun PV.

## 1. Objectifs et périmètre

Le module porte l'organisation de Kogon Mining SARL (exploitant, D-027)
et le modèle d'accès de SIGTB : qui est l'utilisateur, à quelle
organisation et à quels sites il appartient, quels modules il lit ou
écrit, quelles opérations sensibles exigent la double authentification.
Il fournit les référentiels transverses (organisations, devises, unités,
séquences, modèles) consommés par tous les autres modules.

Décisions de référence : D-010, D-012 (matrice rôle x module), D-021
(comptes créés par l'administrateur, inscription publique fermée), D-026
(rôle `contract_manager`), D-027 (identités Kogon, Neemba, CBG), D-036
(droits par utilisateur), D-038, D-039, D-046, D-075 (périmètre site),
D-040, D-045 (MFA), D-061 (paramètres réellement lus), D-064 (branche :
affectations, délégations, journal de connexion, référentiels), D-077.

Entrées : création des comptes par l'administrateur, référentiel des
sites (module 03). Sorties : `is_admin()`, `has_module_view/write/approve`,
`site_permis`, `vehicule_permis`, `voyage_permis` utilisés par toutes les
politiques RLS et fonctions SECURITY DEFINER ; fiche `societe` imprimée
sur les factures (module 20) et les fiches terrain (module 07) ; réglages
`settings` lus par les fonctions serveur (séparation des tâches, MFA,
tolérances).

Hors périmètre : la paie et les dossiers RH (modules RH hérités), les
portails partenaires (module 25, à déclencheur).

## 2. Sous-modules

1. Structure de l'entreprise : société exploitante, organisations
   (filiales, partenaires rattachant des sites), directions,
   départements, services, unités opérationnelles, centres de coûts.
2. Comptes et identités : utilisateurs, statut, mot de passe, site
   d'affectation, affectations multisites datées.
3. Habilitations : rôles, matrice rôle x module, droits par utilisateur,
   délégations temporaires, droits par action (cible).
4. Sécurité d'accès : MFA TOTP, exigence aal2, sessions, journal de
   connexion, historique des droits.
5. Paramétrage : réglages serveur, devises, unités, séquences de
   numérotation, modèles de documents et de notifications.

## 3. Menus et sous-menus

| Entrée (`menu.ts`) | Vue | Droit qui l'affiche (`AuthContext.canAccessModule`) | Contenu |
|---|---|---|---|
| Paramètres (`settings`) | `AdminSettingsView` | `settings` en lecture (admin toujours) | Onglets Utilisateurs, Organisations, Général |
| Menu du profil > Sécurité du compte (`securite-compte`) | `SecuriteCompte` | tout compte connecté | Facteurs TOTP ; exigence aal2 (administrateur) |
| Branche D-064 : Paramètres > Affectations multisites, Délégations, Journal de connexion, Référentiels et numérotation | `AffectationsSites`, `Delegations`, `JournalConnexions`, `Referentiels` | administrateur (fonctions serveur `is_admin()`) | - |
| Branche D-064 : Sécurité du compte > Mes délégations | `Delegations` | tout compte | Délégations données et reçues |

Rôles qui voient Paramètres selon la matrice (base de référence, ligne
`settings`) : `admin` (lecture et écriture), `director` (hérité de
`manager` : lecture et modification, D-012). Les autres rôles ne le voient
pas, sauf attribution par utilisateur (D-036). Cible : sous-menus
distincts « Organisation », « Utilisateurs et accès », « Sécurité »,
« Référentiels », « Réglages » plutôt qu'un seul écran à onglets.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Liste des utilisateurs | `profiles` | PARTIEL | `AdminSettingsView.tsx:175-267` : recherche nom/e-mail, pas de filtre rôle/site/statut, pas de pagination ni d'export ; en-tête de 7 colonnes pour 6 cellules (l. 203-211) |
| Création / modification d'utilisateur | `profiles`, `auth.users`, droits | DÉPLOYÉ | `UserModal.tsx` ; Edge `admin-utilisateurs` ; site non saisissable à la création (l. 244-252) |
| Droits par module d'un utilisateur | `droits_utilisateur` | DÉPLOYÉ | `UserModal.tsx:163-242`, `v_droits_modules`, `definir_droit_module` (motif jamais transmis) |
| Organisations | `organisations` | PARTIEL | `AdminSettingsView.tsx:269-306` : création seule, ni modification, ni désactivation, ni rattachement hiérarchique |
| Fiche société | `societe` | DÉPLOYÉ | `FicheSociete.tsx` |
| Réglages serveur | `settings` | DÉPLOYÉ | `ReglagesServeur.tsx`, `reglages.ts` (17 clés lues par le serveur) |
| Sécurité du compte (MFA) | facteurs GoTrue, `settings.mfa_exige` | DÉPLOYÉ | `SecuriteCompte.tsx`, `VerificationMfa.tsx` |
| Affectations multisites | `affectations_sites` | DÉVELOPPÉ | branche D-064 `AffectationsSites.tsx` |
| Délégations | `delegations_droits` | DÉVELOPPÉ | branche D-064 `Delegations.tsx` |
| Journal de connexion et sessions | `auth.audit_log_entries`, `auth.sessions` | DÉVELOPPÉ | branche D-064 `JournalConnexions.tsx` |
| Référentiels et numérotation | `devises`, `unites_mesure`, séquences | DÉVELOPPÉ | branche D-064 `Referentiels.tsx` |
| Matrice des rôles (consultation) | `role_permissions` | MANQUANT | l'onglet Rôles cité par la matrice de couverture n'existe plus (D-061) |
| Structure organisationnelle (directions, départements, services, unités, centres de coûts) | - | MANQUANT | - |
| Historique des droits et des comptes | `journal_droits_modules` | MANQUANT | aucune lecture dans `src/` |
| Modèles de documents et de notifications | - | MANQUANT | - |
| Tableau de bord d'administration | - | MANQUANT | - |

## 5. Widgets et tableaux de bord

Aucun widget n'existe (MANQUANT). Cible, chacun avec source, période et
heure de calcul (règle 5) :

| Indicateur | Source | Période |
|---|---|---|
| Comptes actifs, inactifs, suspendus, par rôle et par site | `profiles` | instantané |
| Comptes sans MFA parmi les rôles sensibles (admin, director, contract_manager, accountant) | `auth.mfa_factors` via fonction serveur | instantané |
| Comptes globaux (sans site) | `profiles.site_id`, affectations (D-064) | instantané |
| Délégations en cours et expirant sous 7 jours | `delegations_droits` (D-064) | instantané |
| Connexions des 7 derniers jours, comptes jamais connectés | `v_journal_connexions` (D-064) | 7 jours |
| Changements de droits du mois | `journal_droits_modules`, `journal_delegations`, `journal_affectations_sites` | mois |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Utilisateur | DÉPLOYÉ (Edge, admin) | DÉPLOYÉ | DÉPLOYÉ (update direct `profiles`, admin ; garde rôle/statut) | MANQUANT (copier les droits d'un compte) | PARTIEL : désactivation par update direct (`AdminSettingsView.tsx:76-91`), réactivation par le champ Statut ; sans motif ni journal fiable | Interdit (compte = auteur de pièces) | Changement de mot de passe DÉPLOYÉ (Edge) |
| Organisation | DÉPLOYÉ (admin, pgTAP 22) | DÉPLOYÉ | MANQUANT (écran) | - | MANQUANT (statut non modifiable à l'écran) | MANQUANT (organisation jamais utilisée) | - |
| Fiche société | - (ligne unique) | DÉPLOYÉ | DÉPLOYÉ (`modifie_par`, `modifie_le`) | - | - | - | Historique des versions MANQUANT |
| Droit par utilisateur | DÉPLOYÉ (`definir_droit_module`) | DÉPLOYÉ | DÉPLOYÉ | MANQUANT | retour au rôle DÉPLOYÉ (`defaut`) | - | journal DÉPLOYÉ côté serveur |
| Réglage serveur | DÉPLOYÉ (upsert admin, `valider_reglage`) | DÉPLOYÉ | DÉPLOYÉ | - | - | - | historique MANQUANT (`settings.updated_by` non renseigné par l'écran) |
| Affectation de site | DÉVELOPPÉ | DÉVELOPPÉ | clôture DÉVELOPPÉ | - | - | - | annulation motivée DÉVELOPPÉ |
| Délégation | DÉVELOPPÉ | DÉVELOPPÉ | - | - | - | - | révocation motivée DÉVELOPPÉ |
| Devise, unité | DÉVELOPPÉ | DÉVELOPPÉ | DÉVELOPPÉ (actif/inactif) | - | DÉVELOPPÉ | - | - |
| Direction, département, service, unité, centre de coûts | MANQUANT | MANQUANT | MANQUANT | - | MANQUANT | MANQUANT | - |
| Modèle de document / notification | MANQUANT | MANQUANT | MANQUANT (versionné) | MANQUANT | MANQUANT | MANQUANT | - |

## 7. Modals et drawers

| Composant | État | Preuve / cible |
|---|---|---|
| Création d'utilisateur | DÉPLOYÉ | `UserModal` (e-mail, mot de passe 12 caractères, nom, téléphone, rôle, département) |
| Édition d'utilisateur et droits | DÉPLOYÉ | `UserModal` ; cible : onglets Identité / Accès / Sites / Droits / Historique |
| Confirmation de désactivation | PARTIEL | `window.confirm` « supprimer » (libellé trompeur), sans motif ; cible : ActionDialog avec motif, refus de se désactiver soi-même et du dernier administrateur actif |
| Saisie rapide d'organisation | PARTIEL | champ en ligne ; cible : CreateModal (raison sociale, type, sigle, NIF, RCCM, organisation mère) |
| Détail utilisateur (DetailDrawer, HistoryDrawer) | MANQUANT | connexions, droits, affectations, délégations, actions |
| Affectation de site, clôture, annulation, retour global | DÉVELOPPÉ | branche D-064 `AffectationsSites.tsx` |
| Délégation, révocation | DÉVELOPPÉ | branche D-064 `Delegations.tsx` |
| Inscription TOTP (QR code), retrait de facteur | DÉPLOYÉ | `SecuriteCompte.tsx` |
| Import en masse d'utilisateurs (ImportWizard) | MANQUANT | CSV e-mail, nom, rôle, site, avec prévalidation |
| Export (ExportModal) | MANQUANT | liste des comptes et droits, CSV et PDF |

## 8. Champs des formulaires

**Utilisateur (cible ; état actuel entre crochets).**

| Champ | Type | Obligatoire | Validation client / serveur | Conditionnel |
|---|---|---|---|---|
| E-mail | e-mail | oui | format, unicité (`profiles_email_key`, GoTrue) [DÉPLOYÉ] | création seulement |
| Mot de passe | secret | oui à la création | 12 caractères minimum, Edge [DÉPLOYÉ] ; règles de complexité à décider | création, réinitialisation |
| Nom complet | texte | oui | non vide, Edge [DÉPLOYÉ] | - |
| Téléphone | texte | non | format E.164 à ajouter [texte libre] | - |
| Rôle | liste `user_role` | oui | enum, Edge et garde `profiles_guard_sensitive_columns` [DÉPLOYÉ] | - |
| Organisation | liste `organisations` | oui (cible) | FK [MANQUANT : `profiles` n'a pas de colonne organisation] | - |
| Direction / département / service | liste | non | FK vers le référentiel [MANQUANT : texte libre codé en dur] | - |
| Site d'affectation | liste `sites` actifs | oui sauf compte global explicite | FK [PARTIEL : seulement en modification, `UserModal.tsx:209`] | « Compte global » coché exige une confirmation et un motif |
| Affectations datées | lignes site, début, fin | non | sans chevauchement (D-064) [DÉVELOPPÉ] | - |
| Statut | actif / inactif / suspendu | oui | CHECK `profiles_status_check` [DÉPLOYÉ] | motif exigé pour inactif et suspendu (cible) |
| Photo | URL | non | [champ URL libre ; cible : pièce jointe après GED, module 23] | - |

**Organisation (cible).** Raison sociale (unique, obligatoire, déjà
`UNIQUE`), sigle, type (exploitant, client, loueur, fournisseur,
sous-traitant, filiale), organisation mère (FK, sans cycle), NIF, RCCM,
adresse, statut, note. État : seuls raison sociale et statut existent.

**Fiche société.** Raison sociale, RCCM, NIF, adresse, ville, pays,
téléphone, e-mail, signataire et fonction (DÉPLOYÉ, champ vide = « à
saisir », aucune valeur inventée).

**Réglage.** Valeur typée booléen, nombre ou entier selon `reglages.ts`,
contrôlée par `valider_reglage` (DÉPLOYÉ).

## 9. Actions individuelles et en masse

| Action | État |
|---|---|
| Créer, modifier, désactiver, réactiver un compte | DÉPLOYÉ (désactivation sans motif) |
| Réinitialiser le mot de passe | DÉPLOYÉ (Edge `mot_de_passe`) |
| Attribuer / retirer un module à un utilisateur | DÉPLOYÉ |
| Affecter un compte à un site daté, clore, annuler, rétablir le périmètre global | DÉVELOPPÉ (D-064) |
| Déléguer / révoquer un droit d'écriture | DÉVELOPPÉ (D-064) |
| Activer / lever l'exigence aal2 | DÉPLOYÉ (non activée, décision du propriétaire après inscription des facteurs) |
| Forcer la déconnexion d'un compte (révoquer ses sessions) | MANQUANT |
| Copier les droits d'un compte vers un autre | MANQUANT |
| Actions en masse : désactiver, changer de site, attribuer un module à plusieurs comptes | MANQUANT (BulkActionBar) |
| Import de comptes | MANQUANT |

## 10. Statuts et transitions

Compte (`profiles.status`) :

```
(création Edge, admin) -> active
active -> inactive     (désactiver ; admin ; cible : motif, refus pour soi-même et le dernier admin actif)
active -> suspended    (suspendre ; admin ; cible : motif, date de fin optionnelle)
inactive|suspended -> active (réactiver ; admin ; cible : motif)
```

Effet constaté : `is_admin()`, `has_module_*` et `site_permis` exigent
`status = 'active'` ; la session GoTrue reste ouverte jusqu'à expiration
du jeton (pas de révocation : écart).

Périmètre (D-064, branche) : `global -> affecté` à la première
affectation ; `affecté -> sans accès site` à l'expiration ou l'annulation
de toutes les affectations ; `sans accès site -> global` uniquement par
`retablir_perimetre_global` (admin, motif).

Délégation (D-064) : `programmée -> en vigueur -> expirée`, `-> révoquée`
(délégant ou admin, motif), `-> sans effet` (périmètre du délégué non
inclus, délégant sans le droit).

Organisation : `active <-> inactive` (cible : motif ; refus de désactiver
une organisation qui porte des sites actifs).

## 11. Workflows

1. Création de compte : l'administrateur crée (Edge), choisit rôle et
   site, transmet le mot de passe hors application ; le compte inscrit
   son facteur TOTP s'il a un rôle sensible. Cible : obligation de
   changer le mot de passe à la première connexion (à vérifier côté
   GoTrue avant d'affirmer la faisabilité).
2. Délégation (D-064) : le titulaire délègue l'écriture d'un module pour
   une période ; l'approbation ne se délègue pas (point à trancher
   ci-dessous) ; le délégué reste l'auteur de ses actes.
3. Changement de droits sensibles (rôle, droits par utilisateur,
   affectations) : sous aal2 quand `mfa_exige` vaut true (D-040 ; D-064
   pour les affectations et délégations).
4. Cible : revue périodique des accès (liste des comptes et droits à
   valider par la direction, trimestrielle par défaut, à confirmer).

## 12. Rôles et permissions

| Action | Qui (état) | Contrôle serveur |
|---|---|---|
| Lire la liste des comptes | administrateur (politique « Admins full access » sur `profiles`) ; chacun lit son propre profil | RLS |
| Créer un compte, changer un mot de passe | administrateur actif | Edge `admin-utilisateurs` (`is_admin` avec le jeton de l'appelant) |
| Modifier rôle et statut | administrateur actif | garde `profiles_guard_sensitive_columns` |
| Droits par utilisateur | administrateur | `definir_droit_module`, `garde_aal2` si `mfa_exige` |
| Organisations | lecture : tout connecté ; écriture : administrateur | politiques `lecture_authentifies`, `administration` |
| Fiche société | lecture : tout connecté ; modification : droit `settings` ou admin | politique `ecriture_module` |
| Réglages | administrateur seul (politique `administration` sur `settings`) | l'écran affiche le bouton aux comptes `settings` non admin, qui reçoivent un refus (écart mineur) |
| Affectations, retour global | administrateur (D-064) | fonctions SECURITY DEFINER, aal2 |
| Délégations | tout titulaire d'un droit d'écriture délégable ; admin révoque | `deleguer_droit` (D-064) |

Point à trancher (CDC 4.3) : un profil « auditeur » en lecture seule des
preuves et journaux n'existe pas (aucune valeur de `user_role`) ; il
suppose l'ajout d'une valeur à l'enum (migration) ou un compte avec
droits par utilisateur en lecture seule. Option par défaut : droits par
utilisateur en lecture, sans nouveau rôle.

## 13. Tables et relations

| Table | Colonnes clés | Contraintes / RLS | État |
|---|---|---|---|
| `profiles` | id (= auth.users), role `user_role`, full_name, site_id, status, email, department, photo_url, last_login | CHECK statut ; UNIQUE email ; politiques « Admins full access », « Users can view own profile » ; aucune politique UPDATE pour le titulaire | DÉPLOYÉ |
| `role_permissions` | role, module, can_view, can_create, can_edit, can_delete, can_approve | modifiée par migration seulement (D-012) | DÉPLOYÉ |
| `droits_utilisateur`, `journal_droits_modules` | utilisateur, module, niveau ; avant, après, motif, auteur | RLS (soi-même ou admin), écriture par fonction | DÉPLOYÉ |
| `organisations` | raison_sociale UNIQUE, statut, note, cree_par | lecture tous, écriture admin | DÉPLOYÉ |
| `societe` | ligne unique id = 1, identité légale, modifie_par | lecture tous, UPDATE `settings` ou admin | DÉPLOYÉ |
| `settings` | key UNIQUE, value jsonb, category, updated_by | politique admin, déclencheur `valider_reglage` | DÉPLOYÉ |
| `user_activity_logs` | via `log_user_activity` | écrite par l'écran utilisateur, non fiable (D-064) | PARTIEL |
| `affectations_sites`, `journal_affectations_sites`, `retours_perimetre_global` | utilisateur, site, début, fin, annulation | sans chevauchement, append-only, aucune écriture directe | DÉVELOPPÉ (branche) |
| `delegations_droits`, `journal_delegations` | délégant, délégué, module, niveau, période, motif | contrainte « ni settings ni approbation », append-only | DÉVELOPPÉ (branche) |
| `devises`, `unites_mesure` | code, libellé, actif | admin, aucune écriture directe | DÉVELOPPÉ (branche) |
| Cible : `directions`, `departements`, `services`, `unites_operationnelles`, `centres_couts` | code UNIQUE, libellé, parent, organisation, site, responsable, actif, dates de validité | RLS lecture tous, écriture admin par fonction, désactivation au lieu de suppression | MANQUANT |
| Cible : `profiles.organisation_id`, `profiles.service_id` | FK | colonnes additives | MANQUANT |
| Cible : `modeles_documents`, `modeles_notifications` | code, version, corps, variables, actif | versionnés, jamais modifiés en place | MANQUANT |

## 14. Fonctions serveur et API

DÉPLOYÉ : `is_admin()`, `has_module_view`, `has_module_write`,
`has_module_approve`, `site_permis`, `vehicule_permis`, `voyage_permis`,
`definir_droit_module(p_utilisateur, p_module, p_niveau, p_motif)`,
`log_user_activity`, `profiles_guard_sensitive_columns`, `garde_aal2`,
`valider_reglage`, vue `v_droits_modules`, fonction Edge
`admin-utilisateurs` (actions `creer`, `mot_de_passe`).

DÉVELOPPÉ (branche D-064) : `affecter_site`, `cloturer_affectation_site`,
`annuler_affectation_site`, `retablir_perimetre_global`,
`perimetres_comptes`, `deleguer_droit`, `revoquer_delegation`,
`mes_delegations`, `comptes_delegables`, `sessions_ouvertes`,
`enregistrer_devise`, `enregistrer_unite`, `codes_utilises`,
`sequences_numerotation`, vues `v_affectations_sites`,
`v_journal_connexions`. Paramètres des appels de l'interface vérifiés
contre les signatures de la migration `20261121140000` : conformes.

MANQUANT : `desactiver_compte(p_utilisateur, p_motif)` (remplace l'update
direct, refuse soi-même et le dernier admin), `revoquer_sessions`,
`enregistrer_organisation` (création et modification journalisées),
fonctions du référentiel organisationnel, `copier_droits`.

## 15. Notifications

Aucune (MANQUANT). Cible : au compte créé (message d'accueil, hors mot
de passe), au délégué (délégation reçue, expiration proche), à
l'administrateur (compte sensible sans MFA, échec répété si GoTrue
l'expose, modification de droits hors heures), via le centre de
notifications D-056 ; courriel et SMS dépendent d'une passerelle à fournir
(intégration externe : accord du propriétaire).

## 16. Documents et modèles d'impression

MANQUANT : fiche d'habilitation d'un utilisateur (rôle, sites, modules,
délégations) imprimable et signable à la main ; registre des comptes.
Modèles de documents (en-têtes société, factures, fiches) : référentiel
MANQUANT ; aujourd'hui chaque impression lit `societe` directement.

## 17. Exports et rapports

MANQUANT : export CSV / PDF des comptes, des droits effectifs par module
et site, du journal des droits, du journal de connexion (D-064 : écran
sans export).

## 18. Historique et audit

| Journal | État |
|---|---|
| Droits par utilisateur (`journal_droits_modules`) | DÉPLOYÉ côté serveur, aucun écran ; motif jamais transmis par `UserModal` |
| Changements de rôle, statut, site d'un profil | PARTIEL : `log_user_activity` (non fiable selon D-064), aucun journal append-only dédié |
| Affectations et délégations | DÉVELOPPÉ (append-only, branche D-064) |
| Connexions | DÉVELOPPÉ (`auth.audit_log_entries`, branche) ; `profiles.last_login` jamais mis à jour pour un compte non administrateur (aucune politique UPDATE, l'appel de `AuthContext.tsx` ne remonte pas d'erreur) |
| Réglages | MANQUANT (valeur écrasée, `updated_by` non renseigné) |
| Fiche société | PARTIEL (dernier auteur et date seulement) |

## 19. Tests

Existants : pgTAP 01 (garde du rôle), 02, 03 (`is_admin` durci), 04,
08 (droits par rôle), 20 (droits par utilisateur), 22, 23, 29, 58
(périmètre), 24 (aal2), 44 (réglages) ; branche D-064 : pgTAP 47 ;
unitaires `Auth/mfa.test.ts`, branche `Settings/organisation.test.ts` ;
E2E `connexion`, `droits-utilisateurs`, `double-authentification`,
`perimetre-site` (organisations, site du compte), `corrections-ecrans`
(réglages), branche `organisation`.

Manquants : test de la fonction Edge `admin-utilisateurs` (création,
refus non admin, rôle inconnu, doublon) ; pgTAP « un non-admin ne peut
pas désactiver un compte » via la future fonction ; E2E de création
d'utilisateur avec site ; test de non-régression de l'en-tête de la
liste ; test du journal de changement de rôle.

## 20. Critères de recette métier

1. L'administrateur crée l'organisation Kogon Mining SARL, puis les
   comptes réels (directeur, responsable des opérations, chargé de
   contrats, logisticien, comptable), chacun avec son site ; un compte
   affecté à Nimba ne lit aucune donnée d'un autre site.
2. Le directeur inscrit son facteur TOTP ; l'administrateur active
   `mfa_exige` ; une signature de facture sans aal2 est refusée.
3. Un responsable absent délègue l'écriture du module voyages pour 5 jours
   (D-064) ; le délégué agit, l'historique montre l'auteur réel ; la
   délégation expire seule.
4. L'administrateur désactive un compte : le compte ne lit plus rien ;
   le journal montre qui, quand et pourquoi.
5. PV signé par l'administrateur et le directeur.

## Écarts et lots proposés

### Défauts bloquants constatés

Aucun écran du module n'envoie de colonne inexistante : colonnes de
`profiles`, `organisations`, `societe` et `settings` vérifiées contre la
base de référence et les migrations ; paramètres des RPC
(`definir_droit_module`, `log_user_activity`, fonctions D-064) conformes.
Défauts constatés, par gravité :

1. `src/components/Settings/UserModal.tsx:244-252` et
   `supabase/functions/admin-utilisateurs/index.ts:72-80` : le site n'est
   ni saisi ni transmis à la création ; tout compte créé est **global**
   (lit tous les sites) jusqu'à une modification ultérieure. Risque
   d'accès excessif au moment même où le propriétaire crée ses comptes.
2. `src/contexts/AuthContext.tsx:125-129` : `update profiles.last_login`
   pour un compte non administrateur n'a aucune politique UPDATE : 0 ligne
   modifiée, sans erreur ; la date de dernière connexion n'est jamais
   enregistrée pour ces comptes.
3. `src/components/Settings/AdminSettingsView.tsx:76-91` : désactivation
   par update direct, libellée « supprimer », sans motif ni journal, et
   permise sur son propre compte (risque de verrouillage du dernier
   administrateur).
4. `src/components/Settings/AdminSettingsView.tsx:203-211` : en-tête de 7
   colonnes (« Statut » en double) pour 6 cellules : colonnes décalées,
   « Actions » sous « Statut ».
5. `src/components/Settings/AdminSettingsView.tsx:310-311` : boutons
   d'enregistrement des réglages affichés au droit `settings` alors que la
   politique de `settings` n'admet que l'administrateur (refus serveur
   pour un directeur).
6. `src/components/Settings/UserModal.tsx:236-240` :
   `definir_droit_module` appelé sans `p_motif` : le journal des droits
   n'a jamais de motif.

### Lots proposés (ordre)

| # | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Correctifs des défauts 1 à 6 : site à la création (Edge + écran), `desactiver_compte` serveur avec motif et refus du dernier admin, dernière connexion par fonction SECURITY DEFINER ou par D-064 (`v_journal_connexions`), en-tête, droits d'écran des réglages, motif des droits | S | aucune ; prioritaire (saisie en cours) |
| 2 | Revue et fusion de D-064 (affectations, délégations, journal, référentiels) ; décision du propriétaire sur la délégation de l'approbation et la durée maximale | M | revue indépendante (RLS, SECURITY DEFINER, migration) |
| 3 | Organisations complètes : modification, désactivation motivée, type, sigle, NIF, RCCM, organisation mère ; `profiles.organisation_id` | S | lot 2 |
| 4 | Référentiel organisationnel : directions, départements, services, unités opérationnelles, centres de coûts (tables, fonctions, écran, import CSV) ; remplacement de la liste codée en dur des départements | M | données du propriétaire (organigramme) ; module 20 (budgets par centre de coûts) |
| 5 | Matrice des rôles en consultation, droits effectifs par compte (rôle, attribution, délégation), export | S | lot 2 |
| 6 | Journal unifié des comptes (rôle, statut, site) append-only et écran Historique des droits | S | lot 1 |
| 7 | Sessions : révocation des sessions d'un compte (à vérifier contre l'API GoTrue auto-hébergée avant de l'affirmer) | S | lot 2 |
| 8 | Droits par action et par état de dossier (au-delà de `has_module_approve`) | L | décision du propriétaire ; catalogue des actions par module (D-077) |
| 9 | Modèles de documents et de notifications versionnés | M | module 23 (GED), module 24 (notifications) |
| 10 | Tableau de bord d'administration (section 5) et exports | S | lots 2 et 6 |

Points à trancher par le propriétaire : délégation de l'approbation
(D-064, défaut : non) ; durée maximale d'une délégation (défaut : aucune
limite, aucune valeur inventée) ; profil auditeur (défaut : droits par
utilisateur en lecture) ; organigramme réel (directions, services,
centres de coûts) à fournir ; liste des rôles tenus de s'inscrire au MFA
avant activation (défaut : admin, director, contract_manager).

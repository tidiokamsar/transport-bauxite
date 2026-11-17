# SIGTB : manuel de l'administrateur

Version SIGTB documentée : `origin/main` 1896cde (2026-11-17). Production constatée : release 31f7267. Date de rédaction : 2026-11-17 (`date -u`). Mission D-092, phase 1. Aucun mot de passe, secret, adresse de serveur ni donnée personnelle n'est reproduit ici.

Références détaillées : `docs/guides/guide-administrateur.md`, `docs/guides/guide-securite.md`, `docs/guides/guide-deploiement-sauvegarde-restauration.md`, `docs/guides/guide-diagnostic.md`, `docs/SIGTB_2.0_HEBERGEMENT_VPS.md`.

## 1. Deux administrateurs

| Rôle | Qui | Périmètre | Outils |
|---|---|---|---|
| **Administrateur fonctionnel** | Compte SIGTB de rôle `admin` | Comptes, rôles, droits par utilisateur, sites des comptes, délégations, référentiels, réglages lus par le serveur, points de contrôle, habilitations exigées, seuils | Écrans **Paramètres**, **Sécurité du compte**, et les écrans de référentiel des modules |
| **Administrateur technique** | Personne ayant accès au serveur (root) | Installation, mises à jour, migrations, sauvegardes, restaurations, retour arrière, données d'exemple, journaux | Scripts `deploy/vps/*.sh`, `deploy/vps/demo/demo.sh`, procédures du guide de déploiement |

L'administrateur fonctionnel n'a pas accès au serveur ; l'administrateur technique n'a pas besoin d'un compte SIGTB pour ses tâches, sauf le premier compte créé avec `creer-admin.sh`.

Règles du propriétaire qui encadrent l'administration (CLAUDE.md, D-069, D-076, D-080) : depuis la purge de la démonstration (D-076), tout déploiement en production est soumis à l'accord du propriétaire ; restent toujours soumis à son accord : suppression définitive de données ou de tables, migration qui modifie des données existantes, opération financière réelle, activation de `mfa_exige`, activation d'une intégration externe, modification des droits d'un utilisateur réel, tout ce qui touche aux secrets.

## 2. Premier administrateur

Le premier compte est créé sur le serveur par le propriétaire (`/opt/sigtb/outils/creer-admin.sh`) : adresse, nom, mot de passe saisi sans écho, 12 caractères minimum. Ensuite, tous les comptes se créent depuis l'application.

## 3. Comptes utilisateurs

Écran **Paramètres > Utilisateurs** (administrateur seulement).

| Action | Fonctionnement | Règles |
|---|---|---|
| Créer | Fonction serveur `admin-utilisateurs` | Appelant administrateur actif ; adresse valide et non utilisée ; nom ; rôle de la liste ; mot de passe de 12 caractères minimum ; site d'affectation obligatoire ou « Compte global » avec motif. Si le site est refusé, le compte est annulé. |
| Réinitialiser le mot de passe | Même fonction, action mot de passe | 12 caractères minimum ; aucun courriel n'est envoyé (aucun serveur de courriel). Transmettre le mot de passe à l'intéressé par un canal sûr, hors SIGTB. |
| Changer le rôle | Administrateur actif | Jamais sur son propre compte ; le dernier administrateur actif garde son rôle. |
| Désactiver, réactiver | Boutons de la liste | Motif obligatoire, journalisé ; refusé sur soi-même et sur le dernier administrateur actif. Un compte n'est jamais supprimé. |
| Site d'affectation | `definir_site_compte` | Site actif, ou compte global avec motif journalisé. |

Rôles : `admin` (Administrateur), `director` (Directeur), `operations_manager` (Responsable des opérations), `fleet_manager` (Responsable de flotte), `maintenance_chief` (Chef de maintenance), `logistician` (Logisticien), `accountant` (Comptable), `contract_manager` (Chargé de contrats et facturation), `driver` (Chauffeur).

Figure A.1 (capture à venir) : liste des comptes et fenêtre de création.

Limite : la liste des comptes affiche certains rôles sous leur code brut ; la fenêtre de création utilise les libellés réels.

## 4. Rôles et matrice rôle x module

Les droits par défaut d'un rôle sont dans la table `role_permissions` (lecture, écriture, approbation par module) ; matrice dans `docs/user-manual/00_INDEX.md`, section 3. Le serveur les lit par `has_module_view`, `has_module_write`, `has_module_approve`, qui exigent un compte actif. Un ajustement de la matrice passe par une migration, pas par l'écran. La signature des factures est réservée au rôle `director`.

Le menu n'affiche une entrée que si le compte lit le module correspondant ; un administrateur voit tout.

## 5. Droits par module et par utilisateur (D-036)

**Paramètres > Utilisateurs**, modification d'un compte, section « Droits d'accès aux modules ».

| Choix | Effet |
|---|---|
| Défaut (rôle) | Les droits du rôle s'appliquent (l'attribution est retirée). |
| Lecture | Lecture seule, quel que soit le rôle. |
| Écriture | Lecture et écriture, quel que soit le rôle. |
| Aucun | Aucun accès, même si le rôle en donne. |

- Écriture par `definir_droit_module`, motif obligatoire, journal `journal_droits_modules` (avant, après, auteur, date).
- L'attribution prime sur la matrice avec effet immédiat.
- Elle ne donne jamais l'approbation : l'approbation vient du rôle (ou d'une délégation d'approbation, section 7).
- Si `mfa_exige` est actif, modifier les droits demande une session aal2.
- Éviter une attribution sur un compte administrateur : l'interface lui montre tous les menus.

Figure A.2 (capture à venir) : section Droits d'accès aux modules avec motif.

## 6. Sites et périmètre (D-038, D-039, D-046, D-064, D-075)

| Profil | Ce qu'il voit et modifie |
|---|---|
| Compte global (sans site) | Toutes les lignes, y compris sans site |
| Affecté à un site | Les lignes de son site ; pour un voyage, site de départ ou d'arrivée ; une ligne sans site rattachable est invisible |

Le périmètre vaut aussi pour un administrateur affecté à un site. Il est contrôlé à la lecture et à l'écriture, y compris dans les fonctions serveur. Hors périmètre site : RH (les employés n'ont pas de site). Le sélecteur de site du menu n'est qu'un filtre d'affichage.

**Affectations multisites datées** (**Paramètres > Affectations multisites**) : un compte peut être affecté à plusieurs sites pour une période (fin incluse, facultative) ; pas de chevauchement au même site ; actions Affecter, Clore, Annuler (motif) ; **Rétablir le périmètre global** (motif, refusé tant qu'un site ou une affectation en cours ou à venir subsiste). Un compte dont toutes les affectations sont expirées ou annulées, sans site au profil, n'a **aucun site** ; il ne redevient jamais global de lui-même. Le tableau « Périmètre des comptes actifs » affiche le périmètre calculé.

Figure A.3 (capture à venir) : affectations multisites et périmètre calculé.

## 7. Délégations (D-064, D-082)

Un utilisateur délègue, pour une période et avec un motif, son droit d'**écriture** ou d'**approbation** sur un module, depuis **Sécurité du compte > Mes délégations** ; l'administrateur voit et révoque toutes les délégations dans **Paramètres > Délégations**.

Règles serveur :
- on ne délègue que ce que l'on détient en propre (pas un droit reçu par délégation) ; ni à soi-même, ni le module `settings`, ni l'administration ;
- le périmètre du délégué doit être compris dans celui du délégant ;
- la délégation vaut pendant sa période (début inclus, fin exclue) et devient « sans effet » si le délégant perd le droit, si le délégué devient inactif ou reçoit une attribution Lecture ou Aucun, ou si son périmètre dépasse celui du délégant ;
- une approbation déléguée ne donne pas l'écriture ;
- le délégué agit en son nom ; il ne valide pas ce que son délégant a saisi, et le délégant ne valide pas ce que son délégué a fait sous délégation ;
- révocation motivée ; journal `journal_delegations`. Aucune durée maximale n'est imposée.

Figure A.4 (capture à venir) : création d'une délégation.

## 8. Référentiels

| Référentiel | Écran | Qui écrit |
|---|---|---|
| Organisations | Paramètres > Organisations | Administrateur |
| Sites | Exploitation > Sites | Écriture `settings` |
| Infrastructures et fermetures | Exploitation > Infrastructures et fermetures | Écriture `settings` ou administrateur |
| Devises, unités de mesure | Paramètres > Référentiels et numérotation | Administrateur (`enregistrer_devise`, `enregistrer_unite`) ; libellés à saisir |
| Numérotations | Paramètres > Référentiels et numérotation | Lecture seule (format, compteur, dernier numéro) ; aucun format paramétrable |
| Fiche société (identité imprimée sur les factures) | Paramètres > Général | Écriture `settings` ou administrateur ; champs non fournis « à saisir » |
| Points de contrôle avant départ | RH & Sécurité > Contrôles avant départ | Administrateur |
| Habilitations exigées | Flotte > Habilitations chauffeurs | Administrateur |
| Distances de référence | Kilométrage | Écriture `contracts` ou administrateur |
| Cuves et citernes | Carburant > Réceptions, cuves et inventaires | Écriture `fuel` |
| Natures de dépense, plan comptable, comptes de tiers | Contrats & Finance > Budgets et comptabilité | Administrateur ou écriture `contracts` |
| Grille d'évaluation du loueur | Contrats & Finance > Évaluation Neemba | Administrateur |

Ordre recommandé du premier paramétrage : organisations, sites, shifts, infrastructures, engins, chauffeurs et habilitations, contrats et tarifs, cuves, dépôts et articles, puis comptes et droits.

## 9. Shifts

**Exploitation > Shifts** : administrateur ou écriture `settings`, profil sans site. Création ; modification motivée ; désactivation motivée ; jamais de suppression ; deux shifts actifs ne se chevauchent pas ; journal `journal_shifts`. Exemple de paramétrage : Jour 06:00-18:00, Nuit 18:00-06:00 (MGU chapitre 8).

## 10. Seuils et réglages lus par le serveur

**Paramètres > Général** (réglages serveur). La table `settings` n'est lisible et modifiable que par l'administrateur. Seules ces clés sont lues par une règle serveur :

| Clé | Effet | Si absente |
|---|---|---|
| `mfa_exige` | Session aal2 exigée pour droits, rectification de ticket CBG, signature de facture | Aucune exigence (se règle aussi depuis Sécurité du compte) |
| `controle_depart_exige` | Départ refusé sans contrôle avant départ du jour conforme | Non exigé |
| `carburant_validation_separee` | Mouvements et inventaires validés par un autre | Exigée |
| `kilometrage_validation_separee` | Distance validée par un autre que l'auteur des relevés | Exigée |
| `achats_validation_separee` | Bon approuvé par un autre que le demandeur | Exigée |
| `paiements_validation_separee` | Paiement approuvé par un autre que le proposant | Exigée |
| `planification_cloture_separee` | Clôture de journée par un autre que les auteurs des objectifs | Non exigée |
| `clauses_renonciation_separee` | Renonciation à une clause par un autre que l'auteur du calcul | Exigée |
| `tolerance_poids_cbg_t` | Tolérance de l'ancien rapprochement des relevés CBG (t) | 0 |
| `pneu_profondeur_min_mm`, `pneu_inspection_max_jours`, `pneu_reforme_precoce_km` | Seuils des pneus | Aucune alerte, performance sans données |
| `fournisseurs_alerte_documents_jours` | Délai d'alerte des documents fournisseurs | Selon la fonction serveur |
| `consultation_offres_minimum` | Nombre minimal d'offres d'une consultation | Selon la fonction serveur |
| `contrats_alerte_echeance_jours` | Avance de l'alerte d'échéance de contrat | 0 |
| `alerte_immobilisation_longue_h`, `alerte_ecart_carburant_l`, `alerte_voyage_sans_ticket_h` | Seuils des règles d'alerte à seuil | Règle inactive |
| `alerte_intervention_retard_active`, `alerte_controle_non_conforme_active`, `alerte_document_expire_active`, `alerte_action_corrective_retard_active`, `alerte_epi_echu_active`, `alerte_inspection_retard_active` | `false` met la règle hors service | Active |

Lever une séparation des tâches ou activer `mfa_exige` est une décision du propriétaire, à consigner dans `docs/SIGTB_2.0_DECISIONS.md` avant de l'appliquer. La tolérance de la pesée à deux sources se règle dans **Pesée CBG**, espace C (droit `settings`).

Figure A.5 (capture à venir) : réglages lus par le serveur.

## 11. Notifications

Les notifications sont écrites par le serveur (bon approuvé ou rejeté, paiement approuvé ou rejeté, anomalie au contrôle d'un paiement, clôture de poste validée) et lues par leur seul destinataire. Il n'existe pas d'envoi par courriel ou SMS, ni de règle de notification paramétrable. Les alertes du centre des décisions se règlent par les clés de la section 10.

## 12. Imports et exports

| Sens | Ce qui existe | Ce qui n'existe pas |
|---|---|---|
| Import | Relevé officiel CBG en CSV (Pesée CBG, espace A), avec empreinte | Import en masse d'engins, de chauffeurs, de pneus, d'articles, de fournisseurs, de livraisons |
| Export | CSV des listes standard ; CSV du centre de pilotage ; CSV des rapports et des rapports par axe des voyages ; export comptable CSV ; impressions (fiches A4, facture, lettres de relance, rapports) | Export Excel natif, PDF généré par le serveur |

## 13. Sécurité

- **Le serveur est la barrière** : politiques RLS sur les tables, fonctions serveur pour les écritures sensibles ; le menu masqué n'est qu'un confort.
- **Double authentification** : chaque utilisateur inscrit un facteur TOTP dans Sécurité du compte ; l'administrateur active l'exigence `mfa_exige` (bouton inactif tant que son propre facteur n'est pas inscrit). Ordre recommandé : faire inscrire administrateurs, directeur et chargés de contrats, puis activer, sur décision du propriétaire.
- **Mots de passe** : 12 caractères minimum ; transmis hors SIGTB ; aucun mot de passe dans un document, un ticket ou un message.
- **Secrets** : le fichier d'environnement du serveur n'est jamais affiché ni copié dans un document ; seules les clés publiques de l'interface sont côté navigateur.
- **Comptes partagés** : à proscrire ; chaque saisie porte son auteur, la séparation des tâches en dépend.
- **Départ d'un collaborateur** : désactiver le compte (motif), révoquer ses délégations, clore ses affectations.

## 14. Audit

| Journal | Contenu | Où le lire |
|---|---|---|
| `journal_comptes` | Désactivations, réactivations, motifs | Base (administrateur technique) |
| `journal_droits_modules` | Attributions de droits | Base |
| `journal_delegations` | Délégations et révocations | Paramètres > Délégations |
| `journal_affectations_sites` | Affectations multisites | Paramètres > Affectations multisites |
| Journal de connexion | Connexions, déconnexions, renouvellements, changements de mot de passe, facteurs MFA ; sessions ouvertes (sans jeton) | Paramètres > Journal de connexion |
| Journaux métier | `trip_events`, `decisions_dispatch`, `postes_journal`, `fiches_journal`, `journal_contrats`, `factures_journal`, `achats_journal`, `pneus_operations`, `interventions_journal`, `journal_shifts`, journal de flotte... | Onglet Historique des fiches, journal des événements |

Les tentatives de connexion échouées ne sont pas journalisées par le service d'authentification.

## 15. Sauvegardes et restauration (administrateur technique)

Architecture : pile Supabase auto-hébergée dans `/opt/sigtb` sur un serveur partagé avec d'autres applications ; un seul port local ; le serveur web du serveur relaie l'interface et les seules routes nécessaires. Détails : `docs/guides/guide-deploiement-sauvegarde-restauration.md`.

| Opération | Outil | Points clés |
|---|---|---|
| Sauvegarde quotidienne | `sauvegarder.sh` (tâche planifiée de nuit) | Dump complet (schémas public, auth, storage), format custom, empreinte SHA-256, conservation 14 jours ; archive des pièces justificatives prise après le dump ; contrôle de lisibilité |
| Copie hors serveur | À organiser par le propriétaire | Cible non fournie à ce jour |
| Test de restauration | `tester-restauration.sh` | Conteneur jetable sans réseau, détruit en fin de test ; production lue seulement |
| Restauration en production | `restaurer.sh` | Sauvegarder d'abord l'état actuel ; arrêter les services qui écrivent ; restauration en une transaction avec conservation des droits ; ne jamais lancer `pg_restore` directement (les fonctions internes redeviendraient exécutables) ; réappliquer les migrations postérieures ; tests pgTAP ; contrôles |
| Mise à jour | `appliquer-migrations.sh --tests`, release web par commit | Sauvegarde vérifiée avant ; migrations additives ; tests pgTAP verts sur la base du serveur ; release précédente conservée ; contrôles après ; accord du propriétaire depuis la première saisie réelle |
| Retour arrière web | Lien `current` vers la release précédente | Section 6 du guide de déploiement |
| Modification du serveur web partagé | Copie de la configuration, test de syntaxe, rechargement, vérification des autres sites, retour immédiat au moindre écart | D-069, réponse 2 |

## 16. Données d'exemple et de démonstration (D-020, D-074, D-076, D-084)

La démonstration initiale a été purgée le 2026-11-16 (D-076). Un jeu d'exemple de cinq lignes au plus par module (D-084), fictif et isolé du réel, peut être chargé pour apprendre ; ses identifiants commencent par `dec0de00-` et un bandeau s'affiche tant qu'il est présent.

| Commande (root, sur le serveur) | Effet |
|---|---|
| `bash deploy/vps/demo/demo.sh charger` | Charge le jeu (refusé s'il existe), active le bandeau ; ne crée ni ne modifie aucune ligne réelle |
| `bash deploy/vps/demo/demo.sh coherence` | Contrôles de cohérence par chaîne, lecture seule |
| `bash deploy/vps/demo/demo.sh apercu` | Liste ce qu'une purge supprimerait, sans rien modifier |
| `CONFIRMER_PURGE=oui CONFIRMER_RATTACHEES=<n> bash deploy/vps/demo/demo.sh purger` | Supprime le jeu et les n lignes rattachées listées par l'aperçu, retire le bandeau |
| `CONFIRMER_PURGE=oui bash deploy/vps/demo/demo.sh recharger` | Purge puis recharge aux dates du jour ; refusé s'il existe des lignes rattachées non étiquetées |
| `bash deploy/vps/demo/demo.sh etat` | Nombre de lignes d'exemple par table |

Une sauvegarde est prise automatiquement avant chaque modification. Charger ou purger en production après la première saisie réelle demande l'accord du propriétaire. Les deux shifts d'exemple sont désactivés après le chargement pour ne pas être proposés aux saisies réelles.

## 17. Erreurs fréquentes

| Code | Sens | Que faire |
|---|---|---|
| `42501` | Droit insuffisant, hors périmètre, ou séparation des tâches | Vérifier le rôle, l'attribution, le site, l'auteur de la saisie |
| `22023` | Règle métier non respectée (motif manquant, transition, heure future, stock insuffisant) | Corriger la saisie selon le message |
| `P0002` | Élément introuvable ou hors périmètre | Recharger ; vérifier le site |
| `23505` | Doublon (ticket, numéro de pneu) | Vérifier le numéro |
| `23503` | Référence inconnue | Vérifier le compte ou l'objet visé |
| `40001` | Modification concurrente (« en cours de modification ») | Recharger l'écran et refaire l'action |
| « new row violates row-level security policy » | Écriture directe refusée par la politique | Droit ou périmètre manquant |
| « Confirmation en deux etapes (MFA) requise » | Exigence MFA active, session aal1 | Se reconnecter avec le code |

Fonction de création de compte : 401 sans jeton, 403 si l'appelant n'est pas administrateur actif, 400 donnée invalide, 409 adresse déjà utilisée.

## 18. Maintenance courante

| Fréquence | Tâche | Rôle |
|---|---|---|
| Quotidienne | Vérifier le journal de sauvegarde ; lire le centre des décisions | Technique ; fonctionnel |
| Hebdomadaire | Revoir les comptes inactifs, les délégations en cours, les affectations qui expirent | Fonctionnel |
| Mensuelle | Test de restauration ; revue des attributions de droits ; revue des seuils d'alerte | Technique ; fonctionnel |
| À chaque départ | Désactiver le compte, révoquer les délégations, clore les affectations | Fonctionnel |
| À chaque déploiement | Sauvegarde vérifiée, migrations et tests, release précédente conservée, contrôles, notes de version (`docs/SIGTB_RELEASE_NOTES.md`), accord du propriétaire | Technique |

## 19. Limites connues

- Pas de réinitialisation du mot de passe par courriel ni de changement par l'utilisateur lui-même.
- Pas d'escalade des validations ; pas de durée maximale de délégation.
- Journal de connexion sans tentatives échouées.
- Formats de numérotation non paramétrables.
- Copie de sauvegarde hors serveur non organisée tant que la cible n'est pas fournie.

# Documentation utilisateur SIGTB : index général

> **Mise à jour du 2026-11-17 (après rédaction de la phase 1, rédigée sur la release 31f7267).** Depuis, sont déployés en 16598f1 : la partie serveur des Pneus (D-091, écran complet à venir), les pages J2, les pages des fiches terrain (préparation, lots d'impression, remise et retour, saisies FP et FC, brouillon), les étapes du voyage et les actions du Dispatch en pages (D-088). Les passages du manuel qui disent ces écrans absents seront corrigés en phase 3, avec les captures.

Version SIGTB documentée : `origin/main` 1896cde (2026-11-17). Production constatée : release 31f7267. Date de rédaction : 2026-11-17 (`date -u`). Mission D-092, phase 1 : textes sans captures ; chaque figure attendue porte un renvoi « Figure N.M (capture à venir) ».

SIGTB est la plateforme de gestion du transport de bauxite de Kogon Mining SARL (client facturé : CBG ; loueur des engins : Neemba). Adresse publique : https://sigtb.infranetgn.com.

## 1. Documents

| Document | Contenu | Public |
|---|---|---|
| [SIGTB_MANUEL_GENERAL_UTILISATEUR.md](SIGTB_MANUEL_GENERAL_UTILISATEUR.md) | Présentation, connexion, interface, un chapitre par module (structure A à K), fonctionnalités à développer | Tous |
| [CATALOGUE_FONCTIONNALITES.md](CATALOGUE_FONCTIONNALITES.md) et [CSV](SIGTB_CATALOGUE_MODULES_ET_FONCTIONNALITES.csv) | 176 fonctionnalités, statut vérifié dans le code, preuve, capture, procédure | Direction, chefs de service, formateurs |
| [CARTOGRAPHIE.md](CARTOGRAPHIE.md) | Finalité, entrées, sorties, validations et dépendances de chaque module ; schéma des flux | Direction, chefs de service |
| [../functional-circuits/SIGTB_GUIDE_CIRCUITS_OPERATIONNELS.md](../functional-circuits/SIGTB_GUIDE_CIRCUITS_OPERATIONNELS.md) | Circuits A à J de bout en bout | Responsables de processus |
| [../admin-manual/SIGTB_MANUEL_ADMINISTRATEUR.md](../admin-manual/SIGTB_MANUEL_ADMINISTRATEUR.md) | Comptes, droits, sites, délégations, réglages, sauvegardes, sécurité | Administrateurs fonctionnel et technique |
| [../training/SIGTB_GUIDE_PRISE_EN_MAIN_AUTONOME.md](../training/SIGTB_GUIDE_PRISE_EN_MAIN_AUTONOME.md) et [CORRIGES.md](../training/CORRIGES.md) | Dix niveaux d'apprentissage, exercices, questionnaires, corrigés séparés | Nouveaux utilisateurs, formateurs |
| [../faq/SIGTB_FAQ_UTILISATEURS.md](../faq/SIGTB_FAQ_UTILISATEURS.md) | Questions fréquentes | Tous |
| [../glossary/SIGTB_GLOSSAIRE.md](../glossary/SIGTB_GLOSSAIRE.md) | Termes métier et techniques | Tous |
| [MATRICE_COHERENCE.md](MATRICE_COHERENCE.md) | Fonctionnalité, page, capture, procédure, test, statut documentaire | Équipe documentation |
| [ANOMALIES_PEDAGOGIQUES.md](ANOMALIES_PEDAGOGIQUES.md) | 17 cas d'anomalie : détection réelle par SIGTB, action, validation | Exploitation, contrôle, formateurs |

Les guides `docs/guides/*.md` (rédigés pour l'équipe, état du 2026-11-15) restent la référence détaillée des règles serveur ; `ADMINISTRATION.md`, `FONCTIONNALITES_IA.md` et `PAIE_AUTOMATIQUE.md` de ce dossier sont hérités de Bolt et ne sont pas fiables.

## 2. Index par module

Chapitres du manuel général (MGU) et du manuel administrateur (MAD).

| Module | Menu | Chapitre MGU | Circuit | Jalon |
|---|---|---|---|---|
| Accès et sécurité du compte | Page de connexion, menu profil | 2 | - | J1 |
| Interface commune (menu, recherche, pages standard, pièces jointes) | Tout l'écran | 3 | - | J1 |
| Tableau de bord, Centre de pilotage | Tableau de bord, Centre de pilotage | 4 | J | J3 |
| Mes validations, notifications | Mes validations | 5 | I | J3 |
| Centre des décisions (alertes) | Exploitation > Centre des décisions | 6 | H, J | J3 |
| Sites, infrastructures, fermetures | Exploitation > Sites, Infrastructures et fermetures | 7 | A | J1 |
| Shifts | Exploitation > Shifts | 8 | A, B | J1 |
| Planification | Planification | 9 | A | J1 |
| Postes de travail | Postes de travail | 10 | A, B | J1 |
| Dispatch | Dispatch | 11 | A, B | J1 |
| Voyages et rotations | Voyages & Rotations | 12 | A, B | J1 |
| Kilométrage | Kilométrage | 13 | A | J1 |
| Fiches terrain | Fiches terrain | 14 | B, C | J1 |
| Pesée CBG | Pesée CBG | 15 | C | J1 |
| Opérations transport | Opérations transport | 16 | A, B, C | J1 |
| Véhicules et engins | Flotte > Véhicules et engins | 17 | G | J1, J2 |
| Chauffeurs, habilitations, infractions | Flotte > Chauffeurs, Habilitations chauffeurs | 18 | B, H | J1 |
| Documents des engins | Flotte > Documents | 19 | I | J1 |
| Carburant | Carburant (six entrées) | 20 | D | J2 |
| Maintenance et immobilisations | Maintenance (quatre entrées) | 21 | G | J2 |
| Pneus | Pneus | 22 | E | J2 |
| Stocks | Stocks & Achats > Stocks | 23 | F | J2 |
| Achats | Stocks & Achats > Achats | 24 | F | J2 |
| Fournisseurs | Stocks & Achats > Fournisseurs | 25 | F | J2 |
| Moyens généraux et patrimoine | Stocks & Achats > Moyens généraux et patrimoine | 26 | - | J4 |
| Contrats et Neemba | Contrats & Finance (dossier, engagements, comités, mon tableau de bord, évaluation et factures Neemba) | 27 | A, G | J1, J2 |
| Réconciliation, facturation CBG, recouvrement | Contrats & Finance | 28 | A, C, J | J1 |
| Paiements, budgets, coûts | Contrats & Finance | 29 | F | J2 |
| Santé, sécurité (HSE) | RH & Sécurité > Contrôles avant départ, Incidents, Prévention HSE | 30 | H | J1, J4 |
| Ressources humaines | RH & Sécurité > Employés, Présences, Paie | 31 | - | hors jalon |
| Reporting et analyses | Reporting & Analyse | 32 | J | J3 |
| Suivi GPS, géorepérage, IoT, environnement | Exploitation, Reporting & Analyse | 33 | - | extension |
| Paramètres | Paramètres | 34 et MAD | - | J1 |
| Fonctionnalités à développer | - | 35 | - | - |

## 3. Droits et rôles

L'accès se règle par **module** (lecture, écriture, approbation), puis par compte (attribution par utilisateur, délégation), puis par **site**. Le tableau donne les droits du rôle par défaut (E écriture, L lecture, +A approbation, - aucun). Source : `docs/guides/guide-administrateur.md`, section 3 (table `role_permissions`).

| Module (code) | admin | director | operations_manager | fleet_manager | maintenance_chief | logistician | accountant | driver | contract_manager |
|---|---|---|---|---|---|---|---|---|---|
| dashboard | E+A | E+A | L | L | L | L | L | L | L |
| vehicles | E+A | E+A | E | E | E | E | L | L | E |
| drivers | E+A | E+A | E | E | - | L | L | - | E |
| trips | E+A | E+A | E | E | - | E | L | L | E |
| planning | E+A | E+A | E | E | - | L | L | L | E |
| gps_tracking | E+A | E+A | L | L | - | L | - | - | L |
| fuel | E+A | E+A | E | E | - | E | L | L | E |
| maintenance | E+A | E+A | E | E | E | E | L | L | E |
| stock | E+A | E+A | L | L | L | E | L | - | L |
| purchases | E+A | E+A | - | - | - | E | E+A | - | E |
| invoices | E+A | E+A | - | - | - | L | E+A | - | E |
| contracts | E+A | L+A | - | - | - | - | L | - | E |
| costs | E+A | E+A | - | - | - | L | E+A | - | E |
| hr | E+A | E+A | - | - | - | - | E+A | - | E |
| reports | E+A | E+A | L | L | - | L | E | - | E |
| settings | E+A | E | - | - | - | - | - | - | E |

Règles hors matrice : la signature d'une facture est réservée au rôle directeur ; la séparation des tâches interdit de valider sa propre saisie (carburant, kilométrage, achats, paiements, fiches, clôtures de poste, remises en service) ; un compte affecté à un site ne voit que son site.

## 4. Qui lit quoi (par rôle)

| Rôle | Chapitres MGU à lire en priorité | Autres documents |
|---|---|---|
| Administrateur (`admin`) | 2, 3, 34 | MAD en entier ; FAQ |
| Directeur général (`director`) | 2 à 6, 28 (signature), 29, 32 | Circuits A, J ; cartographie |
| Responsable des opérations (`operations_manager`) | 2, 3, 6 à 16, 30 | Circuits A, B, C, H ; anomalies pédagogiques |
| Dispatcheur, chef de poste (droit `trips`) | 2, 3, 8, 10, 11, 12, 16 | Circuit B ; prise en main niveaux 1 à 5 |
| Agent de saisie terrain (droit `trips`, `fuel` ou `maintenance`) | 2, 3, 14, 15 (espace B), 20.F.1, 30.F.1 | FAQ ; prise en main niveaux 1 à 4 |
| Contrôleur pesée (droit `trips`) | 14, 15, 16 | Circuit C ; anomalies 7 et 8 |
| Responsable de flotte (`fleet_manager`) | 17, 18, 19, 21, 22, 30 | Circuits E, G |
| Chef de maintenance (`maintenance_chief`) | 14 (fiche FP), 21, 22, 23 | Circuit G |
| Logisticien, magasinier (`logistician`) | 20, 23, 24, 25, 26 | Circuits D, F |
| Comptable (`accountant`) | 5, 28, 29 | Circuits F, J |
| Chargé de contrats et facturation (`contract_manager`) | 13, 27, 28, 29 | Circuits A, C, J |
| Chauffeur (`driver`) | 2, 3 (lecture seule) | FAQ |

## 5. Conventions de ces documents

- Les libellés d'écran sont écrits en gras, tels qu'ils s'affichent.
- Les messages du serveur sont reproduits sans accents, comme l'application les affiche.
- « Droit `trips` en écriture » signifie : un rôle ou une attribution qui donne l'écriture du module `trips`.
- Aucune donnée personnelle, mot de passe, secret ni adresse de serveur n'est reproduit. Les exemples utilisent des valeurs fictives clairement marquées (« exemple »).
- Une fonctionnalité qui n'existe pas n'a pas de procédure : elle figure au chapitre 35 du manuel général.

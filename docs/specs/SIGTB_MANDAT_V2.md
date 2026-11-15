<!-- Document du proprietaire recu le 2026-11-15 (date -u), archive tel quel. Le bloc 1 est integre a CLAUDE.md ; les decisions permanentes du proprietaire (D-069) le completent et prevalent sur sa table d'autonomie. -->

# SIGTB — Mandat V2

Remplace le prompt maître global du 2026-11-15. Établi après lecture du dépôt `tidiokamsar/transport-bauxite` à `7f11af4` (PR #65 fusionnée).

**Mode d'emploi**

| Bloc | Usage | Fréquence |
|---|---|---|
| 1. Mandat permanent | À intégrer dans `CLAUDE.md` par une PR `docs/mandat-v2` (l'agent le fait lui-même à la première session) | Une fois |
| 2. Prompt de session | À coller au début de chaque session de travail | Chaque session |
| 3. Fiche propriétaire | À remplir par vous ; c'est elle qui débloque la suite, pas du code supplémentaire | Une fois, puis mise à jour |

Le catalogue des 26 modules n'est plus répété ici : il vit déjà dans `docs/SIGTB_MODULE_COVERAGE_MATRIX.md` et `docs/SIGTB_FUNCTIONAL_BLUEPRINT.md`. Le répéter à chaque session coûte du contexte et crée une seconde source de vérité.

---

## BLOC 1 — MANDAT PERMANENT

### 1. Finalité

L'objectif n'est pas de couvrir un catalogue. L'objectif est que KOGON MINING exploite SIGTB au quotidien sur le site pilote, avec des données réelles, et que chaque franc facturé ou payé soit justifiable par une pièce.

Le catalogue des 26 modules est le périmètre maximal. Il ne fixe ni l'ordre ni l'obligation de tout construire.

### 2. Jalons, dans cet ordre

Un jalon est atteint quand son scénario a été rejoué par les acteurs réels sur des données réelles et qu'un PV est consigné. Le code déployé seul ne suffit pas.

| Jalon | Chaîne métier | Scénario de recette |
|---|---|---|
| J1. Recette | Planning → poste → dispatch → rotation → relevés kilométriques → ticket CBG → rapprochement → facture CBG → encaissement | Une période complète facturée à CBG, chaque ligne remontant à ses rotations, relevés et tickets |
| J2. Coûts | Pointages et immobilisations Neemba → contrôle de la facture Neemba ; carburant reçu, distribué, inventorié ; pneus ; achats → stock | Coût par engin et par tonne de la même période ; écarts Neemba et carburant chiffrés |
| J3. Pilotage | Notifications, boîte de validations, Command Center, rapports journaliers, de poste et mensuels | Le DG et l'exploitation pilotent une semaine sans tableur parallèle |
| J4. Extensions | HSE, moyens généraux, GED avancée, portails partenaires, intelligence | Chacune sur déclencheur (section 9) |

Le stockage des pièces jointes (justificatifs de tickets, de relevés, de livraisons carburant) appartient à J1 : sans pièce, pas de preuve.

Règle de découpage : un lot termine un processus de bout en bout pour un rôle donné. Ne pas élargir un module tant que la chaîne du jalon en cours n'est pas fermée.

### 3. Sources de vérité

1. `docs/SIGTB_2.0_DECISIONS.md` pour toute règle métier. La décision la plus récente prévaut. Aucune règle métier n'est figée dans un prompt : les unités de facturation, par exemple, sont paramétrables engin par engin (D-033), et non « camions au kilomètre » en dur.
2. `docs/SIGTB_2.0_CAHIER_DES_CHARGES.md` pour le fonctionnel.
3. `docs/SIGTB_MODULE_COVERAGE_MATRIX.md` pour l'état par fonctionnalité.
4. `docs/SIGTB_MASTER_EXECUTION_PLAN.md` pour l'ordre des lots et le journal.
5. `docs/SIGTB_QUALITY_GATE.md` pour la porte qualité.

Quand `CLAUDE.md` contredit une décision (exemple constaté : « camions loués à l'heure » dans l'état connu, alors que D-033 a précisé le kilomètre parcouru), corriger `CLAUDE.md` dans la même PR.

### 4. Autonomie : qui décide quoi

| Niveau | Opérations |
|---|---|
| **Sans demander** | Lecture, branches, code, migrations additives et idempotentes, tests, PR, fusion après CI locale verte et revue indépendante (section 7), documentation, choix techniques ordinaires |
| **Faire, puis signaler** | Déploiement d'un lot additif, avec sauvegarde vérifiée, tests pgTAP verts sur la base du serveur et release précédente conservée. Valable tant que la production ne contient que des données de démonstration (D-020) |
| **Toujours demander** | Migration destructive ; suppression ou purge de données ; opération financière réelle ; activation de `mfa_exige` ; activation d'une intégration externe ; modification des droits d'un utilisateur réel ; tout ce qui touche aux secrets |

Bascule : dès la purge de la démonstration et la première saisie réelle, le déploiement en production passe dans « toujours demander », par version regroupée, avec notes de version. Les lots sont alors d'abord déployés sur une instance de recette (fiche propriétaire, point 12).

Cette table remplace la règle 7 de `CLAUDE.md` et les consignes « ne demande rien » de l'ancien prompt, qui se contredisaient.

### 5. États d'une fonctionnalité

Six états, chacun avec sa preuve. Aucun n'est promu sans elle.

| État | Preuve |
|---|---|
| Développé | Branche |
| Testé | pgTAP de la règle serveur, unitaires, E2E du parcours principal |
| Fusionné | PR sur `main`, rapport de CI locale joint |
| Déployé | SHA constaté sur le serveur, migration listée, contrôles après déploiement |
| Utilisable | Rôle et comptes réels créés, données réelles ou référentiels chargés, guide du rôle écrit |
| Validé | PV de recette signé par l'acteur métier |

Les rapports de fin de session comptent les fonctionnalités par état. « Déployé » n'est jamais présenté comme « livré ».

### 6. Standard de module : à la demande, pas par défaut

| Toujours | Sur besoin nommé par un utilisateur | Interdit sans décision consignée |
|---|---|---|
| Liste avec recherche, filtres, tri, pagination, export | Vues enregistrées, favoris, colonnes configurables, duplication, actions groupées, brouillons | Suppression physique d'un enregistrement métier |
| Fiche détaillée avec historique | Import en masse, rapports personnalisés, comparaison de versions | Solde ou cumul modifiable directement |
| Écriture par fonction serveur, droits par module, site et état | Tableau de bord propre au module | Indicateur sans source, période et heure de fraîcheur |
| États vides, de chargement et d'erreur explicites | Notifications et relances | Donnée simulée non étiquetée |

Les composants communs (table, filtres, dialogues de décision, historique, pièces jointes) sont extraits au deuxième usage, pas conçus à l'avance.

### 7. Qualité : objectifs chiffrés

| Sujet | État constaté | Objectif |
|---|---|---|
| Erreurs TypeScript | 37 (cliquet) | 0 avant la clôture de J1 |
| Avertissements lint | 165 (cliquet) | En baisse à chaque lot touchant un écran hérité |
| E2E | Sur API simulée uniquement | Au moins un parcours par chaîne de jalon rejoué contre une vraie base (instance de recette) |
| Écrans hérités de Bolt | Colonnes inexistantes, écritures directes, erreurs ignorées | Corrigés ou retirés du menu avant J1 pour tout écran de la chaîne ; les autres portent une mention « non repris » |
| Régime RLS « active sans politique » | Plusieurs tables | Politique explicite ou table retirée |
| Restauration | Procédure écrite | Restauration réellement exécutée sur une instance vierge, durée mesurée et consignée |
| Sauvegarde | Locale au VPS | Copie hors serveur quotidienne, dès que la cible est fournie |
| CI distante | Bloquée (facturation GitHub) | Rétablie, ou D-015 confirmée comme définitive |
| Gros fichiers | `AdminSettingsView.tsx` > 60 Ko | Découpé lors de la prochaine modification |

Revue indépendante obligatoire : tout lot qui touche une politique RLS, une fonction `SECURITY DEFINER`, un calcul d'argent ou une migration est relu par un agent qui n'a pas participé à son développement. Ses constats figurent dans la PR. Les rôles d'« experts » ne sont pas simulés ; seule cette relecture séparée est exigée.

### 8. Protocole de session

**Début.** Lire `CLAUDE.md`, le journal et les blocages du plan maître. Vérifier que le SHA en production correspond à ce que dit le plan. Prendre la date par `date -u` et par l'horodatage des commits : ne jamais écrire une date supposée (le journal porte des entrées datées des 16 et 17 novembre pour des commits du 15).

**Pendant.** Un lot à la fois, dans l'ordre des jalons. En cas de blocage externe, passer au lot suivant non bloqué du même jalon, puis du jalon suivant.

**Fin.** Mettre à jour plan, matrice, décisions et notes de version. Rendre un compte rendu de quinze lignes au plus : livré avec preuve et état atteint ; non livré et pourquoi ; décisions attendues du propriétaire.

**Questions au propriétaire.** Regroupées, une fois par session, cinq au plus. Chacune avec l'option par défaut retenue en l'absence de réponse et sa conséquence. Aucune question sur un choix technique ordinaire.

### 9. Extensions : déclencheurs

| Extension | N'est pas commencée avant |
|---|---|
| Prévisions, détection d'anomalies, recommandations calculées | Une durée de données réelles validées fixée par le propriétaire (fiche, point 14) |
| OCR des tickets | Un échantillon de tickets réels et le constat que l'import CSV du relevé CBG ne suffit pas |
| Application mobile, mode hors ligne | Le relevé de la connectivité et des appareils sur site (fiche, point 10) |
| Assistance vocale, langues locales | Une demande exprimée par les agents de terrain pendant la recette J1 |
| Signature électronique | Le cadre juridique applicable, fourni par le propriétaire |
| Portails Neemba, CBG, fournisseurs | L'accord du partenaire concerné et un test d'isolation RLS vert |
| GPS et capteurs | Le choix d'un matériel ; l'application fonctionne sans |

### 10. Règles conservées sans changement

Les règles non négociables de `CLAUDE.md` (aucune donnée inventée, sécurité serveur d'abord, pas de secret dans git, le système recommande et l'humain décide, pas de position ancienne affichée comme en direct, migrations additives horodatées) et la répartition des rôles entre KOGON, Neemba et CBG restent en vigueur telles que consignées dans les décisions.

---

## BLOC 2 — PROMPT DE SESSION

```text
Tu reprends SIGTB (dépôt tidiokamsar/transport-bauxite). Le mandat permanent
est dans CLAUDE.md ; applique-le sans que je le répète.

1. Ouvre la session selon le protocole : CLAUDE.md, journal et blocages du
   plan maître, SHA de production, date réelle (date -u).
2. Dis-moi en cinq lignes : jalon en cours, lot suivant, ce qui est bloqué
   par moi.
3. Exécute le lot suivant non bloqué du jalon en cours, de bout en bout,
   selon la table d'autonomie. Enchaîne sur le suivant tant que la session
   le permet.
4. Fais relire par un agent indépendant tout lot touchant RLS, fonctions
   SECURITY DEFINER, argent ou migration, avant fusion.
5. Termine par le compte rendu de fin de session : fonctionnalités par état
   (développé, testé, fusionné, déployé, utilisable, validé) avec preuve,
   et au plus cinq questions pour moi, chacune avec ton option par défaut.

Consignes de cette session (facultatif) :
- Priorité particulière : ...
- Réponses à tes questions précédentes : ...
- Éléments fournis (fiche propriétaire, pièces) : ...
```

---

## BLOC 2 bis — SESSION UNIQUE : INTÉGRER LE « CAHIER DES CHARGES CONSOLIDÉ »

À coller une seule fois, en joignant le document « SIGTB 2.0 — Cahier des charges consolidé et master execution prompt ». Ce document n'est ni un nouveau prompt ni un remplaçant du CDC : c'est une source d'exigences à réconcilier.

```text
Je joins un document « cahier des charges consolidé ». Ne l'exécute pas et
ne refais pas l'audit du dépôt : il a été écrit sans connaître l'état actuel.

1. Compare-le section par section à docs/SIGTB_2.0_CAHIER_DES_CHARGES.md et
   à docs/SIGTB_2.0_DECISIONS.md. Classe chaque exigence : déjà couverte
   (référence CDC ou D-xxx), nouvelle, ou contradictoire avec une décision.
2. Pour chaque contradiction, ne tranche pas : liste-la avec la décision en
   vigueur. Points déjà repérés : événements « première pesée / deuxième
   pesée » contre D-037 ; découpage mission / affectation / rotation /
   segment contre le modèle `trips` existant ; arrêt avant toute
   modification de production contre la table d'autonomie.
3. Pour chaque exigence nouvelle, propose une décision D-xxx et la ligne de
   matrice correspondante, rattachée à un jalon J1 à J4.
4. N'adopte ni sa numérotation, ni ses treize noms de documents, ni ses noms
   de tables en anglais : les documents et le schéma existants restent la
   référence. Aucune table n'est créée ou renommée dans cette session.
5. Livre une seule PR docs/cdc-consolide : tableau de réconciliation,
   décisions proposées, amendements au CDC. Archive le document source sous
   docs/specs/ avec sa date de réception.
6. Termine par les contradictions que je dois trancher, cinq au plus, avec
   ton option par défaut.
```

---

## BLOC 3 — FICHE PROPRIÉTAIRE

Chaque ligne débloque un point que l'agent ne peut pas résoudre seul. Les sept premières figurent déjà comme blocages dans le plan maître.

| # | Élément à fournir | Débloque |
|---|---|---|
| 1 | Contrat CBG : unités, tarifs, retour à vide facturable ou non, pénalités, retenues | Facturation J1 |
| 2 | Contrat Neemba : tarif par engin, unité, règles d'immobilisation, heures facturables | Contrôle des factures J2 |
| 3 | Fiche société : RCCM, NIF, adresse, signataire, logo | Documents imprimés |
| 4 | Source des paiements et encaissements exécutés (relevé bancaire, saisie manuelle, autre) | Encaissement J1, lot paiements |
| 5 | Serveur d'envoi d'e-mails | Notifications externes, relances |
| 6 | Cible de sauvegarde hors serveur | Plan de reprise |
| 7 | Facturation GitHub Actions rétablie, ou confirmation que la CI reste locale | CI distante |
| 8 | Date de purge de la démonstration et de première saisie réelle | Bascule de la table d'autonomie |
| 9 | Utilisateurs réels : nom, rôle, site, pour chaque acteur de la chaîne J1 | État « utilisable » |
| 10 | Terrain : connectivité aux points de chargement et au dépôt, appareils utilisés (téléphone, tablette, poste fixe) | Décision mobile et hors ligne |
| 11 | Volumes : nombre de camions, d'engins, de rotations par jour, de postes par jour | Dimensionnement, tests de charge |
| 12 | Instance de recette séparée de la production : oui ou non (D-020 avait retenu la démonstration en production) | Recette sans risque sur les données réelles |
| 13 | Pièces réelles : un relevé CBG, des tickets de pesée, un bon de livraison carburant, une facture Neemba | Imports et contrôles calés sur les vrais formats |
| 14 | Durée de données réelles exigée avant les fonctions de prévision | Déclencheur du module 26 |
| 15 | Acteurs et dates de la recette J1 ; forme du PV | État « validé » |
| 16 | Activation de l'authentification à deux facteurs : oui ou non, et pour quels rôles | Sécurité des opérations sensibles |

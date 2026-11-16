# SIGTB - consignes projet

Plateforme de gestion des operations de transport de bauxite de Kogon
Mining SARL (Guinee ; mention historique : DARI HOLDING ; D-027). Client
facture : CBG ; loueur des engins : Neemba. Code initial genere par Bolt, repris sous git le
2026-09-03. Langue du code et des docs : francais.

## Documents de reference (lire avant d'agir)

- `docs/SIGTB_2.0_CAHIER_DES_CHARGES.md` : CDC 2.0, seule reference
  fonctionnelle. `docs/specs/CONFORMITE_DECLAREE_BOLT.md` est une archive
  aux affirmations fausses : ne jamais s'y fier.
- `docs/SIGTB_2.0_PROGRESS.md` : etat de reference et suivi par LOT.
- `docs/SIGTB_2.0_DECISIONS.md` : decisions ; toute derogation au CDC y est
  consignee avant d'etre codee.
- `docs/PLAN_REVUE_MODULES.md` : LOT 01 (remise a niveau du socle) et
  checklist de re-revision (section 7).
- Mandat global du 2026-11-15 (26 modules) : `docs/SIGTB_MASTER_EXECUTION_PLAN.md`
  (ordre des lots, journal), `docs/SIGTB_MODULE_COVERAGE_MATRIX.md` (etat
  par fonctionnalite), `docs/SIGTB_QUALITY_GATE.md` (porte qualite),
  `docs/SIGTB_ARCHITECTURE_TARGET.md`, `docs/SIGTB_FUNCTIONAL_BLUEPRINT.md`,
  `docs/SIGTB_RELEASE_NOTES.md` (a completer a chaque deploiement).

## Decisions permanentes du proprietaire (D-069, 2026-11-15)

Elles valent autorisation et prevalent sur la table d'autonomie du bloc 1 (section 4) et sur l'ancienne regle 7. Ne pas reposer ces questions.

**Autonomie.** Tant que la production ne contient que la demonstration (D-020), l'agent decide, fusionne et deploie seul, sans demander. Conditions de chaque deploiement :
- sauvegarde verifiee ;
- tests de la base verts sur le serveur ;
- release precedente conservee ;
- controle apres deploiement.

Arret pour trois choses seulement :
- purge de la demonstration et premiere saisie reelle ;
- suppression definitive de donnees ou de tables ;
- operation financiere reelle, ou activation d'une integration externe payante.

**Reponses du 2026-11-15.**
1. Deuxieme vague (D-063 a D-068) : d'abord l'integration du mandat V2 et la revue a posteriori de D-041 a D-062. Ensuite D-063 et D-066, puis D-064, D-065, D-067, D-068, une branche a la fois, chacune apres revue independante. Les branches ne doivent pas vieillir.
2. Pieces jointes autorisees : bucket prive, politiques par module et site, controle du type et de la taille. Le serveur web est partage :
   - copier sa configuration avant modification ;
   - tester la syntaxe avant le rechargement ;
   - verifier les autres sites apres ;
   - revenir en arriere immediatement au moindre ecart.
3. Recette : pas d'attente d'une instance. Un parcours de bout en bout par chaine (J1, J2) est rejoue contre une vraie base, dans le conteneur jetable du rejeu et de la restauration. Si le VPS a les ressources sans toucher a la production, une pile de recette separee est montee en plus ; sinon, la raison est consignee.
4. Les 47 tables publiques a RLS active sans politique : aucune suppression. Celles qu'aucun code ne lit sont deplacees dans un schema d'archive (reversible), apres sauvegarde ; les autres recoivent une politique explicite avec test.
5. Continuer sans le proprietaire sur tout ce qui ne depend pas de la fiche proprietaire.

**Regles que l'agent s'applique seul.**
- Revue independante avant toute fusion touchant RLS, SECURITY DEFINER, argent ou migration. Revue a posteriori de D-041 a D-062 en priorite, avant tout nouveau developpement ; ce qu'elle revele est corrige.
- Dates : `date -u`. Une erreur passee se corrige par un erratum date et visible (D-070), jamais par une reecriture silencieuse.
- Erreurs TypeScript a 0 ; avertissements lint en baisse.
- Donnees manquantes (contrats, tarifs, comptes, pieces reelles) : construire le parametrage, les ecrans de saisie, les imports et les guides, pour que le proprietaire n'ait plus qu'a saisir. Aucune valeur inventee.
- Extensions a declencheur du V2 (prevision, OCR, mobile hors ligne, voix, signature, portails, GPS) : ne pas les commencer.

**Condition d'arret.** Quand tout ce qui ne depend pas du proprietaire est fait, revu et deploye, l'agent s'arrete et n'elargit pas le perimetre. Il remet un seul document :
- l'etat par jalon ;
- les preuves ;
- la liste exacte, ecran par ecran, de ce que le proprietaire doit saisir ou fournir pour passer J1 a « utilisable ».

**Compte rendu de fin de session** : quinze lignes, sans question, sauf l'un des trois arrets ci-dessus.

## Mandat permanent (bloc 1 du mandat V2, recu le 2026-11-15)

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

> **Remplacé le 2026-11-16 par D-077 (demande du propriétaire).** Le
> standard complet en 12 blocs (dashboard, liste, CRUD, fiche détaillée,
> modals et formulaires, actions métier, workflows, documents, rapports,
> historique, notifications, paramétrage) est la cible de chaque module, avec
> la bibliothèque commune de composants (DataTable, CreateModal, EditModal,
> DetailDrawer, DeleteDialog, ArchiveDialog, ActionDialog, AttachmentModal,
> ImportWizard, ExportModal, HistoryDrawer, CommentThread, AssignmentModal,
> BulkActionBar), le catalogue maître `docs/catalogue/` (une fiche de 20
> sections par module, modèle `docs/catalogue/MODELE_FICHE_MODULE.md`) et la
> matrice de couverture. Spécification : `docs/specs/SIGTB_STANDARD_MODULES.md`.
> Restent en vigueur : aucune suppression physique d'une pièce métier
> (correction par opération tracée), écriture par fonction serveur, aucune
> donnée inventée, ordre des jalons comme ordre de réalisation, revue
> indépendante, accord du propriétaire avant tout déploiement après la
> première saisie réelle. Le tableau ci-dessous est conservé pour mémoire.

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

## Stack et commandes

React 18 + TypeScript + Vite + Tailwind, Supabase (Postgres, RLS, Auth,
Edge Functions Deno), Leaflet, lucide-react. Pas de nouvelle dependance UI.

```bash
npm ci
npm run typecheck
npm run lint
npm run build
bash scripts/ci-qualite.sh   # cliquet : 0 erreur lint, pas de regression
npm test                     # vitest (src/**/*.test.ts)
npm run test:e2e             # playwright (e2e/), installe chromium une fois
npm run test:rls             # pgTAP via supabase test db (base de reference, D-017)
npm run test:rls:rejeu       # rejeu des migrations + pgTAP, conteneur jetable
npm run ci:locale            # CI complete en local (D-015), rapport test-results/
```

Baselines du cliquet : `.github/ci-baseline.env`. Les baisser dans la meme
PR quand la dette diminue ; ne jamais les remonter.

## Regles non negociables

1. **Aucune donnee inventee.** Pas de `Math.random`, de valeur par defaut
   fictive ni de position GPS fabriquee dans un chemin qui ecrit en base ou
   s'affiche comme reel. Absence de donnee = affichage « sans donnees ».
   Une simulation est etiquetee `SIMULATED` et jamais melangee au reel
   (CDC 26, 27, 32).
2. **Securite serveur d'abord.** Toute nouvelle table : RLS active, aucune
   politique `FOR ALL USING (true)`. Lecture selon le perimetre, ecriture via
   `has_module_write('<module>')` ou fonction serveur ; `is_admin()` pour
   l'administration. Cible : role x organisation x site (CDC 4.3).
3. **Pas de secret dans le code ni dans git.** `.env` n'est jamais commite
   ni affiche ; seules les cles `VITE_*` publiques vont cote client.
4. **Le systeme recommande, l'humain decide** (CDC 11.5). Aucune
   modification automatique d'affectation ou de donnee validee sans regle
   d'autorisation ; corrections = nouvel evenement audite, pas de reecriture
   silencieuse (CDC 31).
5. **Une position ancienne n'est jamais affichee comme en direct** (CDC 15) ;
   chaque KPI expose periode, source, fiabilite et heure (CDC 8).
6. **Migrations** : nouveau fichier horodate dans `supabase/migrations`,
   idempotent (`IF NOT EXISTS`), jamais de modification d'une migration
   existante. Cartographier l'existant avant de creer une table (CDC 33).
7. **Ne pas confondre merge, teste, valide, deploye** (CDC 44 ; six etats du bloc 1, section 5). L'autonomie de deploiement est fixee par D-069 (ci-dessus), qui remplace l'ancienne regle 7.

## Git

- Branches : `lot-XX/<sujet>` pour le CDC 2.0, `revue/<module>` et
  `secu/<sujet>` pour le LOT 01, `docs/<sujet>`.
- Commits conventionnels en francais : `feat:`, `fix:`, `refactor:`,
  `docs:`, `securite:`, `test:`.
- Une PR par unite de travail vers `main`, avec perimetre, controles
  (typecheck, lint, build, tests), impact RLS et mise a jour de
  `docs/SIGTB_2.0_PROGRESS.md`.

## Etat connu (2026-11-08, complete le 2026-11-15 : voir le plan maitre pour l'etat a jour)

- Contexte d'exploitation (D-011, precise par D-033) : site de Nimba,
  camions semi-remorques loues, 2 chargeuses Caterpillar et 1 pelle ; l'unite
  de facturation (km, heure, tonne, jour, mois, forfait) est choisie engin
  par engin dans le dossier contractuel (D-033), aucune n'est figee. Location et
  decompte entierement parametrables (D-013,
  `docs/SIGTB_2.0_LOCATION_MODEL.md`) : aucun taux ni regle code en dur.
- 0 erreur typecheck depuis le 2026-11-16 (baseline 0, cliquet), 0 erreur lint, 65 avertissements lint, build OK.
- Tests (D-007) : 81 unitaires (dont 27 du moteur de decompte), 40 E2E (API
  simulee : `e2e/api-simulee.ts`), 254 assertions pgTAP (via
  `npm run test:rls:rejeu`).
- Migrations (D-017) : `supabase/migrations` commence par la base de
  reference `20260903000000_base_reference.sql`, generee par
  `scripts/construire-base-reference.sh` (ne pas l'editer, la regenerer) ;
  les 129 migrations Bolt sont archivees dans
  `supabase/migrations_bolt_archive`. Toute migration doit rejouer.
- Deploiement VPS : kit `deploy/vps/`, procedure dans
  `docs/SIGTB_2.0_HEBERGEMENT_VPS.md` section 6.
- Matrice des roles alignee sur l'enum (D-010, D-012, migration
  `20261108100000`), mergee, non deployee.
- CI GitHub Actions impossible (paiement refuse) : CI locale
  `npm run ci:locale` (D-015), resultat dans chaque PR.
- **En production depuis le 2026-11-09** : https://sigtb.infranetgn.com,
  VPS partage (6 autres applications), pile Supabase auto-hebergee
  `/opt/sigtb` (D-016), base neuve sans donnees (D-017), Tranche 0, N4 et
  D-012 deployees. Journal et mise a jour :
  `docs/SIGTB_2.0_HEBERGEMENT_VPS.md` sections 6 et 9. Aucun utilisateur
  tant que le proprietaire n'a pas lance `creer-admin.sh`. Projet
  Supabase Bolt abandonne.
- Demonstration PURGEE le 2026-11-16 (D-076, ordre du proprietaire) : la production ne contient plus que les 3 comptes ; des la premiere saisie reelle, deploiement en production = « toujours demander » (bloc 1, section 4). Historique D-020 : identifiants
  `dec0de00-`, bandeau visible, purge par `deploy/vps/demo/demo.sh apercu` puis `CONFIRMER_PURGE=oui CONFIRMER_RATTACHEES=<n> deploy/vps/demo/demo.sh purger` (D-074)
  obligatoire avant la premiere saisie reelle.
- Cycle voyage (CDC 12, LOT 06) : `trips.etat` ne change que par
  `creer_voyage` / `avancer_voyage` (garde `trips_garde_cycle`), journal
  `trip_events` immuable. Deploye le 2026-11-10 (PR #32).
- Planification v1 (CDC 6, D-023) : `objectifs_production` versionnes,
  ecriture par `definir_objectif` / `annuler_objectif`, droit `planning`.
- Dispatch v1 (CDC 11, D-024) : recommandation deterministe dans
  l'interface, decision par `decider_affectation` (contraintes serveur),
  historisee dans `decisions_dispatch`. Planification et Dispatch deployes
  le 2026-11-10 (#33, #34).
- Contrats et facturation (D-026) : role `contract_manager` (droits de
  demarrage etendus, derogation consciente a la separation des taches),
  dossier contractuel journalise, fiche `societe` (deployes le 2026-11-11).
- Fiches terrain (D-028) : fiches numerotees, saisie par fonctions serveur,
  numero de fiche et ticket de pesee au journal des voyages (deployees le
  2026-11-11).
- Reconciliation et factures (D-029) : facture signee par le role director
  seulement, numerotee a l'emission, avoir pour corriger (deployees le
  2026-11-11). Phase 4 (D-031) : engagements contre realise, rapport de
  performance, recouvrement et relances, comites, tableau de bord du poste
  (deployee le 2026-11-11). Phase 5 (D-032) : controle des factures Neemba
  sur les heures pointees et le tarif du contrat. Phase 6 (paiements) a venir.
- Tests pgTAP : utiliser une periode vide en production (annee 2001) quand
  un resultat agrege depend des donnees presentes (demo D-020).
- Immobilisations (D-022, D-025) : engins loues a Neemba ; la
  declaration et la cloture mettent a jour le statut de l'engin.
- PostGIS absent ; mobile absent. Maquettes Bolt (AI, FleetOptimizer,
  Analytics, anciens ecrans carburant) remplacees par des ecrans sur donnees
  reelles ou supprimees (D-030) ; IoT, ESG, achats encore a revoir.
- Droits par utilisateur (D-036) : au-dessus de la matrice role x module
  (D-012), `droits_utilisateur` prime dans `has_module_view` et
  `has_module_write` (lecture, ecriture, aucun, ou retour au role) ; ecriture
  par `definir_droit_module` (administrateur, journalisee dans
  `journal_droits_modules`) ; ecran dans Parametres -> Utilisateurs.
- Facturation par engin (D-033) : `contrat_tarifs.engin` attache un tarif a un
  engin (priorite : engin, puis categorie, puis tarif unique de la version) ;
  les lignes de facture fournisseur portent quantite et unite facturees ; le
  controle loueur confronte dans l'unite du tarif (heures pointees ou km des
  voyages livres), une unite differente est signalee, jamais estimee.
- Perimetre site (D-038, LOT 02 phase 1) : `site_permis(site)` borne les policies de vehicles, trips (depart ou arrivee), drivers et fiches_terrain ; un profil sans site est global, un profil affecte ne voit que son site ; organisations = referentiel administrateur. Fonctions serveur non encore bornees (phase 2).
- Gardes d'ecriture (D-039) : declencheurs site_permis sur trips (depart ou arrivee), vehicles, drivers, fiches_terrain, pointages_engins et immobilisations ; les fonctions SECURITY DEFINER respectent le perimetre malgre la RLS bypassée.
- Socle MFA (D-040) : garde_aal2 exige aal2 pour droits, rectifications de tickets et signature de facture, seulement si settings mfa_exige = true (desactive tant que les facteurs TOTP ne sont pas inscrits).

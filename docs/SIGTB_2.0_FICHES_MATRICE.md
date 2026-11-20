# SIGTB — matrice fiches terrain / modules metiers

**Origine :** prompt du proprietaire du 2026-11-20 (integration complete des
fiches SIGTB Mobile aux modules metiers). Ce document est l'audit exige avant
toute creation : il mappe chaque fiche demandee a l'existant reellement
deploye (fonctions, tables, decisions, ecrans), fixe la strategie
d'integration et le plan par tranches. References : D-028 (fiches terrain),
D-089 (cycle des fiches), D-100 (file hors ligne web), D-038/D-046
(perimetre site), D-036 (droits par utilisateur), D-045 (TOTP).

## 1. Regles non negociees (reprises du prompt, deja en vigueur)

1. Une fiche est un point de collecte, jamais un stock parallele : sa saisie
   alimente les objets metier par fonctions serveur, en transaction.
2. Aucune double saisie : ce qu'un module sait, la fiche le lit ; ce que la
   fiche collecte, les modules le consomment sans ressaisie.
3. Aucune ecriture directe de table sensible : fonctions SECURITY DEFINER,
   droit de module + perimetre site + journaux (regles deja appliquees).
4. Aucune donnee inventee ni presentee comme validee sans confirmation
   serveur (D-100, CDC 26-32).
5. CBG pese au depot ; Kogon collecte les tickets, ne re-pese pas (D-037,
   D-081, D-095, D-096).
6. Les corrections passent par des operations tracees (rectifications,
   contre-mouvements, avoirs), jamais par suppression silencieuse (D-042).

## 2. Audit de l'existant

### 2.1 Le socle fiches (deploye)

| Element | Etat reel |
|---|---|
| Types de fiches | 3 : `rotations` (FR), `pointage_engins` (FP), `carburant` (FC) — `CHECK` du cycle D-089 |
| Cycle | 13 etats (preparation -> validation/archivage), graphe `transition_fiche_autorisee`, garde de transaction, versionnage, journal `fiches_journal` append-only (D-089) |
| Terrain | Lots, impressions, remises/retours avec agents et confirmation (`fiches_lots`, `fiches_remises`, `fiches_retours`) |
| Saisie | Brouillons, lignes rotation/pointage/carburant, controle automatique (`fiches_ecarts`), correction, validation avec separation saisie/controle (`valider_fiche`, `separation_violee`) |
| Carburant | Ligne FC comptabilisee a la validation : une transaction + un mouvement « distribution » par ligne, cles uniques (D-041 x D-089) |
| Hors ligne web | File D-100 : identifiant client unique, liste blanche des fonctions de saisie, jamais « validee » avant confirmation serveur, conflits `a_arbitrer` |
| Provenance | `fiches_terrain.origine` (contrainte) : web/mobile deja distingues |

### 2.2 Les objets metier deja couverts sans fiche dediee

| Domaine | Existant deploye |
|---|---|
| Kilometres | Releves odometer par voyage, distances validees par periode et engin (D-043) |
| Pesee CBG | Tickets CBG au depot integres au voyage, preuve immuable, rectification motivee, releves CBG periodiques et rapprochement (D-037, D-050, D-081, D-095, D-096) |
| Carburant achat | Livraisons CBG au prix reel, factures controlees (D-034) ; registre des mouvements : stockages, receptions mesurees/acceptees, transferts, distributions, inventaires, contre-mouvements (D-041) |
| Pneus | Cycle de vie individuel, sculptures, positions, interventions (D-052, D-091) |
| Maintenance | Immobilisations imputees (D-025), interventions du loueur et remise en service validee (D-049), controle avant depart (D-063 habilitations, D-054) |
| HSE | Incidents, actions correctives, decisions HSE (D-054) |
| Stocks / achats | Registre magasin (D-044), circuit achat, approbation, reception vers stock (D-053), moyens generaux (fiche de mouvement) |
| Postes | Postes de travail, passation, cloture validee (D-048, D-088) ; justification d'absence de fiche |
| Finance | Reconciliations, factures CBG, controle Neemba, paiements fournisseurs, controle a posteriori (D-029 a D-033, D-055) |
| Pilotage | Centre de pilotage et indicateurs de reference (D-057), notifications et validations (D-056) |
| Pieces jointes | D-083 developpee et testee (branche `lot-23/pieces-jointes`), non fusionnee |

### 2.3 Ce qui manque reellement

1. **L'application mobile** (LOT 13, « Absent » au suivi) : Expo + SQLite,
   collecte terrain hors ligne, synchronisation idempotente.
2. **Le catalogue versionne des fiches** : les regles (champs, validations,
   workflow, profils, pieces) vivent dans le code et les decisions ; aucune
   source unique lisible par le mobile et le web.
3. **La provenance etendue aux evenements metier** : `trip_events` et journaux
   ne portent pas systematiquement la provenance (mobile/web/import) ni
   l'identifiant client d'idempotence.

## 3. Matrice demandee -> existant -> cible

Legende cible : « cycle » = devient un type de fiche du cycle D-089 (collecte
terrain reelle) ; « objet web » = reste une fonction/écran web, pas de fiche
terrain (pas de double saisie a creer) ; « mobile d'abord » = la collecte est
inheremment terrain, l'ecran web reste pour le superviseur.

| Code demande | Existant deploye | Statut | Cible |
|---|---|---|---|
| FR rotations | Fiche complete D-028/D-089 ; alimente voyages, pesees, kilometres, dispatch | Couvert | cycle (existant) + mobile |
| FP pointage engins | Fiche complete ; heures productives, arrets ; alimente decompte heures, maintenance, production | Couvert | cycle (existant) + mobile |
| FC carburant distribution | Fiche complete ; sortie de stock unique a la validation (D-041) | Couvert | cycle (existant) + mobile |
| FKM kilometres | Releves par voyage + validation par periode (D-043) | Couvert sans fiche | objet web ; le releve km vient des FR, pas de fiche dediee |
| FCBG tickets pesee | Tickets integres au voyage + releves periodiques CBG (D-050, D-081) | Couvert sans fiche | objet web (saisie releve CBG) ; mobile : saisie du ticket au depot par l'agent |
| FCB-L livraisons carburant | Livraisons CBG + receptions mesurees/acceptees du registre (D-034, D-041) | Couvert sans fiche | objet web ; reception terrain = future fiche `reception_carburant` si collecte papier revelee |
| FINV inventaires | Inventaires du registre carburant (D-041) ; inventaire biens (D-077) | Couvert sans fiche | objet web ; fiche inventaire a envisager avec le magasinier si besoin terrain |
| FPN pneus | Cycle de vie individuel (D-052, D-091) | Couvert sans fiche | objet web ; fiche d'intervention pneu a envisager avec les mecaniciens |
| FAV controle avant depart | Controle au depart + habilitations (D-063, D-054) | Couvert sans fiche | objet web ; declinaison mobile : checklist chauffeur |
| FM maintenance loueur | Interventions du loueur, remise en service validee (D-049) ; immobilisations (D-025) | Couvert sans fiche | objet web |
| FIMM immobilisations | Immobilisations imputees, heures, blocage dispatch (D-025, D-039) | Couvert sans fiche | objet web ; declenchement terrain via FP (arrets) |
| FRET retours atelier | Arrets et immobilisations couvrent le cas ; maintenance preventive selon D-022 | Couvert sans fiche | objet web |
| FSEC/FACC/FINC/FENV | Incidents, actions correctives, decisions HSE (D-054) ; ESG a corriger | Partiel | objet web ; fiche terrain incident/accident a creer si collecte papier demontree |
| FRE/FST/FTR/FDEM sorties magasin | Registre magasin + circuit achat/reception (D-044, D-053) | Couvert sans fiche | objet web ; fiche de demande/delivery magasin a envisager |
| FCS cloture de poste | Postes, passation, cloture validee (D-048) | Couvert sans fiche | objet web ; declinaison mobile : cloture superviseur |

**Conclusion d'audit :** les quinze familles demandees existent comme objets
metier deployes. Le trou n'est pas fonctionnel web : il est l'absence du
point de collecte mobile et du catalogue unique. Creer des fiches papier pour
des objets deja saisis au bureau serait de la double saisie, interdite par le
prompt lui-meme. Les nouvelles fiches du cycle ne seront creees qu'au cas par
cas, sur preuve d'une collecte terrain reelle (decision dediee a chaque fois).

## 4. Architecture cible

### 4.1 Application mobile (LOT 13)

- **Pile :** Expo (React Native) + SQLite locale, auth Supabase (mot de passe
  + TOTP D-045), aucune dependance UI exotique.
- **Contenu :** mes fiches (FR/FP/FC attribuees a l'agent), lecture des objets
  utiles au terrain (vehicule, cuve, site), saisie hors ligne, pieces jointes
  (photos), cloture de poste, checklist chauffeur.
- **File locale :** reprend les regles D-100 — identifiant client unique,
  liste blanche des fonctions serveur de saisie, jamais « validee » avant
  confirmation serveur, conflits `a_arbitrer` visibles.
- **Synchronisation :** une RPC serveur `synchroniser_fiche` par lot
  idempotent (cle clientId), accuses persistants, reprise apres
  redemarrage, etats de sync independants des etats metier.
- **Droits et perimetre :** verifies cote serveur uniquement (D-012, D-036,
  D-038/D-046) ; le mobile n'est jamais fait confiance.

### 4.2 Catalogue versionne des fiches

- Table serveur `fiches_catalogue` (code, version, objectif, module
  proprietaire, modules consommateurs, profils, champs et regles en JSON
  documentaire, pieces exigees, workflow, regles de sync et d'audit) ;
  lecture par le web et le mobile ; versionnement par decision.
- Le catalogue decrit ; le serveur fait autorite : les regles executees
  restent dans les fonctions, le catalogue ne les remplace pas.

### 4.3 Provenance et evenements

- Etendre `origine`/provenance et l'identifiant client d'idempotence aux
  saisies mobiles (fiches, lignes, pieces) via les fonctions existantes du
  cycle D-089, sans nouvelle table d'evenements : les journaux append-only
  existants (fiches_journal, trip_events, journaux metier) sont la trace.

## 5. Plan par tranches (une PR par tranche, preuves a chaque fois)

| Tranche | Contenu | Critere d'acceptation |
|---|---|---|
| T1 | Idempotence clientId sur le cycle fiches (`synchroniser_saisies_mobile`) — les pieces jointes D-083 sont deja fusionnees et deployees (correction de l'audit initial) | pgTAP 75 : premier envoi ok, rejeu non reexecute, refus metier a_arbitrer, liste blanche, lecture auteur seul (15 assertions) — FAIT |
| T2 | Catalogue serveur versionne + ecran web de lecture | catalogue = source documentaire unique, 1 E2E |
| T3 | Squelette mobile Expo : auth, mes fiches, saisie FR hors ligne, sync idempotente | parcours 1-10 du prompt (creation, hors ligne, redemarrage, sync, apparition web, validation, indicateurs, trace) |
| T4 | Mobile FP + FC (pointages, distributions) puis cloture et checklist | meme parcours par type |
| T5 | Nouvelles fiches terrain justifiees (incident, releve CBG au depot, reception carburant) — une decision chacune | preuve de collecte terrain + matrice a jour |

Chaque tranche : typecheck/lint/build verts (0 erreur tsc atteint),
migrations additives rejouees, rejeu des tests existants par le script de
deploiement, journal et suivi mis a jour, distinction merge/teste/valide/
deploye conservee (CDC 44).

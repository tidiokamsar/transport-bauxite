# SIGTB 2.0 - Plan directeur d'execution

Livrable du LOT 00 (CDC 43). Etat au 2026-11-08. Le suivi detaille reste
dans [SIGTB_2.0_PROGRESS.md](SIGTB_2.0_PROGRESS.md) ; les arbitrages dans
[SIGTB_2.0_DECISIONS.md](SIGTB_2.0_DECISIONS.md).

## 1. Ou en est le mandat

Le mandat est le CDC 2.0 complet : 20 lots (CDC 39), 16 documents
(CDC 43), 35 scenarios de recette (CDC 40) et les 16 criteres de succes
(CDC 45).

| Element | Fait | Reste |
|---|---|---|
| LOT 00 Audit | Etat de reference, matrice, decisions D-001 a D-013, cartographie des donnees, plan d'execution, architecture, securite, deploiement, plan de test (PR #19 mergee) | Re-cartographier sur le schema de production (D-009) |
| LOT 01 Socle | Tranche 0 et Tranche 1 mergees ; Vague A ; Vague D (D-004, PR #17) ; outillage de test (D-007) ; correctif Tranche 0 (D-008, PR #16) ; rejeu des migrations (PR #18) ; durcissement `is_admin` (N4, PR #20) | Deploiement Tranche 0 (P3), CI active (P1), Vagues B, C, E (D-005), typecheck a 0, base de reference (D-009) |
| LOT 02 a 19 | Rien de developpe pour le 2.0 | Tout |
| Documents CDC 43 | 9 sur 16 | EVENT_ENGINE, DISPATCH_ENGINE, FUEL_INTELLIGENCE, MOBILE, DIGITAL_TWIN, AI, API (rediges dans leur LOT) |
| Scenarios AT-001 a AT-035 | 0 couvert par un test de recette | 35 |
| Criteres CDC 45 | 0 sur 16 | 16 |

Rien n'est deploye. Rien n'est valide au sens du CDC 44.

## 2. Prerequis qui dependent du proprietaire

Aucun lot ne peut etre declare termine sans eux. Ils ne peuvent pas etre
leves par l'equipe de developpement.

| # | Prerequis | Debloque | Qui |
|---|---|---|---|
| P1 | CI : GitHub Actions impossible (paiement refuse) ; CI locale `scripts/ci-locale.sh` (D-015), puis CI sur le VPS | Execution de la CI : cliquet, tests unitaires, RLS, E2E | Equipe ; CI VPS apres P2 |
| P2 | Acces SSH par cle au VPS du proprietaire (D-016) : utilisateur et cle autorisee | Installation de la pile Supabase auto-hebergee, deploiement | DARI HOLDING |
| P3 | Deploiement de la Tranche 0 : autorise le 2026-11-08, sur le VPS (D-017) | Fermeture des failles C1 a C4 | Fait (autorisation) ; execution apres P2 |
| P5 | Entrees metier : structure organisation et sites, valeurs des contrats de location (section 5.3), protocoles des traceurs GPS, regles de rapprochement des pesees, validation du cycle a 18 etats | LOT 02, 05, 06, 07, 08, 12 | DARI HOLDING (metier) |
| P6 | Merges des PR ouvertes | Integration sur `main` | Proprietaire du depot |
| P7 | Valider la correspondance role x module (D-012) | Fait le 2026-11-08 (PR #22 mergee) | DARI HOLDING |

## 3. Phases d'execution

### Phase A - Faisable sans intervention (en cours)

| Action | Etat | PR |
|---|---|---|
| Outillage de test D-007 | merge | #15 |
| Correctif migration Tranche 0 (D-008) | merge | #16 |
| Fin de Vague D : Notifications et QuickActions sans donnees inventees | merge | #17 |
| Rejeu des migrations et tests RLS en conteneur (P4) | merge | #18 |
| Livrables LOT 00 : plan directeur, modele de donnees, architecture, securite, deploiement, plan de test | merge | #19 |
| Durcissement `is_admin()` et garde du role (constat N4) | merge | #20 |
| Contexte Nimba (D-011), D-010 et D-012 acceptees, modele de location parametrable (D-013) | PR ouverte | #21 |
| Migration d'alignement `role_permissions` (D-012) et test RLS | merge | #22 |

Limites de la phase A :
- Les Vagues B, C, E (dont C8, injection HTML des exports, et les 37
  erreurs typecheck d'HR et Search) attendent le deploiement de la
  Tranche 0 et une CI active (D-005).
- Aucune migration du LOT 02 et suivants n'est ecrite tant que le schema
  de production est inconnu (CDC 33, D-009).
- Les tests ne s'executent qu'en local tant que P1 n'est pas leve.

### Phase B - Apres P2 : finir le LOT 01 sur le VPS

1. Base de reference construite depuis le depot (D-017) : migrations qui
   rejouent, migration consolidee des tables manquantes, aucune donnee de
   demonstration. Procedure : [SIGTB_2.0_HEBERGEMENT_VPS.md](SIGTB_2.0_HEBERGEMENT_VPS.md).
2. Installation de la pile Supabase auto-hebergee sur le VPS (D-016),
   deploiement de la Tranche 0 (P3 autorise), de `is_admin` (N4) et de la
   matrice des roles (D-012), rejeu des scenarios ; nouvelles cles IoT (N1) ;
   controle de l'appelant de `geofence-monitor` (N3).
3. Vagues B, C, E limitees a la securite, aux donnees fabriquees et aux
   types (D-005) ; typecheck a 0 ; baselines du cliquet a 0.
4. Sans objet : la base du VPS demarre vide (D-017).
5. Critere de sortie du LOT 01 : CI verte, Tranche 0 deployee et verifiee,
   0 erreur typecheck, AT-030 couvert par un test RLS.

### Phase C - LOT 02 a 19, dans l'ordre du CDC 38

Chaque lot suit le CDC 39 : branche `lot-XX/<sujet>`, fichiers, criteres
d'acceptation, tests, revue, PR, documentation, preuve de validation.

| LOT | Branche | Depend de | Criteres d'acceptation (scenarios CDC 40) | Tests principaux | Entrees metier |
|---|---|---|---|---|---|
| 02 Organisation et referentiels | `lot-02/organisation` | 01 | AT-003, AT-030 ; perimetre role x organisation x site ; PostGIS (D-006) | RLS par organisation et site | Structure organisation, sites |
| 03 Planning et shifts | `lot-03/planning` | 02 | AT-004, AT-027 (partie plan), AT-032 | Unitaires calcul des ressources, RLS | Objectifs de production |
| 05 Flotte mixte et sous-traitants | `lot-05/flotte-mixte` | 02 | AT-001, AT-002, AT-003, AT-018, AT-019 ; loueurs, tracteurs et semi-remorques, engins (D-011) | RLS sous-traitant, E2E creation | Contrats de location (section 5) |
| 06 Cycle et Event Engine | `lot-06/cycle-evenements` | 02, 05 | AT-006, AT-007, AT-011, AT-012, AT-016, AT-031, AT-034 | Machine a etats, evenements idempotents | Validation des 18 etats |
| 07 Pesee et tracabilite | `lot-07/pesee` | 06 | AT-008, AT-009, AT-010, AT-013, AT-014, AT-015, AT-031 | Unicite ticket, rapprochement | Tolerances de rapprochement |
| 08 GPS, IoT, cartographie | `lot-08/gps-iot` | 02, 06 | AT-007, AT-012, AT-033, AT-034 | Ingestion, positions perimees | Protocoles traceurs |
| 04 Command Center et KPI | `lot-04/command-center` | 03, 06 | KPI avec periode, source, fiabilite, heure (CDC 8) | Vues SQL KPI | Definitions KPI (CDC 37) |
| 09 Smart Dispatch | `lot-09/dispatch` | 05, 06, 08 | AT-005, AT-018, AT-025 ; recommandation, decision humaine (CDC 11.5) | Contraintes, non-affectation d'un vehicule immobilise | Regles d'affectation |
| 10 Fuel Intelligence | `lot-10/carburant` | 02, 06 | AT-020, AT-021, AT-022 | Reconciliation de cuve | Methode de mesure |
| 11 Maintenance, pneus, stocks | `lot-11/maintenance` | 05 | AT-017, AT-018, AT-019 | Blocage dispatch | - |
| 12 Finance et rentabilite | `lot-12/finance` | 05, 07 | AT-023, AT-024 ; decompte horaire des loueurs (D-011) | Calcul heures facturables x taux, cout par tonne | Taux horaires, regles d'heures facturables |
| 13 Mobile Offline-First | `lot-13/mobile` | 06, 07 | AT-028, AT-029 | Synchronisation, rejeu sans doublon | Terminaux, connectivite |
| 14 Digital Twin et simulation | `lot-14/simulation` | 06, 08, 09 | AT-027, AT-032 ; simulations etiquetees SIMULATED | Reproductibilite | - |
| 15 Road et Safety Intelligence | `lot-15/securite-route` | 08 | AT-026 | - | Referentiel des pistes |
| 16 AI Copilot et Analytics | `lot-16/ia` | 04, 06 | Remplace les maquettes D-004 ; aucune donnee inventee | Evaluation sur donnees reelles | - |
| 17 Portails partenaires | `lot-17/portails` | 02, 05, 12 | AT-003, AT-030 | RLS portail | - |
| 18 Tests integres et pilote | `lot-18/pilote` | tous | AT-001 a AT-034 sur le site pilote | Recette complete | Site pilote Nimba (D-011) |
| 19 Validation de production | `lot-19/production` | 18 | AT-035 ; CDC 42 | Restauration de sauvegarde | Autorisation de mise en production |

Parallelisation possible apres validation des interfaces (CDC 38) : LOT 03
et 05 apres le LOT 02 ; LOT 10 et 11 apres le LOT 06.

## 4. Regles de conduite

- Une PR par unite de travail ; ne jamais confondre merge, teste, valide,
  deploye (CDC 44).
- Toute derogation au CDC ou aux regles du CLAUDE.md passe par une
  decision consignee avant d'etre codee.
- Aucun deploiement ni modification de donnees de production sans
  autorisation explicite.

## 5. Contexte d'exploitation Nimba (D-011)

Declare par DARI HOLDING le 2026-11-08 : site de Nimba (Guinee), camions
semi-remorques loues a l'heure, 2 chargeuses Caterpillar et 1 pelle.

### 5.1 Ecart avec le schema actuel

| Besoin | Existant verifie | LOT |
|---|---|---|
| Proprietaire distinct de l'exploitant (loueur) | `vehicles` sans proprietaire ; `purchase_cost` et `current_value` supposent un actif DARI | 05 |
| Tracteur + semi-remorque | `vehicle_type` = `tipper`, `tanker`, `flatbed` ; table `trailers` (immatriculation, capacite, statut) | 05 |
| Chargeuses et pelle | Aucune table d'engins (CDC 21) | 05, 11 |
| Contrat de location a l'heure | Aucune table de contrats ni de transporteurs | 05, 12 |
| Heures distinctes (CDC 37) : mise a disposition, moteur, productives, attente, panne | Aucune ; derivables des evenements du cycle (LOT 06) et des traceurs (LOT 08) | 06, 08 |
| Decompte horaire du loueur | Aucun | 12 |

### 5.2 Consequences sur le plan

- LOT 05 : categorie de partenaire « loueur » ; contrat de location avec
  unite tarifaire heure (CDC 23) ; couple tracteur / semi-remorque ;
  referentiel d'engins (chargeuses, pelle).
- LOT 06 et 08 : les heures facturables doivent venir d'evenements
  horodates (debut et fin de mise a disposition, attentes, pannes), pas
  d'une saisie libre ; une heure non mesuree reste « sans donnees »
  (regle 1).
- LOT 09 : avec une location horaire, une heure d'attente est payee ; le
  dispatch doit exposer l'utilisation des heures louees. La decision
  reste humaine (CDC 11.5).
- LOT 12 : decompte loueur = heures facturables x taux ; cout par tonne =
  cout de location attribue / tonnes acceptees (CDC 37).
- LOT 18 : pilote a Nimba.
- KPI propose a valider : taux d'utilisation des heures louees = heures
  productives / heures facturees.

### 5.3 Parametrage (D-013)

Reponse de DARI HOLDING du 2026-11-08 : tout peut evoluer, donc tout est
parametrable. Les 8 questions de D-011 deviennent des parametres de
contrat, decrits dans [SIGTB_2.0_LOCATION_MODEL.md](SIGTB_2.0_LOCATION_MODEL.md)
avec les scenarios de test L-01 a L-14. Les valeurs (taux, minimums,
regles d'heures, devise) seront saisies par DARI comme donnees de contrat ;
aucune n'est inventee.

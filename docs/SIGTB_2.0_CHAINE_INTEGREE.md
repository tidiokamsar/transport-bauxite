# SIGTB 2.0 - Chaine integree (lots 2 a 9)

Reference : plan de transformation du 2026-11-20 ; decisions D-120 a D-130.
Cette page decrit ce que le code realise reellement, les sources de chaque
lecture et les limites assumees. Aucune donnee n'est inventee : une absence
reste « sans donnees » avec sa raison.

## Principe

Un seul module proprietaire par domaine, aucune table metier dupliquee. Les
lots 3 a 9 ajoutent des **fonctions de lecture** et des **index**, jamais une
copie de donnees. Toutes les fonctions sont `SECURITY INVOKER`, `STABLE`,
`search_path = ''`, avec `REVOKE EXECUTE ... FROM PUBLIC, anon` puis
`GRANT EXECUTE ... TO authenticated`. La RLS et les droits de module
s'appliquent au lecteur.

| Lot | Fonction | Source proprietaire | Droit exige |
|---|---|---|---|
| 3 | `dossier_rotation(uuid)` | `trips`, `trip_events`, `releves_compteur`, `incidents`, `tickets_pesee_cbg`, `rapprochements_pesee`, `fiches_terrain`, `verifications_evenements_voyage`, `pieces_jointes` | `trips` (sinon NULL) |
| 4 | `dossier_pesee(uuid)` | `tickets_pesee_cbg`, `tare_references`/tare figee, `rapprochements_pesee`, `anomalies_pesee`, `ecarts_releve_cbg`, `rectifications_tickets_pesee_cbg`, `tolerance_pesee_applicable` | `trips` (sinon NULL) |
| 5 | `consolidation_production(date, date, uuid)` | `trips` (une ligne par voyage) | `trips` (sinon aucune ligne) |
| 6 | `situation_maintenance(date, date, uuid)` | `vehicles`, `immobilisations`, `interventions_loueur`, `incidents`, `releves_compteur`, `mouvements_carburant`, `costs`, `trips` | `maintenance` ou `vehicles` ; carburant, couts et voyages masques separement |
| 7 | `dossier_financier(uuid)` | `factures`, `contrats`, `contrat_versions`, `contrat_clauses`, `calculs_clauses`, `reconciliations`, `facture_lignes`, `pieces_jointes`, `encaissements`, `relances`, `factures_journal` | `invoices` ou `contracts` (sinon NULL) |
| 7 | `etat_creances(date, date, uuid)` | `factures` emises, `encaissements`, avoirs, `relances` | `invoices` ou `contracts` |
| 7 | `etat_paiements_fournisseur(date, date)` | `paiements_fournisseur`, `factures_fournisseur`, `purchase_orders` | `invoices`, `contracts` ou `purchases` |
| 8 | `command_center(date, date, uuid)` | `indicateurs_pilotage` + compteurs operationnels ci-dessous | selon le domaine, chaque bloc masque separement |
| 8 | `tracabilite_indicateur(code, date, date, uuid)` | voyages, objectifs, anomalies, carburant, incidents, controles, interventions, bons, paiements, restes a payer | selon le domaine, RLS |
| 8 | `indicateurs_de_rotation(uuid)` | `trips`, `mouvements_carburant`, `incidents` | `trips` |

Index du lot 9 : `20261128150000_lot9_index_performance.sql`, tous
`IF NOT EXISTS`, additifs.

## Regles de calcul

- **Dossier de rotation** : le kilometrage n'est rendu que s'il est mesure
  (releves compteur du voyage, sinon km de debut et de fin saisis). Sinon la
  valeur est NULL, la source dit pourquoi et `nb_releves` reste un compte
  reel. Aucune position GPS fabriquee.
- **Dossier de pesee** : brut et net CBG sont les valeurs originales du
  ticket, jamais reecrites. Le net SIGTB vaut `brut CBG - tare applicable`.
  L'ecart et la tolerance viennent de `tolerance_pesee_applicable`. Statut :
  `dans_tolerance`, `ecart`, `tare_absente`, `net_cbg_absent` ou
  `sans_ticket`. En cas d'ecart, le net CBG fait foi (D-096).
- **Consolidation** : chaque voyage n'est compte qu'une fois par dimension
  (camion, chauffeur, contrat, destination, jour, shift, site, total).
  Provisoire = livre non encore valide ; valide = accepte sur un voyage
  accepte ou cloture. Un voyage sans poids alimente `voyages_sans_poids` et
  ne fabrique aucun tonnage.
- **Maintenance** : couts regroupes par devise dans un jsonb, jamais
  additionnes entre devises ; un cout annule n'est pas compte ; L/km et L/t
  seulement si le denominateur existe et est non nul.
- **Finance** : solde = TTC - encaissements - avoirs non annules ; NULL si
  le TTC manque. Un avoir diminue la creance, il n'ecrase jamais la facture
  d'origine. Une facture sans echeance n'est jamais comptee en retard.
  Aucune conversion de devise.
- **Command Center** : les KPI de `indicateurs_pilotage` gardent leur
  formule, source, periode et fiabilite. Les compteurs ajoutes disent s'ils
  sont « periode » ou « instantane ». Un domaine non lisible ressort en
  `sans_donnees` avec « Non visible avec vos droits de lecture ».
- **Tracabilite** : `tracabilite_indicateur` descend de l'indicateur vers
  les operations qui le composent ; `indicateurs_de_rotation` remonte d'une
  rotation vers ses contributions. Un code inconnu renvoie une ligne
  d'information, jamais une liste vide presentee comme un resultat.

## Ecrans

- `src/components/Pilotage/CentrePilotageView.tsx` : chaque indicateur a un
  bouton « Detail et tracabilite » (`TraceabiliteIndicateur`, colonnes camion,
  chauffeur, shift, ticket, tare, pieces, validation) ; sous les KPI,
  `ChaineIntegree` propose les onglets Situation, Consolidation production,
  Maintenance et carburant, Creances clients et Clotures (`etat_clotures`).
- `src/components/Operations/DetailVoyage.tsx` : onglet « Dossier integre »
  (`DossierRotation`) avec kilometrage mesure, controle de pesee CBG,
  contribution aux indicateurs et comptage des pieces, fiches, incidents et
  evenements.
- `src/components/Vehicles/DetailVehicule.tsx` : onglet « Tare de reference »
  (`TareEngin`) : proposition par le module flotte, validation par
  l'administrateur KOGON avec motif, retrait motive, journal des tares.
- `src/components/Facturation/DetailFacture.tsx` : onglet « Dossier
  financier » (`DossierFinancier`).
- `src/components/Paiements/PaiementsView.tsx` : situation de la periode
  (`etat_paiements_fournisseur`).
- `src/components/Fiches/TicketsCbgView.tsx` : espace « E. Dossier de pesee »
  (`DossierPeseeVoyage`).

## Limites assumees

- Les lots 3 a 9 lisent l'existant ; ils ne remplacent aucun ecran metier
  proprietaire (Dispatch, Pesee CBG, Fiches, Contrats, Factures).
- Les couts restent par devise ; aucun taux de change n'est applique.
- Un domaine sans donnee ou sans droit n'est jamais presente comme nul.
- Aucune nouvelle table, aucune migration destructive, aucune ligne reecrite.
- D-097 maintenue : pas de test nouveau ; typecheck, lint, build, migrations
  additives, sauvegarde verifiee, rejeu des tests existants et controles
  apres deploiement restent obligatoires.

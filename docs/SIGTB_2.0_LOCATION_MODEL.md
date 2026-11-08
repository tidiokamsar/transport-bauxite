# SIGTB 2.0 - Modele de location et de decompte horaire

Specification de conception (D-011, D-013). Etat au 2026-11-08 : moteur de
calcul v1 developpe et teste (section 7), rien d'autre n'est developpe ni
deploye. Concerne les LOT 05 (flotte, partenaires,
contrats), 06 (evenements), 08 (sources GPS), 12 (decomptes), 13 (pointage
mobile) et 17 (portail partenaire).

## 1. Principes

1. **Tout est parametrable.** Aucun taux, minimum, coefficient, regle
   d'heure ni categorie n'est code en dur. Ce sont des donnees de contrat,
   saisies et validees par DARI HOLDING.
2. **Aucune valeur par defaut inventee** (regle 1 du CLAUDE.md). Si un
   parametre obligatoire manque, le decompte est « non calculable » et
   liste les parametres absents. Aucun montant n'est produit dans ce cas.
3. **Versionnement.** Chaque modification d'un contrat ou d'un tarif cree
   une nouvelle version avec une date d'effet. Un decompte reference les
   versions qu'il a utilisees. Rien n'est reecrit (CDC 31).
4. **Le systeme calcule, l'humain valide** (CDC 11.5). Cycle d'un
   decompte : brouillon, valide, conteste, annule par avoir. Un decompte
   valide n'est jamais recalcule en place.
5. **Tracabilite.** Chaque heure facturee remonte a des segments
   horodates, avec leur source et leur fiabilite (CDC 8 et 32).

## 2. Parametres

Les colonnes « Valeurs possibles » sont des options du modele, pas des
valeurs retenues. Le choix se fait contrat par contrat.

### 2.1 Sens du contrat (question 1)

| Parametre | Valeurs possibles |
|---|---|
| Sens | `preneur` : DARI loue le materiel d'un tiers, c'est un cout. `bailleur` : DARI loue son materiel a un client, c'est un revenu. `interne` : materiel DARI affecte a ses propres operations, avec un cout horaire de reference optionnel. |
| Contrepartie | Partenaire du referentiel (loueur, client, sous-traitant). Un meme partenaire peut tenir plusieurs roles. |

Contrainte : un materiel ne peut pas etre couvert par deux contrats actifs
de meme sens sur la meme periode.

### 2.2 Heures facturables (question 2)

| Parametre | Valeurs possibles |
|---|---|
| Base horaire | `presence` (mise a disposition), `moteur`, `productive`, `forfait` (jour, semaine, mois) |
| Categories de temps | Referentiel extensible, par exemple productif, attente au chargement, attente au dechargement, file d'attente, deplacement a vide, panne imputable au loueur, maintenance planifiee, arret imputable a DARI ou au client, arret meteo, arret securite |
| Coefficient par categorie | 0 a 100 % du taux, par contrat. 0 % = non facture |
| Minimum garanti | Nombre d'heures par jour, par shift, par semaine ou par mois ; ou aucun |
| Condition du minimum | Applique toujours, ou seulement si le materiel est reste disponible (sans panne imputable au loueur) |
| Plafond | Heures maximales facturables par jour ou par periode ; ou aucun |
| Arrondi | Pas (en minutes), mode (inferieur, superieur, plus proche), niveau (segment, jour, periode) |
| Majorations | Coefficient par plage : nuit, dimanche, jour ferie (calendrier parametrable par site) |
| Franchise | Minutes non facturees par jour ou par evenement ; ou aucune |
| Periode de decompte | Jour, semaine, quinzaine, mois |

### 2.3 Preuve des heures (question 3)

| Parametre | Valeurs possibles |
|---|---|
| Sources | Feuille de pointage signee, releves d'horametre (debut et fin), GPS et telemetrie (contact moteur, mouvement), evenements du cycle de voyage (LOT 06), declaration sur mobile (LOT 13) |
| Source de reference | Une source par contrat |
| Sources de controle | Zero ou plusieurs |
| Tolerance d'ecart | En minutes ou en pourcentage |
| Si l'ecart depasse la tolerance | Retenir la reference, retenir la valeur la plus basse, ou bloquer la ligne pour validation humaine |

Une heure sans aucune source est « sans donnees ». Elle n'est jamais
estimee pour etre facturee.

### 2.4 Chauffeur, carburant et charges (question 4)

| Parametre | Valeurs possibles |
|---|---|
| Chauffeur ou operateur | Inclus dans le taux, fourni par DARI, fourni par le client |
| Carburant | Inclus dans le taux ; fourni par DARI et deduit (quantite mesuree x prix de reference versionne) ; fourni par DARI sans deduction ; refacture |
| Entretien, pneus, assurance | A la charge du loueur, de DARI ou du client, par poste |
| Mobilisation et demobilisation | Forfait, au temps, ou aucun |

### 2.5 Materiel facture (questions 5 et 6)

| Parametre | Valeurs possibles |
|---|---|
| Categorie de materiel | Referentiel extensible : tracteur, semi-remorque, camion porteur, chargeuse, pelle, bulldozer, autre. Pas d'enum fige |
| Propriete | DARI ou tiers, distincte de l'exploitation (CDC 9.3) |
| Unite facturee | Tracteur seul, ensemble attele, remorque seule, engin |
| Attelage | Evenement horodate (tracteur, remorque, debut, fin). Le nombre de tracteurs et de remorques vient du referentiel, sans limite codee |

Le meme modele de contrat s'applique aux camions, aux chargeuses et aux
pelles.

### 2.6 Sites et pesee (question 7)

| Parametre | Valeurs possibles |
|---|---|
| Perimetre du contrat | Un ou plusieurs sites, corridors, points de chargement et de destination |
| Fuseau horaire | Par site ; sert au decoupage par jour et aux majorations |
| Pont-bascule | Present ou absent, par point |
| Tonnage sans pont-bascule | Estimation parametree : capacite nominale x taux de remplissage, ou nombre de godets x volume x densite. Marquee « estimee » et jamais confondue avec un poids pese (CDC 13, 32) |

Nimba est le premier site. Les autres sites s'ajoutent par saisie de
donnees, sans developpement.

### 2.7 Devise et tarifs (question 8)

| Parametre | Valeurs possibles |
|---|---|
| Devise du contrat | Obligatoire, par contrat (GNF, USD ou autre) |
| Taux horaire | Par categorie de materiel, par categorie de temps et par plage, versionne avec date d'effet |
| Conversion | Source et date du taux de change parametrees ; le taux utilise est enregistre sur le decompte. La rentabilite est consolidee en GNF (devise principale du CDC) |
| Retenues, penalites, bonus | Pourcentage ou montant, avec un seuil (par exemple une indisponibilite au-dela de N heures) |
| Conditions de paiement | Delai, avance, retenue de garantie |

## 3. Calcul d'un decompte

Pour un contrat, une version et une periode :

1. Recueillir les segments horodates du materiel, avec leur categorie de
   temps et leur source.
2. Rapprocher la source de reference et les sources de controle ; noter
   les ecarts et appliquer la regle d'ecart.
3. Decouper aux limites de jour (fuseau du site) et aux limites des plages
   de majoration.
4. Appliquer franchise, coefficient de categorie, arrondi et plafond.
5. Appliquer le minimum garanti si sa condition est remplie.
6. Valoriser au taux de la version en vigueur a la date du segment ;
   appliquer les majorations, la deduction carburant, les retenues et les
   penalites.
7. Produire des lignes tracees (segment, heures, taux, montant) et un
   total, au statut brouillon.

Le calcul est une fonction pure des segments et des parametres : deux
executions sur les memes entrees donnent le meme resultat. Il s'execute
cote serveur (CDC 35, operations sensibles).

## 4. Scenarios a couvrir par les tests

| # | Scenario |
|---|---|
| L-01 | Camion loue, base presence, attente facturee a 100 %, panne a 0 % |
| L-02 | Meme camion, minimum de N heures par jour, journee courte sans panne : minimum applique |
| L-03 | Journee courte a cause d'une panne imputable au loueur : minimum non applique si la condition l'exige |
| L-04 | Base heure moteur, horametre en reference, GPS en controle, ecart hors tolerance : ligne bloquee pour validation |
| L-05 | Segment a cheval sur minuit : decoupe sur deux jours |
| L-06 | Majoration de nuit sur une partie du segment |
| L-07 | Carburant fourni par DARI et deduit au prix de reference |
| L-08 | Changement de taux en cours de periode : chaque segment valorise a sa version |
| L-09 | Tracteur et remorque factures separement, attelage change en cours de journee |
| L-10 | Chargeuse en contrat `interne`, cout horaire de reference |
| L-11 | DARI bailleur : meme calcul, sens revenu |
| L-12 | Parametre obligatoire absent : decompte non calculable, aucun montant |
| L-13 | Contrat en USD, rentabilite convertie en GNF au taux enregistre |
| L-14 | Site sans pont-bascule : tonnage estime, marque « estimee » dans le cout par tonne |

## 5. Rattachement aux LOT

| LOT | Apport |
|---|---|
| 02 | Organisations, sites, fuseaux, calendriers de jours feries |
| 05 | Referentiel des partenaires, categories de materiel, materiels, attelages, contrats et versions |
| 06 | Segments de temps derives des evenements du cycle |
| 07 | Tonnage pese ou estime, avec sa fiabilite |
| 08 | Contact moteur et mouvement comme source de controle |
| 12 | Moteur de decompte, validation, avoirs, rentabilite et cout par tonne |
| 13 | Pointage et releves d'horametre sur mobile, hors ligne |
| 17 | Consultation des decomptes par le loueur ou le client |

## 6. Modele de donnees indicatif

A creer apres D-009 (schema de production connu) et le LOT 02, par des
migrations nouvelles, avec RLS par organisation et site. Les noms sont
indicatifs.

| Table | Role |
|---|---|
| `partners` | Loueurs, clients, sous-traitants |
| `equipment_categories` | Referentiel extensible des categories de materiel |
| `equipment` | Materiel (camion, tracteur, remorque, engin), proprietaire, site |
| `couplings` | Attelages tracteur et remorque horodates |
| `rental_contracts` | Contrat : sens, contrepartie, perimetre, devise |
| `rental_contract_versions` | Parametres de la section 2, date d'effet, statut de validation |
| `rental_rates` | Taux par categorie de materiel, categorie de temps et plage |
| `time_categories` | Referentiel des categories de temps |
| `time_segments` | Segments horodates par materiel, categorie, source, fiabilite |
| `hour_meter_readings` | Releves d'horametre |
| `settlements`, `settlement_lines` | Decomptes et lignes tracees |
| `exchange_rates` | Taux de change avec source et date |

Avant toute creation, verifier dans le schema de production qu'aucune
table equivalente n'existe (CDC 33). `vehicles` et `trailers` existent :
leur reprise dans `equipment` est a trancher au LOT 05.

## 7. Moteur de calcul v1

`src/domain/location/decompte.ts`, fonction `calculerDecompte(parametres,
segments, periode)`. Fonction pure, sans dependance, destinee a etre
partagee avec une fonction serveur. Elle n'est branchee a aucun ecran ni a
aucune table : les segments viendront des LOT 05, 06, 08 et 13.

Couvert et teste (`decompte.test.ts`, 27 tests) : L-01 a L-06, L-08, L-10,
L-11, L-12 ; validation des parametres, chevauchements, sources et
categories inconnues, jour sans tarif, fuseau du site, decoupage par
periode, decimales de la devise.

Limites de la v1, a lever dans les LOT concernes :

| Limite | LOT |
|---|---|
| Un taux horaire par version ; les ecarts par categorie de temps et par plage passent par les pourcentages | 12 |
| Minimum, plafond et franchise au jour seulement (pas par shift, semaine ou mois) | 12 |
| Ajustements (franchise, arrondi, plafond, minimum) valorises au taux de base, sans majoration | 12 |
| Regle d'ecart « retenir la valeur la plus basse » non prise en charge | 12 |
| Majorations par plage horaire seulement : pas de dimanche ni de jour ferie | 02, 12 |
| Carburant (L-07), attelage (L-09), conversion de devise (L-13), tonnage estime (L-14), retenues, penalites, mobilisation : non traites | 05, 07, 12 |

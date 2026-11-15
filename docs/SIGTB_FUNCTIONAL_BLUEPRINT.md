# SIGTB : blueprint fonctionnel

**État au 2026-11-15.** Référence fonctionnelle : [CDC 2.0](SIGTB_2.0_CAHIER_DES_CHARGES.md). Ce document traduit le standard du mandat global en règles d'application par module et suit les enchaînements entre modules. L'état fonctionnalité par fonctionnalité est dans la [matrice de couverture](SIGTB_MODULE_COVERAGE_MATRIX.md).

## 1. Parties et règles non négociables

- **KOGON MINING SARL** exploite ; **Neemba Guinée** loue les équipements et porte la maintenance prévue au contrat ; **CBG** est client, fournisseur de carburant et opérateur de la pesée au dépôt. Le produit s'appelle SIGTB, sans marque client.
- Équipements KOGON et équipements loués distingués ; obligations de Neemba jamais converties en maintenance interne.
- Camions facturés au kilomètre : distances de référence, déclarée, mesurée, validée et facturable distinguées, jamais inventées. Chargeuses et pelles : heures présence, fonctionnement, productives, arrêt, maintenance, facturables distinguées.
- CBG pèse ; KOGON collecte, rapproche et traite les anomalies, sans seconde pesée (D-037). Corrections avec anciennes valeurs et justificatif.
- Carburant : quantité reçue, acceptée, prix documenté, distributions, inventaires ; stock = registre de mouvements (D-041).
- Pneumatiques à la charge de KOGON, suivis individuellement.
- Fonctionnement sans GPS ni capteur au démarrage ; une position ancienne n'est jamais affichée comme en direct.
- Donnée manquante : signalée, calcul contractuel empêché ; prévision, déclaration, mesure et validation distinguées.

## 2. Standard d'un module, adapté au domaine

| Bloc | Application dans SIGTB |
|---|---|
| Tableau de bord | Indicateurs du domaine avec période, source et fraîcheur ; éléments en attente et en retard |
| Liste | Recherche, filtres, tri, export CSV (`lib/exports.ts`), impression quand le document a une valeur papier (fiches, factures, lettres) |
| Création, consultation, modification | Référentiels : écriture directe sous RLS (module + site) ; objets à cycle de vie : fonction serveur par transition |
| Suppression | Jamais pour un enregistrement métier : archivage (`actif`), annulation motivée, avoir, contre-mouvement |
| Fiche détaillée | Statut, relations, historique (journal du domaine), actions autorisées selon droit et état |
| Formulaires | Champs obligatoires signalés (*), contrôle client et serveur, bouton désactivé pendant l'envoi, erreur serveur affichée telle quelle |
| Actions métier | Valider, rejeter (motif), annuler (motif), clôturer : séparation saisie / décision quand l'enjeu est financier ou de stock |
| Documents | Après le lot GED : pièces jointes rattachées à l'objet, versions |
| Historique et audit | Auteur, date, ancienne et nouvelle valeur, motif |
| Notifications | Après le lot 17 : générées par les fonctions serveur |
| Paramétrage | Référentiels et réglages (`settings`) lus par le serveur ; aucune règle tarifaire codée en dur (D-013) |

Un bloc sans sens métier pour un domaine n'est pas créé.

## 3. Enchaînements entre modules

| Enchaînement | État | Mécanisme ou écart |
|---|---|---|
| Planning vers dispatch | Opérationnel | Objectifs D-023 lus par la recommandation D-024 |
| Dispatch vers rotation | Opérationnel | `decider_affectation` puis `creer_voyage` / cycle à 18 états |
| Rotation vers kilomètres | Opérationnel (D-043) | Relevés du voyage, distance validée, contrôle des factures au km sur distance facturable |
| Rotation vers ticket CBG | Opérationnel | Ticket source rattaché au voyage (D-037) |
| Ticket validé vers rapprochement | Opérationnel | Réconciliation mensuelle D-029 ; relevé CBG rapproché ticket par ticket (D-050) |
| Rapprochement clôturé vers facturation | Opérationnel | Facture CBG préparée depuis la réconciliation close, signée par le DG |
| Immobilisation vers disponibilité flotte | Opérationnel | D-025, blocage au dispatch |
| Intervention Neemba vers historique équipement | Opérationnel (D-049) | Intervention rattachée à l'immobilisation ; remise en service validée clôt l'immobilisation |
| Distribution carburant vers consommation | Opérationnel | Fiche carburant -> `fuel_transactions` -> `consommation_carburant` ; vers stock : D-041 |
| Montage de pneu vers historique du pneu | Opérationnel (D-052) | Journal `pneus_operations`, état recalculé, km et coût au km dans `v_pneus` |
| Commande réceptionnée vers stock | Manquant | Lot 13 après lot 4 |
| Facture validée vers créance | Opérationnel | `v_creances` (D-031) |
| Paiement validé vers situation financière | Manquant | Lot 16 |
| Données validées vers tableaux de bord | Partiel | KPI calculés par écran ; vues de référence : lot 19 |

## 4. Rôles

Rôles de l'enum : `admin`, `director`, `operations_manager`, `fleet_manager`, `maintenance_chief`, `logistician`, `accountant`, `driver`, `contract_manager` (D-026). Droits par module dans `role_permissions` (D-012), dérogations par utilisateur (D-036), périmètre site (D-038). Signature des factures CBG : `director` seulement (D-029).

# Module 08 : Fleet Management (registre des engins)

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : dernière release consignée 3bbfded
(`docs/SIGTB_2.0_HEBERGEMENT_VPS.md`, section 11), démonstration purgée
(D-076), aucune saisie réelle encore. Aucun élément n'est UTILISABLE ni
VALIDÉ : pas de donnée réelle, pas de PV ; le guide de rôle existe
(`docs/guides/guide-flotte-maintenance.md`, section 1).

## 1. Objectifs et périmètre

Tenir le registre unique des engins (camions semi-remorques bennes,
chargeuses, pelle, véhicules légers) qui alimente toute la chaîne J1 et J2 :
planification et dispatch (disponibilité), voyages (capacité utile),
kilométrage (compteurs), contrôle des factures Neemba (engin du contrat,
tarif par engin), carburant, pneus et coûts par engin.

Décisions de référence : D-011 et D-013 (flotte d'un tiers, tout
paramétrable), D-022 et D-027 (engins loués à Neemba, maintenance par le
loueur, pneus et carburant à la charge de Kogon), D-025 (immobilisation qui
fixe le statut technique), D-033 (unité de facturation choisie engin par
engin dans le contrat), D-038, D-039, D-046, D-075 (périmètre site), D-042
(pas de suppression physique), D-043 (relevés de compteur, `current_km`
n'est pas une mesure), D-062 (propriété, statut administratif, journal,
fiche consolidée), D-077.

Entrées : sites (module 03), contrats de location (modules 10 et 19),
relevés de compteur (module 07, `releves_compteur`), immobilisations et
interventions (module 11), pneus (module 12), pleins (module 13),
contrôles avant départ (module 22). Sorties : `vehicles` et `v_vehicules`
lus par les modules 04, 05, 06, 07, 10, 11, 12, 13, 20 et 21.

Point à trancher par le propriétaire (déjà consigné D-062) : la réforme et
la restitution au loueur ont-elles le même sens ? Tant que non tranché, un
engin loué restitué se réforme avec motif.

## 2. Sous-modules

1. Registre et fiche technique (identification, capacité, site).
2. Propriété et contrat (Kogon, loué, sous-traitant ; loueur ; contrat de
   location rattaché).
3. Statut administratif (suspension, remise en service, réforme) et statut
   opérationnel dérivé.
4. Documents réglementaires (assurance, carte grise, visite technique,
   autorisations) et alertes d'expiration.
5. Compteurs (kilomètres, heures moteur) : lecture des relevés D-043 et des
   pointages FP D-028.
6. Fiche consolidée (immobilisations, interventions, pneus, pleins,
   contrôles, documents, coût carburant).
7. Coûts et performances par engin (lecture des modules 11, 12, 13, 20, 21).

## 3. Menus et sous-menus

| Entrée (`src/components/Layout/menu.ts`) | Vue (`src/App.tsx`) | Droit lu (`src/contexts/AuthContext.tsx:156`) |
|---|---|---|
| Flotte > Véhicules et engins (`vehicles`) | `Vehicles/VehiclesView` | module `vehicles` (lecture) |
| Flotte > Documents (`documents`) | `Documents/VehicleDocumentsView` | module `vehicles` |
| Reporting > Santé de la flotte (`fleet-health`) | `Analyses/AnalysesFlotte` `SanteFlotteView` | module `reports` |
| Reporting > Coût direct par tonne (`tco-analysis`) | `Analyses/AnalysesFlotte` `CoutTonneView` | module `reports` |
| Exploitation > Kilométrage (`kilometrage`, module 07) | `Trips/KilometrageView` | module `trips` |

Les rôles qui voient l'entrée sont ceux qui ont `can_view` sur le module
dans `role_permissions` (D-012), ou un droit utilisateur `droits_utilisateur`
(D-036) ; l'administrateur voit tout.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Registre des engins (liste, recherche immatriculation et modèle, filtres statut et propriété, compteurs par statut, export CSV et PDF, heure de fraîcheur) | `v_vehicules` | DÉPLOYÉ | `src/components/Vehicles/VehiclesView.tsx:33-60`, migration `20261118210000_flotte.sql:381`, release 24dd140 |
| Création et modification d'un engin (champs descriptifs) | `vehicles` | DÉPLOYÉ (défaut mineur, section finale) | `src/components/Vehicles/VehicleModal.tsx:36-50` ; colonnes accordées `20261118210000_flotte.sql:77-83` |
| Fiche engin (propriété, contrat, statut, immobilisations, pleins, contrôles, journal) | `v_fiche_vehicule`, `journal_flotte` | DÉPLOYÉ | `src/components/Vehicles/FicheVehicule.tsx:59-146` |
| Documents des engins (liste, alertes à renouveler, archivage) | `vehicle_documents`, `v_documents_vehicule_a_renouveler` | DÉPLOYÉ | `src/components/Documents/VehicleDocumentsView.tsx:33-56` |
| Saisie d'un document (métadonnées, sans fichier) | `vehicle_documents` | PARTIEL (pas de pièce jointe : aucun stockage) | `src/components/Documents/VehicleDocumentModal.tsx:46-56` |
| Santé de la flotte | `vehicles`, `fiabilite_engins` | PARTIEL (affiche `current_km`, non mesuré ; libellé de statut faux pour un engin suspendu ou réformé) | `src/components/Analyses/AnalysesFlotte.tsx:156-206` |
| Coût direct par tonne par engin | `consommation_carburant`, `maintenance_orders`, `tires` | PARTIEL (coût absent compté 0, pneus imputés à l'engin monté au jour de lecture, location Neemba et immobilisations hors calcul) | `src/components/Analyses/AnalysesFlotte.tsx:221-260` |
| Relevé de compteur hors voyage (moment « autre ») | `releves_compteur` | MANQUANT (seuls les relevés de voyage ont un écran, module 07) | matrice, ligne « Compteurs kilométriques » |
| Heures moteur par engin (chargeuses, pelle) | `pointages_engins` | PARTIEL (saisies par les fiches FP du module 07, pas de vue par engin dans la flotte) | `20261111090000_fiches_terrain.sql:153` |
| Import en masse du registre (fichier) | - | MANQUANT | - |
| Tableau de bord de la flotte (disponibilité, documents, coûts) | - | MANQUANT (compteurs simples dans le registre ; indicateurs flotte dans le Centre de pilotage, module 01) | `indicateurs_pilotage` (D-057) |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Nombre d'engins par statut opérationnel (disponible, en mission, en maintenance, immobilisé, suspendu, réformé) | `v_vehicules.statut_operationnel` | instant, heure affichée | DÉPLOYÉ (`VehiclesView.tsx:48`) |
| Documents expirés ou expirant sous 30 jours | `v_documents_vehicule_a_renouveler` | J à J+30 | DÉPLOYÉ |
| Disponibilité par engin | `fiabilite_engins` (immobilisations) | mois choisi | DÉPLOYÉ (module 11) |
| Coût carburant de l'engin (pleins au prix connu seulement) | `v_fiche_vehicule` | cumul | DÉPLOYÉ |
| Coût complet par engin (location, carburant, pneus, immobilisations valorisées) | - | mois | MANQUANT |
| Taux d'utilisation (heures productives / heures disponibles) | `pointages_engins`, `durees_voyages` | mois | MANQUANT |
| Engins sans propriété renseignée ou sans contrat (qualité du registre) | `v_vehicules.propriete IS NULL` | instant | PARTIEL (filtre « non renseignée » dans la liste, pas de widget) |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver / restaurer | Supprimer (brouillon) | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Engin (`vehicles`) | DÉPLOYÉ (insert direct, colonnes descriptives) | DÉPLOYÉ | DÉPLOYÉ (update direct, colonnes descriptives, non journalisé) | MANQUANT | DÉPLOYÉ (réforme définitive par `reformer_vehicule` ; suspension / remise en service) | sans objet (DELETE retiré, D-042) | PARTIEL (modification descriptive sans motif ni journal) |
| Propriété et contrat | DÉPLOYÉ (`definir_propriete_vehicule`) | DÉPLOYÉ | DÉPLOYÉ (motif obligatoire si déjà renseignée) | sans objet | sans objet | sans objet | DÉPLOYÉ (journal `journal_flotte`) |
| Document d'engin (`vehicle_documents`) | DÉPLOYÉ | DÉPLOYÉ | DÉPLOYÉ (update direct, non journalisé) | MANQUANT | DÉPLOYÉ (statut `archived`) | sans objet | PARTIEL |
| Relevé de compteur hors voyage | MANQUANT | DÉPLOYÉ (`v_releves_compteur`, module 07) | sans objet (correction par nouveau relevé motivé, D-043) | sans objet | sans objet | sans objet | DÉPLOYÉ côté serveur (module 07) |

## 7. Modals et drawers

| Modal | État | Preuve |
|---|---|---|
| Création / édition d'engin | DÉPLOYÉ | `VehicleModal.tsx` |
| Fiche engin (drawer plein écran) avec propriété, statut, historique | DÉPLOYÉ | `FicheVehicule.tsx` |
| Confirmation de suspension, remise en service, réforme (motif) | PARTIEL (`window.prompt`, pas de dialogue dédié ni rappel des conséquences) | `FicheVehicule.tsx:87-91` |
| Saisie de document | DÉPLOYÉ | `VehicleDocumentModal.tsx` |
| Pièces jointes (scan carte grise, assurance) | MANQUANT (aucun stockage, constat transverse 4 de la matrice) | - |
| Import du registre (ImportWizard) | MANQUANT | - |
| Export avec choix des colonnes (ExportModal) | PARTIEL (CSV et impression à colonnes fixes) | `VehiclesView.tsx:52-58`, `src/lib/exports.ts` |
| Historique comparé (HistoryDrawer) | PARTIEL (journal des actions administratives seulement) | `FicheVehicule.tsx:62` |

## 8. Champs des formulaires

**Engin** (`VehicleModal`) :

| Champ | Type | Obligatoire | Validation client | Validation serveur |
|---|---|---|---|---|
| Immatriculation | texte | oui | non vide | NOT NULL, UNIQUE `vehicles_registration_key` (base de référence l. 6384) ; doublon signalé par le message brut du serveur |
| Marque et modèle | texte | oui | non vide | NOT NULL |
| Type | liste (benne, plateau, citerne, chargeuse, pelle, pick-up, bus, dépanneuse) | oui | choisi | CHECK `vehicles_vehicle_type_check` (base de référence, l. 4799) |
| Capacité (t) | décimal | oui | nombre >= 0 | NOT NULL |
| Année | entier | non | chiffres | - |
| Numéro de châssis | texte | non | - | - |
| Site d'affectation | liste des sites | non (« engin global ») | - | RLS `site_permis(site_id)` : un profil borné à un site ne peut pas créer un engin global |
| Expiration assurance, expiration visite technique | date | non | - | - |

Cible à ajouter : capacité utile autorisée distincte de la capacité
nominale (CDC 9.1), heures moteur au départ (relevé initial), numéro de parc
interne, catégorie de matériel alignée sur `contrat_tarifs.categorie_materiel`.

**Propriété** (`FicheVehicule`) : propriété (kogon, loué, sous-traitant ;
obligatoire), propriétaire ou loueur, exploitant, transporteur, contrat de
location (désactivé si Kogon ; contrats `location` ou `autre` seulement,
`contrats_rattachables_flotte`), motif (obligatoire en modification).
Contraintes serveur : `vehicles_propriete_check`, `vehicles_contrat_propriete`
(`20261118210000_flotte.sql:50-66`).

**Document** (`VehicleDocumentModal`) : engin (non réformé), type (liste
fermée CHECK), nom, référence, date d'émission, échéance (>= émission),
fournisseur, coût (>= 0 ; colonne `bigint` : un coût décimal est refusé par
le serveur), notes.

## 9. Actions individuelles et en masse

| Action | État | Preuve |
|---|---|---|
| Suspendre (motif) | DÉPLOYÉ | `suspendre_vehicule`, `FicheVehicule.tsx:144` |
| Remettre en service (motif) | DÉPLOYÉ | `remettre_en_service_vehicule` |
| Réformer (motif ; refus si immobilisation ouverte, voyage engagé, pneus montés) | DÉPLOYÉ | `reformer_vehicule` (`20261118210000_flotte.sql:331`) |
| Renseigner la propriété et le contrat | DÉPLOYÉ | `definir_propriete_vehicule` |
| Affecter à un site (mutation) | PARTIEL (champ du formulaire, sans motif ni journal) | `VehicleModal.tsx` |
| Rattacher en masse les engins au contrat Neemba | MANQUANT (prioritaire : l'évaluation Neemba et le contrôle par engin en dépendent, D-065) | - |
| Exporter la liste | DÉPLOYÉ (CSV, impression) | `VehiclesView.tsx` |
| Suspendre ou modifier en masse (BulkActionBar) | MANQUANT | - |

## 10. Statuts et transitions

Statut administratif saisi (`vehicles.statut_admin`) et statut technique
(`vehicles.status`, cache lu par le dispatch) ; statut opérationnel dérivé
par `v_vehicules` :

```
(aucun) -> suspendu        (suspendre_vehicule, droit écriture vehicles, motif, périmètre site)
suspendu -> (aucun)        (remettre_en_service_vehicule, idem)
(aucun) | suspendu -> reforme  (reformer_vehicule, motif ; refus si immobilisation ouverte,
                                voyage prévu ou engagé, pneus montés) ; définitif
status active -> immobilized | maintenance  (declarer_immobilisation, module 11)
status immobilized | maintenance -> active   (cloture / annulation d'immobilisation ;
                                              déclencheur : reste immobilized si suspendu)
reforme => status sold (déclencheur synchroniser_statut_vehicule)
```

Statut opérationnel : reforme > suspendu > immobilise > en_maintenance >
en_mission (voyage engagé) > disponible. Les statuts CDC 9.2 « planifié »,
« affecté », « en attente », « en ravitaillement », « en inspection »
ne sont pas dérivés : MANQUANT (à dériver du voyage et du poste, sans saisie
supplémentaire).

## 11. Workflows

- Création d'un engin réel : saisie descriptive, puis propriété et contrat
  depuis la fiche, puis tarif par engin dans le contrat (module 10), puis
  relevé initial du compteur (MANQUANT hors voyage). Aucune approbation.
- Suspension et réforme : décision unitaire motivée et journalisée, sans
  seconde personne. Point à trancher : faut-il une validation par un second
  rôle pour la réforme d'un engin loué (restitution au loueur) ?
- Documents : alerte J-30 dans l'écran et dans « Mes validations » non
  (seules les remises en service y figurent pour la flotte) ; aucune
  relance ni escalade : MANQUANT.

## 12. Rôles et permissions

| Action | Module et niveau | Périmètre |
|---|---|---|
| Lire le registre, la fiche, les documents | `vehicles` lecture (`has_module_view`) | `site_permis(site_id)` ; un profil global voit tout |
| Créer, modifier les champs descriptifs | `vehicles` écriture (RLS `ecriture_module`) | site de l'engin |
| Propriété, suspension, remise en service, réforme | `vehicles` écriture via `vehicule_ecrivable` | site de l'engin |
| Documents | `vehicles` lecture et écriture | `vehicule_permis(vehicle_id)` (`20261115210000_perimetre_etendu.sql:70`) |
| Rapports flotte | `reports` lecture | données filtrées par la RLS des tables lues |

Droits au niveau de chaque action (distinguer création, réforme,
propriété) : MANQUANT ; tout passe par « écriture vehicles ».

## 13. Tables et relations

- `vehicles` (base de référence l. 4780 ; colonnes D-062 `propriete`,
  `proprietaire`, `exploitant`, `transporteur`, `contrat_id` -> `contrats`,
  `statut_admin`, `statut_admin_depuis`, `statut_admin_motif`) ; RLS
  `lecture_module` et `ecriture_module` bornées au site
  (`20261114100000_perimetre_site.sql:110-122`) ; INSERT et UPDATE limités
  aux colonnes descriptives ; DELETE retiré (D-042).
- `journal_flotte` append-only (garde `garde_journal_flotte`).
- `vehicle_documents` (CHECK type et statut ; politiques D-046).
- Vues : `v_vehicules`, `v_fiche_vehicule`, `v_documents_vehicule_a_renouveler`.
- Liées : `immobilisations`, `interventions_loueur`, `tires`,
  `fuel_transactions`, `controles_depart`, `releves_compteur`,
  `contrat_tarifs.engin`, `trips.vehicle_id`.
- Colonnes héritées sans usage fiable : `current_km` (défaut 0, pas une
  mesure), `purchase_cost`, `current_value` (défauts retirés), `gps_device_*`
  (extension GPS à déclencheur).

## 14. Fonctions serveur et API

`definir_propriete_vehicule`, `suspendre_vehicule`,
`remettre_en_service_vehicule`, `reformer_vehicule`, `vehicule_ecrivable`,
`contrats_rattachables_flotte`, `reference_contrat_flotte`,
`voyage_en_cours_vehicule`, `saisir_plein` (module 13) : toutes dans
`20261118210000_flotte.sql`, SECURITY DEFINER, `search_path` vide.
Manquantes : `enregistrer_vehicule` / `modifier_vehicule` (journalisées,
motif pour un changement de site ou de capacité), `importer_vehicules`,
`rattacher_contrat_en_masse`.

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Document expiré ou à J-30 | responsable flotte | écran (liste « à renouveler ») | PARTIEL (pas dans « Mes validations », pas de courriel) |
| Engin suspendu ou réformé | exploitation, dispatch | - | MANQUANT (le dispatch voit l'indisponibilité, sans notification) |
| Visite technique ou assurance expirée sur un engin affecté au dispatch | dispatcher | - | MANQUANT |

## 16. Documents et modèles d'impression

Fiche engin imprimable : MANQUANT. Liste imprimable : DÉPLOYÉ (impression
HTML de `exportToPDF`). Pièces scannées : MANQUANT (stockage, module 23).

## 17. Exports et rapports

Export CSV et impression du registre : DÉPLOYÉ. Export des documents :
MANQUANT (aucun bouton d'export dans `VehicleDocumentsView.tsx`). Rapport coût par engin complet :
MANQUANT. « Excel » = CSV (constat transverse 5).

## 18. Historique et audit

`journal_flotte` (propriété, suspension, remise en service, réforme ; avant,
après, motif, auteur, horodatage) : DÉPLOYÉ. Modifications descriptives
(immatriculation, capacité, site) : non journalisées : MANQUANT. Comparaison
de versions : MANQUANT.

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `45_flotte.test.sql` (27 assertions : propriété, statuts, déclencheur, colonnes accordées, vues) ; `22_perimetre_site`, `23_gardes_perimetre`, `29_perimetre_etendu` | création d'un engin global par un profil borné (refus attendu, message) |
| Unitaires | `src/components/Vehicles/flotte.test.ts` (6) | validation du formulaire |
| E2E (API simulée) | `e2e/flotte.spec.ts` (2 : registre, fiche, suspension, propriété ; documents) | création d'engin contre une vraie base (D-069 point 3) |

## 20. Critères de recette métier

1. Le responsable flotte saisit les engins réels du site de Nimba
   (immatriculation, type, capacité utile, site), puis leur propriété
   (« loué », loueur Neemba, contrat de location) ; la liste filtrée
   « non renseignée » est vide.
2. Un engin immobilisé (module 11) disparaît de la liste des disponibles
   au dispatch et réapparaît à la validation de la remise en service.
3. Une suspension motivée empêche l'affectation ; la remise en service la
   rétablit ; le journal montre les deux actions avec auteur et motif.
4. Une assurance expirant sous 30 jours apparaît dans « à renouveler ».
5. PV signé par le responsable flotte et l'exploitation.

## Écarts et lots proposés

### Défauts bloquants constatés

Aucun défaut bloquant sur les écrans d'écriture du module 08 : les colonnes
envoyées par `VehicleModal.tsx:41-47` et `VehicleDocumentModal.tsx:47-55`
existent et sont accordées ; les identifiants vides sont convertis en NULL
(`site_id: f.site_id || null`) ou bloquent l'envoi (type, véhicule).

Défauts non bloquants :
- `src/components/Vehicles/VehicleModal.tsx:70` : « Aucun (engin global) »
  proposé à un profil borné à un site ; le serveur refuse (RLS
  `site_permis(NULL)` faux pour un profil borné) avec un message technique.
- `src/components/Documents/VehicleDocumentModal.tsx:41` : coût accepté en
  décimal, colonne `cost bigint` : refus serveur sur une valeur décimale.
- `src/components/Analyses/AnalysesFlotte.tsx:206` : `current_km` affiché
  comme kilométrage (défaut 0, pas une mesure, D-043) ; `:203` : un engin
  suspendu ou réformé (`sold`) est libellé « Immobilisé ».
- `src/components/Vehicles/VehiclesView.tsx:35` : avec un site choisi, les
  engins globaux (site NULL) disparaissent de la liste.

### Lots proposés (ordre)

1. (S) Corriger les quatre défauts ci-dessus ; dépend de rien.
2. (M) Rattachement en masse des engins au contrat de location et contrôle
   « engin loué sans contrat » ; dépend du dossier contractuel Neemba saisi
   (module 10, données du propriétaire).
3. (M) Écriture descriptive par fonction serveur journalisée (motif pour
   site, capacité, immatriculation), message clair sur une immatriculation
   en double.
4. (S) Capacité utile autorisée et relevé initial de compteur (km et heures)
   hors voyage, écran dans la fiche engin ; dépend du module 07 (D-043).
5. (M) Import du registre (CSV) avec prévalidation ; dépend du composant
   commun ImportWizard.
6. (M) Pièces jointes des documents ; dépend du stockage privé (D-069
   point 2, module 23).
7. (M) Coût complet par engin et par tonne (location contrôlée, carburant,
   pneus, immobilisations) ; dépend des modules 10, 12, 13, 20.
8. (S) Alertes documentaires dans « Mes validations » et notifications.
9. (M) Statuts dérivés complémentaires (planifié, affecté, en attente) et
   tableau de bord flotte ; dépend des modules 05 et 06.
Extensions à déclencheur, non commencées : GPS et télémétrie
(`gps_device_*`), capteurs (CLAUDE.md, bloc 1, section 9).

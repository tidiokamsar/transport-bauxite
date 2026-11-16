# Module 07 : Voyages et rotations

Fiche du catalogue maître (D-077), construite sur `MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : migrations jusqu'à `20261121120000`
appliquées (journal `docs/SIGTB_2.0_HEBERGEMENT_VPS.md`, section 9 ; la
dernière migration du module est `20261121100000`, déployée avec `main`
3dc77d4) ; correctifs d'écran #93 à #95 (dont 9d45e5b, Fiches terrain)
fusionnés, déploiement non consigné au journal ; démonstration purgée
(D-076). Aucun élément n'est UTILISABLE ni VALIDÉ : aucune donnée réelle,
aucun guide de rôle, aucun PV.

## 1. Objectifs et périmètre

Le voyage (rotation) est l'unité de preuve de la chaîne J1 : un camion
benne loué à Neemba, conduit par un chauffeur habilité, chargé par une
chargeuse ou la pelle au site de Nimba, transporte de la bauxite jusqu'au
dépôt CBG, où CBG pèse et émet le ticket. Chaque voyage livré alimente le
tonnage facturé à CBG (D-029), les kilomètres facturables des camions au km
(D-033, D-043), les durées de cycle (planification, dispatch), les
indicateurs et le contrôle des factures Neemba.

Décisions de référence : CDC 12 (cycle), D-028 (fiches terrain), D-037
(ticket CBG source, sans seconde pesée Kogon), D-043 (relevés kilométriques
et distances validées), D-054 et D-072 R3-8 (incidents), D-066 (rapports,
durées, enchaînement), D-075 (périmètre site des lectures et affectations),
D-039 (gardes de périmètre), D-042 (pas de suppression physique).

| Sens | Module | Échange |
|---|---|---|
| Entrée | 04 Planification | objectif du shift (nombre de voyages proposé) |
| Entrée | 06 Dispatch | voyages préparés et affectés (`preparer_voyages`, `decider_affectation`), enchaînement (`VoyageSuivant`, `enchainer_voyage`) |
| Entrée | 08 Flotte, 09 Chauffeurs, 03 Sites | camion, chargeuse, chauffeur habilité, sites ouverts |
| Sortie | 14 Pesée CBG | ticket rattaché au voyage (`tickets_pesee_cbg`), voyages livrés sans ticket ; l'écran Tickets CBG relève du module 14 |
| Sortie | 20 Facturation | réconciliation mensuelle sur les voyages livrés |
| Sortie | 10 Neemba, 19 Contrats | km validés (contrôle des factures au km), pointages FP |
| Sortie | 22 HSE | incidents de voyage |
| Sortie | 05 Postes, 01 Pilotage, 21 Reporting | bilans, indicateurs, rapports |

## 2. Sous-modules

1. Registre et suivi des voyages du jour (cycle, journal).
2. Création et préparation des missions (création unitaire ; préparation en série au module 06).
3. Exécution du cycle : chargement, transit, dépôt, réception, acceptation, clôture.
4. Exceptions : annulation, interruption, litige, rejet, incidents.
5. Fiches terrain papier (FR rotations, FP pointage des engins, FC carburant) : préparation, impression, remise, retour, saisie.
6. Relevés kilométriques et distances validées.
7. Rapports par camion, chauffeur, site, shift.
8. Dossier numérique du voyage (pièces jointes) : cible J1.

## 3. Menus et sous-menus

| Entrée (`src/components/Layout/menu.ts`) | Vue (`src/App.tsx`) | Visible par |
|---|---|---|
| `trips` Voyages & Rotations | `TripsView` | lecture `trips` (matrice D-012, droits par utilisateur D-036) |
| `kilometrage` Kilométrage | `KilometrageView` | lecture `trips` ou `contracts` |
| `fiches` Fiches terrain | `FichesView` | lecture `trips`, `maintenance` ou `fuel` |
| `tickets-cbg` Tickets CBG | `TicketsCbgView` | module 14 |

Le menu ne filtre pas les entrées par droit : un compte sans lecture voit
l'entrée et un écran vide ou une erreur de lecture (écart transverse).

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Liste des voyages du jour par phase, recherche, filtre site, rafraîchissement 60 s, export CSV | `trips` | DÉPLOYÉ | `Trips/TripsView.tsx` ; e2e `voyages.spec.ts` (4 tests) |
| Fiche voyage (tiroir) : résumé, tonnage le plus avancé, journal, actions du cycle | `trips`, `trip_events` | DÉPLOYÉ | `Trips/FicheVoyage.tsx` ; `cycle.ts`, `cycle.test.ts` ; e2e `voyages.spec.ts` |
| Création d'un voyage | `trips` | DÉPLOYÉ | `Trips/NouveauVoyage.tsx` ; e2e « creation d'un voyage par creer_voyage » |
| Incidents du voyage (dans la fiche) | `incidents` | DÉPLOYÉ | `Trips/IncidentVoyage.tsx` ; migration `20261120102000` ; e2e `dispatch-voyages.spec.ts` |
| Voyage suivant (enchaînement, dans la fiche) | `trips` | DÉPLOYÉ (module 06) | `Trips/VoyageSuivant.tsx` |
| Rapports par axe (camion, chauffeur, site, shift), export CSV | `rapport_voyages` | DÉPLOYÉ | `Trips/RapportsVoyages.tsx`, `rapports.ts`, `rapports.test.ts` ; test 49 ; e2e `dispatch-voyages.spec.ts` |
| Kilométrage : relevés, mesure, référence, validation, distances de référence, export CSV | `releves_compteur`, `distances_voyage`, `distances_reference` | DÉPLOYÉ | `Trips/KilometrageView.tsx`, `kilometrage.ts`, `kilometrage.test.ts` ; test 27 ; e2e `kilometrage.spec.ts` |
| Fiches terrain : préparation par shift, liste, remise, retour, annulation | `fiches_terrain` | DÉPLOYÉ (garde référentiel vide : fusionné 9d45e5b, déploiement non consigné) | `Fiches/FichesView.tsx` ; test 14 ; e2e `fiches.spec.ts` |
| Saisie de fiche FR (étapes horodatées, ticket CBG), FP, FC | `fiches_terrain`, `trips`, `pointages_engins`, `fuel_transactions` | PARTIEL (ticket CBG inintégrable sur un trajet mine vers dépôt, voir Défauts) | `Fiches/SaisieFiche.tsx`, `fiches.ts`, `fiches.test.ts` |
| Fiche imprimable A4 (FR paysage), signatures | `fiches_terrain`, `societe` | DÉPLOYÉ | `Fiches/FicheImprimable.tsx` ; e2e « fiche imprimable » |
| Tableau de bord du module (voyages, tonnes, cycle, km à valider) | - | PARTIEL | bandeau de phases dans `TripsView` ; compteur « à valider » dans `KilometrageView` ; pas de tableau de bord dédié |
| Litiges de voyage (liste, instruction, issue) | - | MANQUANT | état `DISPUTED` seul, sans écran de suivi |
| Dossier numérique du voyage (pièces jointes) | - | MANQUANT | aucun stockage de fichiers (matrice, constat transverse 4) |
| Historique multi-jours des voyages (période, pagination) | - | MANQUANT | `TripsView` lit une seule date (`planned_date = date`), sans pagination |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Voyages par phase (prévus, chargement, route, déchargement, livrés, exceptions) | `trips.etat` | jour choisi, heure de lecture affichée | DÉPLOYÉ (`TripsView`) |
| Tonnage du voyage avec sa nature (accepté, reçu, chargé) | `trips` | voyage | DÉPLOYÉ (`cycle.ts` `tonnageVoyage`) |
| Voyages livrés sans distance validée | `v_distances_voyage` | période choisie | DÉPLOYÉ (`KilometrageView`) |
| Cycle et rotation moyens, livrés sans poids, incidents, litiges par axe | `rapport_voyages`, `durees_voyages` | période choisie | DÉPLOYÉ (`RapportsVoyages`) |
| Voyages livrés sans ticket CBG | `v_voyages_livres_sans_ticket` | période | DÉPLOYÉ au module 14, absent de l'écran Voyages |
| Temps d'attente au chargement et au dépôt, voyages en retard sur l'objectif | - | - | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver | Supprimer | Annuler / corriger |
|---|---|---|---|---|---|---|---|
| Voyage | DÉPLOYÉ `creer_voyage` | DÉPLOYÉ | PARTIEL : affectation au dispatch, avant `AT_LOADING` (garde) ; aucune modification de note ou de shift depuis l'écran | MANQUANT | sans objet (clôture) | interdit après `ASSIGNED` (garde `trips_garde_cycle`) ; brouillon : pas d'écran | DÉPLOYÉ : `CANCELLED`, `INTERRUPTED`, `DISPUTED`, `REJECTED` motivés |
| Événement du voyage | DÉPLOYÉ (par transition) | DÉPLOYÉ | interdit (append-only) | - | - | interdit | MANQUANT : rectification d'un horodatage erroné (seule la rectification du ticket existe, module 14) |
| Fiche terrain | DÉPLOYÉ `preparer_fiche` | DÉPLOYÉ | statut par `suivre_fiche`, `terminer_saisie_fiche` | MANQUANT | - | interdit | DÉPLOYÉ `annuler_fiche` motivée |
| Relevé de compteur | DÉPLOYÉ `saisir_releve_compteur` | DÉPLOYÉ | interdit | - | - | interdit | DÉPLOYÉ `corriger_releve_compteur` (nouveau relevé motivé) |
| Distance validée | DÉPLOYÉ `valider_distance_voyage` | DÉPLOYÉ | nouvelle version | - | - | interdit | nouvelle version motivée |
| Distance de référence | DÉPLOYÉ (insert direct sous RLS `contracts`) | DÉPLOYÉ | - | - | DÉPLOYÉ désactivation (`actif = false`) | interdit | désactivation puis nouvelle ligne |
| Incident de voyage | DÉPLOYÉ `declarer_incident` | DÉPLOYÉ | module 22 | - | - | - | module 22 |

## 7. Modals et drawers

| Élément | État | Preuve |
|---|---|---|
| Création de voyage (modal) | DÉPLOYÉ | `NouveauVoyage.tsx` |
| Détail du voyage (tiroir) avec journal | DÉPLOYÉ | `FicheVoyage.tsx` |
| Action de cycle avec heure, motif, pesée, tonnage accepté | DÉPLOYÉ | `FicheVoyage.tsx` (`valider`) |
| Confirmation des opérations sensibles | PARTIEL | `window.prompt` / `window.confirm` (remise, annulation de fiche, correction de relevé, désactivation de référence) ; pas d'`ActionDialog` commun |
| Saisie de fiche (modal) | DÉPLOYÉ | `SaisieFiche.tsx` |
| Impression des fiches | DÉPLOYÉ | `FicheImprimable.tsx` |
| Relevés et validation de distance (panneau) | DÉPLOYÉ | `KilometrageView.tsx` |
| Pièces jointes, commentaires, historique comparé, import en masse | MANQUANT | - |

## 8. Champs des formulaires

**Nouveau voyage** (`NouveauVoyage.tsx`, `creer_voyage`, migration `20261110120000`).

| Champ | Type | Obligatoire | Contrôle client | Contrôle serveur |
|---|---|---|---|---|
| Date prévue | date | oui | `required` | non nulle |
| Shift | `work_shifts` | non | - | - |
| Origine, destination | `sites` | oui | `required`, différentes ; message si aucun site | requises ; site fermé refusé (D-047) ; périmètre (D-039) |
| Camion, chauffeur, chargeuse | listes | non | - | ressources dans le périmètre (D-075, `garde_trips_ressources_perimetre`) ; habilitations (D-051, D-072) |
| Note | texte | non | - | - |

Cible : liste filtrée sur camions bennes actifs, chargeuses et pelle actives,
chauffeurs actifs du site (aujourd'hui toutes les fiches de `vehicles` et
`drivers` sont proposées, le serveur tranche) ; trajet choisi dans les
distances de référence.

**Action de cycle** (`FicheVoyage.tsx`, `avancer_voyage`, migration `20261111090000`).

| Champ | Conditionnel | Contrôle serveur |
|---|---|---|
| Heure de l'événement | toujours | non future (+5 min), pas antérieure au dernier événement |
| Motif | `CANCELLED`, `INTERRUPTED`, `DISPUTED`, `REJECTED` | obligatoire |
| Brut, tare | `WEIGHED_OUT`, `WEIGHED_IN` | brut > tare >= 0 |
| Tonnage accepté | `ACCEPTED` | sinon reçu, sinon chargé ; refus sans pesée |
| Ticket | via fiche FR seulement | unicité inter-voyages (23505) |

**Ligne de fiche FR** (`SaisieFiche.tsx`, `fiches.ts`) : heures par étape
(`COLONNES_ROTATION`), heure de pesée, ticket CBG, brut, tare (kg saisis),
référence du document ; ticket, brut, tare et heure exigés ensemble.
**Ligne FP** : opérateur, horamètre début et fin, observations, arrêts
(début, fin, cause, imputation, description ; début, cause et imputation
exigés). **Ligne FC** : engin, chauffeur, litres > 0, stockage, compteur
(détail au module 13).

**Relevé de compteur** : moment (`depart_charge`, `arrivee_depot`,
`fin_rotation`, `autre`), valeur km, heure, source (`fiche`, `saisie`,
`photo`, `gps`), référence. **Validation de distance** : km chargé, km
retour, km déclaré, motif (exigé si la validée diffère de la mesure ou si
la mesure manque, `motifRequis`). **Distance de référence** : départ,
arrivée, km > 0, source.

## 9. Actions individuelles et en masse

| Action | Portée | État | Preuve |
|---|---|---|---|
| Avancer un voyage d'une étape | individuelle | DÉPLOYÉ | `avancer_voyage` |
| Annuler, interrompre, contester, rejeter (motif) | individuelle | DÉPLOYÉ | `cycle.ts` `actionsPossibles` |
| Déclarer un incident sur le voyage | individuelle | DÉPLOYÉ | `declarer_incident` |
| Enchaîner le voyage suivant | individuelle | DÉPLOYÉ (module 06) | `enchainer_voyage` |
| Saisir une rotation complète depuis la fiche | individuelle (une transaction) | DÉPLOYÉ | `saisir_rotation` |
| Préparer les fiches FR de tous les camions du shift | en masse | DÉPLOYÉ | `FichesView.preparer` |
| Imprimer toutes les fiches préparées | en masse | DÉPLOYÉ | `FicheImprimable` |
| Export CSV de la liste, du kilométrage, des rapports | en masse | DÉPLOYÉ | `TripsView`, `KilometrageView`, `RapportsVoyages` |
| Clôturer en masse les voyages acceptés d'une période | en masse | MANQUANT | - |
| Valider en masse les distances concordantes (mesure = référence) | en masse | MANQUANT | - |
| Dupliquer un voyage | individuelle | MANQUANT | - |

## 10. Statuts et transitions

États réels (`trips.etat`, contrainte `trips_etat_check`, migration
`20261110120000` ; miroir `cycle.ts`). Le serveur (`transition_voyage_autorisee`) est seul juge.

```
DRAFT -> PLANNED -> ASSIGNED (camion et chauffeur requis ; décision dispatch)
ASSIGNED -> AT_LOADING -> LOADING -> LOADED
LOADED -> WEIGHED_OUT (brut, tare) -> IN_TRANSIT
LOADED -> IN_TRANSIT (cas nominal D-037 : pas de pesée Kogon)
IN_TRANSIT -> AT_DESTINATION -> UNLOADING
UNLOADING -> WEIGHED_IN (brut, tare, ticket CBG) -> DELIVERED
UNLOADING -> DELIVERED
DELIVERED -> ACCEPTED (tonnage) | DISPUTED (motif) | REJECTED (motif)
DISPUTED -> ACCEPTED | REJECTED
ACCEPTED -> CLOSED ; REJECTED -> CLOSED
DRAFT..WEIGHED_OUT -> CANCELLED (motif)
LOADING..UNLOADING -> INTERRUPTED (motif)
INTERRUPTED -> IN_TRANSIT | AT_DESTINATION | CANCELLED
```

Droit : écriture `trips` (ou administrateur) ; périmètre de site du départ
ou de l'arrivée (D-039) ; affectation et sites figés après `ASSIGNED`
(garde) ; poids, état et horaires ne changent que par transition.
Fiche terrain : `preparee -> remise (agent nommé) -> retournee -> saisie` ;
`annulee` motivée depuis tout statut ouvert.
Point à trancher : `WEIGHED_OUT` (pesée au départ) reste proposé alors que
D-037 exclut une seconde pesée Kogon ; à conserver comme exception (pont
de la mine en panne côté CBG ?) ou à masquer.

## 11. Workflows

1. Planification (04) puis préparation des voyages du shift et affectation (06).
2. Préparation des fiches FR (une par camion, pesée « arrivée » imposée), FP, FC ; impression ; remise à un agent nommé.
3. Exécution sur le terrain, retour de la fiche signée (preuve des heures et tonnages, D-028).
4. Saisie de la fiche ligne par ligne, une transaction par ligne, ressaisie sans doublon ; ticket CBG rattaché à `WEIGHED_IN`.
5. Relevés kilométriques (exploitation) puis validation de la distance par une autre personne (`kilometrage_validation_separee`, exigée si absent ; droit `contracts`).
6. Acceptation du tonnage, litige ou rejet, clôture.
7. Rapprochement du relevé CBG (14) puis réconciliation mensuelle (20).

Séparation des tâches : relevés et validation des distances (DÉPLOYÉ) ;
saisie de fiche et acceptation du tonnage par le même compte possible
(MANQUANT, à décider). Délais et relances (fiche remise non retournée sous
24 h, voyage livré non accepté sous N jours) : MANQUANT.

## 12. Rôles et permissions

| Action | Module et niveau | Périmètre | État |
|---|---|---|---|
| Lire voyages et journal | `trips` lecture | site de départ ou d'arrivée (D-038, D-075) | DÉPLOYÉ (test 58) |
| Créer, avancer, annuler un voyage | `trips` écriture | idem + ressources (D-075) | DÉPLOYÉ (tests 09, 49, 58) |
| Préparer et saisir une fiche | écriture du module du type (`fiche_module` : FR `trips`, FP `maintenance`, FC `fuel`) | site de la fiche (D-039) | DÉPLOYÉ (test 14) |
| Saisir, corriger un relevé | `trips` écriture | site de l'engin | DÉPLOYÉ (test 27) |
| Valider une distance | `contracts` écriture, autre personne | voyage visible | DÉPLOYÉ (test 27) |
| Gérer les distances de référence | `contracts` écriture ou admin (RLS) | non borné par site | DÉPLOYÉ |
| Déclarer un incident | `trips` écriture ou admin | voyage | DÉPLOYÉ |
| Accepter le tonnage, clôturer | `trips` écriture | - | DÉPLOYÉ ; cible : droit d'approbation distinct à trancher |

L'écran déduit l'affichage de `hasPermission('trips', 'create'|'edit')`,
`hasPermission('contracts', 'edit')` ; il n'existe pas de droit par action
(approbation) distinct de l'écriture.

## 13. Tables et relations

| Table | Colonnes clés | Contraintes | RLS |
|---|---|---|---|
| `trips` | `reference`, `planned_date`, `etat`, `etat_modifie_le`, `vehicle_id`, `driver_id`, `loader_vehicle_id`, `trailer_id`, `departure_site_id`, `arrival_site_id`, `shift_id`, poids (`gross/tare/net_weight`, `load_weight`, `net_weight_reception`, `accepted_tonnage`), horaires réels | `trips_etat_check` ; gardes `trips_garde_cycle`, périmètre (D-039), ressources (D-075), site fermé (D-047), habilitations | lecture module + périmètre |
| `trip_events` | `etat_avant`, `etat_apres`, `survenu_le`, `enregistre_le`, `origine`, `auteur`, `note`, `donnees` (brut, tare, net, ticket, fiche) | `ON DELETE RESTRICT`, append-only | lecture par le voyage (D-075), écriture navigateur retirée |
| `fiches_terrain` | `numero` (FR/FP/FC-AAMMJJ-NNN), `type`, `date_fiche`, `site_id`, `shift_id`, `vehicle_id`, `driver_id`, `agent`, `options` (`pesee`), `contenu`, `statut` | unique `numero` | `REVOKE ALL` puis lecture ; écriture par fonctions |
| `pointages_engins` | `fiche_id`, `vehicle_id`, index, `heures_marche`, arrêts | - | suit `fiches_terrain` (D-075) |
| `releves_compteur` (+ `v_releves_compteur`) | `vehicle_id`, `trip_id`, `moment`, `valeur_km`, `source`, remplacement | CHECK moment, source ; `moment = 'autre' OR trip_id` | lecture `trips`/`contracts` + site de l'engin |
| `distances_voyage` (+ `v_distances_voyage`) | `trip_id`, `version`, `validee_charge_km`, `validee_retour_km`, mesures et référence figées, `motif` | versions | lecture + périmètre du voyage |
| `distances_reference` | `site_depart_id`, `site_arrivee_id`, `distance_km`, `source`, `actif`, `cree_par` | unique actif par trajet ; départ <> arrivée | lecture `trips`/`contracts` ; insert/update `contracts` |
| `tickets_pesee_cbg` | `trip_id`, `fiche_id`, `site_id` (dépôt), `ticket`, `brut`, `tare`, `net`, `document_ref` | module 14 | par le voyage |
| `incidents` | `trip_id`, `numero`, `type`, `statut` | module 22 | - |

## 14. Fonctions serveur et API

| Fonction | Signature (définition la plus récente) | Migration |
|---|---|---|
| `creer_voyage` | `(p_planned_date, p_departure_site_id, p_arrival_site_id, p_vehicle_id, p_driver_id, p_loader_vehicle_id, p_trailer_id, p_shift_id, p_note)` | `20261110120000` |
| `avancer_voyage` | `(p_trip_id, p_etat, p_survenu_le, p_note, p_donnees)` | `20261111090000` |
| `transition_voyage_autorisee`, `trips_garde_cycle`, `statut_depuis_etat` | garde et règles | `20261110120000` |
| `preparer_fiche` | `(p_type, p_date, p_site_id, p_shift_id, p_vehicle_id, p_driver_id, p_agent, p_options, p_contenu)` ; FR : `pesee = 'arrivee'` exigé | `20261113100000` |
| `suivre_fiche`, `annuler_fiche`, `terminer_saisie_fiche` | `(p_id, p_etape, p_agent, p_quand)`, `(p_id, p_motif)`, `(p_id, p_note)` | `20261111090000` |
| `saisir_rotation` | `(p_fiche_id, p_trip_id, p_etapes)` ; ticket au dépôt d'arrivée = site de la fiche | `20261113100000` |
| `saisir_pointage` | `(p_fiche_id, p_vehicle_id, p_index_debut, p_index_fin, p_operateur, p_observations, p_arrets)` | `20261111090000` |
| `saisir_carburant` | `(p_fiche_id, p_prix_litre, p_fournisseur, p_lignes)` | `20261120100000` |
| `saisir_releve_compteur`, `corriger_releve_compteur` | `(p_vehicle_id, p_trip_id, p_moment, p_valeur, p_quand, p_source, p_reference)`, `(p_id, p_valeur, p_motif)` | `20261120100000` |
| `valider_distance_voyage` | `(p_trip_id, p_charge_km, p_retour_km, p_declaree_km, p_motif)` | `20261115150000` |
| `declarer_incident` | `(p_type, p_gravite, p_description, p_survenu_le, p_vehicle, p_driver, p_trip, p_site, p_lieu, p_cout_estime, p_controle)` | `20261120102000` |
| `durees_voyages`, `rapport_voyages` | `(p_debut, p_fin)`, `(p_debut, p_fin, p_axe, p_site)` ; SECURITY INVOKER | `20261121100000` |

Les appels des écrans ont été confrontés à ces signatures : noms de
paramètres conformes. Aucune fonction Edge dans le module.

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Voyage livré non accepté, en litige | exploitation, chargé de contrats | Mes validations (D-056) | PARTIEL : à vérifier dans `mes_validations()` selon module 24 ; aucune alerte propre |
| Fiche remise non retournée, fiche retournée non saisie | chef de poste | - | MANQUANT |
| Voyage livré sans distance validée | chargé de contrats | compteur d'écran | PARTIEL |
| Voyage interrompu ou incident grave | dispatcher, HSE | - | MANQUANT |

## 16. Documents et modèles d'impression

| Document | État | Preuve |
|---|---|---|
| Fiche FR (A4 paysage), FP, FC, avec en-tête société, numéro, voyages prévus, zones de signature | DÉPLOYÉ | `FicheImprimable.tsx`, e2e « fiche imprimable » |
| Fiche voyage imprimable (bon de transport, journal, ticket) | MANQUANT | - |
| Pièces du voyage (photo de la fiche signée, ticket CBG scanné) | MANQUANT | dépend du stockage de pièces jointes (J1) |

## 17. Exports et rapports

| Export | Format | État |
|---|---|---|
| Liste des voyages du jour | CSV | DÉPLOYÉ (`TripsView`) |
| Kilométrage des voyages | CSV | DÉPLOYÉ (`KilometrageView`) |
| Rapports par axe | CSV | DÉPLOYÉ (`RapportsVoyages`) |
| PDF, Excel natif, rapport de période multi-jours | - | MANQUANT (« Excel » = CSV, constat transverse 5) |

## 18. Historique et audit

| Élément | État | Preuve |
|---|---|---|
| Journal immuable des transitions (auteur, heure déclarée et enregistrée, données, fiche) | DÉPLOYÉ | `trip_events`, tests 09 et 14 |
| Numéro de fiche et ticket au journal | DÉPLOYÉ | test 14 |
| Relevés corrigés (ancien conservé), distances en versions | DÉPLOYÉ | test 27 |
| Auteur d'une distance de référence | PARTIEL | `cree_par` non envoyé par `KilometrageView.tsx:106-107` et sans valeur par défaut : la ligne est enregistrée sans auteur |
| Comparaison de versions, historique de l'affectation dans la fiche voyage | PARTIEL | `decisions_dispatch` (module 06), non affiché dans `FicheVoyage` |

## 19. Tests

| Type | Existants | Manquants |
|---|---|---|
| pgTAP | 09 cycle (16), 14 fiches (37), 27 relevés (19), 49 dispatch et voyages (87), 53 correctifs exploitation (32), 58 périmètre des lectures (26) | ticket CBG sur un voyage mine vers dépôt (le test 14 n'utilise que des voyages dont départ = arrivée, ce qui masque le défaut D1) ; acceptation et clôture par un compte borné à un site |
| Unitaires | `cycle.test.ts`, `kilometrage.test.ts`, `rapports.test.ts`, `enchainement.test.ts`, `fiches.test.ts` | - |
| E2E (API simulée) | `voyages` (4), `fiches` (4), `kilometrage` (2), `dispatch-voyages` (8) | parcours J1 rejoué contre une vraie base (bloc 1, section 7) ; cas référentiel vide sur `TripsView` et `KilometrageView` |

## 20. Critères de recette métier

| Scénario | Acteur | Données attendues | PV |
|---|---|---|---|
| Un shift complet : voyages préparés, fiches FR imprimées, remises, retournées, saisies ; chaque voyage livré porte heures, numéro de fiche et ticket CBG | chef de poste, agent de saisie | voyages `DELIVERED`, `trip_events` avec fiche, `tickets_pesee_cbg` | aucun |
| Ticket déjà utilisé, voyage d'un autre camion, heure antérieure : refus explicites | agent de saisie | aucun effet en base | aucun |
| Relevés km d'un camion sur la période, distance validée par le chargé de contrats, km facturables | exploitation, chargé de contrats | `distances_voyage` versionnées | aucun |
| Voyage annulé, interrompu puis repris, litige puis acceptation | dispatcher | motifs au journal | aucun |
| Rapport par camion et par chauffeur de la période, rapproché des fiches papier | responsable d'exploitation | `rapport_voyages` = fiches signées | aucun |

## Défauts bloquants constatés

| N° | Fichier:ligne | Cause |
|---|---|---|
| D1 | `src/components/Fiches/FichesView.tsx:71` et `:109` ; `supabase/migrations/20261113100000_d037_ticket_pesee_cbg_rectification.sql:268` | La fiche FR est préparée pour le site de chargement (voyages filtrés sur `departure_site_id = site`, `p_site_id: site`), alors que `saisir_rotation` refuse le ticket CBG si `arrival_site_id` du voyage diffère du site de la fiche (« Le ticket CBG ne peut etre rattache qu'au depot de destination du voyage »). Sur un trajet réel Nimba vers dépôt CBG, aucune fiche ne peut donc rattacher le ticket ; c'est la seule voie d'écriture de `tickets_pesee_cbg` dans l'interface (la fiche voyage `FicheVoyage.tsx:89-101` n'envoie pas de ticket). Conséquence : voyages livrés sans ticket, anomalie bloquante `sans_ticket_cbg` à la réconciliation (D-029), chaîne J1 interrompue. Le test 14 (`14_fiches_terrain.test.sql:52-57`) ne couvre que des voyages dont départ = arrivée. Correction à trancher : comparer le dépôt du voyage au site d'arrivée attendu sans exiger qu'il soit celui de la fiche, ou préparer la FR au dépôt. |

Vérifié sans défaut bloquant : colonnes lues et envoyées par `TripsView`,
`FicheVoyage` (`trip_events.enregistre_le`, `origine` existent),
`NouveauVoyage`, `IncidentVoyage` (colonnes HSE de `20261117120000`),
`KilometrageView`, `FichesView`, `SaisieFiche` ; noms de paramètres de tous
les `rpc` ; privilèges (écritures par fonctions SECURITY DEFINER, insert et
update de `distances_reference` accordés par colonne sous politique
`contracts`). Référentiel vide : `NouveauVoyage` bloque l'envoi
(`required` sur origine et destination, message « Aucun site enregistré »,
`NouveauVoyage.tsx:113-138`) ; `KilometrageView` désactive « Ajouter » sans
départ ni arrivée (`KilometrageView.tsx`, bouton « Ajouter ») et ne saisit
qu'un voyage existant ; la correction 9d45e5b couvre les trois boutons
« Préparer » de `FichesView` (garde `if (!site)` ligne 102, panneau masqué
sans site, sélecteurs désactivés). Points mineurs non bloquants :
`SaisieFiche.tsx:28-29` filtre `vehicle_id` sur `''` si la fiche n'a pas de
camion (impossible pour une FR, le serveur l'exige) et ignore l'erreur de
lecture (affiche « Aucun voyage ») ; `FichesView` propose « Annuler » et
« Fiche retournée » sur des fiches saisies ou annulées (le serveur refuse) ;
la fiche de pointage se prépare avec zéro engin ; `KilometrageView` préremplit
l'heure du relevé à 08:00 de la date du voyage (valeur non observée, à
remplacer par un champ vide obligatoire, règle 1).

## Écarts et lots proposés

1. **Corriger D1** (ticket CBG rattachable sur un trajet mine vers dépôt) : migration additive de `saisir_rotation` + test pgTAP sur voyage à départ et arrivée distincts + E2E. Taille S. Dépendances : module 14 (relevé CBG), revue indépendante (fonction SECURITY DEFINER).
2. **Pièces jointes du voyage** (photo de la fiche signée, ticket scanné) et dossier numérique : composant `AttachmentModal`, bucket privé par module et site (D-069 point 2). Taille M. Dépendances : socle commun de pièces jointes (D-077), configuration du serveur web.
3. **Historique multi-jours** : liste sur période avec pagination, filtres camion, chauffeur, état, shift, vues enregistrées (`DataTable` commun). Taille M. Dépendances : composant `DataTable`.
4. **Relevés km dans la saisie de la fiche FR** (départ chargé, arrivée dépôt) au lieu d'un écran séparé ; supprimer le préremplissage 08:00. Taille S. Dépendances : D-043.
5. **Litiges de voyage** : écran de suivi (motif, pièces, issue, lien réconciliation et relevé CBG). Taille M. Dépendances : modules 14 et 20 (« relier les litiges à la réconciliation », D-050).
6. **Rectification d'un événement erroné** (heure, étape saisie à tort) par événement correctif motivé, autre utilisateur. Taille M. Dépendances : décision à consigner (CDC 31), revue indépendante.
7. **Droit d'approbation distinct** pour l'acceptation du tonnage et la clôture, et séparation saisie / acceptation. Taille S. Dépendances : point à trancher par le propriétaire, matrice des droits.
8. **Actions en masse** : clôture des voyages acceptés, validation des distances concordantes (`BulkActionBar`). Taille S. Dépendances : composant commun.
9. **Notifications** : fiche non retournée, voyage livré non accepté, interruption. Taille S. Dépendances : module 24.
10. **Impression de la fiche voyage** et exports PDF. Taille S. Dépendances : modèle de document (module 02).
11. **Statut de `WEIGHED_OUT`** au regard de D-037 : à trancher par le propriétaire (garder en exception ou masquer). Taille S.
12. **Tableau de bord du module** (voyages, tonnes livrées et acceptées, cycle, attente, km à valider, livrés sans ticket) avec période, source et heure. Taille M. Dépendances : modules 01 et 21.
13. **Recette J1 contre une vraie base** (conteneur jetable) puis guide du rôle et PV. Taille M. Dépendances : données réelles du propriétaire (sites, flotte, chauffeurs, contrat CBG).

Hors périmètre tant que leur déclencheur n'est pas atteint (bloc 1,
section 9) : suivi GPS des voyages et horodatage automatique, application
mobile et saisie hors ligne, OCR des fiches et tickets.

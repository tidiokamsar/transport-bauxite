# Module 06 : Dispatch et affectation

Fiche du catalogue maître (D-077), construite sur `docs/catalogue/MODELE_FICHE_MODULE.md`.
État constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre` (base `main` 8df078d).

Rappels de lecture :
- « DÉPLOYÉ » renvoie au journal `docs/SIGTB_2.0_HEBERGEMENT_VPS.md` : migrations jusqu'à `20261121100000` appliquées (PR #88, `main` 3dc77d4, tests 49 et 58 verts sur la base du serveur).
- La production a été purgée de la démonstration (D-076) : aucun camion, chauffeur, shift ni voyage réel n'y est saisi. Aucun élément n'est donc UTILISABLE, aucun n'est VALIDÉ (aucun PV).
- Un élément TESTÉ et DÉPLOYÉ est noté DÉPLOYÉ, avec ses tests en preuve.

## 1. Objectifs et périmètre

Le dispatch transforme l'objectif de production d'un shift en voyages affectés : un camion semi-remorque benne, un chauffeur habilité et, au besoin, l'engin de chargement (2 chargeuses Caterpillar et 1 pelle louées à Neemba, D-011, D-022, D-027). Le système recommande selon des règles fixes et expliquées ; le dispatcher accepte, modifie ou refuse ; chaque décision est historisée (CDC 11.5, règle 4 de `CLAUDE.md`).

Décisions de référence : D-024 (dispatch v1 déterministe), D-066 (affectation groupée, enchaînement, simulation, sanctions en avertissement), D-075 (périmètre site des affectations), D-047 (site fermé), D-051 et D-072 R2-C2 (habilitations), D-025 (immobilisations), D-023 et D-063 (objectifs), D-039 (gardes de périmètre).

| Sens | Module | Échange |
|---|---|---|
| Entrée | 04 Production Planning | Objectif du shift (`v_realisation_objectifs`), charge moyenne (`statistiques_rotation`) |
| Entrée | 05 Shift Management | Shifts (`work_shifts`) ; postes et équipe présente (non lus aujourd'hui) |
| Entrée | 08 Flotte, 11 Maintenance | Statut des camions et engins (`vehicles.status`, mis à jour par les immobilisations) |
| Entrée | 09 Chauffeurs | Statut, permis, habilitations, sanctions de conduite en vigueur |
| Entrée | 03 Sites | Fermetures (`site_ferme_le`), capacités des infrastructures |
| Sortie | 07 Voyages | Voyages préparés (`preparer_voyages`) puis affectés (`ASSIGNED`), voyage suivant enchaîné |
| Sortie | 14, 19, 20 | Indirecte : les voyages affectés produisent rotations, km, tickets et facturation |
| Sortie | 01, 21 | Journal `decisions_dispatch` (taux d'acceptation, motifs de refus) |

Hors périmètre ou à déclencheur (bloc 1, section 9) : optimisation mathématique (OR-Tools, LOT 09), files d'attente mesurées, position GPS, temps de trajet en direct, prévisions calculées. Rien de cela ne doit être commencé avant son déclencheur.

## 2. Sous-modules

| Code | Sous-module | État |
|---|---|---|
| 06.1 | Préparation des voyages du shift | DÉPLOYÉ |
| 06.2 | Files : à affecter, à réaffecter, affectés | PARTIEL (pas de file d'attente au chargement ni de file des camions libres) |
| 06.3 | Recommandation expliquée | DÉPLOYÉ |
| 06.4 | Décision unitaire (accepter, modifier, refuser, réaffecter) | DÉPLOYÉ |
| 06.5 | Affectation groupée avec rapport | DÉPLOYÉ |
| 06.6 | Enchaînement après livraison | DÉPLOYÉ |
| 06.7 | Contraintes serveur (statut, permis, habilitations, site fermé, périmètre, chauffeur unique) | DÉPLOYÉ |
| 06.8 | Priorités des voyages | MANQUANT |
| 06.9 | Interruptions (panne en cours de voyage) et réaffectation d'un voyage engagé | MANQUANT |
| 06.10 | Simulation et comparaison de scénarios | DÉPLOYÉ |
| 06.11 | Historique et analyse des décisions | PARTIEL |
| 06.12 | Optimisation des rotations | MANQUANT (extension à déclencheur) |

## 3. Menus et sous-menus

| Entrée | Identifiant | Rôles qui la voient | Preuve |
|---|---|---|---|
| Dispatch (racine) | `dispatch` | lecture du module `trips` (`canAccessModule` : `dispatch` -> `trips`), matrice D-012, droits par utilisateur D-036 | `src/components/Layout/menu.ts:38`, `src/contexts/AuthContext.tsx:174`, `src/App.tsx:249` |
| Voyage suivant (fiche voyage) | dans `trips` | écriture `trips` | `src/components/Trips/FicheVoyage.tsx:227` |

Cible : sous-menus Dispatch > Tableau du shift, Décisions (journal), Simulation, Paramètres du dispatch (règles affichées, seuils).

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Tableau du shift (date, site, shift ; synthèse 5 compteurs) | voyages du shift | DÉPLOYÉ | `Dispatch/DispatchView.tsx:274-305` ; E2E `dispatch.spec.ts` |
| Préparer le shift (nombre proposé depuis l'objectif) | voyages préparés | DÉPLOYÉ, défaut référentiel vide (voir Défauts) | `DispatchView.tsx:246-255, 310-338` ; E2E `dispatch.spec.ts:109` |
| Recommandations à affecter (tableau, sélection, accepter, modifier, refuser) | recommandation | DÉPLOYÉ | `DispatchView.tsx:340-411` ; E2E `dispatch.spec.ts:63, 96` |
| Rapport d'affectation groupée | rapport par voyage | DÉPLOYÉ | `DispatchView.tsx:413-428` ; E2E `dispatch-voyages.spec.ts:66` |
| À réaffecter (camion ou chauffeur devenu indisponible) | voyage affecté | DÉPLOYÉ | `DispatchView.tsx:430-452` ; E2E `dispatch.spec.ts:82` |
| Journal des décisions du shift | `decisions_dispatch` | PARTIEL (200 dernières, sans filtre, sans export) | `DispatchView.tsx:454-475` |
| Fenêtre de décision (modifier, refuser, réaffecter) | décision | DÉPLOYÉ | `Dispatch/FenetreDecision.tsx` |
| Simulation de scénarios | scénario non écrit | DÉPLOYÉ | `Dispatch/SimulationScenarios.tsx` ; E2E `dispatch-voyages.spec.ts:86, 118` |
| Voyage suivant (fiche du voyage livré) | enchaînement | DÉPLOYÉ | `Trips/VoyageSuivant.tsx` ; E2E `dispatch-voyages.spec.ts:125, 158, 178` |
| File des camions disponibles (au parking, retour à vide, en attente au chargement) | camion | MANQUANT | compteur seul (`DispatchView.tsx:298`) |
| File d'attente au point de chargement (par chargeuse ou pelle) | file | MANQUANT | dépend de données horodatées d'arrivée (`AT_LOADING`) |
| Fiche détaillée d'une décision (recommandation, état avant, après) | décision | MANQUANT | colonne `avant` stockée, non affichée |
| Analyse des décisions (taux d'acceptation, motifs de refus par période) | indicateur | MANQUANT | - |
| Paramètres du dispatch (seuils, règles, priorités) | réglage | MANQUANT | seuils codés dans l'écran (D-066, limites) |

## 5. Widgets et tableaux de bord

| Indicateur | Source | Période | État |
|---|---|---|---|
| Voyages du shift, à affecter, affectés et engagés, à réaffecter, camions disponibles | `trips`, `vehicles` (lecture) | date x site x shift, rafraîchi chaque minute | DÉPLOYÉ (`DispatchView.tsx:153-156, 292-305`), avec `Provenance` et heure (`:476`) |
| Objectif et proposition du nombre de voyages | `v_realisation_objectifs`, `statistiques_rotation` (14 jours) | shift | DÉPLOYÉ (`recommandation.ts:206`, `DispatchView.tsx:313-315`) |
| Capacité atteignable par scénario (tonnes, voyages, plafond d'infrastructure) | `statistiques_trajets`, `infrastructures_site` | 7 à 60 jours d'observation | DÉPLOYÉ (`simulation.ts`) |
| Taux d'acceptation des recommandations, motifs de refus | `decisions_dispatch` | jour, semaine, mois | MANQUANT |
| Temps moyen d'attente au chargement, saturation des dépôts | `trip_events` | shift | MANQUANT (dépend de saisies horodatées réelles) |
| Utilisation des chargeuses et de la pelle (voyages chargés par engin) | `trips.loader_vehicle_id` | shift | MANQUANT |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Dupliquer | Archiver/restaurer | Supprimer | Annuler/corriger |
|---|---|---|---|---|---|---|---|
| Voyage préparé | DÉPLOYÉ (`preparer_voyages`) | DÉPLOYÉ | non applicable (affectation = décision) | MANQUANT (« dupliquer le plan d'hier ») | non applicable | interdit (pièce métier) | annulation motivée au module 07 (`avancer_voyage` vers `CANCELLED`) |
| Affectation (décision) | DÉPLOYÉ (`decider_affectation`, `affecter_en_groupe`, `enchainer_voyage`) | PARTIEL (journal du shift) | interdit : réaffectation motivée = nouvelle décision | non applicable | non applicable | interdit (table immuable, aucun droit d'écriture des comptes) | DÉPLOYÉ (réaffectation motivée d'un voyage `ASSIGNED`) |
| Règle ou seuil du dispatch | MANQUANT | MANQUANT (texte affiché seulement) | MANQUANT | - | - | - | - |
| Priorité d'un voyage | MANQUANT | MANQUANT | MANQUANT | - | - | - | - |
| Scénario de simulation | non enregistré par décision D-066 | DÉPLOYÉ (calcul à l'écran) | DÉPLOYÉ (répartition modifiable) | - | - | - | - |

## 7. Modals et drawers

| Type | Usage | État | Preuve |
|---|---|---|---|
| Action | Modifier, refuser, réaffecter avec motif obligatoire | DÉPLOYÉ | `FenetreDecision.tsx` |
| Confirmation | Affectation groupée (« Tout accepter » part sans confirmation) | MANQUANT | `DispatchView.tsx:347` |
| Rapport | Résultat de l'affectation groupée | DÉPLOYÉ | `DispatchView.tsx:413` |
| Détail | Drawer d'une décision (recommandation, avant, après, auteur) | MANQUANT | - |
| Historique | Historique des affectations d'un voyage | MANQUANT (le journal du voyage, module 07, montre les transitions) | - |
| Export | Journal des décisions, plan d'affectation du shift | MANQUANT | - |
| Impression | Feuille d'affectation du shift (camion, chauffeur, engin, destination) | MANQUANT (la fiche FR du module 07 couvre un camion) | - |
| Pièces jointes, commentaires | Non nécessaires en v1 | MANQUANT | dépend du socle commun D-077 |

## 8. Champs des formulaires

**Préparer le shift** (`DispatchView.tsx:317-336`)

| Champ | Type | Obligatoire | Validation client | Validation serveur |
|---|---|---|---|---|
| Date | date | oui | sélecteur | voyage créé par `creer_voyage` |
| Site de chargement | liste (`sites`) | oui | verrouillé si profil affecté | `site_permis` (garde D-039) |
| Shift | liste (`work_shifts` actifs) | oui | aucune (valeur vide possible, voir Défauts) | aucune sur l'existence du shift |
| Destination | liste des sites sauf le site de chargement | oui | bouton désactivé si vide | `creer_voyage` |
| Nombre de voyages | entier | oui | >= 1 | 1 à 300 (`preparer_voyages`) |

**Décision** (`FenetreDecision.tsx`)

| Champ | Type | Obligatoire | Validation client | Validation serveur |
|---|---|---|---|---|
| Camion | liste (actifs, benne ou plateau, du site ou sans site) | oui sauf refus | non vide | actif, `tipper` ou `flatbed`, `vehicule_permis` |
| Chauffeur | liste (actifs, permis valide à la date) | oui sauf refus | non vide | actif, permis valide, habilitations (`garde_habilitations_voyage`, `garde_dispatch_habilitations`), un seul camion par shift, périmètre |
| Chargeuse ou pelle | liste (actifs `loader` ou `excavator`) | non | - | actif et type adapté, `vehicule_permis` |
| Motif | texte | oui (modification, refus, réaffectation) | non vide | contrainte `decisions_dispatch_motif` |

**Voyage suivant** (`VoyageSuivant.tsx`) : date du nouveau voyage (par défaut le jour, jamais avant le voyage livré ; serveur : refus si antérieure, exigée si le voyage livré date d'avant la veille).

Champs cibles manquants : priorité du voyage, motif structuré de refus (liste paramétrable plus texte), poste de rattachement.

## 9. Actions individuelles et en masse

| Action | Portée | État | Preuve |
|---|---|---|---|
| Créer N voyages du shift | masse | DÉPLOYÉ | `preparer_voyages` ; pgTAP 11 |
| Accepter une recommandation | unitaire | DÉPLOYÉ | `DispatchView.tsx:202` ; pgTAP 11 |
| Accepter la sélection / tout accepter | masse (300 max) | DÉPLOYÉ | `affecter_en_groupe` ; pgTAP 49 ; E2E `dispatch-voyages.spec.ts:66` |
| Modifier l'affectation recommandée | unitaire | DÉPLOYÉ | `FenetreDecision.tsx` |
| Refuser une recommandation | unitaire | DÉPLOYÉ | E2E `dispatch.spec.ts:96` |
| Réaffecter un voyage affecté (panne, permis, sanction) | unitaire, motivée | DÉPLOYÉ | E2E `dispatch.spec.ts:82` |
| Enchaîner le voyage suivant | unitaire | DÉPLOYÉ | `enchainer_voyage` ; pgTAP 49 |
| Réaffecter en masse (panne d'une chargeuse : tous ses voyages) | masse | MANQUANT (D-066 : réaffectation unitaire seulement) |
| Désaffecter un voyage (rendre le camion libre) | unitaire | MANQUANT | - |
| Fixer une priorité | unitaire et masse | MANQUANT | - |
| Exporter, imprimer le plan d'affectation | masse | MANQUANT | - |

## 10. Statuts et transitions

États du voyage concernés (cycle du module 07, `trips.etat`, garde `trips_garde_cycle`) :

```
DRAFT -> PLANNED            (decider_affectation acceptee|modifiee, W trips, contraintes ; transition interne)
PLANNED -> ASSIGNED         (decider_affectation acceptee|modifiee, W trips, périmètre, site non fermé, habilitations)
DRAFT|PLANNED -> (inchangé) (decider_affectation refusee, motif, décision historisée)
ASSIGNED -> ASSIGNED        (réaffectation : decider_affectation, motif obligatoire, nature = reaffectation)
ASSIGNED et suivants        (affectation figée : « Voyage engagé : l'affectation ne change plus »)
DELIVERED|ACCEPTED|CLOSED|DISPUTED|REJECTED du voyage n
   -> voyage n+1 PLANNED -> ASSIGNED  (enchainer_voyage, W trips, camion et chauffeur non engagés ailleurs)
```

Statuts de la décision : `acceptee`, `modifiee`, `refusee` ; nature `affectation` ou `reaffectation` (`20261110180000_dispatch.sql:30-45`). Immuable.

Cible manquante : réaffectation d'un voyage `INTERRUPTED` (panne en route, transbordement), avec décision historisée ; aujourd'hui refusée par `decider_affectation`.

## 11. Workflows

1. Planification fixe l'objectif du shift (module 04).
2. Le dispatcher prépare les voyages (nombre proposé, modifiable).
3. Le système calcule une recommandation par voyage (règles affichées : camion le moins chargé du shift, chauffeur habituel sur 14 jours sinon le moins chargé, engin le moins chargé ; sanctions de conduite signalées sans blocage).
4. Le dispatcher décide (unitaire ou groupé) ; le serveur contrôle et historise ; un refus serveur d'une ligne groupée n'annule que cette ligne.
5. En cours de shift : voyages à réaffecter signalés (camion ou chauffeur devenu indisponible) ; réaffectation motivée.
6. Après livraison : enchaînement du voyage suivant depuis la fiche voyage.

Séparation des tâches : aucune exigée entre recommandation et décision (le système n'est pas une personne). Délais, relances, escalades : MANQUANT (cible : alerte si un voyage préparé reste sans camion après le début du shift, notification au chef de poste). Délégation : MANQUANT (dépend du module 24).

Points à trancher par le propriétaire :
- Faut-il qu'une sanction `retrait_conduite` en vigueur bloque l'affectation (aujourd'hui avertissement seul, D-066) ? Défaut retenu : avertissement.
- Le dispatch doit-il ne proposer que les chauffeurs pointés présents au poste ouvert (D-048) ? Défaut retenu : non, faute de poste ouvert systématique.
- Les engins Neemba de chargement sont-ils affectés au voyage (aujourd'hui optionnel) ou au poste ? Défaut retenu : optionnel au voyage.

## 12. Rôles et permissions

| Action | Module | Niveau | Périmètre site | Preuve |
|---|---|---|---|---|
| Voir le dispatch, les décisions | `trips` | lecture | `decisions_dispatch` par le voyage visible (D-075) | politique `lecture_module`, `20261121095000` ; pgTAP 58 |
| Préparer, accepter, modifier, refuser, réaffecter, grouper, enchaîner | `trips` | écriture (`has_module_write('trips')`) | voyage, camion, engin et chauffeur dans le périmètre ; garde `garde_a_ressources_perimetre` | `20261121095000_perimetre_site_lectures.sql:110-255` ; pgTAP 49, 58 |
| Lire les sanctions (avertissement) | `drivers` ou `trips` | lecture | chauffeur, voyage ou site de saisie | politique `lecture` sur `sanctions_infraction`, `20261121100000:470` |
| Paramétrer les règles du dispatch | cible : administration | approbation | - | MANQUANT |

Affichage des actions : `peutEcrire = hasPermission('trips','create'|'edit')` (`DispatchView.tsx:66`). Aucun droit propre au dispatch (le dispatcher et l'agent de saisie des voyages ont les mêmes droits) : point à trancher (module de droits `dispatch` distinct ?).

## 13. Tables et relations

| Table | Colonnes clés | Contraintes | RLS |
|---|---|---|---|
| `decisions_dispatch` | `trip_id`, `decision`, `nature`, `recommandation` (jsonb), `vehicle_id`, `driver_id`, `loader_vehicle_id`, `avant` (jsonb), `motif`, `auteur`, `decide_le` | motif obligatoire sauf acceptation initiale ; FK `ON DELETE RESTRICT` ; aucun privilège d'écriture aux comptes | lecture `trips` et périmètre du voyage (D-075) |
| `trips` (module 07) | `etat`, `vehicle_id`, `driver_id`, `loader_vehicle_id`, `shift_id`, `departure_site_id`, `arrival_site_id` | gardes `trips_garde_cycle`, `garde_a_ressources_perimetre`, `garde_habilitations_voyage`, périmètre D-039 | par site de départ ou d'arrivée |
| `vehicles`, `drivers`, `work_shifts`, `immobilisations`, `fermetures_site`, `infrastructures_site`, `sanctions_infraction`, `infractions_chauffeur` | lus par le dispatch | - | selon leur module |

Tables Bolt non reprises (D-024) : `dispatch_assignments`, `dispatch_rules`, `dispatch_simulations` (à archiver ou retirer, D-071).

## 14. Fonctions serveur et API

| Fonction | Rôle | Sécurité | Définition en vigueur |
|---|---|---|---|
| `preparer_voyages(p_date, p_site_id, p_destination_id, p_shift_id, p_nombre)` | crée N voyages via `creer_voyage` | DEFINER, `search_path` vide, W trips | `20261110180000_dispatch.sql:58` |
| `decider_affectation(p_trip_id, p_decision, p_vehicle_id, p_driver_id, p_loader_vehicle_id, p_recommandation, p_motif)` | contrôles, affectation, historisation | DEFINER, périmètre avant lecture | `20261121095000_perimetre_site_lectures.sql:110` |
| `affecter_en_groupe(p_affectations jsonb)` | 300 voyages, sous-bloc par voyage, rapport | DEFINER | `20261121100000_dispatch_voyages.sql:153` |
| `enchainer_voyage(p_trip_id, p_loader_vehicle_id, p_suivant, p_date, p_shift_id, p_recommandation)` | voyage suivant, verrou par camion | DEFINER | `20261121100000_dispatch_voyages.sql:217` |
| `statistiques_rotation(p_site_id, p_shift_id, p_jusqua, p_jours)` | charge moyenne (proposition) | INVOKER | `20261110150000_planification.sql:242` |
| `statistiques_trajets(...)`, `durees_voyages(p_debut, p_fin)` | simulation, durées mesurées | INVOKER | `20261121100000_dispatch_voyages.sql:75, 118` |
| `site_ferme_le`, garde `garde_dispatch_site_ferme` (déclencheur `garde_site_ferme` sur `decisions_dispatch`) | refus vers ou depuis un site fermé | - | `20261115230000_infrastructures_sites.sql:58, 123` |
| `garde_dispatch_habilitations`, `garde_habilitations_voyage` | chauffeur non habilité refusé | - | `20261120101000_correctifs_revue_r2.sql:97, 159` |
| `garde_a_ressources_perimetre` | ressource hors périmètre refusée | - | `20261121095000_perimetre_site_lectures.sql:254` |

Vérification des appels de l'interface : les noms et types des paramètres envoyés par `DispatchView.tsx:122, 208-216, 238, 249-251`, `FenetreDecision.tsx:52-60`, `SimulationScenarios.tsx:47`, `VoyageSuivant.tsx:71-79` correspondent aux signatures ci-dessus ; les colonnes lues (`work_shifts.display_name, start_time, end_time, is_active, shift_order` ; `vehicles.registration, vehicle_type, status, site_id` ; `drivers.name, status, license_expiry` ; `trips.reference, etat, loader_vehicle_id, shift_id` ; `decisions_dispatch.*` ; `v_realisation_objectifs.tonnes_cible, voyages_cible, date_plan, site_id, shift_id` ; `infrastructures_site.site_id, type, code, capacite, unite_capacite, actif` ; `sanctions_infraction.sanction, statut` avec `infractions_chauffeur!inner(driver_id, numero, statut)`) existent toutes (base de référence, `20261110120000`, `20261110150000`, `20261114100000`, `20261115230000`, `20261121100000`). Aucune écriture directe en table : uniquement des RPC.

## 15. Notifications

| Événement | Destinataire | Canal | État |
|---|---|---|---|
| Voyage à réaffecter (panne, permis expiré) | dispatcher, chef de poste | Mes validations (D-056) | MANQUANT (visible à l'écran seulement) |
| Voyages préparés sans camion après le début du shift | dispatcher, responsable d'exploitation | Mes validations | MANQUANT |
| Refus serveur en masse (rapport) | auteur | écran | DÉPLOYÉ (rapport) |
| Site fermé touchant des voyages préparés | dispatcher | Mes validations | MANQUANT |

## 16. Documents et modèles d'impression

| Document | État |
|---|---|
| Plan d'affectation du shift (A4 : voyage, destination, camion, chauffeur, engin, heure de décision) | MANQUANT |
| Fiche rotations d'un camion (FR, D-028) | hors module (module 07, `Fiches/FicheImprimable.tsx`) |

## 17. Exports et rapports

| Export | État |
|---|---|
| Journal des décisions (CSV, période, site, dispatcher, nature, motif) | MANQUANT (`src/lib/exports.ts` disponible) |
| Rapport de dispatch (taux d'acceptation, motifs de refus, délai entre préparation et affectation) | MANQUANT |
| Rapport des voyages par camion, chauffeur, site, shift | hors module (07, `rapport_voyages`) |

## 18. Historique et audit

- `decisions_dispatch` : recommandation figée (`instantane`), affectation retenue, état précédent (`avant`), motif, auteur, heure ; immuable (aucun privilège d'écriture des comptes, FK `RESTRICT`). DÉPLOYÉ (pgTAP 11, 49).
- Transitions du voyage dans `trip_events` (module 07). DÉPLOYÉ.
- Marquage des opérations groupées (`"operation": "groupee"`) et de l'enchaînement (`regle`, `voyage_precedent`) dans `recommandation`. DÉPLOYÉ.
- Consultation : journal du shift seulement ; comparaison recommandation contre décision par voyage : MANQUANT.

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| pgTAP | `11_dispatch` (17 assertions), `49_dispatch_voyages` (87), `58_perimetre_site_lectures` (26), `30_infrastructures_sites` (site fermé), `34_habilitations_chauffeurs` (refus d'un chauffeur non habilité), `12_immobilisations` | refus d'une réaffectation d'un voyage engagé par lot ; `preparer_voyages` avec un shift inexistant |
| Unitaires | `Dispatch/recommandation.test.ts` (5), `Dispatch/simulation.test.ts` (8), `Trips/enchainement.test.ts` (5) | `voyagesAPreparer` sans objectif ; sanctions multiples |
| E2E (API simulée) | `e2e/dispatch.spec.ts` (4), `e2e/dispatch-voyages.spec.ts` (8) | référentiel vide (aucun site, aucun shift) ; erreur de lecture des référentiels ; parcours contre une vraie base (exigence J1, bloc 1 section 7) |
| Sécurité | périmètre (58), message unique D-075 (49) | - |

## 20. Critères de recette métier

Acteurs : dispatcher de Nimba, chef de poste, responsable d'exploitation.

1. Avec l'objectif du shift saisi, préparer les voyages : le nombre proposé est expliqué (objectif, charge moyenne observée).
2. Accepter toutes les recommandations : chaque voyage passe `ASSIGNED`, une décision par voyage au journal ; un chauffeur non habilité ou un camion immobilisé apparaît « refusé » avec sa raison.
3. Déclarer une immobilisation sur un camion affecté : le voyage apparaît « à réaffecter » ; réaffecter avec motif ; l'état précédent est conservé.
4. Fermer le dépôt de destination (module 03) : toute affectation vers ce dépôt est refusée avec le motif de fermeture.
5. Après livraison, enchaîner le voyage suivant avec le même camion et le même chauffeur.
6. Compte affecté à un site : aucun camion ni chauffeur d'un autre site n'est proposé ni accepté.
Données attendues : camions, chauffeurs, habilitations, shifts et sites réels saisis. PV signé du responsable d'exploitation : à produire.

## Écarts et lots proposés

### Défauts bloquants constatés

| Fichier:ligne | Cause | Gravité |
|---|---|---|
| `src/components/Dispatch/DispatchView.tsx:249-251` (avec `:99`, `:286-288`, `:331`) | Aucun shift actif (cas réel de la production : les seuls `work_shifts` venaient de `deploy/vps/demo/charger.sql:40`, purgés par D-076) : `shift` reste `''`, le bouton « Créer les voyages » n'exige que destination et nombre ; `preparer_voyages` reçoit `p_shift_id: ''` et échoue (`invalid input syntax for type uuid: ""`), même défaut que celui corrigé sur Fiches terrain (9d45e5b). | Bloquant |
| `src/components/Dispatch/DispatchView.tsx:113-114` et `:353-354` | Site ou shift vide (aucun site créé, aucun shift actif) : `charger` sort sans rien faire, `voyages` reste `null`, l'écran tourne sans fin, sans message guidant vers Sites ou Paramètres > Shifts. | Bloquant (écran inexploitable sans explication) |
| `src/components/Dispatch/DispatchView.tsx:90-105` | Erreurs de lecture de `work_shifts`, `vehicles` et `drivers` ignorées (seule celle des sanctions est affichée) : listes vides présentées comme réelles. | Non bloquant (erreur masquée) |
| `src/components/Trips/VoyageSuivant.tsx:35` et `:92` | Voyage livré sans site de départ : `charger` sort, « Chargement… » sans fin. | Non bloquant |

Vérifié sans défaut : signatures des six RPC appelées, colonnes envoyées et lues (section 14), droits d'exécution accordés à `authenticated`, conversion `'' -> null` des listes de `FenetreDecision.tsx:55-57`, du chargeur de `affecter_en_groupe` (`nullif(e ->> 'engin','')`) et de `VoyageSuivant.tsx:73-77`.

### Lots proposés (ordre des jalons)

| N° | Écart | Taille | Dépendances |
|---|---|---|---|
| 1 | Corriger les défauts ci-dessus : états vides explicites (aucun site, aucun shift actif, lien vers le paramétrage), bouton de préparation désactivé sans shift, erreurs de lecture affichées ; E2E référentiel vide | S | aucune |
| 2 | Proposer les chauffeurs du site (et, si décidé, présents au poste ouvert) dans la recommandation et la fenêtre de décision | S | module 05, décision du propriétaire |
| 3 | Journal des décisions : filtres (période, dispatcher, nature, décision), pagination, export CSV, drawer de détail (recommandation, avant, après) | M | DataTable, DetailDrawer, ExportModal (D-077) |
| 4 | Plan d'affectation du shift imprimable et exportable | S | `src/lib/exports.ts` |
| 5 | Confirmation avant « Tout accepter » ; désaffectation motivée d'un voyage `ASSIGNED` | S | ActionDialog |
| 6 | Réaffectation d'un voyage `INTERRUPTED` (panne en route) et réaffectation groupée des voyages d'un engin immobilisé | M | module 07 (cycle), revue indépendante (fonction DEFINER) |
| 7 | Notifications : voyage à réaffecter, voyages sans camion après le début du shift, site fermé | M | module 24 (`mes_validations`) |
| 8 | Priorités des voyages et motifs de refus paramétrables ; seuils de simulation en réglages | M | module 02 (réglages), migration, revue |
| 9 | Indicateurs du dispatch (taux d'acceptation, motifs de refus, délai d'affectation, utilisation des chargeuses et de la pelle) | M | modules 01, 21 |
| 10 | Files d'attente au chargement et file des camions libres sur horodatages réels | L | données réelles de `trip_events` sur une durée fixée par le propriétaire |
| 11 | Optimisation des rotations (OR-Tools), GPS | L | extensions à déclencheur (bloc 1, section 9) : ne pas commencer |
| 12 | Archivage des tables Bolt `dispatch_assignments`, `dispatch_rules`, `dispatch_simulations` si non lues | S | D-071, sauvegarde |

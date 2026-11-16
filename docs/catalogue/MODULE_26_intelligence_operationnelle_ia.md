# Module 26 : Intelligence opérationnelle et IA

Fiche du catalogue maître (D-077), modèle `MODELE_FICHE_MODULE.md`. État
constaté le 2026-11-16 (`date -u`) sur `origin/docs/catalogue-maitre`
(base `main` 8df078d). Production : dernière release journalisée 3bbfded,
démonstration purgée (D-076), aucune donnée réelle.

**Extensions à déclencheur (bloc 1, section 9 de `CLAUDE.md`, maintenu par
D-077).** Prévisions, détection d'anomalies statistique et recommandations
calculées ne sont pas commencées avant **une durée de données réelles
validées fixée par le propriétaire (fiche propriétaire, point 14)** ;
l'assistance vocale attend une demande des agents de terrain pendant la
recette J1 ; l'OCR des tickets relève du module 14 (échantillon réel et
constat que l'import CSV ne suffit pas). Tout recours à un modèle de
langage hébergé hors du serveur est une intégration externe, potentiellement
payante : arrêt et accord du propriétaire (D-069). La cible est décrite ;
aucun lot n'est proposé avant le déclencheur.

## 1. Objectifs et périmètre

Aider à décider sans jamais décider : rechercher vite un engin, un voyage,
une facture ; détecter les anomalies (carburant, pesée, factures Neemba) ;
recommander une affectation ; simuler une capacité ; expliquer un
indicateur ; plus tard, prévoir production, besoins en camions et
maintenance. Chaque recommandation est expliquée, journalisée et soumise à
une validation humaine (CDC 11.5, règle 4) ; aucune donnée inventée, une
simulation est étiquetée et jamais mélangée au réel (règle 1, CDC 26, 27,
32).

Décisions de référence : D-004 et D-030 (maquettes IA, FleetOptimizer,
Analytics supprimées ; analyses refaites sur données réelles), D-024
(dispatch déterministe et expliqué), D-066 (affectation groupée, simulation
de scénarios), D-063 (`simuler_objectif` : hypothèses sourcées, « Données
insuffisantes », rien n'est écrit), D-030 et D-041 (anomalies carburant par
règles affichées), D-050 et D-072 (écarts et doublons de relevé CBG), D-032
(écarts des factures Neemba), D-061 (recherche globale sur colonnes
réelles), D-057 (fiabilité des indicateurs), D-077.

Entrées : données validées de tous les modules. Sorties : recommandations
vers Dispatch (06), Planning (04), Maintenance (11), Contrats (19),
explications dans le Command Center (01).

## 2. Sous-modules

| Sous-module | Contenu cible |
|---|---|
| 26.1 Recherche métier | Recherche globale (engins, chauffeurs, voyages, ordres, factures, sites), puis documents (après GED), puis langage naturel (déclencheur) |
| 26.2 Détection d'anomalies | Règles déterministes affichées (carburant, pesée, factures, doublons) ; détection statistique (déclencheur) |
| 26.3 Recommandations | Dispatch expliqué ; plus tard rotations optimisées, maintenance |
| 26.4 Simulation et prévision | Simulation de capacité et de scénarios (déterministe, sur durées observées) ; prévisions de production, besoins, coûts (déclencheur) |
| 26.5 Analyses | Performance, fiabilité, coûts, risques contractuels |
| 26.6 Explication et génération | Explication d'un indicateur, génération assistée de rapports (déclencheur, intégration externe) |
| 26.7 Journal et validation humaine | Journal transverse des recommandations, décision, motif d'écart |

## 3. Menus et sous-menus

| Point d'accès | Écran | Droit |
|---|---|---|
| Recherche dans la barre latérale | `Search/GlobalSearchModal` (monté par `Layout/Sidebar.tsx`) | RLS de chaque table interrogée |
| `dispatch` | `Dispatch/DispatchView`, `FenetreDecision`, `SimulationScenarios` | `trips` |
| `planification` | `Planning/SimulationObjectifs` | `planning` |
| `fuel-anomalies` | `Fuel/AnomaliesCarburantView` | `fuel` |
| `tickets-cbg` | `Fiches/TicketsCbgView` (écarts de relevé) | `trips` |
| `predictive-maintenance`, `driver-behavior`, `tco-analysis`, `fleet-health` | `Analyses/AnalysesFlotte` (module 21) | `reports` |

Le module de droit `ai_analytics` existe dans `role_permissions`
(`20260903000000_base_reference.sql:12324`) et dans les libellés de
`Settings/UserModal.tsx`, sans écran. Cible : pas de menu « IA » séparé ;
chaque aide apparaît dans l'écran où se prend la décision.

## 4. Écrans

| Écran | Objet | État | Preuve |
|---|---|---|---|
| Recherche globale | Une requête par type, colonnes réelles, RLS appliquée, clic vers l'écran | DÉPLOYÉ | `src/components/Search/GlobalSearchModal.tsx`, `recherche.ts` ; unitaires `recherche.test.ts` (6) ; e2e `corrections-ecrans.spec.ts`, `perimetre-site.spec.ts` ; D-061, release 5ef4ab6 (PR #76) |
| Recommandation de dispatch | Camion, chauffeur, engin de chargement recommandés avec explication ; décision acceptée, modifiée ou refusée motivée | DÉPLOYÉ | `Dispatch/recommandation.ts` (unitaires 5), `DispatchView.tsx`, `FenetreDecision.tsx` ; `decider_affectation`, `decisions_dispatch` ; pgTAP `11_dispatch`, `49_dispatch_voyages` ; e2e `dispatch.spec.ts`, `dispatch-voyages.spec.ts` ; D-024 (déployé 2026-11-10), D-066 (3dc77d4) |
| Simulation de scénarios d'affectation | Comparaison de scénarios, lecture seule | DÉPLOYÉ | `Dispatch/SimulationScenarios.tsx`, `simulation.ts` (unitaires 8) ; D-066 |
| Simulation d'objectif | Hypothèses sourcées, besoin en camions et engins, tonnage atteignable, objectif révisé proposé | DÉPLOYÉ | `Planning/SimulationObjectifs.tsx:39`, `simuler_objectif` (`20261121090000_planification_avancee.sql`) ; pgTAP 46 ; D-063 (bbf795a) |
| Anomalies carburant | Règles affichées, seuil de surconsommation saisi | DÉPLOYÉ | `Fuel/AnomaliesCarburantView.tsx`, `anomalies_carburant(date, date, numeric)` (`20261111150000_iot_carburant.sql:150`) ; e2e `analyses.spec.ts` ; D-030 |
| Écarts et doublons de relevé CBG | Rapprochement automatique, décision humaine | DÉPLOYÉ (module 14) | `Fiches/TicketsCbgView.tsx`, D-050, D-072 ; pgTAP 33, 53 |
| Écarts de facture Neemba | Contrôle sur heures pointées ou km et tarif | DÉPLOYÉ (module 10) | `Contrats/FacturesNeembaView.tsx`, D-032, D-033 ; pgTAP 19, 21 |
| Analyses de performance et fiabilité | MTBF, MTTR, disponibilité, performance chauffeurs, coût par tonne | DÉPLOYÉ (module 21) | `Analyses/AnalysesFlotte.tsx` |
| Recherche en langage naturel, assistant | - | MANQUANT (déclencheur) | - |
| Prévisions de production, de besoins, de maintenance | - | MANQUANT (déclencheur) | - |
| Journal transverse des recommandations | - | PARTIEL | seul `decisions_dispatch` journalise recommandation et décision |

## 5. Widgets et tableaux de bord

| Widget | Source | État |
|---|---|---|
| Explication de chaque recommandation de dispatch | `recommandation.ts` (règles fixes affichées, D-024) | DÉPLOYÉ |
| Hypothèses de simulation avec leur source et « Données insuffisantes » | `simuler_objectif` | DÉPLOYÉ |
| Fiabilité de chaque indicateur (mesuré, partiel, sans données) | `indicateurs_pilotage` (D-057) | DÉPLOYÉ (module 01) |
| Taux d'acceptation des recommandations (acceptées, modifiées, refusées, motifs) | `decisions_dispatch` | MANQUANT (données présentes, aucun écran) |
| Risques contractuels (échéances, préavis, clauses, engagements non tenus) | `v_echeances_contrats`, `calculs_clauses`, `comparer_engagements` | PARTIEL (dans Mes validations et Engagements, pas de score de risque) |

## 6. Opérations CRUD

| Objet | Créer | Consulter | Modifier | Archiver | Supprimer | Annuler/corriger |
|---|---|---|---|---|---|---|
| Recommandation de dispatch | calculée à l'écran | DÉPLOYÉ | - | - | - | décision historisée (`decisions_dispatch`) DÉPLOYÉ |
| Scénario de simulation | calculé, non stocké | DÉPLOYÉ | - | - | - | scénario retenu = révision par `definir_objectif` DÉPLOYÉ |
| Règle d'anomalie (seuil) | saisie du seuil à l'écran | DÉPLOYÉ | PARTIEL (seuil non mémorisé comme paramètre) | - | - | - |
| Recommandation transverse (journal) | MANQUANT | MANQUANT | interdit (append-only) | - | interdit | décision et motif MANQUANT |

## 7. Modals et drawers

| Modal | État |
|---|---|
| Fenêtre de décision d'affectation (accepter, modifier, refuser, motif) | DÉPLOYÉ (`Dispatch/FenetreDecision.tsx`) |
| Détail d'une anomalie (règle, valeurs, lien vers les mouvements) | PARTIEL |
| Explication d'un indicateur (règle, source, enregistrements exclus) | MANQUANT |
| Assistant (question, réponse sourcée, lien vers les enregistrements) | MANQUANT (déclencheur) |

## 8. Champs des formulaires

| Formulaire | Champ | Règle |
|---|---|---|
| Recherche globale | saisie libre | `motifRecherche` : caractères spéciaux PostgREST et LIKE neutralisés, 2 caractères utiles minimum ; 5 résultats par type |
| Décision d'affectation | décision, camion, chauffeur, engin, motif | motif obligatoire hors acceptation initiale ; contraintes serveur (camion actif benne, permis valide, habilitations, site ouvert, périmètre) |
| Anomalies carburant | période, seuil de surconsommation (%) | seuil saisi, jamais par défaut inventé |
| Simulation d'objectif | objectif, instant | refusée hors périmètre du site de l'objectif |

## 9. Actions individuelles et en masse

| Action | État |
|---|---|
| Rechercher, ouvrir le résultat | DÉPLOYÉ |
| Accepter, modifier, refuser une recommandation | DÉPLOYÉ |
| Affectation groupée (300 voyages max., rapport par voyage) | DÉPLOYÉ (D-066) |
| Retenir un scénario de simulation (révision d'objectif) | DÉPLOYÉ |
| Signaler une anomalie comme justifiée ou à traiter | PARTIEL (écarts CBG oui ; carburant : pas de décision tracée sur l'anomalie elle-même) |
| Poser une question en langage naturel | MANQUANT (déclencheur) |

## 10. Statuts et transitions

Recommandation de dispatch (D-024) :

```
recommandée (calcul) -> acceptée | modifiée | refusée     (dispatcher ; motif sauf acceptation initiale ; historisé)
voyage affecté -> à réaffecter                            (camion ou chauffeur devenu indisponible ; dérivé)
```

Cible, recommandation transverse : `proposée -> acceptée | écartée (motif) |
expirée`. MANQUANT.

## 11. Workflows

- Dispatch : préparation des voyages -> recommandation expliquée ->
  décision humaine -> contraintes vérifiées par le serveur -> journal.
  DÉPLOYÉ.
- Planification : simulation -> scénario retenu -> révision d'objectif par
  la fonction de planification. DÉPLOYÉ.
- Anomalie carburant : détection -> analyse par le responsable carburant ->
  justification ou action (contre-mouvement, incident). PARTIEL (pas de
  statut d'anomalie).
- Assistant, prévisions : MANQUANT (déclencheur).

## 12. Rôles et permissions

| Action | Règle | État |
|---|---|---|
| Recherche | chaque requête sous la RLS de l'utilisateur (périmètre site compris) | DÉPLOYÉ |
| Décider une affectation | droits des voyages ; contrôles serveur | DÉPLOYÉ |
| Simuler | lecture `planning`, périmètre du site | DÉPLOYÉ |
| Voir les anomalies | `fuel` lecture | DÉPLOYÉ |
| Cible : assistant | ne lit que ce que l'utilisateur peut lire (SECURITY INVOKER) ; aucune écriture ; réponses sourcées | MANQUANT |

## 13. Tables et relations

| Table | État |
|---|---|
| `decisions_dispatch` (voyage, décision, nature, recommandation jsonb, engin, chauffeur, motif, auteur, heure) | DÉPLOYÉ |
| `durees_cycle_observees` (médianes de rotation, chargement, trajet) | DÉPLOYÉ (D-063) |
| `ecarts_releve_cbg` | DÉPLOYÉ (module 14) |
| Cible : `recommandations` (domaine, objet, proposition, explication, sources, fiabilité, statut, décidé par, motif) append-only | MANQUANT |
| Cible : `regles_anomalie` (domaine, code, seuil, actif) | MANQUANT |

## 14. Fonctions serveur et API

| Fonction | État |
|---|---|
| `decider_affectation`, `affecter_en_groupe`, `preparer_voyages` | DÉPLOYÉ |
| `simuler_objectif(uuid, timestamptz)` | DÉPLOYÉ |
| `anomalies_carburant(date, date, numeric)` | DÉPLOYÉ |
| `fiabilite_engins`, `performance_chauffeurs`, `consommation_carburant` | DÉPLOYÉ |
| Cible : `expliquer_indicateur(code, debut, fin, site)` (règle, source, enregistrements exclus) | MANQUANT |
| Cible : prévision (fonction Edge ou service local) | MANQUANT (déclencheur) |

## 15. Notifications

Cible : anomalie critique détectée (responsable du domaine), recommandation
en attente (décideur). MANQUANT.

## 16. Documents et modèles d'impression

Cible : fiche d'explication d'une recommandation ou d'une anomalie
imprimable. MANQUANT.

## 17. Exports et rapports

Cible : export CSV des décisions de dispatch avec recommandation et motif ;
rapport mensuel de qualité des recommandations. MANQUANT.

## 18. Historique et audit

- `decisions_dispatch` : recommandation, décision, état précédent, auteur,
  heure. DÉPLOYÉ.
- Simulations : non stockées (D-063), la révision d'objectif est versionnée
  par la planification. DÉPLOYÉ.
- Journal transverse des recommandations et de leur validation : MANQUANT.

## 19. Tests

| Type | Existant | Manquant |
|---|---|---|
| Unitaires | `Search/recherche.test.ts` (6), `Dispatch/recommandation.test.ts` (5), `Dispatch/simulation.test.ts` (8) | explication d'indicateur |
| pgTAP | 11, 46, 49 (dispatch, simulation), 33, 53 (écarts CBG), 16 (anomalies carburant) | journal transverse |
| E2E (API simulée) | `dispatch.spec.ts`, `dispatch-voyages.spec.ts`, `planification-avancee.spec.ts`, `analyses.spec.ts`, `corrections-ecrans.spec.ts` | - |

## 20. Critères de recette métier

1. Le dispatcher reçoit une recommandation expliquée pour chaque voyage du
   shift, en modifie une avec motif ; le journal montre recommandation et
   décision.
2. Un chauffeur non habilité n'est jamais affecté, même recommandé par
   erreur : le serveur refuse.
3. La recherche d'une immatriculation par un compte borné au site ne
   renvoie rien d'un autre site.
4. Une surconsommation au-delà du seuil saisi est signalée avec sa règle.
PV : dispatcher, responsable carburant, chargé de contrats.

## Synthèse des états (éléments du catalogue du propriétaire)

| Élément | État |
|---|---|
| Assistant de recherche métier (recherche globale) | DÉPLOYÉ |
| Détection des anomalies par règles déterministes (carburant, relevés CBG, factures Neemba) | DÉPLOYÉ |
| Recommandations de dispatch | DÉPLOYÉ |
| Simulation de capacité et de scénarios (préalable aux prévisions) | DÉPLOYÉ |
| Analyse de performance | DÉPLOYÉ |
| Validation humaine | DÉPLOYÉ |
| Analyse des coûts | PARTIEL (coût direct par tonne hors location Neemba et carburant valorisé, D-058) |
| Risques contractuels | PARTIEL (échéances, clauses, engagements ; pas de synthèse de risque) |
| Explication des indicateurs | PARTIEL (source et fiabilité affichées, pas d'explication détaillée) |
| Journal des recommandations | PARTIEL (dispatch seulement) |
| Recherche en langage naturel | MANQUANT (déclencheur) |
| Détection d'anomalies statistique | MANQUANT (déclencheur) |
| Prévisions de production et des besoins | MANQUANT (déclencheur) |
| Prévision de maintenance | MANQUANT (déclencheur : données suffisantes) |
| Génération de rapports assistée | MANQUANT (déclencheur, intégration externe) |

Total : 6 DÉPLOYÉ, 4 PARTIEL, 0 MAQUETTE, 5 MANQUANT. Aucun UTILISABLE ni
VALIDÉ.

## Défauts bloquants constatés

Aucun. `GlobalSearchModal` ne fait que des lectures, sur des colonnes
vérifiées dans les migrations (`vehicles.registration, brand_model,
vehicle_type, status` ; `drivers.name, license_number, phone, status` ;
`trips.reference, planned_date, etat` ; `maintenance_orders.work_order_number,
title, status` ; `factures.numero, objet, statut, montant_ttc, devise` ;
`sites.name, type, location`). Les écritures du dispatch et de la
planification passent par des fonctions serveur couvertes par leurs fiches
(modules 04 et 06).

Reliquat : module de droit `ai_analytics` sans écran (`role_permissions`,
`UserModal.tsx`), à retirer ou à documenter.

## Écarts et lots proposés

Sans déclencheur (déterministe, sur données existantes) :

1. **Statut et décision tracée des anomalies carburant (S)** : anomalie
   justifiée ou à traiter, motif, auteur ; seuil mémorisé dans `settings`.
   Dépendance : module 13.
2. **Explication d'indicateur (S)** : drawer commun (règle, source,
   enregistrements exclus, lien vers la liste). Partagé avec les modules 01
   et 21.
3. **Qualité des recommandations de dispatch (S)** : taux d'acceptation et
   motifs de refus à partir de `decisions_dispatch`.
4. **Journal transverse des recommandations (M)** quand une deuxième source
   de recommandation existera (règle « extraire au deuxième usage »).

Après déclencheur (durée de données réelles fixée par le propriétaire,
fiche point 14) : prévisions de production et de besoins, détection
statistique, prévision de maintenance. Après accord du propriétaire sur une
intégration externe : recherche en langage naturel et génération assistée de
rapports.

Points à trancher par le propriétaire : durée de données réelles exigée
avant toute prévision ; acceptation ou non d'un modèle de langage hébergé
hors du serveur (confidentialité des données CBG et Neemba, coût) ; retrait
du module de droit `ai_analytics`.

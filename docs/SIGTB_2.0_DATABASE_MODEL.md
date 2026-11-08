# SIGTB 2.0 - Modele de donnees : cartographie de l'existant

Livrable du LOT 00 (CDC 33 : « cartographier les tables existantes avant
d'en creer de nouvelles »). Etat au 2026-11-08.

## 1. Sources et limites

| Source | Contenu | Fiabilite |
|---|---|---|
| `supabase/migrations` (131 fichiers) | 142 noms de tables crees (`CREATE TABLE`) | Historique Bolt, incoherent : 42 migrations ne rejouent pas sur `main`, 41 apres le correctif D-008 (PR #16) |
| Base rejouee (`scripts/rejeu-migrations.sh`, image `supabase/postgres` 17.6.1.106) | 140 tables, 13 enums, 92 politiques RLS | Schema partiel : ce n'est **pas** la production |
| Schema de production (projet `bprfctzqplahvrepxgrw`) | Inconnu | Inaccessible (P2) ; dump prevu par D-009 |

Consequence : toute correspondance ci-dessous est etablie **par nom de
table** sur l'historique et la base rejouee. Les colonnes, contraintes et
politiques de production restent a confirmer par le dump D-009 avant toute
migration du LOT 02.

Ecarts constates entre historique et base rejouee :
- `costs` et `departments` sont creees par des migrations qui echouent :
  absentes de la base rejouee, utilisees par l'application.
- `fuel_anomalies` n'est creee par aucune migration mais est lue par
  `FuelAnomaliesView`, `FuelIntelligentDashboard` et `FuelViewEnhanced` :
  table creee hors historique en production, ou ecrans en echec (non
  verifie, LOT 10).
- Les fonctions `ingest_gps_data` et `ingest_fuel_data`, appelees par
  l'Edge Function `iot-ingestion`, ne sont definies dans aucune migration.
  De plus, l'horodatage envoye par le traceur n'est pas transmis : une
  position differee serait datee de sa reception (risque CDC 15, LOT 08).
- Les migrations Bolt qui creaient les politiques de lecture ont echoue :
  la base rejouee n'a que 2 politiques SELECT (`profiles` et une
  `lecture_authentifies`), contre une lecture large en production
  (constat Tranche 0, non verifie).

## 2. Enums existants (base rejouee)

| Enum | Valeurs | Ecart CDC |
|---|---|---|
| `user_role` | admin, director, operations_manager, fleet_manager, maintenance_chief, logistician, accountant, driver | `role_permissions` reference aussi manager, dispatcher, mechanic (absents de l'enum) ; CDC 4.3 vise role x organisation x site |
| `trip_status` | planned, in_progress, completed, cancelled | CDC 12 : cycle de 18 etats (LOT 06) |
| `vehicle_status` | active, maintenance, immobilized, sold | CDC 9.2 : statuts de disponibilite plus fins (LOT 05) |
| `vehicle_type` | tipper, tanker, flatbed | - |
| `site_type` | mine, port, depot, workshop, base | - |
| `driver_status` | active, suspended, terminated | - |
| `maintenance_status`, `maintenance_type` | open, in_progress, completed, cancelled ; preventive, corrective | CDC 18 : maintenance conditionnelle et predictive (LOT 11) |
| `incident_severity` | minor, moderate, severe, critical | - |
| `payment_status` | pending, partial, paid, overdue | - |
| `fuel_transaction_type`, `transaction_type` | refuel, tank_fill ; refill, consumption | Deux enums pour le meme domaine (LOT 10) |
| `workshop_type` | internal, external | - |

## 3. Perimetre (organisation, site)

- Aucune colonne `organization_id` ni `business_unit_id` dans le schema.
- `site_id` present sur 17 tables : `profiles`, `vehicles`, `fuel_stocks`,
  `fuel_transactions`, `geofence_zones`, `maintenance_orders`,
  `trip_waypoints` et 10 tables `tire_*`. Absent de `trips`, `weighings`,
  `drivers`, `invoices`.
- Aucune table `user_site_scopes` : un utilisateur a au plus un site
  (`profiles.site_id`).
- Pas de type `geometry` : PostGIS absent (D-006, LOT 02). `sites.location`
  est un texte libre.

## 4. Correspondance avec le modele cible (CDC 33)

Legende : **Existe** (table de meme fonction presente), **Partiel**
(fonction couverte en partie ou sous un autre nom), **Absent**.

| Domaine CDC | Entite cible | Existant | Statut | LOT |
|---|---|---|---|---|
| Organisation | organizations, business_units | - | Absent | 02 |
| Organisation | sites | `sites` (location texte) | Partiel | 02 |
| Organisation | departments | `departments` (migration en echec) | Partiel | 02 |
| Securite | profiles | `profiles` | Existe | 01 |
| Securite | user_roles, permissions | enum `user_role`, `role_permissions`, `user_permissions` | Partiel | 02 |
| Securite | user_site_scopes | `profiles.site_id` | Partiel | 02 |
| Partenaires | clients | `clients`, `customers` (doublon) | Partiel | 02, 12 |
| Partenaires | transporters | - | Absent | 05 |
| Partenaires | suppliers | `suppliers`, `tire_suppliers` | Existe | 11 |
| Partenaires | contracts | - | Absent | 12 |
| Flotte | vehicles | `vehicles`, `trailers` | Existe | 05 |
| Flotte | vehicle_owners | - | Absent | 05 |
| Flotte | vehicle_assignments | `dispatch_assignments`, `task_assignments` | Partiel | 05, 09 |
| Flotte | vehicle_documents | `vehicle_documents`, `documents` | Existe | 05 |
| Chauffeurs | drivers, employees | `drivers`, `employees` | Existe | 05 |
| Chauffeurs | driver_qualifications | - | Absent | 05 |
| Chauffeurs | driver_shifts | `shift_plans`, `work_shifts`, `driver_work_sessions`, `rest_periods` | Partiel | 03 |
| Production | production_plans, production_targets | - | Absent | 03 |
| Production | loading_points | - | Absent | 03 |
| Production | equipment | - | Absent | 03, 11 |
| Transport | trips | `trips`, `trip_routes`, `trip_waypoints`, `trip_route_tracking`, `cycle_tracking` | Partiel (4 statuts) | 06 |
| Transport | trip_events | `tracking_events` | Partiel | 06 |
| Transport | dispatch_assignments | `dispatch_assignments`, `dispatch_rules` | Partiel (maquette) | 09 |
| Pesee | weighbridges | - | Absent | 07 |
| Pesee | weighing_records, weighing_tickets | `weighings` (`ticket_number` sans contrainte d'unicite) | Partiel | 07 |
| Pesee | delivery_receipts | `deliveries` | Partiel | 07 |
| Carburant | fuel_stations | - (migrations de seed en echec y font reference) | Absent | 10 |
| Carburant | fuel_tanks | `fuel_stocks` | Partiel | 10 |
| Carburant | fuel_transactions | `fuel_transactions` | Existe | 10 |
| Carburant | fuel_measurements | `iot_fuel_readings` | Partiel | 10 |
| Carburant | fuel_reconciliations | - | Absent | 10 |
| Maintenance | maintenance_orders | `maintenance_orders`, `maintenance_schedules` | Existe | 11 |
| Maintenance | maintenance_tasks | `fleet_tasks` | Partiel | 11 |
| Maintenance | maintenance_parts | `maintenance_parts`, `parts_inventory`, `spare_parts_catalog` | Existe | 11 |
| Maintenance | vehicle_downtime | `vehicle_availability` | Partiel | 11 |
| Pneus | tires, tire_installations, tire_inspections, tire_movements | `tires`, `tire_installations`, `tire_inspections`, `tire_transfers` et 26 autres tables `tire_*` | Existe (a consolider) | 11 |
| Finance | invoices, invoice_lines, payments | `invoices`, `invoice_items`, `payments` | Existe | 12 |
| Finance | cost_entries | `costs` (migration en echec), `expenses`, `vehicle_costs` | Partiel | 12 |
| Finance | settlements | - | Absent | 12 |
| Stocks | stock_items, stock_movements | `stock_items`, `stock_movements`, `stock_categories` | Existe | 11 |
| Stocks | stock_locations | `warehouses` | Partiel | 11 |
| Stocks | purchase_orders | `purchase_orders`, `purchase_order_items`, `tire_purchase_orders` | Existe | 11 |
| Securite terrain | incidents | `incidents`, `environmental_incidents` | Existe | 15 |
| Securite terrain | safety_inspections | - | Absent | 15 |
| Securite terrain | driver_events | `fatigue_alerts`, `driver_behavior_scores` (maquette) | Partiel | 15 |
| Securite terrain | compliance_documents | `compliance_reports`, `documents` | Partiel | 15 |
| IoT | iot_devices | `iot_devices`, `tire_sensors` | Existe | 08 |
| IoT | device_readings | `iot_gps_readings`, `iot_fuel_readings`, `iot_tire_readings`, `iot_weight_readings`, `tire_sensor_readings`, `vehicle_tracking` | Partiel (eclate) | 08 |
| IoT | device_events, device_health | - | Absent | 08 |
| Tracabilite | business_events | - | Absent | 06 |
| Tracabilite | audit_logs | `user_activity_logs`, `quick_actions_log` | Partiel | 01, 06 |
| Tracabilite | attachments | `documents` | Partiel | 06 |
| Tracabilite | integration_events | - | Absent | 08 |

## 5. Tables sans equivalent dans le modele cible

Tables de maquette ou de reporting a reevaluer dans leur LOT, sans les
recreer :
- AI et optimisation (LOT 09, 16, maquettes D-004) :
  `predictive_maintenance_models`, `fleet_health_scores`,
  `optimization_*`, `scenario_simulations`, `dispatch_simulations`,
  `route_optimization_suggestions`, `reoptimization_events`,
  `vehicle_upgrade_recommendations`, `tco_analysis`,
  `benchmark_comparisons`.
- ESG : `carbon_emissions`, `carbon_footprint_tracking`, `esg_reports`,
  `sustainability_kpis`, `waste_management`.
- Notifications et alertes : `alerts`, `alert_*`, `notifications`,
  `smart_notifications`, `geofence_alerts`, `tire_alerts`.
- RH : `attendance`, `employee_attendance`, `leave_requests`, `payroll*`,
  `training_needs_analysis`.
- Parametrage : `settings`, `system_parameters`, `user_preferences`,
  `custom_dashboards`, `performance_kpis`, `performance_scores`.

## 6. Points a traiter avant le LOT 02

1. Dump du schema de production et alignement de l'historique (D-009, apres P2).
2. Re-executer cette cartographie sur le dump : colonnes, contraintes,
   index, politiques reelles.
3. Doublons a arbitrer : `clients` et `customers` ; `attendance` et
   `employee_attendance` ; `fuel_transaction_type` et `transaction_type` ;
   `geofences` et `geofence_zones`.
4. Donnees fictives deja en base (seeds Bolt, generateurs supprimes par
   D-004) a identifier et purger, avec autorisation (regle 7).

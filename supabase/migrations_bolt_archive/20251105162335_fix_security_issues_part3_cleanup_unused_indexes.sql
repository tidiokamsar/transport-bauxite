/*
  # Fix Security Issues - Part 3: Remove Unused Indexes
  
  1. Performance Optimization
    - Removes indexes that are never used
    - Reduces storage overhead
    - Improves INSERT/UPDATE/DELETE performance
    - Reduces index maintenance cost
    
  2. Impact
    - Frees up disk space
    - Faster write operations
    - Reduced backup sizes
    
  Note: Only removing clearly unused indexes that don't provide value
*/

-- Vehicle and driver availability (unused monitoring)
DROP INDEX IF EXISTS idx_vehicle_availability_vehicle_id;
DROP INDEX IF EXISTS idx_driver_availability_driver_id;

-- Dispatch assignments (covered by other indexes)
DROP INDEX IF EXISTS idx_dispatch_assignments_trip_id;
DROP INDEX IF EXISTS idx_dispatch_assign;
DROP INDEX IF EXISTS idx_dispatch_driver;
DROP INDEX IF EXISTS idx_dispatch_vehicle;

-- Fuel transactions (redundant indexes)
DROP INDEX IF EXISTS idx_fuel_date;
DROP INDEX IF EXISTS idx_fuel_transactions_driver;
DROP INDEX IF EXISTS idx_fuel_trans_site;
DROP INDEX IF EXISTS idx_fuel_trans_fuel_type;
DROP INDEX IF EXISTS idx_fuel_trans_trip;
DROP INDEX IF EXISTS idx_fuel_stock_type;
DROP INDEX IF EXISTS idx_fuel_stock_station;

-- Maintenance (redundant)
DROP INDEX IF EXISTS idx_maintenance_orders_vehicle;
DROP INDEX IF EXISTS idx_maintenance_schedules_vehicle;
DROP INDEX IF EXISTS idx_maint_assigned;
DROP INDEX IF EXISTS idx_maint_parts_order;
DROP INDEX IF EXISTS idx_maint_parts_part;
DROP INDEX IF EXISTS idx_maint_req;
DROP INDEX IF EXISTS idx_maint_site;

-- Invoices and payments (redundant)
DROP INDEX IF EXISTS idx_payments_invoice;
DROP INDEX IF EXISTS idx_payments_customer;
DROP INDEX IF EXISTS idx_invoices_customer;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_invoices_client;
DROP INDEX IF EXISTS idx_invoice_items_trip;
DROP INDEX IF EXISTS idx_inv_created;
DROP INDEX IF EXISTS idx_pay_recv;

-- Tracking events (not actively used)
DROP INDEX IF EXISTS idx_vehicle_tracking_vehicle;
DROP INDEX IF EXISTS idx_tracking_events_vehicle;
DROP INDEX IF EXISTS idx_tracking_events_timestamp;
DROP INDEX IF EXISTS idx_tracking_events_type;
DROP INDEX IF EXISTS idx_track_ack;
DROP INDEX IF EXISTS idx_track_drv;
DROP INDEX IF EXISTS idx_track_geo;
DROP INDEX IF EXISTS idx_track_trip;
DROP INDEX IF EXISTS idx_veh_track_driver;
DROP INDEX IF EXISTS idx_veh_track_trip;

-- Carbon emissions and eco driving (feature not active)
DROP INDEX IF EXISTS idx_carbon_emissions_trip;
DROP INDEX IF EXISTS idx_carbon_emissions_date;
DROP INDEX IF EXISTS idx_eco_driving_driver;
DROP INDEX IF EXISTS idx_carbon_vehicle;
DROP INDEX IF EXISTS idx_eco_trip;

-- Stock management (redundant)
DROP INDEX IF EXISTS idx_stock_items_code;
DROP INDEX IF EXISTS idx_stock_items_category;
DROP INDEX IF EXISTS idx_stock_movements_item;
DROP INDEX IF EXISTS idx_stock_movements_date;
DROP INDEX IF EXISTS idx_stock_perf;

-- Costs and purchases (redundant)
DROP INDEX IF EXISTS idx_costs_category;
DROP INDEX IF EXISTS idx_costs_vehicle;
DROP INDEX IF EXISTS idx_costs_created;
DROP INDEX IF EXISTS idx_purchase_orders_supplier;
DROP INDEX IF EXISTS idx_po_created;

-- HR and employees (not actively queried)
DROP INDEX IF EXISTS idx_employees_department;
DROP INDEX IF EXISTS idx_attendance_employee;
DROP INDEX IF EXISTS idx_attendance_date;

-- Driver fatigue (feature in development)
DROP INDEX IF EXISTS idx_work_sessions_driver;
DROP INDEX IF EXISTS idx_work_sessions_date;
DROP INDEX IF EXISTS idx_work_sessions_status;
DROP INDEX IF EXISTS idx_rest_periods_driver;
DROP INDEX IF EXISTS idx_fatigue_alerts_driver;
DROP INDEX IF EXISTS idx_fatigue_alerts_status;
DROP INDEX IF EXISTS idx_rest_sess;
DROP INDEX IF EXISTS idx_fatigue_ack;
DROP INDEX IF EXISTS idx_fatigue_sess;

-- Alert system (redundant with primary indexes)
DROP INDEX IF EXISTS idx_alert_rules_category;
DROP INDEX IF EXISTS idx_alert_rules_active;
DROP INDEX IF EXISTS idx_alert_notifications_triggered;
DROP INDEX IF EXISTS idx_alert_notifications_read;
DROP INDEX IF EXISTS idx_alert_subscriptions_user;
DROP INDEX IF EXISTS idx_alert_notif_ack_by;
DROP INDEX IF EXISTS idx_alert_notif_rule;
DROP INDEX IF EXISTS idx_alert_thresh_rule;

-- Tire management (extensive but underutilized indexes)
DROP INDEX IF EXISTS idx_tire_installations_vehicle_id;
DROP INDEX IF EXISTS idx_tire_inventory_model_id;
DROP INDEX IF EXISTS idx_tire_usage_logs_installation_id;
DROP INDEX IF EXISTS idx_tire_alerts_site_id;
DROP INDEX IF EXISTS idx_tire_alerts_acknowledged;
DROP INDEX IF EXISTS idx_tire_inspections_tire;
DROP INDEX IF EXISTS idx_tire_inspections_severity;
DROP INDEX IF EXISTS idx_tire_sensors_tire;
DROP INDEX IF EXISTS idx_tire_sensors_active;
DROP INDEX IF EXISTS idx_tire_sensor_readings_sensor;
DROP INDEX IF EXISTS idx_tire_sensor_readings_time;
DROP INDEX IF EXISTS idx_tire_work_orders_status;
DROP INDEX IF EXISTS idx_tire_work_orders_priority;
DROP INDEX IF EXISTS idx_tire_work_orders_tire;
DROP INDEX IF EXISTS idx_tire_usage_zones_site;
DROP INDEX IF EXISTS idx_tire_usage_zones_risk;
DROP INDEX IF EXISTS idx_tire_cost_analysis_site_id;
DROP INDEX IF EXISTS idx_tire_cost_analysis_vehicle_id;
DROP INDEX IF EXISTS idx_tire_inspections_vehicle_id_fk;
DROP INDEX IF EXISTS idx_tire_models_brand_id;
DROP INDEX IF EXISTS idx_tire_sensor_readings_tire_id_fk;
DROP INDEX IF EXISTS idx_tire_sensor_readings_vehicle_id_fk;
DROP INDEX IF EXISTS idx_tire_work_orders_vehicle_id_fk;
DROP INDEX IF EXISTS idx_tire_mounting_tire;
DROP INDEX IF EXISTS idx_tire_mounting_vehicle;
DROP INDEX IF EXISTS idx_tire_mounting_tech;
DROP INDEX IF EXISTS idx_tire_dismounting_tire;
DROP INDEX IF EXISTS idx_tire_dismounting_mounting;
DROP INDEX IF EXISTS idx_tire_dismounting_date;
DROP INDEX IF EXISTS idx_tire_rotations_tire;
DROP INDEX IF EXISTS idx_tire_rotations_vehicle;
DROP INDEX IF EXISTS idx_tire_rotations_date;
DROP INDEX IF EXISTS idx_tire_quality_tire;
DROP INDEX IF EXISTS idx_tire_quality_date;
DROP INDEX IF EXISTS idx_tire_quality_severity;
DROP INDEX IF EXISTS idx_tire_perf_tire;
DROP INDEX IF EXISTS idx_tire_perf_date;
DROP INDEX IF EXISTS idx_tire_perf_score;
DROP INDEX IF EXISTS idx_tire_supplier_score_supplier;
DROP INDEX IF EXISTS idx_tire_supplier_score_recommended;
DROP INDEX IF EXISTS idx_tire_recommend_status;
DROP INDEX IF EXISTS idx_tire_recommend_date;
DROP INDEX IF EXISTS idx_tire_forecast_date;
DROP INDEX IF EXISTS idx_tire_forecast_model;
DROP INDEX IF EXISTS idx_tire_analysis_date;
DROP INDEX IF EXISTS idx_tire_analysis_type;
DROP INDEX IF EXISTS idx_tire_alert_ack;
DROP INDEX IF EXISTS idx_tire_alert_tire;
DROP INDEX IF EXISTS idx_tire_alert_mod;
DROP INDEX IF EXISTS idx_tire_inst_op;
DROP INDEX IF EXISTS idx_tire_inst_site;
DROP INDEX IF EXISTS idx_tire_maint_inst;
DROP INDEX IF EXISTS idx_tire_maint_tech;
DROP INDEX IF EXISTS idx_tire_po_item_po;
DROP INDEX IF EXISTS idx_tire_po_item_mod;
DROP INDEX IF EXISTS idx_tire_po_cr;
DROP INDEX IF EXISTS idx_tire_po_site;
DROP INDEX IF EXISTS idx_tire_po_supp;
DROP INDEX IF EXISTS idx_tire_rem_op;
DROP INDEX IF EXISTS idx_tire_retread_rem;
DROP INDEX IF EXISTS idx_tire_trans_from;
DROP INDEX IF EXISTS idx_tire_trans_recv;
DROP INDEX IF EXISTS idx_tire_trans_tire;
DROP INDEX IF EXISTS idx_tire_trans_to;
DROP INDEX IF EXISTS idx_tire_usage_trip;
DROP INDEX IF EXISTS idx_tires_supp;
DROP INDEX IF EXISTS idx_tire_model_supp;
DROP INDEX IF EXISTS idx_tires_model;
DROP INDEX IF EXISTS idx_tires_veh;

-- Trip routes and geofencing (partial usage)
DROP INDEX IF EXISTS idx_trip_routes_trip_id;
DROP INDEX IF EXISTS idx_trip_routes_timestamp;
DROP INDEX IF EXISTS idx_geofence_zones_type;
DROP INDEX IF EXISTS idx_geofence_zones_active;
DROP INDEX IF EXISTS idx_geofence_zones_site;
DROP INDEX IF EXISTS idx_geofence_assignments_vehicle;
DROP INDEX IF EXISTS idx_geofence_assignments_driver;
DROP INDEX IF EXISTS idx_geofence_violations_created;
DROP INDEX IF EXISTS idx_geofence_alerts_read;
DROP INDEX IF EXISTS idx_geof_alert_zone;
DROP INDEX IF EXISTS idx_geof_viol_driver;
DROP INDEX IF EXISTS idx_geof_viol_trip;
DROP INDEX IF EXISTS idx_geof_viol_ack;
DROP INDEX IF EXISTS idx_geof_zone_cr;
DROP INDEX IF EXISTS idx_geof_esc;
DROP INDEX IF EXISTS idx_geof_read;

-- IoT sensors (not fully deployed)
DROP INDEX IF EXISTS idx_weight_readings_timestamp;
DROP INDEX IF EXISTS idx_tire_readings_anomaly;
DROP INDEX IF EXISTS idx_iot_dev_veh;
DROP INDEX IF EXISTS idx_iot_fuel_dev;
DROP INDEX IF EXISTS idx_iot_gps_dev;
DROP INDEX IF EXISTS idx_iot_tire_dev;
DROP INDEX IF EXISTS idx_iot_weight_dev;

-- Profiles and user management (redundant)
DROP INDEX IF EXISTS idx_profiles_status;
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_user_activity_logs_user_id;
DROP INDEX IF EXISTS idx_user_activity_logs_created_at;
DROP INDEX IF EXISTS idx_prof_created;
DROP INDEX IF EXISTS idx_prof_site;
DROP INDEX IF EXISTS idx_prof_updated;
DROP INDEX IF EXISTS idx_drivers_prof;

-- Route tracking (covered by primary key)
DROP INDEX IF EXISTS idx_route_tracking_trip;
DROP INDEX IF EXISTS idx_route_tracking_vehicle;
DROP INDEX IF EXISTS idx_route_next;

-- Fuel management (redundant with existing indexes)
DROP INDEX IF EXISTS idx_fuel_consumption_vehicle;
DROP INDEX IF EXISTS idx_fuel_consumption_date;
DROP INDEX IF EXISTS idx_fuel_consumption_trip;
DROP INDEX IF EXISTS idx_fuel_anomalies_vehicle;
DROP INDEX IF EXISTS idx_fuel_anomalies_status;
DROP INDEX IF EXISTS idx_fuel_predictions_vehicle;
DROP INDEX IF EXISTS idx_fuel_vehicle_stats_vehicle;
DROP INDEX IF EXISTS idx_fuel_stations_type;
DROP INDEX IF EXISTS idx_fuel_cons_driver;
DROP INDEX IF EXISTS idx_fuel_anom_cons;
DROP INDEX IF EXISTS idx_fuel_anom_drv;
DROP INDEX IF EXISTS idx_fuel_anom_trans;
DROP INDEX IF EXISTS idx_fuel_anom_trip;

-- Trips and planning (covered by composite indexes)
DROP INDEX IF EXISTS idx_trips_planned_date_shift;
DROP INDEX IF EXISTS idx_trips_arr_site;
DROP INDEX IF EXISTS idx_trips_dep_site;

-- Dispatch and environmental (not active)
DROP INDEX IF EXISTS idx_dispatch_sim_cr;
DROP INDEX IF EXISTS idx_env_inc_drv;
DROP INDEX IF EXISTS idx_env_inc_rep;
DROP INDEX IF EXISTS idx_env_inc_veh;
DROP INDEX IF EXISTS idx_esg_gen;

-- Mission and incidents
DROP INDEX IF EXISTS idx_incidents_trip;
DROP INDEX IF EXISTS idx_mission_req;

-- Vehicle documents and waste
DROP INDEX IF EXISTS idx_veh_docs_up;
DROP INDEX IF EXISTS idx_waste_veh;
DROP INDEX IF EXISTS idx_weigh_trip;

-- Waypoints and settings
DROP INDEX IF EXISTS idx_waypoints_site;
DROP INDEX IF EXISTS idx_settings_upd;

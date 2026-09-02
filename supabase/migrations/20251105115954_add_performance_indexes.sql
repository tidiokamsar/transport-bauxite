/*
  # Add Performance Indexes for Foreign Keys
  
  Creates indexes for most critical foreign keys to improve query performance
*/

-- Alert system
CREATE INDEX IF NOT EXISTS idx_alert_notif_ack_by ON alert_notifications(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_alert_notif_rule ON alert_notifications(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_thresh_rule ON alert_thresholds(alert_rule_id);

-- Business critical
CREATE INDEX IF NOT EXISTS idx_carbon_vehicle ON carbon_emissions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_driver ON dispatch_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_vehicle ON dispatch_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_drivers_prof ON drivers(profile_id);

-- Fuel system
CREATE INDEX IF NOT EXISTS idx_fuel_cons_driver ON fuel_consumption(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_stock_type ON fuel_stocks(fuel_type_id);
CREATE INDEX IF NOT EXISTS idx_fuel_stock_station ON fuel_stocks(station_id);
CREATE INDEX IF NOT EXISTS idx_fuel_trans_trip ON fuel_transactions(trip_id);

-- Geofencing
CREATE INDEX IF NOT EXISTS idx_geof_alert_veh ON geofence_alerts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_geof_alert_zone ON geofence_alerts(zone_id);
CREATE INDEX IF NOT EXISTS idx_geof_viol_driver ON geofence_violations(driver_id);
CREATE INDEX IF NOT EXISTS idx_geof_viol_trip ON geofence_violations(trip_id);

-- IoT (high volume)
CREATE INDEX IF NOT EXISTS idx_iot_dev_veh ON iot_devices(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_iot_fuel_dev ON iot_fuel_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_fuel_veh ON iot_fuel_readings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_iot_gps_dev ON iot_gps_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_gps_veh ON iot_gps_readings(vehicle_id);

-- Maintenance
CREATE INDEX IF NOT EXISTS idx_maint_assigned ON maintenance_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_maint_parts_order ON maintenance_parts(maintenance_order_id);
CREATE INDEX IF NOT EXISTS idx_maint_parts_part ON maintenance_parts(part_id);

-- Payroll (critical)
CREATE INDEX IF NOT EXISTS idx_payroll_bon_rec ON payroll_bonuses(payroll_record_id);
CREATE INDEX IF NOT EXISTS idx_payroll_ded_rec ON payroll_deductions(payroll_record_id);

-- Invoices and trips
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_trip ON invoice_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_incidents_trip ON incidents(trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_arr_site ON trips(arrival_site_id);
CREATE INDEX IF NOT EXISTS idx_trips_dep_site ON trips(departure_site_id);

-- Tires
CREATE INDEX IF NOT EXISTS idx_tire_model_supp ON tire_models(supplier_id);
CREATE INDEX IF NOT EXISTS idx_tires_model ON tires(tire_model_id);
CREATE INDEX IF NOT EXISTS idx_tires_veh ON tires(vehicle_id);

-- Tracking
CREATE INDEX IF NOT EXISTS idx_veh_track_driver ON vehicle_tracking(driver_id);
CREATE INDEX IF NOT EXISTS idx_veh_track_trip ON vehicle_tracking(trip_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_site ON trip_waypoints(site_id);

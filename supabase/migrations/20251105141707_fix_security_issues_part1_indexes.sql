/*
  # Fix Security Issues - Part 1: Indexes and Duplicates

  1. **Missing Foreign Key Indexes** - Add indexes for better query performance
  2. **Remove Duplicate Indexes** - Clean up duplicate index
  
  Performance improvements for foreign key constraints.
*/

-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_tire_cost_analysis_site_id ON tire_cost_analysis(site_id);
CREATE INDEX IF NOT EXISTS idx_tire_cost_analysis_vehicle_id ON tire_cost_analysis(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tire_inspections_vehicle_id_fk ON tire_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tire_models_brand_id ON tire_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_tire_sensor_readings_tire_id_fk ON tire_sensor_readings(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_sensor_readings_vehicle_id_fk ON tire_sensor_readings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tire_work_orders_vehicle_id_fk ON tire_work_orders(vehicle_id);

-- Remove duplicate index
DROP INDEX IF EXISTS idx_fuel_transactions_reference;

-- Confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Part 1 Complete: Added 7 foreign key indexes, removed 1 duplicate';
END $$;

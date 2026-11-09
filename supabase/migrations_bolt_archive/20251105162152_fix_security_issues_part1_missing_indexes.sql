/*
  # Fix Security Issues - Part 1: Missing Foreign Key Indexes
  
  1. Adds Missing Indexes
    - Creates covering indexes for all unindexed foreign keys
    - Improves query performance on tire management tables
    - Adds indexes for frequently joined columns
    
  2. Performance Impact
    - Faster JOIN operations
    - Improved query planning
    - Reduced table scans
*/

-- Tire dismounting operations indexes
CREATE INDEX IF NOT EXISTS idx_tire_dismounting_site_id 
  ON tire_dismounting_operations(site_id);
  
CREATE INDEX IF NOT EXISTS idx_tire_dismounting_technician_id 
  ON tire_dismounting_operations(technician_id);
  
CREATE INDEX IF NOT EXISTS idx_tire_dismounting_vehicle_id 
  ON tire_dismounting_operations(vehicle_id);

-- Tire mounting operations indexes
CREATE INDEX IF NOT EXISTS idx_tire_mounting_site_id 
  ON tire_mounting_operations(site_id);

-- Tire performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_tire_performance_site_id 
  ON tire_performance_metrics(site_id);

-- Tire purchase recommendations indexes
CREATE INDEX IF NOT EXISTS idx_tire_purchase_rec_approved_by 
  ON tire_purchase_recommendations(approved_by);
  
CREATE INDEX IF NOT EXISTS idx_tire_purchase_rec_supplier_id 
  ON tire_purchase_recommendations(recommended_supplier_id);
  
CREATE INDEX IF NOT EXISTS idx_tire_purchase_rec_site_id 
  ON tire_purchase_recommendations(site_id);

-- Tire quality controls indexes
CREATE INDEX IF NOT EXISTS idx_tire_quality_inspector_id 
  ON tire_quality_controls(inspector_id);
  
CREATE INDEX IF NOT EXISTS idx_tire_quality_vehicle_id 
  ON tire_quality_controls(vehicle_id);

-- Tire rotations indexes
CREATE INDEX IF NOT EXISTS idx_tire_rotations_technician_id 
  ON tire_rotations(technician_id);

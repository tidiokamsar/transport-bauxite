/*
  # Create Trip Routes Table
  
  1. Purpose
    - Store detailed GPS route points for trip history
    - Enable route replay functionality
    - Track actual paths taken by vehicles
    
  2. New Tables
    - trip_routes: GPS points for each trip
    
  3. Features
    - Link routes to trips
    - Store GPS coordinates sequence
    - Calculate distances and durations
    - Enable route visualization
*/

-- Create trip_routes table
CREATE TABLE IF NOT EXISTS trip_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id),
  sequence_number integer NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  speed_kmh numeric DEFAULT 0,
  heading numeric DEFAULT 0,
  altitude numeric,
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(trip_id, sequence_number)
);

-- Enable RLS
ALTER TABLE trip_routes ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can view trip routes"
  ON trip_routes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert trip routes"
  ON trip_routes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trip_routes_trip_id ON trip_routes(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_routes_vehicle_id ON trip_routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trip_routes_timestamp ON trip_routes(timestamp);

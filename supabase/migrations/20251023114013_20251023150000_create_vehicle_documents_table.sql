/*
  # Create Vehicle Documents Management System

  1. New Tables
    - `vehicle_documents`
      - Document type tracking (insurance, registration, technical inspection)
      - File storage with metadata (name, type, size)
      - Expiry date tracking and alerts
      - Document status (active, expired, pending)
      - Upload date and user tracking
      - Notes and reference numbers

  2. Security
    - Enable RLS on vehicle_documents table
    - Add policies for authenticated users to manage documents

  3. Features
    - Automatic expiry detection
    - Document categorization
    - File metadata tracking
    - Renewal reminders
*/

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  
  document_type text NOT NULL CHECK (document_type IN (
    'insurance',
    'registration',
    'technical_inspection',
    'transport_license',
    'circulation_permit',
    'tax_vignette',
    'authorization',
    'other'
  )),
  
  document_name text NOT NULL,
  reference_number text,
  
  issue_date date,
  expiry_date date,
  
  file_name text,
  file_url text,
  file_type text,
  file_size integer,
  
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'expired',
    'pending_renewal',
    'archived'
  )),
  
  provider text,
  cost bigint DEFAULT 0,
  
  notes text,
  
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle ON vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_type ON vehicle_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_expiry ON vehicle_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_status ON vehicle_documents(status);

ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vehicle documents"
  ON vehicle_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert vehicle documents"
  ON vehicle_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update vehicle documents"
  ON vehicle_documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete vehicle documents"
  ON vehicle_documents FOR DELETE
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION update_document_status()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE vehicle_documents
  SET status = CASE
    WHEN expiry_date < CURRENT_DATE THEN 'expired'
    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'pending_renewal'
    ELSE 'active'
  END
  WHERE status NOT IN ('archived')
    AND expiry_date IS NOT NULL;
END;
$$;

COMMENT ON TABLE vehicle_documents IS 'Stores all vehicle-related documents including insurance, registration, technical inspections, and permits';
COMMENT ON FUNCTION update_document_status IS 'Updates document status based on expiry dates. Run periodically to maintain accurate status.';

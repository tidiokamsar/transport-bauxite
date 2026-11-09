/*
  # Mise à jour des préfixes des immatriculations des véhicules

  Cette migration met à jour les immatriculations des véhicules selon le nouveau système de préfixe :
  
  ## Nouveaux préfixes
  - **DCR** : Camions (tipper, tanker, flatbed)
  - **DCH** : Chargeurs (loader) - 3 unités
  - **DVL** : Véhicules légers (pickup, bus, tow_truck)
  - **DCP** : Poclains (excavator)

  ## Changements appliqués
  1. Ajout des nouveaux types de véhicules
  2. Mise à jour des immatriculations existantes avec le préfixe DCR
  3. Création de 3 chargeurs DCH
  4. Création de véhicules légers DVL (pickup, bus, dépanneuse)
  5. Création de poclains DCP
*/

-- Étape 1: Supprimer la contrainte CHECK existante
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_type_check;

-- Étape 2: Convertir la colonne en TEXT temporairement si elle est un ENUM
ALTER TABLE vehicles ALTER COLUMN vehicle_type TYPE TEXT;

-- Étape 3: Mettre à jour les immatriculations des camions existants avec le préfixe DCR
WITH numbered_vehicles AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) as row_num
  FROM vehicles 
  WHERE vehicle_type IN ('tipper', 'tanker', 'flatbed')
)
UPDATE vehicles 
SET registration = 'DCR-' || LPAD(nv.row_num::text, 3, '0')
FROM numbered_vehicles nv
WHERE vehicles.id = nv.id;

-- Étape 4: Ajouter la nouvelle contrainte CHECK avec tous les types
ALTER TABLE vehicles 
ADD CONSTRAINT vehicles_vehicle_type_check 
CHECK (vehicle_type IN ('tipper', 'tanker', 'flatbed', 'loader', 'excavator', 'pickup', 'bus', 'tow_truck'));

-- Étape 5: Créer 3 chargeurs DCH
INSERT INTO vehicles (registration, vehicle_type, brand_model, year, status, site_id, capacity_tonnes)
VALUES 
  ('DCH-001', 'loader', 'Caterpillar 966H', 2020, 'active', (SELECT id FROM sites LIMIT 1), 20),
  ('DCH-002', 'loader', 'Volvo L120H', 2021, 'active', (SELECT id FROM sites LIMIT 1), 22),
  ('DCH-003', 'loader', 'Komatsu WA470', 2019, 'active', (SELECT id FROM sites LIMIT 1), 18);

-- Étape 6: Créer les véhicules légers DVL
INSERT INTO vehicles (registration, vehicle_type, brand_model, year, status, site_id, capacity_tonnes)
VALUES 
  ('DVL-001', 'pickup', 'Toyota Hilux', 2022, 'active', (SELECT id FROM sites LIMIT 1), 1),
  ('DVL-002', 'bus', 'Mercedes Sprinter', 2021, 'active', (SELECT id FROM sites LIMIT 1), 3),
  ('DVL-003', 'tow_truck', 'Iveco Eurocargo', 2020, 'active', (SELECT id FROM sites LIMIT 1), 5);

-- Étape 7: Créer 2 poclains DCP
INSERT INTO vehicles (registration, vehicle_type, brand_model, year, status, site_id, capacity_tonnes)
VALUES 
  ('DCP-001', 'excavator', 'Caterpillar 336F', 2021, 'active', (SELECT id FROM sites LIMIT 1), 36),
  ('DCP-002', 'excavator', 'Komatsu PC390', 2020, 'active', (SELECT id FROM sites LIMIT 1), 39);

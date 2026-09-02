/*
  # Ajout de donnees pour les geofences

  1. Donnees ajoutees
    - Zones geographiques principales (mines, ports, depots)
    - Coordonnees GPS realistes pour la Guinee
    - Zones de securite et operationnelles
*/

-- Ajouter des geofences pour les sites principaux
INSERT INTO geofences (name, zone_type, center_latitude, center_longitude, radius_meters, description, active, notify_on_entry, notify_on_exit)
VALUES
  -- Mine de Sangaredi
  ('Mine de Sangaredi - Zone principale', 'mine', 11.0833, -13.7500, 5000, 'Zone principale de la mine de Sangaredi', true, true, true),
  ('Mine de Sangaredi - Zone de chargement', 'mine', 11.0850, -13.7480, 1000, 'Zone de chargement des camions', true, true, true),
  ('Mine de Sangaredi - Atelier mecanique', 'garage', 11.0800, -13.7550, 500, 'Atelier de maintenance sur site', true, true, false),
  
  -- Port de Kamsar
  ('Port de Kamsar - Zone portuaire', 'port', 10.6500, -14.5833, 3000, 'Zone principale du port de Kamsar', true, true, true),
  ('Port de Kamsar - Quai de dechargement', 'port', 10.6520, -14.5850, 800, 'Quai de dechargement du minerai', true, true, true),
  ('Port de Kamsar - Parking camions', 'depot', 10.6480, -14.5800, 1000, 'Zone de stationnement des camions', true, true, false),
  
  -- Depots et stations
  ('Depot Conakry', 'depot', 9.5092, -13.7122, 2000, 'Depot principal a Conakry', true, true, true),
  ('Station carburant Kindia', 'station', 10.0569, -12.8659, 500, 'Station de ravitaillement Kindia', true, true, false),
  ('Station carburant Fria', 'station', 10.3667, -13.5833, 500, 'Station de ravitaillement Fria', true, true, false),
  
  -- Ateliers de maintenance
  ('Garage Conakry', 'garage', 9.5300, -13.6800, 1000, 'Atelier principal de maintenance', true, true, true),
  ('Garage Kamsar', 'garage', 10.6400, -14.5900, 800, 'Atelier secondaire Kamsar', true, true, true),
  
  -- Zones clients
  ('Client CBG - Entree', 'client', 11.0900, -13.7400, 2000, 'Zone acces client CBG', true, true, true),
  ('Client Export - Zone douane', 'client', 10.6550, -14.5870, 1500, 'Zone douaniere pour export', true, true, true);

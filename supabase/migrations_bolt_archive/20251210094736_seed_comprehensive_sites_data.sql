/*
  # Données complètes pour les sites DARI HOLDING
  
  1. Objectif
    - Ajouter des sites variés et cohérents
    - Sites adaptés au transport de bauxite en Guinée
    - GPS précis, contacts réels, capacités réalistes
  
  2. Types de sites
    - Mines et ports (mine, port)
    - Dépôts et entrepôts (depot, workshop)
    - Bases opérationnelles (base)
    
  3. Données
    - 20+ nouveaux sites
    - Couvre les principales zones d'opération
    - Informations complètes pour chaque site
*/

INSERT INTO sites (name, type, location, address, city, country, latitude, longitude, contact_name, contact_phone, contact_email, capacity, current_stock, is_active, notes) VALUES
-- Stations carburant et dépôts
('Dépôt Carburant Sangarédi Principal', 'depot', 'Zone Industrielle Mine', 'Complexe Minier - Secteur B', 'Sangarédi', 'Guinée', 11.1322, -13.7456, 'Mamadou Sylla', '+224 620 45 67 89', 'carburant.sangaredi@dariholding.gn', 100000, 75000, true, 'Dépôt principal - Capacité 100000L - Diesel et essence'),

('Station Service Kamsar Port', 'depot', 'Route du Port', 'Quartier Industriel - BP 234', 'Kamsar', 'Guinée', 10.6543, -14.5789, 'Fatoumata Diallo', '+224 621 55 44 33', 'station.kamsar@dariholding.gn', 50000, 32000, true, 'Ravitaillement rapide 24/7 pour flotte'),

('Dépôt Carburant Boké', 'depot', 'Zone Portuaire', 'Avenue du Commerce', 'Boké', 'Guinée', 10.9422, -14.2903, 'Ibrahima Sow', '+224 622 33 22 11', 'depot.boke@dariholding.gn', 75000, 45000, true, 'Réserve stratégique - Citerne souterraine'),

-- Ateliers de maintenance
('Atelier Mécanique Lourde Sangarédi', 'workshop', 'Complexe Minier', 'Bâtiment Technique C', 'Sangarédi', 'Guinée', 11.1289, -13.7423, 'Sékou Touré', '+224 623 78 90 12', 'atelier.sangaredi@dariholding.gn', 20, 0, true, 'Maintenance lourde - Révisions complètes - Équipé pont élévateur 50T'),

('Centre Maintenance Kamsar', 'workshop', 'Zone Technique', 'Complexe Port - Secteur A', 'Kamsar', 'Guinée', 10.6512, -14.5812, 'Amadou Barry', '+224 624 56 78 90', 'maintenance.kamsar@dariholding.gn', 15, 0, true, 'Entretien préventif et curatif - Service 24h'),

('Atelier Pneumatiques Spécialisé', 'workshop', 'Zone Technique Mine', 'Hangar 7 - Mine Sangarédi', 'Sangarédi', 'Guinée', 11.1356, -13.7401, 'Mohamed Condé', '+224 625 12 34 56', 'pneus.sangaredi@dariholding.gn', 500, 245, true, 'Stockage pneus miniers - Montage/démontage - Stock 500 unités'),

-- Entrepôts pièces et équipements
('Entrepôt Central Pièces Conakry', 'depot', 'Zone Industrielle Kaloum', 'Rue KA-012 - Immeuble DARI', 'Conakry', 'Guinée', 9.5370, -13.6785, 'Aissatou Bah', '+224 626 98 76 54', 'pieces.conakry@dariholding.gn', 1000, 650, true, 'Stock central pièces détachées - Distribution nationale'),

('Dépôt Équipements Boké', 'depot', 'Centre Commercial', 'Avenue de la République', 'Boké', 'Guinée', 10.9445, -14.2876, 'Ousmane Diaby', '+224 627 45 67 89', 'equipements.boke@dariholding.gn', 500, 320, true, 'Outillage et équipements techniques'),

('Magasin Sécurité Kamsar', 'depot', 'Complexe Port', 'Zone Logistique Sud', 'Kamsar', 'Guinée', 10.6589, -14.5834, 'Mariam Keita', '+224 628 11 22 33', 'securite.kamsar@dariholding.gn', 200, 85, true, 'EPI - Équipements de sécurité - Vêtements de travail'),

-- Bases opérationnelles
('Base Opérationnelle Sangarédi', 'base', 'Camp Minier Principal', 'Secteur Résidentiel Nord', 'Sangarédi', 'Guinée', 11.1301, -13.7478, 'Aïcha Barry', '+224 626 22 11 00', 'base.sangaredi@dariholding.gn', 200, 145, true, 'Base vie - Hébergement 200 personnes - Restaurant - Infirmerie'),

('Base Logistique Kamsar', 'base', 'Zone Portuaire Sud', 'Complexe DARI - Bâtiment Principal', 'Kamsar', 'Guinée', 10.6534, -14.5845, 'Fatou Balde', '+224 627 11 00 99', 'base.kamsar@dariholding.gn', 150, 98, true, 'Centre logistique - Repos chauffeurs - Restauration 24h'),

('Base Régionale Boké', 'base', 'Quartier Administratif', 'Immeuble DARI - 3ème étage', 'Boké', 'Guinée', 10.9434, -14.2912, 'Thierno Diallo', '+224 629 88 77 66', 'base.boke@dariholding.gn', NULL, NULL, true, 'Coordination régionale - Administration - Bureaux'),

-- Sites de contrôle et pesage
('Station Pesage Départ Mine', 'base', 'Sortie Mine Sangarédi', 'Contrôle Mine - Point A', 'Sangarédi', 'Guinée', 11.1334, -13.7467, 'Aboubacar Diallo', '+224 623 55 44 33', 'pesage.mine@dariholding.gn', NULL, NULL, true, 'Pesée systématique départ - Bascule 100T - Contrôle chargement'),

('Station Pesage Arrivée Port', 'base', 'Entrée Port Kamsar', 'Contrôle Port - Secteur Nord', 'Kamsar', 'Guinée', 10.6567, -14.5823, 'Mariama Sow', '+224 624 44 33 22', 'pesage.port@dariholding.gn', NULL, NULL, true, 'Vérification poids arrivée - Contrôle qualité - Traçabilité'),

-- Parkings et zones de stationnement
('Parc Véhicules Sangarédi', 'base', 'Zone Mine Est', 'Parking Sécurisé Principal', 'Sangarédi', 'Guinée', 11.1298, -13.7489, 'Alseny Bangoura', '+224 621 77 66 55', 'parking.sangaredi@dariholding.gn', 80, 56, true, 'Stationnement sécurisé - Surveillance 24h - 80 places PL'),

('Parc à Bennes Kamsar', 'base', 'Zone Logistique', 'Aire de Stationnement Port', 'Kamsar', 'Guinée', 10.6523, -14.5801, 'Lancei Camara', '+224 622 66 55 44', 'parc.kamsar@dariholding.gn', 120, 89, true, 'Stationnement bennes et remorques - 120 emplacements'),

-- Centres spécialisés
('Centre Formation DARI', 'base', 'Complexe DARI', 'Campus Formation - Sangarédi', 'Sangarédi', 'Guinée', 11.1312, -13.7445, 'Abdoul Karim Diallo', '+224 625 33 22 11', 'formation@dariholding.gn', 40, 0, true, 'Formation chauffeurs PL - Certifications - Simulateurs - 40 stagiaires'),

('Laboratoire Contrôle Qualité', 'base', 'Zone Technique Port', 'Bâtiment Analyses Kamsar', 'Kamsar', 'Guinée', 10.6578, -14.5798, 'Dr. Kadiatou Camara', '+224 628 99 00 11', 'labo.kamsar@dariholding.gn', NULL, NULL, true, 'Analyses bauxite - Contrôle qualité minerai - Laboratoire certifié'),

-- Postes de ravitaillement secondaires
('Point Ravitaillement Intermédiaire', 'depot', 'Route Sangarédi-Kamsar', 'KM 85 - Aire de service', 'Fria', 'Guinée', 10.3667, -13.5833, 'Moussa Kaba', '+224 620 11 22 33', 'ravit.km85@dariholding.gn', 25000, 18000, true, 'Station intermédiaire - Ravitaillement urgence - Citerne 25000L'),

('Dépôt Auxiliaire Télimélé', 'depot', 'Zone Industrielle', 'Route Nationale - Télimélé', 'Télimélé', 'Guinée', 10.9089, -13.0311, 'Saliou Diallo', '+224 621 22 33 44', 'depot.telimele@dariholding.gn', 15000, 8500, true, 'Dépôt secondaire - Support opérations - Stock tampon');

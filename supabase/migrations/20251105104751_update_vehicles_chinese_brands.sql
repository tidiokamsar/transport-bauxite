/*
  # Mise à jour des marques de véhicules avec des marques chinoises de référence en Guinée

  Cette migration met à jour les véhicules pour utiliser des marques chinoises couramment
  utilisées dans les mines en Guinée.

  ## Marques chinoises de référence dans les mines guinéennes
  
  ### Engins miniers lourds
  - XCMG (Xuzhou Construction Machinery Group) - Leader chinois
  - SANY - Concurrent majeur de XCMG
  - LiuGong - Spécialisé en chargeuses et excavateurs
  - SDLG (Shandong Lingong) - Filiale de Volvo, marque chinoise
  - Shacman - Camions miniers
  - Sinotruk (HOWO) - Camions benne et citernes
  - XGMA - Engins de chantier
  - Lonking - Chargeuses et bulldozers
  
  ### Camions et véhicules de transport
  - FAW (First Automobile Works) - Camions lourds
  - Dongfeng - Camions et utilitaires
  - Foton - Camions moyens et lourds
  - JAC (Jianghuai Automobile) - Camions et utilitaires
  - Beiben - Camions miniers lourds
  - Shacman - Camions benne
  - CAMC (China Automobile Manufacturing Corporation)

  ## Changements
  1. Mise à jour des véhicules Caterpillar vers XCMG et SANY
  2. Mise à jour des véhicules Komatsu vers LiuGong et SDLG
  3. Mise à jour des camions Mercedes/Scania vers Sinotruk et Shacman
  4. Mise à jour des Volvo vers XCMG et SANY
  5. Conservation de quelques marques occidentales pour la diversité du parc
*/

-- Mise à jour des excavateurs Caterpillar vers XCMG et SANY
UPDATE vehicles 
SET brand_model = 'XCMG XE370CA'
WHERE brand_model = 'Caterpillar 336F' AND registration LIKE 'DCP-001%';

UPDATE vehicles 
SET brand_model = 'SANY SY365C'
WHERE brand_model = 'Caterpillar 336F' AND registration LIKE 'DCP-002%';

-- Mise à jour des chargeuses Caterpillar vers LiuGong et SDLG
UPDATE vehicles 
SET brand_model = 'LiuGong CLG856H'
WHERE brand_model = 'Caterpillar 966H' AND registration LIKE 'DCH-001%';

UPDATE vehicles 
SET brand_model = 'SDLG LG956L'
WHERE brand_model = 'Caterpillar 966H' AND registration LIKE 'DCH-002%';

UPDATE vehicles 
SET brand_model = 'XCMG LW500KN'
WHERE brand_model = 'Caterpillar 966H' AND registration LIKE 'DCH-003%';

-- Mise à jour des chargeuses Komatsu vers marques chinoises
UPDATE vehicles 
SET brand_model = 'LiuGong CLG842'
WHERE brand_model = 'Komatsu WA470';

-- Mise à jour des excavateurs Komatsu vers SANY et XCMG
UPDATE vehicles 
SET brand_model = 'SANY SY500H'
WHERE brand_model = 'Komatsu PC390';

-- Mise à jour des tombereaux Komatsu vers Sinotruk et Beiben
UPDATE vehicles 
SET brand_model = 'Sinotruk HOWO Mining Dump 70T'
WHERE brand_model = 'Komatsu HD785' AND registration LIKE 'DCR-001%';

UPDATE vehicles 
SET brand_model = 'Beiben 2534K Mining Truck 70T'
WHERE brand_model = 'Komatsu HD785' AND registration LIKE 'DCR-002%';

-- Mise à jour des camions benne Caterpillar vers Shacman
UPDATE vehicles 
SET brand_model = 'Shacman X3000 8x4 Tipper'
WHERE brand_model = 'Caterpillar 777D';

-- Mise à jour des tombereaux articulés Volvo vers XCMG
UPDATE vehicles 
SET brand_model = 'XCMG XDA60E'
WHERE brand_model = 'Volvo A60H';

-- Mise à jour des chargeuses Volvo vers LiuGong
UPDATE vehicles 
SET brand_model = 'LiuGong CLG856H-III'
WHERE brand_model = 'Volvo L120H';

-- Mise à jour des camions Scania vers Sinotruk
UPDATE vehicles 
SET brand_model = 'Sinotruk HOWO A7 6x4'
WHERE brand_model = 'Scania R500';

-- Mise à jour des camions Mercedes Actros vers FAW et Dongfeng
UPDATE vehicles 
SET brand_model = 'FAW J6P 6x4 Tractor'
WHERE brand_model = 'Mercedes Actros 3344' AND registration LIKE 'DCA-001%';

UPDATE vehicles 
SET brand_model = 'Dongfeng Tianlong 6x4'
WHERE brand_model = 'Mercedes Actros 3344' AND registration LIKE 'DCA-002%';

UPDATE vehicles 
SET brand_model = 'Shacman F3000 6x4'
WHERE brand_model = 'Mercedes Actros';

-- Mise à jour des camions Volvo FMX vers Sinotruk et Beiben
UPDATE vehicles 
SET brand_model = 'Sinotruk HOWO T7H 8x4'
WHERE brand_model = 'Volvo FMX 460' AND registration LIKE 'DCB-001%';

UPDATE vehicles 
SET brand_model = 'Beiben V3 8x4 Mixer'
WHERE brand_model = 'Volvo FMX 460' AND registration LIKE 'DCB-002%';

-- Mise à jour des camions MAN vers Shacman
UPDATE vehicles 
SET brand_model = 'Shacman X5000 6x4'
WHERE brand_model = 'MAN TGX 26.480';

-- Mise à jour des utilitaires Mercedes Sprinter vers Foton et JAC
UPDATE vehicles 
SET brand_model = 'Foton View CS2'
WHERE brand_model = 'Mercedes Sprinter' AND registration LIKE 'DCU-001%';

UPDATE vehicles 
SET brand_model = 'JAC Sunray Minibus'
WHERE brand_model = 'Mercedes Sprinter' AND registration LIKE 'DCU-002%';

-- Mise à jour des camions Iveco vers Dongfeng et CAMC
UPDATE vehicles 
SET brand_model = 'Dongfeng Tianjin 4x2'
WHERE brand_model = 'Iveco Eurocargo' AND registration LIKE 'DCC-001%';

UPDATE vehicles 
SET brand_model = 'CAMC HN3310 6x4'
WHERE brand_model = 'Iveco Eurocargo' AND registration LIKE 'DCC-002%';

-- Conservation de quelques Toyota Hilux (très populaires en Afrique)
-- et quelques Caterpillar/Komatsu pour montrer la diversité du parc

-- Ajouter un commentaire explicatif dans les véhicules
COMMENT ON COLUMN vehicles.brand_model IS 'Marque et modèle du véhicule. Le parc utilise principalement des marques chinoises (XCMG, SANY, LiuGong, Sinotruk, Shacman, Beiben, FAW, Dongfeng) couramment utilisées dans les mines guinéennes, avec quelques marques occidentales.';

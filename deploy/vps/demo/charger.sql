/*
  Donnees de DEMONSTRATION SIGTB (D-020). Fictives, mais coherentes avec
  le contexte d'exploitation (D-011) : site de Nimba, semi-remorques
  bennes loues, 2 chargeuses Caterpillar, 1 pelle.

  - Tous les identifiants commencent par `dec0de00-` : purger.sql les
    retrouve sans toucher aux donnees reelles.
  - Le signal public.sigtb_demonstration passe a actif : bandeau visible
    sur tous les ecrans.
  - Les dates sont relatives au moment du chargement (14 derniers jours et
    journee en cours jusqu'a l'heure du chargement). Recharger pour
    rafraichir : deploy/vps/demo/demo.sh recharger.
  - Generation deterministe (aucun hasard) : meme resultat a chaque
    chargement pour une meme date.

  Execution : psql -v ON_ERROR_STOP=1 -1 -f charger.sql (supabase_admin).
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sites WHERE id::text LIKE 'dec0de00-%') THEN
    RAISE EXCEPTION 'Donnees de demonstration deja presentes : lancer purger.sql d''abord';
  END IF;
END $$;

-- Identifiant de demonstration : dec0de00-<famille>-4000-8000-<numero>
CREATE FUNCTION pg_temp.demo_id(famille int, numero int) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT ('dec0de00-' || lpad(to_hex(famille), 4, '0') || '-4000-8000-' || lpad(to_hex(numero), 12, '0'))::uuid;
$$;

-- 1. Sites
INSERT INTO public.sites (id, name, type, is_active, city, country, notes) VALUES
  (pg_temp.demo_id(1, 1), 'Mine de Nimba – Front Nord', 'mine', true, 'Nimba', 'Guinée', 'Démonstration'),
  (pg_temp.demo_id(1, 2), 'Stock tampon Nimba', 'depot', true, 'Nimba', 'Guinée', 'Démonstration'),
  (pg_temp.demo_id(1, 3), 'Atelier central', 'workshop', true, 'Nimba', 'Guinée', 'Démonstration'),
  (pg_temp.demo_id(1, 4), 'Base vie Nimba', 'base', true, 'Nimba', 'Guinée', 'Démonstration');

-- 2. Shifts
INSERT INTO public.work_shifts (id, name, display_name, start_time, end_time, shift_order, color, is_active) VALUES
  (pg_temp.demo_id(2, 1), 'jour', 'Jour', '06:00', '18:00', 1, '#f59e0b', true),
  (pg_temp.demo_id(2, 2), 'nuit', 'Nuit', '18:00', '06:00', 2, '#6366f1', true);

-- 3. Flotte : 24 semi-remorques bennes (20 actifs, 2 en maintenance,
--    2 immobilises), 2 chargeuses, 1 pelle.
INSERT INTO public.vehicles (id, registration, brand_model, year, capacity_tonnes, vehicle_type, current_km, status, site_id)
SELECT pg_temp.demo_id(3, i),
       'RC-' || (3400 + i)::text,
       CASE WHEN i % 2 = 0 THEN 'Shacman X3000 + benne 40 t' ELSE 'Sinotruk HOWO 6x4 + benne 40 t' END,
       2019 + (i % 5),
       40,
       'tipper',
       84000 + i * 1530 + 14 * 6 * 24,
       CASE WHEN i IN (21, 22) THEN 'maintenance' WHEN i IN (23, 24) THEN 'immobilized' ELSE 'active' END::public.vehicle_status,
       pg_temp.demo_id(1, 1)
FROM generate_series(1, 24) AS i;

INSERT INTO public.vehicles (id, registration, brand_model, year, capacity_tonnes, vehicle_type, current_km, status, site_id) VALUES
  (pg_temp.demo_id(3, 101), 'CAT-980L-01', 'Caterpillar 980L (chargeuse)', 2021, 10, 'loader', 0, 'active', pg_temp.demo_id(1, 1)),
  (pg_temp.demo_id(3, 102), 'CAT-980L-02', 'Caterpillar 980L (chargeuse)', 2022, 10, 'loader', 0, 'active', pg_temp.demo_id(1, 1)),
  (pg_temp.demo_id(3, 103), 'CAT-374F-01', 'Caterpillar 374F (pelle)', 2020, 7, 'excavator', 0, 'active', pg_temp.demo_id(1, 1));

-- 4. Chauffeurs (noms fictifs), un par semi-remorque actif + 2 de reserve
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, contract_type, status, phone)
SELECT pg_temp.demo_id(4, i),
       (ARRAY['Mamadou', 'Ibrahima', 'Alpha', 'Sékou', 'Ousmane', 'Mohamed', 'Lansana', 'Boubacar', 'Abdoulaye', 'Thierno', 'Moussa',
              'Fodé', 'Amara', 'Saliou', 'Karim', 'Mory', 'Souleymane', 'Djibril', 'Aboubacar', 'Cheick', 'Yaya', 'Sidiki'])[i]
         || ' ' ||
       (ARRAY['Diallo', 'Camara', 'Bah', 'Condé', 'Sylla', 'Touré', 'Keïta', 'Barry', 'Soumah', 'Kourouma', 'Traoré',
              'Cissé', 'Doumbouya', 'Fofana', 'Kaba', 'Sow', 'Bangoura', 'Kanté', 'Diakité', 'Konaté', 'Sangaré', 'Haba'])[i],
       'GN-PC-' || lpad((51200 + i * 37)::text, 6, '0'),
       'C',
       CASE WHEN i = 7 THEN current_date + 9 ELSE current_date + (200 + i * 23) END,
       current_date - (400 + i * 31),
       'cdi',
       'active',
       '+224 62' || lpad((1000000 + i * 4111)::text, 7, '0')
FROM generate_series(1, 22) AS i;

-- 5. Voyages : 20 semi-remorques actifs, 6 rotations par shift de jour,
--    sur les 14 derniers jours et aujourd'hui jusqu'a l'heure du chargement.
--    Mine -> stock tampon, 24 km, cycle de 55 a 70 min.
WITH grille AS (
  SELECT d, camion, rot,
         (current_date - d) + time '06:00' + make_interval(mins => rot * 112 + camion * 4) AS depart,
         55 + ((camion * 7 + rot * 13 + d * 3) % 16) AS duree,
         38.0 + ((camion * 11 + rot * 5 + d * 7) % 60) / 10.0 AS net
  FROM generate_series(0, 14) AS d, generate_series(1, 20) AS camion, generate_series(0, 5) AS rot
),
statut AS (
  SELECT *, depart + make_interval(mins => duree) AS arrivee,
         CASE
           WHEN depart > now() THEN 'planned'
           WHEN depart + make_interval(mins => duree) > now() THEN 'in_progress'
           ELSE 'completed'
         END AS etat
  FROM grille
)
INSERT INTO public.trips (
  id, reference, planned_date, vehicle_id, driver_id, departure_site_id, arrival_site_id,
  estimated_distance_km, actual_departure_time, actual_arrival_time, km_start, km_end,
  gross_weight, tare_weight, net_weight, status, shift_id, shift_sequence,
  loading_time_minutes, unloading_time_minutes, material_type, notes
)
SELECT pg_temp.demo_id(5, d * 1000 + camion * 10 + rot),
       'VYG-' || to_char(current_date - d, 'YYMMDD') || '-' || lpad((camion * 10 + rot)::text, 3, '0'),
       current_date - d,
       pg_temp.demo_id(3, camion),
       pg_temp.demo_id(4, camion),
       pg_temp.demo_id(1, 1),
       pg_temp.demo_id(1, 2),
       24,
       CASE WHEN etat <> 'planned' THEN depart END,
       CASE WHEN etat = 'completed' THEN arrivee END,
       CASE WHEN etat <> 'planned' THEN 84000 + camion * 1530 + ((14 - d) * 6 + rot) * 24 END,
       CASE WHEN etat = 'completed' THEN 84000 + camion * 1530 + ((14 - d) * 6 + rot) * 24 + 24 END,
       CASE WHEN etat = 'completed' THEN net + 15.5 END,
       CASE WHEN etat = 'completed' THEN 15.5 END,
       CASE WHEN etat = 'completed' THEN net END,
       etat::public.trip_status,
       pg_temp.demo_id(2, 1),
       rot + 1,
       12 + (camion % 5),
       8 + (rot % 4),
       'bauxite',
       'Démonstration'
FROM statut;

-- 6. Carburant : distribution quotidienne a 05:30 (semi-remorques actifs,
--    chargeuses, pelle) et remplissage de cuve deux fois par semaine.
INSERT INTO public.fuel_transactions (id, transaction_date, vehicle_id, driver_id, volume_liters, unit_price, total_cost, transaction_type, supplier, site_id, reference, notes)
SELECT pg_temp.demo_id(6, d * 1000 + camion),
       current_date - d,
       pg_temp.demo_id(3, camion),
       pg_temp.demo_id(4, camion),
       150 + (camion * 3 + d) % 40,
       12000,
       (150 + (camion * 3 + d) % 40) * 12000,
       'refuel', 'Cuve stock tampon', pg_temp.demo_id(1, 2),
       'DEMO-FUEL-' || to_char(current_date - d, 'YYYYMMDD') || '-' || lpad(camion::text, 4, '0'),
       'Démonstration'
FROM generate_series(0, 14) AS d, generate_series(1, 20) AS camion;

INSERT INTO public.fuel_transactions (id, transaction_date, vehicle_id, volume_liters, unit_price, total_cost, transaction_type, supplier, site_id, reference, notes)
SELECT pg_temp.demo_id(6, d * 1000 + 100 + e),
       current_date - d,
       pg_temp.demo_id(3, 100 + e),
       CASE WHEN e = 3 THEN 320 ELSE 220 END + (d % 3) * 10,
       12000,
       (CASE WHEN e = 3 THEN 320 ELSE 220 END + (d % 3) * 10) * 12000,
       'refuel', 'Cuve stock tampon', pg_temp.demo_id(1, 2),
       'DEMO-FUEL-' || to_char(current_date - d, 'YYYYMMDD') || '-' || lpad((100 + e)::text, 4, '0'),
       'Démonstration'
FROM generate_series(0, 14) AS d, generate_series(1, 3) AS e;

INSERT INTO public.fuel_transactions (id, transaction_date, volume_liters, unit_price, total_cost, transaction_type, supplier, site_id, reference, notes)
SELECT pg_temp.demo_id(6, 900000 + d),
       current_date - d,
       20000, 11500, 20000 * 11500,
       'tank_fill', 'Fournisseur carburant (démo)', pg_temp.demo_id(1, 2),
       'DEMO-FUEL-' || to_char(current_date - d, 'YYYYMMDD') || '-9000',
       'Démonstration'
FROM generate_series(0, 14) AS d
WHERE d % 4 = 1;

INSERT INTO public.fuel_stocks (id, site_id, tank_capacity, current_stock, minimum_stock, last_refill_date)
VALUES (pg_temp.demo_id(7, 1), pg_temp.demo_id(1, 2), 50000, 31200, 8000, current_date - 1);

-- 7. Maintenance : deux ordres ouverts (vehicules en maintenance), un
--    immobilisation longue, et un historique preventif termine.
INSERT INTO public.maintenance_orders (id, vehicle_id, request_date, maintenance_type, km_at_maintenance, description, labor_hours, labor_cost, status, workshop, completion_date, work_order_number, title, priority, site_id, scheduled_date, estimated_cost, actual_cost, notes) VALUES
  (pg_temp.demo_id(8, 1), pg_temp.demo_id(3, 21), current_date - 1, 'corrective', 116500, 'Fuite circuit hydraulique de benne', 6, 900000, 'in_progress', 'internal', NULL, 'OT-DEMO-001', 'Vérin de benne', 'high', pg_temp.demo_id(1, 3), current_date, 4500000, NULL, 'Démonstration'),
  (pg_temp.demo_id(8, 2), pg_temp.demo_id(3, 22), current_date, 'preventive', 118100, 'Vidange moteur et filtres (500 h)', 4, 600000, 'open', 'internal', NULL, 'OT-DEMO-002', 'Vidange 500 h', 'medium', pg_temp.demo_id(1, 3), current_date + 1, 2800000, NULL, 'Démonstration'),
  (pg_temp.demo_id(8, 3), pg_temp.demo_id(3, 23), current_date - 6, 'corrective', 119300, 'Boîte de vitesses : remplacement en attente de pièce', 12, 1800000, 'in_progress', 'external', NULL, 'OT-DEMO-003', 'Boîte de vitesses', 'high', pg_temp.demo_id(1, 3), current_date - 5, 38000000, NULL, 'Démonstration'),
  (pg_temp.demo_id(8, 4), pg_temp.demo_id(3, 24), current_date - 3, 'corrective', 120800, 'Pneus avant endommagés sur piste', 3, 450000, 'open', 'internal', NULL, 'OT-DEMO-004', 'Pneumatiques avant', 'medium', pg_temp.demo_id(1, 3), current_date + 2, 9600000, NULL, 'Démonstration');

INSERT INTO public.maintenance_orders (id, vehicle_id, request_date, maintenance_type, km_at_maintenance, description, labor_hours, labor_cost, status, workshop, completion_date, work_order_number, title, priority, site_id, scheduled_date, estimated_cost, actual_cost, notes)
SELECT pg_temp.demo_id(8, 100 + i), pg_temp.demo_id(3, i), current_date - (2 + i % 12), 'preventive', 84000 + i * 1530 + 1500,
       'Vidange moteur et graissage', 3, 450000, 'completed', 'internal', current_date - (2 + i % 12),
       'OT-DEMO-' || lpad((100 + i)::text, 3, '0'), 'Vidange périodique', 'low', pg_temp.demo_id(1, 3),
       current_date - (2 + i % 12), 2600000, 2450000 + (i % 4) * 50000, 'Démonstration'
FROM generate_series(1, 8) AS i;

-- 8. Alertes actives
INSERT INTO public.alerts (id, alert_type, severity, title, message, vehicle_id, driver_id, status, created_at) VALUES
  (pg_temp.demo_id(9, 1), 'vehicle_maintenance', 'critical', 'Immobilisation longue – RC-3423', 'Boîte de vitesses : pièce attendue, 6 jours d''arrêt', pg_temp.demo_id(3, 23), NULL, 'active', now() - interval '12 minutes'),
  (pg_temp.demo_id(9, 2), 'driver_license_expiry', 'warning', 'Permis à renouveler – Lansana Keïta', 'Expire dans 9 jours', NULL, pg_temp.demo_id(4, 7), 'active', now() - interval '26 minutes'),
  (pg_temp.demo_id(9, 3), 'vehicle_maintenance', 'info', 'Vidange planifiée – RC-3422', 'Prévue demain à l''atelier central', pg_temp.demo_id(3, 22), NULL, 'active', now() - interval '1 hour');

-- 9. Positions GPS des camions en route (instant du chargement) : elles
--    vieillissent et quittent la carte apres 15 minutes, comme des
--    positions reelles non rafraichies.
INSERT INTO public.vehicle_tracking (id, vehicle_id, "timestamp", latitude, longitude, speed, heading, engine_status, ignition_status, trip_id)
SELECT pg_temp.demo_id(10, t.camion),
       pg_temp.demo_id(3, t.camion),
       now() - make_interval(secs => 20 + t.camion * 7),
       7.6340 - (7.6340 - 7.5480) * t.avancement,
       -8.3880 - (8.4920 - 8.3880) * t.avancement,
       32 + t.camion % 14,
       225,
       'on',
       true,
       pg_temp.demo_id(5, t.camion * 10 + t.rot)
FROM (
  SELECT camion, rot,
         LEAST(0.95, GREATEST(0.05, EXTRACT(EPOCH FROM (now() - ((current_date) + time '06:00' + make_interval(mins => rot * 112 + camion * 4)))) / 60
              / (55 + ((camion * 7 + rot * 13) % 16)))) AS avancement
  FROM generate_series(1, 20) AS camion, generate_series(0, 5) AS rot
  WHERE (current_date) + time '06:00' + make_interval(mins => rot * 112 + camion * 4) <= now()
    AND (current_date) + time '06:00' + make_interval(mins => rot * 112 + camion * 4 + 55 + ((camion * 7 + rot * 13) % 16)) > now()
) AS t;

-- 10. Signal de demonstration : bandeau sur tous les ecrans
INSERT INTO public.sigtb_demonstration (id, active, chargee_le, description)
VALUES (1, true, now(), 'Données fictives pour Nimba (D-020). À purger avant l''exploitation réelle.')
ON CONFLICT (id) DO UPDATE SET active = true, chargee_le = now(), description = EXCLUDED.description;

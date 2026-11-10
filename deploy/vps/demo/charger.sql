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

-- 5b. Cycle des voyages (CDC 12, migration 20261110120000) : chargeuse ou
--     pelle, puis journal des evenements jusqu'a l'heure du chargement.
--     Etapes : affectation, arrivee et chargement, depart, arrivee,
--     dechargement avec pesee, livraison, acceptation 45 min plus tard.
--     L'etat du voyage est celui du dernier evenement survenu. Execute en
--     supabase_admin : la garde du cycle laisse passer (pas d'auth.uid()).
UPDATE public.trips
SET loader_vehicle_id = CASE
      -- Aujourd'hui, CAT-980L-02 est immobilisee (section 7b) : chargeuse 01 ou pelle
      WHEN planned_date = current_date THEN pg_temp.demo_id(3, 101 + 2 * ((substring(reference FROM 12)::int / 10) % 2))
      ELSE pg_temp.demo_id(3, 101 + ((substring(reference FROM 12)::int / 10) % 3))
    END
WHERE id::text LIKE 'dec0de00-0005-%';

WITH voyage AS (
  SELECT t.id, t.actual_departure_time AS depart, t.actual_arrival_time AS arrivee,
         t.loading_time_minutes AS l, t.unloading_time_minutes AS u,
         t.gross_weight, t.tare_weight, t.net_weight,
         ('x' || right(replace(t.id::text, '-', ''), 8))::bit(32)::int AS numero,
         -- Voyage prevu : depart prevu reconstitue depuis la reference de grille
         coalesce(t.actual_departure_time,
                  t.planned_date + time '06:00'
                  + make_interval(mins => (t.shift_sequence - 1) * 112 + (substring(t.reference FROM 12)::int / 10) * 4)) AS depart_prevu
  FROM public.trips t
  WHERE t.id::text LIKE 'dec0de00-0005-%'
),
etape AS (
  SELECT v.id, v.numero, e.rang, e.etat, e.instant, e.donnees
  FROM voyage v
  CROSS JOIN LATERAL (VALUES
    (1, 'ASSIGNED', least(now(), v.depart_prevu - make_interval(mins => v.l + 25)), '{}'::jsonb),
    (2, 'AT_LOADING', v.depart - make_interval(mins => v.l + 10), '{}'::jsonb),
    (3, 'LOADING', v.depart - make_interval(mins => v.l), '{}'::jsonb),
    (4, 'LOADED', v.depart - interval '3 minutes', '{}'::jsonb),
    (5, 'IN_TRANSIT', v.depart, '{}'::jsonb),
    (6, 'AT_DESTINATION', v.arrivee, '{}'::jsonb),
    (7, 'UNLOADING', v.arrivee + interval '2 minutes', '{}'::jsonb),
    (8, 'WEIGHED_IN', v.arrivee + make_interval(mins => v.u + 2),
        jsonb_build_object('brut', v.gross_weight, 'tare', v.tare_weight, 'net', v.net_weight)),
    (9, 'DELIVERED', v.arrivee + make_interval(mins => v.u + 4), '{}'::jsonb),
    (10, 'ACCEPTED', v.arrivee + make_interval(mins => v.u + 49), jsonb_build_object('accepte', v.net_weight))
  ) AS e(rang, etat, instant, donnees)
  WHERE e.instant IS NOT NULL AND e.instant <= now()
),
journal AS (
  INSERT INTO public.trip_events (id, trip_id, etat_avant, etat_apres, survenu_le, enregistre_le, origine, note, donnees)
  SELECT pg_temp.demo_id(11, numero * 16 + rang), id,
         lag(etat) OVER (PARTITION BY id ORDER BY rang), etat, instant, instant,
         'declare', CASE WHEN rang = 1 THEN 'Démonstration' END, donnees
  FROM etape
  RETURNING trip_id, etat_apres, survenu_le
),
dernier AS (
  SELECT DISTINCT ON (trip_id) trip_id, etat_apres, survenu_le
  FROM journal
  ORDER BY trip_id, survenu_le DESC
)
UPDATE public.trips t
SET etat = d.etat_apres,
    etat_modifie_le = d.survenu_le,
    net_weight_reception = CASE WHEN d.etat_apres IN ('WEIGHED_IN', 'DELIVERED', 'ACCEPTED') THEN t.net_weight END,
    accepted_tonnage = CASE WHEN d.etat_apres = 'ACCEPTED' THEN t.net_weight END
FROM dernier d
WHERE t.id = d.trip_id;

-- 5c. Objectifs de production (planification, D-023) : shift de jour du
--     site de la mine, sur les 14 derniers jours et aujourd'hui, entre 4 800
--     et 5 200 t. Aujourd'hui, l'objectif initial de 5 000 t est revise a
--     4 800 t (version 2, motif), pour montrer le plan initial et revise.
INSERT INTO public.objectifs_production (
  id, date_plan, site_id, shift_id, version, tonnes_cible, voyages_cible,
  camions_prevus, chargeuses_prevues, statut, motif, note, cree_le, clos_le
)
SELECT pg_temp.demo_id(12, d * 10 + 1),
       current_date - d,
       pg_temp.demo_id(1, 1),
       pg_temp.demo_id(2, 1),
       1,
       CASE WHEN d = 0 THEN 5000 ELSE 4800 + ((d * 37) % 5) * 100 END,
       120,
       20,
       3,
       CASE WHEN d = 0 THEN 'remplace' ELSE 'actif' END,
       NULL,
       'Démonstration',
       (current_date - d - 1) + time '17:00',
       CASE WHEN d = 0 THEN least(now(), current_date + time '05:40') END
FROM generate_series(0, 14) AS d;

INSERT INTO public.objectifs_production (
  id, date_plan, site_id, shift_id, version, tonnes_cible, voyages_cible,
  camions_prevus, chargeuses_prevues, statut, motif, note, cree_le
) VALUES (
  pg_temp.demo_id(12, 2), current_date, pg_temp.demo_id(1, 1), pg_temp.demo_id(2, 1), 2,
  4800, 118, 20, 2, 'actif',
  'Chargeuse CAT-980L-02 en attente de pièce chez Nimba Mining',
  'Démonstration', least(now(), current_date + time '05:40')
);

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

-- 7b. Immobilisations des engins loues (D-022, D-025), coherentes avec le
--     statut des engins : 4 semi-remorques et la chargeuse CAT-980L-02
--     arretes en ce moment, et des arrets clos sur les 14 derniers jours.
INSERT INTO public.immobilisations (id, vehicle_id, debut, fin, cause, imputation, description, reference_loueur, statut, declare_le, cloture_le) VALUES
  (pg_temp.demo_id(13, 1), pg_temp.demo_id(3, 21), least(now(), current_date + time '06:00'), NULL, 'maintenance_planifiee', 'loueur', 'Révision 1 000 h', 'NM-2611-014', 'ouverte', least(now(), current_date + time '06:00'), NULL),
  (pg_temp.demo_id(13, 2), pg_temp.demo_id(3, 22), current_date - 1 + time '14:00', NULL, 'maintenance_planifiee', 'loueur', 'Vidange moteur et filtres (500 h)', 'NM-2611-011', 'ouverte', current_date - 1 + time '14:05', NULL),
  (pg_temp.demo_id(13, 3), pg_temp.demo_id(3, 23), current_date - 6 + time '08:00', NULL, 'attente_piece', 'loueur', 'Boîte de vitesses : pièce attendue', 'NM-2611-003', 'ouverte', current_date - 6 + time '08:20', NULL),
  (pg_temp.demo_id(13, 4), pg_temp.demo_id(3, 24), current_date - 3 + time '10:00', NULL, 'pneumatique', 'exploitant', 'Pneus avant endommagés sur piste', NULL, 'ouverte', current_date - 3 + time '10:10', NULL),
  (pg_temp.demo_id(13, 5), pg_temp.demo_id(3, 102), least(now(), current_date + time '05:30'), NULL, 'attente_piece', 'loueur', 'Vérin de godet : pièce en commande chez Nimba Mining', 'NM-2611-016', 'ouverte', least(now(), current_date + time '05:30'), NULL);

INSERT INTO public.immobilisations (id, vehicle_id, debut, fin, cause, imputation, description, reference_loueur, statut, declare_le, cloture_le)
SELECT pg_temp.demo_id(13, 100 + i),
       pg_temp.demo_id(3, i),
       current_date - (2 + i % 12) + time '19:00',
       current_date - (2 + i % 12) + time '19:00' + make_interval(hours => 3 + (i * 5) % 7),
       CASE WHEN i % 4 = 0 THEN 'pneumatique' ELSE 'panne' END,
       CASE WHEN i % 4 = 0 THEN 'exploitant' WHEN i = 10 THEN 'a_determiner' ELSE 'loueur' END,
       CASE WHEN i % 4 = 0 THEN 'Crevaison sur piste' WHEN i % 3 = 0 THEN 'Démarreur' ELSE 'Fuite hydraulique' END,
       CASE WHEN i % 4 = 0 THEN NULL ELSE 'NM-25' || lpad(i::text, 3, '0') END,
       'cloturee',
       current_date - (2 + i % 12) + time '19:10',
       current_date - (2 + i % 12) + time '19:00' + make_interval(hours => 3 + (i * 5) % 7)
FROM generate_series(1, 12) AS i;

INSERT INTO public.immobilisations_journal (id, immobilisation_id, action, apres, le)
SELECT pg_temp.demo_id(14, n::int), i.id, 'declaration', to_jsonb(i) - 'n', i.declare_le
FROM (SELECT *, row_number() OVER (ORDER BY id) AS n FROM public.immobilisations WHERE id::text LIKE 'dec0de00-%') i;
INSERT INTO public.immobilisations_journal (id, immobilisation_id, action, apres, le)
SELECT pg_temp.demo_id(14, 1000 + n::int), i.id, 'cloture', to_jsonb(i) - 'n', i.cloture_le
FROM (SELECT *, row_number() OVER (ORDER BY id) AS n FROM public.immobilisations
      WHERE id::text LIKE 'dec0de00-%' AND statut = 'cloturee') i;

UPDATE public.vehicles SET status = 'immobilized' WHERE id = pg_temp.demo_id(3, 102);

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

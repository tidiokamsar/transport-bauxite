/*
  # IoT et carburant sur donnees reelles (remise a niveau, D-030)

  Constat (cartographie du 2026-11-11) :
  - `iot-ingestion` appelait `ingest_gps_data`, `ingest_fuel_data` et
    `iot_telemetry_raw`, absents : toute reception echouait (500).
  - Les ecrans carburant lisaient `fuel_consumption`, `fuel_vehicle_stats`,
    `fuel_anomalies`, `fuel_predictions`, absentes et sans producteur, et
    affichaient des valeurs fixes (references 30 et 38 L/100 km, economie
    de 8 %, confiance par defaut).

  1. `iot_telemetry_raw` (service seulement) ; `ingest_gps_data` et
     `ingest_fuel_data` (service seulement) : lecture rattachee a l'engin du
     boitier, heure du serveur, pourcentage calcule seulement si la
     capacite est fournie.
  2. `consommation_carburant(du, au)` : par engin, litres et cout des pleins,
     tonnes livrees, voyages, heures de marche pointees, litres par tonne et
     par heure. Valeur absente = non calculable (null).
  3. `anomalies_carburant(du, au, seuil)` : pleins a examiner, regles
     affichees : deux pleins le meme jour, plein un jour sans voyage ni
     pointage de l'engin, plein sans engin, consommation par tonne au-dela
     de la mediane de la flotte augmentee du seuil saisi.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE.
*/

-- 1. IoT
CREATE TABLE IF NOT EXISTS public.iot_telemetry_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  message_type text NOT NULL,
  payload jsonb NOT NULL,
  protocol text NOT NULL DEFAULT 'http',
  processed boolean NOT NULL DEFAULT false,
  recu_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.iot_telemetry_raw ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.iot_telemetry_raw FROM anon, authenticated;
GRANT ALL ON public.iot_telemetry_raw TO service_role;
DROP POLICY IF EXISTS lecture_admin ON public.iot_telemetry_raw;
CREATE POLICY lecture_admin ON public.iot_telemetry_raw FOR SELECT TO authenticated USING (public.is_admin());
GRANT SELECT ON public.iot_telemetry_raw TO authenticated;

CREATE OR REPLACE FUNCTION public.ingest_gps_data(
  p_device_id text, p_latitude numeric, p_longitude numeric,
  p_speed numeric DEFAULT NULL, p_heading numeric DEFAULT NULL, p_odometer numeric DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vehicule uuid;
  v_id uuid;
BEGIN
  IF p_latitude IS NULL OR p_longitude IS NULL OR abs(p_latitude) > 90 OR abs(p_longitude) > 180 THEN
    RAISE EXCEPTION 'Position invalide' USING ERRCODE = '22023';
  END IF;
  SELECT vehicle_id INTO v_vehicule FROM public.iot_devices WHERE device_id = p_device_id AND status = 'active';
  INSERT INTO public.iot_gps_readings (device_id, vehicle_id, reading_timestamp, latitude, longitude, speed_kmh, odometer_km)
  VALUES (p_device_id, v_vehicule, now(), p_latitude, p_longitude, p_speed, p_odometer)
  RETURNING id INTO v_id;
  IF v_vehicule IS NOT NULL THEN
    INSERT INTO public.vehicle_tracking (vehicle_id, "timestamp", latitude, longitude, speed, heading, odometer,
      engine_status, ignition_status)
    VALUES (v_vehicule, now(), p_latitude, p_longitude, round(coalesce(p_speed, 0))::integer, round(p_heading)::integer,
      round(p_odometer)::integer, CASE WHEN coalesce(p_speed, 0) > 0 THEN 'on' ELSE 'off' END, coalesce(p_speed, 0) > 0);
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_fuel_data(
  p_device_id text, p_fuel_level numeric, p_tank_capacity numeric DEFAULT NULL,
  p_latitude numeric DEFAULT NULL, p_longitude numeric DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_fuel_level IS NULL OR p_fuel_level < 0 THEN
    RAISE EXCEPTION 'Niveau de carburant invalide' USING ERRCODE = '22023';
  END IF;
  IF p_tank_capacity IS NOT NULL AND p_tank_capacity <= 0 THEN
    RAISE EXCEPTION 'Capacite du reservoir invalide' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.iot_fuel_readings (device_id, vehicle_id, reading_timestamp, fuel_level_liters, fuel_level_percentage,
    tank_capacity_liters, location_latitude, location_longitude)
  SELECT p_device_id, d.vehicle_id, now(), p_fuel_level,
         CASE WHEN p_tank_capacity IS NOT NULL THEN round(least(100, p_fuel_level / p_tank_capacity * 100), 2) END,
         p_tank_capacity, p_latitude, p_longitude
  FROM (SELECT (SELECT vehicle_id FROM public.iot_devices WHERE device_id = p_device_id AND status = 'active') AS vehicle_id) d
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ingest_gps_data(text, numeric, numeric, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_gps_data(text, numeric, numeric, numeric, numeric, numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION public.ingest_fuel_data(text, numeric, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_fuel_data(text, numeric, numeric, numeric, numeric) TO service_role;

-- 2. Consommation par engin sur [du, au] (dates comprises), droits de
-- l'appelant (RLS des pleins, voyages et pointages).
CREATE OR REPLACE FUNCTION public.consommation_carburant(p_du date, p_au date)
RETURNS TABLE (
  vehicle_id uuid, litres numeric, cout numeric, pleins integer, tonnes numeric, voyages integer,
  heures_marche numeric, litres_par_tonne numeric, litres_par_heure numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH pleins AS (
    SELECT f.vehicle_id, sum(coalesce(f.volume_liters, f.quantity)) AS litres, sum(coalesce(f.total_cost, f.total_amount)) AS cout,
           count(*)::integer AS n
    FROM public.fuel_transactions f
    WHERE f.transaction_date BETWEEN p_du AND p_au AND f.transaction_type = 'refuel' AND f.vehicle_id IS NOT NULL
    GROUP BY f.vehicle_id
  ),
  transports AS (
    SELECT t.vehicle_id, sum(coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight)) AS tonnes,
           count(*)::integer AS n
    FROM public.trips t
    WHERE t.planned_date BETWEEN p_du AND p_au AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
      AND t.vehicle_id IS NOT NULL
    GROUP BY t.vehicle_id
  ),
  heures AS (
    SELECT p.vehicle_id, sum(p.heures_marche) AS h
    FROM public.pointages_engins p JOIN public.fiches_terrain fi ON fi.id = p.fiche_id
    WHERE fi.date_fiche BETWEEN p_du AND p_au
    GROUP BY p.vehicle_id
  )
  SELECT pl.vehicle_id, round(pl.litres, 2), round(pl.cout, 2), pl.n, round(tr.tonnes, 2), coalesce(tr.n, 0),
         round(he.h, 2),
         CASE WHEN tr.tonnes > 0 THEN round(pl.litres / tr.tonnes, 3) END,
         CASE WHEN he.h > 0 THEN round(pl.litres / he.h, 2) END
  FROM pleins pl
  LEFT JOIN transports tr ON tr.vehicle_id = pl.vehicle_id
  LEFT JOIN heures he ON he.vehicle_id = pl.vehicle_id;
$$;

-- 3. Pleins a examiner. Le seuil (en %) au-dela de la mediane de la flotte
-- est saisi par l'utilisateur ; sans seuil, la regle de surconsommation ne
-- s'applique pas.
CREATE OR REPLACE FUNCTION public.anomalies_carburant(p_du date, p_au date, p_seuil_pct numeric DEFAULT NULL)
RETURNS TABLE (type text, vehicle_id uuid, jour date, reference text, litres numeric, detail text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH pleins AS (
    SELECT f.id, f.vehicle_id, f.transaction_date AS jour, f.reference, coalesce(f.volume_liters, f.quantity) AS litres
    FROM public.fuel_transactions f
    WHERE f.transaction_date BETWEEN p_du AND p_au AND f.transaction_type = 'refuel'
  ),
  conso AS (SELECT * FROM public.consommation_carburant(p_du, p_au)),
  mediane AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY litres_par_tonne) AS m FROM conso WHERE litres_par_tonne IS NOT NULL)
  SELECT 'plein_sans_engin', NULL::uuid, p.jour, p.reference, p.litres, 'Plein sans engin renseigne'
  FROM pleins p WHERE p.vehicle_id IS NULL
  UNION ALL
  SELECT 'pleins_meme_jour', p.vehicle_id, p.jour, string_agg(p.reference, ', ' ORDER BY p.reference), sum(p.litres),
         count(*) || ' pleins le meme jour'
  FROM pleins p WHERE p.vehicle_id IS NOT NULL GROUP BY p.vehicle_id, p.jour HAVING count(*) > 1
  UNION ALL
  SELECT 'plein_sans_activite', p.vehicle_id, p.jour, p.reference, p.litres, 'Aucun voyage ni pointage de l''engin ce jour'
  FROM pleins p
  WHERE p.vehicle_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.vehicle_id = p.vehicle_id AND t.planned_date = p.jour
                    AND t.etat NOT IN ('CANCELLED', 'DRAFT', 'PLANNED'))
    AND NOT EXISTS (SELECT 1 FROM public.pointages_engins pe JOIN public.fiches_terrain fi ON fi.id = pe.fiche_id
                    WHERE pe.vehicle_id = p.vehicle_id AND fi.date_fiche = p.jour)
    AND NOT EXISTS (SELECT 1 FROM public.trips t2 WHERE t2.loader_vehicle_id = p.vehicle_id AND t2.planned_date = p.jour
                    AND t2.etat NOT IN ('CANCELLED', 'DRAFT', 'PLANNED'))
  UNION ALL
  SELECT 'surconsommation', c.vehicle_id, NULL::date, NULL, c.litres,
         round(c.litres_par_tonne, 3) || ' L/t contre une mediane de ' || round(m.m::numeric, 3) || ' L/t'
  FROM conso c CROSS JOIN mediane m
  WHERE p_seuil_pct IS NOT NULL AND c.litres_par_tonne IS NOT NULL AND m.m IS NOT NULL
    AND c.litres_par_tonne > m.m * (1 + p_seuil_pct / 100);
$$;

REVOKE EXECUTE ON FUNCTION public.consommation_carburant(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consommation_carburant(date, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.anomalies_carburant(date, date, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anomalies_carburant(date, date, numeric) TO authenticated;

-- Tests (D-030) : fiabilite des engins et performance des chauffeurs
-- calculees sur les immobilisations et le journal des voyages
-- (migration 20261111160000_analyses_flotte). Tout est annule.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(6);

INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-9100-0000000000b1', 'TEST-FIA-1', 'Test', 40, 'tipper', 'active'),
  ('00000000-0000-4000-9100-0000000000b2', 'TEST-FIA-2', 'Test', 40, 'tipper', 'active');
-- TEST-FIA-1 : panne 10 h, attente de piece 20 h (loueur), maintenance 6 h
INSERT INTO public.immobilisations (vehicle_id, debut, fin, cause, imputation, description, statut) VALUES
  ('00000000-0000-4000-9100-0000000000b1', '2026-10-02 00:00+00', '2026-10-02 10:00+00', 'panne', 'loueur', 'x', 'cloturee'),
  ('00000000-0000-4000-9100-0000000000b1', '2026-10-05 00:00+00', '2026-10-05 20:00+00', 'attente_piece', 'loueur', 'x', 'cloturee'),
  ('00000000-0000-4000-9100-0000000000b1', '2026-10-08 00:00+00', '2026-10-08 06:00+00', 'maintenance_planifiee', 'exploitant', 'x', 'cloturee');

SELECT is((SELECT (heures_periode, heures_arret, pannes, mttr_heures, mtbf_heures, disponibilite_pct, heures_loueur)::text
  FROM public.fiabilite_engins('2026-10-01 00:00+00', '2026-10-11 00:00+00') WHERE vehicle_id = '00000000-0000-4000-9100-0000000000b1'),
  '(240.0,36.0,2,15.0,102.0,85.0,30.0)', 'arrets, pannes, MTTR, MTBF et disponibilite');
SELECT is((SELECT (pannes, mttr_heures, disponibilite_pct)::text
  FROM public.fiabilite_engins('2026-10-01 00:00+00', '2026-10-11 00:00+00') WHERE vehicle_id = '00000000-0000-4000-9100-0000000000b2'),
  '(0,,100.0)', 'sans panne : MTTR non calculable, disponibilite pleine');

INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date) VALUES
  ('00000000-0000-4000-9100-0000000000c1', 'Chauffeur perf', 'P-1', 'C', '2030-01-01', '2020-01-01');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, driver_id, etat, net_weight, net_weight_reception, accepted_tonnage) VALUES
  ('00000000-0000-4000-9100-000000000101', 'TPERF-1', '2026-10-03', '00000000-0000-4000-9100-0000000000b2', '00000000-0000-4000-9100-0000000000c1', 'ACCEPTED', 40, 39, 39),
  ('00000000-0000-4000-9100-000000000102', 'TPERF-2', '2026-10-04', '00000000-0000-4000-9100-0000000000b2', '00000000-0000-4000-9100-0000000000c1', 'DISPUTED', 40, 40, NULL);
INSERT INTO public.trip_events (trip_id, etat_avant, etat_apres, survenu_le) VALUES
  ('00000000-0000-4000-9100-000000000101', 'ASSIGNED', 'AT_LOADING', '2026-10-03 08:00+00'),
  ('00000000-0000-4000-9100-000000000101', 'AT_LOADING', 'LOADING', '2026-10-03 08:10+00'),
  ('00000000-0000-4000-9100-000000000101', 'LOADING', 'LOADED', '2026-10-03 08:30+00'),
  ('00000000-0000-4000-9100-000000000101', 'UNLOADING', 'DELIVERED', '2026-10-03 09:30+00');

SELECT is((SELECT (voyages, tonnes, litiges)::text FROM public.performance_chauffeurs('2026-10-01', '2026-10-31')
  WHERE driver_id = '00000000-0000-4000-9100-0000000000c1'), '(2,79.00,1)', 'voyages livres, tonnes et litiges');
SELECT is((SELECT (cycle_moyen_min, chargement_moyen_min)::text FROM public.performance_chauffeurs('2026-10-01', '2026-10-31')
  WHERE driver_id = '00000000-0000-4000-9100-0000000000c1'), '(90,20)', 'temps de cycle et de chargement depuis le journal');
SELECT is((SELECT ecart_moyen_pct FROM public.performance_chauffeurs('2026-10-01', '2026-10-31')
  WHERE driver_id = '00000000-0000-4000-9100-0000000000c1'), 1.25::numeric, 'ecart moyen charge / recu');
SELECT is((SELECT count(*)::int FROM public.performance_chauffeurs('2026-11-01', '2026-11-30')
  WHERE driver_id = '00000000-0000-4000-9100-0000000000c1'), 0, 'periode sans voyage : aucune ligne inventee');

SELECT * FROM finish();
ROLLBACK;

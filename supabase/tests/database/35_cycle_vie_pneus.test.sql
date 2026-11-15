-- Tests (D-052) : cycle de vie individuel des pneus, journal append-only,
-- une position par pneu monte, km et cout au km, alertes sur seuil,
-- annulation de la derniere operation, perimetre (migration 20261116210000).
-- Tout est annule.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

CREATE FUNCTION pg_temp.se_connecter(p_id uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), true),
         set_config('request.jwt.claims',
           CASE WHEN p_id IS NULL THEN '{}'
                ELSE json_build_object('sub', p_id, 'role', 'authenticated')::text END,
           true);
$$;

SELECT plan(17);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a200-000000000001', 'admin.d052@exemple.invalid'),
  ('00000000-0000-4000-a200-000000000002', 'chauffeur.d052@exemple.invalid'),
  ('00000000-0000-4000-a200-000000000003', 'admin.site.d052@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a200-0000000000a1', 'Depot D-052', 'depot'),
  ('00000000-0000-4000-a200-0000000000a2', 'Autre site D-052', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a200-000000000001', 'admin', 'Admin D-052', 'active', NULL),
  ('00000000-0000-4000-a200-000000000002', 'driver', 'Chauffeur D-052', 'active', NULL),
  ('00000000-0000-4000-a200-000000000003', 'admin', 'Admin site D-052', 'active', '00000000-0000-4000-a200-0000000000a2')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-a200-0000000000b1', 'TEST-D052-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a200-0000000000a1');
DELETE FROM public.settings WHERE key IN ('pneu_profondeur_min_mm', 'pneu_inspection_max_jours');
INSERT INTO public.settings (key, value, category) VALUES ('pneu_profondeur_min_mm', '{"value": "5"}', 'pneus');

SELECT pg_temp.se_connecter('00000000-0000-4000-a200-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE p AS SELECT
  public.enregistrer_pneu(p_numero => 't-d052-1', p_marque => 'Marque', p_modele => 'Modele', p_site => '00000000-0000-4000-a200-0000000000a1',
    p_prix_achat => 2000000, p_profondeur_mm => 16, p_rechapages_max => 0) AS p1,
  public.enregistrer_pneu(p_numero => 'T-D052-2', p_marque => 'Marque', p_modele => 'Modele', p_site => '00000000-0000-4000-a200-0000000000a1') AS p2;
SELECT is((SELECT status || ' ' || tire_number FROM public.tires WHERE id = (SELECT p1 FROM p)), 'stored T-D052-1', 'pneu enregistre en stock');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a200-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_pneu(p_numero => 'T-D052-X', p_marque => 'M', p_modele => 'M', p_site => '00000000-0000-4000-a200-0000000000a1')$$,
  '42501', NULL, 'sans droit d''ecriture : refuse');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a200-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.monter_pneu(p_tire => (SELECT p1 FROM p), p_vehicle => '00000000-0000-4000-a200-0000000000b1', p_position => ' av  g ', p_km => 1000);
SELECT is((SELECT status || ' ' || "position" FROM public.tires WHERE id = (SELECT p1 FROM p)), 'active AV G', 'montage : position normalisee');
SELECT throws_ok($$SELECT public.monter_pneu(p_tire => (SELECT p2 FROM p), p_vehicle => '00000000-0000-4000-a200-0000000000b1', p_position => 'AV G')$$,
  '22023', NULL, 'position deja occupee : refuse');
SELECT public.monter_pneu(p_tire => (SELECT p2 FROM p), p_vehicle => '00000000-0000-4000-a200-0000000000b1', p_position => 'AV D', p_km => 1000);
SELECT public.permuter_pneu(p_tire => (SELECT p1 FROM p), p_position => 'AV D', p_km => 20000, p_motif => 'Usure irreguliere');
SELECT is((SELECT string_agg(tire_number || '=' || "position", ' ' ORDER BY tire_number) FROM public.tires WHERE id IN ((SELECT p1 FROM p), (SELECT p2 FROM p))),
  'T-D052-1=AV D T-D052-2=AV G', 'permutation vers une position occupee : echange');
SELECT throws_ok($$SELECT public.demonter_pneu(p_tire => (SELECT p1 FROM p), p_motif => 'Test', p_etat => 'damaged', p_site => '00000000-0000-4000-a200-0000000000a1', p_km => 900)$$,
  '22023', NULL, 'compteur au demontage inferieur au montage : refuse');
SELECT public.demonter_pneu(p_tire => (SELECT p1 FROM p), p_motif => 'Coupure flanc', p_etat => 'damaged', p_site => '00000000-0000-4000-a200-0000000000a1', p_km => 41000);
SELECT is((SELECT status FROM public.tires WHERE id = (SELECT p1 FROM p)), 'damaged', 'demontage : pneu a decider');
SELECT is((SELECT km_parcourus FROM public.v_pneus WHERE id = (SELECT p1 FROM p)), 40000::numeric, 'km parcourus entre montage et demontage');
SELECT public.inspecter_pneu(p_tire => (SELECT p2 FROM p), p_profondeur_mm => 4);
SELECT is((SELECT motif FROM public.v_pneus_a_surveiller WHERE id = (SELECT p2 FROM p)), 'profondeur', 'profondeur sous le seuil : alerte');
SELECT public.reparer_pneu(p_tire => (SELECT p1 FROM p), p_site => '00000000-0000-4000-a200-0000000000a1', p_cout => 50000);
SELECT throws_ok($$SELECT public.rechaper_pneu(p_tire => (SELECT p1 FROM p), p_prestataire => 'Rechapeur', p_site => '00000000-0000-4000-a200-0000000000a1')$$,
  '22023', NULL, 'nombre maximal de rechapages atteint : refuse');
SELECT public.annuler_operation_pneu((SELECT id FROM public.pneus_operations WHERE tire_id = (SELECT p1 FROM p) AND type = 'reparation'), 'Saisie en double');
SELECT is((SELECT status FROM public.tires WHERE id = (SELECT p1 FROM p)), 'damaged', 'annulation de la reparation : etat precedent retabli');
SELECT throws_ok($$SELECT public.annuler_operation_pneu((SELECT id FROM public.pneus_operations WHERE tire_id = (SELECT p2 FROM p) AND type = 'permutation'), 'Test')$$,
  '22023', NULL, 'seule la derniere operation s''annule');
SELECT is((SELECT cout_km FROM public.v_pneus WHERE id = (SELECT p1 FROM p)), 50.00::numeric, 'cout au km : achat sur km parcourus');
SELECT throws_ok($$UPDATE public.pneus_operations SET motif = 'x' WHERE tire_id = (SELECT p1 FROM p)$$, '42501', NULL, 'journal non modifiable');
SELECT throws_ok($$UPDATE public.tires SET status = 'retired' WHERE id = (SELECT p1 FROM p)$$, '42501', NULL, 'etat non modifiable directement');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a200-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.tires WHERE id = (SELECT p1 FROM p)), 0, 'pneu stocke sur un autre site : invisible');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a200-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.reformer_pneu(p_tire => (SELECT p1 FROM p), p_motif => 'Carcasse endommagee');
SELECT throws_ok($$SELECT public.monter_pneu(p_tire => (SELECT p1 FROM p), p_vehicle => '00000000-0000-4000-a200-0000000000b1', p_position => 'AR 1')$$,
  '22023', NULL, 'pneu reforme : montage refuse');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

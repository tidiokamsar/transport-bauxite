-- Tests (D-057) : indicateurs de pilotage avec source, fiabilite et
-- periode ; voyage sans poids rend le tonnage partiel ; sans objectif, la
-- realisation est sans donnees ; RLS du lecteur (migration 20261117210000).
-- Periode 2001 (vide en production, donnees de demonstration D-020).
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

SELECT plan(6);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a700-000000000001', 'admin.d057@exemple.invalid'),
  ('00000000-0000-4000-a700-000000000002', 'mecanicien.d057@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a700-000000000001', 'admin', 'Admin D-057', 'active', NULL),
  ('00000000-0000-4000-a700-000000000002', 'maintenance_chief', 'Maintenance D-057', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-a700-0000000000a1', 'Mine D-057', 'mine');
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-a700-0000000000b1', 'TEST-D057-1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a700-0000000000a1');
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, etat, net_weight) VALUES
  ('00000000-0000-4000-a700-000000000101', 'TD057-1', '2001-03-10', '00000000-0000-4000-a700-0000000000b1', '00000000-0000-4000-a700-0000000000a1', 'DELIVERED', 30),
  ('00000000-0000-4000-a700-000000000102', 'TD057-2', '2001-03-10', '00000000-0000-4000-a700-0000000000b1', '00000000-0000-4000-a700-0000000000a1', 'DELIVERED', NULL);

SELECT pg_temp.se_connecter('00000000-0000-4000-a700-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE k AS SELECT * FROM public.indicateurs_pilotage('2001-03-01', '2001-03-31', '00000000-0000-4000-a700-0000000000a1');
SELECT is((SELECT valeur FROM k WHERE code = 'voyages_livres'), 2::numeric, 'voyages livres de la periode et du site');
SELECT is((SELECT valeur::text || ' ' || fiabilite FROM k WHERE code = 'tonnes_livrees'), '30.00 partielle', 'voyage sans poids : tonnage partiel, non estime');
SELECT is((SELECT fiabilite FROM k WHERE code = 'realisation'), 'sans_donnees', 'sans objectif : realisation sans donnees');
SELECT ok((SELECT bool_and(source IS NOT NULL AND periode_debut = '2001-03-01' AND calcule_le IS NOT NULL) FROM k), 'chaque indicateur porte source, periode et heure');
SELECT throws_ok($$SELECT * FROM public.indicateurs_pilotage('2001-03-31', '2001-03-01')$$, '22023', NULL, 'periode inversee refusee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a700-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT fiabilite FROM public.indicateurs_pilotage('2001-03-01', '2001-03-31', NULL) WHERE code = 'voyages_livres'), 'sans_donnees',
  'sans droit de lecture sur les voyages : sans donnees');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

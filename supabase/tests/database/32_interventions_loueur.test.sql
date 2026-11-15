-- Tests (D-049) : interventions du loueur (migration 20261116120000).
-- Demande, prise en charge, retard au regard du delai contractuel, fin
-- avec rapport et pieces, refus puis validation de la remise en service par
-- une autre personne, cloture de l'immobilisation. Tout est annule.
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

SELECT plan(13);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9e00-000000000001', 'maintenance.a.d049@exemple.invalid'),
  ('00000000-0000-4000-9e00-000000000002', 'maintenance.b.d049@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-9e00-000000000001', 'contract_manager', 'Saisie A', 'active', NULL),
  ('00000000-0000-4000-9e00-000000000002', 'contract_manager', 'Controle B', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status) VALUES
  ('00000000-0000-4000-9e00-0000000000b1', 'TEST-D049-CHG', 'Test', 10, 'loader', 'immobilized'),
  ('00000000-0000-4000-9e00-0000000000b2', 'TEST-D049-2', 'Test', 40, 'tipper', 'immobilized');
INSERT INTO public.immobilisations (id, vehicle_id, debut, cause, imputation, description) VALUES
  ('00000000-0000-4000-9e00-0000000000d1', '00000000-0000-4000-9e00-0000000000b1', now() - interval '10 hours', 'panne', 'loueur', 'Fuite hydraulique'),
  ('00000000-0000-4000-9e00-0000000000d2', '00000000-0000-4000-9e00-0000000000b2', now() - interval '10 hours', 'pneumatique', 'exploitant', 'Crevaison');

SELECT pg_temp.se_connecter('00000000-0000-4000-9e00-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.demander_intervention_loueur('00000000-0000-4000-9e00-0000000000d2', now() - interval '9 hours', 'telephone', 'Pneu')$$,
  '22023', NULL, 'immobilisation imputee a l''exploitant : pas d''intervention du loueur');
CREATE TEMP TABLE i1 AS SELECT public.demander_intervention_loueur('00000000-0000-4000-9e00-0000000000d1', now() - interval '9 hours', 'courriel',
  'Fuite hydraulique bras de levage', 'KM/MNT/001', 4) AS id;
GRANT SELECT ON i1 TO authenticated;
SELECT matches((SELECT numero FROM public.interventions_loueur WHERE id = (SELECT id FROM i1)), '^INT-[0-9]{4}-[0-9]{5}$', 'numero attribue par le serveur');
SELECT throws_ok($$SELECT public.demander_intervention_loueur('00000000-0000-4000-9e00-0000000000d1', now() - interval '8 hours', 'telephone', 'Doublon')$$,
  '22023', NULL, 'une seule intervention en cours par immobilisation');
SELECT is((SELECT en_retard FROM public.v_interventions_loueur WHERE id = (SELECT id FROM i1)), true, 'non prise en charge depuis 9 h pour un delai de 4 h : en retard');
SELECT lives_ok($$SELECT public.prendre_en_charge_intervention((SELECT id FROM i1), now() - interval '3 hours', 'Technicien Neemba')$$, 'prise en charge');
SELECT is((SELECT delai_heures FROM public.v_interventions_loueur WHERE id = (SELECT id FROM i1)), 6.0, 'delai de prise en charge : 6 h');
SELECT throws_ok($$SELECT public.terminer_intervention((SELECT id FROM i1), now() - interval '1 hour', ' ')$$, '22023', NULL, 'fin sans rapport refusee');
SELECT lives_ok($$SELECT public.terminer_intervention((SELECT id FROM i1), now() - interval '1 hour', 'Flexible remplace, essais OK',
  '[{"designation":"Flexible hydraulique","quantite":1,"fournie_par":"loueur"}]')$$, 'fin avec rapport et piece');
SELECT throws_ok($$SELECT public.valider_remise_en_service((SELECT id FROM i1), true)$$, '42501', NULL, 'celui qui saisit la fin ne valide pas');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-9e00-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.valider_remise_en_service((SELECT id FROM i1), false, 'Fuite persistante aux essais'), 'prise_en_charge', 'remise refusee : retour en cours');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-9e00-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.terminer_intervention((SELECT id FROM i1), now() - interval '30 minutes', 'Joint remplace, essais OK')$$, 'nouvelle fin');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-9e00-000000000002');
SET LOCAL ROLE authenticated;
SELECT is(public.valider_remise_en_service((SELECT id FROM i1), true), 'remise_validee', 'remise en service validee');
RESET ROLE;
SELECT is((SELECT statut || '/' || (SELECT status::text FROM public.vehicles WHERE id = '00000000-0000-4000-9e00-0000000000b1')
  FROM public.immobilisations WHERE id = '00000000-0000-4000-9e00-0000000000d1'), 'cloturee/active', 'immobilisation close et engin disponible');

SELECT * FROM finish();
ROLLBACK;

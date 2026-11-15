-- Tests (D-062) : registre de la flotte (propriete, contrat de location),
-- suspension et remise en service motivees, reforme, statut operationnel
-- derive, alertes de documents, fiche consolidee et plein isole par
-- fonction serveur (migration 20261118210000). Tout est annule.
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

SELECT plan(27);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a620-000000000001', 'flotte.d062@exemple.invalid'),
  ('00000000-0000-4000-a620-000000000002', 'comptable.d062@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a620-0000000000a1', 'Site A D-062', 'mine'),
  ('00000000-0000-4000-a620-0000000000a2', 'Site B D-062', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a620-000000000001', 'fleet_manager', 'Flotte site A D-062', 'active', '00000000-0000-4000-a620-0000000000a1'),
  ('00000000-0000-4000-a620-000000000002', 'accountant', 'Comptable D-062', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id, technical_inspection_expiry) VALUES
  ('00000000-0000-4000-a620-0000000000b1', 'TEST-D062-A', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a620-0000000000a1', current_date - 5),
  ('00000000-0000-4000-a620-0000000000b2', 'TEST-D062-B', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-a620-0000000000a2', NULL),
  ('00000000-0000-4000-a620-0000000000b3', 'TEST-D062-C', 'Test', 0, 'loader', 'active', '00000000-0000-4000-a620-0000000000a1', NULL);
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut) VALUES
  ('00000000-0000-4000-a620-0000000000c1', 'TEST-D062-LOC', 'Location engins', 'location', 'Neemba', 'GNF', current_date - 100),
  ('00000000-0000-4000-a620-0000000000c2', 'TEST-D062-CLI', 'Transport bauxite', 'client', 'CBG', 'GNF', current_date - 100);
INSERT INTO public.stockages_carburant (id, code, libelle, type, site_id, capacite_litres) VALUES
  ('00000000-0000-4000-a620-0000000000e1', 'TEST-D062-CUVE', 'Cuve D-062', 'cuve_fixe', '00000000-0000-4000-a620-0000000000a1', 30000);
INSERT INTO public.vehicle_documents (vehicle_id, document_type, document_name, expiry_date, status) VALUES
  ('00000000-0000-4000-a620-0000000000b1', 'insurance', 'Assurance 2025', current_date - 300, 'active'),
  ('00000000-0000-4000-a620-0000000000b1', 'insurance', 'Assurance 2026', current_date + 10, 'active'),
  ('00000000-0000-4000-a620-0000000000b3', 'insurance', 'Assurance engin', current_date + 200, 'active');

-- Gestionnaire de flotte du site A
SELECT pg_temp.se_connecter('00000000-0000-4000-a620-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT propriete FROM public.v_vehicules WHERE id = '00000000-0000-4000-a620-0000000000b1'), NULL,
  'propriete non renseignee par defaut');
SELECT is((SELECT statut_operationnel FROM public.v_vehicules WHERE id = '00000000-0000-4000-a620-0000000000b1'), 'disponible',
  'engin actif sans voyage engage : disponible');
SELECT throws_ok($$SELECT public.definir_propriete_vehicule('00000000-0000-4000-a620-0000000000b1', 'loue', 'Neemba', 'Kogon Mining', NULL,
  '00000000-0000-4000-a620-0000000000c2')$$, '22023', NULL, 'contrat client refuse comme contrat de location');
SELECT throws_ok($$SELECT public.definir_propriete_vehicule('00000000-0000-4000-a620-0000000000b1', 'kogon', NULL, NULL, NULL,
  '00000000-0000-4000-a620-0000000000c1')$$, '22023', NULL, 'engin Kogon sans contrat de location');
SELECT lives_ok($$SELECT public.definir_propriete_vehicule('00000000-0000-4000-a620-0000000000b1', 'loue', 'Neemba', 'Kogon Mining', NULL,
  '00000000-0000-4000-a620-0000000000c1')$$, 'engin loue rattache au contrat de location');
SELECT is((SELECT contrat_reference FROM public.v_vehicules WHERE id = '00000000-0000-4000-a620-0000000000b1'), 'TEST-D062-LOC · Neemba',
  'reference du contrat lisible depuis la flotte');
SELECT throws_ok($$SELECT public.definir_propriete_vehicule('00000000-0000-4000-a620-0000000000b1', 'kogon', NULL, NULL, NULL, NULL)$$,
  '22023', NULL, 'modification d''une propriete renseignee sans motif refusee');
SELECT throws_ok($$UPDATE public.vehicles SET propriete = 'kogon' WHERE id = '00000000-0000-4000-a620-0000000000b1'$$,
  '42501', NULL, 'propriete non modifiable en direct');
SELECT throws_ok($$UPDATE public.vehicles SET status = 'active' WHERE id = '00000000-0000-4000-a620-0000000000b1'$$,
  '42501', NULL, 'statut technique non modifiable en direct');
SELECT lives_ok($$UPDATE public.vehicles SET brand_model = 'Test modifie' WHERE id = '00000000-0000-4000-a620-0000000000b1'$$,
  'champs descriptifs modifiables');

-- Suspension, immobilisation pendant la suspension, remise en service
SELECT throws_ok($$SELECT public.suspendre_vehicule('00000000-0000-4000-a620-0000000000b1', '  ')$$, '22023', NULL,
  'suspension sans motif refusee');
SELECT lives_ok($$SELECT public.suspendre_vehicule('00000000-0000-4000-a620-0000000000b1', 'Visite technique expiree')$$,
  'suspension motivee');
SELECT is((SELECT status::text || '/' || statut_operationnel FROM public.v_vehicules WHERE id = '00000000-0000-4000-a620-0000000000b1'),
  'immobilized/suspendu', 'engin suspendu : indisponible pour la planification et le dispatch');
SELECT public.declarer_immobilisation('00000000-0000-4000-a620-0000000000b1', now() - interval '2 hours', 'panne', 'loueur', 'Test D-062');
SELECT public.cloturer_immobilisation((SELECT id FROM public.immobilisations WHERE vehicle_id = '00000000-0000-4000-a620-0000000000b1' AND statut = 'ouverte'),
  now() - interval '1 hour');
SELECT is((SELECT status::text FROM public.vehicles WHERE id = '00000000-0000-4000-a620-0000000000b1'), 'immobilized',
  'cloture d''immobilisation : l''engin suspendu reste indisponible');
SELECT lives_ok($$SELECT public.remettre_en_service_vehicule('00000000-0000-4000-a620-0000000000b1', 'Visite technique renouvelee')$$,
  'remise en service motivee');
SELECT is((SELECT status::text || '/' || statut_operationnel FROM public.v_vehicules WHERE id = '00000000-0000-4000-a620-0000000000b1'),
  'active/disponible', 'engin remis en service : disponible');
SELECT is((SELECT string_agg(action, ',' ORDER BY le) FROM public.journal_flotte WHERE vehicle_id = '00000000-0000-4000-a620-0000000000b1'),
  'propriete,suspension,remise_en_service', 'chaque action est journalisee');
SELECT throws_ok($$SELECT public.suspendre_vehicule('00000000-0000-4000-a620-0000000000b2', 'Hors site')$$, '42501', NULL,
  'engin d''un autre site : suspension refusee');

-- Reforme definitive
SELECT lives_ok($$SELECT public.reformer_vehicule('00000000-0000-4000-a620-0000000000b3', 'Restitue au loueur')$$, 'reforme motivee');
SELECT is((SELECT status::text || '/' || statut_operationnel FROM public.v_vehicules WHERE id = '00000000-0000-4000-a620-0000000000b3'),
  'sold/reforme', 'engin reforme : sorti de la flotte');

-- Alertes de documents : le document le plus recent et la date du registre
SELECT is((SELECT string_agg(libelle, ' | ' ORDER BY libelle) FROM public.v_documents_vehicule_a_renouveler
            WHERE vehicle_id = '00000000-0000-4000-a620-0000000000b1'),
  'Assurance 2026 | Visite technique (date du registre)', 'alertes : document remplace ignore, date du registre signalee');

-- Plein isole par fonction serveur
SELECT throws_ok($$SELECT public.saisir_plein('00000000-0000-4000-a620-0000000000b3', current_date, 100)$$, '22023', NULL,
  'plein refuse sur un engin reforme');
SELECT isnt(public.saisir_plein('00000000-0000-4000-a620-0000000000b1', current_date, 120, NULL, 15400,
  '00000000-0000-4000-a620-0000000000e1', 'Test D-062'), NULL, 'plein enregistre avec distribution depuis la cuve');
SELECT is((SELECT format('%s/%s/%s/%s', f.unit_price, f.site_id = '00000000-0000-4000-a620-0000000000a1', m.variation, m.statut)
             FROM public.fuel_transactions f JOIN public.mouvements_carburant m ON m.fuel_transaction_id = f.id
            WHERE f.vehicle_id = '00000000-0000-4000-a620-0000000000b1'),
  '/t/-120/a_valider', 'plein sans prix invente, distribution a valider');
SELECT is((SELECT format('%s/%s/%s/%s/%s', pleins, litres, cout_carburant_connu, litres_sans_prix, immobilisations)
             FROM public.v_fiche_vehicule WHERE vehicle_id = '00000000-0000-4000-a620-0000000000b1'),
  '1/120.00//120.00/1', 'fiche consolidee : cout inconnu sans prix, litres non valorises a part');
SELECT throws_ok($$INSERT INTO public.fuel_transactions (reference, vehicle_id, volume_liters, unit_price, total_cost)
  VALUES ('TEST-D062-DIRECT', '00000000-0000-4000-a620-0000000000b1', 50, 0, 0)$$, '42501', NULL, 'insertion directe d''un plein retiree');
RESET ROLE;

-- Comptable : lecture seule
SELECT pg_temp.se_connecter('00000000-0000-4000-a620-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.saisir_plein('00000000-0000-4000-a620-0000000000b1', current_date, 50)$$, '42501', NULL,
  'plein refuse sans droit d''ecriture carburant');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

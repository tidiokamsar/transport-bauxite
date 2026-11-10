-- Tests (D-026, D-027) : role contract_manager, societe, dossier contractuel
-- et son journal (migration 20261110230000_contrats_fondation). Tout est annule.
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

SELECT is((SELECT raison_sociale FROM public.societe WHERE id = 1), 'Kogon Mining SARL', 'raison sociale de la societe');
SELECT is((SELECT count(*)::int FROM public.role_permissions WHERE module = 'contracts'),
  (SELECT count(DISTINCT role)::int FROM public.role_permissions), 'module contracts : une ligne par role');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8d00-000000000001', 'contrats.test@exemple.invalid'),
  ('00000000-0000-4000-8d00-000000000002', 'chauffeur.contrats@exemple.invalid'),
  ('00000000-0000-4000-8d00-000000000003', 'comptable.contrats@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8d00-000000000001', 'contract_manager', 'Charge de contrats', 'active'),
  ('00000000-0000-4000-8d00-000000000002', 'driver', 'Chauffeur contrats', 'active'),
  ('00000000-0000-4000-8d00-000000000003', 'accountant', 'Comptable contrats', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- Charge de contrats : droits de demarrage (D-026), sans administration
SELECT pg_temp.se_connecter('00000000-0000-4000-8d00-000000000001');
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT array_agg(m ORDER BY m) FROM unnest(ARRAY['contracts', 'invoices', 'costs', 'purchases', 'hr', 'trips',
    'maintenance', 'fuel', 'vehicles', 'planning', 'settings']) m WHERE public.has_module_write(m)),
  ARRAY['contracts', 'costs', 'fuel', 'hr', 'invoices', 'maintenance', 'planning', 'purchases', 'settings', 'trips', 'vehicles'],
  'ecriture sur les modules decides au demarrage');
SELECT is(public.is_admin(), false, 'pas administrateur : la gestion des comptes lui reste fermee');
SELECT is(public.has_module_write('stock'), false, 'stocks en lecture seule');

INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, delai_paiement_jours)
VALUES ('00000000-0000-4000-8d00-0000000000c1', 'TEST-CBG-01', 'Transport de bauxite', 'client', 'CBG', 'USD', '2026-01-01', 30);
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet)
VALUES ('00000000-0000-4000-8d00-0000000000e1', '00000000-0000-4000-8d00-0000000000c1', 0, 'Contrat initial', '2026-01-01');
INSERT INTO public.contrat_tarifs (version_id, libelle, unite, prix)
VALUES ('00000000-0000-4000-8d00-0000000000e1', 'Transport mine - stock', 'tonne', 4.5);
INSERT INTO public.contrat_engagements (version_id, indicateur, libelle, seuil, unite, sens, periodicite)
VALUES ('00000000-0000-4000-8d00-0000000000e1', 'disponibilite', 'Disponibilite mecanique', 85, '%', 'minimum', 'mois');
SELECT is((SELECT count(*)::int FROM public.contrat_tarifs t JOIN public.contrat_versions v ON v.id = t.version_id
  WHERE v.contrat_id = '00000000-0000-4000-8d00-0000000000c1'), 1, 'contrat, version et tarif crees');

SELECT throws_ok($$INSERT INTO public.contrats (reference, intitule, nature, contrepartie, devise, date_debut)
  VALUES ('TEST-X', 'x', 'client', 'CBG', 'dollars', '2026-01-01')$$, '23514', NULL, 'devise au format ISO exigee');
SELECT throws_ok($$INSERT INTO public.contrat_tarifs (version_id, libelle, unite, prix)
  VALUES ('00000000-0000-4000-8d00-0000000000e1', 'x', 'tonne', NULL)$$, '23502', NULL, 'aucun tarif sans prix');

UPDATE public.contrat_tarifs SET prix = 4.75 WHERE version_id = '00000000-0000-4000-8d00-0000000000e1';
SELECT is((SELECT (avant->>'prix') || ' -> ' || (apres->>'prix') FROM public.journal_contrats
  WHERE table_cible = 'contrat_tarifs' AND action = 'UPDATE'), '4.5 -> 4.75', 'modification journalisee avec avant et apres');
SELECT is((SELECT count(*)::int FROM public.journal_contrats WHERE contrat_id = '00000000-0000-4000-8d00-0000000000c1'), 5,
  'journal rattache au contrat (4 creations, 1 modification)');
SELECT is((SELECT auteur FROM public.journal_contrats WHERE table_cible = 'contrats'),
  '00000000-0000-4000-8d00-000000000001'::uuid, 'auteur journalise');

UPDATE public.contrats SET statut = 'actif' WHERE id = '00000000-0000-4000-8d00-0000000000c1';
DELETE FROM public.contrats WHERE id = '00000000-0000-4000-8d00-0000000000c1';
SELECT is((SELECT count(*)::int FROM public.contrats WHERE id = '00000000-0000-4000-8d00-0000000000c1'), 1,
  'un contrat actif ne se supprime pas');
SELECT throws_ok($$INSERT INTO public.journal_contrats (table_cible, ligne_id, action) VALUES ('x', gen_random_uuid(), 'INSERT')$$,
  '42501', NULL, 'journal non modifiable directement');

UPDATE public.societe SET nif = 'NIF-TEST' WHERE id = 1;
SELECT is((SELECT nif FROM public.societe WHERE id = 1), 'NIF-TEST', 'fiche societe modifiable (module parametres)');
RESET ROLE;

-- Comptable : lecture seule ; chauffeur : aucun acces
SELECT pg_temp.se_connecter('00000000-0000-4000-8d00-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.contrats WHERE reference = 'TEST-CBG-01'), 1, 'un comptable lit les contrats');
SELECT throws_ok($$INSERT INTO public.contrats (reference, intitule, nature, contrepartie, devise, date_debut)
  VALUES ('TEST-Y', 'y', 'client', 'CBG', 'USD', '2026-01-01')$$, '42501', NULL, 'un comptable ne cree pas de contrat');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-8d00-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.contrats), 0, 'un chauffeur ne voit aucun contrat');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

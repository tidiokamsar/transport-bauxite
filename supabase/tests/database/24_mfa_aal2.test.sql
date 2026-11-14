-- Tests (D-040, LOT 02 phase 2) : socle MFA/AAL. La garde exige aal2 sur
-- les ecritures sensibles (droits par utilisateur, rectifications de tickets
-- CBG, signature de facture) quand le reglage mfa_exige est actif ; sans
-- reglage, rien ne change. La garantie est posee au niveau des donnees :
-- les ecritures de factures se font ici en superuser avec revendications,
-- pour que seul le declencheur decide ; le chemin reel des droits passe par
-- la fonction definir_droit_module. Tout est annule en fin de transaction.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

CREATE FUNCTION pg_temp.se_connecter(p_id uuid, p_aal text DEFAULT NULL) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), true),
         set_config('request.jwt.claims',
           CASE WHEN p_id IS NULL THEN '{}'
                ELSE json_build_object('sub', p_id, 'role', 'authenticated',
                                       'aal', p_aal)::text END,
           true);
$$;

SELECT plan(7);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-9700-000000000001', 'admin.d040@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-9700-000000000001', 'admin', 'Admin D-040', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, statut) VALUES
  ('00000000-0000-4000-9700-0000000000c1', 'TEST-MFA-CLI', 'Client test', 'client', 'CBG', 'USD', '2001-01-01', 'actif');

-- Sans reglage : la fonction reelle n'est pas genee (aal1 suffit).
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000001', 'aal1');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.definir_droit_module('00000000-0000-4000-9700-000000000001', 'fuel', 'lecture')$$,
  'sans reglage mfa_exige : attribution de droit autorisee (aal1 suffit)');
RESET ROLE;

-- Activation du reglage (ecriture interne, sans revendication).
INSERT INTO public.settings (key, value) VALUES ('mfa_exige', '{"value": "true"}');

-- aal1 (mot de passe seul) : refuse sur le chemin reel des droits.
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000001', 'aal1');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.definir_droit_module('00000000-0000-4000-9700-000000000001', 'trips', 'ecriture')$$,
  '42501', NULL, 'reglage actif : attribution de droit refusee sans aal2');
RESET ROLE;

-- Factures : seule la signature exige aal2 (garde au niveau des donnees).
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000001', 'aal1');
SELECT lives_ok($$INSERT INTO public.factures (contrat_id, objet, devise, taux_taxe_pct, montant_ht, statut)
  VALUES ('00000000-0000-4000-9700-0000000000c1', 'Test MFA', 'USD', 0, 100, 'brouillon')$$,
  'reglage actif : la creation d''une facture brouillon reste possible sans aal2');
SELECT lives_ok($$UPDATE public.factures SET montant_ht = 110 WHERE statut = 'brouillon'$$,
  'reglage actif : la facture brouillon reste modifiable sans aal2');
SELECT throws_ok($$UPDATE public.factures SET statut = 'signee' WHERE statut = 'brouillon'$$,
  '42501', NULL, 'reglage actif : signature de facture refusee sans aal2');

-- aal2 (MFA verifiee) : tout passe.
SELECT pg_temp.se_connecter('00000000-0000-4000-9700-000000000001', 'aal2');
SELECT lives_ok($$UPDATE public.factures SET statut = 'signee' WHERE statut = 'brouillon'$$,
  'aal2 : signature de facture acceptee');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.definir_droit_module('00000000-0000-4000-9700-000000000001', 'trips', 'ecriture')$$,
  'aal2 : attribution de droit acceptee');
RESET ROLE;

SELECT finish();
ROLLBACK;

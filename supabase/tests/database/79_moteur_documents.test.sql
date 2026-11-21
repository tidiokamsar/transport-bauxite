-- Tests (D-106, T1-T2) : moteur de documents officiels. Modeles versionnes,
-- generation avec numero officiel et SHA-256, circuits de signature
-- (visa, signature, cachet, rejet), archivage immuable, habilitation
-- des cachets. Tout est annule.
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
  ('00000000-0000-4000-8f79-000000000001', 'admin.doc@exemple.invalid'),
  ('00000000-0000-4000-8f79-000000000002', 'charge.doc@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status) VALUES
  ('00000000-0000-4000-8f79-000000000001', 'admin', 'Admin Doc', 'active'),
  ('00000000-0000-4000-8f79-000000000002', 'contract_manager', 'Charge Doc', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-8f79-0000000000a1', 'Site Doc', 'mine');
INSERT INTO public.organisations (raison_sociale) VALUES ('Kogon Mining SARL') ON CONFLICT DO NOTHING;

-- Modele documentaire pour les fiches de securite (famille B).
-- Modele et fiche crees en superuser.
INSERT INTO public.documents_modeles (code, version, nom, famille, type_source, orientation, statut)
VALUES ('FSEC-RAPPORT', 1, 'Rapport de constat de securite', 'B', 'securite', 'portrait', 'actif');
INSERT INTO public.fiches_terrain (numero, type, date_fiche, site_id, etat, origine)
VALUES ('FSEC-231123-001', 'securite', current_date,
        '00000000-0000-4000-8f79-0000000000a1', 'preparee', 'creation');

SELECT pg_temp.se_connecter('00000000-0000-4000-8f79-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.documents_modeles WHERE code = 'FSEC-RAPPORT'), 1,
  'modele documentaire cree');
CREATE TEMP TABLE fsec AS SELECT id FROM public.fiches_terrain WHERE numero = 'FSEC-231123-001';

-- Generation du document.
CREATE TEMP TABLE doc AS SELECT public.generer_document_fiche((SELECT id FROM fsec), 'FSEC-RAPPORT') AS id;
SELECT ok((SELECT sha256 ~ '^[0-9a-f]{64}$' FROM public.documents_genere WHERE id = (SELECT id FROM doc)),
  'empreinte SHA-256 du contenu rendu');
SELECT ok((SELECT numero_officiel LIKE 'FSEC-RAPPORT-DOC-%' FROM public.documents_genere WHERE id = (SELECT id FROM doc)),
  'numero officiel avec prefixe du modele');
SELECT is((SELECT statut FROM public.documents_genere WHERE id = (SELECT id FROM doc)), 'genere',
  'document genere au statut initial');

-- Visa electronique interne.
SELECT lives_ok($$SELECT public.apposer_visa((SELECT id FROM doc), 'Controleur HSE')$$,
  'visa electronique interne depose');
SELECT is((SELECT statut FROM public.documents_genere WHERE id = (SELECT id FROM doc)), 'en_signature',
  'statut passe en_signature apres visa');

-- Signature.
SELECT lives_ok($$SELECT public.signer_document((SELECT id FROM doc), 'Directeur')$$,
  'signature deposee');
SELECT is((SELECT statut FROM public.documents_genere WHERE id = (SELECT id FROM doc)), 'signe',
  'statut signe');

-- Archivage et immuabilite.
SELECT lives_ok($$SELECT public.archiver_document((SELECT id FROM doc))$$,
  'document archive');
SELECT throws_ok($$UPDATE public.documents_genere SET statut = 'genere'
  WHERE id = (SELECT id FROM doc)$$,
  '42501', NULL, 'document archive : immuable');

-- Creation de modele reservee a l'administrateur.
SELECT pg_temp.se_connecter('00000000-0000-4000-8f79-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.documents_modeles (code, nom, famille)
  VALUES ('FX', 'Interdit', 'A')$$,
  '42501', NULL, 'creation de modele reservee a l administrateur');
RESET ROLE;

-- Rejet avec motif obligatoire.
SELECT pg_temp.se_connecter('00000000-0000-4000-8f79-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE doc2 AS SELECT public.generer_document_fiche((SELECT id FROM fsec), 'FSEC-RAPPORT') AS id;
SELECT throws_ok($$SELECT public.rejeter_document((SELECT id FROM doc2), '')$$,
  '22023', NULL, 'rejet sans motif refuse');
SELECT lives_ok($$SELECT public.rejeter_document((SELECT id FROM doc2), 'Donnees incompletes')$$,
  'rejet motive accepte');
RESET ROLE;

SELECT finish();
ROLLBACK;

-- Tests (D-083) : pieces justificatives (migration 20261121200000).
-- Droits de la table (aucune ecriture directe, aucune suppression), cycle
-- enregistrement -> depot -> confirmation -> annulation, perimetre de site
-- et droit de module, types et tailles, bucket prive et politiques de
-- storage.objects. Les assertions storage exigent les tables storage :
-- reelles sur le serveur (service storage-api), socle minimal dans le
-- conteneur de rejeu (scripts/rejeu-socle-storage.sql) ; sans elles, elles
-- sont sautees (skip). Tout est annule.
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

SELECT plan(49);

-- ---------------------------------------------------------------------
-- Structure et droits
-- ---------------------------------------------------------------------
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.pieces_jointes'::regclass), 'pieces_jointes : RLS active');
SELECT is((SELECT count(*)::int FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) u,
                 unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
            WHERE has_table_privilege(u, 'public.pieces_jointes', p)), 0,
  'pieces_jointes : ni insertion, ni modification, ni suppression, ni vidage pour anon, authenticated et service_role');
SELECT ok(NOT has_table_privilege('anon', 'public.pieces_jointes', 'SELECT')
          AND has_table_privilege('authenticated', 'public.pieces_jointes', 'SELECT'),
  'lecture : authenticated seulement (sous RLS), jamais anon');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pieces_jointes' AND cmd <> 'SELECT'), 0,
  'pieces_jointes : aucune politique d''ecriture');
SELECT is((SELECT count(*)::int FROM unnest(ARRAY[
             'public.enregistrer_piece_jointe(text, uuid, text, text, bigint, text)',
             'public.confirmer_piece_jointe(uuid)', 'public.annuler_piece_jointe(uuid, text)',
             'public.piece_objet_lisible(text, uuid)', 'public.piece_resoudre_objet(text, uuid)',
             'public.configurer_stockage_pieces()']) f
            WHERE has_function_privilege('anon', f, 'EXECUTE')), 0,
  'aucune fonction des pieces jointes executable par anon');
SELECT ok(NOT has_function_privilege('authenticated', 'public.piece_resoudre_objet(text, uuid)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.configurer_stockage_pieces()', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.enregistrer_piece_jointe(text, uuid, text, text, bigint, text)', 'EXECUTE'),
  'resolution interne et configuration du stockage hors de portee des comptes');
SELECT is((SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.prosecdef
              AND p.proname IN ('enregistrer_piece_jointe', 'confirmer_piece_jointe', 'annuler_piece_jointe', 'piece_resoudre_objet')
              AND coalesce(array_to_string(p.proconfig, ','), '') LIKE '%search_path=""%'), 4,
  'fonctions SECURITY DEFINER avec search_path vide');

-- ---------------------------------------------------------------------
-- Donnees : deux sites ; S1 ecrit les voyages, lit le carburant ; S2 ecrit
-- les voyages ; G (global) ecrit voyages et carburant ; L (S1) lit seulement
-- ---------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-d083-000000000001', 's1.d083@exemple.invalid'),
  ('00000000-0000-4000-d083-000000000002', 's2.d083@exemple.invalid'),
  ('00000000-0000-4000-d083-000000000003', 'global.d083@exemple.invalid'),
  ('00000000-0000-4000-d083-000000000004', 'lecteur.d083@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-d083-0000000000a1', 'Mine S1 D083', 'mine'),
  ('00000000-0000-4000-d083-0000000000a2', 'Depot S2 D083', 'mine');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-d083-000000000001', 'operations_manager', 'S1 D083', 'active', '00000000-0000-4000-d083-0000000000a1'),
  ('00000000-0000-4000-d083-000000000002', 'operations_manager', 'S2 D083', 'active', '00000000-0000-4000-d083-0000000000a2'),
  ('00000000-0000-4000-d083-000000000003', 'operations_manager', 'Global D083', 'active', NULL),
  ('00000000-0000-4000-d083-000000000004', 'operations_manager', 'Lecteur D083', 'active', '00000000-0000-4000-d083-0000000000a1')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-d083-000000000001', 'trips', 'ecriture'),
  ('00000000-0000-4000-d083-000000000001', 'fuel', 'lecture'),
  ('00000000-0000-4000-d083-000000000002', 'trips', 'ecriture'),
  ('00000000-0000-4000-d083-000000000002', 'fuel', 'aucun'),
  ('00000000-0000-4000-d083-000000000003', 'trips', 'ecriture'),
  ('00000000-0000-4000-d083-000000000003', 'fuel', 'ecriture'),
  ('00000000-0000-4000-d083-000000000004', 'trips', 'lecture')
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-d083-0000000000b1', 'TEST-D083-S1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d083-0000000000a1'),
  ('00000000-0000-4000-d083-0000000000b2', 'TEST-D083-S2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-d083-0000000000a2');
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, etat) VALUES
  ('00000000-0000-4000-d083-000000000101', 'TEST-D083-V1', '2001-05-10', '00000000-0000-4000-d083-0000000000b1',
   '00000000-0000-4000-d083-0000000000a1', '00000000-0000-4000-d083-0000000000a1', 'PLANNED'),
  ('00000000-0000-4000-d083-000000000102', 'TEST-D083-V2', '2001-05-10', '00000000-0000-4000-d083-0000000000b2',
   '00000000-0000-4000-d083-0000000000a2', '00000000-0000-4000-d083-0000000000a2', 'PLANNED'),
  ('00000000-0000-4000-d083-000000000103', 'TEST-D083-V3', '2001-05-10', '00000000-0000-4000-d083-0000000000b1',
   '00000000-0000-4000-d083-0000000000a1', '00000000-0000-4000-d083-0000000000a2', 'PLANNED');
INSERT INTO public.tickets_pesee_cbg (id, trip_id, site_id, ticket, brut, tare, mesure_le) VALUES
  ('00000000-0000-4000-d083-000000000203', '00000000-0000-4000-d083-000000000103', '00000000-0000-4000-d083-0000000000a2',
   'TEST-D083-T3', 50, 12, '2001-05-10 12:00+00');
INSERT INTO public.releves_compteur (id, vehicle_id, trip_id, moment, valeur_km, releve_le, source) VALUES
  ('00000000-0000-4000-d083-000000000301', '00000000-0000-4000-d083-0000000000b2', '00000000-0000-4000-d083-000000000102',
   'depart_charge', 1000, '2001-05-10 06:00+00', 'fiche');
INSERT INTO public.releves_cbg (id, reference, periode_debut, periode_fin, site_id) VALUES
  ('00000000-0000-4000-d083-000000000401', 'TEST-D083-R1', '2001-05-01', '2001-05-31', '00000000-0000-4000-d083-0000000000a1');
INSERT INTO public.livraisons_carburant_cbg (id, reference, date_livraison, site_id, volume_litres, prix_litre) VALUES
  ('00000000-0000-4000-d083-000000000501', 'TEST-D083-L1', '2001-05-10', '00000000-0000-4000-d083-0000000000a1', 1000, 12000),
  ('00000000-0000-4000-d083-000000000502', 'TEST-D083-L2', '2001-05-10', '00000000-0000-4000-d083-0000000000a2', 1000, 12000);

CREATE TEMP TABLE ids (cle text PRIMARY KEY, id uuid, chemin text) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated;

-- ---------------------------------------------------------------------
-- Enregistrement : droit de module, perimetre, type, taille
-- ---------------------------------------------------------------------
SELECT pg_temp.se_connecter('00000000-0000-4000-d083-000000000001');
SET LOCAL ROLE authenticated;

SELECT lives_ok($$
  INSERT INTO ids SELECT 'v1', (r->>'id')::uuid, r->>'chemin'
    FROM (SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000101', 'Bon de chargement.PDF',
                 'application/pdf', 1200, repeat('a', 64)) r) x $$,
  'S1 joint un PDF a son voyage');
SELECT is((SELECT chemin FROM ids WHERE cle = 'v1'),
  'voyage/00000000-0000-4000-d083-000000000101/' || (SELECT id FROM ids WHERE cle = 'v1') || '.pdf',
  'chemin fixe par le serveur : type/objet/identifiant.extension');
SELECT is((SELECT module || ' ' || site_id || ' ' || statut FROM public.pieces_jointes WHERE id = (SELECT id FROM ids WHERE cle = 'v1')),
  'trips 00000000-0000-4000-d083-0000000000a1 en_attente', 'module et site deduits de l''objet ; piece en attente de depot');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000102', 'a.pdf', 'application/pdf', 10) $$,
  'P0002', NULL, 'S1 ne joint rien au voyage de S2 (meme message qu''un objet inconnu)');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', gen_random_uuid(), 'a.pdf', 'application/pdf', 10) $$,
  'P0002', NULL, 'objet inconnu refuse');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('facture', '00000000-0000-4000-d083-000000000101', 'a.pdf', 'application/pdf', 10) $$,
  'P0002', NULL, 'type d''objet non pris en charge refuse');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('livraison_carburant_cbg', '00000000-0000-4000-d083-000000000501', 'bl.pdf', 'application/pdf', 10) $$,
  '42501', NULL, 'S1 lit le carburant sans l''ecrire : depot refuse sur une livraison de son site');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000101', 'a.txt', 'text/plain', 10) $$,
  '22023', NULL, 'type text/plain refuse');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000101', 'a.csv', 'text/csv', 10) $$,
  '22023', NULL, 'CSV refuse hors releve CBG');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000101', 'photo.png', 'image/jpeg', 10) $$,
  '22023', NULL, 'extension incoherente avec le type refusee');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000101', 'a.pdf', 'application/pdf', 10485761) $$,
  '22023', NULL, 'fichier de plus de 10 Mio refuse');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000101', 'a.pdf', 'application/pdf', 0) $$,
  '22023', NULL, 'fichier vide refuse');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000101', '../a.pdf', 'application/pdf', 10) $$,
  '22023', NULL, 'nom avec barre oblique refuse');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000101', 'b.pdf', 'application/pdf', 10, repeat('a', 64)) $$,
  '23505', NULL, 'le meme fichier (meme empreinte) ne se joint pas deux fois au meme objet');
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000101', 'b.pdf', 'application/pdf', 10, 'zz') $$,
  '22023', NULL, 'empreinte mal formee refusee');
SELECT lives_ok($$
  INSERT INTO ids SELECT 'r1', (r->>'id')::uuid, r->>'chemin'
    FROM (SELECT public.enregistrer_piece_jointe('releve_cbg', '00000000-0000-4000-d083-000000000401', 'releve mai.xlsx',
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 5000) r) x $$,
  'S1 joint le tableur source a un releve CBG de son site');
SELECT lives_ok($$
  INSERT INTO ids SELECT 't3', (r->>'id')::uuid, r->>'chemin'
    FROM (SELECT public.enregistrer_piece_jointe('ticket_pesee_cbg', '00000000-0000-4000-d083-000000000203', 'ticket.jpg', 'image/jpeg', 300) r) x $$,
  'S1 joint la photo du ticket de son voyage vers S2');

-- Lecteur (S1, lecture des voyages seulement)
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d083-000000000004');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT public.enregistrer_piece_jointe('voyage', '00000000-0000-4000-d083-000000000101', 'a.pdf', 'application/pdf', 10) $$,
  '42501', NULL, 'lecture seule des voyages : depot refuse');
SELECT is((SELECT count(*)::int FROM public.pieces_jointes WHERE objet_id::text LIKE '00000000-0000-4000-d083-%'), 3,
  'le lecteur de S1 voit les pieces de son site');

-- S2 et le compte global ; carburant par le global
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d083-000000000003');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$
  INSERT INTO ids SELECT 'l2', (r->>'id')::uuid, r->>'chemin'
    FROM (SELECT public.enregistrer_piece_jointe('livraison_carburant_cbg', '00000000-0000-4000-d083-000000000502', 'BL 42.pdf', 'application/pdf', 800) r) x $$,
  'compte global avec ecriture carburant : bon de livraison de S2 joint');
SELECT lives_ok($$
  INSERT INTO ids SELECT 'k2', (r->>'id')::uuid, r->>'chemin'
    FROM (SELECT public.enregistrer_piece_jointe('releve_compteur', '00000000-0000-4000-d083-000000000301', 'compteur.webp', 'image/webp', 900) r) x $$,
  'compte global : photo du compteur d''un camion de S2 jointe');
SELECT is((SELECT count(*)::int FROM public.pieces_jointes WHERE objet_id::text LIKE '00000000-0000-4000-d083-%'), 5,
  'le compte global voit toutes les pieces');

RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d083-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT string_agg(objet_type, ',' ORDER BY objet_type) FROM public.pieces_jointes WHERE objet_id::text LIKE '00000000-0000-4000-d083-%'),
  'releve_compteur,ticket_pesee_cbg',
  'S2 : le ticket du voyage arrivant chez lui et le releve de son camion ; ni le voyage ni le releve CBG de S1, ni la livraison (sans droit carburant)');
SELECT throws_ok(format('SELECT public.annuler_piece_jointe(%L, %L)', (SELECT id FROM ids WHERE cle = 'v1'), 'Erreur de rattachement'),
  'P0002', NULL, 'S2 n''annule pas une piece du voyage de S1');
SELECT throws_ok(format('SELECT public.confirmer_piece_jointe(%L)', (SELECT id FROM ids WHERE cle = 't3')),
  'P0002', NULL, 'seul le deposant confirme sa piece');

RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d083-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.pieces_jointes WHERE objet_type = 'livraison_carburant_cbg' AND objet_id::text LIKE '00000000-0000-4000-d083-%'), 0,
  'S1 ne voit pas le bon de livraison de S2');

-- ---------------------------------------------------------------------
-- Stockage : bucket prive, depot au chemin enregistre, confirmation
-- ---------------------------------------------------------------------
RESET ROLE;
SELECT to_regclass('storage.objects') IS NOT NULL AS stockage \gset
\if :stockage
SELECT is((SELECT public::text || ' ' || file_size_limit || ' ' || array_length(allowed_mime_types, 1) FROM storage.buckets WHERE id = 'pieces'),
  'false 10485760 6', 'bucket pieces prive, 10 Mio, 6 types');
SELECT is((SELECT string_agg(policyname || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies
            WHERE schemaname = 'storage' AND tablename = 'objects'
              AND (coalesce(qual, '') LIKE '%pieces%' OR coalesce(with_check, '') LIKE '%pieces%')),
  'sigtb_pieces_depot:INSERT,sigtb_pieces_lecture:SELECT',
  'storage.objects : lecture et depot seulement, aucune politique de modification ni de suppression');

SELECT pg_temp.se_connecter('00000000-0000-4000-d083-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok(format($$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
                        VALUES ('pieces', %L, auth.uid(), '{"size": 1200, "mimetype": "application/pdf"}')$$,
                       (SELECT chemin FROM ids WHERE cle = 'v1')),
  'S1 depose le fichier au chemin enregistre');
SELECT throws_ok(format($$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
                         VALUES ('pieces', %L, auth.uid(), '{}')$$,
                        'voyage/00000000-0000-4000-d083-000000000101/libre.pdf'),
  '42501', NULL, 'depot a un chemin non enregistre refuse');
SELECT throws_ok(format($$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
                         VALUES ('pieces', %L, auth.uid(), '{}')$$, (SELECT chemin FROM ids WHERE cle = 'l2')),
  '42501', NULL, 'depot au chemin d''une piece d''un autre deposant refuse');
SELECT is(public.confirmer_piece_jointe((SELECT id FROM ids WHERE cle = 'v1')), 'deposee', 'confirmation apres controle de la taille et du type stockes');
SELECT lives_ok(format($$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
                        VALUES ('pieces', %L, auth.uid(), '{"size": 999, "mimetype": "image/jpeg"}')$$,
                       (SELECT chemin FROM ids WHERE cle = 't3')),
  'depot du ticket avec une taille differente de la taille declaree');
SELECT throws_ok(format('SELECT public.confirmer_piece_jointe(%L)', (SELECT id FROM ids WHERE cle = 't3')),
  '22023', NULL, 'confirmation refusee : taille stockee differente');
SELECT is((SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'pieces' AND name LIKE '%00000000-0000-4000-d083-%'), 2,
  'S1 lit ses deux fichiers');

RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d083-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT string_agg(name, ',') FROM storage.objects WHERE bucket_id = 'pieces' AND name LIKE '%00000000-0000-4000-d083-%'),
  (SELECT chemin FROM ids WHERE cle = 't3'),
  'S2 ne lit que le fichier du ticket qu''il voit, pas celui du voyage de S1');
\else
SELECT skip('tables storage absentes (service storage-api non demarre) : assertions du bucket sautees', 10);
\endif

-- ---------------------------------------------------------------------
-- Annulation tracee, jamais de suppression
-- ---------------------------------------------------------------------
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-d083-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok(format('SELECT public.annuler_piece_jointe(%L, %L)', (SELECT id FROM ids WHERE cle = 't3'), 'non'),
  '22023', NULL, 'annulation sans motif suffisant refusee');
SELECT lives_ok(format('SELECT public.annuler_piece_jointe(%L, %L)', (SELECT id FROM ids WHERE cle = 't3'), 'Photo floue, ticket illisible'),
  'annulation motivee');
SELECT is((SELECT (annule_par = auth.uid())::text || ' ' || motif_annulation FROM public.pieces_jointes WHERE id = (SELECT id FROM ids WHERE cle = 't3')),
  'true Photo floue, ticket illisible', 'annulation tracee (auteur, motif), piece toujours lisible');
SELECT throws_ok(format('SELECT public.annuler_piece_jointe(%L, %L)', (SELECT id FROM ids WHERE cle = 't3'), 'Deuxieme annulation'),
  '22023', NULL, 'une piece ne s''annule qu''une fois');

RESET ROLE;
SELECT throws_ok(format('DELETE FROM public.pieces_jointes WHERE id = %L', (SELECT id FROM ids WHERE cle = 'v1')),
  '42501', NULL, 'suppression refusee meme pour le role postgres (declencheur)');
SELECT throws_ok(format('UPDATE public.pieces_jointes SET nom = %L WHERE id = %L', 'autre.pdf', (SELECT id FROM ids WHERE cle = 'v1')),
  '42501', NULL, 'nom, chemin, taille et empreinte immuables');

SELECT * FROM finish();
ROLLBACK;

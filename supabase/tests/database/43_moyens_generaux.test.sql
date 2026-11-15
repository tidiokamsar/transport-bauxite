-- Tests (D-060) : registre du patrimoine, cycle par journal append-only
-- (affectation, remise, restitution, transfert, reforme, annulation de la
-- derniere operation), amortissement lineaire seulement si saisi, perimetre
-- site, inventaire physique et ecarts (migration 20261118150000).
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

SELECT plan(30);

SELECT is(
  (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relrowsecurity
      AND c.relname IN ('biens', 'biens_operations', 'inventaires_biens', 'inventaires_biens_lignes')),
  4, 'RLS active sur les quatre tables');

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a600-000000000001', 'admin.d060@exemple.invalid'),
  ('00000000-0000-4000-a600-000000000002', 'chauffeur.d060@exemple.invalid'),
  ('00000000-0000-4000-a600-000000000003', 'admin.site.d060@exemple.invalid'),
  ('00000000-0000-4000-a600-000000000004', 'logisticien.d060@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-a600-0000000000a1', 'Siege D-060', 'depot'),
  ('00000000-0000-4000-a600-0000000000a2', 'Autre site D-060', 'depot');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a600-000000000001', 'admin', 'Admin D-060', 'active', NULL),
  ('00000000-0000-4000-a600-000000000002', 'driver', 'Chauffeur D-060', 'active', NULL),
  ('00000000-0000-4000-a600-000000000003', 'admin', 'Admin site D-060', 'active', '00000000-0000-4000-a600-0000000000a2'),
  ('00000000-0000-4000-a600-000000000004', 'logistician', 'Logisticien D-060', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;

-- Le logisticien (ecriture du module stock) enregistre les biens.
SELECT pg_temp.se_connecter('00000000-0000-4000-a600-000000000004');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE b AS SELECT
  public.enregistrer_bien(p_numero => ' pc-001 ', p_categorie => 'informatique', p_designation => 'Ordinateur portable',
    p_site => '00000000-0000-4000-a600-0000000000a1', p_etat => 'bon') AS b1,
  public.enregistrer_bien(p_numero => 'MOB-001', p_categorie => 'mobilier', p_designation => 'Bureau',
    p_site => '00000000-0000-4000-a600-0000000000a1', p_valeur_acquisition => 900000) AS b2,
  public.enregistrer_bien(p_numero => 'OUT-001', p_categorie => 'outillage', p_designation => 'Perceuse',
    p_site => '00000000-0000-4000-a600-0000000000a1', p_valeur_acquisition => 1200000,
    p_date_acquisition => (current_date - interval '6 months')::date, p_duree_amortissement_mois => 12) AS b3;
SELECT is((SELECT statut || ' ' || numero_inventaire || ' ' || etat_physique FROM public.biens WHERE id = (SELECT b1 FROM b)),
  'en_stock PC-001 bon', 'bien enregistre en stock, numero normalise');
SELECT throws_ok($$SELECT public.enregistrer_bien(p_numero => 'pc-001', p_categorie => 'autre', p_designation => 'Doublon', p_site => '00000000-0000-4000-a600-0000000000a1')$$,
  '23505', NULL, 'numero d''inventaire deja attribue : refuse');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a600-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_bien(p_numero => 'X-1', p_categorie => 'autre', p_designation => 'X', p_site => '00000000-0000-4000-a600-0000000000a1')$$,
  '42501', NULL, 'sans droit d''ecriture : refuse');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a600-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.affecter_bien(p_bien => (SELECT b1 FROM b), p_beneficiaire_type => 'service', p_beneficiaire => ' Service informatique ');
SELECT is((SELECT statut || ' ' || beneficiaire FROM public.biens WHERE id = (SELECT b1 FROM b)), 'affecte Service informatique', 'affectation a un service');
SELECT throws_ok($$SELECT public.transferer_bien(p_bien => (SELECT b1 FROM b), p_site => '00000000-0000-4000-a600-0000000000a2')$$,
  '22023', NULL, 'transfert d''un bien affecte : refuse');
SELECT public.remettre_bien(p_bien => (SELECT b1 FROM b), p_reference => 'PV-12');
SELECT is((SELECT statut FROM public.biens WHERE id = (SELECT b1 FROM b)), 'remis', 'remise au beneficiaire');
SELECT throws_ok($$SELECT public.reformer_bien(p_bien => (SELECT b1 FROM b), p_motif => 'Test')$$,
  '22023', NULL, 'reforme d''un bien remis : refuse');
SELECT public.restituer_bien(p_bien => (SELECT b1 FROM b), p_etat => 'mauvais');
SELECT is((SELECT statut || ' ' || etat_physique || ' ' || coalesce(beneficiaire, '-') FROM public.biens WHERE id = (SELECT b1 FROM b)),
  'en_stock mauvais -', 'restitution : en stock, etat constate, beneficiaire libere');
SELECT throws_ok($$SELECT public.annuler_operation_bien((SELECT id FROM public.biens_operations WHERE bien_id = (SELECT b1 FROM b) AND type = 'remise'), 'Test')$$,
  '22023', NULL, 'seule la derniere operation s''annule');
SELECT public.annuler_operation_bien((SELECT id FROM public.biens_operations WHERE bien_id = (SELECT b1 FROM b) AND type = 'restitution'), 'Saisie sur le mauvais bien');
SELECT is((SELECT statut || ' ' || etat_physique || ' ' || beneficiaire FROM public.biens WHERE id = (SELECT b1 FROM b)),
  'remis bon Service informatique', 'annulation de la restitution : etat precedent retabli');
SELECT throws_ok($$SELECT public.annuler_operation_bien((SELECT id FROM public.biens_operations WHERE bien_id = (SELECT b1 FROM b) AND type = 'entree'), 'Test')$$,
  '22023', NULL, 'l''entree ne s''annule pas');
SELECT throws_ok($$UPDATE public.biens_operations SET motif = 'x' WHERE bien_id = (SELECT b1 FROM b)$$, '42501', NULL, 'journal non modifiable');
SELECT throws_ok($$UPDATE public.biens SET statut = 'reforme' WHERE id = (SELECT b1 FROM b)$$, '42501', NULL, 'registre non modifiable directement');
SELECT is((SELECT amortissement_cumule::text || ' ' || valeur_nette::text || ' ' || mois_amortis::text FROM public.v_biens WHERE id = (SELECT b3 FROM b)),
  '600000 600000 6', 'amortissement lineaire : 6 mois sur 12');
SELECT is((SELECT valeur_nette FROM public.v_biens WHERE id = (SELECT b2 FROM b)), NULL::bigint, 'sans duree saisie : pas d''amortissement');
SELECT public.modifier_fiche_bien(p_bien => (SELECT b3 FROM b), p_motif => 'Duree corrigee', p_categorie => 'outillage', p_designation => 'Perceuse',
  p_date_acquisition => (current_date - interval '6 months')::date, p_valeur_acquisition => 1200000, p_duree_amortissement_mois => 24);
SELECT is((SELECT amortissement_cumule FROM public.v_biens WHERE id = (SELECT b3 FROM b)), 300000::bigint, 'fiche modifiee : amortissement recalcule');
SELECT is((SELECT donnees -> 'avant' ->> 'duree_amortissement_mois' FROM public.biens_operations WHERE bien_id = (SELECT b3 FROM b) AND type = 'fiche'),
  '12', 'modification de fiche journalisee (valeur avant)');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a600-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.biens WHERE site_id = '00000000-0000-4000-a600-0000000000a1'), 0, 'bien d''un autre site : invisible');
SELECT throws_ok($$SELECT public.constater_etat_bien(p_bien => (SELECT b2 FROM b), p_etat => 'bon')$$,
  '42501', NULL, 'operation sur un bien d''un autre site : refusee');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a600-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.restituer_bien(p_bien => (SELECT b1 FROM b));
SELECT public.transferer_bien(p_bien => (SELECT b1 FROM b), p_site => '00000000-0000-4000-a600-0000000000a2', p_reference => 'BT-3');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a600-000000000003');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.biens WHERE id = (SELECT b1 FROM b)), 1, 'transfert : le bien rejoint le site de destination');
RESET ROLE;

-- Inventaire physique du site a1 (attendus : MOB-001 et OUT-001).
SELECT pg_temp.se_connecter('00000000-0000-4000-a600-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE inv AS SELECT public.ouvrir_inventaire_biens(p_site => '00000000-0000-4000-a600-0000000000a1', p_libelle => 'Inventaire annuel') AS i;
SELECT throws_ok($$SELECT public.ouvrir_inventaire_biens(p_site => '00000000-0000-4000-a600-0000000000a1', p_libelle => 'Doublon')$$,
  '22023', NULL, 'une seule campagne ouverte par site');
SELECT public.constater_inventaire_bien(p_inventaire => (SELECT i FROM inv), p_numero => 'mob-001', p_etat => 'bon', p_localisation => 'Bureau 2');
SELECT public.constater_inventaire_bien(p_inventaire => (SELECT i FROM inv), p_numero => 'PC-001');
SELECT public.constater_inventaire_bien(p_inventaire => (SELECT i FROM inv), p_numero => 'INCONNU-9', p_designation => 'Chaise');
SELECT is((SELECT string_agg(resultat, ' ' ORDER BY resultat) FROM public.inventaires_biens_lignes WHERE inventaire_id = (SELECT i FROM inv)),
  'constate hors_site non_reference', 'constats : bien attendu, bien d''un autre site, bien non reference');
SELECT throws_ok($$SELECT public.constater_inventaire_bien(p_inventaire => (SELECT i FROM inv), p_numero => 'MOB-001')$$,
  '22023', NULL, 'bien deja constate : refuse');
SELECT is((SELECT string_agg(numero, ' ') FROM public.v_inventaires_biens_ecarts WHERE inventaire_id = (SELECT i FROM inv) AND ecart = 'manquant' AND provisoire),
  'OUT-001', 'manquant provisoire tant que la campagne est ouverte');
SELECT is(public.cloturer_inventaire_biens((SELECT i FROM inv)), 1, 'cloture : un manquant fige');
SELECT is((SELECT nb_attendus || ' ' || nb_constates || ' ' || nb_manquants || ' ' || nb_hors_site || ' ' || nb_non_references
             FROM public.v_inventaires_biens WHERE id = (SELECT i FROM inv)),
  '2 1 1 1 1', 'compteurs de la campagne cloturee');
SELECT throws_ok($$SELECT public.constater_inventaire_bien(p_inventaire => (SELECT i FROM inv), p_numero => 'OUT-001')$$,
  '22023', NULL, 'campagne cloturee : constat refuse');
SELECT is((SELECT statut FROM public.biens WHERE id = (SELECT b3 FROM b)), 'en_stock', 'le registre n''est pas modifie par l''inventaire');

SELECT public.reformer_bien(p_bien => (SELECT b2 FROM b), p_motif => 'Casse');
SELECT throws_ok($$SELECT public.affecter_bien(p_bien => (SELECT b2 FROM b), p_beneficiaire_type => 'personne', p_beneficiaire => 'A. Camara')$$,
  '22023', NULL, 'bien reforme : affectation refusee');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

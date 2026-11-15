-- Tests (D-059) : fiche fournisseur par fonctions serveur, contacts,
-- documents et alerte d'echeance, evaluation ponderee append-only,
-- suspension motivee qui bloque les bons, consultations et selection
-- motivee qui prepare un bon brouillon (migration 20261118120000).
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

SELECT plan(42);

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a590-000000000001', 'logistique.d059@exemple.invalid'),
  ('00000000-0000-4000-a590-000000000002', 'comptable.d059@exemple.invalid'),
  ('00000000-0000-4000-a590-000000000003', 'admin.d059@exemple.invalid'),
  ('00000000-0000-4000-a590-000000000004', 'mecanicien.d059@exemple.invalid'),
  ('00000000-0000-4000-a590-000000000005', 'chauffeur.d059@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-a590-000000000001', 'logistician', 'Logistique D-059', 'active', NULL),
  ('00000000-0000-4000-a590-000000000002', 'accountant', 'Comptable D-059', 'active', NULL),
  ('00000000-0000-4000-a590-000000000003', 'admin', 'Admin D-059', 'active', NULL),
  ('00000000-0000-4000-a590-000000000004', 'maintenance_chief', 'Mecanicien D-059', 'active', NULL),
  ('00000000-0000-4000-a590-000000000005', 'driver', 'Chauffeur D-059', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-a590-0000000000a1', 'Site D-059', 'depot');
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-a590-0000000000d1', 'Magasin D-059', 'TEST-MAG-D059', 'main', '00000000-0000-4000-a590-0000000000a1');
INSERT INTO public.stock_items (id, item_code, name, unit_of_measure) VALUES
  ('00000000-0000-4000-a590-0000000000e1', 'TEST-ART-D059', 'Filtre D-059', 'piece');
DELETE FROM public.settings WHERE key IN ('consultation_offres_minimum', 'fournisseurs_alerte_documents_jours', 'achats_validation_separee');
UPDATE public.criteres_evaluation_fournisseur SET actif = false;

-- Logistique : fiche, contacts, documents
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE f1 AS SELECT public.enregistrer_fournisseur('Pieces Kogon D-059', 'parts', p_telephone => '+224 600 00 00 01') AS id;
CREATE TEMP TABLE f2 AS SELECT public.enregistrer_fournisseur('Pneus Boke D-059', 'tires', p_identifiant_fiscal => 'NIF-D059-2') AS id;
SELECT matches((SELECT supplier_number FROM public.suppliers WHERE id = (SELECT id FROM f1)), '^FRS-[0-9]{5}$', 'numero attribue par le serveur');
SELECT throws_ok($$INSERT INTO public.suppliers (supplier_number, supplier_type, company_name) VALUES ('X', 'parts', 'X')$$,
  '42501', NULL, 'creation directe refusee');
SELECT throws_ok($$UPDATE public.suppliers SET active = false WHERE id = (SELECT id FROM f1)$$, '42501', NULL, 'modification directe refusee');
SELECT throws_ok($$DELETE FROM public.suppliers WHERE id = (SELECT id FROM f1)$$, '42501', NULL, 'suppression physique refusee');
SELECT throws_ok($$SELECT public.enregistrer_fournisseur(' pieces kogon d-059 ', 'parts')$$, '23505', NULL, 'raison sociale en double refusee');
SELECT throws_ok($$SELECT public.enregistrer_fournisseur('Autre D-059', 'parts', p_identifiant_fiscal => 'nif-d059-2')$$, '23505', NULL,
  'identifiant fiscal en double refuse');
SELECT public.enregistrer_fournisseur('Pieces Kogon D-059', 'parts', (SELECT id FROM f1), p_telephone => '+224 600 00 00 01', p_ville => 'Boke');
SELECT is((SELECT details -> 'ville' ->> 'apres' FROM public.fournisseurs_journal WHERE supplier_id = (SELECT id FROM f1) AND evenement = 'modification'),
  'Boke', 'modification journalisee avec la valeur nouvelle');
SELECT throws_ok($$SELECT public.enregistrer_contact_fournisseur((SELECT id FROM f1), 'Sans moyen')$$, '22023', NULL,
  'contact sans telephone ni courriel refuse');
SELECT public.enregistrer_contact_fournisseur((SELECT id FROM f1), 'Mamadou D-059', 'Commercial', '+224 600 00 00 02', NULL, true);
SELECT public.enregistrer_contact_fournisseur((SELECT id FROM f1), 'Fatoumata D-059', 'Directrice', NULL, 'f.d059@exemple.invalid', true);
SELECT is((SELECT string_agg(nom, ',') FROM public.contacts_fournisseurs WHERE supplier_id = (SELECT id FROM f1) AND principal AND actif),
  'Fatoumata D-059', 'un seul contact principal');
SELECT public.enregistrer_document_fournisseur((SELECT id FROM f1), 'attestation_fiscale', 'Classeur A3', 'AF-1',
  current_date - 300, current_date + 10);
SELECT is((SELECT etat FROM public.v_documents_fournisseurs_echeance WHERE supplier_id = (SELECT id FROM f1)), 'a_renouveler',
  'document proche de l''expiration signale (30 jours par defaut)');
SELECT throws_ok($$SELECT public.enregistrer_document_fournisseur((SELECT id FROM f1), 'assurance', '  ')$$, '22023', NULL,
  'reference de la piece requise');
SELECT public.enregistrer_document_fournisseur((SELECT id FROM f1), 'attestation_fiscale', 'Classeur A3', 'AF-2', current_date, current_date + 365);
SELECT is((SELECT count(*)::int FROM public.v_documents_fournisseurs_echeance WHERE supplier_id = (SELECT id FROM f1)), 0,
  'document renouvele : plus d''alerte');
SELECT throws_ok($$SELECT public.evaluer_fournisseur((SELECT id FROM f1), current_date - 30, current_date, '[]'::jsonb)$$, '22023', NULL,
  'evaluation impossible sans grille');
SELECT throws_ok($$SELECT public.definir_critere_evaluation('Delais', 2)$$, '42501', NULL, 'grille : administrateur seulement');
-- Un brouillon pour f2, avant sa suspension
CREATE TEMP TABLE bc_f2 AS SELECT public.enregistrer_bon_commande((SELECT id FROM f2), '00000000-0000-4000-a590-0000000000d1',
  '[{"designation": "Pneu", "quantite": 1, "prix_unitaire": 1000}]'::jsonb) AS id;
SELECT throws_ok($$SELECT public.suspendre_fournisseur((SELECT id FROM f2), 'Retards')$$, '42501', NULL,
  'suspension : droit d''approbation des achats requis');
RESET ROLE;

-- Administrateur : grille ponderee
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000003');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE c1 AS SELECT public.definir_critere_evaluation('Respect des delais D-059', 2) AS id;
CREATE TEMP TABLE c2 AS SELECT public.definir_critere_evaluation('Qualite D-059', 1) AS id;
RESET ROLE;

-- Logistique : evaluation
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.evaluer_fournisseur((SELECT id FROM f1), current_date - 30, current_date,
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM c1), 'note', 4)))$$, '22023', NULL, 'chaque critere actif doit etre note');
SELECT throws_ok($$SELECT public.evaluer_fournisseur((SELECT id FROM f1), current_date - 30, current_date,
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM c1), 'note', 6), jsonb_build_object('critere', (SELECT id FROM c2), 'note', 1)))$$,
  '22023', NULL, 'note hors de l''echelle 1 a 5 refusee');
CREATE TEMP TABLE ev1 AS SELECT public.evaluer_fournisseur((SELECT id FROM f1), current_date - 30, current_date,
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM c1), 'note', 4), jsonb_build_object('critere', (SELECT id FROM c2), 'note', 1)),
  'Livraisons a l''heure') AS id;
SELECT is((SELECT note_globale FROM public.evaluations_fournisseurs WHERE id = (SELECT id FROM ev1)), 3.00::numeric(4,2),
  'note globale ponderee calculee par le serveur');
SELECT throws_ok($$SELECT public.evaluer_fournisseur((SELECT id FROM f1), current_date - 30, current_date,
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM c1), 'note', 5), jsonb_build_object('critere', (SELECT id FROM c2), 'note', 5)))$$,
  '22023', NULL, 'periode deja evaluee : motif de correction requis');
SELECT public.evaluer_fournisseur((SELECT id FROM f1), current_date - 30, current_date,
  jsonb_build_array(jsonb_build_object('critere', (SELECT id FROM c1), 'note', 5), jsonb_build_object('critere', (SELECT id FROM c2), 'note', 5)),
  NULL, 'Erreur de saisie');
SELECT is((SELECT string_agg(note_globale::text, ',') FROM public.v_evaluations_fournisseurs_courantes WHERE supplier_id = (SELECT id FROM f1)),
  '5.00', 'la correction remplace l''evaluation precedente');
SELECT is((SELECT count(*)::int FROM public.evaluations_fournisseurs WHERE supplier_id = (SELECT id FROM f1)), 2, 'l''evaluation corrigee reste conservee');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000001');
SELECT throws_ok($$UPDATE public.evaluations_fournisseurs SET note_globale = 1 WHERE id = (SELECT id FROM ev1)$$, '42501', NULL,
  'evaluation non modifiable, meme hors API');

-- Comptable : suspension motivee
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000002');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.suspendre_fournisseur((SELECT id FROM f2), ' ')$$, '22023', NULL, 'suspension sans motif refusee');
SELECT lives_ok($$SELECT public.suspendre_fournisseur((SELECT id FROM f2), 'Retards repetes')$$, 'suspension motivee');
RESET ROLE;

-- Logistique : un fournisseur suspendu ne recoit plus de bon
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.enregistrer_bon_commande((SELECT id FROM f2), '00000000-0000-4000-a590-0000000000d1',
  '[{"designation": "Pneu", "quantite": 1, "prix_unitaire": 1000}]'::jsonb)$$, '22023', NULL, 'nouveau bon refuse (D-053)');
SELECT throws_ok($$SELECT public.soumettre_bon_commande((SELECT id FROM bc_f2))$$, '22023', NULL, 'brouillon existant : soumission refusee');
SELECT throws_ok($$SELECT public.creer_consultation('Pneus', '[{"designation": "Pneu", "quantite": 4}]'::jsonb, ARRAY[(SELECT id FROM f2)])$$,
  '22023', NULL, 'fournisseur suspendu non consultable');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000002');
SET LOCAL ROLE authenticated;
SELECT public.reactiver_fournisseur((SELECT id FROM f2), 'Plan d''action accepte');
SELECT is((SELECT string_agg(evenement, ',' ORDER BY le) FROM public.fournisseurs_journal WHERE supplier_id = (SELECT id FROM f2)
            AND evenement IN ('suspension', 'reactivation')), 'suspension,reactivation', 'suspension et reactivation journalisees');
RESET ROLE;

-- Logistique : consultation, offres, selection
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE f3 AS SELECT public.enregistrer_fournisseur('Non consulte D-059', 'other', p_email => 'nc.d059@exemple.invalid') AS id;
CREATE TEMP TABLE cons AS SELECT public.creer_consultation('Filtres et transport',
  '[{"article": "00000000-0000-4000-a590-0000000000e1", "quantite": 10}, {"designation": "Transport", "quantite": 2}]'::jsonb,
  ARRAY[(SELECT id FROM f1), (SELECT id FROM f2)], '00000000-0000-4000-a590-0000000000d1', current_date + 7) AS id;
SELECT matches((SELECT numero FROM public.consultations_fournisseurs WHERE id = (SELECT id FROM cons)), '^CONS-[0-9]{4}-[0-9]{5}$',
  'numero de consultation attribue par le serveur');
CREATE TEMP TABLE lc AS SELECT id, ordre FROM public.consultations_lignes WHERE consultation_id = (SELECT id FROM cons);
SELECT throws_ok($$SELECT public.enregistrer_offre((SELECT id FROM cons), (SELECT id FROM f3),
  jsonb_build_array(jsonb_build_object('ligne', (SELECT id FROM lc WHERE ordre = 1), 'prix_unitaire', 80)), 5)$$,
  '22023', NULL, 'offre d''un fournisseur non consulte refusee');
CREATE TEMP TABLE o1 AS SELECT public.enregistrer_offre((SELECT id FROM cons), (SELECT id FROM f1),
  jsonb_build_array(jsonb_build_object('ligne', (SELECT id FROM lc WHERE ordre = 1), 'prix_unitaire', 100),
                    jsonb_build_object('ligne', (SELECT id FROM lc WHERE ordre = 2), 'prix_unitaire', 50)), 7, p_reference => 'DEV-17') AS id;
SELECT is((SELECT montant_total FROM public.offres_fournisseurs WHERE id = (SELECT id FROM o1)), 1100::bigint, 'montant de l''offre calcule par le serveur');
SELECT throws_ok($$SELECT public.enregistrer_offre((SELECT id FROM cons), (SELECT id FROM f1),
  jsonb_build_array(jsonb_build_object('ligne', (SELECT id FROM lc WHERE ordre = 1), 'prix_unitaire', 90)), 7)$$,
  '22023', NULL, 'deuxieme offre du meme fournisseur refusee');
CREATE TEMP TABLE o2 AS SELECT public.enregistrer_offre((SELECT id FROM cons), (SELECT id FROM f2),
  jsonb_build_array(jsonb_build_object('ligne', (SELECT id FROM lc WHERE ordre = 1), 'prix_unitaire', 90)), 3) AS id;
SELECT throws_ok($$SELECT public.selectionner_offre((SELECT id FROM o1), '')$$, '22023', NULL, 'selection sans motif refusee');
RESET ROLE;
INSERT INTO public.settings (key, value, category) VALUES ('consultation_offres_minimum', '{"value": "3"}', 'achats');
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.selectionner_offre((SELECT id FROM o1), 'Offre complete')$$, '22023', NULL,
  'nombre minimal d''offres du reglage respecte');
RESET ROLE;
DELETE FROM public.settings WHERE key = 'consultation_offres_minimum';
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE bc AS SELECT public.selectionner_offre((SELECT id FROM o1), 'Seule offre complete (transport chiffre)') AS id;
SELECT is((SELECT status || ' ' || total_amount || ' ' || (supplier_id = (SELECT id FROM f1))::text FROM public.purchase_orders WHERE id = (SELECT id FROM bc)),
  'draft 1100 true', 'bon brouillon prepare depuis l''offre retenue');
SELECT is((SELECT count(*)::int FROM public.purchase_order_items WHERE purchase_order_id = (SELECT id FROM bc)), 2, 'lignes de l''offre reprises');
SELECT is((SELECT c.statut || ' ' || o.statut FROM public.consultations_fournisseurs c, public.offres_fournisseurs o
            WHERE c.id = (SELECT id FROM cons) AND o.id = (SELECT id FROM o2)), 'attribuee ecartee', 'consultation attribuee, autre offre ecartee');
SELECT throws_ok($$SELECT public.preparer_bon_commande_consultation((SELECT id FROM cons))$$, '22023', NULL, 'un seul bon en cours par consultation');
SELECT throws_ok($$UPDATE public.consultations_journal SET motif = 'x' WHERE consultation_id = (SELECT id FROM cons)$$, '42501', NULL,
  'journal des consultations non modifiable');
RESET ROLE;

-- Lecture : mecanicien (stocks) voit les fiches, pas les consultations ;
-- chauffeur ne voit rien.
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.suppliers WHERE id = (SELECT id FROM f1)) || ' '
          || (SELECT count(*)::int FROM public.consultations_fournisseurs WHERE id = (SELECT id FROM cons)), '1 0',
  'stocks : fiche visible, consultation non');
SELECT throws_ok($$SELECT public.enregistrer_fournisseur('Mecanicien D-059', 'parts')$$, '42501', NULL, 'ecriture : droit achats requis');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-a590-000000000005');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.suppliers WHERE id = (SELECT id FROM f1))
          + (SELECT count(*)::int FROM public.contacts_fournisseurs WHERE supplier_id = (SELECT id FROM f1)), 0, 'sans droit : rien de visible');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;

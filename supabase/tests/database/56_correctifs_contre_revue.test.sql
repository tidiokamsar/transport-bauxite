-- Tests (D-072, contre-revue independante) : annulation d'immobilisation
-- avec intervention en cours, levee d'une fermeture planifiee, releve de
-- chauffeurs sur un meme camion, total taxes comprises d'un bon issu d'une
-- consultation, lecture des rapports figes journaliers (migration
-- 20261120104000). Tout est annule ; periode 2001 pour les agregats.
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

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-b700-000000000001', 'saisie.b700@exemple.invalid'),
  ('00000000-0000-4000-b700-000000000002', 'logistique.b700@exemple.invalid'),
  ('00000000-0000-4000-b700-000000000003', 'chef.s1.b700@exemple.invalid'),
  ('00000000-0000-4000-b700-000000000004', 'admin.b700@exemple.invalid'),
  ('00000000-0000-4000-b700-000000000005', 'lecteur.rapports.b700@exemple.invalid'),
  ('00000000-0000-4000-b700-000000000006', 'lecteur.trois.b700@exemple.invalid');
INSERT INTO public.sites (id, name, type) VALUES
  ('00000000-0000-4000-b700-0000000000a1', 'Mine S1 B700', 'mine'),
  ('00000000-0000-4000-b700-0000000000a2', 'Port B700', 'port');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-b700-000000000001', 'contract_manager', 'Saisie B700', 'active', NULL),
  ('00000000-0000-4000-b700-000000000002', 'logistician', 'Logistique B700', 'active', NULL),
  ('00000000-0000-4000-b700-000000000003', 'operations_manager', 'Chef S1 B700', 'active', '00000000-0000-4000-b700-0000000000a1'),
  ('00000000-0000-4000-b700-000000000004', 'admin', 'Admin B700', 'active', NULL),
  ('00000000-0000-4000-b700-000000000005', 'accountant', 'Lecteur rapports B700', 'active', NULL),
  ('00000000-0000-4000-b700-000000000006', 'accountant', 'Lecteur trois domaines B700', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.droits_utilisateur (utilisateur, module, niveau) VALUES
  ('00000000-0000-4000-b700-000000000005', 'reports', 'lecture'),
  ('00000000-0000-4000-b700-000000000005', 'trips', 'aucun'),
  ('00000000-0000-4000-b700-000000000005', 'planning', 'aucun'),
  ('00000000-0000-4000-b700-000000000005', 'fuel', 'aucun'),
  ('00000000-0000-4000-b700-000000000005', 'maintenance', 'aucun'),
  ('00000000-0000-4000-b700-000000000006', 'reports', 'lecture'),
  ('00000000-0000-4000-b700-000000000006', 'trips', 'lecture'),
  ('00000000-0000-4000-b700-000000000006', 'planning', 'lecture'),
  ('00000000-0000-4000-b700-000000000006', 'fuel', 'lecture'),
  ('00000000-0000-4000-b700-000000000006', 'maintenance', 'aucun')
ON CONFLICT (utilisateur, module) DO UPDATE SET niveau = EXCLUDED.niveau;
INSERT INTO public.vehicles (id, registration, brand_model, capacity_tonnes, vehicle_type, status, site_id) VALUES
  ('00000000-0000-4000-b700-0000000000b1', 'SONDE-B700-CHG', 'Test', 10, 'loader', 'immobilized', NULL),
  ('00000000-0000-4000-b700-0000000000b2', 'SONDE-B700-T1', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-b700-0000000000a1'),
  ('00000000-0000-4000-b700-0000000000b3', 'SONDE-B700-T2', 'Test', 40, 'tipper', 'active', '00000000-0000-4000-b700-0000000000a1');
INSERT INTO public.drivers (id, name, license_number, license_category, license_expiry, hire_date, status, site_id) VALUES
  ('00000000-0000-4000-b700-0000000000c1', 'Chauffeur jour B700', 'B700-1', 'C', '2030-01-01', '2020-01-01', 'active', '00000000-0000-4000-b700-0000000000a1'),
  ('00000000-0000-4000-b700-0000000000c2', 'Chauffeur releve B700', 'B700-2', 'C', '2030-01-01', '2020-01-01', 'active', '00000000-0000-4000-b700-0000000000a1'),
  ('00000000-0000-4000-b700-0000000000c3', 'Chauffeur trois B700', 'B700-3', 'C', '2030-01-01', '2020-01-01', 'active', '00000000-0000-4000-b700-0000000000a1');
INSERT INTO public.work_shifts (id, name, display_name, start_time, end_time, shift_order) VALUES
  ('00000000-0000-4000-b700-0000000000e1', 'sonde_jour_b700', 'Jour B700', '06:00', '18:00', 93);
DELETE FROM public.settings WHERE key IN ('consultation_offres_minimum', 'achats_validation_separee');

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-b800-000000000001', 'admin.b800@exemple.invalid');
INSERT INTO public.profiles (id, role, full_name, status, site_id) VALUES
  ('00000000-0000-4000-b800-000000000001', 'admin', 'Admin B800', 'active', NULL)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, site_id = EXCLUDED.site_id;
INSERT INTO public.sites (id, name, type) VALUES ('00000000-0000-4000-b800-0000000000a1', 'Depot B800', 'depot');

-- N1 (C4, D-049) : annuler_immobilisation ne contourne plus la validation de
-- la remise en service.
INSERT INTO public.immobilisations (id, vehicle_id, debut, cause, imputation, description) VALUES
  ('00000000-0000-4000-b700-0000000000d1', '00000000-0000-4000-b700-0000000000b1', now() - interval '10 hours', 'panne', 'loueur', 'Fuite');
SELECT pg_temp.se_connecter('00000000-0000-4000-b700-000000000001');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE i1 AS SELECT public.demander_intervention_loueur('00000000-0000-4000-b700-0000000000d1', now() - interval '9 hours', 'courriel', 'Fuite') AS id;
GRANT SELECT ON i1 TO authenticated;
SELECT public.prendre_en_charge_intervention((SELECT id FROM i1), now() - interval '3 hours', 'Technicien');
SELECT public.terminer_intervention((SELECT id FROM i1), now() - interval '1 hour', 'Flexible remplace');
SELECT throws_ok($$SELECT public.cloturer_immobilisation('00000000-0000-4000-b700-0000000000d1', now() - interval '1 hour', 'Remise')$$,
  '42501', NULL, 'controle : la cloture directe est bien refusee (C4)');
SELECT throws_ok($$SELECT public.annuler_immobilisation('00000000-0000-4000-b700-0000000000d1', 'Engin repare, on repart')$$,
  '42501', 'Intervention du loueur en cours : la remise en service doit etre validee avant toute annulation',
  'N1 : annulation refusee tant que l''intervention du loueur n''est pas validee');
RESET ROLE;
SELECT is((SELECT status::text FROM public.vehicles WHERE id = '00000000-0000-4000-b700-0000000000b1'), 'immobilized',
  'N1 : l''engin reste immobilise');
SELECT is((SELECT statut FROM public.immobilisations WHERE id = '00000000-0000-4000-b700-0000000000d1'), 'ouverte',
  'N1 : l''immobilisation reste ouverte');
-- Sans intervention, l'annulation reste possible.
INSERT INTO public.immobilisations (id, vehicle_id, debut, cause, imputation, description) VALUES
  ('00000000-0000-4000-b700-0000000000d2', '00000000-0000-4000-b700-0000000000b3', now() - interval '2 hours', 'panne', 'exploitant', 'Declaration erronee');
SELECT pg_temp.se_connecter('00000000-0000-4000-b700-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.annuler_immobilisation('00000000-0000-4000-b700-0000000000d2', 'Declaration erronee')$$,
  'N1 : une immobilisation sans intervention s''annule toujours');
RESET ROLE;
SELECT is((SELECT statut FROM public.immobilisations WHERE id = '00000000-0000-4000-b700-0000000000d2'), 'annulee',
  'N1 : annulation enregistree');

-- N4 (R4-4, D-059) : le montant total du bon, taxes comprises, egale l'offre retenue.
INSERT INTO public.warehouses (id, name, code, warehouse_type, site_id) VALUES
  ('00000000-0000-4000-b700-0000000006d1', 'Magasin B700', 'SONDE-B700-MAG', 'main', '00000000-0000-4000-b700-0000000000a1');
SELECT pg_temp.se_connecter('00000000-0000-4000-b700-000000000002');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE f1 AS SELECT public.enregistrer_fournisseur('Fournisseur retenu B700', 'parts', p_telephone => '+224 600 00 07 01') AS id;
CREATE TEMP TABLE cons AS SELECT public.creer_consultation('Sonde B700', '[{"designation": "Prestation B700", "quantite": 1}]'::jsonb,
  ARRAY[(SELECT id FROM f1)], '00000000-0000-4000-b700-0000000006d1') AS id;
CREATE TEMP TABLE off AS SELECT public.enregistrer_offre((SELECT id FROM cons), (SELECT id FROM f1),
  jsonb_build_array(jsonb_build_object('ligne', (SELECT id FROM public.consultations_lignes WHERE consultation_id = (SELECT id FROM cons)),
                                       'prix_unitaire', 1000)), 5) AS id;
CREATE TEMP TABLE bc AS SELECT public.selectionner_offre((SELECT id FROM off), 'Moins-disant') AS id;
SELECT lives_ok($$SELECT public.enregistrer_bon_commande((SELECT id FROM f1), '00000000-0000-4000-b700-0000000006d1',
  '[{"designation": "Prestation B700", "quantite": 1, "prix_unitaire": 1000}]'::jsonb, (SELECT id FROM bc), NULL, 5000000)$$,
  'N4 brouillon : memes lignes, taxes portees a 5 000 000');
SELECT throws_like($$SELECT public.soumettre_bon_commande((SELECT id FROM bc))$$,
  '%a aligner sur l''offre retenue%', 'N4 : soumission refusee, taxes separees sur un bon issu d''une consultation');
SELECT is((SELECT status FROM public.purchase_orders WHERE id = (SELECT id FROM bc)), 'draft',
  'N4 : le bon reste en brouillon');
SELECT lives_ok($$SELECT public.enregistrer_bon_commande((SELECT id FROM f1), '00000000-0000-4000-b700-0000000006d1',
  '[{"designation": "Prestation B700", "quantite": 1, "prix_unitaire": 1000}]'::jsonb, (SELECT id FROM bc), NULL, 0)$$,
  'N4 brouillon corrige : taxes ramenees a 0');
SELECT lives_ok($$SELECT public.soumettre_bon_commande((SELECT id FROM bc))$$,
  'N4 : soumission acceptee au montant de l''offre retenue');
RESET ROLE;

-- N3 (C5, D-048) : releve de chauffeurs sur un meme camion possible ; un engin
-- seul et un chauffeur ne sont inscrits qu'une fois.
SELECT pg_temp.se_connecter('00000000-0000-4000-b700-000000000003');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE p AS SELECT public.ouvrir_poste(current_date, '00000000-0000-4000-b700-0000000000e1', '00000000-0000-4000-b700-0000000000a1') AS id;
SELECT public.affecter_au_poste((SELECT id FROM p), '00000000-0000-4000-b700-0000000000c1', '00000000-0000-4000-b700-0000000000b2');
SELECT lives_ok($$SELECT public.affecter_au_poste((SELECT id FROM p), '00000000-0000-4000-b700-0000000000c2', '00000000-0000-4000-b700-0000000000b2')$$,
  'N3 : deuxieme chauffeur (releve) sur le meme camion accepte');
SELECT throws_ok($$SELECT public.affecter_au_poste((SELECT id FROM p), '00000000-0000-4000-b700-0000000000c1', '00000000-0000-4000-b700-0000000000b3')$$,
  '22023', NULL, 'N3 : un chauffeur n''est inscrit qu''une fois dans le poste (changement de camion = evenement)');
SELECT lives_ok($$SELECT public.affecter_au_poste((SELECT id FROM p), NULL, '00000000-0000-4000-b700-0000000000b3')$$,
  'N3 : engin seul inscrit');
SELECT throws_ok($$SELECT public.affecter_au_poste((SELECT id FROM p), NULL, '00000000-0000-4000-b700-0000000000b3')$$,
  '22023', 'Engin deja dans l''equipe de ce poste', 'N3 : engin seul inscrit une seule fois');
SELECT throws_ok($$SELECT public.affecter_au_poste((SELECT id FROM p), NULL, '00000000-0000-4000-b700-0000000000b2')$$,
  '22023', 'Engin deja dans l''equipe de ce poste', 'N3 : engin deja present avec chauffeur non reinscrit seul');
SELECT throws_like($$SELECT public.affecter_au_poste((SELECT id FROM p), '00000000-0000-4000-b700-0000000000c3', '00000000-0000-4000-b700-0000000000b3')$$,
  'Engin deja inscrit seul%', 'N3 : un engin inscrit seul ne recoit pas de chauffeur par une seconde ligne');
RESET ROLE;

-- N5 (R3-1, D-058) : un rapport journalier fige exige la lecture de ses domaines.
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.trips (id, reference, planned_date, vehicle_id, departure_site_id, arrival_site_id, etat, net_weight) VALUES
  ('00000000-0000-4000-b700-000000000101', 'SONDE-B700-V1', '2001-05-10', '00000000-0000-4000-b700-0000000000b2',
   '00000000-0000-4000-b700-0000000000a1', '00000000-0000-4000-b700-0000000000a2', 'DELIVERED', 38);
SELECT pg_temp.se_connecter('00000000-0000-4000-b700-000000000004');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE rf AS SELECT public.figer_rapport('journalier', '2001-05-10') AS id;
GRANT SELECT ON rf TO authenticated;
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b700-000000000005');
SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM public.rapport_journalier('2001-05-10', NULL) WHERE remarque = 'Non visible avec vos droits de lecture') > 0,
  'N5 controle : en direct, le lecteur sans droit voyages voit des lignes masquees');
SELECT is((SELECT count(*)::int FROM public.rapports_figes WHERE id = (SELECT id FROM rf)), 0,
  'N5 : le lecteur sans droit sur les domaines ne lit pas le rapport journalier fige');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b700-000000000006');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.rapports_figes WHERE id = (SELECT id FROM rf)), 0,
  'N5 : trois domaines sur quatre ne suffisent pas (maintenance manquante)');
RESET ROLE;
SELECT pg_temp.se_connecter('00000000-0000-4000-b700-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::int FROM public.rapports_figes WHERE id = (SELECT id FROM rf)), 1,
  'N5 : l''administrateur le lit');
RESET ROLE;

SELECT pg_temp.se_connecter('00000000-0000-4000-b800-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$INSERT INTO public.fermetures_site (id, site_id, debut, fin, motif) VALUES
  ('00000000-0000-4000-b800-0000000000f1', '00000000-0000-4000-b800-0000000000a1', now() + interval '3 days', now() + interval '5 days',
   'Maintenance planifiee du pont')$$, 'controle : une fermeture planifiee (debut dans 3 jours) se declare');
SELECT throws_ok($$UPDATE public.fermetures_site SET levee_le = now() + interval '3 days', motif_levee = 'Maintenance reportee'
  WHERE id = '00000000-0000-4000-b800-0000000000f1'$$, '22023', NULL,
  'N2 : une levee datee dans le futur reste refusee');
SELECT lives_ok($$UPDATE public.fermetures_site SET levee_le = now(), motif_levee = 'Maintenance reportee'
  WHERE id = '00000000-0000-4000-b800-0000000000f1'$$,
  'N2 : une fermeture planifiee se leve avant son debut');
SELECT lives_ok($$INSERT INTO public.fermetures_site (id, site_id, debut, fin, motif) VALUES
  ('00000000-0000-4000-b800-0000000000f2', '00000000-0000-4000-b800-0000000000a1', now() - interval '2 days', now() + interval '2 days',
   'Pont en panne')$$, 'N2 controle : fermeture en cours');
-- Declaration anterieure au debut (saisie la veille), posee hors session.
RESET ROLE;
SELECT pg_temp.se_connecter(NULL);
UPDATE public.fermetures_site SET declare_le = now() - interval '4 days' WHERE id = '00000000-0000-4000-b800-0000000000f2';
SELECT pg_temp.se_connecter('00000000-0000-4000-b800-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$UPDATE public.fermetures_site SET levee_le = now() - interval '3 days', motif_levee = 'Erreur'
  WHERE id = '00000000-0000-4000-b800-0000000000f2'$$, '22023', 'Levee anterieure au debut d''une fermeture commencee',
  'N2 : levee anterieure au debut d''une fermeture commencee refusee');
SELECT lives_ok($$INSERT INTO public.fermetures_site (id, site_id, debut, fin, motif) VALUES
  ('00000000-0000-4000-b800-0000000000f3', '00000000-0000-4000-b800-0000000000a1', now() + interval '10 days', now() + interval '11 days',
   'Revision planifiee')$$, 'N2 controle : seconde fermeture planifiee');
SELECT throws_ok($$UPDATE public.fermetures_site SET levee_le = '2001-01-01', motif_levee = 'Erreur'
  WHERE id = '00000000-0000-4000-b800-0000000000f3'$$, '22023', 'Levee anterieure a la declaration de la fermeture',
  'N2 : levee anterieure a la declaration refusee');
RESET ROLE;
-- Fermeture terminee (fin passee), inseree sans session.
SELECT pg_temp.se_connecter(NULL);
INSERT INTO public.fermetures_site (id, site_id, debut, fin, motif, declare_le) VALUES
  ('00000000-0000-4000-b800-0000000000f4', '00000000-0000-4000-b800-0000000000a1', now() - interval '6 days', now() - interval '4 days',
   'Ancienne fermeture', now() - interval '7 days');
SELECT pg_temp.se_connecter('00000000-0000-4000-b800-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$UPDATE public.fermetures_site SET levee_le = now(), motif_levee = 'Tardif'
  WHERE id = '00000000-0000-4000-b800-0000000000f4'$$, '22023', 'Fermeture deja terminee a sa fin prevue : rien a lever',
  'N2 : fermeture terminee, levee posterieure a la fin refusee');
RESET ROLE;
SELECT is(public.site_ferme_le('00000000-0000-4000-b800-0000000000a1', current_date + 4), NULL,
  'N2 : apres la levee, la periode planifiee n''est plus fermee');

SELECT * FROM finish();
ROLLBACK;

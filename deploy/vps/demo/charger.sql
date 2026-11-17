/*
  Donnees d'EXEMPLE SIGTB (D-084, derogation encadree a la regle 1, comme
  D-020). Demande du proprietaire du 2026-11-16 : « des donnees d'exemple de
  5 lignes maximum pour tous les modules, coherentes et claires, comme des
  donnees reelles, pour savoir comment ca fonctionne ».

  Principes
  - Fictives et etiquetees : tous les identifiants commencent par
    `dec0de00-`, tous les numeros generes par l'application commencent par
    `DEMO-`, toutes les personnes portent le nom « Exemple » ; le bandeau
    « DONNEES DE DEMONSTRATION » s'active (sigtb_demonstration, D-020).
  - Isolees du reel : un site minier et un depot de demonstration, leur
    organisation, leurs shifts, engins, chauffeurs, contrats, fournisseurs,
    cuve, magasin et articles propres. Aucune ligne ne reference une ligne
    reelle ; aucune ligne reelle n'est modifiee (controle a la fin : le
    chargement s'annule sinon).
  - Ecriture par les fonctions serveur (gardes, journaux, numerotation),
    au nom d'acteurs de demonstration (profils `dec0de00-`, comptes
    d'authentification sans mot de passe, adresse .invalid, bannis : aucune
    connexion possible), simules dans la transaction comme dans les tests
    pgTAP (request.jwt.claims). Insertion directe seulement pour les
    referentiels sans fonction d'ecriture.
  - Les lignes creees par les fonctions recoivent un identifiant aleatoire :
    a la fin, chaque ligne creee par ce chargement est re-identifiee
    `dec0de00-<suite de son identifiant>` (references mises a jour dans la
    meme transaction, declencheurs suspendus le temps de ce seul
    renommage), et chaque numero genere (voyage, fiche, facture, bon...)
    recoit le prefixe `DEMO-` partout ou il est cite ; les sequences de
    numerotation sont remises a leur valeur d'avant le chargement. La
    numerotation reelle (factures FAC-AAAA-NNNN comprises) ne saute donc
    aucun numero, avant comme apres la purge.
  - 5 lignes au plus par table (controle a la fin).
  - Dates relatives au jour du chargement (J = date du jour) : periode de
    reconciliation et de facturation de J-8 a J-2, voyages livres a J-2,
    voyage affecte du jour, facture emise a J-1, encaissement a J.

  Execution : `bash deploy/vps/demo/demo.sh charger` (supabase_admin,
  transaction unique `psql -1`). Purge : `demo.sh apercu` puis
  `demo.sh purger` (purger.sql, D-074, D-084).
*/
\set ON_ERROR_STOP on
SET LOCAL client_min_messages = warning;
-- Les identifiants rendus par les fonctions ne sont pas affiches.
\o /dev/null

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sites WHERE id::text LIKE 'dec0de00-%')
     OR EXISTS (SELECT 1 FROM auth.users WHERE id::text LIKE 'dec0de00-%') THEN
    RAISE EXCEPTION 'Donnees d''exemple deja presentes : demo.sh apercu puis demo.sh purger d''abord';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper) THEN
    RAISE EXCEPTION 'Chargement reserve a supabase_admin (demo.sh)';
  END IF;
END $$;

-- Identifiant de demonstration : dec0de00-<famille>-4000-8000-<numero>
CREATE FUNCTION pg_temp.demo_id(famille int, numero int) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT ('dec0de00-' || lpad(to_hex(famille), 4, '0') || '-4000-8000-' || lpad(to_hex(numero), 12, '0'))::uuid;
$$;
-- Acteur simule (auth.uid()), comme les tests pgTAP.
CREATE FUNCTION pg_temp.agir(p_id uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), true),
         set_config('request.jwt.claims',
           CASE WHEN p_id IS NULL THEN '{}' ELSE json_build_object('sub', p_id, 'role', 'authenticated')::text END, true);
$$;
-- Horodatage J-n a hh:mi (heure de Conakry = UTC).
CREATE FUNCTION pg_temp.j(n int, h text) RETURNS timestamptz
LANGUAGE sql STABLE AS $$ SELECT ((current_date - n)::text || ' ' || h || '+00')::timestamptz; $$;
-- Valeurs nommees du chargement (identifiants rendus par les fonctions).
CREATE TEMP TABLE demo_val (cle text PRIMARY KEY, id uuid);
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM demo_val WHERE cle = p; $$;
CREATE FUNCTION pg_temp.garder(p text, p_id uuid) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO demo_val VALUES (p, p_id) RETURNING id;
$$;

-- 0. Photographie de l'existant : chaque ligne de chaque table de public
--    (empreinte), et position des sequences. Sert au controle final
--    (aucune ligne reelle modifiee) et au renommage des seules lignes creees.
CREATE TEMP TABLE demo_avant (t regclass, id text, h text);
CREATE TEMP TABLE demo_sequences (s regclass, valeur bigint, appelee boolean);
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.oid::regclass AS t,
                  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'id' AND NOT a.attisdropped) AS a_id
             FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') LOOP
    EXECUTE format('INSERT INTO demo_avant SELECT %L::regclass, %s, md5(x::text) FROM %s x',
                   r.t, CASE WHEN r.a_id THEN 'x.id::text' ELSE 'NULL' END, r.t);
  END LOOP;
  FOR r IN SELECT c.oid::regclass AS s FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S' LOOP
    EXECUTE format('INSERT INTO demo_sequences SELECT %L::regclass, last_value, is_called FROM %s', r.s, r.s);
  END LOOP;
END $$;
CREATE INDEX ON demo_avant (t, id);

-- 1. Acteurs de demonstration : comptes d'authentification sans mot de
--    passe, adresse .invalid (aucun courrier possible), bannis (aucune
--    connexion possible) ; profils actifs pour que les fonctions serveur
--    appliquent leurs droits, perimetres et separations des taches.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', pg_temp.demo_id(5, n), 'authenticated', 'authenticated',
       'exemple-' || n || '@sigtb-demo.invalid', NULL,
       '{"provider":"email","providers":["email"],"demonstration":true}', '{}', now(), now()
  FROM generate_series(1, 5) n;
-- Colonnes du service d'authentification complet (production) : compte
-- banni jusqu'en 2999, adresse jamais confirmee.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'auth.users'::regclass AND attname = 'banned_until' AND NOT attisdropped) THEN
    UPDATE auth.users SET banned_until = '2999-12-31 00:00+00' WHERE id::text LIKE 'dec0de00-%';
  END IF;
END $$;

-- 2. Referentiels (aucune fonction d'ecriture) : organisation, sites,
--    distance de reference, shifts, engins, chauffeurs, profils.
INSERT INTO public.organisations (id, raison_sociale, statut, note) VALUES
  (pg_temp.demo_id(9, 1), 'Exemple Mining SARL (demonstration)', 'active', 'Organisation fictive des donnees d''exemple (D-084)');
INSERT INTO public.sites (id, name, type, is_active, city, country, organisation_id, capacity, notes) VALUES
  (pg_temp.demo_id(1, 1), 'Exemple - Mine plateau Nord', 'mine', true, 'Boke', 'Guinee', pg_temp.demo_id(9, 1), NULL,
   'Site minier fictif (donnees d''exemple)'),
  (pg_temp.demo_id(1, 2), 'Exemple - Depot CBG', 'depot', true, 'Kamsar', 'Guinee', pg_temp.demo_id(9, 1), 250000,
   'Depot de reception fictif : pesee et ticket CBG a l''arrivee');
INSERT INTO public.distances_reference (id, site_depart_id, site_arrivee_id, distance_km, source, actif) VALUES
  (pg_temp.demo_id(10, 1), pg_temp.demo_id(1, 1), pg_temp.demo_id(1, 2), 42, 'Releve de piste (exemple)', true);

-- Profils : role et site. Le chef d'exploitation et le magasinier sont
-- bornes au site minier d'exemple ; les autres sont globaux.
INSERT INTO public.profiles (id, role, full_name, status, site_id, email, department) VALUES
  (pg_temp.demo_id(5, 1), 'admin', 'Awa Exemple (administratrice)', 'active', NULL, 'exemple-1@sigtb-demo.invalid', 'Direction'),
  (pg_temp.demo_id(5, 2), 'director', 'Mamadou Exemple (directeur general)', 'active', NULL, 'exemple-2@sigtb-demo.invalid', 'Direction'),
  (pg_temp.demo_id(5, 3), 'contract_manager', 'Fatoumata Exemple (contrats et facturation)', 'active', NULL, 'exemple-3@sigtb-demo.invalid', 'Finance'),
  (pg_temp.demo_id(5, 4), 'operations_manager', 'Ibrahima Exemple (chef d''exploitation)', 'active', pg_temp.demo_id(1, 1), 'exemple-4@sigtb-demo.invalid', 'Exploitation'),
  (pg_temp.demo_id(5, 5), 'logistician', 'Kadiatou Exemple (magasin et achats)', 'active', pg_temp.demo_id(1, 1), 'exemple-5@sigtb-demo.invalid', 'Logistique');

-- Shifts propres a l'exemple (les shifts sont communs a tous les sites,
-- D-078) : noms distincts de tout shift reel.
INSERT INTO public.work_shifts (id, name, display_name, start_time, end_time, shift_order, color, is_active) VALUES
  (pg_temp.demo_id(2, 1), 'exemple_jour', 'Jour (exemple)', '06:00', '18:00', 9901, '#f59e0b', true),
  (pg_temp.demo_id(2, 2), 'exemple_nuit', 'Nuit (exemple)', '18:00', '06:00', 9902, '#6366f1', true);

-- Contrats (dossier contractuel, D-026) : CBG client a la tonne ; Neemba
-- loueur, tarif par engin (D-033) : camions au km parcouru charge, chargeuse
-- a l'heure.
INSERT INTO public.contrats (id, reference, intitule, nature, contrepartie, devise, date_debut, date_fin, statut,
                             delai_paiement_jours, description, preavis_jours, renouvellement) VALUES
  (pg_temp.demo_id(6, 1), 'DEMO-CBG-2026', 'Transport de bauxite mine - depot CBG (exemple)', 'client', 'CBG (exemple)', 'USD',
   date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '1 year - 1 day')::date, 'actif',
   30, 'Contrat fictif : facturation a la tonne recue au depot (ticket CBG)', 90, 'expres'),
  (pg_temp.demo_id(6, 2), 'DEMO-NEEMBA-2026', 'Location de camions et d''une chargeuse (exemple)', 'location', 'Neemba (exemple)', 'GNF',
   date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '1 year - 1 day')::date, 'actif',
   45, 'Contrat fictif : camions au km parcouru en charge, chargeuse a l''heure pointee', 60, 'tacite');
INSERT INTO public.contrat_versions (id, contrat_id, numero, intitule, date_effet, date_signature, resume) VALUES
  (pg_temp.demo_id(7, 1), pg_temp.demo_id(6, 1), 0, 'Contrat initial', date_trunc('year', current_date)::date,
   date_trunc('year', current_date)::date, 'Tarif unique a la tonne'),
  (pg_temp.demo_id(7, 2), pg_temp.demo_id(6, 2), 0, 'Contrat initial', date_trunc('year', current_date)::date,
   date_trunc('year', current_date)::date, 'Tarifs par engin');

-- Engins loues a Neemba (D-011, D-022) : 4 camions semi-remorques bennes
-- de 40 t et 1 chargeuse Caterpillar.
INSERT INTO public.vehicles (id, registration, brand_model, year, capacity_tonnes, vehicle_type, current_km, status, site_id,
                             propriete, proprietaire, exploitant, contrat_id, insurance_expiry, technical_inspection_expiry) VALUES
  (pg_temp.demo_id(3, 1), 'DEMO-T01', 'Mercedes Actros 4144 benne', 2022, 40, 'tipper', 84210, 'active', pg_temp.demo_id(1, 1),
   'loue', 'Neemba (exemple)', 'Exemple Mining SARL', pg_temp.demo_id(6, 2), current_date + 200, current_date + 120),
  (pg_temp.demo_id(3, 2), 'DEMO-T02', 'Mercedes Actros 4144 benne', 2022, 40, 'tipper', 91540, 'active', pg_temp.demo_id(1, 1),
   'loue', 'Neemba (exemple)', 'Exemple Mining SARL', pg_temp.demo_id(6, 2), current_date + 200, current_date + 25),
  (pg_temp.demo_id(3, 3), 'DEMO-T03', 'Renault Kerax 440 benne', 2021, 40, 'tipper', 120880, 'active', pg_temp.demo_id(1, 1),
   'loue', 'Neemba (exemple)', 'Exemple Mining SARL', pg_temp.demo_id(6, 2), current_date + 150, current_date + 90),
  (pg_temp.demo_id(3, 4), 'DEMO-T04', 'Renault Kerax 440 benne', 2021, 40, 'tipper', 118300, 'active', pg_temp.demo_id(1, 1),
   'loue', 'Neemba (exemple)', 'Exemple Mining SARL', pg_temp.demo_id(6, 2), current_date + 150, current_date + 90),
  (pg_temp.demo_id(3, 5), 'DEMO-CHG1', 'Caterpillar 966M chargeuse', 2020, 7, 'loader', NULL, 'active', pg_temp.demo_id(1, 1),
   'loue', 'Neemba (exemple)', 'Exemple Mining SARL', pg_temp.demo_id(6, 2), current_date + 180, current_date + 180);
INSERT INTO public.contrat_tarifs (id, version_id, libelle, unite, prix, categorie_materiel, ordre, engin, km_retour_vide_facturable, conditions) VALUES
  (pg_temp.demo_id(8, 1), pg_temp.demo_id(7, 1), 'Transport de bauxite mine - depot', 'tonne', 5.25, NULL, 1, NULL, NULL,
   'Tonnage net du ticket de pesee CBG'),
  (pg_temp.demo_id(8, 2), pg_temp.demo_id(7, 2), 'Camion DEMO-T01 au km en charge', 'km', 9500, NULL, 1, pg_temp.demo_id(3, 1), false, NULL),
  (pg_temp.demo_id(8, 3), pg_temp.demo_id(7, 2), 'Camion DEMO-T02 au km en charge', 'km', 9500, NULL, 2, pg_temp.demo_id(3, 2), false, NULL),
  (pg_temp.demo_id(8, 4), pg_temp.demo_id(7, 2), 'Camion DEMO-T03 au km en charge', 'km', 9000, NULL, 3, pg_temp.demo_id(3, 3), false, 'Camion plus ancien'),
  (pg_temp.demo_id(8, 5), pg_temp.demo_id(7, 2), 'Chargeuse DEMO-CHG1 a l''heure', 'heure', 1350000, 'Chargeuse', 4, pg_temp.demo_id(3, 5), NULL, NULL);

-- Chauffeurs (noms fictifs), habilites au site.
INSERT INTO public.drivers (id, name, phone, license_number, license_category, license_expiry, hire_date, contract_type, status,
                            site_id, employee_id, notes) VALUES
  (pg_temp.demo_id(4, 1), 'Alpha Exemple', '+224 600 00 00 01', 'DEMO-PC-0001', 'C+E', current_date + 700, current_date - 900, 'CDI', 'active', pg_temp.demo_id(1, 1), 'DEMO-M001', 'Chauffeur fictif'),
  (pg_temp.demo_id(4, 2), 'Mariama Exemple', '+224 600 00 00 02', 'DEMO-PC-0002', 'C+E', current_date + 400, current_date - 600, 'CDI', 'active', pg_temp.demo_id(1, 1), 'DEMO-M002', 'Chauffeuse fictive'),
  (pg_temp.demo_id(4, 3), 'Sekou Exemple', '+224 600 00 00 03', 'DEMO-PC-0003', 'C+E', current_date + 60, current_date - 300, 'CDD', 'active', pg_temp.demo_id(1, 1), 'DEMO-M003', 'Chauffeur fictif, permis a renouveler dans 60 jours');
-- Habilitations : une par type exige en production (visite medicale
-- sinon), valable un an.
INSERT INTO public.habilitations_chauffeur (id, driver_id, type, libelle, numero, delivre_le, expire_le, document_ref)
SELECT pg_temp.demo_id(11, row_number() OVER ()::int), d.id, t.type,
       CASE t.type WHEN 'visite_medicale' THEN 'Visite medicale d''aptitude' WHEN 'formation_securite' THEN 'Formation securite mine'
                   WHEN 'habilitation_engin' THEN 'Habilitation conduite benne' WHEN 'acces_site' THEN 'Badge d''acces au site' ELSE 'Habilitation' END,
       'DEMO-HAB-' || row_number() OVER (), current_date - 100, current_date + 265, NULL
  FROM public.drivers d
 CROSS JOIN (SELECT type FROM public.habilitations_requises
             UNION SELECT 'visite_medicale' WHERE NOT EXISTS (SELECT 1 FROM public.habilitations_requises)) t
 WHERE d.id::text LIKE 'dec0de00-%';

/* 3. Chaine J1 (recette), periode J-8 a J-2.
   Acteurs : 5,4 chef d'exploitation (site), 5,3 chargee de contrats et
   facturation, 5,2 directeur general (signature, validations). */

-- 3.1 Planification : objectif du shift de jour a J-2 et a J.
SELECT pg_temp.agir(pg_temp.demo_id(5, 4));
SELECT pg_temp.garder('objectif_j2', public.definir_objectif(current_date - 2, pg_temp.demo_id(1, 1), pg_temp.demo_id(2, 1),
  150, 4, 3, 1, NULL, 'Objectif du shift de jour : 4 rotations de 38 t environ'));
SELECT pg_temp.garder('objectif_j0', public.definir_objectif(current_date, pg_temp.demo_id(1, 1), pg_temp.demo_id(2, 1),
  120, 3, 3, 1, NULL, 'DEMO-T03 immobilise : objectif reduit'));

-- 3.2 Poste de jour a J-2 : ouverture, equipe, evenement, cloture, validation.
SELECT pg_temp.garder('poste', public.ouvrir_poste(current_date - 2, pg_temp.demo_id(2, 1), pg_temp.demo_id(1, 1),
  pg_temp.demo_id(5, 4), 'Piste principale arrosee, pont-bascule de la mine etalonne la veille'));
SELECT pg_temp.garder('equipe_1', public.affecter_au_poste(pg_temp.v('poste'), pg_temp.demo_id(4, 1), pg_temp.demo_id(3, 1)));
SELECT pg_temp.garder('equipe_2', public.affecter_au_poste(pg_temp.v('poste'), pg_temp.demo_id(4, 2), pg_temp.demo_id(3, 2)));
SELECT pg_temp.garder('equipe_3', public.affecter_au_poste(pg_temp.v('poste'), pg_temp.demo_id(4, 3), pg_temp.demo_id(3, 3)));
SELECT pg_temp.garder('equipe_4', public.affecter_au_poste(pg_temp.v('poste'), NULL, pg_temp.demo_id(3, 5)));
SELECT public.pointer_presence(pg_temp.v('equipe_' || n), true, CASE n WHEN 3 THEN 15 END,
                               CASE n WHEN 3 THEN 'Arrive en retard : navette du personnel en panne' END)
  FROM generate_series(1, 4) n;
SELECT public.consigner_evenement_poste(pg_temp.v('poste'), 'securite', 'Pluie a 13 h : vitesse limitee a 30 km/h sur la descente du plateau',
  pg_temp.j(2, '13:05'), NULL);

-- 3.3 Voyages. Les 4 rotations de J-2 sont creees deja affectees (camion,
--     chauffeur, chargeuse) : une affectation par le dispatch horodaterait
--     l'evenement a l'heure du chargement, apres les rotations, ce que le
--     cycle refuse. L'evenement « Creation du voyage » porte l'heure reelle
--     du chargement (aucun horodatage n'est retouche). Le voyage du jour
--     passe par le dispatch : la recommandation (DEMO-T03) est modifiee
--     par une decision humaine motivee, historisee (D-024).
SELECT pg_temp.garder('v' || x.n, public.creer_voyage(current_date - 2, pg_temp.demo_id(1, 1), pg_temp.demo_id(1, 2),
         pg_temp.demo_id(3, x.camion), pg_temp.demo_id(4, x.chauffeur), pg_temp.demo_id(3, 5), NULL, pg_temp.demo_id(2, 1),
         CASE x.n WHEN 4 THEN 'Deuxieme rotation de DEMO-T01' END))
  FROM (VALUES (1, 1, 1), (2, 2, 2), (3, 3, 3), (4, 1, 1)) x(n, camion, chauffeur);
SELECT pg_temp.garder('v5', public.creer_voyage(current_date, pg_temp.demo_id(1, 1), pg_temp.demo_id(1, 2),
         NULL, NULL, NULL, NULL, pg_temp.demo_id(2, 1), 'Rotation du jour'));
SELECT public.decider_affectation(pg_temp.v('v5'), 'modifiee', pg_temp.demo_id(3, 4), pg_temp.demo_id(4, 1), pg_temp.demo_id(3, 5),
         jsonb_build_object('camion', pg_temp.demo_id(3, 3), 'chauffeur', pg_temp.demo_id(4, 1),
                            'motif_recommandation', 'camion le plus proche du front de taille (exemple)'),
         'DEMO-T03 immobilise (freins) : DEMO-T04 retenu');

-- 3.4 Fiches de rotations (une par camion et par jour, D-028), remises a
--     l'agent, saisies au retour : pesee de depart au pont-bascule de la
--     mine, pesee et ticket CBG a l'arrivee au depot (D-078). Poids en
--     tonnes ; net du ticket <= capacite (40 t).
CREATE FUNCTION pg_temp.etapes(p_depart timestamptz, p_brut_depart numeric, p_brut_arrivee numeric, p_tare numeric, p_ticket text)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('etat', 'AT_LOADING', 'quand', p_depart),
    jsonb_build_object('etat', 'LOADING', 'quand', p_depart + interval '10 minutes'),
    jsonb_build_object('etat', 'LOADED', 'quand', p_depart + interval '28 minutes'),
    jsonb_build_object('etat', 'WEIGHED_OUT', 'quand', p_depart + interval '35 minutes',
                       'donnees', jsonb_build_object('brut', p_brut_depart, 'tare', p_tare)),
    jsonb_build_object('etat', 'IN_TRANSIT', 'quand', p_depart + interval '40 minutes'),
    jsonb_build_object('etat', 'AT_DESTINATION', 'quand', p_depart + interval '1 hour 45 minutes'),
    jsonb_build_object('etat', 'UNLOADING', 'quand', p_depart + interval '1 hour 55 minutes'),
    jsonb_build_object('etat', 'WEIGHED_IN', 'quand', p_depart + interval '2 hours 10 minutes',
                       'donnees', jsonb_build_object('ticket', p_ticket, 'brut', p_brut_arrivee, 'tare', p_tare)),
    jsonb_build_object('etat', 'DELIVERED', 'quand', p_depart + interval '2 hours 15 minutes'));
$$;
SELECT pg_temp.garder('fiche_t' || n, public.preparer_fiche('rotations', current_date - 2, pg_temp.demo_id(1, 1), pg_temp.demo_id(2, 1),
         pg_temp.demo_id(3, n), pg_temp.demo_id(4, n), 'Ousmane Exemple (pointeur)', '{"pesee":"arrivee"}'::jsonb, '[]'::jsonb))
  FROM generate_series(1, 3) n;
SELECT public.suivre_fiche(pg_temp.v('fiche_t' || n), 'remise', NULL, pg_temp.j(2, '05:50')) FROM generate_series(1, 3) n;
-- Net depart / net ticket CBG : V1 38,1 / 37,8 t ; V2 37,2 / 36,2 t (ecart
-- de 2,7 %, au-dela de la tolerance de 2 %) ; V3 38,7 / 38,5 t ;
-- V4 38,5 / 38,3 t. Total recu : 150,8 t.
SELECT public.saisir_rotation(pg_temp.v('fiche_t1'), pg_temp.v('v1'), pg_temp.etapes(pg_temp.j(2, '06:30'), 55.2, 54.9, 17.1, 'DEMO-CBG-0001'));
SELECT public.saisir_rotation(pg_temp.v('fiche_t2'), pg_temp.v('v2'), pg_temp.etapes(pg_temp.j(2, '06:50'), 54.0, 53.0, 16.8, 'DEMO-CBG-0002'));
SELECT public.saisir_rotation(pg_temp.v('fiche_t3'), pg_temp.v('v3'), pg_temp.etapes(pg_temp.j(2, '07:15'), 56.1, 55.9, 17.4, 'DEMO-CBG-0003'));
SELECT public.saisir_rotation(pg_temp.v('fiche_t1'), pg_temp.v('v4'), pg_temp.etapes(pg_temp.j(2, '09:30'), 55.6, 55.4, 17.1, 'DEMO-CBG-0004'));
SELECT public.suivre_fiche(pg_temp.v('fiche_t' || n), 'retournee', NULL, pg_temp.j(2, '17:45')) FROM generate_series(1, 3) n;
SELECT public.terminer_saisie_fiche(pg_temp.v('fiche_t' || n), 'Fiche saisie, tickets CBG rapproches') FROM generate_series(1, 3) n;

-- 3.5 Releves kilometriques (5 au plus) : V1 complet (charge 42 km,
--     retour 42 km), V2 aller seulement ; V3 et V4 sans releve (compteur
--     de DEMO-T03 illisible, oubli sur la deuxieme rotation) : la distance
--     de reference (42 km) est retenue avec un motif a la validation.
SELECT public.saisir_releve_compteur(pg_temp.demo_id(3, 1), pg_temp.v('v1'), 'depart_charge', 84210, pg_temp.j(2, '07:10'), 'fiche', 'Fiche du camion DEMO-T01');
SELECT public.saisir_releve_compteur(pg_temp.demo_id(3, 1), pg_temp.v('v1'), 'arrivee_depot', 84252, pg_temp.j(2, '08:15'), 'fiche', 'Fiche du camion DEMO-T01');
SELECT public.saisir_releve_compteur(pg_temp.demo_id(3, 1), pg_temp.v('v1'), 'fin_rotation', 84294, pg_temp.j(2, '09:25'), 'fiche', 'Fiche du camion DEMO-T01');
SELECT public.saisir_releve_compteur(pg_temp.demo_id(3, 2), pg_temp.v('v2'), 'depart_charge', 91540, pg_temp.j(2, '07:30'), 'fiche', 'Fiche du camion DEMO-T02');
SELECT public.saisir_releve_compteur(pg_temp.demo_id(3, 2), pg_temp.v('v2'), 'arrivee_depot', 91583, pg_temp.j(2, '08:35'), 'fiche', 'Fiche du camion DEMO-T02');

-- 3.6 Cloture du poste par le chef d'exploitation, validee par le directeur
--     (separation des taches).
SELECT public.cloturer_poste(pg_temp.v('poste'), 'DEMO-T03 : bruit anormal au freinage signale, a controler avant la prochaine rotation',
  '4 rotations, 150,8 t recues au depot ; pluie de 13 h a 14 h');
SELECT pg_temp.agir(pg_temp.demo_id(5, 2));
SELECT public.valider_cloture_poste(pg_temp.v('poste'));

-- 3.7 Distances validees par la chargee de contrats (autre personne que
--     l'auteur des releves).
SELECT pg_temp.agir(pg_temp.demo_id(5, 3));
SELECT public.valider_distance_voyage(pg_temp.v('v1'), 42, 42);
SELECT public.valider_distance_voyage(pg_temp.v('v2'), 43, NULL);
SELECT public.valider_distance_voyage(pg_temp.v('v3'), 42, NULL, NULL, 'Compteur de DEMO-T03 illisible : distance de reference retenue');
SELECT public.valider_distance_voyage(pg_temp.v('v4'), 42, NULL, NULL, 'Releves oublies sur la deuxieme rotation : distance de reference retenue');

-- 3.7 bis Pesee a deux sources (D-081). Source B : les tickets saisis avec
--     les rotations sont recopies dans releves_terrain_kogon (declencheur).
--     Source A : releve officiel CBG du depot, importe tel que recu
--     (empreinte SHA-256 du fichier d'exemple), puis rapproche : les 4
--     pesees CBG concordent avec les releves KOGON (tolerance du depot
--     d'exemple : 0,2 t ou 0,5 %, definie par l'administratrice).
SELECT pg_temp.agir(pg_temp.demo_id(5, 1));
SELECT public.definir_tolerance_pesee(pg_temp.demo_id(1, 2), 0.2, 0.5,
  'Tolerance du depot d''exemple : precision du pont-bascule CBG');
SELECT pg_temp.agir(pg_temp.demo_id(5, 3));
SELECT pg_temp.garder('releve_cbg', (public.importer_releve_cbg_v2('DEMO-RCBG-0001', current_date - 2, current_date - 2, pg_temp.demo_id(1, 2),
  'releve-cbg-exemple.csv', encode(sha256(convert_to('DEMO-RCBG-0001 ' || current_date::text, 'UTF8')), 'hex'),
  (SELECT jsonb_agg(jsonb_build_object('ticket', tk.ticket, 'date', (current_date - 2)::text, 'immatriculation', ve.registration,
                                       'brut', tk.brut::text, 'tare', tk.tare::text) ORDER BY tk.ticket)
     FROM public.tickets_pesee_cbg tk JOIN public.trips t ON t.id = tk.trip_id JOIN public.vehicles ve ON ve.id = t.vehicle_id
    WHERE tk.trip_id IN (pg_temp.v('v1'), pg_temp.v('v2'), pg_temp.v('v3'), pg_temp.v('v4'))),
  '[]'::jsonb) ->> 'releve_id')::uuid);
SELECT public.rapprocher_pesees(pg_temp.v('releve_cbg'));

-- 3.8 Reconciliation CBG J-8 a J-2, base : tonnage recu (ticket CBG),
--     tolerance 2 %. V2 hors tolerance : decision motivee ; les autres
--     lignes sont facturables sans anomalie bloquante.
SELECT pg_temp.garder('reconciliation', public.ouvrir_reconciliation(pg_temp.demo_id(6, 1), current_date - 8, current_date - 2,
  'recu', 2, pg_temp.demo_id(1, 1), pg_temp.demo_id(1, 2)));
SELECT public.decider_ligne_reconciliation(l.id, 'facturable',
  'Ecart de 1 t verifie : perte de chargement sous la pluie, poids CBG retenu')
  FROM public.reconciliation_lignes l WHERE l.reconciliation_id = pg_temp.v('reconciliation') AND l.trip_id = pg_temp.v('v2');
SELECT public.cloturer_reconciliation(pg_temp.v('reconciliation'));

-- 3.9 Facture CBG : generee (TVA 18 %), soumise, signee par le directeur
--     general (D-029), emise a J-1 ; encaissement integral a J.
SELECT pg_temp.garder('facture', public.generer_facture(pg_temp.v('reconciliation'), 18, NULL));
SELECT public.avancer_facture(pg_temp.v('facture'), 'soumettre', NULL, NULL);
SELECT pg_temp.agir(pg_temp.demo_id(5, 2));
SELECT public.avancer_facture(pg_temp.v('facture'), 'signer', NULL, NULL);
SELECT pg_temp.agir(pg_temp.demo_id(5, 3));
SELECT public.avancer_facture(pg_temp.v('facture'), 'emettre', NULL, current_date - 1);
SELECT public.enregistrer_encaissement(pg_temp.v('facture'), current_date, (SELECT montant_ttc FROM public.factures WHERE id = pg_temp.v('facture')),
  'virement', 'DEMO-VIR-0001', 'Virement CBG (exemple)');

/* 4. Chaine J2 (couts) : carburant, pointages et immobilisations Neemba,
   controle de la facture Neemba. */

-- 4.1 Carburant : cuve de la mine, livraison CBG de 20 000 L a J-3
--     receptionnee, fiche carburant de J-2 (3 pleins), inventaire de J-1
--     (ecart de -35 L) valide par une autre personne (separation).
INSERT INTO public.stockages_carburant (id, code, libelle, type, site_id, capacite_litres, seuil_alerte_litres, actif) VALUES
  (pg_temp.demo_id(12, 1), 'DEMO-CUVE-01', 'Cuve gasoil de la mine (exemple)', 'cuve_fixe', pg_temp.demo_id(1, 1), 30000, 5000, true);
-- Inventaire initial (cuve neuve, vide) a J-4, valide : stockage ouvert.
SELECT pg_temp.agir(pg_temp.demo_id(5, 4));
SELECT pg_temp.garder('inventaire_initial', public.saisir_inventaire_carburant(pg_temp.demo_id(12, 1), pg_temp.j(4, '16:00'), 0, 'jauge',
  'Inventaire d''ouverture : cuve neuve, vide'));
SELECT pg_temp.agir(pg_temp.demo_id(5, 1));
SELECT public.decider_inventaire_carburant(pg_temp.v('inventaire_initial'), true, NULL);
SELECT pg_temp.agir(pg_temp.demo_id(5, 4));
SELECT pg_temp.garder('livraison', public.enregistrer_livraison_cbg('DEMO-BL-GO-0001', current_date - 3, pg_temp.demo_id(1, 1),
  20000, 11500, 'Bon de livraison CBG DEMO-BL-GO-0001', 'Livraison gasoil (exemple)'));
SELECT public.receptionner_livraison_cbg(pg_temp.v('livraison'), pg_temp.demo_id(12, 1), pg_temp.j(3, '10:30'), 20000, 20000, 'jauge', NULL);
SELECT pg_temp.garder('fiche_carburant', public.preparer_fiche('carburant', current_date - 2, pg_temp.demo_id(1, 1), pg_temp.demo_id(2, 1),
  NULL, NULL, 'Ousmane Exemple (pompiste)', '{}'::jsonb, '[]'::jsonb));
SELECT public.suivre_fiche(pg_temp.v('fiche_carburant'), 'remise', NULL, pg_temp.j(2, '05:55'));
SELECT public.saisir_carburant(pg_temp.v('fiche_carburant'), 11500, 'CBG (exemple)', jsonb_build_array(
  jsonb_build_object('vehicle_id', pg_temp.demo_id(3, 1), 'driver_id', pg_temp.demo_id(4, 1), 'litres', 310, 'compteur', 84210, 'stockage_id', pg_temp.demo_id(12, 1)),
  jsonb_build_object('vehicle_id', pg_temp.demo_id(3, 2), 'driver_id', pg_temp.demo_id(4, 2), 'litres', 295, 'compteur', 91540, 'stockage_id', pg_temp.demo_id(12, 1)),
  jsonb_build_object('vehicle_id', pg_temp.demo_id(3, 5), 'litres', 180, 'stockage_id', pg_temp.demo_id(12, 1))));
SELECT public.suivre_fiche(pg_temp.v('fiche_carburant'), 'retournee', NULL, pg_temp.j(2, '18:05'));
SELECT public.terminer_saisie_fiche(pg_temp.v('fiche_carburant'), 'Trois pleins, 785 L');
-- Mouvements valides par l'administratrice (autre personne que l'auteur).
SELECT pg_temp.agir(pg_temp.demo_id(5, 1));
SELECT public.decider_mouvement_carburant(m.id, true, NULL)
  FROM public.mouvements_carburant m WHERE m.stockage_id = pg_temp.demo_id(12, 1) AND m.statut = 'a_valider'
 ORDER BY m.date_mouvement;
SELECT pg_temp.agir(pg_temp.demo_id(5, 4));
SELECT pg_temp.garder('inventaire', public.saisir_inventaire_carburant(pg_temp.demo_id(12, 1), pg_temp.j(1, '06:00'), 19180, 'jauge',
  'Jaugeage du matin : 19 180 L pour 19 215 L theoriques'));
SELECT pg_temp.agir(pg_temp.demo_id(5, 1));
SELECT public.decider_inventaire_carburant(pg_temp.v('inventaire'), true, 'Ecart de 0,2 % : evaporation et precision de la jauge');

-- 4.2 Pointage de la chargeuse a J-2 (11,5 h a l'horametre).
SELECT pg_temp.agir(pg_temp.demo_id(5, 4));
SELECT pg_temp.garder('fiche_pointage', public.preparer_fiche('pointage_engins', current_date - 2, pg_temp.demo_id(1, 1), pg_temp.demo_id(2, 1),
  NULL, NULL, 'Ousmane Exemple (pointeur)', '{}'::jsonb, '[]'::jsonb));
SELECT public.suivre_fiche(pg_temp.v('fiche_pointage'), 'remise', NULL, pg_temp.j(2, '05:55'));
SELECT public.saisir_pointage(pg_temp.v('fiche_pointage'), pg_temp.demo_id(3, 5), 12450.0, 12461.5, 'Lansana Exemple (conducteur de chargeuse)',
  'Chargement des 4 rotations ; arret pluie de 13 h a 14 h', '[]'::jsonb);
SELECT public.suivre_fiche(pg_temp.v('fiche_pointage'), 'retournee', NULL, pg_temp.j(2, '18:10'));
SELECT public.terminer_saisie_fiche(pg_temp.v('fiche_pointage'), 'Pointage signe par le conducteur');

-- 4.3 Immobilisation de DEMO-T03 a J-1 (freins), imputee au loueur, en
--     cours : le camion est immobilise, le dispatch du jour l'a ecarte.
SELECT pg_temp.garder('immobilisation', public.declarer_immobilisation(pg_temp.demo_id(3, 3), pg_temp.j(1, '07:40'), 'panne', 'loueur',
  'Bruit anormal au freinage signale a la cloture du poste de J-2 ; camion arrete', 'DEMO-NEEMBA-INT-0001'));

-- 4.4 Facture Neemba de la periode J-8 a J-2, saisie puis controlee contre
--     les distances validees et le pointage : la chargeuse est facturee
--     12 h pour 11,5 h pointees (ecart reclame de 675 000 GNF).
SELECT pg_temp.agir(pg_temp.demo_id(5, 3));
SELECT pg_temp.garder('facture_neemba', public.saisir_facture_fournisseur(pg_temp.demo_id(6, 2), 'DEMO-NB-0001', current_date - 1,
  current_date - 8, current_date - 2, 17784500, jsonb_build_array(
    jsonb_build_object('vehicle_id', pg_temp.demo_id(3, 1), 'libelle', 'DEMO-T01 : 2 rotations', 'quantite_facturee', 84, 'unite_facturee', 'km', 'taux_facture', 9500, 'montant_facture', 798000),
    jsonb_build_object('vehicle_id', pg_temp.demo_id(3, 2), 'libelle', 'DEMO-T02 : 1 rotation', 'quantite_facturee', 43, 'unite_facturee', 'km', 'taux_facture', 9500, 'montant_facture', 408500),
    jsonb_build_object('vehicle_id', pg_temp.demo_id(3, 3), 'libelle', 'DEMO-T03 : 1 rotation', 'quantite_facturee', 42, 'unite_facturee', 'km', 'taux_facture', 9000, 'montant_facture', 378000),
    jsonb_build_object('vehicle_id', pg_temp.demo_id(3, 5), 'libelle', 'DEMO-CHG1 : heures de chargeuse', 'categorie_materiel', 'Chargeuse', 'quantite_facturee', 12, 'unite_facturee', 'heure', 'taux_facture', 1350000, 'montant_facture', 16200000)),
  20985710, 'Facture Neemba (exemple), TVA 18 %'));
SELECT public.controler_facture_fournisseur(pg_temp.v('facture_neemba'));
SELECT public.notifier_ecart_fournisseur(pg_temp.v('facture_neemba'), current_date, 'DEMO-COURRIER-0001 : 0,5 h de chargeuse non pointee');

-- 4.5 Paiement de la facture Neemba au montant controle (heures pointees) :
--     propose par la chargee de contrats, approuve par le directeur,
--     execute, puis controle par l'administratrice (trois personnes).
SELECT pg_temp.garder('paiement', public.proposer_paiement(20189210, 'Facture Neemba DEMO-NB-0001 au montant controle (11,5 h de chargeuse)',
  pg_temp.v('facture_neemba'), NULL));
SELECT pg_temp.agir(pg_temp.demo_id(5, 2));
SELECT public.decider_paiement(pg_temp.v('paiement'), true, 'Montant controle : ecart de 675 000 GNF HT reclame a Neemba');
SELECT pg_temp.agir(pg_temp.demo_id(5, 3));
SELECT public.enregistrer_execution_paiement(pg_temp.v('paiement'), current_date, 'virement', 20189210, 'DEMO-VIR-NB-0001');
SELECT pg_temp.agir(pg_temp.demo_id(5, 1));
SELECT public.controler_paiement(pg_temp.v('paiement'), true, NULL);

/* 5. Achats, magasin et pneus : fournisseur, bon de commande (filtres et
   pneus), approbation, reception (entree en stock et pneus enregistres),
   montage et inspection d'un pneu. */
INSERT INTO public.warehouses (id, name, code, warehouse_type, location, manager_name, active, site_id) VALUES
  (pg_temp.demo_id(13, 1), 'Magasin de la mine (exemple)', 'DEMO-MAG-01', 'main', 'Base vie, hangar 2', 'Kadiatou Exemple', true, pg_temp.demo_id(1, 1));
INSERT INTO public.stock_categories (id, name, description, active) VALUES
  (pg_temp.demo_id(13, 2), 'Filtration (exemple)', 'Filtres moteur, gasoil et air', true);
INSERT INTO public.stock_items (id, item_code, name, description, category_id, unit_of_measure, unit_price, quantity_in_stock,
                                minimum_threshold, maximum_threshold, warehouse_id, location_in_warehouse, active, suivi) VALUES
  (pg_temp.demo_id(13, 3), 'DEMO-FLT-001', 'Filtre a huile moteur Actros', 'Filtre fictif (exemple)', pg_temp.demo_id(13, 2), 'piece', 185000, 0,
   4, 20, pg_temp.demo_id(13, 1), 'Rayon A2', true, 'aucun');
SELECT pg_temp.agir(pg_temp.demo_id(5, 5));
SELECT pg_temp.garder('fournisseur', public.enregistrer_fournisseur('Exemple Pieces et Pneus SARL', 'parts', NULL, '+224 620 00 00 10',
  'contact@exemple-pieces.invalid', 'Zone industrielle', 'Conakry', 'Guinee', NULL, NULL, '30 jours fin de mois', 'Fournisseur fictif (exemple)'));
SELECT pg_temp.garder('bon', public.enregistrer_bon_commande(pg_temp.v('fournisseur'), pg_temp.demo_id(13, 1), jsonb_build_array(
    jsonb_build_object('article', pg_temp.demo_id(13, 3), 'designation', 'Filtre a huile moteur Actros', 'quantite', 10, 'prix_unitaire', 185000),
    jsonb_build_object('designation', 'Pneu 315/80 R22.5 tout terrain', 'quantite', 2, 'prix_unitaire', 4200000,
                       'pneu', jsonb_build_object('marque', 'Michelin', 'modele', 'X Works HD', 'dimension', '315/80 R22.5'))),
  NULL, current_date - 3, 0, 'Reapprovisionnement filtres et deux pneus de rechange'));
SELECT public.soumettre_bon_commande(pg_temp.v('bon'));
SELECT pg_temp.agir(pg_temp.demo_id(5, 2));
SELECT public.decider_bon_commande(pg_temp.v('bon'), true, NULL);
SELECT pg_temp.agir(pg_temp.demo_id(5, 5));
SELECT public.receptionner_bon_commande(pg_temp.v('bon'), (
  SELECT jsonb_agg(CASE WHEN i.pneu_marque IS NULL THEN jsonb_build_object('ligne', i.id, 'recue', 10)
                        ELSE jsonb_build_object('ligne', i.id, 'recue', 2, 'pneus', jsonb_build_array(
                               jsonb_build_object('numero', 'DEMO-PN-0001', 'profondeur_mm', 18),
                               jsonb_build_object('numero', 'DEMO-PN-0002', 'profondeur_mm', 18))) END)
    FROM public.purchase_order_items i WHERE i.purchase_order_id = pg_temp.v('bon')),
  'DEMO-BL-PP-0001', pg_temp.j(1, '10:00'), 'Livraison complete');
SELECT public.monter_pneu((SELECT id FROM public.tires WHERE tire_number = 'DEMO-PN-0001'), pg_temp.demo_id(3, 1), 'AVG',
  pg_temp.j(1, '14:00'), 84294, 18, 8.5, 'Remplacement du pneu avant gauche use');
SELECT public.inspecter_pneu((SELECT id FROM public.tires WHERE tire_number = 'DEMO-PN-0001'), least(now(), pg_temp.j(0, '07:00')), 17.5, 8.3, 84294,
  'Controle du matin : usure normale');

/* 6. Maintenance, couts, HSE, alertes. */

-- 6.1 Ordre de travail pour l'immobilisation de DEMO-T03 (l'ecran
--     Maintenance ecrit l'ordre directement, sans fonction serveur).
SELECT pg_temp.agir(pg_temp.demo_id(5, 4));
INSERT INTO public.maintenance_orders (id, vehicle_id, request_date, maintenance_type, km_at_maintenance, description, status, workshop,
                                       title, priority, requested_by, site_id, scheduled_date, estimated_cost, notes)
VALUES (pg_temp.demo_id(14, 1), pg_temp.demo_id(3, 3), current_date - 1, 'corrective', 120964,
        'Bruit au freinage : controle des garnitures et des tambours arriere', 'open', 'external',
        'Freins DEMO-T03', 'high', pg_temp.demo_id(5, 4), pg_temp.demo_id(1, 1), current_date, NULL,
        'Intervention a la charge de Neemba (immobilisation imputee au loueur)');

-- 6.2 Cout enregistre (gardiennage du parc, sans categorie).
SELECT pg_temp.agir(pg_temp.demo_id(5, 3));
SELECT public.enregistrer_cout(current_date - 2, 'Gardiennage du parc camions, nuit de J-2 (exemple)', 450000, 'GNF', NULL,
  pg_temp.demo_id(1, 1), NULL, 'DEMO-RECU-0001', 'especes', 'Recu du prestataire fictif');
SELECT pg_temp.agir(pg_temp.demo_id(5, 4));

-- 6.3 HSE : risque evalue, inspection planifiee puis realisee avec deux
--     constats, infraction et sanction, dotation EPI, plan de prevention
--     de l'intervention Neemba signe.
SELECT public.enregistrer_risque(NULL, pg_temp.demo_id(1, 1), 'Renversement de camion en descente par piste glissante', 'Descente du plateau Nord',
  4, 3, 'Arrosage limite, vitesse 30 km/h par pluie, merlons de securite', 'Ibrahima Exemple', current_date - 5, current_date + 85, 'actif', NULL);
SELECT pg_temp.garder('inspection', public.planifier_inspection(pg_temp.demo_id(1, 1), 'Inspection mensuelle des pistes et merlons',
  'Ibrahima Exemple', current_date, 'Piste principale'));
SELECT public.realiser_inspection(pg_temp.v('inspection'), now(), 'Piste praticable, deux points a corriger', jsonb_build_array(
  jsonb_build_object('description', 'Merlon affaisse sur 15 m au virage du km 3', 'gravite', 'majeur', 'localisation', 'Km 3'),
  jsonb_build_object('description', 'Panneau de limitation de vitesse illisible', 'gravite', 'mineur', 'localisation', 'Entree du depot')));
SELECT pg_temp.garder('infraction', public.enregistrer_infraction(pg_temp.demo_id(4, 2), 'exces_vitesse', pg_temp.j(2, '13:20'),
  '45 km/h releves au radar portatif dans la descente limitee a 30 km/h par pluie', 'constat_interne', 'Descente du plateau Nord',
  pg_temp.v('v2'), pg_temp.demo_id(3, 2), NULL));
SELECT pg_temp.agir(pg_temp.demo_id(5, 2));
SELECT public.decider_sanction(pg_temp.v('infraction'), 'avertissement', 'Premier exces constate, rappel des consignes de pluie', NULL);
SELECT pg_temp.agir(pg_temp.demo_id(5, 4));
SELECT public.remettre_epi(pg_temp.demo_id(1, 1), 'Sekou Exemple', 'chaussures', 1, current_date - 2, current_date + 363,
  'Chaussures de securite S3', '43', pg_temp.demo_id(4, 3), NULL, NULL);
SELECT pg_temp.garder('plan_prevention', public.enregistrer_plan_prevention(NULL, pg_temp.demo_id(1, 1), 'Neemba (exemple), atelier mobile',
  'Remise en etat des freins de DEMO-T03 sur l''aire de maintenance', 'Ecrasement sous le camion, projection, brulure',
  'Calage du camion, consignation, zone balisee, EPI complets', current_date, current_date + 7, 'Chef d''equipe Neemba (exemple)', NULL, NULL));
SELECT pg_temp.agir(pg_temp.demo_id(5, 2));
SELECT public.signer_plan_prevention(pg_temp.v('plan_prevention'));

-- 6.4 Alertes : candidates du moteur de regles (v_alertes_candidates)
--     limitees aux elements d'exemple ; une alerte prise en compte.
INSERT INTO public.alerts (alert_type, regle, severity, title, message, reference_type, reference_id, vehicle_id, driver_id,
                           site_id, module, ecran, survenu_le, status)
SELECT c.regle, c.regle, c.severity, c.title, coalesce(c.message, ''), c.reference_type, c.reference_id, c.vehicle_id, c.driver_id,
       c.site_id, c.module, c.ecran, c.survenu_le, 'active'
  FROM public.v_alertes_candidates c
 WHERE c.site_id::text LIKE 'dec0de00-%' OR c.vehicle_id::text LIKE 'dec0de00-%' OR c.driver_id::text LIKE 'dec0de00-%'
    OR c.reference_id IN (SELECT id FROM demo_val)
 ORDER BY c.severity DESC, c.regle LIMIT 5;
-- Sans regle en service (seuils non parametres) : deux alertes saisies,
-- hors moteur de regles, sur les memes faits.
INSERT INTO public.alerts (alert_type, severity, title, message, reference_type, reference_id, vehicle_id, driver_id, site_id,
                           module, ecran, survenu_le, status)
SELECT x.*, 'active' FROM (VALUES
  ('vehicle_maintenance', 'warning', 'DEMO-T03 immobilise (freins)', 'Immobilisation ouverte depuis J-1, imputee a Neemba',
   'immobilisation', pg_temp.v('immobilisation'), pg_temp.demo_id(3, 3), NULL::uuid, pg_temp.demo_id(1, 1), 'maintenance', 'immobilisations',
   pg_temp.j(1, '07:40')),
  ('driver_license_expiry', 'info', 'Permis de Sekou Exemple a renouveler', 'Le permis expire dans 60 jours',
   'driver', pg_temp.demo_id(4, 3), NULL::uuid, pg_temp.demo_id(4, 3), pg_temp.demo_id(1, 1), 'drivers', 'chauffeurs', now())
) x WHERE NOT EXISTS (SELECT 1 FROM public.alerts a WHERE a.site_id = pg_temp.demo_id(1, 1));
SELECT pg_temp.agir(pg_temp.demo_id(5, 4));
SELECT public.prendre_en_compte_alerte((SELECT a.id FROM public.alerts a WHERE a.vehicle_id = pg_temp.demo_id(3, 3) LIMIT 1))
 WHERE EXISTS (SELECT 1 FROM public.alerts a WHERE a.vehicle_id = pg_temp.demo_id(3, 3));

-- 6.5 Rapport journalier de J-2 fige (piece datee et immuable, J3).
SELECT pg_temp.agir(pg_temp.demo_id(5, 3));
SELECT public.figer_rapport('journalier', current_date - 2, current_date - 2, pg_temp.demo_id(1, 1), NULL,
  'Rapport du shift de jour (exemple)');

/* 7. Finalisation (aucune fonction metier ici). */
-- Les controles differes (garde_reception_cbg : chaque pesee a l'arrivee a
-- son ticket CBG) s'executent ici, sur les lignes telles que les fonctions
-- les ont ecrites, avant tout renommage.
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pg_temp.agir(NULL);

-- 7.1 Notifications emises vers des comptes reels pendant le chargement
--     (destinataires choisis par role) : retirees, elles concernent des
--     elements fictifs.
DELETE FROM public.notifications n
 WHERE n.user_id::text NOT LIKE 'dec0de00-%'
   AND NOT EXISTS (SELECT 1 FROM demo_avant a WHERE a.t = 'public.notifications'::regclass AND a.id = n.id::text);

-- 7.2 Shifts d'exemple desactives : ils ne sont plus proposes aux saisies
--     reelles (les lignes d'exemple gardent leur reference).
UPDATE public.work_shifts SET is_active = false WHERE id::text LIKE 'dec0de00-%';

-- 7.3 Controles avant renommage.
CREATE TEMP TABLE demo_creees (t regclass, ancien uuid, nouveau uuid);
DO $$
DECLARE r record; n bigint; v_id_uuid boolean; v_a_id boolean; v_erreurs text := '';
BEGIN
  FOR r IN SELECT c.oid::regclass AS t, c.oid FROM pg_class c
            WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') ORDER BY 1 LOOP
    SELECT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = r.oid AND a.attname = 'id' AND NOT a.attisdropped),
           EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = r.oid AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped)
      INTO v_a_id, v_id_uuid;
    -- Lignes reelles modifiees ou supprimees
    IF v_a_id THEN
      EXECUTE format('SELECT count(*) FROM demo_avant a WHERE a.t = %L::regclass AND NOT EXISTS
                        (SELECT 1 FROM %s x WHERE x.id::text = a.id AND md5(x::text) = a.h)', r.t, r.t) INTO n;
    ELSE
      EXECUTE format('SELECT count(*) FROM demo_avant a WHERE a.t = %L::regclass AND NOT EXISTS
                        (SELECT 1 FROM %s x WHERE md5(x::text) = a.h)', r.t, r.t) INTO n;
    END IF;
    IF n > 0 AND r.t <> 'public.sigtb_demonstration'::regclass THEN
      v_erreurs := v_erreurs || format('%s : %s ligne(s) reelle(s) modifiee(s) ou supprimee(s) ; ', r.t, n);
    END IF;
    -- Lignes creees
    IF v_id_uuid THEN
      EXECUTE format('INSERT INTO demo_creees SELECT %L::regclass, x.id, CASE WHEN x.id::text LIKE ''dec0de00-%%'' THEN x.id
                        ELSE (''dec0de00'' || substr(x.id::text, 9))::uuid END
                        FROM %s x WHERE NOT EXISTS (SELECT 1 FROM demo_avant a WHERE a.t = %L::regclass AND a.id = x.id::text)',
                     r.t, r.t, r.t);
    ELSE
      EXECUTE format('SELECT count(*) FROM %s x WHERE NOT EXISTS (SELECT 1 FROM demo_avant a WHERE a.t = %L::regclass AND a.h = md5(x::text))',
                     r.t, r.t) INTO n;
      IF n > 0 AND r.t <> 'public.sigtb_demonstration'::regclass THEN
        v_erreurs := v_erreurs || format('%s : %s ligne(s) creee(s) sans identifiant uuid (purge impossible) ; ', r.t, n);
      END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM demo_creees c WHERE c.nouveau <> c.ancien
              AND EXISTS (SELECT 1 FROM demo_creees d WHERE d.ancien = c.nouveau)) THEN
    v_erreurs := v_erreurs || 'collision d''identifiants au renommage ; ';
  END IF;
  IF v_erreurs <> '' THEN
    RAISE EXCEPTION 'Chargement annule : %', v_erreurs;
  END IF;
END $$;

-- 7.4 Au plus 5 lignes par table metier. Les journaux et evenements
--     (traces ecrites par les fonctions a chaque action) sont comptes a
--     part, sans plafond.
CREATE TEMP TABLE demo_journaux (t regclass PRIMARY KEY);
INSERT INTO demo_journaux SELECT to_regclass('public.' || x) FROM unnest(ARRAY[
  'trip_events', 'postes_evenements', 'journal_contrats', 'factures_journal', 'fournisseurs_journal', 'achats_journal',
  'immobilisations_journal', 'journal_flotte', 'journal_shifts', 'consultations_journal', 'calculs_clauses_journal',
  'notifications', 'risques_versions', 'fiches_journal']) x WHERE to_regclass('public.' || x) IS NOT NULL;
DO $$
DECLARE v text;
BEGIN
  SELECT string_agg(t::text || ' (' || n || ')', ', ') INTO v
    FROM (SELECT t, count(*) n FROM demo_creees GROUP BY t) x
   WHERE n > 5 AND t NOT IN (SELECT t FROM demo_journaux);
  IF v IS NOT NULL THEN RAISE EXCEPTION 'Chargement annule : plus de 5 lignes dans %', v; END IF;
END $$;

-- 7.5 Renommage : identifiants `dec0de00-` et numeros `DEMO-`, dans les
--     seules lignes creees. Declencheurs suspendus pour ce seul renommage
--     (gardes d'immuabilite et cles etrangeres : toutes les references sont
--     renommees dans la meme instruction de table, rien ne reste orphelin).
CREATE TEMP TABLE demo_numeros (ancien text PRIMARY KEY, nouveau text);
CREATE INDEX ON demo_creees (ancien);
DO $$
DECLARE r record; c record; v_regex text := '^[A-Z]{2,5}-[0-9]{2,8}(-[0-9]{1,6})?$';
BEGIN
  -- Numeros generes par l'application (VYG-, FR-, FAC-, BC-, PAY-...).
  FOR r IN SELECT DISTINCT d.t FROM demo_creees d LOOP
    FOR c IN SELECT a.attname FROM pg_attribute a WHERE a.attrelid = r.t AND a.attnum > 0 AND NOT a.attisdropped
                AND a.atttypid = 'text'::regtype LOOP
      EXECUTE format('INSERT INTO demo_numeros SELECT DISTINCT x.%I, ''DEMO-'' || x.%I FROM %s x
                        WHERE x.id IN (SELECT ancien FROM demo_creees WHERE t = %L::regclass) AND x.%I ~ %L
                        ON CONFLICT DO NOTHING', c.attname, c.attname, r.t, r.t, c.attname, v_regex);
    END LOOP;
  END LOOP;
END $$;
CREATE FUNCTION pg_temp.renommer_texte(p text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE r record; v text := p;
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  FOR r IN SELECT ancien::text AS a, nouveau::text AS n FROM demo_creees WHERE ancien <> nouveau AND strpos(p, ancien::text) > 0 LOOP
    v := replace(v, r.a, r.n);
  END LOOP;
  FOR r IN SELECT ancien AS a, nouveau AS n FROM demo_numeros WHERE strpos(p, ancien) > 0 ORDER BY length(ancien) DESC LOOP
    v := regexp_replace(v, '(?<![A-Za-z0-9-])' || r.a || '(?![0-9])', r.n, 'g');
  END LOOP;
  RETURN v;
END $$;
SET LOCAL session_replication_role = replica;
DO $$
DECLARE r record; c record; v_set text;
BEGIN
  FOR r IN SELECT cl.oid::regclass AS t, cl.oid,
                  EXISTS (SELECT 1 FROM demo_creees d WHERE d.t = cl.oid::regclass) AS a_creees
             FROM pg_class cl WHERE cl.relnamespace = 'public'::regnamespace AND cl.relkind IN ('r', 'p') LOOP
    -- Colonnes uuid de toute table : une ligne reelle ne reference aucune
    -- ligne creee (controle 7.3), seules les lignes creees changent.
    FOR c IN SELECT a.attname, a.atttypid FROM pg_attribute a WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
                AND a.atttypid IN ('uuid'::regtype, 'uuid[]'::regtype) AND a.attgenerated = '' LOOP
      IF c.atttypid = 'uuid'::regtype THEN
        EXECUTE format('UPDATE %s x SET %I = d.nouveau FROM demo_creees d WHERE x.%I = d.ancien AND d.nouveau <> d.ancien',
                       r.t, c.attname, c.attname);
      ELSE
        EXECUTE format('UPDATE %s x SET %I = (SELECT array_agg(coalesce(d.nouveau, u) ORDER BY o) FROM unnest(x.%I) WITH ORDINALITY q(u, o)
                          LEFT JOIN demo_creees d ON d.ancien = q.u) WHERE x.%I && (SELECT array_agg(ancien) FROM demo_creees WHERE nouveau <> ancien)',
                       r.t, c.attname, c.attname, c.attname);
      END IF;
    END LOOP;
    -- Textes et jsonb des seules lignes creees : identifiants et numeros.
    IF r.a_creees THEN
      SELECT string_agg(format('%I = %s', a.attname,
               CASE WHEN a.atttypid = 'text'::regtype THEN format('pg_temp.renommer_texte(%I)', a.attname)
                    ELSE format('pg_temp.renommer_texte(%I::text)::jsonb', a.attname) END), ', ')
        INTO v_set
        FROM pg_attribute a WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
         AND a.atttypid IN ('text'::regtype, 'jsonb'::regtype) AND a.attgenerated = '';
      IF v_set IS NOT NULL THEN
        EXECUTE format('UPDATE %s x SET %s WHERE x.id IN (SELECT nouveau FROM demo_creees WHERE t = %L::regclass)', r.t, v_set, r.t);
      END IF;
    END IF;
  END LOOP;
END $$;
SET LOCAL session_replication_role = origin;

-- 7.6 Sequences des numeros textuels (prefixes DEMO- ci-dessus) remises a
--     leur position d'avant le chargement : la numerotation reelle ne saute
--     aucun numero. Les sequences de colonnes entieres (serial, identity,
--     valeur par defaut nextval) avancent : leurs valeurs, stockees telles
--     quelles dans les lignes d'exemple, ne doivent pas etre redonnees.
SELECT setval(s.s, s.valeur, s.appelee) FROM demo_sequences s
 WHERE NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = s.s::oid AND d.deptype IN ('a', 'i'))
   AND NOT EXISTS (SELECT 1 FROM pg_attrdef ad WHERE pg_get_expr(ad.adbin, ad.adrelid) LIKE '%' || (SELECT relname FROM pg_class WHERE oid = s.s::oid) || '%');

-- 7.7 Bandeau « DONNEES DE DEMONSTRATION » (D-020).
INSERT INTO public.sigtb_demonstration (id, active, chargee_le, description)
VALUES (1, true, now(), 'Donnees d''exemple (D-084) : 5 lignes au plus par table, identifiants dec0de00-, numeros DEMO-')
ON CONFLICT (id) DO UPDATE SET active = true, chargee_le = now(), description = EXCLUDED.description;

-- 7.8 Compte rendu : lignes d'exemple par table.
\o
SELECT d.t::text AS table_nom, count(*) AS lignes,
       CASE WHEN d.t IN (SELECT t FROM demo_journaux) THEN 'journal' ELSE '' END AS nature
  FROM demo_creees d GROUP BY d.t ORDER BY 3, 1;
SELECT count(*) AS total_lignes, count(DISTINCT t) AS tables FROM demo_creees;

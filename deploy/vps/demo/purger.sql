/*
  Purge des donnees de DEMONSTRATION SIGTB (D-020, D-074).

  1. Racines : toute ligne d'une table de `public` dont l'`id` (uuid) commence
     par `dec0de00-` (lignes etiquetees).
  2. Fermeture : toute ligne qui reference une ligne marquee par une cle
     etrangere (tous schemas, a toute profondeur, auto-references et cycles
     compris) est marquee a son tour, jusqu'a ce qu'aucune ligne nouvelle
     n'apparaisse. Les cles en ON DELETE SET NULL ou SET DEFAULT ne marquent
     rien : Postgres detache la ligne, qui est conservee.
  3. Lignes rattachees non etiquetees : elles ne sont supprimees que dans les
     tables operationnelles de la liste ci-dessous (voyages, evenements,
     dispatch, fiches, postes, objectifs, releves, suivi, controles,
     incidents). Une ligne non etiquetee de toute autre table (comptes,
     profils, droits, referentiels, engins, contrats, argent, tickets CBG qui
     sont des preuves immuables...) ARRETE la purge, qui la liste.
  4. Suppression par passes jusqu'a epuisement ; controle final : plus aucune
     valeur `dec0de00-` dans une colonne uuid de `public`.

  Variables psql :
    mode    = apercu | purger   (apercu : tout est calcule puis annule)
    attendu = nombre de lignes rattachees non etiquetees que l'operateur a
              vues dans l'apercu et accepte de supprimer (purger seulement).
  Execution par demo.sh (le script ouvre et ferme sa transaction), en
  supabase_admin : les gardes d'ecriture laissent passer la maintenance.
*/
\set ON_ERROR_STOP on
\if :{?attendu}
\else
  \set attendu -1
\endif
BEGIN;
SET LOCAL client_min_messages = warning;

CREATE TEMP TABLE purge_marque (t regclass, id text, etiquetee boolean, via text, PRIMARY KEY (t, id)) ON COMMIT DROP;
CREATE TEMP TABLE purge_blocage (t text, id text, via text) ON COMMIT DROP;
CREATE TEMP TABLE purge_compte (t text, etiquetees bigint, rattachees bigint) ON COMMIT DROP;
CREATE TEMP TABLE purge_operationnelles (t regclass PRIMARY KEY) ON COMMIT DROP;

-- Tables ou une ligne non etiquetee rattachee a la demonstration peut etre
-- supprimee (donnees d'usage creees sur la demonstration).
INSERT INTO purge_operationnelles
SELECT to_regclass('public.' || x) FROM unnest(ARRAY[
  'trips', 'trip_events', 'decisions_dispatch', 'dispatch_assignments', 'mission_requirements',
  'fiches_terrain', 'postes', 'postes_equipe', 'postes_evenements', 'objectifs_production',
  'distances_voyage', 'releves_compteur', 'trip_waypoints', 'trip_route_tracking', 'vehicle_tracking',
  'tracking_events', 'geofence_violations', 'geofence_alerts', 'pointages_engins', 'weighings',
  'controles_depart', 'controles_depart_points', 'incidents', 'incidents_journal', 'actions_correctives',
  'eco_driving_scores', 'alerts']) x
WHERE to_regclass('public.' || x) IS NOT NULL;

DO $$
DECLARE
  r record; k record; n bigint; v_tour int := 0;
  v_cols text; v_cols_parent text; v_a_id boolean;
BEGIN
  -- 1. Racines
  FOR r IN
    SELECT c.oid::regclass AS t
      FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped
     WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('INSERT INTO purge_marque SELECT %L::regclass, id::text, true, ''racine'' FROM %s WHERE id::text LIKE ''dec0de00-%%''', r.t, r.t);
  END LOOP;

  -- 2. Fermeture par les cles etrangeres
  LOOP
    v_tour := v_tour + 1;
    n := 0;
    FOR k IN
      SELECT c.conname, c.conrelid::regclass AS enfant, c.confrelid::regclass AS parent, c.conkey, c.confkey, c.conrelid, c.confrelid
        FROM pg_constraint c
       WHERE c.contype = 'f' AND c.confdeltype NOT IN ('n', 'd')
         AND EXISTS (SELECT 1 FROM purge_marque m WHERE m.t = c.confrelid::regclass)
    LOOP
      SELECT string_agg(format('e.%I', a.attname), ', ' ORDER BY u.n) INTO v_cols
        FROM unnest(k.conkey) WITH ORDINALITY u(att, n) JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.att;
      SELECT string_agg(format('p.%I', a.attname), ', ' ORDER BY u.n) INTO v_cols_parent
        FROM unnest(k.confkey) WITH ORDINALITY u(att, n) JOIN pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = u.att;
      SELECT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = k.conrelid AND a.attname = 'id' AND NOT a.attisdropped) INTO v_a_id;
      IF NOT v_a_id THEN
        EXECUTE format('SELECT count(*) FROM %s e WHERE (%s) IN (SELECT %s FROM %s p JOIN purge_marque m ON m.t = %L::regclass AND m.id = p.id::text)',
                       k.enfant, v_cols, v_cols_parent, k.parent, k.parent) INTO n;
        IF n > 0 THEN
          INSERT INTO purge_blocage SELECT k.enfant::text, '(table sans colonne id : ' || n || ' ligne(s))', k.conname
           WHERE NOT EXISTS (SELECT 1 FROM purge_blocage b WHERE b.t = k.enfant::text AND b.via = k.conname);
        END IF;
        n := 0;
        CONTINUE;
      END IF;
      EXECUTE format(
        'INSERT INTO purge_marque
         SELECT %L::regclass, e.id::text, e.id::text LIKE ''dec0de00-%%'', %L
           FROM %s e
          WHERE (%s) IN (SELECT %s FROM %s p JOIN purge_marque m ON m.t = %L::regclass AND m.id = p.id::text)
         ON CONFLICT DO NOTHING',
        k.enfant, k.conname, k.enfant, v_cols, v_cols_parent, k.parent, k.parent);
    END LOOP;
    SELECT count(*) INTO n FROM purge_marque;
    EXIT WHEN n = coalesce(current_setting('purge.n', true), '-1')::bigint;
    PERFORM set_config('purge.n', n::text, true);
    IF v_tour > 100 THEN RAISE EXCEPTION 'Purge : fermeture non stabilisee apres 100 passes'; END IF;
  END LOOP;

  -- 3. Lignes rattachees hors des tables operationnelles : blocage
  INSERT INTO purge_blocage
  SELECT m.t::text, m.id, m.via FROM purge_marque m
   WHERE NOT m.etiquetee AND m.t NOT IN (SELECT t FROM purge_operationnelles);
END $$;

\echo '=== Lignes marquees (etiquetees dec0de00 / rattachees non etiquetees)'
SELECT m.t::text AS table_nom, count(*) FILTER (WHERE m.etiquetee) AS etiquetees, count(*) FILTER (WHERE NOT m.etiquetee) AS rattachees
  FROM purge_marque m GROUP BY m.t ORDER BY count(*) FILTER (WHERE NOT m.etiquetee) DESC, 1;
\echo '=== Lignes rattachees non etiquetees qui seraient supprimees (20 par table au plus)'
SELECT t::text AS table_nom, id, via AS par_la_cle FROM (
  SELECT m.*, row_number() OVER (PARTITION BY m.t ORDER BY m.id) AS rang FROM purge_marque m
   WHERE NOT m.etiquetee AND m.t IN (SELECT t FROM purge_operationnelles)) x
 WHERE rang <= 20 ORDER BY 1, 2;
SELECT count(*) AS total_rattachees FROM purge_marque WHERE NOT etiquetee \gset
\echo '=== Blocages (la purge s''arrete si cette liste n''est pas vide)'
SELECT * FROM purge_blocage ORDER BY 1, 2;
SELECT count(*) AS nb_blocages FROM purge_blocage \gset
\echo 'Total des lignes rattachees non etiquetees :' :total_rattachees ' ; blocages :' :nb_blocages

SELECT (:nb_blocages = 0) AS sans_blocage, (:'mode' = 'purger') AS valider,
       (:'attendu' = :'total_rattachees') AS attendu_ok \gset
\if :sans_blocage
\else
  ROLLBACK;
  DO $$ BEGIN RAISE EXCEPTION 'PURGE REFUSEE : des lignes non etiquetees hors des tables operationnelles sont rattachees a la demonstration (liste des blocages ci-dessus). Les detacher ou decider de leur sort, puis relancer.'; END $$;
\endif
\if :valider
  \if :attendu_ok
  \else
    ROLLBACK;
    DO $$ BEGIN RAISE EXCEPTION 'PURGE REFUSEE : CONFIRMER_RATTACHEES ne correspond pas au total des lignes rattachees affiche par l''apercu.'; END $$;
  \endif
\endif

-- 4. Suppression par passes (enfants avant parents ; ligne par ligne en dernier recours)
DO $$
DECLARE r record; l record; v_reste bigint; v_avant bigint; v_tour int := 0; n bigint;
BEGIN
  INSERT INTO purge_compte SELECT t::text, count(*) FILTER (WHERE etiquetee), count(*) FILTER (WHERE NOT etiquetee) FROM purge_marque GROUP BY t;
  LOOP
    v_tour := v_tour + 1;
    SELECT count(*) INTO v_avant FROM purge_marque;
    EXIT WHEN v_avant = 0;
    FOR r IN SELECT DISTINCT t FROM purge_marque LOOP
      BEGIN
        EXECUTE format('DELETE FROM %s WHERE id::text IN (SELECT id FROM purge_marque WHERE t = %L::regclass)', r.t, r.t);
        DELETE FROM purge_marque WHERE t = r.t;
      EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
        FOR l IN SELECT id FROM purge_marque WHERE t = r.t LOOP
          BEGIN
            EXECUTE format('DELETE FROM %s WHERE id::text = %L', r.t, l.id);
            DELETE FROM purge_marque WHERE t = r.t AND id = l.id;
          EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN NULL;
          END;
        END LOOP;
      END;
    END LOOP;
    SELECT count(*) INTO v_reste FROM purge_marque;
    IF v_reste = v_avant THEN
      RAISE EXCEPTION 'Purge : % ligne(s) impossibles a supprimer (premiere : %)', v_reste,
        (SELECT t::text || ' ' || id FROM purge_marque LIMIT 1);
    END IF;
  END LOOP;
  -- Controle : plus aucune valeur dec0de00 dans une colonne uuid de public
  FOR r IN SELECT c.oid::regclass AS t, a.attname FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
            WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND a.atttypid = 'uuid'::regtype AND a.attnum > 0 AND NOT a.attisdropped LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I::text LIKE ''dec0de00-%%''', r.t, r.attname) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Purge : % valeur(s) dec0de00 restent dans %.%', n, r.t, r.attname;
    END IF;
  END LOOP;
END $$;

UPDATE public.sigtb_demonstration SET active = false WHERE id = 1;

\echo '=== Lignes supprimees'
SELECT t AS table_nom, etiquetees, rattachees FROM purge_compte ORDER BY rattachees DESC, t;
SELECT coalesce(sum(etiquetees), 0) AS total_etiquetees, coalesce(sum(rattachees), 0) AS total_rattachees FROM purge_compte;

\if :valider
  \echo 'PURGE VALIDEE'
  COMMIT;
\else
  \echo 'APERCU : rien n''est modifie (annulation). Pour purger : CONFIRMER_PURGE=oui CONFIRMER_RATTACHEES=' :total_rattachees ' demo.sh purger'
  ROLLBACK;
\endif

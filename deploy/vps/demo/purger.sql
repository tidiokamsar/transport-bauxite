/*
  Purge des donnees de DEMONSTRATION SIGTB (D-020, D-074).

  Racines : toute ligne d'une table dont la colonne `id` (uuid) commence par
  `dec0de00-`. La purge suit les cles etrangeres (tous schemas) et supprime
  d'abord les lignes qui referencent ces racines, a toute profondeur, puis
  les racines. Elle supprime donc aussi les lignes non etiquetees rattachees
  a la demonstration (voyages prepares sur un camion de demo, fiches, postes,
  objectifs de test...) : `demo.sh apercu` les liste avant toute purge.

  Variable psql `mode` :
    apercu : tout est calcule et supprime puis annule (ROLLBACK) ; rien ne change.
    purger : suppression validee ; le bandeau de demonstration est retire.
  Execution par demo.sh (le script ouvre et ferme sa transaction), en supabase_admin : les
  gardes d'ecriture laissent passer la maintenance (auth.uid() absent).
*/
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL client_min_messages = warning;

CREATE TEMP TABLE purge_compte (table_nom text, etiquetees bigint, rattachees bigint) ON COMMIT DROP;

CREATE FUNCTION pg_temp.purger_table(p_table regclass, p_condition text, p_profondeur int)
RETURNS void
LANGUAGE plpgsql
AS $f$
DECLARE
  k record;
  v_enfant text;
  v_total bigint;
  v_etiq bigint;
  v_a_id boolean;
BEGIN
  IF p_profondeur > 12 THEN
    RAISE EXCEPTION 'Purge : profondeur de cles etrangeres excessive depuis %', p_table;
  END IF;
  -- Enfants d'abord (autres tables qui referencent les lignes visees)
  FOR k IN
    SELECT c.conrelid::regclass AS enfant,
           (SELECT string_agg(format('%I', a.attname), ', ' ORDER BY u.n)
              FROM unnest(c.conkey) WITH ORDINALITY u(att, n) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.att) AS cols,
           (SELECT string_agg(format('%I', a.attname), ', ' ORDER BY u.n)
              FROM unnest(c.confkey) WITH ORDINALITY u(att, n) JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = u.att) AS cols_parent
      FROM pg_constraint c
     WHERE c.contype = 'f' AND c.confrelid = p_table AND c.conrelid <> p_table
  LOOP
    v_enfant := format('(%s) IN (SELECT %s FROM %s WHERE %s)', k.cols, k.cols_parent, p_table, p_condition);
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %s)', k.enfant, v_enfant) INTO v_a_id;
    IF v_a_id THEN
      PERFORM pg_temp.purger_table(k.enfant, v_enfant, p_profondeur + 1);
    END IF;
  END LOOP;
  -- Lignes de la meme table qui referencent les lignes visees (auto-reference)
  FOR k IN
    SELECT (SELECT string_agg(format('%I', a.attname), ', ' ORDER BY u.n)
              FROM unnest(c.conkey) WITH ORDINALITY u(att, n) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.att) AS cols,
           (SELECT string_agg(format('%I', a.attname), ', ' ORDER BY u.n)
              FROM unnest(c.confkey) WITH ORDINALITY u(att, n) JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = u.att) AS cols_parent
      FROM pg_constraint c
     WHERE c.contype = 'f' AND c.confrelid = p_table AND c.conrelid = p_table
  LOOP
    p_condition := format('(%s) OR (%s) IN (SELECT %s FROM %s WHERE %s)', p_condition, k.cols, k.cols_parent, p_table, p_condition);
  END LOOP;
  SELECT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = p_table AND a.attname = 'id' AND NOT a.attisdropped) INTO v_a_id;
  IF v_a_id THEN
    EXECUTE format('SELECT count(*) FILTER (WHERE id::text LIKE ''dec0de00-%%'') FROM %s WHERE %s', p_table, p_condition) INTO v_etiq;
  ELSE
    v_etiq := 0;
  END IF;
  EXECUTE format('DELETE FROM %s WHERE %s', p_table, p_condition);
  GET DIAGNOSTICS v_total = ROW_COUNT;
  IF v_total > 0 THEN
    INSERT INTO purge_compte VALUES (p_table::text, v_etiq, v_total - v_etiq);
  END IF;
END;
$f$;

DO $$
DECLARE t record; v_existe boolean;
BEGIN
  FOR t IN
    SELECT c.oid::regclass AS nom
      FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped
     WHERE c.relnamespace IN ('public'::regnamespace) AND c.relkind IN ('r', 'p')
     ORDER BY c.relname
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE id::text LIKE ''dec0de00-%%'')', t.nom) INTO v_existe;
    IF v_existe THEN
      PERFORM pg_temp.purger_table(t.nom, 'id::text LIKE ''dec0de00-%''', 0);
    END IF;
  END LOOP;
END $$;

UPDATE public.sigtb_demonstration SET active = false WHERE id = 1;

\echo 'table | lignes etiquetees dec0de00 | lignes rattachees non etiquetees'
SELECT table_nom, sum(etiquetees) AS etiquetees, sum(rattachees) AS rattachees
  FROM purge_compte GROUP BY table_nom ORDER BY sum(rattachees) DESC, table_nom;
SELECT 'TOTAL' AS table_nom, coalesce(sum(etiquetees), 0) AS etiquetees, coalesce(sum(rattachees), 0) AS rattachees FROM purge_compte;
SELECT 'restant dec0de00 (doit etre 0)' AS controle, count(*) FROM (
  SELECT 1 FROM public.sites WHERE id::text LIKE 'dec0de00-%' UNION ALL
  SELECT 1 FROM public.vehicles WHERE id::text LIKE 'dec0de00-%' UNION ALL
  SELECT 1 FROM public.drivers WHERE id::text LIKE 'dec0de00-%' UNION ALL
  SELECT 1 FROM public.trips WHERE id::text LIKE 'dec0de00-%') x;

SELECT CASE WHEN :'mode' = 'purger' THEN 'PURGE VALIDEE' ELSE 'APERCU : rien n''est modifie (annulation)' END AS resultat;
SELECT :'mode' = 'purger' AS valider \gset
\if :valider
COMMIT;
\else
ROLLBACK;
\endif

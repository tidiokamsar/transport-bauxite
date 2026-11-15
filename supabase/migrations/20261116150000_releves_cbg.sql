/*
  # Releves CBG et rapprochement des tickets (D-050, lot 10, module 14)

  CBG pese et emet les tickets (D-037). KOGON importe le releve periodique
  de CBG, le rapproche des tickets integres aux voyages et traite les
  anomalies. Aucune donnee du releve n'est corrigee : il est conserve tel
  que recu ; les decisions sont des evenements motives.

  1. `releves_cbg` (reference, periode, site, fichier source) et
     `releves_cbg_lignes` (ticket, date, immatriculation, brut, tare, net
     tels que fournis par CBG), append-only.
  2. `rapprocher_releve_cbg` : chaque ligne du releve est confrontee au
     ticket SIGTB de meme numero (normalise) :
     concordant, ecart_poids (au-dela de la tolerance `settings`
     tolerance_poids_cbg_t, 0 si absente), immatriculation_differente,
     date_differente, absent_sigtb (ticket inconnu de SIGTB). Les tickets
     SIGTB de la periode et du site absents du releve sont signales
     manquant_releve.
  3. `decider_ecart_releve_cbg` : accepte ou litige, motif obligatoire.
  4. `v_voyages_livres_sans_ticket` : voyages livres sans ticket CBG.

  Droits : lecture modules voyages ou factures ; ecriture par fonctions
  serveur sous `has_module_write('trips')`. Idempotent.
*/

CREATE TABLE IF NOT EXISTS public.releves_cbg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE CHECK (btrim(reference) <> ''),
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  site_id uuid REFERENCES public.sites(id),
  fichier_source text,
  statut text NOT NULL DEFAULT 'importe' CHECK (statut IN ('importe', 'rapproche')),
  importe_par uuid REFERENCES auth.users(id),
  importe_le timestamptz NOT NULL DEFAULT now(),
  rapproche_le timestamptz,
  CHECK (periode_fin >= periode_debut)
);

CREATE TABLE IF NOT EXISTS public.releves_cbg_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  releve_id uuid NOT NULL REFERENCES public.releves_cbg(id),
  rang integer NOT NULL,
  ticket text,
  date_pesee date,
  immatriculation text,
  brut numeric,
  tare numeric,
  net numeric,
  UNIQUE (releve_id, rang)
);

CREATE TABLE IF NOT EXISTS public.ecarts_releve_cbg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  releve_id uuid NOT NULL REFERENCES public.releves_cbg(id),
  ligne_id uuid REFERENCES public.releves_cbg_lignes(id),
  ticket_id uuid REFERENCES public.tickets_pesee_cbg(id),
  nature text NOT NULL CHECK (nature IN ('concordant', 'ecart_poids', 'immatriculation_differente', 'date_differente',
                                         'absent_sigtb', 'manquant_releve', 'ligne_illisible')),
  detail text,
  ecart_net numeric,
  decision text CHECK (decision IN ('accepte', 'litige')),
  motif text,
  decide_par uuid REFERENCES auth.users(id),
  decide_le timestamptz,
  CHECK ((decision IS NULL) = (motif IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_ecarts_releve ON public.ecarts_releve_cbg(releve_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['releves_cbg', 'releves_cbg_lignes', 'ecarts_releve_cbg'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture ON public.%I FOR SELECT TO authenticated
      USING (public.has_module_view(''trips'') OR public.has_module_view(''invoices'') OR public.is_admin())', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.importer_releve_cbg(
  p_reference text, p_du date, p_au date, p_site_id uuid, p_fichier text, p_lignes jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; x jsonb; n integer := 0;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF p_site_id IS NOT NULL AND NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_reference, '')), '') IS NULL OR p_du IS NULL OR p_au IS NULL OR p_au < p_du THEN
    RAISE EXCEPTION 'Reference et periode du releve requises' USING ERRCODE = '22023';
  END IF;
  IF coalesce(jsonb_array_length(p_lignes), 0) = 0 THEN
    RAISE EXCEPTION 'Releve vide' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.releves_cbg (reference, periode_debut, periode_fin, site_id, fichier_source, importe_par)
  VALUES (btrim(p_reference), p_du, p_au, p_site_id, nullif(btrim(coalesce(p_fichier, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  -- Les valeurs sont gardees telles que lues ; une valeur illisible reste NULL.
  FOR x IN SELECT v FROM jsonb_array_elements(p_lignes) AS t(v) LOOP
    n := n + 1;
    INSERT INTO public.releves_cbg_lignes (releve_id, rang, ticket, date_pesee, immatriculation, brut, tare, net)
    VALUES (v_id, n, nullif(btrim(x ->> 'ticket'), ''),
            CASE WHEN x ->> 'date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (x ->> 'date')::date END,
            nullif(btrim(x ->> 'immatriculation'), ''),
            CASE WHEN x ->> 'brut' ~ '^-?\d+(\.\d+)?$' THEN (x ->> 'brut')::numeric END,
            CASE WHEN x ->> 'tare' ~ '^-?\d+(\.\d+)?$' THEN (x ->> 'tare')::numeric END,
            CASE WHEN x ->> 'net' ~ '^-?\d+(\.\d+)?$' THEN (x ->> 'net')::numeric END);
  END LOOP;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.normaliser_immatriculation(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT nullif(regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.rapprocher_releve_cbg(p_releve_id uuid)
RETURNS TABLE (nature text, nombre integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.releves_cbg; l public.releves_cbg_lignes; t record; v_tol numeric; v_net numeric;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.releves_cbg WHERE id = p_releve_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Releve introuvable' USING ERRCODE = 'P0002'; END IF;
  IF r.statut <> 'importe' THEN RAISE EXCEPTION 'Releve deja rapproche' USING ERRCODE = '22023'; END IF;
  SELECT coalesce((SELECT (s.value ->> 'value')::numeric FROM public.settings s WHERE s.key = 'tolerance_poids_cbg_t'), 0) INTO v_tol;

  FOR l IN SELECT * FROM public.releves_cbg_lignes WHERE releve_id = r.id ORDER BY rang LOOP
    v_net := coalesce(l.net, l.brut - l.tare);
    IF l.ticket IS NULL OR v_net IS NULL THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, nature, detail)
      VALUES (r.id, l.id, 'ligne_illisible', 'Ticket ou poids absent de la ligne ' || l.rang);
      CONTINUE;
    END IF;
    SELECT k.id, k.net, k.mesure_le, k.trip_id, v.registration INTO t
      FROM public.v_tickets_pesee_cbg_effectifs k
      JOIN public.trips tr ON tr.id = k.trip_id
      LEFT JOIN public.vehicles v ON v.id = tr.vehicle_id
     WHERE upper(btrim(k.ticket)) = upper(btrim(l.ticket));
    IF NOT FOUND THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, nature, detail)
      VALUES (r.id, l.id, 'absent_sigtb', 'Ticket ' || l.ticket || ' du releve inconnu de SIGTB');
    ELSIF abs(v_net - t.net) > v_tol THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, ticket_id, nature, detail, ecart_net)
      VALUES (r.id, l.id, t.id, 'ecart_poids', format('Net CBG %s t, SIGTB %s t', v_net, t.net), v_net - t.net);
    ELSIF l.immatriculation IS NOT NULL AND public.normaliser_immatriculation(l.immatriculation) IS DISTINCT FROM public.normaliser_immatriculation(t.registration) THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, ticket_id, nature, detail)
      VALUES (r.id, l.id, t.id, 'immatriculation_differente', format('CBG %s, SIGTB %s', l.immatriculation, coalesce(t.registration, 'aucun camion')));
    ELSIF l.date_pesee IS NOT NULL AND l.date_pesee <> (t.mesure_le AT TIME ZONE 'Africa/Conakry')::date THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, ticket_id, nature, detail)
      VALUES (r.id, l.id, t.id, 'date_differente', format('CBG %s, SIGTB %s', l.date_pesee, (t.mesure_le AT TIME ZONE 'Africa/Conakry')::date));
    ELSE
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, ticket_id, nature)
      VALUES (r.id, l.id, t.id, 'concordant');
    END IF;
  END LOOP;

  -- Tickets SIGTB de la periode (et du site) absents du releve.
  INSERT INTO public.ecarts_releve_cbg (releve_id, ticket_id, nature, detail)
  SELECT r.id, k.id, 'manquant_releve', 'Ticket ' || k.ticket || ' integre a SIGTB, absent du releve CBG'
    FROM public.v_tickets_pesee_cbg_effectifs k
   WHERE (k.mesure_le AT TIME ZONE 'Africa/Conakry')::date BETWEEN r.periode_debut AND r.periode_fin
     AND (r.site_id IS NULL OR k.site_id = r.site_id)
     AND NOT EXISTS (SELECT 1 FROM public.releves_cbg_lignes l2 WHERE l2.releve_id = r.id AND upper(btrim(l2.ticket)) = upper(btrim(k.ticket)));

  UPDATE public.releves_cbg SET statut = 'rapproche', rapproche_le = now() WHERE id = r.id;
  RETURN QUERY SELECT e.nature, count(*)::integer FROM public.ecarts_releve_cbg e WHERE e.releve_id = r.id GROUP BY e.nature ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.decider_ecart_releve_cbg(p_ecart_id uuid, p_decision text, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.ecarts_releve_cbg;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO e FROM public.ecarts_releve_cbg WHERE id = p_ecart_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ecart introuvable' USING ERRCODE = 'P0002'; END IF;
  IF e.nature = 'concordant' THEN RAISE EXCEPTION 'Ligne concordante : aucune decision' USING ERRCODE = '22023'; END IF;
  IF e.decision IS NOT NULL THEN RAISE EXCEPTION 'Ecart deja decide' USING ERRCODE = '22023'; END IF;
  IF p_decision NOT IN ('accepte', 'litige') OR nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Decision (accepte ou litige) et motif requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ecarts_releve_cbg SET decision = p_decision, motif = btrim(p_motif), decide_par = auth.uid(), decide_le = now()
   WHERE id = p_ecart_id;
END;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'importer_releve_cbg(text, date, date, uuid, text, jsonb)',
    'rapprocher_releve_cbg(uuid)',
    'decider_ecart_releve_cbg(uuid, text, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.v_voyages_livres_sans_ticket WITH (security_invoker = true) AS
SELECT t.id, t.reference, t.planned_date, t.vehicle_id, t.departure_site_id, t.arrival_site_id, t.etat
  FROM public.trips t
 WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
   AND NOT EXISTS (SELECT 1 FROM public.tickets_pesee_cbg k WHERE k.trip_id = t.id);
GRANT SELECT ON public.v_voyages_livres_sans_ticket TO authenticated;

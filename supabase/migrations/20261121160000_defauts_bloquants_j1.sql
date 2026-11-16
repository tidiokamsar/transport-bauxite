/*
  D-078 : defauts bloquants de la chaine J1 (revue du catalogue, groupe C).

  Constats (production purgee, premiere saisie reelle) :
  1. Aucun shift : `work_shifts` n'a aucune ligne et aucune fonction ne
     l'ecrit ; la table restait ecrivable en direct par le droit `trips`
     (politique heritee `ecriture_roles_metier`, droits complets d'anon).
     -> `definir_shift`, `desactiver_shift`, journal `journal_shifts`,
     ecritures directes retirees.
  2. `saisir_rotation` exigeait que le site de la fiche soit le depot
     d'arrivee alors que la fiche est preparee au site de depart (elle suit
     le camion, D-037) : sur un trajet Nimba -> depot CBG aucun ticket ne
     pouvait etre rattache. -> fiche du site de depart ou d'arrivee du
     voyage ; le ticket porte le site d'arrivee (inchange).
  3. Vraisemblance du ticket : un net superieur a la capacite du camion
     (saisie en kg au lieu de tonnes, par exemple) devient l'anomalie
     `net_superieur_capacite` de la reconciliation (a examiner, decision
     motivee ; jamais un refus silencieux, jamais une correction).
  4. Voyage pese a l'arrivee sans ticket : la pesee a l'arrivee
     (WEIGHED_IN) n'existe plus sans ticket CBG (garde sur `trip_events`) ;
     `rattacher_ticket_cbg` integre le ticket a la reception (en
     dechargement) ou le rattache, avec motif, a un voyage deja livre sans
     ticket ; le ticket garde son origine et son motif (journal immuable).
  6. `definir_objectif` et `annuler_objectif` controlent le perimetre de
     site avant toute lecture (message unique).
  7. (non modifie) `decider_ligne_reconciliation` refuse toujours
     « facturable » avec `ticket_rectifie` : question au proprietaire, D-078.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- ===================================================================
-- 1. Shifts
-- ===================================================================

-- Libelle et nom uniques sans tenir compte de la casse ni des espaces
-- (production : 0 ligne, l'index se cree sans conflit).
CREATE UNIQUE INDEX IF NOT EXISTS work_shifts_libelle_uq ON public.work_shifts (lower(btrim(display_name)));
CREATE UNIQUE INDEX IF NOT EXISTS work_shifts_nom_uq ON public.work_shifts (lower(btrim(name)));

-- Ecriture par fonctions serveur seulement.
DROP POLICY IF EXISTS ecriture_roles_metier ON public.work_shifts;
DROP POLICY IF EXISTS "Admins full access" ON public.work_shifts;
REVOKE ALL ON public.work_shifts FROM anon, authenticated;
GRANT SELECT ON public.work_shifts TO authenticated;
GRANT ALL ON public.work_shifts TO service_role;
DROP POLICY IF EXISTS lecture_authentifies ON public.work_shifts;
CREATE POLICY lecture_authentifies ON public.work_shifts FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.journal_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.work_shifts(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('creation', 'modification', 'desactivation', 'reactivation')),
  avant jsonb,
  apres jsonb NOT NULL,
  motif text,
  auteur uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_shifts_motif CHECK (action = 'creation' OR nullif(btrim(coalesce(motif, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS journal_shifts_shift_idx ON public.journal_shifts (shift_id, le DESC);
ALTER TABLE public.journal_shifts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.journal_shifts FROM anon, authenticated;
GRANT SELECT ON public.journal_shifts TO authenticated;
GRANT ALL ON public.journal_shifts TO service_role;
DROP POLICY IF EXISTS lecture_parametres ON public.journal_shifts;
CREATE POLICY lecture_parametres ON public.journal_shifts FOR SELECT TO authenticated
  USING (public.has_module_view('settings') OR public.is_admin());

CREATE OR REPLACE FUNCTION public.journal_shifts_immuable()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Journal des shifts immuable' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS garde_immuable ON public.journal_shifts;
CREATE TRIGGER garde_immuable BEFORE UPDATE OR DELETE ON public.journal_shifts
  FOR EACH ROW EXECUTE FUNCTION public.journal_shifts_immuable();

-- Plage d'un shift en minutes sur 24 h ; un shift de nuit (fin <= debut)
-- couvre la fin de journee et le debut de la suivante.
CREATE OR REPLACE FUNCTION public.plage_shift(p_debut time, p_fin time)
RETURNS int4multirange LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_debut < p_fin THEN int4multirange(int4range(
      (extract(hour FROM p_debut) * 60 + extract(minute FROM p_debut))::int,
      (extract(hour FROM p_fin) * 60 + extract(minute FROM p_fin))::int))
    ELSE int4multirange(
      int4range((extract(hour FROM p_debut) * 60 + extract(minute FROM p_debut))::int, 1440),
      int4range(0, (extract(hour FROM p_fin) * 60 + extract(minute FROM p_fin))::int))
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.plage_shift(time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plage_shift(time, time) TO authenticated;

-- Controles communs a la creation, la modification et la reactivation.
CREATE OR REPLACE FUNCTION public.controler_shift(p_id uuid, p_nom text, p_libelle text, p_debut time, p_fin time, p_ordre integer, p_actif boolean)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE autre record;
BEGIN
  IF p_nom IS NULL OR p_libelle IS NULL THEN
    RAISE EXCEPTION 'Nom et libelle du shift requis' USING ERRCODE = '22023';
  END IF;
  IF p_debut IS NULL OR p_fin IS NULL THEN
    RAISE EXCEPTION 'Heures de debut et de fin requises' USING ERRCODE = '22023';
  END IF;
  IF date_trunc('minute', p_debut) <> p_debut OR date_trunc('minute', p_fin) <> p_fin THEN
    RAISE EXCEPTION 'Heures a la minute pres (HH:MM)' USING ERRCODE = '22023';
  END IF;
  IF p_debut = p_fin THEN
    RAISE EXCEPTION 'Heure de fin egale a l''heure de debut : un shift ne couvre pas 24 h' USING ERRCODE = '22023';
  END IF;
  IF p_ordre IS NULL OR p_ordre < 1 THEN
    RAISE EXCEPTION 'Ordre d''affichage requis (entier positif)' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work_shifts w WHERE w.id IS DISTINCT FROM p_id AND lower(btrim(w.display_name)) = lower(p_libelle)) THEN
    RAISE EXCEPTION 'Un shift porte deja le libelle %', p_libelle USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work_shifts w WHERE w.id IS DISTINCT FROM p_id AND lower(btrim(w.name)) = lower(p_nom)) THEN
    RAISE EXCEPTION 'Un shift porte deja le nom %', p_nom USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work_shifts w WHERE w.id IS DISTINCT FROM p_id AND w.shift_order = p_ordre) THEN
    RAISE EXCEPTION 'Ordre % deja pris par un autre shift', p_ordre USING ERRCODE = '23505';
  END IF;
  IF p_actif THEN
    SELECT w.display_name, w.start_time, w.end_time INTO autre
      FROM public.work_shifts w
     WHERE w.id IS DISTINCT FROM p_id AND coalesce(w.is_active, false)
       AND public.plage_shift(w.start_time, w.end_time) && public.plage_shift(p_debut, p_fin)
     ORDER BY w.shift_order LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Chevauchement avec le shift actif % (% - %)', autre.display_name,
        to_char(autre.start_time, 'HH24:MI'), to_char(autre.end_time, 'HH24:MI') USING ERRCODE = '22023';
    END IF;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.controler_shift(uuid, text, text, time, time, integer, boolean) FROM PUBLIC, anon, authenticated;

-- Creation (p_id NULL) ou modification. Les shifts sont communs a tous les
-- sites : reserves aux profils globaux ayant le droit settings, ou a
-- l'administrateur global.
CREATE OR REPLACE FUNCTION public.definir_shift(
  p_id uuid, p_nom text, p_libelle text, p_debut time, p_fin time, p_ordre integer,
  p_actif boolean DEFAULT true, p_motif text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_nom text := nullif(btrim(coalesce(p_nom, '')), '');
  v_libelle text := nullif(btrim(coalesce(p_libelle, '')), '');
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_actif boolean := coalesce(p_actif, true);
  s public.work_shifts;
  v_id uuid;
  v_action text;
BEGIN
  IF NOT (public.has_module_write('settings') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les parametres requis' USING ERRCODE = '42501';
  END IF;
  IF NOT public.site_permis(NULL) THEN
    RAISE EXCEPTION 'Les shifts sont communs a tous les sites : reserve aux profils sans site' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.shifts'));
  IF p_id IS NOT NULL THEN
    SELECT * INTO s FROM public.work_shifts WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Shift introuvable' USING ERRCODE = 'P0002'; END IF;
    IF v_motif IS NULL THEN
      RAISE EXCEPTION 'Motif obligatoire pour modifier un shift' USING ERRCODE = '22023';
    END IF;
  END IF;
  PERFORM public.controler_shift(p_id, v_nom, v_libelle, p_debut, p_fin, p_ordre, v_actif);
  IF p_id IS NULL THEN
    INSERT INTO public.work_shifts (name, display_name, start_time, end_time, shift_order, is_active)
    VALUES (v_nom, v_libelle, p_debut, p_fin, p_ordre, v_actif)
    RETURNING * INTO s;
    INSERT INTO public.journal_shifts (shift_id, action, avant, apres, motif, auteur)
    VALUES (s.id, 'creation', NULL, to_jsonb(s) - 'created_at' - 'updated_at', v_motif, auth.uid());
    RETURN s.id;
  END IF;
  v_action := CASE
    WHEN coalesce(s.is_active, false) AND NOT v_actif THEN 'desactivation'
    WHEN NOT coalesce(s.is_active, false) AND v_actif THEN 'reactivation'
    ELSE 'modification' END;
  UPDATE public.work_shifts SET name = v_nom, display_name = v_libelle, start_time = p_debut, end_time = p_fin,
    shift_order = p_ordre, is_active = v_actif, updated_at = now()
  WHERE id = p_id RETURNING id INTO v_id;
  INSERT INTO public.journal_shifts (shift_id, action, avant, apres, motif, auteur)
  SELECT v_id, v_action, to_jsonb(s) - 'created_at' - 'updated_at', to_jsonb(w) - 'created_at' - 'updated_at', v_motif, auth.uid()
    FROM public.work_shifts w WHERE w.id = v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.definir_shift(uuid, text, text, time, time, integer, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_shift(uuid, text, text, time, time, integer, boolean, text) TO authenticated;

-- Desactivation motivee : un shift n'est jamais supprime (il peut porter des
-- voyages, des postes, des objectifs ou des fiches) ; il disparait des
-- listes de saisie et reste lisible dans l'historique.
CREATE OR REPLACE FUNCTION public.desactiver_shift(p_id uuid, p_motif text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  s public.work_shifts;
BEGIN
  IF NOT (public.has_module_write('settings') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les parametres requis' USING ERRCODE = '42501';
  END IF;
  IF NOT public.site_permis(NULL) THEN
    RAISE EXCEPTION 'Les shifts sont communs a tous les sites : reserve aux profils sans site' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour desactiver un shift' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO s FROM public.work_shifts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift introuvable' USING ERRCODE = 'P0002'; END IF;
  IF NOT coalesce(s.is_active, false) THEN
    RAISE EXCEPTION 'Shift deja inactif' USING ERRCODE = '22023';
  END IF;
  UPDATE public.work_shifts SET is_active = false, updated_at = now() WHERE id = p_id;
  INSERT INTO public.journal_shifts (shift_id, action, avant, apres, motif, auteur)
  SELECT p_id, 'desactivation', to_jsonb(s) - 'created_at' - 'updated_at', to_jsonb(w) - 'created_at' - 'updated_at', v_motif, auth.uid()
    FROM public.work_shifts w WHERE w.id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.desactiver_shift(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desactiver_shift(uuid, text) TO authenticated;

-- ===================================================================
-- 4a. Ticket CBG : origine et motif du rattachement (journal immuable)
-- ===================================================================
ALTER TABLE public.tickets_pesee_cbg
  ADD COLUMN IF NOT EXISTS origine text CHECK (origine IN ('fiche', 'reception', 'rattachement')),
  ADD COLUMN IF NOT EXISTS motif_rattachement text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_pesee_cbg_rattachement_motive'
                   AND conrelid = 'public.tickets_pesee_cbg'::regclass) THEN
    ALTER TABLE public.tickets_pesee_cbg ADD CONSTRAINT tickets_pesee_cbg_rattachement_motive
      CHECK (origine IS DISTINCT FROM 'rattachement' OR nullif(btrim(coalesce(motif_rattachement, '')), '') IS NOT NULL);
  END IF;
END $$;

-- 4b. La pesee a l'arrivee est la pesee CBG (D-037) : un evenement
-- WEIGHED_IN n'est ecrit qu'avec son ticket, par saisir_rotation ou
-- rattacher_ticket_cbg (qui creent le ticket dans la meme transaction).
CREATE OR REPLACE FUNCTION public.garde_reception_cbg()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.etat_apres = 'WEIGHED_IN'
     AND (coalesce(current_setting('sigtb.reception_cbg', true), '') <> 'on'
          OR nullif(btrim(coalesce(NEW.donnees ->> 'ticket', '')), '') IS NULL) THEN
    RAISE EXCEPTION 'La pesee a l''arrivee se saisit avec le ticket CBG (fiche de rotations ou fiche du voyage)'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_reception_cbg ON public.trip_events;
CREATE TRIGGER garde_reception_cbg BEFORE INSERT ON public.trip_events
  FOR EACH ROW EXECUTE FUNCTION public.garde_reception_cbg();

-- ===================================================================
-- 2. saisir_rotation : fiche du site de depart ou d'arrivee
--    (rebase sur 20261113100000_d037_ticket_pesee_cbg_rectification)
-- ===================================================================
CREATE OR REPLACE FUNCTION public.saisir_rotation(p_fiche_id uuid, p_trip_id uuid, p_etapes jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f public.fiches_terrain := public.fiche_ouverte(p_fiche_id, 'rotations');
  v public.trips;
  ordre CONSTANT text[] := ARRAY['DRAFT', 'PLANNED', 'ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT',
    'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'DELIVERED', 'ACCEPTED', 'CLOSED'];
  e jsonb; v_etat text; v_rang integer; v_ticket text;
BEGIN
  SELECT * INTO v FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002'; END IF;
  IF v.vehicle_id IS DISTINCT FROM f.vehicle_id OR v.planned_date <> f.date_fiche THEN
    RAISE EXCEPTION 'Le voyage % n''appartient pas a la fiche % (camion ou date)', v.reference, f.numero USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_etapes) <> 'array' THEN RAISE EXCEPTION 'Etapes attendues sous forme de liste' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_etapes) x
    WHERE x ->> 'etat' = 'WEIGHED_OUT'
      AND ((x -> 'donnees') ? 'ticket' OR (x -> 'donnees') ? 'tonnage_cbg')) THEN
    RAISE EXCEPTION 'Le ticket CBG est integre a la pesee de reception au depot, pas au depart' USING ERRCODE = '22023';
  END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(p_etapes) AS t(x)
    ORDER BY array_position(ordre, x ->> 'etat') NULLS LAST
  LOOP
    v_rang := array_position(ordre, e ->> 'etat');
    IF v_rang IS NULL THEN RAISE EXCEPTION 'Etape inconnue : %', e ->> 'etat' USING ERRCODE = '22023'; END IF;
    SELECT etat INTO v_etat FROM public.trips WHERE id = p_trip_id;
    v_ticket := nullif(btrim(coalesce(e -> 'donnees' ->> 'ticket', '')), '');
    IF array_position(ordre, v_etat) >= v_rang THEN
      IF e ->> 'etat' = 'WEIGHED_IN' AND v_ticket IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.tickets_pesee_cbg WHERE trip_id = p_trip_id) THEN
        RAISE EXCEPTION 'Voyage deja receptionne sans ticket CBG : rattacher le ticket depuis la fiche du voyage' USING ERRCODE = '22023';
      END IF;
      CONTINUE;
    END IF;
    IF e ->> 'etat' = 'WEIGHED_OUT' AND (v_ticket IS NOT NULL OR e -> 'donnees' ? 'tonnage_cbg') THEN
      RAISE EXCEPTION 'Le ticket CBG est integre a la pesee de reception au depot, pas au depart' USING ERRCODE = '22023';
    END IF;
    IF e ->> 'etat' = 'WEIGHED_IN' THEN
      IF v_ticket IS NULL THEN
        RAISE EXCEPTION 'La pesee a l''arrivee se saisit avec le ticket CBG' USING ERRCODE = '22023';
      END IF;
      IF coalesce(f.options ->> 'pesee', '') <> 'arrivee' THEN
        RAISE EXCEPTION 'Le ticket CBG doit etre integre a l''arrivee au depot' USING ERRCODE = '22023';
      END IF;
      -- D-078 : la fiche suit le camion ; elle est preparee au site de
      -- depart et peut aussi l'etre au depot d'arrivee.
      IF f.site_id IS DISTINCT FROM v.departure_site_id AND f.site_id IS DISTINCT FROM v.arrival_site_id THEN
        RAISE EXCEPTION 'Le ticket CBG ne se rattache que depuis une fiche du site de depart ou du depot d''arrivee du voyage' USING ERRCODE = '22023';
      END IF;
      PERFORM set_config('sigtb.reception_cbg', 'on', true);
    END IF;
    PERFORM public.avancer_voyage(p_trip_id, e ->> 'etat', (e ->> 'quand')::timestamptz,
      'Fiche ' || f.numero, coalesce(e -> 'donnees', '{}'::jsonb) || jsonb_build_object('fiche', f.numero));
    IF e ->> 'etat' = 'WEIGHED_IN' THEN
      PERFORM set_config('sigtb.reception_cbg', 'off', true);
      INSERT INTO public.tickets_pesee_cbg
        (trip_id, fiche_id, site_id, ticket, brut, tare, mesure_le, document_ref, saisi_par, origine)
      VALUES (p_trip_id, p_fiche_id, v.arrival_site_id, v_ticket,
        (e -> 'donnees' ->> 'brut')::numeric, (e -> 'donnees' ->> 'tare')::numeric,
        (e ->> 'quand')::timestamptz,
        nullif(btrim(coalesce(e -> 'donnees' ->> 'document_ref', '')), ''), auth.uid(), 'fiche');
    END IF;
  END LOOP;
  SELECT etat INTO v_etat FROM public.trips WHERE id = p_trip_id;
  RETURN v_etat;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.saisir_rotation(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisir_rotation(uuid, uuid, jsonb) TO authenticated;

-- ===================================================================
-- 4c. Rattacher le ticket CBG a la reception ou a un voyage livre sans ticket
-- ===================================================================
CREATE OR REPLACE FUNCTION public.rattacher_ticket_cbg(
  p_trip_id uuid, p_ticket text, p_brut numeric, p_tare numeric, p_mesure_le timestamptz,
  p_document_ref text DEFAULT NULL, p_motif text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.trips;
  v_ticket text := nullif(btrim(coalesce(p_ticket, '')), '');
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_origine text;
  v_id uuid;
BEGIN
  IF NOT (public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  -- Perimetre controle avant toute autre lecture ; message unique.
  IF NOT FOUND OR NOT (public.site_permis(v.departure_site_id) OR public.site_permis(v.arrival_site_id)) THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_ticket IS NULL OR p_brut IS NULL OR p_tare IS NULL OR p_tare < 0 OR p_brut <= p_tare THEN
    RAISE EXCEPTION 'Ticket, poids brut et tare coherents requis (en tonnes, brut superieur a la tare)' USING ERRCODE = '22023';
  END IF;
  IF p_mesure_le IS NULL OR p_mesure_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure de pesee absente ou dans le futur' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tickets_pesee_cbg WHERE trip_id = p_trip_id) THEN
    RAISE EXCEPTION 'Ce voyage a deja un ticket CBG : utiliser la rectification motivee' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reconciliations r JOIN public.reconciliation_lignes l ON l.reconciliation_id = r.id
             WHERE l.trip_id = p_trip_id AND r.statut = 'cloturee') THEN
    RAISE EXCEPTION 'Reconciliation cloturee : utiliser le circuit d''avoir' USING ERRCODE = '22023';
  END IF;
  IF v.etat = 'UNLOADING' THEN
    v_origine := 'reception';
  ELSIF v.etat IN ('WEIGHED_IN', 'DELIVERED', 'ACCEPTED', 'DISPUTED', 'CLOSED') THEN
    v_origine := 'rattachement';
    IF v_motif IS NULL THEN
      RAISE EXCEPTION 'Motif obligatoire pour rattacher un ticket a un voyage deja livre' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'Le ticket CBG se saisit en dechargement, ou se rattache a un voyage livre sans ticket' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(upper(v_ticket), 0));
  IF EXISTS (SELECT 1 FROM public.v_tickets_pesee_cbg_effectifs x
             WHERE upper(btrim(x.ticket)) = upper(v_ticket) AND x.trip_id <> p_trip_id)
     OR EXISTS (SELECT 1 FROM public.tickets_pesee_cbg x WHERE upper(btrim(x.ticket)) = upper(v_ticket))
     OR EXISTS (SELECT 1 FROM public.trip_events e2 WHERE e2.donnees ? 'ticket'
                AND upper(btrim(e2.donnees ->> 'ticket')) = upper(v_ticket) AND e2.trip_id <> p_trip_id) THEN
    RAISE EXCEPTION 'Ticket de pesee % deja utilise sur un autre voyage', v_ticket USING ERRCODE = '23505';
  END IF;
  IF v_origine = 'reception' THEN
    PERFORM set_config('sigtb.reception_cbg', 'on', true);
    PERFORM public.avancer_voyage(p_trip_id, 'WEIGHED_IN', p_mesure_le, coalesce(v_motif, 'Ticket CBG ' || v_ticket),
      jsonb_build_object('brut', p_brut, 'tare', p_tare, 'ticket', v_ticket));
    PERFORM set_config('sigtb.reception_cbg', 'off', true);
  END IF;
  INSERT INTO public.tickets_pesee_cbg
    (trip_id, fiche_id, site_id, ticket, brut, tare, mesure_le, document_ref, saisi_par, origine, motif_rattachement)
  VALUES (p_trip_id, NULL, v.arrival_site_id, v_ticket, p_brut, p_tare, p_mesure_le,
    nullif(btrim(coalesce(p_document_ref, '')), ''), auth.uid(), v_origine, v_motif)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rattacher_ticket_cbg(uuid, text, numeric, numeric, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rattacher_ticket_cbg(uuid, text, numeric, numeric, timestamptz, text, text) TO authenticated;

-- ===================================================================
-- 3. Vraisemblance : net superieur a la capacite du camion
--    (rebase sur 20261113100000 : ligne_bloquee, actualiser_reconciliation)
-- ===================================================================
CREATE OR REPLACE FUNCTION public.ligne_bloquee(p_anomalies text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_anomalies && ARRAY['base_absente', 'litige', 'rejet', 'ecart_hors_tolerance',
    'ecart_double_pesee', 'sans_double_pesee', 'sans_ticket_cbg', 'ticket_rectifie',
    'ticket_double', 'non_accepte', 'net_superieur_capacite'];
$$;

CREATE OR REPLACE FUNCTION public.actualiser_reconciliation(p_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.reconciliations; n integer;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.reconciliations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation introuvable' USING ERRCODE = 'P0002'; END IF;
  IF r.statut <> 'ouverte' THEN RAISE EXCEPTION 'Reconciliation cloturee : elle ne change plus' USING ERRCODE = '22023'; END IF;
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.calcul_reconciliation (LIKE public.reconciliation_lignes) ON COMMIT DROP;
  DELETE FROM pg_temp.calcul_reconciliation;
  INSERT INTO pg_temp.calcul_reconciliation (id, reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat,
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies,
    ticket_brut, ticket_tare, ticket_document_ref, ticket_rectifie)
  SELECT gen_random_uuid(), r.id, t.id, t.reference, t.planned_date, t.vehicle_id, t.etat,
    coalesce(t.net_weight, t.load_weight), coalesce(p.net, t.net_weight_reception), t.accepted_tonnage,
    coalesce(t.net_weight, t.load_weight), p.net,
    CASE r.base_tonnage WHEN 'accepte' THEN t.accepted_tonnage WHEN 'recu' THEN coalesce(p.net, t.net_weight_reception)
      ELSE coalesce(t.net_weight, t.load_weight) END,
    coalesce(p.ticket, tk.ticket), fi.fiche,
    array_remove(ARRAY[
      CASE WHEN coalesce(t.net_weight, t.load_weight, p.net, t.net_weight_reception) IS NULL THEN 'sans_pesee' END,
      CASE WHEN (CASE r.base_tonnage WHEN 'accepte' THEN t.accepted_tonnage WHEN 'recu' THEN coalesce(p.net, t.net_weight_reception)
        ELSE coalesce(t.net_weight, t.load_weight) END) IS NULL THEN 'base_absente' END,
      CASE WHEN coalesce(t.net_weight, t.load_weight) > 0 AND coalesce(p.net, t.net_weight_reception) IS NOT NULL
        AND abs(coalesce(p.net, t.net_weight_reception) - coalesce(t.net_weight, t.load_weight)) / coalesce(t.net_weight, t.load_weight) * 100
          > r.tolerance_ecart_pct THEN 'ecart_hors_tolerance' END,
      CASE WHEN p.trip_id IS NULL THEN 'sans_ticket_cbg' END,
      CASE WHEN p.est_rectifie THEN 'ticket_rectifie' END,
      -- D-078 : poids net du ticket au-dessus de la capacite du camion.
      CASE WHEN p.net IS NOT NULL AND veh.capacity_tonnes > 0 AND p.net > veh.capacity_tonnes THEN 'net_superieur_capacite' END,
      CASE WHEN t.etat = 'DISPUTED' THEN 'litige' END,
      CASE WHEN t.etat = 'REJECTED' THEN 'rejet' END,
      CASE WHEN r.base_tonnage = 'accepte' AND t.etat = 'DELIVERED' THEN 'non_accepte' END,
      CASE WHEN coalesce(p.ticket, tk.ticket) IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.trip_events e2 WHERE e2.donnees ? 'ticket'
          AND upper(btrim(e2.donnees ->> 'ticket')) = upper(btrim(coalesce(p.ticket, tk.ticket))) AND e2.trip_id <> t.id) THEN 'ticket_double' END,
      CASE WHEN fi.fiche IS NULL THEN 'sans_fiche' END
    ], NULL), p.brut, p.tare, p.document_ref, coalesce(p.est_rectifie, false)
  FROM public.trips t
  LEFT JOIN public.vehicles veh ON veh.id = t.vehicle_id
  LEFT JOIN public.v_tickets_pesee_cbg_effectifs p ON p.trip_id = t.id
  LEFT JOIN LATERAL (
    SELECT e.donnees ->> 'ticket' AS ticket FROM public.trip_events e
    WHERE e.trip_id = t.id AND e.etat_apres = 'WEIGHED_IN' AND e.donnees ? 'ticket'
    ORDER BY e.survenu_le DESC LIMIT 1) tk ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(e.donnees ->> 'fiche', substring(e.note FROM 'Fiche ([A-Z]{2}-\d{6}-\d+)')) AS fiche
    FROM public.trip_events e WHERE e.trip_id = t.id AND (e.donnees ? 'fiche' OR e.note LIKE 'Fiche %')
    ORDER BY e.survenu_le LIMIT 1) fi ON true
  WHERE t.planned_date BETWEEN r.periode_debut AND r.periode_fin
    AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED')
    AND (r.site_depart_id IS NULL OR t.departure_site_id = r.site_depart_id)
    AND (r.site_arrivee_id IS NULL OR t.arrival_site_id = r.site_arrivee_id);
  DELETE FROM public.reconciliation_lignes l WHERE l.reconciliation_id = r.id
    AND NOT EXISTS (SELECT 1 FROM pg_temp.calcul_reconciliation c WHERE c.trip_id = l.trip_id);
  INSERT INTO public.reconciliation_lignes (reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat,
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies,
    ticket_brut, ticket_tare, ticket_document_ref, ticket_rectifie)
  SELECT reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat, tonnage_charge, tonnage_recu,
    tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies,
    ticket_brut, ticket_tare, ticket_document_ref, ticket_rectifie
  FROM pg_temp.calcul_reconciliation
  ON CONFLICT (reconciliation_id, trip_id) DO UPDATE SET
    reference = EXCLUDED.reference, date_voyage = EXCLUDED.date_voyage, vehicle_id = EXCLUDED.vehicle_id,
    etat = EXCLUDED.etat, tonnage_charge = EXCLUDED.tonnage_charge, tonnage_recu = EXCLUDED.tonnage_recu,
    tonnage_accepte = EXCLUDED.tonnage_accepte, tonnage_kogon = EXCLUDED.tonnage_kogon, tonnage_cbg = EXCLUDED.tonnage_cbg,
    tonnage_base = EXCLUDED.tonnage_base, ticket = EXCLUDED.ticket, fiche = EXCLUDED.fiche, anomalies = EXCLUDED.anomalies,
    ticket_brut = EXCLUDED.ticket_brut, ticket_tare = EXCLUDED.ticket_tare,
    ticket_document_ref = EXCLUDED.ticket_document_ref, ticket_rectifie = EXCLUDED.ticket_rectifie;
  SELECT count(*) INTO n FROM public.reconciliation_lignes WHERE reconciliation_id = r.id;
  UPDATE public.reconciliations SET actualisee_le = now() WHERE id = r.id;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.actualiser_reconciliation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualiser_reconciliation(uuid) TO authenticated;

-- ===================================================================
-- 6. Planification : perimetre de site (rebase sur 20261110150000, seule
--    definition existante de ces deux fonctions)
-- ===================================================================
CREATE OR REPLACE FUNCTION public.definir_objectif(
  p_date date,
  p_site_id uuid,
  p_shift_id uuid,
  p_tonnes numeric,
  p_voyages integer DEFAULT NULL,
  p_camions integer DEFAULT NULL,
  p_chargeuses integer DEFAULT NULL,
  p_motif text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actif public.objectifs_production;
  v_version integer;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_id uuid;
BEGIN
  IF NOT public.has_module_write('planning') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la planification requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_site_id IS NULL THEN
    RAISE EXCEPTION 'Date et site requis' USING ERRCODE = '22023';
  END IF;
  -- D-078 : perimetre avant toute lecture.
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Site hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p_tonnes IS NULL OR p_tonnes <= 0 THEN
    RAISE EXCEPTION 'Objectif en tonnes requis et positif' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('objectif|' || p_date || '|' || p_site_id || '|' || coalesce(p_shift_id::text, '')));

  SELECT * INTO v_actif
  FROM public.objectifs_production o
  WHERE o.date_plan = p_date AND o.site_id = p_site_id
    AND o.shift_id IS NOT DISTINCT FROM p_shift_id AND o.statut = 'actif'
  FOR UPDATE;

  SELECT coalesce(max(o.version), 0) + 1 INTO v_version
  FROM public.objectifs_production o
  WHERE o.date_plan = p_date AND o.site_id = p_site_id
    AND o.shift_id IS NOT DISTINCT FROM p_shift_id;

  IF v_version > 1 AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour reviser un objectif' USING ERRCODE = '22023';
  END IF;

  IF v_actif.id IS NOT NULL THEN
    UPDATE public.objectifs_production
    SET statut = 'remplace', clos_le = now(), clos_par = auth.uid()
    WHERE id = v_actif.id;
  END IF;

  INSERT INTO public.objectifs_production (
    date_plan, site_id, shift_id, version, tonnes_cible, voyages_cible,
    camions_prevus, chargeuses_prevues, motif, note, cree_par)
  VALUES (p_date, p_site_id, p_shift_id, v_version, p_tonnes, p_voyages,
    p_camions, p_chargeuses, v_motif, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_objectif(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_site uuid;
BEGIN
  IF NOT public.has_module_write('planning') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la planification requis' USING ERRCODE = '42501';
  END IF;
  -- D-078 : perimetre avant toute autre lecture ; un objectif hors
  -- perimetre est indiscernable d'un objectif inexistant.
  SELECT o.site_id INTO v_site FROM public.objectifs_production o WHERE o.id = p_id;
  IF NOT FOUND OR NOT public.site_permis(v_site) THEN
    RAISE EXCEPTION 'Objectif actif introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour annuler un objectif' USING ERRCODE = '22023';
  END IF;
  UPDATE public.objectifs_production
  SET statut = 'annule', clos_le = now(), clos_par = auth.uid(), motif_annulation = v_motif
  WHERE id = p_id AND statut = 'actif';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Objectif actif introuvable' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.definir_objectif(date, uuid, uuid, numeric, integer, integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_objectif(date, uuid, uuid, numeric, integer, integer, integer, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.annuler_objectif(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annuler_objectif(uuid, text) TO authenticated;

-- ===================================================================
-- 11. Facture du loueur : en-tete et lignes en une seule transaction
--     (l'ecran inserait l'en-tete puis les lignes : facture orpheline si
--     les lignes etaient refusees). Journal au dossier contractuel.
-- ===================================================================
CREATE OR REPLACE FUNCTION public.saisir_facture_fournisseur(
  p_contrat_id uuid, p_numero text, p_date date, p_debut date, p_fin date,
  p_montant_ht numeric, p_lignes jsonb, p_montant_ttc numeric DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public.contrats;
  v_numero text := nullif(btrim(coalesce(p_numero, '')), '');
  v_id uuid;
  l jsonb;
  v_montant numeric;
BEGIN
  IF NOT (public.has_module_write('contracts') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.contrats WHERE id = p_contrat_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrat introuvable' USING ERRCODE = 'P0002'; END IF;
  IF c.nature = 'client' THEN
    RAISE EXCEPTION 'Une facture de loueur se rattache a un contrat de location ou autre, pas a un contrat client' USING ERRCODE = '22023';
  END IF;
  IF v_numero IS NULL OR p_date IS NULL OR p_debut IS NULL OR p_fin IS NULL OR p_fin < p_debut THEN
    RAISE EXCEPTION 'Numero, date et periode coherente requis' USING ERRCODE = '22023';
  END IF;
  IF p_date > current_date THEN
    RAISE EXCEPTION 'Date de facture dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_montant_ht IS NULL OR p_montant_ht < 0 OR (p_montant_ttc IS NOT NULL AND p_montant_ttc < 0) THEN
    RAISE EXCEPTION 'Montant HT requis et positif' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_lignes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Au moins une ligne de facture requise' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.factures_fournisseur f WHERE f.contrat_id = p_contrat_id
               AND upper(btrim(f.numero_fournisseur)) = upper(v_numero)) THEN
    RAISE EXCEPTION 'Ce numero de facture existe deja pour ce contrat' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.factures_fournisseur (contrat_id, numero_fournisseur, date_facture, periode_debut, periode_fin,
    devise, montant_ht_facture, montant_ttc_facture, saisie_par, note)
  VALUES (p_contrat_id, v_numero, p_date, p_debut, p_fin, c.devise, p_montant_ht, p_montant_ttc, auth.uid(),
    nullif(btrim(coalesce(p_note, '')), ''))
  RETURNING id INTO v_id;
  FOR l IN SELECT x FROM jsonb_array_elements(p_lignes) AS t(x) LOOP
    v_montant := (l ->> 'montant_facture')::numeric;
    IF v_montant IS NULL OR v_montant < 0 THEN
      RAISE EXCEPTION 'Chaque ligne demande un montant positif' USING ERRCODE = '22023';
    END IF;
    IF nullif(btrim(coalesce(l ->> 'libelle', '')), '') IS NULL AND nullif(l ->> 'vehicle_id', '') IS NULL THEN
      RAISE EXCEPTION 'Chaque ligne demande un engin ou un libelle' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.factures_fournisseur_lignes (facture_id, vehicle_id, libelle, categorie_materiel,
      quantite_facturee, unite_facturee, taux_facture, montant_facture)
    VALUES (v_id, nullif(l ->> 'vehicle_id', '')::uuid,
      coalesce(nullif(btrim(coalesce(l ->> 'libelle', '')), ''), 'Ligne'),
      nullif(btrim(coalesce(l ->> 'categorie_materiel', '')), ''),
      (l ->> 'quantite_facturee')::numeric, nullif(l ->> 'unite_facturee', ''),
      (l ->> 'taux_facture')::numeric, v_montant);
  END LOOP;
  INSERT INTO public.journal_contrats (table_cible, ligne_id, contrat_id, action, avant, apres, auteur)
  SELECT 'factures_fournisseur', v_id, p_contrat_id, 'INSERT', NULL,
    to_jsonb(f) || jsonb_build_object('lignes', (SELECT jsonb_agg(to_jsonb(x)) FROM public.factures_fournisseur_lignes x WHERE x.facture_id = v_id)),
    auth.uid()
  FROM public.factures_fournisseur f WHERE f.id = v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.saisir_facture_fournisseur(uuid, text, date, date, date, numeric, jsonb, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisir_facture_fournisseur(uuid, text, date, date, date, numeric, jsonb, numeric, text) TO authenticated;

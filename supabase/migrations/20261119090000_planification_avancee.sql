/*
  # Planification avancee et comparaison des shifts (D-063, lot 04 du plan
  # maitre ; modules 04 et 05 du mandat)

  Etend la planification v1 (D-023, migration 20261110150000) sans la
  dupliquer : `objectifs_production`, `definir_objectif`,
  `annuler_objectif`, `v_realisation_objectifs` et `statistiques_rotation`
  restent la reference.

  1. Ventilation d'un objectif par destination (site d'arrivee) et par
     contrat client (D-026) : `objectifs_ventilation`, rattachee a une
     version d'objectif, ecrite une fois par `ventiler_objectif`. Un
     objectif sans ventilation vaut pour toutes les destinations et tous
     les contrats (objectifs existants inchanges). La ventilation est une
     table a part : les agregats existants (pilotage D-057, reporting D-058,
     bilan de poste D-048, tableau de bord, dispatch) qui somment les
     objectifs ne comptent rien en double. Realise par destination tire des
     voyages ; un voyage ne porte pas de contrat : le realise par contrat
     seul n'est pas mesurable et l'est annonce.
  2. Durees de cycle observees (`durees_cycle_observees`) : mediane de
     l'intervalle entre deux departs successifs d'un meme camion (meme jour,
     meme shift), mediane de la duree de chargement (journal des voyages,
     chargement -> charge), mediane du trajet aller.
  3. `simuler_objectif(objectif, instant)` : hypotheses (avec leur source),
     situation a l'instant, besoin en camions et engins de chargement sur le
     temps restant, scenario de rattrapage (tonnage atteignable avec les
     moyens disponibles, objectif revise propose). Rien n'est ecrit : un
     scenario retenu devient un nouvel objectif par `definir_objectif`
     (revision, motif obligatoire). Sans donnee suffisante : NULL et
     « Donnees insuffisantes », jamais d'estimation.
  4. Cloture de planification d'une journee et d'un site :
     `clotures_planification` (bilan fige planifie contre realise) et
     `clotures_planification_causes` (causes d'ecart saisies), par
     `cloturer_planification` (droit planning, perimetre, journee terminee,
     cause requise si le realise est sous l'objectif ; autre personne que
     l'auteur des objectifs si le reglage `planification_cloture_separee`
     vaut true) ; annulation motivee. Une journee close fige ses objectifs.
     `rapport_production(debut, fin, site)` reprend les bilans figes et
     calcule les journees non closes a la lecture.
  5. `comparer_shifts(debut, fin, site)` : par shift, voyages, tonnes,
     durees de rotation et de trajet, objectifs, postes, incidents, arrets,
     retards, absences (postes D-048).

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- 0. Fonctions utilitaires ---------------------------------------------------

-- Fenetre d'exploitation d'une date : un shift (fin le lendemain pour un
-- shift de nuit) ou la journee (du premier debut a la derniere fin des
-- shifts actifs ; 00:00 - 24:00 sans shift). Heure de Conakry.
CREATE OR REPLACE FUNCTION public.fenetre_planification(p_date date, p_shift_id uuid)
RETURNS TABLE (debut timestamptz, fin timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH f AS (
    SELECT ((p_date + s.start_time) AT TIME ZONE 'Africa/Conakry') AS d,
           ((p_date + s.end_time + CASE WHEN s.end_time <= s.start_time THEN interval '1 day' ELSE interval '0' END)
              AT TIME ZONE 'Africa/Conakry') AS f
      FROM public.work_shifts s
     WHERE (p_shift_id IS NOT NULL AND s.id = p_shift_id)
        OR (p_shift_id IS NULL AND s.is_active)
  )
  SELECT coalesce(min(f.d), p_date::timestamp AT TIME ZONE 'Africa/Conakry'),
         coalesce(max(f.f), (p_date + 1)::timestamp AT TIME ZONE 'Africa/Conakry')
    FROM f;
$$;

-- Unite de debit reconnue d'une capacite d'infrastructure (D-047, unite
-- libre) : tonnes par heure ou voyages (camions) par heure ; sinon NULL
-- (capacite non exploitable pour le calcul, jamais convertie).
CREATE OR REPLACE FUNCTION public.unite_debit(p_unite text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
           WHEN u ~ '^(t|tonnes?)/(h|heures?)$' THEN 'tonnes_heure'
           WHEN u ~ '^(camions?|voyages?|rotations?)/(h|heures?)$' THEN 'voyages_heure'
         END
    FROM (SELECT regexp_replace(regexp_replace(lower(coalesce(p_unite, '')), '\s+par\s+', '/', 'g'), '\s', '', 'g') AS u) x;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY['fenetre_planification(date, uuid)', 'unite_debit(text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', sig);
  END LOOP;
END $$;

-- 1. Ventilation par destination et par contrat -----------------------------

CREATE TABLE IF NOT EXISTS public.objectifs_ventilation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objectif_id uuid NOT NULL REFERENCES public.objectifs_production(id) ON DELETE RESTRICT,
  destination_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  contrat_id uuid REFERENCES public.contrats(id) ON DELETE RESTRICT,
  tonnes_cible numeric(12,2) NOT NULL CHECK (tonnes_cible > 0),
  voyages_cible integer CHECK (voyages_cible IS NULL OR voyages_cible > 0),
  note text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT objectifs_ventilation_dimension CHECK (destination_id IS NOT NULL OR contrat_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_objectifs_ventilation ON public.objectifs_ventilation (
  objectif_id,
  coalesce(destination_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(contrat_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.objectifs_ventilation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.objectifs_ventilation FROM anon, authenticated;
GRANT SELECT ON public.objectifs_ventilation TO authenticated;
GRANT ALL ON public.objectifs_ventilation TO service_role;
DROP POLICY IF EXISTS lecture ON public.objectifs_ventilation;
CREATE POLICY lecture ON public.objectifs_ventilation FOR SELECT TO authenticated
  USING ((public.has_module_view('planning') OR public.is_admin())
         AND EXISTS (SELECT 1 FROM public.objectifs_production o
                      WHERE o.id = objectif_id AND public.site_permis(o.site_id)));

-- Ventilation immuable : elle se revise avec l'objectif (nouvelle version).
CREATE OR REPLACE FUNCTION public.garde_immuable_planification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION '% : enregistrement non modifiable (nouvelle version ou annulation motivee)', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS garde_immuable ON public.objectifs_ventilation;
CREATE TRIGGER garde_immuable BEFORE UPDATE OR DELETE ON public.objectifs_ventilation
  FOR EACH ROW EXECUTE FUNCTION public.garde_immuable_planification();

-- Lignes : [{"destination_id": uuid, "contrat_id": uuid, "tonnes": n,
-- "voyages": n, "note": text}] ; somme au plus egale a l'objectif.
CREATE OR REPLACE FUNCTION public.ventiler_objectif(p_objectif_id uuid, p_lignes jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  o public.objectifs_production;
  l jsonb;
  v_dest uuid; v_contrat uuid; v_tonnes numeric; v_voyages integer;
  c public.contrats;
  v_total numeric := 0;
  v_n integer := 0;
BEGIN
  IF NOT public.has_module_write('planning') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la planification requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO o FROM public.objectifs_production WHERE id = p_objectif_id FOR UPDATE;
  IF NOT FOUND OR o.statut <> 'actif' THEN
    RAISE EXCEPTION 'Objectif actif introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.site_permis(o.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : objectif d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clotures_planification c
              WHERE c.date_plan = o.date_plan AND c.site_id = o.site_id AND c.statut = 'close') THEN
    RAISE EXCEPTION 'Planification close pour ce site et cette date' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.objectifs_ventilation WHERE objectif_id = o.id) THEN
    RAISE EXCEPTION 'Objectif deja ventile : reviser l''objectif (nouvelle version) pour changer la ventilation'
      USING ERRCODE = '22023';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Au moins une ligne de ventilation requise' USING ERRCODE = '22023';
  END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_dest := nullif(l ->> 'destination_id', '')::uuid;
    v_contrat := nullif(l ->> 'contrat_id', '')::uuid;
    v_tonnes := nullif(l ->> 'tonnes', '')::numeric;
    v_voyages := nullif(l ->> 'voyages', '')::integer;
    IF v_dest IS NULL AND v_contrat IS NULL THEN
      RAISE EXCEPTION 'Ligne de ventilation : destination ou contrat requis' USING ERRCODE = '22023';
    END IF;
    IF v_tonnes IS NULL OR v_tonnes <= 0 THEN
      RAISE EXCEPTION 'Ligne de ventilation : tonnes positives requises' USING ERRCODE = '22023';
    END IF;
    IF v_dest IS NOT NULL THEN
      IF v_dest = o.site_id THEN
        RAISE EXCEPTION 'La destination differe du site de chargement' USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = v_dest AND coalesce(s.is_active, true)) THEN
        RAISE EXCEPTION 'Destination inconnue ou inactive' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF v_contrat IS NOT NULL THEN
      SELECT * INTO c FROM public.contrats WHERE id = v_contrat;
      IF NOT FOUND OR c.nature <> 'client' OR c.statut <> 'actif'
         OR c.date_debut > o.date_plan OR (c.date_fin IS NOT NULL AND c.date_fin < o.date_plan) THEN
        RAISE EXCEPTION 'Contrat client actif a la date de l''objectif requis' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM public.objectifs_ventilation v WHERE v.objectif_id = o.id
                 AND v.destination_id IS NOT DISTINCT FROM v_dest AND v.contrat_id IS NOT DISTINCT FROM v_contrat) THEN
      RAISE EXCEPTION 'Ligne de ventilation en double (meme destination et meme contrat)' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.objectifs_ventilation (objectif_id, destination_id, contrat_id, tonnes_cible, voyages_cible, note, cree_par)
    VALUES (o.id, v_dest, v_contrat, v_tonnes, v_voyages, nullif(btrim(coalesce(l ->> 'note', '')), ''), auth.uid());
    v_total := v_total + v_tonnes;
    v_n := v_n + 1;
  END LOOP;

  IF v_total > o.tonnes_cible THEN
    RAISE EXCEPTION 'Ventilation (% t) superieure a l''objectif (% t)', v_total, o.tonnes_cible USING ERRCODE = '22023';
  END IF;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ventiler_objectif(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ventiler_objectif(uuid, jsonb) TO authenticated;

-- Realisation de la ventilation des objectifs actifs (droits de l'appelant).
-- Par destination : voyages livres du site, de la date, du shift de
-- l'objectif et de cette destination. Contrat seul : non mesurable.
CREATE OR REPLACE VIEW public.v_realisation_ventilation
WITH (security_invoker = true) AS
SELECT
  v.id, v.objectif_id, o.date_plan, o.site_id, o.shift_id, o.version,
  v.destination_id, v.contrat_id, c.reference AS contrat_reference,
  v.tonnes_cible, v.voyages_cible, v.note, v.cree_le,
  (v.destination_id IS NOT NULL) AS mesurable,
  (SELECT count(*) FROM public.objectifs_ventilation w
    WHERE w.objectif_id = v.objectif_id AND w.destination_id IS NOT DISTINCT FROM v.destination_id) > 1 AS realise_partage,
  CASE WHEN v.destination_id IS NOT NULL THEN round(coalesce(r.tonnes_livrees, 0), 2) END AS tonnes_livrees,
  CASE WHEN v.destination_id IS NOT NULL THEN coalesce(r.voyages_livres, 0) END AS voyages_livres,
  CASE WHEN v.destination_id IS NOT NULL THEN coalesce(r.voyages_sans_poids, 0) END AS voyages_sans_poids
FROM public.objectifs_ventilation v
JOIN public.objectifs_production o ON o.id = v.objectif_id
LEFT JOIN public.contrats c ON c.id = v.contrat_id
LEFT JOIN LATERAL (
  SELECT
    sum(coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight)) AS tonnes_livrees,
    count(*) AS voyages_livres,
    count(*) FILTER (WHERE coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) IS NULL) AS voyages_sans_poids
  FROM public.trips t
  WHERE v.destination_id IS NOT NULL
    AND t.planned_date = o.date_plan
    AND t.departure_site_id = o.site_id
    AND t.arrival_site_id = v.destination_id
    AND (o.shift_id IS NULL OR t.shift_id = o.shift_id)
    AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
) r ON true
WHERE o.statut = 'actif';

REVOKE ALL ON public.v_realisation_ventilation FROM anon;
GRANT SELECT ON public.v_realisation_ventilation TO authenticated;

-- 2. Durees de cycle observees ----------------------------------------------

-- Sur les p_jours jours precedant p_jusqua (exclu), voyages livres partis du
-- site (et du shift) : intervalle entre deux departs successifs d'un meme
-- camion le meme jour et le meme shift (rotation complete : retour, attente,
-- chargement compris), duree de chargement (evenements chargement ->
-- charge), trajet aller (depart -> arrivee). Medianes, en minutes.
CREATE OR REPLACE FUNCTION public.durees_cycle_observees(
  p_site_id uuid,
  p_shift_id uuid,
  p_jusqua date,
  p_jours integer DEFAULT 14
)
RETURNS TABLE (
  rotations_mesurees integer,
  duree_rotation_min numeric,
  chargements_mesures integer,
  duree_chargement_min numeric,
  trajets_mesures integer,
  duree_trajet_min numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH base AS (
    SELECT t.id, t.vehicle_id, t.planned_date, t.shift_id, t.actual_departure_time, t.actual_arrival_time
      FROM public.trips t
     WHERE t.departure_site_id = p_site_id
       AND (p_shift_id IS NULL OR t.shift_id = p_shift_id)
       AND t.planned_date >= p_jusqua - greatest(1, least(coalesce(p_jours, 14), 90))
       AND t.planned_date < p_jusqua
       AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
  ),
  rotations AS (
    SELECT extract(epoch FROM lead(b.actual_departure_time) OVER (
             PARTITION BY b.vehicle_id, b.planned_date, b.shift_id ORDER BY b.actual_departure_time)
             - b.actual_departure_time)::double precision / 60 AS minutes
      FROM base b
     WHERE b.vehicle_id IS NOT NULL AND b.actual_departure_time IS NOT NULL
  ),
  chargements AS (
    SELECT extract(epoch FROM min(e.survenu_le) FILTER (WHERE e.etat_apres = 'LOADED')
                            - min(e.survenu_le) FILTER (WHERE e.etat_apres = 'LOADING'))::double precision / 60 AS minutes
      FROM base b
      JOIN public.trip_events e ON e.trip_id = b.id AND e.etat_apres IN ('LOADING', 'LOADED')
     GROUP BY b.id
  ),
  trajets AS (
    SELECT extract(epoch FROM b.actual_arrival_time - b.actual_departure_time)::double precision / 60 AS minutes
      FROM base b
     WHERE b.actual_arrival_time > b.actual_departure_time
  )
  SELECT
    (SELECT count(*) FROM rotations r WHERE r.minutes > 0)::integer,
    (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY r.minutes))::numeric, 1) FROM rotations r WHERE r.minutes > 0),
    (SELECT count(*) FROM chargements c WHERE c.minutes > 0)::integer,
    (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY c.minutes))::numeric, 1) FROM chargements c WHERE c.minutes > 0),
    (SELECT count(*) FROM trajets j)::integer,
    (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY j.minutes))::numeric, 1) FROM trajets j);
$$;
REVOKE EXECUTE ON FUNCTION public.durees_cycle_observees(uuid, uuid, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.durees_cycle_observees(uuid, uuid, date, integer) TO authenticated;

-- 3. Simulation de capacite et scenario de rattrapage -----------------------

-- Seuils d'echantillon : ceux de l'estimation des camions de D-023
-- (3 jours et 10 voyages), 10 mesures pour une duree observee.
CREATE OR REPLACE FUNCTION public.simuler_objectif(p_objectif_id uuid, p_instant timestamptz DEFAULT NULL)
RETURNS TABLE (
  rang integer,
  groupe text,
  code text,
  libelle text,
  valeur numeric,
  unite text,
  source text,
  remarque text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  o public.objectifs_production;
  v_debut timestamptz; v_fin timestamptz; v_instant timestamptz;
  st record; du record;
  v_charge numeric; v_src_charge text;
  v_capacite numeric; v_nb_capacite integer;
  v_camions integer; v_engins integer;
  v_cap_t numeric; v_cap_v numeric; v_infra_ok text; v_infra_autres text; v_nb_points integer;
  v_ferme text;
  v_livre numeric; v_voyages integer; v_sans_poids integer; v_en_cours integer;
  v_heures numeric; v_reste numeric; v_voy_restants integer;
  v_rot numeric; v_charg numeric;
  v_rotations numeric; v_camions_nec integer; v_engins_nec integer; v_rythme numeric;
  v_par_camions numeric; v_par_engins numeric; v_par_infra numeric; v_atteignable numeric; v_limite text;
  c_min_jours constant integer := 3;
  c_min_voyages constant integer := 10;
  c_min_mesures constant integer := 10;
  c_insuffisant constant text := 'Données insuffisantes';
  c_fmt constant text := 'DD/MM HH24:MI';
BEGIN
  SELECT * INTO o FROM public.objectifs_production op WHERE op.id = p_objectif_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Objectif introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT f.debut, f.fin INTO v_debut, v_fin FROM public.fenetre_planification(o.date_plan, o.shift_id) f;
  v_instant := least(greatest(coalesce(p_instant, now()), v_debut), v_fin);
  SELECT * INTO st FROM public.statistiques_rotation(o.site_id, o.shift_id, o.date_plan, 14);
  SELECT * INTO du FROM public.durees_cycle_observees(o.site_id, o.shift_id, o.date_plan, 14);

  -- Hypotheses
  SELECT round(avg(v.capacity_tonnes), 2), count(*) INTO v_capacite, v_nb_capacite
    FROM public.vehicles v
   WHERE v.site_id = o.site_id AND v.status = 'active' AND v.vehicle_type IN ('tipper', 'flatbed') AND v.capacity_tonnes > 0;
  IF st.jours_observes >= c_min_jours AND st.voyages >= c_min_voyages AND st.charge_moyenne > 0 THEN
    v_charge := st.charge_moyenne;
    v_src_charge := format('observée : %s voyages livrés avec tonnage sur %s jours (14 jours précédents)', st.voyages, st.jours_observes);
  ELSIF v_capacite IS NOT NULL THEN
    v_charge := v_capacite;
    v_src_charge := format('capacité déclarée de %s camion(s) actif(s) du site (historique insuffisant : %s voyages sur %s jours)',
                           v_nb_capacite, coalesce(st.voyages, 0), coalesce(st.jours_observes, 0));
  END IF;
  v_rot := CASE WHEN du.rotations_mesurees >= c_min_mesures THEN du.duree_rotation_min END;
  v_charg := CASE WHEN du.chargements_mesures >= c_min_mesures THEN du.duree_chargement_min END;

  SELECT count(*) FILTER (WHERE v.vehicle_type IN ('tipper', 'flatbed')),
         count(*) FILTER (WHERE v.vehicle_type IN ('loader', 'excavator'))
    INTO v_camions, v_engins
    FROM public.vehicles v WHERE v.site_id = o.site_id AND v.status = 'active';

  SELECT sum(i.capacite) FILTER (WHERE public.unite_debit(i.unite_capacite) = 'tonnes_heure'),
         sum(i.capacite) FILTER (WHERE public.unite_debit(i.unite_capacite) = 'voyages_heure'),
         string_agg(i.code, ', ') FILTER (WHERE public.unite_debit(i.unite_capacite) IS NOT NULL),
         string_agg(i.code || ' (' || i.capacite || ' ' || i.unite_capacite || ')', ', ')
           FILTER (WHERE i.capacite IS NOT NULL AND public.unite_debit(i.unite_capacite) IS NULL),
         count(*)
    INTO v_cap_t, v_cap_v, v_infra_ok, v_infra_autres, v_nb_points
    FROM public.infrastructures_site i
   WHERE i.site_id = o.site_id AND i.type = 'point_chargement' AND i.actif
     AND NOT EXISTS (SELECT 1 FROM public.fermetures_site f
                      WHERE f.infrastructure_id = i.id AND f.debut <= v_instant
                        AND coalesce(least(f.fin, f.levee_le), 'infinity'::timestamptz) > v_instant);
  v_ferme := public.site_ferme_le(o.site_id, o.date_plan);

  -- Situation a l'instant
  SELECT coalesce(sum(coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight)), 0),
         count(*),
         count(*) FILTER (WHERE coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) IS NULL)
    INTO v_livre, v_voyages, v_sans_poids
    FROM public.trips t
   WHERE t.planned_date = o.date_plan AND t.departure_site_id = o.site_id
     AND (o.shift_id IS NULL OR t.shift_id = o.shift_id)
     AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
     AND (coalesce(t.actual_arrival_time, t.etat_modifie_le) <= v_instant
          OR (t.actual_arrival_time IS NULL AND t.etat_modifie_le IS NULL AND v_instant >= now()));
  SELECT count(*) INTO v_en_cours
    FROM public.trips t
   WHERE t.planned_date = o.date_plan AND t.departure_site_id = o.site_id
     AND (o.shift_id IS NULL OR t.shift_id = o.shift_id)
     AND t.etat IN ('AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN');

  v_heures := round((extract(epoch FROM v_fin - v_instant) / 3600)::numeric, 2);
  v_reste := greatest(o.tonnes_cible - v_livre, 0);
  v_voy_restants := CASE WHEN v_charge > 0 THEN ceil(v_reste / v_charge)::integer END;
  v_rythme := CASE WHEN v_heures > 0 THEN round(v_reste / v_heures, 1) END;
  v_rotations := CASE WHEN v_rot > 0 AND v_heures > 0 THEN round(v_heures * 60 / v_rot, 2) END;
  v_camions_nec := CASE WHEN v_voy_restants IS NOT NULL AND v_rotations > 0 THEN ceil(v_voy_restants / v_rotations)::integer END;
  v_engins_nec := CASE WHEN v_voy_restants IS NOT NULL AND v_charg > 0 AND v_heures > 0
                       THEN ceil(v_voy_restants * v_charg / (v_heures * 60))::integer END;

  -- Tonnage atteignable sur le temps restant avec les moyens disponibles :
  -- la contrainte la plus basse parmi celles qui sont connues.
  v_par_camions := CASE WHEN v_rotations IS NOT NULL AND v_charge IS NOT NULL THEN v_camions * v_rotations * v_charge END;
  v_par_engins := CASE WHEN v_charg > 0 AND v_charge IS NOT NULL AND v_heures > 0 THEN v_engins * (v_heures * 60 / v_charg) * v_charge END;
  v_par_infra := least(CASE WHEN v_cap_t IS NOT NULL THEN v_cap_t * v_heures END,
                       CASE WHEN v_cap_v IS NOT NULL AND v_charge IS NOT NULL THEN v_cap_v * v_heures * v_charge END);
  IF v_par_camions IS NOT NULL THEN
    v_atteignable := v_par_camions; v_limite := 'camions disponibles';
    IF v_par_engins IS NOT NULL AND v_par_engins < v_atteignable THEN
      v_atteignable := v_par_engins; v_limite := 'engins de chargement disponibles';
    END IF;
    IF v_par_infra IS NOT NULL AND v_par_infra < v_atteignable THEN
      v_atteignable := v_par_infra; v_limite := 'capacité des points de chargement';
    END IF;
    IF v_ferme IS NOT NULL THEN
      v_atteignable := 0; v_limite := 'site fermé : ' || v_ferme;
    END IF;
    v_atteignable := round(v_livre + v_atteignable, 0);
  END IF;

  -- Restitution
  rang := 1; groupe := 'Hypothèses'; code := 'periode'; libelle := 'Période'; unite := 'h';
  valeur := round((extract(epoch FROM v_fin - v_debut) / 3600)::numeric, 2);
  source := CASE WHEN o.shift_id IS NULL THEN 'work_shifts actifs (journée)' ELSE 'work_shifts (horaire du shift)' END;
  remarque := to_char(v_debut AT TIME ZONE 'Africa/Conakry', c_fmt) || ' – ' || to_char(v_fin AT TIME ZONE 'Africa/Conakry', c_fmt);
  RETURN NEXT;

  rang := 2; code := 'charge_par_voyage'; libelle := 'Charge par voyage'; unite := 't'; valeur := v_charge;
  source := coalesce(v_src_charge, 'ni historique ni camion actif sur le site');
  remarque := CASE WHEN v_charge IS NULL THEN c_insuffisant END;
  RETURN NEXT;

  rang := 3; code := 'capacite_declaree'; libelle := 'Capacité déclarée moyenne des camions'; unite := 't'; valeur := v_capacite;
  source := format('vehicles.capacity_tonnes, %s camion(s) actif(s) du site', coalesce(v_nb_capacite, 0));
  remarque := CASE WHEN v_capacite IS NULL THEN 'Aucun camion actif sur le site' END;
  RETURN NEXT;

  rang := 4; code := 'duree_rotation'; libelle := 'Durée de rotation (médiane)'; unite := 'min'; valeur := v_rot;
  source := format('intervalle entre deux départs successifs d''un même camion, %s mesure(s) sur 14 jours', coalesce(du.rotations_mesurees, 0));
  remarque := CASE WHEN v_rot IS NULL THEN format('%s : il faut %s mesures', c_insuffisant, c_min_mesures) END;
  RETURN NEXT;

  rang := 5; code := 'duree_chargement'; libelle := 'Durée de chargement (médiane)'; unite := 'min'; valeur := v_charg;
  source := format('journal des voyages (chargement -> chargé), %s mesure(s) sur 14 jours', coalesce(du.chargements_mesures, 0));
  remarque := CASE WHEN v_charg IS NULL THEN format('%s : il faut %s mesures', c_insuffisant, c_min_mesures) END;
  RETURN NEXT;

  rang := 6; code := 'camions_disponibles'; libelle := 'Camions disponibles'; unite := 'camions'; valeur := v_camions;
  source := 'vehicles actifs du site (benne, plateau)'; remarque := NULL;
  RETURN NEXT;

  rang := 7; code := 'engins_disponibles'; libelle := 'Engins de chargement disponibles'; unite := 'engins'; valeur := v_engins;
  source := 'vehicles actifs du site (chargeuse, pelle)'; remarque := NULL;
  RETURN NEXT;

  rang := 8; code := 'capacite_chargement'; libelle := 'Capacité saisie des points de chargement';
  valeur := coalesce(v_cap_t, v_cap_v); unite := CASE WHEN v_cap_t IS NOT NULL THEN 't/h' WHEN v_cap_v IS NOT NULL THEN 'voyages/h' END;
  source := format('infrastructures_site (D-047), %s point(s) de chargement actif(s) et ouvert(s)%s', coalesce(v_nb_points, 0),
                   CASE WHEN v_infra_ok IS NOT NULL THEN ' : ' || v_infra_ok ELSE '' END);
  remarque := concat_ws(' ; ',
    CASE WHEN v_cap_t IS NOT NULL AND v_cap_v IS NOT NULL THEN format('aussi %s voyages/h', v_cap_v) END,
    CASE WHEN v_infra_autres IS NOT NULL THEN 'unité non exploitable pour le calcul : ' || v_infra_autres END,
    CASE WHEN v_cap_t IS NULL AND v_cap_v IS NULL THEN 'Aucune capacité en t/h ou en camions/h saisie' END);
  RETURN NEXT;

  IF v_ferme IS NOT NULL THEN
    rang := 9; code := 'site_ferme'; libelle := 'Site fermé'; valeur := NULL; unite := NULL;
    source := 'fermetures_site (D-047)'; remarque := v_ferme;
    RETURN NEXT;
  END IF;

  rang := 10; groupe := 'Situation'; code := 'instant'; libelle := 'Instant de la simulation'; unite := 'h';
  valeur := round((extract(epoch FROM v_instant - v_debut) / 3600)::numeric, 2);
  source := 'heures écoulées depuis le début de la période';
  remarque := to_char(v_instant AT TIME ZONE 'Africa/Conakry', c_fmt);
  RETURN NEXT;

  rang := 11; code := 'tonnes_cible'; libelle := 'Objectif'; unite := 't'; valeur := o.tonnes_cible;
  source := format('objectifs_production, version %s', o.version); remarque := NULL;
  RETURN NEXT;

  rang := 12; code := 'tonnes_livrees'; libelle := 'Livré à l''instant'; unite := 't'; valeur := round(v_livre, 2);
  source := format('%s voyage(s) livré(s) arrivé(s) avant l''instant ; tonnage accepté, sinon reçu, sinon chargé', v_voyages);
  remarque := CASE WHEN v_sans_poids > 0 THEN v_sans_poids || ' voyage(s) livré(s) sans poids, non comptés' END;
  RETURN NEXT;

  rang := 13; code := 'tonnes_restantes'; libelle := 'Tonnes restantes'; unite := 't'; valeur := round(v_reste, 2);
  source := 'objectif - livré'; remarque := NULL;
  RETURN NEXT;

  rang := 14; code := 'heures_restantes'; libelle := 'Temps restant'; unite := 'h'; valeur := v_heures;
  source := 'fin de la période - instant';
  remarque := CASE WHEN v_heures = 0 THEN 'Période terminée' END;
  RETURN NEXT;

  rang := 15; code := 'voyages_restants'; libelle := 'Voyages restants'; unite := 'voyages'; valeur := v_voy_restants;
  source := 'tonnes restantes / charge par voyage';
  remarque := CASE WHEN v_voy_restants IS NULL THEN c_insuffisant
                   WHEN v_en_cours > 0 THEN v_en_cours || ' voyage(s) en cours, non encore livrés' END;
  RETURN NEXT;

  rang := 16; code := 'rythme_requis'; libelle := 'Rythme requis'; unite := 't/h'; valeur := v_rythme;
  source := 'tonnes restantes / temps restant';
  remarque := CASE
    WHEN v_heures = 0 THEN 'Période terminée'
    WHEN v_cap_t IS NOT NULL AND v_rythme > v_cap_t THEN format('Au-dessus de la capacité saisie des points de chargement (%s t/h)', v_cap_t)
    WHEN v_cap_v IS NOT NULL AND v_voy_restants IS NOT NULL AND v_voy_restants / v_heures > v_cap_v
      THEN format('Au-dessus de la capacité saisie des points de chargement (%s voyages/h)', v_cap_v)
  END;
  RETURN NEXT;

  rang := 20; groupe := 'Besoin'; code := 'rotations_par_camion'; libelle := 'Rotations possibles par camion'; unite := 'rotations';
  valeur := v_rotations; source := 'temps restant / durée de rotation';
  remarque := CASE WHEN v_rotations IS NULL THEN c_insuffisant END;
  RETURN NEXT;

  rang := 21; code := 'camions_necessaires'; libelle := 'Camions nécessaires'; unite := 'camions'; valeur := v_camions_nec;
  source := 'voyages restants / rotations possibles par camion';
  remarque := CASE WHEN v_camions_nec IS NULL THEN c_insuffisant END;
  RETURN NEXT;

  rang := 22; code := 'ecart_camions'; libelle := 'Écart camions (nécessaires - disponibles)'; unite := 'camions';
  valeur := v_camions_nec - v_camions; source := 'camions nécessaires - camions disponibles';
  remarque := CASE WHEN v_camions_nec IS NULL THEN c_insuffisant END;
  RETURN NEXT;

  rang := 23; code := 'engins_necessaires'; libelle := 'Engins de chargement nécessaires'; unite := 'engins'; valeur := v_engins_nec;
  source := 'voyages restants x durée de chargement / temps restant (minimum, sans attente)';
  remarque := CASE WHEN v_engins_nec IS NULL THEN c_insuffisant END;
  RETURN NEXT;

  rang := 24; code := 'ecart_engins'; libelle := 'Écart engins (nécessaires - disponibles)'; unite := 'engins';
  valeur := v_engins_nec - v_engins; source := 'engins nécessaires - engins disponibles';
  remarque := CASE WHEN v_engins_nec IS NULL THEN c_insuffisant END;
  RETURN NEXT;

  rang := 30; groupe := 'Scénario'; code := 'tonnes_atteignables'; libelle := 'Tonnage atteignable en fin de période'; unite := 't';
  valeur := v_atteignable;
  source := 'livré + moyens disponibles sur le temps restant, au rythme observé';
  remarque := CASE WHEN v_atteignable IS NULL THEN c_insuffisant ELSE 'limité par : ' || v_limite END;
  RETURN NEXT;

  rang := 31; code := 'objectif_propose'; libelle := 'Objectif révisé proposé'; unite := 't';
  valeur := CASE WHEN v_atteignable IS NOT NULL AND v_atteignable < o.tonnes_cible AND v_atteignable > 0 THEN v_atteignable END;
  source := 'tonnage atteignable, si inférieur à l''objectif';
  remarque := CASE WHEN v_atteignable IS NULL THEN c_insuffisant
                   WHEN v_atteignable >= o.tonnes_cible THEN 'Objectif tenable avec les moyens disponibles'
                   WHEN v_atteignable = 0 THEN 'Aucune production possible sur le temps restant' END;
  RETURN NEXT;

  rang := 32; code := 'renfort_camions'; libelle := 'Renfort de camions pour tenir l''objectif'; unite := 'camions';
  valeur := greatest(v_camions_nec - v_camions, 0); source := 'écart camions, s''il est positif';
  remarque := CASE WHEN v_camions_nec IS NULL THEN c_insuffisant END;
  RETURN NEXT;

  rang := 33; code := 'renfort_engins'; libelle := 'Renfort d''engins de chargement pour tenir l''objectif'; unite := 'engins';
  valeur := greatest(v_engins_nec - v_engins, 0); source := 'écart engins, s''il est positif';
  remarque := CASE WHEN v_engins_nec IS NULL THEN c_insuffisant END;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.simuler_objectif(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simuler_objectif(uuid, timestamptz) TO authenticated;

-- 4. Cloture de planification et rapport de production ----------------------

CREATE TABLE IF NOT EXISTS public.clotures_planification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_plan date NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  statut text NOT NULL DEFAULT 'close' CHECK (statut IN ('close', 'annulee')),
  tonnes_cible numeric(12,2),
  tonnes_livrees numeric(12,2),
  ecart numeric(12,2),
  bilan jsonb NOT NULL,
  commentaire text,
  cloture_par uuid REFERENCES auth.users(id),
  cloture_le timestamptz NOT NULL DEFAULT now(),
  annule_par uuid REFERENCES auth.users(id),
  annule_le timestamptz,
  motif_annulation text,
  CONSTRAINT clotures_planification_annulation_motivee CHECK (statut <> 'annulee' OR motif_annulation IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_clotures_planification_active
  ON public.clotures_planification (date_plan, site_id) WHERE statut = 'close';
CREATE INDEX IF NOT EXISTS idx_clotures_planification_date ON public.clotures_planification (date_plan);

CREATE TABLE IF NOT EXISTS public.clotures_planification_causes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cloture_id uuid NOT NULL REFERENCES public.clotures_planification(id) ON DELETE RESTRICT,
  objectif_id uuid REFERENCES public.objectifs_production(id) ON DELETE RESTRICT,
  categorie text NOT NULL CHECK (categorie IN ('panne_camion', 'panne_engin', 'attente_chargement', 'attente_dechargement',
    'piste', 'meteo', 'absence_personnel', 'carburant', 'site_ferme', 'securite', 'autre')),
  description text NOT NULL CHECK (btrim(description) <> ''),
  tonnes_impact numeric(12,2) CHECK (tonnes_impact IS NULL OR tonnes_impact >= 0),
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clotures_planification_causes ON public.clotures_planification_causes (cloture_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clotures_planification', 'clotures_planification_causes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS lecture ON public.clotures_planification;
CREATE POLICY lecture ON public.clotures_planification FOR SELECT TO authenticated
  USING ((public.has_module_view('planning') OR public.is_admin()) AND public.site_permis(site_id));
DROP POLICY IF EXISTS lecture ON public.clotures_planification_causes;
CREATE POLICY lecture ON public.clotures_planification_causes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clotures_planification c WHERE c.id = cloture_id));

-- Cloture : seule l'annulation (close -> annulee, motif) est permise.
CREATE OR REPLACE FUNCTION public.garde_cloture_planification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Une cloture ne se supprime pas : elle s''annule' USING ERRCODE = '42501';
  END IF;
  IF OLD.statut <> 'close' OR NEW.statut <> 'annulee'
     OR (NEW.date_plan, NEW.site_id, NEW.tonnes_cible, NEW.tonnes_livrees, NEW.ecart, NEW.bilan, NEW.commentaire,
         NEW.cloture_par, NEW.cloture_le)
        IS DISTINCT FROM
        (OLD.date_plan, OLD.site_id, OLD.tonnes_cible, OLD.tonnes_livrees, OLD.ecart, OLD.bilan, OLD.commentaire,
         OLD.cloture_par, OLD.cloture_le) THEN
    RAISE EXCEPTION 'Une cloture ne se modifie pas : elle s''annule (motif) puis se refait' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_cloture ON public.clotures_planification;
CREATE TRIGGER garde_cloture BEFORE UPDATE OR DELETE ON public.clotures_planification
  FOR EACH ROW EXECUTE FUNCTION public.garde_cloture_planification();
DROP TRIGGER IF EXISTS garde_immuable ON public.clotures_planification_causes;
CREATE TRIGGER garde_immuable BEFORE UPDATE OR DELETE ON public.clotures_planification_causes
  FOR EACH ROW EXECUTE FUNCTION public.garde_immuable_planification();

-- Une journee close fige ses objectifs : ni nouvel objectif, ni revision,
-- ni annulation tant que la cloture n'est pas annulee.
CREATE OR REPLACE FUNCTION public.garde_objectif_journee_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.clotures_planification c
              WHERE c.date_plan = NEW.date_plan AND c.site_id = NEW.site_id AND c.statut = 'close') THEN
    RAISE EXCEPTION 'Planification close pour ce site et cette date : annuler la cloture (motif) avant de modifier les objectifs'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_objectif_journee_close() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_journee_close ON public.objectifs_production;
CREATE TRIGGER garde_journee_close BEFORE INSERT OR UPDATE ON public.objectifs_production
  FOR EACH ROW EXECUTE FUNCTION public.garde_objectif_journee_close();

-- Production d'une journee et d'un site (droits de l'appelant) : objectif
-- de journee s'il existe, sinon somme des objectifs de shift ; realise sur
-- le meme perimetre (tout le site avec un objectif de journee ou sans
-- objectif, les seuls shifts planifies sinon).
CREATE OR REPLACE FUNCTION public.production_journee(p_date date, p_site_id uuid)
RETURNS TABLE (
  tonnes_cible numeric,
  tonnes_livrees numeric,
  voyages_livres integer,
  voyages_sans_poids integer,
  tonnes_livrees_site numeric,
  voyages_non_termines integer,
  perimetre text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH ob AS (
    SELECT o.shift_id, o.tonnes_cible FROM public.objectifs_production o
     WHERE o.date_plan = p_date AND o.site_id = p_site_id AND o.statut = 'actif'
  ),
  niveau AS (
    SELECT CASE WHEN EXISTS (SELECT 1 FROM ob WHERE ob.shift_id IS NULL) THEN 'journee'
                WHEN EXISTS (SELECT 1 FROM ob) THEN 'shifts'
                ELSE 'sans_objectif' END AS n
  ),
  t AS (
    SELECT tr.shift_id, tr.etat,
           coalesce(tr.accepted_tonnage, tr.net_weight_reception, tr.net_weight, tr.load_weight) AS tonnes,
           tr.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED') AS livre
      FROM public.trips tr
     WHERE tr.planned_date = p_date AND tr.departure_site_id = p_site_id
  ),
  retenus AS (
    SELECT t.* FROM t, niveau
     WHERE niveau.n <> 'shifts' OR t.shift_id IN (SELECT ob.shift_id FROM ob WHERE ob.shift_id IS NOT NULL)
  )
  SELECT
    (SELECT CASE niveau.n WHEN 'journee' THEN (SELECT max(ob.tonnes_cible) FROM ob WHERE ob.shift_id IS NULL)
                          WHEN 'shifts' THEN (SELECT sum(ob.tonnes_cible) FROM ob) END FROM niveau),
    (SELECT round(coalesce(sum(r.tonnes) FILTER (WHERE r.livre), 0), 2) FROM retenus r),
    (SELECT count(*) FILTER (WHERE r.livre) FROM retenus r)::integer,
    (SELECT count(*) FILTER (WHERE r.livre AND r.tonnes IS NULL) FROM retenus r)::integer,
    (SELECT round(coalesce(sum(t.tonnes) FILTER (WHERE t.livre), 0), 2) FROM t),
    (SELECT count(*) FROM t WHERE t.etat IN ('DRAFT', 'PLANNED', 'ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT',
                                             'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'INTERRUPTED'))::integer,
    (SELECT CASE niveau.n WHEN 'journee' THEN 'objectif de journée ; réalisé : tous les voyages du site'
                          WHEN 'shifts' THEN 'somme des objectifs de shift ; réalisé : voyages des shifts planifiés'
                          ELSE 'sans objectif ; réalisé : tous les voyages du site' END FROM niveau);
$$;
REVOKE EXECUTE ON FUNCTION public.production_journee(date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.production_journee(date, uuid) TO authenticated;

-- Causes : [{"categorie": text, "description": text, "tonnes": n,
-- "objectif_id": uuid}].
CREATE OR REPLACE FUNCTION public.cloturer_planification(
  p_date date,
  p_site_id uuid,
  p_causes jsonb DEFAULT '[]'::jsonb,
  p_commentaire text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fin timestamptz;
  v_separee boolean;
  p record;
  v_bilan jsonb;
  v_id uuid;
  l jsonb;
  v_obj uuid;
  v_causes jsonb := coalesce(p_causes, '[]'::jsonb);
BEGIN
  IF NOT public.has_module_write('planning') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la planification requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_site_id IS NULL THEN
    RAISE EXCEPTION 'Date et site requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_causes) <> 'array' THEN
    RAISE EXCEPTION 'Causes : liste attendue' USING ERRCODE = '22023';
  END IF;
  SELECT f.fin INTO v_fin FROM public.fenetre_planification(p_date, NULL) f;
  IF v_fin > now() THEN
    RAISE EXCEPTION 'La journee n''est pas terminee (fin %)', to_char(v_fin AT TIME ZONE 'Africa/Conakry', 'DD/MM/YYYY HH24:MI')
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cloture_planification|' || p_date || '|' || p_site_id));
  IF EXISTS (SELECT 1 FROM public.clotures_planification c
              WHERE c.date_plan = p_date AND c.site_id = p_site_id AND c.statut = 'close') THEN
    RAISE EXCEPTION 'Planification deja close pour ce site et cette date' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce((SELECT (s.value ->> 'value') = 'true' FROM public.settings s WHERE s.key = 'planification_cloture_separee'), false)
    INTO v_separee;
  IF v_separee AND EXISTS (SELECT 1 FROM public.objectifs_production o
                            WHERE o.date_plan = p_date AND o.site_id = p_site_id AND o.statut = 'actif'
                              AND o.cree_par = auth.uid()) THEN
    RAISE EXCEPTION 'La cloture revient a une autre personne que l''auteur des objectifs (reglage planification_cloture_separee)'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p FROM public.production_journee(p_date, p_site_id);
  IF p.tonnes_cible IS NOT NULL AND p.tonnes_livrees < p.tonnes_cible AND jsonb_array_length(v_causes) = 0 THEN
    RAISE EXCEPTION 'Realise sous l''objectif (% t sur % t) : au moins une cause d''ecart requise', p.tonnes_livrees, p.tonnes_cible
      USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'perimetre', p.perimetre,
    'tonnes_cible', p.tonnes_cible,
    'tonnes_livrees', p.tonnes_livrees,
    'ecart', p.tonnes_livrees - p.tonnes_cible,
    'voyages_livres', p.voyages_livres,
    'voyages_sans_poids', p.voyages_sans_poids,
    'tonnes_livrees_site', p.tonnes_livrees_site,
    'voyages_non_termines', p.voyages_non_termines,
    'objectifs', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'shift_id', r.shift_id, 'version', r.version, 'tonnes_cible', r.tonnes_cible,
        'tonnes_cible_initial', r.tonnes_cible_initial, 'tonnes_livrees', r.tonnes_livrees,
        'tonnes_acceptees', r.tonnes_acceptees, 'voyages_cible', r.voyages_cible, 'voyages_livres', r.voyages_livres,
        'voyages_sans_poids', r.voyages_sans_poids, 'motif', r.motif) ORDER BY r.shift_id NULLS FIRST)
      FROM public.v_realisation_objectifs r WHERE r.date_plan = p_date AND r.site_id = p_site_id), '[]'::jsonb),
    'ventilation', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'objectif_id', w.objectif_id, 'destination_id', w.destination_id, 'contrat_id', w.contrat_id,
        'contrat_reference', w.contrat_reference, 'tonnes_cible', w.tonnes_cible, 'tonnes_livrees', w.tonnes_livrees,
        'voyages_livres', w.voyages_livres, 'mesurable', w.mesurable, 'realise_partage', w.realise_partage))
      FROM public.v_realisation_ventilation w WHERE w.date_plan = p_date AND w.site_id = p_site_id), '[]'::jsonb),
    'postes', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'shift_id', x.shift_id, 'statut', x.statut))
      FROM public.postes x WHERE x.date_poste = p_date AND x.site_id = p_site_id), '[]'::jsonb),
    'fige_le', now())
  INTO v_bilan;

  INSERT INTO public.clotures_planification (date_plan, site_id, tonnes_cible, tonnes_livrees, ecart, bilan, commentaire, cloture_par)
  VALUES (p_date, p_site_id, p.tonnes_cible, p.tonnes_livrees, p.tonnes_livrees - p.tonnes_cible, v_bilan,
          nullif(btrim(coalesce(p_commentaire, '')), ''), auth.uid())
  RETURNING id INTO v_id;

  FOR l IN SELECT * FROM jsonb_array_elements(v_causes) LOOP
    v_obj := nullif(l ->> 'objectif_id', '')::uuid;
    IF v_obj IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.objectifs_production o
                                          WHERE o.id = v_obj AND o.date_plan = p_date AND o.site_id = p_site_id) THEN
      RAISE EXCEPTION 'Cause rattachee a un objectif d''une autre journee ou d''un autre site' USING ERRCODE = '22023';
    END IF;
    IF nullif(btrim(coalesce(l ->> 'description', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Cause : description requise' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.clotures_planification_causes (cloture_id, objectif_id, categorie, description, tonnes_impact, saisi_par)
    VALUES (v_id, v_obj, l ->> 'categorie', btrim(l ->> 'description'), nullif(l ->> 'tonnes', '')::numeric, auth.uid());
  END LOOP;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_cloture_planification(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.clotures_planification;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.has_module_write('planning') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la planification requis' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour annuler une cloture' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.clotures_planification WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR c.statut <> 'close' THEN
    RAISE EXCEPTION 'Cloture active introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.site_permis(c.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : cloture d''un autre site' USING ERRCODE = '42501';
  END IF;
  UPDATE public.clotures_planification
     SET statut = 'annulee', annule_par = auth.uid(), annule_le = now(), motif_annulation = v_motif
   WHERE id = p_id;
END;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY['cloturer_planification(date, uuid, jsonb, text)', 'annuler_cloture_planification(uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;

-- Rapport de production par jour et par site (droits de l'appelant) :
-- journee close = bilan fige ; sinon calcule a la lecture.
CREATE OR REPLACE FUNCTION public.rapport_production(p_debut date, p_fin date, p_site uuid DEFAULT NULL)
RETURNS TABLE (
  date_plan date,
  site_id uuid,
  site text,
  statut text,
  tonnes_cible numeric,
  tonnes_livrees numeric,
  ecart numeric,
  realisation_pct numeric,
  voyages_livres integer,
  voyages_sans_poids integer,
  causes text,
  cloture_le timestamptz,
  source text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH bornes AS (
    SELECT p_debut AS d, least(p_fin, p_debut + 366) AS f
  ),
  jours AS (
    SELECT o.date_plan AS d, o.site_id AS s FROM public.objectifs_production o, bornes b
     WHERE o.statut = 'actif' AND o.date_plan BETWEEN b.d AND b.f AND (p_site IS NULL OR o.site_id = p_site)
    UNION
    SELECT c.date_plan, c.site_id FROM public.clotures_planification c, bornes b
     WHERE c.statut = 'close' AND c.date_plan BETWEEN b.d AND b.f AND (p_site IS NULL OR c.site_id = p_site)
    UNION
    SELECT t.planned_date, t.departure_site_id FROM public.trips t, bornes b
     WHERE t.planned_date BETWEEN b.d AND b.f AND t.departure_site_id IS NOT NULL
       AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED') AND (p_site IS NULL OR t.departure_site_id = p_site)
  )
  SELECT j.d, j.s, si.name,
         CASE WHEN c.id IS NOT NULL THEN 'close' ELSE 'non_close' END,
         CASE WHEN c.id IS NOT NULL THEN c.tonnes_cible ELSE pj.tonnes_cible END,
         CASE WHEN c.id IS NOT NULL THEN c.tonnes_livrees ELSE pj.tonnes_livrees END,
         CASE WHEN c.id IS NOT NULL THEN c.ecart ELSE pj.tonnes_livrees - pj.tonnes_cible END,
         round(100 * CASE WHEN c.id IS NOT NULL THEN c.tonnes_livrees / nullif(c.tonnes_cible, 0)
                          ELSE pj.tonnes_livrees / nullif(pj.tonnes_cible, 0) END, 1),
         CASE WHEN c.id IS NOT NULL THEN (c.bilan ->> 'voyages_livres')::integer ELSE pj.voyages_livres END,
         CASE WHEN c.id IS NOT NULL THEN (c.bilan ->> 'voyages_sans_poids')::integer ELSE pj.voyages_sans_poids END,
         (SELECT string_agg(k.categorie || coalesce(' (' || k.tonnes_impact || ' t)', '') || ' : ' || k.description, ' ; ' ORDER BY k.saisi_le)
            FROM public.clotures_planification_causes k WHERE k.cloture_id = c.id),
         c.cloture_le,
         CASE WHEN c.id IS NOT NULL THEN 'bilan figé à la clôture ; ' || coalesce(c.bilan ->> 'perimetre', '')
              ELSE 'non clos, calculé à la lecture ; ' || pj.perimetre END
    FROM jours j
    LEFT JOIN public.sites si ON si.id = j.s
    LEFT JOIN public.clotures_planification c ON c.date_plan = j.d AND c.site_id = j.s AND c.statut = 'close'
    LEFT JOIN LATERAL public.production_journee(j.d, j.s) pj ON c.id IS NULL
   ORDER BY j.d, si.name;
$$;
REVOKE EXECUTE ON FUNCTION public.rapport_production(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rapport_production(date, date, uuid) TO authenticated;

-- 5. Comparaison entre shifts -----------------------------------------------

CREATE OR REPLACE FUNCTION public.comparer_shifts(p_debut date, p_fin date, p_site uuid DEFAULT NULL)
RETURNS TABLE (
  shift_id uuid,
  shift text,
  ordre integer,
  jours integer,
  voyages integer,
  voyages_livres integer,
  tonnes_livrees numeric,
  voyages_sans_poids integer,
  tonnes_par_voyage numeric,
  rotations_mesurees integer,
  duree_rotation_min numeric,
  trajets_mesures integer,
  duree_trajet_min numeric,
  tonnes_cible numeric,
  tonnes_livrees_objectif numeric,
  realisation_pct numeric,
  postes integer,
  postes_clos integer,
  incidents integer,
  arrets integer,
  retards integer,
  presences integer,
  absences integer,
  retard_minutes integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH bornes AS (
    SELECT p_debut AS d, least(p_fin, p_debut + 366) AS f
  ),
  v AS (
    SELECT t.id, t.shift_id, t.vehicle_id, t.planned_date, t.actual_departure_time, t.actual_arrival_time,
           t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED') AS livre,
           coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) AS tonnes
      FROM public.trips t, bornes b
     WHERE t.planned_date BETWEEN b.d AND b.f
       AND (p_site IS NULL OR t.departure_site_id = p_site)
       AND t.etat IS DISTINCT FROM 'CANCELLED'
  ),
  tv AS (
    SELECT v.shift_id,
           count(DISTINCT v.planned_date) AS jours,
           count(*) AS voyages,
           count(*) FILTER (WHERE v.livre) AS livres,
           sum(v.tonnes) FILTER (WHERE v.livre) AS tonnes,
           count(*) FILTER (WHERE v.livre AND v.tonnes IS NULL) AS sans_poids,
           avg(v.tonnes) FILTER (WHERE v.livre) AS par_voyage,
           count(*) FILTER (WHERE v.livre AND v.actual_arrival_time > v.actual_departure_time) AS trajets,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM v.actual_arrival_time - v.actual_departure_time)::double precision / 60)
             FILTER (WHERE v.livre AND v.actual_arrival_time > v.actual_departure_time) AS trajet
      FROM v GROUP BY v.shift_id
  ),
  rot AS (
    SELECT x.shift_id, count(*) AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY x.minutes) AS mediane
      FROM (SELECT v.shift_id,
                   extract(epoch FROM lead(v.actual_departure_time) OVER (
                     PARTITION BY v.vehicle_id, v.planned_date, v.shift_id ORDER BY v.actual_departure_time)
                     - v.actual_departure_time)::double precision / 60 AS minutes
              FROM v WHERE v.livre AND v.vehicle_id IS NOT NULL AND v.actual_departure_time IS NOT NULL) x
     WHERE x.minutes > 0
     GROUP BY x.shift_id
  ),
  ob AS (
    SELECT r.shift_id, sum(r.tonnes_cible) AS cible, sum(r.tonnes_livrees) AS livre
      FROM public.v_realisation_objectifs r, bornes b
     WHERE r.shift_id IS NOT NULL AND r.date_plan BETWEEN b.d AND b.f AND (p_site IS NULL OR r.site_id = p_site)
     GROUP BY r.shift_id
  ),
  po AS (
    SELECT p.shift_id,
           count(*) AS postes,
           count(*) FILTER (WHERE p.statut IN ('cloture', 'valide')) AS clos,
           sum((SELECT count(*) FROM public.postes_evenements e WHERE e.poste_id = p.id AND e.categorie IN ('incident', 'securite'))) AS incidents,
           sum((SELECT count(*) FROM public.postes_evenements e WHERE e.poste_id = p.id AND e.categorie = 'arret')) AS arrets,
           sum((SELECT count(*) FROM public.postes_evenements e WHERE e.poste_id = p.id AND e.categorie = 'retard')) AS retards,
           sum((SELECT count(*) FROM public.postes_equipe q WHERE q.poste_id = p.id AND q.present)) AS presences,
           sum((SELECT count(*) FROM public.postes_equipe q WHERE q.poste_id = p.id AND q.present = false)) AS absences,
           sum((SELECT coalesce(sum(q.retard_minutes), 0) FROM public.postes_equipe q WHERE q.poste_id = p.id)) AS retard_minutes
      FROM public.postes p, bornes b
     WHERE p.date_poste BETWEEN b.d AND b.f AND (p_site IS NULL OR p.site_id = p_site)
     GROUP BY p.shift_id
  ),
  cles AS (
    SELECT tv.shift_id FROM tv UNION SELECT po.shift_id FROM po UNION SELECT ob.shift_id FROM ob
  )
  SELECT k.shift_id,
         coalesce(s.display_name, CASE WHEN k.shift_id IS NULL THEN 'Sans shift' ELSE 'Shift inconnu' END),
         s.shift_order,
         coalesce(tv.jours, 0)::integer,
         coalesce(tv.voyages, 0)::integer,
         coalesce(tv.livres, 0)::integer,
         round(coalesce(tv.tonnes, 0), 2),
         coalesce(tv.sans_poids, 0)::integer,
         round(tv.par_voyage, 2),
         coalesce(rot.n, 0)::integer,
         round(rot.mediane::numeric, 1),
         coalesce(tv.trajets, 0)::integer,
         round(tv.trajet::numeric, 1),
         round(ob.cible, 2),
         round(ob.livre, 2),
         round(100 * ob.livre / nullif(ob.cible, 0), 1),
         coalesce(po.postes, 0)::integer,
         coalesce(po.clos, 0)::integer,
         po.incidents::integer,
         po.arrets::integer,
         po.retards::integer,
         po.presences::integer,
         po.absences::integer,
         po.retard_minutes::integer
    FROM cles k
    LEFT JOIN public.work_shifts s ON s.id = k.shift_id
    LEFT JOIN tv ON tv.shift_id IS NOT DISTINCT FROM k.shift_id
    LEFT JOIN rot ON rot.shift_id IS NOT DISTINCT FROM k.shift_id
    LEFT JOIN ob ON ob.shift_id IS NOT DISTINCT FROM k.shift_id
    LEFT JOIN po ON po.shift_id IS NOT DISTINCT FROM k.shift_id
   ORDER BY s.shift_order NULLS LAST, 2;
$$;
REVOKE EXECUTE ON FUNCTION public.comparer_shifts(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comparer_shifts(date, date, uuid) TO authenticated;

-- 6. Reglage de separation de la cloture : format controle ------------------
-- Reprend toutes les cles de la migration 20261118180000 et ajoute
-- `planification_cloture_separee` (booleen ; absent = non exigee).
CREATE OR REPLACE FUNCTION public.valider_reglage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v text := NEW.value ->> 'value';
BEGIN
  IF NEW.key IN ('mfa_exige', 'carburant_validation_separee', 'kilometrage_validation_separee',
                 'achats_validation_separee', 'paiements_validation_separee', 'controle_depart_exige',
                 'planification_cloture_separee') THEN
    IF v IS NULL OR v NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'Reglage % : valeur true ou false attendue', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('tolerance_poids_cbg_t', 'pneu_profondeur_min_mm', 'pneu_inspection_max_jours') THEN
    IF v IS NULL OR v !~ '^\d+(\.\d+)?$' THEN
      RAISE EXCEPTION 'Reglage % : nombre positif attendu', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('fournisseurs_alerte_documents_jours', 'consultation_offres_minimum') THEN
    -- Lus par reglage_entier (D-059) : un entier, sinon la valeur par defaut s'appliquerait en silence.
    IF v IS NULL OR v !~ '^\d+$' OR (NEW.key = 'consultation_offres_minimum' AND v::integer < 1) THEN
      RAISE EXCEPTION 'Reglage % : nombre entier attendu (au moins 1 offre)', NEW.key USING ERRCODE = '22023';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

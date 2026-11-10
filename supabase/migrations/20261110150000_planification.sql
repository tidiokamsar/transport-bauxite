/*
  # Planification v1 : objectifs de production (etape 3 de la reprise, D-023)

  CDC 6.1 et 6.3 (partiels) : objectif en tonnes par date x site de
  chargement x shift, ou pour la journee (shift vide), compare a la
  realisation tiree des voyages (CDC 12, migration 20261110120000).

  Cartographie (CDC 33) : `shift_plans` (FleetOptimizer) n'est pas reprise
  (ni site, ni lien vers `work_shifts`, alimentee par Math.random).

  1. Module de droits `planning` : lecture = lecture des voyages ;
     ecriture = suppression des voyages (encadrement des operations).
  2. Table `objectifs_production` : versions successives, jamais reecrites.
  3. Fonctions `definir_objectif` (creation ou revision motivee) et
     `annuler_objectif` (motif obligatoire).
  4. Vue `v_realisation_objectifs` (droits de l'appelant) : objectif actif,
     objectif initial, tonnes et voyages livres.
  5. Fonction `statistiques_rotation` : charge moyenne et rotations par
     camion observees, pour l'estimation des ressources (CDC 6.2).

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- 1. Droits du module planning, derives de la ligne trips de chaque role
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve)
SELECT rp.role, 'planning', rp.can_view, rp.can_delete, rp.can_delete, rp.can_delete, rp.can_approve
FROM public.role_permissions rp
WHERE rp.module = 'trips'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions e WHERE e.role = rp.role AND e.module = 'planning');

-- 2. Objectifs de production
CREATE TABLE IF NOT EXISTS public.objectifs_production (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_plan date NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  shift_id uuid REFERENCES public.work_shifts(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version >= 1),
  tonnes_cible numeric(12,2) NOT NULL CHECK (tonnes_cible > 0),
  voyages_cible integer CHECK (voyages_cible > 0),
  camions_prevus integer CHECK (camions_prevus >= 0),
  chargeuses_prevues integer CHECK (chargeuses_prevues >= 0),
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'remplace', 'annule')),
  motif text,
  note text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  clos_le timestamptz,
  clos_par uuid REFERENCES auth.users(id),
  motif_annulation text,
  CONSTRAINT objectifs_production_revision_motivee CHECK (version = 1 OR motif IS NOT NULL),
  CONSTRAINT objectifs_production_annulation_motivee CHECK (statut <> 'annule' OR motif_annulation IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS objectifs_production_un_actif
  ON public.objectifs_production (date_plan, site_id, coalesce(shift_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE statut = 'actif';
CREATE UNIQUE INDEX IF NOT EXISTS objectifs_production_version
  ON public.objectifs_production (date_plan, site_id, coalesce(shift_id, '00000000-0000-0000-0000-000000000000'::uuid), version);
CREATE INDEX IF NOT EXISTS idx_objectifs_production_date ON public.objectifs_production (date_plan);

ALTER TABLE public.objectifs_production ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.objectifs_production FROM anon, authenticated;
GRANT SELECT ON public.objectifs_production TO authenticated;
GRANT ALL ON public.objectifs_production TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.objectifs_production;
CREATE POLICY lecture_module ON public.objectifs_production
  FOR SELECT TO authenticated USING (public.has_module_view('planning') OR public.is_admin());

-- Garde : contenu immuable ; seule la cloture (remplace, annule) est
-- permise, et seulement depuis l'etat actif. Hors session utilisateur
-- (maintenance, purge de demonstration) la garde laisse passer.
CREATE OR REPLACE FUNCTION public.objectifs_production_garde()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un objectif ne se supprime pas : il s''annule' USING ERRCODE = '42501';
  END IF;
  IF OLD.statut <> 'actif' OR NEW.statut = 'actif'
     OR (NEW.date_plan, NEW.site_id, NEW.shift_id, NEW.version, NEW.tonnes_cible, NEW.voyages_cible,
         NEW.camions_prevus, NEW.chargeuses_prevues, NEW.motif, NEW.note, NEW.cree_par, NEW.cree_le)
        IS DISTINCT FROM
        (OLD.date_plan, OLD.site_id, OLD.shift_id, OLD.version, OLD.tonnes_cible, OLD.voyages_cible,
         OLD.camions_prevus, OLD.chargeuses_prevues, OLD.motif, OLD.note, OLD.cree_par, OLD.cree_le) THEN
    RAISE EXCEPTION 'Un objectif ne se modifie pas : il se revise (nouvelle version)' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS objectifs_production_garde ON public.objectifs_production;
CREATE TRIGGER objectifs_production_garde
  BEFORE UPDATE OR DELETE ON public.objectifs_production
  FOR EACH ROW EXECUTE FUNCTION public.objectifs_production_garde();

-- 3. Fonctions d'ecriture
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
BEGIN
  IF NOT public.has_module_write('planning') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la planification requis' USING ERRCODE = '42501';
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

-- 4. Realisation des objectifs actifs. Voyages livres = livre, accepte,
-- cloture, en litige ; tonnage = accepte, sinon recu, sinon charge.
-- Objectif de journee : tous les shifts ; objectif de shift : ce shift.
CREATE OR REPLACE VIEW public.v_realisation_objectifs
WITH (security_invoker = true) AS
SELECT
  o.id, o.date_plan, o.site_id, o.shift_id, o.version, o.tonnes_cible, o.voyages_cible,
  o.camions_prevus, o.chargeuses_prevues, o.motif, o.note, o.cree_le,
  initial.tonnes_cible AS tonnes_cible_initial,
  round(coalesce(r.tonnes_livrees, 0), 2) AS tonnes_livrees,
  round(coalesce(r.tonnes_acceptees, 0), 2) AS tonnes_acceptees,
  coalesce(r.voyages_livres, 0) AS voyages_livres,
  coalesce(r.voyages_sans_poids, 0) AS voyages_sans_poids,
  coalesce(r.voyages_en_cours, 0) AS voyages_en_cours,
  coalesce(r.voyages_prevus, 0) AS voyages_prevus,
  r.derniere_livraison
FROM public.objectifs_production o
LEFT JOIN public.objectifs_production initial
  ON initial.date_plan = o.date_plan AND initial.site_id = o.site_id
 AND initial.shift_id IS NOT DISTINCT FROM o.shift_id AND initial.version = 1
LEFT JOIN LATERAL (
  SELECT
    sum(coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight))
      FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')) AS tonnes_livrees,
    sum(t.accepted_tonnage) FILTER (WHERE t.etat IN ('ACCEPTED', 'CLOSED')) AS tonnes_acceptees,
    count(*) FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')) AS voyages_livres,
    count(*) FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
      AND coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) IS NULL) AS voyages_sans_poids,
    count(*) FILTER (WHERE t.etat IN ('AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT',
      'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'INTERRUPTED')) AS voyages_en_cours,
    count(*) FILTER (WHERE t.etat IN ('DRAFT', 'PLANNED', 'ASSIGNED')) AS voyages_prevus,
    max(t.actual_arrival_time) FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')) AS derniere_livraison
  FROM public.trips t
  WHERE t.planned_date = o.date_plan
    AND t.departure_site_id = o.site_id
    AND (o.shift_id IS NULL OR t.shift_id = o.shift_id)
) r ON true
WHERE o.statut = 'actif';

REVOKE ALL ON public.v_realisation_objectifs FROM anon;
GRANT SELECT ON public.v_realisation_objectifs TO authenticated;

-- 5. Statistiques de rotation observees (CDC 6.2), droits de l'appelant.
-- Sur les p_jours jours precedant p_jusqua (exclu) : voyages livres avec
-- tonnage, charge moyenne, rotations par camion et par jour (ou shift).
CREATE OR REPLACE FUNCTION public.statistiques_rotation(
  p_site_id uuid,
  p_shift_id uuid,
  p_jusqua date,
  p_jours integer DEFAULT 14
)
RETURNS TABLE (
  jours_observes integer,
  voyages integer,
  charge_moyenne numeric,
  rotations_par_camion numeric,
  camions_par_jour numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH base AS (
    SELECT t.planned_date, t.vehicle_id,
           coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) AS tonnes
    FROM public.trips t
    WHERE t.departure_site_id = p_site_id
      AND (p_shift_id IS NULL OR t.shift_id = p_shift_id)
      AND t.planned_date >= p_jusqua - greatest(1, least(p_jours, 90))
      AND t.planned_date < p_jusqua
      AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
      AND t.vehicle_id IS NOT NULL
  ),
  par_jour AS (
    SELECT planned_date, count(*) AS voyages, count(DISTINCT vehicle_id) AS camions
    FROM base GROUP BY planned_date
  )
  SELECT
    (SELECT count(*) FROM par_jour)::integer,
    (SELECT count(*) FROM base)::integer,
    (SELECT round(avg(tonnes), 2) FROM base WHERE tonnes IS NOT NULL),
    (SELECT round(sum(voyages)::numeric / nullif(sum(camions), 0), 2) FROM par_jour),
    (SELECT round(avg(camions), 1) FROM par_jour);
$$;

REVOKE EXECUTE ON FUNCTION public.statistiques_rotation(uuid, uuid, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.statistiques_rotation(uuid, uuid, date, integer) TO authenticated;

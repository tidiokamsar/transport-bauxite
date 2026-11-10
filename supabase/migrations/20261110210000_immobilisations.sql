/*
  # Immobilisations des engins loues (maintenance selon D-022, D-025)

  Les engins sont loues a l'heure a Nimba Mining, qui en assure la
  maintenance ; pneus et carburant sont a la charge de l'exploitant. Le
  suivi utile est donc l'indisponibilite horodatee et son imputation, qui
  alimentera le decompte de location (D-013) et alimente deja la
  disponibilite vue par la planification et le dispatch.

  Cartographie (CDC 33) : `maintenance_orders` decrit des ordres d'atelier
  (main-d'oeuvre, couts, atelier interne) sans heure de debut ni de fin
  d'indisponibilite ni imputation : non reprise.

  1. `immobilisations` : engin, debut, fin, cause, imputation, statut.
  2. `immobilisations_journal` : chaque action, etat avant et apres, motif.
  3. Fonctions d'ecriture (droit `maintenance`) : declarer, cloturer,
     corriger (motif), annuler (motif) ; le statut de l'engin suit.
  4. `heures_immobilisation(du, au)` : heures par engin, imputation, cause,
     bornees a la periode (droits de l'appelant).

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

CREATE TABLE IF NOT EXISTS public.immobilisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  debut timestamptz NOT NULL,
  fin timestamptz,
  cause text NOT NULL CHECK (cause IN ('panne', 'maintenance_planifiee', 'pneumatique', 'accident', 'attente_piece', 'autre')),
  imputation text NOT NULL CHECK (imputation IN ('loueur', 'exploitant', 'a_determiner')),
  description text NOT NULL,
  reference_loueur text,
  statut text NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'cloturee', 'annulee')),
  declare_par uuid REFERENCES auth.users(id),
  declare_le timestamptz NOT NULL DEFAULT now(),
  cloture_par uuid REFERENCES auth.users(id),
  cloture_le timestamptz,
  CONSTRAINT immobilisations_periode CHECK (fin IS NULL OR fin > debut),
  CONSTRAINT immobilisations_statut_fin CHECK (
    (statut = 'ouverte' AND fin IS NULL) OR (statut = 'cloturee' AND fin IS NOT NULL) OR statut = 'annulee')
);
CREATE UNIQUE INDEX IF NOT EXISTS immobilisations_une_ouverte
  ON public.immobilisations (vehicle_id) WHERE statut = 'ouverte';
CREATE INDEX IF NOT EXISTS idx_immobilisations_periode ON public.immobilisations (debut, fin);

CREATE TABLE IF NOT EXISTS public.immobilisations_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  immobilisation_id uuid NOT NULL REFERENCES public.immobilisations(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('declaration', 'cloture', 'correction', 'annulation')),
  avant jsonb,
  apres jsonb NOT NULL,
  motif text,
  auteur uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_immobilisations_journal ON public.immobilisations_journal (immobilisation_id, le);

ALTER TABLE public.immobilisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immobilisations_journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.immobilisations, public.immobilisations_journal FROM anon, authenticated;
GRANT SELECT ON public.immobilisations, public.immobilisations_journal TO authenticated;
GRANT ALL ON public.immobilisations, public.immobilisations_journal TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.immobilisations;
CREATE POLICY lecture_module ON public.immobilisations
  FOR SELECT TO authenticated USING (public.has_module_view('maintenance') OR public.is_admin());
DROP POLICY IF EXISTS lecture_module ON public.immobilisations_journal;
CREATE POLICY lecture_module ON public.immobilisations_journal
  FOR SELECT TO authenticated USING (public.has_module_view('maintenance') OR public.is_admin());

-- Controles communs : periode plausible et sans chevauchement pour l'engin.
CREATE OR REPLACE FUNCTION public.immobilisation_controler(
  p_id uuid, p_vehicle_id uuid, p_debut timestamptz, p_fin timestamptz)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF p_debut IS NULL THEN
    RAISE EXCEPTION 'Heure de debut requise' USING ERRCODE = '22023';
  END IF;
  IF p_debut > now() + interval '5 minutes' OR p_fin > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure dans le futur : on declare une immobilisation constatee' USING ERRCODE = '22023';
  END IF;
  IF p_fin IS NOT NULL AND p_fin <= p_debut THEN
    RAISE EXCEPTION 'La fin doit suivre le debut' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.immobilisations i
    WHERE i.vehicle_id = p_vehicle_id AND i.statut <> 'annulee'
      AND i.id IS DISTINCT FROM p_id
      AND tstzrange(i.debut, i.fin) && tstzrange(p_debut, p_fin)
  ) THEN
    RAISE EXCEPTION 'Periode en chevauchement avec une autre immobilisation de cet engin' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.immobilisation_controler(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.declarer_immobilisation(
  p_vehicle_id uuid,
  p_debut timestamptz,
  p_cause text,
  p_imputation text,
  p_description text,
  p_reference_loueur text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_engin public.vehicles;
  v_ligne public.immobilisations;
BEGIN
  IF NOT public.has_module_write('maintenance') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la maintenance requis' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_description, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Description requise' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_engin FROM public.vehicles WHERE id = p_vehicle_id FOR UPDATE;
  IF NOT FOUND OR v_engin.status::text = 'sold' THEN
    RAISE EXCEPTION 'Engin introuvable ou sorti de la flotte' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.immobilisations WHERE vehicle_id = p_vehicle_id AND statut = 'ouverte') THEN
    RAISE EXCEPTION 'Cet engin a deja une immobilisation ouverte' USING ERRCODE = '22023';
  END IF;
  PERFORM public.immobilisation_controler(NULL, p_vehicle_id, p_debut, NULL);

  INSERT INTO public.immobilisations (vehicle_id, debut, cause, imputation, description, reference_loueur, declare_par)
  VALUES (p_vehicle_id, p_debut, p_cause, p_imputation, btrim(p_description),
    nullif(btrim(coalesce(p_reference_loueur, '')), ''), auth.uid())
  RETURNING * INTO v_ligne;

  INSERT INTO public.immobilisations_journal (immobilisation_id, action, apres, auteur)
  VALUES (v_ligne.id, 'declaration', to_jsonb(v_ligne), auth.uid());

  UPDATE public.vehicles
  SET status = (CASE WHEN p_cause = 'maintenance_planifiee' THEN 'maintenance' ELSE 'immobilized' END)::public.vehicle_status
  WHERE id = p_vehicle_id;
  RETURN v_ligne.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cloturer_immobilisation(p_id uuid, p_fin timestamptz, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avant public.immobilisations;
  v_apres public.immobilisations;
BEGIN
  IF NOT public.has_module_write('maintenance') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la maintenance requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_avant FROM public.immobilisations WHERE id = p_id AND statut = 'ouverte' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Immobilisation ouverte introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_fin IS NULL THEN
    RAISE EXCEPTION 'Heure de fin requise' USING ERRCODE = '22023';
  END IF;
  PERFORM public.immobilisation_controler(p_id, v_avant.vehicle_id, v_avant.debut, p_fin);

  UPDATE public.immobilisations
  SET fin = p_fin, statut = 'cloturee', cloture_par = auth.uid(), cloture_le = now()
  WHERE id = p_id
  RETURNING * INTO v_apres;
  INSERT INTO public.immobilisations_journal (immobilisation_id, action, avant, apres, motif, auteur)
  VALUES (p_id, 'cloture', to_jsonb(v_avant), to_jsonb(v_apres), nullif(btrim(coalesce(p_note, '')), ''), auth.uid());

  UPDATE public.vehicles SET status = 'active'
  WHERE id = v_avant.vehicle_id AND status::text IN ('maintenance', 'immobilized');
END;
$$;

CREATE OR REPLACE FUNCTION public.corriger_immobilisation(
  p_id uuid,
  p_cause text,
  p_imputation text,
  p_debut timestamptz,
  p_fin timestamptz,
  p_motif text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avant public.immobilisations;
  v_apres public.immobilisations;
BEGIN
  IF NOT public.has_module_write('maintenance') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la maintenance requis' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour corriger une immobilisation' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_avant FROM public.immobilisations WHERE id = p_id AND statut <> 'annulee' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Immobilisation introuvable ou annulee' USING ERRCODE = 'P0002';
  END IF;
  IF (v_avant.statut = 'ouverte') <> (p_fin IS NULL) THEN
    RAISE EXCEPTION 'La fin se saisit par la cloture ; une immobilisation cloturee garde une fin' USING ERRCODE = '22023';
  END IF;
  PERFORM public.immobilisation_controler(p_id, v_avant.vehicle_id, p_debut, p_fin);

  UPDATE public.immobilisations
  SET cause = p_cause, imputation = p_imputation, debut = p_debut, fin = p_fin
  WHERE id = p_id
  RETURNING * INTO v_apres;
  INSERT INTO public.immobilisations_journal (immobilisation_id, action, avant, apres, motif, auteur)
  VALUES (p_id, 'correction', to_jsonb(v_avant), to_jsonb(v_apres), btrim(p_motif), auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_immobilisation(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avant public.immobilisations;
  v_apres public.immobilisations;
BEGIN
  IF NOT public.has_module_write('maintenance') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la maintenance requis' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour annuler une immobilisation' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_avant FROM public.immobilisations WHERE id = p_id AND statut <> 'annulee' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Immobilisation introuvable ou deja annulee' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.immobilisations SET statut = 'annulee' WHERE id = p_id RETURNING * INTO v_apres;
  INSERT INTO public.immobilisations_journal (immobilisation_id, action, avant, apres, motif, auteur)
  VALUES (p_id, 'annulation', to_jsonb(v_avant), to_jsonb(v_apres), btrim(p_motif), auth.uid());
  IF v_avant.statut = 'ouverte' THEN
    UPDATE public.vehicles SET status = 'active'
    WHERE id = v_avant.vehicle_id AND status::text IN ('maintenance', 'immobilized');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.declarer_immobilisation(uuid, timestamptz, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.declarer_immobilisation(uuid, timestamptz, text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cloturer_immobilisation(uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cloturer_immobilisation(uuid, timestamptz, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.corriger_immobilisation(uuid, text, text, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corriger_immobilisation(uuid, text, text, timestamptz, timestamptz, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.annuler_immobilisation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annuler_immobilisation(uuid, text) TO authenticated;

-- Heures d'immobilisation par engin, imputation et cause sur [du, au[ ;
-- une immobilisation ouverte compte jusqu'a maintenant.
CREATE OR REPLACE FUNCTION public.heures_immobilisation(p_du timestamptz, p_au timestamptz)
RETURNS TABLE (vehicle_id uuid, imputation text, cause text, heures numeric, episodes integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT i.vehicle_id, i.imputation, i.cause,
         round(sum(extract(epoch FROM least(coalesce(i.fin, now()), p_au) - greatest(i.debut, p_du)) / 3600)::numeric, 2),
         count(*)::integer
  FROM public.immobilisations i
  WHERE i.statut <> 'annulee'
    AND i.debut < p_au
    AND coalesce(i.fin, now()) > p_du
    AND least(coalesce(i.fin, now()), p_au) > greatest(i.debut, p_du)
  GROUP BY i.vehicle_id, i.imputation, i.cause;
$$;
REVOKE EXECUTE ON FUNCTION public.heures_immobilisation(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.heures_immobilisation(timestamptz, timestamptz) TO authenticated;

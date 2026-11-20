/*
  # Tare de reference versionnee et validee par l'administrateur (D-095)

  1. `tare_references` est le referentiel proprietaire de la tare d'un engin.
     Une seule version est validee a la fois par engin. Aucune valeur par
     defaut : un engin sans tare validee reste « sans tare validee ».
     L'ancien attribut `vehicles.tare_weight` (herite de Bolt), present
     dans la base de reference mais retire depuis, n'est pas reintroduit.
  2. Proposition par un utilisateur ayant le droit d'ecriture sur la flotte,
     validation, remplacement et retrait par l'administrateur uniquement.
     Chaque mouvement est journalise dans `journal_tare` (append-only).
  3. Chaque voyage fige la tare et la configuration tracteur/remorque
     applicables a sa date, par declencheur serveur. Une modification
     ulterieure de la reference n'est jamais retrospective.
  4. `tare_applicable` est la seule lecture de la reference pour le dispatch,
     le rapprochement CBG et les ecrans. `constater_tare_manquante`
     enregistre une derogation motivee et auditee (D-082) sans inventer de
     valeur. Idempotent.
*/

-- 1. Referentiel versionne
CREATE TABLE IF NOT EXISTS public.tare_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  tare_tonnes numeric NOT NULL CHECK (tare_tonnes > 0),
  tracteur_id uuid REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  remorque_id uuid REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  statut text NOT NULL DEFAULT 'proposee'
    CHECK (statut IN ('proposee', 'validee', 'remplacee', 'retiree')),
  motif text NOT NULL CHECK (length(btrim(motif)) > 0),
  propose_par uuid REFERENCES auth.users(id),
  propose_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  valide_par uuid REFERENCES auth.users(id),
  valide_le timestamptz,
  retire_par uuid REFERENCES auth.users(id),
  retire_le timestamptz,
  CONSTRAINT tare_reference_validation_coherente
    CHECK ((statut IN ('validee', 'remplacee')) = (valide_par IS NOT NULL AND valide_le IS NOT NULL)),
  CONSTRAINT tare_reference_retrait_coherent
    CHECK ((statut IN ('retiree', 'remplacee')) = (retire_par IS NOT NULL AND retire_le IS NOT NULL)),
  CONSTRAINT tare_reference_pas_auto_reference
    CHECK ((tracteur_id IS NULL OR tracteur_id <> vehicle_id)
           AND (remorque_id IS NULL OR remorque_id <> vehicle_id)
           AND (tracteur_id IS NULL OR remorque_id IS NULL OR tracteur_id <> remorque_id))
);
CREATE INDEX IF NOT EXISTS tare_references_vehicle_idx ON public.tare_references(vehicle_id, valide_le DESC);
CREATE UNIQUE INDEX IF NOT EXISTS tare_references_validee_uq
  ON public.tare_references(vehicle_id) WHERE statut = 'validee';
COMMENT ON COLUMN public.tare_references.tare_tonnes IS 'Tare de reference en tonnes, validee par l''administrateur KOGON (D-095).';

-- 2. Journal append-only
CREATE TABLE IF NOT EXISTS public.journal_tare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid REFERENCES public.tare_references(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('proposition', 'validation', 'remplacement', 'retrait', 'derogation')),
  avant jsonb,
  apres jsonb NOT NULL,
  motif text NOT NULL CHECK (length(btrim(motif)) > 0),
  auteur uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS journal_tare_vehicle_idx ON public.journal_tare(vehicle_id, le DESC);
ALTER TABLE public.journal_tare ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.journal_tare FROM anon, authenticated;
GRANT SELECT ON public.journal_tare TO authenticated;
GRANT ALL ON public.journal_tare TO service_role;
DROP POLICY IF EXISTS lecture_tare ON public.journal_tare;
CREATE POLICY lecture_tare ON public.journal_tare FOR SELECT TO authenticated
  USING (public.vehicule_permis(vehicle_id));
CREATE OR REPLACE FUNCTION public.garde_journal_tare()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  RAISE EXCEPTION 'Le journal de la tare ne se modifie pas' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS garde_journal_tare ON public.journal_tare;
CREATE TRIGGER garde_journal_tare BEFORE UPDATE OR DELETE ON public.journal_tare
  FOR EACH ROW EXECUTE FUNCTION public.garde_journal_tare();

-- 3. Securite du referentiel : lecture selon le perimeter, ecriture par
-- fonction serveur uniquement.
ALTER TABLE public.tare_references ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tare_references FROM anon, authenticated;
GRANT SELECT ON public.tare_references TO authenticated;
GRANT ALL ON public.tare_references TO service_role;
DROP POLICY IF EXISTS lecture_tare_reference ON public.tare_references;
CREATE POLICY lecture_tare_reference ON public.tare_references FOR SELECT TO authenticated
  USING (public.vehicule_permis(vehicle_id));

CREATE OR REPLACE FUNCTION public.tare_reference_json(p public.tare_references)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('tare_tonnes', p.tare_tonnes, 'tracteur_id', p.tracteur_id,
    'remorque_id', p.remorque_id, 'statut', p.statut, 'motif', p.motif);
$$;
REVOKE EXECUTE ON FUNCTION public.tare_reference_json(public.tare_references) FROM PUBLIC, anon, authenticated;

-- 4. Lecture de la reference applicable a une date. Sans session
-- (maintenance, service_role), le perimeter n'est pas applique.
CREATE OR REPLACE FUNCTION public.tare_applicable(p_vehicle uuid, p_date date DEFAULT current_date)
RETURNS public.tare_references
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.* FROM public.tare_references t
   WHERE t.vehicle_id = p_vehicle AND t.statut = 'validee'
     AND t.valide_le::date <= coalesce(p_date, current_date)
     AND (auth.uid() IS NULL OR public.vehicule_permis(p_vehicle))
   ORDER BY t.valide_le DESC, t.id DESC
   LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.tare_applicable(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tare_applicable(uuid, date) TO authenticated;

-- 5. Proposition par le module flotte
CREATE OR REPLACE FUNCTION public.proposer_tare(
  p_vehicle uuid, p_tare_tonnes numeric, p_tracteur uuid DEFAULT NULL,
  p_remorque uuid DEFAULT NULL, p_motif text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_v public.vehicles;
BEGIN
  IF NOT public.has_module_write('vehicles') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la flotte requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_v FROM public.vehicles WHERE id = p_vehicle;
  IF NOT FOUND OR NOT public.vehicule_permis(p_vehicle) THEN
    RAISE EXCEPTION 'Engin introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_v.vehicle_type::text NOT IN ('tipper', 'flatbed') THEN
    RAISE EXCEPTION 'La tare de reference concerne un camion (tipper ou flatbed)' USING ERRCODE = '22023';
  END IF;
  IF p_tare_tonnes IS NULL OR p_tare_tonnes <= 0 OR p_tare_tonnes >= v_v.capacity_tonnes THEN
    RAISE EXCEPTION 'Tare positive et inferieure a la capacite de l''engin requise' USING ERRCODE = '22023';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif de la proposition obligatoire' USING ERRCODE = '22023';
  END IF;
  IF p_tracteur IS NOT NULL AND NOT public.vehicule_permis(p_tracteur) THEN
    RAISE EXCEPTION 'Tracteur hors perimetre' USING ERRCODE = '42501';
  END IF;
  IF p_remorque IS NOT NULL AND NOT public.vehicule_permis(p_remorque) THEN
    RAISE EXCEPTION 'Remorque hors perimetre' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.tare_references (vehicle_id, tare_tonnes, tracteur_id, remorque_id, statut, motif, propose_par)
  VALUES (p_vehicle, p_tare_tonnes, p_tracteur, p_remorque, 'proposee', v_motif, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.journal_tare (reference_id, vehicle_id, action, apres, motif, auteur)
  VALUES (v_id, p_vehicle, 'proposition',
          public.tare_reference_json((SELECT t FROM public.tare_references t WHERE t.id = v_id)), v_motif, auth.uid());
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.proposer_tare(uuid, numeric, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proposer_tare(uuid, numeric, uuid, uuid, text) TO authenticated;

-- 6. Validation administrative : sauvegarde de l'ancienne version, sans
-- effet retroactif sur les voyages deja figures.
CREATE OR REPLACE FUNCTION public.valider_tare(p_reference uuid, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n public.tare_references; o public.tare_references;
        v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Validation de la tare reserveee a l''administrateur KOGON' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif de validation obligatoire' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO n FROM public.tare_references WHERE id = p_reference FOR UPDATE;
  IF NOT FOUND OR n.statut <> 'proposee' THEN
    RAISE EXCEPTION 'Proposition de tare introuvable ou deja traitee' USING ERRCODE = '22023';
  END IF;
  IF NOT public.vehicule_permis(n.vehicle_id) THEN
    RAISE EXCEPTION 'Engin hors perimetre' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.tare.valider.' || n.vehicle_id::text));
  SELECT * INTO o FROM public.tare_references WHERE vehicle_id = n.vehicle_id AND statut = 'validee' FOR UPDATE;
  IF FOUND THEN
    UPDATE public.tare_references
       SET statut = 'remplacee', retire_par = auth.uid(), retire_le = clock_timestamp()
     WHERE id = o.id;
    INSERT INTO public.journal_tare (reference_id, vehicle_id, action, avant, apres, motif, auteur)
    VALUES (o.id, o.vehicle_id, 'remplacement', public.tare_reference_json(o),
            jsonb_set(public.tare_reference_json(o), '{statut}', '"remplacee"'),
            v_motif, auth.uid());
  END IF;
  UPDATE public.tare_references
     SET statut = 'validee', valide_par = auth.uid(), valide_le = clock_timestamp()
   WHERE id = n.id;
  INSERT INTO public.journal_tare (reference_id, vehicle_id, action, avant, apres, motif, auteur)
  VALUES (n.id, n.vehicle_id, 'validation', public.tare_reference_json(n),
          jsonb_set(jsonb_set(public.tare_reference_json(n), '{statut}', '"validee"'),
                    '{valide_le}', to_jsonb(clock_timestamp()::text)), v_motif, auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.valider_tare(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valider_tare(uuid, text) TO authenticated;

-- 7. Retrait : refuse si une rotation encore ouverte utilise la reference.
CREATE OR REPLACE FUNCTION public.retirer_tare(p_reference uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t public.tare_references; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Retrait de la tare reserve a l''administrateur KOGON' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif de retrait obligatoire' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO t FROM public.tare_references WHERE id = p_reference FOR UPDATE;
  IF NOT FOUND OR t.statut <> 'validee' THEN
    RAISE EXCEPTION 'Tare validee introuvable' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trips x WHERE x.tare_reference_id = t.id
              AND x.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'CANCELLED', 'DISPUTED', 'REJECTED', 'INTERRUPTED')) THEN
    RAISE EXCEPTION 'Rotation ouverte utilisant cette tare : retrait refuse' USING ERRCODE = '22023';
  END IF;
  UPDATE public.tare_references
     SET statut = 'retiree', retire_par = auth.uid(), retire_le = clock_timestamp()
   WHERE id = t.id;
  INSERT INTO public.journal_tare (reference_id, vehicle_id, action, avant, apres, motif, auteur)
  VALUES (t.id, t.vehicle_id, 'retrait', public.tare_reference_json(t),
          jsonb_set(public.tare_reference_json(t), '{statut}', '"retiree"'), v_motif, auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.retirer_tare(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirer_tare(uuid, text) TO authenticated;

-- 8. Derogation explicitement motivee et journalisee : aucune valeur
-- fictive n'est creee, l'absence de tare reste visible.
CREATE OR REPLACE FUNCTION public.constater_tare_manquante(p_trip uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t public.trips; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif de la derogation obligatoire' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = p_trip;
  IF NOT FOUND OR NOT public.voyage_permis(p_trip) THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF t.tare_reference_id IS NOT NULL AND public.tare_applicable(t.vehicle_id, t.planned_date) IS NOT NULL THEN
    RAISE EXCEPTION 'Aucune derogation : une tare validee est applicable' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.journal_tare (vehicle_id, action, apres, motif, auteur)
  VALUES (t.vehicle_id, 'derogation',
          jsonb_build_object('trip_id', t.id, 'reference', t.reference, 'planned_date', t.planned_date,
                             'tare_reference_id', t.tare_reference_id),
          v_motif, auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.constater_tare_manquante(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.constater_tare_manquante(uuid, text) TO authenticated;

-- 9. Figage dans le voyage. La reference est capturee au moment ou le
-- camion est affecte ; une nouvelle version ne modifie pas les voyages
-- deja figures. L'absence est laisseee visible (NULL), jamais inventee.
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS tare_reference_id uuid REFERENCES public.tare_references(id);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS tare_reference_tonnes numeric CHECK (tare_reference_tonnes IS NULL OR tare_reference_tonnes > 0);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS tare_reference_configuration jsonb;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS tare_figee_le timestamptz;
CREATE INDEX IF NOT EXISTS trips_tare_reference_idx ON public.trips(tare_reference_id);
COMMENT ON COLUMN public.trips.tare_reference_tonnes IS 'Tare figee en tonnes a la date du voyage (D-095), jamais recalculee ensuite.';

CREATE OR REPLACE FUNCTION public.figer_tare_voyage()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE t public.tare_references;
BEGIN
  IF NEW.vehicle_id IS NULL THEN
    NEW.tare_reference_id := NULL; NEW.tare_reference_tonnes := NULL;
    NEW.tare_reference_configuration := NULL; NEW.tare_figee_le := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
     OR NEW.planned_date IS DISTINCT FROM OLD.planned_date THEN
    SELECT * INTO t FROM public.tare_applicable(NEW.vehicle_id, NEW.planned_date);
    IF FOUND THEN
      NEW.tare_reference_id := t.id;
      NEW.tare_reference_tonnes := t.tare_tonnes;
      NEW.tare_reference_configuration := jsonb_build_object(
        'tracteur_id', t.tracteur_id, 'remorque_id', t.remorque_id, 'reference_id', t.id);
      NEW.tare_figee_le := clock_timestamp();
    ELSE
      NEW.tare_reference_id := NULL; NEW.tare_reference_tonnes := NULL;
      NEW.tare_reference_configuration := NULL; NEW.tare_figee_le := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS figer_tare_voyage ON public.trips;
CREATE TRIGGER figer_tare_voyage BEFORE INSERT OR UPDATE OF vehicle_id, planned_date ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.figer_tare_voyage();

-- 10. Vue de pilotage de la reference, sans duplication de donnee.
CREATE OR REPLACE VIEW public.v_tare_vehicule WITH (security_invoker = true) AS
SELECT t.id, t.vehicle_id, v.registration, t.tare_tonnes, t.tracteur_id, tr.registration AS tracteur,
       t.remorque_id, re.registration AS remorque, t.statut, t.motif,
       t.propose_le, t.valide_par, t.valide_le, t.retire_par, t.retire_le
  FROM public.tare_references t
  JOIN public.vehicles v ON v.id = t.vehicle_id
  LEFT JOIN public.vehicles tr ON tr.id = t.tracteur_id
  LEFT JOIN public.vehicles re ON re.id = t.remorque_id;
GRANT SELECT ON public.v_tare_vehicule TO authenticated;

-- 11. Voyages dont la tare de reference n'est pas figee : signalement,
-- jamais une valeur par defaut.
CREATE OR REPLACE VIEW public.v_voyages_sans_tare WITH (security_invoker = true) AS
SELECT t.id, t.reference, t.planned_date, t.vehicle_id, v.registration, t.etat
  FROM public.trips t JOIN public.vehicles v ON v.id = t.vehicle_id
 WHERE t.tare_reference_id IS NULL AND t.etat NOT IN ('CANCELLED', 'REJECTED');
GRANT SELECT ON public.v_voyages_sans_tare TO authenticated;

/*
  # Cycle de vie individuel des pneus (D-052, lot 12, module 08)

  1. `tires` devient le registre des pneus. Etat, engin, position et site
     sont un cache tenu par les fonctions serveur a partir du journal ;
     l'ecran ne peut modifier que les champs descriptifs (marque, modele,
     dimension, lot, fournisseur, notes). Les valeurs par defaut fictives
     heritees de Bolt (prix 0, date d'achat du jour, score de sante 100,
     2 rechapages, garantie 365 j) sont retirees : absence = sans donnees.
  2. `pneus_operations`, journal append-only : entree en stock, montage
     (engin, position), demontage (motif, etat : reutilisable ou a
     decider), permutation (echange si la position cible est occupee),
     inspection (profondeur, pression), rechapage (prestataire, cout),
     reparation (pneu a decider remis en stock, cout),
     reforme (motif, definitive), annulation (motif) de la derniere
     operation d'un pneu.
  3. Un seul pneu monte par position d'un engin (index unique partiel).
  4. `v_pneus` : km parcourus (compteur au montage et au demontage, ou
     dernier releve compteur D-045 pour un pneu monte), cout total (achat +
     rechapages et reparations) et cout au km seulement quand toutes les mesures existent.
     `v_pneus_a_surveiller` : profondeur sous le seuil ou inspection en
     retard, seuils parametres par l'administrateur (settings
     `pneu_profondeur_min_mm`, `pneu_inspection_max_jours`) ; sans seuil,
     aucune alerte.

  Ecriture : modules vehicles ou maintenance, perimetre de l'engin (pneu
  monte) ou du site de stockage. Les anciennes tables `tire_*` de Bolt ne
  sont plus utilisees (suppression a decider). Idempotent.
*/

-- 1. Registre
ALTER TABLE public.tires ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
ALTER TABLE public.tires ADD COLUMN IF NOT EXISTS fournisseur_id uuid REFERENCES public.suppliers(id);
ALTER TABLE public.tires ADD COLUMN IF NOT EXISTS dimension text;
ALTER TABLE public.tires ALTER COLUMN purchase_price DROP NOT NULL, ALTER COLUMN purchase_price DROP DEFAULT;
ALTER TABLE public.tires ALTER COLUMN purchase_date DROP NOT NULL, ALTER COLUMN purchase_date DROP DEFAULT;
ALTER TABLE public.tires ALTER COLUMN health_score DROP DEFAULT;
ALTER TABLE public.tires ALTER COLUMN max_retreads DROP DEFAULT;
ALTER TABLE public.tires ALTER COLUMN warranty_days DROP DEFAULT;
CREATE INDEX IF NOT EXISTS idx_tires_site ON public.tires(site_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tires_position_montee ON public.tires(vehicle_id, "position")
  WHERE status = 'active' AND vehicle_id IS NOT NULL AND "position" IS NOT NULL;

-- Perimetre d'un pneu : engin s'il est monte, sinon site de stockage.
CREATE OR REPLACE FUNCTION public.pneu_permis(p_vehicle uuid, p_site uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN p_vehicle IS NOT NULL THEN public.vehicule_permis(p_vehicle) ELSE public.site_permis(p_site) END;
$$;
REVOKE EXECUTE ON FUNCTION public.pneu_permis(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pneu_permis(uuid, uuid) TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE ON public.tires FROM anon, authenticated;
GRANT SELECT ON public.tires TO authenticated;
GRANT UPDATE (brand, model, dimension, lot_code, fournisseur_id, notes) ON public.tires TO authenticated;
DROP POLICY IF EXISTS "Admins full access" ON public.tires;
DROP POLICY IF EXISTS ecriture_module ON public.tires;
DROP POLICY IF EXISTS lecture_module ON public.tires;
CREATE POLICY lecture_module ON public.tires FOR SELECT TO authenticated
  USING ((public.has_module_view('vehicles') OR public.has_module_view('maintenance') OR public.is_admin())
         AND public.pneu_permis(vehicle_id, site_id));
DROP POLICY IF EXISTS description ON public.tires;
CREATE POLICY description ON public.tires FOR UPDATE TO authenticated
  USING ((public.has_module_write('vehicles') OR public.has_module_write('maintenance') OR public.is_admin())
         AND public.pneu_permis(vehicle_id, site_id))
  WITH CHECK (public.pneu_permis(vehicle_id, site_id));

-- 2. Journal
CREATE TABLE IF NOT EXISTS public.pneus_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid NOT NULL REFERENCES public.tires(id),
  type text NOT NULL CHECK (type IN ('entree', 'montage', 'demontage', 'permutation', 'inspection', 'rechapage', 'reparation', 'reforme', 'annulation')),
  effectue_le timestamptz NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id),
  "position" text,
  position_precedente text,
  site_id uuid REFERENCES public.sites(id),
  compteur_km numeric CHECK (compteur_km IS NULL OR compteur_km >= 0),
  profondeur_mm numeric CHECK (profondeur_mm IS NULL OR profondeur_mm >= 0),
  pression_bar numeric CHECK (pression_bar IS NULL OR pression_bar > 0),
  etat_sortie text CHECK (etat_sortie IS NULL OR etat_sortie IN ('stored', 'damaged')),
  cout bigint CHECK (cout IS NULL OR cout >= 0),
  prestataire text,
  reference_piece text,
  motif text,
  note text,
  operation_liee_id uuid REFERENCES public.pneus_operations(id),
  annule_operation_id uuid UNIQUE REFERENCES public.pneus_operations(id),
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((type = 'annulation') = (annule_operation_id IS NOT NULL)),
  CHECK (type NOT IN ('montage', 'permutation') OR (vehicle_id IS NOT NULL AND "position" IS NOT NULL)),
  CHECK (type NOT IN ('demontage', 'reforme', 'annulation') OR nullif(btrim(coalesce(motif, '')), '') IS NOT NULL),
  CHECK ((type = 'demontage') = (etat_sortie IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_pneus_operations_pneu ON public.pneus_operations(tire_id, effectue_le);
CREATE INDEX IF NOT EXISTS idx_pneus_operations_engin ON public.pneus_operations(vehicle_id);

ALTER TABLE public.pneus_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pneus_operations FROM anon, authenticated;
GRANT SELECT ON public.pneus_operations TO authenticated;
GRANT ALL ON public.pneus_operations TO service_role;
DROP POLICY IF EXISTS lecture ON public.pneus_operations;
CREATE POLICY lecture ON public.pneus_operations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tires t WHERE t.id = tire_id));

CREATE OR REPLACE FUNCTION public.garde_pneus_operations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  RAISE EXCEPTION 'Journal des pneus : une operation ne se modifie pas, elle s''annule' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS garde_pneus_operations ON public.pneus_operations;
CREATE TRIGGER garde_pneus_operations BEFORE UPDATE OR DELETE ON public.pneus_operations
  FOR EACH ROW EXECUTE FUNCTION public.garde_pneus_operations();

CREATE OR REPLACE VIEW public.v_pneus_operations_effectives WITH (security_invoker = true) AS
SELECT o.* FROM public.pneus_operations o
 WHERE o.type <> 'annulation'
   AND NOT EXISTS (SELECT 1 FROM public.pneus_operations a WHERE a.annule_operation_id = o.id);
GRANT SELECT ON public.v_pneus_operations_effectives TO authenticated;

-- 3. Fonctions internes
CREATE OR REPLACE FUNCTION public.normaliser_position_pneu(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT nullif(upper(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')), '');
$$;
GRANT EXECUTE ON FUNCTION public.normaliser_position_pneu(text) TO authenticated;

-- Recalcule le cache du registre depuis le journal effectif.
CREATE OR REPLACE FUNCTION public.recalculer_pneu(p_tire uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.pneus_operations; v_status text; v_vehicle uuid; v_pos text; v_site uuid;
BEGIN
  SELECT o.* INTO e FROM public.pneus_operations o
   WHERE o.tire_id = p_tire AND o.type IN ('entree', 'montage', 'demontage', 'permutation', 'rechapage', 'reparation', 'reforme')
     AND NOT EXISTS (SELECT 1 FROM public.pneus_operations a WHERE a.annule_operation_id = o.id)
   ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  v_status := CASE e.type WHEN 'montage' THEN 'active' WHEN 'permutation' THEN 'active'
                          WHEN 'demontage' THEN e.etat_sortie WHEN 'reforme' THEN 'retired' ELSE 'stored' END;
  v_vehicle := CASE WHEN v_status = 'active' THEN e.vehicle_id END;
  v_pos := CASE WHEN v_status = 'active' THEN e."position" END;
  v_site := CASE WHEN v_status = 'active' THEN NULL ELSE e.site_id END;
  IF v_status = 'active' AND EXISTS (SELECT 1 FROM public.tires t WHERE t.id <> p_tire AND t.status = 'active'
                                        AND t.vehicle_id = v_vehicle AND t."position" = v_pos) THEN
    RAISE EXCEPTION 'Position % deja occupee sur cet engin', v_pos USING ERRCODE = '22023';
  END IF;
  UPDATE public.tires t SET
    status = v_status, vehicle_id = v_vehicle, "position" = v_pos, site_id = v_site,
    installation_date = (SELECT max(o.effectue_le)::date FROM public.v_pneus_operations_effectives o
                          WHERE o.tire_id = p_tire AND o.type = 'montage'),
    removal_date = CASE WHEN v_status = 'active' THEN NULL ELSE
                     (SELECT max(o.effectue_le)::date FROM public.v_pneus_operations_effectives o
                       WHERE o.tire_id = p_tire AND o.type = 'demontage') END,
    retread_count = (SELECT count(*)::int FROM public.v_pneus_operations_effectives o
                      WHERE o.tire_id = p_tire AND o.type = 'rechapage'),
    last_inspection_date = (SELECT max(o.effectue_le)::date FROM public.v_pneus_operations_effectives o
                             WHERE o.tire_id = p_tire AND o.type = 'inspection'),
    updated_at = now()
   WHERE t.id = p_tire;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalculer_pneu(uuid) FROM PUBLIC, anon, authenticated;

-- Verrouille le pneu et controle droit, perimetre et chronologie.
CREATE OR REPLACE FUNCTION public.pneu_pour_operation(p_tire uuid, p_date timestamptz)
RETURNS public.tires
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_dernier timestamptz;
BEGIN
  IF NOT (public.has_module_write('vehicles') OR public.has_module_write('maintenance') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la flotte ou la maintenance requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.tires WHERE id = p_tire FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pneu introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT public.pneu_permis(t.vehicle_id, t.site_id) THEN
    RAISE EXCEPTION 'Pneu hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date de l''operation requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  SELECT max(o.effectue_le) INTO v_dernier FROM public.v_pneus_operations_effectives o WHERE o.tire_id = p_tire;
  IF v_dernier IS NOT NULL AND p_date < v_dernier THEN
    RAISE EXCEPTION 'Date anterieure a la derniere operation du pneu (%)', to_char(v_dernier, 'DD/MM/YYYY HH24:MI')
      USING ERRCODE = '22023';
  END IF;
  RETURN t;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pneu_pour_operation(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- Compteur au montage en cours (NULL si inconnu).
CREATE OR REPLACE FUNCTION public.km_montage_en_cours(p_tire uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.compteur_km FROM public.v_pneus_operations_effectives o
   WHERE o.tire_id = p_tire AND o.type = 'montage' ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.km_montage_en_cours(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.site_stock_pneu(p_site uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_site IS NULL OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = p_site) THEN
    RAISE EXCEPTION 'Site de stockage requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site) THEN
    RAISE EXCEPTION 'Site hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.site_stock_pneu(uuid) FROM PUBLIC, anon, authenticated;

-- 4. Operations
CREATE OR REPLACE FUNCTION public.enregistrer_pneu(
  p_numero text, p_marque text, p_modele text, p_site uuid, p_dimension text DEFAULT NULL,
  p_date_achat date DEFAULT NULL, p_prix_achat bigint DEFAULT NULL, p_fournisseur uuid DEFAULT NULL,
  p_profondeur_mm numeric DEFAULT NULL, p_rechapages_max integer DEFAULT NULL,
  p_reference text DEFAULT NULL, p_note text DEFAULT NULL, p_date timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_numero text := nullif(upper(btrim(coalesce(p_numero, ''))), '');
BEGIN
  IF NOT (public.has_module_write('vehicles') OR public.has_module_write('maintenance') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la flotte ou la maintenance requis' USING ERRCODE = '42501';
  END IF;
  IF v_numero IS NULL OR nullif(btrim(coalesce(p_marque, '')), '') IS NULL OR nullif(btrim(coalesce(p_modele, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Numero, marque et modele requis' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tires WHERE upper(tire_number) = v_numero) THEN
    RAISE EXCEPTION 'Pneu % deja enregistre', v_numero USING ERRCODE = '23505';
  END IF;
  PERFORM public.site_stock_pneu(p_site);
  IF p_prix_achat IS NOT NULL AND p_prix_achat < 0 THEN RAISE EXCEPTION 'Prix d''achat positif ou absent' USING ERRCODE = '22023'; END IF;
  IF p_rechapages_max IS NOT NULL AND p_rechapages_max < 0 THEN RAISE EXCEPTION 'Nombre de rechapages positif ou absent' USING ERRCODE = '22023'; END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date d''entree requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_date_achat IS NOT NULL AND p_date_achat > p_date::date THEN
    RAISE EXCEPTION 'Date d''achat posterieure a l''entree en stock' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.tires (tire_number, brand, model, dimension, purchase_date, purchase_price, fournisseur_id,
                            status, site_id, retread_count, max_retreads, notes)
  VALUES (v_numero, btrim(p_marque), btrim(p_modele), nullif(btrim(coalesce(p_dimension, '')), ''), p_date_achat, p_prix_achat,
          p_fournisseur, 'stored', p_site, 0, p_rechapages_max, nullif(btrim(coalesce(p_note, '')), ''))
  RETURNING id INTO v_id;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, profondeur_mm, reference_piece, saisi_par)
  VALUES (v_id, 'entree', p_date, p_site, p_profondeur_mm, nullif(btrim(coalesce(p_reference, '')), ''), auth.uid());
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.monter_pneu(
  p_tire uuid, p_vehicle uuid, p_position text, p_date timestamptz DEFAULT now(), p_km numeric DEFAULT NULL,
  p_profondeur_mm numeric DEFAULT NULL, p_pression_bar numeric DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_pos text := public.normaliser_position_pneu(p_position); v_id uuid;
BEGIN
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status <> 'stored' THEN
    RAISE EXCEPTION 'Seul un pneu en stock et reutilisable se monte (etat : %)', t.status USING ERRCODE = '22023';
  END IF;
  IF p_vehicle IS NULL OR NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicle) THEN
    RAISE EXCEPTION 'Engin requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.vehicule_permis(p_vehicle) THEN RAISE EXCEPTION 'Engin hors de votre perimetre' USING ERRCODE = '42501'; END IF;
  IF v_pos IS NULL THEN RAISE EXCEPTION 'Position requise' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", site_id, compteur_km,
                                       profondeur_mm, pression_bar, note, saisi_par)
  VALUES (p_tire, 'montage', p_date, p_vehicle, v_pos, t.site_id, p_km, p_profondeur_mm, p_pression_bar,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.demonter_pneu(
  p_tire uuid, p_motif text, p_etat text, p_site uuid, p_date timestamptz DEFAULT now(), p_km numeric DEFAULT NULL,
  p_profondeur_mm numeric DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_km_montage numeric; v_id uuid;
BEGIN
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status <> 'active' THEN RAISE EXCEPTION 'Le pneu n''est pas monte' USING ERRCODE = '22023'; END IF;
  IF p_etat NOT IN ('stored', 'damaged') THEN
    RAISE EXCEPTION 'Etat au demontage : reutilisable (stored) ou a decider (damaged)' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif du demontage requis' USING ERRCODE = '22023'; END IF;
  PERFORM public.site_stock_pneu(p_site);
  v_km_montage := public.km_montage_en_cours(p_tire);
  IF p_km IS NOT NULL AND v_km_montage IS NOT NULL AND p_km < v_km_montage THEN
    RAISE EXCEPTION 'Compteur au demontage (%) inferieur au compteur au montage (%)', p_km, v_km_montage USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", site_id, compteur_km,
                                       profondeur_mm, etat_sortie, motif, note, saisi_par)
  VALUES (p_tire, 'demontage', p_date, t.vehicle_id, t."position", p_site, p_km, p_profondeur_mm, p_etat,
          btrim(p_motif), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  RETURN v_id;
END;
$$;

-- Permutation sur le meme engin ; si la position cible est occupee, les
-- deux pneus echangent leurs positions (deux operations liees).
CREATE OR REPLACE FUNCTION public.permuter_pneu(
  p_tire uuid, p_position text, p_date timestamptz DEFAULT now(), p_km numeric DEFAULT NULL, p_motif text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; autre public.tires; v_pos text := public.normaliser_position_pneu(p_position); v_id uuid; v_id2 uuid;
        v_km_montage numeric;
BEGIN
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status <> 'active' THEN RAISE EXCEPTION 'Le pneu n''est pas monte' USING ERRCODE = '22023'; END IF;
  IF v_pos IS NULL OR v_pos = t."position" THEN RAISE EXCEPTION 'Nouvelle position requise' USING ERRCODE = '22023'; END IF;
  v_km_montage := public.km_montage_en_cours(p_tire);
  IF p_km IS NOT NULL AND v_km_montage IS NOT NULL AND p_km < v_km_montage THEN
    RAISE EXCEPTION 'Compteur (%) inferieur au compteur au montage (%)', p_km, v_km_montage USING ERRCODE = '22023';
  END IF;
  SELECT * INTO autre FROM public.tires WHERE vehicle_id = t.vehicle_id AND "position" = v_pos AND status = 'active' FOR UPDATE;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", position_precedente, compteur_km, motif, saisi_par)
  VALUES (p_tire, 'permutation', p_date, t.vehicle_id, v_pos, t."position", p_km, nullif(btrim(coalesce(p_motif, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  IF autre.id IS NOT NULL THEN
    PERFORM public.pneu_pour_operation(autre.id, p_date);
    INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", position_precedente, compteur_km,
                                         motif, operation_liee_id, saisi_par)
    VALUES (autre.id, 'permutation', p_date, t.vehicle_id, t."position", v_pos, p_km, nullif(btrim(coalesce(p_motif, '')), ''), v_id, auth.uid())
    RETURNING id INTO v_id2;
    -- Liberation des deux positions avant recalcul (index unique non differable).
    UPDATE public.tires SET "position" = NULL WHERE id IN (p_tire, autre.id);
    PERFORM public.recalculer_pneu(autre.id);
  END IF;
  PERFORM public.recalculer_pneu(p_tire);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.inspecter_pneu(
  p_tire uuid, p_date timestamptz DEFAULT now(), p_profondeur_mm numeric DEFAULT NULL, p_pression_bar numeric DEFAULT NULL,
  p_km numeric DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_id uuid;
BEGIN
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status = 'retired' THEN RAISE EXCEPTION 'Pneu reforme' USING ERRCODE = '22023'; END IF;
  IF p_profondeur_mm IS NULL AND p_pression_bar IS NULL THEN
    RAISE EXCEPTION 'Profondeur ou pression requise' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, vehicle_id, "position", site_id, compteur_km,
                                       profondeur_mm, pression_bar, note, saisi_par)
  VALUES (p_tire, 'inspection', p_date, t.vehicle_id, t."position", t.site_id, p_km, p_profondeur_mm, p_pression_bar,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rechaper_pneu(
  p_tire uuid, p_prestataire text, p_site uuid, p_date timestamptz DEFAULT now(), p_cout bigint DEFAULT NULL,
  p_profondeur_mm numeric DEFAULT NULL, p_reference text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_faits integer; v_id uuid;
BEGIN
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status NOT IN ('stored', 'damaged') THEN RAISE EXCEPTION 'Seul un pneu demonte se rechape' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_prestataire, '')), '') IS NULL THEN RAISE EXCEPTION 'Prestataire du rechapage requis' USING ERRCODE = '22023'; END IF;
  IF p_cout IS NOT NULL AND p_cout < 0 THEN RAISE EXCEPTION 'Cout positif ou absent' USING ERRCODE = '22023'; END IF;
  PERFORM public.site_stock_pneu(p_site);
  SELECT count(*) INTO v_faits FROM public.v_pneus_operations_effectives o WHERE o.tire_id = p_tire AND o.type = 'rechapage';
  IF t.max_retreads IS NOT NULL AND v_faits >= t.max_retreads THEN
    RAISE EXCEPTION 'Nombre maximal de rechapages atteint (%)', t.max_retreads USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, profondeur_mm, cout, prestataire, reference_piece, note, saisi_par)
  VALUES (p_tire, 'rechapage', p_date, p_site, p_profondeur_mm, p_cout, btrim(p_prestataire),
          nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reparer_pneu(
  p_tire uuid, p_site uuid, p_date timestamptz DEFAULT now(), p_cout bigint DEFAULT NULL, p_prestataire text DEFAULT NULL,
  p_profondeur_mm numeric DEFAULT NULL, p_reference text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_id uuid;
BEGIN
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status <> 'damaged' THEN RAISE EXCEPTION 'Seul un pneu a decider se repare' USING ERRCODE = '22023'; END IF;
  IF p_cout IS NOT NULL AND p_cout < 0 THEN RAISE EXCEPTION 'Cout positif ou absent' USING ERRCODE = '22023'; END IF;
  PERFORM public.site_stock_pneu(p_site);
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, profondeur_mm, cout, prestataire, reference_piece, note, saisi_par)
  VALUES (p_tire, 'reparation', p_date, p_site, p_profondeur_mm, p_cout, nullif(btrim(coalesce(p_prestataire, '')), ''),
          nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reformer_pneu(p_tire uuid, p_motif text, p_date timestamptz DEFAULT now())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.tires; v_id uuid;
BEGIN
  t := public.pneu_pour_operation(p_tire, p_date);
  IF t.status NOT IN ('stored', 'damaged') THEN RAISE EXCEPTION 'Demonter le pneu avant de le reformer' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de la reforme requis' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.pneus_operations (tire_id, type, effectue_le, site_id, motif, saisi_par)
  VALUES (p_tire, 'reforme', p_date, t.site_id, btrim(p_motif), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_pneu(p_tire);
  RETURN v_id;
END;
$$;

-- Annulation motivee de la derniere operation d'un pneu (une permutation
-- echangee est annulee avec l'operation liee). L'entree ne s'annule pas :
-- un pneu enregistre par erreur se reforme avec motif.
CREATE OR REPLACE FUNCTION public.annuler_operation_pneu(p_operation uuid, p_motif text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE o public.pneus_operations; v_ids uuid[]; v_op uuid; v_tire uuid; v_dernier uuid;
BEGIN
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM public.pneus_operations WHERE id = p_operation;
  IF NOT FOUND OR o.type = 'annulation' OR EXISTS (SELECT 1 FROM public.pneus_operations a WHERE a.annule_operation_id = o.id) THEN
    RAISE EXCEPTION 'Operation introuvable ou deja annulee' USING ERRCODE = '22023';
  END IF;
  IF o.type = 'entree' THEN
    RAISE EXCEPTION 'L''entree en stock ne s''annule pas : reformer le pneu avec motif' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(x.id) INTO v_ids FROM public.pneus_operations x
   WHERE x.id = o.id OR x.id = o.operation_liee_id OR x.operation_liee_id = o.id;
  FOREACH v_op IN ARRAY v_ids LOOP
    SELECT tire_id INTO v_tire FROM public.pneus_operations WHERE id = v_op;
    PERFORM public.pneu_pour_operation(v_tire, now());
    SELECT e.id INTO v_dernier FROM public.v_pneus_operations_effectives e
     WHERE e.tire_id = v_tire ORDER BY e.effectue_le DESC, e.saisi_le DESC LIMIT 1;
    IF v_dernier IS DISTINCT FROM v_op THEN
      RAISE EXCEPTION 'Seule la derniere operation d''un pneu s''annule' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOREACH v_op IN ARRAY v_ids LOOP
    SELECT tire_id INTO v_tire FROM public.pneus_operations WHERE id = v_op;
    INSERT INTO public.pneus_operations (tire_id, type, effectue_le, motif, annule_operation_id, saisi_par)
    VALUES (v_tire, 'annulation', now(), btrim(p_motif), v_op, auth.uid());
  END LOOP;
  UPDATE public.tires SET "position" = NULL
   WHERE id IN (SELECT tire_id FROM public.pneus_operations WHERE id = ANY (v_ids)) AND status = 'active';
  FOR v_tire IN SELECT DISTINCT tire_id FROM public.pneus_operations WHERE id = ANY (v_ids) LOOP
    PERFORM public.recalculer_pneu(v_tire);
  END LOOP;
  RETURN array_length(v_ids, 1);
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'enregistrer_pneu(text, text, text, uuid, text, date, bigint, uuid, numeric, integer, text, text, timestamptz)',
    'monter_pneu(uuid, uuid, text, timestamptz, numeric, numeric, numeric, text)',
    'demonter_pneu(uuid, text, text, uuid, timestamptz, numeric, numeric, text)',
    'permuter_pneu(uuid, text, timestamptz, numeric, text)',
    'inspecter_pneu(uuid, timestamptz, numeric, numeric, numeric, text)',
    'rechaper_pneu(uuid, text, uuid, timestamptz, bigint, numeric, text, text)',
    'reparer_pneu(uuid, uuid, timestamptz, bigint, text, numeric, text, text)',
    'reformer_pneu(uuid, text, timestamptz)',
    'annuler_operation_pneu(uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- 5. Indicateurs
-- Seuils parametres (settings n'est lisible que par l'administrateur).
CREATE OR REPLACE FUNCTION public.seuil_pneus(p_cle text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN (s.value ->> 'value') ~ '^\d+(\.\d+)?$' THEN (s.value ->> 'value')::numeric END
    FROM public.settings s
   WHERE s.key = p_cle AND p_cle IN ('pneu_profondeur_min_mm', 'pneu_inspection_max_jours');
$$;
REVOKE EXECUTE ON FUNCTION public.seuil_pneus(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seuil_pneus(text) TO authenticated;

-- Montages effectifs et km parcourus (NULL si un compteur manque).
CREATE OR REPLACE VIEW public.v_pneus_montages WITH (security_invoker = true) AS
SELECT m.tire_id, m.id AS montage_id, m.vehicle_id, m.effectue_le AS monte_le, m.compteur_km AS km_montage,
       d.effectue_le AS demonte_le, d.compteur_km AS km_demontage, r.valeur_km AS km_dernier_releve, r.releve_le AS dernier_releve_le,
       CASE WHEN m.compteur_km IS NULL THEN NULL
            WHEN d.id IS NOT NULL THEN d.compteur_km - m.compteur_km
            WHEN r.valeur_km IS NOT NULL AND r.valeur_km >= m.compteur_km THEN r.valeur_km - m.compteur_km END AS km_parcourus
  FROM public.v_pneus_operations_effectives m
  LEFT JOIN LATERAL (
    SELECT o.id, o.effectue_le, o.compteur_km FROM public.v_pneus_operations_effectives o
     WHERE o.tire_id = m.tire_id AND o.type = 'demontage' AND (o.effectue_le, o.saisi_le) > (m.effectue_le, m.saisi_le)
     ORDER BY o.effectue_le, o.saisi_le LIMIT 1) d ON true
  LEFT JOIN LATERAL (
    SELECT c.valeur_km, c.releve_le FROM public.v_releves_compteur c
     WHERE d.id IS NULL AND c.vehicle_id = m.vehicle_id AND c.releve_le >= m.effectue_le
     ORDER BY c.releve_le DESC LIMIT 1) r ON true
 WHERE m.type = 'montage';
GRANT SELECT ON public.v_pneus_montages TO authenticated;

CREATE OR REPLACE VIEW public.v_pneus WITH (security_invoker = true) AS
SELECT t.id, t.tire_number, t.brand, t.model, t.dimension, t.status, t.vehicle_id, t."position", t.site_id,
       t.purchase_date, t.purchase_price, t.fournisseur_id, t.retread_count, t.max_retreads, t.installation_date,
       t.last_inspection_date, t.notes,
       km.nb_montages, km.km_parcourus, coalesce(km.km_incomplet, false) AS km_incomplet,
       rc.cout_rechapages,
       CASE WHEN t.purchase_price IS NOT NULL THEN t.purchase_price + coalesce(rc.cout_rechapages, 0) END AS cout_total,
       CASE WHEN t.purchase_price IS NOT NULL AND NOT coalesce(km.km_incomplet, false) AND km.km_parcourus > 0
            AND NOT coalesce(rc.cout_inconnu, false)
            THEN round((t.purchase_price + coalesce(rc.cout_rechapages, 0)) / km.km_parcourus, 2) END AS cout_km,
       p.profondeur_mm AS derniere_profondeur_mm, p.effectue_le AS profondeur_mesuree_le
  FROM public.tires t
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS nb_montages, sum(m.km_parcourus) AS km_parcourus, bool_or(m.km_parcourus IS NULL) AS km_incomplet
      FROM public.v_pneus_montages m WHERE m.tire_id = t.id) km ON true
  LEFT JOIN LATERAL (
    SELECT sum(o.cout) AS cout_rechapages, bool_or(o.cout IS NULL) AS cout_inconnu
      FROM public.v_pneus_operations_effectives o WHERE o.tire_id = t.id AND o.type IN ('rechapage', 'reparation')) rc ON true
  LEFT JOIN LATERAL (
    SELECT o.profondeur_mm, o.effectue_le FROM public.v_pneus_operations_effectives o
     WHERE o.tire_id = t.id AND o.profondeur_mm IS NOT NULL ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1) p ON true;
GRANT SELECT ON public.v_pneus TO authenticated;

CREATE OR REPLACE VIEW public.v_pneus_a_surveiller WITH (security_invoker = true) AS
SELECT v.id, v.tire_number, v.status, v.vehicle_id, v."position", v.site_id, v.derniere_profondeur_mm,
       v.last_inspection_date, v.installation_date,
       CASE WHEN v.derniere_profondeur_mm < public.seuil_pneus('pneu_profondeur_min_mm') THEN 'profondeur'
            ELSE 'inspection' END AS motif
  FROM public.v_pneus v
 WHERE v.status <> 'retired'
   AND (v.derniere_profondeur_mm < public.seuil_pneus('pneu_profondeur_min_mm')
        OR (v.status = 'active' AND public.seuil_pneus('pneu_inspection_max_jours') IS NOT NULL
            AND greatest(v.last_inspection_date, v.installation_date)
                < current_date - public.seuil_pneus('pneu_inspection_max_jours')::int));
GRANT SELECT ON public.v_pneus_a_surveiller TO authenticated;

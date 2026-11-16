/*
  # Correctifs de la revue independante a posteriori (D-072), partie 4 :
  # D-059 a D-062 (constats R4)

  Les fonctions remplacees reprennent leur corps exact ; seuls les controles
  indiques s'ajoutent.

  - R4-1 (D-061) : ordre_travail_permis exige a la fois le site de l'ordre et
    l'engin dans le perimetre ; politiques de maintenance_orders recreees
    sur cette regle ; un ordre ne porte pas un site different de celui de
    son engin.
  - R4-2 (D-061) : l'annulation d'un mouvement de pieces impute a un ordre
    exige l'ordre ouvert ou en cours et porte l'ordre (garde
    garde_annulation_mouvement_ordre) ; une sortie couverte par des retours
    ne s'annule pas.
  - R4-3 (D-061) : engin et site d'un ordre figes des qu'une piece y est
    imputee.
  - R4-4 (D-059) : un bon issu d'une consultation garde le fournisseur de
    l'offre retenue, et ne se soumet que si le montant de ses lignes egale
    celui de l'offre.
  - R4-5 (D-059) : definir_categorie_fournisseur reserve a l'administrateur.
  - R4-6 (D-061) : acquittement, resolution et lecture des alertes de
    georeperage horodates par le serveur (auteur = compte connecte) ;
    auteur d'une zone non modifiable.
  - R4-7 (D-059) : selectionner_offre relit l'offre sous verrou apres celui
    de la consultation.
  - R4-8 (D-059) : unicite de la raison sociale et de l'identifiant fiscal
    garantie par index (verifiee avant creation).
  - R4-9 (D-061, D-062) : TRUNCATE retire a anon et authenticated sur toutes
    les tables du schema public (et pour les tables futures), droits anon
    retires sur les vues.

  Idempotent.
*/

-- R4-1 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ordre_travail_permis(p_site uuid, p_vehicle uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN p_site IS NULL AND p_vehicle IS NULL THEN public.site_permis(NULL)
              ELSE (p_site IS NULL OR public.site_permis(p_site)) AND (p_vehicle IS NULL OR public.vehicule_permis(p_vehicle)) END;
$$;
REVOKE EXECUTE ON FUNCTION public.ordre_travail_permis(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ordre_travail_permis(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS lecture_module ON public.maintenance_orders;
CREATE POLICY lecture_module ON public.maintenance_orders FOR SELECT TO authenticated
  USING ((public.has_module_view('maintenance') OR public.is_admin()) AND public.ordre_travail_permis(site_id, vehicle_id));
DROP POLICY IF EXISTS ecriture_module ON public.maintenance_orders;
CREATE POLICY ecriture_module ON public.maintenance_orders FOR ALL TO authenticated
  USING ((public.has_module_write('maintenance') OR public.is_admin()) AND public.ordre_travail_permis(site_id, vehicle_id))
  WITH CHECK ((public.has_module_write('maintenance') OR public.is_admin()) AND public.ordre_travail_permis(site_id, vehicle_id));

-- R4-1, R4-3 : coherence site et engin, figes apres imputation de pieces.
CREATE OR REPLACE FUNCTION public.garde_ordre_travail()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF (TG_OP = 'INSERT' OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR NEW.site_id IS DISTINCT FROM OLD.site_id)
     AND NEW.site_id IS NOT NULL AND NEW.vehicle_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = NEW.vehicle_id AND v.site_id IS NOT NULL AND v.site_id <> NEW.site_id) THEN
    RAISE EXCEPTION 'Le site de l''ordre differe du site de l''engin' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF coalesce(NEW.status::text, 'open') NOT IN ('open', 'in_progress') THEN
      RAISE EXCEPTION 'Un ordre de travail se cree ouvert ou en cours' USING ERRCODE = '22023';
    END IF;
    NEW.requested_by := auth.uid();
    RETURN NEW;
  END IF;
  -- Seule annuler_ordre_travail ecrit annule_le (colonne non ouverte au navigateur).
  IF OLD.annule_le IS NULL AND NEW.annule_le IS NOT NULL AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF NEW.work_order_number IS DISTINCT FROM OLD.work_order_number THEN
    RAISE EXCEPTION 'Le numero d''un ordre de travail ne se modifie pas' USING ERRCODE = '42501';
  END IF;
  IF (NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR NEW.site_id IS DISTINCT FROM OLD.site_id)
     AND EXISTS (SELECT 1 FROM public.stock_movements m WHERE m.maintenance_order_id = OLD.id) THEN
    RAISE EXCEPTION 'Des pieces sont imputees a l''ordre % : engin et site ne changent plus', OLD.work_order_number
      USING ERRCODE = '22023';
  END IF;
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Ordre % annule : il ne se modifie plus', OLD.work_order_number USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'cancelled' THEN
    RAISE EXCEPTION 'L''annulation d''un ordre passe par annuler_ordre_travail (motif obligatoire)' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    RAISE EXCEPTION 'Un ordre termine ne se rouvre pas : creez un nouvel ordre' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_ordre_travail() FROM PUBLIC, anon, authenticated;

-- R4-2 : annulation d'un mouvement de pieces d'un ordre.
CREATE OR REPLACE FUNCTION public.garde_annulation_mouvement_ordre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m public.stock_movements; o public.maintenance_orders;
BEGIN
  IF NEW.movement_type <> 'annulation' OR NEW.annule_mouvement_id IS NULL OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO m FROM public.stock_movements WHERE id = NEW.annule_mouvement_id;
  IF NOT FOUND OR m.maintenance_order_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO o FROM public.maintenance_orders WHERE id = m.maintenance_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordre de travail introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT ((public.has_module_view('maintenance') OR public.is_admin()) AND public.ordre_travail_permis(o.site_id, o.vehicle_id)) THEN
    RAISE EXCEPTION 'Hors perimetre : ordre de travail non accessible' USING ERRCODE = '42501';
  END IF;
  IF o.status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION 'Ordre % termine ou annule : ses mouvements de pieces ne s''annulent plus', o.work_order_number
      USING ERRCODE = '22023';
  END IF;
  IF m.movement_type = 'exit' AND public.pieces_nettes_ordre(o.id, m.stock_item_id) - m.quantity < 0 THEN
    RAISE EXCEPTION 'Sortie deja couverte par des retours sur l''ordre % : annulez d''abord les retours', o.work_order_number
      USING ERRCODE = '22023';
  END IF;
  NEW.maintenance_order_id := m.maintenance_order_id;
  NEW.vehicle_id := coalesce(NEW.vehicle_id, m.vehicle_id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_annulation_mouvement_ordre() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_annulation_mouvement_ordre ON public.stock_movements;
CREATE TRIGGER garde_annulation_mouvement_ordre BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.garde_annulation_mouvement_ordre();

-- L'annulation rattachee a l'ordre est controlee par la garde ci-dessus.
CREATE OR REPLACE FUNCTION public.garde_mouvement_ordre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE o public.maintenance_orders; v_net integer;
BEGIN
  IF NEW.maintenance_order_id IS NULL OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.movement_type = 'annulation' AND NEW.annule_mouvement_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.stock_movements a WHERE a.id = NEW.annule_mouvement_id
                    AND a.maintenance_order_id = NEW.maintenance_order_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.movement_type NOT IN ('exit', 'return') THEN
    RAISE EXCEPTION 'Seules une sortie ou un retour de piece se rattachent a un ordre de travail' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO o FROM public.maintenance_orders WHERE id = NEW.maintenance_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordre de travail introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT ((public.has_module_view('maintenance') OR public.is_admin()) AND public.ordre_travail_permis(o.site_id, o.vehicle_id)) THEN
    RAISE EXCEPTION 'Hors perimetre : ordre de travail non accessible' USING ERRCODE = '42501';
  END IF;
  IF o.status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION 'Ordre % termine ou annule : aucune piece ne s''y impute', o.work_order_number USING ERRCODE = '22023';
  END IF;
  IF NEW.vehicle_id IS NULL THEN
    NEW.vehicle_id := o.vehicle_id;
  ELSIF o.vehicle_id IS NOT NULL AND NEW.vehicle_id <> o.vehicle_id THEN
    RAISE EXCEPTION 'L''engin du mouvement differe de celui de l''ordre' USING ERRCODE = '22023';
  END IF;
  IF NEW.movement_type = 'return' THEN
    v_net := public.pieces_nettes_ordre(o.id, NEW.stock_item_id);
    IF NEW.quantity > v_net THEN
      RAISE EXCEPTION 'Retour superieur aux pieces sorties pour cet ordre (% imputee(s))', v_net USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NEW.reference_piece IS NULL THEN NEW.reference_piece := o.work_order_number; END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_mouvement_ordre() FROM PUBLIC, anon, authenticated;

-- R4-4 : bon issu d'une consultation -------------------------------------------
CREATE OR REPLACE FUNCTION public.garde_bon_consultation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT cf.numero, o.supplier_id, o.montant_total INTO c
    FROM public.consultations_fournisseurs cf JOIN public.offres_fournisseurs o ON o.id = cf.offre_retenue_id
   WHERE cf.purchase_order_id = NEW.id
   ORDER BY cf.selection_le DESC NULLS LAST LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.supplier_id IS DISTINCT FROM c.supplier_id THEN
    RAISE EXCEPTION 'Bon issu de la consultation % : le fournisseur de l''offre retenue ne change pas', c.numero USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'submitted' AND OLD.status = 'draft' AND coalesce(NEW.subtotal, 0) <> c.montant_total THEN
    RAISE EXCEPTION 'Bon issu de la consultation % : montant des lignes (%) different de l''offre retenue (%) ; annulez ce bon et preparez-en un nouveau',
      c.numero, coalesce(NEW.subtotal, 0), c.montant_total USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_bon_consultation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_bon_consultation ON public.purchase_orders;
CREATE TRIGGER garde_bon_consultation BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.garde_bon_consultation();

-- R4-5 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.definir_categorie_fournisseur(p_libelle text, p_id uuid DEFAULT NULL, p_actif boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_lib text := public.texte_ou_null(p_libelle);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Referentiel des categories de fournisseurs : administrateur seulement' USING ERRCODE = '42501';
  END IF;
  IF v_lib IS NULL THEN RAISE EXCEPTION 'Libelle de la categorie requis' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.categories_fournisseurs c WHERE lower(btrim(c.libelle)) = lower(v_lib) AND c.id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Categorie « % » deja definie', v_lib USING ERRCODE = '23505';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.categories_fournisseurs (libelle, actif, cree_par) VALUES (v_lib, coalesce(p_actif, true), auth.uid()) RETURNING id INTO v_id;
  ELSE
    UPDATE public.categories_fournisseurs SET libelle = v_lib, actif = coalesce(p_actif, true) WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Categorie introuvable' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- R4-7 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.selectionner_offre(p_offre uuid, p_motif text, p_preparer_bon boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE o public.offres_fournisseurs; c public.consultations_fournisseurs; v_min integer; v_nb integer;
BEGIN
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif de la selection requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM public.offres_fournisseurs WHERE id = p_offre;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offre introuvable' USING ERRCODE = '22023'; END IF;
  c := public.consultation_ecrivable(o.consultation_id);
  -- Relecture sous verrou : un retrait concurrent est vu.
  SELECT * INTO o FROM public.offres_fournisseurs WHERE id = p_offre FOR UPDATE;
  IF c.statut <> 'ouverte' THEN RAISE EXCEPTION 'Consultation deja attribuee ou annulee' USING ERRCODE = '22023'; END IF;
  IF o.statut <> 'recue' THEN RAISE EXCEPTION 'Offre retiree : non selectionnable' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = o.supplier_id AND coalesce(s.active, true)) THEN
    RAISE EXCEPTION 'Fournisseur suspendu : offre non selectionnable' USING ERRCODE = '22023';
  END IF;
  v_min := public.reglage_entier('consultation_offres_minimum', 1);
  SELECT count(*) INTO v_nb FROM public.offres_fournisseurs WHERE consultation_id = c.id AND statut = 'recue';
  IF v_nb < v_min THEN
    RAISE EXCEPTION 'Selection impossible : % offre(s) recue(s), % exigee(s) (reglage consultation_offres_minimum)', v_nb, v_min USING ERRCODE = '22023';
  END IF;
  UPDATE public.offres_fournisseurs SET statut = CASE WHEN id = p_offre THEN 'retenue' ELSE 'ecartee' END
   WHERE consultation_id = c.id AND statut = 'recue';
  UPDATE public.consultations_fournisseurs SET statut = 'attribuee', offre_retenue_id = p_offre, motif_selection = btrim(p_motif),
    selection_par = auth.uid(), selection_le = now() WHERE id = c.id;
  PERFORM public.journaliser_consultation(c.id, 'selection', p_motif,
    jsonb_build_object('offre', p_offre, 'fournisseur', o.supplier_id, 'montant', o.montant_total, 'offres_recues', v_nb));
  IF coalesce(p_preparer_bon, true) THEN
    RETURN public.preparer_bon_commande_consultation(c.id);
  END IF;
  RETURN NULL;
END;
$$;

-- R4-8 ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.suppliers GROUP BY lower(btrim(company_name)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Raisons sociales en double dans suppliers : a traiter avant la migration';
  END IF;
  IF EXISTS (SELECT 1 FROM public.suppliers WHERE nullif(btrim(identifiant_fiscal), '') IS NOT NULL
              GROUP BY lower(btrim(identifiant_fiscal)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Identifiants fiscaux en double dans suppliers : a traiter avant la migration';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_raison_sociale ON public.suppliers (lower(btrim(company_name)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_identifiant_fiscal ON public.suppliers (lower(btrim(identifiant_fiscal)))
  WHERE nullif(btrim(identifiant_fiscal), '') IS NOT NULL;

-- R4-6 : horodatage serveur du georeperage --------------------------------------
CREATE OR REPLACE FUNCTION public.horodater_violation_geofence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'acknowledged' THEN
    NEW.acknowledged_by := auth.uid();
    NEW.acknowledged_at := now();
  ELSE
    NEW.acknowledged_by := OLD.acknowledged_by;
    NEW.acknowledged_at := OLD.acknowledged_at;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('resolved', 'false_positive') THEN
    NEW.resolved_at := now();
  ELSE
    NEW.resolved_at := OLD.resolved_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.horodater_violation_geofence() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS horodater_violation_geofence ON public.geofence_violations;
CREATE TRIGGER horodater_violation_geofence BEFORE UPDATE ON public.geofence_violations
  FOR EACH ROW EXECUTE FUNCTION public.horodater_violation_geofence();

CREATE OR REPLACE FUNCTION public.horodater_lecture_alerte_geofence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF coalesce(NEW.is_read, false) AND NOT coalesce(OLD.is_read, false) THEN
    NEW.read_by := auth.uid();
    NEW.read_at := now();
  ELSE
    NEW.read_by := OLD.read_by;
    NEW.read_at := OLD.read_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.horodater_lecture_alerte_geofence() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS horodater_lecture_alerte_geofence ON public.geofence_alerts;
CREATE TRIGGER horodater_lecture_alerte_geofence BEFORE UPDATE ON public.geofence_alerts
  FOR EACH ROW EXECUTE FUNCTION public.horodater_lecture_alerte_geofence();

CREATE OR REPLACE FUNCTION public.horodater_zone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := coalesce(auth.uid(), NEW.created_by);
  ELSIF auth.uid() IS NOT NULL THEN
    -- L'auteur et la date de creation d'une zone ne se reecrivent pas.
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- R4-9 : TRUNCATE et droits anon sur les vues ------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm') LOOP
    IF r.relkind IN ('r', 'p') THEN
      EXECUTE format('REVOKE TRUNCATE ON public.%I FROM anon, authenticated', r.relname);
    ELSE
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
    END IF;
  END LOOP;
END $$;

-- Tables creees ensuite par les roles de migration : sans TRUNCATE.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['postgres', 'supabase_admin'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated', r);
    END IF;
  END LOOP;
END $$;

/*
  # Corrections des ecrans herites (D-061, lot 18)

  1. Ordres de travail (`maintenance_orders`)
     - numero attribue par le serveur (OT-AAAA-NNNNN), non modifiable ;
     - annulation motivee par `annuler_ordre_travail` seulement (qui, quand,
       motif) ; un ordre annule ne se modifie plus, un ordre termine ne se
       rouvre pas ;
     - ecriture du navigateur limitee aux colonnes de saisie (le numero, le
       demandeur et l'annulation ne s'ecrivent pas) ;
     - pieces : plus de second inventaire. `parts_inventory` et
       `maintenance_parts` passent en lecture seule (tables conservees, non
       lues par les ecrans) ; les pieces d'un ordre sortent du registre des
       stocks (D-044) par `mouvement_stock` avec `p_ordre_maintenance`. Un
       declencheur verifie l'ordre (ouvert ou en cours, dans le perimetre,
       engin coherent) et refuse un retour superieur aux pieces sorties.
       `pieces_ordre_travail` restitue les mouvements d'un ordre a qui voit
       l'ordre (meme sans droit de lecture sur les stocks).
  2. Plannings preventifs (`maintenance_schedules`) : les colonnes heritees en
     double (`active`/`is_active`, `last_service_*`/`last_maintenance_*`,
     `frequency_*`) sont alignees par declencheur ; prochaine echeance
     calculee seulement si la derniere intervention et l'intervalle sont
     connus. Aucune propriete d'engin n'est supposee (D-025 : les engins
     loues relevent de Neemba ; l'ecran le rappelle).
  3. Chauffeurs : DELETE deja retire (D-042) ; un dossier ne s'archive pas
     (statut terminated) tant que le chauffeur est sur un voyage en cours.
  4. Presences (`employee_attendance`) : ecriture par fonctions serveur
     seulement. Correction = nouvelle saisie qui remplace l'ancienne (motif) ;
     annulation motivee ; plus de suppression ni de reecriture. Vue
     `v_presences` : saisies en vigueur. La contrainte d'unicite (employe,
     date) devient une regle de la fonction (une seule saisie en vigueur).
  5. Parametres (`settings`) : les cles lues par les fonctions serveur sont
     validees a l'ecriture (booleen ou nombre positif).
  6. Georeperage (`geofence_zones`, `geofence_violations`, `geofence_alerts`,
     regime C sans politique) : lecture par le module `gps_tracking` et le
     perimetre (site de la zone, site de l'engin), ecriture des zones par
     droit du module, pas de suppression (desactivation) ; violations et
     alertes : aucune insertion depuis le navigateur, seuls l'acquittement et
     la lecture se saisissent. PostGIS absent : `is_point_in_geofence`
     renvoie NULL (indetermine) pour un polygone au lieu de « dedans », et les
     fonctions de detection heritees ne sont plus executables par les
     comptes (elles n'ont jamais fonctionne : colonnes inexistantes).

  Idempotent.
*/

-- 1. Ordres de travail ------------------------------------------------------

ALTER TABLE public.maintenance_orders ADD COLUMN IF NOT EXISTS annule_le timestamptz;
ALTER TABLE public.maintenance_orders ADD COLUMN IF NOT EXISTS annule_par uuid REFERENCES auth.users(id);
ALTER TABLE public.maintenance_orders ADD COLUMN IF NOT EXISTS motif_annulation text;

CREATE SEQUENCE IF NOT EXISTS public.maintenance_orders_numero_seq;
GRANT USAGE, SELECT ON SEQUENCE public.maintenance_orders_numero_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.ordre_travail_permis(p_site uuid, p_vehicle uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN p_site IS NOT NULL THEN public.site_permis(p_site) ELSE public.vehicule_permis(p_vehicle) END;
$$;
REVOKE EXECUTE ON FUNCTION public.ordre_travail_permis(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ordre_travail_permis(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.numeroter_ordre_travail()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF nullif(btrim(coalesce(NEW.work_order_number, '')), '') IS NULL THEN
    NEW.work_order_number := 'OT-' || to_char(coalesce(NEW.request_date, current_date), 'YYYY') || '-'
                             || lpad(nextval('public.maintenance_orders_numero_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS numeroter_ordre_travail ON public.maintenance_orders;
CREATE TRIGGER numeroter_ordre_travail BEFORE INSERT ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.numeroter_ordre_travail();

CREATE OR REPLACE FUNCTION public.garde_ordre_travail()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
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
DROP TRIGGER IF EXISTS garde_ordre_travail ON public.maintenance_orders;
CREATE TRIGGER garde_ordre_travail BEFORE INSERT OR UPDATE ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.garde_ordre_travail();

REVOKE INSERT, UPDATE ON public.maintenance_orders FROM authenticated, anon;
GRANT INSERT (id, vehicle_id, request_date, maintenance_type, km_at_maintenance, description, labor_hours, labor_cost,
              status, workshop, completion_date, title, priority, assigned_to, site_id, scheduled_date, started_at,
              estimated_cost, actual_cost, notes),
      UPDATE (vehicle_id, maintenance_type, km_at_maintenance, description, labor_hours, labor_cost, status, workshop,
              completion_date, title, priority, assigned_to, site_id, scheduled_date, started_at, estimated_cost,
              actual_cost, notes, updated_at)
  ON public.maintenance_orders TO authenticated;

-- Quantite nette d'un article imputee a un ordre (sorties moins retours,
-- mouvements annules exclus). Interne.
CREATE OR REPLACE FUNCTION public.pieces_nettes_ordre(p_ordre uuid, p_article uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(CASE m.movement_type WHEN 'exit' THEN m.quantity WHEN 'return' THEN -m.quantity ELSE 0 END), 0)::integer
    FROM public.stock_movements m
   WHERE m.maintenance_order_id = p_ordre
     AND (p_article IS NULL OR m.stock_item_id = p_article)
     AND NOT EXISTS (SELECT 1 FROM public.stock_movements a WHERE a.annule_mouvement_id = m.id);
$$;
REVOKE EXECUTE ON FUNCTION public.pieces_nettes_ordre(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.annuler_ordre_travail(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE o public.maintenance_orders; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT (public.has_module_write('maintenance') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la maintenance requis' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif d''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM public.maintenance_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordre de travail introuvable' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.ordre_travail_permis(o.site_id, o.vehicle_id) THEN
    RAISE EXCEPTION 'Hors perimetre : ordre d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF o.status = 'cancelled' THEN RAISE EXCEPTION 'Ordre % deja annule', o.work_order_number USING ERRCODE = '22023'; END IF;
  IF o.status = 'completed' THEN RAISE EXCEPTION 'Un ordre termine ne s''annule pas' USING ERRCODE = '22023'; END IF;
  IF public.pieces_nettes_ordre(o.id) > 0 THEN
    RAISE EXCEPTION 'Des pieces sorties du stock restent imputees a l''ordre % : retournez-les ou annulez les sorties', o.work_order_number
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.maintenance_orders
     SET status = 'cancelled', annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif, updated_at = now()
   WHERE id = o.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.annuler_ordre_travail(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annuler_ordre_travail(uuid, text) TO authenticated;

-- Un mouvement de stock rattache a un ordre : sortie ou retour seulement,
-- ordre ouvert ou en cours et dans le perimetre, engin de l'ordre.
CREATE OR REPLACE FUNCTION public.garde_mouvement_ordre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE o public.maintenance_orders; v_net integer;
BEGIN
  IF NEW.maintenance_order_id IS NULL OR auth.uid() IS NULL THEN RETURN NEW; END IF;
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
DROP TRIGGER IF EXISTS garde_mouvement_ordre ON public.stock_movements;
CREATE TRIGGER garde_mouvement_ordre BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.garde_mouvement_ordre();

-- Pieces d'un ordre, pour qui voit l'ordre.
CREATE OR REPLACE FUNCTION public.pieces_ordre_travail(p_ordre uuid)
RETURNS TABLE (mouvement_id uuid, numero text, date_mouvement timestamptz, type_mouvement text, article_id uuid,
               article_code text, article_nom text, unite text, quantite integer, prix_unitaire bigint, valeur bigint,
               depot_code text, annule boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE o public.maintenance_orders;
BEGIN
  SELECT * INTO o FROM public.maintenance_orders WHERE id = p_ordre;
  IF NOT FOUND OR NOT ((public.has_module_view('maintenance') OR public.is_admin())
                       AND public.ordre_travail_permis(o.site_id, o.vehicle_id)) THEN
    RAISE EXCEPTION 'Ordre de travail introuvable ou hors perimetre' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.id, m.movement_number, m.movement_date, m.movement_type, i.id, i.item_code, i.name, i.unit_of_measure,
           m.quantity, m.unit_price, m.total_value, w.code,
           EXISTS (SELECT 1 FROM public.stock_movements a WHERE a.annule_mouvement_id = m.id)
      FROM public.stock_movements m
      JOIN public.stock_items i ON i.id = m.stock_item_id
      LEFT JOIN public.warehouses w ON w.id = coalesce(m.from_warehouse_id, m.to_warehouse_id)
     WHERE m.maintenance_order_id = p_ordre
     ORDER BY m.movement_date, m.movement_number;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pieces_ordre_travail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pieces_ordre_travail(uuid) TO authenticated;

-- Second inventaire de pieces : lecture seule (le registre des stocks fait foi).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['parts_inventory', 'maintenance_parts'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated, anon', t);
  END LOOP;
END $$;

-- 2. Plannings preventifs ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.normaliser_planning_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_active := coalesce(NEW.is_active, NEW.active, true);
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NULL;
  ELSIF NEW.active IS DISTINCT FROM OLD.active THEN
    NEW.is_active := NEW.active;
  END IF;
  NEW.active := NEW.is_active;
  IF coalesce(NEW.interval_km, 0) <= 0 AND coalesce(NEW.interval_days, 0) <= 0 THEN
    RAISE EXCEPTION 'Intervalle requis : en kilometres, en jours, ou les deux' USING ERRCODE = '22023';
  END IF;
  IF NEW.interval_km IS NOT NULL AND NEW.interval_km <= 0 THEN NEW.interval_km := NULL; END IF;
  IF NEW.interval_days IS NOT NULL AND NEW.interval_days <= 0 THEN NEW.interval_days := NULL; END IF;
  NEW.frequency_type := CASE WHEN NEW.interval_km IS NOT NULL AND NEW.interval_days IS NOT NULL THEN 'km_ou_jours'
                             WHEN NEW.interval_km IS NOT NULL THEN 'km' ELSE 'jours' END;
  NEW.frequency_value := coalesce(NEW.interval_km, NEW.interval_days);
  NEW.last_service_km := NEW.last_maintenance_km;
  NEW.last_service_date := NEW.last_maintenance_date;
  -- Echeance calculee seulement si la derniere intervention est connue.
  NEW.next_service_km := CASE WHEN NEW.last_maintenance_km IS NOT NULL AND NEW.interval_km IS NOT NULL
                              THEN NEW.last_maintenance_km + NEW.interval_km END;
  NEW.next_service_date := CASE WHEN NEW.last_maintenance_date IS NOT NULL AND NEW.interval_days IS NOT NULL
                                THEN NEW.last_maintenance_date + NEW.interval_days END;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS normaliser_planning_maintenance ON public.maintenance_schedules;
CREATE TRIGGER normaliser_planning_maintenance BEFORE INSERT OR UPDATE ON public.maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION public.normaliser_planning_maintenance();

-- 3. Chauffeurs : pas d'archivage pendant un voyage en cours ---------------

CREATE OR REPLACE FUNCTION public.garde_archivage_chauffeur()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_ref text;
BEGIN
  IF NEW.status = 'terminated' AND OLD.status IS DISTINCT FROM 'terminated' THEN
    SELECT t.reference INTO v_ref FROM public.trips t
     WHERE t.driver_id = NEW.id
       AND t.etat IN ('ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION',
                      'UNLOADING', 'WEIGHED_IN')
     LIMIT 1;
    IF v_ref IS NOT NULL THEN
      RAISE EXCEPTION 'Chauffeur affecte au voyage en cours % : terminez ou reaffectez le voyage avant d''archiver', v_ref
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_archivage_chauffeur() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_archivage_chauffeur ON public.drivers;
CREATE TRIGGER garde_archivage_chauffeur BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.garde_archivage_chauffeur();

-- 4. Presences --------------------------------------------------------------

ALTER TABLE public.employee_attendance ADD COLUMN IF NOT EXISTS remplace_presence_id uuid UNIQUE
  REFERENCES public.employee_attendance(id);
ALTER TABLE public.employee_attendance ADD COLUMN IF NOT EXISTS motif_correction text;
ALTER TABLE public.employee_attendance ADD COLUMN IF NOT EXISTS saisi_par uuid REFERENCES auth.users(id);
ALTER TABLE public.employee_attendance ADD COLUMN IF NOT EXISTS saisi_le timestamptz;
ALTER TABLE public.employee_attendance ADD COLUMN IF NOT EXISTS annulee_le timestamptz;
ALTER TABLE public.employee_attendance ADD COLUMN IF NOT EXISTS annulee_par uuid REFERENCES auth.users(id);
ALTER TABLE public.employee_attendance ADD COLUMN IF NOT EXISTS motif_annulation text;
-- Une correction ajoute une ligne : l'unicite (employe, date) porte sur les
-- saisies en vigueur et se controle dans enregistrer_presence.
ALTER TABLE public.employee_attendance DROP CONSTRAINT IF EXISTS employee_attendance_employee_id_date_key;
ALTER TABLE public.employee_attendance DROP CONSTRAINT IF EXISTS employee_attendance_correction_motivee;
ALTER TABLE public.employee_attendance ADD CONSTRAINT employee_attendance_correction_motivee
  CHECK (remplace_presence_id IS NULL OR motif_correction IS NOT NULL) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_ea_emp_date ON public.employee_attendance (employee_id, date);

CREATE OR REPLACE VIEW public.v_presences WITH (security_invoker = true) AS
SELECT p.* FROM public.employee_attendance p
 WHERE p.annulee_le IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.employee_attendance c WHERE c.remplace_presence_id = p.id);
GRANT SELECT ON public.v_presences TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.employee_attendance FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.enregistrer_presence(
  p_employe uuid, p_date date, p_statut text, p_arrivee time DEFAULT NULL, p_depart time DEFAULT NULL,
  p_heures numeric DEFAULT NULL, p_heures_sup numeric DEFAULT NULL, p_motif_absence text DEFAULT NULL,
  p_note text DEFAULT NULL, p_remplace uuid DEFAULT NULL, p_motif_correction text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ancienne public.employee_attendance;
  v_heures numeric := p_heures;
  v_sup numeric := coalesce(p_heures_sup, 0);
  v_absence text := nullif(btrim(coalesce(p_motif_absence, '')), '');
  v_motif text := nullif(btrim(coalesce(p_motif_correction, '')), '');
  v_avec_heures boolean;
  v_id uuid;
BEGIN
  IF NOT public.has_module_write('hr') THEN
    RAISE EXCEPTION 'Droit d''ecriture RH requis' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.employees WHERE id = p_employe FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employe introuvable' USING ERRCODE = '22023'; END IF;
  IF p_date IS NULL OR p_date > current_date THEN
    RAISE EXCEPTION 'Date requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_statut IS NULL OR p_statut NOT IN ('present', 'absent', 'late', 'half_day', 'leave', 'sick_leave', 'unpaid_leave') THEN
    RAISE EXCEPTION 'Statut de presence inconnu' USING ERRCODE = '22023';
  END IF;
  v_avec_heures := p_statut IN ('present', 'late', 'half_day');
  IF NOT v_avec_heures THEN
    IF v_absence IS NULL THEN RAISE EXCEPTION 'Motif d''absence requis' USING ERRCODE = '22023'; END IF;
    IF p_arrivee IS NOT NULL OR p_depart IS NOT NULL OR coalesce(p_heures, 0) <> 0 OR v_sup <> 0 THEN
      RAISE EXCEPTION 'Une absence ne porte ni horaires ni heures' USING ERRCODE = '22023';
    END IF;
    v_heures := 0;
  ELSE
    IF p_arrivee IS NOT NULL AND p_depart IS NOT NULL AND p_depart <= p_arrivee THEN
      RAISE EXCEPTION 'L''heure de depart doit suivre l''heure d''arrivee' USING ERRCODE = '22023';
    END IF;
    IF v_heures IS NULL AND p_arrivee IS NOT NULL AND p_depart IS NOT NULL THEN
      v_heures := round(extract(epoch FROM (p_depart - p_arrivee)) / 3600.0, 2);
    END IF;
    IF v_heures IS NULL THEN
      RAISE EXCEPTION 'Heures travaillees ou horaires d''arrivee et de depart requis' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_heures < 0 OR v_sup < 0 OR v_heures + v_sup > 24 THEN
    RAISE EXCEPTION 'Heures invalides (0 a 24 h par jour)' USING ERRCODE = '22023';
  END IF;
  IF p_remplace IS NOT NULL THEN
    IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif de correction requis' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_ancienne FROM public.employee_attendance WHERE id = p_remplace FOR UPDATE;
    IF NOT FOUND OR v_ancienne.annulee_le IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.employee_attendance c WHERE c.remplace_presence_id = p_remplace) THEN
      RAISE EXCEPTION 'Saisie a corriger introuvable, annulee ou deja corrigee' USING ERRCODE = '22023';
    END IF;
    IF v_ancienne.employee_id <> p_employe THEN
      RAISE EXCEPTION 'Une correction porte sur le meme employe' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.employee_attendance p
              WHERE p.employee_id = p_employe AND p.date = p_date AND p.annulee_le IS NULL
                AND p.id IS DISTINCT FROM p_remplace
                AND NOT EXISTS (SELECT 1 FROM public.employee_attendance c WHERE c.remplace_presence_id = p.id)) THEN
    RAISE EXCEPTION 'Presence deja saisie pour ce jour : corrigez ou annulez la saisie existante' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.employee_attendance (employee_id, date, status, check_in_time, check_out_time, hours_worked,
    overtime_hours, absence_reason, notes, remplace_presence_id, motif_correction, saisi_par, saisi_le)
  VALUES (p_employe, p_date, p_statut,
    CASE WHEN v_avec_heures THEN p_arrivee END, CASE WHEN v_avec_heures THEN p_depart END,
    v_heures, v_sup, v_absence, nullif(btrim(coalesce(p_note, '')), ''), p_remplace, v_motif, auth.uid(), now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_presence(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.employee_attendance; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.has_module_write('hr') THEN
    RAISE EXCEPTION 'Droit d''ecriture RH requis' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif d''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO p FROM public.employee_attendance WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR p.annulee_le IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.employee_attendance c WHERE c.remplace_presence_id = p_id) THEN
    RAISE EXCEPTION 'Saisie introuvable, deja annulee ou corrigee' USING ERRCODE = '22023';
  END IF;
  UPDATE public.employee_attendance
     SET annulee_le = now(), annulee_par = auth.uid(), motif_annulation = v_motif, updated_at = now()
   WHERE id = p_id;
END;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'enregistrer_presence(uuid, date, text, time, time, numeric, numeric, text, text, uuid, text)',
    'annuler_presence(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;

-- 5. Parametres lus par le serveur : format controle a l'ecriture ----------

CREATE OR REPLACE FUNCTION public.valider_reglage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v text := NEW.value ->> 'value';
BEGIN
  IF NEW.key IN ('mfa_exige', 'carburant_validation_separee', 'kilometrage_validation_separee',
                 'achats_validation_separee', 'paiements_validation_separee', 'controle_depart_exige') THEN
    IF v IS NULL OR v NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'Reglage % : valeur true ou false attendue', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('tolerance_poids_cbg_t', 'pneu_profondeur_min_mm', 'pneu_inspection_max_jours') THEN
    IF v IS NULL OR v !~ '^\d+(\.\d+)?$' THEN
      RAISE EXCEPTION 'Reglage % : nombre positif attendu', NEW.key USING ERRCODE = '22023';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS valider_reglage ON public.settings;
CREATE TRIGGER valider_reglage BEFORE INSERT OR UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.valider_reglage();

-- 6. Georeperage -------------------------------------------------------------

ALTER TABLE public.geofence_zones DROP CONSTRAINT IF EXISTS geofence_zones_geometrie;
-- Aucune position par defaut : un cercle a un centre et un rayon saisis, un
-- polygone au moins trois sommets (une valeur absente fait echouer le controle).
ALTER TABLE public.geofence_zones ADD CONSTRAINT geofence_zones_geometrie CHECK (coalesce(
  (geometry_type <> 'circle' OR (center_lat BETWEEN -90 AND 90 AND center_lng BETWEEN -180 AND 180 AND radius_meters > 0))
  AND (geometry_type <> 'polygon' OR (jsonb_typeof(polygon_coordinates) = 'array' AND jsonb_array_length(polygon_coordinates) >= 3)),
  false)) NOT VALID;
ALTER TABLE public.geofence_violations DROP CONSTRAINT IF EXISTS geofence_violations_resolution_motivee;
ALTER TABLE public.geofence_violations ADD CONSTRAINT geofence_violations_resolution_motivee CHECK (
  status NOT IN ('resolved', 'false_positive') OR nullif(btrim(coalesce(resolution_notes, '')), '') IS NOT NULL
) NOT VALID;

CREATE OR REPLACE FUNCTION public.horodater_zone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.created_by := coalesce(auth.uid(), NEW.created_by); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS horodater_zone ON public.geofence_zones;
CREATE TRIGGER horodater_zone BEFORE INSERT OR UPDATE ON public.geofence_zones
  FOR EACH ROW EXECUTE FUNCTION public.horodater_zone();

ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lecture_module ON public.geofence_zones;
CREATE POLICY lecture_module ON public.geofence_zones FOR SELECT TO authenticated
  USING ((public.has_module_view('gps_tracking') OR public.is_admin()) AND public.site_permis(site_id));
DROP POLICY IF EXISTS creation_module ON public.geofence_zones;
CREATE POLICY creation_module ON public.geofence_zones FOR INSERT TO authenticated
  WITH CHECK ((public.has_module_write('gps_tracking') OR public.is_admin()) AND public.site_permis(site_id));
DROP POLICY IF EXISTS modification_module ON public.geofence_zones;
CREATE POLICY modification_module ON public.geofence_zones FOR UPDATE TO authenticated
  USING ((public.has_module_write('gps_tracking') OR public.is_admin()) AND public.site_permis(site_id))
  WITH CHECK ((public.has_module_write('gps_tracking') OR public.is_admin()) AND public.site_permis(site_id));
REVOKE DELETE ON public.geofence_zones FROM authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.geofence_zones TO authenticated;

DROP POLICY IF EXISTS lecture_module ON public.geofence_violations;
CREATE POLICY lecture_module ON public.geofence_violations FOR SELECT TO authenticated
  USING ((public.has_module_view('gps_tracking') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
DROP POLICY IF EXISTS acquittement_module ON public.geofence_violations;
CREATE POLICY acquittement_module ON public.geofence_violations FOR UPDATE TO authenticated
  USING ((public.has_module_write('gps_tracking') OR public.is_admin()) AND public.vehicule_permis(vehicle_id))
  WITH CHECK ((public.has_module_write('gps_tracking') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
REVOKE INSERT, UPDATE, DELETE ON public.geofence_violations FROM authenticated, anon;
GRANT SELECT ON public.geofence_violations TO authenticated;
GRANT UPDATE (status, acknowledged_by, acknowledged_at, resolution_notes, resolved_at) ON public.geofence_violations TO authenticated;

DROP POLICY IF EXISTS lecture_module ON public.geofence_alerts;
CREATE POLICY lecture_module ON public.geofence_alerts FOR SELECT TO authenticated
  USING ((public.has_module_view('gps_tracking') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
DROP POLICY IF EXISTS lecture_alerte ON public.geofence_alerts;
CREATE POLICY lecture_alerte ON public.geofence_alerts FOR UPDATE TO authenticated
  USING ((public.has_module_view('gps_tracking') OR public.is_admin()) AND public.vehicule_permis(vehicle_id))
  WITH CHECK ((public.has_module_view('gps_tracking') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
REVOKE INSERT, UPDATE, DELETE ON public.geofence_alerts FROM authenticated, anon;
GRANT SELECT ON public.geofence_alerts TO authenticated;
GRANT UPDATE (is_read, read_by, read_at) ON public.geofence_alerts TO authenticated;

-- PostGIS absent : un polygone n'est pas evalue (NULL = indetermine),
-- jamais declare « dedans ».
CREATE OR REPLACE FUNCTION public.is_point_in_geofence(p_latitude numeric, p_longitude numeric, p_zone_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE v_zone public.geofence_zones;
BEGIN
  SELECT * INTO v_zone FROM public.geofence_zones WHERE id = p_zone_id AND is_active = true;
  IF NOT FOUND OR p_latitude IS NULL OR p_longitude IS NULL THEN RETURN NULL; END IF;
  IF v_zone.geometry_type = 'circle' AND v_zone.center_lat IS NOT NULL AND v_zone.center_lng IS NOT NULL
     AND v_zone.radius_meters IS NOT NULL THEN
    RETURN 6371000 * acos(least(1, greatest(-1,
             cos(radians(p_latitude)) * cos(radians(v_zone.center_lat)) * cos(radians(v_zone.center_lng) - radians(p_longitude))
             + sin(radians(p_latitude)) * sin(radians(v_zone.center_lat))))) <= v_zone.radius_meters;
  END IF;
  RETURN NULL;
END;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'detect_geofence_violations()', 'detect_vehicles_out_of_zone()', 'is_point_in_geofence(numeric, numeric, uuid)'
  ] LOOP
    IF to_regprocedure('public.' || sig) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', sig);
  END LOOP;
END $$;

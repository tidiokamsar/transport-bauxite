/*
  # Circuit achat : approbation et reception vers le stock (D-053, lot 13,
  # module 16)

  1. Bons de commande ecrits par fonctions serveur seulement :
     `enregistrer_bon_commande` (creation ou modification d'un brouillon :
     fournisseur, depot de livraison, lignes article ou designation libre,
     quantite, prix unitaire saisi, taxes saisies ; totaux calcules par le
     serveur), `soumettre_bon_commande`, `decider_bon_commande`
     (approbation ou rejet motive, par un titulaire du droit d'approbation
     des achats autre que le demandeur, sauf reglage
     `achats_validation_separee` = false), `annuler_bon_commande` (motif,
     sans reception), `solder_bon_commande` (motif : le reliquat ne sera
     pas livre).
  2. Reception partielle ou totale (`receptionner_bon_commande`, droit
     d'ecriture des stocks : le magasinier receptionne) : numero REC, bon
     de livraison, quantites recues et refusees par ligne (motif du refus).
     Chaque quantite recue d'un article entre en stock au depot du bon par
     `mouvement_stock` (D-044) au prix de la commande. Une ligne ne recoit
     jamais plus que la quantite commandee. `annuler_reception` (motif)
     annule les mouvements de stock correspondants ; un mouvement issu
     d'une reception ne s'annule pas autrement.
  3. Statuts : brouillon, soumis, approuve, partiellement recu, recu,
     solde, rejete, annule ; journal `achats_journal` (append-only).

  Lecture : modules achats ou stocks et perimetre du site du depot.
  Idempotent.
*/

-- 1. Structure
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status IN
  ('draft', 'submitted', 'approved', 'partially_received', 'received', 'closed', 'rejected', 'cancelled'));
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS soumis_le timestamptz;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS soumis_par uuid REFERENCES auth.users(id);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS decide_le timestamptz;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS decide_par uuid REFERENCES auth.users(id);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS motif_decision text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS clos_le timestamptz;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS clos_par uuid REFERENCES auth.users(id);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS motif_cloture text;

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS bon_livraison text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS recu_le timestamptz;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS annule_le timestamptz;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS annule_par uuid REFERENCES auth.users(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS motif_annulation text;
CREATE SEQUENCE IF NOT EXISTS public.receptions_achat_numero_seq;

CREATE TABLE IF NOT EXISTS public.receptions_achat_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id),
  po_item_id uuid NOT NULL REFERENCES public.purchase_order_items(id),
  quantite_recue integer NOT NULL CHECK (quantite_recue >= 0),
  quantite_refusee integer NOT NULL DEFAULT 0 CHECK (quantite_refusee >= 0),
  motif_refus text,
  stock_movement_id uuid REFERENCES public.stock_movements(id),
  CHECK (quantite_recue + quantite_refusee > 0),
  CHECK (quantite_refusee = 0 OR nullif(btrim(coalesce(motif_refus, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_receptions_achat_lignes_livraison ON public.receptions_achat_lignes(delivery_id);
CREATE INDEX IF NOT EXISTS idx_receptions_achat_lignes_mouvement ON public.receptions_achat_lignes(stock_movement_id);

CREATE TABLE IF NOT EXISTS public.achats_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  evenement text NOT NULL CHECK (evenement IN ('creation', 'modification', 'soumission', 'approbation', 'rejet',
                                                'annulation', 'reception', 'annulation_reception', 'solde')),
  motif text,
  details jsonb,
  par uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_achats_journal_bon ON public.achats_journal(purchase_order_id, le);

-- 2. Droits : lecture bornee, ecriture par fonctions seulement.
CREATE OR REPLACE FUNCTION public.bon_commande_permis(p_depot uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.site_permis((SELECT w.site_id FROM public.warehouses w WHERE w.id = p_depot));
$$;
REVOKE EXECUTE ON FUNCTION public.bon_commande_permis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bon_commande_permis(uuid) TO authenticated, service_role;

-- Droit d'approbation d'un module : celui du role, sauf si un droit par
-- utilisateur (D-036) le reduit a la lecture ou le retire.
CREATE OR REPLACE FUNCTION public.has_module_approve(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active')
    AND coalesce((SELECT d.niveau = 'ecriture' FROM public.droits_utilisateur d
                   WHERE d.utilisateur = auth.uid() AND d.module = p_module), true)
    AND EXISTS (SELECT 1 FROM public.profiles pr JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                 WHERE pr.id = auth.uid() AND pr.status = 'active' AND rp.module = p_module AND rp.can_approve);
$$;
REVOKE EXECUTE ON FUNCTION public.has_module_approve(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module_approve(text) TO authenticated, service_role;

DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_orders', 'purchase_order_items', 'deliveries'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

ALTER TABLE public.receptions_achat_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achats_journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.receptions_achat_lignes, public.achats_journal FROM anon, authenticated;
GRANT SELECT ON public.receptions_achat_lignes, public.achats_journal TO authenticated;
GRANT ALL ON public.receptions_achat_lignes, public.achats_journal TO service_role;

CREATE POLICY lecture ON public.purchase_orders FOR SELECT TO authenticated
  USING ((public.has_module_view('purchases') OR public.has_module_view('stock') OR public.is_admin())
         AND public.bon_commande_permis(warehouse_id));
CREATE POLICY lecture ON public.purchase_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id));
CREATE POLICY lecture ON public.deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id));
DROP POLICY IF EXISTS lecture ON public.receptions_achat_lignes;
CREATE POLICY lecture ON public.receptions_achat_lignes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deliveries d WHERE d.id = delivery_id));
DROP POLICY IF EXISTS lecture ON public.achats_journal;
CREATE POLICY lecture ON public.achats_journal FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id));

CREATE OR REPLACE FUNCTION public.garde_append_only_achats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  RAISE EXCEPTION 'Journal des achats : ligne non modifiable' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS garde_append_only ON public.achats_journal;
CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.achats_journal
  FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_achats();
DROP TRIGGER IF EXISTS garde_append_only ON public.receptions_achat_lignes;
CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.receptions_achat_lignes
  FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_achats();

-- Un mouvement de stock issu d'une reception ne s'annule que par
-- l'annulation de la reception (les quantites recues restent justes).
CREATE OR REPLACE FUNCTION public.garde_annulation_mouvement_reception()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.movement_type = 'annulation' AND NEW.annule_mouvement_id IS NOT NULL
     AND coalesce(current_setting('sigtb.annulation_reception', true), '') <> 'on'
     AND EXISTS (SELECT 1 FROM public.receptions_achat_lignes l WHERE l.stock_movement_id = NEW.annule_mouvement_id) THEN
    RAISE EXCEPTION 'Mouvement issu d''une reception d''achat : annuler la reception' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_annulation_mouvement_reception ON public.stock_movements;
CREATE TRIGGER garde_annulation_mouvement_reception BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.garde_annulation_mouvement_reception();

-- 3. Fonctions internes
CREATE OR REPLACE FUNCTION public.journaliser_achat(p_bon uuid, p_evenement text, p_motif text DEFAULT NULL, p_details jsonb DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.achats_journal (purchase_order_id, evenement, motif, details, par)
  VALUES (p_bon, p_evenement, nullif(btrim(coalesce(p_motif, '')), ''), p_details, auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.journaliser_achat(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bon_commande_ecrivable(p_id uuid, p_module text)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE po public.purchase_orders;
BEGIN
  IF NOT (public.has_module_write(p_module) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis (module %)', p_module USING ERRCODE = '42501';
  END IF;
  SELECT * INTO po FROM public.purchase_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bon de commande introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT public.bon_commande_permis(po.warehouse_id) THEN
    RAISE EXCEPTION 'Bon de commande hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  RETURN po;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bon_commande_ecrivable(uuid, text) FROM PUBLIC, anon, authenticated;

-- 4. Circuit
-- p_lignes : [{"article": uuid|null, "designation": text|null, "quantite": int, "prix_unitaire": int}]
CREATE OR REPLACE FUNCTION public.enregistrer_bon_commande(
  p_fournisseur uuid, p_depot uuid, p_lignes jsonb, p_id uuid DEFAULT NULL, p_livraison_prevue date DEFAULT NULL,
  p_taxes bigint DEFAULT 0, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE po public.purchase_orders; l jsonb; a public.stock_items; v_id uuid; v_q integer; v_pu bigint; v_des text;
        v_sous_total bigint := 0;
BEGIN
  IF NOT (public.has_module_write('purchases') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les achats requis' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = p_fournisseur AND coalesce(s.active, true)) THEN
    RAISE EXCEPTION 'Fournisseur introuvable ou inactif' USING ERRCODE = '22023';
  END IF;
  IF p_depot IS NULL THEN RAISE EXCEPTION 'Depot de livraison requis' USING ERRCODE = '22023'; END IF;
  PERFORM public.depot_ecrivable(p_depot);
  IF p_taxes IS NULL OR p_taxes < 0 THEN RAISE EXCEPTION 'Taxes : montant positif ou nul' USING ERRCODE = '22023'; END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Au moins une ligne requise' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.purchase_orders (po_number, po_date, supplier_id, warehouse_id, status, expected_delivery_date, notes, requested_by)
    VALUES (NULL, current_date, p_fournisseur, p_depot, 'draft', p_livraison_prevue, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    po := public.bon_commande_ecrivable(p_id, 'purchases');
    IF po.status <> 'draft' THEN RAISE EXCEPTION 'Seul un brouillon se modifie' USING ERRCODE = '22023'; END IF;
    v_id := p_id;
    DELETE FROM public.purchase_order_items WHERE purchase_order_id = v_id;
    UPDATE public.purchase_orders SET supplier_id = p_fournisseur, warehouse_id = p_depot, expected_delivery_date = p_livraison_prevue,
      notes = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now() WHERE id = v_id;
  END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_q := (l ->> 'quantite')::integer;
    v_pu := (l ->> 'prix_unitaire')::bigint;
    IF v_q IS NULL OR v_q <= 0 THEN RAISE EXCEPTION 'Quantite positive requise sur chaque ligne' USING ERRCODE = '22023'; END IF;
    IF v_pu IS NULL OR v_pu < 0 THEN RAISE EXCEPTION 'Prix unitaire requis sur chaque ligne' USING ERRCODE = '22023'; END IF;
    v_des := nullif(btrim(coalesce(l ->> 'designation', '')), '');
    a := NULL;
    IF nullif(l ->> 'article', '') IS NOT NULL THEN
      SELECT * INTO a FROM public.stock_items WHERE id = (l ->> 'article')::uuid;
      IF NOT FOUND OR NOT coalesce(a.active, true) THEN RAISE EXCEPTION 'Article introuvable ou archive' USING ERRCODE = '22023'; END IF;
      v_des := coalesce(v_des, a.name);
    END IF;
    IF v_des IS NULL THEN RAISE EXCEPTION 'Article ou designation requis sur chaque ligne' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.purchase_order_items (purchase_order_id, stock_item_id, item_description, quantity, unit_price, total_price, quantity_received)
    VALUES (v_id, a.id, v_des, v_q, v_pu, v_q * v_pu, 0);
    v_sous_total := v_sous_total + v_q * v_pu;
  END LOOP;
  UPDATE public.purchase_orders SET subtotal = v_sous_total, tax_amount = p_taxes, total_amount = v_sous_total + p_taxes WHERE id = v_id;
  PERFORM public.journaliser_achat(v_id, CASE WHEN p_id IS NULL THEN 'creation' ELSE 'modification' END, NULL,
    jsonb_build_object('lignes', jsonb_array_length(p_lignes), 'total', v_sous_total + p_taxes));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.soumettre_bon_commande(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE po public.purchase_orders;
BEGIN
  po := public.bon_commande_ecrivable(p_id, 'purchases');
  IF po.status <> 'draft' THEN RAISE EXCEPTION 'Seul un brouillon se soumet' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id = p_id) THEN
    RAISE EXCEPTION 'Bon sans ligne' USING ERRCODE = '22023';
  END IF;
  UPDATE public.purchase_orders SET status = 'submitted', soumis_le = now(), soumis_par = auth.uid(), updated_at = now() WHERE id = p_id;
  PERFORM public.journaliser_achat(p_id, 'soumission');
END;
$$;

CREATE OR REPLACE FUNCTION public.decider_bon_commande(p_id uuid, p_approuver boolean, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE po public.purchase_orders; v_separee boolean;
BEGIN
  IF NOT (public.has_module_approve('purchases') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''approbation des achats requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO po FROM public.purchase_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bon de commande introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT public.bon_commande_permis(po.warehouse_id) THEN
    RAISE EXCEPTION 'Bon de commande hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF po.status <> 'submitted' THEN RAISE EXCEPTION 'Seul un bon soumis se decide' USING ERRCODE = '22023'; END IF;
  IF p_approuver IS NULL THEN RAISE EXCEPTION 'Decision requise' USING ERRCODE = '22023'; END IF;
  SELECT coalesce((SELECT (s.value ->> 'value') <> 'false' FROM public.settings s WHERE s.key = 'achats_validation_separee'), true)
    INTO v_separee;
  IF v_separee AND auth.uid() IN (po.requested_by, po.soumis_par) THEN
    RAISE EXCEPTION 'L''approbation revient a une autre personne que le demandeur' USING ERRCODE = '42501';
  END IF;
  IF NOT p_approuver AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif du rejet requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.purchase_orders SET
    status = CASE WHEN p_approuver THEN 'approved' ELSE 'rejected' END,
    decide_le = now(), decide_par = auth.uid(), motif_decision = nullif(btrim(coalesce(p_motif, '')), ''),
    approved_by = CASE WHEN p_approuver THEN auth.uid() END, approved_at = CASE WHEN p_approuver THEN now() END,
    updated_at = now()
   WHERE id = p_id;
  PERFORM public.journaliser_achat(p_id, CASE WHEN p_approuver THEN 'approbation' ELSE 'rejet' END, p_motif);
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_bon_commande(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE po public.purchase_orders;
BEGIN
  po := public.bon_commande_ecrivable(p_id, 'purchases');
  IF po.status NOT IN ('draft', 'submitted', 'approved') THEN
    RAISE EXCEPTION 'Bon deja recu, solde, rejete ou annule : utiliser le solde' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  UPDATE public.purchase_orders SET status = 'cancelled', clos_le = now(), clos_par = auth.uid(), motif_cloture = btrim(p_motif),
    updated_at = now() WHERE id = p_id;
  PERFORM public.journaliser_achat(p_id, 'annulation', p_motif);
END;
$$;

CREATE OR REPLACE FUNCTION public.solder_bon_commande(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE po public.purchase_orders;
BEGIN
  po := public.bon_commande_ecrivable(p_id, 'purchases');
  IF po.status <> 'partially_received' THEN
    RAISE EXCEPTION 'Seul un bon partiellement recu se solde (sinon annuler)' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif du solde requis' USING ERRCODE = '22023'; END IF;
  UPDATE public.purchase_orders SET status = 'closed', clos_le = now(), clos_par = auth.uid(), motif_cloture = btrim(p_motif),
    updated_at = now() WHERE id = p_id;
  PERFORM public.journaliser_achat(p_id, 'solde', p_motif,
    (SELECT jsonb_build_object('reliquat', sum(i.quantity - i.quantity_received)) FROM public.purchase_order_items i WHERE i.purchase_order_id = p_id));
END;
$$;

-- p_lignes : [{"ligne": uuid, "recue": int, "refusee": int, "motif_refus": text}]
CREATE OR REPLACE FUNCTION public.receptionner_bon_commande(
  p_id uuid, p_lignes jsonb, p_bon_livraison text DEFAULT NULL, p_date timestamptz DEFAULT now(), p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE po public.purchase_orders; l jsonb; i public.purchase_order_items; v_livraison uuid; v_numero text;
        v_recue integer; v_refusee integer; v_mvt uuid;
BEGIN
  po := public.bon_commande_ecrivable(p_id, 'stock');
  IF po.status NOT IN ('approved', 'partially_received') THEN
    RAISE EXCEPTION 'Seul un bon approuve se receptionne' USING ERRCODE = '22023';
  END IF;
  PERFORM public.depot_ecrivable(po.warehouse_id);
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date de reception requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Au moins une ligne receptionnee requise' USING ERRCODE = '22023';
  END IF;
  v_numero := 'REC-' || to_char(p_date, 'YYYY') || '-' || lpad(nextval('public.receptions_achat_numero_seq')::text, 5, '0');
  INSERT INTO public.deliveries (delivery_number, delivery_date, purchase_order_id, supplier_id, warehouse_id, received_by, notes,
                                 bon_livraison, recu_le)
  VALUES (v_numero, p_date::date, p_id, po.supplier_id, po.warehouse_id, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''),
          nullif(btrim(coalesce(p_bon_livraison, '')), ''), p_date)
  RETURNING id INTO v_livraison;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    SELECT * INTO i FROM public.purchase_order_items WHERE id = (l ->> 'ligne')::uuid AND purchase_order_id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ligne etrangere au bon de commande' USING ERRCODE = '22023'; END IF;
    v_recue := coalesce((l ->> 'recue')::integer, 0);
    v_refusee := coalesce((l ->> 'refusee')::integer, 0);
    IF v_recue < 0 OR v_refusee < 0 OR v_recue + v_refusee = 0 THEN
      RAISE EXCEPTION 'Ligne « % » : quantite recue ou refusee requise', i.item_description USING ERRCODE = '22023';
    END IF;
    IF coalesce(i.quantity_received, 0) + v_recue > i.quantity THEN
      RAISE EXCEPTION 'Ligne « % » : % deja recu(s) sur % commande(s), % de plus depasserait la commande',
        i.item_description, coalesce(i.quantity_received, 0), i.quantity, v_recue USING ERRCODE = '22023';
    END IF;
    IF v_refusee > 0 AND nullif(btrim(coalesce(l ->> 'motif_refus', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Ligne « % » : motif du refus requis', i.item_description USING ERRCODE = '22023';
    END IF;
    v_mvt := NULL;
    IF i.stock_item_id IS NOT NULL AND v_recue > 0 THEN
      v_mvt := public.mouvement_stock(i.stock_item_id, 'entry', v_recue, NULL, po.warehouse_id, p_date, i.unit_price,
        coalesce(nullif(btrim(coalesce(p_bon_livraison, '')), ''), v_numero), NULL, NULL, v_numero || ' / ' || po.po_number);
    END IF;
    INSERT INTO public.receptions_achat_lignes (delivery_id, po_item_id, quantite_recue, quantite_refusee, motif_refus, stock_movement_id)
    VALUES (v_livraison, i.id, v_recue, v_refusee, nullif(btrim(coalesce(l ->> 'motif_refus', '')), ''), v_mvt);
    UPDATE public.purchase_order_items SET quantity_received = coalesce(quantity_received, 0) + v_recue WHERE id = i.id;
  END LOOP;
  UPDATE public.purchase_orders SET
    status = CASE WHEN EXISTS (SELECT 1 FROM public.purchase_order_items x WHERE x.purchase_order_id = p_id AND coalesce(x.quantity_received, 0) < x.quantity)
                  THEN 'partially_received' ELSE 'received' END,
    updated_at = now()
   WHERE id = p_id;
  PERFORM public.journaliser_achat(p_id, 'reception', NULL, jsonb_build_object('reception', v_numero, 'bon_livraison', p_bon_livraison));
  RETURN v_livraison;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_reception(p_livraison uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE d public.deliveries; po public.purchase_orders; l public.receptions_achat_lignes;
BEGIN
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO d FROM public.deliveries WHERE id = p_livraison FOR UPDATE;
  IF NOT FOUND OR d.annule_le IS NOT NULL THEN RAISE EXCEPTION 'Reception introuvable ou deja annulee' USING ERRCODE = '22023'; END IF;
  po := public.bon_commande_ecrivable(d.purchase_order_id, 'stock');
  IF po.status NOT IN ('partially_received', 'received') THEN
    RAISE EXCEPTION 'Bon solde ou clos : reception non annulable' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('sigtb.annulation_reception', 'on', true);
  FOR l IN SELECT * FROM public.receptions_achat_lignes WHERE delivery_id = p_livraison LOOP
    IF l.stock_movement_id IS NOT NULL THEN
      PERFORM public.annuler_mouvement_stock(l.stock_movement_id, 'Annulation de la reception ' || d.delivery_number || ' : ' || btrim(p_motif));
    END IF;
    UPDATE public.purchase_order_items SET quantity_received = quantity_received - l.quantite_recue WHERE id = l.po_item_id;
  END LOOP;
  PERFORM set_config('sigtb.annulation_reception', 'off', true);
  UPDATE public.deliveries SET annule_le = now(), annule_par = auth.uid(), motif_annulation = btrim(p_motif) WHERE id = p_livraison;
  UPDATE public.purchase_orders SET
    status = CASE WHEN EXISTS (SELECT 1 FROM public.purchase_order_items x WHERE x.purchase_order_id = po.id AND x.quantity_received > 0)
                  THEN 'partially_received' ELSE 'approved' END,
    updated_at = now()
   WHERE id = po.id;
  PERFORM public.journaliser_achat(po.id, 'annulation_reception', p_motif, jsonb_build_object('reception', d.delivery_number));
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'enregistrer_bon_commande(uuid, uuid, jsonb, uuid, date, bigint, text)',
    'soumettre_bon_commande(uuid)',
    'decider_bon_commande(uuid, boolean, text)',
    'annuler_bon_commande(uuid, text)',
    'solder_bon_commande(uuid, text)',
    'receptionner_bon_commande(uuid, jsonb, text, timestamptz, text)',
    'annuler_reception(uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

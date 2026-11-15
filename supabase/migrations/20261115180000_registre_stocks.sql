/*
  # Registre des stocks magasin (D-044, lot M, module 17 du mandat)

  Meme patron que le carburant (D-041) sur les tables existantes : le stock
  d'un article dans un depot est la somme de ses mouvements ; aucun
  utilisateur ne modifie une quantite ni un mouvement.

  Convention de signe par depot :
  - entree (entry) et retour (return) : + quantite au depot destination ;
  - sortie (exit) : - quantite au depot source ;
  - transfert (transfer) et annulation : - au depot source, + au depot destination ;
  - ajustement d'inventaire (adjustment) : quantite signee au depot destination.

  1. `stock_movements` devient append-only : insertion par fonctions
     serveur seulement, ni modification ni suppression (garde par
     declencheur), numero attribue par le serveur (MVT-AAAA-NNNNNN).
  2. `mouvement_stock` (entree, sortie, transfert, retour) refuse une sortie
     superieure au stock disponible du depot : un ecart se constate par
     inventaire, jamais par un stock negatif.
  3. `inventorier_stock` : quantite comptee, ajustement egal a l'ecart,
     motif obligatoire si l'ecart n'est pas nul.
  4. `annuler_mouvement_stock` : contre-mouvement motive, l'original reste.
  5. `stock_items.quantity_in_stock` est un cache recalcule par
     declencheur, non modifiable par le navigateur.
  6. `warehouses.site_id` : rattachement d'un depot a un site ; les
     ecritures respectent `site_permis`.
  7. Vue `v_stock_depots` : quantite par article et depot.

  Tables vides en production au 2026-11-15 : aucune reprise de solde.
  Idempotent.
*/

ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS annule_mouvement_id uuid UNIQUE REFERENCES public.stock_movements(id);
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS motif text;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS reference_piece text;
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type IN ('entry', 'exit', 'transfer', 'adjustment', 'return', 'annulation'));
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_coherence;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_coherence CHECK (
  quantity <> 0
  AND (movement_type = 'adjustment' OR quantity > 0)
  AND (movement_type NOT IN ('entry', 'return', 'adjustment') OR to_warehouse_id IS NOT NULL)
  AND (movement_type <> 'exit' OR from_warehouse_id IS NOT NULL)
  AND (movement_type <> 'transfer' OR (from_warehouse_id IS NOT NULL AND to_warehouse_id IS NOT NULL
                                       AND from_warehouse_id <> to_warehouse_id))
  AND (movement_type <> 'annulation' OR annule_mouvement_id IS NOT NULL)
) NOT VALID;

CREATE SEQUENCE IF NOT EXISTS public.stock_movements_numero_seq;

-- 1. Numero, garde append-only et cache de quantite
CREATE OR REPLACE FUNCTION public.numeroter_mouvement_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF nullif(btrim(coalesce(NEW.movement_number, '')), '') IS NULL THEN
    NEW.movement_number := 'MVT-' || to_char(coalesce(NEW.movement_date, now()), 'YYYY') || '-'
                           || lpad(nextval('public.stock_movements_numero_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS numeroter_mouvement_stock ON public.stock_movements;
CREATE TRIGGER numeroter_mouvement_stock BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.numeroter_mouvement_stock();

CREATE OR REPLACE FUNCTION public.garde_mouvement_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Un mouvement de stock ne se modifie ni ne se supprime : annulez-le' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS garde_mouvement_stock ON public.stock_movements;
CREATE TRIGGER garde_mouvement_stock BEFORE UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.garde_mouvement_stock();

CREATE OR REPLACE VIEW public.v_stock_depots WITH (security_invoker = true) AS
SELECT x.stock_item_id, x.warehouse_id, sum(x.variation) AS quantite
  FROM (
    SELECT m.stock_item_id, m.from_warehouse_id AS warehouse_id, -m.quantity AS variation
      FROM public.stock_movements m
     WHERE m.from_warehouse_id IS NOT NULL AND m.movement_type IN ('exit', 'transfer', 'annulation')
    UNION ALL
    SELECT m.stock_item_id, m.to_warehouse_id, m.quantity
      FROM public.stock_movements m
     WHERE m.to_warehouse_id IS NOT NULL AND m.movement_type IN ('entry', 'return', 'transfer', 'annulation', 'adjustment')
  ) x
 GROUP BY x.stock_item_id, x.warehouse_id;
GRANT SELECT ON public.v_stock_depots TO authenticated;

CREATE OR REPLACE FUNCTION public.stock_disponible(p_article uuid, p_depot uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(CASE
           WHEN m.from_warehouse_id = p_depot AND m.movement_type IN ('exit', 'transfer', 'annulation') THEN -m.quantity
           ELSE 0 END)
         + sum(CASE
           WHEN m.to_warehouse_id = p_depot AND m.movement_type IN ('entry', 'return', 'transfer', 'annulation', 'adjustment') THEN m.quantity
           ELSE 0 END), 0)::integer
    FROM public.stock_movements m
   WHERE m.stock_item_id = p_article AND (m.from_warehouse_id = p_depot OR m.to_warehouse_id = p_depot);
$$;
REVOKE EXECUTE ON FUNCTION public.stock_disponible(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_disponible(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalculer_quantite_article()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.stock_items i
     SET quantity_in_stock = coalesce((SELECT sum(d.quantite) FROM public.v_stock_depots d WHERE d.stock_item_id = i.id), 0),
         updated_at = now()
   WHERE i.id = NEW.stock_item_id;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS recalculer_quantite_article ON public.stock_movements;
CREATE TRIGGER recalculer_quantite_article AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.recalculer_quantite_article();

-- 2. Droits : plus d'ecriture directe des mouvements ; la quantite d'un
-- article n'est ni saisie a la creation ni modifiable.
REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM authenticated, anon;
REVOKE INSERT, UPDATE ON public.stock_items FROM authenticated, anon;
GRANT INSERT (id, item_code, name, description, category_id, unit_of_measure, unit_price, minimum_threshold,
              maximum_threshold, warehouse_id, location_in_warehouse, supplier_id, active),
      UPDATE (item_code, name, description, category_id, unit_of_measure, unit_price, minimum_threshold,
              maximum_threshold, warehouse_id, location_in_warehouse, supplier_id, active, updated_at)
  ON public.stock_items TO authenticated;

-- Un depot n'est ecrit que dans le perimetre de son site (D-038, D-039).
CREATE OR REPLACE FUNCTION public.garde_perimetre_depot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' AND NOT public.site_permis(OLD.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : depot d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF TG_OP <> 'DELETE' AND NOT public.site_permis(NEW.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : depot d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
DROP TRIGGER IF EXISTS garde_perimetre ON public.warehouses;
CREATE TRIGGER garde_perimetre BEFORE INSERT OR UPDATE OR DELETE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.garde_perimetre_depot();

-- 3. Fonctions d'ecriture
CREATE OR REPLACE FUNCTION public.depot_ecrivable(p_depot uuid)
RETURNS public.warehouses
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE w public.warehouses;
BEGIN
  SELECT * INTO w FROM public.warehouses WHERE id = p_depot;
  IF NOT FOUND THEN RAISE EXCEPTION 'Depot introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT public.site_permis(w.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : depot d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(w.active, true) THEN
    RAISE EXCEPTION 'Depot % inactif', w.code USING ERRCODE = '22023';
  END IF;
  RETURN w;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.depot_ecrivable(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mouvement_stock(
  p_article uuid, p_type text, p_quantite integer, p_depot_source uuid DEFAULT NULL, p_depot_destination uuid DEFAULT NULL,
  p_date timestamptz DEFAULT now(), p_prix_unitaire bigint DEFAULT NULL, p_reference text DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL, p_ordre_maintenance uuid DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.stock_items; v_dispo integer; v_id uuid;
BEGIN
  IF NOT public.has_module_write('stock') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les stocks requis' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('entry', 'exit', 'transfer', 'return') THEN
    RAISE EXCEPTION 'Type de mouvement inconnu (inventaire et annulation ont leur fonction)' USING ERRCODE = '22023';
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'Quantite positive requise' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date du mouvement requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_prix_unitaire IS NOT NULL AND p_prix_unitaire < 0 THEN
    RAISE EXCEPTION 'Prix unitaire positif ou absent' USING ERRCODE = '22023';
  END IF;
  -- Verrou de l'article : deux sorties simultanees ne depassent pas le stock.
  SELECT * INTO a FROM public.stock_items WHERE id = p_article FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(a.active, true) THEN
    RAISE EXCEPTION 'Article introuvable ou archive' USING ERRCODE = '22023';
  END IF;
  IF p_type IN ('exit', 'transfer') THEN
    IF p_depot_source IS NULL THEN RAISE EXCEPTION 'Depot source requis' USING ERRCODE = '22023'; END IF;
    PERFORM public.depot_ecrivable(p_depot_source);
    v_dispo := public.stock_disponible(p_article, p_depot_source);
    IF p_quantite > v_dispo THEN
      RAISE EXCEPTION 'Stock insuffisant : % % disponible(s) au depot source', v_dispo, a.unit_of_measure USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_type IN ('entry', 'return', 'transfer') THEN
    IF p_depot_destination IS NULL THEN RAISE EXCEPTION 'Depot destination requis' USING ERRCODE = '22023'; END IF;
    PERFORM public.depot_ecrivable(p_depot_destination);
  END IF;
  IF p_type = 'transfer' AND p_depot_source = p_depot_destination THEN
    RAISE EXCEPTION 'Source et destination identiques' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.stock_movements (movement_number, movement_date, movement_type, stock_item_id, quantity, unit_price,
    total_value, from_warehouse_id, to_warehouse_id, reference_piece, vehicle_id, maintenance_order_id, notes, performed_by)
  VALUES (NULL, p_date, p_type, p_article, p_quantite, p_prix_unitaire,
    CASE WHEN p_prix_unitaire IS NOT NULL THEN p_prix_unitaire * p_quantite END,
    CASE WHEN p_type IN ('exit', 'transfer') THEN p_depot_source END,
    CASE WHEN p_type IN ('entry', 'return', 'transfer') THEN p_depot_destination END,
    nullif(btrim(coalesce(p_reference, '')), ''), p_vehicle_id, p_ordre_maintenance,
    nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventorier_stock(p_article uuid, p_depot uuid, p_quantite_comptee integer, p_motif text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.stock_items; v_dispo integer; v_ecart integer; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.has_module_write('stock') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les stocks requis' USING ERRCODE = '42501';
  END IF;
  IF p_quantite_comptee IS NULL OR p_quantite_comptee < 0 THEN
    RAISE EXCEPTION 'Quantite comptee positive ou nulle requise' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO a FROM public.stock_items WHERE id = p_article FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable' USING ERRCODE = '22023'; END IF;
  PERFORM public.depot_ecrivable(p_depot);
  v_dispo := public.stock_disponible(p_article, p_depot);
  v_ecart := p_quantite_comptee - v_dispo;
  IF v_ecart = 0 THEN RETURN 0; END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Ecart d''inventaire de % : motif requis', v_ecart USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.stock_movements (movement_number, movement_date, movement_type, stock_item_id, quantity,
    to_warehouse_id, motif, notes, performed_by)
  VALUES (NULL, now(), 'adjustment', p_article, v_ecart, p_depot, v_motif,
          format('Inventaire : %s compte(s), %s en stock', p_quantite_comptee, v_dispo), auth.uid());
  RETURN v_ecart;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_mouvement_stock(p_id uuid, p_motif text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m public.stock_movements; a public.stock_items; v_source uuid; v_dest uuid; v_qte integer;
        v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_id uuid; v_dispo integer;
BEGIN
  IF NOT public.has_module_write('stock') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les stocks requis' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif d''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO m FROM public.stock_movements WHERE id = p_id;
  IF NOT FOUND OR m.movement_type = 'annulation' THEN
    RAISE EXCEPTION 'Mouvement introuvable ou deja une annulation' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.stock_movements WHERE annule_mouvement_id = p_id) THEN
    RAISE EXCEPTION 'Mouvement % deja annule', m.movement_number USING ERRCODE = '22023';
  END IF;
  SELECT * INTO a FROM public.stock_items WHERE id = m.stock_item_id FOR UPDATE;
  -- Le contre-mouvement inverse les depots de l'original.
  IF m.movement_type = 'adjustment' THEN
    v_qte := abs(m.quantity);
    IF m.quantity > 0 THEN v_source := m.to_warehouse_id; ELSE v_dest := m.to_warehouse_id; END IF;
  ELSE
    v_qte := m.quantity;
    v_source := CASE WHEN m.movement_type IN ('entry', 'return', 'transfer') THEN m.to_warehouse_id END;
    v_dest := CASE WHEN m.movement_type IN ('exit', 'transfer') THEN m.from_warehouse_id END;
  END IF;
  IF v_source IS NOT NULL THEN
    PERFORM public.depot_ecrivable(v_source);
    v_dispo := public.stock_disponible(m.stock_item_id, v_source);
    IF v_qte > v_dispo THEN
      RAISE EXCEPTION 'Annulation impossible : % disponible(s) seulement au depot concerne', v_dispo USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_dest IS NOT NULL THEN PERFORM public.depot_ecrivable(v_dest); END IF;
  INSERT INTO public.stock_movements (movement_number, movement_date, movement_type, stock_item_id, quantity,
    from_warehouse_id, to_warehouse_id, annule_mouvement_id, motif, notes, performed_by)
  VALUES (NULL, now(), 'annulation', m.stock_item_id, v_qte, v_source, v_dest, m.id, v_motif,
          'Annulation de ' || m.movement_number, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'mouvement_stock(uuid, text, integer, uuid, uuid, timestamptz, bigint, text, uuid, uuid, text)',
    'inventorier_stock(uuid, uuid, integer, text)',
    'annuler_mouvement_stock(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;

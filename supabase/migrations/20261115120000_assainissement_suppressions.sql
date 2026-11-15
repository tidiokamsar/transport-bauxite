/*
  # Assainissement P0 des ecrans herites (D-042, LOT 01)

  1. Plus de suppression physique d'un enregistrement metier depuis le
     navigateur. Les politiques `ecriture_module` (FOR ALL, D-012)
     autorisaient DELETE a tout redacteur du module. Le privilege DELETE est
     retire au role `authenticated` sur les tables metier ; les ecrans
     annulent, desactivent, retirent ou cloturent a la place (statut).
     Les lignes de detail modifiables d'un brouillon (purchase_order_items,
     maintenance_parts) et les referentiels sans historique gardent DELETE.
     `trips` reste regi par sa garde de cycle (trips_garde_cycle, LOT 06).
     Les fonctions SECURITY DEFINER et la maintenance (purge de
     demonstration, sans JWT) ne sont pas concernees.

  2. Numero de bon de commande attribue par le serveur : sequence et
     declencheur, format BC-AAAA-NNNNN. Le navigateur ne fabrique plus de
     numero (l'ancien ecran utilisait Math.random).

  Idempotent.
*/

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vehicles', 'trailers', 'vehicle_documents', 'tires', 'drivers', 'weighings', 'incidents',
    'maintenance_orders', 'maintenance_schedules', 'parts_inventory',
    'stock_items', 'stock_movements',
    'purchase_orders', 'suppliers', 'deliveries',
    'invoices', 'invoice_items', 'payments',
    'employees', 'attendance', 'employee_attendance', 'payroll_records',
    'alerts', 'sites', 'geofence_zones'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Table absente, ignoree : %', t;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE DELETE ON public.%I FROM authenticated, anon', t);
  END LOOP;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.purchase_orders_numero_seq;

CREATE OR REPLACE FUNCTION public.numeroter_bon_commande()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF nullif(btrim(coalesce(NEW.po_number, '')), '') IS NULL THEN
    NEW.po_number := 'BC-' || to_char(coalesce(NEW.po_date, current_date), 'YYYY') || '-'
                     || lpad(nextval('public.purchase_orders_numero_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS numeroter_bon_commande ON public.purchase_orders;
CREATE TRIGGER numeroter_bon_commande BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.numeroter_bon_commande();

-- Le numero ne se reecrit pas une fois attribue.
CREATE OR REPLACE FUNCTION public.garde_numero_bon_commande()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.po_number IS DISTINCT FROM OLD.po_number AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Le numero d''un bon de commande ne se modifie pas' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garde_numero_bon_commande ON public.purchase_orders;
CREATE TRIGGER garde_numero_bon_commande BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.garde_numero_bon_commande();

GRANT USAGE, SELECT ON SEQUENCE public.purchase_orders_numero_seq TO authenticated;

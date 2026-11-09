/*
  # Droits par role sur les tables metier (etape 1 de la reprise, D-021)

  Constat (revue du 2026-11-09, verifie en production) : les tables metier
  n'ont qu'une politique « Admins full access ». Tout autre role lit des
  ecrans vides ; `role_permissions` n'a aucune politique, donc le menu des
  autres roles est vide ; `has_module_write` ne verifie pas que le compte
  est actif.

  Correctif, selon la matrice role x module validee (D-010, D-012) :
  1. `has_module_write(module)` : compte actif exige.
  2. `has_module_view(module)` : nouvelle, lecture si `can_view`, compte
     actif exige.
  3. Chaque table metier recoit `lecture_module` (SELECT si
     has_module_view) et `ecriture_module` (ecriture si has_module_write).
     La politique administrateur existante reste.
  4. `role_permissions` lisible par tout utilisateur connecte (la matrice
     n'est pas secrete et pilote les menus) ; `settings` reserve aux
     administrateurs (elle peut contenir des parametres sensibles) ;
     `sites` lisible par tout utilisateur connecte (referentiel),
     modifiable par le module `settings`.

  Limite connue : le perimetre est le module, pas encore le site ni
  l'organisation (LOT 02). Un chauffeur voit tous les voyages.
  Idempotent : fonctions CREATE OR REPLACE, politiques DROP IF EXISTS.
*/

CREATE OR REPLACE FUNCTION public.has_module_write(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.role_permissions rp ON rp.role::text = pr.role::text
    WHERE pr.id = auth.uid()
      AND pr.status = 'active'
      AND rp.module = p_module
      AND (rp.can_create OR rp.can_edit)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_module_view(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.role_permissions rp ON rp.role::text = pr.role::text
    WHERE pr.id = auth.uid()
      AND pr.status = 'active'
      AND rp.module = p_module
      AND rp.can_view
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_module_view(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module_view(text) TO authenticated, service_role;

DO $$
DECLARE
  couple text;
  module text;
  nom_table text;
  correspondances CONSTANT text[] := ARRAY[
    'vehicles|vehicles', 'vehicles|trailers', 'vehicles|vehicle_documents', 'vehicles|tires',
    'drivers|drivers',
    'trips|trips', 'trips|weighings', 'trips|incidents',
    'gps_tracking|vehicle_tracking',
    'fuel|fuel_transactions', 'fuel|fuel_stocks', 'fuel|fuel_types',
    'maintenance|maintenance_orders', 'maintenance|maintenance_schedules', 'maintenance|maintenance_parts',
    'maintenance|parts_inventory', 'maintenance|spare_parts_catalog',
    'stock|stock_items', 'stock|stock_movements', 'stock|stock_categories', 'stock|warehouses',
    'purchases|purchase_orders', 'purchases|purchase_order_items', 'purchases|suppliers', 'purchases|deliveries',
    'invoices|invoices', 'invoices|invoice_items', 'invoices|payments', 'invoices|customers', 'invoices|clients',
    'hr|employees', 'hr|attendance', 'hr|employee_attendance', 'hr|payroll_records',
    'dashboard|alerts'
  ];
BEGIN
  FOREACH couple IN ARRAY correspondances LOOP
    module := split_part(couple, '|', 1);
    nom_table := split_part(couple, '|', 2);
    IF to_regclass('public.' || nom_table) IS NULL THEN
      RAISE NOTICE 'Table absente, ignoree : %', nom_table;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nom_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', nom_table);
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', nom_table);
    EXECUTE format(
      'CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated USING (public.has_module_view(%L))',
      nom_table, module);
    EXECUTE format('DROP POLICY IF EXISTS ecriture_module ON public.%I', nom_table);
    EXECUTE format(
      'CREATE POLICY ecriture_module ON public.%I FOR ALL TO authenticated USING (public.has_module_write(%L)) WITH CHECK (public.has_module_write(%L))',
      nom_table, module, module);
  END LOOP;
END $$;

-- Matrice des droits : lisible pour piloter les menus, modifiable par un
-- administrateur seulement.
GRANT SELECT ON public.role_permissions TO authenticated;
DROP POLICY IF EXISTS lecture_authentifies ON public.role_permissions;
CREATE POLICY lecture_authentifies ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ecriture_admin ON public.role_permissions;
CREATE POLICY ecriture_admin ON public.role_permissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Parametres : administrateurs seulement.
DROP POLICY IF EXISTS administration ON public.settings;
CREATE POLICY administration ON public.settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Sites : referentiel lisible par tous les connectes, modifiable par le
-- module settings.
DROP POLICY IF EXISTS lecture_authentifies ON public.sites;
CREATE POLICY lecture_authentifies ON public.sites
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ecriture_module ON public.sites;
CREATE POLICY ecriture_module ON public.sites
  FOR ALL TO authenticated
  USING (public.has_module_write('settings'))
  WITH CHECK (public.has_module_write('settings'));

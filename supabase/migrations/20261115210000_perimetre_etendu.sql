/*
  # Perimetre site etendu et fuite administrateur corrigee (D-046, lot 6)

  1. Correction : les politiques heritees « Admins full access » (FOR ALL,
     is_admin()) sont permissives et s'additionnent aux politiques bornees
     par site (D-038) : un administrateur affecte a un site lisait encore
     les vehicules, voyages et chauffeurs des autres sites (les ecritures
     etaient deja bloquees par les gardes D-039). Elles sont retirees des
     tables bornees ; l'administrateur garde ses droits a travers les
     politiques `lecture_module` / `ecriture_module` (is_admin() ET perimetre).

  2. Extension du perimetre aux tables operationnelles rattachables a un
     site : pleins (site du plein, sinon de l'engin), ordres et plannings de
     maintenance, pneus et documents (site de l'engin), incidents et pesees
     (site de depart ou d'arrivee du voyage), alertes (site de l'engin).
     Une ligne sans site rattachable n'est visible que des comptes globaux
     (profil sans site), comme pour D-038.

  Idempotent.
*/

CREATE OR REPLACE FUNCTION public.vehicule_permis(p_vehicle uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.site_permis((SELECT v.site_id FROM public.vehicles v WHERE v.id = p_vehicle));
$$;

CREATE OR REPLACE FUNCTION public.voyage_permis(p_trip uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT public.site_permis(t.departure_site_id) OR public.site_permis(t.arrival_site_id)
                     FROM public.trips t WHERE t.id = p_trip), public.site_permis(NULL));
$$;

REVOKE EXECUTE ON FUNCTION public.vehicule_permis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vehicule_permis(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.voyage_permis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.voyage_permis(uuid) TO authenticated, service_role;

-- 1. Retrait des politiques administrateur non bornees
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles', 'trips', 'drivers', 'fuel_transactions', 'maintenance_orders',
                           'maintenance_schedules', 'tires', 'vehicle_documents', 'incidents', 'weighings', 'alerts'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ecriture_roles_metier ON public.%I', t);
  END LOOP;
END $$;

-- 2. Politiques bornees : (droit du module ou administrateur) et perimetre.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('fuel_transactions', 'fuel', 'fuel', 'CASE WHEN site_id IS NOT NULL THEN public.site_permis(site_id) ELSE public.vehicule_permis(vehicle_id) END'),
    ('maintenance_orders', 'maintenance', 'maintenance', 'CASE WHEN site_id IS NOT NULL THEN public.site_permis(site_id) ELSE public.vehicule_permis(vehicle_id) END'),
    ('maintenance_schedules', 'maintenance', 'maintenance', 'public.vehicule_permis(vehicle_id)'),
    ('tires', 'vehicles', 'vehicles', 'public.vehicule_permis(vehicle_id)'),
    ('vehicle_documents', 'vehicles', 'vehicles', 'public.vehicule_permis(vehicle_id)'),
    ('incidents', 'trips', 'trips', 'public.voyage_permis(trip_id)'),
    ('weighings', 'trips', 'trips', 'public.voyage_permis(trip_id)'),
    ('alerts', 'dashboard', 'dashboard', 'public.vehicule_permis(vehicle_id)')
  ) AS x(nom_table, module_lecture, module_ecriture, perimetre)
  LOOP
    IF to_regclass('public.' || r.nom_table) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', r.nom_table);
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated
      USING ((public.has_module_view(%L) OR public.is_admin()) AND (%s))', r.nom_table, r.module_lecture, r.perimetre);
    EXECUTE format('DROP POLICY IF EXISTS ecriture_module ON public.%I', r.nom_table);
    EXECUTE format('CREATE POLICY ecriture_module ON public.%I FOR ALL TO authenticated
      USING ((public.has_module_write(%L) OR public.is_admin()) AND (%s))
      WITH CHECK ((public.has_module_write(%L) OR public.is_admin()) AND (%s))',
      r.nom_table, r.module_ecriture, r.perimetre, r.module_ecriture, r.perimetre);
  END LOOP;
END $$;

-- Les alertes restent lisibles par le module de suivi GPS (regime anterieur).
DROP POLICY IF EXISTS lecture_suivi ON public.alerts;
CREATE POLICY lecture_suivi ON public.alerts FOR SELECT TO authenticated
  USING (public.has_module_view('gps_tracking') AND public.vehicule_permis(vehicle_id));

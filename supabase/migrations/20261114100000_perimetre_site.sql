/*
  # Perimetre site dans le modele d'acces (D-038, LOT 02 phase 1)

  Constat (audit, ecarts P1) : la RLS filtre par role et module, mais sans
  portee par site : un compte autorise sur un module lit tous les sites.
  Sortie du bloqueur « avant multi-site » : phase 1 de la portee.

  1. `organisations` : referentiel (raison sociale, statut). Lecture pour
     tout compte connecte (referentiel), ecriture administrative seulement.
     `sites.organisation_id` rattache chaque site a son organisation ;
     une organisation unique est reprise depuis la fiche societe si elle
     existe (D-027), sinon rien n'est invente : elle sera saisie.
  2. `drivers.site_id` : colonne nullable, meme sens que vehicles.site_id.
  3. `site_permis(site)` : un compte actif dont profiles.site_id est NULL
     est global (tout voit, comme aujourd'hui) ; un compte affecte a un
     site ne voit que les lignes de son site ; une ligne sans site reste
     visible des seuls comptes globaux (strict plutot que permissif).
  4. Policies de lecture bornées par le site sur les tables operationnelles
     phase 1 : vehicles, trips (depart OU arrivee), drivers, fiches_terrain.
     Ecriture de vehicles bornee pareillement. Les fonctions serveur
     (creer_voyage, saisie des fiches...) ne sont pas encore bornees :
     phase 2, consignee en limite.

  Les droits fonctionnels (matrice role x module, D-012 ; attributions par
  utilisateur, D-036) restent le premier filtre : le perimetre site est le
  second. Aucune donnee inventee ; sans affectation de site, comportement
  inchangé.

  Idempotent : IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, DROP POLICY IF
  EXISTS + CREATE.
*/

-- 1. Referentiel organisations.
CREATE TABLE IF NOT EXISTS public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale text NOT NULL UNIQUE,
  statut text NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'inactive')),
  note text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organisations FROM anon;
GRANT SELECT ON public.organisations TO authenticated;
GRANT ALL ON public.organisations TO service_role;
DROP POLICY IF EXISTS lecture_authentifies ON public.organisations;
CREATE POLICY lecture_authentifies ON public.organisations
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS administration ON public.organisations;
CREATE POLICY administration ON public.organisations
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Rattachement des sites a une organisation ; reprise de la fiche societe
-- (D-027) si elle est renseignee, sinon a saisir dans Parametres.
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS organisation_id uuid
  REFERENCES public.organisations(id);
CREATE INDEX IF NOT EXISTS idx_sites_organisation ON public.sites (organisation_id);

DO $$
DECLARE
  v_org uuid;
  v_raison text;
BEGIN
  SELECT nullif(btrim(raison_sociale), '') INTO v_raison
    FROM public.societe WHERE id = 1;
  IF v_raison IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organisations) THEN
    INSERT INTO public.organisations (raison_sociale)
    VALUES (v_raison)
    ON CONFLICT (raison_sociale) DO NOTHING
    RETURNING id INTO v_org;
    IF v_org IS NULL THEN
      SELECT id INTO v_org FROM public.organisations WHERE raison_sociale = v_raison;
    END IF;
    UPDATE public.sites SET organisation_id = v_org WHERE organisation_id IS NULL;
  END IF;
END $$;

-- Sites : l'organisation se gere avec le module settings (comme le site ;
-- la policy ecriture_module existante couvre deja l'ecriture).
GRANT UPDATE (organisation_id) ON public.sites TO authenticated;

-- 2. Site des chauffeurs (nullable, meme sens que vehicles.site_id).
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS site_id uuid
  REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_drivers_site ON public.drivers (site_id);

-- 3. Perimetre : global (site NULL sur le profil) ou son site seulement.
CREATE OR REPLACE FUNCTION public.site_permis(p_site uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles pr
     WHERE pr.id = auth.uid()
       AND pr.status = 'active'
       AND (pr.site_id IS NULL OR pr.site_id = p_site)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.site_permis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_permis(uuid) TO authenticated, service_role;

-- 4. Policies bornees, tables operationnelles phase 1.
DROP POLICY IF EXISTS lecture_module ON public.vehicles;
CREATE POLICY lecture_module ON public.vehicles
  FOR SELECT TO authenticated
  USING ((public.has_module_view('vehicles') OR public.is_admin())
         AND public.site_permis(site_id));

DROP POLICY IF EXISTS ecriture_module ON public.vehicles;
CREATE POLICY ecriture_module ON public.vehicles
  FOR ALL TO authenticated
  USING ((public.has_module_write('vehicles') OR public.is_admin())
         AND public.site_permis(site_id))
  WITH CHECK ((public.has_module_write('vehicles') OR public.is_admin())
         AND public.site_permis(site_id));

DROP POLICY IF EXISTS lecture_module ON public.trips;
CREATE POLICY lecture_module ON public.trips
  FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.is_admin())
         AND (public.site_permis(departure_site_id) OR public.site_permis(arrival_site_id)));
-- Ecriture trips : la policy FOR ALL heritee (D-021) s'appliquait aussi au
-- SELECT et passait outre le perimetre ; bornee pareillement.
DROP POLICY IF EXISTS ecriture_module ON public.trips;
CREATE POLICY ecriture_module ON public.trips
  FOR ALL TO authenticated
  USING ((public.has_module_write('trips') OR public.is_admin())
         AND (public.site_permis(departure_site_id) OR public.site_permis(arrival_site_id)))
  WITH CHECK ((public.has_module_write('trips') OR public.is_admin())
         AND (public.site_permis(departure_site_id) OR public.site_permis(arrival_site_id)));

DROP POLICY IF EXISTS lecture_module ON public.drivers;
CREATE POLICY lecture_module ON public.drivers
  FOR SELECT TO authenticated
  USING ((public.has_module_view('drivers') OR public.is_admin())
         AND public.site_permis(site_id));
DROP POLICY IF EXISTS ecriture_module ON public.drivers;
CREATE POLICY ecriture_module ON public.drivers
  FOR ALL TO authenticated
  USING ((public.has_module_write('drivers') OR public.is_admin())
         AND public.site_permis(site_id))
  WITH CHECK ((public.has_module_write('drivers') OR public.is_admin())
         AND public.site_permis(site_id));

DROP POLICY IF EXISTS lecture_module ON public.fiches_terrain;
CREATE POLICY lecture_module ON public.fiches_terrain
  FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('maintenance')
          OR public.has_module_view('fuel') OR public.is_admin())
         AND public.site_permis(site_id));

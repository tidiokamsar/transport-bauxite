/*
  # Infrastructures de site et fermetures temporaires (D-047, lot 7,
  # module 03 du mandat ; scenario « depot ferme »)

  1. `infrastructures_site` : points de chargement, depots de reception,
     ponts-bascules, stations carburant, ateliers, zones de securite,
     rattaches a un site, avec une capacite optionnelle exprimee dans une
     unite explicite (jamais deduite). Archivage, pas de suppression.
  2. `fermetures_site` : fermeture d'un site (ou d'une infrastructure) sur
     une periode, avec motif ; levee anticipee motivee, jamais supprimee.
  3. Contrainte au dispatch : une affectation (acceptee ou modifiee) est
     refusee si le site de depart ou d'arrivee du voyage est ferme a la date
     du voyage. Declencheur sur `decisions_dispatch`, la fonction
     `decider_affectation` (D-024) reste inchangee ; le refus annule toute
     la decision.

  Ecriture : module settings (referentiel des sites, D-012) ou
  administrateur, et perimetre `site_permis`. Lecture : tout compte
  connecte du perimetre (les fermetures conditionnent l'exploitation).
  Idempotent.
*/

CREATE TABLE IF NOT EXISTS public.infrastructures_site (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  type text NOT NULL CHECK (type IN ('point_chargement', 'depot_reception', 'pont_bascule',
                                     'station_carburant', 'atelier', 'zone_securite')),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  capacite numeric CHECK (capacite IS NULL OR capacite > 0),
  unite_capacite text,
  actif boolean NOT NULL DEFAULT true,
  note text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  CHECK ((capacite IS NULL) = (unite_capacite IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_infrastructures_site ON public.infrastructures_site(site_id);

CREATE TABLE IF NOT EXISTS public.fermetures_site (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  infrastructure_id uuid REFERENCES public.infrastructures_site(id),
  debut timestamptz NOT NULL,
  fin timestamptz,
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  levee_le timestamptz,
  motif_levee text,
  declare_par uuid REFERENCES auth.users(id),
  declare_le timestamptz NOT NULL DEFAULT now(),
  CHECK (fin IS NULL OR fin > debut),
  CHECK ((levee_le IS NULL) = (motif_levee IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_fermetures_site ON public.fermetures_site(site_id, debut);

-- Fermeture effective d'un site a une date : fermeture du site entier (sans
-- infrastructure) qui couvre la journee, non levee avant cette journee.
CREATE OR REPLACE FUNCTION public.site_ferme_le(p_site uuid, p_jour date)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT f.motif FROM public.fermetures_site f
   WHERE f.site_id = p_site AND f.infrastructure_id IS NULL
     AND f.debut < (p_jour + 1)::timestamptz
     AND coalesce(least(f.fin, f.levee_le), 'infinity'::timestamptz) > p_jour::timestamptz
   ORDER BY f.debut DESC LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.site_ferme_le(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_ferme_le(uuid, date) TO authenticated, service_role;

-- Droits
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['infrastructures_site', 'fermetures_site'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture ON public.%I FOR SELECT TO authenticated USING (public.site_permis(site_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS creation ON public.%I', t);
    EXECUTE format('CREATE POLICY creation ON public.%I FOR INSERT TO authenticated
      WITH CHECK ((public.has_module_write(''settings'') OR public.is_admin()) AND public.site_permis(site_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS modification ON public.%I', t);
    EXECUTE format('CREATE POLICY modification ON public.%I FOR UPDATE TO authenticated
      USING ((public.has_module_write(''settings'') OR public.is_admin()) AND public.site_permis(site_id))
      WITH CHECK ((public.has_module_write(''settings'') OR public.is_admin()) AND public.site_permis(site_id))', t);
  END LOOP;
END $$;
GRANT INSERT (id, site_id, type, code, libelle, capacite, unite_capacite, actif, note, cree_par),
      UPDATE (libelle, capacite, unite_capacite, actif, note)
  ON public.infrastructures_site TO authenticated;
GRANT INSERT (id, site_id, infrastructure_id, debut, fin, motif, declare_par),
      UPDATE (levee_le, motif_levee)
  ON public.fermetures_site TO authenticated;

-- Une fermeture se leve une fois, avec motif ; ses dates ne changent pas.
CREATE OR REPLACE FUNCTION public.garde_fermeture_site()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF OLD.levee_le IS NOT NULL THEN
    RAISE EXCEPTION 'Fermeture deja levee' USING ERRCODE = '22023';
  END IF;
  IF NEW.levee_le IS NULL OR nullif(btrim(coalesce(NEW.motif_levee, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Levee : date et motif requis' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_fermeture ON public.fermetures_site;
CREATE TRIGGER garde_fermeture BEFORE UPDATE ON public.fermetures_site
  FOR EACH ROW EXECUTE FUNCTION public.garde_fermeture_site();

-- Contrainte au dispatch : pas d'affectation vers ou depuis un site ferme.
CREATE OR REPLACE FUNCTION public.garde_dispatch_site_ferme()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE t public.trips; v_motif text;
BEGIN
  IF NEW.decision = 'refusee' THEN RETURN NEW; END IF;
  SELECT * INTO t FROM public.trips WHERE id = NEW.trip_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_motif := coalesce(public.site_ferme_le(t.departure_site_id, t.planned_date),
                      public.site_ferme_le(t.arrival_site_id, t.planned_date));
  IF v_motif IS NOT NULL THEN
    RAISE EXCEPTION 'Site ferme le % : % (affectation refusee)', to_char(t.planned_date, 'DD/MM/YYYY'), v_motif
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_site_ferme ON public.decisions_dispatch;
CREATE TRIGGER garde_site_ferme BEFORE INSERT ON public.decisions_dispatch
  FOR EACH ROW EXECUTE FUNCTION public.garde_dispatch_site_ferme();

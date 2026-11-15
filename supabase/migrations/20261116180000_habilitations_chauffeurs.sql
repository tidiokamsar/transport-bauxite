/*
  # Habilitations des chauffeurs (D-051, lot 11, module 09 ; scenario
  # « chauffeur non habilite »)

  1. `habilitations_chauffeur` : visite medicale, formation securite,
     habilitation a un type d'engin, acces a un site, autre ; numero, dates
     de delivrance et d'expiration, piece justificative. Une habilitation
     ne se supprime pas : elle est revoquee avec motif ; une nouvelle
     habilitation remplace l'ancienne a son expiration.
  2. `habilitations_requises` (referentiel administrateur) : types exiges
     pour etre affecte a un voyage. Sans exigence parametree, seule la
     regle existante s'applique (permis valide, D-024).
  3. Contrainte au dispatch : declencheur sur `decisions_dispatch` qui
     refuse une affectation acceptee ou modifiee si le chauffeur n'a pas,
     pour chaque type exige, une habilitation valide a la date du voyage.
  4. `v_habilitations_a_renouveler` : habilitations expirees ou expirant
     sous 30 jours (alertes d'expiration).

  Ecriture : module drivers et perimetre du chauffeur (site_permis) ;
  referentiel des exigences : administrateur. Idempotent.
*/

CREATE TABLE IF NOT EXISTS public.habilitations_chauffeur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id),
  type text NOT NULL CHECK (type IN ('visite_medicale', 'formation_securite', 'habilitation_engin', 'acces_site', 'autre')),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  numero text,
  delivre_le date NOT NULL,
  expire_le date,
  document_ref text,
  revoque_le timestamptz,
  motif_revocation text,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now(),
  CHECK (expire_le IS NULL OR expire_le >= delivre_le),
  CHECK ((revoque_le IS NULL) = (motif_revocation IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_habilitations_chauffeur ON public.habilitations_chauffeur(driver_id, type);

CREATE TABLE IF NOT EXISTS public.habilitations_requises (
  type text PRIMARY KEY CHECK (type IN ('visite_medicale', 'formation_securite', 'habilitation_engin', 'acces_site', 'autre')),
  note text,
  defini_par uuid REFERENCES auth.users(id),
  defini_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.habilitations_chauffeur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habilitations_requises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.habilitations_chauffeur, public.habilitations_requises FROM anon, authenticated;
GRANT SELECT ON public.habilitations_chauffeur, public.habilitations_requises TO authenticated;
GRANT ALL ON public.habilitations_chauffeur, public.habilitations_requises TO service_role;
GRANT INSERT (id, driver_id, type, libelle, numero, delivre_le, expire_le, document_ref, saisi_par),
      UPDATE (revoque_le, motif_revocation)
  ON public.habilitations_chauffeur TO authenticated;
GRANT INSERT, DELETE ON public.habilitations_requises TO authenticated;

DROP POLICY IF EXISTS lecture ON public.habilitations_chauffeur;
CREATE POLICY lecture ON public.habilitations_chauffeur FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id));
DROP POLICY IF EXISTS creation ON public.habilitations_chauffeur;
CREATE POLICY creation ON public.habilitations_chauffeur FOR INSERT TO authenticated
  WITH CHECK ((public.has_module_write('drivers') OR public.is_admin())
              AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.site_permis(d.site_id)));
DROP POLICY IF EXISTS revocation ON public.habilitations_chauffeur;
CREATE POLICY revocation ON public.habilitations_chauffeur FOR UPDATE TO authenticated
  USING ((public.has_module_write('drivers') OR public.is_admin())
         AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.site_permis(d.site_id)))
  WITH CHECK (true);
DROP POLICY IF EXISTS lecture ON public.habilitations_requises;
CREATE POLICY lecture ON public.habilitations_requises FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS administration ON public.habilitations_requises;
CREATE POLICY administration ON public.habilitations_requises FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Une revocation est definitive et motivee.
CREATE OR REPLACE FUNCTION public.garde_habilitation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF OLD.revoque_le IS NOT NULL THEN
    RAISE EXCEPTION 'Habilitation deja revoquee' USING ERRCODE = '22023';
  END IF;
  IF NEW.revoque_le IS NULL OR nullif(btrim(coalesce(NEW.motif_revocation, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Revocation : date et motif requis' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_habilitation ON public.habilitations_chauffeur;
CREATE TRIGGER garde_habilitation BEFORE UPDATE ON public.habilitations_chauffeur
  FOR EACH ROW EXECUTE FUNCTION public.garde_habilitation();

-- Types exiges manquants pour un chauffeur a une date (NULL si conforme).
CREATE OR REPLACE FUNCTION public.habilitations_manquantes(p_driver uuid, p_jour date)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT string_agg(r.type, ', ' ORDER BY r.type)
    FROM public.habilitations_requises r
   WHERE NOT EXISTS (
     SELECT 1 FROM public.habilitations_chauffeur h
      WHERE h.driver_id = p_driver AND h.type = r.type AND h.delivre_le <= p_jour
        AND (h.expire_le IS NULL OR h.expire_le >= p_jour)
        AND (h.revoque_le IS NULL OR h.revoque_le::date > p_jour));
$$;
REVOKE EXECUTE ON FUNCTION public.habilitations_manquantes(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.habilitations_manquantes(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.garde_dispatch_habilitations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE t public.trips; v_manque text;
BEGIN
  IF NEW.decision = 'refusee' OR NEW.driver_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO t FROM public.trips WHERE id = NEW.trip_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_manque := public.habilitations_manquantes(NEW.driver_id, t.planned_date);
  IF v_manque IS NOT NULL THEN
    RAISE EXCEPTION 'Chauffeur non habilite le % : % manquant(s)', to_char(t.planned_date, 'DD/MM/YYYY'), v_manque
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_habilitations ON public.decisions_dispatch;
CREATE TRIGGER garde_habilitations BEFORE INSERT ON public.decisions_dispatch
  FOR EACH ROW EXECUTE FUNCTION public.garde_dispatch_habilitations();

CREATE OR REPLACE VIEW public.v_habilitations_a_renouveler WITH (security_invoker = true) AS
SELECT h.id, h.driver_id, h.type, h.libelle, h.expire_le, (h.expire_le - current_date) AS jours_restants
  FROM public.habilitations_chauffeur h
 WHERE h.revoque_le IS NULL AND h.expire_le IS NOT NULL AND h.expire_le <= current_date + 30
   AND NOT EXISTS (SELECT 1 FROM public.habilitations_chauffeur n
                    WHERE n.driver_id = h.driver_id AND n.type = h.type AND n.revoque_le IS NULL
                      AND n.delivre_le > h.delivre_le AND (n.expire_le IS NULL OR n.expire_le > current_date + 30));
GRANT SELECT ON public.v_habilitations_a_renouveler TO authenticated;

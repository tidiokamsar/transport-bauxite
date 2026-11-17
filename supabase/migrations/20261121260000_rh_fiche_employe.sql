/*
  D-094 : RH, lot 1, fiche employe.

  - employees.site_id (additif) : perimetre de site (D-038) ; NULL = employe
    global, visible des seuls profils globaux (site_permis).
  - Aucune valeur par defaut inventee : base_salary et hire_date perdent
    leur defaut Bolt (0 et la date du jour). Aucune ligne existante n'est
    modifiee.
  - Ecriture par fonctions serveur seulement (droit 'hr' + site_permis) :
    enregistrer_employe (creation et modification), changer_statut_employe
    (suspension, desactivation, reactivation, motif obligatoire). Les
    politiques d'ecriture directe sont retirees ; DELETE deja revoque
    (20261115120000) : jamais de suppression physique.
  - journal_employes : journal append-only (avant, apres, motif, auteur).
*/

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_employees_site ON public.employees (site_id);
ALTER TABLE public.employees ALTER COLUMN base_salary DROP DEFAULT;
ALTER TABLE public.employees ALTER COLUMN hire_date DROP DEFAULT;
COMMENT ON COLUMN public.employees.base_salary IS 'Salaire de base en GNF ; NULL si non saisi (D-094), jamais 0 par defaut.';

-- Lecture : module hr (ou administrateur) dans le perimetre de site.
DROP POLICY IF EXISTS "Admins full access" ON public.employees;
DROP POLICY IF EXISTS ecriture_module ON public.employees;
DROP POLICY IF EXISTS lecture_module ON public.employees;
CREATE POLICY lecture_module ON public.employees
  FOR SELECT TO authenticated
  USING ((public.has_module_view('hr') OR public.is_admin()) AND public.site_permis(site_id));
REVOKE INSERT, UPDATE, DELETE ON public.employees FROM authenticated, anon;
GRANT SELECT ON public.employees TO authenticated;

-- Journal append-only.
CREATE TABLE IF NOT EXISTS public.journal_employes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  action text NOT NULL CHECK (action IN ('creation', 'modification', 'suspension', 'desactivation', 'reactivation')),
  avant jsonb,
  apres jsonb,
  motif text,
  auteur uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_employes_employe ON public.journal_employes (employee_id, le);
ALTER TABLE public.journal_employes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.journal_employes FROM authenticated, anon;
GRANT SELECT ON public.journal_employes TO authenticated;
GRANT ALL ON public.journal_employes TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.journal_employes;
CREATE POLICY lecture_module ON public.journal_employes
  FOR SELECT TO authenticated
  USING ((public.has_module_view('hr') OR public.is_admin())
         AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.site_permis(e.site_id)));

CREATE OR REPLACE FUNCTION public.journal_employes_immuable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Journal des employes : ni modification ni suppression' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS journal_employes_immuable ON public.journal_employes;
CREATE TRIGGER journal_employes_immuable
  BEFORE UPDATE OR DELETE ON public.journal_employes
  FOR EACH ROW EXECUTE FUNCTION public.journal_employes_immuable();

-- Creation (p_id NULL) ou modification. Le statut ne change pas ici.
CREATE OR REPLACE FUNCTION public.enregistrer_employe(p_id uuid, p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avant public.employees;
  v_apres public.employees;
  v_id uuid;
  v_numero text := nullif(btrim(coalesce(p->>'employee_number', '')), '');
  v_prenom text := nullif(btrim(coalesce(p->>'first_name', '')), '');
  v_nom text := nullif(btrim(coalesce(p->>'last_name', '')), '');
  v_poste text := nullif(btrim(coalesce(p->>'position', '')), '');
  v_dept text := nullif(btrim(coalesce(p->>'department', '')), '');
  v_genre text := nullif(btrim(coalesce(p->>'gender', '')), '');
  v_site uuid := nullif(btrim(coalesce(p->>'site_id', '')), '')::uuid;
  v_embauche date := nullif(btrim(coalesce(p->>'hire_date', '')), '')::date;
  v_naissance date := nullif(btrim(coalesce(p->>'date_of_birth', '')), '')::date;
  v_salaire_txt text := nullif(btrim(coalesce(p->>'base_salary', '')), '');
  v_salaire bigint;
BEGIN
  IF NOT public.has_module_write('hr') THEN
    RAISE EXCEPTION 'Droit d''ecriture RH requis' USING ERRCODE = '42501';
  END IF;
  IF v_numero IS NULL OR v_prenom IS NULL OR v_nom IS NULL OR v_poste IS NULL OR v_dept IS NULL OR v_embauche IS NULL THEN
    RAISE EXCEPTION 'Matricule, prenom, nom, poste, departement et date d''embauche sont requis' USING ERRCODE = '22023';
  END IF;
  IF v_genre IS NOT NULL AND v_genre NOT IN ('male', 'female', 'other') THEN
    RAISE EXCEPTION 'Genre inconnu' USING ERRCODE = '22023';
  END IF;
  IF v_naissance IS NOT NULL AND v_naissance >= v_embauche THEN
    RAISE EXCEPTION 'La date de naissance doit preceder l''embauche' USING ERRCODE = '22023';
  END IF;
  IF v_salaire_txt IS NOT NULL THEN
    IF v_salaire_txt !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Salaire de base : entier positif en GNF attendu' USING ERRCODE = '22023';
    END IF;
    v_salaire := v_salaire_txt::bigint;
  END IF;
  IF v_site IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = v_site) THEN
    RAISE EXCEPTION 'Site inconnu' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(v_site) THEN
    RAISE EXCEPTION 'Site hors de votre perimetre' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.employees (employee_number, first_name, last_name, date_of_birth, gender, national_id,
      "position", department, hire_date, phone, email, address, base_salary, bank_name, bank_account,
      emergency_contact_name, emergency_contact_phone, status, notes, site_id)
    VALUES (v_numero, v_prenom, v_nom, v_naissance, v_genre, nullif(btrim(coalesce(p->>'national_id', '')), ''),
      v_poste, v_dept, v_embauche, nullif(btrim(coalesce(p->>'phone', '')), ''), nullif(btrim(coalesce(p->>'email', '')), ''),
      nullif(btrim(coalesce(p->>'address', '')), ''), v_salaire, nullif(btrim(coalesce(p->>'bank_name', '')), ''),
      nullif(btrim(coalesce(p->>'bank_account', '')), ''), nullif(btrim(coalesce(p->>'emergency_contact_name', '')), ''),
      nullif(btrim(coalesce(p->>'emergency_contact_phone', '')), ''), 'active', nullif(btrim(coalesce(p->>'notes', '')), ''), v_site)
    RETURNING * INTO v_apres;
    INSERT INTO public.journal_employes (employee_id, action, avant, apres, auteur)
    VALUES (v_apres.id, 'creation', NULL, to_jsonb(v_apres) - 'updated_at' - 'created_at', auth.uid());
    RETURN v_apres.id;
  END IF;

  SELECT * INTO v_avant FROM public.employees WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(v_avant.site_id) THEN
    RAISE EXCEPTION 'Employe introuvable ou hors de votre perimetre' USING ERRCODE = '22023';
  END IF;
  UPDATE public.employees SET
    employee_number = v_numero, first_name = v_prenom, last_name = v_nom, date_of_birth = v_naissance,
    gender = v_genre, national_id = nullif(btrim(coalesce(p->>'national_id', '')), ''), "position" = v_poste,
    department = v_dept, hire_date = v_embauche, phone = nullif(btrim(coalesce(p->>'phone', '')), ''),
    email = nullif(btrim(coalesce(p->>'email', '')), ''), address = nullif(btrim(coalesce(p->>'address', '')), ''),
    base_salary = v_salaire, bank_name = nullif(btrim(coalesce(p->>'bank_name', '')), ''),
    bank_account = nullif(btrim(coalesce(p->>'bank_account', '')), ''),
    emergency_contact_name = nullif(btrim(coalesce(p->>'emergency_contact_name', '')), ''),
    emergency_contact_phone = nullif(btrim(coalesce(p->>'emergency_contact_phone', '')), ''),
    notes = nullif(btrim(coalesce(p->>'notes', '')), ''), site_id = v_site, updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_apres;
  v_id := p_id;
  IF (to_jsonb(v_avant) - 'updated_at') IS DISTINCT FROM (to_jsonb(v_apres) - 'updated_at') THEN
    INSERT INTO public.journal_employes (employee_id, action, avant, apres, auteur)
    VALUES (v_id, 'modification', to_jsonb(v_avant) - 'updated_at' - 'created_at', to_jsonb(v_apres) - 'updated_at' - 'created_at', auth.uid());
  END IF;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enregistrer_employe(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_employe(uuid, jsonb) TO authenticated;

-- Suspension, desactivation (sortie des effectifs), reactivation : motif
-- obligatoire (3 caracteres au moins), journalise.
CREATE OR REPLACE FUNCTION public.changer_statut_employe(p_id uuid, p_action text, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avant public.employees;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_statut text;
BEGIN
  IF NOT public.has_module_write('hr') THEN
    RAISE EXCEPTION 'Droit d''ecriture RH requis' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL OR length(v_motif) < 3 THEN
    RAISE EXCEPTION 'Motif requis (3 caracteres au moins)' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_avant FROM public.employees WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(v_avant.site_id) THEN
    RAISE EXCEPTION 'Employe introuvable ou hors de votre perimetre' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'suspension' AND v_avant.status IN ('active', 'on_leave') THEN v_statut := 'suspended';
  ELSIF p_action = 'desactivation' AND v_avant.status IN ('active', 'on_leave', 'suspended') THEN v_statut := 'terminated';
  ELSIF p_action = 'reactivation' AND v_avant.status IN ('suspended', 'terminated') THEN v_statut := 'active';
  ELSE
    RAISE EXCEPTION 'Action % impossible pour un employe au statut %', p_action, v_avant.status USING ERRCODE = '22023';
  END IF;
  UPDATE public.employees SET status = v_statut, updated_at = now() WHERE id = p_id;
  INSERT INTO public.journal_employes (employee_id, action, avant, apres, motif, auteur)
  VALUES (p_id, p_action, jsonb_build_object('status', v_avant.status), jsonb_build_object('status', v_statut), v_motif, auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.changer_statut_employe(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.changer_statut_employe(uuid, text, text) TO authenticated;

/*
  # Tables lues par l'interface et absentes de la base de reference (D-017)

  Constat (SIGTB_2.0_HEBERGEMENT_VPS.md, section 5.1) :
  - `costs` et `departments` etaient creees par des migrations Bolt qui
    echouent (20251023120246, 20251023120423) ; ecrans Couts, Tableau de
    bord, Rapports et fiche employe ;
  - `cost_categories` n'a qu'une politique administrateur : les autres
    roles ne voient aucune categorie dans la saisie d'un cout ;
  - `user_preferences` a la RLS active sans aucune politique : la langue
    choisie n'est jamais enregistree.

  Regle 2 : RLS active, aucune politique `FOR ALL USING (true)`. Lecture par
  tout utilisateur connecte, comme le reste de la base tant que le
  perimetre organisation x site n'existe pas (LOT 02) ; ecriture via
  `has_module_write` (module `costs` ou `hr`).

  Structure reprise des migrations Bolt, sans aucune donnee.
  Idempotent.
*/

CREATE TABLE IF NOT EXISTS public.costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES public.cost_categories(id),
  vehicle_id uuid REFERENCES public.vehicles(id),
  description text NOT NULL,
  amount numeric NOT NULL,
  reference text,
  payment_method text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_costs_date ON public.costs(date);
CREATE INDEX IF NOT EXISTS idx_costs_category ON public.costs(category_id);
CREATE INDEX IF NOT EXISTS idx_costs_vehicle ON public.costs(vehicle_id);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.costs, public.departments TO authenticated;
GRANT ALL ON public.costs, public.departments TO service_role;

-- costs : lecture connectee, ecriture module costs.
DROP POLICY IF EXISTS lecture_authentifies ON public.costs;
CREATE POLICY lecture_authentifies ON public.costs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ecriture_roles_metier ON public.costs;
CREATE POLICY ecriture_roles_metier ON public.costs
  FOR ALL TO authenticated
  USING (public.has_module_write('costs'))
  WITH CHECK (public.has_module_write('costs'));

-- cost_categories : meme regle (la politique administrateur reste).
DROP POLICY IF EXISTS lecture_authentifies ON public.cost_categories;
CREATE POLICY lecture_authentifies ON public.cost_categories
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ecriture_roles_metier ON public.cost_categories;
CREATE POLICY ecriture_roles_metier ON public.cost_categories
  FOR ALL TO authenticated
  USING (public.has_module_write('costs'))
  WITH CHECK (public.has_module_write('costs'));

-- departments : lecture connectee, ecriture module hr.
DROP POLICY IF EXISTS lecture_authentifies ON public.departments;
CREATE POLICY lecture_authentifies ON public.departments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ecriture_roles_metier ON public.departments;
CREATE POLICY ecriture_roles_metier ON public.departments
  FOR ALL TO authenticated
  USING (public.has_module_write('hr'))
  WITH CHECK (public.has_module_write('hr'));

-- user_preferences : chacun ne voit et ne modifie que sa ligne.
DROP POLICY IF EXISTS preferences_proprietaire ON public.user_preferences;
CREATE POLICY preferences_proprietaire ON public.user_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

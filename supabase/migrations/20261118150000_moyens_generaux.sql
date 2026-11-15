/*
  # Moyens generaux et patrimoine (D-060, lot 21, module 18)

  Cartographie prealable : la base de reference n'a aucune table d'actifs,
  d'equipements ou de mobilier (seuls `parts_inventory` et `tire_inventory`,
  propres aux pieces et aux pneus) ; aucune table n'est reprise.

  1. `biens`, registre du patrimoine : numero d'inventaire unique (casse
     ignoree), categorie (informatique, mobilier, equipement, outillage,
     vehicule_administratif, autre), designation, marque, modele, numero de
     serie, immatriculation, date et valeur d'acquisition et duree
     d'amortissement saisies ou absentes (aucune valeur par defaut),
     fournisseur, site. Statut, site, beneficiaire et etat physique sont un
     cache recalcule depuis le journal par `recalculer_bien`.
  2. `biens_operations`, journal append-only : entree, affectation (a une
     personne ou un service), remise (au beneficiaire), restitution,
     transfert entre sites, constat d'etat, reparation, reforme motivee,
     fiche (modification motivee de la fiche, valeurs avant et apres),
     annulation motivee de la derniere operation. L'entree et la fiche ne
     s'annulent pas : un bien enregistre par erreur se reforme avec motif,
     une fiche se corrige par une nouvelle modification.
     Cycle : en stock -> affecte -> remis -> (restitution) en stock ;
     transfert et reforme depuis le stock seulement.
  3. Inventaire physique par site : `inventaires_biens` (campagne, une seule
     ouverte par site), `inventaires_biens_lignes` (bien constate, bien d'un
     autre site, bien reforme retrouve, bien non reference ; a la cloture,
     une ligne `manquant` par bien attendu non constate). Les ecarts sont
     signales, jamais regularises automatiquement (CDC 11.5) : la
     regularisation passe par les operations du registre.
  4. `v_biens` : amortissement lineaire seulement si valeur, date
     d'acquisition et duree sont saisies (sinon NULL, affiche sans donnees),
     arrete a la date de reforme.

  Droit : module `stock` (logistique et magasin : ecriture admin, director,
  logistician ; lecture des roles d'exploitation et de la comptabilite).
  Perimetre : `site_permis` sur le site du bien ou de la campagne ; un
  transfert exige aussi le site de destination. Ecriture par fonctions
  SECURITY DEFINER uniquement. Idempotent.
*/

-- 1. Registre
CREATE TABLE IF NOT EXISTS public.biens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_inventaire text NOT NULL CHECK (btrim(numero_inventaire) <> ''),
  categorie text NOT NULL CHECK (categorie IN ('informatique', 'mobilier', 'equipement', 'outillage', 'vehicule_administratif', 'autre')),
  designation text NOT NULL CHECK (btrim(designation) <> ''),
  marque text,
  modele text,
  numero_serie text,
  immatriculation text,
  date_acquisition date,
  valeur_acquisition bigint CHECK (valeur_acquisition IS NULL OR valeur_acquisition >= 0),
  duree_amortissement_mois integer CHECK (duree_amortissement_mois IS NULL OR duree_amortissement_mois > 0),
  fournisseur_id uuid REFERENCES public.suppliers(id),
  note text,
  statut text NOT NULL CHECK (statut IN ('en_stock', 'affecte', 'remis', 'reforme')),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  beneficiaire_type text CHECK (beneficiaire_type IS NULL OR beneficiaire_type IN ('personne', 'service')),
  beneficiaire text,
  etat_physique text CHECK (etat_physique IS NULL OR etat_physique IN ('bon', 'moyen', 'mauvais', 'hors_service')),
  etat_constate_le timestamptz,
  reforme_le timestamptz,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  CHECK ((statut IN ('affecte', 'remis')) = (beneficiaire IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_biens_numero ON public.biens (upper(numero_inventaire));
CREATE INDEX IF NOT EXISTS idx_biens_site ON public.biens(site_id);

ALTER TABLE public.biens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.biens FROM anon, authenticated;
GRANT SELECT ON public.biens TO authenticated;
GRANT ALL ON public.biens TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.biens;
CREATE POLICY lecture_module ON public.biens FOR SELECT TO authenticated
  USING ((public.has_module_view('stock') OR public.is_admin()) AND public.site_permis(site_id));

-- 2. Journal
CREATE TABLE IF NOT EXISTS public.biens_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bien_id uuid NOT NULL REFERENCES public.biens(id),
  type text NOT NULL CHECK (type IN ('entree', 'affectation', 'remise', 'restitution', 'transfert', 'constat', 'reparation', 'reforme', 'fiche', 'annulation')),
  effectue_le timestamptz NOT NULL,
  site_id uuid REFERENCES public.sites(id),
  site_origine_id uuid REFERENCES public.sites(id),
  beneficiaire_type text CHECK (beneficiaire_type IS NULL OR beneficiaire_type IN ('personne', 'service')),
  beneficiaire text,
  etat_physique text CHECK (etat_physique IS NULL OR etat_physique IN ('bon', 'moyen', 'mauvais', 'hors_service')),
  cout bigint CHECK (cout IS NULL OR cout >= 0),
  prestataire text,
  reference_piece text,
  motif text,
  note text,
  donnees jsonb,
  annule_operation_id uuid UNIQUE REFERENCES public.biens_operations(id),
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((type = 'annulation') = (annule_operation_id IS NOT NULL)),
  CHECK (type <> 'affectation' OR (beneficiaire_type IS NOT NULL AND nullif(btrim(coalesce(beneficiaire, '')), '') IS NOT NULL)),
  CHECK (type NOT IN ('reforme', 'fiche', 'annulation') OR nullif(btrim(coalesce(motif, '')), '') IS NOT NULL),
  CHECK (type <> 'transfert' OR (site_id IS NOT NULL AND site_origine_id IS NOT NULL AND site_id <> site_origine_id)),
  CHECK (type <> 'entree' OR site_id IS NOT NULL),
  CHECK (type <> 'constat' OR etat_physique IS NOT NULL),
  CHECK (type <> 'fiche' OR donnees IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_biens_operations_bien ON public.biens_operations(bien_id, effectue_le);

ALTER TABLE public.biens_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.biens_operations FROM anon, authenticated;
GRANT SELECT ON public.biens_operations TO authenticated;
GRANT ALL ON public.biens_operations TO service_role;
DROP POLICY IF EXISTS lecture ON public.biens_operations;
CREATE POLICY lecture ON public.biens_operations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.biens b WHERE b.id = bien_id));

CREATE OR REPLACE FUNCTION public.garde_biens_operations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  RAISE EXCEPTION 'Journal du patrimoine : une operation ne se modifie pas, elle s''annule' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS garde_biens_operations ON public.biens_operations;
CREATE TRIGGER garde_biens_operations BEFORE UPDATE OR DELETE ON public.biens_operations
  FOR EACH ROW EXECUTE FUNCTION public.garde_biens_operations();

CREATE OR REPLACE VIEW public.v_biens_operations_effectives WITH (security_invoker = true) AS
SELECT o.* FROM public.biens_operations o
 WHERE o.type <> 'annulation'
   AND NOT EXISTS (SELECT 1 FROM public.biens_operations a WHERE a.annule_operation_id = o.id);
GRANT SELECT ON public.v_biens_operations_effectives TO authenticated;

-- 3. Fonctions internes
CREATE OR REPLACE FUNCTION public.normaliser_numero_bien(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT nullif(upper(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')), '');
$$;
GRANT EXECUTE ON FUNCTION public.normaliser_numero_bien(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.exiger_ecriture_biens()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (public.has_module_write('stock') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les stocks et moyens generaux requis' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.exiger_ecriture_biens() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.exiger_site_bien(p_site uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_site IS NULL OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = p_site) THEN
    RAISE EXCEPTION 'Site requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site) THEN
    RAISE EXCEPTION 'Site hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.exiger_site_bien(uuid) FROM PUBLIC, anon, authenticated;

-- Recalcule le cache du registre depuis le journal effectif.
CREATE OR REPLACE FUNCTION public.recalculer_bien(p_bien uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.biens_operations; a public.biens_operations; x public.biens_operations; v_statut text; v_site uuid;
BEGIN
  SELECT o.* INTO e FROM public.biens_operations o
   WHERE o.bien_id = p_bien AND o.type IN ('entree', 'affectation', 'remise', 'restitution', 'reforme')
     AND NOT EXISTS (SELECT 1 FROM public.biens_operations n WHERE n.annule_operation_id = o.id)
   ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  v_statut := CASE e.type WHEN 'affectation' THEN 'affecte' WHEN 'remise' THEN 'remis' WHEN 'reforme' THEN 'reforme' ELSE 'en_stock' END;
  SELECT o.site_id INTO v_site FROM public.biens_operations o
   WHERE o.bien_id = p_bien AND o.type IN ('entree', 'transfert')
     AND NOT EXISTS (SELECT 1 FROM public.biens_operations n WHERE n.annule_operation_id = o.id)
   ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1;
  IF v_statut IN ('affecte', 'remis') THEN
    SELECT o.* INTO a FROM public.biens_operations o
     WHERE o.bien_id = p_bien AND o.type = 'affectation'
       AND NOT EXISTS (SELECT 1 FROM public.biens_operations n WHERE n.annule_operation_id = o.id)
     ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1;
  END IF;
  SELECT o.* INTO x FROM public.biens_operations o
   WHERE o.bien_id = p_bien AND o.etat_physique IS NOT NULL AND o.type IN ('entree', 'restitution', 'constat', 'reparation')
     AND NOT EXISTS (SELECT 1 FROM public.biens_operations n WHERE n.annule_operation_id = o.id)
   ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1;
  UPDATE public.biens b SET
    statut = v_statut, site_id = v_site,
    beneficiaire_type = a.beneficiaire_type, beneficiaire = a.beneficiaire,
    etat_physique = x.etat_physique, etat_constate_le = x.effectue_le,
    reforme_le = CASE WHEN v_statut = 'reforme' THEN e.effectue_le END,
    modifie_le = now()
   WHERE b.id = p_bien;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalculer_bien(uuid) FROM PUBLIC, anon, authenticated;

-- Verrouille le bien et controle droit, perimetre et chronologie (la
-- modification de fiche, datee de la saisie, n'entre pas dans la chronologie).
CREATE OR REPLACE FUNCTION public.bien_pour_operation(p_bien uuid, p_date timestamptz)
RETURNS public.biens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE b public.biens; v_dernier timestamptz;
BEGIN
  PERFORM public.exiger_ecriture_biens();
  SELECT * INTO b FROM public.biens WHERE id = p_bien FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bien introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT public.site_permis(b.site_id) THEN
    RAISE EXCEPTION 'Bien hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date de l''operation requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  SELECT max(o.effectue_le) INTO v_dernier FROM public.v_biens_operations_effectives o
   WHERE o.bien_id = p_bien AND o.type <> 'fiche';
  IF v_dernier IS NOT NULL AND p_date < v_dernier THEN
    RAISE EXCEPTION 'Date anterieure a la derniere operation du bien (%)', to_char(v_dernier, 'DD/MM/YYYY HH24:MI')
      USING ERRCODE = '22023';
  END IF;
  RETURN b;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bien_pour_operation(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- 4. Operations
CREATE OR REPLACE FUNCTION public.enregistrer_bien(
  p_numero text, p_categorie text, p_designation text, p_site uuid,
  p_marque text DEFAULT NULL, p_modele text DEFAULT NULL, p_numero_serie text DEFAULT NULL, p_immatriculation text DEFAULT NULL,
  p_date_acquisition date DEFAULT NULL, p_valeur_acquisition bigint DEFAULT NULL, p_duree_amortissement_mois integer DEFAULT NULL,
  p_fournisseur uuid DEFAULT NULL, p_etat text DEFAULT NULL, p_reference text DEFAULT NULL, p_note text DEFAULT NULL,
  p_date timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_numero text := public.normaliser_numero_bien(p_numero);
BEGIN
  PERFORM public.exiger_ecriture_biens();
  IF v_numero IS NULL OR nullif(btrim(coalesce(p_designation, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Numero d''inventaire et designation requis' USING ERRCODE = '22023';
  END IF;
  IF p_categorie IS NULL OR p_categorie NOT IN ('informatique', 'mobilier', 'equipement', 'outillage', 'vehicule_administratif', 'autre') THEN
    RAISE EXCEPTION 'Categorie inconnue' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.biens WHERE upper(numero_inventaire) = v_numero) THEN
    RAISE EXCEPTION 'Numero d''inventaire % deja attribue', v_numero USING ERRCODE = '23505';
  END IF;
  PERFORM public.exiger_site_bien(p_site);
  IF p_valeur_acquisition IS NOT NULL AND p_valeur_acquisition < 0 THEN
    RAISE EXCEPTION 'Valeur d''acquisition positive ou absente' USING ERRCODE = '22023';
  END IF;
  IF p_duree_amortissement_mois IS NOT NULL AND p_duree_amortissement_mois <= 0 THEN
    RAISE EXCEPTION 'Duree d''amortissement strictement positive ou absente' USING ERRCODE = '22023';
  END IF;
  IF p_etat IS NOT NULL AND p_etat NOT IN ('bon', 'moyen', 'mauvais', 'hors_service') THEN
    RAISE EXCEPTION 'Etat physique inconnu' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date d''entree requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_date_acquisition IS NOT NULL AND p_date_acquisition > p_date::date THEN
    RAISE EXCEPTION 'Date d''acquisition posterieure a l''entree au registre' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.biens (numero_inventaire, categorie, designation, marque, modele, numero_serie, immatriculation,
                            date_acquisition, valeur_acquisition, duree_amortissement_mois, fournisseur_id, note,
                            statut, site_id, cree_par)
  VALUES (v_numero, p_categorie, btrim(p_designation), nullif(btrim(coalesce(p_marque, '')), ''),
          nullif(btrim(coalesce(p_modele, '')), ''), nullif(btrim(coalesce(p_numero_serie, '')), ''),
          nullif(upper(btrim(coalesce(p_immatriculation, ''))), ''), p_date_acquisition, p_valeur_acquisition,
          p_duree_amortissement_mois, p_fournisseur, nullif(btrim(coalesce(p_note, '')), ''), 'en_stock', p_site, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.biens_operations (bien_id, type, effectue_le, site_id, etat_physique, reference_piece, saisi_par)
  VALUES (v_id, 'entree', p_date, p_site, p_etat, nullif(btrim(coalesce(p_reference, '')), ''), auth.uid());
  PERFORM public.recalculer_bien(v_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.affecter_bien(
  p_bien uuid, p_beneficiaire_type text, p_beneficiaire text, p_date timestamptz DEFAULT now(),
  p_reference text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE b public.biens; v_id uuid;
BEGIN
  b := public.bien_pour_operation(p_bien, p_date);
  IF b.statut <> 'en_stock' THEN
    RAISE EXCEPTION 'Seul un bien en stock s''affecte ; restituer d''abord (statut : %)', b.statut USING ERRCODE = '22023';
  END IF;
  IF p_beneficiaire_type IS NULL OR p_beneficiaire_type NOT IN ('personne', 'service') THEN
    RAISE EXCEPTION 'Beneficiaire : personne ou service' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_beneficiaire, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Nom du beneficiaire requis' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.biens_operations (bien_id, type, effectue_le, site_id, beneficiaire_type, beneficiaire, reference_piece, note, saisi_par)
  VALUES (p_bien, 'affectation', p_date, b.site_id, p_beneficiaire_type, btrim(p_beneficiaire),
          nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_bien(p_bien);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remettre_bien(
  p_bien uuid, p_date timestamptz DEFAULT now(), p_reference text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE b public.biens; v_id uuid;
BEGIN
  b := public.bien_pour_operation(p_bien, p_date);
  IF b.statut <> 'affecte' THEN
    RAISE EXCEPTION 'Seul un bien affecte se remet au beneficiaire (statut : %)', b.statut USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.biens_operations (bien_id, type, effectue_le, site_id, beneficiaire_type, beneficiaire, reference_piece, note, saisi_par)
  VALUES (p_bien, 'remise', p_date, b.site_id, b.beneficiaire_type, b.beneficiaire,
          nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_bien(p_bien);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restituer_bien(
  p_bien uuid, p_date timestamptz DEFAULT now(), p_etat text DEFAULT NULL, p_reference text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE b public.biens; v_id uuid;
BEGIN
  b := public.bien_pour_operation(p_bien, p_date);
  IF b.statut NOT IN ('affecte', 'remis') THEN
    RAISE EXCEPTION 'Seul un bien affecte ou remis se restitue (statut : %)', b.statut USING ERRCODE = '22023';
  END IF;
  IF p_etat IS NOT NULL AND p_etat NOT IN ('bon', 'moyen', 'mauvais', 'hors_service') THEN
    RAISE EXCEPTION 'Etat physique inconnu' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.biens_operations (bien_id, type, effectue_le, site_id, beneficiaire_type, beneficiaire, etat_physique,
                                       reference_piece, note, saisi_par)
  VALUES (p_bien, 'restitution', p_date, b.site_id, b.beneficiaire_type, b.beneficiaire, p_etat,
          nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_bien(p_bien);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transferer_bien(
  p_bien uuid, p_site uuid, p_date timestamptz DEFAULT now(), p_reference text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE b public.biens; v_id uuid;
BEGIN
  b := public.bien_pour_operation(p_bien, p_date);
  IF b.statut <> 'en_stock' THEN
    RAISE EXCEPTION 'Seul un bien en stock se transfere ; restituer d''abord (statut : %)', b.statut USING ERRCODE = '22023';
  END IF;
  PERFORM public.exiger_site_bien(p_site);
  IF p_site = b.site_id THEN RAISE EXCEPTION 'Site de destination identique au site actuel' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.biens_operations (bien_id, type, effectue_le, site_id, site_origine_id, reference_piece, note, saisi_par)
  VALUES (p_bien, 'transfert', p_date, p_site, b.site_id, nullif(btrim(coalesce(p_reference, '')), ''),
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_bien(p_bien);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.constater_etat_bien(
  p_bien uuid, p_etat text, p_date timestamptz DEFAULT now(), p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE b public.biens; v_id uuid;
BEGIN
  b := public.bien_pour_operation(p_bien, p_date);
  IF b.statut = 'reforme' THEN RAISE EXCEPTION 'Bien reforme' USING ERRCODE = '22023'; END IF;
  IF p_etat IS NULL OR p_etat NOT IN ('bon', 'moyen', 'mauvais', 'hors_service') THEN
    RAISE EXCEPTION 'Etat physique requis : bon, moyen, mauvais ou hors service' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.biens_operations (bien_id, type, effectue_le, site_id, etat_physique, note, saisi_par)
  VALUES (p_bien, 'constat', p_date, b.site_id, p_etat, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_bien(p_bien);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reparer_bien(
  p_bien uuid, p_nature text, p_date timestamptz DEFAULT now(), p_prestataire text DEFAULT NULL, p_cout bigint DEFAULT NULL,
  p_etat text DEFAULT NULL, p_reference text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE b public.biens; v_id uuid;
BEGIN
  b := public.bien_pour_operation(p_bien, p_date);
  IF b.statut = 'reforme' THEN RAISE EXCEPTION 'Bien reforme' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_nature, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Nature de la reparation requise' USING ERRCODE = '22023';
  END IF;
  IF p_cout IS NOT NULL AND p_cout < 0 THEN RAISE EXCEPTION 'Cout positif ou absent' USING ERRCODE = '22023'; END IF;
  IF p_etat IS NOT NULL AND p_etat NOT IN ('bon', 'moyen', 'mauvais', 'hors_service') THEN
    RAISE EXCEPTION 'Etat physique inconnu' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.biens_operations (bien_id, type, effectue_le, site_id, etat_physique, cout, prestataire, reference_piece, note, saisi_par)
  VALUES (p_bien, 'reparation', p_date, b.site_id, p_etat, p_cout, nullif(btrim(coalesce(p_prestataire, '')), ''),
          nullif(btrim(coalesce(p_reference, '')), ''), btrim(p_nature), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_bien(p_bien);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reformer_bien(
  p_bien uuid, p_motif text, p_date timestamptz DEFAULT now(), p_reference text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE b public.biens; v_id uuid;
BEGIN
  b := public.bien_pour_operation(p_bien, p_date);
  IF b.statut <> 'en_stock' THEN
    RAISE EXCEPTION 'Seul un bien en stock se reforme ; restituer d''abord (statut : %)', b.statut USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de la reforme requis' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.biens_operations (bien_id, type, effectue_le, site_id, motif, reference_piece, saisi_par)
  VALUES (p_bien, 'reforme', p_date, b.site_id, btrim(p_motif), nullif(btrim(coalesce(p_reference, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_bien(p_bien);
  RETURN v_id;
END;
$$;

-- Modification motivee de la fiche : toutes les valeurs descriptives sont
-- remplacees (NULL = absente) ; avant et apres sont journalises. Le numero
-- d'inventaire et le site ne se modifient pas ici.
CREATE OR REPLACE FUNCTION public.modifier_fiche_bien(
  p_bien uuid, p_motif text, p_categorie text, p_designation text,
  p_marque text DEFAULT NULL, p_modele text DEFAULT NULL, p_numero_serie text DEFAULT NULL, p_immatriculation text DEFAULT NULL,
  p_date_acquisition date DEFAULT NULL, p_valeur_acquisition bigint DEFAULT NULL, p_duree_amortissement_mois integer DEFAULT NULL,
  p_fournisseur uuid DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE b public.biens; n public.biens; v_entree date; v_id uuid;
BEGIN
  b := public.bien_pour_operation(p_bien, now());
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de la modification requis' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_designation, '')), '') IS NULL THEN RAISE EXCEPTION 'Designation requise' USING ERRCODE = '22023'; END IF;
  IF p_categorie IS NULL OR p_categorie NOT IN ('informatique', 'mobilier', 'equipement', 'outillage', 'vehicule_administratif', 'autre') THEN
    RAISE EXCEPTION 'Categorie inconnue' USING ERRCODE = '22023';
  END IF;
  IF p_valeur_acquisition IS NOT NULL AND p_valeur_acquisition < 0 THEN
    RAISE EXCEPTION 'Valeur d''acquisition positive ou absente' USING ERRCODE = '22023';
  END IF;
  IF p_duree_amortissement_mois IS NOT NULL AND p_duree_amortissement_mois <= 0 THEN
    RAISE EXCEPTION 'Duree d''amortissement strictement positive ou absente' USING ERRCODE = '22023';
  END IF;
  SELECT min(o.effectue_le)::date INTO v_entree FROM public.biens_operations o WHERE o.bien_id = p_bien AND o.type = 'entree';
  IF p_date_acquisition IS NOT NULL AND v_entree IS NOT NULL AND p_date_acquisition > v_entree THEN
    RAISE EXCEPTION 'Date d''acquisition posterieure a l''entree au registre' USING ERRCODE = '22023';
  END IF;
  UPDATE public.biens SET
    categorie = p_categorie, designation = btrim(p_designation),
    marque = nullif(btrim(coalesce(p_marque, '')), ''), modele = nullif(btrim(coalesce(p_modele, '')), ''),
    numero_serie = nullif(btrim(coalesce(p_numero_serie, '')), ''),
    immatriculation = nullif(upper(btrim(coalesce(p_immatriculation, ''))), ''),
    date_acquisition = p_date_acquisition, valeur_acquisition = p_valeur_acquisition,
    duree_amortissement_mois = p_duree_amortissement_mois, fournisseur_id = p_fournisseur,
    note = nullif(btrim(coalesce(p_note, '')), ''), modifie_le = now()
   WHERE id = p_bien
  RETURNING * INTO n;
  INSERT INTO public.biens_operations (bien_id, type, effectue_le, site_id, motif, donnees, saisi_par)
  VALUES (p_bien, 'fiche', now(), b.site_id, btrim(p_motif),
          jsonb_build_object(
            'avant', jsonb_build_object('categorie', b.categorie, 'designation', b.designation, 'marque', b.marque, 'modele', b.modele,
                                        'numero_serie', b.numero_serie, 'immatriculation', b.immatriculation,
                                        'date_acquisition', b.date_acquisition, 'valeur_acquisition', b.valeur_acquisition,
                                        'duree_amortissement_mois', b.duree_amortissement_mois, 'fournisseur_id', b.fournisseur_id, 'note', b.note),
            'apres', jsonb_build_object('categorie', n.categorie, 'designation', n.designation, 'marque', n.marque, 'modele', n.modele,
                                        'numero_serie', n.numero_serie, 'immatriculation', n.immatriculation,
                                        'date_acquisition', n.date_acquisition, 'valeur_acquisition', n.valeur_acquisition,
                                        'duree_amortissement_mois', n.duree_amortissement_mois, 'fournisseur_id', n.fournisseur_id, 'note', n.note)),
          auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Annulation motivee de la derniere operation d'un bien (hors entree et
-- modification de fiche).
CREATE OR REPLACE FUNCTION public.annuler_operation_bien(p_operation uuid, p_motif text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE o public.biens_operations; v_dernier uuid; v_id uuid;
BEGIN
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO o FROM public.biens_operations WHERE id = p_operation;
  IF NOT FOUND OR o.type = 'annulation' OR EXISTS (SELECT 1 FROM public.biens_operations a WHERE a.annule_operation_id = o.id) THEN
    RAISE EXCEPTION 'Operation introuvable ou deja annulee' USING ERRCODE = '22023';
  END IF;
  IF o.type = 'entree' THEN
    RAISE EXCEPTION 'L''entree au registre ne s''annule pas : reformer le bien avec motif' USING ERRCODE = '22023';
  END IF;
  IF o.type = 'fiche' THEN
    RAISE EXCEPTION 'Une modification de fiche se corrige par une nouvelle modification motivee' USING ERRCODE = '22023';
  END IF;
  PERFORM public.bien_pour_operation(o.bien_id, now());
  SELECT e.id INTO v_dernier FROM public.v_biens_operations_effectives e
   WHERE e.bien_id = o.bien_id AND e.type <> 'fiche' ORDER BY e.effectue_le DESC, e.saisi_le DESC LIMIT 1;
  IF v_dernier IS DISTINCT FROM o.id THEN
    RAISE EXCEPTION 'Seule la derniere operation d''un bien s''annule' USING ERRCODE = '22023';
  END IF;
  -- Un transfert annule ramene le bien sur son site d'origine : il faut y avoir droit.
  IF o.type = 'transfert' AND NOT public.site_permis(o.site_origine_id) THEN
    RAISE EXCEPTION 'Site d''origine hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.biens_operations (bien_id, type, effectue_le, motif, annule_operation_id, saisi_par)
  VALUES (o.bien_id, 'annulation', now(), btrim(p_motif), o.id, auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.recalculer_bien(o.bien_id);
  RETURN v_id;
END;
$$;

-- 5. Inventaire physique par site
CREATE TABLE IF NOT EXISTS public.inventaires_biens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  ouvert_le timestamptz NOT NULL,
  ouvert_par uuid REFERENCES auth.users(id),
  cloture_le timestamptz,
  cloture_par uuid REFERENCES auth.users(id),
  note text,
  saisi_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (cloture_le IS NULL OR cloture_le >= ouvert_le)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventaires_biens_ouvert ON public.inventaires_biens(site_id) WHERE cloture_le IS NULL;

ALTER TABLE public.inventaires_biens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventaires_biens FROM anon, authenticated;
GRANT SELECT ON public.inventaires_biens TO authenticated;
GRANT ALL ON public.inventaires_biens TO service_role;
DROP POLICY IF EXISTS lecture_module ON public.inventaires_biens;
CREATE POLICY lecture_module ON public.inventaires_biens FOR SELECT TO authenticated
  USING ((public.has_module_view('stock') OR public.is_admin()) AND public.site_permis(site_id));

CREATE TABLE IF NOT EXISTS public.inventaires_biens_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventaire_id uuid NOT NULL REFERENCES public.inventaires_biens(id),
  resultat text NOT NULL CHECK (resultat IN ('constate', 'hors_site', 'reforme', 'non_reference', 'manquant')),
  bien_id uuid REFERENCES public.biens(id),
  numero_lu text,
  designation_lue text,
  etat_physique text CHECK (etat_physique IS NULL OR etat_physique IN ('bon', 'moyen', 'mauvais', 'hors_service')),
  localisation text,
  note text,
  constate_le timestamptz NOT NULL,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  annule_le timestamptz,
  annule_par uuid REFERENCES auth.users(id),
  annule_motif text,
  CHECK ((resultat = 'non_reference') = (bien_id IS NULL)),
  CHECK (resultat <> 'non_reference' OR nullif(btrim(coalesce(numero_lu, '')), '') IS NOT NULL
         OR nullif(btrim(coalesce(designation_lue, '')), '') IS NOT NULL),
  CHECK ((annule_le IS NULL) = (annule_motif IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_inventaires_biens_lignes_inv ON public.inventaires_biens_lignes(inventaire_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventaires_biens_lignes_bien ON public.inventaires_biens_lignes(inventaire_id, bien_id)
  WHERE bien_id IS NOT NULL AND annule_le IS NULL;

ALTER TABLE public.inventaires_biens_lignes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventaires_biens_lignes FROM anon, authenticated;
GRANT SELECT ON public.inventaires_biens_lignes TO authenticated;
GRANT ALL ON public.inventaires_biens_lignes TO service_role;
DROP POLICY IF EXISTS lecture ON public.inventaires_biens_lignes;
CREATE POLICY lecture ON public.inventaires_biens_lignes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventaires_biens i WHERE i.id = inventaire_id));

-- Une ligne ne change qu'une fois, pour etre annulee (motif) ; jamais supprimee.
CREATE OR REPLACE FUNCTION public.garde_inventaires_biens_lignes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP = 'UPDATE' AND OLD.annule_le IS NULL AND NEW.annule_le IS NOT NULL
     AND (to_jsonb(NEW) - ARRAY['annule_le', 'annule_par', 'annule_motif']) = (to_jsonb(OLD) - ARRAY['annule_le', 'annule_par', 'annule_motif']) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Ligne d''inventaire : ni modification ni suppression, seulement une annulation motivee' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS garde_inventaires_biens_lignes ON public.inventaires_biens_lignes;
CREATE TRIGGER garde_inventaires_biens_lignes BEFORE UPDATE OR DELETE ON public.inventaires_biens_lignes
  FOR EACH ROW EXECUTE FUNCTION public.garde_inventaires_biens_lignes();

CREATE OR REPLACE FUNCTION public.inventaire_biens_ouvert(p_inventaire uuid)
RETURNS public.inventaires_biens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.inventaires_biens;
BEGIN
  PERFORM public.exiger_ecriture_biens();
  SELECT * INTO i FROM public.inventaires_biens WHERE id = p_inventaire FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventaire introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT public.site_permis(i.site_id) THEN RAISE EXCEPTION 'Site hors de votre perimetre' USING ERRCODE = '42501'; END IF;
  IF i.cloture_le IS NOT NULL THEN RAISE EXCEPTION 'Inventaire cloture' USING ERRCODE = '22023'; END IF;
  RETURN i;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inventaire_biens_ouvert(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ouvrir_inventaire_biens(
  p_site uuid, p_libelle text, p_date timestamptz DEFAULT now(), p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.exiger_ecriture_biens();
  PERFORM public.exiger_site_bien(p_site);
  IF nullif(btrim(coalesce(p_libelle, '')), '') IS NULL THEN RAISE EXCEPTION 'Libelle de la campagne requis' USING ERRCODE = '22023'; END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date d''ouverture requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inventaires_biens WHERE site_id = p_site AND cloture_le IS NULL) THEN
    RAISE EXCEPTION 'Un inventaire est deja ouvert sur ce site' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.inventaires_biens (site_id, libelle, ouvert_le, ouvert_par, note)
  VALUES (p_site, btrim(p_libelle), p_date, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Constat d'un bien pendant la campagne : par numero d'inventaire lu ; un
-- numero absent du registre (ou un bien sans etiquette, decrit) est un bien
-- non reference. Le registre n'est pas modifie.
CREATE OR REPLACE FUNCTION public.constater_inventaire_bien(
  p_inventaire uuid, p_numero text DEFAULT NULL, p_etat text DEFAULT NULL, p_designation text DEFAULT NULL,
  p_localisation text DEFAULT NULL, p_note text DEFAULT NULL, p_date timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.inventaires_biens; b public.biens; v_numero text := public.normaliser_numero_bien(p_numero); v_resultat text; v_id uuid;
BEGIN
  i := public.inventaire_biens_ouvert(p_inventaire);
  IF p_etat IS NOT NULL AND p_etat NOT IN ('bon', 'moyen', 'mauvais', 'hors_service') THEN
    RAISE EXCEPTION 'Etat physique inconnu' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' OR p_date < i.ouvert_le THEN
    RAISE EXCEPTION 'Date du constat requise, dans la campagne et pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF v_numero IS NULL AND nullif(btrim(coalesce(p_designation, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Numero d''inventaire lu ou designation requis' USING ERRCODE = '22023';
  END IF;
  IF v_numero IS NOT NULL THEN
    SELECT * INTO b FROM public.biens WHERE upper(numero_inventaire) = v_numero;
  END IF;
  IF b.id IS NULL THEN
    v_resultat := 'non_reference';
  ELSIF EXISTS (SELECT 1 FROM public.inventaires_biens_lignes l WHERE l.inventaire_id = p_inventaire AND l.bien_id = b.id AND l.annule_le IS NULL) THEN
    RAISE EXCEPTION 'Bien % deja constate dans cet inventaire', v_numero USING ERRCODE = '22023';
  ELSIF b.statut = 'reforme' THEN
    v_resultat := 'reforme';
  ELSIF b.site_id <> i.site_id THEN
    v_resultat := 'hors_site';
  ELSE
    v_resultat := 'constate';
  END IF;
  INSERT INTO public.inventaires_biens_lignes (inventaire_id, resultat, bien_id, numero_lu, designation_lue, etat_physique,
                                               localisation, note, constate_le, saisi_par)
  VALUES (p_inventaire, v_resultat, b.id, v_numero, nullif(btrim(coalesce(p_designation, '')), ''), p_etat,
          nullif(btrim(coalesce(p_localisation, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), p_date, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_constat_inventaire(p_ligne uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE l public.inventaires_biens_lignes;
BEGIN
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO l FROM public.inventaires_biens_lignes WHERE id = p_ligne;
  IF NOT FOUND OR l.annule_le IS NOT NULL THEN RAISE EXCEPTION 'Ligne introuvable ou deja annulee' USING ERRCODE = '22023'; END IF;
  PERFORM public.inventaire_biens_ouvert(l.inventaire_id);
  UPDATE public.inventaires_biens_lignes SET annule_le = now(), annule_par = auth.uid(), annule_motif = btrim(p_motif)
   WHERE id = p_ligne;
END;
$$;

-- Cloture : une ligne `manquant` par bien attendu (site de la campagne, non
-- reforme) sans constat ; les ecarts sont ainsi figes.
CREATE OR REPLACE FUNCTION public.cloturer_inventaire_biens(p_inventaire uuid, p_note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.inventaires_biens; v_manquants integer;
BEGIN
  i := public.inventaire_biens_ouvert(p_inventaire);
  INSERT INTO public.inventaires_biens_lignes (inventaire_id, resultat, bien_id, numero_lu, constate_le, saisi_par)
  SELECT p_inventaire, 'manquant', b.id, b.numero_inventaire, now(), auth.uid()
    FROM public.biens b
   WHERE b.site_id = i.site_id AND b.statut <> 'reforme'
     AND NOT EXISTS (SELECT 1 FROM public.inventaires_biens_lignes l
                      WHERE l.inventaire_id = p_inventaire AND l.bien_id = b.id AND l.annule_le IS NULL);
  GET DIAGNOSTICS v_manquants = ROW_COUNT;
  UPDATE public.inventaires_biens SET cloture_le = greatest(now(), ouvert_le), cloture_par = auth.uid(),
         note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note)
   WHERE id = p_inventaire;
  RETURN v_manquants;
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'enregistrer_bien(text, text, text, uuid, text, text, text, text, date, bigint, integer, uuid, text, text, text, timestamptz)',
    'affecter_bien(uuid, text, text, timestamptz, text, text)',
    'remettre_bien(uuid, timestamptz, text, text)',
    'restituer_bien(uuid, timestamptz, text, text, text)',
    'transferer_bien(uuid, uuid, timestamptz, text, text)',
    'constater_etat_bien(uuid, text, timestamptz, text)',
    'reparer_bien(uuid, text, timestamptz, text, bigint, text, text)',
    'reformer_bien(uuid, text, timestamptz, text)',
    'modifier_fiche_bien(uuid, text, text, text, text, text, text, text, date, bigint, integer, uuid, text)',
    'annuler_operation_bien(uuid, text)',
    'ouvrir_inventaire_biens(uuid, text, timestamptz, text)',
    'constater_inventaire_bien(uuid, text, text, text, text, text, timestamptz)',
    'annuler_constat_inventaire(uuid, text)',
    'cloturer_inventaire_biens(uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- 6. Vues
-- Amortissement lineaire : mois entiers ecoules depuis l'acquisition
-- (arretes a la reforme), bornes a la duree ; NULL si une donnee manque.
CREATE OR REPLACE VIEW public.v_biens WITH (security_invoker = true) AS
SELECT b.*,
       a.mois_amortis,
       CASE WHEN a.mois_amortis IS NOT NULL THEN round(b.valeur_acquisition::numeric / b.duree_amortissement_mois, 2) END AS dotation_mensuelle,
       CASE WHEN a.mois_amortis IS NOT NULL THEN round(b.valeur_acquisition::numeric * a.mois_amortis / b.duree_amortissement_mois)::bigint END AS amortissement_cumule,
       CASE WHEN a.mois_amortis IS NOT NULL
            THEN b.valeur_acquisition - round(b.valeur_acquisition::numeric * a.mois_amortis / b.duree_amortissement_mois)::bigint END AS valeur_nette,
       CASE WHEN a.mois_amortis IS NOT NULL THEN (b.date_acquisition + make_interval(months => b.duree_amortissement_mois))::date END AS fin_amortissement
  FROM public.biens b
  LEFT JOIN LATERAL (
    SELECT CASE WHEN b.valeur_acquisition IS NOT NULL AND b.date_acquisition IS NOT NULL AND b.duree_amortissement_mois IS NOT NULL
                THEN least(b.duree_amortissement_mois, greatest(0,
                       (extract(year FROM age(coalesce(b.reforme_le::date, current_date), b.date_acquisition)) * 12
                        + extract(month FROM age(coalesce(b.reforme_le::date, current_date), b.date_acquisition)))::int)) END AS mois_amortis
  ) a ON true;
GRANT SELECT ON public.v_biens TO authenticated;

-- Campagnes et compteurs ; tant que la campagne est ouverte, les attendus et
-- manquants sont provisoires (etat courant du registre).
CREATE OR REPLACE VIEW public.v_inventaires_biens WITH (security_invoker = true) AS
SELECT i.id, i.site_id, i.libelle, i.ouvert_le, i.ouvert_par, i.cloture_le, i.cloture_par, i.note,
       (i.cloture_le IS NULL) AS ouvert,
       CASE WHEN i.cloture_le IS NULL THEN att.nb ELSE coalesce(l.constates, 0) + coalesce(l.manquants, 0) END AS nb_attendus,
       coalesce(l.constates, 0) AS nb_constates,
       CASE WHEN i.cloture_le IS NULL THEN att.sans_constat ELSE coalesce(l.manquants, 0) END AS nb_manquants,
       coalesce(l.hors_site, 0) AS nb_hors_site,
       coalesce(l.reformes, 0) AS nb_reformes,
       coalesce(l.non_references, 0) AS nb_non_references
  FROM public.inventaires_biens i
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE x.resultat = 'constate')::int AS constates,
           count(*) FILTER (WHERE x.resultat = 'manquant')::int AS manquants,
           count(*) FILTER (WHERE x.resultat = 'hors_site')::int AS hors_site,
           count(*) FILTER (WHERE x.resultat = 'reforme')::int AS reformes,
           count(*) FILTER (WHERE x.resultat = 'non_reference')::int AS non_references
      FROM public.inventaires_biens_lignes x WHERE x.inventaire_id = i.id AND x.annule_le IS NULL) l ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS nb,
           count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.inventaires_biens_lignes y
                                               WHERE y.inventaire_id = i.id AND y.bien_id = b.id AND y.annule_le IS NULL))::int AS sans_constat
      FROM public.biens b WHERE b.site_id = i.site_id AND b.statut <> 'reforme') att ON true;
GRANT SELECT ON public.v_inventaires_biens TO authenticated;

-- Ecarts : lignes d'ecart enregistrees et, campagne ouverte, manquants provisoires.
CREATE OR REPLACE VIEW public.v_inventaires_biens_ecarts WITH (security_invoker = true) AS
SELECT l.inventaire_id, l.id AS ligne_id, l.resultat AS ecart, l.bien_id, coalesce(b.numero_inventaire, l.numero_lu) AS numero,
       coalesce(b.designation, l.designation_lue) AS designation, l.localisation, l.note, false AS provisoire
  FROM public.inventaires_biens_lignes l
  LEFT JOIN public.biens b ON b.id = l.bien_id
 WHERE l.annule_le IS NULL AND l.resultat <> 'constate'
UNION ALL
SELECT i.id, NULL::uuid, 'manquant', b.id, b.numero_inventaire, b.designation, NULL::text, NULL::text, true
  FROM public.inventaires_biens i
  JOIN public.biens b ON b.site_id = i.site_id AND b.statut <> 'reforme'
 WHERE i.cloture_le IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.inventaires_biens_lignes l
                    WHERE l.inventaire_id = i.id AND l.bien_id = b.id AND l.annule_le IS NULL);
GRANT SELECT ON public.v_inventaires_biens_ecarts TO authenticated;

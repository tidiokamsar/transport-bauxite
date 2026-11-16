/*
  # Correctifs de la contre-revue independante de D-072 (2026-11-16)

  La revue independante des migrations 20261120100000 a 20261120103000 a
  releve cinq points ; ils sont corriges ici (D-072).

  N1 (C4, D-049) : `annuler_immobilisation` contournait la validation de la
     remise en service : l'auteur de la fin d'intervention annulait
     l'immobilisation, l'engin repassait actif et l'intervention restait
     terminee. L'annulation est refusee tant qu'une intervention du loueur
     n'est pas validee. Limite consignee : une demande jamais honoree n'a pas
     encore de chemin d'annulation (nouvel etat a decider).
  N2 (R1-8, D-047) : la garde de levee interdisait de lever une fermeture
     planifiee avant son debut. Une levee anterieure au debut reste refusee
     seulement pour une fermeture deja commencee.
  N3 (C5, D-048) : l'unicite (poste, engin) refusait une releve (deux
     chauffeurs sur le meme camion dans le shift). L'engin n'est unique que
     quand il figure seul dans l'equipe ; l'unicite du chauffeur demeure.
  N4 (R4-4, D-059) : la garde du bon issu d'une consultation ne comparait que
     le sous-total ; les taxes restaient libres. Le montant total du bon
     (lignes et taxes) doit egaler le montant de l'offre retenue, qui est le
     montant complet de l'offre : le prix de l'offre est toutes taxes
     comprises, le bon reprend son montant en lignes, sans taxes separees.
  N5 (R3-1, D-058) : un rapport journalier ou mensuel fige se lisait avec le
     seul droit rapports ; il exige desormais la lecture de chacun de ses
     domaines (voyages, planification, carburant, maintenance).

  Seconde revue independante (2026-11-16) : verrou de l'immobilisation dans
  `demander_intervention_loueur` (une annulation concurrente ne laisse plus
  d'intervention active), borne basse de la levee (pas avant le premier du debut et de la declaration),
  engin compte une seule fois dans un poste.

  Idempotent. Aucune donnee modifiee.
*/

-- N1 --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.annuler_immobilisation(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_avant public.immobilisations;
  v_apres public.immobilisations;
BEGIN
  IF NOT public.has_module_write('maintenance') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la maintenance requis' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour annuler une immobilisation' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_avant FROM public.immobilisations WHERE id = p_id AND statut <> 'annulee' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Immobilisation introuvable ou deja annulee' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interventions_loueur i
              WHERE i.immobilisation_id = p_id AND i.statut <> 'remise_validee') THEN
    RAISE EXCEPTION 'Intervention du loueur en cours : la remise en service doit etre validee avant toute annulation'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.immobilisations SET statut = 'annulee' WHERE id = p_id RETURNING * INTO v_apres;
  INSERT INTO public.immobilisations_journal (immobilisation_id, action, avant, apres, motif, auteur)
  VALUES (p_id, 'annulation', to_jsonb(v_avant), to_jsonb(v_apres), btrim(p_motif), auth.uid());
  IF v_avant.statut = 'ouverte' THEN
    UPDATE public.vehicles SET status = 'active'
    WHERE id = v_avant.vehicle_id AND status::text IN ('maintenance', 'immobilized');
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.annuler_immobilisation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annuler_immobilisation(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.demander_intervention_loueur(
  p_immobilisation_id uuid, p_quand timestamptz, p_canal text, p_description text,
  p_reference text DEFAULT NULL, p_delai_contractuel_heures numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m public.immobilisations; v_id uuid;
BEGIN
  IF NOT public.has_module_write('maintenance') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la maintenance requis' USING ERRCODE = '42501';
  END IF;
  -- Verrou : une annulation ou une cloture concurrente attend, puis voit
  -- l'intervention (et la refuse), ou bien la demande voit l'immobilisation fermee.
  SELECT * INTO m FROM public.immobilisations WHERE id = p_immobilisation_id FOR UPDATE;
  IF NOT FOUND OR m.statut <> 'ouverte' THEN
    RAISE EXCEPTION 'Immobilisation ouverte introuvable' USING ERRCODE = '22023';
  END IF;
  IF m.imputation NOT IN ('loueur', 'a_determiner') THEN
    RAISE EXCEPTION 'Immobilisation imputee a l''exploitant : pas d''intervention du loueur' USING ERRCODE = '22023';
  END IF;
  IF NOT public.vehicule_permis(m.vehicle_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF p_quand IS NULL OR p_quand > now() + interval '5 minutes' OR p_quand < m.debut THEN
    RAISE EXCEPTION 'Heure de la demande requise, apres le debut de l''immobilisation et pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interventions_loueur WHERE immobilisation_id = m.id AND statut <> 'remise_validee') THEN
    RAISE EXCEPTION 'Une intervention est deja en cours pour cette immobilisation' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.interventions_loueur (numero, immobilisation_id, vehicle_id, demande_le, canal, reference_demande, description,
    delai_contractuel_heures, demande_par)
  VALUES ('INT-' || to_char(p_quand, 'YYYY') || '-' || lpad(nextval('public.interventions_loueur_numero_seq')::text, 5, '0'),
    m.id, m.vehicle_id, p_quand, p_canal, nullif(btrim(coalesce(p_reference, '')), ''), btrim(coalesce(p_description, '')),
    p_delai_contractuel_heures, auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.journaliser_intervention(v_id, 'demande', NULL, 'demandee', NULL);
  RETURN v_id;
END;
$$;

-- N2 --------------------------------------------------------------------------
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
  -- Une levee ne reecrit pas l'historique : pas dans le futur, pas avant le
  -- debut d'une fermeture deja commencee, pas apres la fin d'une fermeture
  -- terminee. Une fermeture planifiee peut etre levee avant son debut.
  IF NEW.levee_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Levee datee dans le futur' USING ERRCODE = '22023';
  END IF;
  -- Borne basse : ni avant le debut ni avant la declaration, selon ce qui vient
  -- en premier (une fermeture saisie apres coup peut etre levee avant d'avoir
  -- ete saisie ; une fermeture planifiee ne se leve pas avant sa declaration).
  IF NEW.levee_le < least(OLD.debut, OLD.declare_le) THEN
    RAISE EXCEPTION 'Levee anterieure a la declaration de la fermeture' USING ERRCODE = '22023';
  END IF;
  IF OLD.debut <= now() AND NEW.levee_le < OLD.debut THEN
    RAISE EXCEPTION 'Levee anterieure au debut d''une fermeture commencee' USING ERRCODE = '22023';
  END IF;
  IF OLD.fin IS NOT NULL AND OLD.fin <= now() AND NEW.levee_le > OLD.fin THEN
    RAISE EXCEPTION 'Fermeture deja terminee a sa fin prevue : rien a lever' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- N3 --------------------------------------------------------------------------
DROP INDEX IF EXISTS public.ux_postes_equipe_engin_unique;
CREATE UNIQUE INDEX IF NOT EXISTS ux_postes_equipe_engin_seul
  ON public.postes_equipe(poste_id, vehicle_id) WHERE vehicle_id IS NOT NULL AND driver_id IS NULL;

CREATE OR REPLACE FUNCTION public.affecter_au_poste(p_poste_id uuid, p_driver_id uuid DEFAULT NULL, p_vehicle_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes := public.poste_ecrivable(p_poste_id, 'trips', 'ouvert'); v_id uuid; d public.drivers;
BEGIN
  IF p_driver_id IS NULL AND p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Chauffeur ou engin requis' USING ERRCODE = '22023';
  END IF;
  IF p_driver_id IS NOT NULL THEN
    -- Verrou du chauffeur : deux affectations simultanees au meme shift se succedent.
    SELECT * INTO d FROM public.drivers WHERE id = p_driver_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Chauffeur introuvable' USING ERRCODE = '22023'; END IF;
    IF NOT public.site_permis(d.site_id) THEN
      RAISE EXCEPTION 'Hors perimetre : chauffeur d''un autre site' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.postes_equipe e WHERE e.poste_id = p.id AND e.driver_id = p_driver_id) THEN
      RAISE EXCEPTION 'Chauffeur deja dans l''equipe de ce poste' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_vehicle_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicle_id) THEN
      RAISE EXCEPTION 'Engin introuvable' USING ERRCODE = '22023';
    END IF;
    IF NOT public.vehicule_permis(p_vehicle_id) THEN
      RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
    END IF;
    -- Verrou de l'engin : deux inscriptions simultanees se succedent.
    PERFORM 1 FROM public.vehicles v WHERE v.id = p_vehicle_id FOR NO KEY UPDATE;
    -- Un engin n'est compte qu'une fois : inscrit seul, il ne figure nulle part
    -- ailleurs dans le poste ; avec chauffeur, il n'est pas deja inscrit seul.
    -- Une releve (second chauffeur sur le meme camion) reste possible.
    IF p_driver_id IS NULL AND EXISTS (SELECT 1 FROM public.postes_equipe e
                                        WHERE e.poste_id = p.id AND e.vehicle_id = p_vehicle_id) THEN
      RAISE EXCEPTION 'Engin deja dans l''equipe de ce poste' USING ERRCODE = '22023';
    END IF;
    IF p_driver_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.postes_equipe e
                                            WHERE e.poste_id = p.id AND e.vehicle_id = p_vehicle_id AND e.driver_id IS NULL) THEN
      RAISE EXCEPTION 'Engin deja inscrit seul dans ce poste : retirez cette ligne avant d''y affecter un chauffeur' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_driver_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.postes_equipe e JOIN public.postes o ON o.id = e.poste_id
        WHERE e.driver_id = p_driver_id AND o.date_poste = p.date_poste AND o.shift_id = p.shift_id AND o.id <> p.id) THEN
    RAISE EXCEPTION 'Chauffeur deja affecte a un autre poste du meme shift' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.postes_equipe (poste_id, driver_id, vehicle_id, ajoute_par)
  VALUES (p.id, p_driver_id, p_vehicle_id, auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- N4 --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.garde_bon_consultation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT cf.numero, o.supplier_id, o.montant_total INTO c
    FROM public.consultations_fournisseurs cf JOIN public.offres_fournisseurs o ON o.id = cf.offre_retenue_id
   WHERE cf.purchase_order_id = NEW.id
   ORDER BY cf.selection_le DESC NULLS LAST LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.supplier_id IS DISTINCT FROM c.supplier_id THEN
    RAISE EXCEPTION 'Bon issu de la consultation % : le fournisseur de l''offre retenue ne change pas', c.numero USING ERRCODE = '22023';
  END IF;
  -- Le prix de l'offre est toutes taxes comprises (l'offre n'a pas de champ
  -- taxes) : le bon reprend ce montant en lignes, sans taxes separees.
  IF NEW.status = 'submitted' AND OLD.status = 'draft'
     AND (coalesce(NEW.subtotal, 0) <> c.montant_total OR coalesce(NEW.tax_amount, 0) <> 0) THEN
    RAISE EXCEPTION 'Bon issu de la consultation % : lignes (%) et taxes (%) a aligner sur l''offre retenue (%, toutes taxes comprises, sans taxes separees) ; corrigez le brouillon',
      c.numero, coalesce(NEW.subtotal, 0), coalesce(NEW.tax_amount, 0), c.montant_total USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_bon_consultation() FROM PUBLIC, anon, authenticated;

-- N5 --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rapport_fige_lisible(p_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() OR (public.has_module_view('reports') AND CASE p_type
    WHEN 'loueur' THEN public.has_module_view('contracts')
    WHEN 'client' THEN public.has_module_view('invoices') OR public.has_module_view('contracts')
    WHEN 'shift' THEN public.has_module_view('trips') OR public.has_module_view('planning')
    WHEN 'journalier' THEN public.has_module_view('trips') AND public.has_module_view('planning')
                       AND public.has_module_view('fuel') AND public.has_module_view('maintenance')
    WHEN 'mensuel' THEN public.has_module_view('trips') AND public.has_module_view('planning')
                    AND public.has_module_view('fuel') AND public.has_module_view('maintenance')
    ELSE false END);
$$;
REVOKE EXECUTE ON FUNCTION public.rapport_fige_lisible(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rapport_fige_lisible(text) TO authenticated, service_role;

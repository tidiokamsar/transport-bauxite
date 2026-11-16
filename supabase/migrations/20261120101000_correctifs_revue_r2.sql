/*
  # Correctifs de la revue independante a posteriori (D-072), partie 2 :
  # D-048 a D-053 (constats R2)

  Les fonctions remplacees reprennent leur corps exact ; seuls les controles
  indiques s'ajoutent.

  - C1 (D-053) : decider_bon_commande refuse l'approbateur qui a cree,
    modifie ou soumis le bon (journal des achats), sous le meme reglage
    achats_validation_separee.
  - C2 (D-051) : declencheur garde_habilitations_voyage sur trips : un
    chauffeur pose sur un voyage (creation, mise a jour directe, dispatch)
    a un permis valide et les habilitations exigees a la date du voyage.
  - C3 (D-050) : releves CBG lus et ecrits dans le perimetre du site du
    releve (sans site : profil global) ; rapprochement limite aux tickets
    du perimetre ; un ticket present deux fois dans un releve ressort
    doublon_releve, jamais deux fois concordant.
  - C4 (D-049) : une immobilisation qui porte une intervention du loueur en
    cours ne se cloture que par valider_remise_en_service (garde de session
    sigtb.remise_en_service).
  - C5 (D-048) : affecter_au_poste exige le perimetre du chauffeur et de
    l'engin, refuse un doublon dans l'equipe (index uniques) ;
    consigner_evenement_poste exige le perimetre de l'engin.
  - C6 (D-051) : saisi_par force par le serveur ; revocation non datee dans
    le futur ; habilitations_manquantes n'est plus executable par les
    comptes (les gardes l'appellent en SECURITY DEFINER).
  - C7 (D-052) : v_pneus.cout_total reste NULL si un cout de rechapage ou de
    reparation est inconnu.

  Suspicion D-049 (pieces cumulees apres refus de remise en service) : non
  corrigee, voir D-072. Idempotent.
*/

-- C1 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decider_bon_commande(p_id uuid, p_approuver boolean, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE po public.purchase_orders; v_separee boolean;
BEGIN
  IF NOT (public.has_module_approve('purchases') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''approbation des achats requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO po FROM public.purchase_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bon de commande introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT public.bon_commande_permis(po.warehouse_id) THEN
    RAISE EXCEPTION 'Bon de commande hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF po.status <> 'submitted' THEN RAISE EXCEPTION 'Seul un bon soumis se decide' USING ERRCODE = '22023'; END IF;
  IF p_approuver IS NULL THEN RAISE EXCEPTION 'Decision requise' USING ERRCODE = '22023'; END IF;
  SELECT coalesce((SELECT (s.value ->> 'value') <> 'false' FROM public.settings s WHERE s.key = 'achats_validation_separee'), true)
    INTO v_separee;
  IF v_separee AND auth.uid() IN (po.requested_by, po.soumis_par) THEN
    RAISE EXCEPTION 'L''approbation revient a une autre personne que le demandeur' USING ERRCODE = '42501';
  END IF;
  -- Celui qui a redige ou modifie le bon (lignes, montants) ne l'approuve pas.
  IF v_separee AND EXISTS (SELECT 1 FROM public.achats_journal j
                            WHERE j.purchase_order_id = p_id AND j.par = auth.uid()
                              AND j.evenement IN ('creation', 'modification', 'soumission')) THEN
    RAISE EXCEPTION 'L''approbation revient a une autre personne que les auteurs du bon (creation, modification, soumission)'
      USING ERRCODE = '42501';
  END IF;
  IF NOT p_approuver AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif du rejet requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.purchase_orders SET
    status = CASE WHEN p_approuver THEN 'approved' ELSE 'rejected' END,
    decide_le = now(), decide_par = auth.uid(), motif_decision = nullif(btrim(coalesce(p_motif, '')), ''),
    approved_by = CASE WHEN p_approuver THEN auth.uid() END, approved_at = CASE WHEN p_approuver THEN now() END,
    updated_at = now()
   WHERE id = p_id;
  PERFORM public.journaliser_achat(p_id, CASE WHEN p_approuver THEN 'approbation' ELSE 'rejet' END, p_motif);
END;
$$;

-- C6 (d'abord : C2 en depend) ------------------------------------------------------
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
REVOKE EXECUTE ON FUNCTION public.habilitations_manquantes(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.habilitations_manquantes(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.garde_dispatch_habilitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
REVOKE EXECUTE ON FUNCTION public.garde_dispatch_habilitations() FROM PUBLIC, anon, authenticated;

-- L'auteur d'une habilitation est celui qui la saisit.
CREATE OR REPLACE FUNCTION public.horodater_habilitation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.saisi_par := auth.uid();
    NEW.saisi_le := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.horodater_habilitation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS horodater_habilitation ON public.habilitations_chauffeur;
CREATE TRIGGER horodater_habilitation BEFORE INSERT ON public.habilitations_chauffeur
  FOR EACH ROW EXECUTE FUNCTION public.horodater_habilitation();

-- Une revocation est definitive, motivee et constatee (pas dans le futur).
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
  IF NEW.revoque_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Revocation datee dans le futur : la saisir le jour ou elle prend effet' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- C2 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.garde_habilitations_voyage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE d public.drivers; v_manque text;
BEGIN
  -- Contexte interne sans JWT (purge, reprise) : pas de controle.
  IF auth.uid() IS NULL OR NEW.driver_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.driver_id IS NOT DISTINCT FROM OLD.driver_id
     AND NEW.planned_date IS NOT DISTINCT FROM OLD.planned_date THEN
    RETURN NEW;
  END IF;
  SELECT * INTO d FROM public.drivers WHERE id = NEW.driver_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chauffeur introuvable' USING ERRCODE = '22023'; END IF;
  IF d.license_expiry < NEW.planned_date THEN
    RAISE EXCEPTION 'Permis du chauffeur expire a la date du voyage' USING ERRCODE = '22023';
  END IF;
  v_manque := public.habilitations_manquantes(NEW.driver_id, NEW.planned_date);
  IF v_manque IS NOT NULL THEN
    RAISE EXCEPTION 'Chauffeur non habilite le % : % manquant(s)', to_char(NEW.planned_date, 'DD/MM/YYYY'), v_manque
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_habilitations_voyage() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_habilitations_voyage ON public.trips;
CREATE TRIGGER garde_habilitations_voyage BEFORE INSERT OR UPDATE OF driver_id, planned_date ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.garde_habilitations_voyage();

-- C3 ---------------------------------------------------------------------------
ALTER TABLE public.ecarts_releve_cbg DROP CONSTRAINT IF EXISTS ecarts_releve_cbg_nature_check;
ALTER TABLE public.ecarts_releve_cbg ADD CONSTRAINT ecarts_releve_cbg_nature_check
  CHECK (nature IN ('concordant', 'ecart_poids', 'immatriculation_differente', 'date_differente',
                    'absent_sigtb', 'manquant_releve', 'ligne_illisible', 'doublon_releve')) NOT VALID;
ALTER TABLE public.ecarts_releve_cbg VALIDATE CONSTRAINT ecarts_releve_cbg_nature_check;

DROP POLICY IF EXISTS lecture ON public.releves_cbg;
CREATE POLICY lecture ON public.releves_cbg FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin())
         AND public.site_permis(site_id));
DROP POLICY IF EXISTS lecture ON public.releves_cbg_lignes;
CREATE POLICY lecture ON public.releves_cbg_lignes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.releves_cbg r WHERE r.id = releve_id));
DROP POLICY IF EXISTS lecture ON public.ecarts_releve_cbg;
CREATE POLICY lecture ON public.ecarts_releve_cbg FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.releves_cbg r WHERE r.id = releve_id));

CREATE OR REPLACE FUNCTION public.importer_releve_cbg(
  p_reference text, p_du date, p_au date, p_site_id uuid, p_fichier text, p_lignes jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; x jsonb; n integer := 0;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  -- Un releve sans site couvre tous les sites : profil global seulement.
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise (un releve sans site exige un profil global)' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_reference, '')), '') IS NULL OR p_du IS NULL OR p_au IS NULL OR p_au < p_du THEN
    RAISE EXCEPTION 'Reference et periode du releve requises' USING ERRCODE = '22023';
  END IF;
  IF coalesce(jsonb_array_length(p_lignes), 0) = 0 THEN
    RAISE EXCEPTION 'Releve vide' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.releves_cbg (reference, periode_debut, periode_fin, site_id, fichier_source, importe_par)
  VALUES (btrim(p_reference), p_du, p_au, p_site_id, nullif(btrim(coalesce(p_fichier, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  -- Les valeurs sont gardees telles que lues ; une valeur illisible reste NULL.
  FOR x IN SELECT v FROM jsonb_array_elements(p_lignes) AS t(v) LOOP
    n := n + 1;
    INSERT INTO public.releves_cbg_lignes (releve_id, rang, ticket, date_pesee, immatriculation, brut, tare, net)
    VALUES (v_id, n, nullif(btrim(x ->> 'ticket'), ''),
            CASE WHEN x ->> 'date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (x ->> 'date')::date END,
            nullif(btrim(x ->> 'immatriculation'), ''),
            CASE WHEN x ->> 'brut' ~ '^-?\d+(\.\d+)?$' THEN (x ->> 'brut')::numeric END,
            CASE WHEN x ->> 'tare' ~ '^-?\d+(\.\d+)?$' THEN (x ->> 'tare')::numeric END,
            CASE WHEN x ->> 'net' ~ '^-?\d+(\.\d+)?$' THEN (x ->> 'net')::numeric END);
  END LOOP;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rapprocher_releve_cbg(p_releve_id uuid)
RETURNS TABLE (nature text, nombre integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.releves_cbg; l public.releves_cbg_lignes; t record; v_tol numeric; v_net numeric; v_rang integer;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.releves_cbg WHERE id = p_releve_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Releve introuvable' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.site_permis(r.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : releve d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF r.statut <> 'importe' THEN RAISE EXCEPTION 'Releve deja rapproche' USING ERRCODE = '22023'; END IF;
  SELECT coalesce((SELECT (s.value ->> 'value')::numeric FROM public.settings s WHERE s.key = 'tolerance_poids_cbg_t'), 0) INTO v_tol;

  FOR l IN SELECT * FROM public.releves_cbg_lignes WHERE releve_id = r.id ORDER BY rang LOOP
    v_net := coalesce(l.net, l.brut - l.tare);
    IF l.ticket IS NULL OR v_net IS NULL THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, nature, detail)
      VALUES (r.id, l.id, 'ligne_illisible', 'Ticket ou poids absent de la ligne ' || l.rang);
      CONTINUE;
    END IF;
    -- Un ticket deja lu plus haut dans le releve n'est pas rapproche deux fois.
    SELECT min(l2.rang) INTO v_rang FROM public.releves_cbg_lignes l2
     WHERE l2.releve_id = r.id AND l2.rang < l.rang AND upper(btrim(l2.ticket)) = upper(btrim(l.ticket));
    IF v_rang IS NOT NULL THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, nature, detail)
      VALUES (r.id, l.id, 'doublon_releve', format('Ticket %s deja present ligne %s du releve', l.ticket, v_rang));
      CONTINUE;
    END IF;
    SELECT k.id, k.net, k.mesure_le, k.trip_id, v.registration INTO t
      FROM public.v_tickets_pesee_cbg_effectifs k
      JOIN public.trips tr ON tr.id = k.trip_id
      LEFT JOIN public.vehicles v ON v.id = tr.vehicle_id
     WHERE upper(btrim(k.ticket)) = upper(btrim(l.ticket)) AND public.site_permis(k.site_id);
    IF NOT FOUND THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, nature, detail)
      VALUES (r.id, l.id, 'absent_sigtb', 'Ticket ' || l.ticket || ' du releve inconnu de SIGTB');
    ELSIF abs(v_net - t.net) > v_tol THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, ticket_id, nature, detail, ecart_net)
      VALUES (r.id, l.id, t.id, 'ecart_poids', format('Net CBG %s t, SIGTB %s t', v_net, t.net), v_net - t.net);
    ELSIF l.immatriculation IS NOT NULL AND public.normaliser_immatriculation(l.immatriculation) IS DISTINCT FROM public.normaliser_immatriculation(t.registration) THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, ticket_id, nature, detail)
      VALUES (r.id, l.id, t.id, 'immatriculation_differente', format('CBG %s, SIGTB %s', l.immatriculation, coalesce(t.registration, 'aucun camion')));
    ELSIF l.date_pesee IS NOT NULL AND l.date_pesee <> (t.mesure_le AT TIME ZONE 'Africa/Conakry')::date THEN
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, ticket_id, nature, detail)
      VALUES (r.id, l.id, t.id, 'date_differente', format('CBG %s, SIGTB %s', l.date_pesee, (t.mesure_le AT TIME ZONE 'Africa/Conakry')::date));
    ELSE
      INSERT INTO public.ecarts_releve_cbg (releve_id, ligne_id, ticket_id, nature)
      VALUES (r.id, l.id, t.id, 'concordant');
    END IF;
  END LOOP;

  -- Tickets SIGTB de la periode (et du site) absents du releve, dans le perimetre.
  INSERT INTO public.ecarts_releve_cbg (releve_id, ticket_id, nature, detail)
  SELECT r.id, k.id, 'manquant_releve', 'Ticket ' || k.ticket || ' integre a SIGTB, absent du releve CBG'
    FROM public.v_tickets_pesee_cbg_effectifs k
   WHERE (k.mesure_le AT TIME ZONE 'Africa/Conakry')::date BETWEEN r.periode_debut AND r.periode_fin
     AND (r.site_id IS NULL OR k.site_id = r.site_id)
     AND public.site_permis(k.site_id)
     AND NOT EXISTS (SELECT 1 FROM public.releves_cbg_lignes l2 WHERE l2.releve_id = r.id AND upper(btrim(l2.ticket)) = upper(btrim(k.ticket)));

  UPDATE public.releves_cbg SET statut = 'rapproche', rapproche_le = now() WHERE id = r.id;
  RETURN QUERY SELECT e.nature, count(*)::integer FROM public.ecarts_releve_cbg e WHERE e.releve_id = r.id GROUP BY e.nature ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.decider_ecart_releve_cbg(p_ecart_id uuid, p_decision text, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.ecarts_releve_cbg;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO e FROM public.ecarts_releve_cbg WHERE id = p_ecart_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ecart introuvable' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.site_permis((SELECT r.site_id FROM public.releves_cbg r WHERE r.id = e.releve_id)) THEN
    RAISE EXCEPTION 'Hors perimetre : releve d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF e.nature = 'concordant' THEN RAISE EXCEPTION 'Ligne concordante : aucune decision' USING ERRCODE = '22023'; END IF;
  IF e.decision IS NOT NULL THEN RAISE EXCEPTION 'Ecart deja decide' USING ERRCODE = '22023'; END IF;
  IF p_decision NOT IN ('accepte', 'litige') OR nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Decision (accepte ou litige) et motif requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ecarts_releve_cbg SET decision = p_decision, motif = btrim(p_motif), decide_par = auth.uid(), decide_le = now()
   WHERE id = p_ecart_id;
END;
$$;

-- C4 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cloturer_immobilisation(p_id uuid, p_fin timestamptz, p_note text DEFAULT NULL)
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
  SELECT * INTO v_avant FROM public.immobilisations WHERE id = p_id AND statut = 'ouverte' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Immobilisation ouverte introuvable' USING ERRCODE = 'P0002';
  END IF;
  -- Intervention du loueur en cours : la remise en service se valide par
  -- une autre personne (valider_remise_en_service pose la garde de session).
  IF EXISTS (SELECT 1 FROM public.interventions_loueur i WHERE i.immobilisation_id = p_id AND i.statut <> 'remise_validee')
     AND coalesce(current_setting('sigtb.remise_en_service', true), '') <> p_id::text THEN
    RAISE EXCEPTION 'Intervention du loueur en cours : l''immobilisation se cloture par la validation de la remise en service'
      USING ERRCODE = '42501';
  END IF;
  IF p_fin IS NULL THEN
    RAISE EXCEPTION 'Heure de fin requise' USING ERRCODE = '22023';
  END IF;
  PERFORM public.immobilisation_controler(p_id, v_avant.vehicle_id, v_avant.debut, p_fin);

  UPDATE public.immobilisations
  SET fin = p_fin, statut = 'cloturee', cloture_par = auth.uid(), cloture_le = now()
  WHERE id = p_id
  RETURNING * INTO v_apres;
  INSERT INTO public.immobilisations_journal (immobilisation_id, action, avant, apres, motif, auteur)
  VALUES (p_id, 'cloture', to_jsonb(v_avant), to_jsonb(v_apres), nullif(btrim(coalesce(p_note, '')), ''), auth.uid());

  UPDATE public.vehicles SET status = 'active'
  WHERE id = v_avant.vehicle_id AND status::text IN ('maintenance', 'immobilized');
END;
$$;

CREATE OR REPLACE FUNCTION public.valider_remise_en_service(p_id uuid, p_valider boolean, p_motif text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.interventions_loueur := public.intervention_ecrivable(p_id, 'terminee');
        v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF i.fin_saisie_par = auth.uid() THEN
    RAISE EXCEPTION 'La remise en service est validee par une autre personne que celle qui a saisi la fin' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(p_valider, false) THEN
    IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif du refus requis' USING ERRCODE = '22023'; END IF;
    UPDATE public.interventions_loueur SET statut = 'prise_en_charge', fin_le = NULL, fin_saisie_par = NULL WHERE id = p_id;
    PERFORM public.journaliser_intervention(p_id, 'remise_refusee', 'terminee', 'prise_en_charge', v_motif);
    RETURN 'prise_en_charge';
  END IF;
  PERFORM set_config('sigtb.remise_en_service', i.immobilisation_id::text, true);
  PERFORM public.cloturer_immobilisation(i.immobilisation_id, i.fin_le,
    concat_ws(' : ', 'Remise en service validee, intervention ' || i.numero, v_motif));
  PERFORM set_config('sigtb.remise_en_service', '', true);
  UPDATE public.interventions_loueur SET statut = 'remise_validee', remise_validee_le = now(), valide_par = auth.uid() WHERE id = p_id;
  PERFORM public.journaliser_intervention(p_id, 'remise_validee', 'terminee', 'remise_validee', v_motif);
  RETURN 'remise_validee';
END;
$$;

-- C5 ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.postes_equipe WHERE driver_id IS NOT NULL GROUP BY poste_id, driver_id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM public.postes_equipe WHERE vehicle_id IS NOT NULL GROUP BY poste_id, vehicle_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Doublons dans postes_equipe (chauffeur ou engin deux fois dans un poste) : a traiter avant la migration';
  END IF;
END $$;
DROP INDEX IF EXISTS public.ux_postes_equipe_chauffeur;
DROP INDEX IF EXISTS public.ux_postes_equipe_engin;
CREATE UNIQUE INDEX IF NOT EXISTS ux_postes_equipe_chauffeur_unique ON public.postes_equipe(poste_id, driver_id) WHERE driver_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_postes_equipe_engin_unique ON public.postes_equipe(poste_id, vehicle_id) WHERE vehicle_id IS NOT NULL;

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
    IF EXISTS (SELECT 1 FROM public.postes_equipe e WHERE e.poste_id = p.id AND e.vehicle_id = p_vehicle_id) THEN
      RAISE EXCEPTION 'Engin deja dans l''equipe de ce poste' USING ERRCODE = '22023';
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

CREATE OR REPLACE FUNCTION public.consigner_evenement_poste(
  p_poste_id uuid, p_categorie text, p_description text, p_quand timestamptz DEFAULT now(), p_vehicle_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.postes := public.poste_ecrivable(p_poste_id, 'trips', 'ouvert'); v_id uuid;
BEGIN
  IF p_quand IS NULL OR p_quand > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure de l''evenement requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_vehicle_id IS NOT NULL AND NOT public.vehicule_permis(p_vehicle_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.postes_evenements (poste_id, survenu_le, categorie, description, vehicle_id, auteur)
  VALUES (p.id, p_quand, p_categorie, btrim(coalesce(p_description, '')), p_vehicle_id, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- C7 ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_pneus WITH (security_invoker = true) AS
SELECT t.id, t.tire_number, t.brand, t.model, t.dimension, t.status, t.vehicle_id, t."position", t.site_id,
       t.purchase_date, t.purchase_price, t.fournisseur_id, t.retread_count, t.max_retreads, t.installation_date,
       t.last_inspection_date, t.notes,
       km.nb_montages, km.km_parcourus, coalesce(km.km_incomplet, false) AS km_incomplet,
       rc.cout_rechapages,
       CASE WHEN t.purchase_price IS NOT NULL AND NOT coalesce(rc.cout_inconnu, false)
            THEN t.purchase_price + coalesce(rc.cout_rechapages, 0) END AS cout_total,
       CASE WHEN t.purchase_price IS NOT NULL AND NOT coalesce(km.km_incomplet, false) AND km.km_parcourus > 0
            AND NOT coalesce(rc.cout_inconnu, false)
            THEN round((t.purchase_price + coalesce(rc.cout_rechapages, 0)) / km.km_parcourus, 2) END AS cout_km,
       p.profondeur_mm AS derniere_profondeur_mm, p.effectue_le AS profondeur_mesuree_le
  FROM public.tires t
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS nb_montages, sum(m.km_parcourus) AS km_parcourus, bool_or(m.km_parcourus IS NULL) AS km_incomplet
      FROM public.v_pneus_montages m WHERE m.tire_id = t.id) km ON true
  LEFT JOIN LATERAL (
    SELECT sum(o.cout) AS cout_rechapages, bool_or(o.cout IS NULL) AS cout_inconnu
      FROM public.v_pneus_operations_effectives o WHERE o.tire_id = t.id AND o.type IN ('rechapage', 'reparation')) rc ON true
  LEFT JOIN LATERAL (
    SELECT o.profondeur_mm, o.effectue_le FROM public.v_pneus_operations_effectives o
     WHERE o.tire_id = t.id AND o.profondeur_mm IS NOT NULL ORDER BY o.effectue_le DESC, o.saisi_le DESC LIMIT 1) p ON true;
GRANT SELECT ON public.v_pneus TO authenticated;

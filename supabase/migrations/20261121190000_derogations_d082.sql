/*
  D-082 : derogations tranchees par le proprietaire le 2026-11-16.

  1. Delegation des approbations (leve la reserve C1 de D-064). Le niveau
     `approbation` se delegue comme l'ecriture (`deleguer_droit`) : seul qui
     detient l'approbation en propre (role, sans restriction D-036) la
     delegue, jamais un droit recu par delegation, jamais l'administration
     (settings), jamais a soi-meme, perimetre du delegue inclus dans celui
     du delegant. `droit_module_base` recoit le cas `approbation` (corps de
     has_module_approve, compte passe en parametre) ; `has_module_approve`
     garde son corps (D-053) et y ajoute la delegation d'approbation en
     vigueur (sonde sur l'index partiel puis `delegation_en_vigueur`) ; une
     delegation d'approbation ne donne pas l'ecriture. Separation des taches
     (`separation_violee`, reprise de 20261121140000, seule definition) :
     en plus des regles R1 et R1b de l'ecriture, une delegation
     d'approbation sur le module exerce refuse, sans exception de droit
     propre, (R1) l'acte du delegant approuve par son delegue (delegation
     en periode maintenant ou a la date de l'acte), (R1b) l'acte du delegue
     fait pendant la delegation approuve par son delegant ; date de l'acte
     inconnue : toute delegation compte (prudence). Les controles
     d'approbation qui comparaient l'auteur a l'appelant passent par
     `separation_violee`, repris de leur DERNIERE definition :
     `decider_bon_commande` (20261120101000), `decider_paiement`
     (20261120102000), `controler_paiement` (20261117150000),
     `decider_clause` (20261121120000, renonciation),
     `signer_plan_prevention` (20261121150000). `decider_sanction`,
     `annuler_sanction`, `annuler_infraction`, `suspendre_fournisseur` et
     `reactiver_fournisseur` n'ont pas de controle d'auteur : inchanges. La
     signature des factures reste au seul role director (`avancer_facture`,
     D-029, inchangee : elle ne lit pas has_module_approve).
     `comptes_delegables` (20261121140000) compte aussi l'approbation.
  2. Penalites du loueur : facturees par le circuit D-029 au contrat de
     location (`decider_clause`, sens « facturer »), jamais deduites de la
     facture du loueur (D-032) : regle confirmee, inchangee.
  3. Bons de commande en GNF (D-055) : confirme, inchange.
  4. Couts D-058 saisis et compares en TTC, comme les budgets D-065. Un
     cout peut declarer la piece du circuit fournisseur qu'il reprend
     (`costs.piece_reprise_source`, `piece_reprise_id` : bon de commande ou
     facture du loueur), figee comme le reste du cout (`garde_cout`).
     `v_depenses_budgetaires` (20261121120000, seule definition) ne compte
     plus un tel cout dans le realise : la piece y est deja, en engage puis
     en paiement execute. `enregistrer_cout` (20261118090000, seule
     definition) recoit les deux parametres (signature remplacee).
  5. Ticket CBG rectifie : facturable apres une decision motivee d'un
     approbateur de la facturation (has_module_approve('invoices') ou
     administrateur) distinct de tout auteur de rectification du ticket et
     hors de ses delegations (`separation_violee`), sur la derniere
     rectification et un instantane a jour. `ligne_non_forcable` ne porte
     plus `ticket_rectifie` (l'anomalie reste bloquante : `ligne_bloquee`
     inchangee, la ligne attend une decision). La decision memorise la
     rectification approuvee (`reconciliation_lignes.decision_rectification_id`) ;
     le declencheur `garde_decision_ticket_rectifie` remet la ligne a
     examiner des qu'une rectification plus recente existe (ou si la decision
     n'a pas ete prise par cette voie), a chaque ecriture de la ligne dont
     l'actualisation. `cloturer_reconciliation` le verifie aussi.
     `net_superieur_capacite` reste non forcable.
  6. Les 6 alertes actives par defaut (D-068) : confirme, inchange.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- ===================================================================
-- 1. Delegation des approbations
-- ===================================================================

ALTER TABLE public.delegations_droits DROP CONSTRAINT IF EXISTS delegations_droits_niveau_check;
ALTER TABLE public.delegations_droits ADD CONSTRAINT delegations_droits_niveau_check
  CHECK (niveau IN ('ecriture', 'approbation'));

-- Droit propre (sans delegation) : reprise de 20261121140000, cas
-- `approbation` ajoute (corps de has_module_approve, D-053).
CREATE OR REPLACE FUNCTION public.droit_module_base(p_utilisateur uuid, p_module text, p_niveau text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_utilisateur AND pr.status = 'active')
    AND CASE p_niveau
      WHEN 'lecture' THEN COALESCE(
        (SELECT d.niveau IN ('lecture', 'ecriture') FROM public.droits_utilisateur d
          WHERE d.utilisateur = p_utilisateur AND d.module = p_module),
        EXISTS (SELECT 1 FROM public.profiles pr
                  JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                 WHERE pr.id = p_utilisateur AND pr.status = 'active'
                   AND rp.module = p_module AND rp.can_view))
      WHEN 'ecriture' THEN COALESCE(
        (SELECT d.niveau = 'ecriture' FROM public.droits_utilisateur d
          WHERE d.utilisateur = p_utilisateur AND d.module = p_module),
        EXISTS (SELECT 1 FROM public.profiles pr
                  JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                 WHERE pr.id = p_utilisateur AND pr.status = 'active'
                   AND rp.module = p_module AND (rp.can_create OR rp.can_edit)))
      WHEN 'approbation' THEN
        coalesce((SELECT d.niveau = 'ecriture' FROM public.droits_utilisateur d
                   WHERE d.utilisateur = p_utilisateur AND d.module = p_module), true)
        AND EXISTS (SELECT 1 FROM public.profiles pr
                      JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                     WHERE pr.id = p_utilisateur AND pr.status = 'active'
                       AND rp.module = p_module AND rp.can_approve)
      ELSE false
    END;
$$;

-- Approbation : corps de main (20261121140000, D-053) inchange, plus la
-- delegation d'approbation en vigueur (D-082).
CREATE OR REPLACE FUNCTION public.has_module_approve(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active')
     AND coalesce((SELECT d.niveau = 'ecriture' FROM public.droits_utilisateur d
                    WHERE d.utilisateur = auth.uid() AND d.module = p_module), true)
     AND EXISTS (SELECT 1 FROM public.profiles pr JOIN public.role_permissions rp ON rp.role::text = pr.role::text
                  WHERE pr.id = auth.uid() AND pr.status = 'active' AND rp.module = p_module AND rp.can_approve))
    OR (EXISTS (SELECT 1 FROM public.delegations_droits g
                 WHERE g.delegue = auth.uid() AND g.module = p_module AND g.niveau = 'approbation'
                   AND g.revoquee_le IS NULL AND g.debut <= now() AND now() < g.fin)
        AND public.delegation_en_vigueur(auth.uid(), p_module, 'approbation'));
$$;

-- deleguer_droit : reprise de 20261121140000 (seule definition), niveau
-- `approbation` accepte (D-082) ; tous les autres controles inchanges.
CREATE OR REPLACE FUNCTION public.deleguer_droit(
  p_delegue uuid, p_module text, p_niveau text, p_debut timestamptz, p_fin timestamptz, p_motif text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  -- C3 : jamais dans le passe (une delegation retroactive est ramenee a
  -- l'instant present, valeur journalisee).
  v_debut timestamptz := greatest(coalesce(p_debut, now()), now());
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'Compte actif requis' USING ERRCODE = '42501';
  END IF;
  IF p_niveau IS NULL OR p_niveau NOT IN ('ecriture', 'approbation') THEN
    RAISE EXCEPTION 'Niveau delegable : ecriture (la lecture du module l''accompagne) ou approbation (D-082)' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.module = p_module) THEN
    RAISE EXCEPTION 'Module inconnu : %', p_module USING ERRCODE = '22023';
  END IF;
  IF p_module = 'settings' THEN
    RAISE EXCEPTION 'L''administration ne se delegue pas' USING ERRCODE = '22023';
  END IF;
  IF p_delegue IS NULL OR p_delegue = auth.uid() THEN
    RAISE EXCEPTION 'Delegation a soi-meme interdite' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_delegue AND status = 'active') THEN
    RAISE EXCEPTION 'Delegue inconnu ou inactif' USING ERRCODE = '22023';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif requis' USING ERRCODE = '22023';
  END IF;
  IF p_fin IS NULL OR p_fin <= v_debut OR p_fin <= now() THEN
    RAISE EXCEPTION 'Periode invalide : la fin doit suivre le debut et l''instant present' USING ERRCODE = '22023';
  END IF;
  IF NOT public.droit_module_base(auth.uid(), p_module, p_niveau) THEN
    RAISE EXCEPTION 'Vous ne detenez pas ce droit (%, %) : il ne peut etre delegue', p_module, p_niveau
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.droits_utilisateur d
              WHERE d.utilisateur = p_delegue AND d.module = p_module AND d.niveau <> 'ecriture') THEN
    RAISE EXCEPTION 'Le delegue fait l''objet d''une restriction administrateur sur ce module' USING ERRCODE = '22023';
  END IF;
  IF NOT public.perimetre_inclus(p_delegue, auth.uid()) THEN
    RAISE EXCEPTION 'Le perimetre site du delegue depasse le votre : delegation refusee' USING ERRCODE = '22023';
  END IF;
  -- C5 : deux delegations identiques concurrentes sont serialisees.
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.delegation.' || auth.uid()::text || '.' || p_delegue::text || '.' || p_module));
  IF EXISTS (SELECT 1 FROM public.delegations_droits g
              WHERE g.delegant = auth.uid() AND g.delegue = p_delegue AND g.module = p_module
                AND g.niveau = p_niveau AND g.revoquee_le IS NULL
                AND g.debut < p_fin AND g.fin > v_debut) THEN
    RAISE EXCEPTION 'Une delegation identique couvre deja la periode' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.delegations_droits (delegant, delegue, module, niveau, debut, fin, motif)
  VALUES (auth.uid(), p_delegue, p_module, p_niveau, v_debut, p_fin, v_motif)
  RETURNING id INTO v_id;
  INSERT INTO public.journal_delegations (delegation_id, evenement, delegant, delegue, module, niveau, debut, fin, motif, auteur)
  VALUES (v_id, 'creation', auth.uid(), p_delegue, p_module, p_niveau, v_debut, p_fin, v_motif, auth.uid());
  RETURN v_id;
END;
$$;

-- comptes_delegables : reprise de 20261121140000 ; un compte qui ne detient
-- que l'approbation d'un module delegable voit aussi les comptes (C4).
CREATE OR REPLACE FUNCTION public.comptes_delegables()
RETURNS TABLE (id uuid, full_name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.full_name, p.role::text
    FROM public.profiles p
   WHERE p.status = 'active' AND p.id <> auth.uid()
     AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.status = 'active')
     AND EXISTS (SELECT 1 FROM (SELECT DISTINCT rp.module FROM public.role_permissions rp) m
                  WHERE m.module <> 'settings'
                    AND (public.droit_module_base(auth.uid(), m.module, 'ecriture')
                         OR public.droit_module_base(auth.uid(), m.module, 'approbation')))
     AND public.perimetre_inclus(p.id, auth.uid())
   ORDER BY p.full_name;
$$;

-- Separation des taches : reprise de 20261121140000 (seule definition).
-- R1 et R1b de l'ecriture inchanges ; ajout des delegations d'approbation
-- sur le module exerce, sans exception de droit propre (D-082) :
--  R1  : l'auteur est le delegant d'une delegation d'approbation vers
--        l'appelant, en periode maintenant ou a la date de l'acte ;
--  R1b : l'auteur etait le delegue d'une delegation d'approbation de
--        l'appelant a la date de l'acte.
-- Date de l'acte inconnue (NULL) : toute delegation entre eux compte.
CREATE OR REPLACE FUNCTION public.separation_violee(p_auteur uuid, p_module_appelant text, p_module_acte text,
                                                    p_acte_le timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.auteur_ou_delegant(p_auteur, p_module_appelant)
      OR (p_auteur IS NOT NULL AND p_auteur <> auth.uid()
          AND EXISTS (SELECT 1 FROM public.delegations_droits g
                       WHERE g.delegant = auth.uid() AND g.delegue = p_auteur AND g.niveau = 'ecriture'
                         AND (p_acte_le IS NULL
                              OR (g.debut <= p_acte_le AND p_acte_le < g.fin
                                  AND (g.revoquee_le IS NULL OR g.revoquee_le > p_acte_le))))
          AND NOT public.droit_module_base(p_auteur, p_module_acte, 'ecriture'))
      OR (p_auteur IS NOT NULL AND p_auteur <> auth.uid()
          AND EXISTS (SELECT 1 FROM public.delegations_droits g
                       WHERE g.niveau = 'approbation' AND g.module = p_module_appelant
                         AND ((g.delegant = p_auteur AND g.delegue = auth.uid()
                               AND ((g.revoquee_le IS NULL AND g.debut <= now() AND now() < g.fin)
                                    OR p_acte_le IS NULL
                                    OR (g.debut <= p_acte_le AND p_acte_le < g.fin
                                        AND (g.revoquee_le IS NULL OR g.revoquee_le > p_acte_le))))
                              OR (g.delegant = auth.uid() AND g.delegue = p_auteur
                                  AND (p_acte_le IS NULL
                                       OR (g.debut <= p_acte_le AND p_acte_le < g.fin
                                           AND (g.revoquee_le IS NULL OR g.revoquee_le > p_acte_le)))))));
$$;
REVOKE EXECUTE ON FUNCTION public.separation_violee(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.separation_violee(uuid, text, text, timestamptz) TO service_role;
REVOKE EXECUTE ON FUNCTION public.droit_module_base(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.droit_module_base(uuid, text, text) TO service_role;

-- decider_bon_commande : reprise de 20261120101000 (C1), controles
-- d'auteur par separation_violee (demandeur, soumission, journal).
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
  IF v_separee AND (public.separation_violee(po.requested_by, 'purchases', 'purchases', po.created_at)
                    OR public.separation_violee(po.soumis_par, 'purchases', 'purchases', po.soumis_le)) THEN
    RAISE EXCEPTION 'L''approbation revient a une autre personne que le demandeur' USING ERRCODE = '42501';
  END IF;
  -- Celui qui a redige ou modifie le bon (lignes, montants) ne l'approuve
  -- pas, ni son delegue ou son delegant (D-082).
  IF v_separee AND EXISTS (SELECT 1 FROM public.achats_journal j
                            WHERE j.purchase_order_id = p_id
                              AND j.evenement IN ('creation', 'modification', 'soumission')
                              AND public.separation_violee(j.par, 'purchases', 'purchases', j.le)) THEN
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

-- decider_paiement : reprise de 20261120102000 (R3), controle du proposant
-- par separation_violee.
CREATE OR REPLACE FUNCTION public.decider_paiement(p_id uuid, p_approuver boolean, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.paiements_fournisseur; v_separee boolean;
BEGIN
  IF NOT (public.has_module_approve('invoices') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''approbation des factures requis' USING ERRCODE = '42501';
  END IF;
  p := public.paiement_verrouille(p_id);
  IF p.statut <> 'propose' THEN RAISE EXCEPTION 'Seul un paiement propose se decide' USING ERRCODE = '22023'; END IF;
  IF p_approuver IS NULL THEN RAISE EXCEPTION 'Decision requise' USING ERRCODE = '22023'; END IF;
  SELECT coalesce((SELECT (s.value ->> 'value') <> 'false' FROM public.settings s WHERE s.key = 'paiements_validation_separee'), true) INTO v_separee;
  IF v_separee AND public.separation_violee(p.propose_par, 'invoices', 'invoices', p.propose_le) THEN
    RAISE EXCEPTION 'L''approbation revient a une autre personne que le proposant' USING ERRCODE = '42501';
  END IF;
  IF NOT p_approuver AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif du rejet requis' USING ERRCODE = '22023';
  END IF;
  IF p_approuver THEN
    PERFORM public.verifier_piece_payable(p);
  END IF;
  UPDATE public.paiements_fournisseur SET statut = CASE WHEN p_approuver THEN 'approuve' ELSE 'rejete' END,
    decide_par = auth.uid(), decide_le = now(), motif_decision = nullif(btrim(coalesce(p_motif, '')), '')
   WHERE id = p_id;
END;
$$;

-- controler_paiement : reprise de 20261117150000 (seule definition),
-- proposant et executant par separation_violee.
CREATE OR REPLACE FUNCTION public.controler_paiement(p_id uuid, p_conforme boolean, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.paiements_fournisseur;
BEGIN
  IF NOT (public.has_module_approve('invoices') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''approbation des factures requis pour le controle' USING ERRCODE = '42501';
  END IF;
  p := public.paiement_verrouille(p_id);
  IF p.statut <> 'execute' THEN RAISE EXCEPTION 'Seul un paiement execute se controle' USING ERRCODE = '22023'; END IF;
  IF p.controle_resultat IS NOT NULL THEN RAISE EXCEPTION 'Paiement deja controle' USING ERRCODE = '22023'; END IF;
  IF public.separation_violee(p.propose_par, 'invoices', 'invoices', p.propose_le)
     OR public.separation_violee(p.execute_par, 'invoices', 'invoices', p.execute_saisi_le) THEN
    RAISE EXCEPTION 'Le controle revient a une autre personne que le proposant et l''executant' USING ERRCODE = '42501';
  END IF;
  IF p_conforme IS NULL THEN RAISE EXCEPTION 'Resultat du controle requis' USING ERRCODE = '22023'; END IF;
  IF NOT p_conforme AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif de l''anomalie requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.paiements_fournisseur SET controle_resultat = CASE WHEN p_conforme THEN 'conforme' ELSE 'anomalie' END,
    controle_motif = nullif(btrim(coalesce(p_motif, '')), ''), controle_par = auth.uid(), controle_le = now()
   WHERE id = p_id;
END;
$$;

-- signer_plan_prevention : reprise de 20261121150000 (seule definition),
-- redacteur et contributeurs par separation_violee (contributeurs sans
-- date : toute delegation compte).
CREATE OR REPLACE FUNCTION public.signer_plan_prevention(p_plan uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.plans_prevention;
BEGIN
  IF NOT (public.has_module_approve('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Signature reservee aux personnes habilitees (approbation exploitation)' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.plans_prevention WHERE id = p_plan FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(p.site_id) THEN
    RAISE EXCEPTION 'Plan introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p.statut <> 'brouillon' THEN RAISE EXCEPTION 'Plan deja signe ou clos' USING ERRCODE = '22023'; END IF;
  IF public.separation_violee(p.redige_par, 'trips', 'trips', p.redige_le)
     OR EXISTS (SELECT 1 FROM unnest(p.contributeurs) c(id) WHERE public.separation_violee(c.id, 'trips', 'trips', NULL)) THEN
    RAISE EXCEPTION 'Le redacteur d''un plan ne le signe pas : signature par une autre personne habilitee' USING ERRCODE = '42501';
  END IF;
  IF p.valide_au < current_date THEN RAISE EXCEPTION 'Periode de validite depassee' USING ERRCODE = '22023'; END IF;
  UPDATE public.plans_prevention SET statut = 'signe', signe_par = auth.uid(), signe_le = now(),
         signataire = (SELECT pr.full_name FROM public.profiles pr WHERE pr.id = auth.uid())
   WHERE id = p.id;
  IF p.remplace_plan_id IS NOT NULL THEN
    UPDATE public.plans_prevention SET statut = 'remplace' WHERE id = p.remplace_plan_id AND statut = 'signe';
  END IF;
END;
$$;

-- decider_clause : reprise de 20261121120000 (seule definition), la
-- renonciation separee controle l'auteur du calcul par separation_violee.
CREATE OR REPLACE FUNCTION public.decider_clause(
  p_calcul uuid, p_appliquer boolean, p_motif text, p_facture uuid DEFAULT NULL, p_taux_taxe numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k public.calculs_clauses; c public.contrats; f public.factures; v_sens text; v_id uuid; v_libelle text;
  v_separee boolean; v_reste numeric;
BEGIN
  IF p_appliquer IS NULL THEN RAISE EXCEPTION 'Decision requise' USING ERRCODE = '22023'; END IF;
  v_separee := coalesce((SELECT (s.value ->> 'value') <> 'false' FROM public.settings s WHERE s.key = 'clauses_renonciation_separee'), true);
  IF p_appliquer OR NOT v_separee THEN
    IF NOT ((public.has_module_write('contracts') AND public.has_module_write('invoices')) OR public.is_admin()) THEN
      RAISE EXCEPTION 'Droits d''ecriture sur les contrats et la facturation requis' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT (public.has_module_approve('contracts') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Renoncer a une clause : droit d''approbation des contrats requis (reglage clauses_renonciation_separee)' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO k FROM public.calculs_clauses WHERE id = p_calcul FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Calcul introuvable' USING ERRCODE = '22023'; END IF;
  IF k.statut <> 'propose' THEN RAISE EXCEPTION 'Seule une proposition se decide (%)', k.statut USING ERRCODE = '22023'; END IF;
  IF public.texte_ou_null(p_motif) IS NULL THEN RAISE EXCEPTION 'Motif de la decision requis' USING ERRCODE = '22023'; END IF;

  IF NOT p_appliquer THEN
    IF v_separee AND public.separation_violee(k.calcule_par, 'contracts', 'contracts', k.calcule_le) THEN
      RAISE EXCEPTION 'Renonciation par une autre personne que l''auteur du calcul (reglage clauses_renonciation_separee)' USING ERRCODE = '42501';
    END IF;
    UPDATE public.calculs_clauses SET statut = 'ecarte', decide_par = auth.uid(), decide_le = now(), motif_decision = btrim(p_motif)
     WHERE id = k.id;
    INSERT INTO public.calculs_clauses_journal (calcul_id, evenement, motif, par) VALUES (k.id, 'ecarte', btrim(p_motif), auth.uid());
    RETURN NULL;
  END IF;

  SELECT * INTO c FROM public.contrats WHERE id = k.contrat_id;
  IF c.statut = 'brouillon' THEN
    RAISE EXCEPTION 'Contrat en brouillon (non signe) : aucune clause ne s''applique' USING ERRCODE = '22023';
  END IF;
  v_sens := CASE
    WHEN c.nature = 'client' AND k.type_clause = 'bonus' THEN 'facturer'
    WHEN c.nature = 'client' THEN 'deduire'
    WHEN c.nature = 'location' AND k.type_clause IN ('penalite', 'retenue') THEN 'facturer'
  END;
  IF v_sens IS NULL THEN
    RAISE EXCEPTION 'Application non prise en charge : un bonus du loueur se regle sur sa facture (controle D-032)' USING ERRCODE = '22023';
  END IF;
  v_libelle := CASE k.type_clause WHEN 'penalite' THEN 'Penalite' WHEN 'bonus' THEN 'Bonus' ELSE 'Retenue' END
               || ' : ' || k.libelle || ' (' || to_char(k.periode_debut, 'DD/MM/YYYY') || ' au ' || to_char(k.periode_fin, 'DD/MM/YYYY') || ')';

  IF p_facture IS NOT NULL THEN
    SELECT * INTO f FROM public.factures WHERE id = p_facture FOR UPDATE;
    IF NOT FOUND OR f.contrat_id <> c.id OR f.type <> 'facture' OR f.devise <> k.devise THEN
      RAISE EXCEPTION 'Facture du meme contrat et de la meme devise requise' USING ERRCODE = '22023';
    END IF;
    IF f.statut = 'brouillon' AND f.prepare_par IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Une ligne de clause s''ajoute a un brouillon que vous avez prepare (le signataire ne doit pas en etre le preparateur)'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_sens = 'facturer' THEN
    IF p_facture IS NULL THEN
      IF p_taux_taxe IS NULL OR p_taux_taxe < 0 THEN
        RAISE EXCEPTION 'Taux de taxe requis pour une nouvelle facture (0 si exonere)' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.factures (type, contrat_id, objet, periode_debut, periode_fin, devise, taux_taxe_pct, delai_paiement_jours, prepare_par)
      VALUES ('facture', c.id, v_libelle, k.periode_debut, k.periode_fin, k.devise, p_taux_taxe, c.delai_paiement_jours, auth.uid())
      RETURNING id INTO v_id;
      PERFORM public.journaliser_facture(v_id, 'generation', btrim(p_motif));
    ELSE
      IF f.statut <> 'brouillon' THEN RAISE EXCEPTION 'Une ligne s''ajoute a une facture brouillon' USING ERRCODE = '22023'; END IF;
      v_id := f.id;
    END IF;
    INSERT INTO public.facture_lignes (facture_id, ordre, libelle, quantite, unite, prix_unitaire, montant, calcul_clause_id)
    VALUES (v_id, 900, v_libelle, 1, 'forfait', k.montant_propose_ht, k.montant_propose_ht, k.id);
    PERFORM public.recalculer_facture(v_id);
    PERFORM public.journaliser_facture(v_id, 'clause', btrim(p_motif));
  ELSE
    IF p_facture IS NULL THEN
      RAISE EXCEPTION 'Facture du contrat requise : avoir sur une facture emise ou ligne sur un brouillon' USING ERRCODE = '22023';
    END IF;
    IF f.statut = 'emise' THEN
      -- Reste avoirable : HT de la facture moins les avoirs deja crees (non annules).
      v_reste := f.montant_ht + coalesce((SELECT sum(a.montant_ht) FROM public.factures a
                                           WHERE a.facture_origine_id = f.id AND a.type = 'avoir' AND a.statut <> 'annulee'), 0);
      IF k.montant_propose_ht > v_reste THEN
        RAISE EXCEPTION 'Deduction superieure au reste HT de la facture apres avoirs (% %)', v_reste, f.devise USING ERRCODE = '22023';
      END IF;
      v_id := public.creer_avoir(f.id, k.montant_propose_ht, v_libelle || ' : ' || btrim(p_motif));
      UPDATE public.facture_lignes SET calcul_clause_id = k.id WHERE facture_id = v_id;
      PERFORM public.journaliser_facture(v_id, 'clause', btrim(p_motif));
    ELSIF f.statut = 'brouillon' THEN
      IF k.montant_propose_ht > f.montant_ht THEN
        RAISE EXCEPTION 'Deduction superieure au montant HT du brouillon (% %)', f.montant_ht, f.devise USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.facture_lignes (facture_id, ordre, libelle, quantite, unite, prix_unitaire, montant, calcul_clause_id)
      VALUES (f.id, 900, v_libelle, 1, 'forfait', -k.montant_propose_ht, -k.montant_propose_ht, k.id);
      PERFORM public.recalculer_facture(f.id);
      PERFORM public.journaliser_facture(f.id, 'clause', btrim(p_motif));
      v_id := f.id;
    ELSE
      RAISE EXCEPTION 'Facture brouillon ou emise requise (%)', f.statut USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.calculs_clauses SET statut = 'applique', decide_par = auth.uid(), decide_le = now(),
    motif_decision = btrim(p_motif), facture_id = v_id
   WHERE id = k.id;
  INSERT INTO public.calculs_clauses_journal (calcul_id, evenement, facture_id, motif, par)
  VALUES (k.id, 'applique', v_id, btrim(p_motif), auth.uid());
  RETURN v_id;
END;
$$;

-- ===================================================================
-- 4. Couts TTC et piece reprise (pas de double compte au realise)
-- ===================================================================

ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS piece_reprise_source text;
ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS piece_reprise_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costs_piece_reprise_coherente' AND conrelid = 'public.costs'::regclass) THEN
    ALTER TABLE public.costs ADD CONSTRAINT costs_piece_reprise_coherente
      CHECK ((piece_reprise_source IS NULL AND piece_reprise_id IS NULL)
             OR (piece_reprise_source IN ('bon_commande', 'facture_loueur') AND piece_reprise_id IS NOT NULL));
  END IF;
END $$;
COMMENT ON COLUMN public.costs.amount IS
  'Montant TTC saisi (D-082), dans la devise du cout ; compare aux budgets TTC (D-065).';
COMMENT ON COLUMN public.costs.piece_reprise_source IS
  'Piece du circuit fournisseur reprise par ce cout (bon_commande ou facture_loueur, D-082) : le cout ne compte pas au realise budgetaire, la piece y est deja.';

-- garde_cout : reprise de 20261118090000 (seule definition), piece reprise figee.
CREATE OR REPLACE FUNCTION public.garde_cout()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un cout ne se supprime pas : annulez-le avec un motif' USING ERRCODE = '42501';
  END IF;
  IF OLD.statut <> 'enregistre' OR NEW.statut <> 'annule'
     OR NEW.date IS DISTINCT FROM OLD.date OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.devise IS DISTINCT FROM OLD.devise OR NEW.site_id IS DISTINCT FROM OLD.site_id
     OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR NEW.category_id IS DISTINCT FROM OLD.category_id
     OR NEW.description IS DISTINCT FROM OLD.description OR NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.numero IS DISTINCT FROM OLD.numero OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.piece_reprise_source IS DISTINCT FROM OLD.piece_reprise_source
     OR NEW.piece_reprise_id IS DISTINCT FROM OLD.piece_reprise_id THEN
    RAISE EXCEPTION 'Cout fige : seule une annulation motivee est possible' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- enregistrer_cout : reprise de 20261118090000 (seule definition), montant
-- TTC, piece reprise facultative. Signature remplacee (deux parametres
-- facultatifs en fin : les appels existants restent valides).
DROP FUNCTION IF EXISTS public.enregistrer_cout(date, text, numeric, text, uuid, uuid, uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.enregistrer_cout(
  p_date date, p_description text, p_montant numeric, p_devise text,
  p_categorie uuid DEFAULT NULL, p_site uuid DEFAULT NULL, p_vehicule uuid DEFAULT NULL,
  p_reference text DEFAULT NULL, p_mode_paiement text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_piece_source text DEFAULT NULL, p_piece_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_devise text := upper(btrim(coalesce(p_devise, ''))); v_depot uuid;
BEGIN
  IF NOT (public.has_module_write('costs') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les couts requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_date > current_date THEN RAISE EXCEPTION 'Date de la depense requise, non future' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_description, '')), '') IS NULL THEN RAISE EXCEPTION 'Description requise' USING ERRCODE = '22023'; END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN RAISE EXCEPTION 'Montant TTC positif requis' USING ERRCODE = '22023'; END IF;
  IF v_devise !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Devise requise (code a trois lettres)' USING ERRCODE = '22023'; END IF;
  IF p_categorie IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cost_categories c WHERE c.id = p_categorie AND coalesce(c.active, true)) THEN
    RAISE EXCEPTION 'Categorie inconnue ou inactive' USING ERRCODE = '22023';
  END IF;
  IF p_site IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = p_site) THEN
    RAISE EXCEPTION 'Site inconnu' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise (un cout sans site exige un profil global)' USING ERRCODE = '42501';
  END IF;
  IF p_vehicule IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicule) THEN RAISE EXCEPTION 'Engin inconnu' USING ERRCODE = '22023'; END IF;
    IF NOT public.vehicule_permis(p_vehicule) THEN RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501'; END IF;
  END IF;
  IF (p_piece_source IS NULL) <> (p_piece_id IS NULL) THEN
    RAISE EXCEPTION 'Piece reprise : type et piece ensemble' USING ERRCODE = '22023';
  END IF;
  IF p_piece_source = 'bon_commande' THEN
    SELECT b.warehouse_id INTO v_depot FROM public.purchase_orders b WHERE b.id = p_piece_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bon de commande repris introuvable' USING ERRCODE = '22023'; END IF;
    IF NOT public.bon_commande_permis(v_depot) THEN RAISE EXCEPTION 'Hors perimetre : bon d''un autre site' USING ERRCODE = '42501'; END IF;
  ELSIF p_piece_source = 'facture_loueur' THEN
    IF NOT EXISTS (SELECT 1 FROM public.factures_fournisseur f WHERE f.id = p_piece_id) THEN
      RAISE EXCEPTION 'Facture du loueur reprise introuvable' USING ERRCODE = '22023';
    END IF;
  ELSIF p_piece_source IS NOT NULL THEN
    RAISE EXCEPTION 'Piece reprise : bon de commande ou facture du loueur' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.costs (numero, date, category_id, vehicle_id, site_id, description, amount, devise, reference, payment_method, notes,
                            created_by, piece_reprise_source, piece_reprise_id)
  VALUES ('CST-' || to_char(p_date, 'YYYY') || '-' || lpad(nextval('public.costs_numero_seq')::text, 5, '0'),
          p_date, p_categorie, p_vehicule, p_site, btrim(p_description), p_montant, v_devise,
          nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_mode_paiement, '')), ''),
          nullif(btrim(coalesce(p_notes, '')), ''), auth.uid(), p_piece_source, p_piece_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enregistrer_cout(date, text, numeric, text, uuid, uuid, uuid, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_cout(date, text, numeric, text, uuid, uuid, uuid, text, text, text, text, uuid) TO authenticated;

-- v_depenses_budgetaires : reprise de 20261121120000 (seule definition). Un
-- cout qui reprend une piece du circuit fournisseur n'est plus compte au
-- realise (la piece y figure deja : engage, puis paiement execute).
CREATE OR REPLACE VIEW public.v_depenses_budgetaires WITH (security_invoker = true) AS
SELECT 'engage'::text AS categorie, 'bon_commande'::text AS origine, po.id AS piece_id, po.po_number::text AS piece,
       po.po_date AS date_operation, w.site_id, im.nature_id, 'GNF'::text AS devise,
       (coalesce(sum(li.quantity * li.unit_price), 0) + coalesce(po.tax_amount, 0))::numeric(18,2) AS montant,
       'TTC (commande HT + taxes du bon)'::text AS base_montant, s.company_name::text AS tiers,
       'bon_commande'::text AS source_imputation, po.id AS piece_imputee
  FROM public.purchase_orders po
  JOIN public.purchase_order_items li ON li.purchase_order_id = po.id
  LEFT JOIN public.warehouses w ON w.id = po.warehouse_id
  LEFT JOIN public.suppliers s ON s.id = po.supplier_id
  LEFT JOIN public.v_imputations_courantes im ON im.source = 'bon_commande' AND im.piece_id = po.id
 WHERE po.status IN ('approved', 'partially_received')
 GROUP BY po.id, po.po_number, po.po_date, po.tax_amount, w.site_id, im.nature_id, s.company_name
HAVING coalesce(sum(li.quantity * li.unit_price), 0) + coalesce(po.tax_amount, 0) > 0
UNION ALL
SELECT 'engage', 'a_payer', r.piece_id, r.piece::text, r.date_piece, w.site_id, im.nature_id, r.devise,
       (r.base - r.paye)::numeric(18,2),
       CASE WHEN r.source = 'facture_loueur' AND ff.montant_ttc_facture IS NULL THEN 'HT (TTC du loueur non saisi), reste a payer'
            ELSE 'TTC, reste a payer' END,
       r.beneficiaire, r.source, r.piece_id
  FROM public.v_reste_a_payer r
  LEFT JOIN public.purchase_orders po ON r.source = 'bon_commande' AND po.id = r.piece_id
  LEFT JOIN public.warehouses w ON w.id = po.warehouse_id
  LEFT JOIN public.factures_fournisseur ff ON r.source = 'facture_loueur' AND ff.id = r.piece_id
  LEFT JOIN public.v_imputations_courantes im ON im.source = r.source AND im.piece_id = r.piece_id
 WHERE r.base - r.paye > 0
UNION ALL
SELECT 'realise', 'paiement', p.id, p.numero, p.execute_le, w.site_id, im.nature_id, p.devise, p.montant_execute::numeric(18,2),
       'Montant verse', p.beneficiaire,
       CASE WHEN p.facture_fournisseur_id IS NOT NULL THEN 'facture_loueur' ELSE 'bon_commande' END,
       coalesce(p.facture_fournisseur_id, p.purchase_order_id)
  FROM public.paiements_fournisseur p
  LEFT JOIN public.purchase_orders po ON po.id = p.purchase_order_id
  LEFT JOIN public.warehouses w ON w.id = po.warehouse_id
  LEFT JOIN public.v_imputations_courantes im
         ON (im.source = 'bon_commande' AND im.piece_id = p.purchase_order_id)
         OR (im.source = 'facture_loueur' AND im.piece_id = p.facture_fournisseur_id)
 WHERE p.statut = 'execute' AND (p.purchase_order_id IS NULL OR po.id IS NOT NULL)
UNION ALL
SELECT 'realise', 'cout', c.id, c.numero, c.date, c.site_id, coalesce(im.nature_id, cc.nature_depense_id), c.devise,
       c.amount::numeric(18,2), 'TTC saisi (cout D-058)', NULL::text, 'cout', c.id
  FROM public.costs c
  LEFT JOIN public.cost_categories cc ON cc.id = c.category_id
  LEFT JOIN public.v_imputations_courantes im ON im.source = 'cout' AND im.piece_id = c.id
 WHERE c.statut = 'enregistre' AND c.piece_reprise_id IS NULL;
REVOKE ALL ON public.v_depenses_budgetaires FROM anon;
GRANT SELECT ON public.v_depenses_budgetaires TO authenticated;

-- ===================================================================
-- 5. Ticket CBG rectifie : facturable sur decision d'un approbateur distinct
-- ===================================================================

ALTER TABLE public.reconciliation_lignes ADD COLUMN IF NOT EXISTS decision_rectification_id uuid
  REFERENCES public.rectifications_tickets_pesee_cbg(id);
COMMENT ON COLUMN public.reconciliation_lignes.decision_rectification_id IS
  'Rectification du ticket CBG approuvee par la decision « facturable » (D-082) ; une rectification plus recente remet la ligne a examiner.';

-- Derniere rectification du ticket CBG d'un voyage (meme ordre que la vue
-- effective et l'index). Interne.
CREATE OR REPLACE FUNCTION public.derniere_rectification_ticket(p_trip_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id FROM public.rectifications_tickets_pesee_cbg r
    JOIN public.tickets_pesee_cbg t ON t.id = r.ticket_id
   WHERE t.trip_id = p_trip_id
   ORDER BY r.corrige_le DESC, r.id DESC
   LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.derniere_rectification_ticket(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.derniere_rectification_ticket(uuid) TO service_role;

-- Anomalies qu'aucune decision ne rend facturables : reprise de
-- 20261121160000 (seule definition), sans `ticket_rectifie` (D-082 : voie
-- d'approbation dans decider_ligne_reconciliation). net_superieur_capacite reste.
CREATE OR REPLACE FUNCTION public.ligne_non_forcable(p_anomalies text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(p_anomalies && ARRAY['base_absente', 'litige', 'rejet', 'sans_ticket_cbg',
    'ticket_double', 'non_accepte', 'net_superieur_capacite'], false);
$$;

-- Une decision « facturable » sur un ticket rectifie ne vaut que pour la
-- rectification approuvee : toute ecriture de la ligne (actualisation
-- comprise) la remet a examiner si une rectification plus recente existe ou
-- si la decision n'a pas ete prise par la voie d'approbation.
CREATE OR REPLACE FUNCTION public.garde_decision_ticket_rectifie()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.decision = 'facturable' AND coalesce(NEW.anomalies @> ARRAY['ticket_rectifie'], false)
     AND NEW.decision_rectification_id IS DISTINCT FROM public.derniere_rectification_ticket(NEW.trip_id) THEN
    NEW.decision := NULL;
    NEW.motif_decision := NULL;
    NEW.decide_par := NULL;
    NEW.decide_le := NULL;
  END IF;
  IF NEW.decision IS DISTINCT FROM 'facturable' THEN
    NEW.decision_rectification_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_decision_ticket_rectifie() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_decision_ticket_rectifie ON public.reconciliation_lignes;
CREATE TRIGGER garde_decision_ticket_rectifie BEFORE INSERT OR UPDATE ON public.reconciliation_lignes
  FOR EACH ROW EXECUTE FUNCTION public.garde_decision_ticket_rectifie();

-- decider_ligne_reconciliation : reprise de 20261121160000 (seule
-- definition la plus recente). Ticket rectifie : approbateur de la
-- facturation, distinct de tout auteur de rectification du ticket et hors
-- de ses delegations, instantane a jour.
CREATE OR REPLACE FUNCTION public.decider_ligne_reconciliation(p_ligne_id uuid, p_decision text, p_motif text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE l public.reconciliation_lignes; e public.v_tickets_pesee_cbg_effectifs; v_rect uuid;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO l FROM public.reconciliation_lignes WHERE id = p_ligne_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ligne introuvable' USING ERRCODE = 'P0002'; END IF;
  IF (SELECT statut FROM public.reconciliations WHERE id = l.reconciliation_id) <> 'ouverte' THEN
    RAISE EXCEPTION 'Reconciliation cloturee' USING ERRCODE = '22023';
  END IF;
  IF p_decision IS NOT NULL AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour une decision' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'facturable' AND l.tonnage_base IS NULL THEN
    RAISE EXCEPTION 'Tonnage de base absent : corriger le voyage puis actualiser' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'facturable' AND public.ligne_non_forcable(l.anomalies) THEN
    RAISE EXCEPTION 'Anomalies a examiner avant de declarer la ligne facturable' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'facturable' AND coalesce(l.anomalies @> ARRAY['ticket_rectifie'], false) THEN
    IF NOT (public.has_module_approve('invoices') OR public.is_admin()) THEN
      RAISE EXCEPTION 'Ticket CBG rectifie : la facturation est decidee par un approbateur de la facturation (D-082)'
        USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.rectifications_tickets_pesee_cbg r
                 JOIN public.tickets_pesee_cbg t ON t.id = r.ticket_id
                WHERE t.trip_id = l.trip_id
                  AND (r.corrige_par IS NULL
                       OR public.separation_violee(r.corrige_par, 'invoices', 'trips', r.corrige_le)
                       OR public.separation_violee(r.corrige_par, 'invoices', 'invoices', r.corrige_le))) THEN
      RAISE EXCEPTION 'Ticket CBG rectifie : la decision revient a un approbateur distinct de l''auteur de la rectification et hors de ses delegations'
        USING ERRCODE = '42501';
    END IF;
    v_rect := public.derniere_rectification_ticket(l.trip_id);
    SELECT * INTO e FROM public.v_tickets_pesee_cbg_effectifs WHERE trip_id = l.trip_id;
    IF v_rect IS NULL OR e.ticket IS DISTINCT FROM l.ticket OR e.brut IS DISTINCT FROM l.ticket_brut
       OR e.tare IS DISTINCT FROM l.ticket_tare THEN
      RAISE EXCEPTION 'Ticket CBG modifie depuis la derniere actualisation : actualiser la reconciliation avant de decider'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.reconciliation_lignes SET decision = p_decision,
    motif_decision = CASE WHEN p_decision IS NULL THEN NULL ELSE btrim(p_motif) END,
    decide_par = auth.uid(), decide_le = now(),
    decision_rectification_id = CASE WHEN p_decision = 'facturable' THEN v_rect END
  WHERE id = p_ligne_id;
END;
$$;

-- cloturer_reconciliation : reprise de 20261121160000 (seule definition la
-- plus recente) ; defense en profondeur D-082 : une ligne facturable a
-- ticket rectifie porte la derniere rectification et n'a pas ete decidee
-- par un auteur de rectification.
CREATE OR REPLACE FUNCTION public.cloturer_reconciliation(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attente integer;
  v_interdites integer;
BEGIN
  PERFORM public.actualiser_reconciliation(p_id);
  SELECT count(*) INTO v_attente FROM public.reconciliation_lignes
  WHERE reconciliation_id = p_id AND public.statut_ligne(decision, anomalies) = 'a_examiner';
  IF v_attente > 0 THEN
    RAISE EXCEPTION '% ligne(s) a examiner : decider avant de cloturer', v_attente USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_interdites FROM public.reconciliation_lignes l
  WHERE l.reconciliation_id = p_id AND public.statut_ligne(l.decision, l.anomalies) = 'facturable'
    AND (public.ligne_non_forcable(l.anomalies)
         OR (coalesce(l.anomalies @> ARRAY['ticket_rectifie'], false)
             AND (l.decision_rectification_id IS DISTINCT FROM public.derniere_rectification_ticket(l.trip_id)
                  OR EXISTS (SELECT 1 FROM public.rectifications_tickets_pesee_cbg r
                               JOIN public.tickets_pesee_cbg t ON t.id = r.ticket_id
                              WHERE t.trip_id = l.trip_id AND r.corrige_par IS NOT DISTINCT FROM l.decide_par))));
  IF v_interdites > 0 THEN
    RAISE EXCEPTION '% ligne(s) facturable(s) avec une anomalie non forcable : rectifier ou exclure avant de cloturer', v_interdites
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.reconciliations r SET statut = 'cloturee', cloturee_par = auth.uid(), cloturee_le = now(),
    tonnage_facturable = (SELECT coalesce(sum(tonnage_base), 0) FROM public.reconciliation_lignes
                          WHERE reconciliation_id = p_id AND public.statut_ligne(decision, anomalies) = 'facturable'),
    voyages_facturables = (SELECT count(*) FROM public.reconciliation_lignes
                           WHERE reconciliation_id = p_id AND public.statut_ligne(decision, anomalies) = 'facturable')
  WHERE r.id = p_id;
END;
$$;

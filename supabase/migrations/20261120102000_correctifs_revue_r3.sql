/*
  # Correctifs de la revue independante a posteriori (D-072), partie 3 :
  # D-054 a D-058 (constats R3) et filtre d'annulation carburant (R1-2)

  Les fonctions remplacees reprennent leur corps exact ; seuls les controles
  indiques s'ajoutent.

  - R3-1 (D-058) : un rapport fige se lit avec le droit de son domaine
    (rapport_fige_lisible) : rapport loueur = rapports et contrats, client =
    rapports et factures ou contrats, shift = rapports et voyages ou
    planification ; journalier et mensuel = rapports (inchange).
  - R3-2 (D-057) : une immobilisation annulee n'est ni en cours ni comptee
    en heures. R1-2 : une distribution n'est retiree des litres que par une
    annulation validee.
  - R3-3 (D-058, correctif minimal) : rapport_shift masque le poste,
    l'equipe et les evenements sans droit de lecture voyages ou
    planification ; figer_rapport (SECURITY DEFINER) ne fige donc plus un
    bilan illisible pour le demandeur.
  - R3-4 (D-055) : taxes d'un bon solde au prorata du montant recu.
    R3-11 : facture notifiee, base moins le plus grand du montant reclame et
    des avoirs et deductions (jamais les deux).
  - R3-5 (D-055) : decider_paiement et enregistrer_execution_paiement
    reverifient sous verrou que la piece est payable et que le reste couvre
    le paiement ; annuler_reception refuse de ramener le recu d'un bon sous
    ce qui est deja engage ou paye.
  - R3-6 (D-057) : un domaine illisible ressort « sans donnees », valeur
    NULL, detail « Non visible avec vos droits de lecture », jamais 0 mesure.
  - R3-7 : site_engin et site_rattache ne rendent un site que dans le
    perimetre ; reste_a_payer exige le droit de lecture des paiements ;
    controle_depart_du_jour n'est plus executable par les comptes.
  - R3-8 (D-054) : declarer_incident controle le perimetre et la coherence
    de chaque rattachement (voyage, engin, chauffeur, site, controle) ;
    enregistrer_controle_depart borne le chauffeur.
  - R3-9 (D-054) : la garde de depart ne retient que le dernier controle du
    jour anterieur au depart.
  - R3-10 (D-054) : analyser_incident exige un motif pour reviser une cause
    et journalise chaque analyse (incidents_journal, append-only).

  R3-12 (separation approbateur, executant, controleur) : conforme a D-055,
  inchange. Idempotent.
*/

-- R3-7 : rattachements a un site bornes au perimetre ----------------------------
CREATE OR REPLACE FUNCTION public.site_engin(p_vehicle uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT v.site_id FROM public.vehicles v WHERE v.id = p_vehicle AND public.site_permis(v.site_id);
$$;
REVOKE EXECUTE ON FUNCTION public.site_engin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_engin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.site_rattache(p_site uuid, p_trip uuid, p_vehicle uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT x.site FROM (
    SELECT coalesce(p_site,
                    (SELECT t.departure_site_id FROM public.trips t WHERE t.id = p_trip),
                    (SELECT v.site_id FROM public.vehicles v WHERE v.id = p_vehicle)) AS site) x
   WHERE public.site_permis(x.site);
$$;
REVOKE EXECUTE ON FUNCTION public.site_rattache(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_rattache(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.controle_depart_du_jour(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.controle_depart_du_jour(uuid, date) TO service_role;

-- R3-1 : rapports figes lus avec le droit de leur domaine -----------------------
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
    ELSE true END);
$$;
REVOKE EXECUTE ON FUNCTION public.rapport_fige_lisible(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rapport_fige_lisible(text) TO authenticated, service_role;

DROP POLICY IF EXISTS lecture ON public.rapports_figes;
CREATE POLICY lecture ON public.rapports_figes FOR SELECT TO authenticated
  USING (public.rapport_fige_lisible(type) AND public.site_permis(site_id));

-- R3-3 : rapport de shift sans droit sur les postes ------------------------------
CREATE OR REPLACE FUNCTION public.rapport_shift(p_poste uuid)
RETURNS TABLE (rang integer, section text, indicateur text, valeur numeric, unite text, manquants integer, source text, remarque text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH dr AS (
    SELECT public.is_admin() OR public.has_module_view('trips') OR public.has_module_view('planning') AS postes
  ),
  p AS (SELECT * FROM public.postes WHERE id = p_poste),
  eq AS (
    SELECT count(*) AS membres,
           count(*) FILTER (WHERE e.present) AS presents,
           count(*) FILTER (WHERE e.present = false) AS absents,
           count(*) FILTER (WHERE e.present IS NULL) AS non_pointes,
           count(*) FILTER (WHERE e.retard_minutes > 0) AS retards,
           sum(e.retard_minutes) AS minutes_retard
      FROM public.postes_equipe e WHERE e.poste_id = p_poste
  ),
  ev AS (
    SELECT count(*) FILTER (WHERE categorie = 'incident') AS incident,
           count(*) FILTER (WHERE categorie = 'arret') AS arret,
           count(*) FILTER (WHERE categorie = 'retard') AS retard,
           count(*) FILTER (WHERE categorie = 'securite') AS securite,
           count(*) FILTER (WHERE categorie = 'information') AS information
      FROM public.postes_evenements WHERE poste_id = p_poste
  )
  SELECT l.rang, l.section, l.indicateur, CASE WHEN dr.postes THEN l.valeur END, l.unite,
         CASE WHEN dr.postes THEN l.manquants END, l.source,
         CASE WHEN NOT dr.postes THEN 'Non visible avec vos droits de lecture'
              ELSE coalesce(l.remarque, CASE WHEN l.valeur IS NULL THEN 'Sans données' END) END
    FROM dr, p, eq, ev, LATERAL (VALUES
      (1, 'Poste', 'Statut du poste', NULL::numeric, NULL::text, NULL::integer, 'postes (D-048)',
          CASE p.statut WHEN 'ouvert' THEN 'Ouvert' WHEN 'cloture' THEN 'Clos, à valider' ELSE 'Validé' END),
      (2, 'Poste', 'Tonnes cible (bilan figé)', (p.bilan ->> 'tonnes_cible')::numeric, 't', NULL, 'bilan de clôture',
          CASE WHEN p.bilan IS NULL THEN 'Bilan figé à la clôture' END),
      (3, 'Poste', 'Tonnes livrées (bilan figé)', (p.bilan ->> 'tonnes_livrees')::numeric, 't', NULL, 'bilan de clôture',
          CASE WHEN p.bilan IS NULL THEN 'Bilan figé à la clôture' END),
      (4, 'Poste', 'Voyages (bilan figé)', (p.bilan ->> 'voyages')::numeric, 'voyages', NULL, 'bilan de clôture',
          CASE WHEN p.bilan IS NULL THEN 'Bilan figé à la clôture' END),
      (5, 'Poste', 'Voyages livrés (bilan figé)', (p.bilan ->> 'voyages_livres')::numeric, 'voyages', NULL, 'bilan de clôture',
          CASE WHEN p.bilan IS NULL THEN 'Bilan figé à la clôture' END),
      (6, 'Équipe', 'Membres de l''équipe', eq.membres::numeric, 'personnes ou engins', NULL, 'postes_equipe', NULL),
      (7, 'Équipe', 'Présents', eq.presents::numeric, 'personnes ou engins', eq.non_pointes::integer, 'postes_equipe',
          CASE WHEN eq.non_pointes > 0 THEN 'Présence non pointée : ' || eq.non_pointes END),
      (8, 'Équipe', 'Absents', eq.absents::numeric, 'personnes ou engins', NULL, 'postes_equipe', NULL),
      (9, 'Équipe', 'Retards', eq.retards::numeric, 'personnes', NULL, 'postes_equipe', NULL),
      (10, 'Équipe', 'Minutes de retard cumulées', eq.minutes_retard::numeric, 'min', NULL, 'postes_equipe', NULL),
      (11, 'Événements', 'Incidents consignés', ev.incident::numeric, 'événements', NULL, 'postes_evenements', NULL),
      (12, 'Événements', 'Arrêts', ev.arret::numeric, 'événements', NULL, 'postes_evenements', NULL),
      (13, 'Événements', 'Retards consignés', ev.retard::numeric, 'événements', NULL, 'postes_evenements', NULL),
      (14, 'Événements', 'Sécurité', ev.securite::numeric, 'événements', NULL, 'postes_evenements', NULL),
      (15, 'Événements', 'Informations', ev.information::numeric, 'événements', NULL, 'postes_evenements', NULL)
    ) AS l(rang, section, indicateur, valeur, unite, manquants, source, remarque)
  UNION ALL
  SELECT i.* FROM p, LATERAL public.indicateurs_exploitation(p.date_poste, p.date_poste, p.site_id, p.shift_id) i
  ORDER BY 1;
$$;

-- R3-4, R3-11 : base payable ; R3-7 : droit de lecture ----------------------------
CREATE OR REPLACE FUNCTION public.reste_a_payer_interne(p_facture uuid, p_bon uuid)
RETURNS TABLE (base numeric, engage numeric, paye numeric, reste numeric, beneficiaire text, devise text, payable boolean, raison text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.factures_fournisseur; b public.purchase_orders; v_commande numeric; v_recu numeric;
BEGIN
  IF p_facture IS NOT NULL THEN
    SELECT * INTO f FROM public.factures_fournisseur WHERE id = p_facture;
    IF NOT FOUND THEN RETURN; END IF;
    -- Facture notifiee : la part reclamee et les avoirs ou deductions
    -- couvrent le meme ecart, retire une seule fois (le plus grand).
    base := coalesce(f.montant_ttc_facture, f.montant_ht_facture)
            - greatest(CASE WHEN f.statut = 'notifiee' THEN coalesce(f.montant_reclame, 0) ELSE 0 END,
                       coalesce((SELECT sum(r.montant) FROM public.regularisations_fournisseur r
                                  WHERE r.facture_id = f.id AND r.mode IN ('avoir', 'deduction')), 0));
    devise := f.devise;
    SELECT c.contrepartie INTO beneficiaire FROM public.contrats c WHERE c.id = f.contrat_id;
    payable := f.statut IN ('conforme', 'notifiee', 'regularisee');
    raison := CASE WHEN payable THEN NULL ELSE 'Facture non controlee ou ecart non notifie' END;
  ELSIF p_bon IS NOT NULL THEN
    SELECT * INTO b FROM public.purchase_orders WHERE id = p_bon;
    IF NOT FOUND THEN RETURN; END IF;
    SELECT coalesce(sum(i.quantity * i.unit_price), 0), coalesce(sum(coalesce(i.quantity_received, 0) * i.unit_price), 0)
      INTO v_commande, v_recu
      FROM public.purchase_order_items i WHERE i.purchase_order_id = b.id;
    -- Taxes au prorata du montant recu (un bon solde ne paie pas les taxes
    -- du reliquat abandonne).
    base := v_recu + CASE WHEN coalesce(b.tax_amount, 0) = 0 THEN 0
                          WHEN v_commande > 0 THEN round(b.tax_amount * v_recu / v_commande, 2)
                          WHEN b.status = 'received' THEN b.tax_amount
                          ELSE 0 END;
    devise := 'GNF';
    SELECT s.company_name INTO beneficiaire FROM public.suppliers s WHERE s.id = b.supplier_id;
    payable := b.status IN ('received', 'closed');
    raison := CASE WHEN payable THEN NULL ELSE 'Bon de commande non recu ou non solde' END;
  ELSE
    RETURN;
  END IF;
  SELECT coalesce(sum(CASE WHEN p.statut IN ('propose', 'approuve') THEN p.montant_propose END), 0),
         coalesce(sum(CASE WHEN p.statut = 'execute' THEN p.montant_execute END), 0)
    INTO engage, paye
    FROM public.paiements_fournisseur p
   WHERE (p_facture IS NOT NULL AND p.facture_fournisseur_id = p_facture) OR (p_bon IS NOT NULL AND p.purchase_order_id = p_bon);
  reste := base - engage - paye;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reste_a_payer_interne(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reste_a_payer(p_facture uuid, p_bon uuid)
RETURNS TABLE (base numeric, engage numeric, paye numeric, reste numeric, beneficiaire text, devise text, payable boolean, raison text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Meme droit que la lecture des paiements : sinon rien n'est revele.
  IF NOT (public.has_module_view('invoices') OR public.has_module_view('contracts') OR public.is_admin()) THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.reste_a_payer_interne(p_facture, p_bon);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reste_a_payer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reste_a_payer(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.proposer_paiement(p_montant numeric, p_objet text, p_facture uuid DEFAULT NULL, p_bon uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r record; v_id uuid;
BEGIN
  IF NOT (public.has_module_write('invoices') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les factures requis' USING ERRCODE = '42501';
  END IF;
  IF (p_facture IS NULL) = (p_bon IS NULL) THEN
    RAISE EXCEPTION 'Une piece : facture du loueur ou bon de commande' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_objet, '')), '') IS NULL THEN RAISE EXCEPTION 'Objet du paiement requis' USING ERRCODE = '22023'; END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN RAISE EXCEPTION 'Montant positif requis' USING ERRCODE = '22023'; END IF;
  -- Verrou de la piece : deux propositions simultanees ne depassent pas le reste.
  IF p_facture IS NOT NULL THEN PERFORM 1 FROM public.factures_fournisseur WHERE id = p_facture FOR UPDATE;
  ELSE PERFORM 1 FROM public.purchase_orders WHERE id = p_bon FOR UPDATE; END IF;
  SELECT * INTO r FROM public.reste_a_payer_interne(p_facture, p_bon);
  IF r.base IS NULL THEN RAISE EXCEPTION 'Piece introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT r.payable THEN RAISE EXCEPTION '%', r.raison USING ERRCODE = '22023'; END IF;
  IF p_montant > r.reste THEN
    RAISE EXCEPTION 'Montant superieur au reste a payer (% %)', r.reste, r.devise USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.paiements_fournisseur (numero, facture_fournisseur_id, purchase_order_id, beneficiaire, devise, objet, montant_propose, propose_par)
  VALUES ('PAY-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.paiements_fournisseur_numero_seq')::text, 5, '0'),
          p_facture, p_bon, coalesce(r.beneficiaire, 'Non renseigne'), r.devise, btrim(p_objet), p_montant, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- R3-5 : piece encore payable et reste suffisant, sous verrou de la piece.
CREATE OR REPLACE FUNCTION public.verifier_piece_payable(p public.paiements_fournisseur)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r record;
BEGIN
  IF p.facture_fournisseur_id IS NOT NULL THEN
    PERFORM 1 FROM public.factures_fournisseur WHERE id = p.facture_fournisseur_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.purchase_orders WHERE id = p.purchase_order_id FOR UPDATE;
  END IF;
  SELECT * INTO r FROM public.reste_a_payer_interne(p.facture_fournisseur_id, p.purchase_order_id);
  IF r.base IS NULL THEN RAISE EXCEPTION 'Piece introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT r.payable THEN RAISE EXCEPTION '% : paiement suspendu', r.raison USING ERRCODE = '22023'; END IF;
  -- Le paiement lui-meme est compte dans l'engage : le reste ne doit pas
  -- devenir negatif.
  IF r.reste < 0 THEN
    RAISE EXCEPTION 'La piece ne couvre plus ce paiement (reste a payer % %)', r.reste, r.devise USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.verifier_piece_payable(public.paiements_fournisseur) FROM PUBLIC, anon, authenticated;

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
  IF v_separee AND p.propose_par = auth.uid() THEN
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

CREATE OR REPLACE FUNCTION public.enregistrer_execution_paiement(
  p_id uuid, p_date date, p_mode text, p_montant numeric, p_reference text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.paiements_fournisseur;
BEGIN
  IF NOT (public.has_module_write('invoices') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les factures requis' USING ERRCODE = '42501';
  END IF;
  p := public.paiement_verrouille(p_id);
  IF p.statut <> 'approuve' THEN RAISE EXCEPTION 'Seul un paiement approuve s''execute' USING ERRCODE = '22023'; END IF;
  IF p_date IS NULL OR p_date > current_date THEN RAISE EXCEPTION 'Date d''execution requise, pas dans le futur' USING ERRCODE = '22023'; END IF;
  IF p_date < p.decide_le::date THEN RAISE EXCEPTION 'Execution anterieure a l''approbation' USING ERRCODE = '22023'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('virement', 'cheque', 'especes', 'compensation', 'autre') THEN
    RAISE EXCEPTION 'Mode de paiement requis' USING ERRCODE = '22023';
  END IF;
  IF p_mode IN ('virement', 'cheque') AND nullif(btrim(coalesce(p_reference, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Reference bancaire requise pour un virement ou un cheque' USING ERRCODE = '22023';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 OR p_montant > p.montant_propose THEN
    RAISE EXCEPTION 'Montant execute positif, au plus egal a l''approuve (%)', p.montant_propose USING ERRCODE = '22023';
  END IF;
  PERFORM public.verifier_piece_payable(p);
  UPDATE public.paiements_fournisseur SET statut = 'execute', execute_le = p_date, mode = p_mode,
    reference_execution = nullif(btrim(coalesce(p_reference, '')), ''), montant_execute = p_montant,
    execute_par = auth.uid(), execute_saisi_le = now()
   WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_reception(p_livraison uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE d public.deliveries; po public.purchase_orders; l public.receptions_achat_lignes; r record;
BEGIN
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO d FROM public.deliveries WHERE id = p_livraison FOR UPDATE;
  IF NOT FOUND OR d.annule_le IS NOT NULL THEN RAISE EXCEPTION 'Reception introuvable ou deja annulee' USING ERRCODE = '22023'; END IF;
  po := public.bon_commande_ecrivable(d.purchase_order_id, 'stock');
  IF po.status NOT IN ('partially_received', 'received') THEN
    RAISE EXCEPTION 'Bon solde ou clos : reception non annulable' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('sigtb.annulation_reception', 'on', true);
  FOR l IN SELECT * FROM public.receptions_achat_lignes WHERE delivery_id = p_livraison LOOP
    IF l.stock_movement_id IS NOT NULL THEN
      PERFORM public.annuler_mouvement_stock(l.stock_movement_id, 'Annulation de la reception ' || d.delivery_number || ' : ' || btrim(p_motif));
    END IF;
    UPDATE public.purchase_order_items SET quantity_received = quantity_received - l.quantite_recue WHERE id = l.po_item_id;
  END LOOP;
  PERFORM set_config('sigtb.annulation_reception', 'off', true);
  UPDATE public.deliveries SET annule_le = now(), annule_par = auth.uid(), motif_annulation = btrim(p_motif) WHERE id = p_livraison;
  UPDATE public.purchase_orders SET
    status = CASE WHEN EXISTS (SELECT 1 FROM public.purchase_order_items x WHERE x.purchase_order_id = po.id AND x.quantity_received > 0)
                  THEN 'partially_received' ELSE 'approved' END,
    updated_at = now()
   WHERE id = po.id;
  -- Un bon deja engage ou paye ne redescend pas sous ce qui est engage ou paye.
  SELECT * INTO r FROM public.reste_a_payer_interne(NULL, po.id);
  IF r.engage + r.paye > r.base THEN
    RAISE EXCEPTION 'Reception non annulable : % GNF deja engages ou payes sur ce bon, au-dela du recu restant (% GNF)',
      r.engage + r.paye, r.base USING ERRCODE = '22023';
  END IF;
  PERFORM public.journaliser_achat(po.id, 'annulation_reception', p_motif, jsonb_build_object('reception', d.delivery_number));
END;
$$;

-- R3-2, R3-6, R1-2 : indicateurs de pilotage -------------------------------------
CREATE OR REPLACE FUNCTION public.indicateurs_pilotage(p_debut date, p_fin date, p_site uuid DEFAULT NULL)
RETURNS TABLE (domaine text, code text, libelle text, valeur numeric, unite text, source text, fiabilite text, detail text,
               periode_debut date, periode_fin date, calcule_le timestamptz)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_livres integer; v_sans_poids integer; v_tonnes numeric; v_acceptees numeric; v_cible numeric;
  v_litres numeric; v_debut timestamptz; v_fin timestamptz; r record;
  -- Visibilite par domaine (memes droits que la RLS des tables lues) : un
  -- domaine illisible ressort « sans donnees », jamais 0 mesure.
  v_adm boolean := public.is_admin();
  v_trips boolean; v_plan boolean; v_veh boolean; v_maint boolean; v_fuel boolean; v_interv boolean;
  v_inc boolean; v_ctrl boolean; v_achats boolean; v_pay boolean;
  c_masque constant text := 'Non visible avec vos droits de lecture';
BEGIN
  IF p_debut IS NULL OR p_fin IS NULL OR p_fin < p_debut THEN
    RAISE EXCEPTION 'Periode invalide' USING ERRCODE = '22023';
  END IF;
  IF p_fin - p_debut > 366 THEN RAISE EXCEPTION 'Periode limitee a un an' USING ERRCODE = '22023'; END IF;
  v_trips := v_adm OR public.has_module_view('trips');
  v_plan := v_adm OR public.has_module_view('planning');
  v_veh := v_adm OR public.has_module_view('vehicles');
  v_maint := v_adm OR public.has_module_view('maintenance');
  v_fuel := v_adm OR public.has_module_view('fuel');
  v_interv := v_adm OR public.has_module_view('maintenance') OR public.has_module_view('contracts');
  v_inc := v_adm OR public.has_module_view('trips') OR public.has_module_view('reports');
  v_ctrl := v_adm OR public.has_module_view('trips') OR public.has_module_view('vehicles');
  v_achats := v_adm OR public.has_module_view('purchases') OR public.has_module_view('stock');
  v_pay := v_adm OR public.has_module_view('invoices') OR public.has_module_view('contracts');
  v_debut := p_debut::timestamptz;
  v_fin := (p_fin + 1)::timestamptz;
  periode_debut := p_debut; periode_fin := p_fin; calcule_le := now();

  -- Production
  SELECT count(*) FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')),
         count(*) FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
                          AND coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) IS NULL),
         sum(coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight))
           FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')),
         sum(t.accepted_tonnage) FILTER (WHERE t.etat IN ('ACCEPTED', 'CLOSED'))
    INTO v_livres, v_sans_poids, v_tonnes, v_acceptees
    FROM public.trips t
   WHERE t.planned_date BETWEEN p_debut AND p_fin AND (p_site IS NULL OR t.departure_site_id = p_site);
  SELECT sum(o.tonnes_cible) INTO v_cible FROM public.objectifs_production o
   WHERE o.statut = 'actif' AND o.shift_id IS NULL AND o.date_plan BETWEEN p_debut AND p_fin AND (p_site IS NULL OR o.site_id = p_site);

  domaine := 'Production'; code := 'voyages_livres'; libelle := 'Voyages livrés'; valeur := v_livres; unite := 'voyages';
  source := 'trips (états livré, accepté, clôturé, en litige ; date prévue ; site de départ)';
  fiabilite := CASE WHEN v_livres = 0 THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL;
  IF NOT v_trips THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'tonnes_livrees'; libelle := 'Tonnes livrées'; valeur := round(v_tonnes, 2); unite := 't';
  source := 'trips : tonnage accepté, sinon reçu, sinon net, sinon chargé';
  fiabilite := CASE WHEN v_livres = 0 THEN 'sans_donnees' WHEN v_sans_poids > 0 THEN 'partielle' ELSE 'mesure' END;
  detail := CASE WHEN v_sans_poids > 0 THEN v_sans_poids || ' voyage(s) livré(s) sans poids, non comptés' END;
  IF NOT v_trips THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'tonnes_acceptees'; libelle := 'Tonnes acceptées par CBG'; valeur := round(v_acceptees, 2); unite := 't';
  source := 'trips.accepted_tonnage (voyages acceptés ou clôturés)';
  fiabilite := CASE WHEN v_acceptees IS NULL THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL;
  IF NOT v_trips THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'objectif'; libelle := 'Objectif de production'; valeur := round(v_cible, 2); unite := 't';
  source := 'objectifs_production actifs de journée (D-023)';
  fiabilite := CASE WHEN v_cible IS NULL THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL;
  IF NOT v_plan THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'realisation'; libelle := 'Réalisation de l''objectif'; unite := '%';
  valeur := CASE WHEN v_cible > 0 AND v_tonnes IS NOT NULL THEN round(100 * v_tonnes / v_cible, 1) END;
  source := 'tonnes livrées / objectif';
  fiabilite := CASE WHEN valeur IS NULL THEN 'sans_donnees' WHEN v_sans_poids > 0 THEN 'partielle' ELSE 'mesure' END;
  detail := NULL;
  IF NOT (v_trips AND v_plan) THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Tickets
  domaine := 'Tickets CBG'; code := 'livres_sans_ticket'; libelle := 'Voyages livrés sans ticket CBG'; unite := 'voyages';
  SELECT count(*) INTO valeur FROM public.v_voyages_livres_sans_ticket v
   WHERE v.planned_date BETWEEN p_debut AND p_fin AND (p_site IS NULL OR v.departure_site_id = p_site);
  source := 'v_voyages_livres_sans_ticket (D-050)'; fiabilite := CASE WHEN v_livres = 0 THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL;
  IF NOT v_trips THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Flotte
  domaine := 'Flotte'; code := 'engins_actifs'; libelle := 'Engins en service'; unite := 'engins'; detail := NULL;
  SELECT count(*) INTO valeur FROM public.vehicles v WHERE v.status = 'active' AND (p_site IS NULL OR v.site_id = p_site);
  source := 'vehicles (statut actif, à l''heure du calcul)'; fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
  IF NOT v_veh THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'immobilisations_ouvertes'; libelle := 'Immobilisations en cours'; unite := 'engins'; detail := NULL;
  SELECT count(*) INTO valeur FROM public.immobilisations i JOIN public.vehicles v ON v.id = i.vehicle_id
   WHERE i.statut = 'ouverte' AND i.fin IS NULL AND (p_site IS NULL OR v.site_id = p_site);
  source := 'immobilisations ouvertes, sans fin (D-022)'; fiabilite := 'mesure';
  IF NOT v_maint THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'heures_immobilisation'; libelle := 'Heures d''immobilisation sur la période'; unite := 'h'; detail := NULL;
  SELECT round(sum(extract(epoch FROM (least(coalesce(i.fin, now()), v_fin) - greatest(i.debut, v_debut))) / 3600)::numeric, 1)
    INTO valeur
    FROM public.immobilisations i JOIN public.vehicles v ON v.id = i.vehicle_id
   WHERE i.statut <> 'annulee' AND i.debut < v_fin AND coalesce(i.fin, now()) > v_debut AND (p_site IS NULL OR v.site_id = p_site);
  source := 'immobilisations non annulées : durée comprise dans la période (en cours : jusqu''à l''heure du calcul)';
  fiabilite := CASE WHEN valeur IS NULL THEN 'sans_donnees' ELSE 'mesure' END;
  IF NOT v_maint THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Carburant
  domaine := 'Carburant'; code := 'litres_distribues'; libelle := 'Litres distribués (validés)'; unite := 'L';
  SELECT -sum(m.variation) INTO v_litres FROM public.mouvements_carburant m JOIN public.stockages_carburant s ON s.id = m.stockage_id
   WHERE m.type = 'distribution' AND m.statut = 'valide' AND m.date_mouvement >= v_debut AND m.date_mouvement < v_fin
     AND NOT EXISTS (SELECT 1 FROM public.mouvements_carburant a WHERE a.annule_mouvement_id = m.id AND a.statut = 'valide')
     AND (p_site IS NULL OR s.site_id = p_site);
  valeur := round(v_litres, 1);
  source := 'mouvements_carburant : distributions validées, sans annulation validée (D-041)';
  fiabilite := CASE WHEN v_litres IS NULL THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL;
  IF NOT v_fuel THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'litres_par_tonne'; libelle := 'Litres par tonne livrée'; unite := 'L/t'; detail := NULL;
  valeur := CASE WHEN v_litres > 0 AND v_tonnes > 0 THEN round(v_litres / v_tonnes, 3) END;
  source := 'litres distribués / tonnes livrées';
  fiabilite := CASE WHEN valeur IS NULL THEN 'sans_donnees' WHEN v_sans_poids > 0 THEN 'partielle' ELSE 'mesure' END;
  IF NOT (v_fuel AND v_trips) THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Maintenance
  domaine := 'Maintenance'; code := 'interventions_en_retard'; libelle := 'Interventions Neemba en retard'; unite := 'interventions';
  SELECT count(*) INTO valeur FROM public.v_interventions_loueur i WHERE i.en_retard AND i.statut <> 'remise_validee';
  source := 'v_interventions_loueur (délai contractuel saisi, D-049) ; tout le périmètre lisible';
  fiabilite := 'mesure'; detail := 'Sans délai contractuel saisi, une intervention n''est jamais comptée en retard';
  IF NOT v_interv THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- HSE
  domaine := 'HSE'; detail := NULL; code := 'incidents'; libelle := 'Incidents déclarés'; unite := 'incidents';
  SELECT count(*) INTO valeur FROM public.incidents i WHERE i.incident_time >= v_debut AND i.incident_time < v_fin;
  source := 'incidents (heure de survenue) ; tout le périmètre lisible'; fiabilite := 'mesure';
  IF NOT v_inc THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'controles_non_conformes'; libelle := 'Contrôles avant départ non conformes'; unite := 'contrôles'; detail := NULL;
  SELECT count(*) INTO valeur FROM public.controles_depart c JOIN public.vehicles v ON v.id = c.vehicle_id
   WHERE c.resultat = 'non_conforme' AND c.effectue_le >= v_debut AND c.effectue_le < v_fin AND (p_site IS NULL OR v.site_id = p_site);
  source := 'controles_depart (D-054)';
  fiabilite := CASE WHEN NOT EXISTS (SELECT 1 FROM public.controles_depart c WHERE c.effectue_le >= v_debut AND c.effectue_le < v_fin)
                    THEN 'sans_donnees' ELSE 'mesure' END;
  IF NOT v_ctrl THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'actions_en_retard'; libelle := 'Actions correctives en retard'; unite := 'actions'; detail := NULL;
  SELECT count(*) INTO valeur FROM public.v_actions_correctives_en_retard;
  source := 'v_actions_correctives_en_retard (à l''heure du calcul)'; fiabilite := 'mesure';
  IF NOT v_inc THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  -- Achats et finance
  domaine := 'Achats et finance'; code := 'bons_a_approuver'; libelle := 'Bons de commande à approuver'; unite := 'bons'; detail := NULL;
  SELECT count(*) INTO valeur FROM public.purchase_orders po WHERE po.status = 'submitted';
  source := 'purchase_orders soumis (D-053)'; fiabilite := 'mesure';
  IF NOT v_achats THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  code := 'paiements_a_controler'; libelle := 'Paiements à contrôler a posteriori'; unite := 'paiements'; detail := NULL;
  SELECT count(*) INTO valeur FROM public.v_paiements_a_controler;
  source := 'v_paiements_a_controler (D-055)'; fiabilite := 'mesure';
  IF NOT v_pay THEN valeur := NULL; fiabilite := 'sans_donnees'; detail := c_masque; END IF; RETURN NEXT;

  detail := NULL;
  FOR r IN SELECT v.devise, sum(v.reste) AS reste FROM public.v_reste_a_payer v GROUP BY v.devise ORDER BY v.devise LOOP
    code := 'reste_a_payer_' || lower(r.devise); libelle := 'Reste à payer aux fournisseurs (' || r.devise || ')';
    valeur := round(r.reste, 2); unite := r.devise;
    source := 'v_reste_a_payer : factures du loueur contrôlées et bons reçus (D-055)'; fiabilite := 'mesure'; RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.indicateurs_pilotage(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicateurs_pilotage(date, date, uuid) TO authenticated;

-- R3-8 : chauffeur du controle borne au perimetre -------------------------------
CREATE OR REPLACE FUNCTION public.enregistrer_controle_depart(
  p_vehicle uuid, p_points jsonb, p_driver uuid DEFAULT NULL, p_trip uuid DEFAULT NULL,
  p_date timestamptz DEFAULT now(), p_km numeric DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.points_controle_depart; e jsonb; v_id uuid; v_res text; v_bloquant boolean := false; v_reserve boolean := false;
BEGIN
  IF NOT (public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur l''exploitation requis' USING ERRCODE = '42501';
  END IF;
  IF p_vehicle IS NULL OR NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicle) THEN
    RAISE EXCEPTION 'Engin requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.vehicule_permis(p_vehicle) THEN RAISE EXCEPTION 'Engin hors de votre perimetre' USING ERRCODE = '42501'; END IF;
  IF p_driver IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = p_driver) THEN
      RAISE EXCEPTION 'Chauffeur introuvable' USING ERRCODE = '22023';
    END IF;
    IF NOT public.site_permis((SELECT d.site_id FROM public.drivers d WHERE d.id = p_driver)) THEN
      RAISE EXCEPTION 'Chauffeur hors de votre perimetre' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure du controle requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_trip IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = p_trip AND t.vehicle_id = p_vehicle) THEN
    RAISE EXCEPTION 'Voyage d''un autre camion' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.points_controle_depart WHERE actif) THEN
    RAISE EXCEPTION 'Aucun point de controle parametre : l''administrateur definit la liste' USING ERRCODE = '22023';
  END IF;
  IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' THEN RAISE EXCEPTION 'Points du controle requis' USING ERRCODE = '22023'; END IF;
  FOR p IN SELECT * FROM public.points_controle_depart WHERE actif LOOP
    SELECT x INTO e FROM jsonb_array_elements(p_points) x WHERE x ->> 'point' = p.id::text LIMIT 1;
    IF e IS NULL OR (e ->> 'resultat') NOT IN ('conforme', 'non_conforme', 'sans_objet') THEN
      RAISE EXCEPTION 'Point « % » non renseigne', p.libelle USING ERRCODE = '22023';
    END IF;
    IF e ->> 'resultat' = 'non_conforme' THEN
      IF nullif(btrim(coalesce(e ->> 'observation', '')), '') IS NULL THEN
        RAISE EXCEPTION 'Point « % » non conforme : observation requise', p.libelle USING ERRCODE = '22023';
      END IF;
      IF p.bloquant THEN v_bloquant := true; ELSE v_reserve := true; END IF;
    END IF;
  END LOOP;
  v_res := CASE WHEN v_bloquant THEN 'non_conforme' WHEN v_reserve THEN 'reserves' ELSE 'conforme' END;
  INSERT INTO public.controles_depart (vehicle_id, driver_id, trip_id, effectue_le, compteur_km, resultat, note, saisi_par)
  VALUES (p_vehicle, p_driver, p_trip, p_date, p_km, v_res, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.controles_depart_points (controle_id, point_id, libelle, bloquant, resultat, observation)
  SELECT v_id, pc.id, pc.libelle, pc.bloquant, j.x ->> 'resultat', nullif(btrim(coalesce(j.x ->> 'observation', '')), '')
    FROM public.points_controle_depart pc
    JOIN LATERAL (SELECT y FROM jsonb_array_elements(p_points) y WHERE y ->> 'point' = pc.id::text LIMIT 1) j(x) ON true
   WHERE pc.actif;
  RETURN v_id;
END;
$$;

-- R3-9 : dernier controle du jour anterieur au depart ----------------------------
CREATE OR REPLACE FUNCTION public.garde_controle_depart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_exige boolean; v_vehicle uuid; v_res text;
BEGIN
  IF auth.uid() IS NULL OR NOT (NEW.etat_avant = 'ASSIGNED' AND NEW.etat_apres = 'AT_LOADING') THEN RETURN NEW; END IF;
  SELECT coalesce((SELECT (s.value ->> 'value') = 'true' FROM public.settings s WHERE s.key = 'controle_depart_exige'), false) INTO v_exige;
  IF NOT v_exige THEN RETURN NEW; END IF;
  SELECT t.vehicle_id INTO v_vehicle FROM public.trips t WHERE t.id = NEW.trip_id;
  -- Un controle saisi apres l'heure du depart ne l'autorise pas.
  SELECT c.resultat INTO v_res FROM public.controles_depart c
   WHERE c.vehicle_id = v_vehicle AND c.effectue_le::date = NEW.survenu_le::date AND c.effectue_le <= NEW.survenu_le
   ORDER BY c.effectue_le DESC, c.saisi_le DESC LIMIT 1;
  IF v_res IS NULL THEN
    RAISE EXCEPTION 'Depart refuse : aucun controle avant depart du camion ce jour' USING ERRCODE = '22023';
  END IF;
  IF v_res = 'non_conforme' THEN
    RAISE EXCEPTION 'Depart refuse : dernier controle avant depart non conforme' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- R3-8 : rattachements d'un incident controles un par un --------------------------
CREATE OR REPLACE FUNCTION public.declarer_incident(
  p_type text, p_gravite public.incident_severity, p_description text, p_survenu_le timestamptz DEFAULT now(),
  p_vehicle uuid DEFAULT NULL, p_driver uuid DEFAULT NULL, p_trip uuid DEFAULT NULL, p_site uuid DEFAULT NULL,
  p_lieu text DEFAULT NULL, p_cout_estime numeric DEFAULT NULL, p_controle uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; t public.trips; v public.vehicles; d public.drivers; c public.controles_depart;
BEGIN
  IF NOT (public.has_module_write('trips') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur l''exploitation requis' USING ERRCODE = '42501';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('accident', 'presque_accident', 'blessure', 'environnement', 'materiel', 'securite', 'autre') THEN
    RAISE EXCEPTION 'Type d''incident requis' USING ERRCODE = '22023';
  END IF;
  IF p_gravite IS NULL THEN RAISE EXCEPTION 'Gravite requise' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_description, '')), '') IS NULL THEN RAISE EXCEPTION 'Description requise' USING ERRCODE = '22023'; END IF;
  IF p_survenu_le IS NULL OR p_survenu_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure de l''incident requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_trip IS NULL AND p_vehicle IS NULL AND p_site IS NULL THEN
    RAISE EXCEPTION 'Rattacher l''incident a un voyage, un engin ou un site' USING ERRCODE = '22023';
  END IF;
  IF NOT public.incident_permis(p_trip, p_vehicle, p_site) THEN
    RAISE EXCEPTION 'Hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  -- Chaque rattachement fourni est dans le perimetre, puis coherent avec les autres.
  IF p_trip IS NOT NULL THEN
    SELECT * INTO t FROM public.trips WHERE id = p_trip;
    IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = '22023'; END IF;
    IF NOT public.voyage_permis(p_trip) THEN RAISE EXCEPTION 'Voyage hors de votre perimetre' USING ERRCODE = '42501'; END IF;
  END IF;
  IF p_vehicle IS NOT NULL THEN
    SELECT * INTO v FROM public.vehicles WHERE id = p_vehicle;
    IF NOT FOUND THEN RAISE EXCEPTION 'Engin introuvable' USING ERRCODE = '22023'; END IF;
    IF NOT public.vehicule_permis(p_vehicle) THEN RAISE EXCEPTION 'Engin hors de votre perimetre' USING ERRCODE = '42501'; END IF;
  END IF;
  IF p_site IS NOT NULL AND NOT public.site_permis(p_site) THEN
    RAISE EXCEPTION 'Site hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  IF p_driver IS NOT NULL THEN
    SELECT * INTO d FROM public.drivers WHERE id = p_driver;
    IF NOT FOUND THEN RAISE EXCEPTION 'Chauffeur introuvable' USING ERRCODE = '22023'; END IF;
    IF NOT public.site_permis(d.site_id) THEN RAISE EXCEPTION 'Chauffeur hors de votre perimetre' USING ERRCODE = '42501'; END IF;
  END IF;
  IF p_controle IS NOT NULL THEN
    SELECT * INTO c FROM public.controles_depart WHERE id = p_controle;
    IF NOT FOUND THEN RAISE EXCEPTION 'Controle avant depart introuvable' USING ERRCODE = '22023'; END IF;
    IF NOT public.vehicule_permis(c.vehicle_id) THEN RAISE EXCEPTION 'Controle hors de votre perimetre' USING ERRCODE = '42501'; END IF;
    IF p_vehicle IS NOT NULL AND c.vehicle_id <> p_vehicle THEN
      RAISE EXCEPTION 'Le controle porte sur un autre engin' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_trip IS NOT NULL THEN
    IF p_vehicle IS NOT NULL AND t.vehicle_id IS NOT NULL AND t.vehicle_id <> p_vehicle THEN
      RAISE EXCEPTION 'L''engin differe de celui du voyage' USING ERRCODE = '22023';
    END IF;
    IF p_driver IS NOT NULL AND t.driver_id IS NOT NULL AND t.driver_id <> p_driver THEN
      RAISE EXCEPTION 'Le chauffeur differe de celui du voyage' USING ERRCODE = '22023';
    END IF;
    IF p_site IS NOT NULL AND p_site IS DISTINCT FROM t.departure_site_id AND p_site IS DISTINCT FROM t.arrival_site_id THEN
      RAISE EXCEPTION 'Le site n''est ni le depart ni l''arrivee du voyage' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_vehicle IS NOT NULL AND p_site IS NOT NULL AND p_trip IS NULL AND v.site_id IS NOT NULL AND v.site_id <> p_site THEN
    RAISE EXCEPTION 'L''engin est rattache a un autre site' USING ERRCODE = '22023';
  END IF;
  IF p_cout_estime IS NOT NULL AND p_cout_estime < 0 THEN RAISE EXCEPTION 'Cout estime positif ou absent' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.incidents (numero, type, severity, description, incident_time, vehicle_id, driver_id, trip_id, site_id,
                                lieu, estimated_cost, controle_id, statut, declare_par)
  VALUES ('INC-' || to_char(p_survenu_le, 'YYYY') || '-' || lpad(nextval('public.incidents_numero_seq')::text, 5, '0'),
          p_type, p_gravite, btrim(p_description), p_survenu_le, p_vehicle, p_driver, p_trip, p_site,
          nullif(btrim(coalesce(p_lieu, '')), ''), p_cout_estime, p_controle, 'ouvert', auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- R3-10 : journal des analyses, motif pour reviser une cause ---------------------
CREATE TABLE IF NOT EXISTS public.incidents_journal (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES public.incidents(id),
  action text NOT NULL CHECK (action IN ('analyse', 'revision_cause')),
  cause_avant text,
  cause_apres text NOT NULL,
  motif text,
  auteur uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (action <> 'revision_cause' OR nullif(btrim(coalesce(motif, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_incidents_journal ON public.incidents_journal(incident_id, cree_le);
ALTER TABLE public.incidents_journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.incidents_journal FROM anon, authenticated;
GRANT SELECT ON public.incidents_journal TO authenticated;
GRANT ALL ON public.incidents_journal TO service_role;
DROP POLICY IF EXISTS lecture ON public.incidents_journal;
CREATE POLICY lecture ON public.incidents_journal FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id));
DROP TRIGGER IF EXISTS garde_append_only ON public.incidents_journal;
CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.incidents_journal
  FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_hse();

DROP FUNCTION IF EXISTS public.analyser_incident(uuid, text);
CREATE OR REPLACE FUNCTION public.analyser_incident(p_id uuid, p_cause text, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.incidents; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  i := public.incident_ecrivable(p_id);
  IF nullif(btrim(coalesce(p_cause, '')), '') IS NULL THEN RAISE EXCEPTION 'Cause requise' USING ERRCODE = '22023'; END IF;
  IF i.cause IS NOT NULL AND btrim(p_cause) IS DISTINCT FROM i.cause AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Revision de la cause : motif requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.incidents SET cause = btrim(p_cause), statut = 'en_analyse', analyse_par = auth.uid(), analyse_le = now() WHERE id = p_id;
  INSERT INTO public.incidents_journal (incident_id, action, cause_avant, cause_apres, motif, auteur)
  VALUES (p_id, CASE WHEN i.cause IS NULL THEN 'analyse' ELSE 'revision_cause' END, i.cause, btrim(p_cause),
          CASE WHEN i.cause IS NULL THEN v_motif ELSE coalesce(v_motif, 'Cause confirmee') END, auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.analyser_incident(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analyser_incident(uuid, text, text) TO authenticated;

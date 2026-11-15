/*
  # Paiements fournisseurs et controle a posteriori (D-055, lot 16,
  # module 20)

  SIGTB n'execute aucun paiement : il enregistre la chaine de decision et
  les paiements executes hors du systeme (banque, caisse), avec pieces.

  1. `paiements_fournisseur` : bon a payer numerote (PAY-AAAA-NNNNN) sur
     une facture du loueur controlee (D-032 : conforme, notifiee pour la
     part non contestee, regularisee) ou sur un bon de commande recu ou
     solde (D-053). Le montant propose ne depasse jamais le reste a payer
     calcule par le serveur.
  2. Circuit : `proposer_paiement` (droit d'ecriture factures),
     `decider_paiement` (droit d'approbation factures, autre personne que
     le proposant ; reglage `paiements_validation_separee`, exigee si
     absent ; rejet motive), `enregistrer_execution_paiement` (date, mode,
     reference bancaire obligatoire pour virement et cheque, montant au
     plus egal a l'approuve), `annuler_paiement` (motif, avant execution),
     `controler_paiement` (controle a posteriori par une autre personne que
     le proposant et l'executant : conforme ou anomalie motivee).
  3. `v_reste_a_payer` (base, engage, paye, reste) et
     `v_paiements_a_controler`.

  Lecture : modules factures ou contrats. Ecriture : fonctions serveur
  seulement. Idempotent.
*/

CREATE SEQUENCE IF NOT EXISTS public.paiements_fournisseur_numero_seq;

CREATE TABLE IF NOT EXISTS public.paiements_fournisseur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  facture_fournisseur_id uuid REFERENCES public.factures_fournisseur(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  beneficiaire text NOT NULL,
  devise text NOT NULL,
  objet text NOT NULL,
  montant_propose numeric NOT NULL CHECK (montant_propose > 0),
  statut text NOT NULL DEFAULT 'propose' CHECK (statut IN ('propose', 'approuve', 'rejete', 'execute', 'annule')),
  propose_par uuid REFERENCES auth.users(id),
  propose_le timestamptz NOT NULL DEFAULT now(),
  decide_par uuid REFERENCES auth.users(id),
  decide_le timestamptz,
  motif_decision text,
  execute_le date,
  mode text CHECK (mode IS NULL OR mode IN ('virement', 'cheque', 'especes', 'compensation', 'autre')),
  reference_execution text,
  montant_execute numeric CHECK (montant_execute IS NULL OR montant_execute > 0),
  execute_par uuid REFERENCES auth.users(id),
  execute_saisi_le timestamptz,
  annule_par uuid REFERENCES auth.users(id),
  motif_annulation text,
  controle_resultat text CHECK (controle_resultat IS NULL OR controle_resultat IN ('conforme', 'anomalie')),
  controle_motif text,
  controle_par uuid REFERENCES auth.users(id),
  controle_le timestamptz,
  CHECK ((facture_fournisseur_id IS NULL) <> (purchase_order_id IS NULL)),
  CHECK (controle_resultat IS DISTINCT FROM 'anomalie' OR nullif(btrim(coalesce(controle_motif, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_paiements_fournisseur_facture ON public.paiements_fournisseur(facture_fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_paiements_fournisseur_bon ON public.paiements_fournisseur(purchase_order_id);

ALTER TABLE public.paiements_fournisseur ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paiements_fournisseur FROM anon, authenticated;
GRANT SELECT ON public.paiements_fournisseur TO authenticated;
GRANT ALL ON public.paiements_fournisseur TO service_role;
DROP POLICY IF EXISTS lecture ON public.paiements_fournisseur;
CREATE POLICY lecture ON public.paiements_fournisseur FOR SELECT TO authenticated
  USING (public.has_module_view('invoices') OR public.has_module_view('contracts') OR public.is_admin());

-- Base payable, engage et paye d'une piece (facture du loueur ou bon).
CREATE OR REPLACE FUNCTION public.reste_a_payer(p_facture uuid, p_bon uuid)
RETURNS TABLE (base numeric, engage numeric, paye numeric, reste numeric, beneficiaire text, devise text, payable boolean, raison text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.factures_fournisseur; b public.purchase_orders;
BEGIN
  IF p_facture IS NOT NULL THEN
    SELECT * INTO f FROM public.factures_fournisseur WHERE id = p_facture;
    IF NOT FOUND THEN RETURN; END IF;
    base := coalesce(f.montant_ttc_facture, f.montant_ht_facture)
            - coalesce((SELECT sum(r.montant) FROM public.regularisations_fournisseur r
                         WHERE r.facture_id = f.id AND r.mode IN ('avoir', 'deduction')), 0)
            - CASE WHEN f.statut = 'notifiee' THEN coalesce(f.montant_reclame, 0) ELSE 0 END;
    devise := f.devise;
    SELECT c.contrepartie INTO beneficiaire FROM public.contrats c WHERE c.id = f.contrat_id;
    payable := f.statut IN ('conforme', 'notifiee', 'regularisee');
    raison := CASE WHEN payable THEN NULL ELSE 'Facture non controlee ou ecart non notifie' END;
  ELSIF p_bon IS NOT NULL THEN
    SELECT * INTO b FROM public.purchase_orders WHERE id = p_bon;
    IF NOT FOUND THEN RETURN; END IF;
    base := coalesce((SELECT sum(i.quantity_received * i.unit_price) FROM public.purchase_order_items i WHERE i.purchase_order_id = b.id), 0)
            + coalesce(b.tax_amount, 0);
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
  SELECT * INTO r FROM public.reste_a_payer(p_facture, p_bon);
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

CREATE OR REPLACE FUNCTION public.paiement_verrouille(p_id uuid)
RETURNS public.paiements_fournisseur
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.paiements_fournisseur;
BEGIN
  SELECT * INTO p FROM public.paiements_fournisseur WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable' USING ERRCODE = '22023'; END IF;
  RETURN p;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.paiement_verrouille(uuid) FROM PUBLIC, anon, authenticated;

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
  UPDATE public.paiements_fournisseur SET statut = 'execute', execute_le = p_date, mode = p_mode,
    reference_execution = nullif(btrim(coalesce(p_reference, '')), ''), montant_execute = p_montant,
    execute_par = auth.uid(), execute_saisi_le = now()
   WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_paiement(p_id uuid, p_motif text)
RETURNS void
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
  IF p.statut NOT IN ('propose', 'approuve') THEN RAISE EXCEPTION 'Paiement execute, rejete ou annule : non annulable' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  UPDATE public.paiements_fournisseur SET statut = 'annule', annule_par = auth.uid(), motif_annulation = btrim(p_motif) WHERE id = p_id;
END;
$$;

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
  IF auth.uid() IN (p.propose_par, p.execute_par) THEN
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

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'proposer_paiement(numeric, text, uuid, uuid)',
    'decider_paiement(uuid, boolean, text)',
    'enregistrer_execution_paiement(uuid, date, text, numeric, text)',
    'annuler_paiement(uuid, text)',
    'controler_paiement(uuid, boolean, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Pieces payables et reste a payer (lecture selon les droits du lecteur).
CREATE OR REPLACE VIEW public.v_reste_a_payer WITH (security_invoker = true) AS
SELECT 'facture_loueur'::text AS source, f.id AS piece_id, f.numero_fournisseur AS piece, f.date_facture AS date_piece, r.*
  FROM public.factures_fournisseur f CROSS JOIN LATERAL public.reste_a_payer(f.id, NULL) r
 WHERE f.statut IN ('conforme', 'notifiee', 'regularisee')
UNION ALL
SELECT 'bon_commande', b.id, b.po_number, b.po_date, r.*
  FROM public.purchase_orders b CROSS JOIN LATERAL public.reste_a_payer(NULL, b.id) r
 WHERE b.status IN ('received', 'closed');
GRANT SELECT ON public.v_reste_a_payer TO authenticated;

CREATE OR REPLACE VIEW public.v_paiements_a_controler WITH (security_invoker = true) AS
SELECT p.id, p.numero, p.beneficiaire, p.devise, p.montant_execute, p.execute_le, p.mode, p.reference_execution
  FROM public.paiements_fournisseur p
 WHERE p.statut = 'execute' AND p.controle_resultat IS NULL;
GRANT SELECT ON public.v_paiements_a_controler TO authenticated;

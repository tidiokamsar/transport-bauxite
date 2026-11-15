/*
  # Mes validations et centre de notifications (D-056, lot 17, modules 24
  # et 25)

  1. `mes_validations()` : boite de travail calculee a chaque lecture
     depuis les donnees reelles, rien n'est stocke ni invente. Pour
     l'utilisateur connecte, les elements en attente de sa decision, selon
     ses droits et la separation des taches : bons de commande soumis,
     bons approuves a receptionner, paiements proposes, approuves a
     executer, executes a controler, mouvements et inventaires de
     carburant a valider, clotures de poste a valider, remises en service
     Neemba a valider, ecarts de releve CBG a decider, factures a signer,
     actions correctives en retard. SECURITY INVOKER : la RLS de chaque
     table s'applique (perimetre site compris). Les fonctions serveur
     restent seules juges : la boite oriente, elle n'autorise rien.
  2. `notifications` (table heritee, sans politique) : chacun lit et marque
     comme lues ses seules notifications ; aucune ecriture depuis le
     navigateur. Ecrites par le serveur sur les decisions qui concernent
     une personne : bon de commande approuve ou rejete (demandeur),
     paiement approuve ou rejete (proposant), anomalie au controle d'un
     paiement (proposant et executant), cloture de poste validee (auteur
     de la cloture). `marquer_notifications_lues`.
  3. `smart_notifications` (maquette Bolt, sans politique) n'est plus lue.

  Idempotent.
*/

-- 1. Boite de travail
CREATE OR REPLACE FUNCTION public.mes_validations()
RETURNS TABLE (categorie text, objet text, reference text, detail text, depuis timestamptz, ecran text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH moi AS (
    SELECT auth.uid() AS id,
           (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active') AS role,
           public.is_admin() AS admin
  )
  SELECT 'Achats', 'Bon de commande à approuver', po.po_number::text, coalesce(po.total_amount::text || ' GNF', ''), coalesce(po.soumis_le, po.created_at), 'purchases'
    FROM public.purchase_orders po, moi
   WHERE po.status = 'submitted' AND (public.has_module_approve('purchases') OR moi.admin)
     AND moi.id IS DISTINCT FROM po.requested_by AND moi.id IS DISTINCT FROM po.soumis_par
  UNION ALL
  SELECT 'Achats', 'Bon de commande à réceptionner', po.po_number::text, CASE WHEN po.status = 'partially_received' THEN 'Reçu en partie' ELSE 'Approuvé' END,
         coalesce(po.approved_at, po.updated_at), 'purchases'
    FROM public.purchase_orders po, moi
   WHERE po.status IN ('approved', 'partially_received') AND (public.has_module_write('stock') OR moi.admin)
  UNION ALL
  SELECT 'Paiements', 'Paiement à approuver', p.numero::text, p.beneficiaire || ' · ' || p.montant_propose::text || ' ' || p.devise, p.propose_le, 'paiements'
    FROM public.paiements_fournisseur p, moi
   WHERE p.statut = 'propose' AND (public.has_module_approve('invoices') OR moi.admin) AND moi.id IS DISTINCT FROM p.propose_par
  UNION ALL
  SELECT 'Paiements', 'Paiement approuvé : exécution à saisir', p.numero::text, p.beneficiaire || ' · ' || p.montant_propose::text || ' ' || p.devise, p.decide_le, 'paiements'
    FROM public.paiements_fournisseur p, moi
   WHERE p.statut = 'approuve' AND (public.has_module_write('invoices') OR moi.admin)
  UNION ALL
  SELECT 'Paiements', 'Paiement à contrôler a posteriori', p.numero::text, p.beneficiaire || ' · ' || p.montant_execute::text || ' ' || p.devise,
         p.execute_saisi_le, 'paiements'
    FROM public.paiements_fournisseur p, moi
   WHERE p.statut = 'execute' AND p.controle_resultat IS NULL AND (public.has_module_approve('invoices') OR moi.admin)
     AND moi.id IS DISTINCT FROM p.propose_par AND moi.id IS DISTINCT FROM p.execute_par
  UNION ALL
  SELECT 'Carburant', 'Mouvement de carburant à valider', m.numero::text, m.type::text || ' · ' || m.variation::text || ' L', m.saisi_le, 'fuel-stocks'
    FROM public.mouvements_carburant m, moi
   WHERE m.statut = 'a_valider' AND (public.has_module_write('fuel') OR moi.admin) AND moi.id IS DISTINCT FROM m.saisi_par
  UNION ALL
  SELECT 'Carburant', 'Inventaire de cuve à valider', NULL::text, i.volume_mesure::text || ' L mesurés', i.cree_le, 'fuel-stocks'
    FROM public.inventaires_carburant i, moi
   WHERE i.statut = 'a_valider' AND (public.has_module_write('fuel') OR moi.admin) AND moi.id IS DISTINCT FROM i.cree_par
  UNION ALL
  SELECT 'Exploitation', 'Clôture de poste à valider', to_char(p.date_poste, 'DD/MM/YYYY'), NULL::text, p.cloture_le, 'postes'
    FROM public.postes p, moi
   WHERE p.statut = 'cloture' AND (public.has_module_write('planning') OR moi.admin) AND moi.id IS DISTINCT FROM p.cloture_par
  UNION ALL
  SELECT 'Maintenance', 'Remise en service à valider', i.numero::text, i.description::text, i.fin_le, 'interventions-loueur'
    FROM public.interventions_loueur i, moi
   WHERE i.statut = 'terminee' AND (public.has_module_write('maintenance') OR moi.admin) AND moi.id IS DISTINCT FROM i.fin_saisie_par
  UNION ALL
  SELECT 'Tickets CBG', 'Écart de relevé à décider', r.reference::text, e.nature || coalesce(' · ' || e.detail, ''), r.importe_le, 'tickets-cbg'
    FROM public.ecarts_releve_cbg e JOIN public.releves_cbg r ON r.id = e.releve_id, moi
   WHERE e.decision IS NULL AND e.nature <> 'concordant' AND (public.has_module_write('trips') OR moi.admin)
  UNION ALL
  SELECT 'Facturation', 'Facture à signer', f.numero::text, f.montant_ttc::text || ' ' || f.devise, f.soumise_le, 'invoices'
    FROM public.factures f, moi
   WHERE f.statut = 'a_signer' AND moi.role = 'director'
  UNION ALL
  SELECT 'HSE', 'Action corrective en retard', i.numero::text, a.libelle || ' · ' || a.responsable, a.echeance::timestamptz, 'incidents'
    FROM public.actions_correctives a JOIN public.incidents i ON i.id = a.incident_id, moi
   WHERE a.statut = 'ouverte' AND a.echeance < current_date AND (public.has_module_write('trips') OR moi.admin);
$$;
REVOKE EXECUTE ON FUNCTION public.mes_validations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_validations() TO authenticated;

-- 2. Notifications personnelles
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' LOOP
    EXECUTE format('DROP POLICY %I ON public.notifications', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
CREATE INDEX IF NOT EXISTS idx_notifications_utilisateur ON public.notifications(user_id, created_at DESC);
CREATE POLICY lecture_personnelle ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.marquer_notifications_lues(p_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.notifications SET read = true, read_at = now()
   WHERE user_id = auth.uid() AND NOT coalesce(read, false) AND (p_ids IS NULL OR id = ANY (p_ids));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.marquer_notifications_lues(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marquer_notifications_lues(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.notifier(p_utilisateur uuid, p_type text, p_titre text, p_message text, p_ref_type text, p_ref uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.notifications (user_id, notification_type, title, message, reference_type, reference_id)
  SELECT p_utilisateur, p_type, p_titre, coalesce(p_message, ''), p_ref_type, p_ref
   WHERE p_utilisateur IS NOT NULL AND p_utilisateur IS DISTINCT FROM auth.uid()
     AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_utilisateur);
$$;
REVOKE EXECUTE ON FUNCTION public.notifier(uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notifier_decision_achat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM public.notifier(NEW.requested_by, 'achat',
      'Bon de commande ' || NEW.po_number || CASE WHEN NEW.status = 'approved' THEN ' approuvé' ELSE ' rejeté' END,
      coalesce(NEW.motif_decision, CASE WHEN NEW.status = 'approved' THEN 'Le bon peut être réceptionné.' ELSE '' END),
      'purchase_order', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notifier_decision_achat ON public.purchase_orders;
CREATE TRIGGER notifier_decision_achat AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.notifier_decision_achat();

CREATE OR REPLACE FUNCTION public.notifier_decision_paiement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.statut IS DISTINCT FROM OLD.statut AND NEW.statut IN ('approuve', 'rejete') THEN
    PERFORM public.notifier(NEW.propose_par, 'paiement',
      'Paiement ' || NEW.numero || CASE WHEN NEW.statut = 'approuve' THEN ' approuvé' ELSE ' rejeté' END,
      coalesce(NEW.motif_decision, NEW.beneficiaire || ' · ' || NEW.montant_propose::text || ' ' || NEW.devise),
      'paiement_fournisseur', NEW.id);
  END IF;
  IF NEW.controle_resultat = 'anomalie' AND OLD.controle_resultat IS NULL THEN
    PERFORM public.notifier(NEW.propose_par, 'paiement', 'Anomalie au contrôle du paiement ' || NEW.numero, NEW.controle_motif, 'paiement_fournisseur', NEW.id);
    IF NEW.execute_par IS DISTINCT FROM NEW.propose_par THEN
      PERFORM public.notifier(NEW.execute_par, 'paiement', 'Anomalie au contrôle du paiement ' || NEW.numero, NEW.controle_motif, 'paiement_fournisseur', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notifier_decision_paiement ON public.paiements_fournisseur;
CREATE TRIGGER notifier_decision_paiement AFTER UPDATE ON public.paiements_fournisseur
  FOR EACH ROW EXECUTE FUNCTION public.notifier_decision_paiement();

CREATE OR REPLACE FUNCTION public.notifier_validation_poste()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.statut = 'valide' AND OLD.statut IS DISTINCT FROM 'valide' THEN
    PERFORM public.notifier(NEW.cloture_par, 'poste', 'Clôture du poste du ' || to_char(NEW.date_poste, 'DD/MM/YYYY') || ' validée', NULL, 'poste', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notifier_validation_poste ON public.postes;
CREATE TRIGGER notifier_validation_poste AFTER UPDATE ON public.postes
  FOR EACH ROW EXECUTE FUNCTION public.notifier_validation_poste();

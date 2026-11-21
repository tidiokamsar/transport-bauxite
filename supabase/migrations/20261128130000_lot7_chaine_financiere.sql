/*
  # Lot 7 (D-125) : chaine contractuelle et financiere

  Relie contrat, version applicable, operation, decompte (reconciliation),
  lignes, regles contractuelles calculees, pieces, facture, avoir, creance,
  encaissement et relance.

  Regles :
  - aucune conversion de devise et aucune addition entre devises ;
  - un avoir vient en deduction de la creance, jamais en ecrasement de la
    facture d'origine ;
  - la version contractuelle applicable est celle dont la date d'effet est la
    plus recente a la date d'emission (a defaut, a la date du jour) ;
  - le solde n'est calcule que si le montant TTC existe.

  Securite : SECURITY INVOKER, droits factures ou contrats exiges.
*/
CREATE OR REPLACE FUNCTION public.dossier_financier(p_facture uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_f record;
  v_encaisse numeric;
  v_avoirs numeric;
  v_solde numeric;
  v_version record;
BEGIN
  IF p_facture IS NULL
     OR NOT (public.has_module_view('invoices') OR public.has_module_view('contracts') OR public.is_admin()) THEN
    RETURN NULL;
  END IF;

  SELECT f.id, f.numero, f.type, f.contrat_id, f.reconciliation_id, f.facture_origine_id,
         f.objet, f.periode_debut, f.periode_fin, f.devise, f.taux_taxe_pct,
         f.delai_paiement_jours, f.montant_ht, f.montant_taxe, f.montant_ttc,
         f.statut, f.date_emission, f.date_echeance, f.prepare_le, f.soumise_le,
         f.signee_le, f.emise_le, f.motif,
         c.reference AS contrat_reference, c.intitule AS contrat_intitule,
         c.nature AS contrat_nature, c.contrepartie
    INTO v_f
    FROM public.factures f
    LEFT JOIN public.contrats c ON c.id = f.contrat_id
   WHERE f.id = p_facture;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT cv.numero, cv.intitule, cv.date_effet, cv.date_signature, cv.resume, cv.document_ref
    INTO v_version
    FROM public.contrat_versions cv
   WHERE cv.contrat_id = v_f.contrat_id
     AND cv.date_effet <= coalesce(v_f.date_emission, current_date)
   ORDER BY cv.date_effet DESC, cv.numero DESC
   LIMIT 1;

  SELECT coalesce(sum(e.montant), 0) INTO v_encaisse
    FROM public.encaissements e WHERE e.facture_id = p_facture;

  SELECT coalesce(sum(a.montant_ttc), 0) INTO v_avoirs
    FROM public.factures a
   WHERE a.facture_origine_id = p_facture AND a.statut <> 'annulee';

  IF v_f.montant_ttc IS NOT NULL THEN
    v_solde := round(v_f.montant_ttc - v_encaisse - v_avoirs, 2);
  END IF;

  RETURN jsonb_build_object(
    'lisible', true,
    'facture', jsonb_build_object(
      'id', v_f.id, 'numero', v_f.numero, 'type', v_f.type, 'objet', v_f.objet,
      'periode_debut', v_f.periode_debut, 'periode_fin', v_f.periode_fin,
      'devise', v_f.devise, 'taux_taxe_pct', v_f.taux_taxe_pct,
      'delai_paiement_jours', v_f.delai_paiement_jours,
      'montant_ht', v_f.montant_ht, 'montant_taxe', v_f.montant_taxe, 'montant_ttc', v_f.montant_ttc,
      'statut', v_f.statut, 'date_emission', v_f.date_emission, 'date_echeance', v_f.date_echeance,
      'prepare_le', v_f.prepare_le, 'soumise_le', v_f.soumise_le,
      'signee_le', v_f.signee_le, 'emise_le', v_f.emise_le, 'motif', v_f.motif,
      'facture_origine_id', v_f.facture_origine_id
    ),
    'contrat', CASE WHEN v_f.contrat_id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_f.contrat_id, 'reference', v_f.contrat_reference, 'intitule', v_f.contrat_intitule,
      'nature', v_f.contrat_nature, 'contrepartie', v_f.contrepartie,
      'version_applicable', CASE WHEN v_version.numero IS NULL THEN NULL ELSE jsonb_build_object(
        'numero', v_version.numero, 'intitule', v_version.intitule, 'date_effet', v_version.date_effet,
        'date_signature', v_version.date_signature, 'resume', v_version.resume,
        'document_ref', v_version.document_ref
      ) END
    ) END,
    'decompte', CASE WHEN v_f.reconciliation_id IS NULL THEN NULL ELSE (
      SELECT jsonb_build_object(
        'id', r.id, 'statut', r.statut, 'periode_debut', r.periode_debut, 'periode_fin', r.periode_fin,
        'base_tonnage', r.base_tonnage, 'tonnage_facturable', r.tonnage_facturable,
        'voyages_facturables', r.voyages_facturables,
        'tolerance_ecart_pct', r.tolerance_ecart_pct,
        'site_depart_id', r.site_depart_id, 'site_arrivee_id', r.site_arrivee_id,
        'cloturee_le', r.cloturee_le
      )
      FROM public.reconciliations r WHERE r.id = v_f.reconciliation_id
    ) END,
    'lignes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'ordre', l.ordre, 'libelle', l.libelle, 'quantite', l.quantite,
        'unite', l.unite, 'prix_unitaire', l.prix_unitaire, 'montant', l.montant,
        'clause', CASE WHEN cl.id IS NULL THEN NULL ELSE jsonb_build_object(
          'type_clause', cl.type_clause, 'libelle', cl.libelle, 'base', cl.base,
          'valeur', cl.valeur, 'plafond_ht', cl.plafond_ht, 'article', cl.article
        ) END
      ) ORDER BY l.ordre)
      FROM public.facture_lignes l
      LEFT JOIN public.contrat_clauses cl ON cl.id = l.calcul_clause_id
     WHERE l.facture_id = p_facture
    ), '[]'::jsonb),
    'regles_calculees', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', cc.id, 'type_clause', cc.type_clause, 'libelle', cc.libelle, 'base', cc.base,
        'valeur', cc.valeur, 'realise', cc.realise, 'echantillon', cc.echantillon,
        'conforme', cc.conforme, 'declenchee', cc.declenchee,
        'assiette_ht', cc.assiette_ht, 'montant_calcule_ht', cc.montant_calcule_ht,
        'montant_propose_ht', cc.montant_propose_ht, 'devise', cc.devise,
        'raison', cc.raison, 'statut', cc.statut, 'calcule_le', cc.calcule_le
      ) ORDER BY cc.calcule_le)
      FROM public.calculs_clauses cc WHERE cc.facture_id = p_facture
    ), '[]'::jsonb),
    'pieces', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'nom', p.nom, 'type_mime', p.type_mime, 'module', p.module,
        'statut', p.statut, 'depose_le', p.depose_le, 'sha256', p.sha256
      ) ORDER BY p.depose_le)
      FROM public.pieces_jointes p
     WHERE p.objet_id = p_facture AND p.objet_type IN ('facture', 'invoice') AND p.annule_le IS NULL
    ), '[]'::jsonb),
    'encaissements', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'date_encaissement', e.date_encaissement, 'montant', e.montant,
        'mode', e.mode, 'reference', e.reference, 'note', e.note, 'saisi_le', e.saisi_le
      ) ORDER BY e.date_encaissement)
      FROM public.encaissements e WHERE e.facture_id = p_facture
    ), '[]'::jsonb),
    'avoirs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'numero', a.numero, 'montant_ttc', a.montant_ttc,
        'statut', a.statut, 'date_emission', a.date_emission, 'motif', a.motif
      ) ORDER BY a.date_emission)
      FROM public.factures a
     WHERE a.facture_origine_id = p_facture AND a.statut <> 'annulee'
    ), '[]'::jsonb),
    'relances', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rl.id, 'niveau', rl.niveau, 'date_relance', rl.date_relance,
        'canal', rl.canal, 'note', rl.note, 'le', rl.le
      ) ORDER BY rl.date_relance)
      FROM public.relances rl WHERE rl.facture_id = p_facture
    ), '[]'::jsonb),
    'journal', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'action', j.action, 'motif', j.motif, 'auteur', j.auteur, 'le', j.le
      ) ORDER BY j.le)
      FROM public.factures_journal j WHERE j.facture_id = p_facture
    ), '[]'::jsonb),
    'solde', jsonb_build_object(
      'montant_ttc', v_f.montant_ttc, 'encaisse', v_encaisse, 'avoirs', v_avoirs,
      'solde', v_solde, 'devise', v_f.devise,
      'regle', 'solde = montant TTC - encaissements - avoirs non annules',
      'source', 'factures, encaissements, factures avoir rattachees'
    )
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dossier_financier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dossier_financier(uuid) TO authenticated;

/*
  Etat des creances clients : une ligne par facture emise sur la periode,
  avec encaissements, avoirs, solde, retard et relances. Les factures
  annulees et les avoirs ne sont pas des creances.
*/
CREATE OR REPLACE FUNCTION public.etat_creances(
  p_debut date, p_fin date, p_site uuid DEFAULT NULL
)
RETURNS TABLE (
  facture_id uuid, numero text, contrat_reference text, contrepartie text,
  devise text, date_emission date, date_echeance date,
  montant_ttc numeric, encaisse numeric, avoirs numeric, solde numeric,
  jours_retard integer, statut_recouvrement text, nb_relances integer,
  source text, fiabilite text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
SELECT f.id, f.numero, c.reference, c.contrepartie, f.devise,
       f.date_emission, f.date_echeance, f.montant_ttc,
       coalesce(enc.montant, 0) AS encaisse,
       coalesce(av.montant, 0) AS avoirs,
       CASE WHEN f.montant_ttc IS NULL THEN NULL
            ELSE round(f.montant_ttc - coalesce(enc.montant, 0) - coalesce(av.montant, 0), 2) END AS solde,
       CASE WHEN f.date_echeance IS NULL THEN NULL
            ELSE greatest(0, current_date - f.date_echeance) END AS jours_retard,
       CASE
         WHEN f.montant_ttc IS NULL THEN 'sans_donnees'
         WHEN f.montant_ttc - coalesce(enc.montant, 0) - coalesce(av.montant, 0) <= 0 THEN 'soldee'
         WHEN f.date_echeance IS NOT NULL AND f.date_echeance < current_date THEN 'en_retard'
         ELSE 'en_cours'
       END AS statut_recouvrement,
       coalesce(rel.nb, 0)::integer AS nb_relances,
       'factures emises, encaissements, avoirs, relances'::text AS source,
       CASE WHEN f.montant_ttc IS NULL THEN 'sans_donnees' ELSE 'mesure' END AS fiabilite
  FROM public.factures f
  LEFT JOIN public.contrats c ON c.id = f.contrat_id
  LEFT JOIN LATERAL (
    SELECT sum(e.montant) AS montant FROM public.encaissements e WHERE e.facture_id = f.id
  ) enc ON true
  LEFT JOIN LATERAL (
    SELECT sum(a.montant_ttc) AS montant FROM public.factures a
     WHERE a.facture_origine_id = f.id AND a.statut <> 'annulee'
  ) av ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS nb FROM public.relances rl WHERE rl.facture_id = f.id
  ) rel ON true
 WHERE f.type = 'facture' AND f.statut = 'emise'
   AND f.date_emission BETWEEN p_debut AND p_fin
   AND (p_site IS NULL OR EXISTS (
     SELECT 1 FROM public.reconciliations r
      WHERE r.id = f.reconciliation_id
        AND (r.site_depart_id = p_site OR r.site_arrivee_id = p_site)))
   AND (public.has_module_view('invoices') OR public.has_module_view('contracts') OR public.is_admin())
 ORDER BY f.date_echeance NULLS LAST, f.numero;
$fn$;

REVOKE EXECUTE ON FUNCTION public.etat_creances(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.etat_creances(date, date, uuid) TO authenticated;

/*
  Etat des paiements fournisseurs sur la periode : propositions, executions,
  controle a posteriori et pieces rattachees.
*/
CREATE OR REPLACE FUNCTION public.etat_paiements_fournisseur(p_debut date, p_fin date)
RETURNS TABLE (
  paiement_id uuid, numero text, beneficiaire text, devise text,
  montant_propose numeric, montant_execute numeric, statut text,
  propose_le timestamptz, execute_le date, controle_resultat text,
  facture_fournisseur text, bon_commande text, source text, fiabilite text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
SELECT p.id, p.numero, p.beneficiaire, p.devise, p.montant_propose, p.montant_execute,
       p.statut, p.propose_le, p.execute_le, p.controle_resultat,
       ff.numero_fournisseur, po.po_number,
       'paiements_fournisseur, factures_fournisseur, purchase_orders'::text AS source,
       CASE WHEN p.statut = 'execute' AND p.montant_execute IS NULL THEN 'partielle' ELSE 'mesure' END AS fiabilite
  FROM public.paiements_fournisseur p
  LEFT JOIN public.factures_fournisseur ff ON ff.id = p.facture_fournisseur_id
  LEFT JOIN public.purchase_orders po ON po.id = p.purchase_order_id
 WHERE (p.propose_le::date BETWEEN p_debut AND p_fin OR p.execute_le BETWEEN p_debut AND p_fin)
   AND (public.has_module_view('invoices') OR public.has_module_view('contracts')
        OR public.has_module_view('purchases') OR public.is_admin())
 ORDER BY coalesce(p.execute_le, p.propose_le::date) DESC NULLS LAST, p.numero;
$fn$;

REVOKE EXECUTE ON FUNCTION public.etat_paiements_fournisseur(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.etat_paiements_fournisseur(date, date) TO authenticated;

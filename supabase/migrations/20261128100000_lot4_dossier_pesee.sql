/*
  # Lot 4 (D-122) : dossier de pesee et de rapprochement

  La pesee physique reste celle de CBG. SIGTB conserve et expose :
  - les valeurs originales du ticket (jamais reecrites) ;
  - la tare de reference figee sur la rotation ;
  - le net communique par CBG ;
  - le net calcule par SIGTB (brut CBG - tare applicable) ;
  - l'ecart, la tolerance applicable et sa source ;
  - les classes du rapprochement, les anomalies, les ecarts de releve et les
    rectifications (chacune journalisee).

  Aucune correction n'ecrase une valeur : les rectifications sont lues dans
  rectifications_tickets_pesee_cbg, les decisions dans anomalies_pesee.

  Securite : SECURITY INVOKER (RLS et droits de lecture appliques). Sans
  droit de lecture sur les voyages, la fonction renvoie NULL.
*/
CREATE OR REPLACE FUNCTION public.dossier_pesee(p_trip uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_t record;
  v_ticket record;
  v_rap record;
  v_tol record;
  v_net_sigtb numeric;
  v_net_cbg numeric;
  v_ecart numeric;
  v_ecart_pct numeric;
  v_dans_tolerance boolean;
  v_statut text;
  v_detail text;
BEGIN
  IF p_trip IS NULL OR NOT (public.has_module_view('trips') OR public.is_admin()) THEN
    RETURN NULL;
  END IF;

  SELECT t.id, t.reference, t.planned_date, t.etat, t.departure_site_id, t.arrival_site_id,
         t.vehicle_id, t.driver_id, t.gross_weight, t.tare_weight, t.net_weight,
         t.net_weight_reception, t.accepted_tonnage,
         t.tare_reference_id, t.tare_reference_tonnes, t.tare_reference_configuration, t.tare_figee_le,
         v.registration
    INTO v_t
    FROM public.trips t
    LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
   WHERE t.id = p_trip;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT k.id, k.ticket, k.brut, k.tare, k.net, k.mesure_le, k.document_ref,
         k.origine, k.motif_rattachement, k.saisi_par, k.cree_le
    INTO v_ticket
    FROM public.tickets_pesee_cbg k
   WHERE k.trip_id = p_trip
   ORDER BY k.mesure_le DESC NULLS LAST, k.cree_le DESC
   LIMIT 1;

  SELECT rp.id, rp.ticket, rp.net_cbg, rp.net_kogon, rp.ecart_t, rp.ecart_pct,
         rp.tolerance_t, rp.tolerance_pct, rp.source_tolerance, rp.classes, rp.detail,
         rp.date_cbg, rp.cree_le
    INTO v_rap
    FROM public.rapprochements_pesee rp
   WHERE rp.trip_id = p_trip
   ORDER BY rp.cree_le DESC
   LIMIT 1;

  SELECT * INTO v_tol FROM public.tolerance_pesee_applicable(v_t.departure_site_id);

  v_net_cbg := coalesce(v_ticket.net, v_rap.net_cbg);

  IF v_ticket.brut IS NOT NULL AND v_t.tare_reference_tonnes IS NOT NULL THEN
    v_net_sigtb := round(v_ticket.brut - v_t.tare_reference_tonnes, 3);
  END IF;

  IF v_net_sigtb IS NOT NULL AND v_net_cbg IS NOT NULL THEN
    v_ecart := round(v_net_sigtb - v_net_cbg, 3);
    IF v_net_cbg <> 0 THEN
      v_ecart_pct := round(100 * v_ecart / v_net_cbg, 3);
    END IF;
    v_dans_tolerance := public.ecart_dans_tolerance(v_ecart, v_net_cbg, v_tol.tolerance_t, v_tol.tolerance_pct);
  END IF;

  IF v_ticket.id IS NULL THEN
    v_statut := 'sans_ticket';
    v_detail := 'Aucun ticket CBG rattache a ce voyage';
  ELSIF v_t.tare_reference_tonnes IS NULL THEN
    v_statut := 'tare_absente';
    v_detail := 'Tare de reference absente sur la rotation : net SIGTB non calculable';
  ELSIF v_net_cbg IS NULL THEN
    v_statut := 'net_cbg_absent';
    v_detail := 'Le ticket ne porte pas de poids net exploitable';
  ELSIF v_dans_tolerance THEN
    v_statut := 'dans_tolerance';
    v_detail := 'Ecart dans la tolerance applicable';
  ELSE
    v_statut := 'ecart';
    v_detail := 'Ecart hors tolerance : le net communique par CBG fait foi, le net SIGTB reste un controle independant (D-096)';
  END IF;

  RETURN jsonb_build_object(
    'lisible', true,
    'voyage', jsonb_build_object(
      'id', v_t.id, 'reference', v_t.reference, 'date_planifiee', v_t.planned_date,
      'etat', v_t.etat, 'site_depart_id', v_t.departure_site_id,
      'site_arrivee_id', v_t.arrival_site_id, 'immatriculation', v_t.registration
    ),
    'tare_applicable', jsonb_build_object(
      'reference_id', v_t.tare_reference_id,
      'tonnes', v_t.tare_reference_tonnes,
      'configuration', v_t.tare_reference_configuration,
      'figee_le', v_t.tare_figee_le,
      'statut_reference', (SELECT tr.statut FROM public.tare_references tr WHERE tr.id = v_t.tare_reference_id),
      'valide_le', (SELECT tr.valide_le FROM public.tare_references tr WHERE tr.id = v_t.tare_reference_id)
    ),
    'poids_rotation', jsonb_build_object(
      'brut', v_t.gross_weight, 'tare_saisie', v_t.tare_weight, 'net', v_t.net_weight,
      'net_reception', v_t.net_weight_reception, 'tonnes_acceptees', v_t.accepted_tonnage
    ),
    'ticket', CASE WHEN v_ticket.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_ticket.id, 'ticket', v_ticket.ticket, 'brut', v_ticket.brut,
      'tare', v_ticket.tare, 'net', v_ticket.net, 'mesure_le', v_ticket.mesure_le,
      'document_ref', v_ticket.document_ref, 'origine', v_ticket.origine,
      'motif_rattachement', v_ticket.motif_rattachement, 'saisi_par', v_ticket.saisi_par,
      'cree_le', v_ticket.cree_le
    ) END,
    'rectifications', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rc.id, 'ancien_ticket', rc.ancien_ticket, 'ancien_brut', rc.ancien_brut,
        'ancienne_tare', rc.ancienne_tare, 'ancien_net', rc.ancien_net,
        'ancien_document_ref', rc.ancien_document_ref,
        'nouveau_ticket', rc.nouveau_ticket, 'nouveau_brut', rc.nouveau_brut,
        'nouvelle_tare', rc.nouvelle_tare, 'nouveau_net', rc.nouveau_net,
        'nouveau_document_ref', rc.nouveau_document_ref,
        'motif', rc.motif, 'corrige_par', rc.corrige_par, 'corrige_le', rc.corrige_le
      ) ORDER BY rc.corrige_le)
      FROM public.rectifications_tickets_pesee_cbg rc
      JOIN public.tickets_pesee_cbg k2 ON k2.id = rc.ticket_id
     WHERE k2.trip_id = p_trip
    ), '[]'::jsonb),
    'rapprochement', CASE WHEN v_rap.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_rap.id, 'ticket', v_rap.ticket, 'net_cbg', v_rap.net_cbg,
      'net_kogon', v_rap.net_kogon, 'ecart_t', v_rap.ecart_t, 'ecart_pct', v_rap.ecart_pct,
      'tolerance_t', v_rap.tolerance_t, 'tolerance_pct', v_rap.tolerance_pct,
      'source_tolerance', v_rap.source_tolerance, 'classes', v_rap.classes,
      'detail', v_rap.detail, 'date_cbg', v_rap.date_cbg, 'cree_le', v_rap.cree_le
    ) END,
    'anomalies', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'categorie', a.categorie, 'gravite', a.gravite,
        'description', a.description, 'statut', a.statut, 'decision', a.decision,
        'commentaire', a.commentaire, 'preuve_ref', a.preuve_ref,
        'soumis_le', a.soumis_le, 'conclu_le', a.conclu_le, 'cloture_le', a.cloture_le
      ) ORDER BY a.cree_le)
      FROM public.anomalies_pesee a WHERE a.trip_id = p_trip
    ), '[]'::jsonb),
    'ecarts_releve', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', er.id, 'nature', er.nature, 'detail', er.detail,
        'ecart_net', er.ecart_net, 'decision', er.decision, 'motif', er.motif,
        'decide_le', er.decide_le
      ) ORDER BY er.id)
      FROM public.ecarts_releve_cbg er
      JOIN public.tickets_pesee_cbg k3 ON k3.id = er.ticket_id
     WHERE k3.trip_id = p_trip
    ), '[]'::jsonb),
    'controle', jsonb_build_object(
      'brut_cbg', v_ticket.brut,
      'tare_applicable', v_t.tare_reference_tonnes,
      'net_cbg', v_net_cbg,
      'net_sigtb', v_net_sigtb,
      'ecart_t', v_ecart,
      'ecart_pct', v_ecart_pct,
      'tolerance_t', v_tol.tolerance_t,
      'tolerance_pct', v_tol.tolerance_pct,
      'source_tolerance', v_tol.source,
      'dans_tolerance', v_dans_tolerance,
      'statut', v_statut,
      'regle', 'TONNAGE NET = POIDS BRUT CBG - TARE APPLICABLE DU VEHICULE',
      'detail', v_detail,
      'source', 'tickets_pesee_cbg (valeurs originales), trips.tare_reference_* (tare figee a la rotation), parametres_tolerance_pesee'
    )
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dossier_pesee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dossier_pesee(uuid) TO authenticated;

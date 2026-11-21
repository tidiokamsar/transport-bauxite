/*
  # Lots 2 a 9 (D-130) : tracabilite complete et clôtures

  1. `tracabilite_indicateur` est etendue a tous les indicateurs servis par
     `command_center` (28 codes) et porte la chaine demandee par le mandat :
     operation, camion, chauffeur, shift, ticket CBG, tare applicable,
     nombre de pieces justificatives et etat de validation. La fonction reste
     SECURITY INVOKER : la RLS et le perimetre du lecteur s'appliquent.

  2. `etat_clotures` expose les clotures reellement enregistrees : instances
     de shift (postes) et reconciliations (decomptes). Aucune table nouvelle,
     aucune donnee reecrite.

  Un code inconnu renvoie une ligne d'information, jamais une liste vide
  presentee comme un resultat.
*/
DROP FUNCTION IF EXISTS public.tracabilite_indicateur(text, date, date, uuid);

CREATE OR REPLACE FUNCTION public.tracabilite_indicateur(
  p_code text, p_debut date, p_fin date, p_site uuid DEFAULT NULL
)
RETURNS TABLE (
  niveau text, objet text, reference text, objet_id uuid, date_objet date,
  quantite numeric, unite text, source text, detail text,
  vehicule text, chauffeur text, shift text, ticket text,
  tare_t numeric, pieces integer, validation text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_code text := lower(btrim(coalesce(p_code, '')));
BEGIN
  -- Production : voyages livres, tonnes livrees, realisation
  IF v_code IN ('voyages_livres', 'tonnes_livrees', 'realisation') THEN
    RETURN QUERY
    SELECT 'operation'::text, 'voyage'::text, t.reference, t.id, t.planned_date,
           CASE WHEN v_code = 'voyages_livres' THEN 1
                ELSE coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) END,
           CASE WHEN v_code = 'voyages_livres' THEN 'voyages' ELSE 't' END,
           'trips'::text,
           'etat ' || t.etat::text ||
             CASE WHEN v_code = 'realisation' THEN ' (numerateur de la realisation)' ELSE '' END,
           v.registration, d.name, ws.display_name,
           k.ticket, t.tare_reference_tonnes,
           (SELECT count(*)::integer FROM public.pieces_jointes pj
             WHERE pj.objet_type = 'voyage' AND pj.objet_id = t.id AND pj.annule_le IS NULL),
           t.etat::text
      FROM public.trips t
      LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
      LEFT JOIN public.drivers d ON d.id = t.driver_id
      LEFT JOIN public.work_shifts ws ON ws.id = t.shift_id
      LEFT JOIN public.tickets_pesee_cbg k ON k.trip_id = t.id
     WHERE t.planned_date BETWEEN p_debut AND p_fin
       AND t.etat::text IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED')
       AND (p_site IS NULL OR t.departure_site_id = p_site)
     ORDER BY t.planned_date, t.reference;
    RETURN;
  END IF;

  IF v_code = 'tonnes_acceptees' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'voyage'::text, t.reference, t.id, t.planned_date,
           t.accepted_tonnage, 't'::text, 'trips.accepted_tonnage'::text,
           'etat ' || t.etat::text,
           v.registration, d.name, ws.display_name, k.ticket, t.tare_reference_tonnes,
           (SELECT count(*)::integer FROM public.pieces_jointes pj
             WHERE pj.objet_type = 'voyage' AND pj.objet_id = t.id AND pj.annule_le IS NULL),
           t.etat::text
      FROM public.trips t
      LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
      LEFT JOIN public.drivers d ON d.id = t.driver_id
      LEFT JOIN public.work_shifts ws ON ws.id = t.shift_id
      LEFT JOIN public.tickets_pesee_cbg k ON k.trip_id = t.id
     WHERE t.planned_date BETWEEN p_debut AND p_fin
       AND t.etat::text IN ('ACCEPTED', 'CLOSED') AND t.accepted_tonnage IS NOT NULL
       AND (p_site IS NULL OR t.departure_site_id = p_site)
     ORDER BY t.planned_date, t.reference;
    RETURN;
  END IF;

  IF v_code = 'objectif' THEN
    RETURN QUERY
    SELECT 'regle'::text, 'objectif_production'::text,
           to_char(o.date_plan, 'DD/MM/YYYY') || coalesce(' / ' || ws.display_name, ''),
           o.id, o.date_plan, o.tonnes_cible, 't'::text,
           'objectifs_production (version active)'::text,
           'version ' || o.version || ', statut ' || o.statut::text,
           NULL::text, NULL::text, ws.display_name, NULL::text, NULL::numeric, NULL::integer,
           o.statut::text
      FROM public.objectifs_production o
      LEFT JOIN public.work_shifts ws ON ws.id = o.shift_id
     WHERE o.statut::text = 'actif' AND o.date_plan BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR o.site_id = p_site)
     ORDER BY o.date_plan, ws.shift_order;
    RETURN;
  END IF;

  IF v_code = 'livres_sans_ticket' THEN
    RETURN QUERY
    SELECT 'anomalie'::text, 'voyage'::text, x.reference, x.id, x.planned_date,
           NULL::numeric, NULL::text, 'v_voyages_livres_sans_ticket'::text, x.etat::text,
           NULL::text, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer, x.etat::text
      FROM public.v_voyages_livres_sans_ticket x
     WHERE x.planned_date BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR x.departure_site_id = p_site)
     ORDER BY x.planned_date, x.reference;
    RETURN;
  END IF;

  -- Carburant
  IF v_code IN ('litres_distribues', 'litres_par_tonne') THEN
    RETURN QUERY
    SELECT 'operation'::text, 'mouvement_carburant'::text, m.numero::text, m.id, m.date_mouvement::date,
           round(-m.variation, 1), 'L'::text,
           'mouvements_carburant (distribution validee, sans annulation validee)'::text,
           CASE WHEN v_code = 'litres_par_tonne'
                THEN 'numerateur ; denominateur = tonnes livrees de la periode' ELSE NULL END,
           v.registration,
           (SELECT d.name FROM public.drivers d WHERE d.id = ft.driver_id),
           NULL::text, NULL::text, NULL::numeric, NULL::integer, m.statut::text
      FROM public.mouvements_carburant m
      JOIN public.stockages_carburant s ON s.id = m.stockage_id
      LEFT JOIN public.fuel_transactions ft ON ft.id = m.fuel_transaction_id
      LEFT JOIN public.vehicles v ON v.id = ft.vehicle_id
     WHERE m.type = 'distribution' AND m.statut::text = 'valide'
       AND m.date_mouvement >= p_debut::timestamptz AND m.date_mouvement < (p_fin + 1)::timestamptz
       AND NOT EXISTS (SELECT 1 FROM public.mouvements_carburant a
                        WHERE a.annule_mouvement_id = m.id AND a.statut::text = 'valide')
       AND (p_site IS NULL OR s.site_id = p_site)
     ORDER BY m.date_mouvement, m.numero;
    RETURN;
  END IF;

  -- HSE
  IF v_code = 'incidents' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'incident'::text, i.numero, i.id, i.incident_time::date,
           NULL::numeric, NULL::text, 'incidents'::text, i.type::text || ' / ' || i.statut::text,
           v.registration,
           (SELECT d.name FROM public.drivers d WHERE d.id = i.driver_id),
           NULL::text, NULL::text, NULL::numeric, NULL::integer, i.statut::text
      FROM public.incidents i
      LEFT JOIN public.vehicles v ON v.id = i.vehicle_id
     WHERE i.incident_time >= p_debut::timestamptz AND i.incident_time < (p_fin + 1)::timestamptz
       AND (p_site IS NULL OR i.site_id = p_site)
     ORDER BY i.incident_time;
    RETURN;
  END IF;

  IF v_code = 'actions_en_retard' THEN
    RETURN QUERY
    SELECT 'action'::text, 'action_corrective'::text, a.numero, a.id, a.echeance,
           a.jours_de_retard::numeric, 'jours'::text, 'v_actions_correctives_en_retard'::text,
           a.libelle || ' / responsable ' || coalesce(a.responsable, 'non renseigne'),
           NULL::text, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer, 'en_retard'
      FROM public.v_actions_correctives_en_retard a
      JOIN public.incidents i ON i.id = a.incident_id
     WHERE a.echeance BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR i.site_id = p_site)
     ORDER BY a.echeance;
    RETURN;
  END IF;

  IF v_code = 'controles_non_conformes' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'controle_depart'::text, c.id::text, c.id, c.effectue_le::date,
           NULL::numeric, NULL::text, 'controles_depart'::text, 'non conforme',
           v.registration, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer,
           c.resultat::text
      FROM public.controles_depart c
      JOIN public.vehicles v ON v.id = c.vehicle_id
     WHERE c.resultat::text = 'non_conforme'
       AND c.effectue_le >= p_debut::timestamptz AND c.effectue_le < (p_fin + 1)::timestamptz
       AND (p_site IS NULL OR v.site_id = p_site)
     ORDER BY c.effectue_le;
    RETURN;
  END IF;

  -- Flotte et maintenance
  IF v_code IN ('engins_actifs', 'engins_disponibles') THEN
    RETURN QUERY
    SELECT 'actif'::text, 'engin'::text, v.registration, v.id, NULL::date,
           1::numeric, 'engins'::text,
           CASE WHEN v_code = 'engins_disponibles'
                THEN 'vehicles actifs sans immobilisation ouverte'
                ELSE 'vehicles.status = active' END,
           v.brand_model, v.registration, NULL::text, NULL::text, NULL::text, NULL::numeric,
           NULL::integer, v.status::text
      FROM public.vehicles v
     WHERE v.status::text = 'active'
       AND (p_site IS NULL OR v.site_id = p_site)
       AND (v_code <> 'engins_disponibles' OR NOT EXISTS (
             SELECT 1 FROM public.immobilisations i
              WHERE i.vehicle_id = v.id AND i.statut::text = 'ouverte' AND i.fin IS NULL))
     ORDER BY v.registration;
    RETURN;
  END IF;

  IF v_code IN ('engins_immobilises', 'immobilisations_ouvertes') THEN
    RETURN QUERY
    SELECT 'immobilisation'::text, 'engin'::text, v.registration, v.id, i.debut::date,
           1::numeric, 'engins'::text, 'immobilisations (statut ouverte, sans fin)'::text,
           i.cause::text || ' / imputation ' || i.imputation::text,
           v.registration, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer, i.statut::text
      FROM public.immobilisations i
      JOIN public.vehicles v ON v.id = i.vehicle_id
     WHERE i.statut::text = 'ouverte' AND i.fin IS NULL
       AND (p_site IS NULL OR v.site_id = p_site)
     ORDER BY i.debut;
    RETURN;
  END IF;

  IF v_code IN ('heures_immobilisation', 'immobilisations_panne') THEN
    RETURN QUERY
    SELECT 'immobilisation'::text, 'engin'::text, v.registration, v.id, i.debut::date,
           round(extract(epoch FROM (least(coalesce(i.fin, now()), (p_fin + 1)::timestamptz)
                                     - greatest(i.debut, p_debut::timestamptz))) / 3600.0, 2),
           'h'::text, 'immobilisations (chevauchement de la periode)'::text,
           i.cause::text || ' / imputation ' || i.imputation::text,
           v.registration, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer, i.statut::text
      FROM public.immobilisations i
      JOIN public.vehicles v ON v.id = i.vehicle_id
     WHERE i.statut::text <> 'annulee'
       AND (v_code <> 'immobilisations_panne' OR i.cause::text = 'panne')
       AND i.debut < (p_fin + 1)::timestamptz
       AND coalesce(i.fin, now()) > p_debut::timestamptz
       AND (p_site IS NULL OR v.site_id = p_site)
     ORDER BY i.debut;
    RETURN;
  END IF;

  IF v_code = 'interventions_en_retard' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'intervention_loueur'::text, i.numero, i.id, i.demande_le::date,
           i.delai_heures, 'h'::text, 'v_interventions_loueur'::text,
           'delai contractuel ' || i.delai_contractuel_heures || ' h, statut ' || i.statut::text,
           v.registration, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer, i.statut::text
      FROM public.v_interventions_loueur i
      LEFT JOIN public.vehicles v ON v.id = i.vehicle_id
     WHERE i.en_retard AND i.statut::text <> 'remise_validee'
       AND (p_site IS NULL OR v.site_id = p_site)
     ORDER BY i.demande_le;
    RETURN;
  END IF;

  -- Operations en cours et terminees
  IF v_code IN ('rotations_en_cours', 'rotations_terminees', 'rotations_interrompues') THEN
    RETURN QUERY
    SELECT 'operation'::text, 'voyage'::text, t.reference, t.id, t.planned_date,
           1::numeric, 'rotations'::text,
           CASE WHEN v_code = 'rotations_en_cours' THEN 'etat a l''heure du calcul'
                ELSE 'trips.etat sur la periode' END,
           t.etat::text, v.registration, d.name, ws.display_name, k.ticket, t.tare_reference_tonnes,
           (SELECT count(*)::integer FROM public.pieces_jointes pj
             WHERE pj.objet_type = 'voyage' AND pj.objet_id = t.id AND pj.annule_le IS NULL),
           t.etat::text
      FROM public.trips t
      LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
      LEFT JOIN public.drivers d ON d.id = t.driver_id
      LEFT JOIN public.work_shifts ws ON ws.id = t.shift_id
      LEFT JOIN public.tickets_pesee_cbg k ON k.trip_id = t.id
     WHERE (p_site IS NULL OR t.departure_site_id = p_site)
       AND CASE
             WHEN v_code = 'rotations_en_cours' THEN t.etat::text IN
               ('ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT',
                'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN')
             WHEN v_code = 'rotations_terminees' THEN
               t.planned_date BETWEEN p_debut AND p_fin AND t.etat::text IN ('DELIVERED', 'ACCEPTED', 'CLOSED')
             ELSE t.planned_date BETWEEN p_debut AND p_fin AND t.etat::text IN ('INTERRUPTED', 'DISPUTED', 'REJECTED')
           END
     ORDER BY t.planned_date DESC, t.reference;
    RETURN;
  END IF;

  -- Pesee
  IF v_code = 'tickets_en_attente' THEN
    RETURN QUERY
    SELECT 'ticket'::text, 'ticket_cbg'::text, k.ticket, k.id, k.mesure_le::date,
           k.net, 't'::text, 'tickets_pesee_cbg sans rapprochement'::text,
           NULL::text, v.registration, d.name, ws.display_name, k.ticket, t.tare_reference_tonnes,
           (SELECT count(*)::integer FROM public.pieces_jointes pj
             WHERE pj.objet_type = 'ticket_pesee_cbg' AND pj.objet_id = k.id AND pj.annule_le IS NULL),
           NULL::text
      FROM public.tickets_pesee_cbg k
      JOIN public.trips t ON t.id = k.trip_id
      LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
      LEFT JOIN public.drivers d ON d.id = t.driver_id
      LEFT JOIN public.work_shifts ws ON ws.id = t.shift_id
     WHERE k.mesure_le::date BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR k.site_id = p_site)
       AND NOT EXISTS (SELECT 1 FROM public.rapprochements_pesee rp WHERE rp.trip_id = k.trip_id)
     ORDER BY k.mesure_le, k.ticket;
    RETURN;
  END IF;

  IF v_code = 'anomalies_pesee_ouvertes' THEN
    RETURN QUERY
    SELECT 'anomalie'::text, 'anomalie_pesee'::text, a.cle, a.id, a.cree_le::date,
           NULL::numeric, NULL::text, 'anomalies_pesee (statut autre que cloturee)'::text,
           a.categorie || ' / ' || a.statut::text,
           v.registration, d.name, ws.display_name, rp.ticket, t.tare_reference_tonnes,
           NULL::integer, a.statut::text
      FROM public.anomalies_pesee a
      LEFT JOIN public.trips t ON t.id = a.trip_id
      LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
      LEFT JOIN public.drivers d ON d.id = t.driver_id
      LEFT JOIN public.work_shifts ws ON ws.id = t.shift_id
      LEFT JOIN public.rapprochements_pesee rp ON rp.id = a.rapprochement_id
     WHERE a.statut::text <> 'cloturee'
       AND (p_site IS NULL OR a.site_id = p_site)
     ORDER BY a.cree_le;
    RETURN;
  END IF;

  IF v_code = 'ecarts_pesee' THEN
    RETURN QUERY
    SELECT 'rapprochement'::text, 'rapprochement_pesee'::text, rp.ticket, rp.id, rp.date_cbg,
           abs(rp.ecart_t), 't'::text,
           'rapprochements_pesee.classes contient ecart_poids'::text,
           'net CBG ' || rp.net_cbg || ' t, net KOGON ' || rp.net_kogon || ' t, tolérance ' ||
             coalesce(rp.tolerance_t::text || ' t / ', '') || coalesce(rp.tolerance_pct::text || ' %', '') ||
             ' (' || coalesce(rp.source_tolerance, 'non paramétrée') || ')',
           v.registration, d.name, ws.display_name, rp.ticket, t.tare_reference_tonnes,
           NULL::integer, 'ecart'
      FROM public.rapprochements_pesee rp
      LEFT JOIN public.trips t ON t.id = rp.trip_id
      LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
      LEFT JOIN public.drivers d ON d.id = t.driver_id
      LEFT JOIN public.work_shifts ws ON ws.id = t.shift_id
     WHERE rp.cree_le::date BETWEEN p_debut AND p_fin
       AND 'ecart_poids' = ANY (rp.classes)
       AND (p_site IS NULL OR rp.site_id = p_site)
     ORDER BY rp.cree_le;
    RETURN;
  END IF;

  -- Achats et finance
  IF v_code = 'bons_a_approuver' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'bon_commande'::text, po.po_number, po.id, po.po_date,
           po.total_amount::numeric, 'montant'::text, 'purchase_orders (soumis)'::text,
           'fournisseur ' || coalesce(s.company_name, 'non renseigne'),
           NULL::text, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer, po.status::text
      FROM public.purchase_orders po
      LEFT JOIN public.suppliers s ON s.id = po.supplier_id
     WHERE po.status::text = 'submitted'
     ORDER BY po.soumis_le NULLS LAST;
    RETURN;
  END IF;

  IF v_code = 'paiements_a_controler' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'paiement_fournisseur'::text, p.numero, p.id, p.execute_le,
           p.montant_execute, p.devise, 'v_paiements_a_controler'::text, p.beneficiaire,
           NULL::text, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer,
           'a_controler'::text
      FROM public.v_paiements_a_controler p
     ORDER BY p.execute_le;
    RETURN;
  END IF;

  IF v_code LIKE 'reste_a_payer%' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'reste_a_payer'::text, x.piece, x.piece_id, x.date_piece,
           x.reste, x.devise, 'v_reste_a_payer'::text, x.beneficiaire,
           NULL::text, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer,
           CASE WHEN x.reste <= 0 THEN 'soldee' ELSE 'ouverte' END
      FROM public.v_reste_a_payer x
     WHERE x.reste IS NOT NULL AND x.reste > 0
     ORDER BY x.date_piece, x.piece;
    RETURN;
  END IF;

  IF v_code IN ('creances_solde', 'factures_en_retard') THEN
    RETURN QUERY
    SELECT 'creance'::text, 'facture'::text, c.numero, c.facture_id, c.date_emission,
           c.solde, c.devise,
           'etat_creances : solde = TTC - encaissements - avoirs'::text,
           'echeance ' || coalesce(c.date_echeance::text, 'non renseignee') ||
             ', retard ' || coalesce(c.jours_retard::text, 'sans echeance') || ' j',
           NULL::text, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer,
           c.statut_recouvrement
      FROM public.etat_creances(p_debut, p_fin, p_site) c
     WHERE c.solde IS NOT NULL
       AND (v_code <> 'factures_en_retard'
            OR (c.statut_recouvrement = 'en_retard'))
     ORDER BY c.date_echeance NULLS LAST, c.numero;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'information'::text, 'code_indicateur'::text, p_code, NULL::uuid, NULL::date,
         NULL::numeric, NULL::text, 'tracabilite_indicateur'::text,
         'Aucune chaine de tracabilite definie pour ce code'::text,
         NULL::text, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::integer, NULL::text;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.tracabilite_indicateur(text, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tracabilite_indicateur(text, date, date, uuid) TO authenticated;

/*
  Clotures enregistrees : instances de shift et reconciliations. Lecture
  seule, perimetre du lecteur, aucune donnee fabriquee.
*/
CREATE OR REPLACE FUNCTION public.etat_clotures(
  p_debut date, p_fin date, p_site uuid DEFAULT NULL
)
RETURNS TABLE (
  type_cloture text, reference text, objet_id uuid, periode_debut date, periode_fin date,
  statut text, cloture_le timestamptz, cloture_par text, valide_le timestamptz,
  lignes integer, detail text, source text, fiabilite text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_ops boolean := public.has_module_view('trips') OR public.is_admin();
  v_fin boolean := public.has_module_view('invoices') OR public.has_module_view('contracts') OR public.is_admin();
BEGIN
  IF v_ops THEN
    RETURN QUERY
    SELECT 'shift'::text, ws.display_name || ' - ' || p.date_poste::text, p.id,
           p.date_poste, p.date_poste, p.statut::text,
           p.cloture_le,
           (SELECT pr.full_name FROM public.profiles pr WHERE pr.id = p.cloture_par),
           p.valide_le,
           (SELECT count(*)::integer FROM public.trips t
             WHERE t.shift_id = p.shift_id AND t.planned_date = p.date_poste
               AND (p_site IS NULL OR t.departure_site_id = p_site)),
           'Instance de shift : ' || coalesce(p.statut::text, 'statut non renseigne'),
           'postes'::text,
           CASE WHEN p.statut::text IN ('cloture', 'valide') THEN 'mesure' ELSE 'partielle' END
      FROM public.postes p
      JOIN public.work_shifts ws ON ws.id = p.shift_id
     WHERE p.date_poste BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR p.site_id = p_site)
     ORDER BY p.date_poste, ws.shift_order;
  ELSE
    RETURN QUERY
    SELECT 'shift'::text, 'non visible'::text, NULL::uuid, NULL::date, NULL::date,
           'sans_donnees'::text, NULL::timestamptz, NULL::text, NULL::timestamptz,
           NULL::integer, 'Non visible avec vos droits de lecture'::text,
           'postes'::text, 'sans_donnees'::text
     WHERE false;
  END IF;

  IF v_fin THEN
    RETURN QUERY
    SELECT 'reconciliation'::text,
           coalesce(c.reference, 'Decompte ' || r.periode_debut::text), r.id,
           r.periode_debut, r.periode_fin, r.statut::text,
           r.cloturee_le,
           (SELECT pr.full_name FROM public.profiles pr WHERE pr.id = r.cloturee_par),
           NULL::timestamptz,
           coalesce(r.voyages_facturables, 0),
           'Tonnage facturable ' || coalesce(r.tonnage_facturable::text, 'sans donnees') ||
             ', base ' || coalesce(r.base_tonnage, 'non renseignee'),
           'reconciliations'::text,
           CASE WHEN r.statut::text = 'cloturee' THEN 'mesure' ELSE 'partielle' END
      FROM public.reconciliations r
      LEFT JOIN public.contrats c ON c.id = r.contrat_id
     WHERE r.periode_debut <= p_fin AND r.periode_fin >= p_debut
       AND (p_site IS NULL OR r.site_depart_id = p_site OR r.site_arrivee_id = p_site)
     ORDER BY r.periode_debut DESC;
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.etat_clotures(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.etat_clotures(date, date, uuid) TO authenticated;

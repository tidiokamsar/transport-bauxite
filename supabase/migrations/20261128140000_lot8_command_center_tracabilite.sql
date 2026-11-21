/*
  # Lot 8 (D-126) : Command Center et tracabilite bidirectionnelle

  1. command_center : situation consolidee de l'exploitation (rotations,
     pesee, flotte, maintenance, carburant, finance) en reutilisant
     indicateurs_pilotage pour les KPI deja definis (formule, source,
     periode, fiabilite) et en ajoutant les compteurs operationnels.
  2. tracabilite_indicateur : depuis un indicateur vers les operations qui le
     composent (voyages, tickets, mouvements de carburant, incidents,
     interventions, bons, paiements, restes a payer).
  3. indicateurs_de_rotation : depuis une rotation vers les indicateurs
     auxquels elle contribue.

  Aucune table nouvelle, aucune donnee reecrite. Un domaine non lisible
  ressort en « sans donnees » avec sa raison, jamais en zero mesure.
*/
CREATE OR REPLACE FUNCTION public.command_center(
  p_debut date, p_fin date, p_site uuid DEFAULT NULL
)
RETURNS TABLE (
  section text, code text, libelle text, valeur numeric, texte text, unite text,
  source text, fiabilite text, periode_debut date, periode_fin date,
  calcule_le timestamptz, detail text, nature text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_trips boolean := public.has_module_view('trips') OR public.is_admin();
  v_flotte boolean := public.has_module_view('vehicles') OR public.has_module_view('maintenance') OR public.is_admin();
  v_factures boolean := public.has_module_view('invoices') OR public.has_module_view('contracts') OR public.is_admin();
  v_n integer;
  v_masque constant text := 'Non visible avec vos droits de lecture';
  r record;
BEGIN
  -- KPI de reference deja calcules par le serveur (D-057, D-068).
  RETURN QUERY
  SELECT i.domaine, i.code, i.libelle, i.valeur, NULL::text AS texte, i.unite,
         i.source, i.fiabilite, i.periode_debut, i.periode_fin, i.calcule_le,
         i.detail, coalesce(i.nature, 'periode')
    FROM public.indicateurs_pilotage(p_debut, p_fin, p_site) i;

  -- Rotations en cours (instantane).
  section := 'Operations'; code := 'rotations_en_cours'; libelle := 'Rotations en cours';
  unite := 'rotations'; nature := 'instantane'; source := 'trips.etat (etats entre affectation et pesee d''entree)';
  periode_debut := p_debut; periode_fin := p_fin; calcule_le := now(); texte := NULL;
  IF NOT v_trips THEN
    valeur := NULL; fiabilite := 'sans_donnees'; detail := v_masque;
  ELSE
    SELECT count(*)::numeric INTO valeur FROM public.trips t
     WHERE t.etat IN ('ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT',
                      'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN')
       AND (p_site IS NULL OR t.departure_site_id = p_site);
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
    detail := 'Etat a l''heure du calcul, jamais une position GPS';
  END IF;
  RETURN NEXT;

  section := 'Operations'; code := 'rotations_terminees'; libelle := 'Rotations terminees sur la periode';
  unite := 'rotations'; nature := 'periode'; source := 'trips.etat (livre, accepte, cloture) et date prevue';
  calcule_le := now(); texte := NULL;
  IF NOT v_trips THEN
    valeur := NULL; fiabilite := 'sans_donnees'; detail := v_masque;
  ELSE
    SELECT count(*)::numeric INTO valeur FROM public.trips t
     WHERE t.planned_date BETWEEN p_debut AND p_fin
       AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED')
       AND (p_site IS NULL OR t.departure_site_id = p_site);
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
    detail := NULL;
  END IF;
  RETURN NEXT;

  section := 'Operations'; code := 'rotations_interrompues'; libelle := 'Rotations interrompues, en litige ou rejetees';
  unite := 'rotations'; nature := 'periode'; source := 'trips.etat (interrompu, en litige, rejete)';
  calcule_le := now(); texte := NULL;
  IF NOT v_trips THEN
    valeur := NULL; fiabilite := 'sans_donnees'; detail := v_masque;
  ELSE
    SELECT count(*)::numeric INTO valeur FROM public.trips t
     WHERE t.planned_date BETWEEN p_debut AND p_fin
       AND t.etat IN ('INTERRUPTED', 'DISPUTED', 'REJECTED')
       AND (p_site IS NULL OR t.departure_site_id = p_site);
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
    detail := NULL;
  END IF;
  RETURN NEXT;

  section := 'Pesee'; code := 'tickets_en_attente'; libelle := 'Tickets CBG sans rapprochement';
  unite := 'tickets'; nature := 'periode'; source := 'tickets_pesee_cbg sans ligne dans rapprochements_pesee';
  calcule_le := now(); texte := NULL;
  IF NOT v_trips THEN
    valeur := NULL; fiabilite := 'sans_donnees'; detail := v_masque;
  ELSE
    SELECT count(*)::numeric INTO valeur
      FROM public.tickets_pesee_cbg k
     WHERE k.mesure_le::date BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR k.site_id = p_site)
       AND NOT EXISTS (SELECT 1 FROM public.rapprochements_pesee rp WHERE rp.trip_id = k.trip_id);
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
    detail := NULL;
  END IF;
  RETURN NEXT;

  section := 'Pesee'; code := 'anomalies_pesee_ouvertes'; libelle := 'Anomalies de pesee non cloturees';
  unite := 'anomalies'; nature := 'instantane'; source := 'anomalies_pesee (statut autre que cloturee)';
  calcule_le := now(); texte := NULL;
  IF NOT v_trips THEN
    valeur := NULL; fiabilite := 'sans_donnees'; detail := v_masque;
  ELSE
    SELECT count(*)::numeric INTO valeur FROM public.anomalies_pesee a
     WHERE a.statut <> 'cloturee' AND (p_site IS NULL OR a.site_id = p_site);
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
    detail := 'Etat a l''heure du calcul';
  END IF;
  RETURN NEXT;

  section := 'Pesee'; code := 'ecarts_pesee'; libelle := 'Rapprochements avec ecart de poids';
  unite := 'rapprochements'; nature := 'periode'; source := 'rapprochements_pesee.classes contient ecart_poids';
  calcule_le := now(); texte := NULL;
  IF NOT v_trips THEN
    valeur := NULL; fiabilite := 'sans_donnees'; detail := v_masque;
  ELSE
    SELECT count(*)::numeric INTO valeur FROM public.rapprochements_pesee rp
     WHERE rp.cree_le::date BETWEEN p_debut AND p_fin
       AND 'ecart_poids' = ANY (rp.classes)
       AND (p_site IS NULL OR rp.site_id = p_site);
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
    detail := 'Le net communique par CBG fait foi ; le net SIGTB reste un controle (D-096)';
  END IF;
  RETURN NEXT;

  section := 'Flotte'; code := 'engins_disponibles'; libelle := 'Engins actifs sans immobilisation ouverte';
  unite := 'engins'; nature := 'instantane'; source := 'vehicles actifs moins immobilisations ouvertes';
  calcule_le := now(); texte := NULL;
  IF NOT v_flotte THEN
    valeur := NULL; fiabilite := 'sans_donnees'; detail := v_masque;
  ELSE
    SELECT count(*)::numeric INTO valeur FROM public.vehicles v
     WHERE v.status = 'active' AND (p_site IS NULL OR v.site_id = p_site)
       AND NOT EXISTS (SELECT 1 FROM public.immobilisations i
                        WHERE i.vehicle_id = v.id AND i.statut = 'ouverte' AND i.fin IS NULL);
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
    detail := 'Etat a l''heure du calcul';
  END IF;
  RETURN NEXT;

  section := 'Flotte'; code := 'engins_immobilises'; libelle := 'Engins immobilises';
  unite := 'engins'; nature := 'instantane'; source := 'immobilisations ouvertes sans fin';
  calcule_le := now(); texte := NULL;
  IF NOT v_flotte THEN
    valeur := NULL; fiabilite := 'sans_donnees'; detail := v_masque;
  ELSE
    SELECT count(DISTINCT i.vehicle_id)::numeric INTO valeur
      FROM public.immobilisations i JOIN public.vehicles v ON v.id = i.vehicle_id
     WHERE i.statut = 'ouverte' AND i.fin IS NULL AND (p_site IS NULL OR v.site_id = p_site);
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
    detail := 'Etat a l''heure du calcul';
  END IF;
  RETURN NEXT;

  section := 'Maintenance'; code := 'immobilisations_panne'; libelle := 'Immobilisations pour panne sur la periode';
  unite := 'immobilisations'; nature := 'periode'; source := 'immobilisations.cause = panne, non annulees';
  calcule_le := now(); texte := NULL;
  IF NOT v_flotte THEN
    valeur := NULL; fiabilite := 'sans_donnees'; detail := v_masque;
  ELSE
    SELECT count(*)::numeric INTO valeur
      FROM public.immobilisations i JOIN public.vehicles v ON v.id = i.vehicle_id
     WHERE i.cause = 'panne' AND i.statut <> 'annulee'
       AND i.debut < (p_fin + 1)::timestamptz
       AND coalesce(i.fin, now()) > p_debut::timestamptz
       AND (p_site IS NULL OR v.site_id = p_site);
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
    detail := NULL;
  END IF;
  RETURN NEXT;

  -- Creances par devise (jamais additionnees entre devises).
  section := 'Finance'; code := 'factures_en_retard'; libelle := 'Factures emises en retard de paiement';
  unite := 'factures'; nature := 'instantane'; source := 'etat_creances (echeance depassee, solde positif)';
  calcule_le := now(); texte := NULL;
  IF NOT v_factures THEN
    valeur := NULL; fiabilite := 'sans_donnees'; detail := v_masque;
  ELSE
    SELECT count(*)::numeric INTO valeur FROM public.etat_creances(p_debut, p_fin, p_site) c
     WHERE c.statut_recouvrement = 'en_retard';
    fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END;
    detail := 'Une facture sans echeance saisie n''est jamais comptee en retard';
  END IF;
  RETURN NEXT;

  section := 'Finance'; nature := 'instantane'; unite := NULL; calcule_le := now(); texte := NULL;
  IF NOT v_factures THEN
    code := 'creances_solde'; libelle := 'Creances clients (solde)'; valeur := NULL;
    fiabilite := 'sans_donnees'; detail := v_masque; source := 'etat_creances';
    RETURN NEXT;
  ELSE
    v_n := 0;
    FOR r IN
      SELECT c.devise, sum(c.solde) AS solde
        FROM public.etat_creances(p_debut, p_fin, p_site) c
       WHERE c.solde IS NOT NULL AND c.solde > 0
       GROUP BY c.devise ORDER BY c.devise
    LOOP
      v_n := v_n + 1;
      code := 'creances_solde_' || lower(coalesce(r.devise, 'non_renseignee'));
      libelle := 'Creances clients (solde ' || coalesce(r.devise, 'devise non renseignee') || ')';
      valeur := round(r.solde, 2); unite := r.devise;
      fiabilite := 'mesure'; detail := NULL; source := 'etat_creances : solde = TTC - encaissements - avoirs';
      RETURN NEXT;
    END LOOP;
    IF v_n = 0 THEN
      code := 'creances_solde'; libelle := 'Creances clients (solde)'; valeur := NULL; unite := NULL;
      fiabilite := 'sans_donnees'; detail := 'Aucune creance ouverte sur la periode'; source := 'etat_creances';
      RETURN NEXT;
    END IF;
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.command_center(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.command_center(date, date, uuid) TO authenticated;

/*
  Tracabilite descendante : indicateur -> operations qui le composent.
*/
CREATE OR REPLACE FUNCTION public.tracabilite_indicateur(
  p_code text, p_debut date, p_fin date, p_site uuid DEFAULT NULL
)
RETURNS TABLE (
  niveau text, objet text, reference text, objet_id uuid, date_objet date,
  quantite numeric, unite text, source text, detail text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_code text := lower(btrim(coalesce(p_code, '')));
BEGIN
  IF v_code IN ('voyages_livres', 'tonnes_livrees') THEN
    RETURN QUERY
    SELECT 'operation'::text, 'voyage'::text, t.reference, t.id, t.planned_date,
           CASE WHEN v_code = 'tonnes_livrees'
                THEN coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) END,
           CASE WHEN v_code = 'tonnes_livrees' THEN 't' END,
           'trips'::text, t.etat
      FROM public.trips t
     WHERE t.planned_date BETWEEN p_debut AND p_fin
       AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED')
       AND (p_site IS NULL OR t.departure_site_id = p_site)
     ORDER BY t.planned_date, t.reference;
    RETURN;
  ELSIF v_code = 'tonnes_acceptees' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'voyage'::text, t.reference, t.id, t.planned_date,
           t.accepted_tonnage, 't'::text, 'trips.accepted_tonnage'::text, t.etat
      FROM public.trips t
     WHERE t.planned_date BETWEEN p_debut AND p_fin
       AND t.etat IN ('ACCEPTED', 'CLOSED') AND t.accepted_tonnage IS NOT NULL
       AND (p_site IS NULL OR t.departure_site_id = p_site)
     ORDER BY t.planned_date, t.reference;
    RETURN;
  ELSIF v_code = 'objectif' THEN
    RETURN QUERY
    SELECT 'regle'::text, 'objectif_production'::text,
           to_char(o.date_plan, 'DD/MM/YYYY') || coalesce(' / ' || ws.display_name, ''),
           o.id, o.date_plan, o.tonnes_cible, 't'::text,
           'objectifs_production (version active)'::text,
           'version ' || o.version || ', statut ' || o.statut
      FROM public.objectifs_production o
      LEFT JOIN public.work_shifts ws ON ws.id = o.shift_id
     WHERE o.statut = 'actif' AND o.date_plan BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR o.site_id = p_site)
     ORDER BY o.date_plan, ws.shift_order;
    RETURN;
  ELSIF v_code = 'realisation' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'voyage'::text, t.reference, t.id, t.planned_date,
           coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight),
           't'::text, 'trips (numerateur de la realisation)'::text, t.etat
      FROM public.trips t
     WHERE t.planned_date BETWEEN p_debut AND p_fin
       AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED')
       AND (p_site IS NULL OR t.departure_site_id = p_site)
     ORDER BY t.planned_date, t.reference;
    RETURN;
  ELSIF v_code = 'livres_sans_ticket' THEN
    RETURN QUERY
    SELECT 'anomalie'::text, 'voyage'::text, v.reference, v.id, v.planned_date,
           NULL::numeric, NULL::text, 'v_voyages_livres_sans_ticket'::text, v.etat
      FROM public.v_voyages_livres_sans_ticket v
     WHERE v.planned_date BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR v.departure_site_id = p_site)
     ORDER BY v.planned_date, v.reference;
    RETURN;
  ELSIF v_code = 'litres_distribues' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'mouvement_carburant'::text, m.numero::text, m.id, m.date_mouvement::date,
           round(-m.variation, 1), 'L'::text,
           'mouvements_carburant (distribution validee, sans annulation validee)'::text,
           coalesce(ft.vehicle_id::text, 'vehicule non attribue')
      FROM public.mouvements_carburant m
      JOIN public.stockages_carburant s ON s.id = m.stockage_id
      LEFT JOIN public.fuel_transactions ft ON ft.id = m.fuel_transaction_id
     WHERE m.type = 'distribution' AND m.statut = 'valide'
       AND m.date_mouvement >= p_debut::timestamptz AND m.date_mouvement < (p_fin + 1)::timestamptz
       AND NOT EXISTS (SELECT 1 FROM public.mouvements_carburant a
                        WHERE a.annule_mouvement_id = m.id AND a.statut = 'valide')
       AND (p_site IS NULL OR s.site_id = p_site)
     ORDER BY m.date_mouvement, m.numero;
    RETURN;
  ELSIF v_code = 'incidents' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'incident'::text, i.numero, i.id, i.incident_time::date,
           NULL::numeric, NULL::text, 'incidents'::text, i.type || ' / ' || i.statut
      FROM public.incidents i
     WHERE i.incident_time >= p_debut::timestamptz AND i.incident_time < (p_fin + 1)::timestamptz
       AND (p_site IS NULL OR i.site_id = p_site)
     ORDER BY i.incident_time;
    RETURN;
  ELSIF v_code = 'controles_non_conformes' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'controle_depart'::text, c.id::text, c.id, c.effectue_le::date,
           NULL::numeric, NULL::text, 'controles_depart'::text, 'non conforme'
      FROM public.controles_depart c
      JOIN public.vehicles v ON v.id = c.vehicle_id
     WHERE c.resultat = 'non_conforme'
       AND c.effectue_le >= p_debut::timestamptz AND c.effectue_le < (p_fin + 1)::timestamptz
       AND (p_site IS NULL OR v.site_id = p_site)
     ORDER BY c.effectue_le;
    RETURN;
  ELSIF v_code = 'interventions_en_retard' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'intervention_loueur'::text, i.numero, i.id, i.demande_le::date,
           i.delai_heures, 'h'::text, 'v_interventions_loueur'::text,
           'delai contractuel ' || i.delai_contractuel_heures || ' h, statut ' || i.statut
      FROM public.v_interventions_loueur i
     WHERE i.en_retard AND i.statut <> 'remise_validee'
     ORDER BY i.demande_le;
    RETURN;
  ELSIF v_code = 'bons_a_approuver' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'bon_commande'::text, po.po_number, po.id, po.po_date,
           po.total_amount::numeric, 'montant'::text, 'purchase_orders (soumis)'::text, po.status
      FROM public.purchase_orders po
     WHERE po.status = 'submitted'
     ORDER BY po.soumis_le NULLS LAST;
    RETURN;
  ELSIF v_code = 'paiements_a_controler' THEN
    RETURN QUERY
    SELECT 'operation'::text, 'paiement_fournisseur'::text, p.numero, p.id, p.execute_le,
           p.montant_execute, p.devise, 'v_paiements_a_controler'::text, p.beneficiaire
      FROM public.v_paiements_a_controler p
     ORDER BY p.execute_le;
    RETURN;
  ELSIF v_code LIKE 'reste_a_payer%' THEN
    RETURN QUERY
    SELECT 'operation'::text, v.source, v.piece, v.piece_id, v.date_piece,
           v.reste, v.devise, 'v_reste_a_payer'::text, v.beneficiaire
      FROM public.v_reste_a_payer v
     WHERE v.reste IS NOT NULL AND v.reste > 0
     ORDER BY v.date_piece, v.piece;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'information'::text, 'code_indicateur'::text, p_code, NULL::uuid, NULL::date,
         NULL::numeric, NULL::text, 'tracabilite_indicateur'::text,
         'Aucune chaine de tracabilite definie pour ce code'::text;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.tracabilite_indicateur(text, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tracabilite_indicateur(text, date, date, uuid) TO authenticated;

/*
  Tracabilite montante : rotation -> indicateurs auxquels elle contribue.
*/
CREATE OR REPLACE FUNCTION public.indicateurs_de_rotation(p_trip uuid)
RETURNS TABLE (
  code text, libelle text, periode_debut date, periode_fin date,
  contribution numeric, unite text, source text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_t record;
  v_litres numeric;
  v_incidents integer;
BEGIN
  IF p_trip IS NULL OR NOT (public.has_module_view('trips') OR public.is_admin()) THEN
    RETURN;
  END IF;

  SELECT t.id, t.planned_date, t.etat,
         coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) AS tonnes,
         t.accepted_tonnage
    INTO v_t
    FROM public.trips t WHERE t.id = p_trip;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED') THEN
    code := 'voyages_livres'; libelle := 'Voyages livres';
    periode_debut := v_t.planned_date; periode_fin := v_t.planned_date;
    contribution := 1; unite := 'voyages';
    source := 'trips (etats livre, accepte, cloture, en litige, rejete)';
    RETURN NEXT;

    code := 'tonnes_livrees'; libelle := 'Tonnes livrees';
    contribution := v_t.tonnes; unite := 't';
    source := 'trips : accepte, sinon net de reception, sinon net, sinon charge';
    RETURN NEXT;
  END IF;

  IF v_t.etat IN ('ACCEPTED', 'CLOSED') AND v_t.accepted_tonnage IS NOT NULL THEN
    code := 'tonnes_acceptees'; libelle := 'Tonnes acceptees par CBG';
    periode_debut := v_t.planned_date; periode_fin := v_t.planned_date;
    contribution := v_t.accepted_tonnage; unite := 't';
    source := 'trips.accepted_tonnage';
    RETURN NEXT;
  END IF;

  SELECT round(-sum(m.variation), 1) INTO v_litres
    FROM public.mouvements_carburant m
    JOIN public.fuel_transactions ft ON ft.id = m.fuel_transaction_id
   WHERE ft.trip_id = p_trip AND m.type = 'distribution' AND m.statut = 'valide'
     AND NOT EXISTS (SELECT 1 FROM public.mouvements_carburant a
                      WHERE a.annule_mouvement_id = m.id AND a.statut = 'valide');
  IF v_litres IS NOT NULL THEN
    code := 'litres_distribues'; libelle := 'Litres distribues rattaches a la rotation';
    periode_debut := v_t.planned_date; periode_fin := v_t.planned_date;
    contribution := v_litres; unite := 'L';
    source := 'mouvements_carburant via fuel_transactions.trip_id';
    RETURN NEXT;
  END IF;

  SELECT count(*)::integer INTO v_incidents FROM public.incidents i WHERE i.trip_id = p_trip;
  IF v_incidents > 0 THEN
    code := 'incidents'; libelle := 'Incidents declares sur la rotation';
    periode_debut := v_t.planned_date; periode_fin := v_t.planned_date;
    contribution := v_incidents; unite := 'incidents';
    source := 'incidents.trip_id';
    RETURN NEXT;
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.indicateurs_de_rotation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicateurs_de_rotation(uuid) TO authenticated;

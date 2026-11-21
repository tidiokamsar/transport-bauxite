/*
  # Lot 3 (D-121) : dossier de rotation consultable

  Chaque rotation devient un dossier operationnel traçable : identite du
  camion, du chauffeur, du shift, sites, contrat, evenements du cycle,
  kilometrage mesure, incidents, pesee, fiches terrain et pieces jointes.

  Aucune table n'est creee et aucune donnee n'est reecrite : la fonction lit
  les tables proprietaires existantes (trips, trip_events, releves_compteur,
  incidents, tickets_pesee_cbg, rapprochements_pesee, fiches_terrain,
  verifications_evenements_voyage, pieces_jointes).

  Securite : SECURITY INVOKER, la RLS et les droits de lecture s'appliquent.
  Sans droit de lecture sur les voyages, la fonction renvoie NULL (jamais un
  dossier vide presente comme complet).

  Le kilometrage n'est rendu que s'il est mesure (releves du voyage, sinon
  km de debut et de fin saisis) ; sinon il reste absent avec sa raison.
*/
CREATE OR REPLACE FUNCTION public.dossier_rotation(p_trip uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_t record;
  v_nb_releves integer;
  v_km_min numeric;
  v_km_max numeric;
  v_km_parcourus numeric;
  v_source_km text;
BEGIN
  IF p_trip IS NULL OR NOT (public.has_module_view('trips') OR public.is_admin()) THEN
    RETURN NULL;
  END IF;

  SELECT t.id, t.reference, t.etat, t.status, t.planned_date, t.start_date,
         t.vehicle_id, t.driver_id, t.trailer_id, t.shift_id, t.client_id, t.loader_vehicle_id,
         t.departure_site_id, t.arrival_site_id,
         t.estimated_distance_km, t.actual_departure_time, t.actual_arrival_time,
         t.km_start, t.km_end, t.gross_weight, t.tare_weight, t.net_weight, t.load_weight,
         t.net_weight_reception, t.accepted_tonnage, t.material_type, t.notes,
         t.tare_reference_id, t.tare_reference_tonnes, t.tare_reference_configuration, t.tare_figee_le,
         t.etat_modifie_le, t.created_at, t.updated_at,
         v.registration, v.brand_model, v.capacity_tonnes, v.proprietaire, v.transporteur, v.contrat_id,
         d.name AS chauffeur_nom, d.license_number,
         sd.name AS site_depart, sa.name AS site_arrivee,
         ws.display_name AS shift_libelle,
         c.reference AS contrat_reference, c.intitule AS contrat_intitule, c.nature AS contrat_nature
    INTO v_t
    FROM public.trips t
    LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
    LEFT JOIN public.drivers d ON d.id = t.driver_id
    LEFT JOIN public.sites sd ON sd.id = t.departure_site_id
    LEFT JOIN public.sites sa ON sa.id = t.arrival_site_id
    LEFT JOIN public.work_shifts ws ON ws.id = t.shift_id
    LEFT JOIN public.contrats c ON c.id = v.contrat_id
   WHERE t.id = p_trip;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT count(*), min(r.valeur_km), max(r.valeur_km)
    INTO v_nb_releves, v_km_min, v_km_max
    FROM public.releves_compteur r
   WHERE r.trip_id = p_trip;

  IF v_nb_releves >= 2 AND v_km_min IS NOT NULL AND v_km_max IS NOT NULL THEN
    v_km_parcourus := v_km_max - v_km_min;
    v_source_km := 'releves_compteur du voyage (maximum - minimum)';
  ELSIF v_t.km_start IS NOT NULL AND v_t.km_end IS NOT NULL THEN
    v_km_parcourus := v_t.km_end - v_t.km_start;
    v_source_km := 'trips.km_start et trips.km_end';
  ELSE
    v_km_parcourus := NULL;
    v_source_km := 'sans releve kilometrique exploitable pour ce voyage';
  END IF;

  RETURN jsonb_build_object(
    'lisible', true,
    'voyage', jsonb_build_object(
      'id', v_t.id, 'reference', v_t.reference, 'etat', v_t.etat, 'statut_enum', v_t.status,
      'date_planifiee', v_t.planned_date, 'date_debut', v_t.start_date,
      'depart_effectif', v_t.actual_departure_time, 'arrivee_effective', v_t.actual_arrival_time,
      'materiau', v_t.material_type, 'note', v_t.notes,
      'etat_modifie_le', v_t.etat_modifie_le, 'cree_le', v_t.created_at, 'modifie_le', v_t.updated_at
    ),
    'camion', CASE WHEN v_t.vehicle_id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_t.vehicle_id, 'immatriculation', v_t.registration, 'modele', v_t.brand_model,
      'capacite_tonnes', v_t.capacity_tonnes, 'proprietaire', v_t.proprietaire,
      'transporteur', v_t.transporteur
    ) END,
    'chauffeur', CASE WHEN v_t.driver_id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_t.driver_id, 'nom', v_t.chauffeur_nom, 'permis', v_t.license_number
    ) END,
    'shift', CASE WHEN v_t.shift_id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_t.shift_id, 'libelle', v_t.shift_libelle
    ) END,
    'sites', jsonb_build_object(
      'depart', CASE WHEN v_t.departure_site_id IS NULL THEN NULL ELSE jsonb_build_object('id', v_t.departure_site_id, 'nom', v_t.site_depart) END,
      'arrivee', CASE WHEN v_t.arrival_site_id IS NULL THEN NULL ELSE jsonb_build_object('id', v_t.arrival_site_id, 'nom', v_t.site_arrivee) END
    ),
    'contrat', CASE WHEN v_t.contrat_id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_t.contrat_id, 'reference', v_t.contrat_reference, 'intitule', v_t.contrat_intitule,
      'nature', v_t.contrat_nature
    ) END,
    'chargement', CASE WHEN v_t.loader_vehicle_id IS NULL THEN NULL ELSE jsonb_build_object(
      'engin_id', v_t.loader_vehicle_id
    ) END,
    'kilometrage', jsonb_build_object(
      'km_parcourus', v_km_parcourus, 'source', v_source_km,
      'km_debut_saisi', v_t.km_start, 'km_fin_saisi', v_t.km_end,
      'nb_releves', v_nb_releves,
      'releves', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', r.id, 'moment', r.moment, 'valeur_km', r.valeur_km, 'releve_le', r.releve_le,
          'source', r.source, 'reference_piece', r.reference_piece, 'motif', r.motif
        ) ORDER BY r.releve_le)
        FROM public.releves_compteur r WHERE r.trip_id = p_trip
      ), '[]'::jsonb)
    ),
    'evenements', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'etat_avant', e.etat_avant, 'etat_apres', e.etat_apres,
        'survenu_le', e.survenu_le, 'enregistre_le', e.enregistre_le,
        'origine', e.origine, 'auteur', e.auteur, 'note', e.note, 'donnees', e.donnees
      ) ORDER BY e.survenu_le, e.enregistre_le)
      FROM public.trip_events e WHERE e.trip_id = p_trip
    ), '[]'::jsonb),
    'verifications', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'evenement', x.evenement_id, 'statut', x.statut, 'motif', x.motif,
        'rang', x.rang, 'cree_le', x.cree_le
      ) ORDER BY x.rang)
      FROM public.verifications_evenements_voyage x WHERE x.trip_id = p_trip
    ), '[]'::jsonb),
    'incidents', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'numero', i.numero, 'type', i.type, 'gravite', i.severity,
        'survenu_le', i.incident_time, 'lieu', i.lieu, 'description', i.description,
        'statut', i.statut, 'cout_estime', i.estimated_cost, 'cause', i.cause,
        'conclusion', i.conclusion
      ) ORDER BY i.incident_time)
      FROM public.incidents i WHERE i.trip_id = p_trip
    ), '[]'::jsonb),
    'pesee', jsonb_build_object(
      'tare_reference', jsonb_build_object(
        'reference_id', v_t.tare_reference_id, 'tonnes', v_t.tare_reference_tonnes,
        'configuration', v_t.tare_reference_configuration, 'figee_le', v_t.tare_figee_le
      ),
      'poids', jsonb_build_object(
        'brut', v_t.gross_weight, 'tare_saisie', v_t.tare_weight, 'net', v_t.net_weight,
        'charge', v_t.load_weight, 'net_reception', v_t.net_weight_reception,
        'tonnes_acceptees', v_t.accepted_tonnage
      ),
      'tickets', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', k.id, 'ticket', k.ticket, 'brut', k.brut, 'tare', k.tare, 'net', k.net,
          'mesure_le', k.mesure_le, 'document_ref', k.document_ref, 'origine', k.origine,
          'motif_rattachement', k.motif_rattachement
        ) ORDER BY k.mesure_le)
        FROM public.tickets_pesee_cbg k WHERE k.trip_id = p_trip
      ), '[]'::jsonb),
      'rapprochements', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', rp.id, 'ticket', rp.ticket, 'net_cbg', rp.net_cbg, 'net_kogon', rp.net_kogon,
          'ecart_t', rp.ecart_t, 'ecart_pct', rp.ecart_pct, 'classes', rp.classes,
          'detail', rp.detail, 'date_cbg', rp.date_cbg
        ) ORDER BY rp.cree_le)
        FROM public.rapprochements_pesee rp WHERE rp.trip_id = p_trip
      ), '[]'::jsonb)
    ),
    'fiches', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', f.id, 'numero', f.numero, 'type', f.type, 'date_fiche', f.date_fiche,
        'statut', f.statut, 'etat', f.etat, 'site_id', f.site_id, 'shift_id', f.shift_id
      ) ORDER BY f.date_fiche)
      FROM public.fiches_terrain f WHERE f.trip_id = p_trip
    ), '[]'::jsonb),
    'pieces', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'nom', p.nom, 'type_mime', p.type_mime, 'module', p.module,
        'objet_type', p.objet_type, 'statut', p.statut, 'depose_le', p.depose_le
      ) ORDER BY p.depose_le)
      FROM public.pieces_jointes p
     WHERE p.objet_id = p_trip AND p.objet_type IN ('trip', 'voyage', 'rotation')
       AND p.annule_le IS NULL
    ), '[]'::jsonb)
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dossier_rotation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dossier_rotation(uuid) TO authenticated;

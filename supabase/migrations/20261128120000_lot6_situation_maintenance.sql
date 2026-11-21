/*
  # Lot 6 (D-124) : situation maintenance, carburant et pneumatiques

  Vue consolidee par engin sur une periode : immobilisations, interventions
  du loueur (delai contractuel), incidents, kilometrage mesure, carburant
  distribue et couts enregistres par devise.

  Regles :
  - les couts ne sont jamais additionnes entre devises : ils sortent en objet
    JSON { devise: montant } ;
  - un cout annule n'est pas compte ;
  - le kilometrage n'est rendu que s'il est mesure (releves compteur de la
    periode, sinon somme des km de debut et de fin des voyages) ;
  - litres par kilometre et par tonne seulement si le kilometrage ou le
    tonnage valide existe et est non nul ;
  - aucun cout n'est converti en une autre devise.

  Securite : SECURITY INVOKER. Sans droit de lecture maintenance ou flotte,
  aucune ligne. Carburant, couts et voyages sont masques separement si le
  lecteur n'a pas le droit correspondant (NULL, jamais 0).
*/
CREATE OR REPLACE FUNCTION public.situation_maintenance(
  p_debut date, p_fin date, p_site uuid DEFAULT NULL
)
RETURNS TABLE (
  vehicle_id uuid, immatriculation text, site_id uuid, site_nom text,
  immobilisations_ouvertes integer, heures_immobilisation numeric,
  interventions integer, interventions_en_retard integer, remises_validees integer,
  incidents integer, immobilisations_panne integer,
  km_parcourus numeric, source_km text,
  litres_carburant numeric, tonnes_validees numeric,
  couts jsonb, litres_par_km numeric, litres_par_tonne numeric,
  fiabilite text, detail text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_maint boolean := public.has_module_view('maintenance') OR public.has_module_view('vehicles') OR public.is_admin();
  v_fuel boolean := public.has_module_view('fuel') OR public.is_admin();
  v_couts_ok boolean := public.has_module_view('costs') OR public.has_module_view('reports') OR public.is_admin();
  v_trips boolean := public.has_module_view('trips') OR public.is_admin();
  v_debut timestamptz := p_debut::timestamptz;
  v_fin timestamptz := (p_fin + 1)::timestamptz;
  r record;
  v_immo_ouvertes integer;
  v_heures numeric;
  v_interventions integer;
  v_retard integer;
  v_remises integer;
  v_incidents integer;
  v_pannes integer;
  v_nb_releves integer;
  v_km_min numeric;
  v_km_max numeric;
  v_km numeric;
  v_source_km text;
  v_litres numeric;
  v_tonnes numeric;
  v_couts jsonb;
  v_detail text;
BEGIN
  IF NOT v_maint THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT v.id, v.registration, v.site_id, s.name AS nom_site
      FROM public.vehicles v
      LEFT JOIN public.sites s ON s.id = v.site_id
     WHERE p_site IS NULL OR v.site_id = p_site
     ORDER BY v.registration
  LOOP
    SELECT count(*)::integer INTO v_immo_ouvertes
      FROM public.immobilisations i
     WHERE i.vehicle_id = r.id AND i.statut = 'ouverte' AND i.fin IS NULL;

    SELECT round(sum(extract(epoch FROM (least(coalesce(i.fin, now()), v_fin) - greatest(i.debut, v_debut))) / 3600)::numeric, 1)
      INTO v_heures
      FROM public.immobilisations i
     WHERE i.vehicle_id = r.id AND i.statut <> 'annulee'
       AND i.debut < v_fin AND coalesce(i.fin, now()) > v_debut;

    SELECT count(*)::integer INTO v_interventions
      FROM public.interventions_loueur i
     WHERE i.vehicle_id = r.id AND i.demande_le >= v_debut AND i.demande_le < v_fin;

    SELECT count(*)::integer INTO v_retard
      FROM public.interventions_loueur i
     WHERE i.vehicle_id = r.id AND i.statut <> 'remise_validee'
       AND i.delai_contractuel_heures IS NOT NULL
       AND extract(epoch FROM (coalesce(i.prise_en_charge_le, now()) - i.demande_le)) / 3600 > i.delai_contractuel_heures;

    SELECT count(*)::integer INTO v_remises
      FROM public.interventions_loueur i
     WHERE i.vehicle_id = r.id AND i.remise_validee_le >= v_debut AND i.remise_validee_le < v_fin;

    SELECT count(*)::integer INTO v_incidents
      FROM public.incidents i
     WHERE i.vehicle_id = r.id AND i.incident_time >= v_debut AND i.incident_time < v_fin;

    SELECT count(*)::integer INTO v_pannes
      FROM public.immobilisations i
     WHERE i.vehicle_id = r.id AND i.cause = 'panne' AND i.statut <> 'annulee'
       AND i.debut < v_fin AND coalesce(i.fin, now()) > v_debut;

    SELECT count(*), min(rc.valeur_km), max(rc.valeur_km)
      INTO v_nb_releves, v_km_min, v_km_max
      FROM public.releves_compteur rc
     WHERE rc.vehicle_id = r.id AND rc.releve_le >= v_debut AND rc.releve_le < v_fin;

    IF v_nb_releves >= 2 AND v_km_min IS NOT NULL AND v_km_max IS NOT NULL THEN
      v_km := v_km_max - v_km_min;
      v_source_km := 'releves_compteur de la periode (maximum - minimum)';
    ELSIF v_trips THEN
      SELECT sum(t.km_end - t.km_start) INTO v_km
        FROM public.trips t
       WHERE t.vehicle_id = r.id AND t.planned_date BETWEEN p_debut AND p_fin
         AND t.km_start IS NOT NULL AND t.km_end IS NOT NULL AND t.km_end >= t.km_start;
      IF v_km IS NOT NULL THEN
        v_source_km := 'somme des km de debut et de fin des voyages de la periode';
      ELSE
        v_source_km := 'sans releve kilometrique exploitable';
      END IF;
    ELSE
      v_km := NULL;
      v_source_km := 'sans droit de lecture des voyages';
    END IF;

    IF v_fuel THEN
      SELECT round(-sum(m.variation), 1) INTO v_litres
        FROM public.mouvements_carburant m
        JOIN public.stockages_carburant s ON s.id = m.stockage_id
        LEFT JOIN public.fuel_transactions ft ON ft.id = m.fuel_transaction_id
       WHERE m.type = 'distribution' AND m.statut = 'valide'
         AND m.date_mouvement >= v_debut AND m.date_mouvement < v_fin
         AND NOT EXISTS (SELECT 1 FROM public.mouvements_carburant a
                          WHERE a.annule_mouvement_id = m.id AND a.statut = 'valide')
         AND ft.vehicle_id = r.id;
    END IF;

    IF v_trips THEN
      SELECT sum(t.accepted_tonnage) INTO v_tonnes
        FROM public.trips t
       WHERE t.vehicle_id = r.id AND t.planned_date BETWEEN p_debut AND p_fin
         AND t.etat IN ('ACCEPTED', 'CLOSED');
    END IF;

    IF v_couts_ok THEN
      SELECT coalesce(jsonb_object_agg(x.devise, x.montant), '{}'::jsonb) INTO v_couts
        FROM (
          SELECT coalesce(nullif(btrim(c.devise), ''), 'non renseignee') AS devise,
                 round(sum(c.amount), 2) AS montant
            FROM public.costs c
           WHERE c.vehicle_id = r.id AND c.date BETWEEN p_debut AND p_fin
             AND coalesce(c.statut, 'enregistre') <> 'annule'
           GROUP BY 1
        ) x;
    END IF;

    v_detail := concat_ws(' ; ',
      CASE WHEN v_km IS NULL THEN 'kilometrage non mesure' END,
      CASE WHEN NOT v_fuel THEN 'carburant non visible avec vos droits' END,
      CASE WHEN NOT v_couts_ok THEN 'couts non visibles avec vos droits' END,
      CASE WHEN NOT v_trips THEN 'tonnage non visible avec vos droits' END,
      v_immo_ouvertes || ' immobilisation(s) ouverte(s) a l''heure du calcul'
    );

    vehicle_id := r.id;
    immatriculation := r.registration;
    site_id := r.site_id;
    site_nom := r.nom_site;
    immobilisations_ouvertes := v_immo_ouvertes;
    heures_immobilisation := v_heures;
    interventions := v_interventions;
    interventions_en_retard := v_retard;
    remises_validees := v_remises;
    incidents := v_incidents;
    immobilisations_panne := v_pannes;
    km_parcourus := v_km;
    source_km := v_source_km;
    litres_carburant := v_litres;
    tonnes_validees := v_tonnes;
    couts := v_couts;
    litres_par_km := CASE WHEN v_litres IS NOT NULL AND v_km > 0 THEN round(v_litres / v_km, 3) END;
    litres_par_tonne := CASE WHEN v_litres IS NOT NULL AND v_tonnes > 0 THEN round(v_litres / v_tonnes, 3) END;
    fiabilite := CASE
      WHEN v_km IS NULL AND v_litres IS NULL AND coalesce(v_interventions, 0) = 0
       AND coalesce(v_immo_ouvertes, 0) = 0 AND coalesce(v_incidents, 0) = 0 THEN 'sans_donnees'
      WHEN v_km IS NULL THEN 'partielle'
      ELSE 'mesure'
    END;
    detail := v_detail;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.situation_maintenance(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.situation_maintenance(date, date, uuid) TO authenticated;

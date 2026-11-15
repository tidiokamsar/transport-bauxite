/*
  # Centre de pilotage : indicateurs de reference (D-057, lot 19,
  # modules 01 et 21)

  `indicateurs_pilotage(debut, fin, site)` : une ligne par indicateur, avec
  domaine, valeur, unite, source (tables et regle de calcul), fiabilite
  (mesure, partielle, sans_donnees), periode et heure de calcul (CDC 8,
  regle 5). SECURITY INVOKER : chaque utilisateur ne compte que ce que la
  RLS lui laisse lire ; un domaine illisible ressort « sans donnees ».
  Aucun chiffre n'est estime : une valeur absente reste NULL.

  Domaines : production (tonnes livrees et acceptees, voyages, objectif et
  realisation), tickets (voyages livres sans ticket), flotte (engins
  actifs, immobilisations ouvertes, heures d'immobilisation), carburant
  (litres distribues valides, litres par tonne), maintenance
  (interventions Neemba en retard), HSE (incidents, controles non
  conformes, actions en retard), achats et finance (bons a approuver,
  reste a payer par devise, paiements a controler).

  Le filtre site porte sur le site de depart des voyages, le site des
  engins et des cuves ; les autres domaines couvrent tout le perimetre
  lisible (indique dans la source). Idempotent.
*/

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
BEGIN
  IF p_debut IS NULL OR p_fin IS NULL OR p_fin < p_debut THEN
    RAISE EXCEPTION 'Periode invalide' USING ERRCODE = '22023';
  END IF;
  IF p_fin - p_debut > 366 THEN RAISE EXCEPTION 'Periode limitee a un an' USING ERRCODE = '22023'; END IF;
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
  fiabilite := CASE WHEN v_livres = 0 THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL; RETURN NEXT;

  code := 'tonnes_livrees'; libelle := 'Tonnes livrées'; valeur := round(v_tonnes, 2); unite := 't';
  source := 'trips : tonnage accepté, sinon reçu, sinon net, sinon chargé';
  fiabilite := CASE WHEN v_livres = 0 THEN 'sans_donnees' WHEN v_sans_poids > 0 THEN 'partielle' ELSE 'mesure' END;
  detail := CASE WHEN v_sans_poids > 0 THEN v_sans_poids || ' voyage(s) livré(s) sans poids, non comptés' END; RETURN NEXT;

  code := 'tonnes_acceptees'; libelle := 'Tonnes acceptées par CBG'; valeur := round(v_acceptees, 2); unite := 't';
  source := 'trips.accepted_tonnage (voyages acceptés ou clôturés)';
  fiabilite := CASE WHEN v_acceptees IS NULL THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL; RETURN NEXT;

  code := 'objectif'; libelle := 'Objectif de production'; valeur := round(v_cible, 2); unite := 't';
  source := 'objectifs_production actifs de journée (D-023)';
  fiabilite := CASE WHEN v_cible IS NULL THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL; RETURN NEXT;

  code := 'realisation'; libelle := 'Réalisation de l''objectif'; unite := '%';
  valeur := CASE WHEN v_cible > 0 AND v_tonnes IS NOT NULL THEN round(100 * v_tonnes / v_cible, 1) END;
  source := 'tonnes livrées / objectif';
  fiabilite := CASE WHEN valeur IS NULL THEN 'sans_donnees' WHEN v_sans_poids > 0 THEN 'partielle' ELSE 'mesure' END;
  detail := NULL; RETURN NEXT;

  -- Tickets
  domaine := 'Tickets CBG'; code := 'livres_sans_ticket'; libelle := 'Voyages livrés sans ticket CBG'; unite := 'voyages';
  SELECT count(*) INTO valeur FROM public.v_voyages_livres_sans_ticket v
   WHERE v.planned_date BETWEEN p_debut AND p_fin AND (p_site IS NULL OR v.departure_site_id = p_site);
  source := 'v_voyages_livres_sans_ticket (D-050)'; fiabilite := CASE WHEN v_livres = 0 THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL; RETURN NEXT;

  -- Flotte
  domaine := 'Flotte'; code := 'engins_actifs'; libelle := 'Engins en service'; unite := 'engins';
  SELECT count(*) INTO valeur FROM public.vehicles v WHERE v.status = 'active' AND (p_site IS NULL OR v.site_id = p_site);
  source := 'vehicles (statut actif, à l''heure du calcul)'; fiabilite := CASE WHEN valeur = 0 THEN 'sans_donnees' ELSE 'mesure' END; RETURN NEXT;

  code := 'immobilisations_ouvertes'; libelle := 'Immobilisations en cours'; unite := 'engins';
  SELECT count(*) INTO valeur FROM public.immobilisations i JOIN public.vehicles v ON v.id = i.vehicle_id
   WHERE i.fin IS NULL AND (p_site IS NULL OR v.site_id = p_site);
  source := 'immobilisations sans fin (D-022)'; fiabilite := 'mesure'; RETURN NEXT;

  code := 'heures_immobilisation'; libelle := 'Heures d''immobilisation sur la période'; unite := 'h';
  SELECT round(sum(extract(epoch FROM (least(coalesce(i.fin, now()), v_fin) - greatest(i.debut, v_debut))) / 3600)::numeric, 1)
    INTO valeur
    FROM public.immobilisations i JOIN public.vehicles v ON v.id = i.vehicle_id
   WHERE i.debut < v_fin AND coalesce(i.fin, now()) > v_debut AND (p_site IS NULL OR v.site_id = p_site);
  source := 'immobilisations : durée comprise dans la période (en cours : jusqu''à l''heure du calcul)';
  fiabilite := CASE WHEN valeur IS NULL THEN 'sans_donnees' ELSE 'mesure' END; RETURN NEXT;

  -- Carburant
  domaine := 'Carburant'; code := 'litres_distribues'; libelle := 'Litres distribués (validés)'; unite := 'L';
  SELECT -sum(m.variation) INTO v_litres FROM public.mouvements_carburant m JOIN public.stockages_carburant s ON s.id = m.stockage_id
   WHERE m.type = 'distribution' AND m.statut = 'valide' AND m.date_mouvement >= v_debut AND m.date_mouvement < v_fin
     AND NOT EXISTS (SELECT 1 FROM public.mouvements_carburant a WHERE a.annule_mouvement_id = m.id)
     AND (p_site IS NULL OR s.site_id = p_site);
  valeur := round(v_litres, 1);
  source := 'mouvements_carburant : distributions validées non annulées (D-041)';
  fiabilite := CASE WHEN v_litres IS NULL THEN 'sans_donnees' ELSE 'mesure' END; detail := NULL; RETURN NEXT;

  code := 'litres_par_tonne'; libelle := 'Litres par tonne livrée'; unite := 'L/t';
  valeur := CASE WHEN v_litres > 0 AND v_tonnes > 0 THEN round(v_litres / v_tonnes, 3) END;
  source := 'litres distribués / tonnes livrées';
  fiabilite := CASE WHEN valeur IS NULL THEN 'sans_donnees' WHEN v_sans_poids > 0 THEN 'partielle' ELSE 'mesure' END; RETURN NEXT;

  -- Maintenance
  domaine := 'Maintenance'; code := 'interventions_en_retard'; libelle := 'Interventions Neemba en retard'; unite := 'interventions';
  SELECT count(*) INTO valeur FROM public.v_interventions_loueur i WHERE i.en_retard AND i.statut <> 'remise_validee';
  source := 'v_interventions_loueur (délai contractuel saisi, D-049) ; tout le périmètre lisible';
  fiabilite := 'mesure'; detail := 'Sans délai contractuel saisi, une intervention n''est jamais comptée en retard'; RETURN NEXT;

  -- HSE
  domaine := 'HSE'; detail := NULL; code := 'incidents'; libelle := 'Incidents déclarés'; unite := 'incidents';
  SELECT count(*) INTO valeur FROM public.incidents i WHERE i.incident_time >= v_debut AND i.incident_time < v_fin;
  source := 'incidents (heure de survenue) ; tout le périmètre lisible'; fiabilite := 'mesure'; RETURN NEXT;

  code := 'controles_non_conformes'; libelle := 'Contrôles avant départ non conformes'; unite := 'contrôles';
  SELECT count(*) INTO valeur FROM public.controles_depart c JOIN public.vehicles v ON v.id = c.vehicle_id
   WHERE c.resultat = 'non_conforme' AND c.effectue_le >= v_debut AND c.effectue_le < v_fin AND (p_site IS NULL OR v.site_id = p_site);
  source := 'controles_depart (D-054)';
  fiabilite := CASE WHEN NOT EXISTS (SELECT 1 FROM public.controles_depart c WHERE c.effectue_le >= v_debut AND c.effectue_le < v_fin)
                    THEN 'sans_donnees' ELSE 'mesure' END; RETURN NEXT;

  code := 'actions_en_retard'; libelle := 'Actions correctives en retard'; unite := 'actions';
  SELECT count(*) INTO valeur FROM public.v_actions_correctives_en_retard;
  source := 'v_actions_correctives_en_retard (à l''heure du calcul)'; fiabilite := 'mesure'; RETURN NEXT;

  -- Achats et finance
  domaine := 'Achats et finance'; code := 'bons_a_approuver'; libelle := 'Bons de commande à approuver'; unite := 'bons';
  SELECT count(*) INTO valeur FROM public.purchase_orders po WHERE po.status = 'submitted';
  source := 'purchase_orders soumis (D-053)'; fiabilite := 'mesure'; RETURN NEXT;

  code := 'paiements_a_controler'; libelle := 'Paiements à contrôler a posteriori'; unite := 'paiements';
  SELECT count(*) INTO valeur FROM public.v_paiements_a_controler;
  source := 'v_paiements_a_controler (D-055)'; fiabilite := 'mesure'; RETURN NEXT;

  FOR r IN SELECT v.devise, sum(v.reste) AS reste FROM public.v_reste_a_payer v GROUP BY v.devise ORDER BY v.devise LOOP
    code := 'reste_a_payer_' || lower(r.devise); libelle := 'Reste à payer aux fournisseurs (' || r.devise || ')';
    valeur := round(r.reste, 2); unite := r.devise;
    source := 'v_reste_a_payer : factures du loueur contrôlées et bons reçus (D-055)'; fiabilite := 'mesure'; RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.indicateurs_pilotage(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicateurs_pilotage(date, date, uuid) TO authenticated;

/*
  # Justification de l'absence de fiche terrain (D-088, suite)

  Le controle `fiche_presente` de `controles_voyage` signale un voyage pese
  ou livre sans fiche terrain reliee. Aucune table ne portait la
  justification de cette absence : elle est ajoutee ici.

  1. Table append-only `justifications_absence_fiche` (statut justifiee ou
     retiree, motif de 10 caracteres au moins, reference de document
     facultative, chaine `precedente_id` unique : une correction est une
     nouvelle ligne qui cite la precedente, rien n'est ecrase). RLS : lecture
     trips + `voyage_permis` ; aucune ecriture directe.
  2. `justifier_absence_fiche` (SECURITY DEFINER, search_path vide) : droit
     d'ecriture trips, site du voyage (`site_permis` du depart ou de
     l'arrivee), voyage pese ou livre sans fiche reliee pour justifier,
     controle de concurrence par la derniere justification connue (40001).
  3. `controles_voyage` redefinie depuis sa seule definition
     (20261121220000) : seul le controle 5 change ; une absence justifiee
     donne le resultat `justifie` (motif et date au detail), une
     justification retiree redonne l'alerte.

  Additive et idempotente. Aucune autre fonction ni table modifiee.
*/

CREATE TABLE IF NOT EXISTS public.justifications_absence_fiche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rang bigint GENERATED ALWAYS AS IDENTITY,
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  statut text NOT NULL CHECK (statut IN ('justifiee', 'retiree')),
  motif text NOT NULL CHECK (char_length(btrim(motif)) >= 10),
  reference_document text,
  precedente_id uuid REFERENCES public.justifications_absence_fiche(id),
  auteur uuid NOT NULL REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS justifications_absence_fiche_trip_idx ON public.justifications_absence_fiche (trip_id, rang);
CREATE UNIQUE INDEX IF NOT EXISTS justifications_absence_fiche_precedente_uq
  ON public.justifications_absence_fiche (precedente_id) WHERE precedente_id IS NOT NULL;

DROP TRIGGER IF EXISTS justifications_absence_fiche_immuable ON public.justifications_absence_fiche;
CREATE TRIGGER justifications_absence_fiche_immuable BEFORE UPDATE OR DELETE ON public.justifications_absence_fiche
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_dispatch();

ALTER TABLE public.justifications_absence_fiche ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.justifications_absence_fiche FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.justifications_absence_fiche TO authenticated;
GRANT ALL ON public.justifications_absence_fiche TO service_role;
DROP POLICY IF EXISTS lecture ON public.justifications_absence_fiche;
CREATE POLICY lecture ON public.justifications_absence_fiche FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.is_admin()) AND public.voyage_permis(trip_id));

CREATE OR REPLACE FUNCTION public.justifier_absence_fiche(
  p_trip_id uuid, p_statut text, p_motif text, p_reference_document text DEFAULT NULL, p_precedente_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t public.trips;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_der public.justifications_absence_fiche;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.site_permis(t.departure_site_id) OR public.site_permis(t.arrival_site_id)) THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_statut IS NULL OR p_statut NOT IN ('justifiee', 'retiree') THEN
    RAISE EXCEPTION 'Statut attendu : justifiee ou retiree' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(v_motif, '')) < 10 THEN
    RAISE EXCEPTION 'Motif requis (10 caracteres au moins)' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_der FROM public.justifications_absence_fiche WHERE trip_id = t.id ORDER BY rang DESC LIMIT 1;
  IF v_der.id IS DISTINCT FROM p_precedente_id THEN
    RAISE EXCEPTION 'Justification modifiee entre-temps : recharger le voyage' USING ERRCODE = '40001';
  END IF;
  IF p_statut = 'retiree' AND (v_der.id IS NULL OR v_der.statut <> 'justifiee') THEN
    RAISE EXCEPTION 'Aucune justification en vigueur a retirer' USING ERRCODE = '22023';
  END IF;
  IF p_statut = 'justifiee' THEN
    IF coalesce(t.etat, '') NOT IN ('WEIGHED_IN', 'DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED') THEN
      RAISE EXCEPTION 'Seul un voyage pese ou livre se justifie sans fiche' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.fiches_rotations_lignes l JOIN public.fiches_terrain f ON f.id = l.fiche_id AND f.etat <> 'annulee' WHERE l.trip_id = t.id)
       OR EXISTS (SELECT 1 FROM public.fiches_terrain f WHERE f.trip_id = t.id AND f.etat <> 'annulee')
       OR EXISTS (SELECT 1 FROM public.tickets_pesee_cbg k JOIN public.fiches_terrain f ON f.id = k.fiche_id AND f.etat <> 'annulee' WHERE k.trip_id = t.id) THEN
      RAISE EXCEPTION 'Une fiche est reliee a ce voyage : aucune absence a justifier' USING ERRCODE = '22023';
    END IF;
    IF v_der.id IS NOT NULL AND v_der.statut = 'justifiee' THEN
      RAISE EXCEPTION 'Absence deja justifiee : la retirer avant d''en donner une autre' USING ERRCODE = '23505';
    END IF;
  END IF;
  INSERT INTO public.justifications_absence_fiche (trip_id, statut, motif, reference_document, precedente_id, auteur)
  VALUES (t.id, p_statut, v_motif, nullif(btrim(coalesce(p_reference_document, '')), ''), v_der.id, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.justifier_absence_fiche(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.justifier_absence_fiche(uuid, text, text, text, uuid) TO authenticated, service_role;

-- Redefinie depuis 20261121220000_operations_transport (seule definition) :
-- controle 5 (fiche presente) tenant compte de la justification d'absence.
CREATE OR REPLACE FUNCTION public.controles_voyage(p_trip_id uuid)
RETURNS TABLE (ordre integer, code text, libelle text, resultat text, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t public.trips;
  v_engage boolean;
  v_livre boolean;
  v_dec public.decisions_dispatch;
  v_drv public.drivers;
  v_manque text;
  v_n integer;
  v_fiches integer;
  v_ticket public.tickets_pesee_cbg;
  v_txt text;
  v_justif public.justifications_absence_fiche;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_module_view('trips') OR public.is_admin())
     OR NOT public.voyage_permis(p_trip_id) THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002'; END IF;
  v_engage := coalesce(t.etat, 'DRAFT') NOT IN ('DRAFT', 'PLANNED', 'CANCELLED');
  v_livre := coalesce(t.etat, '') IN ('WEIGHED_IN', 'DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED');

  -- 1. Affectation valide
  ordre := 1; code := 'affectation_valide'; libelle := 'Affectation valide';
  SELECT * INTO v_dec FROM public.decisions_dispatch d
   WHERE d.trip_id = t.id AND d.decision <> 'refusee'
   ORDER BY d.decide_le DESC, CASE d.nature WHEN 'affectation' THEN 0 ELSE 1 END DESC, d.id::text DESC LIMIT 1;
  IF NOT v_engage THEN
    resultat := 'non_applicable'; detail := 'Voyage non engage (etat ' || coalesce(t.etat, 'inconnu') || ')';
  ELSIF t.vehicle_id IS NULL OR t.driver_id IS NULL THEN
    resultat := 'alerte'; detail := 'Camion ou chauffeur manquant sur un voyage engage';
  ELSIF v_dec.id IS NULL THEN
    resultat := 'alerte'; detail := 'Aucune decision Dispatch tracee pour l''affectation courante';
  ELSIF v_dec.vehicle_id IS DISTINCT FROM t.vehicle_id OR v_dec.driver_id IS DISTINCT FROM t.driver_id THEN
    resultat := 'alerte'; detail := 'Camion ou chauffeur courant different de la derniere decision Dispatch';
  ELSIF EXISTS (SELECT 1 FROM public.immobilisations i WHERE i.vehicle_id = t.vehicle_id AND i.statut = 'ouverte')
        AND t.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'CANCELLED', 'REJECTED') THEN
    resultat := 'alerte'; detail := 'Camion sous immobilisation ouverte';
  ELSE
    resultat := 'conforme'; detail := 'Affectation conforme a la decision du ' || to_char(v_dec.decide_le, 'YYYY-MM-DD HH24:MI');
  END IF;
  RETURN NEXT;

  -- 2. Chauffeur habilite a la date du voyage
  ordre := 2; code := 'chauffeur_habilite'; libelle := 'Chauffeur habilite';
  IF t.driver_id IS NULL THEN
    resultat := CASE WHEN v_engage THEN 'alerte' ELSE 'non_applicable' END; detail := 'Aucun chauffeur affecte';
  ELSE
    SELECT * INTO v_drv FROM public.drivers WHERE id = t.driver_id;
    v_manque := public.habilitations_manquantes(t.driver_id, t.planned_date);
    IF v_drv.license_expiry IS NOT NULL AND v_drv.license_expiry < t.planned_date THEN
      resultat := 'alerte'; detail := 'Permis expire le ' || v_drv.license_expiry;
    ELSIF v_manque IS NOT NULL THEN
      resultat := 'alerte'; detail := 'Habilitations manquantes : ' || v_manque;
    ELSIF v_drv.license_expiry IS NULL THEN
      resultat := 'sans_donnees'; detail := 'Date d''expiration du permis non renseignee';
    ELSE
      resultat := 'conforme'; detail := 'Permis et habilitations requises valides le ' || t.planned_date;
    END IF;
  END IF;
  RETURN NEXT;

  -- 3. Etapes coherentes (journal du cycle)
  ordre := 3; code := 'etapes_coherentes'; libelle := 'Etapes coherentes';
  SELECT count(*) INTO v_n FROM public.trip_events WHERE trip_id = t.id;
  IF v_n = 0 THEN
    resultat := 'sans_donnees'; detail := 'Aucun evenement de cycle enregistre';
  ELSE
    -- Le serveur impose des heures croissantes a l'ecriture (avancer_voyage) ;
    -- plusieurs evenements peuvent partager la meme heure (fiche saisie au
    -- retour) : chaque etat de depart doit etre l'etat d'arrivee d'un
    -- evenement anterieur ou simultane, et aucune heure d'operation n'est
    -- posterieure a sa saisie de plus de 5 minutes.
    SELECT count(*) INTO v_n FROM public.trip_events e
     WHERE e.trip_id = t.id
       AND ((e.etat_avant IS NOT NULL AND e.etat_avant NOT IN ('DRAFT', 'PLANNED')
             AND NOT EXISTS (SELECT 1 FROM public.trip_events p
                              WHERE p.trip_id = t.id AND p.id <> e.id AND p.etat_apres = e.etat_avant
                                AND p.survenu_le <= e.survenu_le))
         OR e.survenu_le > e.enregistre_le + interval '5 minutes');
    SELECT e.etat_apres INTO v_txt FROM public.trip_events e
     WHERE e.trip_id = t.id AND e.etat_apres = t.etat
       AND e.survenu_le = (SELECT max(m.survenu_le) FROM public.trip_events m WHERE m.trip_id = t.id)
     LIMIT 1;
    IF v_n > 0 THEN
      resultat := 'alerte'; detail := v_n || ' enchainement(s) d''etats ou d''heures incoherent(s)';
    ELSIF v_txt IS NULL THEN
      resultat := 'alerte'; detail := 'Etat du voyage (' || coalesce(t.etat, '-') || ') absent du dernier evenement du journal';
    ELSE
      resultat := 'conforme'; detail := 'Chaque etat suit un etat enregistre, heures coherentes';
    END IF;
  END IF;
  RETURN NEXT;

  -- 4. Kilometrage coherent (voyage et fiches FR)
  ordre := 4; code := 'km_coherents'; libelle := 'Kilometrage coherent';
  SELECT count(*) INTO v_n FROM public.fiches_rotations_lignes l JOIN public.fiches_terrain f ON f.id = l.fiche_id
   WHERE l.trip_id = t.id AND f.etat <> 'annulee'
     AND ((l.km_depart IS NOT NULL AND t.km_start IS NOT NULL AND l.km_depart <> t.km_start)
       OR (l.km_arrivee IS NOT NULL AND t.km_end IS NOT NULL AND l.km_arrivee <> t.km_end));
  IF t.km_start IS NOT NULL AND t.km_end IS NOT NULL AND t.km_end < t.km_start THEN
    resultat := 'alerte'; detail := 'Compteur d''arrivee (' || t.km_end || ') inferieur au depart (' || t.km_start || ')';
  ELSIF v_n > 0 THEN
    resultat := 'alerte'; detail := 'Kilometrage de la fiche FR different de celui du voyage';
  ELSIF t.km_start IS NULL OR t.km_end IS NULL THEN
    resultat := CASE WHEN v_livre THEN 'sans_donnees' ELSE 'non_applicable' END; detail := 'Compteurs de depart ou d''arrivee non renseignes';
  ELSE
    resultat := 'conforme'; detail := (t.km_end - t.km_start) || ' km parcourus'
      || coalesce(' (distance estimee ' || t.estimated_distance_km || ' km)', '');
  END IF;
  RETURN NEXT;

  -- 5. Fiche terrain presente
  ordre := 5; code := 'fiche_presente'; libelle := 'Fiche terrain presente';
  SELECT count(DISTINCT x.fiche_id) INTO v_fiches FROM (
    SELECT l.fiche_id FROM public.fiches_rotations_lignes l WHERE l.trip_id = t.id
    UNION SELECT f.id FROM public.fiches_terrain f WHERE f.trip_id = t.id
    UNION SELECT tk.fiche_id FROM public.tickets_pesee_cbg tk WHERE tk.trip_id = t.id AND tk.fiche_id IS NOT NULL) x
    JOIN public.fiches_terrain f ON f.id = x.fiche_id AND f.etat <> 'annulee';
  SELECT * INTO v_justif FROM public.justifications_absence_fiche j
   WHERE j.trip_id = t.id ORDER BY j.rang DESC LIMIT 1;
  IF v_fiches > 0 THEN
    resultat := 'conforme'; detail := v_fiches || ' fiche(s) reliee(s)';
  ELSIF v_livre AND v_justif.id IS NOT NULL AND v_justif.statut = 'justifiee' THEN
    resultat := 'justifie'; detail := 'Absence de fiche justifiee le ' || to_char(v_justif.cree_le, 'YYYY-MM-DD HH24:MI') || ' : ' || v_justif.motif;
  ELSIF v_livre THEN
    resultat := 'alerte'; detail := 'Aucune fiche terrain reliee : absence a justifier'
      || CASE WHEN v_justif.id IS NOT NULL THEN ' (justification retiree : ' || v_justif.motif || ')' ELSE '' END;
  ELSE
    resultat := 'non_applicable'; detail := 'Voyage non livre';
  END IF;
  RETURN NEXT;

  -- 6. Ticket CBG associe
  ordre := 6; code := 'ticket_associe'; libelle := 'Ticket CBG associe';
  SELECT * INTO v_ticket FROM public.tickets_pesee_cbg WHERE trip_id = t.id;
  IF v_ticket.id IS NOT NULL THEN
    resultat := 'conforme';
    detail := 'Ticket ' || v_ticket.ticket || CASE WHEN EXISTS (
      SELECT 1 FROM public.rapprochements_pesee r JOIN public.releves_cbg rc ON rc.id = r.releve_id AND rc.statut <> 'annule'
       WHERE r.trip_id = t.id AND r.ligne_id IS NOT NULL) THEN ', rapproche au releve officiel CBG' ELSE ', non encore rapproche au releve officiel CBG' END;
  ELSIF v_livre THEN
    resultat := 'alerte'; detail := 'Voyage livre sans ticket CBG';
  ELSE
    resultat := 'non_applicable'; detail := 'Voyage non pese';
  END IF;
  RETURN NEXT;

  -- 7. Pas de double comptage
  ordre := 7; code := 'double_comptage'; libelle := 'Pas de double comptage';
  v_txt := NULL;
  IF v_ticket.id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.tickets_pesee_cbg o
        WHERE o.trip_id <> t.id AND upper(btrim(o.ticket)) = upper(btrim(v_ticket.ticket))) THEN
    v_txt := 'Numero de ticket ' || v_ticket.ticket || ' deja porte par un autre voyage';
  END IF;
  SELECT count(DISTINCT l.fiche_id) INTO v_n FROM public.fiches_rotations_lignes l
    JOIN public.fiches_terrain f ON f.id = l.fiche_id AND f.etat <> 'annulee' WHERE l.trip_id = t.id;
  IF v_txt IS NULL AND v_n > 1 THEN
    v_txt := 'Voyage declare sur ' || v_n || ' fiches FR';
  END IF;
  SELECT count(DISTINCT r.ligne_id) INTO v_n FROM public.rapprochements_pesee r
    JOIN public.releves_cbg rc ON rc.id = r.releve_id AND rc.statut <> 'annule'
   WHERE r.trip_id = t.id AND r.ligne_id IS NOT NULL;
  IF v_txt IS NULL AND v_n > 1 THEN
    v_txt := 'Voyage rapproche de ' || v_n || ' lignes de releves CBG';
  END IF;
  IF v_txt IS NOT NULL THEN
    resultat := 'alerte'; detail := v_txt;
  ELSE
    resultat := 'conforme'; detail := 'Ticket, fiche et ligne de releve uniques';
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.controles_voyage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.controles_voyage(uuid) TO authenticated, service_role;

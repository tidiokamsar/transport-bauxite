/*
  # Releves kilometriques et distances validees (D-043, lot K, modules 06,
  # 07, 08, 10 et 20 du mandat ; regle 12 du mandat)

  Une distance n'est jamais inventee. Cinq notions distinctes :
  - distance de reference : referentiel site -> site (`distances_reference`) ;
  - distance declaree : portee par la fiche ou le chauffeur ;
  - distance mesuree : difference de deux releves d'odometre du voyage ;
  - distance validee : decidee par une personne, motivee si elle differe de
    la mesure ou si la mesure manque ;
  - distance facturable : distance validee du trajet charge, plus celle du
    retour a vide si le contrat le prevoit (`contrat_tarifs.km_retour_vide_facturable`,
    NULL = regle a confirmer, aucun calcul).

  1. `releves_compteur` : releves d'odometre append-only (engin, voyage,
     moment, valeur, heure, source, piece). Coherence verifiee : un releve
     ne peut etre inferieur au releve precedent ni superieur au suivant de
     l'engin. Une correction cree un nouveau releve qui remplace l'ancien,
     avec motif ; l'ancien reste.
  2. `distances_voyage` : decisions de distance validee par voyage, en
     versions (la plus recente fait foi), avec mesures et reference figees
     au moment de la decision. Separation saisie des releves / validation
     (reglage `kilometrage_validation_separee`, exigee si absent).
  3. `controler_facture_fournisseur` (D-032, D-033) : pour un tarif au km,
     la quantite attendue est la somme des distances facturables des voyages
     livres de la periode. Un voyage livre sans distance validee, ou une
     regle de retour a vide non renseignee, rend la quantite non verifiable :
     rien n'est estime. Les colonnes `trips.km_start` / `km_end` (jamais
     alimentees par un parcours) ne servent plus au controle.

  Ecriture : fonctions SECURITY DEFINER ; releves sous `has_module_write('trips')`,
  validation sous `has_module_write('contracts')` ; perimetre site de l'engin
  et du voyage. Idempotent.
*/

-- 1. Distances de reference
CREATE TABLE IF NOT EXISTS public.distances_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_depart_id uuid NOT NULL REFERENCES public.sites(id),
  site_arrivee_id uuid NOT NULL REFERENCES public.sites(id),
  distance_km numeric NOT NULL CHECK (distance_km > 0),
  source text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  CHECK (site_depart_id <> site_arrivee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_distances_reference_actives
  ON public.distances_reference(site_depart_id, site_arrivee_id) WHERE actif;

-- 2. Releves d'odometre
CREATE TABLE IF NOT EXISTS public.releves_compteur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  trip_id uuid REFERENCES public.trips(id),
  moment text NOT NULL CHECK (moment IN ('depart_charge', 'arrivee_depot', 'fin_rotation', 'autre')),
  valeur_km numeric NOT NULL CHECK (valeur_km >= 0),
  releve_le timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('fiche', 'saisie', 'photo', 'gps')),
  reference_piece text,
  remplace_releve_id uuid UNIQUE REFERENCES public.releves_compteur(id),
  motif text,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now(),
  CHECK (remplace_releve_id IS NULL OR motif IS NOT NULL),
  CHECK (moment = 'autre' OR trip_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_releves_compteur_engin ON public.releves_compteur(vehicle_id, releve_le);
CREATE INDEX IF NOT EXISTS idx_releves_compteur_voyage ON public.releves_compteur(trip_id);

-- Releves en vigueur : non remplaces par une correction.
CREATE OR REPLACE VIEW public.v_releves_compteur WITH (security_invoker = true) AS
SELECT r.* FROM public.releves_compteur r
 WHERE NOT EXISTS (SELECT 1 FROM public.releves_compteur c WHERE c.remplace_releve_id = r.id);

-- 3. Distances validees (versions)
CREATE TABLE IF NOT EXISTS public.distances_voyage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  version integer NOT NULL CHECK (version >= 1),
  distance_reference_km numeric,
  distance_declaree_km numeric CHECK (distance_declaree_km IS NULL OR distance_declaree_km >= 0),
  mesure_charge_km numeric,
  mesure_retour_km numeric,
  validee_charge_km numeric NOT NULL CHECK (validee_charge_km >= 0),
  validee_retour_km numeric CHECK (validee_retour_km IS NULL OR validee_retour_km >= 0),
  motif text,
  valide_par uuid REFERENCES auth.users(id),
  valide_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, version)
);

CREATE OR REPLACE VIEW public.v_distances_voyage WITH (security_invoker = true) AS
SELECT DISTINCT ON (d.trip_id) d.* FROM public.distances_voyage d ORDER BY d.trip_id, d.version DESC;

ALTER TABLE public.contrat_tarifs ADD COLUMN IF NOT EXISTS km_retour_vide_facturable boolean;
COMMENT ON COLUMN public.contrat_tarifs.km_retour_vide_facturable IS
  'Tarif au km : true = retour a vide facture, false = trajet charge seulement, NULL = regle a confirmer (aucun calcul).';

-- 4. Droits
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['distances_reference', 'releves_compteur', 'distances_voyage'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
GRANT SELECT ON public.v_releves_compteur, public.v_distances_voyage TO authenticated;

DROP POLICY IF EXISTS lecture ON public.distances_reference;
CREATE POLICY lecture ON public.distances_reference FOR SELECT TO authenticated
  USING (public.has_module_view('trips') OR public.has_module_view('contracts') OR public.is_admin());
GRANT INSERT (id, site_depart_id, site_arrivee_id, distance_km, source, actif, cree_par), UPDATE (actif)
  ON public.distances_reference TO authenticated;
DROP POLICY IF EXISTS creation ON public.distances_reference;
CREATE POLICY creation ON public.distances_reference FOR INSERT TO authenticated
  WITH CHECK (public.has_module_write('contracts') OR public.is_admin());
DROP POLICY IF EXISTS desactivation ON public.distances_reference;
CREATE POLICY desactivation ON public.distances_reference FOR UPDATE TO authenticated
  USING (public.has_module_write('contracts') OR public.is_admin())
  WITH CHECK (public.has_module_write('contracts') OR public.is_admin());

DROP POLICY IF EXISTS lecture ON public.releves_compteur;
CREATE POLICY lecture ON public.releves_compteur FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('contracts'))
         AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.site_permis(v.site_id)));
DROP POLICY IF EXISTS lecture ON public.distances_voyage;
CREATE POLICY lecture ON public.distances_voyage FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('contracts'))
         AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id
                       AND (public.site_permis(t.departure_site_id) OR public.site_permis(t.arrival_site_id))));

-- 5. Saisie et correction des releves
CREATE OR REPLACE FUNCTION public.controle_releve_compteur(
  p_vehicle_id uuid, p_valeur numeric, p_quand timestamptz, p_exclure uuid
) RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE v_prec record; v_suiv record;
BEGIN
  SELECT r.valeur_km, r.releve_le INTO v_prec FROM public.v_releves_compteur r
   WHERE r.vehicle_id = p_vehicle_id AND r.releve_le <= p_quand AND r.id IS DISTINCT FROM p_exclure
   ORDER BY r.releve_le DESC LIMIT 1;
  IF FOUND AND p_valeur < v_prec.valeur_km THEN
    RAISE EXCEPTION 'Releve incoherent : % km est inferieur au releve precedent (% km le %)',
      p_valeur, v_prec.valeur_km, to_char(v_prec.releve_le AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI') USING ERRCODE = '22023';
  END IF;
  SELECT r.valeur_km, r.releve_le INTO v_suiv FROM public.v_releves_compteur r
   WHERE r.vehicle_id = p_vehicle_id AND r.releve_le > p_quand AND r.id IS DISTINCT FROM p_exclure
   ORDER BY r.releve_le ASC LIMIT 1;
  IF FOUND AND p_valeur > v_suiv.valeur_km THEN
    RAISE EXCEPTION 'Releve incoherent : % km depasse le releve suivant (% km le %)',
      p_valeur, v_suiv.valeur_km, to_char(v_suiv.releve_le AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI') USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.controle_releve_compteur(uuid, numeric, timestamptz, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.saisir_releve_compteur(
  p_vehicle_id uuid, p_trip_id uuid, p_moment text, p_valeur numeric, p_quand timestamptz,
  p_source text DEFAULT 'saisie', p_reference text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v public.vehicles; t public.trips; v_id uuid;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.vehicles WHERE id = p_vehicle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Engin introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT public.site_permis(v.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF p_moment NOT IN ('depart_charge', 'arrivee_depot', 'fin_rotation', 'autre') THEN
    RAISE EXCEPTION 'Moment de releve inconnu' USING ERRCODE = '22023';
  END IF;
  IF p_source NOT IN ('fiche', 'saisie', 'photo', 'gps') THEN
    RAISE EXCEPTION 'Source de releve inconnue' USING ERRCODE = '22023';
  END IF;
  IF p_valeur IS NULL OR p_valeur < 0 THEN
    RAISE EXCEPTION 'Valeur du compteur positive requise' USING ERRCODE = '22023';
  END IF;
  IF p_quand IS NULL OR p_quand > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure du releve requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_moment <> 'autre' THEN
    IF p_trip_id IS NULL THEN RAISE EXCEPTION 'Voyage requis pour ce moment de releve' USING ERRCODE = '22023'; END IF;
    SELECT * INTO t FROM public.trips WHERE id = p_trip_id;
    IF NOT FOUND OR t.vehicle_id IS DISTINCT FROM p_vehicle_id THEN
      RAISE EXCEPTION 'Voyage introuvable ou affecte a un autre engin' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.v_releves_compteur WHERE trip_id = p_trip_id AND moment = p_moment) THEN
      RAISE EXCEPTION 'Releve % deja saisi pour ce voyage : corrigez-le', p_moment USING ERRCODE = '22023';
    END IF;
  END IF;
  PERFORM public.controle_releve_compteur(p_vehicle_id, p_valeur, p_quand, NULL);
  INSERT INTO public.releves_compteur (vehicle_id, trip_id, moment, valeur_km, releve_le, source, reference_piece, saisi_par)
  VALUES (p_vehicle_id, p_trip_id, p_moment, p_valeur, p_quand, p_source,
          nullif(btrim(coalesce(p_reference, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.corriger_releve_compteur(p_id uuid, p_valeur numeric, p_motif text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.releves_compteur; v public.vehicles; v_id uuid; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif de correction requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO r FROM public.releves_compteur WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM public.releves_compteur WHERE remplace_releve_id = p_id) THEN
    RAISE EXCEPTION 'Releve introuvable ou deja corrige' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM public.vehicles WHERE id = r.vehicle_id;
  IF NOT public.site_permis(v.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF p_valeur IS NULL OR p_valeur < 0 THEN
    RAISE EXCEPTION 'Valeur du compteur positive requise' USING ERRCODE = '22023';
  END IF;
  PERFORM public.controle_releve_compteur(r.vehicle_id, p_valeur, r.releve_le, r.id);
  INSERT INTO public.releves_compteur (vehicle_id, trip_id, moment, valeur_km, releve_le, source, reference_piece,
    remplace_releve_id, motif, saisi_par)
  VALUES (r.vehicle_id, r.trip_id, r.moment, p_valeur, r.releve_le, r.source, r.reference_piece, r.id, v_motif, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 6. Mesures d'un voyage (lecture, perimetre des tables appliquee).
CREATE OR REPLACE FUNCTION public.mesures_voyage(p_trip_id uuid)
RETURNS TABLE (mesure_charge_km numeric, mesure_retour_km numeric, distance_reference_km numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH r AS (
    SELECT max(valeur_km) FILTER (WHERE moment = 'depart_charge') AS dep,
           max(valeur_km) FILTER (WHERE moment = 'arrivee_depot') AS arr,
           max(valeur_km) FILTER (WHERE moment = 'fin_rotation') AS fin
      FROM public.v_releves_compteur WHERE trip_id = p_trip_id
  )
  SELECT CASE WHEN r.arr >= r.dep THEN r.arr - r.dep END,
         CASE WHEN r.fin >= r.arr THEN r.fin - r.arr END,
         (SELECT d.distance_km FROM public.trips t JOIN public.distances_reference d
             ON d.site_depart_id = t.departure_site_id AND d.site_arrivee_id = t.arrival_site_id AND d.actif
           WHERE t.id = p_trip_id)
    FROM r;
$$;
GRANT EXECUTE ON FUNCTION public.mesures_voyage(uuid) TO authenticated;

-- 7. Validation de la distance d'un voyage
CREATE OR REPLACE FUNCTION public.valider_distance_voyage(
  p_trip_id uuid, p_charge_km numeric, p_retour_km numeric DEFAULT NULL,
  p_declaree_km numeric DEFAULT NULL, p_motif text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.trips; m record; v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_version integer;
        v_separee boolean;
BEGIN
  IF NOT public.has_module_write('contracts') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis pour valider une distance' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT (public.site_permis(t.departure_site_id) OR public.site_permis(t.arrival_site_id)) THEN
    RAISE EXCEPTION 'Hors perimetre : voyage d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF t.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED') THEN
    RAISE EXCEPTION 'Seul un voyage livre recoit une distance validee' USING ERRCODE = '22023';
  END IF;
  IF p_charge_km IS NULL OR p_charge_km < 0 OR (p_retour_km IS NOT NULL AND p_retour_km < 0) THEN
    RAISE EXCEPTION 'Distances positives requises' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce((SELECT (s.value ->> 'value') <> 'false' FROM public.settings s
                    WHERE s.key = 'kilometrage_validation_separee'), true) INTO v_separee;
  IF v_separee AND EXISTS (SELECT 1 FROM public.v_releves_compteur r WHERE r.trip_id = p_trip_id AND r.saisi_par = auth.uid()) THEN
    RAISE EXCEPTION 'La validation revient a une autre personne que l''auteur des releves' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO m FROM public.mesures_voyage(p_trip_id);
  IF (m.mesure_charge_km IS DISTINCT FROM p_charge_km
      OR (p_retour_km IS NOT NULL AND m.mesure_retour_km IS DISTINCT FROM p_retour_km))
     AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Distance differente de la mesure ou mesure absente : motif requis' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(max(version), 0) + 1 INTO v_version FROM public.distances_voyage WHERE trip_id = p_trip_id;
  INSERT INTO public.distances_voyage (trip_id, version, distance_reference_km, distance_declaree_km, mesure_charge_km,
    mesure_retour_km, validee_charge_km, validee_retour_km, motif, valide_par)
  VALUES (p_trip_id, v_version, m.distance_reference_km, p_declaree_km, m.mesure_charge_km, m.mesure_retour_km,
          p_charge_km, p_retour_km, v_motif, auth.uid());
  RETURN v_version;
END;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'saisir_releve_compteur(uuid, uuid, text, numeric, timestamptz, text, text)',
    'corriger_releve_compteur(uuid, numeric, text)',
    'valider_distance_voyage(uuid, numeric, numeric, numeric, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;

-- 8. Controle des factures du loueur : kilometres = distances facturables.
CREATE OR REPLACE FUNCTION public.controler_facture_fournisseur(p_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.factures_fournisseur;
  v_version uuid;
  l public.factures_fournisseur_lignes;
  v_quantite numeric;
  v_unite text;
  v_taux numeric;
  v_arret numeric;
  v_constat text;
  v_unite_facturee text;
  v_retour boolean;
  v_livres integer;
  v_valides integer;
  v_charge numeric;
  v_retour_km numeric;
  v_sans_retour integer;
BEGIN
  IF NOT public.has_module_write('contracts') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.factures_fournisseur WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR f.statut NOT IN ('saisie', 'controlee') THEN
    RAISE EXCEPTION 'Facture introuvable ou deja notifiee' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.factures_fournisseur_lignes WHERE facture_id = p_id) THEN
    RAISE EXCEPTION 'Saisir les lignes de la facture avant le controle' USING ERRCODE = '22023';
  END IF;
  SELECT v.id INTO v_version FROM public.contrat_versions v
  WHERE v.contrat_id = f.contrat_id AND v.date_effet <= f.periode_fin ORDER BY v.numero DESC LIMIT 1;

  FOR l IN SELECT * FROM public.factures_fournisseur_lignes WHERE facture_id = p_id LOOP
    v_constat := NULL;
    v_quantite := NULL;
    v_unite := NULL;
    v_taux := NULL;
    v_arret := NULL;
    v_retour := NULL;
    -- Lignes v1 : quantite non renseignee mais heures presentes = heures.
    v_unite_facturee := coalesce(l.unite_facturee,
                                 CASE WHEN l.quantite_facturee IS NOT NULL THEN NULL ELSE 'heure' END);
    IF l.vehicle_id IS NULL THEN
      v_constat := 'Ligne sans engin : non controlee';
    ELSE
      -- Tarif de l'engin : par engin d'abord, puis categorie (D-033).
      SELECT t.prix, t.unite, t.km_retour_vide_facturable INTO v_taux, v_unite, v_retour
        FROM public.contrat_tarifs t
       WHERE t.version_id = v_version
         AND (t.engin = l.vehicle_id
              OR (t.engin IS NULL AND t.categorie_materiel IS NOT NULL
                  AND l.categorie_materiel IS NOT NULL
                  AND lower(t.categorie_materiel) = lower(l.categorie_materiel)))
       ORDER BY (t.engin IS NOT DISTINCT FROM l.vehicle_id) DESC, t.ordre
       LIMIT 1;
      IF v_taux IS NULL THEN
        -- Tarif unique de la version (sans engin ni categorie) : retenu
        -- seulement s'il est seul, pour ne pas choisir arbitrairement.
        SELECT CASE WHEN count(*) = 1 THEN max(prix) END,
               CASE WHEN count(*) = 1 THEN max(unite) END,
               CASE WHEN count(*) = 1 THEN bool_and(km_retour_vide_facturable) END
          INTO v_taux, v_unite, v_retour
          FROM public.contrat_tarifs
         WHERE version_id = v_version AND engin IS NULL AND categorie_materiel IS NULL;
      END IF;

      IF v_unite = 'heure' THEN
        SELECT sum(p.heures_marche) INTO v_quantite FROM public.pointages_engins p
        JOIN public.fiches_terrain fi ON fi.id = p.fiche_id
        WHERE p.vehicle_id = l.vehicle_id AND fi.date_fiche BETWEEN f.periode_debut AND f.periode_fin;
        SELECT sum(heures) INTO v_arret FROM public.heures_immobilisation(f.periode_debut::timestamptz, (f.periode_fin + 1)::timestamptz) h
        WHERE h.vehicle_id = l.vehicle_id AND h.imputation = 'loueur';
        IF v_quantite IS NULL THEN v_constat := 'Aucun pointage sur la periode : heures non verifiables'; END IF;
      ELSIF v_unite = 'km' THEN
        -- Distances facturables des voyages livres (D-043) : rien n'est
        -- estime si une distance validee ou la regle du retour manque.
        SELECT count(*)::integer, count(d.trip_id)::integer, sum(d.validee_charge_km), sum(d.validee_retour_km),
               (count(*) FILTER (WHERE d.trip_id IS NOT NULL AND d.validee_retour_km IS NULL))::integer
          INTO v_livres, v_valides, v_charge, v_retour_km, v_sans_retour
          FROM public.trips t LEFT JOIN public.v_distances_voyage d ON d.trip_id = t.id
         WHERE t.vehicle_id = l.vehicle_id AND t.planned_date BETWEEN f.periode_debut AND f.periode_fin
           AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED');
        IF v_livres = 0 THEN
          v_constat := 'Aucun voyage livre sur la periode : kilometres non verifiables';
        ELSIF v_valides < v_livres THEN
          v_constat := format('%s voyage(s) livre(s) sans distance validee : kilometres non verifiables', v_livres - v_valides);
        ELSIF v_retour IS NULL THEN
          v_constat := 'Regle du retour a vide non renseignee au tarif : kilometres non verifiables';
        ELSIF v_retour AND v_sans_retour > 0 THEN
          v_constat := format('%s voyage(s) sans distance de retour validee : kilometres non verifiables', v_sans_retour);
        ELSE
          v_quantite := v_charge + CASE WHEN v_retour THEN coalesce(v_retour_km, 0) ELSE 0 END;
        END IF;
      ELSIF v_unite IS NOT NULL THEN
        v_constat := concat_ws(' ; ', v_constat,
          format('Unite %s du tarif : controle automatique non prevu', v_unite));
      END IF;

      IF v_taux IS NULL THEN
        v_constat := concat_ws(' ; ', v_constat, 'Tarif du contrat introuvable pour cet engin');
      END IF;
      IF v_unite_facturee IS NOT NULL AND v_unite IS NOT NULL AND v_unite_facturee <> v_unite THEN
        v_constat := concat_ws(' ; ', v_constat,
          format('Facturee en %s, contrat en %s : quantites non comparables', v_unite_facturee, v_unite));
      END IF;
    END IF;

    UPDATE public.factures_fournisseur_lignes SET
      quantite_attendue = round(v_quantite, 2),
      unite_attendue = v_unite,
      heures_attendues = CASE WHEN v_unite = 'heure' THEN round(v_quantite, 2) END,
      taux_attendu = v_taux, heures_arret_loueur = round(v_arret, 2),
      montant_attendu = CASE WHEN v_quantite IS NOT NULL AND v_taux IS NOT NULL THEN round(v_quantite * v_taux, 2) END,
      ecart = CASE WHEN v_quantite IS NOT NULL AND v_taux IS NOT NULL THEN round(l.montant_facture - v_quantite * v_taux, 2) END,
      constat = v_constat
    WHERE id = l.id;
  END LOOP;

  UPDATE public.factures_fournisseur SET
    statut = 'controlee', controle_le = now(), controle_par = auth.uid(),
    montant_attendu = (SELECT sum(montant_attendu) FROM public.factures_fournisseur_lignes WHERE facture_id = p_id),
    ecart_total = (SELECT sum(ecart) FROM public.factures_fournisseur_lignes WHERE facture_id = p_id),
    montant_reclame = (SELECT coalesce(sum(ecart) FILTER (WHERE ecart > 0), 0) FROM public.factures_fournisseur_lignes WHERE facture_id = p_id)
  WHERE id = p_id;
  RETURN (SELECT montant_reclame FROM public.factures_fournisseur WHERE id = p_id);
END;
$$;


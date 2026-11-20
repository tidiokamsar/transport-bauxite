/*
  # Fiches de tranche T5, vague 1 (D-104) : FIMM, FRET, FM, FSEC, FACC, FINC, FENV

  Sept nouvelles familles deviennent des fiches du cycle (D-089), point
  d'entree de la saisie terrain, chacune rattachee a ses fonctions metier
  EXISTANTES — aucune nouvelle table metier, aucune double saisie :

  - FIMM  immobilisation  -> declarer_immobilisation (D-025)
  - FRET  retour atelier  -> cloturer_immobilisation (D-025)
  - FM    intervention loueur -> demander_intervention_loueur (D-049)
  - FSEC  constat securite   -> declarer_incident type 'securite'  (D-054)
  - FACC  accident           -> declarer_incident type 'accident'  (D-054)
  - FINC  incident           -> declarer_incident type 'materiel'  (D-054)
  - FENV  environnement     -> declarer_incident type 'environnement' (D-054)

  Principe : la fiche suit le cycle complet (preparation, impression,
  remise/retour, saisie, controle, validation, journal) ; a la SAISIE, la
  ligne appelle la fonction metier dans la meme transaction ; les ecrans
  web existants gardent la supervision (listes, validation, rapports).

  Extensions :
  1. Contrainte de type etendue (7 nouveaux codes internes).
  2. fiche_module : module de droits de chaque nouveau type.
  3. fiche_numero_suivant : prefixes FIMM, FRET, FM, FSEC, FACC, FINC, FENV.
  4. saisir_ligne_fiche : dispatch par type vers la fonction metier, avec
     verifications du cycle (fiche_saisissable), journal et ecarts.
  5. Catalogue : les 7 familles passent 'deployee'.

  Idempotent : ALTER / CREATE OR REPLACE / UPDATE catalogue garde.
*/

-- 1. Types de fiches etendus.
ALTER TABLE public.fiches_terrain DROP CONSTRAINT IF EXISTS fiches_terrain_type_check;
ALTER TABLE public.fiches_terrain ADD CONSTRAINT fiches_terrain_type_check CHECK (type IN (
  'rotations', 'pointage_engins', 'carburant',
  'immobilisation', 'retour_atelier', 'intervention_loueur',
  'securite', 'accident', 'incident', 'environnement'));

-- 2. Module de droits par type.
CREATE OR REPLACE FUNCTION public.fiche_module(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_type
           WHEN 'rotations' THEN 'trips'
           WHEN 'pointage_engins' THEN 'maintenance'
           WHEN 'carburant' THEN 'fuel'
           WHEN 'immobilisation' THEN 'maintenance'
           WHEN 'retour_atelier' THEN 'maintenance'
           WHEN 'intervention_loueur' THEN 'maintenance'
           WHEN 'securite' THEN 'reports'
           WHEN 'accident' THEN 'reports'
           WHEN 'incident' THEN 'reports'
           WHEN 'environnement' THEN 'reports'
         END;
$$;

-- 3. Numerotation etendue : memes prefixe-sequence que le cycle (YYMMDD-NNN),
--    sept nouveaux prefixes.
CREATE OR REPLACE FUNCTION public.fiche_numero_suivant(p_type text, p_date date)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_prefixe text; v_suite integer;
BEGIN
  v_prefixe := CASE p_type
                 WHEN 'rotations' THEN 'FR'
                 WHEN 'pointage_engins' THEN 'FP'
                 WHEN 'carburant' THEN 'FC'
                 WHEN 'immobilisation' THEN 'FIMM'
                 WHEN 'retour_atelier' THEN 'FRET'
                 WHEN 'intervention_loueur' THEN 'FM'
                 WHEN 'securite' THEN 'FSEC'
                 WHEN 'accident' THEN 'FACC'
                 WHEN 'incident' THEN 'FINC'
                 WHEN 'environnement' THEN 'FENV'
               END
               || '-' || to_char(p_date, 'YYMMDD') || '-';
  IF v_prefixe LIKE '%-' THEN v_prefixe := v_prefixe; ELSE v_prefixe := v_prefixe; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.fiche.' || v_prefixe));
  SELECT coalesce(max(substring(numero FROM '-(\d+)$')::int), 0) + 1 INTO v_suite
    FROM public.fiches_terrain WHERE numero LIKE v_prefixe || '%';
  RETURN v_prefixe || lpad(v_suite::text, 3, '0');
END;
$$;

-- 4. Creation des fiches metier (sept nouveaux types) : fonction separee,
--    le creer_fiche du cycle (D-089) reste intact pour FR/FP/FC.
CREATE OR REPLACE FUNCTION public.creer_fiche_metier(
  p_type text, p_date date, p_site_id uuid, p_vehicle_id uuid DEFAULT NULL,
  p_driver_id uuid DEFAULT NULL, p_agent text DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid; v_numero text;
BEGIN
  IF p_type NOT IN ('immobilisation', 'retour_atelier', 'intervention_loueur',
                    'securite', 'accident', 'incident', 'environnement') THEN
    RAISE EXCEPTION 'Type de fiche metier inconnu : %', p_type USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_module_write(public.fiche_module(p_type)) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis sur %', public.fiche_module(p_type) USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_site_id IS NULL THEN
    RAISE EXCEPTION 'Date et site requis' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise' USING ERRCODE = '42501';
  END IF;
  IF p_vehicle_id IS NOT NULL AND NOT public.vehicule_permis(p_vehicle_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  v_numero := public.fiche_numero_suivant(p_type, p_date);
  INSERT INTO public.fiches_terrain (numero, type, date_fiche, site_id,
                                    vehicle_id, driver_id, agent, note, origine, etat)
  VALUES (v_numero, p_type, p_date, p_site_id,
          p_vehicle_id, p_driver_id, nullif(btrim(coalesce(p_agent, '')), ''),
          nullif(btrim(coalesce(p_note, '')), ''), 'creation', 'preparee')
  RETURNING id INTO v_id;
  INSERT INTO public.fiches_journal (fiche_id, action, etat_apres, auteur)
  VALUES (v_id, 'creation', 'preparee', auth.uid());
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.creer_fiche_metier(text, date, uuid, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creer_fiche_metier(text, date, uuid, uuid, uuid, text, text) TO authenticated, service_role;

-- 4bis. Graphe de transition etendu : une fiche metier peut etre saisie
--        directement apres creation (sans cycle papier).
CREATE OR REPLACE FUNCTION public.transition_fiche_autorisee(p_de text, p_vers text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (p_de, p_vers) IN (
    ('a_preparer', 'preparee'), ('a_preparer', 'annulee'),
    ('preparee', 'a_imprimer'), ('preparee', 'imprimee'), ('preparee', 'remise_agent'), ('preparee', 'annulee'),
    ('preparee', 'saisie_en_cours'),
    ('a_imprimer', 'imprimee'), ('a_imprimer', 'annulee'),
    ('imprimee', 'a_remettre'), ('imprimee', 'remise_agent'), ('imprimee', 'annulee'),
    ('a_remettre', 'remise_agent'), ('a_remettre', 'annulee'),
    ('remise_agent', 'en_utilisation'), ('remise_agent', 'retournee'), ('remise_agent', 'annulee'),
    ('en_utilisation', 'retournee'), ('en_utilisation', 'annulee'),
    ('retournee', 'a_saisir'), ('retournee', 'saisie_en_cours'), ('retournee', 'saisie_terminee'), ('retournee', 'annulee'),
    ('a_saisir', 'saisie_en_cours'), ('a_saisir', 'saisie_terminee'), ('a_saisir', 'annulee'),
    ('saisie_en_cours', 'saisie_terminee'), ('saisie_en_cours', 'annulee'),
    ('saisie_terminee', 'a_controler'), ('saisie_terminee', 'saisie_en_cours'), ('saisie_terminee', 'annulee'),
    ('a_controler', 'validee'), ('a_controler', 'a_corriger'),
    ('a_corriger', 'saisie_en_cours'), ('a_corriger', 'saisie_terminee'), ('a_corriger', 'annulee'),
    ('validee', 'archivee'));
$$;

-- 5. Saisie d'une ligne : dispatch vers la fonction metier existante.
CREATE OR REPLACE FUNCTION public.saisir_ligne_fiche(
  p_fiche_id uuid, p_rang integer, p_ligne jsonb, p_motif_correction text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain;
  v_id uuid;
BEGIN
  SELECT * INTO f FROM public.fiches_terrain WHERE id = p_fiche_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiche introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF f.etat NOT IN ('preparee', 'a_saisir', 'saisie_en_cours', 'a_corriger', 'retournee') THEN
    RAISE EXCEPTION 'Fiche % a l''etat % : non saisissable', f.numero, f.etat USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_module_write(public.fiche_module(f.type)) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis pour ce type de fiche' USING ERRCODE = '42501';
  END IF;
  IF NOT public.site_permis(f.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site de la fiche non autorise' USING ERRCODE = '42501';
  END IF;

  CASE f.type
    WHEN 'immobilisation' THEN
      v_id := public.declarer_immobilisation(
        (p_ligne ->> 'vehicle_id')::uuid,
        (p_ligne ->> 'debut')::timestamptz,
        p_ligne ->> 'cause',
        p_ligne ->> 'imputation',
        coalesce(p_ligne ->> 'description', 'Fiche ' || f.numero),
        p_ligne ->> 'reference_loueur');
    WHEN 'retour_atelier' THEN
      PERFORM public.cloturer_immobilisation(
        (p_ligne ->> 'immobilisation_id')::uuid,
        (p_ligne ->> 'fin')::timestamptz,
        coalesce(p_ligne ->> 'note', 'Retour atelier, fiche ' || f.numero));
      v_id := (p_ligne ->> 'immobilisation_id')::uuid;
    WHEN 'intervention_loueur' THEN
      v_id := public.demander_intervention_loueur(
        (p_ligne ->> 'immobilisation_id')::uuid,
        (p_ligne ->> 'quand')::timestamptz,
        coalesce(p_ligne ->> 'canal', 'telephone'),
        p_ligne ->> 'description',
        p_ligne ->> 'reference',
        (p_ligne ->> 'delai_contractuel_heures')::numeric);
    WHEN 'securite' THEN
      v_id := public.declarer_incident('securite', (p_ligne ->> 'gravite')::public.incident_severity, p_ligne ->> 'description',
        (p_ligne ->> 'survenu_le')::timestamptz,
        (p_ligne ->> 'vehicle_id')::uuid, (p_ligne ->> 'driver_id')::uuid, NULL, f.site_id,
        p_ligne ->> 'lieu');
    WHEN 'accident' THEN
      v_id := public.declarer_incident('accident', (p_ligne ->> 'gravite')::public.incident_severity, p_ligne ->> 'description',
        (p_ligne ->> 'survenu_le')::timestamptz,
        (p_ligne ->> 'vehicle_id')::uuid, (p_ligne ->> 'driver_id')::uuid, NULL, f.site_id,
        p_ligne ->> 'lieu');
    WHEN 'incident' THEN
      v_id := public.declarer_incident('materiel', (p_ligne ->> 'gravite')::public.incident_severity, p_ligne ->> 'description',
        (p_ligne ->> 'survenu_le')::timestamptz,
        (p_ligne ->> 'vehicle_id')::uuid, (p_ligne ->> 'driver_id')::uuid, NULL, f.site_id,
        p_ligne ->> 'lieu');
    WHEN 'environnement' THEN
      v_id := public.declarer_incident('environnement', (p_ligne ->> 'gravite')::public.incident_severity, p_ligne ->> 'description',
        (p_ligne ->> 'survenu_le')::timestamptz,
        (p_ligne ->> 'vehicle_id')::uuid, (p_ligne ->> 'driver_id')::uuid, NULL, f.site_id,
        p_ligne ->> 'lieu');
    ELSE
      RAISE EXCEPTION 'Saisie non prevue pour le type % : utiliser la fonction dediee', f.type USING ERRCODE = '22023';
  END CASE;

  -- Drapeau de transition du cycle, puis avancement d'etat si requis.
  PERFORM set_config('sigtb.transition_fiche', 'on', true);
  -- Trace de la ligne dans le contenu de la fiche (journal du cycle).
  UPDATE public.fiches_terrain
     SET contenu = contenu || jsonb_build_object(
           'rang', p_rang, 'ligne', p_ligne, 'objet_id', v_id,
           'saisi_le', now(), 'saisi_par', auth.uid())
   WHERE id = p_fiche_id;
  INSERT INTO public.fiches_journal (fiche_id, action, etat_avant, etat_apres, auteur)
  VALUES (p_fiche_id, 'saisie_ligne', f.etat, f.etat, auth.uid());
  IF f.etat IN ('preparee', 'a_saisir') THEN
    UPDATE public.fiches_terrain SET etat = 'saisie_en_cours' WHERE id = p_fiche_id;
  END IF;
  PERFORM set_config('sigtb.transition_fiche', 'off', true);
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.saisir_ligne_fiche(uuid, integer, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisir_ligne_fiche(uuid, integer, jsonb, text) TO authenticated, service_role;

-- 6. Liste blanche de synchronisation mobile etendue.
CREATE OR REPLACE FUNCTION public.synchroniser_saisies_mobile(p_operations jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  op jsonb; v_client text; v_fonction text; v_fiche uuid; v_params jsonb;
  v_statut text; v_res jsonb; v_archive jsonb; v_sorties jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active') THEN
    RAISE EXCEPTION 'Compte actif requis' USING ERRCODE = '42501';
  END IF;
  FOR op IN SELECT * FROM jsonb_array_elements(coalesce(p_operations, '[]'::jsonb)) LOOP
    v_client := nullif(btrim(coalesce(op ->> 'client_id', '')), '');
    v_fonction := op ->> 'fonction';
    v_fiche := (op ->> 'fiche_id')::uuid;
    v_params := coalesce(op -> 'params', '{}'::jsonb);
    IF v_client IS NULL OR v_fonction IS NULL THEN
      v_sorties := v_sorties || jsonb_build_object('client_id', op ->> 'client_id', 'statut', 'erreur',
        'resultat', jsonb_build_object('message', 'client_id et fonction requis'));
      CONTINUE;
    END IF;
    SELECT jsonb_build_object('statut', s.statut, 'resultat', s.resultat) INTO v_archive
      FROM public.sync_mobile_operations s WHERE s.client_id = v_client AND s.auteur = auth.uid();
    IF v_archive IS NOT NULL THEN
      v_sorties := v_sorties || jsonb_build_object('client_id', v_client, 'statut', 'rejouee',
        'resultat', v_archive -> 'resultat');
      CONTINUE;
    END IF;
    v_statut := 'ok';
    BEGIN
      CASE v_fonction
        WHEN 'saisir_ligne_rotation' THEN
          v_res := jsonb_build_object('id', public.saisir_ligne_rotation(v_fiche,
            (v_params ->> 'rang')::integer, v_params -> 'ligne',
            nullif(btrim(coalesce(v_params ->> 'motif_correction', '')), '')));
        WHEN 'saisir_pointage_fiche' THEN
          v_res := jsonb_build_object('id', public.saisir_pointage_fiche(v_fiche,
            (v_params ->> 'vehicle_id')::uuid, (v_params ->> 'index_debut')::numeric, (v_params ->> 'index_fin')::numeric,
            (v_params ->> 'heures_productives')::numeric, (v_params ->> 'periode_debut')::timestamptz,
            (v_params ->> 'periode_fin')::timestamptz, coalesce(v_params -> 'arrets', '[]'::jsonb),
            nullif(btrim(coalesce(v_params ->> 'operateur', '')), ''),
            nullif(btrim(coalesce(v_params ->> 'agent', '')), ''),
            nullif(btrim(coalesce(v_params ->> 'observations', '')), ''),
            nullif(btrim(coalesce(v_params ->> 'motif_correction', '')), '')));
        WHEN 'saisir_ligne_carburant' THEN
          v_res := jsonb_build_object('id', public.saisir_ligne_carburant(v_fiche,
            (v_params ->> 'rang')::integer, v_params -> 'ligne',
            nullif(btrim(coalesce(v_params ->> 'motif_correction', '')), '')));
        WHEN 'saisir_ligne_fiche' THEN
          v_res := jsonb_build_object('id', public.saisir_ligne_fiche(v_fiche,
            (v_params ->> 'rang')::integer, v_params -> 'ligne',
            nullif(btrim(coalesce(v_params ->> 'motif_correction', '')), '')));
        ELSE
          v_statut := 'erreur';
          v_res := jsonb_build_object('message', 'fonction inconnue ou interdite');
      END CASE;
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE IN ('42501', '22023', '23505', '23503', '40001') THEN v_statut := 'a_arbitrer';
      ELSE v_statut := 'erreur'; END IF;
      v_res := jsonb_build_object('code', SQLSTATE, 'message', SQLERRM);
    END;
    INSERT INTO public.sync_mobile_operations (client_id, fonction, fiche_id, auteur, statut, resultat)
    VALUES (v_client, v_fonction, v_fiche, auth.uid(), v_statut, v_res);
    v_sorties := v_sorties || jsonb_build_object('client_id', v_client, 'statut', v_statut, 'resultat', v_res);
  END LOOP;
  RETURN v_sorties;
END;
$$;

-- 7. Catalogue : les sept familles passent deployees.
UPDATE public.fiches_catalogue SET statut = 'deployee'
 WHERE code IN ('FIMM', 'FRET', 'FM', 'FSEC', 'FACC', 'FINC', 'FENV') AND version = 1;

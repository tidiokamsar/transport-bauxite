/*
  # Interventions du loueur sur les engins immobilises (D-049, lot 9,
  # modules 10 et 11 du mandat ; scenario « intervention Neemba en retard »)

  La maintenance des engins loues incombe a Neemba (D-022) : SIGTB trace la
  demande, la prise en charge, le rapport et la remise en service, sans
  transformer ces obligations en maintenance interne.

  1. `interventions_loueur` rattachee a une immobilisation ouverte imputee
     au loueur ou a determiner (D-025). Etats : demandee -> prise_en_charge
     -> terminee -> remise_validee ; un refus de remise en service renvoie a
     prise_en_charge avec motif.
  2. Delai : heure de prise en charge moins heure de la demande ; delai
     contractuel saisi a la demande (issu du contrat, jamais suppose) ; sans
     delai contractuel, le retard n'est pas evalue.
  3. `interventions_pieces` : pieces remplacees, fournies par le loueur ou
     l'exploitant (imputation des couts).
  4. Validation de la remise en service par une autre personne que celle
     qui a enregistre la fin : elle cloture l'immobilisation a l'heure de
     fin de l'intervention (`cloturer_immobilisation`, D-025).
  5. Journal append-only `interventions_journal`.

  Ecriture : fonctions serveur sous `has_module_write('maintenance')` et
  perimetre de l'engin. Idempotent.
*/

CREATE SEQUENCE IF NOT EXISTS public.interventions_loueur_numero_seq;

CREATE TABLE IF NOT EXISTS public.interventions_loueur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  immobilisation_id uuid NOT NULL REFERENCES public.immobilisations(id),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  statut text NOT NULL DEFAULT 'demandee' CHECK (statut IN ('demandee', 'prise_en_charge', 'terminee', 'remise_validee')),
  demande_le timestamptz NOT NULL,
  canal text NOT NULL CHECK (canal IN ('telephone', 'courriel', 'courrier', 'portail', 'sur_place')),
  reference_demande text,
  description text NOT NULL CHECK (btrim(description) <> ''),
  delai_contractuel_heures numeric CHECK (delai_contractuel_heures IS NULL OR delai_contractuel_heures > 0),
  technicien text,
  prise_en_charge_le timestamptz,
  fin_le timestamptz,
  rapport text,
  remise_validee_le timestamptz,
  demande_par uuid REFERENCES auth.users(id),
  fin_saisie_par uuid REFERENCES auth.users(id),
  valide_par uuid REFERENCES auth.users(id),
  CHECK (prise_en_charge_le IS NULL OR prise_en_charge_le >= demande_le),
  CHECK (fin_le IS NULL OR (prise_en_charge_le IS NOT NULL AND fin_le >= prise_en_charge_le))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_interventions_actives ON public.interventions_loueur(immobilisation_id) WHERE statut <> 'remise_validee';
CREATE INDEX IF NOT EXISTS idx_interventions_engin ON public.interventions_loueur(vehicle_id, demande_le DESC);

CREATE TABLE IF NOT EXISTS public.interventions_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions_loueur(id),
  designation text NOT NULL CHECK (btrim(designation) <> ''),
  reference text,
  quantite numeric NOT NULL CHECK (quantite > 0),
  fournie_par text NOT NULL CHECK (fournie_par IN ('loueur', 'exploitant'))
);

CREATE TABLE IF NOT EXISTS public.interventions_journal (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  intervention_id uuid NOT NULL REFERENCES public.interventions_loueur(id),
  action text NOT NULL,
  etat_avant text,
  etat_apres text,
  motif text,
  auteur uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.v_interventions_loueur WITH (security_invoker = true) AS
SELECT i.*,
       round(extract(epoch FROM (coalesce(i.prise_en_charge_le, now()) - i.demande_le)) / 3600, 1) AS delai_heures,
       CASE WHEN i.delai_contractuel_heures IS NULL THEN NULL
            ELSE extract(epoch FROM (coalesce(i.prise_en_charge_le, now()) - i.demande_le)) / 3600 > i.delai_contractuel_heures END AS en_retard,
       round(extract(epoch FROM (i.fin_le - i.prise_en_charge_le)) / 3600, 1) AS duree_intervention_heures
  FROM public.interventions_loueur i;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['interventions_loueur', 'interventions_pieces', 'interventions_journal'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
GRANT SELECT ON public.v_interventions_loueur TO authenticated;
DROP POLICY IF EXISTS lecture ON public.interventions_loueur;
CREATE POLICY lecture ON public.interventions_loueur FOR SELECT TO authenticated
  USING ((public.has_module_view('maintenance') OR public.has_module_view('contracts') OR public.is_admin())
         AND public.vehicule_permis(vehicle_id));
DROP POLICY IF EXISTS lecture ON public.interventions_pieces;
CREATE POLICY lecture ON public.interventions_pieces FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.interventions_loueur i WHERE i.id = intervention_id));
DROP POLICY IF EXISTS lecture ON public.interventions_journal;
CREATE POLICY lecture ON public.interventions_journal FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.interventions_loueur i WHERE i.id = intervention_id));

CREATE OR REPLACE FUNCTION public.intervention_ecrivable(p_id uuid, p_statut text)
RETURNS public.interventions_loueur
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.interventions_loueur;
BEGIN
  IF NOT public.has_module_write('maintenance') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la maintenance requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO i FROM public.interventions_loueur WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intervention introuvable' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.vehicule_permis(i.vehicle_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF i.statut <> p_statut THEN
    RAISE EXCEPTION 'Intervention % : action impossible a cet etat', i.statut USING ERRCODE = '22023';
  END IF;
  RETURN i;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.intervention_ecrivable(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.journaliser_intervention(p_id uuid, p_action text, p_avant text, p_apres text, p_motif text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.interventions_journal (intervention_id, action, etat_avant, etat_apres, motif, auteur)
  VALUES (p_id, p_action, p_avant, p_apres, nullif(btrim(coalesce(p_motif, '')), ''), auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.journaliser_intervention(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.demander_intervention_loueur(
  p_immobilisation_id uuid, p_quand timestamptz, p_canal text, p_description text,
  p_reference text DEFAULT NULL, p_delai_contractuel_heures numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m public.immobilisations; v_id uuid;
BEGIN
  IF NOT public.has_module_write('maintenance') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la maintenance requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO m FROM public.immobilisations WHERE id = p_immobilisation_id;
  IF NOT FOUND OR m.statut <> 'ouverte' THEN
    RAISE EXCEPTION 'Immobilisation ouverte introuvable' USING ERRCODE = '22023';
  END IF;
  IF m.imputation NOT IN ('loueur', 'a_determiner') THEN
    RAISE EXCEPTION 'Immobilisation imputee a l''exploitant : pas d''intervention du loueur' USING ERRCODE = '22023';
  END IF;
  IF NOT public.vehicule_permis(m.vehicle_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF p_quand IS NULL OR p_quand > now() + interval '5 minutes' OR p_quand < m.debut THEN
    RAISE EXCEPTION 'Heure de la demande requise, apres le debut de l''immobilisation et pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.interventions_loueur WHERE immobilisation_id = m.id AND statut <> 'remise_validee') THEN
    RAISE EXCEPTION 'Une intervention est deja en cours pour cette immobilisation' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.interventions_loueur (numero, immobilisation_id, vehicle_id, demande_le, canal, reference_demande, description,
    delai_contractuel_heures, demande_par)
  VALUES ('INT-' || to_char(p_quand, 'YYYY') || '-' || lpad(nextval('public.interventions_loueur_numero_seq')::text, 5, '0'),
    m.id, m.vehicle_id, p_quand, p_canal, nullif(btrim(coalesce(p_reference, '')), ''), btrim(coalesce(p_description, '')),
    p_delai_contractuel_heures, auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.journaliser_intervention(v_id, 'demande', NULL, 'demandee', NULL);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.prendre_en_charge_intervention(p_id uuid, p_quand timestamptz, p_technicien text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.interventions_loueur := public.intervention_ecrivable(p_id, 'demandee');
BEGIN
  IF p_quand IS NULL OR p_quand > now() + interval '5 minutes' OR p_quand < i.demande_le THEN
    RAISE EXCEPTION 'Heure de prise en charge requise, apres la demande et pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_technicien, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Technicien du loueur requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.interventions_loueur SET statut = 'prise_en_charge', prise_en_charge_le = p_quand, technicien = btrim(p_technicien) WHERE id = p_id;
  PERFORM public.journaliser_intervention(p_id, 'prise_en_charge', 'demandee', 'prise_en_charge', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.terminer_intervention(p_id uuid, p_quand timestamptz, p_rapport text, p_pieces jsonb DEFAULT '[]'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.interventions_loueur := public.intervention_ecrivable(p_id, 'prise_en_charge'); x jsonb;
BEGIN
  IF p_quand IS NULL OR p_quand > now() + interval '5 minutes' OR p_quand < i.prise_en_charge_le THEN
    RAISE EXCEPTION 'Heure de fin requise, apres la prise en charge et pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_rapport, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Rapport d''intervention requis' USING ERRCODE = '22023';
  END IF;
  FOR x IN SELECT v FROM jsonb_array_elements(coalesce(p_pieces, '[]'::jsonb)) AS t(v) LOOP
    INSERT INTO public.interventions_pieces (intervention_id, designation, reference, quantite, fournie_par)
    VALUES (p_id, x ->> 'designation', nullif(x ->> 'reference', ''), (x ->> 'quantite')::numeric, x ->> 'fournie_par');
  END LOOP;
  UPDATE public.interventions_loueur SET statut = 'terminee', fin_le = p_quand, rapport = btrim(p_rapport), fin_saisie_par = auth.uid() WHERE id = p_id;
  PERFORM public.journaliser_intervention(p_id, 'fin', 'prise_en_charge', 'terminee', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.valider_remise_en_service(p_id uuid, p_valider boolean, p_motif text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.interventions_loueur := public.intervention_ecrivable(p_id, 'terminee');
        v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF i.fin_saisie_par = auth.uid() THEN
    RAISE EXCEPTION 'La remise en service est validee par une autre personne que celle qui a saisi la fin' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(p_valider, false) THEN
    IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif du refus requis' USING ERRCODE = '22023'; END IF;
    UPDATE public.interventions_loueur SET statut = 'prise_en_charge', fin_le = NULL, fin_saisie_par = NULL WHERE id = p_id;
    PERFORM public.journaliser_intervention(p_id, 'remise_refusee', 'terminee', 'prise_en_charge', v_motif);
    RETURN 'prise_en_charge';
  END IF;
  PERFORM public.cloturer_immobilisation(i.immobilisation_id, i.fin_le,
    concat_ws(' : ', 'Remise en service validee, intervention ' || i.numero, v_motif));
  UPDATE public.interventions_loueur SET statut = 'remise_validee', remise_validee_le = now(), valide_par = auth.uid() WHERE id = p_id;
  PERFORM public.journaliser_intervention(p_id, 'remise_validee', 'terminee', 'remise_validee', v_motif);
  RETURN 'remise_validee';
END;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'demander_intervention_loueur(uuid, timestamptz, text, text, text, numeric)',
    'prendre_en_charge_intervention(uuid, timestamptz, text)',
    'terminer_intervention(uuid, timestamptz, text, jsonb)',
    'valider_remise_en_service(uuid, boolean, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;

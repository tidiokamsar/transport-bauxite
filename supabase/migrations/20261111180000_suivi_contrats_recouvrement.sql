/*
  # Suivi des engagements, rapport de performance, recouvrement, comites
  # (phase 4 du poste charge de contrats, D-031)

  Fiche de poste : « suivre les engagements de l'avenant » ; « produire le
  rapport de performance mensuel prevu a l'avenant » ; « suivre les
  recouvrements et conduire les relances » ; « tenir le dossier contractuel
  et preparer les comites de contrat » ; indicateurs de performance.

  1. `realise_engagements(du, au)` : mesures du terrain sur la periode
     (disponibilite, temps de chargement et de cycle, remplissage, rotations
     par camion et par jour, kilometres, litres par tonne et par heure),
     avec la taille de chaque echantillon. Null = non mesurable.
  2. `comparer_engagements(contrat, du, au)` : engagements de la version en
     vigueur a la fin de la periode, mesure retenue, conformite.
  3. `rapports_performance` : instantane fige par contrat et par mois
     (generer_rapport_performance), puis remise datee (marquer_rapport_remis).
  4. Recouvrement : `encaissements` (enregistrer_encaissement : facture
     emise, montant au plus le reste du), `relances` (relancer : niveau
     suivant, 3 = mise en demeure, apres l'echeance seulement), vue
     `v_creances` (du, encaisse, reste, retard, derniere relance).
  5. `comites_contrat`, `comite_actions`.
  6. `indicateurs_charge_contrats()` : indicateurs de la fiche de poste.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- 1. Mesures du terrain
CREATE OR REPLACE FUNCTION public.realise_engagements(p_du date, p_au date)
RETURNS TABLE (
  disponibilite_pct numeric, engins_observes integer,
  temps_chargement_min numeric, temps_cycle_min numeric, voyages_chronometres integer,
  taux_remplissage_pct numeric, voyages_peses integer,
  rotations_par_camion_jour numeric, camions_jours integer,
  km_parcourus numeric, voyages_km integer,
  litres_par_tonne numeric, litres_par_heure numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH livres AS (
    SELECT t.* FROM public.trips t
    WHERE t.planned_date BETWEEN p_du AND p_au AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
  ),
  temps AS (
    SELECT e.trip_id,
           extract(epoch FROM max(e.survenu_le) FILTER (WHERE e.etat_apres = 'LOADED')
                            - min(e.survenu_le) FILTER (WHERE e.etat_apres = 'LOADING')) / 60 AS chargement,
           extract(epoch FROM max(e.survenu_le) FILTER (WHERE e.etat_apres = 'DELIVERED')
                            - min(e.survenu_le) FILTER (WHERE e.etat_apres = 'AT_LOADING')) / 60 AS cycle
    FROM public.trip_events e WHERE e.trip_id IN (SELECT id FROM livres) GROUP BY e.trip_id
  ),
  fiab AS (SELECT * FROM public.fiabilite_engins(p_du::timestamptz, (p_au + 1)::timestamptz)),
  conso AS (SELECT * FROM public.consommation_carburant(p_du, p_au))
  SELECT
    (SELECT round(avg(disponibilite_pct), 1) FROM fiab WHERE disponibilite_pct IS NOT NULL),
    (SELECT count(*)::integer FROM fiab WHERE disponibilite_pct IS NOT NULL),
    (SELECT round(avg(chargement)::numeric, 1) FROM temps WHERE chargement > 0),
    (SELECT round(avg(cycle)::numeric, 1) FROM temps WHERE cycle > 0),
    (SELECT count(*)::integer FROM temps WHERE cycle > 0),
    (SELECT round(avg(coalesce(l.net_weight, l.load_weight) / v.capacity_tonnes * 100), 1)
       FROM livres l JOIN public.vehicles v ON v.id = l.vehicle_id
      WHERE coalesce(l.net_weight, l.load_weight) IS NOT NULL AND v.capacity_tonnes > 0),
    (SELECT count(*)::integer FROM livres l JOIN public.vehicles v ON v.id = l.vehicle_id
      WHERE coalesce(l.net_weight, l.load_weight) IS NOT NULL AND v.capacity_tonnes > 0),
    (SELECT round(count(*)::numeric / nullif(count(DISTINCT (vehicle_id, planned_date)), 0), 2) FROM livres WHERE vehicle_id IS NOT NULL),
    (SELECT count(DISTINCT (vehicle_id, planned_date))::integer FROM livres WHERE vehicle_id IS NOT NULL),
    (SELECT round(sum(km_end - km_start), 1) FROM livres WHERE km_end IS NOT NULL AND km_start IS NOT NULL AND km_end >= km_start),
    (SELECT count(*)::integer FROM livres WHERE km_end IS NOT NULL AND km_start IS NOT NULL AND km_end >= km_start),
    (SELECT round(sum(litres) FILTER (WHERE tonnes > 0) / nullif(sum(tonnes) FILTER (WHERE tonnes > 0), 0), 3) FROM conso),
    (SELECT round(sum(litres) FILTER (WHERE heures_marche > 0) / nullif(sum(heures_marche) FILTER (WHERE heures_marche > 0), 0), 2) FROM conso);
$$;

-- 2. Engagements compares au realise
CREATE OR REPLACE FUNCTION public.comparer_engagements(p_contrat_id uuid, p_du date, p_au date)
RETURNS TABLE (
  engagement_id uuid, indicateur text, libelle text, seuil numeric, unite text, sens text, periodicite text,
  consequence text, realise numeric, echantillon integer, conforme boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH version AS (
    SELECT v.id FROM public.contrat_versions v
    WHERE v.contrat_id = p_contrat_id AND v.date_effet <= p_au ORDER BY v.numero DESC LIMIT 1
  ),
  r AS (SELECT * FROM public.realise_engagements(p_du, p_au)),
  e AS (
    SELECT g.*,
      CASE g.indicateur
        WHEN 'disponibilite' THEN r.disponibilite_pct
        WHEN 'temps_chargement' THEN r.temps_chargement_min
        WHEN 'temps_cycle' THEN r.temps_cycle_min
        WHEN 'taux_remplissage' THEN r.taux_remplissage_pct
        WHEN 'rotations' THEN r.rotations_par_camion_jour
        WHEN 'km_facturable' THEN r.km_parcourus
        WHEN 'reference_carburant' THEN CASE WHEN g.unite ILIKE '%/t%' THEN r.litres_par_tonne
                                             WHEN g.unite ILIKE '%/h%' THEN r.litres_par_heure END
      END AS mesure,
      CASE g.indicateur
        WHEN 'disponibilite' THEN r.engins_observes
        WHEN 'temps_chargement' THEN r.voyages_chronometres
        WHEN 'temps_cycle' THEN r.voyages_chronometres
        WHEN 'taux_remplissage' THEN r.voyages_peses
        WHEN 'rotations' THEN r.camions_jours
        WHEN 'km_facturable' THEN r.voyages_km
      END AS n
    FROM public.contrat_engagements g CROSS JOIN r
    WHERE g.version_id = (SELECT id FROM version)
  )
  SELECT e.id, e.indicateur, e.libelle, e.seuil, e.unite, e.sens, e.periodicite, e.consequence, e.mesure, e.n,
         CASE WHEN e.mesure IS NULL THEN NULL WHEN e.sens = 'minimum' THEN e.mesure >= e.seuil ELSE e.mesure <= e.seuil END
  FROM e ORDER BY e.ordre, e.libelle;
$$;

REVOKE EXECUTE ON FUNCTION public.realise_engagements(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realise_engagements(date, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.comparer_engagements(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comparer_engagements(uuid, date, date) TO authenticated;

-- 3. Rapports de performance
CREATE TABLE IF NOT EXISTS public.rapports_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid NOT NULL REFERENCES public.contrats(id),
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  contenu jsonb NOT NULL,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'remis')),
  genere_par uuid REFERENCES auth.users(id),
  genere_le timestamptz NOT NULL DEFAULT now(),
  remis_le date,
  remis_a text,
  remis_par uuid REFERENCES auth.users(id),
  UNIQUE (contrat_id, periode_debut)
);

CREATE OR REPLACE FUNCTION public.generer_rapport_performance(p_contrat_id uuid, p_du date, p_au date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existant public.rapports_performance;
  v_contenu jsonb;
  v_id uuid;
BEGIN
  IF NOT public.has_module_write('contracts') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contrats WHERE id = p_contrat_id) OR p_du IS NULL OR p_au IS NULL OR p_au < p_du THEN
    RAISE EXCEPTION 'Contrat et periode requis' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existant FROM public.rapports_performance WHERE contrat_id = p_contrat_id AND periode_debut = p_du FOR UPDATE;
  IF v_existant.statut = 'remis' THEN
    RAISE EXCEPTION 'Rapport deja remis le % : il ne change plus', v_existant.remis_le USING ERRCODE = '22023';
  END IF;

  v_contenu := jsonb_build_object(
    'genere_le', now(),
    'engagements', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.comparer_engagements(p_contrat_id, p_du, p_au) c), '[]'::jsonb),
    'mesures', (SELECT to_jsonb(r) FROM public.realise_engagements(p_du, p_au) r),
    'reconciliations', coalesce((SELECT jsonb_agg(jsonb_build_object('debut', periode_debut, 'fin', periode_fin, 'statut', statut,
        'tonnage_facturable', tonnage_facturable, 'voyages_facturables', voyages_facturables) ORDER BY periode_debut)
      FROM public.reconciliations WHERE contrat_id = p_contrat_id AND periode_debut <= p_au AND periode_fin >= p_du), '[]'::jsonb),
    'factures', coalesce((SELECT jsonb_agg(jsonb_build_object('numero', numero, 'type', type, 'statut', statut,
        'montant_ttc', montant_ttc, 'devise', devise) ORDER BY prepare_le)
      FROM public.factures WHERE contrat_id = p_contrat_id AND periode_debut <= p_au AND periode_fin >= p_du AND statut <> 'annulee'), '[]'::jsonb)
  );

  IF v_existant.id IS NOT NULL THEN
    UPDATE public.rapports_performance SET contenu = v_contenu, periode_fin = p_au, genere_par = auth.uid(), genere_le = now()
    WHERE id = v_existant.id RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.rapports_performance (contrat_id, periode_debut, periode_fin, contenu, genere_par)
    VALUES (p_contrat_id, p_du, p_au, v_contenu, auth.uid()) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.marquer_rapport_remis(p_id uuid, p_date date, p_destinataire text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_module_write('contracts') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les contrats requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_date > current_date OR nullif(btrim(coalesce(p_destinataire, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Date de remise (non future) et destinataire requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.rapports_performance SET statut = 'remis', remis_le = p_date, remis_a = btrim(p_destinataire), remis_par = auth.uid()
  WHERE id = p_id AND statut = 'brouillon';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rapport introuvable ou deja remis' USING ERRCODE = '22023';
  END IF;
END;
$$;

-- 4. Recouvrement
CREATE TABLE IF NOT EXISTS public.encaissements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES public.factures(id),
  date_encaissement date NOT NULL,
  montant numeric NOT NULL CHECK (montant > 0),
  mode text NOT NULL CHECK (mode IN ('virement', 'cheque', 'especes', 'compensation', 'autre')),
  reference text,
  note text,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.relances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES public.factures(id),
  niveau integer NOT NULL CHECK (niveau BETWEEN 1 AND 3),
  date_relance date NOT NULL DEFAULT current_date,
  canal text NOT NULL CHECK (canal IN ('courrier', 'email', 'telephone', 'remise_main')),
  note text,
  auteur uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (facture_id, niveau)
);

CREATE OR REPLACE VIEW public.v_creances
WITH (security_invoker = true) AS
SELECT f.id, f.numero, f.contrat_id, f.devise, f.date_emission, f.date_echeance, f.montant_ttc,
       coalesce(av.total, 0) AS avoirs,
       f.montant_ttc + coalesce(av.total, 0) AS du,
       coalesce(en.total, 0) AS encaisse,
       f.montant_ttc + coalesce(av.total, 0) - coalesce(en.total, 0) AS reste,
       CASE WHEN f.montant_ttc + coalesce(av.total, 0) - coalesce(en.total, 0) > 0 AND f.date_echeance < current_date
            THEN current_date - f.date_echeance END AS jours_retard,
       en.dernier AS dernier_encaissement,
       re.niveau AS derniere_relance_niveau,
       re.date_relance AS derniere_relance_le
FROM public.factures f
LEFT JOIN LATERAL (SELECT sum(a.montant_ttc) AS total FROM public.factures a
                   WHERE a.facture_origine_id = f.id AND a.type = 'avoir' AND a.statut = 'emise') av ON true
LEFT JOIN LATERAL (SELECT sum(e.montant) AS total, max(e.date_encaissement) AS dernier FROM public.encaissements e
                   WHERE e.facture_id = f.id) en ON true
LEFT JOIN LATERAL (SELECT r.niveau, r.date_relance FROM public.relances r WHERE r.facture_id = f.id
                   ORDER BY r.niveau DESC LIMIT 1) re ON true
WHERE f.type = 'facture' AND f.statut = 'emise';

CREATE OR REPLACE FUNCTION public.enregistrer_encaissement(
  p_facture_id uuid, p_date date, p_montant numeric, p_mode text, p_reference text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.v_creances;
  v_id uuid;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.factures WHERE id = p_facture_id FOR UPDATE;
  SELECT * INTO c FROM public.v_creances WHERE id = p_facture_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture emise introuvable' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_date > current_date OR p_date < c.date_emission THEN
    RAISE EXCEPTION 'Date d''encaissement entre l''emission et aujourd''hui' USING ERRCODE = '22023';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 OR p_montant > c.reste THEN
    RAISE EXCEPTION 'Montant positif et au plus egal au reste du (%)', c.reste USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.encaissements (facture_id, date_encaissement, montant, mode, reference, note, saisi_par)
  VALUES (p_facture_id, p_date, p_montant, p_mode, nullif(btrim(coalesce(p_reference, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.relancer(p_facture_id uuid, p_canal text, p_note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.v_creances;
  v_niveau integer;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.v_creances WHERE id = p_facture_id;
  IF NOT FOUND OR c.reste <= 0 THEN
    RAISE EXCEPTION 'Aucun reste du sur cette facture' USING ERRCODE = '22023';
  END IF;
  IF c.date_echeance IS NULL OR c.date_echeance >= current_date THEN
    RAISE EXCEPTION 'Facture non echue : relance possible apres le %', c.date_echeance USING ERRCODE = '22023';
  END IF;
  v_niveau := coalesce(c.derniere_relance_niveau, 0) + 1;
  IF v_niveau > 3 THEN
    RAISE EXCEPTION 'Mise en demeure deja envoyee : suite contentieuse hors application' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.relances (facture_id, niveau, canal, note, auteur)
  VALUES (p_facture_id, v_niveau, p_canal, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  RETURN v_niveau;
END;
$$;

-- 5. Comites de contrat
CREATE TABLE IF NOT EXISTS public.comites_contrat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid NOT NULL REFERENCES public.contrats(id),
  date_comite date NOT NULL,
  objet text NOT NULL,
  ordre_du_jour text,
  participants text,
  proces_verbal text,
  statut text NOT NULL DEFAULT 'prevu' CHECK (statut IN ('prevu', 'tenu', 'annule')),
  cree_par uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.comite_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comite_id uuid NOT NULL REFERENCES public.comites_contrat(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  responsable text,
  echeance date,
  statut text NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'faite', 'abandonnee')),
  note text
);

-- RLS
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rapports_performance', 'encaissements', 'relances'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated USING (
      public.has_module_view(''invoices'') OR public.has_module_view(''contracts'') OR public.is_admin())', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['comites_contrat', 'comite_actions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated
      USING (public.has_module_view(''contracts'') OR public.is_admin())', t);
    EXECUTE format('DROP POLICY IF EXISTS ecriture_module ON public.%I', t);
    EXECUTE format('CREATE POLICY ecriture_module ON public.%I FOR ALL TO authenticated
      USING (public.has_module_write(''contracts'') OR public.is_admin())
      WITH CHECK (public.has_module_write(''contracts'') OR public.is_admin())', t);
  END LOOP;
END $$;
REVOKE ALL ON public.v_creances FROM anon;
GRANT SELECT ON public.v_creances TO authenticated;

-- 6. Indicateurs de la fiche de poste (12 derniers mois)
CREATE OR REPLACE FUNCTION public.indicateurs_charge_contrats()
RETURNS TABLE (
  delai_emission_jours numeric, factures_emises integer,
  ecart_tonnage_pct numeric, reconciliations_closes integer,
  delai_rapport_jours numeric, rapports_remis integer,
  delai_recouvrement_jours numeric, factures_soldees integer,
  creances_en_retard integer, montant_en_retard numeric,
  factures_a_signer integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    (SELECT round(avg(date_emission - periode_fin), 1) FROM public.factures
      WHERE type = 'facture' AND statut = 'emise' AND date_emission >= current_date - 365 AND periode_fin IS NOT NULL),
    (SELECT count(*)::integer FROM public.factures WHERE type = 'facture' AND statut = 'emise' AND date_emission >= current_date - 365),
    (SELECT round((x.releve - x.facture) / nullif(x.releve, 0) * 100, 2) FROM (
       SELECT (SELECT sum(l.tonnage_charge) FROM public.reconciliation_lignes l JOIN public.reconciliations r ON r.id = l.reconciliation_id
                WHERE r.statut = 'cloturee' AND r.cloturee_le >= now() - interval '365 days') AS releve,
              (SELECT sum(r.tonnage_facturable) FROM public.reconciliations r
                WHERE r.statut = 'cloturee' AND r.cloturee_le >= now() - interval '365 days') AS facture) x),
    (SELECT count(*)::integer FROM public.reconciliations WHERE statut = 'cloturee' AND cloturee_le >= now() - interval '365 days'),
    (SELECT round(avg(remis_le - periode_fin), 1) FROM public.rapports_performance WHERE statut = 'remis' AND remis_le >= current_date - 365),
    (SELECT count(*)::integer FROM public.rapports_performance WHERE statut = 'remis' AND remis_le >= current_date - 365),
    (SELECT round(avg(dernier_encaissement - date_emission), 1) FROM public.v_creances WHERE reste <= 0 AND dernier_encaissement >= current_date - 365),
    (SELECT count(*)::integer FROM public.v_creances WHERE reste <= 0 AND dernier_encaissement >= current_date - 365),
    (SELECT count(*)::integer FROM public.v_creances WHERE jours_retard > 0),
    (SELECT coalesce(sum(reste), 0) FROM public.v_creances WHERE jours_retard > 0),
    (SELECT count(*)::integer FROM public.factures WHERE statut = 'a_signer');
$$;

DO $$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'public.generer_rapport_performance(uuid, date, date)',
    'public.marquer_rapport_remis(uuid, date, text)',
    'public.enregistrer_encaissement(uuid, date, numeric, text, text, text)',
    'public.relancer(uuid, text, text)',
    'public.indicateurs_charge_contrats()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', s);
  END LOOP;
END $$;

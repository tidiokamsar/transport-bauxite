/*
  # Reconciliation mensuelle et factures clients (phase 3, D-029)

  Fiche de poste : « reconcilier mensuellement les releves de terrain avec
  les tonnages facturables » ; « etablir et emettre les factures adressees a
  CBG » ; « emet les factures mais ne les signe pas : toute facture est
  signee par le Directeur General ».

  Cartographie (CDC 33) : `invoices` et `invoice_items` (Bolt) n'ont ni lien
  au contrat, ni reconciliation, ni circuit de signature ; plusieurs ecrans
  historiques les lisent : elles restent en place, non reprises.

  1. `reconciliations` (contrat client, periode, base de tonnage choisie,
     tolerance d'ecart charge / recu, trajet optionnel ; ouverte, cloturee)
     et `reconciliation_lignes` (instantane par voyage livre, anomalies,
     decision facturable / exclue motivee).
  2. `factures` et `facture_lignes` : brouillon -> a signer -> signee (role
     director, jamais le preparateur) -> emise ; numero definitif attribue a
     l'emission (FAC-AAAA-NNNN, AV-AAAA-NNNN) ; avoir pour corriger une
     facture emise ; journal des actions.
  Droits : module `invoices` ; signature : role director actif.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- 1. Reconciliation
CREATE TABLE IF NOT EXISTS public.reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid NOT NULL REFERENCES public.contrats(id),
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  base_tonnage text NOT NULL CHECK (base_tonnage IN ('accepte', 'recu', 'charge')),
  tolerance_ecart_pct numeric NOT NULL CHECK (tolerance_ecart_pct >= 0),
  site_depart_id uuid REFERENCES public.sites(id),
  site_arrivee_id uuid REFERENCES public.sites(id),
  statut text NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'cloturee')),
  tonnage_facturable numeric,
  voyages_facturables integer,
  ouverte_par uuid REFERENCES auth.users(id),
  ouverte_le timestamptz NOT NULL DEFAULT now(),
  actualisee_le timestamptz,
  cloturee_par uuid REFERENCES auth.users(id),
  cloturee_le timestamptz,
  CONSTRAINT reconciliations_periode CHECK (periode_fin >= periode_debut)
);

CREATE TABLE IF NOT EXISTS public.reconciliation_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES public.reconciliations(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  reference text NOT NULL,
  date_voyage date NOT NULL,
  vehicle_id uuid,
  etat text,
  tonnage_charge numeric,
  tonnage_recu numeric,
  tonnage_accepte numeric,
  tonnage_base numeric,
  ticket text,
  fiche text,
  anomalies text[] NOT NULL DEFAULT '{}',
  decision text CHECK (decision IN ('facturable', 'exclue')),
  motif_decision text,
  decide_par uuid REFERENCES auth.users(id),
  decide_le timestamptz,
  UNIQUE (reconciliation_id, trip_id),
  CONSTRAINT reconciliation_decision_motivee CHECK (decision IS NULL OR motif_decision IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_reconciliation_lignes ON public.reconciliation_lignes (reconciliation_id, date_voyage);

-- Anomalies bloquantes : la ligne attend une decision avant la cloture.
CREATE OR REPLACE FUNCTION public.ligne_bloquee(p_anomalies text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_anomalies && ARRAY['base_absente', 'litige', 'rejet', 'ecart_hors_tolerance', 'ticket_double', 'non_accepte'];
$$;

CREATE OR REPLACE FUNCTION public.statut_ligne(p_decision text, p_anomalies text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(p_decision, CASE WHEN public.ligne_bloquee(p_anomalies) THEN 'a_examiner' ELSE 'facturable' END);
$$;

-- Calcul (ou recalcul) des lignes d'une reconciliation ouverte. Les
-- decisions deja prises sont conservees ; les voyages sortis du perimetre
-- sont retires.
CREATE OR REPLACE FUNCTION public.actualiser_reconciliation(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.reconciliations;
  n integer;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.reconciliations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reconciliation introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF r.statut <> 'ouverte' THEN
    RAISE EXCEPTION 'Reconciliation cloturee : elle ne change plus' USING ERRCODE = '22023';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.calcul_reconciliation (LIKE public.reconciliation_lignes) ON COMMIT DROP;
  DELETE FROM pg_temp.calcul_reconciliation;
  INSERT INTO pg_temp.calcul_reconciliation (id, reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat,
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_base, ticket, fiche, anomalies)
  SELECT gen_random_uuid(), r.id, t.id, t.reference, t.planned_date, t.vehicle_id, t.etat,
         coalesce(t.net_weight, t.load_weight), t.net_weight_reception, t.accepted_tonnage,
         CASE r.base_tonnage WHEN 'accepte' THEN t.accepted_tonnage WHEN 'recu' THEN t.net_weight_reception
              ELSE coalesce(t.net_weight, t.load_weight) END,
         tk.ticket, fi.fiche,
         array_remove(ARRAY[
           CASE WHEN coalesce(t.net_weight, t.load_weight) IS NULL AND t.net_weight_reception IS NULL THEN 'sans_pesee' END,
           CASE WHEN (CASE r.base_tonnage WHEN 'accepte' THEN t.accepted_tonnage WHEN 'recu' THEN t.net_weight_reception
                      ELSE coalesce(t.net_weight, t.load_weight) END) IS NULL THEN 'base_absente' END,
           CASE WHEN coalesce(t.net_weight, t.load_weight) > 0 AND t.net_weight_reception IS NOT NULL
                 AND abs(t.net_weight_reception - coalesce(t.net_weight, t.load_weight)) / coalesce(t.net_weight, t.load_weight) * 100
                     > r.tolerance_ecart_pct THEN 'ecart_hors_tolerance' END,
           CASE WHEN t.etat = 'DISPUTED' THEN 'litige' END,
           CASE WHEN t.etat = 'REJECTED' THEN 'rejet' END,
           CASE WHEN r.base_tonnage = 'accepte' AND t.etat = 'DELIVERED' THEN 'non_accepte' END,
           CASE WHEN tk.ticket IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.trip_events e2 WHERE e2.donnees ? 'ticket' AND e2.donnees ->> 'ticket' = tk.ticket
               AND e2.trip_id <> t.id) THEN 'ticket_double' END,
           CASE WHEN fi.fiche IS NULL THEN 'sans_fiche' END
         ], NULL)
  FROM public.trips t
  LEFT JOIN LATERAL (
    SELECT e.donnees ->> 'ticket' AS ticket FROM public.trip_events e
    WHERE e.trip_id = t.id AND e.donnees ? 'ticket' ORDER BY e.survenu_le DESC LIMIT 1) tk ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(e.donnees ->> 'fiche', substring(e.note FROM 'Fiche ([A-Z]{2}-\d{6}-\d+)')) AS fiche FROM public.trip_events e
    WHERE e.trip_id = t.id AND (e.donnees ? 'fiche' OR e.note LIKE 'Fiche %') ORDER BY e.survenu_le LIMIT 1) fi ON true
  WHERE t.planned_date BETWEEN r.periode_debut AND r.periode_fin
    AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED')
    AND (r.site_depart_id IS NULL OR t.departure_site_id = r.site_depart_id)
    AND (r.site_arrivee_id IS NULL OR t.arrival_site_id = r.site_arrivee_id);

  DELETE FROM public.reconciliation_lignes l
  WHERE l.reconciliation_id = r.id
    AND NOT EXISTS (SELECT 1 FROM pg_temp.calcul_reconciliation c WHERE c.trip_id = l.trip_id);

  INSERT INTO public.reconciliation_lignes (reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat,
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_base, ticket, fiche, anomalies)
  SELECT reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat,
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_base, ticket, fiche, anomalies
  FROM pg_temp.calcul_reconciliation
  ON CONFLICT (reconciliation_id, trip_id) DO UPDATE SET
    reference = EXCLUDED.reference, date_voyage = EXCLUDED.date_voyage, vehicle_id = EXCLUDED.vehicle_id,
    etat = EXCLUDED.etat, tonnage_charge = EXCLUDED.tonnage_charge, tonnage_recu = EXCLUDED.tonnage_recu,
    tonnage_accepte = EXCLUDED.tonnage_accepte, tonnage_base = EXCLUDED.tonnage_base, ticket = EXCLUDED.ticket,
    fiche = EXCLUDED.fiche, anomalies = EXCLUDED.anomalies;

  SELECT count(*) INTO n FROM public.reconciliation_lignes WHERE reconciliation_id = r.id;
  UPDATE public.reconciliations SET actualisee_le = now() WHERE id = r.id;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.ouvrir_reconciliation(
  p_contrat_id uuid,
  p_debut date,
  p_fin date,
  p_base text,
  p_tolerance numeric,
  p_site_depart uuid DEFAULT NULL,
  p_site_arrivee uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.contrats;
  v_id uuid;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.contrats WHERE id = p_contrat_id;
  IF NOT FOUND OR c.nature <> 'client' THEN
    RAISE EXCEPTION 'Contrat client introuvable' USING ERRCODE = '22023';
  END IF;
  IF p_base IS NULL OR p_tolerance IS NULL THEN
    RAISE EXCEPTION 'Base de tonnage et tolerance d''ecart requises' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reconciliations r WHERE r.contrat_id = p_contrat_id
             AND daterange(r.periode_debut, r.periode_fin, '[]') && daterange(p_debut, p_fin, '[]')
             AND r.site_depart_id IS NOT DISTINCT FROM p_site_depart AND r.site_arrivee_id IS NOT DISTINCT FROM p_site_arrivee) THEN
    RAISE EXCEPTION 'Une reconciliation couvre deja cette periode pour ce contrat et ce trajet' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.reconciliations (contrat_id, periode_debut, periode_fin, base_tonnage, tolerance_ecart_pct,
    site_depart_id, site_arrivee_id, ouverte_par)
  VALUES (p_contrat_id, p_debut, p_fin, p_base, p_tolerance, p_site_depart, p_site_arrivee, auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.actualiser_reconciliation(v_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decider_ligne_reconciliation(p_ligne_id uuid, p_decision text, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  l public.reconciliation_lignes;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO l FROM public.reconciliation_lignes WHERE id = p_ligne_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ligne introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT statut FROM public.reconciliations WHERE id = l.reconciliation_id) <> 'ouverte' THEN
    RAISE EXCEPTION 'Reconciliation cloturee' USING ERRCODE = '22023';
  END IF;
  IF p_decision IS NOT NULL AND nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour une decision' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'facturable' AND l.tonnage_base IS NULL THEN
    RAISE EXCEPTION 'Tonnage de base absent : corriger le voyage (pesee, acceptation) puis actualiser' USING ERRCODE = '22023';
  END IF;
  UPDATE public.reconciliation_lignes
  SET decision = p_decision, motif_decision = CASE WHEN p_decision IS NULL THEN NULL ELSE btrim(p_motif) END,
      decide_par = auth.uid(), decide_le = now()
  WHERE id = p_ligne_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cloturer_reconciliation(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attente integer;
BEGIN
  PERFORM public.actualiser_reconciliation(p_id);
  SELECT count(*) INTO v_attente FROM public.reconciliation_lignes
  WHERE reconciliation_id = p_id AND public.statut_ligne(decision, anomalies) = 'a_examiner';
  IF v_attente > 0 THEN
    RAISE EXCEPTION '% ligne(s) a examiner : decider avant de cloturer', v_attente USING ERRCODE = '22023';
  END IF;
  UPDATE public.reconciliations r SET statut = 'cloturee', cloturee_par = auth.uid(), cloturee_le = now(),
    tonnage_facturable = (SELECT coalesce(sum(tonnage_base), 0) FROM public.reconciliation_lignes
                          WHERE reconciliation_id = p_id AND public.statut_ligne(decision, anomalies) = 'facturable'),
    voyages_facturables = (SELECT count(*) FROM public.reconciliation_lignes
                           WHERE reconciliation_id = p_id AND public.statut_ligne(decision, anomalies) = 'facturable')
  WHERE r.id = p_id;
END;
$$;

-- 2. Factures
CREATE TABLE IF NOT EXISTS public.factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  type text NOT NULL DEFAULT 'facture' CHECK (type IN ('facture', 'avoir')),
  contrat_id uuid NOT NULL REFERENCES public.contrats(id),
  reconciliation_id uuid REFERENCES public.reconciliations(id),
  facture_origine_id uuid REFERENCES public.factures(id),
  objet text NOT NULL,
  periode_debut date,
  periode_fin date,
  devise text NOT NULL,
  taux_taxe_pct numeric NOT NULL CHECK (taux_taxe_pct >= 0),
  delai_paiement_jours integer,
  montant_ht numeric NOT NULL DEFAULT 0,
  montant_taxe numeric NOT NULL DEFAULT 0,
  montant_ttc numeric NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'a_signer', 'signee', 'emise', 'annulee')),
  date_emission date,
  date_echeance date,
  prepare_par uuid REFERENCES auth.users(id),
  prepare_le timestamptz NOT NULL DEFAULT now(),
  soumise_le timestamptz,
  signee_par uuid REFERENCES auth.users(id),
  signee_le timestamptz,
  emise_par uuid REFERENCES auth.users(id),
  emise_le timestamptz,
  motif text,
  CONSTRAINT factures_avoir_origine CHECK (type = 'facture' OR facture_origine_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS factures_une_par_reconciliation
  ON public.factures (reconciliation_id) WHERE type = 'facture' AND statut <> 'annulee';

CREATE TABLE IF NOT EXISTS public.facture_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  ordre integer NOT NULL DEFAULT 0,
  libelle text NOT NULL,
  quantite numeric NOT NULL,
  unite text NOT NULL,
  prix_unitaire numeric NOT NULL,
  montant numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS public.factures_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  action text NOT NULL,
  motif text,
  auteur uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reconciliations', 'reconciliation_lignes', 'factures', 'facture_lignes', 'factures_journal'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated USING (
      public.has_module_view(''invoices'') OR public.has_module_view(''contracts'') OR public.is_admin())', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.journaliser_facture(p_id uuid, p_action text, p_motif text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  INSERT INTO public.factures_journal (facture_id, action, motif, auteur) VALUES (p_id, p_action, p_motif, auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.journaliser_facture(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.recalculer_facture(p_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  UPDATE public.factures f SET
    montant_ht = s.ht,
    montant_taxe = round(s.ht * f.taux_taxe_pct / 100, 2),
    montant_ttc = s.ht + round(s.ht * f.taux_taxe_pct / 100, 2)
  FROM (SELECT coalesce(sum(montant), 0) AS ht FROM public.facture_lignes WHERE facture_id = p_id) s
  WHERE f.id = p_id;
$$;
REVOKE EXECUTE ON FUNCTION public.recalculer_facture(uuid) FROM PUBLIC, anon, authenticated;

-- Facture depuis une reconciliation close : une ligne par tarif a la tonne
-- de la version du contrat en vigueur a la fin de la periode.
CREATE OR REPLACE FUNCTION public.generer_facture(p_reconciliation_id uuid, p_taux_taxe numeric, p_objet text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.reconciliations;
  c public.contrats;
  v_version uuid;
  v_id uuid;
  n integer;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.reconciliations WHERE id = p_reconciliation_id;
  IF NOT FOUND OR r.statut <> 'cloturee' THEN
    RAISE EXCEPTION 'La reconciliation doit etre cloturee avant la facturation' USING ERRCODE = '22023';
  END IF;
  IF p_taux_taxe IS NULL OR p_taux_taxe < 0 THEN
    RAISE EXCEPTION 'Taux de taxe requis (0 si exonere)' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.contrats WHERE id = r.contrat_id;
  SELECT v.id INTO v_version FROM public.contrat_versions v
  WHERE v.contrat_id = c.id AND v.date_effet <= r.periode_fin ORDER BY v.numero DESC LIMIT 1;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Aucune version du contrat en vigueur sur la periode' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contrat_tarifs WHERE version_id = v_version AND unite = 'tonne') THEN
    RAISE EXCEPTION 'Aucun tarif a la tonne dans la version en vigueur du contrat' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.factures (type, contrat_id, reconciliation_id, objet, periode_debut, periode_fin, devise,
    taux_taxe_pct, delai_paiement_jours, prepare_par)
  VALUES ('facture', c.id, r.id,
    coalesce(nullif(btrim(coalesce(p_objet, '')), ''), c.intitule || ' du ' || to_char(r.periode_debut, 'DD/MM/YYYY')
      || ' au ' || to_char(r.periode_fin, 'DD/MM/YYYY')),
    r.periode_debut, r.periode_fin, c.devise, p_taux_taxe, c.delai_paiement_jours, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.facture_lignes (facture_id, ordre, libelle, quantite, unite, prix_unitaire, montant)
  SELECT v_id, t.ordre, t.libelle || ' (' || r.voyages_facturables || ' voyages)', r.tonnage_facturable, 'tonne', t.prix,
         round(r.tonnage_facturable * t.prix, 2)
  FROM public.contrat_tarifs t WHERE t.version_id = v_version AND t.unite = 'tonne';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.recalculer_facture(v_id);
  PERFORM public.journaliser_facture(v_id, 'generation');
  RETURN v_id;
END;
$$;

-- Avoir : corrige une facture emise (montant positif saisi, deduit).
CREATE OR REPLACE FUNCTION public.creer_avoir(p_facture_id uuid, p_montant_ht numeric, p_motif text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.factures;
  v_id uuid;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_facture_id;
  IF NOT FOUND OR f.type <> 'facture' OR f.statut <> 'emise' THEN
    RAISE EXCEPTION 'Un avoir corrige une facture emise' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour un avoir' USING ERRCODE = '22023';
  END IF;
  IF p_montant_ht IS NULL OR p_montant_ht <= 0 OR p_montant_ht > f.montant_ht THEN
    RAISE EXCEPTION 'Montant de l''avoir positif et au plus egal a la facture' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.factures (type, contrat_id, facture_origine_id, objet, periode_debut, periode_fin, devise,
    taux_taxe_pct, delai_paiement_jours, prepare_par, motif)
  VALUES ('avoir', f.contrat_id, f.id, 'Avoir sur la facture ' || f.numero, f.periode_debut, f.periode_fin, f.devise,
    f.taux_taxe_pct, f.delai_paiement_jours, auth.uid(), btrim(p_motif))
  RETURNING id INTO v_id;
  INSERT INTO public.facture_lignes (facture_id, libelle, quantite, unite, prix_unitaire, montant)
  VALUES (v_id, btrim(p_motif), 1, 'forfait', -p_montant_ht, -p_montant_ht);
  PERFORM public.recalculer_facture(v_id);
  PERFORM public.journaliser_facture(v_id, 'generation', btrim(p_motif));
  RETURN v_id;
END;
$$;

-- Circuit : soumettre, signer (Directeur, pas le preparateur), renvoyer,
-- emettre (numero definitif), annuler un brouillon.
CREATE OR REPLACE FUNCTION public.avancer_facture(p_id uuid, p_action text, p_motif text DEFAULT NULL, p_date date DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  f public.factures;
  v_role text;
  v_prefixe text;
  v_suite integer;
  v_date date := coalesce(p_date, current_date);
BEGIN
  SELECT * INTO f FROM public.factures WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT pr.role::text INTO v_role FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.status = 'active';

  IF p_action = 'signer' THEN
    IF v_role IS DISTINCT FROM 'director' THEN
      RAISE EXCEPTION 'Seul le Directeur General signe les factures' USING ERRCODE = '42501';
    END IF;
    IF f.prepare_par = auth.uid() THEN
      RAISE EXCEPTION 'Le signataire ne peut pas etre le preparateur de la facture' USING ERRCODE = '42501';
    END IF;
    IF f.statut <> 'a_signer' THEN
      RAISE EXCEPTION 'Facture non soumise a signature (%)', f.statut USING ERRCODE = '22023';
    END IF;
    UPDATE public.factures SET statut = 'signee', signee_par = auth.uid(), signee_le = now() WHERE id = p_id;
  ELSIF p_action = 'renvoyer' THEN
    IF v_role IS DISTINCT FROM 'director' THEN
      RAISE EXCEPTION 'Seul le Directeur General renvoie une facture' USING ERRCODE = '42501';
    END IF;
    IF f.statut <> 'a_signer' OR nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Renvoi d''une facture a signer, motif obligatoire' USING ERRCODE = '22023';
    END IF;
    UPDATE public.factures SET statut = 'brouillon', soumise_le = NULL WHERE id = p_id;
  ELSE
    IF NOT public.has_module_write('invoices') THEN
      RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
    END IF;
    IF p_action = 'soumettre' AND f.statut = 'brouillon' THEN
      IF NOT EXISTS (SELECT 1 FROM public.facture_lignes WHERE facture_id = p_id) THEN
        RAISE EXCEPTION 'Facture sans ligne' USING ERRCODE = '22023';
      END IF;
      UPDATE public.factures SET statut = 'a_signer', soumise_le = now() WHERE id = p_id;
    ELSIF p_action = 'emettre' AND f.statut = 'signee' THEN
      IF v_date > current_date THEN
        RAISE EXCEPTION 'Date d''emission dans le futur' USING ERRCODE = '22023';
      END IF;
      v_prefixe := CASE f.type WHEN 'avoir' THEN 'AV-' ELSE 'FAC-' END || to_char(v_date, 'YYYY') || '-';
      PERFORM pg_advisory_xact_lock(hashtext('sigtb.facture.' || v_prefixe));
      SELECT coalesce(max(substring(numero FROM '-(\d+)$')::int), 0) + 1 INTO v_suite
        FROM public.factures WHERE numero LIKE v_prefixe || '%';
      UPDATE public.factures SET statut = 'emise', emise_par = auth.uid(), emise_le = now(),
        numero = v_prefixe || lpad(v_suite::text, 4, '0'), date_emission = v_date,
        date_echeance = CASE WHEN delai_paiement_jours IS NOT NULL THEN v_date + delai_paiement_jours END
      WHERE id = p_id;
    ELSIF p_action = 'annuler' AND f.statut IN ('brouillon', 'a_signer') THEN
      IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Motif obligatoire pour annuler' USING ERRCODE = '22023';
      END IF;
      UPDATE public.factures SET statut = 'annulee', motif = btrim(p_motif) WHERE id = p_id;
    ELSE
      RAISE EXCEPTION 'Action % impossible sur une facture %', p_action, f.statut USING ERRCODE = '22023';
    END IF;
  END IF;
  PERFORM public.journaliser_facture(p_id, p_action, nullif(btrim(coalesce(p_motif, '')), ''));
  RETURN (SELECT statut FROM public.factures WHERE id = p_id);
END;
$$;

DO $$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'public.ouvrir_reconciliation(uuid, date, date, text, numeric, uuid, uuid)',
    'public.actualiser_reconciliation(uuid)',
    'public.decider_ligne_reconciliation(uuid, text, text)',
    'public.cloturer_reconciliation(uuid)',
    'public.generer_facture(uuid, numeric, text)',
    'public.creer_avoir(uuid, numeric, text)',
    'public.avancer_facture(uuid, text, text, date)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', s);
  END LOOP;
END $$;

/*
  # Registre des mouvements de carburant (D-041, LOT 10, module 13)

  Le stock d'un stockage (cuve fixe ou citerne mobile) n'est plus une valeur
  saisie : il est la somme des mouvements valides. Aucun utilisateur ne peut
  modifier un solde, ni modifier ou supprimer un mouvement.

  Chaine couverte :
  1. Livraison CBG declaree (D-034, quantite et prix du document).
  2. Reception physique : volume mesure et volume accepte, ecart motive ;
     cree un mouvement « reception » a valider (volume accepte).
  3. Transfert entre stockages : deux mouvements lies a valider ensemble.
  4. Distribution : ligne de fiche carburant rattachee a un stockage ; cree
     un mouvement « distribution » a valider.
  5. Inventaire : volume mesure compare au solde theorique ; sa validation
     cree un ajustement egal a l'ecart.
  6. Validation ou rejet par une autre personne que l'auteur de la saisie
     (reglage settings carburant_validation_separee, exige si absent).
  7. Annulation d'un mouvement valide : contre-mouvement a valider, jamais
     de suppression.

  Sans mouvement valide, le solde est NULL (« sans donnees ») : l'ouverture
  d'un stockage passe par un premier inventaire valide. L'ancienne table
  fuel_stocks (solde saisi a la main) passe en lecture seule.

  Ecriture : fonctions SECURITY DEFINER controlees par has_module_write('fuel')
  et site_permis(site du stockage). Lecture : has_module_view('fuel') et
  site_permis. Idempotent.
*/

-- 1. Stockages
CREATE TABLE IF NOT EXISTS public.stockages_carburant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  type text NOT NULL CHECK (type IN ('cuve_fixe', 'citerne_mobile')),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  capacite_litres numeric NOT NULL CHECK (capacite_litres > 0),
  seuil_alerte_litres numeric CHECK (seuil_alerte_litres IS NULL OR seuil_alerte_litres >= 0),
  actif boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stockages_carburant_site ON public.stockages_carburant(site_id);

-- 2. Receptions physiques des livraisons CBG
CREATE TABLE IF NOT EXISTS public.receptions_carburant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  livraison_id uuid NOT NULL UNIQUE REFERENCES public.livraisons_carburant_cbg(id) ON DELETE RESTRICT,
  stockage_id uuid NOT NULL REFERENCES public.stockages_carburant(id),
  date_reception timestamptz NOT NULL,
  volume_mesure numeric NOT NULL CHECK (volume_mesure > 0),
  volume_accepte numeric NOT NULL CHECK (volume_accepte > 0),
  methode_mesure text NOT NULL CHECK (methode_mesure IN ('jauge', 'pige', 'compteur', 'autre')),
  motif_ecart text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  CHECK (volume_accepte <= volume_mesure)
);

-- 3. Inventaires
CREATE TABLE IF NOT EXISTS public.inventaires_carburant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stockage_id uuid NOT NULL REFERENCES public.stockages_carburant(id),
  date_mesure timestamptz NOT NULL,
  volume_mesure numeric NOT NULL CHECK (volume_mesure >= 0),
  methode_mesure text NOT NULL CHECK (methode_mesure IN ('jauge', 'pige', 'compteur', 'autre')),
  solde_theorique numeric,
  ecart numeric,
  statut text NOT NULL DEFAULT 'a_valider' CHECK (statut IN ('a_valider', 'valide', 'rejete')),
  note text,
  motif_decision text,
  cree_par uuid REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  decide_par uuid REFERENCES auth.users(id),
  decide_le timestamptz
);
CREATE INDEX IF NOT EXISTS idx_inventaires_carburant_stockage ON public.inventaires_carburant(stockage_id, date_mesure DESC);

-- 4. Registre des mouvements (append-only)
CREATE TABLE IF NOT EXISTS public.mouvements_carburant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  stockage_id uuid NOT NULL REFERENCES public.stockages_carburant(id),
  type text NOT NULL CHECK (type IN ('reception', 'transfert_sortie', 'transfert_entree',
                                     'distribution', 'ajustement_inventaire', 'annulation')),
  variation numeric NOT NULL CHECK (variation <> 0),
  date_mouvement timestamptz NOT NULL,
  reference_piece text,
  reception_id uuid REFERENCES public.receptions_carburant(id),
  inventaire_id uuid REFERENCES public.inventaires_carburant(id),
  fuel_transaction_id uuid UNIQUE REFERENCES public.fuel_transactions(id),
  transfert_id uuid,
  annule_mouvement_id uuid UNIQUE REFERENCES public.mouvements_carburant(id),
  statut text NOT NULL DEFAULT 'a_valider' CHECK (statut IN ('a_valider', 'valide', 'rejete')),
  note text,
  motif_decision text,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now(),
  decide_par uuid REFERENCES auth.users(id),
  decide_le timestamptz,
  CHECK (
    (type IN ('reception', 'transfert_entree') AND variation > 0)
    OR (type IN ('transfert_sortie', 'distribution') AND variation < 0)
    OR type IN ('ajustement_inventaire', 'annulation')
  ),
  CHECK (type <> 'reception' OR reception_id IS NOT NULL),
  CHECK (type <> 'ajustement_inventaire' OR inventaire_id IS NOT NULL),
  CHECK (type <> 'distribution' OR fuel_transaction_id IS NOT NULL),
  CHECK (type NOT IN ('transfert_sortie', 'transfert_entree') OR transfert_id IS NOT NULL),
  CHECK (type <> 'annulation' OR annule_mouvement_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_mouvements_carburant_stockage ON public.mouvements_carburant(stockage_id, date_mouvement);
CREATE INDEX IF NOT EXISTS idx_mouvements_carburant_statut ON public.mouvements_carburant(statut) WHERE statut = 'a_valider';
CREATE INDEX IF NOT EXISTS idx_mouvements_carburant_transfert ON public.mouvements_carburant(transfert_id) WHERE transfert_id IS NOT NULL;

-- Seuls les champs de decision changent, une seule fois, et jamais de
-- suppression (hors contexte interne sans JWT : purge de demonstration).
CREATE OR REPLACE FUNCTION public.garde_mouvement_carburant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un mouvement de carburant ne se supprime pas : annulez-le' USING ERRCODE = '42501';
  END IF;
  IF OLD.statut <> 'a_valider'
     OR NEW.stockage_id IS DISTINCT FROM OLD.stockage_id OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.variation IS DISTINCT FROM OLD.variation OR NEW.date_mouvement IS DISTINCT FROM OLD.date_mouvement
     OR NEW.saisi_par IS DISTINCT FROM OLD.saisi_par OR NEW.reference_piece IS DISTINCT FROM OLD.reference_piece THEN
    RAISE EXCEPTION 'Mouvement fige : seule une decision sur un mouvement a valider est possible' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_mouvement ON public.mouvements_carburant;
CREATE TRIGGER garde_mouvement BEFORE UPDATE OR DELETE ON public.mouvements_carburant
  FOR EACH ROW EXECUTE FUNCTION public.garde_mouvement_carburant();

-- 5. Droits : lecture selon module et site ; aucune ecriture directe sauf
-- le referentiel des stockages (creation et modification, pas de suppression).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stockages_carburant', 'receptions_carburant',
                           'inventaires_carburant', 'mouvements_carburant'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS lecture_module ON public.stockages_carburant;
CREATE POLICY lecture_module ON public.stockages_carburant FOR SELECT TO authenticated
  USING ((public.has_module_view('fuel') AND public.site_permis(site_id)) OR public.is_admin());
GRANT INSERT (id, code, libelle, type, site_id, capacite_litres, seuil_alerte_litres, actif, cree_par),
      UPDATE (libelle, capacite_litres, seuil_alerte_litres, actif)
  ON public.stockages_carburant TO authenticated;
DROP POLICY IF EXISTS creation_module ON public.stockages_carburant;
CREATE POLICY creation_module ON public.stockages_carburant FOR INSERT TO authenticated
  WITH CHECK (public.has_module_write('fuel') AND public.site_permis(site_id));
DROP POLICY IF EXISTS modification_module ON public.stockages_carburant;
CREATE POLICY modification_module ON public.stockages_carburant FOR UPDATE TO authenticated
  USING (public.has_module_write('fuel') AND public.site_permis(site_id))
  WITH CHECK (public.has_module_write('fuel') AND public.site_permis(site_id));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['receptions_carburant', 'inventaires_carburant', 'mouvements_carburant'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated
      USING (public.is_admin() OR (public.has_module_view(''fuel'') AND EXISTS (
        SELECT 1 FROM public.stockages_carburant s WHERE s.id = stockage_id AND public.site_permis(s.site_id))))', t);
  END LOOP;
END $$;

-- L'ancien solde saisi a la main devient une archive en lecture seule.
REVOKE INSERT, UPDATE, DELETE ON public.fuel_stocks FROM authenticated;
-- Un plein enregistre n'est plus supprimable depuis le navigateur.
REVOKE DELETE ON public.fuel_transactions FROM authenticated;

-- 6. Fonctions utilitaires
CREATE OR REPLACE FUNCTION public.stockage_ecrivable(p_stockage_id uuid)
RETURNS public.stockages_carburant
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s public.stockages_carburant;
BEGIN
  IF NOT public.has_module_write('fuel') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur le carburant requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM public.stockages_carburant WHERE id = p_stockage_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stockage introuvable' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(s.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : stockage d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF NOT s.actif THEN
    RAISE EXCEPTION 'Stockage % inactif', s.code USING ERRCODE = '22023';
  END IF;
  RETURN s;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.stockage_ecrivable(uuid) FROM PUBLIC, anon, authenticated;

-- Solde valide d'un stockage : connu seulement apres un premier inventaire
-- valide (ouverture) ; NULL avant (« sans donnees »).
CREATE OR REPLACE FUNCTION public.solde_stockage_carburant(p_stockage_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.inventaires_carburant i
                            WHERE i.stockage_id = p_stockage_id AND i.statut = 'valide')
              THEN coalesce((SELECT sum(m.variation) FROM public.mouvements_carburant m
                              WHERE m.stockage_id = p_stockage_id AND m.statut = 'valide'), 0)
         END;
$$;
REVOKE EXECUTE ON FUNCTION public.solde_stockage_carburant(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validation_carburant_separee()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT (s.value ->> 'value') <> 'false' FROM public.settings s
                    WHERE s.key = 'carburant_validation_separee'), true);
$$;
REVOKE EXECUTE ON FUNCTION public.validation_carburant_separee() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validation_carburant_separee() TO authenticated;

-- 7. Reception d'une livraison CBG
CREATE OR REPLACE FUNCTION public.receptionner_livraison_cbg(
  p_livraison_id uuid, p_stockage_id uuid, p_date timestamptz, p_volume_mesure numeric,
  p_volume_accepte numeric, p_methode text, p_motif_ecart text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s public.stockages_carburant := public.stockage_ecrivable(p_stockage_id);
        l public.livraisons_carburant_cbg; v_id uuid; v_motif text := nullif(btrim(coalesce(p_motif_ecart, '')), '');
BEGIN
  SELECT * INTO l FROM public.livraisons_carburant_cbg WHERE id = p_livraison_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Livraison introuvable' USING ERRCODE = '22023';
  END IF;
  IF l.site_id <> s.site_id THEN
    RAISE EXCEPTION 'Le stockage % n''est pas sur le site de la livraison', s.code USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.receptions_carburant WHERE livraison_id = p_livraison_id) THEN
    RAISE EXCEPTION 'Livraison % deja receptionnee', l.reference USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date de reception requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_volume_mesure IS NULL OR p_volume_mesure <= 0 OR p_volume_accepte IS NULL OR p_volume_accepte <= 0
     OR p_volume_accepte > p_volume_mesure THEN
    RAISE EXCEPTION 'Volumes mesure et accepte positifs, accepte au plus egal au mesure' USING ERRCODE = '22023';
  END IF;
  IF p_methode NOT IN ('jauge', 'pige', 'compteur', 'autre') THEN
    RAISE EXCEPTION 'Methode de mesure inconnue' USING ERRCODE = '22023';
  END IF;
  IF (p_volume_accepte <> l.volume_litres OR p_volume_mesure <> l.volume_litres) AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Ecart avec le volume du document CBG : motif requis' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.receptions_carburant (livraison_id, stockage_id, date_reception, volume_mesure,
    volume_accepte, methode_mesure, motif_ecart, cree_par)
  VALUES (p_livraison_id, p_stockage_id, p_date, p_volume_mesure, p_volume_accepte, p_methode, v_motif, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.mouvements_carburant (stockage_id, type, variation, date_mouvement, reference_piece,
    reception_id, saisi_par)
  VALUES (p_stockage_id, 'reception', p_volume_accepte, p_date, l.reference, v_id, auth.uid());
  RETURN v_id;
END;
$$;

-- 8. Transfert entre stockages
CREATE OR REPLACE FUNCTION public.transferer_carburant(
  p_source_id uuid, p_destination_id uuid, p_litres numeric, p_date timestamptz,
  p_reference text DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE src public.stockages_carburant := public.stockage_ecrivable(p_source_id);
        dst public.stockages_carburant := public.stockage_ecrivable(p_destination_id);
        v_transfert uuid := gen_random_uuid();
BEGIN
  IF src.id = dst.id THEN
    RAISE EXCEPTION 'Source et destination identiques' USING ERRCODE = '22023';
  END IF;
  IF p_litres IS NULL OR p_litres <= 0 THEN
    RAISE EXCEPTION 'Quantite positive requise' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date du transfert requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.mouvements_carburant (stockage_id, type, variation, date_mouvement, reference_piece,
    transfert_id, note, saisi_par)
  VALUES (src.id, 'transfert_sortie', -p_litres, p_date, nullif(btrim(coalesce(p_reference, '')), ''), v_transfert,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid()),
         (dst.id, 'transfert_entree', p_litres, p_date, nullif(btrim(coalesce(p_reference, '')), ''), v_transfert,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  RETURN v_transfert;
END;
$$;

-- 9. Inventaire : le solde theorique est fige au moment de la saisie.
CREATE OR REPLACE FUNCTION public.saisir_inventaire_carburant(
  p_stockage_id uuid, p_date timestamptz, p_volume_mesure numeric, p_methode text, p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s public.stockages_carburant := public.stockage_ecrivable(p_stockage_id);
        v_theorique numeric; v_id uuid;
BEGIN
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date de mesure requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_volume_mesure IS NULL OR p_volume_mesure < 0 OR p_volume_mesure > s.capacite_litres THEN
    RAISE EXCEPTION 'Volume mesure entre 0 et la capacite du stockage (% L)', s.capacite_litres USING ERRCODE = '22023';
  END IF;
  IF p_methode NOT IN ('jauge', 'pige', 'compteur', 'autre') THEN
    RAISE EXCEPTION 'Methode de mesure inconnue' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inventaires_carburant WHERE stockage_id = s.id AND statut = 'a_valider') THEN
    RAISE EXCEPTION 'Un inventaire de ce stockage attend deja une decision' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mouvements_carburant WHERE stockage_id = s.id AND statut = 'a_valider') THEN
    RAISE EXCEPTION 'Des mouvements de ce stockage attendent une decision : traitez-les avant l''inventaire'
      USING ERRCODE = '22023';
  END IF;
  v_theorique := public.solde_stockage_carburant(s.id);
  INSERT INTO public.inventaires_carburant (stockage_id, date_mesure, volume_mesure, methode_mesure,
    solde_theorique, ecart, note, cree_par)
  VALUES (s.id, p_date, p_volume_mesure, p_methode, v_theorique,
          p_volume_mesure - coalesce(v_theorique, 0), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decider_inventaire_carburant(p_id uuid, p_valider boolean, p_motif text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.inventaires_carburant; s public.stockages_carburant;
        v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_actuel numeric;
BEGIN
  SELECT * INTO i FROM public.inventaires_carburant WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR i.statut <> 'a_valider' THEN
    RAISE EXCEPTION 'Inventaire introuvable ou deja decide' USING ERRCODE = '22023';
  END IF;
  s := public.stockage_ecrivable(i.stockage_id);
  IF public.validation_carburant_separee() AND i.cree_par = auth.uid() THEN
    RAISE EXCEPTION 'La decision revient a une autre personne que l''auteur de la saisie' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(p_valider, false) THEN
    IF v_motif IS NULL THEN
      RAISE EXCEPTION 'Motif de rejet requis' USING ERRCODE = '22023';
    END IF;
    UPDATE public.inventaires_carburant SET statut = 'rejete', motif_decision = v_motif,
      decide_par = auth.uid(), decide_le = now() WHERE id = p_id;
    RETURN 'rejete';
  END IF;
  v_actuel := public.solde_stockage_carburant(s.id);
  IF v_actuel IS DISTINCT FROM i.solde_theorique THEN
    RAISE EXCEPTION 'Le solde a change depuis la mesure : saisissez un nouvel inventaire' USING ERRCODE = '22023';
  END IF;
  -- Ajustement egal a l'ecart. Un premier inventaire ouvre le stock ; a zero
  -- il ne cree aucun mouvement (variation non nulle exigee).
  IF i.ecart <> 0 THEN
    INSERT INTO public.mouvements_carburant (stockage_id, type, variation, date_mouvement, reference_piece,
      inventaire_id, statut, note, saisi_par, decide_par, decide_le)
    VALUES (s.id, 'ajustement_inventaire', i.ecart, i.date_mesure, 'INV-' || left(i.id::text, 8), i.id, 'valide',
            coalesce(v_motif, i.note), i.cree_par, auth.uid(), now());
  END IF;
  UPDATE public.inventaires_carburant SET statut = 'valide', motif_decision = v_motif,
    decide_par = auth.uid(), decide_le = now() WHERE id = p_id;
  RETURN 'valide';
END;
$$;

-- 10. Decision sur un mouvement (reception, transfert, distribution, annulation)
CREATE OR REPLACE FUNCTION public.decider_mouvement_carburant(p_id uuid, p_valider boolean, p_motif text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m public.mouvements_carburant; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
        v_ids uuid[]; v_id uuid; n integer;
BEGIN
  SELECT * INTO m FROM public.mouvements_carburant WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR m.statut <> 'a_valider' THEN
    RAISE EXCEPTION 'Mouvement introuvable ou deja decide' USING ERRCODE = '22023';
  END IF;
  IF m.type = 'ajustement_inventaire' THEN
    RAISE EXCEPTION 'Un ajustement se decide par l''inventaire' USING ERRCODE = '22023';
  END IF;
  -- Un transfert se decide en bloc (sortie et entree).
  IF m.transfert_id IS NOT NULL THEN
    SELECT array_agg(id) INTO v_ids FROM public.mouvements_carburant
     WHERE transfert_id = m.transfert_id AND statut = 'a_valider';
  ELSE
    v_ids := ARRAY[m.id];
  END IF;
  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT * INTO m FROM public.mouvements_carburant WHERE id = v_id FOR UPDATE;
    PERFORM public.stockage_ecrivable(m.stockage_id);
    IF public.validation_carburant_separee() AND m.saisi_par = auth.uid() THEN
      RAISE EXCEPTION 'La decision revient a une autre personne que l''auteur de la saisie' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF NOT coalesce(p_valider, false) AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif de rejet requis' USING ERRCODE = '22023';
  END IF;
  -- Valider exige un stock ouvert par un inventaire : sinon le solde
  -- ignorerait le contenu initial du stockage.
  IF coalesce(p_valider, false) AND EXISTS (
       SELECT 1 FROM public.mouvements_carburant x WHERE x.id = ANY(v_ids)
          AND public.solde_stockage_carburant(x.stockage_id) IS NULL) THEN
    RAISE EXCEPTION 'Stockage non ouvert : validez d''abord un inventaire initial' USING ERRCODE = '22023';
  END IF;
  UPDATE public.mouvements_carburant
     SET statut = CASE WHEN coalesce(p_valider, false) THEN 'valide' ELSE 'rejete' END,
         motif_decision = v_motif, decide_par = auth.uid(), decide_le = now()
   WHERE id = ANY(v_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- 11. Annulation d'un mouvement valide : contre-mouvement a valider.
CREATE OR REPLACE FUNCTION public.annuler_mouvement_carburant(p_id uuid, p_motif text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m public.mouvements_carburant; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
        r record; n integer := 0;
BEGIN
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif d''annulation requis' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO m FROM public.mouvements_carburant WHERE id = p_id;
  IF NOT FOUND OR m.statut <> 'valide' OR m.type IN ('annulation', 'ajustement_inventaire') THEN
    RAISE EXCEPTION 'Seul un mouvement valide (hors ajustement et annulation) peut etre annule' USING ERRCODE = '22023';
  END IF;
  FOR r IN SELECT * FROM public.mouvements_carburant
            WHERE (m.transfert_id IS NOT NULL AND transfert_id = m.transfert_id) OR (m.transfert_id IS NULL AND id = m.id)
  LOOP
    PERFORM public.stockage_ecrivable(r.stockage_id);
    IF EXISTS (SELECT 1 FROM public.mouvements_carburant WHERE annule_mouvement_id = r.id) THEN
      RAISE EXCEPTION 'Mouvement n° % deja annule ou en cours d''annulation', r.numero USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.mouvements_carburant (stockage_id, type, variation, date_mouvement, reference_piece,
      annule_mouvement_id, note, saisi_par)
    VALUES (r.stockage_id, 'annulation', -r.variation, now(), 'ANN-' || r.numero, r.id, v_motif, auth.uid());
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- 12. Distribution depuis un stockage : la fiche carburant (D-028) accepte
-- un stockage par ligne. Signature inchangee ; le stockage est optionnel
-- (plein pris hors stockage suivi, par exemple a une station CBG).
CREATE OR REPLACE FUNCTION public.saisir_carburant(
  p_fiche_id uuid, p_prix_litre numeric, p_fournisseur text, p_lignes jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE f public.fiches_terrain := public.fiche_ouverte(p_fiche_id, 'carburant'); l jsonb; n integer := 0;
        v_litres numeric; v_tx uuid; s public.stockages_carburant;
BEGIN
  IF EXISTS (SELECT 1 FROM public.fuel_transactions WHERE reference LIKE f.numero || '-%') THEN
    RAISE EXCEPTION 'Fiche % deja saisie', f.numero USING ERRCODE = '22023';
  END IF;
  FOR l IN SELECT x FROM jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) AS t(x) LOOP
    v_litres := (l ->> 'litres')::numeric;
    IF v_litres IS NULL OR v_litres <= 0 OR nullif(l ->> 'vehicle_id', '') IS NULL THEN
      RAISE EXCEPTION 'Engin et quantite en litres positive requis (ligne %)', n + 1 USING ERRCODE = '22023';
    END IF;
    n := n + 1;
    INSERT INTO public.fuel_transactions (transaction_date, vehicle_id, driver_id, volume_liters, quantity, unit_price,
      total_cost, total_amount, transaction_type, supplier, reference, site_id, odometer_reading, notes, created_by)
    VALUES (f.date_fiche, (l ->> 'vehicle_id')::uuid, nullif(l ->> 'driver_id', '')::uuid, v_litres, v_litres,
      NULL, NULL, NULL, 'refuel', 'CBG', f.numero || '-' || lpad(n::text, 2, '0'), f.site_id,
      nullif(l ->> 'compteur', '')::numeric, 'Fiche ' || f.numero, auth.uid())
    RETURNING id INTO v_tx;
    IF nullif(l ->> 'stockage_id', '') IS NOT NULL THEN
      s := public.stockage_ecrivable((l ->> 'stockage_id')::uuid);
      IF s.site_id <> f.site_id THEN
        RAISE EXCEPTION 'Stockage % hors du site de la fiche (ligne %)', s.code, n USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.mouvements_carburant (stockage_id, type, variation, date_mouvement, reference_piece,
        fuel_transaction_id, saisi_par)
      VALUES (s.id, 'distribution', -v_litres, f.date_fiche::timestamptz, f.numero || '-' || lpad(n::text, 2, '0'),
        v_tx, auth.uid());
    END IF;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'Aucune ligne a saisir' USING ERRCODE = '22023'; END IF;
  RETURN n;
END;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'receptionner_livraison_cbg(uuid, uuid, timestamptz, numeric, numeric, text, text)',
    'transferer_carburant(uuid, uuid, numeric, timestamptz, text, text)',
    'saisir_inventaire_carburant(uuid, timestamptz, numeric, text, text)',
    'decider_inventaire_carburant(uuid, boolean, text)',
    'decider_mouvement_carburant(uuid, boolean, text)',
    'annuler_mouvement_carburant(uuid, text)',
    'saisir_carburant(uuid, numeric, text, jsonb)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;

-- 13. Situation des stockages (lecture, perimetre applique par la RLS des
-- tables sous-jacentes).
CREATE OR REPLACE VIEW public.v_stocks_carburant WITH (security_invoker = true) AS
SELECT s.id, s.code, s.libelle, s.type, s.site_id, s.capacite_litres, s.seuil_alerte_litres, s.actif,
       CASE WHEN inv.date_mesure IS NOT NULL THEN coalesce(v.solde, 0) END AS solde_litres,
       coalesce(v.en_attente, 0) AS en_attente_litres,
       coalesce(v.mouvements_en_attente, 0) AS mouvements_en_attente,
       v.dernier_mouvement,
       inv.date_mesure AS dernier_inventaire,
       inv.ecart AS dernier_ecart_inventaire
  FROM public.stockages_carburant s
  LEFT JOIN LATERAL (
    SELECT sum(m.variation) FILTER (WHERE m.statut = 'valide') AS solde,
           sum(m.variation) FILTER (WHERE m.statut = 'a_valider') AS en_attente,
           count(*) FILTER (WHERE m.statut = 'a_valider')::integer AS mouvements_en_attente,
           max(m.date_mouvement) FILTER (WHERE m.statut = 'valide') AS dernier_mouvement
      FROM public.mouvements_carburant m WHERE m.stockage_id = s.id
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT i.date_mesure, i.ecart FROM public.inventaires_carburant i
     WHERE i.stockage_id = s.id AND i.statut = 'valide'
     ORDER BY i.date_mesure DESC LIMIT 1
  ) inv ON true;
GRANT SELECT ON public.v_stocks_carburant TO authenticated;

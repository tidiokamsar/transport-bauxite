/*
  # Correctifs de la revue independante a posteriori (D-072), partie 1 :
  # D-041 a D-047 (constats R1)

  Les fonctions remplacees reprennent leur corps exact (derniere migration
  qui les definit) ; seuls les controles indiques s'ajoutent.

  1. Carburant (D-041)
     - R1-1 : l'annulation d'un transfert cree des contre-mouvements lies par
       un lot commun (transfert_id neuf) : ils se decident ensemble, jamais
       un sur deux.
     - R1-2 : une annulation rejetee ne bloque plus une nouvelle annulation
       (unicite de annule_mouvement_id limitee aux annulations non rejetees).
     - R1-3 : fiche_ouverte exige le perimetre du site de la fiche ;
       saisir_carburant exige le perimetre de l'engin de chaque ligne.
     - R1-4 : lecture du registre (stockages, receptions, inventaires,
       mouvements) bornee au perimetre, administrateur compris.
     - R1-12 : stockage_ecrivable verrouille le stockage (FOR UPDATE) : saisie
       d'inventaire et decisions sur un meme stockage sont serialisees.
  2. Releves kilometriques (D-043), R1-13 : saisie et correction verrouillent
     l'engin (et le voyage) : pas de releve en double par concurrence.
  3. Stocks (D-044)
     - R1-5 : politiques heritees « Admins full access » retirees ; depots
       et mouvements lus selon le perimetre du site du depot.
     - R1-6 : stock_disponible (SECURITY DEFINER) n'est plus executable par
       les comptes ; la quantite se lit par v_stock_depots (RLS).
  4. Sites (D-047)
     - R1-7 : site_ferme_le n'est plus executable par les comptes (le motif
       d'une fermeture hors perimetre n'est plus revele) ; la garde du
       dispatch l'appelle en SECURITY DEFINER.
     - R1-8 : une levee est datee entre le debut de la fermeture et
       maintenant, et au plus tard a sa fin prevue.
     - R1-9 : une fermeture d'infrastructure porte le site de
       l'infrastructure (cle etrangere composite).
  5. R1-10 (D-042) : DELETE retire aux comptes sur les tables qui le
     gardaient encore (factures fournisseur et lignes, clients, customers,
     expenses, documents, fuel_types, stock_categories).

  Non corrige ici : R1-11 (nouvelle reception d'une livraison CBG apres
  annulation, decision de modele a prendre). Idempotent.
*/

-- 1. Carburant ---------------------------------------------------------------

-- R1-2 : unicite des annulations non rejetees.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.mouvements_carburant WHERE annule_mouvement_id IS NOT NULL AND statut <> 'rejete'
              GROUP BY annule_mouvement_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Doublons d''annulation non rejetee dans mouvements_carburant : a traiter avant la migration';
  END IF;
END $$;
ALTER TABLE public.mouvements_carburant DROP CONSTRAINT IF EXISTS mouvements_carburant_annule_mouvement_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_mouvements_carburant_annulation_active
  ON public.mouvements_carburant(annule_mouvement_id) WHERE annule_mouvement_id IS NOT NULL AND statut <> 'rejete';

-- R1-12 : le stockage est verrouille par toute ecriture (fonction volatile).
CREATE OR REPLACE FUNCTION public.stockage_ecrivable(p_stockage_id uuid)
RETURNS public.stockages_carburant
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE s public.stockages_carburant;
BEGIN
  IF NOT public.has_module_write('fuel') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur le carburant requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM public.stockages_carburant WHERE id = p_stockage_id FOR UPDATE;
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

-- R1-1, R1-2 : contre-mouvements d'un transfert dans un lot commun ; une
-- annulation rejetee ne compte plus.
CREATE OR REPLACE FUNCTION public.annuler_mouvement_carburant(p_id uuid, p_motif text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m public.mouvements_carburant; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
        r record; n integer := 0; v_lot uuid;
BEGIN
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif d''annulation requis' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO m FROM public.mouvements_carburant WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR m.statut <> 'valide' OR m.type IN ('annulation', 'ajustement_inventaire') THEN
    RAISE EXCEPTION 'Seul un mouvement valide (hors ajustement et annulation) peut etre annule' USING ERRCODE = '22023';
  END IF;
  -- Un transfert s'annule en bloc : ses contre-mouvements partagent un lot.
  v_lot := CASE WHEN m.transfert_id IS NOT NULL THEN gen_random_uuid() END;
  FOR r IN SELECT * FROM public.mouvements_carburant
            WHERE (m.transfert_id IS NOT NULL AND transfert_id = m.transfert_id) OR (m.transfert_id IS NULL AND id = m.id)
            ORDER BY stockage_id
            FOR UPDATE
  LOOP
    PERFORM public.stockage_ecrivable(r.stockage_id);
    IF EXISTS (SELECT 1 FROM public.mouvements_carburant WHERE annule_mouvement_id = r.id AND statut <> 'rejete') THEN
      RAISE EXCEPTION 'Mouvement n° % deja annule ou en cours d''annulation', r.numero USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.mouvements_carburant (stockage_id, type, variation, date_mouvement, reference_piece,
      annule_mouvement_id, transfert_id, note, saisi_par)
    VALUES (r.stockage_id, 'annulation', -r.variation, now(), 'ANN-' || r.numero, r.id, v_lot, v_motif, auth.uid());
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- R1-3 : une fiche ne s'ecrit que dans le perimetre de son site.
CREATE OR REPLACE FUNCTION public.fiche_ouverte(p_id uuid, p_type text)
RETURNS public.fiches_terrain
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  f public.fiches_terrain;
BEGIN
  SELECT * INTO f FROM public.fiches_terrain WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiche introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_type IS NOT NULL AND f.type <> p_type THEN
    RAISE EXCEPTION 'Cette fiche n''est pas une fiche de ce type' USING ERRCODE = '22023';
  END IF;
  IF NOT public.has_module_write(public.fiche_module(f.type)) THEN
    RAISE EXCEPTION 'Droit d''ecriture requis pour ce type de fiche' USING ERRCODE = '42501';
  END IF;
  IF NOT public.site_permis(f.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : fiche d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF f.statut IN ('saisie', 'annulee') THEN
    RAISE EXCEPTION 'Fiche % close (%)', f.numero, f.statut USING ERRCODE = '22023';
  END IF;
  RETURN f;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fiche_ouverte(uuid, text) FROM PUBLIC, anon, authenticated;

-- R1-3 : perimetre de l'engin de chaque ligne de la fiche carburant.
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
    IF NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = (l ->> 'vehicle_id')::uuid) THEN
      RAISE EXCEPTION 'Engin introuvable (ligne %)', n + 1 USING ERRCODE = '22023';
    END IF;
    IF NOT public.vehicule_permis((l ->> 'vehicle_id')::uuid) THEN
      RAISE EXCEPTION 'Hors perimetre : engin d''un autre site (ligne %)', n + 1 USING ERRCODE = '42501';
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
REVOKE EXECUTE ON FUNCTION public.saisir_carburant(uuid, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisir_carburant(uuid, numeric, text, jsonb) TO authenticated;

-- R1-4 : lecture du registre bornee au perimetre, administrateur compris.
DROP POLICY IF EXISTS lecture_module ON public.stockages_carburant;
CREATE POLICY lecture_module ON public.stockages_carburant FOR SELECT TO authenticated
  USING ((public.has_module_view('fuel') OR public.is_admin()) AND public.site_permis(site_id));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['receptions_carburant', 'inventaires_carburant', 'mouvements_carburant'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', t);
    EXECUTE format('CREATE POLICY lecture_module ON public.%I FOR SELECT TO authenticated
      USING ((public.has_module_view(''fuel'') OR public.is_admin()) AND EXISTS (
        SELECT 1 FROM public.stockages_carburant s WHERE s.id = stockage_id AND public.site_permis(s.site_id)))', t);
  END LOOP;
END $$;

-- 2. Releves kilometriques (R1-13) --------------------------------------------

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
  -- Verrou de l'engin : deux saisies simultanees ne passent pas toutes deux
  -- les controles de coherence et d'unicite.
  SELECT * INTO v FROM public.vehicles WHERE id = p_vehicle_id FOR NO KEY UPDATE;
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
    SELECT * INTO t FROM public.trips WHERE id = p_trip_id FOR NO KEY UPDATE;
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Releve introuvable ou deja corrige' USING ERRCODE = '22023';
  END IF;
  -- Verrou de l'engin avant le controle de coherence (saisies concurrentes).
  SELECT * INTO v FROM public.vehicles WHERE id = r.vehicle_id FOR NO KEY UPDATE;
  IF EXISTS (SELECT 1 FROM public.releves_compteur WHERE remplace_releve_id = p_id) THEN
    RAISE EXCEPTION 'Releve introuvable ou deja corrige' USING ERRCODE = '22023';
  END IF;
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

-- 3. Stocks (R1-5, R1-6) -------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['warehouses', 'stock_items', 'stock_movements'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture_module ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ecriture_module ON public.%I', t);
  END LOOP;
END $$;
CREATE POLICY lecture_module ON public.warehouses FOR SELECT TO authenticated
  USING ((public.has_module_view('stock') OR public.is_admin()) AND public.site_permis(site_id));
CREATE POLICY ecriture_module ON public.warehouses FOR ALL TO authenticated
  USING ((public.has_module_write('stock') OR public.is_admin()) AND public.site_permis(site_id))
  WITH CHECK ((public.has_module_write('stock') OR public.is_admin()) AND public.site_permis(site_id));
-- Le catalogue des articles n'est pas rattache a un site.
CREATE POLICY lecture_module ON public.stock_items FOR SELECT TO authenticated
  USING (public.has_module_view('stock') OR public.is_admin());
CREATE POLICY ecriture_module ON public.stock_items FOR ALL TO authenticated
  USING (public.has_module_write('stock') OR public.is_admin())
  WITH CHECK (public.has_module_write('stock') OR public.is_admin());
-- Un mouvement se lit si l'un de ses depots est dans le perimetre.
CREATE POLICY lecture_module ON public.stock_movements FOR SELECT TO authenticated
  USING ((public.has_module_view('stock') OR public.is_admin())
         AND ((from_warehouse_id IS NOT NULL AND public.bon_commande_permis(from_warehouse_id))
              OR (to_warehouse_id IS NOT NULL AND public.bon_commande_permis(to_warehouse_id))));

REVOKE EXECUTE ON FUNCTION public.stock_disponible(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 4. Sites (R1-7, R1-8, R1-9) --------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.site_ferme_le(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_ferme_le(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.garde_dispatch_site_ferme()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE t public.trips; v_motif text;
BEGIN
  IF NEW.decision = 'refusee' THEN RETURN NEW; END IF;
  SELECT * INTO t FROM public.trips WHERE id = NEW.trip_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_motif := coalesce(public.site_ferme_le(t.departure_site_id, t.planned_date),
                      public.site_ferme_le(t.arrival_site_id, t.planned_date));
  IF v_motif IS NOT NULL THEN
    RAISE EXCEPTION 'Site ferme le % : % (affectation refusee)', to_char(t.planned_date, 'DD/MM/YYYY'), v_motif
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_dispatch_site_ferme() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.garde_fermeture_site()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF OLD.levee_le IS NOT NULL THEN
    RAISE EXCEPTION 'Fermeture deja levee' USING ERRCODE = '22023';
  END IF;
  IF NEW.levee_le IS NULL OR nullif(btrim(coalesce(NEW.motif_levee, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Levee : date et motif requis' USING ERRCODE = '22023';
  END IF;
  -- Une levee ne reecrit pas l'historique : ni avant le debut, ni dans le
  -- futur, ni apres la fin prevue (la fermeture est alors deja terminee).
  IF NEW.levee_le < OLD.debut OR NEW.levee_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Levee datee entre le debut de la fermeture et maintenant' USING ERRCODE = '22023';
  END IF;
  IF OLD.fin IS NOT NULL AND NEW.levee_le > OLD.fin THEN
    RAISE EXCEPTION 'Fermeture deja terminee a sa fin prevue : rien a lever' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.fermetures_site f JOIN public.infrastructures_site i ON i.id = f.infrastructure_id
              WHERE i.site_id <> f.site_id) THEN
    RAISE EXCEPTION 'Fermetures rattachees a l''infrastructure d''un autre site : a corriger avant la migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'infrastructures_site_id_site_key') THEN
    ALTER TABLE public.infrastructures_site ADD CONSTRAINT infrastructures_site_id_site_key UNIQUE (id, site_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fermetures_site_infrastructure_meme_site_fkey') THEN
    ALTER TABLE public.fermetures_site ADD CONSTRAINT fermetures_site_infrastructure_meme_site_fkey
      FOREIGN KEY (infrastructure_id, site_id) REFERENCES public.infrastructures_site(id, site_id) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.fermetures_site VALIDATE CONSTRAINT fermetures_site_infrastructure_meme_site_fkey;

-- 5. Suppressions encore accordees (R1-10) -------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['factures_fournisseur', 'factures_fournisseur_lignes', 'clients', 'customers', 'expenses',
                           'documents', 'fuel_types', 'stock_categories'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('REVOKE DELETE ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

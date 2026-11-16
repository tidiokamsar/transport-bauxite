/*
  # Stocks avances et pneumatiques (D-067, lot 17, modules 17 et 12)

  Extension du registre des stocks (D-044), de la reception d'achat (D-053)
  et du registre des pneus (D-052), sans second registre.

  1. Reservations (`reservations_stock`) : quantite reservee d'un article
     dans un depot pour un ordre de travail, un engin ou une affectation
     nommee. Elle est deduite du stock libre sans sortie physique : une
     sortie ou un transfert sans reservation ne prend que le stock libre
     (stock moins reservations) ; une reservation ne depasse jamais le
     stock libre. Levee motivee (`lever_reservation_stock`) ou consommation
     par une sortie qui la cite (`mouvement_stock`, `p_reservation`) ; une
     sortie annulee rend sa quantite a la reservation.
  2. Lots et numeros de serie : attribut `stock_items.suivi` (aucun, lot,
     serie), modifiable seulement sans stock. Les quantites d'un article
     suivi sont detaillees par lot ou serie (`stock_mouvements_lots`,
     append-only) a chaque mouvement : entree (y compris a la reception
     d'un bon de commande), sortie, transfert, retour, annulation et
     inventaire par lot (`inventorier_lot_stock`). Une sortie d'un article
     suivi exige ses lots ou series, disponibles au depot ; un numero de
     serie n'est jamais deux fois en stock. Vues `v_stock_lots` et
     `v_stock_lots_mouvements` (trace jusqu'a la sortie).
  3. Valorisation au cout moyen pondere (`valorisation_articles_stock`),
     recalculee par le serveur dans l'ordre d'enregistrement des
     mouvements a partir des seules entrees valorisees (prix saisi ou prix
     de la reception D-053). Une entree sans prix ajoute une quantite non
     valorisee : la valeur devient « partielle » (valeur des seules
     quantites valorisees), jamais estimee ; le prix de reference de
     l'article n'est pas utilise. Vues `v_valorisation_articles`,
     `v_valorisation_stock` (article x depot), `v_valorisation_depots`.
  4. Reception de pneus : une ligne de bon de commande peut porter un
     modele de pneu (marque, modele, dimension). A la reception, chaque
     pneu recu est enregistre par `enregistrer_pneu` (numero saisi, prix
     de la ligne, fournisseur du bon, site du depot, numero de
     reception) ; lien `receptions_achat_pneus`. Une reception comportant
     des pneus ne s'annule pas (l'entree d'un pneu ne s'annule pas,
     D-052).
  5. `v_pneus_performance` : par marque et modele (et par marque), sur les
     pneus reformes aux mesures completes de `v_pneus` : km moyens, cout au
     km, duree de vie, taux de reforme precoce (seuil
     `pneu_reforme_precoce_km`, administrateur ; sans seuil : sans
     donnees), avec les nombres de pneus pris en compte et exclus.

  Integration sur main (2026-11-16, renumerotee au-dessus de D-064 et
  D-065, D-070) : chaque fonction recreee part de sa derniere definition
  sur main.
  - `mouvement_stock` (20261115180000) passe de 11 a 13 arguments ; l'ancienne
    signature est retiree (aucune surcharge) ; les appels a 11 arguments ou
    par nom restent valides. Avec une reservation, le perimetre du depot est
    controle avant toute lecture de la reservation ; l'ordre de travail de la
    reservation est verrouille avant elle (meme ordre de verrous que la
    cloture d'un ordre).
  - `inventorier_stock`, `annuler_mouvement_stock` (20261115180000) :
    controles d'origine conserves ; les gardes D-061 et D-072 R4
    (`garde_mouvement_ordre`, `garde_annulation_mouvement_ordre`) sont des
    declencheurs et restent inchanges.
  - `annuler_reception` part de 20261120102000 (D-072 R3-5 : refus si la base
    payable du bon descend sous l'engage et le paye), plus le refus d'une
    reception avec pneus.
  - `receptionner_bon_commande`, `enregistrer_bon_commande` (20261117090000).
  - `valider_reglage` part de 20261121090000 (cle
    `planification_cloture_separee`, D-063), avec par avance les deux cles de
    D-065 (20261121120000) ; `seuil_pneus` de 20261116210000.
  - D-072 R1-6 : `stock_disponible` reste retiree aux comptes ; les nouvelles
    fonctions de quantite (`stock_reserve`, `stock_libre`,
    `stock_lot_disponible`) le sont aussi ; les quantites se lisent par les
    vues (RLS du perimetre).
  - D-075 : reservations lues dans le perimetre du site du depot ; vues de
    lots, de disponibilite et de valorisation limitees aux depots visibles.
  - Valorisation : le CMP est celui de l'article (referentiel global,
    D-044), quantites et valeurs celles des seuls depots visibles ; montants
    en GNF (le registre et les bons de commande n'ont pas de devise : celle
    des bons est GNF, D-055).
  - Reservations d'un ordre de travail levees, avec motif, a sa cloture
    (termine ou annule) ; une reservation sur un ordre prend un verrou
    partage de l'ordre.

  Idempotent.
*/

-- 1. Structure ---------------------------------------------------------------

ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS suivi text NOT NULL DEFAULT 'aucun';
ALTER TABLE public.stock_items DROP CONSTRAINT IF EXISTS stock_items_suivi_check;
ALTER TABLE public.stock_items ADD CONSTRAINT stock_items_suivi_check CHECK (suivi IN ('aucun', 'lot', 'serie'));
GRANT INSERT (suivi), UPDATE (suivi) ON public.stock_items TO authenticated;

CREATE SEQUENCE IF NOT EXISTS public.reservations_stock_numero_seq;
REVOKE ALL ON SEQUENCE public.reservations_stock_numero_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON SEQUENCE public.reservations_stock_numero_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.reservations_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  quantite integer NOT NULL CHECK (quantite > 0),
  maintenance_order_id uuid REFERENCES public.maintenance_orders(id),
  vehicle_id uuid REFERENCES public.vehicles(id),
  affectation text,
  note text,
  reserve_par uuid REFERENCES auth.users(id),
  reserve_le timestamptz NOT NULL DEFAULT clock_timestamp(),
  levee_le timestamptz,
  levee_par uuid REFERENCES auth.users(id),
  motif_levee text,
  CHECK (maintenance_order_id IS NOT NULL OR vehicle_id IS NOT NULL OR nullif(btrim(coalesce(affectation, '')), '') IS NOT NULL),
  CHECK (levee_le IS NULL OR nullif(btrim(coalesce(motif_levee, '')), '') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_reservations_stock_article ON public.reservations_stock(stock_item_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_reservations_stock_ordre ON public.reservations_stock(maintenance_order_id);

ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES public.reservations_stock(id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reservation ON public.stock_movements(reservation_id);

-- Ordre d'enregistrement du cout moyen (revue C2) : created_at vaut now(),
-- le debut de la transaction ; deux transactions concurrentes s'y classent
-- dans l'ordre de leur debut, pas de leur ecriture. enregistre_le prend
-- clock_timestamp() a l'insertion, faite sous le verrou de l'article par
-- toutes les fonctions d'ecriture. Existant : created_at (puis numero MVT
-- au tri), sans meilleure information. Aucune ecriture du navigateur.
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS enregistre_le timestamptz;
UPDATE public.stock_movements SET enregistre_le = coalesce(created_at, movement_date, now()) WHERE enregistre_le IS NULL;
ALTER TABLE public.stock_movements ALTER COLUMN enregistre_le SET DEFAULT clock_timestamp();
ALTER TABLE public.stock_movements ALTER COLUMN enregistre_le SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_enregistrement ON public.stock_movements(stock_item_id, enregistre_le);

CREATE TABLE IF NOT EXISTS public.stock_mouvements_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_movement_id uuid NOT NULL REFERENCES public.stock_movements(id),
  code text NOT NULL CHECK (btrim(code) <> ''),
  quantite integer NOT NULL CHECK (quantite <> 0)
);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_lots_mouvement ON public.stock_mouvements_lots(stock_movement_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_lots_code ON public.stock_mouvements_lots(code);

ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS pneu_marque text;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS pneu_modele text;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS pneu_dimension text;
ALTER TABLE public.purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_pneu_check;
ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_pneu_check CHECK (
  (pneu_marque IS NULL) = (pneu_modele IS NULL) AND (pneu_marque IS NULL OR stock_item_id IS NULL));

CREATE TABLE IF NOT EXISTS public.receptions_achat_pneus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_ligne_id uuid NOT NULL REFERENCES public.receptions_achat_lignes(id),
  tire_id uuid NOT NULL UNIQUE REFERENCES public.tires(id)
);
CREATE INDEX IF NOT EXISTS idx_receptions_achat_pneus_ligne ON public.receptions_achat_pneus(reception_ligne_id);

-- 2. Droits : lecture bornee, ecriture par fonctions serveur seulement --------

ALTER TABLE public.reservations_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_mouvements_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receptions_achat_pneus ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reservations_stock, public.stock_mouvements_lots, public.receptions_achat_pneus FROM anon, authenticated;
GRANT SELECT ON public.reservations_stock, public.stock_mouvements_lots, public.receptions_achat_pneus TO authenticated;
GRANT ALL ON public.reservations_stock, public.stock_mouvements_lots, public.receptions_achat_pneus TO service_role;

DROP POLICY IF EXISTS lecture ON public.reservations_stock;
-- Perimetre du site du depot (D-038, D-075), comme les mouvements.
CREATE POLICY lecture ON public.reservations_stock FOR SELECT TO authenticated
  USING ((public.has_module_view('stock') OR public.is_admin()) AND public.bon_commande_permis(warehouse_id));
DROP POLICY IF EXISTS lecture ON public.stock_mouvements_lots;
CREATE POLICY lecture ON public.stock_mouvements_lots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stock_movements m WHERE m.id = stock_movement_id));
DROP POLICY IF EXISTS lecture ON public.receptions_achat_pneus;
CREATE POLICY lecture ON public.receptions_achat_pneus FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.receptions_achat_lignes l WHERE l.id = reception_ligne_id));

-- Lignes de lots et liens de reception : append-only (memes gardes que les tables meres).
DROP TRIGGER IF EXISTS garde_mouvement_stock ON public.stock_mouvements_lots;
CREATE TRIGGER garde_mouvement_stock BEFORE UPDATE OR DELETE ON public.stock_mouvements_lots
  FOR EACH ROW EXECUTE FUNCTION public.garde_mouvement_stock();
DROP TRIGGER IF EXISTS garde_append_only ON public.receptions_achat_pneus;
CREATE TRIGGER garde_append_only BEFORE UPDATE OR DELETE ON public.receptions_achat_pneus
  FOR EACH ROW EXECUTE FUNCTION public.garde_append_only_achats();

-- Une reservation ne se supprime pas ; seule la levee (une fois) la modifie.
CREATE OR REPLACE FUNCTION public.garde_reservation_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' OR OLD.levee_le IS NOT NULL OR NEW.levee_le IS NULL
     OR (NEW.numero, NEW.stock_item_id, NEW.warehouse_id, NEW.quantite, NEW.maintenance_order_id, NEW.vehicle_id,
         NEW.affectation, NEW.reserve_par, NEW.reserve_le)
        IS DISTINCT FROM
        (OLD.numero, OLD.stock_item_id, OLD.warehouse_id, OLD.quantite, OLD.maintenance_order_id, OLD.vehicle_id,
         OLD.affectation, OLD.reserve_par, OLD.reserve_le) THEN
    RAISE EXCEPTION 'Une reservation ne se modifie ni ne se supprime : la lever avec motif' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_reservation_stock ON public.reservations_stock;
CREATE TRIGGER garde_reservation_stock BEFORE UPDATE OR DELETE ON public.reservations_stock
  FOR EACH ROW EXECUTE FUNCTION public.garde_reservation_stock();

-- Le mode de suivi ne change que sans stock (les lots resteraient incoherents).
CREATE OR REPLACE FUNCTION public.garde_suivi_article()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.suivi IS DISTINCT FROM OLD.suivi
     AND EXISTS (SELECT 1 FROM public.v_stock_depots d WHERE d.stock_item_id = OLD.id AND d.quantite <> 0) THEN
    RAISE EXCEPTION 'Suivi par lot ou numero de serie : modifiable seulement quand l''article n''a plus de stock'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_suivi_article() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garde_suivi_article ON public.stock_items;
CREATE TRIGGER garde_suivi_article BEFORE UPDATE OF suivi ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.garde_suivi_article();

-- 3. Vues et fonctions de lecture ---------------------------------------------

-- v_stock_depots (D-044, 20261115180000) recreee a l'identique, plus la borne
-- des depots visibles (revue C5, D-075) : un transfert depuis un depot du
-- perimetre ne donne plus la variation d'un depot d'un autre site. Les
-- fonctions SECURITY DEFINER qui la lisent (cache quantity_in_stock, garde du
-- suivi) gardent la vue complete (proprietaire). Limite consignee :
-- stock_items.quantity_in_stock reste un total tous depots lisible avec le
-- droit stocks (lot separe).
CREATE OR REPLACE VIEW public.v_stock_depots WITH (security_invoker = true) AS
SELECT x.stock_item_id, x.warehouse_id, sum(x.variation) AS quantite
  FROM (
    SELECT m.stock_item_id, m.from_warehouse_id AS warehouse_id, -m.quantity AS variation
      FROM public.stock_movements m
     WHERE m.from_warehouse_id IS NOT NULL AND m.movement_type IN ('exit', 'transfer', 'annulation')
    UNION ALL
    SELECT m.stock_item_id, m.to_warehouse_id, m.quantity
      FROM public.stock_movements m
     WHERE m.to_warehouse_id IS NOT NULL AND m.movement_type IN ('entry', 'return', 'transfer', 'annulation', 'adjustment')
  ) x
 WHERE EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = x.warehouse_id)
 GROUP BY x.stock_item_id, x.warehouse_id;
GRANT SELECT ON public.v_stock_depots TO authenticated;

CREATE OR REPLACE VIEW public.v_reservations_stock WITH (security_invoker = true) AS
SELECT r.id, r.numero, r.stock_item_id, r.warehouse_id, r.quantite, r.maintenance_order_id, r.vehicle_id, r.affectation,
       r.note, r.reserve_par, r.reserve_le, r.levee_le, r.levee_par, r.motif_levee,
       coalesce(c.consomme, 0) AS quantite_consommee,
       CASE WHEN r.levee_le IS NOT NULL THEN 0 ELSE greatest(r.quantite - coalesce(c.consomme, 0), 0) END AS quantite_restante,
       CASE WHEN r.levee_le IS NOT NULL THEN 'levee'
            WHEN coalesce(c.consomme, 0) >= r.quantite THEN 'consommee'
            ELSE 'active' END AS statut
  FROM public.reservations_stock r
  LEFT JOIN LATERAL (
    SELECT sum(m.quantity)::integer AS consomme FROM public.stock_movements m
     WHERE m.reservation_id = r.id AND m.movement_type = 'exit'
       AND NOT EXISTS (SELECT 1 FROM public.stock_movements a WHERE a.annule_mouvement_id = m.id)) c ON true;
GRANT SELECT ON public.v_reservations_stock TO authenticated;

-- Quantite reservee et non consommee d'un article dans un depot. Fonctions
-- internes (SECURITY DEFINER, sans controle de perimetre) : retirees aux
-- comptes comme stock_disponible (D-072 R1-6) ; lecture par les vues.
CREATE OR REPLACE FUNCTION public.stock_reserve(p_article uuid, p_depot uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(r.quantite_restante), 0)::integer FROM public.v_reservations_stock r
   WHERE r.stock_item_id = p_article AND r.warehouse_id = p_depot AND r.statut = 'active';
$$;

-- Stock libre : stock physique moins reservations (negatif si une
-- reservation n'est plus couverte apres un inventaire).
CREATE OR REPLACE FUNCTION public.stock_libre(p_article uuid, p_depot uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.stock_disponible(p_article, p_depot) - public.stock_reserve(p_article, p_depot);
$$;

CREATE OR REPLACE VIEW public.v_stock_disponibilite WITH (security_invoker = true) AS
SELECT d.stock_item_id, d.warehouse_id, d.quantite, coalesce(r.reserve, 0) AS reserve,
       d.quantite - coalesce(r.reserve, 0) AS libre
  FROM public.v_stock_depots d
  LEFT JOIN (
    SELECT x.stock_item_id, x.warehouse_id, sum(x.quantite_restante)::integer AS reserve
      FROM public.v_reservations_stock x WHERE x.statut = 'active'
     GROUP BY x.stock_item_id, x.warehouse_id) r
    ON r.stock_item_id = d.stock_item_id AND r.warehouse_id = d.warehouse_id
 -- Depots visibles seulement (RLS de warehouses) : un transfert depuis un
 -- depot du perimetre ne donne pas la quantite d'un depot d'un autre site.
 WHERE EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = d.warehouse_id);
GRANT SELECT ON public.v_stock_disponibilite TO authenticated;

-- Quantite par lot ou numero de serie et par depot (meme convention de
-- signe que v_stock_depots).
CREATE OR REPLACE VIEW public.v_stock_lots WITH (security_invoker = true) AS
SELECT x.stock_item_id, x.warehouse_id, x.code, sum(x.variation)::integer AS quantite
  FROM (
    SELECT m.stock_item_id, m.from_warehouse_id AS warehouse_id, l.code, -l.quantite AS variation
      FROM public.stock_mouvements_lots l JOIN public.stock_movements m ON m.id = l.stock_movement_id
     WHERE m.from_warehouse_id IS NOT NULL AND m.movement_type IN ('exit', 'transfer', 'annulation')
    UNION ALL
    SELECT m.stock_item_id, m.to_warehouse_id, l.code, l.quantite
      FROM public.stock_mouvements_lots l JOIN public.stock_movements m ON m.id = l.stock_movement_id
     WHERE m.to_warehouse_id IS NOT NULL AND m.movement_type IN ('entry', 'return', 'transfer', 'annulation', 'adjustment')
  ) x
 WHERE EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = x.warehouse_id)
 GROUP BY x.stock_item_id, x.warehouse_id, x.code;
GRANT SELECT ON public.v_stock_lots TO authenticated;

-- Trace d'un lot ou d'un numero de serie : chaque mouvement qui le cite.
CREATE OR REPLACE VIEW public.v_stock_lots_mouvements WITH (security_invoker = true) AS
SELECT l.id, l.code, l.quantite, m.id AS stock_movement_id, m.movement_number, m.movement_date, m.movement_type,
       m.stock_item_id, m.from_warehouse_id, m.to_warehouse_id, m.reference_piece, m.vehicle_id, m.maintenance_order_id,
       m.reservation_id, m.annule_mouvement_id,
       EXISTS (SELECT 1 FROM public.stock_movements a WHERE a.annule_mouvement_id = m.id) AS annule
  FROM public.stock_mouvements_lots l JOIN public.stock_movements m ON m.id = l.stock_movement_id;
GRANT SELECT ON public.v_stock_lots_mouvements TO authenticated;

CREATE OR REPLACE FUNCTION public.stock_lot_disponible(p_article uuid, p_depot uuid, p_code text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(l.quantite), 0)::integer FROM public.v_stock_lots l
   WHERE l.stock_item_id = p_article AND l.warehouse_id = p_depot AND l.code = upper(btrim(coalesce(p_code, '')));
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY['stock_reserve(uuid, uuid)', 'stock_libre(uuid, uuid)', 'stock_lot_disponible(uuid, uuid, text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', sig);
  END LOOP;
END $$;

-- 4. Lots : controle des lignes d'un mouvement --------------------------------
-- p_lots : [{"code": text, "quantite": int}] ; pour un numero de serie, la
-- quantite vaut 1 (implicite). Renvoie les lignes normalisees.
CREATE OR REPLACE FUNCTION public.controler_lots_mouvement(
  p_article public.stock_items, p_type text, p_quantite integer, p_depot_source uuid, p_lots jsonb
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e jsonb; v_code text; v_q integer; v_codes text[] := ARRAY[]::text[]; v_total integer := 0; v_sortie jsonb := '[]'::jsonb;
        v_libelle text := CASE p_article.suivi WHEN 'serie' THEN 'numero de serie' ELSE 'lot' END;
BEGIN
  IF p_article.suivi = 'aucun' THEN
    IF p_lots IS NOT NULL AND jsonb_typeof(p_lots) = 'array' AND jsonb_array_length(p_lots) > 0 THEN
      RAISE EXCEPTION 'Article % sans suivi par lot ni numero de serie : ne pas saisir de lot', p_article.item_code USING ERRCODE = '22023';
    END IF;
    RETURN '[]'::jsonb;
  END IF;
  IF p_lots IS NULL OR jsonb_typeof(p_lots) <> 'array' OR jsonb_array_length(p_lots) = 0 THEN
    RAISE EXCEPTION 'Article % suivi par % : % requis pour chaque mouvement', p_article.item_code, v_libelle, v_libelle
      USING ERRCODE = '22023';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p_lots) LOOP
    v_code := nullif(upper(btrim(coalesce(e ->> 'code', ''))), '');
    IF v_code IS NULL THEN RAISE EXCEPTION 'Code de % vide', v_libelle USING ERRCODE = '22023'; END IF;
    IF (e ->> 'quantite') IS NOT NULL AND (e ->> 'quantite') !~ '^\d+$' THEN
      RAISE EXCEPTION '% % : quantite entiere positive requise', v_libelle, v_code USING ERRCODE = '22023';
    END IF;
    v_q := coalesce((e ->> 'quantite')::integer, CASE WHEN p_article.suivi = 'serie' THEN 1 END);
    IF v_q IS NULL OR v_q <= 0 THEN
      RAISE EXCEPTION '% % : quantite positive requise', v_libelle, v_code USING ERRCODE = '22023';
    END IF;
    IF p_article.suivi = 'serie' AND v_q <> 1 THEN
      RAISE EXCEPTION 'Numero de serie % : une seule unite par numero', v_code USING ERRCODE = '22023';
    END IF;
    IF v_code = ANY (v_codes) THEN RAISE EXCEPTION '% % saisi deux fois', v_libelle, v_code USING ERRCODE = '22023'; END IF;
    IF p_type IN ('exit', 'transfer') THEN
      IF v_q > public.stock_lot_disponible(p_article.id, p_depot_source, v_code) THEN
        RAISE EXCEPTION '% % : % disponible(s) au depot source', v_libelle, v_code,
          public.stock_lot_disponible(p_article.id, p_depot_source, v_code) USING ERRCODE = '22023';
      END IF;
    ELSIF p_article.suivi = 'serie'
          AND (SELECT coalesce(sum(l.quantite), 0) FROM public.v_stock_lots l
                WHERE l.stock_item_id = p_article.id AND l.code = v_code) <> 0 THEN
      RAISE EXCEPTION 'Numero de serie % deja en stock', v_code USING ERRCODE = '23505';
    END IF;
    v_codes := v_codes || v_code;
    v_total := v_total + v_q;
    v_sortie := v_sortie || jsonb_build_array(jsonb_build_object('code', v_code, 'quantite', v_q));
  END LOOP;
  IF v_total <> p_quantite THEN
    RAISE EXCEPTION 'Total des % (%) different de la quantite du mouvement (%)', v_libelle, v_total, p_quantite USING ERRCODE = '22023';
  END IF;
  RETURN v_sortie;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.controler_lots_mouvement(public.stock_items, text, integer, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- 5. Mouvements : reservations et lots ------------------------------------------
-- Nouvelle signature (lots, reservation) : l'ancienne est retiree pour
-- qu'un appel a 11 arguments reste sans ambiguite.
DROP FUNCTION IF EXISTS public.mouvement_stock(uuid, text, integer, uuid, uuid, timestamptz, bigint, text, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.mouvement_stock(
  p_article uuid, p_type text, p_quantite integer, p_depot_source uuid DEFAULT NULL, p_depot_destination uuid DEFAULT NULL,
  p_date timestamptz DEFAULT now(), p_prix_unitaire bigint DEFAULT NULL, p_reference text DEFAULT NULL,
  p_vehicle_id uuid DEFAULT NULL, p_ordre_maintenance uuid DEFAULT NULL, p_note text DEFAULT NULL,
  p_lots jsonb DEFAULT NULL, p_reservation uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.stock_items; v_dispo integer; v_reserve integer; v_id uuid; r record; v_lots jsonb;
        v_res public.reservations_stock; v_ordre uuid := p_ordre_maintenance; v_vehicle uuid := p_vehicle_id;
BEGIN
  IF NOT public.has_module_write('stock') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les stocks requis' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('entry', 'exit', 'transfer', 'return') THEN
    RAISE EXCEPTION 'Type de mouvement inconnu (inventaire et annulation ont leur fonction)' USING ERRCODE = '22023';
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'Quantite positive requise' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date du mouvement requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_prix_unitaire IS NOT NULL AND p_prix_unitaire < 0 THEN
    RAISE EXCEPTION 'Prix unitaire positif ou absent' USING ERRCODE = '22023';
  END IF;
  -- Verrou de l'article : deux sorties ou reservations simultanees ne depassent pas le stock.
  SELECT * INTO a FROM public.stock_items WHERE id = p_article FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(a.active, true) THEN
    RAISE EXCEPTION 'Article introuvable ou archive' USING ERRCODE = '22023';
  END IF;
  IF p_reservation IS NOT NULL THEN
    IF p_type <> 'exit' THEN
      RAISE EXCEPTION 'Seule une sortie consomme une reservation' USING ERRCODE = '22023';
    END IF;
    IF p_depot_source IS NULL THEN RAISE EXCEPTION 'Depot source requis' USING ERRCODE = '22023'; END IF;
    -- Perimetre du depot avant toute lecture de la reservation (D-075) : une
    -- reservation d'un autre depot n'est jamais decrite.
    PERFORM public.depot_ecrivable(p_depot_source);
    SELECT * INTO v_res FROM public.reservations_stock WHERE id = p_reservation;
    IF NOT FOUND OR v_res.stock_item_id <> p_article OR v_res.warehouse_id <> p_depot_source THEN
      RAISE EXCEPTION 'Reservation introuvable, d''un autre article ou d''un autre depot' USING ERRCODE = '22023';
    END IF;
    -- Verrous dans l'ordre de la cloture d'un ordre de travail (ordre, puis
    -- reservation) : pas d'interblocage avec lever_reservations_ordre.
    IF v_res.maintenance_order_id IS NOT NULL THEN
      PERFORM 1 FROM public.maintenance_orders WHERE id = v_res.maintenance_order_id FOR UPDATE;
    END IF;
    PERFORM 1 FROM public.reservations_stock WHERE id = p_reservation FOR UPDATE;
    SELECT * INTO r FROM public.v_reservations_stock WHERE id = p_reservation;
    IF r.statut <> 'active' THEN
      RAISE EXCEPTION 'Reservation % levee ou deja consommee', r.numero USING ERRCODE = '22023';
    END IF;
    IF p_quantite > r.quantite_restante THEN
      RAISE EXCEPTION 'Sortie superieure au reste de la reservation % (%)', r.numero, r.quantite_restante USING ERRCODE = '22023';
    END IF;
    IF r.maintenance_order_id IS NOT NULL THEN
      -- L'engin est celui de l'ordre, controle par garde_mouvement_ordre (D-061, D-072 R4).
      IF v_ordre IS NULL THEN v_ordre := r.maintenance_order_id;
      ELSIF v_ordre <> r.maintenance_order_id THEN
        RAISE EXCEPTION 'Reservation % faite pour un autre ordre de travail', r.numero USING ERRCODE = '22023';
      END IF;
    ELSIF r.vehicle_id IS NOT NULL THEN
      IF v_vehicle IS NULL THEN v_vehicle := r.vehicle_id;
      ELSIF v_vehicle <> r.vehicle_id THEN
        RAISE EXCEPTION 'Reservation % faite pour un autre engin', r.numero USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;
  IF p_type IN ('exit', 'transfer') THEN
    IF p_depot_source IS NULL THEN RAISE EXCEPTION 'Depot source requis' USING ERRCODE = '22023'; END IF;
    PERFORM public.depot_ecrivable(p_depot_source);
    v_dispo := public.stock_disponible(p_article, p_depot_source);
    IF p_quantite > v_dispo THEN
      RAISE EXCEPTION 'Stock insuffisant : % % disponible(s) au depot source', v_dispo, a.unit_of_measure USING ERRCODE = '22023';
    END IF;
    IF p_reservation IS NULL THEN
      v_reserve := public.stock_reserve(p_article, p_depot_source);
      IF p_quantite > v_dispo - v_reserve THEN
        RAISE EXCEPTION 'Stock libre insuffisant : % % hors reservations (% reserve(s)) ; citer la reservation a consommer',
          greatest(v_dispo - v_reserve, 0), a.unit_of_measure, v_reserve USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;
  IF p_type IN ('entry', 'return', 'transfer') THEN
    IF p_depot_destination IS NULL THEN RAISE EXCEPTION 'Depot destination requis' USING ERRCODE = '22023'; END IF;
    PERFORM public.depot_ecrivable(p_depot_destination);
  END IF;
  IF p_type = 'transfer' AND p_depot_source = p_depot_destination THEN
    RAISE EXCEPTION 'Source et destination identiques' USING ERRCODE = '22023';
  END IF;
  v_lots := public.controler_lots_mouvement(a, p_type, p_quantite, p_depot_source, p_lots);
  INSERT INTO public.stock_movements (movement_number, movement_date, movement_type, stock_item_id, quantity, unit_price,
    total_value, from_warehouse_id, to_warehouse_id, reference_piece, vehicle_id, maintenance_order_id, notes, performed_by,
    reservation_id)
  VALUES (NULL, p_date, p_type, p_article, p_quantite, p_prix_unitaire,
    CASE WHEN p_prix_unitaire IS NOT NULL THEN p_prix_unitaire * p_quantite END,
    CASE WHEN p_type IN ('exit', 'transfer') THEN p_depot_source END,
    CASE WHEN p_type IN ('entry', 'return', 'transfer') THEN p_depot_destination END,
    nullif(btrim(coalesce(p_reference, '')), ''), v_vehicle, v_ordre,
    nullif(btrim(coalesce(p_note, '')), ''), auth.uid(), p_reservation)
  RETURNING id INTO v_id;
  INSERT INTO public.stock_mouvements_lots (stock_movement_id, code, quantite)
  SELECT v_id, x ->> 'code', (x ->> 'quantite')::integer FROM jsonb_array_elements(v_lots) x;
  RETURN v_id;
END;
$$;

-- Un article suivi s'inventorie par lot ou numero de serie.
CREATE OR REPLACE FUNCTION public.inventorier_stock(p_article uuid, p_depot uuid, p_quantite_comptee integer, p_motif text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.stock_items; v_dispo integer; v_ecart integer; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.has_module_write('stock') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les stocks requis' USING ERRCODE = '42501';
  END IF;
  IF p_quantite_comptee IS NULL OR p_quantite_comptee < 0 THEN
    RAISE EXCEPTION 'Quantite comptee positive ou nulle requise' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO a FROM public.stock_items WHERE id = p_article FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable' USING ERRCODE = '22023'; END IF;
  IF a.suivi <> 'aucun' THEN
    RAISE EXCEPTION 'Article % suivi par lot ou numero de serie : inventorier lot par lot', a.item_code USING ERRCODE = '22023';
  END IF;
  PERFORM public.depot_ecrivable(p_depot);
  v_dispo := public.stock_disponible(p_article, p_depot);
  v_ecart := p_quantite_comptee - v_dispo;
  IF v_ecart = 0 THEN RETURN 0; END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Ecart d''inventaire de % : motif requis', v_ecart USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.stock_movements (movement_number, movement_date, movement_type, stock_item_id, quantity,
    to_warehouse_id, motif, notes, performed_by)
  VALUES (NULL, now(), 'adjustment', p_article, v_ecart, p_depot, v_motif,
          format('Inventaire : %s compte(s), %s en stock', p_quantite_comptee, v_dispo), auth.uid());
  RETURN v_ecart;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventorier_lot_stock(
  p_article uuid, p_depot uuid, p_code text, p_quantite_comptee integer, p_motif text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.stock_items; v_code text := nullif(upper(btrim(coalesce(p_code, ''))), ''); v_dispo integer; v_ecart integer;
        v_ailleurs text; v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_id uuid;
BEGIN
  IF NOT public.has_module_write('stock') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les stocks requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO a FROM public.stock_items WHERE id = p_article FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable' USING ERRCODE = '22023'; END IF;
  IF a.suivi = 'aucun' THEN
    RAISE EXCEPTION 'Article % sans suivi par lot : inventaire global', a.item_code USING ERRCODE = '22023';
  END IF;
  IF v_code IS NULL THEN RAISE EXCEPTION 'Lot ou numero de serie requis' USING ERRCODE = '22023'; END IF;
  IF p_quantite_comptee IS NULL OR p_quantite_comptee < 0 OR (a.suivi = 'serie' AND p_quantite_comptee > 1) THEN
    RAISE EXCEPTION 'Quantite comptee positive ou nulle requise (0 ou 1 pour un numero de serie)' USING ERRCODE = '22023';
  END IF;
  PERFORM public.depot_ecrivable(p_depot);
  v_dispo := public.stock_lot_disponible(p_article, p_depot, v_code);
  v_ecart := p_quantite_comptee - v_dispo;
  IF v_ecart = 0 THEN RETURN 0; END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Ecart d''inventaire de % sur %: motif requis', v_ecart, v_code USING ERRCODE = '22023';
  END IF;
  IF a.suivi = 'serie' AND v_ecart > 0 THEN
    -- Le code d'un depot hors perimetre n'est pas donne (D-075).
    SELECT CASE WHEN public.site_permis(w.site_id) THEN w.code ELSE 'd''un autre site' END INTO v_ailleurs
      FROM public.v_stock_lots l JOIN public.warehouses w ON w.id = l.warehouse_id
     WHERE l.stock_item_id = p_article AND l.code = v_code AND l.quantite <> 0 LIMIT 1;
    IF v_ailleurs IS NOT NULL THEN
      RAISE EXCEPTION 'Numero de serie % en stock au depot % : le transferer', v_code, v_ailleurs USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO public.stock_movements (movement_number, movement_date, movement_type, stock_item_id, quantity,
    to_warehouse_id, motif, notes, performed_by)
  VALUES (NULL, now(), 'adjustment', p_article, v_ecart, p_depot, v_motif,
          format('Inventaire du lot %s : %s compte(s), %s en stock', v_code, p_quantite_comptee, v_dispo), auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.stock_mouvements_lots (stock_movement_id, code, quantite) VALUES (v_id, v_code, v_ecart);
  RETURN v_ecart;
END;
$$;

-- Annulation : le contre-mouvement reprend les lots de l'original ; une
-- annulation ne laisse pas une reservation sans stock.
CREATE OR REPLACE FUNCTION public.annuler_mouvement_stock(p_id uuid, p_motif text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m public.stock_movements; a public.stock_items; v_source uuid; v_dest uuid; v_qte integer;
        v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_id uuid; v_dispo integer; v_reserve integer; l record;
BEGIN
  IF NOT public.has_module_write('stock') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les stocks requis' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif d''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO m FROM public.stock_movements WHERE id = p_id;
  IF NOT FOUND OR m.movement_type = 'annulation' THEN
    RAISE EXCEPTION 'Mouvement introuvable ou deja une annulation' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.stock_movements WHERE annule_mouvement_id = p_id) THEN
    RAISE EXCEPTION 'Mouvement % deja annule', m.movement_number USING ERRCODE = '22023';
  END IF;
  SELECT * INTO a FROM public.stock_items WHERE id = m.stock_item_id FOR UPDATE;
  -- Sous le verrou de l'article : deux annulations simultanees du meme
  -- mouvement ne passent pas toutes les deux.
  IF EXISTS (SELECT 1 FROM public.stock_movements WHERE annule_mouvement_id = p_id) THEN
    RAISE EXCEPTION 'Mouvement % deja annule', m.movement_number USING ERRCODE = '22023';
  END IF;
  -- Revue C7 : un mouvement sans lot, anterieur au passage de l'article en
  -- suivi par lot ou serie, laisserait les lots incoherents.
  IF a.suivi <> 'aucun' AND NOT EXISTS (SELECT 1 FROM public.stock_mouvements_lots x WHERE x.stock_movement_id = m.id) THEN
    RAISE EXCEPTION 'Mouvement % sans lot ni numero de serie, anterieur au suivi de l''article % : corriger par inventaire du lot',
      m.movement_number, a.item_code USING ERRCODE = '22023';
  END IF;
  -- Le contre-mouvement inverse les depots de l'original.
  IF m.movement_type = 'adjustment' THEN
    v_qte := abs(m.quantity);
    IF m.quantity > 0 THEN v_source := m.to_warehouse_id; ELSE v_dest := m.to_warehouse_id; END IF;
  ELSE
    v_qte := m.quantity;
    v_source := CASE WHEN m.movement_type IN ('entry', 'return', 'transfer') THEN m.to_warehouse_id END;
    v_dest := CASE WHEN m.movement_type IN ('exit', 'transfer') THEN m.from_warehouse_id END;
  END IF;
  IF v_source IS NOT NULL THEN
    PERFORM public.depot_ecrivable(v_source);
    v_dispo := public.stock_disponible(m.stock_item_id, v_source);
    IF v_qte > v_dispo THEN
      RAISE EXCEPTION 'Annulation impossible : % disponible(s) seulement au depot concerne', v_dispo USING ERRCODE = '22023';
    END IF;
    v_reserve := public.stock_reserve(m.stock_item_id, v_source);
    IF v_qte > v_dispo - v_reserve THEN
      RAISE EXCEPTION 'Annulation impossible : % reserve(s) au depot concerne ; lever la reservation d''abord', v_reserve
        USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_dest IS NOT NULL THEN PERFORM public.depot_ecrivable(v_dest); END IF;
  FOR l IN SELECT x.code, abs(x.quantite) AS q FROM public.stock_mouvements_lots x WHERE x.stock_movement_id = m.id LOOP
    IF v_source IS NOT NULL AND l.q > public.stock_lot_disponible(m.stock_item_id, v_source, l.code) THEN
      RAISE EXCEPTION 'Annulation impossible : lot ou serie % plus disponible au depot concerne', l.code USING ERRCODE = '22023';
    END IF;
    IF v_source IS NULL AND a.suivi = 'serie'
       AND (SELECT coalesce(sum(s.quantite), 0) FROM public.v_stock_lots s
             WHERE s.stock_item_id = m.stock_item_id AND s.code = l.code) <> 0 THEN
      RAISE EXCEPTION 'Annulation impossible : numero de serie % de nouveau en stock', l.code USING ERRCODE = '22023';
    END IF;
  END LOOP;
  INSERT INTO public.stock_movements (movement_number, movement_date, movement_type, stock_item_id, quantity,
    from_warehouse_id, to_warehouse_id, annule_mouvement_id, motif, notes, performed_by)
  VALUES (NULL, now(), 'annulation', m.stock_item_id, v_qte, v_source, v_dest, m.id, v_motif,
          'Annulation de ' || m.movement_number, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.stock_mouvements_lots (stock_movement_id, code, quantite)
  SELECT v_id, x.code, abs(x.quantite) FROM public.stock_mouvements_lots x WHERE x.stock_movement_id = m.id;
  RETURN v_id;
END;
$$;

-- 6. Reservations ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reserver_stock(
  p_article uuid, p_depot uuid, p_quantite integer, p_ordre_maintenance uuid DEFAULT NULL, p_vehicle_id uuid DEFAULT NULL,
  p_affectation text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE a public.stock_items; o public.maintenance_orders; v_libre integer; v_id uuid; v_vehicle uuid := p_vehicle_id;
        v_affectation text := nullif(btrim(coalesce(p_affectation, '')), '');
BEGIN
  IF NOT public.has_module_write('stock') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les stocks requis' USING ERRCODE = '42501';
  END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantite positive requise' USING ERRCODE = '22023'; END IF;
  SELECT * INTO a FROM public.stock_items WHERE id = p_article FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(a.active, true) THEN
    RAISE EXCEPTION 'Article introuvable ou archive' USING ERRCODE = '22023';
  END IF;
  IF p_depot IS NULL THEN RAISE EXCEPTION 'Depot requis' USING ERRCODE = '22023'; END IF;
  PERFORM public.depot_ecrivable(p_depot);
  IF p_ordre_maintenance IS NULL AND p_vehicle_id IS NULL AND v_affectation IS NULL THEN
    RAISE EXCEPTION 'Ordre de travail, engin ou affectation requis' USING ERRCODE = '22023';
  END IF;
  IF p_ordre_maintenance IS NOT NULL THEN
    -- Verrou partage : la cloture de l'ordre (lever_reservations_ordre) et
    -- une nouvelle reservation sont serialisees. Message unique : un ordre
    -- hors perimetre n'est pas distingue d'un ordre inexistant (D-075).
    SELECT * INTO o FROM public.maintenance_orders WHERE id = p_ordre_maintenance FOR SHARE;
    IF NOT FOUND OR NOT ((public.has_module_view('maintenance') OR public.is_admin()) AND public.ordre_travail_permis(o.site_id, o.vehicle_id)) THEN
      RAISE EXCEPTION 'Ordre de travail introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
    END IF;
    IF o.status NOT IN ('open', 'in_progress') THEN
      RAISE EXCEPTION 'Ordre % termine ou annule : aucune reservation' , o.work_order_number USING ERRCODE = '22023';
    END IF;
    -- L'engin de l'ordre n'est pas recopie (il peut changer tant qu'aucune
    -- piece n'est imputee, D-072 R4-3) : la sortie prend celui de l'ordre.
    IF v_vehicle IS NOT NULL AND o.vehicle_id IS NOT NULL AND v_vehicle <> o.vehicle_id THEN
      RAISE EXCEPTION 'L''engin differe de celui de l''ordre de travail' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_vehicle IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = v_vehicle) OR NOT public.vehicule_permis(v_vehicle) THEN
      RAISE EXCEPTION 'Engin introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
    END IF;
  END IF;
  v_libre := public.stock_libre(p_article, p_depot);
  IF p_quantite > v_libre THEN
    RAISE EXCEPTION 'Reservation impossible : % % libre(s) au depot (stock moins reservations)', greatest(v_libre, 0), a.unit_of_measure
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.reservations_stock (numero, stock_item_id, warehouse_id, quantite, maintenance_order_id, vehicle_id,
                                         affectation, note, reserve_par)
  VALUES ('RES-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.reservations_stock_numero_seq')::text, 5, '0'),
          p_article, p_depot, p_quantite, p_ordre_maintenance, v_vehicle, v_affectation,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.lever_reservation_stock(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r record; v_res public.reservations_stock; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF NOT public.has_module_write('stock') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les stocks requis' USING ERRCODE = '42501';
  END IF;
  IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif de la levee requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_res FROM public.reservations_stock WHERE id = p_id FOR UPDATE;
  -- Perimetre avant toute description de la reservation, message unique (D-075).
  IF NOT FOUND OR NOT public.bon_commande_permis(v_res.warehouse_id) THEN
    RAISE EXCEPTION 'Reservation introuvable ou hors de votre perimetre' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.v_reservations_stock WHERE id = p_id;
  IF r.statut <> 'active' THEN
    RAISE EXCEPTION 'Reservation % deja levee ou consommee', r.numero USING ERRCODE = '22023';
  END IF;
  UPDATE public.reservations_stock SET levee_le = now(), levee_par = auth.uid(), motif_levee = v_motif WHERE id = p_id;
END;
$$;

-- Cloture d'un ordre de travail (termine, ou annule par annuler_ordre_travail) :
-- ses reservations encore actives sont levees, avec un motif qui cite l'ordre
-- (levee_par : auteur de la cloture) ; la quantite redevient libre. Une reservation
-- entierement consommee reste « consommee ». Quel que soit le chemin
-- d'ecriture de l'ordre (ecran, fonction serveur), le declencheur s'applique.
CREATE OR REPLACE FUNCTION public.lever_reservations_ordre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status::text IN ('completed', 'cancelled') AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    UPDATE public.reservations_stock r
       SET levee_le = now(), levee_par = auth.uid(),
           motif_levee = format('Levee a la cloture de l''ordre %s (%s)', coalesce(NEW.work_order_number, NEW.id::text),
                                CASE NEW.status::text WHEN 'completed' THEN 'termine' ELSE 'annule' END)
     WHERE r.maintenance_order_id = NEW.id AND r.levee_le IS NULL
       AND r.quantite > coalesce((SELECT sum(m.quantity) FROM public.stock_movements m
                                   WHERE m.reservation_id = r.id AND m.movement_type = 'exit'
                                     AND NOT EXISTS (SELECT 1 FROM public.stock_movements x WHERE x.annule_mouvement_id = m.id)), 0);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lever_reservations_ordre() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS lever_reservations_ordre ON public.maintenance_orders;
CREATE TRIGGER lever_reservations_ordre AFTER UPDATE OF status ON public.maintenance_orders
  FOR EACH ROW EXECUTE FUNCTION public.lever_reservations_ordre();

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'mouvement_stock(uuid, text, integer, uuid, uuid, timestamptz, bigint, text, uuid, uuid, text, jsonb, uuid)',
    'inventorier_stock(uuid, uuid, integer, text)',
    'inventorier_lot_stock(uuid, uuid, text, integer, text)',
    'annuler_mouvement_stock(uuid, text)',
    'reserver_stock(uuid, uuid, integer, uuid, uuid, text, text)',
    'lever_reservation_stock(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;

-- 7. Valorisation au cout moyen pondere -----------------------------------------
-- Par article, tous depots confondus (l'article est un referentiel global,
-- D-044), dans l'ordre d'enregistrement des mouvements (enregistre_le, pris
-- sous le verrou de l'article, puis numero MVT) ; les controles de stock se
-- font a l'enregistrement : la quantite ne devient jamais negative.
-- Etat : quantite q, quantite non valorisee qnv, valeur v des quantites
-- valorisees (numeric, sans arrondi intermediaire) ; cmp = v / (q - qnv).
--   entree avec prix : v += q x prix ; entree sans prix : qnv += q ;
--   retour, excedent d'inventaire, annulation d'une sortie : entree au cmp,
--     meme composition que le stock present (non valorisee si aucun stock
--     valorise) ;
--   sortie, manquant d'inventaire, annulation d'un retour : sortie au cmp
--     (v et qnv reduits en proportion) ; stock nul : remise a zero ;
--   annulation d'une entree juste apres elle (aucun autre mouvement de
--     l'article entre les deux) : retrait exact, a son propre prix ;
--   annulation d'une entree apres d'autres mouvements (revue C1) : les
--     quantites de cette entree ne sont plus identifiables dans le stock,
--     elle sort au cmp du moment, comme une sortie, et l'article est
--     signale « a verifier » jusqu'au retour a un stock nul. Jamais de
--     valeur ramenee a 0 en silence.
-- Les transferts ne changent pas la valeur d'un article.
-- Ne rend que les articles presents (stock non nul) dans un depot du
-- perimetre de l'appelant (revue C4), et pour eux seulement le cout unitaire
-- et la part non valorisee, ni quantite ni valeur : quantites et valeurs
-- viennent de v_stock_depots (RLS du perimetre). Le cout unitaire reste celui
-- de l'article tous sites (limite consignee, D-067). Montants en GNF.
CREATE OR REPLACE FUNCTION public.valorisation_articles_stock()
RETURNS TABLE (stock_item_id uuid, cout_unitaire numeric, part_non_valorisee numeric, a_verifier boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e record; v_art uuid; v_dernier uuid; q numeric := 0; qnv numeric := 0; v numeric := 0; f numeric;
        v_verif boolean := false; v_action text;
BEGIN
  IF NOT (public.has_module_view('stock') OR public.is_admin()) THEN RETURN; END IF;
  FOR e IN
    WITH permis AS (
      SELECT x.stock_item_id
        FROM (
          SELECT m.stock_item_id, m.from_warehouse_id AS w, -m.quantity AS variation FROM public.stock_movements m
           WHERE m.from_warehouse_id IS NOT NULL AND m.movement_type IN ('exit', 'transfer', 'annulation')
          UNION ALL
          SELECT m.stock_item_id, m.to_warehouse_id, m.quantity FROM public.stock_movements m
           WHERE m.to_warehouse_id IS NOT NULL AND m.movement_type IN ('entry', 'return', 'transfer', 'annulation', 'adjustment')
        ) x
        JOIN public.warehouses wh ON wh.id = x.w
       WHERE public.site_permis(wh.site_id)
       GROUP BY x.stock_item_id, x.w
      HAVING sum(x.variation) <> 0
    )
    SELECT s.id, s.stock_item_id AS art, s.quantity::numeric AS qte, o.id AS origine, o.unit_price::numeric AS prix_origine,
           CASE
             WHEN s.movement_type = 'entry' AND s.unit_price IS NOT NULL THEN 'entree_prix'
             WHEN s.movement_type = 'entry' THEN 'entree_sans_prix'
             WHEN s.movement_type = 'return' OR (s.movement_type = 'adjustment' AND s.quantity > 0) THEN 'entree_cmp'
             WHEN s.movement_type = 'exit' OR s.movement_type = 'adjustment' THEN 'sortie_cmp'
             WHEN o.movement_type = 'entry' AND o.unit_price IS NOT NULL THEN 'retrait_prix'
             WHEN o.movement_type = 'entry' THEN 'retrait_sans_prix'
             WHEN o.movement_type = 'exit' OR (o.movement_type = 'adjustment' AND o.quantity < 0) THEN 'entree_cmp'
             ELSE 'sortie_cmp'
           END AS action,
           s.unit_price::numeric AS prix
      FROM public.stock_movements s
      LEFT JOIN public.stock_movements o ON o.id = s.annule_mouvement_id
     WHERE s.stock_item_id IN (SELECT p.stock_item_id FROM permis p)
       AND s.movement_type <> 'transfer' AND (s.movement_type <> 'annulation' OR o.movement_type <> 'transfer')
     ORDER BY s.stock_item_id, s.enregistre_le, substring(s.movement_number FROM '(\d+)$')::bigint NULLS FIRST, s.id
  LOOP
    IF v_art IS DISTINCT FROM e.art THEN
      IF v_art IS NOT NULL AND q > 0 THEN
        stock_item_id := v_art;
        cout_unitaire := CASE WHEN q - qnv > 0 THEN v / (q - qnv) END;
        part_non_valorisee := qnv / q;
        a_verifier := v_verif;
        RETURN NEXT;
      END IF;
      v_art := e.art; q := 0; qnv := 0; v := 0; v_verif := false; v_dernier := NULL;
    END IF;
    -- Annulation d'une entree apres d'autres mouvements : sortie au cmp (C1).
    v_action := e.action;
    IF v_action IN ('retrait_prix', 'retrait_sans_prix') AND e.origine IS DISTINCT FROM v_dernier THEN
      v_action := 'sortie_cmp';
      v_verif := true;
    END IF;
    CASE v_action
      WHEN 'entree_prix' THEN v := v + e.qte * e.prix; q := q + e.qte;
      WHEN 'entree_sans_prix' THEN qnv := qnv + e.qte; q := q + e.qte;
      WHEN 'entree_cmp' THEN
        IF q > qnv THEN f := abs(e.qte) / q; v := v + v * f; qnv := qnv + qnv * f;
        ELSE qnv := qnv + abs(e.qte); END IF;
        q := q + abs(e.qte);
      WHEN 'sortie_cmp' THEN
        IF abs(e.qte) >= q THEN q := 0; qnv := 0; v := 0;
        ELSE f := (q - abs(e.qte)) / q; v := v * f; qnv := qnv * f; q := q - abs(e.qte); END IF;
      WHEN 'retrait_prix' THEN
        q := q - e.qte;
        IF v < e.qte * e.prix_origine THEN v_verif := true; END IF;
        v := greatest(v - e.qte * e.prix_origine, 0);
      WHEN 'retrait_sans_prix' THEN
        q := q - e.qte;
        IF qnv < e.qte THEN v_verif := true; END IF;
        qnv := greatest(qnv - e.qte, 0);
      ELSE NULL;
    END CASE;
    v_dernier := e.id;
    IF q <= 0 THEN q := 0; qnv := 0; v := 0; v_verif := false; END IF;
    qnv := least(qnv, q);
    IF qnv < 0.001 THEN qnv := 0; END IF;
    IF q - qnv <= 0 THEN v := 0; END IF;
  END LOOP;
  IF v_art IS NOT NULL AND q > 0 THEN
    stock_item_id := v_art;
    cout_unitaire := CASE WHEN q - qnv > 0 THEN v / (q - qnv) END;
    part_non_valorisee := qnv / q;
    a_verifier := v_verif;
    RETURN NEXT;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.valorisation_articles_stock() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valorisation_articles_stock() TO authenticated, service_role;

-- Par article et depot visible : cmp de l'article ; la part non valorisee
-- se repartit en proportion des quantites (approximation consignee).
-- statut : complete (toutes les quantites valorisees), partielle (une
-- partie entree sans prix : valeur des seules quantites valorisees),
-- a_verifier (entree annulee apres d'autres mouvements, retiree au cmp),
-- sans_donnees (aucune quantite valorisee).
CREATE OR REPLACE VIEW public.v_valorisation_stock WITH (security_invoker = true) AS
SELECT d.stock_item_id, d.warehouse_id, d.quantite::integer AS quantite,
       round(a.cout_unitaire, 2) AS cmp,
       CASE WHEN a.cout_unitaire IS NOT NULL THEN round(d.quantite * a.part_non_valorisee, 3) END AS quantite_non_valorisee,
       CASE WHEN a.cout_unitaire IS NOT NULL
            THEN round(d.quantite * (1 - a.part_non_valorisee) * a.cout_unitaire)::bigint END AS valeur,
       CASE WHEN a.cout_unitaire IS NULL THEN 'sans_donnees'
            WHEN a.a_verifier THEN 'a_verifier'
            WHEN a.part_non_valorisee > 0 THEN 'partielle'
            ELSE 'complete' END AS statut,
       'GNF'::text AS devise
  FROM public.v_stock_depots d
  LEFT JOIN public.valorisation_articles_stock() a ON a.stock_item_id = d.stock_item_id
 WHERE d.quantite <> 0
   AND EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = d.warehouse_id);
GRANT SELECT ON public.v_valorisation_stock TO authenticated;

-- Par article, sur les depots visibles (somme des valeurs arrondies au franc).
CREATE OR REPLACE VIEW public.v_valorisation_articles WITH (security_invoker = true) AS
SELECT s.stock_item_id, sum(s.quantite)::integer AS quantite, sum(s.quantite_non_valorisee) AS quantite_non_valorisee,
       max(s.cmp) AS cmp, sum(s.valeur)::bigint AS valeur,
       CASE WHEN bool_and(s.statut = 'sans_donnees') THEN 'sans_donnees'
            WHEN bool_or(s.statut = 'a_verifier') THEN 'a_verifier'
            WHEN bool_or(s.statut = 'partielle') THEN 'partielle'
            ELSE 'complete' END AS statut,
       'GNF'::text AS devise
  FROM public.v_valorisation_stock s
 GROUP BY s.stock_item_id;
GRANT SELECT ON public.v_valorisation_articles TO authenticated;

CREATE OR REPLACE VIEW public.v_valorisation_depots WITH (security_invoker = true) AS
SELECT s.warehouse_id, count(*)::integer AS nb_articles,
       sum(s.valeur)::bigint AS valeur_connue,
       count(*) FILTER (WHERE s.statut = 'partielle')::integer AS nb_articles_partiels,
       count(*) FILTER (WHERE s.statut = 'sans_donnees')::integer AS nb_articles_sans_prix,
       count(*) FILTER (WHERE s.statut = 'a_verifier')::integer AS nb_articles_a_verifier,
       CASE WHEN bool_and(s.statut = 'complete') THEN 'complete'
            WHEN bool_and(s.statut = 'sans_donnees') THEN 'sans_donnees'
            WHEN bool_or(s.statut = 'a_verifier') THEN 'a_verifier'
            ELSE 'partielle' END AS statut,
       'GNF'::text AS devise
  FROM public.v_valorisation_stock s
 GROUP BY s.warehouse_id;
GRANT SELECT ON public.v_valorisation_depots TO authenticated;

-- 8. Achats : lignes de pneus et reception --------------------------------------
-- p_lignes : [{"article": uuid|null, "designation": text|null, "quantite": int, "prix_unitaire": int,
--              "pneu": {"marque": text, "modele": text, "dimension": text|null}|null}]
CREATE OR REPLACE FUNCTION public.enregistrer_bon_commande(
  p_fournisseur uuid, p_depot uuid, p_lignes jsonb, p_id uuid DEFAULT NULL, p_livraison_prevue date DEFAULT NULL,
  p_taxes bigint DEFAULT 0, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE po public.purchase_orders; l jsonb; a public.stock_items; v_id uuid; v_q integer; v_pu bigint; v_des text;
        v_sous_total bigint := 0; v_marque text; v_modele text; v_dimension text;
BEGIN
  IF NOT (public.has_module_write('purchases') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les achats requis' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = p_fournisseur AND coalesce(s.active, true)) THEN
    RAISE EXCEPTION 'Fournisseur introuvable ou inactif' USING ERRCODE = '22023';
  END IF;
  IF p_depot IS NULL THEN RAISE EXCEPTION 'Depot de livraison requis' USING ERRCODE = '22023'; END IF;
  PERFORM public.depot_ecrivable(p_depot);
  IF p_taxes IS NULL OR p_taxes < 0 THEN RAISE EXCEPTION 'Taxes : montant positif ou nul' USING ERRCODE = '22023'; END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Au moins une ligne requise' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.purchase_orders (po_number, po_date, supplier_id, warehouse_id, status, expected_delivery_date, notes, requested_by)
    VALUES (NULL, current_date, p_fournisseur, p_depot, 'draft', p_livraison_prevue, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    po := public.bon_commande_ecrivable(p_id, 'purchases');
    IF po.status <> 'draft' THEN RAISE EXCEPTION 'Seul un brouillon se modifie' USING ERRCODE = '22023'; END IF;
    v_id := p_id;
    DELETE FROM public.purchase_order_items WHERE purchase_order_id = v_id;
    UPDATE public.purchase_orders SET supplier_id = p_fournisseur, warehouse_id = p_depot, expected_delivery_date = p_livraison_prevue,
      notes = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now() WHERE id = v_id;
  END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_q := (l ->> 'quantite')::integer;
    v_pu := (l ->> 'prix_unitaire')::bigint;
    IF v_q IS NULL OR v_q <= 0 THEN RAISE EXCEPTION 'Quantite positive requise sur chaque ligne' USING ERRCODE = '22023'; END IF;
    IF v_pu IS NULL OR v_pu < 0 THEN RAISE EXCEPTION 'Prix unitaire requis sur chaque ligne' USING ERRCODE = '22023'; END IF;
    v_des := nullif(btrim(coalesce(l ->> 'designation', '')), '');
    v_marque := NULL; v_modele := NULL; v_dimension := NULL;
    IF jsonb_typeof(l -> 'pneu') = 'object' THEN
      v_marque := nullif(btrim(coalesce(l -> 'pneu' ->> 'marque', '')), '');
      v_modele := nullif(btrim(coalesce(l -> 'pneu' ->> 'modele', '')), '');
      v_dimension := nullif(btrim(coalesce(l -> 'pneu' ->> 'dimension', '')), '');
      IF v_marque IS NULL OR v_modele IS NULL THEN
        RAISE EXCEPTION 'Ligne de pneus : marque et modele requis' USING ERRCODE = '22023';
      END IF;
      IF nullif(l ->> 'article', '') IS NOT NULL THEN
        RAISE EXCEPTION 'Ligne de pneus : pas d''article du magasin (les pneus ont leur registre)' USING ERRCODE = '22023';
      END IF;
      v_des := coalesce(v_des, 'Pneu ' || v_marque || ' ' || v_modele || coalesce(' ' || v_dimension, ''));
    END IF;
    a := NULL;
    IF nullif(l ->> 'article', '') IS NOT NULL THEN
      SELECT * INTO a FROM public.stock_items WHERE id = (l ->> 'article')::uuid;
      IF NOT FOUND OR NOT coalesce(a.active, true) THEN RAISE EXCEPTION 'Article introuvable ou archive' USING ERRCODE = '22023'; END IF;
      v_des := coalesce(v_des, a.name);
    END IF;
    IF v_des IS NULL THEN RAISE EXCEPTION 'Article ou designation requis sur chaque ligne' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.purchase_order_items (purchase_order_id, stock_item_id, item_description, quantity, unit_price, total_price,
                                             quantity_received, pneu_marque, pneu_modele, pneu_dimension)
    VALUES (v_id, a.id, v_des, v_q, v_pu, v_q * v_pu, 0, v_marque, v_modele, v_dimension);
    v_sous_total := v_sous_total + v_q * v_pu;
  END LOOP;
  UPDATE public.purchase_orders SET subtotal = v_sous_total, tax_amount = p_taxes, total_amount = v_sous_total + p_taxes WHERE id = v_id;
  PERFORM public.journaliser_achat(v_id, CASE WHEN p_id IS NULL THEN 'creation' ELSE 'modification' END, NULL,
    jsonb_build_object('lignes', jsonb_array_length(p_lignes), 'total', v_sous_total + p_taxes));
  RETURN v_id;
END;
$$;

-- p_lignes : [{"ligne": uuid, "recue": int, "refusee": int, "motif_refus": text,
--              "lots": [{"code": text, "quantite": int}] (article suivi),
--              "pneus": [{"numero": text, "profondeur_mm": numeric|null}] (ligne de pneus)}]
CREATE OR REPLACE FUNCTION public.receptionner_bon_commande(
  p_id uuid, p_lignes jsonb, p_bon_livraison text DEFAULT NULL, p_date timestamptz DEFAULT now(), p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE po public.purchase_orders; l jsonb; i public.purchase_order_items; v_livraison uuid; v_numero text;
        v_recue integer; v_refusee integer; v_mvt uuid; v_ligne uuid; v_site uuid; p jsonb; v_pneu uuid; v_piece text;
BEGIN
  po := public.bon_commande_ecrivable(p_id, 'stock');
  IF po.status NOT IN ('approved', 'partially_received') THEN
    RAISE EXCEPTION 'Seul un bon approuve se receptionne' USING ERRCODE = '22023';
  END IF;
  PERFORM public.depot_ecrivable(po.warehouse_id);
  IF p_date IS NULL OR p_date > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date de reception requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Au moins une ligne receptionnee requise' USING ERRCODE = '22023';
  END IF;
  v_numero := 'REC-' || to_char(p_date, 'YYYY') || '-' || lpad(nextval('public.receptions_achat_numero_seq')::text, 5, '0');
  v_piece := coalesce(nullif(btrim(coalesce(p_bon_livraison, '')), ''), v_numero);
  INSERT INTO public.deliveries (delivery_number, delivery_date, purchase_order_id, supplier_id, warehouse_id, received_by, notes,
                                 bon_livraison, recu_le)
  VALUES (v_numero, p_date::date, p_id, po.supplier_id, po.warehouse_id, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''),
          nullif(btrim(coalesce(p_bon_livraison, '')), ''), p_date)
  RETURNING id INTO v_livraison;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    SELECT * INTO i FROM public.purchase_order_items WHERE id = (l ->> 'ligne')::uuid AND purchase_order_id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ligne etrangere au bon de commande' USING ERRCODE = '22023'; END IF;
    v_recue := coalesce((l ->> 'recue')::integer, 0);
    v_refusee := coalesce((l ->> 'refusee')::integer, 0);
    IF v_recue < 0 OR v_refusee < 0 OR v_recue + v_refusee = 0 THEN
      RAISE EXCEPTION 'Ligne « % » : quantite recue ou refusee requise', i.item_description USING ERRCODE = '22023';
    END IF;
    IF coalesce(i.quantity_received, 0) + v_recue > i.quantity THEN
      RAISE EXCEPTION 'Ligne « % » : % deja recu(s) sur % commande(s), % de plus depasserait la commande',
        i.item_description, coalesce(i.quantity_received, 0), i.quantity, v_recue USING ERRCODE = '22023';
    END IF;
    IF v_refusee > 0 AND nullif(btrim(coalesce(l ->> 'motif_refus', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Ligne « % » : motif du refus requis', i.item_description USING ERRCODE = '22023';
    END IF;
    IF i.stock_item_id IS NULL AND jsonb_typeof(l -> 'lots') = 'array' AND jsonb_array_length(l -> 'lots') > 0 THEN
      RAISE EXCEPTION 'Ligne « % » : lots saisis sur une ligne hors stock', i.item_description USING ERRCODE = '22023';
    END IF;
    IF i.pneu_marque IS NULL AND jsonb_typeof(l -> 'pneus') = 'array' AND jsonb_array_length(l -> 'pneus') > 0 THEN
      RAISE EXCEPTION 'Ligne « % » : numeros de pneus saisis sur une ligne qui n''est pas une ligne de pneus', i.item_description
        USING ERRCODE = '22023';
    END IF;
    v_mvt := NULL;
    IF i.stock_item_id IS NOT NULL AND v_recue > 0 THEN
      v_mvt := public.mouvement_stock(i.stock_item_id, 'entry', v_recue, NULL, po.warehouse_id, p_date, i.unit_price,
        v_piece, NULL, NULL, v_numero || ' / ' || po.po_number, l -> 'lots', NULL);
    END IF;
    INSERT INTO public.receptions_achat_lignes (delivery_id, po_item_id, quantite_recue, quantite_refusee, motif_refus, stock_movement_id)
    VALUES (v_livraison, i.id, v_recue, v_refusee, nullif(btrim(coalesce(l ->> 'motif_refus', '')), ''), v_mvt)
    RETURNING id INTO v_ligne;
    IF i.pneu_marque IS NOT NULL AND v_recue > 0 THEN
      IF jsonb_typeof(l -> 'pneus') IS DISTINCT FROM 'array' OR jsonb_array_length(l -> 'pneus') <> v_recue THEN
        RAISE EXCEPTION 'Ligne « % » : un numero par pneu recu (% attendu(s))', i.item_description, v_recue USING ERRCODE = '22023';
      END IF;
      SELECT w.site_id INTO v_site FROM public.warehouses w WHERE w.id = po.warehouse_id;
      IF v_site IS NULL THEN
        RAISE EXCEPTION 'Reception de pneus : le depot du bon doit etre rattache a un site' USING ERRCODE = '22023';
      END IF;
      FOR p IN SELECT * FROM jsonb_array_elements(l -> 'pneus') LOOP
        IF (p ->> 'profondeur_mm') IS NOT NULL AND (p ->> 'profondeur_mm') !~ '^\d+(\.\d+)?$' THEN
          RAISE EXCEPTION 'Pneu % : profondeur positive ou absente', p ->> 'numero' USING ERRCODE = '22023';
        END IF;
        v_pneu := public.enregistrer_pneu(
          p_numero => p ->> 'numero', p_marque => i.pneu_marque, p_modele => i.pneu_modele, p_site => v_site,
          p_dimension => i.pneu_dimension, p_date_achat => p_date::date, p_prix_achat => i.unit_price,
          p_fournisseur => po.supplier_id, p_profondeur_mm => (p ->> 'profondeur_mm')::numeric,
          p_reference => v_piece, p_note => v_numero || ' / ' || po.po_number, p_date => p_date);
        INSERT INTO public.receptions_achat_pneus (reception_ligne_id, tire_id) VALUES (v_ligne, v_pneu);
      END LOOP;
    END IF;
    UPDATE public.purchase_order_items SET quantity_received = coalesce(quantity_received, 0) + v_recue WHERE id = i.id;
  END LOOP;
  UPDATE public.purchase_orders SET
    status = CASE WHEN EXISTS (SELECT 1 FROM public.purchase_order_items x WHERE x.purchase_order_id = p_id AND coalesce(x.quantity_received, 0) < x.quantity)
                  THEN 'partially_received' ELSE 'received' END,
    updated_at = now()
   WHERE id = p_id;
  PERFORM public.journaliser_achat(p_id, 'reception', NULL, jsonb_build_object('reception', v_numero, 'bon_livraison', p_bon_livraison));
  RETURN v_livraison;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_reception(p_livraison uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE d public.deliveries; po public.purchase_orders; l public.receptions_achat_lignes; r record; t record;
        v_utilises text; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  SELECT * INTO d FROM public.deliveries WHERE id = p_livraison FOR UPDATE;
  IF NOT FOUND OR d.annule_le IS NOT NULL THEN RAISE EXCEPTION 'Reception introuvable ou deja annulee' USING ERRCODE = '22023'; END IF;
  po := public.bon_commande_ecrivable(d.purchase_order_id, 'stock');
  IF po.status NOT IN ('partially_received', 'received') THEN
    RAISE EXCEPTION 'Bon solde ou clos : reception non annulable' USING ERRCODE = '22023';
  END IF;
  -- Pneus de la reception (revue C3, derogation a D-052 a confirmer par le
  -- proprietaire) : l'annulation est permise tant que chaque pneu n'a que son
  -- operation d'entree ; il sort alors du registre par une operation
  -- d'annulation motivee de son entree (journal, pas de suppression), son
  -- statut devient « reforme » (aucune operation ne s'y applique plus) et son
  -- numero recoit le suffixe de la reception pour liberer le numero saisi.
  -- Sinon refus avec la liste des pneus deja montes ou mouvementes.
  IF EXISTS (SELECT 1 FROM public.receptions_achat_pneus rp JOIN public.receptions_achat_lignes x ON x.id = rp.reception_ligne_id
              WHERE x.delivery_id = p_livraison) THEN
    IF NOT (public.has_module_write('vehicles') OR public.has_module_write('maintenance') OR public.is_admin()) THEN
      RAISE EXCEPTION 'Reception % avec pneus : droit d''ecriture sur la flotte ou la maintenance requis', d.delivery_number
        USING ERRCODE = '42501';
    END IF;
    PERFORM 1 FROM public.tires tr
      JOIN public.receptions_achat_pneus rp ON rp.tire_id = tr.id
      JOIN public.receptions_achat_lignes x ON x.id = rp.reception_ligne_id
     WHERE x.delivery_id = p_livraison
     ORDER BY tr.id FOR UPDATE OF tr;
    SELECT string_agg(tr.tire_number, ', ' ORDER BY tr.tire_number) INTO v_utilises
      FROM public.tires tr
      JOIN public.receptions_achat_pneus rp ON rp.tire_id = tr.id
      JOIN public.receptions_achat_lignes x ON x.id = rp.reception_ligne_id
     WHERE x.delivery_id = p_livraison
       AND EXISTS (SELECT 1 FROM public.pneus_operations o WHERE o.tire_id = tr.id AND o.type <> 'entree');
    IF v_utilises IS NOT NULL THEN
      RAISE EXCEPTION 'Reception % non annulable : pneus deja montes ou mouvementes (%)', d.delivery_number, v_utilises
        USING ERRCODE = '22023';
    END IF;
    FOR t IN SELECT tr.id, tr.tire_number, o.id AS entree
               FROM public.tires tr
               JOIN public.receptions_achat_pneus rp ON rp.tire_id = tr.id
               JOIN public.receptions_achat_lignes x ON x.id = rp.reception_ligne_id
               JOIN public.pneus_operations o ON o.tire_id = tr.id AND o.type = 'entree'
              WHERE x.delivery_id = p_livraison LOOP
      INSERT INTO public.pneus_operations (tire_id, type, effectue_le, motif, note, annule_operation_id, saisi_par)
      VALUES (t.id, 'annulation', now(), 'Annulation de la reception ' || d.delivery_number || ' : ' || v_motif,
              'Numero saisi a la reception : ' || t.tire_number, t.entree, auth.uid());
      UPDATE public.tires SET status = 'retired', vehicle_id = NULL, "position" = NULL,
             tire_number = t.tire_number || '-ANNULE-' || d.delivery_number, updated_at = now()
       WHERE id = t.id;
    END LOOP;
  END IF;
  PERFORM set_config('sigtb.annulation_reception', 'on', true);
  FOR l IN SELECT * FROM public.receptions_achat_lignes WHERE delivery_id = p_livraison LOOP
    IF l.stock_movement_id IS NOT NULL THEN
      PERFORM public.annuler_mouvement_stock(l.stock_movement_id, 'Annulation de la reception ' || d.delivery_number || ' : ' || btrim(p_motif));
    END IF;
    UPDATE public.purchase_order_items SET quantity_received = quantity_received - l.quantite_recue WHERE id = l.po_item_id;
  END LOOP;
  PERFORM set_config('sigtb.annulation_reception', 'off', true);
  UPDATE public.deliveries SET annule_le = now(), annule_par = auth.uid(), motif_annulation = btrim(p_motif) WHERE id = p_livraison;
  UPDATE public.purchase_orders SET
    status = CASE WHEN EXISTS (SELECT 1 FROM public.purchase_order_items x WHERE x.purchase_order_id = po.id AND x.quantity_received > 0)
                  THEN 'partially_received' ELSE 'approved' END,
    updated_at = now()
   WHERE id = po.id;
  -- D-072 R3-5 (20261120102000) : un bon deja engage ou paye ne redescend pas
  -- sous ce qui est engage ou paye.
  SELECT * INTO r FROM public.reste_a_payer_interne(NULL, po.id);
  IF r.engage + r.paye > r.base THEN
    RAISE EXCEPTION 'Reception non annulable : % GNF deja engages ou payes sur ce bon, au-dela du recu restant (% GNF)',
      r.engage + r.paye, r.base USING ERRCODE = '22023';
  END IF;
  PERFORM public.journaliser_achat(po.id, 'annulation_reception', p_motif, jsonb_build_object('reception', d.delivery_number));
END;
$$;

-- 9. Performance des pneus par marque et modele ----------------------------------

CREATE OR REPLACE FUNCTION public.seuil_pneus(p_cle text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN (s.value ->> 'value') ~ '^\d+(\.\d+)?$' THEN (s.value ->> 'value')::numeric END
    FROM public.settings s
   WHERE s.key = p_cle AND p_cle IN ('pneu_profondeur_min_mm', 'pneu_inspection_max_jours', 'pneu_reforme_precoce_km');
$$;

-- Pris en compte : pneus reformes (vie terminee) aux mesures completes
-- (monte au moins une fois, km connus pour chaque montage et positifs,
-- cout au km calcule). Les autres sont comptes comme exclus. Ligne
-- modele NULL : toutes les references de la marque.
CREATE OR REPLACE VIEW public.v_pneus_performance WITH (security_invoker = true) AS
WITH base AS (
  SELECT upper(btrim(p.brand)) AS marque, upper(btrim(p.model)) AS modele, p.km_parcourus, p.cout_total,
         p.status = 'retired' AS fin_de_vie,
         (p.nb_montages > 0 AND NOT p.km_incomplet AND p.km_parcourus > 0 AND p.cout_km IS NOT NULL) AS mesures_completes,
         EXTRACT(epoch FROM vie.reforme_le - vie.premier_montage) / 86400 AS duree_jours
    FROM public.v_pneus p
    LEFT JOIN LATERAL (
      SELECT min(o.effectue_le) FILTER (WHERE o.type = 'montage') AS premier_montage,
             max(o.effectue_le) FILTER (WHERE o.type = 'reforme') AS reforme_le
        FROM public.v_pneus_operations_effectives o WHERE o.tire_id = p.id) vie ON true
   -- Pneu sorti du registre par l'annulation de sa reception (entree annulee) : ni pris ni exclu.
   WHERE NOT EXISTS (SELECT 1 FROM public.pneus_operations a JOIN public.pneus_operations e ON e.id = a.annule_operation_id
                      WHERE e.tire_id = p.id AND e.type = 'entree')
), retenus AS (
  SELECT b.*, b.fin_de_vie AND b.mesures_completes AS pris FROM base b
)
SELECT r.marque, r.modele,
       count(*)::integer AS nb_pneus,
       count(*) FILTER (WHERE r.pris)::integer AS nb_pris_en_compte,
       count(*) FILTER (WHERE NOT r.pris)::integer AS nb_exclus,
       count(*) FILTER (WHERE NOT r.fin_de_vie)::integer AS nb_exclus_en_service,
       count(*) FILTER (WHERE r.fin_de_vie AND NOT r.mesures_completes)::integer AS nb_exclus_mesures_incompletes,
       round(avg(r.km_parcourus) FILTER (WHERE r.pris), 0) AS km_moyens,
       round(sum(r.cout_total) FILTER (WHERE r.pris) / nullif(sum(r.km_parcourus) FILTER (WHERE r.pris), 0), 2) AS cout_km,
       round(avg(r.duree_jours) FILTER (WHERE r.pris), 0) AS duree_vie_jours,
       public.seuil_pneus('pneu_reforme_precoce_km') AS seuil_reforme_precoce_km,
       CASE WHEN public.seuil_pneus('pneu_reforme_precoce_km') IS NULL OR count(*) FILTER (WHERE r.pris) = 0 THEN NULL
            ELSE round(100.0 * count(*) FILTER (WHERE r.pris AND r.km_parcourus < public.seuil_pneus('pneu_reforme_precoce_km'))
                       / count(*) FILTER (WHERE r.pris), 1) END AS taux_reforme_precoce_pct
  FROM retenus r
 GROUP BY GROUPING SETS ((r.marque, r.modele), (r.marque));
GRANT SELECT ON public.v_pneus_performance TO authenticated;

-- 10. Reglage lu par le serveur : format controle -----------------------------
-- Reprise a l'identique de la derniere definition sur main (20261121090000,
-- D-063 : cle planification_cloture_separee), plus pneu_reforme_precoce_km.
-- Les deux cles de D-065 (20261121120000, en integration au moment de
-- celle-ci : clauses_renonciation_separee, contrats_alerte_echeance_jours)
-- sont reprises par avance : cette migration passe apres la sienne et ne
-- doit pas les retirer, quel que soit l'ordre de fusion. Sans D-065, elles
-- ne sont lues par aucune fonction (controle de format seulement).
CREATE OR REPLACE FUNCTION public.valider_reglage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v text := NEW.value ->> 'value';
BEGIN
  IF NEW.key IN ('mfa_exige', 'carburant_validation_separee', 'kilometrage_validation_separee',
                 'achats_validation_separee', 'paiements_validation_separee', 'controle_depart_exige',
                 'planification_cloture_separee', 'clauses_renonciation_separee') THEN
    IF v IS NULL OR v NOT IN ('true', 'false') THEN
      RAISE EXCEPTION 'Reglage % : valeur true ou false attendue', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('tolerance_poids_cbg_t', 'pneu_profondeur_min_mm', 'pneu_inspection_max_jours', 'pneu_reforme_precoce_km') THEN
    IF v IS NULL OR v !~ '^\d+(\.\d+)?$' THEN
      RAISE EXCEPTION 'Reglage % : nombre positif attendu', NEW.key USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key IN ('fournisseurs_alerte_documents_jours', 'consultation_offres_minimum', 'contrats_alerte_echeance_jours') THEN
    -- Lus par reglage_entier (D-059, D-065) : un entier, sinon la valeur par defaut s'appliquerait en silence.
    IF v IS NULL OR v !~ '^\d+$' OR (NEW.key = 'consultation_offres_minimum' AND v::integer < 1) THEN
      RAISE EXCEPTION 'Reglage % : nombre entier attendu (au moins 1 offre)', NEW.key USING ERRCODE = '22023';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 11. Vues : rien pour anon (revue C6) -------------------------------------------
-- Les droits par defaut de Supabase ouvrent les vues nouvelles a anon ; elles
-- sont lues par les seuls comptes (RLS du perimetre).
REVOKE ALL ON public.v_reservations_stock, public.v_stock_disponibilite, public.v_stock_lots, public.v_stock_lots_mouvements,
              public.v_valorisation_stock, public.v_valorisation_articles, public.v_valorisation_depots,
              public.v_pneus_performance, public.v_stock_depots FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.v_reservations_stock, public.v_stock_disponibilite, public.v_stock_lots, public.v_stock_lots_mouvements,
       public.v_valorisation_stock, public.v_valorisation_articles, public.v_valorisation_depots, public.v_pneus_performance
  FROM authenticated;

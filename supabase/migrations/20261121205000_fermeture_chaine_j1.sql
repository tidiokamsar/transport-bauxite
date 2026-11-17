/*
  # Fermeture de la chaine J1 : un voyage dans une seule reconciliation,
  # perimetre site des dernieres lectures sans borne (D-086)

  1. Double facturation (constat de revue D-078 n 5). Le chevauchement de
     periode et de sites d'un meme contrat est refuse par
     `ouvrir_reconciliation` depuis 20261121160000 (NULL = tous les sites,
     verrou consultatif par contrat) : la fonction n'est pas redefinie ici.
     Restait le cas de deux contrats clients differents couvrant la meme
     periode et les memes sites : un voyage pouvait figurer dans deux
     reconciliations. Garde serveur sur `reconciliation_lignes` : un voyage
     n'est ligne que d'une seule reconciliation (toutes sont actives : le
     statut ne connait que `ouverte` et `cloturee`). Verrou consultatif par
     voyage pour les actualisations concurrentes. La garde ne touche pas
     `actualiser_reconciliation` (redefinie par D-081, 20261121180000) : elle
     s'applique a toute insertion, quelle que soit la version de la fonction.
     Aucune donnee existante n'est modifiee : un doublon deja present est
     signale (avertissement au deploiement et requete de controle
     ci-dessous), jamais corrige ; il bloque l'actualisation de la
     reconciliation ouverte concernee jusqu'a decision humaine.

     Requete de controle (doit retourner 0 ligne) :
       SELECT l.trip_id, array_agg(l.reconciliation_id ORDER BY r.ouverte_le) AS reconciliations
         FROM public.reconciliation_lignes l JOIN public.reconciliations r ON r.id = l.reconciliation_id
        GROUP BY l.trip_id HAVING count(*) > 1;

  2. Perimetre site des lectures (suite de D-075, 20261121095000) :
     - `reconciliation_lignes` : lecture bornee par le voyage
       (`voyage_permis`, depart ou arrivee), droit facturation ou contrats
       conserve. Lu par l'ecran de reconciliation ; ecrit par les fonctions
       serveur seulement (SECURITY DEFINER, non concernees par la RLS).
     - `iot_fuel_readings` : lecture bornee par l'engin (`vehicule_permis`) ;
       une lecture sans engin n'est visible que des profils globaux. Seule
       politique jusqu'ici : `ecriture_roles_metier` FOR ALL (droit d'ecriture
       `iot`, sans borne), qui valait aussi lecture ; la lecture demande
       desormais le droit de lecture `iot` et le perimetre. Ecrite
       seulement par `ingest_fuel_data` (service_role) : les politiques FOR
       ALL heritees (qui valaient aussi lecture sans borne) et les ecritures
       des comptes sont retirees.
     - `invoice_items` (heritage Bolt) : lue par aucun code (ni ecran, ni
       fonction, ni Edge Function) ; signalee comme candidate au schema
       d'archive (D-069 point 4), non deplacee ici. Ses politiques FOR ALL
       heritees donnaient une lecture sans borne : lecture bornee par le
       voyage (ligne sans voyage : profils globaux), ecritures des comptes
       retirees.
     - `stock_items` : le catalogue n'est pas rattache a un site (lignes
       visibles avec le droit stocks), mais la colonne cache
       `quantity_in_stock` (D-044) est un total tous depots. Elle n'est plus
       lisible par les comptes (privilege de colonne) ; l'ecran des stocks
       calcule la quantite sur les depots visibles (`v_stock_disponibilite`,
       vue SECURITY INVOKER bornee). Les fonctions SECURITY DEFINER gardent
       la colonne.

  Idempotent : CREATE OR REPLACE, DROP ... IF EXISTS, boucles sur le
  catalogue. Aucune donnee modifiee.
*/

-- ===================================================================
-- 1. Un voyage, une seule reconciliation
-- ===================================================================
CREATE OR REPLACE FUNCTION public.garde_voyage_une_reconciliation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_autre uuid;
BEGIN
  -- Serialise les insertions concurrentes d'un meme voyage (deux contrats
  -- actualises en meme temps) ; la verification suivante voit l'autre
  -- transaction validee (READ COMMITTED, nouvel instantane par requete).
  PERFORM pg_advisory_xact_lock(hashtext('sigtb.reconciliation.voyage.' || NEW.trip_id::text));
  SELECT l.reconciliation_id INTO v_autre FROM public.reconciliation_lignes l
   WHERE l.trip_id = NEW.trip_id AND l.reconciliation_id <> NEW.reconciliation_id
   LIMIT 1;
  IF v_autre IS NOT NULL THEN
    RAISE EXCEPTION 'Voyage % deja porte par une autre reconciliation (%) : double facturation refusee',
      coalesce(NEW.reference, NEW.trip_id::text), v_autre USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.garde_voyage_une_reconciliation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS garde_voyage_une_reconciliation ON public.reconciliation_lignes;
CREATE TRIGGER garde_voyage_une_reconciliation
  BEFORE INSERT OR UPDATE OF trip_id, reconciliation_id ON public.reconciliation_lignes
  FOR EACH ROW EXECUTE FUNCTION public.garde_voyage_une_reconciliation();

-- Doublons deja presents : signales, jamais corriges.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT trip_id FROM public.reconciliation_lignes GROUP BY trip_id HAVING count(*) > 1) d;
  IF n > 0 THEN
    RAISE WARNING 'D-086 : % voyage(s) deja portes par plusieurs reconciliations ; requete de controle en tete de 20261121205000', n;
  END IF;
END $$;

-- ===================================================================
-- 2. Perimetre site des lectures
-- ===================================================================

-- Toutes les politiques existantes de ces trois tables sont remplacees : les
-- politiques FOR ALL heritees valaient lecture sans borne.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename IN ('reconciliation_lignes', 'iot_fuel_readings', 'invoice_items') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.reconciliation_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lecture_module ON public.reconciliation_lignes FOR SELECT TO authenticated
  USING ((public.has_module_view('invoices') OR public.has_module_view('contracts') OR public.is_admin())
         AND public.voyage_permis(trip_id));
REVOKE ALL ON public.reconciliation_lignes FROM anon, authenticated;
GRANT SELECT ON public.reconciliation_lignes TO authenticated;
GRANT ALL ON public.reconciliation_lignes TO service_role;

ALTER TABLE public.iot_fuel_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY lecture_module ON public.iot_fuel_readings FOR SELECT TO authenticated
  USING ((public.has_module_view('iot') OR public.is_admin()) AND public.vehicule_permis(vehicle_id));
REVOKE ALL ON public.iot_fuel_readings FROM anon, authenticated;
GRANT SELECT ON public.iot_fuel_readings TO authenticated;
GRANT ALL ON public.iot_fuel_readings TO service_role;

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY lecture_module ON public.invoice_items FOR SELECT TO authenticated
  USING ((public.has_module_view('invoices') OR public.is_admin())
         AND public.voyage_permis(trip_id));  -- sans voyage : profils globaux seulement
REVOKE ALL ON public.invoice_items FROM anon, authenticated;
GRANT SELECT ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;

-- stock_items : toutes les colonnes lisibles sauf le cache tous depots.
REVOKE SELECT ON public.stock_items FROM anon, authenticated;
DO $$
DECLARE v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'stock_items' AND column_name <> 'quantity_in_stock';
  EXECUTE format('GRANT SELECT (%s) ON public.stock_items TO authenticated', v_cols);
END $$;

/*
  D-083 : pieces justificatives (lot 23, jalon J1 ; accord du proprietaire
  D-069 reponse 2 : bucket prive, politiques par module et site, controle du
  type et de la taille).

  Modele :
  - `pieces_jointes` : une ligne par fichier rattache a une piece metier
    (objet_type, objet_id). Le module, le site et le chemin du fichier sont
    determines par le serveur depuis l'objet, jamais par le navigateur.
    Types d'objets de la chaine J1 : voyage, ticket CBG, releve compteur
    (kilometrage), releve CBG importe, livraison carburant CBG. Un nouveau
    module s'ajoute en etendant `piece_resoudre_objet` et
    `piece_objet_lisible` (et la contrainte de `objet_type`).
  - Jamais de suppression physique : ni DELETE, ni TRUNCATE (droits retires
    et declencheur). Une piece se retire par annulation motivee et tracee
    (annule_par, annule_le, motif_annulation) ; le fichier reste stocke et
    lisible pour l'audit.
  - Cycle : `enregistrer_piece_jointe` (controles : droit d'ecriture du
    module, perimetre de site, type MIME autorise pour l'objet, extension
    coherente, taille <= 10 Mio, empreinte sha256 declaree) cree la ligne
    `en_attente` et rend le chemin ; le navigateur depose le fichier dans le
    bucket prive `pieces` a ce chemin (politique d'insertion : ligne en
    attente du deposant, moins d'une heure) ; `confirmer_piece_jointe`
    verifie dans storage.objects que le fichier existe, que sa taille et son
    type sont ceux declares, puis passe la piece a `deposee`.
  - Lecture : une piece est lisible si son objet l'est (meme droit de module
    et meme perimetre de site que l'objet, D-038, D-075) ; le fichier est
    lisible si la ligne `pieces_jointes` l'est. Aucune politique UPDATE ni
    DELETE sur storage.objects : pas d'ecrasement, pas de suppression.

  Schema storage : il est cree par l'image Postgres de Supabase, mais ses
  tables (buckets, objects) sont creees par le service storage-api a son
  premier demarrage. Le bucket et les politiques de storage.objects sont
  donc poses par `configurer_stockage_pieces()`, appelee ici et rejouable
  (idempotente) : sans tables storage (conteneur de rejeu, ou service pas
  encore demarre), elle ne fait rien et le signale. Le test pgTAP 64 cree
  des tables storage minimales dans sa transaction quand elles manquent,
  appelle la fonction et verifie les politiques ; sur le serveur, il
  utilise les vraies tables. appliquer-migrations.sh rappelle la fonction a
  chaque passage.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- ===================================================================
-- 1. Table
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.pieces_jointes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objet_type text NOT NULL CHECK (objet_type IN
    ('voyage', 'ticket_pesee_cbg', 'releve_compteur', 'releve_cbg', 'livraison_carburant_cbg')),
  objet_id uuid NOT NULL,
  module text NOT NULL,
  site_id uuid REFERENCES public.sites(id),
  chemin text NOT NULL UNIQUE,
  nom text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 200),
  type_mime text NOT NULL,
  taille bigint NOT NULL CHECK (taille > 0 AND taille <= 10485760),
  sha256 text CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'deposee')),
  depose_par uuid NOT NULL REFERENCES auth.users(id),
  depose_le timestamptz NOT NULL DEFAULT now(),
  confirme_le timestamptz,
  annule_par uuid REFERENCES auth.users(id),
  annule_le timestamptz,
  motif_annulation text,
  CHECK ((statut = 'deposee') = (confirme_le IS NOT NULL)),
  CHECK ((annule_le IS NULL AND annule_par IS NULL AND motif_annulation IS NULL)
      OR (annule_le IS NOT NULL AND annule_par IS NOT NULL AND char_length(btrim(motif_annulation)) >= 5))
);
CREATE INDEX IF NOT EXISTS idx_pieces_jointes_objet ON public.pieces_jointes (objet_type, objet_id);
CREATE INDEX IF NOT EXISTS idx_pieces_jointes_site ON public.pieces_jointes (site_id);
-- Le meme fichier n'est rattache qu'une fois au meme objet (hors annulees).
CREATE UNIQUE INDEX IF NOT EXISTS pieces_jointes_empreinte_uq
  ON public.pieces_jointes (objet_type, objet_id, sha256)
  WHERE sha256 IS NOT NULL AND annule_le IS NULL;

ALTER TABLE public.pieces_jointes ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- 2. Regles : types autorises et taille maximale
-- ===================================================================

-- Taille maximale d'un fichier (octets) ; la meme valeur borne le bucket.
CREATE OR REPLACE FUNCTION public.pieces_taille_max()
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT 10485760::bigint $$;

-- Types MIME admis pour un type d'objet, avec les extensions de nom
-- acceptees. Le tableur et le CSV ne sont admis que pour le releve CBG
-- (fichier source de l'import, D-050).
CREATE OR REPLACE FUNCTION public.pieces_types_autorises(p_objet_type text)
RETURNS TABLE (type_mime text, extensions text[])
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT t.type_mime, t.extensions
    FROM (VALUES
      ('application/pdf', ARRAY['pdf'], false),
      ('image/jpeg', ARRAY['jpg', 'jpeg'], false),
      ('image/png', ARRAY['png'], false),
      ('image/webp', ARRAY['webp'], false),
      ('text/csv', ARRAY['csv'], true),
      ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ARRAY['xlsx'], true)
    ) AS t(type_mime, extensions, releve_seulement)
   WHERE NOT t.releve_seulement OR p_objet_type = 'releve_cbg';
$$;

REVOKE EXECUTE ON FUNCTION public.pieces_taille_max() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pieces_types_autorises(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pieces_taille_max() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pieces_types_autorises(text) TO authenticated, service_role;

-- ===================================================================
-- 3. Resolution de l'objet (module, site, perimetre)
-- ===================================================================

-- Interne (fonctions SECURITY DEFINER) : la RLS est contournee, le
-- perimetre est donc calcule explicitement, comme dans les fonctions
-- d'ecriture de chaque objet (rattacher_ticket_cbg, saisir_releve_compteur,
-- importer_releve_cbg, enregistrer_livraison_cbg).
CREATE OR REPLACE FUNCTION public.piece_resoudre_objet(
  p_objet_type text, p_objet_id uuid,
  OUT trouve boolean, OUT module text, OUT site_id uuid, OUT permis boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dep uuid;
  v_arr uuid;
BEGIN
  trouve := false; permis := false; module := NULL; site_id := NULL;
  IF p_objet_type = 'voyage' THEN
    SELECT t.departure_site_id, t.arrival_site_id INTO v_dep, v_arr FROM public.trips t WHERE t.id = p_objet_id;
    IF FOUND THEN
      trouve := true; module := 'trips'; site_id := coalesce(v_arr, v_dep);
      permis := public.site_permis(v_dep) OR public.site_permis(v_arr);
    END IF;
  ELSIF p_objet_type = 'ticket_pesee_cbg' THEN
    SELECT t.departure_site_id, t.arrival_site_id, k.site_id INTO v_dep, v_arr, site_id
      FROM public.tickets_pesee_cbg k JOIN public.trips t ON t.id = k.trip_id
     WHERE k.id = p_objet_id;
    IF FOUND THEN
      trouve := true; module := 'trips';
      permis := public.site_permis(v_dep) OR public.site_permis(v_arr);
    END IF;
  ELSIF p_objet_type = 'releve_compteur' THEN
    SELECT v.site_id INTO site_id
      FROM public.releves_compteur r JOIN public.vehicles v ON v.id = r.vehicle_id
     WHERE r.id = p_objet_id;
    IF FOUND THEN
      trouve := true; module := 'trips'; permis := public.site_permis(site_id);
    END IF;
  ELSIF p_objet_type = 'releve_cbg' THEN
    SELECT r.site_id INTO site_id FROM public.releves_cbg r WHERE r.id = p_objet_id;
    IF FOUND THEN
      trouve := true; module := 'trips'; permis := public.site_permis(site_id);
    END IF;
  ELSIF p_objet_type = 'livraison_carburant_cbg' THEN
    SELECT l.site_id INTO site_id FROM public.livraisons_carburant_cbg l WHERE l.id = p_objet_id;
    IF FOUND THEN
      trouve := true; module := 'fuel'; permis := public.site_permis(site_id);
    END IF;
  END IF;
  permis := coalesce(permis, false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.piece_resoudre_objet(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.piece_resoudre_objet(text, uuid) TO service_role;

-- Lecture (SECURITY INVOKER) : l'objet doit etre lisible par le compte,
-- avec les memes droits de module et le meme perimetre que sa propre
-- politique de lecture ; la RLS de la table de l'objet s'applique en plus.
CREATE OR REPLACE FUNCTION public.piece_objet_lisible(p_objet_type text, p_objet_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_objet_type = 'voyage' THEN
    RETURN (public.has_module_view('trips') OR public.is_admin())
       AND public.voyage_permis(p_objet_id)
       AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = p_objet_id);
  ELSIF p_objet_type = 'ticket_pesee_cbg' THEN
    RETURN (public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin())
       AND EXISTS (SELECT 1 FROM public.tickets_pesee_cbg k
                    WHERE k.id = p_objet_id AND public.voyage_permis(k.trip_id));
  ELSIF p_objet_type = 'releve_compteur' THEN
    RETURN (public.has_module_view('trips') OR public.has_module_view('contracts'))
       AND EXISTS (SELECT 1 FROM public.releves_compteur r
                    WHERE r.id = p_objet_id AND public.vehicule_permis(r.vehicle_id));
  ELSIF p_objet_type = 'releve_cbg' THEN
    RETURN (public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin())
       AND EXISTS (SELECT 1 FROM public.releves_cbg r
                    WHERE r.id = p_objet_id AND public.site_permis(r.site_id));
  ELSIF p_objet_type = 'livraison_carburant_cbg' THEN
    RETURN (public.has_module_view('fuel') OR public.is_admin())
       AND EXISTS (SELECT 1 FROM public.livraisons_carburant_cbg l
                    WHERE l.id = p_objet_id AND public.site_permis(l.site_id));
  END IF;
  RETURN false;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.piece_objet_lisible(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.piece_objet_lisible(text, uuid) TO authenticated, service_role;

-- ===================================================================
-- 4. Droits et immuabilite
-- ===================================================================

DROP POLICY IF EXISTS lecture ON public.pieces_jointes;
CREATE POLICY lecture ON public.pieces_jointes FOR SELECT TO authenticated
  USING (public.piece_objet_lisible(objet_type, objet_id));

REVOKE ALL ON public.pieces_jointes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.pieces_jointes TO authenticated, service_role;

-- Seules transitions admises : en_attente -> deposee (confirmation) et
-- annulation (une fois). Aucune autre colonne ne change ; aucune ligne ne
-- disparait.
CREATE OR REPLACE FUNCTION public.garde_pieces_jointes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_fixes constant text[] := ARRAY['statut', 'confirme_le', 'annule_par', 'annule_le', 'motif_annulation'];
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Une piece jointe ne se supprime pas : annulation motivee seulement' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - v_fixes) IS DISTINCT FROM (to_jsonb(OLD) - v_fixes) THEN
    RAISE EXCEPTION 'Piece jointe immuable : seuls la confirmation et l''annulation sont admises' USING ERRCODE = '42501';
  END IF;
  IF NEW.statut IS DISTINCT FROM OLD.statut OR NEW.confirme_le IS DISTINCT FROM OLD.confirme_le THEN
    IF NOT (OLD.statut = 'en_attente' AND NEW.statut = 'deposee' AND OLD.annule_le IS NULL) THEN
      RAISE EXCEPTION 'Transition de piece jointe refusee' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF (NEW.annule_le, NEW.annule_par, NEW.motif_annulation) IS DISTINCT FROM (OLD.annule_le, OLD.annule_par, OLD.motif_annulation)
     AND OLD.annule_le IS NOT NULL THEN
    RAISE EXCEPTION 'Piece jointe deja annulee' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garde_pieces_jointes ON public.pieces_jointes;
CREATE TRIGGER garde_pieces_jointes BEFORE UPDATE OR DELETE ON public.pieces_jointes
  FOR EACH ROW EXECUTE FUNCTION public.garde_pieces_jointes();
DROP TRIGGER IF EXISTS garde_pieces_jointes_vidage ON public.pieces_jointes;
CREATE TRIGGER garde_pieces_jointes_vidage BEFORE TRUNCATE ON public.pieces_jointes
  FOR EACH STATEMENT EXECUTE FUNCTION public.garde_pieces_jointes();
REVOKE EXECUTE ON FUNCTION public.garde_pieces_jointes() FROM PUBLIC, anon, authenticated;

-- ===================================================================
-- 5. Fonctions d'ecriture
-- ===================================================================

CREATE OR REPLACE FUNCTION public.enregistrer_piece_jointe(
  p_objet_type text,
  p_objet_id uuid,
  p_nom text,
  p_type_mime text,
  p_taille bigint,
  p_sha256 text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  o record;
  v_id uuid := gen_random_uuid();
  v_nom text := btrim(coalesce(p_nom, ''));
  v_type text := lower(btrim(coalesce(p_type_mime, '')));
  v_sha text := nullif(lower(btrim(coalesce(p_sha256, ''))), '');
  v_ext text;
  v_extensions text[];
  v_chemin text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO o FROM public.piece_resoudre_objet(p_objet_type, p_objet_id);
  -- Objet inconnu et objet hors perimetre : meme message (pas de sonde).
  IF NOT o.trouve OR NOT o.permis THEN
    RAISE EXCEPTION 'Piece metier introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_module_write(o.module) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur le module % requis', o.module USING ERRCODE = '42501';
  END IF;
  IF char_length(v_nom) NOT BETWEEN 1 AND 200 OR v_nom ~ '[/\\[:cntrl:]]' THEN
    RAISE EXCEPTION 'Nom de fichier invalide (1 a 200 caracteres, sans barre oblique ni caractere de controle)' USING ERRCODE = '22023';
  END IF;
  v_ext := lower(substring(v_nom FROM '\.([A-Za-z0-9]+)$'));
  SELECT t.extensions INTO v_extensions FROM public.pieces_types_autorises(p_objet_type) t WHERE t.type_mime = v_type;
  IF v_extensions IS NULL THEN
    RAISE EXCEPTION 'Type de fichier non autorise pour cette piece : %', v_type USING ERRCODE = '22023';
  END IF;
  IF v_ext IS NULL OR NOT v_ext = ANY (v_extensions) THEN
    RAISE EXCEPTION 'Extension du fichier incoherente avec son type (% attendu)', array_to_string(v_extensions, ' ou ') USING ERRCODE = '22023';
  END IF;
  IF p_taille IS NULL OR p_taille <= 0 OR p_taille > public.pieces_taille_max() THEN
    RAISE EXCEPTION 'Taille du fichier hors limite (1 octet a % octets)', public.pieces_taille_max() USING ERRCODE = '22023';
  END IF;
  IF v_sha IS NOT NULL AND v_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Empreinte sha256 invalide' USING ERRCODE = '22023';
  END IF;
  IF v_sha IS NOT NULL AND EXISTS (SELECT 1 FROM public.pieces_jointes pj
       WHERE pj.objet_type = p_objet_type AND pj.objet_id = p_objet_id AND pj.sha256 = v_sha AND pj.annule_le IS NULL) THEN
    RAISE EXCEPTION 'Ce fichier est deja joint a cette piece' USING ERRCODE = '23505';
  END IF;

  v_chemin := p_objet_type || '/' || p_objet_id::text || '/' || v_id::text || '.' || v_ext;
  INSERT INTO public.pieces_jointes (id, objet_type, objet_id, module, site_id, chemin, nom, type_mime, taille, sha256, depose_par)
  VALUES (v_id, p_objet_type, p_objet_id, o.module, o.site_id, v_chemin, v_nom, v_type, p_taille, v_sha, auth.uid());

  RETURN jsonb_build_object('id', v_id, 'chemin', v_chemin, 'bucket', 'pieces');
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmer_piece_jointe(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pj public.pieces_jointes%ROWTYPE;
  v_meta jsonb;
BEGIN
  SELECT * INTO pj FROM public.pieces_jointes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR pj.depose_par IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Piece jointe introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF pj.annule_le IS NOT NULL THEN
    RAISE EXCEPTION 'Piece jointe annulee' USING ERRCODE = '22023';
  END IF;
  IF pj.statut = 'deposee' THEN
    RETURN 'deposee';
  END IF;
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'Stockage des fichiers non installe sur ce serveur' USING ERRCODE = '55000';
  END IF;
  EXECUTE 'SELECT metadata FROM storage.objects WHERE bucket_id = $1 AND name = $2'
    INTO v_meta USING 'pieces', pj.chemin;
  IF v_meta IS NULL THEN
    RAISE EXCEPTION 'Fichier non recu par le stockage' USING ERRCODE = '22023';
  END IF;
  IF (v_meta->>'size') IS NULL OR (v_meta->>'size')::bigint <> pj.taille THEN
    RAISE EXCEPTION 'Taille du fichier stocke (%) differente de la taille declaree (%) : annulez la piece', v_meta->>'size', pj.taille USING ERRCODE = '22023';
  END IF;
  IF lower(coalesce(v_meta->>'mimetype', '')) <> pj.type_mime THEN
    RAISE EXCEPTION 'Type du fichier stocke (%) different du type declare (%) : annulez la piece', v_meta->>'mimetype', pj.type_mime USING ERRCODE = '22023';
  END IF;
  UPDATE public.pieces_jointes SET statut = 'deposee', confirme_le = now() WHERE id = p_id;
  RETURN 'deposee';
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_piece_jointe(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pj public.pieces_jointes%ROWTYPE;
  o record;
  v_motif text := btrim(coalesce(p_motif, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO pj FROM public.pieces_jointes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Piece jointe introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO o FROM public.piece_resoudre_objet(pj.objet_type, pj.objet_id);
  IF NOT o.trouve OR NOT o.permis THEN
    RAISE EXCEPTION 'Piece jointe introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_module_write(pj.module) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur le module % requis', pj.module USING ERRCODE = '42501';
  END IF;
  IF pj.annule_le IS NOT NULL THEN
    RAISE EXCEPTION 'Piece jointe deja annulee' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_motif) < 5 THEN
    RAISE EXCEPTION 'Motif d''annulation obligatoire (5 caracteres au moins)' USING ERRCODE = '22023';
  END IF;
  UPDATE public.pieces_jointes
     SET annule_par = auth.uid(), annule_le = now(), motif_annulation = v_motif
   WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enregistrer_piece_jointe(text, uuid, text, text, bigint, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirmer_piece_jointe(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.annuler_piece_jointe(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_piece_jointe(text, uuid, text, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmer_piece_jointe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annuler_piece_jointe(uuid, text) TO authenticated;

-- ===================================================================
-- 6. Bucket prive et politiques de storage.objects
-- ===================================================================

-- Rejouable par un administrateur de la base (migration, ou
-- appliquer-migrations.sh apres le premier demarrage du service storage).
-- Rend 'absent' sans tables storage, 'configure' sinon.
CREATE OR REPLACE FUNCTION public.configurer_stockage_pieces()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_types text[];
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'Tables storage absentes : bucket et politiques non poses (rappeler public.configurer_stockage_pieces() apres le demarrage du service storage)';
    RETURN 'absent';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'storage' AND table_name = 'buckets'
         AND column_name IN ('id', 'name', 'public', 'file_size_limit', 'allowed_mime_types')) <> 5 THEN
    RAISE EXCEPTION 'storage.buckets sans file_size_limit ou allowed_mime_types : version du service storage non prise en charge';
  END IF;
  SELECT array_agg(DISTINCT t.type_mime ORDER BY t.type_mime) INTO v_types
    FROM public.pieces_types_autorises('releve_cbg') t;

  EXECUTE 'INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
           VALUES ($1, $1, false, $2, $3)
           ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
                                          allowed_mime_types = EXCLUDED.allowed_mime_types'
    USING 'pieces', public.pieces_taille_max(), v_types;

  EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS sigtb_pieces_lecture ON storage.objects';
  EXECUTE $p$CREATE POLICY sigtb_pieces_lecture ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'pieces'
           AND EXISTS (SELECT 1 FROM public.pieces_jointes pj WHERE pj.chemin = objects.name))$p$;
  EXECUTE 'DROP POLICY IF EXISTS sigtb_pieces_depot ON storage.objects';
  EXECUTE $p$CREATE POLICY sigtb_pieces_depot ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'pieces'
                AND EXISTS (SELECT 1 FROM public.pieces_jointes pj
                             WHERE pj.chemin = objects.name
                               AND pj.depose_par = auth.uid()
                               AND pj.statut = 'en_attente'
                               AND pj.annule_le IS NULL
                               AND pj.depose_le > now() - interval '1 hour'))$p$;
  RETURN 'configure';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.configurer_stockage_pieces() FROM PUBLIC, anon, authenticated, service_role;

SELECT public.configurer_stockage_pieces();

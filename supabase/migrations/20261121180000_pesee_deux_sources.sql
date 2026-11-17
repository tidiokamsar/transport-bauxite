/*
  D-081 : pesee a deux sources (lot J1 pesee-deux-sources, module 14).

  Regle du proprietaire (2026-11-16) : CBG fait la pesee officielle ;
  l'agent KOGON ne pese pas, il releve sur sa fiche terrain ce qu'il observe
  de la pesee CBG. Deux sources conservees independamment, puis rapprochees.
  La fiche KOGON n'est jamais un deuxieme ticket officiel, une valeur
  officielle CBG n'est jamais ecrasee, un cas ambigu n'est jamais fusionne
  automatiquement : le systeme recommande, l'humain decide.

  Source A (officielle) : `releves_cbg` + `releves_cbg_lignes`, import du
  releve CBG. Ajouts : empreinte SHA-256 du fichier (calculee par le
  navigateur), refus d'un re-import de la meme empreinte, ticket deja
  present dans un autre releve non annule marque (jamais rejete en
  silence), lignes rejetees par le controle client conservees avec leur
  motif, rapport d'import, annulation motivee tant qu'aucune ligne n'est
  engagee dans une reconciliation cloturee, reference de piece (`piece_id`,
  stockage du fichier par le lot pieces jointes, non construit ici).
  `importer_releve_cbg_v2`, `annuler_releve_cbg`.

  Source B (terrain KOGON) : `releves_terrain_kogon`, table distincte, liee
  facultativement a un voyage. `tickets_pesee_cbg` reste en place (elle est
  saisie par l'agent KOGON avec la rotation : c'est le releve KOGON du
  ticket CBG, mal nomme) ; chaque ligne y est recopiee dans la source B par
  declencheur, ses rectifications aussi (remplacement trace). Saisie
  autonome `saisir_releve_terrain_kogon` : identifiant client (uuid du
  navigateur) unique, rejouer le meme identifiant renvoie la ligne
  existante (resynchronisation sans doublon). Correction = nouvelle ligne
  qui remplace l'ancienne, motivee ; l'ancienne reste.

  Rapprochement : `rapprocher_pesees` confronte chaque ligne CBG, le releve
  KOGON de meme ticket et la rotation ; tolerance absolue (t) et relative
  (%) par site avec repli global (`parametres_tolerance_pesee`, versionnee,
  `definir_tolerance_pesee`), puis reglage `tolerance_poids_cbg_t`, sinon
  0 et « tolerance non parametree ». Plusieurs classes par ligne, aucune
  cascade. Chaque passe est conservee (`passes_rapprochement_pesee`,
  `rapprochements_pesee`, append-only).

  Anomalies : `anomalies_pesee` (une par constat), journal append-only
  `journal_anomalies_pesee` ; actions par `agir_anomalie_pesee` ; celui
  qui soumet ne cloture pas un ecart de poids ; une anomalie d'un voyage
  porte par une reconciliation cloturee ne change plus.

  Reconciliation : `actualiser_reconciliation` (rebasee sur 20261121160000)
  : tonnage_cbg = ligne du releve officiel CBG du meme ticket (releve non
  annule), tonnage_kogon = releve KOGON ; sans releve CBG : anomalie
  `sans_releve_cbg`, jamais de repli silencieux.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS.
*/

-- ===================================================================
-- 0. Documentation de l'existant
-- ===================================================================
COMMENT ON TABLE public.tickets_pesee_cbg IS
  'Releve KOGON du ticket CBG (D-081) : valeurs reportees par l''agent KOGON avec la rotation. Ce n''est pas la pesee officielle : '
  'la source officielle est le releve CBG importe (releves_cbg_lignes). Recopie dans releves_terrain_kogon.';
COMMENT ON TABLE public.releves_cbg IS 'Releve officiel CBG importe (source A, D-050, D-081), conserve tel que recu.';
COMMENT ON TABLE public.releves_cbg_lignes IS 'Lignes du releve officiel CBG, telles que recues ; jamais modifiees (D-081).';

-- ===================================================================
-- 1. Source A : tracabilite de l'import
-- ===================================================================
ALTER TABLE public.releves_cbg
  ADD COLUMN IF NOT EXISTS empreinte_sha256 text,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS piece_id uuid,
  ADD COLUMN IF NOT EXISTS lignes_rejetees jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS annule_par uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS annule_le timestamptz,
  ADD COLUMN IF NOT EXISTS motif_annulation text,
  ADD COLUMN IF NOT EXISTS rapproche_pesees_le timestamptz;
COMMENT ON COLUMN public.releves_cbg.piece_id IS
  'Piece jointe du fichier original (lot pieces jointes, D-069 point 2) : non renseignee tant que le stockage n''existe pas (D-081).';

ALTER TABLE public.releves_cbg DROP CONSTRAINT IF EXISTS releves_cbg_statut_check;
ALTER TABLE public.releves_cbg ADD CONSTRAINT releves_cbg_statut_check
  CHECK (statut IN ('importe', 'rapproche', 'annule'));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'releves_cbg_empreinte_format' AND conrelid = 'public.releves_cbg'::regclass) THEN
    ALTER TABLE public.releves_cbg ADD CONSTRAINT releves_cbg_empreinte_format
      CHECK (empreinte_sha256 IS NULL OR empreinte_sha256 ~ '^[0-9a-f]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'releves_cbg_format' AND conrelid = 'public.releves_cbg'::regclass) THEN
    ALTER TABLE public.releves_cbg ADD CONSTRAINT releves_cbg_format CHECK (format IS NULL OR format IN ('csv'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'releves_cbg_annulation_motivee' AND conrelid = 'public.releves_cbg'::regclass) THEN
    ALTER TABLE public.releves_cbg ADD CONSTRAINT releves_cbg_annulation_motivee
      CHECK (statut <> 'annule' OR (nullif(btrim(coalesce(motif_annulation, '')), '') IS NOT NULL AND annule_le IS NOT NULL));
  END IF;
END $$;
-- Un meme fichier n'est importe qu'une fois tant que son releve n'est pas annule.
CREATE UNIQUE INDEX IF NOT EXISTS releves_cbg_empreinte_uq ON public.releves_cbg (empreinte_sha256)
  WHERE empreinte_sha256 IS NOT NULL AND statut <> 'annule';

ALTER TABLE public.releves_cbg_lignes
  ADD COLUMN IF NOT EXISTS doublon_releve_id uuid REFERENCES public.releves_cbg(id);
COMMENT ON COLUMN public.releves_cbg_lignes.doublon_releve_id IS
  'Ticket deja present dans cet autre releve non annule au moment de l''import (D-081) : la ligne est gardee et signalee.';
CREATE INDEX IF NOT EXISTS releves_cbg_lignes_ticket_idx ON public.releves_cbg_lignes (upper(btrim(ticket)));

CREATE OR REPLACE FUNCTION public.importer_releve_cbg_v2(
  p_reference text, p_du date, p_au date, p_site_id uuid, p_fichier text,
  p_empreinte text, p_lignes jsonb, p_rejets jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid; x jsonb; n integer := 0; v_doublons integer := 0; v_illisibles integer := 0;
  v_existant text; v_autre uuid; v_ticket text; v_empreinte text := lower(btrim(coalesce(p_empreinte, '')));
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  -- Un releve sans site couvre tous les sites : profil global seulement.
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise (un releve sans site exige un profil global)' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_reference, '')), '') IS NULL OR p_du IS NULL OR p_au IS NULL OR p_au < p_du THEN
    RAISE EXCEPTION 'Reference et periode du releve requises' USING ERRCODE = '22023';
  END IF;
  IF v_empreinte !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Empreinte SHA-256 du fichier requise (64 caracteres hexadecimaux)' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_lignes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Releve vide' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(coalesce(p_rejets, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Lignes rejetees attendues sous forme de liste' USING ERRCODE = '22023';
  END IF;
  -- Controle des colonnes : ticket, date et poids (net, ou brut et tare) sur chaque ligne.
  SELECT min(o.rang) INTO n FROM jsonb_array_elements(p_lignes) WITH ORDINALITY AS o(v, rang)
   WHERE jsonb_typeof(o.v) <> 'object' OR NOT (o.v ? 'ticket') OR NOT (o.v ? 'date')
      OR NOT ((o.v ? 'net') OR ((o.v ? 'brut') AND (o.v ? 'tare')));
  IF n IS NOT NULL THEN
    RAISE EXCEPTION 'Colonnes manquantes ligne % : ticket, date et poids (net, ou brut et tare) requis', n USING ERRCODE = '22023';
  END IF;
  n := 0;
  PERFORM pg_advisory_xact_lock(hashtextextended('sigtb.releve_cbg.' || v_empreinte, 0));
  SELECT r.reference INTO v_existant FROM public.releves_cbg r WHERE r.empreinte_sha256 = v_empreinte AND r.statut <> 'annule';
  IF FOUND THEN
    RAISE EXCEPTION 'Fichier deja importe (releve %) : annuler ce releve avant de le reimporter', v_existant USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.releves_cbg (reference, periode_debut, periode_fin, site_id, fichier_source, importe_par,
                                  empreinte_sha256, format, lignes_rejetees)
  VALUES (btrim(p_reference), p_du, p_au, p_site_id, nullif(btrim(coalesce(p_fichier, '')), ''), auth.uid(),
          v_empreinte, 'csv', coalesce(p_rejets, '[]'::jsonb))
  RETURNING id INTO v_id;
  -- Valeurs gardees telles que lues ; une valeur illisible reste NULL.
  FOR x IN SELECT v FROM jsonb_array_elements(p_lignes) AS t(v) LOOP
    n := n + 1;
    v_ticket := nullif(btrim(x ->> 'ticket'), '');
    v_autre := NULL;
    IF v_ticket IS NOT NULL THEN
      SELECT l.releve_id INTO v_autre FROM public.releves_cbg_lignes l JOIN public.releves_cbg r ON r.id = l.releve_id
       WHERE r.statut <> 'annule' AND r.id <> v_id AND upper(btrim(l.ticket)) = upper(v_ticket)
       ORDER BY r.importe_le LIMIT 1;
      IF v_autre IS NOT NULL THEN v_doublons := v_doublons + 1; END IF;
    END IF;
    INSERT INTO public.releves_cbg_lignes (releve_id, rang, ticket, date_pesee, immatriculation, brut, tare, net, doublon_releve_id)
    VALUES (v_id, n, v_ticket,
            CASE WHEN x ->> 'date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (x ->> 'date')::date END,
            nullif(btrim(x ->> 'immatriculation'), ''),
            CASE WHEN x ->> 'brut' ~ '^-?\d+(\.\d+)?$' THEN (x ->> 'brut')::numeric END,
            CASE WHEN x ->> 'tare' ~ '^-?\d+(\.\d+)?$' THEN (x ->> 'tare')::numeric END,
            CASE WHEN x ->> 'net' ~ '^-?\d+(\.\d+)?$' THEN (x ->> 'net')::numeric END,
            v_autre);
  END LOOP;
  SELECT count(*) INTO v_illisibles FROM public.releves_cbg_lignes l
   WHERE l.releve_id = v_id AND (l.ticket IS NULL OR l.date_pesee IS NULL OR coalesce(l.net, l.brut - l.tare) IS NULL
                                 OR coalesce(l.net, l.brut - l.tare) <= 0 OR l.brut <= 0 OR l.tare < 0);
  RETURN jsonb_build_object('releve_id', v_id, 'acceptees', n, 'rejetees', jsonb_array_length(coalesce(p_rejets, '[]'::jsonb)),
                            'doublons_inter_releves', v_doublons, 'incompletes', v_illisibles);
END;
$$;

-- ===================================================================
-- 2. Source B : releves terrain KOGON
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.releves_terrain_kogon (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE,
  origine text NOT NULL CHECK (origine IN ('fiche_terrain', 'rotation')),
  site_id uuid REFERENCES public.sites(id),
  trip_id uuid REFERENCES public.trips(id),
  ticket_pesee_id uuid REFERENCES public.tickets_pesee_cbg(id),
  agent text,
  ticket text,
  heure_pesee_observee timestamptz,
  immatriculation_observee text,
  chauffeur_observe text,
  brut numeric CHECK (brut IS NULL OR brut > 0),
  tare numeric CHECK (tare IS NULL OR tare >= 0),
  net numeric CHECK (net IS NULL OR net > 0),
  observations text,
  anomalie_signalee boolean NOT NULL DEFAULT false,
  anomalie_texte text,
  latitude numeric CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude numeric CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  precision_m numeric CHECK (precision_m IS NULL OR precision_m >= 0),
  remplace_id uuid UNIQUE REFERENCES public.releves_terrain_kogon(id),
  motif_remplacement text,
  saisi_client_le timestamptz,
  saisi_par uuid REFERENCES auth.users(id),
  saisi_le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT releves_terrain_kogon_poids CHECK (brut IS NULL OR tare IS NULL OR tare < brut),
  CONSTRAINT releves_terrain_kogon_net CHECK (brut IS NULL OR tare IS NULL OR net IS NULL OR net = brut - tare),
  CONSTRAINT releves_terrain_kogon_anomalie CHECK (NOT anomalie_signalee OR nullif(btrim(coalesce(anomalie_texte, '')), '') IS NOT NULL),
  CONSTRAINT releves_terrain_kogon_remplacement CHECK (remplace_id IS NULL OR nullif(btrim(coalesce(motif_remplacement, '')), '') IS NOT NULL),
  CONSTRAINT releves_terrain_kogon_contenu CHECK (nullif(btrim(coalesce(ticket, '')), '') IS NOT NULL OR net IS NOT NULL OR brut IS NOT NULL)
);
COMMENT ON TABLE public.releves_terrain_kogon IS
  'Source B (D-081) : ce que l''agent KOGON a observe de la pesee CBG. Jamais un ticket officiel ; append-only, correction par remplacement motive.';
CREATE INDEX IF NOT EXISTS releves_terrain_kogon_ticket_idx ON public.releves_terrain_kogon (upper(btrim(ticket)));
CREATE INDEX IF NOT EXISTS releves_terrain_kogon_trip_idx ON public.releves_terrain_kogon (trip_id);
CREATE INDEX IF NOT EXISTS releves_terrain_kogon_site_idx ON public.releves_terrain_kogon (site_id, heure_pesee_observee);

CREATE OR REPLACE FUNCTION public.refuser_mutation_pesee()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Enregistrement de pesee immuable : ajouter un nouvel evenement motive' USING ERRCODE = '42501';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refuser_mutation_pesee() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS releves_terrain_kogon_immuables ON public.releves_terrain_kogon;
CREATE TRIGGER releves_terrain_kogon_immuables BEFORE UPDATE OR DELETE ON public.releves_terrain_kogon
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_pesee();

CREATE OR REPLACE VIEW public.v_releves_terrain_kogon_effectifs WITH (security_invoker = true) AS
SELECT k.*
  FROM public.releves_terrain_kogon k
 WHERE NOT EXISTS (SELECT 1 FROM public.releves_terrain_kogon n WHERE n.remplace_id = k.id);
GRANT SELECT ON public.v_releves_terrain_kogon_effectifs TO authenticated;

-- Recopie du releve KOGON saisi avec la rotation (tickets_pesee_cbg) et de ses rectifications.
CREATE OR REPLACE FUNCTION public.recopier_ticket_kogon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_agent text; v_site uuid;
BEGIN
  SELECT f.agent INTO v_agent FROM public.fiches_terrain f WHERE f.id = NEW.fiche_id;
  v_site := coalesce(NEW.site_id, (SELECT t.arrival_site_id FROM public.trips t WHERE t.id = NEW.trip_id));
  INSERT INTO public.releves_terrain_kogon (client_id, origine, site_id, trip_id, ticket_pesee_id, agent, ticket,
    heure_pesee_observee, brut, tare, net, saisi_par, saisi_le)
  VALUES (NEW.id, 'rotation', v_site, NEW.trip_id, NEW.id, v_agent, NEW.ticket, NEW.mesure_le,
    NEW.brut, NEW.tare, NEW.brut - NEW.tare, NEW.saisi_par, NEW.cree_le)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recopier_ticket_kogon() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS recopier_ticket_kogon ON public.tickets_pesee_cbg;
CREATE TRIGGER recopier_ticket_kogon AFTER INSERT ON public.tickets_pesee_cbg
  FOR EACH ROW EXECUTE FUNCTION public.recopier_ticket_kogon();

CREATE OR REPLACE FUNCTION public.recopier_rectification_kogon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.releves_terrain_kogon;
BEGIN
  SELECT k.* INTO c FROM public.releves_terrain_kogon k
   WHERE k.ticket_pesee_id = NEW.ticket_id
     AND NOT EXISTS (SELECT 1 FROM public.releves_terrain_kogon n WHERE n.remplace_id = k.id)
   ORDER BY k.saisi_le DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  INSERT INTO public.releves_terrain_kogon (client_id, origine, site_id, trip_id, ticket_pesee_id, agent, ticket,
    heure_pesee_observee, brut, tare, net, remplace_id, motif_remplacement, saisi_par, saisi_le)
  VALUES (NEW.id, 'rotation', c.site_id, c.trip_id, NEW.ticket_id, c.agent, NEW.nouveau_ticket, c.heure_pesee_observee,
    NEW.nouveau_brut, NEW.nouvelle_tare, NEW.nouveau_brut - NEW.nouvelle_tare, c.id, 'Rectification : ' || NEW.motif,
    NEW.corrige_par, NEW.corrige_le)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recopier_rectification_kogon() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS recopier_rectification_kogon ON public.rectifications_tickets_pesee_cbg;
CREATE TRIGGER recopier_rectification_kogon AFTER INSERT ON public.rectifications_tickets_pesee_cbg
  FOR EACH ROW EXECUTE FUNCTION public.recopier_rectification_kogon();

-- Reprise de l'existant (production purgee : normalement aucune ligne).
DO $$
DECLARE t public.tickets_pesee_cbg; c public.rectifications_tickets_pesee_cbg; v_prec uuid;
BEGIN
  FOR t IN SELECT * FROM public.tickets_pesee_cbg ORDER BY cree_le LOOP
    INSERT INTO public.releves_terrain_kogon (client_id, origine, site_id, trip_id, ticket_pesee_id, agent, ticket,
      heure_pesee_observee, brut, tare, net, saisi_par, saisi_le)
    SELECT t.id, 'rotation', coalesce(t.site_id, tr.arrival_site_id), t.trip_id, t.id, f.agent, t.ticket, t.mesure_le,
      t.brut, t.tare, t.brut - t.tare, t.saisi_par, t.cree_le
      FROM public.trips tr LEFT JOIN public.fiches_terrain f ON f.id = t.fiche_id
     WHERE tr.id = t.trip_id
    ON CONFLICT (client_id) DO NOTHING;
    v_prec := (SELECT k.id FROM public.releves_terrain_kogon k WHERE k.client_id = t.id);
    FOR c IN SELECT * FROM public.rectifications_tickets_pesee_cbg r WHERE r.ticket_id = t.id ORDER BY r.corrige_le, r.id LOOP
      IF NOT EXISTS (SELECT 1 FROM public.releves_terrain_kogon k WHERE k.client_id = c.id) THEN
        INSERT INTO public.releves_terrain_kogon (client_id, origine, site_id, trip_id, ticket_pesee_id, agent, ticket,
          heure_pesee_observee, brut, tare, net, remplace_id, motif_remplacement, saisi_par, saisi_le)
        SELECT c.id, 'rotation', k.site_id, k.trip_id, t.id, k.agent, c.nouveau_ticket, k.heure_pesee_observee,
          c.nouveau_brut, c.nouvelle_tare, c.nouveau_brut - c.nouvelle_tare, k.id, 'Rectification : ' || c.motif,
          c.corrige_par, c.corrige_le
          FROM public.releves_terrain_kogon k WHERE k.id = v_prec;
      END IF;
      v_prec := (SELECT k.id FROM public.releves_terrain_kogon k WHERE k.client_id = c.id);
    END LOOP;
  END LOOP;
END $$;

-- Voyage fige par une reconciliation cloturee : public.voyage_couvert_cloture (J1, 20261121160000).

CREATE OR REPLACE FUNCTION public.saisir_releve_terrain_kogon(
  p_client_id uuid, p_site_id uuid, p_trip_id uuid, p_donnees jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d jsonb := coalesce(p_donnees, '{}'::jsonb);
  x public.releves_terrain_kogon; ancien public.releves_terrain_kogon; v public.trips;
  v_brut numeric; v_tare numeric; v_net numeric; v_heure timestamptz; v_client timestamptz;
  v_lat numeric; v_lon numeric; v_prec numeric; v_remplace uuid; v_id uuid;
  num CONSTANT text := '^-?\d+(\.\d+)?$';
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Identifiant de saisie (genere par le poste) requis' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(d) <> 'object' THEN RAISE EXCEPTION 'Donnees attendues sous forme d''objet' USING ERRCODE = '22023'; END IF;
  -- Resynchronisation : le meme identifiant renvoie la ligne deja enregistree.
  PERFORM pg_advisory_xact_lock(hashtextextended('sigtb.releve_kogon.' || p_client_id::text, 0));
  SELECT * INTO x FROM public.releves_terrain_kogon WHERE client_id = p_client_id;
  IF FOUND THEN
    IF x.saisi_par IS DISTINCT FROM auth.uid() OR NOT public.site_permis(x.site_id) THEN
      RAISE EXCEPTION 'Identifiant de saisie deja utilise' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('id', x.id, 'deja_enregistre', true);
  END IF;
  IF p_site_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = p_site_id) OR NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Site introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_trip_id IS NOT NULL THEN
    SELECT * INTO v FROM public.trips WHERE id = p_trip_id;
    IF NOT FOUND OR NOT public.voyage_permis(p_trip_id) THEN
      RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
    END IF;
    IF p_site_id IS DISTINCT FROM v.departure_site_id AND p_site_id IS DISTINCT FROM v.arrival_site_id THEN
      RAISE EXCEPTION 'Le site du releve n''est ni le depart ni l''arrivee du voyage %', v.reference USING ERRCODE = '22023';
    END IF;
    IF public.voyage_couvert_cloture(p_trip_id) THEN
      RAISE EXCEPTION 'Reconciliation cloturee : utiliser le circuit d''avoir' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF (d ? 'brut' AND nullif(d ->> 'brut', '') IS NOT NULL AND d ->> 'brut' !~ num)
     OR (d ? 'tare' AND nullif(d ->> 'tare', '') IS NOT NULL AND d ->> 'tare' !~ num)
     OR (d ? 'net' AND nullif(d ->> 'net', '') IS NOT NULL AND d ->> 'net' !~ num) THEN
    RAISE EXCEPTION 'Poids illisible : nombre en tonnes attendu' USING ERRCODE = '22023';
  END IF;
  v_brut := nullif(d ->> 'brut', '')::numeric;
  v_tare := nullif(d ->> 'tare', '')::numeric;
  v_net := nullif(d ->> 'net', '')::numeric;
  IF v_brut IS NOT NULL AND v_tare IS NOT NULL THEN
    IF v_tare < 0 OR v_brut <= v_tare THEN
      RAISE EXCEPTION 'Brut superieur a la tare requis (en tonnes)' USING ERRCODE = '22023';
    END IF;
    IF v_net IS NOT NULL AND v_net <> v_brut - v_tare THEN
      RAISE EXCEPTION 'Net different de brut moins tare' USING ERRCODE = '22023';
    END IF;
    v_net := v_brut - v_tare;
  END IF;
  IF (v_brut IS NULL) <> (v_tare IS NULL) THEN
    RAISE EXCEPTION 'Brut et tare se saisissent ensemble' USING ERRCODE = '22023';
  END IF;
  IF v_net IS NOT NULL AND v_net <= 0 THEN RAISE EXCEPTION 'Net positif requis' USING ERRCODE = '22023'; END IF;
  BEGIN
    v_heure := nullif(d ->> 'heure_pesee_observee', '')::timestamptz;
    v_client := nullif(d ->> 'saisi_client_le', '')::timestamptz;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Heure illisible' USING ERRCODE = '22023';
  END;
  IF v_heure IS NOT NULL AND v_heure > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Heure de pesee observee dans le futur' USING ERRCODE = '22023';
  END IF;
  IF (d ? 'latitude' AND nullif(d ->> 'latitude', '') IS NOT NULL AND d ->> 'latitude' !~ num)
     OR (d ? 'longitude' AND nullif(d ->> 'longitude', '') IS NOT NULL AND d ->> 'longitude' !~ num)
     OR (d ? 'precision_m' AND nullif(d ->> 'precision_m', '') IS NOT NULL AND d ->> 'precision_m' !~ num) THEN
    RAISE EXCEPTION 'Position illisible' USING ERRCODE = '22023';
  END IF;
  v_lat := nullif(d ->> 'latitude', '')::numeric;
  v_lon := nullif(d ->> 'longitude', '')::numeric;
  v_prec := nullif(d ->> 'precision_m', '')::numeric;
  IF (v_lat IS NULL) <> (v_lon IS NULL) THEN RAISE EXCEPTION 'Latitude et longitude se saisissent ensemble' USING ERRCODE = '22023'; END IF;
  -- Correction : nouvelle ligne qui remplace l'ancienne (motif obligatoire, ancienne conservee).
  IF nullif(d ->> 'remplace_id', '') IS NOT NULL THEN
    BEGIN
      v_remplace := (d ->> 'remplace_id')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Releve a corriger illisible' USING ERRCODE = '22023';
    END;
    SELECT * INTO ancien FROM public.releves_terrain_kogon WHERE id = v_remplace FOR UPDATE;
    IF NOT FOUND OR NOT public.site_permis(ancien.site_id) THEN
      RAISE EXCEPTION 'Releve a corriger introuvable' USING ERRCODE = 'P0002';
    END IF;
    IF EXISTS (SELECT 1 FROM public.releves_terrain_kogon n WHERE n.remplace_id = ancien.id) THEN
      RAISE EXCEPTION 'Ce releve a deja ete corrige : corriger la derniere version' USING ERRCODE = '22023';
    END IF;
    IF ancien.site_id IS DISTINCT FROM p_site_id THEN
      RAISE EXCEPTION 'Une correction garde le site du releve corrige' USING ERRCODE = '22023';
    END IF;
    IF ancien.origine = 'rotation' THEN
      RAISE EXCEPTION 'Releve saisi avec la rotation : utiliser la rectification du ticket' USING ERRCODE = '22023';
    END IF;
    IF public.voyage_couvert_cloture(ancien.trip_id) OR public.voyage_couvert_cloture(p_trip_id) THEN
      RAISE EXCEPTION 'Reconciliation cloturee : utiliser le circuit d''avoir' USING ERRCODE = '22023';
    END IF;
    IF nullif(btrim(coalesce(d ->> 'motif_remplacement', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Motif de correction obligatoire' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF coalesce(d ->> 'anomalie_signalee', 'false') NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'Anomalie signalee : vrai ou faux attendu' USING ERRCODE = '22023';
  END IF;
  IF coalesce((d ->> 'anomalie_signalee')::boolean, false) AND nullif(btrim(coalesce(d ->> 'anomalie_texte', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Decrire l''anomalie signalee' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(d ->> 'ticket', '')), '') IS NULL AND v_net IS NULL THEN
    RAISE EXCEPTION 'Ticket observe ou poids observe requis' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.releves_terrain_kogon (client_id, origine, site_id, trip_id, agent, ticket, heure_pesee_observee,
    immatriculation_observee, chauffeur_observe, brut, tare, net, observations, anomalie_signalee, anomalie_texte,
    latitude, longitude, precision_m, remplace_id, motif_remplacement, saisi_client_le, saisi_par)
  VALUES (p_client_id, 'fiche_terrain', p_site_id, p_trip_id, nullif(btrim(coalesce(d ->> 'agent', '')), ''),
    nullif(btrim(coalesce(d ->> 'ticket', '')), ''), v_heure,
    nullif(btrim(coalesce(d ->> 'immatriculation_observee', '')), ''), nullif(btrim(coalesce(d ->> 'chauffeur_observe', '')), ''),
    v_brut, v_tare, v_net, nullif(btrim(coalesce(d ->> 'observations', '')), ''),
    coalesce((d ->> 'anomalie_signalee')::boolean, false), nullif(btrim(coalesce(d ->> 'anomalie_texte', '')), ''),
    v_lat, v_lon, v_prec, v_remplace, nullif(btrim(coalesce(d ->> 'motif_remplacement', '')), ''), v_client, auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'deja_enregistre', false);
END;
$$;

-- ===================================================================
-- 3. Tolerance parametrable, versionnee, par site avec repli global
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.parametres_tolerance_pesee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id),
  version integer NOT NULL CHECK (version > 0),
  tolerance_t numeric CHECK (tolerance_t IS NULL OR tolerance_t >= 0),
  tolerance_pct numeric CHECK (tolerance_pct IS NULL OR (tolerance_pct >= 0 AND tolerance_pct <= 100)),
  motif text NOT NULL CHECK (nullif(btrim(motif), '') IS NOT NULL),
  defini_par uuid REFERENCES auth.users(id),
  defini_le timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS parametres_tolerance_pesee_version_uq
  ON public.parametres_tolerance_pesee (coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), version);
DROP TRIGGER IF EXISTS parametres_tolerance_pesee_immuables ON public.parametres_tolerance_pesee;
CREATE TRIGGER parametres_tolerance_pesee_immuables BEFORE UPDATE OR DELETE ON public.parametres_tolerance_pesee
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_pesee();

CREATE OR REPLACE FUNCTION public.definir_tolerance_pesee(p_site_id uuid, p_tolerance_t numeric, p_tolerance_pct numeric, p_motif text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_version integer; v_id uuid;
BEGIN
  IF NOT (public.has_module_write('settings') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit sur les parametres requis' USING ERRCODE = '42501';
  END IF;
  IF NOT public.site_permis(p_site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise (la tolerance globale exige un profil global)' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif obligatoire' USING ERRCODE = '22023'; END IF;
  IF (p_tolerance_t IS NOT NULL AND p_tolerance_t < 0) OR (p_tolerance_pct IS NOT NULL AND (p_tolerance_pct < 0 OR p_tolerance_pct > 100)) THEN
    RAISE EXCEPTION 'Tolerance positive (t) et pourcentage entre 0 et 100 requis' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('sigtb.tolerance_pesee.' || coalesce(p_site_id::text, 'global'), 0));
  SELECT coalesce(max(p.version), 0) + 1 INTO v_version FROM public.parametres_tolerance_pesee p
   WHERE p.site_id IS NOT DISTINCT FROM p_site_id;
  INSERT INTO public.parametres_tolerance_pesee (site_id, version, tolerance_t, tolerance_pct, motif, defini_par)
  VALUES (p_site_id, v_version, p_tolerance_t, p_tolerance_pct, btrim(p_motif), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Tolerance applicable : derniere version du site, sinon derniere version
-- globale, sinon reglage tolerance_poids_cbg_t, sinon aucune (0, non parametree).
CREATE OR REPLACE FUNCTION public.tolerance_pesee_applicable(p_site_id uuid)
RETURNS TABLE (tolerance_t numeric, tolerance_pct numeric, source text, parametre_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.parametres_tolerance_pesee; v_reglage numeric;
BEGIN
  IF p_site_id IS NOT NULL THEN
    SELECT * INTO p FROM public.parametres_tolerance_pesee x WHERE x.site_id = p_site_id ORDER BY x.version DESC LIMIT 1;
    IF FOUND THEN RETURN QUERY SELECT p.tolerance_t, p.tolerance_pct, 'site'::text, p.id; RETURN; END IF;
  END IF;
  SELECT * INTO p FROM public.parametres_tolerance_pesee x WHERE x.site_id IS NULL ORDER BY x.version DESC LIMIT 1;
  IF FOUND THEN RETURN QUERY SELECT p.tolerance_t, p.tolerance_pct, 'global'::text, p.id; RETURN; END IF;
  SELECT CASE WHEN s.value ->> 'value' ~ '^\d+(\.\d+)?$' THEN (s.value ->> 'value')::numeric END INTO v_reglage
    FROM public.settings s WHERE s.key = 'tolerance_poids_cbg_t';
  IF v_reglage IS NOT NULL THEN RETURN QUERY SELECT v_reglage, NULL::numeric, 'reglage_tolerance_poids_cbg_t'::text, NULL::uuid; RETURN; END IF;
  RETURN QUERY SELECT NULL::numeric, NULL::numeric, 'non_parametree'::text, NULL::uuid;
END;
$$;

-- Ecart dans la tolerance : chaque limite definie doit etre respectee ;
-- sans aucune limite, seul un ecart nul l'est.
CREATE OR REPLACE FUNCTION public.ecart_dans_tolerance(p_ecart numeric, p_reference numeric, p_tol_t numeric, p_tol_pct numeric)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_ecart IS NULL THEN NULL
    WHEN p_tol_t IS NULL AND p_tol_pct IS NULL THEN p_ecart = 0
    ELSE (p_tol_t IS NULL OR abs(p_ecart) <= p_tol_t)
     AND (p_tol_pct IS NULL OR (p_reference > 0 AND abs(p_ecart) <= p_reference * p_tol_pct / 100))
  END;
$$;

-- ===================================================================
-- 4. Moteur de rapprochement a deux sources
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.passes_rapprochement_pesee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  releve_id uuid NOT NULL REFERENCES public.releves_cbg(id),
  numero integer NOT NULL,
  lance_par uuid REFERENCES auth.users(id),
  lance_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (releve_id, numero)
);
DROP TRIGGER IF EXISTS passes_rapprochement_pesee_immuables ON public.passes_rapprochement_pesee;
CREATE TRIGGER passes_rapprochement_pesee_immuables BEFORE UPDATE OR DELETE ON public.passes_rapprochement_pesee
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_pesee();

CREATE TABLE IF NOT EXISTS public.rapprochements_pesee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passe_id uuid NOT NULL REFERENCES public.passes_rapprochement_pesee(id),
  releve_id uuid NOT NULL REFERENCES public.releves_cbg(id),
  ligne_id uuid REFERENCES public.releves_cbg_lignes(id),
  releve_kogon_id uuid REFERENCES public.releves_terrain_kogon(id),
  trip_id uuid REFERENCES public.trips(id),
  trips_candidats uuid[] NOT NULL DEFAULT '{}',
  site_id uuid REFERENCES public.sites(id),
  ticket text,
  date_cbg date,
  immatriculation_cbg text,
  net_cbg numeric,
  heure_kogon timestamptz,
  immatriculation_kogon text,
  net_kogon numeric,
  ecart_t numeric,
  ecart_pct numeric,
  tolerance_t numeric,
  tolerance_pct numeric,
  source_tolerance text,
  classes text[] NOT NULL CHECK (cardinality(classes) > 0 AND classes <@ ARRAY['concordant', 'concordant_avec_reserve', 'ecart_poids',
    'ticket_sans_fiche', 'fiche_sans_ticket', 'ticket_duplique', 'camion_non_reconnu', 'rotation_non_retrouvee',
    'donnees_incompletes', 'a_examiner']),
  detail text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  CHECK (ligne_id IS NOT NULL OR releve_kogon_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS rapprochements_pesee_passe_idx ON public.rapprochements_pesee (passe_id);
CREATE INDEX IF NOT EXISTS rapprochements_pesee_trip_idx ON public.rapprochements_pesee (trip_id);
DROP TRIGGER IF EXISTS rapprochements_pesee_immuables ON public.rapprochements_pesee;
CREATE TRIGGER rapprochements_pesee_immuables BEFORE UPDATE OR DELETE ON public.rapprochements_pesee
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_pesee();

-- Derniere passe de chaque releve : resultat en vigueur.
CREATE OR REPLACE VIEW public.v_rapprochements_pesee_courants WITH (security_invoker = true) AS
SELECT rp.*, p.numero AS passe_numero, p.lance_le AS passe_le
  FROM public.rapprochements_pesee rp
  JOIN public.passes_rapprochement_pesee p ON p.id = rp.passe_id
 WHERE p.numero = (SELECT max(p2.numero) FROM public.passes_rapprochement_pesee p2 WHERE p2.releve_id = rp.releve_id);
GRANT SELECT ON public.v_rapprochements_pesee_courants TO authenticated;

CREATE TABLE IF NOT EXISTS public.anomalies_pesee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cle text NOT NULL,
  releve_id uuid NOT NULL REFERENCES public.releves_cbg(id),
  rapprochement_id uuid NOT NULL REFERENCES public.rapprochements_pesee(id),
  ligne_id uuid REFERENCES public.releves_cbg_lignes(id),
  releve_kogon_id uuid REFERENCES public.releves_terrain_kogon(id),
  trip_id uuid REFERENCES public.trips(id),
  trips_concernes uuid[] NOT NULL DEFAULT '{}',
  site_id uuid REFERENCES public.sites(id),
  categorie text NOT NULL CHECK (categorie IN ('concordant_avec_reserve', 'ecart_poids', 'ticket_sans_fiche', 'fiche_sans_ticket',
    'ticket_duplique', 'camion_non_reconnu', 'rotation_non_retrouvee', 'donnees_incompletes', 'a_examiner')),
  gravite text NOT NULL CHECK (gravite IN ('basse', 'moyenne', 'haute')),
  description text NOT NULL,
  sources text[] NOT NULL,
  valeurs jsonb NOT NULL DEFAULT '{}'::jsonb,
  responsable_id uuid REFERENCES auth.users(id),
  statut text NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'en_examen', 'verification_demandee', 'justifiee',
    'erreur_cbg_signalee', 'soumise_validation', 'cloturee')),
  decision text CHECK (decision IN ('concordance_confirmee', 'ecart_justifie', 'erreur_cbg', 'releve_annule')),
  commentaire text,
  preuve_ref text,
  soumis_par uuid REFERENCES auth.users(id),
  soumis_le timestamptz,
  conclu_par uuid REFERENCES auth.users(id),
  conclu_le timestamptz,
  cloture_par uuid REFERENCES auth.users(id),
  cloture_le timestamptz,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS anomalies_pesee_statut_idx ON public.anomalies_pesee (statut, site_id);
CREATE INDEX IF NOT EXISTS anomalies_pesee_trip_idx ON public.anomalies_pesee (trip_id);
CREATE INDEX IF NOT EXISTS anomalies_pesee_trips_idx ON public.anomalies_pesee USING gin (trips_concernes);
-- Un constat n'a qu'une anomalie active ; apres cloture, un constat aux valeurs changees en ouvre une nouvelle.
CREATE UNIQUE INDEX IF NOT EXISTS anomalies_pesee_cle_active_uq ON public.anomalies_pesee (cle) WHERE statut <> 'cloturee';

CREATE TABLE IF NOT EXISTS public.journal_anomalies_pesee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anomalie_id uuid NOT NULL REFERENCES public.anomalies_pesee(id),
  action text NOT NULL,
  statut_avant text,
  statut_apres text NOT NULL,
  ancienne_valeur jsonb,
  nouvelle_valeur jsonb,
  commentaire text,
  preuve_ref text,
  auteur uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_anomalies_pesee_idx ON public.journal_anomalies_pesee (anomalie_id, le);
DROP TRIGGER IF EXISTS journal_anomalies_pesee_immuable ON public.journal_anomalies_pesee;
CREATE TRIGGER journal_anomalies_pesee_immuable BEFORE UPDATE OR DELETE ON public.journal_anomalies_pesee
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_pesee();

CREATE OR REPLACE FUNCTION public.gravite_anomalie_pesee(p_categorie text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_categorie
    WHEN 'ecart_poids' THEN 'haute' WHEN 'ticket_duplique' THEN 'haute' WHEN 'a_examiner' THEN 'haute'
    WHEN 'concordant_avec_reserve' THEN 'basse' ELSE 'moyenne' END;
$$;

-- Releves KOGON en vigueur dans le perimetre de l'utilisateur et du releve (sans site : tous).
CREATE OR REPLACE FUNCTION public.releves_kogon_perimetre(p_site_id uuid)
RETURNS SETOF public.releves_terrain_kogon
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT k.* FROM public.releves_terrain_kogon k
   WHERE NOT EXISTS (SELECT 1 FROM public.releves_terrain_kogon n WHERE n.remplace_id = k.id)
     AND public.site_permis(k.site_id)
     AND (p_site_id IS NULL OR k.site_id = p_site_id);
$$;

CREATE OR REPLACE FUNCTION public.rapprocher_pesees(p_releve_id uuid)
RETURNS TABLE (classe text, nombre integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.releves_cbg; l public.releves_cbg_lignes; k public.releves_terrain_kogon;
  v_passe uuid; v_numero integer; v_classes text[]; v_notes text[]; v_reserve boolean;
  v_net_cbg numeric; v_net_kogon numeric; v_ecart numeric; v_pct numeric;
  v_tol record; v_candidats uuid[]; v_trips uuid[]; v_trip uuid; v_site uuid; v_immat_ref text;
  v_rang integer; v_rp uuid; v_c text;
BEGIN
  IF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.releves_cbg WHERE id = p_releve_id FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(r.site_id) THEN
    RAISE EXCEPTION 'Releve introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF r.statut = 'annule' THEN RAISE EXCEPTION 'Releve annule : aucun rapprochement' USING ERRCODE = '22023'; END IF;
  SELECT coalesce(max(p.numero), 0) + 1 INTO v_numero FROM public.passes_rapprochement_pesee p WHERE p.releve_id = r.id;
  INSERT INTO public.passes_rapprochement_pesee (releve_id, numero, lance_par) VALUES (r.id, v_numero, auth.uid())
  RETURNING id INTO v_passe;

  FOR l IN SELECT * FROM public.releves_cbg_lignes WHERE releve_id = r.id ORDER BY rang LOOP
    v_classes := '{}'; v_notes := '{}'; v_reserve := false; v_trip := NULL; v_trips := '{}'; k := NULL;
    v_net_kogon := NULL; v_ecart := NULL; v_pct := NULL; v_immat_ref := NULL; v_site := r.site_id;
    v_net_cbg := coalesce(l.net, l.brut - l.tare);
    IF v_net_cbg <= 0 OR l.brut <= 0 OR l.tare < 0 THEN v_net_cbg := NULL; END IF;
    SELECT * INTO v_tol FROM public.tolerance_pesee_applicable(r.site_id);
    IF l.ticket IS NULL OR v_net_cbg IS NULL OR l.date_pesee IS NULL THEN
      v_classes := v_classes || 'donnees_incompletes'::text;
      v_notes := v_notes || format('Ligne %s du releve CBG : %s', l.rang, concat_ws(', ',
        CASE WHEN l.ticket IS NULL THEN 'ticket absent' END, CASE WHEN v_net_cbg IS NULL THEN 'poids absent ou non positif' END,
        CASE WHEN l.date_pesee IS NULL THEN 'date absente' END));
    END IF;
    IF l.ticket IS NOT NULL THEN
      SELECT min(l2.rang) INTO v_rang FROM public.releves_cbg_lignes l2
       WHERE l2.releve_id = r.id AND l2.rang < l.rang AND upper(btrim(l2.ticket)) = upper(btrim(l.ticket));
      IF v_rang IS NOT NULL OR l.doublon_releve_id IS NOT NULL
         OR EXISTS (SELECT 1 FROM public.releves_cbg_lignes l3 JOIN public.releves_cbg r3 ON r3.id = l3.releve_id
                     WHERE r3.statut <> 'annule' AND r3.id <> r.id AND upper(btrim(l3.ticket)) = upper(btrim(l.ticket))) THEN
        v_classes := v_classes || 'ticket_duplique'::text;
        v_notes := v_notes || CASE WHEN v_rang IS NOT NULL THEN format('Ticket %s deja present ligne %s du releve', l.ticket, v_rang)
                                   ELSE format('Ticket %s present dans un autre releve CBG', l.ticket) END;
      END IF;
    END IF;
    -- Doublon dans le meme releve : la ligne n'est pas confrontee une deuxieme fois,
    -- mais les voyages des releves KOGON de ce ticket sont designes (blocage en reconciliation).
    IF l.ticket IS NOT NULL AND v_rang IS NOT NULL THEN
      SELECT coalesce(array_agg(DISTINCT x.trip_id), '{}') INTO v_trips FROM public.releves_kogon_perimetre(r.site_id) x
       WHERE upper(btrim(x.ticket)) = upper(btrim(l.ticket)) AND x.trip_id IS NOT NULL;
    END IF;
    IF l.ticket IS NOT NULL AND v_rang IS NULL THEN
      SELECT coalesce(array_agg(x.id ORDER BY x.saisi_le), '{}') INTO v_candidats FROM public.releves_kogon_perimetre(r.site_id) x
       WHERE upper(btrim(x.ticket)) = upper(btrim(l.ticket));
      IF cardinality(v_candidats) = 0 THEN
        v_classes := v_classes || 'ticket_sans_fiche'::text;
        v_notes := v_notes || format('Ticket %s sans releve terrain KOGON', l.ticket);
        -- Rotation recherchee par camion et date (recommandation, jamais rattachee d'office).
        SELECT coalesce(array_agg(t.id ORDER BY t.reference), '{}') INTO v_trips
          FROM public.trips t JOIN public.vehicles ve ON ve.id = t.vehicle_id
         WHERE l.immatriculation IS NOT NULL AND l.date_pesee IS NOT NULL
           AND public.normaliser_immatriculation(ve.registration) = public.normaliser_immatriculation(l.immatriculation)
           AND t.planned_date = l.date_pesee AND public.voyage_permis(t.id)
           AND (r.site_id IS NULL OR r.site_id IN (t.departure_site_id, t.arrival_site_id));
        IF cardinality(v_trips) = 0 THEN
          v_classes := v_classes || 'rotation_non_retrouvee'::text;
          v_notes := v_notes || text 'Aucune rotation du camion a cette date';
        ELSIF cardinality(v_trips) > 1 THEN
          v_classes := v_classes || 'a_examiner'::text;
          v_notes := v_notes || format('%s rotations candidates : choix humain requis', cardinality(v_trips));
        ELSE
          v_notes := v_notes || text 'Une rotation candidate (a confirmer)';
        END IF;
      ELSIF cardinality(v_candidats) > 1 THEN
        v_classes := v_classes || 'a_examiner'::text;
        v_notes := v_notes || format('%s releves KOGON portent le ticket %s : aucun rapprochement automatique', cardinality(v_candidats), l.ticket);
        SELECT coalesce(array_agg(DISTINCT x.trip_id), '{}') INTO v_trips FROM public.releves_kogon_perimetre(r.site_id) x
         WHERE x.id = ANY (v_candidats) AND x.trip_id IS NOT NULL;
      ELSE
        SELECT * INTO k FROM public.releves_kogon_perimetre(r.site_id) x WHERE x.id = v_candidats[1];
        v_trip := k.trip_id;
        v_site := coalesce(k.site_id, r.site_id);
        SELECT * INTO v_tol FROM public.tolerance_pesee_applicable(v_site);
        IF v_trip IS NULL THEN
          v_classes := v_classes || 'rotation_non_retrouvee'::text;
          v_notes := v_notes || text 'Releve KOGON non rattache a une rotation';
        END IF;
        v_net_kogon := coalesce(k.net, k.brut - k.tare);
        IF v_net_kogon IS NULL THEN
          IF NOT ('donnees_incompletes' = ANY (v_classes)) THEN v_classes := v_classes || 'donnees_incompletes'::text; END IF;
          v_notes := v_notes || text 'Poids absent du releve KOGON';
        ELSIF v_net_cbg IS NOT NULL THEN
          v_ecart := v_net_cbg - v_net_kogon;
          v_pct := CASE WHEN v_net_cbg > 0 THEN round(v_ecart / v_net_cbg * 100, 3) END;
          IF NOT public.ecart_dans_tolerance(v_ecart, v_net_cbg, v_tol.tolerance_t, v_tol.tolerance_pct) THEN
            v_classes := v_classes || 'ecart_poids'::text;
            v_notes := v_notes || format('Net CBG %s t, releve KOGON %s t, ecart %s t', v_net_cbg, v_net_kogon, v_ecart);
          ELSIF v_ecart <> 0 THEN
            v_reserve := true;
            v_notes := v_notes || format('Ecart %s t dans la tolerance', v_ecart);
          END IF;
        END IF;
        v_immat_ref := coalesce(k.immatriculation_observee,
          (SELECT ve.registration FROM public.trips t JOIN public.vehicles ve ON ve.id = t.vehicle_id WHERE t.id = v_trip));
        IF l.date_pesee IS NOT NULL AND k.heure_pesee_observee IS NOT NULL
           AND l.date_pesee <> (k.heure_pesee_observee AT TIME ZONE 'Africa/Conakry')::date THEN
          v_reserve := true;
          v_notes := v_notes || format('Date CBG %s, date KOGON %s', l.date_pesee, (k.heure_pesee_observee AT TIME ZONE 'Africa/Conakry')::date);
        END IF;
        IF k.anomalie_signalee THEN
          v_reserve := true;
          v_notes := v_notes || ('Anomalie signalee par l''agent : ' || k.anomalie_texte);
        END IF;
      END IF;
      -- Camion : inconnu de la flotte, ou different de celui de la source KOGON.
      IF l.immatriculation IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.vehicles ve
                        WHERE public.normaliser_immatriculation(ve.registration) = public.normaliser_immatriculation(l.immatriculation)) THEN
          v_classes := v_classes || 'camion_non_reconnu'::text;
          v_notes := v_notes || format('Camion %s inconnu de la flotte', l.immatriculation);
        ELSIF v_immat_ref IS NOT NULL
              AND public.normaliser_immatriculation(v_immat_ref) IS DISTINCT FROM public.normaliser_immatriculation(l.immatriculation) THEN
          v_classes := v_classes || 'camion_non_reconnu'::text;
          v_notes := v_notes || format('Camion CBG %s, camion KOGON %s', l.immatriculation, v_immat_ref);
        END IF;
      END IF;
    END IF;
    IF cardinality(v_classes) = 0 THEN
      v_classes := ARRAY[CASE WHEN v_reserve THEN 'concordant_avec_reserve' ELSE 'concordant' END];
    END IF;
    INSERT INTO public.rapprochements_pesee (passe_id, releve_id, ligne_id, releve_kogon_id, trip_id, trips_candidats, site_id,
      ticket, date_cbg, immatriculation_cbg, net_cbg, heure_kogon, immatriculation_kogon, net_kogon, ecart_t, ecart_pct,
      tolerance_t, tolerance_pct, source_tolerance, classes, detail)
    VALUES (v_passe, r.id, l.id, k.id, v_trip, coalesce(v_trips, '{}'), v_site, l.ticket, l.date_pesee, l.immatriculation, v_net_cbg,
      k.heure_pesee_observee, k.immatriculation_observee, v_net_kogon, v_ecart, v_pct,
      v_tol.tolerance_t, v_tol.tolerance_pct, v_tol.source, v_classes, nullif(array_to_string(v_notes, ' ; '), ''));
  END LOOP;

  -- Releves KOGON de la periode sans ligne CBG de meme ticket.
  FOR k IN SELECT x.* FROM public.releves_kogon_perimetre(r.site_id) x
            WHERE (coalesce(x.heure_pesee_observee, x.saisi_le) AT TIME ZONE 'Africa/Conakry')::date BETWEEN r.periode_debut AND r.periode_fin
              AND NOT EXISTS (SELECT 1 FROM public.releves_cbg_lignes l2
                               WHERE l2.releve_id = r.id AND x.ticket IS NOT NULL AND upper(btrim(l2.ticket)) = upper(btrim(x.ticket)))
            ORDER BY x.heure_pesee_observee NULLS LAST, x.saisi_le LOOP
    SELECT * INTO v_tol FROM public.tolerance_pesee_applicable(k.site_id);
    v_classes := ARRAY['fiche_sans_ticket'];
    v_notes := ARRAY[CASE WHEN k.ticket IS NULL THEN 'Releve KOGON sans numero de ticket'
                          ELSE format('Ticket %s releve par KOGON, absent du releve CBG', k.ticket) END];
    IF k.trip_id IS NULL THEN v_classes := v_classes || 'rotation_non_retrouvee'::text; END IF;
    IF coalesce(k.net, k.brut - k.tare) IS NULL OR k.ticket IS NULL THEN v_classes := v_classes || 'donnees_incompletes'::text; END IF;
    INSERT INTO public.rapprochements_pesee (passe_id, releve_id, releve_kogon_id, trip_id, site_id, ticket, heure_kogon,
      immatriculation_kogon, net_kogon, tolerance_t, tolerance_pct, source_tolerance, classes, detail)
    VALUES (v_passe, r.id, k.id, k.trip_id, k.site_id, k.ticket, k.heure_pesee_observee, k.immatriculation_observee,
      coalesce(k.net, k.brut - k.tare), v_tol.tolerance_t, v_tol.tolerance_pct, v_tol.source, v_classes, array_to_string(v_notes, ' ; '));
  END LOOP;

  -- Une anomalie par constat. Un constat deja actif n'est pas recree ; un constat
  -- clos est rouvert (nouvelle anomalie) si les valeurs comparees ont change.
  FOR v_rp, v_c IN SELECT rp.id, c FROM public.rapprochements_pesee rp, unnest(rp.classes) c
                    WHERE rp.passe_id = v_passe AND c <> 'concordant' LOOP
    INSERT INTO public.anomalies_pesee (cle, releve_id, rapprochement_id, ligne_id, releve_kogon_id, trip_id, trips_concernes, site_id,
      categorie, gravite, description, sources, valeurs)
    SELECT x.* FROM (SELECT concat_ws(':', rp.releve_id, coalesce('l' || rp.ligne_id::text, 'k' || rp.releve_kogon_id::text), v_c) AS cle,
      rp.releve_id, rp.id, rp.ligne_id, rp.releve_kogon_id, rp.trip_id,
      ARRAY(SELECT DISTINCT u FROM unnest(array_append(rp.trips_candidats, rp.trip_id)) u WHERE u IS NOT NULL),
      rp.site_id, v_c, public.gravite_anomalie_pesee(v_c),
      coalesce(rp.detail, v_c),
      array_remove(ARRAY[CASE WHEN rp.ligne_id IS NOT NULL THEN 'cbg' END, CASE WHEN rp.releve_kogon_id IS NOT NULL THEN 'kogon' END,
                         CASE WHEN rp.trip_id IS NOT NULL THEN 'rotation' END], NULL),
      jsonb_strip_nulls(jsonb_build_object('ticket', rp.ticket, 'net_cbg', rp.net_cbg, 'net_kogon', rp.net_kogon, 'ecart_t', rp.ecart_t,
        'ecart_pct', rp.ecart_pct, 'tolerance_t', rp.tolerance_t, 'tolerance_pct', rp.tolerance_pct, 'source_tolerance', rp.source_tolerance,
        'immatriculation_cbg', rp.immatriculation_cbg, 'immatriculation_kogon', rp.immatriculation_kogon, 'date_cbg', rp.date_cbg,
        'trips_candidats', CASE WHEN cardinality(rp.trips_candidats) > 0 THEN to_jsonb(rp.trips_candidats) END)) AS valeurs
      FROM public.rapprochements_pesee rp WHERE rp.id = v_rp) x
     WHERE NOT EXISTS (SELECT 1 FROM public.anomalies_pesee a WHERE a.cle = x.cle AND a.statut <> 'cloturee')
       AND NOT EXISTS (SELECT 1 FROM public.anomalies_pesee a WHERE a.cle = x.cle AND a.statut = 'cloturee' AND a.valeurs = x.valeurs);
  END LOOP;
  INSERT INTO public.journal_anomalies_pesee (anomalie_id, action, statut_avant, statut_apres, nouvelle_valeur, auteur)
  SELECT a.id, 'creation', NULL, a.statut, a.valeurs, auth.uid()
    FROM public.anomalies_pesee a
    JOIN public.rapprochements_pesee rp ON rp.id = a.rapprochement_id
   WHERE rp.passe_id = v_passe;

  UPDATE public.releves_cbg SET rapproche_pesees_le = now(),
    statut = CASE WHEN statut = 'importe' THEN 'rapproche' ELSE statut END,
    rapproche_le = coalesce(rapproche_le, now())
   WHERE id = r.id;
  RETURN QUERY SELECT c, count(*)::integer FROM public.rapprochements_pesee rp, unnest(rp.classes) c
                WHERE rp.passe_id = v_passe GROUP BY c ORDER BY c;
END;
$$;

-- ===================================================================
-- 5. Anomalies : actions tracees
-- ===================================================================
CREATE OR REPLACE FUNCTION public.agir_anomalie_pesee(
  p_id uuid, p_action text, p_commentaire text DEFAULT NULL, p_preuve_ref text DEFAULT NULL, p_responsable uuid DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  a public.anomalies_pesee;
  v_com text := nullif(btrim(coalesce(p_commentaire, '')), '');
  v_preuve text := nullif(btrim(coalesce(p_preuve_ref, '')), '');
  v_statut text; v_decision text; v_responsable uuid;
BEGIN
  IF p_action = 'cloturer' THEN
    IF NOT public.has_module_write('invoices') THEN
      RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis pour cloturer' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO a FROM public.anomalies_pesee WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(a.site_id) THEN
    RAISE EXCEPTION 'Anomalie introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF a.statut = 'cloturee' THEN RAISE EXCEPTION 'Anomalie cloturee : elle ne change plus' USING ERRCODE = '22023'; END IF;
  IF public.voyage_couvert_cloture(a.trip_id)
     OR EXISTS (SELECT 1 FROM unnest(a.trips_concernes) u WHERE public.voyage_couvert_cloture(u)) THEN
    RAISE EXCEPTION 'Anomalie liee a une reconciliation cloturee : correction par avoir' USING ERRCODE = '22023';
  END IF;
  v_statut := a.statut; v_decision := a.decision; v_responsable := a.responsable_id;
  CASE p_action
    WHEN 'examiner' THEN
      IF a.statut NOT IN ('ouverte', 'verification_demandee') THEN RAISE EXCEPTION 'Transition refusee depuis %', a.statut USING ERRCODE = '22023'; END IF;
      v_statut := 'en_examen';
    WHEN 'demander_verification' THEN
      IF a.statut NOT IN ('ouverte', 'en_examen') THEN RAISE EXCEPTION 'Transition refusee depuis %', a.statut USING ERRCODE = '22023'; END IF;
      IF v_com IS NULL THEN RAISE EXCEPTION 'Preciser la verification demandee' USING ERRCODE = '22023'; END IF;
      v_statut := 'verification_demandee';
    WHEN 'ajouter_observation' THEN
      IF v_com IS NULL THEN RAISE EXCEPTION 'Observation vide' USING ERRCODE = '22023'; END IF;
    WHEN 'affecter' THEN
      IF p_responsable IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_responsable AND pr.status = 'active') THEN
        RAISE EXCEPTION 'Responsable actif requis' USING ERRCODE = '22023';
      END IF;
      v_responsable := p_responsable;
    WHEN 'confirmer_concordance', 'accepter_ecart_justifie', 'signaler_erreur_cbg' THEN
      IF a.statut NOT IN ('en_examen', 'verification_demandee') THEN
        RAISE EXCEPTION 'Examiner l''anomalie avant de conclure (statut %)', a.statut USING ERRCODE = '22023';
      END IF;
      IF v_com IS NULL THEN RAISE EXCEPTION 'Motif obligatoire' USING ERRCODE = '22023'; END IF;
      IF p_action = 'accepter_ecart_justifie' AND a.categorie = 'ecart_poids' AND v_preuve IS NULL THEN
        RAISE EXCEPTION 'Reference de preuve obligatoire pour justifier un ecart de poids' USING ERRCODE = '22023';
      END IF;
      v_statut := CASE p_action WHEN 'signaler_erreur_cbg' THEN 'erreur_cbg_signalee' ELSE 'justifiee' END;
      v_decision := CASE p_action WHEN 'confirmer_concordance' THEN 'concordance_confirmee'
                                  WHEN 'accepter_ecart_justifie' THEN 'ecart_justifie' ELSE 'erreur_cbg' END;
    WHEN 'soumettre_validation' THEN
      IF a.statut NOT IN ('justifiee', 'erreur_cbg_signalee') THEN RAISE EXCEPTION 'Transition refusee depuis %', a.statut USING ERRCODE = '22023'; END IF;
      v_statut := 'soumise_validation';
    WHEN 'renvoyer' THEN
      IF a.statut <> 'soumise_validation' THEN RAISE EXCEPTION 'Transition refusee depuis %', a.statut USING ERRCODE = '22023'; END IF;
      IF v_com IS NULL THEN RAISE EXCEPTION 'Motif du renvoi obligatoire' USING ERRCODE = '22023'; END IF;
      v_statut := 'en_examen';
    WHEN 'cloturer' THEN
      IF a.statut <> 'soumise_validation' THEN RAISE EXCEPTION 'Seule une anomalie soumise a validation se cloture' USING ERRCODE = '22023'; END IF;
      -- Separation des taches (D-064, delegants compris, toutes categories) : ni
      -- l'auteur de la conclusion, ni celui qui a soumis, ne cloturent.
      IF a.soumis_par IS NULL OR a.conclu_par IS NULL
         OR public.separation_violee(a.soumis_par, 'invoices', 'trips', a.soumis_le)
         OR public.separation_violee(a.conclu_par, 'invoices', 'trips', a.conclu_le) THEN
        RAISE EXCEPTION 'La cloture revient a une autre personne que celles qui ont conclu et soumis l''anomalie' USING ERRCODE = '42501';
      END IF;
      v_statut := 'cloturee';
    ELSE
      RAISE EXCEPTION 'Action inconnue : %', p_action USING ERRCODE = '22023';
  END CASE;
  INSERT INTO public.journal_anomalies_pesee (anomalie_id, action, statut_avant, statut_apres, ancienne_valeur, nouvelle_valeur,
    commentaire, preuve_ref, auteur)
  VALUES (a.id, p_action, a.statut, v_statut,
    jsonb_build_object('statut', a.statut, 'decision', a.decision, 'responsable_id', a.responsable_id, 'preuve_ref', a.preuve_ref),
    jsonb_build_object('statut', v_statut, 'decision', v_decision, 'responsable_id', v_responsable, 'preuve_ref', coalesce(v_preuve, a.preuve_ref)),
    v_com, v_preuve, auth.uid());
  UPDATE public.anomalies_pesee SET statut = v_statut, decision = v_decision, responsable_id = v_responsable,
    commentaire = coalesce(v_com, commentaire), preuve_ref = coalesce(v_preuve, preuve_ref),
    soumis_par = CASE WHEN p_action = 'soumettre_validation' THEN auth.uid() WHEN p_action = 'renvoyer' THEN NULL ELSE soumis_par END,
    soumis_le = CASE WHEN p_action = 'soumettre_validation' THEN now() WHEN p_action = 'renvoyer' THEN NULL ELSE soumis_le END,
    conclu_par = CASE WHEN p_action IN ('confirmer_concordance', 'accepter_ecart_justifie', 'signaler_erreur_cbg') THEN auth.uid() ELSE conclu_par END,
    conclu_le = CASE WHEN p_action IN ('confirmer_concordance', 'accepter_ecart_justifie', 'signaler_erreur_cbg') THEN now() ELSE conclu_le END,
    cloture_par = CASE WHEN p_action = 'cloturer' THEN auth.uid() ELSE cloture_par END,
    cloture_le = CASE WHEN p_action = 'cloturer' THEN now() ELSE cloture_le END
   WHERE id = a.id;
  RETURN v_statut;
END;
$$;

-- Une ligne est engagee quand le voyage de meme ticket figure dans une reconciliation cloturee.
CREATE OR REPLACE FUNCTION public.releve_cbg_engage(p_releve_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.releves_cbg_lignes l
      JOIN public.v_tickets_pesee_cbg_effectifs k ON upper(btrim(k.ticket)) = upper(btrim(l.ticket))
      JOIN public.reconciliation_lignes rl ON rl.trip_id = k.trip_id
      JOIN public.reconciliations rc ON rc.id = rl.reconciliation_id AND rc.statut = 'cloturee'
     WHERE l.releve_id = p_releve_id)
  OR EXISTS (
    SELECT 1 FROM public.rapprochements_pesee rp
      JOIN public.reconciliation_lignes rl ON rl.trip_id = rp.trip_id
      JOIN public.reconciliations rc ON rc.id = rl.reconciliation_id AND rc.statut = 'cloturee'
     WHERE rp.releve_id = p_releve_id);
$$;

CREATE OR REPLACE FUNCTION public.annuler_releve_cbg(p_releve_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.releves_cbg; v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  -- Annuler un releve change le tonnage facture : droit facturation.
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.releves_cbg WHERE id = p_releve_id FOR UPDATE;
  IF NOT FOUND OR NOT public.site_permis(r.site_id) THEN RAISE EXCEPTION 'Releve introuvable' USING ERRCODE = 'P0002'; END IF;
  IF r.importe_par IS NULL OR public.separation_violee(r.importe_par, 'invoices', 'trips', r.importe_le) THEN
    RAISE EXCEPTION 'L''annulation revient a une autre personne que celle qui a importe le releve' USING ERRCODE = '42501';
  END IF;
  IF r.statut = 'annule' THEN RAISE EXCEPTION 'Releve deja annule' USING ERRCODE = '22023'; END IF;
  IF v_motif IS NULL THEN RAISE EXCEPTION 'Motif d''annulation obligatoire' USING ERRCODE = '22023'; END IF;
  IF public.releve_cbg_engage(r.id) THEN
    RAISE EXCEPTION 'Releve engage dans une reconciliation cloturee : correction par avoir' USING ERRCODE = '22023';
  END IF;
  UPDATE public.releves_cbg SET statut = 'annule', annule_par = auth.uid(), annule_le = now(), motif_annulation = v_motif WHERE id = r.id;
  -- Les anomalies ouvertes du releve sont closes avec ce motif, tracees.
  INSERT INTO public.journal_anomalies_pesee (anomalie_id, action, statut_avant, statut_apres, ancienne_valeur, nouvelle_valeur, commentaire, auteur)
  SELECT a.id, 'releve_annule', a.statut, 'cloturee', jsonb_build_object('statut', a.statut, 'decision', a.decision),
    jsonb_build_object('statut', 'cloturee', 'decision', 'releve_annule'), v_motif, auth.uid()
    FROM public.anomalies_pesee a WHERE a.releve_id = r.id AND a.statut <> 'cloturee';
  UPDATE public.anomalies_pesee SET statut = 'cloturee', decision = 'releve_annule', commentaire = v_motif,
    cloture_par = auth.uid(), cloture_le = now()
   WHERE releve_id = r.id AND statut <> 'cloturee';
END;
$$;

-- ===================================================================
-- 6. Securite : RLS, lecture selon module et site, aucune ecriture directe
-- ===================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['releves_terrain_kogon', 'parametres_tolerance_pesee', 'passes_rapprochement_pesee',
                           'rapprochements_pesee', 'anomalies_pesee', 'journal_anomalies_pesee'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS lecture ON public.%I', t);
  END LOOP;
END $$;
CREATE POLICY lecture ON public.releves_terrain_kogon FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin()) AND public.site_permis(site_id));
CREATE POLICY lecture ON public.parametres_tolerance_pesee FOR SELECT TO authenticated
  USING (public.has_module_view('trips') OR public.has_module_view('invoices') OR public.has_module_view('settings') OR public.is_admin());
CREATE POLICY lecture ON public.passes_rapprochement_pesee FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.releves_cbg r WHERE r.id = releve_id));
CREATE POLICY lecture ON public.rapprochements_pesee FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.releves_cbg r WHERE r.id = releve_id) AND public.site_permis(site_id));
CREATE POLICY lecture ON public.anomalies_pesee FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.has_module_view('invoices') OR public.is_admin()) AND public.site_permis(site_id));
CREATE POLICY lecture ON public.journal_anomalies_pesee FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.anomalies_pesee a WHERE a.id = anomalie_id));

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'importer_releve_cbg_v2(text, date, date, uuid, text, text, jsonb, jsonb)',
    'annuler_releve_cbg(uuid, text)',
    'saisir_releve_terrain_kogon(uuid, uuid, uuid, jsonb)',
    'definir_tolerance_pesee(uuid, numeric, numeric, text)',
    'tolerance_pesee_applicable(uuid)',
    'rapprocher_pesees(uuid)',
    'agir_anomalie_pesee(uuid, text, text, text, uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
  -- Fonctions internes (appelees par les fonctions serveur) : fermees aux comptes.
  FOREACH sig IN ARRAY ARRAY['releve_cbg_engage(uuid)', 'releves_kogon_perimetre(uuid)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', sig);
  END LOOP;
END $$;

-- M3 (revue) : l'import sans empreinte ni controle de colonnes n'est plus
-- executable par les comptes ; l'ecran appelle importer_releve_cbg_v2.
REVOKE EXECUTE ON FUNCTION public.importer_releve_cbg(text, date, date, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.importer_releve_cbg(text, date, date, uuid, text, jsonb) TO service_role;

-- ===================================================================
-- 7. Reconciliation : tonnage CBG officiel, releve KOGON distinct
--    (rebase sur la definition finale de 20261121160000_defauts_bloquants_j1, main 8dec42c)
-- ===================================================================
ALTER TABLE public.reconciliation_lignes ADD COLUMN IF NOT EXISTS releve_cbg_ligne_id uuid REFERENCES public.releves_cbg_lignes(id);
COMMENT ON COLUMN public.reconciliation_lignes.tonnage_cbg IS
  'Net de la ligne du releve officiel CBG du meme ticket (releve non annule) ; NULL sans releve CBG (anomalie sans_releve_cbg), D-081.';
COMMENT ON COLUMN public.reconciliation_lignes.tonnage_kogon IS
  'Net du releve KOGON du ticket CBG (tickets_pesee_cbg en vigueur), D-081 ; le tonnage de chargement est tonnage_charge.';

CREATE OR REPLACE FUNCTION public.ligne_bloquee(p_anomalies text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_anomalies && ARRAY['base_absente', 'litige', 'rejet', 'ecart_hors_tolerance',
    'ecart_double_pesee', 'sans_double_pesee', 'sans_ticket_cbg', 'ticket_rectifie',
    'ticket_double', 'non_accepte', 'net_superieur_capacite',
    'releve_cbg_ambigu', 'ecart_releve_cbg', 'anomalie_pesee_ouverte', 'sans_releve_cbg', 'releve_non_rapproche'];
$$;

-- M1 (revue) : une decision « facturable » est perimee si une anomalie non
-- forcable est presente, si une anomalie bloquante nouvelle apparait apres
-- la decision, ou si le tonnage de base a change.
CREATE OR REPLACE FUNCTION public.decision_facturable_perimee(p_anciennes text[], p_nouvelles text[], p_ancienne_base numeric, p_nouvelle_base numeric)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT public.ligne_non_forcable(p_nouvelles)
      OR p_ancienne_base IS DISTINCT FROM p_nouvelle_base
      OR EXISTS (SELECT 1 FROM unnest(coalesce(p_nouvelles, '{}')) x
                  WHERE public.ligne_bloquee(ARRAY[x]) AND NOT (x = ANY (coalesce(p_anciennes, '{}'))));
$$;

CREATE OR REPLACE FUNCTION public.actualiser_reconciliation(p_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.reconciliations; n integer;
BEGIN
  IF NOT public.has_module_write('invoices') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la facturation requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.reconciliations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconciliation introuvable' USING ERRCODE = 'P0002'; END IF;
  IF r.statut <> 'ouverte' THEN RAISE EXCEPTION 'Reconciliation cloturee : elle ne change plus' USING ERRCODE = '22023'; END IF;
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.calcul_reconciliation (LIKE public.reconciliation_lignes) ON COMMIT DROP;
  DELETE FROM pg_temp.calcul_reconciliation;
  INSERT INTO pg_temp.calcul_reconciliation (id, reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat,
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies,
    ticket_brut, ticket_tare, ticket_document_ref, ticket_rectifie, releve_cbg_ligne_id)
  SELECT gen_random_uuid(), r.id, t.id, t.reference, t.planned_date, t.vehicle_id, t.etat,
    coalesce(t.net_weight, t.load_weight),
    -- Recu : releve officiel CBG s'il est connu ; sinon releve KOGON, signale par sans_releve_cbg
    -- (bloquant) ; releve ambigu : aucun (base absente, non forcable).
    rv.recu, t.accepted_tonnage,
    p.net, cb.net,
    bs.base,
    coalesce(p.ticket, tk.ticket), fi.fiche,
    array_remove(ARRAY[
      CASE WHEN coalesce(t.net_weight, t.load_weight, p.net, t.net_weight_reception) IS NULL THEN 'sans_pesee' END,
      CASE WHEN bs.base IS NULL THEN 'base_absente' END,
      CASE WHEN coalesce(t.net_weight, t.load_weight) > 0 AND rv.recu IS NOT NULL
        AND abs(rv.recu - coalesce(t.net_weight, t.load_weight)) / coalesce(t.net_weight, t.load_weight) * 100
          > r.tolerance_ecart_pct THEN 'ecart_hors_tolerance' END,
      CASE WHEN p.trip_id IS NULL THEN 'sans_ticket_cbg' END,
      CASE WHEN p.est_rectifie THEN 'ticket_rectifie' END,
      -- m4 : ticket KOGON ou valeur facturee au-dessus de la capacite du camion.
      CASE WHEN veh.capacity_tonnes > 0 AND (p.net > veh.capacity_tonnes OR bs.base > veh.capacity_tonnes) THEN 'net_superieur_capacite' END,
      CASE WHEN t.etat = 'DISPUTED' THEN 'litige' END,
      CASE WHEN t.etat = 'REJECTED' THEN 'rejet' END,
      CASE WHEN r.base_tonnage = 'accepte' AND t.etat = 'DELIVERED' THEN 'non_accepte' END,
      CASE WHEN coalesce(p.ticket, tk.ticket) IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.trip_events e2 WHERE e2.donnees ? 'ticket'
          AND upper(btrim(e2.donnees ->> 'ticket')) = upper(btrim(coalesce(p.ticket, tk.ticket))) AND e2.trip_id <> t.id) THEN 'ticket_double' END,
      CASE WHEN fi.fiche IS NULL THEN 'sans_fiche' END,
      -- D-081 : deux sources. Sans ligne du releve officiel : signale, jamais confondu.
      CASE WHEN p.trip_id IS NOT NULL AND coalesce(cb.nombre, 0) = 0 THEN 'sans_releve_cbg' END,
      CASE WHEN cb.nombre > 1 THEN 'releve_cbg_ambigu' END,
      CASE WHEN cb.nombre >= 1 AND cb.non_rapproche THEN 'releve_non_rapproche' END,
      CASE WHEN cb.net IS NOT NULL AND p.net IS NOT NULL
        AND NOT public.ecart_dans_tolerance(cb.net - p.net, cb.net, tol.tolerance_t, tol.tolerance_pct) THEN 'ecart_releve_cbg' END,
      CASE WHEN EXISTS (SELECT 1 FROM public.anomalies_pesee ap
                         WHERE (ap.trip_id = t.id OR t.id = ANY (ap.trips_concernes)) AND ap.statut <> 'cloturee') THEN 'anomalie_pesee_ouverte' END
    ], NULL), p.brut, p.tare, p.document_ref, coalesce(p.est_rectifie, false), cb.ligne_id
  FROM public.trips t
  LEFT JOIN public.vehicles veh ON veh.id = t.vehicle_id
  LEFT JOIN public.v_tickets_pesee_cbg_effectifs p ON p.trip_id = t.id
  -- Ligne(s) du releve officiel CBG portant le meme ticket : une seule valeur retenue,
  -- plusieurs valeurs differentes = ambigu (aucune choisie).
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT coalesce(l.net, l.brut - l.tare))::integer AS nombre,
           CASE WHEN count(DISTINCT coalesce(l.net, l.brut - l.tare)) = 1 THEN min(coalesce(l.net, l.brut - l.tare)) END AS net,
           CASE WHEN count(DISTINCT coalesce(l.net, l.brut - l.tare)) = 1
                THEN (array_agg(l.id ORDER BY rc.importe_le DESC, l.rang))[1] END AS ligne_id,
           coalesce(bool_or(rc.rapproche_pesees_le IS NULL), false) AS non_rapproche
      FROM public.releves_cbg_lignes l JOIN public.releves_cbg rc ON rc.id = l.releve_id AND rc.statut <> 'annule'
     WHERE p.ticket IS NOT NULL AND upper(btrim(l.ticket)) = upper(btrim(p.ticket))
       AND coalesce(l.net, l.brut - l.tare) > 0 AND coalesce(l.brut, 1) > 0 AND coalesce(l.tare, 0) >= 0) cb ON true
  LEFT JOIN LATERAL (SELECT CASE WHEN cb.nombre > 1 THEN NULL ELSE coalesce(cb.net, p.net, t.net_weight_reception) END AS recu) rv ON true
  LEFT JOIN LATERAL (SELECT CASE r.base_tonnage WHEN 'accepte' THEN t.accepted_tonnage WHEN 'recu' THEN rv.recu
                                ELSE coalesce(t.net_weight, t.load_weight) END AS base) bs ON true
  LEFT JOIN LATERAL (SELECT * FROM public.tolerance_pesee_applicable(t.arrival_site_id)) tol ON true
  LEFT JOIN LATERAL (
    SELECT e.donnees ->> 'ticket' AS ticket FROM public.trip_events e
    WHERE e.trip_id = t.id AND e.etat_apres = 'WEIGHED_IN' AND e.donnees ? 'ticket'
    ORDER BY e.survenu_le DESC LIMIT 1) tk ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(e.donnees ->> 'fiche', substring(e.note FROM 'Fiche ([A-Z]{2}-\d{6}-\d+)')) AS fiche
    FROM public.trip_events e WHERE e.trip_id = t.id AND (e.donnees ? 'fiche' OR e.note LIKE 'Fiche %')
    ORDER BY e.survenu_le LIMIT 1) fi ON true
  WHERE t.planned_date BETWEEN r.periode_debut AND r.periode_fin
    AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED')
    AND (r.site_depart_id IS NULL OR t.departure_site_id = r.site_depart_id)
    AND (r.site_arrivee_id IS NULL OR t.arrival_site_id = r.site_arrivee_id);
  DELETE FROM public.reconciliation_lignes l WHERE l.reconciliation_id = r.id
    AND NOT EXISTS (SELECT 1 FROM pg_temp.calcul_reconciliation c WHERE c.trip_id = l.trip_id);
  INSERT INTO public.reconciliation_lignes (reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat,
    tonnage_charge, tonnage_recu, tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies,
    ticket_brut, ticket_tare, ticket_document_ref, ticket_rectifie, releve_cbg_ligne_id)
  SELECT reconciliation_id, trip_id, reference, date_voyage, vehicle_id, etat, tonnage_charge, tonnage_recu,
    tonnage_accepte, tonnage_kogon, tonnage_cbg, tonnage_base, ticket, fiche, anomalies,
    ticket_brut, ticket_tare, ticket_document_ref, ticket_rectifie, releve_cbg_ligne_id
  FROM pg_temp.calcul_reconciliation
  ON CONFLICT (reconciliation_id, trip_id) DO UPDATE SET
    reference = EXCLUDED.reference, date_voyage = EXCLUDED.date_voyage, vehicle_id = EXCLUDED.vehicle_id,
    etat = EXCLUDED.etat, tonnage_charge = EXCLUDED.tonnage_charge, tonnage_recu = EXCLUDED.tonnage_recu,
    tonnage_accepte = EXCLUDED.tonnage_accepte, tonnage_kogon = EXCLUDED.tonnage_kogon, tonnage_cbg = EXCLUDED.tonnage_cbg,
    tonnage_base = EXCLUDED.tonnage_base, ticket = EXCLUDED.ticket, fiche = EXCLUDED.fiche, anomalies = EXCLUDED.anomalies,
    ticket_brut = EXCLUDED.ticket_brut, ticket_tare = EXCLUDED.ticket_tare,
    ticket_document_ref = EXCLUDED.ticket_document_ref, ticket_rectifie = EXCLUDED.ticket_rectifie,
    releve_cbg_ligne_id = EXCLUDED.releve_cbg_ligne_id,
    -- Repris de J1 final (20261121160000), etendu (M1) : une decision
    -- « facturable » perimee est invalidee, la ligne repasse a examiner.
    decision = CASE WHEN reconciliation_lignes.decision = 'facturable' AND public.decision_facturable_perimee(reconciliation_lignes.anomalies, EXCLUDED.anomalies, reconciliation_lignes.tonnage_base, EXCLUDED.tonnage_base)
      THEN NULL ELSE reconciliation_lignes.decision END,
    motif_decision = CASE WHEN reconciliation_lignes.decision = 'facturable' AND public.decision_facturable_perimee(reconciliation_lignes.anomalies, EXCLUDED.anomalies, reconciliation_lignes.tonnage_base, EXCLUDED.tonnage_base)
      THEN NULL ELSE reconciliation_lignes.motif_decision END,
    decide_par = CASE WHEN reconciliation_lignes.decision = 'facturable' AND public.decision_facturable_perimee(reconciliation_lignes.anomalies, EXCLUDED.anomalies, reconciliation_lignes.tonnage_base, EXCLUDED.tonnage_base)
      THEN NULL ELSE reconciliation_lignes.decide_par END,
    decide_le = CASE WHEN reconciliation_lignes.decision = 'facturable' AND public.decision_facturable_perimee(reconciliation_lignes.anomalies, EXCLUDED.anomalies, reconciliation_lignes.tonnage_base, EXCLUDED.tonnage_base)
      THEN NULL ELSE reconciliation_lignes.decide_le END;
  SELECT count(*) INTO n FROM public.reconciliation_lignes WHERE reconciliation_id = r.id;
  UPDATE public.reconciliations SET actualisee_le = now() WHERE id = r.id;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.actualiser_reconciliation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualiser_reconciliation(uuid) TO authenticated;

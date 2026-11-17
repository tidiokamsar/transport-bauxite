/*
  # Operations transport : journal unifie du voyage et controles (D-088)

  Programme de coherence operationnelle du 2026-11-17. Le voyage (`trips`) est
  l'objet central ; aucun module ne cree de copie d'un voyage. Cette migration
  n'ajoute aucune copie de donnee : elle assemble et controle l'existant.

  1. Vue `v_journal_voyage` (SECURITY INVOKER : RLS et perimetre du lecteur) :
     une ligne par evenement source, sans recopie, assemblee depuis
     `trip_events`, `decisions_dispatch`, `suspensions_voyage` (D-087),
     `fiches_rotations_lignes` et `fiches_journal` (D-089), `tickets_pesee_cbg`
     et `rectifications_tickets_pesee_cbg` (D-037), `releves_terrain_kogon`,
     `releves_cbg_lignes` (via `rapprochements_pesee`), `rapprochements_pesee`,
     `anomalies_pesee` et `journal_anomalies_pesee` (D-081), `pieces_jointes`
     (D-083) et la nouvelle table de verification ci-dessous. Chaque ligne :
     identifiant prefixe par la source, voyage, rotation (`trips.shift_sequence`
     quand elle est connue), type, date d'operation, date de saisie, source,
     auteur, donnees, justificatif, statut, reference de l'evenement corrige,
     annulation.
  2. Information manquante : le statut de verification d'un evenement declare.
     Table append-only `verifications_evenements_voyage` ; ecriture par
     `verifier_evenement_voyage` seulement (droit d'ecriture trips, perimetre du
     voyage, l'auteur d'une saisie ne la verifie pas, le verificateur ne valide
     pas, controle de concurrence par la derniere verification connue, motif
     pour contester ou revenir sur une verification). Une correction est une
     nouvelle ligne qui cite la precedente : rien n'est ecrase.
  3. `controles_voyage(p_trip_id)` (SECURITY DEFINER, perimetre controle avant
     toute lecture) : affectation valide, chauffeur habilite, etapes
     coherentes, kilometrage coherent, fiche presente, ticket associe, pas de
     double comptage. Constats seulement : le systeme recommande, l'humain
     decide ; aucune ecriture.

  Aucune fonction existante n'est redefinie. Additive et idempotente.
*/

-- ===================================================================
-- 1. Verification des evenements declares (append-only)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.verifications_evenements_voyage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rang bigint GENERATED ALWAYS AS IDENTITY,
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  evenement_id text NOT NULL CHECK (evenement_id ~ '^[a-z_]+:[0-9a-f-]{36}$'),
  statut text NOT NULL CHECK (statut IN ('verifie', 'valide', 'conteste')),
  motif text,
  precedente_id uuid REFERENCES public.verifications_evenements_voyage(id),
  auteur uuid NOT NULL REFERENCES auth.users(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  CHECK (statut <> 'conteste' OR char_length(btrim(coalesce(motif, ''))) >= 5)
);
CREATE INDEX IF NOT EXISTS verifications_evenements_voyage_evt_idx
  ON public.verifications_evenements_voyage (evenement_id, rang);
CREATE INDEX IF NOT EXISTS verifications_evenements_voyage_trip_idx
  ON public.verifications_evenements_voyage (trip_id);
CREATE UNIQUE INDEX IF NOT EXISTS verifications_evenements_voyage_precedente_uq
  ON public.verifications_evenements_voyage (precedente_id) WHERE precedente_id IS NOT NULL;

DROP TRIGGER IF EXISTS verifications_evenements_voyage_immuable ON public.verifications_evenements_voyage;
CREATE TRIGGER verifications_evenements_voyage_immuable BEFORE UPDATE OR DELETE ON public.verifications_evenements_voyage
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_dispatch();

ALTER TABLE public.verifications_evenements_voyage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verifications_evenements_voyage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.verifications_evenements_voyage TO authenticated;
GRANT ALL ON public.verifications_evenements_voyage TO service_role;
DROP POLICY IF EXISTS lecture ON public.verifications_evenements_voyage;
CREATE POLICY lecture ON public.verifications_evenements_voyage FOR SELECT TO authenticated
  USING ((public.has_module_view('trips') OR public.is_admin()) AND public.voyage_permis(trip_id));

-- Index de lecture du journal par voyage (absents des migrations d'origine).
CREATE INDEX IF NOT EXISTS fiches_rotations_lignes_trip_idx ON public.fiches_rotations_lignes (trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fiches_terrain_trip_idx ON public.fiches_terrain (trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rapprochements_pesee_trip_idx ON public.rapprochements_pesee (trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS anomalies_pesee_trip_idx ON public.anomalies_pesee (trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS releves_terrain_kogon_trip_idx ON public.releves_terrain_kogon (trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pieces_jointes_objet_idx ON public.pieces_jointes (objet_type, objet_id);

-- ===================================================================
-- 2. Journal unifie du voyage (vue, droits du lecteur)
-- ===================================================================
-- Statut : declare (saisi, non verifie), verifie, valide, conteste ; la
-- derniere verification enregistree prime sur le statut d'origine.
-- Source : canal d'entree connu par la table d'origine (dispatch, agent_kogon,
-- import_cbg, systeme, autre) ; aucune source n'est devinee.
CREATE OR REPLACE VIEW public.v_journal_voyage WITH (security_invoker = true) AS
WITH fiches_voyage AS (
  SELECT l.fiche_id, l.trip_id FROM public.fiches_rotations_lignes l WHERE l.trip_id IS NOT NULL
  UNION
  SELECT f.id, f.trip_id FROM public.fiches_terrain f WHERE f.trip_id IS NOT NULL
),
anomalies_voyage AS (
  SELECT DISTINCT a.id AS anomalie_id, x.trip_id
    FROM public.anomalies_pesee a
    CROSS JOIN LATERAL unnest(array_prepend(a.trip_id, a.trips_concernes)) AS x(trip_id)
   WHERE x.trip_id IS NOT NULL
),
lignes_cbg_voyage AS (
  SELECT DISTINCT r.ligne_id, r.trip_id FROM public.rapprochements_pesee r
   WHERE r.ligne_id IS NOT NULL AND r.trip_id IS NOT NULL
),
u AS (
  -- Cycle du voyage
  SELECT 'trip_event:' || e.id AS id, e.trip_id, 'etat'::text AS type,
         coalesce(e.etat_avant, '-') || ' -> ' || e.etat_apres AS libelle,
         e.survenu_le AS date_operation, e.enregistre_le AS date_saisie,
         CASE WHEN e.origine = 'detecte' THEN 'systeme'
              WHEN e.etat_apres IN ('DRAFT', 'PLANNED', 'ASSIGNED') THEN 'dispatch'
              WHEN e.donnees ? 'fiche' OR e.donnees ? 'fiche_id' THEN 'agent_kogon'
              ELSE 'autre' END AS source,
         e.auteur, e.donnees || jsonb_build_object('note', e.note, 'etat_apres', e.etat_apres) AS donnees,
         coalesce(e.donnees ->> 'ticket', e.donnees ->> 'fiche') AS justificatif,
         CASE e.origine WHEN 'valide' THEN 'valide' ELSE 'declare' END AS statut_base,
         NULL::text AS corrige_ref, false AS annule, 'trip_events'::text AS table_source
    FROM public.trip_events e
  UNION ALL
  -- Decisions du Dispatch (affectation, reaffectation : la precedente est citee)
  SELECT 'decision_dispatch:' || d.id, d.trip_id, d.nature,
         d.nature || ' ' || d.decision,
         d.decide_le, d.decide_le, 'dispatch', d.auteur,
         jsonb_build_object('decision', d.decision, 'vehicle_id', d.vehicle_id, 'driver_id', d.driver_id,
                            'loader_vehicle_id', d.loader_vehicle_id, 'avant', d.avant, 'motif', d.motif),
         NULL, 'valide',
         CASE WHEN d.nature = 'reaffectation' THEN
           (SELECT 'decision_dispatch:' || p.id FROM public.decisions_dispatch p
             WHERE p.trip_id = d.trip_id AND p.id <> d.id
               AND (p.decide_le, CASE p.nature WHEN 'affectation' THEN 0 ELSE 1 END, p.id::text)
                 < (d.decide_le, CASE d.nature WHEN 'affectation' THEN 0 ELSE 1 END, d.id::text)
             ORDER BY p.decide_le DESC, CASE p.nature WHEN 'affectation' THEN 0 ELSE 1 END DESC, p.id::text DESC LIMIT 1) END,
         d.decision = 'refusee', 'decisions_dispatch'
    FROM public.decisions_dispatch d
  UNION ALL
  -- Suspensions et reprises (D-087) : une reprise cite la suspension levee
  SELECT 'suspension:' || s.id, s.trip_id, s.action, s.action || ' (etat ' || s.etat_voyage || ')',
         s.cree_le, s.cree_le, 'dispatch', s.auteur,
         jsonb_build_object('motif', s.motif, 'etat_voyage', s.etat_voyage), NULL, 'valide',
         CASE WHEN s.action = 'reprise' THEN
           (SELECT 'suspension:' || p.id FROM public.suspensions_voyage p
             WHERE p.trip_id = s.trip_id AND p.rang < s.rang AND p.action = 'suspension'
             ORDER BY p.rang DESC LIMIT 1) END,
         false, 'suspensions_voyage'
    FROM public.suspensions_voyage s
  UNION ALL
  -- Rotation declaree sur une fiche FR (D-089)
  SELECT 'ligne_fiche:' || l.id, l.trip_id, 'ligne_fiche_rotation',
         'Rotation ' || l.rang || ' de la fiche ' || f.numero,
         coalesce(l.depart_le, l.arrivee_le), coalesce(l.modifie_le, l.saisi_le), 'agent_kogon',
         coalesce(l.modifie_par, l.saisi_par),
         jsonb_build_object('fiche_id', f.id, 'fiche', f.numero, 'etat_fiche', f.etat, 'rang', l.rang,
                            'km_depart', l.km_depart, 'km_arrivee', l.km_arrivee, 'ticket_cbg', l.ticket_cbg,
                            'depart_le', l.depart_le, 'arrivee_le', l.arrivee_le, 'etapes', l.etapes,
                            'observations', l.observations, 'incidents', l.incidents),
         f.numero,
         CASE WHEN f.etat IN ('validee', 'archivee') THEN 'valide'
              WHEN f.controle_le IS NOT NULL AND f.etat NOT IN ('a_corriger', 'saisie_en_cours') THEN 'verifie'
              ELSE 'declare' END,
         NULL, f.etat = 'annulee', 'fiches_rotations_lignes'
    FROM public.fiches_rotations_lignes l
    JOIN public.fiches_terrain f ON f.id = l.fiche_id
   WHERE l.trip_id IS NOT NULL
  UNION ALL
  -- Cycle des fiches reliees au voyage (preparation, impression, remise, retour, controle...)
  SELECT 'fiche_journal:' || j.id, fv.trip_id, 'fiche_' || j.action,
         'Fiche ' || f.numero || ' : ' || j.action
           || CASE WHEN j.etat_apres IS NOT NULL THEN ' (' || coalesce(j.etat_avant, '-') || ' -> ' || j.etat_apres || ')' ELSE '' END,
         j.survenu_le, j.survenu_le, 'agent_kogon', j.auteur,
         j.donnees || jsonb_build_object('fiche_id', f.id, 'fiche', f.numero, 'motif', j.motif, 'version', j.version),
         f.numero, 'valide', NULL, f.etat = 'annulee', 'fiches_journal'
    FROM public.fiches_journal j
    JOIN fiches_voyage fv ON fv.fiche_id = j.fiche_id
    JOIN public.fiches_terrain f ON f.id = j.fiche_id
  UNION ALL
  -- Ticket de reception (transcription du ticket officiel CBG)
  SELECT 'ticket_cbg:' || t.id, t.trip_id, 'ticket_cbg', 'Ticket CBG ' || t.ticket,
         t.mesure_le, t.cree_le, 'agent_kogon', t.saisi_par,
         jsonb_build_object('ticket', t.ticket, 'brut', t.brut, 'tare', t.tare, 'net', t.net,
                            'fiche_id', t.fiche_id, 'document_ref', t.document_ref),
         coalesce(t.document_ref, t.ticket),
         CASE WHEN EXISTS (SELECT 1 FROM public.rapprochements_pesee r
                            JOIN public.releves_cbg rc ON rc.id = r.releve_id AND rc.statut <> 'annule'
                           WHERE r.trip_id = t.trip_id AND 'concordant' = ANY (r.classes))
              THEN 'verifie' ELSE 'declare' END,
         NULL, false, 'tickets_pesee_cbg'
    FROM public.tickets_pesee_cbg t
  UNION ALL
  -- Rectification d'un ticket : cite le ticket corrige, garde l'ancien et le nouveau
  SELECT 'rectification_ticket:' || r.id, t.trip_id, 'rectification_ticket',
         'Rectification du ticket ' || r.ancien_ticket || ' -> ' || r.nouveau_ticket,
         r.corrige_le, r.corrige_le, 'agent_kogon', r.corrige_par,
         jsonb_build_object('ancien', jsonb_build_object('ticket', r.ancien_ticket, 'brut', r.ancien_brut, 'tare', r.ancienne_tare, 'net', r.ancien_net),
                            'nouveau', jsonb_build_object('ticket', r.nouveau_ticket, 'brut', r.nouveau_brut, 'tare', r.nouvelle_tare, 'net', r.nouveau_net),
                            'motif', r.motif),
         coalesce(r.nouveau_document_ref, r.nouveau_ticket), 'declare', 'ticket_cbg:' || r.ticket_id, false,
         'rectifications_tickets_pesee_cbg'
    FROM public.rectifications_tickets_pesee_cbg r
    JOIN public.tickets_pesee_cbg t ON t.id = r.ticket_id
  UNION ALL
  -- Releve terrain KOGON (source B) : un remplacement cite le releve remplace
  SELECT 'releve_kogon:' || k.id, k.trip_id, 'releve_kogon', 'Releve KOGON' || coalesce(' ticket ' || k.ticket, ''),
         k.heure_pesee_observee, k.saisi_le, 'agent_kogon', k.saisi_par,
         jsonb_build_object('ticket', k.ticket, 'brut', k.brut, 'tare', k.tare, 'net', k.net, 'agent', k.agent,
                            'anomalie', k.anomalie_texte, 'observations', k.observations, 'motif_remplacement', k.motif_remplacement),
         k.ticket, 'declare',
         CASE WHEN k.remplace_id IS NOT NULL THEN 'releve_kogon:' || k.remplace_id END,
         EXISTS (SELECT 1 FROM public.releves_terrain_kogon n WHERE n.remplace_id = k.id), 'releves_terrain_kogon'
    FROM public.releves_terrain_kogon k
   WHERE k.trip_id IS NOT NULL
  UNION ALL
  -- Ligne du releve officiel CBG (source A), reliee au voyage par le rapprochement
  SELECT 'ligne_releve_cbg:' || lc.id, lv.trip_id, 'ligne_releve_cbg',
         'Releve officiel CBG ' || rc.reference || coalesce(' ticket ' || lc.ticket, ''),
         lc.date_pesee::timestamptz, rc.importe_le, 'import_cbg', rc.importe_par,
         jsonb_build_object('releve_id', rc.id, 'releve', rc.reference, 'rang', lc.rang, 'ticket', lc.ticket,
                            'immatriculation', lc.immatriculation, 'brut', lc.brut, 'tare', lc.tare, 'net', lc.net),
         rc.reference, 'valide', NULL, rc.statut = 'annule', 'releves_cbg_lignes'
    FROM lignes_cbg_voyage lv
    JOIN public.releves_cbg_lignes lc ON lc.id = lv.ligne_id
    JOIN public.releves_cbg rc ON rc.id = lc.releve_id
  UNION ALL
  -- Rapprochement des deux sources (une ligne par passe)
  SELECT 'rapprochement:' || r.id, r.trip_id, 'rapprochement_pesee',
         'Rapprochement : ' || array_to_string(r.classes, ', '),
         r.cree_le, r.cree_le, 'systeme', NULL,
         jsonb_build_object('classes', r.classes, 'ticket', r.ticket, 'net_cbg', r.net_cbg, 'net_kogon', r.net_kogon,
                            'ecart_t', r.ecart_t, 'ecart_pct', r.ecart_pct, 'detail', r.detail, 'passe_id', r.passe_id),
         r.ticket, 'verifie', NULL, rc.statut = 'annule', 'rapprochements_pesee'
    FROM public.rapprochements_pesee r
    JOIN public.releves_cbg rc ON rc.id = r.releve_id
   WHERE r.trip_id IS NOT NULL
  UNION ALL
  -- Anomalie de pesee ouverte par le rapprochement
  SELECT 'anomalie_pesee:' || a.id, av.trip_id, 'anomalie_pesee', 'Anomalie ' || a.categorie || ' (' || a.gravite || ')',
         a.cree_le, a.cree_le, 'systeme', NULL,
         jsonb_build_object('categorie', a.categorie, 'gravite', a.gravite, 'statut', a.statut, 'decision', a.decision,
                            'description', a.description, 'valeurs', a.valeurs),
         a.preuve_ref, CASE WHEN a.statut = 'cloturee' THEN 'valide' ELSE 'declare' END,
         NULL, false, 'anomalies_pesee'
    FROM anomalies_voyage av
    JOIN public.anomalies_pesee a ON a.id = av.anomalie_id
  UNION ALL
  -- Traitement d'une anomalie (journal) : cite l'anomalie
  SELECT 'journal_anomalie:' || j.id, av.trip_id, 'traitement_anomalie',
         'Anomalie : ' || j.action || ' (' || coalesce(j.statut_avant, '-') || ' -> ' || j.statut_apres || ')',
         j.le, j.le, 'agent_kogon', j.auteur,
         jsonb_build_object('commentaire', j.commentaire, 'ancienne_valeur', j.ancienne_valeur, 'nouvelle_valeur', j.nouvelle_valeur),
         j.preuve_ref, 'valide', 'anomalie_pesee:' || j.anomalie_id, false, 'journal_anomalies_pesee'
    FROM public.journal_anomalies_pesee j
    JOIN anomalies_voyage av ON av.anomalie_id = j.anomalie_id
  UNION ALL
  -- Pieces justificatives du voyage et de son ticket (D-083) ; l'annulation garde la piece
  SELECT 'piece:' || p.id, coalesce(t.trip_id, p.objet_id), 'piece_jointe',
         'Piece ' || p.nom, p.depose_le, p.depose_le, 'agent_kogon', p.depose_par,
         jsonb_build_object('piece_id', p.id, 'objet_type', p.objet_type, 'nom', p.nom, 'type_mime', p.type_mime,
                            'taille', p.taille, 'sha256', p.sha256, 'statut', p.statut,
                            'annule_le', p.annule_le, 'motif_annulation', p.motif_annulation),
         p.nom, 'declare', NULL, p.annule_le IS NOT NULL, 'pieces_jointes'
    FROM public.pieces_jointes p
    LEFT JOIN public.tickets_pesee_cbg t ON p.objet_type = 'ticket_pesee_cbg' AND t.id = p.objet_id
   WHERE p.objet_type = 'voyage' OR (p.objet_type = 'ticket_pesee_cbg' AND t.id IS NOT NULL)
  UNION ALL
  -- Verifications (nouvelle table) : citent l'evenement verifie
  SELECT 'verification:' || v.id, v.trip_id, 'verification', 'Evenement ' || v.statut,
         v.cree_le, v.cree_le, 'agent_kogon', v.auteur,
         jsonb_build_object('statut', v.statut, 'motif', v.motif,
                            'precedente', CASE WHEN v.precedente_id IS NOT NULL THEN 'verification:' || v.precedente_id END),
         NULL, v.statut, v.evenement_id, false, 'verifications_evenements_voyage'
    FROM public.verifications_evenements_voyage v
)
SELECT u.id, u.trip_id, t.reference AS voyage_reference, t.shift_sequence AS rotation, u.type, u.libelle,
       u.date_operation, u.date_saisie, u.source, u.auteur, u.donnees, u.justificatif,
       coalesce(der.statut, u.statut_base) AS statut,
       der.id AS verification_id,
       u.corrige_ref, u.annule, u.table_source
  FROM u
  JOIN public.trips t ON t.id = u.trip_id
  LEFT JOIN LATERAL (
    SELECT v.id, v.statut FROM public.verifications_evenements_voyage v
     WHERE u.type <> 'verification' AND v.evenement_id = u.id
     ORDER BY v.rang DESC LIMIT 1
  ) der ON true;

COMMENT ON VIEW public.v_journal_voyage IS
  'Journal unifie du voyage (D-088) : assemble sans recopie les evenements des tables sources ; droits et perimetre du lecteur (security_invoker).';
REVOKE ALL ON public.v_journal_voyage FROM PUBLIC, anon;
GRANT SELECT ON public.v_journal_voyage TO authenticated, service_role;

-- ===================================================================
-- 3. Verifier, valider ou contester un evenement declare
-- ===================================================================
CREATE OR REPLACE FUNCTION public.verifier_evenement_voyage(
  p_trip_id uuid, p_evenement_id text, p_statut text, p_motif text DEFAULT NULL, p_precedente_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_evt record;
  v_der public.verifications_evenements_voyage;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_module_write('trips') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les voyages requis' USING ERRCODE = '42501';
  END IF;
  IF NOT public.voyage_permis(p_trip_id) THEN
    RAISE EXCEPTION 'Evenement introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_statut IS NULL OR p_statut NOT IN ('verifie', 'valide', 'conteste') THEN
    RAISE EXCEPTION 'Statut attendu : verifie, valide ou conteste' USING ERRCODE = '22023';
  END IF;
  IF p_statut = 'conteste' AND char_length(coalesce(v_motif, '')) < 5 THEN
    RAISE EXCEPTION 'Motif requis (5 caracteres au moins) pour contester' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('verification_evenement:' || coalesce(p_evenement_id, '')));
  SELECT j.id, j.type, j.auteur, j.annule INTO v_evt
    FROM public.v_journal_voyage j WHERE j.id = p_evenement_id AND j.trip_id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evenement introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_evt.type = 'verification' THEN
    RAISE EXCEPTION 'Une verification ne se verifie pas : verifier l''evenement d''origine' USING ERRCODE = '22023';
  END IF;
  IF v_evt.annule THEN
    RAISE EXCEPTION 'Evenement annule : verification impossible' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_der FROM public.verifications_evenements_voyage
   WHERE evenement_id = p_evenement_id ORDER BY rang DESC LIMIT 1;
  IF v_der.id IS DISTINCT FROM p_precedente_id THEN
    RAISE EXCEPTION 'Verification modifiee entre-temps : recharger l''evenement' USING ERRCODE = '40001';
  END IF;
  -- Saisie distincte de la verification et de la validation.
  IF p_statut IN ('verifie', 'valide') AND v_evt.auteur = auth.uid() THEN
    RAISE EXCEPTION 'separation_violee : l''auteur d''une saisie ne la verifie pas' USING ERRCODE = '42501';
  END IF;
  IF p_statut = 'valide' THEN
    IF v_der.id IS NULL OR v_der.statut <> 'verifie' THEN
      RAISE EXCEPTION 'Validation possible seulement apres une verification' USING ERRCODE = '22023';
    END IF;
    IF v_der.auteur = auth.uid() THEN
      RAISE EXCEPTION 'separation_violee : le verificateur ne valide pas' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF v_der.id IS NOT NULL AND v_der.statut = p_statut THEN
    RAISE EXCEPTION 'Evenement deja %', p_statut USING ERRCODE = '23505';
  END IF;
  -- Revenir sur une verification (correction) exige un motif.
  IF v_der.id IS NOT NULL AND p_statut <> 'valide' AND char_length(coalesce(v_motif, '')) < 5 THEN
    RAISE EXCEPTION 'Motif requis (5 caracteres au moins) pour revenir sur une verification' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.verifications_evenements_voyage (trip_id, evenement_id, statut, motif, precedente_id, auteur)
  VALUES (p_trip_id, p_evenement_id, p_statut, v_motif, v_der.id, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.verifier_evenement_voyage(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verifier_evenement_voyage(uuid, text, text, text, uuid) TO authenticated, service_role;

-- ===================================================================
-- 4. Controles du voyage (constats, aucune ecriture)
-- ===================================================================
CREATE OR REPLACE FUNCTION public.controles_voyage(p_trip_id uuid)
RETURNS TABLE (ordre integer, code text, libelle text, resultat text, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t public.trips;
  v_engage boolean;
  v_livre boolean;
  v_dec public.decisions_dispatch;
  v_drv public.drivers;
  v_manque text;
  v_n integer;
  v_fiches integer;
  v_ticket public.tickets_pesee_cbg;
  v_txt text;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_module_view('trips') OR public.is_admin())
     OR NOT public.voyage_permis(p_trip_id) THEN
    RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = p_trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voyage introuvable' USING ERRCODE = 'P0002'; END IF;
  v_engage := coalesce(t.etat, 'DRAFT') NOT IN ('DRAFT', 'PLANNED', 'CANCELLED');
  v_livre := coalesce(t.etat, '') IN ('WEIGHED_IN', 'DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED');

  -- 1. Affectation valide
  ordre := 1; code := 'affectation_valide'; libelle := 'Affectation valide';
  SELECT * INTO v_dec FROM public.decisions_dispatch d
   WHERE d.trip_id = t.id AND d.decision <> 'refusee'
   ORDER BY d.decide_le DESC, CASE d.nature WHEN 'affectation' THEN 0 ELSE 1 END DESC, d.id::text DESC LIMIT 1;
  IF NOT v_engage THEN
    resultat := 'non_applicable'; detail := 'Voyage non engage (etat ' || coalesce(t.etat, 'inconnu') || ')';
  ELSIF t.vehicle_id IS NULL OR t.driver_id IS NULL THEN
    resultat := 'alerte'; detail := 'Camion ou chauffeur manquant sur un voyage engage';
  ELSIF v_dec.id IS NULL THEN
    resultat := 'alerte'; detail := 'Aucune decision Dispatch tracee pour l''affectation courante';
  ELSIF v_dec.vehicle_id IS DISTINCT FROM t.vehicle_id OR v_dec.driver_id IS DISTINCT FROM t.driver_id THEN
    resultat := 'alerte'; detail := 'Camion ou chauffeur courant different de la derniere decision Dispatch';
  ELSIF EXISTS (SELECT 1 FROM public.immobilisations i WHERE i.vehicle_id = t.vehicle_id AND i.statut = 'ouverte')
        AND t.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'CANCELLED', 'REJECTED') THEN
    resultat := 'alerte'; detail := 'Camion sous immobilisation ouverte';
  ELSE
    resultat := 'conforme'; detail := 'Affectation conforme a la decision du ' || to_char(v_dec.decide_le, 'YYYY-MM-DD HH24:MI');
  END IF;
  RETURN NEXT;

  -- 2. Chauffeur habilite a la date du voyage
  ordre := 2; code := 'chauffeur_habilite'; libelle := 'Chauffeur habilite';
  IF t.driver_id IS NULL THEN
    resultat := CASE WHEN v_engage THEN 'alerte' ELSE 'non_applicable' END; detail := 'Aucun chauffeur affecte';
  ELSE
    SELECT * INTO v_drv FROM public.drivers WHERE id = t.driver_id;
    v_manque := public.habilitations_manquantes(t.driver_id, t.planned_date);
    IF v_drv.license_expiry IS NOT NULL AND v_drv.license_expiry < t.planned_date THEN
      resultat := 'alerte'; detail := 'Permis expire le ' || v_drv.license_expiry;
    ELSIF v_manque IS NOT NULL THEN
      resultat := 'alerte'; detail := 'Habilitations manquantes : ' || v_manque;
    ELSIF v_drv.license_expiry IS NULL THEN
      resultat := 'sans_donnees'; detail := 'Date d''expiration du permis non renseignee';
    ELSE
      resultat := 'conforme'; detail := 'Permis et habilitations requises valides le ' || t.planned_date;
    END IF;
  END IF;
  RETURN NEXT;

  -- 3. Etapes coherentes (journal du cycle)
  ordre := 3; code := 'etapes_coherentes'; libelle := 'Etapes coherentes';
  SELECT count(*) INTO v_n FROM public.trip_events WHERE trip_id = t.id;
  IF v_n = 0 THEN
    resultat := 'sans_donnees'; detail := 'Aucun evenement de cycle enregistre';
  ELSE
    -- Le serveur impose des heures croissantes a l'ecriture (avancer_voyage) ;
    -- plusieurs evenements peuvent partager la meme heure (fiche saisie au
    -- retour) : chaque etat de depart doit etre l'etat d'arrivee d'un
    -- evenement anterieur ou simultane, et aucune heure d'operation n'est
    -- posterieure a sa saisie de plus de 5 minutes.
    SELECT count(*) INTO v_n FROM public.trip_events e
     WHERE e.trip_id = t.id
       AND ((e.etat_avant IS NOT NULL AND e.etat_avant NOT IN ('DRAFT', 'PLANNED')
             AND NOT EXISTS (SELECT 1 FROM public.trip_events p
                              WHERE p.trip_id = t.id AND p.id <> e.id AND p.etat_apres = e.etat_avant
                                AND p.survenu_le <= e.survenu_le))
         OR e.survenu_le > e.enregistre_le + interval '5 minutes');
    SELECT e.etat_apres INTO v_txt FROM public.trip_events e
     WHERE e.trip_id = t.id AND e.etat_apres = t.etat
       AND e.survenu_le = (SELECT max(m.survenu_le) FROM public.trip_events m WHERE m.trip_id = t.id)
     LIMIT 1;
    IF v_n > 0 THEN
      resultat := 'alerte'; detail := v_n || ' enchainement(s) d''etats ou d''heures incoherent(s)';
    ELSIF v_txt IS NULL THEN
      resultat := 'alerte'; detail := 'Etat du voyage (' || coalesce(t.etat, '-') || ') absent du dernier evenement du journal';
    ELSE
      resultat := 'conforme'; detail := 'Chaque etat suit un etat enregistre, heures coherentes';
    END IF;
  END IF;
  RETURN NEXT;

  -- 4. Kilometrage coherent (voyage et fiches FR)
  ordre := 4; code := 'km_coherents'; libelle := 'Kilometrage coherent';
  SELECT count(*) INTO v_n FROM public.fiches_rotations_lignes l JOIN public.fiches_terrain f ON f.id = l.fiche_id
   WHERE l.trip_id = t.id AND f.etat <> 'annulee'
     AND ((l.km_depart IS NOT NULL AND t.km_start IS NOT NULL AND l.km_depart <> t.km_start)
       OR (l.km_arrivee IS NOT NULL AND t.km_end IS NOT NULL AND l.km_arrivee <> t.km_end));
  IF t.km_start IS NOT NULL AND t.km_end IS NOT NULL AND t.km_end < t.km_start THEN
    resultat := 'alerte'; detail := 'Compteur d''arrivee (' || t.km_end || ') inferieur au depart (' || t.km_start || ')';
  ELSIF v_n > 0 THEN
    resultat := 'alerte'; detail := 'Kilometrage de la fiche FR different de celui du voyage';
  ELSIF t.km_start IS NULL OR t.km_end IS NULL THEN
    resultat := CASE WHEN v_livre THEN 'sans_donnees' ELSE 'non_applicable' END; detail := 'Compteurs de depart ou d''arrivee non renseignes';
  ELSE
    resultat := 'conforme'; detail := (t.km_end - t.km_start) || ' km parcourus'
      || coalesce(' (distance estimee ' || t.estimated_distance_km || ' km)', '');
  END IF;
  RETURN NEXT;

  -- 5. Fiche terrain presente
  ordre := 5; code := 'fiche_presente'; libelle := 'Fiche terrain presente';
  SELECT count(DISTINCT x.fiche_id) INTO v_fiches FROM (
    SELECT l.fiche_id FROM public.fiches_rotations_lignes l WHERE l.trip_id = t.id
    UNION SELECT f.id FROM public.fiches_terrain f WHERE f.trip_id = t.id
    UNION SELECT tk.fiche_id FROM public.tickets_pesee_cbg tk WHERE tk.trip_id = t.id AND tk.fiche_id IS NOT NULL) x
    JOIN public.fiches_terrain f ON f.id = x.fiche_id AND f.etat <> 'annulee';
  IF v_fiches > 0 THEN
    resultat := 'conforme'; detail := v_fiches || ' fiche(s) reliee(s)';
  ELSIF v_livre THEN
    resultat := 'alerte'; detail := 'Aucune fiche terrain reliee : absence a justifier';
  ELSE
    resultat := 'non_applicable'; detail := 'Voyage non livre';
  END IF;
  RETURN NEXT;

  -- 6. Ticket CBG associe
  ordre := 6; code := 'ticket_associe'; libelle := 'Ticket CBG associe';
  SELECT * INTO v_ticket FROM public.tickets_pesee_cbg WHERE trip_id = t.id;
  IF v_ticket.id IS NOT NULL THEN
    resultat := 'conforme';
    detail := 'Ticket ' || v_ticket.ticket || CASE WHEN EXISTS (
      SELECT 1 FROM public.rapprochements_pesee r JOIN public.releves_cbg rc ON rc.id = r.releve_id AND rc.statut <> 'annule'
       WHERE r.trip_id = t.id AND r.ligne_id IS NOT NULL) THEN ', rapproche au releve officiel CBG' ELSE ', non encore rapproche au releve officiel CBG' END;
  ELSIF v_livre THEN
    resultat := 'alerte'; detail := 'Voyage livre sans ticket CBG';
  ELSE
    resultat := 'non_applicable'; detail := 'Voyage non pese';
  END IF;
  RETURN NEXT;

  -- 7. Pas de double comptage
  ordre := 7; code := 'double_comptage'; libelle := 'Pas de double comptage';
  v_txt := NULL;
  IF v_ticket.id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.tickets_pesee_cbg o
        WHERE o.trip_id <> t.id AND upper(btrim(o.ticket)) = upper(btrim(v_ticket.ticket))) THEN
    v_txt := 'Numero de ticket ' || v_ticket.ticket || ' deja porte par un autre voyage';
  END IF;
  SELECT count(DISTINCT l.fiche_id) INTO v_n FROM public.fiches_rotations_lignes l
    JOIN public.fiches_terrain f ON f.id = l.fiche_id AND f.etat <> 'annulee' WHERE l.trip_id = t.id;
  IF v_txt IS NULL AND v_n > 1 THEN
    v_txt := 'Voyage declare sur ' || v_n || ' fiches FR';
  END IF;
  SELECT count(DISTINCT r.ligne_id) INTO v_n FROM public.rapprochements_pesee r
    JOIN public.releves_cbg rc ON rc.id = r.releve_id AND rc.statut <> 'annule'
   WHERE r.trip_id = t.id AND r.ligne_id IS NOT NULL;
  IF v_txt IS NULL AND v_n > 1 THEN
    v_txt := 'Voyage rapproche de ' || v_n || ' lignes de releves CBG';
  END IF;
  IF v_txt IS NOT NULL THEN
    resultat := 'alerte'; detail := v_txt;
  ELSE
    resultat := 'conforme'; detail := 'Ticket, fiche et ligne de releve uniques';
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.controles_voyage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.controles_voyage(uuid) TO authenticated, service_role;

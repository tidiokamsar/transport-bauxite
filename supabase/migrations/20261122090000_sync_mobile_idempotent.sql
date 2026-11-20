/*
  # Synchronisation mobile idempotente (D-102, tranche T1)

  L'application mobile (a venir, LOT 13) envoie des lots de saisies
  collectees hors ligne. Reprise des regles D-100 cote serveur :

  1. `sync_mobile_operations` : une ligne par operation recue, cle
     `client_id` (identifiant unique genere par le mobile). Append-only
     par fonction ; lecture limitee a son auteur (et l'administrateur).
     Le statut de synchronisation est independant du statut metier.
  2. `synchroniser_saisies_mobile(lot)` : seule porte d'entree.
     - liste blanche stricte des fonctions de saisie du cycle des fiches
       (D-089) : saisir_ligne_rotation, saisir_pointage_fiche,
       saisir_ligne_carburant. Aucune table, aucune suppression ;
     - idempotence : un client_id deja recu renvoie le resultat archive
       (« rejouee ») sans reexecuter l'operation ; un refus metier
       (droit, conflit, doublon : codes 42501/22023/23505/23503/40001)
       passe « a_arbitrer » et n'est pas rejugé au rejoue — le mobile
       corrige et envoie un NOUVEAU client_id ;
     - chaque operation est isolee : l'echec de l'une n'arrete pas le
       lot, et son resultat (code, message) est renvoye tel quel ;
     - les droits de module, le perimetre site et le cycle de la fiche
       restent verifies par les fonctions appelees, pas par le mobile.

  Idempotent : IF NOT EXISTS, CREATE OR REPLACE.
*/

CREATE TABLE IF NOT EXISTS public.sync_mobile_operations (
  client_id text PRIMARY KEY,
  fonction text NOT NULL,
  fiche_id uuid,
  auteur uuid NOT NULL REFERENCES auth.users(id),
  recu_le timestamptz NOT NULL DEFAULT now(),
  statut text NOT NULL CHECK (statut IN ('ok', 'erreur', 'a_arbitrer')),
  resultat jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_mobile_auteur ON public.sync_mobile_operations (auteur, recu_le DESC);

ALTER TABLE public.sync_mobile_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sync_mobile_operations FROM anon;
GRANT SELECT ON public.sync_mobile_operations TO authenticated;
GRANT ALL ON public.sync_mobile_operations TO service_role;
DROP POLICY IF EXISTS lecture_auteur ON public.sync_mobile_operations;
CREATE POLICY lecture_auteur ON public.sync_mobile_operations
  FOR SELECT TO authenticated
  USING (auteur = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.synchroniser_saisies_mobile(p_operations jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  op jsonb;
  v_client text;
  v_fonction text;
  v_fiche uuid;
  v_params jsonb;
  v_statut text;
  v_res jsonb;
  v_archive jsonb;
  v_sorties jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr
                  WHERE pr.id = auth.uid() AND pr.status = 'active') THEN
    RAISE EXCEPTION 'Compte actif requis' USING ERRCODE = '42501';
  END IF;

  FOR op IN SELECT * FROM jsonb_array_elements(coalesce(p_operations, '[]'::jsonb)) LOOP
    v_client := nullif(btrim(coalesce(op ->> 'client_id', '')), '');
    v_fonction := op ->> 'fonction';
    v_fiche := (op ->> 'fiche_id')::uuid;
    v_params := coalesce(op -> 'params', '{}'::jsonb);

    IF v_client IS NULL OR v_fonction IS NULL THEN
      v_sorties := v_sorties || jsonb_build_object(
        'client_id', op ->> 'client_id', 'statut', 'erreur',
        'resultat', jsonb_build_object('message', 'client_id et fonction requis'));
      CONTINUE;
    END IF;

    -- Idempotence : le resultat archive fait foi, rien n'est reexecute.
    SELECT jsonb_build_object('statut', s.statut, 'resultat', s.resultat)
      INTO v_archive
      FROM public.sync_mobile_operations s
     WHERE s.client_id = v_client AND s.auteur = auth.uid();
    IF v_archive IS NOT NULL THEN
      v_sorties := v_sorties || jsonb_build_object(
        'client_id', v_client, 'statut', 'rejouee',
        'resultat', v_archive -> 'resultat');
      CONTINUE;
    END IF;

    v_statut := 'ok';
    BEGIN
      CASE v_fonction
        WHEN 'saisir_ligne_rotation' THEN
          v_res := jsonb_build_object('id', public.saisir_ligne_rotation(
            v_fiche,
            (v_params ->> 'rang')::integer,
            v_params -> 'ligne',
            nullif(btrim(coalesce(v_params ->> 'motif_correction', '')), '')));
        WHEN 'saisir_pointage_fiche' THEN
          v_res := jsonb_build_object('id', public.saisir_pointage_fiche(
            v_fiche,
            (v_params ->> 'vehicle_id')::uuid,
            (v_params ->> 'index_debut')::numeric,
            (v_params ->> 'index_fin')::numeric,
            (v_params ->> 'heures_productives')::numeric,
            (v_params ->> 'periode_debut')::timestamptz,
            (v_params ->> 'periode_fin')::timestamptz,
            coalesce(v_params -> 'arrets', '[]'::jsonb),
            nullif(btrim(coalesce(v_params ->> 'operateur', '')), ''),
            nullif(btrim(coalesce(v_params ->> 'agent', '')), ''),
            nullif(btrim(coalesce(v_params ->> 'observations', '')), ''),
            nullif(btrim(coalesce(v_params ->> 'motif_correction', '')), '')));
        WHEN 'saisir_ligne_carburant' THEN
          v_res := jsonb_build_object('id', public.saisir_ligne_carburant(
            v_fiche,
            (v_params ->> 'rang')::integer,
            v_params -> 'ligne',
            nullif(btrim(coalesce(v_params ->> 'motif_correction', '')), '')));
        ELSE
          v_statut := 'erreur';
          v_res := jsonb_build_object('message', 'fonction inconnue ou interdite');
      END CASE;
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE IN ('42501', '22023', '23505', '23503', '40001') THEN
        v_statut := 'a_arbitrer';
      ELSE
        v_statut := 'erreur';
      END IF;
      v_res := jsonb_build_object('code', SQLSTATE, 'message', SQLERRM);
    END;

    INSERT INTO public.sync_mobile_operations (client_id, fonction, fiche_id, auteur, statut, resultat)
    VALUES (v_client, v_fonction, v_fiche, auth.uid(), v_statut, v_res);

    v_sorties := v_sorties || jsonb_build_object(
      'client_id', v_client, 'statut', v_statut, 'resultat', v_res);
  END LOOP;

  RETURN v_sorties;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.synchroniser_saisies_mobile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.synchroniser_saisies_mobile(jsonb) TO authenticated, service_role;

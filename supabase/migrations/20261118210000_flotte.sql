/*
  # Flotte : registre, propriete, statut operationnel, documents, fiche
  # consolidee et saisie d'un plein isole (D-062, lot 08, module 08)

  1. Registre des vehicules : attribut de propriete (kogon, loue,
     sous_traitant), proprietaire ou loueur, exploitant, transporteur,
     contrat de location rattache (contrats D-026). Aucune valeur par
     defaut : un engin existant reste « non renseigne » (NULL) tant qu'un
     utilisateur ne le saisit pas. Ecriture par `definir_propriete_vehicule`
     seulement, journalisee (avant, apres, motif si l'attribut existait).
  2. Statut administratif saisi : suspension (motif), remise en service
     (motif), reforme definitive (motif), par fonctions serveur et journal
     append-only `journal_flotte`. L'enum `vehicle_status` n'est pas modifie :
     il reste le cache de disponibilite technique lu par la planification
     et le dispatch (D-025), et vaut 'active' seulement si l'engin est
     disponible. Un engin suspendu n'est donc jamais 'active' (declencheur),
     un engin reforme passe 'sold' (sorti de la flotte).
  3. Statut operationnel derive (`v_vehicules`) : reforme, suspendu,
     immobilise, en_maintenance, en_mission (voyage engage), disponible.
  4. `v_documents_vehicule_a_renouveler` : documents du vehicule et dates du
     registre (assurance, visite technique) expires ou expirant sous
     30 jours ; un document remplace par un plus recent n'alerte plus.
     Pas de fichier joint : le stockage n'est pas disponible.
  5. `v_fiche_vehicule` : fiche consolidee en lecture (immobilisations,
     interventions Neemba, pneus montes, pleins, dernier controle avant
     depart, documents a renouveler, cout carburant seulement si le prix
     du plein est connu). Un bloc hors des droits de l'appelant vaut NULL
     (non visible), jamais 0.
  6. `saisir_plein` : plein isole par fonction serveur (droit fuel,
     perimetre de l'engin, cuve optionnelle comme `saisir_carburant`,
     reference attribuee par le serveur). L'insertion et la modification
     directes de `fuel_transactions` sont retirees au navigateur.

  Les valeurs par defaut fictives de Bolt (`purchase_cost`, `current_value`
  a 0, cout d'un document a 0) sont retirees. Idempotent.
*/

-- 1. Attributs du registre
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS propriete text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS proprietaire text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS exploitant text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS transporteur text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS contrat_id uuid REFERENCES public.contrats(id);
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS statut_admin text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS statut_admin_depuis timestamptz;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS statut_admin_motif text;
CREATE INDEX IF NOT EXISTS idx_vehicles_contrat ON public.vehicles(contrat_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_propriete_check') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_propriete_check
      CHECK (propriete IS NULL OR propriete IN ('kogon', 'loue', 'sous_traitant'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_statut_admin_check') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_statut_admin_check
      CHECK (statut_admin IS NULL OR statut_admin IN ('suspendu', 'reforme'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_statut_admin_coherent') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_statut_admin_coherent
      CHECK ((statut_admin IS NULL) = (statut_admin_depuis IS NULL) AND (statut_admin IS NULL) = (statut_admin_motif IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_contrat_propriete') THEN
    ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_contrat_propriete
      CHECK (contrat_id IS NULL OR propriete IN ('loue', 'sous_traitant'));
  END IF;
END $$;

ALTER TABLE public.vehicles ALTER COLUMN purchase_cost DROP DEFAULT;
ALTER TABLE public.vehicles ALTER COLUMN current_value DROP DEFAULT;
ALTER TABLE public.vehicle_documents ALTER COLUMN cost DROP DEFAULT;

-- 2. Ecriture directe limitee aux champs descriptifs. Le statut technique
-- suit les immobilisations (D-025) et les fonctions de ce lot ; la
-- propriete et le statut administratif passent par fonctions serveur.
-- current_km n'est pas une mesure (D-043) : il ne se saisit plus.
REVOKE INSERT, UPDATE ON public.vehicles FROM anon, authenticated;
GRANT INSERT (id, registration, brand_model, year, capacity_tonnes, vehicle_type, chassis_number, site_id,
              insurance_expiry, technical_inspection_expiry)
  ON public.vehicles TO authenticated;
GRANT UPDATE (registration, brand_model, year, capacity_tonnes, vehicle_type, chassis_number, site_id,
              insurance_expiry, technical_inspection_expiry, updated_at)
  ON public.vehicles TO authenticated;

-- 3. Journal de la flotte (append-only)
CREATE TABLE IF NOT EXISTS public.journal_flotte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('propriete', 'suspension', 'remise_en_service', 'reforme')),
  avant jsonb,
  apres jsonb NOT NULL,
  motif text,
  auteur uuid REFERENCES auth.users(id),
  le timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_journal_flotte ON public.journal_flotte(vehicle_id, le DESC);

ALTER TABLE public.journal_flotte ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.journal_flotte FROM anon, authenticated;
GRANT SELECT ON public.journal_flotte TO authenticated;
GRANT ALL ON public.journal_flotte TO service_role;
DROP POLICY IF EXISTS lecture ON public.journal_flotte;
CREATE POLICY lecture ON public.journal_flotte FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id));

CREATE OR REPLACE FUNCTION public.garde_journal_flotte()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Le journal de la flotte ne se modifie pas' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS garde_journal_flotte ON public.journal_flotte;
CREATE TRIGGER garde_journal_flotte BEFORE UPDATE OR DELETE ON public.journal_flotte
  FOR EACH ROW EXECUTE FUNCTION public.garde_journal_flotte();

-- 4. Cache de disponibilite : un engin suspendu n'est jamais 'active', un
-- engin reforme est 'sold'. La cloture d'une immobilisation (D-025) qui
-- remet 'active' laisse donc l'engin suspendu indisponible.
CREATE OR REPLACE FUNCTION public.synchroniser_statut_vehicule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.statut_admin = 'reforme' THEN
    NEW.status := 'sold';
  ELSIF NEW.statut_admin = 'suspendu' AND NEW.status::text = 'active' THEN
    NEW.status := 'immobilized';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS synchroniser_statut_vehicule ON public.vehicles;
CREATE TRIGGER synchroniser_statut_vehicule BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.synchroniser_statut_vehicule();

-- 5. Fonctions d'appui
CREATE OR REPLACE FUNCTION public.vehicule_ecrivable(p_vehicle uuid)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v public.vehicles;
BEGIN
  IF NOT (public.has_module_write('vehicles') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur la flotte requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.vehicles WHERE id = p_vehicle FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Engin introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.site_permis(v.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  RETURN v;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.vehicule_ecrivable(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.flotte_attributs(v public.vehicles)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object('propriete', v.propriete, 'proprietaire', v.proprietaire, 'exploitant', v.exploitant,
    'transporteur', v.transporteur, 'contrat_id', v.contrat_id, 'statut_admin', v.statut_admin,
    'statut_admin_motif', v.statut_admin_motif, 'status', v.status);
$$;
REVOKE EXECUTE ON FUNCTION public.flotte_attributs(public.vehicles) FROM PUBLIC, anon, authenticated;

-- Voyage engage (du depart au chargement jusqu'a la pesee d'arrivee) de
-- l'engin, NULL si aucun ou hors perimetre de l'appelant.
CREATE OR REPLACE FUNCTION public.voyage_en_cours_vehicule(p_vehicle uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.reference FROM public.trips t
   WHERE t.vehicle_id = p_vehicle AND public.vehicule_permis(p_vehicle)
     AND t.etat IN ('AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN')
   ORDER BY t.planned_date DESC, t.reference DESC
   LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.voyage_en_cours_vehicule(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.voyage_en_cours_vehicule(uuid) TO authenticated;

-- Reference du contrat rattache, lisible par qui voit la flotte ou les
-- contrats (le dossier contractuel reste reserve au module contrats).
CREATE OR REPLACE FUNCTION public.reference_contrat_flotte(p_contrat uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.reference || ' · ' || c.contrepartie FROM public.contrats c
   WHERE c.id = p_contrat
     AND (public.has_module_view('vehicles') OR public.has_module_view('contracts') OR public.is_admin());
$$;
REVOKE EXECUTE ON FUNCTION public.reference_contrat_flotte(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reference_contrat_flotte(uuid) TO authenticated;

-- Contrats rattachables a un engin (location ou autre, hors contrats
-- clients) pour l'ecran de la flotte.
CREATE OR REPLACE FUNCTION public.contrats_rattachables_flotte()
RETURNS TABLE (id uuid, reference text, intitule text, nature text, contrepartie text, statut text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c.reference, c.intitule, c.nature, c.contrepartie, c.statut FROM public.contrats c
   WHERE c.nature IN ('location', 'autre')
     AND (public.has_module_write('vehicles') OR public.has_module_view('contracts') OR public.is_admin())
   ORDER BY c.reference;
$$;
REVOKE EXECUTE ON FUNCTION public.contrats_rattachables_flotte() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contrats_rattachables_flotte() TO authenticated;

-- 6. Propriete, proprietaire, exploitant, transporteur, contrat
CREATE OR REPLACE FUNCTION public.definir_propriete_vehicule(
  p_vehicle uuid, p_propriete text, p_proprietaire text, p_exploitant text, p_transporteur text,
  p_contrat uuid, p_motif text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v public.vehicles := public.vehicule_ecrivable(p_vehicle); w public.vehicles;
        v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_nature text;
BEGIN
  IF p_propriete IS NULL OR p_propriete NOT IN ('kogon', 'loue', 'sous_traitant') THEN
    RAISE EXCEPTION 'Propriete requise : kogon, loue ou sous_traitant' USING ERRCODE = '22023';
  END IF;
  IF p_contrat IS NOT NULL THEN
    IF p_propriete = 'kogon' THEN
      RAISE EXCEPTION 'Un engin propriete de Kogon n''a pas de contrat de location' USING ERRCODE = '22023';
    END IF;
    SELECT c.nature INTO v_nature FROM public.contrats c WHERE c.id = p_contrat;
    IF NOT FOUND OR v_nature NOT IN ('location', 'autre') THEN
      RAISE EXCEPTION 'Contrat introuvable ou contrat client : rattacher un contrat de location' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v.propriete IS NOT NULL AND v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour modifier une propriete deja renseignee' USING ERRCODE = '22023';
  END IF;
  UPDATE public.vehicles
     SET propriete = p_propriete,
         proprietaire = nullif(btrim(coalesce(p_proprietaire, '')), ''),
         exploitant = nullif(btrim(coalesce(p_exploitant, '')), ''),
         transporteur = nullif(btrim(coalesce(p_transporteur, '')), ''),
         contrat_id = p_contrat, updated_at = now()
   WHERE id = v.id
  RETURNING * INTO w;
  IF public.flotte_attributs(w) = public.flotte_attributs(v) THEN
    RAISE EXCEPTION 'Aucune modification' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.journal_flotte (vehicle_id, action, avant, apres, motif, auteur)
  VALUES (v.id, 'propriete', public.flotte_attributs(v), public.flotte_attributs(w), v_motif, auth.uid());
END;
$$;

-- 7. Suspension, remise en service, reforme (motif obligatoire)
CREATE OR REPLACE FUNCTION public.suspendre_vehicule(p_vehicle uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v public.vehicles := public.vehicule_ecrivable(p_vehicle); w public.vehicles;
        v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour suspendre un engin' USING ERRCODE = '22023';
  END IF;
  IF v.statut_admin = 'reforme' OR v.status::text = 'sold' THEN
    RAISE EXCEPTION 'Engin reforme ou sorti de la flotte' USING ERRCODE = '22023';
  END IF;
  IF v.statut_admin = 'suspendu' THEN
    RAISE EXCEPTION 'Engin deja suspendu' USING ERRCODE = '22023';
  END IF;
  UPDATE public.vehicles
     SET statut_admin = 'suspendu', statut_admin_depuis = now(), statut_admin_motif = v_motif, updated_at = now()
   WHERE id = v.id
  RETURNING * INTO w;
  INSERT INTO public.journal_flotte (vehicle_id, action, avant, apres, motif, auteur)
  VALUES (v.id, 'suspension', public.flotte_attributs(v), public.flotte_attributs(w), v_motif, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.remettre_en_service_vehicule(p_vehicle uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v public.vehicles := public.vehicule_ecrivable(p_vehicle); w public.vehicles;
        v_motif text := nullif(btrim(coalesce(p_motif, '')), ''); v_cause text;
BEGIN
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour remettre un engin en service' USING ERRCODE = '22023';
  END IF;
  IF v.statut_admin IS DISTINCT FROM 'suspendu' THEN
    RAISE EXCEPTION 'Seul un engin suspendu se remet en service' USING ERRCODE = '22023';
  END IF;
  -- Le statut technique redevient celui des immobilisations (D-025).
  SELECT i.cause INTO v_cause FROM public.immobilisations i WHERE i.vehicle_id = v.id AND i.statut = 'ouverte';
  UPDATE public.vehicles
     SET statut_admin = NULL, statut_admin_depuis = NULL, statut_admin_motif = NULL, updated_at = now(),
         status = (CASE WHEN v_cause IS NULL THEN 'active'
                        WHEN v_cause = 'maintenance_planifiee' THEN 'maintenance'
                        ELSE 'immobilized' END)::public.vehicle_status
   WHERE id = v.id
  RETURNING * INTO w;
  INSERT INTO public.journal_flotte (vehicle_id, action, avant, apres, motif, auteur)
  VALUES (v.id, 'remise_en_service', public.flotte_attributs(v), public.flotte_attributs(w), v_motif, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.reformer_vehicule(p_vehicle uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v public.vehicles := public.vehicule_ecrivable(p_vehicle); w public.vehicles;
        v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
BEGIN
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'Motif obligatoire pour reformer un engin' USING ERRCODE = '22023';
  END IF;
  IF v.statut_admin = 'reforme' OR v.status::text = 'sold' THEN
    RAISE EXCEPTION 'Engin deja reforme ou sorti de la flotte' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.immobilisations i WHERE i.vehicle_id = v.id AND i.statut = 'ouverte') THEN
    RAISE EXCEPTION 'Immobilisation ouverte : la cloturer avant la reforme' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trips t WHERE t.vehicle_id = v.id
              AND t.etat NOT IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'CANCELLED', 'DISPUTED', 'REJECTED', 'INTERRUPTED')) THEN
    RAISE EXCEPTION 'Voyage prevu ou engage : le reaffecter ou l''annuler avant la reforme' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tires p WHERE p.vehicle_id = v.id AND p.status = 'active') THEN
    RAISE EXCEPTION 'Pneus montes : les demonter avant la reforme' USING ERRCODE = '22023';
  END IF;
  UPDATE public.vehicles
     SET statut_admin = 'reforme', statut_admin_depuis = now(), statut_admin_motif = v_motif, updated_at = now()
   WHERE id = v.id
  RETURNING * INTO w;
  INSERT INTO public.journal_flotte (vehicle_id, action, avant, apres, motif, auteur)
  VALUES (v.id, 'reforme', public.flotte_attributs(v), public.flotte_attributs(w), v_motif, auth.uid());
END;
$$;

DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'definir_propriete_vehicule(uuid, text, text, text, text, uuid, text)',
    'suspendre_vehicule(uuid, text)',
    'remettre_en_service_vehicule(uuid, text)',
    'reformer_vehicule(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;

-- 8. Registre avec statut operationnel derive (perimetre et droits de
-- l'appelant par la RLS de vehicles).
CREATE OR REPLACE VIEW public.v_vehicules WITH (security_invoker = true) AS
SELECT v.id, v.registration, v.brand_model, v.year, v.vehicle_type, v.capacity_tonnes, v.chassis_number, v.site_id,
       v.status, v.insurance_expiry, v.technical_inspection_expiry,
       v.propriete, v.proprietaire, v.exploitant, v.transporteur, v.contrat_id,
       public.reference_contrat_flotte(v.contrat_id) AS contrat_reference,
       v.statut_admin, v.statut_admin_depuis, v.statut_admin_motif,
       m.reference AS voyage_en_cours,
       CASE WHEN v.statut_admin = 'reforme' OR v.status::text = 'sold' THEN 'reforme'
            WHEN v.statut_admin = 'suspendu' THEN 'suspendu'
            WHEN v.status::text = 'immobilized' THEN 'immobilise'
            WHEN v.status::text = 'maintenance' THEN 'en_maintenance'
            WHEN m.reference IS NOT NULL THEN 'en_mission'
            ELSE 'disponible' END AS statut_operationnel
  FROM public.vehicles v
  LEFT JOIN LATERAL (SELECT public.voyage_en_cours_vehicule(v.id) AS reference) m ON true;
GRANT SELECT ON public.v_vehicules TO authenticated;

-- 9. Documents expires ou expirant sous 30 jours. Pour un meme engin et un
-- meme type (hors « autre »), seul le document a l'echeance la plus
-- lointaine compte ; une date du registre (assurance, visite technique)
-- s'efface devant un document de meme type a echeance egale ou posterieure.
CREATE OR REPLACE VIEW public.v_documents_vehicule_a_renouveler WITH (security_invoker = true) AS
WITH documents AS (
  SELECT 'document:' || d.id::text AS cle, d.id AS document_id, d.vehicle_id, d.document_type AS type,
         d.document_name AS libelle, d.reference_number AS reference, d.expiry_date AS expire_le, 'document'::text AS origine
    FROM public.vehicle_documents d
   WHERE d.status <> 'archived' AND d.expiry_date IS NOT NULL
     AND (d.document_type = 'other' OR NOT EXISTS (
           SELECT 1 FROM public.vehicle_documents n
            WHERE n.vehicle_id = d.vehicle_id AND n.document_type = d.document_type AND n.id <> d.id
              AND n.status <> 'archived'
              AND (n.expiry_date IS NULL OR n.expiry_date > d.expiry_date
                   OR (n.expiry_date = d.expiry_date AND n.id > d.id))))
  UNION ALL
  SELECT 'registre:insurance:' || v.id::text, NULL, v.id, 'insurance', 'Assurance (date du registre)', NULL,
         v.insurance_expiry, 'registre'
    FROM public.vehicles v
   WHERE v.insurance_expiry IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.vehicle_documents n
                      WHERE n.vehicle_id = v.id AND n.document_type = 'insurance' AND n.status <> 'archived'
                        AND (n.expiry_date IS NULL OR n.expiry_date >= v.insurance_expiry))
  UNION ALL
  SELECT 'registre:technical_inspection:' || v.id::text, NULL, v.id, 'technical_inspection',
         'Visite technique (date du registre)', NULL, v.technical_inspection_expiry, 'registre'
    FROM public.vehicles v
   WHERE v.technical_inspection_expiry IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.vehicle_documents n
                      WHERE n.vehicle_id = v.id AND n.document_type = 'technical_inspection' AND n.status <> 'archived'
                        AND (n.expiry_date IS NULL OR n.expiry_date >= v.technical_inspection_expiry))
)
SELECT d.cle, d.document_id, d.vehicle_id, v.registration, d.type, d.libelle, d.reference, d.expire_le,
       (d.expire_le - current_date) AS jours_restants, d.origine
  FROM documents d
  JOIN public.vehicles v ON v.id = d.vehicle_id
 WHERE d.expire_le <= current_date + 30
   AND v.statut_admin IS DISTINCT FROM 'reforme' AND v.status::text <> 'sold';
GRANT SELECT ON public.v_documents_vehicule_a_renouveler TO authenticated;

-- 10. Fiche consolidee (cumul depuis la premiere saisie). Un bloc hors des
-- droits de l'appelant vaut NULL (non visible), jamais 0. Le cout du
-- carburant ne somme que les pleins dont le prix est connu ; les litres
-- sans prix sont donnes a part, rien n'est estime.
CREATE OR REPLACE VIEW public.v_fiche_vehicule WITH (security_invoker = true) AS
SELECT v.id AS vehicle_id,
       CASE WHEN dm.voit THEN im.nombre END AS immobilisations,
       CASE WHEN dm.voit THEN im.heures END AS heures_immobilisation,
       CASE WHEN dm.voit THEN im.ouverte_depuis END AS immobilisation_ouverte_depuis,
       CASE WHEN dm.voit_interventions THEN it.nombre END AS interventions_loueur,
       CASE WHEN dm.voit_interventions THEN it.actives END AS interventions_actives,
       pn.montes AS pneus_montes,
       CASE WHEN dm.voit_carburant THEN pl.nombre END AS pleins,
       CASE WHEN dm.voit_carburant THEN pl.litres END AS litres,
       CASE WHEN dm.voit_carburant THEN pl.dernier END AS dernier_plein,
       CASE WHEN dm.voit_carburant THEN pl.cout_connu END AS cout_carburant_connu,
       CASE WHEN dm.voit_carburant THEN pl.litres_sans_prix END AS litres_sans_prix,
       cd.effectue_le AS dernier_controle_le,
       cd.resultat AS dernier_controle_resultat,
       dc.nombre AS documents_a_renouveler
  FROM public.vehicles v
  CROSS JOIN LATERAL (SELECT (public.has_module_view('maintenance') OR public.is_admin()) AS voit,
                             (public.has_module_view('maintenance') OR public.has_module_view('contracts') OR public.is_admin()) AS voit_interventions,
                             (public.has_module_view('fuel') OR public.is_admin()) AS voit_carburant) dm
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS nombre,
           round(coalesce(sum(extract(epoch FROM coalesce(i.fin, now()) - i.debut) / 3600), 0)::numeric, 1) AS heures,
           max(i.debut) FILTER (WHERE i.statut = 'ouverte') AS ouverte_depuis
      FROM public.immobilisations i WHERE i.vehicle_id = v.id AND i.statut <> 'annulee') im
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS nombre, count(*) FILTER (WHERE l.statut <> 'remise_validee')::integer AS actives
      FROM public.interventions_loueur l WHERE l.vehicle_id = v.id) it
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS montes FROM public.tires p WHERE p.vehicle_id = v.id AND p.status = 'active') pn
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS nombre, round(coalesce(sum(f.volume_liters), 0), 2) AS litres,
           max(f.transaction_date) AS dernier,
           round(sum(f.total_cost) FILTER (WHERE f.unit_price IS NOT NULL AND f.total_cost IS NOT NULL), 2) AS cout_connu,
           round(coalesce(sum(f.volume_liters) FILTER (WHERE f.unit_price IS NULL OR f.total_cost IS NULL), 0), 2) AS litres_sans_prix
      FROM public.fuel_transactions f WHERE f.vehicle_id = v.id AND f.transaction_type = 'refuel') pl
  LEFT JOIN LATERAL (
    SELECT c.effectue_le, c.resultat FROM public.controles_depart c
     WHERE c.vehicle_id = v.id ORDER BY c.effectue_le DESC, c.saisi_le DESC LIMIT 1) cd ON true
  CROSS JOIN LATERAL (
    SELECT count(*)::integer AS nombre FROM public.v_documents_vehicule_a_renouveler a WHERE a.vehicle_id = v.id) dc;
GRANT SELECT ON public.v_fiche_vehicule TO authenticated;

-- 11. Plein isole par fonction serveur (meme regles que la fiche carburant
-- D-028 / D-041 : litres seulement, prix porte par les livraisons CBG,
-- stockage optionnel qui cree une distribution a valider).
CREATE SEQUENCE IF NOT EXISTS public.fuel_pleins_numero_seq;

CREATE OR REPLACE FUNCTION public.saisir_plein(
  p_vehicle uuid, p_date date, p_litres numeric, p_driver uuid DEFAULT NULL, p_compteur numeric DEFAULT NULL,
  p_stockage uuid DEFAULT NULL, p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v public.vehicles; s public.stockages_carburant; v_tx uuid; v_ref text; v_site uuid;
BEGIN
  IF NOT public.has_module_write('fuel') THEN
    RAISE EXCEPTION 'Droit d''ecriture sur le carburant requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_date > current_date THEN
    RAISE EXCEPTION 'Date du plein requise, pas dans le futur' USING ERRCODE = '22023';
  END IF;
  IF p_litres IS NULL OR p_litres <= 0 THEN
    RAISE EXCEPTION 'Quantite en litres positive requise' USING ERRCODE = '22023';
  END IF;
  IF p_compteur IS NOT NULL AND p_compteur < 0 THEN
    RAISE EXCEPTION 'Compteur negatif refuse' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM public.vehicles WHERE id = p_vehicle;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Engin requis pour un plein' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(v.site_id) THEN
    RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501';
  END IF;
  IF v.statut_admin = 'reforme' OR v.status::text = 'sold' THEN
    RAISE EXCEPTION 'Engin reforme ou sorti de la flotte' USING ERRCODE = '22023';
  END IF;
  IF p_driver IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = p_driver) THEN
    RAISE EXCEPTION 'Chauffeur introuvable' USING ERRCODE = '22023';
  END IF;
  v_site := v.site_id;
  IF p_stockage IS NOT NULL THEN
    s := public.stockage_ecrivable(p_stockage);
    IF v.site_id IS NOT NULL AND s.site_id <> v.site_id THEN
      RAISE EXCEPTION 'Stockage % hors du site de l''engin', s.code USING ERRCODE = '22023';
    END IF;
    v_site := s.site_id;
  END IF;
  v_ref := 'PL-' || to_char(p_date, 'YYYYMMDD') || '-' || lpad(nextval('public.fuel_pleins_numero_seq')::text, 5, '0');
  INSERT INTO public.fuel_transactions (transaction_date, vehicle_id, driver_id, volume_liters, quantity, unit_price,
    total_cost, total_amount, transaction_type, supplier, reference, site_id, odometer_reading, notes, created_by)
  VALUES (p_date, v.id, p_driver, p_litres, p_litres, NULL, NULL, NULL, 'refuel', 'CBG', v_ref, v_site, p_compteur,
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Saisie unitaire'), auth.uid())
  RETURNING id INTO v_tx;
  IF p_stockage IS NOT NULL THEN
    INSERT INTO public.mouvements_carburant (stockage_id, type, variation, date_mouvement, reference_piece,
      fuel_transaction_id, saisi_par)
    VALUES (s.id, 'distribution', -p_litres, p_date::timestamptz, v_ref, v_tx, auth.uid());
  END IF;
  RETURN v_tx;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.saisir_plein(uuid, date, numeric, uuid, numeric, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saisir_plein(uuid, date, numeric, uuid, numeric, uuid, text) TO authenticated;

-- Plus d'insertion ni de modification directe d'un plein depuis le
-- navigateur : fiche carburant (saisir_carburant) ou saisir_plein.
REVOKE INSERT, UPDATE ON public.fuel_transactions FROM anon, authenticated;

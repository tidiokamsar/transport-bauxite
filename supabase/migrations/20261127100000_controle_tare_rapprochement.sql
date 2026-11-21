/*
  # Controle de la tare de reference lors du rapprochement CBG (D-095, D-096)

  Le net communique par CBG fait foi : `coalesce(l.net, l.brut - l.tare)` et
  le calcul de l'ecart ne sont pas modifies. La tare de reference sert seule-
  ment de controle independant : une rotation sans tare validee figee est
  signalee par une classe et une anomalie, jamais corrigee ni completee par une
  valeur par defaut. La derogation eventuelle est motivee et journalisee (D-082).

  Migration additive et idempotente : elle etend la liste des classes, ajoute
  une fonction de lecture et un declencheur BEFORE INSERT. Aucune ligne
  existante n'est reecrite.
*/

-- 1. Etendre les listes de classes et de categories (surplus, compatible avec
--    toutes les lignes deja presentes).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.rapprochements_pesee'::regclass
                AND conname = 'rapprochements_pesee_classes_check') THEN
    ALTER TABLE public.rapprochements_pesee DROP CONSTRAINT rapprochements_pesee_classes_check;
  END IF;
  ALTER TABLE public.rapprochements_pesee ADD CONSTRAINT rapprochements_pesee_classes_check
    CHECK (cardinality(classes) > 0 AND classes <@ ARRAY['concordant', 'concordant_avec_reserve', 'ecart_poids',
      'ticket_sans_fiche', 'fiche_sans_ticket', 'ticket_duplique', 'camion_non_reconnu', 'rotation_non_retrouvee',
      'donnees_incompletes', 'a_examiner', 'tare_non_reference', 'tare_non_validee']);

  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.anomalies_pesee'::regclass
                AND conname = 'anomalies_pesee_categorie_check') THEN
    ALTER TABLE public.anomalies_pesee DROP CONSTRAINT anomalies_pesee_categorie_check;
  END IF;
  ALTER TABLE public.anomalies_pesee ADD CONSTRAINT anomalies_pesee_categorie_check
    CHECK (categorie IN ('concordant_avec_reserve', 'ecart_poids', 'ticket_sans_fiche', 'fiche_sans_ticket',
      'ticket_duplique', 'camion_non_reconnu', 'rotation_non_retrouvee', 'donnees_incompletes', 'a_examiner',
      'tare_non_reference', 'tare_non_validee'));
END;
$$;

-- 2. Lecture du controle : une tare figee dans le voyage est conforme ; sinon
--    une tare validee applicable a la date suffit ; sinon la presence d'une
--    proposition non validee est distinguee d'une absence totale de reference.
CREATE OR REPLACE FUNCTION public.classe_tare_voyage(p_trip uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN v.tare_reference_id IS NOT NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.tare_applicable(v.vehicle_id, v.planned_date)) THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.tare_references tr WHERE tr.vehicle_id = v.vehicle_id) THEN 'tare_non_validee'
    ELSE 'tare_non_reference'
  END
  FROM (SELECT vehicle_id, planned_date, tare_reference_id
          FROM public.trips WHERE id = p_trip) v;
$$;
REVOKE ALL ON FUNCTION public.classe_tare_voyage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classe_tare_voyage(uuid) TO authenticated, service_role;

-- 3. Signalement lors de l'ecriture du rapprochement. Le resultat 'concordant'
--    est retire : une pesee ne peut pas etre presentee comme entierement
--    concordante quand la tare de reference n'est pas etablie (D-095).
CREATE OR REPLACE FUNCTION public.signaler_tare_rapprochement()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE c text;
BEGIN
  c := public.classe_tare_voyage(NEW.trip_id);
  IF c IS NULL OR c = ANY (NEW.classes) THEN RETURN NEW; END IF;
  NEW.classes := array_remove(NEW.classes, 'concordant'::text);
  NEW.classes := array_remove(NEW.classes, 'concordant_avec_reserve'::text);
  NEW.classes := NEW.classes || c;
  NEW.detail := concat_ws(' ; ', NEW.detail,
    CASE c WHEN 'tare_non_reference' THEN
      'Aucune tare de reference enregistree pour ce voyage : presence a verifier (D-095)'
    ELSE
      'Tare proposee mais non validee pour ce voyage : derogation D-082 a motiver (D-095)'
    END);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.signaler_tare_rapprochement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_tare_rapprochement() TO authenticated, service_role;
DROP TRIGGER IF EXISTS signaler_tare_rapprochement ON public.rapprochements_pesee;
CREATE TRIGGER signaler_tare_rapprochement BEFORE INSERT ON public.rapprochements_pesee
  FOR EACH ROW EXECUTE FUNCTION public.signaler_tare_rapprochement();

COMMENT ON FUNCTION public.classe_tare_voyage(uuid) IS
  'Controle independant de la presence d''une tare de reference figee ou validee ; aucune valeur substituee (D-095, D-096).';

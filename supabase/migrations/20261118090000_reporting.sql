/*
  # Reporting et couts directs (D-058, lot 20, modules 20 et 21)

  1. Rapports calcules a la lecture depuis les donnees reelles, fonctions
     SECURITY INVOKER : la RLS et le perimetre site du lecteur s'appliquent.
     Format commun (rang, section, indicateur, valeur, unite, manquants,
     source, remarque) : une valeur absente reste NULL et la remarque le
     signale (« Sans données », « Non visible avec vos droits », « Non
     rattaché au poste ») ; `manquants` compte les enregistrements sans la
     mesure (voyage livre sans pesee, plein sans prix...). Aucune estimation.
     - `indicateurs_exploitation(debut, fin, site, shift)` : production
       (objectif actif, D-023), voyages par etat, tonnes chargees, recues,
       acceptees et livrees (convention D-023), tickets CBG (D-037),
       carburant distribue (pleins), incidents (D-054), immobilisations
       (D-022), heures pointees (D-028), postes (D-048), couts directs.
     - `rapport_journalier(date, site)`, `rapport_mensuel(mois, site)`,
       `rapport_mensuel_par_jour(mois, site)` (tableau jour x indicateur),
       `rapport_shift(poste)` (bilan fige, equipe, evenements, indicateurs
       du shift `trips.shift_id`), `rapport_loueur(debut, fin, site)`
       (heures pointees, immobilisations par imputation, interventions,
       factures controlees D-032) et `rapport_client(debut, fin, site)`
       (tonnes livrees et acceptees, tickets, releves CBG D-050, factures
       emises D-029).
  2. `rapports_figes` : rapport fige (numero RAP), append-only, par
     `figer_rapport` (SECURITY DEFINER, droit d'ecriture reports, perimetre
     du site demande ; sans site, profil global seulement).
  3. Couts directs (`costs`) : plus d'ecriture depuis le navigateur ni de
     suppression. `enregistrer_cout` (droit d'ecriture costs, montant
     positif, devise, date non future, site du perimetre) et `annuler_cout`
     (motif). Plus de date du jour par defaut. Lecture : modules costs ou
     reports et perimetre du site (sans site : profil global).

  Idempotent.
*/

-- 0. Rattachements a un site, lus sans dependre des droits sur les engins
-- et les voyages (seul l'identifiant du site est rendu).
CREATE OR REPLACE FUNCTION public.site_engin(p_vehicle uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT v.site_id FROM public.vehicles v WHERE v.id = p_vehicle;
$$;
REVOKE EXECUTE ON FUNCTION public.site_engin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_engin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.site_rattache(p_site uuid, p_trip uuid, p_vehicle uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(p_site,
                  (SELECT t.departure_site_id FROM public.trips t WHERE t.id = p_trip),
                  (SELECT v.site_id FROM public.vehicles v WHERE v.id = p_vehicle));
$$;
REVOKE EXECUTE ON FUNCTION public.site_rattache(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_rattache(uuid, uuid, uuid) TO authenticated, service_role;

-- 1. Couts directs
ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS numero text UNIQUE;
ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS devise text CHECK (devise IS NULL OR devise ~ '^[A-Z]{3}$');
ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'enregistre' CHECK (statut IN ('enregistre', 'annule'));
ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS annule_par uuid REFERENCES auth.users(id);
ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS annule_le timestamptz;
ALTER TABLE public.costs ADD COLUMN IF NOT EXISTS motif_annulation text;
ALTER TABLE public.costs ALTER COLUMN date DROP DEFAULT;
CREATE INDEX IF NOT EXISTS idx_costs_site_date ON public.costs(site_id, date);
CREATE SEQUENCE IF NOT EXISTS public.costs_numero_seq;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costs_annulation_motivee') THEN
    ALTER TABLE public.costs ADD CONSTRAINT costs_annulation_motivee
      CHECK (statut <> 'annule' OR nullif(btrim(coalesce(motif_annulation, '')), '') IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costs_montant_positif') THEN
    ALTER TABLE public.costs ADD CONSTRAINT costs_montant_positif CHECK (amount > 0) NOT VALID;
  END IF;
END $$;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'costs' LOOP
    EXECUTE format('DROP POLICY %I ON public.costs', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.costs FROM anon, authenticated;
GRANT SELECT ON public.costs TO authenticated;
GRANT ALL ON public.costs TO service_role;
CREATE POLICY lecture ON public.costs FOR SELECT TO authenticated
  USING ((public.has_module_view('costs') OR public.has_module_view('reports') OR public.is_admin())
         AND public.site_permis(site_id));

-- Un cout ne se supprime pas et ne change plus, sauf son annulation
-- (hors contexte interne sans JWT).
CREATE OR REPLACE FUNCTION public.garde_cout()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un cout ne se supprime pas : annulez-le avec un motif' USING ERRCODE = '42501';
  END IF;
  IF OLD.statut <> 'enregistre' OR NEW.statut <> 'annule'
     OR NEW.date IS DISTINCT FROM OLD.date OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.devise IS DISTINCT FROM OLD.devise OR NEW.site_id IS DISTINCT FROM OLD.site_id
     OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR NEW.category_id IS DISTINCT FROM OLD.category_id
     OR NEW.description IS DISTINCT FROM OLD.description OR NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.numero IS DISTINCT FROM OLD.numero OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cout fige : seule une annulation motivee est possible' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garde_cout ON public.costs;
CREATE TRIGGER garde_cout BEFORE UPDATE OR DELETE ON public.costs
  FOR EACH ROW EXECUTE FUNCTION public.garde_cout();

CREATE OR REPLACE FUNCTION public.enregistrer_cout(
  p_date date, p_description text, p_montant numeric, p_devise text,
  p_categorie uuid DEFAULT NULL, p_site uuid DEFAULT NULL, p_vehicule uuid DEFAULT NULL,
  p_reference text DEFAULT NULL, p_mode_paiement text DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_devise text := upper(btrim(coalesce(p_devise, '')));
BEGIN
  IF NOT (public.has_module_write('costs') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les couts requis' USING ERRCODE = '42501';
  END IF;
  IF p_date IS NULL OR p_date > current_date THEN RAISE EXCEPTION 'Date de la depense requise, non future' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_description, '')), '') IS NULL THEN RAISE EXCEPTION 'Description requise' USING ERRCODE = '22023'; END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN RAISE EXCEPTION 'Montant positif requis' USING ERRCODE = '22023'; END IF;
  IF v_devise !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Devise requise (code a trois lettres)' USING ERRCODE = '22023'; END IF;
  IF p_categorie IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cost_categories c WHERE c.id = p_categorie AND coalesce(c.active, true)) THEN
    RAISE EXCEPTION 'Categorie inconnue ou inactive' USING ERRCODE = '22023';
  END IF;
  IF p_site IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.id = p_site) THEN
    RAISE EXCEPTION 'Site inconnu' USING ERRCODE = '22023';
  END IF;
  IF NOT public.site_permis(p_site) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise (un cout sans site exige un profil global)' USING ERRCODE = '42501';
  END IF;
  IF p_vehicule IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicule) THEN RAISE EXCEPTION 'Engin inconnu' USING ERRCODE = '22023'; END IF;
    IF NOT public.vehicule_permis(p_vehicule) THEN RAISE EXCEPTION 'Hors perimetre : engin d''un autre site' USING ERRCODE = '42501'; END IF;
  END IF;
  INSERT INTO public.costs (numero, date, category_id, vehicle_id, site_id, description, amount, devise, reference, payment_method, notes, created_by)
  VALUES ('CST-' || to_char(p_date, 'YYYY') || '-' || lpad(nextval('public.costs_numero_seq')::text, 5, '0'),
          p_date, p_categorie, p_vehicule, p_site, btrim(p_description), p_montant, v_devise,
          nullif(btrim(coalesce(p_reference, '')), ''), nullif(btrim(coalesce(p_mode_paiement, '')), ''),
          nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_cout(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE c public.costs;
BEGIN
  IF NOT (public.has_module_write('costs') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les couts requis' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.costs WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cout introuvable' USING ERRCODE = '22023'; END IF;
  IF NOT public.site_permis(c.site_id) THEN RAISE EXCEPTION 'Hors perimetre : cout d''un autre site' USING ERRCODE = '42501'; END IF;
  IF c.statut <> 'enregistre' THEN RAISE EXCEPTION 'Cout deja annule' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce(p_motif, '')), '') IS NULL THEN RAISE EXCEPTION 'Motif de l''annulation requis' USING ERRCODE = '22023'; END IF;
  UPDATE public.costs SET statut = 'annule', motif_annulation = btrim(p_motif), annule_par = auth.uid(), annule_le = now()
   WHERE id = p_id;
END;
$$;

-- 2. Indicateurs d'exploitation sur une periode, un site et un shift
CREATE OR REPLACE FUNCTION public.indicateurs_exploitation(
  p_debut date, p_fin date, p_site uuid DEFAULT NULL, p_shift uuid DEFAULT NULL
) RETURNS TABLE (rang integer, section text, indicateur text, valeur numeric, unite text, manquants integer, source text, remarque text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH dr AS (
    SELECT (a OR public.has_module_view('trips')) AS trips,
           (a OR public.has_module_view('planning')) AS planning,
           (a OR public.has_module_view('fuel')) AS fuel,
           (a OR public.has_module_view('maintenance')) AS maint,
           (a OR ((public.has_module_view('maintenance') OR public.has_module_view('contracts'))
                  AND (public.has_module_view('trips') OR public.has_module_view('maintenance') OR public.has_module_view('fuel')))) AS pointages,
           (a OR public.has_module_view('trips') OR public.has_module_view('reports')) AS incidents,
           (a OR public.has_module_view('trips')) AS tickets,
           (a OR public.has_module_view('trips') OR public.has_module_view('planning')) AS postes,
           (a OR public.has_module_view('costs') OR public.has_module_view('reports')) AS couts
      FROM (SELECT public.is_admin() AS a) x
  ),
  b AS (SELECT p_debut::timestamptz AS du, (p_fin + 1)::timestamptz AS au),
  v AS (
    SELECT t.id, t.etat, t.net_weight, t.net_weight_reception, t.accepted_tonnage, t.load_weight,
           t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED') AS livre
      FROM public.trips t
     WHERE t.planned_date BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR t.departure_site_id = p_site)
       AND (p_shift IS NULL OR t.shift_id = p_shift)
  ),
  va AS (
    SELECT count(*) AS total,
           count(*) FILTER (WHERE etat IN ('DRAFT', 'PLANNED', 'ASSIGNED')) AS prevus,
           count(*) FILTER (WHERE etat IN ('AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT',
                                           'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'INTERRUPTED')) AS en_cours,
           count(*) FILTER (WHERE livre) AS livres,
           count(*) FILTER (WHERE etat = 'DISPUTED') AS litiges,
           count(*) FILTER (WHERE etat IN ('CANCELLED', 'REJECTED')) AS annules,
           sum(net_weight) FILTER (WHERE livre) AS t_chargees,
           count(*) FILTER (WHERE livre AND net_weight IS NULL) AS sans_chargee,
           sum(net_weight_reception) FILTER (WHERE livre) AS t_recues,
           count(*) FILTER (WHERE livre AND net_weight_reception IS NULL) AS sans_recue,
           sum(accepted_tonnage) FILTER (WHERE etat IN ('ACCEPTED', 'CLOSED')) AS t_acceptees,
           count(*) FILTER (WHERE etat IN ('ACCEPTED', 'CLOSED') AND accepted_tonnage IS NULL) AS sans_acceptee,
           count(*) FILTER (WHERE etat IN ('DELIVERED', 'DISPUTED')) AS non_acceptes,
           sum(coalesce(accepted_tonnage, net_weight_reception, net_weight, load_weight)) FILTER (WHERE livre) AS t_livrees,
           count(*) FILTER (WHERE livre AND coalesce(accepted_tonnage, net_weight_reception, net_weight, load_weight) IS NULL) AS sans_poids
      FROM v
  ),
  tk AS (
    SELECT count(k.id) AS tickets,
           count(*) FILTER (WHERE k.est_rectifie) AS rectifies,
           count(*) FILTER (WHERE v.livre AND k.id IS NULL) AS livres_sans_ticket
      FROM v LEFT JOIN public.v_tickets_pesee_cbg_effectifs k ON k.trip_id = v.id
  ),
  ob AS (
    SELECT sum(c) AS cible FROM (
      SELECT CASE WHEN p_shift IS NOT NULL THEN sum(o.tonnes_cible) FILTER (WHERE o.shift_id = p_shift)
                  ELSE coalesce(max(o.tonnes_cible) FILTER (WHERE o.shift_id IS NULL),
                                sum(o.tonnes_cible) FILTER (WHERE o.shift_id IS NOT NULL)) END AS c
        FROM public.objectifs_production o
       WHERE o.statut = 'actif' AND o.date_plan BETWEEN p_debut AND p_fin
         AND (p_site IS NULL OR o.site_id = p_site)
       GROUP BY o.date_plan, o.site_id) x
  ),
  ca AS (
    SELECT sum(f.volume_liters) AS litres,
           sum(coalesce(f.total_cost, f.total_amount)) AS cout,
           count(*) FILTER (WHERE coalesce(f.total_cost, f.total_amount) IS NULL) AS sans_prix,
           count(*) AS pleins
      FROM public.fuel_transactions f
     WHERE f.transaction_date BETWEEN p_debut AND p_fin AND f.transaction_type = 'refuel'
       AND (p_site IS NULL OR coalesce(f.site_id, public.site_engin(f.vehicle_id)) = p_site)
  ),
  inc AS (
    SELECT count(*) AS declares,
           count(*) FILTER (WHERE i.type IN ('accident', 'blessure')) AS accidents,
           count(*) FILTER (WHERE i.severity IN ('severe', 'critical')) AS graves,
           count(*) FILTER (WHERE i.statut <> 'clos') AS non_clos
      FROM public.incidents i
     WHERE i.incident_time::date BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR public.site_rattache(i.site_id, i.trip_id, i.vehicle_id) = p_site)
       AND (p_shift IS NULL OR i.trip_id IN (SELECT v.id FROM v))
  ),
  im AS (
    SELECT count(*) FILTER (WHERE m.debut >= b.du AND m.debut < b.au) AS declarees,
           count(*) FILTER (WHERE m.fin IS NULL OR m.fin >= least(b.au, now())) AS en_cours,
           round(sum(greatest(0, extract(epoch FROM least(coalesce(m.fin, now()), b.au, now()) - greatest(m.debut, b.du)) / 3600)), 1) AS heures,
           round(sum(greatest(0, extract(epoch FROM least(coalesce(m.fin, now()), b.au, now()) - greatest(m.debut, b.du)) / 3600))
                 FILTER (WHERE m.imputation = 'loueur'), 1) AS heures_loueur
      FROM public.immobilisations m, b
     WHERE m.statut <> 'annulee' AND m.debut < b.au AND (m.fin IS NULL OR m.fin > b.du)
       AND (p_site IS NULL OR public.site_engin(m.vehicle_id) = p_site)
  ),
  pt AS (
    SELECT sum(pe.heures_marche) AS heures, count(DISTINCT pe.vehicle_id) AS engins
      FROM public.pointages_engins pe JOIN public.fiches_terrain fi ON fi.id = pe.fiche_id
     WHERE fi.date_fiche BETWEEN p_debut AND p_fin AND fi.statut <> 'annulee'
       AND (p_site IS NULL OR fi.site_id = p_site)
       AND (p_shift IS NULL OR fi.shift_id = p_shift)
  ),
  po AS (
    SELECT count(*) AS total,
           count(*) FILTER (WHERE p.statut = 'ouvert') AS ouverts,
           count(*) FILTER (WHERE p.statut = 'cloture') AS clos,
           count(*) FILTER (WHERE p.statut = 'valide') AS valides
      FROM public.postes p
     WHERE p.date_poste BETWEEN p_debut AND p_fin AND (p_site IS NULL OR p.site_id = p_site)
  ),
  co AS (
    SELECT c.devise, sum(c.amount) AS montant, count(*) AS n
      FROM public.costs c
     WHERE c.statut = 'enregistre' AND c.date BETWEEN p_debut AND p_fin
       AND (p_site IS NULL OR c.site_id = p_site)
     GROUP BY c.devise
  ),
  lignes AS (
    SELECT l.* FROM dr, va, tk, ob, ca, inc, im, pt, po, LATERAL (VALUES
      (10, 'Production', 'Objectif de production', ob.cible, 't', NULL::bigint, 'objectifs_production (version active)',
           CASE WHEN ob.cible IS NULL THEN 'Sans objectif saisi' END, dr.planning),
      (11, 'Production', 'Tonnes livrées (convention D-023)', va.t_livrees, 't', va.sans_poids, 'voyages livrés',
           'Tonnage accepté, sinon reçu, sinon chargé', dr.trips),
      (12, 'Production', 'Taux de réalisation', CASE WHEN ob.cible > 0 AND va.t_livrees IS NOT NULL THEN round(100 * va.t_livrees / ob.cible, 1) END,
           '%', NULL, 'objectif et voyages livrés', CASE WHEN ob.cible IS NULL THEN 'Sans objectif saisi' END, dr.planning AND dr.trips),
      (20, 'Voyages', 'Voyages du périmètre', va.total, 'voyages', NULL, 'trips', NULL, dr.trips),
      (21, 'Voyages', 'Prévus ou affectés', va.prevus, 'voyages', NULL, 'trips', NULL, dr.trips),
      (22, 'Voyages', 'En cours ou interrompus', va.en_cours, 'voyages', NULL, 'trips', NULL, dr.trips),
      (23, 'Voyages', 'Livrés', va.livres, 'voyages', NULL, 'trips', NULL, dr.trips),
      (24, 'Voyages', 'Dont en litige', va.litiges, 'voyages', NULL, 'trips', NULL, dr.trips),
      (25, 'Voyages', 'Annulés ou rejetés', va.annules, 'voyages', NULL, 'trips', NULL, dr.trips),
      (30, 'Tonnages', 'Tonnes chargées (pesée départ)', va.t_chargees, 't', va.sans_chargee, 'voyages livrés', NULL, dr.trips),
      (31, 'Tonnages', 'Tonnes reçues (pesée arrivée)', va.t_recues, 't', va.sans_recue, 'voyages livrés', NULL, dr.trips),
      (32, 'Tonnages', 'Tonnes acceptées', va.t_acceptees, 't', va.sans_acceptee, 'voyages acceptés ou clos',
           CASE WHEN va.non_acceptes > 0 THEN va.non_acceptes || ' voyage(s) livré(s) non encore accepté(s)' END, dr.trips),
      (40, 'Tickets CBG', 'Tickets de pesée', tk.tickets, 'tickets', NULL, 'tickets de pesée effectifs (D-037)', NULL, dr.trips AND dr.tickets),
      (41, 'Tickets CBG', 'Dont rectifiés', tk.rectifies, 'tickets', NULL, 'rectifications de tickets', NULL, dr.trips AND dr.tickets),
      (42, 'Tickets CBG', 'Voyages livrés sans ticket', tk.livres_sans_ticket, 'voyages', NULL, 'voyages livrés', NULL, dr.trips AND dr.tickets),
      (50, 'Carburant', 'Gasoil distribué (pleins)', CASE WHEN p_shift IS NULL THEN ca.litres END, 'L', NULL, 'fuel_transactions (pleins)',
           CASE WHEN p_shift IS NOT NULL THEN 'Non rattaché au poste' END, dr.fuel),
      (51, 'Carburant', 'Montant des pleins valorisés', CASE WHEN p_shift IS NULL THEN ca.cout END, 'devise de saisie',
           CASE WHEN p_shift IS NULL THEN ca.sans_prix END, 'fuel_transactions (pleins)',
           CASE WHEN p_shift IS NOT NULL THEN 'Non rattaché au poste' ELSE 'Devise non enregistrée sur les pleins' END, dr.fuel),
      (52, 'Carburant', 'Litres par tonne livrée', CASE WHEN p_shift IS NULL AND va.t_livrees > 0 AND ca.litres IS NOT NULL THEN round(ca.litres / va.t_livrees, 3) END,
           'L/t', NULL, 'pleins et voyages livrés', CASE WHEN p_shift IS NOT NULL THEN 'Non rattaché au poste' END, dr.fuel AND dr.trips),
      (60, 'Incidents', 'Incidents déclarés', inc.declares, 'incidents', NULL, 'incidents (D-054)',
           CASE WHEN p_shift IS NOT NULL THEN 'Incidents rattachés aux voyages du poste' END, dr.incidents AND (p_shift IS NULL OR dr.trips)),
      (61, 'Incidents', 'Dont accidents et blessures', inc.accidents, 'incidents', NULL, 'incidents (D-054)', NULL, dr.incidents AND (p_shift IS NULL OR dr.trips)),
      (62, 'Incidents', 'Dont gravité sévère ou critique', inc.graves, 'incidents', NULL, 'incidents (D-054)', NULL, dr.incidents AND (p_shift IS NULL OR dr.trips)),
      (63, 'Incidents', 'Non clos à ce jour', inc.non_clos, 'incidents', NULL, 'incidents (D-054)', NULL, dr.incidents AND (p_shift IS NULL OR dr.trips)),
      (70, 'Immobilisations', 'Immobilisations déclarées', CASE WHEN p_shift IS NULL THEN im.declarees END, 'immobilisations', NULL, 'immobilisations (D-022)',
           CASE WHEN p_shift IS NOT NULL THEN 'Non rattaché au poste' END, dr.maint),
      (71, 'Immobilisations', 'En cours à la fin de la période', CASE WHEN p_shift IS NULL THEN im.en_cours END, 'engins', NULL, 'immobilisations (D-022)',
           CASE WHEN p_shift IS NOT NULL THEN 'Non rattaché au poste' END, dr.maint),
      (72, 'Immobilisations', 'Heures d''immobilisation', CASE WHEN p_shift IS NULL THEN im.heures END, 'h', NULL, 'immobilisations (D-022)',
           CASE WHEN p_shift IS NOT NULL THEN 'Non rattaché au poste' ELSE 'Bornées à la période et à l''heure actuelle' END, dr.maint),
      (73, 'Immobilisations', 'Dont imputables au loueur', CASE WHEN p_shift IS NULL THEN im.heures_loueur END, 'h', NULL, 'immobilisations (D-022)',
           CASE WHEN p_shift IS NOT NULL THEN 'Non rattaché au poste' END, dr.maint),
      (80, 'Engins', 'Heures pointées', pt.heures, 'h', NULL, 'pointages des fiches terrain (D-028)', NULL, dr.pointages),
      (81, 'Engins', 'Engins pointés', pt.engins, 'engins', NULL, 'pointages des fiches terrain (D-028)', NULL, dr.pointages),
      (90, 'Postes', 'Postes ouverts sur la période', CASE WHEN p_shift IS NULL THEN po.total END, 'postes', NULL, 'postes (D-048)',
           CASE WHEN p_shift IS NOT NULL THEN 'Voir la section Poste' END, dr.postes),
      (91, 'Postes', 'Dont validés', CASE WHEN p_shift IS NULL THEN po.valides END, 'postes', NULL, 'postes (D-048)',
           CASE WHEN p_shift IS NOT NULL THEN 'Voir la section Poste' WHEN po.ouverts + po.clos > 0 THEN (po.ouverts + po.clos) || ' poste(s) non validé(s)' END, dr.postes)
    ) AS l(rang, section, indicateur, valeur, unite, manquants, source, remarque, visible)
    UNION ALL
    SELECT 100 + (row_number() OVER (ORDER BY co.devise NULLS LAST))::integer * 2, 'Coûts directs',
           'Coûts directs saisis (' || coalesce(co.devise, 'devise non renseignée') || ')', co.montant, coalesce(co.devise, '?'), NULL::bigint,
           'costs (non annulés)', co.n || ' dépense(s) ; hors location des engins', dr.couts
      FROM co, dr WHERE p_shift IS NULL
    UNION ALL
    SELECT 101 + (row_number() OVER (ORDER BY co.devise NULLS LAST))::integer * 2, 'Coûts directs',
           'Coût direct par tonne livrée (' || coalesce(co.devise, 'devise non renseignée') || ')',
           CASE WHEN va.t_livrees > 0 THEN round(co.montant / va.t_livrees, 2) END, coalesce(co.devise, '?') || '/t', NULL::bigint,
           'costs et voyages livrés', CASE WHEN NOT dr.trips THEN 'Tonnes non visibles avec vos droits' WHEN coalesce(va.t_livrees, 0) = 0 THEN 'Sans tonnes livrées' END,
           dr.couts AND dr.trips
      FROM co, dr, va WHERE p_shift IS NULL
    UNION ALL
    SELECT 100, 'Coûts directs', 'Coûts directs saisis', NULL::numeric, NULL, NULL::bigint, 'costs (non annulés)',
           CASE WHEN p_shift IS NOT NULL THEN 'Non rattaché au poste' END, dr.couts
      FROM dr WHERE p_shift IS NOT NULL OR NOT EXISTS (SELECT 1 FROM co)
  )
  SELECT l.rang, l.section, l.indicateur,
         CASE WHEN l.visible THEN l.valeur END,
         l.unite,
         CASE WHEN l.visible THEN l.manquants::integer END,
         l.source,
         CASE WHEN NOT l.visible THEN 'Non visible avec vos droits de lecture'
              ELSE coalesce(l.remarque, CASE WHEN l.valeur IS NULL THEN 'Sans données' END) END
    FROM lignes l
   ORDER BY l.rang;
$$;

CREATE OR REPLACE FUNCTION public.rapport_journalier(p_date date, p_site uuid DEFAULT NULL)
RETURNS TABLE (rang integer, section text, indicateur text, valeur numeric, unite text, manquants integer, source text, remarque text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT * FROM public.indicateurs_exploitation(p_date, p_date, p_site, NULL);
$$;

CREATE OR REPLACE FUNCTION public.rapport_mensuel(p_mois date, p_site uuid DEFAULT NULL)
RETURNS TABLE (rang integer, section text, indicateur text, valeur numeric, unite text, manquants integer, source text, remarque text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT * FROM public.indicateurs_exploitation(date_trunc('month', p_mois)::date,
    (date_trunc('month', p_mois) + interval '1 month - 1 day')::date, p_site, NULL);
$$;

-- Tableau croise jour x indicateur du mois (valeurs NULL hors droits).
CREATE OR REPLACE FUNCTION public.rapport_mensuel_par_jour(p_mois date, p_site uuid DEFAULT NULL)
RETURNS TABLE (jour date, voyages integer, voyages_livres integer, tonnes_livrees numeric, tonnes_acceptees numeric,
               litres numeric, incidents integer, immobilisations_declarees integer, heures_pointees numeric)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH dr AS (
    SELECT (a OR public.has_module_view('trips')) AS trips,
           (a OR public.has_module_view('fuel')) AS fuel,
           (a OR public.has_module_view('trips') OR public.has_module_view('reports')) AS incidents,
           (a OR public.has_module_view('maintenance')) AS maint,
           (a OR ((public.has_module_view('maintenance') OR public.has_module_view('contracts'))
                  AND (public.has_module_view('trips') OR public.has_module_view('maintenance') OR public.has_module_view('fuel')))) AS pointages
      FROM (SELECT public.is_admin() AS a) x
  ),
  j AS (
    SELECT g::date AS jour FROM generate_series(date_trunc('month', p_mois), date_trunc('month', p_mois) + interval '1 month - 1 day', interval '1 day') g
  ),
  j0 AS (SELECT min(jour) AS du, max(jour) AS au FROM j),
  t AS (
    SELECT t.planned_date AS jour, count(*) AS n,
           count(*) FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')) AS livres,
           sum(coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight))
             FILTER (WHERE t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')) AS tonnes,
           sum(t.accepted_tonnage) FILTER (WHERE t.etat IN ('ACCEPTED', 'CLOSED')) AS acceptees
      FROM public.trips t, j0
     WHERE t.planned_date BETWEEN j0.du AND j0.au AND (p_site IS NULL OR t.departure_site_id = p_site)
     GROUP BY t.planned_date
  ),
  f AS (
    SELECT f.transaction_date AS jour, sum(f.volume_liters) AS litres
      FROM public.fuel_transactions f, j0
     WHERE f.transaction_date BETWEEN j0.du AND j0.au AND f.transaction_type = 'refuel'
       AND (p_site IS NULL OR coalesce(f.site_id, public.site_engin(f.vehicle_id)) = p_site)
     GROUP BY f.transaction_date
  ),
  i AS (
    SELECT i.incident_time::date AS jour, count(*) AS n
      FROM public.incidents i, j0
     WHERE i.incident_time::date BETWEEN j0.du AND j0.au
       AND (p_site IS NULL OR public.site_rattache(i.site_id, i.trip_id, i.vehicle_id) = p_site)
     GROUP BY i.incident_time::date
  ),
  m AS (
    SELECT m.debut::date AS jour, count(*) AS n
      FROM public.immobilisations m, j0
     WHERE m.statut <> 'annulee' AND m.debut::date BETWEEN j0.du AND j0.au
       AND (p_site IS NULL OR public.site_engin(m.vehicle_id) = p_site)
     GROUP BY m.debut::date
  ),
  p AS (
    SELECT fi.date_fiche AS jour, sum(pe.heures_marche) AS heures
      FROM public.pointages_engins pe JOIN public.fiches_terrain fi ON fi.id = pe.fiche_id, j0
     WHERE fi.date_fiche BETWEEN j0.du AND j0.au AND fi.statut <> 'annulee' AND (p_site IS NULL OR fi.site_id = p_site)
     GROUP BY fi.date_fiche
  )
  SELECT j.jour,
         CASE WHEN dr.trips THEN coalesce(t.n, 0)::integer END,
         CASE WHEN dr.trips THEN coalesce(t.livres, 0)::integer END,
         CASE WHEN dr.trips THEN t.tonnes END,
         CASE WHEN dr.trips THEN t.acceptees END,
         CASE WHEN dr.fuel THEN f.litres END,
         CASE WHEN dr.incidents THEN coalesce(i.n, 0)::integer END,
         CASE WHEN dr.maint THEN coalesce(m.n, 0)::integer END,
         CASE WHEN dr.pointages THEN p.heures END
    FROM j CROSS JOIN dr
    LEFT JOIN t ON t.jour = j.jour
    LEFT JOIN f ON f.jour = j.jour
    LEFT JOIN i ON i.jour = j.jour
    LEFT JOIN m ON m.jour = j.jour
    LEFT JOIN p ON p.jour = j.jour
   ORDER BY j.jour;
$$;

-- Rapport de shift : poste (D-048) et voyages du shift (trips.shift_id).
CREATE OR REPLACE FUNCTION public.rapport_shift(p_poste uuid)
RETURNS TABLE (rang integer, section text, indicateur text, valeur numeric, unite text, manquants integer, source text, remarque text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH p AS (SELECT * FROM public.postes WHERE id = p_poste),
  eq AS (
    SELECT count(*) AS membres,
           count(*) FILTER (WHERE e.present) AS presents,
           count(*) FILTER (WHERE e.present = false) AS absents,
           count(*) FILTER (WHERE e.present IS NULL) AS non_pointes,
           count(*) FILTER (WHERE e.retard_minutes > 0) AS retards,
           sum(e.retard_minutes) AS minutes_retard
      FROM public.postes_equipe e WHERE e.poste_id = p_poste
  ),
  ev AS (
    SELECT count(*) FILTER (WHERE categorie = 'incident') AS incident,
           count(*) FILTER (WHERE categorie = 'arret') AS arret,
           count(*) FILTER (WHERE categorie = 'retard') AS retard,
           count(*) FILTER (WHERE categorie = 'securite') AS securite,
           count(*) FILTER (WHERE categorie = 'information') AS information
      FROM public.postes_evenements WHERE poste_id = p_poste
  )
  SELECT l.rang, l.section, l.indicateur, l.valeur, l.unite, l.manquants, l.source,
         coalesce(l.remarque, CASE WHEN l.valeur IS NULL THEN 'Sans données' END)
    FROM p, eq, ev, LATERAL (VALUES
      (1, 'Poste', 'Statut du poste', NULL::numeric, NULL::text, NULL::integer, 'postes (D-048)',
          CASE p.statut WHEN 'ouvert' THEN 'Ouvert' WHEN 'cloture' THEN 'Clos, à valider' ELSE 'Validé' END),
      (2, 'Poste', 'Tonnes cible (bilan figé)', (p.bilan ->> 'tonnes_cible')::numeric, 't', NULL, 'bilan de clôture',
          CASE WHEN p.bilan IS NULL THEN 'Bilan figé à la clôture' END),
      (3, 'Poste', 'Tonnes livrées (bilan figé)', (p.bilan ->> 'tonnes_livrees')::numeric, 't', NULL, 'bilan de clôture',
          CASE WHEN p.bilan IS NULL THEN 'Bilan figé à la clôture' END),
      (4, 'Poste', 'Voyages (bilan figé)', (p.bilan ->> 'voyages')::numeric, 'voyages', NULL, 'bilan de clôture',
          CASE WHEN p.bilan IS NULL THEN 'Bilan figé à la clôture' END),
      (5, 'Poste', 'Voyages livrés (bilan figé)', (p.bilan ->> 'voyages_livres')::numeric, 'voyages', NULL, 'bilan de clôture',
          CASE WHEN p.bilan IS NULL THEN 'Bilan figé à la clôture' END),
      (6, 'Équipe', 'Membres de l''équipe', eq.membres::numeric, 'personnes ou engins', NULL, 'postes_equipe', NULL),
      (7, 'Équipe', 'Présents', eq.presents::numeric, 'personnes ou engins', eq.non_pointes::integer, 'postes_equipe',
          CASE WHEN eq.non_pointes > 0 THEN 'Présence non pointée : ' || eq.non_pointes END),
      (8, 'Équipe', 'Absents', eq.absents::numeric, 'personnes ou engins', NULL, 'postes_equipe', NULL),
      (9, 'Équipe', 'Retards', eq.retards::numeric, 'personnes', NULL, 'postes_equipe', NULL),
      (10, 'Équipe', 'Minutes de retard cumulées', eq.minutes_retard::numeric, 'min', NULL, 'postes_equipe', NULL),
      (11, 'Événements', 'Incidents consignés', ev.incident::numeric, 'événements', NULL, 'postes_evenements', NULL),
      (12, 'Événements', 'Arrêts', ev.arret::numeric, 'événements', NULL, 'postes_evenements', NULL),
      (13, 'Événements', 'Retards consignés', ev.retard::numeric, 'événements', NULL, 'postes_evenements', NULL),
      (14, 'Événements', 'Sécurité', ev.securite::numeric, 'événements', NULL, 'postes_evenements', NULL),
      (15, 'Événements', 'Informations', ev.information::numeric, 'événements', NULL, 'postes_evenements', NULL)
    ) AS l(rang, section, indicateur, valeur, unite, manquants, source, remarque)
  UNION ALL
  SELECT i.* FROM p, LATERAL public.indicateurs_exploitation(p.date_poste, p.date_poste, p.site_id, p.shift_id) i
  ORDER BY 1;
$$;

-- Rapport partenaire loueur (Neemba) : heures, immobilisations,
-- interventions et factures controlees.
CREATE OR REPLACE FUNCTION public.rapport_loueur(p_debut date, p_fin date, p_site uuid DEFAULT NULL)
RETURNS TABLE (rang integer, section text, indicateur text, valeur numeric, unite text, manquants integer, source text, remarque text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH dr AS (
    SELECT (a OR ((public.has_module_view('maintenance') OR public.has_module_view('contracts'))
                  AND (public.has_module_view('trips') OR public.has_module_view('maintenance') OR public.has_module_view('fuel')))) AS pointages,
           (a OR public.has_module_view('maintenance')) AS maint,
           (a OR public.has_module_view('maintenance') OR public.has_module_view('contracts')) AS interventions,
           (a OR public.has_module_view('contracts')) AS factures
      FROM (SELECT public.is_admin() AS a) x
  ),
  b AS (SELECT p_debut::timestamptz AS du, (p_fin + 1)::timestamptz AS au),
  pt AS (
    SELECT sum(pe.heures_marche) AS heures, count(DISTINCT pe.vehicle_id) AS engins, count(DISTINCT fi.id) AS fiches
      FROM public.pointages_engins pe JOIN public.fiches_terrain fi ON fi.id = pe.fiche_id
     WHERE fi.date_fiche BETWEEN p_debut AND p_fin AND fi.statut <> 'annulee' AND (p_site IS NULL OR fi.site_id = p_site)
  ),
  im AS (
    SELECT count(*) FILTER (WHERE m.debut >= b.du AND m.debut < b.au) AS declarees,
           count(*) FILTER (WHERE m.fin IS NULL OR m.fin >= least(b.au, now())) AS en_cours,
           round(sum(h), 1) AS heures,
           round(sum(h) FILTER (WHERE m.imputation = 'loueur'), 1) AS h_loueur,
           round(sum(h) FILTER (WHERE m.imputation = 'exploitant'), 1) AS h_exploitant,
           round(sum(h) FILTER (WHERE m.imputation = 'a_determiner'), 1) AS h_a_determiner
      FROM public.immobilisations m, b,
           LATERAL (SELECT greatest(0, extract(epoch FROM least(coalesce(m.fin, now()), b.au, now()) - greatest(m.debut, b.du)) / 3600) AS h) x
     WHERE m.statut <> 'annulee' AND m.debut < b.au AND (m.fin IS NULL OR m.fin > b.du)
       AND (p_site IS NULL OR public.site_engin(m.vehicle_id) = p_site)
  ),
  iv AS (
    SELECT count(*) AS demandees,
           count(*) FILTER (WHERE i.statut = 'demandee') AS en_attente,
           count(*) FILTER (WHERE i.statut IN ('terminee', 'remise_validee')) AS terminees,
           count(*) FILTER (WHERE i.statut = 'remise_validee') AS validees,
           round(avg(extract(epoch FROM i.prise_en_charge_le - i.demande_le) / 3600) FILTER (WHERE i.prise_en_charge_le IS NOT NULL), 1) AS delai_moyen,
           count(*) FILTER (WHERE i.delai_contractuel_heures IS NOT NULL
                              AND extract(epoch FROM coalesce(i.prise_en_charge_le, now()) - i.demande_le) / 3600 > i.delai_contractuel_heures) AS hors_delai,
           count(*) FILTER (WHERE i.delai_contractuel_heures IS NULL) AS sans_delai
      FROM public.interventions_loueur i, b
     WHERE i.demande_le >= b.du AND i.demande_le < b.au
       AND (p_site IS NULL OR public.site_engin(i.vehicle_id) = p_site)
  ),
  ff AS (
    SELECT f.devise, count(*) AS n,
           count(*) FILTER (WHERE f.statut = 'saisie') AS non_controlees,
           sum(f.montant_ht_facture) AS facture,
           sum(f.montant_attendu) AS attendu,
           sum(f.ecart_total) AS ecart,
           sum(f.montant_reclame) AS reclame
      FROM public.factures_fournisseur f
     WHERE f.periode_debut <= p_fin AND f.periode_fin >= p_debut
     GROUP BY f.devise
  ),
  lignes AS (
    SELECT l.* FROM dr, pt, im, iv, LATERAL (VALUES
      (10, 'Heures pointées', 'Heures de marche pointées', pt.heures, 'h', NULL::integer, 'pointages des fiches terrain (D-028)', NULL::text, dr.pointages),
      (11, 'Heures pointées', 'Engins pointés', pt.engins::numeric, 'engins', NULL, 'pointages des fiches terrain (D-028)', NULL, dr.pointages),
      (12, 'Heures pointées', 'Fiches de pointage', pt.fiches::numeric, 'fiches', NULL, 'fiches terrain (D-028)', NULL, dr.pointages),
      (20, 'Immobilisations', 'Immobilisations déclarées', im.declarees::numeric, 'immobilisations', NULL, 'immobilisations (D-022)', NULL, dr.maint),
      (21, 'Immobilisations', 'En cours à la fin de la période', im.en_cours::numeric, 'engins', NULL, 'immobilisations (D-022)', NULL, dr.maint),
      (22, 'Immobilisations', 'Heures d''immobilisation', im.heures, 'h', NULL, 'immobilisations (D-022)', 'Bornées à la période et à l''heure actuelle', dr.maint),
      (23, 'Immobilisations', 'Dont imputables au loueur', im.h_loueur, 'h', NULL, 'immobilisations (D-022)', NULL, dr.maint),
      (24, 'Immobilisations', 'Dont imputables à l''exploitant', im.h_exploitant, 'h', NULL, 'immobilisations (D-022)', NULL, dr.maint),
      (25, 'Immobilisations', 'Dont imputation à déterminer', im.h_a_determiner, 'h', NULL, 'immobilisations (D-022)', NULL, dr.maint),
      (30, 'Interventions', 'Interventions demandées', iv.demandees::numeric, 'interventions', NULL, 'interventions_loueur (D-049)', NULL, dr.interventions),
      (31, 'Interventions', 'En attente de prise en charge', iv.en_attente::numeric, 'interventions', NULL, 'interventions_loueur (D-049)', NULL, dr.interventions),
      (32, 'Interventions', 'Terminées', iv.terminees::numeric, 'interventions', NULL, 'interventions_loueur (D-049)', NULL, dr.interventions),
      (33, 'Interventions', 'Remises en service validées', iv.validees::numeric, 'interventions', NULL, 'interventions_loueur (D-049)', NULL, dr.interventions),
      (34, 'Interventions', 'Délai moyen de prise en charge', iv.delai_moyen, 'h', NULL, 'interventions_loueur (D-049)', NULL, dr.interventions),
      (35, 'Interventions', 'Hors délai contractuel', iv.hors_delai::numeric, 'interventions', iv.sans_delai::integer, 'interventions_loueur (D-049)',
           CASE WHEN iv.sans_delai > 0 THEN iv.sans_delai || ' intervention(s) sans délai contractuel saisi' END, dr.interventions)
    ) AS l(rang, section, indicateur, valeur, unite, manquants, source, remarque, visible)
    UNION ALL
    SELECT 40 + (row_number() OVER (ORDER BY ff.devise))::integer * 10 + k.r, 'Factures du loueur', k.libelle || ' (' || ff.devise || ')', k.v, k.u,
           k.m, 'factures_fournisseur (D-032)', k.rq, dr.factures
      FROM ff, dr, LATERAL (VALUES
        (0, 'Factures reçues', ff.n::numeric, 'factures', NULL::integer, 'Toutes les factures de la période, sans ventilation par site'),
        (1, 'Montant facturé HT', ff.facture, ff.devise, NULL, NULL::text),
        (2, 'Montant attendu au contrôle', ff.attendu, ff.devise, ff.non_controlees::integer,
            CASE WHEN ff.non_controlees > 0 THEN ff.non_controlees || ' facture(s) non contrôlée(s)' END),
        (3, 'Écart constaté', ff.ecart, ff.devise, ff.non_controlees::integer, NULL),
        (4, 'Montant réclamé', ff.reclame, ff.devise, NULL, NULL)
      ) AS k(r, libelle, v, u, m, rq)
    UNION ALL
    SELECT 50, 'Factures du loueur', 'Factures reçues', NULL::numeric, 'factures', NULL::integer, 'factures_fournisseur (D-032)', NULL, dr.factures
      FROM dr WHERE NOT EXISTS (SELECT 1 FROM ff)
  )
  SELECT l.rang, l.section, l.indicateur,
         CASE WHEN l.visible THEN l.valeur END, l.unite, CASE WHEN l.visible THEN l.manquants END, l.source,
         CASE WHEN NOT l.visible THEN 'Non visible avec vos droits de lecture'
              ELSE coalesce(l.remarque, CASE WHEN l.valeur IS NULL THEN 'Sans données' END) END
    FROM lignes l
   ORDER BY l.rang;
$$;

-- Rapport partenaire client (CBG) : tonnes livrees et acceptees, tickets,
-- releves et ecarts, factures emises.
CREATE OR REPLACE FUNCTION public.rapport_client(p_debut date, p_fin date, p_site uuid DEFAULT NULL)
RETURNS TABLE (rang integer, section text, indicateur text, valeur numeric, unite text, manquants integer, source text, remarque text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH dr AS (
    SELECT (a OR public.has_module_view('trips')) AS trips,
           (a OR public.has_module_view('trips') OR public.has_module_view('invoices')) AS releves,
           (a OR public.has_module_view('invoices') OR public.has_module_view('contracts')) AS factures
      FROM (SELECT public.is_admin() AS a) x
  ),
  v AS (
    SELECT t.id, t.etat, t.net_weight, t.net_weight_reception, t.accepted_tonnage
      FROM public.trips t
     WHERE t.planned_date BETWEEN p_debut AND p_fin
       AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')
       AND (p_site IS NULL OR t.departure_site_id = p_site OR t.arrival_site_id = p_site)
  ),
  va AS (
    SELECT count(*) AS livres,
           sum(net_weight) AS chargees, count(*) FILTER (WHERE net_weight IS NULL) AS sans_chargee,
           sum(net_weight_reception) AS recues, count(*) FILTER (WHERE net_weight_reception IS NULL) AS sans_recue,
           sum(accepted_tonnage) FILTER (WHERE etat IN ('ACCEPTED', 'CLOSED')) AS acceptees,
           count(*) FILTER (WHERE etat IN ('ACCEPTED', 'CLOSED') AND accepted_tonnage IS NULL) AS sans_acceptee,
           count(*) FILTER (WHERE etat = 'DELIVERED') AS en_attente,
           count(*) FILTER (WHERE etat = 'DISPUTED') AS litiges
      FROM v
  ),
  tk AS (
    SELECT count(k.id) AS tickets, count(*) FILTER (WHERE k.est_rectifie) AS rectifies,
           count(*) FILTER (WHERE k.id IS NULL) AS sans_ticket, sum(k.net) AS net
      FROM v LEFT JOIN public.v_tickets_pesee_cbg_effectifs k ON k.trip_id = v.id
  ),
  rl AS (
    SELECT r.id FROM public.releves_cbg r
     WHERE r.periode_debut <= p_fin AND r.periode_fin >= p_debut AND (p_site IS NULL OR r.site_id = p_site)
  ),
  ec AS (
    SELECT (SELECT count(*) FROM rl) AS releves,
           (SELECT count(*) FROM public.releves_cbg_lignes x WHERE x.releve_id IN (SELECT id FROM rl)) AS lignes,
           count(*) FILTER (WHERE e.nature = 'concordant') AS concordants,
           count(*) FILTER (WHERE e.nature <> 'concordant') AS anomalies,
           count(*) FILTER (WHERE e.nature = 'ecart_poids') AS ecarts_poids,
           count(*) FILTER (WHERE e.nature IN ('absent_sigtb', 'manquant_releve')) AS absents,
           count(*) FILTER (WHERE e.nature NOT IN ('concordant', 'ecart_poids', 'absent_sigtb', 'manquant_releve')) AS autres,
           count(*) FILTER (WHERE e.nature <> 'concordant' AND e.decision = 'accepte') AS acceptes,
           count(*) FILTER (WHERE e.nature <> 'concordant' AND e.decision = 'litige') AS litiges,
           count(*) FILTER (WHERE e.nature <> 'concordant' AND e.decision IS NULL) AS sans_decision,
           sum(e.ecart_net) FILTER (WHERE e.nature = 'ecart_poids') AS ecart_net
      FROM public.ecarts_releve_cbg e WHERE e.releve_id IN (SELECT id FROM rl)
  ),
  fa AS (
    SELECT f.devise,
           count(*) FILTER (WHERE f.type = 'facture') AS factures,
           sum(f.montant_ht) FILTER (WHERE f.type = 'facture') AS ht,
           count(*) FILTER (WHERE f.type = 'avoir') AS avoirs,
           sum(f.montant_ht) FILTER (WHERE f.type = 'avoir') AS ht_avoirs
      FROM public.factures f
     WHERE f.statut = 'emise' AND f.periode_debut <= p_fin AND f.periode_fin >= p_debut
     GROUP BY f.devise
  ),
  lignes AS (
    SELECT l.* FROM dr, va, tk, ec, LATERAL (VALUES
      (10, 'Livraisons', 'Voyages livrés', va.livres::numeric, 'voyages', NULL::integer, 'trips', 'Au départ ou à l''arrivée du site', dr.trips),
      (11, 'Livraisons', 'Tonnes chargées (pesée départ)', va.chargees, 't', va.sans_chargee::integer, 'voyages livrés', NULL::text, dr.trips),
      (12, 'Livraisons', 'Tonnes reçues (pesée arrivée)', va.recues, 't', va.sans_recue::integer, 'voyages livrés', NULL, dr.trips),
      (13, 'Livraisons', 'Tonnes acceptées', va.acceptees, 't', va.sans_acceptee::integer, 'voyages acceptés ou clos', NULL, dr.trips),
      (14, 'Livraisons', 'Livrés en attente d''acceptation', va.en_attente::numeric, 'voyages', NULL, 'trips', NULL, dr.trips),
      (15, 'Livraisons', 'En litige', va.litiges::numeric, 'voyages', NULL, 'trips', NULL, dr.trips),
      (20, 'Tickets CBG', 'Tickets de pesée', tk.tickets::numeric, 'tickets', NULL, 'tickets effectifs (D-037)', NULL, dr.trips),
      (21, 'Tickets CBG', 'Poids net des tickets', tk.net, 't', NULL, 'tickets effectifs (D-037)', NULL, dr.trips),
      (22, 'Tickets CBG', 'Dont tickets rectifiés', tk.rectifies::numeric, 'tickets', NULL, 'rectifications (D-037)', NULL, dr.trips),
      (23, 'Tickets CBG', 'Voyages livrés sans ticket', tk.sans_ticket::numeric, 'voyages', NULL, 'voyages livrés', NULL, dr.trips),
      (30, 'Relevés CBG', 'Relevés importés', ec.releves::numeric, 'relevés', NULL, 'releves_cbg (D-050)', 'Relevés dont la période recoupe la période', dr.releves),
      (31, 'Relevés CBG', 'Lignes de relevé', ec.lignes::numeric, 'lignes', NULL, 'releves_cbg_lignes', NULL, dr.releves),
      (32, 'Relevés CBG', 'Lignes concordantes', ec.concordants::numeric, 'lignes', NULL, 'rapprochement (D-050)', NULL, dr.releves),
      (33, 'Relevés CBG', 'Anomalies de rapprochement', ec.anomalies::numeric, 'écarts', NULL, 'rapprochement (D-050)', NULL, dr.releves),
      (34, 'Relevés CBG', 'Dont écarts de poids', ec.ecarts_poids::numeric, 'écarts', NULL, 'rapprochement (D-050)', NULL, dr.releves),
      (35, 'Relevés CBG', 'Dont tickets absents d''un côté', ec.absents::numeric, 'écarts', NULL, 'rapprochement (D-050)', NULL, dr.releves),
      (36, 'Relevés CBG', 'Dont autres écarts', ec.autres::numeric, 'écarts', NULL, 'rapprochement (D-050)', 'Camion, date ou ligne illisible', dr.releves),
      (37, 'Relevés CBG', 'Écart de poids net cumulé', ec.ecart_net, 't', NULL, 'rapprochement (D-050)', NULL, dr.releves),
      (38, 'Relevés CBG', 'Anomalies acceptées', ec.acceptes::numeric, 'écarts', NULL, 'décisions (D-050)', NULL, dr.releves),
      (39, 'Relevés CBG', 'Anomalies en litige', ec.litiges::numeric, 'écarts', NULL, 'décisions (D-050)', NULL, dr.releves),
      (40, 'Relevés CBG', 'Anomalies sans décision', ec.sans_decision::numeric, 'écarts', NULL, 'décisions (D-050)', NULL, dr.releves)
    ) AS l(rang, section, indicateur, valeur, unite, manquants, source, remarque, visible)
    UNION ALL
    SELECT 50 + (row_number() OVER (ORDER BY fa.devise))::integer * 10 + k.r, 'Factures CBG', k.libelle || ' (' || fa.devise || ')', k.v, k.u,
           NULL::integer, 'factures émises (D-029)', k.rq, dr.factures
      FROM fa, dr, LATERAL (VALUES
        (0, 'Factures émises', fa.factures::numeric, 'factures', 'Factures dont la période recoupe la période'),
        (1, 'Montant HT facturé', fa.ht, fa.devise, NULL::text),
        (2, 'Avoirs émis', fa.avoirs::numeric, 'avoirs', NULL),
        (3, 'Montant HT des avoirs', fa.ht_avoirs, fa.devise, NULL)
      ) AS k(r, libelle, v, u, rq)
    UNION ALL
    SELECT 60, 'Factures CBG', 'Factures émises', NULL::numeric, 'factures', NULL::integer, 'factures émises (D-029)', NULL, dr.factures
      FROM dr WHERE NOT EXISTS (SELECT 1 FROM fa)
  )
  SELECT l.rang, l.section, l.indicateur,
         CASE WHEN l.visible THEN l.valeur END, l.unite, CASE WHEN l.visible THEN l.manquants END, l.source,
         CASE WHEN NOT l.visible THEN 'Non visible avec vos droits de lecture'
              ELSE coalesce(l.remarque, CASE WHEN l.valeur IS NULL THEN 'Sans données' END) END
    FROM lignes l
   ORDER BY l.rang;
$$;

-- 3. Rapports figes (append-only)
CREATE SEQUENCE IF NOT EXISTS public.rapports_figes_numero_seq;
CREATE TABLE IF NOT EXISTS public.rapports_figes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('journalier', 'mensuel', 'shift', 'loueur', 'client')),
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  site_id uuid REFERENCES public.sites(id),
  poste_id uuid REFERENCES public.postes(id),
  lignes jsonb NOT NULL,
  note text,
  fige_par uuid REFERENCES auth.users(id),
  fige_le timestamptz NOT NULL DEFAULT now(),
  CHECK (periode_fin >= periode_debut),
  CHECK (type <> 'shift' OR poste_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_rapports_figes_type ON public.rapports_figes(type, periode_debut DESC);

ALTER TABLE public.rapports_figes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rapports_figes FROM anon, authenticated;
GRANT SELECT ON public.rapports_figes TO authenticated;
GRANT ALL ON public.rapports_figes TO service_role;
DROP POLICY IF EXISTS lecture ON public.rapports_figes;
CREATE POLICY lecture ON public.rapports_figes FOR SELECT TO authenticated
  USING ((public.has_module_view('reports') OR public.is_admin()) AND public.site_permis(site_id));

CREATE OR REPLACE FUNCTION public.refuser_mutation_rapport_fige()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Un rapport fige ne se modifie ni ne se supprime : figez-en un nouveau' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS rapports_figes_immuables ON public.rapports_figes;
CREATE TRIGGER rapports_figes_immuables BEFORE UPDATE OR DELETE ON public.rapports_figes
  FOR EACH ROW EXECUTE FUNCTION public.refuser_mutation_rapport_fige();

-- Fige un rapport : calcule sur le site demande (perimetre controle) avec
-- les droits de module du demandeur (les fonctions de rapport les
-- verifient ligne par ligne).
CREATE OR REPLACE FUNCTION public.figer_rapport(
  p_type text, p_debut date DEFAULT NULL, p_fin date DEFAULT NULL, p_site uuid DEFAULT NULL,
  p_poste uuid DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid; v_lignes jsonb; v_debut date := p_debut; v_fin date := p_fin; v_site uuid := p_site; po public.postes;
BEGIN
  IF NOT (public.has_module_write('reports') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Droit d''ecriture sur les rapports requis' USING ERRCODE = '42501';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('journalier', 'mensuel', 'shift', 'loueur', 'client') THEN
    RAISE EXCEPTION 'Type de rapport inconnu' USING ERRCODE = '22023';
  END IF;
  IF p_type = 'shift' THEN
    SELECT * INTO po FROM public.postes WHERE id = p_poste;
    IF NOT FOUND THEN RAISE EXCEPTION 'Poste introuvable' USING ERRCODE = '22023'; END IF;
    IF po.statut = 'ouvert' THEN RAISE EXCEPTION 'Un rapport de shift se fige apres la cloture du poste' USING ERRCODE = '22023'; END IF;
    v_debut := po.date_poste; v_fin := po.date_poste; v_site := po.site_id;
  ELSIF p_type = 'journalier' THEN
    v_fin := v_debut;
  ELSIF p_type = 'mensuel' THEN
    v_debut := date_trunc('month', p_debut)::date;
    v_fin := (date_trunc('month', p_debut) + interval '1 month - 1 day')::date;
  END IF;
  IF v_debut IS NULL OR v_fin IS NULL OR v_fin < v_debut THEN RAISE EXCEPTION 'Periode requise' USING ERRCODE = '22023'; END IF;
  IF v_debut > current_date THEN RAISE EXCEPTION 'Periode future : rien a figer' USING ERRCODE = '22023'; END IF;
  IF NOT public.site_permis(v_site) THEN
    RAISE EXCEPTION 'Hors perimetre : site non autorise (un rapport tous sites exige un profil global)' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.rang), '[]'::jsonb) INTO v_lignes FROM (
    SELECT * FROM public.rapport_journalier(v_debut, v_site) WHERE p_type = 'journalier'
    UNION ALL SELECT * FROM public.rapport_mensuel(v_debut, v_site) WHERE p_type = 'mensuel'
    UNION ALL SELECT * FROM public.rapport_shift(p_poste) WHERE p_type = 'shift'
    UNION ALL SELECT * FROM public.rapport_loueur(v_debut, v_fin, v_site) WHERE p_type = 'loueur'
    UNION ALL SELECT * FROM public.rapport_client(v_debut, v_fin, v_site) WHERE p_type = 'client'
  ) r;
  INSERT INTO public.rapports_figes (numero, type, periode_debut, periode_fin, site_id, poste_id, lignes, note, fige_par)
  VALUES ('RAP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.rapports_figes_numero_seq')::text, 5, '0'),
          p_type, v_debut, v_fin, v_site, CASE WHEN p_type = 'shift' THEN p_poste END, v_lignes,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 4. Droits d'execution
DO $$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'enregistrer_cout(date, text, numeric, text, uuid, uuid, uuid, text, text, text)',
    'annuler_cout(uuid, text)',
    'indicateurs_exploitation(date, date, uuid, uuid)',
    'rapport_journalier(date, uuid)',
    'rapport_mensuel(date, uuid)',
    'rapport_mensuel_par_jour(date, uuid)',
    'rapport_shift(uuid)',
    'rapport_loueur(date, date, uuid)',
    'rapport_client(date, date, uuid)',
    'figer_rapport(text, date, date, uuid, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', sig);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.garde_cout() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refuser_mutation_rapport_fige() FROM PUBLIC, anon, authenticated;

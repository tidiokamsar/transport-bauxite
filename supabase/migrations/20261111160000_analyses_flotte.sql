/*
  # Analyses de flotte sur donnees reelles (remise a niveau, D-030)

  Remplacent les maquettes « maintenance predictive » et « comportement
  des chauffeurs », qui lisaient des tables sans producteur.

  1. `fiabilite_engins(du, au)` : par engin, heures d'arret (toutes
     immobilisations), pannes commencees dans la periode (panne, attente de
     piece, accident), temps moyen de reparation (MTTR), temps moyen de
     fonctionnement entre pannes (MTBF, heures disponibles / pannes),
     disponibilite. Source : immobilisations (D-025).
  2. `performance_chauffeurs(du, au)` : par chauffeur, voyages livres,
     tonnes, temps de cycle et de chargement moyens (journal des voyages),
     ecart moyen charge / recu, litiges et rejets, interruptions.
  Valeur non calculable = null. Droits de l'appelant (RLS des sources).

  Idempotent : CREATE OR REPLACE.
*/

CREATE OR REPLACE FUNCTION public.fiabilite_engins(p_du timestamptz, p_au timestamptz)
RETURNS TABLE (
  vehicle_id uuid, heures_periode numeric, heures_arret numeric, pannes integer, heures_pannes numeric,
  mttr_heures numeric, mtbf_heures numeric, disponibilite_pct numeric, derniere_panne timestamptz, heures_loueur numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH periode AS (
    SELECT p_du AS du, least(p_au, now()) AS au,
           greatest(extract(epoch FROM least(p_au, now()) - p_du) / 3600, 0)::numeric AS heures
  ),
  arrets AS (
    SELECT i.vehicle_id, i.cause, i.imputation, i.debut,
           greatest(extract(epoch FROM least(coalesce(i.fin, now()), pe.au) - greatest(i.debut, pe.du)) / 3600, 0)::numeric AS h
    FROM public.immobilisations i CROSS JOIN periode pe
    WHERE i.statut <> 'annulee' AND i.debut < pe.au AND coalesce(i.fin, now()) > pe.du
  ),
  parEngin AS (
    SELECT a.vehicle_id,
           sum(a.h) AS arret,
           count(*) FILTER (WHERE a.cause IN ('panne', 'attente_piece', 'accident') AND a.debut >= (SELECT du FROM periode))::integer AS pannes,
           sum(a.h) FILTER (WHERE a.cause IN ('panne', 'attente_piece', 'accident')) AS h_pannes,
           max(a.debut) FILTER (WHERE a.cause IN ('panne', 'attente_piece', 'accident')) AS derniere,
           sum(a.h) FILTER (WHERE a.imputation = 'loueur') AS loueur
    FROM arrets a GROUP BY a.vehicle_id
  )
  SELECT v.id, round(pe.heures, 1), round(coalesce(e.arret, 0), 1), coalesce(e.pannes, 0), round(coalesce(e.h_pannes, 0), 1),
         CASE WHEN e.pannes > 0 THEN round(e.h_pannes / e.pannes, 1) END,
         CASE WHEN e.pannes > 0 THEN round((pe.heures - coalesce(e.arret, 0)) / e.pannes, 1) END,
         CASE WHEN pe.heures > 0 THEN round(greatest(0, 1 - coalesce(e.arret, 0) / pe.heures) * 100, 1) END,
         e.derniere, round(coalesce(e.loueur, 0), 1)
  FROM public.vehicles v
  CROSS JOIN periode pe
  LEFT JOIN parEngin e ON e.vehicle_id = v.id
  WHERE v.status::text <> 'sold';
$$;

CREATE OR REPLACE FUNCTION public.performance_chauffeurs(p_du date, p_au date)
RETURNS TABLE (
  driver_id uuid, voyages integer, tonnes numeric, cycle_moyen_min numeric, chargement_moyen_min numeric,
  ecart_moyen_pct numeric, litiges integer, interruptions integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH v AS (
    SELECT t.id, t.driver_id, t.etat, t.net_weight, t.net_weight_reception,
           coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) AS tonnage
    FROM public.trips t
    WHERE t.planned_date BETWEEN p_du AND p_au AND t.driver_id IS NOT NULL
  ),
  temps AS (
    SELECT e.trip_id,
           extract(epoch FROM max(e.survenu_le) FILTER (WHERE e.etat_apres = 'DELIVERED')
                            - min(e.survenu_le) FILTER (WHERE e.etat_apres = 'AT_LOADING')) / 60 AS cycle,
           extract(epoch FROM max(e.survenu_le) FILTER (WHERE e.etat_apres = 'LOADED')
                            - min(e.survenu_le) FILTER (WHERE e.etat_apres = 'LOADING')) / 60 AS chargement,
           bool_or(e.etat_apres = 'INTERRUPTED') AS interrompu
    FROM public.trip_events e WHERE e.trip_id IN (SELECT id FROM v) GROUP BY e.trip_id
  )
  SELECT v.driver_id,
         count(*) FILTER (WHERE v.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED'))::integer,
         round(sum(v.tonnage) FILTER (WHERE v.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED')), 2),
         round(avg(t.cycle) FILTER (WHERE t.cycle > 0)::numeric, 0),
         round(avg(t.chargement) FILTER (WHERE t.chargement > 0)::numeric, 0),
         round(avg(abs(v.net_weight_reception - v.net_weight) / v.net_weight * 100)
               FILTER (WHERE v.net_weight > 0 AND v.net_weight_reception IS NOT NULL)::numeric, 2),
         count(*) FILTER (WHERE v.etat IN ('DISPUTED', 'REJECTED'))::integer,
         count(*) FILTER (WHERE t.interrompu)::integer
  FROM v LEFT JOIN temps t ON t.trip_id = v.id
  GROUP BY v.driver_id;
$$;

REVOKE EXECUTE ON FUNCTION public.fiabilite_engins(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiabilite_engins(timestamptz, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.performance_chauffeurs(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.performance_chauffeurs(date, date) TO authenticated;

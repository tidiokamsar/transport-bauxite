/*
  # Lot 5 (D-123) : consolidation de la production

  La production consomme les rotations livrees et distingue :
  - le provisoire : tonnage livre non encore valide par CBG ;
  - le valide : tonnage accepte (trips.accepted_tonnage) sur un voyage
    accepte ou cloture.

  Consolidation par camion, chauffeur, shift, site de depart, destination,
  contrat et jour, plus un total. Chaque voyage n'entre qu'une fois dans une
  dimension : le regroupement part d'une seule ligne par voyage, sans
  jointure multiplicatrice, ce qui exclut la double comptabilisation.

  Tonnage livre = accepte, sinon net de reception, sinon net, sinon charge
  (meme regle que les indicateurs de pilotage). Un voyage sans aucun poids
  est compte dans voyages_sans_poids et ne fabrique pas de tonnage.

  Securite : SECURITY INVOKER ; la RLS des voyages s'applique. Un lecteur
  sans droit ne voit aucune ligne (jamais un zero presente comme un mesure).
*/
CREATE OR REPLACE FUNCTION public.consolidation_production(
  p_debut date, p_fin date, p_site uuid DEFAULT NULL
)
RETURNS TABLE (
  dimension text, cle text, libelle text,
  tonnes_provisoires numeric, tonnes_validees numeric, tonnes_livrees numeric,
  voyages integer, voyages_valides integer, voyages_sans_poids integer,
  source text, fiabilite text, periode_debut date, periode_fin date, detail text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
WITH base AS (
  SELECT t.id, t.planned_date AS jour, t.etat,
         t.vehicle_id, t.driver_id, t.shift_id,
         t.departure_site_id, t.arrival_site_id, v.contrat_id,
         coalesce(t.accepted_tonnage, t.net_weight_reception, t.net_weight, t.load_weight) AS tonnes,
         t.accepted_tonnage AS tonnes_validees,
         (t.etat IN ('ACCEPTED', 'CLOSED') AND t.accepted_tonnage IS NOT NULL) AS valide
    FROM public.trips t
    LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
   WHERE t.planned_date BETWEEN p_debut AND p_fin
     AND (p_site IS NULL OR t.departure_site_id = p_site)
     AND t.etat IN ('DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED')
),
lignes AS (
  SELECT 'camion'::text AS dimension, b.vehicle_id::text AS cle,
         coalesce(v.registration, 'Camion non renseigne') AS libelle,
         b.tonnes, b.tonnes_validees, b.valide
    FROM base b LEFT JOIN public.vehicles v ON v.id = b.vehicle_id
  UNION ALL
  SELECT 'chauffeur', b.driver_id::text,
         coalesce(d.name, 'Chauffeur non renseigne'),
         b.tonnes, b.tonnes_validees, b.valide
    FROM base b LEFT JOIN public.drivers d ON d.id = b.driver_id
  UNION ALL
  SELECT 'contrat', b.contrat_id::text,
         coalesce(c.reference || ' - ' || c.intitule, 'Contrat non renseigne'),
         b.tonnes, b.tonnes_validees, b.valide
    FROM base b LEFT JOIN public.contrats c ON c.id = b.contrat_id
  UNION ALL
  SELECT 'destination', b.arrival_site_id::text,
         coalesce(sa.name, 'Destination non renseignee'),
         b.tonnes, b.tonnes_validees, b.valide
    FROM base b LEFT JOIN public.sites sa ON sa.id = b.arrival_site_id
  UNION ALL
  SELECT 'jour', to_char(b.jour, 'YYYY-MM-DD'),
         to_char(b.jour, 'DD/MM/YYYY'),
         b.tonnes, b.tonnes_validees, b.valide
    FROM base b
  UNION ALL
  SELECT 'shift', b.shift_id::text,
         coalesce(ws.display_name, 'Shift non renseigne'),
         b.tonnes, b.tonnes_validees, b.valide
    FROM base b LEFT JOIN public.work_shifts ws ON ws.id = b.shift_id
  UNION ALL
  SELECT 'site', b.departure_site_id::text,
         coalesce(sd.name, 'Site non renseigne'),
         b.tonnes, b.tonnes_validees, b.valide
    FROM base b LEFT JOIN public.sites sd ON sd.id = b.departure_site_id
  UNION ALL
  SELECT 'total', 'total', 'Tout le perimetre',
         b.tonnes, b.tonnes_validees, b.valide
    FROM base b
)
SELECT l.dimension, l.cle, l.libelle,
       sum(l.tonnes) FILTER (WHERE NOT l.valide) AS tonnes_provisoires,
       sum(l.tonnes_validees) FILTER (WHERE l.valide) AS tonnes_validees,
       sum(l.tonnes) AS tonnes_livrees,
       count(*)::integer AS voyages,
       count(*) FILTER (WHERE l.valide)::integer AS voyages_valides,
       count(*) FILTER (WHERE l.tonnes IS NULL)::integer AS voyages_sans_poids,
       'trips (etats livre, accepte, cloture, en litige, rejete) ; tonnage accepte, sinon net de reception, sinon net, sinon charge'::text AS source,
       CASE
         WHEN count(*) = 0 THEN 'sans_donnees'
         WHEN count(*) FILTER (WHERE l.tonnes IS NULL) = count(*) THEN 'sans_donnees'
         WHEN count(*) FILTER (WHERE l.tonnes IS NULL) > 0 THEN 'partielle'
         ELSE 'mesure'
       END::text AS fiabilite,
       p_debut, p_fin,
       concat_ws(' ; ',
         count(*) FILTER (WHERE l.tonnes IS NULL) || ' voyage(s) sans poids',
         count(*) FILTER (WHERE l.valide) || ' voyage(s) valide(s)',
         count(*) FILTER (WHERE NOT l.valide) || ' voyage(s) provisoire(s)'
       ) AS detail
  FROM lignes l
 GROUP BY l.dimension, l.cle, l.libelle
 ORDER BY l.dimension, l.libelle;
$fn$;

REVOKE EXECUTE ON FUNCTION public.consolidation_production(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consolidation_production(date, date, uuid) TO authenticated;

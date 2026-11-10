/*
  Purge des donnees de DEMONSTRATION SIGTB (D-020).
  Supprime uniquement les lignes dont l'identifiant commence par
  `dec0de00-`, puis retire le signal (plus de bandeau).
  Si une donnee reelle a ete rattachee a un element de demonstration (par
  exemple un plein saisi sur un camion de demo), la suppression echoue
  sur la cle etrangere et rien n'est supprime : la transaction est annulee.
  Execution : psql -v ON_ERROR_STOP=1 -1 -f purger.sql (supabase_admin).
*/

DELETE FROM public.vehicle_tracking   WHERE id::text LIKE 'dec0de00-%';
DELETE FROM public.alerts             WHERE id::text LIKE 'dec0de00-%';
DELETE FROM public.maintenance_orders WHERE id::text LIKE 'dec0de00-%';
DELETE FROM public.fuel_stocks        WHERE id::text LIKE 'dec0de00-%';
DELETE FROM public.fuel_transactions  WHERE id::text LIKE 'dec0de00-%';
DELETE FROM public.trip_events        WHERE trip_id::text LIKE 'dec0de00-%';
DELETE FROM public.trips              WHERE id::text LIKE 'dec0de00-%';
DELETE FROM public.drivers            WHERE id::text LIKE 'dec0de00-%';
DELETE FROM public.vehicles           WHERE id::text LIKE 'dec0de00-%';
DELETE FROM public.work_shifts        WHERE id::text LIKE 'dec0de00-%';
DELETE FROM public.sites              WHERE id::text LIKE 'dec0de00-%';

UPDATE public.sigtb_demonstration SET active = false WHERE id = 1;

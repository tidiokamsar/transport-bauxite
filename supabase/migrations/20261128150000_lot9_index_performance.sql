/*
  # Lot 9 (D-127) : index de performance des chaines integrees

  Index additifs uniquement (IF NOT EXISTS, aucune colonne ni donnee
  modifiee) pour les lectures introduites par les lots 3 a 8 : dossiers de
  rotation et de pesee, consolidation par camion/site/jour, situation
  maintenance, creances et tracabilite.

  Les index deja presents (trips.planned_date, trip_events(trip_id,
  survenu_le), releves_compteur(trip_id), rapprochements_pesee(trip_id),
  pieces_jointes(objet_type, objet_id), interventions_loueur(vehicle_id,
  demande_le), pneus_operations(vehicle_id), mouvements_carburant(stockage_id,
  date_mouvement)) ne sont pas dupliques.
*/
CREATE INDEX IF NOT EXISTS idx_trips_site_date ON public.trips (departure_site_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_date ON public.trips (vehicle_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_trips_driver_date ON public.trips (driver_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_trips_arrival_date ON public.trips (arrival_site_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_incidents_trip ON public.incidents (trip_id);
CREATE INDEX IF NOT EXISTS idx_incidents_vehicle_time ON public.incidents (vehicle_id, incident_time);
CREATE INDEX IF NOT EXISTS idx_immobilisations_vehicle_debut ON public.immobilisations (vehicle_id, debut);
CREATE INDEX IF NOT EXISTS idx_factures_contrat ON public.factures (contrat_id);
CREATE INDEX IF NOT EXISTS idx_encaissements_facture ON public.encaissements (facture_id);
CREATE INDEX IF NOT EXISTS idx_costs_vehicle_date ON public.costs (vehicle_id, date);
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_vehicle_date ON public.fuel_transactions (vehicle_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_releves_cbg_periode ON public.releves_cbg (periode_debut, periode_fin);
CREATE INDEX IF NOT EXISTS idx_rapprochements_pesee_cree ON public.rapprochements_pesee (cree_le);
CREATE INDEX IF NOT EXISTS idx_anomalies_pesee_cree ON public.anomalies_pesee (cree_le);

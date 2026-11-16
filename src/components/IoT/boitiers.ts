// Colonnes de `iot_devices` lisibles depuis le navigateur (D-071). La cle
// d'authentification du boitier (`api_key`) n'est lisible que par la fonction
// Edge d'ingestion : un `select('*')` serait refuse par le serveur.
export const COLONNES_BOITIER =
  'id, device_id, device_type, manufacturer, model, vehicle_id, installation_date, status, configuration, created_at, updated_at';

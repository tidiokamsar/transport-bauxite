import { createClient } from 'npm:@supabase/supabase-js@2';

// Reception des boitiers IoT (GPS, jauge carburant, telemetrie brute).
// Ordre des controles : route, identifiant et cle du boitier (en-tetes),
// boitier actif connu, puis seulement lecture et validation du corps.
// Reponses : 401 sans identifiant ou cle, 403 boitier inconnu ou inactif,
// 400 corps absent ou invalide, 404 route inconnue, 500 erreur serveur.
// L'heure retenue est celle du serveur (CDC 15) : l'horodatage du boitier
// est conserve dans la telemetrie brute, pas utilise pour la fraicheur.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Id, X-Api-Key',
};

const reponse = (status: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return reponse(405, { erreur: 'Méthode non autorisée : POST attendu' });

  const chemin = new URL(req.url).pathname;
  const route = chemin.endsWith('/gps') ? 'gps' : chemin.endsWith('/fuel') ? 'fuel' : chemin.endsWith('/telemetry') ? 'telemetry' : null;
  if (!route) return reponse(404, { erreur: 'Route inconnue : /gps, /fuel ou /telemetry' });

  const boitier = req.headers.get('X-Device-Id')?.trim();
  const cle = req.headers.get('X-Api-Key')?.trim();
  if (!boitier || !cle) return reponse(401, { erreur: 'En-têtes X-Device-Id et X-Api-Key requis' });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: appareil, error: erreurAppareil } = await supabase
      .from('iot_devices')
      .select('device_id, status')
      .eq('device_id', boitier)
      .eq('api_key', cle)
      .maybeSingle();
    if (erreurAppareil) throw erreurAppareil;
    if (!appareil || appareil.status !== 'active') return reponse(403, { erreur: 'Boîtier inconnu, clé invalide ou boîtier inactif' });

    let corps: Record<string, unknown>;
    try {
      const lu = await req.json();
      if (!lu || typeof lu !== 'object' || Array.isArray(lu)) return reponse(400, { erreur: 'Corps JSON objet attendu' });
      corps = lu as Record<string, unknown>;
    } catch {
      return reponse(400, { erreur: 'Corps absent ou JSON invalide' });
    }

    if (route === 'gps') {
      const latitude = nombre(corps.latitude);
      const longitude = nombre(corps.longitude);
      if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return reponse(400, { erreur: 'latitude et longitude numériques et valides requises' });
      }
      const { data, error } = await supabase.rpc('ingest_gps_data', {
        p_device_id: boitier, p_latitude: latitude, p_longitude: longitude,
        p_speed: nombre(corps.speed), p_heading: nombre(corps.heading), p_odometer: nombre(corps.odometer),
      });
      if (error) throw error;
      return reponse(200, { ok: true, lecture: data });
    }

    if (route === 'fuel') {
      const niveau = nombre(corps.fuel_level);
      if (niveau === null || niveau < 0) return reponse(400, { erreur: 'fuel_level (litres) numérique et positif requis' });
      const { data, error } = await supabase.rpc('ingest_fuel_data', {
        p_device_id: boitier, p_fuel_level: niveau, p_tank_capacity: nombre(corps.tank_capacity),
        p_latitude: nombre(corps.latitude), p_longitude: nombre(corps.longitude),
      });
      if (error) throw error;
      return reponse(200, { ok: true, lecture: data });
    }

    const { error } = await supabase.from('iot_telemetry_raw').insert({
      device_id: boitier,
      message_type: typeof corps.type === 'string' ? corps.type : 'inconnu',
      payload: corps,
      protocol: 'http',
    });
    if (error) throw error;
    return reponse(200, { ok: true });
  } catch (erreur) {
    console.error('iot-ingestion :', erreur instanceof Error ? erreur.message : erreur);
    return reponse(500, { erreur: 'Erreur serveur' });
  }
});

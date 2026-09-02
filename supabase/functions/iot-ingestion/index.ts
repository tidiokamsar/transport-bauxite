import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Device-Id, X-Api-Key',
};

interface GPSData {
  device_id: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  odometer?: number;
  timestamp?: string;
}

interface FuelData {
  device_id: string;
  fuel_level: number;
  tank_capacity?: number;
  latitude?: number;
  longitude?: number;
  timestamp?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname;

    // Route GPS
    if (path.includes('/gps')) {
      const data: GPSData = await req.json();

      // Valider API key
      const apiKey = req.headers.get('X-Api-Key');
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'API key required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Vérifier device existe
      const { data: device } = await supabase
        .from('iot_devices')
        .select('*')
        .eq('device_id', data.device_id)
        .eq('api_key', apiKey)
        .single();

      if (!device) {
        return new Response(
          JSON.stringify({ error: 'Invalid device or API key' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insérer données GPS
      const { data: reading, error } = await supabase.rpc('ingest_gps_data', {
        p_device_id: data.device_id,
        p_latitude: data.latitude,
        p_longitude: data.longitude,
        p_speed: data.speed || null,
        p_heading: data.heading || null,
        p_odometer: data.odometer || null
      });

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({
          success: true,
          reading_id: reading,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route Fuel
    if (path.includes('/fuel')) {
      const data: FuelData = await req.json();

      const apiKey = req.headers.get('X-Api-Key');
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'API key required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: device } = await supabase
        .from('iot_devices')
        .select('*')
        .eq('device_id', data.device_id)
        .eq('api_key', apiKey)
        .single();

      if (!device) {
        return new Response(
          JSON.stringify({ error: 'Invalid device or API key' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insérer données carburant
      const { data: reading, error } = await supabase.rpc('ingest_fuel_data', {
        p_device_id: data.device_id,
        p_fuel_level: data.fuel_level,
        p_tank_capacity: data.tank_capacity || 400,
        p_latitude: data.latitude || null,
        p_longitude: data.longitude || null
      });

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({
          success: true,
          reading_id: reading,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route Telemetry (générique)
    if (path.includes('/telemetry')) {
      const payload = await req.json();
      const deviceId = req.headers.get('X-Device-Id');

      if (!deviceId) {
        return new Response(
          JSON.stringify({ error: 'Device ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Stocker en télémétrie brute
      const { error } = await supabase
        .from('iot_telemetry_raw')
        .insert({
          device_id: deviceId,
          message_type: payload.type || 'unknown',
          payload: payload,
          protocol: 'http',
          processed: false
        });

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Telemetry received' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route non trouvée
    return new Response(
      JSON.stringify({ error: 'Route not found. Use /gps, /fuel, or /telemetry' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

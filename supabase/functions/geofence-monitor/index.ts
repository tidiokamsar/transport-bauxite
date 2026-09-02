import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GeofenceZone {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  zone_type: string;
  is_active: boolean;
}

interface VehiclePosition {
  vehicle_id: string;
  registration_number: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  timestamp: string;
  trip_id?: string;
  driver_id?: string;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isVehicleInZone(vehicle: VehiclePosition, zone: GeofenceZone): boolean {
  const distance = calculateDistance(
    vehicle.latitude,
    vehicle.longitude,
    zone.center_lat,
    zone.center_lng
  );
  return distance <= zone.radius_meters;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: zones, error: zonesError } = await supabase
      .from('geofence_zones')
      .select('*')
      .eq('is_active', true);

    if (zonesError) throw zonesError;

    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, registration_number')
      .eq('gps_device_active', true);

    if (vehiclesError) throw vehiclesError;

    const alerts = [];
    const violations = [];

    for (const vehicle of vehicles) {
      const { data: gpsData } = await supabase
        .from('iot_gps_readings')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('reading_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!gpsData) continue;

      const { data: tripData } = await supabase
        .from('trips')
        .select('id, driver_id')
        .eq('vehicle_id', vehicle.id)
        .eq('status', 'in_progress')
        .maybeSingle();

      const vehiclePosition: VehiclePosition = {
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        latitude: parseFloat(gpsData.latitude),
        longitude: parseFloat(gpsData.longitude),
        speed_kmh: parseFloat(gpsData.speed_kmh || '0'),
        timestamp: gpsData.reading_timestamp,
        trip_id: tripData?.id,
        driver_id: tripData?.driver_id,
      };

      const { data: assignments } = await supabase
        .from('geofence_zone_assignments')
        .select('zone_id, access_type')
        .eq('vehicle_id', vehicle.id)
        .eq('access_type', 'allowed');

      const authorizedZoneIds = new Set(assignments?.map(a => a.zone_id) || []);
      const authorizedZones = zones.filter((z: GeofenceZone) => authorizedZoneIds.has(z.id));

      let inAuthorizedZone = false;
      for (const zone of authorizedZones) {
        if (isVehicleInZone(vehiclePosition, zone)) {
          inAuthorizedZone = true;
          break;
        }
      }

      if (!inAuthorizedZone && authorizedZones.length > 0) {
        const { data: existingViolation } = await supabase
          .from('geofence_violations')
          .select('id')
          .eq('vehicle_id', vehicle.id)
          .eq('violation_type', 'unauthorized_exit')
          .in('status', ['open', 'acknowledged'])
          .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existingViolation) {
          const mineZone = zones.find((z: GeofenceZone) => z.zone_type === 'mine');

          if (mineZone) {
            const { data: violation } = await supabase
              .from('geofence_violations')
              .insert({
                zone_id: mineZone.id,
                vehicle_id: vehicle.id,
                driver_id: vehiclePosition.driver_id,
                trip_id: vehiclePosition.trip_id,
                violation_type: 'unauthorized_exit',
                severity: 'high',
                entry_time: vehiclePosition.timestamp,
                latitude: vehiclePosition.latitude,
                longitude: vehiclePosition.longitude,
                speed_kmh: vehiclePosition.speed_kmh,
                description: `Véhicule ${vehicle.registration_number} détecté hors de toutes les zones autorisées`,
                status: 'open',
              })
              .select()
              .single();

            if (violation) {
              violations.push(violation);

              const { data: alert } = await supabase
                .from('geofence_alerts')
                .insert({
                  violation_id: violation.id,
                  zone_id: mineZone.id,
                  vehicle_id: vehicle.id,
                  alert_type: 'exit',
                  priority: 'urgent',
                  message: `🚨 ALERTE: Véhicule ${vehicle.registration_number} hors zone autorisée! Position: ${vehiclePosition.latitude.toFixed(4)}, ${vehiclePosition.longitude.toFixed(4)}`,
                  notification_sent: false,
                })
                .select()
                .single();

              if (alert) alerts.push(alert);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        monitored_vehicles: vehicles.length,
        violations_created: violations.length,
        alerts_created: alerts.length,
        violations,
        alerts,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in geofence monitor:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
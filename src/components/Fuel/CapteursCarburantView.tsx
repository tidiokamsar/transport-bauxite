import { useCallback, useEffect, useState } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre, FRAICHEUR_POSITION_MINUTES } from '../Dashboard/indicateurs';

// Jauges carburant connectees (D-030) : boitiers declares (iot_devices,
// type fuel_sensor) et derniere lecture recue. Sans lecture : « sans
// donnees » ; une lecture ancienne n'est jamais presentee comme en direct
// (CDC 15) ; pourcentage seulement si le boitier a transmis la capacite.

interface Capteur {
  device_id: string;
  vehicle_id: string | null;
  registration: string;
  lecture: { fuel_level_liters: number; fuel_level_percentage: number | null; tank_capacity_liters: number | null; reading_timestamp: string } | null;
  conso24h: number | null;
}

const age = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60_000);

export const CapteursCarburantView = () => {
  const [capteurs, setCapteurs] = useState<Capteur[] | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const { data: boitiers } = await supabase.from('iot_devices')
      .select('device_id, vehicle_id, vehicles(registration)').eq('device_type', 'fuel_sensor').eq('status', 'active');
    const liste = await Promise.all(((boitiers ?? []) as unknown as { device_id: string; vehicle_id: string | null; vehicles: { registration: string } | null }[]).map(async (b) => {
      const { data: l } = await supabase.from('iot_fuel_readings')
        .select('fuel_level_liters, fuel_level_percentage, tank_capacity_liters, reading_timestamp')
        .eq('device_id', b.device_id).order('reading_timestamp', { ascending: false }).limit(1).maybeSingle();
      const { data: serie } = await supabase.from('iot_fuel_readings').select('fuel_level_liters, reading_timestamp')
        .eq('device_id', b.device_id).gte('reading_timestamp', new Date(Date.now() - 24 * 3_600_000).toISOString())
        .order('reading_timestamp', { ascending: true });
      let conso: number | null = null;
      const s = (serie ?? []) as { fuel_level_liters: number; reading_timestamp: string }[];
      if (s.length > 1) {
        const h = (new Date(s[s.length - 1].reading_timestamp).getTime() - new Date(s[0].reading_timestamp).getTime()) / 3_600_000;
        const baisse = Number(s[0].fuel_level_liters) - Number(s[s.length - 1].fuel_level_liters);
        conso = h > 0 && baisse >= 0 ? baisse / h : null;
      }
      return { device_id: b.device_id, vehicle_id: b.vehicle_id, registration: b.vehicles?.registration ?? 'Boîtier non affecté', lecture: l as Capteur['lecture'], conso24h: conso };
    }));
    setCapteurs(liste);
    setHeure(new Date());
  }, []);

  useEffect(() => {
    charger();
    const minuterie = window.setInterval(charger, 60_000);
    return () => window.clearInterval(minuterie);
  }, [charger]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Jauges carburant</h2>
          <p className="text-stone-500">Dernière lecture des boîtiers connectés, avec son âge</p>
        </div>
        <button onClick={charger} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
      <Panneau titre="Boîtiers">
        {capteurs === null ? (
          <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
        ) : capteurs.length === 0 ? (
          <SansDonnees message="Aucun boîtier de jauge déclaré" detail="Les jauges apparaissent ici une fois déclarées (iot_devices, type fuel_sensor) et reliées à la réception IoT." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {capteurs.map((c) => {
              const minutes = c.lecture ? age(c.lecture.reading_timestamp) : null;
              const enDirect = minutes !== null && minutes <= FRAICHEUR_POSITION_MINUTES;
              return (
                <article key={c.device_id} className="rounded-xl border border-stone-200 p-4" aria-label={`Jauge ${c.registration}`}>
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 font-bold text-stone-900"><Gauge className="h-4 w-4 text-orange-600" /> {c.registration}</p>
                    <Puce teinte={!c.lecture ? 'gris' : enDirect ? 'vert' : 'orange'}>{!c.lecture ? 'Sans données' : enDirect ? 'En direct' : `Il y a ${minutes} min`}</Puce>
                  </div>
                  {c.lecture ? (
                    <>
                      <p className="mt-2 text-3xl font-black text-stone-900">{formatNombre(Number(c.lecture.fuel_level_liters))} L</p>
                      <p className="text-sm text-stone-500">
                        {c.lecture.fuel_level_percentage !== null ? `${formatNombre(Number(c.lecture.fuel_level_percentage))} % du réservoir` : 'Capacité du réservoir non transmise'}
                      </p>
                      <p className="text-sm text-stone-500">Baisse sur 24 h : {c.conso24h !== null ? `${formatNombre(c.conso24h, 1)} L/h` : 'non calculable'}</p>
                      <p className="text-xs text-stone-400">Lecture du {new Date(c.lecture.reading_timestamp).toLocaleString('fr-FR')} · boîtier {c.device_id}</p>
                    </>
                  ) : <p className="mt-2 text-sm text-stone-500">Aucune lecture reçue du boîtier {c.device_id}.</p>}
                </article>
              );
            })}
          </div>
        )}
        <Provenance source={`lectures des jauges reçues par la réception IoT ; « en direct » si moins de ${FRAICHEUR_POSITION_MINUTES} min`} heure={heure} />
      </Panneau>
    </div>
  );
};

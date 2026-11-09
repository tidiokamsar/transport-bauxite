import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';

// Carte de la flotte : seules les positions recues depuis moins de
// FRAICHEUR_POSITION_MINUTES sont affichees (CDC 15). Sans position, la
// carte reste centree sur la zone d'exploitation de reference.

// Zone de reference d'affichage (monts Nimba, D-011). Ce n'est pas une
// donnee : seulement le cadrage initial de la carte.
const CENTRE_NIMBA: [number, number] = [7.62, -8.42];

export interface PositionAffichee {
  vehiculeId: string;
  immatriculation: string;
  latitude: number;
  longitude: number;
  horodatage: string;
  vitesse: number | null;
  couleur: string;
}

const Cadrer = ({ positions }: { positions: PositionAffichee[] }) => {
  const carte = useMap();
  useEffect(() => {
    if (positions.length === 1) carte.setView([positions[0].latitude, positions[0].longitude], 12);
    else if (positions.length > 1) {
      carte.fitBounds(positions.map((p) => [p.latitude, p.longitude] as [number, number]), { padding: [30, 30] });
    }
  }, [carte, positions]);
  return null;
};

export const CarteFlotte = ({ positions }: { positions: PositionAffichee[] }) => (
  <MapContainer center={CENTRE_NIMBA} zoom={9} scrollWheelZoom={false} className="h-full w-full rounded-xl" attributionControl>
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    {positions.map((p) => (
      <CircleMarker
        key={p.vehiculeId}
        center={[p.latitude, p.longitude]}
        radius={9}
        pathOptions={{ color: '#ffffff', weight: 2, fillColor: p.couleur, fillOpacity: 1 }}
      >
        <Tooltip>
          {p.immatriculation} · {new Date(p.horodatage).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          {p.vitesse !== null ? ` · ${p.vitesse} km/h` : ''}
        </Tooltip>
      </CircleMarker>
    ))}
    <Cadrer positions={positions} />
  </MapContainer>
);

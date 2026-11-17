import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { ETATS, estEtat } from '../Trips/cycle';
import { FRAICHEUR_POSITION_MINUTES } from '../Dashboard/indicateurs';
import { fraicheur, libelleAnciennete } from './controle';

// Supervision (D-087) : derniere transmission par voyage non termine, avec
// son anciennete et sa source (GPS ou evenement declare). Une position
// ancienne n'est jamais presentee comme en direct (CDC 15) : la carte ne
// montre que les positions de moins de FRAICHEUR_POSITION_MINUTES, et
// seulement s'il en existe. Aucun materiel GPS nouveau (extension a
// declencheur) : sans traceur, la source est l'evenement declare.

const CarteFlotte = lazy(() => import('../Dashboard/CarteFlotte').then((m) => ({ default: m.CarteFlotte })));

export interface LigneSupervision {
  trip_id: string;
  reference: string;
  etat: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  suspendu: boolean;
  position_le: string | null;
  latitude: number | null;
  longitude: number | null;
  evenement_le: string | null;
  dernier_evenement: string | null;
  transmission_le: string | null;
  source: 'gps' | 'evenement' | null;
  anciennete_min: number | null;
  depuis_etat_min: number | null;
  incidents: number;
}

export const SupervisionDispatch = ({
  date, site, shift, actualisation, camion, chauffeur,
}: {
  date: string;
  site: string;
  shift: string;
  actualisation: number;
  camion: (id: string | null) => string;
  chauffeur: (id: string | null) => string;
}) => {
  const [lignes, setLignes] = useState<LigneSupervision[] | null>(null);
  const [perte, setPerte] = useState('');
  const derniereLecture = useRef<Date | null>(null);

  useEffect(() => {
    let actif = true;
    supabase.rpc('supervision_dispatch', { p_date: date, p_site_id: site, p_shift_id: shift }).then(({ data, error }) => {
      if (!actif) return;
      if (error) {
        // Perte de connexion ou refus : les dernieres donnees restent
        // affichees, explicitement datees, jamais comme actuelles.
        const h = derniereLecture.current;
        setPerte(`Liaison perdue (${error.message}). ${h ? `Données de ${h.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}, non actualisées.` : 'Aucune donnée lue.'}`);
        setLignes((x) => x ?? []);
        return;
      }
      setPerte('');
      derniereLecture.current = new Date();
      setLignes(Array.isArray(data) ? (data as LigneSupervision[]) : []);
    });
    return () => { actif = false; };
  }, [date, site, shift, actualisation]);

  const recentes = (lignes ?? []).filter((l) => l.source === 'gps' && l.latitude !== null && l.longitude !== null
    && fraicheur(l.position_le ? (Date.now() - new Date(l.position_le).getTime()) / 60000 : null) === 'recente');
  const avecPosition = (lignes ?? []).some((l) => l.position_le !== null);

  return (
    <Panneau titre="Supervision des voyages en cours">
      {perte && <p className="mb-3 rounded-lg bg-orange-50 p-3 text-sm font-medium text-orange-800" aria-live="polite">{perte}</p>}
      {lignes === null ? <p className="text-sm text-stone-500">Lecture…</p> : lignes.length === 0 ? (
        <SansDonnees message="Aucun voyage en cours" detail="Les voyages non terminés du shift apparaîtront ici avec leur dernière transmission." />
      ) : (
        <>
          {recentes.length > 0 && (
            <div className="mb-3 h-72">
              <Suspense fallback={null}>
                <CarteFlotte positions={recentes.map((l) => ({
                  vehiculeId: l.vehicle_id ?? l.trip_id, immatriculation: camion(l.vehicle_id), latitude: Number(l.latitude), longitude: Number(l.longitude),
                  horodatage: l.position_le ?? '', vitesse: null, couleur: '#ea580c',
                }))} />
              </Suspense>
            </div>
          )}
          {avecPosition && recentes.length === 0 && (
            <p className="mb-3 text-sm text-stone-600">Positions GPS toutes de plus de {FRAICHEUR_POSITION_MINUTES} min : carte non affichée.</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Supervision">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-2 pr-3 font-medium">Voyage</th>
                  <th className="py-2 pr-3 font-medium">Statut</th>
                  <th className="py-2 pr-3 font-medium">Camion · chauffeur</th>
                  <th className="py-2 pr-3 font-medium">Dernière transmission</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 font-medium">Alertes</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const f = fraicheur(l.anciennete_min);
                  const alertes = [
                    ...(l.suspendu ? ['suspendu'] : []),
                    ...(f === 'ancienne' ? [`transmission ancienne (${libelleAnciennete(l.anciennete_min)})`] : []),
                    ...(f === 'aucune' ? ['aucune transmission'] : []),
                    ...(l.incidents > 0 ? [`${l.incidents} incident(s)`] : []),
                    ...(l.etat === 'INTERRUPTED' ? ['interrompu'] : []),
                  ];
                  return (
                    <tr key={l.trip_id} className="border-b border-stone-100 align-top last:border-0">
                      <td className="py-2 pr-3 font-semibold text-stone-900">{l.reference}</td>
                      <td className="py-2 pr-3">{estEtat(l.etat) ? ETATS[l.etat].libelle : l.etat ?? '—'}
                        {l.depuis_etat_min !== null && <span className="block text-xs text-stone-500">depuis {libelleAnciennete(l.depuis_etat_min).replace('il y a ', '')}</span>}
                      </td>
                      <td className="py-2 pr-3 text-stone-700">{camion(l.vehicle_id)} · {chauffeur(l.driver_id)}</td>
                      <td className="py-2 pr-3">
                        {l.transmission_le ? new Date(l.transmission_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        <span className="block text-xs text-stone-500">{libelleAnciennete(l.anciennete_min)}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {l.source === 'gps' ? <Puce teinte={f === 'recente' ? 'vert' : 'gris'}>{f === 'recente' ? 'GPS récent' : 'GPS ancien'}</Puce>
                          : l.source === 'evenement' ? <Puce teinte="bleu">Événement déclaré</Puce> : <Puce teinte="gris">Aucune</Puce>}
                        {l.dernier_evenement && <span className="block text-xs text-stone-500">{estEtat(l.dernier_evenement) ? ETATS[l.dernier_evenement].libelle : l.dernier_evenement}</span>}
                      </td>
                      <td className="py-2 text-xs">{alertes.length === 0 ? <span className="text-stone-400">—</span> : alertes.map((a) => <span key={a} className="mr-1 inline-block rounded bg-orange-50 px-1.5 py-0.5 font-medium text-orange-800">{a}</span>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="mt-2 text-xs text-stone-500">Source : supervision_dispatch (positions GPS lues avec le droit de suivi, sinon dernier événement déclaré au journal du voyage). Une position de plus de {FRAICHEUR_POSITION_MINUTES} min n'est jamais présentée comme en direct.</p>
    </Panneau>
  );
};

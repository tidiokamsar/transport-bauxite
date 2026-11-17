import { useState } from 'react';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { ETATS, PHASES, estEtat, phaseDe } from '../Trips/cycle';
import { FicheVoyage } from '../Trips/FicheVoyage';
import type { Voyage } from '../Trips/types';
import { VUES_VOYAGES, dansVue, type VueVoyages } from './controle';
import { FenetreSuspension } from './FenetreSuspension';

// Voyages du shift par etat (D-087) : vues sur le cycle trips.etat existant
// (trips_garde_cycle inchangee), plus suspendus (suspensions_voyage) et a
// reaffecter (ressource indisponible). La fiche du voyage (transitions,
// ticket CBG, incident, enchainement apres dechargement) est celle de
// l'ecran Voyages, reutilisee telle quelle.

export const VoyagesParEtat = ({
  voyages, vue, setVue, suspendus, aReaffecter, peutEcrire, libelle, onModifie,
}: {
  voyages: Voyage[];
  vue: VueVoyages | 'tous';
  setVue: (v: VueVoyages | 'tous') => void;
  suspendus: Set<string>;
  aReaffecter: Set<string>;
  peutEcrire: boolean;
  libelle: (v: Voyage) => { camion: string; chauffeur: string; chargeuse: string; origine: string; destination: string; shift: string };
  onModifie: () => void;
}) => {
  const [fiche, setFiche] = useState<Voyage | null>(null);
  const [suspension, setSuspension] = useState<{ mode: 'suspendre' | 'reprendre'; voyage: Voyage } | null>(null);
  const liste = voyages.filter((v) => dansVue(vue, v, suspendus, aReaffecter));
  const compte = (c: VueVoyages) => voyages.filter((v) => dansVue(c, v, suspendus, aReaffecter)).length;
  const terminal = (e: string | null) => ['DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'CANCELLED', 'REJECTED'].includes(e ?? '');

  return (
    <Panneau titre="Voyages du shift par état">
      <div role="tablist" aria-label="Vues des voyages" className="mb-3 flex flex-wrap gap-1.5">
        <button role="tab" aria-selected={vue === 'tous'} onClick={() => setVue('tous')}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${vue === 'tous' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`}>Tous ({voyages.length})</button>
        {VUES_VOYAGES.map((x) => (
          <button key={x.cle} role="tab" aria-selected={vue === x.cle} onClick={() => setVue(x.cle)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${vue === x.cle ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`}>
            {x.libelle} ({compte(x.cle)})
          </button>
        ))}
      </div>
      {liste.length === 0 ? <SansDonnees message="Aucun voyage dans cette vue" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Voyages par état">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-3 font-medium">Voyage</th>
                <th className="py-2 pr-3 font-medium">État</th>
                <th className="py-2 pr-3 font-medium">Camion · chauffeur</th>
                <th className="py-2 pr-3 font-medium">Destination</th>
                {peutEcrire && <th className="py-2 font-medium">Action</th>}
              </tr>
            </thead>
            <tbody>
              {liste.map((v) => {
                const l = libelle(v);
                const suspendu = suspendus.has(v.id);
                return (
                  <tr key={v.id} className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50" onClick={() => setFiche(v)}>
                    <td className="py-2 pr-3 font-semibold text-stone-900">{v.reference}</td>
                    <td className="py-2 pr-3">
                      <Puce teinte={PHASES[phaseDe(v.etat)].teinte}>{estEtat(v.etat) ? ETATS[v.etat].libelle : v.etat ?? '—'}</Puce>
                      {suspendu && <span className="ml-1"><Puce teinte="rouge">Suspendu</Puce></span>}
                      {aReaffecter.has(v.id) && <span className="ml-1"><Puce teinte="orange">À réaffecter</Puce></span>}
                    </td>
                    <td className="py-2 pr-3 text-stone-700">{l.camion} · {l.chauffeur}</td>
                    <td className="py-2 pr-3 text-stone-700">{l.destination}</td>
                    {peutEcrire && (
                      <td className="py-2" onClick={(e) => e.stopPropagation()}>
                        {!terminal(v.etat) && (
                          <button type="button" onClick={() => setSuspension({ mode: suspendu ? 'reprendre' : 'suspendre', voyage: v })}
                            className="rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800 hover:bg-orange-100" aria-label={`${suspendu ? 'Reprendre' : 'Suspendre'} ${v.reference}`}>
                            {suspendu ? 'Reprendre' : 'Suspendre'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {fiche && (
        <FicheVoyage voyage={fiche} libelles={libelle(fiche)} peutEcrire={peutEcrire && !suspendus.has(fiche.id)}
          onFermer={() => setFiche(null)} onModifie={() => { setFiche(null); onModifie(); }} />
      )}
      {suspension && (
        <FenetreSuspension mode={suspension.mode} voyageId={suspension.voyage.id} reference={suspension.voyage.reference}
          onFermer={() => setSuspension(null)} onFait={() => { setSuspension(null); onModifie(); }} />
      )}
    </Panneau>
  );
};

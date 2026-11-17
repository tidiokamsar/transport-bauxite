import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatNombre } from '../Dashboard/indicateurs';
import { VUE_DU_FILTRE, type VueVoyages } from './controle';

// Tableau de bord du Dispatch (D-087) : indicateurs calcules par
// indicateurs_dispatch (SECURITY INVOKER, droits et perimetre de l'appelant).
// Chaque tuile porte sa source et l'heure du calcul ; une valeur absente
// s'affiche « sans données » ; un clic ouvre la liste filtree.

export interface Indicateur {
  code: string;
  libelle: string;
  valeur: number | null;
  unite: string;
  source: string;
  filtre: string;
  calcule_le: string;
}

const GROUPES: { titre: string; codes: string[] }[] = [
  { titre: 'Voyages', codes: ['voyages_planifies', 'voyages_crees', 'voyages_a_affecter', 'voyages_affectes', 'voyages_engages', 'voyages_en_cours', 'voyages_termines', 'voyages_suspendus', 'voyages_annules', 'voyages_a_reaffecter', 'anomalies'] },
  { titre: 'Ressources', codes: ['camions_disponibles', 'camions_en_mission', 'camions_en_attente', 'camions_immobilises', 'camions_liberes', 'chauffeurs_disponibles', 'chargement_disponible'] },
  { titre: 'Production et temps', codes: ['tonnes_planifiees', 'tonnes_transportees', 'tonnes_validees', 'cycle_moyen', 'attente_chargement', 'attente_depot'] },
];

export const TableauDeBordDispatch = ({
  date, site, shift, actualisation, onFiltre,
}: {
  date: string;
  site: string;
  shift: string;
  /** Change a chaque rechargement de l'ecran. */
  actualisation: number;
  onFiltre: (vue: VueVoyages | 'tous') => void;
}) => {
  const [indicateurs, setIndicateurs] = useState<Indicateur[] | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let actif = true;
    supabase.rpc('indicateurs_dispatch', { p_date: date, p_site_id: site, p_shift_id: shift }).then(({ data, error }) => {
      if (!actif) return;
      if (error) setErreur(`Indicateurs non calculés : ${error.message}`);
      else {
        setErreur('');
        setIndicateurs(Array.isArray(data) ? (data as Indicateur[]) : []);
      }
    });
    return () => { actif = false; };
  }, [date, site, shift, actualisation]);

  const parCode = new Map((indicateurs ?? []).map((i) => [i.code, i]));
  const heure = indicateurs?.[0]?.calcule_le
    ? new Date(indicateurs[0].calcule_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <section aria-label="Tableau de bord du dispatch" className="space-y-3">
      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {GROUPES.map((g) => (
        <div key={g.titre}>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">{g.titre}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {g.codes.map((code) => {
              const i = parCode.get(code);
              const vue = i ? VUE_DU_FILTRE[i.filtre] ?? 'tous' : 'tous';
              return (
                <button
                  key={code}
                  type="button"
                  disabled={!i}
                  onClick={() => onFiltre(vue)}
                  title={i ? `Source : ${i.source}` : undefined}
                  aria-label={i ? `${i.libelle} : ${i.valeur === null ? 'sans données' : `${formatNombre(Number(i.valeur))} ${i.unite}`}` : code}
                  className="rounded-xl border border-stone-200 bg-white p-3 text-left shadow-carte transition hover:border-orange-300 disabled:opacity-60"
                >
                  <span className="block text-xs text-stone-500">{i?.libelle ?? '…'}</span>
                  {i && i.valeur !== null
                    ? <span className="block text-xl font-black text-stone-900">{formatNombre(Number(i.valeur))} <span className="text-xs font-medium text-stone-500">{i.unite}</span></span>
                    : <span className="block text-sm font-semibold text-stone-400">{indicateurs === null ? '—' : 'Sans données'}</span>}
                  {i && <span className="mt-0.5 block truncate text-[11px] text-stone-400">{i.source}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-stone-500">
        Calcul serveur sur données réelles (indicateurs_dispatch){heure ? `, à ${heure}` : ''}. Tonnes validées : relevé officiel CBG rapproché (D-081) ; la pesée KOGON n'est jamais une pesée officielle.
      </p>
    </section>
  );
};

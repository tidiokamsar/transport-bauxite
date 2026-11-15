import { useEffect, useState } from 'react';
import { Calculator, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, SansDonnees } from '../ui/Panneau';
import type { Realisation } from './CarteObjectif';
import { CHAMP } from './FenetresObjectif';
import { grouperSimulation, scenarios, texteValeur, type LigneSimulation, type Scenario } from './planAvance';

// Simulation de capacite et scenarios de rattrapage (D-063) : le serveur
// calcule (simuler_objectif) a partir des seules donnees observees ou
// saisies, chaque hypothese avec sa source. Le systeme recommande ; un
// scenario retenu ouvre la revision de l'objectif (motif obligatoire).

type Instant = 'maintenant' | 'debut' | 'choisi';

export const SimulationObjectifs = ({ date, objectifs, libelle, peutEcrire, onRetenir }: {
  date: string;
  objectifs: Realisation[];
  libelle: (o: Realisation) => string;
  peutEcrire: boolean;
  onRetenir: (o: Realisation, s: Scenario) => void;
}) => {
  const [choix, setChoix] = useState('');
  const [instant, setInstant] = useState<Instant>('maintenant');
  const [heureChoisie, setHeureChoisie] = useState('12:00');
  const [lignes, setLignes] = useState<LigneSimulation[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [calculeLe, setCalculeLe] = useState<Date | null>(null);

  const objectif = objectifs.find((o) => o.id === choix) ?? objectifs[0];

  useEffect(() => {
    if (!objectif) return;
    let actif = true;
    // Debut de periode : minuit de la date, ramene par le serveur au debut du shift ou de la journee.
    const p_instant = instant === 'maintenant' ? null
      : new Date(`${date}T${instant === 'debut' ? '00:00' : heureChoisie}:00`).toISOString();
    setLignes(null);
    supabase.rpc('simuler_objectif', { p_objectif_id: objectif.id, p_instant }).then(({ data, error }) => {
      if (!actif) return;
      setErreur(error ? 'Simulation indisponible : ' + error.message : '');
      setLignes(error ? [] : ((data ?? []) as LigneSimulation[]));
      setCalculeLe(new Date());
    });
    return () => { actif = false; };
  }, [objectif, instant, heureChoisie, date]);

  if (objectifs.length === 0) {
    return <Panneau><SansDonnees message="Aucun objectif" detail="La simulation part d'un objectif de production actif pour cette date." /></Panneau>;
  }

  const proposes = lignes && objectif ? scenarios(lignes, Number(objectif.tonnes_cible)) : [];

  return (
    <div className="space-y-4">
      <Panneau titre={<span className="flex items-center gap-2"><Calculator className="h-5 w-5 text-orange-600" /> Simulation de capacité</span>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Objectif</span>
            <select value={objectif?.id ?? ''} onChange={(e) => setChoix(e.target.value)} className={CHAMP} aria-label="Objectif simulé">
              {objectifs.map((o) => <option key={o.id} value={o.id}>{libelle(o)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Instant</span>
            <select value={instant} onChange={(e) => setInstant(e.target.value as Instant)} className={CHAMP} aria-label="Instant de la simulation">
              <option value="maintenant">Maintenant (rattrapage)</option>
              <option value="debut">Début de la période (besoin initial)</option>
              <option value="choisi">Heure choisie</option>
            </select>
          </label>
          {instant === 'choisi' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-stone-700">Heure</span>
              <input type="time" value={heureChoisie} onChange={(e) => setHeureChoisie(e.target.value)} className={CHAMP} aria-label="Heure de la simulation" />
            </label>
          )}
        </div>
        {erreur && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
        {lignes === null ? (
          <p className="mt-4 text-sm text-stone-400">Calcul...</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {grouperSimulation(lignes).map((g) => (
              <section key={g.groupe} aria-label={`Simulation : ${g.groupe}`}>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">{g.groupe}</h3>
                <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                  {g.lignes.map((l) => (
                    <div key={l.code} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 text-sm">
                      <dt className="text-stone-700">{l.libelle}</dt>
                      <dd className={`text-right font-bold ${l.valeur === null ? 'text-stone-400' : 'text-stone-900'}`}>{texteValeur(l)}</dd>
                      <dd className="col-span-2 text-[11px] leading-tight text-stone-400">
                        {l.source}{l.remarque && !(l.valeur === null && l.remarque === 'Données insuffisantes') ? ` · ${l.remarque}` : ''}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        )}
        <Provenance
          source="simuler_objectif : voyages livrés, journal des voyages et départs réels des 14 jours précédents, engins actifs du site, capacités saisies des points de chargement ; aucune donnée modifiée"
          heure={calculeLe}
        />
      </Panneau>

      {lignes && lignes.length > 0 && (
        <Panneau titre="Scénarios de rattrapage">
          {proposes.length === 0 ? (
            <p className="text-sm text-stone-500">
              Aucun scénario à proposer : objectif tenable avec les moyens disponibles, période terminée, ou données insuffisantes.
            </p>
          ) : (
            <ul className="space-y-3">
              {proposes.map((s) => (
                <li key={s.cle} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-3">
                  <div>
                    <p className="font-semibold text-stone-900">{s.titre}</p>
                    <p className="text-xs text-stone-500">{s.explication}</p>
                  </div>
                  {peutEcrire && objectif && (
                    <button onClick={() => onRetenir(objectif, s)} className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-sm font-bold text-white">
                      <CheckCircle2 className="h-4 w-4" /> Retenir ce scénario
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-stone-500">Rien n'est modifié automatiquement : retenir un scénario ouvre la révision de l'objectif, avec un motif obligatoire.</p>
        </Panneau>
      )}
    </div>
  );
};

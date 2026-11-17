import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { ETATS_POSTE, actionsPoste, type EtatPoste } from './controle';
import { FenetreClotureShift, FenetreEtatShift, FenetrePreparationShift, type InstanceShift } from './FenetresShift';

// Instance du shift (D-087) : etat, transitions, plan versionne, journal.
// Le filtre date / site / shift de l'ecran n'est jamais un shift actif : seul
// l'etat de l'instance (postes) le dit.

interface Plan { id: string; version: number; voyages_crees: number; besoin_voyages: number | null; proposition: number | null; base_calcul: string; motif: string | null; hypothese_charge_pct: number | null; cree_le: string }
interface Transition { id: string; etat_avant: string | null; etat_apres: string; motif: string | null; cree_le: string }

const heure = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const PanneauShift = ({
  date, site, shift, libelle, destinations, peutEcrire, nonTermines, actualisation, onModifie, onInstance,
}: {
  date: string;
  site: string;
  shift: string;
  libelle: string;
  destinations: { id: string; name: string }[];
  peutEcrire: boolean;
  nonTermines: number;
  actualisation: number;
  onModifie: () => void;
  onInstance?: (i: InstanceShift | null) => void;
}) => {
  const [instance, setInstance] = useState<InstanceShift | null | undefined>(undefined);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [journal, setJournal] = useState<Transition[]>([]);
  const [erreur, setErreur] = useState('');
  const [fenetre, setFenetre] = useState<'planifier' | 'ouvrir' | 'demarrer' | 'annuler' | 'cloturer' | 'preparer' | null>(null);

  useEffect(() => {
    let actif = true;
    (async () => {
      const [rP, rL] = await Promise.all([
        supabase.from('postes').select('id, statut, version, date_poste, shift_id, site_id')
          .eq('date_poste', date).eq('site_id', site).eq('shift_id', shift).limit(1),
        supabase.from('plans_shift').select('id, version, voyages_crees, besoin_voyages, proposition, base_calcul, motif, hypothese_charge_pct, cree_le')
          .eq('date_plan', date).eq('site_id', site).eq('shift_id', shift).order('version', { ascending: false }).limit(20),
      ]);
      if (!actif) return;
      if (rP.error) { setErreur(`Shift non lu : ${rP.error.message}`); setInstance(null); return; }
      setErreur('');
      const i = ((rP.data ?? []) as InstanceShift[])[0] ?? null;
      setInstance(i);
      onInstance?.(i);
      setPlans(rL.error ? [] : (rL.data ?? []) as Plan[]);
      if (i) {
        const rJ = await supabase.from('postes_journal').select('id, etat_avant, etat_apres, motif, cree_le').eq('poste_id', i.id).order('rang');
        if (actif) setJournal(rJ.error ? [] : (rJ.data ?? []) as Transition[]);
      } else setJournal([]);
    })();
    return () => { actif = false; };
  }, [date, site, shift, actualisation]); // eslint-disable-line react-hooks/exhaustive-deps

  const etat = (instance?.statut ?? null) as EtatPoste | null;
  const actions = instance === undefined ? [] : actionsPoste(etat);
  const fait = () => { setFenetre(null); onModifie(); };
  const LIBELLES: Record<string, string> = {
    planifier: 'Planifier le shift', ouvrir: 'Ouvrir le shift', demarrer: 'Démarrer le shift',
    preparer: 'Préparer le shift', cloturer: 'Clôturer le shift', annuler: 'Annuler le shift',
  };

  return (
    <Panneau
      titre="Shift : instance du jour"
      action={peutEcrire && actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button key={a} type="button" onClick={() => setFenetre(a)}
              className={a === 'annuler' ? 'rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700'
                : a === 'preparer' ? 'rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-3 py-2 text-sm font-bold text-white'
                  : 'rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800'}>
              {LIBELLES[a]}
            </button>
          ))}
        </div>
      )}
    >
      {erreur && <p className="mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold text-stone-900">{libelle}</span>
        {instance === undefined ? <span className="text-stone-500">Lecture…</span>
          : instance === null ? <Puce teinte="gris">Non planifié</Puce>
            : <Puce teinte={ETATS_POSTE[etat as EtatPoste]?.teinte ?? 'gris'}>{ETATS_POSTE[etat as EtatPoste]?.libelle ?? instance.statut}</Puce>}
        {instance && <span className="text-xs text-stone-500">version {instance.version}</span>}
        {nonTermines > 0 && instance && ['ouvert', 'en_cours'].includes(instance.statut) && <span className="text-stone-600">{nonTermines} voyage(s) non terminé(s)</span>}
      </div>
      {instance === null && (
        <p className="mt-2 text-sm text-stone-600">Aucune instance pour cette date et ce site : le shift configuré n'est ni planifié ni ouvert. Planifiez-le pour préparer les voyages à l'avance, ou ouvrez-le le jour même.</p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-stone-700">Plan du shift (versions)</h3>
          {plans.length === 0 ? <SansDonnees message="Aucun plan confirmé" detail="La préparation enregistre une version à chaque confirmation." /> : (
            <ul className="divide-y divide-stone-100 text-sm" aria-label="Versions du plan">
              {plans.map((p) => (
                <li key={p.id} className="py-1.5">
                  <span className="font-semibold">v{p.version}</span> · {heure(p.cree_le)} · {p.voyages_crees} voyage(s) créé(s)
                  {p.besoin_voyages !== null ? ` · besoin ${p.besoin_voyages}` : ' · besoin non calculé'}
                  {p.hypothese_charge_pct !== null ? ` · charge ${p.hypothese_charge_pct} %` : ''}
                  {p.motif && <span className="text-stone-500"> · « {p.motif} »</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-stone-700">Transitions</h3>
          {journal.length === 0 ? <SansDonnees message="Aucune transition" /> : (
            <ul className="divide-y divide-stone-100 text-sm" aria-label="Transitions du shift">
              {journal.map((j) => (
                <li key={j.id} className="py-1.5">
                  {heure(j.cree_le)} · {j.etat_avant ? `${ETATS_POSTE[j.etat_avant as EtatPoste]?.libelle ?? j.etat_avant} → ` : ''}{ETATS_POSTE[j.etat_apres as EtatPoste]?.libelle ?? j.etat_apres}
                  {j.motif && <span className="text-stone-500"> · « {j.motif} »</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {fenetre && ['planifier', 'ouvrir', 'demarrer', 'annuler'].includes(fenetre) && (
        <FenetreEtatShift mode={fenetre as 'planifier'} date={date} site={site} shift={shift} instance={instance ?? null} libelle={libelle} onFermer={() => setFenetre(null)} onFait={fait} />
      )}
      {fenetre === 'cloturer' && instance && (
        <FenetreClotureShift instance={instance} libelle={libelle} nonTermines={nonTermines} onFermer={() => setFenetre(null)} onFait={fait} />
      )}
      {fenetre === 'preparer' && (
        <FenetrePreparationShift date={date} site={site} shift={shift} libelle={libelle} destinations={destinations}
          versionPlan={plans[0]?.version ?? 0} onFermer={() => setFenetre(null)} onFait={fait} />
      )}
    </Panneau>
  );
};

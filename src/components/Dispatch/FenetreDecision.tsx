import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { instantane, type Chauffeur, type Engin, type Recommandation } from './recommandation';

// Decision du dispatcher sur une recommandation (CDC 11.5) : modifier
// (autre camion, chauffeur ou engin), refuser, ou reaffecter un voyage
// affecte. Le motif est obligatoire ; le serveur controle les contraintes
// et historise la decision.

const CHAMP = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';

export type ModeDecision = 'modifiee' | 'refusee' | 'reaffectation';

export const FenetreDecision = ({
  mode,
  reference,
  recommandation,
  raison,
  camions,
  chauffeurs,
  engins,
  onFermer,
  onDecide,
}: {
  mode: ModeDecision;
  reference: string;
  recommandation: Recommandation;
  /** Raison de la reaffectation, reprise comme motif propose. */
  raison?: string;
  camions: Engin[];
  chauffeurs: Chauffeur[];
  engins: Engin[];
  onFermer: () => void;
  onDecide: () => void;
}) => {
  const [camion, setCamion] = useState(recommandation.camion?.id ?? '');
  const [chauffeur, setChauffeur] = useState(recommandation.chauffeur?.id ?? '');
  const [engin, setEngin] = useState(recommandation.engin?.id ?? '');
  const [motif, setMotif] = useState(raison ?? '');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const refus = mode === 'refusee';

  const titre = refus ? 'Refuser la recommandation' : mode === 'reaffectation' ? 'Réaffecter le voyage' : 'Modifier l\'affectation';

  const valider = async () => {
    setEnCours(true);
    setErreur('');
    const modifie = camion !== (recommandation.camion?.id ?? '') || chauffeur !== (recommandation.chauffeur?.id ?? '')
      || engin !== (recommandation.engin?.id ?? '');
    const { error } = await supabase.rpc('decider_affectation', {
      p_trip_id: recommandation.voyageId,
      p_decision: refus ? 'refusee' : modifie ? 'modifiee' : 'acceptee',
      p_vehicle_id: refus ? null : camion || null,
      p_driver_id: refus ? null : chauffeur || null,
      p_loader_vehicle_id: refus ? null : engin || null,
      p_recommandation: instantane(recommandation),
      p_motif: motif,
    });
    setEnCours(false);
    if (error) setErreur(error.message);
    else onDecide();
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={onFermer}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={titre}>
        <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-black text-stone-900">{titre}</h2>
            <p className="text-sm text-stone-500">{reference}</p>
          </div>
          <button onClick={onFermer} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </header>
        <div className="space-y-3 px-6 py-5 text-sm">
          <div className="rounded-lg bg-stone-50 p-3 text-stone-600">
            <p className="font-medium text-stone-700">Recommandation</p>
            <p>{[recommandation.camion?.registration, recommandation.chauffeur?.name, recommandation.engin?.registration].filter(Boolean).join(' · ') || 'Aucune'}</p>
          </div>
          {!refus && (
            <>
              <label className="block">
                <span className="mb-1 block font-medium text-stone-700">Camion</span>
                <select value={camion} onChange={(e) => setCamion(e.target.value)} className={CHAMP}>
                  <option value="">Choisir</option>
                  {camions.map((c) => <option key={c.id} value={c.id}>{c.registration}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-stone-700">Chauffeur</span>
                <select value={chauffeur} onChange={(e) => setChauffeur(e.target.value)} className={CHAMP}>
                  <option value="">Choisir</option>
                  {chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-stone-700">Chargeuse ou pelle</span>
                <select value={engin} onChange={(e) => setEngin(e.target.value)} className={CHAMP}>
                  <option value="">Aucune</option>
                  {engins.map((c) => <option key={c.id} value={c.id}>{c.registration}</option>)}
                </select>
              </label>
            </>
          )}
          <label className="block">
            <span className="mb-1 block font-medium text-stone-700">Motif (obligatoire)</span>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP} />
          </label>
          {erreur && <p className="rounded-lg bg-red-50 p-3 text-red-700">{erreur}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
          <button onClick={onFermer} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Annuler</button>
          <button
            onClick={valider}
            disabled={enCours || !motif.trim() || (!refus && (!camion || !chauffeur))}
            className={`rounded-lg px-5 py-2 text-sm font-bold text-white disabled:opacity-50 ${refus ? 'bg-red-600' : 'bg-gradient-to-r from-orange-500 to-orange-700'}`}
          >
            {enCours ? 'Enregistrement...' : refus ? 'Refuser' : 'Enregistrer la décision'}
          </button>
        </footer>
      </div>
    </div>
  );
};

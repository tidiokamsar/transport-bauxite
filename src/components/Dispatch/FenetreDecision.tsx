import { useEffect, useState } from 'react';
import { ErreurFenetre, Fenetre } from '../ui/Fenetre';
import { supabase } from '../../lib/supabase';
import { instantane, type Chauffeur, type Engin, type Recommandation } from './recommandation';
import { messageErreur } from './controle';

const CONFIANCE = { elevee: 'élevée', moyenne: 'moyenne', faible: 'faible' } as const;

// Decision du dispatcher sur une recommandation (CDC 11.5) : modifier
// (autre camion, chauffeur ou engin), refuser, ou reaffecter un voyage
// affecte. Le motif est obligatoire ; le serveur controle les contraintes
// et historise la decision. D-087 : appel par affecter_voyage avec la version
// lue par l'ecran (conflit concurrent refuse avec un message clair) ; detail
// de la recommandation (contraintes, capacite, duree, confiance).

const CHAMP = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';

type Controle = {
  code: string;
  libelle: string;
  ok: boolean;
  bloquant: boolean;
  detail: string;
  source: string;
};

export type ModeDecision = 'modifiee' | 'refusee' | 'reaffectation';

export const FenetreDecision = ({
  mode,
  reference,
  recommandation,
  raison,
  camions,
  chauffeurs,
  engins,
  version,
  onFermer,
  onDecide,
}: {
  mode: ModeDecision;
  /** Version du voyage pour le dispatch (decisions et suspensions connues). */
  version: number;
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
  const [controles, setControles] = useState<Controle[]>([]);
  const [controlesErreur, setControlesErreur] = useState('');
  const refus = mode === 'refusee';

  useEffect(() => {
    let actif = true;
    if (refus || !camion || !chauffeur) {
      setControles([]);
      setControlesErreur('');
      return () => { actif = false; };
    }
    supabase.rpc('controles_avant_affectation', {
      p_trip: recommandation.voyageId,
      p_vehicle: camion,
      p_driver: chauffeur,
      p_loader: engin || null,
    }).then(({ data, error }) => {
      if (!actif) return;
      if (error) {
        setControles([]);
        setControlesErreur('Contrôles indisponibles : aucune décision ne doit être prise sur cette base.');
        return;
      }
      setControles((data ?? []) as Controle[]);
      setControlesErreur('');
    });
    return () => { actif = false; };
  }, [refus, camion, chauffeur, engin, recommandation.voyageId]);

  const titre = refus ? 'Refuser la recommandation' : mode === 'reaffectation' ? 'Réaffecter le voyage' : 'Modifier l\'affectation';

  const valider = async () => {
    setEnCours(true);
    setErreur('');
    const modifie = camion !== (recommandation.camion?.id ?? '') || chauffeur !== (recommandation.chauffeur?.id ?? '')
      || engin !== (recommandation.engin?.id ?? '');
    const { error } = await supabase.rpc('affecter_voyage', {
      p_trip_id: recommandation.voyageId,
      p_decision: refus ? 'refusee' : modifie ? 'modifiee' : 'acceptee',
      p_vehicle_id: refus ? null : camion || null,
      p_driver_id: refus ? null : chauffeur || null,
      p_loader_vehicle_id: refus ? null : engin || null,
      p_recommandation: instantane(recommandation),
      p_motif: motif,
      p_version_attendue: version,
      p_derogation_motif: motif,
    });
    setEnCours(false);
    if (error) setErreur(messageErreur(error));
    else onDecide();
  };

  return (
    <Fenetre
      titre={titre}
      sousTitre={reference}
      largeur="max-w-lg"
      onFermer={onFermer}
      enCours={enCours}
      onSubmit={(e) => { e.preventDefault(); if (!(enCours || !motif.trim() || (!refus && (!camion || !chauffeur)))) valider(); }}
      pied={<>
        <button type="button" onClick={onFermer} disabled={enCours} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50">Annuler</button>
        <button
          type="submit"
          disabled={enCours || !motif.trim() || (!refus && (!camion || !chauffeur))}
          className={`rounded-lg px-5 py-2 text-sm font-bold text-white disabled:opacity-50 ${refus ? 'bg-red-600' : 'bg-gradient-to-r from-orange-500 to-orange-700'}`}
        >
          {enCours ? 'Enregistrement...' : refus ? 'Refuser' : 'Enregistrer la décision'}
        </button>
      </>}
    >
        <div className="space-y-3 text-sm">
          <ErreurFenetre>{erreur}</ErreurFenetre>
          <div className="rounded-lg bg-stone-50 p-3 text-stone-600">
            <p className="font-medium text-stone-700">Recommandation</p>
            <p>{[recommandation.camion?.registration, recommandation.chauffeur?.name, recommandation.engin?.registration].filter(Boolean).join(' · ') || 'Aucune'}</p>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs font-medium text-stone-700">Détail de la recommandation (confiance {CONFIANCE[recommandation.confiance]})</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {recommandation.explications.map((e) => <li key={e}>{e}</li>)}
                {recommandation.contraintes.map((c) => <li key={c}>Contrainte vérifiée : {c}</li>)}
                <li>Capacité retenue : {recommandation.capacite === null ? 'inconnue' : `${recommandation.capacite} t`}</li>
                <li>Durée estimée : {recommandation.dureeEstimeeMin === null ? 'non mesurée' : `${recommandation.dureeEstimeeMin} min (cycle observé)`}</li>
                {recommandation.manques.map((m) => <li key={m}>Donnée manquante : {m}</li>)}
              </ul>
            </details>
          </div>
          {!refus && (controlesErreur || controles.length > 0) && (
            <div className="rounded-lg border border-stone-200 p-3">
              <p className="mb-1 font-medium text-stone-700">Contrôles avant affectation</p>
              {controlesErreur && <p className="text-xs text-red-700">{controlesErreur}</p>}
              <ul className="space-y-0.5 text-xs">
                {controles.map((c) => (
                  <li key={c.code}>
                    <span className={c.ok ? 'font-medium text-green-700' : c.bloquant ? 'font-medium text-red-700' : 'font-medium text-amber-700'}>
                      {c.ok ? 'OK' : c.bloquant ? 'BLOQUANT' : 'À VÉRIFIER'}
                    </span>
                    {' '}{c.libelle} · {c.detail} · source : {c.source}
                  </li>
                ))}
              </ul>
              {controles.some((c) => c.code === 'tare_validee' && !c.ok) && (
                <p className="mt-1 text-xs text-amber-800">
                  Tare de référence absente : le motif saisi ci-dessous vaut dérogation journalisée. Aucune tare ne sera inventée.
                </p>
              )}
            </div>
          )}
          {!refus && <p className="text-xs text-stone-500">Un choix différent de la recommandation est enregistré comme « modifiée », avec le motif et les ressources remplacées.</p>}
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
        </div>
    </Fenetre>
  );
};

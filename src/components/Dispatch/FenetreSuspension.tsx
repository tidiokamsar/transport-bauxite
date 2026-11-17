import { useState } from 'react';
import { ErreurFenetre, Fenetre } from '../ui/Fenetre';
import { supabase } from '../../lib/supabase';
import { messageErreur } from './controle';

// Suspension ou reprise d'un voyage (D-087) : evenement trace, motif
// obligatoire ; un voyage suspendu n'avance plus (garde serveur) sauf
// annulation. Rien n'est efface.

export const FenetreSuspension = ({
  mode, voyageId, reference, onFermer, onFait,
}: {
  mode: 'suspendre' | 'reprendre';
  voyageId: string;
  reference: string;
  onFermer: () => void;
  onFait: () => void;
}) => {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const suspendre = mode === 'suspendre';

  const valider = async () => {
    setEnCours(true);
    setErreur('');
    const { error } = suspendre
      ? await supabase.rpc('suspendre_voyage', { p_trip_id: voyageId, p_motif: motif.trim(), p_reprise: false })
      : await supabase.rpc('reprendre_voyage', { p_trip_id: voyageId, p_motif: motif.trim() });
    setEnCours(false);
    if (error) setErreur(messageErreur(error));
    else onFait();
  };

  return (
    <Fenetre
      titre={suspendre ? 'Suspendre le voyage' : 'Reprendre le voyage'}
      sousTitre={reference}
      largeur="max-w-md"
      onFermer={onFermer}
      enCours={enCours}
      onSubmit={(e) => { e.preventDefault(); if (!enCours && motif.trim()) valider(); }}
      pied={<>
        <button type="button" onClick={onFermer} disabled={enCours} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50">Fermer</button>
        <button type="submit" disabled={enCours || !motif.trim()} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
          {enCours ? 'Enregistrement...' : suspendre ? 'Suspendre' : 'Reprendre'}
        </button>
      </>}
    >
      <div className="space-y-3 text-sm">
        <ErreurFenetre>{erreur}</ErreurFenetre>
        <p className="text-stone-600">
          {suspendre
            ? 'Le voyage garde son état et ses ressources ; il n\'avance plus jusqu\'à la reprise. Il peut être réaffecté ou annulé.'
            : 'Le voyage reprend à son état actuel ; la reprise est tracée avec son motif.'}
        </p>
        <label className="block">
          <span className="mb-1 block font-medium text-stone-700">Motif (obligatoire)</span>
          <input value={motif} onChange={(e) => setMotif(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        </label>
      </div>
    </Fenetre>
  );
};

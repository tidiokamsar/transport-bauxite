import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageAction } from '../ui/PageAction';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { COLONNES_COUT, MODULE_COUTS, VUE_COUTS, annulationCoutInterdite, libelleCout, type Cout } from './couts';

// Annulation d'une depense en pleine page (D-058, D-090, remplace le
// window.prompt) : annuler_cout exige un motif, conserve sur la depense.

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export const ActionCout = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const peutSaisir = hasPermission('costs', 'create') || hasPermission('costs', 'edit');
  const [cout, setCout] = useState<Cout | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    lire<Cout>(supabase.from('costs').select(COLONNES_COUT).eq('id', id), 'dépense').then((r) => {
      const c = trouver(r.lignes, id);
      setCout(c);
      setErreur(r.erreur || (c ? '' : 'Dépense introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);

  if (action !== 'annuler') return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'une dépense.`} />;
  const reference = cout ? libelleCout(cout) : 'Dépense';
  return (
    <PageAction
      vue={VUE_COUTS}
      module={MODULE_COUTS}
      reference={reference}
      id={id}
      titre={`Annuler la dépense ${reference}`}
      description={cout && <>{cout.description} · {nombre.format(cout.amount)} {cout.devise ?? ''} · la dépense reste conservée, marquée annulée, et sort des totaux et du réalisé budgétaire.</>}
      motif="obligatoire"
      motifMinimum={1}
      danger
      libelleConfirmer="Annuler la dépense"
      interdit={cout ? annulationCoutInterdite(cout, peutSaisir) : null}
      chargement={chargement}
      erreurChargement={erreur}
      messageSucces="Dépense annulée."
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc('annuler_cout', { p_id: id, p_motif: motif });
        return error ? error.message : null;
      }}
    />
  );
};

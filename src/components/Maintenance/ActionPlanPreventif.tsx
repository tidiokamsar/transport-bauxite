import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageAction } from '../ui/PageAction';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { ACTIONS_PLANNING, COLONNES_PLANNING, MODULE_PREVENTIF, VUE_PREVENTIF, actionPlanningInterdite, type ActionPlanning, type Planning } from './preventif';

// Desactivation et reactivation d'un planning preventif en pleine page
// (D-061, D-090, remplace le window.confirm). Mise a jour de is_active sous
// RLS comme l'ecran d'origine (aucune fonction serveur) ; aucune colonne ne
// conserverait un motif : pas de motif demande. Le planning n'est jamais
// supprime.

export const ActionPlanPreventif = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    lire<Planning>(supabase.from('maintenance_schedules').select(COLONNES_PLANNING).eq('id', id), 'planning préventif').then((r) => {
      const p = trouver(r.lignes, id);
      setPlanning(p);
      setErreur(r.erreur || (p ? '' : 'Planning introuvable ou non visible avec vos droits.'));
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_PLANNING as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un planning préventif.`} />;
  }
  const a = action as ActionPlanning;
  const desactiver = a === 'desactiver';

  return (
    <PageAction
      vue={VUE_PREVENTIF}
      module={MODULE_PREVENTIF}
      reference={planning?.title ?? 'Planning préventif'}
      id={id}
      chargement={chargement}
      erreurChargement={erreur}
      titre={desactiver ? 'Désactiver le planning' : 'Réactiver le planning'}
      description={desactiver ? 'Le planning reste consultable ; son échéance n\'est plus suivie tant qu\'il est désactivé.' : 'Le planning reprend le suivi de son échéance.'}
      motif="aucun"
      libelleConfirmer={desactiver ? 'Désactiver' : 'Réactiver'}
      danger={desactiver}
      interdit={planning ? actionPlanningInterdite(a, planning.is_active !== false, peutEcrire) : null}
      messageSucces={desactiver ? 'Planning désactivé.' : 'Planning réactivé.'}
      onExecuter={async () => {
        const { error } = await supabase.from('maintenance_schedules').update({ is_active: !desactiver }).eq('id', id);
        return error ? error.message : null;
      }}
    />
  );
};

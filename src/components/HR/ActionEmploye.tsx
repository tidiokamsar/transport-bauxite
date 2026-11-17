import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageAction } from '../ui/PageAction';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { ACTIONS_EMPLOYE, STATUTS_EMPLOYE, VUE_EMPLOYES, actionEmployePermise, nomEmploye, type ActionEmploye, type Employe } from './employe';

// Suspension, desactivation et reactivation d'un employe en pleine page
// (D-094) : motif obligatoire, conserve par changer_statut_employe dans
// journal_employes. Jamais de suppression physique.

export const ActionEmployePage = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const [employe, setEmploye] = useState<Employe | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    lire<Employe>(supabase.from('employees').select('*').eq('id', id), 'employé').then((r) => {
      const e = trouver(r.lignes, id);
      setEmploye(e);
      setErreur(r.erreur || (e ? '' : 'Employé introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);

  if (!(action in ACTIONS_EMPLOYE)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action de la fiche employé.`} />;
  }
  const def = ACTIONS_EMPLOYE[action as ActionEmploye];
  const interdit = !hasPermission('hr', 'edit') ? 'Droit d\'écriture RH requis.'
    : employe && !actionEmployePermise(action as ActionEmploye, employe.status)
      ? `Action impossible pour un employé « ${STATUTS_EMPLOYE[employe.status]?.libelle ?? employe.status} ».` : null;

  return (
    <PageAction
      vue={VUE_EMPLOYES}
      module="Employés"
      reference={employe ? nomEmploye(employe) : 'Employé'}
      id={id}
      titre={`${def.titre}${employe ? ` ${nomEmploye(employe)}` : ''}`}
      description={action === 'desactiver'
        ? 'La fiche n\'est pas supprimée : elle reste consultable avec le statut « Désactivé », avec son historique, et peut être réactivée.'
        : action === 'suspendre' ? 'L\'employé reste au registre avec le statut « Suspendu » jusqu\'à sa réactivation.'
          : 'L\'employé redevient actif.'}
      motif="obligatoire"
      motifMinimum={3}
      libelleConfirmer={def.confirmer}
      danger={action !== 'reactiver'}
      interdit={interdit}
      chargement={chargement}
      erreurChargement={erreur}
      messageSucces={def.succes}
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc('changer_statut_employe', { p_id: id, p_action: def.code, p_motif: motif });
        return error ? error.message : null;
      }}
    />
  );
};

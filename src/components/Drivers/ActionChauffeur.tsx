import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageAction } from '../ui/PageAction';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { ACTIONS_CHAUFFEUR, STATUTS_CHAUFFEUR, VUE_CHAUFFEURS, actionChauffeurPermise, type ActionChauffeur, type Chauffeur } from './chauffeur';

// Suspension, reactivation et archivage d'un dossier chauffeur en pleine
// page (D-042 : DELETE retire, le dossier reste lie a ses voyages). Aucune
// fonction serveur dediee ni journal : mise a jour de drivers.status sous
// RLS, comme l'ancien ecran ; aucun motif n'est demande puisqu'aucune table
// ne le conserverait (ecart D-090). Le serveur refuse l'archivage pendant
// un voyage en cours (D-061) : son message est affiche.

export const ActionChauffeurPage = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const [chauffeur, setChauffeur] = useState<Chauffeur | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    lire<Chauffeur>(supabase.from('drivers').select('*').eq('id', id), 'chauffeur').then((r) => {
      const d = trouver(r.lignes, id);
      setChauffeur(d);
      setErreur(r.erreur || (d ? '' : 'Chauffeur introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);

  if (!(action in ACTIONS_CHAUFFEUR)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action du dossier chauffeur.`} />;
  }
  const def = ACTIONS_CHAUFFEUR[action as ActionChauffeur];
  const interdit = !hasPermission('drivers', 'edit') ? 'Droit d\'écriture sur les chauffeurs requis.'
    : chauffeur && !actionChauffeurPermise(action as ActionChauffeur, chauffeur.status)
      ? `Action impossible pour un dossier « ${STATUTS_CHAUFFEUR[chauffeur.status]?.libelle ?? chauffeur.status} ».` : null;

  return (
    <PageAction
      vue={VUE_CHAUFFEURS}
      module="Chauffeurs"
      reference={chauffeur?.name ?? 'Chauffeur'}
      id={id}
      titre={`${def.titre}${chauffeur ? ` de ${chauffeur.name}` : ''}`}
      description={action === 'archiver'
        ? 'Le dossier n\'est pas supprimé : il reste consultable avec le statut « Archivé », lié à ses voyages, et peut être réactivé.'
        : action === 'suspendre' ? 'Le chauffeur n\'est plus proposé aux affectations tant que son dossier est suspendu.'
          : 'Le chauffeur est de nouveau proposé aux affectations.'}
      motif="aucun"
      libelleConfirmer={def.confirmer}
      danger={action !== 'reactiver'}
      interdit={interdit}
      chargement={chargement}
      erreurChargement={erreur}
      messageSucces={def.succes}
      onExecuter={async () => {
        const { error } = await supabase.from('drivers').update({ status: def.statut, updated_at: new Date().toISOString() }).eq('id', id);
        return error ? error.message : null;
      }}
    />
  );
};

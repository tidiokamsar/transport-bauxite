import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageAction } from '../ui/PageAction';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { COLONNES_SITE, VUE_SITES, type SiteSaisi } from './saisieSite';

// Desactivation et reactivation d'un site (D-042 : un site n'est jamais
// supprime, il garde l'historique des voyages et des fiches). Aucune
// fonction serveur dediee n'existe : l'ecriture reste la mise a jour de
// is_active sous la politique RLS du referentiel (droit settings), comme
// l'ancien ecran. Aucun journal ne conserverait un motif : il n'est pas
// demande (ecart D-090).

export const ActionSite = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const [site, setSite] = useState<SiteSaisi | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    lire<SiteSaisi>(supabase.from('sites').select(COLONNES_SITE).eq('id', id), 'site').then((r) => {
      setSite(trouver(r.lignes, id));
      setErreur(r.erreur || (trouver(r.lignes, id) ? '' : 'Site introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);

  if (action !== 'desactiver' && action !== 'reactiver') {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action du référentiel des sites.`} />;
  }
  const desactiver = action === 'desactiver';
  const actif = site?.is_active !== false;
  const interdit = !hasPermission('settings', 'edit') ? 'Droit d\'écriture sur le référentiel des sites requis.'
    : site && desactiver && !actif ? 'Ce site est déjà inactif.'
      : site && !desactiver && actif ? 'Ce site est déjà actif.' : null;

  return (
    <PageAction
      vue={VUE_SITES}
      module="Sites"
      reference={site?.name ?? 'Site'}
      id={id}
      titre={desactiver ? `Désactiver le site ${site?.name ?? ''}`.trim() : `Réactiver le site ${site?.name ?? ''}`.trim()}
      description={desactiver
        ? 'Le site n\'est pas supprimé : il reste dans l\'historique des voyages et des fiches, et n\'est plus proposé aux nouvelles saisies.'
        : 'Le site est de nouveau proposé aux saisies (voyages, postes, affectations).'}
      motif="aucun"
      libelleConfirmer={desactiver ? 'Désactiver' : 'Réactiver'}
      danger={desactiver}
      interdit={interdit}
      chargement={chargement}
      erreurChargement={erreur}
      messageSucces={desactiver ? 'Site désactivé.' : 'Site réactivé.'}
      onExecuter={async () => {
        const { error } = await supabase.from('sites').update({ is_active: !desactiver }).eq('id', id);
        return error ? error.message : null;
      }}
    />
  );
};

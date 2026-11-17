import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageAction } from '../ui/PageAction';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { COLONNES_VERSION_BUDGET, MODULE_BUDGETS, VUE_BUDGETS, budgetNonModifiable, type VersionBudget } from './budgets';

// Annulation d'un budget en pleine page (D-065, D-090, remplace le
// window.prompt) : annuler_budget exige un motif ; le budget reste conserve.

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export const ActionBudget = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const peutBudget = hasPermission('costs', 'create') || hasPermission('costs', 'edit');
  const [budget, setBudget] = useState<VersionBudget | null>(null);
  const [courant, setCourant] = useState(false);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    Promise.all([
      lire<VersionBudget>(supabase.from('budgets').select(COLONNES_VERSION_BUDGET).eq('id', id), 'budget'),
      lire<{ id: string }>(supabase.from('v_suivi_budgets').select('id').eq('id', id), 'budget courant'),
    ]).then(([b, c]) => {
      const ligne = trouver(b.lignes, id);
      setBudget(ligne);
      setCourant(Boolean(trouver(c.lignes, id)));
      setErreur(b.erreur || c.erreur || (ligne ? '' : 'Budget introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);

  if (action !== 'annuler') return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un budget.`} />;
  return (
    <PageAction
      vue={VUE_BUDGETS}
      module={MODULE_BUDGETS}
      reference={budget?.numero ?? 'Budget'}
      id={id}
      titre={`Annuler le budget ${budget?.numero ?? ''}`.trim()}
      description={budget && <>{nombre.format(budget.montant_ttc)} {budget.devise} TTC · le budget reste conservé, marqué annulé, et ne compte plus au suivi.</>}
      motif="obligatoire"
      motifMinimum={1}
      danger
      libelleConfirmer="Annuler le budget"
      interdit={budget ? budgetNonModifiable(peutBudget, courant) : null}
      chargement={chargement}
      erreurChargement={erreur}
      messageSucces="Budget annulé."
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc('annuler_budget', { p_id: id, p_motif: motif });
        return error ? error.message : null;
      }}
    />
  );
};

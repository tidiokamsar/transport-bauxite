import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { ApercuRapportPerformance } from './DetailRapportPerformance';
import {
  MODULE_ENGAGEMENTS, VUE_ENGAGEMENTS, erreursRemise, jourRapport, libelleRapport, remiseInterdite, type ContratRapport, type RapportPerformance,
} from './rapportsPerformance';

// Actions d'un rapport de performance en pleine page (D-031, D-090) :
// remise (marquer_rapport_remis, remplace le window.prompt) et apercu
// imprimable. Le destinataire et la date de remise sont la saisie ; aucun
// motif n'est conserve par le serveur.

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export const ActionRapportPerformance = ({ id, action }: { id: string; action: string }) => {
  if (action === 'apercu') return <ApercuRapportPerformance id={id} />;
  if (action === 'remettre') return <RemettreRapport id={id} />;
  return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un rapport de performance.`} />;
};

const RemettreRapport = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [rapport, setRapport] = useState<RapportPerformance | null>(null);
  const [contrat, setContrat] = useState<ContratRapport | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [f, setF] = useState({ date: aujourdhui(), destinataire: '' });

  useEffect(() => {
    lire<RapportPerformance>(supabase.from('rapports_performance').select('*').eq('id', id), 'rapport de performance').then(async (r) => {
      const x = trouver(r.lignes, id);
      setRapport(x);
      setErreur(r.erreur || (x ? '' : 'Rapport introuvable ou non visible avec vos droits.'));
      if (x) {
        const { data } = await supabase.from('contrats').select('id, reference, contrepartie, intitule, nature').eq('id', x.contrat_id);
        setContrat(((data ?? []) as ContratRapport[]).find((c) => c.id === x.contrat_id) ?? null);
      }
      setChargement(false);
    });
  }, [id]);

  const erreurs = erreursRemise(f, aujourdhui());
  return (
    <PageAction
      vue={VUE_ENGAGEMENTS}
      module={MODULE_ENGAGEMENTS}
      reference={libelleRapport(rapport, contrat)}
      id={id}
      titre="Marquer le rapport remis"
      description={rapport && <>Période du {jourRapport(rapport.periode_debut)} au {jourRapport(rapport.periode_fin)}. Le rapport figé est remis au destinataire ; il ne se modifie plus ensuite. Un contrat en brouillon (non signé) ne permet pas la remise (contrôle serveur).</>}
      motif="aucun"
      libelleConfirmer="Marquer remis"
      interdit={rapport ? remiseInterdite(rapport, peutEcrire) : null}
      chargement={chargement}
      erreurChargement={erreur}
      pret={erreurs.length === 0}
      messageSucces="Rapport marqué remis."
      onExecuter={async () => {
        const { error } = await supabase.rpc('marquer_rapport_remis', { p_id: id, p_date: f.date, p_destinataire: f.destinataire.trim() });
        return error ? error.message : null;
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <ChampPage libelle="Date de remise *">
          <input type="date" max={aujourdhui()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Remis à (destinataire) *">
          <input value={f.destinataire} onChange={(e) => setF({ ...f, destinataire: e.target.value })} className={CHAMP_FENETRE} />
        </ChampPage>
      </div>
      {erreurs.length > 0 && <ul className="list-disc pl-5 text-xs text-stone-500">{erreurs.map((m) => <li key={m}>{m}</li>)}</ul>}
    </PageAction>
  );
};

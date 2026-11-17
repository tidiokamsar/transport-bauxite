import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import type { Vehicle } from '../../types/vehicle';
import {
  ACTIONS_STATUT_VEHICULE, COLONNES_VEHICULE, PROPRIETES, VUE_VEHICULES, actionStatutPermise, erreurPropriete,
  type ActionStatutVehicule, type SaisiePropriete, type StatutOperationnel,
} from './flotte';

// Actions de la fiche engin en pleine page (D-062, D-090) : suspension,
// remise en service, reforme (motif obligatoire, comme le serveur) et
// propriete ; chacune par sa fonction serveur, journalisee dans journal_flotte.

interface Contrat { id: string; reference: string; contrepartie: string; nature: string; statut: string }

export const ActionVehicule = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const [vehicule, setVehicule] = useState<Vehicle | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    lire<Vehicle>(supabase.from('v_vehicules').select(COLONNES_VEHICULE).eq('id', id), 'engin').then((r) => {
      const v = trouver(r.lignes, id);
      setVehicule(v);
      setErreur(r.erreur || (v ? '' : 'Engin introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);

  const peutEcrire = hasPermission('vehicles', 'edit');
  const commun = { vue: VUE_VEHICULES, module: 'Véhicules et engins', reference: vehicule?.registration ?? 'Engin', id, chargement, erreurChargement: erreur };

  if (action === 'propriete') return <ProprieteVehicule commun={commun} vehicule={vehicule} interditDroit={!peutEcrire} />;
  if (!(action in ACTIONS_STATUT_VEHICULE)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action de la fiche engin.`} />;
  }
  const def = ACTIONS_STATUT_VEHICULE[action as ActionStatutVehicule];
  const statut = (vehicule?.statut_operationnel ?? 'disponible') as StatutOperationnel;
  const interdit = !peutEcrire ? 'Droit d\'écriture sur la flotte requis.'
    : vehicule && !actionStatutPermise(action as ActionStatutVehicule, statut) ? `Action impossible pour un engin au statut « ${statut} ».` : null;

  return (
    <PageAction
      {...commun}
      titre={`${def.titre} ${vehicule?.registration ?? ''}`.trim()}
      description={action === 'reformer'
        ? 'La réforme sort définitivement l\'engin de la flotte ; il reste dans l\'historique. Motif conservé au journal de la flotte.'
        : action === 'suspendre'
          ? 'Une suspension rend l\'engin indisponible pour la planification et le dispatch jusqu\'à sa remise en service. Motif conservé au journal de la flotte.'
          : 'L\'engin redevient disponible pour la planification et le dispatch. Motif conservé au journal de la flotte.'}
      motif="obligatoire"
      motifMinimum={1}
      libelleConfirmer={def.confirmer}
      danger={action !== 'remettre-en-service'}
      interdit={interdit}
      messageSucces={def.succes}
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc(def.fonction, { p_vehicle: id, p_motif: motif });
        return error ? error.message : null;
      }}
    />
  );
};

const ProprieteVehicule = ({ commun, vehicule, interditDroit }: {
  commun: { vue: string; module: string; reference: string; id: string; chargement: boolean; erreurChargement: string };
  vehicule: Vehicle | null;
  interditDroit: boolean;
}) => {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [erreurContrats, setErreurContrats] = useState('');
  const [f, setF] = useState<Omit<SaisiePropriete, 'motif'>>({ propriete: '', proprietaire: '', exploitant: '', transporteur: '', contrat: '' });
  const dejaRenseignee = Boolean(vehicule?.propriete);

  useEffect(() => {
    if (!vehicule) return;
    setF({ propriete: vehicule.propriete ?? '', proprietaire: vehicule.proprietaire ?? '', exploitant: vehicule.exploitant ?? '',
      transporteur: vehicule.transporteur ?? '', contrat: vehicule.contrat_id ?? '' });
  }, [vehicule]);
  useEffect(() => {
    supabase.rpc('contrats_rattachables_flotte').then(({ data, error }) => {
      setErreurContrats(error ? `Contrats indisponibles : ${error.message}` : '');
      setContrats((data ?? []) as Contrat[]);
    });
  }, []);

  // Le motif est saisi par PageAction ; le controle repris du serveur porte
  // sur les champs (le motif est exige par PageAction quand la propriete existe).
  const erreurSaisie = erreurPropriete({ ...f, motif: '' }, false);
  const interdit = interditDroit ? 'Droit d\'écriture sur la flotte requis.'
    : vehicule?.statut_operationnel === 'reforme' ? 'Engin réformé : la propriété ne se modifie plus.' : null;

  return (
    <PageAction
      {...commun}
      titre={`${dejaRenseignee ? 'Modifier' : 'Renseigner'} la propriété ${vehicule?.registration ?? ''}`.trim()}
      description="Propriété, loueur et contrat de location de l'engin ; chaque modification est journalisée (journal de la flotte)."
      motif={dejaRenseignee ? 'obligatoire' : 'facultatif'}
      motifMinimum={1}
      libelleConfirmer="Enregistrer la propriété"
      interdit={interdit}
      pret={!erreurSaisie}
      messageSucces="Propriété enregistrée."
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc('definir_propriete_vehicule', {
          p_vehicle: commun.id, p_propriete: f.propriete, p_proprietaire: f.proprietaire.trim() || null, p_exploitant: f.exploitant.trim() || null,
          p_transporteur: f.transporteur.trim() || null, p_contrat: f.contrat || null, p_motif: motif || null,
        });
        return error ? error.message : null;
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ChampPage libelle="Propriété *">
          <select value={f.propriete} onChange={(e) => setF({ ...f, propriete: e.target.value, contrat: e.target.value === 'kogon' ? '' : f.contrat })} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {Object.entries(PROPRIETES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Propriétaire / loueur"><input value={f.proprietaire} onChange={(e) => setF({ ...f, proprietaire: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Exploitant"><input value={f.exploitant} onChange={(e) => setF({ ...f, exploitant: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Transporteur"><input value={f.transporteur} onChange={(e) => setF({ ...f, transporteur: e.target.value })} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Contrat de location" erreur={erreurContrats} className="sm:col-span-2">
          <select value={f.contrat} disabled={f.propriete === 'kogon'} onChange={(e) => setF({ ...f, contrat: e.target.value })} className={CHAMP_FENETRE}>
            <option value="">Aucun</option>
            {contrats.map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.contrepartie} ({c.statut})</option>)}
          </select>
        </ChampPage>
        {erreurSaisie && <p className="text-xs text-orange-700 sm:col-span-2">{erreurSaisie}</p>}
      </div>
    </PageAction>
  );
};

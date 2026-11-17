import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import {
  ACTIONS_PAIEMENT, MODES_PAIEMENT, MODULE_PAIEMENTS, VUE_PAIEMENTS, actionPaiementInterdite, erreursExecution, lireMontant, montantPaiement,
  type ActionPaiement, type Paiement,
} from './paiements';

// Actions d'un paiement en pleine page (D-055, D-090, remplace les
// window.prompt) : chacune par sa fonction serveur existante. Motif exige
// par le serveur pour le rejet (decider_paiement), l'annulation
// (annuler_paiement) et l'anomalie (controler_paiement) ; facultatif et
// conserve pour l'approbation et le controle conforme.

const aujourdhui = () => new Date().toISOString().slice(0, 10);

const DEFINITIONS: Record<Exclude<ActionPaiement, 'executer'>, {
  titre: string; confirmer: string; succes: string; description: string; motif: 'obligatoire' | 'facultatif'; danger?: boolean;
  appel: (id: string, motif: string) => [string, Record<string, unknown>];
}> = {
  approuver: {
    titre: 'Approuver le paiement', confirmer: 'Approuver', succes: 'Paiement approuvé.', motif: 'facultatif',
    description: 'L\'approbation revient à une autre personne que le proposant ; le serveur vérifie que la pièce couvre encore le montant.',
    appel: (id, motif) => ['decider_paiement', { p_id: id, p_approuver: true, p_motif: motif || null }],
  },
  rejeter: {
    titre: 'Rejeter le paiement', confirmer: 'Rejeter', succes: 'Paiement rejeté.', motif: 'obligatoire', danger: true,
    description: 'Le rejet est définitif ; le motif est conservé sur le paiement.',
    appel: (id, motif) => ['decider_paiement', { p_id: id, p_approuver: false, p_motif: motif }],
  },
  annuler: {
    titre: 'Annuler le paiement', confirmer: 'Annuler le paiement', succes: 'Paiement annulé.', motif: 'obligatoire', danger: true,
    description: 'Un paiement proposé ou approuvé, non exécuté, s\'annule avec un motif ; il n\'est pas supprimé.',
    appel: (id, motif) => ['annuler_paiement', { p_id: id, p_motif: motif }],
  },
  conforme: {
    titre: 'Contrôle a posteriori : conforme', confirmer: 'Enregistrer le contrôle', succes: 'Contrôle enregistré.', motif: 'facultatif',
    description: 'Le contrôle revient à une autre personne que le proposant et l\'exécutant.',
    appel: (id, motif) => ['controler_paiement', { p_id: id, p_conforme: true, p_motif: motif || null }],
  },
  anomalie: {
    titre: 'Contrôle a posteriori : anomalie', confirmer: 'Enregistrer l\'anomalie', succes: 'Anomalie enregistrée.', motif: 'obligatoire', danger: true,
    description: 'Décrivez l\'anomalie constatée (montant, référence, bénéficiaire...) ; elle est conservée sur le paiement.',
    appel: (id, motif) => ['controler_paiement', { p_id: id, p_conforme: false, p_motif: motif }],
  },
};

export const ActionPaiementVue = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission, profile } = useAuth();
  const droits = { saisir: hasPermission('invoices', 'create') || hasPermission('invoices', 'edit'), approuver: hasPermission('invoices', 'approve'), moi: profile?.id ?? null };
  const [paiement, setPaiement] = useState<Paiement | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [exe, setExe] = useState({ date: '', mode: '', montant: '', reference: '' });
  const poser = (k: keyof typeof exe, v: string) => setExe((e) => ({ ...e, [k]: v }));

  useEffect(() => {
    lire<Paiement>(supabase.from('paiements_fournisseur').select('*').eq('id', id), 'paiement').then((r) => {
      const p = trouver(r.lignes, id);
      setPaiement(p);
      if (p) setExe((e) => ({ ...e, montant: String(p.montant_propose) }));
      setErreur(r.erreur || (p ? '' : 'Paiement introuvable ou non visible avec vos droits.'));
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_PAIEMENT as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un paiement fournisseur.`} />;
  }
  const a = action as ActionPaiement;
  const commun = {
    vue: VUE_PAIEMENTS, module: MODULE_PAIEMENTS, reference: paiement?.numero ?? 'Paiement', id, chargement, erreurChargement: erreur,
    interdit: paiement ? actionPaiementInterdite(a, paiement, droits) : null,
  };
  const resume = paiement && <p>{paiement.beneficiaire} · {paiement.objet} · {montantPaiement(paiement.montant_propose, paiement.devise)}</p>;

  if (a === 'executer') {
    const erreurs = paiement ? erreursExecution(exe, paiement.montant_propose, aujourdhui()) : [];
    const referenceRequise = ['virement', 'cheque'].includes(exe.mode);
    return (
      <PageAction
        {...commun}
        titre={`Paiement exécuté : ${paiement?.numero ?? ''}`}
        description={<>{resume}<p>Le paiement a été exécuté hors SIGTB : saisissez sa date, son mode, le montant réglé et sa référence bancaire.</p></>}
        motif="aucun"
        libelleConfirmer="Enregistrer l'exécution"
        pret={erreurs.length === 0}
        messageSucces="Paiement exécuté enregistré."
        onExecuter={async () => {
          const { error } = await supabase.rpc('enregistrer_execution_paiement', {
            p_id: id, p_date: exe.date, p_mode: exe.mode, p_montant: lireMontant(exe.montant), p_reference: exe.reference.trim() || null,
          });
          return error ? error.message : null;
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampPage libelle="Date d'exécution *">
            <input type="date" max={aujourdhui()} value={exe.date} onChange={(e) => poser('date', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
          <ChampPage libelle="Mode *">
            <select value={exe.mode} onChange={(e) => poser('mode', e.target.value)} className={CHAMP_FENETRE}>
              <option value="">Choisir</option>
              {Object.entries(MODES_PAIEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </ChampPage>
          <ChampPage libelle={`Montant exécuté (${paiement?.devise ?? ''}) *`} aide="Au plus le montant approuvé.">
            <input inputMode="decimal" value={exe.montant} onChange={(e) => poser('montant', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
          <ChampPage libelle={`Référence bancaire${referenceRequise ? ' *' : ''}`}>
            <input value={exe.reference} onChange={(e) => poser('reference', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
        </div>
        {erreurs.length > 0 && <ul className="list-disc pl-5 text-xs text-stone-500">{erreurs.map((m) => <li key={m}>{m}</li>)}</ul>}
      </PageAction>
    );
  }

  const d = DEFINITIONS[a];
  return (
    <PageAction
      {...commun}
      titre={`${d.titre} ${paiement?.numero ?? ''}`.trim()}
      description={<>{resume}<p>{d.description}</p></>}
      motif={d.motif}
      motifMinimum={1}
      danger={d.danger}
      libelleConfirmer={d.confirmer}
      messageSucces={d.succes}
      onExecuter={async (motif) => {
        const [fonction, args] = d.appel(id, motif);
        const { error } = await supabase.rpc(fonction, args);
        return error ? error.message : null;
      }}
    />
  );
};

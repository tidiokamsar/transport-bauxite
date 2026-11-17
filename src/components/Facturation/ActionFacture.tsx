import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import {
  ACTIONS_FACTURE, VUE_FACTURES, actionFactureInterdite, libelleFacture, lireMontant, montant, type ActionFacture, type Facture,
} from './facturation';

// Actions d'une facture en pleine page (D-029, D-090, remplace les
// window.prompt) : avancer_facture (soumettre, signer, renvoyer, emettre,
// annuler) et creer_avoir. Le motif est exige par le serveur pour renvoyer,
// annuler et creer un avoir ; il est conserve au journal de la facture.

const DEFINITIONS: Record<ActionFacture, { titre: string; confirmer: string; succes: string; motif: 'obligatoire' | 'aucun'; danger?: boolean; description: string }> = {
  soumettre: { titre: 'Soumettre au Directeur Général', confirmer: 'Soumettre au DG', succes: 'Facture soumise au DG.', motif: 'aucun',
    description: 'La facture passe « à signer » ; elle ne se modifie plus jusqu\'au renvoi éventuel du Directeur Général.' },
  signer: { titre: 'Signer la facture', confirmer: 'Signer', succes: 'Facture signée.', motif: 'aucun',
    description: 'Signature du Directeur Général, distinct du préparateur (contrôle serveur). La facture pourra ensuite être émise et numérotée.' },
  renvoyer: { titre: 'Renvoyer la facture', confirmer: 'Renvoyer', succes: 'Facture renvoyée en brouillon.', motif: 'obligatoire',
    description: 'La facture revient en brouillon chez le chargé de contrats ; le motif est conservé au journal.' },
  emettre: { titre: 'Émettre la facture', confirmer: 'Émettre', succes: 'Facture émise et numérotée.', motif: 'aucun',
    description: 'L\'émission attribue le numéro définitif et l\'échéance (délai de paiement du contrat). Une facture émise ne se modifie plus : avoir.' },
  avoir: { titre: 'Créer un avoir', confirmer: 'Créer l\'avoir', succes: 'Avoir créé en brouillon (voir les relations de la facture).', motif: 'obligatoire',
    description: 'L\'avoir est créé en brouillon et suit le même circuit de signature ; la facture émise reste inchangée.' },
  annuler: { titre: 'Annuler la facture', confirmer: 'Annuler la facture', succes: 'Facture annulée.', motif: 'obligatoire', danger: true,
    description: 'Une facture brouillon ou à signer s\'annule avec un motif ; elle reste dans l\'historique.' },
};

export const ActionFactureVue = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission, profile, user } = useAuth();
  const droits = { ecrire: hasPermission('invoices', 'create') || hasPermission('invoices', 'edit'), directeur: profile?.role === 'director', utilisateur: user?.id ?? null };
  const [facture, setFacture] = useState<Facture | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [saisieMontant, setSaisieMontant] = useState('');

  useEffect(() => {
    lire<Facture>(supabase.from('factures').select('*').eq('id', id), 'facture').then((r) => {
      const f = trouver(r.lignes, id);
      setFacture(f);
      setErreur(r.erreur || (f ? '' : 'Facture introuvable ou non visible avec vos droits.'));
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_FACTURE as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'une facture.`} />;
  }
  const a = action as ActionFacture;
  const d = DEFINITIONS[a];
  const valeurAvoir = lireMontant(saisieMontant);
  const erreurMontant = a === 'avoir' && saisieMontant.trim() && (valeurAvoir === null || valeurAvoir <= 0)
    ? 'Montant hors taxes supérieur à zéro.' : null;

  return (
    <PageAction
      vue={VUE_FACTURES}
      module="Facturation"
      reference={facture ? libelleFacture(facture) : 'Facture'}
      id={id}
      titre={d.titre}
      description={<>
        <p>{d.description}</p>
        {facture && <p className="mt-1 font-semibold text-stone-800">{libelleFacture(facture)} · {montant(facture.montant_ttc, facture.devise)} TTC · {facture.objet}</p>}
      </>}
      motif={d.motif}
      motifMinimum={1}
      libelleConfirmer={d.confirmer}
      danger={d.danger}
      interdit={facture ? actionFactureInterdite(a, facture, droits) : null}
      chargement={chargement}
      erreurChargement={erreur}
      pret={a !== 'avoir' || (valeurAvoir !== null && valeurAvoir > 0)}
      messageSucces={d.succes}
      onExecuter={async (motif) => {
        const { error } = a === 'avoir'
          ? await supabase.rpc('creer_avoir', { p_facture_id: id, p_montant_ht: valeurAvoir, p_motif: motif })
          : await supabase.rpc('avancer_facture', { p_id: id, p_action: a, p_motif: d.motif === 'obligatoire' ? motif : null, p_date: null });
        return error ? error.message : null;
      }}
    >
      {a === 'avoir' && (
        <ChampPage libelle={`Montant hors taxes de l'avoir * (${facture?.devise ?? ''})`.replace(' ()', '')} erreur={erreurMontant}
          aide="Au plus le montant hors taxes de la facture, déduction faite des avoirs déjà émis (contrôle serveur).">
          <input inputMode="decimal" value={saisieMontant} onChange={(e) => setSaisieMontant(e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      )}
    </PageAction>
  );
};

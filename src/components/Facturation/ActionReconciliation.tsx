import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { ANOMALIES, VUE_RECONCILIATION, lireMontant } from './facturation';
import { clotureInterdite, comptesLignes, decisionInterdite, type DecisionLigne, type LigneReconciliation, type Reconciliation } from './reconciliation';

// Actions d'une reconciliation en pleine page (D-029, D-082, D-090,
// remplace les window.prompt et la fenetre de rectification) : chacune par
// sa fonction serveur existante. Motif exige par le serveur pour une
// decision sur une ligne et pour la rectification d'un ticket CBG.

const ACTIONS = ['actualiser', 'cloturer', 'generer-facture', 'decider', 'rectifier'] as const;
type Action = typeof ACTIONS[number];
const DECISIONS: DecisionLigne[] = ['facturable', 'exclue', 'aucune'];

export const ActionReconciliation = ({ id, action, requete }: { id: string; action: string; requete: Record<string, string> }) => {
  const { hasPermission } = useAuth();
  const droits = { ecrire: hasPermission('invoices', 'create') || hasPermission('invoices', 'edit'), approuver: hasPermission('invoices', 'approve') };
  const [rec, setRec] = useState<Reconciliation | null>(null);
  const [lignes, setLignes] = useState<LigneReconciliation[]>([]);
  const [reference, setReference] = useState('Réconciliation');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [taxe, setTaxe] = useState('');
  const [correction, setCorrection] = useState<{ ticket: string; brut: string; tare: string; documentRef: string } | null>(null);

  useEffect(() => {
    Promise.all([
      lire<Reconciliation>(supabase.from('reconciliations').select('*').eq('id', id), 'réconciliation'),
      lire<LigneReconciliation>(supabase.from('reconciliation_lignes').select('*').eq('reconciliation_id', id), 'lignes de la réconciliation'),
    ]).then(async ([r, l]) => {
      const x = trouver(r.lignes, id);
      setRec(x);
      setLignes((l.lignes ?? []).filter((y) => y.reconciliation_id === id));
      setErreur(r.erreur || l.erreur || (x ? '' : 'Réconciliation introuvable ou non visible avec vos droits.'));
      if (x) {
        const c = await supabase.from('contrats').select('id, reference').eq('id', x.contrat_id);
        const ref = ((c.data ?? []) as { id: string; reference: string }[]).find((k) => k.id === x.contrat_id)?.reference ?? 'Contrat';
        setReference(`${ref} · ${new Date(`${x.periode_debut}T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`);
      }
      setChargement(false);
    });
  }, [id]);

  const ligne = lignes.find((l) => l.id === requete.ligne) ?? null;
  useEffect(() => {
    if (action === 'rectifier' && ligne && !correction) {
      setCorrection({ ticket: ligne.ticket ?? '', brut: ligne.ticket_brut == null ? '' : String(ligne.ticket_brut), tare: ligne.ticket_tare == null ? '' : String(ligne.ticket_tare), documentRef: ligne.ticket_document_ref ?? '' });
    }
  }, [action, ligne, correction]);

  if (!(ACTIONS as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'une réconciliation.`} />;
  }
  const a = action as Action;
  const commun = { vue: VUE_RECONCILIATION, module: 'Réconciliation mensuelle', reference, id, chargement, erreurChargement: erreur };
  const fermee = !droits.ecrire ? 'Droit d\'écriture sur la facturation requis.' : rec && rec.statut !== 'ouverte' ? 'Réconciliation clôturée : figée.' : null;
  const sansLigne = !chargement && !ligne ? 'Ligne introuvable dans cette réconciliation.' : null;

  if (a === 'decider') {
    const decision = (DECISIONS as string[]).includes(requete.decision) ? requete.decision as DecisionLigne : 'aucune';
    const titre = decision === 'aucune' ? 'Annuler la décision' : decision === 'exclue' ? 'Exclure la ligne' : ligne?.anomalies.includes('ticket_rectifie') ? 'Approuver la facturation' : 'Déclarer la ligne facturable';
    return (
      <PageAction
        {...commun}
        titre={`${titre}${ligne ? ` · ${ligne.reference}` : ''}`}
        description={ligne && <>
          <p>Voyage {ligne.reference} du {new Date(`${ligne.date_voyage}T00:00:00`).toLocaleDateString('fr-FR')} · base {ligne.tonnage_base ?? '—'} t · ticket {ligne.ticket ?? 'absent'}.</p>
          {ligne.anomalies.length > 0 && <p className="mt-1">Anomalies : {ligne.anomalies.map((x) => ANOMALIES[x]?.libelle ?? x).join(' ; ')}.</p>}
          {decision === 'aucune' && <p className="mt-1">La ligne revient à son statut calculé (à examiner si une anomalie bloquante subsiste).</p>}
        </>}
        motif={decision === 'aucune' ? 'aucun' : 'obligatoire'}
        motifMinimum={1}
        libelleConfirmer={titre}
        danger={decision === 'exclue'}
        interdit={rec && ligne ? decisionInterdite(decision, rec, ligne, droits) : sansLigne}
        messageSucces={`${ligne?.reference ?? 'Ligne'} : décision enregistrée.`}
        onExecuter={async (motif) => {
          const { error } = await supabase.rpc('decider_ligne_reconciliation', { p_ligne_id: ligne?.id, p_decision: decision === 'aucune' ? null : decision, p_motif: decision === 'aucune' ? null : motif });
          return error ? error.message : null;
        }}
      />
    );
  }

  if (a === 'rectifier') {
    const c = correction ?? { ticket: '', brut: '', tare: '', documentRef: '' };
    const brut = lireMontant(c.brut);
    const tare = lireMontant(c.tare);
    const poser = (k: keyof typeof c, v: string) => setCorrection({ ...c, [k]: v });
    return (
      <PageAction
        {...commun}
        titre={`Rectifier un ticket CBG${ligne ? ` · ${ligne.reference}` : ''}`}
        description="Le ticket initial reste conservé dans l'historique ; la rectification motivée est tracée, puis le rapprochement est actualisé. La facturation d'une ligne rectifiée est ensuite décidée par un approbateur distinct (D-082)."
        motif="obligatoire"
        motifMinimum={1}
        libelleConfirmer="Enregistrer la rectification"
        interdit={fermee ?? sansLigne ?? (ligne && !ligne.ticket ? 'Aucun ticket CBG sur ce voyage : rien à rectifier.' : null)}
        pret={Boolean(c.ticket.trim()) && brut !== null && tare !== null}
        messageSucces={`Rectification du ticket ${ligne?.reference ?? ''} enregistrée ; rapprochement actualisé. La preuve initiale est conservée.`}
        onExecuter={async (motif) => {
          const { error } = await supabase.rpc('rectifier_ticket_pesee_cbg', {
            p_trip_id: ligne?.trip_id, p_ticket: c.ticket.trim(), p_brut: brut, p_tare: tare, p_document_ref: c.documentRef.trim() || null, p_motif: motif,
          });
          if (error) return error.message;
          const actualisation = await supabase.rpc('actualiser_reconciliation', { p_id: id });
          return actualisation.error
            ? `la rectification est enregistrée, mais l'actualisation du rapprochement a échoué (${actualisation.error.message}). Ne ressaisissez pas la rectification : revenez à la fiche et utilisez l'action Actualiser.`
            : null;
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChampPage libelle="Numéro du ticket *"><input value={c.ticket} onChange={(e) => poser('ticket', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Référence du document"><input value={c.documentRef} onChange={(e) => poser('documentRef', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Poids brut (t) *" erreur={c.brut.trim() && brut === null ? 'Nombre attendu.' : null}><input inputMode="decimal" value={c.brut} onChange={(e) => poser('brut', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          <ChampPage libelle="Tare (t) *" erreur={c.tare.trim() && tare === null ? 'Nombre attendu.' : null}><input inputMode="decimal" value={c.tare} onChange={(e) => poser('tare', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        </div>
      </PageAction>
    );
  }

  if (a === 'generer-facture') {
    const taux = lireMontant(taxe);
    return (
      <PageAction
        {...commun}
        titre="Générer la facture"
        description={rec && <>La facture est générée en brouillon au tarif du contrat en vigueur, sur {rec.tonnage_facturable ?? '—'} t facturables ({rec.voyages_facturables ?? '—'} voyage(s)). Elle apparaît dans les relations de la réconciliation et dans Facturation.</>}
        motif="aucun"
        libelleConfirmer="Générer la facture"
        interdit={!droits.ecrire ? 'Droit d\'écriture sur la facturation requis.' : rec && rec.statut !== 'cloturee' ? 'La facture se génère sur une réconciliation clôturée.' : null}
        pret={taux !== null}
        messageSucces="Facture générée en brouillon (onglet Relations, ou menu Facturation)."
        onExecuter={async () => {
          const { error } = await supabase.rpc('generer_facture', { p_reconciliation_id: id, p_taux_taxe: taux, p_objet: null });
          return error ? error.message : null;
        }}
      >
        <ChampPage libelle="Taux de taxe (%) *" aide="0 si exonéré ; aucun taux n'est proposé par défaut.">
          <input inputMode="decimal" value={taxe} onChange={(e) => setTaxe(e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </PageAction>
    );
  }

  const aExaminer = comptesLignes(lignes).a_examiner;
  return (
    <PageAction
      {...commun}
      titre={a === 'actualiser' ? 'Actualiser le rapprochement' : 'Clôturer la réconciliation'}
      description={a === 'actualiser'
        ? 'Les voyages livrés de la période sont rapprochés à nouveau (tickets, fiches, pesées) ; les décisions déjà prises sont conservées.'
        : 'La clôture fige le tonnage facturable et le nombre de voyages ; la facture se génère ensuite.'}
      motif="aucun"
      libelleConfirmer={a === 'actualiser' ? 'Actualiser' : 'Clôturer'}
      interdit={a === 'actualiser' ? fermee : rec ? clotureInterdite(rec, aExaminer, droits.ecrire) : null}
      messageSucces={a === 'actualiser' ? 'Rapprochement actualisé.' : 'Réconciliation clôturée : tonnage facturable figé.'}
      onExecuter={async () => {
        const { error } = await supabase.rpc(a === 'actualiser' ? 'actualiser_reconciliation' : 'cloturer_reconciliation', { p_id: id });
        return error ? error.message : null;
      }}
    />
  );
};

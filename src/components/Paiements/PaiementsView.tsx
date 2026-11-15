import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees, type TeintePuce } from '../ui/Panneau';

// Paiements fournisseurs (D-055) : SIGTB n'execute aucun paiement. Il
// enregistre le bon a payer (plafonne au reste a payer), l'approbation par
// une autre personne, le paiement execute hors systeme avec sa reference,
// puis le controle a posteriori.

interface Piece { source: 'facture_loueur' | 'bon_commande'; piece_id: string; piece: string; date_piece: string; base: number; engage: number; paye: number; reste: number; beneficiaire: string | null; devise: string }
interface Paiement {
  id: string; numero: string; facture_fournisseur_id: string | null; purchase_order_id: string | null; beneficiaire: string; devise: string; objet: string;
  montant_propose: number; statut: string; propose_par: string | null; motif_decision: string | null; execute_le: string | null; mode: string | null;
  reference_execution: string | null; montant_execute: number | null; execute_par: string | null; motif_annulation: string | null;
  controle_resultat: string | null; controle_motif: string | null;
}

const STATUTS: Record<string, { texte: string; teinte: TeintePuce }> = {
  propose: { texte: 'Proposé', teinte: 'bleu' }, approuve: { texte: 'Approuvé', teinte: 'violet' }, rejete: { texte: 'Rejeté', teinte: 'rouge' },
  execute: { texte: 'Exécuté', teinte: 'vert' }, annule: { texte: 'Annulé', teinte: 'gris' },
};
const MODES: Record<string, string> = { virement: 'Virement', cheque: 'Chèque', especes: 'Espèces', compensation: 'Compensation', autre: 'Autre' };
const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const montant = (v: number | null, devise: string) => (v === null ? 'Sans données' : `${nombre.format(v)} ${devise}`);

export const PaiementsView = () => {
  const { hasPermission, profile } = useAuth();
  const peutSaisir = hasPermission('invoices', 'create') || hasPermission('invoices', 'edit');
  const peutApprouver = hasPermission('invoices', 'approve');
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [paiements, setPaiements] = useState<Paiement[] | null>(null);
  const [proposition, setProposition] = useState<{ piece: Piece; montant: string; objet: string } | null>(null);
  const [execution, setExecution] = useState<{ paiement: Paiement; date: string; mode: string; montant: string; reference: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [r, p] = await Promise.all([
      supabase.from('v_reste_a_payer').select('*').order('date_piece', { ascending: false }),
      supabase.from('paiements_fournisseur').select('*').order('propose_le', { ascending: false }),
    ]);
    setErreur(r.error?.message ?? p.error?.message ?? '');
    setPieces((r.data ?? []) as Piece[]);
    setPaiements((p.data ?? []) as Paiement[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fonction, args);
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); await charger(); return true;
  };
  const demander = (q: string) => { const m = window.prompt(q); return m?.trim() ? m.trim() : null; };
  const proposer = () => {
    if (!proposition) return;
    const { piece } = proposition;
    executer('proposer_paiement', { p_montant: Number(proposition.montant.replace(',', '.')), p_objet: proposition.objet.trim(),
      p_facture: piece.source === 'facture_loueur' ? piece.piece_id : null, p_bon: piece.source === 'bon_commande' ? piece.piece_id : null },
    'Bon à payer proposé.').then((ok) => { if (ok) setProposition(null); });
  };
  const rejeter = (p: Paiement) => { const m = demander(`Motif du rejet de ${p.numero}`); if (m) executer('decider_paiement', { p_id: p.id, p_approuver: false, p_motif: m }, 'Paiement rejeté.'); };
  const annuler = (p: Paiement) => { const m = demander(`Motif de l'annulation de ${p.numero}`); if (m) executer('annuler_paiement', { p_id: p.id, p_motif: m }, 'Paiement annulé.'); };
  const signalerAnomalie = (p: Paiement) => { const m = demander(`Anomalie constatée sur ${p.numero}`); if (m) executer('controler_paiement', { p_id: p.id, p_conforme: false, p_motif: m }, 'Anomalie enregistrée.'); };
  const enregistrerExecution = () => {
    if (!execution) return;
    executer('enregistrer_execution_paiement', { p_id: execution.paiement.id, p_date: execution.date, p_mode: execution.mode,
      p_montant: Number(execution.montant.replace(',', '.')), p_reference: execution.reference.trim() || null }, 'Paiement exécuté enregistré.')
      .then((ok) => { if (ok) setExecution(null); });
  };
  const montantProp = proposition ? Number(proposition.montant.replace(',', '.')) : NaN;
  const propositionValide = !!proposition && montantProp > 0 && montantProp <= proposition.piece.reste && !!proposition.objet.trim();
  const montantExe = execution ? Number(execution.montant.replace(',', '.')) : NaN;
  const executionValide = !!execution && !!execution.date && !!execution.mode && montantExe > 0 && montantExe <= execution.paiement.montant_propose
    && (!['virement', 'cheque'].includes(execution.mode) || !!execution.reference.trim());
  const moi = profile?.id;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Paiements fournisseurs</h2>
        <p className="text-sm text-stone-500">Bons à payer, approbation, paiements exécutés (hors SIGTB) et contrôle a posteriori. Aucun paiement n'est déclenché depuis l'application.</p></div>
      <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {proposition && <Panneau titre={`Bon à payer : ${proposition.piece.piece}`}>
      <p className="mb-2 text-sm text-stone-600">{proposition.piece.beneficiaire ?? 'Bénéficiaire non renseigné'} · reste à payer {montant(proposition.piece.reste, proposition.piece.devise)}</p>
      <div role="form" aria-label="Bon à payer" className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Montant ({proposition.piece.devise}) *<input inputMode="decimal" value={proposition.montant} onChange={(e) => setProposition({ ...proposition, montant: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm sm:col-span-2">Objet *<input value={proposition.objet} onChange={(e) => setProposition({ ...proposition, objet: e.target.value })} className={CHAMP} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !propositionValide} onClick={proposer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Proposer</button>
        <button onClick={() => setProposition(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    {execution && <Panneau titre={`Paiement exécuté : ${execution.paiement.numero}`}>
      <div role="form" aria-label="Paiement exécuté" className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">Date d'exécution *<input type="date" value={execution.date} onChange={(e) => setExecution({ ...execution, date: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Mode *<select value={execution.mode} onChange={(e) => setExecution({ ...execution, mode: e.target.value })} className={CHAMP}><option value="">Choisir</option>{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-sm">Montant exécuté ({execution.paiement.devise}) *<input inputMode="decimal" value={execution.montant} onChange={(e) => setExecution({ ...execution, montant: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Référence bancaire{['virement', 'cheque'].includes(execution.mode) ? ' *' : ''}<input value={execution.reference} onChange={(e) => setExecution({ ...execution, reference: e.target.value })} className={CHAMP} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !executionValide} onClick={enregistrerExecution} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer l'exécution</button>
        <button onClick={() => setExecution(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    <Panneau titre="Pièces payables">
      {pieces === null ? <p>Chargement…</p> : pieces.length === 0 ? <SansDonnees message="Aucune facture contrôlée ni bon de commande reçu" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Pièce</th><th className="py-2 pr-3">Bénéficiaire</th><th className="py-2 pr-3">Base</th><th className="py-2 pr-3">Engagé</th><th className="py-2 pr-3">Payé</th><th className="py-2 pr-3">Reste</th><th /></tr></thead>
          <tbody>{pieces.map((x) => <tr key={x.piece_id} className="border-b border-stone-100">
            <td className="py-2 pr-3"><b>{x.piece}</b><span className="block text-xs text-stone-500">{x.source === 'facture_loueur' ? 'Facture du loueur' : 'Bon de commande'} · {x.date_piece}</span></td>
            <td className="py-2 pr-3">{x.beneficiaire ?? 'Non renseigné'}</td><td className="py-2 pr-3">{montant(x.base, x.devise)}</td>
            <td className="py-2 pr-3">{montant(x.engage, x.devise)}</td><td className="py-2 pr-3">{montant(x.paye, x.devise)}</td><td className="py-2 pr-3 font-bold">{montant(x.reste, x.devise)}</td>
            <td className="py-2">{peutSaisir && x.reste > 0 && <button onClick={() => setProposition({ piece: x, montant: String(x.reste), objet: '' })} aria-label={`Proposer un paiement ${x.piece}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Bon à payer</button>}</td>
          </tr>)}</tbody></table></div>}
    </Panneau>

    <Panneau titre="Paiements">
      {paiements === null ? <p>Chargement…</p> : paiements.length === 0 ? <SansDonnees message="Aucun paiement enregistré" /> :
        <ul className="divide-y divide-stone-100 text-sm">{paiements.map((p) => <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
          <div><Wallet className="mr-1 inline h-4 w-4" /><b>{p.numero}</b> · {p.beneficiaire} · {p.objet} · {montant(p.montant_propose, p.devise)} <Puce teinte={STATUTS[p.statut]?.teinte ?? 'gris'}>{STATUTS[p.statut]?.texte ?? p.statut}</Puce>
            {p.statut === 'execute' && <span className="block text-xs text-stone-600">Exécuté le {p.execute_le} · {MODES[p.mode ?? ''] ?? p.mode} {p.reference_execution ?? ''} · {montant(p.montant_execute, p.devise)} · contrôle : {p.controle_resultat === null ? 'à faire' : p.controle_resultat === 'conforme' ? 'conforme' : `anomalie (${p.controle_motif})`}</span>}
            {(p.motif_decision || p.motif_annulation) && <span className="block text-xs text-stone-500">{p.motif_decision ?? p.motif_annulation}</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {peutApprouver && p.statut === 'propose' && (p.propose_par === moi
              ? <span className="text-xs text-stone-500">Approbation par une autre personne</span>
              : <>
                <button onClick={() => executer('decider_paiement', { p_id: p.id, p_approuver: true }, 'Paiement approuvé.')} aria-label={`Approuver ${p.numero}`} className="rounded bg-green-700 px-2 py-1 text-xs font-bold text-white">Approuver</button>
                <button onClick={() => rejeter(p)} aria-label={`Rejeter ${p.numero}`} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Rejeter</button>
              </>)}
            {peutSaisir && p.statut === 'approuve' && <button onClick={() => setExecution({ paiement: p, date: '', mode: '', montant: String(p.montant_propose), reference: '' })} aria-label={`Exécution ${p.numero}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Saisir l'exécution</button>}
            {peutSaisir && ['propose', 'approuve'].includes(p.statut) && <button onClick={() => annuler(p)} aria-label={`Annuler ${p.numero}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Annuler</button>}
            {peutApprouver && p.statut === 'execute' && p.controle_resultat === null && p.propose_par !== moi && p.execute_par !== moi && <>
              <button onClick={() => executer('controler_paiement', { p_id: p.id, p_conforme: true }, 'Contrôle enregistré.')} aria-label={`Contrôle conforme ${p.numero}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Contrôle conforme</button>
              <button onClick={() => signalerAnomalie(p)} aria-label={`Anomalie ${p.numero}`} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Anomalie</button>
            </>}
          </div>
        </li>)}</ul>}
    </Panneau>
  </div>;
};

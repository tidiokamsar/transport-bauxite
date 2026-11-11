import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, FileMinus2, PenTool, Printer, Send, Stamp, Undo2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { STATUTS_FACTURE, montant, type StatutFacture } from './facturation';
import { FactureImprimable, type DonneesFacture, type Societe } from './FactureImprimable';

// Factures et avoirs clients (phase 3, D-029). Le charge de contrats
// genere (depuis la reconciliation), soumet et emet ; le Directeur General
// seul signe ou renvoie. Une facture emise ne change plus : avoir.

interface Facture {
  id: string; numero: string | null; type: 'facture' | 'avoir'; contrat_id: string; facture_origine_id: string | null;
  objet: string; devise: string; taux_taxe_pct: number; montant_ht: number; montant_taxe: number; montant_ttc: number;
  statut: StatutFacture; date_emission: string | null; date_echeance: string | null; prepare_le: string; signee_le: string | null;
  prepare_par: string | null; motif: string | null;
}
interface Ligne { id: string; facture_id: string; libelle: string; quantite: number; unite: string; prix_unitaire: number; montant: number; ordre: number }
interface Journal { id: string; facture_id: string; action: string; motif: string | null; le: string }

const ACTIONS: Record<string, string> = {
  generation: 'Générée', soumettre: 'Soumise au DG', signer: 'Signée par le DG', renvoyer: 'Renvoyée par le DG', emettre: 'Émise', annuler: 'Annulée',
};

export const FacturesView = () => {
  const { hasPermission, profile, user } = useAuth();
  const peutEcrire = hasPermission('invoices', 'create') || hasPermission('invoices', 'edit');
  const estDG = profile?.role === 'director';
  const [factures, setFactures] = useState<Facture[] | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [journal, setJournal] = useState<Journal[]>([]);
  const [contrats, setContrats] = useState<{ id: string; reference: string; contrepartie: string }[]>([]);
  const [societe, setSociete] = useState<Societe | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [apercu, setApercu] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [f, c, s] = await Promise.all([
      supabase.from('factures').select('*').order('prepare_le', { ascending: false }),
      supabase.from('contrats').select('id, reference, contrepartie'),
      supabase.from('societe').select('*').eq('id', 1).maybeSingle(),
    ]);
    const liste = (f.data ?? []) as Facture[];
    setFactures(liste);
    setContrats((c.data ?? []) as { id: string; reference: string; contrepartie: string }[]);
    setSociete(s.data as Societe | null);
    setChoisie((x) => x ?? liste[0]?.id ?? null);
    setHeure(new Date());
  }, []);
  const chargerDetail = useCallback(async () => {
    if (!choisie) return;
    const [l, j] = await Promise.all([
      supabase.from('facture_lignes').select('*').eq('facture_id', choisie).order('ordre'),
      supabase.from('factures_journal').select('*').eq('facture_id', choisie).order('le'),
    ]);
    setLignes((l.data ?? []) as Ligne[]);
    setJournal((j.data ?? []) as Journal[]);
  }, [choisie]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { chargerDetail(); }, [chargerDetail]);

  const fac = factures?.find((x) => x.id === choisie) ?? null;
  const contrat = (id: string) => contrats.find((c) => c.id === id);
  const numeroDe = useMemo(() => new Map((factures ?? []).map((x) => [x.id, x.numero])), [factures]);
  const aSigner = (factures ?? []).filter((x) => x.statut === 'a_signer').length;

  const avancer = async (action: string, demanderMotif = false) => {
    if (!fac) return;
    const motif = demanderMotif ? window.prompt('Motif') : null;
    if (demanderMotif && !motif) return;
    const { error } = await supabase.rpc('avancer_facture', { p_id: fac.id, p_action: action, p_motif: motif, p_date: null });
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: `${fac.numero ?? 'Brouillon'} : ${ACTIONS[action] ?? action}` });
    charger();
    chargerDetail();
  };
  const avoir = async () => {
    if (!fac) return;
    const valeur = window.prompt(`Montant hors taxes de l'avoir (${fac.devise})`);
    if (!valeur) return;
    const motif = window.prompt('Motif de l\'avoir');
    if (!motif) return;
    const { data, error } = await supabase.rpc('creer_avoir', { p_facture_id: fac.id, p_montant_ht: Number(valeur.replace(/\s/g, '').replace(',', '.')), p_motif: motif });
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: 'Avoir créé en brouillon' });
    if (data) setChoisie(data as string);
    charger();
  };

  const donnees = (f: Facture): DonneesFacture => ({
    ...f, client: contrat(f.contrat_id)?.contrepartie ?? '', contrat: contrat(f.contrat_id)?.reference ?? '',
    origine: f.facture_origine_id ? numeroDe.get(f.facture_origine_id) ?? null : null, lignes,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-stone-900">Facturation</h2>
        <p className="text-stone-500">Factures et avoirs clients : préparés par le chargé de contrats, signés par le Directeur Général</p>
      </div>
      {estDG && aSigner > 0 && <p className="rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-900">{aSigner} facture(s) attendent votre signature.</p>}
      {message && <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}

      {factures === null ? (
        <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
      ) : factures.length === 0 ? (
        <Panneau><SansDonnees message="Aucune facture" detail="Les factures naissent d'une réconciliation mensuelle clôturée." /></Panneau>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <nav className="space-y-2 xl:col-span-4" aria-label="Factures">
            {factures.map((x) => (
              <button key={x.id} onClick={() => setChoisie(x.id)} className={`w-full rounded-2xl border p-3 text-left shadow-carte ${choisie === x.id ? 'border-orange-400 bg-orange-50' : 'border-stone-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono font-bold text-stone-900">{x.numero ?? (x.type === 'avoir' ? 'Avoir (brouillon)' : 'Facture (brouillon)')}</p>
                  <Puce teinte={STATUTS_FACTURE[x.statut].teinte}>{STATUTS_FACTURE[x.statut].libelle}</Puce>
                </div>
                <p className="text-sm text-stone-700">{contrat(x.contrat_id)?.contrepartie} · {montant(x.montant_ttc, x.devise)}</p>
                <p className="truncate text-xs text-stone-500">{x.objet}</p>
              </button>
            ))}
          </nav>
          {fac && (
            <div className="space-y-4 xl:col-span-8">
              <Panneau
                titre={`${fac.type === 'avoir' ? 'Avoir' : 'Facture'} ${fac.numero ?? '(brouillon)'}`}
                action={
                  <div className="flex flex-wrap gap-1 text-sm">
                    <button onClick={() => setApercu(true)} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5"><Printer className="h-4 w-4" /> Aperçu</button>
                    {peutEcrire && fac.statut === 'brouillon' && <button onClick={() => avancer('soumettre')} className="flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 font-bold text-white"><Send className="h-4 w-4" /> Soumettre au DG</button>}
                    {estDG && fac.statut === 'a_signer' && fac.prepare_par !== user?.id && <>
                      <button onClick={() => avancer('signer')} className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 font-bold text-white"><PenTool className="h-4 w-4" /> Signer</button>
                      <button onClick={() => avancer('renvoyer', true)} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5"><Undo2 className="h-4 w-4" /> Renvoyer</button>
                    </>}
                    {peutEcrire && fac.statut === 'signee' && <button onClick={() => avancer('emettre')} className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 font-bold text-white"><Stamp className="h-4 w-4" /> Émettre</button>}
                    {peutEcrire && fac.statut === 'emise' && fac.type === 'facture' && <button onClick={avoir} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5"><FileMinus2 className="h-4 w-4" /> Avoir</button>}
                    {peutEcrire && ['brouillon', 'a_signer'].includes(fac.statut) && <button onClick={() => avancer('annuler', true)} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-red-600 hover:bg-red-50"><Ban className="h-4 w-4" /> Annuler</button>}
                  </div>
                }
              >
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-stone-500">Client</dt><dd className="font-semibold">{contrat(fac.contrat_id)?.contrepartie} · {contrat(fac.contrat_id)?.reference}</dd></div>
                  <div><dt className="text-stone-500">Hors taxes</dt><dd className="font-semibold">{montant(fac.montant_ht, fac.devise)}</dd></div>
                  <div><dt className="text-stone-500">Taxe ({Number(fac.taux_taxe_pct).toLocaleString('fr-FR')} %)</dt><dd className="font-semibold">{montant(fac.montant_taxe, fac.devise)}</dd></div>
                  <div><dt className="text-stone-500">TTC</dt><dd className="text-lg font-black">{montant(fac.montant_ttc, fac.devise)}</dd></div>
                </dl>
                <p className="mt-2 text-sm text-stone-600">{fac.objet}</p>
                {fac.date_emission && <p className="text-sm text-stone-600">Émise le {new Date(fac.date_emission + 'T00:00:00').toLocaleDateString('fr-FR')} · échéance {fac.date_echeance ? new Date(fac.date_echeance + 'T00:00:00').toLocaleDateString('fr-FR') : 'non définie (délai absent du contrat)'}</p>}
                <table className="mt-4 w-full text-sm">
                  <thead><tr className="border-b border-stone-200 text-left text-stone-500"><th className="py-2">Désignation</th><th className="py-2 text-right">Quantité</th><th className="py-2 text-right">Prix</th><th className="py-2 text-right">Montant</th></tr></thead>
                  <tbody>{lignes.map((l) => (
                    <tr key={l.id} className="border-b border-stone-100"><td className="py-2">{l.libelle}</td><td className="py-2 text-right">{Number(l.quantite).toLocaleString('fr-FR')} {l.unite}</td>
                      <td className="py-2 text-right">{montant(l.prix_unitaire, fac.devise)}</td><td className="py-2 text-right font-semibold">{montant(l.montant, fac.devise)}</td></tr>
                  ))}</tbody>
                </table>
              </Panneau>
              <Panneau titre="Historique">
                <ul className="space-y-1 text-sm">{journal.map((j) => (
                  <li key={j.id}><span className="text-stone-500">{new Date(j.le).toLocaleString('fr-FR')}</span> · <b>{ACTIONS[j.action] ?? j.action}</b>{j.motif ? ` · ${j.motif}` : ''}</li>
                ))}</ul>
              </Panneau>
            </div>
          )}
        </div>
      )}
      <Provenance source="factures générées depuis les réconciliations clôturées, au tarif du contrat en vigueur ; circuit de signature tracé" heure={heure} />
      {apercu && fac && <FactureImprimable facture={donnees(fac)} societe={societe} onFermer={() => setApercu(false)} />}
    </div>
  );
};

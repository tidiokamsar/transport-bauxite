import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Printer, Wallet, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { montant } from './facturation';

// Recouvrement des factures clients (phase 4, D-031) : creances, encaissements
// (saisis par la comptabilite ou le charge de contrats, au plus le reste du),
// relances par niveau apres l'echeance, lettre imprimable.

interface Creance {
  id: string; numero: string; contrat_id: string; devise: string; date_emission: string; date_echeance: string | null;
  montant_ttc: number; avoirs: number; du: number; encaisse: number; reste: number; jours_retard: number | null;
  dernier_encaissement: string | null; derniere_relance_niveau: number | null; derniere_relance_le: string | null;
}
interface Societe { raison_sociale: string; adresse: string | null; rccm: string | null; nif: string | null; signataire_nom: string | null; signataire_fonction: string | null }

const NIVEAUX: Record<number, string> = { 1: 'Rappel', 2: 'Relance', 3: 'Mise en demeure' };
const CANAUX: Record<string, string> = { email: 'E-mail', courrier: 'Courrier', telephone: 'Téléphone', remise_main: 'Remise en main propre' };
const MODES: Record<string, string> = { virement: 'Virement', cheque: 'Chèque', especes: 'Espèces', compensation: 'Compensation', autre: 'Autre' };
const jour = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—');
const CHAMP = 'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm';

export const RecouvrementView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('invoices', 'create') || hasPermission('invoices', 'edit');
  const [creances, setCreances] = useState<Creance[] | null>(null);
  const [clients, setClients] = useState<Map<string, string>>(new Map());
  const [societe, setSociete] = useState<Societe | null>(null);
  const [filtre, setFiltre] = useState<'ouvertes' | 'retard' | 'toutes'>('ouvertes');
  const [encaisser, setEncaisser] = useState<Creance | null>(null);
  const [relancer, setRelancer] = useState<Creance | null>(null);
  const [lettre, setLettre] = useState<{ creance: Creance; niveau: number } | null>(null);
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), montant: '', mode: 'virement', reference: '', canal: 'email', note: '' });
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [c, k, s] = await Promise.all([
      supabase.from('v_creances').select('*').order('date_echeance'),
      supabase.from('contrats').select('id, contrepartie'),
      supabase.from('societe').select('raison_sociale, adresse, rccm, nif, signataire_nom, signataire_fonction').eq('id', 1).maybeSingle(),
    ]);
    setCreances((c.data ?? []) as Creance[]);
    setClients(new Map(((k.data ?? []) as { id: string; contrepartie: string }[]).map((x) => [x.id, x.contrepartie])));
    setSociete(s.data as Societe | null);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const visibles = (creances ?? []).filter((x) => filtre === 'toutes' || (filtre === 'retard' ? (x.jours_retard ?? 0) > 0 : Number(x.reste) > 0));
  const totaux = useMemo(() => {
    const ouvertes = (creances ?? []).filter((x) => Number(x.reste) > 0);
    const parDevise = new Map<string, { reste: number; retard: number }>();
    for (const x of ouvertes) {
      const t = parDevise.get(x.devise) ?? { reste: 0, retard: 0 };
      t.reste += Number(x.reste);
      if ((x.jours_retard ?? 0) > 0) t.retard += Number(x.reste);
      parDevise.set(x.devise, t);
    }
    return { nombre: ouvertes.length, enRetard: ouvertes.filter((x) => (x.jours_retard ?? 0) > 0).length, parDevise };
  }, [creances]);

  const enregistrer = async () => {
    if (!encaisser) return;
    const { error } = await supabase.rpc('enregistrer_encaissement', {
      p_facture_id: encaisser.id, p_date: f.date, p_montant: Number(f.montant.replace(/\s/g, '').replace(',', '.')),
      p_mode: f.mode, p_reference: f.reference || null, p_note: f.note || null,
    });
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: `Encaissement enregistré sur ${encaisser.numero}` });
    if (!error) setEncaisser(null);
    charger();
  };
  const envoyerRelance = async () => {
    if (!relancer) return;
    const { data, error } = await supabase.rpc('relancer', { p_facture_id: relancer.id, p_canal: f.canal, p_note: f.note || null });
    if (error) { setMessage({ ok: false, texte: error.message }); return; }
    setMessage({ ok: true, texte: `${NIVEAUX[data as number]} enregistré(e) sur ${relancer.numero}` });
    setLettre({ creance: relancer, niveau: data as number });
    setRelancer(null);
    charger();
  };

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-stone-900">Recouvrement</h2><p className="text-stone-500">Créances clients, encaissements et relances après l'échéance</p></div>
      {message && <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Synthèse des créances">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">Factures non soldées</p><p className="text-2xl font-black">{creances ? totaux.nombre : '—'}</p></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">Reste dû</p><p className="text-lg font-black">{[...totaux.parDevise].map(([d, t]) => montant(t.reste, d)).join(' · ') || '—'}</p></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">En retard ({totaux.enRetard})</p><p className="text-lg font-black text-red-700">{[...totaux.parDevise].filter(([, t]) => t.retard > 0).map(([d, t]) => montant(t.retard, d)).join(' · ') || '—'}</p></div>
      </section>
      <Panneau titre="Créances" action={<div className="flex gap-1 text-sm">{(['ouvertes', 'retard', 'toutes'] as const).map((x) => <button key={x} onClick={() => setFiltre(x)} className={`rounded-lg px-2.5 py-1 ${filtre === x ? 'bg-orange-100 font-semibold text-orange-800' : 'text-stone-600 hover:bg-stone-100'}`}>{x === 'ouvertes' ? 'Non soldées' : x === 'retard' ? 'En retard' : 'Toutes'}</button>)}</div>}>
        {creances === null ? <div className="h-16" /> : visibles.length === 0 ? <SansDonnees message="Aucune créance" detail="Les créances naissent des factures émises." /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2 pr-3 font-medium">Facture</th><th className="py-2 pr-3 text-right font-medium">Dû</th><th className="py-2 pr-3 text-right font-medium">Encaissé</th>
              <th className="py-2 pr-3 text-right font-medium">Reste</th><th className="py-2 pr-3 font-medium">Échéance</th><th className="py-2 pr-3 font-medium">Relance</th>{peutEcrire && <th className="py-2" />}
            </tr></thead>
            <tbody>{visibles.map((x) => (
              <tr key={x.id} className="border-b border-stone-100 last:border-0">
                <td className="py-2 pr-3"><p className="font-mono font-semibold">{x.numero}</p><p className="text-xs text-stone-500">{clients.get(x.contrat_id)} · émise le {jour(x.date_emission)}</p></td>
                <td className="py-2 pr-3 text-right">{montant(x.du, x.devise)}</td><td className="py-2 pr-3 text-right">{montant(x.encaisse, x.devise)}</td>
                <td className="py-2 pr-3 text-right font-semibold">{Number(x.reste) <= 0 ? <Puce teinte="vert">Soldée</Puce> : montant(x.reste, x.devise)}</td>
                <td className="py-2 pr-3">{jour(x.date_echeance)}{(x.jours_retard ?? 0) > 0 && <span className="ml-1 font-semibold text-red-700">({x.jours_retard} j de retard)</span>}</td>
                <td className="py-2 pr-3 text-xs">{x.derniere_relance_niveau ? `${NIVEAUX[x.derniere_relance_niveau]} le ${jour(x.derniere_relance_le)}` : '—'}</td>
                {peutEcrire && <td className="whitespace-nowrap py-2 text-xs">
                  {Number(x.reste) > 0 && <button onClick={() => { setEncaisser(x); setF({ ...f, montant: String(x.reste), note: '' }); }} className="mr-1 rounded bg-green-50 px-2 py-1 font-semibold text-green-700" aria-label={`Encaisser ${x.numero}`}><Wallet className="inline h-3.5 w-3.5" /> Encaisser</button>}
                  {Number(x.reste) > 0 && (x.jours_retard ?? 0) > 0 && (x.derniere_relance_niveau ?? 0) < 3 && <button onClick={() => { setRelancer(x); setF({ ...f, note: '' }); }} className="rounded bg-orange-50 px-2 py-1 font-semibold text-orange-800" aria-label={`Relancer ${x.numero}`}><BellRing className="inline h-3.5 w-3.5" /> {NIVEAUX[(x.derniere_relance_niveau ?? 0) + 1]}</button>}
                </td>}
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Provenance source="factures émises, avoirs émis, encaissements saisis, relances ; retard = jours depuis l'échéance tant qu'un reste est dû" heure={heure} />
      </Panneau>

      {(encaisser || relancer) && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={() => { setEncaisser(null); setRelancer(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={encaisser ? 'Enregistrer un encaissement' : 'Relancer'}>
            <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <h2 className="text-xl font-black">{encaisser ? `Encaissement · ${encaisser.numero}` : `${NIVEAUX[((relancer?.derniere_relance_niveau ?? 0) + 1)]} · ${relancer?.numero}`}</h2>
              <button onClick={() => { setEncaisser(null); setRelancer(null); }} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
            </header>
            <div className="grid grid-cols-1 gap-3 px-6 py-5 text-sm sm:grid-cols-2">
              {encaisser ? <>
                <label>Date *<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={CHAMP} /></label>
                <label>Montant * ({encaisser.devise})<input inputMode="decimal" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} className={CHAMP} /></label>
                <label>Mode<select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} className={CHAMP}>{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>Référence bancaire<input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={CHAMP} /></label>
              </> : (
                <label className="sm:col-span-2">Canal<select value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })} className={CHAMP}>{Object.entries(CANAUX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              )}
              <label className="sm:col-span-2">Note<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={CHAMP} /></label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
              <button onClick={() => { setEncaisser(null); setRelancer(null); }} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">Annuler</button>
              <button onClick={encaisser ? enregistrer : envoyerRelance} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white">Enregistrer</button>
            </footer>
          </div>
        </div>
      )}

      {lettre && (
        <div className="fixed inset-0 z-[950] overflow-y-auto bg-stone-200/90 p-6">
          <div className="pas-imprime mx-auto mb-4 flex max-w-[210mm] justify-end gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white"><Printer className="h-4 w-4" /> Imprimer</button>
            <button onClick={() => setLettre(null)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm" aria-label="Fermer la lettre"><X className="h-4 w-4" /> Fermer</button>
          </div>
          <div className="zone-impression">
            <article className="mx-auto max-w-[210mm] bg-white p-12 text-sm text-black shadow" aria-label="Lettre de relance">
              <p className="font-black">{societe?.raison_sociale}</p>
              <p>{societe?.adresse}</p><p>{[societe?.rccm && `RCCM ${societe.rccm}`, societe?.nif && `NIF ${societe.nif}`].filter(Boolean).join(' · ')}</p>
              <p className="mt-8 text-right">À l'attention de {clients.get(lettre.creance.contrat_id)}</p>
              <p className="text-right">Le {new Date().toLocaleDateString('fr-FR')}</p>
              <p className="mt-8 font-bold uppercase">Objet : {NIVEAUX[lettre.niveau]} · facture {lettre.creance.numero}</p>
              <p className="mt-4">Madame, Monsieur,</p>
              <p className="mt-2">Sauf erreur de notre part, la facture n° {lettre.creance.numero} émise le {jour(lettre.creance.date_emission)}, échue le {jour(lettre.creance.date_echeance)}, présente un solde impayé de <b>{montant(lettre.creance.reste, lettre.creance.devise)}</b> (montant dû {montant(lettre.creance.du, lettre.creance.devise)}, déjà réglé {montant(lettre.creance.encaisse, lettre.creance.devise)}).</p>
              <p className="mt-2">{lettre.niveau === 3
                ? 'Malgré nos précédentes relances, ce montant reste impayé. Nous vous mettons en demeure de le régler sous huit jours à compter de la réception de la présente, faute de quoi nous nous réservons le droit d\'engager toute action utile au recouvrement de notre créance.'
                : lettre.niveau === 2 ? 'Notre précédent rappel étant resté sans effet, nous vous prions de bien vouloir procéder au règlement dans les meilleurs délais.'
                : 'Nous vous remercions de bien vouloir procéder à son règlement. Si votre paiement a été effectué entre-temps, merci de ne pas tenir compte de ce rappel.'}</p>
              <p className="mt-4">Veuillez agréer, Madame, Monsieur, nos salutations distinguées.</p>
              <p className="mt-10 font-bold">{societe?.signataire_fonction ?? 'Pour la société'}</p><p>{societe?.signataire_nom ?? ''}</p>
            </article>
          </div>
        </div>
      )}
    </div>
  );
};

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSearch, Plus, Printer, Send, Trash2, Wallet, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { montant } from '../Facturation/facturation';

// Controle des factures du loueur (phase 5, D-032 ; type de facturation et
// tarif par engin, D-033). Le charge de contrats saisit la facture recue ;
// le serveur la confronte, dans l'unite du tarif de chaque engin (heures
// pointees ou kilometres releves des voyages livres), au tarif du contrat ;
// l'ecart est notifie formellement puis suivi jusqu'a sa regularisation.

interface FactureF {
  id: string; contrat_id: string; numero_fournisseur: string; date_facture: string; periode_debut: string; periode_fin: string;
  devise: string; montant_ht_facture: number; statut: 'saisie' | 'controlee' | 'notifiee' | 'regularisee' | 'conforme';
  montant_attendu: number | null; ecart_total: number | null; montant_reclame: number | null; notifiee_le: string | null;
  reference_notification: string | null; controle_le: string | null;
}
interface LigneF {
  id: string; facture_id: string; vehicle_id: string | null; libelle: string; categorie_materiel: string | null;
  quantite_facturee: number | null; unite_facturee: string | null; heures_facturees: number | null; taux_facture: number | null; montant_facture: number;
  quantite_attendue: number | null; unite_attendue: string | null; heures_attendues: number | null;
  taux_attendu: number | null; montant_attendu: number | null; heures_arret_loueur: number | null;
  ecart: number | null; constat: string | null;
}
interface Regul { id: string; facture_id: string; date_regularisation: string; montant: number; mode: string; reference: string | null }
interface Contrat { id: string; reference: string; contrepartie: string; devise: string; nature: string }
interface Societe { raison_sociale: string; adresse: string | null; rccm: string | null; nif: string | null; signataire_nom: string | null; signataire_fonction: string | null }

const STATUTS: Record<FactureF['statut'], { l: string; t: 'gris' | 'bleu' | 'orange' | 'vert' }> = {
  saisie: { l: 'Saisie', t: 'gris' }, controlee: { l: 'Contrôlée', t: 'bleu' }, notifiee: { l: 'Écart notifié', t: 'orange' },
  regularisee: { l: 'Régularisée', t: 'vert' }, conforme: { l: 'Conforme', t: 'vert' },
};
const MODES: Record<string, string> = { avoir: 'Avoir du loueur', deduction: 'Déduction sur paiement', remboursement: 'Remboursement' };
const UNITES: Record<string, string> = { heure: 'Heures', km: 'Kilomètres', tonne: 'Tonnes', jour: 'Jours', mois: 'Mois', forfait: 'Forfaits', autre: 'Autre' };
const COURT: Record<string, string> = { heure: 'h', km: 'km', tonne: 't', jour: 'j', mois: 'mois', forfait: 'forfait', autre: '' };
const jour = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—');
const CHAMP = 'mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm';
const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));

interface LigneSaisie { vehicule: string; libelle: string; categorie: string; quantite: string; unite: string; taux: string; montant: string }
const ligneVide = (): LigneSaisie => ({ vehicule: '', libelle: '', categorie: '', quantite: '', unite: 'heure', taux: '', montant: '' });

export const FacturesNeembaView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [factures, setFactures] = useState<FactureF[] | null>(null);
  const [lignes, setLignes] = useState<LigneF[]>([]);
  const [reguls, setReguls] = useState<Regul[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [engins, setEngins] = useState<{ id: string; registration: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [societe, setSociete] = useState<Societe | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [saisie, setSaisie] = useState(false);
  const [entete, setEntete] = useState({ contrat: '', numero: '', date: '', debut: '', fin: '', ht: '' });
  const [lignesSaisie, setLignesSaisie] = useState<LigneSaisie[]>([ligneVide()]);
  const [regul, setRegul] = useState(false);
  const [r, setR] = useState({ date: new Date().toISOString().slice(0, 10), montant: '', mode: 'avoir', reference: '' });
  const [lettre, setLettre] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [f, c, v, t, s] = await Promise.all([
      supabase.from('factures_fournisseur').select('*').order('date_facture', { ascending: false }),
      supabase.from('contrats').select('id, reference, contrepartie, devise, nature').eq('nature', 'location').order('reference'),
      supabase.from('vehicles').select('id, registration').order('registration'),
      supabase.from('contrat_tarifs').select('categorie_materiel'),
      supabase.from('societe').select('raison_sociale, adresse, rccm, nif, signataire_nom, signataire_fonction').eq('id', 1).maybeSingle(),
    ]);
    const liste = (f.data ?? []) as FactureF[];
    setFactures(liste);
    setContrats((c.data ?? []) as Contrat[]);
    setEngins((v.data ?? []) as { id: string; registration: string }[]);
    setCategories([...new Set(((t.data ?? []) as { categorie_materiel: string | null }[]).map((x) => x.categorie_materiel).filter((x): x is string => Boolean(x)))]);
    setSociete(s.data as Societe | null);
    setChoisie((x) => x ?? liste[0]?.id ?? null);
    setHeure(new Date());
  }, []);
  const chargerDetail = useCallback(async () => {
    if (!choisie) return;
    const [l, g] = await Promise.all([
      supabase.from('factures_fournisseur_lignes').select('*').eq('facture_id', choisie).order('libelle'),
      supabase.from('regularisations_fournisseur').select('*').eq('facture_id', choisie).order('date_regularisation'),
    ]);
    setLignes((l.data ?? []) as LigneF[]);
    setReguls((g.data ?? []) as Regul[]);
  }, [choisie]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { chargerDetail(); }, [chargerDetail]);

  const fac = factures?.find((x) => x.id === choisie) ?? null;
  const contrat = (id: string) => contrats.find((c) => c.id === id);
  const immat = useMemo(() => new Map(engins.map((e) => [e.id, e.registration])), [engins]);
  const recouvre = reguls.reduce((s, x) => s + Number(x.montant), 0);

  const enregistrerFacture = async () => {
    const c = contrat(entete.contrat);
    const ht = nombre(entete.ht);
    if (!c || !entete.numero.trim() || !entete.date || !entete.debut || !entete.fin || ht === null) { setMessage({ ok: false, texte: 'En-tête incomplet : contrat, numéro, date, période et montant HT requis' }); return; }
    const remplies = lignesSaisie.filter((l) => l.vehicule || l.libelle.trim());
    if (remplies.length === 0 || remplies.some((l) => nombre(l.montant) === null)) { setMessage({ ok: false, texte: 'Chaque ligne demande un engin ou un libellé, et son montant' }); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from('factures_fournisseur').insert({
      id, contrat_id: c.id, numero_fournisseur: entete.numero.trim(), date_facture: entete.date,
      periode_debut: entete.debut, periode_fin: entete.fin, devise: c.devise, montant_ht_facture: ht,
    });
    if (error) { setMessage({ ok: false, texte: error.code === '23505' ? 'Ce numéro de facture existe déjà pour ce contrat' : error.message }); return; }
    const { error: e2 } = await supabase.from('factures_fournisseur_lignes').insert(remplies.map((l) => ({
      facture_id: id, vehicle_id: l.vehicule || null, libelle: l.libelle.trim() || immat.get(l.vehicule) || 'Ligne',
      categorie_materiel: l.categorie || null, quantite_facturee: nombre(l.quantite), unite_facturee: l.quantite.trim() === '' ? null : l.unite,
      taux_facture: nombre(l.taux), montant_facture: nombre(l.montant),
    })));
    setMessage(e2 ? { ok: false, texte: `Facture créée, lignes refusées : ${e2.message}` } : { ok: true, texte: 'Facture saisie : lancez le contrôle' });
    setSaisie(false);
    setChoisie(id);
    charger();
  };
  const appeler = async (fonction: string, parametres: Record<string, unknown>, succes: string) => {
    const { data, error } = await supabase.rpc(fonction, parametres);
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: succes });
    charger();
    chargerDetail();
    return error ? null : data;
  };
  const notifier = async () => {
    if (!fac) return;
    const reference = window.prompt('Référence du courrier de notification (facultatif)') ?? null;
    const res = await appeler('notifier_ecart_fournisseur', { p_id: fac.id, p_date: new Date().toISOString().slice(0, 10), p_reference: reference },
      'Notification enregistrée');
    if (res === 'notifiee') setLettre(true);
    if (res === 'conforme') setMessage({ ok: true, texte: 'Facture conforme : aucun écart à notifier' });
  };

  const lignesEcart = lignes.filter((l) => (l.ecart ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black text-stone-900">Contrôle des factures Neemba</h2><p className="text-stone-500">Quantités facturées confrontées, dans l'unité du tarif de chaque engin (heures pointées ou kilomètres relevés), au contrat de location</p></div>
        {peutEcrire && <button onClick={() => { setSaisie(true); setEntete({ contrat: contrats[0]?.id ?? '', numero: '', date: '', debut: '', fin: '', ht: '' }); setLignesSaisie([ligneVide()]); }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Saisir une facture reçue</button>}
      </div>
      {message && <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}
      {contrats.length === 0 && <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">Aucun contrat de location : saisissez le contrat Neemba (nature « Location ») et ses tarifs par engin (à l'heure ou au kilomètre, D-033) dans le dossier contractuel.</p>}

      {factures === null ? <div className="h-16" /> : factures.length === 0 ? <Panneau><SansDonnees message="Aucune facture du loueur" detail="Saisissez la facture Neemba reçue pour la contrôler." /></Panneau> : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <nav className="space-y-2 xl:col-span-4" aria-label="Factures du loueur">
            {factures.map((x) => (
              <button key={x.id} onClick={() => setChoisie(x.id)} className={`w-full rounded-2xl border p-3 text-left shadow-carte ${choisie === x.id ? 'border-orange-400 bg-orange-50' : 'border-stone-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2"><p className="font-mono font-bold">{x.numero_fournisseur}</p><Puce teinte={STATUTS[x.statut].t}>{STATUTS[x.statut].l}</Puce></div>
                <p className="text-sm text-stone-700">{contrat(x.contrat_id)?.contrepartie} · {montant(x.montant_ht_facture, x.devise)}</p>
                <p className="text-xs text-stone-500">Du {jour(x.periode_debut)} au {jour(x.periode_fin)}{x.montant_reclame ? ` · réclamé ${montant(x.montant_reclame, x.devise)}` : ''}</p>
              </button>
            ))}
          </nav>
          {fac && (
            <div className="space-y-4 xl:col-span-8">
              <Panneau titre={`Facture ${fac.numero_fournisseur} du ${jour(fac.date_facture)}`} action={
                <div className="flex flex-wrap gap-1 text-sm">
                  {peutEcrire && ['saisie', 'controlee'].includes(fac.statut) && <button onClick={() => appeler('controler_facture_fournisseur', { p_id: fac.id }, 'Contrôle effectué')} className="flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 font-bold text-white"><FileSearch className="h-4 w-4" /> Contrôler</button>}
                  {peutEcrire && fac.statut === 'controlee' && <button onClick={notifier} className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white"><Send className="h-4 w-4" /> Notifier l'écart</button>}
                  {fac.statut !== 'saisie' && fac.statut !== 'controlee' && fac.statut !== 'conforme' && <button onClick={() => setLettre(true)} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5"><Printer className="h-4 w-4" /> Notification</button>}
                  {peutEcrire && fac.statut === 'notifiee' && <button onClick={() => { setRegul(true); setR({ ...r, montant: String(Number(fac.montant_reclame ?? 0) - recouvre) }); }} className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 font-bold text-white"><Wallet className="h-4 w-4" /> Régularisation</button>}
                </div>
              }>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-stone-500">Facturé HT</dt><dd className="font-semibold">{montant(fac.montant_ht_facture, fac.devise)}</dd></div>
                  <div><dt className="text-stone-500">Attendu (lignes contrôlables)</dt><dd className="font-semibold">{fac.montant_attendu === null ? '—' : montant(fac.montant_attendu, fac.devise)}</dd></div>
                  <div><dt className="text-stone-500">Réclamé</dt><dd className="text-lg font-black text-red-700">{fac.montant_reclame === null ? '—' : montant(fac.montant_reclame, fac.devise)}</dd></div>
                  <div><dt className="text-stone-500">Recouvré</dt><dd className="text-lg font-black text-green-700">{montant(recouvre, fac.devise)}</dd></div>
                </dl>
                {fac.notifiee_le && <p className="mt-2 text-sm text-stone-600">Notifiée le {jour(fac.notifiee_le)}{fac.reference_notification ? ` · réf. ${fac.reference_notification}` : ''}</p>}
                <div className="mt-4 overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="py-2 pr-2 font-medium">Ligne</th><th className="py-2 pr-2 text-right font-medium">Quantité facturée</th><th className="py-2 pr-2 text-right font-medium">Quantité attendue</th>
                    <th className="py-2 pr-2 text-right font-medium">Arrêt loueur</th><th className="py-2 pr-2 text-right font-medium">Facturé</th><th className="py-2 pr-2 text-right font-medium">Attendu</th><th className="py-2 text-right font-medium">Écart</th>
                  </tr></thead>
                  <tbody>{lignes.map((l) => (
                    <tr key={l.id} className="border-b border-stone-100 align-top last:border-0">
                      <td className="py-2 pr-2"><p className="font-semibold">{l.vehicle_id ? immat.get(l.vehicle_id) ?? l.libelle : l.libelle}</p><p className="text-xs text-stone-500">{l.categorie_materiel ?? ''}{l.constat ? ` · ${l.constat}` : ''}</p></td>
                      <td className="py-2 pr-2 text-right">{l.quantite_facturee ?? l.heures_facturees ?? '—'}{l.quantite_facturee !== null && l.unite_facturee ? ` ${COURT[l.unite_facturee] ?? l.unite_facturee}` : ''}</td>
                      <td className="py-2 pr-2 text-right">{l.quantite_attendue ?? '—'}{l.quantite_attendue !== null && l.unite_attendue ? ` ${COURT[l.unite_attendue] ?? l.unite_attendue}` : ''}</td>
                      <td className="py-2 pr-2 text-right">{l.heures_arret_loueur ? `${l.heures_arret_loueur} h` : '—'}</td>
                      <td className="py-2 pr-2 text-right">{montant(l.montant_facture, fac.devise)}</td><td className="py-2 pr-2 text-right">{l.montant_attendu === null ? '—' : montant(l.montant_attendu, fac.devise)}</td>
                      <td className={`py-2 text-right font-semibold ${(l.ecart ?? 0) > 0 ? 'text-red-700' : ''}`}>{l.ecart === null ? '—' : montant(l.ecart, fac.devise)}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
                <Provenance source="unité et tarif de chaque engin dans la version du contrat en vigueur à la fin de la période : heures de marche des fiches de pointage signées ou kilomètres relevés des voyages livrés ; immobilisations imputées au loueur" heure={heure} />
              </Panneau>
              {reguls.length > 0 && (
                <Panneau titre="Régularisations">
                  <ul className="text-sm">{reguls.map((g) => <li key={g.id}>{jour(g.date_regularisation)} · {MODES[g.mode] ?? g.mode} · <b>{montant(g.montant, fac.devise)}</b>{g.reference ? ` · réf. ${g.reference}` : ''}</li>)}</ul>
                </Panneau>
              )}
            </div>
          )}
        </div>
      )}

      {saisie && (
        <div className="fixed inset-0 z-[900] flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={() => setSaisie(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Saisir une facture reçue">
            <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4"><h2 className="text-xl font-black">Facture reçue du loueur</h2><button onClick={() => setSaisie(false)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button></header>
            <div className="space-y-4 px-6 py-5 text-sm">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <label className="md:col-span-2">Contrat *<select value={entete.contrat} onChange={(e) => setEntete({ ...entete, contrat: e.target.value })} className={CHAMP}>{contrats.map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.contrepartie}</option>)}</select></label>
                <label>N° de facture *<input value={entete.numero} onChange={(e) => setEntete({ ...entete, numero: e.target.value })} className={CHAMP} /></label>
                <label>Date *<input type="date" value={entete.date} onChange={(e) => setEntete({ ...entete, date: e.target.value })} className={CHAMP} /></label>
                <label>Période du *<input type="date" value={entete.debut} onChange={(e) => setEntete({ ...entete, debut: e.target.value })} className={CHAMP} /></label>
                <label>au *<input type="date" value={entete.fin} onChange={(e) => setEntete({ ...entete, fin: e.target.value })} className={CHAMP} /></label>
                <label>Montant HT facturé *<input inputMode="decimal" value={entete.ht} onChange={(e) => setEntete({ ...entete, ht: e.target.value })} className={CHAMP} /></label>
              </div>
              <p className="font-semibold">Lignes de la facture</p>
              {lignesSaisie.map((l, i) => (
                <div key={i} className="grid grid-cols-2 items-end gap-2 md:grid-cols-8">
                  <label className="md:col-span-2">Engin<select aria-label={`Ligne ${i + 1} engin`} value={l.vehicule} onChange={(e) => setLignesSaisie(lignesSaisie.map((x, j) => (j === i ? { ...x, vehicule: e.target.value } : x)))} className={CHAMP}><option value="">Sans engin (frais)</option>{engins.map((e) => <option key={e.id} value={e.id}>{e.registration}</option>)}</select></label>
                  <label>Catégorie<select value={l.categorie} onChange={(e) => setLignesSaisie(lignesSaisie.map((x, j) => (j === i ? { ...x, categorie: e.target.value } : x)))} className={CHAMP}><option value="">—</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                  <label>Quantité<input aria-label={`Ligne ${i + 1} quantité`} inputMode="decimal" value={l.quantite} onChange={(e) => setLignesSaisie(lignesSaisie.map((x, j) => (j === i ? { ...x, quantite: e.target.value } : x)))} className={CHAMP} /></label>
                  <label>Unité<select aria-label={`Ligne ${i + 1} unité`} value={l.unite} onChange={(e) => setLignesSaisie(lignesSaisie.map((x, j) => (j === i ? { ...x, unite: e.target.value } : x)))} className={CHAMP}>{Object.entries(UNITES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  <label>Taux<input aria-label={`Ligne ${i + 1} taux`} inputMode="decimal" value={l.taux} onChange={(e) => setLignesSaisie(lignesSaisie.map((x, j) => (j === i ? { ...x, taux: e.target.value } : x)))} className={CHAMP} /></label>
                  <label>Montant *<input aria-label={`Ligne ${i + 1} montant`} inputMode="decimal" value={l.montant} onChange={(e) => setLignesSaisie(lignesSaisie.map((x, j) => (j === i ? { ...x, montant: e.target.value } : x)))} className={CHAMP} /></label>
                  <div className="flex items-end gap-1">{!l.vehicule && <input placeholder="Libellé" value={l.libelle} onChange={(e) => setLignesSaisie(lignesSaisie.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)))} className={CHAMP} />}<button onClick={() => setLignesSaisie(lignesSaisie.filter((_, j) => j !== i))} className="rounded p-2 text-stone-400 hover:text-red-600" aria-label={`Retirer la ligne ${i + 1}`}><Trash2 className="h-4 w-4" /></button></div>
                </div>
              ))}
              <button onClick={() => setLignesSaisie([...lignesSaisie, ligneVide()])} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Ligne</button>
            </div>
            <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4"><button onClick={() => setSaisie(false)} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">Annuler</button><button onClick={enregistrerFacture} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white">Enregistrer la facture</button></footer>
          </div>
        </div>
      )}

      {regul && fac && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={() => setRegul(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Régularisation">
            <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4"><h2 className="text-xl font-black">Régularisation · {fac.numero_fournisseur}</h2><button onClick={() => setRegul(false)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button></header>
            <div className="grid grid-cols-2 gap-3 px-6 py-5 text-sm">
              <label>Date *<input type="date" value={r.date} onChange={(e) => setR({ ...r, date: e.target.value })} className={CHAMP} /></label>
              <label>Montant * ({fac.devise})<input inputMode="decimal" value={r.montant} onChange={(e) => setR({ ...r, montant: e.target.value })} className={CHAMP} /></label>
              <label>Mode<select value={r.mode} onChange={(e) => setR({ ...r, mode: e.target.value })} className={CHAMP}>{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Référence<input value={r.reference} onChange={(e) => setR({ ...r, reference: e.target.value })} className={CHAMP} /></label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4"><button onClick={() => setRegul(false)} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">Annuler</button>
              <button onClick={async () => { if (await appeler('enregistrer_regularisation', { p_id: fac.id, p_date: r.date, p_montant: nombre(r.montant), p_mode: r.mode, p_reference: r.reference || null, p_note: null }, 'Régularisation enregistrée') !== null) setRegul(false); }} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white">Enregistrer</button></footer>
          </div>
        </div>
      )}

      {lettre && fac && (
        <div className="fixed inset-0 z-[950] overflow-y-auto bg-stone-200/90 p-6">
          <div className="pas-imprime mx-auto mb-4 flex max-w-[210mm] justify-end gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white"><Printer className="h-4 w-4" /> Imprimer</button>
            <button onClick={() => setLettre(false)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm" aria-label="Fermer la notification"><X className="h-4 w-4" /> Fermer</button>
          </div>
          <div className="zone-impression">
            <article className="mx-auto max-w-[210mm] bg-white p-12 text-sm text-black shadow" aria-label="Notification d'écart">
              <p className="font-black">{societe?.raison_sociale}</p><p>{societe?.adresse}</p><p>{[societe?.rccm && `RCCM ${societe.rccm}`, societe?.nif && `NIF ${societe.nif}`].filter(Boolean).join(' · ')}</p>
              <p className="mt-8 text-right">À l'attention de {contrat(fac.contrat_id)?.contrepartie}</p>
              <p className="text-right">Le {jour(fac.notifiee_le)}{fac.reference_notification ? ` · réf. ${fac.reference_notification}` : ''}</p>
              <p className="mt-8 font-bold uppercase">Objet : notification d'écart · facture n° {fac.numero_fournisseur} du {jour(fac.date_facture)}</p>
              <p className="mt-4">Madame, Monsieur,</p>
              <p className="mt-2">Le contrôle de votre facture n° {fac.numero_fournisseur} (période du {jour(fac.periode_debut)} au {jour(fac.periode_fin)}, contrat {contrat(fac.contrat_id)?.reference}) au regard des quantités relevées sur nos justificatifs signés (heures de fonctionnement ou kilomètres parcourus selon l'unité contractuelle de chaque engin) et des tarifs contractuels fait apparaître les écarts suivants :</p>
              <table className="mt-3 w-full border-collapse text-xs">
                <thead><tr className="border-y border-black text-left"><th className="py-1">Engin</th><th className="py-1 text-right">Quantité facturée</th><th className="py-1 text-right">Quantité relevée</th><th className="py-1 text-right">Facturé</th><th className="py-1 text-right">Dû selon contrat</th><th className="py-1 text-right">Écart</th></tr></thead>
                <tbody>{lignesEcart.map((l) => (
                  <tr key={l.id} className="border-b border-stone-300"><td className="py-1">{l.vehicle_id ? immat.get(l.vehicle_id) ?? l.libelle : l.libelle}</td><td className="py-1 text-right">{l.quantite_facturee ?? l.heures_facturees ?? '—'}{l.quantite_facturee !== null && l.unite_facturee ? ` ${COURT[l.unite_facturee] ?? l.unite_facturee}` : ''}</td><td className="py-1 text-right">{l.quantite_attendue ?? '—'}{l.quantite_attendue !== null && l.unite_attendue ? ` ${COURT[l.unite_attendue] ?? l.unite_attendue}` : ''}</td>
                    <td className="py-1 text-right">{montant(l.montant_facture, fac.devise)}</td><td className="py-1 text-right">{l.montant_attendu === null ? '—' : montant(l.montant_attendu, fac.devise)}</td><td className="py-1 text-right font-bold">{montant(l.ecart ?? 0, fac.devise)}</td></tr>
                ))}</tbody>
              </table>
              <p className="mt-3">Le montant facturé en excédent s'élève à <b>{montant(fac.montant_reclame ?? 0, fac.devise)}</b>. Nous vous demandons d'en procéder à la régularisation par avoir, ou d'accepter sa déduction sur le prochain règlement, et restons à votre disposition pour rapprocher contradictoirement les relevés.</p>
              <p className="mt-4">Veuillez agréer, Madame, Monsieur, nos salutations distinguées.</p>
              <p className="mt-10 font-bold">{societe?.signataire_fonction ?? 'Pour la société'}</p><p>{societe?.signataire_nom ?? ''}</p>
            </article>
          </div>
        </div>
      )}
    </div>
  );
};

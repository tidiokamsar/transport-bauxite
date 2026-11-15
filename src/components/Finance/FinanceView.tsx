import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV } from '../../lib/exports';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { TYPES_ECRITURE, bornesMois, lignesExportComptable, totauxDettes, type Dette, type Ecriture } from './finance';

// Budgets, engagements budgetaires, dettes et export comptable (D-065).
// Engage = bons approuves non recus et paiements proposes ou approuves ;
// realise = couts enregistres et paiements executes. Un depassement est
// signale, jamais bloque. Referentiels (natures, plan de comptes, comptes de
// tiers) saisis par l'administrateur : aucun numero de compte suppose.

interface Suivi {
  id: string; numero: string; periode_debut: string; periode_fin: string; site_id: string | null; site: string | null; nature_id: string;
  nature: string; nature_code: string; devise: string; montant: number; note: string | null; engage_bons: number; engage_paiements: number;
  engage: number; realise_couts: number; realise_paiements: number; realise: number; disponible: number; consommation_pct: number;
  depassement: boolean; sources_non_visibles: string | null;
}
interface Depense { categorie: string; origine: 'bon_commande' | 'paiement' | 'cout'; piece_id: string; piece: string | null; date_operation: string; nature_id: string | null; devise: string | null; montant: number; tiers: string | null;
  source_imputation: 'bon_commande' | 'facture_loueur' | 'cout'; piece_imputee: string }
interface Ref { id: string; libelle: string; actif?: boolean }
interface Nature { id: string; code: string; libelle: string; actif: boolean }
interface Compte { id: string; numero: string; libelle: string; actif: boolean }
interface CompteTiers { id: string; contrat_id: string | null; supplier_id: string | null; compte_id: string }

type Onglet = 'budgets' | 'imputer' | 'dettes' | 'export' | 'referentiels';
const ONGLETS: Record<Onglet, string> = {
  budgets: 'Suivi budgétaire', imputer: 'Dépenses à imputer', dettes: 'Dettes fournisseurs', export: 'Export comptable', referentiels: 'Référentiels',
};
const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const jour = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—');
const moisCourant = () => new Date().toISOString().slice(0, 7);
const ORIGINES: Record<string, string> = { bon_commande: 'Bon de commande', paiement: 'Paiement', cout: 'Coût' };
const SOURCES: Record<string, string> = { bon_commande: 'bon de commande', facture_loueur: 'facture du loueur', cout: 'coût' };

export const FinanceView = () => {
  const { hasPermission, profile } = useAuth();
  const estAdmin = profile?.role === 'admin';
  const peutBudget = hasPermission('costs', 'create') || hasPermission('costs', 'edit');
  const [onglet, setOnglet] = useState<Onglet>('budgets');
  const [suivi, setSuivi] = useState<Suivi[] | null>(null);
  const [natures, setNatures] = useState<Nature[]>([]);
  const [sites, setSites] = useState<Ref[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [dettes, setDettes] = useState<Dette[]>([]);
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; nature_depense_id: string | null }[]>([]);
  const [contrats, setContrats] = useState<{ id: string; reference: string; contrepartie: string }[]>([]);
  const [fournisseurs, setFournisseurs] = useState<{ id: string; company_name: string }[]>([]);
  const [comptesTiers, setComptesTiers] = useState<CompteTiers[]>([]);
  const [budget, setBudget] = useState<{ remplace?: Suivi; debut: string; fin: string; nature: string; site: string; devise: string; montant: string; motif: string; note: string } | null>(null);
  const [mois, setMois] = useState({ du: moisCourant(), au: moisCourant() });
  const [ecritures, setEcritures] = useState<Ecriture[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [s, n, si, d, de, pc, cc, co, fo, ct] = await Promise.all([
      supabase.from('v_suivi_budgets').select('*').order('periode_debut', { ascending: false }),
      supabase.from('natures_depense').select('id, code, libelle, actif').order('code'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('v_depenses_budgetaires').select('*').order('date_operation', { ascending: false }),
      supabase.from('v_dettes_fournisseurs').select('*').order('date_piece'),
      supabase.from('plan_comptable').select('id, numero, libelle, actif').order('numero'),
      supabase.from('cost_categories').select('id, name, nature_depense_id').order('name'),
      supabase.from('contrats').select('id, reference, contrepartie').order('reference'),
      supabase.from('suppliers').select('id, company_name').order('company_name'),
      supabase.from('comptes_tiers').select('id, contrat_id, supplier_id, compte_id'),
    ]);
    setMessage(s.error ? { ok: false, texte: s.error.message } : null);
    setSuivi((s.data ?? []) as Suivi[]);
    setNatures((n.data ?? []) as Nature[]);
    setSites(((si.data ?? []) as { id: string; name: string }[]).map((x) => ({ id: x.id, libelle: x.name })));
    setDepenses((d.data ?? []) as Depense[]);
    setDettes((de.data ?? []) as Dette[]);
    setComptes((pc.data ?? []) as Compte[]);
    setCategories((cc.data ?? []) as { id: string; name: string; nature_depense_id: string | null }[]);
    setContrats((co.data ?? []) as { id: string; reference: string; contrepartie: string }[]);
    setFournisseurs((fo.data ?? []) as { id: string; company_name: string }[]);
    setComptesTiers((ct.data ?? []) as CompteTiers[]);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setMessage(null);
    const { error } = await supabase.rpc(fonction, args);
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: succes });
    if (!error) await charger();
    return !error;
  };

  const montantBudget = budget ? Number(budget.montant.replace(/\s/g, '').replace(',', '.')) : NaN;
  const budgetValide = !!budget && !!budget.debut && !!budget.fin && budget.fin >= budget.debut && !!budget.nature
    && /^[A-Z]{3}$/.test(budget.devise) && montantBudget > 0 && (!budget.remplace || !!budget.motif.trim());
  const enregistrerBudget = () => {
    if (!budget) return;
    executer('definir_budget', {
      p_debut: budget.debut, p_fin: budget.fin, p_nature: budget.nature, p_devise: budget.devise, p_montant: montantBudget,
      p_site: budget.site || null, p_note: budget.note.trim() || null, p_remplace: budget.remplace?.id ?? null,
      p_motif: budget.remplace ? budget.motif.trim() : null,
    }, budget.remplace ? 'Budget révisé.' : 'Budget enregistré.').then((ok) => { if (ok) setBudget(null); });
  };
  const annulerBudget = (b: Suivi) => {
    const m = window.prompt(`Motif de l'annulation du budget ${b.numero}`);
    if (m?.trim()) executer('annuler_budget', { p_id: b.id, p_motif: m.trim() }, 'Budget annulé.');
  };

  // Une piece a imputer une seule fois, meme si plusieurs paiements la reglent.
  const nonImputees = useMemo(() => {
    const vues = new Set<string>();
    return depenses.filter((d) => {
      const cle = `${d.source_imputation}-${d.piece_imputee}`;
      if (d.nature_id || vues.has(cle)) return false;
      vues.add(cle);
      return true;
    });
  }, [depenses]);
  const imputer = (d: Depense, nature: string) => {
    if (!nature) return;
    executer('imputer_depense', { p_source: d.source_imputation, p_piece: d.piece_imputee, p_nature: nature, p_motif: null }, 'Dépense imputée.');
  };

  const chargerEcritures = async () => {
    const { du } = bornesMois(mois.du);
    const { au } = bornesMois(mois.au);
    const { data, error } = await supabase.rpc('ecritures_gestion', { p_du: du, p_au: au });
    setMessage(error ? { ok: false, texte: error.message } : null);
    setEcritures((data ?? []) as Ecriture[]);
  };
  const exporter = () => {
    if (!ecritures?.length) return;
    exportToCSV(lignesExportComptable(ecritures), `ecritures_gestion_${mois.du}_${mois.au}`);
  };

  const compteDe = (contrat: string | null, fournisseur: string | null) =>
    comptesTiers.find((t) => (contrat && t.contrat_id === contrat) || (fournisseur && t.supplier_id === fournisseur))?.compte_id ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-stone-900">Budgets et comptabilité</h2>
        <p className="text-stone-500">Budget, engagé, réalisé et disponible ; dettes fournisseurs ; export des écritures de gestion</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Onglets finance">
        {(Object.keys(ONGLETS) as Onglet[]).map((o) => (
          <button key={o} onClick={() => setOnglet(o)} aria-pressed={onglet === o}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${onglet === o ? 'bg-orange-600 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}>{ONGLETS[o]}</button>
        ))}
      </nav>
      {message && <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}

      {onglet === 'budgets' && (
        <Panneau titre="Suivi budgétaire" action={peutBudget && (
          <button onClick={() => setBudget({ debut: '', fin: '', nature: '', site: '', devise: '', montant: '', motif: '', note: '' })}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-3 py-1.5 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Nouveau budget</button>
        )}>
          {budget && (
            <form onSubmit={(e) => { e.preventDefault(); if (budgetValide) enregistrerBudget(); }} aria-label="Budget" className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4 text-sm sm:grid-cols-4">
              {budget.remplace && <p className="sm:col-span-4">Révision du budget <b>{budget.remplace.numero}</b> (le précédent reste conservé)</p>}
              <label>Début *<input type="date" value={budget.debut} onChange={(e) => setBudget({ ...budget, debut: e.target.value })} className={CHAMP} /></label>
              <label>Fin *<input type="date" value={budget.fin} onChange={(e) => setBudget({ ...budget, fin: e.target.value })} className={CHAMP} /></label>
              <label>Nature de dépense *
                <select value={budget.nature} onChange={(e) => setBudget({ ...budget, nature: e.target.value })} className={CHAMP}>
                  <option value="">Choisir</option>
                  {natures.filter((n) => n.actif).map((n) => <option key={n.id} value={n.id}>{n.code} · {n.libelle}</option>)}
                </select>
              </label>
              <label>Centre (site)
                <select value={budget.site} onChange={(e) => setBudget({ ...budget, site: e.target.value })} className={CHAMP}>
                  <option value="">Sans site</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                </select>
              </label>
              <label>Devise *<input value={budget.devise} onChange={(e) => setBudget({ ...budget, devise: e.target.value.toUpperCase().slice(0, 3) })} placeholder="GNF, USD..." className={CHAMP} /></label>
              <label>Montant *<input inputMode="decimal" value={budget.montant} onChange={(e) => setBudget({ ...budget, montant: e.target.value })} className={CHAMP} /></label>
              {budget.remplace && <label className="sm:col-span-2">Motif de la révision *<input value={budget.motif} onChange={(e) => setBudget({ ...budget, motif: e.target.value })} className={CHAMP} /></label>}
              <label className={budget.remplace ? 'sm:col-span-4' : 'sm:col-span-2'}>Note<input value={budget.note} onChange={(e) => setBudget({ ...budget, note: e.target.value })} className={CHAMP} /></label>
              {natures.length === 0 && <p className="text-xs text-stone-500 sm:col-span-4">Aucune nature de dépense : l'administrateur saisit le référentiel (onglet Référentiels).</p>}
              <div className="flex justify-end gap-2 sm:col-span-4">
                <button type="button" onClick={() => setBudget(null)} className="rounded-lg px-4 py-2 text-stone-600 hover:bg-stone-100">Annuler</button>
                <button type="submit" disabled={!budgetValide} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 font-bold text-white disabled:opacity-50">Enregistrer le budget</button>
              </div>
            </form>
          )}
          {suivi === null ? <div className="h-16" /> : suivi.length === 0 ? (
            <SansDonnees message="Aucun budget" detail="Saisissez un budget par période, centre et nature de dépense." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stone-300 text-left text-stone-500">
                  <th className="py-2 pr-3 font-medium">Budget</th><th className="py-2 pr-3 text-right font-medium">Montant</th>
                  <th className="py-2 pr-3 text-right font-medium">Engagé</th><th className="py-2 pr-3 text-right font-medium">Réalisé</th>
                  <th className="py-2 pr-3 text-right font-medium">Disponible</th><th className="py-2 font-medium">État</th>
                </tr></thead>
                <tbody>{suivi.map((b) => (
                  <tr key={b.id} className="border-b border-stone-100 align-top last:border-0">
                    <td className="py-2 pr-3"><p className="font-semibold">{b.numero} · {b.nature}</p>
                      <p className="text-xs text-stone-500">{jour(b.periode_debut)} – {jour(b.periode_fin)} · {b.site ?? 'sans site'}{b.sources_non_visibles ? ` · non visibles avec vos droits : ${b.sources_non_visibles}` : ''}</p></td>
                    <td className="py-2 pr-3 text-right">{nombre.format(b.montant)} {b.devise}</td>
                    <td className="py-2 pr-3 text-right" title={`Bons ${nombre.format(b.engage_bons)} · paiements ${nombre.format(b.engage_paiements)}`}>{nombre.format(b.engage)}</td>
                    <td className="py-2 pr-3 text-right" title={`Coûts ${nombre.format(b.realise_couts)} · paiements ${nombre.format(b.realise_paiements)}`}>{nombre.format(b.realise)}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${b.disponible < 0 ? 'text-red-700' : ''}`}>{nombre.format(b.disponible)}</td>
                    <td className="py-2"><span className="flex flex-wrap items-center gap-1">
                      {b.depassement ? <Puce teinte="rouge">Dépassé ({b.consommation_pct} %)</Puce> : <Puce teinte="vert">{b.consommation_pct} % consommé</Puce>}
                      {peutBudget && <button onClick={() => setBudget({ remplace: b, debut: b.periode_debut, fin: b.periode_fin, nature: b.nature_id, site: b.site_id ?? '', devise: b.devise, montant: String(b.montant), motif: '', note: b.note ?? '' })}
                        className="rounded border border-stone-200 px-2 py-0.5 text-xs" aria-label={`Réviser ${b.numero}`}>Réviser</button>}
                      {peutBudget && <button onClick={() => annulerBudget(b)} className="rounded border border-stone-200 px-2 py-0.5 text-xs" aria-label={`Annuler ${b.numero}`}>Annuler</button>}
                    </span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <Provenance source="budgets saisis ; engagé : bons de commande approuvés non reçus (reliquat HT, GNF), paiements proposés ou approuvés ; réalisé : coûts enregistrés, paiements exécutés" heure={heure} />
        </Panneau>
      )}

      {onglet === 'imputer' && (
        <Panneau titre="Dépenses sans nature de dépense">
          {nonImputees.length === 0 ? <SansDonnees message="Aucune dépense à imputer" detail="Un coût suit la nature de sa catégorie ; un bon de commande ou une facture du loueur s'impute ici." /> : (
            <ul className="divide-y divide-stone-100 text-sm" aria-label="Dépenses à imputer">
              {nonImputees.map((d) => (
                <li key={`${d.source_imputation}-${d.piece_imputee}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{ORIGINES[d.origine]} <b>{d.piece ?? 'sans numéro'}</b>{d.origine === 'paiement' ? ` (impute la ${SOURCES[d.source_imputation]})` : ''} · {jour(d.date_operation)} · {nombre.format(d.montant)} {d.devise ?? 'devise non saisie'}{d.tiers ? ` · ${d.tiers}` : ''}</span>
                  <select defaultValue="" onChange={(e) => imputer(d, e.target.value)} aria-label={`Imputer ${d.piece ?? d.piece_id}`} className="rounded border border-stone-300 px-2 py-1 text-xs">
                    <option value="">Imputer à...</option>
                    {natures.filter((n) => n.actif).map((n) => <option key={n.id} value={n.id}>{n.code} · {n.libelle}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <Provenance source="v_depenses_budgetaires (droits du lecteur) ; une réimputation exige un motif et garde la précédente" heure={heure} />
        </Panneau>
      )}

      {onglet === 'dettes' && (
        <Panneau titre="Dettes fournisseurs">
          {dettes.length === 0 ? <SansDonnees message="Aucune dette" detail="Factures du loueur contrôlées et bons de commande reçus non payés." /> : (
            <>
              <ul className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Totaux des dettes">
                {totauxDettes(dettes).map((t) => <li key={`${t.beneficiaire}-${t.devise}`} className="rounded-xl bg-stone-50 px-3 py-2"><b>{t.beneficiaire}</b> · {nombre.format(t.du)} {t.devise} ({t.pieces} pièce(s))</li>)}
              </ul>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stone-300 text-left text-stone-500">
                  <th className="py-2 pr-3 font-medium">Pièce</th><th className="py-2 pr-3 font-medium">Bénéficiaire</th>
                  <th className="py-2 pr-3 text-right font-medium">Dû</th><th className="py-2 pr-3 text-right font-medium">Paiements en cours</th><th className="py-2 text-right font-medium">Ancienneté</th>
                </tr></thead>
                <tbody>{dettes.map((d) => (
                  <tr key={`${d.source}-${d.piece_id}`} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 pr-3">{d.source === 'facture_loueur' ? 'Facture du loueur' : 'Bon de commande'} {d.piece} · {jour(d.date_piece)}</td>
                    <td className="py-2 pr-3">{d.beneficiaire ?? 'Non renseigné'}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{nombre.format(d.du)} {d.devise}</td>
                    <td className="py-2 pr-3 text-right">{nombre.format(d.paiements_en_cours)}</td>
                    <td className="py-2 text-right">{d.anciennete_jours ?? '—'} j</td>
                  </tr>
                ))}</tbody>
              </table>
            </>
          )}
          <Provenance source="v_reste_a_payer (D-055) : base moins avoirs, déductions et part réclamée, moins payé" heure={heure} />
        </Panneau>
      )}

      {onglet === 'export' && (
        <Panneau titre="Écritures de gestion">
          <div className="mb-4 flex flex-wrap items-end gap-2 text-sm">
            <label>Du mois<input type="month" value={mois.du} onChange={(e) => setMois({ ...mois, du: e.target.value })} className={CHAMP} /></label>
            <label>Au mois<input type="month" value={mois.au} onChange={(e) => setMois({ ...mois, au: e.target.value })} className={CHAMP} /></label>
            <button onClick={chargerEcritures} disabled={!mois.du || !mois.au || mois.au < mois.du} className="rounded-xl border border-stone-200 px-3 py-2 font-semibold disabled:opacity-50">Afficher</button>
            <button onClick={exporter} disabled={!ecritures?.length} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-3 py-2 font-bold text-white disabled:opacity-50"><Download className="h-4 w-4" /> Exporter en CSV</button>
          </div>
          {ecritures === null ? <SansDonnees message="Choisissez une période" /> : ecritures.length === 0 ? <SansDonnees message="Aucune écriture sur la période" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Écritures">
                <thead><tr className="border-b border-stone-300 text-left text-stone-500">
                  <th className="py-2 pr-3 font-medium">Date</th><th className="py-2 pr-3 font-medium">Type</th><th className="py-2 pr-3 font-medium">Pièce</th>
                  <th className="py-2 pr-3 font-medium">Tiers</th><th className="py-2 pr-3 font-medium">Compte de tiers</th><th className="py-2 text-right font-medium">Montant</th>
                </tr></thead>
                <tbody>{ecritures.map((e, i) => (
                  <tr key={i} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 pr-3">{jour(e.date_ecriture)}</td><td className="py-2 pr-3">{TYPES_ECRITURE[e.type_ecriture]}</td>
                    <td className="py-2 pr-3">{e.piece ?? '—'}{e.piece_liee ? ` (${e.piece_liee})` : ''}</td><td className="py-2 pr-3">{e.tiers ?? '—'}</td>
                    <td className="py-2 pr-3">{e.compte_tiers ?? <span className="text-stone-400">non paramétré</span>}</td>
                    <td className="py-2 text-right">{nombre.format(e.montant)} {e.devise ?? ''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <Provenance source="factures et avoirs émis, encaissements, paiements exécutés, coûts enregistrés ; lus avec vos droits" />
        </Panneau>
      )}

      {onglet === 'referentiels' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Referentiel titre="Natures de dépense" lignes={natures.map((n) => ({ id: n.id, code: n.code, libelle: n.libelle, actif: n.actif }))} estAdmin={estAdmin}
            libelleCode="Code" onEnregistrer={(code, libelle, actif, id) => executer('definir_nature_depense', { p_code: code, p_libelle: libelle, p_actif: actif, p_id: id ?? null }, 'Nature enregistrée.')} />
          <Referentiel titre="Plan de comptes" lignes={comptes.map((c) => ({ id: c.id, code: c.numero, libelle: c.libelle, actif: c.actif }))} estAdmin={estAdmin}
            libelleCode="Numéro de compte" onEnregistrer={(code, libelle, actif, id) => executer('definir_compte_comptable', { p_numero: code, p_libelle: libelle, p_actif: actif, p_id: id ?? null }, 'Compte enregistré.')} />
          <Panneau titre="Catégories de coût et natures">
            {categories.length === 0 ? <SansDonnees message="Aucune catégorie de coût" /> : (
              <ul className="divide-y divide-stone-100 text-sm">{categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-1.5"><span>{c.name}</span>
                  <select value={c.nature_depense_id ?? ''} disabled={!estAdmin} aria-label={`Nature de ${c.name}`}
                    onChange={(e) => executer('associer_categorie_cout', { p_categorie: c.id, p_nature: e.target.value || null }, 'Catégorie rattachée.')} className="rounded border border-stone-300 px-2 py-1 text-xs">
                    <option value="">Aucune nature</option>
                    {natures.filter((n) => n.actif).map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}
                  </select>
                </li>
              ))}</ul>
            )}
          </Panneau>
          <Panneau titre="Comptes de tiers">
            <ul className="divide-y divide-stone-100 text-sm" aria-label="Comptes de tiers">
              {[...contrats.map((c) => ({ cle: `c-${c.id}`, libelle: `${c.reference} · ${c.contrepartie}`, contrat: c.id, fournisseur: null as string | null })),
                ...fournisseurs.map((f) => ({ cle: `f-${f.id}`, libelle: f.company_name, contrat: null as string | null, fournisseur: f.id }))].map((t) => (
                <li key={t.cle} className="flex items-center justify-between gap-2 py-1.5"><span>{t.libelle}</span>
                  <select value={compteDe(t.contrat, t.fournisseur)} disabled={!estAdmin} aria-label={`Compte de ${t.libelle}`}
                    onChange={(e) => executer('definir_compte_tiers', { p_compte: e.target.value || null, p_contrat: t.contrat, p_fournisseur: t.fournisseur }, 'Compte de tiers enregistré.')}
                    className="rounded border border-stone-300 px-2 py-1 text-xs">
                    <option value="">Non paramétré</option>
                    {comptes.filter((c) => c.actif).map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.libelle}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </Panneau>
        </div>
      )}
    </div>
  );
};

const Referentiel = ({ titre, lignes, estAdmin, libelleCode, onEnregistrer }: {
  titre: string; lignes: { id: string; code: string; libelle: string; actif: boolean }[]; estAdmin: boolean; libelleCode: string;
  onEnregistrer: (code: string, libelle: string, actif: boolean, id?: string) => Promise<boolean>;
}) => {
  const [f, setF] = useState({ code: '', libelle: '' });
  return (
    <Panneau titre={titre}>
      {lignes.length === 0 ? <SansDonnees message="Référentiel vide" detail="Saisi par l'administrateur : aucune valeur supposée." /> : (
        <ul className="divide-y divide-stone-100 text-sm">{lignes.map((l) => (
          <li key={l.id} className={`flex items-center justify-between gap-2 py-1.5 ${l.actif ? '' : 'text-stone-400'}`}>
            <span><b>{l.code}</b> · {l.libelle}</span>
            {estAdmin && <button onClick={() => onEnregistrer(l.code, l.libelle, !l.actif, l.id)} className="rounded border border-stone-200 px-2 py-0.5 text-xs">{l.actif ? 'Désactiver' : 'Réactiver'}</button>}
          </li>
        ))}</ul>
      )}
      {estAdmin && (
        <form onSubmit={(e) => { e.preventDefault(); onEnregistrer(f.code.trim(), f.libelle.trim(), true).then((ok) => { if (ok) setF({ code: '', libelle: '' }); }); }}
          className="mt-3 flex flex-wrap items-end gap-2 text-sm" aria-label={`Ajouter : ${titre}`}>
          <label>{libelleCode} *<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={CHAMP} /></label>
          <label className="flex-1">Libellé *<input value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} className={CHAMP} /></label>
          <button type="submit" disabled={!f.code.trim() || !f.libelle.trim()} className="rounded-lg bg-stone-800 px-3 py-2 font-semibold text-white disabled:opacity-50">Ajouter</button>
        </form>
      )}
    </Panneau>
  );
};

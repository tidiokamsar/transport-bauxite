import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileCheck2, Lock, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { buildCSV } from '../../lib/exports';
import { ANOMALIES, BASES, STATUTS_LIGNE, bornesMoisCalendaires, statutLigne, type BaseTonnage, type StatutLigne } from './facturation';

// Reconciliation mensuelle (phase 3, D-029) : les voyages livres du mois,
// leurs anomalies, la decision du charge de contrats sur chaque ligne a
// examiner, la cloture qui fige le tonnage facturable, puis la facture.

interface Contrat { id: string; reference: string; contrepartie: string; devise: string; nature: string }
interface Reconciliation {
  id: string; contrat_id: string; periode_debut: string; periode_fin: string; base_tonnage: BaseTonnage;
  tolerance_ecart_pct: number; site_depart_id: string | null; site_arrivee_id: string | null; statut: 'ouverte' | 'cloturee';
  tonnage_facturable: number | null; voyages_facturables: number | null; actualisee_le: string | null; cloturee_le: string | null;
}
interface Ligne {
  id: string; trip_id: string; reference: string; date_voyage: string; etat: string | null;
  tonnage_charge: number | null; tonnage_recu: number | null; tonnage_accepte: number | null; tonnage_kogon: number | null; tonnage_cbg: number | null; tonnage_base: number | null;
  ticket: string | null; fiche: string | null; anomalies: string[]; decision: string | null; motif_decision: string | null;
}

const moisPrecedent = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const t = (v: number | null) => (v === null ? '—' : formatNombre(Number(v), 2));
const date = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR');

export const ReconciliationView = ({ onFactureCreee }: { onFactureCreee?: () => void }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('invoices', 'create') || hasPermission('invoices', 'edit');
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [liste, setListe] = useState<Reconciliation[] | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [filtre, setFiltre] = useState<StatutLigne | 'toutes'>('a_examiner');
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [ouverture, setOuverture] = useState(false);
  const [f, setF] = useState({ contrat: '', mois: moisPrecedent(), base: '', tolerance: '', depart: '', arrivee: '' });
  const [taxe, setTaxe] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const chargerListe = useCallback(async () => {
    const [c, s, r] = await Promise.all([
      supabase.from('contrats').select('id, reference, contrepartie, devise, nature').eq('nature', 'client').order('reference'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('reconciliations').select('*').order('periode_debut', { ascending: false }),
    ]);
    setContrats((c.data ?? []) as Contrat[]);
    setSites((s.data ?? []) as { id: string; name: string }[]);
    const l = (r.data ?? []) as Reconciliation[];
    setListe(l);
    setChoisie((x) => x ?? l[0]?.id ?? null);
    setHeure(new Date());
  }, []);

  const chargerLignes = useCallback(async () => {
    if (!choisie) return;
    const { data } = await supabase.from('reconciliation_lignes').select('*').eq('reconciliation_id', choisie).order('date_voyage').order('reference');
    setLignes((data ?? []) as Ligne[]);
  }, [choisie]);

  useEffect(() => { chargerListe(); }, [chargerListe]);
  useEffect(() => { chargerLignes(); }, [chargerLignes]);

  const rec = liste?.find((r) => r.id === choisie) ?? null;
  const contrat = contrats.find((c) => c.id === rec?.contrat_id);
  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const comptes = useMemo(() => {
    const c = { facturable: 0, a_examiner: 0, exclue: 0, tonnes: 0 };
    for (const l of lignes) {
      const s = statutLigne(l.decision, l.anomalies);
      c[s] += 1;
      if (s === 'facturable') c.tonnes += Number(l.tonnage_base ?? 0);
    }
    return c;
  }, [lignes]);
  const visibles = lignes.filter((l) => filtre === 'toutes' || statutLigne(l.decision, l.anomalies) === filtre);

  const appeler = async (fonction: string, parametres: Record<string, unknown>, succes: string) => {
    setEnCours(true);
    setMessage(null);
    const { data, error } = await supabase.rpc(fonction, parametres);
    setEnCours(false);
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: succes });
    return error ? null : data ?? true;
  };

  const ouvrir = async () => {
    const { debut, fin } = bornesMoisCalendaires(f.mois);
    const id = await appeler('ouvrir_reconciliation', {
      p_contrat_id: f.contrat, p_debut: debut, p_fin: fin, p_base: f.base, p_tolerance: Number(f.tolerance.replace(',', '.')),
      p_site_depart: f.depart || null, p_site_arrivee: f.arrivee || null,
    }, 'Réconciliation ouverte : voyages livrés du mois rapprochés');
    if (id) { setOuverture(false); setChoisie(id as string); chargerListe(); }
  };
  const decider = async (l: Ligne, decision: 'facturable' | 'exclue' | null) => {
    const motif = decision ? window.prompt(`Motif : ${l.reference} ${decision === 'facturable' ? 'facturable' : 'exclue'}`) : '';
    if (decision && !motif) return;
    if (await appeler('decider_ligne_reconciliation', { p_ligne_id: l.id, p_decision: decision, p_motif: motif || null }, `${l.reference} : décision enregistrée`)) chargerLignes();
  };
  const exporter = () => {
    const csv = buildCSV(lignes.map((l) => ({
      Voyage: l.reference, Date: l.date_voyage, Etat: l.etat ?? '', Charge_t: l.tonnage_charge ?? '', Recu_t: l.tonnage_recu ?? '',
      Accepte_t: l.tonnage_accepte ?? '', Kogon_t: l.tonnage_kogon ?? '', CBG_t: l.tonnage_cbg ?? '', Base_t: l.tonnage_base ?? '', Ticket: l.ticket ?? '', Fiche: l.fiche ?? '',
      Anomalies: l.anomalies.map((a) => ANOMALIES[a]?.libelle ?? a).join(' ; '), Statut: STATUTS_LIGNE[statutLigne(l.decision, l.anomalies)].libelle,
      Motif: l.motif_decision ?? '',
    })));
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    lien.download = `reconciliation-${contrat?.reference ?? ''}-${rec?.periode_debut.slice(0, 7) ?? ''}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Réconciliation mensuelle</h2>
          <p className="text-stone-500">Relevés de terrain rapprochés des tonnages facturables, avant la facture</p>
        </div>
        {peutEcrire && (
          <button onClick={() => setOuverture((x) => !x)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
            <Plus className="h-4 w-4" /> Ouvrir une réconciliation
          </button>
        )}
      </div>
      {message && <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}

      {ouverture && (
        <Panneau titre="Nouvelle réconciliation">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <label>Contrat client *<select value={f.contrat} onChange={(e) => setF({ ...f, contrat: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="">Choisir</option>{contrats.map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.contrepartie}</option>)}
            </select></label>
            <label>Mois *<input type="month" value={f.mois} onChange={(e) => setF({ ...f, mois: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label>
            <label>Base de tonnage facturé *<select value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="">Choisir (selon le contrat)</option>{Object.entries(BASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
            <label>Tolérance d'écart chargé / reçu (%) *<input inputMode="decimal" value={f.tolerance} onChange={(e) => setF({ ...f, tolerance: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label>
            <label>Site de départ<select value={f.depart} onChange={(e) => setF({ ...f, depart: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="">Tous</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label>Site d'arrivée<select value={f.arrivee} onChange={(e) => setF({ ...f, arrivee: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="">Tous</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
          </div>
          <button onClick={ouvrir} disabled={enCours || !f.contrat || !f.base || f.tolerance.trim() === ''} className="mt-4 rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            Ouvrir et rapprocher
          </button>
        </Panneau>
      )}

      {liste === null ? (
        <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
      ) : liste.length === 0 ? (
        <Panneau><SansDonnees message="Aucune réconciliation" detail="Ouvrez la réconciliation du mois écoulé pour un contrat client." /></Panneau>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <nav className="space-y-2 xl:col-span-3" aria-label="Réconciliations">
            {liste.map((r) => {
              const c = contrats.find((x) => x.id === r.contrat_id);
              return (
                <button key={r.id} onClick={() => setChoisie(r.id)} className={`w-full rounded-2xl border p-3 text-left shadow-carte ${choisie === r.id ? 'border-orange-400 bg-orange-50' : 'border-stone-200 bg-white'}`}>
                  <p className="font-bold text-stone-900">{c?.reference ?? 'Contrat'} · {new Date(r.periode_debut + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                  <p className="flex items-center gap-1 text-xs text-stone-500">{r.statut === 'cloturee' ? <><Lock className="h-3 w-3" /> Clôturée · {t(r.tonnage_facturable)} t</> : 'Ouverte'}</p>
                </button>
              );
            })}
          </nav>
          {rec && (
            <div className="space-y-4 xl:col-span-9">
              <Panneau
                titre={`${contrat?.reference ?? ''} · ${contrat?.contrepartie ?? ''} · du ${date(rec.periode_debut)} au ${date(rec.periode_fin)}`}
                action={
                  <div className="flex flex-wrap gap-2">
                    <button onClick={exporter} disabled={lignes.length === 0} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm"><Download className="h-4 w-4" /> Exporter</button>
                    {peutEcrire && rec.statut === 'ouverte' && <>
                      <button onClick={async () => { if (await appeler('actualiser_reconciliation', { p_id: rec.id }, 'Rapprochement actualisé')) { chargerLignes(); chargerListe(); } }} disabled={enCours} className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
                      <button onClick={async () => { if (await appeler('cloturer_reconciliation', { p_id: rec.id }, 'Réconciliation clôturée : tonnage facturable figé')) { chargerListe(); chargerLignes(); } }} disabled={enCours || comptes.a_examiner > 0} className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"><Lock className="h-4 w-4" /> Clôturer</button>
                    </>}
                  </div>
                }
              >
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                  <div><dt className="text-stone-500">Base</dt><dd className="font-semibold">{BASES[rec.base_tonnage]}</dd></div>
                  <div><dt className="text-stone-500">Tolérance</dt><dd className="font-semibold">{formatNombre(Number(rec.tolerance_ecart_pct), 1)} %</dd></div>
                  <div><dt className="text-stone-500">Trajet</dt><dd className="font-semibold">{rec.site_depart_id ? nomSite.get(rec.site_depart_id) : 'Tous'} → {rec.site_arrivee_id ? nomSite.get(rec.site_arrivee_id) : 'Tous'}</dd></div>
                  <div><dt className="text-stone-500">Facturable</dt><dd className="text-lg font-black text-green-700">{formatNombre(comptes.tonnes, 2)} t</dd><dd className="text-xs text-stone-500">{comptes.facturable} voyage(s)</dd></div>
                  <div><dt className="text-stone-500">À examiner / exclues</dt><dd className={`text-lg font-black ${comptes.a_examiner > 0 ? 'text-orange-600' : 'text-stone-900'}`}>{comptes.a_examiner} / {comptes.exclue}</dd></div>
                </dl>
                {rec.statut === 'cloturee' && peutEcrire && (
                  <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-green-50 p-3 text-sm">
                    <p className="flex items-center gap-1 font-semibold text-green-800"><CheckCircle2 className="h-4 w-4" /> Clôturée : {t(rec.tonnage_facturable)} t facturables sur {rec.voyages_facturables} voyage(s).</p>
                    <label>Taux de taxe (%) *<input inputMode="decimal" value={taxe} onChange={(e) => setTaxe(e.target.value)} placeholder="0 si exonéré" className="ml-2 w-28 rounded-lg border border-stone-300 px-2 py-1" /></label>
                    <button onClick={async () => { if (await appeler('generer_facture', { p_reconciliation_id: rec.id, p_taux_taxe: Number(taxe.replace(',', '.')), p_objet: null }, 'Facture générée en brouillon (menu Facturation)')) onFactureCreee?.(); }} disabled={enCours || taxe.trim() === ''} className="flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 font-bold text-white disabled:opacity-50">
                      <FileCheck2 className="h-4 w-4" /> Générer la facture
                    </button>
                  </div>
                )}
              </Panneau>

              <Panneau
                titre={`Lignes (${visibles.length})`}
                action={
                  <div className="flex gap-1 text-sm">
                    {(['a_examiner', 'facturable', 'exclue', 'toutes'] as const).map((s) => (
                      <button key={s} onClick={() => setFiltre(s)} className={`rounded-lg px-2.5 py-1 ${filtre === s ? 'bg-orange-100 font-semibold text-orange-800' : 'text-stone-600 hover:bg-stone-100'}`}>
                        {s === 'toutes' ? 'Toutes' : STATUTS_LIGNE[s].libelle} ({s === 'toutes' ? lignes.length : comptes[s]})
                      </button>
                    ))}
                  </div>
                }
              >
                {visibles.length === 0 ? <SansDonnees message="Aucune ligne" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                        <th className="py-2 pr-2 font-medium">Voyage</th><th className="py-2 pr-2 text-right font-medium">Chargé</th><th className="py-2 pr-2 text-right font-medium">Reçu</th>
                        <th className="py-2 pr-2 text-right font-medium">Kogon</th><th className="py-2 pr-2 text-right font-medium">CBG</th>
                        <th className="py-2 pr-2 text-right font-medium">Accepté</th><th className="py-2 pr-2 font-medium">Ticket · fiche</th><th className="py-2 pr-2 font-medium">Anomalies</th>
                        <th className="py-2 pr-2 font-medium">Statut</th>{peutEcrire && rec.statut === 'ouverte' && <th className="py-2 font-medium">Décision</th>}
                      </tr></thead>
                      <tbody>{visibles.map((l) => {
                        const s = statutLigne(l.decision, l.anomalies);
                        return (
                          <tr key={l.id} className="border-b border-stone-100 align-top last:border-0">
                            <td className="py-2 pr-2"><p className="font-semibold text-stone-900">{l.reference}</p><p className="text-xs text-stone-500">{date(l.date_voyage)}</p></td>
                            <td className="py-2 pr-2 text-right">{t(l.tonnage_charge)}</td>
                            <td className="py-2 pr-2 text-right">{t(l.tonnage_recu)}</td>
                            <td className="py-2 pr-2 text-right">{t(l.tonnage_kogon)}</td>
                            <td className="py-2 pr-2 text-right">{t(l.tonnage_cbg)}</td>
                            <td className="py-2 pr-2 text-right">{t(l.tonnage_accepte)}</td>
                            <td className="py-2 pr-2 text-xs text-stone-600">{l.ticket ?? '—'}<br />{l.fiche ?? '—'}</td>
                            <td className="py-2 pr-2 text-xs">{l.anomalies.map((a) => <span key={a} className={`mr-1 inline-block rounded px-1.5 py-0.5 ${ANOMALIES[a]?.bloquante ? 'bg-orange-100 text-orange-800' : 'bg-stone-100 text-stone-600'}`}>{ANOMALIES[a]?.libelle ?? a}</span>)}</td>
                            <td className="py-2 pr-2"><Puce teinte={STATUTS_LIGNE[s].teinte}>{STATUTS_LIGNE[s].libelle}</Puce>{l.motif_decision && <p className="mt-1 text-xs text-stone-500">{l.motif_decision}</p>}</td>
                            {peutEcrire && rec.statut === 'ouverte' && (
                              <td className="whitespace-nowrap py-2 text-xs">
                                <button onClick={() => decider(l, 'facturable')} className="mr-1 rounded bg-green-50 px-2 py-1 font-semibold text-green-700" aria-label={`Facturer ${l.reference}`}>Facturer</button>
                                <button onClick={() => decider(l, 'exclue')} className="mr-1 rounded bg-stone-100 px-2 py-1 font-semibold text-stone-700" aria-label={`Exclure ${l.reference}`}>Exclure</button>
                                {l.decision && <button onClick={() => decider(l, null)} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">Annuler la décision</button>}
                              </td>
                            )}
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                )}
              </Panneau>
            </div>
          )}
        </div>
      )}
      <Provenance source="voyages livrés de la période (journal du cycle, pesées, tickets, fiches terrain) ; décisions du chargé de contrats tracées ; tonnage figé à la clôture" heure={heure} />
    </div>
  );
};

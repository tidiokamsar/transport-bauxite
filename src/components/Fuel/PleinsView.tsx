import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { Panneau, Provenance, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { buildCSV } from '../../lib/exports';

// Pleins et remplissages de cuve (D-030) : liste du mois et saisie
// unitaire. Le prix est porte par les livraisons CBG, jamais saisi sur un
// plein individuel. Les pleins des fiches carburant
// (D-028) arrivent ici avec la reference de leur fiche.

interface Plein {
  id: string; transaction_date: string; reference: string; vehicle_id: string | null; driver_id: string | null;
  volume_liters: number; unit_price: number | null; total_cost: number | null; transaction_type: 'refuel' | 'tank_fill';
  supplier: string | null; site_id: string | null; odometer_reading: number | null; notes: string | null;
}

const moisCourant = () => new Date().toISOString().slice(0, 7);
const CHAMP = 'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm';

export const PleinsView = () => {
  const { hasPermission } = useAuth();
  const { siteId, sites } = useSite();
  const peutEcrire = hasPermission('fuel', 'create') || hasPermission('fuel', 'edit');
  const [mois, setMois] = useState(moisCourant);
  const [pleins, setPleins] = useState<Plein[] | null>(null);
  const [engins, setEngins] = useState<{ id: string; registration: string }[]>([]);
  const [chauffeurs, setChauffeurs] = useState<{ id: string; name: string }[]>([]);
  const [saisie, setSaisie] = useState(false);
  const [f, setF] = useState({ type: 'refuel', date: new Date().toISOString().slice(0, 10), engin: '', chauffeur: '', litres: '', compteur: '', site: '', note: '' });
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [a, m] = mois.split('-').map(Number);
    let q = supabase.from('fuel_transactions')
      .select('id, transaction_date, reference, vehicle_id, driver_id, volume_liters, unit_price, total_cost, transaction_type, supplier, site_id, odometer_reading, notes')
      .gte('transaction_date', `${mois}-01`).lte('transaction_date', `${mois}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`)
      .order('transaction_date', { ascending: false });
    if (siteId) q = q.eq('site_id', siteId);
    const [p, v, d] = await Promise.all([
      q,
      supabase.from('vehicles').select('id, registration').neq('status', 'sold').order('registration'),
      supabase.from('drivers').select('id, name').order('name'),
    ]);
    setErreur(p.error ? 'Pleins indisponibles : ' + p.error.message : '');
    setPleins((p.data ?? []) as Plein[]);
    setEngins((v.data ?? []) as { id: string; registration: string }[]);
    setChauffeurs((d.data ?? []) as { id: string; name: string }[]);
    setHeure(new Date());
  }, [mois, siteId]);
  useEffect(() => { charger(); }, [charger]);

  const immat = useMemo(() => new Map(engins.map((e) => [e.id, e.registration])), [engins]);
  const nom = useMemo(() => new Map(chauffeurs.map((c) => [c.id, c.name])), [chauffeurs]);
  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const totaux = useMemo(() => {
    const l = pleins ?? [];
    const distrib = l.filter((x) => x.transaction_type === 'refuel');
    return {
      litres: distrib.reduce((s, x) => s + Number(x.volume_liters), 0),
      cout: distrib.some((x) => x.total_cost === null) ? null : distrib.reduce((s, x) => s + Number(x.total_cost), 0),
      cuves: l.filter((x) => x.transaction_type === 'tank_fill').reduce((s, x) => s + Number(x.volume_liters), 0),
    };
  }, [pleins]);

  const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')));
  const enregistrer = async () => {
    const litres = nombre(f.litres);
    const site = f.site || siteId || null;
    if (!(litres && litres > 0)) { setErreur('La quantité en litres doit être positive'); return; }
    if (f.type === 'refuel' && !f.engin) { setErreur('Engin requis pour un plein'); return; }
    if (f.type === 'tank_fill' && !site) { setErreur('Site de la cuve requis pour un remplissage'); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('fuel_transactions').insert({
      transaction_date: f.date, transaction_type: f.type, vehicle_id: f.type === 'refuel' ? f.engin : null,
      driver_id: f.type === 'refuel' && f.chauffeur ? f.chauffeur : null, volume_liters: litres, quantity: litres,
      unit_price: null, total_cost: null, total_amount: null,
      supplier: 'CBG', site_id: site, odometer_reading: nombre(f.compteur), notes: f.note.trim() || 'Saisie unitaire',
      reference: `PL-${f.date.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`, created_by: u.user?.id ?? null,
    });
    if (error) { setErreur(error.message); return; }
    setSaisie(false);
    setErreur('');
    charger();
  };

  const exporter = () => {
    const csv = buildCSV((pleins ?? []).map((x) => ({
      Date: x.transaction_date, Reference: x.reference, Type: x.transaction_type === 'refuel' ? 'Plein' : 'Remplissage cuve',
      Engin: x.vehicle_id ? immat.get(x.vehicle_id) ?? '' : '', Chauffeur: x.driver_id ? nom.get(x.driver_id) ?? '' : '',
      Litres: x.volume_liters, Prix_litre: x.unit_price, Montant: x.total_cost, Fournisseur: x.supplier ?? '',
      Site: x.site_id ? nomSite.get(x.site_id) ?? '' : '', Compteur: x.odometer_reading ?? '', Note: x.notes ?? '',
    })));
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    lien.download = `pleins-${mois}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Pleins et cuves</h2>
          <p className="text-stone-500">Distributions aux engins ; prix et factures suivis dans « Livraisons et factures CBG »</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
          <button onClick={exporter} disabled={!pleins?.length} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm disabled:opacity-50"><Download className="h-4 w-4" /> Exporter</button>
          {peutEcrire && <button onClick={() => setSaisie(true)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow"><Plus className="h-4 w-4" /> Saisir</button>}
        </div>
      </div>
      {erreur && !saisie && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Synthèse des pleins">
        {[
          ['Litres distribués aux engins', `${formatNombre(totaux.litres)} L`],
          ['Coût des distributions', totaux.cout === null || totaux.cout === 0 ? '—' : formatNombre(totaux.cout)],
          ['Litres reçus en cuve', `${formatNombre(totaux.cuves)} L`],
        ].map(([l, v]) => <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte"><p className="text-sm text-stone-500">{l}</p><p className="text-2xl font-black text-stone-900">{pleins ? v : '—'}</p></div>)}
      </section>
      <Panneau titre={`Mouvements du mois (${pleins?.length ?? 0})`}>
        {pleins === null ? (
          <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
        ) : pleins.length === 0 ? <SansDonnees message="Aucun mouvement ce mois-ci" detail="Saisissez un plein ou une fiche carburant." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-3 font-medium">Date</th><th className="py-2 pr-3 font-medium">Référence</th><th className="py-2 pr-3 font-medium">Engin</th>
                <th className="py-2 pr-3 font-medium">Chauffeur</th><th className="py-2 pr-3 text-right font-medium">Litres</th><th className="py-2 pr-3 text-right font-medium">Prix / L</th>
                <th className="py-2 pr-3 text-right font-medium">Montant</th><th className="py-2 font-medium">Origine</th>
              </tr></thead>
              <tbody>{pleins.map((x) => (
                <tr key={x.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-3">{new Date(x.transaction_date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{x.reference}</td>
                  <td className="py-2 pr-3 font-semibold">{x.transaction_type === 'tank_fill' ? `Cuve · ${x.site_id ? nomSite.get(x.site_id) ?? '' : ''}` : immat.get(x.vehicle_id ?? '') ?? '—'}</td>
                  <td className="py-2 pr-3">{x.driver_id ? nom.get(x.driver_id) ?? '—' : '—'}</td>
                  <td className="py-2 pr-3 text-right">{formatNombre(Number(x.volume_liters))}</td>
                  <td className="py-2 pr-3 text-right">{x.unit_price === null ? '—' : formatNombre(Number(x.unit_price))}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{x.total_cost === null ? '—' : formatNombre(Number(x.total_cost))}</td>
                  <td className="py-2 text-xs text-stone-500">{x.notes ?? ''}{x.supplier ? ` · ${x.supplier}` : ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Provenance source="transactions carburant (fiches carburant et saisies unitaires)" heure={heure} />
      </Panneau>

      {saisie && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={() => setSaisie(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Saisir un mouvement de carburant">
            <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <h2 className="text-xl font-black text-stone-900">Saisir un mouvement</h2>
              <button onClick={() => setSaisie(false)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
            </header>
            <div className="grid grid-cols-1 gap-3 px-6 py-5 text-sm sm:grid-cols-2">
              <label>Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={CHAMP}><option value="refuel">Plein d'un engin</option></select></label>
              <label>Date *<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={CHAMP} /></label>
              {f.type === 'refuel' ? <>
                <label>Engin *<select value={f.engin} onChange={(e) => setF({ ...f, engin: e.target.value })} className={CHAMP}><option value="">Choisir</option>{engins.map((e) => <option key={e.id} value={e.id}>{e.registration}</option>)}</select></label>
                <label>Chauffeur<select value={f.chauffeur} onChange={(e) => setF({ ...f, chauffeur: e.target.value })} className={CHAMP}><option value="">—</option>{chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              </> : (
                <label className="sm:col-span-2">Site de la cuve *<select value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} className={CHAMP}><option value="">Choisir</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              )}
              <label>Litres *<input inputMode="decimal" value={f.litres} onChange={(e) => setF({ ...f, litres: e.target.value })} className={CHAMP} /></label>
              <label>Compteur km ou horamètre<input inputMode="decimal" value={f.compteur} onChange={(e) => setF({ ...f, compteur: e.target.value })} className={CHAMP} /></label>
              <label className="sm:col-span-2">Note<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={CHAMP} /></label>
              {erreur && <p className="rounded-lg bg-red-50 p-3 text-red-700 sm:col-span-2">{erreur}</p>}
            </div>
            <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
              <button onClick={() => setSaisie(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Annuler</button>
              <button onClick={enregistrer} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white">Enregistrer</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

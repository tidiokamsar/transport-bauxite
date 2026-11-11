import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { buildCSV } from '../../lib/exports';

// Analyse carburant sur donnees reelles (D-030) : pleins saisis (fiches
// carburant, transactions), tonnes livrees, heures pointees. Remplace le
// tableau de bord Bolt qui lisait des tables sans producteur et affichait
// des references fixes. Une valeur non calculable reste vide.

interface Conso {
  vehicle_id: string; litres: number; cout: number | null; pleins: number; tonnes: number | null; voyages: number;
  heures_marche: number | null; litres_par_tonne: number | null; litres_par_heure: number | null;
}

const moisCourant = () => new Date().toISOString().slice(0, 7);
const bornes = (mois: string) => {
  const [a, m] = mois.split('-').map(Number);
  return { du: `${mois}-01`, au: `${mois}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}` };
};
const n = (v: number | null, d = 0) => (v === null || v === undefined ? '—' : formatNombre(Number(v), d));

export const AnalyseCarburantView = () => {
  const [mois, setMois] = useState(moisCourant);
  const [lignes, setLignes] = useState<Conso[] | null>(null);
  const [engins, setEngins] = useState<Map<string, { registration: string; vehicle_type: string }>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const { du, au } = bornes(mois);
    const [c, v] = await Promise.all([
      supabase.rpc('consommation_carburant', { p_du: du, p_au: au }),
      supabase.from('vehicles').select('id, registration, vehicle_type'),
    ]);
    setErreur(c.error ? 'Analyse indisponible : ' + c.error.message : '');
    setLignes(((c.data ?? []) as Conso[]).sort((a, b) => Number(b.litres) - Number(a.litres)));
    setEngins(new Map(((v.data ?? []) as { id: string; registration: string; vehicle_type: string }[]).map((e) => [e.id, e])));
    setHeure(new Date());
  }, [mois]);
  useEffect(() => { charger(); }, [charger]);

  const total = useMemo(() => {
    const l = lignes ?? [];
    const litres = l.reduce((s, x) => s + Number(x.litres), 0);
    const cout = l.reduce((s, x) => s + Number(x.cout ?? 0), 0);
    const tonnes = l.reduce((s, x) => s + Number(x.tonnes ?? 0), 0);
    const avecTonnes = l.filter((x) => x.tonnes !== null && Number(x.tonnes) > 0);
    const litresAvecTonnes = avecTonnes.reduce((s, x) => s + Number(x.litres), 0);
    return { litres, cout, tonnes, litresParTonne: tonnes > 0 ? litresAvecTonnes / tonnes : null, pleins: l.reduce((s, x) => s + x.pleins, 0) };
  }, [lignes]);

  const exporter = () => {
    const csv = buildCSV((lignes ?? []).map((x) => ({
      Engin: engins.get(x.vehicle_id)?.registration ?? x.vehicle_id, Litres: x.litres, Cout: x.cout ?? '', Pleins: x.pleins,
      Tonnes: x.tonnes ?? '', Voyages: x.voyages, Heures_marche: x.heures_marche ?? '', Litres_par_tonne: x.litres_par_tonne ?? '',
      Litres_par_heure: x.litres_par_heure ?? '',
    })));
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    lien.download = `analyse-carburant-${mois}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Analyse carburant</h2>
          <p className="text-stone-500">Consommation par engin rapportée aux tonnes livrées et aux heures pointées</p>
        </div>
        <div className="flex gap-2">
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
          <button onClick={exporter} disabled={!lignes?.length} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm disabled:opacity-50"><Download className="h-4 w-4" /> Exporter</button>
        </div>
      </div>
      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Synthèse carburant">
        {[
          ['Litres distribués', lignes ? `${n(total.litres)} L` : '—', `${total.pleins} plein(s)`],
          ['Coût des pleins', lignes && total.cout > 0 ? n(total.cout) : '—', 'au prix saisi sur les fiches'],
          ['Tonnes livrées', lignes ? `${n(total.tonnes, 1)} t` : '—', 'engins ayant reçu du carburant'],
          ['Litres par tonne', total.litresParTonne === null ? '—' : `${n(total.litresParTonne, 3)} L/t`, 'camions avec tonnage livré'],
        ].map(([l, v, d]) => (
          <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte">
            <p className="text-sm text-stone-500">{l}</p><p className="text-2xl font-black text-stone-900">{v}</p><p className="text-xs text-stone-400">{d}</p>
          </div>
        ))}
      </section>
      <Panneau titre="Consommation par engin">
        {lignes === null ? (
          <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
        ) : lignes.length === 0 ? (
          <SansDonnees message="Aucun plein ce mois-ci" detail="Les pleins viennent des fiches carburant saisies et des transactions." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-3 font-medium">Engin</th><th className="py-2 pr-3 text-right font-medium">Litres</th><th className="py-2 pr-3 text-right font-medium">Pleins</th>
                <th className="py-2 pr-3 text-right font-medium">Tonnes livrées</th><th className="py-2 pr-3 text-right font-medium">Voyages</th>
                <th className="py-2 pr-3 text-right font-medium">Heures pointées</th><th className="py-2 pr-3 text-right font-medium">L / t</th><th className="py-2 text-right font-medium">L / h</th>
              </tr></thead>
              <tbody>{lignes.map((x) => (
                <tr key={x.vehicle_id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-stone-900">{engins.get(x.vehicle_id)?.registration ?? '—'}</td>
                  <td className="py-2 pr-3 text-right">{n(x.litres)}</td><td className="py-2 pr-3 text-right">{x.pleins}</td>
                  <td className="py-2 pr-3 text-right">{n(x.tonnes, 1)}</td><td className="py-2 pr-3 text-right">{x.voyages}</td>
                  <td className="py-2 pr-3 text-right">{n(x.heures_marche, 1)}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{n(x.litres_par_tonne, 3)}</td><td className="py-2 text-right font-semibold">{n(x.litres_par_heure, 1)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Provenance source="pleins (transactions carburant), voyages livrés du mois, heures de marche des fiches de pointage ; « — » = non calculable" heure={heure} />
      </Panneau>
    </div>
  );
};

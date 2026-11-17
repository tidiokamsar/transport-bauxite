import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PeseeRelevesCbg } from './PeseeRelevesCbg';
import { PeseeFichesKogon } from './PeseeFichesKogon';
import { PeseeRapprochement } from './PeseeRapprochement';
import { PeseeAnomalies } from './PeseeAnomalies';
import type { ContextePesee, VoyageRef } from './peseeContexte';

// Pesee CBG a deux sources (D-081). CBG fait la pesee officielle (source A :
// releve CBG importe) ; l'agent KOGON releve ce qu'il observe sur sa fiche
// terrain (source B). Les deux sont conservees separement, puis rapprochees ;
// chaque anomalie est decidee par une personne, jamais fusionnee d'office.

type Onglet = 'releves' | 'fiches' | 'rapprochement' | 'anomalies';
const ONGLETS: [Onglet, string][] = [
  ['releves', 'A. Relevés officiels CBG'],
  ['fiches', 'B. Fiches terrain KOGON'],
  ['rapprochement', 'C. Rapprochement'],
  ['anomalies', 'D. Anomalies et validations'],
];

export const TicketsCbgView = () => {
  const { hasPermission, user } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>('releves');
  const [releveChoisi, setReleveChoisi] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ContextePesee | null>(null);
  const [erreur, setErreur] = useState('');
  const [version, setVersion] = useState(0);

  const charger = useCallback(async () => {
    const [si, v, t] = await Promise.all([
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('vehicles').select('id, registration'),
      supabase.from('trips').select('id, reference, planned_date, departure_site_id, arrival_site_id, vehicle_id, etat')
        .order('planned_date', { ascending: false }).limit(500),
    ]);
    setErreur(si.error?.message ?? v.error?.message ?? t.error?.message ?? '');
    setCtx({
      sites: (si.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })),
      engins: new Map((v.data ?? []).map((x) => [x.id as string, x.registration as string])),
      voyages: (t.data ?? []) as VoyageRef[],
      peutEcrire: hasPermission('trips', 'create') || hasPermission('trips', 'edit'),
      peutValider: hasPermission('invoices', 'create') || hasPermission('invoices', 'edit'),
      peutParametrer: hasPermission('settings', 'create') || hasPermission('settings', 'edit'),
      utilisateur: user?.id ?? null,
    });
  }, [hasPermission, user]);
  useEffect(() => { charger(); }, [charger]);

  const voirRapprochement = (id: string) => { setReleveChoisi(id); setOnglet('rapprochement'); };

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Pesée CBG</h2>
        <p className="text-sm text-stone-500">CBG pèse (relevé officiel) ; l'agent KOGON relève ce qu'il observe (fiche terrain). Deux sources conservées, rapprochées, chaque écart décidé par une personne.</p></div>
      <button onClick={() => { charger(); setVersion((x) => x + 1); }} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
    </header>
    <nav role="tablist" aria-label="Espaces de la pesée" className="flex flex-wrap gap-2">
      {ONGLETS.map(([id, texte]) => <button key={id} role="tab" aria-selected={onglet === id} onClick={() => setOnglet(id)}
        className={`rounded-lg px-3 py-2 text-sm font-semibold ${onglet === id ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}>{texte}</button>)}
    </nav>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {!ctx ? <p className="text-sm text-stone-500">Chargement des référentiels…</p> : <div key={version}>
      {onglet === 'releves' && <PeseeRelevesCbg ctx={ctx} onRapproche={voirRapprochement} />}
      {onglet === 'fiches' && <PeseeFichesKogon ctx={ctx} />}
      {onglet === 'rapprochement' && <PeseeRapprochement ctx={ctx} releveInitial={releveChoisi} />}
      {onglet === 'anomalies' && <PeseeAnomalies ctx={ctx} />}
    </div>}
  </div>;
};

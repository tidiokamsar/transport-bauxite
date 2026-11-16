import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToCSV } from '../../lib/exports';
import { Panneau, Puce, ReferentielVide, SansDonnees, type TeintePuce } from '../ui/Panneau';
import { SANS_SITE } from '../ui/referentiels';

// Centre de pilotage (D-057) : indicateurs de reference calcules par le
// serveur, chacun avec sa source, sa periode, sa fiabilite et son heure de
// calcul. Un indicateur sans donnees l'affiche ; aucun chiffre n'est estime.

interface Indicateur {
  domaine: string; code: string; libelle: string; valeur: number | null; unite: string; source: string;
  fiabilite: 'mesure' | 'partielle' | 'sans_donnees'; detail: string | null; periode_debut: string; periode_fin: string; calcule_le: string;
}
interface Lib { id: string; libelle: string }

const FIABILITE: Record<Indicateur['fiabilite'], { texte: string; teinte: TeintePuce }> = {
  mesure: { texte: 'Mesuré', teinte: 'vert' },
  partielle: { texte: 'Partiel', teinte: 'orange' },
  sans_donnees: { texte: 'Sans données', teinte: 'gris' },
};
const jour = (d: Date) => d.toISOString().slice(0, 10);
const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export const CentrePilotageView = () => {
  const [debut, setDebut] = useState(() => { const d = new Date(); d.setDate(1); return jour(d); });
  const [fin, setFin] = useState(() => jour(new Date()));
  const [site, setSite] = useState('');
  const [sites, setSites] = useState<Lib[] | null>(null);
  const [indicateurs, setIndicateurs] = useState<Indicateur[] | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    setErreur('');
    const { data, error } = await supabase.rpc('indicateurs_pilotage', { p_debut: debut, p_fin: fin, p_site: site || null });
    if (error) { setErreur(error.message); setIndicateurs([]); return; }
    setIndicateurs((data ?? []) as Indicateur[]);
  }, [debut, fin, site]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    supabase.from('sites').select('id, name').order('name').then(({ data, error }) => setSites(error ? null : (data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string }))));
  }, []);

  const domaines = useMemo(() => [...new Set((indicateurs ?? []).map((i) => i.domaine))], [indicateurs]);
  const calcule = indicateurs?.[0]?.calcule_le;
  const exporter = () => exportToCSV((indicateurs ?? []).map((i) => ({
    domaine: i.domaine, indicateur: i.libelle, valeur: i.valeur ?? '', unite: i.unite, fiabilite: FIABILITE[i.fiabilite].texte,
    source: i.source, detail: i.detail ?? '', periode: `${i.periode_debut} au ${i.periode_fin}`, calcule_le: i.calcule_le,
  })), `pilotage_${debut}_${fin}`);

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Centre de pilotage</h2>
        <p className="text-sm text-stone-500">Indicateurs de référence : chaque valeur indique sa source, sa période, sa fiabilité et son heure de calcul.</p></div>
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label>Du<input type="date" aria-label="Début de période" value={debut} onChange={(e) => setDebut(e.target.value)} className="ml-1 rounded border border-stone-300 px-2 py-1" /></label>
        <label>au<input type="date" aria-label="Fin de période" value={fin} onChange={(e) => setFin(e.target.value)} className="ml-1 rounded border border-stone-300 px-2 py-1" /></label>
        <select aria-label="Site" value={site} onChange={(e) => setSite(e.target.value)} className="rounded border border-stone-300 px-2 py-1"><option value="">Tous les sites visibles</option>{(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select>
        <button onClick={charger} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5"><RefreshCw className="h-4 w-4" /> Actualiser</button>
        <button disabled={!indicateurs?.length} onClick={exporter} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 disabled:opacity-50"><Download className="h-4 w-4" /> Exporter</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {calcule && <p className="text-xs text-stone-500">Calculé le {new Date(calcule).toLocaleString('fr-FR')} pour la période du {debut} au {fin}.</p>}
    {sites?.length === 0 && <ReferentielVide>{SANS_SITE} Les indicateurs se calculent ensuite sur les voyages, pleins et immobilisations saisis.</ReferentielVide>}
    {indicateurs === null ? <p>Chargement…</p> : indicateurs.length === 0 ? <Panneau><SansDonnees message="Aucun indicateur" detail={erreur ? 'Le calcul a échoué : voir le message ci-dessus.' : 'Le serveur n\'a renvoyé aucun indicateur pour cette période et ce périmètre.'} /></Panneau> : domaines.map((d) => <Panneau key={d} titre={d}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{indicateurs.filter((i) => i.domaine === d).map((i) => <div key={i.code} className="rounded-lg border border-stone-200 p-3" data-testid={`kpi-${i.code}`}>
        <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-stone-700">{i.libelle}</span><Puce teinte={FIABILITE[i.fiabilite].teinte}>{FIABILITE[i.fiabilite].texte}</Puce></div>
        <p className="mt-1 text-2xl font-black text-stone-900">{i.valeur === null ? 'Sans données' : `${nombre.format(i.valeur)} ${i.unite}`}</p>
        {i.detail && <p className="text-xs text-orange-800">{i.detail}</p>}
        <p className="mt-1 text-xs text-stone-500">Source : {i.source}</p>
      </div>)}</div>
    </Panneau>)}
  </div>;
};

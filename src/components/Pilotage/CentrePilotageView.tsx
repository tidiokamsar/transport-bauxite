import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToCSV, imprimerTableau } from '../../lib/exports';
import { Panneau, Puce, ReferentielVide, SansDonnees } from '../ui/Panneau';
import { SANS_SITE } from '../ui/referentiels';
import {
  comparerIndicateurs, FIABILITE, jourIso, lignesExport, lignesExportComparaison, PRUDENCE, type Indicateur,
} from './pilotage';
import { ChaineIntegree, TraceabiliteIndicateur } from './ChaineIntegree';

// Centre de pilotage (D-057, D-068) : indicateurs de reference calcules par
// le serveur, chacun avec sa source, sa periode, sa fiabilite et son heure de
// calcul. Filtres site, shift, vehicule et partenaire ; comparaison de deux
// periodes avec ecart et prudence. Un indicateur sans donnees l'affiche ;
// aucun chiffre n'est estime.

interface Lib { id: string; libelle: string }

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const valeurTexte = (i: Indicateur | null) => (!i || i.valeur === null ? 'Sans données' : `${nombre.format(i.valeur)} ${i.unite}`);
const CHAMP = 'ml-1 rounded border border-stone-300 px-2 py-1';

export const CentrePilotageView = () => {
  const [debut, setDebut] = useState(() => { const d = new Date(); d.setDate(1); return jourIso(d); });
  const [fin, setFin] = useState(() => jourIso(new Date()));
  const [comparer, setComparer] = useState(false);
  const [debutA, setDebutA] = useState(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return jourIso(d); });
  const [finA, setFinA] = useState(() => { const d = new Date(); d.setDate(0); return jourIso(d); });
  const [site, setSite] = useState('');
  const [shift, setShift] = useState('');
  const [vehicule, setVehicule] = useState('');
  const [partenaire, setPartenaire] = useState('');
  const [sites, setSites] = useState<Lib[]>([]);
  const [sitesLus, setSitesLus] = useState(false);
  const [shifts, setShifts] = useState<Lib[]>([]);
  const [engins, setEngins] = useState<Lib[]>([]);
  const [partenaires, setPartenaires] = useState<string[]>([]);
  const [indicateurs, setIndicateurs] = useState<Indicateur[] | null>(null);
  const [reference, setReference] = useState<Indicateur[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [erreurFiltres, setErreurFiltres] = useState('');
  const [detail, setDetail] = useState<Indicateur | null>(null);

  const charger = useCallback(async () => {
    setErreur('');
    const filtres = { p_site: site || null, p_shift: shift || null, p_vehicule: vehicule || null, p_partenaire: partenaire || null };
    const [b, a] = await Promise.all([
      supabase.rpc('indicateurs_pilotage', { p_debut: debut, p_fin: fin, ...filtres }),
      comparer ? supabase.rpc('indicateurs_pilotage', { p_debut: debutA, p_fin: finA, ...filtres }) : Promise.resolve({ data: null, error: null }),
    ]);
    const e = b.error ?? a.error;
    if (e) setErreur(e.message);
    setIndicateurs(b.error ? [] : ((b.data ?? []) as Indicateur[]));
    setReference(comparer && !a.error ? ((a.data ?? []) as Indicateur[]) : null);
  }, [debut, fin, debutA, finA, comparer, site, shift, vehicule, partenaire]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    Promise.all([
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('work_shifts').select('id, display_name').order('display_name'),
      supabase.from('vehicles').select('id, registration, transporteur, proprietaire, exploitant').order('registration'),
    ]).then(([s, w, v]) => {
      // Filtres incomplets signales, jamais ignores (revue D-068, constat 10).
      const erreurFiltres = s.error ?? w.error ?? v.error;
      if (erreurFiltres) setErreurFiltres(`Filtres incomplets : ${erreurFiltres.message}`);
      setSites((s.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
      setSitesLus(!s.error);
      setShifts((w.data ?? []).map((x) => ({ id: x.id as string, libelle: (x.display_name as string) ?? 'Shift' })));
      const liste = (v.data ?? []) as { id: string; registration: string; transporteur: string | null; proprietaire: string | null; exploitant: string | null }[];
      setEngins(liste.map((x) => ({ id: x.id, libelle: x.registration })));
      setPartenaires([...new Set(liste.flatMap((x) => [x.transporteur, x.proprietaire, x.exploitant]).filter((x): x is string => !!x?.trim()).map((x) => x.trim()))].sort());
    });
  }, []);

  const domaines = useMemo(() => [...new Set((indicateurs ?? []).map((i) => i.domaine))], [indicateurs]);
  const lignes = useMemo(() => (reference && indicateurs ? comparerIndicateurs(reference, indicateurs, jourIso(new Date())) : null), [reference, indicateurs]);
  const calcule = indicateurs?.[0]?.calcule_le;
  const filtresTexte = [
    site && `site ${sites.find((s) => s.id === site)?.libelle ?? site}`, shift && `shift ${shifts.find((s) => s.id === shift)?.libelle ?? shift}`,
    vehicule && `véhicule ${engins.find((s) => s.id === vehicule)?.libelle ?? vehicule}`, partenaire && `partenaire ${partenaire}`,
  ].filter(Boolean).join(', ') || 'tout le périmètre lisible';
  const mentions = [
    lignes ? `Période A du ${debutA} au ${finA} ; période B du ${debut} au ${fin}` : `Période du ${debut} au ${fin}`,
    `Filtres : ${filtresTexte}`, `Source : indicateurs_pilotage (serveur) ; calculé le ${calcule ? new Date(calcule).toLocaleString('fr-FR') : 'sans données'}`,
  ];
  const lignesSortie = () => (lignes ? lignesExportComparaison(lignes) : lignesExport(indicateurs ?? []));
  const exporter = () => exportToCSV(lignesSortie(), lignes ? `comparaison_${debutA}_${finA}_${debut}_${fin}` : `pilotage_${debut}_${fin}`);
  const imprimer = () => { if (!imprimerTableau(lignes ? 'Comparaison de périodes' : 'Centre de pilotage', mentions, lignesSortie())) setErreur('Fenêtre d\'impression bloquée par le navigateur.'); };

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Centre de pilotage</h2>
        <p className="text-sm text-stone-500">Indicateurs de référence : chaque valeur indique sa source, sa période, sa fiabilité et son heure de calcul.</p></div>
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label>Du<input type="date" aria-label="Début de période" value={debut} onChange={(e) => setDebut(e.target.value)} className={CHAMP} /></label>
        <label>au<input type="date" aria-label="Fin de période" value={fin} onChange={(e) => setFin(e.target.value)} className={CHAMP} /></label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={comparer} onChange={(e) => setComparer(e.target.checked)} /> Comparer</label>
        <button onClick={charger} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5"><RefreshCw className="h-4 w-4" /> Actualiser</button>
        <button disabled={!indicateurs?.length} onClick={exporter} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 disabled:opacity-50"><Download className="h-4 w-4" /> Exporter</button>
        <button disabled={!indicateurs?.length} onClick={imprimer} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 disabled:opacity-50"><Printer className="h-4 w-4" /> Imprimer</button>
      </div>
    </header>
    <div className="flex flex-wrap items-end gap-2 text-sm">
      {comparer && <>
        <label>Période de référence (A) du<input type="date" aria-label="Début de la période A" value={debutA} onChange={(e) => setDebutA(e.target.value)} className={CHAMP} /></label>
        <label>au<input type="date" aria-label="Fin de la période A" value={finA} onChange={(e) => setFinA(e.target.value)} className={CHAMP} /></label>
      </>}
      <select aria-label="Site" value={site} onChange={(e) => setSite(e.target.value)} className="rounded border border-stone-300 px-2 py-1"><option value="">Tous les sites visibles</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select>
      <select aria-label="Shift" value={shift} onChange={(e) => setShift(e.target.value)} className="rounded border border-stone-300 px-2 py-1"><option value="">Tous les shifts</option>{shifts.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select>
      <select aria-label="Véhicule" value={vehicule} onChange={(e) => setVehicule(e.target.value)} className="rounded border border-stone-300 px-2 py-1"><option value="">Tous les véhicules</option>{engins.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select>
      <select aria-label="Partenaire" value={partenaire} onChange={(e) => setPartenaire(e.target.value)} className="rounded border border-stone-300 px-2 py-1"><option value="">Tous les partenaires</option>{partenaires.map((p) => <option key={p} value={p}>{p}</option>)}</select>
    </div>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {sitesLus && sites.length === 0 && <ReferentielVide>{SANS_SITE} Les indicateurs se calculent ensuite sur les voyages, pleins et immobilisations saisis.</ReferentielVide>}
    {erreurFiltres && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreurFiltres}</p>}
    {calcule && <p className="text-xs text-stone-500">Calculé le {new Date(calcule).toLocaleString('fr-FR')} · {mentions[0]} · filtres : {filtresTexte}.</p>}
    {(shift || vehicule || partenaire) && <p className="text-xs text-orange-800">Un indicateur sans la dimension filtrée (shift, véhicule ou partenaire) est rendu « sans données » avec son motif, jamais avec une valeur non filtrée.</p>}

    {indicateurs === null ? <p>Chargement…</p> : lignes ? <Panneau titre="Comparaison de périodes">
      <div className="overflow-x-auto"><table className="w-full text-sm" aria-label="Comparaison de périodes">
        <thead><tr className="border-b border-stone-200 text-left text-stone-500"><th className="py-2">Indicateur</th><th>A ({debutA} au {finA})</th><th>B ({debut} au {fin})</th><th>Écart B - A</th><th>Lecture</th></tr></thead>
        <tbody>{lignes.map((l) => <tr key={l.code} className="border-b border-stone-100 align-top" data-testid={`cmp-${l.code}`}>
          <td className="py-2"><b>{l.libelle}</b><span className="block text-xs text-stone-500">{l.domaine} · source : {l.source}</span></td>
          <td>{valeurTexte(l.a)}{l.a && <span className="block"><Puce teinte={FIABILITE[l.a.fiabilite].teinte}>{FIABILITE[l.a.fiabilite].texte}</Puce></span>}</td>
          <td>{valeurTexte(l.b)}{l.b && <span className="block"><Puce teinte={FIABILITE[l.b.fiabilite].teinte}>{FIABILITE[l.b.fiabilite].texte}</Puce></span>}</td>
          <td>{l.ecart === null ? '—' : `${l.ecart > 0 ? '+' : ''}${nombre.format(l.ecart)} ${l.unite}${l.ecartPct === null ? '' : ` (${l.ecartPct > 0 ? '+' : ''}${nombre.format(l.ecartPct)} %)`}`}</td>
          <td><Puce teinte={PRUDENCE[l.prudence].teinte}>{PRUDENCE[l.prudence].texte}</Puce>{l.motifs.map((m) => <span key={m} className="block text-xs text-stone-500">{m}</span>)}</td>
        </tr>)}</tbody>
      </table></div>
    </Panneau> : indicateurs.length === 0 ? <Panneau><SansDonnees message="Aucun indicateur" detail={erreur ? 'Le calcul a échoué : voir le message ci-dessus.' : "Le serveur n'a renvoyé aucun indicateur pour cette période."} /></Panneau> : domaines.map((d) => <Panneau key={d} titre={d}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{indicateurs.filter((i) => i.domaine === d).map((i) => <div key={i.code} className="rounded-lg border border-stone-200 p-3" data-testid={`kpi-${i.code}`}>
        <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-stone-700">{i.libelle}</span><Puce teinte={FIABILITE[i.fiabilite].teinte}>{FIABILITE[i.fiabilite].texte}</Puce></div>
        <p className="mt-1 text-2xl font-black text-stone-900">{valeurTexte(i)}</p>
        {i.detail && <p className="text-xs text-orange-800">{i.detail}</p>}
        <p className="mt-1 text-xs text-stone-500">Source : {i.source}{i.nature === 'instantane' ? ' · valeur à l\'heure du calcul' : ''}</p>
        <button onClick={() => setDetail(i)} className="mt-2 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-semibold text-stone-700">Détail et traçabilité</button>
      </div>)}</div>
    </Panneau>)}
    {detail && <TraceabiliteIndicateur code={detail.code} libelle={detail.libelle} debut={debut} fin={fin} site={site} onFermer={() => setDetail(null)} />}
    <ChaineIntegree debut={debut} fin={fin} site={site} />
  </div>;
};

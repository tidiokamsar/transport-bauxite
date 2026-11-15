import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSite } from '../../contexts/SiteContext';
import { Panneau, Provenance, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { buildCSV } from '../../lib/exports';
import { AXES, libelleLigne, lignesCsv, type Axe, type LigneRapportVoyages } from './rapports';

// Rapports par camion, chauffeur, site et shift sur une periode (D-066) :
// rapport_voyages (SECURITY INVOKER, droits et perimetre du lecteur).

const jour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const CHAMP = 'rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm';
const duree = (v: number | null, n: number) => (v === null ? <span className="text-stone-400">non mesurée</span> : <>{formatNombre(Number(v))} min <span className="text-xs text-stone-400">({n})</span></>);

export const RapportsVoyages = () => {
  const { siteId, sites } = useSite();
  const [debut, setDebut] = useState(() => { const d = new Date(); return jour(new Date(d.getFullYear(), d.getMonth(), 1)); });
  const [fin, setFin] = useState(() => jour(new Date()));
  const [axe, setAxe] = useState<Axe>('camion');
  const [site, setSite] = useState('');
  const [lignes, setLignes] = useState<LigneRapportVoyages[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    if (!debut || !fin) return;
    setLignes(null);
    const { data, error } = await supabase.rpc('rapport_voyages', { p_debut: debut, p_fin: fin, p_axe: axe, p_site: siteId || site || null });
    setErreur(error ? `Rapport indisponible : ${error.message}` : '');
    setLignes(error ? [] : (data ?? []) as LigneRapportVoyages[]);
    setHeure(new Date());
  }, [debut, fin, axe, site, siteId]);
  useEffect(() => { charger(); }, [charger]);

  const exporter = () => {
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob(['﻿' + buildCSV(lignesCsv(axe, lignes ?? []))], { type: 'text/csv;charset=utf-8' }));
    lien.download = `rapport-voyages-${axe}-${debut}-${fin}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  const total = (lignes ?? []).reduce((a, l) => ({ voyages: a.voyages + l.voyages, livres: a.livres + l.livres }), { voyages: 0, livres: 0 });

  return (
    <Panneau
      titre={`Rapport par ${AXES[axe].libelle.toLowerCase()}`}
      action={<button onClick={exporter} disabled={!lignes || lignes.length === 0} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-stone-50 disabled:opacity-50"><Download className="h-4 w-4" /> Exporter CSV</button>}
    >
      <div className="mb-4 flex flex-wrap items-end gap-2" role="group" aria-label="Paramètres du rapport">
        <label className="text-sm">Du<input type="date" aria-label="Début de période" value={debut} onChange={(e) => setDebut(e.target.value)} className={`ml-2 ${CHAMP}`} /></label>
        <label className="text-sm">au<input type="date" aria-label="Fin de période" value={fin} onChange={(e) => setFin(e.target.value)} className={`ml-2 ${CHAMP}`} /></label>
        <select aria-label="Axe du rapport" value={axe} onChange={(e) => setAxe(e.target.value as Axe)} className={CHAMP}>
          {(Object.keys(AXES) as Axe[]).map((a) => <option key={a} value={a}>Par {AXES[a].libelle.toLowerCase()}</option>)}
        </select>
        <select aria-label="Site de chargement" value={siteId || site} onChange={(e) => setSite(e.target.value)} disabled={Boolean(siteId)} className={CHAMP}>
          <option value="">Tous les sites</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {lignes === null ? <p className="text-sm text-stone-400">Chargement…</p> : lignes.length === 0 ? (
        <SansDonnees message="Sans données" detail="Aucun voyage ni incident sur la période et le périmètre choisis." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Rapport de voyages">
            <thead><tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2 pr-3 font-medium">{AXES[axe].libelle}</th>
              <th className="py-2 pr-3 text-right font-medium">Voyages</th><th className="py-2 pr-3 text-right font-medium">Livrés</th>
              <th className="py-2 pr-3 text-right font-medium">Annulés</th><th className="py-2 pr-3 text-right font-medium">Tonnes livrées</th>
              <th className="py-2 pr-3 text-right font-medium">Cycle moyen</th><th className="py-2 pr-3 text-right font-medium">Rotation moyenne</th>
              <th className="py-2 pr-3 text-right font-medium">Incidents</th><th className="py-2 text-right font-medium">Litiges</th>
            </tr></thead>
            <tbody>{lignes.map((l) => (
              <tr key={l.cle ?? 'aucune'} className="border-b border-stone-100 last:border-0">
                <td className="py-2 pr-3 font-semibold text-stone-900">{libelleLigne(axe, l)}</td>
                <td className="py-2 pr-3 text-right">{l.voyages}</td>
                <td className="py-2 pr-3 text-right">{l.livres}</td>
                <td className="py-2 pr-3 text-right">{l.annules}</td>
                <td className="py-2 pr-3 text-right">
                  {l.tonnes === null ? <span className="text-stone-400">sans pesée</span> : `${formatNombre(Number(l.tonnes), 1)} t`}
                  {l.livres_sans_poids > 0 && <span className="block text-xs text-orange-700">{l.livres_sans_poids} livré(s) sans poids</span>}
                </td>
                <td className="py-2 pr-3 text-right">{duree(l.cycle_moyen_min, l.cycles_mesures)}</td>
                <td className="py-2 pr-3 text-right">{duree(l.rotation_moyenne_min, l.rotations_mesurees)}</td>
                <td className="py-2 pr-3 text-right">{l.incidents}</td>
                <td className="py-2 text-right">{l.litiges}</td>
              </tr>))}</tbody>
          </table>
          <p className="mt-2 text-xs text-stone-500">{total.voyages} voyage(s), {total.livres} livré(s). Tonnes : accepté, sinon reçu, sinon chargé (D-023). Cycle : arrivée au chargement → livraison ; rotation : arrivée au chargement → arrivée au chargement suivante du même camion (même jour, même shift) ; entre parenthèses le nombre de mesures. Litiges : voyages passés par l'état litige.</p>
        </div>
      )}
      <Provenance source={`rapport_voyages du ${new Date(debut).toLocaleDateString('fr-FR')} au ${new Date(fin).toLocaleDateString('fr-FR')}, voyages, journal des événements et incidents ; périmètre du lecteur`} heure={heure} />
    </Panneau>
  );
};

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, SansDonnees } from '../ui/Panneau';
import { texteCoutKm, texteMesure } from './pneus';

// Performance par marque et modele (D-067) : calculee par le serveur
// (v_pneus_performance) sur les seuls pneus reformes aux mesures completes ;
// les pneus exclus sont comptes, jamais estimes.

export interface PerformanceModele {
  marque: string; modele: string | null; nb_pneus: number; nb_pris_en_compte: number; nb_exclus: number;
  nb_exclus_en_service: number; nb_exclus_mesures_incompletes: number; km_moyens: number | null; cout_km: number | null;
  duree_vie_jours: number | null; seuil_reforme_precoce_km: number | null; taux_reforme_precoce_pct: number | null;
}

export const PerformancePneus = ({ version }: { version: number }) => {
  const [lignes, setLignes] = useState<PerformanceModele[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  useEffect(() => {
    let actif = true;
    supabase.from('v_pneus_performance').select('*').order('marque').then(({ data, error }) => {
      if (!actif) return;
      setErreur(error?.message ?? '');
      setLignes((data ?? []) as PerformanceModele[]);
      setHeure(new Date());
    });
    return () => { actif = false; };
  }, [version]);
  const seuil = lignes?.find((l) => l.seuil_reforme_precoce_km !== null)?.seuil_reforme_precoce_km ?? null;
  const tri = (lignes ?? []).slice().sort((a, b) => a.marque.localeCompare(b.marque) || (a.modele === null ? 1 : b.modele === null ? -1 : a.modele.localeCompare(b.modele)));
  return <Panneau titre="Performance par marque et modèle">
    {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {lignes === null ? <p>Chargement…</p> : lignes.length === 0 ? <SansDonnees message="Aucun pneu enregistré" /> :
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
        <th className="py-2 pr-3">Marque · modèle</th><th className="py-2 pr-3 text-right">Pris en compte</th><th className="py-2 pr-3 text-right">Exclus</th>
        <th className="py-2 pr-3 text-right">Km moyens</th><th className="py-2 pr-3 text-right">Coût au km</th><th className="py-2 pr-3 text-right">Durée de vie</th>
        <th className="py-2 pr-3 text-right">Réforme précoce</th></tr></thead>
        <tbody>{tri.map((l) => <tr key={`${l.marque}-${l.modele ?? '*'}`} className={`border-b border-stone-100 ${l.modele === null ? 'bg-stone-50 font-semibold' : ''}`}>
          <td className="py-2 pr-3">{l.marque} · {l.modele ?? 'tous modèles'}</td>
          <td className="py-2 pr-3 text-right">{l.nb_pris_en_compte} / {l.nb_pneus}</td>
          <td className="py-2 pr-3 text-right">{l.nb_exclus}<span className="block text-xs font-normal text-stone-500">{l.nb_exclus_en_service} en service, {l.nb_exclus_mesures_incompletes} mesures incomplètes</span></td>
          <td className="py-2 pr-3 text-right">{texteMesure(l.km_moyens, 'km')}</td>
          <td className="py-2 pr-3 text-right">{texteCoutKm(l.cout_km)}</td>
          <td className="py-2 pr-3 text-right">{texteMesure(l.duree_vie_jours, 'jours')}</td>
          <td className="py-2 pr-3 text-right">{l.taux_reforme_precoce_pct === null ? 'Sans données' : `${l.taux_reforme_precoce_pct} %`}</td>
        </tr>)}</tbody></table></div>}
    <p className="mt-2 text-xs text-stone-500">Pris en compte : pneus réformés, montés au moins une fois, km connus à chaque montage et coût au km calculé. Durée de vie : du premier montage à la réforme.
      Réforme précoce : moins de {seuil === null ? '(seuil non fixé par l\'administrateur : sans données)' : `${seuil} km`}.</p>
    <Provenance source="registre des pneus et journal des opérations (v_pneus), calcul serveur" heure={heure} />
  </Panneau>;
};

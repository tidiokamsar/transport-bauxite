import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';

// Pleins a examiner (D-030), calcules sur les donnees reelles par des
// regles affichees. Le seuil de surconsommation est saisi : sans seuil,
// cette regle ne s'applique pas.

interface Anomalie { type: string; vehicle_id: string | null; jour: string | null; reference: string | null; litres: number | null; detail: string }

const REGLES: Record<string, { libelle: string; explication: string }> = {
  pleins_meme_jour: { libelle: 'Plusieurs pleins le même jour', explication: 'Deux pleins ou plus pour le même engin à la même date.' },
  plein_sans_activite: { libelle: 'Plein sans activité', explication: 'Aucun voyage (camion ou chargeuse) ni pointage de l\'engin ce jour-là.' },
  plein_sans_engin: { libelle: 'Plein sans engin', explication: 'Le plein ne désigne aucun engin.' },
  surconsommation: { libelle: 'Surconsommation', explication: 'Litres par tonne au-dessus de la médiane de la flotte augmentée du seuil.' },
};

const moisCourant = () => new Date().toISOString().slice(0, 7);

export const AnomaliesCarburantView = () => {
  const [mois, setMois] = useState(moisCourant);
  const [seuil, setSeuil] = useState('');
  const [liste, setListe] = useState<Anomalie[] | null>(null);
  const [engins, setEngins] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [a, m] = mois.split('-').map(Number);
    const du = `${mois}-01`;
    const au = `${mois}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
    const valeur = seuil.trim() === '' ? null : Number(seuil.replace(',', '.'));
    const [r, v] = await Promise.all([
      supabase.rpc('anomalies_carburant', { p_du: du, p_au: au, p_seuil_pct: valeur }),
      supabase.from('vehicles').select('id, registration'),
    ]);
    setErreur(r.error ? 'Contrôle indisponible : ' + r.error.message : '');
    setListe((r.data ?? []) as Anomalie[]);
    setEngins(new Map(((v.data ?? []) as { id: string; registration: string }[]).map((e) => [e.id, e.registration])));
    setHeure(new Date());
  }, [mois, seuil]);
  useEffect(() => { charger(); }, [charger]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Anomalies carburant</h2>
          <p className="text-stone-500">Pleins à examiner, selon des règles explicites appliquées aux données saisies</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois" className="rounded-xl border border-stone-200 bg-white px-3 py-2 font-medium shadow-sm" />
          <label className="text-stone-600">Seuil de surconsommation (%)
            <input inputMode="decimal" value={seuil} onChange={(e) => setSeuil(e.target.value)} placeholder="non appliqué" className="ml-2 w-28 rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-sm" />
          </label>
        </div>
      </div>
      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      <Panneau titre={`Pleins à examiner (${liste?.length ?? 0})`}>
        {liste === null ? (
          <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
        ) : liste.length === 0 ? (
          <SansDonnees message="Aucune anomalie" detail="Aucun plein du mois ne déclenche les règles ci-dessous." />
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {liste.map((x, i) => (
              <li key={`${x.type}-${x.reference}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-semibold text-stone-900">{REGLES[x.type]?.libelle ?? x.type} · {x.vehicle_id ? engins.get(x.vehicle_id) ?? '—' : 'engin inconnu'}</p>
                  <p className="text-xs text-stone-500">{x.jour ? new Date(x.jour + 'T00:00:00').toLocaleDateString('fr-FR') + ' · ' : ''}{x.reference ?? ''} · {x.detail}</p>
                </div>
                <span className="font-semibold text-stone-700">{x.litres !== null ? `${formatNombre(Number(x.litres))} L` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Panneau>
      <Panneau titre="Règles appliquées">
        <ul className="space-y-1 text-sm text-stone-600">{Object.values(REGLES).map((r) => <li key={r.libelle}><b>{r.libelle}</b> : {r.explication}</li>)}</ul>
        <Provenance source="pleins, voyages et fiches de pointage du mois" heure={heure} />
      </Panneau>
    </div>
  );
};

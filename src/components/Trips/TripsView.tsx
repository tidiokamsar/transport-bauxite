import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { buildCSV } from '../../lib/exports';
import { ETATS, PHASES, estEtat, phaseDe, tonnageVoyage, type Phase } from './cycle';
import { COLONNES_VOYAGE, type Voyage } from './types';
import { FicheVoyage } from './FicheVoyage';
import { NouveauVoyage, type Option } from './NouveauVoyage';

// Voyages & Rotations (etape 2 de la reprise, CDC 12). Les voyages du jour
// choisi, par phase du cycle ; chaque changement d'etat passe par la fiche
// du voyage et la fonction serveur avancer_voyage.

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Vehicule { id: string; registration: string; vehicle_type: string; status: string }
interface Chauffeur { id: string; name: string; status: string | null }
interface Shift { id: string; display_name: string }

export const TripsView = () => {
  const { hasPermission } = useAuth();
  const { siteId, sites } = useSite();
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [date, setDate] = useState(aujourdhui);
  const [phase, setPhase] = useState<Phase | 'toutes'>('toutes');
  const [recherche, setRecherche] = useState('');
  const [voyages, setVoyages] = useState<Voyage[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('id, registration, vehicle_type, status').order('registration'),
      supabase.from('drivers').select('id, name, status').order('name'),
      supabase.from('work_shifts').select('id, display_name').eq('is_active', true).order('shift_order'),
    ]).then(([v, c, s]) => {
      setVehicules((v.data ?? []) as Vehicule[]);
      setChauffeurs((c.data ?? []) as Chauffeur[]);
      setShifts((s.data ?? []) as Shift[]);
    });
  }, []);

  const charger = useCallback(async () => {
    let requete = supabase.from('trips').select(COLONNES_VOYAGE).eq('planned_date', date).order('reference');
    if (siteId) requete = requete.or(`departure_site_id.eq.${siteId},arrival_site_id.eq.${siteId}`);
    const { data, error } = await requete;
    if (error) {
      setErreur('Voyages indisponibles : ' + error.message);
      setVoyages([]);
    } else {
      setErreur('');
      setVoyages((data ?? []) as Voyage[]);
    }
    setHeure(new Date());
  }, [date, siteId]);

  useEffect(() => {
    charger();
    const minuterie = window.setInterval(charger, 60_000);
    return () => window.clearInterval(minuterie);
  }, [charger]);

  const noms = useMemo(() => ({
    vehicule: new Map(vehicules.map((v) => [v.id, v.registration])),
    chauffeur: new Map(chauffeurs.map((c) => [c.id, c.name])),
    site: new Map(sites.map((s) => [s.id, s.name])),
    shift: new Map(shifts.map((s) => [s.id, s.display_name])),
  }), [vehicules, chauffeurs, sites, shifts]);
  const nom = (carte: Map<string, string>, id: string | null) => (id ? carte.get(id) ?? '—' : '—');

  const parPhase = useMemo(() => {
    const compte: Record<Phase, number> = { prevu: 0, chargement: 0, route: 0, dechargement: 0, livre: 0, exception: 0 };
    let tonnesLivrees = 0;
    for (const v of voyages ?? []) {
      const p = phaseDe(v.etat);
      compte[p] += 1;
      if (p === 'livre') tonnesLivrees += tonnageVoyage(v)?.valeur ?? 0;
    }
    return { compte, tonnesLivrees };
  }, [voyages]);

  const visibles = useMemo(() => {
    const filtre = recherche.trim().toLowerCase();
    return (voyages ?? []).filter((v) => {
      if (phase !== 'toutes' && phaseDe(v.etat) !== phase) return false;
      if (!filtre) return true;
      return [v.reference, nom(noms.vehicule, v.vehicle_id), nom(noms.chauffeur, v.driver_id)]
        .some((t) => t.toLowerCase().includes(filtre));
    });
  }, [voyages, phase, recherche, noms]);

  const exporter = () => {
    const lignes = visibles.map((v) => {
      const t = tonnageVoyage(v);
      return {
        Reference: v.reference,
        Date: v.planned_date,
        Etat: estEtat(v.etat) ? ETATS[v.etat].libelle : v.etat ?? '',
        Camion: nom(noms.vehicule, v.vehicle_id),
        Chauffeur: nom(noms.chauffeur, v.driver_id),
        Chargeuse: nom(noms.vehicule, v.loader_vehicle_id),
        Origine: nom(noms.site, v.departure_site_id),
        Destination: nom(noms.site, v.arrival_site_id),
        Tonnage: t ? t.valeur : '',
        Nature_tonnage: t ? t.nature : '',
      };
    });
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob(['﻿' + buildCSV(lignes)], { type: 'text/csv;charset=utf-8' }));
    lien.download = `voyages-${date}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  const options = (liste: Vehicule[], types: string[]): Option[] =>
    liste.filter((v) => types.includes(v.vehicle_type) && v.status === 'active').map((v) => ({ id: v.id, libelle: v.registration }));
  const voyageOuvert = voyages?.find((v) => v.id === ouvert) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Voyages & Rotations</h2>
          <p className="text-stone-500">Cycle de chaque voyage, de l'affectation à l'acceptation des tonnes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
            aria-label="Date des voyages"
          />
          <button onClick={exporter} disabled={visibles.length === 0} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-stone-50 disabled:opacity-50">
            <Download className="h-4 w-4" /> Exporter
          </button>
          {peutEcrire && (
            <button onClick={() => setCreation(true)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
              <Plus className="h-4 w-4" /> Nouveau voyage
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
        <button
          onClick={() => setPhase('toutes')}
          className={`rounded-2xl border p-4 text-left shadow-carte transition ${phase === 'toutes' ? 'border-orange-400 bg-orange-50' : 'border-stone-200 bg-white hover:border-orange-200'}`}
        >
          <p className="text-sm text-stone-500">Tous</p>
          <p className="text-2xl font-black text-stone-900">{voyages?.length ?? '—'}</p>
        </button>
        {(Object.keys(PHASES) as Phase[]).map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={`rounded-2xl border p-4 text-left shadow-carte transition ${phase === p ? 'border-orange-400 bg-orange-50' : 'border-stone-200 bg-white hover:border-orange-200'}`}
          >
            <p className="text-sm text-stone-500">{PHASES[p].libelle}</p>
            <p className="text-2xl font-black text-stone-900">{voyages ? parPhase.compte[p] : '—'}</p>
            {p === 'livre' && voyages && <p className="text-xs text-stone-500">{formatNombre(parPhase.tonnesLivrees)} t</p>}
          </button>
        ))}
      </div>

      <Panneau
        titre={phase === 'toutes' ? 'Voyages du jour' : PHASES[phase].libelle}
        action={
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Référence, camion, chauffeur"
              className="w-64 rounded-xl border border-stone-200 py-2 pl-9 pr-3 text-sm"
            />
          </label>
        }
      >
        {erreur && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
        {voyages === null ? (
          <div className="flex h-32 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
        ) : visibles.length === 0 ? (
          <SansDonnees message="Aucun voyage" detail={voyages.length === 0 ? 'Aucun voyage prévu à cette date pour ce périmètre.' : 'Aucun voyage ne correspond au filtre.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-2 pr-3 font-medium">Voyage</th>
                  <th className="py-2 pr-3 font-medium">Camion</th>
                  <th className="py-2 pr-3 font-medium">Chauffeur</th>
                  <th className="py-2 pr-3 font-medium">Chargeuse</th>
                  <th className="py-2 pr-3 font-medium">Origine → Destination</th>
                  <th className="py-2 pr-3 text-right font-medium">Tonnage</th>
                  <th className="py-2 pr-3 font-medium">État</th>
                  <th className="py-2 font-medium">Mis à jour</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((v) => {
                  const p = PHASES[phaseDe(v.etat)];
                  const t = tonnageVoyage(v);
                  return (
                    <tr key={v.id} onClick={() => setOuvert(v.id)} className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-orange-50/50">
                      <td className="py-2.5 pr-3 font-semibold text-stone-900">{v.reference}</td>
                      <td className="py-2.5 pr-3 text-stone-700">{nom(noms.vehicule, v.vehicle_id)}</td>
                      <td className="py-2.5 pr-3 text-stone-700">{nom(noms.chauffeur, v.driver_id)}</td>
                      <td className="py-2.5 pr-3 text-stone-700">{nom(noms.vehicule, v.loader_vehicle_id)}</td>
                      <td className="py-2.5 pr-3 text-stone-700">{nom(noms.site, v.departure_site_id)} → {nom(noms.site, v.arrival_site_id)}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {t ? <><b className="text-stone-900">{formatNombre(t.valeur, 1)} t</b> <span className="text-xs text-stone-400">{t.nature}</span></> : <span className="text-stone-400">—</span>}
                      </td>
                      <td className="py-2.5 pr-3"><Puce teinte={p.teinte}>{estEtat(v.etat) ? ETATS[v.etat].libelle : v.etat}</Puce></td>
                      <td className="py-2.5 text-stone-500">
                        {v.etat_modifie_le ? new Date(v.etat_modifie_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Provenance source="voyages de la date choisie, journal des événements" heure={heure} />
      </Panneau>

      {creation && (
        <NouveauVoyage
          date={date}
          sites={sites}
          camions={options(vehicules, ['tipper', 'flatbed', 'tanker'])}
          chauffeurs={chauffeurs.filter((c) => c.status === 'active').map((c) => ({ id: c.id, libelle: c.name }))}
          chargeuses={options(vehicules, ['loader', 'excavator'])}
          shifts={shifts.map((s) => ({ id: s.id, libelle: s.display_name }))}
          onFermer={() => setCreation(false)}
          onCree={(id) => {
            setCreation(false);
            charger().then(() => setOuvert(id));
          }}
        />
      )}

      {voyageOuvert && (
        <FicheVoyage
          voyage={voyageOuvert}
          peutEcrire={peutEcrire}
          libelles={{
            camion: nom(noms.vehicule, voyageOuvert.vehicle_id),
            chauffeur: nom(noms.chauffeur, voyageOuvert.driver_id),
            chargeuse: nom(noms.vehicule, voyageOuvert.loader_vehicle_id),
            origine: nom(noms.site, voyageOuvert.departure_site_id),
            destination: nom(noms.site, voyageOuvert.arrival_site_id),
            shift: nom(noms.shift, voyageOuvert.shift_id),
          }}
          onFermer={() => setOuvert(null)}
          onModifie={charger}
        />
      )}
    </div>
  );
};

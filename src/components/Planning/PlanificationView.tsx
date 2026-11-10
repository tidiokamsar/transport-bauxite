import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { Panneau, Provenance, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { fenetreJournee, fenetreShift, suivre, totalJournee, type ShiftHoraire, type StatistiquesRotation } from './plan';
import { CarteObjectif, type Realisation } from './CarteObjectif';
import { AnnulerObjectif, DefinirObjectif, HistoriqueObjectif } from './FenetresObjectif';

// Planification v1 (etape 3 de la reprise, CDC 6, D-023) : objectifs de
// production par date, site de chargement et shift, compares aux voyages
// livres. Le systeme projette et estime ; l'exploitant fixe et revise.

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Engin { id: string; vehicle_type: string; status: string; site_id: string | null }

type Fenetre =
  | { type: 'definir'; initial?: { site_id: string; shift_id: string | null } }
  | { type: 'annuler'; objectif: Realisation; libelle: string }
  | { type: 'historique'; objectif: Realisation; libelle: string };

export const PlanificationView = () => {
  const { hasPermission } = useAuth();
  const { siteId, sites } = useSite();
  const peutEcrire = hasPermission('planning', 'create') || hasPermission('planning', 'edit');
  const [date, setDate] = useState(aujourdhui);
  const [objectifs, setObjectifs] = useState<Realisation[] | null>(null);
  const [shifts, setShifts] = useState<ShiftHoraire[]>([]);
  const [engins, setEngins] = useState<Engin[]>([]);
  const [stats, setStats] = useState<Record<string, StatistiquesRotation | null>>({});
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('work_shifts').select('id, display_name, start_time, end_time').eq('is_active', true).order('shift_order'),
      supabase.from('vehicles').select('id, vehicle_type, status, site_id'),
    ]).then(([s, v]) => {
      setShifts((s.data ?? []) as ShiftHoraire[]);
      setEngins((v.data ?? []) as Engin[]);
    });
  }, []);

  const charger = useCallback(async () => {
    let requete = supabase.from('v_realisation_objectifs').select('*').eq('date_plan', date);
    if (siteId) requete = requete.eq('site_id', siteId);
    const { data, error } = await requete;
    if (error) {
      setErreur('Objectifs indisponibles : ' + error.message);
      setObjectifs([]);
    } else {
      setErreur('');
      setObjectifs((data ?? []) as Realisation[]);
    }
    setHeure(new Date());
    setMaintenant(new Date());
  }, [date, siteId]);

  useEffect(() => {
    charger();
    const minuterie = window.setInterval(charger, 60_000);
    return () => window.clearInterval(minuterie);
  }, [charger]);

  // Statistiques de rotation (14 jours precedant la date) par objectif.
  useEffect(() => {
    if (!objectifs) return;
    let actif = true;
    setStats({});
    Promise.all(objectifs.map(async (o) => {
      const { data, error } = await supabase.rpc('statistiques_rotation', { p_site_id: o.site_id, p_shift_id: o.shift_id, p_jusqua: o.date_plan });
      const ligne = !error && Array.isArray(data) ? (data[0] as StatistiquesRotation | undefined) ?? null : null;
      return [o.id, ligne] as const;
    })).then((paires) => {
      if (actif) setStats(Object.fromEntries(paires));
    });
    return () => { actif = false; };
  }, [objectifs]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const shiftParId = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);

  const libelleObjectif = (o: Realisation) => {
    const shift = o.shift_id ? shiftParId.get(o.shift_id) : null;
    return `${nomSite.get(o.site_id) ?? 'Site inconnu'} · ${o.shift_id ? `Shift ${shift?.display_name ?? '?'}` : 'Journée'}`;
  };

  const fenetreDe = (o: Realisation) => {
    const shift = o.shift_id ? shiftParId.get(o.shift_id) : null;
    return shift ? fenetreShift(o.date_plan, shift) : fenetreJournee(o.date_plan, shifts);
  };

  const horaire = (o: Realisation) => {
    const f = fenetreDe(o);
    const h = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const lendemain = f.fin.getDate() !== f.debut.getDate() ? ' (lendemain)' : '';
    return `${h(f.debut)} – ${h(f.fin)}${lendemain}${o.shift_id ? '' : ' · tous les shifts'}`;
  };

  const disponibles = (site: string) => {
    const duSite = engins.filter((e) => e.site_id === site);
    const camions = duSite.filter((e) => ['tipper', 'flatbed', 'tanker'].includes(e.vehicle_type));
    return {
      camions: camions.filter((e) => e.status === 'active').length,
      indisponibles: camions.filter((e) => e.status === 'maintenance' || e.status === 'immobilized').length,
      chargeuses: duSite.filter((e) => ['loader', 'excavator'].includes(e.vehicle_type) && e.status === 'active').length,
    };
  };

  const tries = useMemo(() => [...(objectifs ?? [])].sort((a, b) => {
    const s = (nomSite.get(a.site_id) ?? '').localeCompare(nomSite.get(b.site_id) ?? '');
    if (s !== 0) return s;
    const ordre = (o: Realisation) => (o.shift_id ? shifts.findIndex((x) => x.id === o.shift_id) + 1 : 0);
    return ordre(a) - ordre(b);
  }), [objectifs, nomSite, shifts]);

  const total = totalJournee(objectifs ?? []);
  const suiviTotal = total ? suivre(total.cible, total.realise, fenetreJournee(date, shifts), maintenant) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Planification</h2>
          <p className="text-stone-500">Objectifs de production par site et par shift, comparés aux voyages livrés</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm"
            aria-label="Date du plan"
          />
          {peutEcrire && (
            <button onClick={() => setFenetre({ type: 'definir' })} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
              <Plus className="h-4 w-4" /> Définir un objectif
            </button>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Synthèse de la journée">
        {[
          { libelle: 'Objectif de la journée', valeur: total ? `${formatNombre(total.cible)} t` : 'Non défini' },
          { libelle: 'Livré', valeur: total ? `${formatNombre(total.realise)} t` : '—' },
          { libelle: 'Réalisation du plan', valeur: suiviTotal ? `${Math.round(suiviTotal.pourcentage)} %` : '—' },
          {
            libelle: 'Prévision de fin de journée',
            valeur: suiviTotal?.prevision != null ? `${formatNombre(suiviTotal.prevision)} t` : '—',
          },
        ].map((k) => (
          <div key={k.libelle} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte">
            <p className="flex items-center gap-1.5 text-sm text-stone-500"><Target className="h-4 w-4 text-orange-600" />{k.libelle}</p>
            <p className="mt-1 text-2xl font-black text-stone-900">{k.valeur}</p>
          </div>
        ))}
      </section>

      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      {objectifs === null ? (
        <div className="flex h-32 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
      ) : tries.length === 0 ? (
        <Panneau>
          <SansDonnees
            message="Aucun objectif"
            detail={peutEcrire
              ? 'Aucun objectif de production pour cette date et ce périmètre. Définissez-en un pour suivre la réalisation.'
              : 'Aucun objectif de production pour cette date et ce périmètre.'}
          />
        </Panneau>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {tries.map((o) => (
            <CarteObjectif
              key={o.id}
              objectif={o}
              titre={libelleObjectif(o)}
              horaire={horaire(o)}
              suivi={suivre(Number(o.tonnes_cible), Number(o.tonnes_livrees), fenetreDe(o), maintenant)}
              stats={o.id in stats ? stats[o.id] : undefined}
              disponibles={disponibles(o.site_id)}
              peutEcrire={peutEcrire}
              onReviser={() => setFenetre({ type: 'definir', initial: { site_id: o.site_id, shift_id: o.shift_id } })}
              onAnnuler={() => setFenetre({ type: 'annuler', objectif: o, libelle: libelleObjectif(o) })}
              onHistorique={() => setFenetre({ type: 'historique', objectif: o, libelle: libelleObjectif(o) })}
            />
          ))}
        </div>
      )}
      <Provenance
        source="objectifs de production ; réalisation = voyages livrés (livré, accepté, clôturé, en litige) partis du site, tonnage accepté sinon reçu sinon chargé ; prévision au rythme constaté ; ressources : 14 jours précédents"
        heure={heure}
      />

      {fenetre?.type === 'definir' && (
        <DefinirObjectif
          date={date}
          sites={siteId ? sites.filter((s) => s.id === siteId) : sites}
          shifts={shifts}
          existants={objectifs ?? []}
          initial={fenetre.initial}
          onFermer={() => setFenetre(null)}
          onEnregistre={() => { setFenetre(null); charger(); }}
        />
      )}
      {fenetre?.type === 'annuler' && (
        <AnnulerObjectif
          id={fenetre.objectif.id}
          libelle={fenetre.libelle}
          onFermer={() => setFenetre(null)}
          onAnnule={() => { setFenetre(null); charger(); }}
        />
      )}
      {fenetre?.type === 'historique' && (
        <HistoriqueObjectif
          date={fenetre.objectif.date_plan}
          siteId={fenetre.objectif.site_id}
          shiftId={fenetre.objectif.shift_id}
          libelle={fenetre.libelle}
          onFermer={() => setFenetre(null)}
        />
      )}
    </div>
  );
};

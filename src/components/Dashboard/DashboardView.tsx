import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Fuel, Info, Mountain, Target, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSite } from '../../contexts/SiteContext';
import { Embleme, NOM_PRODUIT } from '../Brand/Marque';
import { Panneau, Provenance, Puce, SansDonnees, type TeintePuce } from '../ui/Panneau';
import { Anneau, BarresProduction, Donut } from './Graphiques';
import { CarteFlotte, type PositionAffichee } from './CarteFlotte';
import {
  bilanVoyages, debutJour, disponibilite, formatNombre, positionFraiche, repartitionFlotte,
  tonnesParHeure, variation, type VoyageTermine, FRAICHEUR_POSITION_MINUTES,
} from './indicateurs';

// Tableau de bord, maquette du proprietaire (2026-11-09, D-018).
// Regles : chaque indicateur vient de la base et affiche sa source et son
// heure (CDC 8) ; donnee absente = « sans donnees » (regle 1) ; une
// position de plus de 15 minutes n'est pas montree en direct (CDC 15).
// L'objectif de production n'existe pas encore (planification, LOT 03).

interface Vehicule {
  id: string;
  registration: string;
  status: string;
  site_id: string | null;
}

interface Voyage extends VoyageTermine {
  id: string;
}

interface DernierVoyage {
  id: string;
  reference: string | null;
  vehicle_id: string | null;
  departure_site_id: string | null;
  arrival_site_id: string | null;
  net_weight: number | null;
  load_weight: number | null;
  status: string;
}

interface Alerte {
  id: string;
  title: string;
  message: string;
  severity: string;
  created_at: string;
}

interface Position {
  vehicle_id: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  speed: number | null;
}

interface Donnees {
  vehicules: Vehicule[] | null;
  voyages: Voyage[] | null;
  enCours: { vehicle_id: string | null }[] | null;
  derniers: DernierVoyage[] | null;
  litres: number | null;
  carburantErreur: boolean;
  alertes: Alerte[] | null;
  positions: Position[] | null;
  heure: Date;
}

const STATUT_VOYAGE: Record<string, { libelle: string; teinte: TeintePuce }> = {
  planned: { libelle: 'Planifié', teinte: 'gris' },
  in_progress: { libelle: 'En cours', teinte: 'bleu' },
  completed: { libelle: 'Livré', teinte: 'vert' },
  cancelled: { libelle: 'Annulé', teinte: 'rouge' },
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const ilYa = (iso: string, maintenant: Date) => {
  const min = Math.max(0, Math.round((maintenant.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `Il y a ${h} h` : `Il y a ${Math.round(h / 24)} j`;
};

const resultat = <T,>(r: { data: T | null; error: { message: string } | null }, source: string): T | null => {
  if (r.error) {
    console.error(`${source} :`, r.error.message);
    return null;
  }
  return r.data;
};

const Variation = ({ valeur }: { valeur: number | null }) =>
  valeur === null ? (
    <span className="text-sm text-stone-400">— vs hier</span>
  ) : (
    <span className={`flex items-center gap-1 text-sm font-semibold ${valeur >= 0 ? 'text-green-600' : 'text-red-600'}`}>
      {valeur >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
      {valeur >= 0 ? '+' : ''}
      {formatNombre(valeur, 1)} % <span className="font-normal text-stone-500">vs hier</span>
    </span>
  );

const Tuile = ({
  teinte, icone, titre, valeur, pied, droite,
}: {
  teinte: string;
  icone: ReactNode;
  titre: string;
  valeur: ReactNode;
  pied: ReactNode;
  droite?: ReactNode;
}) => (
  <div className={`flex items-center justify-between gap-3 rounded-2xl border p-5 shadow-carte ${teinte}`}>
    <div className="flex min-w-0 gap-4">
      <div className="mt-1 flex-shrink-0">{icone}</div>
      <div className="min-w-0">
        <p className="font-medium text-stone-700">{titre}</p>
        <p className="mt-1 truncate text-3xl font-black text-stone-900">{valeur}</p>
        <div className="mt-1">{pied}</div>
      </div>
    </div>
    {droite}
  </div>
);

export const DashboardView = () => {
  const { siteId, sites } = useSite();
  const [donnees, setDonnees] = useState<Donnees | null>(null);

  const charger = useCallback(async () => {
    const maintenant = new Date();
    const hier = debutJour(maintenant, -1);
    const demain = debutJour(maintenant, 1);
    const ilYa24h = new Date(maintenant.getTime() - 24 * 3600_000);
    const filtreVoyages = siteId ? `departure_site_id.eq.${siteId},arrival_site_id.eq.${siteId}` : null;

    let qVehicules = supabase.from('vehicles').select('id, registration, status, site_id');
    let qVoyages = supabase
      .from('trips')
      .select('id, net_weight, load_weight, actual_arrival_time')
      .eq('status', 'completed')
      .gte('actual_arrival_time', hier.toISOString())
      .lt('actual_arrival_time', demain.toISOString());
    let qEnCours = supabase.from('trips').select('vehicle_id').eq('status', 'in_progress');
    let qDerniers = supabase
      .from('trips')
      .select('id, reference, vehicle_id, departure_site_id, arrival_site_id, net_weight, load_weight, status')
      .order('created_at', { ascending: false })
      .limit(5);
    let qCarburant = supabase
      .from('fuel_transactions')
      .select('volume_liters')
      .eq('transaction_type', 'refuel')
      .eq('transaction_date', ymd(maintenant));
    if (siteId) {
      qVehicules = qVehicules.eq('site_id', siteId);
      qCarburant = qCarburant.eq('site_id', siteId);
    }
    if (filtreVoyages) {
      qVoyages = qVoyages.or(filtreVoyages);
      qEnCours = qEnCours.or(filtreVoyages);
      qDerniers = qDerniers.or(filtreVoyages);
    }

    const [rV, rT, rE, rD, rC, rA, rP] = await Promise.all([
      qVehicules,
      qVoyages,
      qEnCours,
      qDerniers,
      qCarburant,
      supabase.from('alerts').select('id, title, message, severity, created_at').eq('status', 'active')
        .order('created_at', { ascending: false }).limit(4),
      supabase.from('vehicle_tracking').select('vehicle_id, latitude, longitude, timestamp, speed')
        .gte('timestamp', ilYa24h.toISOString()).order('timestamp', { ascending: false }).limit(1000),
    ]);

    const carburant = resultat<{ volume_liters: number | null }[]>(rC, 'Carburant');
    setDonnees({
      vehicules: resultat<Vehicule[]>(rV, 'Véhicules'),
      voyages: resultat<Voyage[]>(rT, 'Voyages'),
      enCours: resultat<{ vehicle_id: string | null }[]>(rE, 'Voyages en cours'),
      derniers: resultat<DernierVoyage[]>(rD, 'Derniers voyages'),
      litres: carburant && carburant.length > 0 ? carburant.reduce((s, t) => s + (t.volume_liters ?? 0), 0) : null,
      carburantErreur: carburant === null,
      alertes: resultat<Alerte[]>(rA, 'Alertes'),
      positions: resultat<Position[]>(rP, 'Positions'),
      heure: maintenant,
    });
  }, [siteId]);

  useEffect(() => {
    charger();
    const minuterie = window.setInterval(charger, 60_000);
    return () => window.clearInterval(minuterie);
  }, [charger]);

  const calculs = useMemo(() => {
    if (!donnees) return null;
    const debut = debutJour(donnees.heure).getTime();
    const voyages = donnees.voyages ?? [];
    const duJour = voyages.filter((v) => v.actual_arrival_time && new Date(v.actual_arrival_time).getTime() >= debut);
    const veille = voyages.filter((v) => v.actual_arrival_time && new Date(v.actual_arrival_time).getTime() < debut);
    const enMission = new Set((donnees.enCours ?? []).map((t) => t.vehicle_id).filter((id): id is string => !!id));
    const flotte = repartitionFlotte(donnees.vehicules ?? [], enMission);
    const immat = new Map((donnees.vehicules ?? []).map((v) => [v.id, v.registration]));

    const dernieresPositions = new Map<string, Position>();
    for (const p of donnees.positions ?? []) {
      if (!dernieresPositions.has(p.vehicle_id)) dernieresPositions.set(p.vehicle_id, p);
    }
    const positions: PositionAffichee[] = [];
    let anciennes = 0;
    for (const p of dernieresPositions.values()) {
      if (p.latitude === null || p.longitude === null) continue;
      if (!positionFraiche(p.timestamp, donnees.heure)) {
        anciennes += 1;
        continue;
      }
      const roule = (p.speed ?? 0) > 3;
      positions.push({
        vehiculeId: p.vehicle_id,
        immatriculation: immat.get(p.vehicle_id) ?? 'Véhicule',
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        horodatage: p.timestamp,
        vitesse: p.speed,
        couleur: roule ? '#16a34a' : '#eab308',
      });
    }

    return {
      jour: bilanVoyages(duJour),
      veille: bilanVoyages(veille),
      serie: tonnesParHeure(duJour),
      flotte,
      dispo: disponibilite(flotte),
      positions,
      anciennes,
      enMouvement: positions.filter((p) => p.couleur === '#16a34a').length,
      immat,
    };
  }, [donnees]);

  const nomSite = (id: string | null) => sites.find((s) => s.id === id)?.name ?? '—';

  if (!donnees || !calculs) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
      </div>
    );
  }

  const { jour, veille, flotte } = calculs;
  const litresParTonne = donnees.litres !== null && jour.tonnes > 0 ? donnees.litres / jour.tonnes : null;

  return (
    <div className="space-y-6">
      {/* Bandeau */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#3d1f15] via-[#5e2a16] to-[#b0501d] shadow-carte">
        <img
          src="/images/banniere-tombereau.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-y-0 right-0 h-full w-[46%] object-cover object-left"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 30%)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 30%)' }}
        />
        <div className="relative flex items-center justify-between gap-6 px-8 py-8">
          <div className="border-l-4 border-orange-500 pl-6">
            <h2 className="texte-relief text-3xl font-black text-white">{NOM_PRODUIT} – Centre de Contrôle Opérationnel</h2>
            <p className="mt-2 text-lg text-orange-50/90">Planifier • Affecter • Suivre • Livrer • Analyser</p>
          </div>
          <Embleme className="hidden h-14 w-14 flex-shrink-0 rounded-2xl opacity-90 shadow-xl 2xl:block" />
        </div>
      </section>

      {/* Indicateurs du jour */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Tuile
          teinte="border-orange-100 bg-orange-50/70"
          icone={<Mountain className="h-9 w-9 text-orange-700" />}
          titre="Tonnes livrées (jour)"
          valeur={donnees.voyages === null ? '—' : `${formatNombre(jour.tonnes)} T`}
          pied={<Variation valeur={variation(jour.tonnes, veille.tonnes)} />}
          droite={<Anneau pourcentage={null} legende="du plan" />}
        />
        <Tuile
          teinte="border-blue-100 bg-blue-50/70"
          icone={<Truck className="h-9 w-9 text-blue-600" />}
          titre="Voyages réalisés"
          valeur={donnees.voyages === null ? '—' : formatNombre(jour.voyages)}
          pied={<Variation valeur={variation(jour.voyages, veille.voyages)} />}
        />
        <Tuile
          teinte="border-green-100 bg-green-50/70"
          icone={<Truck className="h-9 w-9 text-green-600" />}
          titre="Véhicules actifs"
          valeur={donnees.vehicules === null ? '—' : `${flotte.enMission + flotte.disponibles} / ${flotte.total}`}
          pied={
            <span className="text-sm text-stone-600">
              Disponibilité : <b className="text-green-700">{calculs.dispo === null ? '—' : `${formatNombre(calculs.dispo, 1)} %`}</b>
            </span>
          }
        />
        <Tuile
          teinte="border-red-100 bg-red-50/70"
          icone={<Fuel className="h-9 w-9 text-red-600" />}
          titre="Consommation carburant"
          valeur={donnees.litres === null ? '—' : `${formatNombre(donnees.litres)} L`}
          pied={
            <span className="text-sm text-stone-600">
              {donnees.litres === null
                ? donnees.carburantErreur ? 'Données indisponibles' : 'Aucune distribution saisie'
                : litresParTonne === null ? '— L/T' : `${formatNombre(litresParTonne, 2)} L/T`}
            </span>
          }
        />
      </div>
      <Provenance
        source="voyages terminés (heure d'arrivée), véhicules, distributions de carburant du jour"
        heure={donnees.heure}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panneau titre="Production & Réalisation" className="xl:col-span-7" action={<span className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700">Aujourd'hui</span>}>
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="h-64 flex-1">
              {calculs.serie.length === 0 ? (
                <SansDonnees detail="Aucun voyage terminé aujourd'hui. Les barres apparaissent dès la première arrivée enregistrée." />
              ) : (
                <BarresProduction serie={calculs.serie} objectifParHeure={null} />
              )}
            </div>
            <div className="flex flex-row gap-3 lg:w-44 lg:flex-col">
              <div className="flex-1 rounded-xl border border-stone-200 p-3">
                <p className="flex items-center gap-1.5 text-xs text-stone-500"><Target className="h-4 w-4 text-orange-600" />Objectif jour</p>
                <p className="mt-1 text-sm font-semibold text-stone-500">Non défini</p>
              </div>
              <div className="flex-1 rounded-xl border border-stone-200 p-3">
                <p className="flex items-center gap-1.5 text-xs text-stone-500"><CheckCircle2 className="h-4 w-4 text-green-600" />Réalisé</p>
                <p className="mt-1 text-xl font-black text-stone-900">{formatNombre(jour.tonnes)} T</p>
              </div>
              <div className="flex-1 rounded-xl border border-stone-200 p-3">
                <p className="text-xs text-stone-500">Écart</p>
                <p className="mt-1 text-sm font-semibold text-stone-500">—</p>
              </div>
            </div>
          </div>
          <Provenance source={`voyages terminés aujourd'hui${jour.voyagesSansPoids ? ` (${jour.voyagesSansPoids} sans poids saisi)` : ''} ; objectif : planification (LOT 03)`} heure={donnees.heure} />
        </Panneau>

        <Panneau titre="Suivi temps réel de la flotte" className="xl:col-span-5">
          <div className="relative h-64 overflow-hidden rounded-xl">
            <CarteFlotte positions={calculs.positions} />
            {calculs.positions.length === 0 && (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[400] rounded-lg bg-white/90 px-3 py-2 text-center text-sm text-stone-600 shadow">
                Aucune position reçue depuis {FRAICHEUR_POSITION_MINUTES} min
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-700">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-600" />En mouvement ({calculs.enMouvement})</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-yellow-500" />À l'arrêt ({calculs.positions.length - calculs.enMouvement})</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-500" />Voyages en cours ({flotte.enMission})</span>
            {calculs.anciennes > 0 && <span className="text-stone-400">{calculs.anciennes} position(s) ancienne(s) non affichée(s)</span>}
          </div>
          <Provenance source={`traceurs GPS, positions de moins de ${FRAICHEUR_POSITION_MINUTES} min`} heure={donnees.heure} />
        </Panneau>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panneau titre="État de la flotte" className="xl:col-span-4">
          {donnees.vehicules === null || flotte.total === 0 ? (
            <SansDonnees detail="Aucun véhicule enregistré pour ce périmètre." />
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <Donut
                total={flotte.total}
                libelleTotal="Véhicules"
                segments={[
                  { libelle: 'En mission', valeur: flotte.enMission, couleur: '#16a34a' },
                  { libelle: 'Disponibles', valeur: flotte.disponibles, couleur: '#2563eb' },
                  { libelle: 'En maintenance', valeur: flotte.maintenance, couleur: '#a8a29e' },
                  { libelle: 'Immobilisés', valeur: flotte.immobilises, couleur: '#dc2626' },
                ]}
              />
              <ul className="w-full space-y-2.5 text-sm">
                {[
                  ['En mission', flotte.enMission, 'bg-green-600'],
                  ['Disponibles', flotte.disponibles, 'bg-blue-600'],
                  ['En maintenance', flotte.maintenance, 'bg-stone-400'],
                  ['Immobilisés', flotte.immobilises, 'bg-red-600'],
                ].map(([libelle, n, couleur]) => (
                  <li key={libelle as string} className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${couleur}`} />
                    <span className="flex-1 text-stone-700">{libelle}</span>
                    <b className="text-stone-900">{n}</b>
                    <span className="w-12 text-right text-stone-500">{formatNombre(((n as number) / flotte.total) * 100)} %</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Provenance source="statut des véhicules et voyages en cours" heure={donnees.heure} />
        </Panneau>

        <Panneau titre="Derniers voyages" className="xl:col-span-5">
          {!donnees.derniers || donnees.derniers.length === 0 ? (
            <SansDonnees detail="Aucun voyage enregistré." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="py-2 font-medium">Voyage</th>
                    <th className="py-2 font-medium">Véhicule</th>
                    <th className="py-2 font-medium">Origine → Destination</th>
                    <th className="py-2 text-right font-medium">Tonnage</th>
                    <th className="py-2 pl-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {donnees.derniers.map((v) => {
                    const statut = STATUT_VOYAGE[v.status] ?? { libelle: v.status, teinte: 'gris' as const };
                    const t = v.net_weight ?? v.load_weight;
                    return (
                      <tr key={v.id} className="border-b border-stone-100 last:border-0">
                        <td className="py-2.5 font-medium text-stone-800">{v.reference ?? '—'}</td>
                        <td className="py-2.5 text-stone-700">{calculs.immat.get(v.vehicle_id ?? '') ?? '—'}</td>
                        <td className="py-2.5 text-stone-700">{nomSite(v.departure_site_id)} → {nomSite(v.arrival_site_id)}</td>
                        <td className="py-2.5 text-right font-semibold text-stone-900">{t === null ? '—' : `${formatNombre(t, 1)} T`}</td>
                        <td className="py-2.5 pl-3"><Puce teinte={statut.teinte}>{statut.libelle}</Puce></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panneau>

        <Panneau titre={`Alertes & Événements${donnees.alertes?.length ? ` (${donnees.alertes.length})` : ''}`} className="xl:col-span-3">
          {!donnees.alertes || donnees.alertes.length === 0 ? (
            <SansDonnees message="Aucune alerte active" detail={donnees.alertes === null ? 'Alertes indisponibles.' : undefined} />
          ) : (
            <ul className="space-y-3">
              {donnees.alertes.map((a) => {
                const critique = a.severity === 'critical';
                const avert = a.severity === 'warning';
                const Icone = critique || avert ? AlertTriangle : Info;
                return (
                  <li key={a.id} className="flex gap-3">
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${critique ? 'bg-red-50 text-red-600' : avert ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600'}`}>
                      <Icone className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-stone-900">{a.title}</p>
                      <p className="truncate text-sm text-stone-500">{a.message}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-stone-400">{ilYa(a.created_at, donnees.heure)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panneau>
      </div>
    </div>
  );
};

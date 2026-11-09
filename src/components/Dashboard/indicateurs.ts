// Calculs du tableau de bord (fonctions pures, testees dans
// indicateurs.test.ts). Aucune valeur par defaut inventee : une donnee
// absente reste absente (null) et l'ecran affiche « sans donnees ».

export interface VoyageTermine {
  net_weight: number | null;
  load_weight: number | null;
  actual_arrival_time: string | null;
}

export interface VehiculeEtat {
  id: string;
  status: string;
}

/** Tonnage d'un voyage : poids net pese, sinon poids de chargement saisi. */
export const tonnageVoyage = (v: Pick<VoyageTermine, 'net_weight' | 'load_weight'>): number | null =>
  v.net_weight ?? v.load_weight ?? null;

export interface Bilan {
  voyages: number;
  tonnes: number;
  voyagesSansPoids: number;
}

export const bilanVoyages = (voyages: VoyageTermine[]): Bilan =>
  voyages.reduce<Bilan>(
    (b, v) => {
      const t = tonnageVoyage(v);
      return {
        voyages: b.voyages + 1,
        tonnes: b.tonnes + (t ?? 0),
        voyagesSansPoids: b.voyagesSansPoids + (t === null ? 1 : 0),
      };
    },
    { voyages: 0, tonnes: 0, voyagesSansPoids: 0 },
  );

/** Variation en % par rapport a la veille ; null si la veille vaut 0. */
export const variation = (aujourdhui: number, veille: number): number | null =>
  veille === 0 ? null : ((aujourdhui - veille) / veille) * 100;

/** Debut (minuit local) du jour decale de `decalage` jours. */
export const debutJour = (reference: Date, decalage = 0): Date => {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + decalage);
  return d;
};

/** Repartition des voyages termines par heure d'arrivee (heure locale). */
export const tonnesParHeure = (voyages: VoyageTermine[]): { heure: number; tonnes: number }[] => {
  const parHeure = new Map<number, number>();
  for (const v of voyages) {
    if (!v.actual_arrival_time) continue;
    const h = new Date(v.actual_arrival_time).getHours();
    parHeure.set(h, (parHeure.get(h) ?? 0) + (tonnageVoyage(v) ?? 0));
  }
  if (parHeure.size === 0) return [];
  const heures = [...parHeure.keys()];
  const debut = Math.min(6, ...heures);
  const fin = Math.max(18, ...heures);
  return Array.from({ length: fin - debut + 1 }, (_, i) => ({
    heure: debut + i,
    tonnes: parHeure.get(debut + i) ?? 0,
  }));
};

export interface RepartitionFlotte {
  enMission: number;
  disponibles: number;
  maintenance: number;
  immobilises: number;
  total: number;
}

/** Etat de la flotte (vehicules vendus exclus). */
export const repartitionFlotte = (vehicules: VehiculeEtat[], enMissionIds: Set<string>): RepartitionFlotte => {
  const r = { enMission: 0, disponibles: 0, maintenance: 0, immobilises: 0, total: 0 };
  for (const v of vehicules) {
    if (v.status === 'sold') continue;
    r.total += 1;
    if (v.status === 'maintenance') r.maintenance += 1;
    else if (v.status === 'immobilized') r.immobilises += 1;
    else if (enMissionIds.has(v.id)) r.enMission += 1;
    else r.disponibles += 1;
  }
  return r;
};

/** Disponibilite = vehicules ni en maintenance ni immobilises / flotte. */
export const disponibilite = (r: RepartitionFlotte): number | null =>
  r.total === 0 ? null : ((r.enMission + r.disponibles) / r.total) * 100;

export const FRAICHEUR_POSITION_MINUTES = 15;

/** Une position plus ancienne que le seuil n'est jamais montree en direct (CDC 15). */
export const positionFraiche = (horodatage: string, maintenant: Date): boolean =>
  maintenant.getTime() - new Date(horodatage).getTime() <= FRAICHEUR_POSITION_MINUTES * 60_000;

export const formatNombre = (n: number, decimales = 0) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

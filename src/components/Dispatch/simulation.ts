// Simulation de scenarios d'affectation (D-066, CDC 11). Calcul explique,
// sans optimisation : chaque scenario repartit des camions entre les
// destinations ; le resultat est derive des rotations observees
// (statistiques_trajets, journal des voyages) et des capacites saisies
// (infrastructures de site, D-047). Rien n'est ecrit en base. Un trajet
// sans assez de mesures n'est pas estime : « donnees insuffisantes ».

export interface StatTrajet {
  arrival_site_id: string;
  jours_observes: number;
  voyages_livres: number;
  charge_moyenne: number | null;
  voyages_pesees: number;
  cycle_moyen_min: number | null;
  cycles_mesures: number;
  rotation_moyenne_min: number | null;
  rotations_mesurees: number;
  rotation_min_observee: number | null;
  rotation_max_observee: number | null;
}

export interface CapaciteSaisie {
  site_id: string;
  type: string;
  code: string;
  capacite: number | null;
  unite_capacite: string | null;
  actif: boolean;
}

export type Horizon = 'shift' | 'jour';
type Grandeur = 'tonnes' | 'voyages';
type Periode = 'heure' | 'shift' | 'jour';

const NUMERATEURS: Record<string, Grandeur> = {
  t: 'tonnes', tonne: 'tonnes', tonnes: 'tonnes',
  voyage: 'voyages', voyages: 'voyages', rotation: 'voyages', rotations: 'voyages', camion: 'voyages', camions: 'voyages',
};
const DENOMINATEURS: Record<string, Periode> = {
  h: 'heure', heure: 'heure', heures: 'heure',
  shift: 'shift', poste: 'shift',
  j: 'jour', jour: 'jour', journee: 'jour',
};

/** Unite de capacite lisible (« t/jour », « voyages/h »...), sinon null. */
export const lireUnite = (unite: string | null): { grandeur: Grandeur; periode: Periode } | null => {
  if (!unite) return null;
  const propre = unite.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '').replace(/^par/, '');
  const [num, den] = propre.split(/\/|par/);
  const grandeur = NUMERATEURS[num ?? ''];
  const periode = DENOMINATEURS[den ?? ''];
  return grandeur && periode ? { grandeur, periode } : null;
};

export interface Plafond { grandeur: Grandeur; valeur: number; sources: string[] }

/**
 * Plafond des capacites d'un type sur un site, ramene a l'horizon :
 * une capacite horaire est multipliee par la duree ; une capacite par
 * shift ou par jour ne vaut que pour l'horizon correspondant. Les
 * capacites dont l'unite n'est pas exploitable sont signalees, pas
 * converties.
 */
export const plafondSite = (
  capacites: CapaciteSaisie[], site: string, type: string, horizon: Horizon, dureeMin: number,
): { plafonds: Plafond[]; ignorees: string[] } => {
  const parGrandeur = new Map<Grandeur, Plafond>();
  const ignorees: string[] = [];
  for (const c of capacites) {
    if (!c.actif || c.site_id !== site || c.type !== type || c.capacite === null) continue;
    const u = lireUnite(c.unite_capacite);
    let valeur: number | null = null;
    if (u?.periode === 'heure') valeur = (c.capacite * dureeMin) / 60;
    else if (u && u.periode === horizon) valeur = c.capacite;
    if (!u || valeur === null) {
      ignorees.push(`${c.code} (${c.capacite} ${c.unite_capacite ?? ''})`.trim());
      continue;
    }
    const p = parGrandeur.get(u.grandeur) ?? { grandeur: u.grandeur, valeur: 0, sources: [] };
    p.valeur += valeur;
    p.sources.push(`${c.code} : ${c.capacite} ${c.unite_capacite}`);
    parGrandeur.set(u.grandeur, p);
  }
  return { plafonds: [...parGrandeur.values()], ignorees };
};

export interface Scenario { nom: string; repartition: Record<string, number> }

export interface LigneResultat {
  destination: string;
  camions: number;
  statut: 'estime' | 'insuffisant' | 'sans_camion';
  rotationMin: number | null;
  mesures: number;
  voyagesParCamion: number | null;
  voyages: number | null;
  charge: number | null;
  tonnes: number | null;
  plafonne: string | null;
  remarques: string[];
}

export interface ResultatScenario {
  nom: string;
  camions: number;
  lignes: LigneResultat[];
  voyages: number | null;
  tonnes: number | null;
  complet: boolean;
  plafonne: string | null;
  remarques: string[];
}

const appliquer = (voyages: number, tonnes: number | null, charge: number | null, plafonds: Plafond[]) => {
  let v = voyages;
  let t = tonnes;
  const sources: string[] = [];
  for (const p of plafonds) {
    if (p.grandeur === 'voyages' && v > p.valeur) {
      v = Math.floor(p.valeur);
      t = charge !== null ? v * charge : t;
      sources.push(...p.sources);
    }
    if (p.grandeur === 'tonnes' && t !== null && t > p.valeur) {
      t = p.valeur;
      sources.push(...p.sources);
    }
  }
  return { voyages: v, tonnes: t, plafonne: sources.length > 0 ? `plafonné par ${sources.join(', ')}` : null };
};

/** Evalue un scenario ; aucune valeur n'est supposee quand une mesure manque. */
export const evaluerScenario = ({
  scenario, stats, capacites, siteChargement, horizon, dureeMin, minMesures,
}: {
  scenario: Scenario;
  stats: StatTrajet[];
  capacites: CapaciteSaisie[];
  siteChargement: string;
  horizon: Horizon;
  dureeMin: number;
  minMesures: number;
}): ResultatScenario => {
  const lignes: LigneResultat[] = [];
  for (const [destination, camions] of Object.entries(scenario.repartition)) {
    const s = stats.find((x) => x.arrival_site_id === destination);
    const remarques: string[] = [];
    const base: LigneResultat = {
      destination, camions, statut: 'insuffisant', rotationMin: s?.rotation_moyenne_min ?? null, mesures: s?.rotations_mesurees ?? 0,
      voyagesParCamion: null, voyages: null, charge: s?.charge_moyenne ?? null, tonnes: null, plafonne: null, remarques,
    };
    if (camions <= 0) { lignes.push({ ...base, statut: 'sans_camion', voyages: 0, tonnes: 0 }); continue; }
    if (!s || s.rotation_moyenne_min === null || s.rotations_mesurees < minMesures) {
      remarques.push(`Données insuffisantes : ${s?.rotations_mesurees ?? 0} rotation(s) mesurée(s), ${minMesures} requise(s)`);
      lignes.push(base);
      continue;
    }
    const parCamion = Math.floor(dureeMin / s.rotation_moyenne_min);
    const voyages = camions * parCamion;
    if (s.charge_moyenne === null) remarques.push('Aucune pesée observée : tonnes non estimées');
    const tonnes = s.charge_moyenne !== null ? voyages * s.charge_moyenne : null;
    const { plafonds, ignorees } = plafondSite(capacites, destination, 'depot_reception', horizon, dureeMin);
    if (ignorees.length > 0) remarques.push(`Capacité non comparable à l'horizon : ${ignorees.join(', ')}`);
    const r = appliquer(voyages, tonnes, s.charge_moyenne, plafonds);
    lignes.push({ ...base, statut: 'estime', voyagesParCamion: parCamion, voyages: r.voyages, tonnes: r.tonnes, plafonne: r.plafonne });
  }

  const complet = lignes.every((l) => l.statut !== 'insuffisant') && lignes.every((l) => l.statut !== 'estime' || l.tonnes !== null);
  const estimees = lignes.filter((l) => l.statut === 'estime');
  let voyages: number | null = lignes.every((l) => l.statut !== 'insuffisant') ? estimees.reduce((a, l) => a + (l.voyages ?? 0), 0) : null;
  let tonnes: number | null = complet ? estimees.reduce((a, l) => a + (l.tonnes ?? 0), 0) : null;
  const remarques: string[] = [];
  let plafonne: string | null = null;
  const chargement = plafondSite(capacites, siteChargement, 'point_chargement', horizon, dureeMin);
  if (chargement.ignorees.length > 0) remarques.push(`Capacité de chargement non comparable à l'horizon : ${chargement.ignorees.join(', ')}`);
  if (voyages !== null) {
    const charges = estimees.filter((l) => l.charge !== null && (l.voyages ?? 0) > 0);
    const chargeMoyenne = charges.length > 0 && voyages > 0
      ? charges.reduce((a, l) => a + (l.charge ?? 0) * (l.voyages ?? 0), 0) / charges.reduce((a, l) => a + (l.voyages ?? 0), 0)
      : null;
    const r = appliquer(voyages, tonnes, complet ? chargeMoyenne : null, chargement.plafonds);
    voyages = r.voyages;
    tonnes = complet ? r.tonnes : null;
    plafonne = r.plafonne;
  }
  if (!complet) remarques.push('Résultat incomplet : au moins un trajet sans mesure suffisante');
  return {
    nom: scenario.nom,
    camions: Object.values(scenario.repartition).reduce((a, n) => a + n, 0),
    lignes, voyages, tonnes, complet, plafonne, remarques,
  };
};

/** Repartition egale de n camions, le reste aux premieres destinations. */
export const repartitionEgale = (destinations: string[], camions: number): Record<string, number> => {
  if (destinations.length === 0) return {};
  const base = Math.floor(camions / destinations.length);
  const reste = camions % destinations.length;
  return Object.fromEntries(destinations.map((d, i) => [d, base + (i < reste ? 1 : 0)]));
};

/**
 * Scenarios proposes : tout vers chacune des deux destinations les plus
 * livrees, puis une repartition egale entre les destinations observees
 * (au plus trois scenarios).
 */
export const scenariosProposes = (stats: StatTrajet[], camions: number, nom: (id: string) => string): Scenario[] => {
  const destinations = [...stats].sort((a, b) => b.voyages_livres - a.voyages_livres).map((s) => s.arrival_site_id);
  const tous = (d: string) => Object.fromEntries(destinations.map((x) => [x, x === d ? camions : 0]));
  const liste: Scenario[] = destinations.slice(0, 2).map((d) => ({ nom: `Toutes les rotations vers ${nom(d)}`, repartition: tous(d) }));
  if (destinations.length > 1) liste.push({ nom: 'Répartition égale', repartition: repartitionEgale(destinations, camions) });
  return liste;
};

/** Duree d'un shift en minutes (traverse minuit si la fin precede le debut). */
export const dureeShift = (debut: string, fin: string): number => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const d = m(debut);
  const f = m(fin);
  return f > d ? f - d : 24 * 60 - d + f;
};

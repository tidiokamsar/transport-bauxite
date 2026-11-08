/**
 * Moteur de decompte horaire de location (D-013,
 * docs/SIGTB_2.0_LOCATION_MODEL.md, section 3).
 *
 * Fonction pure : ni base de donnees, ni horloge, ni valeur par defaut.
 * Memes entrees, meme resultat. Aucune dependance, pour pouvoir etre
 * partage avec une fonction serveur (CDC 35).
 *
 * Regles :
 * - Un parametre absent (`undefined`) rend le decompte non calculable.
 *   `null` signifie « aucun » et doit etre explicite.
 * - Les pourcentages sont exprimes de 0 a 100 (coefficient de categorie)
 *   ou au-dela de 100 (majoration).
 * - Les ajustements journaliers (franchise, arrondi, plafond, minimum) sont
 *   valorises au taux de base, sans majoration.
 * - Le minimum garanti ne s'applique qu'aux jours ou la source de
 *   reference a des segments.
 */

export type Sens = 'preneur' | 'bailleur' | 'interne';
export type ModeArrondi = 'inferieur' | 'superieur' | 'plus_proche';
export type RegleEcart = 'retenir_reference' | 'bloquer';
export type SiControleAbsent = 'ignorer' | 'bloquer';

/** Intervalle de temps horodate d'un materiel, issu d'une source de preuve. */
export interface Segment {
  /** ISO 8601 avec fuseau, par exemple 2026-11-02T06:00:00Z. */
  debut: string;
  fin: string;
  categorie: string;
  source: string;
}

export interface VersionTarif {
  /** AAAA-MM-JJ, en date locale du site. */
  dateEffet: string;
  tauxHoraire: number;
}

export interface PlageMajoration {
  nom: string;
  /** HH:MM, heure locale ; une plage peut passer minuit (20:00 a 06:00). */
  debut: string;
  fin: string;
  /** Pourcentage du taux applique sur la plage, par exemple 125. */
  pourcentage: number;
}

export interface ParametresContrat {
  sens: Sens;
  devise: string;
  decimalesMontant: number;
  /** Decalage de l'heure locale du site par rapport a UTC, en minutes. */
  decalageUtcMinutes: number;
  sourceReference: string;
  sourcesControle: string[];
  toleranceEcartMinutes: number | null;
  regleEcart: RegleEcart | null;
  siControleAbsent: SiControleAbsent | null;
  /** Pourcentage facture par categorie de temps (0 = non facture). */
  coefficientsCategorie: Record<string, number>;
  tarifs: VersionTarif[];
  franchiseJournaliereMinutes: number | null;
  arrondiJournalier: { pasMinutes: number; mode: ModeArrondi } | null;
  plafondJournalierHeures: number | null;
  minimumJournalierHeures: number | null;
  minimumSiDisponibleSeulement: boolean | null;
  /** Categories qui rendent le materiel indisponible pour la journee. */
  categoriesIndisponibilite: string[];
  majorations: PlageMajoration[];
}

export interface Periode {
  /** AAAA-MM-JJ inclus, en date locale du site. */
  du: string;
  au: string;
}

export interface LigneTemps {
  categorie: string;
  majoration: string | null;
  minutes: number;
  pourcentageCategorie: number;
  pourcentageMajoration: number;
  heures: number;
  montant: number;
}

export interface Ajustement {
  motif: 'franchise' | 'arrondi' | 'plafond' | 'minimum';
  heures: number;
  montant: number;
}

export interface Comparaison {
  source: string;
  minutesReference: number;
  minutesControle: number | null;
  statut: 'conforme' | 'hors_tolerance' | 'controle_absent';
}

export interface Jour {
  jour: string;
  tauxHoraire: number;
  lignes: LigneTemps[];
  ajustements: Ajustement[];
  comparaisons: Comparaison[];
  heuresFacturees: number;
  montant: number;
  aValider: boolean;
}

export type ResultatDecompte =
  | { statut: 'non_calculable'; motifs: string[] }
  | {
      statut: 'brouillon';
      nature: 'cout' | 'revenu' | 'cout_interne';
      devise: string;
      jours: Jour[];
      joursAValider: string[];
      /** Somme des jours qui ne sont pas a valider. */
      total: number;
    };

const MINUTES_PAR_JOUR = 1440;
const MS_PAR_MINUTE = 60_000;

const CLES_OBLIGATOIRES: (keyof ParametresContrat)[] = [
  'sens', 'devise', 'decimalesMontant', 'decalageUtcMinutes', 'sourceReference',
  'sourcesControle', 'toleranceEcartMinutes', 'regleEcart', 'siControleAbsent',
  'coefficientsCategorie', 'tarifs', 'franchiseJournaliereMinutes',
  'arrondiJournalier', 'plafondJournalierHeures', 'minimumJournalierHeures',
  'minimumSiDisponibleSeulement', 'categoriesIndisponibilite', 'majorations',
];

const estDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

const minuteDuJour = (hhmm: string): number | null => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const arrondirMontant = (valeur: number, decimales: number) => {
  const f = 10 ** decimales;
  return Math.round((valeur + Number.EPSILON) * f) / f;
};

/** Intervalles [debut, fin[ en minutes du jour local couverts par une plage. */
const intervallesPlage = (p: PlageMajoration): [number, number][] => {
  const d = minuteDuJour(p.debut) as number;
  const f = minuteDuJour(p.fin) as number;
  return d < f ? [[d, f]] : [[d, MINUTES_PAR_JOUR], [0, f]];
};

function validerParametres(p: Partial<ParametresContrat>): string[] {
  const motifs: string[] = [];
  for (const cle of CLES_OBLIGATOIRES) {
    if (p[cle] === undefined) motifs.push(`parametre manquant : ${cle}`);
  }
  if (motifs.length > 0) return motifs;
  const c = p as ParametresContrat;

  if (!Number.isInteger(c.decimalesMontant) || c.decimalesMontant < 0 || c.decimalesMontant > 4) {
    motifs.push('decimalesMontant doit etre un entier de 0 a 4');
  }
  if (c.sourcesControle.includes(c.sourceReference)) {
    motifs.push('la source de reference ne peut pas etre une source de controle');
  }
  if (c.sourcesControle.length > 0) {
    if (c.toleranceEcartMinutes === null || c.toleranceEcartMinutes < 0) {
      motifs.push('toleranceEcartMinutes requise (>= 0) avec des sources de controle');
    }
    if (c.regleEcart === null) motifs.push('regleEcart requise avec des sources de controle');
    if (c.siControleAbsent === null) motifs.push('siControleAbsent requis avec des sources de controle');
  }
  for (const [categorie, pct] of Object.entries(c.coefficientsCategorie)) {
    if (!(pct >= 0 && pct <= 100)) motifs.push(`coefficient hors de 0 a 100 pour ${categorie}`);
  }
  if (c.tarifs.length === 0) motifs.push('aucun tarif');
  const dates = new Set<string>();
  for (const t of c.tarifs) {
    if (!estDate(t.dateEffet)) motifs.push(`date d'effet invalide : ${t.dateEffet}`);
    if (dates.has(t.dateEffet)) motifs.push(`deux tarifs a la meme date : ${t.dateEffet}`);
    dates.add(t.dateEffet);
    if (!(t.tauxHoraire >= 0)) motifs.push(`taux horaire invalide au ${t.dateEffet}`);
  }
  if (c.franchiseJournaliereMinutes !== null && !(c.franchiseJournaliereMinutes >= 0)) {
    motifs.push('franchiseJournaliereMinutes invalide');
  }
  if (c.arrondiJournalier !== null && !(c.arrondiJournalier.pasMinutes > 0)) {
    motifs.push('pas d\'arrondi invalide');
  }
  if (c.plafondJournalierHeures !== null && !(c.plafondJournalierHeures >= 0)) {
    motifs.push('plafondJournalierHeures invalide');
  }
  if (c.minimumJournalierHeures !== null) {
    if (!(c.minimumJournalierHeures >= 0)) motifs.push('minimumJournalierHeures invalide');
    if (c.minimumSiDisponibleSeulement === null) {
      motifs.push('minimumSiDisponibleSeulement requis avec un minimum');
    }
  }
  if (
    c.minimumJournalierHeures !== null && c.plafondJournalierHeures !== null
    && c.minimumJournalierHeures > c.plafondJournalierHeures
  ) {
    motifs.push('le minimum depasse le plafond');
  }
  const couverts: [number, number][] = [];
  for (const m of c.majorations) {
    if (minuteDuJour(m.debut) === null || minuteDuJour(m.fin) === null || m.debut === m.fin) {
      motifs.push(`plage de majoration invalide : ${m.nom}`);
      continue;
    }
    if (!(m.pourcentage >= 0)) motifs.push(`pourcentage de majoration invalide : ${m.nom}`);
    for (const [d, f] of intervallesPlage(m)) {
      if (couverts.some(([cd, cf]) => d < cf && cd < f)) {
        motifs.push(`plages de majoration qui se chevauchent : ${m.nom}`);
      }
      couverts.push([d, f]);
    }
  }
  return motifs;
}

interface Morceau {
  jour: string;
  /** Minutes du jour local, [debut, fin[. */
  debut: number;
  fin: number;
}

/** Decoupe un intervalle UTC en morceaux par jour local. */
function decouperParJour(debutMs: number, finMs: number, decalage: number): Morceau[] {
  const morceaux: Morceau[] = [];
  let curseur = debutMs / MS_PAR_MINUTE + decalage;
  const fin = finMs / MS_PAR_MINUTE + decalage;
  while (curseur < fin) {
    const minuitMinutes = Math.floor(curseur / MINUTES_PAR_JOUR) * MINUTES_PAR_JOUR;
    const limite = Math.min(fin, minuitMinutes + MINUTES_PAR_JOUR);
    morceaux.push({
      jour: new Date(minuitMinutes * MS_PAR_MINUTE).toISOString().slice(0, 10),
      debut: curseur - minuitMinutes,
      fin: limite - minuitMinutes,
    });
    curseur = limite;
  }
  return morceaux;
}

interface SegmentLu {
  debutMs: number;
  finMs: number;
  categorie: string;
  source: string;
}

function lireSegments(segments: Segment[], c: ParametresContrat): { lus: SegmentLu[]; motifs: string[] } {
  const motifs: string[] = [];
  const lus: SegmentLu[] = [];
  const sourcesConnues = new Set([c.sourceReference, ...c.sourcesControle]);
  segments.forEach((s, i) => {
    const debutMs = Date.parse(s.debut);
    const finMs = Date.parse(s.fin);
    if (Number.isNaN(debutMs) || Number.isNaN(finMs) || finMs <= debutMs) {
      motifs.push(`segment ${i} : horodatage invalide`);
      return;
    }
    if (!sourcesConnues.has(s.source)) {
      motifs.push(`segment ${i} : source non prevue au contrat (${s.source})`);
      return;
    }
    if (
      s.source === c.sourceReference
      && !Object.prototype.hasOwnProperty.call(c.coefficientsCategorie, s.categorie)
    ) {
      motifs.push(`segment ${i} : categorie sans coefficient au contrat (${s.categorie})`);
      return;
    }
    lus.push({ debutMs, finMs, categorie: s.categorie, source: s.source });
  });
  for (const source of sourcesConnues) {
    const tries = lus.filter((s) => s.source === source).sort((a, b) => a.debutMs - b.debutMs);
    for (let i = 1; i < tries.length; i++) {
      if (tries[i].debutMs < tries[i - 1].finMs) {
        motifs.push(`segments qui se chevauchent pour la source ${source}`);
        break;
      }
    }
  }
  return { lus, motifs };
}

const tarifDuJour = (tarifs: VersionTarif[], jour: string): VersionTarif | undefined =>
  [...tarifs]
    .filter((t) => t.dateEffet <= jour)
    .sort((a, b) => (a.dateEffet < b.dateEffet ? 1 : -1))[0];

export function calculerDecompte(
  parametres: Partial<ParametresContrat>,
  segments: Segment[],
  periode: Periode,
): ResultatDecompte {
  const motifs = validerParametres(parametres);
  if (!estDate(periode.du) || !estDate(periode.au) || periode.du > periode.au) {
    motifs.push('periode invalide');
  }
  if (motifs.length > 0) return { statut: 'non_calculable', motifs };
  const c = parametres as ParametresContrat;

  const { lus, motifs: motifsSegments } = lireSegments(segments, c);
  if (motifsSegments.length > 0) return { statut: 'non_calculable', motifs: motifsSegments };

  const dansPeriode = (jour: string) => jour >= periode.du && jour <= periode.au;
  const plages = c.majorations.flatMap((m) =>
    intervallesPlage(m).map(([d, f]) => ({ nom: m.nom, pourcentage: m.pourcentage, d, f })));

  // Minutes brutes par jour et par source, et morceaux de la reference.
  const minutesParSource = new Map<string, Map<string, number>>();
  const morceauxReference: (Morceau & { categorie: string })[] = [];
  for (const s of lus) {
    for (const m of decouperParJour(s.debutMs, s.finMs, c.decalageUtcMinutes)) {
      if (!dansPeriode(m.jour)) continue;
      const parJour = minutesParSource.get(s.source) ?? new Map<string, number>();
      parJour.set(m.jour, (parJour.get(m.jour) ?? 0) + (m.fin - m.debut));
      minutesParSource.set(s.source, parJour);
      if (s.source === c.sourceReference) morceauxReference.push({ ...m, categorie: s.categorie });
    }
  }

  const joursConcernes = [...new Set(
    [...minutesParSource.values()].flatMap((parJour) => [...parJour.keys()]),
  )].sort();

  const sansTarif = joursConcernes.filter((j) => tarifDuJour(c.tarifs, j) === undefined);
  if (sansTarif.length > 0) {
    return { statut: 'non_calculable', motifs: sansTarif.map((j) => `aucun tarif en vigueur le ${j}`) };
  }

  const jours: Jour[] = joursConcernes.map((jour) => {
    const taux = (tarifDuJour(c.tarifs, jour) as VersionTarif).tauxHoraire;
    const valoriser = (heures: number) => arrondirMontant(heures * taux, c.decimalesMontant);

    // Lignes par categorie et plage de majoration.
    const cumul = new Map<string, { categorie: string; majoration: string | null; pctMaj: number; minutes: number }>();
    const ajouter = (categorie: string, majoration: string | null, pctMaj: number, minutes: number) => {
      if (minutes <= 0) return;
      const cle = `${categorie}|${majoration ?? ''}`;
      const ligne = cumul.get(cle) ?? { categorie, majoration, pctMaj, minutes: 0 };
      ligne.minutes += minutes;
      cumul.set(cle, ligne);
    };
    const morceauxDuJour = morceauxReference.filter((m) => m.jour === jour);
    for (const m of morceauxDuJour) {
      let horsPlage = m.fin - m.debut;
      for (const p of plages) {
        const recouvrement = Math.min(m.fin, p.f) - Math.max(m.debut, p.d);
        if (recouvrement > 0) {
          ajouter(m.categorie, p.nom, p.pourcentage, recouvrement);
          horsPlage -= recouvrement;
        }
      }
      ajouter(m.categorie, null, 100, horsPlage);
    }
    const lignes: LigneTemps[] = [...cumul.values()]
      .sort((a, b) => a.categorie.localeCompare(b.categorie) || (a.majoration ?? '').localeCompare(b.majoration ?? ''))
      .map((l) => {
        const pctCat = c.coefficientsCategorie[l.categorie];
        const heures = (l.minutes * pctCat) / 100 / 60;
        return {
          categorie: l.categorie,
          majoration: l.majoration,
          minutes: l.minutes,
          pourcentageCategorie: pctCat,
          pourcentageMajoration: l.pctMaj,
          heures,
          montant: arrondirMontant(heures * taux * (l.pctMaj / 100), c.decimalesMontant),
        };
      });

    // Ajustements journaliers, dans l'ordre de la specification.
    const ajustements: Ajustement[] = [];
    let heures = lignes.reduce((s, l) => s + l.heures, 0);
    const ajuster = (motif: Ajustement['motif'], nouvellesHeures: number) => {
      const delta = nouvellesHeures - heures;
      if (Math.abs(delta) < 1e-9) return;
      ajustements.push({ motif, heures: delta, montant: valoriser(delta) });
      heures = nouvellesHeures;
    };
    if (c.franchiseJournaliereMinutes !== null) {
      ajuster('franchise', Math.max(0, heures - c.franchiseJournaliereMinutes / 60));
    }
    if (c.arrondiJournalier !== null) {
      const { pasMinutes, mode } = c.arrondiJournalier;
      const pas = heures * 60 / pasMinutes;
      const n = mode === 'inferieur' ? Math.floor(pas + 1e-9)
        : mode === 'superieur' ? Math.ceil(pas - 1e-9) : Math.round(pas);
      ajuster('arrondi', (n * pasMinutes) / 60);
    }
    if (c.plafondJournalierHeures !== null && heures > c.plafondJournalierHeures) {
      ajuster('plafond', c.plafondJournalierHeures);
    }
    const indisponible = morceauxDuJour.some((m) => c.categoriesIndisponibilite.includes(m.categorie));
    if (
      c.minimumJournalierHeures !== null
      && morceauxDuJour.length > 0
      && heures < c.minimumJournalierHeures
      && !(c.minimumSiDisponibleSeulement && indisponible)
    ) {
      ajuster('minimum', c.minimumJournalierHeures);
    }

    // Rapprochement avec les sources de controle.
    const minutesReference = minutesParSource.get(c.sourceReference)?.get(jour) ?? 0;
    let aValider = false;
    const comparaisons: Comparaison[] = c.sourcesControle.map((source) => {
      const minutesControle = minutesParSource.get(source)?.get(jour);
      if (minutesControle === undefined) {
        if (c.siControleAbsent === 'bloquer') aValider = true;
        return { source, minutesReference, minutesControle: null, statut: 'controle_absent' };
      }
      const horsTolerance = Math.abs(minutesControle - minutesReference) > (c.toleranceEcartMinutes as number);
      if (horsTolerance && c.regleEcart === 'bloquer') aValider = true;
      return { source, minutesReference, minutesControle, statut: horsTolerance ? 'hors_tolerance' : 'conforme' };
    });

    const montant = arrondirMontant(
      lignes.reduce((s, l) => s + l.montant, 0) + ajustements.reduce((s, a) => s + a.montant, 0),
      c.decimalesMontant,
    );
    return { jour, tauxHoraire: taux, lignes, ajustements, comparaisons, heuresFacturees: heures, montant, aValider };
  });

  const nature = c.sens === 'preneur' ? 'cout' : c.sens === 'bailleur' ? 'revenu' : 'cout_interne';
  return {
    statut: 'brouillon',
    nature,
    devise: c.devise,
    jours,
    joursAValider: jours.filter((j) => j.aValider).map((j) => j.jour),
    total: arrondirMontant(
      jours.filter((j) => !j.aValider).reduce((s, j) => s + j.montant, 0),
      c.decimalesMontant,
    ),
  };
}

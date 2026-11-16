import type { TeintePuce } from '../ui/Panneau';

// Indicateurs de pilotage (D-057, D-068) : types partages, comparaison de
// deux periodes et lignes d'export. Fonctions pures, testees dans
// pilotage.test.ts. Aucune valeur n'est estimee : un ecart n'est calcule que
// si les deux valeurs existent.

export type Fiabilite = 'mesure' | 'partielle' | 'sans_donnees';

export interface Indicateur {
  domaine: string; code: string; libelle: string; valeur: number | null; unite: string; source: string;
  fiabilite: Fiabilite; detail: string | null; periode_debut: string; periode_fin: string; calcule_le: string;
  nature?: 'periode' | 'instantane';
}

export const FIABILITE: Record<Fiabilite, { texte: string; teinte: TeintePuce }> = {
  mesure: { texte: 'Mesuré', teinte: 'vert' },
  partielle: { texte: 'Partiel', teinte: 'orange' },
  sans_donnees: { texte: 'Sans données', teinte: 'gris' },
};

export type Prudence = 'comparable' | 'prudence' | 'non_comparable';

export interface LigneComparaison {
  domaine: string; code: string; libelle: string; unite: string; source: string;
  a: Indicateur | null; b: Indicateur | null;
  ecart: number | null; ecartPct: number | null;
  prudence: Prudence; motifs: string[];
}

/** Jour ISO (AAAA-MM-JJ) en heure locale. */
export const jourIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const joursPeriode = (debut: string, fin: string) =>
  Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * Met deux series d'indicateurs cote a cote (A = periode de reference,
 * B = periode comparee). Ecart = B - A. Prudence quand une valeur est
 * partielle, qu'une periode n'est pas terminee ou que les durees different ;
 * non comparable quand une valeur manque ou que l'indicateur est un
 * instantane (identique pour les deux periodes).
 */
export const comparerIndicateurs = (a: Indicateur[], b: Indicateur[], aujourdhui: string): LigneComparaison[] => {
  const parCodeB = new Map(b.map((i) => [i.code, i]));
  const codes = [...a.map((i) => i.code), ...b.filter((i) => !a.some((x) => x.code === i.code)).map((i) => i.code)];
  const parCodeA = new Map(a.map((i) => [i.code, i]));
  return codes.map((code) => {
    const ia = parCodeA.get(code) ?? null;
    const ib = parCodeB.get(code) ?? null;
    const ref = (ia ?? ib)!;
    const motifs: string[] = [];
    let prudence: Prudence = 'comparable';
    const durcir = (p: Prudence) => { if (p === 'non_comparable' || prudence === 'comparable') prudence = p; };
    if (ref.nature === 'instantane') { durcir('non_comparable'); motifs.push('Valeur à l\'heure du calcul, identique pour les deux périodes'); }
    if (!ia || !ib || ia.valeur === null || ib.valeur === null) { durcir('non_comparable'); motifs.push('Sans données sur au moins une période'); }
    if (ia?.fiabilite === 'partielle' || ib?.fiabilite === 'partielle') { durcir('prudence'); motifs.push('Valeur partielle'); }
    for (const [nom, i] of [['A', ia], ['B', ib]] as const) {
      if (i && i.periode_fin >= aujourdhui) { durcir('prudence'); motifs.push(`Période ${nom} non terminée`); }
    }
    if (ia && ib && joursPeriode(ia.periode_debut, ia.periode_fin) !== joursPeriode(ib.periode_debut, ib.periode_fin)) {
      durcir('prudence'); motifs.push('Durées de période différentes');
    }
    const calculable = ia?.valeur != null && ib?.valeur != null && ref.nature !== 'instantane';
    const ecart = calculable ? Math.round((ib!.valeur! - ia!.valeur!) * 1000) / 1000 : null;
    const ecartPct = calculable && ia!.valeur !== 0 ? Math.round(((ib!.valeur! - ia!.valeur!) / Math.abs(ia!.valeur!)) * 1000) / 10 : null;
    return { domaine: ref.domaine, code, libelle: ref.libelle, unite: ref.unite, source: ref.source, a: ia, b: ib, ecart, ecartPct, prudence, motifs };
  });
};

/** Lignes d'export ou d'impression d'une serie d'indicateurs (source, periode, fiabilite, heure). */
export const lignesExport = (indicateurs: Indicateur[]) => indicateurs.map((i) => ({
  domaine: i.domaine, indicateur: i.libelle, valeur: i.valeur ?? 'Sans données', unite: i.unite, fiabilite: FIABILITE[i.fiabilite].texte,
  source: i.source, detail: i.detail ?? '', periode: `${i.periode_debut} au ${i.periode_fin}`, calcule_le: i.calcule_le,
}));

export const lignesExportComparaison = (lignes: LigneComparaison[]) => lignes.map((l) => ({
  domaine: l.domaine, indicateur: l.libelle, unite: l.unite,
  periode_a: l.a ? `${l.a.periode_debut} au ${l.a.periode_fin}` : '', valeur_a: l.a?.valeur ?? 'Sans données', fiabilite_a: l.a ? FIABILITE[l.a.fiabilite].texte : '',
  periode_b: l.b ? `${l.b.periode_debut} au ${l.b.periode_fin}` : '', valeur_b: l.b?.valeur ?? 'Sans données', fiabilite_b: l.b ? FIABILITE[l.b.fiabilite].texte : '',
  ecart: l.ecart ?? '', ecart_pct: l.ecartPct ?? '', prudence: PRUDENCE[l.prudence].texte, motifs: l.motifs.join(' ; '), source: l.source,
  calcule_le: l.b?.calcule_le ?? l.a?.calcule_le ?? '',
}));

export const PRUDENCE: Record<Prudence, { texte: string; teinte: TeintePuce }> = {
  comparable: { texte: 'Comparable', teinte: 'vert' },
  prudence: { texte: 'À interpréter avec prudence', teinte: 'orange' },
  non_comparable: { texte: 'Non comparable', teinte: 'gris' },
};

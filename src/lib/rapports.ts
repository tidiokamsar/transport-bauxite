// Rapports standard (D-058) : logique pure de l'ecran Rapports et de
// l'ecran Couts. Les valeurs viennent des fonctions serveur ; ici on ne
// calcule que des bornes de periode, des regroupements et des libelles.
// Une valeur absente reste absente : jamais remplacee par 0.

export type TypeRapport = 'journalier' | 'shift' | 'mensuel' | 'loueur' | 'client';

export interface LigneRapport {
  rang: number;
  section: string;
  indicateur: string;
  valeur: number | null;
  unite: string | null;
  manquants: number | null;
  source: string | null;
  remarque: string | null;
}

export const RAPPORTS: Record<TypeRapport, { libelle: string; description: string; fonction: string }> = {
  journalier: { libelle: 'Rapport journalier', description: 'Production, voyages, tonnes, carburant, incidents et immobilisations d\'un jour', fonction: 'rapport_journalier' },
  shift: { libelle: 'Rapport de shift', description: 'Bilan figé du poste, équipe, événements et voyages du shift', fonction: 'rapport_shift' },
  mensuel: { libelle: 'Rapport mensuel', description: 'Indicateurs du mois et tableau jour par jour', fonction: 'rapport_mensuel' },
  loueur: { libelle: 'Rapport loueur (Neemba)', description: 'Heures pointées, immobilisations, interventions et factures contrôlées', fonction: 'rapport_loueur' },
  client: { libelle: 'Rapport client (CBG)', description: 'Tonnes livrées et acceptées, tickets, relevés et écarts, factures émises', fonction: 'rapport_client' },
};

const deuxChiffres = (n: number) => String(n).padStart(2, '0');
const isoJour = (a: number, m: number, j: number) => `${a}-${deuxChiffres(m)}-${deuxChiffres(j)}`;

/** Premier et dernier jour d'un mois « AAAA-MM ». */
export const bornesMois = (mois: string): { debut: string; fin: string } | null => {
  const m = /^(\d{4})-(\d{2})$/.exec(mois);
  if (!m) return null;
  const annee = Number(m[1]);
  const numero = Number(m[2]);
  if (numero < 1 || numero > 12) return null;
  const dernier = new Date(Date.UTC(annee, numero, 0)).getUTCDate();
  return { debut: isoJour(annee, numero, 1), fin: isoJour(annee, numero, dernier) };
};

/** Periode valide : deux dates AAAA-MM-JJ, debut <= fin. */
export const periodeValide = (debut: string, fin: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(debut) && /^\d{4}-\d{2}-\d{2}$/.test(fin) && debut <= fin;

/** Arguments de la fonction serveur du rapport, ou null si incomplets. */
export const argumentsRapport = (
  type: TypeRapport,
  p: { jour: string; mois: string; debut: string; fin: string; site: string; poste: string },
): Record<string, string | null> | null => {
  const site = p.site || null;
  switch (type) {
    case 'journalier':
      return /^\d{4}-\d{2}-\d{2}$/.test(p.jour) ? { p_date: p.jour, p_site: site } : null;
    case 'mensuel': {
      const b = bornesMois(p.mois);
      return b ? { p_mois: b.debut, p_site: site } : null;
    }
    case 'shift':
      return p.poste ? { p_poste: p.poste } : null;
    case 'loueur':
    case 'client':
      return periodeValide(p.debut, p.fin) ? { p_debut: p.debut, p_fin: p.fin, p_site: site } : null;
  }
};

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/** Valeur affichable : nombre et unite, ou la remarque du serveur. */
export const texteValeur = (l: LigneRapport): string => {
  if (l.valeur === null || l.valeur === undefined) return l.remarque ?? 'Sans données';
  const v = nombre.format(Number(l.valeur));
  return l.unite ? `${v} ${l.unite}` : v;
};

/** Rapport sans aucune donnee : aucune valeur renseignee et non nulle. */
export const rapportVide = (lignes: LigneRapport[] | null) =>
  !lignes || lignes.every((l) => l.valeur === null || Number(l.valeur) === 0);

/** Lignes regroupees par section, dans l'ordre des rangs. */
export const grouperParSection = (lignes: LigneRapport[]) => {
  const sections: { section: string; lignes: LigneRapport[] }[] = [];
  for (const l of [...lignes].sort((a, b) => a.rang - b.rang)) {
    const derniere = sections[sections.length - 1];
    if (derniere && derniere.section === l.section) derniere.lignes.push(l);
    else sections.push({ section: l.section, lignes: [l] });
  }
  return sections;
};

/** Lignes pour l'export CSV et l'impression (valeur brute, vide si absente). */
export const lignesExport = (lignes: LigneRapport[]) =>
  [...lignes].sort((a, b) => a.rang - b.rang).map((l) => ({
    Section: l.section,
    Indicateur: l.indicateur,
    Valeur: l.valeur === null || l.valeur === undefined ? '' : Number(l.valeur),
    Unité: l.unite ?? '',
    'Sans mesure': l.manquants ?? '',
    Remarque: l.remarque ?? '',
    Source: l.source ?? '',
  }));

const dateFr = (iso: string) => iso.split('-').reverse().join('/');

/** Titre du rapport pour l'ecran, l'impression et le nom de fichier. */
export const titreRapport = (
  type: TypeRapport,
  p: { jour: string; mois: string; debut: string; fin: string; site?: string | null; poste?: string | null },
) => {
  const lieu = p.site ? ` · ${p.site}` : ' · tous les sites du périmètre';
  switch (type) {
    case 'journalier': return `${RAPPORTS.journalier.libelle} du ${dateFr(p.jour)}${lieu}`;
    case 'mensuel': return `${RAPPORTS.mensuel.libelle} ${p.mois.split('-').reverse().join('/')}${lieu}`;
    case 'shift': return `${RAPPORTS.shift.libelle}${p.poste ? ` · ${p.poste}` : ''}`;
    default: return `${RAPPORTS[type].libelle} du ${dateFr(p.debut)} au ${dateFr(p.fin)}${lieu}`;
  }
};

/** Nom de fichier sans accent ni espace. */
export const nomFichier = (titre: string) =>
  titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export interface Cout { amount: number; devise: string | null; statut: string; categorie: string | null }

/** Totaux des couts non annules, par devise (jamais additionnes entre devises). */
export const totauxParDevise = (couts: Cout[]) => {
  const totaux = new Map<string, { montant: number; nombre: number }>();
  for (const c of couts) {
    if (c.statut !== 'enregistre') continue;
    const cle = c.devise ?? 'Devise non renseignée';
    const t = totaux.get(cle) ?? { montant: 0, nombre: 0 };
    t.montant += Number(c.amount);
    t.nombre += 1;
    totaux.set(cle, t);
  }
  return [...totaux.entries()].map(([devise, t]) => ({ devise, ...t })).sort((a, b) => a.devise.localeCompare(b.devise));
};

/** Repartition par categorie et devise des couts non annules. */
export const repartitionParCategorie = (couts: Cout[]) => {
  const parts = new Map<string, { categorie: string; devise: string; montant: number }>();
  for (const c of couts) {
    if (c.statut !== 'enregistre') continue;
    const categorie = c.categorie ?? 'Sans catégorie';
    const devise = c.devise ?? 'Devise non renseignée';
    const cle = `${categorie}|${devise}`;
    const p = parts.get(cle) ?? { categorie, devise, montant: 0 };
    p.montant += Number(c.amount);
    parts.set(cle, p);
  }
  return [...parts.values()].sort((a, b) => a.devise.localeCompare(b.devise) || b.montant - a.montant);
};

/** Saisie d'une depense complete : date non future, montant positif, devise ISO. */
export const depenseValide = (d: { date: string; description: string; montant: string; devise: string }, aujourdhui: string) => {
  const montant = Number(d.montant.replace(',', '.'));
  return /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date <= aujourdhui && d.description.trim() !== ''
    && Number.isFinite(montant) && montant > 0 && /^[A-Z]{3}$/.test(d.devise);
};

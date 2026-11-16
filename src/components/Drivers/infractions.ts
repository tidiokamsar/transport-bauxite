// Registre des infractions des chauffeurs (D-066) : memes listes fermees
// que les contraintes serveur (migration 20261121100000).

export const TYPES_INFRACTION: Record<string, string> = {
  exces_vitesse: 'Excès de vitesse',
  conduite_dangereuse: 'Conduite dangereuse',
  signalisation: 'Non-respect de la signalisation',
  telephone: 'Téléphone au volant',
  ceinture: 'Ceinture non bouclée',
  alcool_stupefiants: 'Alcool ou stupéfiants',
  surcharge: 'Surcharge',
  temps_conduite: 'Temps de conduite ou de repos',
  itineraire: 'Itinéraire non autorisé',
  stationnement: 'Arrêt ou stationnement interdit',
  documents: 'Documents absents ou invalides',
  comportement: 'Comportement',
  autre: 'Autre',
};

export const SOURCES_INFRACTION: Record<string, string> = {
  constat_interne: 'Constat interne',
  controle_routier: 'Contrôle routier',
  client: 'Signalement client',
  gps: 'Données GPS',
  video: 'Vidéo',
  autre: 'Autre',
};

export const SANCTIONS: Record<string, string> = {
  aucune: 'Aucune sanction (classement motivé)',
  avertissement: 'Avertissement',
  blame: 'Blâme',
  formation: 'Formation obligatoire',
  mise_a_pied: 'Mise à pied',
  retrait_conduite: 'Retrait de la conduite',
  autre: 'Autre (à préciser)',
};

export interface Infraction {
  id: string; numero: string; driver_id: string; type: string; survenue_le: string; lieu: string | null;
  trip_id: string | null; vehicle_id: string | null; constat: string; source: string; reference_source: string | null;
  statut: 'enregistree' | 'annulee'; motif_annulation: string | null; declare_le: string;
}
export interface Sanction {
  id: string; infraction_id: string; sanction: string; detail: string | null; motif: string; decide_le: string;
  statut: 'active' | 'annulee'; motif_annulation: string | null;
}

/** Decision en vigueur d'une infraction (au plus une active), sinon null. */
export const sanctionEnVigueur = (sanctions: Sanction[], infraction: string) =>
  sanctions.find((s) => s.infraction_id === infraction && s.statut === 'active') ?? null;

/** Pret a enregistrer : memes controles que enregistrer_infraction. */
export const infractionValide = (c: { type?: string; source?: string; constat?: string; quand?: string }, maintenant = new Date()) =>
  Boolean(c.type && TYPES_INFRACTION[c.type] && c.source && SOURCES_INFRACTION[c.source] && c.constat?.trim()
    && c.quand && new Date(c.quand).getTime() <= maintenant.getTime() + 5 * 60_000);

/** Sanctions qui ecartent un chauffeur de la conduite (avertissement, jamais blocage). */
export const SANCTIONS_CONDUITE = ['retrait_conduite', 'mise_a_pied'];
export interface SanctionConduite { driver_id: string; sanction: string; numero: string }

/** Selection PostgREST des sanctions de conduite en vigueur, avec l'infraction. */
export const SELECTION_SANCTIONS_CONDUITE = 'sanction, infractions_chauffeur!inner(driver_id, numero, statut)';

/** Lignes de sanctions_infraction (infraction embarquee) regroupees par chauffeur. */
export const sanctionsConduiteParChauffeur = (lignes: unknown[]): Map<string, SanctionConduite[]> => {
  const parChauffeur = new Map<string, SanctionConduite[]>();
  for (const l of lignes as { sanction: string; infractions_chauffeur: unknown }[]) {
    const brut = Array.isArray(l.infractions_chauffeur) ? l.infractions_chauffeur[0] : l.infractions_chauffeur;
    const i = brut as { driver_id?: string; numero?: string; statut?: string } | null | undefined;
    if (!i?.driver_id || i.statut === 'annulee' || !SANCTIONS_CONDUITE.includes(l.sanction)) continue;
    const liste = parChauffeur.get(i.driver_id) ?? [];
    liste.push({ driver_id: i.driver_id, sanction: l.sanction, numero: i.numero ?? 'sans numéro' });
    parChauffeur.set(i.driver_id, liste);
  }
  return parChauffeur;
};

/** Avertissement non bloquant : le dispatcher decide (le systeme recommande). */
export const avertissementSanction = (nom: string, sanctions: SanctionConduite[] | undefined): string | null =>
  sanctions && sanctions.length > 0
    ? `Avertissement : ${nom} fait l'objet d'une sanction en vigueur (${sanctions
      .map((s) => `${SANCTIONS[s.sanction] ?? s.sanction}, ${s.numero}`).join(' ; ')}), à vérifier avant d'affecter`
    : null;

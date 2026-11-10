// Moteur de recommandation du dispatch v1 (CDC 11, D-024) : deterministe,
// regles fixes et explicables. Il propose, le dispatcher decide ; le
// serveur (decider_affectation) controle les contraintes non negociables.

export interface VoyageShift {
  id: string;
  reference: string;
  etat: string | null;
  departure_site_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  loader_vehicle_id: string | null;
}

export interface Engin {
  id: string;
  registration: string;
  vehicle_type: string;
  status: string;
  site_id: string | null;
}

export interface Chauffeur {
  id: string;
  name: string;
  status: string | null;
  license_expiry: string | null;
}

export interface Recommandation {
  voyageId: string;
  camion: Engin | null;
  chauffeur: Chauffeur | null;
  engin: Engin | null;
  explications: string[];
  /** Raison bloquante : aucune proposition complete possible. */
  impossible: string | null;
}

export const TYPES_CAMION = ['tipper', 'flatbed'];
export const TYPES_ENGIN = ['loader', 'excavator'];
const ANNULES = ['CANCELLED', 'REJECTED'];
export const A_AFFECTER = ['DRAFT', 'PLANNED'];

const parImmat = (a: Engin, b: Engin) => a.registration.localeCompare(b.registration);

export const chauffeurDisponible = (c: Chauffeur, date: string) =>
  c.status === 'active' && c.license_expiry !== null && c.license_expiry >= date;

export const camionDisponible = (e: Engin) => e.status === 'active' && TYPES_CAMION.includes(e.vehicle_type);

const STATUTS: Record<string, string> = {
  active: 'actif', maintenance: 'en maintenance', immobilized: 'immobilisé', sold: 'vendu',
};

/** Raison pour laquelle un voyage affecte doit etre reaffecte, sinon null. */
export const raisonReaffectation = (
  v: VoyageShift,
  camions: Map<string, Engin>,
  chauffeurs: Map<string, Chauffeur>,
  date: string,
): string | null => {
  if (v.etat !== 'ASSIGNED') return null;
  const camion = v.vehicle_id ? camions.get(v.vehicle_id) : undefined;
  if (!camion || !camionDisponible(camion)) {
    return camion
      ? `Camion ${camion.registration} indisponible (${STATUTS[camion.status] ?? camion.status})`
      : 'Camion inconnu ou retiré de la flotte';
  }
  const chauffeur = v.driver_id ? chauffeurs.get(v.driver_id) : undefined;
  if (!chauffeur || chauffeur.status !== 'active') return `Chauffeur ${chauffeur?.name ?? 'inconnu'} indisponible`;
  if (!chauffeurDisponible(chauffeur, date)) return `Permis de ${chauffeur.name} expiré`;
  return null;
};

/**
 * Recommandations pour les voyages a (re)affecter, dans l'ordre des
 * references. Regles :
 * - camion : actif, benne, du site de chargement (ou sans site), le moins
 *   de voyages sur le shift, puis immatriculation ;
 * - chauffeur : celui deja au volant de ce camion sur le shift, sinon le
 *   chauffeur habituel du camion (14 jours) s'il est libre, sinon un
 *   chauffeur libre (sur aucun camion du shift), par nom ;
 * - engin : chargeuse ou pelle active du site la moins chargee.
 * Chaque proposition compte dans les suivantes (charge simulee).
 */
export const recommander = ({
  date,
  voyages,
  cibles,
  engins,
  chauffeurs,
  habitudes,
}: {
  date: string;
  voyages: VoyageShift[];
  /** Voyages a traiter : a affecter, ou a reaffecter (camion exclu). */
  cibles: { voyage: VoyageShift; exclureCamion?: string | null }[];
  engins: Engin[];
  chauffeurs: Chauffeur[];
  habitudes: Map<string, string>;
}): Recommandation[] => {
  const actifs = voyages.filter((v) => !ANNULES.includes(v.etat ?? ''));
  const chargeCamion = new Map<string, number>();
  const chargeEngin = new Map<string, number>();
  const chauffeurDuCamion = new Map<string, string>();
  const camionDuChauffeur = new Map<string, string>();
  for (const v of actifs) {
    if (v.vehicle_id) chargeCamion.set(v.vehicle_id, (chargeCamion.get(v.vehicle_id) ?? 0) + 1);
    if (v.loader_vehicle_id) chargeEngin.set(v.loader_vehicle_id, (chargeEngin.get(v.loader_vehicle_id) ?? 0) + 1);
    if (v.vehicle_id && v.driver_id) {
      chauffeurDuCamion.set(v.vehicle_id, v.driver_id);
      camionDuChauffeur.set(v.driver_id, v.vehicle_id);
    }
  }
  const chauffeurParId = new Map(chauffeurs.map((c) => [c.id, c]));
  const libres = [...chauffeurs].sort((a, b) => a.name.localeCompare(b.name));

  return [...cibles]
    .sort((a, b) => a.voyage.reference.localeCompare(b.voyage.reference))
    .map(({ voyage, exclureCamion }) => {
      const site = voyage.departure_site_id;
      const explications: string[] = [];
      const camions = engins
        .filter((e) => camionDisponible(e) && e.id !== exclureCamion && (e.site_id === null || e.site_id === site))
        .sort((a, b) => (chargeCamion.get(a.id) ?? 0) - (chargeCamion.get(b.id) ?? 0) || parImmat(a, b));

      let camion: Engin | null = null;
      let chauffeur: Chauffeur | null = null;
      for (const c of camions) {
        const auVolant = chauffeurDuCamion.get(c.id);
        if (auVolant) {
          const ch = chauffeurParId.get(auVolant);
          if (ch && chauffeurDisponible(ch, date)) {
            camion = c;
            chauffeur = ch;
            explications.push(`${c.registration} : ${chargeCamion.get(c.id) ?? 0} voyage(s) sur le shift, le moins chargé`);
            explications.push(`${ch.name} est déjà au volant de ce camion sur le shift`);
            break;
          }
          continue;
        }
        const habituel = habitudes.get(c.id);
        const ch = habituel ? chauffeurParId.get(habituel) : undefined;
        const choisi = ch && chauffeurDisponible(ch, date) && !camionDuChauffeur.has(ch.id)
          ? { ch, raison: `${ch.name} est le chauffeur habituel de ce camion (14 jours)` }
          : (() => {
              const l = libres.find((x) => chauffeurDisponible(x, date) && !camionDuChauffeur.has(x.id));
              return l ? { ch: l, raison: `${l.name} est disponible (sur aucun camion du shift)` } : null;
            })();
        if (choisi) {
          camion = c;
          chauffeur = choisi.ch;
          explications.push(`${c.registration} : ${chargeCamion.get(c.id) ?? 0} voyage(s) sur le shift, le moins chargé`);
          explications.push(choisi.raison);
          break;
        }
      }

      const engin = engins
        .filter((e) => e.status === 'active' && TYPES_ENGIN.includes(e.vehicle_type) && (e.site_id === null || e.site_id === site))
        .sort((a, b) => (chargeEngin.get(a.id) ?? 0) - (chargeEngin.get(b.id) ?? 0) || parImmat(a, b))[0] ?? null;
      if (engin) explications.push(`${engin.registration} : ${chargeEngin.get(engin.id) ?? 0} voyage(s) à charger, la file la plus courte`);
      else explications.push('Aucune chargeuse ou pelle active sur le site');

      let impossible: string | null = null;
      if (camions.length === 0) impossible = 'Aucun camion disponible sur le site';
      else if (!camion) impossible = 'Aucun chauffeur disponible au permis valide';

      if (camion && chauffeur) {
        chargeCamion.set(camion.id, (chargeCamion.get(camion.id) ?? 0) + 1);
        chauffeurDuCamion.set(camion.id, chauffeur.id);
        camionDuChauffeur.set(chauffeur.id, camion.id);
      }
      if (engin && camion) chargeEngin.set(engin.id, (chargeEngin.get(engin.id) ?? 0) + 1);

      return { voyageId: voyage.id, camion, chauffeur, engin, explications: impossible ? [impossible] : explications, impossible };
    });
};

/** Instantane de la recommandation, historise avec la decision. */
export const instantane = (r: Recommandation) => ({
  camion: r.camion?.registration ?? null,
  chauffeur: r.chauffeur?.name ?? null,
  engin: r.engin?.registration ?? null,
  explications: r.explications,
});

/**
 * Nombre de voyages a preparer pour un objectif : voyages vises, sinon
 * tonnes cibles / charge moyenne observee ; moins les voyages existants.
 * null si aucun calcul possible.
 */
export const voyagesAPreparer = (
  objectif: { tonnes_cible: number; voyages_cible: number | null } | null,
  chargeMoyenne: number | null,
  existants: number,
): { nombre: number; base: string } | null => {
  if (!objectif) return null;
  if (objectif.voyages_cible) {
    return { nombre: Math.max(0, objectif.voyages_cible - existants), base: `${objectif.voyages_cible} voyages visés par l'objectif` };
  }
  if (chargeMoyenne && chargeMoyenne > 0) {
    const total = Math.ceil(Number(objectif.tonnes_cible) / chargeMoyenne);
    return { nombre: Math.max(0, total - existants), base: `objectif / charge moyenne observée (${chargeMoyenne.toFixed(1)} t)` };
  }
  return null;
};

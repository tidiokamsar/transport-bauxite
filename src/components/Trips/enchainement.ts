// Reaffectation directe apres livraison (D-066) : le systeme recommande que
// le camion et le chauffeur qui viennent de livrer prennent le voyage
// suivant, sans retour au parking ; le dispatcher decide (enchainer_voyage,
// controle serveur par decider_affectation).

export const ENCHAINABLES = ['DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'REJECTED'];
export const ENGAGES = ['ASSIGNED', 'AT_LOADING', 'LOADING', 'LOADED', 'WEIGHED_OUT', 'IN_TRANSIT', 'AT_DESTINATION', 'UNLOADING', 'WEIGHED_IN', 'INTERRUPTED'];

export interface VoyageSimple {
  id: string;
  reference: string;
  planned_date: string;
  etat: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  loader_vehicle_id: string | null;
  departure_site_id: string | null;
  arrival_site_id: string | null;
  shift_id: string | null;
}
export interface EnginEtat { id: string; registration: string; status: string }
export interface ChauffeurEtat { id: string; name: string; status: string | null; license_expiry: string | null }

export interface Suivant {
  possible: boolean;
  raison: string | null;
  suivant: VoyageSimple | null;
  chargeuse: EnginEtat | null;
  explications: string[];
}

export const recommanderSuivant = ({
  voyage, camion, chauffeur, chargeuse, voyagesCamion, prepares,
}: {
  voyage: VoyageSimple;
  camion: EnginEtat | null;
  chauffeur: ChauffeurEtat | null;
  chargeuse: EnginEtat | null;
  /** Autres voyages du camion (tous etats). */
  voyagesCamion: VoyageSimple[];
  /** Voyages prepares (sans camion) du site de chargement. */
  prepares: VoyageSimple[];
}): Suivant | null => {
  if (!ENCHAINABLES.includes(voyage.etat ?? '')) return null;
  const refus = (raison: string): Suivant => ({ possible: false, raison, suivant: null, chargeuse: null, explications: [] });
  if (!camion || camion.status !== 'active') return refus(`Camion ${camion?.registration ?? 'inconnu'} indisponible`);
  if (!chauffeur || chauffeur.status !== 'active') return refus(`Chauffeur ${chauffeur?.name ?? 'inconnu'} indisponible`);
  if (!chauffeur.license_expiry || chauffeur.license_expiry < voyage.planned_date) return refus(`Permis de ${chauffeur.name} expiré`);
  const engage = voyagesCamion.find((t) => t.id !== voyage.id && ENGAGES.includes(t.etat ?? ''));
  if (engage) return refus(`Camion déjà engagé sur ${engage.reference}`);

  const candidats = prepares
    .filter((t) => ['DRAFT', 'PLANNED'].includes(t.etat ?? '') && !t.vehicle_id
      && t.departure_site_id === voyage.departure_site_id && t.planned_date >= voyage.planned_date)
    .sort((a, b) =>
      Number(a.planned_date !== voyage.planned_date) - Number(b.planned_date !== voyage.planned_date)
      || Number(a.shift_id !== voyage.shift_id) - Number(b.shift_id !== voyage.shift_id)
      || Number(a.arrival_site_id !== voyage.arrival_site_id) - Number(b.arrival_site_id !== voyage.arrival_site_id)
      || a.reference.localeCompare(b.reference));
  const suivant = candidats[0] ?? null;
  const explications = [
    `${camion.registration} et ${chauffeur.name} viennent de livrer ${voyage.reference} : aucun retour au parking`,
    suivant ? `${suivant.reference} est préparé sans camion sur le même site de chargement` : 'Aucun voyage préparé disponible : un nouveau voyage sur le même trajet sera créé',
  ];
  const garder = chargeuse && chargeuse.status === 'active' ? chargeuse : null;
  explications.push(garder ? `${garder.registration} reste la chargeuse`
    : chargeuse ? `${chargeuse.registration} indisponible : voyage sans chargeuse désignée` : 'Aucune chargeuse sur le voyage livré');
  return { possible: true, raison: null, suivant, chargeuse: garder, explications };
};

// Kilometrage d'un voyage (D-043) : memes regles que la fonction serveur
// mesures_voyage. Une distance absente reste null, jamais estimee.

export type MomentReleve = 'depart_charge' | 'arrivee_depot' | 'fin_rotation';

export const MOMENTS: { id: MomentReleve; libelle: string }[] = [
  { id: 'depart_charge', libelle: 'Départ chargé' },
  { id: 'arrivee_depot', libelle: 'Arrivée dépôt' },
  { id: 'fin_rotation', libelle: 'Fin de rotation' },
];

export interface Releve { id: string; trip_id: string | null; moment: string; valeur_km: number; releve_le: string; saisi_par: string | null }

export interface Mesures { charge: number | null; retour: number | null }

export const mesurer = (releves: Pick<Releve, 'moment' | 'valeur_km'>[]): Mesures => {
  const v = (m: MomentReleve) => {
    const r = releves.find((x) => x.moment === m);
    return r ? Number(r.valeur_km) : null;
  };
  const dep = v('depart_charge'); const arr = v('arrivee_depot'); const fin = v('fin_rotation');
  return {
    charge: dep !== null && arr !== null && arr >= dep ? arr - dep : null,
    retour: arr !== null && fin !== null && fin >= arr ? fin - arr : null,
  };
};

// Une validation qui s'ecarte de la mesure (ou sans mesure) exige un motif.
export const motifRequis = (mesures: Mesures, charge: number | null, retour: number | null) =>
  charge === null || mesures.charge === null || mesures.charge !== charge
  || (retour !== null && (mesures.retour === null || mesures.retour !== retour));

export const ETATS_LIVRES = ['DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED'];

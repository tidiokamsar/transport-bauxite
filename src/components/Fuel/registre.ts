import { formatNombre } from '../Dashboard/indicateurs';
import type { StatutDecision } from './carburant';
import type { LIBELLE_MOUVEMENT } from './stocks';

// Lignes lues du registre carburant (D-041) et formats partages par les
// pages du registre.

export interface Mouvement {
  id: string; numero: number; stockage_id: string; type: keyof typeof LIBELLE_MOUVEMENT; variation: number;
  date_mouvement: string; reference_piece: string | null; statut: StatutDecision; note: string | null; motif_decision: string | null;
  transfert_id: string | null; annule_mouvement_id: string | null; reception_id: string | null; inventaire_id: string | null;
  fuel_transaction_id: string | null; saisi_par: string | null; saisi_le: string; decide_par: string | null; decide_le: string | null;
}
export const COLONNES_MOUVEMENT = 'id, numero, stockage_id, type, variation, date_mouvement, reference_piece, statut, note, motif_decision, transfert_id, annule_mouvement_id, reception_id, inventaire_id, fuel_transaction_id, saisi_par, saisi_le, decide_par, decide_le';

export interface Inventaire {
  id: string; stockage_id: string; date_mesure: string; volume_mesure: number; methode_mesure: string;
  solde_theorique: number | null; ecart: number | null; statut: StatutDecision; note: string | null; motif_decision: string | null;
  cree_par: string | null; cree_le: string; decide_par: string | null; decide_le: string | null;
}
export const COLONNES_INVENTAIRE = 'id, stockage_id, date_mesure, volume_mesure, methode_mesure, solde_theorique, ecart, statut, note, motif_decision, cree_par, cree_le, decide_par, decide_le';

export const litres = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${formatNombre(Number(x), 0)} L`);

/** Date et heure locales pour un champ datetime-local (minute courante). */
export const maintenantLocal = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
export const versIso = (local: string) => new Date(local).toISOString();

import { useState } from 'react';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { STATUT_RESERVATION, type StatutReservation } from './stock';

// Reservations de stock (D-067) : quantite deduite du stock libre sans
// sortie physique ; consommee par une sortie qui la cite, ou levee avec motif.

export interface Reservation {
  id: string; numero: string; stock_item_id: string; warehouse_id: string; quantite: number;
  maintenance_order_id: string | null; vehicle_id: string | null; affectation: string | null; note: string | null;
  reserve_le: string; motif_levee: string | null; quantite_consommee: number; quantite_restante: number; statut: StatutReservation;
}

export const ReservationsStock = ({ reservations, article, depot, ordre, engin, peutEcrire, onLever, onSortir }: {
  reservations: Reservation[];
  article: (id: string) => string;
  depot: (id: string) => string;
  ordre: (id: string) => string;
  engin: (id: string) => string;
  peutEcrire: boolean;
  onLever: (r: Reservation) => void;
  onSortir: (r: Reservation) => void;
}) => {
  const [toutes, setToutes] = useState(false);
  const liste = reservations.filter((r) => toutes || r.statut === 'active');
  const destination = (r: Reservation) => [r.maintenance_order_id && ordre(r.maintenance_order_id), r.vehicle_id && engin(r.vehicle_id), r.affectation]
    .filter(Boolean).join(' · ');
  return <Panneau titre={`Réservations (${reservations.filter((r) => r.statut === 'active').length} actives)`}
    action={<label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={toutes} onChange={(e) => setToutes(e.target.checked)} /> Afficher levées et consommées</label>}>
    {liste.length === 0 ? <SansDonnees message="Aucune réservation active" detail="Une réservation déduit une quantité du stock libre pour un ordre de travail, un engin ou une affectation, sans sortie physique." /> :
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
        <th className="py-2 pr-3">N°</th><th className="py-2 pr-3">Article</th><th className="py-2 pr-3">Dépôt</th><th className="py-2 pr-3 text-right">Réservé</th>
        <th className="py-2 pr-3 text-right">Sorti</th><th className="py-2 pr-3 text-right">Reste</th><th className="py-2 pr-3">Pour</th><th className="py-2 pr-3">Statut</th><th /></tr></thead>
        <tbody>{liste.map((r) => <tr key={r.id} className="border-b border-stone-100">
          <td className="py-2 pr-3 font-mono text-xs">{r.numero}</td><td className="py-2 pr-3">{article(r.stock_item_id)}</td><td className="py-2 pr-3">{depot(r.warehouse_id)}</td>
          <td className="py-2 pr-3 text-right">{r.quantite}</td><td className="py-2 pr-3 text-right">{r.quantite_consommee}</td><td className="py-2 pr-3 text-right font-semibold">{r.quantite_restante}</td>
          <td className="py-2 pr-3 text-xs">{destination(r) || '—'}{r.motif_levee && <span className="block text-stone-500">Levée : {r.motif_levee}</span>}</td>
          <td className="py-2 pr-3"><Puce teinte={STATUT_RESERVATION[r.statut].teinte}>{STATUT_RESERVATION[r.statut].texte}</Puce></td>
          <td className="py-2">{peutEcrire && r.statut === 'active' && <span className="flex gap-1">
            <button onClick={() => onSortir(r)} aria-label={`Sortir ${r.numero}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Sortir</button>
            <button onClick={() => onLever(r)} aria-label={`Lever ${r.numero}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Lever</button></span>}</td>
        </tr>)}</tbody></table></div>}
  </Panneau>;
};

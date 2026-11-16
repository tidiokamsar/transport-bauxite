import { useState } from 'react';
import { Panneau, SansDonnees } from '../ui/Panneau';
import { LIBELLE_MOUVEMENT_STOCK, type TypeMouvementStock } from './stock';

// Lots et numeros de serie en stock (D-067) et trace d'un code, de
// l'entree (reception comprise) jusqu'a la sortie.

export interface LotEnStock { stock_item_id: string; warehouse_id: string; code: string; quantite: number }
export interface LigneLotMouvement {
  id: string; code: string; quantite: number; stock_movement_id: string; movement_number: string; movement_date: string;
  movement_type: TypeMouvementStock; stock_item_id: string; from_warehouse_id: string | null; to_warehouse_id: string | null;
  reference_piece: string | null; annule: boolean;
}

export const LotsStock = ({ lots, mouvements, article, depot }: {
  lots: LotEnStock[];
  mouvements: LigneLotMouvement[];
  article: (id: string) => string;
  depot: (id: string) => string;
}) => {
  const [code, setCode] = useState('');
  const cherche = code.trim().toUpperCase();
  const trace = cherche ? mouvements.filter((m) => m.code.includes(cherche)) : [];
  return <Panneau titre={`Lots et numéros de série en stock (${lots.length})`}>
    {lots.length === 0 ? <SansDonnees message="Aucun lot ni numéro de série en stock" detail="Les articles suivis par lot ou par numéro de série exigent leur détail à chaque mouvement." /> :
      <div className="mb-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
        <th className="py-2 pr-3">Article</th><th className="py-2 pr-3">Dépôt</th><th className="py-2 pr-3">Lot / série</th><th className="py-2 pr-3 text-right">Quantité</th></tr></thead>
        <tbody>{lots.map((l) => <tr key={`${l.stock_item_id}-${l.warehouse_id}-${l.code}`} className="border-b border-stone-100">
          <td className="py-2 pr-3">{article(l.stock_item_id)}</td><td className="py-2 pr-3">{depot(l.warehouse_id)}</td>
          <td className="py-2 pr-3 font-mono">{l.code}</td><td className="py-2 pr-3 text-right">{l.quantite}</td></tr>)}</tbody></table></div>}
    <label className="text-sm">Tracer un lot ou un numéro de série<input aria-label="Tracer un lot" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" className="mt-1 w-full max-w-sm rounded border border-stone-300 px-3 py-2 text-sm" /></label>
    {cherche && (trace.length === 0 ? <p className="mt-2 text-sm text-stone-500">Aucun mouvement pour « {cherche} » (1 000 derniers mouvements de lots).</p> :
      <ul className="mt-2 divide-y divide-stone-100 text-sm">{trace.map((m) => <li key={m.id} className={`py-2 ${m.annule ? 'text-stone-400 line-through' : ''}`}>
        <span className="font-mono">{m.code}</span> · {new Date(m.movement_date).toLocaleString('fr-FR')} · {LIBELLE_MOUVEMENT_STOCK[m.movement_type]} {m.movement_number}
        {' '}· {article(m.stock_item_id)} · {m.from_warehouse_id ? depot(m.from_warehouse_id) : '—'} → {m.to_warehouse_id ? depot(m.to_warehouse_id) : '—'} · {Math.abs(m.quantite)}
        {m.reference_piece && ` · ${m.reference_piece}`}</li>)}</ul>)}
  </Panneau>;
};

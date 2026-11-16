import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { STATUT_VALEUR, texteCmp, texteValeur, type StatutValeur } from './stock';

// Valorisation au cout moyen pondere (D-067), calculee par le serveur
// (valorisation_articles_stock) a partir des seules entrees valorisees :
// une entree sans prix rend la valeur partielle, jamais estimee ; une entree
// annulee apres d'autres mouvements rend la valeur « a verifier ».

const LIMITE = 1000;

interface ParDepot { warehouse_id: string; nb_articles: number; valeur_connue: number | null; nb_articles_partiels: number; nb_articles_sans_prix: number; nb_articles_a_verifier: number; statut: StatutValeur }
interface Detail { stock_item_id: string; warehouse_id: string; quantite: number; cmp: number | null; quantite_non_valorisee: number | null; valeur: number | null; statut: StatutValeur }

export const ValorisationStock = ({ version, article, depot }: { version: number; article: (id: string) => string; depot: (id: string) => string }) => {
  const [depots, setDepots] = useState<ParDepot[] | null>(null);
  const [detail, setDetail] = useState<Detail[]>([]);
  const [choisi, setChoisi] = useState('');
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let actif = true;
    (async () => {
      const [d, s] = await Promise.all([
        supabase.from('v_valorisation_depots').select('warehouse_id, nb_articles, valeur_connue, nb_articles_partiels, nb_articles_sans_prix, nb_articles_a_verifier, statut'),
        supabase.from('v_valorisation_stock').select('stock_item_id, warehouse_id, quantite, cmp, quantite_non_valorisee, valeur, statut', { count: 'exact' })
          .order('warehouse_id').order('stock_item_id').limit(LIMITE),
      ]);
      if (!actif) return;
      setErreur(d.error?.message ?? s.error?.message ?? '');
      setDepots((d.data ?? []) as ParDepot[]);
      setDetail((s.data ?? []) as Detail[]);
      setTotal(s.count ?? null);
      setHeure(new Date());
    })();
    return () => { actif = false; };
  }, [version]);

  const lignes = detail.filter((x) => !choisi || x.warehouse_id === choisi);
  return <Panneau titre="Valorisation (coût moyen pondéré)">
    {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {depots === null ? <p>Chargement…</p> : depots.length === 0 ? <SansDonnees message="Aucun stock à valoriser" /> : <>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
        <th className="py-2 pr-3">Dépôt</th><th className="py-2 pr-3 text-right">Articles</th><th className="py-2 pr-3 text-right">Valeur</th><th className="py-2 pr-3">Fiabilité</th><th /></tr></thead>
        <tbody>{depots.map((d) => <tr key={d.warehouse_id} className={`border-b border-stone-100 ${choisi === d.warehouse_id ? 'bg-orange-50' : ''}`}>
          <td className="py-2 pr-3 font-mono">{depot(d.warehouse_id)}</td><td className="py-2 pr-3 text-right">{d.nb_articles}</td>
          <td className="py-2 pr-3 text-right font-semibold">{texteValeur(d.valeur_connue, d.statut)}</td>
          <td className="py-2 pr-3"><Puce teinte={STATUT_VALEUR[d.statut].teinte}>{STATUT_VALEUR[d.statut].texte}</Puce>
            {(d.nb_articles_partiels > 0 || d.nb_articles_sans_prix > 0) && <span className="block text-xs text-stone-500">
              {d.nb_articles_partiels} article(s) en partie sans prix, {d.nb_articles_sans_prix} sans aucun prix</span>}
            {d.nb_articles_a_verifier > 0 && <span className="block text-xs text-orange-700">
              {d.nb_articles_a_verifier} article(s) à vérifier : entrée annulée après d'autres mouvements, retirée au coût moyen du moment</span>}</td>
          <td className="py-2"><button onClick={() => setChoisi(choisi === d.warehouse_id ? '' : d.warehouse_id)} aria-label={`Détail valorisation ${depot(d.warehouse_id)}`} className="rounded border border-stone-300 px-2 py-1 text-xs">{choisi === d.warehouse_id ? 'Tous' : 'Détail'}</button></td>
        </tr>)}</tbody></table></div>
      {total !== null && total > detail.length && <p role="status" className="mt-3 rounded bg-orange-50 p-2 text-xs text-orange-800">
        Détail tronqué : {detail.length} lignes affichées sur {total}. Les totaux par dépôt ci-dessus portent sur toutes les lignes.</p>}
      {choisi && <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
        <th className="py-2 pr-3">Article</th><th className="py-2 pr-3 text-right">Quantité</th><th className="py-2 pr-3 text-right">CMP</th><th className="py-2 pr-3 text-right">Valeur</th><th className="py-2 pr-3">Fiabilité</th></tr></thead>
        <tbody>{lignes.map((x) => <tr key={`${x.stock_item_id}-${x.warehouse_id}`} className="border-b border-stone-100">
          <td className="py-2 pr-3">{article(x.stock_item_id)}</td><td className="py-2 pr-3 text-right">{x.quantite}</td>
          <td className="py-2 pr-3 text-right">{texteCmp(x.cmp)}</td><td className="py-2 pr-3 text-right">{texteValeur(x.valeur, x.statut)}</td>
          <td className="py-2 pr-3"><Puce teinte={STATUT_VALEUR[x.statut].teinte}>{STATUT_VALEUR[x.statut].texte}</Puce>
            {x.statut === 'partielle' && x.quantite_non_valorisee !== null && <span className="block text-xs text-stone-500">{x.quantite_non_valorisee} unité(s) sans prix, réparties au prorata des quantités entre dépôts, non valorisée(s)</span>}</td>
        </tr>)}</tbody></table></div>}
    </>}
    <Provenance source="registre des mouvements, entrées valorisées au prix saisi ou de réception ; coût moyen de l'article tous dépôts, dans l'ordre d'enregistrement, recalculé par le serveur ; part sans prix répartie au prorata des quantités ; retours au coût moyen du moment, sortie annulée au coût de la sortie ; GNF, stock à date" heure={heure} />
  </Panneau>;
};

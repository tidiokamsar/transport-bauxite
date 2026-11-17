import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import {
  COLONNES_BON, COLONNES_LIGNE_BON, LIGNE_PNEU, MODULE_ACHATS, VUE_ACHATS, erreursBon, lignesPourServeur, montantGnf, operationsPossibles, totalSaisi,
  type Bon, type LigneBon, type LigneSaisie,
} from './achats';

// Brouillon de bon de commande en pleine page (D-053, D-090) :
// enregistrer_bon_commande cree ou modifie le brouillon (numero et totaux
// attribues par le serveur). Seul un brouillon se modifie.

interface Lib { id: string; libelle: string }
const LIGNE_VIDE: LigneSaisie = { article: '', designation: '', quantite: '', prix: '' };

const saisieDepuisLigne = (l: LigneBon): LigneSaisie => (l.pneu_marque
  ? { article: LIGNE_PNEU, designation: '', quantite: String(l.quantity), prix: String(l.unit_price), pneuMarque: l.pneu_marque, pneuModele: l.pneu_modele ?? '', pneuDimension: l.pneu_dimension ?? '' }
  : { article: l.stock_item_id ?? '', designation: l.stock_item_id ? '' : l.item_description, quantite: String(l.quantity), prix: String(l.unit_price) });

export const FormulaireBon = ({ id }: { id?: string }) => {
  const { hasPermission } = useAuth();
  const peutAcheter = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const [bon, setBon] = useState<Bon | null>(null);
  const [fournisseurs, setFournisseurs] = useState<Lib[] | null>(null);
  const [depots, setDepots] = useState<Lib[] | null>(null);
  const [articles, setArticles] = useState<Lib[]>([]);
  const [erreurChargement, setErreurChargement] = useState('');
  const [pret, setPret] = useState(!id);
  const { valeurs: f, poser, modifie, initialiser } = useSaisie({ fournisseur: '', depot: '', livraison: '', taxes: '0', note: '', lignes: [LIGNE_VIDE] as LigneSaisie[] });

  useEffect(() => {
    Promise.all([
      supabase.from('suppliers').select('id, company_name').order('company_name'),
      supabase.from('warehouses').select('id, name, code').order('name'),
      supabase.from('stock_items').select('id, name, item_code').order('name'),
    ]).then(([fo, d, a]) => {
      const e = fo.error ? `Fournisseurs indisponibles : ${fo.error.message}` : d.error ? `Dépôts indisponibles : ${d.error.message}` : a.error ? `Articles indisponibles : ${a.error.message}` : '';
      if (e) setErreurChargement(e);
      setFournisseurs((fo.data ?? []).map((x) => ({ id: x.id as string, libelle: x.company_name as string })));
      setDepots((d.data ?? []).map((x) => ({ id: x.id as string, libelle: `${x.name as string} (${x.code as string})` })));
      setArticles((a.data ?? []).map((x) => ({ id: x.id as string, libelle: `${x.name as string} · ${x.item_code as string}` })));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      lire<Bon>(supabase.from('purchase_orders').select(COLONNES_BON).eq('id', id), 'bon de commande'),
      lire<LigneBon>(supabase.from('purchase_order_items').select(COLONNES_LIGNE_BON).eq('purchase_order_id', id), 'lignes du bon'),
    ]).then(([b, l]) => {
      const ligne = trouver(b.lignes, id);
      setBon(ligne);
      if (b.erreur || l.erreur || !ligne) { setErreurChargement(b.erreur || l.erreur || 'Bon de commande introuvable ou hors de votre périmètre.'); return; }
      const lignes = (l.lignes ?? []).filter((x) => x.purchase_order_id === id).map(saisieDepuisLigne);
      initialiser({ fournisseur: ligne.supplier_id, depot: ligne.warehouse_id ?? '', livraison: ligne.expected_delivery_date ?? '', taxes: String(ligne.tax_amount ?? 0),
        note: ligne.notes ?? '', lignes: lignes.length ? lignes : [LIGNE_VIDE] });
      setPret(true);
    });
  }, [id, initialiser]);

  const poserLigne = (i: number, k: keyof LigneSaisie, v: string) => poser('lignes', f.lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const total = totalSaisi(f.lignes, f.taxes);
  const erreurs = [
    ...(!peutAcheter ? ['Droit d\'écriture sur les achats requis.'] : []),
    ...(bon && !operationsPossibles(bon.status).modifier ? ['Seul un brouillon se modifie.'] : []),
    ...erreursBon(f, f.lignes),
  ];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('enregistrer_bon_commande', {
      p_id: id ?? null, p_fournisseur: f.fournisseur, p_depot: f.depot, p_lignes: lignesPourServeur(f.lignes),
      p_livraison_prevue: f.livraison || null, p_taxes: Number(f.taxes || '0'), p_note: f.note.trim() || null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce(id ? 'Brouillon modifié.' : 'Bon de commande enregistré en brouillon.');
    const cible = id ?? (typeof data === 'string' && data ? data : null);
    return { vers: cible ? routeDetail(VUE_ACHATS, cible) : routeListe(VUE_ACHATS) };
  };

  const titre = id ? `Modifier le brouillon ${bon?.po_number ?? ''}`.trim() : 'Nouveau bon de commande';
  return (
    <PageFormulaire
      vue={VUE_ACHATS}
      module={MODULE_ACHATS}
      titre={titre}
      reference={bon?.po_number}
      id={id}
      description="Numéro : attribué à l'enregistrement. Les totaux sont recalculés par le serveur."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer le brouillon"
      chargement={fournisseurs === null || depots === null || !pret}
      erreurChargement={erreurChargement}
    >
      {fournisseurs?.length === 0 && <ReferentielVide>Aucun fournisseur enregistré : créez-le d'abord (Stocks & Achats → Fournisseurs).</ReferentielVide>}
      {depots?.length === 0 && <ReferentielVide>Aucun dépôt enregistré : créez-le d'abord (Stocks & Achats → Stocks, onglet Dépôts).</ReferentielVide>}
      <SectionFormulaire titre="En-tête">
        <ChampPage libelle="Fournisseur *">
          <select value={f.fournisseur} onChange={(e) => poser('fournisseur', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>{(fournisseurs ?? []).map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Dépôt de livraison *">
          <select value={f.depot} onChange={(e) => poser('depot', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>{(depots ?? []).map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Livraison prévue">
          <input type="date" value={f.livraison} onChange={(e) => poser('livraison', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Taxes (GNF)">
          <input inputMode="numeric" value={f.taxes} onChange={(e) => poser('taxes', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Note" className="sm:col-span-2">
          <input value={f.note} onChange={(e) => poser('note', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>

      <fieldset className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
        <legend className="px-1 font-bold text-stone-900">Lignes</legend>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-2">Article du magasin</th><th className="py-2 pr-2">ou désignation libre</th><th className="py-2 pr-2">Quantité</th><th className="py-2 pr-2">Prix unitaire (GNF)</th><th /></tr></thead>
            <tbody>{f.lignes.map((l, i) => (
              <tr key={i} className="border-b border-stone-100">
                <td className="py-1 pr-2">
                  <select aria-label={`Article ligne ${i + 1}`} value={l.article} onChange={(e) => poserLigne(i, 'article', e.target.value)} className={CHAMP_FENETRE}>
                    <option value="">Aucun (hors stock)</option><option value={LIGNE_PNEU}>Pneus (registre des pneus)</option>
                    {articles.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}
                  </select>
                </td>
                <td className="py-1 pr-2">{l.article === LIGNE_PNEU
                  ? (
                    <div className="grid grid-cols-3 gap-1">
                      <input aria-label={`Marque pneu ligne ${i + 1}`} placeholder="Marque *" value={l.pneuMarque ?? ''} onChange={(e) => poserLigne(i, 'pneuMarque', e.target.value)} className={CHAMP_FENETRE} />
                      <input aria-label={`Modèle pneu ligne ${i + 1}`} placeholder="Modèle *" value={l.pneuModele ?? ''} onChange={(e) => poserLigne(i, 'pneuModele', e.target.value)} className={CHAMP_FENETRE} />
                      <input aria-label={`Dimension pneu ligne ${i + 1}`} placeholder="Dimension" value={l.pneuDimension ?? ''} onChange={(e) => poserLigne(i, 'pneuDimension', e.target.value)} className={CHAMP_FENETRE} />
                    </div>
                  )
                  : <input aria-label={`Désignation ligne ${i + 1}`} value={l.designation} onChange={(e) => poserLigne(i, 'designation', e.target.value)} className={CHAMP_FENETRE} />}
                </td>
                <td className="py-1 pr-2"><input aria-label={`Quantité ligne ${i + 1}`} inputMode="numeric" value={l.quantite} onChange={(e) => poserLigne(i, 'quantite', e.target.value)} className={CHAMP_FENETRE} /></td>
                <td className="py-1 pr-2"><input aria-label={`Prix ligne ${i + 1}`} inputMode="numeric" value={l.prix} onChange={(e) => poserLigne(i, 'prix', e.target.value)} className={CHAMP_FENETRE} /></td>
                <td className="py-1">{f.lignes.length > 1 && (
                  <button type="button" onClick={() => poser('lignes', f.lignes.filter((_, j) => j !== i))} aria-label={`Retirer la ligne ${i + 1}`} className="rounded border border-stone-300 p-2"><Trash2 className="h-3 w-3" /></button>
                )}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <button type="button" onClick={() => poser('lignes', [...f.lignes, LIGNE_VIDE])} className="mt-2 rounded border border-stone-300 px-3 py-1 text-xs">Ajouter une ligne</button>
        <p className="mt-3 text-sm">Total : <b>{total === null ? 'lignes incomplètes' : montantGnf(total)}</b></p>
      </fieldset>
    </PageFormulaire>
  );
};

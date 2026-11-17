import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { poserAnnonce } from '../ui/routeur';
import { lignesConsultationPourServeur, type LigneConsultationSaisie } from './fournisseurs';
import { erreursConsultation } from './saisie';
import { ID_CONSULTATIONS, MODULE_FOURNISSEURS, VUE_FOURNISSEURS, routeConsultation, routeConsultations } from './routes';

// Creation d'une consultation de prix en pleine page (D-059, D-090) par
// creer_consultation : lignes (article du magasin ou designation libre),
// fournisseurs actifs consultes, depot de livraison et date limite.

interface Lib { id: string; libelle: string }
const LIGNE_VIDE: LigneConsultationSaisie = { article: '', designation: '', quantite: '' };

export const FormulaireConsultation = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const [depots, setDepots] = useState<Lib[] | null>(null);
  const [articles, setArticles] = useState<Lib[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Lib[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: s, poser, modifie } = useSaisie({ objet: '', depot: '', limite: '', note: '', lignes: [LIGNE_VIDE], consultes: [] as string[] });

  useEffect(() => {
    Promise.all([
      supabase.from('warehouses').select('id, name, code').order('name'),
      supabase.from('stock_items').select('id, name, item_code').order('name'),
      supabase.from('suppliers').select('id, company_name, active').order('company_name'),
    ]).then(([d, a, f]) => {
      setErreurChargement(f.error ? `Fournisseurs indisponibles : ${f.error.message}` : '');
      setDepots((d.data ?? []).map((x) => ({ id: x.id as string, libelle: `${x.name as string} (${x.code as string})` })));
      setArticles((a.data ?? []).map((x) => ({ id: x.id as string, libelle: `${x.name as string} · ${x.item_code as string}` })));
      setFournisseurs((f.data ?? []).filter((x) => x.active !== false).map((x) => ({ id: x.id as string, libelle: x.company_name as string })));
    });
  }, []);

  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur les achats requis.'] : []), ...erreursConsultation(s)];
  const poserLigne = (i: number, k: keyof LigneConsultationSaisie, v: string) => poser('lignes', s.lignes.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('creer_consultation', {
      p_objet: s.objet.trim() || null, p_lignes: lignesConsultationPourServeur(s.lignes), p_fournisseurs: s.consultes, p_depot: s.depot || null,
      p_date_limite: s.limite || null, p_note: s.note.trim() || null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Consultation créée : numéro attribué par le serveur.');
    return { vers: typeof data === 'string' && data ? routeConsultation(data) : routeConsultations() };
  };

  return (
    <PageFormulaire
      vue={VUE_FOURNISSEURS}
      module={MODULE_FOURNISSEURS}
      titre="Nouvelle consultation"
      reference="Consultations"
      id={ID_CONSULTATIONS}
      description="Demande de cotation adressée à des fournisseurs actifs ; les offres se saisissent ensuite depuis la fiche de la consultation."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Créer la consultation"
      chargement={depots === null || fournisseurs === null}
      erreurChargement={erreurChargement}
    >
      <SectionFormulaire titre="Consultation">
        <ChampPage libelle="Objet *" className="sm:col-span-2">
          <input value={s.objet} onChange={(e) => poser('objet', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Dépôt de livraison" aide="Sans dépôt, le bon de commande se prépare après la sélection.">
          <select value={s.depot} onChange={(e) => poser('depot', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">À préciser</option>{(depots ?? []).map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Date limite de réponse">
          <input type="date" value={s.limite} onChange={(e) => poser('limite', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Note" className="sm:col-span-2">
          <input value={s.note} onChange={(e) => poser('note', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>

      <fieldset className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
        <legend className="px-1 font-bold text-stone-900">Lignes demandées</legend>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-2">Article du magasin</th><th className="py-2 pr-2">ou désignation libre</th><th className="py-2 pr-2">Quantité</th><th /></tr></thead>
          <tbody>{s.lignes.map((l, i) => (
            <tr key={i} className="border-b border-stone-100">
              <td className="py-1 pr-2"><select aria-label={`Article ligne ${i + 1}`} value={l.article} onChange={(e) => poserLigne(i, 'article', e.target.value)} className={CHAMP_FENETRE}>
                <option value="">Aucun (hors stock)</option>{articles.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></td>
              <td className="py-1 pr-2"><input aria-label={`Désignation ligne ${i + 1}`} value={l.designation} onChange={(e) => poserLigne(i, 'designation', e.target.value)} className={CHAMP_FENETRE} /></td>
              <td className="py-1 pr-2"><input aria-label={`Quantité ligne ${i + 1}`} inputMode="numeric" value={l.quantite} onChange={(e) => poserLigne(i, 'quantite', e.target.value)} className={CHAMP_FENETRE} /></td>
              <td className="py-1">{s.lignes.length > 1 && (
                <button type="button" onClick={() => poser('lignes', s.lignes.filter((_, j) => j !== i))} aria-label={`Retirer la ligne ${i + 1}`} className="rounded border border-stone-300 p-2"><Trash2 className="h-3 w-3" /></button>
              )}</td>
            </tr>
          ))}</tbody>
        </table>
        <button type="button" onClick={() => poser('lignes', [...s.lignes, LIGNE_VIDE])} className="mt-2 rounded border border-stone-300 px-3 py-1 text-xs">Ajouter une ligne</button>
      </fieldset>

      <fieldset className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
        <legend className="px-1 font-bold text-stone-900">Fournisseurs consultés * (actifs seulement)</legend>
        {fournisseurs && fournisseurs.length === 0 ? <SansDonnees message="Aucun fournisseur actif" detail="Créez ou réactivez un fournisseur dans le répertoire." /> : (
          <div className="flex flex-wrap gap-3 text-sm">{(fournisseurs ?? []).map((f) => (
            <label key={f.id} className="flex items-center gap-1">
              <input type="checkbox" checked={s.consultes.includes(f.id)} onChange={(e) => poser('consultes', e.target.checked ? [...s.consultes, f.id] : s.consultes.filter((x) => x !== f.id))} />{f.libelle}
            </label>
          ))}</div>
        )}
        {s.consultes.length === 1 && <p className="mt-2 text-xs text-orange-700">Un seul fournisseur consulté : pas de mise en concurrence.</p>}
      </fieldset>
    </PageFormulaire>
  );
};

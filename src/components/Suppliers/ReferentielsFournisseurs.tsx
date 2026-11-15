import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { CHAMP, type Categorie } from './fournisseurs';

// Referentiels fournisseurs (D-059) : categories (droit d'ecriture des
// achats) et grille d'evaluation ponderee (administrateur). Aucune grille
// n'est fournie par defaut : les criteres et leurs poids sont a definir.

interface Critere { id: string; libelle: string; description: string | null; poids: number; ordre: number; actif: boolean }

export const ReferentielsFournisseurs = ({ categories, onChange }: { categories: Categorie[]; onChange: () => Promise<void> }) => {
  const { hasPermission, profile } = useAuth();
  const peutEcrire = hasPermission('purchases', 'create') || hasPermission('purchases', 'edit');
  const estAdmin = profile?.role === 'admin';
  const [criteres, setCriteres] = useState<Critere[] | null>(null);
  const [categorie, setCategorie] = useState('');
  const [critere, setCritere] = useState<Record<string, string> | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase.from('criteres_evaluation_fournisseur').select('id, libelle, description, poids, ordre, actif').order('ordre');
    setCriteres((data ?? []) as Critere[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fonction, args);
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes);
    await Promise.all([charger(), onChange()]);
    return true;
  };

  const poids = critere?.poids?.trim() ?? '';
  const enregistrerCritere = () => {
    if (!critere) return;
    executer('definir_critere_evaluation', {
      p_id: critere.id || null, p_libelle: critere.libelle?.trim() || null, p_poids: Number(poids), p_description: critere.description?.trim() || null,
      p_ordre: Number(critere.ordre || '0'), p_actif: critere.actif !== 'non',
    }, 'Critère enregistré.').then((ok) => { if (ok) setCritere(null); });
  };
  const totalPoids = (criteres ?? []).filter((c) => c.actif).reduce((s, c) => s + c.poids, 0);

  return <div className="grid gap-5 xl:grid-cols-2">
    {(erreur || message) && <div className="xl:col-span-2">
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    </div>}
    <Panneau titre="Catégories de fournisseurs">
      {categories.length === 0 ? <SansDonnees message="Aucune catégorie" /> :
        <ul className="divide-y divide-stone-100 text-sm">{categories.map((c) => <li key={c.id} className="flex items-center justify-between gap-2 py-2">
          <span>{c.libelle} {!c.actif && <Puce teinte="gris">Inactive</Puce>}</span>
          {peutEcrire && <button onClick={() => executer('definir_categorie_fournisseur', { p_id: c.id, p_libelle: c.libelle, p_actif: !c.actif }, c.actif ? 'Catégorie désactivée.' : 'Catégorie réactivée.')}
            className="rounded border border-stone-300 px-2 py-1 text-xs">{c.actif ? 'Désactiver' : 'Réactiver'}</button>}
        </li>)}</ul>}
      {peutEcrire && <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm">Nouvelle catégorie<input value={categorie} onChange={(e) => setCategorie(e.target.value)} className={CHAMP} /></label>
        <button disabled={busy || !categorie.trim()} onClick={() => executer('definir_categorie_fournisseur', { p_libelle: categorie.trim() }, 'Catégorie ajoutée.').then((ok) => { if (ok) setCategorie(''); })}
          className="rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Ajouter la catégorie</button>
      </div>}
    </Panneau>

    <Panneau titre="Grille d'évaluation">
      <p className="mb-2 text-xs text-stone-500">Notes de 1 à 5 par critère ; note globale = moyenne pondérée par les poids, calculée par le serveur. Critères et poids définis par l'administrateur ; les évaluations passées gardent les libellés et poids de leur date.</p>
      {criteres === null ? <p>Chargement…</p> : criteres.length === 0 ? <SansDonnees message="Grille non définie" detail="Aucune évaluation possible tant que l'administrateur n'a pas défini de critère." /> :
        <table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Critère</th><th className="py-2 pr-3">Poids</th><th className="py-2 pr-3">État</th><th /></tr></thead>
          <tbody>{criteres.map((c) => <tr key={c.id} className="border-b border-stone-100">
            <td className="py-2 pr-3">{c.libelle}{c.description && <span className="block text-xs text-stone-500">{c.description}</span>}</td>
            <td className="py-2 pr-3">{c.poids}{c.actif && totalPoids > 0 && <span className="text-xs text-stone-500"> ({Math.round((c.poids / totalPoids) * 100)} %)</span>}</td>
            <td className="py-2 pr-3"><Puce teinte={c.actif ? 'vert' : 'gris'}>{c.actif ? 'Actif' : 'Inactif'}</Puce></td>
            <td className="py-2">{estAdmin && <button onClick={() => setCritere({ id: c.id, libelle: c.libelle, description: c.description ?? '', poids: String(c.poids), ordre: String(c.ordre), actif: c.actif ? 'oui' : 'non' })} className="rounded border border-stone-300 px-2 py-1 text-xs">Modifier</button>}</td>
          </tr>)}</tbody></table>}
      {estAdmin && !critere && <button onClick={() => setCritere({ actif: 'oui', ordre: String((criteres ?? []).length + 1) })} className="mt-3 rounded border border-stone-300 px-3 py-1 text-xs">Ajouter un critère</button>}
      {critere && <div role="form" aria-label="Saisie critère" className="mt-3 grid gap-2 rounded-lg bg-stone-50 p-3 sm:grid-cols-2">
        <label className="text-sm">Libellé *<input value={critere.libelle ?? ''} onChange={(e) => setCritere({ ...critere, libelle: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Poids * (entier positif)<input inputMode="numeric" value={critere.poids ?? ''} onChange={(e) => setCritere({ ...critere, poids: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Description<input value={critere.description ?? ''} onChange={(e) => setCritere({ ...critere, description: e.target.value })} className={CHAMP} /></label>
        <label className="text-sm">Actif<select value={critere.actif ?? 'oui'} onChange={(e) => setCritere({ ...critere, actif: e.target.value })} className={CHAMP}><option value="oui">Oui</option><option value="non">Non</option></select></label>
        <div className="flex gap-2 sm:col-span-2">
          <button disabled={busy || !critere.libelle?.trim() || !/^[1-9]\d*$/.test(poids)} onClick={enregistrerCritere} className="rounded-lg bg-orange-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Enregistrer le critère</button>
          <button onClick={() => setCritere(null)} className="rounded-lg border border-stone-300 px-3 py-1 text-xs">Annuler</button>
        </div>
      </div>}
    </Panneau>
  </div>;
};

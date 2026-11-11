import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';

// Comites de contrat (phase 4, D-031) : date, objet, ordre du jour,
// participants, proces-verbal, actions avec responsable et echeance.

interface Comite { id: string; contrat_id: string; date_comite: string; objet: string; ordre_du_jour: string | null; participants: string | null; proces_verbal: string | null; statut: 'prevu' | 'tenu' | 'annule' }
interface Action { id: string; comite_id: string; libelle: string; responsable: string | null; echeance: string | null; statut: 'ouverte' | 'faite' | 'abandonnee' }

const STATUTS = { prevu: { l: 'Prévu', t: 'bleu' as const }, tenu: { l: 'Tenu', t: 'vert' as const }, annule: { l: 'Annulé', t: 'gris' as const } };
const CHAMP = 'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm';

export const ComitesView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [contrats, setContrats] = useState<{ id: string; reference: string; contrepartie: string }[]>([]);
  const [comites, setComites] = useState<Comite[] | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [edition, setEdition] = useState<Partial<Comite> | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    const [c, k, a] = await Promise.all([
      supabase.from('contrats').select('id, reference, contrepartie').order('reference'),
      supabase.from('comites_contrat').select('*').order('date_comite', { ascending: false }),
      supabase.from('comite_actions').select('*').order('echeance'),
    ]);
    setContrats((c.data ?? []) as { id: string; reference: string; contrepartie: string }[]);
    setComites((k.data ?? []) as Comite[]);
    setActions((a.data ?? []) as Action[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async () => {
    if (!edition) return;
    const ligne = {
      contrat_id: edition.contrat_id, date_comite: edition.date_comite, objet: edition.objet?.trim(),
      ordre_du_jour: edition.ordre_du_jour || null, participants: edition.participants || null,
      proces_verbal: edition.proces_verbal || null, statut: edition.statut ?? 'prevu',
    };
    const { error } = edition.id ? await supabase.from('comites_contrat').update(ligne).eq('id', edition.id) : await supabase.from('comites_contrat').insert(ligne);
    if (error) { setErreur(error.message); return; }
    setEdition(null);
    setErreur('');
    charger();
  };
  const ajouterAction = async (c: Comite) => {
    const libelle = window.prompt('Action décidée');
    if (!libelle) return;
    const responsable = window.prompt('Responsable') || null;
    const echeance = window.prompt('Échéance (AAAA-MM-JJ, facultatif)') || null;
    const { error } = await supabase.from('comite_actions').insert({ comite_id: c.id, libelle, responsable, echeance });
    if (error) setErreur(error.message);
    charger();
  };
  const changerAction = async (a: Action, statut: Action['statut']) => {
    const { error } = await supabase.from('comite_actions').update({ statut }).eq('id', a.id);
    if (error) setErreur(error.message);
    charger();
  };
  const contrat = (id: string) => contrats.find((c) => c.id === id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black text-stone-900">Comités de contrat</h2><p className="text-stone-500">Préparation, procès-verbal et suivi des actions</p></div>
        {peutEcrire && <button onClick={() => setEdition({ contrat_id: contrats[0]?.id, date_comite: new Date().toISOString().slice(0, 10), statut: 'prevu' })} disabled={contrats.length === 0} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Nouveau comité</button>}
      </div>
      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {comites === null ? <div className="h-16" /> : comites.length === 0 ? <Panneau><SansDonnees message="Aucun comité" detail="Préparez le prochain comité de contrat." /></Panneau> : comites.map((c) => {
        const liste = actions.filter((a) => a.comite_id === c.id);
        return (
          <Panneau key={c.id} titre={`${new Date(c.date_comite + 'T00:00:00').toLocaleDateString('fr-FR')} · ${c.objet}`} action={
            <div className="flex items-center gap-2"><Puce teinte={STATUTS[c.statut].t}>{STATUTS[c.statut].l}</Puce>{peutEcrire && <button onClick={() => setEdition(c)} className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs">Modifier</button>}</div>
          }>
            <p className="text-sm text-stone-500">{contrat(c.contrat_id)?.reference} · {contrat(c.contrat_id)?.contrepartie}{c.participants ? ` · participants : ${c.participants}` : ''}</p>
            {c.ordre_du_jour && <div className="mt-2 text-sm"><p className="font-semibold">Ordre du jour</p><p className="whitespace-pre-line text-stone-700">{c.ordre_du_jour}</p></div>}
            {c.proces_verbal && <div className="mt-2 text-sm"><p className="font-semibold">Procès-verbal</p><p className="whitespace-pre-line text-stone-700">{c.proces_verbal}</p></div>}
            <div className="mt-3 text-sm">
              <div className="flex items-center justify-between"><p className="font-semibold">Actions ({liste.filter((a) => a.statut === 'ouverte').length} ouverte(s))</p>{peutEcrire && <button onClick={() => ajouterAction(c)} className="text-xs font-semibold text-orange-700 hover:underline">+ Ajouter une action</button>}</div>
              <ul className="mt-1 space-y-1">{liste.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-2 py-1">
                  <span className={a.statut !== 'ouverte' ? 'text-stone-400 line-through' : ''}>{a.libelle}{a.responsable ? ` · ${a.responsable}` : ''}{a.echeance ? ` · avant le ${new Date(a.echeance + 'T00:00:00').toLocaleDateString('fr-FR')}` : ''}</span>
                  {peutEcrire && a.statut === 'ouverte' && <span className="flex gap-1 text-xs"><button onClick={() => changerAction(a, 'faite')} className="rounded bg-green-50 px-2 py-0.5 text-green-700">Faite</button><button onClick={() => changerAction(a, 'abandonnee')} className="rounded px-2 py-0.5 text-stone-500 hover:bg-stone-100">Abandonnée</button></span>}
                </li>
              ))}</ul>
            </div>
          </Panneau>
        );
      })}

      {edition && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={() => setEdition(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Comité de contrat">
            <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4"><h2 className="text-xl font-black">{edition.id ? 'Modifier le comité' : 'Nouveau comité'}</h2><button onClick={() => setEdition(null)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button></header>
            <div className="grid grid-cols-1 gap-3 px-6 py-5 text-sm sm:grid-cols-2">
              <label>Contrat *<select value={edition.contrat_id ?? ''} onChange={(e) => setEdition({ ...edition, contrat_id: e.target.value })} className={CHAMP}>{contrats.map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.contrepartie}</option>)}</select></label>
              <label>Date *<input type="date" value={edition.date_comite ?? ''} onChange={(e) => setEdition({ ...edition, date_comite: e.target.value })} className={CHAMP} /></label>
              <label className="sm:col-span-2">Objet *<input value={edition.objet ?? ''} onChange={(e) => setEdition({ ...edition, objet: e.target.value })} className={CHAMP} /></label>
              <label>Statut<select value={edition.statut ?? 'prevu'} onChange={(e) => setEdition({ ...edition, statut: e.target.value as Comite['statut'] })} className={CHAMP}><option value="prevu">Prévu</option><option value="tenu">Tenu</option><option value="annule">Annulé</option></select></label>
              <label>Participants<input value={edition.participants ?? ''} onChange={(e) => setEdition({ ...edition, participants: e.target.value })} className={CHAMP} /></label>
              <label className="sm:col-span-2">Ordre du jour<textarea rows={3} value={edition.ordre_du_jour ?? ''} onChange={(e) => setEdition({ ...edition, ordre_du_jour: e.target.value })} className={CHAMP} /></label>
              <label className="sm:col-span-2">Procès-verbal<textarea rows={4} value={edition.proces_verbal ?? ''} onChange={(e) => setEdition({ ...edition, proces_verbal: e.target.value })} className={CHAMP} /></label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4"><button onClick={() => setEdition(null)} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">Annuler</button><button onClick={enregistrer} disabled={!edition.contrat_id || !edition.date_comite || !edition.objet?.trim()} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button></footer>
          </div>
        </div>
      )}
    </div>
  );
};

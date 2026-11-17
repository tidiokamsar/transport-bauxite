import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import {
  MODULE_BUDGETS, SAISIE_BUDGET_VIDE, VUE_BUDGETS, budgetNonModifiable, erreursBudget, lireMontantBudget, type SuiviBudget,
} from './budgets';

// Budget en pleine page (D-065, D-090) : creation, ou revision du budget
// courant (#/budgets/<id>/modifier). definir_budget conserve le precedent
// et exige le motif de la revision.

interface Nature { id: string; code: string; libelle: string; actif: boolean }

export const FormulaireBudget = ({ id }: { id?: string }) => {
  const { hasPermission } = useAuth();
  const peutBudget = hasPermission('costs', 'create') || hasPermission('costs', 'edit');
  const [natures, setNatures] = useState<Nature[] | null>(null);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [remplace, setRemplace] = useState<SuiviBudget | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: b, poser, modifie, initialiser } = useSaisie(SAISIE_BUDGET_VIDE);

  useEffect(() => {
    Promise.all([
      supabase.from('natures_depense').select('id, code, libelle, actif').order('code'),
      supabase.from('sites').select('id, name').order('name'),
      id ? lire<SuiviBudget>(supabase.from('v_suivi_budgets').select('*').eq('id', id), 'budget courant') : Promise.resolve(null),
    ]).then(([n, s, r]) => {
      setNatures((n.data ?? []) as Nature[]);
      setSites((s.data ?? []) as { id: string; name: string }[]);
      const courant = r ? trouver(r.lignes, id ?? '') : null;
      setRemplace(courant);
      setErreurChargement(n.error ? `Natures de dépense indisponibles : ${n.error.message}` : r?.erreur
        || (id && !courant ? budgetNonModifiable(true, false) ?? '' : ''));
      if (courant) {
        initialiser({ debut: courant.periode_debut, fin: courant.periode_fin, nature: courant.nature_id, site: courant.site_id ?? '', devise: courant.devise,
          montant: String(courant.montant_ttc), motif: '', note: courant.note ?? '' });
      }
      setChargement(false);
    });
  }, [id, initialiser]);

  const revision = Boolean(id);
  const erreurs = [...(!peutBudget ? ['Droit d\'écriture sur les coûts requis.'] : []), ...erreursBudget(b, revision)];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('definir_budget', {
      p_debut: b.debut, p_fin: b.fin, p_nature: b.nature, p_devise: b.devise, p_montant: lireMontantBudget(b.montant),
      p_site: b.site || null, p_note: b.note.trim() || null, p_remplace: remplace?.id ?? null, p_motif: remplace ? b.motif.trim() : null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce(remplace ? 'Budget révisé : la version précédente reste conservée.' : 'Budget enregistré.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_BUDGETS, data) : routeListe(VUE_BUDGETS) };
  };

  return (
    <PageFormulaire
      vue={VUE_BUDGETS}
      module={MODULE_BUDGETS}
      titre={revision ? `Réviser le budget ${remplace?.numero ?? ''}`.trim() : 'Nouveau budget'}
      reference={remplace?.numero}
      id={id}
      description={revision ? 'La révision crée une nouvelle version ; la précédente reste conservée avec le motif.' : 'Un budget par période, centre (site) et nature de dépense, montant toutes taxes comprises.'}
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer le budget"
      chargement={chargement}
      erreurChargement={erreurChargement}
    >
      {natures?.length === 0 && <ReferentielVide>Aucune nature de dépense : l'administrateur saisit le référentiel (Budgets et comptabilité, onglet Référentiels).</ReferentielVide>}
      <SectionFormulaire titre="Budget">
        <ChampPage libelle="Début *">
          <input type="date" value={b.debut} onChange={(e) => poser('debut', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Fin *">
          <input type="date" value={b.fin} onChange={(e) => poser('fin', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Nature de dépense *">
          <select value={b.nature} onChange={(e) => poser('nature', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {(natures ?? []).filter((n) => n.actif).map((n) => <option key={n.id} value={n.id}>{n.code} · {n.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Centre (site)">
          <select value={b.site} onChange={(e) => poser('site', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Sans site</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Devise *">
          <input value={b.devise} onChange={(e) => poser('devise', e.target.value.toUpperCase().slice(0, 3))} placeholder="GNF, USD..." className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Montant TTC *">
          <input inputMode="decimal" value={b.montant} onChange={(e) => poser('montant', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        {revision && (
          <ChampPage libelle="Motif de la révision *" className="sm:col-span-2">
            <input value={b.motif} onChange={(e) => poser('motif', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
        )}
        <ChampPage libelle="Note" className="sm:col-span-2">
          <input value={b.note} onChange={(e) => poser('note', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

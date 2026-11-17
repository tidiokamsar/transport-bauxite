import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import { BASES, VUE_RECONCILIATION, bornesMoisCalendaires } from './facturation';
import { erreursOuvertureReconciliation } from './reconciliation';

// Ouverture d'une reconciliation en pleine page (D-029, D-090) :
// ouvrir_reconciliation rapproche les voyages livres du mois. La base de
// tonnage et la tolerance viennent du contrat : aucune valeur par defaut.

const moisPrecedent = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const FormulaireReconciliation = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('invoices', 'create') || hasPermission('invoices', 'edit');
  const [contrats, setContrats] = useState<{ id: string; reference: string; contrepartie: string }[] | null>(null);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie({ contrat: '', mois: moisPrecedent(), base: '', tolerance: '', depart: '', arrivee: '' });

  useEffect(() => {
    Promise.all([
      supabase.from('contrats').select('id, reference, contrepartie').eq('nature', 'client').order('reference'),
      supabase.from('sites').select('id, name').order('name'),
    ]).then(([c, s]) => {
      setErreurChargement(c.error ? `Contrats indisponibles : ${c.error.message}` : '');
      setContrats((c.data ?? []) as { id: string; reference: string; contrepartie: string }[]);
      setSites((s.data ?? []) as { id: string; name: string }[]);
    });
  }, []);

  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur la facturation requis.'] : []), ...erreursOuvertureReconciliation(f)];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { debut, fin } = bornesMoisCalendaires(f.mois);
    const { data, error } = await supabase.rpc('ouvrir_reconciliation', {
      p_contrat_id: f.contrat, p_debut: debut, p_fin: fin, p_base: f.base, p_tolerance: Number(f.tolerance.replace(',', '.')),
      p_site_depart: f.depart || null, p_site_arrivee: f.arrivee || null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Réconciliation ouverte : voyages livrés du mois rapprochés.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_RECONCILIATION, data) : routeListe(VUE_RECONCILIATION) };
  };

  return (
    <PageFormulaire
      vue={VUE_RECONCILIATION}
      module="Réconciliation mensuelle"
      titre="Nouvelle réconciliation"
      description="Les voyages livrés du mois sont rapprochés de leurs tickets CBG et fiches terrain ; chaque ligne à examiner attend une décision motivée avant la clôture."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Ouvrir et rapprocher"
      chargement={contrats === null}
      erreurChargement={erreurChargement}
    >
      {contrats?.length === 0 && <ReferentielVide>Aucun contrat client enregistré : saisissez le contrat CBG (Contrats & Finance → Dossier contractuel).</ReferentielVide>}
      <SectionFormulaire titre="Période et contrat">
        <ChampPage libelle="Contrat client *">
          <select value={f.contrat} onChange={(e) => poser('contrat', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>{(contrats ?? []).map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.contrepartie}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Mois *"><input type="month" value={f.mois} onChange={(e) => poser('mois', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Base de tonnage facturé *">
          <select value={f.base} onChange={(e) => poser('base', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir (selon le contrat)</option>{Object.entries(BASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Tolérance d'écart chargé / reçu (%) *">
          <input inputMode="decimal" value={f.tolerance} onChange={(e) => poser('tolerance', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
      <SectionFormulaire titre="Trajet (facultatif)">
        <ChampPage libelle="Site de départ">
          <select value={f.depart} onChange={(e) => poser('depart', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Tous</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Site d'arrivée">
          <select value={f.arrivee} onChange={(e) => poser('arrivee', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Tous</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

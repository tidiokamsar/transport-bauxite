import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide } from '../ui/Panneau';
import { SANS_SHIFT, SANS_SITE } from '../ui/referentiels';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import { MODULE_POSTES, VUE_POSTES, erreursOuverturePoste } from './postes';

// Ouverture d'un poste en pleine page (D-048, D-090) : ouvrir_poste reprend
// les consignes du dernier poste clos du site (passation). Jamais
// d'identifiant vide envoye au serveur (referentiel vide).

interface Lib { id: string; libelle: string }
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export const FormulairePoste = () => {
  const { hasPermission } = useAuth();
  const peutExploiter = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [shifts, setShifts] = useState<Lib[] | null>(null);
  const [sites, setSites] = useState<Lib[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie({ date: aujourdhui(), shift: '', site: '', consignes: '' });

  useEffect(() => {
    Promise.all([
      supabase.from('work_shifts').select('id, display_name').eq('is_active', true).order('shift_order'),
      supabase.from('sites').select('id, name').order('name'),
    ]).then(([sh, si]) => {
      setErreurChargement(sh.error ? `Shifts indisponibles : ${sh.error.message}` : si.error ? `Sites indisponibles : ${si.error.message}` : '');
      setShifts((sh.data ?? []).map((x) => ({ id: x.id as string, libelle: x.display_name as string })));
      setSites((si.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    });
  }, []);

  const erreurs = [
    ...(!peutExploiter ? ['Droit d\'écriture sur l\'exploitation (voyages) requis.'] : []),
    ...erreursOuverturePoste(f),
  ];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('ouvrir_poste', {
      p_date: f.date, p_shift_id: f.shift, p_site_id: f.site, p_responsable: null, p_consignes: f.consignes.trim() || null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Poste ouvert. Les consignes du poste précédent du site sont reprises.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_POSTES, data) : routeListe(VUE_POSTES) };
  };

  return (
    <PageFormulaire
      vue={VUE_POSTES}
      module={MODULE_POSTES}
      titre="Ouverture de poste"
      description="Le poste reprend les consignes du dernier poste clos du site ; l'équipe, les événements et la clôture se saisissent ensuite depuis sa fiche."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Ouvrir le poste"
      chargement={shifts === null || sites === null}
      erreurChargement={erreurChargement}
    >
      {sites?.length === 0 && <ReferentielVide>{SANS_SITE}</ReferentielVide>}
      {shifts?.length === 0 && <ReferentielVide>{SANS_SHIFT}</ReferentielVide>}
      <SectionFormulaire titre="Poste">
        <ChampPage libelle="Date *">
          <input type="date" value={f.date} onChange={(e) => poser('date', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Shift *">
          <select value={f.shift} onChange={(e) => poser('shift', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {(shifts ?? []).map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Site *">
          <select value={f.site} onChange={(e) => poser('site', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Consignes complémentaires" className="sm:col-span-2">
          <textarea value={f.consignes} onChange={(e) => poser('consignes', e.target.value)} rows={3} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

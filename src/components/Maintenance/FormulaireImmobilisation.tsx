import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import {
  AIDE_IMPUTATION, CAUSES, IMPUTATIONS, MODULE_IMMOBILISATIONS, VUE_IMMOBILISATIONS, erreursDeclaration, versIso, versLocal, type Cause, type Imputation,
} from './immobilisations';

// Declaration d'une immobilisation en pleine page (D-025, D-090) :
// declarer_immobilisation controle la periode, l'absence de chevauchement,
// l'engin (une seule immobilisation ouverte) et journalise.

interface Engin { id: string; registration: string; status: string }

export const ChoixCause = ({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) => (
  <select value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP_FENETRE}>
    <option value="">Choisir</option>
    {(Object.keys(CAUSES) as Cause[]).map((c) => <option key={c} value={c}>{CAUSES[c]}</option>)}
  </select>
);

export const ChoixImputation = ({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) => (
  <select value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP_FENETRE}>
    <option value="">Choisir</option>
    {(Object.keys(IMPUTATIONS) as Imputation[]).map((c) => <option key={c} value={c}>{IMPUTATIONS[c].libelle}</option>)}
  </select>
);

export const FormulaireImmobilisation = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [engins, setEngins] = useState<Engin[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie } = useSaisie({ engin: '', debut: versLocal(new Date()), cause: '', imputation: '', description: '', reference: '' });

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('id, registration, status').order('registration'),
      supabase.from('immobilisations').select('id, vehicle_id, statut').eq('statut', 'ouverte'),
    ]).then(([v, i]) => {
      setErreurChargement(v.error ? `Engins indisponibles : ${v.error.message}` : i.error ? `Immobilisations indisponibles : ${i.error.message}` : '');
      const arretes = new Set(((i.data ?? []) as { vehicle_id: string; statut: string }[]).filter((x) => x.statut === 'ouverte').map((x) => x.vehicle_id));
      setEngins(((v.data ?? []) as Engin[]).filter((e) => e.status !== 'sold' && !arretes.has(e.id)));
    });
  }, []);

  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur la maintenance requis.'] : []), ...erreursDeclaration(f)];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('declarer_immobilisation', {
      p_vehicle_id: f.engin, p_debut: versIso(f.debut), p_cause: f.cause, p_imputation: f.imputation,
      p_description: f.description.trim(), p_reference_loueur: f.reference.trim() || null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Immobilisation déclarée : l\'engin est arrêté.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_IMMOBILISATIONS, data) : routeListe(VUE_IMMOBILISATIONS) };
  };

  return (
    <PageFormulaire
      vue={VUE_IMMOBILISATIONS}
      module={MODULE_IMMOBILISATIONS}
      titre="Déclarer une immobilisation"
      description="Heure réelle de l'arrêt constaté ; la remise en service se saisit ensuite depuis la fiche."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Déclarer"
      chargement={engins === null}
      erreurChargement={erreurChargement}
    >
      {engins?.length === 0 && <ReferentielVide>Aucun engin en service sans immobilisation ouverte : enregistrez les engins (Flotte → Véhicules et engins).</ReferentielVide>}
      <SectionFormulaire titre="Arrêt">
        <ChampPage libelle="Engin *">
          <select value={f.engin} onChange={(e) => poser('engin', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {(engins ?? []).map((e) => <option key={e.id} value={e.id}>{e.registration}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Début (heure réelle de l'arrêt) *">
          <input type="datetime-local" value={f.debut} onChange={(e) => poser('debut', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Cause *"><ChoixCause valeur={f.cause} onChange={(v) => poser('cause', v)} /></ChampPage>
        <ChampPage libelle="Imputation *" aide={AIDE_IMPUTATION}><ChoixImputation valeur={f.imputation} onChange={(v) => poser('imputation', v)} /></ChampPage>
        <ChampPage libelle="Description *" className="sm:col-span-2">
          <input value={f.description} onChange={(e) => poser('description', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Référence d'intervention du loueur">
          <input value={f.reference} onChange={(e) => poser('reference', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

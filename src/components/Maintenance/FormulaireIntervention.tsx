import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { ReferentielVide } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeDetail, routeListe } from '../ui/routeur';
import { versIso, versLocal } from './immobilisations';
import { CANAUX, MODULE_INTERVENTIONS, VUE_INTERVENTIONS, lireNombre } from './interventions';

// Demande d'intervention au loueur en pleine page (D-049, D-090), depuis une
// immobilisation ouverte imputee au loueur ou a imputer :
// demander_intervention_loueur controle l'etat, le perimetre et l'heure.

interface ImmobilisationOuverte { id: string; vehicle_id: string; debut: string; imputation: string; description: string; statut: string }

export const FormulaireIntervention = ({ immobilisationId }: { immobilisationId: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [immobs, setImmobs] = useState<ImmobilisationOuverte[] | null>(null);
  const [engins, setEngins] = useState<Map<string, string>>(new Map());
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie, initialiser } = useSaisie({
    immobilisation: immobilisationId, quand: versLocal(new Date()), canal: 'courriel', reference: '', description: '', delai: '',
  });

  useEffect(() => {
    Promise.all([
      supabase.from('immobilisations').select('id, vehicle_id, debut, imputation, description, statut').eq('statut', 'ouverte').in('imputation', ['loueur', 'a_determiner']).order('debut'),
      supabase.from('v_interventions_loueur').select('id, immobilisation_id, statut'),
      supabase.from('vehicles').select('id, registration'),
    ]).then(([m, i, v]) => {
      setErreurChargement(m.error ? `Immobilisations indisponibles : ${m.error.message}` : i.error ? `Interventions indisponibles : ${i.error.message}` : '');
      const enCours = new Set(((i.data ?? []) as { immobilisation_id: string; statut: string }[]).filter((x) => x.statut !== 'remise_validee').map((x) => x.immobilisation_id));
      const libres = ((m.data ?? []) as ImmobilisationOuverte[]).filter((x) => x.statut === 'ouverte' && x.imputation !== 'exploitant' && !enCours.has(x.id));
      setImmobs(libres);
      setEngins(new Map((v.data ?? []).map((x) => [x.id as string, x.registration as string])));
      const choisie = libres.find((x) => x.id === immobilisationId);
      // Description reprise de l'immobilisation : saisie reelle, modifiable.
      if (choisie) initialiser({ immobilisation: choisie.id, quand: versLocal(new Date()), canal: 'courriel', reference: '', description: choisie.description, delai: '' });
    });
  }, [immobilisationId, initialiser]);

  const delai = lireNombre(f.delai);
  const quand = versIso(f.quand);
  const erreurs = [
    ...(!peutEcrire ? ['Droit d\'écriture sur la maintenance requis.'] : []),
    ...(!f.immobilisation ? ['Immobilisation requise.'] : []),
    ...(!quand ? ['Date et heure de la demande requises.'] : new Date(quand).getTime() > Date.now() ? ['Heure de la demande dans le futur.'] : []),
    ...(!f.description.trim() ? ['Description requise.'] : []),
    ...(delai !== null && !(delai > 0) ? ['Délai contractuel : nombre d\'heures positif.'] : []),
  ];

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('demander_intervention_loueur', {
      p_immobilisation_id: f.immobilisation, p_quand: quand, p_canal: f.canal, p_description: f.description.trim(),
      p_reference: f.reference.trim() || null, p_delai_contractuel_heures: delai,
    });
    if (error) return { erreur: error.message };
    poserAnnonce('Demande d\'intervention enregistrée.');
    return { vers: typeof data === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(data) ? routeDetail(VUE_INTERVENTIONS, data) : routeListe(VUE_INTERVENTIONS) };
  };

  const libelle = (m: ImmobilisationOuverte) => `${engins.get(m.vehicle_id) ?? 'Engin'} · depuis le ${new Date(m.debut).toLocaleString('fr-FR')} · ${m.description}`;

  return (
    <PageFormulaire
      vue={VUE_INTERVENTIONS}
      module={MODULE_INTERVENTIONS}
      titre="Demande d'intervention"
      description="Demande adressée au loueur pour un engin immobilisé ; la prise en charge, la fin et la remise en service se saisissent ensuite depuis la fiche."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre="Enregistrer la demande"
      chargement={immobs === null}
      erreurChargement={erreurChargement}
    >
      {immobs?.length === 0 && <ReferentielVide>Aucune immobilisation ouverte, imputée au loueur ou à imputer, sans intervention en cours (Maintenance → Immobilisations).</ReferentielVide>}
      <SectionFormulaire titre="Demande">
        <ChampPage libelle="Immobilisation *" className="sm:col-span-2">
          <select value={f.immobilisation} onChange={(e) => {
            const m = (immobs ?? []).find((x) => x.id === e.target.value);
            poser('immobilisation', e.target.value);
            if (m && !f.description.trim()) poser('description', m.description);
          }} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {(immobs ?? []).map((m) => <option key={m.id} value={m.id}>{libelle(m)}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Date et heure de la demande *">
          <input type="datetime-local" value={f.quand} onChange={(e) => poser('quand', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Canal *">
          <select value={f.canal} onChange={(e) => poser('canal', e.target.value)} className={CHAMP_FENETRE}>
            {Object.entries(CANAUX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Référence (courrier, ticket)">
          <input value={f.reference} onChange={(e) => poser('reference', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Délai contractuel d'intervention (h)" aide="Selon le contrat de location ; vide si non renseigné.">
          <input inputMode="decimal" value={f.delai} onChange={(e) => poser('delai', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Description *" className="sm:col-span-2">
          <input value={f.description} onChange={(e) => poser('description', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

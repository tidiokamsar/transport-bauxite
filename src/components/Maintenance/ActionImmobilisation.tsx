import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import {
  ACTIONS_IMMOBILISATION, AIDE_IMPUTATION, CAUSES, COLONNES_IMMOBILISATION, MODULE_IMMOBILISATIONS, VUE_IMMOBILISATIONS, actionImmobilisationInterdite,
  versIso, versLocal, type ActionImmobilisation, type ImmobilisationFiche,
} from './immobilisations';
import { ChoixCause, ChoixImputation } from './FormulaireImmobilisation';

// Actions d'une immobilisation en pleine page (D-025, D-090, remplacent
// FenetresImmobilisation) : remise en service (cloturer_immobilisation),
// correction et annulation avec motif obligatoire (corriger_immobilisation,
// annuler_immobilisation ; l'etat precedent reste au journal).

export const ActionImmobilisationVue = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [immo, setImmo] = useState<ImmobilisationFiche | null>(null);
  const [engin, setEngin] = useState('');
  const [interventionEnCours, setInterventionEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [champs, setChamps] = useState({ fin: versLocal(new Date()), note: '', cause: '', imputation: '', debut: '', finCorrigee: '' });
  const poser = (k: keyof typeof champs, v: string) => setChamps((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    Promise.all([
      lire<ImmobilisationFiche>(supabase.from('immobilisations').select(COLONNES_IMMOBILISATION).eq('id', id), 'immobilisation'),
      lire<{ id: string; immobilisation_id: string; statut: string }>(supabase.from('v_interventions_loueur').select('id, immobilisation_id, statut').eq('immobilisation_id', id), 'interventions du loueur'),
    ]).then(async ([r, iv]) => {
      const i = trouver(r.lignes, id);
      setImmo(i);
      setInterventionEnCours((iv.lignes ?? []).some((x) => x.immobilisation_id === id && x.statut !== 'remise_validee'));
      setErreur(r.erreur || iv.erreur || (i ? '' : 'Immobilisation introuvable ou hors de votre périmètre.'));
      if (i) {
        setChamps((c) => ({ ...c, cause: i.cause, imputation: i.imputation, debut: versLocal(new Date(i.debut)), finCorrigee: i.fin ? versLocal(new Date(i.fin)) : '' }));
        const { data } = await supabase.from('vehicles').select('id, registration').eq('id', i.vehicle_id);
        setEngin(((data ?? []) as { id: string; registration: string }[]).find((v) => v.id === i.vehicle_id)?.registration ?? '');
      }
      setChargement(false);
    });
  }, [id]);

  if (!(ACTIONS_IMMOBILISATION as readonly string[]).includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'une immobilisation.`} />;
  }
  const a = action as ActionImmobilisation;
  const reference = immo ? `${engin || 'Engin'} · ${CAUSES[immo.cause] ?? immo.cause} du ${new Date(immo.debut).toLocaleDateString('fr-FR')}` : 'Immobilisation';
  const commun = {
    vue: VUE_IMMOBILISATIONS, module: MODULE_IMMOBILISATIONS, reference, id, chargement, erreurChargement: erreur,
    interdit: immo ? actionImmobilisationInterdite(a, immo.statut, peutEcrire, interventionEnCours) : null,
  };
  const resultat = ({ error }: { error: { message: string } | null }) => (error ? error.message : null);

  if (a === 'cloturer') {
    return (
      <PageAction
        {...commun}
        titre="Remettre en service"
        description="Heure réelle de remise en service ; l'engin redevient disponible pour la planification et le dispatch."
        motif="aucun"
        libelleConfirmer="Clôturer"
        pret={Boolean(versIso(champs.fin))}
        messageSucces="Immobilisation clôturée : engin remis en service."
        onExecuter={async () => resultat(await supabase.rpc('cloturer_immobilisation', { p_id: id, p_fin: versIso(champs.fin), p_note: champs.note.trim() || null }))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampPage libelle="Fin (heure réelle de remise en service) *">
            <input type="datetime-local" value={champs.fin} onChange={(e) => poser('fin', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
          <ChampPage libelle="Note">
            <input value={champs.note} onChange={(e) => poser('note', e.target.value)} className={CHAMP_FENETRE} />
          </ChampPage>
        </div>
      </PageAction>
    );
  }

  if (a === 'corriger') {
    const ouverte = immo?.statut === 'ouverte';
    return (
      <PageAction
        {...commun}
        titre="Corriger l'immobilisation"
        description="La fin d'une immobilisation en cours se saisit par la remise en service. L'état précédent reste au journal de l'immobilisation."
        motif="obligatoire"
        motifMinimum={1}
        libelleConfirmer="Enregistrer la correction"
        pret={Boolean(champs.cause && champs.imputation && versIso(champs.debut) && (ouverte || versIso(champs.finCorrigee)))}
        messageSucces="Correction enregistrée au journal."
        onExecuter={async (motif) => resultat(await supabase.rpc('corriger_immobilisation', {
          p_id: id, p_cause: champs.cause, p_imputation: champs.imputation, p_debut: versIso(champs.debut),
          p_fin: ouverte ? null : versIso(champs.finCorrigee), p_motif: motif,
        }))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampPage libelle="Cause"><ChoixCause valeur={champs.cause} onChange={(v) => poser('cause', v)} /></ChampPage>
          <ChampPage libelle="Imputation" aide={AIDE_IMPUTATION}><ChoixImputation valeur={champs.imputation} onChange={(v) => poser('imputation', v)} /></ChampPage>
          <ChampPage libelle="Début"><input type="datetime-local" value={champs.debut} onChange={(e) => poser('debut', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
          {!ouverte && <ChampPage libelle="Fin"><input type="datetime-local" value={champs.finCorrigee} onChange={(e) => poser('finCorrigee', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>}
        </div>
      </PageAction>
    );
  }

  return (
    <PageAction
      {...commun}
      titre="Annuler l'immobilisation"
      description="Pour une saisie erronée. L'immobilisation reste au journal avec son motif ; l'engin redevient actif si elle était ouverte."
      motif="obligatoire"
      motifMinimum={1}
      danger
      libelleConfirmer="Annuler l'immobilisation"
      messageSucces="Immobilisation annulée (conservée au journal)."
      onExecuter={async (motif) => resultat(await supabase.rpc('annuler_immobilisation', { p_id: id, p_motif: motif }))}
    />
  );
};

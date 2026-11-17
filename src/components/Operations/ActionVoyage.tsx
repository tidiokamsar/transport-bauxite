import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { useRoute } from '../ui/routeur';
import { COLONNES_JOURNAL, SOURCES, STATUTS, estSuspendu, estVerifiable, type LigneJournal } from './journal';
import { VUE_VOYAGES } from './DetailVoyage';
import { EtapeVoyage, RattacherTicket } from './EtapeVoyage';
import { ActionJustification } from './JustificationFiche';

// Actions metier de la fiche operationnelle du voyage (D-088), en pleine
// page : suspension et reprise (fonctions D-087 suspendre_voyage et
// reprendre_voyage, motif obligatoire), verification d'un evenement declare
// (verifier_evenement_voyage : l'auteur d'une saisie ne la verifie pas, le
// verificateur ne valide pas ; la derniere verification connue est envoyee
// pour detecter une modification concurrente).

const ACTIONS = ['suspendre', 'reprendre', 'verifier'];

export const ActionVoyage = ({ id, action }: { id: string; action: string }) => {
  const route = useRoute();
  if (action === 'etape') return <EtapeVoyage id={id} vers={route.requete.vers ?? ''} />;
  if (action === 'ticket') return <RattacherTicket id={id} />;
  if (action === 'justifier-absence' || action === 'retirer-justification') return <ActionJustification id={id} retrait={action === 'retirer-justification'} />;
  return <ActionJournal id={id} action={action} />;
};

const ActionJournal = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const route = useRoute();
  const evenementId = route.requete.evenement ?? '';
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [reference, setReference] = useState('');
  const [journal, setJournal] = useState<LigneJournal[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [statut, setStatut] = useState<'verifie' | 'valide' | 'conteste'>('verifie');

  useEffect(() => {
    Promise.all([
      lire<{ id: string; reference: string }>(supabase.from('trips').select('id, reference').eq('id', id), 'voyage'),
      lire<LigneJournal>(supabase.from('v_journal_voyage').select(COLONNES_JOURNAL).eq('trip_id', id), 'journal du voyage'),
    ]).then(([v, j]) => {
      const voyage = trouver(v.lignes, id);
      setReference(voyage?.reference ?? '');
      setJournal(j.lignes ? j.lignes.filter((l) => l.trip_id === id) : null);
      setErreur(v.erreur || j.erreur || (voyage ? '' : 'Voyage introuvable ou hors de votre périmètre.'));
    });
  }, [id]);

  if (!ACTIONS.includes(action)) {
    return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action du voyage.`} />;
  }
  const chargement = journal === null && !erreur;
  const suspendu = estSuspendu(journal ?? []);
  const evt = (journal ?? []).find((l) => l.id === evenementId) ?? null;
  const commun = { vue: VUE_VOYAGES, module: 'Voyages & Rotations', reference: reference || 'Voyage', id, chargement, erreurChargement: erreur };
  const sansDroit = !peutEcrire ? 'Droit d\'écriture sur les voyages requis.' : null;

  if (action === 'verifier') {
    const interdit = sansDroit ?? (journal && !evt ? 'Événement introuvable sur ce voyage.' : evt && !estVerifiable(evt) ? 'Cet événement ne se vérifie pas (vérification ou ligne annulée).' : null);
    const exigeMotif = statut === 'conteste' || (!!evt?.verification_id && statut !== 'valide');
    return (
      <PageAction
        {...commun}
        titre="Vérifier un événement du voyage"
        description={evt ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-stone-500">Événement</dt><dd className="font-medium">{evt.libelle}</dd>
            <dt className="text-stone-500">Source</dt><dd>{SOURCES[evt.source] ?? evt.source}</dd>
            <dt className="text-stone-500">Statut actuel</dt><dd>{STATUTS[evt.statut]?.libelle ?? evt.statut}</dd>
          </dl>
        ) : null}
        motif={exigeMotif ? 'obligatoire' : 'facultatif'}
        motifMinimum={5}
        libelleConfirmer="Enregistrer la vérification"
        interdit={interdit}
        messageSucces="Vérification enregistrée au journal du voyage."
        onExecuter={async (motif) => {
          const { error } = await supabase.rpc('verifier_evenement_voyage', {
            p_trip_id: id, p_evenement_id: evenementId, p_statut: statut, p_motif: motif || null, p_precedente_id: evt?.verification_id ?? null,
          });
          return error ? error.message : null;
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-stone-700">Décision *</span>
          <select value={statut} onChange={(e) => setStatut(e.target.value as typeof statut)} className={CHAMP_FENETRE}>
            <option value="verifie">Vérifié (conforme aux pièces)</option>
            <option value="valide">Validé (après une vérification par une autre personne)</option>
            <option value="conteste">Contesté (motif obligatoire)</option>
          </select>
        </label>
        <p className="text-xs text-stone-500">L'auteur d'une saisie ne la vérifie pas et le vérificateur ne la valide pas (contrôle serveur). Rien n'est écrasé : chaque décision est une nouvelle ligne.</p>
      </PageAction>
    );
  }

  const suspendre = action === 'suspendre';
  const interdit = sansDroit ?? (journal && suspendre && suspendu ? 'Voyage déjà suspendu.' : journal && !suspendre && !suspendu ? 'Voyage non suspendu : rien à reprendre.' : null);
  return (
    <PageAction
      {...commun}
      titre={suspendre ? `Suspendre le voyage ${reference}`.trim() : `Reprendre le voyage ${reference}`.trim()}
      description={suspendre
        ? 'Le voyage n\'avance plus tant qu\'il n\'est pas repris (sauf annulation). L\'événement est tracé avec son motif.'
        : 'Le voyage peut de nouveau avancer. La reprise cite la suspension levée.'}
      motif="obligatoire"
      libelleConfirmer={suspendre ? 'Suspendre' : 'Reprendre'}
      danger={suspendre}
      interdit={interdit}
      messageSucces={suspendre ? 'Voyage suspendu.' : 'Voyage repris.'}
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc(suspendre ? 'suspendre_voyage' : 'reprendre_voyage', { p_trip_id: id, p_motif: motif });
        return error ? error.message : null;
      }}
    />
  );
};

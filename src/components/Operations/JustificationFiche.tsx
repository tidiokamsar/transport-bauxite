import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { Relation } from '../ui/PageDetail';
import { lire, trouver } from '../ui/lecture';
import { routeAction } from '../ui/routeur';
import { VUE_VOYAGES } from './DetailVoyage';

// Justification de l'absence de fiche terrain (D-088 suite, migration
// 20261121240000) : table append-only justifications_absence_fiche, ecriture
// par justifier_absence_fiche (droit trips, site du voyage, derniere
// justification connue envoyee : 40001 si elle a change). Le controle
// « fiche presente » de controles_voyage en tient compte.

export interface Justification { id: string; statut: string; motif: string; reference_document: string | null; auteur: string; cree_le: string }

const lireJustifications = (tripId: string) =>
  lire<Justification>(supabase.from('justifications_absence_fiche').select('id, statut, motif, reference_document, auteur, cree_le')
    .eq('trip_id', tripId).order('cree_le', { ascending: false }), 'justifications d\'absence de fiche');

/** Historique des justifications dans l'onglet Controles de la fiche du voyage. */
export const JustificationsFiche = ({ tripId, peutEcrire, alerte }: { tripId: string; peutEcrire: boolean; alerte: boolean }) => {
  const [lignes, setLignes] = useState<Justification[] | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => { lireJustifications(tripId).then((r) => { setLignes(r.lignes); setErreur(r.erreur); }); }, [tripId]);
  const enVigueur = lignes?.[0]?.statut === 'justifiee';
  return (
    <div className="space-y-2">
      {peutEcrire && lignes && (alerte || enVigueur) && (
        <a href={routeAction(VUE_VOYAGES, tripId, enVigueur ? 'retirer-justification' : 'justifier-absence')}
          className="inline-block rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100">
          {enVigueur ? 'Retirer la justification' : 'Justifier l\'absence de fiche'}
        </a>
      )}
      <Relation<Justification> titre="Justifications de l'absence de fiche" lignes={lignes} erreur={erreur} vide="Aucune justification enregistrée."
        cle={(j) => j.id}
        colonnes={[
          { libelle: 'Décision', valeur: (j) => (j.statut === 'justifiee' ? 'Absence justifiée' : 'Justification retirée') },
          { libelle: 'Motif', valeur: (j) => j.motif },
          { libelle: 'Document', valeur: (j) => j.reference_document ?? '—' },
          { libelle: 'Le', valeur: (j) => new Date(j.cree_le).toLocaleString('fr-FR') },
        ]}
        note="Append-only : une correction est une nouvelle ligne qui cite la précédente." />
    </div>
  );
};

export const ActionJustification = ({ id, retrait }: { id: string; retrait: boolean }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [reference, setReference] = useState('');
  const [voyage, setVoyage] = useState<{ id: string; reference: string } | null>(null);
  const [derniere, setDerniere] = useState<Justification | null | undefined>(undefined);
  const [document, setDocument] = useState('');
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    Promise.all([lire<{ id: string; reference: string }>(supabase.from('trips').select('id, reference').eq('id', id), 'voyage'), lireJustifications(id)])
      .then(([v, j]) => {
        const t = trouver(v.lignes, id);
        setVoyage(t); setReference(t?.reference ?? '');
        setDerniere(j.lignes ? j.lignes[0] ?? null : undefined);
        setErreur(v.erreur || j.erreur || (t ? '' : 'Voyage introuvable ou hors de votre périmètre.'));
      });
  }, [id]);
  const enVigueur = derniere?.statut === 'justifiee';
  const interdit = !peutEcrire ? 'Droit d\'écriture sur les voyages requis.'
    : derniere !== undefined && retrait && !enVigueur ? 'Aucune justification en vigueur à retirer.'
      : derniere !== undefined && !retrait && enVigueur ? 'Absence déjà justifiée : la retirer avant d\'en donner une autre.' : null;
  return (
    <PageAction vue={VUE_VOYAGES} module="Voyages & Rotations" reference={reference || 'Voyage'} id={id}
      titre={retrait ? `Retirer la justification : ${voyage?.reference ?? ''}`.trim() : `Justifier l'absence de fiche : ${voyage?.reference ?? ''}`.trim()}
      description={retrait ? 'Le contrôle « fiche présente » repasse en alerte. La justification retirée reste au journal.'
        : 'Voyage pesé ou livré sans fiche terrain reliée (fiche perdue, voyage hors fiche...). Le motif et le document sont conservés ; le contrôle passe à « justifié ».'}
      motif="obligatoire" motifMinimum={10} libelleConfirmer={retrait ? 'Retirer la justification' : 'Justifier l\'absence'} danger={retrait}
      chargement={derniere === undefined && !erreur} erreurChargement={erreur} interdit={interdit}
      messageSucces={retrait ? 'Justification retirée.' : 'Absence de fiche justifiée.'}
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc('justifier_absence_fiche', {
          p_trip_id: id, p_statut: retrait ? 'retiree' : 'justifiee', p_motif: motif, p_reference_document: document.trim() || null, p_precedente_id: derniere?.id ?? null,
        });
        return error ? error.message : null;
      }}>
      {!retrait && (
        <ChampPage libelle="Référence du document justificatif" aide="Par exemple le numéro du rapport de perte ou de la note du chef de poste.">
          <input value={document} onChange={(e) => setDocument(e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      )}
    </PageAction>
  );
};

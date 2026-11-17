import { useEffect, useState } from 'react';
import { CheckCircle2, Flag, Wrench, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail } from '../ui/routeur';
import {
  CANAUX, LIBELLE_STATUT_INTERVENTION, MODULE_INTERVENTIONS, TEINTES_INTERVENTION, VUE_INTERVENTIONS, actionInterventionInterdite,
  type ActionIntervention, type StatutIntervention,
} from './interventions';

// Fiche d'une intervention du loueur (D-049, D-090) : demande, prise en
// charge, fin et rapport, pieces remplacees, immobilisation rattachee,
// journal (interventions_journal), actions selon le droit et l'etat.

interface Intervention {
  id: string; numero: string; immobilisation_id: string; vehicle_id: string; statut: StatutIntervention;
  demande_le: string; canal: string; reference_demande: string | null; description: string; delai_contractuel_heures: number | null;
  technicien: string | null; prise_en_charge_le: string | null; fin_le: string | null; rapport: string | null; remise_validee_le: string | null;
  demande_par: string | null; fin_saisie_par: string | null; valide_par: string | null;
  delai_heures: number | null; en_retard: boolean | null; duree_intervention_heures: number | null;
}
interface PieceRemplacee { id: string; intervention_id: string; designation: string; reference: string | null; quantite: number; fournie_par: string }
interface Journal { id: number | string; intervention_id: string; action: string; etat_avant: string | null; etat_apres: string | null; motif: string | null; auteur: string | null; cree_le: string }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const dateHeure = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR') : null);
const ACTIONS_JOURNAL: Record<string, string> = {
  demande: 'Intervention demandée', prise_en_charge: 'Prise en charge', fin: 'Fin d\'intervention saisie',
  remise_refusee: 'Remise en service refusée', remise_validee: 'Remise en service validée',
};

export const DetailIntervention = ({ id }: { id: string }) => {
  const { hasPermission, user } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [intervention, setIntervention] = useState<Lecture<Intervention>>(attente);
  const [pieces, setPieces] = useState<Lecture<PieceRemplacee>>(attente);
  const [journal, setJournal] = useState<Lecture<Journal>>(attente);
  const [engin, setEngin] = useState('');

  useEffect(() => {
    lire<Intervention>(supabase.from('v_interventions_loueur').select('*').eq('id', id), 'intervention').then(async (r) => {
      setIntervention(r);
      const i = trouver(r.lignes, id);
      if (!i) return;
      const { data } = await supabase.from('vehicles').select('id, registration').eq('id', i.vehicle_id);
      setEngin(((data ?? []) as { id: string; registration: string }[]).find((v) => v.id === i.vehicle_id)?.registration ?? '');
    });
    lire<PieceRemplacee>(supabase.from('interventions_pieces').select('id, intervention_id, designation, reference, quantite, fournie_par').eq('intervention_id', id), 'pièces remplacées')
      .then((r) => setPieces({ ...r, lignes: r.lignes && r.lignes.filter((p) => p.intervention_id === id) }));
    lire<Journal>(supabase.from('interventions_journal').select('id, intervention_id, action, etat_avant, etat_apres, motif, auteur, cree_le').eq('intervention_id', id).order('cree_le'), 'journal de l\'intervention')
      .then((r) => setJournal({ ...r, lignes: r.lignes && r.lignes.filter((j) => j.intervention_id === id) }));
  }, [id]);

  const i = trouver(intervention.lignes, id);
  const possible = (a: ActionIntervention) => Boolean(i) && actionInterventionInterdite(a, i?.statut ?? 'remise_validee', peutEcrire, i?.fin_saisie_par ?? null, user?.id ?? null) === null;
  const reference = i ? `${i.numero}${engin ? ` · ${engin}` : ''}` : 'Intervention';

  const historique: EvenementHistorique[] | null = i && journal.lignes ? fusionnerHistoriques(
    journal.lignes.length > 0
      ? journal.lignes.map((j) => ({ id: `interventions_journal-${j.id}`, le: j.cree_le, libelle: ACTIONS_JOURNAL[j.action] ?? j.action, motif: j.motif, auteur: j.auteur, source: 'interventions_journal' }))
      : [
        { id: 'interventions-demande', le: i.demande_le, libelle: 'Intervention demandée', auteur: i.demande_par, source: 'interventions_loueur.demande_le' },
        ...(i.prise_en_charge_le ? [{ id: 'interventions-prise', le: i.prise_en_charge_le, libelle: 'Prise en charge', source: 'interventions_loueur.prise_en_charge_le' }] : []),
        ...(i.fin_le ? [{ id: 'interventions-fin', le: i.fin_le, libelle: 'Fin d\'intervention', auteur: i.fin_saisie_par, source: 'interventions_loueur.fin_le' }] : []),
        ...(i.remise_validee_le ? [{ id: 'interventions-remise', le: i.remise_validee_le, libelle: 'Remise en service validée', auteur: i.valide_par, source: 'interventions_loueur.remise_validee_le' }] : []),
      ],
  ) : null;

  return (
    <PageDetail
      vue={VUE_INTERVENTIONS}
      module={MODULE_INTERVENTIONS}
      reference={reference}
      statut={i ? { libelle: LIBELLE_STATUT_INTERVENTION[i.statut] ?? i.statut, teinte: TEINTES_INTERVENTION[i.statut] ?? 'gris' } : null}
      resume={i && <>{i.description} · demandée le {dateHeure(i.demande_le)}{i.en_retard === true && <> · <Puce teinte="rouge">Délai contractuel dépassé</Puce></>}</>}
      chargement={intervention.lignes === null && !intervention.erreur}
      erreur={intervention.erreur}
      introuvable={intervention.lignes !== null && !i}
      actions={[
        { id: 'prendre', libelle: 'Prise en charge', icone: <Wrench className="h-4 w-4" />, visible: possible('prendre-en-charge'), ton: 'principal', vers: routeAction(VUE_INTERVENTIONS, id, 'prendre-en-charge') },
        { id: 'terminer', libelle: 'Fin d\'intervention', icone: <Flag className="h-4 w-4" />, visible: possible('terminer'), ton: 'principal', vers: routeAction(VUE_INTERVENTIONS, id, 'terminer') },
        { id: 'valider', libelle: 'Valider la remise en service', icone: <CheckCircle2 className="h-4 w-4" />, visible: possible('valider'), ton: 'principal', vers: routeAction(VUE_INTERVENTIONS, id, 'valider') },
        { id: 'refuser', libelle: 'Refuser la remise en service', icone: <XCircle className="h-4 w-4" />, visible: possible('refuser'), ton: 'danger', vers: routeAction(VUE_INTERVENTIONS, id, 'refuser') },
      ]}
      onglets={!i ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-3">
            {i.statut === 'terminee' && i.fin_saisie_par && i.fin_saisie_par === user?.id && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Vous avez saisi la fin de cette intervention : la remise en service est décidée par une autre personne.</p>
            )}
            <Informations groupes={[
              { titre: 'Demande', champs: [
                ['Engin', engin ? <a href={routeDetail('vehicles', i.vehicle_id)} className="text-orange-800 hover:underline">{engin}</a> : null],
                ['Immobilisation', <a key="immo" href={routeDetail('immobilisations', i.immobilisation_id)} className="text-orange-800 hover:underline">Voir la fiche de l'immobilisation</a>],
                ['Demandée le', dateHeure(i.demande_le)], ['Canal', CANAUX[i.canal as keyof typeof CANAUX] ?? i.canal],
                ['Référence', i.reference_demande], ['Description', i.description],
              ] },
              { titre: 'Intervention', champs: [
                ['Délai contractuel', i.delai_contractuel_heures !== null ? `${i.delai_contractuel_heures} h` : null],
                ['Délai de prise en charge', i.delai_heures !== null ? `${i.delai_heures} h${i.prise_en_charge_le ? '' : ' (en cours)'}` : null],
                ['Technicien', i.technicien], ['Prise en charge le', dateHeure(i.prise_en_charge_le)], ['Fin le', dateHeure(i.fin_le)],
                ['Durée', i.duree_intervention_heures !== null ? `${i.duree_intervention_heures} h` : null],
                ['Rapport', i.rapport && <span className="whitespace-pre-line">{i.rapport}</span>], ['Remise validée le', dateHeure(i.remise_validee_le)],
              ] },
            ]} />
          </div>
        ) },
        { id: 'relations', libelle: 'Pièces remplacées', compte: pieces.lignes?.length ?? null, contenu: (
          <Relation titre="Pièces remplacées" lignes={pieces.lignes} erreur={pieces.erreur} cle={(p) => p.id} vide="Aucune pièce déclarée"
            colonnes={[
              { libelle: 'Désignation', valeur: (p) => p.designation },
              { libelle: 'Référence', valeur: (p) => p.reference ?? 'Non renseignée' },
              { libelle: 'Quantité', valeur: (p) => Number(p.quantite).toLocaleString('fr-FR') },
              { libelle: 'Fournie par', valeur: (p) => (p.fournie_par === 'loueur' ? 'Loueur' : 'Exploitant') },
            ]} />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={journal.erreur} source="interventions_journal (demande, prise en charge, fin, décision de remise en service) ; à défaut, horodatages de l'intervention" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="une intervention du loueur" /> },
      ]}
    />
  );
};

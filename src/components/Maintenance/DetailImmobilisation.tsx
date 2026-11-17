import { useEffect, useState } from 'react';
import { Ban, PenLine, Send, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { ecrireRoute, routeAction, routeDetail } from '../ui/routeur';
import {
  CAUSES, COLONNES_IMMOBILISATION, IMPUTATIONS, MODULE_IMMOBILISATIONS, STATUTS_IMMOBILISATION, VUE_IMMOBILISATIONS, actionImmobilisationInterdite, formatDuree,
  heuresDansPeriode, type ActionImmobilisation, type ImmobilisationFiche,
} from './immobilisations';
import { LIBELLE_STATUT_INTERVENTION, VUE_INTERVENTIONS } from './interventions';

// Fiche d'une immobilisation (D-025, D-049, D-090) : arret, imputation,
// interventions du loueur rattachees, journal (immobilisations_journal),
// actions selon le droit et l'etat.

interface Journal { id: string; immobilisation_id: string; action: string; motif: string | null; auteur: string | null; le: string }
interface InterventionResume { id: string; numero: string; immobilisation_id: string; statut: keyof typeof LIBELLE_STATUT_INTERVENTION; demande_le: string; technicien: string | null }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const ACTIONS_JOURNAL: Record<string, string> = { declaration: 'Immobilisation déclarée', cloture: 'Remise en service (clôture)', correction: 'Correction', annulation: 'Annulation' };
const dateHeure = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR') : null);

export const DetailImmobilisation = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('maintenance', 'create') || hasPermission('maintenance', 'edit');
  const [immo, setImmo] = useState<Lecture<ImmobilisationFiche>>(attente);
  const [journal, setJournal] = useState<Lecture<Journal>>(attente);
  const [interventions, setInterventions] = useState<Lecture<InterventionResume>>(attente);
  const [engin, setEngin] = useState('');

  useEffect(() => {
    lire<ImmobilisationFiche>(supabase.from('immobilisations').select(COLONNES_IMMOBILISATION).eq('id', id), 'immobilisation').then(async (r) => {
      setImmo(r);
      const i = trouver(r.lignes, id);
      if (!i) return;
      const { data } = await supabase.from('vehicles').select('id, registration').eq('id', i.vehicle_id);
      setEngin(((data ?? []) as { id: string; registration: string }[]).find((v) => v.id === i.vehicle_id)?.registration ?? '');
    });
    lire<Journal>(supabase.from('immobilisations_journal').select('id, immobilisation_id, action, motif, auteur, le').eq('immobilisation_id', id).order('le'), 'journal de l\'immobilisation')
      .then((r) => setJournal({ ...r, lignes: r.lignes && r.lignes.filter((j) => j.immobilisation_id === id) }));
    lire<InterventionResume>(supabase.from('v_interventions_loueur').select('id, numero, immobilisation_id, statut, demande_le, technicien').eq('immobilisation_id', id).order('demande_le'), 'interventions du loueur')
      .then((r) => setInterventions({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.immobilisation_id === id) }));
  }, [id]);

  const i = trouver(immo.lignes, id);
  const reference = i ? `${engin || 'Engin'} · ${CAUSES[i.cause] ?? i.cause} du ${new Date(i.debut).toLocaleDateString('fr-FR')}` : 'Immobilisation';
  const interventionEnCours = (interventions.lignes ?? []).some((x) => x.statut !== 'remise_validee');
  const possible = (a: ActionImmobilisation) => Boolean(i) && interventions.lignes !== null && actionImmobilisationInterdite(a, i?.statut ?? 'annulee', peutEcrire, interventionEnCours) === null;
  const demandePossible = Boolean(i) && peutEcrire && i?.statut === 'ouverte' && i.imputation !== 'exploitant' && interventions.lignes !== null && !interventionEnCours;

  const historique: EvenementHistorique[] | null = i && journal.lignes ? fusionnerHistoriques(
    journal.lignes.length > 0
      ? journal.lignes.map((j) => ({ id: `immobilisations_journal-${j.id}`, le: j.le, libelle: ACTIONS_JOURNAL[j.action] ?? j.action, motif: j.motif, auteur: j.auteur, source: 'immobilisations_journal' }))
      : [
        { id: 'immobilisations-declare', le: i.declare_le, libelle: 'Immobilisation déclarée', auteur: i.declare_par, source: 'immobilisations.declare_le' },
        ...(i.cloture_le ? [{ id: 'immobilisations-cloture', le: i.cloture_le, libelle: 'Remise en service (clôture)', auteur: i.cloture_par, source: 'immobilisations.cloture_le' }] : []),
      ],
  ) : null;

  return (
    <PageDetail
      vue={VUE_IMMOBILISATIONS}
      module={MODULE_IMMOBILISATIONS}
      reference={reference}
      statut={i ? { libelle: STATUTS_IMMOBILISATION[i.statut]?.libelle ?? i.statut, teinte: STATUTS_IMMOBILISATION[i.statut]?.teinte ?? 'gris' } : null}
      resume={i && <>Depuis le {dateHeure(i.debut)}{i.fin ? ` · fin le ${dateHeure(i.fin)}` : ''} · durée {formatDuree(heuresDansPeriode(i, new Date(0), new Date(8.64e15), new Date()))}</>}
      chargement={immo.lignes === null && !immo.erreur}
      erreur={immo.erreur}
      introuvable={immo.lignes !== null && !i}
      actions={[
        { id: 'demander', libelle: 'Demander l\'intervention du loueur', icone: <Send className="h-4 w-4" />, visible: demandePossible,
          vers: ecrireRoute({ vue: VUE_INTERVENTIONS, mode: 'nouveau', requete: { immobilisation: id } }) },
        { id: 'cloturer', libelle: 'Remettre en service', icone: <Wrench className="h-4 w-4" />, visible: possible('cloturer'), ton: 'principal', vers: routeAction(VUE_IMMOBILISATIONS, id, 'cloturer') },
        { id: 'corriger', libelle: 'Corriger', icone: <PenLine className="h-4 w-4" />, visible: possible('corriger'), vers: routeAction(VUE_IMMOBILISATIONS, id, 'corriger') },
        { id: 'annuler', libelle: 'Annuler', icone: <Ban className="h-4 w-4" />, visible: possible('annuler'), ton: 'danger', vers: routeAction(VUE_IMMOBILISATIONS, id, 'annuler') },
      ]}
      onglets={!i ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-3">
            {interventionEnCours && i.statut === 'ouverte' && (
              <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Intervention du loueur en cours : la remise en service se valide depuis l'intervention (Interventions Neemba).</p>
            )}
            <Informations groupes={[
              { titre: 'Arrêt', champs: [
                ['Engin', engin ? <a href={routeDetail('vehicles', i.vehicle_id)} className="text-orange-800 hover:underline">{engin}</a> : null],
                ['Début', dateHeure(i.debut)], ['Fin', i.fin ? dateHeure(i.fin) : 'en cours'],
                ['Cause', CAUSES[i.cause] ?? i.cause], ['Description', i.description],
              ] },
              { titre: 'Imputation', champs: [
                ['Imputation', <Puce key="imp" teinte={IMPUTATIONS[i.imputation]?.teinte ?? 'gris'}>{IMPUTATIONS[i.imputation]?.libelle ?? i.imputation}</Puce>],
                ['Référence d\'intervention du loueur', i.reference_loueur],
                ['Déclarée le', dateHeure(i.declare_le)], ['Clôturée le', dateHeure(i.cloture_le)],
              ] },
            ]} />
          </div>
        ) },
        { id: 'relations', libelle: 'Interventions du loueur', compte: interventions.lignes?.length ?? null, contenu: (
          <Relation titre="Interventions du loueur" lignes={interventions.lignes} erreur={interventions.erreur} cle={(x) => x.id}
            vide="Aucune intervention demandée au loueur" lien={(x) => routeDetail(VUE_INTERVENTIONS, x.id)}
            colonnes={[
              { libelle: 'Numéro', valeur: (x) => x.numero },
              { libelle: 'Demandée le', valeur: (x) => dateHeure(x.demande_le) },
              { libelle: 'Technicien', valeur: (x) => x.technicien ?? 'Non renseigné' },
              { libelle: 'Statut', valeur: (x) => LIBELLE_STATUT_INTERVENTION[x.statut] ?? x.statut },
            ]}
            note="Les pointages des engins se saisissent sur les fiches terrain (Fiches terrain) ; ils servent au contrôle des factures du loueur." />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={journal.erreur} source="immobilisations_journal (déclaration, clôture, correction, annulation) ; à défaut, horodatages de l'immobilisation" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="une immobilisation" /> },
      ]}
    />
  );
};

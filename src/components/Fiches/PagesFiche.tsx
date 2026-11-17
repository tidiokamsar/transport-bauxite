import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { Historique } from '../ui/Historique';
import { PageAction } from '../ui/PageAction';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { lire, trouver } from '../ui/lecture';
import { poserAnnonce, routeAction, routeDetail } from '../ui/routeur';
import type { EvenementHistorique } from '../ui/evenements';
import {
  ETATS_FICHE, LIBELLES_ACTIONS, VUE_FICHES, actionPermise, actionsFiche, erreursLigneRotation, estActionFiche,
  ligneVersServeur, motifImpressionRequis, type ActionFiche, type LigneRotationSaisie,
} from './cycleFiche';

// Fiche terrain en pages standard (D-090) sur l'API du cycle D-089
// (migration 20261121215000) : fiche detaillee, actions du cycle en pleine
// page, saisie d'une rotation au retour reliee au voyage (D-088). Le
// serveur reste juge de chaque transition, du perimetre et des droits.

interface Fiche {
  id: string; numero: string; type: string; date_fiche: string; site_id: string; shift_id: string | null; vehicle_id: string | null;
  driver_id: string | null; agent: string | null; etat: string; version: number; nb_impressions: number | null; trip_id: string | null;
  prepare_le: string | null; remise_le: string | null; retournee_le: string | null; controle_le: string | null; nb_ecarts: number | null;
}
const COLONNES_FICHE = 'id, numero, type, date_fiche, site_id, shift_id, vehicle_id, driver_id, agent, etat, version, nb_impressions, trip_id, prepare_le, remise_le, retournee_le, controle_le, nb_ecarts';

interface LigneFR { id: string; rang: number; trip_id: string | null; depart_le: string | null; arrivee_le: string | null; km_depart: number | null; km_arrivee: number | null; ticket_cbg: string | null }
interface Ecart { id: string; code: string; gravite: string; libelle: string; attendu: string | null; constate: string | null }
interface Journal { id: string; action: string; etat_avant: string | null; etat_apres: string | null; auteur: string | null; survenu_le: string; motif: string | null }

const MODULE = 'Fiches terrain';
const dt = (v: string | null) => (v ? new Date(v).toLocaleString('fr-FR') : null);

const useFiche = (id: string) => {
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const charger = useCallback(async () => {
    const r = await lire<Fiche>(supabase.from('fiches_terrain').select(COLONNES_FICHE).eq('id', id), 'fiche');
    setFiche(trouver(r.lignes, id));
    setErreur(r.erreur);
    setChargement(false);
  }, [id]);
  useEffect(() => { charger(); }, [charger]);
  return { fiche, erreur, chargement };
};

export const DetailFiche = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const { fiche, erreur, chargement } = useFiche(id);
  const [lignes, setLignes] = useState<LigneFR[] | null>(null);
  const [ecarts, setEcarts] = useState<Ecart[] | null>(null);
  const [journal, setJournal] = useState<EvenementHistorique[] | null>(null);
  const [erreurs, setErreurs] = useState({ lignes: '', ecarts: '', journal: '' });

  useEffect(() => {
    Promise.all([
      lire<LigneFR>(supabase.from('fiches_rotations_lignes').select('id, rang, trip_id, depart_le, arrivee_le, km_depart, km_arrivee, ticket_cbg').eq('fiche_id', id).order('rang'), 'rotations de la fiche'),
      lire<Ecart>(supabase.from('v_fiches_ecarts_courants').select('id, code, gravite, libelle, attendu, constate').eq('fiche_id', id), 'écarts du contrôle'),
      lire<Journal>(supabase.from('fiches_journal').select('id, action, etat_avant, etat_apres, auteur, survenu_le, motif').eq('fiche_id', id), 'journal de la fiche'),
    ]).then(([l, e, j]) => {
      setLignes(l.lignes); setEcarts(e.lignes);
      setJournal(j.lignes ? j.lignes.map((x) => ({
        id: `fj-${x.id}`, le: x.survenu_le, libelle: x.action, auteur: x.auteur, motif: x.motif, source: 'fiches_journal',
        detail: x.etat_apres ? `${ETATS_FICHE[x.etat_avant ?? '']?.libelle ?? x.etat_avant ?? '-'} -> ${ETATS_FICHE[x.etat_apres]?.libelle ?? x.etat_apres}` : null,
      })).sort((a, b) => Date.parse(b.le) - Date.parse(a.le)) : null);
      setErreurs({ lignes: l.erreur, ecarts: e.erreur, journal: j.erreur });
    });
  }, [id]);

  const etat = fiche?.etat ?? '';
  const actions = fiche ? actionsFiche(etat, fiche.type).map((a) => ({
    id: a, libelle: LIBELLES_ACTIONS[a], visible: peutEcrire, vers: routeAction(VUE_FICHES, id, a),
    ton: (a === 'annuler' || a === 'renvoyer' ? 'danger' : a === 'valider' || a === 'saisir-ligne' ? 'principal' : 'secondaire') as 'danger' | 'principal' | 'secondaire',
  })) : [];

  return (
    <PageDetail
      vue={VUE_FICHES} module={MODULE} reference={fiche?.numero ?? 'Fiche'} titre={fiche ? `Fiche ${fiche.numero}` : undefined}
      statut={fiche ? { libelle: ETATS_FICHE[etat]?.libelle ?? etat, teinte: ETATS_FICHE[etat]?.teinte ?? 'gris' } : null}
      resume={fiche ? <>Fiche {fiche.type} du {fiche.date_fiche} · version {fiche.version}</> : null}
      actions={actions} chargement={chargement} erreur={erreur} introuvable={!chargement && !erreur && !fiche}
      onglets={[
        { id: 'informations', libelle: 'Informations', contenu: fiche && (
          <Informations groupes={[
            { titre: 'Fiche', champs: [['Numéro', fiche.numero], ['Type', fiche.type], ['Date d\'opération', fiche.date_fiche], ['Agent', fiche.agent],
              ['Voyage relié', fiche.trip_id ? <a href={routeDetail('trips', fiche.trip_id)} className="text-orange-800 hover:underline">ouvrir le voyage</a> : null]] },
            { titre: 'Cycle', champs: [['Préparée le', dt(fiche.prepare_le)], ['Impressions', fiche.nb_impressions ?? 0], ['Remise le', dt(fiche.remise_le)],
              ['Retournée le', dt(fiche.retournee_le)], ['Contrôlée le', dt(fiche.controle_le)], ['Écarts au dernier contrôle', fiche.nb_ecarts]] },
          ]} />
        ) },
        { id: 'rotations', libelle: 'Rotations', compte: lignes?.length ?? null, contenu: (
          <Relation<LigneFR> titre="Rotations déclarées" lignes={lignes} erreur={erreurs.lignes} vide="Aucune rotation saisie sur cette fiche." cle={(l) => l.id}
            lien={(l) => (l.trip_id ? routeDetail('trips', l.trip_id) : routeDetail(VUE_FICHES, id, 'rotations'))}
            colonnes={[{ libelle: 'Rotation', valeur: (l) => `n° ${l.rang}${l.trip_id ? ' (voyage relié)' : ''}` }, { libelle: 'Départ', valeur: (l) => dt(l.depart_le) ?? '—' },
              { libelle: 'Arrivée', valeur: (l) => dt(l.arrivee_le) ?? '—' }, { libelle: 'Km', valeur: (l) => `${l.km_depart ?? '—'} → ${l.km_arrivee ?? '—'}` },
              { libelle: 'Ticket CBG', valeur: (l) => l.ticket_cbg ?? '—' }]}
            note="Chaque rotation reliée renvoie à la fiche opérationnelle du voyage ; la fiche ne copie pas le voyage." />
        ) },
        { id: 'ecarts', libelle: 'Écarts', compte: ecarts?.length ?? null, contenu: (
          <Relation<Ecart> titre="Écarts du dernier contrôle" lignes={ecarts} erreur={erreurs.ecarts} vide="Aucun écart au dernier contrôle (ou fiche non contrôlée)." cle={(e) => e.id}
            colonnes={[{ libelle: 'Écart', valeur: (e) => e.libelle }, { libelle: 'Gravité', valeur: (e) => e.gravite }, { libelle: 'Attendu', valeur: (e) => e.attendu ?? '—' }, { libelle: 'Constaté', valeur: (e) => e.constate ?? '—' }]} />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: <Historique evenements={journal} erreur={erreurs.journal} source="fiches_journal (append-only, D-089)" /> },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="les fiches terrain" /> },
      ]}
    />
  );
};

const VIDE: LigneRotationSaisie = { rang: '1', trip_id: '', depart_le: '', arrivee_le: '', km_depart: '', km_arrivee: '', ticket_cbg: '', observations: '', incidents: '', motif: '' };

const SaisieLigne = ({ fiche }: { fiche: Fiche }) => {
  const { valeurs, poser, modifie } = useSaisie(VIDE);
  const [voyages, setVoyages] = useState<{ id: string; reference: string; vehicle_id: string | null }[]>([]);
  const [existants, setExistants] = useState<number[]>([]);
  useEffect(() => {
    supabase.from('trips').select('id, reference, vehicle_id').eq('planned_date', fiche.date_fiche).order('reference')
      .then(({ data }) => setVoyages(((data ?? []) as { id: string; reference: string; vehicle_id: string | null }[]).filter((v) => !fiche.vehicle_id || v.vehicle_id === fiche.vehicle_id)));
    supabase.from('fiches_rotations_lignes').select('rang').eq('fiche_id', fiche.id)
      .then(({ data }) => setExistants(((data ?? []) as { rang: number }[]).map((r) => r.rang)));
  }, [fiche]);
  const correction = existants.includes(Number(valeurs.rang));
  const erreurs = erreursLigneRotation(valeurs, correction);
  const champ = (cle: keyof LigneRotationSaisie, libelle: string, type = 'text') => (
    <ChampPage libelle={libelle} erreur={erreurs[cle]}>
      <input type={type} value={valeurs[cle]} onChange={(e) => poser(cle, e.target.value)} className={CHAMP_FENETRE} />
    </ChampPage>
  );
  return (
    <PageFormulaire vue={VUE_FICHES} module={MODULE} titre={`Saisir une rotation de la fiche ${fiche.numero}`} reference={fiche.numero} id={fiche.id}
      description="Saisie au retour de la fiche papier. Une ligne déjà saisie se corrige avec un motif (journal de la fiche) ; rien n'est écrasé sans trace."
      modifie={modifie} erreurs={Object.values(erreurs)} libelleSoumettre={correction ? 'Corriger la rotation' : 'Enregistrer la rotation'}
      onSoumettre={async () => {
        const { error } = await supabase.rpc('saisir_ligne_rotation', {
          p_fiche_id: fiche.id, p_rang: Number(valeurs.rang), p_ligne: ligneVersServeur(valeurs), p_motif_correction: correction ? valeurs.motif.trim() : null,
        });
        if (error) return { erreur: error.message };
        poserAnnonce('Rotation enregistrée.');
        return { vers: routeDetail(VUE_FICHES, fiche.id, 'rotations') };
      }}>
      <SectionFormulaire titre="Rotation">
        {champ('rang', 'Numéro de rotation *', 'number')}
        <ChampPage libelle="Voyage relié" aide="Voyages du jour de la fiche, pour ce camion. Sans voyage : la rotation reste déclarée, à rapprocher au contrôle.">
          <select value={valeurs.trip_id} onChange={(e) => poser('trip_id', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Aucun</option>
            {voyages.map((v) => <option key={v.id} value={v.id}>{v.reference}</option>)}
          </select>
        </ChampPage>
        {champ('depart_le', 'Départ', 'datetime-local')}
        {champ('arrivee_le', 'Arrivée', 'datetime-local')}
        {champ('km_depart', 'Compteur au départ (km)')}
        {champ('km_arrivee', 'Compteur à l\'arrivée (km)')}
        {champ('ticket_cbg', 'Numéro du ticket CBG observé')}
        {champ('observations', 'Observations')}
        {champ('incidents', 'Incidents')}
        {correction && champ('motif', 'Motif de correction *')}
      </SectionFormulaire>
    </PageFormulaire>
  );
};

export const ActionFichePage = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const { fiche, erreur, chargement } = useFiche(id);
  const [agent, setAgent] = useState('');
  const [etatRetour, setEtatRetour] = useState('complete');
  if (!estActionFiche(action)) return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action du cycle des fiches.`} />;
  const a: ActionFiche = action;
  if (a === 'saisir-ligne' && fiche && peutEcrire && actionPermise(a, fiche.etat, fiche.type)) return <SaisieLigne fiche={fiche} />;
  const interdit = !peutEcrire ? 'Droit d\'écriture requis.'
    : fiche && !actionPermise(a, fiche.etat, fiche.type) ? `Action impossible à l'état « ${ETATS_FICHE[fiche.etat]?.libelle ?? fiche.etat} ».` : null;
  const motif = a === 'annuler' || a === 'renvoyer' || (a === 'imprimer' && motifImpressionRequis(fiche?.nb_impressions)) ? 'obligatoire'
    : a === 'valider' ? 'facultatif' : 'aucun';
  const executer = async (m: string): Promise<string | null> => {
    if (!fiche) return 'Fiche non chargée';
    const appels: Record<ActionFiche, () => PromiseLike<{ error: { message: string } | null }>> = {
      imprimer: () => supabase.rpc('enregistrer_impression_fiches', { p_ids: [id], p_motif: m || null }),
      remettre: () => supabase.rpc('remettre_fiches', { p_ids: [id], p_agent: agent.trim() }),
      retour: () => supabase.rpc('enregistrer_retour_fiches', { p_agent: agent.trim(), p_details: [{ fiche_id: id, etat_retour: etatRetour }] }),
      'saisir-ligne': async () => ({ error: { message: 'Saisie non permise' } }),
      'terminer-saisie': () => supabase.rpc('changer_etat_fiche', { p_id: id, p_vers: 'saisie_terminee', p_motif: null, p_version: fiche.version }),
      soumettre: () => supabase.rpc('soumettre_fiche_controle', { p_id: id, p_version: fiche.version }),
      controler: () => supabase.rpc('controler_fiche', { p_id: id }),
      renvoyer: () => supabase.rpc('renvoyer_fiche_correction', { p_id: id, p_motif: m }),
      valider: () => supabase.rpc('valider_fiche', { p_id: id, p_motif: m || null, p_version: fiche.version }),
      archiver: () => supabase.rpc('archiver_fiche', { p_id: id }),
      annuler: () => supabase.rpc('annuler_fiche', { p_id: id, p_motif: m }),
    };
    const { error } = await appels[a]();
    return error ? error.message : null;
  };
  const avecAgent = a === 'remettre' || a === 'retour';
  return (
    <PageAction vue={VUE_FICHES} module={MODULE} reference={fiche?.numero ?? 'Fiche'} id={id} titre={`${LIBELLES_ACTIONS[a]}${fiche ? ` : ${fiche.numero}` : ''}`}
      description={a === 'valider' ? 'La validation est faite par une autre personne que la saisie (contrôle serveur). Une fiche validée est figée.'
        : a === 'controler' ? 'Le contrôle compare la fiche au voyage, au ticket et aux compteurs ; les écarts sont numérotés par contrôle.' : undefined}
      motif={motif} libelleConfirmer={LIBELLES_ACTIONS[a]} danger={a === 'annuler' || a === 'renvoyer'} interdit={interdit}
      chargement={chargement} erreurChargement={erreur || (!chargement && !fiche ? 'Fiche introuvable ou hors de votre périmètre.' : '')}
      pret={!avecAgent || agent.trim().length > 0} messageSucces={`${LIBELLES_ACTIONS[a]} : enregistré.`} onExecuter={executer}>
      {avecAgent && (
        <ChampPage libelle={a === 'remettre' ? 'Agent qui reçoit les fiches *' : 'Agent qui rend les fiches *'}>
          <input value={agent} onChange={(e) => setAgent(e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
      )}
      {a === 'retour' && (
        <ChampPage libelle="État de la fiche au retour">
          <select value={etatRetour} onChange={(e) => setEtatRetour(e.target.value)} className={CHAMP_FENETRE}>
            <option value="complete">Complète</option><option value="incomplete">Incomplète</option>
            <option value="abimee">Abîmée</option><option value="manquante">Manquante (reste chez l'agent)</option>
          </select>
        </ChampPage>
      )}
    </PageAction>
  );
};

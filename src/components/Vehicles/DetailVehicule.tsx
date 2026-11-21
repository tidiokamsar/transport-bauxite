import { useEffect, useState } from 'react';
import { Ban, Edit2, FileSignature, RotateCcw, Archive, Scale } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { TareEngin } from './TareEngin';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { routeAction, routeDetail, routeModifier } from '../ui/routeur';
import type { Vehicle } from '../../types/vehicle';
import {
  COLONNES_VEHICULE, TYPES_DOCUMENT, TYPES_VEHICULE, VUE_VEHICULES, actionsStatut, etatEcheance, libellePropriete, libelleStatut,
  resumeCoutCarburant, type StatutOperationnel,
} from './flotte';

// Fiche d'un engin en pleine page (D-062, D-090 ; remplace FicheVehicule
// en fenetre) : informations et synthese consolidee, relations (voyages,
// immobilisations, pleins, controles, documents), historique (journal de la
// flotte et immobilisations), actions selon droits et statut. Un bloc hors
// des droits de l'utilisateur reste « non visible », jamais vide.

interface Synthese {
  immobilisations: number | null; heures_immobilisation: number | null; immobilisation_ouverte_depuis: string | null;
  interventions_loueur: number | null; interventions_actives: number | null; pneus_montes: number;
  pleins: number | null; litres: number | null; dernier_plein: string | null; cout_carburant_connu: number | null;
  litres_sans_prix: number | null; dernier_controle_le: string | null; dernier_controle_resultat: string | null;
  documents_a_renouveler: number;
}
interface Journal { id: string; action: string; motif: string | null; le: string; auteur: string | null; apres: Record<string, unknown> | null }
interface Immobilisation { id: string; debut: string; fin: string | null; cause: string; imputation: string; statut: string }
interface Plein { id: string; transaction_date: string; reference: string; volume_liters: number; total_cost: number | null }
interface Controle { id: string; effectue_le: string; resultat: string }
interface Voyage { id: string; reference: string; planned_date: string | null; etat: string | null }
interface Document { id: string; document_type: string; reference_number: string | null; expiry_date: string | null; status: string | null }

const ACTIONS_JOURNAL: Record<string, string> = {
  propriete: 'Propriété renseignée', suspension: 'Suspension', remise_en_service: 'Remise en service', reforme: 'Réforme',
};
const date = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('fr-FR') : '—');
const nv = <T,>(v: T | null, f: (x: T) => string) => (v === null ? 'Non visible avec vos droits' : f(v));
const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });

export const DetailVehicule = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const { sites } = useSite();
  const [vehicule, setVehicule] = useState<Lecture<Vehicle>>(attente);
  const [synthese, setSynthese] = useState<Lecture<Synthese>>(attente);
  const [journal, setJournal] = useState<Lecture<Journal>>(attente);
  const [immos, setImmos] = useState<Lecture<Immobilisation>>(attente);
  const [pleins, setPleins] = useState<Lecture<Plein>>(attente);
  const [controles, setControles] = useState<Lecture<Controle>>(attente);
  const [voyages, setVoyages] = useState<Lecture<Voyage>>(attente);
  const [documents, setDocuments] = useState<Lecture<Document>>(attente);
  const [heure, setHeure] = useState<Date | null>(null);

  useEffect(() => {
    lire<Vehicle>(supabase.from('v_vehicules').select(COLONNES_VEHICULE).eq('id', id), 'engin').then(setVehicule);
    lire<Synthese & { vehicle_id: string }>(supabase.from('v_fiche_vehicule').select('*').eq('vehicle_id', id), 'synthèse').then((r) => {
      setSynthese({ lignes: r.lignes && r.lignes.filter((s) => s.vehicle_id === id), erreur: r.erreur });
      setHeure(new Date());
    });
    lire<Journal>(supabase.from('journal_flotte').select('id, action, motif, le, auteur, apres').eq('vehicle_id', id).order('le', { ascending: false }), 'journal de la flotte').then(setJournal);
    lire<Immobilisation>(supabase.from('immobilisations').select('id, debut, fin, cause, imputation, statut').eq('vehicle_id', id).order('debut', { ascending: false }).limit(20), 'immobilisations').then(setImmos);
    lire<Plein>(supabase.from('fuel_transactions').select('id, transaction_date, reference, volume_liters, total_cost').eq('vehicle_id', id).order('transaction_date', { ascending: false }).limit(20), 'pleins').then(setPleins);
    lire<Controle>(supabase.from('controles_depart').select('id, effectue_le, resultat').eq('vehicle_id', id).order('effectue_le', { ascending: false }).limit(10), 'contrôles avant départ').then(setControles);
    lire<Voyage>(supabase.from('trips').select('id, reference, planned_date, etat').eq('vehicle_id', id).order('planned_date', { ascending: false }).limit(20), 'voyages').then(setVoyages);
    lire<Document>(supabase.from('vehicle_documents').select('id, document_type, reference_number, expiry_date, status').eq('vehicle_id', id).order('expiry_date', { ascending: true }), 'documents').then(setDocuments);
  }, [id]);

  const v = trouver(vehicule.lignes, id);
  const s = synthese.lignes?.[0] ?? null;
  const statut = (v?.statut_operationnel ?? 'disponible') as StatutOperationnel;
  const permis = actionsStatut(statut);
  const peutEcrire = hasPermission('vehicles', 'edit');
  const reforme = statut === 'reforme';
  const st = v ? libelleStatut(v.statut_operationnel) : null;
  const aujourdhui = new Date();

  const historique: EvenementHistorique[] | null = journal.lignes && fusionnerHistoriques(
    journal.lignes.map((j) => ({
      id: `journal_flotte-${j.id}`, le: j.le, libelle: ACTIONS_JOURNAL[j.action] ?? j.action, motif: j.motif, auteur: j.auteur, source: 'journal_flotte',
      detail: j.action === 'propriete' && j.apres ? `${libellePropriete(j.apres.propriete as string | null)}${j.apres.proprietaire ? ` · ${j.apres.proprietaire as string}` : ''}` : null,
    })),
    (immos.lignes ?? []).flatMap((i) => [
      { id: `immobilisations-${i.id}-debut`, le: i.debut, libelle: 'Immobilisation déclarée', detail: `${i.cause} · imputation ${i.imputation}`, source: 'immobilisations' },
      ...(i.fin ? [{ id: `immobilisations-${i.id}-fin`, le: i.fin, libelle: 'Fin d\'immobilisation', detail: i.cause, source: 'immobilisations' }] : []),
    ]),
  );

  return (
    <PageDetail
      vue={VUE_VEHICULES}
      module="Véhicules et engins"
      reference={v?.registration ?? 'Engin'}
      statut={st}
      resume={v && <>
        <p>{v.brand_model} · {TYPES_VEHICULE[v.vehicle_type] ?? v.vehicle_type} · {v.capacity_tonnes} t{v.year ? ` · ${v.year}` : ''}</p>
        {v.statut_admin_motif && <p className="text-stone-600">Motif : {v.statut_admin_motif} (depuis le {date(v.statut_admin_depuis)})</p>}
        {v.voyage_en_cours && <p className="text-stone-600">Voyage engagé : {v.voyage_en_cours}</p>}
      </>}
      chargement={vehicule.lignes === null && !vehicule.erreur}
      erreur={vehicule.erreur}
      introuvable={vehicule.lignes !== null && !v}
      actions={[
        { id: 'modifier', libelle: 'Modifier', icone: <Edit2 className="h-4 w-4" />, visible: peutEcrire && !reforme, ton: 'principal', vers: routeModifier(VUE_VEHICULES, id) },
        { id: 'tare', libelle: 'Tare de référence', icone: <Scale className="h-4 w-4" />, visible: peutEcrire && !reforme, vers: routeDetail(VUE_VEHICULES, id, 'tare') },
        { id: 'propriete', libelle: v?.propriete ? 'Modifier la propriété' : 'Renseigner la propriété', icone: <FileSignature className="h-4 w-4" />, visible: peutEcrire && !reforme, vers: routeAction(VUE_VEHICULES, id, 'propriete') },
        { id: 'suspendre', libelle: 'Suspendre', icone: <Ban className="h-4 w-4" />, visible: peutEcrire && permis.suspendre, vers: routeAction(VUE_VEHICULES, id, 'suspendre') },
        { id: 'remettre', libelle: 'Remettre en service', icone: <RotateCcw className="h-4 w-4" />, visible: peutEcrire && permis.remettre, vers: routeAction(VUE_VEHICULES, id, 'remettre-en-service') },
        { id: 'reformer', libelle: 'Réformer', icone: <Archive className="h-4 w-4" />, visible: peutEcrire && permis.reformer, ton: 'danger', vers: routeAction(VUE_VEHICULES, id, 'reformer') },
      ]}
      onglets={!v ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-4">
            <Informations groupes={[
              { titre: 'Identification', champs: [['Immatriculation', v.registration], ['Marque et modèle', v.brand_model], ['Type', TYPES_VEHICULE[v.vehicle_type] ?? v.vehicle_type],
                ['Capacité', `${v.capacity_tonnes} t`], ['Année', v.year], ['Châssis', v.chassis_number],
                ['Site', v.site_id ? sites.find((x) => x.id === v.site_id)?.name ?? 'Site non visible' : 'Global']] },
              { titre: 'Propriété et contrat', champs: [['Propriété', libellePropriete(v.propriete)], ['Propriétaire / loueur', v.proprietaire], ['Exploitant', v.exploitant],
                ['Transporteur', v.transporteur], ['Contrat', v.contrat_id ? v.contrat_reference ?? 'Rattaché (non visible)' : null]] },
              { titre: 'Échéances', champs: [['Assurance', v.insurance_expiry ? <>{date(v.insurance_expiry)} <Puce teinte={etatEcheance(v.insurance_expiry, aujourdhui).teinte}>{etatEcheance(v.insurance_expiry, aujourdhui).texte}</Puce></> : null],
                ['Visite technique', v.technical_inspection_expiry ? <>{date(v.technical_inspection_expiry)} <Puce teinte={etatEcheance(v.technical_inspection_expiry, aujourdhui).teinte}>{etatEcheance(v.technical_inspection_expiry, aujourdhui).texte}</Puce></> : null]] },
              { titre: 'Statut administratif', champs: [['Statut opérationnel', st?.libelle], ['Décision', v.statut_admin], ['Depuis', v.statut_admin_depuis ? date(v.statut_admin_depuis) : null], ['Motif', v.statut_admin_motif]] },
            ]} />
            <section aria-label="Synthèse de l'engin" className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
              <h2 className="mb-3 font-bold text-stone-900">Synthèse consolidée</h2>
              {synthese.erreur ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{synthese.erreur}</p> : !s ? <SansDonnees message="Synthèse indisponible" /> : (
                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="text-stone-500">Immobilisations</dt><dd className="font-semibold">{nv(s.immobilisations, (n) => `${n} · ${formatNombre(Number(s.heures_immobilisation ?? 0))} h`)}</dd>
                    {s.immobilisation_ouverte_depuis && <dd className="text-xs text-red-700">Ouverte depuis le {date(s.immobilisation_ouverte_depuis)}</dd>}</div>
                  <div><dt className="text-stone-500">Interventions Neemba</dt><dd className="font-semibold">{nv(s.interventions_loueur, (n) => `${n} dont ${s.interventions_actives ?? 0} en cours`)}</dd></div>
                  <div><dt className="text-stone-500">Pneus montés</dt><dd className="font-semibold">{s.pneus_montes}</dd></div>
                  <div><dt className="text-stone-500">Documents à renouveler</dt><dd className="font-semibold">{s.documents_a_renouveler}</dd></div>
                  <div><dt className="text-stone-500">Pleins</dt><dd className="font-semibold">{nv(s.pleins, (n) => `${n} · ${formatNombre(Number(s.litres ?? 0))} L`)}</dd>
                    {s.dernier_plein && <dd className="text-xs text-stone-500">Dernier le {date(s.dernier_plein)}</dd>}</div>
                  <div className="sm:col-span-2"><dt className="text-stone-500">Coût carburant connu</dt><dd className="font-semibold">{resumeCoutCarburant(s.cout_carburant_connu, s.litres_sans_prix, (n) => formatNombre(n))}</dd></div>
                  <div><dt className="text-stone-500">Dernier contrôle avant départ</dt><dd className="font-semibold">{s.dernier_controle_le ? `${date(s.dernier_controle_le)} · ${s.dernier_controle_resultat}` : 'Aucun'}</dd></div>
                </dl>
              )}
              <Provenance source="cumul depuis la première saisie (v_fiche_vehicule : immobilisations, interventions, pneus, pleins, contrôles, documents)" heure={heure} />
            </section>
          </div>
        ) },
        { id: 'tare', libelle: 'Tare de référence', contenu: <TareEngin vehicleId={id} peutEcrire={peutEcrire} /> },
        { id: 'relations', libelle: 'Relations', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Derniers voyages" lignes={voyages.lignes} erreur={voyages.erreur} cle={(x) => x.id} vide="Aucun voyage"
              note="Les 20 plus récents ; la fiche d'un voyage s'ouvre depuis Voyages & Rotations."
              colonnes={[{ libelle: 'Voyage', valeur: (x) => x.reference }, { libelle: 'Date prévue', valeur: (x) => date(x.planned_date) }, { libelle: 'État', valeur: (x) => x.etat ?? '—' }]} />
            <Relation titre="Documents" lignes={documents.lignes} erreur={documents.erreur} cle={(x) => x.id} vide="Aucun document enregistré"
              note="Saisie et archivage dans Flotte → Documents."
              colonnes={[{ libelle: 'Document', valeur: (x) => TYPES_DOCUMENT[x.document_type] ?? x.document_type }, { libelle: 'Référence', valeur: (x) => x.reference_number ?? '—' },
                { libelle: 'Échéance', valeur: (x) => { const e = etatEcheance(x.expiry_date, aujourdhui, x.status === 'archived'); return <><span className="mr-2">{date(x.expiry_date)}</span><Puce teinte={e.teinte}>{e.texte}</Puce></>; } }]} />
            <Relation titre="Immobilisations" lignes={immos.lignes} erreur={immos.erreur} cle={(x) => x.id} vide="Aucune immobilisation"
              colonnes={[{ libelle: 'Début', valeur: (x) => date(x.debut) }, { libelle: 'Fin', valeur: (x) => (x.fin ? date(x.fin) : 'en cours') },
                { libelle: 'Cause', valeur: (x) => x.cause }, { libelle: 'Imputation', valeur: (x) => x.imputation }, { libelle: 'Statut', valeur: (x) => x.statut }]} />
            <Relation titre="Pleins" lignes={pleins.lignes} erreur={pleins.erreur} cle={(x) => x.id} vide="Aucun plein"
              colonnes={[{ libelle: 'Date', valeur: (x) => date(x.transaction_date) }, { libelle: 'Référence', valeur: (x) => <span className="font-mono text-xs">{x.reference}</span> },
                { libelle: 'Volume', valeur: (x) => `${formatNombre(Number(x.volume_liters))} L` }, { libelle: 'Coût', valeur: (x) => (x.total_cost === null ? 'prix non connu' : formatNombre(Number(x.total_cost))) }]} />
            <Relation titre="Contrôles avant départ" lignes={controles.lignes} erreur={controles.erreur} cle={(x) => x.id} vide="Aucun contrôle"
              colonnes={[{ libelle: 'Effectué le', valeur: (x) => new Date(x.effectue_le).toLocaleString('fr-FR') }, { libelle: 'Résultat', valeur: (x) => x.resultat }]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={journal.erreur} source="journal_flotte (propriété, suspension, remise en service, réforme) et immobilisations" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un engin" /> },
      ]}
    />
  );
};

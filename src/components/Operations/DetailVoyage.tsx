import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation, type ActionPage } from '../ui/PageDetail';
import { Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { lire, trouver } from '../ui/lecture';
import { routeAction, routeDetail, useRoute } from '../ui/routeur';
import { ETATS, LIVRES_SANS_TICKET, PHASES, actionsPossibles, estEtat, phaseDe } from '../Trips/cycle';
import { VoyageSuivant } from '../Trips/VoyageSuivant';
import { ListePieces } from '../ui/PiecesJointes';
import { formatNombre } from '../Dashboard/indicateurs';
import { IncidentVoyage } from '../Trips/IncidentVoyage';
import { COLONNES_VOYAGE, type Voyage } from '../Trips/types';
import {
  COLONNES_JOURNAL, FAMILLES, RESULTATS, SOURCES, STATUTS, avecContexte, contexteDepuisRequete, deFamille, estSuspendu,
  estVerifiable, fichesDuJournal, historiqueDepuisJournal, syntheseControles, trierChronologie, type Controle, type LigneJournal,
} from './journal';

// Fiche operationnelle du voyage (D-088) : route #/trips/<id>, ouverte depuis
// Dispatch, Voyages & Rotations, Fiches terrain et le journal des operations.
// Tout est lu dans les tables sources par la vue v_journal_voyage (droits et
// perimetre du lecteur) et par controles_voyage ; aucune copie du voyage.

export const VUE_VOYAGES = 'trips';

export type VoyageDetail = Voyage & { km_start?: number | null; km_end?: number | null; shift_sequence?: number | null; estimated_distance_km?: number | null };

interface Nom { id: string; libelle: string }

const dt = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('fr-FR') : null);
const num = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('fr-FR') : typeof v === 'string' && v !== '' ? v : '—');

export const StatutEvt = ({ statut }: { statut: string }) => {
  const s = STATUTS[statut];
  return <Puce teinte={s?.teinte ?? 'gris'}>{s?.libelle ?? statut}</Puce>;
};

/** Tableau d'evenements du journal ; lien de verification si permis. */
export const TableJournal = ({ lignes, vide, verifier }: { lignes: LigneJournal[] | null; vide: string; verifier?: (l: LigneJournal) => string | null }) => (
  <Relation<LigneJournal>
    titre="Événements"
    lignes={lignes}
    vide={vide}
    cle={(l) => l.id}
    colonnes={[
      { libelle: 'Événement', valeur: (l) => <span className={l.annule ? 'line-through' : ''}>{l.libelle}</span> },
      { libelle: 'Opération', valeur: (l) => dt(l.date_operation) ?? 'Non renseignée' },
      { libelle: 'Saisie', valeur: (l) => dt(l.date_saisie) },
      { libelle: 'Source', valeur: (l) => SOURCES[l.source] ?? l.source },
      { libelle: 'Justificatif', valeur: (l) => l.justificatif ?? '—' },
      { libelle: 'Statut', valeur: (l) => <StatutEvt statut={l.statut} /> },
      { libelle: 'Corrige', valeur: (l) => (l.corrige_ref ? <code className="text-xs">{l.corrige_ref.split(':')[0]}</code> : '—') },
      { libelle: 'Action', valeur: (l) => { const v = verifier?.(l); return v ? <a href={v} className="text-orange-800 hover:underline">Vérifier</a> : '—'; } },
    ]}
    note="Journal unifié (vue v_journal_voyage) : chaque ligne vient de sa table d'origine, sans recopie. Une correction est une nouvelle ligne qui cite la précédente."
  />
);

export const DetailVoyage = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const route = useRoute();
  const contexte = contexteDepuisRequete(route.requete);
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const [voyage, setVoyage] = useState<VoyageDetail | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [journal, setJournal] = useState<LigneJournal[] | null>(null);
  const [erreurJournal, setErreurJournal] = useState('');
  const [controles, setControles] = useState<Controle[] | null>(null);
  const [erreurControles, setErreurControles] = useState('');
  const [noms, setNoms] = useState<{ vehicule: Nom[]; chauffeur: Nom[]; site: Nom[]; shift: Nom[] }>({ vehicule: [], chauffeur: [], site: [], shift: [] });
  const [ticket, setTicket] = useState<{ id: string; ticket: string; net: number } | null | undefined>(undefined);
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const r = await lire<VoyageDetail>(supabase.from('trips').select(`${COLONNES_VOYAGE}, km_start, km_end, shift_sequence, estimated_distance_km`).eq('id', id), 'voyage');
    const v = trouver(r.lignes, id);
    setVoyage(v);
    setErreur(r.erreur);
    setChargement(false);
    const j = await lire<LigneJournal>(supabase.from('v_journal_voyage').select(COLONNES_JOURNAL).eq('trip_id', id), 'journal du voyage');
    setJournal(j.lignes ? trierChronologie(j.lignes.filter((l) => l.trip_id === id)) : null);
    setErreurJournal(j.erreur);
    const tk = await supabase.from('v_tickets_pesee_cbg_effectifs').select('id, ticket, net').eq('trip_id', id).maybeSingle();
    setTicket(tk.error ? undefined : tk.data ? { id: tk.data.id as string, ticket: tk.data.ticket as string, net: Number(tk.data.net) } : null);
    const c = await supabase.rpc('controles_voyage', { p_trip_id: id });
    setControles(c.error ? null : ((c.data ?? []) as Controle[]));
    setErreurControles(c.error ? `Contrôles indisponibles : ${c.error.message}` : '');
    setHeure(new Date());
  }, [id]);

  useEffect(() => {
    charger();
    Promise.all([
      supabase.from('vehicles').select('id, registration'),
      supabase.from('drivers').select('id, name'),
      supabase.from('sites').select('id, name'),
      supabase.from('work_shifts').select('id, display_name'),
    ]).then(([v, d, s, w]) => setNoms({
      vehicule: ((v.data ?? []) as { id: string; registration: string }[]).map((x) => ({ id: x.id, libelle: x.registration })),
      chauffeur: ((d.data ?? []) as { id: string; name: string }[]).map((x) => ({ id: x.id, libelle: x.name })),
      site: ((s.data ?? []) as { id: string; name: string }[]).map((x) => ({ id: x.id, libelle: x.name })),
      shift: ((w.data ?? []) as { id: string; display_name: string }[]).map((x) => ({ id: x.id, libelle: x.display_name })),
    }));
  }, [charger]);

  const nom = (liste: Nom[], cle: unknown) => (typeof cle === 'string' ? liste.find((n) => n.id === cle)?.libelle ?? null : null);
  const lignes = useMemo(() => journal ?? [], [journal]);
  const suspendu = estSuspendu(lignes);
  const etat = voyage?.etat ?? null;
  const termine = !!etat && ['DELIVERED', 'ACCEPTED', 'CLOSED', 'DISPUTED', 'CANCELLED', 'REJECTED'].includes(etat);
  const verifier = (l: LigneJournal) => (peutEcrire && estVerifiable(l) ? `${routeAction(VUE_VOYAGES, id, 'verifier')}?evenement=${encodeURIComponent(l.id)}` : null);
  const libelles = voyage ? {
    camion: nom(noms.vehicule, voyage.vehicle_id) ?? '—',
    chauffeur: nom(noms.chauffeur, voyage.driver_id) ?? '—',
    chargeuse: nom(noms.vehicule, voyage.loader_vehicle_id) ?? '—',
    origine: nom(noms.site, voyage.departure_site_id) ?? '—',
    destination: nom(noms.site, voyage.arrival_site_id) ?? '—',
    shift: nom(noms.shift, voyage.shift_id) ?? '—',
  } : null;
  const ctx = { ...contexte, date: contexte.date ?? voyage?.planned_date, voyage: id, camion: contexte.camion ?? voyage?.vehicle_id ?? undefined, chauffeur: contexte.chauffeur ?? voyage?.driver_id ?? undefined };

  const actions: ActionPage[] = [
    { id: 'suspendre', libelle: 'Suspendre', visible: peutEcrire && !!voyage && !suspendu && !termine, vers: routeAction(VUE_VOYAGES, id, 'suspendre'), ton: 'danger' },
    { id: 'reprendre', libelle: 'Reprendre', visible: peutEcrire && suspendu, vers: routeAction(VUE_VOYAGES, id, 'reprendre'), ton: 'principal' },
    { id: 'dispatch', libelle: 'Voir dans Dispatch', visible: hasPermission('trips', 'view'), vers: avecContexte('#/dispatch', ctx) },
    { id: 'fiches', libelle: 'Fiches terrain', visible: hasPermission('trips', 'view'), vers: avecContexte('#/fiches', ctx) },
  ];
  const possibles = estEtat(etat) ? actionsPossibles(etat) : { normales: [], exceptions: [] };
  const etapes = [...possibles.normales.map((e) => ({ e, exception: false })), ...possibles.exceptions.map((e) => ({ e, exception: true }))];
  const synth = syntheseControles(controles ?? []);
  const ph = etat ? PHASES[phaseDe(etat)] : null;
  const affectations = deFamille(lignes, FAMILLES.affectations);
  const fiches = fichesDuJournal(deFamille(lignes, FAMILLES.fiches));

  return (
    <>
      <PageDetail
        vue={VUE_VOYAGES}
        module="Voyages & Rotations"
        reference={voyage?.reference ?? 'Voyage'}
        titre={voyage ? `Voyage ${voyage.reference}` : undefined}
        statut={voyage && ph ? { libelle: `${estEtat(etat) ? ETATS[etat].libelle : etat}${suspendu ? ' (suspendu)' : ''}`, teinte: suspendu ? 'rouge' : ph.teinte } : null}
        resume={libelles ? <>{libelles.origine} → {libelles.destination} · {voyage?.planned_date} · camion {libelles.camion} · chauffeur {libelles.chauffeur}</> : null}
        actions={actions}
        chargement={chargement}
        erreur={erreur}
        introuvable={!chargement && !erreur && !voyage}
        onglets={[
          {
            id: 'synthese', libelle: 'Synthèse', contenu: voyage && libelles && (
              <div className="space-y-4">
                {peutEcrire && !suspendu && etapes.length > 0 && (
                  <section aria-label="Étape suivante" className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-carte">
                    <h2 className="mb-2 text-sm font-semibold text-stone-700">Étape suivante</h2>
                    <div className="flex flex-wrap gap-2">
                      {etapes.map(({ e, exception }) => (
                        <a key={e} href={`${routeAction(VUE_VOYAGES, id, 'etape')}?vers=${e}`}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold ${exception ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-orange-50 text-orange-800 hover:bg-orange-100'}`}>
                          {ETATS[e].action}
                        </a>
                      ))}
                    </div>
                  </section>
                )}
                {suspendu && <p role="status" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Voyage suspendu : il n'avance plus tant qu'il n'est pas repris.</p>}
                {ticket && (
                  <section aria-label="Ticket CBG" className="rounded-2xl border border-stone-200/70 bg-white p-4 text-sm shadow-carte">
                    <p>Ticket CBG <b>{ticket.ticket}</b> · net {formatNombre(ticket.net, 2)} t</p>
                    <div className="mt-2"><ListePieces objetType="ticket_pesee_cbg" objetId={ticket.id} peutDeposer={peutEcrire} /></div>
                  </section>
                )}
                {ticket === null && estEtat(etat) && LIVRES_SANS_TICKET.includes(etat) && (
                  <section aria-label="Ticket CBG absent" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <p role="status">Aucun ticket CBG rattaché : ce voyage n'est pas facturable tant que le ticket n'est pas saisi.</p>
                    {peutEcrire && <a href={routeAction(VUE_VOYAGES, id, 'ticket')} className="mt-2 inline-block rounded-lg bg-white px-3 py-2 font-semibold text-orange-800">Rattacher le ticket CBG</a>}
                  </section>
                )}
                {peutEcrire && <VoyageSuivant voyage={voyage} onModifie={charger} />}
                <Informations groupes={[
                  { titre: 'Voyage', champs: [['Référence', voyage.reference], ['Date prévue', voyage.planned_date], ['Shift', nom(noms.shift, voyage.shift_id)],
                    ['Rotation du shift', voyage.shift_sequence ?? null], ['Origine', libelles.origine], ['Destination', libelles.destination]] },
                  { titre: 'Affectation courante', champs: [['Camion', nom(noms.vehicule, voyage.vehicle_id)], ['Chauffeur', nom(noms.chauffeur, voyage.driver_id)],
                    ['Chargeuse ou pelle', nom(noms.vehicule, voyage.loader_vehicle_id)], ['Décisions Dispatch', journal ? affectations.length : null]] },
                  { titre: 'Exécution', champs: [['Départ réel', dt(voyage.actual_departure_time)], ['Arrivée réelle', dt(voyage.actual_arrival_time)],
                    ['Compteur départ (km)', voyage.km_start ?? null], ['Compteur arrivée (km)', voyage.km_end ?? null],
                    ['Net pesé (t)', voyage.net_weight_reception ?? voyage.net_weight ?? null], ['Tonnage accepté (t)', voyage.accepted_tonnage ?? null]] },
                  { titre: 'Contrôles', champs: controles ? [['Alertes', synth.alertes], ['Sans données', synth.sansDonnees], ['Conformes', synth.conformes]]
                    : [['État', erreurControles || 'Chargement…']] },
                ]} />
              </div>
            ),
          },
          {
            id: 'affectations', libelle: 'Affectations', compte: journal ? affectations.length : null, contenu: (
              <Relation<LigneJournal> titre="Affectations (courante et historique)" lignes={journal ? affectations : null} erreur={erreurJournal}
                vide="Aucune décision Dispatch tracée pour ce voyage." cle={(l) => l.id}
                colonnes={[
                  { libelle: 'Décision', valeur: (l) => l.libelle },
                  { libelle: 'Le', valeur: (l) => dt(l.date_saisie) },
                  { libelle: 'Camion', valeur: (l) => nom(noms.vehicule, l.donnees?.vehicle_id) ?? '—' },
                  { libelle: 'Chauffeur', valeur: (l) => nom(noms.chauffeur, l.donnees?.driver_id) ?? '—' },
                  { libelle: 'Motif', valeur: (l) => (typeof l.donnees?.motif === 'string' ? l.donnees.motif : '—') },
                  { libelle: 'Remplace', valeur: (l) => (l.corrige_ref ? 'décision précédente' : '—') },
                ]}
                note="La dernière décision non refusée est l'affectation courante ; les précédentes restent au journal (decisions_dispatch)." />
            ),
          },
          { id: 'etapes', libelle: 'Étapes', compte: journal ? deFamille(lignes, FAMILLES.etapes).length : null,
            contenu: <TableJournal lignes={journal ? deFamille(lignes, FAMILLES.etapes) : null} vide="Aucune étape enregistrée." verifier={verifier} /> },
          { id: 'chronologie', libelle: 'Chronologie', compte: journal?.length ?? null,
            contenu: erreurJournal ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreurJournal}</p>
              : <TableJournal lignes={journal} vide="Aucun événement enregistré." verifier={verifier} /> },
          {
            id: 'fiches', libelle: 'Fiches terrain', compte: journal ? fiches.length : null, contenu: (
              <div className="space-y-4">
                <Relation titre="Fiches reliées" lignes={journal ? fiches : null} erreur={erreurJournal} vide="Aucune fiche terrain reliée à ce voyage."
                  cle={(f) => f.id} lien={(f) => routeDetail('fiches', f.id)}
                  colonnes={[{ libelle: 'Fiche', valeur: (f) => f.numero }, { libelle: 'État', valeur: (f) => f.etat ?? '—' }]} />
                <TableJournal lignes={journal ? deFamille(lignes, FAMILLES.fiches) : null} vide="Aucune rotation déclarée sur une fiche FR." verifier={verifier} />
              </div>
            ),
          },
          {
            id: 'tickets', libelle: 'Tickets CBG', contenu: (
              <div className="space-y-4">
                <Relation<LigneJournal> titre="Relevé officiel CBG (source A)" lignes={journal ? deFamille(lignes, FAMILLES.officielCbg) : null} erreur={erreurJournal}
                  vide="Aucune ligne du relevé officiel CBG rapprochée de ce voyage." cle={(l) => l.id}
                  colonnes={[{ libelle: 'Relevé', valeur: (l) => String(l.donnees?.releve ?? '—') }, { libelle: 'Ticket', valeur: (l) => String(l.donnees?.ticket ?? '—') },
                    { libelle: 'Net (t)', valeur: (l) => num(l.donnees?.net) }, { libelle: 'Date', valeur: (l) => l.date_operation?.slice(0, 10) ?? '—' },
                    { libelle: 'Annulé', valeur: (l) => (l.annule ? 'oui' : 'non') }]}
                  note="Valeurs officielles CBG, jamais écrasées (D-081)." />
                <Relation<LigneJournal> titre="Ticket de réception et rectifications (saisie KOGON)" lignes={journal ? deFamille(lignes, FAMILLES.ticketKogon) : null}
                  erreur={erreurJournal} vide="Aucun ticket CBG saisi pour ce voyage." cle={(l) => l.id}
                  colonnes={[{ libelle: 'Événement', valeur: (l) => l.libelle }, { libelle: 'Net (t)', valeur: (l) => num(l.donnees?.net ?? (l.donnees?.nouveau as Record<string, unknown> | undefined)?.net) },
                    { libelle: 'Saisi le', valeur: (l) => dt(l.date_saisie) }, { libelle: 'Statut', valeur: (l) => <StatutEvt statut={l.statut} /> }]} />
                <Relation<LigneJournal> titre="Relevé terrain KOGON (source B)" lignes={journal ? deFamille(lignes, FAMILLES.releveKogon) : null} erreur={erreurJournal}
                  vide="Aucun relevé terrain KOGON relié." cle={(l) => l.id}
                  colonnes={[{ libelle: 'Ticket observé', valeur: (l) => String(l.donnees?.ticket ?? '—') }, { libelle: 'Net (t)', valeur: (l) => num(l.donnees?.net) },
                    { libelle: 'Remplacé', valeur: (l) => (l.annule ? 'oui' : 'non') }]}
                  note="Le relevé KOGON n'est jamais un deuxième ticket officiel." />
                <TableJournal lignes={journal ? deFamille(lignes, FAMILLES.rapprochements) : null} vide="Aucun rapprochement des deux sources." />
              </div>
            ),
          },
          { id: 'pieces', libelle: 'Documents et preuves', contenu: <OngletPieces objetType="voyage" objetId={id} peutDeposer={peutEcrire} libelleObjet="ce voyage" /> },
          { id: 'incidents', libelle: 'Incidents', contenu: voyage && libelles
            ? <IncidentVoyage voyage={voyage} peutEcrire={peutEcrire} libelles={{ camion: libelles.camion, chauffeur: libelles.chauffeur, origine: libelles.origine }} />
            : <SansDonnees message="Voyage non chargé" /> },
          { id: 'anomalies', libelle: 'Anomalies', compte: journal ? deFamille(lignes, FAMILLES.anomalies).length : null,
            contenu: <TableJournal lignes={journal ? deFamille(lignes, FAMILLES.anomalies) : null} vide="Aucune anomalie de pesée sur ce voyage." /> },
          {
            id: 'controles', libelle: 'Contrôles', compte: controles ? synth.alertes : null, contenu: (
              <section aria-label="Contrôles du voyage" className="space-y-2">
                {erreurControles ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreurControles}</p>
                  : controles === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
                    : (
                      <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200/70 bg-white shadow-carte">
                        {controles.map((c) => (
                          <li key={c.code} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                            <span className="font-semibold text-stone-900">{c.libelle}</span>
                            <span className="flex items-center gap-2 text-stone-600">{c.detail}<Puce teinte={RESULTATS[c.resultat]?.teinte ?? 'gris'}>{RESULTATS[c.resultat]?.libelle ?? c.resultat}</Puce></span>
                          </li>
                        ))}
                      </ul>
                    )}
                <Provenance source="controles_voyage (constats calculés par le serveur ; le système signale, l'humain décide)" heure={heure} />
              </section>
            ),
          },
          { id: 'historique', libelle: 'Historique', contenu: <Historique evenements={journal ? historiqueDepuisJournal([...lignes].reverse()) : null} erreur={erreurJournal} source="v_journal_voyage (trip_events, decisions_dispatch, suspensions_voyage, fiches, tickets, relevés, rapprochements, anomalies, pièces, vérifications)" /> },
        ]}
      />
    </>
  );
};

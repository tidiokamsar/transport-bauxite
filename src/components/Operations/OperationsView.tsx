import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useSite } from '../../contexts/SiteContext';
import { PageListe } from '../ui/PageListe';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { lire } from '../ui/lecture';
import { naviguer, routeDetail, useRoute } from '../ui/routeur';
import { ETATS, PHASES, estEtat, phaseDe, type Phase } from '../Trips/cycle';
import { ETATS_FICHE } from '../Fiches/cycleFiche';
import {
  COLONNES_JOURNAL, RESULTATS, SOURCES, STATUTS, avecContexte, contexteDepuisRequete, dateDuContexte, syntheseControles,
  type Controle, type LigneJournal,
} from './journal';

// Espace « Operations transport » (D-088) : vue generale du jour, journal
// des evenements, anomalies, controles et clotures. Lecture seule des tables
// sources (droits et perimetre du lecteur) ; chaque ligne mene a la fiche
// operationnelle du voyage. Les ecritures restent dans les modules metier.

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const CHAMP = 'rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm';

const useDate = () => {
  const [date, setDate] = useState(() => dateDuContexte(aujourdhui));
  return { date, setDate };
};

const ChoixDate = ({ date, setDate }: { date: string; setDate: (d: string) => void }) => (
  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} aria-label="Date des opérations" />
);

interface VoyageJour { id: string; reference: string; etat: string | null; vehicle_id: string | null; departure_site_id: string | null; arrival_site_id: string | null }

const VueGenerale = () => {
  const route = useRoute();
  const { siteId } = useSite();
  const { date, setDate } = useDate();
  const ctx = { ...contexteDepuisRequete(route.requete), date, site: siteId ?? undefined };
  const [voyages, setVoyages] = useState<VoyageJour[] | null>(null);
  const [fiches, setFiches] = useState<{ etat: string }[] | null>(null);
  const [anomalies, setAnomalies] = useState<number | null>(null);
  const [postes, setPostes] = useState<{ statut: string }[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);

  useEffect(() => {
    Promise.all([
      lire<VoyageJour>(supabase.from('trips').select('id, reference, etat, vehicle_id, departure_site_id, arrival_site_id').eq('planned_date', date), 'voyages'),
      lire<{ etat: string }>(supabase.from('fiches_terrain').select('etat').eq('date_fiche', date), 'fiches'),
      lire<{ id: string }>(supabase.from('anomalies_pesee').select('id').neq('statut', 'cloturee'), 'anomalies'),
      lire<{ statut: string }>(supabase.from('postes').select('statut').eq('date_poste', date), 'postes'),
    ]).then(([v, f, a, p]) => {
      const site = (x: VoyageJour) => !siteId || x.departure_site_id === siteId || x.arrival_site_id === siteId;
      setVoyages(v.lignes ? v.lignes.filter(site) : null);
      setFiches(f.lignes);
      setAnomalies(a.lignes ? a.lignes.length : null);
      setPostes(p.lignes);
      setErreur([v.erreur, f.erreur, a.erreur, p.erreur].filter(Boolean).join(' ; '));
      setHeure(new Date());
    });
  }, [date, siteId]);

  const parPhase = useMemo(() => {
    const c = Object.fromEntries(Object.keys(PHASES).map((p) => [p, 0])) as Record<Phase, number>;
    (voyages ?? []).forEach((v) => { c[phaseDe(v.etat)] += 1; });
    return c;
  }, [voyages]);
  const fichesParEtat = useMemo(() => {
    const c: Record<string, number> = {};
    (fiches ?? []).forEach((f) => { c[f.etat] = (c[f.etat] ?? 0) + 1; });
    return c;
  }, [fiches]);

  const tuiles: { titre: string; vers: string; valeur: string; detail: string }[] = [
    { titre: 'Planification et shifts', vers: avecContexte('#/postes', ctx), valeur: postes ? String(postes.length) : '—', detail: 'instances de shift à cette date' },
    { titre: 'Dispatch', vers: avecContexte('#/dispatch', ctx), valeur: voyages ? String(parPhase.prevu) : '—', detail: 'voyages à affecter ou affectés' },
    { titre: 'Voyages & Rotations', vers: avecContexte('#/trips', ctx), valeur: voyages ? String(voyages.length) : '—', detail: 'voyages du jour' },
    { titre: 'Fiches terrain', vers: avecContexte('#/fiches', ctx), valeur: fiches ? String(fiches.length) : '—', detail: 'fiches datées du jour' },
    { titre: 'Pesée CBG', vers: avecContexte('#/tickets-cbg', ctx), valeur: anomalies === null ? '—' : String(anomalies), detail: 'anomalies de pesée non clôturées (tous jours)' },
    { titre: 'Journal des événements', vers: avecContexte('#/operations-journal', ctx), valeur: '', detail: 'chronologie unifiée' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Opérations transport</h1>
          <p className="text-sm text-stone-500">Dispatch décide et affecte ; Voyages & Rotations suit l'exécution ; Fiches terrain documente ; les tickets CBG justifient.</p>
        </div>
        <ChoixDate date={date} setDate={setDate} />
      </div>
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tuiles.map((t) => (
          <a key={t.titre} href={t.vers} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte hover:border-orange-300">
            <p className="text-sm font-semibold text-stone-500">{t.titre}</p>
            {t.valeur && <p className="text-2xl font-black text-stone-900">{t.valeur}</p>}
            <p className="text-xs text-stone-500">{t.detail}</p>
          </a>
        ))}
      </div>
      <Panneau titre="Voyages du jour par phase">
        {voyages === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : voyages.length === 0 ? <SansDonnees message="Aucun voyage à cette date pour ce périmètre." />
            : (
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PHASES) as Phase[]).map((p) => <Puce key={p} teinte={PHASES[p].teinte}>{PHASES[p].libelle} : {parPhase[p]}</Puce>)}
              </div>
            )}
        <Provenance source="trips (date prévue), fiches_terrain, anomalies_pesee, postes" heure={heure} />
      </Panneau>
      <Panneau titre="Fiches du jour par état">
        {fiches === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : fiches.length === 0 ? <SansDonnees message="Aucune fiche à cette date." />
            : <div className="flex flex-wrap gap-2">{Object.entries(fichesParEtat).map(([e, n]) => <Puce key={e} teinte={ETATS_FICHE[e]?.teinte ?? 'gris'}>{ETATS_FICHE[e]?.libelle ?? e} : {n}</Puce>)}</div>}
      </Panneau>
    </div>
  );
};

const JournalOperations = () => {
  const { date, setDate } = useDate();
  const [lignes, setLignes] = useState<LigneJournal[] | null>(null);
  const [erreur, setErreur] = useState('');
  const charger = useCallback(() => {
    setLignes(null);
    const debut = new Date(`${date}T00:00:00`);
    const fin = new Date(debut.getTime() + 86_400_000);
    lire<LigneJournal>(supabase.from('v_journal_voyage').select(COLONNES_JOURNAL)
      .gte('date_saisie', debut.toISOString()).lt('date_saisie', fin.toISOString()).order('date_saisie', { ascending: false }).limit(2000), 'journal des événements')
      .then((r) => { setLignes(r.lignes); setErreur(r.erreur); });
  }, [date]);
  useEffect(() => { charger(); }, [charger]);
  const options = (cle: 'type' | 'source' | 'statut', libelles?: Record<string, string>) =>
    [...new Set((lignes ?? []).map((l) => l[cle]))].sort().map((v) => ({ valeur: v, libelle: libelles?.[v] ?? v }));
  return (
    <PageListe<LigneJournal>
      vue="operations-journal" titre="Journal des événements" sousTitre={<span className="flex items-center gap-2">Saisis le <ChoixDate date={date} setDate={setDate} /></span>}
      lignes={lignes} erreur={erreur} cle={(l) => `${l.id}-${l.trip_id}`} libelleOuverture={(l) => `Voyage ${l.voyage_reference ?? ''}`}
      ouvrir={(l) => naviguer(avecContexte(routeDetail('trips', l.trip_id, 'chronologie'), { date }))}
      colonnes={[
        { id: 'voyage', libelle: 'Voyage', valeur: (l) => l.voyage_reference },
        { id: 'evenement', libelle: 'Événement', valeur: (l) => l.libelle },
        { id: 'operation', libelle: 'Opération', valeur: (l) => l.date_operation, rendu: (l) => (l.date_operation ? new Date(l.date_operation).toLocaleString('fr-FR') : 'Non renseignée') },
        { id: 'saisie', libelle: 'Saisie', valeur: (l) => l.date_saisie, rendu: (l) => new Date(l.date_saisie).toLocaleString('fr-FR') },
        { id: 'source', libelle: 'Source', valeur: (l) => SOURCES[l.source] ?? l.source },
        { id: 'statut', libelle: 'Statut', valeur: (l) => l.statut, rendu: (l) => <Puce teinte={STATUTS[l.statut]?.teinte ?? 'gris'}>{STATUTS[l.statut]?.libelle ?? l.statut}</Puce> },
        { id: 'justificatif', libelle: 'Justificatif', valeur: (l) => l.justificatif, masquee: true },
        { id: 'table', libelle: 'Table source', valeur: (l) => l.table_source, masquee: true },
      ]}
      filtres={[
        { id: 'type', libelle: 'Type', options: options('type'), correspond: (l, v) => l.type === v },
        { id: 'source', libelle: 'Source', options: options('source', SOURCES), correspond: (l, v) => l.source === v },
        { id: 'statut', libelle: 'Statut', options: options('statut', Object.fromEntries(Object.entries(STATUTS).map(([k, s]) => [k, s.libelle]))), correspond: (l, v) => l.statut === v },
      ]}
      nomExport={`journal-operations-${date}`}
      vide={{ message: 'Aucun événement saisi ce jour', detail: 'Le journal assemble les événements des voyages visibles avec vos droits (périmètre de site).' }}
      provenance={<Provenance source="v_journal_voyage (2000 lignes au plus par jour)" />}
      onActualiser={charger}
    />
  );
};

interface Anomalie { id: string; trip_id: string | null; categorie: string; gravite: string; statut: string; description: string; cree_le: string }

const AnomaliesOperations = () => {
  const [lignes, setLignes] = useState<Anomalie[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [refs, setRefs] = useState<Record<string, string>>({});
  const charger = useCallback(() => {
    lire<Anomalie>(supabase.from('anomalies_pesee').select('id, trip_id, categorie, gravite, statut, description, cree_le').order('cree_le', { ascending: false }).limit(1000), 'anomalies de pesée')
      .then(async (r) => {
        setLignes(r.lignes); setErreur(r.erreur);
        const ids = [...new Set((r.lignes ?? []).map((a) => a.trip_id).filter((x): x is string => !!x))];
        if (ids.length) {
          const { data } = await supabase.from('trips').select('id, reference').in('id', ids.slice(0, 300));
          setRefs(Object.fromEntries(((data ?? []) as { id: string; reference: string }[]).map((t) => [t.id, t.reference])));
        }
      });
  }, []);
  useEffect(() => { charger(); }, [charger]);
  return (
    <PageListe<Anomalie>
      vue="operations-anomalies" titre="Anomalies et écarts" sousTitre="Anomalies de pesée (rapprochement des deux sources, D-081). Le traitement se fait dans Pesée CBG ; ici on les retrouve par voyage."
      lignes={lignes} erreur={erreur} cle={(a) => a.id} libelleOuverture={(a) => `Anomalie ${a.categorie}`}
      ouvrir={(a) => naviguer(a.trip_id ? routeDetail('trips', a.trip_id, 'anomalies') : '#/tickets-cbg')}
      colonnes={[
        { id: 'voyage', libelle: 'Voyage', valeur: (a) => (a.trip_id ? refs[a.trip_id] ?? a.trip_id.slice(0, 8) : 'Non identifié') },
        { id: 'categorie', libelle: 'Catégorie', valeur: (a) => a.categorie },
        { id: 'gravite', libelle: 'Gravité', valeur: (a) => a.gravite },
        { id: 'statut', libelle: 'Statut', valeur: (a) => a.statut },
        { id: 'description', libelle: 'Description', valeur: (a) => a.description },
        { id: 'cree', libelle: 'Ouverte le', valeur: (a) => a.cree_le, rendu: (a) => new Date(a.cree_le).toLocaleString('fr-FR') },
      ]}
      filtres={[
        { id: 'ouverte', libelle: 'Traitement', options: [{ valeur: 'ouverte', libelle: 'Non clôturées' }, { valeur: 'cloturee', libelle: 'Clôturées' }],
          correspond: (a, v) => (v === 'cloturee' ? a.statut === 'cloturee' : a.statut !== 'cloturee') },
        { id: 'gravite', libelle: 'Gravité', options: ['haute', 'moyenne', 'basse'].map((g) => ({ valeur: g, libelle: g })), correspond: (a, v) => a.gravite === v },
      ]}
      nomExport="anomalies-pesee" vide={{ message: 'Aucune anomalie de pesée', detail: 'Les anomalies naissent du rapprochement entre le relevé officiel CBG et les relevés KOGON.' }}
      provenance={<Provenance source="anomalies_pesee (1000 dernières)" />} onActualiser={charger}
    />
  );
};

interface LigneControle { voyage: VoyageJour; controles: Controle[] | null; erreur: string }

const ControlesOperations = () => {
  const { date, setDate } = useDate();
  const [voyages, setVoyages] = useState<VoyageJour[] | null>(null);
  const [resultats, setResultats] = useState<LigneControle[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [postes, setPostes] = useState<{ id: string; statut: string; shift_id: string; site_id: string }[] | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    setResultats([]);
    Promise.all([
      lire<VoyageJour>(supabase.from('trips').select('id, reference, etat, vehicle_id, departure_site_id, arrival_site_id').eq('planned_date', date).order('reference'), 'voyages'),
      lire<{ id: string; statut: string; shift_id: string; site_id: string }>(supabase.from('postes').select('id, statut, shift_id, site_id').eq('date_poste', date), 'postes'),
    ]).then(([v, p]) => { setVoyages(v.lignes); setPostes(p.lignes); setErreur([v.erreur, p.erreur].filter(Boolean).join(' ; ')); });
  }, [date]);

  const lancer = async () => {
    if (!voyages) return;
    setEnCours(true);
    const r: LigneControle[] = [];
    for (const v of voyages.slice(0, 200)) {
      const { data, error } = await supabase.rpc('controles_voyage', { p_trip_id: v.id });
      r.push({ voyage: v, controles: error ? null : ((data ?? []) as Controle[]), erreur: error?.message ?? '' });
    }
    setResultats(r);
    setEnCours(false);
  };

  const enAlerte = resultats.filter((r) => r.controles && syntheseControles(r.controles).alertes > 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Contrôles et clôtures</h1>
          <p className="text-sm text-stone-500">Constats calculés par le serveur (controles_voyage) ; le système signale, l'humain décide.</p>
        </div>
        <div className="flex gap-2">
          <ChoixDate date={date} setDate={setDate} />
          <button type="button" onClick={lancer} disabled={enCours || !voyages?.length} className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow disabled:opacity-50">
            {enCours ? 'Contrôles en cours…' : 'Contrôler les voyages du jour'}
          </button>
        </div>
      </div>
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      <Panneau titre="Instances de shift du jour">
        {postes === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : postes.length === 0 ? <SansDonnees message="Aucune instance de shift à cette date." />
            : <div className="flex flex-wrap gap-2">{postes.map((p) => <Puce key={p.id} teinte={p.statut === 'valide' ? 'vert' : p.statut === 'cloture' ? 'bleu' : 'orange'}>{p.statut}</Puce>)}</div>}
        <p className="mt-2 text-xs text-stone-500">La clôture d'un shift se fait dans Postes de travail (cloturer_shift, D-087) ; elle est refusée tant que des voyages ne sont pas terminés, sauf motif.</p>
      </Panneau>
      <Panneau titre={resultats.length ? `Voyages contrôlés : ${resultats.length}, en alerte : ${enAlerte.length}` : 'Voyages du jour'}>
        {voyages === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : voyages.length === 0 ? <SansDonnees message="Aucun voyage à cette date." />
            : resultats.length === 0 ? <p className="text-sm text-stone-500">{voyages.length} voyage(s). Lancer les contrôles pour obtenir les constats.</p>
              : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 text-left text-stone-500"><th className="py-2 pr-3">Voyage</th><th className="py-2 pr-3">État</th><th className="py-2 pr-3">Alertes</th><th className="py-2">Constats</th></tr></thead>
                  <tbody>
                    {resultats.map((r) => (
                      <tr key={r.voyage.id} className="border-b border-stone-100 align-top">
                        <td className="py-2 pr-3"><a href={avecContexte(routeDetail('trips', r.voyage.id, 'controles'), { date })} className="font-semibold text-orange-800 hover:underline">{r.voyage.reference}</a></td>
                        <td className="py-2 pr-3">{estEtat(r.voyage.etat) ? ETATS[r.voyage.etat].libelle : r.voyage.etat}</td>
                        <td className="py-2 pr-3">{r.controles ? syntheseControles(r.controles).alertes : '—'}</td>
                        <td className="py-2">
                          {r.erreur ? <span role="alert" className="text-red-700">{r.erreur}</span>
                            : (r.controles ?? []).filter((c) => c.resultat === 'alerte' || c.resultat === 'sans_donnees')
                              .map((c) => <span key={c.code} className="mr-1"><Puce teinte={RESULTATS[c.resultat]?.teinte ?? 'gris'}>{c.libelle}</Puce></span>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
        <Provenance source="controles_voyage par voyage (200 au plus)" />
      </Panneau>
    </div>
  );
};

export const OperationsView = () => {
  const route = useRoute();
  if (route.vue === 'operations-journal') return <JournalOperations />;
  if (route.vue === 'operations-anomalies') return <AnomaliesOperations />;
  if (route.vue === 'operations-controles') return <ControlesOperations />;
  return <VueGenerale />;
};

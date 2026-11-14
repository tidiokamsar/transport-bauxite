import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileInput, Fuel, Printer, Timer, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { STATUTS_FICHE, TYPES_FICHE, type Fiche, type TypeFiche } from './fiches';
import { FicheImprimable, type ContexteImpression } from './FicheImprimable';
import { SaisieFiche } from './SaisieFiche';

// Fiches terrain (phase 2 du poste charge de contrats, D-028) : preparer
// les fiches du shift depuis le dispatch et la flotte, les imprimer, suivre
// leur remise et leur retour, puis les saisir.

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Shift { id: string; display_name: string; start_time: string; end_time: string }
interface Engin { id: string; registration: string; vehicle_type: string; status: string; site_id: string | null }
interface Voyage { id: string; reference: string; vehicle_id: string | null; driver_id: string | null; etat: string | null }
interface Societe { raison_sociale: string; rccm: string | null; nif: string | null; adresse: string | null }

const ICONES: Record<TypeFiche, typeof Truck> = { rotations: Truck, pointage_engins: Timer, carburant: Fuel };

export const FichesView = () => {
  const { hasPermission } = useAuth();
  const { siteId, sites } = useSite();
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('maintenance', 'create') || hasPermission('fuel', 'create');
  const [date, setDate] = useState(aujourdhui);
  const [site, setSite] = useState('');
  const [shift, setShift] = useState('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [engins, setEngins] = useState<Engin[]>([]);
  const [chauffeurs, setChauffeurs] = useState<{ id: string; name: string }[]>([]);
  const [societe, setSociete] = useState<Societe | null>(null);
  const [fiches, setFiches] = useState<Fiche[] | null>(null);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [agent, setAgent] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [aImprimer, setAImprimer] = useState<Fiche[] | null>(null);
  const [enSaisie, setEnSaisie] = useState<Fiche | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('work_shifts').select('id, display_name, start_time, end_time').eq('is_active', true).order('shift_order'),
      supabase.from('vehicles').select('id, registration, vehicle_type, status, site_id').order('registration'),
      supabase.from('drivers').select('id, name').order('name'),
      supabase.from('societe').select('raison_sociale, rccm, nif, adresse').eq('id', 1).maybeSingle(),
    ]).then(([s, v, d, so]) => {
      const liste = (s.data ?? []) as Shift[];
      setShifts(liste);
      setShift((x) => x || liste[0]?.id || '');
      setEngins((v.data ?? []) as Engin[]);
      setChauffeurs((d.data ?? []) as { id: string; name: string }[]);
      setSociete(so.data as Societe | null);
    });
  }, []);

  useEffect(() => {
    if (siteId) setSite(siteId);
    else if (!site && sites.length > 0) setSite((sites.find((s) => s.type === 'mine') ?? sites[0]).id);
  }, [siteId, sites, site]);

  const charger = useCallback(async () => {
    if (!site) return;
    let qv = supabase.from('trips').select('id, reference, vehicle_id, driver_id, etat')
      .eq('planned_date', date).eq('departure_site_id', site).not('vehicle_id', 'is', null).order('reference');
    if (shift) qv = qv.eq('shift_id', shift);
    const [rf, rv] = await Promise.all([
      supabase.from('fiches_terrain').select('*').eq('date_fiche', date).eq('site_id', site).order('numero'),
      qv,
    ]);
    if (rf.error) setMessage({ ok: false, texte: 'Fiches indisponibles : ' + rf.error.message });
    setFiches((rf.data ?? []) as Fiche[]);
    setVoyages(((rv.data ?? []) as Voyage[]).filter((v) => !['CANCELLED', 'REJECTED'].includes(v.etat ?? '')));
    setHeure(new Date());
  }, [date, site, shift]);
  useEffect(() => { charger(); }, [charger]);

  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);
  const immat = useMemo(() => new Map(engins.map((e) => [e.id, e.registration])), [engins]);
  const nomChauffeur = useMemo(() => new Map(chauffeurs.map((c) => [c.id, c.name])), [chauffeurs]);
  const shiftParId = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);
  const enginsSite = engins.filter((e) => e.status !== 'sold' && (e.site_id === null || e.site_id === site));

  // Camions du shift ayant des voyages et pas encore de fiche de rotations
  const camionsSansFiche = useMemo(() => {
    const avecFiche = new Set((fiches ?? []).filter((f) => f.type === 'rotations' && f.statut !== 'annulee' && (f.shift_id ?? '') === shift).map((f) => f.vehicle_id));
    const parCamion = new Map<string, Voyage[]>();
    for (const v of voyages) if (v.vehicle_id && !avecFiche.has(v.vehicle_id)) parCamion.set(v.vehicle_id, [...(parCamion.get(v.vehicle_id) ?? []), v]);
    return [...parCamion.entries()].sort((a, b) => (immat.get(a[0]) ?? '').localeCompare(immat.get(b[0]) ?? ''));
  }, [fiches, voyages, shift, immat]);

  const preparer = async (type: TypeFiche) => {
    setEnCours(true);
    setMessage(null);
    const crees: string[] = [];
    let erreur = '';
    const appels = type === 'rotations'
      ? camionsSansFiche.map(([camion, liste]) => ({
          p_type: type, p_date: date, p_site_id: site, p_shift_id: shift || null, p_vehicle_id: camion,
          p_driver_id: liste.find((v) => v.driver_id)?.driver_id ?? null, p_agent: agent || null,
          p_options: { pesee: 'arrivee' }, p_contenu: { voyages: liste.map((v) => ({ id: v.id, reference: v.reference })) },
        }))
      : [{
          p_type: type, p_date: date, p_site_id: site, p_shift_id: shift || null, p_vehicle_id: null, p_driver_id: null,
          p_agent: agent || null, p_options: {}, p_contenu: { engins: enginsSite.map((e) => ({ id: e.id, registration: e.registration })) },
        }];
    for (const p of appels) {
      const { data, error } = await supabase.rpc('preparer_fiche', p);
      if (error) { erreur = error.message; break; }
      crees.push(data as string);
    }
    setEnCours(false);
    setMessage(erreur ? { ok: false, texte: erreur } : { ok: true, texte: `${crees.length} fiche(s) préparée(s)` });
    await charger();
    if (crees.length > 0) {
      const { data } = await supabase.from('fiches_terrain').select('*').in('id', crees).order('numero');
      setAImprimer((data ?? []) as Fiche[]);
    }
  };

  const action = async (f: Fiche, fonction: string, parametres: Record<string, unknown>) => {
    const { error } = await supabase.rpc(fonction, { p_id: f.id, ...parametres });
    setMessage(error ? { ok: false, texte: `${f.numero} : ${error.message}` } : null);
    charger();
  };
  const remettre = (f: Fiche) => {
    const nom = window.prompt(`Nom de l'agent qui reçoit la fiche ${f.numero}`, f.agent ?? '');
    if (nom !== null) action(f, 'suivre_fiche', { p_etape: 'remise', p_agent: nom });
  };
  const annuler = (f: Fiche) => {
    const motif = window.prompt(`Motif d'annulation de la fiche ${f.numero}`);
    if (motif !== null) action(f, 'annuler_fiche', { p_motif: motif });
  };

  const contexte = (f: Fiche): ContexteImpression => ({
    societe,
    site: nomSite.get(f.site_id) ?? '',
    shift: f.shift_id ? shiftParId.get(f.shift_id)?.display_name ?? '' : '',
    camion: f.vehicle_id ? immat.get(f.vehicle_id) ?? '' : '',
    chauffeur: f.driver_id ? nomChauffeur.get(f.driver_id) ?? '' : '',
  });
  const detail = (f: Fiche) => f.type === 'rotations'
    ? `${immat.get(f.vehicle_id ?? '') ?? '—'} · ${(f.contenu.voyages ?? []).length} voyage(s) prévu(s)`
    : `${(f.contenu.engins ?? []).length} engin(s)`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Fiches terrain</h2>
          <p className="text-stone-500">Préparer, imprimer, remettre aux agents, puis saisir les fiches retournées</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
          <select value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site" disabled={Boolean(siteId)} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={shift} onChange={(e) => setShift(e.target.value)} aria-label="Shift" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
            {shifts.map((s) => <option key={s.id} value={s.id}>Shift {s.display_name}</option>)}
          </select>
        </div>
      </div>
      {message && <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}

      {peutEcrire && (
        <Panneau titre="Préparer les fiches du shift">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-stone-200 p-4" aria-label="Fiches de rotations">
              <p className="flex items-center gap-2 font-semibold text-stone-900"><Truck className="h-4 w-4 text-orange-600" /> Rotations : une fiche par camion</p>
              <p className="mt-1 text-sm text-stone-500">{camionsSansFiche.length} camion(s) avec des voyages du Dispatch et sans fiche.</p>
              <p className="mt-2 text-sm text-stone-600">Pesée effectuée par CBG au dépôt; Kogon intègre le ticket reçu.</p>
              <button onClick={() => preparer('rotations')} disabled={enCours || camionsSansFiche.length === 0} className="mt-3 w-full rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                Préparer {camionsSansFiche.length} fiche(s) de rotations
              </button>
            </section>
            <section className="rounded-xl border border-stone-200 p-4" aria-label="Fiche de pointage">
              <p className="flex items-center gap-2 font-semibold text-stone-900"><Timer className="h-4 w-4 text-orange-600" /> Pointage horamètre des engins</p>
              <p className="mt-1 text-sm text-stone-500">{enginsSite.length} engin(s) du site : horamètre début et fin, arrêts et leur cause.</p>
              <button onClick={() => preparer('pointage_engins')} disabled={enCours} className="mt-3 w-full rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-800 hover:bg-orange-50 disabled:opacity-50">Préparer la fiche de pointage</button>
            </section>
            <section className="rounded-xl border border-stone-200 p-4" aria-label="Fiche carburant">
              <p className="flex items-center gap-2 font-semibold text-stone-900"><Fuel className="h-4 w-4 text-orange-600" /> Distribution de carburant</p>
              <p className="mt-1 text-sm text-stone-500">Pleins du shift : engin, litres, compteur, index pompe.</p>
              <button onClick={() => preparer('carburant')} disabled={enCours} className="mt-3 w-full rounded-lg border border-orange-300 px-3 py-2 text-sm font-bold text-orange-800 hover:bg-orange-50 disabled:opacity-50">Préparer la fiche carburant</button>
            </section>
          </div>
          <label className="mt-4 block max-w-sm text-sm">
            <span className="mb-1 block font-medium text-stone-700">Agent destinataire (facultatif, sinon à la remise)</span>
            <input value={agent} onChange={(e) => setAgent(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
          </label>
        </Panneau>
      )}

      <Panneau
        titre={`Fiches du ${new Date(date + 'T00:00:00').toLocaleDateString('fr-FR')}`}
        action={fiches && fiches.some((f) => f.statut === 'preparee') && (
          <button onClick={() => setAImprimer((fiches ?? []).filter((f) => f.statut === 'preparee'))} className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
            <Printer className="h-4 w-4" /> Imprimer les fiches préparées
          </button>
        )}
      >
        {fiches === null ? (
          <div className="flex h-24 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" /></div>
        ) : fiches.length === 0 ? (
          <SansDonnees message="Aucune fiche" detail="Préparez les fiches du shift ci-dessus." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {fiches.map((f) => {
              const Icone = ICONES[f.type];
              const ouverte = !['saisie', 'annulee'].includes(f.statut);
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Icone className="h-5 w-5 text-stone-400" />
                    <div>
                      <p className="font-mono font-bold text-stone-900">{f.numero} <span className="ml-2 font-sans font-normal text-stone-500">{TYPES_FICHE[f.type].libelle}</span></p>
                      <p className="text-xs text-stone-500">
                        {detail(f)}{f.shift_id ? ` · shift ${shiftParId.get(f.shift_id)?.display_name ?? ''}` : ''}{f.agent ? ` · agent : ${f.agent}` : ''}
                        {f.motif_annulation ? ` · annulée : ${f.motif_annulation}` : ''}
                      </p>
                    </div>
                    <Puce teinte={STATUTS_FICHE[f.statut].teinte}>{STATUTS_FICHE[f.statut].libelle}</Puce>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => setAImprimer([f])} className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-700" aria-label={`Imprimer ${f.numero}`}><Printer className="inline h-3.5 w-3.5" /> Imprimer</button>
                    {peutEcrire && ouverte && (
                      <>
                        {f.statut === 'preparee' && <button onClick={() => remettre(f)} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700" aria-label={`Remettre ${f.numero}`}>Remise à l'agent</button>}
                        {f.statut !== 'retournee' && <button onClick={() => action(f, 'suivre_fiche', { p_etape: 'retournee' })} className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-800" aria-label={`Retour de ${f.numero}`}>Fiche retournée</button>}
                        {f.statut !== 'preparee' && <button onClick={() => setEnSaisie(f)} className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700" aria-label={`Saisir ${f.numero}`}><FileInput className="inline h-3.5 w-3.5" /> Saisir</button>}
                        <button onClick={() => annuler(f)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50" aria-label={`Annuler ${f.numero}`}>Annuler</button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panneau>
      <Provenance source="fiches numérotées par le serveur ; chaque donnée saisie porte le numéro de sa fiche (journal des voyages, immobilisations, pleins)" heure={heure} />

      {aImprimer && (
        <FicheImprimable fiches={aImprimer} contextes={Object.fromEntries(aImprimer.map((f) => [f.id, contexte(f)]))} onFermer={() => setAImprimer(null)} />
      )}
      {enSaisie && (
        <SaisieFiche
          fiche={enSaisie}
          titre={`${nomSite.get(enSaisie.site_id) ?? ''} · ${detail(enSaisie)}`}
          debutShift={enSaisie.shift_id ? shiftParId.get(enSaisie.shift_id)?.start_time.slice(0, 5) ?? null : null}
          engins={(enSaisie.contenu.engins ?? enginsSite.map((e) => ({ id: e.id, registration: e.registration }))).map((e) => ({ id: e.id, libelle: e.registration }))}
          chauffeurs={chauffeurs.map((c) => ({ id: c.id, libelle: c.name }))}
          onFermer={() => { setEnSaisie(null); charger(); }}
          onFait={() => { setEnSaisie(null); charger(); }}
        />
      )}
    </div>
  );
};

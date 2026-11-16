import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, DoorClosed, Plus, Printer, RefreshCw, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, ReferentielVide, SansDonnees } from '../ui/Panneau';
import { SANS_SHIFT, SANS_SITE } from '../ui/referentiels';
import { CATEGORIES_EVENEMENT, LIBELLE_STATUT_POSTE, resumeBilan, type Bilan } from './postes';
import { LienVue } from '../ui/LienVue';

// Postes de travail (D-048) : instance d'un shift pour une date et un site.
// Ouverture (consignes recues de la passation), equipe et presence, journal
// d'evenements, cloture (consignes pour le poste suivant, bilan fige),
// validation de la cloture par une autre personne.

interface Poste {
  id: string; date_poste: string; shift_id: string; site_id: string; responsable_id: string | null; statut: keyof typeof LIBELLE_STATUT_POSTE;
  consignes_recues: string | null; consignes_sortie: string | null; rapport: string | null; bilan: Bilan | null;
  ouvert_le: string; cloture_le: string | null; valide_le: string | null;
}
interface Membre { id: string; poste_id: string; driver_id: string | null; vehicle_id: string | null; present: boolean | null; retard_minutes: number | null; motif_absence: string | null }
interface Evenement { id: string; poste_id: string; survenu_le: string; categorie: keyof typeof CATEGORIES_EVENEMENT; description: string }
interface Lib { id: string; libelle: string }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const aujourdhui = () => new Date().toISOString().slice(0, 10);

export const PostesView = () => {
  const { hasPermission } = useAuth();
  const peutExploiter = hasPermission('trips', 'create') || hasPermission('trips', 'edit');
  const peutValider = hasPermission('planning', 'edit');
  const [date, setDate] = useState(aujourdhui);
  const [postes, setPostes] = useState<Poste[] | null>(null);
  const [equipe, setEquipe] = useState<Membre[]>([]);
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [shifts, setShifts] = useState<Lib[]>([]);
  const [sites, setSites] = useState<Lib[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Lib[]>([]);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [vides, setVides] = useState({ site: false, shift: false, chauffeur: false });

  const charger = useCallback(async () => {
    const p = await supabase.from('postes').select('*').eq('date_poste', date).order('ouvert_le');
    const ids = (p.data ?? []).map((x) => x.id as string);
    const [e, ev, sh, si, ch] = await Promise.all([
      ids.length ? supabase.from('postes_equipe').select('id, poste_id, driver_id, vehicle_id, present, retard_minutes, motif_absence').in('poste_id', ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from('postes_evenements').select('id, poste_id, survenu_le, categorie, description').in('poste_id', ids).order('survenu_le') : Promise.resolve({ data: [], error: null }),
      supabase.from('work_shifts').select('id, display_name').eq('is_active', true).order('shift_order'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('drivers').select('id, name').eq('status', 'active').order('name'),
    ]);
    setErreur(p.error?.message ?? e.error?.message ?? ev.error?.message ?? sh.error?.message ?? si.error?.message ?? ch.error?.message ?? '');
    setVides({ site: !si.error && (si.data ?? []).length === 0, shift: !sh.error && (sh.data ?? []).length === 0, chauffeur: !ch.error && (ch.data ?? []).length === 0 });
    setPostes((p.data ?? []) as Poste[]);
    setEquipe((e.data ?? []) as Membre[]);
    setEvenements((ev.data ?? []) as Evenement[]);
    setShifts((sh.data ?? []).map((x) => ({ id: x.id as string, libelle: x.display_name as string })));
    setSites((si.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
    setChauffeurs((ch.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
  }, [date]);
  useEffect(() => { charger(); }, [charger]);

  const nomShift = useMemo(() => new Map(shifts.map((s) => [s.id, s.libelle])), [shifts]);
  const nomSite = useMemo(() => new Map(sites.map((s) => [s.id, s.libelle])), [sites]);
  const nomChauffeur = useMemo(() => new Map(chauffeurs.map((s) => [s.id, s.libelle])), [chauffeurs]);
  const poste = (postes ?? []).find((p) => p.id === choisi) ?? null;
  const membres = equipe.filter((m) => m.poste_id === choisi);
  const journal = evenements.filter((e) => e.poste_id === choisi);
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });

  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); await charger(); return true;
  };
  const ouvrir = () => {
    // Jamais d'identifiant vide envoye au serveur (referentiel vide).
    if (!c('shift') || !c('site')) { setErreur('Choisissez le shift et le site du poste.'); return; }
    executer(() => supabase.rpc('ouvrir_poste', {
      p_date: date, p_shift_id: c('shift'), p_site_id: c('site'), p_responsable: null, p_consignes: c('consignes').trim() || null,
    }), 'Poste ouvert. Les consignes du poste précédent du site sont reprises.').then((ok) => ok && setChamps({}));
  };
  const affecter = () => poste && c('chauffeur') && executer(() => supabase.rpc('affecter_au_poste', { p_poste_id: poste.id, p_driver_id: c('chauffeur'), p_vehicle_id: null }), 'Chauffeur ajouté au poste.');
  const pointer = (m: Membre, present: boolean) => {
    let retard: number | null = null; let motif: string | null = null;
    if (present) { const r = window.prompt('Retard en minutes (vide si à l\'heure)', ''); if (r === null) return; retard = r.trim() ? Number.parseInt(r, 10) : null; }
    else { motif = window.prompt('Motif de l\'absence'); if (!motif?.trim()) return; }
    executer(() => supabase.rpc('pointer_presence', { p_membre_id: m.id, p_present: present, p_retard_minutes: retard, p_motif: motif }), 'Présence pointée.');
  };
  const consigner = () => poste && executer(() => supabase.rpc('consigner_evenement_poste', {
    p_poste_id: poste.id, p_categorie: c('categorie') || 'information', p_description: c('evenement').trim(), p_quand: new Date().toISOString(), p_vehicle_id: null,
  }), 'Événement consigné.').then((ok) => ok && setChamps({ ...champs, evenement: '' }));
  const cloturer = () => poste && executer(() => supabase.rpc('cloturer_poste', { p_poste_id: poste.id, p_consignes_sortie: c('sortie').trim(), p_rapport: c('rapport').trim() || null }),
    'Poste clos : bilan figé, consignes transmises au poste suivant.');
  const valider = () => poste && executer(() => supabase.rpc('valider_cloture_poste', { p_poste_id: poste.id }), 'Clôture validée.');

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Postes de travail</h2>
        <p className="text-sm text-stone-500">Ouverture, équipe, événements, passation et clôture validée de chaque shift.</p></div>
      <div className="flex items-end gap-2">
        <label className="text-xs text-stone-600">Date<input type="date" value={date} onChange={(e) => { setDate(e.target.value); setChoisi(null); }} className={CHAMP} /></label>
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {vides.site && <ReferentielVide>{SANS_SITE} Un poste s'ouvre pour un shift et un site.</ReferentielVide>}
    {vides.shift && <ReferentielVide>{SANS_SHIFT} <LienVue vue="shifts">Ouvrir la gestion des shifts</LienVue></ReferentielVide>}
    {vides.chauffeur && <ReferentielVide>Aucun chauffeur actif : créez ou réactivez les chauffeurs (Flotte → Chauffeurs) pour composer l'équipe d'un poste.</ReferentielVide>}

    {peutExploiter && <Panneau titre="Ouvrir un poste">
      <div role="form" aria-label="Ouverture de poste" className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Shift *<select value={c('shift')} onChange={(e) => poser('shift', e.target.value)} className={CHAMP}><option value="">Choisir</option>{shifts.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
        <label className="text-sm">Site *<select value={c('site')} onChange={(e) => poser('site', e.target.value)} className={CHAMP}><option value="">Choisir</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
        <label className="text-sm">Consignes complémentaires<input value={c('consignes')} onChange={(e) => poser('consignes', e.target.value)} className={CHAMP} /></label>
      </div>
      <button disabled={busy || !c('shift') || !c('site')} onClick={ouvrir} className="mt-3 flex items-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Ouvrir le poste</button>
    </Panneau>}

    <Panneau titre={`Postes du ${new Date(date).toLocaleDateString('fr-FR')}`}>
      {postes === null ? <p>Chargement…</p> : postes.length === 0 ? <SansDonnees message="Aucun poste ouvert à cette date" /> :
        <ul className="divide-y divide-stone-100">{postes.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <span><b>{nomShift.get(p.shift_id) ?? 'Shift'}</b> · {nomSite.get(p.site_id) ?? '?'} · <Puce teinte={p.statut === 'ouvert' ? 'bleu' : p.statut === 'cloture' ? 'orange' : 'vert'}>{LIBELLE_STATUT_POSTE[p.statut]}</Puce></span>
          <button onClick={() => setChoisi(p.id)} aria-label={`Ouvrir la fiche du poste ${nomShift.get(p.shift_id) ?? ''} ${nomSite.get(p.site_id) ?? ''}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><ClipboardList className="h-3 w-3" /> Fiche du poste</button>
        </li>)}</ul>}
    </Panneau>

    {poste && <div id="fiche-poste" className="space-y-5">
      <Panneau titre={`${nomShift.get(poste.shift_id) ?? 'Poste'} · ${nomSite.get(poste.site_id) ?? ''} · ${new Date(poste.date_poste).toLocaleDateString('fr-FR')}`}>
        <div className="grid gap-4 md:grid-cols-2 text-sm">
          <div><h4 className="font-semibold text-stone-700">Consignes reçues (passation)</h4><p className="whitespace-pre-line text-stone-600">{poste.consignes_recues ?? '—'}</p></div>
          <div><h4 className="font-semibold text-stone-700">Consignes transmises</h4><p className="whitespace-pre-line text-stone-600">{poste.consignes_sortie ?? (poste.statut === 'ouvert' ? 'À rédiger à la clôture' : '—')}</p></div>
        </div>
        {poste.bilan && <p className="mt-3 rounded bg-stone-50 p-2 text-sm">{resumeBilan(poste.bilan)}</p>}
        {poste.rapport && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{poste.rapport}</p>}
        <button onClick={() => window.print()} className="mt-3 flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-1.5 text-sm"><Printer className="h-4 w-4" /> Imprimer le rapport</button>
      </Panneau>

      <Panneau titre={`Équipe (${membres.length})`}>
        {membres.length === 0 ? <SansDonnees message="Aucun membre affecté" /> : <ul className="divide-y divide-stone-100 text-sm">{membres.map((m) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>{nomChauffeur.get(m.driver_id ?? '') ?? 'Engin'} · {m.present === null ? <Puce teinte="gris">Non pointé</Puce> : m.present ? <Puce teinte="vert">Présent{m.retard_minutes ? ` (retard ${m.retard_minutes} min)` : ''}</Puce> : <Puce teinte="rouge">Absent : {m.motif_absence}</Puce>}</span>
          {peutExploiter && poste.statut === 'ouvert' && <span className="flex gap-1">
            <button onClick={() => pointer(m, true)} aria-label={`Présent ${nomChauffeur.get(m.driver_id ?? '') ?? ''}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><UserCheck className="h-3 w-3" /> Présent</button>
            <button onClick={() => pointer(m, false)} aria-label={`Absent ${nomChauffeur.get(m.driver_id ?? '') ?? ''}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><UserX className="h-3 w-3" /> Absent</button></span>}
        </li>)}</ul>}
        {peutExploiter && poste.statut === 'ouvert' && <div className="mt-3 flex items-end gap-2">
          <label className="text-sm">Chauffeur<select value={c('chauffeur')} onChange={(e) => poser('chauffeur', e.target.value)} className={CHAMP}><option value="">Choisir</option>{chauffeurs.filter((x) => !membres.some((m) => m.driver_id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
          <button disabled={busy || !c('chauffeur')} onClick={affecter} className="rounded-lg bg-stone-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Ajouter</button>
        </div>}
      </Panneau>

      <Panneau titre={`Événements (${journal.length})`}>
        {journal.length === 0 ? <SansDonnees message="Aucun événement consigné" /> : <ul className="divide-y divide-stone-100 text-sm">{journal.map((e) => <li key={e.id} className="py-2">
          <span className="font-mono text-xs text-stone-500">{new Date(e.survenu_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span> · <b>{CATEGORIES_EVENEMENT[e.categorie]}</b> · {e.description}</li>)}</ul>}
        {peutExploiter && poste.statut === 'ouvert' && <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <label className="text-sm">Catégorie<select value={c('categorie') || 'information'} onChange={(e) => poser('categorie', e.target.value)} className={CHAMP}>{Object.entries(CATEGORIES_EVENEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">Description<input value={c('evenement')} onChange={(e) => poser('evenement', e.target.value)} className={CHAMP} /></label>
          <button disabled={busy || !c('evenement').trim()} onClick={consigner} className="rounded-lg bg-stone-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Consigner</button>
        </div>}
      </Panneau>

      {peutExploiter && poste.statut === 'ouvert' && <Panneau titre="Clôture du poste">
        <label className="block text-sm">Consignes pour le poste suivant * (même « rien à signaler »)<textarea value={c('sortie')} onChange={(e) => poser('sortie', e.target.value)} rows={3} className={CHAMP} /></label>
        <label className="mt-2 block text-sm">Rapport de poste<textarea value={c('rapport')} onChange={(e) => poser('rapport', e.target.value)} rows={3} className={CHAMP} /></label>
        <button disabled={busy || !c('sortie').trim()} onClick={cloturer} className="mt-3 flex items-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><DoorClosed className="h-4 w-4" /> Clore le poste</button>
      </Panneau>}
      {peutValider && poste.statut === 'cloture' && <button disabled={busy} onClick={valider} className="flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Valider la clôture</button>}
    </div>}
  </div>;
};

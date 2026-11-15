import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV } from '../../lib/exports';
import { Panneau, Puce, SansDonnees, type TeintePuce } from '../ui/Panneau';

// Presences (D-061) : saisie par fonction serveur. Une erreur se corrige par
// une nouvelle saisie qui remplace l'ancienne (motif) ou par une annulation
// motivee ; rien n'est supprime ni reecrit. Aucun horaire par defaut.

interface Employe { id: string; first_name: string; last_name: string; employee_number: string; status: string }
interface Presence {
  id: string; employee_id: string; date: string; status: string; check_in_time: string | null; check_out_time: string | null;
  hours_worked: number | null; overtime_hours: number | null; absence_reason: string | null; notes: string | null;
  remplace_presence_id: string | null; motif_correction: string | null; annulee_le: string | null; motif_annulation: string | null;
}
interface Chauffeur { id: string; name: string; employee_id: string | null; license_number: string | null }

const STATUTS_PRESENCE: Record<string, { libelle: string; teinte: TeintePuce; heures: boolean }> = {
  present: { libelle: 'Présent', teinte: 'vert', heures: true },
  late: { libelle: 'Retard', teinte: 'orange', heures: true },
  half_day: { libelle: 'Demi-journée', teinte: 'bleu', heures: true },
  absent: { libelle: 'Absent', teinte: 'rouge', heures: false },
  leave: { libelle: 'Congé', teinte: 'bleu', heures: false },
  sick_leave: { libelle: 'Maladie', teinte: 'violet', heures: false },
  unpaid_leave: { libelle: 'Sans solde', teinte: 'gris', heures: false },
};

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2';
const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const bornesMois = (mois: string) => {
  const [a, m] = mois.split('-').map(Number);
  return { du: `${mois}-01`, au: `${mois}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}` };
};

export const AttendanceView = () => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('hr', 'create') || hasPermission('hr', 'edit');
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [lignes, setLignes] = useState<Presence[] | null>(null);
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([]);
  const [mois, setMois] = useState(new Date().toISOString().slice(0, 7));
  const [filtreEmploye, setFiltreEmploye] = useState('');
  const [historique, setHistorique] = useState(false);
  const [champs, setChamps] = useState<Record<string, string> | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { du, au } = bornesMois(mois);
    const [e, p, c] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, employee_number, status').order('last_name'),
      supabase.from('employee_attendance').select('id, employee_id, date, status, check_in_time, check_out_time, hours_worked, overtime_hours, absence_reason, notes, remplace_presence_id, motif_correction, annulee_le, motif_annulation')
        .gte('date', du).lte('date', au).order('date', { ascending: false }),
      // Lien employe -> chauffeur : matricule du dossier chauffeur (drivers.employee_id), si lisible.
      supabase.from('drivers').select('id, name, employee_id, license_number').not('employee_id', 'is', null),
    ]);
    setErreur(e.error?.message ?? p.error?.message ?? '');
    setEmployes((e.data ?? []) as Employe[]);
    setLignes((p.data ?? []) as Presence[]);
    setChauffeurs(c.error ? [] : (c.data ?? []) as Chauffeur[]);
  }, [mois]);
  useEffect(() => { charger(); }, [charger]);

  const employe = useMemo(() => new Map(employes.map((x) => [x.id, x])), [employes]);
  const chauffeurDe = useMemo(() => new Map(chauffeurs.map((x) => [String(x.employee_id).trim(), x])), [chauffeurs]);
  const remplacees = new Set((lignes ?? []).map((l) => l.remplace_presence_id).filter(Boolean));
  const enVigueur = (l: Presence) => !l.annulee_le && !remplacees.has(l.id);
  const visibles = (lignes ?? []).filter((l) => (historique || enVigueur(l)) && (!filtreEmploye || l.employee_id === filtreEmploye));
  const vigueur = visibles.filter(enVigueur);
  const stats = {
    saisies: vigueur.length,
    presents: vigueur.filter((l) => l.status === 'present').length,
    retards: vigueur.filter((l) => l.status === 'late').length,
    absences: vigueur.filter((l) => !STATUTS_PRESENCE[l.status]?.heures).length,
  };

  const c = (k: string) => champs?.[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...(champs ?? {}), [k]: v });
  const ouvrir = (initial: Record<string, string> = {}) => { setChamps({ statut: 'present', date: new Date().toISOString().slice(0, 10), ...initial }); setErreur(''); setMessage(''); };
  const corriger = (l: Presence) => ouvrir({
    remplace: l.id, employe: l.employee_id, date: l.date, statut: l.status, arrivee: l.check_in_time?.slice(0, 5) ?? '',
    depart: l.check_out_time?.slice(0, 5) ?? '', heures: l.hours_worked?.toString() ?? '', sup: l.overtime_hours ? String(l.overtime_hours) : '',
    absence: l.absence_reason ?? '', note: l.notes ?? '',
  });
  const avecHeures = STATUTS_PRESENCE[c('statut')]?.heures ?? true;

  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage(succes); setChamps(null); await charger();
  };
  const enregistrer = () => executer(() => supabase.rpc('enregistrer_presence', {
    p_employe: c('employe'), p_date: c('date'), p_statut: c('statut'),
    p_arrivee: avecHeures && c('arrivee') ? c('arrivee') : null, p_depart: avecHeures && c('depart') ? c('depart') : null,
    p_heures: avecHeures ? nombre(c('heures')) : null, p_heures_sup: avecHeures ? nombre(c('sup')) : null,
    p_motif_absence: avecHeures ? null : c('absence').trim() || null, p_note: c('note').trim() || null,
    p_remplace: c('remplace') || null, p_motif_correction: c('remplace') ? c('motif').trim() || null : null,
  }), c('remplace') ? 'Correction enregistrée : la saisie précédente reste dans l\'historique.' : 'Présence enregistrée.');
  const annuler = (l: Presence) => {
    const motif = window.prompt('Motif de l\'annulation de cette saisie (elle restera dans l\'historique)');
    if (!motif?.trim()) return;
    executer(() => supabase.rpc('annuler_presence', { p_id: l.id, p_motif: motif }), 'Saisie annulée.');
  };
  const exporter = () => exportToCSV(vigueur.map((l) => {
    const e = employe.get(l.employee_id);
    return { date: l.date, matricule: e?.employee_number ?? '', employe: e ? `${e.first_name} ${e.last_name}` : '', statut: STATUTS_PRESENCE[l.status]?.libelle ?? l.status,
      arrivee: l.check_in_time ?? '', depart: l.check_out_time ?? '', heures: l.hours_worked ?? '', heures_sup: l.overtime_hours ?? '', motif_absence: l.absence_reason ?? '' };
  }), `presences-${mois}`);

  const pret = champs && c('employe') && c('date') && c('statut') && (avecHeures ? (c('heures').trim() !== '' || (c('arrivee') && c('depart'))) : c('absence').trim())
    && (!c('remplace') || c('motif').trim());

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Présences et absences</h2>
        <p className="text-sm text-stone-500">Une erreur se corrige par une nouvelle saisie ou une annulation motivée ; l'historique est conservé.</p></div>
      <div className="flex flex-wrap gap-2">
        {peutEcrire && <button onClick={() => ouvrir()} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Saisir une présence</button>}
        <button onClick={exporter} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"><Download className="h-4 w-4" /> Exporter CSV</button>
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {champs && <Panneau titre={c('remplace') ? 'Corriger une saisie' : 'Nouvelle saisie'}>
      <div role="form" aria-label="Saisie de présence" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm">Employé *<select value={c('employe')} disabled={!!c('remplace')} onChange={(e) => poser('employe', e.target.value)} className={CHAMP}>
          <option value="">Choisir</option>{employes.filter((e) => e.status === 'active' || e.id === c('employe')).map((e) => <option key={e.id} value={e.id}>{e.employee_number} · {e.first_name} {e.last_name}</option>)}</select></label>
        <label className="text-sm">Date *<input type="date" value={c('date')} onChange={(e) => poser('date', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Statut *<select value={c('statut')} onChange={(e) => poser('statut', e.target.value)} className={CHAMP}>
          {Object.entries(STATUTS_PRESENCE).map(([k, v]) => <option key={k} value={k}>{v.libelle}</option>)}</select></label>
        {avecHeures ? <>
          <label className="text-sm">Arrivée<input type="time" value={c('arrivee')} onChange={(e) => poser('arrivee', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Départ<input type="time" value={c('depart')} onChange={(e) => poser('depart', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Heures travaillées (sinon calculées depuis les horaires)<input inputMode="decimal" value={c('heures')} onChange={(e) => poser('heures', e.target.value)} className={CHAMP} /></label>
          <label className="text-sm">Heures supplémentaires<input inputMode="decimal" value={c('sup')} onChange={(e) => poser('sup', e.target.value)} className={CHAMP} /></label>
        </> : <label className="text-sm sm:col-span-2">Motif de l'absence *<input value={c('absence')} onChange={(e) => poser('absence', e.target.value)} className={CHAMP} /></label>}
        <label className="text-sm sm:col-span-2">Note<input value={c('note')} onChange={(e) => poser('note', e.target.value)} className={CHAMP} /></label>
        {c('remplace') && <label className="text-sm sm:col-span-2 xl:col-span-3">Motif de la correction *<input value={c('motif')} onChange={(e) => poser('motif', e.target.value)} className={CHAMP} /></label>}
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !pret} onClick={enregistrer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setChamps(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Fermer</button>
      </div>
    </Panneau>}

    <div className="grid gap-3 sm:grid-cols-4">
      {[['Saisies en vigueur', stats.saisies], ['Présents', stats.presents], ['Retards', stats.retards], ['Absences et congés', stats.absences]].map(([l, v]) => (
        <div key={l as string} className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">{l}</p><p className="text-2xl font-black">{lignes === null ? '—' : v}</p></div>
      ))}
    </div>

    <Panneau titre="Saisies du mois">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">Mois<input type="month" value={mois} onChange={(e) => setMois(e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Employé<select value={filtreEmploye} onChange={(e) => setFiltreEmploye(e.target.value)} className={CHAMP}>
          <option value="">Tous</option>{employes.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={historique} onChange={(e) => setHistorique(e.target.checked)} /> Afficher les saisies corrigées ou annulées</label>
      </div>
      {lignes === null ? <p>Chargement…</p> : visibles.length === 0 ? <SansDonnees message="Aucune saisie" detail="Aucune présence enregistrée pour cette période." /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500">
          <th className="py-2 pr-3">Employé</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Statut</th><th className="py-2 pr-3">Horaires</th>
          <th className="py-2 pr-3 text-right">Heures</th><th className="py-2 pr-3 text-right">Sup.</th><th className="py-2 pr-3">Motif / note</th><th /></tr></thead>
          <tbody>{visibles.map((l) => {
            const e = employe.get(l.employee_id); const ch = e ? chauffeurDe.get(e.employee_number.trim()) : undefined; const st = STATUTS_PRESENCE[l.status];
            const vigueurLigne = enVigueur(l);
            return <tr key={l.id} className={`border-b border-stone-100 ${vigueurLigne ? '' : 'text-stone-400 line-through decoration-stone-300'}`}>
              <td className="py-2 pr-3"><span className="font-medium">{e ? `${e.first_name} ${e.last_name}` : '—'}</span> <span className="text-xs text-stone-500">{e?.employee_number}</span>
                {ch && <span className="ml-1 text-xs text-stone-500">· chauffeur {ch.name}{ch.license_number ? `, permis ${ch.license_number}` : ''}</span>}</td>
              <td className="py-2 pr-3">{new Date(`${l.date}T00:00:00`).toLocaleDateString('fr-FR')}</td>
              <td className="py-2 pr-3">{st ? <Puce teinte={st.teinte}>{st.libelle}</Puce> : l.status}
                {l.annulee_le && <span className="ml-1 text-xs">annulée ({l.motif_annulation})</span>}
                {remplacees.has(l.id) && <span className="ml-1 text-xs">corrigée</span>}
                {l.remplace_presence_id && <span className="ml-1 text-xs text-stone-500">correction : {l.motif_correction}</span>}</td>
              <td className="py-2 pr-3 text-xs">{l.check_in_time || l.check_out_time ? `${l.check_in_time?.slice(0, 5) ?? '?'} → ${l.check_out_time?.slice(0, 5) ?? '?'}` : '—'}</td>
              <td className="py-2 pr-3 text-right">{st?.heures ? l.hours_worked ?? '—' : '—'}</td>
              <td className="py-2 pr-3 text-right">{l.overtime_hours ? l.overtime_hours : '—'}</td>
              <td className="py-2 pr-3 text-xs">{[l.absence_reason, l.notes].filter(Boolean).join(' · ') || '—'}</td>
              <td className="py-2">{peutEcrire && vigueurLigne && <span className="flex gap-1">
                <button onClick={() => corriger(l)} aria-label={`Corriger la saisie du ${l.date}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Corriger</button>
                <button onClick={() => annuler(l)} aria-label={`Annuler la saisie du ${l.date}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Annuler</button></span>}</td>
            </tr>;
          })}</tbody></table></div>}
    </Panneau>
  </div>;
};

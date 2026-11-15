import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { TYPES_HABILITATION, etatHabilitation, type Habilitation } from './habilitations';

// Habilitations des chauffeurs (D-051) : visite medicale, formation,
// habilitation engin, acces site. Les types exiges par l'administrateur
// bloquent l'affectation au dispatch d'un chauffeur non habilite.

interface Lib { id: string; libelle: string }
interface Alerte { id: string; driver_id: string; type: keyof typeof TYPES_HABILITATION; libelle: string; expire_le: string; jours_restants: number }

const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';

export const HabilitationsView = () => {
  const { hasPermission, profile } = useAuth();
  const estAdmin = profile?.role === 'admin';
  const peutEcrire = hasPermission('drivers', 'create') || hasPermission('drivers', 'edit') || estAdmin;
  const [habilitations, setHabilitations] = useState<Habilitation[] | null>(null);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [exigences, setExigences] = useState<string[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Lib[]>([]);
  const [filtre, setFiltre] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [h, a, e, c] = await Promise.all([
      supabase.from('habilitations_chauffeur').select('id, driver_id, type, libelle, numero, delivre_le, expire_le, revoque_le, motif_revocation').order('delivre_le', { ascending: false }),
      supabase.from('v_habilitations_a_renouveler').select('id, driver_id, type, libelle, expire_le, jours_restants').order('expire_le'),
      supabase.from('habilitations_requises').select('type'),
      supabase.from('drivers').select('id, name').order('name'),
    ]);
    setErreur(h.error?.message ?? a.error?.message ?? e.error?.message ?? '');
    setHabilitations((h.data ?? []) as Habilitation[]);
    setAlertes((a.data ?? []) as Alerte[]);
    setExigences((e.data ?? []).map((x) => x.type as string));
    setChauffeurs((c.data ?? []).map((x) => ({ id: x.id as string, libelle: x.name as string })));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nom = useMemo(() => new Map(chauffeurs.map((c) => [c.id, c.libelle])), [chauffeurs]);
  const liste = (habilitations ?? []).filter((h) => !filtre || h.driver_id === filtre);
  const c = (k: string) => champs[k] ?? '';
  const poser = (k: string, v: string) => setChamps({ ...champs, [k]: v });
  const executer = async (action: () => PromiseLike<{ error: { message: string } | null }>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await action();
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); await charger(); return true;
  };
  const ajouter = () => executer(() => supabase.from('habilitations_chauffeur').insert({
    driver_id: c('chauffeur'), type: c('type'), libelle: c('libelle').trim(), numero: c('numero').trim() || null,
    delivre_le: c('delivre'), expire_le: c('expire') || null, document_ref: c('piece').trim() || null,
  }), 'Habilitation enregistrée.').then((ok) => { if (ok) { setOuvert(false); setChamps({}); } });
  const revoquer = (h: Habilitation) => {
    const motif = window.prompt(`Motif de la révocation de « ${h.libelle} »`);
    if (!motif?.trim()) return;
    executer(() => supabase.from('habilitations_chauffeur').update({ revoque_le: new Date().toISOString(), motif_revocation: motif }).eq('id', h.id), 'Habilitation révoquée.');
  };
  const basculerExigence = (type: string, exigee: boolean) => {
    if (!window.confirm(exigee ? `Exiger « ${TYPES_HABILITATION[type as keyof typeof TYPES_HABILITATION]} » valide pour toute affectation au dispatch ?` : 'Lever cette exigence ?')) return;
    executer(() => exigee ? supabase.from('habilitations_requises').insert({ type }) : supabase.from('habilitations_requises').delete().eq('type', type),
      exigee ? 'Exigence ajoutée : le dispatch la contrôle désormais.' : 'Exigence levée.');
  };
  const pret = c('chauffeur') && c('type') && c('libelle').trim() && c('delivre') && (!c('expire') || c('expire') >= c('delivre'));

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Habilitations des chauffeurs</h2>
        <p className="text-sm text-stone-500">Visites médicales, formations, habilitations engins et accès sites ; contrôlées au dispatch quand elles sont exigées.</p></div>
      <div className="flex gap-2">
        {peutEcrire && <button onClick={() => { setOuvert(true); setChamps({ type: 'visite_medicale' }); }} className="flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Habilitation</button>}
        <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    {ouvert && <Panneau titre="Nouvelle habilitation">
      <div role="form" aria-label="Saisie habilitation" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Chauffeur *<select value={c('chauffeur')} onChange={(e) => poser('chauffeur', e.target.value)} className={CHAMP}><option value="">Choisir</option>{chauffeurs.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select></label>
        <label className="text-sm">Type *<select value={c('type')} onChange={(e) => poser('type', e.target.value)} className={CHAMP}>{Object.entries(TYPES_HABILITATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-sm">Libellé *<input value={c('libelle')} onChange={(e) => poser('libelle', e.target.value)} placeholder="Aptitude 2026, habilitation chargeuse…" className={CHAMP} /></label>
        <label className="text-sm">Numéro<input value={c('numero')} onChange={(e) => poser('numero', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Délivrée le *<input type="date" value={c('delivre')} onChange={(e) => poser('delivre', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm">Expire le<input type="date" value={c('expire')} onChange={(e) => poser('expire', e.target.value)} className={CHAMP} /></label>
        <label className="text-sm sm:col-span-2">Pièce justificative (référence)<input value={c('piece')} onChange={(e) => poser('piece', e.target.value)} className={CHAMP} /></label>
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !pret} onClick={ajouter} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
        <button onClick={() => setOuvert(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
      </div>
    </Panneau>}

    <Panneau titre={`À renouveler (${alertes.length})`}>
      {alertes.length === 0 ? <SansDonnees message="Aucune habilitation expirée ou expirant sous 30 jours" /> :
        <ul className="divide-y divide-stone-100 text-sm">{alertes.map((a) => <li key={a.id} className="py-2">
          <b>{nom.get(a.driver_id) ?? '?'}</b> · {TYPES_HABILITATION[a.type]} « {a.libelle} » · {a.jours_restants < 0 ? <Puce teinte="rouge">Expirée depuis {-a.jours_restants} j</Puce> : <Puce teinte="orange">Expire dans {a.jours_restants} j</Puce>}</li>)}</ul>}
    </Panneau>

    <Panneau titre="Exigences au dispatch">
      <p className="mb-2 text-sm text-stone-600">Un chauffeur ne peut être affecté à un voyage que s'il détient, à la date du voyage, une habilitation valide de chaque type exigé (en plus du permis).</p>
      <ul className="space-y-1 text-sm">{Object.entries(TYPES_HABILITATION).map(([k, v]) => <li key={k} className="flex items-center justify-between gap-2">
        <span>{v} {exigences.includes(k) ? <Puce teinte="vert">Exigée</Puce> : <Puce teinte="gris">Non exigée</Puce>}</span>
        {estAdmin && <button onClick={() => basculerExigence(k, !exigences.includes(k))} aria-label={`${exigences.includes(k) ? 'Lever' : 'Exiger'} ${v}`} className="rounded border border-stone-300 px-2 py-1 text-xs">{exigences.includes(k) ? 'Lever' : 'Exiger'}</button>}
      </li>)}</ul>
    </Panneau>

    <Panneau titre="Registre">
      <select aria-label="Filtrer par chauffeur" value={filtre} onChange={(e) => setFiltre(e.target.value)} className="mb-3 rounded border border-stone-300 px-3 py-2 text-sm"><option value="">Tous les chauffeurs</option>{chauffeurs.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}</select>
      {habilitations === null ? <p>Chargement…</p> : liste.length === 0 ? <SansDonnees message="Aucune habilitation enregistrée" /> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Chauffeur</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Libellé</th><th className="py-2 pr-3">Validité</th><th className="py-2 pr-3">État</th><th /></tr></thead>
          <tbody>{liste.map((h) => { const e = etatHabilitation(h, new Date()); return <tr key={h.id} className="border-b border-stone-100">
            <td className="py-2 pr-3">{nom.get(h.driver_id) ?? '?'}</td><td className="py-2 pr-3">{TYPES_HABILITATION[h.type]}</td><td className="py-2 pr-3">{h.libelle}{h.numero && <span className="block text-xs text-stone-500">{h.numero}</span>}</td>
            <td className="py-2 pr-3 text-xs">{h.delivre_le} → {h.expire_le ?? 'sans échéance'}</td>
            <td className="py-2 pr-3" title={h.motif_revocation ?? undefined}><Puce teinte={e.teinte}>{e.texte}</Puce></td>
            <td className="py-2">{peutEcrire && !h.revoque_le && <button onClick={() => revoquer(h)} aria-label={`Révoquer ${h.libelle}`} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><BadgeCheck className="h-3 w-3" /> Révoquer</button>}</td>
          </tr>; })}</tbody></table></div>}
    </Panneau>
  </div>;
};

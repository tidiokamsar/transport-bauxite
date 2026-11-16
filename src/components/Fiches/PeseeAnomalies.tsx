import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToCSV } from '../../lib/exports';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { actionsPossibles, CLASSES, LIBELLES_ACTION, MOTIF_EXIGE, STATUTS_ANOMALIE, type ActionAnomalie } from './pesee';
import { CHAMP, dateHeure, type ContextePesee } from './peseeContexte';

// Espace D : anomalies de pesee et validations. Chaque action passe par
// agir_anomalie_pesee (serveur juge des transitions et des droits) et
// s'ajoute a l'historique immuable. Celui qui soumet un ecart de poids ne
// le cloture pas ; une anomalie d'une reconciliation cloturee ne change plus.

interface Anomalie {
  id: string; releve_id: string; trip_id: string | null; site_id: string | null; categorie: string; gravite: 'basse' | 'moyenne' | 'haute';
  description: string; sources: string[]; valeurs: Record<string, unknown>; responsable_id: string | null; statut: string;
  decision: string | null; commentaire: string | null; preuve_ref: string | null; soumis_par: string | null; cree_le: string;
}
interface Evenement { id: string; action: string; statut_avant: string | null; statut_apres: string; commentaire: string | null; preuve_ref: string | null; auteur: string | null; le: string }
interface Personne { id: string; full_name: string | null }

const GRAVITE = { basse: ['Basse', 'gris'], moyenne: ['Moyenne', 'orange'], haute: ['Haute', 'rouge'] } as const;

export const PeseeAnomalies = ({ ctx }: { ctx: ContextePesee }) => {
  const [anomalies, setAnomalies] = useState<Anomalie[] | null>(null);
  const [personnes, setPersonnes] = useState<Personne[]>([]);
  const [filtre, setFiltre] = useState({ statut: 'actives', categorie: '', site: '' });
  const [choisie, setChoisie] = useState<string | null>(null);
  const [journal, setJournal] = useState<Evenement[]>([]);
  const [saisie, setSaisie] = useState<{ action: ActionAnomalie | ''; commentaire: string; preuve: string; responsable: string }>({ action: '', commentaire: '', preuve: '', responsable: '' });
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [a, p] = await Promise.all([
      supabase.from('anomalies_pesee').select('id, releve_id, trip_id, site_id, categorie, gravite, description, sources, valeurs, responsable_id, statut, decision, commentaire, preuve_ref, soumis_par, cree_le')
        .order('cree_le', { ascending: false }).limit(500),
      supabase.from('profiles').select('id, full_name').eq('status', 'active').order('full_name'),
    ]);
    setErreur(a.error?.message ?? p.error?.message ?? '');
    setAnomalies((a.data ?? []) as Anomalie[]);
    setPersonnes((p.data ?? []) as Personne[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    if (!choisie) { setJournal([]); return; }
    supabase.from('journal_anomalies_pesee').select('id, action, statut_avant, statut_apres, commentaire, preuve_ref, auteur, le').eq('anomalie_id', choisie).order('le')
      .then(({ data, error }) => { if (error) setErreur(error.message); setJournal((data ?? []) as Evenement[]); });
  }, [choisie, anomalies]);

  const nomSite = useMemo(() => new Map(ctx.sites.map((s) => [s.id, s.libelle])), [ctx.sites]);
  const refVoyage = useMemo(() => new Map(ctx.voyages.map((v) => [v.id, v.reference])), [ctx.voyages]);
  const nom = useMemo(() => new Map(personnes.map((p) => [p.id, p.full_name ?? 'sans nom'])), [personnes]);
  const visibles = (anomalies ?? []).filter((a) => (filtre.statut === '' || (filtre.statut === 'actives' ? a.statut !== 'cloturee' : a.statut === filtre.statut))
    && (!filtre.categorie || a.categorie === filtre.categorie) && (!filtre.site || a.site_id === filtre.site));
  const a = (anomalies ?? []).find((x) => x.id === choisie);
  const actions = a ? actionsPossibles(a, { voyages: ctx.peutEcrire, facturation: ctx.peutValider, utilisateur: ctx.utilisateur }) : [];

  const agir = async () => {
    if (!a || !saisie.action) return;
    setBusy(true); setErreur(''); setMessage('');
    const { data, error } = await supabase.rpc('agir_anomalie_pesee', {
      p_id: a.id, p_action: saisie.action, p_commentaire: saisie.commentaire.trim() || null, p_preuve_ref: saisie.preuve.trim() || null,
      p_responsable: saisie.action === 'affecter' ? saisie.responsable || null : null,
    });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage(`Action enregistrée : ${STATUTS_ANOMALIE[String(data)]?.libelle ?? data}.`);
    setSaisie({ action: '', commentaire: '', preuve: '', responsable: '' });
    await charger();
  };
  const exporter = () => exportToCSV(visibles.map((x) => ({
    Cree_le: x.cree_le, Categorie: CLASSES[x.categorie]?.libelle ?? x.categorie, Gravite: x.gravite, Statut: STATUTS_ANOMALIE[x.statut]?.libelle ?? x.statut,
    Site: x.site_id ? nomSite.get(x.site_id) ?? '' : '', Rotation: x.trip_id ? refVoyage.get(x.trip_id) ?? '' : '', Description: x.description,
    Sources: x.sources.join(' + '), Responsable: x.responsable_id ? nom.get(x.responsable_id) ?? '' : '', Decision: x.decision ?? '', Preuve: x.preuve_ref ?? '',
    Commentaire: x.commentaire ?? '',
  })), 'anomalies-pesee');

  const motifManquant = !!saisie.action && MOTIF_EXIGE.includes(saisie.action) && !saisie.commentaire.trim();
  const preuveManquante = saisie.action === 'accepter_ecart_justifie' && a?.categorie === 'ecart_poids' && !saisie.preuve.trim();

  return <div className="space-y-5">
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    <Panneau titre="Anomalies de pesée" action={<button onClick={exporter} disabled={visibles.length === 0} className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:opacity-50"><Download className="h-4 w-4" /> Exporter CSV</button>}>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Statut<select value={filtre.statut} onChange={(e) => setFiltre({ ...filtre, statut: e.target.value })} className={CHAMP}>
          <option value="actives">Non clôturées</option><option value="">Toutes</option>{Object.entries(STATUTS_ANOMALIE).map(([k, v]) => <option key={k} value={k}>{v.libelle}</option>)}</select></label>
        <label className="text-sm">Catégorie<select value={filtre.categorie} onChange={(e) => setFiltre({ ...filtre, categorie: e.target.value })} className={CHAMP}><option value="">Toutes</option>
          {Object.entries(CLASSES).filter(([k]) => k !== 'concordant').map(([k, v]) => <option key={k} value={k}>{v.libelle}</option>)}</select></label>
        <label className="text-sm">Site<select value={filtre.site} onChange={(e) => setFiltre({ ...filtre, site: e.target.value })} className={CHAMP}><option value="">Tous</option>
          {ctx.sites.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select></label>
      </div>
      {anomalies === null ? <p className="text-sm text-stone-500">Chargement des anomalies…</p> : visibles.length === 0 ? <SansDonnees message="Aucune anomalie" detail="Les anomalies naissent du rapprochement d'un relevé CBG (espace C)." /> :
        <ul className="divide-y divide-stone-100 text-sm">{visibles.map((x) => <li key={x.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${x.id === choisie ? 'bg-orange-50/50' : ''}`}>
          <span className="flex flex-wrap items-center gap-1"><Puce teinte={CLASSES[x.categorie]?.teinte ?? 'gris'}>{CLASSES[x.categorie]?.libelle ?? x.categorie}</Puce>
            <Puce teinte={GRAVITE[x.gravite][1]}>{GRAVITE[x.gravite][0]}</Puce><Puce teinte={STATUTS_ANOMALIE[x.statut]?.teinte ?? 'gris'}>{STATUTS_ANOMALIE[x.statut]?.libelle ?? x.statut}</Puce>
            <span>{x.description}</span>{x.trip_id && <span className="font-mono text-xs">{refVoyage.get(x.trip_id) ?? ''}</span>}
            {x.responsable_id && <span className="text-xs text-stone-500">· {nom.get(x.responsable_id) ?? 'responsable'}</span>}</span>
          <button onClick={() => { setChoisie(x.id); setSaisie({ action: '', commentaire: '', preuve: '', responsable: '' }); }} aria-label={`Ouvrir ${x.description}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Ouvrir</button>
        </li>)}</ul>}
    </Panneau>

    {a && <Panneau titre={`Anomalie : ${CLASSES[a.categorie]?.libelle ?? a.categorie}`}>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-stone-500">Description</dt><dd>{a.description}</dd></div>
        <div><dt className="text-xs text-stone-500">Sources comparées</dt><dd>{a.sources.map((s) => s === 'cbg' ? 'Relevé CBG' : s === 'kogon' ? 'Fiche KOGON' : 'Rotation').join(' + ') || '-'}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-stone-500">Valeurs comparées</dt><dd className="font-mono text-xs">{Object.entries(a.valeurs).map(([k, v]) => `${k} = ${Array.isArray(v) ? v.map((t) => refVoyage.get(String(t)) ?? t).join(', ') : String(v)}`).join(' · ') || '-'}</dd></div>
        <div><dt className="text-xs text-stone-500">Décision</dt><dd>{a.decision ?? '-'}{a.preuve_ref ? ` · preuve ${a.preuve_ref}` : ''}</dd></div>
        <div><dt className="text-xs text-stone-500">Site</dt><dd>{a.site_id ? nomSite.get(a.site_id) ?? '-' : 'Tous sites'}</dd></div>
      </dl>
      {actions.length > 0 ? <div role="form" aria-label="Action sur l'anomalie" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Action<select value={saisie.action} onChange={(e) => setSaisie({ ...saisie, action: e.target.value as ActionAnomalie })} className={CHAMP}><option value="">Choisir</option>
          {actions.map((x) => <option key={x} value={x}>{LIBELLES_ACTION[x]}</option>)}</select></label>
        <label className="text-sm">Commentaire{saisie.action && MOTIF_EXIGE.includes(saisie.action) ? ' *' : ''}<input value={saisie.commentaire} onChange={(e) => setSaisie({ ...saisie, commentaire: e.target.value })} className={CHAMP} /></label>
        {['accepter_ecart_justifie', 'signaler_erreur_cbg', 'confirmer_concordance'].includes(saisie.action) && <label className="text-sm">Référence de preuve{preuveManquante ? ' *' : ''}<input value={saisie.preuve} onChange={(e) => setSaisie({ ...saisie, preuve: e.target.value })} className={CHAMP} /></label>}
        {saisie.action === 'affecter' && <label className="text-sm">Responsable *<select value={saisie.responsable} onChange={(e) => setSaisie({ ...saisie, responsable: e.target.value })} className={CHAMP}><option value="">Choisir</option>
          {personnes.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? 'sans nom'}</option>)}</select></label>}
        <button disabled={busy || !saisie.action || motifManquant || preuveManquante || (saisie.action === 'affecter' && !saisie.responsable)} onClick={agir}
          className="mt-6 rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer l'action</button>
      </div> : <p role="status" className="mt-4 text-sm text-stone-500">{a.statut === 'cloturee' ? 'Anomalie clôturée : elle ne change plus.' : 'Aucune action ouverte à votre profil sur cette anomalie.'}</p>}
      <h3 className="mt-5 text-sm font-bold text-stone-800">Historique</h3>
      {journal.length === 0 ? <p className="text-sm text-stone-500">Aucun événement.</p> :
        <ol className="mt-2 space-y-1 text-xs">{journal.map((e) => <li key={e.id}>{dateHeure(e.le)} · {nom.get(e.auteur ?? '') ?? 'système'} · {LIBELLES_ACTION[e.action as ActionAnomalie] ?? e.action}
          {e.statut_avant && e.statut_avant !== e.statut_apres ? ` · ${STATUTS_ANOMALIE[e.statut_avant]?.libelle ?? e.statut_avant} → ${STATUTS_ANOMALIE[e.statut_apres]?.libelle ?? e.statut_apres}` : ''}
          {e.commentaire ? ` · « ${e.commentaire} »` : ''}{e.preuve_ref ? ` · preuve ${e.preuve_ref}` : ''}</li>)}</ol>}
    </Panneau>}
  </div>;
};

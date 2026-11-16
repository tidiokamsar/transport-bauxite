import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Eye, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToCSV, imprimerTableau } from '../../lib/exports';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { etatRegle, grouperParPriorite, PRIORITES, type ElementDecision, type RegleAlerte } from './decisions';

// Centre des decisions (D-068) : alertes ecrites par le serveur a partir des
// evenements reels (une par regle et par objet) et decisions en attente
// (D-056), par priorite. Le systeme signale, une personne decide : prise en
// compte et resolution motivee par une fonction serveur ; une condition levee
// reste affichee jusqu'a sa resolution.

const quand = (v: string | null) => (v ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'date inconnue');

export const CentreDecisionsView = ({ onAllerA }: { onAllerA: (vue: string) => void }) => {
  const [elements, setElements] = useState<ElementDecision[] | null>(null);
  const [regles, setRegles] = useState<RegleAlerte[]>([]);
  const [heure, setHeure] = useState<Date | null>(null);
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const maj = await supabase.rpc('actualiser_alertes');
    const [c, r] = await Promise.all([supabase.rpc('centre_decisions'), supabase.rpc('regles_alertes')]);
    setErreur(maj.error?.message ?? c.error?.message ?? r.error?.message ?? '');
    setElements(c.error ? [] : ((c.data ?? []) as ElementDecision[]));
    setRegles((r.data ?? []) as RegleAlerte[]);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const groupes = useMemo(() => grouperParPriorite(elements ?? []), [elements]);
  const executer = async (fn: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage(succes); await charger();
  };
  const resoudre = (e: ElementDecision) => {
    const motif = (motifs[e.alerte_id!] ?? '').trim();
    executer('resoudre_alerte', { p_alerte: e.alerte_id, p_motif: motif }, 'Alerte résolue.').then(() => setMotifs({ ...motifs, [e.alerte_id!]: '' }));
  };
  const lignes = () => (elements ?? []).map((e) => ({
    priorite: PRIORITES[e.priorite]?.texte ?? e.priorite, nature: e.nature === 'alerte' ? 'Alerte' : 'Décision en attente', categorie: e.categorie,
    objet: e.objet, reference: e.reference ?? '', detail: e.detail ?? '', depuis: e.depuis ?? '', statut: e.statut ?? '',
    condition_levee_le: e.condition_levee_le ?? '', ecran: e.ecran ?? '',
  }));
  const mentions = [`Source : centre_decisions() (alertes du serveur et mes_validations) ; lu le ${heure?.toLocaleString('fr-FR') ?? 'sans données'}`];

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Centre des décisions</h2>
        <p className="text-sm text-stone-500">Alertes calculées par le serveur à partir des données enregistrées et décisions qui vous attendent, par priorité.</p></div>
      <div className="flex gap-2 text-sm">
        <button onClick={charger} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5"><RefreshCw className="h-4 w-4" /> Actualiser</button>
        <button disabled={!elements?.length} onClick={() => exportToCSV(lignes(), 'centre_decisions')} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 disabled:opacity-50"><Download className="h-4 w-4" /> Exporter</button>
        <button disabled={!elements?.length} onClick={() => { if (!imprimerTableau('Centre des décisions', mentions, lignes())) setErreur('Fenêtre d\'impression bloquée par le navigateur.'); }} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 disabled:opacity-50"><Printer className="h-4 w-4" /> Imprimer</button>
      </div>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {heure && <p className="text-xs text-stone-500">{mentions[0]}.</p>}

    {elements === null ? <p>Chargement…</p> : elements.length === 0 ? <SansDonnees message="Aucune alerte ni décision en attente" detail="Les règles en service n'ont rien détecté dans votre périmètre." /> :
      groupes.map((g) => <Panneau key={g.priorite} titre={<span className="flex items-center gap-2">{PRIORITES[g.priorite]?.texte ?? `Priorité ${g.priorite}`} <span className="text-sm font-normal text-stone-500">({g.liste.length})</span></span>}>
        <ul className="divide-y divide-stone-100 text-sm">{g.liste.map((e, n) => <li key={e.alerte_id ?? `${e.objet}-${e.reference}-${n}`} className="flex flex-wrap items-start gap-3 py-3">
          <div className="min-w-64 flex-1">
            <p className="font-semibold text-stone-900"><Puce teinte={PRIORITES[e.priorite]?.teinte ?? 'gris'}>{e.categorie}</Puce> {e.objet}{e.reference ? ` · ${e.reference}` : ''}</p>
            {e.detail && <p className="text-stone-600">{e.detail}</p>}
            <p className="text-xs text-stone-500">Depuis {quand(e.depuis)}{e.detectee_le ? ` · détectée le ${quand(e.detectee_le)}` : ''}{e.statut === 'acknowledged' ? ' · prise en compte' : ''}</p>
            {e.condition_levee_le && <p className="text-xs text-green-800">Condition levée le {quand(e.condition_levee_le)} : à clore avec un motif.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {e.ecran && <button onClick={() => onAllerA(e.ecran!)} className="rounded-lg border border-stone-300 px-3 py-1.5" aria-label={`Ouvrir ${e.objet}`}>Ouvrir</button>}
            {e.nature === 'alerte' && e.alerte_id && <>
              {e.statut === 'active' && <button disabled={busy} onClick={() => executer('prendre_en_compte_alerte', { p_alerte: e.alerte_id }, 'Alerte prise en compte.')}
                className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5" aria-label={`Prendre en compte ${e.objet}`}><Eye className="h-4 w-4" /> Prendre en compte</button>}
              <input aria-label={`Motif de résolution ${e.objet}`} value={motifs[e.alerte_id] ?? ''} onChange={(ev) => setMotifs({ ...motifs, [e.alerte_id!]: ev.target.value })}
                placeholder="Motif de résolution" className="w-56 rounded border border-stone-300 px-2 py-1.5" />
              <button disabled={busy || !(motifs[e.alerte_id] ?? '').trim()} onClick={() => resoudre(e)} aria-label={`Résoudre ${e.objet}`}
                className="flex items-center gap-1 rounded-lg bg-orange-700 px-3 py-1.5 font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Résoudre</button>
            </>}
          </div>
        </li>)}</ul>
      </Panneau>)}

    <Panneau titre="Règles d'alerte">
      {regles.length === 0 ? <SansDonnees message="Règles indisponibles" /> :
        <ul className="divide-y divide-stone-100 text-sm">{regles.map((r) => <li key={r.regle} className="flex flex-wrap justify-between gap-2 py-2">
          <span><b>{r.libelle}</b> <span className="text-xs text-stone-500">{r.domaine} · {r.description}</span></span>
          <Puce teinte={r.en_service ? 'vert' : 'gris'}>{etatRegle(r)}</Puce>
        </li>)}</ul>}
      <p className="mt-3 text-xs text-stone-500">Les seuils et l'activation se règlent dans Paramètres (administrateur). Une règle à seuil reste inactive tant que son seuil n'est pas saisi.</p>
    </Panneau>
  </div>;
};

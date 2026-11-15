import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, Inbox, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';

// Mes validations et notifications (D-056). La boite est calculee par le
// serveur a chaque lecture, selon les droits et la separation des taches ;
// elle oriente vers l'ecran ou la decision se prend, elle n'autorise rien.

interface Element { categorie: string; objet: string; reference: string | null; detail: string | null; depuis: string | null; ecran: string }
interface Notification { id: string; notification_type: string; title: string; message: string | null; read: boolean | null; created_at: string }

const quand = (v: string | null) => (v ? new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'date inconnue');

export const MesValidationsView = ({ onAllerA }: { onAllerA: (vue: string) => void }) => {
  const [elements, setElements] = useState<Element[] | null>(null);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    const [v, n] = await Promise.all([
      supabase.rpc('mes_validations'),
      supabase.from('notifications').select('id, notification_type, title, message, read, created_at').order('created_at', { ascending: false }).limit(100),
    ]);
    setErreur(v.error?.message ?? n.error?.message ?? '');
    setElements(((v.data ?? []) as Element[]).sort((a, b) => (a.depuis ?? '').localeCompare(b.depuis ?? '')));
    setNotifications((n.data ?? []) as Notification[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const marquer = async (ids: string[] | null) => {
    const { error } = await supabase.rpc('marquer_notifications_lues', { p_ids: ids });
    if (error) { setErreur(error.message); return; }
    await charger();
  };
  const nonLues = (notifications ?? []).filter((n) => !n.read);
  const categories = [...new Set((elements ?? []).map((e) => e.categorie))];

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black text-stone-900">Mes validations</h2>
        <p className="text-sm text-stone-500">Ce qui attend votre décision selon vos droits, et les décisions qui vous concernent.</p></div>
      <button onClick={charger} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Actualiser</button>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

    <Panneau titre={`À traiter (${elements?.length ?? 0})`}>
      {elements === null ? <p>Chargement…</p> : elements.length === 0 ? <SansDonnees message="Rien n'attend votre décision" /> :
        <div className="space-y-4">{categories.map((cat) => <div key={cat}>
          <h3 className="mb-1 text-sm font-bold text-stone-700">{cat}</h3>
          <ul className="divide-y divide-stone-100 text-sm">{elements.filter((e) => e.categorie === cat).map((e, i) => <li key={`${e.objet}-${e.reference}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><Inbox className="mr-1 inline h-4 w-4" /><b>{e.objet}</b>{e.reference && ` · ${e.reference}`}{e.detail && <span className="text-stone-600"> · {e.detail}</span>}
              <span className="block text-xs text-stone-500">Depuis le {quand(e.depuis)}</span></span>
            <button onClick={() => onAllerA(e.ecran)} aria-label={`Traiter ${e.objet} ${e.reference ?? ''}`.trim()} className="rounded border border-stone-300 px-2 py-1 text-xs">Ouvrir l'écran</button>
          </li>)}</ul>
        </div>)}</div>}
    </Panneau>

    <Panneau titre={`Notifications (${nonLues.length} non lue${nonLues.length > 1 ? 's' : ''})`}>
      {nonLues.length > 0 && <button onClick={() => marquer(null)} className="mb-3 flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><CheckCheck className="h-3 w-3" /> Tout marquer comme lu</button>}
      {notifications === null ? <p>Chargement…</p> : notifications.length === 0 ? <SansDonnees message="Aucune notification" /> :
        <ul className="divide-y divide-stone-100 text-sm">{notifications.map((n) => <li key={n.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${n.read ? 'text-stone-500' : ''}`}>
          <span><Bell className="mr-1 inline h-4 w-4" /><b>{n.title}</b>{!n.read && <> <Puce teinte="bleu">Nouveau</Puce></>}{n.message && <span className="block text-xs">{n.message}</span>}
            <span className="block text-xs text-stone-500">{quand(n.created_at)}</span></span>
          {!n.read && <button onClick={() => marquer([n.id])} aria-label={`Marquer comme lu ${n.title}`} className="rounded border border-stone-300 px-2 py-1 text-xs">Lu</button>}
        </li>)}</ul>}
    </Panneau>
  </div>;
};

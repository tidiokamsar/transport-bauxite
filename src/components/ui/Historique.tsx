import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Provenance, SansDonnees } from './Panneau';
import type { EvenementHistorique } from './evenements';

// Journal lisible d'un objet (D-090, bibliotheque D-077 « HistoryDrawer »,
// en onglet de page). Les evenements viennent des tables de journal ou des
// horodatages enregistres ; jamais de ligne fabriquee. Le nom de l'auteur
// est lu dans les profils quand ils sont visibles, sinon l'identifiant court.

export const Historique = ({ evenements, erreur, source, absent }: {
  /** null = chargement. */
  evenements: EvenementHistorique[] | null;
  erreur?: string;
  /** Tables lues, citees sous la liste. */
  source: string;
  /** Explication quand le module ne tient aucun journal (ecart documente). */
  absent?: string;
}) => {
  const [noms, setNoms] = useState<Record<string, string>>({});
  const ids = [...new Set((evenements ?? []).map((e) => e.auteur).filter((a): a is string => Boolean(a)))];
  const cleIds = ids.sort().join(',');

  useEffect(() => {
    if (!cleIds) return;
    supabase.from('profiles').select('id, full_name').in('id', cleIds.split(',')).then(({ data }) => {
      const m: Record<string, string> = {};
      ((data ?? []) as { id: string; full_name: string | null }[]).forEach((p) => { if (p.full_name) m[p.id] = p.full_name; });
      setNoms(m);
    });
  }, [cleIds]);

  return (
    <section aria-label="Historique" className="space-y-3">
      {absent && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{absent}</p>}
      {erreur ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
        : evenements === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : evenements.length === 0 ? <SansDonnees message="Aucun événement enregistré" />
            : (
              <ol className="relative space-y-3 border-l border-stone-200 pl-4">
                {evenements.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-orange-500" aria-hidden="true" />
                    <p><b>{e.libelle}</b> · <time dateTime={e.le}>{new Date(e.le).toLocaleString('fr-FR')}</time>
                      {e.auteur && <> · par {noms[e.auteur] ?? `compte ${e.auteur.slice(0, 8)}`}</>}</p>
                    {e.detail && <p className="text-stone-600">{e.detail}</p>}
                    {e.motif && <p className="text-stone-600">Motif : {e.motif}</p>}
                    <p className="text-[11px] text-stone-400">{e.source}</p>
                  </li>
                ))}
              </ol>
            )}
      <Provenance source={source} />
    </section>
  );
};

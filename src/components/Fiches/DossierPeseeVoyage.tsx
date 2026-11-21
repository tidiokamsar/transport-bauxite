import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import type { VoyageRef } from './peseeContexte';

// Dossier de pesee d'un voyage (D-122), servi par dossier_pesee. Valeurs
// originales du ticket, tare figee, net CBG (qui fait foi), net SIGTB
// (controle independant), ecart, tolerance et source, rectifications.

interface Controle {
  brut_cbg: number | null; tare_applicable: number | null; net_cbg: number | null; net_sigtb: number | null;
  ecart_t: number | null; ecart_pct: number | null; tolerance_t: number | null; tolerance_pct: number | null;
  source_tolerance: string | null; dans_tolerance: boolean | null; statut: string; regle: string; detail: string;
}
interface Dossier {
  controle: Controle;
  ticket: { ticket: string; brut: number | null; tare: number | null; net: number | null; mesure_le: string } | null;
  tare_applicable: { tonnes: number | null; statut_reference: string | null; valide_le: string | null; figee_le: string | null };
  rectifications: { id: string; motif: string | null; cree_le: string }[];
  anomalies: { id: string; cle: string; categorie: string; gravite: string; statut: string; description: string | null }[];
}

const STATUT: Record<string, { texte: string; teinte: 'vert' | 'orange' | 'rouge' | 'gris' }> = {
  dans_tolerance: { texte: 'Dans la tolérance', teinte: 'vert' },
  ecart: { texte: 'Écart hors tolérance', teinte: 'rouge' },
  tare_absente: { texte: 'Tare absente', teinte: 'orange' },
  net_cbg_absent: { texte: 'Net CBG absent', teinte: 'orange' },
  sans_ticket: { texte: 'Sans ticket CBG', teinte: 'gris' },
};
const valeur = (v: number | null, unite: string | null) => (v === null || v === undefined ? 'Sans données' : `${formatNombre(Number(v))}${unite ? ` ${unite}` : ''}`);

export const DossierPeseeVoyage = ({ voyages }: { voyages: VoyageRef[] }) => {
  const [recherche, setRecherche] = useState('');
  const [choisi, setChoisi] = useState('');
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [erreur, setErreur] = useState('');

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return voyages.filter((v) => !q || v.reference.toLowerCase().includes(q)).slice(0, 40);
  }, [recherche, voyages]);

  useEffect(() => {
    if (!choisi) { setDossier(null); return; }
    setErreur('');
    supabase.rpc('dossier_pesee', { p_trip: choisi }).then(({ data, error }) => {
      setErreur(error ? error.message : '');
      setDossier(error ? null : ((data ?? null) as Dossier | null));
    });
  }, [choisi]);

  const c = dossier?.controle;
  const statut = c ? STATUT[c.statut] ?? { texte: c.statut, teinte: 'gris' as const } : null;

  return (
    <div className="space-y-4">
      <Panneau titre="Choisir un voyage">
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une référence"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" aria-label="Rechercher un voyage" />
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-stone-200">
          {filtres.length === 0 ? <p className="p-3 text-sm text-stone-500">Aucun voyage ne correspond.</p>
            : filtres.map((v) => (
              <button key={v.id} onClick={() => setChoisi(v.id)}
                className={`block w-full px-3 py-2 text-left text-sm ${choisi === v.id ? 'bg-orange-50 font-semibold text-orange-900' : 'hover:bg-stone-50'}`}>
                {v.reference} · {v.planned_date ?? 'date non renseignée'}
              </button>
            ))}
        </div>
      </Panneau>

      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {!choisi ? <SansDonnees message="Aucun voyage sélectionné" detail="Choisir une référence pour ouvrir son dossier de pesée." />
        : !dossier ? <p role="status" className="text-sm text-stone-500">Chargement du dossier…</p>
          : (
            <div className="space-y-4">
              <Panneau titre="Contrôle du net">
                {!c || !statut ? <SansDonnees message="Aucun contrôle" /> : (
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2"><Puce teinte={statut.teinte}>{statut.texte}</Puce><span className="text-stone-600">{c.detail}</span></div>
                    <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div><dt className="text-xs text-stone-500">Brut CBG</dt><dd className="font-semibold">{valeur(c.brut_cbg, 't')}</dd></div>
                      <div><dt className="text-xs text-stone-500">Tare applicable</dt><dd className="font-semibold">{valeur(c.tare_applicable, 't')}</dd></div>
                      <div><dt className="text-xs text-stone-500">Net communiqué par CBG</dt><dd className="font-semibold">{valeur(c.net_cbg, 't')}</dd></div>
                      <div><dt className="text-xs text-stone-500">Net calculé par SIGTB</dt><dd className="font-semibold">{valeur(c.net_sigtb, 't')}</dd></div>
                      <div><dt className="text-xs text-stone-500">Écart</dt><dd className="font-semibold">{valeur(c.ecart_t, 't')}{c.ecart_pct === null ? '' : ` (${formatNombre(c.ecart_pct)} %)`}</dd></div>
                      <div><dt className="text-xs text-stone-500">Tolérance</dt><dd className="font-semibold">{valeur(c.tolerance_t, 't')}{c.tolerance_pct === null ? '' : ` / ${formatNombre(c.tolerance_pct)} %`}</dd></div>
                      <div><dt className="text-xs text-stone-500">Source de la tolérance</dt><dd className="font-semibold">{c.source_tolerance ?? 'non paramétrée'}</dd></div>
                      <div><dt className="text-xs text-stone-500">Ticket</dt><dd className="font-semibold">{dossier.ticket?.ticket ?? '—'}</dd></div>
                    </dl>
                    <p className="text-xs text-stone-500">{c.regle}. Le net CBG fait foi ; le net SIGTB reste un contrôle (D-096).</p>
                  </div>
                )}
              </Panneau>

              <Panneau titre="Tare figée sur la rotation">
                <p className="text-sm">
                  {dossier.tare_applicable.tonnes === null
                    ? 'Aucune tare de référence figée : la rotation est signalée sans tare, aucune valeur n’est supposée.'
                    : `${formatNombre(Number(dossier.tare_applicable.tonnes))} t · ${dossier.tare_applicable.statut_reference ?? 'statut non renseigné'} · figée le ${dossier.tare_applicable.figee_le ? new Date(dossier.tare_applicable.figee_le).toLocaleString('fr-FR') : '—'}`}
                </p>
              </Panneau>

              <Panneau titre="Rectifications du ticket">
                {dossier.rectifications.length === 0 ? <SansDonnees message="Aucune rectification" /> : (
                  <ul className="space-y-1 text-sm">{dossier.rectifications.map((r) => (
                    <li key={r.id}>{new Date(r.cree_le).toLocaleString('fr-FR')} · {r.motif ?? 'motif non renseigné'}</li>
                  ))}</ul>
                )}
              </Panneau>

              <Panneau titre="Anomalies de pesée">
                {dossier.anomalies.length === 0 ? <SansDonnees message="Aucune anomalie" /> : (
                  <ul className="space-y-1 text-sm">{dossier.anomalies.map((a) => (
                    <li key={a.id}>{a.cle} · {a.categorie} · {a.gravite} · {a.statut}{a.description ? ` · ${a.description}` : ''}</li>
                  ))}</ul>
                )}
              </Panneau>
            </div>
          )}
    </div>
  );
};

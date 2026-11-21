import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';

// Dossier de rotation (D-121) et controle de pesee (D-122), lus par les
// fonctions serveur dossier_rotation et dossier_pesee. Le kilometrage n'est
// affiche que s'il est mesure ; un net non calculable reste « sans donnees »
// avec sa raison. La tracabilite montante indique a quels indicateurs la
// rotation contribue.

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const valeur = (v: number | null | undefined, unite: string | null) =>
  (v === null || v === undefined ? 'Sans données' : `${nombre.format(Number(v))}${unite ? ` ${unite}` : ''}`);

interface DossierRotation {
  lisible: boolean;
  kilometrage: { km_parcourus: number | null; source: string; nb_releves: number };
  pieces: unknown[];
  fiches: unknown[];
  incidents: unknown[];
  evenements: unknown[];
}
interface ControlePesee {
  brut_cbg: number | null; tare_applicable: number | null; net_cbg: number | null; net_sigtb: number | null;
  ecart_t: number | null; ecart_pct: number | null; tolerance_t: number | null; tolerance_pct: number | null;
  source_tolerance: string | null; dans_tolerance: boolean | null; statut: string; regle: string;
  detail: string; source: string;
}
interface DossierPesee {
  controle: ControlePesee;
  ticket: { ticket: string } | null;
  tare_applicable: { tonnes: number | null; statut_reference: string | null; valide_le: string | null; figee_le: string | null };
}
interface Contribution {
  code: string; libelle: string; periode_debut: string; periode_fin: string;
  contribution: number | null; unite: string; source: string;
}

const STATUT_PESEE: Record<string, { texte: string; teinte: 'vert' | 'orange' | 'rouge' | 'gris' }> = {
  dans_tolerance: { texte: 'Dans la tolérance', teinte: 'vert' },
  ecart: { texte: 'Écart hors tolérance', teinte: 'rouge' },
  tare_absente: { texte: 'Tare absente', teinte: 'orange' },
  net_cbg_absent: { texte: 'Net CBG absent', teinte: 'orange' },
  sans_ticket: { texte: 'Sans ticket CBG', teinte: 'gris' },
};

export const DossierRotation = ({ tripId }: { tripId: string }) => {
  const [dossier, setDossier] = useState<DossierRotation | null>(null);
  const [pesee, setPesee] = useState<DossierPesee | null>(null);
  const [contributions, setContributions] = useState<Contribution[] | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.rpc('dossier_rotation', { p_trip: tripId }),
      supabase.rpc('dossier_pesee', { p_trip: tripId }),
      supabase.rpc('indicateurs_de_rotation', { p_trip: tripId }),
    ]).then(([d, p, i]) => {
      const e = d.error ?? p.error ?? i.error;
      setErreur(e ? e.message : '');
      setDossier(d.error ? null : ((d.data ?? null) as DossierRotation | null));
      setPesee(p.error ? null : ((p.data ?? null) as DossierPesee | null));
      setContributions(i.error ? [] : ((i.data ?? []) as Contribution[]));
    });
  }, [tripId]);

  if (erreur) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Dossier indisponible : {erreur}</p>;
  if (!dossier && !pesee) return <p role="status" className="text-sm text-stone-500">Chargement du dossier…</p>;
  if (dossier === null && pesee === null) {
    return <SansDonnees message="Dossier non lisible" detail="Vos droits ne permettent pas de lire ce voyage." />;
  }

  const c = pesee?.controle;
  const statut = c ? STATUT_PESEE[c.statut] ?? { texte: c.statut, teinte: 'gris' as const } : null;

  return (
    <div className="space-y-4">
      <Panneau titre="Kilométrage mesuré">
        <p className="text-2xl font-black text-stone-900">{valeur(dossier?.kilometrage.km_parcourus, 'km')}</p>
        <p className="text-sm text-stone-600">Source : {dossier?.kilometrage.source ?? 'sans donnée'}</p>
        <p className="text-xs text-stone-500">{dossier?.kilometrage.nb_releves ?? 0} relevé(s) compteur rattaché(s) au voyage.</p>
      </Panneau>

      <Panneau titre="Contrôle de pesée CBG">
        {!c || !statut ? <SansDonnees message="Aucun contrôle de pesée" detail="Aucun ticket CBG rattaché à cette rotation." /> : (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Puce teinte={statut.teinte}>{statut.texte}</Puce>
              <span className="text-stone-600">{c.detail}</span>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div><dt className="text-xs text-stone-500">Brut CBG</dt><dd className="font-semibold">{valeur(c.brut_cbg, 't')}</dd></div>
              <div><dt className="text-xs text-stone-500">Tare applicable</dt><dd className="font-semibold">{valeur(c.tare_applicable, 't')}</dd></div>
              <div><dt className="text-xs text-stone-500">Net communiqué par CBG</dt><dd className="font-semibold">{valeur(c.net_cbg, 't')}</dd></div>
              <div><dt className="text-xs text-stone-500">Net calculé par SIGTB</dt><dd className="font-semibold">{valeur(c.net_sigtb, 't')}</dd></div>
              <div><dt className="text-xs text-stone-500">Écart</dt><dd className="font-semibold">{valeur(c.ecart_t, 't')}{c.ecart_pct === null ? '' : ` (${nombre.format(c.ecart_pct)} %)`}</dd></div>
              <div><dt className="text-xs text-stone-500">Tolérance</dt><dd className="font-semibold">{valeur(c.tolerance_t, 't')}{c.tolerance_pct === null ? '' : ` / ${nombre.format(c.tolerance_pct)} %`}</dd></div>
              <div><dt className="text-xs text-stone-500">Source de la tolérance</dt><dd className="font-semibold">{c.source_tolerance ?? 'non paramétrée'}</dd></div>
              <div><dt className="text-xs text-stone-500">Ticket</dt><dd className="font-semibold">{pesee?.ticket?.ticket ?? '—'}</dd></div>
            </dl>
            <p className="text-xs text-stone-500">Règle : {c.regle}. Le net communiqué par CBG fait foi ; le net SIGTB reste un contrôle indépendant (D-096).</p>
            <p className="text-xs text-stone-500">Tare : {pesee?.tare_applicable.tonnes === null || pesee?.tare_applicable.tonnes === undefined
              ? 'aucune tare de référence figée sur la rotation'
              : `${nombre.format(pesee.tare_applicable.tonnes)} t (${pesee.tare_applicable.statut_reference ?? 'statut non renseigné'})`}</p>
          </div>
        )}
      </Panneau>

      <Panneau titre="Contribution aux indicateurs">
        {contributions === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : contributions.length === 0 ? <SansDonnees message="Aucune contribution" detail="Cette rotation n'alimente aucun indicateur de la période, ou vos droits ne le permettent pas." />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Indicateurs auxquels la rotation contribue">
                  <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="py-2">Indicateur</th><th>Période</th><th>Contribution</th><th>Source</th>
                  </tr></thead>
                  <tbody>{contributions.map((x) => (
                    <tr key={x.code} className="border-b border-stone-100">
                      <td className="py-1.5"><b>{x.libelle}</b><span className="block text-xs text-stone-500">{x.code}</span></td>
                      <td>{x.periode_debut} au {x.periode_fin}</td><td>{valeur(x.contribution, x.unite)}</td><td className="text-xs">{x.source}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
      </Panneau>

      <Panneau titre="Pièces et fiches rattachées">
        <p className="text-sm text-stone-700">
          {dossier?.pieces.length ?? 0} pièce(s) jointe(s) · {dossier?.fiches.length ?? 0} fiche(s) terrain ·{' '}
          {dossier?.incidents.length ?? 0} incident(s) · {dossier?.evenements.length ?? 0} événement(s) du cycle.
        </p>
        <p className="mt-1 text-xs text-stone-500">Le détail de chaque pièce et de chaque événement reste dans les onglets « Documents et preuves », « Chronologie » et « Incidents ».</p>
      </Panneau>
    </div>
  );
};

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce } from '../ui/Panneau';

// Catalogue versionne des fiches (D-104, T2) : source documentaire unique
// des 21 familles, lisible par le web et le mobile. Les fonctions serveur
// du cycle (D-089) font autorite ; ce catalogue decrit, il n'execute pas.

interface FicheCatalogue {
  code: string;
  version: number;
  nom: string;
  objectif: string;
  module_proprietaire: string;
  modules_consommateurs: string[];
  profils: string[];
  pieces: string[];
  champs: { champ: string; obligatoire: boolean; regle?: string }[];
  regles_validation: string[];
  statut: 'deployee' | 'en_construction' | 'cible';
}

const STATUTS: Record<FicheCatalogue['statut'], { l: string; t: 'vert' | 'orange' | 'gris' }> = {
  deployee: { l: 'Déployée', t: 'vert' },
  en_construction: { l: 'En construction', t: 'orange' },
  cible: { l: 'Cible', t: 'gris' },
};

export const CatalogueFichesView = () => {
  const [fiches, setFiches] = useState<FicheCatalogue[] | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('v_fiches_catalogue_actives')
      .select('code, version, nom, objectif, module_proprietaire, modules_consommateurs, profils, pieces, champs, regles_validation, statut')
      .order('code');
    if (error) { setErreur(error.message); setFiches([]); return; }
    setFiches((data as FicheCatalogue[] | null) ?? []);
    setChoisie((c) => c ?? (data?.[0] as FicheCatalogue | undefined)?.code ?? null);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const fiche = fiches?.find((f) => f.code === choisie) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-stone-900">Catalogue des fiches</h2>
        <p className="text-stone-500">Source unique des familles de fiches (D-104) : champs, règles, profils et rattachements aux modules. Les fonctions serveur font autorité.</p>
      </div>
      {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {fiches === null ? <div className="h-16" /> : fiches.length === 0 ? (
        <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">Aucune fiche au catalogue.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <nav className="space-y-2 xl:col-span-4" aria-label="Familles de fiches">
            {fiches.map((f) => (
              <button key={f.code} onClick={() => setChoisie(f.code)}
                className={`w-full rounded-2xl border p-3 text-left shadow-carte ${choisie === f.code ? 'border-orange-400 bg-orange-50' : 'border-stone-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold">{f.code}</span>
                  <Puce teinte={STATUTS[f.statut].t}>{STATUTS[f.statut].l}</Puce>
                </div>
                <p className="text-sm text-stone-700">{f.nom}</p>
                <p className="text-xs text-stone-500">v{f.version} · {f.module_proprietaire} · {f.modules_consommateurs.length} modules</p>
              </button>
            ))}
          </nav>
          {fiche && (
            <div className="space-y-4 xl:col-span-8">
              <Panneau titre={`${fiche.code} · ${fiche.nom} (v${fiche.version})`}>
                <p className="text-sm text-stone-700">{fiche.objectif}</p>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-stone-500">Module propriétaire</dt><dd className="font-semibold">{fiche.module_proprietaire}</dd></div>
                  <div><dt className="text-stone-500">Modules consommateurs</dt><dd className="font-semibold">{fiche.modules_consommateurs.join(', ') || '—'}</dd></div>
                  <div><dt className="text-stone-500">Profils autorisés</dt><dd>{fiche.profils.join(', ') || '—'}</dd></div>
                  <div><dt className="text-stone-500">Pièces justificatives</dt><dd>{fiche.pieces.join(' ; ') || '—'}</dd></div>
                </dl>
                {fiche.champs?.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                        <th className="py-2 pr-2 font-medium">Champ</th><th className="py-2 pr-2 font-medium">Obligatoire</th><th className="py-2 font-medium">Règle</th>
                      </tr></thead>
                      <tbody>{fiche.champs.map((c) => (
                        <tr key={c.champ} className="border-b border-stone-100">
                          <td className="py-2 pr-2">{c.champ}</td>
                          <td className="py-2 pr-2">{c.obligatoire ? 'Oui' : 'Facultatif'}</td>
                          <td className="py-2 text-stone-600">{c.regle ?? '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                {fiche.regles_validation?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-stone-700">Règles de validation</p>
                    <ul className="mt-1 list-inside list-disc text-sm text-stone-600">
                      {fiche.regles_validation.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                )}
                <p className="mt-4 border-t border-dashed border-stone-200 pt-2 text-xs text-stone-400">
                  Synchronisation : lot idempotent par client_id (D-103) · Audit : journal append-only du cycle (D-089)
                </p>
              </Panneau>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import { useEffect, useState } from 'react';
import { Plus, Split, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatNombre } from '../Dashboard/indicateurs';
import { CHAMP_FENETRE as CHAMP } from '../ui/Fenetre';
import { PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { lire, trouver } from '../ui/lecture';
import { poserAnnonce, routeDetail } from '../ui/routeur';
import { erreurVentilation, lignesVentilationServeur, type LigneVentilation } from './planAvance';
import { COLONNES_OBJECTIF, MODULE_PLANIFICATION, VUE_PLANIFICATION, type ObjectifVersion } from './objectifs';

// Ventilation d'un objectif par destination et par contrat client (D-063).
// Ecrite une fois par ventiler_objectif ; pour la changer, l'objectif se
// revise (nouvelle version). Un voyage ne porte pas de contrat : le
// realise d'une ligne sans destination n'est pas mesurable.

export interface Ventilation {
  id: string;
  objectif_id: string;
  destination_id: string | null;
  contrat_id: string | null;
  contrat_reference: string | null;
  tonnes_cible: number;
  voyages_cible: number | null;
  mesurable: boolean;
  realise_partage: boolean;
  tonnes_livrees: number | null;
  voyages_livres: number | null;
  voyages_sans_poids: number | null;
}

export interface ContratClient { id: string; reference: string; intitule: string }

export const BlocVentilation = ({ lignes, erreur, nomSite, tonnesObjectif, peutVentiler, lienVentiler }: {
  lignes: Ventilation[];
  /** Erreur de chargement : affichee, jamais confondue avec « non ventile ». */
  erreur?: string;
  nomSite: (id: string) => string;
  tonnesObjectif: number;
  peutVentiler: boolean;
  /** Page de ventilation (D-090). */
  lienVentiler: string;
}) => {
  const total = lignes.reduce((s, l) => s + Number(l.tonnes_cible), 0);
  return (
    <section className="mt-4 rounded-xl border border-stone-200 p-3 text-sm" aria-label="Ventilation de l'objectif">
      <header className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 font-semibold text-stone-700"><Split className="h-4 w-4" /> Destinations et contrats</h4>
        {peutVentiler && !erreur && lignes.length === 0 && (
          <a href={lienVentiler} className="rounded-lg px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50">Ventiler</a>
        )}
      </header>
      {erreur ? (
        <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700" role="alert">{erreur}</p>
      ) : lignes.length === 0 ? (
        <p className="text-xs text-stone-500">Non ventilé : l'objectif vaut pour toutes les destinations et tous les contrats.</p>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead className="text-left text-stone-500">
              <tr><th className="py-1 pr-2">Destination</th><th className="py-1 pr-2">Contrat</th><th className="py-1 pr-2 text-right">Objectif</th><th className="py-1 text-right">Livré</th></tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-t border-stone-100">
                  <td className="py-1 pr-2">{l.destination_id ? nomSite(l.destination_id) : 'Toutes'}</td>
                  <td className="py-1 pr-2">{l.contrat_id ? (l.contrat_reference ?? 'Contrat non visible') : 'Tous'}</td>
                  <td className="py-1 pr-2 text-right font-semibold">{formatNombre(Number(l.tonnes_cible))} t</td>
                  <td className="py-1 text-right">
                    {l.mesurable && l.tonnes_livrees !== null
                      ? <>{formatNombre(Number(l.tonnes_livrees))} t{l.realise_partage ? ' *' : ''}</>
                      : <span className="text-stone-400" title="Un voyage ne porte pas de contrat">Non mesurable</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-stone-400">
            {total < tonnesObjectif ? `${formatNombre(tonnesObjectif - total)} t non ventilées. ` : ''}
            Livré par destination : voyages livrés du site vers ce dépôt.
            {lignes.some((l) => l.realise_partage) ? ' * Réalisé commun à plusieurs contrats de la même destination.' : ''}
            {lignes.some((l) => !l.mesurable) ? ' Sans destination, le réalisé par contrat n\'est pas mesurable (un voyage ne porte pas de contrat).' : ''}
          </p>
        </>
      )}
    </section>
  );
};

const LIGNE_VIDE: LigneVentilation = { destination_id: '', contrat_id: '', tonnes: '' };

/** Ventilation en pleine page (D-063, D-090) : ecrite une fois par ventiler_objectif. */
export const FormulaireVentilation = ({ id }: { id: string }) => {
  const [objectif, setObjectif] = useState<ObjectifVersion | null>(null);
  const [libelle, setLibelle] = useState('Objectif');
  const [destinations, setDestinations] = useState<{ id: string; name: string }[]>([]);
  const [contrats, setContrats] = useState<ContratClient[]>([]);
  const [erreurContrats, setErreurContrats] = useState('');
  const [erreurChargement, setErreurChargement] = useState('');
  const [chargement, setChargement] = useState(true);
  const [lignes, setLignes] = useState<LigneVentilation[]>([{ ...LIGNE_VIDE }]);

  useEffect(() => {
    Promise.all([
      lire<ObjectifVersion>(supabase.from('objectifs_production').select(COLONNES_OBJECTIF).eq('id', id), 'objectif'),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('contrats').select('id, reference, intitule').eq('nature', 'client').eq('statut', 'actif').order('reference'),
    ]).then(([o, s, c]) => {
      const x = trouver(o.lignes, id);
      setObjectif(x);
      setErreurChargement(o.erreur || (x ? (x.statut === 'actif' ? '' : 'Seul un objectif en vigueur se ventile.') : 'Objectif introuvable ou hors de votre périmètre.'));
      const sites = (s.data ?? []) as { id: string; name: string }[];
      setDestinations(sites);
      setErreurContrats(c.error ? 'Contrats clients indisponibles : ' + c.error.message : '');
      setContrats((c.data ?? []) as ContratClient[]);
      if (x) setLibelle(`${sites.find((k) => k.id === x.site_id)?.name ?? 'Site'} · ${new Date(`${x.date_plan}T00:00:00`).toLocaleDateString('fr-FR')}`);
      setChargement(false);
    });
  }, [id]);

  const maj = (i: number, champ: keyof LigneVentilation, v: string) => setLignes(lignes.map((l, j) => (j === i ? { ...l, [champ]: v } : l)));
  const tonnesObjectif = Number(objectif?.tonnes_cible ?? 0);
  const regle = objectif ? erreurVentilation(lignes, tonnesObjectif, objectif.site_id) : null;
  const modifie = JSON.stringify(lignes) !== JSON.stringify([LIGNE_VIDE]);

  return (
    <PageFormulaire
      vue={VUE_PLANIFICATION}
      module={MODULE_PLANIFICATION}
      titre="Ventiler l'objectif"
      reference={libelle}
      id={id}
      description={objectif && <>{libelle} : {formatNombre(tonnesObjectif)} t. La somme des lignes ne dépasse pas l'objectif. La ventilation ne se modifie plus ensuite : pour la changer, révisez l'objectif.</>}
      modifie={modifie}
      erreurs={regle ? [regle] : []}
      libelleSoumettre="Enregistrer la ventilation"
      chargement={chargement}
      erreurChargement={erreurChargement}
      onSoumettre={async () => {
        const { error } = await supabase.rpc('ventiler_objectif', { p_objectif_id: id, p_lignes: lignesVentilationServeur(lignes) });
        if (error) return { erreur: error.message };
        poserAnnonce('Ventilation enregistrée.');
        return { vers: routeDetail(VUE_PLANIFICATION, id, 'relations') };
      }}
    >
      {erreurContrats && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700" role="alert">{erreurContrats}</p>}
      {!erreurContrats && contrats.length === 0 && (
        <p className="rounded-lg bg-stone-50 p-2 text-xs text-stone-500">Aucun contrat client actif visible avec vos droits : ventilation par destination seulement.</p>
      )}
      <SectionFormulaire titre="Lignes de ventilation">
        <div className="space-y-3 sm:col-span-2">
          {lignes.map((l, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-stone-200 p-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-stone-600">Destination {i + 1}</span>
                <select value={l.destination_id} onChange={(e) => maj(i, 'destination_id', e.target.value)} className={CHAMP}>
                  <option value="">Toutes</option>
                  {destinations.filter((d) => d.id !== objectif?.site_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-stone-600">Contrat {i + 1}</span>
                <select value={l.contrat_id} onChange={(e) => maj(i, 'contrat_id', e.target.value)} className={CHAMP}>
                  <option value="">Tous</option>
                  {contrats.map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.intitule}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-stone-600">Tonnes {i + 1}</span>
                <input inputMode="decimal" value={l.tonnes} onChange={(e) => maj(i, 'tonnes', e.target.value)} className={CHAMP} />
              </label>
              <button type="button" onClick={() => setLignes(lignes.filter((_, j) => j !== i))} disabled={lignes.length === 1}
                className="self-end rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30" aria-label={`Retirer la ligne ${i + 1}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setLignes([...lignes, { ...LIGNE_VIDE }])} className="flex items-center gap-1 text-sm font-semibold text-orange-700">
            <Plus className="h-4 w-4" /> Ajouter une ligne
          </button>
        </div>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

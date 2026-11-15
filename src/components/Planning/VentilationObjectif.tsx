import { useState } from 'react';
import { Plus, Split, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatNombre } from '../Dashboard/indicateurs';
import { CHAMP, Fenetre } from './FenetresObjectif';
import { erreurVentilation, lignesVentilationServeur, type LigneVentilation } from './planAvance';

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

export const BlocVentilation = ({ lignes, nomSite, tonnesObjectif, peutVentiler, onVentiler }: {
  lignes: Ventilation[];
  nomSite: (id: string) => string;
  tonnesObjectif: number;
  peutVentiler: boolean;
  onVentiler: () => void;
}) => {
  const total = lignes.reduce((s, l) => s + Number(l.tonnes_cible), 0);
  return (
    <section className="mt-4 rounded-xl border border-stone-200 p-3 text-sm" aria-label="Ventilation de l'objectif">
      <header className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 font-semibold text-stone-700"><Split className="h-4 w-4" /> Destinations et contrats</h4>
        {peutVentiler && lignes.length === 0 && (
          <button onClick={onVentiler} className="rounded-lg px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50">Ventiler</button>
        )}
      </header>
      {lignes.length === 0 ? (
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

export const VentilerObjectif = ({ objectifId, siteChargement, tonnesObjectif, libelle, destinations, contrats, onFermer, onEnregistre }: {
  objectifId: string;
  siteChargement: string;
  tonnesObjectif: number;
  libelle: string;
  destinations: { id: string; name: string }[];
  contrats: ContratClient[];
  onFermer: () => void;
  onEnregistre: () => void;
}) => {
  const [lignes, setLignes] = useState<LigneVentilation[]>([{ ...LIGNE_VIDE }]);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const maj = (i: number, champ: keyof LigneVentilation, v: string) =>
    setLignes(lignes.map((l, j) => (j === i ? { ...l, [champ]: v } : l)));

  const valider = async () => {
    const e = erreurVentilation(lignes, tonnesObjectif, siteChargement);
    if (e) { setErreur(e); return; }
    setEnCours(true);
    setErreur('');
    const { error } = await supabase.rpc('ventiler_objectif', { p_objectif_id: objectifId, p_lignes: lignesVentilationServeur(lignes) });
    setEnCours(false);
    if (error) setErreur(error.message);
    else onEnregistre();
  };

  return (
    <Fenetre
      titre="Ventiler l'objectif"
      onFermer={onFermer}
      pied={<>
        <button onClick={onFermer} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Annuler</button>
        <button onClick={valider} disabled={enCours} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">
          {enCours ? 'Enregistrement...' : 'Enregistrer la ventilation'}
        </button>
      </>}
    >
      <div className="space-y-3 px-6 py-5 text-sm">
        <p className="text-stone-600">
          {libelle} : {formatNombre(tonnesObjectif)} t. La somme des lignes ne dépasse pas l'objectif. La ventilation ne se modifie plus
          ensuite : pour la changer, révisez l'objectif.
        </p>
        {contrats.length === 0 && (
          <p className="rounded-lg bg-stone-50 p-2 text-xs text-stone-500">Aucun contrat client actif visible avec vos droits : ventilation par destination seulement.</p>
        )}
        {lignes.map((l, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-stone-200 p-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-stone-600">Destination {i + 1}</span>
              <select value={l.destination_id} onChange={(e) => maj(i, 'destination_id', e.target.value)} className={CHAMP}>
                <option value="">Toutes</option>
                {destinations.filter((d) => d.id !== siteChargement).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-stone-600">Contrat {i + 1}</span>
              <select value={l.contrat_id} onChange={(e) => maj(i, 'contrat_id', e.target.value)} className={CHAMP}>
                <option value="">Tous</option>
                {contrats.map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.intitule}</option>)}
              </select>
            </label>
            <label className="block">
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
        {erreur && <p className="rounded-lg bg-red-50 p-3 text-red-700">{erreur}</p>}
      </div>
    </Fenetre>
  );
};

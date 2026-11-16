import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';

// Referentiels (D-064) : devises et unites tenues par l'administrateur,
// codes reellement saisis confrontes au referentiel (codes_utilises), et
// numerotations existantes en lecture (sequences_numerotation) : aucun
// format de numero n'est modifie depuis cet ecran.

interface Code { code: string; libelle: string | null; actif: boolean }
interface Utilise { type: string; code: string; source: string; occurrences: number; au_referentiel: boolean }
interface Sequence {
  code: string; libelle: string; modele: string; source: string; sequence_sql: string | null; regle: string;
  compteur: number | null; numeros: number | null; dernier_numero: string | null;
}

const CHAMP = 'rounded border border-stone-300 px-3 py-2 text-sm';

const TableCodes = ({ titre, lignes, fonction, placeholder, onChange }: {
  titre: string; lignes: Code[]; fonction: 'enregistrer_devise' | 'enregistrer_unite'; placeholder: string; onChange: () => Promise<void>;
}) => {
  const [code, setCode] = useState('');
  const [libelle, setLibelle] = useState('');
  const [erreur, setErreur] = useState('');
  const enregistrer = async (c: string, l: string | null, actif: boolean) => {
    setErreur('');
    const { error } = await supabase.rpc(fonction, { p_code: c, p_libelle: l, p_actif: actif });
    if (error) { setErreur(error.message); return; }
    setCode(''); setLibelle('');
    await onChange();
  };
  return (
    <Panneau titre={titre}>
      {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      <div className="mb-3 flex flex-wrap gap-2">
        <input aria-label={`Code ${titre}`} value={code} onChange={(e) => setCode(e.target.value)} placeholder={placeholder} className={`w-32 ${CHAMP}`} />
        <input aria-label={`Libellé ${titre}`} value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Libellé" className={`flex-1 ${CHAMP}`} />
        <button onClick={() => enregistrer(code, libelle || null, true)} className="rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white">Enregistrer</button>
      </div>
      {lignes.length === 0 ? <SansDonnees message="Aucun code au référentiel" /> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Libellé</th><th className="py-2">État</th></tr></thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.code} className="border-b border-stone-100">
                <td className="py-2 pr-3 font-mono">{l.code}</td>
                <td className="py-2 pr-3">{l.libelle ?? 'Libellé non renseigné'}</td>
                <td className="py-2">
                  <button onClick={() => enregistrer(l.code, l.libelle, !l.actif)} className="text-xs underline">
                    {l.actif ? 'Actif (désactiver)' : 'Inactif (réactiver)'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panneau>
  );
};

export const Referentiels = () => {
  const [devises, setDevises] = useState<Code[]>([]);
  const [unites, setUnites] = useState<Code[]>([]);
  const [utilises, setUtilises] = useState<Utilise[] | null>(null);
  const [sequences, setSequences] = useState<Sequence[] | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    const [d, u, c, s] = await Promise.all([
      supabase.from('devises').select('code, libelle, actif').order('code'),
      supabase.from('unites_mesure').select('code, libelle, actif').order('code'),
      supabase.rpc('codes_utilises'),
      supabase.rpc('sequences_numerotation'),
    ]);
    const e = d.error ?? u.error ?? c.error ?? s.error;
    setErreur(e ? e.message : '');
    setDevises((d.data as Code[] | null) ?? []);
    setUnites((u.data as Code[] | null) ?? []);
    setUtilises((c.data as Utilise[] | null) ?? []);
    setSequences((s.data as Sequence[] | null) ?? []);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  return (
    <div className="space-y-6">
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      <div className="grid gap-6 xl:grid-cols-2">
        <TableCodes titre="Devises" lignes={devises} fonction="enregistrer_devise" placeholder="GNF" onChange={charger} />
        <TableCodes titre="Unités de mesure" lignes={unites} fonction="enregistrer_unite" placeholder="tonne" onChange={charger} />
      </div>

      <Panneau titre="Codes saisis dans les données">
        <p className="mb-3 text-sm text-stone-500">Devises et unités réellement présentes dans les contrats, factures, paiements et coûts. Un code hors référentiel est signalé, jamais corrigé automatiquement.</p>
        {utilises === null ? <p className="text-sm">Chargement…</p> : utilises.length === 0 ? <SansDonnees message="Sans données" detail="Aucun code saisi." /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-stone-500"><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Saisi dans</th><th className="py-2 pr-3">Occurrences</th><th className="py-2">Référentiel</th></tr></thead>
            <tbody>
              {utilises.map((u) => (
                <tr key={`${u.source}-${u.code}`} className="border-b border-stone-100">
                  <td className="py-2 pr-3">{u.type === 'devise' ? 'Devise' : 'Unité'}</td>
                  <td className="py-2 pr-3 font-mono">{u.code}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{u.source}</td>
                  <td className="py-2 pr-3">{u.occurrences}</td>
                  <td className="py-2">{u.au_referentiel ? <Puce teinte="vert">Au référentiel</Puce> : <Puce teinte="orange">Hors référentiel</Puce>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Provenance source="fonction codes_utilises" heure={heure} />
      </Panneau>

      <Panneau titre="Séquences de numérotation">
        <p className="mb-3 text-sm text-stone-500">Numérotations attribuées par le serveur, en lecture. Le compteur est la dernière valeur de la séquence ; le dernier numéro est le plus grand numéro conforme au format.</p>
        {sequences === null ? <p className="text-sm">Chargement…</p> : sequences.length === 0 ? <SansDonnees message="Sans données" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-stone-500">
                <th className="py-2 pr-3">Préfixe</th><th className="py-2 pr-3">Objet</th><th className="py-2 pr-3">Format</th><th className="py-2 pr-3">Règle</th>
                <th className="py-2 pr-3">Compteur</th><th className="py-2 pr-3">Numéros</th><th className="py-2">Dernier numéro</th>
              </tr></thead>
              <tbody>
                {sequences.map((s) => (
                  <tr key={s.code} className="border-b border-stone-100">
                    <td className="py-2 pr-3 font-mono font-semibold">{s.code}</td>
                    <td className="py-2 pr-3">{s.libelle}<span className="block font-mono text-xs text-stone-400">{s.source}</span></td>
                    <td className="py-2 pr-3 font-mono text-xs">{s.modele}</td>
                    <td className="py-2 pr-3">{s.regle}</td>
                    <td className="py-2 pr-3">{s.sequence_sql ? (s.compteur ?? 'Jamais utilisée') : '-'}</td>
                    <td className="py-2 pr-3">{s.numeros ?? '-'}</td>
                    <td className="py-2 font-mono text-xs">{s.dernier_numero ?? 'Sans données'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Provenance source="fonction sequences_numerotation (pg_sequences et tables numérotées)" heure={heure} />
      </Panneau>
    </div>
  );
};

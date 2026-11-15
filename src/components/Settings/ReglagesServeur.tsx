import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau } from '../ui/Panneau';
import { CLES_REGLAGES, REGLAGES, valeurAffichee, valeurValide, type Reglage } from './reglages';

// Parametres generaux (D-061) : uniquement les reglages lus par le serveur,
// avec leur effet reel. Ceux qui ont un ecran dedie y restent modifiables
// (lecture seule ici). Aucune valeur n'est proposee par defaut : une cle
// absente applique le comportement indique.

export const ReglagesServeur = ({ peutEcrire }: { peutEcrire: boolean }) => {
  const [valeurs, setValeurs] = useState<Record<string, string> | null>(null);
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('settings').select('key, value').in('key', CLES_REGLAGES);
    if (error) { setErreur(error.message); setValeurs({}); return; }
    const v: Record<string, string> = {};
    for (const l of data ?? []) {
      const brute = (l.value as { value?: unknown } | null)?.value;
      if (brute !== undefined && brute !== null) v[l.key as string] = String(brute);
    }
    setValeurs(v);
    setSaisies({});
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async (r: Reglage) => {
    const saisie = (saisies[r.cle] ?? '').trim();
    setErreur(''); setMessage('');
    if (!valeurValide(r, saisie)) { setErreur(`${r.libelle} : ${r.type === 'booleen' ? 'choisissez oui ou non' : 'nombre positif attendu'}.`); return; }
    setBusy(true);
    const { error } = await supabase.from('settings').upsert(
      { key: r.cle, value: { value: saisie }, category: 'serveur', description: `${r.libelle} (${r.lecteur})` },
      { onConflict: 'key' },
    );
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage(`${r.libelle} : enregistré.`);
    await charger();
  };

  return (
    <Panneau titre="Paramètres lus par le serveur">
      <p className="mb-4 text-sm text-stone-500">
        Seuls ces réglages ont un effet : ils sont lus par les fonctions serveur indiquées. Une clé absente applique le comportement décrit.
      </p>
      {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {message && <p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {valeurs === null ? <p className="text-sm">Chargement…</p> : (
        <ul className="divide-y divide-stone-100">
          {REGLAGES.map((r) => {
            const actuelle = valeurs[r.cle];
            const saisie = saisies[r.cle] ?? actuelle ?? '';
            const modifiable = peutEcrire && !r.ecran;
            return (
              <li key={r.cle} className="grid gap-2 py-3 md:grid-cols-[1fr_auto]" aria-label={`Réglage ${r.libelle}`}>
                <div>
                  <p className="font-semibold text-stone-900">{r.libelle} <span className="font-mono text-xs text-stone-400">{r.cle}</span></p>
                  <p className="text-sm text-stone-600">{r.effet}</p>
                  <p className="text-xs text-stone-500">Valeur actuelle : <strong>{valeurAffichee(r, actuelle)}</strong> · lu par {r.lecteur}</p>
                  {r.ecran && <p className="text-xs text-stone-500">Se règle depuis : {r.ecran.libelle}</p>}
                </div>
                {modifiable && (
                  <div className="flex items-end gap-2">
                    {r.type === 'booleen' ? (
                      <select aria-label={r.libelle} value={saisie} onChange={(e) => setSaisies({ ...saisies, [r.cle]: e.target.value })}
                        className="rounded border border-stone-300 px-3 py-2 text-sm">
                        <option value="">Choisir</option>
                        <option value="true">Oui</option>
                        <option value="false">Non</option>
                      </select>
                    ) : (
                      <input aria-label={r.libelle} inputMode="decimal" value={saisie} placeholder={r.unite}
                        onChange={(e) => setSaisies({ ...saisies, [r.cle]: e.target.value })}
                        className="w-28 rounded border border-stone-300 px-3 py-2 text-sm" />
                    )}
                    <button disabled={busy || saisies[r.cle] === undefined} onClick={() => enregistrer(r)}
                      className="rounded-lg bg-orange-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panneau>
  );
};

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Identite legale de la societe (D-027), imprimee sur les factures, les
// notifications d'ecart et les fiches terrain. Lisible par tous les
// connectes, modifiable avec le droit Parametres. Champ vide = a saisir :
// aucune valeur n'est inventee.

interface Societe {
  raison_sociale: string;
  rccm: string | null;
  nif: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string | null;
  telephone: string | null;
  email: string | null;
  signataire_nom: string | null;
  signataire_fonction: string | null;
  modifie_le: string;
}

const CHAMPS: [keyof Societe, string][] = [
  ['raison_sociale', 'Raison sociale'],
  ['rccm', 'RCCM'],
  ['nif', 'NIF'],
  ['adresse', 'Adresse'],
  ['ville', 'Ville'],
  ['pays', 'Pays'],
  ['telephone', 'Téléphone'],
  ['email', 'E-mail'],
  ['signataire_nom', 'Signataire des factures'],
  ['signataire_fonction', 'Fonction du signataire'],
];

export const FicheSociete = ({ peutEcrire }: { peutEcrire: boolean }) => {
  const [societe, setSociete] = useState<Societe | null>(null);
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    supabase.from('societe').select('*').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) setMessage('Fiche société indisponible : ' + error.message);
      setSociete(data as Societe | null);
    });
  }, []);

  const enregistrer = async () => {
    if (!societe) return;
    setEnCours(true);
    setMessage('');
    const { data: u } = await supabase.auth.getUser();
    const ligne = Object.fromEntries(CHAMPS.map(([k]) => {
      const v = societe[k];
      return [k, typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v];
    }));
    const { error } = await supabase.from('societe')
      .update({ ...ligne, modifie_le: new Date().toISOString(), modifie_par: u.user?.id ?? null })
      .eq('id', 1);
    setEnCours(false);
    setMessage(error ? 'Erreur : ' + error.message : 'Fiche société enregistrée.');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-slate-900">Société</h2>
      <p className="mb-4 text-sm text-slate-500">Identité imprimée sur les factures, notifications et fiches terrain.</p>
      {!societe ? (
        <p className="text-sm text-slate-400">{message || 'Chargement...'}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHAMPS.map(([k, libelle]) => (
            <label key={k} className={`block text-sm ${k === 'adresse' || k === 'raison_sociale' ? 'sm:col-span-2' : ''}`}>
              <span className="mb-1 block font-medium text-slate-700">{libelle}{k === 'raison_sociale' ? ' *' : ''}</span>
              <input
                value={(societe[k] as string | null) ?? ''}
                onChange={(e) => setSociete({ ...societe, [k]: e.target.value })}
                disabled={!peutEcrire}
                placeholder="À saisir"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
          ))}
          <p className="text-xs text-slate-400 sm:col-span-2">Dernière modification : {new Date(societe.modifie_le).toLocaleString('fr-FR')}</p>
          {message && <p className={`rounded-lg p-2 text-sm sm:col-span-2 ${message.startsWith('Erreur') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message}</p>}
          {peutEcrire && (
            <div className="sm:col-span-2">
              <button onClick={enregistrer} disabled={enCours || !societe.raison_sociale.trim()} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                {enCours ? 'Enregistrement...' : 'Enregistrer la fiche société'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

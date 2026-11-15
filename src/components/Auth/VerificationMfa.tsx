import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { codeValide, nettoyerCode } from './mfa';

// Etape de connexion (D-045) : un compte qui a inscrit un facteur TOTP
// saisit son code avant d'acceder a l'application ; la session passe en aal2.

export const VerificationMfa = ({ onVerifie, onDeconnexion }: { onVerifie: () => void; onDeconnexion: () => void }) => {
  const [facteur, setFacteur] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) { setErreur(error.message); return; }
      setFacteur(data.totp[0]?.id ?? null);
    });
  }, []);

  const verifier = async () => {
    if (!facteur) return;
    setEnCours(true); setErreur('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: facteur, code: nettoyerCode(code) });
    setEnCours(false);
    if (error) { setErreur('Code refusé : vérifiez l\'heure de votre téléphone et réessayez.'); setCode(''); return; }
    onVerifie();
  };

  return <div className="flex min-h-screen items-center justify-center bg-[#1a1411] p-4">
    <div role="dialog" aria-label="Vérification en deux étapes" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
      <ShieldCheck className="mb-3 h-10 w-10 text-orange-700" />
      <h1 className="text-xl font-black text-stone-900">Vérification en deux étapes</h1>
      <p className="mt-1 text-sm text-stone-600">Saisissez le code à 6 chiffres affiché par votre application d'authentification.</p>
      <form onSubmit={(e) => { e.preventDefault(); verifier(); }} className="mt-4 space-y-3">
        <input aria-label="Code de vérification" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code}
          onChange={(e) => setCode(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-3 text-center font-mono text-2xl tracking-[0.4em]" />
        {erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}
        <button type="submit" disabled={enCours || !facteur || !codeValide(code)} className="w-full rounded-lg bg-orange-700 py-3 font-bold text-white disabled:opacity-50">Vérifier</button>
      </form>
      <button onClick={onDeconnexion} className="mt-3 w-full text-sm text-stone-500 hover:underline">Se déconnecter</button>
    </div>
  </div>;
};

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce } from '../ui/Panneau';
import { codeValide, nettoyerCode, urlQrCode } from './mfa';

// Securite du compte (D-045) : inscription d'un facteur TOTP, liste et
// retrait des facteurs. L'administrateur active ensuite l'exigence aal2 pour
// les operations sensibles (reglage settings mfa_exige, garde serveur D-040).

interface Facteur { id: string; friendly_name?: string; factor_type: string; status: string; created_at: string }
interface Inscription { id: string; qr: string; secret: string }

export const SecuriteCompte = () => {
  const { profile } = useAuth();
  const estAdmin = profile?.role === 'admin';
  const [facteurs, setFacteurs] = useState<Facteur[] | null>(null);
  const [niveau, setNiveau] = useState<string | null>(null);
  const [inscription, setInscription] = useState<Inscription | null>(null);
  const [code, setCode] = useState('');
  const [mfaExige, setMfaExige] = useState<boolean | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    const [f, a] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    if (f.error) setErreur(f.error.message);
    setFacteurs(((f.data?.all ?? []) as Facteur[]).filter((x) => x.factor_type === 'totp'));
    setNiveau(a.data?.currentLevel ?? null);
    if (estAdmin) {
      const { data } = await supabase.from('settings').select('value').eq('key', 'mfa_exige').maybeSingle();
      setMfaExige((data?.value as { value?: string } | null)?.value === 'true');
    }
  }, [estAdmin]);
  useEffect(() => { charger(); }, [charger]);

  const verifies = (facteurs ?? []).filter((f) => f.status === 'verified');

  const commencer = async () => {
    setEnCours(true); setErreur(''); setMessage('');
    // Un facteur non verifie d'une tentative precedente est retire d'abord.
    for (const f of (facteurs ?? []).filter((x) => x.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'SIGTB', friendlyName: `SIGTB ${new Date().toLocaleDateString('fr-FR')}` });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setInscription({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode('');
  };
  const confirmer = async () => {
    if (!inscription) return;
    setEnCours(true); setErreur('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: inscription.id, code: nettoyerCode(code) });
    setEnCours(false);
    if (error) { setErreur('Code refusé : vérifiez l\'heure de votre téléphone et réessayez.'); return; }
    setInscription(null); setMessage('Double authentification activée pour votre compte.');
    await charger();
  };
  const retirer = async (f: Facteur) => {
    if (!window.confirm('Retirer ce facteur ? Votre compte ne sera plus protégé par la double authentification.')) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) { setErreur(`Retrait impossible : ${error.message}. Reconnectez-vous avec votre code puis réessayez.`); return; }
    setMessage('Facteur retiré.'); await charger();
  };
  const basculerExigence = async (actif: boolean) => {
    const texte = actif
      ? 'Exiger la double authentification pour les droits, les rectifications de tickets et la signature des factures ? Les comptes concernés doivent avoir inscrit leur facteur, sinon ces opérations leur seront refusées.'
      : 'Lever l\'exigence de double authentification pour les opérations sensibles ?';
    if (!window.confirm(texte)) return;
    const { error } = await supabase.from('settings').upsert(
      { key: 'mfa_exige', value: { value: String(actif) }, category: 'securite', description: 'Exiger aal2 pour les operations sensibles (D-040)' },
      { onConflict: 'key' });
    if (error) { setErreur(error.message); return; }
    setMessage(actif ? 'Exigence activée.' : 'Exigence levée.'); await charger();
  };

  return <div className="space-y-5">
    <header>
      <h2 className="text-2xl font-black text-stone-900">Sécurité du compte</h2>
      <p className="text-sm text-stone-500">Double authentification par application (Google Authenticator, Microsoft Authenticator, Authy…).</p>
    </header>
    {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

    <Panneau titre="Double authentification">
      <p className="mb-3 text-sm">État : {verifies.length > 0 ? <Puce teinte="vert">Activée</Puce> : <Puce teinte="orange">Non activée</Puce>}
        <span className="ml-2 text-stone-500">Session actuelle : {niveau === 'aal2' ? 'vérifiée en deux étapes' : 'mot de passe seul'}</span></p>
      {facteurs && verifies.length > 0 && <ul className="mb-3 divide-y divide-stone-100 text-sm">{verifies.map((f) => <li key={f.id} className="flex items-center justify-between py-2">
        <span className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-stone-500" /> {f.friendly_name ?? 'Application d\'authentification'} · inscrit le {new Date(f.created_at).toLocaleDateString('fr-FR')}</span>
        <button onClick={() => retirer(f)} className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs"><Trash2 className="h-3 w-3" /> Retirer</button></li>)}</ul>}
      {!inscription && verifies.length === 0 && <button disabled={enCours || facteurs === null} onClick={commencer} className="flex items-center gap-2 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><ShieldCheck className="h-4 w-4" /> Activer la double authentification</button>}
      {inscription && <div className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-700">
          <li>Scannez ce code avec votre application d'authentification.</li>
          <li>Saisissez le code à 6 chiffres qu'elle affiche.</li>
        </ol>
        <img src={urlQrCode(inscription.qr)} alt="QR code d'inscription" className="h-48 w-48 rounded border border-stone-200" />
        <label className="block text-xs text-stone-500">Clé à saisir si le scan est impossible
          <input type="password" readOnly value={inscription.secret} onFocus={(e) => { e.currentTarget.type = 'text'; }} className="mt-1 w-full max-w-sm rounded border border-stone-300 px-3 py-2 font-mono text-sm" /></label>
        <div className="flex items-end gap-2">
          <label className="text-sm">Code<input aria-label="Code de confirmation" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-36 rounded border border-stone-300 px-3 py-2 font-mono" /></label>
          <button disabled={enCours || !codeValide(code)} onClick={confirmer} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Confirmer</button>
          <button onClick={() => setInscription(null)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
        </div>
      </div>}
    </Panneau>

    {estAdmin && <Panneau titre="Exigence pour les opérations sensibles (administrateur)">
      <p className="mb-3 text-sm text-stone-600">Quand l'exigence est active, le serveur refuse sans session vérifiée en deux étapes : la modification des droits par utilisateur, la rectification d'un ticket de pesée CBG et la signature d'une facture. Activez-la après l'inscription du facteur de chaque compte concerné (administrateur, directeur, chargé de contrats).</p>
      <p className="mb-3 text-sm">État : {mfaExige === null ? '…' : mfaExige ? <Puce teinte="vert">Exigée</Puce> : <Puce teinte="gris">Non exigée</Puce>}</p>
      {mfaExige === false && <button onClick={() => basculerExigence(true)} disabled={verifies.length === 0} title={verifies.length === 0 ? 'Activez d\'abord la double authentification de votre compte' : undefined} className="flex items-center gap-2 rounded-lg bg-stone-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><ShieldCheck className="h-4 w-4" /> Exiger</button>}
      {mfaExige && <button onClick={() => basculerExigence(false)} className="flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm"><ShieldOff className="h-4 w-4" /> Lever l'exigence</button>}
    </Panneau>}
  </div>;
};

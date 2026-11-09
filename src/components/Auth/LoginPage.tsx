import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  LogIn, AlertCircle, Eye, EyeOff, Mail, Lock, Target, Truck, Layers, BarChart3,
  ShieldCheck, HelpCircle,
} from 'lucide-react';
import { Embleme, NOM_PRODUIT } from '../Brand/Marque';
import { CLE_SOUVENIR, supabase } from '../../lib/supabase';

// Page de connexion, maquette du proprietaire (2026-11-09, D-018).
// La connexion Microsoft 365 n'apparait que si elle est configuree cote
// serveur (fournisseur Azure de GoTrue) : VITE_AUTH_MICROSOFT=true.

const ATOUTS = [
  { icone: Target, texte: 'Planification\nde la production' },
  { icone: Truck, texte: 'Suivi de flotte\nen temps réel' },
  { icone: Layers, texte: 'Gestion\ndes voyages' },
  { icone: BarChart3, texte: 'Coûts &\nperformance' },
  { icone: ShieldCheck, texte: 'Sécurité &\ntraçabilité' },
];

const MICROSOFT_ACTIF = import.meta.env.VITE_AUTH_MICROSOFT === 'true';

const FONDU_PHOTO = 'linear-gradient(to top, black 62%, transparent 100%), linear-gradient(to left, transparent 0%, black 30%)';

const lireSouvenir = () => {
  try {
    return localStorage.getItem(CLE_SOUVENIR) !== '0';
  } catch {
    return true;
  }
};

const LogoMicrosoft = () => (
  <svg viewBox="0 0 21 21" className="h-5 w-5" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

const champ =
  'w-full rounded-xl border border-stone-300 bg-white py-3.5 pl-12 text-stone-800 placeholder-stone-400 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30';

export const LoginPage = () => {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [souvenir, setSouvenir] = useState(lireSouvenir);
  const [aide, setAide] = useState<'oubli' | 'aide' | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const enregistrerSouvenir = () => {
    try {
      localStorage.setItem(CLE_SOUVENIR, souvenir ? '1' : '0');
    } catch {
      // Stockage indisponible : la session reste en memoire.
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    enregistrerSouvenir();
    try {
      await signIn(formData.email, formData.password);
    } catch {
      setError('Échec de la connexion : email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const connexionMicrosoft = async () => {
    enregistrerSouvenir();
    const { error: erreur } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { scopes: 'email', redirectTo: window.location.origin },
    });
    if (erreur) setError('Connexion Microsoft 365 indisponible.');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#2a1209] text-white">
      {/* Ciel de poussiere et photo de mine */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_0%,#e07a35_0%,#8a3a17_38%,#3a170b_72%,#2a1209_100%)]" />
      <img
        src="/images/connexion-tombereau.webp"
        alt=""
        aria-hidden="true"
        style={{ maskImage: FONDU_PHOTO, WebkitMaskImage: FONDU_PHOTO, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' }}
        className="absolute bottom-0 left-0 h-[48%] w-full object-cover object-left-bottom lg:w-[66%]"
      />
      <div className="absolute inset-y-0 right-0 hidden w-[44%] bg-gradient-to-l from-[#3a170b] via-[#3a170b]/70 to-transparent lg:block" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/25" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-14">
        <section className="flex max-w-3xl flex-col lg:min-h-[86vh]">
          <div className="flex items-center gap-4">
            <Embleme className="h-16 w-16 rounded-2xl shadow-2xl sm:h-20 sm:w-20" />
            <div>
              <p className="text-4xl font-black tracking-tight sm:text-5xl">{NOM_PRODUIT}</p>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90 sm:text-lg">Transport de bauxite</p>
            </div>
          </div>

          <h1 className="texte-relief mt-10 text-3xl font-black leading-tight sm:text-5xl">
            Le système de pilotage du transport de <span className="text-orange-400">bauxite</span>
          </h1>
          <p className="texte-relief mt-4 hidden max-w-2xl text-xl text-stone-100 sm:block">
            Planifiez, suivez et optimisez l'ensemble de vos opérations de transport minier.
          </p>

          <ul className="mt-8 hidden grid-cols-5 gap-2 md:grid">
            {ATOUTS.map(({ icone: Icone, texte }) => (
              <li
                key={texte}
                className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-2 py-4 text-center backdrop-blur-sm"
              >
                <Icone className="h-9 w-9 text-orange-100" strokeWidth={1.5} />
                <span className="whitespace-pre-line text-sm leading-tight text-white/90">{texte}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto hidden pt-10 lg:block">
            <p className="max-w-md border-l-4 border-orange-500 bg-black/35 px-4 py-2 text-lg leading-snug backdrop-blur-sm">
              De la fosse à la livraison,<br />une chaîne optimale, maîtrisée et traçable.
            </p>
          </div>
        </section>

        <section className="w-full max-w-xl lg:w-[38%]">
          <div className="rounded-[2rem] bg-white/95 px-7 py-9 text-stone-900 shadow-2xl backdrop-blur-md sm:px-12">
            <div className="mb-7 flex flex-col items-center text-center">
              <Embleme className="mb-5 h-20 w-20 rounded-2xl shadow-lg" />
              <h2 className="text-3xl font-black">
                Connexion à <span className="text-orange-500">{NOM_PRODUIT}</span>
              </h2>
              <p className="mt-2 text-stone-600">Accédez à votre espace d'exploitation</p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="connexion-email" className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-800">
                  <Mail className="h-4 w-4" /> Adresse e-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <input
                    id="connexion-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`${champ} pr-4`}
                    placeholder="votre@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="connexion-mdp" className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-800">
                  <Lock className="h-4 w-4" /> Mot de passe
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <input
                    id="connexion-mdp"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`${champ} pr-12`}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700"
                  >
                    {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-stone-700">
                  <input
                    type="checkbox"
                    checked={souvenir}
                    onChange={(e) => setSouvenir(e.target.checked)}
                    className="h-5 w-5 rounded accent-orange-500"
                  />
                  Se souvenir de moi
                </label>
                <button
                  type="button"
                  onClick={() => setAide(aide === 'oubli' ? null : 'oubli')}
                  className="font-medium text-orange-600 underline underline-offset-2 hover:text-orange-700"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {aide === 'oubli' && (
                <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-900">
                  La réinitialisation par e-mail n'est pas encore activée. Demandez à l'administrateur de la
                  plateforme de vous attribuer un nouveau mot de passe.
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-orange-800 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-6 w-6" />
                    <span>Se connecter</span>
                  </>
                )}
              </button>
            </form>

            {MICROSOFT_ACTIF && (
              <>
                <div className="my-5 flex items-center gap-4 text-sm text-stone-500">
                  <span className="h-px flex-1 bg-stone-200" />ou<span className="h-px flex-1 bg-stone-200" />
                </div>
                <button
                  type="button"
                  onClick={connexionMicrosoft}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-orange-300 bg-white px-6 py-3.5 font-semibold text-stone-800 transition hover:bg-orange-50"
                >
                  <LogoMicrosoft /> Se connecter avec Microsoft 365
                </button>
              </>
            )}

            <div className="mt-7 flex flex-wrap items-center justify-center gap-4 text-sm text-stone-600">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-orange-600" /> Connexion sécurisée (HTTPS)
              </span>
              <span className="h-4 w-px bg-stone-300" />
              <button type="button" onClick={() => setAide(aide === 'aide' ? null : 'aide')} className="flex items-center gap-1.5 hover:text-stone-900">
                <HelpCircle className="h-4 w-4" /> Besoin d'aide ?
              </button>
            </div>
            {aide === 'aide' && (
              <p className="mt-4 rounded-xl bg-stone-50 p-3 text-center text-sm text-stone-600">
                Les comptes sont créés par l'administrateur de la plateforme. En cas de problème d'accès,
                contactez-le.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogIn, AlertCircle, Eye, EyeOff, Mountain, Truck, ShieldCheck } from 'lucide-react';
import { SceneMine } from '../Brand/SceneMine';
import { Embleme, NOM_PRODUIT, DESCRIPTION_PRODUIT } from '../Brand/Marque';

const ATOUTS = [
  { icone: Mountain, texte: 'De la fosse au point de livraison' },
  { icone: Truck, texte: 'Flotte, engins et rotations' },
  { icone: ShieldCheck, texte: 'Accès par rôle, données tracées' },
];

export const LoginPage = () => {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(formData.email, formData.password);
    } catch {
      setError('Échec de la connexion : email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-bauxite-950">
      <SceneMine className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-gradient-to-r from-bauxite-950/75 via-bauxite-950/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-bauxite-950/50 to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-between gap-10 px-6 py-8 lg:flex-row lg:items-center lg:px-12">
        <section className="max-w-xl text-white lg:pb-24">
          <div className="mb-6 flex items-center gap-4 sm:mb-8">
            <Embleme className="h-14 w-14 shadow-2xl" />
            <div>
              <p className="text-3xl font-black tracking-tight">{NOM_PRODUIT}</p>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-bauxite-200">Transport de bauxite</p>
            </div>
          </div>
          <h1 className="texte-relief text-3xl font-black leading-tight sm:text-5xl">
            Chaque tonne suivie, de la fosse à la livraison.
          </h1>
          <p className="texte-relief mt-4 hidden text-lg text-stone-200 sm:block">{DESCRIPTION_PRODUIT}.</p>
          <ul className="mt-8 hidden space-y-3 sm:block">
            {ATOUTS.map(({ icone: Icone, texte }) => (
              <li key={texte} className="flex items-center gap-3 text-stone-100">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 backdrop-blur-sm">
                  <Icone className="h-5 w-5 text-bauxite-200" />
                </span>
                <span className="texte-relief font-medium">{texte}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full max-w-md lg:mb-16">
          <div className="rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur-md sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-stone-900">Connexion</h2>
              <p className="mt-1 text-stone-600">Accédez à votre espace d'exploitation</p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="connexion-email" className="mb-2 block text-sm font-semibold text-stone-700">
                  Adresse email
                </label>
                <input
                  id="connexion-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border-2 border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 placeholder-stone-400 transition-all focus:border-bauxite-500 focus:ring-2 focus:ring-bauxite-500"
                  placeholder="votre@email.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="connexion-mdp" className="mb-2 block text-sm font-semibold text-stone-700">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="connexion-mdp"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-xl border-2 border-stone-200 bg-stone-50 px-4 py-3 pr-12 text-stone-800 placeholder-stone-400 transition-all focus:border-bauxite-500 focus:ring-2 focus:ring-bauxite-500"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-bauxite-600 to-bauxite-800 px-6 py-4 font-bold text-white shadow-lg transition-all hover:from-bauxite-700 hover:to-bauxite-900 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    <span>Se connecter</span>
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-stone-500">
              Comptes créés par l'administrateur de la plateforme.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

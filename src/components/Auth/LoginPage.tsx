import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogIn, Shield, AlertCircle, Eye, EyeOff, Truck } from 'lucide-react';

const demoAccounts = [
  {
    role: 'admin',
    email: 'admin@dariholding.gn',
    password: 'S@liou170213',
    name: 'Abdoulaye Diallo',
    title: 'Administrateur Système',
    icon: Shield,
    color: 'from-orange-500 to-red-600',
    description: 'Accès complet à tous les modules'
  }
];

export const LoginPage = () => {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemoAccounts, setShowDemoAccounts] = useState(true);
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
    } catch (err: any) {
      setError(err.message || 'Échec de la connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (account: typeof demoAccounts[0]) => {
    setError('');
    setLoading(true);
    setFormData({ email: account.email, password: account.password });

    try {
      await signIn(account.email, account.password);
    } catch (err: any) {
      setError('Compte démo non disponible. Utilisez les identifiants de test.');
      setShowDemoAccounts(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-200 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-red-200 rounded-full opacity-20 blur-3xl"></div>
      </div>

      <div className="w-full max-w-6xl relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex flex-col items-center mb-6">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl shadow-2xl p-8 mb-6 transform hover:scale-105 transition-all duration-300">
              <Truck className="w-32 h-32 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-red-600 to-orange-700 mb-2">
                DARI HOLDING
              </h1>
              <p className="text-slate-600 text-lg font-medium">Gestion Intégrée de Transport de Bauxite</p>
              <p className="text-slate-500 text-sm mt-1">Plateforme de gestion complète de flotte</p>
            </div>
          </div>
        </div>

        {showDemoAccounts ? (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-800 mb-2">Compte de Démonstration</h2>
              <p className="text-slate-600">Cliquez pour accéder au système avec le compte administrateur</p>
            </div>

            <div className="max-w-md mx-auto mb-8">
              {demoAccounts.map((account) => {
                const Icon = account.icon;
                return (
                  <button
                    key={account.role}
                    onClick={() => handleDemoLogin(account)}
                    disabled={loading}
                    className="group relative w-full bg-white border-2 border-orange-200 rounded-2xl p-8 hover:border-orange-400 hover:shadow-2xl transition-all disabled:opacity-50 overflow-hidden"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${account.color} opacity-0 group-hover:opacity-5 transition-opacity`} />

                    <div className="relative">
                      <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${account.color} mb-4 shadow-lg`}>
                        <Icon className="w-10 h-10 text-white" />
                      </div>

                      <h3 className="text-2xl font-bold text-slate-800 mb-1">{account.name}</h3>
                      <p className="text-base text-orange-600 font-semibold mb-3">{account.title}</p>
                      <p className="text-sm text-slate-600 mb-6">{account.description}</p>

                      <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-600 font-medium">Courriel :</span>
                          <span className="text-slate-800 font-mono text-xs">{account.email}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 font-medium">Mot de passe :</span>
                          <span className="text-slate-800 font-mono text-xs">{account.password}</span>
                        </div>
                      </div>

                      <div className={`flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r ${account.color} text-white rounded-xl shadow-lg group-hover:shadow-xl transition-all`}>
                        <LogIn className="w-5 h-5" />
                        <span className="text-base font-bold">Se connecter maintenant</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="text-center">
              <button
                onClick={() => setShowDemoAccounts(false)}
                className="text-slate-600 hover:text-orange-600 text-sm font-medium transition-colors"
              >
                Connexion avec identifiants personnalisés →
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-white rounded-3xl p-10 shadow-2xl border border-slate-200">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-800 mb-2">Connexion</h2>
              <p className="text-slate-600">Accédez à votre espace de travail</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                  <button
                    onClick={() => setShowDemoAccounts(true)}
                    className="text-xs text-red-600 hover:text-red-700 underline mt-2 font-medium"
                  >
                    Retour au compte démo
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  placeholder="votre@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Se connecter</span>
                  </>
                )}
              </button>

              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={() => setShowDemoAccounts(true)}
                  className="text-slate-600 hover:text-orange-600 text-sm font-medium transition-colors"
                >
                  ← Retour au compte de démonstration
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-12 text-center text-sm text-slate-600">
          <p className="font-semibold">© 2025 DARI HOLDING. Tous droits réservés.</p>
          <p className="mt-2 text-slate-500">Plateforme de gestion optimale du transport de bauxite en Guinée</p>
        </div>
      </div>
    </div>
  );
};

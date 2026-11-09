import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Embleme, NOM_PRODUIT } from '../Brand/Marque';

// Fenetre de deconnexion, dans la charte de la page de connexion.
export const DeconnexionDialog = ({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) => {
  const { signOut } = useAuth();
  const [enCours, setEnCours] = useState(false);
  if (!ouvert) return null;

  const confirmer = async () => {
    setEnCours(true);
    try {
      await signOut();
    } finally {
      setEnCours(false);
      onFermer();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#2a1209]/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titre-deconnexion"
      onClick={onFermer}
    >
      <div className="w-full max-w-md rounded-[2rem] bg-white px-8 py-9 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Embleme className="mx-auto mb-5 h-16 w-16 rounded-2xl shadow-lg" />
        <h2 id="titre-deconnexion" className="text-2xl font-black text-stone-900">
          Se déconnecter de <span className="text-orange-500">{NOM_PRODUIT}</span> ?
        </h2>
        <p className="mt-2 text-stone-600">Votre session sera fermée sur cet appareil.</p>
        <div className="mt-8 flex gap-3">
          <button
            onClick={onFermer}
            className="flex-1 rounded-xl border border-stone-300 px-5 py-3 font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            Annuler
          </button>
          <button
            onClick={confirmer}
            disabled={enCours}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-3 font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-orange-800 disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};

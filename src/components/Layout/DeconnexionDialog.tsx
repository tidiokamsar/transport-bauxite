import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Embleme, NOM_PRODUIT } from '../Brand/Marque';

// Fenetre de deconnexion, dans la charte de la page de connexion. Mise en
// page propre (pas d'en-tete ni de pied de ui/Fenetre) mais memes regles :
// Echap et fond ferment (sauf pendant l'envoi), focus dans la fenetre puis
// rendu a l'element d'origine, page dessous figee, contenu borne a l'ecran.
export const DeconnexionDialog = ({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) =>
  ouvert ? <Dialogue onFermer={onFermer} /> : null;

const Dialogue = ({ onFermer }: { onFermer: () => void }) => {
  const { signOut } = useAuth();
  const [enCours, setEnCours] = useState(false);
  const annuler = useRef<HTMLButtonElement>(null);
  const fermer = useRef(onFermer);
  const occupe = useRef(enCours);
  fermer.current = onFermer;
  occupe.current = enCours;

  useEffect(() => {
    const origine = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const debordement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    annuler.current?.focus({ preventScroll: true });
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !occupe.current) fermer.current();
    };
    document.addEventListener('keydown', clavier);
    return () => {
      document.removeEventListener('keydown', clavier);
      document.body.style.overflow = debordement;
      if (origine && document.contains(origine)) origine.focus({ preventScroll: true });
    };
  }, []);

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
      onClick={(e) => { if (e.target === e.currentTarget && !enCours) onFermer(); }}
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white px-6 py-8 text-center shadow-2xl sm:px-8 sm:py-9">
        <Embleme className="mx-auto mb-5 h-16 w-16 rounded-2xl shadow-lg" />
        <h2 id="titre-deconnexion" className="text-2xl font-black text-stone-900">
          Se déconnecter de <span className="text-orange-500">{NOM_PRODUIT}</span> ?
        </h2>
        <p className="mt-2 text-stone-600">Votre session sera fermée sur cet appareil.</p>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            ref={annuler}
            onClick={onFermer}
            disabled={enCours}
            className="flex-1 rounded-xl border border-stone-300 px-5 py-3 font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
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

import { createContext, useContext, useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';

// Fenetre modale commune (D-077 : bibliotheque CreateModal, EditModal,
// ActionDialog). Hauteur bornee a l'ecran : l'en-tete et le pied restent
// visibles, seul le contenu defile. Plein ecran moins 16 px sur telephone.
// Echap et clic sur le fond ferment la fenetre, sauf pendant un envoi.
// Avec `onSubmit`, contenu et pied sont dans un meme <form> : Entree soumet
// et le bouton principal du pied peut etre de type submit.

// Fenetres ouvertes, de la plus ancienne a la plus recente : Echap ne ferme
// que la derniere ; le defilement de la page reste bloque tant qu'il en reste une.
const pile: symbol[] = [];
let debordementInitial = '';

// Mode page (D-090, D-088 suite) : sous <FenetreEnPage>, la meme fenetre
// s'affiche en pleine page (article, titre h1, bouton Retour), sans
// superposition, sans piege du focus ni blocage du defilement. Les ecrans
// a fenetres metier (Dispatch) passent ainsi en pages sans dupliquer leurs
// formulaires.
const EnPage = createContext(false);
export const FenetreEnPage = ({ children }: { children: ReactNode }) => <EnPage.Provider value>{children}</EnPage.Provider>;

const FOCUSABLES = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export interface FenetreProps {
  titre: ReactNode;
  sousTitre?: ReactNode;
  /** Icone affichee a gauche du titre. */
  icone?: ReactNode;
  onFermer: () => void;
  /** Boutons du pied, alignes a droite (empiles sur telephone, le dernier en haut). */
  pied?: ReactNode;
  /** Classe max-w-* du dialogue. */
  largeur?: string;
  /** Envoi en cours : Echap, fond et croix ne ferment plus. */
  enCours?: boolean;
  /** Contenu et pied places dans un <form> soumis par Entree. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** Identifiant du <form> (boutons exterieurs via l'attribut form=). */
  formulaireId?: string;
  /** Marges du contenu (classe Tailwind), par defaut px-4 py-4 sm:px-6 sm:py-5. */
  corpsClassName?: string;
  /** Classe z-index de la superposition (au-dessus d'une carte Leaflet : z-[2000]). */
  zClasse?: string;
  /** Nom accessible quand le titre n'est pas du texte simple. */
  ariaLabel?: string;
  children: ReactNode;
}

export const Fenetre = ({
  titre,
  sousTitre,
  icone,
  onFermer,
  pied,
  largeur = 'max-w-2xl',
  enCours = false,
  onSubmit,
  formulaireId,
  corpsClassName = 'px-4 py-4 sm:px-6 sm:py-5',
  zClasse = 'z-[900]',
  ariaLabel,
  children,
}: FenetreProps) => {
  const idTitre = useId();
  const enPage = useContext(EnPage);
  const dialogue = useRef<HTMLDivElement>(null);
  const corps = useRef<HTMLDivElement>(null);
  const fermer = useRef(onFermer);
  const occupe = useRef(enCours);
  fermer.current = onFermer;
  occupe.current = enCours;
  const appuiSurFond = useRef(false);

  useEffect(() => {
    if (enPage) return undefined;
    const cle = Symbol('fenetre');
    const origine = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (pile.length === 0) {
      debordementInitial = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    pile.push(cle);

    // Focus initial : premier champ du contenu, sinon premier bouton, sinon le dialogue.
    const cible = corps.current?.querySelector<HTMLElement>(FOCUSABLES)
      ?? dialogue.current?.querySelector<HTMLElement>(FOCUSABLES)
      ?? dialogue.current;
    cible?.focus({ preventScroll: true });

    const clavier = (e: KeyboardEvent) => {
      if (pile[pile.length - 1] !== cle) return;
      if (e.key === 'Escape') {
        if (occupe.current) return;
        e.stopPropagation();
        fermer.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogue.current) return;
      // Le focus reste dans la fenetre.
      const elements = Array.from(dialogue.current.querySelectorAll<HTMLElement>(FOCUSABLES))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (elements.length === 0) {
        e.preventDefault();
        return;
      }
      const premier = elements[0];
      const dernier = elements[elements.length - 1];
      const actif = document.activeElement;
      if (e.shiftKey && (actif === premier || !dialogue.current.contains(actif))) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && (actif === dernier || !dialogue.current.contains(actif))) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener('keydown', clavier);

    return () => {
      document.removeEventListener('keydown', clavier);
      const i = pile.indexOf(cle);
      if (i >= 0) pile.splice(i, 1);
      if (pile.length === 0) document.body.style.overflow = debordementInitial;
      if (origine && document.contains(origine)) origine.focus({ preventScroll: true });
    };
  }, [enPage]);

  const contenu = (
    <>
      <div ref={corps} data-fenetre-corps="" className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${corpsClassName}`}>
        {children}
      </div>
      {pied && (
        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4 [&>*]:w-full sm:[&>*]:w-auto">
          {pied}
        </footer>
      )}
    </>
  );

  if (enPage) {
    return (
      <article aria-labelledby={ariaLabel ? undefined : idTitre} aria-label={ariaLabel} aria-busy={enCours || undefined}
        className="flex max-w-3xl flex-col rounded-2xl border border-stone-200/70 bg-white shadow-carte">
        <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icone && <span className="shrink-0">{icone}</span>}
            <div className="min-w-0">
              <h1 id={idTitre} className="text-xl font-black text-stone-900 sm:text-2xl">{titre}</h1>
              {sousTitre && <div className="mt-0.5 text-sm text-stone-500">{sousTitre}</div>}
            </div>
          </div>
          <button type="button" onClick={onFermer} disabled={enCours} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
        </header>
        {onSubmit ? <form id={formulaireId} onSubmit={onSubmit} className="flex flex-col">{contenu}</form> : contenu}
      </article>
    );
  }

  return (
    <div
      className={`fixed inset-0 ${zClasse} flex items-center justify-center bg-black/40 p-4`}
      onMouseDown={(e) => { appuiSurFond.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && appuiSurFond.current && !enCours) onFermer();
        appuiSurFond.current = false;
      }}
    >
      <div
        ref={dialogue}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : idTitre}
        aria-label={ariaLabel}
        aria-busy={enCours || undefined}
        tabIndex={-1}
        className={`flex max-h-[calc(100dvh-2rem)] w-full ${largeur} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none sm:max-h-[90vh]`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icone && <span className="shrink-0">{icone}</span>}
            <div className="min-w-0">
              <h2 id={idTitre} className="text-lg font-black text-stone-900 sm:text-xl">{titre}</h2>
              {sousTitre && <div className="mt-0.5 text-sm text-stone-500">{sousTitre}</div>}
            </div>
          </div>
          <button
            type="button"
            onClick={onFermer}
            disabled={enCours}
            className="shrink-0 rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-40"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        {onSubmit ? (
          <form id={formulaireId} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {contenu}
          </form>
        ) : contenu}
      </div>
    </div>
  );
};

/** Message d'erreur (serveur ou saisie) en haut du contenu. */
export const ErreurFenetre = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  children ? <p role="alert" className={`rounded-lg bg-red-50 p-3 text-sm text-red-700 ${className}`}>{children}</p> : null;

/** Champ libelle ; `requis` ajoute la marque d'obligation. */
export const ChampFenetre = ({ libelle, requis, aide, className = '', children }: {
  libelle: ReactNode;
  requis?: boolean;
  aide?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <label className={`block text-sm ${className}`}>
    <span className="mb-1 block font-medium text-stone-700">
      {libelle}
      {requis && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}
    </span>
    {children}
    {aide && <span className="mt-1 block text-xs text-stone-500">{aide}</span>}
  </label>
);

/** Grille des champs : une colonne sur telephone, deux au-dela. */
export const GRILLE_FENETRE = 'grid grid-cols-1 gap-4 sm:grid-cols-2';
export const CHAMP_FENETRE = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';
export const BOUTON_SECONDAIRE = 'rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50';
export const BOUTON_PRINCIPAL = 'rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-60';
export const BOUTON_DANGER = 'rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50';

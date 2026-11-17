import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Save } from 'lucide-react';
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE } from './Fenetre';
import { FilAriane } from './PageDetail';
import { QUITTER_SANS_ENREGISTRER, arianeModule } from './pages';
import { naviguer, routeDetail, routeListe } from './routeur';

// Creation et modification en pleine page (D-090, remplace CreateModal et
// EditModal) : validation en temps reel (le module calcule `erreurs`),
// erreur du serveur affichee telle quelle, soumission unique, annulation
// confirmee quand la saisie a change, avertissement avant de quitter la page.

/** Champ libelle ; l'erreur s'affiche sous le champ, hors du nom accessible. */
export const ChampPage = ({ libelle, aide, erreur, className = '', children }: {
  libelle: string;
  aide?: ReactNode;
  erreur?: string | null;
  className?: string;
  children: ReactNode;
}) => (
  <div className={className}>
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-stone-700">{libelle}</span>
      {children}
    </label>
    {aide && <p className="mt-1 text-xs text-stone-500">{aide}</p>}
    {erreur && <p className="mt-1 text-xs text-red-700">{erreur}</p>}
  </div>
);

export const SectionFormulaire = ({ titre, children }: { titre: string; children: ReactNode }) => (
  <fieldset className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
    <legend className="px-1 font-bold text-stone-900">{titre}</legend>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  </fieldset>
);

export const PageFormulaire = ({
  vue, module, titre, reference, id, description, modifie, erreurs = [], onSoumettre, libelleSoumettre, children, chargement, erreurChargement,
}: {
  vue: string;
  module: string;
  titre: string;
  /** Reference de l'objet modifie (fil d'Ariane) ; absente en creation. */
  reference?: string;
  id?: string;
  description?: ReactNode;
  modifie: boolean;
  /** Erreurs de saisie courantes : tant qu'il y en a, l'envoi est bloque. */
  erreurs?: string[];
  /**
   * Ecriture (fonction serveur ou table sous RLS). Renvoie le message
   * d'erreur du serveur, ou la route a ouvrir apres succes.
   */
  onSoumettre: () => Promise<{ erreur: string } | { vers: string }>;
  libelleSoumettre: string;
  children: ReactNode;
  chargement?: boolean;
  erreurChargement?: string;
}) => {
  const [enCours, setEnCours] = useState(false);
  const [erreurServeur, setErreurServeur] = useState('');
  const [tente, setTente] = useState(false);
  const verrou = useRef(false);

  // Fermeture ou rechargement de l'onglet avec une saisie en cours.
  useEffect(() => {
    if (!modifie) return;
    const avertir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avertir);
    return () => window.removeEventListener('beforeunload', avertir);
  }, [modifie]);

  const retour = id ? routeDetail(vue, id) : routeListe(vue);
  const annuler = () => {
    if (modifie && !window.confirm(QUITTER_SANS_ENREGISTRER)) return;
    naviguer(retour);
  };

  const soumettre = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTente(true);
    if (verrou.current || erreurs.length > 0) return;
    verrou.current = true;
    setEnCours(true);
    setErreurServeur('');
    try {
      const r = await onSoumettre();
      if ('erreur' in r) { setErreurServeur(r.erreur); return; }
      naviguer(r.vers, { remplacer: true });
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  };

  const ariane = arianeModule(vue, module, ...(reference && id ? [{ libelle: reference, vers: routeDetail(vue, id) }] : []), { libelle: titre });

  return (
    <div className="space-y-5">
      <FilAriane elements={ariane} />
      <div>
        <h1 className="text-2xl font-black text-stone-900">{titre}</h1>
        {description && <div className="mt-1 text-sm text-stone-500">{description}</div>}
      </div>
      {erreurChargement ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreurChargement}</p>
        : chargement ? <p role="status" className="py-8 text-center text-sm text-stone-500">Chargement…</p>
          : (
            <form aria-label={titre} onSubmit={soumettre} noValidate aria-busy={enCours || undefined} className="space-y-5">
              {erreurServeur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Enregistrement refusé par le serveur : {erreurServeur}</p>}
              {tente && erreurs.length > 0 && (
                <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Saisie à compléter :</p>
                  <ul className="list-disc pl-5">{erreurs.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
              )}
              {children}
              <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-stone-200 bg-sable/95 py-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={annuler} disabled={enCours} className={BOUTON_SECONDAIRE}>Annuler</button>
                <button type="submit" disabled={enCours} className={`${BOUTON_PRINCIPAL} inline-flex items-center justify-center gap-2`}>
                  <Save className="h-4 w-4" />{enCours ? 'Enregistrement…' : libelleSoumettre}
                </button>
              </div>
            </form>
          )}
    </div>
  );
};

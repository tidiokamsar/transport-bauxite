import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { BOUTON_DANGER, BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CHAMP_FENETRE } from './Fenetre';
import { FilAriane } from './PageDetail';
import { arianeModule, motifValide, type ExigenceMotif } from './pages';
import { SansDonnees } from './Panneau';
import { naviguer, poserAnnonce, routeDetail } from './routeur';

// Action metier en pleine page (D-090, remplace ActionDialog et les
// window.prompt) : suspendre, desactiver, valider, rejeter... Le motif est
// obligatoire quand la regle l'exige ; l'ecriture est la fonction serveur
// existante ; apres succes, retour a la fiche avec un message.

export const PageAction = ({
  vue, module, reference, id, titre, description, motif: exigence, motifMinimum = 3, libelleConfirmer, danger = false,
  interdit, onExecuter, messageSucces, children, pret = true, chargement, erreurChargement, versApres,
}: {
  vue: string;
  module: string;
  reference: string;
  id: string;
  titre: string;
  description?: ReactNode;
  motif: ExigenceMotif;
  motifMinimum?: number;
  libelleConfirmer: string;
  danger?: boolean;
  /** Raison pour laquelle l'action n'est pas possible (droit ou etat) ; null = possible. */
  interdit?: string | null;
  /** Renvoie le message d'erreur du serveur, ou null en cas de succes. */
  onExecuter: (motif: string) => Promise<string | null>;
  messageSucces: string;
  /** Champs supplementaires propres a l'action. */
  children?: ReactNode;
  pret?: boolean;
  chargement?: boolean;
  erreurChargement?: string;
  /** Page ouverte apres succes ; par defaut la fiche (ex. liste apres une suppression). */
  versApres?: string;
}) => {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const valide = motifValide(motif, exigence, motifMinimum) && pret;

  const executer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (verrou.current || !valide || interdit) return;
    verrou.current = true;
    setEnCours(true);
    setErreur('');
    try {
      const echec = await onExecuter(motif.trim());
      if (echec) { setErreur(echec); return; }
      poserAnnonce(messageSucces);
      naviguer(versApres ?? routeDetail(vue, id), { remplacer: true });
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <FilAriane elements={arianeModule(vue, module, { libelle: reference, vers: routeDetail(vue, id) }, { libelle: titre })} />
      <h1 className="text-2xl font-black text-stone-900">{titre}</h1>
      {erreurChargement ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreurChargement}</p>
        : chargement ? <p role="status" className="py-8 text-center text-sm text-stone-500">Chargement…</p>
          : interdit ? (
            <div className="space-y-3">
              <SansDonnees message="Action impossible" detail={interdit} />
              <a href={routeDetail(vue, id)} className={BOUTON_SECONDAIRE}>Retour à la fiche</a>
            </div>
          ) : (
            <form aria-label={titre} onSubmit={executer} aria-busy={enCours || undefined} className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
              {description && <div className="text-sm text-stone-600">{description}</div>}
              {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Action refusée par le serveur : {erreur}</p>}
              {children}
              {exigence !== 'aucun' && (
                <div>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-stone-700">{exigence === 'obligatoire' ? 'Motif *' : 'Motif (facultatif)'}</span>
                    <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} className={CHAMP_FENETRE} />
                  </label>
                  {exigence === 'obligatoire' && !motifValide(motif, exigence, motifMinimum) && (
                    <p className="mt-1 text-xs text-stone-500">Motif obligatoire ({motifMinimum} caractères au moins), conservé au journal.</p>
                  )}
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <a href={routeDetail(vue, id)} className={`${BOUTON_SECONDAIRE} text-center`}>Annuler</a>
                <button type="submit" disabled={!valide || enCours} className={danger ? BOUTON_DANGER : BOUTON_PRINCIPAL}>
                  {enCours ? 'En cours…' : libelleConfirmer}
                </button>
              </div>
            </form>
          )}
    </div>
  );
};

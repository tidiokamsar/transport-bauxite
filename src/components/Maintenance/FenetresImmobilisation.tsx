import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CAUSES, IMPUTATIONS, type Cause, type Immobilisation, type Imputation } from './immobilisations';

// Saisies des immobilisations (D-025). Toutes passent par une fonction
// serveur qui controle la periode, l'absence de chevauchement et journalise
// l'action ; une correction ou une annulation exige un motif.

const CHAMP = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';

const versLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const versIso = (local: string) => new Date(local).toISOString();

export interface EnginResume { id: string; registration: string; vehicle_type: string; status: string }

const Fenetre = ({ titre, sousTitre, onFermer, children, pied }: {
  titre: string;
  sousTitre?: string;
  onFermer: () => void;
  children: ReactNode;
  pied: ReactNode;
}) => (
  <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={onFermer}>
    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={titre}>
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <div>
          <h2 className="text-xl font-black text-stone-900">{titre}</h2>
          {sousTitre && <p className="text-sm text-stone-500">{sousTitre}</p>}
        </div>
        <button onClick={onFermer} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
      </header>
      <div className="space-y-3 px-6 py-5 text-sm">{children}</div>
      <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">{pied}</footer>
    </div>
  </div>
);

const Bouton = ({ onClick, actif, children, danger = false }: { onClick: () => void; actif: boolean; children: ReactNode; danger?: boolean }) => (
  <button
    onClick={onClick}
    disabled={!actif}
    className={`rounded-lg px-5 py-2 text-sm font-bold text-white disabled:opacity-50 ${danger ? 'bg-red-600' : 'bg-gradient-to-r from-orange-500 to-orange-700'}`}
  >
    {children}
  </button>
);

const Retour = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Retour</button>
);

const Champ = ({ libelle, children }: { libelle: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1 block font-medium text-stone-700">{libelle}</span>
    {children}
  </label>
);

const ChoixCause = ({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) => (
  <select value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP}>
    <option value="">Choisir</option>
    {(Object.keys(CAUSES) as Cause[]).map((c) => <option key={c} value={c}>{CAUSES[c]}</option>)}
  </select>
);

const ChoixImputation = ({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) => (
  <>
    <select value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP}>
      <option value="">Choisir</option>
      {(Object.keys(IMPUTATIONS) as Imputation[]).map((c) => <option key={c} value={c}>{IMPUTATIONS[c].libelle}</option>)}
    </select>
    <span className="mt-1 block text-xs text-stone-500">Contrat Nimba Mining (D-022) : maintenance à la charge du loueur, pneus et carburant à la charge de l'exploitant.</span>
  </>
);

const useEnvoi = (onFait: () => void) => {
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const envoyer = async (fonction: string, parametres: Record<string, unknown>) => {
    setEnCours(true);
    setErreur('');
    const { error } = await supabase.rpc(fonction, parametres);
    setEnCours(false);
    if (error) setErreur(error.message);
    else onFait();
  };
  return { erreur, enCours, envoyer };
};

const Erreur = ({ texte }: { texte: string }) => (texte ? <p className="rounded-lg bg-red-50 p-3 text-red-700">{texte}</p> : null);

export const DeclarerImmobilisation = ({ engins, onFermer, onFait }: { engins: EnginResume[]; onFermer: () => void; onFait: () => void }) => {
  const [f, setF] = useState({ engin: '', debut: versLocal(new Date()), cause: '', imputation: '', description: '', reference: '' });
  const { erreur, enCours, envoyer } = useEnvoi(onFait);
  const complet = f.engin && f.debut && f.cause && f.imputation && f.description.trim();
  return (
    <Fenetre
      titre="Déclarer une immobilisation"
      onFermer={onFermer}
      pied={<>
        <Retour onClick={onFermer} />
        <Bouton actif={Boolean(complet) && !enCours} onClick={() => envoyer('declarer_immobilisation', {
          p_vehicle_id: f.engin, p_debut: versIso(f.debut), p_cause: f.cause, p_imputation: f.imputation,
          p_description: f.description, p_reference_loueur: f.reference || null,
        })}>{enCours ? 'Enregistrement...' : 'Déclarer'}</Bouton>
      </>}
    >
      <Champ libelle="Engin *">
        <select value={f.engin} onChange={(e) => setF({ ...f, engin: e.target.value })} className={CHAMP}>
          <option value="">Choisir</option>
          {engins.map((e) => <option key={e.id} value={e.id}>{e.registration}</option>)}
        </select>
      </Champ>
      <Champ libelle="Début (heure réelle de l'arrêt) *">
        <input type="datetime-local" value={f.debut} onChange={(e) => setF({ ...f, debut: e.target.value })} className={CHAMP} />
      </Champ>
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle="Cause *"><ChoixCause valeur={f.cause} onChange={(cause) => setF({ ...f, cause })} /></Champ>
        <Champ libelle="Imputation *"><ChoixImputation valeur={f.imputation} onChange={(imputation) => setF({ ...f, imputation })} /></Champ>
      </div>
      <Champ libelle="Description *">
        <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={CHAMP} />
      </Champ>
      <Champ libelle="Référence d'intervention du loueur">
        <input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={CHAMP} />
      </Champ>
      <Erreur texte={erreur} />
    </Fenetre>
  );
};

export const CloturerImmobilisation = ({ immobilisation, libelle, onFermer, onFait }: {
  immobilisation: Immobilisation; libelle: string; onFermer: () => void; onFait: () => void;
}) => {
  const [fin, setFin] = useState(versLocal(new Date()));
  const [note, setNote] = useState('');
  const { erreur, enCours, envoyer } = useEnvoi(onFait);
  return (
    <Fenetre
      titre="Remettre en service"
      sousTitre={libelle}
      onFermer={onFermer}
      pied={<>
        <Retour onClick={onFermer} />
        <Bouton actif={Boolean(fin) && !enCours} onClick={() => envoyer('cloturer_immobilisation', { p_id: immobilisation.id, p_fin: versIso(fin), p_note: note || null })}>
          {enCours ? 'Enregistrement...' : 'Clôturer'}
        </Bouton>
      </>}
    >
      <Champ libelle="Fin (heure réelle de remise en service) *">
        <input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} className={CHAMP} />
      </Champ>
      <Champ libelle="Note"><input value={note} onChange={(e) => setNote(e.target.value)} className={CHAMP} /></Champ>
      <Erreur texte={erreur} />
    </Fenetre>
  );
};

export const CorrigerImmobilisation = ({ immobilisation, libelle, onFermer, onFait }: {
  immobilisation: Immobilisation; libelle: string; onFermer: () => void; onFait: () => void;
}) => {
  const [f, setF] = useState({
    cause: immobilisation.cause as string,
    imputation: immobilisation.imputation as string,
    debut: versLocal(new Date(immobilisation.debut)),
    fin: immobilisation.fin ? versLocal(new Date(immobilisation.fin)) : '',
    motif: '',
  });
  const { erreur, enCours, envoyer } = useEnvoi(onFait);
  const ouverte = immobilisation.statut === 'ouverte';
  return (
    <Fenetre
      titre="Corriger l'immobilisation"
      sousTitre={libelle}
      onFermer={onFermer}
      pied={<>
        <Retour onClick={onFermer} />
        <Bouton actif={Boolean(f.motif.trim() && f.debut && (ouverte || f.fin)) && !enCours} onClick={() => envoyer('corriger_immobilisation', {
          p_id: immobilisation.id, p_cause: f.cause, p_imputation: f.imputation, p_debut: versIso(f.debut),
          p_fin: ouverte ? null : versIso(f.fin), p_motif: f.motif,
        })}>{enCours ? 'Enregistrement...' : 'Enregistrer la correction'}</Bouton>
      </>}
    >
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle="Cause"><ChoixCause valeur={f.cause} onChange={(cause) => setF({ ...f, cause })} /></Champ>
        <Champ libelle="Imputation"><ChoixImputation valeur={f.imputation} onChange={(imputation) => setF({ ...f, imputation })} /></Champ>
        <Champ libelle="Début"><input type="datetime-local" value={f.debut} onChange={(e) => setF({ ...f, debut: e.target.value })} className={CHAMP} /></Champ>
        {!ouverte && <Champ libelle="Fin"><input type="datetime-local" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} className={CHAMP} /></Champ>}
      </div>
      <Champ libelle="Motif de la correction (obligatoire)">
        <input value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} className={CHAMP} />
      </Champ>
      <p className="text-xs text-stone-500">L'état précédent reste au journal de l'immobilisation.</p>
      <Erreur texte={erreur} />
    </Fenetre>
  );
};

export const AnnulerImmobilisation = ({ immobilisation, libelle, onFermer, onFait }: {
  immobilisation: Immobilisation; libelle: string; onFermer: () => void; onFait: () => void;
}) => {
  const [motif, setMotif] = useState('');
  const { erreur, enCours, envoyer } = useEnvoi(onFait);
  return (
    <Fenetre
      titre="Annuler l'immobilisation"
      sousTitre={libelle}
      onFermer={onFermer}
      pied={<>
        <Retour onClick={onFermer} />
        <Bouton danger actif={Boolean(motif.trim()) && !enCours} onClick={() => envoyer('annuler_immobilisation', { p_id: immobilisation.id, p_motif: motif })}>
          {enCours ? 'Annulation...' : 'Annuler l\'immobilisation'}
        </Bouton>
      </>}
    >
      <p className="text-stone-600">Pour une saisie erronée. L'immobilisation reste au journal avec son motif ; l'engin redevient actif si elle était ouverte.</p>
      <Champ libelle="Motif (obligatoire)"><input value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP} /></Champ>
      <Erreur texte={erreur} />
    </Fenetre>
  );
};

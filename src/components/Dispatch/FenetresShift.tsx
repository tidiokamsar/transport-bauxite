import { useEffect, useState } from 'react';
import { ErreurFenetre, Fenetre } from '../ui/Fenetre';
import { supabase } from '../../lib/supabase';
import { formatNombre } from '../Dashboard/indicateurs';
import { calculerBesoin, messageErreur, motifRequis } from './controle';

// Fenetres de l'instance de shift (D-087) : planifier, ouvrir, demarrer,
// annuler, cloturer, preparer. Chacune appelle une fonction serveur ; le
// serveur controle droits, perimetre, etat et version, et journalise.

const CHAMP = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';
const BOUTON = 'rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50';
const SECONDAIRE = 'rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50';

export interface InstanceShift {
  id: string;
  statut: string;
  version: number;
  date_poste: string;
  shift_id: string;
  site_id: string;
}

type ModeEtat = 'planifier' | 'ouvrir' | 'demarrer' | 'annuler';

const TITRES: Record<ModeEtat, string> = {
  planifier: 'Planifier le shift',
  ouvrir: 'Ouvrir le shift',
  demarrer: 'Démarrer le shift',
  annuler: 'Annuler le shift',
};

export const FenetreEtatShift = ({
  mode, date, site, shift, instance, libelle, onFermer, onFait,
}: {
  mode: ModeEtat;
  date: string;
  site: string;
  shift: string;
  instance: InstanceShift | null;
  libelle: string;
  onFermer: () => void;
  onFait: () => void;
}) => {
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const annulation = mode === 'annuler';

  const valider = async () => {
    setEnCours(true);
    setErreur('');
    const consignes = texte.trim() || null;
    const r = mode === 'planifier'
      ? await supabase.rpc('planifier_poste', { p_date: date, p_shift_id: shift, p_site_id: site, p_responsable: null, p_consignes: consignes })
      : mode === 'ouvrir'
        ? await supabase.rpc('ouvrir_poste', { p_date: date, p_shift_id: shift, p_site_id: site, p_responsable: null, p_consignes: consignes })
        : await supabase.rpc('changer_etat_poste', {
          p_poste_id: instance?.id, p_etat: annulation ? 'annule' : 'en_cours', p_motif: annulation ? texte.trim() : null, p_version: instance?.version ?? null,
        });
    setEnCours(false);
    if (r.error) setErreur(messageErreur(r.error));
    else onFait();
  };

  const bloque = enCours || (annulation && !texte.trim());
  return (
    <Fenetre
      titre={TITRES[mode]}
      sousTitre={libelle}
      largeur="max-w-lg"
      onFermer={onFermer}
      enCours={enCours}
      onSubmit={(e) => { e.preventDefault(); if (!bloque) valider(); }}
      pied={<>
        <button type="button" onClick={onFermer} disabled={enCours} className={SECONDAIRE}>Fermer</button>
        <button type="submit" disabled={bloque} className={annulation ? 'rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50' : BOUTON}>
          {enCours ? 'Enregistrement...' : TITRES[mode]}
        </button>
      </>}
    >
      <div className="space-y-3 text-sm">
        <ErreurFenetre>{erreur}</ErreurFenetre>
        <p className="text-stone-600">
          {mode === 'planifier' && 'Crée l\'instance du shift pour cette date et ce site, à l\'état planifié. Les voyages se préparent ensuite.'}
          {mode === 'ouvrir' && 'Ouvre le shift : les consignes du dernier shift clôturé du site sont reprises (passation).'}
          {mode === 'demarrer' && 'Passe le shift à l\'état « en cours ». La transition est journalisée.'}
          {annulation && 'L\'annulation est refusée si un voyage est engagé ou livré. Les voyages préparés ne sont pas annulés automatiquement.'}
        </p>
        {mode !== 'demarrer' && (
          <label className="block">
            <span className="mb-1 block font-medium text-stone-700">{annulation ? 'Motif (obligatoire)' : 'Consignes (facultatif)'}</span>
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} className={CHAMP} />
          </label>
        )}
      </div>
    </Fenetre>
  );
};

export const FenetreClotureShift = ({
  instance, libelle, nonTermines, onFermer, onFait,
}: {
  instance: InstanceShift;
  libelle: string;
  /** Voyages du shift non termines (lus par l'ecran) ; le serveur recompte. */
  nonTermines: number;
  onFermer: () => void;
  onFait: () => void;
}) => {
  const [consignes, setConsignes] = useState('');
  const [rapport, setRapport] = useState('');
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const bloque = enCours || !consignes.trim() || (nonTermines > 0 && !motif.trim());

  const valider = async () => {
    setEnCours(true);
    setErreur('');
    const { error } = await supabase.rpc('cloturer_shift', {
      p_poste_id: instance.id, p_consignes_sortie: consignes.trim(), p_rapport: rapport.trim() || null,
      p_motif: motif.trim() || null, p_version: instance.version,
    });
    setEnCours(false);
    if (error) setErreur(messageErreur(error));
    else onFait();
  };

  return (
    <Fenetre
      titre="Clôturer le shift"
      sousTitre={libelle}
      largeur="max-w-lg"
      onFermer={onFermer}
      enCours={enCours}
      onSubmit={(e) => { e.preventDefault(); if (!bloque) valider(); }}
      pied={<>
        <button type="button" onClick={onFermer} disabled={enCours} className={SECONDAIRE}>Fermer</button>
        <button type="submit" disabled={bloque} className={BOUTON}>{enCours ? 'Enregistrement...' : 'Clôturer'}</button>
      </>}
    >
      <div className="space-y-3 text-sm">
        <ErreurFenetre>{erreur}</ErreurFenetre>
        {nonTermines > 0
          ? <p className="rounded-lg bg-orange-50 p-3 font-medium text-orange-800">{nonTermines} voyage(s) non terminé(s) : la clôture exige un motif. Ils restent à leur état, rien n'est annulé.</p>
          : <p className="text-stone-600">Tous les voyages du shift sont terminés ou annulés.</p>}
        <label className="block">
          <span className="mb-1 block font-medium text-stone-700">Consignes de passation (obligatoires)</span>
          <textarea value={consignes} onChange={(e) => setConsignes(e.target.value)} rows={2} className={CHAMP} />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium text-stone-700">Rapport (facultatif)</span>
          <textarea value={rapport} onChange={(e) => setRapport(e.target.value)} rows={2} className={CHAMP} />
        </label>
        {nonTermines > 0 && (
          <label className="block">
            <span className="mb-1 block font-medium text-stone-700">Motif de clôture avec voyages non terminés</span>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP} />
          </label>
        )}
      </div>
    </Fenetre>
  );
};

interface LigneBesoin {
  tonnes_cible: number | null;
  voyages_cible: number | null;
  capacite_utile_t: number | null;
  camions_disponibles: number | null;
  hypothese_charge_pct: number | null;
  cycle_observe_min: number | null;
  rotations_mesurees: number | null;
  besoin_voyages: number | null;
  voyages_existants: number;
  proposition: number | null;
  base_calcul: string;
}

const ETAPES = ['Contexte', 'Ressources et besoin', 'Aperçu et correction', 'Confirmation'];

/** Preparation du shift en etapes ; creation par confirmer_plan_shift apres confirmation. */
export const FenetrePreparationShift = ({
  date, site, shift, libelle, destinations, versionPlan, onFermer, onFait,
}: {
  date: string;
  site: string;
  shift: string;
  libelle: string;
  destinations: { id: string; name: string }[];
  /** Derniere version connue du plan (0 si aucun) : controle de version. */
  versionPlan: number;
  onFermer: () => void;
  onFait: () => void;
}) => {
  const [etape, setEtape] = useState(0);
  const [hypothese, setHypothese] = useState('');
  const [besoin, setBesoin] = useState<LigneBesoin | null>(null);
  const [destination, setDestination] = useState(destinations.length === 1 ? destinations[0].id : '');
  const [nombre, setNombre] = useState('');
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const hyp = hypothese.trim() === '' ? null : Number(hypothese.replace(',', '.'));

  useEffect(() => {
    let actif = true;
    supabase.rpc('besoin_shift', { p_date: date, p_site_id: site, p_shift_id: shift, p_hypothese_charge_pct: hyp }).then(({ data, error }) => {
      if (!actif) return;
      if (error) setErreur(messageErreur(error));
      else setBesoin(Array.isArray(data) && data[0] ? (data[0] as LigneBesoin) : null);
    });
    return () => { actif = false; };
  }, [date, site, shift, hyp]);

  // Miroir local du calcul serveur, pour l'explication.
  const calcul = besoin ? calculerBesoin({ ...besoin, hypothese_charge_pct: hyp }) : null;
  const proposition = besoin?.proposition ?? null;
  useEffect(() => { if (proposition !== null) setNombre(String(proposition)); }, [proposition]);
  const n = /^\d+$/.test(nombre.trim()) ? Number(nombre) : NaN;
  const exigeMotif = Number.isInteger(n) && motifRequis(proposition, n);
  const pretConfirmer = Number.isInteger(n) && n >= 0 && n <= 300 && (n === 0 || destination !== '') && (!exigeMotif || motif.trim() !== '');

  const confirmer = async () => {
    setEnCours(true);
    setErreur('');
    const { error } = await supabase.rpc('confirmer_plan_shift', {
      p_date: date, p_site_id: site, p_shift_id: shift, p_destination_id: destination || null,
      p_hypothese_charge_pct: hyp, p_nombre: n, p_motif: motif.trim() || null, p_version_attendue: versionPlan,
    });
    setEnCours(false);
    if (error) setErreur(messageErreur(error));
    else onFait();
  };

  const valeur = (v: number | null | undefined, unite: string) => (v === null || v === undefined ? 'sans données' : `${formatNombre(Number(v))} ${unite}`);

  return (
    <Fenetre
      titre="Préparer le shift"
      sousTitre={`${libelle} · étape ${etape + 1} sur ${ETAPES.length} : ${ETAPES[etape]}`}
      largeur="max-w-2xl"
      onFermer={onFermer}
      enCours={enCours}
      onSubmit={(e) => { e.preventDefault(); if (etape === 3 && pretConfirmer && !enCours) confirmer(); }}
      pied={<>
        <button type="button" onClick={etape === 0 ? onFermer : () => setEtape(etape - 1)} disabled={enCours} className={SECONDAIRE}>
          {etape === 0 ? 'Fermer' : 'Précédent'}
        </button>
        {etape < 3
          // Cles distinctes : le bouton « Suivant » ne devient jamais le bouton
          // d'envoi sous le clic (sinon la confirmation partirait sans l'apercu).
          ? <button key="suivant" type="button" onClick={() => setEtape(etape + 1)} disabled={!besoin || (etape === 2 && !pretConfirmer)} className={BOUTON}>Suivant</button>
          : <button key="confirmer" type="submit" disabled={!pretConfirmer || enCours} className={BOUTON}>{enCours ? 'Création...' : `Confirmer et créer ${Number.isInteger(n) ? n : ''} voyage(s)`}</button>}
      </>}
    >
      <div className="space-y-3 text-sm">
        <ErreurFenetre>{erreur}</ErreurFenetre>
        <ol className="flex flex-wrap gap-2 text-xs" aria-label="Étapes">
          {ETAPES.map((e, i) => (
            <li key={e} aria-current={i === etape ? 'step' : undefined} className={`rounded-full px-2.5 py-1 ${i === etape ? 'bg-orange-100 font-bold text-orange-800' : 'bg-stone-100 text-stone-500'}`}>{i + 1}. {e}</li>
          ))}
        </ol>
        {!besoin && !erreur && <p className="text-stone-500">Lecture de l'objectif et des ressources…</p>}
        {besoin && etape === 0 && (
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-stone-500">Date, site, shift</dt><dd className="font-medium">{libelle}</dd>
            <dt className="text-stone-500">Objectif (Planification)</dt>
            <dd className="font-medium">{besoin.tonnes_cible === null ? 'Aucun objectif' : `${formatNombre(Number(besoin.tonnes_cible))} t${besoin.voyages_cible ? `, ${besoin.voyages_cible} voyages visés` : ''}`}</dd>
            <dt className="text-stone-500">Voyages déjà créés</dt><dd className="font-medium">{besoin.voyages_existants}</dd>
          </dl>
        )}
        {besoin && etape === 1 && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-stone-500">Camions disponibles</dt><dd className="font-medium">{besoin.camions_disponibles ?? 0}</dd>
              <dt className="text-stone-500">Capacité utile moyenne</dt><dd className="font-medium">{valeur(besoin.capacite_utile_t, 't')}</dd>
              <dt className="text-stone-500">Temps de cycle observé (14 jours)</dt>
              <dd className="font-medium">{besoin.cycle_observe_min === null ? 'non mesuré' : `${besoin.cycle_observe_min} min sur ${besoin.rotations_mesurees} rotation(s)`}</dd>
            </dl>
            <label className="block">
              <span className="mb-1 block font-medium text-stone-700">Hypothèse de charge (% de la capacité utile, saisie)</span>
              <input inputMode="decimal" value={hypothese} onChange={(e) => setHypothese(e.target.value)} className="w-32 rounded-lg border border-stone-300 px-3 py-2 text-sm" aria-label="Hypothèse de charge" />
            </label>
            <p className="rounded-lg bg-stone-50 p-3 text-stone-700"><b>Besoin :</b> {besoin.besoin_voyages ?? 'non calculé'} voyage(s). {calcul?.base ?? besoin.base_calcul}</p>
          </div>
        )}
        {besoin && etape === 2 && (
          <div className="space-y-3">
            <p className="text-stone-700">
              {proposition === null ? 'Aucune proposition calculable : saisissez le nombre et un motif.' : <>Proposition : <b>{proposition} voyage(s)</b> (besoin {besoin.besoin_voyages} moins {besoin.voyages_existants} existant(s)).</>}
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-stone-700">Destination</span>
                <select value={destination} onChange={(e) => setDestination(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
                  <option value="">Choisir</option>
                  {destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-stone-700">Nombre de voyages</span>
                <input inputMode="numeric" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </label>
            </div>
            {exigeMotif && (
              <label className="block">
                <span className="mb-1 block font-medium text-stone-700">Motif de la correction (obligatoire)</span>
                <input value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP} />
              </label>
            )}
          </div>
        )}
        {besoin && etape === 3 && (
          <div className="space-y-2 rounded-lg bg-stone-50 p-3 text-stone-700">
            <p><b>{Number.isInteger(n) ? n : '?'} voyage(s)</b> vers {destinations.find((d) => d.id === destination)?.name ?? '—'}, sans camion (à affecter ensuite).</p>
            <p>Base : {calcul?.base ?? besoin.base_calcul}{hyp !== null ? ` ; hypothèse de charge ${hyp} %` : ''}.</p>
            {motif.trim() && <p>Motif : « {motif.trim()} »</p>}
            <p className="text-xs text-stone-500">Le plan est enregistré en version {versionPlan + 1} ; une version plus récente enregistrée entre-temps fait refuser la confirmation.</p>
          </div>
        )}
      </div>
    </Fenetre>
  );
};

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatNombre } from '../Dashboard/indicateurs';
import type { SiteResume } from '../../contexts/SiteContext';
import type { ShiftHoraire } from './plan';

// Fenetres de la planification : definir ou reviser un objectif
// (definir_objectif), l'annuler (annuler_objectif), voir ses versions.
// Le serveur numerote les versions et exige le motif d'une revision.

const CHAMP = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';

const Fenetre = ({ titre, onFermer, children, pied, largeur = 'max-w-2xl' }: {
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  pied?: ReactNode;
  largeur?: string;
}) => (
  <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={onFermer}>
    <div onClick={(e) => e.stopPropagation()} className={`w-full ${largeur} rounded-2xl bg-white shadow-2xl`} role="dialog" aria-modal="true" aria-label={titre}>
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <h2 className="text-xl font-black text-stone-900">{titre}</h2>
        <button type="button" onClick={onFermer} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
      </header>
      {children}
      {pied && <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">{pied}</footer>}
    </div>
  </div>
);

const nombre = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

export interface Existant {
  site_id: string;
  shift_id: string | null;
  tonnes_cible: number;
  voyages_cible: number | null;
  camions_prevus: number | null;
  chargeuses_prevues: number | null;
  version: number;
}

export const DefinirObjectif = ({
  date,
  sites,
  shifts,
  existants,
  initial,
  onFermer,
  onEnregistre,
}: {
  date: string;
  sites: SiteResume[];
  shifts: ShiftHoraire[];
  /** Objectifs actifs connus pour la date : une cle deja prise = revision. */
  existants: Existant[];
  initial?: { site_id: string; shift_id: string | null };
  onFermer: () => void;
  onEnregistre: () => void;
}) => {
  const [form, setForm] = useState({
    date,
    site: initial?.site_id ?? (sites.length === 1 ? sites[0].id : ''),
    shift: initial?.shift_id ?? '',
    tonnes: '',
    voyages: '',
    camions: '',
    chargeuses: '',
    motif: '',
    note: '',
  });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const actuel = form.date === date
    ? existants.find((e) => e.site_id === form.site && (e.shift_id ?? '') === form.shift)
    : undefined;

  // Une revision part des valeurs en vigueur, que l'on modifie.
  useEffect(() => {
    if (!actuel) return;
    setForm((f) => ({
      ...f,
      tonnes: String(actuel.tonnes_cible),
      voyages: actuel.voyages_cible?.toString() ?? '',
      camions: actuel.camions_prevus?.toString() ?? '',
      chargeuses: actuel.chargeuses_prevues?.toString() ?? '',
    }));
  }, [actuel]);

  const maj = (champ: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [champ]: e.target.value });

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    const tonnes = nombre(form.tonnes);
    if (tonnes === null || !(tonnes > 0)) {
      setErreur('Indiquez un objectif en tonnes supérieur à zéro.');
      return;
    }
    setEnCours(true);
    setErreur('');
    const { error } = await supabase.rpc('definir_objectif', {
      p_date: form.date,
      p_site_id: form.site,
      p_shift_id: form.shift || null,
      p_tonnes: tonnes,
      p_voyages: nombre(form.voyages),
      p_camions: nombre(form.camions),
      p_chargeuses: nombre(form.chargeuses),
      p_motif: form.motif || null,
      p_note: form.note || null,
    });
    setEnCours(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    onEnregistre();
  };

  return (
    <Fenetre
      titre={actuel ? `Réviser l'objectif (version ${actuel.version + 1})` : 'Définir un objectif'}
      onFermer={onFermer}
    >
      <form onSubmit={valider}>
        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Date *</span>
            <input type="date" value={form.date} onChange={maj('date')} className={CHAMP} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Site de chargement *</span>
            <select value={form.site} onChange={maj('site')} className={CHAMP} required>
              <option value="">Choisir un site</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-stone-700">Portée</span>
            <select value={form.shift} onChange={maj('shift')} className={CHAMP}>
              <option value="">Journée entière (tous les shifts)</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>Shift {s.display_name} ({s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)})</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Objectif (tonnes) *</span>
            <input inputMode="decimal" value={form.tonnes} onChange={maj('tonnes')} className={CHAMP} required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Voyages visés</span>
            <input inputMode="numeric" value={form.voyages} onChange={maj('voyages')} className={CHAMP} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Camions prévus</span>
            <input inputMode="numeric" value={form.camions} onChange={maj('camions')} className={CHAMP} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-700">Chargeuses et pelles prévues</span>
            <input inputMode="numeric" value={form.chargeuses} onChange={maj('chargeuses')} className={CHAMP} />
          </label>
          {actuel && (
            <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900 sm:col-span-2">
              Objectif en vigueur : <b>{formatNombre(Number(actuel.tonnes_cible))} t</b> (version {actuel.version}).
              La révision crée une nouvelle version ; l'ancienne reste consultable.
            </div>
          )}
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-stone-700">
              {actuel ? 'Motif de la révision (obligatoire)' : 'Motif (obligatoire si un objectif a déjà existé à cette date)'}
            </span>
            <input value={form.motif} onChange={maj('motif')} className={CHAMP} required={Boolean(actuel)} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-stone-700">Note</span>
            <textarea value={form.note} onChange={maj('note')} rows={2} className={CHAMP} />
          </label>
          {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{erreur}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
          <button type="button" onClick={onFermer} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Annuler</button>
          <button type="submit" disabled={enCours} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">
            {enCours ? 'Enregistrement...' : actuel ? 'Enregistrer la révision' : 'Enregistrer l\'objectif'}
          </button>
        </footer>
      </form>
    </Fenetre>
  );
};

export const AnnulerObjectif = ({ id, libelle, onFermer, onAnnule }: {
  id: string;
  libelle: string;
  onFermer: () => void;
  onAnnule: () => void;
}) => {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const valider = async () => {
    setEnCours(true);
    setErreur('');
    const { error } = await supabase.rpc('annuler_objectif', { p_id: id, p_motif: motif });
    setEnCours(false);
    if (error) setErreur(error.message);
    else onAnnule();
  };
  return (
    <Fenetre
      titre="Annuler l'objectif"
      onFermer={onFermer}
      largeur="max-w-lg"
      pied={<>
        <button onClick={onFermer} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Retour</button>
        <button onClick={valider} disabled={enCours || !motif.trim()} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
          {enCours ? 'Annulation...' : 'Annuler l\'objectif'}
        </button>
      </>}
    >
      <div className="space-y-3 px-6 py-5 text-sm">
        <p className="text-stone-600">{libelle}. L'objectif reste dans l'historique avec son motif d'annulation.</p>
        <label className="block">
          <span className="mb-1 block font-medium text-stone-700">Motif (obligatoire)</span>
          <input value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP} />
        </label>
        {erreur && <p className="rounded-lg bg-red-50 p-3 text-red-700">{erreur}</p>}
      </div>
    </Fenetre>
  );
};

interface Version {
  id: string;
  version: number;
  tonnes_cible: number;
  voyages_cible: number | null;
  statut: string;
  motif: string | null;
  note: string | null;
  cree_le: string;
  clos_le: string | null;
  motif_annulation: string | null;
}

const horodatage = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const HistoriqueObjectif = ({ date, siteId, shiftId, libelle, onFermer }: {
  date: string;
  siteId: string;
  shiftId: string | null;
  libelle: string;
  onFermer: () => void;
}) => {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    let requete = supabase
      .from('objectifs_production')
      .select('id, version, tonnes_cible, voyages_cible, statut, motif, note, cree_le, clos_le, motif_annulation')
      .eq('date_plan', date)
      .eq('site_id', siteId)
      .order('version', { ascending: false });
    requete = shiftId ? requete.eq('shift_id', shiftId) : requete.is('shift_id', null);
    requete.then(({ data, error }) => {
      if (error) setErreur(error.message);
      setVersions((data ?? []) as Version[]);
    });
  }, [date, siteId, shiftId]);

  return (
    <Fenetre titre="Historique de l'objectif" onFermer={onFermer} largeur="max-w-lg">
      <div className="px-6 py-5">
        <p className="mb-4 text-sm text-stone-500">{libelle}</p>
        {erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
        {versions === null ? (
          <p className="text-sm text-stone-400">Chargement...</p>
        ) : (
          <ol className="space-y-3">
            {versions.map((v) => (
              <li key={v.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                <p className="font-semibold text-stone-900">
                  Version {v.version} : {formatNombre(Number(v.tonnes_cible))} t
                  {v.voyages_cible ? ` · ${v.voyages_cible} voyages` : ''}
                  <span className={`ml-2 text-xs font-medium ${v.statut === 'actif' ? 'text-green-700' : v.statut === 'annule' ? 'text-red-700' : 'text-stone-500'}`}>
                    {v.statut === 'actif' ? 'en vigueur' : v.statut === 'annule' ? 'annulé' : 'remplacé'}
                  </span>
                </p>
                <p className="text-xs text-stone-500">Défini le {horodatage(v.cree_le)}{v.clos_le ? ` · clos le ${horodatage(v.clos_le)}` : ''}</p>
                {v.motif && <p className="text-stone-600">Motif : {v.motif}</p>}
                {v.note && <p className="text-stone-600">{v.note}</p>}
                {v.motif_annulation && <p className="text-red-700">Annulation : {v.motif_annulation}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Fenetre>
  );
};

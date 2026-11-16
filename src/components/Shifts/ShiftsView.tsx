import { useCallback, useEffect, useMemo, useState } from 'react';
import { Moon, PenLine, Plus, Power, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { dureeMinutes, erreurSaisieShift, estDeNuit, type SaisieShift, type Shift } from './shifts';

// Gestion des shifts (D-078) : liste, creation, modification motivee et
// desactivation motivee. Ecriture par definir_shift et desactiver_shift
// (droit settings ou administrateur, profil sans site) ; un shift n'est
// jamais supprime.

interface Ligne { id: string; shift_id: string; action: string; motif: string | null; le: string }

const CHAMP = 'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm';
const vide = (ordre: number): SaisieShift => ({ nom: '', libelle: '', debut: '', fin: '', ordre: String(ordre), actif: true });
const hm = (t: string) => t.slice(0, 5);
const ACTIONS: Record<string, string> = { creation: 'Création', modification: 'Modification', desactivation: 'Désactivation', reactivation: 'Réactivation' };

export const ShiftsView = () => {
  const { hasPermission, profile } = useAuth();
  const peutEcrire = (hasPermission('settings', 'edit') || hasPermission('settings', 'create') || profile?.role === 'admin') && !profile?.site_id;
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [journal, setJournal] = useState<Ligne[]>([]);
  const [erreur, setErreur] = useState('');
  const [erreurJournal, setErreurJournal] = useState('');
  const [message, setMessage] = useState('');
  const [edition, setEdition] = useState<{ id: string | null; saisie: SaisieShift; motif: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [rS, rJ] = await Promise.all([
      supabase.from('work_shifts').select('id, name, display_name, start_time, end_time, shift_order, is_active').order('shift_order'),
      supabase.from('journal_shifts').select('id, shift_id, action, motif, le').order('le', { ascending: false }).limit(50),
    ]);
    if (rS.error) { setErreur(`Shifts indisponibles : ${rS.error.message}`); setShifts([]); }
    else setShifts((rS.data ?? []) as Shift[]);
    if (rJ.error) { setErreurJournal(`Journal des shifts indisponible : ${rJ.error.message}`); setJournal([]); }
    else { setErreurJournal(''); setJournal((rJ.data ?? []) as Ligne[]); }
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const libelle = useMemo(() => new Map((shifts ?? []).map((s) => [s.id, s.display_name])), [shifts]);
  const prochainOrdre = Math.max(0, ...(shifts ?? []).map((s) => s.shift_order)) + 1;

  const ouvrir = (s: Shift | null) => {
    setMessage(''); setErreur('');
    setEdition(s
      ? { id: s.id, saisie: { nom: s.name, libelle: s.display_name, debut: hm(s.start_time), fin: hm(s.end_time), ordre: String(s.shift_order), actif: Boolean(s.is_active) }, motif: '' }
      : { id: null, saisie: vide(prochainOrdre), motif: '' });
  };

  const enregistrer = async () => {
    if (!edition) return;
    const autres = (shifts ?? []).filter((s) => s.id !== edition.id);
    const e = erreurSaisieShift(edition.saisie, autres);
    if (e) { setErreur(e); return; }
    if (edition.id && !edition.motif.trim()) { setErreur('Motif obligatoire pour modifier un shift'); return; }
    setEnCours(true); setErreur('');
    const { error } = await supabase.rpc('definir_shift', {
      p_id: edition.id, p_nom: edition.saisie.nom.trim(), p_libelle: edition.saisie.libelle.trim(),
      p_debut: edition.saisie.debut, p_fin: edition.saisie.fin, p_ordre: Number(edition.saisie.ordre),
      p_actif: edition.saisie.actif, p_motif: edition.motif.trim() || null,
    });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setMessage(edition.id ? 'Shift modifié.' : 'Shift créé : il est proposé dans la planification, le dispatch, les postes et les fiches.');
    setEdition(null);
    charger();
  };

  const desactiver = async (s: Shift) => {
    const motif = window.prompt(`Motif de la désactivation du shift ${s.display_name}`);
    if (motif === null) return;
    if (!motif.trim()) { setErreur('Motif obligatoire pour désactiver un shift'); return; }
    const { error } = await supabase.rpc('desactiver_shift', { p_id: s.id, p_motif: motif.trim() });
    if (error) setErreur(error.message); else { setMessage(`Shift ${s.display_name} désactivé.`); setErreur(''); }
    charger();
  };

  const maj = (champ: keyof SaisieShift, valeur: string | boolean) =>
    edition && setEdition({ ...edition, saisie: { ...edition.saisie, [champ]: valeur } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900">Shifts</h2>
          <p className="text-stone-500">Horaires de travail communs à tous les sites ; un shift utilisé se désactive, il ne se supprime pas</p>
        </div>
        {peutEcrire && (
          <button onClick={() => ouvrir(null)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white">
            <Plus className="h-4 w-4" /> Nouveau shift
          </button>
        )}
      </div>
      {!peutEcrire && (
        <p role="note" className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
          Lecture seule : la création et la modification des shifts demandent le droit Paramètres sur un profil sans site.
        </p>
      )}
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

      {edition && (
        <Panneau titre={edition.id ? 'Modifier le shift' : 'Nouveau shift'}>
          <div role="form" aria-label="Saisie du shift" className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">Libellé affiché *<input value={edition.saisie.libelle} onChange={(e) => maj('libelle', e.target.value)} className={CHAMP} placeholder="Jour" /></label>
            <label className="text-sm">Nom technique *<input value={edition.saisie.nom} onChange={(e) => maj('nom', e.target.value)} className={CHAMP} placeholder="jour" /></label>
            <label className="text-sm">Ordre d'affichage *<input inputMode="numeric" value={edition.saisie.ordre} onChange={(e) => maj('ordre', e.target.value)} className={CHAMP} /></label>
            <label className="text-sm">Heure de début *<input type="time" value={edition.saisie.debut} onChange={(e) => maj('debut', e.target.value)} className={CHAMP} /></label>
            <label className="text-sm">Heure de fin *<input type="time" value={edition.saisie.fin} onChange={(e) => maj('fin', e.target.value)} className={CHAMP} /></label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={edition.saisie.actif} onChange={(e) => maj('actif', e.target.checked)} /> Actif</label>
            {edition.id && (
              <label className="text-sm sm:col-span-3">Motif de la modification *<input value={edition.motif} onChange={(e) => setEdition({ ...edition, motif: e.target.value })} className={CHAMP} /></label>
            )}
          </div>
          {edition.saisie.debut && edition.saisie.fin && estDeNuit(edition.saisie.debut, edition.saisie.fin) && (
            <p className="mt-2 text-xs text-stone-500">Shift de nuit : il se termine le lendemain ({dureeMinutes(edition.saisie.debut, edition.saisie.fin)} min).</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEdition(null)} className="rounded-lg border px-4 py-2 text-sm">Annuler</button>
            <button onClick={enregistrer} disabled={enCours} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {enCours ? 'Enregistrement…' : 'Enregistrer le shift'}
            </button>
          </div>
        </Panneau>
      )}

      <Panneau titre="Shifts paramétrés">
        {shifts === null ? (
          <p className="text-sm text-stone-400">Chargement…</p>
        ) : shifts.length === 0 ? (
          <SansDonnees message="Aucun shift" detail="Créez au moins un shift (par exemple Jour et Nuit) pour planifier, dispatcher, ouvrir les postes et préparer les fiches." />
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="py-2 pr-3 font-medium">Ordre</th><th className="py-2 pr-3 font-medium">Shift</th>
              <th className="py-2 pr-3 font-medium">Horaires</th><th className="py-2 pr-3 font-medium">Statut</th>
              {peutEcrire && <th className="py-2 font-medium">Actions</th>}
            </tr></thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-3 text-stone-500">{s.shift_order}</td>
                  <td className="py-2 pr-3"><span className="font-semibold text-stone-900">{s.display_name}</span> <span className="text-xs text-stone-400">{s.name}</span></td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1">
                      {estDeNuit(s.start_time, s.end_time) ? <Moon className="h-4 w-4 text-stone-400" /> : <Sun className="h-4 w-4 text-orange-400" />}
                      {hm(s.start_time)} – {hm(s.end_time)}
                    </span>
                  </td>
                  <td className="py-2 pr-3"><Puce teinte={s.is_active ? 'vert' : 'gris'}>{s.is_active ? 'Actif' : 'Inactif'}</Puce></td>
                  {peutEcrire && (
                    <td className="whitespace-nowrap py-2">
                      <button onClick={() => ouvrir(s)} aria-label={`Modifier le shift ${s.display_name}`} className="mr-1 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-800"><PenLine className="inline h-3.5 w-3.5" /> Modifier</button>
                      {s.is_active && <button onClick={() => desactiver(s)} aria-label={`Désactiver le shift ${s.display_name}`} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Power className="inline h-3.5 w-3.5" /> Désactiver</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panneau>

      {erreurJournal && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreurJournal}</p>
      )}
      {journal.length > 0 && (
        <Panneau titre="Historique">
          <ul className="divide-y divide-stone-100 text-sm">
            {journal.map((j) => (
              <li key={j.id} className="flex flex-wrap gap-x-3 py-2">
                <span className="text-stone-500">{new Date(j.le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="font-semibold text-stone-900">{libelle.get(j.shift_id) ?? '—'}</span>
                <span>{ACTIONS[j.action] ?? j.action}</span>
                {j.motif && <span className="text-stone-500">« {j.motif} »</span>}
              </li>
            ))}
          </ul>
        </Panneau>
      )}
      <Provenance source="work_shifts, journal_shifts (D-078)" heure={heure} />
    </div>
  );
};

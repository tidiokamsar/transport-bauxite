import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';

// Tare de reference d'un engin (D-095, D-120). Le module flotte propose une
// valeur ; seul l'administrateur KOGON la valide. Toute proposition, validation
// et retrait est journalise (journal_tare). La valeur applicable est lue par le
// serveur (tare_applicable) : aucun recalcul ni valeur par defaut ici.

interface Reference {
  id: string; vehicle_id: string; tare_tonnes: number; tracteur_id: string | null; remorque_id: string | null;
  statut: 'proposee' | 'validee' | 'retiree'; motif: string | null;
  propose_le: string; valide_le: string | null; retire_le: string | null;
}
interface Applicable { id: string; tare_tonnes: number; statut: string; valide_le: string | null; tracteur_id: string | null; remorque_id: string | null }
interface JournalTare { id: string; reference_id: string; action: string; motif: string | null; le: string; auteur: string | null }

const STATUT: Record<string, { texte: string; teinte: 'vert' | 'orange' | 'gris' | 'rouge' }> = {
  validee: { texte: 'Validée', teinte: 'vert' },
  proposee: { texte: 'Proposée', teinte: 'orange' },
  retiree: { texte: 'Retirée', teinte: 'gris' },
};
const dateHeure = (d: string | null) => (d ? new Date(d).toLocaleString('fr-FR') : '—');

export const TareEngin = ({ vehicleId, peutEcrire }: { vehicleId: string; peutEcrire: boolean }) => {
  const { profile } = useAuth();
  const admin = profile?.role === 'admin';
  const [references, setReferences] = useState<Reference[] | null>(null);
  const [applicable, setApplicable] = useState<Applicable | null>(null);
  const [journal, setJournal] = useState<JournalTare[] | null>(null);
  const [engins, setEngins] = useState<{ id: string; registration: string }[]>([]);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [tare, setTare] = useState('');
  const [tracteur, setTracteur] = useState('');
  const [remorque, setRemorque] = useState('');
  const [motif, setMotif] = useState('');
  const [motifAction, setMotifAction] = useState('');

  const charger = useCallback(async () => {
    setErreur('');
    const [r, a, j, e] = await Promise.all([
      supabase.from('tare_references')
        .select('id, vehicle_id, tare_tonnes, tracteur_id, remorque_id, statut, motif, propose_le, valide_le, retire_le')
        .eq('vehicle_id', vehicleId).order('propose_le', { ascending: false }),
      supabase.rpc('tare_applicable', { p_vehicle: vehicleId }),
      supabase.from('journal_tare')
        .select('id, reference_id, action, motif, le, auteur')
        .eq('vehicle_id', vehicleId).order('le', { ascending: false }).limit(20),
      supabase.from('vehicles').select('id, registration').order('registration'),
    ]);
    setErreur(r.error?.message ?? a.error?.message ?? j.error?.message ?? e.error?.message ?? '');
    setReferences(r.error ? [] : ((r.data ?? []) as Reference[]));
    setApplicable(a.error ? null : ((a.data ?? null) as Applicable | null));
    setJournal(j.error ? null : ((j.data ?? []) as JournalTare[]));
    setEngins((e.data ?? []) as { id: string; registration: string }[]);
  }, [vehicleId]);

  useEffect(() => { charger(); }, [charger]);

  const libelle = (id: string | null) => (id ? engins.find((x) => x.id === id)?.registration ?? 'engin non visible' : 'aucun');

  const proposer = async () => {
    const valeur = Number(tare.replace(',', '.'));
    if (!Number.isFinite(valeur) || valeur <= 0) { setErreur('Tare en tonnes attendue (valeur positive).'); return; }
    setEnCours(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc('proposer_tare', {
      p_vehicle: vehicleId, p_tare_tonnes: valeur,
      p_tracteur: tracteur || null, p_remorque: remorque || null,
      p_motif: motif.trim() || null,
    });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setTare(''); setMotif('');
    setMessage('Proposition enregistrée. Elle devient applicable après validation par l’administrateur KOGON.');
    charger();
  };

  const valider = async (id: string) => {
    if (motifAction.trim().length < 5) { setErreur('Motif de validation obligatoire (5 caractères au moins).'); return; }
    setEnCours(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc('valider_tare', { p_reference: id, p_motif: motifAction.trim() });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setMotifAction('');
    setMessage('Tare validée et journalisée.');
    charger();
  };

  const retirer = async (id: string) => {
    if (motifAction.trim().length < 5) { setErreur('Motif de retrait obligatoire (5 caractères au moins).'); return; }
    setEnCours(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc('retirer_tare', { p_reference: id, p_motif: motifAction.trim() });
    setEnCours(false);
    if (error) { setErreur(error.message); return; }
    setMotifAction('');
    setMessage('Tare retirée et journalisée.');
    charger();
  };

  return (
    <div className="space-y-4">
      <Panneau titre="Tare applicable">
        {applicable ? (
          <div className="text-sm">
            <p className="text-2xl font-black text-stone-900">{formatNombre(Number(applicable.tare_tonnes))} t</p>
            <p className="text-stone-600">Validée le {dateHeure(applicable.valide_le)} · tracteur {libelle(applicable.tracteur_id)} · remorque {libelle(applicable.remorque_id)}</p>
            <p className="mt-1 text-xs text-stone-500">Valeur figée sur chaque rotation à sa date ; une nouvelle validation ne modifie pas les rotations déjà figées (D-095).</p>
          </div>
        ) : (
          <SansDonnees message="Aucune tare validée" detail="Le dispatch et le rapprochement CBG la signalent absente ; aucune valeur n’est supposée." />
        )}
      </Panneau>

      {peutEcrire && (
        <Panneau titre="Proposer une tare">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">Tare (t)
              <input value={tare} onChange={(e) => setTare(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm">Tracteur (optionnel)
              <select value={tracteur} onChange={(e) => setTracteur(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
                <option value="">Aucun</option>
                {engins.map((x) => <option key={x.id} value={x.id}>{x.registration}</option>)}
              </select>
            </label>
            <label className="text-sm">Remorque (optionnel)
              <select value={remorque} onChange={(e) => setRemorque(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2">
                <option value="">Aucune</option>
                {engins.map((x) => <option key={x.id} value={x.id}>{x.registration}</option>)}
              </select>
            </label>
            <label className="text-sm">Motif (optionnel)
              <input value={motif} onChange={(e) => setMotif(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
            </label>
          </div>
          <button onClick={proposer} disabled={enCours} className="mt-3 rounded-lg bg-orange-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Enregistrer la proposition
          </button>
          <p className="mt-2 text-xs text-stone-500">La proposition n’est pas applicable avant validation par l’administrateur KOGON.</p>
        </Panneau>
      )}

      {admin && (
        <Panneau titre="Validation ou retrait (administrateur KOGON)">
          <label className="text-sm">Motif
            <input value={motifAction} onChange={(e) => setMotifAction(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" placeholder="Motif obligatoire pour valider ou retirer" />
          </label>
          <p className="mt-2 text-xs text-stone-500">Chaque décision est journalisée ; aucune suppression physique.</p>
        </Panneau>
      )}

      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

      <Panneau titre="Historique des tares">
        {references === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : references.length === 0 ? <SansDonnees message="Aucune tare enregistrée" detail="La fiche flotte n’a jamais proposé de tare pour cet engin." />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Tares de l'engin">
                  <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="py-2">Tare</th><th>Tracteur</th><th>Remorque</th><th>Statut</th><th>Proposée le</th><th>Validée le</th><th>Motif</th><th>Action</th>
                  </tr></thead>
                  <tbody>{references.map((r) => {
                    const st = STATUT[r.statut] ?? { texte: r.statut, teinte: 'gris' as const };
                    return (
                      <tr key={r.id} className="border-b border-stone-100">
                        <td className="py-1.5 font-semibold">{formatNombre(Number(r.tare_tonnes))} t</td>
                        <td>{libelle(r.tracteur_id)}</td><td>{libelle(r.remorque_id)}</td>
                        <td><Puce teinte={st.teinte}>{st.texte}</Puce></td>
                        <td>{dateHeure(r.propose_le)}</td><td>{dateHeure(r.valide_le)}</td><td>{r.motif ?? '—'}</td>
                        <td>{admin && r.statut === 'proposee' && (
                          <button onClick={() => valider(r.id)} disabled={enCours} className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">Valider</button>
                        )}{admin && r.statut === 'validee' && (
                          <button onClick={() => retirer(r.id)} disabled={enCours} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-50">Retirer</button>
                        )}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
      </Panneau>

      <Panneau titre="Journal des tares">
        {journal === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : journal.length === 0 ? <SansDonnees message="Journal vide" detail="Aucune proposition, validation ou retrait enregistré pour cet engin." />
            : (
              <ul className="space-y-2 text-sm">
                {journal.map((j) => (
                  <li key={j.id} className="rounded-lg border border-stone-200 p-2">
                    <span className="font-semibold">{j.action}</span> · {dateHeure(j.le)}{j.motif ? ` · ${j.motif}` : ''}
                  </li>
                ))}
              </ul>
            )}
      </Panneau>
    </div>
  );
};

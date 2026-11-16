import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Provenance, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { bornesMois } from '../Finance/finance';

// Evaluation periodique du loueur (D-065) sur la grille D-059 reutilisee
// (grille « loueur ») : criteres et poids saisis par l'administrateur, notes
// de 1 a 5 saisies par l'evaluateur a cote des indicateurs mesures
// (disponibilite, delais d'intervention D-049, ecarts de facture D-032).
// Aucune conversion automatique d'une mesure en note ; append-only.

interface Critere { id: string; libelle: string; poids: number; ordre: number; actif: boolean; indicateur: string | null; description: string | null }
interface Mesure { indicateur: string; libelle: string; valeur: number | null; unite: string; echantillon: number; source: string }
interface Evaluation { id: string; contrat_id: string; periode_debut: string; periode_fin: string; note_globale: number; commentaire: string | null; motif_correction: string | null; evalue_le: string }

const INDICATEURS_LOUEUR: Record<string, string> = {
  disponibilite: 'Disponibilité des engins', delai_prise_en_charge: 'Délai de prise en charge',
  interventions_hors_delai: 'Interventions hors délai', ecart_facture: 'Écart des factures contrôlées',
};
const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const moisPrecedent = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };
const jour = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR');

export const EvaluationLoueurView = () => {
  const { hasPermission, profile } = useAuth();
  const estAdmin = profile?.role === 'admin';
  const peutEvaluer = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const [contrats, setContrats] = useState<{ id: string; reference: string; contrepartie: string }[]>([]);
  const [contrat, setContrat] = useState('');
  const [mois, setMois] = useState(moisPrecedent);
  const [criteres, setCriteres] = useState<Critere[]>([]);
  const [mesures, setMesures] = useState<Mesure[] | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [commentaire, setCommentaire] = useState('');
  const [motif, setMotif] = useState('');
  const [nouveau, setNouveau] = useState({ libelle: '', poids: '', indicateur: '' });
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  useEffect(() => {
    supabase.from('contrats').select('id, reference, contrepartie').eq('nature', 'location').order('reference').then(({ data }) => {
      const liste = (data ?? []) as { id: string; reference: string; contrepartie: string }[];
      setContrats(liste);
      setContrat((x) => x || liste[0]?.id || '');
    });
  }, []);

  const charger = useCallback(async () => {
    const { du, au } = bornesMois(mois);
    const [c, e, m] = await Promise.all([
      supabase.from('criteres_evaluation_fournisseur').select('id, libelle, poids, ordre, actif, indicateur, description').eq('grille', 'loueur').order('ordre'),
      contrat ? supabase.from('v_evaluations_loueur_courantes').select('*').eq('contrat_id', contrat).order('periode_debut', { ascending: false }) : Promise.resolve({ data: [] }),
      contrat ? supabase.rpc('mesures_loueur', { p_contrat: contrat, p_du: du, p_au: au }) : Promise.resolve({ data: [] }),
    ]);
    setCriteres((c.data ?? []) as Critere[]);
    setEvaluations((e.data ?? []) as Evaluation[]);
    setMesures((m.data ?? []) as Mesure[]);
    setHeure(new Date());
  }, [contrat, mois]);
  useEffect(() => { charger(); }, [charger]);

  const actifs = criteres.filter((c) => c.actif);
  const { du, au } = bornesMois(mois);
  const dejaEvalue = evaluations.some((e) => e.periode_debut === du && e.periode_fin === au);
  const notesValides = actifs.length > 0 && actifs.every((c) => /^[1-5]$/.test(notes[c.id] ?? ''));
  const valide = !!contrat && notesValides && (!dejaEvalue || !!motif.trim());

  const evaluer = async () => {
    const { error } = await supabase.rpc('evaluer_loueur', {
      p_contrat: contrat, p_debut: du, p_fin: au, p_notes: actifs.map((c) => ({ critere: c.id, note: Number(notes[c.id]) })),
      p_commentaire: commentaire.trim() || null, p_motif_correction: dejaEvalue ? motif.trim() : null,
    });
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: 'Évaluation enregistrée avec les mesures de la période.' });
    if (!error) { setNotes({}); setCommentaire(''); setMotif(''); charger(); }
  };
  const ajouterCritere = async () => {
    const { error } = await supabase.rpc('definir_critere_loueur', {
      p_libelle: nouveau.libelle.trim(), p_poids: Number(nouveau.poids), p_indicateur: nouveau.indicateur || null,
    });
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: 'Critère ajouté à la grille du loueur.' });
    if (!error) { setNouveau({ libelle: '', poids: '', indicateur: '' }); charger(); }
  };
  const basculer = async (c: Critere) => {
    const { error } = await supabase.rpc('definir_critere_loueur', {
      p_libelle: c.libelle, p_poids: c.poids, p_indicateur: c.indicateur, p_description: c.description, p_ordre: c.ordre, p_actif: !c.actif, p_id: c.id,
    });
    setMessage(error ? { ok: false, texte: error.message } : null);
    charger();
  };
  const mesureDe = (indicateur: string | null) => mesures?.find((m) => m.indicateur === indicateur);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black text-stone-900">Évaluation du loueur</h2><p className="text-stone-500">Grille pondérée saisie par l'administrateur, notes à côté des indicateurs mesurés</p></div>
        <div className="flex flex-wrap gap-2">
          <select value={contrat} onChange={(e) => setContrat(e.target.value)} aria-label="Contrat de location" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
            {contrats.length === 0 && <option value="">Aucun contrat de location</option>}
            {contrats.map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.contrepartie}</option>)}
          </select>
          <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois évalué" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
        </div>
      </div>
      {message && <p className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}

      <Panneau titre="Indicateurs mesurés de la période">
        {!mesures || mesures.length === 0 ? <SansDonnees message="Sans données" /> : (
          <ul className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs mesurés">
            {mesures.map((m) => (
              <li key={m.indicateur} className="rounded-xl bg-stone-50 p-3">
                <p className="text-stone-500">{m.libelle}</p>
                <p className="text-xl font-black text-stone-900">{m.valeur === null ? 'Sans données' : `${formatNombre(Number(m.valeur), 1)} ${m.unite}`}</p>
                <p className="text-xs text-stone-400">{m.echantillon} mesure(s) · {m.source}</p>
              </li>
            ))}
          </ul>
        )}
        <Provenance source="engins rattachés au contrat (flotte), immobilisations, interventions du loueur, contrôle de ses factures" heure={heure} />
      </Panneau>

      <Panneau titre={`Évaluer ${mois}${dejaEvalue ? ' (déjà évalué : correction motivée)' : ''}`}>
        {actifs.length === 0 ? <SansDonnees message="Aucune grille" detail="L'administrateur définit les critères et leurs poids : aucune grille par défaut." /> : (
          <form onSubmit={(e) => { e.preventDefault(); if (valide) evaluer(); }} aria-label="Évaluation du loueur" className="space-y-3 text-sm">
            {actifs.map((c) => {
              const m = mesureDe(c.indicateur);
              return (
                <label key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2">
                  <span><b>{c.libelle}</b> · poids {c.poids}{c.indicateur ? ` · mesure : ${m?.valeur == null ? 'sans données' : `${formatNombre(Number(m.valeur), 1)} ${m.unite}`}` : ''}</span>
                  <select value={notes[c.id] ?? ''} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} aria-label={`Note ${c.libelle}`} className="rounded border border-stone-300 px-2 py-1">
                    <option value="">Note</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              );
            })}
            <label className="block">Commentaire<input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} className={CHAMP} /></label>
            {dejaEvalue && <label className="block">Motif de la correction *<input value={motif} onChange={(e) => setMotif(e.target.value)} className={CHAMP} /></label>}
            {peutEvaluer && <div className="flex justify-end"><button type="submit" disabled={!valide} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 font-bold text-white disabled:opacity-50">Enregistrer l'évaluation</button></div>}
          </form>
        )}
      </Panneau>

      <Panneau titre="Évaluations enregistrées">
        {evaluations.length === 0 ? <SansDonnees message="Aucune évaluation" /> : (
          <ul className="divide-y divide-stone-100 text-sm">{evaluations.map((e) => (
            <li key={e.id} className="py-2">Du {jour(e.periode_debut)} au {jour(e.periode_fin)} · note <b>{formatNombre(Number(e.note_globale), 2)} / 5</b>
              {e.commentaire ? ` · ${e.commentaire}` : ''}{e.motif_correction ? ` · correction : ${e.motif_correction}` : ''}</li>
          ))}</ul>
        )}
      </Panneau>

      <Panneau titre="Grille du loueur">
        {criteres.length === 0 ? <SansDonnees message="Grille vide" /> : (
          <ul className="divide-y divide-stone-100 text-sm" aria-label="Grille du loueur">{criteres.map((c) => (
            <li key={c.id} className={`flex items-center justify-between gap-2 py-1.5 ${c.actif ? '' : 'text-stone-400'}`}>
              <span><b>{c.libelle}</b> · poids {c.poids}{c.indicateur ? ` · ${INDICATEURS_LOUEUR[c.indicateur] ?? c.indicateur}` : ' · critère qualitatif'}</span>
              {estAdmin && <button onClick={() => basculer(c)} className="rounded border border-stone-200 px-2 py-0.5 text-xs">{c.actif ? 'Désactiver' : 'Réactiver'}</button>}
            </li>
          ))}</ul>
        )}
        {estAdmin && (
          <form onSubmit={(e) => { e.preventDefault(); ajouterCritere(); }} aria-label="Nouveau critère du loueur" className="mt-3 flex flex-wrap items-end gap-2 text-sm">
            <label className="flex-1">Libellé *<input value={nouveau.libelle} onChange={(e) => setNouveau({ ...nouveau, libelle: e.target.value })} className={CHAMP} /></label>
            <label>Poids *<input inputMode="numeric" value={nouveau.poids} onChange={(e) => setNouveau({ ...nouveau, poids: e.target.value })} className={CHAMP} /></label>
            <label>Indicateur mesuré
              <select value={nouveau.indicateur} onChange={(e) => setNouveau({ ...nouveau, indicateur: e.target.value })} className={CHAMP}>
                <option value="">Aucun (qualitatif)</option>
                {Object.entries(INDICATEURS_LOUEUR).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <button type="submit" disabled={!nouveau.libelle.trim() || !/^[1-9]\d*$/.test(nouveau.poids)} className="rounded-lg bg-stone-800 px-3 py-2 font-semibold text-white disabled:opacity-50">Ajouter</button>
          </form>
        )}
      </Panneau>
    </div>
  );
};

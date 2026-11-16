import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce, SansDonnees, type TeintePuce } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { TYPES_CLAUSE } from './types';

// Clauses chiffrees calculees depuis un rapport de performance remis
// (D-065). Le serveur propose ; l'humain applique (ligne de facture ou avoir,
// circuit D-029 : signature du Directeur General) ou ecarte, avec un motif.

export interface CalculClause {
  id: string; clause_id: string; rapport_id: string; periode_debut: string; periode_fin: string; type_clause: 'penalite' | 'bonus' | 'retenue';
  libelle: string; base: string; valeur: number; plafond_ht: number | null; realise: number | null; seuil: number | null; unite: string | null;
  conforme: boolean | null; assiette_ht: number | null; assiette_source: string | null; montant_calcule_ht: number | null; montant_propose_ht: number | null;
  devise: string; raison: string | null; statut: 'propose' | 'sans_objet' | 'applique' | 'ecarte'; motif_decision: string | null; facture_id: string | null;
}
interface FactureContrat { id: string; numero: string | null; objet: string; statut: string; type: string }

const STATUTS: Record<CalculClause['statut'], { texte: string; teinte: TeintePuce }> = {
  propose: { texte: 'À décider', teinte: 'orange' }, sans_objet: { texte: 'Sans objet', teinte: 'gris' },
  applique: { texte: 'Appliquée', teinte: 'vert' }, ecarte: { texte: 'Écartée', teinte: 'rouge' },
};
const mois = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

export const ClausesCalculees = ({ contratId, nature, peutDecider, version }: { contratId: string; nature: string | null; peutDecider: boolean; version: number }) => {
  const [calculs, setCalculs] = useState<CalculClause[] | null>(null);
  const [factures, setFactures] = useState<FactureContrat[]>([]);
  const [decision, setDecision] = useState<{ calcul: CalculClause; appliquer: boolean; motif: string; facture: string; taux: string } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [erreurLecture, setErreurLecture] = useState('');

  const charger = useCallback(async () => {
    const [c, f] = await Promise.all([
      supabase.from('calculs_clauses').select('*').eq('contrat_id', contratId).order('periode_debut', { ascending: false }),
      supabase.from('factures').select('id, numero, objet, statut, type').eq('contrat_id', contratId).eq('type', 'facture').in('statut', ['brouillon', 'emise']),
    ]);
    // Lecture impossible : etat d'erreur, jamais « aucun calcul ».
    const echec = c.error ?? f.error;
    setErreurLecture(echec ? `Calculs ou factures indisponibles : ${echec.message}` : '');
    setCalculs(c.error ? null : (c.data ?? []) as CalculClause[]);
    setFactures((f.data ?? []) as FactureContrat[]);
  }, [contratId]);
  useEffect(() => { charger(); }, [charger, version]);

  const aDeduire = (k: CalculClause) => nature === 'client' && k.type_clause !== 'bonus';
  const taux = decision ? Number(decision.taux.replace(',', '.')) : NaN;
  const decisionValide = !!decision && !!decision.motif.trim() && (!decision.appliquer
    || (aDeduire(decision.calcul) ? !!decision.facture : (!!decision.facture || (decision.taux.trim() !== '' && taux >= 0))));

  const decider = async () => {
    if (!decision) return;
    const { error } = await supabase.rpc('decider_clause', {
      p_calcul: decision.calcul.id, p_appliquer: decision.appliquer, p_motif: decision.motif.trim(),
      p_facture: decision.appliquer ? decision.facture || null : null,
      p_taux_taxe: decision.appliquer && !decision.facture && decision.taux.trim() !== '' ? taux : null,
    });
    setMessage(error ? { ok: false, texte: error.message }
      : { ok: true, texte: decision.appliquer ? 'Clause appliquée : la facture ou l\'avoir suit le circuit de signature.' : 'Proposition écartée.' });
    if (!error) setDecision(null);
    charger();
  };

  return (
    <Panneau titre="Clauses chiffrées calculées">
      {message && <p className={`mb-3 rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}
      {erreurLecture && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreurLecture}</p>}
      {calculs === null ? (erreurLecture ? null : <div className="h-12" />) : calculs.length === 0 ? (
        <SansDonnees message="Aucun calcul" detail="Saisissez les clauses dans le dossier contractuel, puis calculez-les depuis un rapport remis." />
      ) : (
        <ul className="divide-y divide-stone-100 text-sm" aria-label="Clauses calculées">
          {calculs.map((k) => (
            <li key={k.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <div>
                <p><b>{TYPES_CLAUSE[k.type_clause]}</b> · {k.libelle} · {mois(k.periode_debut)}</p>
                <p className="text-xs text-stone-500">
                  Mesure figée : {k.realise === null ? 'non mesurable' : `${formatNombre(Number(k.realise), 2)} ${k.unite ?? ''}`}{k.seuil !== null ? ` pour un seuil de ${formatNombre(Number(k.seuil), 2)} ${k.unite ?? ''}` : ''}
                  {k.assiette_ht !== null ? ` · assiette ${formatNombre(Number(k.assiette_ht), 2)} ${k.devise} HT (${k.assiette_source})` : ''}
                  {k.raison ? ` · ${k.raison}` : ''}{k.motif_decision ? ` · décision : ${k.motif_decision}` : ''}
                </p>
              </div>
              <span className="flex items-center gap-2">
                {k.montant_propose_ht !== null && <b>{formatNombre(Number(k.montant_propose_ht), 2)} {k.devise} HT</b>}
                <Puce teinte={STATUTS[k.statut].teinte}>{STATUTS[k.statut].texte}</Puce>
                {peutDecider && k.statut === 'propose' && (
                  <button onClick={() => setDecision({ calcul: k, appliquer: true, motif: '', facture: '', taux: '' })} className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-semibold"
                    aria-label={`Décider ${k.libelle}`}>Décider</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {decision && (
        <form onSubmit={(e) => { e.preventDefault(); if (decisionValide) decider(); }} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-orange-200 bg-orange-50/40 p-4 text-sm sm:grid-cols-2" aria-label="Décision sur la clause">
          <p className="sm:col-span-2"><b>{decision.calcul.libelle}</b> · proposé : {formatNombre(Number(decision.calcul.montant_propose_ht), 2)} {decision.calcul.devise} HT
            {aDeduire(decision.calcul) ? ' à déduire (avoir ou ligne négative)' : ' à facturer'}</p>
          <label className="block"><span className="mb-1 block font-medium">Décision *</span>
            <select value={decision.appliquer ? 'appliquer' : 'ecarter'} onChange={(e) => setDecision({ ...decision, appliquer: e.target.value === 'appliquer' })} className="w-full rounded-lg border border-stone-300 px-3 py-2">
              <option value="appliquer">Appliquer</option><option value="ecarter">Écarter</option>
            </select>
          </label>
          <label className="block"><span className="mb-1 block font-medium">Motif *</span>
            <input value={decision.motif} onChange={(e) => setDecision({ ...decision, motif: e.target.value })} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
          </label>
          {decision.appliquer && (
            <label className="block"><span className="mb-1 block font-medium">Facture du contrat{aDeduire(decision.calcul) ? ' *' : ''}</span>
              <select value={decision.facture} onChange={(e) => setDecision({ ...decision, facture: e.target.value })} className="w-full rounded-lg border border-stone-300 px-3 py-2">
                <option value="">{aDeduire(decision.calcul) ? 'Choisir' : 'Nouvelle facture brouillon'}</option>
                {factures.filter((f) => aDeduire(decision.calcul) || f.statut === 'brouillon').map((f) => (
                  <option key={f.id} value={f.id}>{f.numero ?? 'Brouillon'} · {f.objet} ({f.statut === 'emise' ? 'émise : avoir' : 'brouillon : ligne'})</option>
                ))}
              </select>
            </label>
          )}
          {decision.appliquer && !aDeduire(decision.calcul) && !decision.facture && (
            <label className="block"><span className="mb-1 block font-medium">Taux de taxe (%) *</span>
              <input inputMode="decimal" value={decision.taux} onChange={(e) => setDecision({ ...decision, taux: e.target.value })} placeholder="0 si exonéré" className="w-full rounded-lg border border-stone-300 px-3 py-2" />
            </label>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setDecision(null)} className="rounded-lg px-4 py-2 text-stone-600 hover:bg-stone-100">Annuler</button>
            <button type="submit" disabled={!decisionValide} className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 font-bold text-white disabled:opacity-50">Enregistrer la décision</button>
          </div>
        </form>
      )}
    </Panneau>
  );
};

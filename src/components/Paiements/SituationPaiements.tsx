import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';

// Situation des paiements fournisseurs sur une periode (D-125) : propositions,
// executions, controle a posteriori et pieces rattachees, lues par
// etat_paiements_fournisseur. Aucun montant n'est recalcule ici.

interface Ligne {
  paiement_id: string; numero: string; beneficiaire: string; devise: string | null;
  montant_propose: number | null; montant_execute: number | null; statut: string;
  propose_le: string | null; execute_le: string | null; controle_resultat: string | null;
  facture_fournisseur: string | null; bon_commande: string | null;
  source: string; fiabilite: 'mesure' | 'partielle' | 'sans_donnees';
}

const jour = (d: Date) => d.toISOString().slice(0, 10);
const montant = (v: number | null, devise: string | null) =>
  (v === null || v === undefined ? 'Sans données' : `${formatNombre(Number(v))} ${devise ?? ''}`.trim());

export const SituationPaiements = () => {
  const aujourdhui = new Date();
  const [debut, setDebut] = useState(jour(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1)));
  const [fin, setFin] = useState(jour(aujourdhui));
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    setErreur('');
    const { data, error } = await supabase.rpc('etat_paiements_fournisseur', { p_debut: debut, p_fin: fin });
    if (error) { setErreur(error.message); setLignes([]); return; }
    setLignes((data ?? []) as Ligne[]);
  }, [debut, fin]);

  useEffect(() => { charger(); }, [charger]);

  return (
    <Panneau titre="Situation de la période">
      <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
        <label>Du<input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className="ml-2 rounded-lg border border-stone-300 px-2 py-1" /></label>
        <label>Au<input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="ml-2 rounded-lg border border-stone-300 px-2 py-1" /></label>
      </div>
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {lignes === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
        : lignes.length === 0 ? <SansDonnees message="Aucun paiement sur la période" detail="Aucune proposition ni exécution enregistrée pour ces dates." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Paiements fournisseurs de la période">
                <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-2">Numéro</th><th>Bénéficiaire</th><th>Pièce</th><th>Proposé</th><th>Exécuté</th>
                  <th>Statut</th><th>Contrôle</th><th>Fiabilité</th>
                </tr></thead>
                <tbody>{lignes.map((l) => (
                  <tr key={l.paiement_id} className="border-b border-stone-100">
                    <td className="py-1.5"><b>{l.numero}</b></td>
                    <td>{l.beneficiaire}</td>
                    <td className="text-xs">{l.facture_fournisseur ?? l.bon_commande ?? '—'}</td>
                    <td>{montant(l.montant_propose, l.devise)}</td>
                    <td>{montant(l.montant_execute, l.devise)}</td>
                    <td>{l.statut}</td>
                    <td>{l.controle_resultat ?? 'à faire'}</td>
                    <td><Puce teinte={l.fiabilite === 'mesure' ? 'vert' : l.fiabilite === 'partielle' ? 'orange' : 'gris'}>{l.fiabilite}</Puce></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
      <p className="mt-2 text-xs text-stone-500">Source : {lignes?.[0]?.source ?? 'paiements_fournisseur, factures_fournisseur, purchase_orders'}. Un paiement exécuté sans montant exécuté est marqué partiel, jamais complet.</p>
    </Panneau>
  );
};

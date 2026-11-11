import { Printer, X } from 'lucide-react';
import { montant } from './facturation';

// Facture ou avoir imprimable (D-029) : identite de la societe, client,
// lignes, totaux, bloc de signature du Directeur General. Tant que le
// document n'est pas emis, il porte la mention « non valable ».

export interface DonneesFacture {
  numero: string | null;
  type: 'facture' | 'avoir';
  statut: string;
  objet: string;
  devise: string;
  taux_taxe_pct: number;
  montant_ht: number;
  montant_taxe: number;
  montant_ttc: number;
  date_emission: string | null;
  date_echeance: string | null;
  signee_le: string | null;
  client: string;
  contrat: string;
  origine: string | null;
  lignes: { id: string; libelle: string; quantite: number; unite: string; prix_unitaire: number; montant: number }[];
}

export interface Societe {
  raison_sociale: string; rccm: string | null; nif: string | null; adresse: string | null; ville: string | null; pays: string | null;
  telephone: string | null; email: string | null; signataire_nom: string | null; signataire_fonction: string | null;
}

const jour = (iso: string | null) => (iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('fr-FR') : '—');

export const FactureImprimable = ({ facture, societe, onFermer }: { facture: DonneesFacture; societe: Societe | null; onFermer: () => void }) => {
  const emise = facture.statut === 'emise';
  return (
    <div className="fixed inset-0 z-[950] overflow-y-auto bg-stone-200/90 p-6">
      <div className="pas-imprime mx-auto mb-4 flex max-w-[210mm] justify-end gap-2">
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white"><Printer className="h-4 w-4" /> Imprimer</button>
        <button onClick={onFermer} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-stone-700" aria-label="Fermer l'aperçu"><X className="h-4 w-4" /> Fermer</button>
      </div>
      <div className="zone-impression">
        <article className="relative mx-auto max-w-[210mm] bg-white p-10 text-black shadow" aria-label={`Document ${facture.numero ?? 'brouillon'}`}>
          {!emise && (
            <p className="pointer-events-none absolute inset-x-0 top-1/3 rotate-[-20deg] text-center text-5xl font-black text-red-200">NON VALABLE · {facture.statut.toUpperCase()}</p>
          )}
          <header className="flex justify-between border-b-2 border-black pb-3">
            <div className="text-xs">
              <p className="text-lg font-black">{societe?.raison_sociale ?? ''}</p>
              {[societe?.adresse, [societe?.ville, societe?.pays].filter(Boolean).join(', '), societe?.telephone, societe?.email].filter(Boolean).map((l) => <p key={l as string}>{l}</p>)}
              <p>{[societe?.rccm && `RCCM ${societe.rccm}`, societe?.nif && `NIF ${societe.nif}`].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black">{facture.type === 'avoir' ? 'AVOIR' : 'FACTURE'}</p>
              <p className="font-mono text-lg font-bold">N° {facture.numero ?? 'en attente d\'émission'}</p>
              <p className="text-xs">Date d'émission : {jour(facture.date_emission)}</p>
              <p className="text-xs">Échéance : {jour(facture.date_echeance)}</p>
            </div>
          </header>
          <section className="my-6 grid grid-cols-2 gap-6 text-sm">
            <div><p className="text-xs font-bold uppercase">Client</p><p className="font-semibold">{facture.client}</p><p className="text-xs">Contrat {facture.contrat}</p></div>
            <div><p className="text-xs font-bold uppercase">Objet</p><p>{facture.objet}</p>{facture.origine && <p className="text-xs">Facture d'origine : {facture.origine}</p>}</div>
          </section>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-y-2 border-black text-left">
              <th className="py-2">Désignation</th><th className="py-2 text-right">Quantité</th><th className="py-2 text-right">Prix unitaire</th><th className="py-2 text-right">Montant</th>
            </tr></thead>
            <tbody>{facture.lignes.map((l) => (
              <tr key={l.id} className="border-b border-stone-300">
                <td className="py-2">{l.libelle}</td>
                <td className="py-2 text-right">{Number(l.quantite).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} {l.unite}</td>
                <td className="py-2 text-right">{montant(l.prix_unitaire, facture.devise)}</td>
                <td className="py-2 text-right">{montant(l.montant, facture.devise)}</td>
              </tr>
            ))}</tbody>
          </table>
          <dl className="ml-auto mt-4 w-72 text-sm">
            <div className="flex justify-between py-1"><dt>Total hors taxes</dt><dd>{montant(facture.montant_ht, facture.devise)}</dd></div>
            <div className="flex justify-between py-1"><dt>Taxe ({Number(facture.taux_taxe_pct).toLocaleString('fr-FR')} %)</dt><dd>{montant(facture.montant_taxe, facture.devise)}</dd></div>
            <div className="flex justify-between border-t-2 border-black py-1 font-black"><dt>Total TTC</dt><dd>{montant(facture.montant_ttc, facture.devise)}</dd></div>
          </dl>
          <footer className="mt-12 flex justify-end">
            <div className="w-72 border border-black p-3 text-sm">
              <p className="font-bold">{societe?.signataire_fonction ?? 'Le Directeur Général'}</p>
              <p>{societe?.signataire_nom ?? ''}</p>
              <p className="text-xs">{facture.signee_le ? `Validée dans SIGTB le ${jour(facture.signee_le)}` : 'Signature requise'}</p>
              <div className="h-16" />
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
};

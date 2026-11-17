import { useEffect, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { FilAriane } from '../ui/PageDetail';
import { arianeModule } from '../ui/pages';
import { lire, trouver } from '../ui/lecture';
import { routeDetail } from '../ui/routeur';
import { VUE_FACTURES, libelleFacture, montant, type Facture } from './facturation';

// Facture ou avoir imprimable (D-029) : identite de la societe, client,
// lignes, totaux, bloc de signature du Directeur General. Tant que le
// document n'est pas emis, il porte la mention « non valable ». Apercu en
// pleine page (D-090, #/invoices/<id>/apercu), plus en superposition.

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

/** Document imprimable seul (sans barre d'outils). */
export const DocumentFacture = ({ facture, societe }: { facture: DonneesFacture; societe: Societe | null }) => {
  const emise = facture.statut === 'emise';
  return (
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
  );
};

/** Page d'apercu : lit la facture, ses lignes, le contrat et la societe. */
export const ApercuFacture = ({ id }: { id: string }) => {
  const [donnees, setDonnees] = useState<DonneesFacture | null>(null);
  const [societe, setSociete] = useState<Societe | null>(null);
  const [erreur, setErreur] = useState('');
  const [reference, setReference] = useState('Facture');

  useEffect(() => {
    (async () => {
      const r = await lire<Facture>(supabase.from('factures').select('*').eq('id', id), 'facture');
      const f = trouver(r.lignes, id);
      if (!f) { setErreur(r.erreur || 'Facture introuvable ou non visible avec vos droits.'); return; }
      setReference(libelleFacture(f));
      const [l, c, s, o] = await Promise.all([
        supabase.from('facture_lignes').select('*').eq('facture_id', id).order('ordre'),
        supabase.from('contrats').select('id, reference, contrepartie').eq('id', f.contrat_id),
        supabase.from('societe').select('*').eq('id', 1).maybeSingle(),
        f.facture_origine_id ? supabase.from('factures').select('id, numero').eq('id', f.facture_origine_id) : Promise.resolve({ data: [], error: null }),
      ]);
      if (l.error) { setErreur(`Lecture impossible (lignes de la facture) : ${l.error.message}`); return; }
      const contrat = ((c.data ?? []) as { id: string; reference: string; contrepartie: string }[]).find((x) => x.id === f.contrat_id);
      const origine = ((o.data ?? []) as { id: string; numero: string | null }[]).find((x) => x.id === f.facture_origine_id);
      setSociete(s.data as Societe | null);
      setDonnees({
        ...f, client: contrat?.contrepartie ?? '', contrat: contrat?.reference ?? '', origine: origine?.numero ?? null,
        lignes: ((l.data ?? []) as (DonneesFacture['lignes'][number] & { facture_id: string })[]).filter((x) => x.facture_id === id),
      });
    })();
  }, [id]);

  return (
    <div className="space-y-4">
      <div className="pas-imprime space-y-3">
        <FilAriane elements={arianeModule(VUE_FACTURES, 'Facturation', { libelle: reference, vers: routeDetail(VUE_FACTURES, id) }, { libelle: 'Aperçu' })} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a href={routeDetail(VUE_FACTURES, id)} className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"><ArrowLeft className="h-4 w-4" /> Retour à la fiche</a>
          <button type="button" onClick={() => window.print()} disabled={!donnees} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Printer className="h-4 w-4" /> Imprimer</button>
        </div>
      </div>
      {erreur ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
        : !donnees ? <p role="status" className="py-8 text-center text-sm text-stone-500">Chargement…</p>
          : <div className="rounded-2xl bg-stone-200/70 p-4 sm:p-6"><DocumentFacture facture={donnees} societe={societe} /></div>}
    </div>
  );
};

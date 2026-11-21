import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panneau, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';

// Dossier financier (D-125) : chaine contrat -> version applicable ->
// decompte -> lignes et regles -> pieces -> facture -> avoirs -> encaissements
// -> relances. Lecture seule servie par dossier_financier ; aucune conversion
// de devise, un avoir deduit la creance sans ecraser la facture.

interface LigneFacture {
  id: string; ordre: number; libelle: string; quantite: number; unite: string;
  prix_unitaire: number; montant: number; clause: { type_clause: string; libelle: string; article: string | null } | null;
}
interface Dossier {
  lisible: boolean;
  facture: { numero: string; devise: string | null; montant_ttc: number | null; statut: string; date_emission: string | null; date_echeance: string | null };
  contrat: { reference: string; intitule: string; contrepartie: string; version_applicable: { numero: string; date_effet: string; resume: string | null } | null } | null;
  decompte: { periode_debut: string; periode_fin: string; base_tonnage: string | null; tonnage_facturable: number | null; voyages_facturables: number | null; statut: string } | null;
  lignes: LigneFacture[];
  regles_calculees: { id: string; libelle: string; type_clause: string; montant_calcule_ht: number | null; montant_propose_ht: number | null; raison: string | null }[];
  pieces: { id: string; nom: string; statut: string; depose_le: string }[];
  encaissements: { id: string; date_encaissement: string; montant: number; mode: string | null; reference: string | null }[];
  avoirs: { id: string; numero: string; montant_ttc: number; statut: string; date_emission: string | null }[];
  relances: { id: string; niveau: number; date_relance: string; canal: string | null }[];
  solde: { montant_ttc: number | null; encaisse: number; avoirs: number; solde: number | null; devise: string | null; regle: string; source: string };
}

const date = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('fr-FR') : '—');
const montant = (v: number | null, devise: string | null) => (v === null || v === undefined ? 'Sans données' : `${formatNombre(Number(v))} ${devise ?? ''}`.trim());

export const DossierFinancier = ({ factureId }: { factureId: string }) => {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    supabase.rpc('dossier_financier', { p_facture: factureId }).then(({ data, error }) => {
      setErreur(error ? error.message : '');
      setDossier(error ? null : ((data ?? null) as Dossier | null));
    });
  }, [factureId]);

  if (erreur) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>;
  if (!dossier) return <p role="status" className="text-sm text-stone-500">Chargement du dossier financier…</p>;
  if (!dossier.lisible) return <SansDonnees message="Dossier non lisible" detail="Vos droits ne permettent pas de lire cette facture." />;

  const s = dossier.solde;
  return (
    <div className="space-y-4">
      <Panneau titre="Solde">
        <p className="text-2xl font-black text-stone-900">{montant(s.solde, s.devise)}</p>
        <p className="text-sm text-stone-600">TTC {montant(s.montant_ttc, s.devise)} · encaissé {montant(s.encaisse, s.devise)} · avoirs {montant(s.avoirs, s.devise)}</p>
        <p className="mt-1 text-xs text-stone-500">{s.regle}. Source : {s.source}.</p>
      </Panneau>

      <Panneau titre="Contrat et version applicable">
        {dossier.contrat ? (
          <div className="text-sm">
            <p className="font-semibold">{dossier.contrat.reference} · {dossier.contrat.intitule}</p>
            <p className="text-stone-600">Contrepartie : {dossier.contrat.contrepartie}</p>
            {dossier.contrat.version_applicable ? (
              <p className="text-stone-600">Version {dossier.contrat.version_applicable.numero} en vigueur au {date(dossier.contrat.version_applicable.date_effet)}
                {dossier.contrat.version_applicable.resume ? ` · ${dossier.contrat.version_applicable.resume}` : ''}</p>
            ) : <p className="text-orange-800">Aucune version contractuelle applicable à la date d’émission.</p>}
          </div>
        ) : <SansDonnees message="Aucun contrat rattaché" />}
      </Panneau>

      <Panneau titre="Décompte">
        {dossier.decompte ? (
          <p className="text-sm">
            Du {date(dossier.decompte.periode_debut)} au {date(dossier.decompte.periode_fin)} · tonnage facturable {montant(dossier.decompte.tonnage_facturable, 't')} ·
            {' '}{dossier.decompte.voyages_facturables ?? 0} voyage(s) · {dossier.decompte.statut}
          </p>
        ) : <SansDonnees message="Aucun décompte rattaché" />}
      </Panneau>

      <Panneau titre="Lignes et règles contractuelles">
        {dossier.lignes.length === 0 ? <SansDonnees message="Aucune ligne" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Lignes de la facture">
              <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2">Désignation</th><th>Quantité</th><th>Prix unitaire</th><th>Montant</th><th>Règle</th>
              </tr></thead>
              <tbody>{dossier.lignes.map((l) => (
                <tr key={l.id} className="border-b border-stone-100">
                  <td className="py-1.5">{l.libelle}</td>
                  <td>{formatNombre(Number(l.quantite))} {l.unite}</td>
                  <td>{montant(l.prix_unitaire, s.devise)}</td>
                  <td>{montant(l.montant, s.devise)}</td>
                  <td className="text-xs">{l.clause ? `${l.clause.libelle}${l.clause.article ? ` (art. ${l.clause.article})` : ''}` : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {dossier.regles_calculees.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {dossier.regles_calculees.map((r) => (
              <li key={r.id} className="rounded-lg border border-stone-200 p-2">
                <b>{r.libelle}</b> · {r.type_clause} · calculé {montant(r.montant_calcule_ht, s.devise)} · proposé {montant(r.montant_propose_ht, s.devise)}
                {r.raison ? ` · ${r.raison}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panneau titre="Encaissements">
          {dossier.encaissements.length === 0 ? <SansDonnees message="Aucun encaissement" /> : (
            <ul className="space-y-1 text-sm">{dossier.encaissements.map((e) => (
              <li key={e.id}>{date(e.date_encaissement)} · {montant(e.montant, s.devise)}{e.reference ? ` · ${e.reference}` : ''}</li>
            ))}</ul>
          )}
        </Panneau>
        <Panneau titre="Avoirs">
          {dossier.avoirs.length === 0 ? <SansDonnees message="Aucun avoir" /> : (
            <ul className="space-y-1 text-sm">{dossier.avoirs.map((a) => (
              <li key={a.id}>{a.numero} · {montant(a.montant_ttc, s.devise)} · {a.statut}</li>
            ))}</ul>
          )}
        </Panneau>
        <Panneau titre="Relances">
          {dossier.relances.length === 0 ? <SansDonnees message="Aucune relance" /> : (
            <ul className="space-y-1 text-sm">{dossier.relances.map((r) => (
              <li key={r.id}>{date(r.date_relance)} · niveau {r.niveau}{r.canal ? ` · ${r.canal}` : ''}</li>
            ))}</ul>
          )}
        </Panneau>
        <Panneau titre="Pièces justificatives">
          {dossier.pieces.length === 0 ? <SansDonnees message="Aucune pièce" /> : (
            <ul className="space-y-1 text-sm">{dossier.pieces.map((p) => (
              <li key={p.id}>{p.nom} · {p.statut} · {date(p.depose_le)}</li>
            ))}</ul>
          )}
        </Panneau>
      </div>
    </div>
  );
};

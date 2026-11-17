import { Puce } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { INDICATEURS, PERIODICITES } from './types';
import { jourRapport, type ContratRapport, type LigneEngagement, type RapportPerformance } from './rapportsPerformance';

// Tableau des engagements et document imprimable du rapport de performance
// (D-031), partages par la liste, la fiche et l'apercu (D-090).

export const Conformite = ({ c }: { c: boolean | null }) =>
  c === null ? <Puce teinte="gris">Non mesurable</Puce> : c ? <Puce teinte="vert">Tenu</Puce> : <Puce teinte="rouge">Non tenu</Puce>;

export const TableEngagements = ({ lignes }: { lignes: LigneEngagement[] }) => (
  <table className="w-full text-sm">
    <thead><tr className="border-b border-stone-300 text-left text-stone-500">
      <th className="py-2 pr-3 font-medium">Engagement</th><th className="py-2 pr-3 text-right font-medium">Seuil</th>
      <th className="py-2 pr-3 text-right font-medium">Réalisé</th><th className="py-2 pr-3 text-right font-medium">Échantillon</th><th className="py-2 font-medium">Statut</th>
    </tr></thead>
    <tbody>{lignes.map((l) => (
      <tr key={l.engagement_id} className="border-b border-stone-100 align-top last:border-0">
        <td className="py-2 pr-3"><p className="font-semibold">{l.libelle}</p><p className="text-xs text-stone-500">{INDICATEURS[l.indicateur] ?? l.indicateur} · {PERIODICITES[l.periodicite] ?? l.periodicite}{l.consequence ? ` · ${l.consequence}` : ''}</p></td>
        <td className="py-2 pr-3 text-right">{l.sens === 'minimum' ? '≥' : '≤'} {formatNombre(Number(l.seuil), 2)} {l.unite}</td>
        <td className="py-2 pr-3 text-right font-semibold">{l.realise === null ? '—' : `${formatNombre(Number(l.realise), 2)} ${l.unite}`}</td>
        <td className="py-2 pr-3 text-right text-stone-500">{l.echantillon ?? '—'}</td>
        <td className="py-2"><Conformite c={l.conforme} /></td>
      </tr>
    ))}</tbody>
  </table>
);

export const DocumentRapport = ({ rapport, contrat, societe }: { rapport: RapportPerformance; contrat: ContratRapport | null; societe: string | null }) => (
  <div className="zone-impression">
    <article className="mx-auto max-w-[210mm] bg-white p-10 text-black shadow" aria-label="Rapport de performance">
      <header className="border-b-2 border-black pb-3">
        <p className="text-sm font-black">{societe ?? ''}</p>
        <p className="text-2xl font-black">RAPPORT DE PERFORMANCE MENSUEL</p>
        <p className="text-sm">Contrat {contrat?.reference} · {contrat?.contrepartie} · {contrat?.intitule}</p>
        <p className="text-sm">Période du {jourRapport(rapport.periode_debut)} au {jourRapport(rapport.periode_fin)} · figé le {new Date(rapport.genere_le).toLocaleDateString('fr-FR')}
          {rapport.statut === 'remis' ? ` · remis le ${jourRapport(rapport.remis_le)} à ${rapport.remis_a ?? ''}` : ' · BROUILLON'}</p>
      </header>
      <h3 className="mt-6 font-bold">1. Engagements de l'avenant</h3>
      <TableEngagements lignes={rapport.contenu?.engagements ?? []} />
      <h3 className="mt-6 font-bold">2. Tonnages réconciliés</h3>
      {(rapport.contenu?.reconciliations ?? []).length === 0 ? <p className="text-sm">Aucune réconciliation sur la période.</p> : (
        <ul className="text-sm">{rapport.contenu.reconciliations.map((x) => <li key={x.debut}>Du {jourRapport(x.debut)} au {jourRapport(x.fin)} ({x.statut}) : {x.tonnage_facturable === null ? 'non clôturée' : `${formatNombre(Number(x.tonnage_facturable), 2)} t sur ${x.voyages_facturables} voyages`}</li>)}</ul>
      )}
      <h3 className="mt-6 font-bold">3. Facturation</h3>
      {(rapport.contenu?.factures ?? []).length === 0 ? <p className="text-sm">Aucune facture sur la période.</p> : (
        <ul className="text-sm">{rapport.contenu.factures.map((x, i) => <li key={i}>{x.type === 'avoir' ? 'Avoir' : 'Facture'} {x.numero ?? '(non émise)'} · {x.statut} · {formatNombre(Number(x.montant_ttc), 2)} {x.devise}</li>)}</ul>
      )}
      <p className="mt-8 text-xs">Mesures issues des relevés de terrain enregistrés dans SIGTB ; « — » = non mesurable sur la période.</p>
    </article>
  </div>
);

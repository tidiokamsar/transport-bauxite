import { useEffect, useState } from 'react';
import { ArrowLeft, Printer, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Historique } from '../ui/Historique';
import { FilAriane, Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Panneau } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { arianeModule } from '../ui/pages';
import { routeAction, routeDetail } from '../ui/routeur';
import { DocumentRapport, TableEngagements } from './DocumentRapport';
import {
  MODULE_ENGAGEMENTS, VUE_ENGAGEMENTS, jourRapport, libelleRapport, remiseInterdite, routeListeEngagements, type ContratRapport, type RapportPerformance,
} from './rapportsPerformance';

// Fiche d'un rapport de performance (D-031, D-090) : contenu fige
// (engagements, tonnages reconcilies, factures), contrat lie, historique
// lu dans les horodatages du rapport (generation, remise), apercu
// imprimable en pleine page (remplace la superposition).

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });

const useRapport = (id: string) => {
  const [rapport, setRapport] = useState<Lecture<RapportPerformance>>(attente);
  const [contrat, setContrat] = useState<ContratRapport | null>(null);
  const [societe, setSociete] = useState<string | null>(null);
  useEffect(() => {
    lire<RapportPerformance>(supabase.from('rapports_performance').select('*').eq('id', id), 'rapport de performance').then(async (r) => {
      setRapport(r);
      const x = trouver(r.lignes, id);
      if (!x) return;
      const [c, s] = await Promise.all([
        supabase.from('contrats').select('id, reference, contrepartie, intitule, nature, statut').eq('id', x.contrat_id),
        supabase.from('societe').select('raison_sociale').eq('id', 1).maybeSingle(),
      ]);
      setContrat(((c.data ?? []) as ContratRapport[]).find((k) => k.id === x.contrat_id) ?? null);
      setSociete((s.data as { raison_sociale: string } | null)?.raison_sociale ?? null);
    });
  }, [id]);
  return { rapport, r: trouver(rapport.lignes, id), contrat, societe };
};

export const DetailRapportPerformance = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const { rapport, r, contrat } = useRapport(id);

  const historique: EvenementHistorique[] | null = r ? fusionnerHistoriques([
    { id: 'genere', le: r.genere_le, libelle: 'Rapport figé (brouillon)', auteur: r.genere_par ?? null, source: 'rapports_performance.genere_le' },
    ...(r.remis_le ? [{ id: 'remis', le: `${r.remis_le}T00:00:00`, libelle: 'Rapport remis', detail: `Remis à ${r.remis_a ?? 'destinataire non renseigné'} (date de remise saisie, sans heure)`, auteur: r.remis_par ?? null, source: 'rapports_performance.remis_le' }] : []),
  ]) : null;
  const engagements = r?.contenu?.engagements ?? [];

  return (
    <PageDetail
      vue={VUE_ENGAGEMENTS}
      module={MODULE_ENGAGEMENTS}
      reference={libelleRapport(r, contrat)}
      statut={r ? (r.statut === 'remis' ? { libelle: 'Remis', teinte: 'vert' } : { libelle: 'Brouillon', teinte: 'orange' }) : null}
      resume={r && <>Du {jourRapport(r.periode_debut)} au {jourRapport(r.periode_fin)} · figé le {new Date(r.genere_le).toLocaleDateString('fr-FR')}{r.statut === 'remis' ? ` · remis le ${jourRapport(r.remis_le)} à ${r.remis_a ?? ''}` : ''}</>}
      chargement={rapport.lignes === null && !rapport.erreur}
      erreur={rapport.erreur}
      introuvable={rapport.lignes !== null && !r}
      actions={[
        { id: 'apercu', libelle: 'Aperçu imprimable', icone: <Printer className="h-4 w-4" />, visible: Boolean(r), vers: routeAction(VUE_ENGAGEMENTS, id, 'apercu') },
        { id: 'remettre', libelle: 'Marquer remis', icone: <Send className="h-4 w-4" />, ton: 'principal', visible: Boolean(r) && remiseInterdite(r as RapportPerformance, peutEcrire) === null,
          vers: routeAction(VUE_ENGAGEMENTS, id, 'remettre') },
      ]}
      onglets={!r ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-4">
            <Informations groupes={[
              { titre: 'Rapport', champs: [['Période', `${jourRapport(r.periode_debut)} – ${jourRapport(r.periode_fin)}`], ['Statut', r.statut === 'remis' ? 'Remis' : 'Brouillon'],
                ['Figé le', new Date(r.genere_le).toLocaleString('fr-FR')], ['Remis le', r.remis_le ? jourRapport(r.remis_le) : null], ['Remis à', r.remis_a]] },
              { titre: 'Contrat', champs: [['Référence', contrat && <a href={routeDetail('contrats', contrat.id)} className="text-orange-800 hover:underline">{contrat.reference}</a>],
                ['Contrepartie', contrat?.contrepartie ?? null], ['Intitulé', contrat?.intitule ?? null]] },
            ]} />
            <Panneau titre={`Engagements figés · ${engagements.filter((l) => l.conforme === true).length} tenu(s), ${engagements.filter((l) => l.conforme === false).length} non tenu(s)`}>
              {engagements.length === 0 ? <p className="text-sm text-stone-500">Aucun engagement dans le rapport.</p> : <TableEngagements lignes={engagements} />}
            </Panneau>
          </div>
        ) },
        { id: 'relations', libelle: 'Réconciliations et factures', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Réconciliations figées" lignes={r.contenu?.reconciliations ?? []} cle={(x) => `${x.debut}-${x.fin}`} vide="Aucune réconciliation sur la période"
              colonnes={[
                { libelle: 'Période', valeur: (x) => `${jourRapport(x.debut)} – ${jourRapport(x.fin)}` },
                { libelle: 'Statut', valeur: (x) => x.statut },
                { libelle: 'Tonnage facturable', valeur: (x) => (x.tonnage_facturable === null ? 'non clôturée' : `${formatNombre(Number(x.tonnage_facturable), 2)} t sur ${x.voyages_facturables} voyages`) },
              ]} />
            <Relation titre="Factures figées" lignes={r.contenu?.factures ?? []} cle={(x) => `${x.numero ?? ''}-${x.type}-${x.montant_ttc}`} vide="Aucune facture sur la période"
              colonnes={[
                { libelle: 'Pièce', valeur: (x) => `${x.type === 'avoir' ? 'Avoir' : 'Facture'} ${x.numero ?? '(non émise)'}` },
                { libelle: 'Statut', valeur: (x) => x.statut },
                { libelle: 'Montant TTC', valeur: (x) => `${formatNombre(Number(x.montant_ttc), 2)} ${x.devise}` },
              ]}
              note="Contenu figé à la génération du rapport ; les pièces vivantes sont dans Réconciliation et Facturation." />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} source="rapports_performance (genere_le, remis_le)"
            absent="Aucune table de journal pour les rapports de performance : l'historique est lu dans les horodatages du rapport." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un rapport de performance" /> },
      ]}
    />
  );
};

/** Apercu imprimable en pleine page (#/engagements/<id>/apercu). */
export const ApercuRapportPerformance = ({ id }: { id: string }) => {
  const { rapport, r, contrat, societe } = useRapport(id);
  const reference = libelleRapport(r, contrat);
  return (
    <div className="space-y-4">
      <div className="pas-imprime space-y-3">
        <FilAriane elements={arianeModule(VUE_ENGAGEMENTS, MODULE_ENGAGEMENTS, { libelle: reference, vers: routeDetail(VUE_ENGAGEMENTS, id) }, { libelle: 'Aperçu' })} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a href={routeDetail(VUE_ENGAGEMENTS, id)} className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900"><ArrowLeft className="h-4 w-4" /> Retour à la fiche</a>
          {r && <a href={routeListeEngagements(r.contrat_id, r.periode_debut.slice(0, 7))} className="text-sm text-stone-600 hover:underline">Engagements du mois</a>}
          <button type="button" onClick={() => window.print()} disabled={!r} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Printer className="h-4 w-4" /> Imprimer</button>
        </div>
      </div>
      {rapport.erreur ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{rapport.erreur}</p>
        : rapport.lignes === null ? <p role="status" className="py-8 text-center text-sm text-stone-500">Chargement…</p>
          : !r ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Rapport introuvable ou non visible avec vos droits.</p>
            : <div className="rounded-2xl bg-stone-200/70 p-4 sm:p-6"><DocumentRapport rapport={r} contrat={contrat} societe={societe} /></div>}
    </div>
  );
};

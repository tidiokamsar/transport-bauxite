import { useEffect, useMemo, useState } from 'react';
import { Download, FileCheck2, Lock, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { buildCSV } from '../../lib/exports';
import { formatNombre } from '../Dashboard/indicateurs';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Panneau, Puce, SansDonnees } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { ecrireRoute, naviguer, routeAction, routeDetail, useRoute } from '../ui/routeur';
import {
  ANOMALIES, BASES, STATUTS_FACTURE, STATUTS_LIGNE, VUE_FACTURES, VUE_RECONCILIATION, libelleFacture, montant, statutLigne,
  type Facture, type StatutLigne,
} from './facturation';
import {
  FILTRES_LIGNES, clotureInterdite, comptesLignes, decisionInterdite, type DecisionLigne, type LigneReconciliation, type Reconciliation,
} from './reconciliation';

// Fiche d'une reconciliation (D-029, D-090) : parametres et comptes,
// lignes (voyages, pesees, tickets, fiches, anomalies, decisions motivees),
// relations (contrat, factures generees), historique (horodatages de la
// reconciliation, decisions des lignes, rectifications de tickets CBG).

interface Contrat { id: string; reference: string; contrepartie: string; devise: string }
interface Rectification { id: string; ticket_id: string; ancien_ticket: string; nouveau_ticket: string; ancien_net: number; nouveau_net: number; motif: string; corrige_par: string | null; corrige_le: string }

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const t = (v: number | null) => (v === null ? '—' : formatNombre(Number(v), 2));
const jour = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR');

export const DetailReconciliation = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const route = useRoute();
  const droits = { ecrire: hasPermission('invoices', 'create') || hasPermission('invoices', 'edit'), approuver: hasPermission('invoices', 'approve') };
  const [rec, setRec] = useState<Lecture<Reconciliation>>(attente);
  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [sites, setSites] = useState<Map<string, string>>(new Map());
  const [lignes, setLignes] = useState<Lecture<LigneReconciliation>>(attente);
  const [factures, setFactures] = useState<Lecture<Facture>>(attente);
  const [rectifications, setRectifications] = useState<Lecture<Rectification>>(attente);

  useEffect(() => {
    lire<Reconciliation>(supabase.from('reconciliations').select('*').eq('id', id), 'réconciliation').then(async (r) => {
      setRec(r);
      const x = trouver(r.lignes, id);
      if (!x) return;
      const c = await supabase.from('contrats').select('id, reference, contrepartie, devise').eq('id', x.contrat_id);
      setContrat(((c.data ?? []) as Contrat[]).find((k) => k.id === x.contrat_id) ?? null);
    });
    supabase.from('sites').select('id, name').then(({ data }) => setSites(new Map(((data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]))));
    lire<LigneReconciliation>(supabase.from('reconciliation_lignes').select('*').eq('reconciliation_id', id).order('date_voyage').order('reference'), 'lignes de la réconciliation')
      .then(async (r) => {
        const propres = r.lignes && r.lignes.filter((l) => l.reconciliation_id === id);
        setLignes({ ...r, lignes: propres });
        const trajets = (propres ?? []).filter((l) => l.ticket_rectifie).map((l) => l.trip_id);
        if (trajets.length === 0) { setRectifications({ lignes: [], erreur: '' }); return; }
        const k = await supabase.from('tickets_pesee_cbg').select('id, trip_id').in('trip_id', trajets);
        const tickets = ((k.data ?? []) as { id: string; trip_id: string }[]).filter((x) => trajets.includes(x.trip_id)).map((x) => x.id);
        if (tickets.length === 0) { setRectifications({ lignes: [], erreur: k.error ? `Lecture impossible (tickets CBG) : ${k.error.message}` : '' }); return; }
        lire<Rectification>(supabase.from('rectifications_tickets_pesee_cbg')
          .select('id, ticket_id, ancien_ticket, nouveau_ticket, ancien_net, nouveau_net, motif, corrige_par, corrige_le').in('ticket_id', tickets), 'rectifications de tickets CBG')
          .then((x) => setRectifications({ ...x, lignes: x.lignes && x.lignes.filter((y) => tickets.includes(y.ticket_id)) }));
      });
    lire<Facture>(supabase.from('factures').select('*').eq('reconciliation_id', id).order('prepare_le'), 'factures générées')
      .then((r) => setFactures({ ...r, lignes: r.lignes && r.lignes.filter((f) => f.reconciliation_id === id) }));
  }, [id]);

  const r = trouver(rec.lignes, id);
  const comptes = useMemo(() => comptesLignes(lignes.lignes ?? []), [lignes.lignes]);
  const filtre = (FILTRES_LIGNES as string[]).includes(route.requete.statut ?? '') ? route.requete.statut as StatutLigne | 'toutes' : 'a_examiner';
  const visibles = (lignes.lignes ?? []).filter((l) => filtre === 'toutes' || statutLigne(l.decision, l.anomalies) === filtre);
  const ouverte = r?.statut === 'ouverte';
  const reference = r ? `${contrat?.reference ?? 'Contrat'} · ${new Date(`${r.periode_debut}T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` : 'Réconciliation';
  const decider = (l: LigneReconciliation, decision: DecisionLigne) =>
    ecrireRoute({ vue: VUE_RECONCILIATION, mode: 'action', id, action: 'decider', requete: { ligne: l.id, decision } });
  const possible = (l: LigneReconciliation, d: DecisionLigne) => Boolean(r) && decisionInterdite(d, r as Reconciliation, l, droits) === null;

  const exporter = () => {
    const csv = buildCSV((lignes.lignes ?? []).map((l) => ({
      Voyage: l.reference, Date: l.date_voyage, Etat: l.etat ?? '', Charge_t: l.tonnage_charge ?? '', Recu_t: l.tonnage_recu ?? '',
      Accepte_t: l.tonnage_accepte ?? '', Kogon_t: l.tonnage_kogon ?? '', CBG_t: l.tonnage_cbg ?? '', Base_t: l.tonnage_base ?? '', Ticket: l.ticket ?? '', Fiche: l.fiche ?? '',
      Anomalies: l.anomalies.map((a) => ANOMALIES[a]?.libelle ?? a).join(' ; '), Statut: STATUTS_LIGNE[statutLigne(l.decision, l.anomalies)].libelle,
      Motif: l.motif_decision ?? '',
    })));
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    lien.download = `reconciliation-${contrat?.reference ?? ''}-${r?.periode_debut.slice(0, 7) ?? ''}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  // Aucun journal propre : horodatages enregistres de la reconciliation,
  // decisions horodatees des lignes et rectifications de tickets (ecart D-090).
  const historique: EvenementHistorique[] | null = r && lignes.lignes && rectifications.lignes ? fusionnerHistoriques(
    [
      ...(r.ouverte_le ? [{ id: 'rec-ouverte', le: r.ouverte_le, libelle: 'Réconciliation ouverte (voyages rapprochés)', auteur: r.ouverte_par ?? null, source: 'reconciliations.ouverte_le' }] : []),
      ...(r.actualisee_le ? [{ id: 'rec-actualisee', le: r.actualisee_le, libelle: 'Dernière actualisation du rapprochement', source: 'reconciliations.actualisee_le' }] : []),
      ...(r.cloturee_le ? [{ id: 'rec-cloturee', le: r.cloturee_le, libelle: `Clôturée : ${t(r.tonnage_facturable)} t facturables`, auteur: r.cloturee_par ?? null, source: 'reconciliations.cloturee_le' }] : []),
    ],
    lignes.lignes.filter((l) => l.decision && l.decide_le).map((l) => ({
      id: `ligne-${l.id}`, le: l.decide_le as string, libelle: `${l.reference} : ${l.decision === 'exclue' ? 'exclue' : 'déclarée facturable'}`, motif: l.motif_decision, auteur: l.decide_par ?? null, source: 'reconciliation_lignes',
    })),
    rectifications.lignes.map((k) => ({
      id: `rectif-${k.id}`, le: k.corrige_le, libelle: `Ticket CBG rectifié : ${k.ancien_ticket} → ${k.nouveau_ticket}`, detail: `Net ${t(k.ancien_net)} t → ${t(k.nouveau_net)} t`, motif: k.motif, auteur: k.corrige_par, source: 'rectifications_tickets_pesee_cbg',
    })),
  ) : null;

  return (
    <PageDetail
      vue={VUE_RECONCILIATION}
      module="Réconciliation mensuelle"
      reference={reference}
      statut={r ? (ouverte ? { libelle: 'Ouverte', teinte: 'orange' } : { libelle: 'Clôturée', teinte: 'vert' }) : null}
      resume={r && <>{contrat?.contrepartie ?? ''} · du {jour(r.periode_debut)} au {jour(r.periode_fin)}</>}
      chargement={rec.lignes === null && !rec.erreur}
      erreur={rec.erreur}
      introuvable={rec.lignes !== null && !r}
      actions={[
        { id: 'actualiser', libelle: 'Actualiser', icone: <RefreshCw className="h-4 w-4" />, visible: droits.ecrire && ouverte, vers: routeAction(VUE_RECONCILIATION, id, 'actualiser') },
        { id: 'cloturer', libelle: 'Clôturer', icone: <Lock className="h-4 w-4" />, visible: Boolean(r) && lignes.lignes !== null && clotureInterdite(r as Reconciliation, comptes.a_examiner, droits.ecrire) === null, ton: 'principal', vers: routeAction(VUE_RECONCILIATION, id, 'cloturer') },
        { id: 'generer', libelle: 'Générer la facture', icone: <FileCheck2 className="h-4 w-4" />, visible: droits.ecrire && r?.statut === 'cloturee', ton: 'principal', vers: routeAction(VUE_RECONCILIATION, id, 'generer-facture') },
      ]}
      onglets={!r ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <div className="space-y-4">
            <section aria-label="Synthèse des lignes" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {([
                ['Facturable', `${t(comptes.tonnes)} t`, `${comptes.facturable} voyage(s)`],
                ['À examiner', String(comptes.a_examiner), comptes.a_examiner > 0 ? 'décision motivée attendue avant la clôture' : 'aucune ligne en attente'],
                ['Exclues', String(comptes.exclue), 'décisions motivées'],
                ['Figé à la clôture', r.tonnage_facturable === null ? '—' : `${t(r.tonnage_facturable)} t`, r.voyages_facturables === null ? 'non clôturée' : `${r.voyages_facturables} voyage(s)`],
              ] as [string, string, string][]).map(([l, v, d]) => (
                <div key={l} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-carte">
                  <p className="text-sm text-stone-500">{l}</p><p className="text-2xl font-black text-stone-900">{lignes.lignes ? v : '—'}</p><p className="text-xs text-stone-500">{d}</p>
                </div>
              ))}
            </section>
            {comptes.a_examiner > 0 && ouverte && <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">Clôture impossible : {comptes.a_examiner} ligne(s) à examiner (onglet Lignes).</p>}
            <Informations groupes={[
              { titre: 'Paramètres', champs: [['Contrat', contrat ? `${contrat.reference} · ${contrat.contrepartie}` : null], ['Base de tonnage', BASES[r.base_tonnage] ?? r.base_tonnage],
                ['Tolérance d\'écart', `${formatNombre(Number(r.tolerance_ecart_pct), 1)} %`],
                ['Trajet', `${r.site_depart_id ? sites.get(r.site_depart_id) ?? 'Site' : 'Tous'} → ${r.site_arrivee_id ? sites.get(r.site_arrivee_id) ?? 'Site' : 'Tous'}`]] },
              { titre: 'Période', champs: [['Du', jour(r.periode_debut)], ['Au', jour(r.periode_fin)], ['Statut', ouverte ? 'Ouverte' : 'Clôturée'],
                ['Clôturée le', r.cloturee_le ? new Date(r.cloturee_le).toLocaleString('fr-FR') : null]] },
            ]} />
          </div>
        ) },
        { id: 'lignes', libelle: 'Lignes', compte: lignes.lignes?.length ?? null, contenu: (
          <Panneau
            titre={`Lignes (${visibles.length})`}
            action={
              <div className="flex flex-wrap gap-1 text-sm">
                {FILTRES_LIGNES.map((s) => (
                  <button key={s} type="button" onClick={() => naviguer({ vue: VUE_RECONCILIATION, mode: 'detail', id, requete: { onglet: 'lignes', statut: s } }, { remplacer: true })}
                    aria-pressed={filtre === s} className={`rounded-lg px-2.5 py-1 ${filtre === s ? 'bg-orange-100 font-semibold text-orange-800' : 'text-stone-600 hover:bg-stone-100'}`}>
                    {s === 'toutes' ? 'Toutes' : STATUTS_LIGNE[s].libelle} ({s === 'toutes' ? lignes.lignes?.length ?? 0 : comptes[s]})
                  </button>
                ))}
                <button type="button" onClick={exporter} disabled={!lignes.lignes?.length} className="ml-2 flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1 disabled:opacity-50"><Download className="h-4 w-4" /> Exporter</button>
              </div>
            }
          >
            {lignes.erreur ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{lignes.erreur}</p>
              : lignes.lignes === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
                : visibles.length === 0 ? <SansDonnees message="Aucune ligne" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-stone-200 text-left text-stone-500">
                        <th className="py-2 pr-2 font-medium">Voyage</th><th className="py-2 pr-2 text-right font-medium">Chargé</th><th className="py-2 pr-2 text-right font-medium">Reçu</th>
                        <th className="py-2 pr-2 text-right font-medium">Kogon</th><th className="py-2 pr-2 text-right font-medium">CBG</th>
                        <th className="py-2 pr-2 text-right font-medium">Accepté</th><th className="py-2 pr-2 font-medium">Ticket · fiche</th><th className="py-2 pr-2 font-medium">Anomalies</th>
                        <th className="py-2 pr-2 font-medium">Statut</th>{droits.ecrire && ouverte && <th className="py-2 font-medium">Décision</th>}
                      </tr></thead>
                      <tbody>{visibles.map((l) => {
                        const s = statutLigne(l.decision, l.anomalies);
                        const rectifie = l.anomalies.includes('ticket_rectifie');
                        return (
                          <tr key={l.id} className="border-b border-stone-100 align-top last:border-0">
                            <td className="py-2 pr-2"><p className="font-semibold text-stone-900">{l.reference}</p><p className="text-xs text-stone-500">{jour(l.date_voyage)}</p></td>
                            <td className="py-2 pr-2 text-right">{t(l.tonnage_charge)}</td>
                            <td className="py-2 pr-2 text-right">{t(l.tonnage_recu)}</td>
                            <td className="py-2 pr-2 text-right">{t(l.tonnage_kogon)}</td>
                            <td className="py-2 pr-2 text-right">{t(l.tonnage_cbg)}</td>
                            <td className="py-2 pr-2 text-right">{t(l.tonnage_accepte)}</td>
                            <td className="py-2 pr-2 text-xs text-stone-600">{l.ticket ?? '—'}<br />{l.fiche ?? '—'}{l.ticket_document_ref && <><br />Doc: {l.ticket_document_ref}</>}</td>
                            <td className="py-2 pr-2 text-xs">{l.anomalies.map((a) => <span key={a} className={`mr-1 inline-block rounded px-1.5 py-0.5 ${ANOMALIES[a]?.bloquante ? 'bg-orange-100 text-orange-800' : 'bg-stone-100 text-stone-600'}`}>{ANOMALIES[a]?.libelle ?? a}</span>)}</td>
                            <td className="py-2 pr-2"><Puce teinte={STATUTS_LIGNE[s].teinte}>{STATUTS_LIGNE[s].libelle}</Puce>{l.motif_decision && <p className="mt-1 text-xs text-stone-500">{l.motif_decision}</p>}</td>
                            {droits.ecrire && ouverte && (
                              <td className="whitespace-nowrap py-2 text-xs">
                                {possible(l, 'facturable')
                                  ? <a href={decider(l, 'facturable')} className="mr-1 inline-block rounded bg-green-50 px-2 py-1 font-semibold text-green-700"
                                    aria-label={rectifie ? `Approuver la facturation ${l.reference}` : `Facturer ${l.reference}`}>{rectifie ? 'Approuver la facturation' : 'Facturer'}</a>
                                  : <span className="mr-1 inline-block text-stone-500" title="Ticket rectifié : décision motivée d'un approbateur de la facturation, distinct de l'auteur de la rectification">Facturation : approbateur</span>}
                                <a href={decider(l, 'exclue')} className="mr-1 inline-block rounded bg-stone-100 px-2 py-1 font-semibold text-stone-700" aria-label={`Exclure ${l.reference}`}>Exclure</a>
                                {l.ticket && <a href={ecrireRoute({ vue: VUE_RECONCILIATION, mode: 'action', id, action: 'rectifier', requete: { ligne: l.id } })}
                                  className="mr-1 inline-block rounded bg-amber-50 px-2 py-1 font-semibold text-amber-800" aria-label={`Rectifier ticket CBG ${l.reference}`}>Ticket</a>}
                                {possible(l, 'aucune') && <a href={decider(l, 'aucune')} className="inline-block rounded px-2 py-1 text-stone-500 hover:bg-stone-100" aria-label={`Annuler la décision ${l.reference}`}>Annuler la décision</a>}
                              </td>
                            )}
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                )}
          </Panneau>
        ) },
        { id: 'relations', libelle: 'Relations', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Contrat" lignes={contrat ? [contrat] : []} cle={(c) => c.id} vide="Contrat non visible avec vos droits" lien={(c) => routeDetail('contrats', c.id)}
              colonnes={[{ libelle: 'Référence', valeur: (c) => c.reference }, { libelle: 'Client', valeur: (c) => c.contrepartie }, { libelle: 'Devise', valeur: (c) => c.devise }]} />
            <Relation titre="Factures générées" lignes={factures.lignes} erreur={factures.erreur} cle={(f) => f.id} vide={ouverte ? 'La facture se génère après la clôture' : 'Aucune facture générée'}
              lien={(f) => routeDetail(VUE_FACTURES, f.id)}
              colonnes={[{ libelle: 'Numéro', valeur: (f) => libelleFacture(f) }, { libelle: 'TTC', valeur: (f) => montant(f.montant_ttc, f.devise) },
                { libelle: 'Statut', valeur: (f) => <Puce teinte={STATUTS_FACTURE[f.statut]?.teinte ?? 'gris'}>{STATUTS_FACTURE[f.statut]?.libelle ?? f.statut}</Puce> }]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={lignes.erreur || rectifications.erreur} source="reconciliations (horodatages), reconciliation_lignes (décisions), rectifications_tickets_pesee_cbg"
            absent="La réconciliation n'a pas de journal propre : l'historique reprend ses horodatages (ouverture, dernière actualisation, clôture), les décisions horodatées des lignes et les rectifications de tickets. Les actualisations intermédiaires ne sont pas conservées (écart D-090)." />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="une réconciliation (les pièces des tickets CBG sont sur chaque ticket)" /> },
      ]}
    />
  );
};

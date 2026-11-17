import { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarClock, FilePlus2, PenLine, RefreshCcw, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { Historique } from '../ui/Historique';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { Puce, SansDonnees } from '../ui/Panneau';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, type Lecture } from '../ui/lecture';
import { ecrireRoute, routeAction, routeDetail, routeModifier } from '../ui/routeur';
import { STATUTS_FACTURE, VUE_FACTURES, VUE_RECONCILIATION, libelleFacture, montant, type Facture } from '../Facturation/facturation';
import type { Reconciliation } from '../Facturation/reconciliation';
import {
  INDICATEURS, MODULE_CONTRATS, NATURES, PERIODICITES, RENOUVELLEMENTS, STATUTS, TYPES_CLAUSE, UNITES_TARIF, VUE_CONTRATS, decrireClause, etatEcheance,
  grilleVerrouillee, libelleVersion, versionEnVigueur, type Version,
} from './types';
import { useDossier } from './dossier';

// Fiche d'un contrat (D-026, D-065, D-090) : informations et echeance,
// grille contractuelle (contrat initial et avenants, tarifs, engagements,
// clauses chiffrees), relations (reconciliations et factures du contrat),
// historique (journal_contrats et evenements d'echeance).

const jour = (iso: string | null) => (iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('fr-FR') : null);
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });

const TABLES: Record<string, string> = {
  contrats: 'Contrat', contrat_versions: 'Version', contrat_tarifs: 'Tarif', contrat_engagements: 'Engagement',
  contrat_clauses: 'Clause', evaluations_fournisseurs: 'Évaluation du loueur',
};
const ACTIONS_JOURNAL: Record<string, string> = { INSERT: 'création', UPDATE: 'modification', DELETE: 'suppression' };

const BOUTON_LIEN = 'rounded p-1 text-stone-400 hover:text-stone-700';

export const DetailContrat = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('contracts', 'create') || hasPermission('contracts', 'edit');
  const d = useDossier(id, { journal: true });
  const c = d.c;
  const [engins, setEngins] = useState<Map<string, string>>(new Map());
  const [factures, setFactures] = useState<Lecture<Facture>>(attente);
  const [recs, setRecs] = useState<Lecture<Reconciliation>>(attente);

  useEffect(() => {
    supabase.from('vehicles').select('id, registration').then(({ data }) => setEngins(new Map(((data ?? []) as { id: string; registration: string }[]).map((e) => [e.id, e.registration]))));
    lire<Facture>(supabase.from('factures').select('*').eq('contrat_id', id).order('prepare_le', { ascending: false }), 'factures du contrat')
      .then((r) => setFactures({ ...r, lignes: r.lignes && r.lignes.filter((f) => f.contrat_id === id) }));
    lire<Reconciliation>(supabase.from('reconciliations').select('*').eq('contrat_id', id).order('periode_debut', { ascending: false }), 'réconciliations du contrat')
      .then((r) => setRecs({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.contrat_id === id) }));
  }, [id]);

  const enVigueur = useMemo(() => versionEnVigueur(d.versions, aujourdhui()), [d.versions]);
  const brouillon = c?.statut === 'brouillon';
  const verrou = (v: Version) => (c ? grilleVerrouillee(c.statut, v, aujourdhui()) : true);
  const element = (action: string, requete: Record<string, string>) => ecrireRoute({ vue: VUE_CONTRATS, mode: 'action', id, action, requete });
  const supprimer = (table: string, element_: string) => element('supprimer', { table, element: element_ });
  const echeancePossible = peutEcrire && Boolean(c?.date_fin) && ['actif', 'suspendu'].includes(c?.statut ?? '');

  const historique: EvenementHistorique[] | null = d.journal && d.evenements ? fusionnerHistoriques(
    d.journal.map((j) => ({
      id: `journal_contrats-${j.id}`, le: j.le, libelle: `${TABLES[j.table_cible] ?? j.table_cible} : ${ACTIONS_JOURNAL[j.action] ?? j.action}`,
      detail: j.action === 'UPDATE' && j.avant && j.apres
        ? Object.keys(j.apres).filter((k) => JSON.stringify(j.apres?.[k]) !== JSON.stringify(j.avant?.[k]))
          .map((k) => `${k} : ${String(j.avant?.[k] ?? '—')} → ${String(j.apres?.[k] ?? '—')}`).join(' ; ') || null
        : j.action === 'DELETE' && j.avant ? String(j.avant.libelle ?? j.avant.intitule ?? j.avant.reference ?? '') || null : null,
      auteur: j.auteur ?? null, source: 'journal_contrats',
    })),
    d.evenements.map((e) => ({
      id: `contrats_echeances-${e.id}`, le: e.le, libelle: e.evenement === 'renouvellement' ? 'Renouvellement' : 'Dénonciation',
      detail: `Le ${jour(e.date_evenement)}${e.nouvelle_fin ? ` · fin portée du ${jour(e.ancienne_fin)} au ${jour(e.nouvelle_fin)}` : ''}${e.hors_preavis ? ' · hors délai de préavis' : ''}`,
      motif: e.motif, auteur: e.par, source: 'contrats_echeances',
    })),
  ) : null;

  return (
    <PageDetail
      vue={VUE_CONTRATS}
      module={MODULE_CONTRATS}
      reference={c?.reference ?? 'Contrat'}
      titre={c ? `${c.reference} · ${c.contrepartie}` : undefined}
      statut={c ? { libelle: STATUTS[c.statut]?.libelle ?? c.statut, teinte: STATUTS[c.statut]?.teinte ?? 'gris' } : null}
      resume={c && <>{c.intitule} · {NATURES[c.nature] ?? c.nature} · {c.devise}</>}
      chargement={d.contrat.lignes === null && !d.contrat.erreur}
      erreur={d.contrat.erreur}
      introuvable={d.contrat.lignes !== null && !c}
      actions={[
        { id: 'modifier', libelle: 'Modifier', icone: <PenLine className="h-4 w-4" />, visible: peutEcrire, ton: 'principal', vers: routeModifier(VUE_CONTRATS, id) },
        { id: 'statut', libelle: 'Changer le statut', icone: <RefreshCcw className="h-4 w-4" />, visible: peutEcrire, vers: routeAction(VUE_CONTRATS, id, 'statut') },
        { id: 'version', libelle: d.versions.length === 0 ? 'Contrat initial' : 'Nouvel avenant', icone: <FilePlus2 className="h-4 w-4" />, visible: peutEcrire && d.pret, vers: routeAction(VUE_CONTRATS, id, 'version') },
        { id: 'renouveler', libelle: 'Renouveler', icone: <CalendarClock className="h-4 w-4" />, visible: echeancePossible, vers: routeAction(VUE_CONTRATS, id, 'renouveler') },
        { id: 'denoncer', libelle: 'Dénoncer', icone: <Ban className="h-4 w-4" />, visible: echeancePossible, vers: routeAction(VUE_CONTRATS, id, 'denoncer') },
        { id: 'supprimer', libelle: 'Supprimer (brouillon)', icone: <Trash2 className="h-4 w-4" />, visible: peutEcrire && brouillon, ton: 'danger', vers: supprimer('contrats', id) },
      ]}
      onglets={!c ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Contrat', champs: [['Référence', c.reference], ['Intitulé', c.intitule], ['Nature', NATURES[c.nature] ?? c.nature], ['Contrepartie', c.contrepartie],
              ['Devise', c.devise], ['Statut', STATUTS[c.statut]?.libelle ?? c.statut], ['Description', c.description]] },
            { titre: 'Durée et paiement', champs: [['Début', jour(c.date_debut)], ['Fin', c.date_fin ? jour(c.date_fin) : 'En cours (sans date de fin)'],
              ['Délai de paiement', c.delai_paiement_jours != null ? `${c.delai_paiement_jours} jours` : null],
              ['Version en vigueur', enVigueur ? libelleVersion(enVigueur) : d.pret ? 'Aucune (saisir le contrat initial)' : '…']] },
            { titre: 'Échéance et renouvellement', champs: [
              ['Préavis', c.preavis_jours != null ? `${c.preavis_jours} jours` : null],
              ['Renouvellement', c.renouvellement ? `${RENOUVELLEMENTS[c.renouvellement]}${c.renouvellement_duree_mois ? ` · ${c.renouvellement_duree_mois} mois` : ''}` : null],
              ['Date clé', d.echeance ? `${d.echeance.nature_echeance === 'limite_preavis' ? 'Préavis au' : 'Fin le'} ${jour(d.echeance.date_cle)}` : c.date_fin ? null : 'Sans date de fin'],
              ['État', d.echeance ? <Puce key="e" teinte={etatEcheance(d.echeance).teinte}>{etatEcheance(d.echeance).libelle}</Puce> : 'Sans échéance suivie'],
              ['Alerte', d.echeance ? `À partir du ${jour(d.echeance.date_alerte)} (${d.echeance.delai_alerte_jours > 0 ? `${d.echeance.delai_alerte_jours} jours avant, réglage administrateur` : 'à la date clé seulement : aucun délai réglé'})${d.echeance.fin_si_tacite ? ` · si renouvellement tacite : fin au ${jour(d.echeance.fin_si_tacite)} (à confirmer par un renouvellement enregistré)` : ''}` : null],
            ] },
          ]} />
        ) },
        { id: 'grille', libelle: 'Versions et grille', compte: d.versions.length, contenu: (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">Version en vigueur : <b>{enVigueur ? libelleVersion(enVigueur) : 'aucune (saisir le contrat initial)'}</b></p>
            {d.erreurGrille && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{d.erreurGrille}</p>}
            {!d.pret ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
              : d.versions.length === 0 ? <SansDonnees message="Aucune version" detail="Saisissez le contrat initial (version 0), puis les avenants." /> : (
                [...d.versions].reverse().map((v) => {
                  const tv = d.tarifs.filter((t) => t.version_id === v.id);
                  const ev = d.engagements.filter((e) => e.version_id === v.id);
                  const kv = d.clauses.filter((k) => k.version_id === v.id);
                  const verrouillee = verrou(v);
                  return (
                    <section key={v.id} className={`rounded-2xl border bg-white p-4 shadow-carte ${enVigueur?.id === v.id ? 'border-green-300' : 'border-stone-200'}`} aria-label={libelleVersion(v)}>
                      <header className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="font-bold text-stone-900">{libelleVersion(v)}</h2>
                          <p className="text-xs text-stone-500">
                            Effet le {jour(v.date_effet)}{v.date_signature ? ` · signé le ${jour(v.date_signature)}` : ''}{v.document_ref ? ` · document : ${v.document_ref}` : ''}
                            {enVigueur?.id === v.id && <b className="ml-1 text-green-700">· en vigueur</b>}
                          </p>
                          {v.resume && <p className="mt-1 text-sm text-stone-600">{v.resume}</p>}
                        </div>
                        {peutEcrire && (
                          <div className="flex gap-1">
                            <a href={element('version', { version: v.id })} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label={`Modifier ${libelleVersion(v)}`}><PenLine className="h-4 w-4" /></a>
                            {brouillon && <a href={supprimer('contrat_versions', v.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" aria-label={`Supprimer ${libelleVersion(v)}`}><Trash2 className="h-4 w-4" /></a>}
                          </div>
                        )}
                      </header>

                      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-stone-700">Tarifs</h3>
                            {peutEcrire && !verrouillee && <a href={element('tarif', { version: v.id })} className="text-xs font-semibold text-orange-700 hover:underline">+ Ajouter un tarif</a>}
                          </div>
                          {tv.length === 0 ? <p className="text-xs text-stone-400">Aucun tarif dans cette version.</p> : (
                            <ul className="space-y-1 text-sm">
                              {tv.map((t) => (
                                <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-2 py-1">
                                  <span>{t.libelle}{t.engin ? ` · ${engins.get(t.engin) ?? 'engin retiré'}` : t.categorie_materiel ? ` (${t.categorie_materiel})` : ''}{t.unite === 'km' && <span className="ml-1 text-xs text-stone-500">{t.km_retour_vide_facturable == null ? '· retour à vide : à confirmer' : t.km_retour_vide_facturable ? '· retour à vide facturé' : '· trajet chargé seulement'}</span>}</span>
                                  <span className="flex items-center gap-1 font-semibold text-stone-900">
                                    {formatNombre(Number(t.prix), 2)} {c.devise} {UNITES_TARIF[t.unite] ?? t.unite}
                                    {peutEcrire && <a href={element('tarif', { version: v.id, tarif: t.id })} className={BOUTON_LIEN}
                                      aria-label={verrouillee ? `Modifier le tarif ${t.libelle} par avenant` : `Modifier le tarif ${t.libelle}`} title={verrouillee ? 'Tarif en vigueur : modification par avenant' : 'Modifier'}><PenLine className="h-3.5 w-3.5" /></a>}
                                    {peutEcrire && brouillon && <a href={supprimer('contrat_tarifs', t.id)} className="rounded p-1 text-stone-400 hover:text-red-600" aria-label={`Supprimer le tarif ${t.libelle}`}><Trash2 className="h-3.5 w-3.5" /></a>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-stone-700">Engagements</h3>
                            {peutEcrire && !verrouillee && <a href={element('engagement', { version: v.id })} className="text-xs font-semibold text-orange-700 hover:underline">+ Ajouter un engagement</a>}
                          </div>
                          {ev.length === 0 ? <p className="text-xs text-stone-400">Aucun engagement dans cette version.</p> : (
                            <ul className="space-y-1 text-sm">
                              {ev.map((e) => (
                                <li key={e.id} className="rounded-lg bg-stone-50 px-2 py-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span title={INDICATEURS[e.indicateur]}>{e.libelle}</span>
                                    <span className="flex items-center gap-1 font-semibold text-stone-900">
                                      {e.sens === 'minimum' ? '≥' : '≤'} {formatNombre(Number(e.seuil), 2)} {e.unite} {PERIODICITES[e.periodicite] ?? ''}
                                      {peutEcrire && !verrouillee && <a href={element('engagement', { version: v.id, engagement: e.id })} className={BOUTON_LIEN} aria-label={`Modifier l'engagement ${e.libelle}`}><PenLine className="h-3.5 w-3.5" /></a>}
                                      {peutEcrire && brouillon && <a href={supprimer('contrat_engagements', e.id)} className="rounded p-1 text-stone-400 hover:text-red-600" aria-label={`Supprimer l'engagement ${e.libelle}`}><Trash2 className="h-3.5 w-3.5" /></a>}
                                    </span>
                                  </div>
                                  {e.consequence && <p className="text-xs text-stone-500">{e.consequence}</p>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-stone-700">Clauses chiffrées (pénalités, bonus, retenues)</h3>
                          {peutEcrire && !verrouillee && <a href={element('clause', { version: v.id })} className="text-xs font-semibold text-orange-700 hover:underline">+ Ajouter une clause</a>}
                        </div>
                        {kv.length === 0 ? <p className="text-xs text-stone-400">Aucune clause chiffrée : la conséquence d'un engagement reste en texte libre.</p> : (
                          <ul className="space-y-1 text-sm" aria-label={`Clauses ${libelleVersion(v)}`}>
                            {kv.map((k) => (
                              <li key={k.id} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${k.actif ? 'bg-stone-50' : 'bg-stone-50/40 text-stone-400 line-through'}`}>
                                <span><b>{TYPES_CLAUSE[k.type_clause]}</b> · {k.libelle} · {decrireClause(k, c.devise, ev.find((e) => e.id === k.engagement_id)?.libelle)}{k.article ? ` · art. ${k.article}` : ''}</span>
                                {peutEcrire && k.actif && !verrouillee && (
                                  <span className="flex items-center gap-1">
                                    <a href={element('clause', { version: v.id, clause: k.id })} className={BOUTON_LIEN} aria-label={`Modifier la clause ${k.libelle}`}><PenLine className="h-3.5 w-3.5" /></a>
                                    <a href={element('desactiver-clause', { clause: k.id })} className="rounded p-1 text-stone-400 hover:text-red-600" aria-label={`Désactiver la clause ${k.libelle}`}><Ban className="h-3.5 w-3.5" /></a>
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>
                  );
                })
              )}
          </div>
        ) },
        { id: 'relations', libelle: 'Relations', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Réconciliations" lignes={recs.lignes} erreur={recs.erreur} cle={(r) => r.id} vide={c.nature === 'client' ? 'Aucune réconciliation' : 'Contrat non client : pas de réconciliation'}
              lien={(r) => routeDetail(VUE_RECONCILIATION, r.id)}
              colonnes={[{ libelle: 'Période', valeur: (r) => `du ${jour(r.periode_debut)} au ${jour(r.periode_fin)}` },
                { libelle: 'Tonnage facturable', valeur: (r) => (r.tonnage_facturable === null ? '—' : `${formatNombre(Number(r.tonnage_facturable), 2)} t`) },
                { libelle: 'Statut', valeur: (r) => (r.statut === 'cloturee' ? <Puce teinte="vert">Clôturée</Puce> : <Puce teinte="orange">Ouverte</Puce>) }]} />
            <Relation titre="Factures et avoirs" lignes={factures.lignes} erreur={factures.erreur} cle={(f) => f.id} vide="Aucune facture" lien={(f) => routeDetail(VUE_FACTURES, f.id)}
              colonnes={[{ libelle: 'Numéro', valeur: (f) => libelleFacture(f) }, { libelle: 'TTC', valeur: (f) => montant(f.montant_ttc, f.devise) },
                { libelle: 'Statut', valeur: (f) => <Puce teinte={STATUTS_FACTURE[f.statut]?.teinte ?? 'gris'}>{STATUTS_FACTURE[f.statut]?.libelle ?? f.statut}</Puce> }]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={d.erreurJournal} source="journal_contrats (contrat, versions, tarifs, engagements, clauses ; 200 dernières entrées), contrats_echeances" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un contrat (la référence du document signé est portée par chaque version)" /> },
      ]}
    />
  );
};

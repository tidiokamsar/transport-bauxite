import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportToCSV } from '../../lib/exports';
import { PageListe } from '../ui/PageListe';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { routeNouveau, useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { TYPES_ECRITURE, bornesMois, lignesExportComptable, totauxDettes, type Dette, type Ecriture } from './finance';
import { VUE_BUDGETS, type SuiviBudget } from './budgets';
import { DetailBudget } from './DetailBudget';
import { FormulaireBudget } from './FormulaireBudget';
import { ActionBudget } from './ActionBudget';

// Budgets, engagements budgetaires, dettes et export comptable (D-065).
// Budget TTC. Engage = bons approuves ou recus en partie (commande HT + taxes)
// et pieces payables non payees (reste a payer TTC) ; realise = paiements
// executes et couts enregistres (montant saisi). Un depassement est
// signale, jamais bloque. Referentiels (natures, plan de comptes, comptes de
// tiers) saisis par l'administrateur : aucun numero de compte suppose.
// Pages standard (D-090) : liste des budgets, fiche #/budgets/<id>,
// creation #/budgets/nouveau, revision #/budgets/<id>/modifier, annulation
// #/budgets/<id>/annuler. Les autres onglets restent dans la page.

interface Depense { categorie: string; origine: 'bon_commande' | 'a_payer' | 'paiement' | 'cout'; piece_id: string; piece: string | null; date_operation: string; nature_id: string | null; devise: string | null; montant: number; base_montant: string; tiers: string | null;
  source_imputation: 'bon_commande' | 'facture_loueur' | 'cout'; piece_imputee: string }
interface Nature { id: string; code: string; libelle: string; actif: boolean }
interface Compte { id: string; numero: string; libelle: string; actif: boolean }
interface CompteTiers { id: string; contrat_id: string | null; supplier_id: string | null; compte_id: string }

type Onglet = 'budgets' | 'imputer' | 'dettes' | 'export' | 'referentiels';
const ONGLETS: Record<Onglet, string> = {
  budgets: 'Suivi budgétaire', imputer: 'Dépenses à imputer', dettes: 'Dettes fournisseurs', export: 'Export comptable', referentiels: 'Référentiels',
};
const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const jour = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : '—');
const moisCourant = () => new Date().toISOString().slice(0, 7);
const ORIGINES: Record<string, string> = { bon_commande: 'Bon de commande', a_payer: 'Pièce à payer', paiement: 'Paiement', cout: 'Coût' };
const SOURCES: Record<string, string> = { bon_commande: 'bon de commande', facture_loueur: 'facture du loueur', cout: 'coût' };

// Onglet ouvert pendant la session : le retour d'une fiche budget le conserve.
let ongletMemorise: Onglet = 'budgets';

export const FinanceView = () => {
  const route = useRoute();
  if (route.vue !== VUE_BUDGETS || route.mode === 'liste') return <Finance />;
  if (route.mode === 'nouveau') return <FormulaireBudget />;
  if (route.mode === 'modifier') return <FormulaireBudget id={route.id ?? ''} />;
  if (route.mode === 'action' && route.action) return <ActionBudget id={route.id ?? ''} action={route.action} />;
  return <DetailBudget id={route.id ?? ''} />;
};

const Finance = () => {
  const { hasPermission, profile } = useAuth();
  const estAdmin = profile?.role === 'admin';
  const peutBudget = hasPermission('costs', 'create') || hasPermission('costs', 'edit');
  // Onglets alignes sur les politiques de lecture (D-078) : budgets, depenses,
  // dettes et export pour costs, invoices ou reports ; referentiels (plan
  // comptable, natures, comptes de tiers) aussi pour contracts.
  const lectureFinance = estAdmin || ['costs', 'invoices', 'reports'].some((m) => hasPermission(m, 'view'));
  const ongletsVisibles: Onglet[] = lectureFinance ? (Object.keys(ONGLETS) as Onglet[]) : ['referentiels'];
  const [ongletChoisi, setOngletEtat] = useState<Onglet>(ongletMemorise);
  const setOnglet = (o: Onglet) => { ongletMemorise = o; setOngletEtat(o); };
  const onglet: Onglet = ongletsVisibles.includes(ongletChoisi) ? ongletChoisi : ongletsVisibles[0];
  const [suivi, setSuivi] = useState<SuiviBudget[] | null>(null);
  const [erreurSuivi, setErreurSuivi] = useState('');
  const [natures, setNatures] = useState<Nature[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [dettes, setDettes] = useState<Dette[] | null>(null);
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; nature_depense_id: string | null }[]>([]);
  const [contrats, setContrats] = useState<{ id: string; reference: string; contrepartie: string }[]>([]);
  const [fournisseurs, setFournisseurs] = useState<{ id: string; company_name: string }[]>([]);
  const [comptesTiers, setComptesTiers] = useState<CompteTiers[]>([]);
  const [mois, setMois] = useState({ du: moisCourant(), au: moisCourant() });
  const [ecritures, setEcritures] = useState<Ecriture[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    const [s, n, d, de, pc, cc, co, fo, ct] = await Promise.all([
      supabase.from('v_suivi_budgets').select('*').order('periode_debut', { ascending: false }),
      supabase.from('natures_depense').select('id, code, libelle, actif').order('code'),
      supabase.from('v_depenses_budgetaires').select('*').order('date_operation', { ascending: false }),
      supabase.from('v_dettes_fournisseurs').select('*').order('date_piece'),
      supabase.from('plan_comptable').select('id, numero, libelle, actif').order('numero'),
      supabase.from('cost_categories').select('id, name, nature_depense_id').order('name'),
      supabase.from('contrats').select('id, reference, contrepartie').order('reference'),
      supabase.from('suppliers').select('id, company_name').order('company_name'),
      supabase.from('comptes_tiers').select('id, contrat_id, supplier_id, compte_id'),
    ]);
    // Lecture impossible : etat d'erreur explicite, jamais « aucun budget » ou « aucune dette ».
    const echecs = [s, n, d, de, pc, cc, co, fo, ct].map((r) => r.error?.message).filter(Boolean);
    setMessage(echecs.length ? { ok: false, texte: `Lecture impossible : ${echecs.join(' ; ')}` } : null);
    setSuivi(s.error ? null : (s.data ?? []) as SuiviBudget[]);
    setErreurSuivi(s.error ? `Budgets indisponibles : ${s.error.message}` : '');
    setNatures((n.data ?? []) as Nature[]);
    setDepenses((d.data ?? []) as Depense[]);
    setDettes(de.error ? null : (de.data ?? []) as Dette[]);
    setComptes((pc.data ?? []) as Compte[]);
    setCategories((cc.data ?? []) as { id: string; name: string; nature_depense_id: string | null }[]);
    setContrats((co.data ?? []) as { id: string; reference: string; contrepartie: string }[]);
    setFournisseurs((fo.data ?? []) as { id: string; company_name: string }[]);
    setComptesTiers((ct.data ?? []) as CompteTiers[]);
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const executer = async (fonction: string, args: Record<string, unknown>, succes: string) => {
    setMessage(null);
    const { error } = await supabase.rpc(fonction, args);
    setMessage(error ? { ok: false, texte: error.message } : { ok: true, texte: succes });
    if (!error) await charger();
    return !error;
  };

  const colonnesBudget = useMemo<ColonneListe<SuiviBudget>[]>(() => [
    { id: 'numero', libelle: 'Budget', valeur: (b) => b.numero },
    { id: 'nature', libelle: 'Nature', valeur: (b) => b.nature },
    { id: 'periode', libelle: 'Période', valeur: (b) => b.periode_debut, rendu: (b) => `${jour(b.periode_debut)} – ${jour(b.periode_fin)}` },
    { id: 'site', libelle: 'Centre', valeur: (b) => b.site ?? 'Sans site' },
    { id: 'montant', libelle: 'Budget TTC', valeur: (b) => b.montant_ttc, rendu: (b) => `${nombre.format(b.montant_ttc)} ${b.devise}`, alignement: 'droite' },
    { id: 'devise', libelle: 'Devise', valeur: (b) => b.devise, masquee: true },
    { id: 'engage', libelle: 'Engagé', valeur: (b) => b.engage, rendu: (b) => nombre.format(b.engage), alignement: 'droite' },
    { id: 'realise', libelle: 'Réalisé', valeur: (b) => b.realise, rendu: (b) => nombre.format(b.realise), alignement: 'droite' },
    { id: 'disponible', libelle: 'Disponible', valeur: (b) => b.disponible, alignement: 'droite',
      rendu: (b) => <span className={`font-semibold ${b.disponible < 0 ? 'text-red-700' : ''}`}>{nombre.format(b.disponible)}</span> },
    { id: 'etat', libelle: 'État', valeur: (b) => b.consommation_pct,
      rendu: (b) => (b.depassement ? <Puce teinte="rouge">Dépassé ({b.consommation_pct} %)</Puce> : <Puce teinte="vert">{b.consommation_pct} % consommé</Puce>) },
    { id: 'non_visibles', libelle: 'Sources non visibles', valeur: (b) => b.sources_non_visibles, masquee: true },
  ], []);
  const filtresBudget = useMemo<FiltreListe<SuiviBudget>[]>(() => [
    { id: 'etat', libelle: 'État', options: [{ valeur: 'depasse', libelle: 'Dépassé' }, { valeur: 'dans', libelle: 'Dans le budget' }],
      correspond: (b, v) => (v === 'depasse' ? b.depassement : !b.depassement) },
  ], []);

  // Une piece a imputer une seule fois, meme si plusieurs paiements la reglent.
  const nonImputees = useMemo(() => {
    const vues = new Set<string>();
    return depenses.filter((d) => {
      const cle = `${d.source_imputation}-${d.piece_imputee}`;
      if (d.nature_id || vues.has(cle)) return false;
      vues.add(cle);
      return true;
    });
  }, [depenses]);
  const imputer = (d: Depense, nature: string) => {
    if (!nature) return;
    executer('imputer_depense', { p_source: d.source_imputation, p_piece: d.piece_imputee, p_nature: nature, p_motif: null }, 'Dépense imputée.');
  };

  const chargerEcritures = async () => {
    const { du } = bornesMois(mois.du);
    const { au } = bornesMois(mois.au);
    const { data, error } = await supabase.rpc('ecritures_gestion', { p_du: du, p_au: au });
    setMessage(error ? { ok: false, texte: `Écritures indisponibles : ${error.message}` } : null);
    setEcritures(error ? null : (data ?? []) as Ecriture[]);
  };
  const exporter = () => {
    if (!ecritures?.length) return;
    exportToCSV(lignesExportComptable(ecritures), `ecritures_gestion_${mois.du}_${mois.au}`);
  };

  const compteDe = (contrat: string | null, fournisseur: string | null) =>
    comptesTiers.find((t) => (contrat && t.contrat_id === contrat) || (fournisseur && t.supplier_id === fournisseur))?.compte_id ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-stone-900">Budgets et comptabilité</h2>
        <p className="text-stone-500">Budget, engagé, réalisé et disponible ; dettes fournisseurs ; export des écritures de gestion</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Onglets finance">
        {ongletsVisibles.map((o) => (
          <button key={o} onClick={() => setOnglet(o)} aria-pressed={onglet === o}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${onglet === o ? 'bg-orange-600 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}>{ONGLETS[o]}</button>
        ))}
      </nav>
      {message && <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.texte}</p>}

      {onglet === 'budgets' && (
        <PageListe
          vue={VUE_BUDGETS}
          titre="Suivi budgétaire"
          sousTitre="Un budget par période, centre et nature de dépense ; un dépassement est signalé, jamais bloqué"
          lignes={suivi}
          erreur={erreurSuivi}
          colonnes={colonnesBudget}
          filtres={filtresBudget}
          placeholderRecherche="Rechercher un budget, une nature, un centre..."
          cle={(b) => b.id}
          libelleOuverture={(b) => `Fiche ${b.numero}`}
          actions={peutBudget && (
            <a href={routeNouveau(VUE_BUDGETS)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
              <Plus className="h-4 w-4" /> Nouveau budget
            </a>
          )}
          nomExport="suivi_budgetaire"
          vide={{ message: 'Aucun budget', detail: 'Saisissez un budget par période, centre et nature de dépense.' }}
          onActualiser={charger}
          provenance={<Provenance source="budgets saisis (TTC) ; engagé : bons approuvés ou reçus en partie (commande HT + taxes, GNF), pièces payables non payées (reste à payer TTC D-055) ; réalisé : paiements exécutés, coûts enregistrés (montant saisi)" heure={heure} />}
        />
      )}

      {onglet === 'imputer' && (
        <Panneau titre="Dépenses sans nature de dépense">
          {nonImputees.length === 0 ? <SansDonnees message="Aucune dépense à imputer" detail="Un coût suit la nature de sa catégorie ; un bon de commande ou une facture du loueur s'impute ici." /> : (
            <ul className="divide-y divide-stone-100 text-sm" aria-label="Dépenses à imputer">
              {nonImputees.map((d) => (
                <li key={`${d.source_imputation}-${d.piece_imputee}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{ORIGINES[d.origine]} <b>{d.piece ?? 'sans numéro'}</b>{d.origine === 'paiement' || d.origine === 'a_payer' ? ` (impute la ${SOURCES[d.source_imputation]})` : ''} · {jour(d.date_operation)} · {nombre.format(d.montant)} {d.devise ?? 'devise non saisie'} ({d.base_montant}){d.tiers ? ` · ${d.tiers}` : ''}</span>
                  <select defaultValue="" onChange={(e) => imputer(d, e.target.value)} aria-label={`Imputer ${d.piece ?? d.piece_id}`} className="rounded border border-stone-300 px-2 py-1 text-xs">
                    <option value="">Imputer à...</option>
                    {natures.filter((n) => n.actif).map((n) => <option key={n.id} value={n.id}>{n.code} · {n.libelle}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <Provenance source="v_depenses_budgetaires (droits du lecteur) ; une réimputation exige un motif et garde la précédente" heure={heure} />
        </Panneau>
      )}

      {onglet === 'dettes' && (
        <Panneau titre="Dettes fournisseurs">
          {dettes === null ? <p className="text-sm text-stone-500">Dettes non lues (voir le message ci-dessus).</p> : dettes.length === 0 ? <SansDonnees message="Aucune dette" detail="Factures du loueur contrôlées et bons de commande reçus non payés." /> : (
            <>
              <ul className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Totaux des dettes">
                {totauxDettes(dettes).map((t) => <li key={`${t.beneficiaire}-${t.devise}`} className="rounded-xl bg-stone-50 px-3 py-2"><b>{t.beneficiaire}</b> · {nombre.format(t.du)} {t.devise} ({t.pieces} pièce(s))</li>)}
              </ul>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stone-300 text-left text-stone-500">
                  <th className="py-2 pr-3 font-medium">Pièce</th><th className="py-2 pr-3 font-medium">Bénéficiaire</th>
                  <th className="py-2 pr-3 text-right font-medium">Dû</th><th className="py-2 pr-3 text-right font-medium">Paiements en cours</th><th className="py-2 text-right font-medium">Ancienneté</th>
                </tr></thead>
                <tbody>{dettes.map((d) => (
                  <tr key={`${d.source}-${d.piece_id}`} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 pr-3">{d.source === 'facture_loueur' ? 'Facture du loueur' : 'Bon de commande'} {d.piece} · {jour(d.date_piece)}</td>
                    <td className="py-2 pr-3">{d.beneficiaire ?? 'Non renseigné'}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{nombre.format(d.du)} {d.devise}</td>
                    <td className="py-2 pr-3 text-right">{nombre.format(d.paiements_en_cours)}</td>
                    <td className="py-2 text-right">{d.anciennete_jours ?? '—'} j</td>
                  </tr>
                ))}</tbody>
              </table>
            </>
          )}
          <Provenance source="v_reste_a_payer (D-055) : base moins avoirs, déductions et part réclamée, moins payé" heure={heure} />
        </Panneau>
      )}

      {onglet === 'export' && (
        <Panneau titre="Écritures de gestion">
          <div className="mb-4 flex flex-wrap items-end gap-2 text-sm">
            <label>Du mois<input type="month" value={mois.du} onChange={(e) => setMois({ ...mois, du: e.target.value })} className={CHAMP} /></label>
            <label>Au mois<input type="month" value={mois.au} onChange={(e) => setMois({ ...mois, au: e.target.value })} className={CHAMP} /></label>
            <button onClick={chargerEcritures} disabled={!mois.du || !mois.au || mois.au < mois.du} className="rounded-xl border border-stone-200 px-3 py-2 font-semibold disabled:opacity-50">Afficher</button>
            <button onClick={exporter} disabled={!ecritures?.length} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-3 py-2 font-bold text-white disabled:opacity-50"><Download className="h-4 w-4" /> Exporter en CSV</button>
          </div>
          {ecritures === null ? <SansDonnees message="Choisissez une période" /> : ecritures.length === 0 ? <SansDonnees message="Aucune écriture sur la période" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Écritures">
                <thead><tr className="border-b border-stone-300 text-left text-stone-500">
                  <th className="py-2 pr-3 font-medium">Date</th><th className="py-2 pr-3 font-medium">Type</th><th className="py-2 pr-3 font-medium">Pièce</th>
                  <th className="py-2 pr-3 font-medium">Tiers</th><th className="py-2 pr-3 font-medium">Compte de tiers</th><th className="py-2 text-right font-medium">Montant</th>
                </tr></thead>
                <tbody>{ecritures.map((e, i) => (
                  <tr key={i} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 pr-3">{jour(e.date_ecriture)}</td><td className="py-2 pr-3">{TYPES_ECRITURE[e.type_ecriture]}</td>
                    <td className="py-2 pr-3">{e.piece ?? '—'}{e.piece_liee ? ` (${e.piece_liee})` : ''}</td><td className="py-2 pr-3">{e.tiers ?? '—'}</td>
                    <td className="py-2 pr-3">{e.compte_tiers ?? <span className="text-stone-400">non paramétré</span>}</td>
                    <td className="py-2 text-right">{nombre.format(e.montant)} {e.devise ?? ''}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <Provenance source="factures et avoirs émis, encaissements, paiements exécutés, coûts enregistrés ; lus avec vos droits" />
        </Panneau>
      )}

      {onglet === 'referentiels' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Referentiel titre="Natures de dépense" lignes={natures.map((n) => ({ id: n.id, code: n.code, libelle: n.libelle, actif: n.actif }))} estAdmin={estAdmin}
            libelleCode="Code" onEnregistrer={(code, libelle, actif, id) => executer('definir_nature_depense', { p_code: code, p_libelle: libelle, p_actif: actif, p_id: id ?? null }, 'Nature enregistrée.')} />
          <Referentiel titre="Plan de comptes" lignes={comptes.map((c) => ({ id: c.id, code: c.numero, libelle: c.libelle, actif: c.actif }))} estAdmin={estAdmin}
            libelleCode="Numéro de compte" onEnregistrer={(code, libelle, actif, id) => executer('definir_compte_comptable', { p_numero: code, p_libelle: libelle, p_actif: actif, p_id: id ?? null }, 'Compte enregistré.')} />
          <Panneau titre="Catégories de coût et natures">
            {categories.length === 0 ? <SansDonnees message="Aucune catégorie de coût" /> : (
              <ul className="divide-y divide-stone-100 text-sm">{categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-1.5"><span>{c.name}</span>
                  <select value={c.nature_depense_id ?? ''} disabled={!estAdmin} aria-label={`Nature de ${c.name}`}
                    onChange={(e) => executer('associer_categorie_cout', { p_categorie: c.id, p_nature: e.target.value || null }, 'Catégorie rattachée.')} className="rounded border border-stone-300 px-2 py-1 text-xs">
                    <option value="">Aucune nature</option>
                    {natures.filter((n) => n.actif).map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}
                  </select>
                </li>
              ))}</ul>
            )}
          </Panneau>
          <Panneau titre="Comptes de tiers">
            <ul className="divide-y divide-stone-100 text-sm" aria-label="Comptes de tiers">
              {[...contrats.map((c) => ({ cle: `c-${c.id}`, libelle: `${c.reference} · ${c.contrepartie}`, contrat: c.id, fournisseur: null as string | null })),
                ...fournisseurs.map((f) => ({ cle: `f-${f.id}`, libelle: f.company_name, contrat: null as string | null, fournisseur: f.id }))].map((t) => (
                <li key={t.cle} className="flex items-center justify-between gap-2 py-1.5"><span>{t.libelle}</span>
                  <select value={compteDe(t.contrat, t.fournisseur)} disabled={!estAdmin} aria-label={`Compte de ${t.libelle}`}
                    onChange={(e) => executer('definir_compte_tiers', { p_compte: e.target.value || null, p_contrat: t.contrat, p_fournisseur: t.fournisseur }, 'Compte de tiers enregistré.')}
                    className="rounded border border-stone-300 px-2 py-1 text-xs">
                    <option value="">Non paramétré</option>
                    {comptes.filter((c) => c.actif).map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.libelle}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </Panneau>
        </div>
      )}
    </div>
  );
};

const Referentiel = ({ titre, lignes, estAdmin, libelleCode, onEnregistrer }: {
  titre: string; lignes: { id: string; code: string; libelle: string; actif: boolean }[]; estAdmin: boolean; libelleCode: string;
  onEnregistrer: (code: string, libelle: string, actif: boolean, id?: string) => Promise<boolean>;
}) => {
  const [f, setF] = useState({ code: '', libelle: '' });
  return (
    <Panneau titre={titre}>
      {lignes.length === 0 ? <SansDonnees message="Référentiel vide" detail="Saisi par l'administrateur : aucune valeur supposée." /> : (
        <ul className="divide-y divide-stone-100 text-sm">{lignes.map((l) => (
          <li key={l.id} className={`flex items-center justify-between gap-2 py-1.5 ${l.actif ? '' : 'text-stone-400'}`}>
            <span><b>{l.code}</b> · {l.libelle}</span>
            {estAdmin && <button onClick={() => onEnregistrer(l.code, l.libelle, !l.actif, l.id)} className="rounded border border-stone-200 px-2 py-0.5 text-xs">{l.actif ? 'Désactiver' : 'Réactiver'}</button>}
          </li>
        ))}</ul>
      )}
      {estAdmin && (
        <form onSubmit={(e) => { e.preventDefault(); onEnregistrer(f.code.trim(), f.libelle.trim(), true).then((ok) => { if (ok) setF({ code: '', libelle: '' }); }); }}
          className="mt-3 flex flex-wrap items-end gap-2 text-sm" aria-label={`Ajouter : ${titre}`}>
          <label>{libelleCode} *<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={CHAMP} /></label>
          <label className="flex-1">Libellé *<input value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} className={CHAMP} /></label>
          <button type="submit" disabled={!f.code.trim() || !f.libelle.trim()} className="rounded-lg bg-stone-800 px-3 py-2 font-semibold text-white disabled:opacity-50">Ajouter</button>
        </form>
      )}
    </Panneau>
  );
};

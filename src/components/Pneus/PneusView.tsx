import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CircleDot, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce } from '../ui/Panneau';
import { useRoute } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { ETATS_PNEU, etatAffiche, texteKm, type EtatPneu } from './pneus';
import { Douchette } from './communsPneus';
import {
  ESPACES_PNEUS, VUE_PNEUS, droitsPneus, estEspace, gnf, indicateur, lireIdRoute, nombre, routeEspace, routeSaisie,
  useLecture, useRegistre, type EspacePneus, type PneuLigne,
} from './socle';
import {
  EspaceAnomalies, EspaceCouts, EspaceInspections, EspaceMaintenance, EspaceMontage, EspaceParametrage, EspacePerformance, EspaceStocks,
} from './EspacesPneus';
import { DetailPneu } from './DetailPneu';
import { ActionPneu } from './ActionPneu';
import { FormulairePneus } from './FormulairesPneu';

// Gestion des pneus (D-052, D-091) au standard des pages (D-090) : dix
// espaces sous l'entree de menu Pneus (#/tires?espace=...), fiche du pneu
// (#/tires/<id>), saisies (#/tires/nouveau?objet=...), actions metier
// (#/tires/<id>/<action>). Remplace l'ancien ecran a fenetres.

export const PneusView = () => {
  const route = useRoute();
  if (route.vue !== VUE_PNEUS || route.mode === 'liste') return <EspacesPneus requete={route.vue === VUE_PNEUS ? route.requete : {}} />;
  if (route.mode === 'nouveau') return <FormulairePneus objet={route.requete.objet ?? 'carcasse'} requete={route.requete} />;
  const cible = lireIdRoute(route.id ?? '');
  if (route.mode === 'modifier') return <FormulairePneus objet="correction" id={cible.id} requete={route.requete} />;
  if (route.mode === 'action' && route.action) return <ActionPneu idRoute={route.id ?? ''} action={route.action} requete={route.requete} />;
  if (cible.prefixe === 'engin') return <EspacesPneus requete={{ espace: 'montage', engin: cible.id }} />;
  if (cible.prefixe) return <EspacesPneus requete={{ espace: 'parametrage' }} />;
  return <DetailPneu id={cible.id} />;
};

// Espace ouvert pendant la session : les filtres de PageListe reecrivent la
// requete de l'adresse, l'espace est donc garde ici (comme Stock).
let dernierEspace: EspacePneus = 'tableau';

const EspacesPneus = ({ requete }: { requete: Record<string, string> }) => {
  const { hasPermission, profile } = useAuth();
  const droits = droitsPneus(hasPermission, profile?.role);
  const [espace, setEspace] = useState<EspacePneus>(() => (estEspace(requete.espace) ? requete.espace : dernierEspace));
  useEffect(() => { if (estEspace(requete.espace)) setEspace(requete.espace); }, [requete.espace]);
  useEffect(() => { dernierEspace = espace; }, [espace]);

  const contenu: Record<EspacePneus, ReactNode> = {
    tableau: <TableauDeBord />,
    registre: <Registre droits={droits} />,
    montage: <EspaceMontage droits={droits} engin={requete.engin} />,
    inspections: <EspaceInspections droits={droits} />,
    maintenance: <EspaceMaintenance droits={droits} />,
    stocks: <EspaceStocks />,
    anomalies: <EspaceAnomalies droits={droits} />,
    performance: <EspacePerformance />,
    couts: <EspaceCouts />,
    parametrage: <EspaceParametrage droits={droits} />,
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Espaces du module Pneus" className="flex flex-wrap gap-1 border-b border-stone-200">
        {ESPACES_PNEUS.map(([e, libelle]) => (
          <a key={e} href={routeEspace(e)} aria-current={e === espace ? 'page' : undefined} onClick={() => setEspace(e)}
            className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-semibold ${e === espace ? 'border-orange-600 text-orange-800' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
            {libelle}
          </a>
        ))}
      </nav>
      {contenu[espace]}
    </div>
  );
};

// ---------------------------------------------------------------- 1. tableau de bord

const Tuile = ({ libelle, valeur, detail, vers, alerte }: { libelle: string; valeur: ReactNode; detail?: string; vers: string; alerte?: boolean }) => (
  <a href={vers} className={`block rounded-2xl border bg-white p-4 shadow-carte hover:border-orange-400 ${alerte ? 'border-orange-300' : 'border-stone-200/70'}`}>
    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{libelle}</p>
    <p className="mt-1 text-2xl font-black text-stone-900">{valeur}</p>
    {detail && <p className="mt-1 text-xs text-stone-500">{detail}</p>}
  </a>
);

const TableauDeBord = () => {
  const r = useRegistre();
  const couts = useLecture<{ montant: number | null }>(() => supabase.from('v_pneus_couts').select('montant'), 'coûts des pneus');
  const ind = useLecture<{ cout_total: number | null; km: number | null; heures: number | null; tonnes: number | null; cout_km: number | null; cout_heure: number | null; cout_tonne: number | null }>(
    () => supabase.from('v_pneus_indicateurs').select('cout_total, km, heures, tonnes, cout_km, cout_heure, cout_tonne'), 'indicateurs des pneus');
  const p = r.pneus.lignes;
  if (r.erreur && !p) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{r.erreur}</p>;
  if (!p) return <p role="status" className="py-8 text-center text-sm text-stone-500">Chargement…</p>;

  const reels = p.filter((x) => !r.annuleReception.has(x.id));
  const compte = (etat: EtatPneu) => reels.filter((x) => x.status === etat).length;
  const aSurveiller = reels.filter((x) => r.alertesParPneu.has(x.id)).length;
  const inspectionsRetard = reels.filter((x) => (r.alertesParPneu.get(x.id) ?? []).some((a) => a.regle === 'pneu_inspection_retard')).length;
  const immobilisants = reels.filter((x) => r.proposes.has(x.id) || (r.alertesParPneu.get(x.id) ?? []).some((a) => a.regle === 'pneu_defaut_critique')).length;
  const connus = (couts.lignes ?? []).filter((c) => c.montant !== null);
  const inconnus = (couts.lignes ?? []).length - connus.length;
  // Ratio flotte sur les seuls pneus dont l'indicateur est calcule par le serveur.
  const ratio = (cle: 'km' | 'heures' | 'tonnes', indic: 'cout_km' | 'cout_heure' | 'cout_tonne', unite: string) => {
    const l = (ind.lignes ?? []).filter((x) => x[indic] !== null && x.cout_total !== null && (x[cle] ?? 0) > 0);
    if (!l.length) return { valeur: 'Données insuffisantes', detail: 'Aucun pneu avec coût et activité complets' };
    const total = l.reduce((s, x) => s + Number(x.cout_total), 0) / l.reduce((s, x) => s + Number(x[cle]), 0);
    return { valeur: nombre(total, unite) ?? '', detail: `Sur ${l.length} pneu${l.length > 1 ? 's' : ''} aux données complètes` };
  };
  const km = ratio('km', 'cout_km', 'GNF/km');
  const h = ratio('heures', 'cout_heure', 'GNF/h');
  const t = ratio('tonnes', 'cout_tonne', 'GNF/t');
  const reg = (f: Record<string, string>) => routeEspace('registre', f);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-stone-900"><CircleDot className="h-6 w-6 text-orange-600" /> Pneus : tableau de bord</h1>
          <p className="text-stone-500">Chaque indicateur ouvre la liste correspondante.</p>
        </div>
        <Douchette />
      </div>
      {r.erreur && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{r.erreur}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Tuile libelle="Parc" valeur={reels.filter((x) => x.status !== 'retired').length} detail="Hors réformés" vers={reg({ 'f.parc': 'oui' })} />
        <Tuile libelle="Montés" valeur={compte('active')} vers={reg({ 'f.etat': 'active' })} />
        <Tuile libelle="Disponibles" valeur={compte('stored')} detail="En stock, réutilisables" vers={reg({ 'f.etat': 'stored' })} />
        <Tuile libelle="À décider" valeur={compte('damaged')} vers={reg({ 'f.etat': 'damaged' })} />
        <Tuile libelle="En intervention" valeur={compte('en_intervention')} vers={routeEspace('maintenance')} />
        <Tuile libelle="Réformés" valeur={compte('retired')} vers={reg({ 'f.etat': 'retired' })} />
        <Tuile libelle="À surveiller" valeur={r.alertes ? aSurveiller : '…'} detail="Pneus avec alerte active" vers={reg({ 'f.alerte': 'oui' })} alerte={aSurveiller > 0} />
        <Tuile libelle="Immobilisants" valeur={r.alertes ? immobilisants : '…'} detail="Défaut critique ou proposition ouverte" vers={routeEspace('anomalies')} alerte={immobilisants > 0} />
        <Tuile libelle="Inspections en retard" valeur={r.alertes ? inspectionsRetard : '…'} vers={reg({ 'f.alerte': 'pneu_inspection_retard' })} alerte={inspectionsRetard > 0} />
        <Tuile libelle="Dépenses" valeur={couts.lignes ? gnf(connus.reduce((s, c) => s + Number(c.montant), 0)) ?? '' : '…'}
          detail={inconnus ? `${inconnus} coût${inconnus > 1 ? 's' : ''} non renseigné${inconnus > 1 ? 's' : ''}` : 'Tous les coûts renseignés'} vers={routeEspace('couts')} />
        <Tuile libelle="Coût / km" valeur={ind.lignes ? km.valeur : '…'} detail={km.detail} vers={routeEspace('couts')} />
        <Tuile libelle="Coût / heure" valeur={ind.lignes ? h.valeur : '…'} detail={h.detail} vers={routeEspace('couts')} />
        <Tuile libelle="Coût / tonne" valeur={ind.lignes ? t.valeur : '…'} detail={t.detail} vers={routeEspace('couts')} />
      </div>
      {(couts.erreur || ind.erreur) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{couts.erreur} {ind.erreur}</p>}
      <Provenance source="v_pneus, v_pneus_couts, v_pneus_indicateurs, alerts (règles D-091), pneus_propositions_immobilisation" heure={new Date()} />
    </div>
  );
};

// ---------------------------------------------------------------- 2. registre

const Registre = ({ droits }: { droits: ReturnType<typeof droitsPneus> }) => {
  const r = useRegistre();
  const colonnes = useMemo<ColonneListe<PneuLigne>[]>(() => [
    { id: 'code', libelle: 'Code SIGTB', valeur: (p) => p.code_sigtb },
    { id: 'serie', libelle: 'N° de série', valeur: (p) => p.numero_serie ?? (p.sans_numero_serie ? 'Sans numéro' : p.tire_number) },
    { id: 'marque', libelle: 'Marque / modèle', valeur: (p) => [p.brand, p.model].filter(Boolean).join(' ') || null },
    { id: 'dimension', libelle: 'Dimension', valeur: (p) => p.dimension },
    {
      id: 'etat', libelle: 'État', valeur: (p) => etatAffiche(p.status, r.annuleReception.has(p.id)).texte,
      rendu: (p) => { const e = etatAffiche(p.status, r.annuleReception.has(p.id)); return <Puce teinte={e.teinte}>{e.texte}</Puce>; },
    },
    { id: 'engin', libelle: 'Engin / position', valeur: (p) => (p.vehicle_id ? `${r.nomEngin.get(p.vehicle_id) ?? 'Engin'} · ${p.position ?? ''}` : null) },
    { id: 'site', libelle: 'Site', valeur: (p) => (p.site_id ? r.nomSite.get(p.site_id) ?? null : null) },
    { id: 'profondeur', libelle: 'Profondeur', valeur: (p) => p.derniere_profondeur_mm, rendu: (p) => nombre(p.derniere_profondeur_mm, 'mm') ?? 'Sans données', alignement: 'droite' },
    { id: 'km', libelle: 'Km', valeur: (p) => p.km_parcourus, rendu: (p) => texteKm(p.km_parcourus, p.km_incomplet, p.nb_montages), alignement: 'droite' },
    { id: 'coutkm', libelle: 'Coût / km', valeur: (p) => p.cout_km, rendu: (p) => indicateur(p.cout_km, 'GNF/km'), alignement: 'droite', masquee: true },
    { id: 'alertes', libelle: 'Alertes', valeur: (p) => r.alertesParPneu.get(p.id)?.length ?? 0, alignement: 'droite' },
  ], [r.annuleReception, r.nomEngin, r.nomSite, r.alertesParPneu]);

  const filtres = useMemo<FiltreListe<PneuLigne>[]>(() => [
    { id: 'etat', libelle: 'État', options: Object.entries(ETATS_PNEU).map(([v, e]) => ({ valeur: v, libelle: e.texte })), correspond: (p, v) => p.status === v },
    { id: 'parc', libelle: 'Parc', options: [{ valeur: 'oui', libelle: 'Hors réformés' }], correspond: (p) => p.status !== 'retired' },
    {
      id: 'alerte', libelle: 'Alerte', options: [{ valeur: 'oui', libelle: 'Avec alerte' }, { valeur: 'pneu_inspection_retard', libelle: 'Inspection en retard' }],
      correspond: (p, v) => (v === 'oui' ? r.alertesParPneu.has(p.id) : (r.alertesParPneu.get(p.id) ?? []).some((a) => a.regle === v)),
    },
    {
      id: 'site', libelle: 'Site', options: [...r.nomSite].map(([valeur, libelle]) => ({ valeur, libelle })),
      correspond: (p, v) => p.site_id === v,
    },
  ], [r.alertesParPneu, r.nomSite]);

  return (
    <div className="space-y-4">
      <Douchette />
      <PageListe
        vue={VUE_PNEUS}
        titre="Registre des pneus"
        sousTitre="Une carcasse = un code SIGTB permanent ; état recalculé depuis le journal des opérations."
        lignes={r.pneus.lignes}
        erreur={r.erreur}
        colonnes={colonnes}
        filtres={filtres}
        recherche={(p, t) => [p.code_sigtb, p.numero_serie, p.tire_number, p.brand, p.model, p.dimension].some((v) => (v ?? '').toLowerCase().includes(t.toLowerCase()))}
        placeholderRecherche="Code SIGTB, numéro de série, marque, dimension"
        cle={(p) => p.id}
        libelleOuverture={(p) => `Fiche ${p.code_sigtb}`}
        actions={droits.ecriture ? <a href={routeSaisie('carcasse')} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Nouvelle carcasse</a> : undefined}
        nomExport="registre-pneus"
        vide={{ message: 'Aucun pneu enregistré', detail: droits.ecriture ? 'Créez une carcasse ou réceptionnez un achat de pneus (Achats).' : 'Aucun pneu dans votre périmètre.' }}
        provenance={<Provenance source="v_pneus (D-091), alerts" />}
        onActualiser={r.pneus.recharger}
      />
    </div>
  );
};


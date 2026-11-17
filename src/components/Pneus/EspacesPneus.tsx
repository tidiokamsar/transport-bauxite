import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageListe } from '../ui/PageListe';
import { Relation } from '../ui/PageDetail';
import { Panneau, Provenance, Puce, ReferentielVide, SansDonnees } from '../ui/Panneau';
import { naviguer, routeDetail } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import { Douchette } from './communsPneus';
import { PerformancePneus } from './PerformancePneus';
import {
  CATEGORIES_COUT, LIBELLE_GRAVITE, MOUVEMENTS, NATURES_INSPECTION, RECOMMANDATIONS, STATUTS_INTERVENTION, STATUTS_PROPOSITION,
  TEINTE_GRAVITE, TYPES_INTERVENTION, VUE_PNEUS, COLONNES_INTERVENTION, date, dateHeure, gnf, indicateur, lireAlertesPneus, nombre,
  routeActionPneu, routeEspace, routeSaisie, useLecture, CHAMPS_SEUILS, NATURES_EPISODE,
  type AlertePneu, type DroitsPneus, type Inspection, type Intervention, type PneuLigne, type Proposition,
} from './socle';

const LIEN = 'font-semibold text-orange-800 hover:underline';
const BOUTON = 'inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50';
const BOUTON_PRINCIPAL = 'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-semibold text-white';

const Titre = ({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children?: ReactNode }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-black text-stone-900">{titre}</h1>
      {sousTitre && <p className="text-stone-500">{sousTitre}</p>}
    </div>
    {children}
  </div>
);

const Erreur = ({ children }: { children: ReactNode }) => (children ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{children}</p> : null);

/** Codes SIGTB des pneus visibles (liens des listes). */
const useCodes = () => {
  const l = useLecture<{ id: string; code_sigtb: string; vehicle_id: string | null; status: string }>(
    () => supabase.from('tires').select('id, code_sigtb, vehicle_id, status'), 'codes des pneus');
  return { carte: useMemo(() => new Map((l.lignes ?? []).map((p) => [p.id, p.code_sigtb])), [l.lignes]), erreur: l.erreur };
};
const useEngins = () => {
  const l = useLecture<{ id: string; registration: string; brand_model: string | null }>(
    () => supabase.from('vehicles').select('id, registration, brand_model').neq('status', 'sold').order('registration'), 'engins');
  return { lignes: l.lignes, carte: useMemo(() => new Map((l.lignes ?? []).map((v) => [v.id, v.registration])), [l.lignes]), erreur: l.erreur };
};

const LienPneu = ({ id, codes, onglet }: { id: string; codes: Map<string, string>; onglet?: string }) =>
  <a href={routeDetail(VUE_PNEUS, id, onglet)} className={LIEN}>{codes.get(id) ?? 'Pneu'}</a>;

// ---------------------------------------------------------------- 3. montage et positions

interface PositionEngin {
  vehicle_id: string; registration: string; configuration_id: string; configuration: string; position: string; libelle: string | null;
  essieu: number | null; cote: string | null; rang: string | null; secours: boolean; dimensions_admises: string[]; ordre: number | null;
  tire_id: string | null; code_sigtb: string | null; dimension: string | null;
}

const ordreRang = (cote: string | null, rang: string | null) => {
  // De gauche a droite vu de dessus : exterieure gauche, interieure gauche, centre, interieure droite, exterieure droite.
  const c = cote === 'gauche' ? 0 : cote === 'centre' ? 2 : 4;
  const r = rang === 'exterieure' ? (cote === 'droite' ? 1 : -1) : rang === 'interieure' ? (cote === 'droite' ? -1 : 1) : 0;
  return c + r * 0.5;
};

export const EspaceMontage = ({ droits, engin }: { droits: DroitsPneus; engin?: string }) => {
  const engins = useEngins();
  const positions = useLecture<PositionEngin>(
    () => (engin ? supabase.from('v_pneus_positions_engins').select('*').eq('vehicle_id', engin) : Promise.resolve({ data: [], error: null })),
    'positions de l\'engin', [engin]);
  const montes = useLecture<PneuLigne>(
    () => (engin ? supabase.from('v_pneus').select('*').eq('vehicle_id', engin).eq('status', 'active') : Promise.resolve({ data: [], error: null })),
    'pneus montés', [engin]);
  const [alertes, setAlertes] = useState<AlertePneu[]>([]);
  useEffect(() => { lireAlertesPneus().then((r) => setAlertes(r.lignes ?? [])); }, []);
  const parPneu = useMemo(() => new Map((montes.lignes ?? []).map((p) => [p.id, p])), [montes.lignes]);
  const vehicule = (engins.lignes ?? []).find((v) => v.id === engin);
  const configurees = new Set((positions.lignes ?? []).map((p) => p.position));
  const horsConfiguration = (montes.lignes ?? []).filter((p) => !configurees.has(p.position ?? ''));
  const essieux = [...new Set((positions.lignes ?? []).filter((p) => !p.secours).map((p) => p.essieu ?? 0))].sort((a, b) => a - b);
  const secours = (positions.lignes ?? []).filter((p) => p.secours);

  const Carte = ({ p }: { p: PositionEngin }) => {
    const pneu = p.tire_id ? parPneu.get(p.tire_id) : undefined;
    const nb = p.tire_id ? alertes.filter((a) => a.tire_id === p.tire_id).length : 0;
    return (
      <div className={`w-40 rounded-xl border p-2 text-xs ${p.tire_id ? (nb ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50') : 'border-dashed border-stone-300 bg-white'}`}>
        <p className="font-bold text-stone-900">{p.position}{p.libelle ? ` · ${p.libelle}` : ''}</p>
        {p.tire_id ? (
          <>
            <a href={routeDetail(VUE_PNEUS, p.tire_id)} className={LIEN}>{p.code_sigtb}</a>
            <p>Profondeur : {nombre(pneu?.derniere_profondeur_mm, 'mm') ?? 'sans mesure'}</p>
            {nb > 0 && <p className="font-semibold text-red-700">{nb} anomalie{nb > 1 ? 's' : ''}</p>}
            {droits.ecriture && (
              <p className="mt-1 flex gap-2">
                <a href={routeActionPneu(p.tire_id, 'demonter')} className={LIEN}>Démonter</a>
                <a href={routeActionPneu(p.tire_id, 'permuter')} className={LIEN}>Permuter</a>
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-stone-500">Libre{p.dimensions_admises.length ? ` · ${p.dimensions_admises.join(', ')}` : ''}</p>
            {droits.ecriture && engin && <a href={routeActionPneu(`engin-${engin}`, 'monter', { position: p.position })} className={LIEN}>Monter ici</a>}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Titre titre="Montage et positions" sousTitre="Schéma des positions de l'engin, d'après la configuration de son modèle." />
      <Erreur>{engins.erreur}</Erreur>
      <label className="block max-w-md text-sm">
        <span className="mb-1 block font-medium text-stone-700">Engin</span>
        <select value={engin ?? ''} onChange={(e) => naviguer(routeEspace('montage', e.target.value ? { engin: e.target.value } : {}), { remplacer: true })} className={CHAMP_FENETRE}>
          <option value="">Choisir un engin</option>
          {(engins.lignes ?? []).map((v) => <option key={v.id} value={v.id}>{v.registration}{v.brand_model ? ` · ${v.brand_model}` : ''}</option>)}
        </select>
      </label>
      {engins.lignes && engins.lignes.length === 0 && <ReferentielVide>Aucun engin dans votre périmètre : enregistrez les engins (Flotte → Véhicules et engins).</ReferentielVide>}
      {!engin ? <SansDonnees message="Choisissez un engin" detail="Le schéma affiche les positions libres, les pneus montés, leur profondeur et leurs anomalies." />
        : positions.lignes === null || montes.lignes === null ? (positions.erreur || montes.erreur ? <Erreur>{positions.erreur} {montes.erreur}</Erreur> : <p role="status" className="text-sm text-stone-500">Chargement…</p>)
          : (
            <Panneau titre={`${vehicule?.registration ?? 'Engin'}${positions.lignes[0] ? ` · configuration ${positions.lignes[0].configuration}` : ''}`}
              action={droits.ecriture ? <a href={routeActionPneu(`engin-${engin}`, 'monter')} className={BOUTON}><Plus className="h-4 w-4" /> Monter un pneu</a> : undefined}>
              {positions.lignes.length === 0 ? (
                <ReferentielVide>
                  Aucune configuration de positions pour le modèle « {vehicule?.brand_model || 'non renseigné'} » : le schéma ne peut pas être dessiné.
                  Un administrateur ou un approbateur de la maintenance la saisit dans Paramétrage. En attendant, le montage se fait à position libre,
                  sauf si le blocage « configuration exigée » est activé (le serveur refuse alors le montage).
                </ReferentielVide>
              ) : (
                <div className="space-y-3 overflow-x-auto">
                  {essieux.map((e) => (
                    <div key={e} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-xs font-semibold text-stone-500">{e ? `Essieu ${e}` : 'Sans essieu'}</span>
                      {(positions.lignes ?? []).filter((p) => !p.secours && (p.essieu ?? 0) === e)
                        .sort((a, b) => ordreRang(a.cote, a.rang) - ordreRang(b.cote, b.rang) || (a.ordre ?? 0) - (b.ordre ?? 0))
                        .map((p) => <Carte key={p.position} p={p} />)}
                    </div>
                  ))}
                  {secours.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-xs font-semibold text-stone-500">Secours</span>
                      {secours.map((p) => <Carte key={p.position} p={p} />)}
                    </div>
                  )}
                </div>
              )}
              {horsConfiguration.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-bold text-stone-900">Pneus montés {positions.lignes.length ? 'hors configuration' : '(positions libres)'}</h3>
                  <ul className="space-y-1 text-sm">
                    {horsConfiguration.map((p) => (
                      <li key={p.id}>
                        <a href={routeDetail(VUE_PNEUS, p.id)} className={LIEN}>{p.code_sigtb}</a> · position {p.position ?? 'non renseignée'} · {nombre(p.derniere_profondeur_mm, 'mm') ?? 'sans mesure'}
                        {droits.ecriture && <> · <a href={routeActionPneu(p.id, 'demonter')} className={LIEN}>Démonter</a> · <a href={routeActionPneu(p.id, 'permuter')} className={LIEN}>Permuter</a></>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Provenance source="v_pneus_positions_engins, v_pneus, alerts" />
            </Panneau>
          )}
    </div>
  );
};

// ---------------------------------------------------------------- 4. inspections

export const EspaceInspections = ({ droits }: { droits: DroitsPneus }) => {
  const insp = useLecture<Inspection>(() => supabase.from('pneus_inspections').select('*').order('inspecte_le', { ascending: false }).limit(500), 'inspections');
  const codes = useCodes();
  const colonnes = useMemo<ColonneListe<Inspection>[]>(() => [
    { id: 'le', libelle: 'Inspecté le', valeur: (i) => i.inspecte_le, rendu: (i) => dateHeure(i.inspecte_le) },
    { id: 'pneu', libelle: 'Pneu', valeur: (i) => codes.carte.get(i.tire_id) ?? null },
    { id: 'nature', libelle: 'Nature', valeur: (i) => NATURES_INSPECTION[i.nature] ?? i.nature },
    { id: 'prof', libelle: 'Profondeur min.', valeur: (i) => i.profondeur_min_mm, rendu: (i) => nombre(i.profondeur_min_mm, 'mm') ?? '—', alignement: 'droite' },
    { id: 'ecart', libelle: 'Écart', valeur: (i) => i.ecart_mm, rendu: (i) => nombre(i.ecart_mm, 'mm') ?? '—', alignement: 'droite' },
    { id: 'pression', libelle: 'Pression', valeur: (i) => i.pression_bar, rendu: (i) => nombre(i.pression_bar, 'bar') ?? '—', alignement: 'droite' },
    { id: 'critique', libelle: 'Défaut critique', valeur: (i) => (i.defaut_critique ? 'Oui' : 'Non'), rendu: (i) => (i.defaut_critique ? <Puce teinte="rouge">Oui</Puce> : 'Non') },
    { id: 'reco', libelle: 'Recommandation', valeur: (i) => (i.recommandation ? RECOMMANDATIONS[i.recommandation] : null) },
  ], [codes.carte]);
  const filtres = useMemo<FiltreListe<Inspection>[]>(() => [
    { id: 'nature', libelle: 'Nature', options: Object.entries(NATURES_INSPECTION).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (i, v) => i.nature === v },
    { id: 'critique', libelle: 'Défaut critique', options: [{ valeur: 'oui', libelle: 'Avec défaut critique' }], correspond: (i) => i.defaut_critique },
  ], []);
  return (
    <div className="space-y-4">
      {droits.ecriture && <Douchette action="inspecter" libelle="Inspecter : code SIGTB ou numéro de série" />}
      <PageListe vue={VUE_PNEUS} titre="Inspections" sousTitre="Date réelle d'inspection distincte de la saisie ; un constat critique ouvre une proposition d'immobilisation (jamais automatique)."
        lignes={insp.lignes} erreur={[insp.erreur, codes.erreur].filter(Boolean).join(' ')} colonnes={colonnes} filtres={filtres}
        cle={(i) => i.id} libelleOuverture={(i) => `Inspection du ${dateHeure(i.inspecte_le)}`}
        ouvrir={(i) => naviguer(routeDetail(VUE_PNEUS, i.tire_id, 'inspections'))}
        nomExport="inspections-pneus" vide={{ message: 'Aucune inspection enregistrée', detail: 'Lisez le code du pneu à la douchette pour saisir une inspection.' }}
        provenance={<Provenance source="pneus_inspections (500 plus récentes)" />} onActualiser={insp.recharger} />
    </div>
  );
};

// ---------------------------------------------------------------- 5. maintenance pneumatique

const suiteIntervention = (i: Intervention): [string, string] | null =>
  i.statut === 'envoyee' ? ['retour-intervention', 'Enregistrer le retour']
    : i.statut === 'retournee' ? ['controler-intervention', 'Contrôler']
      : i.statut === 'controlee' ? ['decider-remise-en-service', 'Décider'] : null;

export const EspaceMaintenance = ({ droits }: { droits: DroitsPneus }) => {
  const itv = useLecture<Intervention>(() => supabase.from('pneus_interventions').select(COLONNES_INTERVENTION).order('envoye_le', { ascending: false }), 'interventions');
  const codes = useCodes();
  const colonnes = useMemo<ColonneListe<Intervention>[]>(() => [
    { id: 'numero', libelle: 'Numéro', valeur: (i) => i.numero },
    { id: 'pneu', libelle: 'Pneu', valeur: (i) => codes.carte.get(i.tire_id) ?? null, rendu: (i) => <LienPneu id={i.tire_id} codes={codes.carte} onglet="interventions" /> },
    { id: 'type', libelle: 'Type', valeur: (i) => (i.type === 'autre' ? i.type_autre : TYPES_INTERVENTION[i.type]) ?? i.type, rendu: (i) => <>{i.type === 'autre' ? i.type_autre : TYPES_INTERVENTION[i.type]}{i.cycle_rechapage ? ` (cycle ${i.cycle_rechapage})` : ''}</> },
    { id: 'prestataire', libelle: 'Prestataire', valeur: (i) => i.prestataire },
    { id: 'envoi', libelle: 'Envoyé le', valeur: (i) => i.envoye_le, rendu: (i) => date(i.envoye_le) },
    { id: 'statut', libelle: 'Statut', valeur: (i) => STATUTS_INTERVENTION[i.statut]?.texte ?? i.statut, rendu: (i) => { const s = STATUTS_INTERVENTION[i.statut]; return s ? <Puce teinte={s.teinte}>{s.texte}</Puce> : i.statut; } },
    { id: 'cout', libelle: 'Coût', valeur: (i) => i.cout, rendu: (i) => gnf(i.cout) ?? (i.retour_le ? 'Non renseigné' : '—'), alignement: 'droite' },
    {
      id: 'suite', libelle: 'Suite', valeur: () => null, triable: false, exportable: false,
      rendu: (i) => {
        const s = suiteIntervention(i);
        if (!s || !droits.ecriture || (s[0] === 'decider-remise-en-service' && !droits.approbation)) return s ? <span className="text-xs text-stone-500">{s[1]} (droit requis)</span> : null;
        return <a href={routeActionPneu(i.tire_id, s[0])} className={LIEN}>{s[1]}</a>;
      },
    },
  ], [codes.carte, droits]);
  const filtres = useMemo<FiltreListe<Intervention>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS_INTERVENTION).map(([valeur, s]) => ({ valeur, libelle: s.texte })), correspond: (i, v) => i.statut === v },
    { id: 'type', libelle: 'Type', options: Object.entries(TYPES_INTERVENTION).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (i, v) => i.type === v },
  ], []);
  return (
    <div className="space-y-4">
      {droits.ecriture && <Douchette action="envoyer-intervention" libelle="Envoyer en intervention : code SIGTB ou numéro de série" />}
      <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
        Circuit : envoi chez le prestataire (réparation, vulcanisation, rechapage, expertise), retour, contrôle, puis décision de remise en service par un approbateur
        de la maintenance qui n'a ni enregistré le retour ni fait le contrôle (séparation des tâches, vérifiée par le serveur).
      </p>
      <PageListe vue={VUE_PNEUS} titre="Maintenance pneumatique" sousTitre="Interventions et rechapages (filtre Type : rechapage)."
        lignes={itv.lignes} erreur={[itv.erreur, codes.erreur].filter(Boolean).join(' ')} colonnes={colonnes} filtres={filtres}
        cle={(i) => i.id} libelleOuverture={(i) => `Intervention ${i.numero}`} ouvrir={(i) => naviguer(routeDetail(VUE_PNEUS, i.tire_id, 'interventions'))}
        nomExport="interventions-pneus" vide={{ message: 'Aucune intervention', detail: 'Un pneu démonté (en stock ou à décider) part en intervention depuis sa fiche ou la douchette.' }}
        provenance={<Provenance source="pneus_interventions (D-091)" />} onActualiser={itv.recharger} />
    </div>
  );
};

// ---------------------------------------------------------------- 6. stocks et mouvements

interface Mouvement {
  id: string; tire_id: string; code_sigtb: string; effectue_le: string; mouvement: string; vehicle_id: string | null; position: string | null;
  site_id: string | null; site_origine_id: string | null; motif: string | null; annule: boolean;
}

export const EspaceStocks = () => {
  const stock = useLecture<{ site_id: string | null; status: string; marque: string | null; modele: string | null; dimension: string | null; nombre: number }>(
    () => supabase.from('v_pneus_stock').select('*'), 'stock de pneus');
  const mvts = useLecture<Mouvement>(() => supabase.from('v_pneus_mouvements').select('id, tire_id, code_sigtb, effectue_le, mouvement, vehicle_id, position, site_id, site_origine_id, motif, annule')
    .order('effectue_le', { ascending: false }).limit(500), 'mouvements de pneus');
  const sites = useLecture<{ id: string; name: string }>(() => supabase.from('sites').select('id, name'), 'sites');
  const engins = useEngins();
  const nomSite = useMemo(() => new Map((sites.lignes ?? []).map((s) => [s.id, s.name])), [sites.lignes]);
  const ETAT: Record<string, string> = { stored: 'Disponible', damaged: 'À décider', en_intervention: 'En intervention' };
  const colonnes = useMemo<ColonneListe<Mouvement>[]>(() => [
    { id: 'le', libelle: 'Date', valeur: (m) => m.effectue_le, rendu: (m) => dateHeure(m.effectue_le) },
    { id: 'pneu', libelle: 'Pneu', valeur: (m) => m.code_sigtb },
    { id: 'mvt', libelle: 'Mouvement', valeur: (m) => MOUVEMENTS[m.mouvement] ?? m.mouvement, rendu: (m) => <>{MOUVEMENTS[m.mouvement] ?? m.mouvement}{m.annule && <> <Puce teinte="gris">Annulé</Puce></>}</> },
    { id: 'lieu', libelle: 'Engin / site', valeur: (m) => (m.vehicle_id ? `${engins.carte.get(m.vehicle_id) ?? 'Engin'} ${m.position ?? ''}` : m.site_id ? nomSite.get(m.site_id) ?? null : null) },
    { id: 'origine', libelle: 'Site d\'origine', valeur: (m) => (m.site_origine_id ? nomSite.get(m.site_origine_id) ?? null : null), masquee: true },
    { id: 'motif', libelle: 'Motif', valeur: (m) => m.motif },
  ], [engins.carte, nomSite]);
  const filtres = useMemo<FiltreListe<Mouvement>[]>(() => [
    { id: 'mvt', libelle: 'Mouvement', options: Object.entries(MOUVEMENTS).map(([valeur, libelle]) => ({ valeur, libelle })), correspond: (m, v) => m.mouvement === v },
  ], []);
  return (
    <div className="space-y-5">
      <Relation titre="Stock de pneus hors engin" lignes={stock.lignes} erreur={stock.erreur} vide="Aucun pneu en stock"
        cle={(s) => `${s.site_id}-${s.status}-${s.marque}-${s.modele}-${s.dimension}`}
        colonnes={[
          { libelle: 'Site', valeur: (s) => (s.site_id ? nomSite.get(s.site_id) ?? 'Site' : 'Non renseigné') },
          { libelle: 'État', valeur: (s) => ETAT[s.status] ?? s.status },
          { libelle: 'Marque', valeur: (s) => s.marque ?? '—' },
          { libelle: 'Modèle', valeur: (s) => s.modele ?? '—' },
          { libelle: 'Dimension', valeur: (s) => s.dimension ?? '—' },
          { libelle: 'Nombre', valeur: (s) => s.nombre },
        ]}
        note="Calculé depuis l'état des carcasses, lui-même recalculé par le journal des opérations (aucun solde saisi). Transfert entre sites : fiche du pneu." />
      <PageListe vue={VUE_PNEUS} titre="Mouvements" lignes={mvts.lignes} erreur={[mvts.erreur, sites.erreur, engins.erreur].filter(Boolean).join(' ')}
        colonnes={colonnes} filtres={filtres} cle={(m) => m.id} libelleOuverture={(m) => `Pneu ${m.code_sigtb}`}
        ouvrir={(m) => naviguer(routeDetail(VUE_PNEUS, m.tire_id, 'chronologie'))}
        nomExport="mouvements-pneus" vide={{ message: 'Aucun mouvement' }} provenance={<Provenance source="v_pneus_mouvements (500 plus récents)" />} onActualiser={mvts.recharger} />
    </div>
  );
};

// ---------------------------------------------------------------- 7. anomalies et securite

export const EspaceAnomalies = ({ droits }: { droits: DroitsPneus }) => {
  const props = useLecture<Proposition>(() => supabase.from('pneus_propositions_immobilisation').select('*').order('propose_le', { ascending: false }).limit(300), 'propositions d\'immobilisation');
  const codes = useCodes();
  const engins = useEngins();
  const [alertes, setAlertes] = useState<AlertePneu[] | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => { lireAlertesPneus().then((r) => { setAlertes(r.lignes); setErreur(r.erreur); }); }, []);
  const ouvertes = (props.lignes ?? []).filter((p) => p.statut === 'proposee');
  return (
    <div className="space-y-5">
      <Titre titre="Anomalies et sécurité" sousTitre="Alertes calculées par le serveur (règles D-091, seuils du paramétrage) ; le système propose, l'humain décide." />
      <Relation titre={`Propositions d'immobilisation à décider (${ouvertes.length})`} lignes={props.lignes ? ouvertes : null} erreur={props.erreur}
        vide="Aucune proposition en attente" cle={(p) => p.id}
        colonnes={[
          { libelle: 'Pneu', valeur: (p) => <LienPneu id={p.tire_id} codes={codes.carte} onglet="alertes" /> },
          { libelle: 'Engin', valeur: (p) => engins.carte.get(p.vehicle_id) ?? 'Engin' },
          { libelle: 'Proposée le', valeur: (p) => dateHeure(p.propose_le) },
          { libelle: 'Motif', valeur: (p) => p.motif },
          { libelle: 'Décision', valeur: (p) => (droits.decisionImmobilisation ? <a href={routeActionPneu(p.tire_id, 'decider-immobilisation')} className={LIEN}>Décider</a> : 'Droit d\'écriture maintenance requis') },
        ]} />
      <Erreur>{erreur}</Erreur>
      <Relation titre="Alertes actives" lignes={alertes} vide="Aucune alerte active (ou aucun seuil paramétré : sans seuil applicable, aucune alerte)" cle={(a) => a.id}
        colonnes={[
          { libelle: 'Gravité', valeur: (a) => <Puce teinte={TEINTE_GRAVITE[a.severity] ?? 'gris'}>{LIBELLE_GRAVITE[a.severity] ?? a.severity}</Puce> },
          { libelle: 'Alerte', valeur: (a) => a.title },
          { libelle: 'Détail', valeur: (a) => a.message || '—' },
          { libelle: 'Pneu', valeur: (a) => (a.tire_id ? <LienPneu id={a.tire_id} codes={codes.carte} onglet="alertes" /> : '—') },
          { libelle: 'Depuis', valeur: (a) => dateHeure(a.survenu_le ?? a.created_at) },
        ]} />
      <Relation titre="Historique des propositions" lignes={props.lignes ? props.lignes.filter((p) => p.statut !== 'proposee') : null} vide="Aucune proposition décidée" cle={(p) => p.id}
        colonnes={[
          { libelle: 'Pneu', valeur: (p) => <LienPneu id={p.tire_id} codes={codes.carte} onglet="alertes" /> },
          { libelle: 'Statut', valeur: (p) => <Puce teinte={STATUTS_PROPOSITION[p.statut]?.teinte ?? 'gris'}>{STATUTS_PROPOSITION[p.statut]?.texte ?? p.statut}</Puce> },
          { libelle: 'Décidée le', valeur: (p) => dateHeure(p.decide_le) ?? '—' },
          { libelle: 'Motif de la décision', valeur: (p) => p.motif_decision ?? '—' },
        ]} />
      <Provenance source="alerts (écran tires), pneus_propositions_immobilisation" />
    </div>
  );
};

// ---------------------------------------------------------------- 8. performance et duree de vie

interface Usure { tire_id: string; code_sigtb: string; vehicle_id: string; monte_le: string; nb_mesures: number | null; premiere_mm: number | null; derniere_mm: number | null; km_debut: number | null; km_fin: number | null; usure_mm_1000km: number | null; km_restants_projetes: number | null; mesures_min_projection: number | null }
interface Episode { tire_id: string; numero_episode: number; nature: string; cycle_rechapage: number; debut: string; fin: string | null }

export const EspacePerformance = () => {
  const usure = useLecture<Usure>(() => supabase.from('v_pneus_usure').select('*'), 'usure des pneus');
  const episodes = useLecture<Episode>(() => supabase.from('v_pneus_episodes').select('*').order('debut', { ascending: false }).limit(300), 'épisodes de service');
  const codes = useCodes();
  const calculees = (usure.lignes ?? []).filter((u) => u.usure_mm_1000km !== null);
  const insuffisantes = (usure.lignes ?? []).length - calculees.length;
  return (
    <div className="space-y-5">
      <Titre titre="Performance et durée de vie" sousTitre="Taux d'usure et projection seulement avec le nombre de mesures fixé par les seuils et une distance positive." />
      <Relation titre="Usure du montage en cours" lignes={usure.lignes ? calculees : null} erreur={usure.erreur} cle={(u) => u.tire_id}
        vide="Aucun taux d'usure calculable (mesures de profondeur avec compteur insuffisantes ou seuil « mesures minimales » non paramétré)"
        colonnes={[
          { libelle: 'Pneu', valeur: (u) => <a href={routeDetail(VUE_PNEUS, u.tire_id)} className={LIEN}>{u.code_sigtb}</a> },
          { libelle: 'Monté le', valeur: (u) => date(u.monte_le) },
          { libelle: 'Mesures', valeur: (u) => u.nb_mesures ?? 0 },
          { libelle: 'Profondeur', valeur: (u) => `${nombre(u.premiere_mm, 'mm')} → ${nombre(u.derniere_mm, 'mm')}` },
          { libelle: 'Distance', valeur: (u) => nombre(u.km_fin !== null && u.km_debut !== null ? u.km_fin - u.km_debut : null, 'km') ?? '—' },
          { libelle: 'Usure', valeur: (u) => nombre(u.usure_mm_1000km, 'mm/1000 km', 3) },
          { libelle: 'Km restants projetés', valeur: (u) => nombre(u.km_restants_projetes, 'km', 0) ?? 'Données insuffisantes' },
        ]}
        note={usure.lignes && insuffisantes > 0 ? `${insuffisantes} pneu${insuffisantes > 1 ? 's' : ''} monté${insuffisantes > 1 ? 's' : ''} : données insuffisantes.` : undefined} />
      <Relation titre="Épisodes de service" lignes={episodes.lignes} erreur={[episodes.erreur, codes.erreur].filter(Boolean).join(' ')} vide="Aucun épisode" cle={(e) => `${e.tire_id}-${e.numero_episode}`}
        colonnes={[
          { libelle: 'Pneu', valeur: (e) => <LienPneu id={e.tire_id} codes={codes.carte} onglet="rechapages" /> },
          { libelle: 'Épisode', valeur: (e) => e.numero_episode },
          { libelle: 'Nature', valeur: (e) => NATURES_EPISODE[e.nature] ?? e.nature },
          { libelle: 'Cycle de rechapage', valeur: (e) => e.cycle_rechapage },
          { libelle: 'Début', valeur: (e) => date(e.debut) },
          { libelle: 'Fin', valeur: (e) => date(e.fin) ?? 'En cours' },
        ]} />
      <PerformancePneus version={0} />
      <Provenance source="v_pneus_usure, v_pneus_episodes, v_pneus_performance" />
    </div>
  );
};

// ---------------------------------------------------------------- 9. couts et budget

interface Synthese { tire_id: string; acquisition: number | null; reparation: number | null; rechapage: number | null; prestations: number | null; autres: number | null; total: number | null; deja_compte_achats: number | null; hors_achats: number | null; couts_inconnus: number }
interface Indicateurs { tire_id: string; code_sigtb: string; cout_total: number | null; nb_montages: number | null; km: number | null; heures: number | null; tonnes: number | null; cout_km: number | null; cout_heure: number | null; cout_tonne: number | null }

export const EspaceCouts = () => {
  const syn = useLecture<Synthese>(() => supabase.from('v_pneus_couts_synthese').select('*'), 'synthèse des coûts');
  const ind = useLecture<Indicateurs>(() => supabase.from('v_pneus_indicateurs').select('*').order('code_sigtb'), 'indicateurs');
  const somme = (cle: keyof Synthese) => (syn.lignes ?? []).reduce((s, l) => s + Number(l[cle] ?? 0), 0);
  const inconnus = somme('couts_inconnus');
  return (
    <div className="space-y-5">
      <Titre titre="Coûts et budget" sousTitre="Coûts lus dans les pièces (bon de commande, facture, saisie) ; coût au km, à l'heure et à la tonne calculés par le serveur." />
      <Relation titre="Dépenses par catégorie" lignes={syn.lignes ? Object.keys(CATEGORIES_COUT) : null} erreur={syn.erreur} vide="Aucune dépense" cle={(c) => c}
        colonnes={[
          { libelle: 'Catégorie', valeur: (c) => CATEGORIES_COUT[c] },
          { libelle: 'Montant connu', valeur: (c) => gnf(somme(c as keyof Synthese)) },
        ]}
        note={<>
          Dont déjà compté dans les achats (bon de commande) : {gnf(somme('deja_compte_achats'))} ; hors achats : {gnf(somme('hors_achats'))}.
          {inconnus > 0 && ` ${inconnus} coût${inconnus > 1 ? 's' : ''} non renseigné${inconnus > 1 ? 's' : ''} : totaux des pneus concernés non calculés.`}
          {' '}Budget : aucune enveloppe pneus n'est tenue dans ce module ; le suivi budgétaire est dans Finance.
        </>} />
      <Relation titre="Coût par pneu" lignes={ind.lignes} erreur={ind.erreur} vide="Aucun pneu" cle={(i) => i.tire_id}
        colonnes={[
          { libelle: 'Pneu', valeur: (i) => <a href={routeDetail(VUE_PNEUS, i.tire_id, 'couts')} className={LIEN}>{i.code_sigtb}</a> },
          { libelle: 'Coût total', valeur: (i) => gnf(i.cout_total) ?? 'Données insuffisantes' },
          { libelle: 'Km', valeur: (i) => nombre(i.km, 'km', 0) ?? '—' },
          { libelle: 'Heures', valeur: (i) => nombre(i.heures, 'h') ?? '—' },
          { libelle: 'Tonnes', valeur: (i) => nombre(i.tonnes, 't') ?? '—' },
          { libelle: 'Coût / km', valeur: (i) => indicateur(i.cout_km, 'GNF/km') },
          { libelle: 'Coût / heure', valeur: (i) => indicateur(i.cout_heure, 'GNF/h') },
          { libelle: 'Coût / tonne', valeur: (i) => indicateur(i.cout_tonne, 'GNF/t') },
        ]}
        note="Heures : pointages de l'engin pendant chaque montage ; tonnes : tickets CBG de tous les voyages livrés. Un montage sans donnée rend l'indicateur « données insuffisantes »." />
      <Provenance source="v_pneus_couts_synthese, v_pneus_indicateurs" />
    </div>
  );
};

// ---------------------------------------------------------------- 10. parametrage

interface Configuration { id: string; code: string; libelle: string; modele_engin: string; notes: string | null; actif: boolean; cree_le: string; modifie_le: string | null }
interface PositionConfig { id: string; configuration_id: string; code: string; libelle: string | null; essieu: number | null; cote: string | null; rang: string | null; secours: boolean; dimensions_admises: string[]; ordre: number | null; actif: boolean }
export interface Seuils { id: string; dimension: string | null; marque: string | null; modele: string | null; application: string | null; actif: boolean; motif: string | null; cree_le: string; [k: string]: unknown }
interface Critere { id: string; code: string; libelle: string; bloquant: boolean; dimension: string | null; marque: string | null; modele: string | null; actif: boolean }
interface JournalParam { id: string; objet: string; objet_id: string; action: string; motif: string | null; auteur: string | null; le: string }

const portee = (s: { dimension: string | null; marque: string | null; modele: string | null; application?: string | null }) =>
  [s.dimension && `dimension ${s.dimension}`, s.marque && `marque ${s.marque}`, s.modele && `modèle ${s.modele}`, s.application && `application ${s.application}`].filter(Boolean).join(', ') || 'Toutes';

export const EspaceParametrage = ({ droits }: { droits: DroitsPneus }) => {
  const confs = useLecture<Configuration>(() => supabase.from('pneus_configurations').select('*').order('code'), 'configurations');
  const pos = useLecture<PositionConfig>(() => supabase.from('pneus_configuration_positions').select('*').eq('actif', true).order('ordre'), 'positions');
  const seuils = useLecture<Seuils>(() => supabase.from('pneus_seuils').select('*').eq('actif', true).order('cree_le', { ascending: false }), 'seuils');
  const crit = useLecture<Critere>(() => supabase.from('pneus_criteres_rechapage').select('*').order('code'), 'critères de rechapage');
  const journal = useLecture<JournalParam>(() => supabase.from('pneus_parametres_journal').select('id, objet, objet_id, action, motif, auteur, le').order('le', { ascending: false }).limit(100), 'journal du paramétrage');
  const ecrire = droits.parametrage;
  return (
    <div className="space-y-5">
      <Titre titre="Paramétrage des pneus" sousTitre="Aucune valeur supposée : sans configuration ni seuil, le schéma et les alertes correspondantes restent vides." />
      {!ecrire && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Lecture seule : le paramétrage est réservé à l'administrateur ou à un approbateur de la maintenance à périmètre global.</p>}
      <div className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
        À fournir par le propriétaire : configurations de positions par modèle d'engin (essieux, côtés, jumelage, secours, dimensions admises) ;
        seuils par dimension, marque, modèle ou application ; nombre de rechapages admis et critères d'acceptation des carcasses ;
        décision d'activer les blocages (Paramètres, réglages <code>pneu_*</code>).
      </div>
      <Panneau titre="Configurations de positions par modèle d'engin" action={ecrire ? <a href={routeSaisie('configuration')} className={BOUTON_PRINCIPAL}><Plus className="h-4 w-4" /> Nouvelle configuration</a> : undefined}>
        <Erreur>{[confs.erreur, pos.erreur].filter(Boolean).join(' ')}</Erreur>
        {confs.lignes === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : confs.lignes.length === 0 ? <SansDonnees message="Aucune configuration" detail="Sans configuration, le montage se fait à position libre et le schéma de l'engin n'est pas dessiné." />
            : (
              <ul className="space-y-3">
                {confs.lignes.map((c) => {
                  const p = (pos.lignes ?? []).filter((x) => x.configuration_id === c.id);
                  return (
                    <li key={c.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p><b>{c.code}</b> · {c.libelle} · modèle « {c.modele_engin} » {!c.actif && <Puce teinte="gris">Retirée</Puce>}</p>
                        {ecrire && (
                          <p className="flex gap-3">
                            <a href={routeSaisie('configuration', { code: c.code })} className={LIEN}>{c.actif ? 'Modifier' : 'Réactiver'}</a>
                            {c.actif && <a href={routeActionPneu(`configuration-${c.id}`, 'retirer')} className={LIEN}>Retirer</a>}
                          </p>
                        )}
                      </div>
                      <p className="mt-1 text-stone-600">{p.length} position{p.length > 1 ? 's' : ''} : {p.map((x) => x.code).join(', ') || 'aucune'}</p>
                    </li>
                  );
                })}
              </ul>
            )}
      </Panneau>
      <Panneau titre="Seuils actifs" action={ecrire ? <a href={routeSaisie('seuils')} className={BOUTON_PRINCIPAL}><Plus className="h-4 w-4" /> Nouveaux seuils</a> : undefined}>
        <Erreur>{seuils.erreur}</Erreur>
        {seuils.lignes === null ? <p role="status" className="text-sm text-stone-500">Chargement…</p>
          : seuils.lignes.length === 0 ? <SansDonnees message="Aucun seuil" detail="Sans seuil applicable, aucune alerte de profondeur, pression, usure, délai ou coût n'est levée." />
            : (
              <ul className="space-y-3">
                {seuils.lignes.map((s) => (
                  <li key={s.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p><b>Portée :</b> {portee(s)}</p>
                      {ecrire && (
                        <p className="flex gap-3">
                          <a href={routeSaisie('seuils', { remplace: s.id })} className={LIEN}>Remplacer</a>
                          <a href={routeActionPneu(`seuils-${s.id}`, 'desactiver')} className={LIEN}>Désactiver</a>
                        </p>
                      )}
                    </div>
                    <p className="mt-1 text-stone-600">
                      {CHAMPS_SEUILS.filter(([k]) => s[k] !== null && s[k] !== undefined).map(([k, l, u]) => `${l} : ${nombre(Number(s[k]), u)}`).join(' · ') || 'Aucune valeur'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
      </Panneau>
      <Relation titre="Critères d'acceptation au rechapage" lignes={crit.lignes} erreur={crit.erreur} cle={(c) => c.id}
        vide="Aucun critère : l'envoi au rechapage n'exige alors que le nombre de rechapages admis"
        colonnes={[
          { libelle: 'Code', valeur: (c) => (ecrire ? <a href={routeSaisie('critere', { code: c.code })} className={LIEN}>{c.code}</a> : c.code) },
          { libelle: 'Libellé', valeur: (c) => c.libelle },
          { libelle: 'Bloquant', valeur: (c) => (c.bloquant ? 'Oui' : 'Non') },
          { libelle: 'Portée', valeur: (c) => portee(c) },
          { libelle: 'Actif', valeur: (c) => (c.actif ? 'Oui' : 'Non') },
        ]}
        note={ecrire ? <a href={routeSaisie('critere')} className={LIEN}>Nouveau critère</a> : undefined} />
      <Relation titre="Journal du paramétrage" lignes={journal.lignes} erreur={journal.erreur} vide="Aucune modification" cle={(j) => j.id}
        colonnes={[
          { libelle: 'Le', valeur: (j) => dateHeure(j.le) },
          { libelle: 'Objet', valeur: (j) => j.objet },
          { libelle: 'Action', valeur: (j) => j.action },
          { libelle: 'Motif', valeur: (j) => j.motif ?? '—' },
        ]} />
      <Provenance source="pneus_configurations, pneus_configuration_positions, pneus_seuils, pneus_criteres_rechapage, pneus_parametres_journal" />
    </div>
  );
};

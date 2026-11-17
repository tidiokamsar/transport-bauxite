import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, PenLine, Split, Unlock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { formatNombre } from '../Dashboard/indicateurs';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { Historique } from '../ui/Historique';
import { PageAction } from '../ui/PageAction';
import { Informations, OngletPieces, PageDetail, Relation } from '../ui/PageDetail';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce, ReferentielVide, SansDonnees } from '../ui/Panneau';
import { SANS_SITE } from '../ui/referentiels';
import { fusionnerHistoriques, type EvenementHistorique } from '../ui/evenements';
import { lire, trouver, type Lecture } from '../ui/lecture';
import { useSaisie } from '../ui/pages';
import { poserAnnonce, routeAction, routeDetail, routeListe, routeModifier } from '../ui/routeur';
import type { ColonneListe, FiltreListe } from '../ui/liste';
import type { ShiftHoraire } from './plan';
import type { Ventilation } from './VentilationObjectif';
import { CATEGORIES_CAUSE } from './planAvance';
import {
  COLONNES_OBJECTIF, MODULE_PLANIFICATION, PREFIXE_CLOTURE, STATUTS_OBJECTIF, VUE_PLANIFICATION, erreursObjectif, nombreSaisi, scenarioDepuisRequete,
  type ObjectifVersion, type SaisieObjectif,
} from './objectifs';

// Pages d'un objectif de production et d'une cloture de planification
// (D-023, D-063, D-090, remplacent les fenetres de la planification) :
// registre, fiche, definition et revision (definir_objectif), annulation
// (annuler_objectif), annulation d'une cloture (annuler_cloture_planification).
// Le serveur numerote les versions et exige le motif d'une revision.

const attente = <T,>(): Lecture<T> => ({ lignes: null, erreur: '' });
const jour = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR');
const t = (v: number | null | undefined) => (v === null || v === undefined ? null : `${formatNombre(Number(v))} t`);
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Noms des sites et des shifts, pour les libelles. */
const useNoms = () => {
  const { sites } = useSite();
  const [shifts, setShifts] = useState<ShiftHoraire[]>([]);
  useEffect(() => {
    supabase.from('work_shifts').select('id, display_name, start_time, end_time').eq('is_active', true).order('shift_order')
      .then(({ data }) => setShifts((data ?? []) as ShiftHoraire[]));
  }, []);
  const nomSite = useCallback((id: string) => sites.find((s) => s.id === id)?.name ?? 'Site inconnu', [sites]);
  const nomShift = useCallback((id: string | null) => (id ? `Shift ${shifts.find((s) => s.id === id)?.display_name ?? '?'}` : 'Journée'), [shifts]);
  return { sites, shifts, nomSite, nomShift };
};

const libelleObjectif = (o: Pick<ObjectifVersion, 'site_id' | 'shift_id' | 'date_plan'>, n: ReturnType<typeof useNoms>) =>
  `${n.nomSite(o.site_id)} · ${n.nomShift(o.shift_id)} · ${jour(o.date_plan)}`;

export const RegistreObjectifs = ({ nomSite, nomShift }: { nomSite: (id: string) => string; nomShift: (id: string | null) => string }) => {
  const [lignes, setLignes] = useState<ObjectifVersion[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('objectifs_production').select(COLONNES_OBJECTIF).order('date_plan', { ascending: false }).order('version', { ascending: false }).limit(500);
    setErreur(error ? `Objectifs indisponibles : ${error.message}` : '');
    setLignes(error ? null : ((data ?? []) as ObjectifVersion[]));
    setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const colonnes = useMemo<ColonneListe<ObjectifVersion>[]>(() => [
    { id: 'objectif', libelle: 'Objectif', valeur: (o) => `${nomSite(o.site_id)} · ${nomShift(o.shift_id)}` },
    { id: 'date', libelle: 'Date', valeur: (o) => o.date_plan, rendu: (o) => jour(o.date_plan) },
    { id: 'version', libelle: 'Version', valeur: (o) => o.version, alignement: 'droite' },
    { id: 'tonnes', libelle: 'Objectif (t)', valeur: (o) => Number(o.tonnes_cible), alignement: 'droite', rendu: (o) => t(o.tonnes_cible) },
    { id: 'voyages', libelle: 'Voyages visés', valeur: (o) => o.voyages_cible, alignement: 'droite', masquee: true },
    { id: 'camions', libelle: 'Camions prévus', valeur: (o) => o.camions_prevus, alignement: 'droite', masquee: true },
    { id: 'statut', libelle: 'Statut', valeur: (o) => STATUTS_OBJECTIF[o.statut]?.libelle ?? o.statut,
      rendu: (o) => <Puce teinte={STATUTS_OBJECTIF[o.statut]?.teinte ?? 'gris'}>{STATUTS_OBJECTIF[o.statut]?.libelle ?? o.statut}</Puce> },
    { id: 'motif', libelle: 'Motif', valeur: (o) => o.motif_annulation ?? o.motif, masquee: true },
  ], [nomSite, nomShift]);
  const filtres = useMemo<FiltreListe<ObjectifVersion>[]>(() => [
    { id: 'statut', libelle: 'Statut', options: Object.entries(STATUTS_OBJECTIF).map(([valeur, s]) => ({ valeur, libelle: s.libelle })), correspond: (o, v) => o.statut === v },
    { id: 'site', libelle: 'Site', options: [...new Set((lignes ?? []).map((o) => o.site_id))].map((s) => ({ valeur: s, libelle: nomSite(s) })), correspond: (o, v) => o.site_id === v },
  ], [lignes, nomSite]);

  return (
    <PageListe
      vue={VUE_PLANIFICATION}
      titre="Registre des objectifs"
      sousTitre="Toutes les versions définies, révisées ou annulées (500 plus récentes)"
      lignes={lignes}
      erreur={erreur}
      colonnes={colonnes}
      filtres={filtres}
      cle={(o) => o.id}
      libelleOuverture={(o) => `Fiche de l'objectif ${nomSite(o.site_id)} ${nomShift(o.shift_id)} ${jour(o.date_plan)} version ${o.version}`}
      nomExport="objectifs-production"
      vide={{ message: 'Aucun objectif défini', detail: 'Les objectifs se définissent par date, site de chargement et shift.' }}
      onActualiser={charger}
      provenance={<Provenance source="objectifs_production (versions numérotées par le serveur)" heure={heure} />}
    />
  );
};

export const FormulaireObjectif = ({ id, requete }: { id?: string; requete: Record<string, string> }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('planning', 'create') || hasPermission('planning', 'edit');
  const { siteId } = useSite();
  const n = useNoms();
  const propose = useMemo(() => scenarioDepuisRequete(requete), [requete]);
  const [objectif, setObjectif] = useState<ObjectifVersion | null>(null);
  const [actifs, setActifs] = useState<ObjectifVersion[]>([]);
  const [chargement, setChargement] = useState(Boolean(id));
  const [erreurChargement, setErreurChargement] = useState('');
  const { valeurs: f, poser, modifie, initialiser } = useSaisie<SaisieObjectif>({
    date: requete.date || aujourdhui(), site: requete.site ?? siteId ?? '', shift: requete.shift ?? '', tonnes: '', voyages: '', camions: '', chargeuses: '', motif: '', note: '',
  });

  useEffect(() => {
    if (!id) return;
    lire<ObjectifVersion>(supabase.from('objectifs_production').select(COLONNES_OBJECTIF).eq('id', id), 'objectif').then((r) => {
      const o = trouver(r.lignes, id);
      setObjectif(o);
      setErreurChargement(r.erreur || (!o ? 'Objectif introuvable ou hors de votre périmètre.' : o.statut !== 'actif' ? 'Seul un objectif en vigueur se révise.' : ''));
      if (o) {
        initialiser({
          date: o.date_plan, site: o.site_id, shift: o.shift_id ?? '', motif: '', note: '',
          tonnes: String(propose?.tonnes ?? o.tonnes_cible), voyages: o.voyages_cible?.toString() ?? '',
          camions: (propose?.camions ?? o.camions_prevus)?.toString() ?? '', chargeuses: (propose?.chargeuses ?? o.chargeuses_prevues)?.toString() ?? '',
        });
      }
      setChargement(false);
    });
  }, [id, initialiser, propose]);

  // Definition : un objectif actif deja present pour la meme cle est revise.
  useEffect(() => {
    if (id || !f.date) return;
    supabase.from('objectifs_production').select(COLONNES_OBJECTIF).eq('date_plan', f.date).eq('statut', 'actif')
      .then(({ data }) => setActifs(((data ?? []) as ObjectifVersion[]).filter((o) => o.date_plan === f.date && o.statut === 'actif')));
  }, [id, f.date]);
  const actuel = id ? objectif : actifs.find((o) => o.site_id === f.site && (o.shift_id ?? '') === f.shift) ?? null;
  const revision = Boolean(actuel);

  const erreurs = [...(!peutEcrire ? ['Droit d\'écriture sur la planification requis.'] : []), ...erreursObjectif(f, revision)];
  const sitesProposes = siteId ? n.sites.filter((s) => s.id === siteId) : n.sites;

  const soumettre = async (): Promise<{ erreur: string } | { vers: string }> => {
    const { data, error } = await supabase.rpc('definir_objectif', {
      p_date: f.date, p_site_id: f.site, p_shift_id: f.shift || null, p_tonnes: nombreSaisi(f.tonnes),
      p_voyages: nombreSaisi(f.voyages), p_camions: nombreSaisi(f.camions), p_chargeuses: nombreSaisi(f.chargeuses),
      p_motif: f.motif.trim() || null, p_note: f.note.trim() || null,
    });
    if (error) return { erreur: error.message };
    poserAnnonce(revision ? 'Révision enregistrée : nouvelle version en vigueur, l\'ancienne reste consultable.' : 'Objectif enregistré.');
    return { vers: typeof data === 'string' && data ? routeDetail(VUE_PLANIFICATION, data) : routeListe(VUE_PLANIFICATION) };
  };

  return (
    <PageFormulaire
      vue={VUE_PLANIFICATION}
      module={MODULE_PLANIFICATION}
      titre={actuel ? `Réviser l'objectif (version ${actuel.version + 1})` : 'Définir un objectif'}
      reference={objectif ? libelleObjectif(objectif, n) : undefined}
      id={id}
      description="Objectif de production par date, site de chargement et portée. Une révision crée une nouvelle version ; l'ancienne reste consultable."
      modifie={modifie}
      erreurs={erreurs}
      onSoumettre={soumettre}
      libelleSoumettre={actuel ? 'Enregistrer la révision' : 'Enregistrer l\'objectif'}
      chargement={chargement}
      erreurChargement={erreurChargement}
    >
      {n.sites.length === 0 && <ReferentielVide>{SANS_SITE}</ReferentielVide>}
      {propose && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          Scénario retenu : <b>{propose.titre}</b>. Les valeurs proposées restent modifiables ; le motif explique la décision.
        </p>
      )}
      {actuel && (
        <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
          Objectif en vigueur : <b>{formatNombre(Number(actuel.tonnes_cible))} t</b> (version {actuel.version}). La révision crée une nouvelle version ; l'ancienne reste consultable.
        </p>
      )}
      <SectionFormulaire titre="Portée">
        <ChampPage libelle="Date *"><input type="date" value={f.date} disabled={Boolean(id)} onChange={(e) => poser('date', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Site de chargement *">
          <select value={f.site} disabled={Boolean(id)} onChange={(e) => poser('site', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir un site</option>
            {sitesProposes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Portée" className="sm:col-span-2">
          <select value={f.shift} disabled={Boolean(id)} onChange={(e) => poser('shift', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Journée entière (tous les shifts)</option>
            {n.shifts.map((s) => <option key={s.id} value={s.id}>Shift {s.display_name} ({s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)})</option>)}
          </select>
        </ChampPage>
      </SectionFormulaire>
      <SectionFormulaire titre="Objectif et ressources">
        <ChampPage libelle="Objectif (tonnes) *"><input inputMode="decimal" value={f.tonnes} onChange={(e) => poser('tonnes', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Voyages visés"><input inputMode="numeric" value={f.voyages} onChange={(e) => poser('voyages', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Camions prévus"><input inputMode="numeric" value={f.camions} onChange={(e) => poser('camions', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Chargeuses et pelles prévues"><input inputMode="numeric" value={f.chargeuses} onChange={(e) => poser('chargeuses', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
      </SectionFormulaire>
      <SectionFormulaire titre="Justification">
        <ChampPage libelle={actuel ? 'Motif de la révision (obligatoire)' : 'Motif (obligatoire si un objectif a déjà existé à cette date)'} className="sm:col-span-2">
          <input value={f.motif} onChange={(e) => poser('motif', e.target.value)} className={CHAMP_FENETRE} />
        </ChampPage>
        <ChampPage libelle="Note" className="sm:col-span-2"><textarea value={f.note} onChange={(e) => poser('note', e.target.value)} rows={2} className={CHAMP_FENETRE} /></ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

interface RealisationLue { id: string; tonnes_livrees: number; voyages_livres: number; voyages_en_cours: number; voyages_prevus: number; derniere_livraison: string | null }

export const DetailObjectif = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('planning', 'create') || hasPermission('planning', 'edit');
  const n = useNoms();
  const [objectif, setObjectif] = useState<Lecture<ObjectifVersion>>(attente);
  const [versions, setVersions] = useState<Lecture<ObjectifVersion>>(attente);
  const [realisation, setRealisation] = useState<RealisationLue | null>(null);
  const [ventilations, setVentilations] = useState<Lecture<Ventilation>>(attente);

  useEffect(() => {
    lire<ObjectifVersion>(supabase.from('objectifs_production').select(COLONNES_OBJECTIF).eq('id', id), 'objectif').then((r) => {
      setObjectif(r);
      const o = trouver(r.lignes, id);
      if (!o) return;
      let q = supabase.from('objectifs_production').select(COLONNES_OBJECTIF).eq('date_plan', o.date_plan).eq('site_id', o.site_id).order('version', { ascending: false });
      q = o.shift_id ? q.eq('shift_id', o.shift_id) : q.is('shift_id', null);
      lire<ObjectifVersion>(q, 'versions de l\'objectif')
        .then((v) => setVersions({ ...v, lignes: v.lignes && v.lignes.filter((x) => x.date_plan === o.date_plan && x.site_id === o.site_id && x.shift_id === o.shift_id) }));
      if (o.statut === 'actif') {
        supabase.from('v_realisation_objectifs').select('id, tonnes_livrees, voyages_livres, voyages_en_cours, voyages_prevus, derniere_livraison').eq('id', id)
          .then(({ data }) => setRealisation(((data ?? []) as RealisationLue[]).find((x) => x.id === id) ?? null));
      }
    });
    lire<Ventilation>(supabase.from('v_realisation_ventilation').select('*').eq('objectif_id', id), 'ventilation')
      .then((r) => setVentilations({ ...r, lignes: r.lignes && r.lignes.filter((v) => v.objectif_id === id) }));
  }, [id]);

  const o = trouver(objectif.lignes, id);
  const actif = o?.statut === 'actif';
  const historique: EvenementHistorique[] | null = versions.lignes && fusionnerHistoriques(versions.lignes.flatMap((v) => [
    { id: `objectif-${v.id}`, le: v.cree_le, libelle: `Version ${v.version} définie : ${t(v.tonnes_cible)}${v.voyages_cible ? ` · ${v.voyages_cible} voyages` : ''}`, detail: v.note, motif: v.motif, auteur: v.cree_par, source: 'objectifs_production' },
    ...(v.clos_le ? [{ id: `objectif-clos-${v.id}`, le: v.clos_le, libelle: v.statut === 'annule' ? `Version ${v.version} annulée` : `Version ${v.version} remplacée`, motif: v.motif_annulation, auteur: v.clos_par, source: 'objectifs_production' }] : []),
  ]));

  return (
    <PageDetail
      vue={VUE_PLANIFICATION}
      module={MODULE_PLANIFICATION}
      reference={o ? libelleObjectif(o, n) : 'Objectif'}
      titre={o ? `Objectif ${n.nomSite(o.site_id)} · ${n.nomShift(o.shift_id)}` : undefined}
      statut={o ? { libelle: `${STATUTS_OBJECTIF[o.statut]?.libelle ?? o.statut} · version ${o.version}`, teinte: STATUTS_OBJECTIF[o.statut]?.teinte ?? 'gris' } : null}
      resume={o && <>{jour(o.date_plan)} · {t(o.tonnes_cible)}</>}
      chargement={objectif.lignes === null && !objectif.erreur}
      erreur={objectif.erreur}
      introuvable={objectif.lignes !== null && !o}
      actions={[
        { id: 'reviser', libelle: 'Réviser', icone: <PenLine className="h-4 w-4" />, visible: peutEcrire && actif, ton: 'principal', vers: routeModifier(VUE_PLANIFICATION, id) },
        { id: 'ventiler', libelle: 'Ventiler', icone: <Split className="h-4 w-4" />, visible: peutEcrire && actif && ventilations.lignes !== null && ventilations.lignes.length === 0 && !ventilations.erreur, vers: routeAction(VUE_PLANIFICATION, id, 'ventiler') },
        { id: 'annuler', libelle: 'Annuler l\'objectif', icone: <Ban className="h-4 w-4" />, visible: peutEcrire && actif, ton: 'danger', vers: routeAction(VUE_PLANIFICATION, id, 'annuler') },
      ]}
      onglets={!o ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Objectif', champs: [['Date', jour(o.date_plan)], ['Site de chargement', n.nomSite(o.site_id)], ['Portée', n.nomShift(o.shift_id)],
              ['Version', String(o.version)], ['Statut', STATUTS_OBJECTIF[o.statut]?.libelle ?? o.statut], ['Motif', o.motif], ['Note', o.note],
              ['Motif d\'annulation', o.motif_annulation]] },
            { titre: 'Cible et ressources', champs: [['Objectif', t(o.tonnes_cible)], ['Voyages visés', o.voyages_cible?.toString() ?? null],
              ['Camions prévus', o.camions_prevus?.toString() ?? null], ['Chargeuses et pelles prévues', o.chargeuses_prevues?.toString() ?? null]] },
            { titre: 'Réalisation (version en vigueur)', champs: actif ? [
              ['Livré', realisation ? t(realisation.tonnes_livrees) : null], ['Voyages livrés', realisation ? String(realisation.voyages_livres) : null],
              ['En cours / prévus', realisation ? `${realisation.voyages_en_cours} / ${realisation.voyages_prevus}` : null],
              ['Dernière livraison', realisation?.derniere_livraison ? new Date(realisation.derniere_livraison).toLocaleString('fr-FR') : null],
            ] : [['Réalisation', 'Calculée pour la version en vigueur seulement']] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Relations', contenu: (
          <div className="grid gap-4 lg:grid-cols-2">
            <Relation titre="Ventilation par destination et contrat" lignes={ventilations.lignes} erreur={ventilations.erreur} cle={(v) => v.id}
              vide="Non ventilé : l'objectif vaut pour toutes les destinations et tous les contrats"
              colonnes={[{ libelle: 'Destination', valeur: (v) => (v.destination_id ? n.nomSite(v.destination_id) : 'Toutes') },
                { libelle: 'Contrat', valeur: (v) => (v.contrat_id ? v.contrat_reference ?? 'Contrat non visible' : 'Tous') },
                { libelle: 'Objectif', valeur: (v) => t(v.tonnes_cible) },
                { libelle: 'Livré', valeur: (v) => (v.mesurable && v.tonnes_livrees !== null ? t(v.tonnes_livrees) : 'Non mesurable') }]} />
            <Relation titre="Versions de cet objectif" lignes={versions.lignes} erreur={versions.erreur} cle={(v) => v.id} vide="Aucune version"
              lien={(v) => routeDetail(VUE_PLANIFICATION, v.id)}
              colonnes={[{ libelle: 'Version', valeur: (v) => `Version ${v.version}` }, { libelle: 'Objectif', valeur: (v) => t(v.tonnes_cible) },
                { libelle: 'Statut', valeur: (v) => <Puce teinte={STATUTS_OBJECTIF[v.statut]?.teinte ?? 'gris'}>{STATUTS_OBJECTIF[v.statut]?.libelle ?? v.statut}</Puce> },
                { libelle: 'Définie le', valeur: (v) => new Date(v.cree_le).toLocaleString('fr-FR') }]} />
          </div>
        ) },
        { id: 'historique', libelle: 'Historique', contenu: (
          <Historique evenements={historique} erreur={versions.erreur} source="objectifs_production (versions de la même date, du même site et de la même portée)" />
        ) },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="un objectif de production" /> },
      ]}
    />
  );
};

export const ActionObjectif = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('planning', 'create') || hasPermission('planning', 'edit');
  const n = useNoms();
  const [o, setO] = useState<ObjectifVersion | null>(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  useEffect(() => {
    lire<ObjectifVersion>(supabase.from('objectifs_production').select(COLONNES_OBJECTIF).eq('id', id), 'objectif').then((r) => {
      const x = trouver(r.lignes, id);
      setO(x);
      setErreur(r.erreur || (x ? '' : 'Objectif introuvable ou hors de votre périmètre.'));
      setChargement(false);
    });
  }, [id]);
  if (action !== 'annuler') return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'un objectif.`} />;
  return (
    <PageAction
      vue={VUE_PLANIFICATION}
      module={MODULE_PLANIFICATION}
      reference={o ? libelleObjectif(o, n) : 'Objectif'}
      id={id}
      titre="Annuler l'objectif"
      description={o && <>{libelleObjectif(o, n)} : {t(o.tonnes_cible)}. L'objectif reste dans l'historique avec son motif d'annulation.</>}
      motif="obligatoire"
      motifMinimum={1}
      libelleConfirmer="Annuler l'objectif"
      danger
      interdit={!peutEcrire ? 'Droit d\'écriture sur la planification requis.' : o && o.statut !== 'actif' ? 'Seul un objectif en vigueur s\'annule.' : null}
      chargement={chargement}
      erreurChargement={erreur}
      messageSucces="Objectif annulé."
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc('annuler_objectif', { p_id: id, p_motif: motif });
        return error ? error.message : null;
      }}
    />
  );
};

interface Cloture {
  id: string; date_plan: string; site_id: string; statut: 'close' | 'annulee'; tonnes_cible: number | null; tonnes_livrees: number | null; ecart: number | null;
  bilan: { perimetre?: string | null; tonnes_livrees_site?: number | null } | null; commentaire: string | null;
  cloture_par: string | null; cloture_le: string; annule_par: string | null; annule_le: string | null; motif_annulation: string | null;
}
interface Cause { id: string; cloture_id: string; categorie: string; description: string; tonnes_impact: number | null }
const COLONNES_CLOTURE = 'id, date_plan, site_id, statut, tonnes_cible, tonnes_livrees, ecart, bilan, commentaire, cloture_par, cloture_le, annule_par, annule_le, motif_annulation';

const useCloture = (id: string) => {
  const [cloture, setCloture] = useState<Lecture<Cloture>>(attente);
  useEffect(() => { lire<Cloture>(supabase.from('clotures_planification').select(COLONNES_CLOTURE).eq('id', id), 'clôture').then(setCloture); }, [id]);
  return { cloture, c: trouver(cloture.lignes, id) };
};

export const DetailCloture = ({ id }: { id: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('planning', 'create') || hasPermission('planning', 'edit');
  const n = useNoms();
  const { cloture, c } = useCloture(id);
  const [causes, setCauses] = useState<Lecture<Cause>>(attente);
  useEffect(() => {
    lire<Cause>(supabase.from('clotures_planification_causes').select('id, cloture_id, categorie, description, tonnes_impact').eq('cloture_id', id).order('saisi_le'), 'causes')
      .then((r) => setCauses({ ...r, lignes: r.lignes && r.lignes.filter((x) => x.cloture_id === id) }));
  }, [id]);
  const ref = `${PREFIXE_CLOTURE}${id}`;
  const reference = c ? `Clôture ${n.nomSite(c.site_id)} · ${jour(c.date_plan)}` : 'Clôture';
  const historique: EvenementHistorique[] | null = c ? fusionnerHistoriques([
    { id: 'cloture', le: c.cloture_le, libelle: `Journée clôturée : bilan figé (${t(c.tonnes_livrees) ?? 'sans données'} livrées)`, detail: c.commentaire, auteur: c.cloture_par, source: 'clotures_planification' },
    ...(c.annule_le ? [{ id: 'annulation', le: c.annule_le, libelle: 'Clôture annulée', motif: c.motif_annulation, auteur: c.annule_par, source: 'clotures_planification' }] : []),
  ]) : null;
  return (
    <PageDetail
      vue={VUE_PLANIFICATION}
      module={MODULE_PLANIFICATION}
      reference={reference}
      statut={c ? (c.statut === 'close' ? { libelle: 'Close', teinte: 'vert' } : { libelle: 'Annulée', teinte: 'gris' }) : null}
      chargement={cloture.lignes === null && !cloture.erreur}
      erreur={cloture.erreur}
      introuvable={cloture.lignes !== null && !c}
      actions={[{ id: 'annuler', libelle: 'Annuler la clôture', icone: <Unlock className="h-4 w-4" />, visible: peutEcrire && c?.statut === 'close', ton: 'danger', vers: routeAction(VUE_PLANIFICATION, ref, 'annuler') }]}
      onglets={!c ? [] : [
        { id: 'informations', libelle: 'Informations', contenu: (
          <Informations groupes={[
            { titre: 'Journée', champs: [['Date', jour(c.date_plan)], ['Site', n.nomSite(c.site_id)], ['Statut', c.statut === 'close' ? 'Close' : 'Annulée'], ['Commentaire', c.commentaire]] },
            { titre: 'Bilan figé', champs: [['Planifié', t(c.tonnes_cible)], ['Réalisé', t(c.tonnes_livrees)], ['Écart', t(c.ecart)],
              ['Périmètre', c.bilan?.perimetre ?? null], ['Tout le site', t(c.bilan?.tonnes_livrees_site)], ['Motif d\'annulation', c.motif_annulation]] },
          ]} />
        ) },
        { id: 'relations', libelle: 'Causes', compte: causes.lignes?.length ?? null, contenu: (
          <Relation titre="Causes d'écart" lignes={causes.lignes} erreur={causes.erreur} cle={(x) => x.id} vide="Aucune cause saisie"
            colonnes={[{ libelle: 'Catégorie', valeur: (x) => CATEGORIES_CAUSE[x.categorie] ?? x.categorie }, { libelle: 'Description', valeur: (x) => x.description },
              { libelle: 'Tonnes perdues', valeur: (x) => t(x.tonnes_impact) ?? '—' }]} />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: <Historique evenements={historique} source="clotures_planification (clôture et annulation horodatées)" /> },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="une clôture de planification" /> },
      ]}
    />
  );
};

export const ActionCloture = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission } = useAuth();
  const peutEcrire = hasPermission('planning', 'create') || hasPermission('planning', 'edit');
  const n = useNoms();
  const { cloture, c } = useCloture(id);
  if (action !== 'annuler') return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action d'une clôture.`} />;
  return (
    <PageAction
      vue={VUE_PLANIFICATION}
      module={MODULE_PLANIFICATION}
      reference={c ? `Clôture ${n.nomSite(c.site_id)} · ${jour(c.date_plan)}` : 'Clôture'}
      id={`${PREFIXE_CLOTURE}${id}`}
      titre="Annuler la clôture"
      description="La clôture reste dans l'historique avec son motif ; les objectifs redeviennent modifiables."
      motif="obligatoire"
      motifMinimum={1}
      libelleConfirmer="Annuler la clôture"
      danger
      interdit={!peutEcrire ? 'Droit d\'écriture sur la planification requis.' : c && c.statut !== 'close' ? 'Clôture déjà annulée.' : null}
      chargement={cloture.lignes === null && !cloture.erreur}
      erreurChargement={cloture.erreur || (cloture.lignes !== null && !c ? 'Clôture introuvable.' : '')}
      messageSucces="Clôture annulée : les objectifs du site redeviennent modifiables."
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc('annuler_cloture_planification', { p_id: id, p_motif: motif });
        return error ? error.message : null;
      }}
    />
  );
};

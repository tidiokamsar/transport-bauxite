import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce, ReferentielVide } from '../ui/Panneau';
import { SANS_SHIFT, SANS_SITE } from '../ui/referentiels';
import { LienVue } from '../ui/LienVue';
import { useSaisie } from '../ui/pages';
import { lire } from '../ui/lecture';
import { naviguer, poserAnnonce, routeDetail, routeListe, useRoute } from '../ui/routeur';
import { avecContexte, contexteDepuisRequete, dateDuContexte } from '../Operations/journal';
import { TYPES_FICHE, type TypeFiche } from './fiches';
import { ETATS_FICHE, VUE_FICHES, routeLot, tableauDeBordFiches } from './cycleFiche';

// Fiches terrain au standard (D-090, D-088 suite) sur l'API du cycle D-089
// (migration 20261121215000) : tableau de bord du jour, liste filtree,
// actions groupees (impression, remise, retour), preparation en pleine page
// (generation des FR depuis le Dispatch, FP par engin, FC par cuve).

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface FicheListe {
  id: string; numero: string; type: TypeFiche; date_fiche: string; site_id: string; shift_id: string | null; vehicle_id: string | null;
  driver_id: string | null; stockage_id: string | null; agent: string | null; etat: string; version: number; nb_impressions: number | null;
}
const COLONNES = 'id, numero, type, date_fiche, site_id, shift_id, vehicle_id, driver_id, stockage_id, agent, etat, version, nb_impressions';

interface Nom { id: string; libelle: string }
const useReferentiels = () => {
  const [r, setR] = useState<{ shifts: Nom[]; engins: (Nom & { type: string; site_id: string | null })[]; chauffeurs: Nom[]; cuves: (Nom & { site_id: string })[]; shiftsLus: boolean }>(
    { shifts: [], engins: [], chauffeurs: [], cuves: [], shiftsLus: false });
  useEffect(() => {
    Promise.all([
      supabase.from('work_shifts').select('id, display_name').eq('is_active', true).order('shift_order'),
      supabase.from('vehicles').select('id, registration, vehicle_type, site_id').order('registration'),
      supabase.from('drivers').select('id, name').order('name'),
      supabase.from('stockages_carburant').select('id, code, libelle, site_id').order('code'),
    ]).then(([s, v, d, c]) => setR({
      shifts: ((s.data ?? []) as { id: string; display_name: string }[]).map((x) => ({ id: x.id, libelle: x.display_name })),
      engins: ((v.data ?? []) as { id: string; registration: string; vehicle_type: string; site_id: string | null }[]).map((x) => ({ id: x.id, libelle: x.registration, type: x.vehicle_type, site_id: x.site_id })),
      chauffeurs: ((d.data ?? []) as { id: string; name: string }[]).map((x) => ({ id: x.id, libelle: x.name })),
      cuves: ((c.data ?? []) as { id: string; code: string; libelle: string; site_id: string }[]).map((x) => ({ id: x.id, libelle: `${x.code} ${x.libelle}`, site_id: x.site_id })),
      shiftsLus: !s.error,
    }));
  }, []);
  return r;
};

/** Site de travail : contexte de l'adresse, puis site choisi, puis premiere mine. */
const useSiteFiches = () => {
  const route = useRoute();
  const { siteId, sites } = useSite();
  const ctx = contexteDepuisRequete(route.requete);
  const [site, setSite] = useState('');
  useEffect(() => {
    if (siteId) setSite(siteId);
    else if (!site && ctx.site && sites.some((s) => s.id === ctx.site)) setSite(ctx.site);
    else if (!site && sites.length > 0) setSite((sites.find((s) => s.type === 'mine') ?? sites[0]).id);
  }, [siteId, sites, site, ctx.site]);
  return { site, setSite, verrouille: Boolean(siteId) };
};

export const ListeFiches = () => {
  const { hasPermission } = useAuth();
  const { sites, aucunSite } = useSite();
  const route = useRoute();
  const ctx = contexteDepuisRequete(route.requete);
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('maintenance', 'create') || hasPermission('fuel', 'create');
  const [date, setDate] = useState(() => dateDuContexte(aujourdhui));
  const { site, setSite, verrouille } = useSiteFiches();
  const ref = useReferentiels();
  const [fiches, setFiches] = useState<FicheListe[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [camionsSansFr, setCamionsSansFr] = useState<number | null>(null);
  const [heure, setHeure] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    if (!site) { setFiches(aucunSite ? [] : null); return; }
    const [f, v] = await Promise.all([
      lire<FicheListe>(supabase.from('fiches_terrain').select(COLONNES).eq('date_fiche', date).eq('site_id', site).order('numero'), 'fiches'),
      lire<{ vehicle_id: string | null; etat: string | null }>(supabase.from('trips').select('vehicle_id, etat').eq('planned_date', date).eq('departure_site_id', site), 'voyages'),
    ]);
    setFiches(f.lignes); setErreur(f.erreur); setHeure(new Date());
    if (f.lignes && v.lignes) {
      const avecFr = new Set(f.lignes.filter((x) => x.type === 'rotations' && x.etat !== 'annulee').map((x) => x.vehicle_id));
      setCamionsSansFr(new Set(v.lignes.filter((x) => x.vehicle_id && !['CANCELLED', 'REJECTED'].includes(x.etat ?? '') && !avecFr.has(x.vehicle_id)).map((x) => x.vehicle_id)).size);
    } else setCamionsSansFr(null);
  }, [date, site, aucunSite]);
  useEffect(() => { charger(); }, [charger]);

  const nom = (l: Nom[], id: string | null) => (id ? l.find((x) => x.id === id)?.libelle ?? null : null);
  const tableau = useMemo(() => tableauDeBordFiches(fiches ?? []), [fiches]);
  const contexte = { ...ctx, date, site };
  const vers = (action: string, lignes: FicheListe[]) => naviguer(avecContexte(routeLot(action, lignes.map((l) => l.id)), contexte));

  return (
    <PageListe<FicheListe>
      vue={VUE_FICHES}
      titre="Fiches terrain"
      sousTitre="Préparer, imprimer, remettre aux agents, recevoir, saisir, contrôler et valider (cycle D-089)"
      lignes={fiches}
      erreur={erreur}
      cle={(f) => f.id}
      libelleOuverture={(f) => `Fiche ${f.numero}`}
      ouvrir={(f) => naviguer(avecContexte(routeDetail(VUE_FICHES, f.id), contexte))}
      actions={peutEcrire && site ? (
        <a href={avecContexte('#/fiches/nouveau', contexte)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white shadow">
          <Plus className="h-4 w-4" /> Préparer des fiches
        </a>
      ) : undefined}
      actionsGroupees={peutEcrire ? [
        { id: 'imprimer', libelle: 'Imprimer', executer: (l) => vers('imprimer', l) },
        { id: 'remettre', libelle: 'Remettre à l\'agent', executer: (l) => vers('remettre', l) },
        { id: 'retour', libelle: 'Enregistrer le retour', executer: (l) => vers('retour', l) },
      ] : undefined}
      synthese={(
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" />
            <select value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site" disabled={verrouille || sites.length === 0} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
              {sites.length === 0 && <option value="">Aucun site</option>}
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {aucunSite && <ReferentielVide>{SANS_SITE} Les fiches se préparent ensuite pour ce site.</ReferentielVide>}
          {!aucunSite && ref.shiftsLus && ref.shifts.length === 0 && <ReferentielVide>{SANS_SHIFT} <LienVue vue="shifts">Ouvrir la gestion des shifts</LienVue></ReferentielVide>}
          {fiches && fiches.length > 0 && (
            <section aria-label="Tableau de bord des fiches" className="flex flex-wrap gap-2">
              {tableau.map((t) => <Puce key={t.cle} teinte={t.teinte}>{t.libelle} : {t.nombre}</Puce>)}
            </section>
          )}
          {camionsSansFr !== null && camionsSansFr > 0 && (
            <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{camionsSansFr} camion(s) avec des voyages du jour sans fiche de rotations.</p>
          )}
        </div>
      )}
      colonnes={[
        { id: 'numero', libelle: 'Numéro', valeur: (f) => f.numero, rendu: (f) => <span className="font-mono font-bold">{f.numero}</span> },
        { id: 'type', libelle: 'Type', valeur: (f) => TYPES_FICHE[f.type]?.libelle ?? f.type },
        { id: 'engin', libelle: 'Camion, engin ou cuve', valeur: (f) => nom(ref.engins, f.vehicle_id) ?? nom(ref.cuves, f.stockage_id) },
        { id: 'chauffeur', libelle: 'Chauffeur', valeur: (f) => nom(ref.chauffeurs, f.driver_id) },
        { id: 'shift', libelle: 'Shift', valeur: (f) => nom(ref.shifts, f.shift_id) },
        { id: 'agent', libelle: 'Agent', valeur: (f) => f.agent },
        { id: 'etat', libelle: 'État', valeur: (f) => ETATS_FICHE[f.etat]?.libelle ?? f.etat, rendu: (f) => <Puce teinte={ETATS_FICHE[f.etat]?.teinte ?? 'gris'}>{ETATS_FICHE[f.etat]?.libelle ?? f.etat}</Puce> },
        { id: 'impressions', libelle: 'Impressions', valeur: (f) => f.nb_impressions ?? 0, masquee: true },
        { id: 'version', libelle: 'Version', valeur: (f) => f.version, masquee: true },
      ]}
      filtres={[
        { id: 'type', libelle: 'Type', options: (Object.keys(TYPES_FICHE) as TypeFiche[]).map((t) => ({ valeur: t, libelle: TYPES_FICHE[t].libelle })), correspond: (f, v) => f.type === v },
        { id: 'etat', libelle: 'État', options: Object.entries(ETATS_FICHE).map(([k, e]) => ({ valeur: k, libelle: e.libelle })), correspond: (f, v) => f.etat === v },
        { id: 'shift', libelle: 'Shift', options: ref.shifts.map((s) => ({ valeur: s.id, libelle: s.libelle })), correspond: (f, v) => f.shift_id === v },
      ]}
      nomExport={`fiches-${date}`}
      vide={{ message: 'Aucune fiche', detail: 'Aucune fiche à cette date pour ce site.' }}
      provenance={<Provenance source="fiches_terrain (cycle D-089), voyages du jour" heure={heure} />}
      onActualiser={charger}
    />
  );
};

interface SaisiePreparation extends Record<string, unknown> { type: TypeFiche; shift: string; regle: string; engin: string; cuve: string; agent: string }

/** Preparation en pleine page : FR generees depuis le Dispatch, FP par engin, FC par cuve. */
export const PreparationFiches = () => {
  const route = useRoute();
  const ctx = contexteDepuisRequete(route.requete);
  const { sites } = useSite();
  const { site, setSite, verrouille } = useSiteFiches();
  const [date, setDate] = useState(() => dateDuContexte(aujourdhui));
  const ref = useReferentiels();
  const { valeurs, poser, modifie } = useSaisie<SaisiePreparation>({ type: 'rotations', shift: ctx.shift ?? '', regle: 'camion_shift', engin: '', cuve: '', agent: '' });
  useEffect(() => { if (!valeurs.shift && ref.shifts[0]) poser('shift', ref.shifts[0].id); }, [ref.shifts, valeurs.shift, poser]);
  const erreurs: string[] = [];
  if (!site) erreurs.push('Site requis');
  if (!date) erreurs.push('Date requise');
  if (valeurs.type === 'rotations' && valeurs.regle === 'camion_shift' && !valeurs.shift) erreurs.push('Shift requis pour la règle « un camion par shift »');
  if (valeurs.type === 'carburant' && !valeurs.cuve) erreurs.push('Cuve requise pour une fiche carburant');
  const engins = ref.engins.filter((e) => ['loader', 'excavator'].includes(e.type) && (e.site_id === null || e.site_id === site));
  const cuves = ref.cuves.filter((c) => c.site_id === site);

  return (
    <PageFormulaire vue={VUE_FICHES} module="Fiches terrain" titre="Préparer des fiches"
      description="Les fiches de rotations sont générées depuis les voyages du Dispatch (une par camion et par période, préremplies, sans doublon). Les fiches de pointage portent sur un engin, les fiches carburant sur une cuve."
      modifie={modifie} erreurs={erreurs} libelleSoumettre={valeurs.type === 'rotations' ? 'Générer les fiches de rotations' : 'Créer la fiche'}
      onSoumettre={async () => {
        const commun = { p_date: date, p_site_id: site, p_shift_id: valeurs.shift || null, p_agent: valeurs.agent.trim() || null };
        if (valeurs.type === 'rotations') {
          const { data, error } = await supabase.rpc('generer_fiches_rotation', { ...commun, p_regle: valeurs.regle });
          if (error) return { erreur: error.message };
          const lignes = (data ?? []) as { fiche_id: string; creee: boolean }[];
          const crees = lignes.filter((l) => l.creee).map((l) => l.fiche_id);
          poserAnnonce(`${crees.length} fiche(s) créée(s), ${lignes.length - crees.length} déjà existante(s).`);
          return { vers: crees.length ? avecContexte(routeLot('imprimer', crees), { date, site }) : avecContexte(routeListe(VUE_FICHES), { date, site }) };
        }
        const { data, error } = await supabase.rpc('creer_fiche', {
          p_type: valeurs.type, ...commun, p_vehicle_id: valeurs.type === 'pointage_engins' ? valeurs.engin || null : null,
          p_stockage_id: valeurs.type === 'carburant' ? valeurs.cuve : null,
        });
        if (error) return { erreur: error.message };
        poserAnnonce('Fiche créée.');
        return { vers: routeDetail(VUE_FICHES, data as string) };
      }}>
      <SectionFormulaire titre="Fiche">
        <ChampPage libelle="Type de fiche *">
          <select value={valeurs.type} onChange={(e) => poser('type', e.target.value as TypeFiche)} className={CHAMP_FENETRE}>
            {(Object.keys(TYPES_FICHE) as TypeFiche[]).map((t) => <option key={t} value={t}>{TYPES_FICHE[t].libelle}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Date d'opération *"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
        <ChampPage libelle="Site *">
          <select value={site} onChange={(e) => setSite(e.target.value)} disabled={verrouille} className={CHAMP_FENETRE}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </ChampPage>
        <ChampPage libelle="Shift">
          <select value={valeurs.shift} onChange={(e) => poser('shift', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Aucun</option>
            {ref.shifts.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
          </select>
        </ChampPage>
        {valeurs.type === 'rotations' && (
          <ChampPage libelle="Règle de préparation">
            <select value={valeurs.regle} onChange={(e) => poser('regle', e.target.value)} className={CHAMP_FENETRE}>
              <option value="camion_shift">Une fiche par camion et par shift</option>
              <option value="camion_jour">Une fiche par camion et par jour</option>
            </select>
          </ChampPage>
        )}
        {valeurs.type === 'pointage_engins' && (
          <ChampPage libelle="Engin" aide="Vide : fiche commune aux engins du site.">
            <select value={valeurs.engin} onChange={(e) => poser('engin', e.target.value)} className={CHAMP_FENETRE}>
              <option value="">Tous les engins du site</option>
              {engins.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
            </select>
          </ChampPage>
        )}
        {valeurs.type === 'carburant' && (
          <ChampPage libelle="Cuve *" aide={cuves.length === 0 ? 'Aucune cuve sur ce site : à créer dans Carburant.' : undefined}>
            <select value={valeurs.cuve} onChange={(e) => poser('cuve', e.target.value)} className={CHAMP_FENETRE}>
              <option value="">Choisir</option>
              {cuves.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
          </ChampPage>
        )}
        <ChampPage libelle="Agent prévu"><input value={valeurs.agent} onChange={(e) => poser('agent', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
      </SectionFormulaire>
    </PageFormulaire>
  );
};

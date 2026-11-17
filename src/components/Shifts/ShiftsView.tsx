import { useCallback, useEffect, useState } from 'react';
import { Moon, Plus, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { Historique } from '../ui/Historique';
import { PageAction } from '../ui/PageAction';
import { Informations, OngletPieces, PageDetail } from '../ui/PageDetail';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { PageListe } from '../ui/PageListe';
import { Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { useSaisie } from '../ui/pages';
import { lire, trouver } from '../ui/lecture';
import { poserAnnonce, routeAction, routeDetail, routeModifier, routeNouveau, useRoute } from '../ui/routeur';
import type { EvenementHistorique } from '../ui/evenements';
import { dureeMinutes, erreurSaisieShift, estDeNuit, type SaisieShift, type Shift } from './shifts';

// Shifts (D-078) en pages standard (D-090, D-088 suite) : liste, fiche avec
// historique (journal_shifts), creation et modification en pleine page
// (definir_shift, motif obligatoire pour modifier), desactivation motivee
// en page d'action (desactiver_shift). Droit settings ou administrateur sur
// un profil sans site ; un shift n'est jamais supprime.

const VUE = 'shifts';
const MODULE = 'Shifts';
const COLONNES = 'id, name, display_name, start_time, end_time, shift_order, is_active';
const hm = (t: string) => t.slice(0, 5);
const ACTIONS: Record<string, string> = { creation: 'Création', modification: 'Modification', desactivation: 'Désactivation', reactivation: 'Réactivation' };

const usePeutEcrire = () => {
  const { hasPermission, profile } = useAuth();
  return (hasPermission('settings', 'edit') || hasPermission('settings', 'create') || profile?.role === 'admin') && !profile?.site_id;
};

const useShifts = () => {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [heure, setHeure] = useState<Date | null>(null);
  const charger = useCallback(async () => {
    const r = await lire<Shift>(supabase.from('work_shifts').select(COLONNES).order('shift_order'), 'shifts');
    setShifts(r.lignes); setErreur(r.erreur); setHeure(new Date());
  }, []);
  useEffect(() => { charger(); }, [charger]);
  return { shifts, erreur, heure, charger };
};

const Horaires = ({ s }: { s: Shift }) => (
  <span className="inline-flex items-center gap-1">
    {estDeNuit(s.start_time, s.end_time) ? <Moon className="h-4 w-4 text-stone-400" /> : <Sun className="h-4 w-4 text-orange-400" />}
    {hm(s.start_time)} – {hm(s.end_time)}
  </span>
);

const ListeShifts = () => {
  const peutEcrire = usePeutEcrire();
  const { shifts, erreur, heure, charger } = useShifts();
  return (
    <PageListe<Shift>
      vue={VUE} titre="Shifts" sousTitre="Horaires de travail communs à tous les sites ; un shift utilisé se désactive, il ne se supprime pas"
      lignes={shifts} erreur={erreur} cle={(s) => s.id} libelleOuverture={(s) => `Shift ${s.display_name}`}
      actions={peutEcrire ? (
        <a href={routeNouveau(VUE)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> Nouveau shift
        </a>
      ) : undefined}
      synthese={!peutEcrire ? (
        <p role="note" className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
          Lecture seule : la création et la modification des shifts demandent le droit Paramètres sur un profil sans site.
        </p>
      ) : undefined}
      colonnes={[
        { id: 'ordre', libelle: 'Ordre', valeur: (s) => s.shift_order },
        { id: 'shift', libelle: 'Shift', valeur: (s) => s.display_name, rendu: (s) => <><b>{s.display_name}</b> <span className="text-xs text-stone-400">{s.name}</span></> },
        { id: 'horaires', libelle: 'Horaires', valeur: (s) => `${hm(s.start_time)}-${hm(s.end_time)}`, rendu: (s) => <Horaires s={s} /> },
        { id: 'statut', libelle: 'Statut', valeur: (s) => (s.is_active ? 'Actif' : 'Inactif'), rendu: (s) => <Puce teinte={s.is_active ? 'vert' : 'gris'}>{s.is_active ? 'Actif' : 'Inactif'}</Puce> },
      ]}
      filtres={[{ id: 'statut', libelle: 'Statut', options: [{ valeur: 'actif', libelle: 'Actifs' }, { valeur: 'inactif', libelle: 'Inactifs' }], correspond: (s, v) => (v === 'actif') === Boolean(s.is_active) }]}
      nomExport="shifts"
      vide={{ message: 'Aucun shift', detail: 'Créez au moins un shift (par exemple Jour et Nuit) pour planifier, dispatcher, ouvrir les postes et préparer les fiches.' }}
      provenance={<Provenance source="work_shifts (D-078)" heure={heure} />}
      onActualiser={charger}
    />
  );
};

interface Ligne { id: string; action: string; motif: string | null; auteur: string | null; le: string }

const DetailShift = ({ id }: { id: string }) => {
  const peutEcrire = usePeutEcrire();
  const { shifts, erreur } = useShifts();
  const [journal, setJournal] = useState<EvenementHistorique[] | null>(null);
  const [erreurJournal, setErreurJournal] = useState('');
  useEffect(() => {
    lire<Ligne>(supabase.from('journal_shifts').select('id, action, motif, auteur, le').eq('shift_id', id).order('le', { ascending: false }), 'journal des shifts')
      .then((r) => {
        setJournal(r.lignes ? r.lignes.map((j) => ({ id: j.id, le: j.le, libelle: ACTIONS[j.action] ?? j.action, motif: j.motif, auteur: j.auteur, source: 'journal_shifts' })) : null);
        setErreurJournal(r.erreur);
      });
  }, [id]);
  const s = trouver(shifts, id);
  return (
    <PageDetail
      vue={VUE} module={MODULE} reference={s?.display_name ?? 'Shift'} titre={s ? `Shift ${s.display_name}` : undefined}
      statut={s ? { libelle: s.is_active ? 'Actif' : 'Inactif', teinte: s.is_active ? 'vert' : 'gris' } : null}
      chargement={shifts === null && !erreur} erreur={erreur} introuvable={shifts !== null && !s}
      actions={[
        { id: 'modifier', libelle: 'Modifier', visible: peutEcrire, vers: routeModifier(VUE, id), ton: 'principal' },
        { id: 'desactiver', libelle: 'Désactiver', visible: peutEcrire && Boolean(s?.is_active), vers: routeAction(VUE, id, 'desactiver'), ton: 'danger' },
      ]}
      onglets={[
        { id: 'informations', libelle: 'Informations', contenu: s && (
          <Informations groupes={[{ titre: 'Shift', champs: [['Libellé affiché', s.display_name], ['Nom technique', s.name], ['Ordre', s.shift_order],
            ['Horaires', <Horaires key="h" s={s} />], ['Durée (min)', dureeMinutes(s.start_time, s.end_time)], ['Statut', s.is_active ? 'Actif' : 'Inactif']] }]} />
        ) },
        { id: 'historique', libelle: 'Historique', contenu: <Historique evenements={journal} erreur={erreurJournal} source="journal_shifts (append-only, D-078)" /> },
        { id: 'pieces', libelle: 'Pièces jointes', contenu: <OngletPieces objetType={null} objetId={id} peutDeposer={false} libelleObjet="les shifts" /> },
      ]}
    />
  );
};

const vide = (ordre: number): SaisieShift => ({ nom: '', libelle: '', debut: '', fin: '', ordre: String(ordre), actif: true });

const FormulaireShift = ({ id }: { id?: string }) => {
  const peutEcrire = usePeutEcrire();
  const { shifts, erreur } = useShifts();
  const existant = id ? trouver(shifts, id) : null;
  const { valeurs, poser, modifie, initialiser } = useSaisie<SaisieShift & { motif: string } & Record<string, unknown>>({ ...vide(1), motif: '' });
  useEffect(() => {
    if (!shifts) return;
    if (existant) initialiser({ nom: existant.name, libelle: existant.display_name, debut: hm(existant.start_time), fin: hm(existant.end_time), ordre: String(existant.shift_order), actif: Boolean(existant.is_active), motif: '' });
    else if (!id) initialiser({ ...vide(Math.max(0, ...shifts.map((s) => s.shift_order)) + 1), motif: '' });
  }, [shifts, existant, id, initialiser]);
  if (!peutEcrire) return <SansDonnees message="Action impossible" detail="La création et la modification des shifts demandent le droit Paramètres sur un profil sans site." />;
  const autres = (shifts ?? []).filter((s) => s.id !== id);
  const erreurs = [erreurSaisieShift(valeurs, autres), id && valeurs.motif.trim().length < 3 ? 'Motif obligatoire pour modifier un shift' : null].filter((x): x is string => Boolean(x));
  const champ = (cle: keyof SaisieShift, libelle: string, type = 'text') => (
    <ChampPage libelle={libelle}><input type={type} value={String(valeurs[cle])} onChange={(e) => poser(cle, e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
  );
  return (
    <PageFormulaire vue={VUE} module={MODULE} titre={id ? `Modifier le shift ${existant?.display_name ?? ''}`.trim() : 'Nouveau shift'}
      reference={existant?.display_name} id={id} modifie={modifie} erreurs={erreurs} chargement={shifts === null && !erreur} erreurChargement={erreur || (id && shifts && !existant ? 'Shift introuvable.' : '')}
      libelleSoumettre="Enregistrer le shift"
      description={valeurs.debut && valeurs.fin && estDeNuit(valeurs.debut, valeurs.fin) ? `Shift de nuit : il se termine le lendemain (${dureeMinutes(valeurs.debut, valeurs.fin)} min).` : 'Un shift utilisé (postes, objectifs, voyages, fiches) ne change plus d\'heures : le désactiver et en créer un nouveau.'}
      onSoumettre={async () => {
        const { data, error } = await supabase.rpc('definir_shift', {
          p_id: id ?? null, p_nom: valeurs.nom.trim(), p_libelle: valeurs.libelle.trim(), p_debut: valeurs.debut, p_fin: valeurs.fin,
          p_ordre: Number(valeurs.ordre), p_actif: valeurs.actif, p_motif: valeurs.motif.trim() || null,
        });
        if (error) return { erreur: error.message };
        poserAnnonce(id ? 'Shift modifié.' : 'Shift créé : il est proposé dans la planification, le dispatch, les postes et les fiches.');
        const nouvelId = id ?? (typeof data === 'string' ? data : null);
        return { vers: nouvelId ? routeDetail(VUE, nouvelId) : '#/shifts' };
      }}>
      <SectionFormulaire titre="Shift">
        {champ('libelle', 'Libellé affiché *')}
        {champ('nom', 'Nom technique *')}
        {champ('ordre', 'Ordre d\'affichage *')}
        {champ('debut', 'Heure de début *', 'time')}
        {champ('fin', 'Heure de fin *', 'time')}
        <ChampPage libelle="Statut">
          <span className="flex items-center gap-2"><input type="checkbox" checked={valeurs.actif} onChange={(e) => poser('actif', e.target.checked)} /> Actif</span>
        </ChampPage>
        {id && <ChampPage libelle="Motif de la modification *" className="sm:col-span-2"><input value={valeurs.motif} onChange={(e) => poser('motif', e.target.value)} className={CHAMP_FENETRE} /></ChampPage>}
      </SectionFormulaire>
    </PageFormulaire>
  );
};

const DesactiverShift = ({ id }: { id: string }) => {
  const peutEcrire = usePeutEcrire();
  const { shifts, erreur } = useShifts();
  const s = trouver(shifts, id);
  return (
    <PageAction vue={VUE} module={MODULE} reference={s?.display_name ?? 'Shift'} id={id} titre={`Désactiver le shift ${s?.display_name ?? ''}`.trim()}
      description="Le shift n'est pas supprimé : il reste dans l'historique (postes, voyages, fiches) et n'est plus proposé aux nouvelles saisies."
      motif="obligatoire" libelleConfirmer="Désactiver" danger chargement={shifts === null && !erreur} erreurChargement={erreur || (shifts && !s ? 'Shift introuvable.' : '')}
      interdit={!peutEcrire ? 'Droit Paramètres sur un profil sans site requis.' : s && !s.is_active ? 'Ce shift est déjà inactif.' : null}
      messageSucces="Shift désactivé."
      onExecuter={async (motif) => {
        const { error } = await supabase.rpc('desactiver_shift', { p_id: id, p_motif: motif });
        return error ? error.message : null;
      }}
    />
  );
};

export const ShiftsView = () => {
  const route = useRoute();
  if (route.vue !== VUE || route.mode === 'liste') return <ListeShifts />;
  if (route.mode === 'nouveau') return <FormulaireShift />;
  if (route.mode === 'modifier') return <FormulaireShift id={route.id} />;
  if (route.mode === 'action' && route.action === 'desactiver') return <DesactiverShift id={route.id ?? ''} />;
  if (route.mode === 'action') return <SansDonnees message="Action inconnue" detail={`« ${route.action} » n'est pas une action des shifts.`} />;
  return <DetailShift id={route.id ?? ''} />;
};

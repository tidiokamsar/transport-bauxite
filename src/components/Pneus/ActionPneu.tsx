import { useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSite } from '../../contexts/SiteContext';
import { CHAMP_FENETRE } from '../ui/Fenetre';
import { PageAction } from '../ui/PageAction';
import { ChampPage } from '../ui/PageFormulaire';
import { ReferentielVide, SansDonnees } from '../ui/Panneau';
import { SANS_SITE } from '../ui/referentiels';
import { routeDetail } from '../ui/routeur';
import {
  COLONNES_INTERVENTION, DECISIONS_REMISE, MODULE_PNEUS, NATURES_INSPECTION, RECOMMANDATIONS, TYPES_INTERVENTION, VUE_PNEUS,
  appeler, droitsPneus, lireDate, lireIdRoute, lireNombre, nombreInvalide, nouvelleCle, routeEspace, texte, useLecture,
  type Intervention, type PneuLigne, type Proposition,
} from './socle';

// Actions metier du module Pneus en pleine page (D-090) : chacune appelle
// la fonction serveur D-091 ; motif obligatoire quand le serveur l'exige,
// soumission unique (PageAction), erreur du serveur affichee telle quelle.

const ETATS_LIBELLE: Record<string, string> = { stored: 'en stock', active: 'monté', damaged: 'à décider', retired: 'réformé', en_intervention: 'en intervention' };
const OUVERTES = ['envoyee', 'retournee', 'controlee'];

const Champ = ({ libelle, aide, erreur, children }: { libelle: string; aide?: ReactNode; erreur?: string | null; children: ReactNode }) =>
  <ChampPage libelle={libelle} aide={aide} erreur={erreur}>{children}</ChampPage>;
const Grille = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
const erreurNombre = (s: string) => (nombreInvalide(s) ? 'Nombre illisible' : null);

const SelectSite = ({ valeur, poser, exclure }: { valeur: string; poser: (v: string) => void; exclure?: string | null }) => {
  const { sites, aucunSite } = useSite();
  if (aucunSite) return <ReferentielVide>{SANS_SITE}</ReferentielVide>;
  return (
    <select value={valeur} onChange={(e) => poser(e.target.value)} className={CHAMP_FENETRE}>
      <option value="">Choisir le site</option>
      {sites.filter((s) => s.id !== exclure).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
};

export const ActionPneu = ({ idRoute, action, requete }: { idRoute: string; action: string; requete: Record<string, string> }) => {
  const cible = lireIdRoute(idRoute);
  if (cible.prefixe === 'configuration' || cible.prefixe === 'seuils') return <ActionParametrage idRoute={idRoute} prefixe={cible.prefixe} id={cible.id} action={action} />;
  if (action === 'monter') return <Monter idRoute={idRoute} tireId={cible.prefixe ? null : cible.id} enginId={cible.prefixe === 'engin' ? cible.id : null} position={requete.position} />;
  if (cible.prefixe) return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action de l'engin.`} />;
  return <ActionSurPneu id={cible.id} action={action} />;
};

// ---------------------------------------------------------------- montage

interface PositionLibre { position: string; libelle: string | null; tire_id: string | null; dimensions_admises: string[]; brand_model?: string }

const Monter = ({ idRoute, tireId, enginId, position }: { idRoute: string; tireId: string | null; enginId: string | null; position?: string }) => {
  const { hasPermission, profile } = useAuth();
  const droits = droitsPneus(hasPermission, profile?.role);
  const [cle] = useState(nouvelleCle);
  const [pneu, setPneu] = useState(tireId ?? '');
  const [engin, setEngin] = useState(enginId ?? '');
  const [pos, setPos] = useState(position ?? '');
  const [le, setLe] = useState('');
  const [km, setKm] = useState('');
  const [prof, setProf] = useState('');
  const [pression, setPression] = useState('');
  const [note, setNote] = useState('');
  const stock = useLecture<PneuLigne>(() => supabase.from('v_pneus').select('*').eq('status', 'stored').order('code_sigtb'), 'pneus en stock');
  const engins = useLecture<{ id: string; registration: string; brand_model: string | null }>(
    () => supabase.from('vehicles').select('id, registration, brand_model').neq('status', 'sold').order('registration'), 'engins');
  const positions = useLecture<PositionLibre>(
    () => (engin ? supabase.from('v_pneus_positions_engins').select('position, libelle, tire_id, dimensions_admises').eq('vehicle_id', engin).order('ordre') : Promise.resolve({ data: [], error: null })),
    'positions', [engin]);
  const choisi = (stock.lignes ?? []).find((p) => p.id === pneu);
  const vehicule = (engins.lignes ?? []).find((v) => v.id === engin);
  const libres = (positions.lignes ?? []).filter((p) => !p.tire_id);
  const avecConfiguration = (positions.lignes ?? []).length > 0;
  const erreurs = [erreurNombre(km), erreurNombre(prof), erreurNombre(pression)].filter(Boolean);
  const pret = Boolean(pneu && engin && pos.trim()) && erreurs.length === 0;
  const interdit = !droits.ecriture ? 'Droit d\'écriture sur la flotte ou la maintenance requis.'
    : tireId && stock.lignes && !choisi ? 'Seul un pneu en stock et réutilisable se monte.' : null;
  const reference = tireId ? choisi?.code_sigtb ?? 'Pneu' : vehicule?.registration ?? 'Engin';

  return (
    <PageAction vue={VUE_PNEUS} module={MODULE_PNEUS} reference={reference} id={idRoute} titre={`Monter un pneu${vehicule ? ` sur ${vehicule.registration}` : ''}`}
      description="Le serveur contrôle la configuration du modèle (position connue, dimension admise), l'unicité position/pneu et les blocages de sécurité (défaut critique, profondeur sous le seuil)."
      motif="aucun" libelleConfirmer="Monter" pret={pret} interdit={interdit}
      chargement={stock.lignes === null || engins.lignes === null} erreurChargement={[stock.erreur, engins.erreur].filter(Boolean).join(' ') || undefined}
      messageSucces="Pneu monté." versApres={engin ? routeDetail(VUE_PNEUS, `engin-${engin}`) : undefined}
      onExecuter={() => appeler('monter_pneu', {
        p_tire: pneu, p_vehicle: engin, p_position: pos.trim(), p_date: lireDate(le), p_km: lireNombre(km), p_profondeur_mm: lireNombre(prof),
        p_pression_bar: lireNombre(pression), p_note: texte(note), p_cle_client: cle,
      })}>
      <Grille>
        <Champ libelle="Pneu *">
          <select value={pneu} onChange={(e) => setPneu(e.target.value)} disabled={Boolean(tireId)} className={CHAMP_FENETRE}>
            <option value="">Choisir un pneu en stock</option>
            {(stock.lignes ?? []).map((p) => <option key={p.id} value={p.id}>{p.code_sigtb}{p.numero_serie ? ` · ${p.numero_serie}` : ''} · {[p.brand, p.dimension].filter(Boolean).join(' ')}</option>)}
          </select>
        </Champ>
        <Champ libelle="Engin *">
          <select value={engin} onChange={(e) => { setEngin(e.target.value); setPos(''); }} disabled={Boolean(enginId)} className={CHAMP_FENETRE}>
            <option value="">Choisir un engin</option>
            {(engins.lignes ?? []).map((v) => <option key={v.id} value={v.id}>{v.registration}{v.brand_model ? ` · ${v.brand_model}` : ''}</option>)}
          </select>
        </Champ>
        <Champ libelle="Position *" aide={engin && !avecConfiguration ? 'Aucune configuration pour ce modèle : position libre (refusée si le blocage « configuration exigée » est activé).' : undefined}>
          {avecConfiguration ? (
            <select value={pos} onChange={(e) => setPos(e.target.value)} className={CHAMP_FENETRE}>
              <option value="">Choisir une position libre</option>
              {libres.map((p) => <option key={p.position} value={p.position}>{p.position}{p.libelle ? ` · ${p.libelle}` : ''}{p.dimensions_admises.length ? ` (${p.dimensions_admises.join(', ')})` : ''}</option>)}
            </select>
          ) : <input value={pos} onChange={(e) => setPos(e.target.value)} className={CHAMP_FENETRE} />}
        </Champ>
        <Champ libelle="Date réelle du montage" aide="Vide = maintenant"><input type="datetime-local" value={le} onChange={(e) => setLe(e.target.value)} className={CHAMP_FENETRE} /></Champ>
        <Champ libelle="Compteur de l'engin (km)" aide="Sans compteur, les km et le coût au km de ce montage ne seront pas calculables." erreur={erreurNombre(km)}><input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} className={CHAMP_FENETRE} /></Champ>
        <Champ libelle="Profondeur mesurée (mm)" erreur={erreurNombre(prof)}><input inputMode="decimal" value={prof} onChange={(e) => setProf(e.target.value)} className={CHAMP_FENETRE} /></Champ>
        <Champ libelle="Pression mesurée (bar)" erreur={erreurNombre(pression)}><input inputMode="decimal" value={pression} onChange={(e) => setPression(e.target.value)} className={CHAMP_FENETRE} /></Champ>
        <Champ libelle="Note"><input value={note} onChange={(e) => setNote(e.target.value)} className={CHAMP_FENETRE} /></Champ>
      </Grille>
    </PageAction>
  );
};

// ---------------------------------------------------------------- actions sur un pneu

const ActionSurPneu = ({ id, action }: { id: string; action: string }) => {
  const { hasPermission, profile, user } = useAuth();
  const droits = droitsPneus(hasPermission, profile?.role);
  const [cle] = useState(nouvelleCle);
  const [f, setF] = useState<Record<string, string>>({});
  const poser = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const val = (k: string) => f[k] ?? '';
  const pneuL = useLecture<PneuLigne>(() => supabase.from('v_pneus').select('*').eq('id', id), 'pneu', [id]);
  const itvL = useLecture<Intervention>(() => supabase.from('pneus_interventions').select(COLONNES_INTERVENTION).eq('tire_id', id).in('statut', OUVERTES), 'intervention ouverte', [id]);
  const propL = useLecture<Proposition>(() => supabase.from('pneus_propositions_immobilisation').select('*').eq('tire_id', id).eq('statut', 'proposee'), 'proposition ouverte', [id]);
  const pneu = pneuL.lignes?.[0] ?? null;
  const itv = itvL.lignes?.[0] ?? null;
  const prop = propL.lignes?.[0] ?? null;
  const vehicule = pneu?.vehicle_id ?? '';
  const positions = useLecture<PositionLibre>(
    () => (vehicule && action === 'permuter' ? supabase.from('v_pneus_positions_engins').select('position, libelle, tire_id, dimensions_admises').eq('vehicle_id', vehicule).order('ordre') : Promise.resolve({ data: [], error: null })),
    'positions', [vehicule, action]);
  const criteres = useLecture<{ code: string; libelle: string; bloquant: boolean; dimension: string | null; marque: string | null; modele: string | null }>(
    () => (action === 'envoyer-intervention' ? supabase.from('pneus_criteres_rechapage').select('code, libelle, bloquant, dimension, marque, modele').eq('actif', true).order('code') : Promise.resolve({ data: [], error: null })),
    'critères de rechapage', [action]);
  const fournisseurs = useLecture<{ id: string; company_name: string }>(
    () => (['envoyer-intervention'].includes(action) ? supabase.from('suppliers').select('id, company_name').order('company_name') : Promise.resolve({ data: [], error: null })), 'fournisseurs', [action]);
  const bons = useLecture<{ id: string; po_number: string }>(
    () => (action === 'retour-intervention' ? supabase.from('purchase_orders').select('id, po_number').order('po_number', { ascending: false }).limit(300) : Promise.resolve({ data: [], error: null })), 'bons de commande', [action]);
  const [zones, setZones] = useState<{ zone: string; mm: string }[]>([{ zone: '', mm: '' }]);
  const [constats, setConstats] = useState<{ code: string; gravite: string; description: string }[]>([]);

  const etat = pneu?.status;
  const ecr = droits.ecriture ? null : 'Droit d\'écriture sur la flotte ou la maintenance requis.';
  const etatRequis = (permis: string[], quoi: string) => (pneu && !permis.includes(etat ?? '') ? `${quoi} (pneu ${ETATS_LIBELLE[etat ?? ''] ?? etat}).` : null);
  const commun = {
    vue: VUE_PNEUS, module: MODULE_PNEUS, reference: pneu?.code_sigtb ?? 'Pneu', id,
    chargement: pneuL.lignes === null || itvL.lignes === null || propL.lignes === null,
    erreurChargement: [pneuL.erreur, itvL.erreur, propL.erreur].filter(Boolean).join(' ') || (pneuL.lignes && !pneu ? 'Pneu introuvable ou hors de votre périmètre.' : undefined),
  };
  const nombres = (...cles: string[]) => cles.every((k) => !nombreInvalide(val(k)));
  const champNombre = (k: string, libelle: string, aide?: string) => (
    <Champ libelle={libelle} aide={aide} erreur={erreurNombre(val(k))}><input inputMode="decimal" value={val(k)} onChange={(e) => poser(k)(e.target.value)} className={CHAMP_FENETRE} /></Champ>
  );
  const champDate = (k: string, libelle: string, aide = 'Vide = maintenant') => (
    <Champ libelle={libelle} aide={aide}><input type="datetime-local" value={val(k)} onChange={(e) => poser(k)(e.target.value)} className={CHAMP_FENETRE} /></Champ>
  );
  const champTexte = (k: string, libelle: string) => <Champ libelle={libelle}><input value={val(k)} onChange={(e) => poser(k)(e.target.value)} className={CHAMP_FENETRE} /></Champ>;
  const choix = (k: string, libelle: string, options: Record<string, string>, vide = 'Choisir') => (
    <Champ libelle={libelle}>
      <select value={val(k)} onChange={(e) => poser(k)(e.target.value)} className={CHAMP_FENETRE}>
        <option value="">{vide}</option>
        {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Champ>
  );
  const applicables = useMemo(() => {
    const n = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    return (criteres.lignes ?? []).filter((c) => (!c.dimension || n(c.dimension) === n(pneu?.dimension)) && (!c.marque || n(c.marque) === n(pneu?.brand)) && (!c.modele || n(c.modele) === n(pneu?.model)));
  }, [criteres.lignes, pneu]);

  switch (action) {
    case 'demonter':
      return (
        <PageAction {...commun} titre={`Démonter ${pneu?.code_sigtb ?? ''}`} motif="obligatoire" motifMinimum={1} libelleConfirmer="Démonter"
          interdit={ecr ?? etatRequis(['active'], 'Seul un pneu monté se démonte')} pret={Boolean(val('etat') && val('site')) && nombres('km', 'prof')}
          messageSucces="Pneu démonté." description="Le compteur au démontage ne peut pas être inférieur à celui du montage ; sans compteur, les km de ce montage restent inconnus."
          onExecuter={(motif) => appeler('demonter_pneu', { p_tire: id, p_motif: motif, p_etat: val('etat'), p_site: val('site'), p_date: lireDate(val('le')), p_km: lireNombre(val('km')), p_profondeur_mm: lireNombre(val('prof')), p_note: texte(val('note')), p_cle_client: cle })}>
          <Grille>
            {choix('etat', 'État au démontage *', { stored: 'Réutilisable (en stock)', damaged: 'À décider (endommagé)' })}
            <Champ libelle="Site de stockage *"><SelectSite valeur={val('site')} poser={poser('site')} /></Champ>
            {champDate('le', 'Date réelle')}
            {champNombre('km', 'Compteur de l\'engin (km)')}
            {champNombre('prof', 'Profondeur mesurée (mm)')}
            {champTexte('note', 'Note')}
          </Grille>
        </PageAction>
      );
    case 'permuter': {
      const autres = (positions.lignes ?? []).filter((p) => p.position !== pneu?.position);
      return (
        <PageAction {...commun} titre={`Permuter ${pneu?.code_sigtb ?? ''}`} motif="facultatif" libelleConfirmer="Permuter"
          interdit={ecr ?? etatRequis(['active'], 'Seul un pneu monté se permute')} pret={Boolean(val('pos').trim()) && nombres('km')}
          description={`Position actuelle : ${pneu?.position ?? 'non renseignée'}. Si la nouvelle position est occupée, les deux pneus échangent leur place (contrôle de compatibilité par le serveur).`}
          messageSucces="Pneu permuté."
          onExecuter={(motif) => appeler('permuter_pneu', { p_tire: id, p_position: val('pos').trim(), p_date: lireDate(val('le')), p_km: lireNombre(val('km')), p_motif: texte(motif) })}>
          <Grille>
            <Champ libelle="Nouvelle position *">
              {autres.length ? (
                <select value={val('pos')} onChange={(e) => poser('pos')(e.target.value)} className={CHAMP_FENETRE}>
                  <option value="">Choisir</option>
                  {autres.map((p) => <option key={p.position} value={p.position}>{p.position}{p.tire_id ? ' (occupée : échange)' : ' (libre)'}</option>)}
                </select>
              ) : <input value={val('pos')} onChange={(e) => poser('pos')(e.target.value)} className={CHAMP_FENETRE} />}
            </Champ>
            {champDate('le', 'Date réelle')}
            {champNombre('km', 'Compteur de l\'engin (km)')}
          </Grille>
        </PageAction>
      );
    }
    case 'transferer':
      return (
        <PageAction {...commun} titre={`Transférer ${pneu?.code_sigtb ?? ''}`} motif="obligatoire" motifMinimum={1} libelleConfirmer="Transférer"
          interdit={ecr ?? etatRequis(['stored', 'damaged'], 'Seul un pneu en stock se transfère')} pret={Boolean(val('site'))} messageSucces="Pneu transféré."
          onExecuter={(motif) => appeler('transferer_pneu', { p_tire: id, p_site: val('site'), p_motif: motif, p_date: lireDate(val('le')), p_cle_client: cle })}>
          <Grille>
            <Champ libelle="Site de destination *"><SelectSite valeur={val('site')} poser={poser('site')} exclure={pneu?.site_id} /></Champ>
            {champDate('le', 'Date réelle')}
          </Grille>
        </PageAction>
      );
    case 'inspecter': {
      const mesures = Object.fromEntries(zones.filter((z) => z.zone.trim() && z.mm.trim()).map((z) => [z.zone.trim(), lireNombre(z.mm)]));
      const zonesOk = zones.every((z) => (!z.zone.trim() && !z.mm.trim()) || (z.zone.trim() && z.mm.trim() && !nombreInvalide(z.mm)));
      const constatsOk = constats.every((c) => c.code.trim() && c.gravite);
      const aMesure = Object.keys(mesures).length > 0 || Boolean(val('pression').trim() || val('temp').trim());
      const pret = Boolean(val('le') && val('nature')) && zonesOk && constatsOk && nombres('pression', 'temp', 'km')
        && (val('nature') === 'mesure' ? aMesure : aMesure || constats.length > 0);
      return (
        <PageAction {...commun} titre={`Inspecter ${pneu?.code_sigtb ?? ''}`} motif="aucun" libelleConfirmer="Enregistrer l'inspection"
          interdit={ecr ?? etatRequis(['stored', 'active', 'damaged'], 'Pneu réformé ou en intervention : inspection refusée')} pret={pret}
          messageSucces="Inspection enregistrée." versApres={routeDetail(VUE_PNEUS, id, 'inspections')}
          description="Profondeur retenue : minimum des zones ; écart calculé à partir de deux zones. Un constat critique sur un pneu monté crée une proposition d'immobilisation (décision humaine)."
          onExecuter={() => appeler('inspecter_pneu_detail', {
            p_tire: id, p_inspecte_le: lireDate(val('le')), p_nature: val('nature'), p_mesures: Object.keys(mesures).length ? mesures : undefined,
            p_pression_bar: lireNombre(val('pression')), p_temperature_c: lireNombre(val('temp')),
            p_constats: constats.length ? constats.map((c) => ({ code: c.code.trim(), gravite: c.gravite, description: texte(c.description) })) : undefined,
            p_recommandation: texte(val('reco')), p_km: lireNombre(val('km')), p_note: texte(val('note')), p_cle_client: cle,
          })}>
          <Grille>
            {champDate('le', 'Date réelle de l\'inspection *', 'Distincte de la saisie')}
            {choix('nature', 'Nature *', NATURES_INSPECTION)}
          </Grille>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-stone-700">Profondeur par zone (mm)</legend>
            {zones.map((z, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label={`Zone ${i + 1}`} placeholder="Zone (ex. EXT)" value={z.zone} onChange={(e) => setZones((l) => l.map((x, j) => (j === i ? { ...x, zone: e.target.value } : x)))} className={CHAMP_FENETRE} />
                <input aria-label={`Profondeur zone ${i + 1}`} inputMode="decimal" placeholder="mm" value={z.mm} onChange={(e) => setZones((l) => l.map((x, j) => (j === i ? { ...x, mm: e.target.value } : x)))} className={CHAMP_FENETRE} />
                <button type="button" onClick={() => setZones((l) => l.filter((_, j) => j !== i))} className="rounded-lg px-2 text-sm text-stone-500 hover:bg-stone-100">Retirer</button>
              </div>
            ))}
            <button type="button" onClick={() => setZones((l) => [...l, { zone: '', mm: '' }])} className="text-sm font-semibold text-orange-800">Ajouter une zone</button>
          </fieldset>
          <Grille>
            {champNombre('pression', 'Pression (bar)', 'Seulement si mesurée')}
            {champNombre('temp', 'Température (°C)', 'Seulement si mesurée')}
            {champNombre('km', 'Compteur de l\'engin (km)')}
            {choix('reco', 'Recommandation', RECOMMANDATIONS, 'Aucune saisie')}
          </Grille>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-stone-700">Constats</legend>
            {constats.map((c, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_2fr_auto]">
                <input aria-label={`Code du constat ${i + 1}`} placeholder="Code" value={c.code} onChange={(e) => setConstats((l) => l.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} className={CHAMP_FENETRE} />
                <select aria-label={`Gravité du constat ${i + 1}`} value={c.gravite} onChange={(e) => setConstats((l) => l.map((x, j) => (j === i ? { ...x, gravite: e.target.value } : x)))} className={CHAMP_FENETRE}>
                  <option value="">Gravité</option><option value="info">Info</option><option value="majeur">Majeur</option><option value="critique">Critique</option>
                </select>
                <input aria-label={`Description du constat ${i + 1}`} placeholder="Description" value={c.description} onChange={(e) => setConstats((l) => l.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className={CHAMP_FENETRE} />
                <button type="button" onClick={() => setConstats((l) => l.filter((_, j) => j !== i))} className="rounded-lg px-2 text-sm text-stone-500 hover:bg-stone-100">Retirer</button>
              </div>
            ))}
            <button type="button" onClick={() => setConstats((l) => [...l, { code: '', gravite: '', description: '' }])} className="text-sm font-semibold text-orange-800">Ajouter un constat</button>
          </fieldset>
          {champTexte('note', 'Note')}
        </PageAction>
      );
    }
    case 'envoyer-intervention': {
      const rechapage = val('type') === 'rechapage';
      const critOk = !rechapage || applicables.every((c) => val(`crit.${c.code}`) !== '');
      return (
        <PageAction {...commun} titre={`Envoyer ${pneu?.code_sigtb ?? ''} en intervention`} motif="aucun" libelleConfirmer="Envoyer"
          interdit={ecr ?? etatRequis(['stored', 'damaged'], 'Seul un pneu démonté part en intervention') ?? (itv ? `Intervention ${itv.numero} déjà ouverte.` : null)}
          pret={Boolean(val('type') && val('prestataire').trim() && (val('type') !== 'autre' || val('autre').trim())) && critOk}
          messageSucces="Pneu envoyé en intervention." versApres={routeDetail(VUE_PNEUS, id, 'interventions')}
          description={rechapage ? `Rechapage : cycle ${(pneu?.retread_count ?? 0) + 1}${pneu?.max_retreads !== null && pneu?.max_retreads !== undefined ? ` sur ${pneu.max_retreads} admis` : ''}. Chaque critère applicable doit être renseigné ; un critère bloquant non satisfait refuse l'envoi.` : undefined}
          onExecuter={() => appeler('envoyer_pneu_intervention', {
            p_tire: id, p_type: val('type'), p_prestataire: val('prestataire').trim(), p_date: lireDate(val('le')), p_type_autre: val('type') === 'autre' ? texte(val('autre')) : undefined,
            p_fournisseur: texte(val('fournisseur')), p_criteres: rechapage && applicables.length ? Object.fromEntries(applicables.map((c) => [c.code, val(`crit.${c.code}`) === 'oui'])) : undefined,
            p_reference: texte(val('reference')), p_note: texte(val('note')), p_cle_client: cle,
          })}>
          <Grille>
            {choix('type', 'Type *', TYPES_INTERVENTION)}
            {val('type') === 'autre' && champTexte('autre', 'Préciser le type *')}
            {champTexte('prestataire', 'Prestataire *')}
            <Champ libelle="Fournisseur enregistré">
              <select value={val('fournisseur')} onChange={(e) => poser('fournisseur')(e.target.value)} className={CHAMP_FENETRE}>
                <option value="">Aucun</option>
                {(fournisseurs.lignes ?? []).map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
              </select>
            </Champ>
            {champDate('le', 'Date d\'envoi')}
            {champTexte('reference', 'Référence de la pièce (bon d\'envoi)')}
            {champTexte('note', 'Note')}
          </Grille>
          {rechapage && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-stone-700">Critères d'acceptation de la carcasse</legend>
              {criteres.erreur && <p role="alert" className="text-sm text-red-700">{criteres.erreur}</p>}
              {applicables.length === 0 ? <p className="text-sm text-stone-500">Aucun critère applicable paramétré.</p> : applicables.map((c) => (
                <label key={c.code} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-[14rem]">{c.libelle} ({c.code}){c.bloquant ? ' · bloquant' : ''} *</span>
                  <select value={val(`crit.${c.code}`)} onChange={(e) => poser(`crit.${c.code}`)(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1">
                    <option value="">À renseigner</option><option value="oui">Satisfait</option><option value="non">Non satisfait</option>
                  </select>
                </label>
              ))}
            </fieldset>
          )}
        </PageAction>
      );
    }
    case 'retour-intervention':
      return (
        <PageAction {...commun} titre={`Retour d'intervention ${itv?.numero ?? ''}`} motif="aucun" libelleConfirmer="Enregistrer le retour"
          interdit={ecr ?? (itv?.statut === 'envoyee' ? null : 'Aucune intervention en attente de retour pour ce pneu.')}
          pret={Boolean(val('site')) && nombres('cout', 'prof', 'gm', 'gk')} messageSucces="Retour enregistré : contrôle à faire." versApres={routeDetail(VUE_PNEUS, id, 'interventions')}
          description="Coût, garantie et pièce (bon de commande ou facture) tels qu'ils figurent sur le document du prestataire ; absents = non renseignés."
          onExecuter={() => appeler('enregistrer_retour_intervention', {
            p_intervention: itv?.id, p_site: val('site'), p_date: lireDate(val('le')), p_cout: lireNombre(val('cout')), p_profondeur_mm: lireNombre(val('prof')),
            p_constats: texte(val('constats')), p_garantie_mois: lireNombre(val('gm')), p_garantie_km: lireNombre(val('gk')), p_reference: texte(val('reference')),
            p_bon_commande: texte(val('bon')), p_facture: texte(val('facture')), p_cle_client: cle,
          })}>
          <Grille>
            <Champ libelle="Site de retour *"><SelectSite valeur={val('site')} poser={poser('site')} /></Champ>
            {champDate('le', 'Date de retour')}
            {champNombre('cout', 'Coût (GNF)')}
            {champNombre('prof', 'Profondeur au retour (mm)')}
            {champNombre('gm', 'Garantie (mois)')}
            {champNombre('gk', 'Garantie (km)')}
            <Champ libelle="Bon de commande">
              <select value={val('bon')} onChange={(e) => poser('bon')(e.target.value)} className={CHAMP_FENETRE}>
                <option value="">Aucun</option>
                {(bons.lignes ?? []).map((b) => <option key={b.id} value={b.id}>{b.po_number}</option>)}
              </select>
            </Champ>
            {champTexte('facture', 'Référence de la facture')}
            {champTexte('reference', 'Référence du bon de retour')}
            {champTexte('constats', 'Constats du prestataire')}
          </Grille>
        </PageAction>
      );
    case 'controler-intervention': {
      const nonConforme = val('resultat') === 'non';
      return (
        <PageAction {...commun} titre={`Contrôler ${itv?.numero ?? 'l\'intervention'}`} motif="aucun" libelleConfirmer="Enregistrer le contrôle"
          interdit={ecr ?? (itv?.statut === 'retournee' ? null : 'Contrôle possible après le retour seulement.')}
          pret={Boolean(val('resultat')) && (!nonConforme || Boolean(val('note').trim()))} messageSucces="Contrôle enregistré : décision à prendre par un approbateur."
          versApres={routeDetail(VUE_PNEUS, id, 'interventions')}
          onExecuter={() => appeler('controler_intervention_pneu', { p_intervention: itv?.id, p_conforme: val('resultat') === 'oui', p_note: texte(val('note')) })}>
          <Grille>
            {choix('resultat', 'Résultat *', { oui: 'Conforme', non: 'Non conforme' })}
            <Champ libelle={nonConforme ? 'Constat du contrôle *' : 'Constat du contrôle'}><input value={val('note')} onChange={(e) => poser('note')(e.target.value)} className={CHAMP_FENETRE} /></Champ>
          </Grille>
        </PageAction>
      );
    }
    case 'decider-remise-en-service': {
      const separe = itv && user && (itv.retour_par === user.id || itv.controle_par === user.id);
      const motifRequis = val('decision') !== '' && val('decision') !== 'remis_en_service';
      const options = itv?.controle_resultat === 'conforme' ? DECISIONS_REMISE : { reforme: DECISIONS_REMISE.reforme, a_reprendre: DECISIONS_REMISE.a_reprendre };
      return (
        <PageAction {...commun} titre={`Décider la suite de ${itv?.numero ?? 'l\'intervention'}`} motif="aucun" libelleConfirmer="Décider"
          interdit={!droits.approbation ? 'Décision réservée à un approbateur de la maintenance.' : itv?.statut !== 'controlee' ? 'Décision après le contrôle seulement.'
            : separe ? 'Séparation des tâches : l\'auteur du retour ou du contrôle ne décide pas la remise en service.' : null}
          pret={Boolean(val('decision')) && (!motifRequis || Boolean(val('motif').trim()))} danger={val('decision') === 'reforme'}
          messageSucces="Décision enregistrée." versApres={routeDetail(VUE_PNEUS, id, 'interventions')}
          description={`Contrôle : ${itv?.controle_resultat === 'conforme' ? 'conforme' : 'non conforme (remise en service impossible)'}${itv?.controle_note ? ` · ${itv.controle_note}` : ''}.`}
          onExecuter={() => appeler('decider_remise_en_service_pneu', { p_intervention: itv?.id, p_decision: val('decision'), p_motif: texte(val('motif')) })}>
          <Grille>
            {choix('decision', 'Décision *', options)}
            <Champ libelle={motifRequis ? 'Motif *' : 'Motif'}><input value={val('motif')} onChange={(e) => poser('motif')(e.target.value)} className={CHAMP_FENETRE} /></Champ>
          </Grille>
        </PageAction>
      );
    }
    case 'annuler-intervention':
      return (
        <PageAction {...commun} titre={`Annuler ${itv?.numero ?? 'l\'intervention'}`} motif="obligatoire" motifMinimum={1} libelleConfirmer="Annuler l'intervention" danger
          interdit={ecr ?? (itv?.statut === 'envoyee' ? null : 'Seule une intervention non retournée s\'annule.')} messageSucces="Intervention annulée."
          versApres={routeDetail(VUE_PNEUS, id, 'interventions')} description="L'envoi est annulé par une opération tracée ; le pneu revient dans son état précédent."
          onExecuter={(motif) => appeler('annuler_intervention_pneu', { p_intervention: itv?.id, p_motif: motif })} />
      );
    case 'reformer':
      return (
        <PageAction {...commun} titre={`Réformer ${pneu?.code_sigtb ?? ''}`} motif="obligatoire" motifMinimum={1} libelleConfirmer="Réformer" danger
          interdit={ecr ?? etatRequis(['stored', 'damaged'], 'Démonter le pneu avant de le réformer')} messageSucces="Pneu réformé."
          description="La réforme est définitive ; la carcasse et son historique restent consultables."
          onExecuter={(motif) => appeler('reformer_pneu', { p_tire: id, p_motif: motif, p_date: lireDate(val('le')) })}>
          {champDate('le', 'Date réelle')}
        </PageAction>
      );
    case 'proposer-immobilisation':
      return (
        <PageAction {...commun} titre={`Proposer l'immobilisation de l'engin (${pneu?.code_sigtb ?? ''})`} motif="obligatoire" motifMinimum={1} libelleConfirmer="Proposer" danger
          interdit={ecr ?? etatRequis(['active'], 'Proposition d\'immobilisation : pneu monté requis') ?? (prop ? 'Une proposition est déjà en attente.' : null)}
          messageSucces="Proposition enregistrée : décision par la maintenance." versApres={routeDetail(VUE_PNEUS, id, 'alertes')}
          description="Le système propose, l'humain décide : aucune immobilisation n'est déclarée tant que la proposition n'est pas acceptée."
          onExecuter={(motif) => appeler('proposer_immobilisation_pneu', { p_tire: id, p_motif: motif })} />
      );
    case 'decider-immobilisation':
      return (
        <PageAction {...commun} titre="Décider la proposition d'immobilisation" motif="obligatoire" motifMinimum={1} libelleConfirmer="Décider" danger={val('accepter') === 'oui'}
          interdit={!droits.decisionImmobilisation ? 'Droit d\'écriture sur la maintenance requis.' : prop ? null : 'Aucune proposition en attente pour ce pneu.'}
          pret={val('accepter') === 'non' || (val('accepter') === 'oui' && Boolean(val('imputation')))}
          messageSucces="Décision enregistrée." versApres={routeDetail(VUE_PNEUS, id, 'alertes')}
          description={prop ? `Proposée le ${new Date(prop.propose_le).toLocaleString('fr-FR')} : ${prop.motif}. L'acceptation déclare une immobilisation pneumatique de l'engin.` : undefined}
          onExecuter={(motif) => appeler('decider_proposition_immobilisation', { p_id: prop?.id, p_accepter: val('accepter') === 'oui', p_motif: motif, p_imputation: val('accepter') === 'oui' ? val('imputation') : undefined })}>
          <Grille>
            {choix('accepter', 'Décision *', { oui: 'Accepter (immobiliser l\'engin)', non: 'Refuser' })}
            {val('accepter') === 'oui' && choix('imputation', 'Imputation *', { loueur: 'Loueur', exploitant: 'Exploitant', a_determiner: 'À déterminer' })}
          </Grille>
        </PageAction>
      );
    default:
      return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action de la fiche pneu.`} />;
  }
};

// ---------------------------------------------------------------- parametrage

const ActionParametrage = ({ idRoute, prefixe, id, action }: { idRoute: string; prefixe: 'configuration' | 'seuils'; id: string; action: string }) => {
  const { hasPermission, profile } = useAuth();
  const droits = droitsPneus(hasPermission, profile?.role);
  const table = prefixe === 'configuration' ? 'pneus_configurations' : 'pneus_seuils';
  const objet = useLecture<{ id: string; actif: boolean; code?: string; libelle?: string }>(() => supabase.from(table).select('*').eq('id', id), 'paramètre', [table, id]);
  const o = objet.lignes?.[0];
  const attendu = prefixe === 'configuration' ? 'retirer' : 'desactiver';
  if (action !== attendu) return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action du paramétrage.`} />;
  return (
    <PageAction vue={VUE_PNEUS} module={MODULE_PNEUS} reference={prefixe === 'configuration' ? `Configuration ${o?.code ?? ''}` : 'Seuils'} id={idRoute}
      titre={prefixe === 'configuration' ? `Retirer la configuration ${o?.code ?? ''}` : 'Désactiver ces seuils'} motif="obligatoire" motifMinimum={1} danger
      libelleConfirmer={prefixe === 'configuration' ? 'Retirer' : 'Désactiver'} chargement={objet.lignes === null} erreurChargement={objet.erreur || (objet.lignes && !o ? 'Paramètre introuvable.' : undefined)}
      interdit={!droits.parametrage ? 'Paramétrage réservé à l\'administrateur ou à un approbateur de la maintenance à périmètre global.' : o && !o.actif ? 'Déjà inactif.' : null}
      description={prefixe === 'configuration' ? 'Refusé par le serveur si des pneus sont montés sur un engin de ce modèle. Journalisé avant/après.' : 'Les alertes fondées sur ces seuils cessent. Journalisé.'}
      messageSucces={prefixe === 'configuration' ? 'Configuration retirée.' : 'Seuils désactivés.'} versApres={routeEspace('parametrage')}
      onExecuter={(motif) => appeler(prefixe === 'configuration' ? 'retirer_configuration_pneus' : 'desactiver_seuils_pneus', { p_id: id, p_motif: motif })} />
  );
};

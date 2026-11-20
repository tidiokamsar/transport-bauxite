import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { saisirHorsLigne } from '../../lib/offline';
import { useAuth } from '../../contexts/AuthContext';
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CHAMP_FENETRE } from '../ui/Fenetre';
import { FilAriane } from '../ui/PageDetail';
import { ChampPage, PageFormulaire, SectionFormulaire } from '../ui/PageFormulaire';
import { SansDonnees } from '../ui/Panneau';
import { arianeModule, useSaisie } from '../ui/pages';
import { lire } from '../ui/lecture';
import { naviguer, poserAnnonce, routeDetail, routeListe, useRoute } from '../ui/routeur';
import { FicheImprimable, type ContexteImpression } from './FicheImprimable';
import type { Fiche } from './fiches';
import {
  VUE_FICHES, depuisBrouillon, erreursCarburant, erreursPointage, idsDuLot, motifImpressionRequis, nombreSaisi,
  type SaisieCarburant, type SaisiePointage,
} from './cycleFiche';

// Saisies au retour des fiches FP et FC (D-089, D-088 suite), brouillon
// (enregistrer_brouillon_fiche, controle de version) et actions groupees
// sur un lot (impression avec apercu, remise, retour) en pleine page.

const MODULE = 'Fiches terrain';

/** Message affiche quand une saisie est en file : jamais un succes. */
const messageFile = (clientId?: string) =>
  `Enregistrement en attente de synchronisation, NON VALIDE (identifiant client ${clientId ?? 'inconnu'}). Ne quittez pas l'ecran avant la confirmation serveur.`;

export interface FicheSaisie { id: string; numero: string; type: string; site_id: string; vehicle_id: string | null; stockage_id: string | null; agent: string | null; version: number; brouillon: Record<string, unknown> | null }

/** Brouillon de la saisie : enregistre sans valider, version suivie (40001 si la fiche a change). */
export const BoutonBrouillon = ({ fiche, cle, valeurs }: { fiche: FicheSaisie; cle: string; valeurs: Record<string, unknown> }) => {
  const [version, setVersion] = useState(fiche.version);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <div className="sm:col-span-2">
      <button type="button" disabled={enCours} className={BOUTON_SECONDAIRE} onClick={async () => {
        setEnCours(true);
        const { data, error, file, clientId } = await saisirHorsLigne('enregistrer_brouillon_fiche', { p_id: fiche.id, p_brouillon: { [cle]: valeurs }, p_version: version });
        setEnCours(false);
        if (file) { setMessage({ ok: false, texte: messageFile(clientId) }); return; }
        if (error) { setMessage({ ok: false, texte: error.message }); return; }
        setVersion(Number(data));
        setMessage({ ok: true, texte: 'Brouillon enregistré (la fiche passe en saisie en cours).' });
      }}>Enregistrer le brouillon</button>
      {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`}>{message.texte}</p>}
    </div>
  );
};

const useEngins = (siteId: string) => {
  const [engins, setEngins] = useState<{ id: string; registration: string; site_id: string | null }[]>([]);
  useEffect(() => {
    supabase.from('vehicles').select('id, registration, site_id').order('registration')
      .then(({ data }) => setEngins(((data ?? []) as { id: string; registration: string; site_id: string | null }[]).filter((e) => e.site_id === null || e.site_id === siteId)));
  }, [siteId]);
  return engins;
};

const VIDE_FP: SaisiePointage = { vehicle_id: '', index_debut: '', index_fin: '', heures_productives: '', periode_debut: '', periode_fin: '', operateur: '', observations: '', motif: '' };

export const SaisiePointagePage = ({ fiche }: { fiche: FicheSaisie }) => {
  const initial = depuisBrouillon(fiche, 'pointage', { ...VIDE_FP, vehicle_id: fiche.vehicle_id ?? '' });
  const { valeurs, poser, modifie } = useSaisie(initial);
  const engins = useEngins(fiche.site_id);
  const erreurs = erreursPointage(valeurs);
  const champ = (cle: keyof SaisiePointage, libelle: string, type = 'text') => (
    <ChampPage libelle={libelle} erreur={erreurs[cle]}><input type={type} value={valeurs[cle]} onChange={(e) => poser(cle, e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
  );
  return (
    <PageFormulaire vue={VUE_FICHES} module={MODULE} titre={`Saisir un pointage de la fiche ${fiche.numero}`} reference={fiche.numero} id={fiche.id}
      description="Heures moteur (horamètre) et heures productives sont distinctes. Un pointage déjà saisi se corrige avec un motif, tracé au journal de la fiche."
      modifie={modifie} erreurs={Object.values(erreurs)} libelleSoumettre="Enregistrer le pointage"
      onSoumettre={async () => {
        const { error, file, clientId } = await saisirHorsLigne('saisir_pointage_fiche', {
          p_fiche_id: fiche.id, p_vehicle_id: valeurs.vehicle_id, p_index_debut: nombreSaisi(valeurs.index_debut), p_index_fin: nombreSaisi(valeurs.index_fin),
          p_heures_productives: nombreSaisi(valeurs.heures_productives),
          p_periode_debut: valeurs.periode_debut ? new Date(valeurs.periode_debut).toISOString() : null,
          p_periode_fin: valeurs.periode_fin ? new Date(valeurs.periode_fin).toISOString() : null,
          p_operateur: valeurs.operateur.trim() || null, p_observations: valeurs.observations.trim() || null, p_motif_correction: valeurs.motif.trim() || null,
        });
        if (file) return { erreur: messageFile(clientId) };
        if (error) return { erreur: error.message };
        poserAnnonce('Pointage enregistré.');
        return { vers: routeDetail(VUE_FICHES, fiche.id) };
      }}>
      <SectionFormulaire titre="Pointage">
        <ChampPage libelle="Engin *" erreur={erreurs.vehicle_id}>
          <select value={valeurs.vehicle_id} onChange={(e) => poser('vehicle_id', e.target.value)} disabled={!!fiche.vehicle_id} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {engins.map((e) => <option key={e.id} value={e.id}>{e.registration}</option>)}
          </select>
        </ChampPage>
        {champ('operateur', 'Opérateur')}
        {champ('index_debut', 'Horamètre début *')}
        {champ('index_fin', 'Horamètre fin *')}
        {champ('heures_productives', 'Heures productives')}
        {champ('periode_debut', 'Début de période', 'datetime-local')}
        {champ('periode_fin', 'Fin de période', 'datetime-local')}
        {champ('observations', 'Observations')}
        {champ('motif', 'Motif de correction (pointage déjà saisi)')}
        <BoutonBrouillon fiche={fiche} cle="pointage" valeurs={valeurs} />
      </SectionFormulaire>
    </PageFormulaire>
  );
};

const VIDE_FC: SaisieCarburant = { rang: '1', vehicle_id: '', distribue_le: '', litres: '', index_pompe_debut: '', index_pompe_fin: '', compteur_km: '', horametre: '', destinataire_confirme: false, destinataire_nom: '', observations: '', motif: '' };

export const SaisieCarburantPage = ({ fiche }: { fiche: FicheSaisie }) => {
  const { valeurs, poser, modifie } = useSaisie(depuisBrouillon(fiche, 'carburant', VIDE_FC));
  const engins = useEngins(fiche.site_id);
  const [rangs, setRangs] = useState<number[]>([]);
  useEffect(() => {
    supabase.from('fiches_carburant_lignes').select('rang').eq('fiche_id', fiche.id)
      .then(({ data }) => setRangs(((data ?? []) as { rang: number }[]).map((r) => r.rang)));
  }, [fiche.id]);
  const correction = rangs.includes(Number(valeurs.rang));
  const erreurs = erreursCarburant(valeurs, correction);
  const champ = (cle: Exclude<keyof SaisieCarburant, 'destinataire_confirme'>, libelle: string, type = 'text') => (
    <ChampPage libelle={libelle} erreur={erreurs[cle]}><input type={type} value={valeurs[cle]} onChange={(e) => poser(cle, e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
  );
  return (
    <PageFormulaire vue={VUE_FICHES} module={MODULE} titre={`Saisir une distribution de la fiche ${fiche.numero}`} reference={fiche.numero} id={fiche.id}
      description="La sortie de stock n'est écrite qu'à la validation de la fiche, une seule fois (D-089). La cuve est celle de la fiche."
      modifie={modifie} erreurs={Object.values(erreurs)} libelleSoumettre={correction ? 'Corriger la distribution' : 'Enregistrer la distribution'}
      onSoumettre={async () => {
        const ligne: Record<string, unknown> = { vehicle_id: valeurs.vehicle_id, litres: nombreSaisi(valeurs.litres), distribue_le: new Date(valeurs.distribue_le).toISOString(),
          destinataire_confirme: valeurs.destinataire_confirme };
        (['index_pompe_debut', 'index_pompe_fin', 'compteur_km', 'horametre'] as const).forEach((k) => { if (valeurs[k] !== '') ligne[k] = nombreSaisi(valeurs[k]); });
        if (valeurs.destinataire_nom.trim()) ligne.destinataire_nom = valeurs.destinataire_nom.trim();
        if (valeurs.observations.trim()) ligne.observations = valeurs.observations.trim();
        const { error, file, clientId } = await saisirHorsLigne('saisir_ligne_carburant', { p_fiche_id: fiche.id, p_rang: Number(valeurs.rang), p_ligne: ligne, p_motif_correction: correction ? valeurs.motif.trim() : null });
        if (file) return { erreur: messageFile(clientId) };
        if (error) return { erreur: error.message };
        poserAnnonce('Distribution enregistrée.');
        return { vers: routeDetail(VUE_FICHES, fiche.id) };
      }}>
      <SectionFormulaire titre="Distribution">
        {champ('rang', 'Numéro de ligne *', 'number')}
        <ChampPage libelle="Engin destinataire *" erreur={erreurs.vehicle_id}>
          <select value={valeurs.vehicle_id} onChange={(e) => poser('vehicle_id', e.target.value)} className={CHAMP_FENETRE}>
            <option value="">Choisir</option>
            {engins.map((e) => <option key={e.id} value={e.id}>{e.registration}</option>)}
          </select>
        </ChampPage>
        {champ('distribue_le', 'Date et heure *', 'datetime-local')}
        {champ('litres', 'Litres *')}
        {champ('index_pompe_debut', 'Index pompe début')}
        {champ('index_pompe_fin', 'Index pompe fin')}
        {champ('compteur_km', 'Compteur (km)')}
        {champ('horametre', 'Horamètre')}
        {champ('destinataire_nom', 'Nom du destinataire')}
        <ChampPage libelle="Destinataire">
          <span className="flex items-center gap-2"><input type="checkbox" checked={valeurs.destinataire_confirme} onChange={(e) => poser('destinataire_confirme', e.target.checked)} /> Réception confirmée par le destinataire</span>
        </ChampPage>
        {champ('observations', 'Observations')}
        {correction && champ('motif', 'Motif de correction *')}
        <BoutonBrouillon fiche={fiche} cle="carburant" valeurs={valeurs} />
      </SectionFormulaire>
    </PageFormulaire>
  );
};

// ---------------------------------------------------------------- Lot

const LIBELLES_LOT: Record<string, string> = { imprimer: 'Imprimer les fiches', remettre: 'Remettre les fiches à l\'agent', retour: 'Enregistrer le retour des fiches' };

const PageLot = ({ titre, children, onExecuter, pret, libelle }: {
  titre: string; children: ReactNode; onExecuter: () => Promise<string | null>; pret: boolean; libelle: string;
}) => {
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (verrou.current || !pret) return;
    verrou.current = true; setEnCours(true); setErreur('');
    try {
      const echec = await onExecuter();
      if (echec) { setErreur(echec); return; }
      poserAnnonce(`${libelle} : enregistré.`);
      naviguer(routeListe(VUE_FICHES), { remplacer: true });
    } finally { verrou.current = false; setEnCours(false); }
  };
  return (
    <div className="space-y-5">
      <FilAriane elements={arianeModule(VUE_FICHES, MODULE, { libelle: titre })} />
      <h1 className="text-2xl font-black text-stone-900">{titre}</h1>
      <form aria-label={titre} onSubmit={envoyer} className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte">
        {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Action refusée par le serveur : {erreur}</p>}
        {children}
        <div className="flex justify-end gap-2">
          <a href={routeListe(VUE_FICHES)} className={BOUTON_SECONDAIRE}>Annuler</a>
          <button type="submit" disabled={!pret || enCours} className={BOUTON_PRINCIPAL}>{enCours ? 'En cours…' : libelle}</button>
        </div>
      </form>
    </div>
  );
};

export const ActionLot = ({ action }: { action: string }) => {
  const { hasPermission } = useAuth();
  const route = useRoute();
  const ids = idsDuLot(route.requete.ids);
  const peutEcrire = hasPermission('trips', 'create') || hasPermission('maintenance', 'create') || hasPermission('fuel', 'create');
  const [fiches, setFiches] = useState<Fiche[] | null>(null);
  const [contextes, setContextes] = useState<Record<string, ContexteImpression>>({});
  const [erreur, setErreur] = useState('');
  const [agent, setAgent] = useState('');
  const [motif, setMotif] = useState('');
  const [retours, setRetours] = useState<Record<string, string>>({});
  const cleIds = ids.join(',');

  useEffect(() => {
    const liste = cleIds ? cleIds.split(',') : [];
    if (!liste.length) { setFiches([]); return; }
    Promise.all([
      lire<Fiche & { nb_impressions: number | null }>(supabase.from('fiches_terrain').select('*').in('id', liste).order('numero'), 'fiches du lot'),
      supabase.from('sites').select('id, name'), supabase.from('work_shifts').select('id, display_name'),
      supabase.from('vehicles').select('id, registration'), supabase.from('drivers').select('id, name'),
      supabase.from('societe').select('raison_sociale, rccm, nif, adresse').eq('id', 1).maybeSingle(),
    ]).then(([f, s, w, v, d, so]) => {
      const lignes = (f.lignes ?? []).filter((x) => liste.includes(x.id));
      setFiches(f.lignes ? lignes : null);
      setErreur(f.erreur);
      const n = (data: unknown, champ: string) => new Map(((data ?? []) as Record<string, string>[]).map((x) => [x.id, x[champ]]));
      const sites = n(s.data, 'name'); const shifts = n(w.data, 'display_name'); const vh = n(v.data, 'registration'); const dr = n(d.data, 'name');
      setContextes(Object.fromEntries(lignes.map((x) => [x.id, {
        societe: so.data as ContexteImpression['societe'], site: sites.get(x.site_id) ?? '', shift: x.shift_id ? shifts.get(x.shift_id) ?? '' : '',
        camion: x.vehicle_id ? vh.get(x.vehicle_id) ?? '' : '', chauffeur: x.driver_id ? dr.get(x.driver_id) ?? '' : '',
      }])));
    });
  }, [cleIds]);

  if (!LIBELLES_LOT[action]) return <SansDonnees message="Action inconnue" detail={`« ${action} » n'est pas une action groupée des fiches.`} />;
  const titre = LIBELLES_LOT[action];
  if (!peutEcrire) return <SansDonnees message="Action impossible" detail="Droit d'écriture requis." />;
  if (erreur) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>;
  if (fiches === null) return <p role="status" className="py-8 text-center text-sm text-stone-500">Chargement…</p>;
  if (fiches.length === 0) return <SansDonnees message="Aucune fiche dans ce lot" detail="Sélectionner des fiches dans la liste." />;
  const numeros = <p className="text-sm text-stone-600">Fiches : {fiches.map((f) => f.numero).join(', ')}</p>;

  if (action === 'imprimer') {
    const reimpression = fiches.some((f) => motifImpressionRequis((f as { nb_impressions?: number | null }).nb_impressions));
    return (
      <div className="space-y-5">
        <PageLot titre={titre} libelle="Enregistrer l'impression" pret={!reimpression || motif.trim().length >= 3}
          onExecuter={async () => {
            const { error } = await supabase.rpc('enregistrer_impression_fiches', { p_ids: fiches.map((f) => f.id), p_motif: motif.trim() || null });
            return error ? error.message : null;
          }}>
          {numeros}
          <p className="text-sm text-stone-600">Imprimer avec le bouton de l'aperçu ci-dessous, puis enregistrer l'impression (trace au journal de chaque fiche).</p>
          {reimpression && (
            <ChampPage libelle="Motif de réimpression *" aide="Une fiche du lot est déjà imprimée.">
              <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className={CHAMP_FENETRE} />
            </ChampPage>
          )}
        </PageLot>
        <FicheImprimable fiches={fiches} contextes={contextes} pleinePage onFermer={() => naviguer(routeListe(VUE_FICHES))} />
      </div>
    );
  }
  if (action === 'remettre') {
    return (
      <PageLot titre={titre} libelle="Remettre à l'agent" pret={agent.trim().length > 0}
        onExecuter={async () => {
          const { error } = await supabase.rpc('remettre_fiches', { p_ids: fiches.map((f) => f.id), p_agent: agent.trim() });
          return error ? error.message : null;
        }}>
        {numeros}
        <ChampPage libelle="Agent qui reçoit les fiches *"><input value={agent} onChange={(e) => setAgent(e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
      </PageLot>
    );
  }
  return (
    <PageLot titre={titre} libelle="Enregistrer le retour" pret={agent.trim().length > 0}
      onExecuter={async () => {
        const { error } = await supabase.rpc('enregistrer_retour_fiches', {
          p_agent: agent.trim(), p_details: fiches.map((f) => ({ fiche_id: f.id, etat_retour: retours[f.id] ?? 'complete' })),
        });
        return error ? error.message : null;
      }}>
      <ChampPage libelle="Agent qui rend les fiches *"><input value={agent} onChange={(e) => setAgent(e.target.value)} className={CHAMP_FENETRE} /></ChampPage>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-stone-200 text-left text-stone-500"><th className="py-2">Fiche</th><th className="py-2">État au retour</th></tr></thead>
        <tbody>
          {fiches.map((f) => (
            <tr key={f.id} className="border-b border-stone-100">
              <td className="py-2 font-mono font-semibold">{f.numero}</td>
              <td className="py-2">
                <select aria-label={`État au retour de ${f.numero}`} value={retours[f.id] ?? 'complete'} onChange={(e) => setRetours((r) => ({ ...r, [f.id]: e.target.value }))} className={CHAMP_FENETRE}>
                  <option value="complete">Complète</option><option value="incomplete">Incomplète</option>
                  <option value="abimee">Abîmée</option><option value="manquante">Manquante (reste chez l'agent)</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageLot>
  );
};

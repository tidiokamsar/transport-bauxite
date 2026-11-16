import { useCallback, useEffect, useState } from 'react';
import { ErreurFenetre, Fenetre } from '../ui/Fenetre';
import { supabase } from '../../lib/supabase';
import { Panneau, Provenance, Puce, SansDonnees } from '../ui/Panneau';
import { formatNombre } from '../Dashboard/indicateurs';
import type { Vehicle } from '../../types/vehicle';
import {
  PROPRIETES, TYPES_VEHICULE, actionsStatut, erreurPropriete, libellePropriete, libelleStatut, resumeCoutCarburant,
  type SaisiePropriete, type StatutOperationnel,
} from './flotte';

// Fiche detaillee d'un engin (D-062) : propriete et contrat, statut
// administratif (suspension, remise en service, reforme : motif obligatoire,
// fonctions serveur journalisees), synthese consolidee en lecture et
// historique. Un bloc hors des droits de l'utilisateur reste « non visible ».

interface Synthese {
  immobilisations: number | null; heures_immobilisation: number | null; immobilisation_ouverte_depuis: string | null;
  interventions_loueur: number | null; interventions_actives: number | null; pneus_montes: number;
  pleins: number | null; litres: number | null; dernier_plein: string | null; cout_carburant_connu: number | null;
  litres_sans_prix: number | null; dernier_controle_le: string | null; dernier_controle_resultat: string | null;
  documents_a_renouveler: number;
}
interface Evenement { id: string; action: string; motif: string | null; le: string; apres: Record<string, unknown> }
interface Immobilisation { id: string; debut: string; fin: string | null; cause: string; imputation: string; statut: string }
interface Plein { id: string; transaction_date: string; reference: string; volume_liters: number; total_cost: number | null }
interface Controle { id: string; effectue_le: string; resultat: string }
interface Contrat { id: string; reference: string; contrepartie: string; nature: string; statut: string }

const ACTIONS: Record<string, string> = {
  propriete: 'Propriété', suspension: 'Suspension', remise_en_service: 'Remise en service', reforme: 'Réforme',
};
const CHAMP = 'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm';
const date = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('fr-FR') : '—');
const nv = <T,>(v: T | null, f: (x: T) => string) => (v === null ? 'Non visible avec vos droits' : f(v));

export const FicheVehicule = ({ vehicule, peutEcrire, onClose, onModifie }: {
  vehicule: Vehicle; peutEcrire: boolean; onClose: () => void; onModifie: () => void;
}) => {
  const [synthese, setSynthese] = useState<Synthese | null>(null);
  const [journal, setJournal] = useState<Evenement[]>([]);
  const [immos, setImmos] = useState<Immobilisation[] | null>(null);
  const [pleins, setPleins] = useState<Plein[] | null>(null);
  const [controles, setControles] = useState<Controle[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [edition, setEdition] = useState(false);
  const [f, setF] = useState<SaisiePropriete>({
    propriete: vehicule.propriete ?? '', proprietaire: vehicule.proprietaire ?? '', exploitant: vehicule.exploitant ?? '',
    transporteur: vehicule.transporteur ?? '', contrat: vehicule.contrat_id ?? '', motif: '',
  });
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [heure, setHeure] = useState<Date | null>(null);
  const id = vehicule.id;
  const statut = vehicule.statut_operationnel as StatutOperationnel;
  const actions = actionsStatut(statut);

  const charger = useCallback(async () => {
    const [s, j, i, p, c] = await Promise.all([
      supabase.from('v_fiche_vehicule').select('*').eq('vehicle_id', id).maybeSingle(),
      supabase.from('journal_flotte').select('id, action, motif, le, apres').eq('vehicle_id', id).order('le', { ascending: false }),
      supabase.from('immobilisations').select('id, debut, fin, cause, imputation, statut').eq('vehicle_id', id).order('debut', { ascending: false }).limit(10),
      supabase.from('fuel_transactions').select('id, transaction_date, reference, volume_liters, total_cost').eq('vehicle_id', id).order('transaction_date', { ascending: false }).limit(10),
      supabase.from('controles_depart').select('id, effectue_le, resultat').eq('vehicle_id', id).order('effectue_le', { ascending: false }).limit(5),
    ]);
    setSynthese((s.data ?? null) as Synthese | null);
    setJournal((j.data ?? []) as Evenement[]);
    setImmos(i.error ? null : (i.data ?? []) as Immobilisation[]);
    setPleins(p.error ? null : (p.data ?? []) as Plein[]);
    setControles((c.data ?? []) as Controle[]);
    setHeure(new Date());
  }, [id]);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    if (!edition) return;
    supabase.rpc('contrats_rattachables_flotte').then(({ data }) => setContrats((data ?? []) as Contrat[]));
  }, [edition]);

  const executer = async (fn: string, args: Record<string, unknown>, succes: string) => {
    setBusy(true); setErreur(''); setMessage('');
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErreur(error.message); return false; }
    setMessage(succes); onModifie(); await charger(); return true;
  };
  const statuer = (fn: string, question: string, succes: string) => {
    const motif = window.prompt(question);
    if (!motif?.trim()) return;
    executer(fn, { p_vehicle: id, p_motif: motif.trim() }, succes);
  };
  const erreurSaisie = erreurPropriete(f, vehicule.propriete !== null);
  const enregistrerPropriete = () => executer('definir_propriete_vehicule', {
    p_vehicle: id, p_propriete: f.propriete, p_proprietaire: f.proprietaire.trim() || null, p_exploitant: f.exploitant.trim() || null,
    p_transporteur: f.transporteur.trim() || null, p_contrat: f.contrat || null, p_motif: f.motif.trim() || null,
  }, 'Propriété enregistrée.').then((ok) => { if (ok) setEdition(false); });
  const st = libelleStatut(vehicule.statut_operationnel);

  return (
    <Fenetre
      titre={<>{vehicule.registration} <Puce teinte={st.teinte}>{st.libelle}</Puce></>}
      ariaLabel={`Fiche ${vehicule.registration}`}
      sousTitre={<>
        <p>{vehicule.brand_model} · {TYPES_VEHICULE[vehicule.vehicle_type] ?? vehicule.vehicle_type} · {vehicule.capacity_tonnes} t{vehicule.year ? ` · ${vehicule.year}` : ''}{vehicule.chassis_number ? ` · châssis ${vehicule.chassis_number}` : ''}</p>
        {vehicule.statut_admin_motif && <p className="text-stone-600">Motif : {vehicule.statut_admin_motif} (depuis le {date(vehicule.statut_admin_depuis)})</p>}
        {vehicule.voyage_en_cours && <p className="text-stone-600">Voyage engagé : {vehicule.voyage_en_cours}</p>}
      </>}
      onFermer={onClose}
      largeur="max-w-5xl"
      corpsClassName="space-y-4 bg-stone-50 p-4 sm:p-5"
    >
        <ErreurFenetre>{erreur}</ErreurFenetre>
        {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          <Panneau titre="Propriété et contrat" action={peutEcrire && !edition && statut !== 'reforme' &&
            <button onClick={() => setEdition(true)} className="rounded border border-stone-300 px-2 py-1 text-xs">{vehicule.propriete ? 'Modifier' : 'Renseigner'}</button>}>
            {!edition ? <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-stone-500">Propriété</dt><dd className="font-semibold">{libellePropriete(vehicule.propriete)}</dd>
              <dt className="text-stone-500">Propriétaire / loueur</dt><dd>{vehicule.proprietaire ?? '—'}</dd>
              <dt className="text-stone-500">Exploitant</dt><dd>{vehicule.exploitant ?? '—'}</dd>
              <dt className="text-stone-500">Transporteur</dt><dd>{vehicule.transporteur ?? '—'}</dd>
              <dt className="text-stone-500">Contrat</dt><dd>{vehicule.contrat_id ? vehicule.contrat_reference ?? 'Rattaché (non visible)' : '—'}</dd>
            </dl> : <div role="form" aria-label="Propriété de l'engin" className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm">Propriété *<select value={f.propriete} onChange={(e) => setF({ ...f, propriete: e.target.value, contrat: e.target.value === 'kogon' ? '' : f.contrat })} className={CHAMP}>
                <option value="">Choisir</option>{Object.entries(PROPRIETES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="text-sm">Propriétaire / loueur<input value={f.proprietaire} onChange={(e) => setF({ ...f, proprietaire: e.target.value })} className={CHAMP} /></label>
              <label className="text-sm">Exploitant<input value={f.exploitant} onChange={(e) => setF({ ...f, exploitant: e.target.value })} className={CHAMP} /></label>
              <label className="text-sm">Transporteur<input value={f.transporteur} onChange={(e) => setF({ ...f, transporteur: e.target.value })} className={CHAMP} /></label>
              <label className="text-sm sm:col-span-2">Contrat de location<select value={f.contrat} disabled={f.propriete === 'kogon'} onChange={(e) => setF({ ...f, contrat: e.target.value })} className={CHAMP}>
                <option value="">Aucun</option>{contrats.map((c) => <option key={c.id} value={c.id}>{c.reference} · {c.contrepartie} ({c.statut})</option>)}</select></label>
              {vehicule.propriete && <label className="text-sm sm:col-span-2">Motif de la modification *<input value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} className={CHAMP} /></label>}
              {erreurSaisie && <p className="text-xs text-orange-700 sm:col-span-2">{erreurSaisie}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <button disabled={busy || !!erreurSaisie} onClick={enregistrerPropriete} className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer la propriété</button>
                <button onClick={() => setEdition(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm">Annuler</button>
              </div>
            </div>}
          </Panneau>

          <Panneau titre="Statut administratif">
            <p className="mb-3 text-sm text-stone-600">Une suspension rend l'engin indisponible pour la planification et le dispatch jusqu'à sa remise en service ; la réforme le sort définitivement de la flotte. Motif obligatoire, chaque action est journalisée.</p>
            {peutEcrire ? <div className="flex flex-wrap gap-2">
              {actions.suspendre && <button disabled={busy} onClick={() => statuer('suspendre_vehicule', `Motif de la suspension de ${vehicule.registration}`, 'Engin suspendu.')} className="rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm font-semibold text-purple-800">Suspendre</button>}
              {actions.remettre && <button disabled={busy} onClick={() => statuer('remettre_en_service_vehicule', `Motif de la remise en service de ${vehicule.registration}`, 'Engin remis en service.')} className="rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-800">Remettre en service</button>}
              {actions.reformer && <button disabled={busy} onClick={() => statuer('reformer_vehicule', `Réforme définitive de ${vehicule.registration} : motif`, 'Engin réformé.')} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700">Réformer</button>}
              {statut === 'reforme' && <p className="text-sm text-stone-500">Engin réformé : aucune action possible.</p>}
            </div> : <p className="text-sm text-stone-500">Lecture seule.</p>}
          </Panneau>
        </div>

        <Panneau titre="Synthèse consolidée">
          {!synthese ? <SansDonnees message="Synthèse indisponible" /> : <dl aria-label="Synthèse de l'engin" className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-stone-500">Immobilisations</dt><dd className="font-semibold">{nv(synthese.immobilisations, (n) => `${n} · ${formatNombre(Number(synthese.heures_immobilisation ?? 0))} h`)}</dd>
              {synthese.immobilisation_ouverte_depuis && <dd className="text-xs text-red-700">Ouverte depuis le {date(synthese.immobilisation_ouverte_depuis)}</dd>}</div>
            <div><dt className="text-stone-500">Interventions Neemba</dt><dd className="font-semibold">{nv(synthese.interventions_loueur, (n) => `${n} dont ${synthese.interventions_actives ?? 0} en cours`)}</dd></div>
            <div><dt className="text-stone-500">Pneus montés</dt><dd className="font-semibold">{synthese.pneus_montes}</dd></div>
            <div><dt className="text-stone-500">Documents à renouveler</dt><dd className="font-semibold">{synthese.documents_a_renouveler}</dd></div>
            <div><dt className="text-stone-500">Pleins</dt><dd className="font-semibold">{nv(synthese.pleins, (n) => `${n} · ${formatNombre(Number(synthese.litres ?? 0))} L`)}</dd>
              {synthese.dernier_plein && <dd className="text-xs text-stone-500">Dernier le {date(synthese.dernier_plein)}</dd>}</div>
            <div className="sm:col-span-2"><dt className="text-stone-500">Coût carburant connu</dt><dd className="font-semibold">{resumeCoutCarburant(synthese.cout_carburant_connu, synthese.litres_sans_prix, (n) => formatNombre(n))}</dd></div>
            <div><dt className="text-stone-500">Dernier contrôle avant départ</dt><dd className="font-semibold">{synthese.dernier_controle_le ? `${date(synthese.dernier_controle_le)} · ${synthese.dernier_controle_resultat}` : 'Aucun'}</dd></div>
          </dl>}
          <Provenance source="cumul depuis la première saisie (immobilisations, interventions, pneus, pleins, contrôles, documents)" heure={heure} />
        </Panneau>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panneau titre="Journal de la flotte">
            {journal.length === 0 ? <SansDonnees message="Aucune action enregistrée" /> :
              <ul className="divide-y divide-stone-100 text-sm">{journal.map((e) => <li key={e.id} className="py-2">
                <b>{ACTIONS[e.action] ?? e.action}</b> · {new Date(e.le).toLocaleString('fr-FR')}{e.motif ? ` · ${e.motif}` : ''}
                {e.action === 'propriete' && <span className="block text-xs text-stone-500">{libellePropriete(e.apres.propriete as string | null)}{e.apres.proprietaire ? ` · ${e.apres.proprietaire as string}` : ''}</span>}
              </li>)}</ul>}
          </Panneau>
          <Panneau titre="Immobilisations récentes">
            {immos === null ? <SansDonnees message="Non visible avec vos droits" /> : immos.length === 0 ? <SansDonnees message="Aucune immobilisation" /> :
              <ul className="divide-y divide-stone-100 text-sm">{immos.map((i) => <li key={i.id} className="py-2">{date(i.debut)} → {i.fin ? date(i.fin) : 'en cours'} · {i.cause} · {i.imputation} · {i.statut}</li>)}</ul>}
          </Panneau>
          <Panneau titre="Pleins récents">
            {pleins === null ? <SansDonnees message="Non visible avec vos droits" /> : pleins.length === 0 ? <SansDonnees message="Aucun plein" /> :
              <ul className="divide-y divide-stone-100 text-sm">{pleins.map((p) => <li key={p.id} className="py-2">{date(p.transaction_date)} · <span className="font-mono text-xs">{p.reference}</span> · {formatNombre(Number(p.volume_liters))} L · {p.total_cost === null ? 'prix non connu' : formatNombre(Number(p.total_cost))}</li>)}</ul>}
          </Panneau>
          <Panneau titre="Contrôles avant départ">
            {controles.length === 0 ? <SansDonnees message="Aucun contrôle" /> :
              <ul className="divide-y divide-stone-100 text-sm">{controles.map((c) => <li key={c.id} className="py-2">{new Date(c.effectue_le).toLocaleString('fr-FR')} · {c.resultat}</li>)}</ul>}
          </Panneau>
        </div>
    </Fenetre>
  );
};

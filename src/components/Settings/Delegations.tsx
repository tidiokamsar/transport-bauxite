import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Panneau, Puce, SansDonnees, type TeintePuce } from '../ui/Panneau';
import {
  LIBELLES_MODULES, LIBELLES_NIVEAU_DELEGATION, LIBELLES_STATUT_DELEGATION, MODULES_NON_DELEGABLES,
  delegationRevocable, erreurDelegation, libelleModule, type StatutDelegation,
} from './organisation';

// Delegations temporaires (D-064) : un utilisateur delegue son droit
// d'ecriture sur un module (l'approbation ne se delegue pas), pour une periode
// datee et avec motif. Le serveur (deleguer_droit, revoquer_delegation) refait
// chaque controle : droit propre detenu, pas a soi-meme, pas
// l'administration ; le delegue reste l'auteur de ses actes et borne par son
// propre perimetre de sites.

interface Delegation {
  id: string; delegant: string; delegant_nom: string | null; delegue: string; delegue_nom: string | null;
  module: string; niveau: string; debut: string; fin: string; motif: string; cree_le: string;
  revoquee_le: string | null; revoquee_par_nom: string | null; motif_revocation: string | null; statut: StatutDelegation;
}
interface Compte { id: string; full_name: string; role: string }

const TEINTES: Record<StatutDelegation, TeintePuce> = { active: 'vert', a_venir: 'bleu', expiree: 'gris', revoquee: 'rouge', sans_effet: 'orange' };
const CHAMP = 'rounded border border-stone-300 px-3 py-2 text-sm';
const VIDE = { delegue: '', module: '', niveau: 'ecriture', debut: '', fin: '', motif: '' };
const dateHeure = (x: string) => new Date(x).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export const Delegations = ({ administration = false }: { administration?: boolean }) => {
  const { profile, hasPermission, erreurDelegations, rafraichirDelegations } = useAuth();
  const [lignes, setLignes] = useState<Delegation[] | null>(null);
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [f, setF] = useState(VIDE);
  const [revocation, setRevocation] = useState<{ id: string; motif: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const [d, c] = await Promise.all([supabase.rpc('mes_delegations'), supabase.rpc('comptes_delegables')]);
    if (d.error || c.error) setErreur((d.error ?? c.error)?.message ?? '');
    setLignes((d.data as Delegation[] | null) ?? []);
    setComptes((c.data as Compte[] | null) ?? []);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  // Modules ou le compte detient en propre le droit d'ecriture : un droit
  // recu par delegation ne se redelegue pas (indicatif : le serveur verifie).
  const modules = useMemo(() => Object.keys(LIBELLES_MODULES).filter((m) => !MODULES_NON_DELEGABLES.includes(m)
    && (hasPermission(m, 'edit', true) || hasPermission(m, 'create', true))),
  [hasPermission]);

  const deleguer = async () => {
    setErreur(''); setMessage('');
    const e = erreurDelegation(f, new Date());
    if (e) { setErreur(e); return; }
    setBusy(true);
    const { error } = await supabase.rpc('deleguer_droit', {
      p_delegue: f.delegue, p_module: f.module, p_niveau: f.niveau,
      p_debut: f.debut ? new Date(f.debut).toISOString() : null, p_fin: new Date(f.fin).toISOString(), p_motif: f.motif.trim(),
    });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setMessage('Délégation enregistrée.');
    setF(VIDE);
    await charger();
    await rafraichirDelegations();
  };

  const revoquer = async () => {
    if (!revocation) return;
    if (!revocation.motif.trim()) { setErreur('Le motif de révocation est obligatoire.'); return; }
    setErreur(''); setMessage(''); setBusy(true);
    const { error } = await supabase.rpc('revoquer_delegation', { p_id: revocation.id, p_motif: revocation.motif.trim() });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setRevocation(null);
    setMessage('Délégation révoquée.');
    await charger();
    await rafraichirDelegations();
  };

  const estAdmin = profile?.role === 'admin';
  const titre = administration ? 'Toutes les délégations' : 'Mes délégations';

  return (
    <div className="space-y-6">
      <Panneau titre="Déléguer un droit">
        <p className="mb-4 text-sm text-stone-500">
          Vous déléguez le droit d'écriture que vous détenez en propre sur un module, pour une période datée qui commence au plus tôt maintenant. L'approbation ne se délègue pas. Le délégué agit en son nom,
          reste soumis à la séparation des tâches et à son propre périmètre de sites, qui doit être compris dans le vôtre. La lecture du module n'est déléguée que si vous la détenez. L'administration ne se délègue pas.
        </p>
        {erreurDelegations && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Les délégations reçues n'ont pas pu être chargées ({erreurDelegations}) : les menus peuvent ne pas refléter vos droits. Le serveur reste seul juge.</p>}
        {erreur && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
        {message && <p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Délégué
            <select aria-label="Compte délégué" value={f.delegue} onChange={(e) => setF({ ...f, delegue: e.target.value })} className={`mt-1 w-full ${CHAMP}`}>
              <option value="">Choisir</option>
              {comptes.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </label>
          <label className="text-sm">Niveau
            <select aria-label="Niveau délégué" value={f.niveau} disabled className={`mt-1 w-full ${CHAMP}`}>
              <option value="ecriture">Écriture (et lecture)</option>
            </select>
          </label>
          <label className="text-sm">Module
            <select aria-label="Module délégué" value={f.module} onChange={(e) => setF({ ...f, module: e.target.value })} className={`mt-1 w-full ${CHAMP}`}>
              <option value="">Choisir</option>
              {modules.map((m) => <option key={m} value={m}>{libelleModule(m)}</option>)}
            </select>
          </label>
          <label className="text-sm">Début (vide : maintenant)
            <input aria-label="Début de la délégation" type="datetime-local" value={f.debut} onChange={(e) => setF({ ...f, debut: e.target.value })} className={`mt-1 w-full ${CHAMP}`} />
          </label>
          <label className="text-sm">Fin
            <input aria-label="Fin de la délégation" type="datetime-local" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} className={`mt-1 w-full ${CHAMP}`} />
          </label>
          <label className="text-sm">Motif
            <input aria-label="Motif de la délégation" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} className={`mt-1 w-full ${CHAMP}`} />
          </label>
        </div>
        <button disabled={busy} onClick={deleguer} className="mt-3 rounded-lg bg-orange-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Déléguer</button>
      </Panneau>

      <Panneau titre={titre}>
        {lignes === null ? <p className="text-sm">Chargement…</p> : lignes.length === 0 ? <SansDonnees message="Aucune délégation" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-stone-500">
                <th className="py-2 pr-3">Délégant</th><th className="py-2 pr-3">Délégué</th><th className="py-2 pr-3">Droit</th>
                <th className="py-2 pr-3">Période</th><th className="py-2 pr-3">Statut</th><th className="py-2 pr-3">Motif</th><th className="py-2">Action</th>
              </tr></thead>
              <tbody>
                {lignes.map((d) => {
                  const peutRevoquer = delegationRevocable(d.statut) && (estAdmin || d.delegant === profile?.id);
                  return (
                    <tr key={d.id} className="border-b border-stone-100 align-top">
                      <td className="py-2 pr-3">{d.delegant_nom ?? d.delegant}</td>
                      <td className="py-2 pr-3">{d.delegue_nom ?? d.delegue}</td>
                      <td className="py-2 pr-3">{LIBELLES_NIVEAU_DELEGATION[d.niveau] ?? d.niveau} · {libelleModule(d.module)}</td>
                      <td className="py-2 pr-3">{dateHeure(d.debut)} au {dateHeure(d.fin)}</td>
                      <td className="py-2 pr-3"><Puce teinte={TEINTES[d.statut]}>{LIBELLES_STATUT_DELEGATION[d.statut]}</Puce></td>
                      <td className="py-2 pr-3">
                        {d.motif}
                        {d.revoquee_le && <p className="text-xs text-stone-500">Révoquée le {dateHeure(d.revoquee_le)} par {d.revoquee_par_nom ?? '-'} : {d.motif_revocation}</p>}
                      </td>
                      <td className="py-2">
                        {peutRevoquer && (revocation?.id === d.id ? (
                          <div className="flex flex-wrap gap-2">
                            <input aria-label="Motif de la révocation" placeholder="Motif" value={revocation.motif}
                              onChange={(e) => setRevocation({ ...revocation, motif: e.target.value })} className={CHAMP} />
                            <button disabled={busy} onClick={revoquer} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Révoquer</button>
                            <button onClick={() => setRevocation(null)} className="rounded-lg border border-stone-300 px-3 py-2 text-xs">Retour</button>
                          </div>
                        ) : (
                          <button onClick={() => setRevocation({ id: d.id, motif: '' })} className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-700">Révoquer</button>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-stone-500">« Sans effet » : période en cours, mais le délégant ne détient plus le droit, le délégué est inactif ou restreint par l'administrateur, ou son périmètre de sites dépasse celui du délégant.</p>
      </Panneau>
    </div>
  );
};
